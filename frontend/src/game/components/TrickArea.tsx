import { useEffect, useState } from "react"
import { Box } from "@chakra-ui/react"
import type { Card as CardId, Seat } from "@bela/protocol"
import type { TrickCard } from "@bela/engine"
import { cardScatter, positionOf, positionVector } from "../util/seats"
import PlayingCard from "./PlayingCard"
import { SHORT, TIGHT } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   TrickArea — the middle of the table.

   A card lands in a distinct slot toward the seat that threw it and TILTED
   toward that seat. The four cards form a loose cross instead of one stacked
   pile, so ownership stays obvious throughout the trick. The angles come
   from `cardScatter`, seeded by (seat, trick index): stable across every
   re-render of the same trick, different from one trick to the next.

   The flight is 250 ms from the owner's edge at 45 % opacity, then the trick
   holds (the page's TRICK_HOLD_MS) and slides to the winner. `prefers-
   reduced-motion` — or the manual "Smanji animacije" — drops every
   transition and the cards simply appear.

   This component is PURE: what it is given is what is on the felt. It used to
   keep a sticky copy of the last non-empty trick, because the server clears
   `view.trick` in the same frame that carries TRICK_WON — but that race is
   now handled upstream (`GameRoomPage` renders the trick the event queue has
   released, not the raw view), and the sticky copy had a nasty side effect:
   four cards that had just been swept up would sail back to the middle for
   400 ms as soon as the next event started.
   ────────────────────────────────────────────────────────────────────── */

/** How far from the centre a resting card sits, per axis. A medium card is
 *  roughly 72 × 120 px, so these offsets leave only a small, natural overlap
 *  at the corners and make the throwing seat unambiguous. Seat geometry in
 *  tableStyles.ts clears these extents. */
const REST_X = 66
const REST_Y = 54
/** Where a card starts its flight (off toward its owner). */
const FLY_IN = 170
/** Where the trick slides to when collected. */
const COLLECT = 340
/** DESIGN §2.5: 250 ms in, 400 ms out. `COLLECT_MS` is exported because the
 *  page has to know when the sweep is finished before it clears the felt. */
const FLY_MS = 250
export const COLLECT_MS = 400

function ThrownCard({
    entry,
    order,
    mySeat,
    trickIndex,
    animateIn,
    collectTo,
    reducedMotion,
}: {
    entry: TrickCard
    /** Play order within the trick — later cards lie on top. */
    order: number
    mySeat: Seat | null
    trickIndex: number
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
    const { tilt, dx, dy } = cardScatter(entry.seat, mySeat, trickIndex)

    let transform: string
    let opacity = 1
    if (collectTo !== null) {
        const away = positionVector(positionOf(collectTo, mySeat))
        transform = `translate(-50%, -50%) translate(${away.x * COLLECT}px, ${away.y * COLLECT}px) rotate(${tilt}deg) scale(0.7)`
        opacity = 0
    } else if (!landed) {
        transform = `translate(-50%, -50%) translate(${vector.x * FLY_IN}px, ${vector.y * FLY_IN}px) rotate(${tilt * 1.6}deg) scale(0.88)`
        opacity = 0.45
    } else {
        transform = `translate(-50%, -50%) translate(${vector.x * REST_X + dx}px, ${vector.y * REST_Y + dy}px) rotate(${tilt}deg)`
    }

    return (
        <Box
            position="absolute"
            left="0"
            top="0"
            zIndex={order + 1}
            filter="drop-shadow(0 6px 10px rgba(0,0,0,0.45))"
            style={{ transform, opacity }}
            transition={
                reducedMotion
                    ? "none"
                    : `transform ${collectTo !== null ? COLLECT_MS : FLY_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity ${collectTo !== null ? COLLECT_MS : FLY_MS}ms ease-out`
            }
        >
            <PlayingCard card={entry.card} size="md" />
        </Box>
    )
}

export default function TrickArea({
    cards,
    mySeat,
    trickIndex = 0,
    flyIn = null,
    collectTo = null,
    reducedMotion = false,
}: {
    /** Cards on the table — `view.trick.cards`, or the resolved trick while
     *  a TRICK_WON event is being shown. */
    cards: TrickCard[]
    mySeat: Seat | null
    /** Which trick of the deal this is — the seed for the scatter. */
    trickIndex?: number
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
                [TIGHT]: { transform: "scale(0.86)" },
                [SHORT]: { transform: "scale(0.66)" },
            }}
        >
            {cards.map((entry, index) => (
                <ThrownCard
                    key={`${entry.seat}-${entry.card}`}
                    entry={entry}
                    order={index}
                    mySeat={mySeat}
                    trickIndex={trickIndex}
                    animateIn={entry.card === flyIn}
                    collectTo={collectTo}
                    reducedMotion={reducedMotion}
                />
            ))}
        </Box>
    )
}
