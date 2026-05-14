import { useEffect, useRef, useState } from "react"
import Joyride, {
    type CallBackProps,
    type Step,
    ACTIONS,
    EVENTS,
    STATUS,
} from "react-joyride"

/**
 * Wrapper around {@link Joyride} with Chakra-matched theming, Croatian
 * button labels, and a localStorage seen-flag so first-time visitors
 * see the tour automatically without nagging returning users.
 *
 * <p>Two control modes wired together:
 *   - <b>Auto-launch on first visit</b>: when {@code seenStorageKey} is
 *     supplied and {@code localStorage} has no entry for it, the tour
 *     fires automatically a short moment after mount (the delay gives
 *     the page's React tree a chance to render the target elements
 *     before Joyride tries to resolve their CSS selectors).
 *   - <b>Manual replay</b>: parents can pass {@code forceRun} to bypass
 *     the seen-flag entirely. Used by the "Pokaži kako" help button
 *     in the navbar so a user can re-run the tour whenever they want.
 *
 * <p>Completing or skipping the tour marks the seen-flag so the auto
 * path doesn't fire again. Replays via {@code forceRun} don't touch
 * the flag — the manual button is the user's choice and doesn't
 * count as "I've seen this".
 *
 * <p>Why we forward STEP_AFTER events to the caller via
 * {@link onStepChange}: some tours need to switch tabs or scroll a
 * specific element into view between steps. Joyride doesn't do that
 * itself; the caller can react to step transitions however they want.
 */
