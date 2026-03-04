import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { ObstacleEvent, Classification, PotholeDetails, PotholeType } from '@/backend';
import { ExternalBlob } from '@/backend';

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
      classification: Classification;
      potholeDetails?: PotholeDetails | null;
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
        params.riskLevel,
        params.classification,
        params.potholeDetails || null
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obstacleEvents'] });
      queryClient.invalidateQueries({ queryKey: ['potholeEvents'] });
    },
  });
}

export function useStorePotholeEvent() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      position: { x: number; y: number };
      confidenceLevel: number;
      timestamp: bigint;
      associatedDetectionId: string;
      image: ExternalBlob;
      riskLevel: { level: string; description: string };
      potholeDetails: {
        size: number;
        depth: number;
        severity: string;
        potholeType: PotholeType;
        location: {
          coordinates: [number, number];
          accuracy: number;
        };
        image_url: string;
        distance_from_vehicle: number;
        createdAt: bigint;
      };
    }) => {
      if (!actor) throw new Error('Actor not initialized');
      return actor.addPotholeSpecificEvent(
        params.id,
        params.position,
        params.confidenceLevel,
        params.timestamp,
        params.associatedDetectionId,
        params.image,
        params.riskLevel,
        params.potholeDetails
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obstacleEvents'] });
      queryClient.invalidateQueries({ queryKey: ['potholeEvents'] });
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

export function useGetAllPotholeEvents() {
  const { actor, isFetching } = useActor();

  return useQuery<ObstacleEvent[]>({
    queryKey: ['potholeEvents'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllPotholeEvents();
    },
    enabled: !!actor && !isFetching,
  });
}
