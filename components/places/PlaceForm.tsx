"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useVisibleCategories } from "@/lib/queries/categories";
import { useCreatePlace, useUpdatePlace, useDeletePlace } from "@/lib/queries/places";
import { useProfile } from "@/components/profile/ProfileProvider";
import { AddCategoryInline } from "@/components/categories/AddCategoryInline";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import type { Place } from "@/lib/supabase/types";
import type { SelectedPlace } from "@/components/map/PlaceSearchBox";

interface FormValues {
  name: string;
  category_id: string;
  notes: string;
}

interface PlaceFormProps {
  tripId: string;
  editing?: Place;
  fromSearch?: SelectedPlace;
  onDone: () => void;
}

export function PlaceForm({ tripId, editing, fromSearch, onDone }: PlaceFormProps) {
  const { activeProfile } = useProfile();
  const createPlace = useCreatePlace();
  const updatePlace = useUpdatePlace();
  const deletePlace = useDeletePlace();
  const visibleCategories = useVisibleCategories(tripId);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, control, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      name: editing?.name ?? fromSearch?.name ?? "",
      category_id: editing?.category_id ?? "",
      notes: editing?.notes ?? "",
    },
  });

  const address = editing?.address ?? fromSearch?.address ?? null;

  const onSubmit = async (values: FormValues) => {
    if (!values.category_id) {
      setServerError("Elige una categoría");
      return;
    }
    setServerError(null);
    try {
      if (editing) {
        await updatePlace.mutateAsync({ id: editing.id, trip_id: tripId, ...values });
      } else if (fromSearch) {
        await createPlace.mutateAsync({
          trip_id: tripId,
          name: values.name,
          category_id: values.category_id,
          notes: values.notes || null,
          lat: fromSearch.lat,
          lng: fromSearch.lng,
          address: fromSearch.address ?? null,
          google_place_id: fromSearch.placeId ?? null,
          created_by: activeProfile?.id ?? null,
        });
      }
      onDone();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "No se pudo guardar");
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!confirm(`¿Borrar "${editing.name}"? También se quitará de los días asignados.`)) return;
    await deletePlace.mutateAsync({ id: editing.id, trip_id: tripId });
    onDone();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" {...register("name", { required: true })} />
        {address && <p className="text-xs text-muted-foreground mt-1">{address}</p>}
      </div>

      <div>
        <Label>Categoría</Label>
        <Controller
          control={control}
          name="category_id"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {visibleCategories.map((cat) => (
                <Chip
                  key={cat.id}
                  type="button"
                  active={field.value === cat.id}
                  color={cat.color}
                  onClick={() => field.onChange(cat.id)}
                >
                  {cat.emoji} {cat.name}
                </Chip>
              ))}
              <AddCategoryInline onCreated={(cat) => field.onChange(cat.id)} />
            </div>
          )}
        />
      </div>

      <div>
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" rows={3} placeholder="Horario, reserva, qué pedir…" {...register("notes")} />
      </div>

      {serverError && <p className="text-sm text-danger">{serverError}</p>}

      <div className="flex gap-2 mt-1">
        {editing && (
          <Button type="button" variant="danger" onClick={handleDelete}>
            Borrar
          </Button>
        )}
        <Button type="submit" size="lg" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? "Guardando…" : editing ? "Guardar cambios" : "Añadir lugar"}
        </Button>
      </div>
    </form>
  );
}
