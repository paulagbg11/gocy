import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { TripDay } from "./supabase/types";

/** Filas trip_days deseadas para un rango [start_date, end_date], sin tocar las que ya existan. */
export function expectedTripDays(startDate: string, endDate: string) {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const count = Math.max(differenceInCalendarDays(end, start) + 1, 1);
  return Array.from({ length: count }, (_, i) => ({
    day_index: i + 1,
    date: format(addDays(start, i), "yyyy-MM-dd"),
  }));
}

/** Filas a insertar y a borrar para que trip_days quede alineado con las fechas del viaje. */
export function diffTripDays(existing: TripDay[], startDate: string, endDate: string) {
  const expected = expectedTripDays(startDate, endDate);
  const existingByIndex = new Map(existing.map((d) => [d.day_index, d]));
  const toInsert = expected.filter((e) => !existingByIndex.has(e.day_index));
  const toDelete = existing.filter((d) => d.day_index > expected.length);
  const toUpdate = expected
    .filter((e) => existingByIndex.get(e.day_index)?.date !== undefined && existingByIndex.get(e.day_index)!.date !== e.date)
    .map((e) => ({ id: existingByIndex.get(e.day_index)!.id, date: e.date }));
  return { toInsert, toDelete, toUpdate };
}

export function formatDayLabel(day: TripDay) {
  const base = format(parseISO(day.date), "EEEE d 'de' MMMM", { locale: es });
  const capitalized = base.charAt(0).toUpperCase() + base.slice(1);
  return day.label ? `${day.label} · ${capitalized}` : capitalized;
}

export function formatShortDate(dateStr: string) {
  return format(parseISO(dateStr), "d MMM", { locale: es });
}

export function formatDateRange(startDate: string, endDate: string) {
  return `${formatShortDate(startDate)} – ${formatShortDate(endDate)}`;
}
