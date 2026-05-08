package hr.mrodek.apps.bela_turniri.dtos;


import hr.mrodek.apps.bela_turniri.enums.RepassageUntil;
import hr.mrodek.apps.bela_turniri.enums.RewardType;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Simple read DTO returned by the mocked /api/tournaments endpoint.
 * (We’ll add create/update DTOs and real mapping when we hook up the DB.)
 */
public record TournamentResponse(
        UUID id,
        String name,
        String location,
        String details,
        OffsetDateTime startAt,
        String bannerUrl,
        Double repasage,
        Double repasage2,
        RepassageUntil repasageUntil,
        String contactName,
        String contactPhone,
        RewardType rewardType,
        Double rewardFirst,
        Double rewardSecond,
        Double rewardThird
) {}