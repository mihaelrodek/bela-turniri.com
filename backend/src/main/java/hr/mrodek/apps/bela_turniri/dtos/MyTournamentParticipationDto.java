package hr.mrodek.apps.bela_turniri.dtos;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One row per (user, tournament) pair the user has self-registered.
 * Carries the bare-minimum tournament metadata so the profile page can
 * render a card without a second roundtrip per item.
 */
public record MyTournamentParticipationDto(
        UUID tournamentUuid,
        String tournamentName,
        String tournamentLocation,
        OffsetDateTime tournamentStartAt,
        String tournamentStatus,   // DRAFT | STARTED | FINISHED
        String winnerName,

        Long pairId,
        String pairName,
        boolean pendingApproval,
        boolean eliminated,
        boolean extraLife,
        int wins,
        int losses,
        boolean isWinner
) {}
