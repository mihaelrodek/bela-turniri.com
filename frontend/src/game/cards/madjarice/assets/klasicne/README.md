# Hungarian Playing Cards Deck

This directory contains 33 card face images from the Hungarian playing cards deck, sourced from https://github.com/tomasdrus/hungarian-playing-cards.

## Source and Licensing

- **Author:** tomasdrus
- **Source Repository:** https://github.com/tomasdrus/hungarian-playing-cards
- **Permission:** Usage permission granted by the author to bela-turniri.com (2026-09-20)
- **Original Format:** PNG, 363×585 px, RGBA with transparent corners
- **Current Format:** WebP, 363×585 px, RGBA (quality 88, alpha quality 100, effort 6)

## File Naming

The file naming scheme maps to the game engine's card IDs: `<rank><suit>.webp`

| Rank | Code | Suit | Code |
|------|------|------|------|
| seven | 7 | heart | HERC |
| eight | 8 | bell | KARA |
| nine | 9 | leaf | PIK |
| ten | 10 | acorn | TREF |
| unter | J | | |
| ober | Q | | |
| king | K | | |
| ace | A | | |

Examples: `7HERC.webp`, `QPIK.webp`, `AKARA.webp`, `KTREF.webp`, `BACK.webp`

## Suit Icons

The `suits/` subdirectory contains icon assets for each suit, sourced from the same Hungarian playing cards repository.

**Source:** [suit-icons directory](https://github.com/tomasdrus/hungarian-playing-cards/tree/HEAD/suit-icons) (`*-icon@large.png` files)

**Processing:** Each icon is trimmed to remove fully transparent margins, padded to a square transparent canvas (centered), resized to 192×192 pixels using LANCZOS resampling, and saved as WebP with quality 90.

**Suit Mapping:**

| Engine Suit ID | Icon File | Source |
|---|---|---|
| HERC (heart) | `HERC.webp` | `heart-icon@large.png` |
| KARA (bell) | `KARA.webp` | `bell-icon@large.png` |
| PIK (leaf) | `PIK.webp` | `leaf-icon@large.png` |
| TREF (acorn) | `TREF.webp` | `acorn-icon@large.png` |
