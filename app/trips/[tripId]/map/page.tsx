"use client";

import { use } from "react";
import { MapScreen } from "@/components/map/MapScreen";

export default function MapPage({ params }: PageProps<"/trips/[tripId]/map">) {
  const { tripId } = use(params);
  return <MapScreen tripId={tripId} />;
}
