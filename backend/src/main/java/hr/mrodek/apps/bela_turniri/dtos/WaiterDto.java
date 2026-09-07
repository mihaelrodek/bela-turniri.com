package hr.mrodek.apps.bela_turniri.dtos;

import java.time.OffsetDateTime;

/**
 * One named waiter credential, as shown to the organiser in the waiter
 * list. The code travels here too — unlike a player, a waiter has no
 * account to keep it out of, and the organiser is meant to read it out or
 * copy it straight from this row.
 */
public record WaiterDto(
        Long id,
        String name,
        String code,
        OffsetDateTime createdAt,
        /** "Gazda konobara" — this credential can also replace the price list. */
        boolean canEditCjenik
) {}
