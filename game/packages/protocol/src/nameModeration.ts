/* ──────────────────────────────────────────────────────────────────────────
   Player-name moderation — dependency-free, deterministic, shared by
   `@bela/server` (authoritative) and the frontend (input-time hint only,
   README §3 "Ime za igru" / CLAUDE.md task).

   THE ONLY user-written text another player is forced to read is the name
   above a seat (`UserInfo.name`, `LIMITS.playerNameMax` = 16 chars) — chat is
   free-text-less (`REACTIONS` are fixed emoji) and room names are explicitly
   out of scope (owner decision, 2026-09-20). This module answers exactly one
   question, `isOffensiveName`, plus the small amount of input hygiene every
   caller needs around it (`sanitizePlayerNameInput`, `hasUsableContent`).

   NORMALISATION (`foldForModeration`), in order:
     1. strip control characters (see `sanitizePlayerNameInput`)
     2. Unicode NFD + strip combining diacritics (č → c, ž → z, š → s, …)
     3. đ/Đ → d/D (does not decompose under NFD — a distinct code point)
     4. lower-case
     5. fold common Cyrillic look-alikes to their Latin twin (а→a, е→e, о→o,
        р→p, с→c, у→y, х→x, к→k, м→m, т→t, н→h, і/ї→i, ѕ→s, в→v, й→i) — the
        cheap way to catch someone spelling a Latin slur with Cyrillic glyphs
        that render identically
     6. fold leetspeak/homoglyph digits and symbols to their letter:
        0→o, 1/!→i, 3→e, 4/@→a, 5/$→s, 7→t
   Steps 2-6 all happen on `[a-z]`-producing substitutions only; anything left
   over (remaining digits, punctuation, whitespace, emoji) is NOT a letter and
   is dropped by the tokenizer/compactor below rather than mapped to anything.

   MATCHING, two shapes built from the folded string:
     - `compact`  — every non-letter removed, then runs of the same letter
       collapsed to one ("p.i.c.k.a" / "p i c k a" / "piiiička" all fold to
       "picka"). This is what `BLOCKED_SUBSTRINGS` (whole, unambiguous words)
       is matched against, so separator/leet evasion of a clearly offensive
       word cannot slip through by spacing it out.
     - `tokens`   — the folded string split on runs of non-letters (so on the
       ORIGINAL spaces/punctuation, not stripped away), each collapsed the
       same way. This is what `BLOCKED_WORD_STEMS` (short, ambiguous roots
       like "kur"/"pic"/"jeb" that are also real name prefixes) is matched
       against, as a whole-token PREFIX — "Kurtović" tokenizes to one token
       "kurtovic", which the allowlist protects; a genuinely spaced-out "k u
       r" tokenizes to three single-letter tokens and is NOT caught by the
       stem check. That gap is an accepted trade-off: the short stems that
       matter most (picka/kurac/jebem…) are already full entries in
       `BLOCKED_SUBSTRINGS`, which the compact check catches regardless of
       spacing.

   THE ALLOWLIST is checked at the token level, against `BLOCKED_WORD_STEMS`
   only — a name made entirely of allowlisted tokens is never flagged even
   though its compacted form might contain a blocked SUBSTRING as a
   coincidence of concatenation (e.g. "Ivo Picula" compacts to "ivopicula",
   which contains "pic" but not any full `BLOCKED_SUBSTRINGS` entry). A name
   that concatenates a real surname with something else WITHOUT a separator
   (no realistic case at 16 characters, but possible) is not protected by the
   allowlist — a known, documented limitation rather than a silent one.
   ────────────────────────────────────────────────────────────────────── */

import { BLOCKED_SUBSTRINGS, BLOCKED_WORD_STEMS, NAME_ALLOWLIST } from "./nameModerationData.js"

const ALLOWLIST_SET: ReadonlySet<string> = new Set(NAME_ALLOWLIST)

/** Control characters, zero-width and bidi-override code points — never
 *  something a player meant to type, so always stripped rather than
 *  rejected. Shared by client input handling and the server's last line of
 *  defence. */
// Deliberately matching control code points (bidi overrides, zero-width, stray NULs).
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮﻿]/g

export function stripControlChars(input: string): string {
    return input.replace(CONTROL_CHARS_RE, "")
}

