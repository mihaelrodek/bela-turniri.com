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
broj odigranih štihova), pa zupčanik. Ispod `md` natpisi nestaju, ostaju
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

### 7.9 Web: veći štih, partner bliže semaforu (2026-09-20)
Zahtjev korisnika sa snimke desktop prikaza: partner neka sjedi „još gore,
bliže boxu s bodovima”, a karte neka budu veće.
- **Štih je `ml` (84 × 135) od 48em naviše** (`TrickArea`: `REST_X` 78, `REST_Y`
  50, `FLY_IN` 200, `COLLECT` 400); telefon ostaje `md` pod `--pile-k`.
  Razmaci sjedala u `WIDE` bloku prate ga: `--seat-clear-x` 108 → 132,
  `--seat-clear-y` 120 → 126.
- **Stol je uz vrh svog reda na svim širinama** (`justify="flex-start"`, prije
  `center` od `md`): višak visine ide ispod, ne napola iznad partnera. Da taj
  višak ne ostane prazan, kutija raste: `boxH(392, 50, 520)` → `boxH(430, 54, 580)`.
- **Ruka nije povećana**: osam `ml` karata je 714 px, a stupac je 880–900 px;
  s većim (`lg`, 96) ostalo bi manje od 45 px uz svaki rub za avatar.

**Tab bez zvanja se ne da označiti** (2026-09-20, zahtjev korisnika, §7.7):
par koji nema što pokazati (nema zvanja ni bele) ima ugašen tab — `aria-disabled`,
nema klika, strelice ga preskaču, prigušen je (opacity 0.4, `not-allowed`).
Iznimka je vlastiti par čija su zvanja propala: on ostaje aktivan jer na njemu
stoji redak „zvanja su propala”.

**Zvuk kad netko napusti sobu** (`seatLeave`, 2026-09-20, zahtjev korisnika):
zrcalo od `seatJoin` — iste dvije tihe note, ali padajuće. Pali se kad se
stolica isprazni (igrač otišao ili je bot uklonjen) ili kad igračevo mjesto
preuzme netko drugi; igrač zamijenjen botom usred igre je jedan padajući zvuk,
ne dva. Odlazak pobjeđuje dolazak u istom okviru. Prekid veze nije odlazak:
sjedalo se drži tijekom reconnect grace-a i njegov vlasnik se ne mijenja.

### Belot — zajednička priredba (2026-09-20, zahtjev korisnika, drugi prolaz)

`components/BelotShowcase.tsx` zamjenjuje stari panel s 4×2 mrežom sličica u
`BelotFlash` i konfete u bloku (`blok/components/BelotCelebration.tsx`). Karte su
UVIJEK `klasicne`, bez obzira na špil igrača; na stolu prava boja belota, u bloku
`randomSuit()`.

- **Pozadina živi cijelo vrijeme**: dva zamućena svjetla koja plove (zlatno,
  smaragdno), dva sloja zraka koji se okreću jedan protiv drugoga (zlatni i
  pulsira), 28 iskri i 9 blijedih znakova boje koji se dižu u petlji (negativni
  `animation-delay`, zrak je pun od prvog kadra).
- **Karte**: paket se diže LICEM DOLJE, sjeda na lijevi kraj luka i širi se u
  lepezu (±22,75°, polumjer 260 px); 1150–2260 ms karte se okreću jedna po jedna
  pravim 3D okretom (`rotateY`, `backface-visibility`) — to je ujedno vrijeme da
  se klasična slika dekodira. Poslije: val kroz karte, odsjaj u petlji, cijela
  lepeza se njiše u 3D, svjetlo pod njom diše.
- **Udar (2250 ms)**: bljesak, dva prstena, 30 komada praska (znakovi boje +
  iskre, `vmin`), pozornica se jednom zatrese, riječ PADA (scale 3,4 → 1, blur),
  zatim se presijava i valovi slovo po slovo.
- Lepeza se crta jednom (360×156, `md`) i skalira
  `min((vw−28)/360, 0.4·vh/156, 1.7)`, dno 0,5 — mobitel (karte ~73 px), tablet,
  web (do ~122 px), pejzaž.
