/**
 * The in-room chat is OFF (2026-09-09, user request: "makni chat i zasada ga
 * neće biti").
 *
 * A flag rather than a deletion, and in one place rather than three: the
 * protocol still carries `chat.send` and `chat.message`, the server still
 * accepts and rate-limits them, and `Chat` / `ChatToggle` still work. What is
 * gone is every way INTO them from the room screen. Turning chat back on is
 * this one line; deleting the feature would have been a change to the wire.
 */
export const CHAT_ENABLED = false
