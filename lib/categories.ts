export const FALLBACK_CATEGORY_COLOR = "#78766e";
export const FALLBACK_CATEGORY_EMOJI = "📍";

function hslToHex(h: number, s: number, l: number) {
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/**
 * Los tres tonos con los que se pinta una categoría en toda la app (pines de
 * los mapas, listas de Días, Por decidir, Estravel), sacados de su color:
 * `fill` es el pastel de fondo, `edge` el borde o el punto que lo acompaña e
 * `ink` el texto que va encima.
 *
 * Se conserva el matiz y se sube la saturación: los colores guardados son
 * bastante apagados y, aclarados sin más, quedaban todos grisáceos. Devuelve
 * hex y no un color-mix de CSS porque también se usa dentro del SVG del pin.
 */
export function categoryTones(hex: string): { fill: string; edge: string; ink: string } {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  // Un gris (la categoría sin color) se queda gris: no tiene matiz que avivar.
  const vivid = s < 0.08 ? s : Math.min(1, s * 1.5 + 0.2);
  return {
    fill: hslToHex(h, vivid, 0.84),
    edge: hslToHex(h, vivid, 0.58),
    ink: hslToHex(h, Math.min(vivid, 0.65), 0.27),
  };
}

/** Data-URI SVG "gota" de color con el emoji de la categoría, para usar como icono de google.maps.Marker. */
export function categoryPinDataUrl(emoji: string, color: string, selected = false): string {
  const scale = selected ? 1.15 : 1;
  const { fill, edge } = categoryTones(color);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${34 * scale}" height="${44 * scale}" viewBox="0 0 34 44">
      <g transform="translate(1 1) scale(0.941)">
        <path d="M17 0C7.6 0 0 7.6 0 17c0 12.4 17 27 17 27s17-14.6 17-27C34 7.6 26.4 0 17 0z" fill="${fill}" stroke="${edge}" stroke-width="1.8"/>
      </g>
      <circle cx="17" cy="17" r="9" fill="white" fill-opacity="0.92"/>
      <text x="17" y="17" font-size="13" text-anchor="middle" dominant-baseline="central">${emoji}</text>
    </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
