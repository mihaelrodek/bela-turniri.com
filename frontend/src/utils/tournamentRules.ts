/* ──────────────────────────────────────────────────────────────────────────
   Tournament rules document ("Pravila turnira"), 2026-10-03, owner request.

   The global rulebook (/pravila) is the DEFAULT; an organiser may edit each
   rule, delete it, add their own, pick a different penalty per foul and set
   the round length and how many games win a match. What is stored on the tournament (`rules`, jsonb, NULL =
   never customised) is only the DIFFERENCE from those defaults:

     { v: 1, roundMinutes?: 70, matchGames?: 3,
       sections: { game: [{ id: "game.3", text: "…" }, { id: "game.4", text: null, removed: true }, { id: "c-…", text: "my rule" }] },
       fouls:    [{ id: "d.2", text: null, penalty: "WARNING" }] }

   * `id` of a default rule is its dictionary key ("game.3" → `legal.rules.game.3`,
     "d.2" → `legal.rules.foul.d.2`); anything else is a custom rule.
   * `text: null` = show the default in the VIEWER's language, so an unedited
     rule stays translated. A stored text is shown exactly as typed (like the
     persisted drink labels — it was written in one language).
   * Defaults not mentioned are shown as they are, so a tournament that was
     never edited stays NULL and still gets the full, current rulebook.
   * FIXED rules (`FIXED_ITEM_IDS`: game.1, game.2, game.3, deal.2, deal.3,
     tour.1) are derived from the settings above the rulebook — target,
     prolaz/dosta, match games, deal direction, who deals next, round length.
     They are always present, can be neither edited nor deleted, and
     `resolveRules` / `pruneRules` ignore any stored override of them (old
     documents may carry one; the backend strips it).
   * The five game parameters (target score, prolaz/dosta, direction,
     declarations, bela) are NOT in here: they keep their own columns. They
     only parametrise the default texts (`{target}`, the `.dosta` / `.right`
     variants) so a 501 tournament does not print "do 1001".

   Pure and dependency-free on purpose (no React, no i18n import): the editor,
   the tab and /pravila share it, and the limits below mirror
   `TournamentRulesNormaliser` on the backend.
   ────────────────────────────────────────────────────────────────────── */

export type ItemSection = "game" | "deal" | "trump" | "decl" | "tour" | "conduct"
export type NextDealer = "NEXT" | "WINNER"
export type PenaltyCode = "DEAL" | "WARNING_DEAL" | "WARNING" | "REDEAL" | "SCORE_162" | "EXPEL"

export type StoredItem = { id: string; text: string | null; removed?: boolean }
export type StoredFoul = StoredItem & { penalty: PenaltyCode }
export type StoredRules = {
    v: 1
    roundMinutes?: number
    /** Games a pair must win to take the match (1–5, default 2); 2026-10-03. */
    matchGames?: number
    /** Who deals the next game: the next player in turn (default) or the winning pair. */
    nextDealer?: NextDealer
    sections?: Partial<Record<ItemSection, StoredItem[]>>
    fouls?: StoredFoul[]
}

/** Mirrors the backend validator (TournamentRulesNormaliser). */
export const RULES_LIMITS = {
    maxItemsPerSection: 40,
    maxFouls: 60,
    maxText: 500,
    maxId: 64,
    minRoundMinutes: 15,
    maxRoundMinutes: 240,
    minMatchGames: 1,
    maxMatchGames: 5,
    /** Own cap on custom rules, well under the backend's so defaults + customs always fit. */
    maxCustomPerSection: 20,
} as const

export const DEFAULT_ROUND_MINUTES = 70
export const DEFAULT_MATCH_GAMES = 2
export const DEFAULT_NEXT_DEALER: NextDealer = "NEXT"

/* `decl.off` / `decl.belaOnly` are not in DEFAULT_ITEM_IDS: they exist only while
   declarations are switched off, when the "Zvanja" group shows exactly that one
   fixed rule INSTEAD of decl.1–8 (2026-10-03, owner). Stored overrides of
   decl.1–8 are left alone and apply again when declarations are switched back on. */

