/* ──────────────────────────────────────────────────────────────────────────
   Giving a face to a player who never picked one.

   The 16 faces themselves live in `@bela/protocol` (`AVATAR_PRESETS`), which
   mirrors the artwork in `frontend/src/components/avatars/avatarArt.ts` and is
   APPEND-ONLY. This module is only the policy on top of that list.

   Why a guest gets one at all: a guest has no account and therefore no
   profile to keep a face in, and an empty seat and a faceless seat look far
   too much alike at a card table. Assigning one means every one of the four
   chairs always shows a person.

   Why it is DERIVED FROM THE UID rather than random: the guest uid is
   `guest:<sha256(secret)>`, stable for as long as the browser keeps its
   secret, so the same guest gets the same face on every reconnect, in every
   room, without anything being stored anywhere. A random pick would hand the
   same person a new face each time the socket dropped.
   ────────────────────────────────────────────────────────────────────── */

import { AVATAR_PRESETS } from "@bela/protocol"
import type { AvatarPreset } from "@bela/protocol"

/**
 * FNV-1a, 32-bit. Not a security primitive and does not need to be — it only
 * has to spread uids evenly over 16 buckets, and it is written out here so
 * this module keeps the zero-dependency, synchronous shape the callers want.
 */
function hash32(input: string): number {
    let h = 0x811c9dc5
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i)
        // `Math.imul` keeps the multiply in 32 bits; a plain `*` would lose
        // precision past 2^53 and make the hash platform-dependent.
        h = Math.imul(h, 0x01000193)
    }
    return h >>> 0
}

/** A stable face for `uid`. Same uid, same face, forever (see the header). */
export function avatarPresetForUid(uid: string): AvatarPreset {
    const preset = AVATAR_PRESETS[hash32(uid) % AVATAR_PRESETS.length]
    // `%` over a non-empty frozen tuple always lands in range; the fallback is
    // only here so the return type needs no assertion.
    return preset ?? AVATAR_PRESETS[0]
}
