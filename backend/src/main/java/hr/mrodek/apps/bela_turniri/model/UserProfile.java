package hr.mrodek.apps.bela_turniri.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "user_profiles")
@Getter @Setter @NoArgsConstructor
public class UserProfile {

    /** Firebase UID, used as the primary key — one row per user. */
    @Id
    @Column(name = "user_uid", length = 64)
    private String userUid;

    @Column(name = "phone_country", length = 8)
    private String phoneCountry;

    @Column(name = "phone", length = 50)
    private String phone;

    /** Mirrored from Firebase on every /user/me/sync — used to label public profiles. */
    @Column(name = "display_name", length = 200)
    private String displayName;

    /**
     * Public, URL-safe handle used at /profile/{slug}. Derived from displayName
     * with auto-numbered collision (-2, -3) and made unique by an index.
     */
    @Column(name = "slug", length = 200)
    private String slug;

    /**
     * Optional profile picture. Lazy because most callers don't need the
     * Resources row's bytes/metadata; the SPA only needs the proxied URL,
     * which is computed from the resource id alone.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "avatar_resource_id")
    private Resources avatar;

    /**
     * The drawn character this user picked instead of uploading a photo — the
     * id of one of {@code AvatarPresetService.PRESETS}, or null when they
     * never had one (or explicitly cleared it).
     *
     * <p>The drawings themselves are frontend code
     * ({@code frontend/src/components/avatars/avatarArt.ts}); this column
     * holds nothing but the id. Written by
     * {@code PUT /user/me/profile}, assigned to brand-new profiles by
     * {@code AvatarPresetService.assignDefaultIfMissing}, and CLEARED when a
     * real photo is uploaded.
     *
     * <p>Precedence between this and {@link #avatar} is decided in exactly one
     * place — {@code AvatarPresetService.presetFor} — never re-derived at a
     * DTO site.
     */
    @Column(name = "avatar_preset", length = 32)
    private String avatarPreset;

    /**
     * Per-user theme preference — "light" or "dark". Null means the
     * user hasn't picked one yet; the frontend defaults to light. We
     * sync this on login so the choice survives across devices.
     */
    @Column(name = "color_mode", length = 10)
    private String colorMode;

    /**
     * Per-user language preference — a BCP-47 base tag ("hr", "sl", "en"). Null
     * means the user hasn't picked one; the frontend then falls back to the
     * browser language and finally to Croatian.
     *
     * <p>Also the locale to compose PUSH NOTIFICATIONS and e-mails for this
     * user in: those are built while handling somebody else's request (the
     * organiser draws a round, every player gets notified), so the request
     * locale is the wrong one. Use
     * {@code MessageService.t(messages.localeOf(profile.getLocale()), key, ...)}.
     */
    @Column(name = "locale", length = 5)
    private String locale;

    /**
     * LEGACY (2026-09-21) — no longer the source of truth and no longer read
     * or written by anything. Karma is now DERIVED on every read as
     * {@code 10 − abandons in the last 30 days} from
     * {@code game_reliability_events} (see {@code GameReliabilityService}), so
     * a stored score could only ever be stale: nothing fires when an event
     * ages out of the window, so "keeping it in sync" would be a lie told at
     * write time. The column stays (NOT NULL, CHECK 0..10, default 10) because
     * dropping it buys nothing and an applied changeset is cheaper left alone.
     */
    @Column(name = "game_karma", nullable = false)
    private int gameKarma = 10;

    /**
     * Number of confirmed mid-game abandonments, never reset automatically.
     * Still written on every abandonment and still shown — it is the LIFETIME
     * figure beside the 30-day one, not an input to karma.
     */
    @Column(name = "game_abandons", nullable = false)
    private long gameAbandons = 0;

    /**
     * LEGACY (2026-09-21) — dead with the recovery rule it served. Finishing
     * games no longer earns karma back (time does), so nothing counts towards
     * anything any more. Kept, like {@link #gameKarma}, only because removing
     * a column is a migration nobody needs.
     */
    @Column(name = "game_completed_since_recovery", nullable = false)
    private int gameCompletedSinceRecovery = 0;

    /**
     * When this account was deleted by its owner, or null for a live account.
     *
     * <p>Deletion here is ANONYMISATION, not erasure: the row and its
     * {@link #slug} survive so that old links 404 cleanly instead of the slug
     * being re-issued to the next person whose name normalises to it, while
     * every personal field above is cleared. See
     * {@code AccountDeletionService} for the full per-table checklist and
     * {@code db/changelog/account_deletion.xml} for why it works this way.
     *
     * <p>Three behaviours hang off this single column:
     * <ul>
     *   <li>{@code GET /public/users/{slug}} 404s;</li>
     *   <li>{@code POST /user/me/sync} refuses with 410 {@code ACCOUNT_DELETED}
     *       instead of lazily re-creating a profile;</li>
     *   <li>anywhere this uid's name would be rendered, the i18n string
     *       {@code profile.deletedUser} is rendered instead
     *       ({@code DisplayNames}).</li>
     * </ul>
     */
    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    /** Convenience for the many call sites that only care about the boolean. */
    public boolean isDeleted() {
        return deletedAt != null;
    }

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