/** Rules whose text is derived from the settings: locked in the editor, never overridable. */
export const FIXED_ITEM_IDS: ReadonlySet<string> = new Set(["game.1", "game.2", "game.3", "deal.2", "deal.3", "tour.1", "decl.off", "decl.belaOnly"])

/** Display order of the rulebook. `foul` is the table between decl and tour. */
export const RULE_SECTION_ORDER = ["game", "deal", "trump", "decl", "foul", "tour", "conduct"] as const
export type RuleSectionKey = (typeof RULE_SECTION_ORDER)[number]

const seq = (section: string, n: number) => Array.from({ length: n }, (_, i) => `${section}.${i + 1}`)

/** Default rule ids per section = the dictionary keys under `legal.rules.<section>.`. */
export const DEFAULT_ITEM_IDS: Record<ItemSection, string[]> = {
    game: seq("game", 6),
    deal: seq("deal", 6),
    trump: seq("trump", 1),
    decl: seq("decl", 8),
    tour: seq("tour", 6),
    conduct: seq("conduct", 3),
}

/** Default fouls and their default penalties, grouped harshest first (as on /pravila). */
export const DEFAULT_FOULS: { id: string; penalty: PenaltyCode }[] = [
    { id: "d.1", penalty: "DEAL" },
    { id: "d.2", penalty: "DEAL" },
    { id: "d.7", penalty: "DEAL" },
    { id: "d.8", penalty: "DEAL" },
    { id: "d.3", penalty: "WARNING_DEAL" },
    { id: "d.4", penalty: "WARNING_DEAL" },
    { id: "d.5", penalty: "WARNING_DEAL" },
    { id: "d.6", penalty: "WARNING_DEAL" },
    { id: "d.9", penalty: "WARNING_DEAL" },
    { id: "d.10", penalty: "WARNING_DEAL" },
    { id: "w.1", penalty: "WARNING" },
    { id: "w.2", penalty: "WARNING" },
    { id: "r.1", penalty: "REDEAL" },
    { id: "r.2", penalty: "SCORE_162" },
]

export const PENALTY_CODES: PenaltyCode[] = ["DEAL", "WARNING_DEAL", "WARNING", "REDEAL", "SCORE_162", "EXPEL"]

/** Machine code → dictionary suffix of `legal.rules.foul.penalty.*`. */
export const PENALTY_LABEL_KEY: Record<PenaltyCode, string> = {
    DEAL: "deal",
    WARNING_DEAL: "warningDeal",
    WARNING: "warning",
    REDEAL: "redeal",
    SCORE_162: "162",
    EXPEL: "expel",
}

/** Pill colours per penalty; the two new, harshest ones sit in the red family too. */
export const PENALTY_TONE: Record<PenaltyCode, { bg: string; fg: string }> = {
    DEAL: { bg: "red.subtle", fg: "red.fg" },
    SCORE_162: { bg: "red.subtle", fg: "red.fg" },
    EXPEL: { bg: "red.muted", fg: "red.fg" },
    WARNING_DEAL: { bg: "orange.subtle", fg: "orange.fg" },
    WARNING: { bg: "yellow.subtle", fg: "yellow.fg" },
    REDEAL: { bg: "bg.muted", fg: "fg.muted" },
}

export type Translate = (key: string, params?: Record<string, string | number>) => string

/** The tournament columns that parametrise default texts. */
export type GameParams = {
    targetScore: number
    gameEndRule: "prolaz" | "dosta"
    dealDirection: "right" | "left"
    declarationsEnabled: boolean
    allowBela: boolean
}

/** What /pravila (the global rulebook) shows: the 1001, prolaz, left, declarations-on rulebook. */
export const GLOBAL_GAME_PARAMS: GameParams = {
    targetScore: 1001,
    gameEndRule: "prolaz",
    dealDirection: "left",
    declarationsEnabled: true,
    allowBela: true,
}

