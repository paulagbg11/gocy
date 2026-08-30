"use client";

import { useEffect, useState } from "react";
import type { LatLng } from "@/lib/geo";
import { decodePolyline } from "./polyline";
import type { BuiltRoute } from "./buildRoute";

/** Límite de Google: origen + destino + 23 paradas intermedias por petición. */
const MAX_POINTS_PER_REQUEST = 25;
/** Tope de peticiones para que un viaje largo no dispare llamadas sin control. */
const MAX_REQUESTS = 24;

const ROUTES_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";

export interface RoutedDay {
  dayIndex: number | null;
  /** Camino siguiendo calles; si el servicio falla, los puntos originales. */
  path: LatLng[];
  routed: boolean;
}

export type RoutingStatus = "idle" | "loading" | "ready" | "unavailable";

function groupByDay(route: BuiltRoute) {
  const groups: { dayIndex: number | null; points: LatLng[] }[] = [];
  for (const point of route.points) {
    const last = groups[groups.length - 1];
    if (last && last.dayIndex === point.dayIndex) {
      last.points.push({ lat: point.lat, lng: point.lng });
    } else {
      groups.push({ dayIndex: point.dayIndex, points: [{ lat: point.lat, lng: point.lng }] });
    }
  }
  return groups;
}

function chunk(points: LatLng[]) {
  const chunks: LatLng[][] = [];
  for (let i = 0; i < points.length - 1; i += MAX_POINTS_PER_REQUEST - 1) {
    // Se solapa un punto entre trozos para que el camino no quede partido.
    chunks.push(points.slice(i, i + MAX_POINTS_PER_REQUEST));
  }
  return chunks;
}

const waypoint = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });

/**
 * Pide el camino a pie a la Routes API (la moderna). La antigua
 * `DirectionsService` del SDK está marcada como "legacy" y en los proyectos de
 * Google Cloud creados recientemente ya no se puede habilitar.
 */
async function fetchWalkingPath(points: LatLng[], apiKey: string): Promise<LatLng[] | null> {
  const response = await fetch(ROUTES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.polyline.encodedPolyline",
    },
    body: JSON.stringify({
      origin: waypoint(points[0]),
      destination: waypoint(points[points.length - 1]),
      intermediates: points.slice(1, -1).map(waypoint),
      travelMode: "WALK",
      polylineEncoding: "ENCODED_POLYLINE",
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const encoded = data?.routes?.[0]?.polyline?.encodedPolyline;
  return typeof encoded === "string" ? decodePolyline(encoded) : null;
}

/**
 * Convierte los puntos sueltos en un camino que sigue las calles.
 *
 * Solo se enrutan los tramos *dentro de un mismo día*: el salto de un día a
 * otro puede ser un tren entre ciudades y no tiene sentido pedir indicaciones
 * andando para eso.
 *
 * Si el servicio no está disponible se devuelve una lista vacía y el estado
 * "unavailable", y la pantalla dibuja el recorrido recto.
 */
export function useRoutedPath(route: BuiltRoute) {
  const [days, setDays] = useState<RoutedDay[]>([]);
  const [status, setStatus] = useState<RoutingStatus>("idle");

  // Firma estable: evita re-pedir rutas en cada render por una nueva referencia.
  const signature = route.points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || route.points.length < 2) return;

    let cancelled = false;
    const groups = groupByDay(route).filter((g) => g.points.length >= 2);
    if (groups.length === 0) return;

    const run = async () => {
      setStatus("loading");
      const result: RoutedDay[] = [];
      let requests = 0;
      let anyRouted = false;

      for (const group of groups) {
        const path: LatLng[] = [];
        let routed = true;

        for (const piece of chunk(group.points)) {
          if (requests >= MAX_REQUESTS) {
            routed = false;
            break;
          }
          requests++;

          try {
            const leg = await fetchWalkingPath(piece, apiKey);
            if (!leg) {
              routed = false;
              break;
            }
            path.push(...leg);
          } catch {
            routed = false;
            break;
          }
        }

        if (cancelled) return;

        if (routed && path.length > 1) {
          anyRouted = true;
          result.push({ dayIndex: group.dayIndex, path, routed: true });
        }
      }

      if (cancelled) return;
      setDays(anyRouted ? result : []);
      setStatus(anyRouted ? "ready" : "unavailable");
    };

    run();
    return () => {
      cancelled = true;
    };
    // `signature` resume los puntos: si no cambian, no se vuelve a pedir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return { days, status };
}
