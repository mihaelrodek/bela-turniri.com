/* Quick reactions (README §3 "Reakcije", protocol `chat.react`/`chat.reaction`):
   a rate-limited broadcast of one of the fixed `REACTIONS` emoji — no free
   text, no history kept. It is a transient toast next to the sender's seat.

   Free-text room chat (`chat.send`/`chat.msg`) existed here and was removed
   2026-09-20 (app-store review: no user-to-user free text). The wire names
   `chat.react`/`chat.reaction` are kept as-is for protocol compatibility even
   though this module no longer handles anything called "chat". */

import type { Reaction } from "@bela/protocol"
import { ProtocolError } from "./errors.js"
import type { Room } from "./room.js"
import type { Connection } from "./ws.js"

/** Broadcast a `chat.reaction`; the cooldown itself is enforced by the caller (`Conn.takeReaction`). */
export function handleReaction(room: Room, conn: Connection, reaction: Reaction): void {
    const user = conn.user
    if (!user) throw new ProtocolError("UNAUTHENTICATED")
    room.broadcast({
        t: "chat.reaction",
        from: user,
        seat: room.seatOfUid(user.uid),
        reaction,
        at: Date.now(),
    })
}
