import Foundation
import Capacitor
#if canImport(ActivityKit)
import ActivityKit
#endif

/**
 * Native half of `src/platform/liveActivityPlugin.ts` (`BelaLiveActivity`):
 * starts, updates and ends the lock-screen Live Activity for a running bela
 * online game, and reports the APNs tokens the backend
 * (`LiveActivitySender`) pushes remote updates to.
 *
 * Availability: the App target deploys to iOS 15.0. `ActivityContent` and
 * `Activity.request(attributes:content:pushType:)` exist only from iOS 16.2,
 * so that is the effective floor for everything here (including
 * `isAvailable`, so JS never sees `true` on a 16.1 device where `start`
 * could not work). Push-to-start tokens need iOS 17.2.
 *
 * Every ActivityKit failure rejects the call — never crashes. JS treats a
 * rejection as "not available". Until the `BelaActivity` widget extension
 * exists nothing is drawn even if a request succeeds.
 *
 * Registered by hand in `AppBridgeViewController.capacitorDidLoad()`.
 */
@objc(BelaLiveActivityPlugin)
public class BelaLiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BelaLiveActivityPlugin"
    public let jsName = "BelaLiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
    ]

    private static let unavailable = "unavailable"
    /** Matches the backend's dismissal window for a remote "end". */
    private static let lingerSeconds: TimeInterval = 15 * 60

    /** Observes the current activity's per-activity push token. */
    private var activityTokenTask: Task<Void, Never>?
    /** Observes the push-to-start token (iOS 17.2+), for the plugin's lifetime. */
    private var pushToStartTask: Task<Void, Never>?

    override public func load() {
        #if canImport(ActivityKit)
        if #available(iOS 17.2, *) {
            pushToStartTask = Task { [weak self] in
                for await data in Activity<BelaActivityAttributes>.pushToStartTokenUpdates {
                    self?.notifyListeners("pushToStartToken", data: ["token": Self.hex(data)])
                }
            }
        }
        #endif
    }

    deinit {
        activityTokenTask?.cancel()
        pushToStartTask?.cancel()
    }

    private static func hex(_ data: Data) -> String {
        data.map { String(format: "%02x", $0) }.joined()
    }

    // MARK: - isAvailable

    @objc func isAvailable(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            call.resolve(["available": ActivityAuthorizationInfo().areActivitiesEnabled])
            return
        }
        #endif
        call.resolve(["available": false])
    }

    // MARK: - start

    @objc func start(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            let state: BelaActivityAttributes.ContentState
            do {
                state = try Self.decodeState(call.options["state"])
            } catch {
                call.reject("Invalid 'state': \(error.localizedDescription)")
                return
            }
            Task { [weak self] in
                // One live game at a time: a new game replaces the old one.
                for existing in Activity<BelaActivityAttributes>.activities {
                    await existing.end(nil, dismissalPolicy: .immediate)
                }
                self?.activityTokenTask?.cancel()
                do {
                    let content = ActivityContent(
                        state: state,
                        staleDate: Date().addingTimeInterval(Self.lingerSeconds)
                    )
                    let activity = try Activity.request(
                        attributes: BelaActivityAttributes(roomId: state.roomId),
                        content: content,
                        pushType: .token
                    )
                    self?.activityTokenTask = Task { [weak self] in
                        for await data in activity.pushTokenUpdates {
                            self?.notifyListeners("activityToken", data: ["token": Self.hex(data)])
                        }
                    }
                    call.resolve()
                } catch {
                    call.reject(error.localizedDescription, nil, error)
                }
            }
            return
        }
        #endif
        call.reject(Self.unavailable)
    }

    // MARK: - update

    @objc func update(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            let state: BelaActivityAttributes.ContentState
            do {
                state = try Self.decodeState(call.options["state"])
            } catch {
                call.reject("Invalid 'state': \(error.localizedDescription)")
                return
            }
            Task {
                // No activity: the JS raced a game that already ended — not an error.
                guard let activity = Activity<BelaActivityAttributes>.activities.first else {
                    call.resolve()
                    return
                }
                await activity.update(ActivityContent(
                    state: state,
                    staleDate: Date().addingTimeInterval(Self.lingerSeconds)
                ))
                call.resolve()
            }
            return
        }
        #endif
        call.reject(Self.unavailable)
    }

    // MARK: - end

    @objc func end(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            var finalState: BelaActivityAttributes.ContentState?
            if let raw = call.options["state"], !(raw is NSNull) {
                do {
                    finalState = try Self.decodeState(raw)
                } catch {
                    call.reject("Invalid 'state': \(error.localizedDescription)")
                    return
                }
            }
            Task { [weak self] in
                let activities = Activity<BelaActivityAttributes>.activities
                for activity in activities {
                    if let finalState {
                        let content = ActivityContent(state: finalState, staleDate: nil)
                        await activity.end(
                            content,
                            dismissalPolicy: .after(Date().addingTimeInterval(Self.lingerSeconds))
                        )
                    } else {
                        await activity.end(nil, dismissalPolicy: .immediate)
                    }
                }
                self?.activityTokenTask?.cancel()
                self?.activityTokenTask = nil
                call.resolve()
            }
            return
        }
        #endif
        call.reject(Self.unavailable)
    }

    // MARK: - decoding

    private enum StateError: LocalizedError {
        case missing
        var errorDescription: String? { "missing or not an object" }
    }

    /**
     * JS object → JSON bytes → `JSONDecoder`: deliberately the same decoding
     * path ActivityKit uses for an APNs `content-state`, so a payload that
     * fails here would also fail when pushed.
     */
    #if canImport(ActivityKit)
    @available(iOS 16.1, *)
    private static func decodeState(_ raw: Any?) throws -> BelaActivityAttributes.ContentState {
        guard let raw, !(raw is NSNull), JSONSerialization.isValidJSONObject(raw) else {
            throw StateError.missing
        }
        let data = try JSONSerialization.data(withJSONObject: raw)
        return try JSONDecoder().decode(BelaActivityAttributes.ContentState.self, from: data)
    }
    #endif
}
