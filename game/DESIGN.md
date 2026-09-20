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
badge cilja (163/501/701/1001), lokot ako je privatna, red avatara `2 vs 2` s
praznim krugom za slobodno mjesto, chevron. Fiksni zeleni CTA dolje
**"Nova igra +"**. Klik → mali modal "Do koliko se igra?" 163 / 501 / 701 /
1001 → soba se odmah kreira (bez forme za ime).

**„Brza 163" (2026-09-20).** Cilj `163` je zasebna disciplina, ne način igre:
najviše **tri dijeljenja**, prvi djelitelj nasumičan, pobjeđuje 163+ ili — ako
nitko ne stigne — veći zbroj nakon treće podjele; neriješeno kupuje još jednu.
Pravila su u `game/README.md` §1.7. Za UI to znači dvije stvari: chip „Brza
163" među ciljevima (natpis iz i18n ključa `game.create.quick.name`), a stol
umjesto „do 1001" piše napredak u podjelama (`PlayerView.maxDeals`, npr.
„dijeljenje 2/3"). Izbor `gameEndRule` u takvoj sobi nema smisla i skriva se —
server ga ionako normalizira na `prolaz`. Statistika je posebna kategorija
(`byTargetScore["163"]`).

**Soba (`/home/room`).** Gore: "Ime igre" (italic label) + **ime (501)** +
"🔒 Šifra za ulaz: 5810" (4-znamenkasti kod za ulazak). Izlaz ikona desno.
Četiri reda sjedala okomito: 2 reda, **"vs"**, 2 reda — moj red ima svijetli
obrub + zelenu točku (online). Prazan red: "čekam…" + gumb **"Dodaj bota +"**;
bot red: avatar + ime (Sova, Gica, Jelen…) + crveni ✕. Dolje: "Privatna igra"
toggle + zeleni CTA **"Pokreni igru ▷"**.
(Ispravak 2026-09-08: dvije grupe sjedala su **kartice bez naslova**. Naslovi
„MI”/„ONI” i brojači „1/2” su maknuti, a lijeva kartica je uvijek **domaćinov
par** — isti raspored na svakom ekranu, pa dvoje za istim stolom govore o
istom mjestu. Vidi README §3.3.)

**Stol (`/home/game`).**
- Vrh: **scoreboard** panel: "Mi" (**bodovi tekuće podjele velikim**, ukupni
  rezultat partije malim ispod) | u sredini nakon zvanja tamni kvadrat s
  **ikonom aduta i imenom zvača u istoj ćeliji** | "Oni".
  (Ispravak 2026-09-08: ranije je ovdje pisalo obrnuto. Veliki broj je
  „bodovi mješanja” — ono što igrač zbraja dok traje podjela; ukupno se
  mijenja jednom u nekoliko minuta i dovoljno mu je malo mjesto.)
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
- Dno: red **brzih reakcija** (😏 👏 🍀 🤦 ⏳ 🤝) — tekst reakcije iskoči iznad avatara pošiljatelja.
- Nema highlighta legalnih karata (klik na ilegalnu se ignorira) — **mi to radimo bolje**.

**Postavke.** Uredi profil, Jezik (zastavice), Zvuk toggle, **Smanji
animacije** toggle, **Vrsta karata: Francuske / Mađarice / Moderne**
(sličice špila), Izbriši račun.

## 2. Naš cilj (v2) — što se mijenja

1. **Mađarice su zadani špil — a od 2026-09-20 biraju se ČETIRI špila.**
   Registar je `frontend/src/game/util/cards.ts` (`DeckStyle`, `DECK_STYLES`,
   `DEFAULT_DECK`, `isHungarianDeck`, `deckHasImages`); id-evi su ono što se
   pamti u `localStorage` (stari `"madjarice"` migrira u `klasicne`):

   | id | naziv | što je | gdje |
   |----|-------|--------|------|
   | `klasicne` | Klasične / Klasične | digitalni set Tell uzorka autora `tomasdrus` (github.com/tomasdrus/hungarian-playing-cards), uz **dopuštenje autora za bela-turniri.com (2026-09-20)**. | `cards/madjarice/assets/klasicne/<RANK><SUIT>.webp` + `BACK.webp` + `suits/{HERC,KARA,PIK,TREF}.webp` |
   | `moderne` | Moderne / Moderne | naši stariji skenovi, očišćeni u **istu geometriju**, pa idu kroz identični kod (bez cropa i filtera). **Zadani.** (od 2026-09-20, zahtjev korisnika) | `cards/madjarice/assets/moderne/<RANK><SUIT>.webp` + `BACK.webp` |
   | `vektorske` | Vektorske / Vektorske | naš inline SVG (`MadjaricaCard` + `figures.tsx`, `vignettes.tsx`, `SuitGlyph.tsx`) — **nema rastera, SVG JE karta**; isti kod je ujedno fallback dok se slika špila dekodira | — |
   | `francuske` | Francuske / Francoske | originalna CSS karta (rang + ♥♦♠♣) | — |

   Rasterski špilovi su WebP 363 × 585, alfa — zaobljeni kutovi su prozirni,
   pa je *slika cijela karta*: bez bijelog okvira, bez inseta i bez korekcije
   boje; ispod nje stoji vektorsko lice dok se slika ne dekodira. Sva tri
   mađarska špila dijele istu kutiju, isti radijus i istu sjenu. Ako špil ikad
   nestane, fallback je vlastiti SVG — nikad tuđi PNG bez dopuštenja.

   **Poleđina je jedna za sve špilove** (2026-09-20, zahtjev korisnika: „ova
   ljubičasta nije dobra”). Zatvorena karta se crta u CSS-u — krem karta,
   unutar nje zeleni rešetkasti panel u brandu s tankom unutarnjom linijom
   (`CardBack` u `components/PlayingCard.tsx`). `BACK.webp` iz špilova se više
   ne prikazuje: `klasicne` ima ljubičasti raster koji ne pripada ovoj temi, a
   poleđina koja se mijenja sa špilom ionako nije nosila nikakvu informaciju.
   Bonus: CSS poleđina je trenutna, pa novo dijeljenje nikad ne bljesne bijelim
   pravokutnicima.

   **Adut prati špil** (2026-09-20, zahtjev korisnika: „kad se pozove adut
   koristi prikaz aduta vezan uz odabrane karte”). Jedna komponenta,
   `components/DeckSuitIcon.tsx`, odgovara na „kako izgleda boja”: `klasicne`
   → vlastiti otisnuti znak iz `assets/klasicne/suits/`, `moderne` i
   `vektorske` → naš vektorski glif, `francuske` → ♥♦♠♣. Kroz nju idu semafor,
   medaljon zvača, `TrumpBadge`, tipke za zvanje, trump flash i blok (preko
   `SuitIcon` / `SuitGlyph`, koji samo čitaju postavku).

   Mapiranje engine → mađarice:
   `HERC`=**srce** ❤, `KARA`=**bundeva** (zvono), `PIK`=**list/zelena**,
   `TREF`=**žir**; `7 8 9 10`=**VII VIII IX X** (rimski), `J`=**Dolnji**
   (unter), `Q`=**Gornji** (ober), `K`=**Kralj**, `A`=**As** (godišnje doba
   na Tell asu: srce=proljeće, bundeva=ljeto, list=jesen, žir=zima).
   Francuski špil ostaje kao opcija u postavkama (postojeći CSS render).
