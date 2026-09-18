import Foundation
#if canImport(ActivityKit)
import ActivityKit

/**
 * The Live Activity type for a running bela online game.
 *
 * TARGET MEMBERSHIP: this file must belong to BOTH the `App` target (where
 * `BelaLiveActivityPlugin` requests/updates/ends the activity) AND the
 * future `BelaActivity` widget-extension target (where the SwiftUI
 * lock-screen / Dynamic Island views render it). ActivityKit matches the two
 * sides by this type, so both must compile the exact same definition. It is
 * the ONLY file the two targets share.
 */
@available(iOS 16.1, *)
struct BelaActivityAttributes: ActivityAttributes {
    /**
     * Mirrors `LiveActivityState` in `game/packages/protocol/src/index.ts`
     * field for field. The backend (`LiveActivitySender.contentState`) sends
     * that same JSON to APNs as `aps.content-state`, and ActivityKit decodes
     * it straight into this struct with `JSONDecoder`.
     *
     * DO NOT RENAME ANY PROPERTY OR CHANGE ITS TYPE. One mismatched name or
     * type and every push-driven update silently fails to decode on the
     * phone: no error reaches the app, the lock screen just stops updating.
     */
    public struct ContentState: Codable, Hashable {
        var roomId: String
        /** "bidding" | "playing" | "dealDone" | "gameOver" */
        var phase: String
        var scoreUs: Int
        var scoreThem: Int
        var target: Int
        var yourTurn: Bool
        var turnSeat: Int?
        /** Epoch MILLISECONDS, kept exactly as sent. Use `turnDeadlineDate`. */
        var turnDeadline: Double?
        var trump: String?
        /** "us" | "them" | nil */
        var winner: String?

        /** `turnDeadline` as a `Date` (for `Text(timerInterval:)` etc.). */
        var turnDeadlineDate: Date? {
            turnDeadline.map { Date(timeIntervalSince1970: $0 / 1000) }
        }
    }

    /** Static for the activity's lifetime: the game room it follows. */
    var roomId: String
}
#endif
