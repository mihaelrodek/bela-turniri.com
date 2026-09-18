package hr.mrodek.apps.bela_turniri.dtos;

/**
 * One row of "Blokirani korisnici" on the profile screen.
 *
 * <p>Enough to recognise the person and undo the block, and nothing more —
 * no phone, no participation history. The block list is a settings screen,
 * not a second way to read someone's profile.
 *
 * <p>{@code displayName} carries the {@code profile.deletedUser} label when
 * the blocked account has since been deleted, so the row stays unblockable
 * instead of rendering as a blank.
 */
public record BlockedUserDto(
        String uid,
        /** Null for a deleted account — there is nothing to link to. */
        String slug,
        String displayName,
        String avatarUrl,
        String avatarPreset
) {
}
