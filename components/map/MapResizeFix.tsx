"use client";

import { useEffect } from "react";
import { useMap } from "@vis.gl/react-google-maps";

/**
 * @vis.gl/react-google-maps no usa ResizeObserver internamente: si el
 * contenedor del mapa no tiene ya su tamaño final en el momento en que se
 * crea el `google.maps.Map` (algo habitual con layouts flex, donde el
 * tamaño se resuelve un instante después del primer render), el mapa se
 * queda con 0px de alto y nunca se repinta. Este componente avisa a Google
 * Maps cada vez que el contenedor cambia de tamaño (incluida esa primera
 * vez), y también cubre casos reales como rotar el móvil.
 */
export function MapResizeFix() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const container = map.getDiv();
    const triggerResize = () => google.maps.event.trigger(map, "resize");

    const observer = new ResizeObserver(triggerResize);
    observer.observe(container);
    triggerResize();

    return () => observer.disconnect();
  }, [map]);

  return null;
}