export type ResolvedItem = {
    id: string
    text: string
    isDefault: boolean
    /** The organiser replaced the default text (custom rules are never "edited"). */
    edited: boolean
    /** Derived from the settings: locked (no edit, no delete). */
    fixed?: boolean
    /** Deleted default rule, kept ONLY when the editor asks for it
     *  (`includeRemoved`) so it can be shown greyed out with a restore button. */
    removed?: boolean
}
export type ResolvedFoul = ResolvedItem & { penalty: PenaltyCode; penaltyChanged: boolean }
export type ResolvedRules = {
    roundMinutes: number
    matchGames: number
    nextDealer: NextDealer
    sections: Record<ItemSection, ResolvedItem[]>
    fouls: ResolvedFoul[]
}

/** Dictionary key (below `legal.rules.`) of a default rule's text, picking the setting variant. */
function defaultKey(id: string, p: GameParams, nextDealer: NextDealer): string {
    if ((id === "game.1" || id === "game.2") && p.gameEndRule === "dosta") return `${id}.dosta`
    if (id === "deal.2" && p.dealDirection === "right") return "deal.2.right"
    if (id === "deal.3" && nextDealer === "WINNER") return "deal.3.winner"
    return id
}

/** Plural-family translator (`usePlural()` / `tPlural`), for the games count in `game.3`. */
export type PluralTranslate = (baseKey: string, count: number) => string

/** "2 dobivene partije" — the games-to-win phrase, in the viewer's plural form. */
export function matchGamesPhrase(games: number, plural?: PluralTranslate): string {
    return plural ? plural("legal.rules.matchGames", games) : String(games)
}

/** The settings that parametrise default texts, besides the five game columns. */
export type RuleSettings = {
    roundMinutes?: number
    matchGames?: number
    nextDealer?: NextDealer
    plural?: PluralTranslate
}

export function defaultItemText(id: string, t: Translate, p: GameParams, x: RuleSettings = {}): string {
    return t(`legal.rules.${defaultKey(id, p, x.nextDealer ?? DEFAULT_NEXT_DEALER)}`, {
        target: p.targetScore,
        minutes: x.roundMinutes ?? DEFAULT_ROUND_MINUTES,
        games: matchGamesPhrase(x.matchGames ?? DEFAULT_MATCH_GAMES, x.plural),
    })
}

export function defaultFoulText(id: string, t: Translate): string {
    return t(`legal.rules.foul.${id}`)
}

export function isCustomId(id: string): boolean {
    return id.startsWith("c-")
}

/** A fresh id for a custom rule; ≤ 64 chars, [A-Za-z0-9._-] like the backend demands. */
export function newCustomId(): string {
    const uuid =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    return `c-${uuid}`
}

/**
 * Merge the stored overrides over the defaults for rendering. `t` resolves
 * default texts in the VIEWER's language; stored texts are shown verbatim.
 * With declarations switched off the "Zvanja" group is ONE fixed rule (no
 * declarations / only bela) followed by the organiser's own rules; decl.1–8 are
 * not shown at all and their stored overrides are kept untouched.
 */
