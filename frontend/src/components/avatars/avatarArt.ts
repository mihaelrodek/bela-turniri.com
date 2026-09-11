/* ──────────────────────────────────────────────────────────────────────────
   Bela Turniri avatar set — flat vector portraits a player can pick instead
   of uploading a photo.

   ORIGINAL ARTWORK. Drawn from primitives in this file: nothing is traced,
   copied or derived from another app's asset, which matters because the
   brief that started this ("nešto u tom stilu, ne isto") was explicitly
   about not lifting someone else's set. The family resemblance to other
   flat-illustration avatars is the style — rounded-square head, solid
   fills, no gradients, no outlines — not the drawing.

   WHY A STRING BUILDER AND NOT JSX
   ────────────────────────────────
   `buildAvatarSvg` returns SVG markup as a string, and the React wrapper
   (`BelaAvatar.tsx`) drops it in with `dangerouslySetInnerHTML`. That is
   safe here and only here: every value interpolated below comes from the
   frozen `AVATARS` table in this same file — there is no user input on any
   path into this function, and `AvatarId` is a union of the table's own
   keys, so a caller cannot even name a preset that does not exist.

   The reason for the string form is that the same function has to render
   OUTSIDE React too: the preview gallery, and later the share/OG cards,
   which are built server-side. One builder, one set of drawings, no second
   copy of the geometry to keep in sync.

   COORDINATES
   ───────────
   Everything is drawn in a 128×128 box and clipped to the full-bleed circle,
   so the art survives any `border-radius` the caller puts on it. The head is
   a rounded square (x 34…94, y 26…90) and the shoulders rise from y 94, which
   is what leaves room for headwear above y 26 without it touching the rim.
   ────────────────────────────────────────────────────────────────────── */

/* ───────────────────────────── palette ───────────────────────────── */

/** Card-table colours: felt greens, mađarice red and gold, ink and cream.
 *  Deliberately few — a small palette is what makes twelve separate drawings
 *  read as one set. */
const C = {
    ink: "#241C16",
    shade: "#00000022",
    cream: "#F6EFE0",
    skinLight: "#F3D3B3",
    skinMid: "#E5B187",
    skinTan: "#C98A5C",
    skinDeep: "#8E5C36",
    hairDark: "#2E2722",
    hairBrown: "#6B4A2E",
    hairBlond: "#D9B44A",
    hairGrey: "#BDBAB4",
    hairGinger: "#B04A28",
    green: "#2F8F52",
    greenDeep: "#1E5C36",
    greenDark: "#173D26",
    red: "#B4342A",
    redDeep: "#7E241D",
    gold: "#D9A521",
    goldDeep: "#A87A12",
    navy: "#2C3E50",
    navyDeep: "#1E2B38",
    plum: "#6B3550",
    slate: "#4A5A63",
} as const

/* ───────────────────────── suit watermarks ───────────────────────── */

/** The four mađarice suits, drawn large and faint behind the head. It is the
 *  one thing in the set that says "bela" rather than "generic avatar": at 13 %
 *  it reads as texture at 40 px and as a recognisable suit at 96 px. 8 % was
 *  the first try and simply vanished. */
const SUITS = {
    herc: "M64 34c-11-17-33-9-33 9 0 16 20 27 33 38 13-11 33-22 33-38 0-18-22-26-33-9z",
    pik: "M64 12c-15 18-28 28-28 41 0 11 9 18 17 15l-4 16h30l-4-16c8 3 17-4 17-15 0-13-13-23-28-41z",
    zir: "M64 26c-11 0-19 7-19 16 0 10 8 18 19 18s19-8 19-18c0-9-8-16-19-16zm-22 12h44a5 5 0 0 1 0 10H42a5 5 0 0 1 0-10z",
    bundeva: "M64 20c-13 0-21 11-21 24v15h42V44c0-13-8-24-21-24zM40 63h48a4 4 0 0 1 0 8H40a4 4 0 0 1 0-8z",
} as const

type Suit = keyof typeof SUITS

/* ───────────────────────────── parts ───────────────────────────── */

type Hair = "short" | "long" | "bun" | "ponytail" | "swept" | "none"
type Face = "clean" | "moustache" | "beard" | "goatee" | "stubble"
type Hat = "none" | "crown" | "flatcap" | "beanie" | "scarf" | "visor"
type Extra = "none" | "monocle" | "glasses" | "earring" | "chain" | "pipe"
/** Faces are what keep twelve avatars from reading as one avatar in twelve
 *  hats — the head, eyes and skin are shared geometry, so the mouth and the
 *  brows are doing all the work of telling people apart. */
