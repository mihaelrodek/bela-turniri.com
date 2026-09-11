/* ──────────────────────────────────────────────────────────────────────────
   Place search + address formatting, shared by `LocationAutocomplete`
   (forward search) and `LocationMapPicker` (reverse geocode of a map click).

   Two providers:
     - Google Places API (New), used when `VITE_GOOGLE_MAPS_API_KEY` is set.
       REST only — deliberately NOT the Maps JS SDK: no extra <script> tag, no
       window global, and the exact same code path works inside the Capacitor
       shells where a `capacitor://localhost` document loads no Google script.
     - OpenStreetMap Nominatim, the keyless fallback and the only provider for
       reverse geocoding (Google's Geocoding API is a separate, pricier
       product and a map click is rare compared to typing).

   Every provider funnels into ONE committed string shape — "Name, Street 1,
   12345 City" — so a tournament address looks the same no matter which path
   produced it, and so the backend's lazy `GeocodeService` (Nominatim, 1 req/s)
   can still re-geocode it later.

   The API key ships inside the JS bundle. That is by design and unavoidable
   for a browser-side Places call: the ONLY protection is the HTTP-referrer /
   bundle-id restriction plus the "Places API (New) only" API restriction the
   owner sets in Google Cloud. See DEPLOY.md.
   ────────────────────────────────────────────────────────────────────── */

/** Set at build time. Empty string (the default) = Nominatim-only. */
const GOOGLE_KEY: string = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY ?? ""

const GOOGLE_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete"
const GOOGLE_DETAILS_URL = "https://places.googleapis.com/v1/places"

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"

/** Countries a Croatian bela tournament can plausibly be held in. Google
 *  wants ISO-3166-1 alpha-2 upper case, Nominatim wants lower case CSV. */
const REGION_CODES = ["HR", "SI", "BA", "RS", "AT", "HU", "DE", "IT"]
const NOMINATIM_COUNTRY_CODES = "hr,ba,si,rs,me"

/** Roughly the middle of Croatia — biases (not restricts) Google's ranking
 *  towards the region the organisers actually live in. */
const BIAS_CENTER = { latitude: 45.8, longitude: 16.0 }
const BIAS_RADIUS_M = 400000

export const MIN_QUERY_CHARS = 3

/** True when a Google key was baked into this build. */
export function googlePlacesEnabled(): boolean {
    return GOOGLE_KEY.trim().length > 0
}

/**
 * A Places *session* groups the N autocomplete keystrokes and the ONE details
 * call that follows into a single billable unit. Without it Google bills every
 * autocomplete request AND the details request separately. Create one when the
 * user starts typing, pass it to every autocomplete call, pass it to the
 * details call, then throw it away — reusing a token after its details call
 * silently breaks the grouping and the next keystrokes are billed per-request.
 */
export function newSessionToken(): string {
    return crypto.randomUUID()
}

/* ── Types ───────────────────────────────────────────────────────────── */

export type NominatimAddress = {
    house_number?: string
    road?: string
    village?: string
    hamlet?: string
    suburb?: string
    neighbourhood?: string
    town?: string
    city?: string
    municipality?: string
    county?: string
    state?: string
    country?: string
    postcode?: string
}

export type NominatimResult = {
    place_id: number
    display_name: string
    name?: string
    lat: string
    lon: string
    type?: string
    addresstype?: string
    address?: NominatimAddress
}

export type GooglePlaceDetails = {
    id?: string
    displayName?: { text?: string; languageCode?: string }
    formattedAddress?: string
    location?: { latitude?: number; longitude?: number }
}

/** What the parent form receives when the user commits a location. Unchanged
 *  contract — `CreateTournamentPage` / `DetailsEditForm` still get exactly
 *  these three fields. */
export type LocationSuggestion = {
    displayName: string
    latitude: number
    longitude: number
}

/** One row in the dropdown, provider-agnostic. `payload` is what
 *  {@link resolveSuggestion} needs to turn the row into coordinates. */
