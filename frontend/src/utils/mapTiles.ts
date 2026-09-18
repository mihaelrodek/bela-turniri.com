/* ──────────────────────────────────────────────────────────────────────────
   Single source of truth for the Leaflet basemap: WHICH map is drawn and HOW
   it is drawn. Read by exactly one component — `components/MapBaseLayer.tsx`
   — which both map surfaces render: `pages/MapPage.tsx` (the public /karta
   map) and `components/LocationMapPicker.tsx` (the create/edit form picker).

   TWO PROVIDERS, one default.

   • CARTO Voyager (raster, DEFAULT). CARTO started gating its public
     basemaps in 2026: without a key every tile carries a diagonal "API KEY
     REQUIRED" watermark (seen live on 2026-09-10). The key is free — a form
     at carto.com/basemaps/apikey, no account, 5 M tiles/month for
     non-commercial use — and goes on the URL as `?key=`. Set
     VITE_CARTO_API_KEY and the default URL below picks it up; attribution to
     OpenStreetMap and CARTO must stay visible, which the default string does.

   • OpenFreeMap (vector, opt-in via VITE_MAP_PROVIDER=openfreemap). No key,
     no account, no registration, no request limit, commercial use allowed.
     Attribution IS required, and unlike MapLibre's own attribution control
     our Leaflet control will not derive it from the style, so the string is
     spelled out below and handed to the GL layer explicitly.

   The result is a DISCRIMINATED UNION, not a bag of optional fields: a raster
   config has no style URL and a vector config has no tile-URL template, so a
   caller physically cannot feed the wrong one to the wrong renderer.

   Switching provider is env-only, no code change:
     VITE_MAP_PROVIDER=openfreemap            # keyless vector basemap
     VITE_OPENFREEMAP_STYLE=liberty           # light style (see STYLES below)
     VITE_OPENFREEMAP_STYLE_DARK=dark         # dark-mode counterpart
   or, for any other RASTER provider (MapTiler, Stadia, Thunderforest,
   Mapbox), the pre-existing wholesale override:
     VITE_MAP_TILE_URL="https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=YOUR_KEY"
     VITE_MAP_TILE_ATTRIBUTION='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
   VITE_MAP_TILE_URL is an EXPLICIT raster URL, so it wins over
   VITE_MAP_PROVIDER — setting a tile template can only mean "draw rasters".
   Any such key ships in the bundle, so restrict it by domain in the
   provider console.

   Leaflet's `{s}` (subdomain rotation) and `{r}` (retina "@2x" suffix)
   placeholders keep working on the raster path — Leaflet expands them itself,
   so the URL is passed through verbatim. A provider without subdomains simply
   omits `{s}`.
   ────────────────────────────────────────────────────────────────────── */

const CARTO_TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"

function cartoUrl(): string {
    const key = envOr(import.meta.env?.VITE_CARTO_API_KEY, "")
    return key ? `${CARTO_TILE_URL}?key=${encodeURIComponent(key)}` : CARTO_TILE_URL
}

const DEFAULT_TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    + ' &copy; <a href="https://carto.com/attributions">CARTO</a>'

/* The five styles OpenFreeMap publishes, all verified 200 on 2026-09-11 at
   https://tiles.openfreemap.org/styles/<name>. `dark` is a REAL dark style,
   which is why the vector path does not reuse the raster dark-mode filter
   hack in system.ts — see the comment there. */
const OPENFREEMAP_STYLES = ["liberty", "bright", "positron", "dark", "fiord"] as const
type OpenFreeMapStyle = (typeof OPENFREEMAP_STYLES)[number]

const OPENFREEMAP_STYLE_BASE = "https://tiles.openfreemap.org/styles/"

/* Required by OpenFreeMap's terms: their name, OpenMapTiles (the schema/
   generator) and OpenStreetMap (the data). MapLibre would render this out of
   the style itself, but the layer hangs inside Leaflet's attribution control,
   which only knows what we hand it. */
