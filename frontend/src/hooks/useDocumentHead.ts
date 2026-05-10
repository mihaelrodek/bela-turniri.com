import { useEffect } from "react"

/**
 * Per-route document.title + <meta> updater.
 *
 * Why this exists:
 *   - The app is a client-side SPA. Without a hook like this, every URL
 *     ships the same <title> and <meta description> from index.html, which
 *     hurts SEO badly for tournament and profile pages.
 *   - True SEO for SPAs needs SSR or build-time prerendering. JS-aware
 *     crawlers (Googlebot, Bing) do pick up these client-side updates
 *     reliably; non-JS crawlers (Slack/WhatsApp/Facebook link-preview bots)
 *     will still see the static index.html. For full link-preview support,
 *     introduce a server-side render path (Vike, vite-plugin-prerender,
 *     or a User-Agent-aware proxy in front of the SPA).
 *
 * Usage:
 *   useDocumentHead({
 *     title: "Velika Bela Liga, Zagreb — bela-turniri.hr",
 *     description: "...",
 *     ogTitle: "Velika Bela Liga, Zagreb",
 *     ogImage: "https://...",
 *     canonical: "https://bela-turniri.hr/tournaments/abc",
 *   })
 */
export type DocumentHead = {
    title?: string
    description?: string
    ogTitle?: string
    ogDescription?: string
    ogImage?: string
    ogType?: string
    canonical?: string
}

const DEFAULT_TITLE = "bela-turniri.hr — Bela turniri"
const DEFAULT_DESCRIPTION =
    "bela-turniri.hr — organiziraj i prati Bela turnire. Pretraži nadolazeće turnire, pridruži se paru i prati rezultate."

export function useDocumentHead(head: DocumentHead) {
    useEffect(() => {
        const previousTitle = document.title
        const previousMeta = snapshotMeta()
        const previousCanonical = currentCanonical()

        if (head.title) document.title = head.title
        if (head.description) setMeta("name", "description", head.description)
        if (head.ogTitle) setMeta("property", "og:title", head.ogTitle)
        if (head.ogDescription) setMeta("property", "og:description", head.ogDescription)
        if (head.ogImage) setMeta("property", "og:image", head.ogImage)
        if (head.ogType) setMeta("property", "og:type", head.ogType)
        if (head.canonical) setCanonical(head.canonical)

        // On unmount: restore the original document head so navigating to a
        // page that does NOT call this hook doesn't keep stale meta tags.
        return () => {
            document.title = previousTitle
            restoreMeta(previousMeta)
            restoreCanonical(previousCanonical)
        }
    }, [
        head.title,
        head.description,
        head.ogTitle,
        head.ogDescription,
        head.ogImage,
        head.ogType,
        head.canonical,
    ])
}

/* ───────────────────── helpers ───────────────────── */

type MetaSnapshot = Record<string, string | null>

function setMeta(attr: "name" | "property", key: string, value: string) {
    let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
    if (!el) {
        el = document.createElement("meta")
        el.setAttribute(attr, key)
        document.head.appendChild(el)
    }
    el.setAttribute("content", value)
}

function snapshotMeta(): MetaSnapshot {
    const keys: Array<[string, string]> = [
        ["name", "description"],
        ["property", "og:title"],
        ["property", "og:description"],
        ["property", "og:image"],
        ["property", "og:type"],
    ]
    const snap: MetaSnapshot = {}
    for (const [attr, key] of keys) {
        const el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
        snap[`${attr}:${key}`] = el ? el.getAttribute("content") : null
    }
    return snap
}

function restoreMeta(snap: MetaSnapshot) {
    for (const k of Object.keys(snap)) {
        const [attr, key] = k.split(":") as ["name" | "property", string]
        const previousValue = snap[k]
        if (previousValue == null) {
            // Tag didn't exist before — leave whatever we set in place; cheaper
            // than removing/recreating, and the next route that mounts the hook
            // will overwrite it anyway. For the description tag we restore the
            // app-level default so it doesn't leak across routes.
            if (key === "description") setMeta(attr, key, DEFAULT_DESCRIPTION)
            continue
        }
        setMeta(attr, key, previousValue)
    }
    if (!snap["name:description"]) document.title = DEFAULT_TITLE
}

function currentCanonical(): string | null {
    const el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    return el ? el.getAttribute("href") : null
}

function setCanonical(href: string) {
    let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!el) {
        el = document.createElement("link")
        el.setAttribute("rel", "canonical")
        document.head.appendChild(el)
    }
    el.setAttribute("href", href)
}

function restoreCanonical(previous: string | null) {
    const el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (previous == null) {
        if (el) el.parentElement?.removeChild(el)
        return
    }
    if (!el) {
        const created = document.createElement("link")
        created.setAttribute("rel", "canonical")
        created.setAttribute("href", previous)
        document.head.appendChild(created)
        return
    }
    el.setAttribute("href", previous)
}
