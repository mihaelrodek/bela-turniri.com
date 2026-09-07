import { http } from "./http"

/* ──────────────────────────────────────────────────────────────────────────
   POST /contact — the public "Kontaktiraj nas" form (/kontakt). Fully
   anonymous: the backend records the caller's uid only when a Firebase
   bearer happens to be attached (the shared axios instance always attaches
   one when the user is signed in).

   `website` is a honeypot: a real visitor never sees or fills that field
   (ContactPage renders it visually hidden, tabindex -1, autoComplete off),
   so any non-empty value marks the submission as spam server-side. Always
   send it — an empty string, never omitted — so the shape matches the
   backend's expectation on every request.
   ────────────────────────────────────────────────────────────────────── */

export type ContactMessagePayload = {
    name: string
    email: string
    /** Omit entirely when the sender left it blank — the column is nullable. */
    subject?: string
    message: string
    /** Honeypot — must stay empty. */
    website: string
}

export type ContactMessageResponse = {
    status: "ACCEPTED"
}

/**
 * Sends the public contact form. No success toast on purpose — the page
 * swaps the form for an inline confirmation panel instead, which is a
 * calmer place to say "hvala, javit ćemo se" than a toast that disappears.
 * A 429 (rate-limited) and a 400 (validation) both still surface through
 * the shared axios interceptor's error toast.
 */
export async function submitContactMessage(
    payload: ContactMessagePayload,
): Promise<ContactMessageResponse> {
    const { data } = await http.post<ContactMessageResponse>("/contact", payload, {
        silent: true,
    })
    return data
}
