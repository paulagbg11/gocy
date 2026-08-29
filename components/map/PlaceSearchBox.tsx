"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Search } from "lucide-react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { Input } from "@/components/ui/Input";

export interface SelectedPlace {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  placeId?: string;
}

export function PlaceSearchBox({ onSelect }: { onSelect: (place: SelectedPlace) => void }) {
  const placesLib = useMapsLibrary("places");
  const inputRef = useRef<HTMLInputElement>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;
    const ac = new placesLib.Autocomplete(inputRef.current, {
      fields: ["name", "formatted_address", "geometry", "place_id"],
    });
    setAutocomplete(ac);
    return () => {
      google.maps.event.clearInstanceListeners(ac);
    };
  }, [placesLib]);

  const handleSelect = useCallback(() => {
    if (!autocomplete) return;
    const place = autocomplete.getPlace();
    if (!place.geometry?.location) return;
    onSelect({
      name: place.name ?? inputRef.current?.value ?? "",
      address: place.formatted_address,
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
      placeId: place.place_id,
    });
  }, [autocomplete, onSelect]);

  useEffect(() => {
    if (!autocomplete) return;
    const listener = autocomplete.addListener("place_changed", handleSelect);
    return () => listener.remove();
  }, [autocomplete, handleSelect]);

  return (
    <div className="relative">
      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input ref={inputRef} placeholder="Buscar un lugar…" className="pl-9" />
    </div>
  );
}
