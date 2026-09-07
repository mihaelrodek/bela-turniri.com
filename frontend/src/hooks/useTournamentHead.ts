import { useMemo } from "react"

import { useDocumentHead } from "./useDocumentHead"
import { useTranslation } from "../i18n"
import { formatDate } from "../utils/format"
import type { TournamentDetails } from "../types/tournaments"

/**
 * Per-route SEO meta + the Event/BreadcrumbList JSON-LD for one tournament.
 *
 * Called from the page SHELL, not from the Detalji section: the head tags and
 * the canonical link have to be right on every section (a shared
 * `/turniri/x/zdrijeb` link is crawled and previewed exactly like the bare
 * one), so tying them to a section that may not be mounted would silently
 * drop them for four URLs out of five.
 */
export function useTournamentHead(t: TournamentDetails | null, uuid: string | undefined) {
    const { t: tr } = useTranslation()

    // Title falls back to a generic label until the tournament loads, then
    // upgrades in place. Description prefers the organizer's `details` text,
    // trimmed to ~160 characters.
    const headTitle = t?.name
        ? t.location
            ? tr("tournament.seo.titleWithLocation", { name: t.name, location: t.location })
            : tr("tournament.seo.title", { name: t.name })
        : tr("tournament.seo.titleFallback")

    const headDesc = (() => {
        const raw = t?.details?.trim()
        // Shared formatter, not a bare toLocaleDateString: it pins the options
        // used everywhere else on the page and, unlike `new Date(…)`, yields
        // nothing instead of "Invalid Date" for a malformed startAt — which
        // would otherwise ship straight into the og:description.
        const start = t?.startAt ? formatDate(t.startAt, "") : ""
        if (raw) return raw.length > 160 ? raw.slice(0, 157) + "…" : raw
        if (t?.name) {
            // One key per shape rather than gluing fragments: word order and
            // the preposition in front of the location are a translator's
            // business, not a `join(" ")`'s.
            if (t.location && start) {
                return tr("tournament.seo.descWithLocationAndDate", {
                    name: t.name, location: t.location, date: start,
                })
            }
            if (t.location) {
                return tr("tournament.seo.descWithLocation", { name: t.name, location: t.location })
            }
            if (start) return tr("tournament.seo.descWithDate", { name: t.name, date: start })
            return tr("tournament.seo.desc", { name: t.name })
        }
        return undefined
    })()

    const canonicalUrl = t?.slug
        ? `https://bela-turniri.com/turniri/${t.slug}`
        : uuid
            ? `https://bela-turniri.com/turniri/${uuid}`
            : undefined

    // Build the Event + BreadcrumbList JSON-LD for Googlebot. Matches the
    // schema the backend SSR preview controller emits for non-JS crawlers,
    // so Search Console doesn't see conflicting structured data between
    // the rendered and unrendered variants of the same URL.
    //
    // Deliberately NOT run through i18n — that match is the whole point.
    // `inLanguage: "hr"`, `addressCountry: "HR"`, the "Hrvatska" fallback
    // place and the "Turniri" breadcrumb are all fixed strings the
    // (locale-unaware) backend emits verbatim; translating them here would
    // make the two variants of the same URL disagree.
    const jsonLd = useMemo(() => {
        if (!t || !canonicalUrl) return undefined
        const items: object[] = []

        const event: Record<string, unknown> = {
            "@context": "https://schema.org",
            "@type": "Event",
            name: t.name,
            url: canonicalUrl,
            inLanguage: "hr",
            eventStatus: "https://schema.org/EventScheduled",
            eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        }
        if (headDesc) event.description = headDesc
        if (t.startAt) {
            event.startDate = t.startAt
            // +6h end-date default — see backend controller comment for
            // rationale (Google's event eligibility wants both start+end).
            const end = new Date(new Date(t.startAt).getTime() + 6 * 60 * 60 * 1000)
            event.endDate = end.toISOString()
        }
        if (t.location) {
            event.location = {
                "@type": "Place",
                name: t.location,
                address: {
                    "@type": "PostalAddress",
                    addressLocality: t.location,
                    addressCountry: "HR",
                },
            }
        } else {
            event.location = {
                "@type": "Place",
                name: "Hrvatska",
                address: { "@type": "PostalAddress", addressCountry: "HR" },
            }
        }
        if (t.bannerUrl) event.image = [t.bannerUrl]
        if (t.createdByName) {
            event.organizer = { "@type": "Person", name: t.createdByName }
        }
        const entryPrice = t.entryPrice ?? 0
        const startInFuture = !t.startAt || new Date(t.startAt).getTime() > Date.now()
        if (startInFuture && entryPrice > 0) {
            event.offers = {
                "@type": "Offer",
                url: canonicalUrl,
                price: String(entryPrice),
                priceCurrency: "EUR",
                availability: "https://schema.org/InStock",
                validFrom: new Date().toISOString(),
            }
        }
        items.push(event)

        // BreadcrumbList — "Turniri › {tournament}". Helps Google render
        // the breadcrumb chip above the result instead of the bare URL.
        items.push({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                {
                    "@type": "ListItem",
                    position: 1,
                    name: "Turniri",
                    item: "https://bela-turniri.com/turniri",
                },
                {
                    "@type": "ListItem",
                    position: 2,
                    name: t.name,
                    item: canonicalUrl,
                },
            ],
        })

        return items
    }, [t, canonicalUrl, headDesc])

    useDocumentHead({
        title: headTitle,
        description: headDesc,
        ogTitle: t?.name ?? undefined,
        ogDescription: headDesc,
        ogImage: t?.bannerUrl ?? undefined,
        ogType: "article",
        // Prefer the canonical pretty slug returned by the backend so search
        // engines and social previews don't see a UUID variant — fall back to
        // whatever route segment we have (uuid, or the slug if the visitor
        // already came in via a slug URL).
        canonical: canonicalUrl,
        jsonLd,
    })
}

export default useTournamentHead