type Mouth = "smile" | "grin" | "flat" | "smirk" | "open"
type Brow = "none" | "flat" | "raised" | "furrowed"

function hair(kind: Hair, colour: string): string {
    switch (kind) {
        case "short":
            return `<path d="M32 54C32 29 44 18 64 18s32 11 32 36c0-12-11-18-32-18s-32 6-32 18z" fill="${colour}"/>`
        case "swept":
            return `<path d="M32 54C32 29 44 18 64 18c22 0 32 12 32 30 0-10-14-14-30-11-12 2-22 6-22 17z" fill="${colour}"/>`
        case "long":
            return `<path d="M32 54C32 29 44 18 64 18s32 11 32 36c0-12-11-18-32-18s-32 6-32 18z" fill="${colour}"/>`
                + `<path d="M30 48h9v42a5 5 0 0 1-9 0z" fill="${colour}"/>`
                + `<path d="M89 48h9v42a5 5 0 0 1-9 0z" fill="${colour}"/>`
        case "bun":
            return `<circle cx="64" cy="17" r="11" fill="${colour}"/>`
                + `<path d="M32 54C32 29 44 20 64 20s32 9 32 34c0-12-11-18-32-18s-32 6-32 18z" fill="${colour}"/>`
        case "ponytail":
            return `<path d="M32 54C32 29 44 18 64 18s32 11 32 36c0-12-11-18-32-18s-32 6-32 18z" fill="${colour}"/>`
                + `<path d="M92 48c13 7 15 24 9 38-2 6-11 4-10-2 4-13 3-24-6-30z" fill="${colour}"/>`
        case "none":
            return ""
    }
}

function facialHair(kind: Face, colour: string): string {
    switch (kind) {
        case "moustache":
            return `<path d="M50 70c9-5 19-5 28 0-4 7-9 9-14 9s-10-2-14-9z" fill="${colour}"/>`
        case "beard":
            return `<path d="M36 62v12c0 17 12 28 28 28s28-11 28-28V62c-5 13-15 18-28 18s-23-5-28-18z" fill="${colour}"/>`
                + `<path d="M50 68c9-4 19-4 28 0-4 6-9 8-14 8s-10-2-14-8z" fill="${colour}"/>`
        case "goatee":
            return `<path d="M50 68c9-4 19-4 28 0-4 6-9 8-14 8s-10-2-14-8z" fill="${colour}"/>`
                + `<path d="M56 80h16v9c0 7-4 11-8 11s-8-4-8-11z" fill="${colour}"/>`
        case "stubble":
            return `<path d="M38 66v8c0 15 11 26 26 26s26-11 26-26v-8c-4 12-14 17-26 17s-22-5-26-17z" fill="${colour}" opacity="0.28"/>`
        case "clean":
            return ""
    }
}

function hat(kind: Hat, colour: string, accent: string): string {
    switch (kind) {
        case "crown":
            return `<path d="M36 28 42 8l11 11L64 4l11 15 11-11 6 20z" fill="${colour}"/>`
                + `<rect x="34" y="26" width="60" height="10" rx="5" fill="${colour}"/>`
                + `<circle cx="64" cy="14" r="4" fill="${accent}"/>`
                + `<circle cx="45" cy="31" r="3" fill="${accent}"/>`
                + `<circle cx="83" cy="31" r="3" fill="${accent}"/>`
        case "flatcap":
            return `<path d="M33 40C33 22 45 13 64 13s31 9 31 27z" fill="${colour}"/>`
                + `<path d="M26 40c25-7 51-7 76 0 0 7-4 9-10 9H36c-6 0-10-2-10-9z" fill="${accent}"/>`
        case "beanie":
            return `<path d="M33 42C33 23 45 14 64 14s31 9 31 28z" fill="${colour}"/>`
                + `<rect x="29" y="38" width="70" height="11" rx="5.5" fill="${accent}"/>`
                + `<circle cx="64" cy="9" r="7" fill="${accent}"/>`
        case "scarf":
            return `<path d="M30 58C30 29 44 17 64 17s34 12 34 41c0-12-12-19-34-19s-34 7-34 19z" fill="${colour}"/>`
                + `<path d="M30 56c-4 14 0 26 8 32 4-9 3-22-8-32z" fill="${accent}"/>`
                + `<path d="M98 56c4 14 0 26-8 32-4-9-3-22 8-32z" fill="${accent}"/>`
        case "visor":
            return `<path d="M33 38C33 21 45 13 64 13s31 8 31 25z" fill="${colour}"/>`
                + `<path d="M31 38h66v6a4 4 0 0 1-4 4H35a4 4 0 0 1-4-4z" fill="${accent}"/>`
                + `<circle cx="64" cy="26" r="6" fill="${accent}"/>`
        case "none":
            return ""
    }
}