2. **Stol = jedna kolona ≤ 720 px** i na desktopu, kao bela.fun; ne
   raštrkani 4 kuta na širokom ekranu. **Dvije površine, ne jedna**: kolona
   je *soba* (`FELT`, duboka felt-zelena `brand.950 → brand.900`, paneli
   tamno "glass"), a u njoj stoji *stol* — svijetlija elipsa
   (`TableSurface`, `brand.700 → brand.900`) s rubom, vinjetom i mekim
   centrom. Sjedala prekrivaju rub elipse pa se vidi da sjede **oko** nečega,
   a štih pada na sredinu stola, ne u prazno. Svijetla tema: isti tamni stol
   (stol je uvijek taman; samo chrome oko njega prati temu). Vidi §4.
3. **Scoreboard** kao bela.fun (Mi/Oni, **tekuća podjela veliko + ukupno malo
   ispod**, adut i zvač u jednoj ćeliji u sredini; broj podjele, cilj i
   štihovi u tankom redu ispod). "Mi/Oni" relativno mom timu. Djelitelja se
   mora vidjeti na prvi pogled — "D" na avataru u boji koja se ne da
   previdjeti, ne mikro-badge.
4. **Ruka s fiksnim slotovima** + praznine; legalne karte podignute i
   svijetle, ilegalne zatamnjene (naša prednost); tap-target ≥ 44 px; na
   uskom ekranu 8 karata se **preklapaju** (negativni margin), ne scrollaju.
5. **Štih**: nagnute karte prema sjedalu, let 320 ms iz sjedala, poluprozirno
   u letu, dwell 950 ms, fade prema pobjedniku. `prefers-reduced-motion` +
   ručni toggle "Smanji animacije".
6. **Turn**: najjači signal je na **sjedalu**, ne u pilulici — vidi §4.3.
   Pilula "Tvoj potez" / "X je na potezu" / "X zove" ostaje kao potvrda
   teksta ispod stola.
7. **Zvanja** modal nakon prvog štiha s kartama (naše `DECLARATIONS_REVEALED`),
   "Bela!" flash. Rijetki **belot** (svih osam karata iste boje) dobiva zaseban
   prikaz cijele ruke prije završnog rezultata. **Sažetak podjele** (prolaz/pad, štiglja, zvanja) i
   "Sljedeća podjela" — bela.fun to nema tako jasno; zadržati naše.
8. **Emoji reakcije** (6 komada, rate-limit 1/3 s) — protokol `chat.react`.
9. **Lobby/soba** kao bela.fun: lista soba s avatarima `2 vs 2`, search,
   fiksni CTA "Nova igra", modal 501/701/1001, auto-ime sobe (dvije hrvatske
   riječi), **šifra za ulaz** (4 znamenke) + "Pridruži se šifrom", privatna
   igra, sjedala u redovima s "Dodaj bota" / ✕, "Pokreni igru".
10. **Postavke igre** (u `/igra`, ikona zupčanika): zvuk (snimljeni uzorci za
    kartu/miješanje — Kenney "Casino Audio", CC0, `frontend/src/game/sounds/`
    — uz WebAudio sintezu kao fallback dok se uzorci ne učitaju i za pobjedu/
    poraz), smanji animacije, vrsta karata (Klasične / Moderne / Vektorske
    / Francuske — mreža 2 × 2 da stane na 360 px, svaka opcija crta uzorak
    svojim špilom), **„Drži zaslon uključenim”** (Screen Wake Lock, zadano
    uključeno — vidi §7.5), spremljeno u `localStorage` preko
    `hooks/useGamePrefs.ts`.
    Odabir špila grije taj špil (`cards/madjarice/preload.ts` →
    `preloadDeck`, idempotentno **po špilu**) i predaje ga servisnom workeru
    za offline (`cards/deckOffline.ts`).
11. **Mobilno**: `100dvh` stol, safe-area dolje, bez page-scrolla, ruka
    dokirana dolje, scoreboard kompaktan (jedan red), landscape podržan
    (ruka i dalje dolje, sjedala bliže sredini).
12. Sve stringove hr + sl. Bez novih runtime dependencyja.

## 3. Tokeni (frontend/src/system.ts) koje UI koristi
`brand.*` (felt zelena ramp), `bg.panel`, `fg`, `fg.muted`, `border.subtle`,
`glass.panel` layerStyle. Karte su fizički objekti: lice krem `#f7f1e3`,
tinta `#1c1c1c`, crvena `#c0272d`, zelena lista `#2f8f52`, žir smeđa `#7a4a1d`,
bundeva zlatna `#d9a521` — fiksno u obje teme.

## 4. Ploča za sjedenje (redizajn 2026-09-08)

