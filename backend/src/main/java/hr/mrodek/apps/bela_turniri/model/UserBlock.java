package hr.mrodek.apps.bela_turniri.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.time.OffsetDateTime;

/**
 * "{@code blocker} does not want to see {@code blocked}" — App Store
 * guideline 1.2's other half, next to {@link ContentReport}.
 *
 * <p>The pair IS the primary key, so blocking someone twice writes the same
 * row twice and therefore once. That is also what makes the enforcement
 * queries cheap: the forward direction rides the PK, the reverse one the
 * index on {@code blocked_uid}.
 *
 * <p>Enforcement is entirely server-side (see {@code UserBlockService}) so it
 * holds for the SPA, the native shells and anything else that ever talks to
 * this API — a client-side filter would be one fetch away from being nothing
 * at all.
 */
@Entity
@Table(name = "user_blocks")
@IdClass(UserBlock.Key.class)
@Getter @Setter @NoArgsConstructor
public class UserBlock {

    @Id
    @Column(name = "blocker_uid", length = 128, nullable = false)
    private String blockerUid;

    @Id
    @Column(name = "blocked_uid", length = 128, nullable = false)
    private String blockedUid;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public UserBlock(String blockerUid, String blockedUid) {
        this.blockerUid = blockerUid;
        this.blockedUid = blockedUid;
    }

    /** Composite id — required by JPA, carries no behaviour of its own. */
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
    public static class Key implements Serializable {
        private String blockerUid;
        private String blockedUid;
    }
}