function extra(kind: Extra): string {
    switch (kind) {
        case "monocle":
            return `<circle cx="77" cy="58" r="11" fill="#FFFFFF" opacity="0.22"/>`
                + `<circle cx="77" cy="58" r="11" fill="none" stroke="${C.gold}" stroke-width="3"/>`
                + `<path d="M77 69c1 10-3 16-10 19" fill="none" stroke="${C.gold}" stroke-width="2.5" stroke-linecap="round"/>`
        case "glasses":
            return `<circle cx="51" cy="58" r="11" fill="#FFFFFF" opacity="0.2"/>`
                + `<circle cx="77" cy="58" r="11" fill="#FFFFFF" opacity="0.2"/>`
                + `<circle cx="51" cy="58" r="11" fill="none" stroke="${C.ink}" stroke-width="3"/>`
                + `<circle cx="77" cy="58" r="11" fill="none" stroke="${C.ink}" stroke-width="3"/>`
                + `<path d="M62 58h4M34 55l6 2M94 55l-6 2" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/>`
        case "earring":
            return `<circle cx="94" cy="66" r="4" fill="${C.gold}"/>`
        case "chain":
            return `<path d="M52 99c7 9 17 9 24 0" fill="none" stroke="${C.gold}" stroke-width="3" stroke-linecap="round"/>`
                + `<circle cx="64" cy="106" r="4" fill="${C.gold}"/>`
        case "pipe":
            return `<path d="M76 82c8 0 12 3 13 8" fill="none" stroke="${C.hairBrown}" stroke-width="3.5" stroke-linecap="round"/>`
                + `<path d="M86 88h12v9a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z" fill="${C.hairBrown}"/>`
        case "none":
            return ""
    }
}

function mouth(kind: Mouth, beardy: boolean): string {
    // A mouth sitting on a beard has to be shorter, or it runs past the hair
    // into bare skin and reads as a scar.
    const w = beardy ? 6 : 8
    switch (kind) {
        case "smile":
            return `<path d="M${64 - w} 74c${w} 6 ${w * 2} 6 ${w * 2} 0" fill="none" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/>`
        case "grin":
            return `<path d="M${64 - w} 72a${w} ${w} 0 0 0 ${w * 2} 0z" fill="${C.ink}"/>`
        case "flat":
            return `<path d="M${64 - w} 76h${w * 2}" fill="none" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/>`
        case "smirk":
            return `<path d="M${64 - w} 76c${w} 4 ${w * 2} 1 ${w * 2} -4" fill="none" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/>`
        case "open":
            return `<ellipse cx="64" cy="76" rx="${w - 1}" ry="5" fill="${C.ink}"/>`
    }
}

function brows(kind: Brow, colour: string): string {
    switch (kind) {
        case "flat":
            return `<rect x="44" y="46" width="15" height="4.5" rx="2.2" fill="${colour}"/>`
                + `<rect x="69" y="46" width="15" height="4.5" rx="2.2" fill="${colour}"/>`
        case "raised":
            return `<rect x="44" y="47" width="15" height="4.5" rx="2.2" fill="${colour}"/>`
                + `<rect x="69" y="42" width="15" height="4.5" rx="2.2" fill="${colour}"/>`
        case "furrowed":
            return `<path d="M44 44l15 5v4l-15-5z" fill="${colour}"/>`
                + `<path d="M84 44l-15 5v4l15-5z" fill="${colour}"/>`
        case "none":
            return ""
    }
}

/* ───────────────────────────── presets ───────────────────────────── */

export interface AvatarSpec {
    /** Circle behind the character. */
    bg: string
    /** Faint mađarice suit drawn on that circle. */
    suit: Suit
    skin: string
    hair: Hair
    hairColour: string
    face: Face
    hat: Hat
    hatColour: string
    hatAccent: string
    clothes: string
    collar: string
    extra: Extra
    mouth: Mouth
    brows: Brow
}

/**
 * The twelve pickable avatars.
 *
 * They are people you actually meet at a bela table — the old boy in a flat
 * cap, the barman, the one with the pipe who kibitzes — plus the four court
 * cards the game itself is named after. Ids are stable strings because they
 * end up stored against a profile; renaming one would orphan every player who
 * picked it, so treat this table as append-only.
 */
