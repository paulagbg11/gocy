import { formatDistance, type LatLng } from "@/lib/geo";
import { dayColor, type BuiltRoute } from "./buildRoute";

const W = 1080;
const H = 1350;
const PAD = 110;

const BG = "#f6f8f9";
const INK = "#1f2a2e";
const MUTED = "#647880";
const ACCENT = "#2f6f7e";

export type RouteImageMode = "full" | "clean" | "days";

export interface DrawablePath {
  dayIndex: number | null;
  path: LatLng[];
  /** Desplazamiento en transporte o salto entre días: se pinta discontinuo. */
  dashed: boolean;
}

/**
 * Dibuja el recuerdo en un canvas propio.
 *
 * No se captura el mapa de Google: sus tiles vienen de otro dominio y
 * "contaminan" el canvas, lo que hace que toDataURL falle por seguridad. Así
 * que se dibuja el trazado solo, estilo Strava, con la paleta de la app.
 */
export function renderRouteImage({
  paths,
  stops,
  mode,
  route,
  tripName,
  dateRange,
}: {
  paths: DrawablePath[];
  stops: LatLng[];
  mode: RouteImageMode;
  route: BuiltRoute;
  tripName: string;
  dateRange: string;
}): string | null {
  const all = paths.flatMap((p) => p.path);
  if (all.length < 2) return null;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Proyección equirectangular sencilla: a escala de ciudad la distorsión es
  // inapreciable y evita depender de ninguna librería de mapas.
  const lats = all.map((p) => p.lat);
  const lngs = all.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const lngScale = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);

  const spanX = Math.max((maxLng - minLng) * lngScale, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);

  const areaTop = PAD + 200;
  const areaBottom = H - PAD - (mode === "full" ? 150 : 40);
  const areaW = W - PAD * 2;
  const areaH = areaBottom - areaTop;
  const scale = Math.min(areaW / spanX, areaH / spanY);
  const offsetX = PAD + (areaW - spanX * scale) / 2;
  const offsetY = areaTop + (areaH - spanY * scale) / 2;

  const project = (p: LatLng) => ({
    x: offsetX + (p.lng - minLng) * lngScale * scale,
    // La latitud crece hacia arriba, el canvas hacia abajo.
    y: offsetY + (maxLat - p.lat) * scale,
  });

  const trace = (path: LatLng[]) => {
    ctx.beginPath();
    path.forEach((point, i) => {
      const { x, y } = project(point);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
  };

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Primero el borde blanco de todos los tramos sólidos, para que las líneas
  // se despeguen entre ellas cuando se cruzan.
  for (const item of paths) {
    if (item.dashed || item.path.length < 2) continue;
    trace(item.path);
    ctx.setLineDash([]);
    ctx.strokeStyle = "#ffffff";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 18;
    ctx.stroke();
  }

  for (const item of paths) {
    if (item.path.length < 2) continue;
    trace(item.path);
    ctx.strokeStyle = mode === "days" ? dayColor(item.dayIndex) : ACCENT;

    if (item.dashed) {
      ctx.setLineDash([10, 16]);
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 5;
    } else {
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 11;
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Paradas
  for (const stop of stops) {
    const { x, y } = project(stop);
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = ACCENT;
    ctx.stroke();
  }

  // Inicio y final del recorrido
  const first = all[0];
  const last = all[all.length - 1];
  for (const [point, color] of [
    [first, "#4f7a68"],
    [last, "#bd6248"],
  ] as const) {
    const { x, y } = project(point);
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Cabecera. "GoCy" va arriba del todo como antetítulo: alineado a la derecha
  // a la misma altura, los títulos largos se le montaban encima.
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.font = "600 26px Outfit, system-ui, sans-serif";
  ctx.fillText("GoCy", PAD, PAD);

  // El nombre del viaje se encoge si no cabe, en vez de salirse del lienzo.
  const maxTitleWidth = W - PAD * 2;
  let titleSize = 68;
  do {
    ctx.font = `700 ${titleSize}px Outfit, system-ui, sans-serif`;
    if (ctx.measureText(tripName).width <= maxTitleWidth) break;
    titleSize -= 4;
  } while (titleSize > 34);

  ctx.fillStyle = INK;
  ctx.fillText(tripName, PAD, PAD + 78);

  ctx.fillStyle = MUTED;
  ctx.font = "400 34px Outfit, system-ui, sans-serif";
  ctx.fillText(dateRange, PAD, PAD + 126);

  if (mode === "full") {
    const distanceLabel =
      route.source === "gps" ? "aprox. a pie" : "en línea recta entre paradas";
    const stats: Array<[string, string]> = [
      [String(route.dayCount || "—"), route.dayCount === 1 ? "día" : "días"],
      [String(route.placeCount), route.placeCount === 1 ? "lugar" : "lugares"],
      [formatDistance(route.walkingMeters), distanceLabel],
    ];

    const colW = (W - PAD * 2) / stats.length;
    stats.forEach(([value, label], i) => {
      const x = PAD + colW * i;
      ctx.fillStyle = INK;
      ctx.font = "700 52px Outfit, system-ui, sans-serif";
      ctx.fillText(value, x, H - PAD - 46);
      ctx.fillStyle = MUTED;
      ctx.font = "400 27px Outfit, system-ui, sans-serif";
      ctx.fillText(label, x, H - PAD - 8);
    });
  }

  return canvas.toDataURL("image/png");
}
