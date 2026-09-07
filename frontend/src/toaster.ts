import { createToaster } from "@chakra-ui/react"
import { hasTranslation, t } from "./i18n"

/**
 * Single shared toaster instance. Components and the axios interceptor
 * (api/http.ts) push notifications onto this; the actual rendering happens
 * via the <Toaster toaster={toaster} /> mounted near the root in main.tsx.
 *
 * Why one shared instance: notifications need to outlive route changes —
 * if you POST a tournament create and then we navigate away to the
 * detail page, the success toast must keep ticking down on the new page.
 * A per-component toaster would be torn down and miss that.
 */
export const toaster = createToaster({
    placement: "top",
    pauseOnPageIdle: true,
    overlap: true,
    max: 5,
})

/**
 * Copy for common HTTP errors, used by the axios interceptor only when the
 * backend hasn't returned a useful body message of its own.
 *
 * The table itself now lives in the dictionaries (`common.error.http.<status>`
 * in src/i18n/{hr,sl}/common.ts) — the Croatian wording is unchanged. `t()`
 * rather than `useTranslation()` because this is called from the interceptor,
 * which is not a component; it reads the live `currentLocale` at call time.
 * `hasTranslation` picks the specific string when we have one and the
 * {status} catch-all otherwise.
 */
export function statusFallback(status?: number): string {
    if (!status) return t("common.error.network")
    const key = `common.error.http.${status}`
    return hasTranslation(key) ? t(key) : t("common.error.http.unknown", { status })
}

export function showSuccess(title: string, description?: string) {
    toaster.create({
        type: "success",
        title,
        description,
        duration: 3500,
    })
}

export function showError(title: string, description?: string) {
    // Dedupe identical errors into a single toast. On a page that fires
    // several requests at once (e.g. /turniri: upcoming + finished + count), a
    // backend outage would otherwise stack three copies of "Greška na
    // poslužitelju". A stable id keyed on the message collapses them — if one
    // is already on screen we just refresh it instead of adding another.
    const id = `err:${title}:${description ?? ""}`
    if (toaster.isVisible(id)) {
        toaster.update(id, { type: "error", title, description, duration: 5500 })
        return
    }
    toaster.create({
        id,
        type: "error",
        title,
        description,
        duration: 5500,
    })
}
