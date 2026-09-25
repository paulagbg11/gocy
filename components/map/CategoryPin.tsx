"use client";

import { Marker } from "@vis.gl/react-google-maps";
import { categoryPinDataUrl, FALLBACK_CATEGORY_COLOR, FALLBACK_CATEGORY_EMOJI } from "@/lib/categories";
import type { Category, Place } from "@/lib/supabase/types";

/** Más allá de esto el nombre tapa demasiado mapa; el completo sale al pulsar. */
const MAX_NAME_LENGTH = 24;

const shortName = (name: string) =>
  name.length > MAX_NAME_LENGTH ? `${name.slice(0, MAX_NAME_LENGTH - 1).trimEnd()}…` : name;

interface CategoryPinProps {
  place: Place;
  category?: Category;
  order?: number;
  selected?: boolean;
  /** Pinta el nombre del sitio debajo de la gota. */
  showName?: boolean;
  onClick?: () => void;
}

export function CategoryPin({ place, category, order, selected, showName, onClick }: CategoryPinProps) {
  const emoji = category?.emoji ?? FALLBACK_CATEGORY_EMOJI;
  const color = category?.color ?? FALLBACK_CATEGORY_COLOR;
  const pinScale = selected ? 1.15 : 1;

  // El número de orden va dentro de la gota; el nombre, debajo. Un Marker solo
  // admite una etiqueta, así que el orden tiene prioridad.
  const label: google.maps.MarkerLabel | undefined = order
    ? { text: String(order), color: "#ffffff", fontSize: "11px", fontWeight: "700" }
    : showName
      ? { text: shortName(place.name), className: "pin-name", color: "#1f1e1b", fontSize: "12px", fontWeight: "600" }
      : undefined;

  return (
    <Marker
      position={{ lat: place.lat, lng: place.lng }}
      title={place.name}
      icon={{
        url: categoryPinDataUrl(emoji, color, selected),
        // La gota mide 34×44 (un 15 % más si está seleccionada): la etiqueta
        // se centra 10 px por debajo de la punta.
        labelOrigin:
          !order && showName
            ? new google.maps.Point(17 * pinScale, 44 * pinScale + 10)
            : undefined,
      }}
      label={label}
      onClick={onClick}
      zIndex={selected ? 999 : undefined}
    />
  );
}
