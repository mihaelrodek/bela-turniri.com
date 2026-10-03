/* ──────────────────────────────────────────────────────────────────────────
   "Znaš li kartati belu?" — where the answer is kept (2026-09-29).

   One versioned localStorage key holding a small map, one entry per
   IDENTITY on this browser:

     bela:learn:v1 = { "u:<firebase uid>": {...}, "guest": {...} }

   A signed-in player and the browser's guest are different people as far as
   this question goes: somebody who learned the game as a guest and then made
   an account is asked nothing new on THIS browser only because both entries
   sit side by side, and a second account on a shared computer is asked for
   itself. There is one guest per browser (`bela.guest`), hence one key.

   Nothing here reaches a server. Every access is wrapped: storage can be
   unavailable (private mode, blocked site data), and then the question is
   simply asked again next time — never an error on screen.
   ────────────────────────────────────────────────────────────────────── */

const STORAGE_KEY = "bela:learn:v1"

export type LearnAnswer = "knows" | "learn"

export interface LearnEntry {
    answer: LearnAnswer
    /** Epoch ms of the answer. */
    at: number
    /** Epoch ms the practice game was last finished, when it was. */
    finishedAt?: number
}

type LearnStore = Record<string, LearnEntry>

/** The storage identity: the Firebase uid when signed in, else the guest. */
export function learnIdentity(uid: string | null | undefined): string {
    return uid ? `u:${uid}` : "guest"
}

function isEntry(value: unknown): value is LearnEntry {
    if (value === null || typeof value !== "object") return false
    const entry = value as Partial<LearnEntry>
    return (entry.answer === "knows" || entry.answer === "learn") && typeof entry.at === "number"
}

function readStore(): LearnStore {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return {}
        const parsed: unknown = JSON.parse(raw)
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {}
        const out: LearnStore = {}
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
            if (isEntry(value)) out[key] = value
        }
        return out
    } catch {
        return {}
    }
}

function writeStore(store: LearnStore): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    } catch {
        // Storage unavailable — the question comes back next visit.
    }
}

/** The stored answer of this identity, or null when it was never asked. */
export function readLearnEntry(identity: string): LearnEntry | null {
    return readStore()[identity] ?? null
}

export function saveLearnAnswer(identity: string, answer: LearnAnswer): void {
    const store = readStore()
    store[identity] = { ...store[identity], answer, at: Date.now() }
    writeStore(store)
}

/**
 * The practice game was played to the end. Also counts as an answer: someone
 * who opened the tutorial from a link and finished it is not asked
 * afterwards whether they know how to play.
 */
export function markLearnFinished(identity: string): void {
    const store = readStore()
    const now = Date.now()
    const previous = store[identity]
    store[identity] = previous
        ? { ...previous, finishedAt: now }
        : { answer: "learn", at: now, finishedAt: now }
    writeStore(store)
}
