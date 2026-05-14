import type { Step } from "react-joyride"

/**
 * Step content for the tours on the Turniri list and Turnir detail
 * pages. Keeping all copy in one module makes it easy to revise tour
 * wording without diving into the JSX of the actual pages.
 *
 * <p>Selector convention: every anchor uses {@code [data-tour="…"]}
 * attributes (not classes / ids) so styling refactors don't break
 * the tour by accident. Each data-tour value is declared exactly
 * once in this file's comments and used exactly once in the JSX.
 *
 * <p>Step indices matter — the parent pages key side effects off
 * them in their {@code onStepChange} callback (expanding the
 * filters card, switching tabs on the detail page, …). If you add
 * or remove a step, the corresponding side-effect index in the
 * page component has to move too.
 */

/**
 * Steps shown on the /turniri page. Ends with a step that triggers
 * navigation to a finished tournament so the tour continues on the
 * detail page.
 */
export const TURNIRI_LIST_TOUR_STEPS: Step[] = [
    // 0 — welcome modal. Centered, no target.
    {
        target: "body",
        placement: "center",
        title: "Dobrodošli na Bela Turniri!",
        content:
            "Krenimo sa upoznavanjem sa stranicom — gdje su turniri, kako ih pretraživati te što se sve nalazi na stranici jednog turnira. Klikni \"Dalje\" da krenemo, ili \"Preskoči\" ako želiš sam pogledati.",
        disableBeacon: true,
    },
    // 1 — nav items.
    {
        target: '[data-tour="nav-items"]',
        title: "Glavni izbornik",
        content:
            "Ovo je glavni izbornik. Iz ovog izbornika možeš doći na popis turnira, kalendar, kartu turnira i do alata za pronalazak para za turnir.",
        placement: "bottom",
    },
    // 2 — auth area (login button or avatar).
    {
        target: '[data-tour="nav-auth"]',
        title: "Prijava",
        content:
            "Prijavi se za pristup dodtanim značajkama - vlastitom profilu, statistici, povijesti turnira i organizaciji vlastitih turnira.",
        placement: "bottom",
    },
    // 3 — upcoming list.
    {
        target: '[data-tour="turniri-upcoming"]',
        title: "Nadolazeći turniri",
        content:
            "Ovdje se nalaze svi turniri koji još nisu započeli ili su u tijeku. Turniri su sortirani po datumu — najbliži je gore.",
        placement: "bottom",
    },
    // 4 — finished list.
    {
        target: '[data-tour="turniri-finished"]',
        title: "Završeni turniri",
        content:
            "Ispod nadolazećih turnira nalaze se završeni turniri koje možeš otvoriti i pregledati ždrijeb i pobjednike.",
        placement: "top",
    },
    // 5 — filters intro (collapsed view). The filter card is intentionally
    // left collapsed during the tour — auto-expanding it grew the anchor
    // tall enough that the popper-placed tooltip ended up well below the
    // viewport's centre, disconnected from the spotlight. Keeping it
    // collapsed gives a small anchor and a cleanly-placed tooltip; the
    // user can tap "Filteri" themselves after the tour to explore.
    {
        target: '[data-tour="turniri-filters"]',
        title: "Filteri pretrage",
        content:
            "Ovdje možeš pretraživati turnire po imenu. Klikom na 'Filteri' otvaraš dodatne opcije — filtriraj po lokaciji, cijeni i udaljenosti od tebe.",
        placement: "bottom",
    },
    // 6 — bridge to detail tour. Anchored on the hand-picked demo
    // tournament so the user sees the exact record we're about to
    // open. The parent ensures it's loaded into the rendered list
    // before this step lands (eager load-all on tour start).
    {
        target: '[data-tour="turniri-demo-card"]',
        title: "Pogledajmo jedan turnir",
        content:
            "Klikni \"Dalje\" — otvorit će se upravo ovaj završeni turnir pa možeš vidjeti njegove detalje.",
        placement: "top",
    },
]

/**
 * Steps shown on the /turniri/{slug} page, either as a continuation
 * from the list tour or as a standalone replay from the "Pokaži kako"
 * button. The parent page switches tabs in {@code onStepChange} based
 * on the index of each step (mapping below).
 *
 * <p>Tab map (kept in sync with {@link DETAIL_TOUR_TAB_BY_INDEX} below
 * and the {@code onStepChange} in TournamentDetailsPage):
 *   - 0 → details
 *   - 1 → pairs
 *   - 3 → cjenik
 *   - 4 → bracket
 *
 * <p>Design note — every step in this tour anchors on a tab button
 * (small + stable) or a first-card element (small + stable). An
 * earlier revision also had two "content area" steps that anchored
 * on the entire details box and the entire rounds list. Those huge
 * anchors made the popper-placed tooltip flip to the page bottom
 * (placement: "top" with no room above), visually disconnected from
 * its spotlight. Their content was folded into the adjacent tab
 * intro steps so the tour now describes both the tab AND what's in
 * it from a single, well-anchored tooltip.
 *
 * <p>Also note: an even earlier revision had a "Prijavi svoj par" step
 * that anchored on {@code detail-prijavi-par}. It was removed because
 * the button is only visible to logged-in users on active tournaments,
 * and the demo tournament (finished) doesn't render it — the tour
 * would silently skip the step.
 */
