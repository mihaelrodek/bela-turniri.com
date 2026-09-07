package hr.mrodek.apps.bela_turniri.services;

import java.security.SecureRandom;
import java.util.Base64;

/**
 * Opaque share-link tokens for the pair / preset claim flows.
 *
 * <p>24 bytes of {@link SecureRandom} encoded base64-url-without-padding =
 * 32 characters — short enough to stay clipboard-friendly inside a URL,
 * long enough that brute-forcing is infeasible.
 *
 * <p>Three byte-identical copies of this used to live in
 * {@code TournamentController}, {@code UserPairPresetController} and
 * {@code AdminController}; tokens minted through any path must remain
 * indistinguishable, which is exactly the kind of invariant that rots
 * when the generator is duplicated.
 */
public final class ClaimTokens {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private ClaimTokens() {
    }

    /** A fresh 32-character URL-safe claim token. */
    public static String generate() {
        byte[] buf = new byte[24];
        SECURE_RANDOM.nextBytes(buf);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
    }
}
