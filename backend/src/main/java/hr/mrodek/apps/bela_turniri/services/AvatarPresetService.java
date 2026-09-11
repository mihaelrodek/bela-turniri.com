package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.errors.ApiCodes;
import hr.mrodek.apps.bela_turniri.model.UserProfile;
import jakarta.enterprise.context.ApplicationScoped;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;

/**
 * "Odaberi lika" — the drawn character a player wears instead of an uploaded
 * photo.
 *
 * <p>Most people never upload an avatar, so most profiles used to render as a
 * grey circle with initials. This service owns three things and nothing else:
 * which character ids exist, which one a brand-new profile gets, and which of
 * a photo and a character actually shows.
 */
@ApplicationScoped
public class AvatarPresetService {

    /**
     * The sixteen faces, in the order they are drawn.
     *
     * <p><b>Mirrored from {@code frontend/src/components/avatars/avatarArt.ts}</b>
     * — that file holds the actual drawings, this list holds only their ids,
     * and the two must stay in the same order (the backfill in
     * {@code db/changelog/user_profile_avatar_preset.xml} indexes into the
     * same sequence).
     *
     * <p><b>APPEND-ONLY.</b> Renaming an id orphans every profile that picked
     * it: the stored string stops matching anything the renderer knows, the
     * face silently reverts to initials, and nothing anywhere reports it.
     * Adding to the end is safe — existing rows keep their face and only
     * profiles created afterwards can be assigned the new one.
     */
    public static final List<String> PRESETS = List.of(
            "kralj", "baba", "decko", "dida", "baka", "gazda", "konobar", "cura",
            "momak", "kibic", "gospon", "sudac", "teta", "profa", "mornar", "seka");

    /** Bare wire code for an id the renderer would not know what to do with. */
    public static final String INVALID_CODE = "INVALID_AVATAR_PRESET";

    /** True for an id this backend is willing to store and hand back. */
    public boolean isValid(String id) {
        return id != null && PRESETS.contains(id);
    }

    /**
     * The face a profile is given when nobody picked one.
     *
     * <p>The ask was "give them a random character". This is deliberately NOT
     * {@code Random}: it is a stable function of the Firebase UID, which looks
     * random to a person — no two neighbouring accounts get the same face, and
     * nobody can predict theirs — while being reproducible. That matters
     * because the assignment happens in more than one place and more than
     * once: the SQL backfill may be re-run on a restored dump, and a profile
     * row is created LAZILY, so a user whose row is rebuilt after a delete
     * must not find a different person's face on their account. A
     * {@code Random} draw would change somebody's face out from under them
     * every time either of those happened.
     *
     * <p>MD5 rather than {@link String#hashCode()} for one reason: the
     * backfill is plain SQL, and {@code hashCode} cannot be reproduced in
     * Postgres portably, while {@code md5()} is the same function on both
     * sides. Not a security choice — this picks a cartoon, and MD5's weakness
     * is collisions, which here cost nothing.
     *
     * <p>Kept byte-identical to the SQL in
     * {@code db/changelog/user_profile_avatar_preset.xml}:
     * <pre>(('x' || substr(md5(uid),1,7))::bit(28)::bigint % 16)</pre>
     * Seven hex digits (28 bits) rather than eight, because Postgres casts
     * {@code bit(32)} to a SIGNED integer and half the hashes would come out
     * negative there while staying positive here.
     *
     * @return one of {@link #PRESETS}; falls back to the first entry only for
     *         a null/blank uid, which no real caller has
     */
    public String defaultFor(String uid) {
        if (uid == null || uid.isBlank()) return PRESETS.get(0);
        long bucket = Long.parseLong(md5Hex(uid).substring(0, 7), 16) % PRESETS.size();
        return PRESETS.get((int) bucket);
    }

    /**
     * PRECEDENCE — the single place the rule lives. Every DTO that carries an
     * avatar calls this instead of reading {@code profile.getAvatarPreset()}
     * directly.
     *
     * <p><b>THE LAST CHOICE WINS</b> (2026-09-11, owner's call — it used to be
     * "photo always wins", which meant picking a character while a photo was
     * up appeared to do nothing at all). A stored preset is returned even when
     * a photo exists, and the frontend draws the preset in preference to the
     * photo. The other half of the rule lives in
     * {@code UserMeController.uploadAvatar}, which CLEARS the preset — so
     * uploading a photo makes the photo current, and picking a character makes
     * the character current, whichever the user did last. The photo file is
     * never deleted by picking a character; it simply stops being shown.
     *
     * <p>An id that is no longer in {@link #PRESETS} is reported as absent
     * rather than passed through: the renderer has no drawing for it, and a
     * client asked to draw an unknown id is a client crash waiting for a
     * deploy that removes one.
     *
     * @param avatarUrl the proxied photo URL already computed by the caller,
     *                  or null when the user has no photo
     */
    public String presetFor(UserProfile profile, String avatarUrl) {
        if (profile == null) return null;
        String stored = profile.getAvatarPreset();
        return isValid(stored) ? stored : null;
    }

    /**
     * Give a BRAND-NEW profile row its starting face. Never overwrites: a
     * profile that already carries a preset, or that already has an uploaded
     * photo, is left exactly as it is.
     *
     * <p>Only called where a row is first created, never on update — a user
     * who deliberately cleared their character must not have one handed back
     * to them on their next request.
     */
    public void assignDefaultIfMissing(UserProfile profile) {
        if (profile == null) return;
        if (profile.getAvatarPreset() != null && !profile.getAvatarPreset().isBlank()) return;
        if (profile.getAvatar() != null) return;
        profile.setAvatarPreset(defaultFor(profile.getUserUid()));
    }

    /**
     * Apply an incoming {@code avatarPreset} from a profile PUT.
     *
     * <p>Three cases, all deliberate:
     * <ul>
     *   <li>{@code null} — the field was not sent at all (an older client, or
     *       a form that only edits the phone). Leave the stored value alone;
     *       a partial body must not wipe a choice it does not know about.</li>
     *   <li>blank {@code ""} — an explicit "no character, thanks". Clears it.</li>
     *   <li>a known id — stored. The uploaded photo, if any, is untouched.</li>
     * </ul>
     *
     * @throws jakarta.ws.rs.WebApplicationException 400 with the bare body
     *         {@code INVALID_AVATAR_PRESET} for anything else
     */
    public void applyFromRequest(UserProfile profile, String raw) {
        if (profile == null || raw == null) return;
        String id = raw.trim();
        if (id.isEmpty()) {
            profile.setAvatarPreset(null);
            return;
        }
        if (!isValid(id)) throw ApiCodes.badRequest(INVALID_CODE);
        profile.setAvatarPreset(id);
    }

    /** Lower-case hex MD5 of the UTF-8 bytes — Postgres {@code md5()}'s output. */
    private static String md5Hex(String s) {
        try {
            byte[] digest = MessageDigest.getInstance("MD5")
                    .digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) hex.append(Character.forDigit((b >> 4) & 0xF, 16))
                                     .append(Character.forDigit(b & 0xF, 16));
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            // MD5 is required of every JRE; this branch is unreachable.
            throw new IllegalStateException("MD5 unavailable", e);
        }
    }
}
