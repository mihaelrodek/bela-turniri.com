import { useLayoutEffect, useRef, useState } from "react"
import { isFaceDecoded, markFaceDecoded } from "./preload"

/* ──────────────────────────────────────────────────────────────────────────
   "Is this card image safe to show yet?" — shared by the face
   (`MadjaricaCard`) and the back (`PlayingCard`'s `CardBack`).

   Since the licensed deck landed (2026-09-20) the image IS the card: it has
   transparent corners and its own white face, so it cannot be painted over a
   fallback the way a scan-on-a-frame could. It is shown only once it has
   decoded, and the CSS/SVG fallback underneath is hidden in the SAME render —
   otherwise the fallback peeks through the transparent corners.

   Living in its own module keeps `preload.ts` free of React and lets both
   call sites share one answer.
   ────────────────────────────────────────────────────────────────────── */

export type DecodedImage = {
    /** True once these bytes are known-decodable in this document. */
    ready: boolean
    /** Attach to the `<img>`; the `complete` check below needs the element. */
    imgRef: React.RefObject<HTMLImageElement | null>
    /** Pass as `onLoad`. */
    settle: () => void
}

export function useDecodedImage(src: string | undefined): DecodedImage {
    /* Already decoded once in this document → ready on the very first paint,
       with no swap at all. A card in the hand mounts and unmounts often enough
       (a new deal, a resort) that re-running the fallback→image swap every
       time reads as the card flickering, and an image served from memory has
       nothing to wait for. `preload.ts` owns the set; see its header. */
    const [ready, setReady] = useState(() => !!src && isFaceDecoded(src))
    const imgRef = useRef<HTMLImageElement | null>(null)

    const settle = (): void => {
        if (!src) return
        markFaceDecoded(src)
        setReady(true)
    }

    /* A cached image can finish loading BEFORE React attaches `onLoad`, in
       which case that event never fires and the artwork would stay hidden
       forever. `complete` is the only reliable answer to "did I miss it". */
    useLayoutEffect(() => {
        if (!src) return
        const el = imgRef.current
        if (el?.complete && el.naturalWidth > 0) {
            markFaceDecoded(src)
            setReady(true)
        } else {
            // A live instance handed a DIFFERENT src must not keep the
            // previous image's `ready`. Every caller keys by card today, so
            // this never fires — it is here so a future unkeyed call site
            // cannot bring the ghost-card flicker back.
            setReady(isFaceDecoded(src))
        }
    }, [src])

    return { ready: ready && !!src, imgRef, settle }
}
