"use client";

import { Polyline } from "@vis.gl/react-google-maps";

/** Línea recta que conecta los pines del día en orden — no es una ruta real por calle (ver plan). */
export function RoutePolyline({ path }: { path: google.maps.LatLngLiteral[] }) {
  if (path.length < 2) return null;
  // Google Maps no entiende variables CSS, así que el color de acento va
  // fijado aquí — si cambia --accent en globals.css, hay que cambiarlo también.
  return <Polyline path={path} strokeColor="#2f6f7e" strokeOpacity={0.85} strokeWeight={3} />;
}