Prijavljene greške stare ploče: četiri sjedala su bila tri različite
komponente (gore red, bokovi stupac s imenom i čipom u istoj liniji, pa se
"Bot Ivo" prikazivao kao "Bot…" iako je oko njega bio prazan filc), "D" badge
je sjekao prsten avatara, stola kao objekta uopće nije bilo, donja trećina
filca bila je prazna, "tko je na redu" bila je blijeda pilula, a "tko zove"
prolazni čip.

### 4.1 Geometrija — jedan izvor istine
`components/tableStyles.ts` → `tableGeometry(bottomSeat)` postavlja CSS
varijable na korijenu stola; `util/seats.ts` (`SEAT_ANCHORS`),
`TableSurface` i `TrickArea` **samo ih čitaju**. Nema više triju skupova
magičnih brojeva u tri datoteke.

**Ažurirano 2026-09-13 (HUD v3, §6).** Kutija više nema fiksnu visinu: sve se
izvodi iz `--box-h`, koji je `clamp()` po `vh`, pa stol **raste s ekranom**
umjesto da pliva u njemu. Sjedala su i dalje prva, a stol se računa iz njih —
obrnuto bi na uskom ekranu (gdje je cloth ograničen na 94 %) gurnulo sjedala
u hrpu štiha.

| var | base | ≥48em | TIGHT (≤700px vis.) | SHORT (≤560px vis.) |
|---|---|---|---|---|
| `--box-h` | `clamp(352, 44vh, 470)` | `clamp(392, 50vh, 520)` | `clamp(320, 42vh, 372)` | `100%` |
| `--seat-w` | 92 | 116 | — | — |
| `--seat-h` | 94 | — | — | 76 |
| `--seat-clear-x` | 108 | — | 93 | 72 |
| `--seat-clear-y` | 120 | — | 104 | 80 |
| `--seat-overlap` | 18 | — | — | 14 |
| `--seat-x` | `max(clear-x, min(.46·box, 200))` = 162…200 | `…min(.46·box, 240)` = 180…240 | `…min(.46·box, 170)` = 147…170 | 170 |
| `--seat-y` | `max(clear-y, min(.32·box, 176))` = 120…150 | `…min(.32·box, 190)` = 125…166 | `…min(.32·box, 150)` = 104…119 | 84 |
| `--cy-free` | `--seat-y + 8` | `--seat-y + 10` | `--seat-y + 8` | 92 |

Stara tablica (2026-09-08), za usporedbu: `--seat-x` 126/168/104/160,
`--seat-y` 126/146/110/72, `--cy-free` 134/142/112/78, visina kutije fiksnih
354/382/316 px.

**Čistoća prema štihu.** `--seat-x/-y` su razmaci od **središta stola** do
unutarnjeg ruba sjedala i moraju nadmašiti polovicu hrpe štiha
(`TrickArea.tsx`): karta miruje na `REST_X` 66 / `REST_Y` 54 od središta, `md`
karta je 72 × 120 (dakle 36 / 60 do vlastitog ruba), a `cardScatter` je baci
još do 6 px dalje:

```
vodoravno  66 + 36 + 6 = 108 px   → --seat-clear-x
okomito    54 + 60 + 6 = 120 px   → --seat-clear-y
```

`TrickArea` skalira cijelu hrpu na 0,86 pod TIGHT i 0,66 pod SHORT, pa se s
njom skaliraju i te dvije granice (93/104 i 72/80). Razmaci su `max()` prema
njima, pa **nijedna veličina ekrana ne može gurnuti sjedalo u štih** — to je
invarijanta koju ova datoteka čuva.

**Cloth se izvodi iz sjedala**, ne obratno:
`--table-w = min(94%, 2·seat-x + 2·overlap)`,
`--table-h = min(2·cy-bottom − 10, 2·seat-y + 2·overlap)`, pa sjedala uvijek
sjede **na rubu** (preklapaju rim za `--seat-overlap`). Tipične izmjere:
390 px telefon → ~352 × 246, iPhone SE → ~330 × 214, 768 tablet → ~507 × 338,
≥1280 desktop → ~514 × 342, landscape telefon → ~376 × 174.

**Sve je čista duljina.** `--box-h` je `clamp()` po `vh`, pa je
`calc(0.46 · var(--box-h))` px na obje osi. Postotak bi se u `left:` razriješio
prema **širini**, a u `top:` prema **visini** — ista varijabla bi značila dvije
različite udaljenosti. Jedini postoci su `--table-w`-ov cap od 94 % (koristi se
isključivo kao širina) i `--table-cy` (isključivo kao top offset).

**Središte stola nije 50 % kutije** nego `--cy-bottom` iznad njezina dna
(`--table-cy = 100% − --cy-bottom`). Donje sjedalo je moje i crta se u
`MySeatBar` ispod filca, pa je simetrična kutija rezervirala cijelo prazno
sjedalo između bočnih sjedala i ladice s kartama — to je bila ona prazna
trećina. Gledatelj **ima** donje sjedalo, pa mu se `--cy-bottom` proširi na
`--seat-y + --seat-h`, `--box-h` dobije 90 px veći pod i gornju granicu, a
okomiti razmak raste sporije (0,22 umjesto 0,32 × `--box-h`) jer njegov prsten
mora stati **dvaput**. Svaki je anchor i dalje omotan u `min()` prema rubu
kutije, pa se na kratkom prozoru layout degradira na rub umjesto da izgura
sjedalo van filca.

### 4.2 Anatomija sjedala — ista na sve četiri strane
Stupac fiksne širine `--seat-w`, isti dijelovi, isti redoslijed, isti razmaci;
strana odlučuje **samo** gdje je stupac prikvačen.

```
[ avatar 42 px + prsten 3 px ]      48
              4
[ pilula s imenom, PUNA širina ]     22
              2
[ status-čip, rezervirani slot ]     17   (nestaje u landscapeu)
                                   = 94 = --seat-h
```

Četiri trajne oznake, svaka u **istom kutu na svakom sjedalu**, postavljene
`pinAt()`-om tangencijalno **izvan** prstena (računa se iz veličine avatara,
pa vrijedi i za manji avatar u `MySeatBar`):