export type SuggestionRow = {
    key: string
    /** Bold first line. */
    primary: string
    /** Muted second line — may be empty. */
    secondary: string
} & (
    | { provider: "google"; placeId: string }
    | { provider: "nominatim"; result: NominatimResult }
)

export type SearchOutcome = {
    provider: "google" | "nominatim"
    rows: SuggestionRow[]
}

/* ── Formatting ──────────────────────────────────────────────────────── */

function clean(parts: (string | undefined | null)[]): string[] {
    return parts.map((p) => (p ?? "").trim()).filter((p) => p.length > 0)
}

/**
 * Google details → committed location string.
 *
 * <p>`formattedAddress` already reads like a postal address ("Trg hrvatskih
 * ivanovaca 1, 42240 Ivanec, Hrvatska"), but it never carries the venue NAME,
 * which is the single most useful token for a player looking for the place. So
 * we prepend `displayName` — unless the formatted address already starts with
 * it (true for pure street-address results, where displayName IS the street).
 */
export function formatGooglePlace(place: GooglePlaceDetails): string {
    const name = (place.displayName?.text ?? "").trim()
    const address = (place.formattedAddress ?? "").trim()
    if (!address) return name
    if (!name) return address
    if (address.toLowerCase().startsWith(name.toLowerCase())) return address
    return `${name}, ${address}`
}

/**
 * Nominatim result → the SAME shape {@link formatGooglePlace} produces:
 * "Name, Street 1, 12345 City". Deliberately not `display_name`, which is a
 * nine-part chain down to the country and county ("Ivanec, Grad Ivanec,
 * Varaždinska županija, 42240, Hrvatska") — unreadable in a card, in a
 * WhatsApp share, and next to a Google-formatted sibling address.
 *
 * <p>Falls back to the first three segments of `display_name` when the
 * structured `address` block is missing (some POI nodes have none).
 */
export function formatNominatimPlace(r: NominatimResult): string {
    const a = r.address
    if (!a) {
        const segments = clean(r.display_name.split(","))
        return segments.slice(0, 3).join(", ") || r.display_name
    }

    const city = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? a.suburb
    const street = clean([a.road, a.house_number]).join(" ")
    const cityLine = clean([a.postcode, city]).join(" ")

    // `name` is the POI/venue label ("Voćarna Bagrem"). Drop it when it merely
    // repeats the street or the settlement, which is what Nominatim returns
    // for plain road / place results. Containment, not equality: a settlement
    // hit for "Ivanec" carries name "Ivanec" against municipality "Grad
    // Ivanec", and "Ivanec, 42240 Grad Ivanec" reads like a stutter.
    const name = (r.name ?? "").trim()
    const lower = name.toLowerCase()
    const isRedundant =
        !name
        || (a.road ?? "").toLowerCase().includes(lower)
        || (city ?? "").toLowerCase().includes(lower)

    const out = clean([isRedundant ? null : name, street, cityLine])
    if (out.length > 0) return out.join(", ")

    const segments = clean(r.display_name.split(","))
    return segments.slice(0, 3).join(", ") || r.display_name
}

/**
 * Pull a house number out of free-form user input.
 *
 * <p>Croatian addresses put the number after the street name
 * ("Soblinečka ulica 88"), so we take the LAST number-ish token in the
 * string. Handles plain numbers, letter suffixes ("88a") and slash
 * forms ("88/2"). Returns null when there's no number at all (the user
 * searched a bare street, a square, or a town).
 *
 * <p>Taking the *last* token is what makes "Ulica 8. svibnja 88" work —
 * the street name's own "8" is earlier in the string, the house number
 * "88" is last. The companion check in {@link formatNominatimPick} guards
 * the remaining edge case (a bare "Ulica 8. svibnja" with no house
 * number) by refusing to append a token already present in the street.
 */
export function extractHouseNumber(input: string): string | null {
    const matches = input.match(/\b\d+[a-zA-Z]?(?:\/\d+[a-zA-Z]?)?\b/g)
    if (!matches || matches.length === 0) return null
    return matches[matches.length - 1]
}

