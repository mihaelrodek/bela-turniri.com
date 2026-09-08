package hr.mrodek.apps.bela_turniri.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import hr.mrodek.apps.bela_turniri.dtos.BlokDeclarationsDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokGameDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokLinkCreatedDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokLinkDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokLinkScoreRequest;
import hr.mrodek.apps.bela_turniri.dtos.BlokLinkSuggestionDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokNamesDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokRoundDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokScoresDto;
import hr.mrodek.apps.bela_turniri.dtos.BlokSessionDto;
import hr.mrodek.apps.bela_turniri.dtos.CreateBlokLinkRequest;
import hr.mrodek.apps.bela_turniri.dtos.SaveBlokSessionRequest;
import hr.mrodek.apps.bela_turniri.enums.MatchScoreLinkStatus;
import hr.mrodek.apps.bela_turniri.enums.MatchStatus;
import hr.mrodek.apps.bela_turniri.enums.RoundStatus;
import hr.mrodek.apps.bela_turniri.enums.TournamentStatus;
import hr.mrodek.apps.bela_turniri.model.MatchScoreLink;
import hr.mrodek.apps.bela_turniri.model.Matches;
import hr.mrodek.apps.bela_turniri.model.Pairs;
import hr.mrodek.apps.bela_turniri.model.Rounds;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.services.BlokHistoryService;
import hr.mrodek.apps.bela_turniri.services.BlokLinkService;
import hr.mrodek.apps.bela_turniri.services.CurrentUser;
import io.quarkus.test.TestTransaction;
import io.quarkus.test.junit.QuarkusMock;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.NotAuthorizedException;
import jakarta.ws.rs.WebApplicationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Coverage for "Poveži blok sa stolom" ({@code BLOK-LINK.md} §2, as revised by
 * §6, §7 and §8).
 *
 * <p>What is worth testing here, and why:
 *
 * <ol>
 *   <li>the Liquibase changesets applied — including the partial unique index,
 *       which is raw SQL and therefore the part most likely to be silently
 *       wrong, §6.2's {@code session_id} column and §7.1's
 *       {@code write_token};</li>
 *   <li>where the auth line now runs: §7 opened four endpoints to anonymous
 *       callers and left three organiser ones and two "which are mine" ones
 *       shut, and the difference is the whole feature;</li>
 *   <li>{@code final} survives the JSON round-trip. The Java component has to
 *       be called {@code isFinal} (reserved word) and is renamed with
 *       {@code @JsonProperty}; if that rename ever breaks, every provisional
 *       score silently becomes a final one — which would eliminate pairs
 *       mid-game;</li>
 *   <li><b>§6.2's consent boundary</b>: a score written through an approved
 *       link that names a series mints that series' share token and returns it
 *       on the DTO; a link that names none still writes the score; and a series
 *       that is not linked is never given a token by any of it;</li>
 *   <li><b>§7.1's write token</b>: minted once and stored, good for exactly
 *       one link's score, worthless when wrong — and, the part that would be
 *       expensive to get wrong, never echoed by any listing. Plus the name a
 *       signed-out request has to be signed with;</li>
 *   <li><b>§8's suggestion</b>: the table the player is already sitting at is
 *       offered, and each of the four ways §8.1 says it must not be — a
 *       pending pair, a finished round, a superseded round, an already-linked
 *       table — yields an empty list rather than a flagged row.</li>
 * </ol>
 *
 * <p>This project has no Firebase test-token scaffolding, so anything that
 * needs an identity drives {@link BlokLinkService} directly with a stand-in
 * {@link CurrentUser} — the same code path the resource methods call, inside a
 * real transaction against the real docker-compose Postgres. Those tests are
 * {@code @TestTransaction}, so the rows they build are rolled back. The
 * RestAssured tests are about routing and the auth gate only, which is all
 * they can reach without a token to present.
 */
@QuarkusTest
class BlokLinkControllerTest {

    @Inject EntityManager em;
    @Inject ObjectMapper objectMapper;
    @Inject BlokLinkService blokLinks;
    @Inject BlokHistoryService history;

    /**
     * Flip {@link #asUser} to change who the services think is calling.
     *
     * <p><b>Anonymous by default</b>, and that matters: {@code QuarkusMock}
     * installs this bean for the whole application, HTTP requests included,
     * so a default of "signed in as somebody" would have made the
     * RestAssured tests below — which are precisely about what an anonymous
     * caller may do since §7 — quietly test a signed-in one instead.
     */
    public static class SwitchableUser extends CurrentUser {
        volatile String uid = null;
        volatile String name = null;

        @Override public String requireUid() { return uid; }
        @Override public Optional<String> uid() { return Optional.ofNullable(uid); }
        @Override public String uidOrNull() { return uid; }
        @Override public boolean isAnonymous() { return uid == null; }
        @Override public boolean isAdmin() { return false; }
        @Override public String displayName() { return name; }
    }

    private SwitchableUser me;

