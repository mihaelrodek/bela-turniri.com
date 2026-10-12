import { useEffect, useRef, type CSSProperties, type Ref } from "react"
import { Box, Flex } from "@chakra-ui/react"
import type { Card, Seat } from "@bela/protocol"
import type { Declaration, Team } from "@bela/engine"
import { useTranslation } from "../../i18n"
import { useGamePrefs } from "../hooks/useGamePrefs"
import { CARD_METRICS, MADJARICA_HEIGHT, isHungarianDeck } from "../util/cards"
import { SEATS, positionOf, positionVector, teamOf, type TablePosition } from "../util/seats"
import PlayingCard from "./PlayingCard"
import { SHORT, TEAM, WIDE, type TeamSide } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   DeclarationsOnTable — the declared cards lying on the felt (2026-10-11,
   owner: "kao da su igrači fizički položili zvanja na stol").

   The reveal used to be a popup over the whole table. Now, for the server's
   no-play window after `DECLARATIONS_REVEALED`, every seat of the scoring
   pair has its declaration cards face up on the felt just inboard of its
   avatar — a fanned row under the partner (and under a spectator's bottom
   seat), a fanned column beside each flank seat, and a row at the foot of
   the felt for the viewer's own. Only the scoring pair ever has cards here,
   because only the scoring pair's are ever sent (README §1.4). Next to each
   group, at the end facing the table's centre, a small badge says what it
   is worth — "+20", "+150" — and nothing else: the cards are the
   declaration, the number is its value, no word is spoken (owner,
   2026-10-12).

   GEOMETRY is the table's own: every slot is stated against the variables
   `tableGeometry` sets on the table root (`--seat-x`, `--seat-y`,
   `--table-cy`, `--cy-bottom`), the same ones `SEAT_ANCHORS` use, so a slot
   sits exactly where its seat's inner edge is on this screen — phone, web,
   landscape, spectator — and the middle of the felt, which is EMPTY for the
   whole window (no card has been played yet), is what the cards spread
   into. The cards are drawn at `sm` and scaled by `--decl-k`, a touch
   smaller than the hand on a phone and full size on the web.

   MOTION (2026-10-12, owner: "stronger"). Another seat's card is THROWN
   from its avatar in three beats, one WAAPI animation per card: it rises
   out of the avatar away from the centre (28 px further out, 1.06, 180 ms
   ease-out), hangs for 160 ms, then is thrown onto its slot — 280 ms on an
   overshoot curve with a ±6° wobble settling to the slot's angle; 50 ms
   between cards. The badge fades in as the group's last card lands. The
   way OUT, when `leaving` goes true, stays the quick 220 ms deal-out
   toward the avatar (40 ms a card), badge with it; the page unmounts this
   `DECL_EXIT_MS` later. MY OWN cards do neither: they are the real cards
   of my hand flying over (`CardFlight`, driven by the page), so their
   group starts invisible (`myCardsHidden`) and shows — badge fading in —
   once the flight has landed. Reduced motion drops every animation.
   ────────────────────────────────────────────────────────────────────── */

/** The throw-in, one card: rise (180) + hold (160) + throw (280). */
const LIFT_MS = 180
const HOLD_MS = 160
const THROW_MS = 280
export const DECL_THROW_MS = LIFT_MS + HOLD_MS + THROW_MS
/** Stagger between two cards thrown in. */
export const DECL_THROW_STEP_MS = 50
/** Deal-out of another seat's cards when the window closes. */
export const DECL_DEAL_MS = 220
export const DECL_DEAL_STEP_MS = 40
/** Where a card starts (and ends) at its avatar, from its slot. */
const DEAL_DISTANCE = 36
/** How much further out the rise takes it before the throw. */
const LIFT_PX = 28
const LIFT_SCALE = 1.06
const WOBBLE_DEG = 6
const THROW_EASING = "cubic-bezier(0.22, 1.2, 0.36, 1)"
/** The badge's fade, once the last card of its group is down. */
const BADGE_MS = 160
/** The visible strip of every card but the last, in a row and in a column. */
const ROW_EXPOSURE = 26
const COLUMN_EXPOSURE = 26

/** The cards of one seat, as they lie: one group per declaration, side by
 *  side under the top/bottom seats, stacked beside the flanks. */
const FLOW: Record<TablePosition, "row" | "column"> = {
    top: "row",
    bottom: "row",
    left: "column",
    right: "column",
}

/** Where a seat's cards lie, against the table's own geometry variables.
 *  Each slot is anchored at the edge nearest its seat and scales about that
 *  edge, so a bigger or smaller `--decl-k` always grows INWARD, into the
 *  empty middle, never into the seat. `bottom` differs for a spectator
 *  (seat 0 is drawn on the felt and the cards go above it) and for a player
 *  (no bottom seat — the cards sit at the foot of the felt, just above the
 *  hand they came from). */
