import { dayColor } from "@/lib/estravel/buildRoute";
import { computeMapView, fetchStaticMap } from "@/lib/estravel/staticMap";
import { formatDateRange } from "@/lib/dates";
import { dayTitle, loadImage, numberPlaces, photoClock, pickPosterPhotos } from "./album";
import type { Place, Trip, TripDay, TripPhoto } from "@/lib/supabase/types";

/**
 * El póster del viaje, para imprimir y enmarcar: proporción de A4 (1:√2) y
 * resolución para unos 20×28 cm a buena calidad. Arriba la portada con el
 * título, luego el mapa del recorrido con los lugares numerados y abajo las
 * fotos colgadas de un hilo, día a día, en zigzag.
 *
 * Tiene tamaño fijo: si hay muchas fotos se hacen más pequeñas, y pasadas
 * MAX_PHOTOS se eligen (ver pickPosterPhotos). Un lienzo que creciera con las
 * fotos no se podría enmarcar, y además iOS no pinta lienzos de más de unos
 * 16 millones de píxeles.
 */
const W = 2400;
const H = 3394;
const MARGIN = 120;
const HEADER_H = 860;
const MAP_TOP = HEADER_H + 70;
const MAP_H = 640;
const THREAD_TOP = MAP_TOP + MAP_H + 60;
const THREAD_BOTTOM = H - 150;
export const MAX_PHOTOS = 24;

const PAPER = "#f7f3ea";
const INK = "#1f2a2e";
const MUTED = "#7a7466";
const ACCENT = "#2f6f7e";
const TWINE = "#a0784a";
const TWINE_LIGHT = "#c9a477";
const WOOD = "#d8b07a";
const WOOD_DARK = "#a9844f";

export async function renderTripPoster({
  trip,
  days,
  places,
  photos,
  coverUrl,
  photoUrl,
}: {
  trip: Trip;
  days: TripDay[];
  places: Place[];
  /** En orden de álbum: por días y luego de carrete (groupByDay). */
  photos: TripPhoto[];
  coverUrl: string | null;
  /** URL firmada de la versión grande o de la miniatura. */
  photoUrl: (photo: TripPhoto, large: boolean) => string | undefined;
}): Promise<Blob> {
  await document.fonts?.ready;
  // La fuente de la app: next/font la registra con un nombre propio.
  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  const font = (weight: number, size: number) => `${weight} ${Math.round(size)}px ${family}`;

  const selected = pickPosterPhotos(photos, MAX_PHOTOS);
  const numbers = numberPlaces(selected);
  const placesById = new Map(places.map((p) => [p.id, p]));
  const daysById = new Map(days.map((d) => [d.id, d]));
  const dayOf = (p: TripPhoto) => (p.day_id ? (daysById.get(p.day_id) ?? null) : null);
  const colorOf = (p: TripPhoto) => dayColor(dayOf(p)?.day_index ?? null);

  const layout = gridLayout(selected.length);
  const [cover, images] = await Promise.all([
    coverUrl ? loadImage(coverUrl) : Promise.resolve(null),
    Promise.all(
      selected.map((p) => {
        const url = photoUrl(p, layout.size > 380);
        return url ? loadImage(url) : Promise.resolve(null);
      }),
    ),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Sin canvas");

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // --- Portada y título ---
  if (cover) {
    drawCover(ctx, cover, 0, 0, W, HEADER_H);
    const shade = ctx.createLinearGradient(0, HEADER_H * 0.3, 0, HEADER_H);
    shade.addColorStop(0, "rgba(20,30,34,0)");
    shade.addColorStop(1, "rgba(20,30,34,0.78)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, HEADER_H);
  } else {
    // Sin portada, rayas de colores como las de la cámara de la cabecera.
    ctx.fillStyle = ACCENT;
    ctx.fillRect(0, 0, W, HEADER_H);
    ["#e85d2a", "#f2b84b", "#f2d9a6", "#4fae80"].forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 130 + i * 52, W, 52);
    });
  }

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";
  let titleSize = 160;
  ctx.font = font(700, titleSize);
  while (ctx.measureText(trip.name).width > W - MARGIN * 2 && titleSize > 70) {
    titleSize -= 6;
    ctx.font = font(700, titleSize);
  }
  ctx.fillText(trip.name, MARGIN, HEADER_H - 200);

  const placeCount = numbers.size;
  const dayCount = new Set(selected.map((p) => p.day_id)).size;
  const subtitle = [trip.destination, formatDateRange(trip.start_date, trip.end_date)]
    .filter(Boolean)
    .join("  ·  ");
  ctx.font = font(500, 58);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(fitText(ctx, subtitle, W - MARGIN * 2), MARGIN, HEADER_H - 120);
  ctx.font = font(400, 44);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(
    [
      `${dayCount} ${dayCount === 1 ? "día" : "días"}`,
      `${placeCount} ${placeCount === 1 ? "lugar" : "lugares"}`,
      `${photos.length} ${photos.length === 1 ? "foto" : "fotos"}`,
    ].join("  ·  "),
    MARGIN,
    HEADER_H - 55,
  );

  // --- Mapa del recorrido ---
  await drawRouteMap(ctx, selected, numbers, placesById, colorOf, font);

  // --- El hilo con las fotos ---
  drawThread(ctx, layout);
  const seenDays = new Set<string | null>();
  selected.forEach((photo, i) => {
    const slot = layout.slots[i];
    const place = photo.place_id ? placesById.get(photo.place_id) : undefined;
    drawPolaroid(ctx, {
      slot,
      size: layout.size,
      image: images[i],
      color: colorOf(photo),
      number: photo.place_id ? numbers.get(photo.place_id) : undefined,
      name: place?.name ?? "Foto",
      detail: photo.caption || photoClock(photo),
      font,
    });
    // Un cartelito con el día sobre el hilo, en la primera foto de cada día.
    if (!seenDays.has(photo.day_id)) {
      seenDays.add(photo.day_id);
      drawDayTag(ctx, slot, dayTitle(dayOf(photo)), colorOf(photo), layout.size, font);
    }
  });

  ctx.font = font(500, 34);
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  ctx.fillText(
    photos.length > selected.length
      ? `${selected.length} de ${photos.length} fotos · GoCy`
      : "GoCy",
    W / 2,
    H - 60,
  );
  ctx.textAlign = "left";

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/jpeg", 0.9),
  );
}

