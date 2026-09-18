import Foundation
import Capacitor
import Security

/**
 * Durable mirror of the guest identity (`{ name, secret, avatar }`, see
 * `src/game/hooks/guestIdentity.ts`) for iOS. `@capacitor/preferences` maps
 * to UserDefaults there, which is wiped on uninstall — the whole point of
 * N2.2b is a store that is NOT wiped, so this plugin talks to the Keychain
 * directly instead of pulling in a third-party secure-storage plugin.
 *
 * `kSecAttrAccessibleAfterFirstUnlock` (not `...ThisDeviceOnly`) is
 * deliberate on both axes:
 *  - "AfterFirstUnlock" (not "WhenUnlocked") because a push notification can
 *    wake native code — via `PushService` / the game server's own pushes —
 *    while the phone is locked, and the guest record must still be
 *    readable then.
 *  - Not "ThisDeviceOnly" so the item is included in the iCloud Keychain
 *    backup/sync class Apple uses for that accessibility tier, which is
 *    exactly what survives an uninstall/reinstall (and a device migration)
 *    — a "ThisDeviceOnly" item is deliberately excluded from that backup
 *    and would be lost on reinstall same as UserDefaults.
 *
 * Capacitor 8 does not auto-discover local (in-app-target) Swift plugins —
 * see `CAPBridgeViewControllerWithLocalPlugins.swift` for how this class is
 * wired to the bridge.
 */
@objc(GuestKeychainPlugin)
public class GuestKeychainPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GuestKeychainPlugin"
    public let jsName = "GuestKeychain"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
    ]

    // Scopes every item this plugin ever writes so it can never collide with
    // (or be swept up by) Keychain items any other plugin or library adds.
    private static let service = "com.belaturniri.app.guest"

    private func query(for key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: GuestKeychainPlugin.service,
            kSecAttrAccount as String: key,
        ]
    }

    @objc func get(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("Missing 'key'")
            return
        }
        var attributes = query(for: key)
        attributes[kSecReturnData as String] = true
        attributes[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(attributes as CFDictionary, &item)
        switch status {
        case errSecSuccess:
            guard let data = item as? Data, let value = String(data: data, encoding: .utf8) else {
                call.reject("Keychain item for '\(key)' is not decodable UTF-8")
                return
            }
            call.resolve(["value": value])
        case errSecItemNotFound:
            // Absence is not an error: `hydrateGuestFromNative` treats a
            // null value the same as "nothing stored yet".
            call.resolve(["value": NSNull()])
        default:
            call.reject("Keychain read failed", nil, nil, ["status": status])
        }
    }

    @objc func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let value = call.getString("value") else {
            call.reject("Missing 'key' or 'value'")
            return
        }
        guard let data = value.data(using: .utf8) else {
            call.reject("Value is not encodable as UTF-8")
            return
        }

        // Upsert: try an update first (the common case once a guest exists),
        // fall back to add for the first-ever write — SecItemAdd on an
        // existing account would fail with errSecDuplicateItem.
        let searchQuery = query(for: key)
        let updateAttributes: [String: Any] = [kSecValueData as String: data]
        let updateStatus = SecItemUpdate(searchQuery as CFDictionary, updateAttributes as CFDictionary)

        if updateStatus == errSecItemNotFound {
            var addQuery = searchQuery
            addQuery[kSecValueData as String] = data
            addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
            let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
            if addStatus == errSecSuccess {
                call.resolve()
            } else {
                call.reject("Keychain write failed", nil, nil, ["status": addStatus])
            }
        } else if updateStatus == errSecSuccess {
            call.resolve()
        } else {
            call.reject("Keychain update failed", nil, nil, ["status": updateStatus])
        }
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("Missing 'key'")
            return
        }
        let status = SecItemDelete(query(for: key) as CFDictionary)
        // errSecItemNotFound is a success from the caller's point of view:
        // "make sure this key is gone" is already satisfied.
        if status == errSecSuccess || status == errSecItemNotFound {
            call.resolve()
        } else {
            call.reject("Keychain delete failed", nil, nil, ["status": status])
        }
    }
}
