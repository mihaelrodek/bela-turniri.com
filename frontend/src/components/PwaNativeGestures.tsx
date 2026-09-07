import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Box } from "@chakra-ui/react"
import { FiChevronLeft, FiRefreshCw } from "react-icons/fi"
import { queryClient } from "../queryClient"

/**
 * Installed PWAs (display-mode: standalone) run with no browser chrome, so
 * two gestures users expect from "an app" silently vanish:
 *   - pull-down-to-reload (Chrome/Safari normally own this on document
 *     scrollTop 0, but standalone display mode opts out of it entirely)
 *   - edge-swipe-back (iOS Safari's left-edge swipe is a Safari UI feature,
 *     not something WebKit gives a standalone home-screen app)
 *
 * Both are reimplemented here in plain touch events, gated to standalone
 * mode only — a normal browser tab already has the real thing and doesn't
 * need a JS impostor competing with it.
 */

const EDGE_WIDTH = 24 // px from the left edge a back-swipe must start within
const BACK_THRESHOLD = 80 // px dragged right before release triggers navigate(-1)
const MAX_BACK_DRAG = 120 // visual cap on the slide-over distance
const PULL_THRESHOLD = 64 // px pulled down before release triggers a reload
const MAX_PULL = 90 // visual cap on the pull-down distance

function isStandalone(): boolean {
    if (typeof window === "undefined") return false
    // iOS Safari exposes the legacy non-standard `navigator.standalone`; every
    // other engine answers the display-mode media query instead.
    const iosStandalone =
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    const mediaStandalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false
    return iosStandalone || mediaStandalone
}

/** Walk up from the touched element to the nearest actually-scrollable
 *  ancestor and return ITS scrollTop — not the document's. Pages with an
 *  inner scroll container (dialogs, the round list) move that box while the
 *  body never scrolls, so checking document.scrollingElement would fire
 *  pull-to-refresh mid-scroll of that inner list. */
function nearestScrollTop(node: EventTarget | null): number {
    let el = node instanceof Element ? node : null
    while (el && el !== document.body) {
        const style = getComputedStyle(el)
        if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) {
            return el.scrollTop
        }
        el = el.parentElement
    }
    return document.scrollingElement?.scrollTop ?? 0
}

/** True while any modal dialog is mounted and open. Pull-to-refresh inside an
 *  open dialog is never what the user meant — they are dragging the sheet's own
 *  content, and reloading the document would throw away everything they typed. */
function isDialogOpen(): boolean {
    return !!document.querySelector(
        '[role="dialog"], [role="alertdialog"], [data-scope="dialog"][data-state="open"]',
    )
}

/** The Leaflet map owns its own touch panning. Calling preventDefault on a
 *  drag that starts over the map (the left edge included — Croatia sits at the
 *  left of the default viewport) would freeze the map instead of panning it. */
function isInsideMap(node: EventTarget | null): boolean {
    return node instanceof Element && !!node.closest(".leaflet-container")
}

/** Document-level scroll position, independent of any inner scroll box. */
function documentScrollTop(): number {
    return document.scrollingElement?.scrollTop ?? window.scrollY ?? 0
}

type GestureMode = "none" | "pull" | "back" | "scroll"

/**
 * Pull-to-refresh used to just `window.location.reload()` — a full document
 * reload, throwing away the persisted TanStack Query cache's in-memory state
 * and any client-only UI state (open dialogs, scroll position, unsent form
 * input elsewhere on the page) for what the user experiences as "refresh
 * this list". Refetching through the query client gets the same fresh data
 * without any of that collateral damage.
 *
 * `invalidateQueries()` with no filter marks every query stale and (by
 * default) refetches the ones with active observers — i.e. exactly what's
 * currently mounted and visible, which is what a pull gesture on a specific
 * screen means. The extra `refetchQueries()` catches anything that opted out
 * of query-level auto-refetch. The `bela:refresh` event lets a page that
 * needs to react beyond its own queries (e.g. clearing a local selection or
 * reopening a poll) hook in later without this component knowing about it.
 *
 * `queryClient` is a plain module-level export and always defined in
 * practice, but the reload fallback stays as a defensive last resort — pull-
 * to-refresh existing at all is more important than it always being the
 * fancy version.
 */
async function refreshViaQueryClient() {
    try {
        if (!queryClient) {
            window.location.reload()
            return
        }
        await queryClient.invalidateQueries()
        await queryClient.refetchQueries()
        window.dispatchEvent(new CustomEvent("bela:refresh"))
    } catch {
        window.location.reload()
    }
}

