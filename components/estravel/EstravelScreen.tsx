"use client";

import { useMemo, useState } from "react";
import { Map, Polyline } from "@vis.gl/react-google-maps";
import { Download, Footprints } from "lucide-react";
import { useTrip, useTripDays } from "@/lib/queries/trips";
import { usePlaces } from "@/lib/queries/places";
import { usePlaceDayLinks } from "@/lib/queries/place-day-links";
import { useTrackPoints } from "@/lib/queries/track-points";
import { useCategoriesById } from "@/lib/queries/categories";
import { buildRoute, dayColor } from "@/lib/estravel/buildRoute";
import { renderRouteImage, downloadDataUrl, type RouteImageMode } from "@/lib/estravel/renderRouteImage";
import { formatDistance } from "@/lib/geo";
import { formatDateRange } from "@/lib/dates";
import { MapProvider } from "@/components/map/MapProvider";
import { MapResizeFix } from "@/components/map/MapResizeFix";
import { FitBounds } from "@/components/map/FitBounds";
import { CategoryPin } from "@/components/map/CategoryPin";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";

const DEFAULT_CENTER = { lat: 40.4168, lng: -3.7038 };
const ACCENT = "#2f6f7e";

export function EstravelScreen({ tripId }: { tripId: string }) {
  const { data: trip } = useTrip(tripId);
  const { data: days = [] } = useTripDays(tripId);
  const { data: places = [] } = usePlaces(tripId);
  const { data: links = [] } = usePlaceDayLinks(tripId);
  const { data: trackPoints = [] } = useTrackPoints(tripId);
  const categoriesById = useCategoriesById();

  const [mode, setMode] = useState<RouteImageMode>("full");

  const route = useMemo(
    () => buildRoute({ trackPoints, places, links, days }),
    [trackPoints, places, links, days],
  );

  const visitedPlaces = useMemo(() => {
    const ids = new Set(links.map((l) => l.place_id));
    return places.filter((p) => ids.has(p.id));
  }, [links, places]);

  // Con un solo punto no hay trazado que dibujar: el botón se desactiva en vez
  // de generar una imagen vacía (o no hacer nada en silencio).
  const canRenderImage = route.points.length >= 2;

  const handleDownload = () => {
    if (!trip || !canRenderImage) return;
    const dataUrl = renderRouteImage({
      route,
      mode,
      tripName: trip.name,
      dateRange: formatDateRange(trip.start_date, trip.end_date),
    });
    if (dataUrl) {
      downloadDataUrl(dataUrl, `${trip.name.replace(/[^\w\s-]/g, "").trim() || "viaje"}.png`);
    }
  };

  if (route.source === "empty") {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
        <Footprints size={32} className="text-muted-foreground" />
        <p className="font-medium">Todavía no hay recorrido</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Aparecerá cuando asignéis lugares a los días del viaje, o cuando la app registre por
          dónde habéis estado con la ubicación activada.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <div className="min-w-0 overflow-x-auto [scrollbar-width:none]">
          <SegmentedControl
            options={[
              { value: "full", label: "Completo" },
              { value: "clean", label: "Limpio" },
              { value: "days", label: "Por días" },
            ]}
            value={mode}
            onChange={(v) => setMode(v as RouteImageMode)}
          />
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleDownload}
          disabled={!canRenderImage}
          aria-label="Descargar imagen del recorrido"
          className="shrink-0"
        >
          <Download size={16} />
          Imagen
        </Button>
      </div>

      <div className="flex-[3] min-h-[240px]">
        <MapProvider>
          <Map
            className="h-full w-full"
            defaultCenter={DEFAULT_CENTER}
            defaultZoom={12}
            gestureHandling="greedy"
            disableDefaultUI
          >
            <MapResizeFix />
            <FitBounds points={route.points.map((p) => ({ lat: p.lat, lng: p.lng }))} />

            {route.segments.map((segment, i) => (
              <Polyline
                key={i}
                path={[
                  { lat: segment.from.lat, lng: segment.from.lng },
                  { lat: segment.to.lat, lng: segment.to.lng },
                ]}
                strokeColor={mode === "days" ? dayColor(segment.dayIndex) : ACCENT}
                strokeOpacity={segment.isTransport ? 0.3 : 0.9}
                strokeWeight={segment.isTransport ? 2 : 4}
              />
            ))}

            {mode !== "clean" &&
              visitedPlaces.map((place) => (
                <CategoryPin
                  key={place.id}
                  place={place}
                  category={categoriesById.get(place.category_id)}
                />
              ))}
          </Map>
        </MapProvider>
      </div>

      <div className="flex-[2] min-h-0 overflow-y-auto px-4 py-3">
        {mode === "full" && (
          <div className="flex gap-3 mb-3">
            <Stat value={String(route.dayCount || "—")} label={route.dayCount === 1 ? "día" : "días"} />
            <Stat
              value={String(route.placeCount)}
              label={route.placeCount === 1 ? "lugar" : "lugares"}
            />
            <Stat
              value={formatDistance(route.walkingMeters)}
              label={route.source === "gps" ? "aprox. a pie" : "entre paradas"}
            />
          </div>
        )}

        {mode === "days" && (
          <div className="flex flex-wrap gap-2 mb-3">
            {days.map((day) => (
              <span
                key={day.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs font-medium shadow-[var(--shadow-sm)]"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: dayColor(day.day_index) }}
                />
                Día {day.day_index}
              </span>
            ))}
          </div>
        )}

        {!canRenderImage && (
          <p className="text-xs text-muted-foreground mb-2">
            Con un solo punto todavía no hay trazado. Asigna algún lugar más a los días del
            viaje (o activa la ubicación) y podrás descargar la imagen.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {route.source === "gps"
            ? "Recorrido aproximado: se registra mientras tenéis la app abierta durante el viaje, así que hay tramos sin detalle. Los trazos discontinuos son desplazamientos en transporte."
            : "Recorrido a partir de los lugares que asignasteis a cada día, en su orden. Si activáis la ubicación durante el viaje, aquí saldrá el camino real."}
        </p>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 rounded-[var(--radius-sm)] bg-surface px-3 py-2.5 shadow-[var(--shadow-sm)]">
      <p className="text-lg font-semibold leading-tight tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
