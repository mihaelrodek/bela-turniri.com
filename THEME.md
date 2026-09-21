# bela — tema: boje i tipografija (za implementaciju)

Ovaj dokument je **jedini izvor istine** za boje i tipografiju. Sve ostalo u aplikaciji ostaje nepromijenjeno.

---

## PROMPT ZA CLAUDE CODE

> Implementiraj novu vizualnu temu (boje + tipografija) u ovu aplikaciju prema specifikaciji u `THEME.md`.
>
> **Strogo ograničenje opsega — smiješ mijenjati isključivo:**
> - vrijednosti boja (background, color, border-color, fill, stroke, box-shadow boje, gradijente)
> - font-family, font-weight, font-size, line-height, letter-spacing
>
> **Ne smiješ mijenjati ništa drugo.** Konkretno, zabranjeno je:
> - mijenjati JSX/HTML strukturu, redoslijed elemenata, klase koje nisu vezane za stil
> - mijenjati layout: display, flex/grid postavke, position, width, height, margin, padding, gap, z-index
> - mijenjati border-radius, border-width, breakpointe, animacije, tranzicije
> - dodavati/uklanjati komponente, ikone, tekst ili funkcionalnost
> - refaktorirati kod, preimenovati datoteke, "usput popravljati" bilo što
>
> **Postupak:**
> 1. Dodaj CSS varijable iz poglavlja "Tokeni" u globalni stylesheet, u dva bloka: `:root` (light) i `[data-theme="dark"]` (dark). Ako projekt već ima theme provider / Tailwind config / Chakra theme, mapiraj tokene u njega umjesto da paralelno uvodiš novi sustav.
> 2. Učitaj fontove (Google Fonts link iz poglavlja "Tipografija").
> 3. Prođi kroz sve komponente i zamijeni hardkodirane boje i font deklaracije odgovarajućim tokenima iz tablice "Mapiranje". Gdje postojeća boja nema očiti par, koristi tablicu semantike i napiši u PR opisu koju si mapu pretpostavio.
> 4. Primijeni tipografsku ljestvicu na postojeće tekstualne elemente prema ulozi (display / title / heading / body / label / caption / numeric). Veličine u ljestvici su ciljne vrijednosti — ako neki element trenutno ima drugu veličinu zbog layouta, zadrži postojeću veličinu i promijeni samo obitelj i rez.
> 5. Provjeri oba theme-a na svim ekranima: lista turnira, detalj turnira (sve kartice), kreiranje, kalendar, karta, blok, stol za kartanje. Screenshot prije/poslije za svaki ekran.
>
> Ako naiđeš na mjesto gdje promjena boje ili fonta neizbježno mijenja layout (npr. drugi font je širi pa se tekst prelama), **ne mijenjaj layout** — javi mi to u sažetku i ostavi kako je.

---

