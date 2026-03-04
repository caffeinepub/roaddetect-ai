/**
 * Shared TypeScript types for road detection results
 * Used across processing pipeline and UI components
 */

export interface EnvironmentalConditions {
  lighting: string;
  weather: string;
  // New environment perception signals
  visibility?: number; // 0-1 score
  fogLikelihood?: number; // 0-1 score
  precipitationLikelihood?: number; // 0-1 score
  glareLikelihood?: number; // 0-1 score
  atmosphericClarity?: number; // 0-1 score
}

export interface DetectionMetrics {
  frameRate: number;
  detectionQuality: number;
  objectDetection: string;
  mlAdaptations?: string[];
  performanceStatus?: string;
  hardwareAcceleration?: string;
  cpuUtilization?: string;
  processingMode?: string;
  realTimeFPS?: number;
  potholeCount?: number;
  closestPotholeDistance?: number;
}

export interface PotholeDetection {
  id: string;
  position: { x: number; y: number };
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  distance: number; // estimated distance in meters
  severity: "Low" | "Moderate" | "High";
  size: number; // estimated size in square meters
  depth: number; // estimated depth in cm
  confidenceLevel: number;
  potholeType:
    | "surface_cracks"
    | "rough_size"
    | "deep"
    | "edge"
    | "pavement"
    | "complex"
    | "unknown";
}

export interface RoadSurfaceFeatures {
  segmentation: {
    coverage: number;
    visualizationUrl: string | null;
  };
  drivableArea: {
    coverage: number;
    visualizationUrl: string | null;
  };
  roadEdges: {
    edgeStrength: number;
    edgeCount: number;
    visualizationUrl: string | null;
  };
  damage: {
    potholeScore: number;
    crackScore: number;
    damageLocations: Array<{
      x: number;
      y: number;
      type: string;
      severity: number;
    }>;
    visualizationUrl: string | null;
  };
  wetSurface: {
    wetnessScore: number;
    slipperinessScore: number;
    visualizationUrl: string | null;
  };
  potholes?: {
    detections: PotholeDetection[];
    visualizationUrl: string | null;
  };
}

export interface ObstacleInfo {
  id: string;
  position: { x: number; y: number };
  type: string;
  confidenceLevel: number;
  riskLevel: {
    level: "High" | "Moderate" | "Low";
    description: string;
  };
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  motion?: "Static" | "Moving";
}

export interface EmergencyCondition {
  id: string;
  type: string;
  description: string;
  severity: {
    level: "Critical" | "Warning" | "Info";
    urgency: string;
  };
}

export interface ObstacleDetectionResult {
  obstacles: ObstacleInfo[];
  emergencyConditions: EmergencyCondition[];
  visualizationUrl: string;
  visualizationData: Uint8Array;
}

export interface DetectionResult {
  id: string;
  originalImageUrl: string;
  processedImageUrl: string;
  originalImageData: Uint8Array;
  processedImageData: Uint8Array;
  confidenceScore: number;
  processingTime: number;
  environmentalConditions: EnvironmentalConditions;
  roadType: string;
  metrics: DetectionMetrics;
  obstacleDetection?: ObstacleDetectionResult;
  roadSurfaceFeatures?: RoadSurfaceFeatures;
}
