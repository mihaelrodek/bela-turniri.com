import { useAuth } from "../auth/authContextValue"
import { useBlokOutbox } from "./store"
import { useBlokHistoryUpload } from "./components/useBlokHistoryUpload"

/* ──────────────────────────────────────────────────────────────────────────
   The blok's outbox, mounted APP-WIDE. Renders nothing.

   WHY IT IS NOT ON /blok ANY MORE
   ──────────────────────────────
   It used to live in `BlokPage`, which made "the queue is sent" mean "the
   queue is sent the next time somebody opens the scorepad". That is exactly
   backwards for the case the queue exists for: a player closes three evenings
   in a bar with no signal and then — hours later, from the tournament list, or
   right after signing in on /prijava, which is a different route entirely —
   comes back into coverage. `useBlokHistoryUpload` treats sign-in and the
   network returning as triggers, and neither can fire in a component that is
   not mounted.

   EXACTLY ONE UPLOADER. This is also why the mount MOVED rather than being
   added: two copies of the hook would both see `pendingSessions[0]`, both POST
   it, and both write the same localStorage key on the way back. The server is
   idempotent so nothing would corrupt, but one of the two deletions would be
   read-modify-written away and a filed series could stay in the queue forever.

   WHAT IT COSTS. `store.ts` + `blokHistoryApi.ts` move from the lazy /blok
   chunk into the entry bundle. That is the price of the feature and it is
   small (the store is plain state and `scoreManualDeal`; the API module is
   three functions over the shared axios instance). The blok's promise is kept
   exactly: `useBlokOutbox` reads localStorage and subscribes, `enabled` is
   false for a guest, and with nothing queued the hook registers no listeners
   and issues no request — so a signed-out player still makes ZERO requests
   from anywhere in the app on the blok's behalf.
   ────────────────────────────────────────────────────────────────────── */

export default function BlokOutbox() {
    const { user } = useAuth()
    const { pendingSessions } = useBlokOutbox()

    useBlokHistoryUpload({ pendingSessions, enabled: user !== null })

    return null
}
