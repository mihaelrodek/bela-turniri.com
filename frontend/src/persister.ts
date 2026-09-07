import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister"
import { PERSIST_KEY } from "./queryClient"

/**
 * The single localStorage persister for the react-query cache.
 *
 * It lives in its own module (rather than inside main.tsx) because two very
 * different call sites need the same instance:
 *   - `main.tsx` hands it to <PersistQueryClientProvider>, so a cold load
 *     paints the last-seen tournament list / calendar / map straight from disk.
 *   - `auth/AuthContext.tsx` calls `persister.removeClient()` on sign-out —
 *     clearing the in-memory QueryClient alone would leave the previous user's
 *     snapshot on disk, ready to be restored on the next cold load.
 *
 * `null` when storage is unavailable (Safari private mode, a browser with site
 * data blocked, an embedded webview): reading `window.localStorage` THROWS in
 * those environments, which at module scope would take the whole bundle down
 * before React ever mounts. Callers treat null as "persistence is simply off".
 *
 * Note: `createSyncStoragePersister` is marked deprecated in favour of
 * `createAsyncStoragePersister` from `@tanstack/query-async-storage-persister`.
 * That is a separate package we do not depend on today, and localStorage is a
 * synchronous API anyway, so the sync persister stays until the package is
 * added deliberately.
 */

function safeLocalStorage(): Storage | null {
    try {
        const s = window.localStorage
        // Touch it — merely reading the property succeeds in some webviews
        // that then throw on the first real access.
        const probe = "__bela_probe__"
        s.setItem(probe, "1")
        s.removeItem(probe)
        return s
    } catch {
        return null
    }
}

const storage = safeLocalStorage()

export const persister = storage
    ? createSyncStoragePersister({ storage, key: PERSIST_KEY })
    : null
