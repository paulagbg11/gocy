"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useVisibleCategories } from "@/lib/queries/categories";
import { useCreatePlace, useUpdatePlace, useDeletePlace } from "@/lib/queries/places";
import { useTripDays } from "@/lib/queries/trips";
import { nextOrderInDay, useAssignPlaceToDay, usePlaceDayLinks } from "@/lib/queries/place-day-links";
import { useProfile } from "@/components/profile/ProfileProvider";
import { CategoryPicker } from "@/components/categories/CategoryPicker";
import { Chip } from "@/components/ui/Chip";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Star } from "lucide-react";
import clsx from "clsx";
import { ESSENTIAL_MIGRATION_HINT, isMissingEssentialColumn } from "@/lib/places";
import type { Place } from "@/lib/supabase/types";
import type { SelectedPlace } from "@/components/map/PlaceSearchBox";

/**
 * Violación de unicidad de Postgres. Con el índice de 0009, dos móviles que
 * guarden el mismo sitio a la vez llegan aquí: el aviso de la pantalla del
 * mapa no puede cubrir esa carrera, pero el mensaje sí tiene que ser legible.
 */
const isDuplicateError = (err: unknown) =>
  typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";

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
  /** Con el lugar ya guardado, justo antes de onDone. */
  onCreated?: (place: Place) => void;
  /** Tras borrar; si no se pasa, se usa onDone. */
  onDeleted?: () => void;
}

export function PlaceForm({ tripId, editing, fromSearch, onDone, onCreated, onDeleted }: PlaceFormProps) {
  const { activeProfile } = useProfile();
  const createPlace = useCreatePlace();
  const updatePlace = useUpdatePlace();
  const deletePlace = useDeletePlace();
  const visibleCategories = useVisibleCategories(tripId);
  const [serverError, setServerError] = useState<string | null>(null);
  // Al guardar un lugar nuevo se puede meter ya en un día, sin pasar luego por
  // la pestaña Días. null = todavía sin día.
  const { data: days = [] } = useTripDays(tripId);
  const { data: links = [] } = usePlaceDayLinks(tripId);
  const assignToDay = useAssignPlaceToDay();
  const [dayId, setDayId] = useState<string | null>(null);
  const [essential, setEssential] = useState(editing?.essential ?? false);

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
        await updatePlace.mutateAsync({
          id: editing.id,
          trip_id: tripId,
          ...values,
          // Solo si cambia: así, sin la migración 0013, editar lo demás sigue
          // funcionando.
          ...(essential !== (editing.essential ?? false) ? { essential } : {}),
        });
      } else if (fromSearch) {
        const created = await createPlace.mutateAsync({
          trip_id: tripId,
          name: values.name,
          category_id: values.category_id,
          notes: values.notes || null,
          ...(essential ? { essential } : {}),
          lat: fromSearch.lat,
          lng: fromSearch.lng,
          address: fromSearch.address ?? null,
          google_place_id: fromSearch.placeId ?? null,
          created_by: activeProfile?.id ?? null,
        });
        if (dayId) {
          try {
            await assignToDay.mutateAsync({
              trip_id: tripId,
              place_id: created.id,
              day_id: dayId,
              order_in_day: nextOrderInDay(links, dayId),
            });
          } catch {
            // El lugar ya está guardado: no se puede reintentar el formulario
            // entero o saldría como duplicado.
            alert("El lugar se ha guardado, pero no se ha podido añadir al día. Añádelo desde la pestaña Días.");
          }
        }
        onCreated?.(created);
      }
      onDone();
    } catch (err) {
      if (isDuplicateError(err)) setServerError("Ese lugar ya está guardado en este viaje.");
      else if (isMissingEssentialColumn(err)) setServerError(ESSENTIAL_MIGRATION_HINT);
      else setServerError(err instanceof Error ? err.message : "No se pudo guardar");
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!confirm(`¿Borrar "${editing.name}"? También se quitará de los días asignados.`)) return;
    await deletePlace.mutateAsync({ id: editing.id, trip_id: tripId });
    (onDeleted ?? onDone)();
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
            <CategoryPicker
              categories={visibleCategories}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={essential}
        onClick={() => setEssential(!essential)}
        className={clsx(
          "flex items-center gap-3 rounded-[var(--radius-sm)] border px-3.5 py-3 text-left transition-colors duration-150 ease-out",
          essential ? "border-amber-400/60 bg-amber-400/10" : "border-border bg-surface",
        )}
      >
        <Star
          size={20}
          className={clsx("shrink-0", essential ? "fill-amber-400 text-amber-400" : "text-muted-foreground")}
        />
        <span className="flex-1">
          <span className="block text-sm font-medium">Imprescindible</span>
          <span className="block text-xs text-muted-foreground">No nos lo podemos perder</span>
        </span>
      </button>

      {!editing && days.length > 0 && (
        <div>
          <Label>Día</Label>
          <div className="flex flex-wrap gap-2">
            <Chip active={dayId === null} onClick={() => setDayId(null)}>
              Sin día
            </Chip>
            {days.map((day) => (
              <Chip key={day.id} active={dayId === day.id} onClick={() => setDayId(day.id)}>
                Día {day.day_index}
              </Chip>
            ))}
          </div>
        </div>
      )}

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
