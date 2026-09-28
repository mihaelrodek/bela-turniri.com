# Prompt za AI agenta

Kopiraj sve ispod crte u agenta (Claude Code / Cursor), s ovom mapom (`export_bela/`) u repozitoriju.

---

Implementiraj novi vizualni identitet: **nove boje, tipografiju i logotipe**. Specifikacija je u `export_bela/`:

- `THEME.md` — jedini izvor istine za boje (light + dark tokeni), fontove, tipografsku ljestvicu i mapiranje staro → novo.
- `logo_bela_turniri/` — logo za **bela-turniri.com** (organizacija turnira): SVG, PNG, favicon, React komponenta, README.
- `logo_bela_games/` — logo za **bela.games** (platforma za igru): SVG, React komponenta, CSS, README.

**Opseg — smiješ mijenjati isključivo:**
- vrijednosti boja (background, color, border-color, fill, stroke, boje u sjenama i gradijentima)
- font-family, font-weight, font-size, line-height, letter-spacing
- logotip, favicon, apple-touch-icon, PWA ikone, `<meta name="theme-color">`

**Zabranjeno:**
- mijenjati JSX/HTML strukturu, redoslijed elemenata, layout (display, flex/grid, position, width, height, margin, padding, gap, z-index)
- mijenjati border-radius, border-width, breakpointe, animacije
- dodavati/uklanjati komponente, tekst ili funkcionalnost; refaktorirati; „usput popravljati"

**Postupak:**
1. Dodaj tokene iz `THEME.md` u globalni stylesheet: `:root` (light) i `[data-theme="dark"]` (dark). Ako projekt ima theme provider / Tailwind config, mapiraj tokene u njega umjesto paralelnog sustava. Dodaj `prefers-color-scheme` fallback ako nema ručnog prekidača.
2. Učitaj fontove (Google Fonts link iz `THEME.md`): Bricolage Grotesque (naslovi), Instrument Sans (UI), JetBrains Mono (brojke, kodovi).
3. Zamijeni hardkodirane boje i fontove tokenima prema tablici „Mapiranje". Gdje boja nema očiti par, odaberi po semantici i navedi to u sažetku.
4. Boje znakova karata zamijeni tokenima `--suit-herc`, `--suit-kara`, `--suit-pik`, `--suit-zir`.
5. **Logo:** zamijeni postojeći logo u headeru, footeru, login/splash ekranu i gdje god se pojavljuje.
   - bela-turniri → `logo_bela_turniri/BelaTurniriLogo.jsx` (`<BelaTurniriLogo theme={theme} size={…}/>`); zadrži postojeću visinu logotipa u layoutu.
   - bela.games → `logo_bela_games/BelaLogo.jsx` prema njegovom README-u.
   - `theme` prop veži na aktivnu temu aplikacije.
6. **Favicon i ikone:** kopiraj `svg/favicon.svg` i PNG-ove u `public/`, ažuriraj `<link rel="icon">`, `apple-touch-icon` i PWA manifest (192, 512). `theme-color`: `#F7F2E9` light, `#1C1D20` dark.
7. Provjeri oba theme-a na svim ekranima (lista turnira, detalj turnira, kreiranje, kalendar, karta, stol za kartanje). Screenshot prije/poslije.

Ako promjena fonta neizbježno mijenja layout (npr. tekst se prelama), **ne mijenjaj layout** — navedi to u sažetku.
