/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  StaleWhileRevalidate,
  Serwist,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const isGoogleFonts = (hostname: string) =>
  hostname === "fonts.googleapis.com" || hostname === "fonts.gstatic.com";

/** Dominios desde los que Google Maps sirve el script y los tiles del mapa. */
const isGoogleMaps = (hostname: string) =>
  !isGoogleFonts(hostname) &&
  (hostname.endsWith("googleapis.com") ||
    hostname.endsWith("gstatic.com") ||
    hostname.endsWith("ggpht.com") ||
    hostname === "maps.google.com");

/** Fotos de los lugares (lib/place-photos.ts): la consulta y las miniaturas. */
const isWikimediaApi = (url: URL) =>
  url.hostname === "commons.wikimedia.org" && url.pathname === "/w/api.php";
const isWikimediaImage = (hostname: string) =>
  hostname === "upload.wikimedia.org" || hostname === "thumb.wikimedia.org";

const isSupabase = (hostname: string) => hostname.endsWith(".supabase.co");

/** Las portadas viven en rutas con uuid, así que nunca cambian de contenido. */
const isSupabasePublicFile = (pathname: string) =>
  pathname.startsWith("/storage/v1/object/public/");

// IMPORTANTE: estas reglas van ANTES de defaultCache porque gana la primera que
// coincide. defaultCache trae un comodín para TODO lo que sea de otro dominio
// (NetworkFirst, 32 entradas, 10 s de espera). Con eso, los cientos de tiles del
// mapa se peleaban por 32 huecos de caché y podían quedarse esperando 10 s cada
// uno: de ahí que el mapa se quedase colgado hasta salir y volver a entrar.
const runtimeCaching: RuntimeCaching[] = [
  // El mapa se sirve solo, sin service worker de por medio.
  {
    matcher: ({ url }) => isGoogleMaps(url.hostname),
    handler: new NetworkOnly(),
  },
  // Datos y realtime de Supabase: siempre frescos, nunca desde caché.
  {
    matcher: ({ url }) => isSupabase(url.hostname) && !isSupabasePublicFile(url.pathname),
    handler: new NetworkOnly(),
  },
  // Portadas de viaje: sí conviene cachearlas, y como la ruta es inmutable
  // podemos servirlas directamente desde caché.
  {
    matcher: ({ url }) => isSupabase(url.hostname) && isSupabasePublicFile(url.pathname),
    handler: new CacheFirst({
      cacheName: "supabase-images",
      plugins: [
        new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      ],
    }),
  },
  // Las miniaturas de Commons no cambian para una misma URL: desde caché, sin
  // esperar a la red. Así las fotos salen al momento al volver a la app.
  {
    matcher: ({ url }) => isWikimediaImage(url.hostname),
    handler: new CacheFirst({
      cacheName: "place-photos",
      plugins: [
        new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 24 * 60 * 60 }),
      ],
    }),
  },
  // La lista de fotos de cada lugar: se enseña la guardada y se refresca por
  // detrás. Sin esto, cada vez que se abre la app se esperaban 2 s por lugar.
  {
    matcher: ({ url }) => isWikimediaApi(url),
    handler: new StaleWhileRevalidate({
      cacheName: "place-photos-api",
      plugins: [
        new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      ],
    }),
  },
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
});

serwist.addEventListeners();
