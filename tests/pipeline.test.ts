import { describe, it, expect } from 'vitest';
import { chunkText } from '../src/pipeline/chunk.js';
import { clusterTopics } from '../src/pipeline/cluster.js';

describe('chunkText', () => {
  it('splits long text with overlap', () => {
    const text = 'a'.repeat(1000);
    const chunks = chunkText(text, 200, 50);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBe(200);
  });
});

describe('clusterTopics', () => {
  it('clusters related texts', () => {
    const texts = [
      'Kubernetes deployment failed due to image pull backoff',
      'Pods are crashing with OOMKilled in our k8s cluster',
      'Quarterly roadmap planning and OKR setting for Q3',
      'Define company objectives and key results for the next quarter'
    ];
    const { labels } = clusterTopics(texts);
    // Expect two clusters
    const unique = new Set(labels);
    expect(unique.size).toBe(2);
  });
});
