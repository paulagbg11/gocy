"use client";

import { useCallback, useEffect, useState } from "react";

export type GeolocationPermission = "unknown" | "prompt" | "granted" | "denied" | "unsupported";

/**
 * Estado del permiso de ubicación, sin provocar el diálogo del sistema.
 *
 * `navigator.permissions.query` permite consultarlo sin preguntar, pero no
 * todos los navegadores lo soportan para geolocalización; cuando no está, nos
 * quedamos en "prompt" y solo lo sabremos cuando la usuaria pulse el botón.
 */
export function useGeolocationPermission() {
  const [permission, setPermission] = useState<GeolocationPermission>("unknown");

  useEffect(() => {
    // Estos dos setState sincronizan con capacidades del navegador, que solo se
    // pueden mirar en cliente; no hay cascada real porque ocurren una vez.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setPermission("unsupported");
      return;
    }
    if (!navigator.permissions?.query) {
      setPermission("prompt");
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    let status: PermissionStatus | null = null;
    const onChange = () => status && setPermission(status.state as GeolocationPermission);

    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((result) => {
        status = result;
        setPermission(result.state as GeolocationPermission);
        result.addEventListener("change", onChange);
      })
      .catch(() => setPermission("prompt"));

    return () => status?.removeEventListener("change", onChange);
  }, []);

  /** Lanza el diálogo del sistema. Debe llamarse desde un gesto de la usuaria. */
  const request = useCallback(async () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setPermission("unsupported");
      return false;
    }
    return new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          setPermission("granted");
          resolve(true);
        },
        (err) => {
          setPermission(err.code === err.PERMISSION_DENIED ? "denied" : "prompt");
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 15000 },
      );
    });
  }, []);

  return { permission, request };
}

const PROMPT_KEY = "gocy:location-prompt";
type PromptAnswer = "granted" | "dismissed" | null;

const readAnswer = (): PromptAnswer => {
  try {
    const value = localStorage.getItem(PROMPT_KEY);
    return value === "granted" || value === "dismissed" ? value : null;
  } catch {
    return null;
  }
};

/**
 * Qué se contestó a la franja de "Mostrar mi ubicación", guardado en el
 * móvil. Sin esto salía cada vez que se entraba en el mapa: en una PWA de iOS
 * el permiso no siempre consta como concedido de una sesión a otra, y además
 * cerrarla con la X solo duraba hasta salir de la pantalla.
 */
export function useLocationPromptAnswer(permission: GeolocationPermission) {
  const [answer, setAnswer] = useState<PromptAnswer>(() =>
    typeof window === "undefined" ? null : readAnswer(),
  );

  const remember = useCallback((value: Exclude<PromptAnswer, null>) => {
    try {
      localStorage.setItem(PROMPT_KEY, value);
    } catch {
      // Sin almacenamiento (modo privado) vuelve a salir; no es grave.
    }
    setAnswer(value);
  }, []);

  // Si el permiso ya está concedido (por la franja o por el sistema), se
  // apunta para las próximas veces, aunque entonces iOS diga "prompt".
  useEffect(() => {
    if (permission !== "granted") return;
    try {
      localStorage.setItem(PROMPT_KEY, "granted");
    } catch {
      // Igual que arriba.
    }
  }, [permission]);

  return { answer: permission === "granted" ? ("granted" as const) : answer, remember };
}
