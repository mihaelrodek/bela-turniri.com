import { useEffect, useRef } from "react"
import { useAuth } from "../auth/AuthContext"
import {
    fetchPushPublicKey,
    registerPushSubscription,
    type PushSubscriptionJSON,
} from "../api/push"

/**
 * Auto-subscribe the current user to Web Push as soon as we have:
 *  1. a logged-in user (Firebase uid)
 *  2. browser support for service workers + push
 *  3. notification permission granted (or default — we'll ask)
 *  4. an active service worker registration
 *
 * "On by default for everyone" — per product decision — so this hook
 * actively requests permission on first login. If the user later
 * disables notifications via the OS or browser settings, the next
 * mount will see `Notification.permission === "denied"` and bail.
 *
 * The hook is idempotent: it's safe to mount it in many places, but
 * we only mount it once (at the app root) to keep the permission
 * prompt from firing repeatedly. The local `attemptedRef` guards
 * against the React Strict-Mode double-invoke in dev.
 */
export function usePushSubscription() {
    const { user, loading } = useAuth()
    const attemptedRef = useRef(false)

    useEffect(() => {
        if (loading) return
        if (!user?.uid) return
        if (attemptedRef.current) return
        attemptedRef.current = true

        // Bail cleanly on browsers that don't support Web Push at all
        // (older Safari, in-app webviews, etc.). The site still works,
        // just without the notification feature.
        if (typeof window === "undefined") return
        if (!("serviceWorker" in navigator)) return
        if (!("PushManager" in window)) return
        if (!("Notification" in window)) return

        // Bail if the user previously denied — we can't reprompt
        // without them changing the browser setting themselves.
        if (Notification.permission === "denied") return

        let cancelled = false
        ;(async () => {
            try {
                // Wait for the SW to be ready (it registers in main.tsx
                // after `load`). If it never registers — e.g. in dev
                // mode where the SW is intentionally not shipped — we
                // bail without warning.
                const reg = await navigator.serviceWorker.ready
                if (cancelled) return

                // Ask for permission only if not already decided. On
                // iOS this MUST happen inside a user gesture if the
                // app isn't installed to the home screen; we hide the
                // failure quietly there and rely on the explicit
                // toggle in the profile screen as a fallback.
                if (Notification.permission === "default") {
                    const result = await Notification.requestPermission()
                    if (cancelled) return
                    if (result !== "granted") return
                } else if (Notification.permission !== "granted") {
                    return
                }

                // Already subscribed? Re-send to the backend in case
                // the server-side row got deleted (rare but possible
                // after a DB wipe). Cheap idempotent upsert.
                const existing = await reg.pushManager.getSubscription()
                if (existing) {
                    const json = existing.toJSON() as PushSubscriptionJSON
                    if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
                        await registerPushSubscription(json).catch(() => {})
                    }
                    return
                }

                // Fresh subscription. Need the VAPID public key the
                // backend serves — converted from base64url to the
                // Uint8Array that pushManager.subscribe expects.
                const { publicKey, ready } = await fetchPushPublicKey()
                if (cancelled) return
                if (!ready || !publicKey) {
                    console.warn("[push] backend not configured — skipping")
                    return
                }
                const applicationServerKey = urlBase64ToUint8Array(publicKey)
                const sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    // TS 5.7+ types Uint8Array as generic over its buffer
                    // kind (ArrayBuffer | SharedArrayBuffer). At runtime
                    // this is always plain-ArrayBuffer-backed, but the
                    // PushManager DOM types only accept the ArrayBuffer
                    // flavour — hence the cast.
                    applicationServerKey: applicationServerKey as BufferSource,
                })
                if (cancelled) return
                const json = sub.toJSON() as PushSubscriptionJSON
                if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
                    await registerPushSubscription(json)
                }
            } catch (err) {
                // Permission flow can throw for all kinds of reasons:
                // user denied, autoplay-style "must be in user gesture"
                // restrictions, network failure on the public-key fetch.
                // None of these are fatal — log for the curious and move on.
                console.warn("[push] subscription failed:", err)
            }
        })()

        return () => {
            cancelled = true
        }
    }, [user?.uid, loading])
}

/**
 * Convert a base64url-encoded VAPID public key (what our backend ships)
 * into the Uint8Array that pushManager.subscribe() requires. Padding
 * is restored to make atob happy.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
    const rawData = atob(base64)
    const output = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
        output[i] = rawData.charCodeAt(i)
    }
    return output
}
