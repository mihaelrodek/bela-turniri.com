/* ──────────────────────────────────────────────────────────────────────────
   Game sounds — recorded samples with a WebAudio synth fallback (2026-09-20).
   Respects `useGamePrefs().sound`. Four cues: a riffle shuffle when the game
   starts, a card thrown on the table for every trick, a bright bell
   arpeggio for a win and a slow low minor fall for a loss.

   "card" and "gameStart" now play real recordings — five short WAVs under
   `../sounds/assets/`, re-encoded excerpts of Kenney's CC0 "Casino Audio"
   pack (see `../sounds/LICENSE.md` for provenance and why WAV, not AAC).
   They are fetched and `decodeAudioData`'d once into an in-module AudioBuffer
   cache (`preloadSounds`, also kicked off from `primeAudio`) and then played
   through AudioBufferSourceNodes. Every card uses the SAME sample
   (`card-place-2`, the user's pick, 2026-09-20) at `CARD_LEVEL`. Until that decode finishes
   — or if it never does, e.g. the fetch fails offline before the service
   worker has a copy — `playSound` falls back to the ORIGINAL synthesised
   `playCardSnap` / `playShuffle` below, so the game is never silent.
   "gameWon" / "gameLost" are unaffected: still pure WebAudio synthesis.

   ALL TIMES ARE SECONDS. `AudioContext.currentTime` is in seconds, and an
   offset written in milliseconds (`now + 85`) schedules the note a minute and
   a half later — which is how win, loss and start all used to collapse into
   one identical beep (2026-09-20).
   ────────────────────────────────────────────────────────────────────── */

import { getGamePrefs } from "../hooks/useGamePrefs"
import { cacheDeckOffline } from "../cards/deckOffline"
import cardPlaceUrl from "../sounds/assets/card-place-2.wav"
import cardShuffleUrl from "../sounds/assets/card-shuffle.wav"

interface WebKitGlobal {
    webkitAudioContext?: typeof AudioContext
}

export type GameSound = "seatJoin" | "seatLeave" | "turnTick" | "turnTickLast" | "gameLaunch" | "gameStart" | "card" | "gameWon" | "gameLost"

let audioContext: AudioContext | null = null
const activeOscillators: OscillatorNode[] = []
const activeBufferSources: AudioBufferSourceNode[] = []

/** ONE card sample for every card (2026-09-20, user's pick out of the four
 *  Kenney variants): the same deck makes the same sound. */
const CARD_URLS = [cardPlaceUrl]

/** The card lands thirty-two times a deal, so it sits well under the one-off
 *  cues — full level was tiring within a game (2026-09-20, user request). */
const CARD_LEVEL = 0.5

// Decoded lazily, once, into these module-level slots — every `import` of
// this file shares the same AudioContext-bound buffers. `null` means "not
// ready yet or never will be"; `playSound` treats both the same way, by
// falling back to synthesis, so a slow network never has to be distinguished
// from a failed one at the call site.
let cardBuffers: AudioBuffer[] | null = null
let shuffleBuffer: AudioBuffer | null = null
let preloadPromise: Promise<void> | null = null

/** Lazily create the AudioContext without resuming it — decoding does not
 *  need a running context, only playback does (see `primeAudio`). */
function ensureContext(): AudioContext | null {
    if (audioContext) return audioContext
    try {
        const AC = typeof AudioContext !== "undefined" ? AudioContext : (globalThis as unknown as WebKitGlobal).webkitAudioContext
        if (!AC) return null
        audioContext = new AC()
        return audioContext
    } catch {
        return null // AudioContext unavailable (SSR, old browser).
    }
}

/** `AudioContext.decodeAudioData` in the callback form, which is the only
 *  form old Safari ever settles — the Promise it also returns there simply
 *  never resolves. Wrapping the callbacks in a `Promise` gives every caller
 *  one interface regardless of engine. */
function decodeAudioDataCompat(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
        try {
            const maybePromise = ctx.decodeAudioData(data, resolve, reject)
            // Modern engines resolve this too; swallow it so a double-settle
            // never surfaces as an unhandled rejection when the callback path
            // above already resolved/rejected the outer Promise.
            if (maybePromise && typeof maybePromise.catch === "function") {
                maybePromise.catch(() => {})
            }
        } catch (err) {
            reject(err instanceof Error ? err : new Error("decodeAudioData failed"))
        }
    })
}

