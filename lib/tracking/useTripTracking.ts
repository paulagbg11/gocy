"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAddTrackPoint } from "@/lib/queries/track-points";
import { useProfile } from "@/components/profile/ProfileProvider";
import { distanceMeters } from "@/lib/geo";
import type { Trip } from "@/lib/supabase/types";

const SAMPLE_INTERVAL_MS = 90_000;
const MIN_SECONDS_BETWEEN_POINTS = 60;
const MIN_METERS_BETWEEN_POINTS = 30;
const MAX_ACCURACY_M = 100;

const storageKey = (tripId: string) => `gocy:tracking:${tripId}`;

/** ¿Hoy cae dentro de las fechas del viaje? (comparación por fecha local) */
export function isTripActive(trip: Trip | undefined): boolean {
  if (!trip) return false;
  const today = new Date();
  const local = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;
  return trip.start_date <= local && local <= trip.end_date;
}

/** Preferencia por dispositivo: el permiso de ubicación también lo es. */
export function useTrackingPreference(tripId: string) {
  const [enabled, setEnabled] = useState(() =>
    typeof window === "undefined" ? true : localStorage.getItem(storageKey(tripId)) !== "off",
  );

  useEffect(() => {
    // Solo hace falta si se cambia de viaje sin desmontar el layout.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(localStorage.getItem(storageKey(tripId)) !== "off");
  }, [tripId]);

  const setTrackingEnabled = useCallback(
    (value: boolean) => {
      localStorage.setItem(storageKey(tripId), value ? "on" : "off");
      setEnabled(value);
    },
    [tripId],
  );

  return { enabled, setTrackingEnabled };
}

/**
 * Guarda "migas de pan" mientras la app está abierta durante los días del
 * viaje. No hay forma de hacerlo en segundo plano en una PWA (ver el plan),
 * así que se muestrea al entrar, al volver a primer plano y cada 90 s.
 */
export function useTripTracking({
  tripId,
  active,
}: {
  tripId: string;
  active: boolean;
}) {
  const addPoint = useAddTrackPoint();
  const { activeProfile } = useProfile();
  const lastRef = useRef<{ lat: number; lng: number; at: number } | null>(null);

  // Refs para que el intervalo no se reinicie en cada render. Se actualizan en
  // un efecto, no durante el render (mutar una ref al renderizar rompe las
  // garantías de React y lo marca el linter).
  const addPointRef = useRef(addPoint);
  const profileIdRef = useRef<string | null>(activeProfile?.id ?? null);

  useEffect(() => {
    addPointRef.current = addPoint;
  }, [addPoint]);

  useEffect(() => {
    profileIdRef.current = activeProfile?.id ?? null;
  }, [activeProfile]);

  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("geolocation" in navigator)) return;

    let cancelled = false;

    const sample = () => {
      if (document.visibilityState !== "visible") return;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const { latitude, longitude, accuracy } = pos.coords;

          if (accuracy != null && accuracy > MAX_ACCURACY_M) return;

          const now = Date.now();
          const last = lastRef.current;
          if (last) {
            if ((now - last.at) / 1000 < MIN_SECONDS_BETWEEN_POINTS) return;
            const moved = distanceMeters(last, { lat: latitude, lng: longitude });
            if (moved < MIN_METERS_BETWEEN_POINTS) return;
          }

          lastRef.current = { lat: latitude, lng: longitude, at: now };
          addPointRef.current.mutate({
            trip_id: tripId,
            profile_id: profileIdRef.current,
            lat: latitude,
            lng: longitude,
            accuracy: accuracy ?? null,
          });
        },
        () => {
          /* sin permiso o sin señal: se reintenta en el siguiente ciclo */
        },
        { enableHighAccuracy: false, timeout: 20_000, maximumAge: 60_000 },
      );
    };

    sample();
    const interval = setInterval(sample, SAMPLE_INTERVAL_MS);
    const onVisible = () => document.visibilityState === "visible" && sample();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tripId, active]);
}
