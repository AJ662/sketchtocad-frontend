"use client";

import { useState } from "react";
import { 
  apiService, 
  ProcessingResult,
  EnhancedColorsResponse,
  SagaStatus
} from "@/services/api.service";
import { ClusteringResult } from "./types/clustering/ClusteringResult";
import ImageUploader from "./components/ImageUploader";
import ResultsDashboard from "./components/ResultsDashboard";
import EnhancementSelector from "./components/EnhancementSelector";
import dynamic from "next/dynamic";

const ClusteringCanvas = dynamic(
  () => import("./components/ClusteringCanvas"),
  { 
    ssr: false,
    loading: () => (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-lg text-gray-600">Loading clustering interface...</span>
      </div>
    )
  }
);

interface EnhancementSelection {
  method: string;
  plot_data: number[][];
  xlabel: string;
  ylabel: string;
  original_colors: number[][];
  full_enhanced_colors: Record<string, number[][]>;
}

export default function Home() {
  const [currentStep, setCurrentStep] = useState<'upload' | 'enhancement' | 'clustering' | 'results'>('upload');
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [enhancementData, setEnhancementData] = useState<EnhancedColorsResponse | null>(null);
  const [enhancementSelection, setEnhancementSelection] = useState<EnhancementSelection | null>(null);
  const [clusteringResult, setClusteringResult] = useState<ClusteringResult | null>(null);
  const [sagaId, setSagaId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sagaStatus, setSagaStatus] = useState<string | null>(null);

  const handleSagaProgress = (status: SagaStatus) => {
    setSagaStatus(status.status);
    console.log('Saga progress:', status.status, status.current_step);
  };

  const handleImageUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Starting saga workflow...");
      const result = await apiService.processImage(file, handleSagaProgress);
      
      console.log("Image processed via saga:", {
        sagaId: result.saga_id,
        sessionId: result.session_id,
        bedCount: result.bed_count
      });
      
      setSagaId(result.saga_id);
      setProcessingResult(result);
      setCurrentStep('enhancement');
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || "Failed to process image";
      setError(`Image Processing Error: ${errorMessage}`);
      console.error("Image upload error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const generateEnhancedColors = async (): Promise<EnhancedColorsResponse | null> => {
    if (!processingResult) return null;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Creating enhanced colors...");
      const enhancedColors = await apiService.createEnhancedColors(
        processingResult.bed_data
      );
      
      console.log("Enhanced colors created:", {
        methods: enhancedColors.enhancement_methods,
        bedCount: processingResult.bed_data.length
      });
      
      setEnhancementData(enhancedColors);
      return enhancedColors;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message :
                          (err as any)?.response?.data?.detail || "Failed to create enhanced colors";
      setError(`Enhancement Error: ${errorMessage}`);
      console.error("Enhancement error:", err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnhancementSelection = async (method: string) => {
    if (!processingResult || !sagaId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      let colors = enhancementData;
      if (!colors) {
        colors = await generateEnhancedColors();
        if (!colors) {
          throw new Error("Failed to generate enhanced colors");
        }
      }

      if (!colors.enhanced_colors[method]) {
        throw new Error(`Enhancement method '${method}' not available`);
      }

      console.log("Enhancement method selected:", method);
      
      // Submit enhancement selection to saga
      await apiService.submitEnhancementSelection(
        sagaId,
        method,
        colors.enhanced_colors,
        handleSagaProgress
      );
      
      const originalRgbColors = processingResult.bed_data.map(bed => bed.rgb_median);
      const rgbColors = colors.enhanced_colors.original || originalRgbColors;
      
      const selection: EnhancementSelection = {
        method: method,
        plot_data: colors.enhanced_colors[method],
        xlabel: 'Component 1',
        ylabel: 'Component 2',
        original_colors: rgbColors,
        full_enhanced_colors: colors.enhanced_colors
      };
      
      setEnhancementSelection(selection);
      setCurrentStep('clustering');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message :
                          (err as any)?.response?.data?.detail || "Failed to select enhancement method";
      setError(`Enhancement Selection Error: ${errorMessage}`);
      console.error("Enhancement selection error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClustering = async (clustersData: Record<string, number[]>) => {
    if (!processingResult || !enhancementSelection || !sagaId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Submitting clustering to saga:", {
        sagaId,
        clusterCount: Object.keys(clustersData).length,
        totalBeds: processingResult.bed_data.length
      });
      
      // Submit clustering to saga and wait for completion
      const status = await apiService.submitClustering(
        sagaId,
        clustersData,
        handleSagaProgress
      );
      
      // Get clustering result from saga result_data
      const resultData = status.result_data || {};
      
      const result: ClusteringResult = {
        final_labels: [],
        processed_clusters: resultData.processed_clusters || clustersData,
        statistics: resultData.clustering_statistics || {
          total_beds: processingResult.bed_data.length,
          clustered_beds: Object.values(clustersData).flat().length,
          unclustered_beds: processingResult.bed_data.length - Object.values(clustersData).flat().length,
          coverage_percent: Math.round((Object.values(clustersData).flat().length / processingResult.bed_data.length) * 100),
          num_clusters: Object.keys(clustersData).length,
          cluster_details: Object.entries(clustersData).map(([name, bedIds], index) => ({
            cluster_id: index,
            cluster_name: name,
            bed_count: bedIds.length,
            total_area: bedIds.reduce((sum, id) => {
              const bed = processingResult.bed_data.find(b => b.bed_id === id);
              return sum + (bed?.area || 0);
            }, 0),
            average_area: Math.round(bedIds.reduce((sum, id) => {
              const bed = processingResult.bed_data.find(b => b.bed_id === id);
              return sum + (bed?.area || 0);
            }, 0) / bedIds.length),
            bed_ids: bedIds
          }))
        }
      };
      
      console.log("Clustering completed via saga");
      
      setClusteringResult(result);
      setCurrentStep('results');
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || "Failed to process clustering";
      setError(`Clustering Error: ${errorMessage}`);
      console.error("Clustering error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (exportType: 'summary' | 'detailed' = 'detailed') => {
    if (!processingResult || !clusteringResult || !sagaId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Requesting DXF export via saga:", exportType);
      
      // Request export via saga
      const status = await apiService.requestExport(
        sagaId,
        exportType,
        handleSagaProgress
      );
      
      const downloadUrl = status.result_data?.download_url;
      
      if (downloadUrl) {
        // Download the file
        const response = await fetch(downloadUrl);
        const blob = await response.blob();
        
        const timestamp = new Date().getTime();
        const filename = `plant_clusters_${exportType}_${timestamp}.dxf`;
        apiService.downloadFile(blob, filename);
        
        console.log("DXF export successful:", filename);
      } else {
        throw new Error("No download URL in export result");
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || "Failed to export DXF";
      setError(`Export Error: ${errorMessage}`);
      console.error("Export error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setCurrentStep('upload');
    setProcessingResult(null);
    setEnhancementData(null);
    setEnhancementSelection(null);
    setClusteringResult(null);
    setSagaId(null);
    setSagaStatus(null);
    setError(null);
  };

  const handleBack = () => {
    if (currentStep === 'enhancement') {
      setCurrentStep('upload');
    } else if (currentStep === 'clustering') {
      setCurrentStep('enhancement');
      setEnhancementSelection(null);
    } else if (currentStep === 'results') {
      setCurrentStep('clustering');
      setClusteringResult(null);
    }
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Plant Bed Clustering Tool
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Upload an image, choose color enhancement method, draw polygons to cluster similar plants, 
              and analyze the results with detailed statistics.
            </p>
            {sagaId && (
              <p className="text-sm text-gray-500 mt-2">
                Saga ID: {sagaId} | Status: {sagaStatus}
              </p>
            )}
          </div>

          <div className="flex justify-center mb-8">
            <div className="flex items-center space-x-4">
              <StepIndicator 
                step={1} 
                title="Upload Image" 
                isActive={currentStep === 'upload'}
                isCompleted={processingResult !== null}
              />
              <div className="w-8 h-0.5 bg-gray-300"></div>
              <StepIndicator 
                step={2} 
                title="Color Enhancement" 
                isActive={currentStep === 'enhancement'}
                isCompleted={enhancementSelection !== null}
              />
              <div className="w-8 h-0.5 bg-gray-300"></div>
              <StepIndicator 
                step={3} 
                title="Manual Clustering" 
                isActive={currentStep === 'clustering'}
                isCompleted={clusteringResult !== null}
              />
              <div className="w-8 h-0.5 bg-gray-300"></div>
              <StepIndicator 
                step={4} 
                title="Results" 
                isActive={currentStep === 'results'}
                isCompleted={false}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 max-w-4xl mx-auto">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="ml-auto text-red-400 hover:text-red-600"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-lg text-gray-600">
                {currentStep === 'upload' ? 'Processing image...' : 
                 currentStep === 'enhancement' ? 'Submitting enhancement...' : 
                 currentStep === 'clustering' ? 'Processing clusters...' :
                 'Exporting...'}
              </span>
            </div>
          )}

          {!isLoading && (
            <>
              {currentStep === 'upload' && (
                <ImageUploader onUpload={handleImageUpload} />
              )}

              {currentStep === 'enhancement' && processingResult && (
                <EnhancementSelector 
                  processingResult={processingResult}
                  onSelection={handleEnhancementSelection}
                  onBack={handleBack}
                />
              )}

              {currentStep === 'clustering' && enhancementSelection && (
                <ClusteringCanvas 
                  enhancementSelection={enhancementSelection}
                  onClustering={handleClustering}
                  onBack={handleBack}
                />
              )}

              {currentStep === 'results' && clusteringResult && processingResult && (
                <ResultsDashboard 
                  clusteringResult={clusteringResult}
                  processingResult={processingResult}
                  onReset={handleReset}
                  onExport={handleExport}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ 
  step, 
  title, 
  isActive, 
  isCompleted 
}: { 
  step: number; 
  title: string; 
  isActive: boolean; 
  isCompleted: boolean; 
}) {
  return (
    <div className="flex items-center">
      <div className={`
        flex items-center justify-center w-8 h-8 rounded-full border-2 
        ${isCompleted 
          ? 'bg-green-600 border-green-600 text-white' 
          : isActive 
            ? 'bg-blue-600 border-blue-600 text-white' 
            : 'bg-white border-gray-300 text-gray-500'
        }
      `}>
        {isCompleted ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <span className="text-sm font-medium">{step}</span>
        )}
      </div>
      <span className={`ml-2 text-sm font-medium ${
        isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
      }`}>
        {title}
      </span>
    </div>
  );
}