export const TURNIR_DETAIL_TOUR_STEPS: Step[] = [
    // 0 — Detalji tab. Combined intro + content description so the
    // tooltip stays anchored on the small tab button instead of the
    // huge details grid.
    {
        target: '[data-tour="detail-tab-details"]',
        title: "Kartica \"Detalji\"",
        content:
            "Krećemo sa karticom \"Detalji\". Ovdje se nalaze svi osnovni podaci o turniru — lokacija, datum, kotizacija, nagrade i kontakt organizatora.",
        placement: "bottom",
        disableBeacon: true,
    },
    // 1 — Parovi tab (tab switches to "pairs" in the parent).
    {
        target: '[data-tour="detail-tab-pairs"]',
        title: "Kartica \"Parovi\"",
        content:
            "U kartici \"Parovi\" vidiš sve prijavljene parove i njihov status u turniru.",
        placement: "bottom",
    },
    // 2 — One pair card. Small, stable anchor on the first pair.
    {
        target: '[data-tour="detail-first-pair"]',
        title: "Kartica para",
        content:
            "Svaka kartica prikazuje ime para, broj pobjeda i poraza, te tko ga je prijavio. Klikom na karticu otvaraš povijest svih njegovih mečeva u turniru.",
        placement: "top",
    },
    // 3 — Cjenik tab (tab switches to "cjenik" in the parent).
    {
        target: '[data-tour="detail-tab-cjenik"]',
        title: "Kartica \"Cjenik\"",
        content:
            "Kartica \"Cjenik\" služi za organizatore. Ovdje organizator može dodjeliti cijene pića te ih kasnije dodati na račun određenog stola.",
        placement: "bottom",
    },
    // 4 — Ždrijeb tab. Combined intro + rounds description so the
    // tooltip stays anchored on the small tab button instead of the
    // huge rounds list (which sometimes has 8+ tall round cards).
    {
        target: '[data-tour="detail-tab-bracket"]',
        title: "Kartica \"Ždrijeb\"",
        content:
            "Kartica \"Ždrijeb\" prikazuje sva kola turnira, svaki meč i rezultat. Svako kolo je vlastita kartica koju možeš proširiti za prikaz svih mečeva i rezultata.",
        placement: "bottom",
    },
    // 5 — Round-expand + fullscreen explanation. Anchored on the first
    // round so the user has a concrete (small) reference point.
    {
        target: '[data-tour="detail-first-round"]',
        title: "Proširivanje i puni zaslon",
        content:
            "Prošireno kolo prikazuje svaki meč pojedinačno. Klikom na ikonu punog zaslona uz ždrijeb otvaraš veliki prikaz — koristi ga kad pokazuješ rezultate publici ili na velikom ekranu u kafiću.",
        placement: "top",
    },
    // 6 — End-state note (still on bracket tab).
    {
        target: '[data-tour="detail-tab-bracket"]',
        title: "Kraj turnira",
        content:
            "Kad turnir završi, ovdje će biti prikazan cijeli ždrijeb, sva kola s rezultatima i konačni pobjednik. Završeni turniri ostaju vidljivi i kasnije za referencu.",
        placement: "bottom",
    },
    // 7 — Pokaži kako (help replay) + Instaliraj. The parent opens the
    // mobile hamburger drawer on this step because the labeled variants
    // of these two buttons live inside the drawer; on desktop they're
    // always visible in the top right and the same data-tour name
    // resolves to that pair.
    {
        target: '[data-tour="help-install"]',
        title: "Pomoć i instalacija",
        content:
            "Uvijek možeš ponovno pokrenuti ovu turu klikom na upitnik (?) ili instalirati aplikaciju na svoj uređaj klikom na strelicu (↓). Ova dva gumba uvijek su ti dostupna u izborniku.",
        placement: "bottom",
    },
    // 8 — Thank-you / explore farewell.
    {
        target: "body",
        placement: "center",
        title: "To je to!",
        content:
            "Hvala što si pogledao ovaj kratki uvod u stranicu. Sad slobodno razgledaj stranicu — kreiraj svoj turnir, pridruži se postojećem ili samo prati rezultate. Sretno!",
    },
]