| kut | oznaka |
|---|---|
| gore lijevo | BOT |
| iznad avatara | tekst brze reakcije (prolazan oblačić) |
| **dolje lijevo** | **medaljon aduta — ovo sjedalo zove** |
| **dolje desno** | **"D" djelitelj** |

Status-čip nosi samo ono što je trenutno istinito, po padajućoj hitnosti:
`Nije spojen` → `{n} s` (kad prsten pocrveni) → `Na potezu` → `Dalje`.
Pilula ima punu širinu sjedala pa se imena više ne krate.

**Izmjene 2026-09-13 (§6).** Anatomija, mjere i četiri kuta ostaju isti; mijenja
se samo **boja**: prsten i pilula nose **boju tima** (`TEAM`, §6) — prsten je
upaljen i kad sjedalo nije na potezu (meki tint), a na potezu postaje puni
conic s bojom tima (crven kad je hitno). BOT čip je tiši (`brand.900` +
`INK_MUTED`) jer je trajan i ne smije se natjecati s dvije oznake koje se
mijenjaju svaku podjelu; **„D” je zlatni kovani novčić** (metalni gradijent,
osvijetljen unutarnji rub, tamno slovo) umjesto plosnatog amber diska. Ime je
`11px` na base, `12px` od `md`. Podizanje sjedala na potezu je 4 px (bilo 3).

### 4.3 Tko je na redu — četiri kanala odjednom
Na **sjedalu**: svijetli prsten s `turnDeadline` odbrojavanjem (conic
gradient; crven kad je hitno), **spotlight** koji se prelijeva na filc (puls
1,8 s, ugašen uz `reducedMotion`), puna svijetla pilula s imenom i podizanje
sjedala za 3 px. Ispod stola i dalje stoji `TurnPill` s tekstom. Prstenova
sekunda ispisuje se tek kad postane hitno.
Kad je pravi igrač na potezu, isti serverski timer crta se i kao obrub oko
donje `TurnPill` oznake. Botova oznaka ostaje mirna, bez odbrojavanja.

### 4.4 Tko zove — traje cijelo mješanje
`bidding.caller` + `bidding.trump` → medaljon s ikonom aduta na avataru
zvača, dolje lijevo, **cijelo mješanje** (ne prolazni čip). Isti medaljon
nosi i moj avatar u `MySeatBar` kad ja zovem. Srednja ćelija scoreboarda
(`TrumpBadge`: adut + ime zvača) ostaje — medaljon je dopuna, ne zamjena.

### 4.5 Stol kao objekt
`TableSurface`: elipsa `--table-w × --table-h`, centrirana na `--table-cy`;
`brand.700 → brand.800 → brand.900` radijalno, rub kao dva prstena
(`brand.900`, pa crni) umjesto bordera, sjena prema dolje, inset vinjeta +
tanka svijetla linija po gornjem rubu, unutarnji hairline prsten i blagi
centralni disk (132 px) kao "kuća" za štih. Elipsa je klipana na kutiju pa
donji rub izlazi prema igraču. Sve je iz `brand` rampe, `aria-hidden`,
`zIndex 0`.

### 4.6 Vraćeni okomiti prostor
44–64 px iz kutije stola + ~16 px iz `BiddingPanel` (gumbi 60 → 46 px, i
dalje iznad 44 px praga za dodir; padding 2 → 1,5). Dobitak ide u zrak oko
elipse (kolona centrira stol), pa scoreboard → stol → ruka ostaju tri bloka
bez page-scrolla na 390×844.

## 5. Zvanja na ekranu (2026-09-08)

### 5.1 Semafor: „+150” uz bodove podjele
`ScoreBoard` po timu i dalje ima **veliki broj = bodovi tekuće podjele iz
dovršenih štihova**, a `PlayerView.declarationPoints` (README §2) stoji uz
njega kao mali `+150`, `brand.200`, `textStyle="mono"`.

- **U istom je redu kao veliki broj**, ne u novom — §4.6 je ovaj ekran mjerio u
  pikselima i nema retka viška. Poravnat je `align="baseline"`, a stupac
  „Oni” ga crta `row-reverse` pa oba velika broja drže vanjske rubove, a
  bonusi su unutra.
- **Samo kad nije nula.** Zvanja boduje najviše jedan par (§1.4), pa druga
  strana obično nema ništa; iznimka je bela, koja je u tom broju (README §2),
  pa i „propali” par može dobiti `+20`.
- **Ne zbraja se u veliki broj.** Veliki broj je „koliko smo uzeli u
  kartama”; kad igrač računa „koliko još trebamo”, treba te dvije veličine
  odvojeno, a zbroj mu ionako stiže u sažetku podjele.

### 5.2 `DeclarationsReveal`: samo par koji boduje, bez naziva zvanja
- **Nema više zatamnjenog „PROPADA” bloka.** Zvanja para koji propada se ne
  šalju (§1.4) — nema ih što prikazati. Ostaje samo afirmacija „BODUJE”
  i rečenica „Naša/Njihova zvanja se boduju.”
- **Ako je izgubio MOJ par**, overlay dobiva jednu običnu rečenicu —
  `declarations.oursLost`, „Tvoja zvanja (70) propadaju.” — **bez karata**.
  Svoje karte igrač smije vidjeti (`view.declarations[mySeat]`), ali crtati
  ih ovdje ne služi ničemu: on ih drži u ruci, a nikakve tuđe karte se ne
  prikazuju. Zato: broj da, slike ne.
- **Uz svako zvanje idu samo karte i broj bodova.** Natpisi „terca (20)”,
  „kvarta (50)”, „četiri iste (150)” su maknuti (i ključevi
  `game.declaration.*`): za stolom to nitko ne izgovara, karte *jesu* zvanje,
  a bodovi su odmah do njih.

### 5.3 `BelaPrompt`: „Zovi belu?” (2026-09-08)
Zvanje bele više nije automatsko — igrača se **pita** (README §1.4). Pitanje je
u cijelosti na klijentu: postavlja se kad igrač dodirne K ili Q aduta držeći
obje, a odgovor odlazi kao zastavica na istom potezu, pa za stolom nitko ne
čeka.

