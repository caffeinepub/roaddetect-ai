import type { AccidentRecord } from "@/backend";
import { useQuery } from "@tanstack/react-query";
import { useActor } from "./useActor";

export function useGetAllAccidentRecords() {
  const { actor, isFetching } = useActor();

  return useQuery<AccidentRecord[]>({
    queryKey: ["accidentRecords"],
    queryFn: async () => {
      if (!actor) return [];
      try {
        return await actor.getAllAccidentRecords();
      } catch (error) {
        console.error("Failed to fetch accident records:", error);
        return [];
      }
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetAccidentRecord(id: string) {
  const { actor, isFetching } = useActor();

  return useQuery<AccidentRecord | null>({
    queryKey: ["accidentRecord", id],
    queryFn: async () => {
      if (!actor || !id) return null;
      try {
        return await actor.getAccidentRecord(id);
      } catch (error) {
        console.error("Failed to fetch accident record:", error);
        return null;
      }
    },
    enabled: !!actor && !isFetching && !!id,
  });
}