## Tipografija

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
```

| Uloga | Obitelj | Gdje |
|---|---|---|
| Display / naslovi | **Bricolage Grotesque** 500–700 | naslovi turnira, veliki brojevi rezultata, hero |
| UI / tekst | **Instrument Sans** 400–600 | sav ostali tekst, gumbi, forme, navigacija |
| Brojke | **JetBrains Mono** 500–700 | rezultati, cijene, vrijeme, datumi, popunjenost, oznake |

```css
--font-display:"Bricolage Grotesque",system-ui,sans-serif;
--font-ui:"Instrument Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
--font-mono:"JetBrains Mono",ui-monospace,monospace;
```

### Ljestvica

| Token | Font | Veličina / line-height | Weight | Letter-spacing | Upotreba |
|---|---|---|---|---|---|
| `display` | Bricolage | 40 / 1.1 | 700 | −0.03em | naslov ekrana, hero |
| `title` | Bricolage | 28 / 1.15 | 600 | −0.025em | naslov sekcije |
| `heading` | Bricolage | 17 / 1.3 | 600 | −0.015em | naslov kartice turnira |
| `body` | Instrument Sans | 14 / 1.55 | 400 | 0 | opisi, paragrafi |
| `label` | Instrument Sans | 13.5 / 1.4 | 500 | 0 | labeli u formama, meta |
| `caption` | Instrument Sans | 11.5 / 1.3 | 600 | +0.09em, UPPERCASE | nadnaslovi sekcija |
| `numeric` | JetBrains Mono | 26 / 1 | 700 | −0.02em | rezultati, cijene |
| `numeric-sm` | JetBrains Mono | 13 / 1.4 | 600 | 0 | popunjenost, male brojke |
| `mono-label` | JetBrains Mono | 11–12 / 1 | 600 | +0.1em, UPPERCASE | MI / ONI, oznake runde |

Tabularne znamenke svugdje gdje se brojke mijenjaju:
```css
font-variant-numeric: tabular-nums;
```

---

> **2026-09-21 — dark tema vraćena na produkcijske vrijednosti.** "Sumrak" (hladno-zelenkasta, sve varijante) izgledala je previše napadno; vlasnik je odabrao raniju neutralnu tamnu temu. `[data-theme="dark"]` blok ispod je zato ZASTARJEO: stvarne dark vrijednosti su u `frontend/src/system.ts` (površine gray 950/900/800, tekst #fafafa/#d4d4d8/#a1a1aa, brand #7fc496 / #227342, statusi = Chakra orange/teal/red/yellow 300–900, tim ONI u dark temi prigušen taupe). Light tema ("Pergament") i tipografija ostaju kako je gore.

## Tokeni

```css
:root{
  /* Light — "Pergament" */
  --canvas:#F7F2E9;        /* pozadina stranice */
  --panel:#FDFBF7;         /* kartice, paneli */
  --opaque:#FFFEFB;        /* modali, popover */
  --glass:rgba(253,251,247,.8); /* sticky header / bottom bar */
  --fill-subtle:#FAF6EE;   /* input, blagi fill */
  --fill-muted:#F2ECE1;    /* segmented track, hover */
  --bd-subtle:#EFE8DB;     /* separatori */
  --bd:#E4DACA;            /* obrubi kartica, inputa */
  --bd-strong:#C9BBA2;     /* fokus obrub, istaknuto */
  --ink:#2A211A;           /* primarni tekst */
  --soft:#4E4238;          /* sekundarni tekst */
  --muted:#6E6152;         /* tercijarni */
  --faint:#8D7F6E;         /* captions, placeholderi */
  --brand:#2E6343;         /* brand zelena */
  --brand-fg:#265238;      /* brand tekst na svijetlom */
  --brand-subtle:#DDE9DC;  /* brand pozadina (chip, badge) */
  --brand-solid:#2E6343;   /* primarni gumb */
  --on-brand:#FFFCF7;      /* tekst na brand gumbu */
  --tan:#A9713C;           /* sekundarni akcent (tim ONI) */
  --tan-subtle:#F2E3CE;
  --live:#C4661C;          /* status: igra se */
  --live-subtle:#F7E3CE;
  --ok:#1F6F63;            /* status: plaćeno / uspjeh */
  --ok-subtle:#DCEDE8;
  --gold:#B88A24;          /* zvanja, dealer chip */
  --red:#B8423C;           /* greška, srce */
  --sh-card:0 1px 2px rgba(60,42,20,.07),0 1px 3px rgba(60,42,20,.06);
  --sh-raised:0 6px 18px rgba(60,42,20,.10);
  /* stol za kartanje */
  --felt:#EFE7D8; --felt2:#E7DCC7;
  --cardface:#FFFDF8; --cardline:#E0D6C4;
  --art-opacity:.10;       /* pozadinska ilustracija karata */
}

