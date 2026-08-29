import {
  Plane,
  BedDouble,
  UtensilsCrossed,
  Coffee,
  Landmark,
  Compass,
  ShoppingBag,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import type { PlaceCategory } from "./supabase/types";

export interface CategoryMeta {
  label: string;
  icon: LucideIcon;
  color: string;
}

export const CATEGORY_META: Record<PlaceCategory, CategoryMeta> = {
  airport: { label: "Aeropuerto", icon: Plane, color: "#5b7a91" },
  lodging: { label: "Alojamiento", icon: BedDouble, color: "#c18a4e" },
  restaurant: { label: "Restaurantes", icon: UtensilsCrossed, color: "#bd6248" },
  cafe: { label: "Cafeterías", icon: Coffee, color: "#8a6a4f" },
  landmark: { label: "Monumentos", icon: Landmark, color: "#4f7a68" },
  activity: { label: "Ocio", icon: Compass, color: "#b98f3a" },
  shopping: { label: "Compras", icon: ShoppingBag, color: "#a5715f" },
  other: { label: "Otros", icon: MapPin, color: "#78766e" },
};

export const CATEGORY_ORDER: PlaceCategory[] = [
  "airport",
  "lodging",
  "restaurant",
  "cafe",
  "landmark",
  "activity",
  "shopping",
  "other",
];

/** Data-URI SVG "gota" de color para usar como icono de google.maps.Marker. */
export function categoryPinDataUrl(category: PlaceCategory, selected = false): string {
  const color = CATEGORY_META[category].color;
  const scale = selected ? 1.15 : 1;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${34 * scale}" height="${44 * scale}" viewBox="0 0 34 44">
      <path d="M17 0C7.6 0 0 7.6 0 17c0 12.4 17 27 17 27s17-14.6 17-27C34 7.6 26.4 0 17 0z" fill="${color}"/>
      <circle cx="17" cy="17" r="8.5" fill="white" fill-opacity="0.92"/>
    </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
