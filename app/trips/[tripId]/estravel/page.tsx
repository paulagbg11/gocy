"use client";

import { use } from "react";
import { EstravelScreen } from "@/components/estravel/EstravelScreen";

export default function EstravelPage({ params }: PageProps<"/trips/[tripId]/estravel">) {
  const { tripId } = use(params);
  return <EstravelScreen tripId={tripId} />;
}
