package hr.mrodek.apps.bela_turniri.controller;

import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.model.Resources;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Which image a link preview (WhatsApp, Facebook, Slack) shows for a
 * tournament.
 *
 * <p>The rule, decided by the owner on 2026-09-10: the organiser's uploaded
 * POSTER wins when there is one, because that is the artwork players
 * recognise; the rendered 1200×630 share card is the fallback for every
 * tournament without a poster. This is easy to regress silently — nothing
 * fails, the preview just quietly goes back to looking generic — hence a
 * test that reads the actual {@code og:} tags.
 *
 * <p>Runs against the docker-compose Postgres, fixtures committed in
 * {@code @BeforeEach} and removed in {@code @AfterEach}, same pattern as
 * {@link TournamentSearchControllerTest}.
 */
@QuarkusTest
class TournamentPreviewOgImageTest {

    @Inject
    EntityManager em;

    private final String suffix = UUID.randomUUID().toString();
    private Long withPosterId;
    private Long withoutPosterId;
    private Long withWebpPosterId;
    private Long pngResourceId;
    private Long webpResourceId;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            Resources png = persistResource("image/png");
            pngResourceId = png.getId();
            Resources webp = persistResource("image/webp");
            webpResourceId = webp.getId();

            withPosterId = persistTournament("S plakatom " + suffix, png);
            withoutPosterId = persistTournament("Bez plakata " + suffix, null);
            withWebpPosterId = persistTournament("Webp plakat " + suffix, webp);
        });
    }

    @AfterEach
    void cleanUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            em.createNativeQuery("delete from tournaments where id in (:ids)")
                    .setParameter("ids", java.util.List.of(withPosterId, withoutPosterId, withWebpPosterId))
                    .executeUpdate();
            em.createNativeQuery("delete from resources where id in (:ids)")
                    .setParameter("ids", java.util.List.of(pngResourceId, webpResourceId))
                    .executeUpdate();
        });
    }

    private Resources persistResource(String contentType) {
        Resources r = new Resources();
        r.setBucketName("test-bucket");
        r.setObjectKey("posters/" + UUID.randomUUID() + ".bin");
        r.setContentType(contentType);
        r.setSizeBytes(1024L);
        em.persist(r);
        em.flush();
        return r;
    }

    private Long persistTournament(String name, Resources poster) {
        Tournaments t = new Tournaments();
        t.setName(name);
        t.setLocation("Testno mjesto " + suffix);
        t.setStatus(TournamentStatus.DRAFT);
        t.setCreatedByUid("preview-test-organiser");
        t.setCreatedAt(OffsetDateTime.now());
        t.setStartAt(OffsetDateTime.now().plusDays(7));
        t.setResource(poster);
        em.persist(t);
        em.flush();
        return t.getId();
    }

    private String previewFor(Long id) {
        String uuid = (String) em.createNativeQuery("select uuid::text from tournaments where id = :id")
                .setParameter("id", id)
                .getSingleResult();
        return given().when()
                .get("/preview/tournaments/" + uuid)
                .then().statusCode(200)
                .extract().asString();
    }

    @Test
    void theUploadedPosterIsWhatTheLinkPreviewShows() {
        String html = previewFor(withPosterId);
        assertTrue(
                html.contains("/api/resources/" + pngResourceId + "/image"),
                "og:image should point at the uploaded poster");
        assertFalse(
                html.contains("share-image.png"),
                "the rendered card must not also be emitted when a poster exists");
        // A poster's real size is unknown here, and a wrong width/height makes
        // every crawler reserve the wrong box before it fetches the file.
        assertFalse(html.contains("og:image:width"), "no dimensions may be declared for a poster");
        assertFalse(html.contains("og:image:height"), "no dimensions may be declared for a poster");
    }

    @Test
    void withoutAPosterItFallsBackToTheRenderedCardWithItsExactSize() {
        String html = previewFor(withoutPosterId);
        assertTrue(html.contains("share-image.png"), "og:image should be the rendered share card");
        assertTrue(html.contains("<meta property=\"og:image:width\" content=\"1200\">"),
                "the card's width is known and must be declared");
        assertTrue(html.contains("<meta property=\"og:image:height\" content=\"630\">"),
                "the card's height is known and must be declared");
    }

    @Test
    void aWebpPosterIsSkippedBecauseCrawlersDropIt() {
        // Facebook's and WhatsApp's crawlers still refuse webp: the preview
        // would render with no thumbnail at all, which is worse than the
        // generic card.
        String html = previewFor(withWebpPosterId);
        assertTrue(html.contains("share-image.png"), "a webp poster must fall back to the card");
        assertFalse(html.contains("/api/resources/" + webpResourceId + "/image"),
                "a webp poster must never be emitted as og:image");
    }
}
