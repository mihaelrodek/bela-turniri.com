package hr.mrodek.apps.bela_turniri.services;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.EncodeHintType;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.Result;
import com.google.zxing.client.j2se.BufferedImageLuminanceSource;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import io.quarkus.cache.CacheKey;
import io.quarkus.cache.CacheResult;
import jakarta.enterprise.context.ApplicationScoped;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.EnumMap;
import java.util.Map;

/**
 * Renders a tournament's public share-link as a branded PNG QR code.
 *
 * <p>The QR encodes the tournament's canonical public URL, so scanning it
 * opens the tournament page directly — meant for organisers to display on a
 * screen or print out at the venue. Error-correction level H (~30% recovery)
 * is mandatory here: it is what lets the app logo sit in the centre without
 * making the code unscannable, since those modules are simply overwritten.
 *
 * <p>Logo source: {@code src/main/resources/branding/logo-mark.png}, a copy
 * of the frontend's {@code public/icon-512.png} (the four Belot suits mark,
 * opaque white background, 512×512). The backend can't read the frontend's
 * {@code public/} directory at runtime, so the PNG is vendored into backend
 * resources and loaded from the classpath. Keep it in sync by hand if the
 * app icon changes.
 *
 * <p><b>Verified scannability:</b> a 22% centre logo (the size requested for
 * this feature) still round-trips through ZXing's own decoder
 * ({@link MultiFormatReader} + {@link HybridBinarizer}) at every size in the
 * supported range — this was confirmed with a throwaway {@code main} that
 * rendered, re-decoded and asserted the URL round-tripped, then deleted. See
 * {@link #LOGO_SCALE} for the number actually shipped.
 */
@ApplicationScoped
public class QrCodeRenderer {

    private static final Color FG = Color.BLACK;
    private static final Color BG = Color.WHITE;

    /** Classpath location of the vendored app icon (see class javadoc). */
    private static final String LOGO_RESOURCE = "/branding/logo-mark.png";

    /**
     * Centre logo size as a fraction of the QR's edge. 22% is the ceiling the
     * feature asked for; verified scannable at EC level H with the current
     * logo (a filled square icon, not a thin outline) at each of the three
     * supported output sizes ({@link #ALLOWED_SIZES}) — re-verified after the
     * per-pixel loop was replaced by the bulk raster write, by decoding the
     * rendered PNGs with {@link #decode(byte[])}. Shrink this — and update
     * this comment — if a future logo swap ever fails that self-check.
     */
    private static final double LOGO_SCALE = 0.22;

    /** Rounded-square white plate the logo sits on, in px per side beyond the logo. */
    private static final double PLATE_PADDING_SCALE = 0.10;

    /**
     * The only output sizes that can ever be rendered.
     *
     * <p>This used to be a {@code clamp(256, 1024)}, i.e. 769 distinct
     * accepted values — and {@code size} is a {@code @CacheKey}. Walking
     * {@code ?size=257,258,259,…} therefore missed the cache on every single
     * request AND evicted the useful entries behind it, turning a cached
     * endpoint into an uncached one that renders a full QR per hit. Caddy's
     * {@code render} zone limits request RATE, not per-request cost, so it
     * cannot help here. Quantising to three sizes gives the cache a bounded
     * key space (3 × tournaments) that an attacker cannot inflate.
     *
     * <p>Ascending order matters — {@link #clampSize(Integer)} scans it.
     */
    private static final int[] ALLOWED_SIZES = { 256, 512, 1024 };

    public static final int MIN_SIZE = 256;
    public static final int MAX_SIZE = 1024;
    public static final int DEFAULT_SIZE = 512;

    /**
     * Cached, CDI-proxied entry point. {@code @CacheResult} only intercepts
     * calls that go through the bean's proxy, so this thin wrapper — not the
     * controller — owns the cache; see {@code services/PreviewRenderService}
     * for the fuller rationale (same shape, different cache name). The key is
     * URL + size since both feed the render.
     */
    @CacheResult(cacheName = "qr")
    public byte[] renderCached(@CacheKey String url, @CacheKey int size) {
        return render(url, size);
    }

    /**
     * Quantise a caller-supplied size onto {@link #ALLOWED_SIZES}: the
     * smallest allowed size that is at least as large as the request, or
     * {@link #MAX_SIZE} for anything above it. An absent or non-positive
     * value gets {@link #DEFAULT_SIZE}.
     *
     * <p>Rounding UP rather than to the nearest keeps the guarantee callers
     * actually rely on — the returned PNG is never smaller than what was
     * asked for, so a layout sized for {@code ?size=300} still gets a
     * non-blurry image (512, downscaled by the browser).
     */
    public static int clampSize(Integer requested) {
        if (requested == null || requested <= 0) return DEFAULT_SIZE;
        for (int allowed : ALLOWED_SIZES) {
            if (requested <= allowed) return allowed;
        }
        return MAX_SIZE;
    }

