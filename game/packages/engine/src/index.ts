/* ──────────────────────────────────────────────────────────────────────────
   @bela/engine — public surface. Everything the server, the bots and the UI
   may import lives here; module internals stay private.

   Function contracts are in game/README.md §2. The implementing modules are:
     cards.ts         SUIT/RANK helpers, cardPoints, strength, parse/format, sort
     rng.ts           seeded PRNG (plain-data state), shuffle
     rules.ts         legalMoves, legalBids, trickWinner
     declarations.ts  findDeclarations, compareDeclarations, bela detection
     scoring.ts       scoreDeal (card points, +10, štiglja, pass/fall)
     game.ts          newGame, reduce, and the deal state machine
     view.ts          viewFor (redaction)
   ────────────────────────────────────────────────────────────────────── */

export * from "./types"
export { teamOf, nextSeat, partnerOf, opponentTeam } from "./seats"
export {
    cardSuit,
    cardRank,
    makeCard,
    cardPoints,
    cardStrength,
    sortHand,
    fullDeck,
} from "./cards"
export { legalMoves, legalBids, trickWinner, trickPoints } from "./rules"
export { findDeclarations, compareDeclarations, hasBela } from "./declarations"
export { scoreDeal } from "./scoring"
export { newGame, reduce } from "./game"
export { viewFor } from "./view"
export { createRng, nextFloat, shuffle } from "./rng"
