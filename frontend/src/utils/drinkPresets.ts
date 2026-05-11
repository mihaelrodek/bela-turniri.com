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
 */

export type DrinkPreset = {
    /** Display label, e.g. "Pivo 0,5 l". Used as the cjenik row name. */
    label: string
    /** Display category, e.g. "Pivo". Used to group items in the menu. */
    category: string
    /** Serving size in litres, kept for reference / future filtering. */
    sizeL: number
}

/**
 * Format a litre value the Croatian way: comma as decimal separator,
 * unit suffix " l". Strips trailing zeroes ("0,30 l" → "0,3 l").
 */
function fmtL(litres: number): string {
    const s = litres
        .toFixed(2)
        .replace(/0+$/, "")
        .replace(/\.$/, "")
        .replace(".", ",")
    return `${s} l`
}

function mk(category: string, sizes: number[]): DrinkPreset[] {
    return sizes.map((s) => ({
        label: `${category} ${fmtL(s)}`,
        category,
        sizeL: s,
    }))
}

/**
 * Canonical list. Order in this array drives the order in the menu —
 * grouped by category, sizes ascending.
 */
export const DRINK_PRESETS: DrinkPreset[] = [
    ...mk("Pivo", [0.2, 0.33, 0.5]),
    ...mk("Gemišt", [0.2]),
    ...mk("Sok", [0.2, 0.33, 0.5]),
    ...mk("Vino", [1]),
    ...mk("Voda", [0.5, 1]),
    ...mk("Žestoko piće", [0.02]),
]

/** Grouped view for menu rendering. Preserves the order above. */
export function groupedPresets(): { category: string; items: DrinkPreset[] }[] {
    const groups: { category: string; items: DrinkPreset[] }[] = []
    for (const p of DRINK_PRESETS) {
        let last = groups[groups.length - 1]
        if (!last || last.category !== p.category) {
            last = { category: p.category, items: [] }
            groups.push(last)
        }
        last.items.push(p)
    }
    return groups
}
