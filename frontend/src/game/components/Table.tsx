import { Box } from "@chakra-ui/react"
import type { Card as CardId, PlayerView, Reaction, RoomState, Seat as SeatId } from "@bela/protocol"
import type { TrickCard } from "@bela/engine"
import { useTurnCountdown } from "../hooks/useTurnCountdown"
import { SEATS, SEAT_ANCHORS, positionOf, teamOf } from "../util/seats"
import SeatView, { type SeatBid } from "./Seat"
import TrickArea from "./TrickArea"
import { tableGeometry } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   Table — player positions and the central trick over the app background.

   MY seat is always at the bottom (`positionOf` rotates everyone by my
   index), and the others run counter-clockwise from there: the player who
   acts after me is on my RIGHT, exactly as at a physical table. Getting that
   direction wrong is the kind of bug nobody reports and everybody feels.

   MY OWN seat is not drawn here. It lives in `GameRoomPage`, docked to the
   bottom-left corner of the play area, next to the hand tray. A SPECTATOR
   has no seat of their own, so for them seat 0 is drawn on the felt as usual,
   and `tableGeometry(true)` widens the space under the trick to make room
   for it.

   THE WHOLE BLOCK IS DRIVEN BY FOUR CSS VARIABLES, set right here and read by
   `SEAT_ANCHORS` and `TrickArea` (see `tableGeometry` in
   tableStyles.ts). The most important of them is `--cy-bottom`: the table's
   centre is that far above the BOTTOM of this box, not at 50 % of it, because
   the bottom seat is normally missing. A symmetric box reserved a whole
   seat's worth of empty felt between the flank seats and the hand — a third
   of the table saying nothing.
   ────────────────────────────────────────────────────────────────────── */

export default function Table({
    room,
    view,
    turnDeadline,
    turnDurationMs,
    trickCards,
    holdingSeat = null,
    flyIn = null,
    collectTo = null,
    reducedMotion = false,
    bids,
    reactions,
}: {
    room: RoomState
    view: PlayerView
    turnDeadline: number | null
    turnDurationMs: number | null
    /** What to draw in the middle — the live trick, or a resolved one while
     *  its TRICK_WON event is on screen. */
    trickCards: TrickCard[]
    /** Seat whose card is currently winning the trick on the felt. */
    holdingSeat?: SeatId | null
    /** The card being thrown right now; every other card is already at rest. */
    flyIn?: CardId | null
    collectTo?: SeatId | null
    reducedMotion?: boolean
    /** Per-seat bid chip while the deal is being called. */
    bids?: Partial<Record<SeatId, SeatBid>>
    /** Per-seat quick phrase currently floating (from `chat.reaction`). */
    reactions?: Partial<Record<SeatId, Reaction>>
}) {
    const mySeat = view.seat
    const botTurn = view.turn !== null && room.seats[view.turn]?.occupant?.kind === "BOT"
    // Bots have a deliberate think pause, not a player-visible timer. Do not
    // keep this whole table re-rendering at clock cadence while they think.
    const countdown = useTurnCountdown(
        botTurn ? null : turnDeadline,
        botTurn ? 0 : (turnDurationMs ?? room.turnTimeoutMs),
    )
    const caller = view.bidding.caller
    const trump = view.bidding.trump
    // Team colour is relative to the VIEWER (DESIGN §6). A spectator has no
    // pair of their own, so they look at the table from seat 0's chair —
    // exactly the chair `positionOf` already seats them in, so the colours
    // and the layout agree about who is partnered with whom.
    const myTeam = teamOf(mySeat ?? 0)

    return (
        <Box
            className="fold-game-table"
            position="relative"
            w="100%"
            maxH="100%"
            minH="0"
            px="2"
            // Height, the seat gaps and the centre's offset, in one block.
            // A spectator gets a bottom seat and therefore a taller box.
            css={tableGeometry(mySeat === null)}
        >

            <TrickArea
                cards={trickCards}
                mySeat={mySeat}
                holdingSeat={holdingSeat}
                flyIn={flyIn}
                collectTo={collectTo}
                reducedMotion={reducedMotion}
            />

            {SEATS.map((seat) => {
                const position = positionOf(seat, mySeat)
                const isBotTurn = view.turn === seat && room.seats[seat]?.occupant?.kind === "BOT"
                // Mine is in the bar under the felt; a spectator has no bar.
                if (position === "bottom" && mySeat !== null) return null
                return (
                    <Box key={seat} position="absolute" zIndex={6} style={SEAT_ANCHORS[position]}>
                        <SeatView
                            info={room.seats[seat]}
                            isMe={seat === mySeat}
                            isTurn={view.turn === seat}
                            isDealer={view.dealer === seat}
                            // The caller's medallion has to last the whole
                            // deal, so it is keyed off the SETTLED trump, not
                            // off the moment of the bid.
                            callerTrump={caller === seat ? trump : null}
                            countdown={view.turn === seat && !isBotTurn ? countdown : null}
                            bid={bids?.[seat] ?? null}
                            reaction={reactions?.[seat] ?? null}
                            reactionAlign={position === "left" || position === "right" ? position : "center"}
                            reducedMotion={reducedMotion}
                            team={teamOf(seat) === myTeam ? "us" : "them"}
                        />
                    </Box>
                )
            })}
        </Box>
    )
}
