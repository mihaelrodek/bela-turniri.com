import { useEffect, useState } from "react"
import { Box } from "@chakra-ui/react"
import type { Card as CardId, Seat } from "@bela/protocol"
import type { TrickCard } from "@bela/engine"
import { cardScatter, positionOf, positionVector } from "../util/seats"
import PlayingCard from "./PlayingCard"
import { NARROW, SHORT, TIGHT } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   TrickArea — the middle of the table.

   A card lands in a distinct slot toward the seat that threw it and TILTED
   toward that seat. The four cards form a loose cross instead of one stacked
   pile, so ownership stays obvious throughout the trick. `cardScatter`
   assigns one fixed angle and offset to each table position, so every trick
   forms the same pile.

   The flight is 320 ms from the owner's edge at 45 % opacity, then the trick
   holds (the page's TRICK_HOLD_MS) and slides to the winner. `prefers-
   reduced-motion` — or the manual "Smanji animacije" — drops every
   transition and the cards simply appear.

   This component is PURE: what it is given is what is on the felt. It used to
   keep a sticky copy of the last non-empty trick, because the server clears
   `view.trick` in the same frame that carries TRICK_WON — but that race is
   now handled upstream (`GameRoomPage` renders the trick the event queue has
   released, not the raw view), and the sticky copy had a nasty side effect:
   four cards that had just been swept up would sail back to the middle for
   500 ms as soon as the next event started.
   ────────────────────────────────────────────────────────────────────── */

/** THE PILE IS `md` EVERYWHERE (2026-09-20, user request: "karte koje se
 *  bacaju na stol da su vece"). It used to follow the hand — `sm` on a phone —
 *  which made the four cards everybody is looking at the smallest cards on
 *  screen, most visibly in a browser tab where the hand had already eaten the
 *  height. The hand went the other way at the same time (`xs`, see
 *  `handLayout.ts`), so the felt now reads trick-first.
 *
 *  The type stays a union because `PILE_SCALE` still shrinks the pile on
 *  screens that cannot hold a full one (TIGHT/NARROW/SHORT), and because the
 *  seat clearances in `tableStyles.ts` are stated per size. */
type PileSize = "sm" | "md"

/** How far from the centre a resting card sits, per axis, per card size. The
 *  offsets leave only a small, natural overlap at the corners and make the
 *  throwing seat unambiguous. Seat geometry in tableStyles.ts clears these
 *  extents — `--seat-clear-x` / `--seat-clear-y` are stated against the `sm`
 *  numbers, since that is what a phone draws. */
const REST_X: Record<PileSize, number> = { sm: 50, md: 66 }
/** Tightened 42/54 → 32/42 (2026-09-20, user request: "svi bacaju karte na
 *  sredinu"). The vertical spread is what made the partner's card read as
 *  thrown from far away — the cross now closes up around the centre while the
 *  horizontal offsets, which are what makes the left/right owner obvious,
 *  stay as they were. The seat clearances in tableStyles.ts are stated
 *  against these numbers and only ever had slack to gain. */
const REST_Y: Record<PileSize, number> = { sm: 32, md: 42 }
/** Where a card starts its flight (off toward its owner). */
const FLY_IN: Record<PileSize, number> = { sm: 130, md: 170 }
/** Where the trick slides to when collected. */
const COLLECT: Record<PileSize, number> = { sm: 260, md: 340 }
/** The pile contracts further on screens that cannot fit even this much.
 *  Stated per size, because an `sm` pile is already 0.78 of an `md` one and
 *  shrinking it by the `md` factors again would leave a pile of stamps. */
const PILE_SCALE: Record<PileSize, Record<string, number>> = {
    sm: { [TIGHT]: 0.82, [NARROW]: 0.86, [SHORT]: 0.8 },
    md: { [TIGHT]: 0.86, [NARROW]: 0.76, [SHORT]: 0.66 },
}
/** DESIGN §2.5: 320 ms in, 500 ms out. `COLLECT_MS` is exported because the
 *  page has to know when the sweep is finished before it clears the felt. */
const FLY_MS = 320
export const COLLECT_MS = 500

function ThrownCard({
    entry,
    order,
    mySeat,
    size,
    animateIn,
    collectTo,
    reducedMotion,
}: {
    entry: TrickCard
    /** Play order within the trick — later cards lie on top. */
    order: number
    mySeat: Seat | null
    /** The card size the hand is drawing at this width. */
    size: PileSize
    /** false = this card was already on the felt when we started looking. */
    animateIn: boolean
    collectTo: Seat | null
    reducedMotion: boolean
}) {
    const [landed, setLanded] = useState(reducedMotion || !animateIn)

    useEffect(() => {
        if (reducedMotion || !animateIn) {
            setLanded(true)
            return
        }
        // One frame at the start position, then the transition runs.
        const id = requestAnimationFrame(() => setLanded(true))
        return () => cancelAnimationFrame(id)
    }, [reducedMotion, animateIn])

    const position = positionOf(entry.seat, mySeat)
    const vector = positionVector(position)
    const { tilt, dx, dy } = cardScatter(entry.seat, mySeat)

    let transform: string
    let opacity = 1
    if (collectTo !== null) {
        const away = positionVector(positionOf(collectTo, mySeat))
        transform = `translate(-50%, -50%) translate(${away.x * COLLECT[size]}px, ${away.y * COLLECT[size]}px) rotate(${tilt}deg) scale(0.7)`
        opacity = 0
    } else if (!landed) {
        transform = `translate(-50%, -50%) translate(${vector.x * FLY_IN[size]}px, ${vector.y * FLY_IN[size]}px) rotate(${tilt * 1.6}deg) scale(0.88)`
        opacity = 0.45
    } else {
        // The top seat's transient status chip sits immediately above the
        // trick. Pull only that card a little toward the centre so the chip
        // reads above it instead of touching its top edge.
        const restY = position === "top" ? REST_Y[size] - 8 : REST_Y[size]
        transform = `translate(-50%, -50%) translate(${vector.x * REST_X[size] + dx}px, ${vector.y * restY + dy}px) rotate(${tilt}deg)`
    }

    return (
        <Box
            position="absolute"
            left="0"
            top="0"
            zIndex={order + 1}
            style={{ transform, opacity }}
            transition={
                reducedMotion
                    ? "none"
                    : `transform ${collectTo !== null ? COLLECT_MS : FLY_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity ${collectTo !== null ? COLLECT_MS : FLY_MS}ms ease-out`
            }
        >
            <PlayingCard card={entry.card} size={size} />
        </Box>
    )
}

export default function TrickArea({
    cards,
    mySeat,
    flyIn = null,
    collectTo = null,
    reducedMotion = false,
}: {
    /** Cards on the table — `view.trick.cards`, or the resolved trick while
     *  a TRICK_WON event is being shown. */
    cards: TrickCard[]
    mySeat: Seat | null
    /** Kept in the component contract for game-state callers. The current
     * design deliberately does not mark the card that is holding the trick. */
    holdingSeat?: Seat | null
    /**
     * The one card being thrown right now: the card of the CARD_PLAYED the
     * page's queue has just released. Only that card flies in. Everything
     * else was already lying there — cards hydrated from `view.trick` after a
     * join, rejoin or reconnect above all — and a pile that sails in as a
     * group would claim four people had just thrown at once.
     */
    flyIn?: CardId | null
    /** Winner's seat while the trick is being collected, otherwise null. */
    collectTo?: Seat | null
    reducedMotion?: boolean
}) {
    const size: PileSize = "md"
    const scale = PILE_SCALE[size]
    return (
        // Not aria-hidden: each card carries its Croatian name as an
        // aria-label, and the trick is exactly what a screen-reader user
        // needs read back. pointerEvents:none keeps it out of the way of the
        // hand and the panels layered above it.
        //
        // A ZERO-SIZED anchor sitting on the table's centre — which is
        // `--table-cy` from the top of the block, NOT 50 % of it, because the
        // bottom seat is normally absent (see tableStyles' `tableGeometry`).
        // Every card is placed relative to this point, so the pile, the felt
        // playing cloth and the seats all share one origin. Scaling a zero-sized box
        // scales the whole pile about that point, which is how a short screen
        // shrinks the trick rather than letting it collide with the seats.
        <Box
            position="absolute"
            left="50%"
            top="var(--table-cy, 50%)"
            w="0"
            h="0"
            zIndex={1}
            pointerEvents="none"
            css={{
                [TIGHT]: { transform: `scale(${scale[TIGHT]})` },
                [NARROW]: { transform: `scale(${scale[NARROW]})` },
                [SHORT]: { transform: `scale(${scale[SHORT]})` },
            }}
        >
            {cards.map((entry, index) => (
                <ThrownCard
                    key={`${entry.seat}-${entry.card}`}
                    entry={entry}
                    order={index}
                    mySeat={mySeat}
                    size={size}
                    animateIn={entry.card === flyIn}
                    collectTo={collectTo}
                    reducedMotion={reducedMotion}
                />
            ))}
        </Box>
    )
}
