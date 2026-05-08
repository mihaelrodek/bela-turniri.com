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
}
