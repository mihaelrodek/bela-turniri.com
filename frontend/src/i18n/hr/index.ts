import { common } from "./common"
import { tournament } from "./tournament"
import { profile } from "./profile"
import { pages } from "./pages"
import { forms } from "./forms"
import { whatsNew } from "./whatsNew"

/* TYPE-ONLY. The four route-scoped namespaces below are NOT part of the eager
   dictionary any more — they are fetched per route by `loadNamespace()` in
   `../index.ts`. `import type` is erased by the compiler, so naming them here
   costs nothing at runtime while keeping `Dictionary` the complete shape of
   the app's key space: `sl/index.ts` is still annotated `Dictionary`, each
   `sl/<ns>.ts` is still typed against its Croatian counterpart, and a missing
   Slovenian key is still a compile error. Making them lazy must not weaken
   that contract, which is exactly why this stays a `typeof`-based type and
   not a hand-written interface. */
import type { AdminDict } from "./admin"
import type { LegalDict } from "./legal"
import type { GameDict } from "./game"
import type { BlokDict } from "./blok"

/* ──────────────────────────────────────────────────────────────────────────
   Croatian dictionary — the SOURCE OF TRUTH for the whole app.

   TWO HALVES, on purpose:

     • `hrCore` — the namespaces the app shell itself renders (navigation,
       toasts, forms, the landing route). Bundled into the entry chunk,
       because `t()` is synchronous and must always have an answer.
     • `LazyNamespaces` — `admin`, `legal`, `game`, `blok`: ~46 kB of source
       that only four route subtrees ever read. They are dynamically imported
       and registered by `../index.ts`; the route's own `React.lazy` factory
       awaits the namespace chunk TOGETHER with the page chunk, so a page
       never paints a raw "legal.privacy.title" key.

   Adding a language = copy this directory, translate the files, and register
   it in `../index.ts` (both `localeLoaders` and `namespaceLoaders`).
   ────────────────────────────────────────────────────────────────────── */

export const hrCore = {
    common,
    tournament,
    profile,
    pages,
    forms,
    whatsNew,
}

/** The route-scoped half of the key space. Type only — nothing here is in the
 *  entry bundle; see `../index.ts` → `namespaceLoaders`. */
export type LazyNamespaces = {
    admin: AdminDict
    legal: LegalDict
    game: GameDict
    blok: BlokDict
}

/** The eagerly-bundled half of the key space. Every locale's `index.ts` is
 *  annotated with this, so forgetting a core namespace is a compile error. */
export type CoreDictionary = typeof hrCore

/** The shape every other locale must match, key for key — both halves. */
export type Dictionary = CoreDictionary & LazyNamespaces
