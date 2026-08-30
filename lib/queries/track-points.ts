import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { TrackPoint } from "@/lib/supabase/types";

export function useTrackPoints(tripId: string) {
  return useQuery({
    queryKey: ["track_points", tripId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("track_points")
        .select("*")
        .eq("trip_id", tripId)
        .order("recorded_at");
      if (error) throw error;
      return data as TrackPoint[];
    },
    enabled: !!tripId,
  });
}

export function useAddTrackPoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      trip_id: string;
      profile_id: string | null;
      lat: number;
      lng: number;
      accuracy: number | null;
    }) => {
      const supabase = createClient();
      const { error } = await supabase.from("track_points").insert(input);
      if (error) throw error;
      return input.trip_id;
    },
    onSuccess: (tripId) => queryClient.invalidateQueries({ queryKey: ["track_points", tripId] }),
  });
}

export function useDeleteTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("track_points").delete().eq("trip_id", tripId);
      if (error) throw error;
      return tripId;
    },
    onSuccess: (tripId) => queryClient.invalidateQueries({ queryKey: ["track_points", tripId] }),
  });
}