    @BeforeEach
    void installCaller() {
        me = new SwitchableUser();
        QuarkusMock.installMockForType(me, CurrentUser.class);
    }

    private void asUser(String uid) {
        me.uid = uid;
        me.name = "Test";
    }

    /** A signed-out blok: no uid, and therefore no display name either (§7.1). */
    private void asNobody() {
        me.uid = null;
        me.name = null;
    }

    /* ---------- 1. migration ---------- */

    @Test
    void changesetCreatedTableSequenceAndPartialIndex() {
        assertEquals(1L, count("""
                select count(*) from information_schema.tables
                where table_name = 'match_score_links'
                """), "match_score_links table missing — changeset did not apply");

        assertEquals(1L, count("""
                select count(*) from information_schema.sequences
                where sequence_name = 'seq_match_score_links_id'
                """), "sequence named in @SequenceGenerator missing");

        // The WHERE clause is the whole point: without it a rejected link
        // would block the same table from ever being requested again.
        String indexDef = (String) em.createNativeQuery("""
                        select indexdef from pg_indexes
                        where indexname = 'uq_msl_active_per_match'
                        """)
                .getSingleResult();
        assertTrue(indexDef.contains("UNIQUE"), () -> "index is not unique: " + indexDef);
        assertTrue(indexDef.contains("'PENDING'") && indexDef.contains("'APPROVED'"),
                () -> "index is not restricted to the two active states: " + indexDef);
    }

    private long count(String sql) {
        return ((Number) em.createNativeQuery(sql).getSingleResult()).longValue();
    }

    /* ---------- 2. what an anonymous caller may and may not reach ---------- */

    /**
     * §7.1 moved the line, so this test is about where it now runs rather
     * than about "everything is closed".
     *
     * <p>Still closed, and must stay closed: the organiser's three endpoints
     * (they decide, and a token never grants that), and the two player
     * endpoints whose whole question is "which of these is <em>mine</em>" —
     * {@code /mine} and §8's {@code /suggestions}, both of which are answered
     * from a Firebase uid and have nothing to say without one.
     *
     * <p>Now open, but useless without the right credential: the score write,
     * the single-link read and the revoke all 401 on a missing token instead
     * of on a missing sign-in — the same status, reached by the new rule.
     */
    @Test
    void anonymousReachesOnlyWhatSevenOpened() {
        String uuid = UUID.randomUUID().toString();

        // Organiser-only: unchanged by §7.
        given().when().get("/tournaments/nema-takvog/blok-links").then().statusCode(401);
        given().when().post("/tournaments/nema-takvog/blok-links/" + uuid + "/approve")
                .then().statusCode(401);
        given().when().post("/tournaments/nema-takvog/blok-links/" + uuid + "/reject")
                .then().statusCode(401);

        // "Which links are mine" needs a uid to mean anything.
        given().when().get("/blok-links/mine").then().statusCode(401);
        given().when().get("/blok-links/suggestions").then().statusCode(401);

        // Open since §7, and answering 401 for want of a token rather than
        // for want of an account.
        given().when().get("/blok-links/" + uuid).then().statusCode(401);
        // Revoke keeps answering 404 for a uuid that names nothing — it did
        // before §7 too, once the caller got past the sign-in gate.
        given().when().delete("/blok-links/" + uuid).then().statusCode(404);
        given().contentType(ContentType.JSON).body("{\"us\":10,\"them\":3,\"final\":false}")
                .when().put("/blok-links/" + uuid + "/score").then().statusCode(401);

        // A wrong token is worth exactly as much as none at all.
        given().header("X-Blok-Link-Token", "not-a-real-token")
                .contentType(ContentType.JSON).body("{\"us\":10,\"them\":3,\"final\":false}")
                .when().put("/blok-links/" + uuid + "/score").then().statusCode(401);
    }

    /**
     * The two doors §7.3 needs open before a signed-out player can link
     * anything: browsing a tournament's tables, and asking for a link. Both
     * used to answer 401 to an anonymous caller; if either ever does again,
     * the signed-out flow is dead one call before it starts.
     */
    @Test
    void anonymousMayBrowseTablesAndAskForALink() {
        // Reaches the handler (and 404s on the made-up tournament) instead of
        // being turned away at the door.
        given().when().get("/blok-links/targets?tournament=nema-takvog-turnira")
                .then().statusCode(404);

        // No name and no account: refused, but on the contract's own terms.
        given().contentType(ContentType.JSON)
                .body("{\"matchId\":1,\"usPairId\":1}")
                .when().post("/blok-links")
                .then().statusCode(400).body(org.hamcrest.Matchers.containsString("NAME_REQUIRED"));

        // A one-character name is not a signature either (2–60, §7.1).
        given().contentType(ContentType.JSON)
                .body("{\"matchId\":1,\"usPairId\":1,\"requestedByName\":\"M\"}")
                .when().post("/blok-links")
                .then().statusCode(400).body(org.hamcrest.Matchers.containsString("NAME_REQUIRED"));
    }

