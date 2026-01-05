"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { Stage, Layer, Circle, Line } from 'react-konva';
import { Point } from '../types/geometry/Point';
import { Polygon } from '../types/geometry/Polygon';

// Updated interface to match the new props
interface ClusteringCanvasProps {
  enhancementSelection: {
    method: string;
    plot_data: number[][];
    xlabel: string;
    ylabel: string;
    original_colors: number[][];
  };
  onClustering: (clustersData: Record<string, number[]>) => void;
  onBack: () => void;
}

const CLUSTER_COLORS = [
  '#FF3232', // Red
  '#32FF32', // Green
  '#3232FF', // Blue
  '#FFFF32', // Yellow
  '#FF32FF', // Magenta
  '#32FFFF', // Cyan
  '#FF9632', // Orange
  '#9632FF', // Purple
];

export default function ClusteringCanvas({ 
  enhancementSelection, 
  onClustering, 
  onBack 
}: ClusteringCanvasProps) {
  const [currentPolygon, setCurrentPolygon] = useState<Point[]>([]);
  const [completedPolygons, setCompletedPolygons] = useState<Polygon[]>([]);
  const [currentCluster, setCurrentCluster] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasSize] = useState({ width: 800, height: 600 });
  const [plotData, setPlotData] = useState<{ x: number[], y: number[], colors: string[] } | null>(null);
  const stageRef = useRef<any>(null);

  // Process the enhancement selection data
  useEffect(() => {
    if (!enhancementSelection) return;

    const { plot_data, original_colors } = enhancementSelection;
    
    // Extract X and Y coordinates from plot_data
    const xCoords = plot_data.map(point => point[1]); // Assuming [Red, Green, Blue] or similar
    const yCoords = plot_data.map(point => point[0]); // First dimension for Y-axis
    
    // Convert RGB colors to hex strings
    const hexColors = original_colors.map(color => 
      `#${Math.round(color[0]).toString(16).padStart(2, '0')}${Math.round(color[1]).toString(16).padStart(2, '0')}${Math.round(color[2]).toString(16).padStart(2, '0')}`
    );

    setPlotData({ x: xCoords, y: yCoords, colors: hexColors });
  }, [enhancementSelection]);

  // Convert data coordinates to canvas coordinates
  const dataToCanvas = useCallback((dataX: number, dataY: number): [number, number] => {
    if (!plotData) return [0, 0];

    const padding = 50;
    const plotWidth = canvasSize.width - 2 * padding;
    const plotHeight = canvasSize.height - 2 * padding;

    const xMin = Math.min(...plotData.x);
    const xMax = Math.max(...plotData.x);
    const yMin = Math.min(...plotData.y);
    const yMax = Math.max(...plotData.y);

    const canvasX = padding + ((dataX - xMin) / (xMax - xMin)) * plotWidth;
    const canvasY = canvasSize.height - padding - ((dataY - yMin) / (yMax - yMin)) * plotHeight;

    return [canvasX, canvasY];
  }, [plotData, canvasSize]);

  // Convert canvas coordinates to data coordinates
  const canvasToData = useCallback((canvasX: number, canvasY: number): [number, number] => {
    if (!plotData) return [0, 0];

    const padding = 50;
    const plotWidth = canvasSize.width - 2 * padding;
    const plotHeight = canvasSize.height - 2 * padding;

    const xMin = Math.min(...plotData.x);
    const xMax = Math.max(...plotData.x);
    const yMin = Math.min(...plotData.y);
    const yMax = Math.max(...plotData.y);

    const dataX = xMin + ((canvasX - padding) / plotWidth) * (xMax - xMin);
    const dataY = yMin + ((canvasSize.height - padding - canvasY) / plotHeight) * (yMax - yMin);

    return [dataX, dataY];
  }, [plotData, canvasSize]);

  const handleStageClick = useCallback((e: any) => {
    if (!isDrawing) return;

    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    
    const [dataX, dataY] = canvasToData(pointer.x, pointer.y);
    setCurrentPolygon(prev => [...prev, { x: dataX, y: dataY }]);
  }, [isDrawing, canvasToData]);

  const startDrawing = () => {
    setIsDrawing(true);
    setCurrentPolygon([]);
  };

  const finishPolygon = () => {
    if (currentPolygon.length < 3) {
      alert('Need at least 3 points to create a polygon!');
      return;
    }

    const newPolygon: Polygon = {
      id: `polygon_${Date.now()}`,
      points: currentPolygon,
      cluster_id: currentCluster,
      color: CLUSTER_COLORS[currentCluster % CLUSTER_COLORS.length]
    };

    setCompletedPolygons(prev => [...prev, newPolygon]);
    setCurrentPolygon([]);
    setIsDrawing(false);
  };

  const clearCurrentPolygon = () => {
    setCurrentPolygon([]);
    setIsDrawing(false);
  };

  const clearAllPolygons = () => {
    setCompletedPolygons([]);
    setCurrentPolygon([]);
    setIsDrawing(false);
  };

  const nextCluster = () => {
    setCurrentCluster(prev => (prev + 1) % CLUSTER_COLORS.length);
    setIsDrawing(false);
    setCurrentPolygon([]);
  };

  // Point in polygon detection - same algorithm as your prototype
  const pointInPolygon = (point: Point, polygon: Point[]): boolean => {
    const x = point.x;
    const y = point.y;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  };

  const processClustering = () => {
    if (!plotData) return;

    const clustersData: Record<string, number[]> = {};

    // Initialize cluster arrays
    completedPolygons.forEach(polygon => {
      const clusterId = polygon.cluster_id.toString();
      if (!clustersData[clusterId]) {
        clustersData[clusterId] = [];
      }
    });

    // Check each bed point against each polygon
    plotData.x.forEach((x, bedIndex) => {
      const y = plotData.y[bedIndex];
      const bedPoint = { x, y };

      completedPolygons.forEach(polygon => {
        if (pointInPolygon(bedPoint, polygon.points)) {
          const clusterId = polygon.cluster_id.toString();
          if (!clustersData[clusterId].includes(bedIndex)) {
            clustersData[clusterId].push(bedIndex);
          }
        }
      });
    });

    onClustering(clustersData);
  };

  const renderDataPoints = () => {
    if (!plotData) return null;

    return plotData.x.map((x, index) => {
      const y = plotData.y[index];
      const [canvasX, canvasY] = dataToCanvas(x, y);
      
      return (
        <Circle
          key={`point_${index}`}
          x={canvasX}
          y={canvasY}
          radius={6}
          fill={plotData.colors[index]}
          stroke="black"
          strokeWidth={1}
        />
      );
    });
  };

  const renderPolygon = (polygon: Polygon, index: number) => {
    const screenPoints = polygon.points.flatMap(point => {
      const [x, y] = dataToCanvas(point.x, point.y);
      return [x, y];
    });

    return (
      <Line
        key={`polygon_${index}`}
        points={screenPoints}
        stroke={polygon.color}
        strokeWidth={3}
        closed={true}
        fill={`${polygon.color}33`} // Semi-transparent fill
      />
    );
  };

  const renderCurrentPolygon = () => {
    if (currentPolygon.length === 0) return null;

    const screenPoints = currentPolygon.flatMap(point => {
      const [x, y] = dataToCanvas(point.x, point.y);
      return [x, y];
    });

    return (
      <>
        <Line
          points={screenPoints}
          stroke={CLUSTER_COLORS[currentCluster % CLUSTER_COLORS.length]}
          strokeWidth={3}
          dash={[5, 5]}
        />
        {currentPolygon.map((point, index) => {
          const [x, y] = dataToCanvas(point.x, point.y);
          return (
            <Circle
              key={`current_point_${index}`}
              x={x}
              y={y}
              radius={8}
              fill={CLUSTER_COLORS[currentCluster % CLUSTER_COLORS.length]}
              stroke="white"
              strokeWidth={2}
            />
          );
        })}
      </>
    );
  };

  const getMethodTitle = () => {
    switch (enhancementSelection.method) {
      case 'enhanced_saturation': return 'Enhanced Saturation';
      case 'contrast_stretched': return 'Contrast Stretched';
      case 'color_ratios': return 'Color Ratios';
      case 'pca_features': return 'PCA Features';
      default: return 'Original Colors';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Canvas */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Color-Based Clustering</h2>
            <div className="bg-blue-100 px-3 py-1 rounded-lg">
              <span className="text-blue-800 font-medium">{getMethodTitle()}</span>
            </div>
          </div>
          
          <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
            <Stage
              width={canvasSize.width}
              height={canvasSize.height}
              onClick={handleStageClick}
              ref={stageRef}
            >
              <Layer>
                {/* Render data points */}
                {renderDataPoints()}
                
                {/* Render completed polygons */}
                {completedPolygons.map((polygon, index) => renderPolygon(polygon, index))}
                
                {/* Render current polygon being drawn */}
                {renderCurrentPolygon()}
              </Layer>
            </Stage>
          </div>
          
          {/* Axis labels */}
          <div className="flex justify-between items-center mt-2 px-12">
            <span className="text-sm text-gray-600">{enhancementSelection.xlabel}</span>
            <span className="text-sm text-gray-600 transform -rotate-90 origin-center">{enhancementSelection.ylabel}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="w-full lg:w-80 space-y-6">
          {/* Method Info */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Method: {getMethodTitle()}</h3>
            <p className="text-sm text-blue-800">
              Draw polygons around similar colored points to group plant beds by color characteristics.
            </p>
          </div>

          {/* Current Cluster */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Current Cluster: {currentCluster + 1}</h3>
            <div className="flex items-center space-x-2">
              <div 
                className="w-6 h-6 rounded border-2 border-gray-300"
                style={{ backgroundColor: CLUSTER_COLORS[currentCluster % CLUSTER_COLORS.length] }}
              ></div>
              <span className="text-sm text-gray-600">
                {CLUSTER_COLORS[currentCluster % CLUSTER_COLORS.length]}
              </span>
            </div>
          </div>

          {/* Drawing Controls */}
          <div className="space-y-3">
            <button
              onClick={startDrawing}
              disabled={isDrawing}
              className={`w-full px-4 py-2 rounded-lg font-medium ${
                isDrawing 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isDrawing ? 'Drawing...' : 'Start Drawing Polygon'}
            </button>

            <button
              onClick={finishPolygon}
              disabled={!isDrawing || currentPolygon.length < 3}
              className={`w-full px-4 py-2 rounded-lg font-medium ${
                !isDrawing || currentPolygon.length < 3
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              Finish Polygon ({currentPolygon.length} points)
            </button>

            <button
              onClick={clearCurrentPolygon}
              disabled={!isDrawing}
              className={`w-full px-4 py-2 rounded-lg font-medium ${
                !isDrawing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-yellow-600 text-white hover:bg-yellow-700'
              }`}
            >
              Clear Current Polygon
            </button>

            <button
              onClick={nextCluster}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
            >
              Next Cluster
            </button>

            <button
              onClick={clearAllPolygons}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
            >
              Clear All Polygons
            </button>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Instructions:</h4>
            <ol className="text-sm text-blue-800 space-y-1">
              <li>1. Click "Start Drawing Polygon"</li>
              <li>2. Click points around similar colored dots</li>
              <li>3. Click "Finish Polygon" when done</li>
              <li>4. Use "Next Cluster" for different groups</li>
              <li>5. Click "Process Clustering" when finished</li>
            </ol>
          </div>

          {/* Statistics */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Statistics</h4>
            <div className="text-sm space-y-1">
              <p>Total beds: {plotData ? plotData.x.length : 0}</p>
              <p>Polygons drawn: {completedPolygons.length}</p>
              <p>Current polygon: {currentPolygon.length} points</p>
              <p>Method: {getMethodTitle()}</p>
            </div>
          </div>

          {/* Cluster Summary */}
          {completedPolygons.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Clusters</h4>
              <div className="text-sm space-y-1">
                {Array.from(new Set(completedPolygons.map(p => p.cluster_id))).map(clusterId => (
                  <div key={clusterId} className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length] }}
                    ></div>
                    <span>Cluster {clusterId + 1}: {completedPolygons.filter(p => p.cluster_id === clusterId).length} polygons</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={processClustering}
              disabled={completedPolygons.length === 0}
              className={`w-full px-4 py-2 rounded-lg font-medium ${
                completedPolygons.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              Process Clustering
            </button>

            <button
              onClick={onBack}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
            >
              ← Back to Enhancement Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}