/** Trims and strips control characters — the shared first step before length
 *  checks, offensiveness checks or storage. Does NOT enforce
 *  `LIMITS.playerNameMax`; callers slice separately so a truncation choice
 *  stays visible at the call site. */
export function sanitizePlayerNameInput(input: string): string {
    return stripControlChars(input).trim()
}

/** True when the (already sanitised) name has at least one letter or digit —
 *  false for "", whitespace-only, or a name made only of punctuation/emoji. */
export function hasUsableContent(input: string): boolean {
    return /[\p{L}\p{N}]/u.test(input)
}

const CYRILLIC_FOLD: Readonly<Record<string, string>> = {
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x",
    "к": "k", "м": "m", "т": "t", "н": "h", "і": "i", "ї": "i", "ѕ": "s",
    "в": "v", "й": "i",
}

const LEET_FOLD: Readonly<Record<string, string>> = {
    "0": "o", "1": "i", "!": "i", "3": "e", "4": "a", "@": "a", "5": "s",
    "$": "s", "7": "t",
}

/** Lower-case ASCII letters only — diacritics, Cyrillic look-alikes and
 *  leetspeak folded to their Latin letter; everything else (remaining
 *  digits, punctuation, whitespace, emoji) passes through untouched so the
 *  tokenizer/compactor below can treat it as a separator. */
function foldForModeration(input: string): string {
    const nfd = input.normalize("NFD").replace(/[̀-ͯ]/g, "")
    let out = ""
    for (const ch of nfd) {
        if (ch === "đ") { out += "d"; continue }
        if (ch === "Đ") { out += "d"; continue }
        const lower = ch.toLowerCase()
        out += CYRILLIC_FOLD[lower] ?? LEET_FOLD[lower] ?? lower
    }
    return out
}

/** Collapse runs of the same letter to one ("piiička" → "pička"). */
function collapseRepeats(s: string): string {
    return s.replace(/(.)\1+/g, "$1")
}

/** One word of the folded name, as the user actually separated it (a plain
 *  a-z run — remaining digits/punctuation/whitespace act as the boundary). */
function tokenize(folded: string): string[] {
    const tokens = folded.split(/[^a-z]+/).filter((t) => t.length > 0)
    return tokens.map(collapseRepeats)
}

/** The whole folded name with every separator removed — what a spaced-out or
 *  punctuated evasion of a full blocked word collapses back down to. */
function compactOf(folded: string): string {
    return collapseRepeats(folded.replace(/[^a-z]+/g, ""))
}

/**
 * Whether `name` reads as offensive under the blocklist (README above).
 * Pure and synchronous — safe to call on both the client (as a hint) and the
 * server (as the authoritative check). Does not itself enforce length,
 * emptiness or control characters; combine with `sanitizePlayerNameInput` /
 * `hasUsableContent` for a full check (`validatePlayerName` below does).
 */
export function isOffensiveName(name: string): boolean {
    const folded = foldForModeration(name)
    const tokens = tokenize(folded)
    if (tokens.length === 0) return false
    if (tokens.every((t) => ALLOWLIST_SET.has(t))) return false

    const compact = compactOf(folded)
    for (const term of BLOCKED_SUBSTRINGS) {
        if (compact.includes(term)) return true
    }
    for (const stem of BLOCKED_WORD_STEMS) {
        for (const token of tokens) {
            if (token.startsWith(stem) && !ALLOWLIST_SET.has(token)) return true
        }
    }
    return false
}

export type PlayerNameRejectReason = "EMPTY" | "OFFENSIVE"

export type PlayerNameValidation =
    | { ok: true; name: string }
    | { ok: false; reason: PlayerNameRejectReason }

/**
 * The one call both the client's inline check and the server's authoritative
 * check should make: sanitise, reject an unusable name, reject an offensive
 * one. Does not enforce `LIMITS.playerNameMax` — callers slice/validate
 * length themselves, since the server and the client report that failure
 * differently (a `maxLength` input vs a length-specific message).
 */
export function validatePlayerName(input: string): PlayerNameValidation {
    const cleaned = sanitizePlayerNameInput(input)
    if (!hasUsableContent(cleaned)) return { ok: false, reason: "EMPTY" }
    if (isOffensiveName(cleaned)) return { ok: false, reason: "OFFENSIVE" }
    return { ok: true, name: cleaned }
}
