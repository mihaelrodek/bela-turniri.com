package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.services.ShellRenderService;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/**
 * {@code GET /api/seed?path=<SPA pathname>} — the first-screen data seed.
 *
 * <p>Fired by an inline classic {@code <script>} in {@code index.html} before
 * a single module has been parsed, so the network request for the data races
 * the network request for the code instead of queueing behind it.
 * {@code main.tsx} awaits the promise (with a hard ~400 ms cap) and writes the
 * payload into the react-query cache under its own {@code qk} keys.
 *
 * <p>Anonymous by construction: {@link ShellRenderService} never consults
 * {@code CurrentUser}, so the body is identical for every caller and the
 * {@code public} cache directive below is sound. See that class for why the
 * client still revalidates the seeded list queries on mount.
 *
 * <p>The {@code Cache-Control} is set here rather than left to
 * {@code PublicReadCacheFilter}: that filter carries an explicit whitelist of
 * paths, and it skips any response that already declares its own value, so
 * this endpoint never needs to be added to it.
 *
 * <p>Errors deliberately use the app's standard mapping (400 for an unseeded
 * path, 404 for a missing tournament) and therefore carry no cache headers at
 * all — a 404 must not pin a tournament as missing for the next 20 seconds.
 */
@Path("/seed")
@Produces(MediaType.APPLICATION_JSON)
public class ShellController {

    /** Matches {@link ShellRenderService#TTL_MS} so the in-process memo and
     *  the browser copy expire together; {@code s-maxage} lets Caddy absorb a
     *  burst of cold loads. */
    private static final String CACHE_VALUE = "public, max-age=20, s-maxage=60";

    @Inject ShellRenderService shell;

    @GET
    public Response seed(@QueryParam("path") String path) {
        ShellRenderService.SeedPayload payload = shell.seedFor(path);
        return Response.ok(payload)
                .header(HttpHeaders.CACHE_CONTROL, CACHE_VALUE)
                .build();
    }
}
