import { useSyncExternalStore } from "react"
import { hrCore, type CoreDictionary, type Dictionary, type LazyNamespaces } from "./hr"

/* ──────────────────────────────────────────────────────────────────────────
   Hand-rolled i18n — no react-i18next / react-intl. Matches the project's
   existing "one small centrally-registered module" pattern (compare `qk` in
   queryClient.ts, or `showSuccess`/`showError` in toaster.ts) and keeps the
   bundle free of a library we would use maybe 5% of.

   Two ways in:
     - `useTranslation()` inside components — a `useSyncExternalStore` hook, so
       picking a language re-renders every call site immediately, no reload.
     - `getLocale()` / `t()` from plain module code — `currentLocale` is a
       module-level variable, not React state, so `api/http.ts`'s axios request
       interceptor (not a component) can read it for the `X-Locale` header.

   Precedence for the INITIAL locale:
     1. The signed-in user's stored profile preference — applied after login by
        `components/LocaleSync.tsx`, which calls `setLocale()`.
     2. This device's previous explicit pick (localStorage, below).
     3. The browser's own languages (`navigator.languages`, base-subtag match).
     4. "hr".
   An explicit pick persists to localStorage immediately, and to the profile
   too when signed in (LocaleSync watches for it).

   LAZY LOADING (locales): `hrCore` is the only dictionary bundled into the
   entry chunk. It is also the fallback for every missing key (see `translate`
   below), so a synchronous `t()` must have it before anything else has
   loaded. Every other locale is fetched with a dynamic `import()` — in `localeLoaders`
   — kicked off eagerly the moment it becomes the current locale (at module
   load for a stored/detected non-hr locale, or from `setLocale`) and cached
   into `dictionaries` once it resolves. Until then `lookup()` transparently
   serves `hr` for that locale (never throws, never blocks `t()`), and once
   the chunk lands every `useSyncExternalStore` subscriber is notified so the
   tree re-renders into the real translations. A failed fetch (offline, a
   stale deploy after a redeploy changed chunk hashes) is swallowed — the app
   just keeps rendering Croatian instead of spinning or crashing.

   LAZY LOADING (namespaces): four namespaces are route-scoped and are not in
   the entry chunk either — see `namespaceLoaders` / `loadNamespace` below.

   ADDING A LANGUAGE: create `./en/` with the same namespace files typed
   against `hr`, then register a loader in `localeLoaders`, the four
   route-scoped ones in `namespaceLoaders`, and an entry in `LOCALE_LABELS`
   below. Nothing else changes — `Locale`, `LOCALES`, the storage round-trip
   and the browser detection are all derived from `localeLoaders`, and
   `namespaceLoaders` is typed `Record<Locale, …>` so a half-registered
   language is a compile error.
   ────────────────────────────────────────────────────────────────────── */

/** Every locale other than `hr`, and how to fetch its dictionary. Kept
 *  separate from `dictionaries` (below) because that one only holds what has
 *  actually been loaded, while `Locale`/`LOCALES`/`isLocale` must recognise a
 *  locale immediately, before its chunk has arrived. */
const localeLoaders = {
    sl: () => import("./sl").then((mod) => mod.sl),
} as const

export type Locale = "hr" | keyof typeof localeLoaders
export type { CoreDictionary, Dictionary }

/** Every supported locale, in menu order. Derived from `localeLoaders` so a
 *  new language cannot be half-registered. */
export const LOCALES: Locale[] = ["hr", ...(Object.keys(localeLoaders) as Locale[])]

export const DEFAULT_LOCALE: Locale = "hr"

/** Display metadata for the switcher. `code` is what the compact navbar
 *  button shows; `name` is the accessible label / menu item. */
export const LOCALE_LABELS: Record<Locale, { name: string; code: string; flag: string }> = {
    hr: { name: "Hrvatski", code: "HR", flag: "🇭🇷" },
    sl: { name: "Slovenščina", code: "SL", flag: "🇸🇮" },
}

