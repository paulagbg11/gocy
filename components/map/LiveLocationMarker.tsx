"use client";

import { useEffect, useState } from "react";
import { Circle, Marker } from "@vis.gl/react-google-maps";

/** Punto azul de "estás aquí". Deliberadamente distinto de los pines de categoría. */
const DOT = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
     <circle cx="11" cy="11" r="9" fill="#ffffff"/>
     <circle cx="11" cy="11" r="6.5" fill="#1a73e8"/>
   </svg>`,
)}`;

/**
 * Sigue la ubicación mientras la pantalla del mapa está visible. Se corta al
 * ocultar la app: watchPosition es lo que más batería gasta de todo esto.
 */
export function LiveLocationMarker() {
  const [position, setPosition] = useState<{ lat: number; lng: number; accuracy: number } | null>(
    null,
  );

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;

    let watchId: number | null = null;

    const start = () => {
      if (watchId !== null) return;
      watchId = navigator.geolocation.watchPosition(
        (pos) =>
          setPosition({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? 0,
          }),
        () => {},
        { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
      );
    };

    const stop = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    };

    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!position) return null;

  return (
    <>
      {position.accuracy > 25 && (
        <Circle
          center={{ lat: position.lat, lng: position.lng }}
          radius={position.accuracy}
          strokeColor="#1a73e8"
          strokeOpacity={0.35}
          strokeWeight={1}
          fillColor="#1a73e8"
          fillOpacity={0.12}
        />
      )}
      <Marker
        position={{ lat: position.lat, lng: position.lng }}
        title="Estás aquí"
        icon={{ url: DOT }}
        zIndex={1000}
      />
    </>
  );
}