- `EVENT_DWELL_MS.BELOT` = 7600 (bilo 3200); blok 7600 ms ili dodir. Zadnjih
  400 ms blijedi. Na stolu dodiri prolaze kroz sloj.
- Smanjena animacija: lepeza licem gore, riječ i mirno svjetlo; ništa se ne miče.
- Keyframes idu kroz emotionov `keyframes()` na razini modula (kao `Hand`), NE
  kao ugniježđeni `"@keyframes"` u `css` propu: te animacije koje se pozivaju s
  DRUGOG elementa u pregledniku nisu krenule (prijava korisnika, 2026-09-20 —
  stajao je zatvoren paket). Mirno stanje svake karte je zato ujedno i zadnji
  kadar (lepeza otvorena), pa mrtva animacija više ne može ostaviti paket.

### „Požuri” — haptika zadnje 3 sekunde (2026-09-20, zahtjev korisnika)

Dok je MOJ potez (zvanje ili karta), na 3, 2 i 1 s prije isteka ide po jedan lagani
otkucaj (`playHaptic("turnHurry")`, `TURN_HURRY_TICKS_MS` u `GameRoomPage`). Potez
mijenja `turn`, cleanup gasi preostale otkucaje. Nativno: `ImpactStyle.Light`; web:
`navigator.vibrate(35)` — u praksi samo Android (Safari/iOS PWA nema Vibration API,
desktop nema čime). Isti prekidač „Zvuk” kao i ostala haptika. Staro upozorenje na
25 % sata ostaje, osim kad bi palo unutar ~3,5 s od kraja (kratak sat).
Uz svaki otkucaj ide i tihi „tik” (`turnTick`, zadnji `turnTickLast` kvartu više):
45 ms, ispod svih ostalih zvukova — zamjena za vibraciju na iOS Safariju/PWA-u.

### Izlazak iz sobe koja ne igra (2026-09-20, prijava korisnika)

Sjedalo se preko navigacije čuva SAMO dok je igra u tijeku (`PLAYING`). Odlazak sa
stranice stola dok je soba `LOBBY` — uključujući lobi u koji padne ZAVRŠENA partija —
je izlazak: `gameConnection.retain()` pri otpuštanju „table” retainera zove
`leaveIdleRoomAfter` (jedan task odgode; StrictMode/remount ga poništava, reload ne
izvršava cleanup pa ne izlazi). Prije je sjedalo ostajalo zauzeto, popis igara nudio
„Vrati se u igru” za gotovu partiju, a avatar stajao u sobi. `finishLeave` sada pušta
i parkirani ulazak u DRUGU sobu.

Server (`ws.ts`, `heldSeatIn`): `game.state` završene partije dobiva samo onaj tko je
PRIJE tog `room.join` već držao sjedalo; tko uđe iznova (i nakon izlaska) dobiva čist
lobi, bez starog rezultata i dijaloga. Soba koja je `PLAYING` sinkronizira uvijek.

### Znakovi boja za „moderne” + zvuk nakon povratka u aplikaciju (2026-09-20)

- **Adut u „modernim” kartama** više nije naš vektorski crtež nego znak s tih istih
  karata: `assets/moderne/suits/*.webp` (192×192 RGBA), izrezani iz Dečka svake boje
  skriptom `frontend/scripts/extract-moderne-suits.py`. `DeckSuitIcon` ih pokupi sam
  (isti put kao `klasicne`), pa vrijede za semafor, medaljon zvača, gumbe zvanja i
  bljesak aduta.
- **Zvuk se „naslaže”** kad iOS oduzme audio (druga aplikacija, poziv, pad veze):
  kontekst javlja `running`, a sat mu stoji, pa se sve zakazano odsvira odjednom kad
  sat krene. `sounds.ts`: sat se nadzire (`clockIsStalled`), u stojeći kontekst se ne
  renderira, nakon 1,5 s se kontekst zatvara i gradi novi na sljedeći dodir
  (dekodirani bufferi ostaju); dok je stranica skrivena ništa se ne svira i sve
  aktivno se gasi; najviše 4 zvuka u 600 ms.