const STORAGE_KEY = "bela:locale"

export function isLocale(value: unknown): value is Locale {
    return value === DEFAULT_LOCALE
        || (typeof value === "string" && Object.prototype.hasOwnProperty.call(localeLoaders, value))
}

/** Core dictionaries actually in memory. `hr` is always here; everything else
 *  is filled in by `loadDictionaryFor` once its chunk resolves. */
const dictionaries: Partial<Record<Locale, CoreDictionary>> = { hr: hrCore }

/* ─────────────────── route-scoped namespaces ───────────────────
 * `admin`, `legal`, `game` and `blok` are ~46 kB of Croatian source that only
 * four route subtrees ever read, and the same again in Slovenian. Keeping
 * them in the eager dictionary meant every visitor to the landing route paid
 * for the privacy policy's prose and the online game's table chatter.
 *
 * They are dynamic imports instead, one chunk per (namespace, locale),
 * registered here as they resolve. The rule that makes this invisible to the
 * user: A NAMESPACE CHUNK IS AWAITED TOGETHER WITH THE PAGE CHUNK THAT NEEDS
 * IT. `App.tsx` wraps each route's factory in
 *
 *     lazyWithReload(() => Promise.all([import("./pages/PrivacyPage"),
 *                                       loadNamespace("legal")]).then(([m]) => m))
 *
 * so React's Suspense fallback covers the dictionary exactly as it covers the
 * page, and the page's first paint already has its strings. A component that
 * reads one of these namespaces OUTSIDE its route (the two nav bars used to)
 * must either move its key into a core namespace or call `loadNamespace()`
 * itself before rendering the string.
 *
 * hr is ALWAYS fetched for a requested namespace, even when the active locale
 * is not hr: it is the source of truth and `translate()`'s fallback, so it is
 * what keeps a language switch showing Croatian text rather than raw keys
 * while the other locale's chunk is still in flight. The active locale's own
 * chunk is best-effort for the same reason — key parity is compile-enforced,
 * so falling back to hr is always a complete answer.
 */

export const LAZY_NAMESPACES = ["admin", "legal", "game", "blok"] as const

/** A namespace that is NOT in the entry bundle. `t("legal.x")` only resolves
 *  after `loadNamespace("legal")` has settled. */
export type LazyNamespace = (typeof LAZY_NAMESPACES)[number]

/** One loader per (namespace, locale). `Record<Locale, …>` is what forces a
 *  new language to provide all four; the per-namespace return type is what
 *  keeps each file typed against its Croatian counterpart. */
type NamespaceLoaders = {
    [N in LazyNamespace]: Record<Locale, () => Promise<LazyNamespaces[N]>>
}

const namespaceLoaders: NamespaceLoaders = {
    admin: {
        hr: () => import("./hr/admin").then((mod) => mod.admin),
        sl: () => import("./sl/admin").then((mod) => mod.admin),
    },
    legal: {
        hr: () => import("./hr/legal").then((mod) => mod.legal),
        sl: () => import("./sl/legal").then((mod) => mod.legal),
    },
    game: {
        hr: () => import("./hr/game").then((mod) => mod.game),
        sl: () => import("./sl/game").then((mod) => mod.game),
    },
    blok: {
        hr: () => import("./hr/blok").then((mod) => mod.blok),
        sl: () => import("./sl/blok").then((mod) => mod.blok),
    },
}

/** Flat key→string tables, exactly the shape `lookup` indexes into. */
type NamespaceTable = Record<string, string>

/** What has actually arrived, per locale. Kept beside `dictionaries` rather
 *  than merged into it: a namespace can land before (or without) its locale's
 *  core chunk, and mutating a dictionary object that has not been assigned
 *  yet would silently drop the registration. */
const loadedNamespaces: Partial<Record<Locale, Partial<Record<LazyNamespace, NamespaceTable>>>> = {}

/** Every namespace some route has asked for. Replayed on `setLocale` so a
 *  language switch re-fetches exactly the namespaces currently on screen. */
