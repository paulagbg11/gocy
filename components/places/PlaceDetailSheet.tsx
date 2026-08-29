"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { PlaceForm } from "./PlaceForm";
import type { Place } from "@/lib/supabase/types";

export function PlaceDetailSheet({ tripId, places }: { tripId: string; places: Place[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const placeId = searchParams.get("place");
  const place = places.find((p) => p.id === placeId) ?? null;

  const close = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("place");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <Sheet open={!!place} onClose={close} title={place?.name}>
      {place && <PlaceForm tripId={tripId} editing={place} onDone={close} />}
    </Sheet>
  );
}
