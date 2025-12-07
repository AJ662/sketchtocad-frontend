import { ClusteringStatistics } from "./ClusteringStatistics";

export interface ClusteringResult {
  final_labels: number[];
  processed_clusters: Record<string, number[]>;
  statistics: ClusteringStatistics;
  clustered_image?: string;
}