- **Ne zaklanja štih.** Panel je usidren na **dnu felta**, preko ladice s
  rukom (koja je dok pitanje stoji ionako `disabled`) — bez backdropa i bez
  zatamnjenja. Štih je cijelo vrijeme čitak, jer se odluka donosi upravo na
  temelju onoga što je na stolu. Zato ovo **nije** centrirani modal kao
  `DealSummary` ni prekrivač kao `DeclarationsReveal`.
- **Oba odgovora su jedan dodir.** Dva gumba jednake težine, jedan do drugoga,
  visine 46 px (isti prag kao `BiddingPanel`); nema odustajanja i nema trećeg
  puta. Iza svega otkucava 20-sekundni timer poteza, pa je svaki dodatni korak
  skuplji nego što izgleda.
- **Jedan redak objašnjenja** (`bela.askHint`, „20 bodova — ali ako padnete,
  idu protivniku”): pitanje bi bez njega izgledalo kao formalnost, a razlog
  zbog kojeg postoji nije očit dok ga netko jednom ne izgubi.
- **Potvrda je postojeći `BelaFlash`.** Ništa ne javlja da je bela odbijena —
  ni protivniku ni suigraču — jer bi to objavilo da to sjedalo drži K+Q aduta
  (README §1.4). Odbijanje izgleda kao obična odigrana karta.
- Panel se sam zatvara čim pitanje prestane biti naše: potez je otišao dalje
  (istekao timer, bot odigrao umjesto nas), podjela je gotova, ili karte više
  nema u ruci.

## 6. HUD v3 (2026-09-13)

Dijagnoza koja je pokrenula ovaj krug (screenshot ~1700 px): prazan filc oko
malog clotha, „Zvanja” i „Štihovi” kao tekstualni ghost gumbi koji izgledaju
kao naslovi, semafor bez ikakvog osjećaja napretka prema cilju, timovi
nekodirani bojom, predimenzionirana ladica s kartama na širokom ekranu i tri
slične tamnozelene plohe bez hijerarhije.

Odgovor je **jedan HUD sloj** (gore semafor + kontrole, dolje ladica +
akcije) od dosljednog tamnog stakla, a između njih **stol kao fizički
objekt** na kojem sjedala sjede na rubu.

### 6.1 Boja tima — `TEAM` u `tableStyles.ts`
```
TEAM = { us: "brand.300", them: "#d9a521" }   // naša zelena, njihovo zlato
TEAM_SOFT = isti par na 55 % alfe            // hairline, glow, prsten u mirovanju
```
Zlato je bundevina boja s mađarica — jedina nova semantička boja u igri i
jedini novi literal. Čita se na **četiri mjesta i nigdje drugdje**:
`Seat` (prsten + pilula s imenom), `ScoreBoard` (kartica tima, „+150”, traka
napretka), `TrumpBadge` (obrub ćelije = tim zvača), `Hand` (glow legalnih
karata koristi `TEAM_SOFT.us` jer je ruka uvijek moja). Kanal je **redundantan**
— raspored, natpisi i brojevi i dalje govore isto — pa se ništa ne gubi ako ga
igrač ne primijeti; zato nije ni dostupnost-kritičan, a par zeleno/zlatno ionako
ne kolabira kod crveno-zelene sljepoće.

### 6.2 Semafor: kartice tima + traka napretka
Dvije **kartice** (MI / ONI) s hairlineom u boji tima i središnja trump ćelija
čiji obrub nosi boju **zvačeva** tima. Veliki broj ostaje tekuća podjela
(`2xl` base, `4xl` od `md`), „+150” uz njega u boji tima, ispod jedan redak
`ukupno 512 · do 1001` (tabular-nums). Pod njim je **traka od 2 px**:
`ukupno / cilj`, puni se od **vanjskog** ruba kartice prema unutra, pa dvije
trake rastu jedna prema drugoj. „512, do 1001” je dva broja i oduzimanje;
polupuna traka je isti podatak bez računanja. Stari podnožni redak je nestao
(cilj je u traci), ostao je samo chevron za povijest i to samo kad povijest
postoji. Traka ima `role="progressbar"` i `aria-label` (`game.score.progress`)
jer 2 px nije nešto što se vidi.

### 6.3 Stol: stadion s rubom, teksturom i vinjetom
`border-radius: 999px` na pravokutniku širem od visine — silueta stola za
kartanje, a ne još jedan panel u nizu panela. Slojevi izvana prema unutra:
**rim** (tamna traka, kao `border` istog elementa da postoji samo jedan
radijus; osvijetljen gornji rub, stvarna sjena prema sobi) → **cloth**
(radijalni gradijent, vinjeta kao `inset` sjena jer bi gradijent bandao) →
**tekstura** (`feTurbulence` kao inline SVG data-URI, `soft-light` 11 % na
clothu, `overlay` 4 % u sobi — ubija bandanje i daje filc) → **disk** za štih
(jedan slabi prsten, bez križića). Tekstura je `::before` sa `z-index: -1` uz
`isolation: isolate` na domaćinu: sloj s `mix-blend-mode` iznad sadržaja bi se
miješao u imena i brojeve.

Visina raste s ekranom (`--box-h`, §4.1), cloth se izvodi iz sjedala, a
sjedala preklapaju rim za `--seat-overlap`.

### 6.4 Ladica: 4 × 2 na telefonu, **1 × 8 od 48em**
Isti fiksni sortirani slotovi (pravilo 1 iz §2.4 se ne mijenja), samo drugi
oblik mreže: osam `md` karata je 618 px, kolona je ondje 760 px, pa red stane
bez smanjivanja karte i vraća ~130 px feltu. Legalne karte dok sam na potezu
dobiju **lift 6 px + glow** (`0 0 0 2px TEAM_SOFT.us, 0 10px 24px rgba(0,0,0,.45)`)
na **slotu**, ne na karti: `PlayingCard` zadržava vlastitu fiziku (hover lift,
focus ring), a glow nacrtan na karti bi ga odrezao njezin `overflow: hidden`.
Ilegalne karte se i dalje **ne zatamnjuju**. Dok je igrač na potezu sve su
karte gumbi; dodir nedopuštene karte objašnjava da se trenutačno ne može
odigrati, dok samo dopuštena šalje potez. Uz
`reducedMotion` ostaju i lift i glow (to je statični stil), gasi se samo
prijelaz između stanja.

