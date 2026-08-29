"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";

/** Ajusta el zoom/centro para que quepan todos los puntos dados, una vez por conjunto de datos. */
export function FitBounds({ points }: { points: google.maps.LatLngLiteral[] }) {
  const map = useMap();
  const lastKey = useRef<string>("");

  useEffect(() => {
    if (!map || points.length === 0) return;
    const key = points.map((p) => `${p.lat},${p.lng}`).join("|");
    if (key === lastKey.current) return;
    lastKey.current = key;

    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 64);
  }, [map, points]);

  return null;
}