async function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
    const response = await fetch(url)
    const data = await response.arrayBuffer()
    return decodeAudioDataCompat(ctx, data)
}

/** Fetch and decode every sample once. Safe to call repeatedly — the second
 *  call reuses the first's in-flight promise instead of re-fetching. Never
 *  throws: a failure just leaves `cardBuffers`/`shuffleBuffer` at `null`,
 *  which `playSound` reads as "use the synth". */
export function preloadSounds(): void {
    if (preloadPromise) return
    const ctx = ensureContext()
    if (!ctx) return

    // Best-effort offline copy, same mechanism as the card art (see
    // `deckOffline.ts`'s header): a pseudo "sounds" deck under DECK_CACHE.
    // Fire immediately — it only needs the (already known, static) URLs, not
    // the decode below, and is itself a no-op outside prod/web.
    cacheDeckOffline("sounds", [...CARD_URLS, cardShuffleUrl])

    preloadPromise = (async () => {
        try {
            const [card, shuffle] = await Promise.all([
                loadBuffer(ctx, cardPlaceUrl),
                loadBuffer(ctx, cardShuffleUrl),
            ])
            cardBuffers = [card]
            shuffleBuffer = shuffle
        } catch {
            // Offline before the deck cache had a copy, or a decode error —
            // `cardBuffers`/`shuffleBuffer` stay `null` and `playSound` keeps
            // using the synthesised cues.
        }
    })()
}

/** Lazily create and resume the AudioContext. Called from user gestures to
 *  unlock iOS. Also where sample loading starts — a gesture is the earliest
 *  reliable moment the game gets, and decoding does not need to wait for it,
 *  but there is no earlier hook to start it from either. */
export function primeAudio(): void {
    const ctx = ensureContext()
    if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {
            // Browsers only permit this from a user gesture.
        })
    }
    preloadSounds()
}

/** Stop all active oscillators and sample playback. */
export function stopAllSounds(): void {
    activeOscillators.forEach((osc) => {
        try {
            osc.stop()
        } catch {
            // Already stopped.
        }
    })
    activeOscillators.length = 0
    activeBufferSources.forEach((source) => {
        try {
            source.stop()
        } catch {
            // Already stopped.
        }
    })
    activeBufferSources.length = 0
}

/**
 * Keep the audio context unlocked for as long as the table is on screen.
 *
 * The old version armed ONE `pointerdown`/`keydown` listener with
 * `{ once: true }`, which is right for the very first unlock and useless
 * afterwards: iOS suspends the context every time the PWA is backgrounded, so
 * from the first trip to the home screen onwards the game was silent until a
 * reload (2026-09-20, user report). These listeners stay for the lifetime of
 * the screen — `primeAudio` is a no-op on a running context — and the
 * foreground return is covered too, because that is exactly when iOS has just
 * suspended us and the player is not necessarily about to tap anything.
 *
 * Returns its own teardown, so a caller can drop it in a `useEffect`.
 */
export function installAudioUnlock(): () => void {
    if (typeof window === "undefined") return () => {}
    const unlock = (): void => primeAudio()
    const onVisible = (): void => {
        if (document.visibilityState === "visible") primeAudio()
    }
    window.addEventListener("pointerdown", unlock, { passive: true })
    window.addEventListener("keydown", unlock)
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("pageshow", unlock)
    return () => {
        window.removeEventListener("pointerdown", unlock)
        window.removeEventListener("keydown", unlock)
        document.removeEventListener("visibilitychange", onVisible)
        window.removeEventListener("pageshow", unlock)
    }
}

