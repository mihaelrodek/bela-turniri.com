package hr.mrodek.apps.bela_turniri.dtos;

/**
 * One deal ({@code podjela}) — a single line of the paper blok.
 * {@code BLOK-HISTORY.md} §2.3.
 *
 * <p>Wire shape, unchanged between upload and read-back:
 * <pre>
 * {
 *   "caller":       "us",                       // who called the trump
 *   "cards":        { "us": 92, "them": 70 },   // trick points
 *   "declarations": { "us": [20], "them": [] }, // zvanja, individually
 *   "stiglja":      null,                       // "us" | "them" | null
 *   "trump":        "HERC"                      // HERC|KARA|PIK|TREF | null
 * }
 * </pre>
 *
 * <p>The scores are <b>as the client computed them</b>. Deliberately: the bela
 * scoring rules (pad, štiglja, declarations beating a called suit) live in the
 * TypeScript engine that drew the screen, and this record exists so the profile
 * shows exactly what the player saw at the table. Nothing else in the
 * application reads it, so there is no second consumer for a server-side
 * recomputation to disagree with.
 */
public record BlokRoundDto(
        /** Which side called the trump: {@code "us"} or {@code "them"}. */
        String caller,
        /** Trick points before declarations, 0..1000 per side. */
        BlokScoresDto cards,
        /** Each announced declaration, 0..1000 apiece. */
        BlokDeclarationsDto declarations,
        /** Side that took every trick, or null. */
        String stiglja,
        /** {@code HERC} | {@code KARA} | {@code PIK} | {@code TREF}, or null. */
        String trump
) {}
