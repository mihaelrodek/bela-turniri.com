package hr.mrodek.apps.bela_turniri.services;

import io.quarkus.cache.CacheKey;
import io.quarkus.cache.CacheResult;
import jakarta.enterprise.context.ApplicationScoped;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Renders a tournament's Open Graph share card: a 1200×630 PNG showing the
 * tournament name, start date/time, place and the app logo mark.
 *
 * <p>Why this exists: shared tournament links are the app's main growth
 * channel (people paste them into WhatsApp / Facebook groups), and every
 * link used to unfurl with the same generic square app icon — no way to
 * tell tournaments apart in a chat. This renders a distinct card per
 * tournament so the link itself advertises what it is.
 *
 * <p>Follows the same shape as {@link QrCodeRenderer}: plain Java2D,
 * classpath logo, {@code @CacheResult}-cached PNG bytes returned through the
 * CDI proxy (see that class's javadoc, and {@link PreviewRenderService}, for
 * why the cache must sit on a bean method rather than wrap a JAX-RS
 * {@code Response}).
 *
 * <p><b>Headless AWT:</b> {@code java.awt.headless=true} is forced in
 * {@link #ShareImageRenderer()} so this works in the packaged server JVM,
 * not just a test JVM with a real display. Text uses the logical
 * {@link Font#SANS_SERIF} family rather than naming a specific font — on the
 * {@code eclipse-temurin:21-jre} base image this resolves to DejaVu Sans
 * (bundled + fontconfig are both present on that image), which has full
 * Latin Extended-A coverage, so Croatian diacritics (Č č Ć ć Š š Ž ž Đ đ)
 * render as real glyphs instead of tofu boxes. Confirmed by running this
 * renderer's font inside a throwaway {@code eclipse-temurin:21-jre}
 * container and checking {@link Font#canDisplayUpTo(String)} returns -1 for
 * a diacritic-heavy string.
 */
@ApplicationScoped
public class ShareImageRenderer {

    public static final int WIDTH = 1200;
    public static final int HEIGHT = 630;

    private static final int PADDING = 64;

    /** Classpath location of the vendored app icon (same asset {@link QrCodeRenderer} uses). */
    private static final String LOGO_RESOURCE = "/branding/logo-mark.png";

    // Brand green ramp, copied from frontend/src/system.ts's `brand` token
    // scale (centred on #2f8f52, the felt green derived from the app logo)
    // so the card matches the app's palette rather than inventing new colours.
    private static final Color BG_TOP = new Color(0x0a, 0x4f, 0x20);    // brand.800
    private static final Color BG_BOTTOM = new Color(0x05, 0x2b, 0x12); // brand.950
    private static final Color ACCENT_BAR = new Color(0x2f, 0x8f, 0x52); // brand.500
    private static final Color TITLE_COLOR = Color.WHITE;
    private static final Color META_COLOR = new Color(0xd5, 0xec, 0xdc); // brand.100
    private static final Color WORDMARK_COLOR = Color.WHITE;

    private static final int TITLE_MAX_LINES = 3;
    private static final int[] TITLE_FONT_SIZES = {72, 64, 56, 48, 42, 36};
    private static final int META_FONT_SIZE = 32;
    private static final int WORDMARK_FONT_SIZE = 30;

    /** Same Croatian formatting used in the crawler-facing preview HTML. */
    private static final DateTimeFormatter HR_DATETIME =
            DateTimeFormatter.ofPattern("EEE, d. MMMM yyyy. 'u' HH:mm", Locale.forLanguageTag("hr-HR"));

    public ShareImageRenderer() {
        // Belt and braces: the server never has a display, but forcing this
        // here means the renderer is correct even if invoked from a context
        // that didn't already set the system property (e.g. a future CLI
        // tool or a test that boots AWT before Quarkus config kicks in).
        System.setProperty("java.awt.headless", "true");
    }

    /**
     * Cached, CDI-proxied entry point — {@code @CacheResult} only intercepts
     * calls through the bean's proxy (see {@link QrCodeRenderer#renderCached}
     * for the fuller rationale).
     *
     * <p>Cache key is the tournament id plus {@code updatedAtStamp}
     * (the entity's {@code updatedAt}, serialised by the caller) rather than
     * the rendered fields themselves: {@code updatedAt} is a
     * {@code @UpdateTimestamp} that bumps on <em>any</em> field change, so it
     * is a safe (if slightly conservative — a price-only edit also busts the
     * card) proxy for "this tournament's card may have changed". That is
     * exactly what stops an edited tournament from serving a stale card out
     * of a 6-hour cache. {@code name}/{@code startAt}/{@code location} are
     * NOT part of the key (they're implied by the stamp) — only passed
     * through to actually render.
     */
    @CacheResult(cacheName = "share-image")
    public byte[] renderCached(@CacheKey Long tournamentId, @CacheKey String updatedAtStamp,
                                String name, OffsetDateTime startAt, String location) {
        return render(name, startAt, location);
    }

    /** Render the PNG bytes for a share card. Package-visible for tests. */
    byte[] render(String name, OffsetDateTime startAt, String location) {
        try {
            BufferedImage img = renderImage(name, startAt, location);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(img, "png", out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to render share image", e);
        }
    }

    private BufferedImage renderImage(String name, OffsetDateTime startAt, String location) throws IOException {
        BufferedImage img = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);

            paintBackground(g);
            paintHeader(g);
            int titleBottom = paintTitle(g, name != null && !name.isBlank() ? name.trim() : "Bela turnir");
            paintMeta(g, startAt, location, titleBottom);
        } finally {
            g.dispose();
        }
        return img;
    }

    private void paintBackground(Graphics2D g) {
        g.setPaint(new GradientPaint(0, 0, BG_TOP, WIDTH, HEIGHT, BG_BOTTOM));
        g.fillRect(0, 0, WIDTH, HEIGHT);

        // Thin accent strip along the bottom edge — a small deliberate touch
        // rather than a flat, undecorated card.
        g.setColor(ACCENT_BAR);
        g.fillRect(0, HEIGHT - 8, WIDTH, 8);
    }

    /** App logo badge (top-left) + "bela-turniri.com" wordmark next to it. */
    private void paintHeader(Graphics2D g) throws IOException {
        int logoSize = 88;
        int logoX = PADDING;
        int logoY = PADDING;

        BufferedImage logo = loadLogo();
        // The vendored logo already has an opaque white background (see
        // QrCodeRenderer's javadoc), so a rounded clip alone turns it into a
        // clean rounded-square badge without needing a separate plate.
        java.awt.Shape oldClip = g.getClip();
        double arc = logoSize * 0.28;
        g.setClip(new RoundRectangle2D.Double(logoX, logoY, logoSize, logoSize, arc, arc));
        g.drawImage(logo, logoX, logoY, logoSize, logoSize, null);
        g.setClip(oldClip);

        Font wordmarkFont = new Font(Font.SANS_SERIF, Font.BOLD, WORDMARK_FONT_SIZE);
        g.setFont(wordmarkFont);
        g.setColor(WORDMARK_COLOR);
        FontMetrics fm = g.getFontMetrics();
        int textX = logoX + logoSize + 24;
        int textY = logoY + (logoSize + fm.getAscent() - fm.getDescent()) / 2;
        g.drawString("bela-turniri.com", textX, textY);
    }

    /**
     * Draw the tournament name as the card's hero element. Shrinks the font
     * stepwise (see {@link #TITLE_FONT_SIZES}) until the wrapped text fits
     * within {@link #TITLE_MAX_LINES} lines at the card's width; at the
     * smallest size the last line is ellipsized instead of overflowing.
     *
     * @return the y-coordinate just below the last drawn title line
     */
    private int paintTitle(Graphics2D g, String name) {
        int maxWidth = WIDTH - 2 * PADDING;
        int top = PADDING + 88 + 64; // below the header badge, with a gap

        Font chosenFont = null;
        List<String> chosenLines = null;
        for (int size : TITLE_FONT_SIZES) {
            Font f = new Font(Font.SANS_SERIF, Font.BOLD, size);
            FontMetrics fm = g.getFontMetrics(f);
            List<String> lines = wrap(fm, name, maxWidth, TITLE_MAX_LINES + 1);
            if (lines.size() <= TITLE_MAX_LINES) {
                chosenFont = f;
                chosenLines = lines;
                break;
            }
            // Keep the smallest-size attempt around in case nothing fits.
            chosenFont = f;
            chosenLines = lines;
        }

        FontMetrics fm = g.getFontMetrics(chosenFont);
        if (chosenLines.size() > TITLE_MAX_LINES) {
            chosenLines = new ArrayList<>(chosenLines.subList(0, TITLE_MAX_LINES));
            String last = chosenLines.get(TITLE_MAX_LINES - 1);
            chosenLines.set(TITLE_MAX_LINES - 1, ellipsize(fm, last + "…", maxWidth));
        }

        g.setFont(chosenFont);
        g.setColor(TITLE_COLOR);
        int lineHeight = fm.getHeight();
        int y = top + fm.getAscent();
        for (String line : chosenLines) {
            g.drawString(line, PADDING, y);
            y += lineHeight;
        }
        return y - fm.getAscent() + fm.getDescent();
    }

    /** Date/time and location lines below the title, each truncated (not wrapped) to one line. */
    private void paintMeta(Graphics2D g, OffsetDateTime startAt, String location, int titleBottom) {
        int maxWidth = WIDTH - 2 * PADDING;
        Font font = new Font(Font.SANS_SERIF, Font.PLAIN, META_FONT_SIZE);
        g.setFont(font);
        g.setColor(META_COLOR);
        FontMetrics fm = g.getFontMetrics();

        int y = titleBottom + 40 + fm.getAscent();
        int lineHeight = (int) Math.round(fm.getHeight() * 1.15);

        // Plain "•" bullets rather than calendar/pin emoji: DejaVu Sans (the
        // font this renders with in the packaged server JVM — see the class
        // javadoc) has no reliable colour-emoji coverage, and a missing
        // glyph renders as a tofu box, which would look worse than no icon
        // at all.
        if (startAt != null) {
            String line = "• " + HR_DATETIME.format(startAt);
            g.drawString(ellipsize(fm, line, maxWidth), PADDING, y);
            y += lineHeight;
        }
        if (location != null && !location.isBlank()) {
            String line = "• " + location.trim();
            g.drawString(ellipsize(fm, line, maxWidth), PADDING, y);
        }
    }

    private BufferedImage loadLogo() throws IOException {
        try (InputStream in = ShareImageRenderer.class.getResourceAsStream(LOGO_RESOURCE)) {
            if (in == null) {
                throw new UncheckedIOException(new IOException("Missing classpath resource " + LOGO_RESOURCE));
            }
            return ImageIO.read(in);
        }
    }

    /**
     * Greedy word-wrap into at most {@code maxLines} lines of at most
     * {@code maxWidth} px each. A single word wider than {@code maxWidth} is
     * hard-broken by character so pathological input (one absurdly long
     * "word") never blows past the box.
     */
    private static List<String> wrap(FontMetrics fm, String text, int maxWidth, int maxLines) {
        List<String> lines = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (String word : text.split("\\s+")) {
            if (word.isEmpty()) continue;
            String candidate = current.isEmpty() ? word : current + " " + word;
            if (fm.stringWidth(candidate) <= maxWidth) {
                current = new StringBuilder(candidate);
                continue;
            }
            // candidate overflowed: flush what we had, start a new line with `word`
            if (!current.isEmpty()) {
                lines.add(current.toString());
                current = new StringBuilder();
            }
            if (fm.stringWidth(word) <= maxWidth) {
                current = new StringBuilder(word);
            } else {
                // Single word wider than the box — hard-break by character.
                StringBuilder piece = new StringBuilder();
                for (int i = 0; i < word.length(); i++) {
                    char c = word.charAt(i);
                    if (fm.stringWidth(piece.toString() + c) > maxWidth && !piece.isEmpty()) {
                        lines.add(piece.toString());
                        piece = new StringBuilder();
                        if (lines.size() >= maxLines) break;
                    }
                    piece.append(c);
                }
                current = piece;
            }
            if (lines.size() >= maxLines) break;
        }
        if (!current.isEmpty() && lines.size() < maxLines) lines.add(current.toString());
        return lines;
    }

    /** Trim {@code text} to fit {@code maxWidth}, appending "…" if it had to cut. */
    private static String ellipsize(FontMetrics fm, String text, int maxWidth) {
        if (fm.stringWidth(text) <= maxWidth) return text;
        String ellipsis = "…";
        int lo = 0, hi = text.length();
        // Binary search the longest prefix (+ ellipsis) that fits.
        while (lo < hi) {
            int mid = (lo + hi + 1) / 2;
            String candidate = text.substring(0, mid).stripTrailing() + ellipsis;
            if (fm.stringWidth(candidate) <= maxWidth) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }
        return text.substring(0, lo).stripTrailing() + ellipsis;
    }
}
