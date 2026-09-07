/* ──────────────────────────────────────────────────────────────────────────
   Auto-generated room names when `room.create.name` is absent/blank
   (README §3, protocol `RoomSummary.name` doc comment).

   `adjective-noun`, two Croatian words, lowercase, ASCII-safe (diacritics
   stripped so the slug is safe everywhere a room name is echoed), matching
   bela.fun's style ("medeni-fakultet", "bijela-vrana", "stari-tigar").
   ────────────────────────────────────────────────────────────────────── */

/** ≥ 40 Croatian adjectives, ASCII-safe lowercase. */
const ADJECTIVES: readonly string[] = [
    "veseli", "tihi", "brzi", "sretni", "hrabri", "mudri", "lukavi", "divlji",
    "pospani", "gladni", "zeljni", "ponosni", "skromni", "vjerni", "radosni",
    "namrgodjeni", "zaigrani", "umorni", "budni", "snazni", "nezni", "grubi",
    "vedri", "maglovit", "suncani", "kisni", "snjezni", "topli", "hladni",
    "zlatni", "srebrni", "bakreni", "medeni", "slani", "ljuti", "sladak",
    "gorki", "kiseli", "svjezi", "star", "mlad", "novi", "stari", "visoki",
    "nizak", "siroki", "uzak", "dubok", "plitak", "tvrdoglav", "vragolast",
    "znatizeljan", "raspjevan", "zamisljen", "razigran", "pouzdan", "smion",
    "spretan", "okretan", "dosljedan", "vragolan",
] as const

/** ≥ 40 Croatian nouns, ASCII-safe lowercase. */
const NOUNS: readonly string[] = [
    "vrana", "tigar", "medvjed", "vuk", "lisica", "zec", "jelen", "sokol",
    "orao", "golub", "vrabac", "sova", "roda", "labud", "patka", "konj",
    "bik", "jarac", "ovan", "pastir", "kovac", "mlinar", "ribar", "lovac",
    "putnik", "vitez", "kralj", "knez", "seljak", "mornar", "kapetan",
    "planinar", "vinogradar", "pekar", "fakultet", "dvorac", "brijeg",
    "potok", "izvor", "cempres", "hrast", "bor", "jasen", "javor", "lipa",
    "kamen", "oblak", "vjetar", "val", "otok", "zaljev", "gradic", "trg",
    "toranj", "most", "mlin", "vinograd", "voćnjak", "livada", "gaj",
] as const

function pick<T>(list: readonly T[]): T {
    const item = list[Math.floor(Math.random() * list.length)]
    // Lists above are non-empty constants; this is unreachable but keeps TS happy.
    if (item === undefined) throw new Error("roomNames: empty word list")
    return item
}

/** `adjective-noun`, e.g. "medeni-fakultet". Always matches `/^[a-z]+-[a-z]+$/`. */
export function randomRoomName(): string {
    return `${pick(ADJECTIVES)}-${pick(NOUNS)}`
}
