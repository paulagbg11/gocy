"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ImagePlus } from "lucide-react";
import { useTrip, useUpdateTrip, useDeleteTrip, useUploadTripCover } from "@/lib/queries/trips";
import { useProfile } from "@/components/profile/ProfileProvider";
import { createClient } from "@/lib/supabase/client";
import { CategoryManager } from "@/components/settings/CategoryManager";
import { useTrackPoints, useDeleteTrack } from "@/lib/queries/track-points";
import { useTrackingPreference } from "@/lib/tracking/useTripTracking";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function TripSettingsPage({ params }: PageProps<"/trips/[tripId]/settings">) {
  const { tripId } = use(params);
  const { data: trip } = useTrip(tripId);
  const updateTrip = useUpdateTrip();
  const deleteTrip = useDeleteTrip();
  const uploadCover = useUploadTripCover();
  const { profiles, renameProfile } = useProfile();
  const router = useRouter();
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ name: "", destination: "", startDate: "", endDate: "" });
  const [saving, setSaving] = useState(false);

  const { enabled: trackingEnabled, setTrackingEnabled } = useTrackingPreference(tripId);
  const { data: trackPoints = [] } = useTrackPoints(tripId);
  const deleteTrack = useDeleteTrack();

  const handleDeleteTrack = async () => {
    if (!confirm("¿Borrar el recorrido registrado de este viaje? No se puede deshacer.")) return;
    await deleteTrack.mutateAsync(tripId);
  };

  const coverUrl = trip?.cover_image_path
    ? createClient().storage.from("trip-covers").getPublicUrl(trip.cover_image_path).data.publicUrl
    : null;

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
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4 max-w-md mx-auto w-full">
      <Link
        href={`/trips/${tripId}/map`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 w-fit"
      >
        <ArrowLeft size={16} /> Volver
      </Link>
      <h1 className="text-xl font-semibold mb-5">Ajustes del viaje</h1>

      <div className="flex flex-col gap-4">
        <div>
          <Label>Portada</Label>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadCover.mutate({ tripId, file });
            }}
          />
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            disabled={uploadCover.isPending}
            className="relative flex h-28 w-full items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-surface-2 text-muted-foreground transition-colors duration-150 ease-out hover:brightness-95"
          >
            {coverUrl && (
              <Image src={coverUrl} alt="" fill sizes="(max-width: 640px) 100vw, 448px" className="object-cover" />
            )}
            {!coverUrl && (
              <span className="flex flex-col items-center gap-1 text-sm">
                {uploadCover.isPending ? (
                  "Subiendo…"
                ) : (
                  <>
                    <ImagePlus size={20} /> Añadir foto
                  </>
                )}
              </span>
            )}
          </button>
        </div>

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
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 min-w-0">
            <Label htmlFor="start_date">Llegada</Label>
            <Input
              id="start_date"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </div>
          <div className="flex-1 min-w-0">
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

      <h2 className="text-sm font-medium text-muted-foreground mb-3">Categorías</h2>
      <CategoryManager tripId={tripId} />

      <hr className="my-6 border-border" />

      <h2 className="text-sm font-medium text-muted-foreground mb-3">Ubicación durante el viaje</h2>
      <div className="flex flex-col gap-3">
        <label className="flex items-start gap-3 rounded-[var(--radius-sm)] bg-surface px-3.5 py-3 shadow-[var(--shadow-sm)]">
          <input
            type="checkbox"
            checked={trackingEnabled}
            onChange={(e) => setTrackingEnabled(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
          />
          <span className="flex-1">
            <span className="block text-sm font-medium">Registrar por dónde pasamos</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              Solo durante los días del viaje y mientras la app está abierta: una web no puede
              hacerlo en segundo plano. Sirve para dibujar el recorrido en Estravel.
            </span>
          </span>
        </label>

        {trackPoints.length > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-surface px-3.5 py-3 shadow-[var(--shadow-sm)]">
            <span className="text-sm">
              {trackPoints.length} {trackPoints.length === 1 ? "punto guardado" : "puntos guardados"}
            </span>
            <Button variant="danger" size="sm" onClick={handleDeleteTrack}>
              Borrar recorrido
            </Button>
          </div>
        )}
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