    /* ---------- 3. the `final` wire name ---------- */

    @Test
    void finalIsReadAndWrittenAsFinal() throws Exception {
        BlokLinkScoreRequest provisional =
                objectMapper.readValue("{\"us\":501,\"them\":388,\"final\":false}", BlokLinkScoreRequest.class);
        assertEquals(501, provisional.us());
        assertEquals(388, provisional.them());
        assertFalse(provisional.isFinal(), "a running total must not deserialize as final");

        BlokLinkScoreRequest settled =
                objectMapper.readValue("{\"us\":1001,\"them\":722,\"final\":true}", BlokLinkScoreRequest.class);
        assertTrue(settled.isFinal());

        // Omitted entirely -> false. The blok always sends the field, but a
        // default of "final" would be the dangerous direction to fail in.
        BlokLinkScoreRequest absent =
                objectMapper.readValue("{\"us\":100,\"them\":90}", BlokLinkScoreRequest.class);
        assertFalse(absent.isFinal());

        String json = objectMapper.writeValueAsString(settled);
        assertTrue(json.contains("\"final\":true"), () -> "serialized as: " + json);
        assertFalse(json.contains("isFinal"), () -> "leaked the Java name: " + json);
    }

    /* ---------- 4. §6.2: the linked table's record is public ---------- */

    /** §6.2's changeset: the nullable series id on the link. */
    @Test
    void sessionChangesetAddedANullableSessionId() {
        Object[] col = (Object[]) em.createNativeQuery("""
                        select data_type, character_maximum_length, is_nullable
                        from information_schema.columns
                        where table_name = 'match_score_links' and column_name = 'session_id'
                        """).getSingleResult();
        assertEquals("character varying", col[0].toString());
        assertEquals(64, ((Number) col[1]).intValue(),
                "must match blok_sessions.session_id, or a linkable series id would not fit");
        // Links made before §6.2 name no series, and a link may adopt one later
        // on its first score push. NOT NULL would have broken both.
        assertEquals("YES", col[2].toString(), "session_id must be nullable");

        // Deliberately NOT a foreign key to blok_sessions: the series is
        // routinely not uploaded when the table is linked, and may never be.
        assertEquals(0L, count("""
                select count(*) from information_schema.table_constraints tc
                join information_schema.key_column_usage k
                  on k.constraint_name = tc.constraint_name
                where tc.table_name = 'match_score_links'
                  and tc.constraint_type = 'FOREIGN KEY'
                  and k.column_name = 'session_id'
                """), "session_id must not be a FK — it names a row that usually does not exist yet");
    }

    /**
     * The §6.2 headline: writing a score through an APPROVED link that names a
     * series publishes that scorepad, and the token comes back on the link's
     * own DTO so the bracket can render {@code /blok/z/{token}}.
     *
     * <p>Also pins the two things that make it consent rather than a leak: the
     * token is the series' own {@code share_token} (so it is the same one the
     * owner's "Podijeli" would return), and pushing again does not mint a
     * second one — a link already sent to the table must keep working.
     */
    @Test
    @TestTransaction
    void aScorePushWithASessionIdMintsTheTokenAndReturnsIt() {
        asUser("blok-link-uid-a");
        String sessionId = "sess-" + UUID.randomUUID();
        BlokSessionDto series = history.save(oneGameSeries(sessionId));
        assertNull(tokenOf(series.uuid()), "the series was shared before anything linked it");

        Fixture f = tournamentWithOneTable();
        MatchScoreLink link = approvedLink(f, sessionId);

        // §6.1: two games to one, not 1012 : 786.
        BlokLinkDto dto = blokLinks.submitScore(link.getUuid(),
                new BlokLinkScoreRequest(2, 1, false, null));

        String token = dto.shareToken();
        assertNotNull(token, "linking a table is consent to publish — no token was minted");
        assertFalse(token.isBlank());
        assertEquals(token, tokenOf(series.uuid()),
                "the DTO's token is not the series' own share_token");
        assertEquals(sessionId, dto.sessionId());

        // The scorepad really is readable through the public route now.
        assertEquals(1, history.getShared(token).games().size());

        // The score went in as games won, on the right side, and the match is
        // untouched otherwise (§2.3(4) still holds verbatim).
        Matches m = reread(f.matchId);
        assertEquals(2, m.getScore1(), "us was pair1, so us -> score1");
        assertEquals(1, m.getScore2());
        assertEquals(MatchStatus.SCHEDULED, m.getStatus(),
                "a provisional write must not finish the match");
        assertNull(m.getWinnerPair());

        // Pushing again reuses the token: the link in somebody's chat survives.
        BlokLinkDto second = blokLinks.submitScore(link.getUuid(),
                new BlokLinkScoreRequest(2, 2, false, null));
        assertEquals(token, second.shareToken(), "re-pushing minted a second token");
    }

