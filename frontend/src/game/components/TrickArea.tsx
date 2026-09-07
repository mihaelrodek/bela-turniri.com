import { useEffect, useState } from "react"
import { Box } from "@chakra-ui/react"
import type { Seat } from "@bela/protocol"
import type { TrickCard } from "@bela/engine"
import { cardScatter, positionOf, positionVector } from "../util/seats"
import PlayingCard from "./PlayingCard"

/* ──────────────────────────────────────────────────────────────────────────
   TrickArea — the middle of the table.

   A card lands toward the seat that threw it and TILTED toward that seat
   (12–22°, plus a couple of pixels of scatter), so the pile reads like four
   cards actually tossed onto felt rather than a grid of four slots — and so
   you can tell whose card is whose without checking names. The angles come
   from `cardScatter`, seeded by (seat, trick index): stable across every
   re-render of the same trick, different from one trick to the next.

   The flight is 250 ms from the owner's edge at 45 % opacity, then the trick
   holds (the page's TRICK_HOLD_MS) and slides to the winner. `prefers-
   reduced-motion` — or the manual "Smanji animacije" — drops every
   transition and the cards simply appear.

   The `shown` state below exists for one specific race: the server clears
   `view.trick` in the same frame that carries TRICK_WON, and the event queue
   holds that event for a beat. Without a sticky copy the cards would blink
   out for the handful of milliseconds between the two, which reads as a
   glitch every single trick.
   ────────────────────────────────────────────────────────────────────── */

/** How far from the centre a resting card sits, per axis. */
const REST_X = 44
const REST_Y = 36
/** Where a card starts its flight (off toward its owner). */
const FLY_IN = 170
/** Where the trick slides to when collected. */
const COLLECT = 340
/** DESIGN §2.5: 250 ms in, 400 ms out. */
const FLY_MS = 250
const COLLECT_MS = 400

function ThrownCard({
    entry,
    order,
    mySeat,
    trickIndex,
    collectTo,
    reducedMotion,
}: {
    entry: TrickCard
    /** Play order within the trick — later cards lie on top. */
    order: number
    mySeat: Seat | null
    trickIndex: number
    collectTo: Seat | null
    reducedMotion: boolean
}) {
    const [landed, setLanded] = useState(reducedMotion)

    useEffect(() => {
        if (reducedMotion) {
            setLanded(true)
            return
        }
        // One frame at the start position, then the transition runs.
        const id = requestAnimationFrame(() => setLanded(true))
        return () => cancelAnimationFrame(id)
    }, [reducedMotion])

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
            left="50%"
            top="50%"
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
    collectTo = null,
    reducedMotion = false,
}: {
    /** Cards on the table — `view.trick.cards`, or the resolved trick while
     *  a TRICK_WON event is being shown. */
    cards: TrickCard[]
    mySeat: Seat | null
    /** Which trick of the deal this is — the seed for the scatter. */
    trickIndex?: number
    /** Winner's seat while the trick is being collected, otherwise null. */
    collectTo?: Seat | null
    reducedMotion?: boolean
}) {
    const [shown, setShown] = useState<TrickCard[]>(cards)

    useEffect(() => {
        if (cards.length > 0) {
            setShown(cards)
            return
        }
        // Emptied: hold the previous trick briefly so the state/event handoff
        // (see the header) does not flash. A genuinely empty table just waits
        // one animation frame longer than it strictly had to.
        const id = setTimeout(() => setShown([]), COLLECT_MS)
        return () => clearTimeout(id)
    }, [cards])

    return (
        // Not aria-hidden: each card carries its Croatian name as an
        // aria-label, and the trick is exactly what a screen-reader user
        // needs read back. pointerEvents:none keeps it out of the way of the
        // hand and the panels layered above it.
        <Box position="absolute" inset="0" pointerEvents="none">
            {shown.map((entry, index) => (
                <ThrownCard
                    key={`${entry.seat}-${entry.card}`}
                    entry={entry}
                    order={index}
                    mySeat={mySeat}
                    trickIndex={trickIndex}
                    collectTo={collectTo}
                    reducedMotion={reducedMotion}
                />
            ))}
        </Box>
    )
}
