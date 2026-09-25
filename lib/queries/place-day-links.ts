import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { PlaceDayLink } from "@/lib/supabase/types";

export function usePlaceDayLinks(tripId: string) {
  return useQuery({
    queryKey: ["place_day_links", tripId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("place_day_links")
        .select("*")
        .eq("trip_id", tripId);
      if (error) throw error;
      return data as PlaceDayLink[];
    },
    enabled: !!tripId,
  });
}

/** Punto medio fraccional para insertar entre dos vecinos sin renumerar el resto. */
export function nextOrderInDay(existing: PlaceDayLink[], dayId: string): number {
  const inDay = existing.filter((l) => l.day_id === dayId).sort((a, b) => (a.order_in_day ?? 0) - (b.order_in_day ?? 0));
  if (inDay.length === 0) return 1;
  return (inDay[inDay.length - 1].order_in_day ?? inDay.length) + 1;
}

interface AssignInput {
  trip_id: string;
  place_id: string;
  day_id: string;
  order_in_day: number;
  scheduled_at?: string | null;
}

export function useAssignPlaceToDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AssignInput) => {
      const supabase = createClient();
      const { data, error } = await supabase.from("place_day_links").insert(input).select().single();
      if (error) throw error;
      return data as PlaceDayLink;
    },
    onSuccess: (data) => queryClient.invalidateQueries({ queryKey: ["place_day_links", data.trip_id] }),
  });
}

export function useUnassignPlaceFromDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; trip_id: string }) => {
      const supabase = createClient();
      const { error } = await supabase.from("place_day_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, { trip_id }) =>
      queryClient.invalidateQueries({ queryKey: ["place_day_links", trip_id] }),
  });
}

export function useUpdatePlaceDayLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      trip_id,
      ...patch
    }: {
      id: string;
      trip_id: string;
      order_in_day?: number;
      scheduled_at?: string | null;
    }) => {
      const supabase = createClient();
      const { error } = await supabase.from("place_day_links").update(patch).eq("id", id);
      if (error) throw error;
      return trip_id;
    },
    onSuccess: (trip_id) => queryClient.invalidateQueries({ queryKey: ["place_day_links", trip_id] }),
  });
}

export interface DayPlanPatch {
  id: string;
  order_in_day?: number;
  scheduled_at?: string | null;
}

/**
 * Guarda de una vez los cambios de orden y hora de un día (mover una parada
 * renumera las demás). Se pintan al momento en la caché y luego se escriben:
 * esperando a Supabase, la fila "saltaba" medio segundo después de pulsar.
 */
export function useSaveDayPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ patches }: { trip_id: string; patches: DayPlanPatch[] }) => {
      const supabase = createClient();
      const results = await Promise.all(
        patches.map(({ id, ...patch }) => supabase.from("place_day_links").update(patch).eq("id", id)),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onMutate: ({ trip_id, patches }) => {
      const byId = new Map(patches.map((p) => [p.id, p]));
      queryClient.setQueryData<PlaceDayLink[]>(["place_day_links", trip_id], (links) =>
        links?.map((link) => {
          const patch = byId.get(link.id);
          return patch ? { ...link, ...patch } : link;
        }),
      );
    },
    onSettled: (_data, _error, { trip_id }) =>
      queryClient.invalidateQueries({ queryKey: ["place_day_links", trip_id] }),
  });
}
