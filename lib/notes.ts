/**
 * Paleta de los papeles del tablón.
 *
 * Solo se guarda el tono; el color real se mezcla con `--surface` en tiempo de
 * pintado, así que el mismo papel sale pastel sobre fondo claro y apagado
 * sobre fondo oscuro sin tener que mantener dos paletas.
 */
export const NOTE_COLORS = [
  { id: "yellow", label: "Amarillo", hue: "#f2c14e" },
  { id: "pink", label: "Rosa", hue: "#e88a9a" },
  { id: "green", label: "Verde", hue: "#6cbf8b" },
  { id: "blue", label: "Azul", hue: "#6aa6d6" },
  { id: "purple", label: "Lila", hue: "#a98ad0" },
  { id: "orange", label: "Naranja", hue: "#ee9a62" },
] as const;

export type NoteColorId = (typeof NOTE_COLORS)[number]["id"];

export const DEFAULT_NOTE_COLOR: NoteColorId = "yellow";

export const noteHue = (color: string) =>
  (NOTE_COLORS.find((c) => c.id === color) ?? NOTE_COLORS[0]).hue;

/** Estilo del papel: tinte sobre la superficie del tema en curso. */
export function notePaper(color: string): React.CSSProperties {
  const hue = noteHue(color);
  return {
    background: `color-mix(in oklab, ${hue} 16%, var(--surface))`,
    borderColor: `color-mix(in oklab, ${hue} 40%, var(--surface))`,
  };
}

/**
 * Normaliza lo que se escriba en el campo de enlace. La gente pega
 * "maps.google.com/..." sin esquema y un href así se interpreta como ruta
 * relativa del propio sitio.
 */
export function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/** Texto corto para enseñar un enlace sin que reviente la tarjeta. */
export function prettyUrl(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    const host = hostname.replace(/^www\./, "");
    return pathname && pathname !== "/" ? `${host}…` : host;
  } catch {
    return url;
  }
}