export type DeclSlotFn = (position: TablePosition, spectator: boolean) => CSSProperties

function slotStyle(position: TablePosition, spectator: boolean): CSSProperties {
    switch (position) {
        case "top":
            return {
                left: "50%",
                top: "calc(100% - var(--cy-bottom) - var(--seat-y) - 8px)",
                transform: "translate(-50%, 0) scale(var(--decl-k, 1))",
                transformOrigin: "top center",
            }
        case "bottom":
            return spectator
                ? {
                      left: "50%",
                      bottom: "calc(100% - var(--table-cy) - var(--seat-y) + 6px)",
                      transform: "translate(-50%, 0) scale(var(--decl-k, 1))",
                      transformOrigin: "bottom center",
                  }
                : {
                      left: "50%",
                      bottom: "2px",
                      transform: "translate(-50%, 0) scale(var(--decl-k, 1))",
                      transformOrigin: "bottom center",
                  }
        case "left":
            return {
                left: "calc(50% - var(--seat-x) + 6px)",
                top: "var(--table-cy)",
                transform: "translate(0, -50%) scale(var(--decl-k, 1))",
                transformOrigin: "left center",
            }
        case "right":
            return {
                right: "calc(50% - var(--seat-x) + 6px)",
                top: "var(--table-cy)",
                transform: "translate(0, -50%) scale(var(--decl-k, 1))",
                transformOrigin: "right center",
            }
    }
}

/** The badge's place beside its group: the EDGE facing the table's centre.
 *  A flank column's inboard side is the one toward the centre, so the badge
 *  hangs off it, vertically centred. A row (top/bottom) used to put it after
 *  its last card — and a seat with TWO declarations (two tercas) laid the
 *  second group right over the first group's badge, so only one "+20" was
 *  ever seen (2026-10-12, owner report). The badge now sits on the row's
 *  inboard edge instead — the bottom edge under the partner, the top edge
 *  of my own row — centred on its own group, where no neighbour can cover
 *  it; and every badge paints above the cards (`zIndex`). */
function badgeStyle(position: TablePosition): CSSProperties {
    switch (position) {
        case "right":
            return { top: "50%", right: "100%", transform: "translate(-6px, -50%)" }
        case "left":
            return { top: "50%", left: "100%", transform: "translate(6px, -50%)" }
        case "top":
            return { left: "50%", top: "100%", transform: "translate(-50%, -8px)" }
        case "bottom":
            return { left: "50%", bottom: "100%", transform: "translate(-50%, 8px)" }
    }
}

