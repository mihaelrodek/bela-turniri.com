package com.belaturniri.app.widget

import android.content.Context
import android.util.Log
import androidx.core.content.edit
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * One row of the "Nadolazeći turniri" widget (N5.3) — a trimmed mirror of
 * TournamentCard (frontend/src/types/tournaments.ts). Only the fields the
 * widget renders or links to are kept.
 */
data class WidgetTournament(
    val uuid: String,
    val slug: String?,
    val name: String,
    val startAt: String?,
    val location: String?
)

/**
 * Fetches/caches the public "upcoming tournaments" list for the home-screen
 * widget. The network call ([fetchUpcomingRaw]) is blocking and must only
 * ever be invoked from TournamentsWidgetWorker's WorkManager background
 * thread — never from AppWidgetProvider.onUpdate, which runs on the main
 * thread. [loadCached] is what the provider reads from instead.
 */
object TournamentsRepository {

    private const val TAG = "TournamentsWidget"
    private const val PREFS_NAME = "bela_widget_prefs"
    private const val KEY_CACHED_JSON = "cached_tournaments_json"
    private const val API_URL = "https://bela-turniri.com/api/tournaments?status=upcoming&limit=3"
    private const val CONNECT_TIMEOUT_MS = 8000
    private const val READ_TIMEOUT_MS = 8000

    /** Blocking network call — caller must already be off the main thread. */
    fun fetchUpcomingRaw(): String? {
        var connection: HttpURLConnection? = null
        return try {
            connection = (URL(API_URL).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = CONNECT_TIMEOUT_MS
                readTimeout = READ_TIMEOUT_MS
                setRequestProperty("Accept", "application/json")
            }
            val code = connection.responseCode
            if (code !in 200..299) {
                Log.w(TAG, "Unexpected response code $code")
                return null
            }
            connection.inputStream.bufferedReader().use { it.readText() }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to fetch upcoming tournaments", e)
            null
        } finally {
            connection?.disconnect()
        }
    }

    /** Throws on malformed JSON — callers decide whether that means retry or empty. */
    fun parseTournaments(json: String): List<WidgetTournament> {
        val array = JSONArray(json)
        val result = ArrayList<WidgetTournament>(array.length())
        for (i in 0 until array.length()) {
            val obj = array.optJSONObject(i) ?: continue
            val uuid = optStringOrNull(obj, "uuid") ?: continue
            val name = optStringOrNull(obj, "name") ?: continue
            result.add(
                WidgetTournament(
                    uuid = uuid,
                    slug = optStringOrNull(obj, "slug"),
                    name = name,
                    startAt = optStringOrNull(obj, "startAt"),
                    location = optStringOrNull(obj, "location")
                )
            )
        }
        return result
    }

    fun saveCache(context: Context, json: String) {
        prefs(context).edit { putString(KEY_CACHED_JSON, json) }
    }

    /** Never throws — a missing or corrupt cache just means "show the empty state". */
    fun loadCached(context: Context): List<WidgetTournament> {
        val json = prefs(context).getString(KEY_CACHED_JSON, null) ?: return emptyList()
        return try {
            parseTournaments(json)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse cached tournaments", e)
            emptyList()
        }
    }

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    // Mirrors LiveGameState.kt's optStringOrNull — kept as a private local
    // copy so this package stays self-contained (LiveGameState.kt belongs to
    // a different in-flight task and is not to be touched here).
    private fun optStringOrNull(json: JSONObject, key: String): String? {
        if (!json.has(key) || json.isNull(key)) return null
        val value = json.optString(key, "")
        return value.ifEmpty { null }
    }
}
