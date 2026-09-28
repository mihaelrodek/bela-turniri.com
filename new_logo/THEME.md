# bela — tema: boje i tipografija (za implementaciju)

Ovaj dokument je **jedini izvor istine** za boje i tipografiju. Sve ostalo u aplikaciji ostaje nepromijenjeno.

---

## PROMPT

Vidi `PROMPT.md`.

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
  --red:#B8423C;           /* greška, destruktivno */
  --sh-card:0 1px 2px rgba(60,42,20,.07),0 1px 3px rgba(60,42,20,.06);
  --sh-raised:0 6px 18px rgba(60,42,20,.10);
  /* stol za kartanje */
  --felt:#EFE7D8; --felt2:#E7DCC7;
  --cardface:#FFFDF8; --cardline:#E0D6C4;
  --art-opacity:.10;       /* pozadinska ilustracija karata */
}

[data-theme="dark"]{
  /* Dark — neutralna tamna */
  --canvas:#1C1D20;        /* pozadina stranice */
  --panel:#1E1E22;         /* kartice, paneli */
  --opaque:#1E1E22;        /* modali, popover */
  --glass:rgba(30,30,34,.78);
  --fill-subtle:#2D2D31;   /* suptilna površina */
  --fill-muted:#36363B;
  --bd-subtle:#26262A;
  --bd:#2D2D31;            /* obrubi */
  --bd-strong:#3F3F46;
  --ink:#FAFAFA;           /* glavni tekst */
  --soft:#D4D4D8;          /* sekundarni tekst */
  --muted:#A1A1AA;         /* prigušeni tekst */
  --faint:#8B8B94;
  --brand:#7FC496;         /* primarna zelena */
  --brand-fg:#7FC496;
  --brand-subtle:#0A3D1C;  /* zelena pozadina / chip */
  --brand-solid:#7FC496;   /* primarni gumb */
  --on-brand:#0E1F16;      /* tekst na zelenoj tipki */
  --tan:#C4A98C;           /* protivnički tim */
  --tan-subtle:#2E2924;
  --live:#FDBA74;          /* aktivno / live */
  --live-subtle:#3A2A1C;
  --ok:#5EEAD4;            /* uspjeh / plaćeno */
  --ok-subtle:#12302C;
  --gold:#FDE047;          /* djelitelj / zvanja */
  --red:#FCA5A5;           /* greška / destruktivno */
  --sh-card:0 1px 2px rgba(0,0,0,.35);
  --sh-raised:0 8px 22px rgba(0,0,0,.40);
  /* stol za kartanje */
  --felt:#14191A; --felt2:#101415;
  --cardface:#F6F0E4; --cardline:#D9CEBB;
  --art-opacity:.07;
}
```

### Boje znakova karata (iste u obje teme)

| Znak | Ispuna | Tekst oznake (light) | Tekst oznake (dark) |
|---|---|---|---|
| herc | `#E24B4A` | `#B8423C` | `#B8423C` |
| kara | `#F2C14E` | `#9A7B1E` | `#9A7B1E` |
| pik | `#4DA66A` | `#3F8A5B` | `#3F8A5B` |
| žir | `#B8823F` | `#8C6027` | `#8C6027` |

```css
--suit-herc:#E24B4A; --suit-kara:#F2C14E; --suit-pik:#4DA66A; --suit-zir:#B8823F;
```

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

- Tekst mora imati kontrast min. 4.5:1 prema pozadini (provjeri osobito `--gold` i `--live` u light temi na `--panel`).
- Nijedan tekst ne smije koristiti `opacity` ili `color-mix` za prigušivanje — koristi `--muted` / `--faint`.
- Dark tema se prebacuje preko `data-theme="dark"` na `<html>`; dodaj i `prefers-color-scheme` fallback ako aplikacija nema ručni prekidač.
- `<meta name="theme-color">`: `#F7F2E9` light, `#1C1D20` dark.
