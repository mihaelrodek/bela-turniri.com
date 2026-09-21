import { initializeApp, type FirebaseOptions } from "firebase/app"
import {
    createUserWithEmailAndPassword,
    deleteUser,
    getAuth,
    GoogleAuthProvider,
    OAuthProvider,
    onAuthStateChanged,
    reauthenticateWithPopup,
    revokeAccessToken,
    sendPasswordResetEmail,
    signInWithCredential,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile,
} from "firebase/auth"

/**
 * The ONLY module in `src/` allowed to import `firebase/*` at module scope.
 *
 * It exists purely so those imports can stay STATIC. `src/firebase.ts` reaches
 * this file through a single `import("./firebaseAuthModule")`, which is what
 * keeps the SDK out of the entry chunk — but a dynamic import of
 * `"firebase/auth"` directly would have been far worse than it sounds: Rollup
 * cannot follow member access through a promise callback, so it must retain
 * every export of a dynamically imported module. Doing exactly that cost ~42 kB
 * raw / ~10 kB gzip of phone auth, reCAPTCHA and multi-factor code that nothing
 * here calls. With the named imports below the tree-shaking is the same as when
 * the SDK was eager; only the chunk boundary moved.
 *
 * Never import this file statically from anywhere. See `src/firebase.ts`.
 */

export function createFirebaseAuth(config: FirebaseOptions) {
    const app = initializeApp(config)
    const auth = getAuth(app)
    const googleProvider = new GoogleAuthProvider()
    /*
     * Sign in with Apple. Apple is not a first-class provider class in the Web
     * SDK — it is a generic OIDC provider keyed by "apple.com".
     *
     * The scopes are what Apple returns on the FIRST authorisation only: after
     * that the user is "already known" and Apple sends nothing but the stable
     * user id. That is why `AuthContext` backfills `displayName` right after
     * the very first sign-in instead of waiting for a later profile fetch that
     * will never carry a name. Requesting them costs nothing on repeat
     * sign-ins.
     *
     * Used only on the web (popup) path — the native path goes through the
     * Capacitor plugin and builds its own credential from the returned id
     * token.
     */
    const appleProvider = new OAuthProvider("apple.com")
    appleProvider.addScope("email")
    appleProvider.addScope("name")

    return {
        app,
        auth,
        googleProvider,
        appleProvider,
        onAuthStateChanged,
        signInWithEmailAndPassword,
        createUserWithEmailAndPassword,
        sendPasswordResetEmail,
        signInWithPopup,
        signInWithCredential,
        signOut,
        updateProfile,
        deleteUser,
        // Account deletion (App Store 5.1.1(v)): an Apple-linked account must
        // have its Apple token REVOKED, and revocation needs a token Firebase
        // never stores — hence a fresh `reauthenticateWithPopup`. See
        // `src/auth/appleRevocation.ts`.
        reauthenticateWithPopup,
        revokeAccessToken,
        GoogleAuthProvider,
        OAuthProvider,
    }
}