const OPENFREEMAP_ATTRIBUTION =
    '<a href="https://openfreemap.org/">OpenFreeMap</a>'
    + ' &copy; <a href="https://www.openmaptiles.org/">OpenMapTiles</a>'
    + ' Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

function envOr(value: unknown, fallback: string): string {
    const s = typeof value === "string" ? value.trim() : ""
    return s.length > 0 ? s : fallback
}

function styleOr(value: unknown, fallback: OpenFreeMapStyle): OpenFreeMapStyle {
    const s = envOr(value, "")
    // Unknown name = typo in the deploy env. Falling back beats shipping a
    // 404 style URL that renders a blank grey map with no error anywhere.
    return (OPENFREEMAP_STYLES as readonly string[]).includes(s) ? (s as OpenFreeMapStyle) : fallback
}

/** Raster tiles drawn by Leaflet's own `<TileLayer>`. */
export type RasterBasemap = {
    kind: "raster"
    url: string
    attribution: string
    maxZoom: number
}

/** A MapLibre GL vector style drawn into a Leaflet pane by
 *  `@maplibre/maplibre-gl-leaflet`. Carries BOTH themes: the vector path
 *  swaps whole styles with the colour mode instead of filtering pixels. */
export type VectorBasemap = {
    kind: "vector"
    styleUrl: string
    darkStyleUrl: string
    attribution: string
    maxZoom: number
}

export type Basemap = RasterBasemap | VectorBasemap

function resolveBasemap(): Basemap {
    const explicitRasterUrl = envOr(import.meta.env?.VITE_MAP_TILE_URL, "")
    const provider = envOr(import.meta.env?.VITE_MAP_PROVIDER, "carto").toLowerCase()

    if (provider === "openfreemap" && explicitRasterUrl.length === 0) {
        const light = styleOr(import.meta.env?.VITE_OPENFREEMAP_STYLE, "liberty")
        const dark = styleOr(import.meta.env?.VITE_OPENFREEMAP_STYLE_DARK, "dark")
        return {
            kind: "vector",
            styleUrl: `${OPENFREEMAP_STYLE_BASE}${light}`,
            darkStyleUrl: `${OPENFREEMAP_STYLE_BASE}${dark}`,
            attribution: envOr(import.meta.env?.VITE_MAP_TILE_ATTRIBUTION, OPENFREEMAP_ATTRIBUTION),
            // Vector tiles stop at z14 upstream but MapLibre overzooms them
            // (the geometry is scaled, labels stay sharp), so the usable
            // ceiling is the same as the raster path's.
            maxZoom: 20,
        }
    }

    return {
        kind: "raster",
        url: explicitRasterUrl.length > 0 ? explicitRasterUrl : cartoUrl(),
        attribution: envOr(import.meta.env?.VITE_MAP_TILE_ATTRIBUTION, DEFAULT_TILE_ATTRIBUTION),
        // CARTO Voyager serves up to z20; most keyed providers do too. Leaflet
        // clamps zooming rather than requesting 404 tiles beyond this.
        maxZoom: 20,
    }
}

/** Basemap config. Plain object, read at module load — the provider never
 *  changes at runtime, so there is nothing to re-render on. (The vector
 *  path's LIGHT/DARK choice does change at runtime; both URLs live here and
 *  `MapBaseLayer` picks between them.) */
export const basemap: Basemap = resolveBasemap()

/**
 * The raster config to fall back to when the vector renderer cannot run —
 * no WebGL, or the lazy chunk never arrives.
 *
 * Always CARTO, never the `VITE_MAP_TILE_*` overrides: those describe a
 * DELIBERATE raster choice, and reaching this function means the operator
 * chose vector instead. A map with a watermark still shows the streets; an
 * empty grey square with markers floating on it shows nothing.
 */
export function rasterFallback(): RasterBasemap {
    return {
        kind: "raster",
        url: cartoUrl(),
        attribution: DEFAULT_TILE_ATTRIBUTION,
        maxZoom: 20,
    }
}
