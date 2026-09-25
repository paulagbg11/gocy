"use client";

import { Marker } from "@vis.gl/react-google-maps";
import { categoryPinDataUrl, FALLBACK_CATEGORY_COLOR, FALLBACK_CATEGORY_EMOJI } from "@/lib/categories";
import type { Category, Place } from "@/lib/supabase/types";

/**
 * A partir de este zoom (unos pocos barrios a la vista) los pines llevan el
 * nombre debajo. Más alejado, con todo el viaje a la vista, los nombres se
 * pisarían entre sí.
 */
export const NAMES_MIN_ZOOM = 14;

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

  // La gota lleva siempre el emoji de la categoría. El número de orden y el
  // nombre van en la pastilla de debajo ("3 · Big Ben", o solo "3"): un Marker
  // admite una sola etiqueta, y cuando el número iba dentro de la gota se
  // perdía el icono de la categoría.
  const labelText = order
    ? showName
      ? `${order} · ${shortName(place.name)}`
      : String(order)
    : showName
      ? shortName(place.name)
      : null;
  const label: google.maps.MarkerLabel | undefined = labelText
    ? {
        text: labelText,
        className: "pin-name",
        color: "#1f1e1b",
        fontSize: "12px",
        fontWeight: showName ? "600" : "700",
      }
    : undefined;

  return (
    <Marker
      position={{ lat: place.lat, lng: place.lng }}
      title={place.name}
      icon={{
        url: categoryPinDataUrl(emoji, color, selected),
        // La gota mide 34×44 (un 15 % más si está seleccionada): la pastilla
        // se centra 10 px por debajo de la punta.
        labelOrigin: labelText ? new google.maps.Point(17 * pinScale, 44 * pinScale + 10) : undefined,
      }}
      label={label}
      onClick={onClick}
      zIndex={selected ? 999 : undefined}
    />
  );
}
