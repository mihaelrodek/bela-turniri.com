package hr.mrodek.apps.bela_turniri.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.repository.TournamentsRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * Forward geocoding via OpenStreetMap Nominatim.
 * <p>
 * Free, no API key required, but the
 * <a href="https://operations.osmfoundation.org/policies/nominatim/">usage policy</a>
 * requires:
 *   - max 1 request per second
 *   - a valid User-Agent identifying this application
 *   - no bulk geocoding
 * <p>
 * We satisfy this by geocoding lazily — once per tournament create/update,
 * and via a manual backfill endpoint that yields between requests.
 */
@ApplicationScoped
public class GeocodeService {

    private static final Logger LOG = Logger.getLogger(GeocodeService.class);

    @ConfigProperty(name = "geocode.user-agent", defaultValue = "bela-turniri.com/1.0 (mihael.rodek1@gmail.com)")
    String userAgent;

    @ConfigProperty(name = "geocode.endpoint", defaultValue = "https://nominatim.openstreetmap.org/search")
    String endpoint;

    @ConfigProperty(name = "geocode.country-codes", defaultValue = "hr,ba,si,rs,me")
    String countryCodes;

    @Inject
    ObjectMapper json;

    @Inject
    TournamentsRepository tournamentsRepo;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    public record LatLng(double latitude, double longitude) {}

    /**
     * Resolve a free-text location string into coordinates.
     * Returns empty if the input is blank, the lookup fails, or no result is found.
     */
    public Optional<LatLng> geocode(String location) {
        if (location == null || location.isBlank()) return Optional.empty();

        String url = endpoint
                + "?format=json"
                + "&limit=1"
                + "&countrycodes=" + URLEncoder.encode(countryCodes, StandardCharsets.UTF_8)
                + "&q=" + URLEncoder.encode(location.trim(), StandardCharsets.UTF_8);

        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                // 5s ceiling: a geocode is never on a hot path, but it IS on a
                // request thread (tournament create/update), so it must not be
                // able to pin one for long when Nominatim is slow.
                .timeout(Duration.ofSeconds(5))
                .header("User-Agent", userAgent)
                .header("Accept", "application/json")
                .header("Accept-Language", "hr,en")
                .GET()
                .build();

        try {
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) {
                LOG.warnf("Nominatim returned status %d for '%s'", res.statusCode(), location);
                return Optional.empty();
            }
            JsonNode arr = json.readTree(res.body());
            if (!arr.isArray() || arr.isEmpty()) {
                LOG.debugf("Nominatim found no result for '%s'", location);
                return Optional.empty();
            }
            JsonNode first = arr.get(0);
            double lat = Double.parseDouble(first.get("lat").asText());
            double lon = Double.parseDouble(first.get("lon").asText());
            return Optional.of(new LatLng(lat, lon));
        } catch (Exception e) {
            LOG.warnf(e, "Geocoding failed for '%s'", location);
            return Optional.empty();
        }
    }

    /**
     * Geocode exactly one tournament and commit, in its own short
     * transaction.
     *
     * <p>The backfill loop lives in the controller and must sleep ~1s
     * between rows (Nominatim policy). Sleeping inside a transaction would
     * hold a pooled DB connection for the whole run, so the loop stays
     * transaction-free and calls in here once per row instead — the
     * transaction lives only as long as this single lookup.
     *
     * <p>A failed lookup leaves the row untouched (no {@code geocodedAt}
     * stamp), so the next backfill picks it up again.
     *
     * @return true when coordinates were found and stored
     */
    @Transactional
    public boolean geocodeOne(Long tournamentId) {
        if (tournamentId == null) return false;
        Tournaments t = tournamentsRepo.findByIdOptional(tournamentId).orElse(null);
        if (t == null) return false;
        String loc = t.getLocation();
        if (loc == null || loc.isBlank()) return false;

        var found = geocode(loc);
        if (found.isEmpty()) return false;

        t.setLatitude(found.get().latitude());
        t.setLongitude(found.get().longitude());
        t.setGeocodedAt(OffsetDateTime.now());
        tournamentsRepo.persist(t);
        return true;
    }
}
