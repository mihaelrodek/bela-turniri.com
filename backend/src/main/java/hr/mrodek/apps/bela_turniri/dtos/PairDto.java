package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PairDto(
        Integer id,

        // `message` is an i18n bundle key (i18n/messages_*.properties), resolved
        // into the caller's language by errors/ConstraintViolationExceptionMapper.
        @NotBlank(message = "validation.pair.name.required")
        @Size(max = 200, message = "validation.pair.name.max")
        String name,

        Boolean isEliminated,
        Boolean extraLife,

        @Min(value = 0, message = "validation.pair.wins.negative")
        Integer wins,

        @Min(value = 0, message = "validation.pair.losses.negative")
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
        String claimToken,

        // Phone of a pair that registered without an account. ORGANISER-ONLY:
        // emitted solely when the viewer passes TournamentAccess.canManage,
        // never in the public pair list — it is the one piece of PII a pair row
        // can carry, and the list endpoint is anonymous-readable.
        String contactPhone,

        // Absolute /preuzmi-par/{token} URL, returned ONLY in the response to an
        // anonymous self-registration so the submitter can keep the link and
        // later attach the pair to an account. Never set in list responses.
        String claimUrl
) {
    /** Backwards-compat constructor for callers that don't yet enrich submitter info. */
    public PairDto(
            Integer id, String name, Boolean isEliminated, Boolean extraLife,
            Integer wins, Integer losses, Boolean paid,
            String submittedByUid, Boolean pendingApproval
    ) {
        this(id, name, isEliminated, extraLife, wins, losses, paid,
                submittedByUid, pendingApproval, null, null,
                null, null, null, null, null, null);
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
                null, null, null, null, null, null);
    }

    /** The 15-arg shape that predates contactPhone / claimUrl. */
    public PairDto(
            Integer id, String name, Boolean isEliminated, Boolean extraLife,
            Integer wins, Integer losses, Boolean paid,
            String submittedByUid, Boolean pendingApproval,
            String submittedBySlug, String submittedByName,
            String coSubmittedByUid, String coSubmittedBySlug, String coSubmittedByName,
            String claimToken
    ) {
        this(id, name, isEliminated, extraLife, wins, losses, paid,
                submittedByUid, pendingApproval, submittedBySlug, submittedByName,
                coSubmittedByUid, coSubmittedBySlug, coSubmittedByName, claimToken,
                null, null);
    }

    /** Same row plus the absolute claim URL — the anonymous self-register reply. */
    public PairDto withClaimUrl(String claimUrl) {
        return new PairDto(id, name, isEliminated, extraLife, wins, losses, paid,
                submittedByUid, pendingApproval, submittedBySlug, submittedByName,
                coSubmittedByUid, coSubmittedBySlug, coSubmittedByName, claimToken,
                contactPhone, claimUrl);
    }
}
