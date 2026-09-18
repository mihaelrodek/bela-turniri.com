import { registerPlugin } from "@capacitor/core"

/**
 * `GuestKeychainPlugin` (iOS-only, `ios/App/App/GuestKeychainPlugin.swift`)
 * backs the reinstall-durable guest-identity mirror described in
 * `src/game/hooks/guestIdentity.ts`. It has no Android counterpart — on
 * Android `@capacitor/preferences` already survives an app uninstall via
 * Auto Backup, so there is nothing for this plugin to do there, and it must
 * never be called outside `platform === "ios"`.
 *
 * `registerPlugin` itself is cheap (it just builds a proxy object), but this
 * still lives behind a dynamic import like every other file in
 * `src/platform/native.ts`: importing `@capacitor/core`'s `registerPlugin`
 * at module scope is fine (the web bundle already pays for `@capacitor/core`
 * via `src/platform/index.ts`), but importing *this* module eagerly would
 * pull a plugin proxy that has no web implementation into every bundle,
 * including web's — kept as a separate lazy loader (not added to
 * `src/platform/native.ts`) because that file is owned elsewhere in this
 * work programme.
 */
export interface GuestKeychainPlugin {
    get(options: { key: string }): Promise<{ value: string | null }>
    set(options: { key: string; value: string }): Promise<void>
    remove(options: { key: string }): Promise<void>
}

let plugin: GuestKeychainPlugin | null = null

export async function nativeKeychain(): Promise<GuestKeychainPlugin> {
    if (!plugin) plugin = registerPlugin<GuestKeychainPlugin>("GuestKeychain")
    return plugin
}
