package hr.mrodek.apps.bela_turniri.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Wire shape for a pair-finding request, including a small embedded tournament summary. */
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
public class PairRequestDto {
    private UUID uuid;
    private UUID tournamentUuid;
    private String tournamentName;
    private String tournamentLocation;
    private OffsetDateTime tournamentStartAt;
    private String playerName;
    private String phone;
    private String note;
    private String status;       // OPEN | MATCHED
    private OffsetDateTime createdAt;
    /** Firebase UID of the original poster (used to gate match/delete). */
    private String createdByUid;
}
