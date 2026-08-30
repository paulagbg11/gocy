import type { LatLng } from "@/lib/geo";

/**
 * Proyección Web Mercator, la misma que usa Google. Es necesaria (en vez de una
 * equirectangular aproximada) para que el trazado que dibujamos encima encaje
 * exactamente con la imagen del mapa de fondo.
 *
 * Todo se calcula en "píxeles lógicos" del mapa: al zoom 0 el mundo mide 256.
 */
const TILE = 256;

const projectX = (lng: number) => ((lng + 180) / 360) * TILE;

const projectY = (lat: number) => {
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * TILE;
};

const unprojectY = (y: number) => {
  const exp = Math.exp((0.5 - y / TILE) * 4 * Math.PI);
  return (Math.asin((exp - 1) / (exp + 1)) * 180) / Math.PI;
};

export interface MapView {
  center: LatLng;
  zoom: number;
  /** Convierte una coordenada en píxeles del lienzo. */
  project: (point: LatLng) => { x: number; y: number };
  /** Tamaño lógico que hay que pedirle a la Static Maps API. */
  logical: { width: number; height: number };
}

/**
 * Calcula centro y zoom para que todos los puntos quepan en el área dada, y
 * devuelve la función de proyección al lienzo.
 *
 * `scale` es cuántos píxeles del lienzo ocupa un píxel lógico del mapa: pedimos
 * la imagen a la mitad de tamaño con scale=2, así que vale 2.
 */
export function computeMapView(points: LatLng[], areaW: number, areaH: number): MapView {
  const scale = 2;
  const logicalW = areaW / scale;
  const logicalH = areaH / scale;

  const xs = points.map((p) => projectX(p.lng));
  const ys = points.map((p) => projectY(p.lat));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Margen para que el trazado no toque los bordes.
  const padding = 0.82;
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const zoom = Math.min(
    18,
    Math.max(
      1,
      Math.floor(Math.log2(Math.min((logicalW * padding) / spanX, (logicalH * padding) / spanY))),
    ),
  );

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const center: LatLng = {
    lat: unprojectY(centerY),
    lng: (centerX / TILE) * 360 - 180,
  };

  const factor = Math.pow(2, zoom) * scale;

  return {
    center,
    zoom,
    logical: { width: Math.round(logicalW), height: Math.round(logicalH) },
    project: (point) => ({
      x: areaW / 2 + (projectX(point.lng) - centerX) * factor,
      y: areaH / 2 + (projectY(point.lat) - centerY) * factor,
    }),
  };
}

/** Estilo discreto: el mapa es contexto, el trazado es el protagonista. */
const MUTED_STYLE = [
  "feature:poi|visibility:off",
  "feature:transit|visibility:off",
  "feature:road|element:labels|visibility:off",
  "feature:administrative|element:labels|visibility:simplified",
  "feature:landscape|color:0xf2f3f1",
  "feature:road|color:0xffffff",
  "feature:water|color:0xd6e4ec",
];

/**
 * Descarga el mapa de fondo. Se trae con fetch y se convierte a bitmap: al
 * pasar por un blob deja de ser "de otro dominio" y el lienzo no queda
 * bloqueado, que es lo que impediría exportar la imagen.
 *
 * Devuelve null si la Maps Static API no está habilitada, y entonces la imagen
 * se genera sobre fondo liso.
 */
export async function fetchStaticMap(
  view: MapView,
  apiKey: string,
): Promise<ImageBitmap | null> {
  const params = new URLSearchParams({
    center: `${view.center.lat},${view.center.lng}`,
    zoom: String(view.zoom),
    size: `${view.logical.width}x${view.logical.height}`,
    scale: "2",
    maptype: "roadmap",
    key: apiKey,
  });
  const url =
    `https://maps.googleapis.com/maps/api/staticmap?${params}` +
    MUTED_STYLE.map((s) => `&style=${encodeURIComponent(s)}`).join("");

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}
