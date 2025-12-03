import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_CONFIG } from '../config/api.config';

interface BedData {
  bed_id: number;
  area: number;
  rgb_median: number[];
  rgb_mean: number[];
  clean_pixel_count: number;
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
  }>;
}

interface ClusteringResult {
  final_labels: number[];
  processed_clusters: Record<string, number[]>;
  statistics: ClusterStatistics;
}

interface HealthStatus {
  status: string;
  service: string;
  version: string;
}

class ApiService {
  private gatewayApi: AxiosInstance;

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
    
    return response.data;
  }

  async getWorkflowStatus(sagaId: string): Promise<SagaStatus> {
    const response = await this.gatewayApi.get<SagaStatus>(
      `/workflow/${sagaId}`
    );
    return response.data;
  }

  async pollWorkflowUntilComplete(
    sagaId: string, 
    onProgress?: (status: SagaStatus) => void,
    maxAttempts = 120,
    intervalMs = 1000
  ): Promise<SagaStatus> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getWorkflowStatus(sagaId);
      
      if (onProgress) {
        onProgress(status);
      }
      
      if (status.status === 'completed') {
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
    const completedWorkflow = await this.pollWorkflowUntilComplete(workflowResult.saga_id, onProgress);
    
    return {
      session_id: completedWorkflow.session_id,
      bed_count: completedWorkflow.result_data?.bed_count || 0,
      bed_data: completedWorkflow.result_data?.bed_data || [],
      statistics: {} as ProcessingStatistics,
      image_shape: [],
      processing_time_ms: completedWorkflow.total_duration_ms || 0
    };
  }

  async createEnhancedColors(bedData: BedData[]): Promise<EnhancedColorsResponse> {
    const response = await this.gatewayApi.post<EnhancedColorsResponse>(
      '/direct/clustering/create-enhanced-colors',
      { bed_data: bedData }
    );
    return response.data;
  }

  async processClustering(
    bedData: BedData[],
    enhancedColors: Record<string, number[][]>,
    clustersData: Record<string, number[]>
  ): Promise<ClusteringResult> {
    const response = await this.gatewayApi.post<ClusteringResult>(
      '/direct/clustering/process-clustering',
      {
        bed_data: bedData,
        enhanced_colors: enhancedColors,
        clusters_data: clustersData
      }
    );
    return response.data;
  }

  async exportDxf(
    bedData: BedData[],
    clusterDict: Record<string, string>,
    exportType: 'summary' | 'detailed' = 'detailed'
  ): Promise<Blob> {
    const response = await this.gatewayApi.post(
      '/direct/dxf-export/export-dxf',
      {
        bed_data: bedData,
        cluster_dict: clusterDict,
        export_type: exportType
      },
      {
        responseType: 'blob'
      }
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

  async completeWorkflow(
    imageFile: File,
    selectedEnhancementMethod: string,
    clusters: Record<string, number[]>,
    exportType: 'summary' | 'detailed' = 'detailed',
    onProgress?: (status: SagaStatus) => void
  ): Promise<{
    processing: ProcessingResult;
    enhancement: EnhancedColorsResponse;
    clustering: ClusteringResult;
    dxfFile: Blob;
  }> {
    const processing = await this.processImage(imageFile, onProgress);
    const enhancement = await this.createEnhancedColors(processing.bed_data);
    const clustering = await this.processClustering(
      processing.bed_data,
      enhancement.enhanced_colors,
      clusters
    );

    const clusterDict: Record<string, string> = {};
    Object.entries(clusters).forEach(([name, bedIds], index) => {
      clusterDict[index.toString()] = name;
    });

    const dxfFile = await this.exportDxf(
      processing.bed_data,
      clusterDict,
      exportType
    );

    return {
      processing,
      enhancement,
      clustering,
      dxfFile
    };
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
  HealthStatus,
  SagaStatus,
  SagaStep,
  WorkflowStartResponse
};