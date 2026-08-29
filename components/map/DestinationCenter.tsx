"use client";

import { useEffect, useRef } from "react";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";

/**
 * Centra el mapa en el destino del viaje la primera vez (mientras no haya
 * pines todavía, que es cuando manda FitBounds) — así un viaje recién creado
 * a Sevilla empieza mostrando Sevilla, no el centro por defecto de Madrid, y
 * la búsqueda (sesgada al área visible) ya devuelve resultados de esa zona.
 */
export function DestinationCenter({
  destination,
  hasPlaces,
}: {
  destination: string | null | undefined;
  hasPlaces: boolean;
}) {
  const map = useMap();
  const geocodingLib = useMapsLibrary("geocoding");
  const done = useRef(false);

  useEffect(() => {
    if (!map || !geocodingLib || !destination || hasPlaces || done.current) return;
    done.current = true;
    const geocoder = new geocodingLib.Geocoder();
    geocoder.geocode({ address: destination }, (results, status) => {
      const location = results?.[0]?.geometry?.location;
      if (status === "OK" && location) {
        map.setCenter(location);
        map.setZoom(13);
      }
    });
  }, [map, geocodingLib, destination, hasPlaces]);

  return null;
}