type Font = (weight: number, size: number) => string;

interface Slot {
  /** Pinza: donde la foto cuelga del hilo. */
  x: number;
  y: number;
  angle: number;
  row: number;
}

/**
 * Rejilla en zigzag: la primera fila de izquierda a derecha, la segunda de
 * derecha a izquierda, y así, para que el hilo baje serpenteando.
 */
function gridLayout(count: number) {
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : count <= 16 ? 4 : count <= 20 ? 5 : 6;
  const rows = Math.max(1, Math.ceil(count / cols));
  const cellW = (W - MARGIN * 2) / cols;
  const cellH = (THREAD_BOTTOM - THREAD_TOP) / rows;
  // Lado de la polaroid; de alto mide 1,22 veces eso, más la pinza y el cartel.
  const size = Math.min(cellW * 0.8, (cellH - 120) / 1.22, 720);
  const slots: Slot[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const inRow = i % cols;
    const col = row % 2 === 0 ? inRow : cols - 1 - inRow;
    slots.push({
      x: MARGIN + cellW * (col + 0.5),
      y: THREAD_TOP + cellH * row + 80,
      // Inclinación que parece al azar pero sale siempre igual.
      angle: (((i * 7919) % 11) - 5) * 0.007,
      row,
    });
  }
  return { slots, size, cellW };
}

function drawThread(ctx: CanvasRenderingContext2D, layout: ReturnType<typeof gridLayout>) {
  const { slots, cellW } = layout;
  if (slots.length === 0) return;
  const sag = Math.min(70, cellW * 0.14);

  const path = () => {
    ctx.beginPath();
    const first = slots[0];
    ctx.moveTo(MARGIN * 0.4, first.y - 40);
    ctx.quadraticCurveTo((MARGIN * 0.4 + first.x) / 2, first.y + sag * 0.6, first.x, first.y);
    for (let i = 1; i < slots.length; i++) {
      const a = slots[i - 1];
      const b = slots[i];
      if (a.row === b.row) {
        ctx.quadraticCurveTo((a.x + b.x) / 2, Math.max(a.y, b.y) + sag, b.x, b.y);
      } else {
        // Cambio de fila: el hilo sale por el lado y vuelve a entrar abajo.
        const out = a.x > W / 2 ? 1 : -1;
        const reach = Math.min(cellW * 0.5, MARGIN + 40);
        ctx.bezierCurveTo(a.x + out * reach, a.y + 30, b.x + out * reach, b.y - 30, b.x, b.y);
      }
    }
    const last = slots[slots.length - 1];
    const end = last.x > W / 2 ? W - MARGIN * 0.4 : MARGIN * 0.4;
    ctx.quadraticCurveTo((last.x + end) / 2, last.y + sag * 0.6, end, last.y - 40);
  };

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  path();
  ctx.strokeStyle = TWINE;
  ctx.lineWidth = 6;
  ctx.stroke();
  path();
  ctx.strokeStyle = TWINE_LIGHT;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 14]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPolaroid(
  ctx: CanvasRenderingContext2D,
  {
    slot,
    size,
    image,
    color,
    number,
    name,
    detail,
    font,
  }: {
    slot: Slot;
    size: number;
    image: HTMLImageElement | null;
    color: string;
    number?: number;
    name: string;
    detail: string | null;
    font: Font;
  },
) {
  const border = size * 0.06;
  const side = size - border * 2;
  const height = size * 1.22;

  ctx.save();
  ctx.translate(slot.x, slot.y);
  ctx.rotate(slot.angle);

  ctx.shadowColor = "rgba(40,30,15,0.22)";
  ctx.shadowBlur = size * 0.06;
  ctx.shadowOffsetY = size * 0.02;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-size / 2, 10, size, height);
  ctx.shadowColor = "transparent";

  const photoX = -size / 2 + border;
  const photoY = 10 + border;
  if (image) drawCover(ctx, image, photoX, photoY, side, side);
  else {
    ctx.fillStyle = "#e9e4d8";
    ctx.fillRect(photoX, photoY, side, side);
  }

  // Pie: número del lugar en el color del día y su nombre.
  const captionTop = photoY + side;
  const captionH = height - side - border;
  const nameSize = size * 0.072;
  const badgeR = size * 0.05;
  let textX = photoX;
  const lineY = captionTop + captionH * (detail ? 0.4 : 0.55);
  if (number !== undefined) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(photoX + badgeR, lineY - nameSize * 0.32, badgeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = font(700, badgeR * 1.15);
    ctx.textAlign = "center";
    ctx.fillText(String(number), photoX + badgeR, lineY - nameSize * 0.32 + badgeR * 0.4);
    ctx.textAlign = "left";
    textX += badgeR * 2 + size * 0.03;
  }
  ctx.fillStyle = INK;
  ctx.font = font(700, nameSize);
  ctx.fillText(fitText(ctx, name, photoX + side - textX), textX, lineY);
  if (detail) {
    ctx.fillStyle = MUTED;
    ctx.font = font(400, size * 0.05);
    ctx.fillText(fitText(ctx, detail, side), photoX, lineY + size * 0.075);
  }

  // Pinza de madera.
  const pinW = size * 0.06;
  const pinH = size * 0.16;
  ctx.fillStyle = WOOD;
  ctx.fillRect(-pinW / 2, -pinH * 0.35, pinW, pinH);
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(-pinW / 2, pinH * 0.12, pinW, pinH * 0.06);
  ctx.restore();
}