[data-theme="dark"]{
  /* Dark — "Sumrak" (tamna, hladno-zelenkasta; 2026-09-21 potamnjena ~50% prema starom #161719) */
  --canvas:#171B1D;
  --panel:#1E2426;
  --opaque:#22292B;
  --glass:rgba(30,36,38,.78);
  --fill-subtle:#262D2F;
  --fill-muted:#2E3537;
  --bd-subtle:#282F30;
  --bd:#2C3434;
  --bd-strong:#4A5556;
  --ink:#F2EADC;
  --soft:#D6CEC1;
  --muted:#A79E90;
  --faint:#8A8274;
  --brand:#79C08F;
  --brand-fg:#8ACFA0;
  --brand-subtle:#264233;
  --brand-solid:#2F8F52;
  --on-brand:#0E1F16;
  --tan:#D9A066;
  --tan-subtle:#3A3026;
  --live:#E58A45;
  --live-subtle:#3B2A1B;
  --ok:#6FD3C0;
  --ok-subtle:#1E3835;
  --gold:#DCB157;
  --red:#E27A70;
  --sh-card:0 1px 2px rgba(0,0,0,.35);
  --sh-raised:0 8px 22px rgba(0,0,0,.40);
  --felt:#14191A; --felt2:#101415;
  --cardface:#F6F0E4; --cardline:#D9CEBB;
  --art-opacity:.07;
}
```

### Boje znakova karata (iste u obje teme)

| Znak | Ispuna | Tekst oznake (light) | Tekst oznake (dark) |
|---|---|---|---|
| srce | `#E24B4A` | `#B8423C` | `#B8423C` |
| zvono | `#F2C14E` | `#9A7B1E` | `#9A7B1E` |
| list | `#4DA66A` | `#3F8A5B` | `#3F8A5B` |
| žir | `#B8823F` | `#8C6027` | `#8C6027` |

Karte imaju krem lice u **obje** teme (`--cardface`) — ne bijelo, ne tamno. To je namjerno: karte ostaju najsvjetlija ploha i oko ide na njih.

---

## Mapiranje (staro → novo)

| Element | Novi token |
|---|---|
| pozadina stranice | `--canvas` |
| kartica turnira, panel, modal | `--panel` / `--opaque` |
| sticky header, bottom bar | `--glass` + `backdrop-filter:blur(18px) saturate(180%)` |
| obrub kartice / inputa | `--bd` |
| separator, hairline | `--bd-subtle` |
| primarni tekst / naslovi | `--ink` |
| sekundarni tekst | `--soft` |
| meta, adresa, udaljenost | `--muted` |
| caption, placeholder | `--faint` |
| primarni gumb (Kreiraj, Prijavi par) | `bg:--brand-solid`, `color:--on-brand` |
| sekundarni gumb | `bg:--panel`, `border:--bd`, `color:--ink` |
| tekstualni gumb | `color:--brand-fg` |
| aktivni chip / tab | `bg:--brand-subtle`, `color:--brand-fg` |
| neaktivni chip | `bg:--fill-subtle`, `border:--bd-subtle`, `color:--muted` |
| badge "Igra se" | `bg:--live-subtle`, `color:--live` |
| badge "Prijave otvorene" | `bg:--brand-subtle`, `color:--brand-fg` |
| badge "Plaćeno" | `bg:--ok-subtle`, `color:--ok` |
| progress traka (popunjenost) | track `--fill-muted`, fill `--brand` |
| tim MI | `--brand-fg` |
| tim ONI | `--tan` |
| zvanja, dealer oznaka | `--gold` |
| greška, destruktivna akcija | `--red` |
| ploha stola za kartanje | `radial-gradient(120% 90% at 50% 38%, var(--felt), var(--felt2))` |
| lice karte | `bg:--cardface`, `border:--cardline` |
| pozadinska ilustracija karata | `opacity:var(--art-opacity)` |

---

## Provjere prije mergea

- Kontrast `--ink` na `--canvas`: 12.4:1 light, 12.1:1 dark.
- Bijeli tekst na `--brand-solid`: 6.1:1 light.
- `--live` na `--live-subtle`: 4.8:1.
- Nijedan tekst ne smije koristiti `opacity` ili `color-mix` za prigušivanje — koristi `--muted` / `--faint`.
- Dark tema se prebacuje preko `data-theme="dark"` na `<html>`; dodaj i `prefers-color-scheme` fallback ako aplikacija nema ručni prekidač.
- `<meta name="theme-color">`: `#F7F2E9` light, `#171B1D` dark.
