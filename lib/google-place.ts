/**
 * Enlace a la ficha del lugar en Google Maps; en el móvil abre la app de Maps.
 *
 * Es un enlace normal, no una llamada a la API, así que no gasta cuota ni
 * cuesta nada. Las fotos y valoraciones de Google (Places API) sí se facturan,
 * y por eso no se piden desde la app.
 */
export function googleMapsUrl(place: {
  name: string;
  lat: number;
  lng: number;
  google_place_id: string | null;
}) {
  const params = new URLSearchParams({ api: "1" });
  if (place.google_place_id) {
    params.set("query", place.name);
    params.set("query_place_id", place.google_place_id);
  } else {
    params.set("query", `${place.lat},${place.lng}`);
  }
  return `https://www.google.com/maps/search/?${params.toString()}`;
}
