# Bela online — dizajn v2 (referenca: bela.fun)

Analiza bela.fun (odigrana partija 1 čovjek + 3 bota, 2026-09-07) i **naš cilj**.
Ovaj dokument je ugovor za UI; `README.md` ostaje ugovor za pravila/protokol.
NE kopiramo njihove assete (PNG špil `decks/modern2`, avatari) — samo obrasce.

## 1. Što bela.fun radi dobro (preuzeti obrasce)

**Općenito.** Expo/React-Native-Web aplikacija: jedna kolona `maxWidth ≈ 720px`
centrirana i na desktopu — isti layout je i mobilni. Tamna navy pozadina
`#162F46`, paneli `#1E4262`, tamna "ladica" za ruku `#162635`, crvena
`#E66065`, zelena akcija `#5EA37C`, svijetli tekst `#F2F2F2`. Fontovi: naslovi
**CreteRound** (slab serif, topao), tekst **Archivo**. Malo elemenata, puno
zraka, ništa ne treperi.

**Lobby (`/home`).** Avatar + ime gore lijevo, hamburger gore desno (Početna /
Zajednica / Postavke). Naslov "Postojeće igre" + badge s brojem. Search.
Lista soba: kartica = ime sobe (dvije hrvatske riječi, npr. "medeni-fakultet"),
badge cilja (501/701/1001), lokot ako je privatna, red avatara `2 vs 2` s
praznim krugom za slobodno mjesto, chevron. Fiksni zeleni CTA dolje
**"Nova igra +"**. Klik → mali modal "Do koliko se igra?" 501 / 701 / 1001 →
soba se odmah kreira (bez forme za ime).

**Soba (`/home/room`).** Gore: "Ime igre" (italic label) + **ime (501)** +
"🔒 Šifra za ulaz: 5810" (4-znamenkasti kod za ulazak). Izlaz ikona desno.
Četiri reda sjedala okomito: 2 reda, **"vs"**, 2 reda — moj red ima svijetli
obrub + zelenu točku (online). Prazan red: "čekam…" + gumb **"Dodaj bota +"**;
bot red: avatar + ime (Sova, Gica, Jelen…) + crveni ✕. Dolje: "Privatna igra"
toggle + zeleni CTA **"Pokreni igru ▷"**.

**Stol (`/home/game`).**
- Vrh: **scoreboard** panel: "Mi" (ukupno velikim, bodovi tekuće podjele
  malim ispod) | u sredini nakon zvanja tamni kvadrat s **ikonom aduta +
  imenom zvača** | "Oni".
- Partner gore (avatar + ime), protivnici lijevo/desno na sredini visine,
  ja dolje. Ime igrača na potezu dobije svijetlu pilulu.
- Sredina: **štih** — odigrane karte padaju u sredinu **nagnute prema svom
  sjedalu** (rotacija ±10–25°), lagano se preklapaju; karta u letu je
  poluprozirna; kad štih završi, karte nestanu (fade) i bodovi se dodaju.
- Iznad ruke status: zelena pilula **"Tvoj potez"** ili tekst "Sova je na
  potezu" / "Jelen odlučuje" (zove aduta). Badge **"D"** za djelitelja na rubu ladice.
- **Ruka**: tamna zaobljena ladica, **8 fiksnih slotova**; odigrana karta
  ostavlja **prazninu** (ruka se ne prelaže — prsti ne promašuju). Karte se
  dijele animacijom iz sredine u slotove.
- Zvanje aduta: red 4 ikone boja + "Dalje"; djelitelj bez "Dalje".
- Nakon prvog štiha modal **"Zvanja"** ("Nitko nije imao zvanja" ili popis).
- Dno: red **emoji reakcija** (😢 🔥 😡 🎉 🙃 😜) — reakcija iskoči kraj avatara.
- Nema highlighta legalnih karata (klik na ilegalnu se ignorira) — **mi to radimo bolje**.

**Postavke.** Uredi profil, Jezik (zastavice), Zvuk toggle, **Smanji
animacije** toggle, **Vrsta karata: Francuske / Mađarice / Moderne**
(sličice špila), Izbriši račun.

