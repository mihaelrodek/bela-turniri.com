# bela.games — logo paket (varijanta A1a)

Znak: krem pločica sa četiri znaka hrvatskih/mađarskih karata (srce, zvono, list, žir) u 2×2 mreži.
Wordmark: `bela` + crvena točka + `games` (lakši rez).

## Sadržaj

```
BelaLogo.jsx              React komponente: BelaMark, BelaWordmark, BelaLogo
logo.css                  CSS tokeni + CSS-only varijanta (.bela-logo / .bela-mark / .bela-word)
svg/mark.svg              znak, krem pločica, znakovi u boji  ← primarni
svg/mark-bordered.svg     isto + hairline obrub (za bijelu pozadinu)
svg/mark-mono-dark.svg    monokrom na tamnoj (felt pločica, krem znakovi)
svg/mark-mono-light.svg   monokrom na svijetloj
svg/lockup-horizontal-{dark,light}.svg
svg/lockup-stacked-{dark,light}.svg
svg/favicon.svg           puni znak, radius 18%
svg/favicon-mini.svg      samo srce — za 16px i manje
svg/maskable.svg          512×512, PWA maskable (safe zone 80%)
svg/suit-{heart,bell,leaf,acorn}.svg   pojedinačni znakovi (crni, za CSS mask)
preview.html              pregled svih varijanti u light i dark temi
```

## Boje

| Token | Hex | Upotreba |
|---|---|---|
| `--bela-red` | `#E24B4A` | srce, točka u wordmarku, primarni akcent |
| `--bela-yellow` | `#F2C14E` | zvono |
| `--bela-green` | `#4DA66A` | list, success |
| `--bela-brown` | `#B8823F` | žir |
| `--bela-cream` | `#F4EFE4` | pločica znaka, tekst na tamnoj |
| `--bela-felt` | `#173D2C` | tamna pozadina, tekst na svijetloj |
| `--bela-felt-light` | `#1F5039` | elevirane plohe u dark temi |
| `--bela-ink` | `#141A17` | najtamnija plohа / tekst |

Tipografija: **Outfit** (700 wordmark, 500 za `.games`). Fallback: `system-ui, -apple-system, "Segoe UI", sans-serif`.

```html
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&display=swap" rel="stylesheet">
```

## Geometrija (ne mijenjati)

U koordinatnom sustavu 100×100:
- pločica: `rx = 22.5` (22.5% — iOS-style squircle aproksimacija)
- mreža: inset 18, ukupan raspon 64, gap 5.12 (8% raspona), ćelija 29.44
- redoslijed: srce ↖, zvono ↗, list ↙, žir ↘

Clear space oko lockupa = visina pločice × 0.25.

## React

```jsx
import { BelaLogo, BelaMark, BelaWordmark } from "@/components/BelaLogo";

<BelaLogo size={40} theme="light" />                    // header, desktop
<BelaLogo size={32} theme="dark" layout="mark-only" />  // mobile header
<BelaLogo size={96} layout="stacked" theme="dark" />    // splash / prazna stanja
<BelaMark size={24} variant="mono" theme="dark" />      // u tamnim trakama, footer
```

Propovi:
- `layout`: `horizontal` (default) | `stacked` | `mark-only` | `wordmark-only`
- `size`: visina znaka u px; wordmark se skalira (×0.68 horizontalno, ×0.52 stacked)
- `theme`: `light` | `dark` — mijenja boju wordmarka i hairline obrub
- `variant`: `color` (default) | `mono`
- `href`: renderira `<a>` s `aria-label="bela.games"`

Komponenta nema ovisnosti i nema state — sigurna za RSC bez `"use client"`.

## Teme

Pločica je uvijek krem — to je konstanta identiteta. Mijenja se samo wordmark i obrub:

| | pločica | wordmark | obrub |
|---|---|---|---|
| light | `--bela-cream` | `--bela-felt` | `rgba(23,61,44,.16)` |
| dark | `--bela-cream` | `--bela-cream` | nema |

CSS-only put: prebaci `data-theme="dark"` na `<html>` ili koristi `.dark` klasu; `logo.css` već ima i `prefers-color-scheme` fallback.

## Primjene

**Web header (desktop)** — `<BelaLogo size={36} />`, lijevo, clear space 16px.
**Web header (mobile ≤640px)** — `<BelaLogo size={32} layout="mark-only" />`.
**Splash / auth ekrani** — `<BelaLogo size={96} layout="stacked" />` centrirano.
**Footer** — `<BelaLogo size={28} variant="mono" theme="dark" />`.
**Prazna stanja / loading** — samo znak, `opacity: .35`.
**Igraća ploha (stol)** — znak kao vodeni žig u sredini stola, `opacity: .06`, veličina 40% širine stola.

## Ikone aplikacije

| Datoteka | Veličina | Napomena |
|---|---|---|
| `favicon.svg` | vektor | moderni preglednici |
| `favicon-mini.svg` | 16 | samo srce — mreža je nečitka ispod 20px |
| `apple-touch-icon.png` | 180 | renderiraj iz `mark.svg` bez radiusa (iOS sam maskira) |
| `icon-192.png`, `icon-512.png` | PWA | iz `mark.svg` |
| `maskable.svg` → `maskable-512.png` | 512 | `purpose: "maskable"` |

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate icon" href="/favicon-mini.svg" sizes="16x16">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#173D2C" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#F4EFE4" media="(prefers-color-scheme: light)">
```

manifest.webmanifest:
```json
{
  "name": "bela.games",
  "short_name": "bela",
  "background_color": "#173D2C",
  "theme_color": "#173D2C",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

## Pravila

Ne raditi: rotirati znak, mijenjati redoslijed ili boje znakova, dodavati sjenu/gradijent, razmicati mrežu, stavljati znak na fotografiju bez pločice, koristiti punu mrežu ispod 20px, pisati `Bela Games` ili `BELA.GAMES` (uvijek mala slova).

## Odnos prema bela-turniri.com

Turniri zadržavaju postojeću plavu. bela.games koristi felt-zelenu i krem — ista obitelj znakova, drukčija paleta, pa se domene razlikuju na prvi pogled. Ako se kasnije ujedinjuju, znak (mreža od četiri znaka) je zajednički element.

## Zadatak za implementaciju

1. Kopiraj `BelaLogo.jsx` u `src/components/` i `svg/` u `public/brand/`.
2. Dodaj tokene iz `logo.css` u globalni stylesheet (ili mapiraj u postojeći theme config).
3. Zamijeni sve postojeće logo instance `<BelaLogo>` komponentom; header desktop 36px, mobile mark-only 32px.
4. Generiraj PNG ikone iz `mark.svg` / `maskable.svg` i poveži favicon + manifest.
5. Provjeri kontrast wordmarka u obje teme i clear space od 25%.