    /**
     * A link that names no series still writes the score — §6.2 makes the
     * token a consequence of the write, never a condition for it. This is the
     * ordinary case for a blok that has not uploaded its series yet, and the
     * only case for a link made before §6.2 existed.
     */
    @Test
    @TestTransaction
    void aScorePushWithoutASessionIdStillWritesTheScore() {
        asUser("blok-link-uid-a");
        Fixture f = tournamentWithOneTable();
        MatchScoreLink link = approvedLink(f, null);

        BlokLinkDto dto = blokLinks.submitScore(link.getUuid(),
                new BlokLinkScoreRequest(0, 2, false, null));

        assertNull(dto.shareToken(), "a link naming no series cannot have a token");
        assertNull(dto.sessionId());

        Matches m = reread(f.matchId);
        assertEquals(0, m.getScore1());
        assertEquals(2, m.getScore2());

        // …and a sessionId whose series has never been uploaded is equally
        // harmless: adopted onto the link, but nothing to mint a token for.
        BlokLinkDto adopted = blokLinks.submitScore(link.getUuid(),
                new BlokLinkScoreRequest(1, 2, false, "sess-" + UUID.randomUUID()));
        assertNull(adopted.shareToken(), "a token was minted for a series that does not exist");
        assertNotNull(adopted.sessionId(), "the link did not adopt the series id (§6.2)");
        assertEquals(1, reread(f.matchId).getScore1());
    }

    /**
     * <b>The consent boundary.</b> A series is published only because it is
     * linked to a table (or because its owner shared it). Nothing else mints:
     * not saving it, not requesting a link, not the organiser listing the
     * links, and not another player naming somebody else's series id.
     */
    @Test
    @TestTransaction
    void aTokenIsNeverMintedForASeriesThatIsNotLinked() {
        asUser("blok-link-uid-a");

        // 1. Merely uploading a series publishes nothing.
        String lonely = "sess-" + UUID.randomUUID();
        BlokSessionDto alone = history.save(oneGameSeries(lonely));
        assertNull(tokenOf(alone.uuid()), "saving a series minted a token");

        // 2. Asking for a link publishes nothing either — only the organiser's
        //    approval plus an actual score write is consent cashed in.
        String pending = "sess-" + UUID.randomUUID();
        BlokSessionDto waiting = history.save(oneGameSeries(pending));
        Fixture f = tournamentWithOneTable();
        BlokLinkDto requested = blokLinks.request(
                new CreateBlokLinkRequest(f.matchId, f.pair1Id, pending, null)).link();
        assertEquals(MatchScoreLinkStatus.PENDING.name(), requested.status());
        assertEquals(pending, requested.sessionId(), "the request did not store the series id");
        assertNull(requested.shareToken(), "a PENDING link published the scorepad");
        assertNull(tokenOf(waiting.uuid()), "requesting a link minted a token");

        // 3. Listing links reads tokens; it never creates them.
        for (BlokLinkDto row : blokLinks.listMine()) assertNull(row.shareToken());
        assertNull(tokenOf(waiting.uuid()), "listing links minted a token");
        assertNull(tokenOf(alone.uuid()));

        // 4. Another player's link naming MY series id publishes nothing of
        //    mine: the lookup is keyed on (requestedByUid, sessionId), so a
        //    copied id resolves to a series that user does not have.
        asUser("blok-link-uid-b");
        // A different table: uq_msl_active_per_match already holds the one
        // above for the PENDING request.
        MatchScoreLink stolen = approvedLink(tournamentWithOneTable(), lonely);
        BlokLinkDto pushed = blokLinks.submitScore(stolen.getUuid(),
                new BlokLinkScoreRequest(2, 0, false, null));
        assertNull(pushed.shareToken(), "one player's link published another player's scorepad");
        assertNull(tokenOf(alone.uuid()),
                "a stranger's link minted a token on somebody else's series");
    }

    /* ---------- 5. §7.1: linking without an account ---------- */

    /** §7.1's changeset: the write token, and the uid that may now be absent. */
    @Test
    void writeTokenChangesetAddedAUniqueNullableColumnAndFreedTheUid() {
        Object[] col = (Object[]) em.createNativeQuery("""
                        select data_type, character_maximum_length, is_nullable
                        from information_schema.columns
                        where table_name = 'match_score_links' and column_name = 'write_token'
                        """).getSingleResult();
        assertEquals("character varying", col[0].toString());
        assertEquals(48, ((Number) col[1]).intValue());
        // Every link made before §7 has none, and must keep working on its uid.
        assertEquals("YES", col[2].toString(), "write_token must be nullable");

        // Unique, so a token names at most one link.
        assertEquals(1L, count("""
                select count(*) from pg_indexes
                where tablename = 'match_score_links' and indexname = 'uq_msl_write_token'
                """), "write_token is not unique — one token could name two links");

        // The other half of the same changeset: an anonymous requester has no
        // uid to store. Without it POST /blok-links would still be shut to a
        // signed-out caller — just with a 500 instead of a 401.
        assertEquals("YES", (String) em.createNativeQuery("""
                        select is_nullable from information_schema.columns
                        where table_name = 'match_score_links'
                          and column_name = 'requested_by_uid'
                        """).getSingleResult(),
                "requested_by_uid must be nullable — §7 removed the sign-in");
    }

