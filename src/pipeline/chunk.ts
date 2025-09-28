export function chunkText(text: string, maxChars = 800, overlap = 100): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxChars) return [cleaned];
  const chunks: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const end = Math.min(i + maxChars, cleaned.length);
    chunks.push(cleaned.slice(i, end));
    if (end === cleaned.length) break;
    i = end - overlap;
  }
  return chunks;
}
