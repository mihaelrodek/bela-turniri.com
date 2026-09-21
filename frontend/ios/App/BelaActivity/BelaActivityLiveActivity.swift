import ActivityKit
import WidgetKit
import SwiftUI

/**
 * SwiftUI Live Activity for a running bela online game (N4.1b).
 *
 * This file is the whole `BelaActivity` widget-extension target (created by
 * `frontend/scripts/add-live-activity-target.rb`). It depends only on
 * `BelaActivityAttributes` — the one file shared with the `App` target, read
 * only from here — and on the iOS SDK; nothing reaches into app code.
 * `BelaActivityBundle` below is the extension's `@main` entry point.
 *
 * Every user-facing string lives in `L10n` below: widget extensions cannot
 * share the web app's `hr`/`sl` dictionaries (`src/i18n`), so Croatian is
 * hard-coded on purpose, but kept in one place for whoever adds Slovenian
 * later.
 */

// MARK: - Strings

private enum L10n {
    static let usAbbrev = "MI"
    static let themAbbrev = "VI"
    static let yourTurn = "Tvoj red"
    static let bidding = "Licitacija"
    static let dealDone = "Kraj podjele"
    static let victory = "Pobjeda \u{1F389}"
    static let defeat = "Poraz"
    static let gameOver = "Kraj igre"
    static let waitingForUpdate = "Čeka ažuriranje"
    static func turnOf(seat: Int) -> String { "Na potezu: igrač \(seat)" }
    static func target(_ n: Int) -> String { "do \(n)" }
}

// MARK: - Brand palette (frontend/CLAUDE.md: felt green / deep / mađarice red / gold / cream)

private extension Color {
    static let feltGreen = Color(red: 0x2F / 255, green: 0x8F / 255, blue: 0x52 / 255)
    static let deepGreen = Color(red: 0x1E / 255, green: 0x5C / 255, blue: 0x36 / 255)
    static let madjariceRed = Color(red: 0xB4 / 255, green: 0x34 / 255, blue: 0x2A / 255)
    static let gold = Color(red: 0xD9 / 255, green: 0xA5 / 255, blue: 0x21 / 255)
    static let cream = Color(red: 0xF6 / 255, green: 0xEF / 255, blue: 0xE0 / 255)
    static let acornBrown = Color(red: 0x7A / 255, green: 0x4A / 255, blue: 0x1D / 255)
}

// MARK: - Trump glyph

/**
 * `trump` is one of the engine's `Suit` values (`game/packages/engine/src/types.ts`:
 * "HERC" | "KARA" | "PIK" | "TREF"), which the app always PRESENTS as the
 * mađarice (Hungarian) suits per `frontend/src/game/util/cards.ts`:
 * HERC → srce (heart, red), KARA → bundeva (bell, gold),
 * PIK → list (leaf, green), TREF → žir (acorn, brown).
 *
 * SF Symbols cover three of the four directly (`heart.fill`, `bell.fill`,
 * `leaf.fill`); there is no acorn glyph in SF Symbols, so žir is a small
 * hand-drawn cap-and-nut shape instead, per the task brief.
 */
private struct TrumpGlyph: View {
    let trump: String?

    var body: some View {
        switch trump {
        case "HERC":
            Image(systemName: "heart.fill").foregroundStyle(Color.madjariceRed)
        case "KARA":
            Image(systemName: "bell.fill").foregroundStyle(Color.gold)
        case "PIK":
            Image(systemName: "leaf.fill").foregroundStyle(Color.feltGreen)
        case "TREF":
            AcornGlyph().foregroundStyle(Color.acornBrown)
        default:
            Color.clear.frame(width: 1, height: 1)
        }
    }
}

/** Hand-drawn žir (acorn): a round nut under a short capsule cap. */
private struct AcornGlyph: View {
    var body: some View {
        VStack(spacing: -2) {
            Capsule().frame(width: 10, height: 5)
            Circle().frame(width: 11, height: 11)
        }
    }
}

// MARK: - Shared status text (phase → label, both surfaces)

private func statusLabel(for state: BelaActivityAttributes.ContentState) -> String {
    switch state.phase {
    case "bidding":
        return L10n.bidding
    case "dealDone":
        return L10n.dealDone
    case "gameOver":
        switch state.winner {
        case "us": return L10n.victory
        case "them": return L10n.defeat
        default: return L10n.gameOver
        }
    default: // "playing"
        return state.yourTurn ? L10n.yourTurn : L10n.turnOf(seat: (state.turnSeat ?? 0) + 1)
    }
}

/** `true` only when a live "Tvoj red" countdown should render instead of the plain label. */
private func hasLiveCountdown(_ state: BelaActivityAttributes.ContentState) -> Bool {
    guard state.phase == "playing", state.yourTurn, let deadline = state.turnDeadlineDate else { return false }
    return deadline > .now
}