    /**
     * The headline of §7.1: a signed-out player asks for a link, is given a
     * write token exactly once, and that token — and nothing else — lets them
     * write the table's score once the organiser approves.
     */
    @Test
    @TestTransaction
    void anonymousMayLinkAndThenWriteWithTheToken() {
        Fixture f = tournamentWithOneTable();

        asNobody();
        BlokLinkCreatedDto created = blokLinks.request(
                new CreateBlokLinkRequest(f.matchId, f.pair1Id, null, "  Marko  "));

        String token = created.writeToken();
        assertNotNull(token, "no write token was minted — a signed-out blok has nothing to prove");
        assertEquals(32, token.length(), "not a ClaimTokens token");
        assertEquals(MatchScoreLinkStatus.PENDING.name(), created.link().status());
        assertNull(created.link().requestedByUid(), "an anonymous link must store no uid");
        assertEquals("Marko", created.link().requestedByName(),
                "the typed name is what the organiser will approve, trimmed");

        // It really is on the row, not just in the response.
        MatchScoreLink stored = em.createQuery(
                        "from MatchScoreLink where uuid = :u", MatchScoreLink.class)
                .setParameter("u", created.link().uuid())
                .getSingleResult();
        assertEquals(token, stored.getWriteToken());

        // Approved by the organiser (the only real defence, unchanged).
        stored.setStatus(MatchScoreLinkStatus.APPROVED);
        em.flush();

        // Still signed out, now holding the token: the score goes in.
        BlokLinkDto after = blokLinks.submitScore(created.link().uuid(),
                new BlokLinkScoreRequest(2, 1, false, null), token);
        assertEquals(MatchScoreLinkStatus.APPROVED.name(), after.status());
        assertNull(after.shareToken(), "§7.2: no account, no public record");

        Matches m = reread(f.matchId);
        assertEquals(2, m.getScore1());
        assertEquals(1, m.getScore2());
        assertEquals(MatchStatus.SCHEDULED, m.getStatus());

        // And the same token reads the link back — the signed-out blok's
        // replacement for /mine, so it can see it was approved.
        assertEquals(MatchScoreLinkStatus.APPROVED.name(),
                blokLinks.getOne(created.link().uuid(), token).status());
    }

    /**
     * The other half of the same rule: a wrong, blank or absent token is 401,
     * and so is a uuid that names nothing — a guess must not be told apart
     * from somebody else's link.
     */
    @Test
    @TestTransaction
    void aWrongTokenIsRejected() {
        Fixture f = tournamentWithOneTable();
        asNobody();
        BlokLinkCreatedDto created = blokLinks.request(
                new CreateBlokLinkRequest(f.matchId, f.pair1Id, null, "Marko"));
        UUID uuid = created.link().uuid();

        approveInPlace(uuid);

        assertUnauthorized(() -> blokLinks.submitScore(uuid,
                new BlokLinkScoreRequest(2, 1, false, null), "wrong-token"));
        assertUnauthorized(() -> blokLinks.submitScore(uuid,
                new BlokLinkScoreRequest(2, 1, false, null), "   "));
        assertUnauthorized(() -> blokLinks.submitScore(uuid,
                new BlokLinkScoreRequest(2, 1, false, null), null));
        assertUnauthorized(() -> blokLinks.getOne(uuid, "wrong-token"));
        assertUnauthorized(() -> blokLinks.getOne(UUID.randomUUID(), created.writeToken()));

        // A prefix of the real token is still a wrong token.
        assertUnauthorized(() -> blokLinks.getOne(uuid,
                created.writeToken().substring(0, created.writeToken().length() - 1)));

        // Nothing was written by any of that.
        Matches m = reread(f.matchId);
        assertNull(m.getScore1());
        assertNull(m.getScore2());

        // A signed-in stranger holding no token is in exactly the same place.
        asUser("blok-link-uid-stranger");
        assertUnauthorized(() -> blokLinks.submitScore(uuid,
                new BlokLinkScoreRequest(2, 1, false, null), null));
    }

