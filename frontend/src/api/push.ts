import { http } from "./http"

/** Wire shape of `GET /push/public-key`. */
export type PushPublicKeyResponse = {
    publicKey: string
    ready: boolean
}

export async function fetchPushPublicKey(): Promise<PushPublicKeyResponse> {
    const { data } = await http.get<PushPublicKeyResponse>("/push/public-key", {
        silent: true,
    })
    return data
}

/**
 * POST a fresh browser subscription to the backend so it can route
 * future pushes to it. Idempotent — re-subscribing the same endpoint
 * just refreshes the crypto material server-side.
 */
export async function registerPushSubscription(sub: PushSubscriptionJSON): Promise<void> {
    await http.post(
        "/push/subscribe",
        {
            endpoint: sub.endpoint,
            p256dh: sub.keys?.p256dh ?? "",
            auth: sub.keys?.auth ?? "",
        },
        {
            // No success toast — this is background plumbing the user
            // already opted in to via the OS permission prompt.
            silent: true,
        },
    )
}

/**
 * Browser PushSubscription serialised via `toJSON()`. The native object
 * has methods (unsubscribe, getKey), but the JSON form has just the
 * fields we need to send to the server.
 */
export type PushSubscriptionJSON = {
    endpoint: string
    expirationTime: number | null
    keys?: {
        p256dh?: string
        auth?: string
    }
}

/** Body of `PUT /push/device` — see `PushBootstrap.tsx`'s native branch. */
export type RegisterPushDeviceRequest = {
    token: string
    platform: "ios" | "android"
    locale?: string
    appVersion?: string
}

/**
 * Upsert an FCM device token (native iOS/Android only — the web path uses
 * `registerPushSubscription` above). Idempotent on the backend, so calling
 * it again on every `tokenReceived` just refreshes the row.
 */
export async function registerPushDevice(body: RegisterPushDeviceRequest): Promise<void> {
    await http.put("/push/device", body, {
        // Background plumbing, same as the web subscribe call — no toast.
        silent: true,
    })
}

/**
 * Drop a device token on sign-out, so a shared/reset device stops receiving
 * pushes meant for the account that just signed out. Best-effort: the caller
 * (`PushBootstrap.tsx`) never lets a failure here surface to the user.
 */
export async function unregisterPushDevice(token: string): Promise<void> {
    await http.delete(`/push/device/${encodeURIComponent(token)}`, {
        silent: true,
    })
}
