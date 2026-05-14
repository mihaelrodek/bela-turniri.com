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
    // 5 — filters intro (collapsed view). After this step the parent
    // opens the filters card so the next step lands on the contents.
    {
        target: '[data-tour="turniri-filters"]',
        title: "Filteri pretrage",
        content:
            "Ovdje možeš pretraživati turnire i filtrirati po određenim kriterijima.",
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
 *   - 2 → pairs
 *   - 4 → cjenik
 *   - 5 → bracket
 *
 * <p>Note: an earlier revision had a "Prijavi svoj par" step at index 3
 * that anchored on {@code detail-prijavi-par}. It was removed because
 * the button is only visible to logged-in users on active tournaments,
 * and the demo tournament (finished) doesn't render it — the tour would
 * silently skip the step. All indices below shifted by one when that
 * step was deleted; the tab-index map at the bottom of this file
 * reflects the post-shift numbers.
 */
export const TURNIR_DETAIL_TOUR_STEPS: Step[] = [
    // 0 — Detalji tab (tab switch happens in the parent callback).
    {
        target: '[data-tour="detail-tab-details"]',
        title: "Kartica \"Detalji\"",
        content:
            "Krećemo sa karticom \"Detalji\" koja sadrži osnovne informacije o turniru.",
        placement: "bottom",
        disableBeacon: true,
    },
    // 1 — details content area.
    {
        target: '[data-tour="detail-content-details"]',
        title: "Informacije o turniru",
        content:
            "Ovdje se nalaze svi detalji turnira - lokacija, datum, kotizacija, nagrade i kontakt organizatora.",
        placement: "top",
    },
    // 2 — Parovi tab (tab switches to "pairs" in the parent).
    {
        target: '[data-tour="detail-tab-pairs"]',
        title: "Kartica \"Parovi\"",
        content:
            "U kartici \"Parovi\" vidiš sve prijavljene parove i njihov status u turniru.",
        placement: "bottom",
    },
    // 3 — One pair card.
    {
        target: '[data-tour="detail-first-pair"]',
        title: "Kartica para",
        content:
            "Svaka kartica prikazuje ime para, broj pobjeda i poraza, te tko ga je prijavio. Klikom na karticu otvaraš povijest svih njegovih mečeva u turniru.",
        placement: "top",
    },
    // 4 — Cjenik tab (tab switches to "cjenik" in the parent).
    {
        target: '[data-tour="detail-tab-cjenik"]',
        title: "Kartica \"Cjenik\"",
        content:
            "Kartica \"Cjenik\" služi za organizatore. Ovdje organizator može dodjeliti cijene pića te ih kasnije dodati na račun određenog stola.",
        placement: "bottom",
    },
    // 5 — Ždrijeb tab (tab switches to "bracket" in the parent).
    {
        target: '[data-tour="detail-tab-bracket"]',
        title: "Kartica \"Ždrijeb\"",
        content:
            "Kartica \"Ždrijeb\" prikazuje sva kola turnira, svaki meč i rezultat.",
        placement: "bottom",
    },
    // 6 — Rounds list (bracket tab is sticky from step 5).
    {
        target: '[data-tour="detail-rounds"]',
        title: "Kola turnira",
        content:
            "Svako kolo je vlastita kartica. Klikom na zaglavlje kola možeš ga proširiti i vidjeti sve mečeve po stolovima i rezultate.",
        placement: "top",
    },
    // 7 — Round-expand + fullscreen explanation. Anchored on the first
    // round so the user has a concrete reference point.
    {
        target: '[data-tour="detail-first-round"]',
        title: "Proširivanje i puni zaslon",
        content:
            "Prošireno kolo prikazuje svaki meč pojedinačno. Klikom na ikonu punog zaslona uz ždrijeb otvaraš veliki prikaz — koristi ga kad pokazuješ rezultate publici ili na velikom ekranu u kafiću.",
        placement: "top",
    },
    // 8 — End-state note (still on bracket tab).
    {
        target: '[data-tour="detail-tab-bracket"]',
        title: "Kraj turnira",
        content:
            "Kad turnir završi, ovdje će biti prikazan cijeli ždrijeb, sva kola s rezultatima i konačni pobjednik. Završeni turniri ostaju vidljivi i kasnije za referencu.",
        placement: "bottom",
    },
    // 9 — Thank-you / explore farewell.
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
 * Step indices on the list tour that toggle the filters card. The
 * parent reads this in its {@code onStepChange} callback to expand
 * the panel when the filters intro step lands (so the user actually
 * sees the location / price / radius inputs being described) and
 * collapse it again as soon as the tour moves on to the next step.
 *
 * <p>Current step layout:
 *   - 5 → "Filteri pretrage" intro (filters open here)
 *   - 6 → "Pogledajmo jedan turnir" bridge to demo card (filters close)
 *
 * <p>Keep this in sync with {@link TURNIRI_LIST_TOUR_STEPS}. If a step
 * is added before the filters step, both constants shift by one.
 */
export const LIST_TOUR_OPEN_FILTERS_INDEX = 5  // index of "filters intro" step
export const LIST_TOUR_AFTER_FILTERS_INDEX = 6 // first index after filters are done

/**
 * Step-index → tab name mapping for the detail tour. The parent
 * applies this in {@code onStepChange} to switch the visible tab as
 * the tour progresses, so the content under each highlighted tab is
 * actually rendered (otherwise the spotlighted tab would be visible
 * but the user wouldn't see what we're talking about underneath).
 *
 * <p>Indices not listed inherit the previous step's tab — e.g. step 3
 * (first-pair card) doesn't appear here because it just keeps the
 * "pairs" tab open from step 2. Same for steps 6/7/8 which all sit on
 * the bracket tab opened at step 5.
 */
export const DETAIL_TOUR_TAB_BY_INDEX: Record<number, "details" | "pairs" | "bracket" | "cjenik"> = {
    0: "details",
    2: "pairs",
    4: "cjenik",
    5: "bracket",
}

/**
 * Joyride positions its tooltip based on the anchor's bounding rect at
 * step-mount time and only re-computes on window scroll / resize. When
 * we mutate the DOM mid-tour (expanding the filter card, switching the
 * tab content under the tab anchor) the spotlight follows correctly
 * but the tooltip stays pinned to the OLD anchor coordinates and
 * appears to "fly off" the element.
 *
 * <p>Fix: nudge popper to re-measure by dispatching synthetic scroll
 * and resize events at several timings. We hit four moments:
 *   - next animation frame (best case — fast, simple layout shifts),
 *   - 60 ms (catches React 19's auto-batched commits),
 *   - 200 ms (catches Chakra's lazy CSS transitions),
 *   - 500 ms (belt-and-suspenders for slow devices / heavier DOM trees).
 *
 * <p>Each dispatch is idempotent — popper / react-floater no-op on
 * positions that haven't actually changed, so firing the same event
 * four times just costs a few cycles. We also dispatch both event
 * types because popper subscribes to both and which one wakes it up
 * varies across versions.
 */
export function notifyTourOfLayoutChange(): void {
    if (typeof window === "undefined") return
    const fire = () => {
        window.dispatchEvent(new Event("scroll"))
        window.dispatchEvent(new Event("resize"))
    }
    requestAnimationFrame(fire)
    window.setTimeout(fire, 60)
    window.setTimeout(fire, 200)
    window.setTimeout(fire, 500)
}
