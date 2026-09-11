import React, { Suspense, useEffect, useState } from "react"
import { useIsWhatsNewOpen } from "./store"

// The dialog's own module drags in both locales' full release prose (see
// releases.ts), so it is code-split and only fetched the moment someone
// actually taps the FAB — `WhatsNewFab` itself stays eager (mounted directly
// in main.tsx) since its badge dot must be correct on first paint.
const WhatsNewDialog = React.lazy(() => import("./WhatsNewDialog"))

/**
 * Renders nothing until the FAB has been tapped at least once, THEN mounts
 * the lazy dialog (and keeps it mounted for the rest of the session, so a
 * second open doesn't re-suspend). Gating on `isOpen` rather than always
 * rendering `<Suspense><WhatsNewDialog/></Suspense>` matters here — React
 * kicks off a lazy import the moment the component is first rendered, open
 * or not, so an unconditional mount would fetch the release-notes chunk for
 * every visitor on page load regardless of whether they ever open it.
 *
 * Split into its own file (rather than living inline in `main.tsx`) purely
 * so `react-refresh/only-export-components` has a component-only module to
 * be happy about — `main.tsx` itself has no exports at all.
 */
export default function WhatsNewDialogMount() {
    const isOpen = useIsWhatsNewOpen()
    const [loaded, setLoaded] = useState(false)
    useEffect(() => {
        if (isOpen) setLoaded(true)
    }, [isOpen])
    if (!loaded) return null
    return (
        <Suspense fallback={null}>
            <WhatsNewDialog />
        </Suspense>
    )
}
