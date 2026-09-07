package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.model.PushSubscription;
import hr.mrodek.apps.bela_turniri.repository.PushSubscriptionRepository;
import hr.mrodek.apps.bela_turniri.services.CurrentUser;
import hr.mrodek.apps.bela_turniri.services.PushEndpointValidator;
import hr.mrodek.apps.bela_turniri.services.PushService;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * Subscription management for browser Web Push.
 *
 * <ul>
 *   <li>{@code GET /push/public-key} — unauthenticated. Frontend needs the
 *       VAPID public key BEFORE the user has decided whether to subscribe,
 *       so it can be passed to {@code pushManager.subscribe()}. Public
 *       knowledge by design — the private half stays on the server.</li>
 *   <li>{@code POST /push/subscribe} — authenticated. Upserts a
 *       subscription owned by the calling Firebase UID. Endpoint URL is
 *       unique system-wide, so re-subscribing the same browser just
 *       refreshes p256dh/auth.</li>
 *   <li>{@code DELETE /push/subscribe} — authenticated. Removes a specific
 *       subscription by its endpoint URL. Used when the user toggles
 *       notifications off in browser settings or in the app.</li>
 * </ul>
 */
@Path("/push")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PushController {

    private static final Logger LOG = Logger.getLogger(PushController.class);

    @Inject PushService pushService;
    @Inject PushSubscriptionRepository subRepo;
    @Inject CurrentUser currentUser;
    @Inject hr.mrodek.apps.bela_turniri.services.MessageService messages;

    /** Anonymous: serves the VAPID public key + a "ready" flag. */
    @GET
    @Path("/public-key")
    public Map<String, Object> publicKey() {
        return Map.of(
                "publicKey", pushService.publicKey() == null ? "" : pushService.publicKey(),
                "ready", pushService.isReady());
    }

    /**
     * Store (or refresh) a browser's subscription for the calling user.
     * Idempotent — re-subscribing the same endpoint just updates the
     * crypto material and lastSeenAt. Returns 201 either way.
     */
    @POST
    @Path("/subscribe")
    @Authenticated
    @Transactional
    public Response subscribe(@Valid SubscribeRequest body, @HeaderParam(HttpHeaders.USER_AGENT) String ua) {
        // Field-level emptiness is enforced by the DTO's constraints now, so
        // a bad field comes back as the standard per-field 400 envelope. A
        // null body never reaches bean validation, so it stays a manual check.
        if (body == null) {
            throw new BadRequestException(messages.t("push.subscribe.missingFields"));
        }
        String myUid = currentUser.requireUid();

        // The endpoint is a URL this backend will later POST to, so it has
        // to be an https URL on a real browser push service — otherwise
        // /push/subscribe is an SSRF primitive for any signed-in user.
        // Throws IllegalArgumentException → 400 with the localised
        // "unsupported push service" text (push.endpoint.unsupported).
        PushEndpointValidator.assertAllowed(
                body.endpoint(), messages.t("push.endpoint.unsupported"));

        var existing = subRepo.findByEndpoint(body.endpoint()).orElse(null);
        if (existing != null && !myUid.equals(existing.getUserUid())) {
            // Same browser endpoint, different account: legitimate when a
            // shared device signs in as someone else, but the old owner
            // must stop receiving on it. Drop the stale row explicitly
            // (and audibly) rather than silently re-pointing it, then fall
            // through to the create path below.
            LOG.infof("Push: endpoint on host %s changes owner %s -> %s, dropping stale subscription %d",
                    PushEndpointValidator.hostOf(body.endpoint()),
                    existing.getUserUid(), myUid, existing.getId());
            subRepo.delete(existing);
            // The endpoint column is UNIQUE — flush the delete before the
            // insert so Hibernate doesn't order the INSERT first.
            subRepo.flush();
            existing = null;
        }

        if (existing == null) {
            var s = new PushSubscription();
            s.setUserUid(myUid);
            s.setEndpoint(body.endpoint());
            s.setP256dh(body.p256dh());
            s.setAuth(body.auth());
            s.setUserAgent(truncate(ua, 512));
            subRepo.persist(s);
        } else {
            // Same owner re-subscribing — refresh crypto material and
            // last-seen. The Web Push spec allows the same endpoint to
            // belong to one user at a time only.
            existing.setP256dh(body.p256dh());
            existing.setAuth(body.auth());
            existing.setUserAgent(truncate(ua, 512));
            existing.setLastSeenAt(OffsetDateTime.now());
            subRepo.persist(existing);
        }
        return Response.status(Response.Status.CREATED).build();
    }

    /**
     * Drop the calling user's subscription matching the given endpoint.
     * Scoped by UID: endpoints are unguessable, but they do leak (client
     * logs, bug reports) and "unguessable" isn't an authorisation model.
     * A no-match is still 204 — we don't tell the caller whether the
     * endpoint exists under a different account.
     */
    @DELETE
    @Path("/subscribe")
    @Authenticated
    @Transactional
    public Response unsubscribe(@QueryParam("endpoint") String endpoint) {
        if (endpoint == null || endpoint.isBlank()) {
            throw new BadRequestException(messages.t("push.subscribe.missingFields"));
        }
        subRepo.deleteByEndpointAndUser(endpoint, currentUser.requireUid());
        return Response.noContent().build();
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    /**
     * The three values {@code PushSubscription.toJSON()} hands us.
     *
     * <p>The constraints are not decoration: {@code endpoint} is a URL this
     * backend later POSTs to and is UNIQUE in the table, while
     * {@code p256dh}/{@code auth} back {@code varchar(255)} columns — an
     * oversized value used to reach the INSERT and fail as a 500 instead of
     * a 400. The {@code message =} attributes are i18n bundle keys, resolved
     * by {@code errors/ConstraintViolationExceptionMapper}.
     */
    public record SubscribeRequest(
            @NotBlank(message = "validation.push.endpoint.required")
            @Size(max = 2000, message = "validation.push.endpoint.max")
            String endpoint,

            @NotBlank(message = "validation.push.p256dh.required")
            @Size(max = 255, message = "validation.push.key.max")
            String p256dh,

            @NotBlank(message = "validation.push.auth.required")
            @Size(max = 255, message = "validation.push.key.max")
            String auth
    ) {}
}