- **Long-press pregledi na iOS-u** (slika „Save to Photos”, link „Add to Reading
  List”): `platform/noCallout.css` (importira ga `main.tsx`) + `contextmenu`/`dragstart`
  u `PwaNativeGestures`, samo za `pointer: coarse`; izlaz `data-allow-callout`.

### „Zvanje aduta” bez obruba (2026-09-20, prijava korisnika)

Srednja ćelija semafora (`TrumpBadge.tsx`) je dok se zove adut prikazivala blijedi
zaobljeni obrub oko sitnog sivog teksta „ZVANJE ADUTA” — grana za odabrani adut taj
isti obrub već gasi (`borderWidth="0"`), pa je razlika između faza čitana kao greška,
ne kao namjera. Grana bez aduta sad isto gasi obrub od početka; `CELL`-ov `minW`/
`minH` ostaje pa se otisak ćelije ne mijenja kad adut bude zvan (semafor ne „skoči”).

### Šifra sobe — biračka tipkovnica (2026-09-20, prijava korisnika)

`JoinByCodeDialog` (predvorje i pristup privatnoj sobi preko linka) prikazivao je
običan `<Input inputMode="numeric">`. Na iPhoneu, u instaliranom PWA-u, sistemska
tipkovnica i njena traka nad njom prekriju cijeli zaslon čim se polje fokusira —
korisnik ne vidi ni naslov dijaloga ni upravo upisane znamenke, unos je „odmah
zablokiran”. Rješenje je biračka tipkovnica po uzoru na konkurenciju: donji list
(bottom sheet) na mobitelu, centrirani dijalog od `md` naviše, s naslovom, X za
zatvaranje, četiri velike kućice za znamenke (blijedi placeholder „0” dok je
kućica prazna) i mrežom 3×4 velikih tipki (1–9, zatim „obriši sve” / 0 / brisanje
zadnje znamenke). Nijedna tipka nije fokusabilan tekstni input — sistemska
tipkovnica se nikad ne otvara na dodirnom uređaju. Hardverska tipkovnica i dalje
radi na desktopu (znamenke, Backspace, Escape zatvara, Enter šalje kad je šifra
puna) preko `keydown`/`paste` slušatelja na `document` dok je dijalog otvoren, jer
ne postoji fokusabilan element na koji bi se inače vezali. Šifra i dalje ima 4
znamenke (server: `game/packages/server/src/ids.ts` `newRoomCode`) i autošalje se
čim je unesena zadnja — kao i prije, samo bez tipkovnice koja to sprječava. Kriva
šifra (`ROOM_NOT_FOUND` s `ref: "room.joinByCode"`, i analogno pun/blokiran
gledatelj) briše upisane znamenke i lagano protrese kućice
(`usePrefersReducedMotion` + „Smanji animacije” isključuju animaciju), tako da se
odmah može pokušati ponovno umjesto da se ekran nasumce zatvori.

- **Tko ima belot (2026-09-20, zahtjev korisnika):** ispod riječi BELOT ide pločica
  igrača — lice (`PlayerAvatar` lg, botovi svojim licem), ime krupno i oznaka strane
  („Mi” / „Oni”, gledatelju „Tim A/B”); ispod nje samo „Svih osam karata — <boja>”.
  Ime više nije utopljeno u sitnom podnaslovu. U bloku pločice nema (blok ne zna tko
  je imao belot).

## Bot: prisilni poziv u završnici (2026-09-20)

