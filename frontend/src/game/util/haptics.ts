import { isNative } from "../../platform"
import { nativeHaptics } from "../../platform/native"
import { getGamePrefs } from "../hooks/useGamePrefs"

/* ──────────────────────────────────────────────────────────────────────────
   Haptics at the table — the native apps' counterpart of `sounds.ts`.

   Deliberately gated by the SAME `sound` preference as the sounds: one switch
   in the settings sheet silences the table, and a phone that stopped beeping
   but kept buzzing would read as the switch being broken. Web builds never
   load the plugin (`isNative` first, then a lazy import).

   ONE cue also reaches the browser: `turnHurry`, through the Vibration API
   (2026-09-20, user request). That is Android only in practice — Safari has
   never shipped `navigator.vibrate`, so an iOS PWA stays still and only the
   native iOS app ticks — and a desktop simply has nothing to shake.

   Fire-and-forget: a vibration that fails is not worth anybody's attention.
   ────────────────────────────────────────────────────────────────────── */

export type HapticCue =
    /** It just became my turn to bid or play. */
    | "yourTurn"
    /** My team took the trick. */
    | "trickWon"
    /** Somebody called bela. */
    | "bela"
    /** My turn clock just entered its urgent quarter. */
    | "turnWarning"
    /** One light tick per second over the last seconds of MY turn. */
    | "turnHurry"
    | "gameOver"

export function playHaptic(cue: HapticCue): void {
    if (!getGamePrefs().sound) return
    if (!isNative) {
        if (cue !== "turnHurry") return
        try {
            // Needs a prior tap on the page (it has one: the player is
            // mid-game); returns false, never throws, where unsupported.
            if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(35)
        } catch {
            // A browser that blocks it — stay silent.
        }
        return
    }
    void (async () => {
        try {
            const { Haptics, ImpactStyle, NotificationType } = await nativeHaptics()
            switch (cue) {
                case "yourTurn": await Haptics.impact({ style: ImpactStyle.Light }); break
                case "trickWon":
                case "bela": await Haptics.notification({ type: NotificationType.Success }); break
                case "turnHurry": await Haptics.impact({ style: ImpactStyle.Light }); break
                case "turnWarning": await Haptics.notification({ type: NotificationType.Warning }); break
                case "gameOver": await Haptics.impact({ style: ImpactStyle.Heavy }); break
            }
        } catch {
            // No haptics engine, or the plugin is missing — stay silent.
        }
    })()
}
