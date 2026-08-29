import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Place, PlaceCategory } from "@/lib/supabase/types";

export function usePlaces(tripId: string) {
  return useQuery({
    queryKey: ["places", tripId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("places")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at");
      if (error) throw error;
      return data as Place[];
    },
    enabled: !!tripId,
  });
}

interface CreatePlaceInput {
  trip_id: string;
  name: string;
  category: PlaceCategory;
  lat: number;
  lng: number;
  address?: string | null;
  google_place_id?: string | null;
  notes?: string | null;
  created_by: string | null;
}

export function useCreatePlace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePlaceInput) => {
      const supabase = createClient();
      const { data, error } = await supabase.from("places").insert(input).select().single();
      if (error) throw error;
      return data as Place;
    },
    onSuccess: (data) => queryClient.invalidateQueries({ queryKey: ["places", data.trip_id] }),
  });
}

interface UpdatePlaceInput {
  id: string;
  trip_id: string;
  name?: string;
  category?: PlaceCategory;
  address?: string | null;
  notes?: string | null;
}

export function useUpdatePlace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, trip_id, ...patch }: UpdatePlaceInput) => {
      const supabase = createClient();
      const { error } = await supabase.from("places").update(patch).eq("id", id);
      if (error) throw error;
      return { id, trip_id };
    },
    onSuccess: ({ trip_id }) => queryClient.invalidateQueries({ queryKey: ["places", trip_id] }),
  });
}

export function useDeletePlace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; trip_id: string }) => {
      const supabase = createClient();
      const { error } = await supabase.from("places").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, { trip_id }) => {
      queryClient.invalidateQueries({ queryKey: ["places", trip_id] });
      queryClient.invalidateQueries({ queryKey: ["place_day_links", trip_id] });
    },
  });
}