export default function PageTour({
    steps,
    seenStorageKey,
    forceRun,
    onFinished,
    onStepChange,
    autoStartDelayMs = 400,
}: {
    /** Joyride step descriptors — see react-joyride docs for shape. */
    steps: Step[]
    /**
     * localStorage key for the seen-flag. When set and the entry is
     * present, the auto-launch is suppressed. Omit (or pass undefined)
     * to disable the seen-flag entirely — useful for tours that should
     * always run on the trigger event.
     */
    seenStorageKey?: string
    /**
     * Force the tour to run regardless of the seen-flag. The "Pokaži
     * kako" help button toggles this. When it transitions from false
     * to true the tour starts; setting back to false stops it.
     */
    forceRun?: boolean
    /**
     * Fires once when the tour ends. The {@code skipped} flag is true
     * when the user pressed "Preskoči" or clicked the close (X) button —
     * both are treated as the user opting out. False on a normal
     * "Završi" completion. Callers can branch on this to e.g. suppress
     * a bridge navigation to another tour: skipping should halt the
     * entire onboarding flow, completing should keep it going.
     */
    onFinished?: (info: { skipped: boolean }) => void
    /** Fires after each step transition. Receives the new step index. */
    onStepChange?: (nextIndex: number) => void
    /**
     * Delay between mount and the auto-launch. The target elements may
     * not be in the DOM at mount time (e.g. they render after a data
     * fetch). 400 ms is generous enough for typical loads without
     * making the user wait visibly long.
     */
    autoStartDelayMs?: number
}) {
    const [run, setRun] = useState(false)

    // NB: we used to body-lock scroll (overflow: hidden on html + body)
    // while the tour ran, but that broke Joyride's ability to scroll the
    // next anchor into view when the layout changed mid-tour. Specifically:
    //   - the "Što sve možeš filtrirati" step expects the filter card to
    //     grow as filtersOpen flips true,
    //   - the tab-switch steps swap entire chunks of content under the
    //     fold.
    // With overflow:hidden, the anchor would sit somewhere off-screen
    // and the tooltip would be rendered at the off-screen coordinates,
    // looking "kicked out of view". Dropping the lock lets Joyride's
    // own setView/scrollTo land each step properly. The visible overlay
    // is still strong enough to discourage the user from manually
    // panning away mid-step.

    // Auto-launch logic. Runs on mount; honours the seen-flag if a key
    // was supplied. forceRun overrides everything — when it flips true
    // we run immediately, when it flips back to false the tour stops.
    useEffect(() => {
        if (forceRun) {
            setRun(true)
            return
        }
        if (forceRun === false) {
            // Explicit reset from the parent (e.g. dialog closed).
            // Leaves seen-flag alone.
            setRun(false)
            return
        }
        // Auto-launch path — only when forceRun is undefined and seen
        // flag isn't yet set.
        if (seenStorageKey == null) return
        const seen = typeof window !== "undefined"
            && window.localStorage.getItem(seenStorageKey)
        if (seen) return
        const handle = setTimeout(() => setRun(true), autoStartDelayMs)
        return () => clearTimeout(handle)
    }, [seenStorageKey, forceRun, autoStartDelayMs])

    // Guard against firing onFinished twice for the same tour run. Joyride
    // can emit overlapping events when the close (X) button is clicked —
    // first an ACTIONS.CLOSE callback, then a STATUS.SKIPPED one as the
    // internal state catches up. We only want to fire the parent callback
    // once per run, so a ref tracks whether we've already handled the end.
    // Reset on every fresh start (the auto-launch effect below + the
    // forceRun branch both flip `run` from false to true).
    const finishedRef = useRef(false)
    useEffect(() => {
        if (run) finishedRef.current = false
    }, [run])

    function handleCallback(data: CallBackProps) {
        const { status, type, index, action } = data

        // Forward step transitions to the parent so it can switch tabs
        // / scroll into view / etc. STEP_AFTER fires when the user
        // moves on; TARGET_NOT_FOUND lets us skip gracefully if a step
        // anchors on something that didn't render.
        if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
            onStepChange?.(index + 1)
        }

        // Three ways the tour can end:
        //   - STATUS.FINISHED: user clicked "Završi" on the last step.
        //   - STATUS.SKIPPED:  user clicked "Preskoči" (the skip button
        //                       wired through Joyride's locale).
        //   - ACTIONS.CLOSE:   user clicked the (X) close button in the
        //                       tooltip header. Without explicit handling
        //                       Joyride would just pause the tour (status
        //                       transitions to PAUSED), so the seen-flag
        //                       wouldn't be written and the tour would
        //                       auto-relaunch on the next visit. We want
        //                       X to behave identically to Preskoči.
        const closedByX = action === ACTIONS.CLOSE
        const skippedByButton = status === STATUS.SKIPPED
        const completed = status === STATUS.FINISHED
        if ((closedByX || skippedByButton || completed) && !finishedRef.current) {
            finishedRef.current = true
            setRun(false)
            if (seenStorageKey && typeof window !== "undefined") {
                window.localStorage.setItem(seenStorageKey, "1")
            }
            onFinished?.({ skipped: closedByX || skippedByButton })
        }
    }

    return (
        <Joyride
            run={run}
            steps={steps}
            continuous
            showSkipButton
            showProgress
            scrollToFirstStep
            disableOverlayClose
            // Disable Joyride's "if the anchor sits inside an overflow:scroll
            // parent, fix the parent's scroll position before measuring"
            // behaviour. Our Card components have rounded-corner overflow
            // clipping that confused the fix into computing tooltip offsets
            // against the wrong scroll parent, especially after tab-content
            // swaps changed the document height. Without it, popper just
            // uses the window as the reference and lands the tooltip at the
            // anchor's actual viewport coordinates.
            disableScrollParentFix
            // Important on mobile: lets Joyride scroll the highlighted
            // element into view if it's below the fold. Default behaviour
            // is to keep the page static, which means on a phone the
            // user might not see what's being highlighted.
            scrollOffset={80}
            // NB: we briefly set `floaterProps={{ disableAnimation: true }}`
            // here to suppress intermediate position tweens during the
            // filter-expand and tab-swap transitions. Turned out
            // react-floater uses its animation loop as the trigger for
            // popper to recompute final coordinates after the anchor
            // settles — with it disabled, the tooltip stayed pinned to
            // the position popper had calculated before the React
            // commit, so on the detail page every tab-swap step landed
            // the tooltip in the bottom-left corner. We rely on small,
            // stable anchors (single tab buttons / first-card elements)
            // instead, which don't produce visible intermediate
            // positions even with animation on.
            callback={handleCallback}
            locale={{
                back: "Natrag",
                close: "Zatvori",
                last: "Završi",
                next: "Dalje",
                skip: "Preskoči",
                open: "Otvori",
                nextLabelWithProgress: "Dalje ({step}/{steps})",
            }}
            styles={{
                options: {
                    // Chakra "blue.solid" — keeps the tour buttons +
                    // beacon visually consistent with the rest of the
                    // app's primary action colour.
                    primaryColor: "#3182CE",
                    zIndex: 2000,
                    arrowColor: "var(--chakra-colors-bg)",
                    backgroundColor: "var(--chakra-colors-bg)",
                    textColor: "var(--chakra-colors-fg)",
                    overlayColor: "rgba(0, 0, 0, 0.55)",
                },
                tooltipContainer: {
                    textAlign: "left",
                },
            }}
        />
    )
}
