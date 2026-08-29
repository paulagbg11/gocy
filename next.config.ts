import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {};

// @serwist/next añade una config de webpack al exportar, lo que choca con
// Turbopack (activado por defecto en `next dev` desde Next 16). En
// desarrollo no generamos service worker de todas formas, así que en dev
// exportamos la config sin envolver y dejamos `next build --webpack` (ver
// package.json) para la build de producción, que sí necesita el plugin.
export default process.env.NODE_ENV === "development"
  ? nextConfig
  : withSerwistInit({ swSrc: "app/sw.ts", swDest: "public/sw.js" })(nextConfig);