const requestedNamespaces = new Set<LazyNamespace>()

/** One in-flight (or settled) promise per (locale, namespace). */
const namespacePromises = new Map<string, Promise<void>>()

function fetchNamespace(locale: Locale, namespace: LazyNamespace): Promise<void> {
    if (loadedNamespaces[locale]?.[namespace]) return Promise.resolve()
    const cacheKey = `${locale}:${namespace}`
    let promise = namespacePromises.get(cacheKey)
    if (!promise) {
        promise = namespaceLoaders[namespace][locale]()
            .then((table) => {
                const perLocale = loadedNamespaces[locale] ?? (loadedNamespaces[locale] = {})
                perLocale[namespace] = table as unknown as NamespaceTable
            })
            .catch((err) => {
                // Allow a later retry (a second navigation, the next cold
                // load) instead of caching the failure forever.
                namespacePromises.delete(cacheKey)
                throw err
            })
        namespacePromises.set(cacheKey, promise)
    }
    return promise
}

/**
 * Make `namespace` resolvable by `t()`. Await this ALONGSIDE the page chunk
 * that needs it (see `App.tsx`) — never after first paint, or the page flashes
 * raw keys.
 *
 * REJECTS if Croatian's chunk cannot be fetched, deliberately: wrapped in
 * `lazyWithReload`'s factory it then gets the same treatment as a missing page
 * chunk — one recovery reload after a deploy changed the hashes, and the
 * honest offline notice when there is no signal — instead of rendering a page
 * full of dotted key names. The ACTIVE locale's own chunk is best-effort: a
 * failure there falls back to Croatian text, which is a complete answer.
 */
export function loadNamespace(namespace: LazyNamespace): Promise<void> {
    requestedNamespaces.add(namespace)
    const locale = currentLocale
    const jobs: Promise<unknown>[] = [fetchNamespace(DEFAULT_LOCALE, namespace)]
    if (locale !== DEFAULT_LOCALE) {
        jobs.push(fetchNamespace(locale, namespace).catch(() => {}))
    }
    return Promise.all(jobs).then(() => {
        if (currentLocale === locale) notify()
    })
}

// One in-flight (or settled) load promise per locale, so a locale switched to
// twice in a row — or hit by both the module-scope kick-off and an early
// `setLocale` — only triggers a single `import()`.
const loadPromises = new Map<Locale, Promise<void>>()

/** Fetch `locale`'s dictionary chunk if it isn't already loaded or loading,
 *  and notify subscribers once it lands — but only if `locale` is still the
 *  active one, so a fast switch-away-and-back doesn't re-render into a
 *  language the user already left. Never throws: a failed fetch (offline, a
 *  stale deploy) is swallowed and `lookup()` keeps serving `hr`. */
function loadDictionaryFor(locale: Locale): void {
    if (dictionaries[locale]) return
    const loader = (localeLoaders as Partial<Record<Locale, () => Promise<Dictionary>>>)[locale]
    if (!loader) return
    let promise = loadPromises.get(locale)
    if (!promise) {
        promise = loader()
            .then((dict) => {
                dictionaries[locale] = dict
            })
            .catch(() => {
                // Offline or a stale deploy referencing a chunk hash that no
                // longer exists — allow a later retry (another pick, or the
                // next cold load) instead of caching the failure forever.
                loadPromises.delete(locale)
            })
        loadPromises.set(locale, promise)
    }
    void promise.then(() => {
        if (currentLocale === locale) notify()
    })
}

/** First supported locale among the browser's preferred languages, matched by
 *  base subtag ("sl-SI" → "sl"). `DEFAULT_LOCALE` when none match. */
function detectBrowserLocale(): Locale {
    try {
        const candidates = navigator.languages?.length ? navigator.languages : [navigator.language]
        for (const lang of candidates) {
            const base = lang?.split("-")[0]?.toLowerCase()
            if (isLocale(base)) return base
        }
    } catch {
        /* no navigator (SSR / very old browser) — fall through */
    }
    return DEFAULT_LOCALE
}

