package hr.mrodek.apps.bela_turniri.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.context.ContextNotActiveException;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.text.MessageFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.MissingResourceException;
import java.util.PropertyResourceBundle;
import java.util.ResourceBundle;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Backend i18n lookup for every human-readable string that would otherwise be
 * hardcoded Croatian in a controller, a service or an exception mapper
 * (400/404/409 envelope messages, validation text, push-notification
 * title/body, e-mail copy).
 *
 * <p>Bundles live at
 * {@code src/main/resources/i18n/messages_{locale}.properties} — one flat
 * {@code key = value} file per locale, with dotted keys mirroring the feature
 * area ({@code error.notFound}, {@code tournament.push.round.title}, …).
 * Adding a language is one new {@code messages_xx.properties} plus one entry
 * in {@link hr.mrodek.apps.bela_turniri.filters.LocaleRequestFilter}'s
 * supported set.
 *
 * <h2>Encoding</h2>
 * The properties files are stored as UTF-8 with the diacritics written
 * literally (č ć ž š đ, and Slovenian č š ž) rather than {@code \\uXXXX}
 * escapes. We never go through {@link ResourceBundle#getBundle(String, Locale)}
 * — its charset handling changed across Java versions and depends on the
 * default {@code Control}. Instead the file is opened here and handed to
 * {@link PropertyResourceBundle#PropertyResourceBundle(java.io.Reader)} via an
 * explicit {@link InputStreamReader}{@code (in, StandardCharsets.UTF_8)},
 * which reads verbatim from the given reader. That sidesteps the whole
 * default-charset question instead of depending on it.
 *
 * <h2>Which locale gets used</h2>
 * <ul>
 *   <li>{@link #t(String, Object...)} resolves the locale from the
 *       request-scoped {@link RequestLocale}, populated per request by
 *       {@link hr.mrodek.apps.bela_turniri.filters.LocaleRequestFilter}. Use
 *       it for anything the current caller will read: error envelopes,
 *       validation messages, synchronous response text.</li>
 *   <li>{@link #t(Locale, String, Object...)} takes the locale explicitly.
 *       <b>This is the overload to use for anything composed for a
 *       <i>recipient</i> rather than for the current caller</b> — above all
 *       Web Push notifications ({@code PushService}), which are built while
 *       handling <i>someone else's</i> request (the organiser draws a round;
 *       the notification goes to every player). The request locale there is
 *       the organiser's, not the reader's. Pass the recipient's stored
 *       {@code UserProfile.locale} (falling back to {@link #DEFAULT_LOCALE}
 *       when null) so each player is notified in their own language. The same
 *       applies to any future background job, scheduled task or e-mail sender
 *       running off a request thread.</li>
 * </ul>
 *
 * <h2>Missing keys</h2>
 * A key absent from the requested locale falls back to the Croatian value; a
 * key absent everywhere returns the key itself. Both cases log at DEBUG —
 * never an exception, because a typo'd key must not turn a working endpoint
 * into a 500.
 */
@ApplicationScoped
public class MessageService {

    private static final Logger LOG = Logger.getLogger(MessageService.class);

    /** Fallback locale — no {@code X-Locale} header, an unsupported one, a
     *  key missing from the requested bundle, or no request context at all. */
    public static final Locale DEFAULT_LOCALE = Locale.forLanguageTag("hr");

    /** Language tags with a bundle on the classpath. Adding "en" later = drop
     *  in {@code messages_en.properties} and add it here. */
    public static final Set<String> SUPPORTED_LANGUAGES = Set.of("hr", "sl");

    private static final String BASE_PATH = "/i18n/messages";

    /** One cached bundle per language tag. Bundles are immutable once loaded,
     *  so this never needs invalidating. */
    private final Map<String, ResourceBundle> bundles = new ConcurrentHashMap<>();

    @Inject RequestLocale requestLocale;

    /** True when {@code tag} is a language we ship a bundle for. Used by the
     *  request filter and by {@code UserMeController} to validate the locale a
     *  client asks to store on its profile. */
    public static boolean isSupported(String tag) {
        return tag != null && SUPPORTED_LANGUAGES.contains(tag.trim().toLowerCase(Locale.ROOT));
    }

    /**
     * Resolve {@code key} for the CURRENT REQUEST's language, substituting
     * {@code args} positionally via {@link MessageFormat} ({@code {0}},
     * {@code {1}}, …).
     *
     * <p>Do not use this to compose a push notification or an e-mail for
     * another user — see the class javadoc, "Which locale gets used".
     */
    public String t(String key, Object... args) {
        Locale locale;
        try {
            locale = requestLocale.get();
        } catch (ContextNotActiveException e) {
            // Off a request thread (background pool, startup task).
            locale = DEFAULT_LOCALE;
        }
        return t(locale, key, args);
    }

    /**
     * Resolve {@code key} for an EXPLICIT {@code locale}. Use for anything
     * addressed to a recipient rather than to the current caller (push
     * notifications, e-mails, scheduled jobs).
     */
    public String t(Locale locale, String key, Object... args) {
        if (key == null) return "";
        String lang = languageOf(locale);
        String pattern = raw(lang, key);
        if (pattern == null && !DEFAULT_LOCALE.getLanguage().equals(lang)) {
            pattern = raw(DEFAULT_LOCALE.getLanguage(), key);
            if (pattern != null) {
                LOG.debugf("i18n: key '%s' missing for '%s', using '%s'",
                        key, lang, DEFAULT_LOCALE.getLanguage());
            }
        }
        if (pattern == null) {
            LOG.debugf("i18n: key '%s' missing in every bundle", key);
            return key;
        }
        if (args == null || args.length == 0) return pattern;
        return new MessageFormat(pattern, locale != null ? locale : DEFAULT_LOCALE).format(args);
    }

    /** Locale for a stored profile value ({@code UserProfile.locale}), falling
     *  back to Croatian for null / unknown values. Convenience for the push
     *  and e-mail paths so every call site does not re-implement the check. */
    public Locale localeOf(String tag) {
        return isSupported(tag) ? Locale.forLanguageTag(tag.trim().toLowerCase(Locale.ROOT)) : DEFAULT_LOCALE;
    }

    private String raw(String lang, String key) {
        try {
            return bundleFor(lang).getString(key);
        } catch (MissingResourceException e) {
            return null;
        }
    }

    private static String languageOf(Locale locale) {
        if (locale == null) return DEFAULT_LOCALE.getLanguage();
        String lang = locale.getLanguage();
        return (lang == null || lang.isBlank()) ? DEFAULT_LOCALE.getLanguage() : lang;
    }

    /**
     * Bundle for {@code lang}, loading it on first use and memoising it.
     *
     * <p>Deliberately NOT a one-liner {@code computeIfAbsent(lang,
     * this::loadBundle)}: when the requested language has no bundle on the
     * classpath the fallback is the DEFAULT language's bundle, which may
     * itself still need loading — i.e. a second write to the same
     * {@link ConcurrentHashMap} from inside the mapping function of the
     * first. Since Java 9 that recursive update either throws
     * {@link IllegalStateException} ("Recursive update") or, on older
     * implementations, live-locks the bin. It is unreachable today because
     * every language {@link #SUPPORTED_LANGUAGES} admits ships a bundle, but
     * the documented "adding a language is one file" workflow makes hitting
     * it a matter of time. So the fallback is fully resolved BEFORE the map
     * is touched, and the result is published with a plain
     * {@code putIfAbsent}: two threads may briefly load the same bundle
     * twice, which is harmless (bundles are immutable and identical) and far
     * cheaper than the failure mode it replaces.
     */
    private ResourceBundle bundleFor(String lang) {
        ResourceBundle cached = bundles.get(lang);
        if (cached != null) return cached;

        ResourceBundle loaded = loadBundle(lang);
        if (loaded == null) {
            // No bundle for this language — resolve the default OUTSIDE any
            // mapping function, then alias this language onto it so the miss
            // is only paid once.
            loaded = bundleFor(DEFAULT_LOCALE.getLanguage());
        }
        ResourceBundle previous = bundles.putIfAbsent(lang, loaded);
        return previous != null ? previous : loaded;
    }

    /**
     * Read {@code messages_<lang>.properties} off the classpath, or return
     * null when the file is simply not there (an unknown language asked for
     * at runtime — the caller falls back to Croatian rather than blowing up
     * the request). A missing DEFAULT bundle is a packaging bug and still
     * throws.
     */
    private ResourceBundle loadBundle(String lang) {
        String path = BASE_PATH + "_" + lang + ".properties";
        try (InputStream in = MessageService.class.getResourceAsStream(path)) {
            if (in == null) {
                if (!DEFAULT_LOCALE.getLanguage().equals(lang)) {
                    LOG.debugf("i18n: no bundle at %s, falling back to default", path);
                    return null;
                }
                throw new IllegalStateException("Missing message bundle: " + path);
            }
            return new PropertyResourceBundle(new InputStreamReader(in, StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read message bundle: " + path, e);
        }
    }

    /** Language tags in preference order — handy for tests and diagnostics. */
    public List<String> supportedLanguages() {
        return SUPPORTED_LANGUAGES.stream().sorted().toList();
    }
}
