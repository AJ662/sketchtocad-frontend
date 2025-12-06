import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_CONFIG } from '../config/api.config';

interface BedData {
  bed_id: number;
  area: number;
  rgb_median: number[];
  rgb_mean: number[];
  clean_pixel_count: number;
  polygons?: number[][][];
}

interface ProcessingStatistics {
  raw_border_pixels: number;
  clean_border_pixels: number;
  final_border_pixels: number;
  total_beds_found: number;
  total_areas_detected: number;
  average_bed_size: number;
  largest_bed_size: number;
  smallest_bed_size: number;
}

interface ProcessingResult {
  session_id: string;
  saga_id: string;
  bed_count: number;
  bed_data: BedData[];
  statistics: ProcessingStatistics;
  image_shape: number[];
  processing_time_ms: number;
}

interface SagaStep {
  step_name: string;
  status: string;
  duration_ms: number | null;
}

interface SagaStatus {
  saga_id: string;
  status: string;
  current_step: string | null;
  session_id: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  total_duration_ms: number | null;
  error_message: string | null;
  result_data: any;
  steps: SagaStep[];
}

interface WorkflowStartResponse {
  saga_id: string;
  session_id: string;
  status: string;
  message: string;
}

interface EnhancedColorsResponse {
  enhanced_colors: Record<string, number[][]>;
  enhancement_methods: string[];
}

interface ClusterStatistics {
  total_beds: number;
  clustered_beds: number;
  unclustered_beds: number;
  coverage_percent: number;
  num_clusters: number;
  cluster_details: Array<{
    cluster_id: number;
    cluster_name: string;
    bed_count: number;
    total_area: number;
    average_area: number;
    bed_ids: number[];
  }>;
}

interface ClusteringResult {
  final_labels: number[];
  processed_clusters: Record<string, number[]>;
  statistics: ClusterStatistics;
  clustered_image?: string;
}

class ApiService {
  private gatewayApi: AxiosInstance;
  private currentSagaId: string | null = null;

  constructor() {
    this.gatewayApi = axios.create({
      baseURL: API_CONFIG.workflow.baseUrl.replace('/workflow', ''),
      headers: { 
        'Content-Type': 'application/json'
      },
      timeout: 120000
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    const errorHandler = (error: AxiosError) => {
      if (error.response) {
        console.error('API Error:', {
          status: error.response.status,
          data: error.response.data,
          service: error.config?.baseURL
        });
      } else if (error.request) {
        console.error('Network Error:', {
          message: 'No response from server',
          service: error.config?.baseURL
        });
      } else {
        console.error('Request Error:', error.message);
      }
      return Promise.reject(error);
    };

    this.gatewayApi.interceptors.response.use(
      response => response,
      errorHandler
    );
  }

  getSagaId(): string | null {
    return this.currentSagaId;
  }

  async startWorkflow(file: File): Promise<WorkflowStartResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await this.gatewayApi.post<WorkflowStartResponse>(
      '/workflow/start',
      formData,
      {
        headers: { 
          'Content-Type': 'multipart/form-data' 
        }
      }
    );
    
    this.currentSagaId = response.data.saga_id;
    return response.data;
  }

  async getWorkflowStatus(sagaId: string): Promise<SagaStatus> {
    const response = await this.gatewayApi.get<SagaStatus>(
      `/workflow/${sagaId}`
    );
    return response.data;
  }

  async pollWorkflowStatus(
    sagaId: string, 
    targetStatuses: string[],
    onProgress?: (status: SagaStatus) => void,
    maxAttempts = 120,
    intervalMs = 1000
  ): Promise<SagaStatus> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getWorkflowStatus(sagaId);
      
      if (onProgress) {
        onProgress(status);
      }
      
      if (targetStatuses.includes(status.status)) {
        return status;
      }
      
      if (status.status === 'failed' || status.status === 'compensated') {
        throw new Error(`Workflow failed: ${status.error_message || 'Unknown error'}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    throw new Error('Workflow timeout - exceeded maximum wait time');
  }

  async processImage(file: File, onProgress?: (status: SagaStatus) => void): Promise<ProcessingResult> {
    const workflowResult = await this.startWorkflow(file);
    
    // Wait until image processing is done and awaiting enhancement
    const completedStatus = await this.pollWorkflowStatus(
      workflowResult.saga_id,
      ['awaiting_enhancement_selection'],
      onProgress
    );
    
    const resultData = completedStatus.result_data || {};
    
    return {
      session_id: completedStatus.session_id,
      saga_id: workflowResult.saga_id,
      bed_count: resultData.bed_count || 0,
      bed_data: resultData.bed_data || [],
      statistics: resultData.statistics || {
        raw_border_pixels: 0,
        clean_border_pixels: 0,
        final_border_pixels: 0,
        total_beds_found: 0,
        total_areas_detected: 0,
        average_bed_size: 0,
        largest_bed_size: 0,
        smallest_bed_size: 0
      },
      image_shape: resultData.image_shape || [],
      processing_time_ms: resultData.processing_time_ms || 0
    };
  }

  async submitEnhancementSelection(
    sagaId: string,
    enhancementMethod: string,
    enhancedColors: Record<string, number[][]>,
    onProgress?: (status: SagaStatus) => void
  ): Promise<SagaStatus> {
    await this.gatewayApi.post(`/workflow/${sagaId}/enhancement`, {
      enhancement_method: enhancementMethod,
      enhanced_colors: enhancedColors
    });
    
    // Wait until ready for clustering
    return await this.pollWorkflowStatus(
      sagaId,
      ['awaiting_clustering'],
      onProgress
    );
  }

  async submitClustering(
    sagaId: string,
    clustersData: Record<string, number[]>,
    onProgress?: (status: SagaStatus) => void
  ): Promise<SagaStatus> {
    await this.gatewayApi.post(`/workflow/${sagaId}/clustering`, {
      clusters_data: clustersData
    });
    
    // Wait until clustering is done and awaiting export
    return await this.pollWorkflowStatus(
      sagaId,
      ['awaiting_export'],
      onProgress
    );
  }

  async requestExport(
    sagaId: string,
    exportType: 'summary' | 'detailed' = 'detailed',
    onProgress?: (status: SagaStatus) => void
  ): Promise<SagaStatus> {
    await this.gatewayApi.post(`/workflow/${sagaId}/export`, {
      export_type: exportType
    });
    
    // Wait until export is complete
    return await this.pollWorkflowStatus(
      sagaId,
      ['completed'],
      onProgress
    );
  }

  // Legacy methods for direct API calls (create enhanced colors locally)
  async createEnhancedColors(bedData: BedData[]): Promise<EnhancedColorsResponse> {
    const response = await this.gatewayApi.post<EnhancedColorsResponse>(
      '/direct/clustering/create-enhanced-colors',
      { bed_data: bedData }
    );
    return response.data;
  }

  downloadFile(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}

export const apiService = new ApiService();

export type {
  BedData,
  ProcessingResult,
  ProcessingStatistics,
  EnhancedColorsResponse,
  ClusteringResult,
  ClusterStatistics,
  SagaStatus,
  SagaStep,
  WorkflowStartResponse
};