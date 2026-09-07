package hr.mrodek.apps.bela_turniri.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pure unit tests for the RFC-5545 line folding and text escaping in
 * {@link CalendarFeedController} — no Quarkus, no HTTP, no DB.
 *
 * <p>Why this matters: a calendar client that hits a content line longer than
 * 75 octets, a bare CR inside a value, or an unescaped comma rejects the WHOLE
 * feed, silently. Croatian names and locations routinely carry both commas
 * ("Zagreb, Trešnjevka") and multi-byte diacritics (č ć š ž đ), so the octet
 * cap and the UTF-8-safe split point are exactly where this breaks.
 *
 * <p>{@code fold} and {@code escapeText} are private statics with no state,
 * so they are reached by reflection rather than by widening their visibility —
 * this test deliberately does not ask the production class to change shape.
 * If either is renamed, these tests fail loudly at setup with the method name
 * in the message.
 */
class IcsFoldingTest {

    private static final int MAX_OCTETS = 75;

    private static Method priv(String name) {
        try {
            Method m = CalendarFeedController.class.getDeclaredMethod(name, String.class);
            m.setAccessible(true);
            return m;
        } catch (NoSuchMethodException e) {
            throw new AssertionError(
                    "CalendarFeedController." + name + "(String) is gone — if it was renamed or "
                            + "moved, update this test; the RFC-5545 rules it guards still apply.", e);
        }
    }

    private static String call(String method, String arg) {
        try {
            return (String) priv(method).invoke(null, arg);
        } catch (IllegalAccessException e) {
            throw new AssertionError(e);
        } catch (InvocationTargetException e) {
            throw new AssertionError(e.getCause());
        }
    }

    private static String fold(String s) {
        return call("fold", s);
    }

    private static String esc(String s) {
        return call("escapeText", s);
    }

    private static int octets(String s) {
        return s.getBytes(StandardCharsets.UTF_8).length;
    }

    /**
     * Assert the RFC-5545 §3.1 shape of a folded value: CRLF-separated
     * physical lines, none longer than 75 octets, every continuation line
     * starting with exactly one space.
     */
    private static void assertWellFolded(String folded) {
        String[] lines = folded.split("\r\n", -1);
        for (int i = 0; i < lines.length; i++) {
            // Physical lines are separated by CRLF and nothing else: after
            // splitting on CRLF no stray CR or LF may remain.
            assertFalse(lines[i].indexOf('\r') >= 0 || lines[i].indexOf('\n') >= 0,
                    "line " + i + " contains a bare CR or LF — the separator is CRLF only");
            assertTrue(octets(lines[i]) <= MAX_OCTETS,
                    "line " + i + " is " + octets(lines[i]) + " octets: <" + lines[i] + ">");
            if (i > 0) {
                assertTrue(lines[i].startsWith(" "),
                        "continuation line " + i + " must start with a single space");
                assertFalse(lines[i].startsWith("  "),
                        "continuation line " + i + " must start with exactly one space");
            }
        }
    }

    /** RFC-5545 unfolding: drop every CRLF followed by a single space. */
    private static String unfold(String folded) {
        return folded.replace("\r\n ", "");
    }

    /* ===================== fold ===================== */

    @Test
    @DisplayName("a line that fits is returned untouched")
    void shortLineIsNotFolded() {
        String line = "SUMMARY:Bela turnir u Zagrebu";
        assertSame(line, fold(line), "no copy, no CRLF for a line under the cap");
    }

    @Test
    @DisplayName("a line of exactly 75 octets is still not folded")
    void exactlyAtTheCapIsNotFolded() {
        String line = "X:" + "a".repeat(73);
        assertEquals(MAX_OCTETS, octets(line));
        assertEquals(line, fold(line));
        assertFalse(fold(line).contains("\r\n"));
    }

    @Test
    @DisplayName("a long ASCII line folds to CRLF + space and unfolds back exactly")
    void longAsciiLineFolds() {
        String line = "DESCRIPTION:" + "abcdefghij".repeat(40); // 412 octets
        String folded = fold(line);
        assertWellFolded(folded);
        assertEquals(line, unfold(folded), "unfolding must reproduce the original byte-for-byte");
    }

