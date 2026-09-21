// BelaLogo.jsx — logo sustav za bela.games (varijanta A1a)
// Bez ovisnosti. Radi u React 17/18/19, Next.js (dodaj "use client" samo ako koristiš state).
import React from "react";

export const BELA_SUITS = {
  heart: "M50 88C22 66 10 52 10 33a20 20 0 0 1 40-8a20 20 0 0 1 40 8c0 19-12 33-40 55Z",
  bell:  "M42 20a8 8 0 0 1 16 0v3c13 6 20 20 20 39v6h8v8H14v-8h8v-6c0-19 7-33 20-39z",
  leaf:  "M50 8C32 26 12 40 12 58a20 20 0 0 0 33 15l-3 19h16l-3-19a20 20 0 0 0 33-15C88 40 68 26 50 8Z",
  acorn: "M46 8h8v8h-8z M22 42c0-16 12-26 28-26s28 10 28 26v6H22z M27 54h46c0 20-11 34-23 38C38 88 27 74 27 54Z",
};

export const BELA_COLORS = {
  red: "#E24B4A", yellow: "#F2C14E", green: "#4DA66A", brown: "#B8823F",
  cream: "#F4EFE4", felt: "#173D2C", feltLight: "#1F5039", ink: "#141A17",
};

// Geometrija mreže unutar 100×100 pločice: inset 18, raspon 64, gap 8% raspona
const INSET = 18, SPAN = 64, GAP = SPAN * 0.08, CELL = (SPAN - GAP) / 2, S = CELL / 100;
const CELLS = [
  { x: INSET, y: INSET, suit: "heart", color: BELA_COLORS.red },
  { x: INSET + CELL + GAP, y: INSET, suit: "bell", color: BELA_COLORS.yellow },
  { x: INSET, y: INSET + CELL + GAP, suit: "leaf", color: BELA_COLORS.green },
  { x: INSET + CELL + GAP, y: INSET + CELL + GAP, suit: "acorn", color: BELA_COLORS.brown },
];

/**
 * Znak (ikona) — kvadratna pločica sa 4 boje karata.
 * @param size    px, default 40
 * @param variant "color" | "mono"  (mono = svi znakovi jednom bojom)
 * @param theme   "light" | "dark"  (utječe samo na mono i na hairline obrub)
 * @param tile    override boje pločice
 * @param bordered hairline obrub — koristi na bijeloj/svijetloj pozadini
 */
export function BelaMark({ size = 40, variant = "color", theme = "light", tile, bordered, radius = 22.5, title = "bela.games", ...rest }) {
  const tileFill = tile || (variant === "mono" && theme === "dark" ? BELA_COLORS.felt : BELA_COLORS.cream);
  const monoInk = theme === "dark" ? BELA_COLORS.cream : BELA_COLORS.felt;
  const showBorder = bordered ?? (tileFill === BELA_COLORS.cream && theme === "light");
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={title} {...rest}>
      <rect width="100" height="100" rx={radius} fill={tileFill}
        stroke={showBorder ? "rgba(23,61,44,.16)" : "none"} strokeWidth={showBorder ? 1.5 : 0} />
      {CELLS.map((c) => (
        <g key={c.suit} transform={`translate(${c.x} ${c.y}) scale(${S})`} fill={variant === "mono" ? monoInk : c.color}>
          <path d={BELA_SUITS[c.suit]} />
        </g>
      ))}
    </svg>
  );
}

/**
 * Wordmark — tekstualni dio. Nasljeđuje boju iz theme propa.
 */
export function BelaWordmark({ size = 28, theme = "light", weight = 700, style, ...rest }) {
  const fg = theme === "dark" ? BELA_COLORS.cream : BELA_COLORS.felt;
  return (
    <span style={{ fontFamily: "Outfit, system-ui, sans-serif", fontWeight: weight, fontSize: size, lineHeight: 1, letterSpacing: "-0.03em", color: fg, display: "inline-flex", alignItems: "baseline", whiteSpace: "nowrap", ...style }} {...rest}>
      bela<span style={{ color: BELA_COLORS.red }}>.</span>
      <span style={{ fontWeight: 500, opacity: 0.7 }}>games</span>
    </span>
  );
}

/**
 * Lockup — znak + wordmark.
 * @param layout "horizontal" | "stacked" | "mark-only" | "wordmark-only"
 * @param size   visina znaka u px; wordmark se skalira proporcionalno
 */
export function BelaLogo({ layout = "horizontal", size = 40, theme = "light", variant = "color", href, ...rest }) {
  const gap = Math.round(size * 0.36);
  const wordSize = layout === "stacked" ? Math.round(size * 0.52) : Math.round(size * 0.68);
  const content =
    layout === "mark-only" ? <BelaMark size={size} theme={theme} variant={variant} />
    : layout === "wordmark-only" ? <BelaWordmark size={Math.round(size * 0.68)} theme={theme} />
    : (<><BelaMark size={size} theme={theme} variant={variant} /><BelaWordmark size={wordSize} theme={theme} /></>);
  const wrap = {
    display: "inline-flex", alignItems: "center", gap,
    flexDirection: layout === "stacked" ? "column" : "row",
    textDecoration: "none",
  };
  if (href) return <a href={href} style={wrap} aria-label="bela.games" {...rest}>{content}</a>;
  return <span style={wrap} {...rest}>{content}</span>;
}

export default BelaLogo;