/**
 * Play a sound using WebAudio.
 *
 * iOS (2026-09-20, user report: "na pwa na ios ne rade zvukovi") needs two
 * things this used to get wrong:
 *
 *   1. `resume()` is ASYNCHRONOUS. The very tap that unlocks the context —
 *      "Pokreni igru", the first card — used to be voiced in the same tick,
 *      while the state was still "suspended", and the cue was dropped on the
 *      floor. A context that is not running now gets resumed and the cue is
 *      rendered when that lands, as long as it lands promptly (`STALE_MS`) —
 *      a cue that arrives a second late is worse than no cue.
 *   2. iOS SUSPENDS the context whenever the PWA is backgrounded (and moves
 *      it to Safari's own "interrupted" state during a call). Everything but
 *      "running" is therefore treated as "needs a resume", not as "give up",
 *      and `installAudioUnlock` below keeps re-priming on every gesture and
 *      on the return to the foreground rather than only on the first tap.
 *
 * What this does NOT fix is the iPhone's ring/silent switch: Web Audio plays
 * in the "ambient" session, which that switch mutes. Overriding it needs
 * `navigator.audioSession.type = "playback"`, which also interrupts whatever
 * the player is listening to — deliberately not done (2026-09-20).
 */
const STALE_MS = 400

export function playSound(sound: GameSound): void {
    if (!getGamePrefs().sound) return
    const ctx = ensureContext()
    if (!ctx) return
    preloadSounds()
    if (ctx.state === "running") {
        renderSound(ctx, sound)
        return
    }
    const asked = Date.now()
    ctx.resume().then(
        () => {
            if (ctx.state !== "running") return
            if (Date.now() - asked > STALE_MS) return
            renderSound(ctx, sound)
        },
        () => {
            // Only a user gesture may resume; the next one will.
        },
    )
}

/** The cue itself, on a context that is known to be running. */
function renderSound(ctx: AudioContext, sound: GameSound): void {
    const now = ctx.currentTime

    // Shared output for this cue. Each voice below owns its attack/decay
    // envelope; this node must remain open or it multiplies every envelope by
    // zero and makes the complete cue inaudible.
    const out = ctx.createGain()
    out.connect(ctx.destination)
    out.gain.setValueAtTime(1, now)

    switch (sound) {
        case "seatJoin":
            /* Somebody sat down — a player who joined the room or a bot that
               was added (2026-09-20, user request). Two soft notes, a fifth
               apart and quieter than anything else here: it fires while the
               room is being filled, possibly four times in a row, so it has
               to be a nudge rather than an announcement. Lower and warmer
               than `gameLaunch`, which answers the tap that follows it. */
            playBell(ctx, out, now, 587.33, 0.18, 0.05)
            playBell(ctx, out, now + 0.07, 880.0, 0.3, 0.06)
            break

        case "seatLeave":
            /* Somebody left the room (2026-09-20, user request): the mirror of
               `seatJoin` — the same two soft notes, but falling, and a shade
               shorter, so "in" and "out" are told apart by direction alone. */
            playBell(ctx, out, now, 880.0, 0.16, 0.05)
            playBell(ctx, out, now + 0.07, 587.33, 0.22, 0.05)
            break

        case "turnTick":
        case "turnTickLast": {
            /* "Požuri" (2026-09-20, user request): a quiet clock tick at 3, 2
               and 1 s before MY turn runs out — the stand-in for the haptic
               tick on iOS Safari/PWA, which has no Vibration API. A 45 ms
               woodblock, well under every other cue; the LAST one sits a
               fourth higher, so the ear hears "now" without it getting louder. */
            const pitch = sound === "turnTickLast" ? 1320.0 : 990.0
            playTone(ctx, out, now, pitch, 0.045, 0.045, "sine")
            playTone(ctx, out, now, pitch / 2, 0.06, 0.03, "triangle")
            break
        }

        case "gameLaunch":
            /* The tap on "Pokreni igru" (2026-09-20, user request). Short and
               bright — two rising bell notes — so it reads as "yes, off we
               go" and is over before the shuffle of the first deal (which is
               `gameStart`, a moment later) starts underneath it. It is also
               the first sound of a session for most players, and a tap is a
               user gesture, so this is where the audio context unlocks. */
            playBell(ctx, out, now, 659.25, 0.22, 0.09)
            playBell(ctx, out, now + 0.09, 987.77, 0.5, 0.1)
            break

        case "gameStart":
            if (shuffleBuffer) playBuffer(ctx, out, now, shuffleBuffer)
            else playShuffle(ctx, out, now)
            break

        case "card": {
            const buffer = pickCardBuffer()
            if (buffer) playBuffer(ctx, out, now, buffer, 0, 0, CARD_LEVEL)
            else playCardSnap(ctx, out, now)
            break
        }

        case "gameWon": {
            // C major arpeggio up to the octave, bell voiced, last note rings.
            const notes = [523.25, 659.25, 783.99, 1046.5]
            notes.forEach((frequency, i) => {
                const last = i === notes.length - 1
                playBell(ctx, out, now + i * 0.11, frequency, last ? 0.9 : 0.35, last ? 0.13 : 0.1)
            })
            // The fifth under the final note turns it into a chord.
            playBell(ctx, out, now + 0.33, 783.99, 0.9, 0.06)
            break
        }

        case "gameLost":
            // Slow, low, minor and falling: G4 – E♭4 – C4. Triangle voice
            // without the bell's bright partials, so it is dull where the win
            // is shiny — different in pitch, tempo AND timbre.
            playTone(ctx, out, now, 392.0, 0.32, 0.1, "triangle")
            playTone(ctx, out, now + 0.24, 311.13, 0.32, 0.1, "triangle")
            playTone(ctx, out, now + 0.48, 261.63, 0.9, 0.11, "triangle")
            playTone(ctx, out, now + 0.48, 130.81, 0.9, 0.07, "sine")
            break
    }
}

