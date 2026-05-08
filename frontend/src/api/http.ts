import axios from "axios"
import { auth } from "../firebase"

const baseURL = import.meta.env.VITE_API_URL ?? "/api"

export const http = axios.create({
    baseURL,
    headers: { "Content-Type": "application/json" },
})

/**
 * Attach the current Firebase ID token (if any) to every outgoing request.
 * The Firebase SDK caches and auto-refreshes the token internally, so calling
 * `getIdToken()` is cheap and always returns a fresh, unexpired JWT.
 *
 * Anonymous traffic (no signed-in user) is left as-is — the backend's permission
 * policies allow GETs without auth and only require it on writes.
 */
http.interceptors.request.use(async (config) => {
    const u = auth.currentUser
    if (u) {
        try {
            const token = await u.getIdToken()
            config.headers = config.headers ?? {}
            ;(config.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`
        } catch {
            // Token fetch failed — let the request go without auth header
            // (server will reject with 401 if the endpoint requires auth, which
            // the UI already handles).
        }
    }
    return config
})
