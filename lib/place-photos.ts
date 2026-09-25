import { useQuery } from "@tanstack/react-query";
import { distanceMeters } from "./geo";
import type { Place } from "./supabase/types";

/**
 * Fotos de un lugar sacadas de Wikimedia Commons (el banco de imágenes de la
 * Wikipedia). Es gratis y no necesita clave: las fotos de Google (Places API)
 * se facturan por cada foto vista, y en esta app no se paga por nada.
 *
 * Commons no sabe qué es "Sky Garden"; lo que sí sabe es dónde se hizo cada
 * foto. Así que se piden las fotos hechas cerca del pin y se ponen delante las
 * que mencionan el nombre del sitio en el título. Sin eso, en Covent Garden
 * salían primero los bancos de la plaza.
 */

const SEARCH_RADIUS_M = 200;
/** Sin ninguna foto que nombre el sitio, solo se enseñan las muy cercanas. */
const NEARBY_FALLBACK_M = 60;
const MAX_PHOTOS = 8;
const PHOTO_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface PlacePhoto {
  url: string;
  /** Ficha de la foto en Commons: autor y licencia, que hay que citar. */
  pageUrl: string;
  author?: string;
}

export interface PlacePhotos {
  photos: PlacePhoto[];
  /** true si ninguna foto nombra el sitio y son solo "de alrededor". */
  nearbyOnly: boolean;
}

interface CommonsPage {
  title: string;
  coordinates?: { lat: number; lon: number }[];
  imageinfo?: {
    thumburl?: string;
    descriptionurl: string;
    mime: string;
    extmetadata?: { Artist?: { value: string } };
  }[];
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Palabras con peso del nombre: "The", "de" o "St" no dicen nada. */
const nameWords = (name: string) =>
  normalize(name)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !["the", "de", "del", "la", "los", "las"].includes(w));

/** El autor viene como HTML (a menudo un enlace a su perfil): solo el texto. */
const plainText = (html: string) => {
  const text = html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
};

async function fetchPlacePhotos(place: Place): Promise<PlacePhotos> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "geosearch",
    ggsnamespace: "6",
    ggscoord: `${place.lat}|${place.lng}`,
    ggsradius: String(SEARCH_RADIUS_M),
    ggslimit: "40",
    prop: "imageinfo|coordinates",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: "480",
    iiextmetadatafilter: "Artist",
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`);
  if (!res.ok) throw new Error(`Wikimedia ${res.status}`);
  const data: { query?: { pages?: Record<string, CommonsPage> } } = await res.json();

  const words = nameWords(place.name);
  const candidates = Object.values(data.query?.pages ?? [])
    .map((page) => {
      const info = page.imageinfo?.[0];
      const coord = page.coordinates?.[0];
      if (!info?.thumburl || !PHOTO_MIMES.has(info.mime)) return null;
      const title = normalize(page.title);
      return {
        photo: {
          url: info.thumburl,
          pageUrl: info.descriptionurl,
          author: info.extmetadata?.Artist ? plainText(info.extmetadata.Artist.value) : undefined,
        },
        score: words.filter((w) => title.includes(w)).length,
        distance: coord
          ? distanceMeters({ lat: place.lat, lng: place.lng }, { lat: coord.lat, lng: coord.lon })
          : Infinity,
      };
    })
    .filter((c) => c !== null);

  const named = candidates
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.distance - b.distance);
  if (named.length > 0) {
    return { photos: named.slice(0, MAX_PHOTOS).map((c) => c.photo), nearbyOnly: false };
  }

  const nearby = candidates
    .filter((c) => c.distance <= NEARBY_FALLBACK_M)
    .sort((a, b) => a.distance - b.distance);
  return { photos: nearby.slice(0, 4).map((c) => c.photo), nearbyOnly: true };
}

export function usePlacePhotos(place: Place) {
  return useQuery({
    // Van ligadas al punto y al nombre: si se edita cualquiera, se vuelven a buscar.
    queryKey: ["place-photos", place.lat, place.lng, place.name],
    queryFn: () => fetchPlacePhotos(place),
  });
}
