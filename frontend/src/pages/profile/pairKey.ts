/** Lower-cased trimmed name match — same key the backend groups pairs by. */
export function pairKey(name: string): string {
    return name.trim().toLowerCase()
}