### 6.5 Zaglavlje: `TableHeader.tsx`
Nova komponenta. Lijevo strelica natrag + ime sobe (`sm`, semibold, INK) +
statusni čipovi (`StatusChip` se preselio ovamo iz `GameRoomPage`), desno
**grupa pill gumba s ikonom i badgeom**: „Zvanja” (`FiFileText`, badge = bodovi
zvanja kad ih ima, disabled dok nisu otkrivena) i „Štihovi” (`FiLayers`, badge =
broj odigranih štihova), pa chat i zupčanik. Ispod `md` natpisi nestaju, ostaju
ikona + badge, a riječ živi u `aria-label`/`title`. Komponenta **nema stanja** —
sve brojke računa stranica koja ima `view`.

### 6.6 Ostalo
- **`TurnPill`** dobiva ikonu stanja (`FiPlay` / `FiTarget` / `FiClock` /
  `FiMoreHorizontal`, `aria-hidden`); ton „you” je `TEAM.us` puni s blagim glowom.
- **`ReactionsBar`** je **jedan segmentirani glass pill**: šest gumba 44 × 44 bez
  vlastitih obruba, hairline samo *između* njih, a cooldown gasi cijeli segment
  na 45 % umjesto šest diskova posebno.
- **Površine**: `FELT` je tamniji i mirniji + tekstura; `GLASS` je
  `brand.950/72` s hairlineom `brand.600/40` i **gornjim highlightom**
  (`inset 0 1px 0 rgba(255,255,255,.06)`) — tri neosvijetljena pravokutnika
  jedan iznad drugoga čitaju se kao jedna ploha sa šavovima.
- **Kolona** (`GameRoomPage`): `base 100%` → `md 760` → `lg 840` → `xl 900`.
  Okomiti redoslijed: HUD → stol (`flex 1`) → `MySeatBar` → `BiddingPanel`
  (samo kad je moj red) → ladica → reakcije. `SHORT` i `TIGHT` ponašanja iz §4
  su netaknuta.
- **Motion**: nove tranzicije su ≤ 160 ms; `reducedMotion` gasi kretanje, ne
  izgled.

## 7. Red događaja: kad se vide dvije karte iz talona i što kad istekne vrijeme (2026-09-20)

### 7.1 Talon se otkriva **na zvanje aduta**, ne 2,4 s poslije
Engine u istom stanju zaključa adut *i* dopuni ruku na osam karata, a
`useEventQueue` taj trenutak namjerno razlaže na ljudske korake
(`BID` 800 ms → `TRUMP_SET` 1600 ms → `HAND_COMPLETED` 1600 ms →
`DECLARATIONS_REVEALED` 4000 ms = točno 8000 ms serverskog `declarationsMs`).
Maska `talonRevealedDeal` u `GameRoomPage.tsx` ranije je čekala
`HAND_COMPLETED`, pa su se dvije nove karte pojavljivale 1,6–2,4 s nakon što
je stol već znao adut — zvač je gledao svojih šest karata i čekao
(zahtjev korisnika: „kad se odazove adut stavi da se odmah vide dodatne 2
karte, a ne da se mora cekati”).

Sada masku otključava **prvi događaj koji pokazuje zvanje**: `BID` (a
`TRUMP_SET` i `HAND_COMPLETED` ostaju kao rezervni okidači). Ključ je i dalje
**red događaja**, a ne `view.bidding.trump` — tuđi „Dalje” čipovi odigraju se
prije zvanja kao i do sada, a nijedan dwell se ne mijenja, pa zajednička
startna linija od 8 s ostaje netaknuta. Ruka zadržava fiksnih osam slotova,
prikvačena kašnjenja dijeljenja i `sessionStorage` ključ layouta
(`Hand.tsx`, `handLayout.ts`): dvije nove karte samo *umontiraju* se u svoju
sortiranu poziciju i odigraju `DEAL_IN`, ostale zadrže svoj DOM čvor.
Maske se i dalje brišu na svakoj `BIDDING` fazi (nova podjela, revanš).

### 7.2 „Propustio si potez”
Kad istekne 15 s, server jednom odigra potez umjesto igrača i sljedeći
`game.state` nosi `autoPlayed: true` (`gameRoom.ts`, `actForSeat`). Zastavica
ne nosi sjedalo, pa se potez pripisuje preko događaja: `game.events` ide
**prije** svog `game.state`, a jedan `apply()` je jedna akcija, pa je akter
sjedalo zadnjeg `BID` / `PASS` / `CARD_PLAYED` u tom okviru. Ako je to moje
sjedalo, otvara se `MissedTurnDialog` — mali informativni dijalog, ništa ne
blokira i ne pauzira red događaja.

Namjerno usko: ne pali se za tuđi istek, ne za gledatelje, ne za zaostale
događaje koje dobije klijent pri (ponovnom) ulasku (kursor preskače sve što je
već u ring bufferu, isto kao kursor za zvukove) i ne za automatski
`NEXT_DEAL` (njegov okvir nema događaj sa sjedalom). Zatvara ga gumb, backdrop,
kraj partije, ili — najprirodnije — sljedeći moj potez: svaki `game.bid`,
`game.pass` i `game.play` gasi dijalog. Nema „away” načina na serveru: igrač
jednostavno nastavlja na sljedećem svom potezu.

