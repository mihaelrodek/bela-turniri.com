/* Map warm-up helpers that must stay LIGHT: imported by the eager NavBar /
   MobileTabBar, so nothing here may pull in Leaflet, react-leaflet or
   MapLibre at module load — the renderer arrives only through `import()`. */

import { basemap } from "./mapTiles"

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
export function hasWebGl(): boolean {
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

/**
 * Warm the vector renderer ahead of navigation (hover / tap on "Karta"):
 * downloads the MapLibre chunk, boots its worker pool and prefetches the
 * style for the current colour mode. No-op on the raster path or without
 * WebGL. Safe to call repeatedly.
 */
export function preloadVectorBasemap(): Promise<void> {
    if (basemap.kind !== "vector" || !hasWebGl()) return Promise.resolve()
    const dark = document.documentElement.classList.contains("dark")
    const styleUrl = dark ? basemap.darkStyleUrl : basemap.styleUrl
    return import("../components/mapGlLayer")
        .then(({ warmUpMapRenderer }) => warmUpMapRenderer(styleUrl))
        .catch(() => {})
}

