package hr.mrodek.apps.bela_turniri.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.function.UnaryOperator;
import java.util.regex.Pattern;

/**
 * Validates and normalises the per-tournament rules document
 * ({@code tournaments.rules}, jsonb) — 2026-10-03, owner request "Pravila turnira".
 *
 * <h2>Shape (version 1)</h2>
 * <pre>
 * { "v": 1,
 *   "roundMinutes": 70,                        // optional, 15..240
 *   "matchGames": 2,                           // optional, 1..5 (games to win a match; 2026-10-03)
 *   "sections": { "game": [ item, ... ], ... },  // game|deal|trump|decl|tour|conduct
 *   "fouls": [ foul, ... ] }
 * item = { "id": "game.3" | "c-&lt;uuid&gt;", "text": string|null, "removed"?: true }
 * foul = item + { "penalty": DEAL|WARNING_DEAL|WARNING|REDEAL|SCORE_162|EXPEL }
 * </pre>
 *
 * <p>The document is <b>sparse</b>: it holds only what the organiser changed.
 * An {@code id} that is a dictionary key ("game.3", "d.2") overrides that
 * default; any other id is a custom rule appended after the defaults.
 * {@code text: null} means "show the default text in the viewer's language".
 * The backend does not know the default ids (they live in the frontend
 * dictionaries) — it checks the shape, the limits and the penalty enum, and
 * stores a trimmed, de-duplicated copy. An empty document normalises to
 * {@code null}, i.e. "never customised: use the global defaults".
 *
 * <p>Plain static logic with the message lookup passed in, so it is unit
 * testable without CDI or a database. Failures are
 * {@link IllegalArgumentException}s, which the exception mappers turn into 400.
 */
public final class TournamentRulesNormaliser {

    public static final int VERSION = 1;
    public static final int MAX_ITEMS_PER_SECTION = 40;
    public static final int MAX_FOULS = 60;
    public static final int MAX_TEXT = 500;
    public static final int MAX_ID = 64;
    public static final int MIN_ROUND_MINUTES = 15;
    public static final int MAX_ROUND_MINUTES = 240;
    public static final int MIN_MATCH_GAMES = 1;
    public static final int MAX_MATCH_GAMES = 5;

    public static final List<String> SECTIONS = List.of("game", "deal", "trump", "decl", "tour", "conduct");
    public static final List<String> PENALTIES =
            List.of("DEAL", "WARNING_DEAL", "WARNING", "REDEAL", "SCORE_162", "EXPEL");

    private static final Pattern ID = Pattern.compile("[A-Za-z0-9._-]+");
    private static final JsonNodeFactory F = JsonNodeFactory.instance;

    private TournamentRulesNormaliser() {}

    /**
     * @param raw the document as received; {@code null}/JSON null/empty means "defaults"
     * @param msg message-bundle lookup (key → text in the caller's language)
     * @return the normalised document, or {@code null} when nothing is customised
     * @throws IllegalArgumentException on any shape or limit violation
     */
    public static ObjectNode normalise(JsonNode raw, UnaryOperator<String> msg) {
        if (raw == null || raw.isNull()) return null;
        if (!raw.isObject()) throw bad(msg, "tournament.rules.invalid");
        if (raw.path("v").asInt(-1) != VERSION || !raw.path("v").isInt()) {
            throw bad(msg, "tournament.rules.invalid");
        }
        ObjectNode out = F.objectNode();
        out.put("v", VERSION);

        JsonNode rm = raw.get("roundMinutes");
        if (rm != null && !rm.isNull()) {
            if (!rm.isInt() || rm.intValue() < MIN_ROUND_MINUTES || rm.intValue() > MAX_ROUND_MINUTES) {
                throw bad(msg, "tournament.rules.roundMinutes");
            }
            out.put("roundMinutes", rm.intValue());
        }

        JsonNode mg = raw.get("matchGames");
        if (mg != null && !mg.isNull()) {
            if (!mg.isInt() || mg.intValue() < MIN_MATCH_GAMES || mg.intValue() > MAX_MATCH_GAMES) {
                throw bad(msg, "tournament.rules.matchGames");
            }
            out.put("matchGames", mg.intValue());
        }

        ObjectNode sectionsOut = F.objectNode();
        JsonNode sections = raw.get("sections");
        if (sections != null && !sections.isNull()) {
            if (!sections.isObject()) throw bad(msg, "tournament.rules.invalid");
            for (Iterator<String> it = sections.fieldNames(); it.hasNext(); ) {
                String name = it.next();
                if (!SECTIONS.contains(name)) throw bad(msg, "tournament.rules.invalid");
            }
            // Fixed section order keeps the stored copy stable (same input, same bytes).
            for (String name : SECTIONS) {
                JsonNode list = sections.get(name);
                if (list == null || list.isNull()) continue;
                ArrayNode items = items(list, false, MAX_ITEMS_PER_SECTION, msg);
                if (items.size() > 0) sectionsOut.set(name, items);
            }
        }
        if (sectionsOut.size() > 0) out.set("sections", sectionsOut);

        JsonNode fouls = raw.get("fouls");
        if (fouls != null && !fouls.isNull()) {
            ArrayNode f = items(fouls, true, MAX_FOULS, msg);
            if (f.size() > 0) out.set("fouls", f);
        }

        // Only {"v":1} left: nothing customised.
        return out.size() <= 1 ? null : out;
    }

    private static ArrayNode items(JsonNode list, boolean foul, int max, UnaryOperator<String> msg) {
        if (!list.isArray()) throw bad(msg, "tournament.rules.invalid");
        if (list.size() > max) throw bad(msg, foul ? "tournament.rules.tooManyFouls" : "tournament.rules.tooManyItems");
        ArrayNode out = F.arrayNode();
        Set<String> seen = new HashSet<>();
        for (JsonNode item : list) {
            if (!item.isObject()) throw bad(msg, "tournament.rules.invalid");
            String id = item.path("id").isTextual() ? item.path("id").textValue().trim() : "";
            if (id.isEmpty() || id.length() > MAX_ID || !ID.matcher(id).matches() || !seen.add(id)) {
                throw bad(msg, "tournament.rules.badId");
            }
            JsonNode textNode = item.get("text");
            String text = null;
            if (textNode != null && !textNode.isNull()) {
                if (!textNode.isTextual()) throw bad(msg, "tournament.rules.invalid");
                text = textNode.textValue().trim();
                if (text.length() > MAX_TEXT) throw bad(msg, "tournament.rules.textTooLong");
                if (text.isEmpty()) text = null;
            }
            boolean removed = item.path("removed").asBoolean(false);

            ObjectNode o = F.objectNode();
            o.put("id", id);
            if (text == null) o.putNull("text"); else o.put("text", text);
            if (removed) o.put("removed", true);
            if (foul) {
                String penalty = item.path("penalty").isTextual() ? item.path("penalty").textValue() : "";
                if (!PENALTIES.contains(penalty)) throw bad(msg, "tournament.rules.badPenalty");
                o.put("penalty", penalty);
            }
            out.add(o);
        }
        return out;
    }

    private static IllegalArgumentException bad(UnaryOperator<String> msg, String key) {
        return new IllegalArgumentException(msg.apply(key));
    }
}
