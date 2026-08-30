import { formatDistance } from "@/lib/geo";
import { dayColor, type BuiltRoute } from "./buildRoute";

const W = 1080;
const H = 1350;
const PAD = 110;

const BG = "#f6f8f9";
const INK = "#1f2a2e";
const MUTED = "#647880";
const ACCENT = "#2f6f7e";

export type RouteImageMode = "full" | "clean" | "days";

/**
 * Dibuja el recuerdo en un canvas propio.
 *
 * No se captura el mapa de Google: sus tiles vienen de otro dominio y
 * "contaminan" el canvas, lo que hace que toDataURL falle por seguridad. Así
 * que se dibuja el trazado solo, estilo Strava, con la paleta de la app.
 */
export function renderRouteImage({
  route,
  mode,
  tripName,
  dateRange,
}: {
  route: BuiltRoute;
  mode: RouteImageMode;
  tripName: string;
  dateRange: string;
}): string | null {
  if (route.points.length < 2) return null;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Proyección equirectangular sencilla: a escala de ciudad la distorsión es
  // inapreciable y evita depender de ninguna librería de mapas.
  const lats = route.points.map((p) => p.lat);
  const lngs = route.points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2;
  const lngScale = Math.cos((midLat * Math.PI) / 180);

  const spanX = Math.max((maxLng - minLng) * lngScale, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);

  const areaTop = PAD + 200;
  const areaBottom = H - PAD - 150;
  const areaW = W - PAD * 2;
  const areaH = areaBottom - areaTop;
  const scale = Math.min(areaW / spanX, areaH / spanY);
  const offsetX = PAD + (areaW - spanX * scale) / 2;
  const offsetY = areaTop + (areaH - spanY * scale) / 2;

  const project = (p: { lat: number; lng: number }) => ({
    x: offsetX + (p.lng - minLng) * lngScale * scale,
    // La latitud crece hacia arriba, el canvas hacia abajo.
    y: offsetY + (maxLat - p.lat) * scale,
  });

  // Trazado
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const segment of route.segments) {
    const a = project(segment.from);
    const b = project(segment.to);

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);

    if (segment.isTransport) {
      // Discontinuo: ahí no se caminó (transporte, o salto entre días).
      ctx.setLineDash([10, 14]);
      ctx.strokeStyle = mode === "days" ? dayColor(segment.dayIndex) : ACCENT;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 5;
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = mode === "days" ? dayColor(segment.dayIndex) : ACCENT;
      ctx.globalAlpha = 1;
      ctx.lineWidth = 9;
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Paradas con nombre (solo cuando la fuente son los lugares, o en modo completo)
  if (mode !== "clean") {
    for (const point of route.points) {
      if (!point.label) continue;
      const { x, y } = project(point);
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = mode === "days" ? dayColor(point.dayIndex) : ACCENT;
      ctx.stroke();
    }
  }

  // Cabecera. "GoCy" va arriba del todo como antetítulo: antes estaba alineado
  // a la derecha a la misma altura que el nombre del viaje y los títulos largos
  // se le montaban encima.
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

  // Datos abajo
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

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
