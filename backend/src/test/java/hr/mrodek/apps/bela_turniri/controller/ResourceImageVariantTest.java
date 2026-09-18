package hr.mrodek.apps.bela_turniri.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import hr.mrodek.apps.bela_turniri.model.Resources;
import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@code GET /resources/{id}/image?w=} — the poster/avatar downscaled-variant
 * contract shared with the frontend (perf programme package D):
 * {@code ?w=480|960} for a {@code "poster"} resource, {@code ?w=128} for an
 * {@code "avatar"} one, any other value or wrong-for-kind width 400s, and the
 * variant never upscales past the stored source.
 *
 * <p>Fixtures are written straight to the test MinIO bucket (docker-compose,
 * devservices disabled — same bucket {@code StorageService} uses) rather than
 * going through the multipart upload endpoints, so the exact source pixel
 * dimensions are known and the resulting variant's dimensions can be
 * asserted precisely by decoding the response bytes.
 */
@QuarkusTest
class ResourceImageVariantTest {

    @Inject
    EntityManager em;

    @Inject
    MinioClient minio;

    @Inject
    ObjectMapper objectMapper;

    @ConfigProperty(name = "minio.bucket")
    String bucket;

    private Long posterId;
    private Long tinyPosterId;
    private Long avatarId;

    @BeforeEach
    void setUp() throws Exception {
        ensureBucket();

        // 1600x800 — exactly what StorageService's poster upload pipeline
        // would have produced from a larger source (MAX_POSTER_DIM=1600),
        // so 480/960 variants divide it evenly (no rounding ambiguity).
        posterId = persistResource("posters", solidJpeg(1600, 800), "image/jpeg", "poster", "poster-etag-1");

        // Narrower than either allowed poster width — must never be upscaled.
        tinyPosterId = persistResource("posters", solidJpeg(200, 100), "image/jpeg", "poster", "poster-etag-2");

        // 512x512 — the avatar upload ceiling (MAX_AVATAR_DIM); 128 divides evenly.
        avatarId = persistResource("avatars", solidPng(512, 512), "image/png", "avatar", "avatar-etag-1");
    }

    @AfterEach
    void cleanUp() {
        QuarkusTransaction.requiringNew().run(() -> em.createNativeQuery(
                        "delete from resources where id in (:ids)")
                .setParameter("ids", java.util.List.of(posterId, tinyPosterId, avatarId))
                .executeUpdate());
    }

    /* ---------- poster: allowed widths downscale exactly ---------- */

    @Test
    void posterWidth480DownscalesExactlyAndNeverUpscales() throws Exception {
        byte[] body = given().when().get("/resources/" + posterId + "/image?w=480")
                .then().statusCode(200)
                .contentType("image/jpeg")
                .header("Cache-Control", "public, max-age=31536000, immutable")
                .header("ETag", startsWith("\"poster-etag-1-w480\""))
                .extract().asByteArray();

        int[] dims = dimensionsOf(body);
        assertEquals(480, dims[0], "variant width");
        assertEquals(240, dims[1], "variant height should scale with the same 0.3 factor");
    }

    @Test
    void posterWidth960DownscalesExactly() throws Exception {
        byte[] body = given().when().get("/resources/" + posterId + "/image?w=960")
                .then().statusCode(200)
                .extract().asByteArray();

        int[] dims = dimensionsOf(body);
        assertEquals(960, dims[0], "variant width");
        assertEquals(480, dims[1], "variant height should scale with the same 0.6 factor");
    }

    @Test
    void aSourceNarrowerThanTheRequestedWidthIsReturnedUnscaled() throws Exception {
        byte[] body = given().when().get("/resources/" + tinyPosterId + "/image?w=960")
                .then().statusCode(200)
                .extract().asByteArray();

        int[] dims = dimensionsOf(body);
        assertEquals(200, dims[0], "a 200px source must never be upscaled to 960");
        assertEquals(100, dims[1]);
    }

    /* ---------- avatar: allowed width downscales exactly ---------- */

