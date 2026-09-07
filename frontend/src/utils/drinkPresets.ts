/**
 * Predefined drink categories + serving sizes used in Croatian bars.
 *
 * The cjenik table itself stays free-form (just `name` and `price`) —
 * these presets are a UX helper so the owner doesn't have to type
 * "Pivo 0,5 l" by hand every time. Picking a preset adds a row with
 * a ready-made name; the owner only fills in the price.
 *
 * Sizes are stored in litres so we can format consistently with the
 * Croatian comma convention (e.g. 0.5 → "0,5 l", 0.02 → "0,02 l").
 *
 * IMPORTANT — `label` is PERSISTED. Clicking a preset chip (CjenikTab,
 * PublicProfilePage's drink-template editor) writes `label` verbatim into
 * `DrinkPriceDto.name`, which is saved to a tournament's cjenik or a user's
 * reusable drink template and sent back from the API on the next load. It
 * is also compared against existing row names (case-insensitive) to skip
 * duplicates. So `label` must stay this exact Croatian string forever —
 * translating it would corrupt stored rows and break that matching against
 * data saved before this file changed. `categoryKey` is the untranslated,
 * stable id for the DISPLAY-only category heading; it is never persisted,
 * so render code translates it via `t("common.drinkCategory.<key>")`.
 */

export type DrinkCategoryKey = "beer" | "spritzer" | "juice" | "wine" | "water" | "spirits"

/** Croatian category words used to build the persisted `label` strings.
 *  Keep byte-identical to the pre-i18n copy — never localise these. */
const CATEGORY_HR: Record<DrinkCategoryKey, string> = {
    beer: "Pivo",
    spritzer: "Gemišt",
    juice: "Sok",
    wine: "Vino",
    water: "Voda",
    spirits: "Žestoko piće",
}

export type DrinkPreset = {
    /** Display label, e.g. "Pivo 0,5 l". Used as the cjenik row name and
     *  PERSISTED — see the file-level note above. Always Croatian. */
    label: string
    /** Untranslated category id. Translate for display via
     *  `t("common.drinkCategory." + categoryKey)`; never persisted. */
    categoryKey: DrinkCategoryKey
    /** Serving size in litres, kept for reference / future filtering. */
    sizeL: number
}

/**
 * Format a litre value the Croatian way: comma as decimal separator,
 * unit suffix " l". Strips trailing zeroes ("0,30 l" → "0,3 l").
 *
 * The " l" (litre) abbreviation and comma-decimal convention are shared by
 * Croatian and Slovenian, so this formatting itself needs no locale switch —
 * it is also used directly by consumers to render a preset's size chip
 * without slicing it out of the (Croatian) `label`.
 */
export function fmtL(litres: number): string {
    const s = litres
        .toFixed(2)
        .replace(/0+$/, "")
        .replace(/\.$/, "")
        .replace(".", ",")
    return `${s} l`
}

function mk(categoryKey: DrinkCategoryKey, sizes: number[]): DrinkPreset[] {
    const hrCategory = CATEGORY_HR[categoryKey]
    return sizes.map((s) => ({
        label: `${hrCategory} ${fmtL(s)}`,
        categoryKey,
        sizeL: s,
    }))
}

/**
 * Canonical list. Order in this array drives the order in the menu —
 * grouped by category, sizes ascending.
 */
export const DRINK_PRESETS: DrinkPreset[] = [
    ...mk("beer", [0.2, 0.33, 0.5]),
    ...mk("spritzer", [0.2]),
    ...mk("juice", [0.2, 0.33, 0.5]),
    ...mk("wine", [1]),
    ...mk("water", [0.5, 1]),
    ...mk("spirits", [0.02]),
]

/** Grouped view for menu rendering. Preserves the order above. */
export function groupedPresets(): { categoryKey: DrinkCategoryKey; items: DrinkPreset[] }[] {
    const groups: { categoryKey: DrinkCategoryKey; items: DrinkPreset[] }[] = []
    for (const p of DRINK_PRESETS) {
        let last = groups[groups.length - 1]
        if (!last || last.categoryKey !== p.categoryKey) {
            last = { categoryKey: p.categoryKey, items: [] }
            groups.push(last)
        }
        last.items.push(p)
    }
    return groups
}