function loadInitial(): Locale {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (isLocale(stored)) return stored
    } catch {
        /* private mode — fall through to browser detection */
    }
    return detectBrowserLocale()
}

let currentLocale: Locale = loadInitial()
const listeners = new Set<() => void>()

// `useSyncExternalStore` re-renders a subscriber ONLY when its snapshot
// changes (`Object.is` on the returned value) — calling `onStoreChange` alone
// is not enough. A dictionary finishing its load does not change
// `currentLocale` itself (it changed the moment `setLocale` ran), so if
// `getSnapshot` returned the bare `Locale` string, this second notification
// would be a no-op: React would see the same string and skip the re-render,
// leaving components stuck on the `hr` text from the first render. Wrapping
// the locale in a fresh object every time `notify()` runs gives React a new
// reference to compare against, so BOTH notifications — the immediate locale
// flip and the later dictionary arrival — actually trigger a render.
let snapshot: { locale: Locale } = { locale: currentLocale }

function getSnapshot(): { locale: Locale } {
    return snapshot
}

/** Bump the snapshot and wake every `useSyncExternalStore` subscriber. The
 *  only way `listeners` should ever be walked — never call `.forEach` on it
 *  directly, or a locale-unchanged notification (the dictionary-loaded case)
 *  silently fails to re-render anything. */
function notify(): void {
    snapshot = { locale: currentLocale }
    listeners.forEach((fn) => fn())
}

// Keep <html lang> honest from the very first paint: screen readers and the
// browser's own translation prompt read it, and it is part of what search
// engines use to decide which audience a page is for.
applyDocumentLang(currentLocale)

// Cold load into a non-hr locale (stored pick or browser detection): kick off
// its chunk immediately rather than waiting for a render or a `setLocale`
// call. `t()` already has an answer in the meantime via `hr` — see `lookup`.
loadDictionaryFor(currentLocale)

function applyDocumentLang(locale: Locale) {
    try {
        document.documentElement.lang = locale
    } catch {
        /* no DOM — nothing to set */
    }
}

/** The active locale, readable from NON-COMPONENT code (the axios request
 *  interceptor in `api/http.ts` sends it as `X-Locale`). */
export function getLocale(): Locale {
    return currentLocale
}

/** Switch the app's language everywhere and persist the choice on this
 *  device. Every `useTranslation()` / `useLocale()` call site re-renders
 *  immediately — `useLocale()` reflects `next` right away so the picker never
 *  shows a stale selection, even while `next`'s dictionary is still in
 *  flight; `t()` keeps answering from `hr` (via `lookup`'s fallback) until it
 *  lands, then a second, automatic re-render swaps in the real text.
 *  Signed-in users also get it saved to their profile — see `LocaleSync`. */
export function setLocale(next: Locale): void {
    if (!isLocale(next) || next === currentLocale) return
    currentLocale = next
    try {
        localStorage.setItem(STORAGE_KEY, next)
    } catch {
        /* private mode — the pick just won't survive a reload */
    }
    applyDocumentLang(next)
    notify()
    loadDictionaryFor(next)
    // Replay the route-scoped namespaces the app has asked for so far: the
    // page on screen is almost certainly one of them, and without this a
    // switch to Slovenian on /privatnost would keep rendering the Croatian
    // policy forever (the `lookup` fallback) instead of only until the chunk
    // lands. Failures stay swallowed — Croatian is a complete answer.
    requestedNamespaces.forEach((namespace) => {
        void fetchNamespace(next, namespace)
            .then(() => {
                if (currentLocale === next) notify()
            })
            .catch(() => {})
    })
}

function subscribe(onStoreChange: () => void): () => void {
    listeners.add(onStoreChange)
    return () => {
        listeners.delete(onStoreChange)
    }
}

/** Values substituted into `{placeholder}` slots. */
export type TParams = Record<string, string | number>

