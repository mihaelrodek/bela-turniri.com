/**
 * Lazy loader for `@capacitor-firebase/authentication`.
 *
 * Same rule as `src/platform/native.ts`: the plugin package calls
 * `registerPlugin(...)` as an import side effect, so a top-level import here
 * would drag native bridge code (and, on the web fallback path, a second copy
 * of the Firebase JS SDK's provider glue) into the shared chunk every browser
 * downloads. The `import()` below keeps it in a chunk of its own that the web
 * build never requests — `vite.config.ts` already excludes the whole
 * `@capacitor-firebase/` scope from `manualChunks` for exactly this reason.
 *
 * This lives in its own file rather than in `native.ts` because auth is the
 * only consumer and `native.ts` is owned by the native-shell work; nothing
 * else may import "@capacitor-firebase/authentication" at module scope.
 *
 * Every caller is behind an `isNative` check — see `src/auth/AuthContext.tsx`.
 */

export async function nativeAuth() {
    return (await import("@capacitor-firebase/authentication")).FirebaseAuthentication
}
