/* ──────────────────────────────────────────────────────────────────────────
   One place that decides which colour each side wears.

   The reference screenshots paint one side green and the other red, and four
   components need to agree on that (the header totals, the deal rows, the
   winner card, the two bottom buttons). Hard-coding `green`/`red` at each of
   them is how the app ends up with a green "MI" button above a teal "MI"
   score, so the mapping lives here and every consumer sets
   `colorPalette={sidePalette(side)}` and then styles with the palette-relative
   tokens (`colorPalette.fg`, `colorPalette.subtle`, `colorPalette.solid`,
   `colorPalette.contrast`).

   Why palette-relative tokens and not literal ramp steps: `green` is
   re-pointed at teal in `system.ts` precisely so it survives a green BRAND,
   and both palettes ship AA-checked `fg`/`solid`/`contrast` pairings for the
   light and the dark theme. Writing `green.600` here would opt out of all of
   that and break the moment the theme moves.

   Colour is never the only carrier: each side also has its name under the
   score, a fixed left/right position, and — in the deal list — a filled dot
   marking who called. Someone who cannot tell the two hues apart still reads
   the board correctly.
   ────────────────────────────────────────────────────────────────────── */

import { useTranslation } from "../../i18n"
import type { BlokSide } from "../types"

/** Chakra `colorPalette` name per side. */
export const SIDE_PALETTE: Record<BlokSide, "green" | "red"> = {
    us: "green",
    them: "red",
}

export function sidePalette(side: BlokSide): "green" | "red" {
    return SIDE_PALETTE[side]
}

/** i18n key for a side's default name. */
export function sideNameKey(side: BlokSide): string {
    return side === "us" ? "blok.side.us" : "blok.side.them"
}

/**
 * `BlokGame.names` starts as EMPTY STRINGS and `rename(side, "")` resets a
 * side back to empty — empty means "no name of its own", NOT "no name". So
 * nothing may print `game.names[side]` raw: a saved game would otherwise show
 * a blank header, and storing "MI"/"VI" at creation time would freeze one
 * language into a game that outlives the language switch.
 *
 * Every screen that DISPLAYS a name goes through here. The rename dialog is
 * the one exception — it edits the raw values, because a cleared field has to
 * stay cleared long enough to be saved as a reset.
 */
export function useSideNames(names: Record<BlokSide, string>): Record<BlokSide, string> {
    const { t } = useTranslation()
    return {
        us: names.us?.trim() || t(sideNameKey("us")),
        them: names.them?.trim() || t(sideNameKey("them")),
    }
}

/** Same fallback outside a component — for a row rendering some OTHER game's
 *  names (the archive), where a hook per row is not on. */
export function sideName(
    side: BlokSide,
    names: Record<BlokSide, string>,
    t: (key: string) => string,
): string {
    return names[side]?.trim() || t(sideNameKey(side))
}

/** i18n key for "<side> won". */
export function sideWinnerKey(side: BlokSide): string {
    return side === "us" ? "blok.winner.us" : "blok.winner.them"
}
