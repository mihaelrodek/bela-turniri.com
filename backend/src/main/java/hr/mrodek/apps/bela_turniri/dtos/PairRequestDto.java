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
    /** Pretty URL slug for tournament-detail links; null on legacy rows. */
    private String tournamentSlug;
    private String tournamentName;
    private String tournamentLocation;
    private OffsetDateTime tournamentStartAt;
    private String playerName;
    private String phone;
    /**
     * Whether the poster left a phone number at all — stamped BEFORE
     * {@code phone} is nulled for anonymous callers, so a signed-out visitor
     * can be told "there is a number, sign in to see it" instead of the UI
     * having to guess. Without this the redacted payload is indistinguishable
     * from a request that simply has no number.
     */
    private boolean hasPhone;
    private String note;
    private String status;       // OPEN | MATCHED
    private OffsetDateTime createdAt;
    /** Firebase UID of the original poster (used to gate match/delete). */
    private String createdByUid;
}
