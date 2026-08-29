"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImagePlus } from "lucide-react";
import { useCreateTrip, useUploadTripCover } from "@/lib/queries/trips";
import { useProfile } from "@/components/profile/ProfileProvider";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const schema = z
  .object({
    name: z.string().min(1, "Ponle un nombre al viaje"),
    destination: z.string().optional(),
    start_date: z.string().min(1, "Falta la fecha de inicio"),
    end_date: z.string().min(1, "Falta la fecha de fin"),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: "La fecha de fin no puede ser antes que la de inicio",
    path: ["end_date"],
  });

type FormValues = z.infer<typeof schema>;

export function TripForm() {
  const router = useRouter();
  const { activeProfile } = useProfile();
  const createTrip = useCreateTrip();
  const uploadCover = useUploadTripCover();
  const [serverError, setServerError] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const handleCoverPick = (file: File | undefined) => {
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const trip = await createTrip.mutateAsync({
        ...values,
        created_by: activeProfile?.id ?? null,
      });
      if (coverFile) {
        await uploadCover.mutateAsync({ tripId: trip.id, file: coverFile });
      }
      router.push(`/trips/${trip.id}/map`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "No se pudo crear el viaje");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div>
        <Label>Portada</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleCoverPick(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-28 w-full items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-surface-2 bg-cover bg-center text-muted-foreground transition-colors duration-150 ease-out hover:brightness-95"
          style={coverPreview ? { backgroundImage: `url(${coverPreview})` } : undefined}
        >
          {!coverPreview && (
            <span className="flex flex-col items-center gap-1 text-sm">
              <ImagePlus size={20} /> Añadir foto
            </span>
          )}
        </button>
      </div>

      <div>
        <Label htmlFor="name">Nombre del viaje</Label>
        <Input id="name" placeholder="Londres 2026" {...register("name")} />
        {errors.name && <p className="text-xs text-danger mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <Label htmlFor="destination">Destino</Label>
        <Textarea id="destination" rows={1} placeholder="Londres, Reino Unido" {...register("destination")} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 min-w-0">
          <Label htmlFor="start_date">Llegada</Label>
          <Input id="start_date" type="date" className="w-full min-w-0" {...register("start_date")} />
          {errors.start_date && <p className="text-xs text-danger mt-1">{errors.start_date.message}</p>}
        </div>
        <div className="flex-1 min-w-0">
          <Label htmlFor="end_date">Salida</Label>
          <Input id="end_date" type="date" className="w-full min-w-0" {...register("end_date")} />
          {errors.end_date && <p className="text-xs text-danger mt-1">{errors.end_date.message}</p>}
        </div>
      </div>

      {serverError && <p className="text-sm text-danger">{serverError}</p>}

      <Button type="submit" size="lg" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? "Creando…" : "Crear viaje"}
      </Button>
    </form>
  );
}
