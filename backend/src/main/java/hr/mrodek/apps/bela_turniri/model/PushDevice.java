package hr.mrodek.apps.bela_turniri.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * One native push registration — the FCM counterpart of
 * {@link PushSubscription}, used by the iOS/Android shells.
 *
 * <p>Uniquely identified by the FCM registration {@code token}, the opaque
 * string Google routes on. One Firebase UID can own many rows (phone +
 * tablet), and one token belongs to exactly one user at a time: the same
 * phone signed into a second account must stop delivering to the first, so
 * re-registering a known token REASSIGNS the row instead of creating another.
 *
 * <p>Unlike a Web Push subscription there is no per-device crypto material:
 * FCM terminates the encryption itself, and the token is the whole secret.
 * Treat it like a bearer token — never log it, log the id or a prefix.
 */
@Entity
@Table(name = "push_devices")
@Getter @Setter @NoArgsConstructor
public class PushDevice {

    /** {@code ios} — the value the iOS shell registers with. */
    public static final String PLATFORM_IOS = "ios";

    /** {@code android} — the value the Android shell registers with. */
    public static final String PLATFORM_ANDROID = "android";

    @Id
    @SequenceGenerator(name = "push_devices_seq", sequenceName = "push_devices_id_seq", allocationSize = 1)
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_uid", nullable = false, length = 128)
    private String userUid;

    /** {@link #PLATFORM_IOS} or {@link #PLATFORM_ANDROID}; validated at the edge. */
    @Column(nullable = false, length = 16)
    private String platform;

    @Column(nullable = false, columnDefinition = "text", unique = true)
    private String token;

    /**
     * The device's own language, as a fallback hint only. The sender still
     * prefers the user's stored {@code UserProfile.locale} — that is the
     * language the user picked, whereas this is the one their phone happens
     * to be set to.
     */
    @Column(length = 8)
    private String locale;

    /** Shell build that registered, for diagnosing "only version 1.2 misses pushes". */
    @Column(name = "app_version", length = 32)
    private String appVersion;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    /**
     * Bumped on every re-registration (the app registers on each cold start)
     * and on every successful send, so a device that has gone quiet can be
     * pruned without waiting for FCM to report the token dead.
     */
    @Column(name = "last_seen_at", nullable = false)
    private OffsetDateTime lastSeenAt = OffsetDateTime.now();
}
