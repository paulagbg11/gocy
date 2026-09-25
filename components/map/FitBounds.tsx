"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";

interface FitBoundsProps {
  points: google.maps.LatLngLiteral[];
  /**
   * Si se pasa, solo se reencuadra la primera vez que hay puntos y cuando
   * cambia este valor, no con cada pin que aparece o desaparece. En el mapa
   * grande, reencuadrar al añadir un lugar (o cuando lo añade el otro móvil)
   * sacaba de golpe al usuario de la zona que estaba mirando.
   */
  fitKey?: string;
  /**
   * Margen en px alrededor de los puntos. En mapas bajitos, 64 por cada lado
   * se come casi todo el alto.
   */
  padding?: number | google.maps.Padding;
}

/** Ajusta el zoom/centro para que quepan todos los puntos dados, una vez por conjunto de datos. */
export function FitBounds({ points, fitKey, padding = 64 }: FitBoundsProps) {
  const map = useMap();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!map || points.length === 0) return;
    const key = fitKey ?? points.map((p) => `${p.lat},${p.lng}`).join("|");
    if (key === lastKey.current) return;
    lastKey.current = key;

    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, padding);
  }, [map, points, fitKey, padding]);

  return null;
}
