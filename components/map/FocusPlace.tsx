"use client";

import { useEffect } from "react";
import { useMap } from "@vis.gl/react-google-maps";

/** Zoom de calle: se ve el pin y lo que tiene alrededor, con los nombres puestos. */
const FOCUS_ZOOM = 17;

/**
 * Cuánto se sube el pin (en fracción del alto del mapa) cuando se abre la
 * ficha: lo deja en la franja libre entre los filtros de arriba y la ficha.
 */
const ABOVE_SHEET_SHIFT = 0.15;

export interface FocusTarget {
  lat: number;
  lng: number;
  /**
   * La ficha del lugar se va a abrir y tapa la mitad de abajo del mapa: el pin
   * se sube para que quede a la vista por encima de ella.
   */
  aboveSheet?: boolean;
}

/** Lleva el mapa hasta un lugar concreto (recién guardado, o ya guardado y buscado otra vez). */
export function FocusPlace({ target }: { target: FocusTarget | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !target) return;
    map.setZoom(FOCUS_ZOOM);
    map.setCenter(target);
    if (target.aboveSheet) {
      // panBy con y positivo baja el centro, así que el pin sube en pantalla.
      // Poco: arriba flotan el buscador y los filtros, y con un 30 % el pin
      // quedaba escondido debajo de ellos.
      map.panBy(0, map.getDiv().clientHeight * ABOVE_SHEET_SHIFT);
    }
  }, [map, target]);

  return null;
}
