export const FALLBACK_CATEGORY_COLOR = "#78766e";
export const FALLBACK_CATEGORY_EMOJI = "📍";

/** Data-URI SVG "gota" de color con el emoji de la categoría, para usar como icono de google.maps.Marker. */
export function categoryPinDataUrl(emoji: string, color: string, selected = false): string {
  const scale = selected ? 1.15 : 1;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${34 * scale}" height="${44 * scale}" viewBox="0 0 34 44">
      <path d="M17 0C7.6 0 0 7.6 0 17c0 12.4 17 27 17 27s17-14.6 17-27C34 7.6 26.4 0 17 0z" fill="${color}"/>
      <circle cx="17" cy="17" r="9" fill="white" fill-opacity="0.92"/>
      <text x="17" y="17" font-size="13" text-anchor="middle" dominant-baseline="central">${emoji}</text>
    </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
