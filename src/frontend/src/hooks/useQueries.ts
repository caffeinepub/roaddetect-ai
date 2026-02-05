import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { DetectionResult, ObstacleEvent, EmergencyEvent, SpeedLimitDetection } from '@/backend';
import { ExternalBlob } from '@/backend';

export function useGetDetectionHistory() {
  const { actor, isFetching } = useActor();

  return useQuery<DetectionResult[]>({
    queryKey: ['detectionHistory'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllDetectionResults();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useStoreDetection() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      image: ExternalBlob;
      processedImage: ExternalBlob;
      confidenceScore: number;
      processingTime: bigint;
      timestamp: bigint;
      lighting: string;
      weather: string;
      roadType: string;
      surfaceType: string;
      frameRate: number;
      detectionQuality: number;
      objectDetection: string;
      hardwareType: string;
      cpuUtilization: number;
      gpuUtilization: number;
      memoryUsage: number;
    }) => {
      if (!actor) throw new Error('Actor not initialized');
      return actor.storeDetectionResult(
        params.id,
        params.image,
        params.processedImage,
        params.confidenceScore,
        params.processingTime,
        params.timestamp,
        params.lighting,
        params.weather,
        params.roadType,
        params.surfaceType,
        params.frameRate,
        params.detectionQuality,
        params.objectDetection,
        params.hardwareType,
        params.cpuUtilization,
        params.gpuUtilization,
        params.memoryUsage
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detectionHistory'] });
      queryClient.invalidateQueries({ queryKey: ['detectionStatistics'] });
    },
  });
}

export function useStoreObstacleEvent() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      position: { x: number; y: number };
      type: string;
      confidenceLevel: number;
      timestamp: bigint;
      associatedDetectionId: string;
      image: ExternalBlob;
      riskLevel: { level: string; description: string };
    }) => {
      if (!actor) throw new Error('Actor not initialized');
      return actor.storeObstacleEvent(
        params.id,
        params.position,
        params.type,
        params.confidenceLevel,
        params.timestamp,
        params.associatedDetectionId,
        params.image,
        params.riskLevel
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obstacleEvents'] });
      queryClient.invalidateQueries({ queryKey: ['detectionStatistics'] });
    },
  });
}

export function useStoreEmergencyEvent() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      type: string;
      timestamp: bigint;
      associatedDetectionId: string;
      description: string;
      severity: { level: string; urgency: string };
    }) => {
      if (!actor) throw new Error('Actor not initialized');
      return actor.storeEmergencyEvent(
        params.id,
        params.type,
        params.timestamp,
        params.associatedDetectionId,
        params.description,
        params.severity,
        'pending'
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergencyEvents'] });
      queryClient.invalidateQueries({ queryKey: ['detectionStatistics'] });
    },
  });
}

export function useStoreSpeedLimitDetection() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      detectedSpeedLimit: bigint | null;
      confidenceLevel: number;
      timestamp: bigint;
      associatedDetectionId: string;
      frameData: ExternalBlob;
    }) => {
      if (!actor) throw new Error('Actor not initialized');
      return actor.storeSpeedLimitDetection(
        params.id,
        params.detectedSpeedLimit,
        params.confidenceLevel,
        params.timestamp,
        params.associatedDetectionId,
        params.frameData
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speedLimitDetections'] });
      queryClient.invalidateQueries({ queryKey: ['detectionStatistics'] });
    },
  });
}

export function useGetAllObstacleEvents() {
  const { actor, isFetching } = useActor();

  return useQuery<ObstacleEvent[]>({
    queryKey: ['obstacleEvents'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllObstacleEvents();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetAllEmergencyEvents() {
  const { actor, isFetching } = useActor();

  return useQuery<EmergencyEvent[]>({
    queryKey: ['emergencyEvents'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllEmergencyEvents();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetAllSpeedLimitDetections() {
  const { actor, isFetching } = useActor();

  return useQuery<SpeedLimitDetection[]>({
    queryKey: ['speedLimitDetections'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllSpeedLimitDetections();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetDetectionStatistics() {
  const { actor, isFetching } = useActor();

  return useQuery({
    queryKey: ['detectionStatistics'],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getDetectionStatistics();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 30000, // Refetch every 30 seconds for live updates
  });
}
