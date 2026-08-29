import { redirect } from "next/navigation";

export default async function TripIndexPage({ params }: PageProps<"/trips/[tripId]">) {
  const { tripId } = await params;
  redirect(`/trips/${tripId}/map`);
}
