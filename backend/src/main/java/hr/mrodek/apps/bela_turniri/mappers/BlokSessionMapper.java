package hr.mrodek.apps.bela_turniri.mappers;

import hr.mrodek.apps.bela_turniri.dtos.BlokGameDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokNamesDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokSessionDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokSessionSummaryDto;
import hr.mrodek.apps.bela_turniri.model.BlokSession;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Mappings;
import org.mapstruct.ReportingPolicy;

import java.util.List;

/**
 * {@link BlokSession} → the two wire shapes of {@code BLOK-HISTORY.md} §3.2.
 *
 * <p>The games are passed in rather than read off the entity: {@code payload}
 * is stored as raw JSON text (see {@link BlokSession}) and parsing it needs an
 * {@code ObjectMapper}, which belongs in the service, not in a mapper. That
 * also keeps the one dangerous mistake impossible to make — a mapper that
 * silently dereferenced {@code payload} would have quietly reintroduced it
 * into the listing.
 *
 * <p>The listing itself does not come through here at all: it is a JPQL
 * constructor projection in {@code BlokSessionRepository.findSummaries}, so
 * the jsonb column is never selected. {@link #toSummary(BlokSession)} exists
 * for the single-entity case (an upload's own echo) and is the only place the
 * summary is built from a loaded row.
 */
@Mapper(componentModel = "cdi", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface BlokSessionMapper {

    /**
     * The full record. {@code games} comes from the caller because it lives in
     * the jsonb payload, not in a column.
     */
    @Mappings({
            @Mapping(target = "uuid", source = "s.uuid"),
            @Mapping(target = "sessionId", source = "s.sessionId"),
            @Mapping(target = "startedAt", source = "s.startedAt"),
            @Mapping(target = "finishedAt", source = "s.finishedAt"),
            @Mapping(target = "target", source = "s.target"),
            @Mapping(target = "gameEndRule", source = "s.gameEndRule"),
            @Mapping(target = "names", expression = "java(names(s))"),
            @Mapping(target = "gamesUs", source = "s.gamesUs"),
            @Mapping(target = "gamesThem", source = "s.gamesThem"),
            @Mapping(target = "gamesCount", source = "s.gamesCount"),
            @Mapping(target = "createdAt", source = "s.createdAt"),
            @Mapping(target = "games", source = "games"),
    })
    BlokSessionDto toDto(BlokSession s, List<BlokGameDto> games);

    /** Same shape minus the games — identical to what the listing projects. */
    @Mapping(target = "names", expression = "java(names(s))")
    BlokSessionSummaryDto toSummary(BlokSession s);

    /**
     * The two name columns as the nested {@code names} object the wire uses.
     * NULL becomes {@code ""} — both mean "render the translated MI / VI", and
     * emitting exactly one of them saves every client from handling both.
     */
    default BlokNamesDto names(BlokSession s) {
        return s == null ? BlokNamesDto.of(null, null)
                : BlokNamesDto.of(s.getNameUs(), s.getNameThem());
    }
}