Prijava „bot je zvao na 7, 8, 10": nije bilo praga nego `mustNotPass` — pri
572:924 na 1001 pravilo „protivnici bi jednom podjelom došli do cilja" prisililo
je bota (nije djelitelj) da zove najbolju boju bez ikakvog praga. Pravilo sad
traži da BOTH strane budu unutar jedne podjele (90) od cilja, tj. da pobjednik
podjele stvarno odlučuje partiju („izjednačen" iz BOT.md); inače bot pasira
slabu ruku. Mus (djelitelj) i dalje bira najjaču boju po `suitStrength`.
Testovi u `heuristicBot.test.ts` (nisu pokrenuti).

## Karma ispod postotka + objašnjenje (2026-09-20)

- `SeatKarmaPill` (`GameStatsPills.tsx`) je sada gumb koji otvara Popover s
  objašnjenjem (`game.karma.explain`, hr + sl) — pravila su iz backendovog
  `GameReliabilityService`: start 10/10, napuštanje partije u tijeku uz barem
  još jednog čovjeka −1 (nakon isteka roka za povratak), svake 3 završene +1
  (`KARMA_RECOVERY_GAMES` u `util/gameStats.ts` zrcali backend). Klik ne
  propagira, pa je siguran unutar kartice sjedala.
- Sjedalo u `RoomPanel`: pilula rezultata (0–0 · 0%) i karma su složene
  okomito, karma centrirana ispod postotka.
- Lobby zaglavlje (`GameLobbyPage`): karma se prikazuje i uz vlastite
  statistike — centrirana ispod reda pilula na md+, ispod mreže na mobitelu.
  Ključ `room.karmaTitle` je uklonjen (zamijenio ga je popover).

### Zvanja, header i zbroj nakon dijeljenja (2026-09-20)

- **Dijalog „Zvanja”:** par bez (važećih) zvanja nije tab (disabled, bez fokusa, bez odabira). Propala zvanja gubitničkog para više se ne računaju kao „sadržaj” i redak „Tvoja zvanja (X) propadaju” je uklonjen (ključ `declarations.oursLost` izbrisan, prop `ownDeclarations` također). Ako samo jedan par ima zvanja, on je automatski odabran.
- **Header:** ćelija „Zvanje aduta” nema nikakav obrub/outline/sjenu (`CELL` u `TrumpBadge`). Chip gledatelja je ikona oka + broj; tekst „Gledatelji: n” ostaje kao `title`/`aria-label` (`StatusChip` prima `label`).
- **Ukupni zbroj u headeru:** dok je faza `DEAL_DONE`, server je već pribrojio podjelu u `score`, a veliki brojevi još prikazuju tu istu podjelu (747, „127 +50”, 924 izgledalo je kao dvostruko brojanje). `ScoreBoard` u toj fazi prikazuje zbroj PRIJE podjele (`score − dealScore.total`) i tek s idućom podjelom prelazi na novi; „Upisano” ostaje u `DealSummary`, pa se header i sažetak ne razilaze.

### Bot pred kraj partije: protivnik blizu cilja (2026-09-20)

Kad su PROTIVNICI blizu cilja (npr. 990 od 1001), a mi daleko, bot ne smije
zvati na srednjoj ruci: pad im daje sve bodove i partiju, pa je bolje pustiti
da zovu oni i padnu. Granica nije tvrda: `opponentDanger` je rampa 0..1
(0 na `cilj − 120`, 1 na `cilj − 20`; 930 ≈ 0.5, 950 ≈ 0.7, 990 ≈ 1). Rasta
i minimalna snaga aduta (`suitStrength` 4.5 → 8) i potreban `handTricks`
(+1.5), pa jaka ruka (dečko, devetka, as i dužina aduta, ili šansa za štigliju)
i dalje zove. Diler koji mora zvati i pravilo „obje strane blizu cilja"
(`mustNotPass`) ostaju kakvi jesu. Testovi u `heuristicBot.test.ts`, nisu
pokrenuti.

### „Nova igra": dodatne opcije su sklopljene (2026-09-20)

Dijalog po defaultu pokazuje samo „Igra se do" i gumb „Dodatne opcije"
(`showMore` u `CreateGameDialog.tsx`). Sve ostalo — način završetka, postotak
pobjeda, privatna igra, gledatelji, bez zvanja, bela, gledanje štihova — je
unutra. Razlog: gotovo svaka partija se igra s defaultima, a osam redaka je na
mobitelu guralo gumb „Nova igra" ispod ruba. Vrijednosti se čuvaju i kad se
sekcija sklopi; šalje se isto što i prije.

### Bot: šest pravila sa stola (2026-09-20)

Prijava iz žive partije, sve u `game/packages/bots` i opisano u `BOT.md` §13:
zadnji u štihu s asom i desetkom bočne boje igra **asa** (rez dolazi); boja koju
je suigrač otvorio, a bot uzeo asom, **vraća** mu se, osim ako ju je otvorio
malom (7/8/9) — to je „imam dečka, vrati aduta”; zvač koji je zvao na duljinu
bez dečka izbija ga **malim adutom**; nakon što je suigračev niski adut uzet
**dečkom**, vraća se mali adut a devetka ostaje doma; a adutski se štih uzima
**dečkom**, ne asom, dok devetka može sjediti iza bota. Zvačevo otvaranje
(as/devetka, dečko zadnji) je netaknuto. Testovi su napisani, nisu pokrenuti;
A/B mjerenja nema.

### bela.games — uži prikaz iste aplikacije (2026-09-20)

Isti build, isti backend, isti Firebase, ista game-server lobby — samo drugi
domenski dio istog frontenda, uveden `src/site.ts` (`siteMode`/`isGamesSite`,
`publicOrigin`, `siteName`, `homePath`) i `App.tsx` (redirect s full-site-only
putanja na bela-turniri.com, oba nedirana ovom izmjenom). `bela.games` i
`belot.games` su ravnopravni blizanci — isti prikaz, svaki sa svojom domenom
u `publicOrigin`/`siteName`.

Skriveno na `bela.games`/`belot.games` (a vidljivo na bela-turniri.com):

- **Navigacija** (`NavBar.tsx`, `MobileTabBar.tsx`) — Turniri/Kalendar/Karta
  ispadaju iz oba izbornika; ostaju samo Igraj i Blok. Marka (logo+tekst) i
  link vode na `homePath` umjesto tvrdo na `/turniri`; naziv marke je
  `siteName`, ne prijevodni ključ. Raspon "Igraj" diska u mobilnoj traci
  računa se po poziciji u (filtriranom) popisu, ne po fiksnom indeksu.
- **Profil** (`PublicProfilePage.tsx`, `profile/sections.ts`) — kartica
  "Turniri" (povijest nastupa) postaje "Statistika" (samo `GameStatsCard`,
  bez povijesti turnira); "Predlošci" (spremljena imena parova za prijavu na
  turnir) i "Računi" (računi za mečeve) nestaju posve; admin kartica
  "Dashboard" (upravljanje turnirima) nestaje, ali "Analitika igre", "Popis
  igrača" i "Poruke" ostaju — to su opći alati, ne turnirski. Postavke,
  avatar, tema/jezik, statistika igre i povijest bloka ostaju netaknuti.
  Posjetitelj tuđeg profila na games stranici vidi samo identitetsku
  karticu, bez popisa turnira.
- **"Nema igre" stranica** (`GameComingSoonPage.tsx`, dok je produkcijski
  prekidač isključen) — gumb "Natrag na turnire" nestaje, ostaje samo
  "Otvori blok".
- **404** (`NotFoundPage.tsx`) — gumb vodi na `homePath` s natpisom "Natrag
  na početnu" umjesto "Natrag na turnire".
- **Prijava/registracija** (`LoginPage.tsx`, `RegisterPage.tsx`) — zadani
  `?next=` fallback je `homePath`, ne `/turniri`.
- **Kontakt** (`ContactPage.tsx`) — gumb nakon slanja poruke vodi na
  `homePath` s natpisom "Natrag na početnu".

Ostalo namjerno netaknuto: `RequireAuth`, `ErrorBoundary`, `OfflineNotice`
već su generički (`/`, `/blok`) i rade ispravno na oba weba bez izmjene.
Vodič kroz aplikaciju (`PageTour.tsx`/`tourSteps.ts`) pokreće se samo s
`/turniri` i `/turniri/:slug` — full-site-only putanja, pa se na games
stranici uopće ne učitava (App.tsx-ov redirect je presreće prije rutiranja).

Vanjske poveznice i naslovi (canonical/og, dijeljenje) sad idu preko
`publicOrigin`/`siteName` umjesto tvrdo upisanog `bela-turniri.com` ili
`window.location.origin` (potonji je `capacitor://localhost` u nativnoj
ljusci): `ContactPage`, `PrivacyPage`, `TermsPage`, `BlokPage`,
`SharedBlokPage`, `PublicProfilePage` (canonical + Person/BreadcrumbList
JSON-LD), `blokHistoryApi.ts#blokShareUrl`, footer copyright
(`SiteFooter.tsx`) i naslov instalacijskog dijaloga
(`FirstRunInstallPrompt.tsx`, `InstallAppButton.tsx`, ključ
`common.install.title`/`genericSubtitle` s `{site}` placeholderom). Pravni
tekst na `PrivacyPage`/`TermsPage` i dalje imenuje "vlasnika
bela-turniri.com" u tijelu teksta — to je pravni sadržaj, nije dirano ovom
izmjenom (samo `canonical` URL je popravljen); vlasnik bi trebao odlučiti
treba li tekst spominjati oba weba.

---

## Sigurne zone i tipkovnica u nativnoj aplikaciji

### Jedno pravilo

**WebView je *full-bleed* na obje platforme.** Ispod statusne trake, ispod
ureza/Dynamic Islanda, ispod home indikatora i ispod Androidove
gesture/navigacijske trake operativni sustav ne ostavlja ništa slobodno — sve
plaća sama aplikacija, i to **isključivo preko `var(--safe-top)`,
`var(--safe-right)`, `var(--safe-bottom)` i `var(--safe-left)`** (definirane
jednom, u `<style>` bloku `frontend/index.html`).

Nikad ne piši goli `env(safe-area-inset-*)`. Na Android WebView-u starijem od
140 `env()` se tiho rezolvira u `0px` iako sustav stvarno crta edge-to-edge;
jedini izvor koji tamo nosi pravi broj je `--safe-area-inset-*`, koji ubrizgava
Capacitorov `SystemBars` plugin. `--safe-*` je `max()` tih dvaju izvora, pa je
točan u oba slučaja i svugdje drugdje (desktop, obična kartica preglednika)
iznosi 0.

Praktično, za svaki element koji dodiruje rub ekrana (`position: fixed`,
`position: sticky`, `inset`, `top/bottom/left/right: 0`, `100dvh`):

- **Obojena ploha smije doći do ruba; sadržaj ne smije.** Donje trake
  (`MobileTabBar`, blokova akcijska traka, donji *sheet*) boje se do dna i
  razmak drže *unutarnjim* `padding-bottom: calc(<gap> + var(--safe-bottom))`,
  da se ispod trake ne pojavi traka druge boje.
- **Visine se računaju s insetom**, ne s golim pikselima — `NAVBAR_SAFE_TOP`,
  `CONTENT_STICKY_TOP`, `MOBILE_TABBAR_CLEARANCE`, `ACTION_BAR_RESERVE`
  (`components/navChrome.ts`, `blok/actionBar.ts`).
- **Vodoravni rubovi nisu opcionalni.** U portretu su `--safe-left/right` nula,
  ali u landscapeu na telefonu s urezom nisu; zato ide
  `max(var(--chakra-spacing-N), var(--safe-left))`, a ne čisti razmak.
  Cjeloekranski *overlay*-i (`BelotShowcase`, `DeclarationsReveal`,
  `TrickHistory`) koriste `OVERLAY_SAFE_INSET` iz `navChrome.ts`.
- **Samo zadnji element u stupcu plaća `--safe-bottom`.** Ako ga plate i
  omotač i dijete, u instaliranoj aplikaciji nastane ~70 px mrtvog prostora
  (stvarna prijava, 2026-09-20).

### Odabrana konfiguracija i zašto

`frontend/capacitor.config.ts`:

| Postavka | Vrijednost | Razlog |
| --- | --- | --- |
| `ios.contentInset` | `"never"` | To je samo `WKWebView.scrollView.contentInsetAdjustmentBehavior`. Kod `"automatic"` UIScrollView sam odmakne sadržaj za sigurnu zonu, **a `env(safe-area-inset-*)` i dalje prijavljuje pravi inset** — pa se stranica koja se i sama odmiče odmakne dvaput. `"never"` je ujedno Capacitorov vlastiti default i jedina vrijednost pod kojom isti CSS vrijedi i na iOS-u i na Androidu. |
| `plugins.StatusBar.overlaysWebView` | `true` | Na Androidu 15+/targetSdk 36 opcija ionako nema učinka (README samog plugina). Na iOS-u je `false` skraćivao okvir WKWebView-a **i** podmetao neproziran `backgroundView` obojen `StatusBarConfig.backgroundColor`, čiji je default `.black` — to je bila crna traka na vrhu u svijetloj temi, plus treći inset povrh naša dva. Traku iznad ureza sada crta sama aplikacija (`components/StatusBarSafeArea.tsx`). |
| `plugins.Keyboard.resize` | `"native"` | `resize` je iOS-only (vidi `definitions.d.ts` plugina). `"body"` postavlja samo `document.body.style.height`, a `position: fixed` se ne računa prema `body`-ju — donja traka, ruka i donji *sheet* ostajali bi **iza** tipkovnice. `"native"` skraćuje okvir WKWebView-a, pa `100dvh`, `position: fixed` i `--safe-bottom` prate tipkovnicu. To je točno ono što Capacitor 8 već radi na Androidu (`SystemBars` puni roditelja WebView-a IME insetom i javlja `--safe-area-inset-bottom: 0` dok je tipkovnica gore). |
| `plugins.Keyboard.resizeOnFullScreen` | uklonjeno | Android-only zaobilaznica koju Capacitor 8 ionako preskače — `Keyboard.possiblyResizeChildOfContent` odmah izlazi kad je klasa `SystemBars` na classpathu, a u Capacitoru 8 uvijek jest. Ostavljena, bila bi poziv na dvostruko skraćivanje čim se taj uvjet promijeni. |

Android prozor (`android/app/src/main/res/values/styles.xml`,
`AndroidManifest.xml`): prozirne statusna i navigacijska traka,
`enforce*Contrast` isključen (inače sustav podmeće sivi veo točno u toj traci),
`windowLayoutInDisplayCutoutMode="shortEdges"` za landscape,
`windowSoftInputMode="adjustResize"`, i `windowBackground` =
`@color/app_window_bg` (`#DAE7DE` / `#161719`, DayNight) — to je ono što se
vidi iza traka na WebView-u < 140, gdje `SystemBars` puni roditelja WebView-a
umjesto da pusti stranicu ispod traka. Napomena: ta boja prati **noćni način
OS-a**, dok je svijetlo/tamno u aplikaciji spremljena preferencija koja ne
prati sustav (`color-mode.tsx`, `enableSystem: false`).

Ikone traka prate boju aplikacije, ne OS-a: statusnu traku postavlja
`NativeShell.tsx` (`@capacitor/status-bar`), a **navigacijsku**
`StatusBarSafeArea.tsx` preko `SystemBars.setStyle({ bar: "NavigationBar" })`
iz `@capacitor/core` — `@capacitor/status-bar` na Androidu dira samo
`setAppearanceLightStatusBars`, pa bi navigacijska traka inače ostala nevidljiva
(tamne ikone na tamnoj plohi) kad je aplikacija tamna, a OS svijetao.

### iOS zumiranje polja

Mobile Safari / WKWebView zumiraju stranicu kad fokusirano polje ima
`font-size` manji od 16 px, a u *standalone* aplikaciji nema načina da se
odzumira. `index.html` zato nosi, pod `@supports (-webkit-touch-callout: none)`
(najuži pošten test za "WebKit na iOS-u"), pravilo
`input, select, textarea { font-size: max(16px, 1em) }` — diže samo polja
stvarno ispod praga, npr. Chakrin `size="sm"`.

### bela.games — zaglavlje na mobitelu (2026-09-20, dizajn vlasnika)

Stranica za igru ima točno dva mjesta, pa su ona **prekidač u sredini
zaglavlja** (`GamesSwitch` u `NavBar.tsx`: Igraj | Blok), a ne traka na dnu.
Lijevo je samo znak, bez imena; desno jedan hamburger koji otvara **bočnu
ladicu** (`GamesSideMenu`, `Drawer placement="end"`) s računom, novostima,
temom, jezikom, instalacijom i odjavom. `MobileTabBar` se na ovoj stranici
uopće ne crta, a `MOBILE_TABBAR_H` je 0, pa sve što se odmiče od donje trake
(„Nova igra", akcijska traka bloka) sjeda na dno bez praznine. Puna stranica
(bela-turniri.com) i prikaz od `md` naviše nisu dirani.

Karma u lobbyju stoji **uz ime igrača**, ne u vlastitom redu ispod pločica sa
statistikom: to je podatak o igraču, a sama u redu čitala se kao šesta pločica.

### Bot i štihak (2026-09-20)

Tri nova pravila u `BOT.md` §14: bot s najjačim adutima nastavlja vući adute
da suigrač može odbacivanjem pokazati gdje preuzima, i staje čim suigrač
odbaci iz svih boja koje bi botu trebale; suigrač čuva boju za preuzeti cijelu
i ostale baca od veće prema manjoj; u obrani bot ne skida čuvara sa svog
jedinog stopera. Testovi su napisani u `evaluate.test.ts`, nisu pokrenuti.

### Vlastiti izgled za bela.games: logo, naziv, favicon (2026-09-21)

Jedna aplikacija, dva brenda. Sve što je vezano uz izgled brenda stoji na
**jednom** mjestu, pa je promjena zamjena datoteka, ne izmjena koda:

| Što | Gdje |
|---|---|
| Naziv | `GAMES_BRAND_NAME` u `frontend/src/site.ts` **i** `GAMES_NAME` u `vite.config.ts` (isti tekst) |
| Logo, ikone, favicon, OG kartica | `frontend/public/games/`: `symbol.svg`, `symbol.png` (kvadrat), `favicon.ico`, `apple-touch-icon.png` (180×180), `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `og-card.png` (1200×630) |
| Zaglavlje, pokretanje, instalacija | `brand.symbolSvg` iz `site.ts` |
| HTML ljuska (`index.games.html`), manifest | `vite.config.ts` (`gamesShell`), `manifest.games.webmanifest` |
| `/favicon.ico`, `/apple-touch-icon.png` | Caddy ih na domenama igre preusmjerava u `/games/…` |
| Obavijesti (naslov, ikona) | `sw.js` bira po hostu; nativno `push.fallbackTitle` s `{site}` |
| Naslov kartice preglednika | `useDocumentHead` — na domeni igre `siteName` (prije je bio uvijek „Bela turniri") |

Trenutne datoteke u `public/games/` su kopije logotipa turnira kao rezervno
rješenje dok se ne dostavi novi.

Naziv brenda domena igre je **Bela Online** (odluka vlasnika 2026-09-21); isti naziv nosi i mobilna aplikacija (`appName`).

### Tri blage animacije u lobbyju i na ulazu (2026-09-21)

- **Nova soba** (`RoomListItem` `entering`): kartica uklizi odozdo (480 ms).
  Prva lista koju poslužitelj pošalje je stanje svijeta, ne vijest — ne animira
  se; animira se samo id koji se pojavi u KASNIJOJ listi. Prati se nefiltrirana
  lista, pa pretraga ne „dovodi" stare sobe.
- **Soba je krenula** (`justStarted`): u trenutku prelaska u „Igra se" kartica
  jednom pulsira narančastim prstenom (1,1 s), a značka iskoči. Sobe koje su već
  igrale kad se lista učitala miruju.
- **Ulaz kao gledatelj** (`SpectatorIntro`): pilula „Gledaš igru" s okom koje
  trepne, 2,2 s preko stola, ne hvata dodire. Zamjenjuje stalnu oznaku u
  zaglavlju — biti gledatelj je vijest jednom, na ulazu.

Sve tri: keyframes na razini modula (emotion), stanje mirovanja = zadnji kadar,
uz „smanjeno kretanje" (sustav ili postavka igre) bez animacije.

„Dodaj bota" u demo sobi dodaje **pravog, vidljivog bota** koji se može maknuti
(ispravak isti dan; prije je tiho sjedala lažna osoba). Botovi koje je posjetitelj
dodao odlaze s njim kad zadnji pravi igrač napusti čekaonicu.
