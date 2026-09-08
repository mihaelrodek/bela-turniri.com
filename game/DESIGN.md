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
5. **Štih**: nagnute karte prema sjedalu, let 250 ms iz sjedala, poluprozirno
   u letu, dwell 700 ms, fade prema pobjedniku. `prefers-reduced-motion` +
   ručni toggle "Smanji animacije".
6. **Turn**: najjači signal je na **sjedalu**, ne u pilulici — vidi §4.3.
   Pilula "Tvoj potez" / "X je na potezu" / "X zove" ostaje kao potvrda
   teksta ispod stola.
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

| var | base | ≥48em | ≤700px vis. | ≤560px vis. |
|---|---|---|---|---|
| `--seat-w` | 92 | 116 | — | — |
| `--seat-h` | 94 | — | — | 76 |
| `--seat-x` | 84 | 116 | 76 | 138 |
| `--seat-y` | 94 | 102 | 84 | 64 |
| `--cy-free` | 116 | 124 | 100 | 78 |

`--seat-x/-y` su razmaci od **središta stola** do unutarnjeg ruba sjedala i
moraju nadmašiti polovicu hrpe štiha (`REST_X` 34 + pola karte 36 + 6 px
rasipanja = 76 px vodoravno, 22 + 60 + 6 = 88 px okomito — `TrickArea.tsx`).

**Središte stola nije 50 % kutije** nego `--cy-bottom` iznad njezina dna
(`--table-cy = 100% − --cy-bottom`). Donje sjedalo je moje i crta se u
`MySeatBar` ispod filca, pa je simetrična kutija rezervirala cijelo prazno
sjedalo između bočnih sjedala i ladice s kartama — to je bila ona prazna
trećina. Gledatelj **ima** donje sjedalo, pa mu se `--cy-bottom` proširi na
`--seat-y + --seat-h`. Visina kutije = `--seat-y + --seat-h + --cy-bottom`
→ **304 px** (base) / **320 px** (≥48em) umjesto ranijih 348 / 384. Svaki je
anchor omotan u `min()` prema rubu kutije, pa se na kratkom prozoru layout
degradira na rub umjesto da izgura sjedalo van filca.

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
| gore desno | emoji reakcija (prolazna) |
| **dolje lijevo** | **medaljon aduta — ovo sjedalo zove** |
| **dolje desno** | **"D" djelitelj** |

Status-čip nosi samo ono što je trenutno istinito, po padajućoj hitnosti:
`Nije spojen` → `{n} s` (kad prsten pocrveni) → `Na potezu` → `Dalje`.
Pilula ima punu širinu sjedala pa se imena više ne krate.

### 4.3 Tko je na redu — četiri kanala odjednom
Na **sjedalu**: svijetli prsten s `turnDeadline` odbrojavanjem (conic
gradient; crven kad je hitno), **spotlight** koji se prelijeva na filc (puls
1,8 s, ugašen uz `reducedMotion`), puna svijetla pilula s imenom i podizanje
sjedala za 3 px. Ispod stola i dalje stoji `TurnPill` s tekstom. Prstenova
sekunda ispisuje se tek kad postane hitno.

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
