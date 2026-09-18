/* ──────────────────────────────────────────────────────────────────────────
   The MapLibre GL half of `MapBaseLayer.tsx`, kept in a module of its own for
   ONE reason: everything it imports is expensive and optional.

   `maplibre-gl` is ~800 kB of WebGL renderer plus its own stylesheet, and it
   is needed only when VITE_MAP_PROVIDER=openfreemap. A top-level import
   anywhere in the component tree would sweep it into the eager `vendor`
   chunk (and its CSS into the eager stylesheet) for every visitor of every
   page, including the default CARTO deployment that never touches it. So
   `MapBaseLayer` reaches this file through `import()`, Rollup gives it its
   own chunk, and the stylesheet rides along with that chunk instead of the
   app shell. `vite.config.ts` additionally pins maplibre itself to a
   `vendor-maplibre` chunk — same reasoning as `vendor-map` (plain Leaflet):
   it touches no React, so it cannot hit the cross-chunk init crash, and
   keeping it separate stops it being merged into `vendor`.

   The CSS import MUST stay here, not in a caller. It carries the GL canvas
   positioning and the (unused-by-us) MapLibre controls; importing it from an
   eagerly-loaded module would defeat the whole split.
   ────────────────────────────────────────────────────────────────────── */

import "maplibre-gl/dist/maplibre-gl.css"
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet"
import type { MaplibreGL } from "leaflet"

type GlLayerArgs = {
    styleUrl: string
    attribution: string
    maxZoom: number
}

/** Build a Leaflet layer that renders a MapLibre GL vector style.
 *
 *  The plugin drops its GL canvas into Leaflet's `tilePane` and mirrors every
 *  pan/zoom, so markers, popups, clusters, `useMap()` and every event handler
 *  on the surrounding map keep working exactly as they do over raster tiles —
 *  that is the whole reason we stay on Leaflet instead of rewriting the two
 *  map pages onto raw MapLibre. */
export function createGlBaseLayer({ styleUrl, attribution, maxZoom }: GlLayerArgs): MaplibreGL {
    const layer = maplibreGL({
        style: styleUrl,
        maxZoom,
        // MapLibre's OWN attribution control is suppressed by the plugin (it
        // forces `attributionControl: false` on the inner map); it reads this
        // object back in `getAttribution()` and feeds the string to LEAFLET's
        // attribution control instead, which is the one actually on screen.
        attributionControl: { customAttribution: attribution },
    })

    /* THE BLANK-MAP BUG (2026-09-13/14) and why a resize kick alone never
     * fixed it.
     *
     * The plugin builds its own wrapper `<div>`, sizes it from
     * `leafletMap.getSize()` and constructs the MapLibre GL map inside it —
     * ALL IN THE SAME TICK AS `onAdd`, i.e. the moment `layer.addTo(map)`
     * runs. If Leaflet's own container had not finished settling by then
     * (a flex/grid parent still computing its height, a sidebar list still
     * loading, `<Suspense>` swapping in this very chunk), MapLibre's
     * transform captures a 0×0 — or otherwise stale — viewport: the style's
     * background layer paints, the sprite/glyphs/TileJSON all come back 200,
     * and not one `.pbf` is EVER requested, because `coveringTiles()` has
     * nothing to cover.
     *
     * A one-shot `requestAnimationFrame` kick (what used to be here) only
     * fixes this if the container has ALREADY reached its final size by the
     * second frame — a bet, not a fix. Worse: this plugin's OWN handling of
     * a Leaflet-side resize (window resize, `invalidateSize()`, a later
     * layout shift) never calls MapLibre's `.resize()` at all — its `_resize`
     * handler only resizes the wrapper DIV and re-centres the view, so once
     * the GL transform is wrong it stays wrong for the life of the layer,
     * with no further signal to correct it.
     *
     * A `ResizeObserver` on the plugin's own container fixes both: its
     * spec-mandated FIRST callback fires with whatever size the box has the
     * moment observation starts — no frame-counting guesswork — and every
     * later layout change (this container, or an ancestor) fires it again
     * for as long as the layer is on the map. */
    layer.once("add", () => {
        const container = layer.getContainer()
        const gl = layer.getMaplibreMap()
        if (!container || !gl || typeof ResizeObserver === "undefined") return
        const observer = new ResizeObserver(() => gl.resize())
        observer.observe(container)
        layer.once("remove", () => observer.disconnect())
    })

    return layer
}
