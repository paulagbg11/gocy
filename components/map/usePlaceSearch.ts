"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import type { LatLng } from "@/lib/geo";
import type { SelectedPlace } from "./PlaceSearchBox";

export interface PlacePrediction {
  placeId: string;
  name: string;
  /** Ciudad, país…: lo que distingue dos sitios con el mismo nombre. */
  detail: string;
}

/** Con menos letras Google devuelve cualquier cosa, y cada consulta cuenta. */
const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 300;

/**
 * Buscador de Google Places sin su desplegable: devuelve las sugerencias para
 * pintarlas donde haga falta (en PlaceSearchBox el desplegable lo pone Google
 * y no se puede mezclar con una lista propia).
 *
 * `near` son los sitios hacia los que sesgar los resultados (los lugares del
 * viaje): sin eso, "hotel" devuelve hoteles de medio mundo. No se usa lo que
 * se ve en el mapa, como en PlaceSearchBox, porque quien llama puede tener el
 * mapa escondido mientras se escribe.
 */
export function usePlaceSearch(query: string, near: LatLng[]) {
  const placesLib = useMapsLibrary("places");
  const service = useMemo(
    () => (placesLib ? new placesLib.AutocompleteService() : null),
    [placesLib],
  );
  // Una sesión agrupa las sugerencias y el detalle final en un solo cobro.
  const session = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [found, setFound] = useState<{ query: string; predictions: PlacePrediction[] }>({
    query: "",
    predictions: [],
  });

  const text = query.trim();

  // El rectángulo que abarca todos los sitios. Como texto, para que el efecto
  // no se relance cada vez que llega una lista nueva con los mismos puntos.
  const biasKey =
    near.length === 0
      ? ""
      : [
          Math.min(...near.map((p) => p.lat)),
          Math.min(...near.map((p) => p.lng)),
          Math.max(...near.map((p) => p.lat)),
          Math.max(...near.map((p) => p.lng)),
        ].join(",");

  useEffect(() => {
    if (!service || !placesLib || text.length < MIN_QUERY_LENGTH) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      session.current ??= new placesLib.AutocompleteSessionToken();
      const [south, west, north, east] = biasKey.split(",").map(Number);
      try {
        const { predictions } = await service.getPlacePredictions({
          input: text,
          locationBias: biasKey ? { south, west, north, east } : undefined,
          sessionToken: session.current,
        });
        if (cancelled) return;
        setFound({
          query: text,
          predictions: predictions.map((p) => ({
            placeId: p.place_id,
            name: p.structured_formatting.main_text,
            detail: p.structured_formatting.secondary_text ?? "",
          })),
        });
      } catch {
        if (!cancelled) setFound({ query: text, predictions: [] });
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [service, placesLib, biasKey, text]);

  /** Pide a Google las coordenadas y la dirección de una sugerencia. */
  const resolve = useCallback(
    (prediction: PlacePrediction) =>
      new Promise<SelectedPlace | null>((done) => {
        if (!placesLib) return done(null);
        const details = new placesLib.PlacesService(document.createElement("div"));
        details.getDetails(
          {
            placeId: prediction.placeId,
            fields: ["name", "formatted_address", "geometry", "place_id"],
            sessionToken: session.current ?? undefined,
          },
          (place) => {
            session.current = null;
            const location = place?.geometry?.location;
            if (!place || !location) return done(null);
            done({
              name: place.name ?? prediction.name,
              address: place.formatted_address,
              lat: location.lat(),
              lng: location.lng(),
              placeId: place.place_id ?? prediction.placeId,
            });
          },
        );
      }),
    [placesLib],
  );

  // Las sugerencias de un texto anterior no se enseñan con el nuevo.
  const predictions = found.query === text && text.length >= MIN_QUERY_LENGTH ? found.predictions : [];
  return { predictions, resolve };
}
