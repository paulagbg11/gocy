"use client";

import { Marker } from "@vis.gl/react-google-maps";
import { categoryPinDataUrl, FALLBACK_CATEGORY_COLOR, FALLBACK_CATEGORY_EMOJI } from "@/lib/categories";
import type { Category, Place } from "@/lib/supabase/types";

interface CategoryPinProps {
  place: Place;
  category?: Category;
  order?: number;
  selected?: boolean;
  onClick?: () => void;
}

export function CategoryPin({ place, category, order, selected, onClick }: CategoryPinProps) {
  const emoji = category?.emoji ?? FALLBACK_CATEGORY_EMOJI;
  const color = category?.color ?? FALLBACK_CATEGORY_COLOR;

  return (
    <Marker
      position={{ lat: place.lat, lng: place.lng }}
      title={place.name}
      icon={{ url: categoryPinDataUrl(emoji, color, selected) }}
      label={
        order
          ? { text: String(order), color: "#ffffff", fontSize: "11px", fontWeight: "700" }
          : undefined
      }
      onClick={onClick}
      zIndex={selected ? 999 : undefined}
    />
  );
}
