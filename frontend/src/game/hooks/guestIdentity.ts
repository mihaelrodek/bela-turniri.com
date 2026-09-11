/**
 * Guest identity: `{ name, secret, avatar? }`, keyed `bela.guest`. The game server
 * derives the guest uid as `guest:<sha256(secret)>` (see game/README.md §3
 * "Ime za igru") and hangs the in-game name plus its once-a-week change limit
 * off that uid, so losing `secret` means losing both.
 *
 * The web path below is untouched: synchronous, localStorage-only, same key,
 * same validation. In the native shells localStorage is WKWebView/WebView
 * storage — it can be evicted under storage pressure and it is always wiped
 * on uninstall — so natively the record is *mirrored* into
 * `@capacitor/preferences` (`hydrateGuestFromNative` restores it into
 * localStorage on next launch if localStorage came back empty; `saveGuest`
 * fire-and-forgets the mirror write). On iOS Preferences maps to
 * UserDefaults, not the Keychain, so this mirror does NOT survive an
 * uninstall/reinstall there — reinstall-survival needs Keychain storage (a
 * `capacitor-secure-storage-plugin`-class plugin, or a small custom Swift
 * plugin) and is deliberately deferred to a follow-up task, N2.2b.
 */
import { isAvatarId } from "../../components/avatars/avatarArt"
import { isNative } from "../../platform"
import { nativePreferences } from "../../platform/native"

/**
 * `avatar` is the face the guest picked on the identity screen. It is here
 * and nowhere else: a guest has no profile row, so the browser record is the
 * only thing that can carry the pick from one session to the next, and it
 * rides along on every `hello` (`guest.avatarPreset` in the protocol). Absent
 * — an old record written before faces existed, or a guest who somehow
 * skipped the picker — the server derives one from their uid, so the seat is
 * never faceless either way.
 */
export interface GuestIdentity { name: string; secret: string; avatar?: string }
const KEY = "bela.guest"
let cached: GuestIdentity | null = null

function parse(raw: string | null): GuestIdentity | null {
    try {
        const value = JSON.parse(raw ?? "null")
        if (typeof value?.name === "string" && value.name.trim() && /^[a-f0-9]{64}$/.test(value.secret)) {
            // A record from an older build has no `avatar`, and a value that
            // is not one of the presets is dropped rather than carried: the
            // server would refuse it anyway and `BelaAvatar` renders nothing
            // for an id it does not know.
            return {
                name: value.name.trim().slice(0, 60),
                secret: value.secret,
                ...(isAvatarId(value.avatar) ? { avatar: value.avatar } : {}),
            }
        }
    } catch { /* Storage can be unavailable in private browsing. */ }
    return null
}

export function readGuest(): GuestIdentity | null {
    if (cached) return cached
    try {
        cached = parse(localStorage.getItem(KEY))
    } catch { /* Storage can be unavailable in private browsing. */ }
    return cached
}

/**
 * Writes the guest record. `avatar` is OPTIONAL and omitting it keeps the
 * stored face — the settings sheet renames a guest without knowing or caring
 * which face they wear, and must not blank it out on the way through.
 */
export function saveGuest(name: string, avatar?: string): GuestIdentity {
    const previous = readGuest()
    const secret = previous?.secret ?? Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("")
    const face = avatar ?? previous?.avatar
    cached = { name: name.trim().slice(0, 60), secret, ...(isAvatarId(face) ? { avatar: face } : {}) }
    const json = JSON.stringify(cached)
    try { localStorage.setItem(KEY, json) } catch { /* Keep identity for this page session. */ }
    // Fire-and-forget: never awaited, never allowed to throw into the caller.
    // The web bundle must not even fetch the Preferences plugin module, hence
    // the isNative guard before the dynamic import runs.
    if (isNative) {
        nativePreferences()
            .then((Preferences) => Preferences.set({ key: KEY, value: json }))
            .catch(() => { /* best-effort mirror only */ })
    }
    return cached
}

/**
 * Restores the guest record from the native mirror when localStorage came up
 * empty (fresh WebView storage, or storage the OS evicted) but Preferences
 * still has it. No-op on web and a no-op once localStorage already holds a
 * valid record, so it is safe to call unconditionally at native startup.
 * Always resolves (never throws) and always flips `hydrationReady`, so a
 * dead or missing Preferences plugin degrades to "ask for a name" instead of
 * hanging `GameIdentityGate` forever.
 */
export async function hydrateGuestFromNative(): Promise<void> {
    if (!isNative) return
    try {
        if (!readGuest()) {
            const Preferences = await nativePreferences()
            const { value } = await Preferences.get({ key: KEY })
            const restored = parse(value)
            if (restored) {
                cached = restored
                try { localStorage.setItem(KEY, JSON.stringify(restored)) } catch { /* best-effort */ }
            }
        }
    } catch { /* Preferences unavailable — guest gate falls back to asking for a name. */ }
    hydrationReady = true
    hydrationListeners.forEach((listener) => listener())
}

// Tiny external store so `GameIdentityGate` can wait on native hydration
// without ever waiting on web: `hydrationReady` starts true there (nothing to
// hydrate) and starts false natively until `hydrateGuestFromNative` (called
// once from `NativeShell`) settles.
type Listener = () => void
let hydrationReady = !isNative
const hydrationListeners = new Set<Listener>()

export function subscribeGuestHydration(listener: Listener): () => void {
    hydrationListeners.add(listener)
    return () => hydrationListeners.delete(listener)
}

export function getGuestHydrationReady(): boolean {
    return hydrationReady
}