export const AVATARS = {
    kralj: {
        bg: C.greenDeep, suit: "herc", skin: C.skinLight,
        hair: "none", hairColour: C.hairGrey, face: "beard",
        hat: "crown", hatColour: C.gold, hatAccent: C.red,
        clothes: C.red, collar: C.gold, extra: "chain",
        mouth: "flat", brows: "flat",
    },
    baba: {
        bg: C.plum, suit: "bundeva", skin: C.skinLight,
        hair: "bun", hairColour: C.hairBlond, face: "clean",
        hat: "none", hatColour: C.gold, hatAccent: C.red,
        clothes: C.green, collar: C.cream, extra: "earring",
        mouth: "smile", brows: "raised",
    },
    decko: {
        bg: C.navy, suit: "pik", skin: C.skinMid,
        hair: "swept", hairColour: C.hairBrown, face: "stubble",
        hat: "none", hatColour: C.green, hatAccent: C.greenDeep,
        clothes: C.gold, collar: C.navyDeep, extra: "none",
        mouth: "grin", brows: "raised",
    },
    dida: {
        bg: C.slate, suit: "zir", skin: C.skinLight,
        hair: "none", hairColour: C.hairGrey, face: "moustache",
        hat: "flatcap", hatColour: C.greenDeep, hatAccent: C.greenDark,
        clothes: C.cream, collar: C.red, extra: "pipe",
        mouth: "smirk", brows: "furrowed",
    },
    baka: {
        bg: C.redDeep, suit: "herc", skin: C.skinLight,
        hair: "bun", hairColour: C.hairGrey, face: "clean",
        hat: "scarf", hatColour: C.red, hatAccent: C.cream,
        clothes: C.cream, collar: C.green, extra: "glasses",
        mouth: "smile", brows: "none",
    },
    gazda: {
        bg: C.greenDark, suit: "bundeva", skin: C.skinTan,
        hair: "short", hairColour: C.hairDark, face: "moustache",
        hat: "none", hatColour: C.gold, hatAccent: C.red,
        clothes: C.navy, collar: C.gold, extra: "chain",
        mouth: "flat", brows: "furrowed",
    },
    konobar: {
        bg: C.navyDeep, suit: "pik", skin: C.skinLight,
        hair: "swept", hairColour: C.hairDark, face: "clean",
        hat: "none", hatColour: C.navy, hatAccent: C.cream,
        clothes: C.cream, collar: C.ink, extra: "none",
        mouth: "smile", brows: "flat",
    },
    cura: {
        bg: C.green, suit: "herc", skin: C.skinMid,
        hair: "ponytail", hairColour: C.hairBrown, face: "clean",
        hat: "none", hatColour: C.red, hatAccent: C.cream,
        clothes: C.red, collar: C.cream, extra: "none",
        mouth: "grin", brows: "none",
    },
    momak: {
        bg: C.greenDeep, suit: "zir", skin: C.skinTan,
        hair: "short", hairColour: C.hairDark, face: "stubble",
        hat: "beanie", hatColour: C.red, hatAccent: C.redDeep,
        clothes: C.greenDark, collar: C.cream, extra: "none",
        mouth: "open", brows: "raised",
    },
    kibic: {
        bg: C.goldDeep, suit: "bundeva", skin: C.skinLight,
        hair: "short", hairColour: C.hairGinger, face: "beard",
        hat: "none", hatColour: C.gold, hatAccent: C.red,
        clothes: C.greenDeep, collar: C.gold, extra: "glasses",
        mouth: "grin", brows: "flat",
    },
    gospon: {
        bg: C.plum, suit: "pik", skin: C.skinLight,
        hair: "none", hairColour: C.hairGrey, face: "goatee",
        hat: "none", hatColour: C.gold, hatAccent: C.red,
        clothes: C.ink, collar: C.cream, extra: "monocle",
        mouth: "smirk", brows: "raised",
    },
    sudac: {
        bg: C.slate, suit: "zir", skin: C.skinDeep,
        hair: "short", hairColour: C.hairDark, face: "clean",
        hat: "visor", hatColour: C.green, hatAccent: C.gold,
        clothes: C.cream, collar: C.green, extra: "none",
        mouth: "flat", brows: "flat",
    },
    teta: {
        bg: C.greenDeep, suit: "bundeva", skin: C.skinLight,
        hair: "long", hairColour: C.hairGinger, face: "clean",
        hat: "none", hatColour: C.red, hatAccent: C.cream,
        clothes: C.plum, collar: C.gold, extra: "earring",
        mouth: "smile", brows: "flat",
    },
    profa: {
        bg: C.navyDeep, suit: "pik", skin: C.skinMid,
        hair: "short", hairColour: C.hairGrey, face: "goatee",
        hat: "none", hatColour: C.navy, hatAccent: C.cream,
        clothes: C.slate, collar: C.cream, extra: "glasses",
        mouth: "flat", brows: "raised",
    },
    mornar: {
        bg: C.navy, suit: "herc", skin: C.skinTan,
        hair: "none", hairColour: C.hairDark, face: "beard",
        hat: "beanie", hatColour: C.navyDeep, hatAccent: C.cream,
        clothes: C.cream, collar: C.navy, extra: "none",
        mouth: "smirk", brows: "furrowed",
    },
    seka: {
        bg: C.red, suit: "zir", skin: C.skinDeep,
        hair: "bun", hairColour: C.hairDark, face: "clean",
        hat: "none", hatColour: C.gold, hatAccent: C.cream,
        clothes: C.cream, collar: C.red, extra: "earring",
        mouth: "grin", brows: "raised",
    },
} as const satisfies Record<string, AvatarSpec>

