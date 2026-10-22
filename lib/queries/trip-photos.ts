import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { readPhotoMeta } from "@/lib/exif";
import { resizeImage } from "@/lib/images";
import type { QueryClient } from "@tanstack/react-query";
import type { TripPhoto } from "@/lib/supabase/types";

const BUCKET = "trip-photos";
/** Lo bastante grande para verla a pantalla completa o imprimirla en el álbum. */
const PHOTO_MAX = 2048;
const THUMB_MAX = 400;
/** Las URL firmadas duran una hora; se piden de nuevo antes de que caduquen. */
const URL_TTL_S = 60 * 60;

/** Todas las fotos del viaje: el mapa y el álbum las querrán enteras. */
export function useTripPhotos(tripId: string) {
  return useQuery({
    queryKey: ["trip_photos", tripId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("trip_photos")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at");
      if (error) throw error;
      return data as TripPhoto[];
    },
    enabled: !!tripId,
  });
}

/**
 * URL firmadas para unas rutas del bucket, de una sola petición. El bucket es
 * privado como el de adjuntos: una URL pública valdría para cualquiera que la
 * encontrara, y son fotos nuestras.
 */
export function usePhotoUrls(paths: string[]) {
  const sorted = [...paths].sort();
  return useQuery({
    queryKey: ["trip_photo_urls", ...sorted],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(sorted, URL_TTL_S);
      if (error) throw error;
      const urls = new Map<string, string>();
      for (const item of data) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
      return urls;
    },
    enabled: sorted.length > 0,
    staleTime: (URL_TTL_S - 10 * 60) * 1000,
    gcTime: (URL_TTL_S - 5 * 60) * 1000,
  });
}

/**
 * Cambia la lista en caché sin que la pise una lectura que ya iba de camino.
 * Al volver a la app (también al volver de la cámara) useTripRealtime lo pide
 * todo otra vez; si esa lectura sale justo antes de guardar y llega después,
 * trae las fotos como estaban y deshace el cambio. Por eso se cancela, y
 * cuando ya está guardado se vuelve a pedir (`refreshPhotos`).
 */
async function patchPhotos(
  queryClient: QueryClient,
  tripId: string,
  update: (photos: TripPhoto[]) => TripPhoto[],
) {
  await queryClient.cancelQueries({ queryKey: ["trip_photos", tripId] });
  queryClient.setQueryData<TripPhoto[]>(["trip_photos", tripId], (old = []) => update(old));
}

const refreshPhotos = (queryClient: QueryClient, tripId: string) =>
  queryClient.invalidateQueries({ queryKey: ["trip_photos", tripId] });

interface UploadPhotoInput {
  tripId: string;
  placeId: string | null;
  dayId: string | null;
  file: File;
  createdBy: string | null;
}

export function useUploadTripPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tripId, placeId, dayId, file, createdBy }: UploadPhotoInput) => {
      const supabase = createClient();
      // El EXIF primero: al pasar por el canvas desaparece.
      const [meta, photo, thumb] = await Promise.all([
        readPhotoMeta(file),
        resizeImage(file, PHOTO_MAX),
        resizeImage(file, THUMB_MAX),
      ]);

      const id = crypto.randomUUID();
      const ext = (f: File) => (f.type === "image/jpeg" ? "jpg" : (f.name.split(".").pop() ?? "jpg"));
      const storagePath = `${tripId}/${id}.${ext(photo.file)}`;
      const thumbPath = `${tripId}/${id}-thumb.${ext(thumb.file)}`;

      const storage = supabase.storage.from(BUCKET);
      const [photoUpload, thumbUpload] = await Promise.all([
        storage.upload(storagePath, photo.file, { contentType: photo.file.type }),
        storage.upload(thumbPath, thumb.file, { contentType: thumb.file.type }),
      ]);
      const uploadError = photoUpload.error ?? thumbUpload.error;
      if (uploadError) {
        await storage.remove([storagePath, thumbPath]);
        throw uploadError;
      }

      const { data, error } = await supabase
        .from("trip_photos")
        .insert({
          id,
          trip_id: tripId,
          place_id: placeId,
          day_id: dayId,
          storage_path: storagePath,
          thumb_path: thumbPath,
          width: photo.width,
          height: photo.height,
          taken_at: meta.takenAt?.toISOString() ?? null,
          lat: meta.lat,
          lng: meta.lng,
          created_by: createdBy,
        })
        .select()
        .single();
      if (error) {
        // Sin fila, los archivos no los vería nadie: mejor no dejarlos huérfanos.
        await storage.remove([storagePath, thumbPath]);
        throw error;
      }
      return data as TripPhoto;
    },
    // Se añade ya a la caché para verla sin esperar a Realtime, que además
    // descarta la fila repetida al llegar.
    onSuccess: (photo) =>
      patchPhotos(queryClient, photo.trip_id, (old) =>
        old.some((p) => p.id === photo.id) ? old : [...old, photo],
      ),
    onSettled: (_data, _error, { tripId }) => refreshPhotos(queryClient, tripId),
  });
}

export function useUpdateTripPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      caption,
      favorite,
    }: { id: string; trip_id: string } & Partial<Pick<TripPhoto, "caption" | "favorite">>) => {
      const supabase = createClient();
      // Lo que llega undefined no viaja en la petición: solo se toca lo que cambia.
      const { error } = await supabase.from("trip_photos").update({ caption, favorite }).eq("id", id);
      if (error) throw error;
    },
    onMutate: ({ id, trip_id, ...patch }) =>
      patchPhotos(queryClient, trip_id, (old) => old.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    // También si falla: así vuelve a lo que de verdad hay guardado.
    onSettled: (_data, _error, { trip_id }) => refreshPhotos(queryClient, trip_id),
  });
}

export function useDeleteTripPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (photo: TripPhoto) => {
      const supabase = createClient();
      const { error } = await supabase.from("trip_photos").delete().eq("id", photo.id);
      if (error) throw error;
      await supabase.storage.from(BUCKET).remove([photo.storage_path, photo.thumb_path]);
    },
    onSuccess: (_data, photo) =>
      patchPhotos(queryClient, photo.trip_id, (old) => old.filter((p) => p.id !== photo.id)),
    onSettled: (_data, _error, photo) => refreshPhotos(queryClient, photo.trip_id),
  });
}