/** ±`spread` around 1, so a cue repeated thirty-two times a deal never
 *  sounds like the same sample on a loop. */
function vary(spread: number): number {
    return 1 + (Math.random() * 2 - 1) * spread
}

/** The recorded card sample, or null while it is not decoded (synth then). */
function pickCardBuffer(): AudioBuffer | null {
    return cardBuffers?.[0] ?? null
}

/** Play a decoded sample through its own gain node, with optional
 *  playback-rate and gain jitter (both ± the given fraction). */
function playBuffer(
    ctx: AudioContext,
    output: AudioNode,
    startTime: number,
    buffer: AudioBuffer,
    rateSpread = 0,
    gainSpread = 0,
    level = 1,
): void {
    try {
        const source = ctx.createBufferSource()
        const gain = ctx.createGain()
        source.buffer = buffer
        source.playbackRate.setValueAtTime(rateSpread ? vary(rateSpread) : 1, startTime)
        gain.gain.setValueAtTime(level * (gainSpread ? vary(gainSpread) : 1), startTime)
        source.connect(gain)
        gain.connect(output)
        source.start(startTime)
        activeBufferSources.push(source)
        source.onended = () => {
            const index = activeBufferSources.indexOf(source)
            if (index >= 0) activeBufferSources.splice(index, 1)
        }
    } catch {
        // Buffer playback failed (rare) — skip the cue rather than risk a
        // synth fallback stacking on top of a partially started sample.
    }
}

/** One burst of filtered white noise with a fast attack and an exponential
 *  tail — the raw material of every synthesised paper sound here. */
function playNoise(
    ctx: AudioContext,
    output: AudioNode,
    startTime: number,
    duration: number,
    peakGain: number,
    filterType: BiquadFilterType,
    fromHz: number,
    toHz: number,
    q = 0.8,
    attack = 0.002,
): void {
    try {
        const frameCount = Math.max(1, Math.ceil(ctx.sampleRate * duration))
        const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate)
        const samples = buffer.getChannelData(0)
        for (let i = 0; i < frameCount; i += 1) samples[i] = Math.random() * 2 - 1

        const source = ctx.createBufferSource()
        const filter = ctx.createBiquadFilter()
        const gain = ctx.createGain()
        const endTime = startTime + duration

        source.buffer = buffer
        filter.type = filterType
        filter.Q.setValueAtTime(q, startTime)
        filter.frequency.setValueAtTime(fromHz, startTime)
        filter.frequency.exponentialRampToValueAtTime(toHz, endTime)

        gain.gain.setValueAtTime(0.0001, startTime)
        gain.gain.linearRampToValueAtTime(peakGain, startTime + attack)
        gain.gain.exponentialRampToValueAtTime(0.0001, endTime)

        source.connect(filter)
        filter.connect(gain)
        gain.connect(output)
        source.start(startTime)
        source.stop(endTime)
    } catch {
        // WebAudio unavailable for this cue — keep the game uninterrupted.
    }
}

