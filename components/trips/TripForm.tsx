"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateTrip } from "@/lib/queries/trips";
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
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const trip = await createTrip.mutateAsync({
        ...values,
        created_by: activeProfile?.id ?? null,
      });
      router.push(`/trips/${trip.id}/map`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "No se pudo crear el viaje");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="name">Nombre del viaje</Label>
        <Input id="name" placeholder="Londres 2026" {...register("name")} />
        {errors.name && <p className="text-xs text-danger mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <Label htmlFor="destination">Destino</Label>
        <Textarea id="destination" rows={1} placeholder="Londres, Reino Unido" {...register("destination")} />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <Label htmlFor="start_date">Llegada</Label>
          <Input id="start_date" type="date" {...register("start_date")} />
          {errors.start_date && <p className="text-xs text-danger mt-1">{errors.start_date.message}</p>}
        </div>
        <div className="flex-1">
          <Label htmlFor="end_date">Salida</Label>
          <Input id="end_date" type="date" {...register("end_date")} />
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
