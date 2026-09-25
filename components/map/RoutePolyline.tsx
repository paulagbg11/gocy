"use client";

import { Polyline } from "@vis.gl/react-google-maps";

/**
 * Línea recta que conecta los pines del día en orden — no es una ruta real por
 * calle. Va gruesa, opaca y con un borde blanco debajo (como en Estravel):
 * fina y semitransparente se perdía entre las calles y costaba seguirla.
 */
export function RoutePolyline({ path }: { path: google.maps.LatLngLiteral[] }) {
  if (path.length < 2) return null;
  // Google Maps no entiende variables CSS, así que el color de acento va
  // fijado aquí — si cambia --accent en globals.css, hay que cambiarlo también.
  return (
    <>
      <Polyline path={path} strokeColor="#ffffff" strokeOpacity={0.95} strokeWeight={8} />
      <Polyline path={path} strokeColor="#2f6f7e" strokeOpacity={1} strokeWeight={4} />
    </>
  );
}