/** A namespaced key, e.g. "common.save" or "common.error.http.404". Split at
 *  the FIRST dot: everything after it is the (possibly dotted) leaf name. */
export type TKey = string

const warned = new Set<string>()

function warnOnce(message: string, key: string) {
    if (!import.meta.env.DEV) return
    if (warned.has(key)) return
    warned.add(key)
    console.warn(`[i18n] ${message}`)
}

/** The flat table behind one namespace for one locale, or `undefined` when
 *  this locale has not got it (yet): a core chunk still in flight, or a
 *  route-scoped namespace nobody on screen has asked for. */
function namespaceTable(locale: Locale, namespace: string): NamespaceTable | undefined {
    const lazy = loadedNamespaces[locale]?.[namespace as LazyNamespace]
    if (lazy) return lazy
    const dict = dictionaries[locale]
    if (!dict) return undefined
    return (dict as unknown as Record<string, NamespaceTable | undefined>)[namespace]
}

function lookup(locale: Locale, key: TKey): string | undefined {
    const dot = key.indexOf(".")
    if (dot <= 0) return undefined
    const namespace = key.slice(0, dot)
    const leaf = key.slice(dot + 1)
    // A locale's table for this namespace is briefly absent right after a cold
    // load into, or a `setLocale` switch to, a locale whose chunk hasn't
    // resolved yet — and likewise while a route-scoped namespace is being
    // fetched for the locale just switched to. Serve Croatian's table rather
    // than throwing, exactly as this did before namespaces became lazy.
    //
    // NB this falls back on a WHOLE MISSING TABLE only. A table that IS loaded
    // but lacks the leaf returns undefined and goes through `translate`'s
    // fallback (with the dev warning) — which is what keeps `translatePlural`'s
    // "ask the requested locale, not Croatian" contract for Slovenian's dual.
    const table = namespaceTable(locale, namespace) ?? namespaceTable(DEFAULT_LOCALE, namespace)
    return table?.[leaf]
}

function interpolate(template: string, params?: TParams): string {
    if (!params) return template
    // Unknown placeholders are left verbatim rather than blanked — a visible
    // "{count}" in the UI is a far louder bug report than a silent gap.
    return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole,
    )
}

/**
 * Resolve `key` in `locale`, falling back to the Croatian string when the
 * locale has no entry for it (and, only if Croatian has none either, to the
 * key itself — a user must never be shown a raw key that hr could have
 * answered). Both fallbacks `console.warn` once per key in dev builds.
 */
export function translate(locale: Locale, key: TKey, params?: TParams): string {
    const hit = lookup(locale, key)
    if (hit !== undefined) return interpolate(hit, params)

    if (locale !== DEFAULT_LOCALE) {
        const fallback = lookup(DEFAULT_LOCALE, key)
        if (fallback !== undefined) {
            warnOnce(`missing "${key}" for "${locale}" — using "${DEFAULT_LOCALE}"`, `${locale}:${key}`)
            return interpolate(fallback, params)
        }
    }
    warnOnce(`unknown key "${key}"`, `*:${key}`)
    return key
}

/** True when Croatian (the source of truth) defines `key`. For call sites that
 *  choose between a specific string and a generic one — e.g. `statusFallback`
 *  in `toaster.ts` picking "common.error.http.404" over the {status} catch-all. */
export function hasTranslation(key: TKey): boolean {
    return lookup(DEFAULT_LOCALE, key) !== undefined
}

/**
 * Translate for the CURRENT locale from non-component code (a plain helper, a
 * module-scope table, the toaster). Reads `currentLocale` at call time, so it
 * is correct whenever it runs — but it does not subscribe to anything, so a
 * value computed once and cached will not update on a language switch. Inside
 * components use `useTranslation()`.
 */
export function t(key: TKey, params?: TParams): string {
    return translate(currentLocale, key, params)
}

/** The active locale itself — for the switcher to know what is selected.
 *  Re-renders on every `setLocale()` AND once more when a lazily-loaded
 *  dictionary finishes fetching (see `notify`), even though `currentLocale`
 *  itself doesn't change at that second point. */