export default function DeclarationsOnTable({
    perSeat,
    scoringTeam,
    mySeat,
    leaving,
    myCardsHidden,
    reducedMotion,
    rootRef,
    slotFor = slotStyle,
    scale,
    layout = "portrait",
}: {
    /** The SCORING pair only — what `DECLARATIONS_REVEALED` carries. */
    perSeat: Partial<Record<Seat, Declaration[]>>
    /** …and whose they are, for the badge's colour. */
    scoringTeam: Team | null
    mySeat: Seat | null
    /** The window is over: everybody else's cards deal back to their seats. */
    leaving: boolean
    /** My own group stays invisible while the real cards are in flight. */
    myCardsHidden: boolean
    reducedMotion: boolean
    /** The layer's root, for the page to find my slots (`data-decl-card`)
     *  and measure where the flight has to land. */
    rootRef?: Ref<HTMLDivElement>
    /** Where a seat's cards lie — the portrait slots by default; the
     *  landscape table passes its own map (`landscapeDeclSlot`, 2026-10-12)
     *  so the portrait values are never touched for it. */
    slotFor?: DeclSlotFn
    /** A fixed `--decl-k` in place of the breakpoint steps. */
    scale?: string
    /** `landscape` (sixth pass, 2026-10-12): a flank seat's cards lie in
     *  ROWS like everybody else's — one row per declaration, the rows
     *  stacked — instead of portrait's narrow column. Portrait unchanged. */
    layout?: "portrait" | "landscape"
}) {
    const { t } = useTranslation()
    const [prefs] = useGamePrefs()
    const cardW = Number.parseFloat(CARD_METRICS.sm.w)
    const cardH = Number.parseFloat(isHungarianDeck(prefs.deck) ? MADJARICA_HEIGHT.sm : CARD_METRICS.sm.h)
    const spectator = mySeat === null
    // Team colour is relative to the VIEWER; a spectator looks from seat 0.
    const viewerTeam = teamOf(mySeat ?? 0)
    const side: TeamSide = scoringTeam !== null && scoringTeam !== viewerTeam ? "them" : "us"

    /* Every card node of the OTHER seats, with the direction it is thrown
       from and its stagger index, and every badge with the delay of its
       group's last card — for the WAAPI passes below. */
    const cardNodes = useRef(new Map<Card, { node: HTMLElement; dx: number; dy: number; index: number }>())
    const badgeNodes = useRef(new Map<string, { node: HTMLElement; lastIndex: number; mine: boolean }>())
    const registerCard = (card: Card, dx: number, dy: number, index: number) => (node: HTMLElement | null) => {
        if (node) cardNodes.current.set(card, { node, dx, dy, index })
        else cardNodes.current.delete(card)
    }
    const registerBadge = (key: string, lastIndex: number, mine: boolean) => (node: HTMLElement | null) => {
        if (node) badgeNodes.current.set(key, { node, lastIndex, mine })
        else badgeNodes.current.delete(key)
    }
    const canAnimate = (node: HTMLElement) => typeof node.animate === "function"

    // The throw-in, once, on mount; the other seats' badges follow their
    // group's last card. (Effectively mount-only: the set of cards is fixed
    // for the life of one reveal, and the page remounts the layer per reveal.)
    useEffect(() => {
        if (reducedMotion) return
        const animations: Animation[] = []
        for (const { node, dx, dy, index } of cardNodes.current.values()) {
            if (!canAnimate(node)) continue
            const lift = (f: number) => `translate(${dx + dx / DEAL_DISTANCE * LIFT_PX * f}px, ${dy + dy / DEAL_DISTANCE * LIFT_PX * f}px)`
            animations.push(
                node.animate(
                    [
                        // (a) out of the avatar, away from the centre…
                        { offset: 0, transform: `${lift(0)} scale(1)`, opacity: 0, easing: "ease-out" },
                        { offset: LIFT_MS / DECL_THROW_MS, transform: `${lift(1)} scale(${LIFT_SCALE})`, opacity: 1, easing: "linear" },
                        // (b) …held…
                        { offset: (LIFT_MS + HOLD_MS) / DECL_THROW_MS, transform: `${lift(1)} rotate(${WOBBLE_DEG}deg) scale(${LIFT_SCALE})`, opacity: 1, easing: THROW_EASING },
                        // (c) …and thrown onto the slot, wobbling the other
                        // way on the way down so the overshoot settles the
                        // angle along with the last few px.
                        { offset: (LIFT_MS + HOLD_MS + THROW_MS * 0.7) / DECL_THROW_MS, transform: `translate(${dx * 0.08}px, ${dy * 0.08}px) rotate(${-WOBBLE_DEG}deg) scale(1.03)`, opacity: 1, easing: THROW_EASING },
                        { offset: 1, transform: "translate(0, 0) rotate(0deg) scale(1)", opacity: 1 },
                    ],
                    { duration: DECL_THROW_MS, delay: index * DECL_THROW_STEP_MS, fill: "both" },
                ),
            )
        }
        for (const { node, lastIndex, mine } of badgeNodes.current.values()) {
            if (mine || !canAnimate(node)) continue
            animations.push(
                node.animate([{ opacity: 0 }, { opacity: 1 }], {
                    duration: BADGE_MS,
                    delay: lastIndex * DECL_THROW_STEP_MS + DECL_THROW_MS,
                    easing: "ease-out",
                    fill: "both",
                }),
            )
        }
        return () => animations.forEach((animation) => animation.cancel())
    }, [reducedMotion])

    // My own badge: in as my last card lands (the page flips
    // `myCardsHidden` on the flight's `onDone`).
    useEffect(() => {
        if (myCardsHidden || reducedMotion) return
        const animations: Animation[] = []
        for (const { node, mine } of badgeNodes.current.values()) {
            if (!mine || !canAnimate(node)) continue
            animations.push(node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: BADGE_MS, easing: "ease-out", fill: "both" }))
        }
        return () => animations.forEach((animation) => animation.cancel())
    }, [myCardsHidden, reducedMotion])

    // …and back out towards the seat when the window closes, badges fading
    // with their cards. `fill: forwards` keeps everything gone until the
    // page unmounts the layer.
    useEffect(() => {
        if (!leaving || reducedMotion) return
        const animations: Animation[] = []
        for (const { node, dx, dy, index } of cardNodes.current.values()) {
            if (!canAnimate(node)) {
                node.style.opacity = "0"
                continue
            }
            animations.push(
                node.animate(
                    [
                        { transform: "translate(0, 0)", opacity: 1 },
                        { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
                    ],
                    { duration: DECL_DEAL_MS, delay: index * DECL_DEAL_STEP_MS, easing: "ease-in", fill: "forwards" },
                ),
            )
        }
        for (const { node, mine } of badgeNodes.current.values()) {
            if (mine) continue
            if (!canAnimate(node)) {
                node.style.opacity = "0"
                continue
            }
            animations.push(node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DECL_DEAL_MS, easing: "ease-in", fill: "forwards" }))
        }
        return () => animations.forEach((animation) => animation.cancel())
    }, [leaving, reducedMotion])

    return (
        <Box
            ref={rootRef}
            role="group"
            aria-label={t("game.declarations.title")}
            position="absolute"
            inset="0"
            // Under the seats (z 6) and over the (empty) trick (z 1): a seat's
            // badges may overhang a slot's edge, the cards never cover a face.
            zIndex={4}
            pointerEvents="none"
            css={scale !== undefined
                ? { "--decl-k": scale }
                : {
                    "--decl-k": "0.86",
                    [WIDE]: { "--decl-k": "1" },
                    [SHORT]: { "--decl-k": "0.72" },
                }}
        >
            {SEATS.map((seat) => {
                const declarations = perSeat[seat]
                if (!declarations || declarations.length === 0) return null
                const position = positionOf(seat, mySeat)
                const landscapeFlank = layout === "landscape" && (position === "left" || position === "right")
                // How the cards of ONE declaration run, and how a seat's
                // several declarations sit beside each other.
                const flow = landscapeFlank ? "row" : FLOW[position]
                const seatFlow = landscapeFlank ? "column" : FLOW[position]
                const mine = seat === mySeat
                const vector = positionVector(position)
                let index = 0
                return (
                    <Flex
                        key={seat}
                        data-decl-seat={seat}
                        position="absolute"
                        direction={seatFlow}
                        // A landscape flank's rows hug the seat's side, so
                        // each row's badge sits at its own inboard end.
                        align={landscapeFlank
                            ? (position === "left" ? "flex-start" : "flex-end")
                            : flow === "row" ? "flex-end" : "center"}
                        // Wider between two groups of one seat (2026-10-12):
                        // a badge is 34 px and a second group lay 8 px on.
                        // Stacked rows need less.
                        gap={landscapeFlank ? "2" : "3"}
                        style={slotFor(position, spectator)}
                        // Mine are measured by the page while invisible and
                        // shown the instant the flight lands; visibility,
                        // not display, so the rects exist either way.
                        visibility={mine && myCardsHidden ? "hidden" : undefined}
                    >
                        {declarations.map((declaration) => {
                            const groupKey = `${seat}:${declaration.cards.join("-")}`
                            const firstIndex = index
                            return (
                                <Flex
                                    key={groupKey}
                                    position="relative"
                                    direction={flow}
                                    align="flex-start"
                                    flexShrink={0}
                                >
                                    {declaration.cards.map((card, i) => {
                                        const order = index++
                                        return (
                                            <Box
                                                key={card}
                                                data-decl-card={card}
                                                ref={mine ? undefined : registerCard(card, vector.x * DEAL_DISTANCE, vector.y * DEAL_DISTANCE, order)}
                                                flexShrink={0}
                                                w={`${cardW}px`}
                                                h={`${cardH}px`}
                                                style={
                                                    i === 0
                                                        ? undefined
                                                        : flow === "row"
                                                          ? { marginLeft: `${ROW_EXPOSURE - cardW}px` }
                                                          : { marginTop: `${COLUMN_EXPOSURE - cardH}px` }
                                                }
                                            >
                                                <PlayingCard card={card} size="sm" />
                                            </Box>
                                        )
                                    })}
                                    {/* The value, and only the value. Starts
                                        invisible (the fade sets it) unless
                                        nothing animates at all. */}
                                    <Flex
                                        ref={registerBadge(groupKey, firstIndex + declaration.cards.length - 1, mine)}
                                        as="span"
                                        position="absolute"
                                        zIndex={1}
                                        style={badgeStyle(position)}
                                        align="center"
                                        justify="center"
                                        h="20px"
                                        minW="34px"
                                        px="1.5"
                                        rounded="full"
                                        bg="bg.panel"
                                        borderWidth="1px"
                                        borderColor="border.subtle"
                                        color={TEAM[side]}
                                        fontSize="11px"
                                        fontFamily="mono"
                                        fontWeight="bold"
                                        fontVariantNumeric="tabular-nums"
                                        lineHeight="1"
                                        whiteSpace="nowrap"
                                        boxShadow="0 1px 3px rgba(0,0,0,0.18)"
                                        opacity={reducedMotion ? 1 : 0}
                                    >
                                        +{declaration.points}
                                    </Flex>
                                </Flex>
                            )
                        })}
                    </Flex>
                )
            })}
        </Box>
    )
}