/** localStorage keys used by the tours to track whether a user has seen them. */
export const TURNIRI_LIST_TOUR_KEY = "bela-tour-seen:turniri-list"
export const TURNIR_DETAIL_TOUR_KEY = "bela-tour-seen:turnir-detail"

/**
 * Slug of the tournament we always navigate to when the list tour
 * bridges into the detail tour. Hardcoded so the demo lands on a
 * known-good record with all tabs populated (pairs, full bracket,
 * cjenik). If the slug ever doesn't exist in the loaded `finished`
 * list (e.g. on a fresh database or staging without the legacy
 * import), the parent falls back to the first finished tournament
 * and finally the first upcoming card.
 *
 * <p>This is the SQL-imported "1. MEMORIJALNI TURNIR U BELI BENJAMIN
 * BEK" — it has 29 pairs, 8 rounds, a known champion, and the
 * podium fields filled in. Update if you ever re-import or
 * intentionally point the demo at a different tournament.
 */
export const TOUR_DEMO_TOURNAMENT_SLUG = "1-memorijalni-turnir-u-beli-benjamin-bek"

/**
 * sessionStorage key for the cross-page handoff. When the user reaches
 * the last step of the list tour and confirms "Dalje", we set this and
 * navigate to a finished tournament. The detail page reads it on mount
 * and auto-runs its tour as a continuation. Cleared as soon as the
 * detail tour starts so a manual refresh doesn't replay it forever.
 */
export const TOUR_RESUME_DETAIL_KEY = "bela-tour-resume:turnir-detail"

/**
 * Reserved for future use. Earlier revisions of the list tour
 * auto-expanded the filter card when the "Filteri pretrage" step
 * landed, so the user could see the actual inputs being described.
 * That made the `[data-tour="turniri-filters"]` anchor tall enough
 * that the popper-placed tooltip ended up well below the viewport
 * centre, visually disconnected from its spotlight. The expansion
 * was removed and the constants are kept as documentation in case
 * we revisit (likely with a smaller inner anchor + an explicit
 * tooltip placement) rather than re-deleting and re-adding them.
 */
export const LIST_TOUR_OPEN_FILTERS_INDEX = -1
export const LIST_TOUR_AFTER_FILTERS_INDEX = -1

/**
 * Step-index → tab name mapping for the detail tour. The parent
 * applies this in {@code onStepChange} to switch the visible tab as
 * the tour progresses, so the content under each highlighted tab is
 * actually rendered (otherwise the spotlighted tab would be visible
 * but the user wouldn't see what we're talking about underneath).
 *
 * <p>Indices not listed inherit the previous step's tab — e.g. step 2
 * (first-pair card) doesn't appear here because it just keeps the
 * "pairs" tab open from step 1. Same for steps 5 / 6 which both sit on
 * the bracket tab opened at step 4.
 */
export const DETAIL_TOUR_TAB_BY_INDEX: Record<number, "details" | "pairs" | "bracket" | "cjenik"> = {
    0: "details",
    1: "pairs",
    3: "cjenik",
    4: "bracket",
}

/**
 * Joyride positions its tooltip based on the anchor's bounding rect at
 * step-mount time and only re-computes on window scroll / resize. When
 * we mutate the DOM mid-tour (expanding the filter card, switching the
 * tab content under the tab anchor) the spotlight follows correctly
 * but the tooltip stays pinned to the OLD anchor coordinates and
 * appears to "fly off" the element.
 *
 * <p>Fix: nudge popper to re-measure by dispatching a synthetic scroll
 * and resize event AFTER the layout transition has settled. We used to
 * fire four times (rAF, 60 ms, 200 ms, 500 ms) hoping to catch every
 * commit boundary, but each fire that landed mid-transition made
 * popper recompute against an intermediate layout — the tooltip then
 * animated through 3-4 positions before reaching the final one, which
 * read as flicker. Combined with {@code floaterProps.disableAnimation}
 * on PageTour (which removes the tooltip's own tween), a single fire
 * after the layout is known to have stabilised is enough.
 *
 * <p>The 320 ms delay is empirically tuned to land just past Chakra's
 * default content/show transitions (~200-250 ms) plus React 19's
 * commit + paint budget. On slow devices the layout may finish later,
 * but popper's own ResizeObserver picks up the final state — our nudge
 * is a redundancy for environments where the observer is shaky, not
 * the primary positioning mechanism.
 */
export function notifyTourOfLayoutChange(): void {
    if (typeof window === "undefined") return
    window.setTimeout(() => {
        window.dispatchEvent(new Event("scroll"))
        window.dispatchEvent(new Event("resize"))
    }, 320)
}
