import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { diffTripDays } from "@/lib/dates";
import type { Trip, TripDay } from "@/lib/supabase/types";

export function useTrips() {
  return useQuery({
    queryKey: ["trips"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("trips").select("*").order("start_date");
      if (error) throw error;
      return data as Trip[];
    },
  });
}

export function useTrip(tripId: string) {
  return useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("trips").select("*").eq("id", tripId).single();
      if (error) throw error;
      return data as Trip;
    },
    enabled: !!tripId,
  });
}

export function useTripDays(tripId: string) {
  return useQuery({
    queryKey: ["trip_days", tripId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("trip_days")
        .select("*")
        .eq("trip_id", tripId)
        .order("day_index");
      if (error) throw error;
      return data as TripDay[];
    },
    enabled: !!tripId,
  });
}

/** Inserta/borra filas de trip_days para que coincidan con [start_date, end_date]. */
async function syncTripDays(tripId: string, startDate: string, endDate: string) {
  const supabase = createClient();
  const { data: existing, error } = await supabase
    .from("trip_days")
    .select("*")
    .eq("trip_id", tripId);
  if (error) throw error;

  const { toInsert, toDelete, toUpdate } = diffTripDays(existing as TripDay[], startDate, endDate);

  if (toInsert.length) {
    const { error: insertError } = await supabase
      .from("trip_days")
      .insert(toInsert.map((d) => ({ trip_id: tripId, ...d })));
    if (insertError) throw insertError;
  }
  for (const u of toUpdate) {
    const { error: updateError } = await supabase.from("trip_days").update({ date: u.date }).eq("id", u.id);
    if (updateError) throw updateError;
  }
  if (toDelete.length) {
    const { error: deleteError } = await supabase
      .from("trip_days")
      .delete()
      .in("id", toDelete.map((d) => d.id));
    if (deleteError) throw deleteError;
  }
}

interface CreateTripInput {
  name: string;
  destination?: string;
  start_date: string;
  end_date: string;
  created_by: string | null;
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTripInput) => {
      const supabase = createClient();
      const { data, error } = await supabase.from("trips").insert(input).select().single();
      if (error) throw error;
      await syncTripDays(data.id, input.start_date, input.end_date);
      return data as Trip;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trips"] }),
  });
}

interface UpdateTripInput {
  id: string;
  name?: string;
  destination?: string | null;
  start_date?: string;
  end_date?: string;
  cover_image_path?: string | null;
}

export function useUpdateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: UpdateTripInput) => {
      const supabase = createClient();
      const { data, error } = await supabase.from("trips").update(patch).eq("id", id).select().single();
      if (error) throw error;
      if (patch.start_date || patch.end_date) {
        await syncTripDays(id, data.start_date, data.end_date);
      }
      return data as Trip;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["trip_days", variables.id] });
    },
  });
}

export function useUploadTripCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tripId, file }: { tripId: string; file: File }) => {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${tripId}/cover-${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("trip-covers").upload(path, file, {
        upsert: true,
      });
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("trips").update({ cover_image_path: path }).eq("id", tripId);
      if (error) throw error;
      return path;
    },
    onSuccess: (_path, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
  });
}

export function useDeleteTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("trips").delete().eq("id", tripId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trips"] }),
  });
}
