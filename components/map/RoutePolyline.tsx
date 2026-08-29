"use client";

import { Polyline } from "@vis.gl/react-google-maps";

/** Línea recta que conecta los pines del día en orden — no es una ruta real por calle (ver plan). */
export function RoutePolyline({ path }: { path: google.maps.LatLngLiteral[] }) {
  if (path.length < 2) return null;
  return <Polyline path={path} strokeColor="#b85c3e" strokeOpacity={0.85} strokeWeight={3} />;
}
