import type { ComponentType } from "react"
import { loadNamespace } from "../../i18n"
import { lazyWithReload } from "../../utils/lazyWithReload"

/* The rule texts live in the route-scoped `legal` dictionary namespace (they
   are the /pravila rulebook), which is not in the entry bundle. These wrappers
   fetch it together with the component chunk — the same pairing `lazyRoute`
   does for pages in App.tsx — so the first paint of the editor / document
   already has its strings instead of one frame of raw "legal.rules.*" keys.
   Both components stay out of the create-wizard and tournament-page chunks
   until a step / tab that shows them is actually opened. */

function withLegal<P extends object>(factory: () => Promise<{ default: ComponentType<P> }>) {
    return lazyWithReload<P>(() => Promise.all([factory(), loadNamespace("legal")]).then(([mod]) => mod))
}

export const TournamentRulesEditorLazy = withLegal(() => import("./TournamentRulesEditor"))

export const RulesDocumentLazy = withLegal(() => import("./RulesDocument"))