    /**
     * §7 must not have loosened the path that already worked: a signed-in
     * requester still writes with no token at all, and is still recognised by
     * uid — a token belonging to <em>their</em> link does not let anybody else
     * act as them.
     */
    @Test
    @TestTransaction
    void aSignedInRequesterStillWritesWithoutAToken() {
        asUser("blok-link-uid-a");
        Fixture f = tournamentWithOneTable();
        MatchScoreLink link = approvedLink(f, null);

        BlokLinkDto dto = blokLinks.submitScore(link.getUuid(),
                new BlokLinkScoreRequest(2, 0, false, null));
        assertEquals(MatchScoreLinkStatus.APPROVED.name(), dto.status());
        assertEquals(2, reread(f.matchId).getScore1());

        // Their own link, through the token-aware signature with no token:
        // still recognised, by uid.
        assertEquals(link.getUuid(), blokLinks.submitScore(link.getUuid(),
                new BlokLinkScoreRequest(1, 2, false, null), null).uuid());
        assertEquals(1, reread(f.matchId).getScore1());

        // And a different signed-in user cannot write it, token or no token.
        asUser("blok-link-uid-b");
        assertUnauthorized(() -> blokLinks.submitScore(link.getUuid(),
                new BlokLinkScoreRequest(9, 9, false, null), null));
        assertEquals(1, reread(f.matchId).getScore1(), "a stranger moved the score");
    }

    /**
     * <b>The token is a secret.</b> It is returned by exactly one response and
     * must never appear in another — least of all in the organiser's listing,
     * which shows every link of the tournament to somebody who is not the
     * player. Checked against the serialised JSON rather than against a
     * getter, because a field nobody remembers is exactly how this leaks.
     */
    @Test
    @TestTransaction
    void theWriteTokenNeverAppearsInAnyListing() throws Exception {
        asUser("blok-link-uid-a");
        Fixture f = tournamentWithOneTable();
        BlokLinkCreatedDto created = blokLinks.request(
                new CreateBlokLinkRequest(f.matchId, f.pair1Id, null, null));
        String token = created.writeToken();
        assertNotNull(token, "a signed-in link gets a token too — the blok stores one either way");

        // The link half of the creation response already carries none.
        assertFalse(objectMapper.writeValueAsString(created.link()).contains(token),
                "the token leaked into the link DTO of its own creation response");

        // The player's own listing.
        assertFalse(objectMapper.writeValueAsString(blokLinks.listMine()).contains(token),
                "the token leaked into GET /blok-links/mine");

        // The organiser's listing — the one that matters.
        Tournaments t = em.find(Tournaments.class, f.tournamentId);
        String organiserView = objectMapper.writeValueAsString(blokLinks.listForTournament(t));
        assertFalse(organiserView.contains(token),
                "the token leaked into the organiser's link listing: " + organiserView);
        assertFalse(organiserView.toLowerCase().contains("writetoken"),
                "BlokLinkDto grew a writeToken field: " + organiserView);

        // The single-link read, and the score response.
        approveInPlace(created.link().uuid());
        assertFalse(objectMapper.writeValueAsString(
                        blokLinks.getOne(created.link().uuid(), token)).contains(token),
                "the token leaked into GET /blok-links/{uuid}");
        assertFalse(objectMapper.writeValueAsString(blokLinks.submitScore(
                        created.link().uuid(), new BlokLinkScoreRequest(2, 0, false, null), token))
                        .contains(token),
                "the token leaked into the score response");
    }

    /**
     * §7.1: "a request with no signature and no account is unapprovable".
     * Rejected before anything else is even looked at, and rejected on the
     * length rule too — the organiser has to read this name in a list.
     */
    @Test
    @TestTransaction
    void anAnonymousRequestWithoutANameIsRefused() {
        Fixture f = tournamentWithOneTable();
        asNobody();

        assertNameRequired(() -> blokLinks.request(
                new CreateBlokLinkRequest(f.matchId, f.pair1Id, null, null)));
        assertNameRequired(() -> blokLinks.request(
                new CreateBlokLinkRequest(f.matchId, f.pair1Id, null, "   ")));
        assertNameRequired(() -> blokLinks.request(
                new CreateBlokLinkRequest(f.matchId, f.pair1Id, null, "M")));
        assertNameRequired(() -> blokLinks.request(
                new CreateBlokLinkRequest(f.matchId, f.pair1Id, null, "x".repeat(61))));

        // Nothing was created by any of those.
        assertEquals(0L, count("select count(*) from match_score_links where match_id = " + f.matchId));

        // A signed-in caller needs no name of their own: the account is the
        // signature, exactly as before §7.
        asUser("blok-link-uid-a");
        assertEquals("Test", blokLinks.request(
                new CreateBlokLinkRequest(f.matchId, f.pair1Id, null, null))
                .link().requestedByName());
    }

    /* ---------- 6. §8: the table you are already sitting at ---------- */