export function resolveRules(
    stored: StoredRules | null | undefined,
    t: Translate,
    p: GameParams,
    opts?: { includeRemoved?: boolean; plural?: PluralTranslate },
): ResolvedRules {
    const includeRemoved = !!opts?.includeRemoved
    const roundMinutes = stored?.roundMinutes ?? DEFAULT_ROUND_MINUTES
    const matchGames = stored?.matchGames ?? DEFAULT_MATCH_GAMES
    const nextDealer = stored?.nextDealer === "WINNER" ? "WINNER" : DEFAULT_NEXT_DEALER
    const settings: RuleSettings = { roundMinutes, matchGames, nextDealer, plural: opts?.plural }
    const sections = {} as Record<ItemSection, ResolvedItem[]>
    for (const section of Object.keys(DEFAULT_ITEM_IDS) as ItemSection[]) {
        const overrides = new Map((stored?.sections?.[section] ?? []).map((o) => [o.id, o]))
        const out: ResolvedItem[] = []
        if (section === "decl" && !p.declarationsEnabled) {
            const id = p.allowBela ? "decl.belaOnly" : "decl.off"
            out.push({ id, text: t(`legal.rules.${id}`), isDefault: true, fixed: true, edited: false })
        }
        for (const id of section === "decl" && !p.declarationsEnabled ? [] : DEFAULT_ITEM_IDS[section]) {
            const fixed = FIXED_ITEM_IDS.has(id)
            // Fixed rules ignore whatever an old document stored for them.
            const o = fixed ? undefined : overrides.get(id)
            if (o?.removed && !includeRemoved) continue
            out.push({
                id,
                text: o?.text ?? defaultItemText(id, t, p, settings),
                isDefault: true,
                fixed: fixed || undefined,
                edited: !!o?.text,
                removed: o?.removed ? true : undefined,
            })
        }
        for (const o of stored?.sections?.[section] ?? []) {
            if (DEFAULT_ITEM_IDS[section].includes(o.id) || o.removed || !o.text) continue
            out.push({ id: o.id, text: o.text, isDefault: false, edited: false })
        }
        sections[section] = out
    }

    const foulOverrides = new Map((stored?.fouls ?? []).map((o) => [o.id, o]))
    const fouls: ResolvedFoul[] = []
    for (const d of DEFAULT_FOULS) {
        const o = foulOverrides.get(d.id)
        if (o?.removed && !includeRemoved) continue
        const penalty = o?.penalty ?? d.penalty
        fouls.push({
            id: d.id,
            text: o?.text ?? defaultFoulText(d.id, t),
            isDefault: true,
            edited: !!o?.text,
            removed: o?.removed ? true : undefined,
            penalty,
            penaltyChanged: penalty !== d.penalty,
        })
    }
    for (const o of stored?.fouls ?? []) {
        if (DEFAULT_FOULS.some((d) => d.id === o.id) || o.removed || !o.text) continue
        fouls.push({ id: o.id, text: o.text, isDefault: false, edited: false, penalty: o.penalty, penaltyChanged: false })
    }
    return { roundMinutes, matchGames, nextDealer, sections, fouls }
}

/* ───────────── editor operations (pure: stored → stored) ─────────────
   Each returns a pruned copy, so the editor's state is always already the
   minimal document that `serializeRules` would send. */

const defaultPenalty = (id: string): PenaltyCode | null => DEFAULT_FOULS.find((d) => d.id === id)?.penalty ?? null

/** Drop everything that equals the defaults; `null` when nothing is left. */
export function pruneRules(stored: StoredRules | null | undefined): StoredRules | null {
    if (!stored) return null
    const out: StoredRules = { v: 1 }
    if (stored.roundMinutes != null && stored.roundMinutes !== DEFAULT_ROUND_MINUTES) out.roundMinutes = stored.roundMinutes
    if (stored.matchGames != null && stored.matchGames !== DEFAULT_MATCH_GAMES) out.matchGames = stored.matchGames
    if (stored.nextDealer === "WINNER") out.nextDealer = "WINNER"
    const sections: Partial<Record<ItemSection, StoredItem[]>> = {}
    for (const section of Object.keys(DEFAULT_ITEM_IDS) as ItemSection[]) {
        const list = (stored.sections?.[section] ?? []).filter((o) => {
            if (FIXED_ITEM_IDS.has(o.id)) return false
            if (DEFAULT_ITEM_IDS[section].includes(o.id)) return !!o.removed || !!o.text
            return !o.removed && !!o.text
        })
        if (list.length > 0) sections[section] = list
    }
    if (Object.keys(sections).length > 0) out.sections = sections
    const fouls = (stored.fouls ?? []).filter((o) => {
        const def = defaultPenalty(o.id)
        if (def == null) return !o.removed && !!o.text
        return !!o.removed || !!o.text || o.penalty !== def
    })
    if (fouls.length > 0) out.fouls = fouls
    return Object.keys(out).length > 1 ? out : null
}

