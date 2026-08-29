# GoCy

App de planificación de viajes en pareja: mapa de lugares por categoría, organización por días con ruta visual simple, timeline por día y documentos/reservas (vuelos, alojamiento, reservas). Ver el plan completo de diseño en el historial de la conversación / `~/.claude/plans/quiero-hacer-una-aplicacion-shiny-plum.md`.

Sin login real: se entra eligiendo un perfil ("Paula" / "Novio") en la Pantalla 0; por debajo la app usa un *anonymous sign-in* de Supabase solo para que las políticas de la base de datos no queden abiertas a cualquiera de internet. No es autenticación real — ver más abajo.

## 1. Antes de arrancar: rellenar `.env.local`

Ya existe el archivo `.env.local` en la raíz (no se sube a git) con `NEXT_PUBLIC_SUPABASE_URL` puesto. Faltan dos claves:

```
NEXT_PUBLIC_SUPABASE_ANON_KEY=   <- Supabase: Project Settings -> API -> anon public key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY= <- Google Cloud Console -> Credentials
```

### Supabase

1. En el proyecto `klimjmzycfhuzczoksmp`, abre **SQL Editor** y ejecuta en orden los 3 archivos de `supabase/migrations/`:
   - `0001_init.sql` (tablas, enums, buckets de Storage)
   - `0002_rls.sql` (políticas de seguridad)
   - `0003_seed_profiles.sql` (crea los 2 perfiles iniciales — puedes cambiar los nombres luego desde la app)
2. **Authentication -> Providers -> Anonymous Sign-Ins**: actívalo (está desactivado por defecto). Sin esto la app no puede ni leer los perfiles.
3. **Database -> Replication**: añade las tablas `places`, `place_day_links`, `documents` y `trip_days` a la publicación `supabase_realtime` (o ejecuta en el SQL Editor: `alter publication supabase_realtime add table places, place_day_links, documents, trip_days;`). Sin esto la app funciona pero no sincroniza en vivo entre los dos móviles.
4. Copia la **anon public key** (Project Settings -> API) a `.env.local`.

### Google Maps

1. En Google Cloud Console, habilita **Maps JavaScript API** y **Places API** (la app usa el widget clásico de autocompletado, que depende de "Places API", no solo de "Places API (New)"). Confirma que la facturación del proyecto está activa — si te vuelve a fallar la tarjeta, hay que cambiar a Mapbox (el código del mapa está aislado en `components/map/` para que ese cambio no obligue a tocar el resto de la app).
2. Crea una API key y restríngela a esas dos APIs.
3. Pégala en `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

Sin esta clave, la pestaña "Mapa" muestra un aviso en vez de romperse — el resto de la app (viajes, días, docs) funciona igual.

## 2. Arrancar en local

```bash
npm run dev
```

Abre `http://localhost:3000` (o el puerto que indique la terminal). Para probarlo como en el móvil, usa el modo responsive del navegador o abre esa URL desde el móvil si está en la misma red.

## 3. Compilar para producción

```bash
npm run build
npm start
```

`npm run build` usa el flag `--webpack` a propósito: el plugin de Serwist (service worker / PWA) todavía no soporta Turbopack en producción — ver el comentario en `next.config.ts`. En desarrollo no hace falta (el service worker está desactivado en `next dev`).

## 4. Desplegar

Pensado para Vercel: conecta el repo, añade las mismas variables de entorno (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) en el proyecto de Vercel, y despliega. Vercel respeta el `build` de `package.json`, así que no hace falta tocar nada más.

## 5. Instalar en el móvil (PWA)

Con el sitio ya desplegado (el service worker no se genera en local con `npm run dev`):

- **Android / Chrome**: menú -> "Añadir a pantalla de inicio".
- **iOS / Safari**: botón compartir -> "Añadir a pantalla de inicio" (iOS no muestra el aviso automático, hay que hacerlo a mano).

## 6. Qué falta / decisiones a revisar

- **Seguridad**: no hay contraseñas ni cuentas reales — cualquiera con la URL desplegada tiene acceso completo. Es una decisión deliberada para una app privada de 2 personas (ver `supabase/migrations/0002_rls.sql`), no un descuido.
- **Iconos PWA**: son un pin de mapa simple generado por `scripts/generate-icons.mjs`. Si quieres un icono con más diseño, sustituye los PNG en `public/icons/` (mismos nombres/tamaños) y no hace falta tocar el manifest.
- **Rutas del día**: son una línea recta uniendo los pines en el orden elegido, no una ruta real por calle (ver plan, sección "Rutas por día").
- **Backlog explícito** (no implementado a propósito): ubicación en tiempo real / distancia a cada pin, presupuesto y gastos compartidos, ruta real por calle.
