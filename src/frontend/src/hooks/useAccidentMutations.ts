import type { DetectionMethod, ExternalBlob, Location } from "@/backend";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useActor } from "./useActor";

export function useAddAccidentRecord() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      method: DetectionMethod;
      location: Location;
      timestamp: bigint;
      images: ExternalBlob[];
      description: string;
      analysisResults?: string | null;
    }) => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.addAccidentRecord(
        params.id,
        params.method,
        params.location,
        params.timestamp,
        params.images,
        params.description,
        params.analysisResults || null,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accidentRecords"] });
      toast.success("Accident report submitted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit accident report: ${error.message}`);
    },
  });
}
