import type { ReactNode } from "react"
import { Box } from "@chakra-ui/react"
import type { PlayerView, RoomState, Seat as SeatId } from "@bela/protocol"
import type { TrickCard } from "@bela/engine"
import { useTurnCountdown } from "../hooks/useTurnCountdown"
import { SEATS, SEAT_ANCHORS, positionOf } from "../util/seats"
import SeatView, { type SeatBid } from "./Seat"
import TrickArea from "./TrickArea"
import { SHORT } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   Table — the seats and the trick between them.

   MY seat is always at the bottom (`positionOf` rotates everyone by my
   index), and the others run counter-clockwise from there: the player who
   acts after me is on my RIGHT, exactly as at a physical table. Getting that
   direction wrong is the kind of bug nobody reports and everybody feels.

   The felt itself is painted by the page (one surface for the whole column,
   scoreboard and hand tray included — DESIGN §2.2), so this component is
   transparent and owns only the geometry. That way the trick, the seats and
   the tray all sit on ONE continuous table rather than on three panels.
   ────────────────────────────────────────────────────────────────────── */

export default function Table({
    room,
    view,
    turnDeadline,
    trickCards,
    trickIndex = 0,
    collectTo = null,
    reducedMotion = false,
    bids,
    reactions,
    children,
}: {
    room: RoomState
    view: PlayerView
    turnDeadline: number | null
    /** What to draw in the middle — the live trick, or a resolved one while
     *  its TRICK_WON event is on screen. */
    trickCards: TrickCard[]
    trickIndex?: number
    collectTo?: SeatId | null
    reducedMotion?: boolean
    /** Per-seat bid chip while the deal is being called. */
    bids?: Partial<Record<SeatId, SeatBid>>
    /** Per-seat emoji currently floating (from `chat.reaction`). */
    reactions?: Partial<Record<SeatId, string>>
    /** Overlays that live on the felt: reveals, flashes. */
    children?: ReactNode
}) {
    const mySeat = view.seat
    const countdown = useTurnCountdown(turnDeadline, room.turnTimeoutMs)
    const caller = view.bidding.caller

    return (
        <Box
            position="relative"
            flex="1"
            minH={{ base: "196px", md: "240px" }}
            px="2"
            py="1"
            // On a landscape phone the felt is the only thing that may give:
            // the hand keeps its 68 px and the seats pull toward the middle.
            css={{ [SHORT]: { minHeight: "96px", paddingTop: 0, paddingBottom: 0 } }}
        >
            <TrickArea
                cards={trickCards}
                mySeat={mySeat}
                trickIndex={trickIndex}
                collectTo={collectTo}
                reducedMotion={reducedMotion}
            />

            {SEATS.map((seat) => {
                const position = positionOf(seat, mySeat)
                return (
                    <Box key={seat} position="absolute" zIndex={6} style={SEAT_ANCHORS[position]}>
                        <SeatView
                            info={room.seats[seat]}
                            position={position}
                            isMe={seat === mySeat}
                            isTurn={view.turn === seat}
                            isDealer={view.dealer === seat}
                            isCaller={caller === seat}
                            // My own cards are in the Hand below the felt, so
                            // the fanned back is only drawn for the others.
                            cardsInHand={seat === mySeat ? 0 : view.handSizes[seat]}
                            countdown={view.turn === seat ? countdown : null}
                            bid={bids?.[seat] ?? null}
                            reaction={reactions?.[seat] ?? null}
                        />
                    </Box>
                )
            })}

            {children}
        </Box>
    )
}