export type AvatarId = keyof typeof AVATARS

/** Stable order for the picker grid — 12 reads as 6×2 or 4×3, both fine. */
export const AVATAR_IDS = Object.keys(AVATARS) as AvatarId[]

/** Is this string one of ours? Anything stored on a profile has to survive a
 *  future rename of the set, so every read goes through here. */
export function isAvatarId(value: unknown): value is AvatarId {
    return typeof value === "string" && Object.prototype.hasOwnProperty.call(AVATARS, value)
}

/* ───────────────────────────── builder ───────────────────────────── */

/**
 * The complete SVG for one avatar, as markup.
 *
 * `idSuffix` keeps the internal `clipPath` id unique when several avatars are
 * on the same page — duplicate ids make every later one clip against the
 * first, which in practice means the whole grid inherits one circle.
 */
export function buildAvatarSvg(id: AvatarId, idSuffix: string = id): string {
    const a: AvatarSpec = AVATARS[id]
    const clip = `bela-av-${idSuffix}`

    return [
        `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true" focusable="false">`,
        `<defs><clipPath id="${clip}"><circle cx="64" cy="64" r="64"/></clipPath></defs>`,
        `<g clip-path="url(#${clip})">`,
        `<circle cx="64" cy="64" r="64" fill="${a.bg}"/>`,
        // Suit watermark, pushed down and scaled up so it reads as texture
        // rather than as a second subject competing with the face.
        `<g transform="translate(64 70) scale(1.5) translate(-64 -46)" fill="#FFFFFF" opacity="0.13">`,
        `<path d="${SUITS[a.suit]}"/></g>`,
        // Shoulders, then the collar notch on top of them.
        `<path d="M14 128c0-24 22-34 50-34s50 10 50 34z" fill="${a.clothes}"/>`,
        `<path d="M52 96 64 112 76 96l-7-3-5 8-5-8z" fill="${a.collar}"/>`,
        `<rect x="55" y="78" width="18" height="20" rx="7" fill="${a.skin}"/>`,
        `<rect x="55" y="78" width="18" height="10" fill="${C.shade}"/>`,
        // Head, ears, hair.
        `<circle cx="35" cy="60" r="7" fill="${a.skin}"/>`,
        `<circle cx="93" cy="60" r="7" fill="${a.skin}"/>`,
        `<rect x="34" y="26" width="60" height="64" rx="23" fill="${a.skin}"/>`,
        hair(a.hair, a.hairColour),
        // Face. Beards are drawn before the mouth so the mouth sits on top.
        facialHair(a.face, a.hairColour),
        brows(a.brows, a.hairColour),
        `<circle cx="52" cy="58" r="4.5" fill="${C.ink}"/>`,
        `<circle cx="76" cy="58" r="4.5" fill="${C.ink}"/>`,
        `<path d="M64 62v7" stroke="${C.shade}" stroke-width="4" stroke-linecap="round"/>`,
        mouth(a.mouth, a.face === "beard" || a.face === "goatee" || a.face === "moustache"),
        hat(a.hat, a.hatColour, a.hatAccent),
        extra(a.extra),
        `</g></svg>`,
    ].join("")
}
