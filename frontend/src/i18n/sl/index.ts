import type { Dictionary } from "../hr"
import { common } from "./common"
import { tournament } from "./tournament"
import { profile } from "./profile"
import { pages } from "./pages"
import { forms } from "./forms"
import { admin } from "./admin"
import { legal } from "./legal"
import { game } from "./game"
import { blok } from "./blok"
import { whatsNew } from "./whatsNew"

/* ──────────────────────────────────────────────────────────────────────────
   Slovenian dictionary. Same six namespaces as `../hr`, in the same order;
   each namespace file is individually typed as its Croatian counterpart, so a
   missing or misspelled key is a COMPILE error, not a runtime fallback.

   The `Dictionary` annotation below is the second half of that guarantee: it
   catches a whole namespace being forgotten here.
   ────────────────────────────────────────────────────────────────────── */

export const sl: Dictionary = {
    common,
    tournament,
    profile,
    pages,
    forms,
    admin,
    legal,
    game,
    blok,
    whatsNew,
}
