package hr.mrodek.apps.bela_turniri.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * A row in the per-user saved cjenik template. Owner saves a tournament's
 * cjenik to their template, and on a new tournament can "import template"
 * to seed the cjenik. Stored as flat rows keyed by Firebase UID — there's
 * exactly one template per user.
 */
@Entity
@Table(name = "user_drink_templates")
@Getter @Setter @NoArgsConstructor
public class UserDrinkTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_uid", nullable = false, length = 64)
    private String userUid;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