export function useLocale(): Locale {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot).locale
}

/**
 * Component-facing translator. Re-renders the calling component on every
 * language change.
 *
 *   const { t } = useTranslation()
 *   <Button>{t("common.save")}</Button>
 *   <Text>{t("common.error.http.unknown", { status: 418 })}</Text>
 */
export function useTranslation(): { t: (key: TKey, params?: TParams) => string; locale: Locale } {
    const locale = useLocale()
    return {
        t: (key: TKey, params?: TParams) => translate(locale, key, params),
        locale,
    }
}

/* ─────────────────────────── plurals ───────────────────────────
 * Croatian and Slovenian do not agree on plural categories, and neither
 * behaves like English. Croatian has three (one / few / other); Slovenian
 * has four, because it kept the dual: 1 turnir, 2 turnirja, 3-4 turnirji,
 * 5+ turnirjev. Getting this wrong is instantly visible to a native
 * speaker, so every count-dependent string goes through here rather than
 * through ad-hoc ternaries at the call site.
 *
 * Categories follow CLDR. Write dictionary keys as sibling leaves:
 *
 *   "pairsCount.one":   "{n} par"
 *   "pairsCount.two":   "{n} para"      // Slovenian only; hr may omit it
 *   "pairsCount.few":   "{n} para"
 *   "pairsCount.other": "{n} parova"
 *
 * A category the dictionary does not define falls back to `.other`, so hr
 * needs no `.two` leaf and a language added later cannot crash a render.
 */
export type PluralCategory = "one" | "two" | "few" | "other"

export function pluralCategory(locale: Locale, count: number): PluralCategory {
    const n = Math.abs(Math.trunc(count))
    const mod10 = n % 10
    const mod100 = n % 100

    if (locale === "sl") {
        // CLDR sl: one = n%100 is 1, two = n%100 is 2, few = n%100 is 3..4.
        if (mod100 === 1) return "one"
        if (mod100 === 2) return "two"
        if (mod100 === 3 || mod100 === 4) return "few"
        return "other"
    }

    // CLDR hr (and the same shape for sr/bs): the teens are the exception,
    // which is why mod100 has to be checked alongside mod10.
    if (mod10 === 1 && mod100 !== 11) return "one"
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few"
    return "other"
}

/**
 * Count-aware translator. `baseKey` names a family of leaves, not a leaf:
 * `tPlural("pages.pairsCount", 3)` resolves `pages.pairsCount.few` in
 * Croatian and `pages.pairsCount.few` in Slovenian, each with its own
 * wording. `n` is always interpolated, so `{n}` works without passing it.
 */
export function translatePlural(
    locale: Locale,
    baseKey: TKey,
    count: number,
    params?: TParams,
): string {
    const category = pluralCategory(locale, count)
    const withCount: TParams = { n: count, ...params }
    const key = `${baseKey}.${category}`
    // Against the REQUESTED locale, never `hasTranslation` — that one asks
    // Croatian, so a category hr defines and sl does not (sl's dual `.two`
    // being the live case) passed the test and rendered the Croatian string
    // instead of falling back to sl's own `.other`, which is the documented
    // contract. `translate` still covers a family missing from sl entirely.
    if (lookup(locale, key) !== undefined) {
        return translate(locale, key, withCount)
    }
    return translate(locale, `${baseKey}.other`, withCount)
}

/** Non-reactive plural translator, for helpers outside the React tree. */
export function tPlural(baseKey: TKey, count: number, params?: TParams): string {
    return translatePlural(currentLocale, baseKey, count, params)
}

/** Component-facing plural translator; re-renders on language change. */
export function usePlural(): (baseKey: TKey, count: number, params?: TParams) => string {
    const locale = useLocale()
    return (baseKey: TKey, count: number, params?: TParams) =>
        translatePlural(locale, baseKey, count, params)
}
