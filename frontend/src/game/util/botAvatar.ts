import { AVATAR_IDS, type AvatarId } from "../../components/avatars/avatarArt"

/**
 * Give every bot one of the app's illustrated faces. The choice is derived
 * from its name, so it looks random across the bot roster but never changes
 * while React rerenders or the player reconnects.
 */
export function botAvatarPreset(name: string): AvatarId {
    let hash = 2166136261
    for (const char of name) {
        hash ^= char.codePointAt(0) ?? 0
        hash = Math.imul(hash, 16777619)
    }
    return AVATAR_IDS[(hash >>> 0) % AVATAR_IDS.length] ?? AVATAR_IDS[0]
}
