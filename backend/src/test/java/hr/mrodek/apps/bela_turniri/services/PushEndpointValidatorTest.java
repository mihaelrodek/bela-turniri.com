package hr.mrodek.apps.bela_turniri.services;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pure unit tests for the Web Push endpoint allowlist — no Quarkus, no DB.
 *
 * <p>This class is an SSRF gate: {@code POST /push/subscribe} stores a URL the
 * backend later POSTs to on its own schedule, so a hole here turns any signed-in
 * user into a request-forgery primitive. The rejection cases below are the
 * attack shapes, not style nits.
 */
class PushEndpointValidatorTest {

    @Nested
    @DisplayName("accepted: real browser push services")
    class Accepted {

        @ParameterizedTest
        @ValueSource(strings = {
                // Chrome / Chromium — exact host
                "https://fcm.googleapis.com/fcm/send/dGhpcy1pcy1hLXRva2Vu",
                // Safari / iOS — exact host
                "https://web.push.apple.com/QBCbBTC3Xk7Vc0dS0Bq",
                // Safari, regional gateway — ".push.apple.com" suffix
                "https://api.push.apple.com/3/device/abc",
                // Firefox autopush — ".push.services.mozilla.com" suffix
                "https://updates.push.services.mozilla.com/wpush/v2/gAAAAA",
                "https://updates-autopush.stage.mozaws.push.services.mozilla.com/wpush/v2/x",
                // Edge / WNS — ".notify.windows.com" suffix
                "https://db5p.notify.windows.com/w/?token=BQYAAAB",
                // ".pushnotifications.googleapis.com" suffix
                "https://eu.pushnotifications.googleapis.com/v1/send/abc",
        })
        void allowsKnownPushHosts(String endpoint) {
            assertTrue(PushEndpointValidator.isAllowed(endpoint), endpoint);
        }

        @Test
        @DisplayName("host matching is case-insensitive and surrounding whitespace is trimmed")
        void normalisesHost() {
            assertTrue(PushEndpointValidator.isAllowed("https://FCM.GoogleAPIs.COM/fcm/send/x"));
            assertTrue(PushEndpointValidator.isAllowed("  https://fcm.googleapis.com/fcm/send/x  "));
        }

        @Test
        @DisplayName("assertAllowed is a no-op for a good endpoint")
        void assertAllowedPasses() {
            assertDoesNotThrow(() -> PushEndpointValidator.assertAllowed(
                    "https://fcm.googleapis.com/fcm/send/x", "nope"));
        }
    }

    @Nested
    @DisplayName("rejected: everything else")
    class Rejected {

        @ParameterizedTest
        @NullAndEmptySource
        @ValueSource(strings = {
                "   ",
                // --- wrong scheme: the endpoint must be https ---
                "http://fcm.googleapis.com/fcm/send/x",
                "ftp://fcm.googleapis.com/fcm/send/x",
                "//fcm.googleapis.com/fcm/send/x",
                "fcm.googleapis.com/fcm/send/x",
                "not-a-url",
                // --- userinfo trick: the real host is after the '@' ---
                "https://fcm.googleapis.com@evil.example/steal",
                "https://fcm.googleapis.com:pass@evil.example/steal",
                // --- suffix / prefix look-alikes ---
                "https://fcm.googleapis.com.evil.example/x",
                "https://evilfcm.googleapis.com/x",
                "https://notify.windows.com.evil.example/x",
                "https://xnotify.windows.com/x",
                // --- the allowlisted string in a place that is not the host ---
                "https://evil.example/?next=https://fcm.googleapis.com/fcm/send/x",
                "https://evil.example/fcm.googleapis.com",
                "https://evil.example#fcm.googleapis.com",
                // --- plain unknown host ---
                "https://example.com/push",
                // --- internal targets: literal IPs are never handed out by a vendor ---
                "https://127.0.0.1/push",
                "https://169.254.169.254/latest/meta-data/",
                "https://10.0.0.5:8080/push",
                "https://[::1]/push",
                "https://[fd00::1]/push",
                // --- unparseable ---
                "https://exa mple.com/push",
                "https://",
        })
        void rejectsEverythingElse(String endpoint) {
            assertFalse(PushEndpointValidator.isAllowed(endpoint), String.valueOf(endpoint));
        }

        @Test
        @DisplayName("only sub-domains of the suffix entries are allowed, not the bare apex")
        void bareApexOfASuffixEntryIsRejected() {
            // ALLOWED_HOSTS lists ".push.services.mozilla.com" (leading dot),
            // so the apex itself does not match. Documented here so a future
            // change to that list is a deliberate one, not an accident.
            assertFalse(PushEndpointValidator.isAllowed("https://push.services.mozilla.com/wpush/v2/x"));
            assertFalse(PushEndpointValidator.isAllowed("https://notify.windows.com/w/?token=x"));
        }

        @Test
        @DisplayName("assertAllowed throws the caller's localised message")
        void assertAllowedThrowsWithGivenMessage() {
            var ex = assertThrows(IllegalArgumentException.class,
                    () -> PushEndpointValidator.assertAllowed("https://evil.example/x",
                            "Nepodržani push endpoint."));
            assertEquals("Nepodržani push endpoint.", ex.getMessage());
        }
    }

    @Nested
    @DisplayName("hostOf: used for safe logging, so it must never leak the token")
    class HostOf {

        @Test
        @DisplayName("returns the lowercased host without scheme, path or query")
        void returnsHostOnly() {
            assertEquals("fcm.googleapis.com",
                    PushEndpointValidator.hostOf("https://FCM.googleapis.com/fcm/send/secret-token"));
        }

        @Test
        @DisplayName("does not require https — it is a logging helper, not a gate")
        void acceptsAnyScheme() {
            assertEquals("example.com", PushEndpointValidator.hostOf("http://example.com/x"));
            assertEquals("127.0.0.1", PushEndpointValidator.hostOf("https://127.0.0.1/x"));
        }

        @Test
        @DisplayName("null for anything without a parseable host")
        void nullForUnparseable() {
            assertNull(PushEndpointValidator.hostOf(null));
            assertNull(PushEndpointValidator.hostOf(""));
            assertNull(PushEndpointValidator.hostOf("   "));
            assertNull(PushEndpointValidator.hostOf("not-a-url"));
            assertNull(PushEndpointValidator.hostOf("https://exa mple.com/x"));
        }
    }
}
