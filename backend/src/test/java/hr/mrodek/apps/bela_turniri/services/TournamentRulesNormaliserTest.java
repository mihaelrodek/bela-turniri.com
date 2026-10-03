package hr.mrodek.apps.bela_turniri.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Plain JUnit, no CDI / DB: the normaliser takes the message lookup as a lambda. */
class TournamentRulesNormaliserTest {

    private static final ObjectMapper M = new ObjectMapper();

    private static JsonNode json(String s) throws Exception {
        return M.readTree(s);
    }

    private static String bad(String s) throws Exception {
        return assertThrows(IllegalArgumentException.class,
                () -> TournamentRulesNormaliser.normalise(json(s), k -> k)).getMessage();
    }

    @Test
    void nullAndEmptyMeanDefaults() throws Exception {
        assertNull(TournamentRulesNormaliser.normalise(null, k -> k));
        assertNull(TournamentRulesNormaliser.normalise(json("null"), k -> k));
        assertNull(TournamentRulesNormaliser.normalise(json("{\"v\":1}"), k -> k));
        assertNull(TournamentRulesNormaliser.normalise(json("{\"v\":1,\"sections\":{\"game\":[]},\"fouls\":[]}"), k -> k));
    }

    @Test
    void trimsTextDropsBlankAndKeepsRemoved() throws Exception {
        JsonNode out = TournamentRulesNormaliser.normalise(json("""
                {"v":1,"roundMinutes":60,"matchGames":3,"sections":{"game":[
                  {"id":"game.1","text":"  Do 701.  "},
                  {"id":"game.2","text":"   "},
                  {"id":"game.3","text":null,"removed":true,"junk":1},
                  {"id":"c-1","text":"Moje pravilo"}]},
                 "fouls":[{"id":"d.1","text":null,"penalty":"WARNING"}]}
                """), k -> k);
        assertEquals(60, out.get("roundMinutes").asInt());
        assertEquals(3, out.get("matchGames").asInt());
        JsonNode game = out.get("sections").get("game");
        assertEquals("Do 701.", game.get(0).get("text").asText());
        assertEquals(true, game.get(1).get("text").isNull());
        assertEquals(true, game.get(2).get("removed").asBoolean());
        assertEquals(false, game.get(2).has("junk"));
        assertEquals("WARNING", out.get("fouls").get(0).get("penalty").asText());
    }

    @Test
    void rejectsBadShapes() throws Exception {
        assertEquals("tournament.rules.invalid", bad("[]"));
        assertEquals("tournament.rules.invalid", bad("{\"v\":2}"));
        assertEquals("tournament.rules.invalid", bad("{\"v\":1,\"sections\":{\"nope\":[]}}"));
        assertEquals("tournament.rules.invalid", bad("{\"v\":1,\"sections\":{\"game\":{}}}"));
        assertEquals("tournament.rules.badId", bad("{\"v\":1,\"sections\":{\"game\":[{\"id\":\"a b\",\"text\":\"x\"}]}}"));
        assertEquals("tournament.rules.badId",
                bad("{\"v\":1,\"sections\":{\"game\":[{\"id\":\"a\",\"text\":\"x\"},{\"id\":\"a\",\"text\":\"y\"}]}}"));
        assertEquals("tournament.rules.badPenalty", bad("{\"v\":1,\"fouls\":[{\"id\":\"d.1\",\"penalty\":\"HANG\"}]}"));
        assertEquals("tournament.rules.badPenalty", bad("{\"v\":1,\"fouls\":[{\"id\":\"d.1\"}]}"));
        assertEquals("tournament.rules.roundMinutes", bad("{\"v\":1,\"roundMinutes\":5}"));
        assertEquals("tournament.rules.roundMinutes", bad("{\"v\":1,\"roundMinutes\":241}"));
        assertEquals("tournament.rules.matchGames", bad("{\"v\":1,\"matchGames\":0}"));
        assertEquals("tournament.rules.matchGames", bad("{\"v\":1,\"matchGames\":6}"));
        assertEquals("tournament.rules.matchGames", bad("{\"v\":1,\"matchGames\":\"2\"}"));
    }

    @Test
    void enforcesLimits() throws Exception {
        assertEquals("tournament.rules.textTooLong",
                bad("{\"v\":1,\"sections\":{\"tour\":[{\"id\":\"c-1\",\"text\":\"" + "x".repeat(501) + "\"}]}}"));
        assertEquals("tournament.rules.badId",
                bad("{\"v\":1,\"sections\":{\"tour\":[{\"id\":\"" + "a".repeat(65) + "\",\"text\":\"x\"}]}}"));

        StringBuilder items = new StringBuilder();
        for (int i = 0; i < 41; i++) items.append(i > 0 ? "," : "").append("{\"id\":\"c-").append(i).append("\",\"text\":\"x\"}");
        assertEquals("tournament.rules.tooManyItems", bad("{\"v\":1,\"sections\":{\"conduct\":[" + items + "]}}"));

        StringBuilder fouls = new StringBuilder();
        for (int i = 0; i < 61; i++) fouls.append(i > 0 ? "," : "").append("{\"id\":\"c-").append(i).append("\",\"text\":\"x\",\"penalty\":\"DEAL\"}");
        assertEquals("tournament.rules.tooManyFouls", bad("{\"v\":1,\"fouls\":[" + fouls + "]}"));

        // Exactly at the limits is fine.
        assertEquals(500, TournamentRulesNormaliser.normalise(
                json("{\"v\":1,\"sections\":{\"tour\":[{\"id\":\"c-1\",\"text\":\"" + "x".repeat(500) + "\"}]}}"),
                k -> k).get("sections").get("tour").get(0).get("text").asText().length());
    }
}
