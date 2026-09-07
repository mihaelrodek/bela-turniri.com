package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.errors.ApiError;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.NotAuthorizedException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.Optional;

/**
 * Single read-only view of "who is calling this request".
 *
 * <p>Auth is lazy in this app ({@code quarkus.http.auth.proactive=false}),
 * so both {@link JsonWebToken} and {@link SecurityIdentity} are always
 * injectable but may describe an anonymous caller: on an endpoint without
 * {@code @Authenticated} the identity stays anonymous even when a valid
 * bearer token was sent, while the JWT itself is still resolvable. Every
 * accessor here therefore tolerates "no token" and returns empty/false
 * rather than throwing — except {@link #requireUid()}, which is the
 * explicit "I need a caller" gate.
 *
 * <p>Before this bean the same three-line JWT dances were copy-pasted
 * across {@code TournamentController}, {@code PairClaimController} and
 * {@code PresetClaimController} (display name), and the
 * {@code identity.hasRole("admin")} / {@code jwt.getSubject()} pair was
 * repeated in six controllers.
 */
@RequestScoped
public class CurrentUser {

    @Inject JsonWebToken jwt;
    @Inject SecurityIdentity identity;
    @Inject MessageService messages;

    /** Firebase UID of the caller, empty when anonymous. */
    public Optional<String> uid() {
        if (jwt == null || jwt.getRawToken() == null) return Optional.empty();
        String sub = jwt.getSubject();
        return (sub == null || sub.isBlank()) ? Optional.empty() : Optional.of(sub);
    }

    /**
     * Firebase UID of the caller, or 401 when there is none.
     * Use on endpoints that are meaningless without an identity even
     * though {@code @Authenticated} should already have rejected the
     * request — belt and braces, and it keeps the null-checks out of
     * the call sites.
     */
    public String requireUid() {
        // Build the response explicitly: the single-String NotAuthorizedException
        // constructor treats its argument as a WWW-Authenticate challenge and
        // leaves the body empty, so the SPA would get a 401 it cannot render.
        return uid().orElseThrow(() -> new NotAuthorizedException(
                Response.status(Response.Status.UNAUTHORIZED)
                        .type(MediaType.APPLICATION_JSON)
                        .entity(ApiError.of("UNAUTHORIZED", messages.t("error.unauthorized")))
                        .build()));
    }

    /** Raw UID or {@code null} — for the many spots that compare against a nullable column. */
    public String uidOrNull() {
        return uid().orElse(null);
    }

    /**
     * True when the verified ID token carries the {@code role: "admin"}
     * custom claim (set only by {@code scripts/set-admin.mjs}).
     *
     * <p>Read straight off the JWT rather than only from
     * {@link SecurityIdentity}: with {@code quarkus.http.auth.proactive=false}
     * the identity stays anonymous — and therefore role-less — on every
     * endpoint that is not annotated {@code @Authenticated} /
     * {@code @RolesAllowed}. An admin calling a {@code @PermitAll} path (the
     * cjenik PUT, the waiter bill endpoints) or a plain public read
     * (the pair listing) would otherwise look like an ordinary user, which is
     * exactly where the extra privilege was supposed to apply. Reading the
     * raw claim the same way {@link #uid()} reads the subject forces token
     * verification and works on both kinds of endpoint;
     * {@code identity.hasRole} is kept as a secondary check so a role granted
     * by any other augmentor still counts.
     */
    public boolean isAdmin() {
        if (jwt != null && jwt.getRawToken() != null && hasAdminClaim(jwt.getClaim("role"))) return true;
        return identity != null && identity.hasRole("admin");
    }

    /**
     * The {@code role} claim is a plain string today, but depending on the
     * JSON-P/POJO conversion in play it can arrive as a {@code JsonString}
     * (whose {@code toString()} keeps the quotes) or, if it is ever widened,
     * as a collection of roles. Normalise all three shapes.
     */
    private static boolean hasAdminClaim(Object claim) {
        if (claim == null) return false;
        if (claim instanceof Iterable<?> many) {
            for (Object one : many) if (hasAdminClaim(one)) return true;
            return false;
        }
        String raw = claim.toString().trim();
        if (raw.length() >= 2 && raw.charAt(0) == '"' && raw.charAt(raw.length() - 1) == '"') {
            raw = raw.substring(1, raw.length() - 1).trim();
        }
        return "admin".equalsIgnoreCase(raw);
    }

    /** True when no verified bearer token was presented. */
    public boolean isAnonymous() {
        return uid().isEmpty();
    }

    /**
     * Best-effort display name from the verified ID token: prefers the
     * Firebase {@code name} claim, falls back to {@code email}, otherwise
     * null. Used when stamping a tournament creator and when lazily
     * creating a {@code UserProfile} row.
     */
    public String displayName() {
        if (jwt == null || jwt.getRawToken() == null) return null;
        Object name = jwt.getClaim("name");
        if (name != null) return name.toString();
        Object email = jwt.getClaim("email");
        return email != null ? email.toString() : null;
    }

    /** The {@code email} claim, or null when absent/anonymous. */
    public String email() {
        if (jwt == null || jwt.getRawToken() == null) return null;
        Object email = jwt.getClaim("email");
        return email != null ? email.toString() : null;
    }
}
