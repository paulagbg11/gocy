import type { TripDay, TripPhoto } from "@/lib/supabase/types";

/** "2026-10-27" de hoy en la hora del móvil, como las fechas de trip_days. */
export function todayLocal(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Días a los que se pueden añadir fotos: hoy y los que ya han pasado, nunca
 * uno que todavía no ha llegado. Con el viaje acabado, todos; antes de
 * empezar, ninguno (y la cámara no sale).
 */
export function photoDays(days: TripDay[], today = todayLocal()): TripDay[] {
  return days.filter((d) => d.date <= today).sort((a, b) => a.day_index - b.day_index);
}

/** Orden del carrete: por cuándo se hizo, y si no se sabe, por cuándo se subió. */
export const photoTime = (p: TripPhoto) => Date.parse(p.taken_at ?? p.created_at);
