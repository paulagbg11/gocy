/**
 * Lo poco del EXIF de una foto que le interesa a la app: cuándo y dónde se
 * hizo. Hay que leerlo del archivo original, porque al reducirla en un canvas
 * el EXIF se pierde.
 *
 * Solo entiende JPEG, que es lo que entregan Android y el selector de iOS. Si
 * algo no cuadra devuelve lo que haya podido leer, nunca un error: una foto
 * sin fecha se sube igual.
 */
export interface PhotoMeta {
  takenAt: Date | null;
  lat: number | null;
  lng: number | null;
}

const EMPTY: PhotoMeta = { takenAt: null, lat: null, lng: null };

/** El EXIF va al principio del JPEG; no hace falta leer la foto entera. */
const HEAD_BYTES = 256 * 1024;

const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATE_ORIGINAL = 0x9003;
const TAG_OFFSET_ORIGINAL = 0x9011;

export async function readPhotoMeta(file: File): Promise<PhotoMeta> {
  try {
    const view = new DataView(await file.slice(0, HEAD_BYTES).arrayBuffer());
    const tiff = findExif(view);
    return tiff === null ? EMPTY : parseTiff(view, tiff);
  } catch {
    return EMPTY;
  }
}

/** Posición de la cabecera TIFF dentro del segmento APP1 "Exif", o null. */
function findExif(view: DataView): number | null {
  if (view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset);
    const length = view.getUint16(offset + 2);
    // 0x45786966 = "Exif"
    if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) return offset + 10;
    // Inicio de la imagen comprimida: ya no va a haber EXIF.
    if (marker === 0xffda) return null;
    offset += 2 + length;
  }
  return null;
}

function parseTiff(view: DataView, tiff: number): PhotoMeta {
  const little = view.getUint16(tiff) === 0x4949;
  const u16 = (at: number) => view.getUint16(at, little);
  const u32 = (at: number) => view.getUint32(at, little);

  /** Entradas de un IFD como etiqueta → posición de su valor (o de su puntero). */
  const readIfd = (at: number) => {
    const entries = new Map<number, { type: number; count: number; valueAt: number }>();
    const count = u16(at);
    for (let i = 0; i < count; i++) {
      const entry = at + 2 + i * 12;
      const type = u16(entry + 2);
      const n = u32(entry + 4);
      const size = n * (type === 5 ? 8 : type === 3 ? 2 : type === 4 ? 4 : 1);
      // Hasta 4 bytes, el valor va dentro de la entrada; si no, es un puntero.
      const valueAt = size > 4 ? tiff + u32(entry + 8) : entry + 8;
      entries.set(u16(entry), { type, count: n, valueAt });
    }
    return entries;
  };

  const ascii = (e?: { count: number; valueAt: number }) => {
    if (!e) return null;
    let text = "";
    for (let i = 0; i < e.count; i++) {
      const c = view.getUint8(e.valueAt + i);
      if (c === 0) break;
      text += String.fromCharCode(c);
    }
    return text.trim() || null;
  };

  const rational = (at: number) => {
    const den = u32(at + 4);
    return den ? u32(at) / den : 0;
  };

  const ifd0 = readIfd(tiff + u32(tiff + 4));
  const meta: PhotoMeta = { ...EMPTY };

  const exifPointer = ifd0.get(TAG_EXIF_IFD);
  if (exifPointer) {
    const exif = readIfd(tiff + u32(exifPointer.valueAt));
    meta.takenAt = parseExifDate(
      ascii(exif.get(TAG_DATE_ORIGINAL)),
      ascii(exif.get(TAG_OFFSET_ORIGINAL)),
    );
  }

  const gpsPointer = ifd0.get(TAG_GPS_IFD);
  if (gpsPointer) {
    const gps = readIfd(tiff + u32(gpsPointer.valueAt));
    const coord = (refTag: number, valueTag: number, negative: string) => {
      const value = gps.get(valueTag);
      if (!value || value.type !== 5 || value.count < 3) return null;
      const degrees =
        rational(value.valueAt) + rational(value.valueAt + 8) / 60 + rational(value.valueAt + 16) / 3600;
      return ascii(gps.get(refTag)) === negative ? -degrees : degrees;
    };
    const lat = coord(1, 2, "S");
    const lng = coord(3, 4, "W");
    // 0,0 es lo que escriben algunas cámaras cuando no tienen señal.
    if (lat !== null && lng !== null && (lat !== 0 || lng !== 0)) {
      meta.lat = lat;
      meta.lng = lng;
    }
  }

  return meta;
}

/**
 * "2026:10:22 14:05:31" más, si lo hay, "+02:00". Sin zona se toma como hora
 * del móvil, que durante el viaje es la del sitio donde se hizo la foto.
 */
function parseExifDate(value: string | null, offset: string | null): Date | null {
  const m = value?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const date = /^[+-]\d{2}:\d{2}$/.test(offset ?? "")
    ? new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${offset}`)
    : new Date(+y, +mo - 1, +d, +h, +mi, +s);
  return Number.isNaN(date.getTime()) ? null : date;
}