    /**
     * §8.1 in full: a player registered on a live tournament, in the active
     * round, at a table nobody has claimed, is offered exactly that table —
     * with the pair that is theirs on the "us" side.
     */
    @Test
    @TestTransaction
    void aRegisteredPlayerIsOfferedTheirOwnTable() {
        String uid = "blok-suggest-" + UUID.randomUUID();
        Fixture f = tournamentWithOneTable(uid, false, RoundStatus.IN_PROGRESS);
        asUser(uid);

        List<BlokLinkSuggestionDto> out = blokLinks.suggestions();
        assertEquals(1, out.size(), () -> "expected exactly one table, got " + out);

        BlokLinkSuggestionDto s = out.get(0);
        assertEquals(f.matchId, s.matchId());
        assertEquals(f.roundId, s.roundId());
        assertEquals(1, s.roundNumber());
        assertEquals(1, s.tableNo());
        assertEquals(f.pair1Id, s.myPairId(), "the offer named the wrong side as mine");
        assertEquals("Mi", s.myPairName());
        assertEquals(f.pair2Id, s.opponentPairId());
        assertEquals("Vi", s.opponentPairName());
        assertNotNull(s.tournamentUuid());
        assertNotNull(s.tournamentName());

        // A co-submitter of the same pair is just as much "my pair" (§8.1(2)).
        String mate = "blok-suggest-mate-" + UUID.randomUUID();
        em.find(Pairs.class, f.pair1Id).setCoSubmittedByUid(mate);
        em.flush();
        asUser(mate);
        assertEquals(1, blokLinks.suggestions().size(),
                "co_submitted_by_uid is the other half of \"my pair\"");

        // Somebody with no pair anywhere is offered nothing.
        asUser("blok-suggest-nobody-" + UUID.randomUUID());
        assertTrue(blokLinks.suggestions().isEmpty());
    }

    /** §8.1(3): a pair the organiser has not approved yet is not "playing". */
    @Test
    @TestTransaction
    void aPairStillWaitingForApprovalIsNotOffered() {
        String uid = "blok-suggest-" + UUID.randomUUID();
        tournamentWithOneTable(uid, true, RoundStatus.IN_PROGRESS);
        asUser(uid);

        assertTrue(blokLinks.suggestions().isEmpty(),
                "a pending pair was offered a table");
    }

    /**
     * §8.1(4), both ways it can fail: the round the player is in has finished,
     * and — the subtler one — the round they are in is open but is no longer
     * the active one, because a newer round has been drawn without them.
     */
    @Test
    @TestTransaction
    void aFinishedOrSupersededRoundIsNotOffered() {
        String uid = "blok-suggest-" + UUID.randomUUID();
        tournamentWithOneTable(uid, false, RoundStatus.COMPLETED);
        asUser(uid);
        assertTrue(blokLinks.suggestions().isEmpty(), "a completed round was offered");

        // Same tournament, a newer open round the player is not in: their own
        // still-open round 1 is no longer the active one.
        Fixture live = tournamentWithOneTable(uid, false, RoundStatus.IN_PROGRESS);
        assertEquals(1, blokLinks.suggestions().size(), "sanity: the live table is on offer");

        Rounds newer = new Rounds();
        newer.setTournament(em.find(Tournaments.class, live.tournamentId));
        newer.setNumber(2);
        newer.setStatus(RoundStatus.IN_PROGRESS);
        em.persist(newer);
        em.flush();

        assertTrue(blokLinks.suggestions().isEmpty(),
                "an older open round stayed on offer after a newer one was drawn");
    }

    /** §8.1(5): a table somebody has already claimed is not offered again. */
    @Test
    @TestTransaction
    void anAlreadyLinkedTableIsNotOffered() {
        String uid = "blok-suggest-" + UUID.randomUUID();
        Fixture f = tournamentWithOneTable(uid, false, RoundStatus.IN_PROGRESS);
        asUser(uid);
        assertEquals(1, blokLinks.suggestions().size(), "sanity: the table is on offer");

        MatchScoreLink link = approvedLink(f, null);
        assertTrue(blokLinks.suggestions().isEmpty(),
                "a table with an APPROVED link was offered again");

        // A PENDING link holds the slot just as an approved one does.
        link.setStatus(MatchScoreLinkStatus.PENDING);
        em.flush();
        assertTrue(blokLinks.suggestions().isEmpty(),
                "a table with a PENDING link was offered again");

        // A revoked one does not: the table is free.
        link.setStatus(MatchScoreLinkStatus.REVOKED);
        em.flush();
        assertEquals(1, blokLinks.suggestions().size(),
                "a revoked link kept the table off the list");
    }

    /* ---------- fixtures ---------- */

    /** Approve a link the way the organiser would, without their endpoints. */
    private void approveInPlace(UUID linkUuid) {
        MatchScoreLink l = em.createQuery("from MatchScoreLink where uuid = :u", MatchScoreLink.class)
                .setParameter("u", linkUuid)
                .getSingleResult();
        l.setStatus(MatchScoreLinkStatus.APPROVED);
        em.flush();
    }

    /** The 401 envelope {@code BlokLinkService} throws for a failed credential. */
    private static void assertUnauthorized(Runnable call) {
        try {
            call.run();
        } catch (NotAuthorizedException expected) {
            return;
        }
        throw new AssertionError("expected 401, the call went through");
    }

