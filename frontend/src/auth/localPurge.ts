/* ──────────────────────────────────────────────────────────────────────────
   What account deletion has to wipe off THIS DEVICE.

   `AuthContext.purgePersistedCache` already drops the TanStack cache and its
   localStorage snapshot on every sign-out, which covers everything that came
   from the API. It does not cover the app's own localStorage, and several of
   those keys are the deleted person's data in their own right — the server
   copy is gone while the device copy would sit there until someone cleared
   site data:

     bela:blok:v1    the scorepad history. `blok_sessions` is DELETED
                     server-side, so leaving the local mirror would mean the
                     one surviving copy of it is on the phone.
     bela:opq:v1     the offline mutation queue. Its entries carry pair names
                     and drink rounds AND would fire on the next reconnect
                     against a token that no longer belongs to anybody.
     bela:selfreg:v1 receipts for pairs registered without an account, each
                     with a player name and a live claim URL.
     bela:waiter:*   waiter session tokens for tournaments the user ran.

   DELIBERATELY NOT WIPED, and each for a reason:

     bela.guest      a guest identity is a DIFFERENT account — an anonymous
                     one the game server keys its own name and karma on. It
                     was never part of the Firebase account being deleted and
                     may well be in use by somebody else on a shared device,
                     so deleting it would erase a stranger's data to satisfy
                     a request that never covered it. (On iOS it also lives
                     in the Keychain, where it deliberately outlives an
                     uninstall.)
     bela:game:prefs device settings — sound, volume, card deck. No personal
     bela:game:hand: content, and losing them re-asks questions of the next
     bela:locale     person on the device for no privacy gain.
     bela:consent:v1 the analytics consent choice is a decision about the
                     BROWSER, not the account, and resetting it would pop the
                     consent bar again on the way out.

   The service-worker caches are cleared too: the API cache is public-GET-only
   by construction (`NEVER_CACHE_API` in `public/sw.js` keeps authenticated
   responses out), but "only public data" is a claim that has to keep being
   true across future edits, and a deleted account is exactly the moment not
   to rely on it.

   Every access is wrapped: Safari private mode throws on `localStorage` reads
   as well as writes, and `caches` is absent on an insecure origin.
   ────────────────────────────────────────────────────────────────────── */

/** Exact keys to drop. */
const EXACT_KEYS = [
    "bela:blok:v1",
    "bela:opq:v1",
    "bela:selfreg:v1",
]

/** Prefixes to drop every key of (one entry per tournament). */
const PREFIXES = [
    "bela:waiter:",
]

/**
 * Remove this device's copy of the deleted account's data.
 *
 * Never throws and never rejects: it runs at the very end of a deletion that
 * has already succeeded server-side, and nothing it does is worth turning
 * that into an error message.
 */
export async function purgeLocalAccountData(): Promise<void> {
    try {
        for (const key of EXACT_KEYS) localStorage.removeItem(key)
        // Snapshot the key list first — removing during the live iteration
        // reindexes `localStorage` under us and skips entries.
        const keys: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && PREFIXES.some((p) => key.startsWith(p))) keys.push(key)
        }
        for (const key of keys) localStorage.removeItem(key)
    } catch {
        /* storage blocked or unavailable — nothing was persisted either */
    }

    try {
        if (typeof caches === "undefined") return
        const names = await caches.keys()
        await Promise.all(
            // The shell and deck caches are static assets and are left alone:
            // dropping them would only make the next launch slower, and an
            // installed PWA opened offline right after a deletion would lose
            // the app shell entirely.
            names.filter((n) => n.startsWith("bela-api")).map((n) => caches.delete(n)),
        )
    } catch {
        /* Cache Storage unavailable (insecure origin, private mode) */
    }
}
