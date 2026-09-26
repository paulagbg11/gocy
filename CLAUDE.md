@AGENTS.md

# GoCy

PWA para planear viajes entre dos personas: Paula y Manu. Sustituye a los lugares
guardados de Google Maps. Móvil primero — todo se diseña y se prueba a 375 px de
ancho, y el escritorio es secundario.

**Habla en castellano**: la interfaz, los comentarios del código y la
conversación con Paula. Los mensajes de commit, en inglés.

No hay login real. Al entrar se elige perfil (Manu / Paulilla) y por debajo hay
una sesión anónima de Supabase. Las políticas RLS solo distinguen "alguien que ha
pasado por la app" de "internet". Es un límite asumido, no un despiste.

## Comandos

```bash
npm run build   # OJO: next build --webpack (ver "Turbopack" abajo)
npm run lint
```

El servidor de desarrollo **no se arranca con Bash**: se usa `preview_start` con
la configuración `gocy-dev` de `.claude/launch.json`. Antes de un `npm run build`
conviene pararlo, porque en Windows bloquea ficheros de `.next` y la build falla
con EPERM.

## Estructura

- `app/trips/[tripId]/` — las cinco pestañas: `map`, `days`, `estravel`, `docs`,
  `notes`, más `settings`. El layout monta la navegación y la captura de migas.
- `components/<área>/` — un directorio por área (`map`, `days`, `docs`, `notes`,
  `places`, `estravel`, `categories`), más `components/ui/` con los primitivos
  (`Button`, `Input`, `Chip`, `Sheet`, `SegmentedControl`).
- `lib/queries/<tabla>.ts` — hooks de TanStack Query. Un fichero por tabla.
- `lib/realtime/useTripRealtime.ts` — un canal por viaje que **parchea la caché**
  de React Query en vez de refrescar. Toda tabla nueva que deba sincronizarse
  entre los dos móviles se añade aquí **y** a la publicación de Realtime en su
  migración.
- `supabase/migrations/` — numeradas. **Paula las ejecuta a mano** en el SQL
  Editor de Supabase; no hay CLI conectada. Al crear una, hay que avisarla y
  decirle que sin ejecutarla la pantalla correspondiente falla. Aplicadas hasta
  la `0010` incluida.

## Qué hay construido

- **Mapa** — buscador de Google Places, pines por categoría, filtros por
  categoría y punto de ubicación en vivo durante los días del viaje. Buscar algo
  que ya está guardado avisa en vez de duplicarlo.
- **Días** — un día por pestaña, con mapa, lugares en orden y casilla de día
  completado; el primero sin completar es el que sale por defecto.
- **Estravel** — recuerdo del viaje al estilo Strava. El recorrido sale de las
  migas de GPS o, si no hay, de los lugares asignados a cada día. Tres vistas y
  una imagen descargable de 1080×1350 dibujada en canvas, con el mapa de fondo
  pedido a la Static Maps API y el trazado siguiendo calles vía Routes API.
- **Docs** — vuelos, trenes/buses, alojamiento, reservas, entradas y notas, con
  adjuntos. Se abren en vista de lectura que solo enseña lo relleno; editar es
  otro paso.
- **Notas** — tablón de post-its con color, enlace y lista de casillas. Se pueden
  fijar arriba y tachar sin borrarlas.

## Modelo de datos

`trips` → `trip_days`, `places`, `documents` (→ `attachments`), `notes` (→
`note_items`), `track_points`. `place_day_links` cruza lugares con días y es lo
que ordena el recorrido. `categories` es **global**, no por viaje, y cada viaje
oculta las que no usa en `trip_hidden_categories`. `profiles` son las dos
personas.

Unicidad: índice parcial sobre `places (trip_id, google_place_id)`. Los lugares
metidos a mano no tienen ese identificador y ahí solo vale la comprobación por
nombre y cercanía de `lib/places.ts`.

## Trampas que ya han costado tiempo

No deshagas estas decisiones sin leer primero por qué están.

**`body` lleva `h-full`, no `min-h-full`.** Con `min-h-full` se rompe la
propagación de alturas en porcentaje y el mapa se queda a 0 px.

**Los `input[type=date|time|datetime-local]` necesitan `appearance: none`** en
`globals.css`. En iOS el control nativo tiene un ancho intrínseco propio que gana
a `width: 100%` y desborda la pantalla. Costó cuatro intentos; no hay que
envolverlos en componentes ni posicionarlos, basta con eso.

**El color de borde por defecto vive dentro de `@layer base`.** Suelto, fuera de
capa, ganaba a las utilidades de Tailwind v4 y dejaba sin efecto todas las clases
`border-<color>` del proyecto, sin avisar.

**En `app/sw.ts`, las reglas propias van ANTES de `defaultCache`.** Gana la
primera que coincide, y el comodín de `defaultCache` interceptaba los tiles de
Google Maps y colgaba el mapa hasta salir de la app.

**`next.config.ts` exporta la config pelada en desarrollo.** El plugin de Serwist
añade configuración de webpack y choca con Turbopack, que es el valor por defecto
de `next dev` desde Next 16. Por eso la build de producción lleva `--webpack`.

**Una PWA no puede registrar la ubicación en segundo plano.** No es una carencia
del código: no existe API web para eso y los service workers tienen prohibido el
acceso a geolocalización. Estravel se apaña con "migas de pan" mientras la app
está visible, y cae a los lugares por días cuando no hay ninguna.

**`place_day_links` borra en cascada desde `places`.** Al borrar un lugar hay que
mover antes lo que cuelgue de él, o sus días desaparecen en silencio.

**Al capturar pantallas con el panel del navegador oculto, el mapa sale gris.**
Es un artefacto de repintado, no un fallo. Ya me equivoqué dos veces
diagnosticando mapas "rotos" que funcionaban.

## Google Cloud y Vercel

La clave está en el proyecto de Google Cloud **GoCy** (hubo un lío largo con uno
viejo llamado *GeoMorcis*: si una API "no está habilitada" pero juras que sí,
comprueba primero en qué proyecto estás). APIs necesarias: **Maps JavaScript,
Places, Routes y Maps Static**. Está restringida por dominio a
`https://gocy.vercel.app/*` y `http://localhost/*` — esa segunda entrada cubre
cualquier puerto, comprobado.

En Vercel, las variables `NEXT_PUBLIC_` deben ser de tipo **Config, no Secret**:
Vercel se niega a guardar un Secret con ese prefijo, y un Secret ya guardado no
se puede convertir, hay que borrarlo y crearlo de nuevo. Next incrusta estas
variables en el JavaScript durante la build, así que **cambiarlas no hace nada
sin volver a desplegar**. Para saber qué clave hay realmente en producción, se
busca en los chunks servidos, pero hay que saltarse la caché del HTML o se leen
los del build anterior.

Para diagnosticar problemas de API, lanzar `curl` directo contra el endpoint con
la clave distingue "API no habilitada" (403 con ese texto) de "clave restringida"
(`API_KEY_SERVICE_BLOCKED`). Es mucho más rápido que mirar paneles.

## Forma de trabajar que funciona

Verificar de verdad, no suponer: abrir la pantalla, generar la imagen, mirar el
estilo calculado. Varias veces he dado algo por bueno o por roto a partir de una
captura tomada antes de que cargara, y siempre ha costado más deshacerlo.

Antes de borrar datos suyos, mirar qué cuelga de ellos y contárselo; los borrados
los confirma ella. Lo mismo con `push --force`.