// MARK: - Lock screen / banner

@available(iOS 16.2, *)
private struct LockScreenView: View {
    let state: BelaActivityAttributes.ContentState
    let isStale: Bool

    var body: some View {
        HStack(spacing: 10) {
            scoreColumn(label: L10n.usAbbrev, score: state.scoreUs)
            Spacer(minLength: 2)
            TrumpGlyph(trump: state.trump).font(.title2).frame(width: 26)
            Spacer(minLength: 2)
            statusColumn
            Spacer(minLength: 2)
            scoreColumn(label: L10n.themAbbrev, score: state.scoreThem)
        }
        .padding(14)
        .background(Color.feltGreen)
    }

    private func scoreColumn(label: String, score: Int) -> some View {
        VStack(spacing: 2) {
            Text(label).font(.caption2).foregroundStyle(Color.cream.opacity(0.75))
            Text("\(score)").font(.title2).bold().foregroundStyle(Color.cream)
            Text(L10n.target(state.target)).font(.caption2).foregroundStyle(Color.cream.opacity(0.6))
        }
    }

    @ViewBuilder
    private var statusColumn: some View {
        VStack(alignment: .trailing, spacing: 2) {
            if isStale {
                Text(L10n.waitingForUpdate)
                    .font(.caption)
                    .foregroundStyle(Color.cream.opacity(0.5))
            } else if hasLiveCountdown(state), let deadline = state.turnDeadlineDate {
                Text(L10n.yourTurn).font(.caption).bold().foregroundStyle(Color.gold)
                Text(timerInterval: Date.now...deadline, countsDown: true)
                    .font(.caption2).monospacedDigit().foregroundStyle(Color.gold)
            } else {
                Text(statusLabel(for: state))
                    .font(.caption)
                    .bold(state.yourTurn || state.phase == "gameOver")
                    .foregroundStyle(state.yourTurn ? Color.gold : Color.cream)
            }
        }
        .frame(minWidth: 88)
    }
}

// MARK: - Dynamic Island

@available(iOS 16.2, *)
private struct CompactTrailing: View {
    let state: BelaActivityAttributes.ContentState

    var body: some View {
        if hasLiveCountdown(state), let deadline = state.turnDeadlineDate {
            Text(timerInterval: Date.now...deadline, countsDown: true)
                .font(.caption2).monospacedDigit().foregroundStyle(Color.gold)
        } else {
            Text("\(L10n.themAbbrev) \(state.scoreThem)").font(.caption2).foregroundStyle(.white)
        }
    }
}

@available(iOS 16.2, *)
private struct ExpandedLeading: View {
    let state: BelaActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(L10n.usAbbrev) \(state.scoreUs)").font(.headline).foregroundStyle(Color.cream)
            Text("\(L10n.themAbbrev) \(state.scoreThem)").font(.subheadline).foregroundStyle(Color.cream.opacity(0.75))
        }
    }
}

@available(iOS 16.2, *)
private struct ExpandedTrailing: View {
    let state: BelaActivityAttributes.ContentState
    let isStale: Bool

    var body: some View {
        VStack(alignment: .trailing, spacing: 2) {
            if isStale {
                Text(L10n.waitingForUpdate).font(.caption2).foregroundStyle(.secondary)
            } else if hasLiveCountdown(state), let deadline = state.turnDeadlineDate {
                Text(L10n.yourTurn).font(.caption).bold().foregroundStyle(Color.gold)
                Text(timerInterval: Date.now...deadline, countsDown: true)
                    .font(.caption2).monospacedDigit()
            } else {
                Text(statusLabel(for: state))
                    .font(.caption)
                    .foregroundStyle(state.yourTurn ? Color.gold : .primary)
            }
        }
    }
}

/** Bottom expanded region: `scoreUs` / `target` in gold over deep green. */
@available(iOS 16.2, *)
private struct ProgressBar: View {
    let state: BelaActivityAttributes.ContentState

    private var fraction: CGFloat {
        guard state.target > 0 else { return 0 }
        return min(1, max(0, CGFloat(state.scoreUs) / CGFloat(state.target)))
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.deepGreen)
                Capsule().fill(Color.gold).frame(width: geo.size.width * fraction)
            }
        }
        .frame(height: 6)
    }
}

// MARK: - Widget

/**
 * The one configuration, factored out of the widget structs so the iOS 18.4
 * `supplementalActivityFamilies` variant below can reuse it verbatim.
 *
 * `context.isStale` flips to true once the `staleDate` the app set on the
 * content passes (`BelaLiveActivityPlugin` sets it to "now + 15 min", the
 * same window the backend's remote `end` uses). Every surface below then
 * shows "Čeka ažuriranje" instead of a score/timer that is quietly wrong —
 * which is exactly what a Live Activity is required to do when its data can
 * no longer be trusted.
 */
