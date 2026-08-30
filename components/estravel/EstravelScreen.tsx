"use client";

import { Fragment, useMemo, useState } from "react";
import { Map, Marker, Polyline } from "@vis.gl/react-google-maps";
import { Download, Footprints, Loader2 } from "lucide-react";
import { useTrip, useTripDays } from "@/lib/queries/trips";
import { usePlaces } from "@/lib/queries/places";
import { usePlaceDayLinks } from "@/lib/queries/place-day-links";
import { useTrackPoints } from "@/lib/queries/track-points";
import { useCategoriesById } from "@/lib/queries/categories";
import { buildRoute, dayColor } from "@/lib/estravel/buildRoute";
import { useRoutedPath } from "@/lib/estravel/useRoutedPath";
import { renderRouteImage, type RouteImageMode, type DrawablePath } from "@/lib/estravel/renderRouteImage";
import { shareOrDownloadImage } from "@/lib/estravel/shareImage";
import { formatDistance, type LatLng } from "@/lib/geo";
import { formatDateRange } from "@/lib/dates";
import { MapProvider } from "@/components/map/MapProvider";
import { MapResizeFix } from "@/components/map/MapResizeFix";
import { FitBounds } from "@/components/map/FitBounds";
import { CategoryPin } from "@/components/map/CategoryPin";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";
import { MUTED_MAP_STYLE } from "./mapStyle";

const DEFAULT_CENTER = { lat: 40.4168, lng: -3.7038 };
const ACCENT = "#2f6f7e";

