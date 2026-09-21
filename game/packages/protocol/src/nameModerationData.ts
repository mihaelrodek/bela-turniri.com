/* ──────────────────────────────────────────────────────────────────────────
   MODERATION BLOCKLIST — player display names only (README §3, `LIMITS.playerNameMax`).

   The game has no free-text chat; the PLAYER NAME above a seat is the only
   text one player ever writes that another player is forced to read (room
   names are explicitly out of scope — owner decision, 2026-09-20). App Store
   / Play Store review requires user-generated text to be moderated, so this
   file is a real, curated blocklist of vulgar, sexual, slur (ethnic,
   homophobic, ableist) and hate terms for the languages this app's players
   actually type in — Croatian/Serbian/Bosnian (one written register for
   moderation purposes), Slovenian and English — plus a handful of
   Nazi/Ustaša-era hate symbols and slogans that still circulate as insults in
   the region. It is deliberately not exhaustive; it exists to catch the
   common, obvious cases with an even more deliberate bias against blocking
   somebody's real name (see `NAME_ALLOWLIST` below).

   Every entry is written in the NORMALISED alphabet `nameModeration.ts`
   folds a name into: lower-case ASCII, Croatian/Slovenian/Serbian diacritics
   stripped (č/ć→c, ž→z, š→s, đ→d), so e.g. "pička" is listed as "picka".

   Two lists, matched two different ways — see `nameModeration.ts` for why:

   - `BLOCKED_SUBSTRINGS`: whole, unambiguous words (≥ 5 normalised letters
     for the Latin-script ones). Matched anywhere in the fully-compacted name
     (all spaces/punctuation removed, repeated letters collapsed), which is
     what catches spaced-out or leetspoke evasion ("p i c k a", "p.i.c.k.a",
     "pi3dor4s"). Long enough that no real Croatian/Slovenian first name,
     surname or place name is expected to contain one — if that assumption
     turns out wrong for a specific word, prefer removing/shortening the
     entry over growing the allowlist forever.
   - `BLOCKED_WORD_STEMS`: short, ambiguous roots (3-4 letters) that are real
     obscenity/slur stems in the region but are also PREFIXES of ordinary
     Croatian/Slovenian surnames and place names (Kurtović, Picula, Pićan…).
     Matched only as a whole-token PREFIX — i.e. against one normalised,
     separator-delimited word of the name as the user actually typed it, not
     against the fully-compacted string — and only when that token is not in
     `NAME_ALLOWLIST`. This intentionally does NOT catch a spaced-out "k u r"
     (each letter becomes its own token); that evasion of a 3-letter stem is
     an accepted gap in exchange for not flagging real names by default.
   ────────────────────────────────────────────────────────────────────── */

/**
 * Long/unambiguous offensive words and phrases, normalised (lower-case,
 * diacritics folded), matched as a substring anywhere in the compacted name.
 */
export const BLOCKED_SUBSTRINGS: readonly string[] = [
    // ── HR/SR/BS vulgar & sexual ──
    "picka", "pizda", "pizdo", "pizdu", "kurac", "kurca", "kurcu", "kurcina",
    "kurva", "kurvo", "kurvin", "jebem", "jebes", "jebi", "jebo", "jebiga",
    "jebote", "pojebi", "najebi", "govno", "govnar", "seronja", "seres",
    "drkadzija", "drkati", "supak", "supcina", "kucka", "picketina",
    "usisavac", "cepic", "kuratina",
    // ── Slovenian vulgar & sexual (distinct spellings) ──
    "kurbin", "posranec", "jebenka", "pofukan",
    // ── HR/SR/BS slurs (ethnic, homophobic, ableist) ──
    "ciganin", "cigancina", "peder", "pedercina", "pederu", "siptar",
    "balija", "balijo", "cetnik", "cetnicka", "ustasa", "ustaski",
    "mongoloid", "retardiran", "downic",
    // ── Nazi / Ustaša-era hate symbols and slogans ──
    "zadomspremni", "hajlhitler", "sighajl", "svastika", "kukastikrst",
    "hitlerov", "nacisticki",
    // ── English vulgar, sexual, slurs, hate ──
    "fuck", "shit", "bitch", "cunt", "asshole", "whore", "slut", "pussy",
    "nigger", "nigga", "faggot", "rapist", "retard", "mongoloid",
    "hitler", "nazi",
] as const

/**
 * Short, ambiguous obscenity/slur STEMS. Matched only as a whole-token
 * PREFIX (README above) — never as a plain substring — and only when the
 * token itself is not in `NAME_ALLOWLIST`.
 */
export const BLOCKED_WORD_STEMS: readonly string[] = [
    "kur", "pic", "pič", "jeb", "pizd", "cig", "fag", "dick",
] as const

/**
 * Whole normalised tokens that must NEVER be flagged even though they start
 * with a `BLOCKED_WORD_STEMS` entry — real Croatian/Slovenian first names,
 * surnames, places and card-game vocabulary. Checked before the stem test.
 *
 * (Diacritics already folded: "Kurtović" → "kurtovic".)
 */
export const NAME_ALLOWLIST: readonly string[] = [
    // Surnames/places starting with "kur"
    "kurtovic", "kuric", "kurjak", "kurjakovic", "kuret", "kurbalija",
    "kuruc", "kurtagic", "kurja", "kurent", "kurja vas", "kurilo",
    // Surnames/places starting with "pic"/"pič"
    "picula", "picek", "pican", "picok", "pico",
    // Card-game vocabulary that must stay playable as a name
    "pik", "pikova", "pikado", "kara", "karo", "herc", "tref", "trefova",
    "adut", "bela", "belot", "stiglja", "stigla", "dama", "kec",
    // Common given names/surnames that could collide with a short stem
    "jelko", "jerko", "jerkovic", "jelena", "jela",
    // English surnames/names that START with a blocked English stem
    "dickens", "dickinson", "dickson", "dick", "dicky", "cockburn", "cocker", "hancock",
] as const