@available(iOS 16.2, *)
private func belaActivityConfiguration() -> some WidgetConfiguration {
        ActivityConfiguration(for: BelaActivityAttributes.self) { context in
            LockScreenView(state: context.state, isStale: context.isStale)
                .activityBackgroundTint(Color.deepGreen)
                .activitySystemActionForegroundColor(Color.cream)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    ExpandedLeading(state: context.state)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ExpandedTrailing(state: context.state, isStale: context.isStale)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ProgressBar(state: context.state)
                }
            } compactLeading: {
                Text("\(L10n.usAbbrev) \(context.state.scoreUs)")
                    .font(.caption2).bold().foregroundStyle(.white)
            } compactTrailing: {
                CompactTrailing(state: context.state)
            } minimal: {
                TrumpGlyph(trump: context.state.trump)
            }
        }
}

/** Plain widget — everything down to iOS 16.2. */
@available(iOS 16.2, *)
struct BelaActivityLiveActivity: Widget {
    var body: some WidgetConfiguration { belaActivityConfiguration() }
}

// MARK: - Extension entry point

/**
 * `@main` for the `BelaActivity` widget extension. A widget extension with
 * no `WidgetBundle` (or `@main Widget`) builds but registers NOTHING, and
 * the Live Activity then never draws no matter how well the app requests it.
 *
 * ── Why there is no `.supplementalActivityFamilies([.small])` here ──
 * That modifier (Apple Watch Smart Stack / small surfaces) is iOS 18.0+,
 * while this extension deploys to 16.2 so Live Activities keep working on
 * iOS 16.2–17.x. Offering it only on 18+ would need a runtime either/or
 * between two widgets, and `WidgetBundleBuilder` cannot express one: its
 * `buildOptional` is explicitly `@available(*, unavailable, message: "if
 * statements in a WidgetBundleBuilder can only be used with #available
 * clauses")`, there is no `buildEither`, and a function returning
 * `some WidgetConfiguration` cannot return two different opaque types.
 * Registering BOTH widgets compiles, but that would mean two
 * `ActivityConfiguration`s for the same `BelaActivityAttributes` — which
 * one WidgetKit then draws is undefined.
 *
 * So: add `.supplementalActivityFamilies([.small])` to
 * `belaActivityConfiguration()` the day the extension's deployment target
 * moves to iOS 18.0, and not before. Nothing else has to change.
 */
@main
struct BelaActivityBundle: WidgetBundle {
    var body: some Widget {
        BelaActivityLiveActivity()
    }
}

// MARK: - Canvas previews

#if DEBUG
@available(iOS 16.2, *)
private extension BelaActivityAttributes {
    static var preview: BelaActivityAttributes { BelaActivityAttributes(roomId: "demo-room") }
}

@available(iOS 16.2, *)
private extension BelaActivityAttributes.ContentState {
    static var previewYourTurn: BelaActivityAttributes.ContentState {
        BelaActivityAttributes.ContentState(
            roomId: "demo-room",
            phase: "playing",
            scoreUs: 512,
            scoreThem: 480,
            target: 1001,
            yourTurn: true,
            turnSeat: 1,
            turnDeadline: Date().addingTimeInterval(12).timeIntervalSince1970 * 1000,
            trump: "PIK",
            winner: nil
        )
    }

    static var previewGameOver: BelaActivityAttributes.ContentState {
        BelaActivityAttributes.ContentState(
            roomId: "demo-room",
            phase: "gameOver",
            scoreUs: 1010,
            scoreThem: 860,
            target: 1001,
            yourTurn: false,
            turnSeat: nil,
            turnDeadline: nil,
            trump: nil,
            winner: "us"
        )
    }
}

// The multi-state `#Preview(as: .content, using:)` macro itself needs iOS
// 17 (see `PreviewActivityBuilder` in WidgetKit's swiftinterface) even
// though the widget and its content states only require 16.2 — Xcode's
// canvas always previews on a current-OS simulator, so this does not raise
// the extension's real deployment target.
@available(iOS 17.0, *)
#Preview("Tvoj red", as: .content, using: BelaActivityAttributes.preview) {
    BelaActivityLiveActivity()
} contentStates: {
    BelaActivityAttributes.ContentState.previewYourTurn
}

@available(iOS 17.0, *)
#Preview("Kraj igre", as: .content, using: BelaActivityAttributes.preview) {
    BelaActivityLiveActivity()
} contentStates: {
    BelaActivityAttributes.ContentState.previewGameOver
}
#endif
