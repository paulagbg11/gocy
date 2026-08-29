"use client";

import { use } from "react";
import { DaysScreen } from "@/components/days/DaysScreen";

export default function DaysPage({ params }: PageProps<"/trips/[tripId]/days">) {
  const { tripId } = use(params);
  return <DaysScreen tripId={tripId} />;
}
