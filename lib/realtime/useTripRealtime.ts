"use client";

import { useEffect } from "react";
import { useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface Identified {
  id: string;
}

// El cliente de Supabase no está tipado con el esquema generado (ver
// lib/supabase/client.ts), así que el payload de Realtime llega como
// Record<string, any>; lo tratamos como Identified a mano aquí.
function patchListCache<T extends Identified>(
  queryClient: QueryClient,
  key: QueryKey,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
) {
  const newRow = payload.new as T;
  const oldRow = payload.old as Partial<Identified>;
  queryClient.setQueryData<T[]>(key, (old = []) => {
    if (payload.eventType === "INSERT") {
      if (old.some((row) => row.id === newRow.id)) return old;
      return [...old, newRow];
    }
    if (payload.eventType === "UPDATE") {
      return old.map((row) => (row.id === newRow.id ? newRow : row));
    }
    if (payload.eventType === "DELETE") {
      return old.filter((row) => row.id !== oldRow.id);
    }
    return old;
  });
}

/**
 * Sincronización "casi en vivo" entre los dos móviles: un canal Realtime por
 * viaje que parchea la caché de React Query directamente (sin refetch). El
 * listener de focus/visibilitychange es el que de verdad garantiza "unos
 * segundos" tras desbloquear el móvil, porque iOS/Android cortan el
 * WebSocket en segundo plano — ver "Riesgos" en el plan.
 */
export function useTripRealtime(tripId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tripId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`trip:${tripId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "places", filter: `trip_id=eq.${tripId}` },
        (payload) => patchListCache(queryClient, ["places", tripId], payload),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "place_day_links", filter: `trip_id=eq.${tripId}` },
        (payload) => patchListCache(queryClient, ["place_day_links", tripId], payload),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `trip_id=eq.${tripId}` },
        (payload) => patchListCache(queryClient, ["documents", tripId], payload),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_days", filter: `trip_id=eq.${tripId}` },
        (payload) => patchListCache(queryClient, ["trip_days", tripId], payload),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_hidden_categories", filter: `trip_id=eq.${tripId}` },
        (payload) => patchListCache(queryClient, ["trip_hidden_categories", tripId], payload),
      )
      // categories es global (sin trip_id), así que aquí solo invalidamos en
      // vez de parchear a mano: patchListCache necesita trip_id=eq. en el
      // filtro y no aplica a una tabla global.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories" },
        () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
      )
      .subscribe();

    const refetchOnResume = () => {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries({ queryKey: ["places", tripId] });
        queryClient.invalidateQueries({ queryKey: ["place_day_links", tripId] });
        queryClient.invalidateQueries({ queryKey: ["documents", tripId] });
        queryClient.invalidateQueries({ queryKey: ["trip_days", tripId] });
        queryClient.invalidateQueries({ queryKey: ["trip_hidden_categories", tripId] });
        queryClient.invalidateQueries({ queryKey: ["categories"] });
      }
    };
    document.addEventListener("visibilitychange", refetchOnResume);
    window.addEventListener("focus", refetchOnResume);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", refetchOnResume);
      window.removeEventListener("focus", refetchOnResume);
    };
  }, [tripId, queryClient]);
}
