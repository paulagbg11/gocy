"use client";

import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { GeolocationPermission } from "@/lib/tracking/useGeolocationPermission";

/**
 * Franja para pedir el permiso de ubicación. No se lanza el diálogo del sistema
 * al cargar la página: iOS penaliza eso y además queda agresivo. Se pide con un
 * gesto explícito.
 */
export function LocationPrompt({
  permission,
  onRequest,
  onDismiss,
}: {
  permission: GeolocationPermission;
  onRequest: () => void;
  onDismiss: () => void;
}) {
  if (permission === "granted" || permission === "unknown") return null;

  const denied = permission === "denied";
  const unsupported = permission === "unsupported";

  return (
    <div className="pointer-events-auto flex items-start gap-3 rounded-[var(--radius-md)] bg-surface px-3.5 py-3 shadow-[var(--shadow-md)]">
      <MapPin size={18} className="mt-0.5 shrink-0 text-accent" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {unsupported
            ? "Este navegador no comparte la ubicación"
            : denied
              ? "La ubicación está bloqueada"
              : "Mostrar mi ubicación durante el viaje"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {unsupported
            ? "Prueba a abrir la app desde Safari o Chrome."
            : denied
              ? "Actívala en Ajustes del sistema → Safari → Ubicación para verte en el mapa."
              : "Para verte en el mapa y guardar por dónde habéis pasado."}
        </p>
        {!denied && !unsupported && (
          <Button size="sm" className="mt-2" onClick={onRequest}>
            Activar
          </Button>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Ahora no"
        className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
      >
        <X size={16} />
      </button>
    </div>
  );
}