    @Test
    @DisplayName("Croatian diacritics: the split never lands inside a UTF-8 sequence")
    void multiByteCharactersAreNeverSplit() {
        // Every one of these is two octets in UTF-8, so a naive character-count
        // fold would overshoot the octet cap and a naive octet-count fold would
        // cut a character in half.
        String line = "SUMMARY:" + "čćšžđ".repeat(40); // 8 + 400 octets
        String folded = fold(line);
        assertWellFolded(folded);
        // If a split had landed mid-character, unfolding would have produced
        // replacement characters instead of the original text.
        assertEquals(line, unfold(folded));
        assertFalse(folded.contains("�"), "no replacement characters — no corrupted split");
    }

    @Test
    @DisplayName("a value made of 4-octet characters folds safely too")
    void fourByteCharactersFoldSafely() {
        String line = "SUMMARY:" + "🂡".repeat(40); // 🂡, 4 octets each
        String folded = fold(line);
        assertWellFolded(folded);
        assertEquals(line, unfold(folded));
    }

    @Test
    @DisplayName("a mixed ASCII/diacritic line folds safely")
    void mixedLineFoldsSafely() {
        String line = "LOCATION:Ulica kralja Držislava 12\\, Sveti Križ Začretje — "
                + "dvorana \"Šumski češalj\"".repeat(6);
        String folded = fold(line);
        assertWellFolded(folded);
        assertEquals(line, unfold(folded));
    }

    /* ===================== escapeText ===================== */

    @Test
    @DisplayName("null becomes an empty value rather than the string \"null\"")
    void nullBecomesEmpty() {
        assertEquals("", esc(null));
    }

    @Test
    @DisplayName("comma, semicolon and backslash are backslash-escaped")
    void escapesSpecialCharacters() {
        assertEquals("Zagreb\\, Trešnjevka", esc("Zagreb, Trešnjevka"));
        assertEquals("a\\;b", esc("a;b"));
        assertEquals("a\\\\b", esc("a\\b"));
    }

    @Test
    @DisplayName("the backslash escape runs first, so introduced backslashes are not doubled")
    void escapeOrderIsBackslashFirst() {
        // "a\,b" -> backslash doubled -> "a\\,b" -> comma escaped -> "a\\\,b"
        assertEquals("a\\\\\\,b", esc("a\\,b"));
    }

    @Test
    @DisplayName("every newline flavour becomes the literal two-character \\n")
    void normalisesEveryLineBreak() {
        assertEquals("a\\nb", esc("a\nb"));
        assertEquals("a\\nb", esc("a\r\nb"), "CRLF must not leave a stray CR behind");
        assertEquals("a\\nb", esc("a\rb"), "a lone CR (old Mac export) must be normalised too");
    }

    @Test
    @DisplayName("no raw CR or LF survives escaping — a strict parser rejects those")
    void noRawControlCharactersSurvive() {
        String out = esc("prvi red\r\ndrugi red\rtreći\nčetvrti");
        assertFalse(out.contains("\r"), "raw CR inside a value breaks strict clients");
        assertFalse(out.contains("\n"), "raw LF inside a value breaks strict clients");
    }

    /* ===================== the two together ===================== */

    @Test
    @DisplayName("escape-then-fold: a long Croatian location stays parseable")
    void escapedValueFoldsCorrectly() {
        String raw = "Društveni dom \"Zvonimir\", Ulica Matije Gupca 17; Đurđevac, "
                + "Koprivničko-križevačka županija, Republika Hrvatska";
        String folded = fold("LOCATION:" + esc(raw));
        assertWellFolded(folded);
        // Unfolding gives back the escaped value, commas and semicolons intact.
        assertTrue(unfold(folded).startsWith("LOCATION:"));
        assertTrue(unfold(folded).contains("\\;"), "the semicolon survived folding as an escape");
        assertTrue(unfold(folded).contains("\\,"), "the commas survived folding as escapes");
    }
}
