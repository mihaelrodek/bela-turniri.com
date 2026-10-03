package hr.mrodek.apps.bela_turniri.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Caller identity for the idempotency store of the waiter bill endpoints
 * (match bills and, since 2026-10-03, "Ostalo" bills) — extracted from
 * {@code WaiterBillController} so both controllers share one rule.
 * An organiser gets {@code owner:<uid>}; a genuine waiter gets
 * {@code waiter:<sha256(token)>} — the digest, never the live bearer token,
 * because the value lands in the plaintext {@code processed_operations}
 * column. See the original rationale on the controller.
 */
@ApplicationScoped
public class WaiterCallerIdentity {

    @Inject CurrentUser currentUser;

    public String of(String token) {
        if (token != null && !token.isBlank()) return "waiter:" + sha256Hex(token.trim());
        String uid = currentUser.uidOrNull();
        return uid == null ? null : "owner:" + uid;
    }

    private static String sha256Hex(String s) {
        try {
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(sha256.digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e); // SHA-256 is always present on the JVMs we run
        }
    }
}
