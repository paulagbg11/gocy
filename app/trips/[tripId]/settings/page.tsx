"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTrip, useUpdateTrip, useDeleteTrip } from "@/lib/queries/trips";
import { useProfile } from "@/components/profile/ProfileProvider";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function TripSettingsPage({ params }: PageProps<"/trips/[tripId]/settings">) {
  const { tripId } = use(params);
  const { data: trip } = useTrip(tripId);
  const updateTrip = useUpdateTrip();
  const deleteTrip = useDeleteTrip();
  const { profiles, renameProfile } = useProfile();
  const router = useRouter();

  const [form, setForm] = useState({ name: "", destination: "", startDate: "", endDate: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!trip) return;
    // Rellena el formulario editable una vez al cargar el viaje.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      name: trip.name,
      destination: trip.destination ?? "",
      startDate: trip.start_date,
      endDate: trip.end_date,
    });
  }, [trip]);

  const save = async () => {
    setSaving(true);
    try {
      await updateTrip.mutateAsync({
        id: tripId,
        name: form.name,
        destination: form.destination || null,
        start_date: form.startDate,
        end_date: form.endDate,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!trip) return;
    if (!confirm(`¿Borrar el viaje "${trip.name}"? Esto borrará también sus lugares y documentos.`)) return;
    await deleteTrip.mutateAsync(tripId);
    router.replace("/trips");
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 max-w-md mx-auto">
      <Link
        href={`/trips/${tripId}/map`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 w-fit"
      >
        <ArrowLeft size={16} /> Volver
      </Link>
      <h1 className="text-xl font-semibold mb-5">Ajustes del viaje</h1>

      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="destination">Destino</Label>
          <Textarea
            id="destination"
            rows={1}
            value={form.destination}
            onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="start_date">Llegada</Label>
            <Input
              id="start_date"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="end_date">Salida</Label>
            <Input
              id="end_date"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </div>
        </div>
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>

      <hr className="my-6 border-border" />

      <h2 className="text-sm font-medium text-muted-foreground mb-3">Nombres de perfil</h2>
      <div className="flex flex-col gap-2">
        {profiles.map((profile) => (
          <ProfileNameRow key={profile.id} name={profile.name} onSave={(n) => renameProfile(profile.id, n)} />
        ))}
      </div>

      <hr className="my-6 border-border" />

      <Button variant="danger" onClick={handleDelete}>
        Borrar este viaje
      </Button>
    </div>
  );
}

function ProfileNameRow({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  const [value, setValue] = useState(name);
  return (
    <div className="flex gap-2">
      <Input value={value} onChange={(e) => setValue(e.target.value)} />
      <Button
        variant="secondary"
        size="sm"
        onClick={() => value.trim() && value !== name && onSave(value.trim())}
      >
        Guardar
      </Button>
    </div>
  );
}