    /** PNG bytes for a {@code size}×{@code size} branded QR encoding {@code url}. */
    byte[] render(String url, int size) {
        try {
            BufferedImage img = renderImage(url, size);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(img, "png", out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to render QR code", e);
        }
    }

    private BufferedImage renderImage(String url, int size) throws Exception {
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.H);
        hints.put(EncodeHintType.MARGIN, 2);
        hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");

        BitMatrix matrix = new QRCodeWriter().encode(url, BarcodeFormat.QR_CODE, size, size, hints);

        BufferedImage img = new BufferedImage(size, size, BufferedImage.TYPE_INT_RGB);

        // One bulk raster write instead of a fillRect() per pixel. The old
        // loop issued size² Java2D draw calls — 1,048,576 of them at 1024 px,
        // each with its own state validation and pipeline dispatch. Building
        // an int[] and handing it to setRGB writes straight into the backing
        // DataBufferInt. Row-major fill matches both the array layout and
        // BitMatrix's internal row bits, so it stays cache-friendly.
        int[] pixels = new int[size * size];
        int fg = FG.getRGB();
        int bg = BG.getRGB();
        int i = 0;
        for (int y = 0; y < size; y++) {
            for (int x = 0; x < size; x++) {
                pixels[i++] = matrix.get(x, y) ? fg : bg;
            }
        }
        img.setRGB(0, 0, size, size, pixels, 0, size);

        Graphics2D g = img.createGraphics();
        try {
            drawCenterLogo(g, size);
        } finally {
            g.dispose();
        }
        return img;
    }

    /**
     * Overlay the app logo, centred, on a white rounded-square plate so it
     * never sits directly on QR modules — the plate padding gives the
     * decoder a clean quiet zone around the logo edges even though EC-H
     * already tolerates the overwritten modules underneath.
     */
    private void drawCenterLogo(Graphics2D g, int size) throws IOException {
        BufferedImage logo = loadLogo();

        int logoSize = (int) Math.round(size * LOGO_SCALE);
        int pad = (int) Math.round(logoSize * PLATE_PADDING_SCALE);
        int plateSize = logoSize + 2 * pad;
        int plateX = (size - plateSize) / 2;
        int plateY = (size - plateSize) / 2;
        int logoX = (size - logoSize) / 2;
        int logoY = (size - logoSize) / 2;

        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);

        g.setColor(BG);
        double arc = plateSize * 0.22;
        g.fill(new RoundRectangle2D.Double(plateX, plateY, plateSize, plateSize, arc, arc));

        g.drawImage(logo, logoX, logoY, logoSize, logoSize, null);
    }

    /**
     * The decoded logo, loaded once and then reused for every render.
     *
     * <p>It used to be re-read and re-decoded from the classpath on every
     * single QR — a 512×512 PNG inflate plus a fresh 1 MB raster per
     * request, all to produce the identical image. The field is
     * {@code volatile} and written under {@link #logoLock}: the decoded
     * {@link BufferedImage} is only ever READ afterwards ({@code drawImage}
     * as a source never mutates it), so publishing it once is safe to share
     * across concurrent renders.
     */
    private volatile BufferedImage logo;
    private final Object logoLock = new Object();

    private BufferedImage loadLogo() throws IOException {
        BufferedImage cached = logo;
        if (cached != null) return cached;
        synchronized (logoLock) {
            if (logo != null) return logo;
            try (InputStream in = QrCodeRenderer.class.getResourceAsStream(LOGO_RESOURCE)) {
                if (in == null) {
                    throw new UncheckedIOException(new IOException("Missing classpath resource " + LOGO_RESOURCE));
                }
                BufferedImage decoded = ImageIO.read(in);
                if (decoded == null) {
                    throw new UncheckedIOException(new IOException("Unreadable image at " + LOGO_RESOURCE));
                }
                logo = decoded;
                return decoded;
            }
        }
    }

    /**
     * Decode a rendered PNG back with ZXing and confirm it holds {@code url}.
     * Not called by the render path — this is the reusable core of the
     * self-verification that was run (and confirmed passing at
     * {@link #LOGO_SCALE}) before this renderer shipped, kept here so the
     * same check can be re-run by hand after any future change to the logo
     * or its scale, without duplicating the ZXing wiring.
     */
    static String decode(byte[] png) throws Exception {
        BufferedImage img = ImageIO.read(new java.io.ByteArrayInputStream(png));
        BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(new BufferedImageLuminanceSource(img)));
        Result result = new MultiFormatReader().decode(bitmap);
        return result.getText();
    }
}
