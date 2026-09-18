package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.LiveActivityRequest;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Message shapes of {@link LiveActivitySender}, without a container: the
 * Android data map and the iOS {@code aps} dictionary are the contract the
 * native apps decode, so their keys are pinned here.
 */
class LiveActivitySenderTest {

    private static final LiveActivityRequest.State STATE = new LiveActivityRequest.State(
            "r-1", "playing", 312, 140, 1001, true, null, null, "PIK", null);

    @Test
    void contentStateKeepsEveryKeyIncludingNulls() {
        Map<String, Object> m = LiveActivitySender.contentState(STATE);
        assertEquals(10, m.size());
        assertTrue(m.containsKey("turnSeat") && m.get("turnSeat") == null);
        assertTrue(m.containsKey("winner") && m.get("winner") == null);
    }

    @Test
    void androidDataIsTypedAndCarriesTheStateAsJson() {
        Map<String, String> data = LiveActivitySender.androidData("update", "{\"roomId\":\"r-1\"}");
        assertEquals(Map.of("type", "bela_live_update", "event", "update", "state", "{\"roomId\":\"r-1\"}"), data);
    }

    @Test
    void apsHasDismissalDateOnlyOnEnd() {
        Instant now = Instant.ofEpochSecond(1_000_000);
        Map<String, Object> update = LiveActivitySender.apsFields("update", Map.of(), now);
        assertEquals(1_000_000L, update.get("timestamp"));
        assertFalse(update.containsKey("dismissal-date"));

        Map<String, Object> end = LiveActivitySender.apsFields("end", Map.of(), now);
        assertEquals(1_000_000L + 15 * 60, end.get("dismissal-date"));
    }

    @Test
    void thePinnedFirebaseAdminCanAddressALiveActivity() {
        // ApnsConfig.Builder#setLiveActivityToken arrived in firebase-admin
        // 9.10.0, which is what pom.xml pins since 2026-09-13. The sender looks
        // it up by reflection, so if a future downgrade drops it the iOS branch
        // silently turns into a WARN no-op — this test is what catches that.
        assertTrue(LiveActivitySender.iosSupported());
    }
}
