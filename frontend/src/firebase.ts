import type { FirebaseOptions } from "firebase/app"

/**
 * Firebase Web SDK config. These values are public by design — Firebase's
 * "API key" identifies the project, not a secret. Real security comes from
 * Firebase Auth rules + server-side ID-token verification.
 *
 * Set in `frontend/.env.local`:
 *   VITE_FIREBASE_API_KEY=...
 *   VITE_FIREBASE_AUTH_DOMAIN=...
 *   VITE_FIREBASE_PROJECT_ID=...
 *   VITE_FIREBASE_APP_ID=...
 */
const firebaseConfig: FirebaseOptions = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/* ──────────────────────────────────────────────────────────────────────────
   Why this file is a LOADER and not a module with `export const auth`.

   `firebase/app` + `firebase/auth` are ~195 kB raw / ~38 kB gzip, and this
   module is imported by `api/http.ts` and `auth/AuthContext.tsx` — both on the
   entry path. A static import therefore made `vendor-firebase` a static
   dependency of `index`, which put a `<link rel="modulepreload">` for it in
   index.html: every visitor, signed in or not, paid for the whole auth SDK
   before the first screen could paint, even though the first screen is an
   anonymous tournament list that index.html has already seeded (see
   `shell/seed.ts`).

   Now nothing on the eager path touches `firebase/*` at runtime. The SDK is
   pulled in by ONE memoised `import()` that `AuthProvider` kicks off in its
   first effect — i.e. immediately after the first paint — so the download
   still starts right away but no longer blocks the shell. Every consumer goes
   through `loadFirebaseAuth()`; nobody may re-add a top-level
   `import ... from "firebase/auth"` anywhere in `src/`.

   The `firebase/*` imports themselves stay STATIC, one file over in
   `firebaseAuthModule.ts`, and it is THAT file this module imports
   dynamically — see its header for why (`import("firebase/auth")` here would
   have defeated tree-shaking and inflated the chunk by ~42 kB).

   Types are free: `import type` and `typeof import(...)` are erased by
   TypeScript, so call sites stay fully typed without a runtime edge.
   ────────────────────────────────────────────────────────────────────── */

/**
 * What `loadFirebaseAuth()` resolves to: the initialised app/auth singletons,
 * the two configured providers, and exactly the named SDK functions the app
 * calls. `typeof import(...)` in a type position is erased, so naming the
 * lazily loaded module here costs nothing at runtime.
 */
export type FirebaseAuthModule = ReturnType<
    typeof import("./firebaseAuthModule").createFirebaseAuth
>

let modulePromise: Promise<FirebaseAuthModule> | null = null

/**
 * Load (once) and return the Firebase auth surface.
 *
 * Memoised: `initializeApp` must run exactly once per document, and every
 * caller must see the SAME `Auth` instance or `onAuthStateChanged` would fire
 * on a different object than the one `http.ts` reads `currentUser` from.
 *
 * A failed load (offline cold start, CDN hiccup) clears the memo so the next
 * caller retries rather than inheriting a permanently rejected promise.
 */
export function loadFirebaseAuth(): Promise<FirebaseAuthModule> {
    if (modulePromise) return modulePromise
    const pending = import("./firebaseAuthModule")
        .then((m) => m.createFirebaseAuth(firebaseConfig))
    modulePromise = pending
    pending.catch(() => {
        if (modulePromise === pending) modulePromise = null
    })
    return pending
}
