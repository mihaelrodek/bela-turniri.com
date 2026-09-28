# bela·turniri — logo (K1b, lepeza od četiri karte)

Četiri karte u lepezi, sve četiri boje vidljive: pik #4DA66A, žir #B8823F, kara #F2C14E, herc #E24B4A. Prednja karta (herc) nosi veliki znak.

## Datoteke
| Datoteka | Upotreba |
|---|---|
| `svg/icon-light.svg` | ikona, light tema (pločica #2E6343, karte #FFFDF8) |
| `svg/icon-dark.svg` | ikona, dark tema (pločica #0A3D1C + obrub #2D2D31, karte #F6F0E4) |
| `svg/favicon.svg` | favicon, sam bira light/dark preko prefers-color-scheme |
| `svg/lockup-{light,dark}.svg` | ikona + natpis, header |
| `svg/lockup-tagline-{light,dark}.svg` | ikona + natpis + „organizacija i rezultati" |
| `png/icon-{light,dark}-{16,32,48,64,180,192,512}.png` | favicon / PWA / social |
| `png/apple-touch-icon.png` | 180×180, bez zaobljenja (iOS ga sam zaobli) |
| `BelaTurniriLogo.jsx` | React komponente `BelaTurniriIcon`, `BelaTurniriLogo` |

Lockup SVG-ovi koriste `<text>` s Bricolage Grotesque — font mora biti učitan na stranici. U aplikaciji koristi JSX komponentu (natpis je pravi HTML tekst).

## HTML head
```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/icon-light-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```
PWA manifest: `icon-light-192.png`, `icon-light-512.png`.

## Pravila
- Min. veličina ikone: 24 px (na 16 px znakovi se stapaju — prihvatljivo samo za favicon).
- Razmak oko znaka: min. 25 % širine ikone.
- Ne mijenjati boje znakova, ne rotirati, ne dodavati sjenu.
- Točka u natpisu uvijek u primarnoj zelenoj (`--brand`).
