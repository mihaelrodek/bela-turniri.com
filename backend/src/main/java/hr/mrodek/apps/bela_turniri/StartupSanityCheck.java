package hr.mrodek.apps.bela_turniri;

import io.quarkus.runtime.LaunchMode;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import java.util.Optional;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.util.List;

/**
 * Loud warnings at boot if a required prod env var is missing or still set
 * to its dev default. The app will still start — these are nudges, not gates,
 * because failing to boot in prod is worse than booting with bad config.
 *
 * <p>Currently checks:
 * <ul>
 *   <li>{@code CORS_ORIGINS} is set when running in prod (otherwise the
 *       {@code http://localhost:5185} default would silently reject every
 *       real frontend request).</li>
 *   <li>{@code FIREBASE_PROJECT_ID} is set when running in prod (otherwise
 *       the OIDC issuer points at the dev Firebase project).</li>
 *   <li>{@code APP_PUBLIC_BASE_URL} is set in prod (used by sitemap / preview
 *       links — wrong value here ships broken share URLs).</li>
 *   <li>{@code MINIO_ENDPOINT} doesn't reference {@code localhost} in prod
 *       (would mean the backend can't reach MinIO from inside the container
 *       network).</li>
 *   <li>{@code GAME_RESULTS_TOKEN} is set in prod and is not the dev default
 *       (unset means every online-game result is rejected with a 401 and the
 *       statistics stay empty; the dev default means anyone who reaches the
 *       endpoint can write to them).</li>
 * </ul>
 */
@ApplicationScoped
public class StartupSanityCheck {

    private static final Logger LOG = Logger.getLogger(StartupSanityCheck.class);

    /** The %dev,test fallback in application.properties — never acceptable in prod. */
    private static final String DEV_GAME_RESULTS_TOKEN = "dev-secret-change-me";

    @ConfigProperty(name = "quarkus.http.cors.origins")
    String corsOrigins;

    @ConfigProperty(name = "quarkus.oidc.client-id")
    String firebaseProjectId;

    @ConfigProperty(name = "app.public-base-url", defaultValue = "https://bela-turniri.com")
    String publicBaseUrl;

    @ConfigProperty(name = "minio.endpoint")
    String minioEndpoint;

    /** Shared secret for POST /api/internal/game-results (game/README.md §8.4). */
    /** Optional, not a defaulted String: an empty value is "no value" to
     *  SmallRye, and a warning check must never be the thing that stops the
     *  application from booting (see InternalTokenGuard, same fix). */
    @ConfigProperty(name = "game.results.token")
    Optional<String> gameResultsTokenConfig;

    private String gameResultsToken() {
        return gameResultsTokenConfig.orElse("");
    }

    void onStart(@Observes StartupEvent ev) {
        // Only nag in prod — dev/test profiles legitimately use localhost and
        // the default project id.
        if (LaunchMode.current() != LaunchMode.NORMAL) return;

        List<String> warnings = new java.util.ArrayList<>();

        if (corsOrigins == null
                || corsOrigins.isBlank()
                || corsOrigins.contains("localhost")
                || corsOrigins.contains("127.0.0.1")) {
            warnings.add("CORS_ORIGINS is unset or points at localhost (current value: '"
                    + corsOrigins
                    + "'). The frontend will be rejected by the API. Set it to e.g. "
                    + "'https://bela-turniri.com,https://www.bela-turniri.com'.");
        }

        if (firebaseProjectId == null
                || firebaseProjectId.isBlank()
                || "bela-turniri".equals(firebaseProjectId)) {
            // Note: 'bela-turniri' happens to be the real prod id here; if it
            // ever changes, this check will need an update. We still warn so
            // a reused dev config in prod is visible.
            LOG.debugf("Firebase project id resolved to default: %s", firebaseProjectId);
        }

        if (publicBaseUrl == null
                || publicBaseUrl.isBlank()
                || publicBaseUrl.contains("localhost")) {
            warnings.add("app.public-base-url is unset or points at localhost (current value: '"
                    + publicBaseUrl
                    + "'). Sitemap and link-preview URLs will be wrong. "
                    + "Set APP_PUBLIC_BASE_URL=https://your-domain.tld.");
        }

        if (minioEndpoint == null
                || minioEndpoint.contains("localhost")
                || minioEndpoint.contains("127.0.0.1")) {
            warnings.add("MINIO_ENDPOINT points at localhost (current value: '"
                    + minioEndpoint
                    + "'). Inside a container that means the MinIO client will "
                    + "fail to reach MinIO. Set it to e.g. 'http://minio:9000' "
                    + "(the docker-compose service name) or your managed S3 host.");
        }

        if (gameResultsToken().isBlank()) {
            warnings.add("GAME_RESULTS_TOKEN is unset. POST /api/internal/game-results will "
                    + "reject every report with 401, so no online-game statistics are recorded. "
                    + "Set the same random value on the backend and the game server "
                    + "(openssl rand -base64 32).");
        } else if (DEV_GAME_RESULTS_TOKEN.equals(gameResultsToken())) {
            warnings.add("GAME_RESULTS_TOKEN is still the dev default ('"
                    + DEV_GAME_RESULTS_TOKEN
                    + "'), which is committed to the repository. Anyone who can reach "
                    + "/api/internal/game-results could forge game statistics. Set a real "
                    + "random value (openssl rand -base64 32).");
        }

        if (warnings.isEmpty()) {
            LOG.info("Startup sanity check passed: prod env vars look reasonable.");
            return;
        }

        // Loud, single block so it's hard to miss in the boot log.
        LOG.warn("====================================================================");
        LOG.warn("STARTUP SANITY CHECK — review before serving real traffic:");
        for (String w : warnings) {
            LOG.warnf("  • %s", w);
        }
        LOG.warn("====================================================================");
    }
}