const endpointIcon = (fill: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
       <circle cx="10" cy="10" r="8" fill="#ffffff"/>
       <circle cx="10" cy="10" r="5.5" fill="${fill}"/>
     </svg>`,
  )}`;

/**
 * El proveedor de Google Maps envuelve TODA la pantalla, no solo el mapa:
 * useRoutedPath necesita el contexto de la API para pedir la ruta a pie, y
 * desde fuera del proveedor nunca llegaba a ejecutarse.
 */
export function EstravelScreen({ tripId }: { tripId: string }) {
  return (
    <MapProvider>
      <EstravelContent tripId={tripId} />
    </MapProvider>
  );
}

function EstravelContent({ tripId }: { tripId: string }) {
  const { data: trip } = useTrip(tripId);
  const { data: days = [] } = useTripDays(tripId);
  const { data: places = [] } = usePlaces(tripId);
  const { data: links = [] } = usePlaceDayLinks(tripId);
  const { data: trackPoints = [] } = useTrackPoints(tripId);
  const categoriesById = useCategoriesById();

  const [mode, setMode] = useState<RouteImageMode>("full");
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const route = useMemo(
    () => buildRoute({ trackPoints, places, links, days }),
    [trackPoints, places, links, days],
  );

  const { days: routedDays, status: routingStatus } = useRoutedPath(route);

  // Lo que se pinta: los tramos de cada día siguiendo calles, más los saltos
  // entre días (tren, avión) en discontinuo.
  const drawablePaths = useMemo<DrawablePath[]>(() => {
    const paths: DrawablePath[] = [];

    if (routedDays.length > 0) {
      for (const day of routedDays) {
        paths.push({ dayIndex: day.dayIndex, path: day.path, dashed: false });
      }
    } else {
      // Mientras la ruta por calles no esté lista (o no esté disponible), se
      // dibuja igualmente el recorrido recto: la pantalla nunca queda vacía.
      for (const segment of route.segments) {
        if (segment.isTransport) continue;
        paths.push({
          dayIndex: segment.dayIndex,
          path: [
            { lat: segment.from.lat, lng: segment.from.lng },
            { lat: segment.to.lat, lng: segment.to.lng },
          ],
          dashed: false,
        });
      }
    }

    for (const segment of route.segments) {
      if (!segment.isTransport) continue;
      paths.push({
        dayIndex: segment.dayIndex,
        path: [
          { lat: segment.from.lat, lng: segment.from.lng },
          { lat: segment.to.lat, lng: segment.to.lng },
        ],
        dashed: true,
      });
    }
    return paths;
  }, [routedDays, route.segments]);

  const allPoints = useMemo<LatLng[]>(
    () => route.points.map((p) => ({ lat: p.lat, lng: p.lng })),
    [route.points],
  );

  const visitedPlaces = useMemo(() => {
    const ids = new Set(links.map((l) => l.place_id));
    return places.filter((p) => ids.has(p.id));
  }, [links, places]);

  const canRenderImage = route.points.length >= 2;

  const handleShare = async () => {
    if (!trip || !canRenderImage) return;
    setSharing(true);
    setShareError(null);
    try {
      const dataUrl = renderRouteImage({
        paths: drawablePaths,
        stops: mode === "clean" ? [] : visitedPlaces.map((p) => ({ lat: p.lat, lng: p.lng })),
        mode,
        route,
        tripName: trip.name,
        dateRange: formatDateRange(trip.start_date, trip.end_date),
      });
      if (!dataUrl) {
        setShareError("No se pudo generar la imagen.");
        return;
      }
      const filename = `${trip.name.replace(/[^\w\s-]/g, "").trim() || "viaje"}.png`;
      const result = await shareOrDownloadImage(dataUrl, filename);
      if (result === "failed") setShareError("No se pudo guardar la imagen.");
    } finally {
      setSharing(false);
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

  const start = allPoints[0];
  const end = allPoints[allPoints.length - 1];

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
          onClick={handleShare}
          disabled={!canRenderImage || sharing}
          aria-label="Guardar o compartir la imagen del recorrido"
          className="shrink-0"
        >
          {sharing ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Imagen
        </Button>
      </div>

      <div className="flex-[3] min-h-[240px]">
          <Map
            className="h-full w-full"
            defaultCenter={DEFAULT_CENTER}
            defaultZoom={12}
            gestureHandling="greedy"
            disableDefaultUI
            styles={MUTED_MAP_STYLE}
          >
            <MapResizeFix />
            <FitBounds points={allPoints} />

            {drawablePaths.map((item, i) => {
              const color = mode === "days" ? dayColor(item.dayIndex) : ACCENT;
              if (item.dashed) {
                return (
                  <Polyline
                    key={`dash-${i}`}
                    path={item.path}
                    strokeColor={color}
                    strokeOpacity={0.25}
                    strokeWeight={3}
                  />
                );
              }
              return (
                // Dos líneas superpuestas: una blanca debajo hace de borde y
                // despega el trazado del mapa, como en Strava.
                <Fragment key={`solid-${i}`}>
                  <Polyline path={item.path} strokeColor="#ffffff" strokeOpacity={0.9} strokeWeight={9} />
                  <Polyline path={item.path} strokeColor={color} strokeOpacity={1} strokeWeight={5} />
                </Fragment>
              );
            })}

            {start && <Marker position={start} icon={{ url: endpointIcon("#4f7a68") }} title="Inicio" />}
            {end && <Marker position={end} icon={{ url: endpointIcon("#bd6248") }} title="Final" />}

            {mode !== "clean" &&
              visitedPlaces.map((place) => (
                <CategoryPin
                  key={place.id}
                  place={place}
                  category={categoriesById.get(place.category_id)}
                />
              ))}
        </Map>
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

        {shareError && <p className="text-xs text-danger mb-2">{shareError}</p>}

        {!canRenderImage && (
          <p className="text-xs text-muted-foreground mb-2">
            Con un solo punto todavía no hay trazado. Asigna algún lugar más a los días del
            viaje (o activa la ubicación) y podrás guardar la imagen.
          </p>
        )}

        {routingStatus === "loading" && (
          <p className="text-xs text-muted-foreground mb-2">Calculando el recorrido por las calles…</p>
        )}

        {routingStatus === "unavailable" && (
          <p className="text-xs text-muted-foreground mb-2">
            El recorrido se muestra en línea recta. Para que siga las calles hay que habilitar la
            <strong className="font-medium"> Routes API</strong> en Google Cloud y permitirla en la
            clave de la app.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {route.source === "gps"
            ? "Recorrido aproximado: se registra mientras tenéis la app abierta durante el viaje. Los trazos discontinuos son desplazamientos en transporte."
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
