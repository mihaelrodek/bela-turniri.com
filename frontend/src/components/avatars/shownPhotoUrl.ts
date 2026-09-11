import { isAvatarId } from "./avatarArt"

/**
 * The photo URL only when the PHOTO is what actually renders — null whenever a
 * character out-ranks it. Mirrors the order `UserAvatar` draws in; see that
 * file's header for why a stored character means "chosen last".
 *
 * Exists because callers wrap this component in things that act on the photo:
 * `AvatarPreview`'s lightbox opened the stored photo on hover even while a
 * character was on screen (reported 2026-09-11). Anything reaching past
 * `UserAvatar` to the photo has to ask the same question `UserAvatar` asks,
 * not re-derive it.
 */
export function shownPhotoUrl(
    avatar: { avatarUrl?: string | null; avatarPreset?: string | null },
): string | null {
    if (isAvatarId(avatar.avatarPreset)) return null
    return avatar.avatarUrl ?? null
}
