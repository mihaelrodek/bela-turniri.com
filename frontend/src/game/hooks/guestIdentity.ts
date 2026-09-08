export interface GuestIdentity { name: string; secret: string }
const KEY = "bela.guest"
let cached: GuestIdentity | null = null

export function readGuest(): GuestIdentity | null {
    if (cached) return cached
    try {
        const value = JSON.parse(localStorage.getItem(KEY) ?? "null")
        if (typeof value?.name === "string" && value.name.trim() && /^[a-f0-9]{64}$/.test(value.secret)) {
            cached = { name: value.name.trim().slice(0, 60), secret: value.secret }
        }
    } catch { /* Storage can be unavailable in private browsing. */ }
    return cached
}

export function saveGuest(name: string): GuestIdentity {
    const secret = readGuest()?.secret ?? Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("")
    cached = { name: name.trim().slice(0, 60), secret }
    try { localStorage.setItem(KEY, JSON.stringify(cached)) } catch { /* Keep identity for this page session. */ }
    return cached
}