/**
 * Committed string for a Nominatim *forward-search* pick.
 *
 * <p>The problem this solves: OpenStreetMap's house-number coverage in Croatia
 * is patchy — many streets are mapped as geometry only, with no per-building
 * address points. A search for "Ulica X 88" then resolves to the street itself
 * and the number the user typed is silently lost. So when Nominatim resolved
 * no house number, the result IS a street, and the user typed a number, we
 * splice that number in after the road name. Coordinates stay street-level,
 * which is accurate enough to drop a venue on the correct street.
 *
 * <p>Guard: street names like "Ulica 8. svibnja" contain digits, so a number
 * already present in the road name is never appended twice.
 */
export function formatNominatimPick(r: NominatimResult, userInput: string): string {
    const a = r.address
    const typedHn = extractHouseNumber(userInput)
    const canSplice =
        !!a
        && !a.house_number
        && !!a.road
        && r.addresstype === "road"
        && !!typedHn
        && !new RegExp(`(^|\\s)${escapeRegExp(typedHn)}(\\s|$)`).test(a.road)

    if (!canSplice) return formatNominatimPlace(r)
    return formatNominatimPlace({ ...r, address: { ...a, house_number: typedHn ?? undefined } })
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/* ── Search ──────────────────────────────────────────────────────────── */

let googleWarned = false

/** One `console.warn` per session — a failing key would otherwise spam the
 *  console on every keystroke while the fallback quietly keeps working. */
function warnGoogleOnce(err: unknown) {
    if (googleWarned) return
    googleWarned = true
    console.warn("[places] Google Places unavailable, falling back to Nominatim:", err)
}

type GoogleSuggestion = {
    placePrediction?: {
        placeId?: string
        text?: { text?: string }
        structuredFormat?: {
            mainText?: { text?: string }
            secondaryText?: { text?: string }
        }
    }
}

async function searchGoogle(
    query: string,
    locale: string,
    sessionToken: string,
    signal: AbortSignal,
): Promise<SuggestionRow[]> {
    const res = await fetch(GOOGLE_AUTOCOMPLETE_URL, {
        method: "POST",
        signal,
        headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_KEY,
        },
        body: JSON.stringify({
            input: query,
            sessionToken,
            languageCode: locale,
            regionCode: "HR",
            includedRegionCodes: REGION_CODES,
            locationBias: { circle: { center: BIAS_CENTER, radius: BIAS_RADIUS_M } },
        }),
    })
    if (!res.ok) throw new Error(`Google autocomplete ${res.status}`)
    const data = (await res.json()) as { suggestions?: GoogleSuggestion[] }

    return (data.suggestions ?? [])
        .map((s) => s.placePrediction)
        .filter((p): p is NonNullable<GoogleSuggestion["placePrediction"]> => !!p?.placeId)
        .map((p) => ({
            provider: "google" as const,
            placeId: p.placeId as string,
            key: p.placeId as string,
            primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
            secondary: p.structuredFormat?.secondaryText?.text ?? "",
        }))
}

async function searchNominatim(
    query: string,
    userInput: string,
    signal: AbortSignal,
): Promise<SuggestionRow[]> {
    // limit=10: a free-form query like a café name or a street + house number
    // is often ranked below more generic city/village hits, so a smaller cap
    // silently dropped the exact venue. dedupe=1 collapses near-identical OSM
    // entries (same place mapped as both a node and a way).
    const url =
        `${NOMINATIM_SEARCH_URL}?format=json&limit=10&dedupe=1`
        + `&addressdetails=1`
        + `&countrycodes=${encodeURIComponent(NOMINATIM_COUNTRY_CODES)}`
        + `&accept-language=hr`
        + `&q=${encodeURIComponent(query)}`

    const res = await fetch(url, { signal, headers: { Accept: "application/json" } })
    if (!res.ok) throw new Error(`Nominatim ${res.status}`)
    const data = (await res.json()) as NominatimResult[]

    return data.map((r) => {
        const committed = formatNominatimPick(r, userInput)
        const [primary, ...rest] = committed.split(",")
        return {
            provider: "nominatim" as const,
            result: r,
            key: String(r.place_id),
            primary: primary?.trim() || committed,
            secondary: rest.join(",").trim(),
        }
    })
}