    /** The bare {@code 400 NAME_REQUIRED} of §7.1. */
    private static void assertNameRequired(Runnable call) {
        try {
            call.run();
        } catch (WebApplicationException e) {
            assertEquals(400, e.getResponse().getStatus());
            assertEquals("NAME_REQUIRED", e.getResponse().getEntity());
            return;
        }
        throw new AssertionError("expected 400 NAME_REQUIRED, the call went through");
    }


    /** The ids of a minimal STARTED tournament with one live round and one table. */
    private record Fixture(Long tournamentId, Long roundId, Long matchId,
                           Long pair1Id, Long pair2Id) {}

    /**
     * A tournament that a blok could actually link to: STARTED, one
     * IN_PROGRESS round, one SCHEDULED match with both pairs present. Built
     * straight through the EntityManager because this project has no fixture
     * scaffolding, and rolled back with the surrounding {@code @TestTransaction}.
     */
    private Fixture tournamentWithOneTable() {
        return tournamentWithOneTable(null, false, RoundStatus.IN_PROGRESS);
    }

    /**
     * The same table, with the three knobs §8.1 turns on: who owns
     * {@code pair1}, whether that pair is still waiting for the organiser,
     * and what state the round is in.
     */
    private Fixture tournamentWithOneTable(String pair1Uid, boolean pair1Pending,
                                           RoundStatus roundStatus) {
        Tournaments t = new Tournaments();
        t.setName("Blok link test " + UUID.randomUUID());
        t.setStatus(TournamentStatus.STARTED);
        t.setCreatedByUid("blok-link-organiser");
        t.setCreatedAt(OffsetDateTime.now());
        em.persist(t);

        Pairs p1 = pair(t, "Mi", pair1Uid, pair1Pending);
        Pairs p2 = pair(t, "Vi", null, false);

        Rounds r = new Rounds();
        r.setTournament(t);
        r.setNumber(1);
        r.setStatus(roundStatus);
        em.persist(r);

        Matches m = new Matches();
        m.setTournament(t);
        m.setRound(r);
        m.setTableNo(1);
        m.setPair1(p1);
        m.setPair2(p2);
        m.setStatus(MatchStatus.SCHEDULED);
        em.persist(m);

        em.flush();
        return new Fixture(t.getId(), r.getId(), m.getId(), p1.getId(), p2.getId());
    }

    private Pairs pair(Tournaments t, String name) {
        return pair(t, name, null, false);
    }

    private Pairs pair(Tournaments t, String name, String submittedByUid, boolean pending) {
        Pairs p = new Pairs();
        p.setTournament(t);
        p.setName(name);
        p.setPaid(true);
        p.setSubmittedByUid(submittedByUid);
        p.setPendingApproval(pending);
        em.persist(p);
        return p;
    }

    /**
     * An APPROVED link for the current caller, persisted directly — the
     * approval flow itself is the organiser's and is not what these tests are
     * about.
     */
    private MatchScoreLink approvedLink(Fixture f, String sessionId) {
        MatchScoreLink link = new MatchScoreLink();
        link.setMatch(em.getReference(Matches.class, f.matchId));
        link.setTournament(em.getReference(Tournaments.class, f.tournamentId));
        link.setUsPair(em.getReference(Pairs.class, f.pair1Id));
        link.setStatus(MatchScoreLinkStatus.APPROVED);
        link.setRequestedByUid(me.uid);
        link.setRequestedByName("Test");
        link.setSessionId(sessionId);
        em.persist(link);
        em.flush();
        return link;
    }

    /**
     * The match as the database has it: flushed first, because
     * {@code refresh} would otherwise discard the very writes under test —
     * the service mutates a managed entity and the transaction has not
     * committed.
     */
    private Matches reread(Long matchId) {
        em.flush();
        Matches m = em.find(Matches.class, matchId);
        em.refresh(m);
        return m;
    }

    /** The stored share token of one series, read straight out of the column. */
    private String tokenOf(UUID sessionUuid) {
        em.flush();
        return (String) em.createNativeQuery(
                        "select share_token from blok_sessions where uuid = :u")
                .setParameter("u", sessionUuid)
                .getSingleResult();
    }

    /** The smallest legal blok series: one game, one deal. */
    private static SaveBlokSessionRequest oneGameSeries(String sessionId) {
        BlokRoundDto deal = new BlokRoundDto(
                "us",
                new BlokScoresDto(92, 70),
                new BlokDeclarationsDto(List.of(20), List.of()),
                null,
                "HERC");
        BlokGameDto g = new BlokGameDto(
                UUID.randomUUID().toString(),
                1_757_280_000_000L, 1_757_283_600_000L, 1001, "prolaz", "us",
                new BlokScoresDto(1012, 786), List.of(deal));
        return new SaveBlokSessionRequest(sessionId, 1001, "prolaz",
                BlokNamesDto.of("", ""), 1_757_280_000_000L, 1_757_283_600_000L, List.of(g));
    }
}