/** What goes on the wire: `null` (= defaults) or the minimal document. */
export function serializeRules(stored: StoredRules | null | undefined): StoredRules | null {
    return pruneRules(stored)
}

function upsertItem(list: StoredItem[], item: StoredItem): StoredItem[] {
    return list.some((o) => o.id === item.id) ? list.map((o) => (o.id === item.id ? item : o)) : [...list, item]
}

const withSection = (s: StoredRules | null, section: ItemSection, list: StoredItem[]): StoredRules =>
    ({ ...(s ?? { v: 1 }), v: 1, sections: { ...(s?.sections ?? {}), [section]: list } })

export function setItemText(s: StoredRules | null, section: ItemSection, id: string, text: string, defaultText: string | null): StoredRules | null {
    if (FIXED_ITEM_IDS.has(id)) return s
    const clean = text.trim().slice(0, RULES_LIMITS.maxText)
    // Typing the default back in = no edit (keeps it translatable).
    const value = defaultText != null && clean === defaultText.trim() ? null : clean || null
    if (value == null && defaultText == null) return s // a custom rule cannot be blank
    return pruneRules(withSection(s, section, upsertItem(s?.sections?.[section] ?? [], { id, text: value })))
}

export function removeItem(s: StoredRules | null, section: ItemSection, id: string): StoredRules | null {
    if (FIXED_ITEM_IDS.has(id)) return s
    const list = s?.sections?.[section] ?? []
    if (isCustomId(id) || !DEFAULT_ITEM_IDS[section].includes(id)) {
        return pruneRules(withSection(s, section, list.filter((o) => o.id !== id)))
    }
    return pruneRules(withSection(s, section, upsertItem(list, { id, text: null, removed: true })))
}

/** Bring a deleted default rule back (its own text edit, if it had one, is kept). */
export function restoreItem(s: StoredRules | null, section: ItemSection, id: string): StoredRules | null {
    if (FIXED_ITEM_IDS.has(id)) return s
    const list = s?.sections?.[section] ?? []
    const existing = list.find((o) => o.id === id)
    return pruneRules(withSection(s, section, upsertItem(list, { id, text: existing?.text ?? null })))
}

export function addCustomItem(s: StoredRules | null, section: ItemSection, text: string): StoredRules | null {
    const clean = text.trim().slice(0, RULES_LIMITS.maxText)
    if (!clean) return s
    const list = s?.sections?.[section] ?? []
    if (list.filter((o) => !DEFAULT_ITEM_IDS[section].includes(o.id)).length >= RULES_LIMITS.maxCustomPerSection) return s
    return pruneRules(withSection(s, section, [...list, { id: newCustomId(), text: clean }]))
}

const withFouls = (s: StoredRules | null, fouls: StoredFoul[]): StoredRules => ({ ...(s ?? { v: 1 }), v: 1, fouls })

function upsertFoul(list: StoredFoul[], foul: StoredFoul): StoredFoul[] {
    return list.some((o) => o.id === foul.id) ? list.map((o) => (o.id === foul.id ? foul : o)) : [...list, foul]
}

export function setFoulText(s: StoredRules | null, id: string, text: string, defaultText: string | null, currentPenalty: PenaltyCode): StoredRules | null {
    const clean = text.trim().slice(0, RULES_LIMITS.maxText)
    const value = defaultText != null && clean === defaultText.trim() ? null : clean || null
    if (value == null && defaultText == null) return s
    return pruneRules(withFouls(s, upsertFoul(s?.fouls ?? [], { id, text: value, penalty: currentPenalty })))
}

export function setFoulPenalty(s: StoredRules | null, id: string, penalty: PenaltyCode): StoredRules | null {
    const existing = s?.fouls?.find((o) => o.id === id)
    return pruneRules(withFouls(s, upsertFoul(s?.fouls ?? [], { id, text: existing?.text ?? null, penalty })))
}