export default function PwaNativeGestures() {
    const navigate = useNavigate()
    const [pullDistance, setPullDistance] = useState(0)
    const [refreshing, setRefreshing] = useState(false)
    const [backDistance, setBackDistance] = useState(0)

    useEffect(() => {
        if (!isStandalone()) return

        const g = {
            mode: "none" as GestureMode,
            startX: 0,
            startY: 0,
            distance: 0,
            /** Touch started over the map — never latch a back-swipe from there. */
            overMap: false,
        }

        // The touchmove listener starts PASSIVE so it only classifies the
        // gesture: a non-passive listener on window tells the browser every
        // scroll might be cancelled, which costs a frame on each touch move
        // across the whole app. Only once a gesture has actually latched into
        // "pull" or "back" do we swap the same handler to non-passive, which is
        // the only state in which we ever call preventDefault.
        let nonPassive = false

        function attachNonPassive() {
            if (nonPassive) return
            nonPassive = true
            window.removeEventListener("touchmove", onTouchMove)
            window.addEventListener("touchmove", onTouchMove, { passive: false })
        }

        function attachPassive() {
            if (!nonPassive) return
            nonPassive = false
            window.removeEventListener("touchmove", onTouchMove)
            window.addEventListener("touchmove", onTouchMove, { passive: true })
        }

        function onTouchStart(e: TouchEvent) {
            if (e.touches.length !== 1 || refreshing) return
            const t = e.touches[0]
            g.mode = "none"
            g.startX = t.clientX
            g.startY = t.clientY
            g.distance = 0
            g.overMap = isInsideMap(e.target)
        }

        function onTouchMove(e: TouchEvent) {
            if (e.touches.length !== 1 || g.mode === "scroll") return
            const t = e.touches[0]
            const dx = t.clientX - g.startX
            const dy = t.clientY - g.startY

            if (g.mode === "none") {
                if (g.startX <= EDGE_WIDTH && dx > 12 && Math.abs(dy) < dx && !g.overMap) {
                    g.mode = "back"
                    attachNonPassive()
                } else if (
                    dy > 12
                    && Math.abs(dx) < dy
                    // Both scroll positions must be at the very top: the inner
                    // box the finger is over AND the document itself.
                    && nearestScrollTop(e.target) === 0
                    && documentScrollTop() === 0
                    // …and no modal is up, or a drag inside a dialog would
                    // reload the page and discard what the user typed.
                    && !isDialogOpen()
                ) {
                    g.mode = "pull"
                    attachNonPassive()
                } else if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
                    g.mode = "scroll"
                    return
                }
            }

            if (g.mode === "back") {
                if (e.cancelable) e.preventDefault()
                g.distance = Math.min(MAX_BACK_DRAG, dx * 0.6)
                setBackDistance(g.distance)
            } else if (g.mode === "pull") {
                if (e.cancelable) e.preventDefault()
                g.distance = Math.min(MAX_PULL, dy * 0.5)
                setPullDistance(g.distance)
            }
        }

        function onTouchEnd() {
            if (g.mode === "back") {
                if (g.distance >= BACK_THRESHOLD) navigate(-1)
                setBackDistance(0)
            } else if (g.mode === "pull") {
                if (g.distance >= PULL_THRESHOLD) {
                    setRefreshing(true)
                    setPullDistance(PULL_THRESHOLD)
                    // Reload is the fallback INSIDE this — a genuinely broken
                    // query client still gets the old full-reload behaviour
                    // rather than a permanently spinning indicator.
                    void refreshViaQueryClient().finally(() => {
                        setRefreshing(false)
                        setPullDistance(0)
                    })
                } else {
                    setPullDistance(0)
                }
            }
            g.mode = "none"
            attachPassive()
        }

        window.addEventListener("touchstart", onTouchStart, { passive: true })
        window.addEventListener("touchmove", onTouchMove, { passive: true })
        window.addEventListener("touchend", onTouchEnd, { passive: true })
        window.addEventListener("touchcancel", onTouchEnd, { passive: true })
        return () => {
            window.removeEventListener("touchstart", onTouchStart)
            window.removeEventListener("touchmove", onTouchMove)
            window.removeEventListener("touchend", onTouchEnd)
            window.removeEventListener("touchcancel", onTouchEnd)
        }
    }, [navigate, refreshing])

    if (!isStandalone()) return null

    const pullReady = pullDistance >= PULL_THRESHOLD
    const backReady = backDistance >= BACK_THRESHOLD

    return (
        <>
            {(pullDistance > 0 || refreshing) && (
                <Box
                    position="fixed"
                    top={`calc(env(safe-area-inset-top, 0px) + ${Math.max(pullDistance - 36, 4)}px)`}
                    left="50%"
                    transform="translateX(-50%)"
                    zIndex="max"
                    pointerEvents="none"
                    bg="bg.panel"
                    color={pullReady || refreshing ? "blue.fg" : "fg.muted"}
                    borderRadius="full"
                    boxShadow="0 4px 16px rgba(0, 0, 0, 0.25)"
                    p="2"
                    display="flex"
                    css={{
                        transition: refreshing ? "none" : "opacity 0.15s",
                        opacity: Math.min(1, pullDistance / PULL_THRESHOLD),
                    }}
                >
                    <Box
                        as={FiRefreshCw}
                        boxSize="18px"
                        // `spin` is one of Chakra v3's built-in keyframes (it
                        // ships with defaultConfig, which system.ts extends) —
                        // no custom @keyframes block needed anywhere.
                        animationName={refreshing ? "spin" : undefined}
                        animationDuration={refreshing ? "0.6s" : undefined}
                        css={
                            refreshing
                                ? { animationTimingFunction: "linear", animationIterationCount: "infinite" }
                                : {
                                    transform: `rotate(${pullDistance * 3}deg)`,
                                    transition: "transform 0.05s linear",
                                }
                        }
                    />
                </Box>
            )}
            {backDistance > 0 && (
                <Box
                    position="fixed"
                    top="0"
                    left="0"
                    bottom="0"
                    zIndex="max"
                    pointerEvents="none"
                    display="flex"
                    alignItems="center"
                    pl="2"
                    color={backReady ? "blue.fg" : "fg.muted"}
                    css={{
                        opacity: Math.min(1, backDistance / BACK_THRESHOLD),
                        transform: `translateX(${Math.min(backDistance, 28) - 28}px)`,
                    }}
                >
                    <FiChevronLeft size={26} />
                </Box>
            )}
        </>
    )
}
