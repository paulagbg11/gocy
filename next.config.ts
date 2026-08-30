import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    // Permite servir las portadas con next/image, que las redimensiona al
    // tamaño real de la tarjeta en vez de descargar la foto original entera.
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

// @serwist/next añade una config de webpack al exportar, lo que choca con
// Turbopack (activado por defecto en `next dev` desde Next 16). En
// desarrollo no generamos service worker de todas formas, así que en dev
// exportamos la config sin envolver y dejamos `next build --webpack` (ver
// package.json) para la build de producción, que sí necesita el plugin.
export default process.env.NODE_ENV === "development"
  ? nextConfig
  : withSerwistInit({
      swSrc: "app/sw.ts",
      swDest: "public/sw.js",
      // Los iconos pesan ~850 KB y solo hacen falta al instalar la app en la
      // pantalla de inicio, no para usarla: fuera de la precaché, que se
      // descarga entera en cada despliegue.
      globPublicPatterns: ["**/*", "!icons/**"],
    })(nextConfig);