/**
 * Forward search. Prefers Google when a key is present and degrades to
 * Nominatim for THIS query on any Google failure (bad key, quota, offline
 * against Google only) — the user never sees an empty dropdown because of a
 * billing problem.
 */
export async function searchPlaces(opts: {
    query: string
    /** Raw input, used for the Nominatim house-number splice. */
    userInput: string
    /** Active i18n locale, forwarded to Google as `languageCode`. */
    locale: string
    sessionToken: string
    signal: AbortSignal
}): Promise<SearchOutcome> {
    if (googlePlacesEnabled()) {
        try {
            const rows = await searchGoogle(opts.query, opts.locale, opts.sessionToken, opts.signal)
            return { provider: "google", rows }
        } catch (e) {
            // An abort is the caller replacing this query, not a Google fault.
            if ((e as { name?: string })?.name === "AbortError") throw e
            warnGoogleOnce(e)
        }
    }
    return { provider: "nominatim", rows: await searchNominatim(opts.query, opts.userInput, opts.signal) }
}

/**
 * Turn a picked row into the committed `{ displayName, latitude, longitude }`.
 *
 * <p>Google rows need a second call — Place Details — because autocomplete
 * predictions carry no coordinates. The field mask is the minimum that still
 * yields a human address plus a pin, and it is what puts the request in
 * Google's cheapest details SKU. Passing the same `sessionToken` here is what
 * makes the whole typing session bill as ONE autocomplete session instead of
 * per-keystroke; the caller must discard the token afterwards.
 */
export async function resolveSuggestion(
    row: SuggestionRow,
    opts: { userInput: string; sessionToken: string; signal?: AbortSignal },
): Promise<LocationSuggestion | null> {
    if (row.provider === "nominatim") {
        const lat = parseFloat(row.result.lat)
        const lng = parseFloat(row.result.lon)
        const displayName = formatNominatimPick(row.result, opts.userInput)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        return { displayName, latitude: lat, longitude: lng }
    }

    const url = `${GOOGLE_DETAILS_URL}/${encodeURIComponent(row.placeId)}`
        + `?sessionToken=${encodeURIComponent(opts.sessionToken)}`
    const res = await fetch(url, {
        signal: opts.signal,
        headers: {
            "X-Goog-Api-Key": GOOGLE_KEY,
            "X-Goog-FieldMask": "id,displayName,formattedAddress,location,addressComponents",
        },
    })
    if (!res.ok) throw new Error(`Google details ${res.status}`)
    const place = (await res.json()) as GooglePlaceDetails

    const displayName = formatGooglePlace(place)
    const lat = place.location?.latitude
    const lng = place.location?.longitude
    if (typeof lat !== "number" || typeof lng !== "number") return null
    return { displayName, latitude: lat, longitude: lng }
}

/**
 * Reverse geocode a map click. Stays on Nominatim on purpose: Google reverse
 * geocoding is the separate (and pricier) Geocoding API, and a map click is
 * rare next to typing. The result is formatted through the same
 * {@link formatNominatimPlace} the forward fallback uses, so a click and a
 * typed pick commit strings of the same shape.
 *
 * <p>Nominatim's usage policy asks for ≤ 1 request/second per user. The picker
 * is throttled implicitly — the user has to click and wait for the reverse
 * geocode to resolve before they can click again.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
    const url =
        `${NOMINATIM_REVERSE_URL}?format=json`
        + `&lat=${lat}&lon=${lng}`
        + `&accept-language=hr`
        + `&zoom=18&addressdetails=1`
    const res = await fetch(url, { headers: { Accept: "application/json" } })
    if (!res.ok) throw new Error(`Nominatim reverse ${res.status}`)
    const data = (await res.json()) as NominatimResult | { error?: string }
    if (!data || "error" in data || !("display_name" in data)) {
        return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    }
    return formatNominatimPlace(data) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}
