package hr.mrodek.apps.bela_turniri.services;

/**
 * Shared, side-effect-free helpers for the server-rendered SEO/preview
 * pages ({@code HomePreviewController}, {@code TournamentPreviewController},
 * {@code ProfilePreviewController}). These three controllers render bytes
 * that get memoised (see {@link PreviewRenderService}) and consumed by
 * bots (Googlebot, WhatsApp, Slack, …), so the output of every method here
 * must stay byte-identical to what each controller inlined before this
 * class existed.
 *
 * <p>Pure static utility on purpose — every method here is a stateless
 * string transform or append, so there is nothing CDI needs to manage.
 */
public final class PreviewHtml {

    private PreviewHtml() {
    }

    /**
     * Shared-cache lifetime for preview HTML. Matches the 5-10 minute
     * Caffeine TTLs on the individual {@code preview-*} caches — no point
     * telling a CDN to hold a copy longer than we would serve the same
     * bytes anyway.
     */
    public static final String PREVIEW_CACHE_CONTROL = "public, max-age=300, s-maxage=600";

    /**
     * Fallback {@code og:image} for pages with no dedicated image of their
     * own (homepage, and a profile with no avatar uploaded): the purpose-built
     * 1200x630 PNG at {@code frontend/public/bela-turniri-og-card.png}, the
     * ratio Facebook/WhatsApp/Slack lay a link-preview card out for.
     */
    public static final String DEFAULT_OG_IMAGE_FILENAME = "bela-turniri-og-card.png";
    public static final int DEFAULT_OG_IMAGE_WIDTH = 1200;
    public static final int DEFAULT_OG_IMAGE_HEIGHT = 630;

    /** Minimal HTML escape for text node content. */
    public static String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    /** Stricter escape for attribute values (also escapes quotes). */
    public static String escapeAttr(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    /**
     * JSON string escaping per RFC 8259. Also escapes {@code /} after
     * {@code <} so {@code </script>} can't prematurely close the embedding
     * {@code <script>} tag.
     */
    public static String jsonEscape(String s) {
        if (s == null) return "";
        StringBuilder out = new StringBuilder(s.length() + 8);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"'  -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                case '\b' -> out.append("\\b");
                case '\f' -> out.append("\\f");
                case '/'  -> {
                    if (i > 0 && s.charAt(i - 1) == '<') out.append("\\/");
                    else out.append('/');
                }
                default -> {
                    if (c < 0x20) {
                        out.append(String.format("\\u%04x", (int) c));
                    } else {
                        out.append(c);
                    }
                }
            }
        }
        return out.toString();
    }

    /**
     * Absolute favicon / touch-icon links.
     *
     * <p>Crawlers fetch this HTML at {@code /api/preview/*} (Caddy rewrites
     * the pretty URL), so a relative {@code href="/icon-192.png"} would still
     * resolve — but Google's favicon crawler and several chat clients resolve
     * icon links against the *document* URL they were handed, which for a
     * shared link may be a proxied or AMP-style URL. Absolute URLs built from
     * {@code app.public-base-url} remove the ambiguity, and are why the site
     * shows a card logo in SERPs instead of the generic globe.
     *
     * <p>File names are the ones actually shipped in {@code frontend/public/}:
     * {@code favicon.ico} for the crawlers that only look there, the SVG
     * symbol as the primary icon and {@code icon-192.png} as the PWA raster
     * fallback for clients that don't do SVG favicons.
     *
     * @param base {@code app.public-base-url} with no trailing slash.
     */
    public static void appendIconLinks(StringBuilder sb, String base) {
        // favicon.ico first and unqualified: Google's favicon crawler and
        // older chat clients look for exactly this, and only fall back to the
        // typed links below.
        sb.append("<link rel=\"icon\" sizes=\"any\" href=\"")
                .append(escapeAttr(base)).append("/favicon.ico\">\n");
        sb.append("<link rel=\"icon\" type=\"image/svg+xml\" href=\"")
                .append(escapeAttr(base)).append("/bela-turniri-symbol.svg\">\n");
        sb.append("<link rel=\"icon\" type=\"image/png\" sizes=\"192x192\" href=\"")
                .append(escapeAttr(base)).append("/icon-192.png\">\n");
        sb.append("<link rel=\"apple-touch-icon\" sizes=\"180x180\" href=\"")
                .append(escapeAttr(base)).append("/apple-touch-icon.png\">\n");
    }

    /**
     * {@code og:image} meta trio (+ alt), with the width/height pair only
     * emitted when known — callers pass {@code null} for either when the
     * image is user-supplied and its dimensions aren't known ahead of time
     * (e.g. an uploaded avatar of arbitrary aspect ratio).
     */
    public static void appendOgImageMeta(StringBuilder sb, String image, Integer width, Integer height, String alt) {
        sb.append("<meta property=\"og:image\" content=\"").append(escapeAttr(image)).append("\">\n");
        if (width != null) {
            sb.append("<meta property=\"og:image:width\" content=\"").append(width).append("\">\n");
        }
        if (height != null) {
            sb.append("<meta property=\"og:image:height\" content=\"").append(height).append("\">\n");
        }
        sb.append("<meta property=\"og:image:alt\" content=\"").append(escapeAttr(alt)).append("\">\n");
    }
}
