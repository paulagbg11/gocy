import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Category, TripHiddenCategory } from "@/lib/supabase/types";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data as Category[];
    },
  });
}

export function useCategoriesById() {
  const { data: categories = [] } = useCategories();
  return useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
}

export function useTripHiddenCategories(tripId: string) {
  return useQuery({
    queryKey: ["trip_hidden_categories", tripId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("trip_hidden_categories")
        .select("*")
        .eq("trip_id", tripId);
      if (error) throw error;
      return data as TripHiddenCategory[];
    },
    enabled: !!tripId,
  });
}

/** Categorías visibles para este viaje (todas menos las ocultadas), en orden. */
export function useVisibleCategories(tripId: string) {
  const { data: categories = [] } = useCategories();
  const { data: hidden = [] } = useTripHiddenCategories(tripId);
  return useMemo(() => {
    const hiddenIds = new Set(hidden.map((h) => h.category_id));
    return categories.filter((c) => !hiddenIds.has(c.id));
  }, [categories, hidden]);
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; emoji: string; color?: string }) => {
      const supabase = createClient();
      const { data: existing } = await supabase
        .from("categories")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1);
      const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;
      const { data, error } = await supabase
        .from("categories")
        .insert({ ...input, sort_order: nextOrder })
        .select()
        .single();
      if (error) throw error;
      return data as Category;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string;
      name?: string;
      emoji?: string;
      color?: string;
    }) => {
      const supabase = createClient();
      const { error } = await supabase.from("categories").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useSetCategoryHidden() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tripId,
      categoryId,
      hidden,
    }: {
      tripId: string;
      categoryId: string;
      hidden: boolean;
    }) => {
      const supabase = createClient();
      if (hidden) {
        const { error } = await supabase
          .from("trip_hidden_categories")
          .insert({ trip_id: tripId, category_id: categoryId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("trip_hidden_categories")
          .delete()
          .eq("trip_id", tripId)
          .eq("category_id", categoryId);
        if (error) throw error;
      }
    },
    onSuccess: (_data, { tripId }) =>
      queryClient.invalidateQueries({ queryKey: ["trip_hidden_categories", tripId] }),
  });
}
