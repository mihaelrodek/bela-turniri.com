package hr.mrodek.apps.bela_turniri.dtos;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
public class TournamentCardDto {
    private Long id;                 // numeric PK
    private UUID uuid;               // public id
    /** Pretty URL slug (may be null for legacy rows pre-backfill). */
    private String slug;
    private String name;
    private String location;
    private Double latitude;
    private Double longitude;
    private String bannerUrl;
    private OffsetDateTime startAt;
    private Integer maxPairs;
    private BigDecimal entryPrice;
    private BigDecimal repassagePrice;
    private String winnerName;
    private Integer registeredPairs;
    /** DRAFT / STARTED / FINISHED (enum name) — lets a client tell a LIVE tournament from an upcoming one without a second fetch (the blok's "uživo" link button, 2026-10-03). Auto-mapped by name from Tournaments#status. */
    private String status;

    // Game rules — added 2026-09-22 so the listing card/row can show a
    // compact rules line without a second fetch. Same fields as
    // TournamentDetailsResponse; MapStruct auto-maps them by name from
    // Tournaments since no explicit @Mapping entry is needed.
    private Integer targetScore;
    private String gameEndRule;
    private String dealDirection;
    private Boolean declarationsEnabled;
    private Boolean allowBela;
}
