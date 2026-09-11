import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { usePushSubscription } from "../hooks/usePushSubscription"
import { isNative, platform } from "../platform"
import { nativeMessaging } from "../platform/native"
import { useAuth } from "../auth/authContextValue"
import { getLocale } from "../i18n"
import { registerPushDevice, unregisterPushDevice } from "../api/push"

/**
 * Mounted once at the app root. Two responsibilities:
 *
 *   1. Auto-subscribe the logged-in user to push — Web Push via the hook on
 *      the web build, FCM device registration below on native.
 *   2. Listen for {@code bela:navigate} postMessage events that the
 *      service worker dispatches when the user clicks a notification.
 *      The SW resolves to an existing open tab and asks it to route
 *      to the target URL — we honour that with a client-side navigate
 *      instead of a hard reload so the SPA state survives.
 *
 * Notification TAP handling and the foreground toast live in
 * `platform/NativeShell.tsx` instead of here, next to the app's other native
 * listeners (back button, appUrlOpen) — this file stays about acquiring and
 * maintaining the token, not about what happens once a notification arrives.
 */
export default function PushBootstrap() {
    usePushSubscription()
    const navigate = useNavigate()
    const { user, loading } = useAuth()
    // Only known in-memory: good enough for "unregister on sign-out within
    // this session", which is the case that matters (a shared/reset device
    // logging out). A token that outlives the JS runtime (app killed, then
    // relaunched already signed out) has nothing pushed to it anyway once
    // the backend's own token-invalid handling prunes a stale row.
    const lastTokenRef = useRef<string | null>(null)
    const attemptedRef = useRef(false)

    // Web-only: SW message bridge for notification taps. See sw.js's
    // `notificationclick` handler, which posts this message instead of a
    // hard navigation so in-app state survives.
    useEffect(() => {
        if (isNative) return
        if (!("serviceWorker" in navigator)) return
        function onMessage(e: MessageEvent) {
            const data = e?.data
            if (data && data.type === "bela:navigate" && typeof data.url === "string") {
                navigate(data.url)
            }
        }
        navigator.serviceWorker.addEventListener("message", onMessage)
        return () => navigator.serviceWorker.removeEventListener("message", onMessage)
    }, [navigate])

    // Native: request notification permission and register the FCM token,
    // at the same moment the web path does (right after a login resolves —
    // `usePushSubscription` gates on `user?.uid` too). Unlike iOS Safari's
    // Notification.requestPermission(), FirebaseMessaging.requestPermissions()
    // is a native OS prompt with no "must be inside a user gesture" rule, so
    // there is no gesture-listener dance to mirror here — just the same
    // "only after sign-in, only once" gate.
    useEffect(() => {
        if (!isNative) return
        if (loading) return
        if (!user?.uid) return
        if (attemptedRef.current) return
        attemptedRef.current = true

        let cancelled = false

        const register = async (token: string) => {
            lastTokenRef.current = token
            await registerPushDevice({
                token,
                platform: platform as "ios" | "android",
                locale: getLocale(),
                // No build-time version constant exists yet (see vite.config.ts) —
                // omit rather than send a made-up value.
                appVersion: undefined,
            })
        }

        nativeMessaging()
            .then(async ({ FirebaseMessaging: Messaging }) => {
                let status = await Messaging.checkPermissions()
                if (status.receive === "prompt" || status.receive === "prompt-with-rationale") {
                    status = await Messaging.requestPermissions()
                }
                if (cancelled || status.receive !== "granted") return

                const { token } = await Messaging.getToken()
                if (cancelled || !token) return
                await register(token)
            })
            .catch(() => {
                // Best-effort, exactly like usePushSubscription's web flow —
                // permission denial, a missing GoogleService config before
                // the user drops it in, or a flaky first request are all
                // non-fatal: the app works without push.
            })

        return () => {
            cancelled = true
        }
    }, [user?.uid, loading])

    // Re-register whenever FCM rotates the token under us (app restore,
    // Play Services update, token expiry) — same "keep the backend's row
    // fresh" job usePushSubscription does for Web Push subscriptions.
    useEffect(() => {
        if (!isNative) return
        let handle: { remove: () => void } | undefined
        let cancelled = false
        nativeMessaging().then(async ({ FirebaseMessaging: Messaging }) => {
            const h = await Messaging.addListener("tokenReceived", ({ token }) => {
                lastTokenRef.current = token
                registerPushDevice({
                    token,
                    platform: platform as "ios" | "android",
                    locale: getLocale(),
                    appVersion: undefined,
                }).catch(() => {
                    /* best-effort */
                })
            })
            if (cancelled) h.remove()
            else handle = h
        })
        return () => {
            cancelled = true
            handle?.remove()
        }
    }, [])

    // Sign-out: drop the device row so this device stops receiving pushes
    // for an account it is no longer signed into. Only fires once we've
    // actually seen a signed-in user with a known token — a cold load that
    // was never signed in has nothing to unregister.
    useEffect(() => {
        if (!isNative) return
        if (loading) return
        if (user?.uid) return
        const token = lastTokenRef.current
        if (!token) return
        lastTokenRef.current = null
        attemptedRef.current = false
        unregisterPushDevice(token).catch(() => {
            /* best-effort — a stale row on the backend is harmless */
        })
    }, [user?.uid, loading])

    return null
}
