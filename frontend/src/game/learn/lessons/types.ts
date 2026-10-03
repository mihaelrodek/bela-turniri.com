import type { CardSize } from "../../util/cards"

/** What the tutorial page hands every lesson (2026-09-29). */
export interface LessonProps {
    /** The lesson's last task was answered — the page lights up "Dalje". */
    onSolved: () => void
    /** OS reduced motion OR the in-game "Smanji animacije". */
    reducedMotion: boolean
    /** `sm` on a phone, `md` from 48em — the hand's own two sizes. */
    cardSize: CardSize
}
