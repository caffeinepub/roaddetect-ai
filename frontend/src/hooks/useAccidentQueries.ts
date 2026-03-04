import { useQuery } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { AccidentRecord } from '@/backend';

export function useGetAllAccidentRecords() {
  const { actor, isFetching } = useActor();

  return useQuery<AccidentRecord[]>({
    queryKey: ['accidentRecords'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllAccidentRecords();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetAccidentRecord(id: string) {
  const { actor, isFetching } = useActor();

  return useQuery<AccidentRecord | null>({
    queryKey: ['accidentRecord', id],
    queryFn: async () => {
      if (!actor || !id) return null;
      try {
        return await actor.getAccidentRecord(id);
      } catch (error) {
        console.error('Failed to fetch accident record:', error);
        return null;
      }
    },
    enabled: !!actor && !isFetching && !!id,
  });
}
