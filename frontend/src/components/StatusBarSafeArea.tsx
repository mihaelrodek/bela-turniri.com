import { Box } from "@chakra-ui/react"

/* ──────────────────────────────────────────────────────────────────────────
   StatusBarSafeArea — a permanent, deterministic strip over the notch/Dynamic
   Island inset, so iOS never has anything else to sample for the status-bar
   tint.

   Bug report (2026-09-20, user, installed iOS PWA): after an error toast at
   the game table, the status-bar strip stayed solid red long after the toast
   itself was gone. `toaster.ts` / `navChrome.ts`'s `TOAST_TOP_OFFSET` already
   keeps every toast's own box below the navbar (`max(env(safe-area-inset-
   top), offset)` in zag-js's placement math — see node_modules/@zag-js/toast
   — so no toast box ever touches `top: 0`), and the navbar itself pads into
   the inset with its own background (`NavBar.tsx`, `paddingTop:
   env(safe-area-inset-top)`). That should already keep the strip a stable
   colour. It evidently still doesn't on every device/iOS build: WebKit's
   status-bar tinting (colloquially "iOS 26") samples page content near the
   top edge and is reported to sometimes cache a stale sample rather than
   re-reading it once a page has `overflow: hidden` locked (the game table
   does exactly this while mounted — see GameRoomPage.tsx's scroll-lock
   effect). Rather than depend on every future fixed/sticky element at the
   top staying out of that sampled band, this component makes the sampled
   pixels themselves unconditionally deterministic: a real, opaque, themed
   box that always occupies exactly the safe-area-inset-top strip, above
   EVERYTHING (including toasts) in stacking order.

   `bg.opaque` (system.ts) is the same white / gray.900 the navbar's own
   glass background resolves to without translucency — i.e. this strip reads
   as a seamless continuation of the header, not a visible patch, in both
   themes.

   `zIndex={1001}`: one above the navbar (1000), and deliberately BELOW every
   overlay — dialogs, sheets, the belot stage. At `max` it was a bright band
   across the top of every dimmed backdrop and full-screen stage on a notched
   phone. Toasts never reach the top edge (`TOAST_TOP_OFFSET`), so they need
   no covering.

   `pointerEvents="none"`: this must never swallow a tap. On every device
   without a safe-area inset (Android, desktop, an ordinary browser tab)
   `env(safe-area-inset-top, 0px)` resolves to 0, so the box has zero height
   and is a complete no-op there. Modelled on `AppBackground.tsx`'s own
   top-level `position: fixed` sibling — mounted above the router and every
   portal so no ancestor transform/filter can turn it into a containing
   block for something else. */

export default function StatusBarSafeArea() {
    return (
        <Box
            aria-hidden="true"
            pointerEvents="none"
            position="fixed"
            top="0"
            insetInline="0"
            h="env(safe-area-inset-top, 0px)"
            bg="bg.opaque"
            zIndex={1001}
        />
    )
}
