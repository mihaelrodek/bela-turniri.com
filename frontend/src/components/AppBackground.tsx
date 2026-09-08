import { Box } from "@chakra-ui/react"

/* ──────────────────────────────────────────────────────────────────────────
   AppBackground — the faint four-suit card art behind the whole app.

   Previously this was `background-image` + `background-attachment: fixed`
   directly on `html, body` (see the removed comment in system.ts). That
   relies on `background-attachment: fixed`, which iOS Safari does not
   honour on the document's scrolling element — it silently falls back to
   `scroll`. Two visible bugs followed, both reported live: the art appeared
   to sit at a different spot per tab, and it moved with the page instead of
   staying anchored to the screen. The reason for both is the same: with
   `background-attachment: scroll`, `background-position: center` centres
   within the ELEMENT'S OWN painted box — for `body` that is its full
   scrollable content height, not the viewport — so a tab with more content
   (a taller `body`) centres the image lower down that taller box, and
   scrolling moves the page under it exactly like any other background that
   scrolls with content.

   The fix is a real DOM node with `position: fixed`, not a CSS property that
   iOS ignores. A fixed-position element's box IS the viewport by definition
   (as long as no ancestor establishes a containing block via `transform`/
   `filter`/`will-change` — this is mounted as a top-level sibling in
   `main.tsx`, above the router and every dialog/portal, specifically to
   avoid that), so `background-position: center` now always means the centre
   of the SCREEN, on every tab, unaffected by scroll or page height. This
   sidesteps the iOS bug entirely rather than working around it, because
   nothing here depends on `background-attachment` doing anything at all.

   `pointerEvents="none"` so it never intercepts a tap; `aria-hidden` because
   it is decorative.

   `zIndex: -1` — the obvious choice for "paint behind everything" — does
   NOT work in this app and must stay `0` (Chakra's default; the prop is
   omitted below on purpose). Confirmed live: at -1 the image never painted
   at any opacity, at 0 it sits correctly behind every panel, at a large
   positive value it draws over them. Something in the ChakraProvider tree
   (very likely its own root wrapper painting an opaque background at
   `z-index: auto`, the same class of issue this file's own header used to
   describe for a `body::before` pseudo) sits between this element and the
   true canvas — a negative z-index here ends up BEHIND that opaque layer,
   not in front of it. `z-index: 0` plus DOM ORDER does the actual work:
   this component is mounted before the router tree (main.tsx), so at equal
   stacking level every real panel — rendered later — simply paints on top
   of it, which is all "behind everything opaque, visible through the gaps"
   ever required.
   ────────────────────────────────────────────────────────────────────── */

export default function AppBackground() {
    return (
        <Box
            aria-hidden="true"
            pointerEvents="none"
            position="fixed"
            inset="0"
            // zIndex deliberately omitted (defaults to 0) — see the header
            // comment: -1 never painted in this app, 0 does.
            // No backgroundColor here on purpose: `html, body` (system.ts)
            // still owns `bg.canvas`, which shows through this element's
            // transparent pixels without this needing its own copy.
            backgroundImage="url(/bg-cards-faded.png)"
            backgroundSize={{ base: "95%", md: "70%", lg: "55%" }}
            backgroundPosition="center"
            backgroundRepeat="no-repeat"
        />
    )
}
