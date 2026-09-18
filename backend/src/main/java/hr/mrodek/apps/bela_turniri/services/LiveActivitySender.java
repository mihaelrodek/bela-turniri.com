package hr.mrodek.apps.bela_turniri.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.ApnsConfig;
import com.google.firebase.messaging.Aps;
import com.google.firebase.messaging.Message;
import hr.mrodek.apps.bela_turniri.dtos.LiveActivityRequest;
import hr.mrodek.apps.bela_turniri.model.PushDevice;
import hr.mrodek.apps.bela_turniri.repository.PushDeviceRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.lang.reflect.Method;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Delivers one Live Activity event (game/README.md §3 "Live Activity") to the
 * recipient's installed apps through {@link FcmSender}.
 *
 * <h2>Android</h2>
 * An FCM DATA message — deliberately no {@code notification} block, because
 * the app's own messaging service renders the ongoing Live Update and a
 * system-drawn banner every second would be exactly wrong. Priority HIGH so
 * Doze does not batch it past the turn it describes. Sent to every
 * {@code platform = android} row of the uid in {@code push_devices}.
 *
 * <h2>iOS</h2>
 * FCM HTTP v1 relays Live Activity pushes when the APNs block carries
 * {@code live_activity_token}. The Java SDK only exposes that as
 * {@code ApnsConfig.Builder#setLiveActivityToken}, which is NOT in the pinned
 * firebase-admin 9.4.3 (it appears in later releases — 9.10.0 has it). The
 * method is therefore looked up reflectively once: absent, the iOS branch
 * logs one WARN and does nothing; after a dependency bump it starts working
 * with no code change. A raw APNs HTTP/2 client is intentionally not
 * hand-rolled here. Push-to-start is skipped entirely — no firebase-admin
 * release exposes a push-to-start field.
 *
 * <h2>Threading</h2>
 * Device rows are read on the request thread (the sender pool has no
 * persistence context); every FCM round-trip runs on a small daemon pool, so
 * {@link #dispatch} returns in milliseconds and never throws. FCM disabled →
 * nothing is read or queued at all.
 */
@ApplicationScoped
public class LiveActivitySender {

    private static final Logger LOG = Logger.getLogger(LiveActivitySender.class);

    /** FCM data {@code type} the Android app's messaging service switches on. */
    public static final String ANDROID_DATA_TYPE = "bela_live_update";

    /** How long iOS keeps an ended activity on the lock screen. */
    private static final long DISMISSAL_AFTER_SECONDS = 15 * 60;

    private static final int SENDER_THREADS = 2;

    /** {@code ApnsConfig.Builder#setLiveActivityToken}, or null on SDKs that predate it. */
    private static final Method SET_LIVE_ACTIVITY_TOKEN = findLiveActivitySetter();

    @Inject PushDeviceRepository deviceRepo;
    @Inject FcmSender fcm;
    @Inject PushDeviceCleaner deviceCleaner;
    @Inject ObjectMapper objectMapper;

    private final AtomicBoolean warnedNoIosSupport = new AtomicBoolean();
    private final AtomicBoolean warnedNoPushToStart = new AtomicBoolean();
    private ExecutorService senders;

    record DeviceTarget(Long id, String token, String platform) {}

    @PostConstruct
    void initExecutor() {
        AtomicInteger seq = new AtomicInteger(1);
        this.senders = Executors.newFixedThreadPool(SENDER_THREADS, r -> {
            Thread t = new Thread(r, "live-activity-sender-" + seq.getAndIncrement());
            t.setDaemon(true);
            return t;
        });
    }

    @PreDestroy
    void shutdownExecutor() {
        if (senders != null) senders.shutdownNow();
    }

    /** Queue delivery and return. Never throws. */
    public void dispatch(LiveActivityRequest req) {
        if (req == null || !fcm.isEnabled()) return;
        try {
            List<DeviceTarget> devices = deviceRepo.findByUserUid(req.uid()).stream()
                    .map(d -> new DeviceTarget(d.getId(), d.getToken(), d.getPlatform()))
                    .toList();
            if (devices.isEmpty()) return;

            Map<String, Object> contentState = contentState(req.state());
            String stateJson = objectMapper.writeValueAsString(contentState);
            senders.submit(() -> deliver(req, devices, contentState, stateJson));
        } catch (Exception e) {
            LOG.warnf(e, "LiveActivity: could not queue %s for uid %s", req.event(), req.uid());
        }
    }

    private void deliver(LiveActivityRequest req, List<DeviceTarget> devices,
                         Map<String, Object> contentState, String stateJson) {
        for (DeviceTarget d : devices) {
            if (PushDevice.PLATFORM_ANDROID.equals(d.platform())) {
                sendAndClean(req.uid(), d, androidMessage(d.token(), req.event(), stateJson));
            }
        }

        if (req.iosPushToStartToken() != null && warnedNoPushToStart.compareAndSet(false, true)) {
            LOG.warn("LiveActivity: iosPushToStartToken received but firebase-admin has no "
                    + "push-to-start support — skipped (logged once).");
        }
        if (req.iosActivityToken() == null) return;
        if (SET_LIVE_ACTIVITY_TOKEN == null) {
            if (warnedNoIosSupport.compareAndSet(false, true)) {
                LOG.warn("LiveActivity: firebase-admin on the classpath lacks "
                        + "ApnsConfig.Builder#setLiveActivityToken — iOS Live Activity pushes are "
                        + "disabled until the dependency is upgraded (logged once).");
            }
            return;
        }
        for (DeviceTarget d : devices) {
            if (!PushDevice.PLATFORM_IOS.equals(d.platform())) continue;
            try {
                sendAndClean(req.uid(), d, iosMessage(d.token(), req.iosActivityToken(), req.event(), contentState));
            } catch (Exception e) {
                LOG.warnf(e, "LiveActivity: could not build iOS message for device %d", d.id());
            }
        }
    }

    /**
     * A dead token is deleted exactly like {@link PushService} does. A
     * successful send does NOT stamp {@code lastSeenAt}: these arrive up to
     * once a second per player, and a write per push would be pure load for a
     * timestamp the regular notifications already keep fresh.
     */
    private void sendAndClean(String uid, DeviceTarget device, Message message) {
        try {
            FcmSender.Result result = fcm.sendMessage(device.token(), device.platform(), message);
            if (result == FcmSender.Result.DEAD_TOKEN) {
                LOG.infof("LiveActivity: dropping dead device %d (platform %s)", device.id(), device.platform());
                deviceCleaner.deleteById(device.id());
            }
        } catch (Exception e) {
            LOG.warnf(e, "LiveActivity: send failed for uid %s (device %d)", uid, device.id());
        }
    }

    /* ===================== message shapes ===================== */

    /**
     * The ContentState as a map that keeps every key, nulls included — the
     * contract says all fields are always present, and the widget decoders
     * treat a missing key as a malformed payload.
     */
    static Map<String, Object> contentState(LiveActivityRequest.State s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("roomId", s.roomId());
        m.put("phase", s.phase());
        m.put("scoreUs", s.scoreUs());
        m.put("scoreThem", s.scoreThem());
        m.put("target", s.target());
        m.put("yourTurn", s.yourTurn());
        m.put("turnSeat", s.turnSeat());
        m.put("turnDeadline", s.turnDeadline());
        m.put("trump", s.trump());
        m.put("winner", s.winner());
        return m;
    }

    /** FCM data values must be strings, so the state travels as one JSON string. */
    static Map<String, String> androidData(String event, String stateJson) {
        Map<String, String> data = new LinkedHashMap<>();
        data.put("type", ANDROID_DATA_TYPE);
        data.put("event", event);
        data.put("state", stateJson);
        return data;
    }

    static Message androidMessage(String token, String event, String stateJson) {
        return Message.builder()
                .setToken(token)
                .putAllData(androidData(event, stateJson))
                .setAndroidConfig(AndroidConfig.builder()
                        .setPriority(AndroidConfig.Priority.HIGH)
                        .build())
                .build();
    }

    /** The {@code aps} dictionary ActivityKit expects for a remote update/end. */
    static Map<String, Object> apsFields(String event, Map<String, Object> contentState, Instant now) {
        Map<String, Object> aps = new LinkedHashMap<>();
        aps.put("timestamp", now.getEpochSecond());
        aps.put("event", event);
        aps.put("content-state", contentState);
        if ("end".equals(event)) {
            aps.put("dismissal-date", now.getEpochSecond() + DISMISSAL_AFTER_SECONDS);
        }
        return aps;
    }

    private static Message iosMessage(String fcmToken, String activityToken, String event,
                                      Map<String, Object> contentState) throws Exception {
        ApnsConfig.Builder apns = ApnsConfig.builder()
                // Live Activity updates are user-visible and time-bound.
                .putHeader("apns-priority", "10")
                .setAps(Aps.builder()
                        .putAllCustomData(apsFields(event, contentState, Instant.now()))
                        .build());
        SET_LIVE_ACTIVITY_TOKEN.invoke(apns, activityToken);
        return Message.builder()
                .setToken(fcmToken)
                .setApnsConfig(apns.build())
                .build();
    }

    private static Method findLiveActivitySetter() {
        try {
            return ApnsConfig.Builder.class.getMethod("setLiveActivityToken", String.class);
        } catch (NoSuchMethodException e) {
            return null;
        }
    }

    /** Whether this build's firebase-admin can address a Live Activity at all. */
    static boolean iosSupported() {
        return SET_LIVE_ACTIVITY_TOKEN != null;
    }
}
