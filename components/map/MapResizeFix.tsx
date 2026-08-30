"use client";

import { useEffect } from "react";
import { useMap } from "@vis.gl/react-google-maps";

/**
 * Mantiene el mapa sincronizado con el tamaño real de su contenedor.
 *
 * Google Maps se dimensiona al crearse y no vuelve a mirar: si nace dentro de
 * una caja que todavía no tiene su tamaño final (habitual con layouts flex, o
 * al reabrir la PWA mientras la pestaña sigue en segundo plano), se queda en
 * gris y no se recupera solo — hasta ahora había que salir de la app y volver
 * a entrar.
 *
 * Por eso avisamos a Google Maps en tres momentos:
 *  - cuando el contenedor cambia de tamaño (ResizeObserver),
 *  - al montar,
 *  - y cuando la app vuelve a primer plano. Este último es el importante: el
 *    ResizeObserver NO dispara mientras el documento está oculto, así que si
 *    el mapa se creó en ese estado, volver a la app es justo el momento en el
 *    que hay que recolocarlo.
 */
export function MapResizeFix() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const container = map.getDiv();

    const triggerResize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      google.maps.event.trigger(map, "resize");
    };

    const observer = new ResizeObserver(triggerResize);
    observer.observe(container);
    triggerResize();

    const onVisible = () => {
      if (document.visibilityState === "visible") triggerResize();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [map]);

  return null;
}