### 7.3 Fanfara ide uz ekran, ne uz zadnju kartu (2026-09-20)
`GAME_OVER` stiže u istom okviru kao i zadnja odigrana karta, dok red
događaja još skuplja zadnji štih, pa se pobjednički/gubitnički zvuk čuo
nekoliko sekundi prije nego što se ukazao „Pobjeda!” dijalog (zahtjev
korisnika: „trebao bi se cuti tek kad se pojavi ekran”). Zato `GameRoomPage`
na `GAME_OVER` samo **parkira** koji je to zvuk (`overSound`), a pušta ga
efekt koji gleda `gameOverOpen` — isti uvjet koji otvara `GameOverDialog`
(`phase === "GAME_OVER" && idle && !overDismissed`). Zvuk se troši, pa
ponovno otvaranje dijaloga nakon odbacivanja šuti, a klijent koji uđe u već
gotovu partiju i dalje ne čuje ništa (kursor preskače zaostale događaje).
Haptika `gameOver` ide s njim.

Uz to, **„Pokreni igru” ima svoj zvuk na klik** (2026-09-20, zahtjev
korisnika): kratka uzlazna dvotonska zvonjava `gameLaunch`, odsvirana u samom
`onStart` handleru prije `room.start`, dakle prije bilo kakvog odgovora
servera. Prvo ide `primeAudio()` — na iOS-u se audio kontekst smije otključati
samo unutar korisničke geste, a većini igrača je taj klik prva gesta u
sesiji. Miješanje prve podjele (`gameStart`) ostaje gdje je bilo, na `DEALT`
za `dealNo === 1`, i ulazi ispod zvonjave koja je dotad gotova.

### 7.4 Geometrija sredine stola (2026-09-20)
Tri broja drže „svi bacaju na sredinu”: `REST_Y` u `TrickArea.tsx`
(42/54 → 32/42, okomiti razmak karata u štihu), dodatnih −8 px samo za gornju
kartu (ispod suigračevog čipa statusa) i odmak gornjeg sjedala u
`SEAT_ANCHORS.top` (32 → 14 px), uz `--box-h` manji za istih 18 px. Bočna
sjedala dobila su `--seat-gutter` (8 px): prije su na uskom telefonu smjela
sjesti uz sam rub, pa je zeleni okvir „na potezu” bio praktički nevidljiv.
Sve četiri vrijednosti su i dalje na jednom mjestu (`tableStyles.ts` +
`util/seats.ts`), a `--seat-clear-x/y` su gornja granica koja se nije mijenjala.

### 7.5 Zaslon, odabir teksta i zvanje aduta (2026-09-20)

**„X zove adut” je sad pravi modal.** `TrumpFlash` više nije pilula na filcu
nego isti portal + zatamnjena pozadina + kartica kao `DeclarationsReveal`, s
velikim znakom boje (88 px). Traje `TRUMP_FLASH_MS` = 1500 ms, unutar vlastitog
dwella `TRUMP_SET` (1600 ms) i puno kraće od zvanja (4000 ms), pa se red
događaja ne mijenja. Ne može se zatvoriti rukom i ima `pointerEvents: none` —
nestane prije nego bi ga itko dotaknuo, a gutanje dodira kojim se baca sljedeća
karta bilo bi gore od same objave.

**Za stolom se ništa ne označava.** Dugi pritisak na kartu ili ime dizao je
iOS-ove ručice za odabir i povećalo usred dijeljenja. Korijen sobe
(`GameRoomPage`) sad nosi `user-select: none` + `-webkit-touch-callout: none`,
uz iznimku za `input`/`textarea`/`contenteditable`. Portali su izvan tog
podstabla, pa isto pravilo imaju `DeclarationsReveal` i `TrickHistory`
(`TrumpFlash` ionako ne prima dodire).

**„Drži zaslon uključenim”** (`hooks/useKeepAwake.ts`, postavka `keepAwake`,
zadano uključeno). Screen Wake Lock je web API, ne samo nativni: Chrome/Edge
odavno, Safari od iOS 16.4 — dakle radi i u instaliranom PWA-u. Gdje ga nema,
hook ne radi ništa i prekidač se uopće ne prikazuje (`keepAwakeSupported`).
Dva pravila API-ja koja hook poštuje: preglednik otpušta bravu čim stranica
prestane biti vidljiva i ne vraća je sam (zato ponovno traženje na
`visibilitychange`), a `request()` odbija umjesto da baca (prazna baterija,
politika) — svaki neuspjeh se guta. Brava drži zaslon **upaljenim**, ne
svijetlim: iOS ga i dalje zatamni, samo ga neće zaključati. Aktivna je samo
dok traje partija (`phase !== null && phase !== "GAME_OVER"`), ne u predsoblju
i ne nad završnim dijalogom.

**Prsten stola je na telefonu prilijepljen uz vrh.** Red koji drži `Table`
ima `justify={{ base: "flex-start", md: "center" }}`: višak visine ide ispod
bloka, a ne pola iznad, jer je razmak između zaglavlja i sjedala bio taj koji
je čitao kao prazan (2026-09-20, zahtjev korisnika).

**Zvuk kad netko sjedne** (`seatJoin`, 2026-09-20, zahtjev korisnika): dvije
tihe note kad igrač uđe u sobu ili se doda bot. Čita se iz `room.seats`, ne iz
`game.events`, jer sjedanje je stanje sobe. Prvi okvir sobe je nijem (to je
stol kakav je zatečen, ne dolazak četvero ljudi), odlazak ne zvuči, i jedan
okvir daje najviše jedan zvuk koliko god se sjedala promijenilo.

### 7.6 Telefon: ruka i štih se skaliraju prema stvarnom ekranu (2026-09-20)

Fiksni koraci (`sm` ruka, `sm`/`md` štih, tri media queryja koji ga opet
smanjuju) bili su ugođeni prema jednoj snimci zaslona i krivi na sljedećoj:
instalirani PWA, isti telefon u Safari kartici (adresna + alatna traka) i
visoki Android razlikuju se za 200 px visine. Dvije prijave u jednom danu —
„karte na stolu su jako male”, pa nakon pokušaja s `xs` rukom „karte u ruci se
jedva vide” — nisu bile o apsolutnoj veličini, nego o tome da je jedna hrpa
karata vidljivo manja od druge.

