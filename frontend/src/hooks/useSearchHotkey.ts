import { useEffect, useMemo, type RefObject } from "react"

/* ──────────────────────────────────────────────────────────────────────────
   The ⌘K / Ctrl-K search shortcut, and the platform test the hint chip beside
   it needs.

   Extracted from `TournamentsPage` when the pair board grew the same toolbar:
   two copies of a global keydown listener is exactly how two screens end up
   disagreeing about whether Alt is excluded or whether the box gets selected
   as well as focused.
   ────────────────────────────────────────────────────────────────────── */

/** True on macOS / iOS, where the platform's own palettes use Cmd. Drives
 *  both the modifier we listen for and the "⌘K" vs "Ctrl K" chip. */
function useIsApplePlatform(): boolean {
    return useMemo(() => {
        if (typeof navigator === "undefined") return false
        return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)
    }, [])
}

/**
 * Focus and select `ref`'s input on ⌘K (Apple) / Ctrl-K (everywhere else).
 * Alt is excluded so Ctrl+Alt+K — a dead key on some layouts — is not
 * swallowed. Returns the platform flag so the caller can label its chip
 * without asking twice.
 */
export function useSearchHotkey(ref: RefObject<HTMLInputElement | null>): boolean {
    const isApple = useIsApplePlatform()
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (e.key !== "k" && e.key !== "K") return
            if (!(isApple ? e.metaKey : e.ctrlKey) || e.altKey) return
            e.preventDefault()
            const el = ref.current
            if (!el) return
            el.focus()
            el.select()
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [isApple, ref])
    return isApple
}
