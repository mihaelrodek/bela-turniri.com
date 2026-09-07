package hr.mrodek.apps.bela_turniri.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * One submission of the public contact form (/kontakt).
 *
 * <p>The row is the durable copy: the notification e-mail is best-effort (see
 * {@code EmailService}), so if Resend is down, misconfigured, or the mailbox
 * filters us, the message is still here. That is the whole reason this table
 * exists rather than the form being a pure mail relay.
 *
 * <p>No status enum — the reply happens off-platform, by e-mail — only a
 * single {@code handled} flag an admin toggles once they have answered.
 */
@Entity
@Table(name = "contact_messages")
@Getter @Setter @NoArgsConstructor
public class ContactMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 200)
    private String email;

    /** Optional — the form lets the sender skip it, so many rows are null. */
    @Column(length = 200)
    private String subject;

    @Column(nullable = false, length = 4000)
    private String message;

    /**
     * Firebase uid of the sender when they happened to be signed in while
     * submitting, otherwise null. INFORMATIONAL ONLY — the form is fully
     * public and nothing about the message is authorised against this.
     */
    @Column(name = "user_uid", length = 128)
    private String userUid;

    /**
     * First hop of {@code X-Forwarded-For} as Caddy saw it, or null in local
     * dev where requests reach Quarkus directly. Kept for abuse triage only —
     * the per-IP submit throttle lives in memory, not here.
     */
    @Column(length = 64)
    private String ip;

    /**
     * Language the sender was using ({@code X-Locale}); lets a reply be
     * written in the language they wrote in.
     */
    @Column(length = 5)
    private String locale;

    /** Set by an admin once the message has been answered. */
    @Column(nullable = false)
    private boolean handled = false;
}
