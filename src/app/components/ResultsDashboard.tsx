"use client";

import { useState } from 'react';
import { ClusteringResult } from '../types/clustering/ClusteringResult';
import { ProcessingResult } from '../types/processing/ProcessingResult';
import API_CONFIG from '@/config/api.config';

interface ResultsDashboardProps {
  clusteringResult: ClusteringResult;
  processingResult: ProcessingResult;
  onReset: () => void;
  onExport?: (exportType: 'summary' | 'detailed') => void;
}

const CLUSTER_COLORS = [
  { bg: 'bg-red-500', text: 'text-red-700', border: 'border-red-200', name: 'Red' },
  { bg: 'bg-green-500', text: 'text-green-700', border: 'border-green-200', name: 'Green' },
  { bg: 'bg-blue-500', text: 'text-blue-700', border: 'border-blue-200', name: 'Blue' },
  { bg: 'bg-yellow-500', text: 'text-yellow-700', border: 'border-yellow-200', name: 'Yellow' },
  { bg: 'bg-purple-500', text: 'text-purple-700', border: 'border-purple-200', name: 'Purple' },
  { bg: 'bg-cyan-500', text: 'text-cyan-700', border: 'border-cyan-200', name: 'Cyan' },
  { bg: 'bg-orange-500', text: 'text-orange-700', border: 'border-orange-200', name: 'Orange' },
  { bg: 'bg-pink-500', text: 'text-pink-700', border: 'border-pink-200', name: 'Pink' },
];

export default function ResultsDashboard({
  clusteringResult,
  processingResult,
  onReset,
  onExport
}: ResultsDashboardProps) {
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null);
  const [showStatistics, setShowStatistics] = useState(true);

  const downloadResults = () => {
    const results = {
      clustering_result: clusteringResult,
      processing_result: processingResult,
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clustering-results-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadImage = () => {
    if (clusteringResult.clustered_image) {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${clusteringResult.clustered_image}`;
      link.download = `clustered-plant-beds-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex space-x-3">
        <button
          onClick={downloadImage}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Download Image
        </button>

        <button
          onClick={downloadResults}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Download JSON
        </button>

        <button
          onClick={onReset}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Start Over
        </button>
      </div>

      {/* Main Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clustered Image */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Clustered Plant Beds</h3>
          {clusteringResult.clustered_image ? (
            <div className="relative">
              <img
                src={`data:image/png;base64,${clusteringResult.clustered_image}`}
                alt="Clustered Plant Beds"
                className="w-full rounded-lg shadow-md"
              />
              <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                {clusteringResult.statistics.num_clusters} clusters
              </div>
            </div>
          ) : (
            <div className="bg-gray-100 rounded-lg p-8 text-center">
              <p className="text-gray-500">No clustered image available</p>
            </div>
          )}
        </div>

        {/* Statistics Overview */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Overview Statistics</h3>
            <button
              onClick={() => setShowStatistics(!showStatistics)}
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              {showStatistics ? 'Hide' : 'Show'} Details
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-600 font-medium">Total Beds</p>
              <p className="text-2xl font-bold text-blue-700">
                {clusteringResult.statistics.total_beds}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm text-green-600 font-medium">Clustered</p>
              <p className="text-2xl font-bold text-green-700">
                {clusteringResult.statistics.clustered_beds}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <p className="text-sm text-purple-600 font-medium">Clusters</p>
              <p className="text-2xl font-bold text-purple-700">
                {clusteringResult.statistics.num_clusters}
              </p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <p className="text-sm text-orange-600 font-medium">Coverage</p>
              <p className="text-2xl font-bold text-orange-700">
                {clusteringResult.statistics.coverage_percent}%
              </p>
            </div>
          </div>

          {/* Detailed Statistics */}
          {showStatistics && (
            <div className="space-y-4">
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Processing Statistics</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Raw Border Pixels</p>
                    <p className="font-medium">{processingResult.statistics.raw_border_pixels.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Clean Border Pixels</p>
                    <p className="font-medium">{processingResult.statistics.clean_border_pixels.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Final Border Pixels</p>
                    <p className="font-medium">{processingResult.statistics.final_border_pixels.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Areas Detected</p>
                    <p className="font-medium">{processingResult.statistics.total_areas_detected}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Clustering Efficiency</h4>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Coverage</span>
                    <span className="text-sm font-medium">{clusteringResult.statistics.coverage_percent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${clusteringResult.statistics.coverage_percent}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cluster Details */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold mb-4">Cluster Details</h3>

        {clusteringResult.statistics.cluster_details.length > 0 ? (
          <div className="space-y-4">
            {clusteringResult.statistics.cluster_details.map((cluster, index) => {
              const colorScheme = CLUSTER_COLORS[index % CLUSTER_COLORS.length];
              const isSelected = selectedCluster === cluster.cluster_id;

              return (
                <div
                  key={cluster.cluster_id}
                  className={`
                    border-2 rounded-lg p-4 cursor-pointer transition-all
                    ${isSelected
                      ? `${colorScheme.border} bg-opacity-10 ${colorScheme.bg.replace('bg-', 'bg-opacity-10 bg-')}`
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                  onClick={() => setSelectedCluster(isSelected ? null : cluster.cluster_id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded ${colorScheme.bg}`}></div>
                      <h4 className="font-semibold">
                        Cluster {cluster.cluster_id} ({colorScheme.name})
                      </h4>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>{cluster.bed_count} beds</span>
                      <span>{cluster.total_area.toLocaleString()} px</span>
                      <svg
                        className={`w-5 h-5 transition-transform ${isSelected ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Bed Count</p>
                          <p className="font-semibold">{cluster.bed_count}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Total Area</p>
                          <p className="font-semibold">{cluster.total_area.toLocaleString()} px</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Average Area</p>
                          <p className="font-semibold">{cluster.average_area.toLocaleString()} px</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Percentage</p>
                          <p className="font-semibold">
                            {((cluster.bed_count / clusteringResult.statistics.total_beds) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm text-gray-600 mb-2">Bed IDs:</p>
                        <div className="flex flex-wrap gap-1">
                          {cluster.bed_ids.map(bedId => (
                            <span
                              key={bedId}
                              className={`px-2 py-1 text-xs rounded ${colorScheme.bg} text-white`}
                            >
                              {bedId}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No clusters found</p>
          </div>
        )}
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg shadow-lg p-6 border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Analysis Summary</h3>
            <p className="text-gray-600">
              Successfully identified {clusteringResult.statistics.num_clusters} distinct plant types
              covering {clusteringResult.statistics.coverage_percent}% of detected beds
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-600">
              {clusteringResult.statistics.clustered_beds}/{clusteringResult.statistics.total_beds}
            </p>
            <p className="text-sm text-gray-600">beds clustered</p>
          </div>
        </div>
      </div>
    </div>
  );
}
