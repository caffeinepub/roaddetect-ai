import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export interface ObstacleEvent {
    id: string;
    type: string;
    confidenceLevel: number;
    timestamp: Time;
    associatedDetectionId: string;
    image: ExternalBlob;
    position: {
        x: number;
        y: number;
    };
    riskLevel: {
        description: string;
        level: string;
    };
}
export interface VideoProcessingStatusResponse {
}
export type Time = bigint;
export interface EmergencyEvent {
    id: string;
    type: string;
    resolutionStatus: string;
    description: string;
    timestamp: Time;
    associatedDetectionId: string;
    severity: {
        urgency: string;
        level: string;
    };
}
export interface SpecificationReportResponse {
    id: string;
    content: ExternalBlob;
    createdAt: Time;
}
export interface DetectionResult {
    id: string;
    environmentalConditions: {
        roadType: string;
        surfaceType: string;
        lighting: string;
        weather: string;
    };
    metrics: {
        objectDetection: string;
        systemPerformance: {
            cpuUtilization: number;
            gpuUtilization: number;
            memoryUsage: number;
            hardwareType: string;
        };
        detectionQuality: number;
        frameRate: number;
    };
    processingTime: bigint;
    confidenceScore: number;
    processedImage: ExternalBlob;
    timestamp: Time;
    image: ExternalBlob;
}
export interface SpeedLimitDetection {
    id: string;
    frameData: ExternalBlob;
    confidenceLevel: number;
    timestamp: Time;
    detectedSpeedLimit?: bigint;
    associatedDetectionId: string;
}
export interface CameraStatusRequest {
    state: string;
}
export interface VideoUploadResponse {
    taskId: string;
}
export interface VideoUploadRequest {
    videoBlob: ExternalBlob;
}
export interface HardwarePerformanceMetrics {
    optimizationLevel: string;
    processingEfficiency: number;
    cpuUtilization: number;
    gpuUtilization: number;
    memoryUsage: number;
    benchmarkScores: {
        gpuScore: number;
        cpuScore: number;
    };
    hardwareType: string;
}
export interface VideoProcessingStatusRequest {
    taskId: string;
}
export interface CameraStatusResponse {
    message: string;
}
export interface backendInterface {
    getAllDetectionResults(): Promise<Array<DetectionResult>>;
    getAllEmergencyEvents(): Promise<Array<EmergencyEvent>>;
    getAllHardwarePerformanceMetrics(): Promise<Array<HardwarePerformanceMetrics>>;
    getAllObstacleEvents(): Promise<Array<ObstacleEvent>>;
    getAllSpecificationReports(): Promise<Array<SpecificationReportResponse>>;
    getAllSpeedLimitDetections(): Promise<Array<SpeedLimitDetection>>;
    getCombinedAlertHistory(): Promise<{
        detectionResults: Array<DetectionResult>;
        speedLimitDetections: Array<SpeedLimitDetection>;
        emergencyEvents: Array<EmergencyEvent>;
        hardwarePerformanceMetrics: Array<HardwarePerformanceMetrics>;
        obstacleEvents: Array<ObstacleEvent>;
    }>;
    getDetectionResult(id: string): Promise<DetectionResult>;
    getDetectionStatistics(): Promise<{
        totalDetections: bigint;
        totalHighRiskEvents: bigint;
        averageDetectionTime: number;
        highestRiskLevel: string;
        totalSpeedLimitDetections: bigint;
        totalEmergencyEvents: bigint;
        mostCommonObjectType: string;
        totalObstacleEvents: bigint;
        averageConfidenceScore: number;
        averageHardwareEfficiency: number;
        averageSpeedLimitConfidence: number;
        averageProcessingTime: number;
    }>;
    getEmergencyEvent(id: string): Promise<EmergencyEvent>;
    getEnvironmentalAnalysis(): Promise<{
        detectionScoreByCondition: {
            surfaceQuality: string;
            avgScore: number;
            commonRoadType: string;
            lighting: string;
            weather: string;
        };
    }>;
    getFilteredAlertHistory(filter: {
        detectionRange?: number;
        weatherCondition?: string;
        timeRange?: {
            end: Time;
            start: Time;
        };
        severity?: string;
        speedLimitRange?: {
            lower: bigint;
            upper: bigint;
        };
        objectType?: string;
        riskLevel?: string;
    }): Promise<{
        detectionResults: Array<DetectionResult>;
        speedLimitDetections: Array<SpeedLimitDetection>;
        emergencyEvents: Array<EmergencyEvent>;
        obstacleEvents: Array<ObstacleEvent>;
    }>;
    getFilteredEventHistory(filter: {
        detectionRange?: number;
        severity?: string;
        objectType?: string;
        riskLevel?: string;
    }): Promise<{
        emergencyEvents: Array<EmergencyEvent>;
        obstacleEvents: Array<ObstacleEvent>;
    }>;
    getHardwarePerformanceMetrics(id: string): Promise<HardwarePerformanceMetrics>;
    getObstacleEvent(id: string): Promise<ObstacleEvent>;
    getSpecificationReport(id: string): Promise<SpecificationReportResponse>;
    getSpeedLimitDetection(id: string): Promise<SpeedLimitDetection>;
    getVideoProcessingStatus(arg0: VideoProcessingStatusRequest): Promise<VideoProcessingStatusResponse>;
    handleVideoUpload(arg0: VideoUploadRequest): Promise<VideoUploadResponse>;
    storeDetectionResult(id: string, image: ExternalBlob, processedImage: ExternalBlob, confidenceScore: number, processingTime: bigint, timestamp: Time, lighting: string, weather: string, roadType: string, surfaceType: string, frameRate: number, detectionQuality: number, objectDetection: string, hardwareType: string, cpuUtilization: number, gpuUtilization: number, memoryUsage: number): Promise<void>;
    storeEmergencyEvent(id: string, type: string, timestamp: Time, associatedDetectionId: string, description: string, severity: {
        urgency: string;
        level: string;
    }, resolutionStatus: string): Promise<void>;
    storeHardwarePerformanceMetrics(id: string, hardwareType: string, cpuUtilization: number, gpuUtilization: number, memoryUsage: number, cpuScore: number, gpuScore: number, optimizationLevel: string, processingEfficiency: number): Promise<void>;
    storeObstacleEvent(id: string, position: {
        x: number;
        y: number;
    }, type: string, confidenceLevel: number, timestamp: Time, associatedDetectionId: string, image: ExternalBlob, riskLevel: {
        description: string;
        level: string;
    }): Promise<void>;
    storeSpecificationReport(id: string, content: ExternalBlob, createdAt: Time): Promise<void>;
    storeSpeedLimitDetection(id: string, detectedSpeedLimit: bigint | null, confidenceLevel: number, timestamp: Time, associatedDetectionId: string, frameData: ExternalBlob): Promise<void>;
    updateCameraStatus(arg0: CameraStatusRequest): Promise<CameraStatusResponse>;
}
