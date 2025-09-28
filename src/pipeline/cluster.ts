import natural from 'natural';
import kmeans from 'ml-kmeans';

export function clusterTopics(texts: string[]) {
  // Build TF-IDF vectors
  const tfidf = new natural.TfIdf();
  texts.forEach((t) => tfidf.addDocument(t));

  // Build vocabulary
  const vocabSet = new Set<string>();
  (tfidf.documents as Array<Record<string, number>>).forEach((doc) => {
    Object.keys(doc).forEach((term) => {
      if (term !== '__key') vocabSet.add(term);
    });
  });
  const vocab = Array.from(vocabSet);

  const vectors = texts.map((_, i) => {
    const vec = new Array(vocab.length).fill(0);
    vocab.forEach((term, j) => {
      const val = tfidf.tfidf(term, i);
      vec[j] = val;
    });
    return vec;
  });

  const n = vectors.length;
  const k = n >= 4 ? Math.min(8, Math.round(Math.sqrt(n))) : 1;
  const km = kmeans(vectors, k, { initialization: 'kmeans++' });

  return {
    labels: km.clusters as number[],
    centroids: (km.centroids as Array<{ centroid: number[] }>).map((c) => c.centroid),
  };
}
