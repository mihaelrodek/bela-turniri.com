import type { Step } from "react-joyride"
import { t } from "../i18n"

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
 *
 * <p>A FUNCTION, not a module-level constant: the copy comes from the
 * i18n dictionaries via the non-reactive `t` import (this file is plain
 * data, not a component, so there's no `useTranslation()` hook to
 * subscribe with). Building the array once at module load would freeze
 * every step in whatever locale was active at first import — a language
 * switch would never reach it. Callers must invoke this at render/use
 * time (e.g. `steps={TURNIRI_LIST_TOUR_STEPS()}`) so each run of the
 * tour picks up the current locale.
 */
export function TURNIRI_LIST_TOUR_STEPS(): Step[] {
    return [
        // 0 — welcome modal. Centered, no target.
        {
            target: "body",
            placement: "center",
            title: t("common.tour.list.welcome.title"),
            content: t("common.tour.list.welcome.content"),
            disableBeacon: true,
        },
        // 1 — nav items.
        {
            target: '[data-tour="nav-items"]',
            title: t("common.tour.list.navItems.title"),
            content: t("common.tour.list.navItems.content"),
            placement: "bottom",
        },
        // 2 — auth area (login button or avatar).
        {
            target: '[data-tour="nav-auth"]',
            title: t("common.tour.list.navAuth.title"),
            content: t("common.tour.list.navAuth.content"),
            placement: "bottom",
        },
        // 3 — upcoming list.
        {
            target: '[data-tour="turniri-upcoming"]',
            title: t("common.tour.list.upcoming.title"),
            content: t("common.tour.list.upcoming.content"),
            placement: "bottom",
        },
        // 4 — finished list.
        {
            target: '[data-tour="turniri-finished"]',
            title: t("common.tour.list.finished.title"),
            content: t("common.tour.list.finished.content"),
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
            title: t("common.tour.list.filters.title"),
            content: t("common.tour.list.filters.content"),
            placement: "bottom",
        },
        // 6 — bridge to detail tour. Anchored on the hand-picked demo
        // tournament so the user sees the exact record we're about to
        // open. The parent ensures it's loaded into the rendered list
        // before this step lands (eager load-all on tour start).
        {
            target: '[data-tour="turniri-demo-card"]',
            title: t("common.tour.list.demoCard.title"),
            content: t("common.tour.list.demoCard.content"),
            placement: "top",
        },
    ]
}

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
 *
 * <p>A FUNCTION, not a module-level constant — see the docstring on
 * {@link TURNIRI_LIST_TOUR_STEPS} for why. Call it at render/use time
 * (e.g. `steps={TURNIR_DETAIL_TOUR_STEPS()}`).
 */
export function TURNIR_DETAIL_TOUR_STEPS(): Step[] {
    return [
        // 0 — Detalji tab. Combined intro + content description so the
        // tooltip stays anchored on the small tab button instead of the
        // huge details grid.
        {
            target: '[data-tour="detail-tab-details"]',
            title: t("common.tour.detail.details.title"),
            content: t("common.tour.detail.details.content"),
            placement: "bottom",
            disableBeacon: true,
        },
        // 1 — Parovi tab (tab switches to "pairs" in the parent).
        {
            target: '[data-tour="detail-tab-pairs"]',
            title: t("common.tour.detail.pairs.title"),
            content: t("common.tour.detail.pairs.content"),
            placement: "bottom",
        },
        // 2 — One pair card. Small, stable anchor on the first pair.
        {
            target: '[data-tour="detail-first-pair"]',
            title: t("common.tour.detail.firstPair.title"),
            content: t("common.tour.detail.firstPair.content"),
            placement: "top",
        },
        // 3 — Cjenik tab (tab switches to "cjenik" in the parent).
        {
            target: '[data-tour="detail-tab-cjenik"]',
            title: t("common.tour.detail.cjenik.title"),
            content: t("common.tour.detail.cjenik.content"),
            placement: "bottom",
        },
        // 4 — Ždrijeb tab. Combined intro + rounds description so the
        // tooltip stays anchored on the small tab button instead of the
        // huge rounds list (which sometimes has 8+ tall round cards).
        {
            target: '[data-tour="detail-tab-bracket"]',
            title: t("common.tour.detail.bracket.title"),
            content: t("common.tour.detail.bracket.content"),
            placement: "bottom",
        },
        // 5 — Round-expand + fullscreen explanation. Anchored on the first
        // round so the user has a concrete (small) reference point.
        {
            target: '[data-tour="detail-first-round"]',
            title: t("common.tour.detail.firstRound.title"),
            content: t("common.tour.detail.firstRound.content"),
            placement: "top",
        },
        // 6 — End-state note (still on bracket tab).
        {
            target: '[data-tour="detail-tab-bracket"]',
            title: t("common.tour.detail.endState.title"),
            content: t("common.tour.detail.endState.content"),
            placement: "bottom",
        },
        // 7 — Pokaži kako (help replay) + Instaliraj. The parent opens the
        // mobile hamburger drawer on this step because the labeled variants
        // of these two buttons live inside the drawer; on desktop they're
        // always visible in the top right and the same data-tour name
        // resolves to that pair.
        {
            target: '[data-tour="help-install"]',
            title: t("common.tour.detail.helpInstall.title"),
            content: t("common.tour.detail.helpInstall.content"),
            placement: "bottom",
        },
        // 8 — Thank-you / explore farewell.
        {
            target: "body",
            placement: "center",
            title: t("common.tour.detail.farewell.title"),
            content: t("common.tour.detail.farewell.content"),
        },
    ]
}

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
