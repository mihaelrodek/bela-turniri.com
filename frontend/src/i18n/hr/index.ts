import { common } from "./common"
import { tournament } from "./tournament"
import { profile } from "./profile"
import { pages } from "./pages"
import { forms } from "./forms"
import { admin } from "./admin"
import { legal } from "./legal"
import { game } from "./game"

/* ──────────────────────────────────────────────────────────────────────────
   Croatian dictionary — the SOURCE OF TRUTH for the whole app.

   All six namespaces are listed here up front and this file never needs to
   change again: the extraction pass fills `./tournament.ts`, `./profile.ts`,
   `./pages.ts`, `./forms.ts` and `./admin.ts` (one agent per namespace pair,
   hr + sl), and nobody has to touch this composer or fight over it.

   Adding a language later = copy this directory, translate the six files,
   and register it in `../index.ts`. Nothing else changes.
   ────────────────────────────────────────────────────────────────────── */

export const hr = {
    common,
    tournament,
    profile,
    pages,
    forms,
    admin,
    legal,
    game,
}

/** The shape every other locale must match, key for key. */
export type Dictionary = typeof hr
