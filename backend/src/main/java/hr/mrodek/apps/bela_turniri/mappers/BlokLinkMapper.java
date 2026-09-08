package hr.mrodek.apps.bela_turniri.mappers;

import hr.mrodek.apps.bela_turniri.dtos.BlokLinkDto;
import hr.mrodek.apps.bela_turniri.model.MatchScoreLink;
import hr.mrodek.apps.bela_turniri.model.Matches;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Mappings;
import org.mapstruct.ReportingPolicy;

import java.util.Objects;

/**
 * {@link MatchScoreLink} → {@link BlokLinkDto}.
 *
 * <p>Call inside the request transaction: the entity's associations are LAZY,
 * and the repository's listing queries join-fetch them precisely so this
 * mapper does not fire a query per row.
 *
 * <p><b>{@code shareToken} is a second parameter rather than a mapped
 * property</b> ({@code BLOK-LINK.md} §6.2). It does not live on the link — it
 * is {@code blok_sessions.share_token} for the series named by
 * {@code (requestedByUid, sessionId)} — and resolving it means a query the
 * caller batches. Passing it in keeps that decision (and the consent check
 * behind it) in {@code BlokLinkService}, which is the only place that knows
 * whether the caller may see a token at all; a mapper that fetched it itself
 * could not make that judgement and would fire one query per row.
 *
 * <p>There is no list variant here for the same reason: the service maps the
 * list, because only it holds the batched token lookup.
 */
@Mapper(componentModel = "cdi", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface BlokLinkMapper {

    @Mappings({
            @Mapping(target = "uuid", source = "l.uuid"),
            @Mapping(target = "status", expression = "java(l.getStatus() == null ? null : l.getStatus().name())"),
            @Mapping(target = "tournamentUuid", source = "l.tournament.uuid"),
            @Mapping(target = "tournamentSlug", source = "l.tournament.slug"),
            @Mapping(target = "tournamentName", source = "l.tournament.name"),
            @Mapping(target = "roundId", source = "l.match.round.id"),
            @Mapping(target = "roundNumber", source = "l.match.round.number"),
            @Mapping(target = "tableNo", source = "l.match.tableNo"),
            @Mapping(target = "matchId", source = "l.match.id"),
            @Mapping(target = "usPairId", source = "l.usPair.id"),
            @Mapping(target = "usPairName", source = "l.usPair.name"),
            @Mapping(target = "themPairId", expression = "java(themPairId(l))"),
            @Mapping(target = "themPairName", expression = "java(themPairName(l))"),
            @Mapping(target = "requestedByUid", source = "l.requestedByUid"),
            @Mapping(target = "requestedByName", source = "l.requestedByName"),
            @Mapping(target = "sessionId", source = "l.sessionId"),
            @Mapping(target = "shareToken", source = "shareToken"),
            @Mapping(target = "createdAt", source = "l.createdAt"),
            @Mapping(target = "decidedAt", source = "l.decidedAt"),
            @Mapping(target = "decidedByUid", source = "l.decidedByUid"),
    })
    BlokLinkDto toDto(MatchScoreLink l, String shareToken);

    /**
     * The side that is not "us". Derived rather than stored: the match already
     * knows both pairs, and a second column would be one more thing that could
     * drift out of step with {@code us_pair_id}.
     *
     * <p>Defensive about nulls throughout — a BYE match can never be linked,
     * but a pair row deleted out from under a historical (rejected/revoked)
     * link must still render.
     */
    default Pairs themPair(MatchScoreLink l) {
        if (l == null || l.getMatch() == null || l.getUsPair() == null) return null;
        Matches m = l.getMatch();
        Long usId = l.getUsPair().getId();
        if (m.getPair1() != null && !Objects.equals(m.getPair1().getId(), usId)) return m.getPair1();
        if (m.getPair2() != null && !Objects.equals(m.getPair2().getId(), usId)) return m.getPair2();
        return null;
    }

    default Long themPairId(MatchScoreLink l) {
        Pairs p = themPair(l);
        return p == null ? null : p.getId();
    }

    default String themPairName(MatchScoreLink l) {
        Pairs p = themPair(l);
        return p == null ? null : p.getName();
    }
}
