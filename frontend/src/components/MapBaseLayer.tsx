/* ──────────────────────────────────────────────────────────────────────────
   The basemap, for both map surfaces (`pages/MapPage.tsx` and
   `LocationMapPicker.tsx`). They render `<MapBaseLayer />` and stay ignorant
   of which provider is configured; `utils/mapTiles.ts` answers that.

   Two renderers behind one component because the two providers are drawn by
   different machinery: raster tiles by react-leaflet's `<TileLayer>`, vector
   styles by a MapLibre GL canvas injected into Leaflet's tile pane. The
   config is a discriminated union, so picking the wrong one is a type error
   rather than a blank map.
   ────────────────────────────────────────────────────────────────────── */

import { useEffect, useLayoutEffect, useState } from "react"
import { TileLayer, useMap } from "react-leaflet"
import type { Layer } from "leaflet"

import { basemap, rasterFallback, type RasterBasemap, type VectorBasemap } from "../utils/mapTiles"
import { useColorMode } from "../color-mode-hooks"

/* Marker class put on the Leaflet container by the RASTER path only, and the
   hook the dark-mode hack in `system.ts` hangs off.

   WHY a container class and not the narrower `.leaflet-tile-pane img`
   suggested as the alternative: the raster dark treatment is TWO rules, and
   only one of them targets the tiles. The other is an `::after` pseudo on the
   PANE itself, blended with `mix-blend-mode: color` to push blue into grey
   pixels — an `img`-scoped selector cannot express it, so it would keep
   tinting the GL canvas (which sits in that very pane) on top of an already
   dark style. Gating both rules on a class that only the raster path sets
   keeps the two treatments from ever stacking. */
const RASTER_MARKER_CLASS = "bela-basemap-raster"

/**
 * Can this browser actually run MapLibre?
 *
 * Asked BEFORE the dynamic import, not after: the renderer is a ~1 MB chunk,
 * and a browser without WebGL must not download it only to throw. The check
 * is the same one MapLibre's own removed `supported()` did — ask for a
 * context and see whether you get one. Wrapped in try/catch because a
 * hardened browser can make `getContext` itself throw rather than return
 * null.
 *
 * Computed once and cached: the answer cannot change while the page is open,
 * and each call otherwise leaks a canvas and a GL context.
 */
let webGlSupport: boolean | null = null
function hasWebGl(): boolean {
    if (webGlSupport !== null) return webGlSupport
    try {
        const canvas = document.createElement("canvas")
        const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl")
        // Hand the context back immediately — browsers cap how many live GL
        // contexts a page may hold, and this one was only ever a probe.
        const lose = gl?.getExtension("WEBGL_lose_context")
        lose?.loseContext()
        webGlSupport = gl !== null
    } catch {
        webGlSupport = false
    }
    return webGlSupport
}

export function MapBaseLayer() {
    // `basemap.kind` is decided at module load from env, so this branch is
    // constant for the life of the page — no hook-order hazard from picking a
    // different component on different renders.
    return basemap.kind === "vector"
        ? <VectorBaseLayer config={basemap} />
        : <RasterBaseLayer config={basemap} />
}

function RasterBaseLayer({ config }: { config: RasterBasemap }) {
    const map = useMap()

    // Layout effect, not a plain one: the class gates the dark-mode filter, so
    // applying it after paint would flash one bright frame of daylight tiles.
    useLayoutEffect(() => {
        const el = map.getContainer()
        el.classList.add(RASTER_MARKER_CLASS)
        return () => el.classList.remove(RASTER_MARKER_CLASS)
    }, [map])

    return (
        <TileLayer
            attribution={config.attribution}
            url={config.url}
            maxZoom={config.maxZoom}
        />
    )
}

function VectorBaseLayer({ config }: { config: VectorBasemap }) {
    const map = useMap()
    const { colorMode } = useColorMode()
    // Set once the vector renderer proves it cannot run here. From then on
    // this component renders the raster layer instead and never retries: the
    // causes are all sticky for the life of the page (no WebGL, a chunk that
    // 404s), so a retry loop would only thrash.
    const [fellBack, setFellBack] = useState(() => !hasWebGl())

    // The app's OWN colour mode (next-themes, synced to the user's profile),
    // not `prefers-color-scheme`: a user who forced light mode on a dark OS
    // must get the light style.
    const styleUrl = colorMode === "dark" ? config.darkStyleUrl : config.styleUrl
    const { attribution, maxZoom } = config

    useEffect(() => {
        if (fellBack) return
        let cancelled = false
        let layer: Layer | null = null

        // Dynamic import — see `mapGlLayer.ts` for why maplibre-gl must never
        // enter the eager bundle.
        void import("./mapGlLayer")
            .then(({ createGlBaseLayer }) => {
                if (cancelled) return
                layer = createGlBaseLayer({ styleUrl, attribution, maxZoom })
                layer.addTo(map)
            })
            .catch((err: unknown) => {
                // No WebGL (a hardened or policy-locked browser, a blocklisted
                // GPU driver), offline, or the chunk 404s after a deploy. Fall
                // back to raster tiles rather than leaving an empty square
                // with markers floating on it — a CARTO map, watermark and
                // all, is a map; a grey rectangle is not.
                console.warn("MapBaseLayer: vector renderer unavailable, falling back to raster", err)
                if (!cancelled) setFellBack(true)
            })

        return () => {
            cancelled = true
            if (layer) map.removeLayer(layer)
        }
        // A style swap (colour mode) rebuilds the layer instead of calling
        // MapLibre's `setStyle`: toggling the theme is rare, and a fresh layer
        // cannot inherit half-applied state from the previous style.
    }, [map, styleUrl, attribution, maxZoom, fellBack])

    if (fellBack) return <RasterBaseLayer config={rasterFallback()} />
    return null
}