Zato je raspored na telefonu **budžet** (`hooks/useTableScale.ts`). Mjeri se
stvarna kutija sobe (`ResizeObserver` na korijenu `GameRoomPage`), oduzmu se
redovi koji se ne mijenjaju (semafor 106 + pilula poteza 32 + reakcije 56,
plus 34 px za home indikator samo u instaliranom PWA-u), a ostatak se dijeli
na dvije stvari koje se smiju rastezati:

- `--hand-k` — `zoom` dvorede ruke, koja se crta kao `sm` (56 × 90);
- `--pile-k` — `scale` štiha, koji se crta kao `md` (72 × 116), **i** razmaka
  sjedala koji od njega odstoje: `--seat-clear-x/y`, `--cy-free` i `--box-h`
  u `tableStyles.ts` množe se istom varijablom (116 px prstena je fiksno,
  214 px se skalira — `RING_FIXED` / `RING_SCALED`, držati u koraku).

Cilj podjele: karta na stolu i karta u ruci **podjednako široke**
(`72 * pile ≈ 56 * hand`), uz tri ispravka nakon prve dinamičke verzije
(korisnik: obje „malo prevelike”, štih je ulazio u bočna sjedala, avatar
preko karata):

- **štih ograničava i ŠIRINA**: pola ekrana mora primiti pola hrpe (104 px pri
  faktoru 1), bočno sjedalo (92) i razmake; hrpa smije ući 8 px u sjedalo, koje
  je oko avatara od 48 px uglavnom zrak. Gornja granica faktora je 1 (72 px);
- **ruka prati štih**, malo manja (`HAND_VS_PILE` = 0.92), a nikad ispod 0.95
  (≈ 53 px) osim ako to traži stvarna širina reda — ispod toga ruka prestaje
  biti čitljiva (pokus s `xs`), pa na niskom ekranu prvi popušta štih;
- **ruka je centrirana na STRANICU** (zahtjev korisnika: mreža centrirana u
  prostoru desno od avatara čitala se kao „sve je previše udesno”). Zato
  širinu ruke ograničava `width − 2 × 62 px`: centrirana mreža mora ostaviti
  mjesta avataru slijeva (i isto toliko zdesna). Avatar je na telefonu
  primaknut rubu (`insetStart` 20 → 12 px). `--hand-left` više ne postoji.

Primjeri (ruka / štih): PWA 393 × 852 → 57/67 px, 393 × 850 u devtoolsu →
61/67, Safari kartica → 53/53, Pro Max PWA → 66/72.

Od 48em naviše ništa od ovoga ne vrijedi (ruka je jedan red fiksne veličine,
oba faktora 1; položeni telefon zadržava 0.66 za štih). `TIGHT` blok u
geometriji i `PILE_SCALE` u `TrickArea` su uklonjeni — bili su pogađanje
onoga što hook sad mjeri. Traka reakcija ostaje 34 px na telefonu.
Preglednik bez CSS `zoom` (Firefox < 126) jednostavno zadržava `sm` ruku.

**Miješanje se čuje na svakom dijeljenju.** `gameStart` je dosad išao samo na
`DEALT` s `dealNo === 1`, a upravo taj je bio progutan: kursor za zvukove
namjerno preskače prvu hrpu događaja (da se pri ponovnom ulasku ne odsvira
cijela podjela), a prvi okvir koji stol dobije već sadrži `DEALT`. Sad se
zvuk pušta na **svakom** `DEALT`, a prva hrpa iznimno oglasi miješanje ako joj
je najnoviji događaj baš `DEALT` (dakle dijeljenje počinje sad, nismo upali u
partiju u tijeku). Jaše sirovi tok događaja, pa padne dok red još igra kraj
prethodne podjele — točno prije nego se pokažu nove karte.

### 7.7 Zvanja: tabovi po paru, manji modal za adut (2026-09-20)

Dvije pločice s ukupnim bodovima na vrhu overlaya zvanja (`MI +20` / `ONI
+20`) postale su prave kartice-tabovi (`role="tab"`, `aria-selected`,
strelice lijevo/desno za prebacivanje): klik na jednu prikazuje samo redove
tog para — njegova zvanja po sjedalu i belu, ako je baš taj par zvao belu.
Dosad su se, kad su oba para nešto zvala, svi redovi miješali ispod obje
pločice i nije se dalo na prvi pogled reći tko je što zvao (korisnički
zahtjev). Zadana pločica je paru gledatelja, ako on ima što pokazati
(uključujući "naša zvanja propadaju" retka kad je protivnički par bio
pobjednički); inače protivnički par; ako samo jedan par ima što pokazati,
taj se i odabere. Odabir se resetira na svaki novi prikaz (nova podjela),
pa stara pločica ne ostane zapamćena iz prošle ruke. Par bez ičega je i
dalje klikabilan i pokaže kratku poruku ("Nema zvanja" / novi ključ
`declarations.noneForTeam`). Gledatelji (`mySeat === null`) i dalje vide
oznake "Tim A"/"Tim B" kao i prije; ništa se u vremenu automatskog
zatvaranja overlaya nije promijenilo.

`TrumpFlash` (modal "X zove adut") je smanjen na korisnički zahtjev — bio je
prevelik i tekstom i slikom boje: ikona boje 88 → 52 px, naslov `2xl` → `lg`,
širina kartice 340 → 280 px, padding 6/6 → 5/4 (px/py). Ostaje ista obitelj
(isti portal, pozadina i kartica kao zvanja), samo manja instanca.

### 7.8 Gledatelji: bez reakcija, s brojačem (2026-09-20)
Gledatelj **ne može slati reakcije** (zahtjev korisnika). Traka reakcija se za
njega više ne crta, a server je odbija (`chat.react` bez sjedala →
`BAD_REQUEST`, `ws.ts`) — klijent nije pravilo. Prije je poruka gledatelja
prolazila sa `seat: null`. U zaglavlju stola stoji čip „Gledatelji: n" kad
soba dopušta gledatelje (`room.allowSpectators`); broj je `room.spectators.length`
i mijenja se uživo s `room.state`. Bez dopuštenih gledatelja čip se ne crta,
jer bi uvijek pisao 0.
