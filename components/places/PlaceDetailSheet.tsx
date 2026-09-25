"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { PlaceForm } from "./PlaceForm";
import { PlaceView } from "./PlaceView";
import type { Place } from "@/lib/supabase/types";

export function PlaceDetailSheet({ tripId, places }: { tripId: string; places: Place[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const placeId = searchParams.get("place");
  const place = places.find((p) => p.id === placeId) ?? null;

  // Se guarda qué lugar se está editando, no un simple sí/no: así, al abrir
  // otro pin, la ficha vuelve a salir en modo "ver" sin tener que resetear nada.
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = !!place && editingId === place.id;

  const close = () => {
    setEditingId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("place");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <Sheet open={!!place} onClose={close} title={place?.name}>
      {place &&
        (editing ? (
          // Al guardar se vuelve a la ficha; al borrar, se cierra la hoja.
          <PlaceForm
            tripId={tripId}
            editing={place}
            onDone={() => setEditingId(null)}
            onDeleted={close}
          />
        ) : (
          <PlaceView place={place} onEdit={() => setEditingId(place.id)} />
        ))}
    </Sheet>
  );
}
