import type { CoreDictionary } from "../hr"
import { common } from "./common"
import { tournament } from "./tournament"
import { profile } from "./profile"
import { pages } from "./pages"
import { forms } from "./forms"
import { whatsNew } from "./whatsNew"

/* ──────────────────────────────────────────────────────────────────────────
   Slovenian dictionary — the CORE half, mirroring `../hr`'s `hrCore` exactly.
   Each namespace file is individually typed as its Croatian counterpart, so a
   missing or misspelled key is a COMPILE error, not a runtime fallback.

   The `CoreDictionary` annotation below is the second half of that guarantee:
   it catches a whole core namespace being forgotten here.

   The four ROUTE-SCOPED namespaces (`admin`, `legal`, `game`, `blok`) are
   deliberately absent: they are fetched per route, one chunk per
   (namespace, locale), and registered by `../index.ts` → `namespaceLoaders`.
   That registry is typed against `LazyNamespaces`, so a Slovenian namespace
   that goes missing still fails `tsc` — it just fails there instead of here.
   ────────────────────────────────────────────────────────────────────── */

export const sl: CoreDictionary = {
    common,
    tournament,
    profile,
    pages,
    forms,
    whatsNew,
}
