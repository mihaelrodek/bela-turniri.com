package hr.mrodek.apps.bela_turniri.services;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import java.util.Set;
import java.util.TreeSet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pins the invariant {@link MessageService}'s class javadoc promises: every
 * shipped locale bundle under {@code src/main/resources/i18n/} carries the
 * IDENTICAL key set as {@code messages_hr.properties} (the source of truth).
 * A key present in one bundle but missing in another is either a forgotten
 * translation (silently falls back to Croatian at runtime — see
 * {@link MessageService#t(java.util.Locale, String, Object...)}) or a stray
 * key nobody reads; either way it should never slip in unnoticed.
 *
 * <p>Deliberately NOT a {@code @QuarkusTest}: reading the bundles off the
 * classpath needs no CDI container and no datasource, so this stays a plain
 * JUnit test that runs in milliseconds and without docker-compose.
 */
class MessageBundleKeysTest {

    @Test
    void everySupportedLanguageHasABundle() {
        for (String lang : MessageService.SUPPORTED_LANGUAGES) {
            assertTrue(load(lang) != null && !load(lang).isEmpty(),
                    "messages_" + lang + ".properties should exist and be non-empty");
        }
    }

    @Test
    void slBundleHasTheSameKeysAsHr() {
        assertEquals(keysOf(load("hr")), keysOf(load("sl")),
                "messages_sl.properties must have the same key set as messages_hr.properties");
    }

    @Test
    void enBundleHasTheSameKeysAsHr() {
        assertEquals(keysOf(load("hr")), keysOf(load("en")),
                "messages_en.properties must have the same key set as messages_hr.properties");
    }

    private static Set<String> keysOf(Properties props) {
        return new TreeSet<>(props.stringPropertyNames());
    }

    /** Mirrors MessageService#loadBundle: explicit UTF-8 reader, no
     *  ResourceBundle.getBundle default-charset guessing. */
    private static Properties load(String lang) {
        String path = "/i18n/messages_" + lang + ".properties";
        Properties props = new Properties();
        try (InputStream in = MessageBundleKeysTest.class.getResourceAsStream(path)) {
            if (in == null) return null;
            props.load(new InputStreamReader(in, StandardCharsets.UTF_8));
            return props;
        } catch (IOException e) {
            throw new RuntimeException("Failed to read " + path, e);
        }
    }
}