/** A card thrown on a table, in the three parts a real one has: the faint
 *  hiss of it sliding through the air, the sharp paper SNAP of the edge
 *  landing, and the short dull knock of the table underneath. Synthesised
 *  fallback for `playSound("card")` — see the file header for when this runs
 *  instead of the recorded samples. */
function playCardSnap(ctx: AudioContext, output: AudioNode, startTime: number): void {
    const pitch = vary(0.12)
    const level = vary(0.15)
    const impact = startTime + 0.035

    // Slide: quiet, rising band-passed hiss leading into the impact.
    playNoise(ctx, output, startTime, 0.04, 0.025 * level, "bandpass", 1_800 * pitch, 3_800 * pitch, 0.9, 0.03)
    // Snap: very short and bright — this is the part the ear calls "card".
    playNoise(ctx, output, impact, 0.022, 0.16 * level, "bandpass", 3_400 * pitch, 2_200 * pitch, 1.4, 0.001)
    // Body: the flat of the card slapping down.
    playNoise(ctx, output, impact, 0.07, 0.12 * level, "lowpass", 900 * pitch, 260 * pitch, 0.7, 0.002)
    // Table: a knock so low and short it is felt more than heard.
    playTone(ctx, output, impact, 95 * pitch, 0.06, 0.05 * level, "sine")
}

/** A riffle shuffle and the deck squared on the table: a run of tiny paper
 *  ticks that speeds up, then one soft knock. Synthesised fallback for
 *  `playSound("gameStart")` — see the file header for when this runs instead
 *  of the recorded sample. */
function playShuffle(ctx: AudioContext, output: AudioNode, startTime: number): void {
    let t = startTime
    let gap = 0.034
    for (let i = 0; i < 18; i += 1) {
        const pitch = vary(0.2)
        playNoise(ctx, output, t, 0.014, 0.07 * vary(0.3), "bandpass", 3_000 * pitch, 2_000 * pitch, 1.2, 0.001)
        t += gap * vary(0.25)
        gap = Math.max(0.012, gap * 0.93)
    }
    // Bridge: the cards falling together.
    playNoise(ctx, output, t + 0.03, 0.16, 0.05, "bandpass", 1_400, 2_600, 0.8, 0.08)
    // Deck tapped square.
    const tap = t + 0.24
    playNoise(ctx, output, tap, 0.06, 0.13, "lowpass", 1_000, 300, 0.7, 0.002)
    playTone(ctx, output, tap, 110, 0.07, 0.06, "sine")
}

/** A bell-like note: the fundamental plus two quieter, faster-dying partials. */
function playBell(
    ctx: AudioContext,
    output: AudioNode,
    startTime: number,
    frequency: number,
    duration: number,
    peakGain: number,
): void {
    playTone(ctx, output, startTime, frequency, duration, peakGain, "sine")
    playTone(ctx, output, startTime, frequency * 2, duration * 0.6, peakGain * 0.3, "sine")
    playTone(ctx, output, startTime, frequency * 3.01, duration * 0.35, peakGain * 0.12, "sine")
}

/** Play one oscillator note with an envelope. `duration` is in SECONDS. */
function playTone(
    ctx: AudioContext,
    output: AudioNode,
    startTime: number,
    frequency: number,
    duration: number,
    peakGain: number,
    type: OscillatorType,
): void {
    try {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = type
        osc.frequency.setValueAtTime(frequency, startTime)
        osc.connect(gain)
        gain.connect(output)

        // Quick attack (5 ms) + decay to silence.
        const decayEnd = startTime + duration

        gain.gain.setValueAtTime(0.0001, startTime)
        gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.005)
        gain.gain.exponentialRampToValueAtTime(0.0001, decayEnd)

        osc.start(startTime)
        osc.stop(decayEnd)
        activeOscillators.push(osc)
        osc.onended = () => {
            const index = activeOscillators.indexOf(osc)
            if (index >= 0) activeOscillators.splice(index, 1)
        }
    } catch {
        // AudioContext error — bail silently.
    }
}
