"use client";

import { Marker } from "@vis.gl/react-google-maps";
import { categoryPinDataUrl } from "@/lib/categories";
import type { Place } from "@/lib/supabase/types";

interface CategoryPinProps {
  place: Place;
  order?: number;
  selected?: boolean;
  onClick?: () => void;
}

export function CategoryPin({ place, order, selected, onClick }: CategoryPinProps) {
  return (
    <Marker
      position={{ lat: place.lat, lng: place.lng }}
      title={place.name}
      icon={{ url: categoryPinDataUrl(place.category, selected) }}
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
