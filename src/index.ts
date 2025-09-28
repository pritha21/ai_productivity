import 'dotenv/config';
import Fastify from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { chunkText } from './pipeline/chunk.js';
import { clusterTopics } from './pipeline/cluster.js';
import { labelTopics } from './pipeline/label.js';

const prisma = new PrismaClient();

const app = Fastify({ logger: true });

app.get('/health', async () => ({ ok: true }));

// Seed workspace quickly
app.post('/api/workspaces', async (req, reply) => {
  const body = z.object({ name: z.string() }).parse(req.body);
  const ws = await prisma.workspace.create({ data: { name: body.name } });
  return reply.code(201).send(ws);
});

// Ingest simple items (for MVP/testing). Real connectors come later.
app.post('/api/:workspaceId/items', async (req, reply) => {
  const params = z.object({ workspaceId: z.string() }).parse(req.params);
  const body = z.object({
    source: z.enum(['SLACK', 'GOOGLE_DRIVE', 'NOTION']).default('SLACK'),
    name: z.string().default('default'),
    items: z.array(z.object({ externalId: z.string(), title: z.string().optional(), content: z.string() }))
  }).parse(req.body);

  const source = await prisma.source.upsert({
    where: { workspaceId_type_name: { workspaceId: params.workspaceId, type: body.source, name: body.name } },
    create: { workspaceId: params.workspaceId, type: body.source, name: body.name },
    update: {},
  });

  const created = await prisma.$transaction(body.items.map((it) => prisma.item.create({
    data: {
      workspaceId: params.workspaceId,
      sourceId: source.id,
      externalId: it.externalId,
      title: it.title,
      content: it.content,
    }
  })));

  // Chunk immediately
  for (const item of created) {
    const chunks = chunkText(item.content);
    await prisma.$transaction(chunks.map((text, i) => prisma.chunk.create({ data: { itemId: item.id, index: i, text } })));
  }

  return reply.send({ count: created.length });
});

// Cluster all chunks in a workspace into topics
app.post('/api/:workspaceId/cluster', async (req, reply) => {
  const params = z.object({ workspaceId: z.string() }).parse(req.params);
  const chunks = await prisma.chunk.findMany({
    where: { item: { workspaceId: params.workspaceId } },
    include: { item: true },
  });

  if (chunks.length === 0) return reply.code(400).send({ error: 'No chunks to cluster' });

  const result = clusterTopics(chunks.map(c => c.text));

  // Create topics and memberships
  const topicCount = Math.max(...result.labels) + 1;
  const topics = await prisma.$transaction(Array.from({ length: topicCount }).map((_, i) => prisma.topic.create({
    data: { workspaceId: params.workspaceId, label: `Topic ${i + 1}` }
  })));

  // Save memberships
  await prisma.$transaction(result.labels.map((label, idx) => prisma.topicMembership.create({
    data: { chunkId: chunks[idx].id, topicId: topics[label].id, score: 1 }
  })));

  return reply.send({ topics: topics.length });
});

// Label topics via Groq LLM using exemplar chunks
app.post('/api/:workspaceId/label', async (req, reply) => {
  const params = z.object({ workspaceId: z.string() }).parse(req.params);
  const topics = await prisma.topic.findMany({ where: { workspaceId: params.workspaceId } });
  const memberships = await prisma.topicMembership.findMany({
    where: { topicId: { in: topics.map(t => t.id) } },
    include: { chunk: true }
  });

  const grouped = new Map<string, string[]>();
  for (const m of memberships) {
    const arr = grouped.get(m.topicId) ?? [];
    if (arr.length < 5) arr.push(m.chunk.text);
    grouped.set(m.topicId, arr);
  }

  const updates = [] as Array<ReturnType<typeof prisma.topic.update>>;
  for (const t of topics) {
    const exemplars = grouped.get(t.id) ?? [];
    const label = await labelTopics(exemplars);
    updates.push(prisma.topic.update({ where: { id: t.id }, data: { label } }));
  }
  await prisma.$transaction(updates);
  return reply.send({ updated: topics.length });
});

app.get('/api/:workspaceId/topics', async (req, reply) => {
  const params = z.object({ workspaceId: z.string() }).parse(req.params);
  const topics = await prisma.topic.findMany({
    where: { workspaceId: params.workspaceId },
    include: { chunks: { include: { chunk: { include: { item: true } } } } }
  });
  return reply.send(topics);
});

const port = Number(process.env.PORT || 3000);
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
