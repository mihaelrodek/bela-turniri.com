package hr.mrodek.apps.bela_turniri.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.Optional;

/**
 * Reverse geocoding (map click → address) via the Google Geocoding API.
 *
 * <p>Server-side on purpose: the Geocoding web service rejects API keys with
 * an HTTP-referrer restriction, and the browser key ({@code VITE_GOOGLE_MAPS_API_KEY})
 * must keep that restriction because it ships in the bundle. So this uses a
 * separate key, {@code GOOGLE_GEOCODING_API_KEY}, restricted by server IP in
 * Google Cloud. With no key configured {@link #enabled()} is false and the SPA
 * stays on Nominatim.
 *
 * <p>Results are cached by coordinates rounded to ~11 m, so re-clicking the
 * same spot costs nothing.
 */
@ApplicationScoped
public class ReverseGeocodeService {

    private static final Logger LOG = Logger.getLogger(ReverseGeocodeService.class);

    private static final String ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";

    // Optional, not String with defaultValue="": the properties file maps it
    // to ${GOOGLE_GEOCODING_API_KEY:}, and SmallRye treats an empty value as
    // missing — a plain String injection then fails boot (CI, local dev).
    @ConfigProperty(name = "app.google.geocoding-api-key")
    Optional<String> apiKey;

    @Inject
    ObjectMapper json;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private final Cache<String, String> cache = Caffeine.newBuilder()
            .maximumSize(2_000)
            .expireAfterWrite(Duration.ofDays(7))
            .build();

    public boolean enabled() {
        return apiKey.filter(k -> !k.isBlank()).isPresent();
    }

    /** Formatted address for the point, or empty on no key / no result / failure. */
    public Optional<String> reverse(double lat, double lng, Locale locale) {
        if (!enabled()) return Optional.empty();

        String language = locale == null ? "hr" : locale.getLanguage();
        String key = String.format(Locale.ROOT, "%.4f,%.4f,%s", lat, lng, language);
        String cached = cache.getIfPresent(key);
        if (cached != null) return Optional.of(cached);

        String url = ENDPOINT
                + "?latlng=" + String.format(Locale.ROOT, "%.6f,%.6f", lat, lng)
                + "&language=" + URLEncoder.encode(language, StandardCharsets.UTF_8)
                + "&key=" + URLEncoder.encode(apiKey.orElseThrow().trim(), StandardCharsets.UTF_8);

        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(5))
                .GET()
                .build();
        try {
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) {
                LOG.warnf("Google reverse geocode HTTP %d", res.statusCode());
                return Optional.empty();
            }
            JsonNode root = json.readTree(res.body());
            String status = root.path("status").asText("");
            if (!"OK".equals(status)) {
                // ZERO_RESULTS is normal (a click in the sea); anything else is a key/billing problem.
                if (!"ZERO_RESULTS".equals(status)) {
                    LOG.warnf("Google reverse geocode status %s: %s", status, root.path("error_message").asText(""));
                }
                return Optional.empty();
            }
            JsonNode first = root.path("results").path(0);
            String address = shortAddress(first);
            if (address.isBlank()) return Optional.empty();
            cache.put(key, address);
            return Optional.of(address);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } catch (Exception e) {
            LOG.warnf("Google reverse geocode failed: %s", e.toString());
            return Optional.empty();
        }
    }

    /**
     * "Street 1, 12345 City" — the same shape the SPA commits for typed picks.
     * Google's {@code formatted_address} ends with the country, which is noise
     * on a Croatian tournament card, so the address is rebuilt from components
     * and falls back to formatted_address minus its last segment.
     */
    private static String shortAddress(JsonNode result) {
        String route = null, number = null, postcode = null, city = null, premise = null;
        for (JsonNode c : result.path("address_components")) {
            String name = c.path("long_name").asText("");
            for (JsonNode t : c.path("types")) {
                switch (t.asText()) {
                    case "route" -> route = name;
                    case "street_number" -> number = name;
                    case "postal_code" -> postcode = name;
                    case "locality" -> city = name;
                    case "postal_town" -> { if (city == null) city = name; }
                    case "administrative_area_level_3" -> { if (city == null) city = name; }
                    case "premise", "establishment", "point_of_interest" -> { if (premise == null) premise = name; }
                    default -> { }
                }
            }
        }

        StringBuilder sb = new StringBuilder();
        if (premise != null && (route == null || !premise.equalsIgnoreCase(route))) append(sb, premise);
        if (route != null) append(sb, number != null ? route + " " + number : route);
        String cityLine = ((postcode != null ? postcode + " " : "") + (city != null ? city : "")).trim();
        if (!cityLine.isEmpty()) append(sb, cityLine);
        if (sb.length() > 0) return sb.toString();

        String formatted = result.path("formatted_address").asText("");
        int lastComma = formatted.lastIndexOf(',');
        return lastComma > 0 ? formatted.substring(0, lastComma).trim() : formatted.trim();
    }

    private static void append(StringBuilder sb, String part) {
        if (part == null || part.isBlank()) return;
        if (sb.length() > 0) sb.append(", ");
        sb.append(part.trim());
    }
}
