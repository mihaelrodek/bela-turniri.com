package com.belaturniri.app

import org.json.JSONObject

/**
 * Native mirror of the ContentState contract shared with iOS/JS for the Live
 * Activity feature (N4.4). Parsing is defensive on purpose: this same shape
 * arrives both from the JS plugin call (start/update/end) and from an FCM
 * data push while the app is backgrounded or killed, and a malformed payload
 * on either path must never crash the caller.
 */
data class LiveGameState(
    val roomId: String,
    val phase: String,
    val scoreUs: Int,
    val scoreThem: Int,
    val target: Int,
    val yourTurn: Boolean,
    val turnSeat: Int?,
    val turnDeadline: Long?,
    val trump: String?,
    val winner: String?
) {
    companion object {
        const val PHASE_GAME_OVER = "gameOver"

        /** Returns null (never throws) when the payload can't yield a usable state. */
        fun fromJson(json: JSONObject?): LiveGameState? {
            if (json == null) return null
            val roomId = json.optString("roomId", "")
            if (roomId.isBlank()) return null

            return try {
                LiveGameState(
                    roomId = roomId,
                    phase = json.optString("phase", ""),
                    scoreUs = json.optInt("scoreUs", 0),
                    scoreThem = json.optInt("scoreThem", 0),
                    target = json.optInt("target", 0),
                    yourTurn = json.optBoolean("yourTurn", false),
                    turnSeat = optIntOrNull(json, "turnSeat"),
                    turnDeadline = optLongOrNull(json, "turnDeadline"),
                    trump = optStringOrNull(json, "trump"),
                    winner = optStringOrNull(json, "winner")
                )
            } catch (e: Exception) {
                // Defensive catch-all: a push we can't fully make sense of must
                // never crash the receiver (FCM background isolate or plugin call).
                null
            }
        }

        private fun optIntOrNull(json: JSONObject, key: String): Int? {
            if (!json.has(key) || json.isNull(key)) return null
            return json.optInt(key)
        }

        private fun optLongOrNull(json: JSONObject, key: String): Long? {
            if (!json.has(key) || json.isNull(key)) return null
            return json.optLong(key)
        }

        private fun optStringOrNull(json: JSONObject, key: String): String? {
            if (!json.has(key) || json.isNull(key)) return null
            val value = json.optString(key, "")
            return value.ifEmpty { null }
        }
    }
}
