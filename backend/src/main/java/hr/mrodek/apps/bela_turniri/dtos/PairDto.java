package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PairDto(
        Integer id,

        @NotBlank(message = "pair name is required")
        @Size(max = 200, message = "pair name must be at most 200 characters")
        String name,

        Boolean isEliminated,
        Boolean extraLife,

        @Min(value = 0, message = "wins cannot be negative")
        Integer wins,

        @Min(value = 0, message = "losses cannot be negative")
        Integer losses,

        Boolean paid,

        String submittedByUid,
        Boolean pendingApproval,

        // Display info about the submitter — populated from UserProfile when
        // the controller enriches via PairMapper.toDtoListEnriched. Null when
        // the pair was added by an organizer (no submittedByUid).
        String submittedBySlug,
        String submittedByName,

        // Co-owner who claimed the pair via the share link. Same enrichment
        // approach: UID is the source-of-truth column, slug + display name
        // are looked up from UserProfile per request.
        String coSubmittedByUid,
        String coSubmittedBySlug,
        String coSubmittedByName,

        // Opaque token that goes in the /claim-pair/{token} URL. Only sent
        // to the primary submitter and to organizers/admins — viewers who
        // shouldn't see the share link get null here.
        String claimToken
) {
    /** Backwards-compat constructor for callers that don't yet enrich submitter info. */
    public PairDto(
            Integer id, String name, Boolean isEliminated, Boolean extraLife,
            Integer wins, Integer losses, Boolean paid,
            String submittedByUid, Boolean pendingApproval
    ) {
        this(id, name, isEliminated, extraLife, wins, losses, paid,
                submittedByUid, pendingApproval, null, null,
                null, null, null, null);
    }

    /** Earlier 11-arg constructor (no co-owner / token fields). */
    public PairDto(
            Integer id, String name, Boolean isEliminated, Boolean extraLife,
            Integer wins, Integer losses, Boolean paid,
            String submittedByUid, Boolean pendingApproval,
            String submittedBySlug, String submittedByName
    ) {
        this(id, name, isEliminated, extraLife, wins, losses, paid,
                submittedByUid, pendingApproval, submittedBySlug, submittedByName,
                null, null, null, null);
    }
}
