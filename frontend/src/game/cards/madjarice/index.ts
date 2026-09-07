/* The Hungarian ("mađarice", Tell pattern) deck — see `MadjaricaCard.tsx`.
   `PlayingCard` is the only thing that should reach in here; everything else
   goes through `PlayingCard` / `SuitIcon` so the player's deck preference is
   honoured in one place. */

export { default as MadjaricaCard, MadjaricaSuitIcon } from "./MadjaricaCard"
export { default as SuitGlyph, Pip } from "./SuitGlyph"
export { SUIT_PALETTE, ACE_PALETTE, FACE, INK, NUMERAL_FONT } from "./palette"
