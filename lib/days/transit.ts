import type { Category, TransitMode, TransitStep } from "@/lib/supabase/types";

export const TRANSIT_MODES: { value: TransitMode; label: string; emoji: string }[] = [
  { value: "metro", label: "Metro", emoji: "🚇" },
  { value: "train", label: "Tren", emoji: "🚆" },
  { value: "bus", label: "Bus", emoji: "🚌" },
  { value: "tram", label: "Tranvía", emoji: "🚊" },
  { value: "boat", label: "Barco", emoji: "⛴️" },
  { value: "walk", label: "A pie", emoji: "🚶" },
];

export const transitModeInfo = (mode: TransitMode) =>
  TRANSIT_MODES.find((m) => m.value === mode) ?? TRANSIT_MODES[0];

/**
 * Colores para las líneas. No son los de ninguna ciudad en concreto: basta
 * con poder poner "la azul clarito" y reconocerla de un vistazo en el andén.
 */
export const LINE_COLORS = [
  "#0098D4", // azul claro
  "#1C3F94", // azul oscuro
  "#00843D", // verde
  "#7DC242", // verde claro
  "#E32017", // rojo
  "#EE7C0E", // naranja
  "#FFD329", // amarillo
  "#9B0056", // granate
  "#F3A9BB", // rosa
  "#894E24", // marrón
  "#A0A5A9", // gris
  "#1F1E1B", // negro
];

/** Color por defecto de cada tipo de transporte, si no se elige otro. */
const DEFAULT_MODE_COLOR: Record<TransitMode, string> = {
  metro: "#1C3F94",
  train: "#00843D",
  bus: "#E32017",
  tram: "#7DC242",
  boat: "#0098D4",
  walk: "#A0A5A9",
};

export const stepColor = (step: TransitStep) => step.color ?? DEFAULT_MODE_COLOR[step.mode];

/** Los colores claros (amarillo, rosa…) llevan el texto oscuro para que se lea. */
export function textOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1F1E1B" : "#FFFFFF";
}

const TRANSPORT_EMOJIS = ["✈", "🚆", "🚇", "🚉", "🚊", "🚄", "🚅", "🚈", "🚝", "🚌", "🚍", "⛴", "🚢", "🚋", "🚃"];
const TRANSPORT_WORDS = /aeropuerto|tren|metro|estaci[oó]n|transporte|bus|tranv[ií]a|ferry|barco|parada/i;

/**
 * ¿Es una parada de transporte (aeropuerto, estación…)? En esas la hoja de la
 * parada abre ya con el apartado de trayecto a la vista; en el resto está
 * plegado, por si acaso.
 */
export function isTransportCategory(category: Category | undefined) {
  if (!category) return false;
  return (
    TRANSPORT_EMOJIS.some((e) => category.emoji?.includes(e)) || TRANSPORT_WORDS.test(category.name)
  );
}

/** Quita los campos vacíos y los tramos sin nada escrito, para no guardar basura. */
export function cleanSteps(steps: TransitStep[]): TransitStep[] | null {
  const cleaned = steps
    .map((step) => {
      const out: TransitStep = { mode: step.mode };
      for (const key of ["line", "color", "direction", "from", "to", "platform", "note"] as const) {
        const value = step[key]?.trim();
        if (value) out[key] = value;
      }
      if (step.stops && step.stops > 0) out.stops = step.stops;
      if (step.minutes && step.minutes > 0) out.minutes = step.minutes;
      return out;
    })
    .filter((step) => Object.keys(step).length > 1 || step.mode === "walk");
  return cleaned.length > 0 ? cleaned : null;
}
