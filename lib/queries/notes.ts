import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Note, NoteItem } from "@/lib/supabase/types";

export function useNotes(tripId: string) {
  return useQuery({
    queryKey: ["notes", tripId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
    enabled: !!tripId,
  });
}

/**
 * Las casillas de todo el viaje en una sola consulta, agrupadas después por
 * nota. Con una consulta por nota, Realtime tendría que saber a qué clave de
 * caché pertenece cada fila que cambia, y el filtro por viaje que ya usa el
 * resto de la app no daría para eso.
 */
export function useNoteItems(tripId: string) {
  return useQuery({
    queryKey: ["note_items", tripId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("note_items")
        .select("*")
        .eq("trip_id", tripId)
        .order("sort_order");
      if (error) throw error;
      return data as NoteItem[];
    },
    enabled: !!tripId,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      trip_id: string;
      title: string;
      body?: string | null;
      url?: string | null;
      color: string;
      created_by: string | null;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase.from("notes").insert(input).select().single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: (note) => queryClient.invalidateQueries({ queryKey: ["notes", note.trip_id] }),
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      trip_id,
      ...patch
    }: { id: string; trip_id: string } & Partial<Omit<Note, "id" | "trip_id">>) => {
      const supabase = createClient();
      const { error } = await supabase.from("notes").update(patch).eq("id", id);
      if (error) throw error;
      return { trip_id };
    },
    onSuccess: ({ trip_id }) => queryClient.invalidateQueries({ queryKey: ["notes", trip_id] }),
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; trip_id: string }) => {
      const supabase = createClient();
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, { trip_id }) => {
      queryClient.invalidateQueries({ queryKey: ["notes", trip_id] });
      queryClient.invalidateQueries({ queryKey: ["note_items", trip_id] });
    },
  });
}

export function useAddNoteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      note_id: string;
      trip_id: string;
      text: string;
      sort_order: number;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase.from("note_items").insert(input).select().single();
      if (error) throw error;
      return data as NoteItem;
    },
    onSuccess: (item) => queryClient.invalidateQueries({ queryKey: ["note_items", item.trip_id] }),
  });
}

/**
 * Marcar y desmarcar se actualiza en local antes de que responda el servidor:
 * es el gesto que más se repite y con el viaje en marcha la conexión puede ser
 * mala. Si falla, se revierte.
 */
export function useToggleNoteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; trip_id: string; done: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase.from("note_items").update({ done }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, trip_id, done }) => {
      const key = ["note_items", trip_id];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NoteItem[]>(key);
      queryClient.setQueryData<NoteItem[]>(key, (old = []) =>
        old.map((item) => (item.id === id ? { ...item, done } : item)),
      );
      return { previous, key };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
    },
  });
}

export function useUpdateNoteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, text }: { id: string; trip_id: string; text: string }) => {
      const supabase = createClient();
      const { error } = await supabase.from("note_items").update({ text }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, { trip_id }) =>
      queryClient.invalidateQueries({ queryKey: ["note_items", trip_id] }),
  });
}

export function useDeleteNoteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; trip_id: string }) => {
      const supabase = createClient();
      const { error } = await supabase.from("note_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, { trip_id }) =>
      queryClient.invalidateQueries({ queryKey: ["note_items", trip_id] }),
  });
}
