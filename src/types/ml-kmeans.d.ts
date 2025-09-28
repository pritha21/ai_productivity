declare module 'ml-kmeans' {
  type KMeansOptions = {
    initialization?: 'kmeans++' | 'random';
    maxIterations?: number;
    seed?: number;
  };
  type KMeansResult = {
    clusters: number[];
    centroids: Array<{ centroid: number[]; error: number; size: number }>;
  };
  function kmeans(data: number[][], k: number, options?: KMeansOptions): KMeansResult;
  export default kmeans;
}