function drawDayTag(
  ctx: CanvasRenderingContext2D,
  slot: Slot,
  text: string,
  color: string,
  size: number,
  font: Font,
) {
  const fontSize = Math.max(28, size * 0.07);
  ctx.font = font(700, fontSize);
  const w = ctx.measureText(text).width + fontSize * 1.2;
  const h = fontSize * 1.7;
  const x = slot.x - w / 2;
  const y = slot.y - h - fontSize * 0.9;
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(text, slot.x, y + h / 2 + fontSize * 0.36);
  ctx.textAlign = "left";
}

async function drawRouteMap(
  ctx: CanvasRenderingContext2D,
  photos: TripPhoto[],
  numbers: Map<string, number>,
  placesById: Map<string, Place>,
  colorOf: (p: TripPhoto) => string,
  font: Font,
) {
  const x = MARGIN;
  const y = MAP_TOP;
  const w = W - MARGIN * 2;
  const h = MAP_H;

  // El recorrido: los lugares en el orden en que se fotografiaron.
  const stops: { place: Place; color: string; number: number }[] = [];
  for (const photo of photos) {
    const place = photo.place_id ? placesById.get(photo.place_id) : undefined;
    if (!place || stops.some((s) => s.place.id === place.id)) continue;
    stops.push({ place, color: colorOf(photo), number: numbers.get(place.id)! });
  }

  // Marco blanco, como una foto impresa.
  ctx.save();
  ctx.shadowColor = "rgba(40,30,15,0.16)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x - 16, y - 16, w + 32, h + 32, 34);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, x, y, w, h, 22);
  ctx.clip();
  ctx.fillStyle = "#e8eef0";
  ctx.fillRect(x, y, w, h);
  if (stops.length === 0) {
    ctx.restore();
    return;
  }

  const view = computeMapView(stops.map((s) => s.place), w, h, 16);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const map = apiKey ? await fetchStaticMap(view, apiKey) : null;
  if (map) {
    ctx.drawImage(map, x, y, w, h);
    ctx.fillStyle = PAPER;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  }
  const project = (p: Place) => {
    const point = view.project(p);
    return { x: x + point.x, y: y + point.y };
  };

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 1; i < stops.length; i++) {
    const a = project(stops[i - 1].place);
    const b = project(stops[i].place);
    const sameDay = stops[i - 1].color === stops[i].color;
    ctx.setLineDash(sameDay ? [] : [14, 14]);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = stops[i].color;
    ctx.lineWidth = 7;
    ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const stop of stops) {
    const { x: px, y: py } = project(stop.place);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(px, py, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = stop.color;
    ctx.beginPath();
    ctx.arc(px, py, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = font(700, 26);
    ctx.textAlign = "center";
    ctx.fillText(String(stop.number), px, py + 9);
    ctx.textAlign = "left";
  }
  ctx.restore();
}

/** Recorta la imagen para llenar el hueco sin deformarla, como object-fit: cover. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
