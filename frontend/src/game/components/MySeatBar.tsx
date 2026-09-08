import { HStack } from "@chakra-ui/react"
import type { SeatInfo, Suit } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import { useTurnCountdown } from "../hooks/useTurnCountdown"
import { occupantName } from "../util/seats"
import { SeatAvatar } from "./Seat"
import TurnPill, { type TurnTone } from "./TurnPill"

/* ──────────────────────────────────────────────────────────────────────────
   MySeatBar — the one strip between the felt and the hand tray.

   It replaces two rows that used to sit on top of each other: my own seat
   (avatar + name pill + chips) and the turn pill. Both were about ME, and one
   of them was telling me my own name. What is left is the only pair of facts
   that changes: my avatar — which still carries the turn ring, the dealer's
   "D" and any reaction I send — and the pill that says whose move it is.

   My avatar carries the SAME four corner marks as the seats on the felt, in
   the same corners — bot, reaction, called trump, dealer — because "did I
   call this deal" is a question I ask about myself as often as about anybody
   else, and `pinAt` scales their placement to this smaller avatar.

   A spectator has no seat, so they get the pill alone.
   ────────────────────────────────────────────────────────────────────── */

export default function MySeatBar({
    info,
    isTurn,
    isDealer,
    callerTrump = null,
    turnDeadline,
    turnTimeoutMs,
    reaction = null,
    reducedMotion = false,
    tone,
    label,
}: {
    /** My seat, or null when watching. */
    info: SeatInfo | null
    isTurn: boolean
    isDealer: boolean
    /** Trump, when I am the one who called it this deal. */
    callerTrump?: Suit | null
    turnDeadline: number | null
    turnTimeoutMs: number
    reaction?: string | null
    reducedMotion?: boolean
    tone: TurnTone
    label: string
}) {
    const { t } = useTranslation()
    const countdown = useTurnCountdown(isTurn ? turnDeadline : null, turnTimeoutMs)

    return (
        <HStack gap="2.5" justify="center" align="center" px="2" minW="0">
            {info && (
                <SeatAvatar
                    occupant={info.occupant}
                    name={occupantName(info.occupant, t("game.seat.empty"))}
                    size={34}
                    isTurn={isTurn}
                    isDealer={isDealer}
                    callerTrump={callerTrump}
                    countdown={isTurn ? countdown : null}
                    reaction={reaction}
                    reducedMotion={reducedMotion}
                />
            )}
            <TurnPill tone={tone} label={label} />
        </HStack>
    )
}
