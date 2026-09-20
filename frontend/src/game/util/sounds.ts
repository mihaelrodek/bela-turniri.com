/* ──────────────────────────────────────────────────────────────────────────
   Game sounds — WebAudio only, no audio files (game/DESIGN.md §2.10).
   Respects `useGamePrefs().sound`. The first set stays intentionally small:
   a game start, a card on the table and a game finish.
   ────────────────────────────────────────────────────────────────────── */

import { getGamePrefs } from "../hooks/useGamePrefs"

interface WebKitGlobal {
    webkitAudioContext?: typeof AudioContext
}

export type GameSound = "gameStart" | "card" | "gameWon" | "gameLost"

let audioContext: AudioContext | null = null
const activeOscillators: OscillatorNode[] = []

/** Lazily create and resume the AudioContext. Called from user gestures to unlock iOS. */
export function primeAudio(): void {
    if (audioContext) {
        if (audioContext.state === "suspended") {
            audioContext.resume().catch(() => {
                // Browsers only permit this from a user gesture.
            })
        }
        return
    }
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

    // Shared output for this cue. Each oscillator below owns its attack/decay
    // envelope; this node must remain open or it multiplies every envelope by
    // zero and makes the complete cue inaudible.
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(1, now)

    switch (sound) {
        case "gameStart":
            // A short, warm rising cue: the game has started, not just a new
            // deal, so it should feel more distinct than a card on the felt.
            playSine(ctx, gain, now, 440, 80, 0.13)
            playSine(ctx, gain, now + 85, 554, 80, 0.13)
            playSine(ctx, gain, now + 170, 659, 120, 0.13)
            break

        case "card":
            playFeltCard(ctx, gain, now)
            break

        case "gameWon":
            // Clear major resolution for a win: positive without becoming a
            // long fanfare that would delay the result dialog.
            playSine(ctx, gain, now, 523, 80, 0.13)
            playSine(ctx, gain, now + 85, 659, 80, 0.13)
            playSine(ctx, gain, now + 170, 784, 150, 0.13)
            break

        case "gameLost":
            // A calm descending minor answer. It marks the result without
            // sounding harsh to someone who has just lost a close game.
            playSine(ctx, gain, now, 523, 90, 0.11)
            playSine(ctx, gain, now + 95, 440, 90, 0.11)
            playSine(ctx, gain, now + 190, 349, 140, 0.11)
            break
    }
}

/** A short, muted card impact: filtered noise supplies the felt texture and
 *  a quiet low body keeps it from sounding like digital static. */
function playFeltCard(ctx: AudioContext, output: GainNode, startTime: number): void {
    try {
        const duration = 0.065
        const frameCount = Math.ceil(ctx.sampleRate * duration)
        const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate)
        const samples = buffer.getChannelData(0)

        for (let i = 0; i < frameCount; i += 1) {
            const fade = 1 - i / frameCount
            samples[i] = (Math.random() * 2 - 1) * fade
        }

        const source = ctx.createBufferSource()
        const filter = ctx.createBiquadFilter()
        const gain = ctx.createGain()
        const endTime = startTime + duration

        source.buffer = buffer
        filter.type = "lowpass"
        filter.Q.setValueAtTime(0.7, startTime)
        filter.frequency.setValueAtTime(1_100, startTime)
        filter.frequency.exponentialRampToValueAtTime(420, endTime)

        gain.gain.setValueAtTime(0, startTime)
        gain.gain.linearRampToValueAtTime(0.085, startTime + 0.003)
        gain.gain.exponentialRampToValueAtTime(0.001, endTime)

        source.connect(filter)
        filter.connect(gain)
        gain.connect(output)
        source.start(startTime)
        source.stop(endTime)

        playSine(ctx, output, startTime, 125, 45, 0.04)
    } catch {
        // WebAudio unavailable for this cue — keep the game uninterrupted.
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
