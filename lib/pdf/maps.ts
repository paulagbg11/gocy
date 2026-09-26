import { computeMapView } from "@/lib/estravel/staticMap";
import { distanceMeters, type LatLng } from "@/lib/geo";
import type { TripSummary } from "./tripSummary";

/**
 * Mapas del PDF. Se pide a la Static Maps API solo el fondo, sin marcadores:
 * los números y el recorrido se dibujan encima en el propio PDF con la misma
 * proyección que usa Estravel. Así los pines llevan el número de la lista
 * (Google solo admite una letra o cifra por marcador) y el color de su
 * categoría, como en la app.
 */

export interface PdfMapPin {
  x: number;
  y: number;
  color: string;
  label?: string;
}

export interface PdfMap {
  /** data: URL del fondo, o null si Google no lo ha servido. */
  src: string | null;
  width: number;
  height: number;
  /** Trazados en puntos del PDF, cada uno con su color. */
  paths: { color: string; points: { x: number; y: number }[] }[];
  pins: PdfMapPin[];
}

/** Fondo claro pero con nombres de calles: en papel sirven para orientarse. */
const PDF_MAP_STYLE = [
  "feature:poi.business|visibility:off",
  "feature:poi|element:labels.icon|visibility:off",
  "feature:landscape|color:0xf2f3f1",
  "feature:road|element:geometry|color:0xffffff",
  "feature:road|element:labels.text.fill|color:0x8a969a",
  "feature:water|color:0xd6e4ec",
  "feature:poi.park|element:geometry|color:0xe2ece1",
];

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

interface MapLayer {
  color: string;
  points: (LatLng & { label?: string; color?: string })[];
  /** Si se une con una línea. */
  line: boolean;
}

/**
 * `width` y `height` en puntos del PDF. Se piden el doble de píxeles para que
 * el mapa se vea nítido al ampliar.
 */
async function buildMap(
  layers: MapLayer[],
  width: number,
  height: number,
  apiKey: string | undefined,
  /** Los puntos que tienen que caber; por defecto, todos. */
  frame?: LatLng[],
) {
  const all = layers.flatMap((l) => l.points);
  if (all.length === 0) return null;
  const framed = frame ?? all;

  // Con un único punto el encuadre llegaría al zoom máximo, y de la calle no
  // se ve nada. 15 enseña el barrio.
  const view = computeMapView(framed, width * 2, height * 2, framed.length === 1 ? 15 : 17);
  const toPdf = (p: LatLng) => {
    const { x, y } = view.project(p);
    return { x: x / 2, y: y / 2 };
  };

  let src: string | null = null;
  if (apiKey) {
    const params = new URLSearchParams({
      center: `${view.center.lat},${view.center.lng}`,
      zoom: String(view.zoom),
      size: `${view.logical.width}x${view.logical.height}`,
      scale: "2",
      maptype: "roadmap",
      // JPEG pesa bastante menos que PNG y en un mapa de fondo no se nota.
      format: "jpg-baseline",
      language: "es",
      key: apiKey,
    });
    src = await fetchAsDataUrl(
      `https://maps.googleapis.com/maps/api/staticmap?${params}` +
        PDF_MAP_STYLE.map((s) => `&style=${encodeURIComponent(s)}`).join(""),
    );
  }

  return {
    src,
    width,
    height,
    paths: layers
      .filter((l) => l.line && l.points.length >= 2)
      .map((l) => ({ color: l.color, points: l.points.map(toPdf) })),
    // Los pines que caen fuera del encuadre no se pintan.
    pins: layers.flatMap((l) =>
      l.points
        .map((p) => ({ ...toPdf(p), color: p.color ?? l.color, label: p.label }))
        .filter((p) => p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height),
    ),
  } satisfies PdfMap;
}

/**
 * Un mapa de la zona donde se concentran las paradas y, si alguna queda lejos
 * (el hotel en las afueras, el aeropuerto, una excursión), otro pequeño con
 * todo. Con un solo mapa, una parada a 40 km alejaba tanto el encuadre que los
 * números del centro se montaban unos encima de otros.
 */
export interface PdfMapSet {
  main: PdfMap;
  /** Solo si hay paradas fuera de la zona del mapa principal. */
  wide: PdfMap | null;
}

export interface PdfMaps {
  overview: PdfMapSet | null;
  byDay: Map<string, PdfMapSet>;
}

export const MAP_WIDTH = 523;
export const MAP_HEIGHT = 240;
const MAP_GAP = 8;
/** Ancho del mapa principal cuando va acompañado del mapa de todo. */
const SPLIT_MAIN_WIDTH = 340;

/**
 * Las paradas que forman la zona principal: el mayor grupo que cabe en un
 * radio alrededor de alguna de ellas. null si todas caben en ese radio, o si
 * no hay un grupo que merezca mapa propio.
 */
function focusIndices(points: LatLng[], radius: number): Set<number> | null {
  let best: number[] = [];
  for (const center of points) {
    const near = points.flatMap((p, i) => (distanceMeters(center, p) <= radius ? [i] : []));
    if (near.length > best.length) best = near;
  }
  if (best.length === points.length || best.length < 2) return null;
  return new Set(best);
}

async function buildMapSet(
  layers: MapLayer[],
  radius: number,
  apiKey: string | undefined,
): Promise<PdfMapSet | null> {
  const all = layers.flatMap((l) => l.points);
  const focus = focusIndices(all, radius);

  if (!focus) {
    const main = await buildMap(layers, MAP_WIDTH, MAP_HEIGHT, apiKey);
    return main && { main, wide: null };
  }

  // El encuadre del mapa principal se hace solo con las paradas de la zona,
  // pero se dibujan todas: el trazado que sale hacia las de fuera se ve
  // cortado en el borde, que es justo lo que indica "sigue por ahí".
  const focusPoints = all.filter((_, i) => focus.has(i));
  const [main, wide] = await Promise.all([
    buildMap(layers, SPLIT_MAIN_WIDTH, MAP_HEIGHT, apiKey, focusPoints),
    buildMap(layers, MAP_WIDTH - SPLIT_MAIN_WIDTH - MAP_GAP, MAP_HEIGHT, apiKey),
  ]);
  if (!main) return null;
  return { main, wide };
}

/** Descarga todos los mapas a la vez; los que fallen salen sin fondo. */
export async function buildPdfMaps(summary: TripSummary): Promise<PdfMaps> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const overviewPromise = buildMapSet(
    summary.days.map((d) => ({
      color: d.color,
      line: true,
      points: d.stops.map((s) => ({ lat: s.place.lat, lng: s.place.lng })),
    })),
    6000,
    apiKey,
  );

  const dayPromises = summary.days.map(async (d) => {
    const set = await buildMapSet(
      [
        {
          color: d.color,
          line: true,
          points: d.stops.map((s) => ({
            lat: s.place.lat,
            lng: s.place.lng,
            label: String(s.order),
            color: s.color,
          })),
        },
      ],
      3500,
      apiKey,
    );
    return [d.day.id, set] as const;
  });

  const [overview, dayMaps] = await Promise.all([overviewPromise, Promise.all(dayPromises)]);
  const byDay = new Map<string, PdfMapSet>();
  for (const [id, set] of dayMaps) if (set) byDay.set(id, set);
  return { overview, byDay };
}
