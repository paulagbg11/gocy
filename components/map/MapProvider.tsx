"use client";

import { APIProvider } from "@vis.gl/react-google-maps";

/**
 * Punto de aislamiento del proveedor de mapas: hoy Google Maps, pero si la
 * facturación de Google Cloud no funciona, cambiar a Mapbox GL JS solo debería
 * tocar este archivo y los componentes dentro de components/map/google/.
 */
export function MapProvider({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="max-w-xs space-y-2">
          <p className="font-medium">Falta la clave de Google Maps</p>
          <p className="text-sm text-muted-foreground">
            Añade <code className="text-xs bg-surface-2 px-1 py-0.5 rounded">
              NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
            </code>{" "}
            en <code className="text-xs bg-surface-2 px-1 py-0.5 rounded">.env.local</code> y reinicia
            la app. Ver README.md.
          </p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={["places"]}>
      {children}
    </APIProvider>
  );
}
