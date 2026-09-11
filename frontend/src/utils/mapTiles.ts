/* ──────────────────────────────────────────────────────────────────────────
   Single source of truth for the Leaflet raster basemap, read by both map
   surfaces: `pages/MapPage.tsx` (the public /karta map) and
   `components/LocationMapPicker.tsx` (the create/edit form's picker).

   The default is CARTO Voyager. CARTO started gating its public basemaps in
   2026: without a key every tile carries a diagonal "API KEY REQUIRED"
   watermark (seen live on 2026-09-10). The key is free — a form at
   carto.com/basemaps/apikey, no account, 5 M tiles/month for non-commercial
   use — and goes on the URL as `?key=`. Set VITE_CARTO_API_KEY and the
   default URL below picks it up; attribution to OpenStreetMap and CARTO must
   stay visible, which the default string does.

   Switching provider entirely = swapping two env vars, no code change:
     VITE_MAP_TILE_URL="https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=YOUR_KEY"
     VITE_MAP_TILE_ATTRIBUTION='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
   Same shape works for Stadia, Thunderforest and Mapbox raster tiles. Any
   such key ships in the bundle, so restrict it by domain in the provider
   console.

   Leaflet's `{s}` (subdomain rotation) and `{r}` (retina "@2x" suffix)
   placeholders keep working — Leaflet expands them itself, so the URL is
   passed through verbatim. A provider without subdomains simply omits `{s}`.
   ────────────────────────────────────────────────────────────────────── */

const CARTO_TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"

function cartoUrl(): string {
    const key = envOr(import.meta.env?.VITE_CARTO_API_KEY, "")
    return key ? `${CARTO_TILE_URL}?key=${encodeURIComponent(key)}` : CARTO_TILE_URL
}

const DEFAULT_TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    + ' &copy; <a href="https://carto.com/attributions">CARTO</a>'

function envOr(value: unknown, fallback: string): string {
    const s = typeof value === "string" ? value.trim() : ""
    return s.length > 0 ? s : fallback
}

/** Tile layer config. Plain object, read at module load — the basemap never
 *  changes at runtime, so there is nothing to re-render on. */
export const mapTiles = {
    url: envOr(import.meta.env?.VITE_MAP_TILE_URL, cartoUrl()),
    attribution: envOr(import.meta.env?.VITE_MAP_TILE_ATTRIBUTION, DEFAULT_TILE_ATTRIBUTION),
    // CARTO Voyager serves up to z20; most keyed providers do too. Leaflet
    // clamps zooming rather than requesting 404 tiles beyond this.
    maxZoom: 20,
} as const