## 2. Naš cilj (v2) — što se mijenja

1. **Mađarice su zadani špil.** Bela se igra mađaricama. Naš špil je
   vlastiti (public-domain skenovi Tell uzorka ili vlastiti flat SVG),
   nikad tuđi PNG. Mapiranje engine → mađarice:
   `HERC`=**srce** ❤, `KARA`=**bundeva** (zvono), `PIK`=**list/zelena**,
   `TREF`=**žir**; `7 8 9 10`=**VII VIII IX X** (rimski), `J`=**Dolnji**
   (unter), `Q`=**Gornji** (ober), `K`=**Kralj**, `A`=**As** (godišnje doba
   na Tell asu: srce=proljeće, bundeva=ljeto, list=jesen, žir=zima).
   Francuski špil ostaje kao opcija u postavkama (postojeći CSS render).
2. **Stol = jedna kolona ≤ 720 px** i na desktopu, kao bela.fun; ne
   raštrkani 4 kuta na širokom ekranu. Pozadina: duboka **felt-zelena**
   (`brand.950 → brand.900` radijalni gradijent, `src/system.ts`), ne navy —
   to je naš brend; paneli tamno "glass". Svijetla tema: isti tamni stol
   (stol je uvijek taman; samo chrome oko njega prati temu).
3. **Scoreboard** kao bela.fun (Mi/Oni, ukupno + tekuća podjela, adut + zvač
   u sredini). "Mi/Oni" relativno mom timu.
4. **Ruka s fiksnim slotovima** + praznine; legalne karte podignute i
   svijetle, ilegalne zatamnjene (naša prednost); tap-target ≥ 44 px; na
   uskom ekranu 8 karata se **preklapaju** (negativni margin), ne scrollaju.
5. **Štih**: nagnute karte prema sjedalu, let 250 ms iz sjedala, poluprozirno
   u letu, dwell 700 ms, fade prema pobjedniku. `prefers-reduced-motion` +
   ručni toggle "Smanji animacije".
6. **Turn**: pilula "Tvoj potez" / "X je na potezu" / "X zove"; tanki
   **timer prsten** oko avatara (imamo `turnDeadline`); "D" badge djelitelja.
7. **Zvanja** modal nakon prvog štiha s kartama (naše `DECLARATIONS_REVEALED`),
   "Bela!" flash. **Sažetak podjele** (prolaz/pad, štiglja, zvanja) i
   "Sljedeća podjela" — bela.fun to nema tako jasno; zadržati naše.
8. **Emoji reakcije** (6 komada, rate-limit 1/3 s) — protokol `chat.react`.
9. **Lobby/soba** kao bela.fun: lista soba s avatarima `2 vs 2`, search,
   fiksni CTA "Nova igra", modal 501/701/1001, auto-ime sobe (dvije hrvatske
   riječi), **šifra za ulaz** (4 znamenke) + "Pridruži se šifrom", privatna
   igra, sjedala u redovima s "Dodaj bota" / ✕, "Pokreni igru".
10. **Postavke igre** (u `/igra`, ikona zupčanika): zvuk (WebAudio, bez
    datoteka), smanji animacije, vrsta karata (Mađarice / Francuske),
    spremljeno u `localStorage` preko `hooks/useGamePrefs.ts`.
11. **Mobilno**: `100dvh` stol, safe-area dolje, bez page-scrolla, ruka
    dokirana dolje, scoreboard kompaktan (jedan red), landscape podržan
    (ruka i dalje dolje, sjedala bliže sredini).
12. Sve stringove hr + sl. Bez novih runtime dependencyja.

## 3. Tokeni (frontend/src/system.ts) koje UI koristi
`brand.*` (felt zelena ramp), `bg.panel`, `fg`, `fg.muted`, `border.subtle`,
`glass.panel` layerStyle. Karte su fizički objekti: lice krem `#f7f1e3`,
tinta `#1c1c1c`, crvena `#c0272d`, zelena lista `#2f8f52`, žir smeđa `#7a4a1d`,
bundeva zlatna `#d9a521` — fiksno u obje teme.
