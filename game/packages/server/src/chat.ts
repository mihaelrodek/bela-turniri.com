/* Room chat (README §3 "Chat"): trim, cap at LIMITS.chatMax, fan out to the room.
   Also `chat.react` (protocol §2.9): a rate-limited emoji reaction broadcast, no
   history kept — it is a transient toast next to the sender's seat. */

import { LIMITS } from "@bela/protocol"
import type { ChatMessage, Reaction } from "@bela/protocol"
import { ProtocolError } from "./errors.js"
import { newChatId } from "./ids.js"
import type { Room } from "./room.js"
import type { Connection } from "./ws.js"

export function sanitizeChatText(raw: unknown): string {
    if (typeof raw !== "string") {
        throw new ProtocolError("BAD_REQUEST", "Poruka mora biti tekst.")
    }
    // Strip control characters that would break the UI, then cap the length.
    const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, " ").trim()
    if (cleaned.length === 0) {
        throw new ProtocolError("BAD_REQUEST", "Poruka je prazna.")
    }
    return cleaned.slice(0, LIMITS.chatMax)
}

export function handleChat(room: Room, conn: Connection, raw: unknown): ChatMessage {
    const user = conn.user
    if (!user) throw new ProtocolError("UNAUTHENTICATED")
    const text = sanitizeChatText(raw)
    const msg: ChatMessage = {
        id: newChatId(),
        from: user,
        text,
        at: Date.now(),
    }
    room.broadcast({ t: "chat.msg", msg })
    return msg
}

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
