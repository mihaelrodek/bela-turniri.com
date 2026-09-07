/* ──────────────────────────────────────────────────────────────────────────
   Game sounds — WebAudio only, no audio files (game/DESIGN.md §2.10).
   Respects `useGamePrefs().sound`. STUB: the settings agent fills this in;
   the table already calls `playSound(...)` so the wiring is in place.
   ────────────────────────────────────────────────────────────────────── */

import { getGamePrefs } from "../hooks/useGamePrefs"

interface WebKitGlobal {
    webkitAudioContext?: typeof AudioContext
}

export type GameSound = "deal" | "card" | "trick" | "yourTurn" | "bela" | "win" | "lose"

let audioContext: AudioContext | null = null
const activeOscillators: OscillatorNode[] = []

/** Lazily create and resume the AudioContext. Called from user gestures to unlock iOS. */
export function primeAudio(): void {
    if (audioContext) return
    try {
        const AC = typeof AudioContext !== "undefined" ? AudioContext : (globalThis as unknown as WebKitGlobal).webkitAudioContext
        if (!AC) return
        const ctx = new AC()
        audioContext = ctx
        if (ctx.state === "suspended") {
            ctx.resume().catch(() => {
                // iOS may reject the resume if not called from a user gesture.
            })
        }
    } catch {
        // AudioContext unavailable (SSR, old browser).
    }
}

/** Stop all active oscillators. */
export function stopAllSounds(): void {
    activeOscillators.forEach((osc) => {
        try {
            osc.stop()
        } catch {
            // Already stopped.
        }
    })
    activeOscillators.length = 0
}

/** Play a sound using WebAudio. */
export function playSound(sound: GameSound): void {
    if (!getGamePrefs().sound) return
    if (!audioContext) primeAudio()
    if (!audioContext || audioContext.state === "suspended") return

    const ctx = audioContext
    const now = ctx.currentTime

    // Create a gain node with a quick attack/decay envelope (≤ 250 ms, gain ≤ 0.25).
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0, now)

    switch (sound) {
        case "deal":
            // 3 quick soft ticks: short bursts of white noise.
            playTicks(ctx, gain, now, 3, 50, 0.15)
            break

        case "card":
            // One soft "tock": low sine 180 Hz, 60 ms.
            playSine(ctx, gain, now, 180, 60, 0.15)
            break

        case "trick":
            // Two-note upward blip: 440 Hz → 600 Hz, 80 ms each.
            playSine(ctx, gain, now, 440, 80, 0.15)
            playSine(ctx, gain, now + 85, 600, 80, 0.15)
            break

        case "yourTurn":
            // Gentle two-tone chime: 660 Hz → 880 Hz, 100 ms each.
            playSine(ctx, gain, now, 660, 100, 0.12)
            playSine(ctx, gain, now + 105, 880, 100, 0.12)
            break

        case "bela":
            // Bright three-note arpeggio: 523 Hz (C) → 659 Hz (E) → 784 Hz (G), 60 ms each.
            playSine(ctx, gain, now, 523, 60, 0.15)
            playSine(ctx, gain, now + 65, 659, 60, 0.15)
            playSine(ctx, gain, now + 130, 784, 60, 0.15)
            break

        case "win":
            // Short major arpeggio: 261 Hz (C) → 329 Hz (E) → 392 Hz (G), 70 ms each.
            playSine(ctx, gain, now, 261, 70, 0.15)
            playSine(ctx, gain, now + 75, 329, 70, 0.15)
            playSine(ctx, gain, now + 150, 392, 70, 0.15)
            break

        case "lose":
            // Short descending minor: 392 Hz (G) → 329 Hz (E) → 261 Hz (C), 70 ms each.
            playSine(ctx, gain, now, 392, 70, 0.15)
            playSine(ctx, gain, now + 75, 329, 70, 0.15)
            playSine(ctx, gain, now + 150, 261, 70, 0.15)
            break
    }
}

/** Play a sine wave with an envelope. */
function playSine(
    ctx: AudioContext,
    gainNode: GainNode,
    startTime: number,
    frequency: number,
    durationMs: number,
    peakGain: number,
): void {
    try {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = "sine"
        osc.frequency.setValueAtTime(frequency, startTime)
        osc.connect(gain)
        gain.connect(gainNode)

        // Quick attack (5 ms) + decay to silence.
        const attackEnd = startTime + 0.005
        const decayEnd = startTime + durationMs / 1000

        gain.gain.setValueAtTime(0, startTime)
        gain.gain.linearRampToValueAtTime(peakGain, attackEnd)
        gain.gain.exponentialRampToValueAtTime(0.001, decayEnd)

        osc.start(startTime)
        osc.stop(decayEnd)
        activeOscillators.push(osc)
    } catch {
        // AudioContext error — bail silently.
    }
}

/** Play white noise ticks. */
function playTicks(
    ctx: AudioContext,
    gainNode: GainNode,
    startTime: number,
    count: number,
    durationMs: number,
    peakGain: number,
): void {
    try {
        for (let i = 0; i < count; i++) {
            const tickStart = startTime + (i * (durationMs + 20)) / 1000
            playNoiseBurst(ctx, gainNode, tickStart, durationMs, peakGain)
        }
    } catch {
        // AudioContext error — bail silently.
    }
}

/** Play a short burst of white noise. */
function playNoiseBurst(
    ctx: AudioContext,
    gainNode: GainNode,
    startTime: number,
    durationMs: number,
    peakGain: number,
): void {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * (durationMs / 1000), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1
    }

    const source = ctx.createBufferSource()
    const gain = ctx.createGain()

    source.buffer = buffer
    source.connect(gain)
    gain.connect(gainNode)

    // Quick envelope.
    const attackEnd = startTime + 0.005
    const decayEnd = startTime + durationMs / 1000

    gain.gain.setValueAtTime(0, startTime)
    gain.gain.linearRampToValueAtTime(peakGain, attackEnd)
    gain.gain.exponentialRampToValueAtTime(0.001, decayEnd)

    source.start(startTime)
    source.stop(decayEnd)
}
