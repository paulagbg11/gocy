"use client";

import { useEffect } from "react";
import { useMap } from "@vis.gl/react-google-maps";

/**
 * Avisa del zoom cada vez que el mapa termina de moverse.
 *
 * Se escucha "idle" en vez de usar onZoomChanged del <Map>: con eso, a veces
 * el estado se quedaba un nivel por detrás (o sin enterarse de un setZoom
 * hecho desde código) y los nombres de los pines no aparecían al acercarse.
 */
export function ZoomWatcher({ onChange }: { onChange: (zoom: number) => void }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const report = () => {
      const zoom = map.getZoom();
      if (zoom !== undefined) onChange(zoom);
    };
    report();
    const listener = map.addListener("idle", report);
    return () => listener.remove();
  }, [map, onChange]);

  return null;
}
