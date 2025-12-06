// SketchToCad-Frontend/src/app/types/processing/ProcessingResult.ts
import { BedData } from '../bed/BedData';
import { ProcessingStatistics } from './ProcessingStatistics';

export interface ProcessingResult {
  session_id: string;
  saga_id: string;
  bed_count: number;
  bed_data: BedData[];
  statistics: ProcessingStatistics;
  image_shape: number[];
  processing_time_ms: number;
  enhanced_colors?: Record<string, number[][]>;
  enhancement_methods?: string[];
  enhancement_previews?: Record<string, { image: string }>;
}