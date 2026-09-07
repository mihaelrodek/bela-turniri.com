/* ──────────────────────────────────────────────────────────────────────────
   Tiny leveled logger. One JSON-ish line per record on stdout, ISO timestamp.
   No dependencies — the server bundle stays `ws` + `jose` only.
   ────────────────────────────────────────────────────────────────────── */

export type LogLevel = "error" | "warn" | "info" | "debug"

const ORDER: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 }

let current: LogLevel = "info"

export function setLogLevel(level: LogLevel): void {
    current = level
}

export function getLogLevel(): LogLevel {
    return current
}

export function isLogLevel(x: unknown): x is LogLevel {
    return x === "error" || x === "warn" || x === "info" || x === "debug"
}

function safe(value: unknown): unknown {
    if (value instanceof Error) return { name: value.name, message: value.message }
    return value
}

function emit(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
    if (ORDER[level] > ORDER[current]) return
    const rec: Record<string, unknown> = {
        ts: new Date().toISOString(),
        level,
        msg,
    }
    if (fields) {
        for (const [k, v] of Object.entries(fields)) rec[k] = safe(v)
    }
    let line: string
    try {
        line = JSON.stringify(rec)
    } catch {
        line = JSON.stringify({ ts: rec["ts"], level, msg, note: "unserialisable fields" })
    }
    if (level === "error" || level === "warn") process.stderr.write(line + "\n")
    else process.stdout.write(line + "\n")
}

export const log = {
    error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
    warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
    info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
    debug: (msg: string, fields?: Record<string, unknown>) => emit("debug", msg, fields),
}
