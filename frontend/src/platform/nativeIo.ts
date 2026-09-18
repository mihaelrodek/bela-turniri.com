/**
 * Lazy loaders for the Capacitor plugins behind the native share sheet, the
 * app-local filesystem, the software keyboard and the network status.
 *
 * Same rule as `native.ts` (read that file's header first): every plugin
 * package runs a `registerPlugin(...)` side effect the moment it is
 * imported, which the web bundle must never carry — `src/platform/index.ts`
 * only imports `@capacitor/core` for exactly this reason. Each function
 * below is a dynamic `import()` behind a call, not a top-level `import`, so
 * Vite's static analysis never pulls these into the shared/vendor chunk; the
 * plugin JS is fetched only the instant one of these functions actually
 * runs, which happens exclusively behind an `isNative` check. Never import
 * from "@capacitor/share", "@capacitor/filesystem", "@capacitor/keyboard" or
 * "@capacitor/network" at module scope anywhere else in the app.
 */

export async function nativeShare() {
    return (await import("@capacitor/share")).Share
}

/** Returns the plugin plus the two enums callers need to address a written
 *  file (`Directory.Cache`) and its text encoding (`Encoding.UTF8`) — same
 *  pattern as `nativeStatusBar` returning `Style` in native.ts. */
export async function nativeFilesystem() {
    const mod = await import("@capacitor/filesystem")
    return { Filesystem: mod.Filesystem, Directory: mod.Directory, Encoding: mod.Encoding }
}

export async function nativeKeyboard() {
    return (await import("@capacitor/keyboard")).Keyboard
}

export async function nativeNetwork() {
    return (await import("@capacitor/network")).Network
}