export function removeFoul(s: StoredRules | null, id: string): StoredRules | null {
    const list = s?.fouls ?? []
    const def = defaultPenalty(id)
    if (def == null) return pruneRules(withFouls(s, list.filter((o) => o.id !== id)))
    return pruneRules(withFouls(s, upsertFoul(list, { id, text: null, removed: true, penalty: list.find((o) => o.id === id)?.penalty ?? def })))
}

/** Bring a deleted default foul back, with the penalty it had. */
export function restoreFoul(s: StoredRules | null, id: string): StoredRules | null {
    const list = s?.fouls ?? []
    const existing = list.find((o) => o.id === id)
    const def = defaultPenalty(id)
    if (def == null) return s
    return pruneRules(withFouls(s, upsertFoul(list, { id, text: existing?.text ?? null, penalty: existing?.penalty ?? def })))
}

export function addCustomFoul(s: StoredRules | null, text: string, penalty: PenaltyCode): StoredRules | null {
    const clean = text.trim().slice(0, RULES_LIMITS.maxText)
    if (!clean) return s
    const list = s?.fouls ?? []
    if (list.filter((o) => defaultPenalty(o.id) == null).length >= RULES_LIMITS.maxCustomPerSection) return s
    return pruneRules(withFouls(s, [...list, { id: newCustomId(), text: clean, penalty }]))
}

/** `null` clears it back to the default (70). Out-of-range values are clamped. */
export function setRoundMinutes(s: StoredRules | null, minutes: number | null): StoredRules | null {
    const base: StoredRules = { ...(s ?? { v: 1 }), v: 1 }
    if (minutes == null || !Number.isFinite(minutes)) delete base.roundMinutes
    else base.roundMinutes = Math.min(RULES_LIMITS.maxRoundMinutes, Math.max(RULES_LIMITS.minRoundMinutes, Math.round(minutes)))
    return pruneRules(base)
}

/** `null` clears it back to the default (2). Out-of-range values are clamped to 1–5. */
export function setMatchGames(s: StoredRules | null, games: number | null): StoredRules | null {
    const base: StoredRules = { ...(s ?? { v: 1 }), v: 1 }
    if (games == null || !Number.isFinite(games)) delete base.matchGames
    else base.matchGames = Math.min(RULES_LIMITS.maxMatchGames, Math.max(RULES_LIMITS.minMatchGames, Math.round(games)))
    return pruneRules(base)
}

/** `"NEXT"` clears it back to the default. */
export function setNextDealer(s: StoredRules | null, who: NextDealer): StoredRules | null {
    const base: StoredRules = { ...(s ?? { v: 1 }), v: 1 }
    if (who === "WINNER") base.nextDealer = "WINNER"
    else delete base.nextDealer
    return pruneRules(base)
}

/** Who deals the next game, from a stored (or API) rules document; "NEXT" when untouched. */
export function resolveNextDealer(stored: { nextDealer?: unknown } | null | undefined): NextDealer {
    return stored?.nextDealer === "WINNER" ? "WINNER" : DEFAULT_NEXT_DEALER
}

/** Games to win a match from a stored (or API) rules document; 2 when untouched. */
export function resolveMatchGames(stored: { matchGames?: unknown } | null | undefined): number {
    const n = stored?.matchGames
    return typeof n === "number" && Number.isInteger(n) && n >= RULES_LIMITS.minMatchGames && n <= RULES_LIMITS.maxMatchGames
        ? n
        : DEFAULT_MATCH_GAMES
}

/** How many rules the organiser has changed (edited, removed, added, re-penalised, round length). */
export function countCustomisations(s: StoredRules | null | undefined): number {
    const p = pruneRules(s)
    if (!p) return 0
    let n = (p.roundMinutes != null ? 1 : 0) + (p.matchGames != null ? 1 : 0) + (p.nextDealer != null ? 1 : 0)
    for (const list of Object.values(p.sections ?? {})) n += list?.length ?? 0
    return n + (p.fouls?.length ?? 0)
}