    @Test
    void avatarWidth128DownscalesExactly() throws Exception {
        byte[] body = given().when().get("/resources/" + avatarId + "/image?w=128")
                .then().statusCode(200)
                .contentType("image/png")
                .extract().asByteArray();

        int[] dims = dimensionsOf(body);
        assertEquals(128, dims[0]);
        assertEquals(128, dims[1]);
    }

    /* ---------- rejected widths ---------- */

    @Test
    void anUnlistedWidthOnAPosterIs400() {
        given().when().get("/resources/" + posterId + "/image?w=100")
                .then().statusCode(400);
    }

    @Test
    void theAvatarOnlyWidthIsRejectedOnAPoster() {
        given().when().get("/resources/" + posterId + "/image?w=128")
                .then().statusCode(400);
    }

    @Test
    void aPosterWidthIsRejectedOnAnAvatar() {
        given().when().get("/resources/" + avatarId + "/image?w=480")
                .then().statusCode(400);
    }

    /* ---------- conditional GET on a variant ---------- */

    @Test
    void aVariantSupportsIfNoneMatch304() {
        String etag = given().when().get("/resources/" + posterId + "/image?w=480")
                .then().statusCode(200)
                .extract().header("ETag");
        assertNotNull(etag);

        given().header("If-None-Match", etag)
                .when().get("/resources/" + posterId + "/image?w=480")
                .then().statusCode(304)
                .header("Cache-Control", "public, max-age=31536000, immutable");

        // A DIFFERENT width must not satisfy the same If-None-Match — each
        // width is its own cache entry.
        given().header("If-None-Match", etag)
                .when().get("/resources/" + posterId + "/image?w=960")
                .then().statusCode(200);
    }

    /* ---------- the original (no ?w=) is untouched by this feature ---------- */

    @Test
    void omittingWReturnsTheOriginalFullSizeImage() throws Exception {
        byte[] body = given().when().get("/resources/" + posterId + "/image")
                .then().statusCode(200)
                .extract().asByteArray();
        int[] dims = dimensionsOf(body);
        assertEquals(1600, dims[0]);
        assertEquals(800, dims[1]);
    }

    /* ---------- helpers ---------- */

    private void ensureBucket() throws Exception {
        boolean exists = minio.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
        if (!exists) {
            minio.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
        }
    }

    private Long persistResource(String prefix, byte[] bytes, String contentType, String kind, String etag)
            throws Exception {
        String objectKey = prefix + "/" + UUID.randomUUID() + (contentType.equals("image/png") ? ".png" : ".jpg");
        minio.putObject(PutObjectArgs.builder()
                .bucket(bucket)
                .object(objectKey)
                .contentType(contentType)
                .stream(new ByteArrayInputStream(bytes), bytes.length, -1)
                .build());

        Long[] id = new Long[1];
        QuarkusTransaction.requiringNew().run(() -> {
            Resources r = new Resources();
            r.setBucketName(bucket);
            r.setObjectKey(objectKey);
            r.setContentType(contentType);
            r.setSizeBytes((long) bytes.length);
            r.setEtag(etag);
            ObjectNode meta = objectMapper.createObjectNode();
            meta.put("kind", kind);
            r.setMetadata(meta);
            em.persist(r);
            em.flush();
            id[0] = r.getId();
        });
        return id[0];
    }

    private static byte[] solidJpeg(int width, int height) throws Exception {
        BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        try {
            g.setColor(Color.RED);
            g.fillRect(0, 0, width, height);
        } finally {
            g.dispose();
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        assertTrue(ImageIO.write(img, "jpg", out), "no JPEG writer available");
        return out.toByteArray();
    }

    private static byte[] solidPng(int width, int height) throws Exception {
        BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        try {
            g.setColor(Color.BLUE);
            g.fillRect(0, 0, width, height);
        } finally {
            g.dispose();
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        assertTrue(ImageIO.write(img, "png", out), "no PNG writer available");
        return out.toByteArray();
    }

    private static int[] dimensionsOf(byte[] png) throws Exception {
        BufferedImage img = ImageIO.read(new ByteArrayInputStream(png));
        assertNotNull(img, "response body did not decode as an image");
        return new int[] { img.getWidth(), img.getHeight() };
    }
}
