# Bela blok — ugovor (2026-09-08)

Digitalni **blok za pisanje bele** za stolom uživo: telefon leži pored karata,
jedan igrač upisuje bodove nakon svake podjele. Nema veze s online igrom
(`frontend/src/game/`, `game/`) — ovdje se ništa ne igra, samo se **zbraja**.

Radi **bez prijave i bez interneta**. Sve živi u `localStorage`. To je i glavna
korist: za stolom se ne otvara račun i ne čeka mreža.

Referenca je aplikacija sa snimaka zaslona koje je korisnik priložio; ovaj
dokument je ono što gradimo, a ne ona.

---

## 1. Pravila bodovanja — NORMATIVNO

Ista pravila kao `game/README.md` §1.6, samo se bodovi **upisuju ručno** umjesto
da ih engine izračuna iz odigranih karata.

- Zbroj bodova iz karata po podjeli je **162** (152 iz karata + 10 za zadnji
  štih). Kad se upiše `x` za jednu stranu, druga automatski dobiva `162 − x`.
- **Štiglja**: strana koja uzme svih 8 štihova dobiva **+90**, dakle 252 iz
  karata, a protivnik 0.
- **Belot**: strana koja pokaže svih osam karata jedne boje dobiva **bodovni
  cilj partije** i partija je time gotova — v. §1.2.
- **Zvanja** se upisuju po strani (20 / 50 / 100 / 150 / 200, svako se može
  dodati više puta). Bela (20) je obično zvanje u bloku — za stolom su ljudi
  već primijenili pravilo „boduje samo najjače zvanje”, blok im ne sudi.
- **Prolaz / pad**: neka je `C` zbroj strane **koja je zvala** (karte + zvanja),
  `O` zbroj protivnika. Zvač **prolazi ako je `C > O`**. Inače je **pad**:
  protivnik dobiva **sve** bodove podjele (`C + O`), zvač 0.
- Bez zaokruživanja.
- Cilj (`target`) je 1001 po defaultu; u sučelju se bira **samo** između
  501 / 701 / 1001 (polje „Vlastiti broj” je uklonjeno 2026-09-08, v. §3.3).
  Spremljena i poslana vrijednost smije biti bilo koja — backend prima svaki
  cilj, a partija koja se već igra na 900 ostaje na 900. Igra završava kad neka
  strana dosegne cilj **na kraju podjele**; kod izjednačenja se igra još jedna.
- **Kako partija završava je izbor** (`gameEndRule`, §3.5): `"prolaz"`
  (**zadano** od 2026-09-08, BLOK-HISTORY.md §5.5) ili `"dosta"`. Pravilo o
  izjednačenju vrijedi u oba.

Ova aritmetika mora biti **testirana**, ne pisana napamet u komponenti — v. §4.

### 1.1 Neispravan unos — ODLUKA (2026-09-08)

`scoreManualDeal` **baca** `EngineError("BAD_REQUEST", …)` za podjelu koja ne
može postojati; nikad ne „popravlja” broj i nikad ne vrati uvjerljiv rezultat za
nemoguć ulaz. Cijela je svrha bloka da je broj na ekranu isti onaj koji bi se
zapisao na papir — tiho zakrpana podjela 150/12 pokazala bi krivi zbroj s punim
samopouzdanjem. Isto radi i `scoreDeal` (baca umjesto da boduje podjelu bez
aduta).

Odbija se:
- bodovi iz karata koji nisu **cijeli, konačni, nenegativni** broj;
- podjela koja ne daje ukupno **162** (bez štiglje i bez belota);
- **štiglja** čiji zbroj karata nije **252 za stranu koja ju je uzela i 0 za
  protivnika** — `+90` je već dio spremljenog `cards` (§2), pa se u
  `BlokRound.cards` upisuje `252/0` (`STIGLJA_POINTS` iz `types.ts`), ne `162/0`;
- zvanje koje nije cijeli nenegativan broj;
- `caller`/`stiglja`/`belot` koji nije `"us"`/`"them"` (`stiglja` i `belot`
  smiju biti `null`);
- podjela koja nosi **i belot i štiglju** — ruka koja završava prije prvog
  štiha ne može istovremeno uzeti svih osam (§1.2);
- **belot** čiji bodovi iz karata nisu **0/0** — podjela se nije igrala, pa
  nijedna strana nije uzela ništa u štihovima;
- **belot bez upotrebljivog `target`-a** (nema ga, nije cijeli broj, manji je
  od 1): nagrada JEST cilj, a izmišljenih 1001 bila bi upravo tiha zakrpa koju
  ova funkcija odbija raditi.

Ne odbija se zvanje izvan 20/50/100/150/200 — pet gumba je pomagalo, kućna
pravila variraju, a blok ne sudi za stolom. Ne odbijaju se ni **zvanja na
belotu** (ne mogu promijeniti zbroj, pa bi odbijanje od zaostalog 20 napravilo
nebodovljivu podjelu), ni `target` na podjeli bez belota (nitko ga ne čita).

Posljedica za pozivatelje: `store.ts` hvata iznimku i takvu podjelu prikazuje
kao redak s nulom (nikad bijeli ekran), a zaslon za unos koji računa **živi**
pregled dok se tipka mora zvati unutar `try/catch` — dok je upisano npr. 200,
druga strana je `−38` i podjela ne postoji. To je i signal za `entry.invalid`
i za onemogućeni `Spremi`.

### 1.2 Belot — ODLUKA (2026-09-08, zahtjev korisnika)

**Belot** je kad jedan igrač drži svih osam karata jedne boje. Podjela se tada
**ne igra** — ta strana **automatski dobiva partiju**.

- **Koliko nosi: bodovni cilj TE partije** (`BlokGame.target`), ne fiksnih
  1001 — **ODLUKA, potvrđena s korisnikom**. Na zadanoj igri to jest 1001, što
  je broj koji je korisnik i izgovorio; na igri do 501 ili 701 i dalje znači
  „automatski pobjeđuje tu partiju”, dok bi zakucanih 1001 na igri do 501
  poklonilo dvostruku ciljnu crtu, a na igri do 2001 podjelu koja ne odlučuje
  ništa. Zato `scoreManualDeal` prima `target`.
- **Bodovi iz karata su 0/0.** Nijedan štih nije odigran. Belot se namjerno
  **ne** zapisuje kao ogroman `cards` (npr. 1001/0): `cards` svugdje drugdje u
  bloku znači „bodovi uzeti u štihovima”, pa bi svaki zaslon koji ih zbraja ili
  objašnjava lagao.
- **Zvanja se prikazuju, ali ne ulaze u zbroj.** Podjela koja se nije igrala
  nema se čemu dodati. Engine ih prima i prijavljuje (§1.1: blok ne sudi kućna
  pravila), a list ih dok je belot uključen **ne nudi** — gumbi su onemogućeni
  kao i tipkovnica, a `✕` ostaje živ da se ono što je upisano prije belota može
  skinuti.
- **`fell` je uvijek `false`.** Pravilo pada nije se ni pokrenulo; oznaka „PAD”
  nad podjelom u kojoj nijedna karta nije odigrana bila bi tvrdnja o ruci koja
  ne postoji. Zvač je i dalje obavezan i sprema se (činjenica o podjeli, i
  „prolaz” hoda zvače svih podjela) — ali na belot **ne utječe**: dobiva strana
  koja ga je pokazala, zvala ona ili ne.
- **Belot i štiglja se isključuju.** Ruka koja završava prije prvog štiha ne
  može istovremeno uzeti svih osam. Engine baca (§1.1), a u listu svaki od dva
  gumba gasi onaj drugi, pa se takva podjela ne može ni sastaviti.
- **Nema granice po podjeli** (za razliku od pet zvanja, §3.2): belot je
  prekidač koji imenuje stranu, a ne vrijednost koja se može dodati dvaput —
  „najviše jedan po podjeli” vrijedi po konstrukciji i nema se što brojati.
- **Partiju dobiva strana s belotom, u OBA pravila kraja (§3.5)** —
  `store.ts → winnerFrom`. To se mora reći izrijekom, jer aritmetika to sama ne
  kaže: pod „prolazom” bi belot u tuđoj podjeli bio ignoriran (zvač nije
  prošao), a pod „dostom” bi ga mogla preuzeti strana koja je zbrojem odbjegla
  još dalje. Dodanih `target` bodova stavlja broj na semafor; ovo je ono što ga
  čini **pobjedom**. Pod „prolazom” se provjerava **unutar** šetnje po
  podjelama, pa belot ne može unatrag preoteti partiju koju je ranija podjela
  već dobila.
- **Pohrana ostaje `v1`.** `BlokRound.belot` se pri čitanju **tolerira kao
  odsutan** (svaka podjela zapisana prije ove značajke) i čita se kao `null`;
  nema migracije i nema podizanja verzije. Isto vrijedi i za zapis na profilu i
  iza dijeljene poveznice — v. §1.2.1.

#### 1.2.1 Slanje: **bez ijedne izmjene sheme** — provjereno

BLOK-HISTORY.md §2.3 i §3.1: podjele putuju **unutar `payload`-a**, koji je
`jsonb` stupac, sprema se cijel i server ga **nikad ne preračunava** (§3.3).
Sažetak u stupcima (`games_us`/`games_them`, `target`, datumi, imena) **ne
sadrži ništa po podjeli**. Zato novo polje na podjeli ide postojećim `POST`-om
i **backend migracija nije potrebna** — `backend/**` se ovim nije diralo.
`winner` i `totals` ionako već nose posljedicu belota, jer ih računa uređaj
istim engineom koji je nacrtao ekran.

Na čitanju su `belot` polja u `api/blokHistory.ts` i `api/blokShare.ts`
**neobavezna**: zapis spremljen prije ove značajke jednostavno nema taj ključ.

### 1.3 Čestitka za belot — ODLUKA (2026-09-08)

`components/BelotCelebration.tsx`: konfeti koji padaju preko ekrana i velika
riječ „BELOT”, **kad se belot spremi** (`Spremi`), ne na dodir gumba — do
`Spremi` se ništa nije dogodilo (list ne piše ništa, `Odustani` je jedan dodir),
pa bi slavlje nad otkazanom podjelom slavilo partiju koja se još igra.

- **Poštuje se smanjena animacija, iz DVA izvora, i svaki je dovoljan**:
  `prefers-reduced-motion` (sustav) **i** `useGamePrefs().reduceMotion`
  („Smanji animacije”). Tada se **ne prikazuje ništa** — nema „blaže” verzije
  konfeta. Informaciju nosi značka (`entry.belot`) u retku podjele i na
  kartici lista, i ona je tu u svakom slučaju. Blok nema vlastiti prekidač i
  **nije se izmišljao**: postojeći je postavka uređaja (`localStorage`), živi
  pod postavkama online igre, i može samo **smanjiti** animaciju.
- **Bez nove ovisnosti**: dva `@keyframes` bloka i 24 apsolutno pozicionirana
  kvadratića, po uzoru na `game/components/DeclarationsReveal.tsx`. Knjižnica
  za konfete bila bi nekoliko kilobajta u vendor bundleu (već 1,1 MB) za
  efekt od tridesetak linija CSS-a.
- Sloj je `pointer-events: none` i `aria-hidden`: ukras ne presreće palac koji
  cilja sljedeću podjelu i ne čita se čitaču ekrana (značka to već kaže).
- Boje su semantički tokeni (`brand.*`, `green.*`, `red.*`), pa je u obje teme
  u paleti aplikacije.

---

## 2. Model podataka

```ts
export type BlokSide = "us" | "them"

export interface BlokRound {
    /** Stabilan id — `crypto.randomUUID()`. Redoslijed je redoslijed u polju. */
    id: string
    /** Tko je zvao. Bez toga se ne može izračunati pad. */
    caller: BlokSide
    /** Bodovi iz karata, po strani. Zbroj je 162, ili 252/0 kod štiglje. */
    cards: Record<BlokSide, number>
    /** Zvanja, po strani: lista pojedinačnih zvanja kako su upisana
     *  (`[20, 20, 50]`), ne zbroj — da se u pregledu vidi što je zvano. */
    declarations: Record<BlokSide, number[]>
    /** Strana koja je uzela sve štihove, ili null. */
    stiglja: BlokSide | null
    /** Strana koja je pokazala belot (§1.2), ili null. Kod belota je `cards`
     *  0/0 i `stiglja` je null. Pri čitanju se tolerira ODSUTNO polje → null,
     *  pa pohrana ostaje `v1` bez migracije. */
    belot: BlokSide | null
    /** Adut te podjele — samo za prikaz u povijesti; null ako nije upisan. */
    trump: "HERC" | "KARA" | "PIK" | "TREF" | null
}

export interface BlokGame {
    id: string
    createdAt: number
    finishedAt: number | null
    target: number
    /** Koliko dobivenih partija nosi seriju, ili `null` = otvorena (zadano). */
    seriesTarget: number | null
    /** Kako završava JEDNA partija — `"prolaz"` (zadano) ili `"dosta"` (§3.5). */
    gameEndRule: "dosta" | "prolaz"
    /** Tko je dijelio PRVU podjelu ove partije, i je li to itko rekao.
     *  `chosen` je činjenica o izgovorenoj odluci, ne izvedena vrijednost —
     *  v. §3.3.2. Odsutan pri čitanju = `false`. */
    dealer: {
        first: "self" | "rightOpponent" | "partner" | "leftOpponent"
        chosen: boolean
    }
    /** Smjer kartanja — `"right"` (zadano) ili `"left"` (§3.3.2). */
    dealDirection: "right" | "left"
    /** Prikazuje li se traka „Sljedeći dijeli” — `true` zadano (§3.3.2). */
    showDealer: boolean
    /** Nudi li se gumb za dijeljenje zapisnika — `true` zadano (§3.3.3).
     *  Odsutan pri čitanju = `true`. Ugašen poništava i token koji je izdao
     *  sam korisnik; token POVEZANOG stola nikad (BLOK-LINK.md §6.2). */
    shareEnabled: boolean
    names: Record<BlokSide, string>
    rounds: BlokRound[]
}
```

Izračunato (nikad spremano — uvijek izvedeno iz `rounds`, da se ne mogu
razići): bodovi po podjeli, tekući zbroj, pobjednik, koliko je puta koja strana
zvala, ukupno zvanja po strani, broj štiglji, **i rezultat serije** (2 : 1 se
broji iz pobjednika partija iste `sessionId` kroz `winnerOf` — nikad se ne
drži kao tekuće polje).

`localStorage`, jedan ključ s verzijom (`bela:blok:v1`), sadrži **tekuću igru**
i **arhivu završenih**. Čitanje mora preživjeti pokvaren/stran sadržaj (privatni
prozor, očišćeni podaci): `try/catch`, pa prazno stanje — nikad bijeli ekran.

---

## 3. Zasloni

### 3.1 Glavni (`/blok`)

> **ISPRAVAK 2026-09-08 — na telefonu se skrolja SAMO popis podjela.** Ranija
> verzija je cijelu stranicu puštala da se skrolja, a zaglavlje lijepila
> `position: sticky`. Na stvarnom telefonu je to značilo retke koji klize *ispod*
> poluprozirne kartice i sažetak kraja igre koji naleti na traku veze sa stolom.
> Sada mobilni stupac ima **točnu visinu** (`100dvh` minus `PAGE_CHROME` minus
> `ACTION_BAR_RESERVE`) i dva reda: kartica s rezultatom u prvom, a u drugom
> (`minmax(0, 1fr)`) kutija koja je **jedini skroler na stranici** (`minH="0"` +
> `overflowY="auto"` + `overscroll-behavior: contain`). Bez `minmax(0, …)` i bez
> `minH="0"` bi taj red narastao umjesto da se skrolja.
>
> **Što je u skroleru, ODLUKA:** popis podjela **i** sažetak kraja igre skrolaju
> zajedno; kartica s rezultatom i traka veze sa stolom (koja živi u njoj) ostaju
> prikovane. Sažetak je presudak + poništi + tablica + gumb preko cijele širine,
> dakle trećina telefona — prikovan bi ostavio popisu dva retka baš kad ga ima
> najviše za čitati. „Sve prikovano” je stanje sa snimke koja je i pokrenula
> ovaj ispravak.
>
> Na `md+` se ništa ne mijenja: stranica se skrolja normalno, zaglavlje se
> vraća na `position: sticky` na `CONTENT_STICKY_TOP`, a dvostupčani raspored
> ostaje kakav je bio. Prekidač je `display: contents` na omotaču skrolera, pa
> ista dva djeteta na `md` opet postaju izravne ćelije mreže („list” /
> „summary”) — jedno stablo, dva rasporeda, bez dupliciranog markupa.

Odozgo prema dolje:
1. **Zaglavlje**: **mali broj dobivenih partija iznad**, veliki zbroj po strani,
   ime strane ispod (MI / VI, preimenjivo).
   **Desno gore izbornik, LIJEVO gore gumb za dijeljenje** (§3.6), a **ispod
   crte između dva rezultata strelica** koja otvara odigrane partije te serije
   (§3.3.1). Prikovano je (v. ISPRAVAK gore); na `md+` se lijepi na
   `CONTENT_STICKY_TOP` iz `navChrome.ts` — isti offset (navbar + gornji padding
   Containera) na koji se lijepe i druge stranice. Značka „koliko
   je puta ta strana zvala” iznad zbroja je **uklonjena — ODLUKA (2026-09-08),
   zahtjev korisnika**: čitala se kao nepotreban šum za stolom. `calledCount` i
   dalje postoji u `useBlok()` (§5) i i18n paru `round.count`/`round.calledBy` —
   samo se više ne prikazuje ovdje; agent zadužen za rječnike odlučuje treba li
   `round.count` obrisati sada kad ga nitko ne koristi.
2. **Popis podjela**: jedan redak po podjeli — bodovi lijevo/desno, ispod njih
   manji kumulativni rezultat nakon te podjele, a ikona aduta u sredini (ako
   je upisan). Ispod zadnje podjele stoje preostali bodovi do cilja za obje
   strane i apsolutna razlika između rezultata. **Dodir na redak izravno
   otvara uređivanje** te
   podjele (`round.edit`) — bez međuizbornika, jer je uređivanje ono što se radi
   99 puta od 100. **Brisanje je iza dugog pritiska (~500 ms)** na redak, koji
   otvara isti `ConfirmDialog` (`round.delete` / `confirm.deleteRound`) kao i
   uvijek; dugi pritisak se otkazuje ako se prst pomakne (skrol popisa) ili kod
   `pointercancel`, a klik koji preglednik sintetizira odmah nakon dovršenog
   dugog pritiska se guta, inače bi se uređivanje otvorilo ispod potvrde
   brisanja. Redak vidljivo potamni dok se drži, da gesta nije tajna. Budući da
   dugi pritisak nema tipkovnički ni čitački ekvivalent, **brisanje je dostupno
   i unutar lista za uređivanje** (§3.2, `RoundEntrySheet`'s `onDelete`) — to je
   jedini put do brisanja bez pokazivača.
3. **Kad je igra gotova**: „Mi smo pobijedili” / „Vi ste pobijedili”, ispod
   „poništi zadnju rundu”, pa sažetak (ukupno / zvanja / štiglje) i
   **„Sljedeća partija”** — sljedeća partija **unutar iste serije** (§5.6). Uz
   seriju (§3.4) ovaj blok ima još dvije pojavnosti.
4. **Traka „Sljedeći dijeli”** (`components/DealerTracker.tsx`) iznad ta dva
   gumba: mjesto koje dijeli sljedeću podjelu i smjer kartanja, a dodir otvara
   prostorni odabir (četiri mjesta oko stola, smjer u sredini). **Neobavezna od
   2026-09-08** — prekidač u „Postavke”, **zadano uključena** (§3.3.2). Visina
   trake s gumbima se **mjeri** (`ResizeObserver` → `barReserve`), pa se donja
   rezerva popisa podjela sama stisne kad trake nema; nema konstante koju bi
   trebalo držati u koraku.
5. **Dva velika gumba na dnu**: `MI +` i `VI +`. Gumb bira **tko je zvao** tu
   podjelu i otvara unos. Palac ih mora dohvatiti bez namještanja telefona.
   Lijepe se `position: fixed` na dnu, na `env(safe-area-inset-bottom)` plus
   mali razmak (ne na visinu donje navigacijske trake — ona je na `/blok`
   sakrivena, pa rezerviranje njenog prostora samo gura gumbe više nego treba).
   Donji `padding` popisa podjela odgovara točno toj rezervi, da zadnji redak
   nikad ne završi ispod gumba.

#### 3.1.1 Duga imena strana — ISPRAVAK 2026-09-08

„Perhaj i Galinec” se rezalo u „PERHAJ I GALI…” u zaglavlju i „Perhaj i G…” na
gumbu `MI +`. To poništava smisao preimenovanja: **ime je razlog zašto se
uopće otvara taj dijalog.**

- Natpis se **prelama u drugi red** (`lineClamp={2}` + `wordBreak`), a ne reže
  u prvom. `lineClamp` je namjeran izbor umjesto punog prelamanja: **jedna
  predugačka riječ** (bez razmaka) se onda prelomi i uredno završi s `…`
  umjesto da razvuče stupac.
- **Tip se stepenasto smanjuje** kad je duže od dva imena dugačko (dvije
  stepenice, po `Math.max(names.us.length, names.them.length)`). Korak vodi
  **duže** ime, pa obje strane uvijek nose istu veličinu — različite veličine
  bi se čitale kao da je jedna strana važnija.
- Gumbi `MI +` / `VI +` rade isto, s vlastitim veličinama (širi su od stupca u
  zaglavlju) i uz `whiteSpace="normal"`, jer recept gumba u Chakri je
  `nowrap` i bez toga se drugi red nikad ne bi pojavio.
- **Puno ime uvijek ostaje dostupno**: `title` na natpisu/gumbu i puno ime u
  pristupačnom imenu (`aria-label`), i kad je vidljivi natpis skraćen.
- **ISPRAVAK 2026-09-08 — dva imena stoje na ISTOJ sredini.** „PERHAJ I
  GALINEC” se prelomi u dva retka dok „VI” ostaje u jednom, pa je kraće ime
  sjedilo na **vrhu** te više kutije: dva natpisa istog retka čitala su se kao
  dva različita retka. Redak s imenom je zato **uvijek visok dva retka i
  centrira svoj sadržaj** — `minH="2.5em"` (dva retka pri `lineHeight: 1.25`)
  uz `align="center"`. U `em`, a veličina imena je postavljena i na tom retku,
  pa rezerva sama prati svaku stepenicu iz `sideNameFontSize` i svaki
  breakpoint; broj u `rem` bi se morao ručno držati u koraku s tom tablicom.
  Cijena je jedan red visine na kartici s dva kratka imena, a kupuje karticu
  koja **ne mijenja visinu** čim netko preimenuje stranu — ista stabilnost
  zbog koje su brojevi iznad `tabular-nums`. Olovka ostaje gdje je bila, uz
  ime, centrirana s njim.
- `maxLength` u dijaloglu preimenovanja podignut je s 24 na **40**. Strop je i
  dalje `varchar(60)` za `name_us`/`name_them` (BLOK-HISTORY.md §3.1) i ne
  smije se dizati preko njega — popravak je **raspored, ne pohrana**.

### 3.2 Unos podjele (donji list preko ekrana)

> Revidirano **2026-09-08** nakon prve upotrebe na telefonu. Odluke označene s
> „REVIZIJA” **zamjenjuju** raniju verziju ovog odjeljka; one označene s
> „ISPRAVAK” dolaze iz drugog kruga, nakon što je korisnik blok stvarno
> koristio na telefonu, i zamjenjuju i pokoju „REVIZIJU” iznad.

- **REVIZIJA — nema velikog naslova.** Naslov („Nova podjela” / „Uredi
  podjelu”) je maknut: bio je natpis nad listom čiji sadržaj već govori što je,
  a na telefonu je trošio red koji trebaju dvije kartice. Ključ `entry.title`
  je obrisan iz oba rječnika.
- **ISPRAVAK — zaglavlje je prekidač MI/VI, ne rečenica „Zvao MI”.** Tko je
  zvao jedini je podatak koji se **ne može pročitati iz brojeva**, ali je do
  sada bio i jedini koji se **nije mogao promijeniti**: fiksirao ga je donji
  gumb koji je otvorio list, pa se najčešći promašaj za stolom ispravljao samo
  kroz `Odustani` i ponovni upis cijele podjele. Sada su to **dva čipa**, MI i
  VI, s preodabranim onim koji je otvorio list (kod uređivanja: `caller`
  spremljene podjele).
  - Ovo je promjena **ponašanja**, ne natpisa: `caller` je ulaz u
    `scoreManualDeal`, pa prebacivanje čipa u istom dodiru ponovno pušta
    pravilo pada — `Σ` obje kartice i oznaka `PAD` se pomaknu odmah. Spremljena
    podjela nosi ono što čip kaže.
  - Sama riječ („Zvao”) ostaje `Drawer.Title` i dalje imenuje dijalog; puni
    `round.calledBy` („Zvao MI”) je **pristupačno ime svakog čipa**, pa čitač
    ekrana nikad ne pročita golo ime strane. Novi ključ je `entry.caller` (u
    oba rječnika).
  - Aktivna strana (kamo piše tipkovnica) je **odvojena** od zvača: ispravak
    zvača ne smije nasred broja premjestiti tipkovnicu.
- Gore dvije kartice, po jedna za svaku stranu. **Jedna je aktivna** (dodir
  mijenja); tipkovnica i zvanja upisuju u aktivnu. Neaktivna se sama računa
  (`162 − x`) i vidljivo je zasivljena.
- U kartici: veliki broj bodova iz karata, `+220` sitno pored (zbroj zvanja) i
  `Σ 297` ispod (ukupno za tu stranu u toj podjeli, **nakon** pravila pada).
- **REVIZIJA — `Σ`, ne riječ „Ukupno”.** Dvije kartice stoje jedna uz drugu na
  telefonu; riječ je jela širinu koju treba broj i ponavljala se dvaput po
  listu, a `Σ` je notacija koju ljudi ionako pišu na papirnati blok. Ključ
  `entry.sum` **nije obrisan** nego je preseljen iz tinte u `srOnly` span: bez
  njega bi čitač ekrana odlučujući broj kartice pročitao kao „n-ary summation
  297” ili nikako. Simbol je `aria-hidden`.
- **Pad se mora vidjeti prije spremanja** — kad zvač ne prolazi, njegova kartica
  pokazuje 0 i oznaku „PAD”, a protivnikova sve bodove. To je cijela svrha
  unosa: čovjek za stolom provjerava broj koji će zapisati.
- Zvanja: gumbi 20 / 50 / 100 / 150 / 200 sa **brojačem koliko je puta dodano**
  (mali badge gore-desno), plus **štiglja**. Ponovni dodir dodaje još jedno.
- **Štiglja je podijeljena na pola: `Štiglja` | `Belot` — dodano 2026-09-08,
  zahtjev korisnika (§1.2), a od iste večeri je taj par JEDNA ĆELIJA mreže
  zvanja, prerezana po sredini.** Cijeli blok je time **3 × 2**:
  `20 · 50 · 100` u prvom retku, `150 · 200 · [Štiglja|Belot]` u drugom. Prije
  je par stajao na vlastitom retku pune širine; vraćeni redak treba list koji
  drži i dvije kartice strana i tipkovnicu.
  - **Cijena je veličina tipa, i plaćena je izričito.** Na 320 px tijelo lista
    je 288 px (`Drawer.Body px="4"`), ćelija je (288 − 2 × 8) / 3 ≈ 90 px, a
    polovica minus 4 px razmaka ≈ **43 px**. „Štiglja” tu ne stane u veličini
    koju su ta dva gumba nosila, ali stane u `2xs`. Zato **samo taj par**
    stepenasto smanjuje tip na najužim telefonima i vraća se na `xs`/`sm` čim
    ima mjesta (`PAIR_FONT`), uz `px="0"`, `minW="0"` i `nowrap`, pa svih 43 px
    ide riječi.
  - **Rezanja nema.** Nema `…` i nema `lineClamp`: skraćeno „Štigl…” na
    kontroli koja odlučuje cijelu podjelu gore je od male riječi — isti
    kompromis koji §3.1.1 rješava za imena strana.
  - Obje polovice zadržavaju sve po čemu se čitaju kao kontrole: `aria-pressed`
    prekidači, a uključena je **puni** ispun bojom aktivne strane naspram
    obrubljene isključene — ispunjen blok se na pola širine čita jednako dobro
    kao na punoj.
  - Oba su **prekidači koji imenuju aktivnu stranu**, oba se **međusobno
    isključuju** (uključivanje jednog gasi drugi), i nijedan nema brojač ni
    `✕` — ne mogu se dodati dvaput.
  - Dok je **belot** uključen, **tipkovnica i pet gumba zvanja su
    onemogućeni**: nagrada je bodovni cilj i ništa upisano je ne miče, pa gumb
    koji bi i dalje primao dodire dodavao bi brojeve u zbroj koji ih ignorira.
    `✕` postojećih zvanja ostaje živ, a `Očisti` je i dalje jedina tipka do
    koje `disabled` ne doseže — njome se s belota izlazi.
  - Kad se belot **spremi**, ide čestitka (§1.3).
- **Koliko puta jedno zvanje stane u JEDNU podjelu — dodano 2026-09-08:**

  | zvanje | najviše |
  |---|---|
  | 200 | 1 |
  | 150 | 1 |
  | 100 | 2 |
  | 50 | 4 |
  | 20 | 6 |

  - Na granici je gumb **onemogućen, nikad sakriven**: kontrola koja nestane
    čita se kao kvar, a brojač `×N` i `✕` moraju ostati dohvatljivi da se
    zadnje zvanje može vratiti. `_disabled` je namjerno svijetliji od Chakrinog
    zadanog (0.85), jer se broj i dalje čita prije spremanja.
  - **Broji se preko OBJE strane podjele, ne po strani — ODLUKA.** Špil je
    jedan: četiri dečka postoje jednom, pa 200 u jednoj podjeli može pasti
    samo jednom, bez obzira na to tko ga drži. Brojanje po strani bi mirno
    primilo dva 200, što fizički ne postoji. Posljedica koju treba znati: ako
    protivnik već ima jedini 200, gumb 200 je na ovoj strani onemogućen i
    **nema svoj `✕`** — unos se miče na kartici na kojoj i živi. *Ako je
    korisnik mislio „po strani”, ovo je mjesto na kojem to treba ispraviti:
    `DECLARATION_MAX_PER_DEAL` u `types.ts` i `dealAdded` prop.*
  - **Nije u `scoreManualDeal` — ODLUKA.** §1.1 kaže da blok ne sudi kućna
    pravila i engine prima zvanja izvan ovih pet vrijednosti. Ovo je granica
    **gumba**, ne granica onoga što spremljena podjela smije sadržavati:
    podjela učitana iz pohrane koja premašuje granicu i dalje se prikazuje i
    dalje se uređuje, samo ne može rasti.
- **REVIZIJA — brisanje zvanja: `✕` gore-LIJEVO na samom gumbu.** Raniji
  zasebni red čipova (`20 ×` `50 ×`) je **ukinut**. Sada jedan gumb radi oboje:
  dodir na tijelo dodaje, dodir na `✕` u gornjem lijevom kutu vraća jedno
  natrag, zrcaleći brojač u gornjem desnom. `✕` se pojavljuje tek kad je ta
  vrijednost bar jednom dodana. Razlog za ukidanje reda: s `✕` po vrijednosti
  bio je drugi kontrola za isti posao, a na telefonu je koštao cijeli red koji
  trebaju kartice i tipkovnica.
  - `✕` je **sibling**, ne dijete gumba: `<button>` u `<button>`-u je nevaljan
    HTML koji preglednik raspetlja. Par živi u `position="relative"` Boxu —
    gumb ispunjava ćeliju, `✕` je apsolutno pozicioniran preko kuta. Time je i
    problem pogodaka riješen na razini DOM-a: dodir na `✕` je dodir na **drugi
    element** i ne može okinuti dodavanje (`stopPropagation` je samo osigurač
    za dan kad netko stavi handler na omotač).
  - Obje značke imaju **fiksnu pikselsku kutiju** (`✕` 28 px, brojač 24 px),
    pa je površina tijela koju pokrivaju poznata, a ne funkcija fonta. `✕` je
    veći od brojača jer je **meta**, a ne natpis; 28 px je ispod praga od
    44 px, ali nevidljivi prošireni hit-ring bio bi upravo ono što bi počelo
    gutati dodire namijenjene tijelu.
  - **ISPRAVAK — značke se više ne sudaraju preko razmaka.** Prva verzija je
    obje značke izvlačila 8 px izvan kuta, a razmak mreže je također bio 8 px:
    `✕` u gornjem **lijevom** kutu jednog gumba i brojač `×N` u gornjem
    **desnom** kutu njegovog lijevog susjeda popunjavali su isti razmak i
    preklapali se (`✕` gumba „50” preko `×1` gumba „20”). `✕` **ne smanjujemo**
    — on je jedina prava meta ovdje — nego se offset **razdvaja po osima**:
    vodoravno su značke poravnate s rubom vlastitog gumba (bez izvlačenja), pa
    je **cijeli stupčani razmak uvijek slobodan, na svakoj širini** na kojoj se
    mreža od tri stupca prikaže; okomito i dalje vire 6 px u **retčani** razmak,
    koji je povećan na 12 px da značka drugog retka ne dodiruje gumb iznad.
    Odabir „uvuci vodoravno” umjesto „povećaj stupčani razmak” je namjeran:
    razmak koji netko kasnije smanji ne smije vratiti sudar.
  - Dugi dodir je i dalje odbijen: nevidljiv je, na iOS-u se tuče s vlastitim
    kontekstnim izbornikom preglednika, i nema ekvivalent za tipkovnicu ni
    čitač ekrana. `✕` je pravi `<button>` s labelom `entry.clearChip`.
  - Brisanje sada ide **po vrijednosti**, ne po indeksu (`✕` pripada
    vrijednosti, ne poziciji); roditelj miče **zadnji** unos te vrijednosti.
    Popis se i dalje čuva kao sirov niz (`[20, 20, 50]`), a koji je unos otišao
    je neopazivo jer su identični.
  - Brojač ulazi u **ime gumba** kroz plural `entry.added` (`usePlural()`), jer
    je značka „×2” samo znak, a red čipova koji je taj podatak prije nosio za
    čitač ekrana više ne postoji.
- Numerička tipkovnica 0–9, `Očisti` i `⌫`; donji red je **Očisti / 0 / ⌫**.
  Nema sistemske tipkovnice: ovo je poznat raspored, veliki ciljevi za palac,
  bez skakanja layouta.
- **REVIZIJA — nema natpisa „BODOVI IZ KARATA” iznad tipkovnice.** Pad 0–9 pod
  listom čiji je jedini broj „bodovi iz karata” nije se trebao razlikovati ni
  od čega. `entry.cards` preživljava kao pristupačno ime same tipkovnice
  (`role="group"` + `aria-label`), gdje label radi pravi posao.
- **ISPRAVAK — ni ime aktivne strane iznad tipkovnice.** Ranija revizija ga je
  zadržala kao signal „gdje idu ove znamenke”; kad je natpis nasuprot njemu
  nestao, ostao je sam u kutu i čitao se kao zalutala riječ, a ne kao oznaka.
  Iznad tipkovnice sada **nema ničega**: dvije kartice na vrhu lista već kažu
  koja se strana uređuje — aktivna je uokvirena, obojena i `aria-pressed`.
- **REVIZIJA — `Očisti` (`entry.clearAll`) lijevo od `0`.** Briše **cijeli
  list**: bodove iz karata obje strane, sva zvanja, štiglju, adut i aktivnu
  stranu — doslovno `useState` inicijalizatore nove podjele.
  - **Kod uređivanja postojeće podjele „očisti” znači PRAZNO, ne „vrati
    spremljeno” — ODLUKA.** Kontrola koja piše „očisti” a ponekad vraća
    vrijednosti su dvije kontrole pod jednom riječi, a razlog da se za njom
    posegne usred uređivanja obično je baš to da su spremljeni brojevi krivi.
    Ništa se ne gubi iznenada ni u jednom čitanju: list **ne piše ništa do
    `Spremi`**, pa `Odustani` jednim dodirom vraća spremljenu podjelu netaknutu
    — to je „vrati spremljeno”.
  - `Očisti` je jedina tipka do koje `disabled` **ne** doseže: `disabled` znači
    „štiglja je fiksirala bodove, nema se što tipkati”, a štiglja je jedna od
    stvari koje `Očisti` mora moći skinuti.
  - **`Očisti` ne dira prekidač zvača — ODLUKA (2026-09-08).** Sve ostalo što
    briše je **broj koji se sprema ponovno upisati**, i zato je „očisti” prava
    riječ za to. Tko je zvao nije: to je činjenica o odigranoj podjeli, obično
    je i dalje točna kad brojevi nisu, a vraćanje na početnu vrijednost tiho bi
    ponovno pokrenulo pravilo pada na listu čiji je posao to pravilo pošteno
    pokazati. Aktivna strana se zato vraća na **trenutnog** zvača.
- Upisuje se **samo jedan** broj bodova iz karata; druga strana je `162 − x` po
  definiciji. Dodir na neaktivnu karticu premješta unos na nju i **posije** ga
  vrijednošću koju je ta strana već pokazivala, a sljedeća znamenka tu sjemenku
  **zamjenjuje** (kao kalkulator) — inače bi dodir plus jedna tipka tiho dali
  „725”.
- **REVIZIJA — tipkanje preko granice se REŽE na 162, ne odbija.** Znamenka
  koja bi prebacila `DEAL_CARD_POINTS` prije se bacala u prazno, što je na
  telefonu neraspoznatljivo od tipke koja nije registrirala: „25” pa „5” i pad
  je djelovao mrtvo. Sada svaki dodir nešto vidljivo napravi, a 162 je ionako
  jedina vrijednost prema kojoj je prekoračenje moglo ići — podjela ne može
  držati više. Posljedica: „25” + „5” = **162**. Rezanje je i samoograničavajuće
  (iz „162” svaka daljnja znamenka opet daje „162”), pa zasebna provjera duljine
  više ne treba postojati.
- `Odustani` / `Spremi`. `Spremi` je onemogućen dok unos nije valjan, a valjan
  znači: `scoreManualDeal` ga je uspio bodovati (§1.1), ne neko drugo pravilo
  prepisano u komponenti.
- **REVIZIJA — brisanje podjele iz samog lista.** `RoundEntrySheet` prima
  neobavezni `onDelete?: () => void`, koji stranica šalje **samo kad je
  `initial` različit od `null`** (dakle samo pri uređivanju). Tada se u redu
  akcija skroz lijevo prikazuje crveni gumb s košem (`round.delete` kao
  pristupačno ime, ikona sama). Popis podjela nudi i dugi dodir na redak kao
  prečac, ali dugi dodir nema ekvivalent za tipkovnicu ni čitač ekrana — zato
  ovaj gumb postoji i nije duplikat. Poredak `[koš] [Odustani] [Spremi]` drži
  punu širinu `Odustani` između koša i `Spremi`.
- **ISPRAVAK — potvrda brisanja se otvara UNUTAR lista.** Prije je list javio
  namjeru, zatvorio se, a stranica je otvorila svoj `ConfirmDialog`: dodir na
  „Odustani” tada je korisnika izbacio iz podjele koju je uređivao — otkazivao
  je **uređivanje**, a ne brisanje. Sada `RoundEntrySheet` sam drži
  `ConfirmDialog` (nikad `confirm()`), list ostaje otvoren iza potvrde, a
  `onDelete()` se zove **tek nakon potvrde** — dakle `onDelete` sada znači
  „korisnik je potvrdio, briši”, a stranica više ne pita drugi put.
  - Ugniježđeni dijalog u ladici je siguran u Chakri v3 i to je provjereno u
    knjižnici, ne pretpostavljeno: `Drawer` i `Dialog` su isti Ark/zag stroj,
    pa potvrda ulazi na zajednički *dismissable layer stack* iznad ladice.
    Otud tri stvari na koje se oslanjamo — (1) stack piše `--layer-index: 1`
    na potvrdu, a recept dijaloga ima `z-index: calc(zIndex.modal +
    var(--layer-index))`, dok ladica ima ravni `zIndex.modal`, pa potvrda
    crta iznad bez ijednog ručno upisanog broja; (2) `Escape` je čuvan s
    `if (!layerStack.isTopMost(node)) return`, pa gasi **samo** potvrdu;
    (3) ladičin *interact-outside* preskače mete `isInNestedLayer`, a svaki
    sloj ispod modalnog dobiva `pointer-events: none`, pa ni pozadina potvrde
    ni njeni gumbi ne mogu zatvoriti list ispod.
  - Dugi pritisak na redak u popisu i dalje ide kroz **stranični**
    `ConfirmDialog` — tamo nema lista koji bi se izgubio.

### 3.3 Izbornik — SKRAĆEN 2026-09-08 (BLOK-HISTORY.md §5.3)

**Nova igra** (§3.7 — od 2026-09-08 **zatvara seriju**, BLOK-HISTORY.md §5.6),
**Postavke** (bodovni cilj, dosta/prolaz, igra se do, te od 2026-09-08
„Sljedeći dijeli”, „Smjer kartanja” — §3.3.2 — i „Omogući dijeljenje” — §3.3.3;
sve u `TargetDialog`), **Poveži sa stolom**, **Obriši igru**.

> **SKRAĆEN JOŠ JEDNOM 2026-09-08 (BLOK-HISTORY.md §5.6, zahtjev korisnika).**
> **„Resetiraj” je uklonjen** — bila je to ista radnja pod drugim imenom, pa je
> njegovo značenje preuzela **„Nova igra”**. **„Prekini dijeljenje”** je
> uklonjen u drugom smjeru: sada je to **isključeni** položaj prekidača
> „Omogući dijeljenje” u „Postavke” (§3.3.3). Stavka koja se pojavljuje tek kad
> poveznica postoji je značajka koju se može naći samo ako je već korištena.

Tri stavke su **otišle iz izbornika, ali nijedna nije ukinuta** — svaka je
preseljena bliže mjestu gdje se koristi:

| bilo | sada |
|---|---|
| Preimenuj strane | olovka ispod svakog rezultata (§3.1) to već radi; druga vrata u isti dijalog bila su samo dulji put |
| Odigrane partije | u kartici, iza strelice ispod crte (§3.3.1) |
| Podijeli sažetak | gumb u gornjem lijevom kutu kartice, i dijeli **poveznicu**, ne tekst (§3.6) |

„Promijeni cilj” se zove **„Postavke”** (`menu.target`, `target.title`) jer je
prestao biti o jednom broju čim su mu se pridružili `gameEndRule` i
`seriesTarget`; ikona je `FiSettings`, ne `FiTarget`.

**ISPRAVAK 2026-09-08 (zahtjev korisnika) — u dijalogu nema više nijednog
slobodnog polja ni objašnjenja.** Četiri promjene:

1. **„Vlastiti broj” za bodovni cilj je uklonjen.** Ostaju samo čipovi
   501 / 701 / 1001. Isti razlog kao kod „Vlastitog broja igara” (§3.4): polje
   koje čipovi samo pune je druga kontrola za isti izbor. **Backend se ne
   dira** — i dalje prima svaki cilj; suzilo se sučelje, ne pravilo.
2. **Spremljeni cilj se pritom NIKAD ne prepisuje — ODLUKA.** Partija koja se
   igra na 900 zadržava 900: dijalog se sije iz spremljene vrijednosti, a kad
   ona nije nijedan od tri čipa, **nijedan čip nije pritisnut**. „Ništa od
   ovoga” je pošteno stanje; osvijetljeni 1001 koji nitko nije odabrao bio bi
   tiha izmjena rezultata zbog uklonjenog polja. Spremanje bez dodira na čip
   sprema broj koji je i bio. Gumb `Spremi` više nema `disabled` — vrijednost
   je po konstrukciji ili čip ili zatečeni broj.
3. **Natpis „Kraj partije” je sada „Igra se na”** (`rule.title`) — rečenica
   koju čipovi dovršavaju („igra se na prolaz”).
4. **Rečenice ispod čipova su obrisane** (`rule.dostaHint`, `rule.prolazHint`,
   iz oba rječnika), a **„Cilj bodova” je skraćen na „Bodovi”**
   (`target.points`). Napomena za §3.5: `rule.prolazHint` je bio i „osigurač
   za nepotvrđeno pravilo” — sada pravilo živi **samo** u kodu
   (`store.ts → passedAndWon`), pa ako je čitanje krivo, to se više ne vidi na
   ekranu.
5. **Rečenica ispod „Otvorena” je također obrisana — 2026-09-08, zahtjev
   korisnika.** `series.hintOpen` („Serija traje dok je ne zatvoriš
   „Resetiraj”. Rezultat stoji u zaglavlju.”) je uklonjen iz dijaloga **i iz
   oba rječnika**, iz istog razloga kao rečenice pod čipovima pravila:
   objašnjavao je gumb koji je pritisnut točno iznad njega. Isto je 2026-09-09
   zadesilo i `series.hint` („Seriju dobiva strana koja prva skupi 1 dobivenu
   igru”) — rečenica se mijenjala sa svakim pritiskom i čitala se kao šum tamo
   gdje je izbor upravo napravljen. `series.hint`
   (kad je duljina serije odabrana) ostaje — on kaže nešto što čip ne kaže.

Sve što briše podatke ili je nepovratno ide kroz `components/ConfirmDialog.tsx`
— **nikad `confirm()`** (pravilo projekta, root `CLAUDE.md`).

#### 3.3.1 Odigrane partije žive u KARTICI — ISPRAVAK 2026-09-08

> Ovaj odjeljak **zamjenjuje** raniju verziju („arhiva pripada profilu”, koja je
> istu zbrku rješavala preimenovanjem dijaloga). Dijalog je sada uklonjen u
> cijelosti — BLOK-HISTORY.md §5.4.

Korisnik je otvorio lokalni popis i odjeljak „Blok” na profilu jedan pored
drugoga i pitao zašto jedan ima redke, a drugi je prazan. **Dvije različite
stvari nosile su jednu riječ:**

| | što drži | tko puni | tko prazni |
|---|---|---|---|
| kartica s rezultatom | **partije tekuće serije** | „Sljedeća partija” | „Nova igra”, nakon uspješnog slanja |
| profil | **spremljene serije** | „Nova igra” (§3.7) i „Podijeli” (§3.6) | korisnik, na profilu |

Preimenovanje dijaloga nije bilo dovoljno: **dijalog je mjesto za sebe, a mjesto
za sebe je ono što je i pozvalo na usporedbu.** Ispod rezultata, iza strelice na
samoj kartici, popis se ne može pročitati kao ništa drugo nego **nastavak istog
brojača**.

- **Strelica** (`games.show` / `games.hide`) stoji centrirano ispod crte koja
  dijeli dva rezultata, na osi te crte. Crta se **ne crta** kad serija još nema
  nijednu završenu partiju — kontrola koja pokazuje na prazno je gora od
  nijedne.
- Redak partije je **rezultat + datum**; dodir otvara **njezine podjele** unutar
  istog panela (`games.showDeals`): tko je zvao (točkica), bodovi obje strane,
  **pojedinačna zvanja** (`20 + 50`, nikad zbroj), štiglja, adut (`SuitGlyph`)
  i `PAD`. Isti prikaz kao povijest na profilu (BLOK-HISTORY.md §4).
- Popis je i dalje **filtriran po `sessionId`**: u arhivi mogu čekati partije
  ranije serije koja se nije uspjela poslati, a one su druga večer.
- Panel nema zaseban naslov ni opis; nakon otvaranja odmah prikazuje partije
  tekuće serije. `archive.pending` se prikazuje prije njih kad
  `pendingSessions` nije prazan.
- Svaki red vodi rezultatom serije nakon te partije (`1 : 0`, `1 : 1`), a
  desno prikazuje rezultat same partije. Redni broj, datum i gumb za brisanje
  nisu dio ovog sažetka.

**Visina — ODLUKA, i dopuna §3.1.** Panel je **ograničen i skrolja sam u sebi**
(`maxH: min(28dvh, 14rem)` na telefonu, `overscroll-behavior: contain`), ne
gura. Kartica je prvi red (`auto`) mreže **točne** visine; da raste, jela bi
popis podjela, a kod dovoljno duge serije i prelila bi se ispod fiksne trake s
gumbima, gdje je ništa ne može dohvatiti. Pravilo §3.1 je bilo da se **stranica**
ne skrolja — ograničen skroler koji postoji samo dok je panel otvoren stranicu
ne pokreće, i jedina je alternativa koja to pravilo doista drži. Broj `28dvh` je
računica, ne ukus: na kratkom telefonu (568 px) kartica s trakom veze već troši
~200 px od ~378 px koliko stupac ima, pa je to ono što popisu podjela još ostavi
redak.

#### 3.3.2 Dogovori o dijeljenju karata — dodano 2026-09-08 (zahtjev korisnika)

Dvije stavke ulaze u „Postavke”, uz bodovni cilj, „igra se na” i „igra se do”.
Ondje su iz istog razloga kao i one: **dogovori za stolom**, izgovoreni jednom
prije prve podjele. Oba stoje na `BlokGame` uz `target` / `seriesTarget` /
`gameEndRule` i nasljeđuju se u `newGame()`, `discardCurrent()` i
`resetSession()` točno kao ta tri (i kao `shareEnabled`, §3.3.3). **Nijedno
nije blizu `scoreManualDeal`** —
bodovanje o stolu ne zna ništa.

**1. Prekidač „Sljedeći dijeli” (`showDealer`, zadano `true`).** Traka iz §3.1
postaje neobavezna. Stol koji dijeli bez podsjetnika ne treba redak koji trebaju
podjele. Natpis prekidača **nema vlastiti ključ** — nosi ga `dealer.next`, isti
koji piše na samoj traci, pa se postavka i ono što ona pali ne mogu prozvati
različitim imenima. Prekidač **ne dira sam slijed**: djelitelj se i dalje izvodi
iz `dealer.first` + `dealDirection` + broja podjela, pa se paljenjem natrag
pokaže mjesto koje bi se pokazivalo cijelo vrijeme.

**2. „Smjer kartanja” (`dealDirection`, `"right"` zadano, `"left"` drugo).**
Na koju stranu ide dijeljenje oko stola. Vodi **zadanog** sljedećeg djelitelja i
smjer koji traka prikazuje.

- **Imenuje se kako se za stolom kaže, ne rotacijom.** Ranije je polje živjelo
  kao `dealer.direction: "clockwise" | "counterclockwise"`; s mjesta na kojem
  onaj tko piše sjedi (dno nacrtanog stola) dijeljenje **u desno** ide na ekranu
  **kontra kazaljke**, pa je rotacija bila ime koje se ne može izgovoriti bez
  objašnjenja. `dealer.clockwise` / `dealer.counterclockwise` su obrisani iz oba
  rječnika, a zamjenjuju ih `dealer.right` / `dealer.left`.
- **Pohrana ostaje `v1`.** `sanitizeDealDirection` čita i staro ime:
  `"clockwise"` → `"left"`, `"counterclockwise"` → `"right"`. Bez toga bi stol
  koji je izričito rekao „u lijevo” bio tiho presjednut. Ništa se ne prepisuje
  na disku, nema migracije i nema podizanja verzije.
- **Jedna vrijednost, dvoja vrata.** Sredinji gumb u listu djelitelja piše
  **isto** polje kroz `onDirectionChange`; nema drugog stanja koje bi se moglo
  razići s čipovima u „Postavke”.

**ŠTO SE DOGAĐA S RUČNO POSTAVLJENIM DJELITELJEM — ODLUKA.** Postavka **nikad
ne prepisuje ono što je netko za stolom rekao naglas.** Kod nije imao razliku
između „izračunato” i „ručno odabrano” — `dealer.first` se uvijek spremao i
uvijek je počinjao od `"self"` — pa je razlika **uvedena**: `dealer.chosen`.
Nije izvedena vrijednost (§2), nego zapis o izgovorenoj odluci, iste vrste kao
`sessionId` ili `BlokLink`. Odsutna pri čitanju znači `false`.

| | što je `first` | što radi promjena smjera |
|---|---|---|
| `chosen === false` | nagađanje bloka („`self` je dijelio prvu”) | `first` se **ne dira**, cijeli se slijed **ponovno izvodi** — mjesto koje trenutno dijeli se smije pomaknuti |
| `chosen === true` | netko je taknuo mjesto u listu | djelitelj koji se **sada** prikazuje ostaje isti (`firstDealerFor` ga vrati unatrag pod novim smjerom); mijenja se samo redoslijed **poslije** njega |

Na nultoj podjeli su dvije grane identične — nema rotacije koju bi se izvodilo.
`chosen` postaje `true` samo u `DealerTracker → changeDealer`, putuje kroz
`newGame()` (nastavak istog dogovora) i vraća se na `false` u `resetSession()`
(nova večer nikoga nije imenovala). Pravilo živi na **jednom mjestu**:
`store.ts → setDealDirection`.

**Visina dijaloga.** Pet odjeljaka na telefonu: `scrollBehavior="inside"` je
tamo od trećeg, a prekidač **nosi vlastiti naslov umjesto da stoji pod njim** —
natpis lijevo, kontrola desno, 44 px za cijelu postavku. Ništa postojeće nije
smanjeno: dijalog je popis dogovora, a plaćati nove stiskanjem starih znači
izgubiti oboje. Čipovi smjera ostaju vidljivi i kad je traka ugašena — smjer je
ono što je stol dogovorio, ne ono što traka crta, a postavka sakrivena iza
postavke je postavka koju nitko više ne nađe.

#### 3.3.3 „Omogući dijeljenje” — dodano 2026-09-08 (zahtjev korisnika)

Treći prekidač u „Postavke”, **zadano UKLJUČEN**, na `BlokGame.shareEnabled` uz
`showDealer` i ostale dogovore — nasljeđuje se u `newGame()`, `discardCurrent()`
i `resetSession()` točno kao oni, a **pohrana ostaje `v1`**: odsutno pri čitanju
znači `true` (svaka partija spremljena prije prekidača nudila je dijeljenje),
pa nema migracije.

Zamijenio je stavku izbornika **„Prekini dijeljenje”**, koja se pojavljivala tek
kad poveznica postoji — kontrola koju se moglo naći samo ako je već korištena.
Prekidač kaže **stanje**, prije nego itko išta pritisne.

**Ugašen znači dvoje:**
1. gumb za dijeljenje (gornji lijevi kut kartice) se **ne prikazuje** — ne
   prikazuje se onemogućen, jer kontrola koja stalno stoji i uvijek odbija
   reklamira značajku odbijanjem;
2. token koji je **korisnik sam izdao** se poništava (`revokeBlokShare`, isti
   put kao stara stavka izbornika). Poništavanje radi **stranica** pri
   `Spremi` — `store.ts` ne zna za mrežu.

**JEDNA IZNIMKA, i nije pregovor: serija povezana sa stolom na turniru ostaje
javna.** Organizator otvara taj zapisnik iz ždrijeba, i to **istim tokenom**
(BLOK-LINK.md §6.2: server ga izda pri upisu rezultata za odobrenu vezu, a
`BlokLinkDto.shareToken` ga nosi u ždrijeb). Povlačenje tog tokena odavde
razbilo bi poveznicu na koju je igrač pristao kad je tražio stol — i razbilo bi
je nekome tko nije ni u ovoj prostoriji.

- **Kako se dva slučaja razlikuju s onim što klijent zna:** po `game.link`.
  Živa veza je jedini signal koji uređaj ima, i pošten je — to je točno stanje u
  kojem je serveru rečeno da objavi zapisnik. Bez veze token može doći **samo**
  iz korisnikovog „Podijeli”, i tada ugašeno znači ugašeno. **Nije potrebno
  ništa s backenda**: `link` je već na `BlokGame`, i nijedan novi endpoint ni
  polje se ne traži.
- **Prekidač se ne onemogućuje kad veza postoji** — i dalje smije sakriti gumb.
  Ono što se mijenja je da se **na ekranu, ispod prekidača**, pojavi rečenica
  (`share.linkedNote`) koja kaže da zapisnik povezanog stola ostaje javan. Tamo
  gdje se odluka donosi, a ne u toastu poslije nje.

### 3.3.4 Tko miješa novu partiju — dodano 2026-09-09 (zahtjev korisnika)

Peta postavka za stolom, uz bodove, „igra se do”, „igra se na” i smjer
kartanja. Odlučuje **samo** tko dijeli PRVU podjelu SLJEDEĆE partije; podjele
unutar partije i dalje idu po `dealDirection`, kao i dosad.

| Vrijednost | Što radi |
|---|---|
| **`"next"`** (zadano) | Rotacija se nastavlja oko stola. Tko bi dijelio sljedeću podjelu završene partije, dijeli prvu podjelu nove. To je ono što je blok oduvijek radio, pa spremljena partija bez polja čita kao ovo. |
| **`"winner"`** | Dijeli **par koji je dobio** partiju. Rotacija se ne okreće — nastavlja istim smjerom, ali **preskače** sjedala para koji je izgubio, dok ne dođe do pobjednika. |

Primjer iz kojeg je pravilo napisano: dijelim ja, mi dobijemo partiju, smjer je
**lijevo**. Pod `"next"` novu partiju miješa lijevi protivnik; pod `"winner"`
on se preskače i miješa **moj partner**.

Partija koju nitko nije dobio (nedovršena) pada natrag na `"next"` — nema
pobjednika prema kojem bi se koračalo, a pomicati dijeljenje na temelju partije
koja nije završila bilo bi izmišljanje.

**Tko je dijelio se ZAPISUJE.** `dealer.first` svake partije putuje u zapisnik
serije (`BlokHistoryGameDto.dealer`, backend `BlokGameDto.dealer`, u jsonb —
bez migracije). To je jedina stvar o partiji koju njezine podjele ne mogu
reproducirati: svi kasniji dijelitelji izvode se iz tog jednog sjedala i smjera.
Šalje se `null` kad nitko nije imenovao dijelitelja — nagađanje bloka nije
činjenica o večeri i ne zapisuje se kao takva.

**Postavke se spremaju na dodir, ne na gumb** (2026-09-09, zahtjev korisnika).
Dijalog više nema „Spremi” ni „Odustani”; jedini izlaz je **X** u gornjem
desnom kutu, a svaka kontrola upisuje promjenu istog trena. To je ovdje sigurno
jer je blokov store i jest spremanje: `localStorage`, sinkrono, bez mreže na
putu. Telefon bez signala zadrži svaku postavku; serija ide na profil kasnije
preko outboxa (`useBlokHistoryUpload`), a na povezani stol preko
`useBlokLinkSync` — isto kao i same podjele.

**„Otvorena” se zove „Neograničeno”**, a prekidač dijeljenja „Omogući
dijeljenje partije poveznicom” — oboje 2026-09-09, jer je prvo ime tražilo da
pogodiš što je otvoreno, a drugo nije reklo što se dijeli ni kome.

**Postavke su sada šest redaka, ne šest odjeljaka.** „Igra se na”, „Smjer
kartanja” i ova nova dijele oblik s prekidačima uz njih: naslov lijevo,
kontrola desno, jedan redak po dogovoru (`SegmentedChoice`, 2026-09-09).
Prije su segmentirane postavke imale naslov iznad kontrole preko cijele širine —
tri retka za jednu riječ značenja, tri puta — pa je dijalog izgledao kao dvije
vrste postavki iako drži samo jednu.

### 3.3.5 Dva putokaza na sažetku partije — dodano 2026-09-09 (zahtjev korisnika)

Kartica sažetka nosi dva reda sivog teksta sa strelicom, i oba pokazuju na nešto
što je **već na ekranu**:

- **gore, strelica prema gore** — „pogledaj prethodne partije”, prema chevronu
  na kartici rezultata iza kojeg žive odigrane partije serije. Prikazuje se čim
  ima što gledati (`reviewableGames > 0`, ista lista koju chevron otvara), dakle
  već čim prva partija završi — završena tekuća partija je u toj listi;
- **dolje, na podu kartice, strelica prema dolje** — „započni novu igru”.

Na telefonu se kartica **rasteže** do poda prostora koji joj je ostao, dakle do
same trake s gumbima (2026-09-09, zahtjev korisnika). Prije je bila visoka
koliko i sadržaj, pa je završavala na pola ekrana i strelica je pokazivala u
prazno umjesto na gumbe. Presuda i brojke drže svoju prirodnu visinu na vrhu,
a uputa ide `mt="auto"` na dno — bez klizanja, koliko god telefon bio visok.

Oboje su putokazi, ne kontrole: bez okvira, bez boje, jedan redak. Razlog je da
su i chevron i gumb dotad bili otkrivi samo pokušajem.

**Panel odigranih partija drži TOČNO TRI reda** (2026-09-09, zahtjev
korisnika), a četvrta se kliže unutar njega umjesto da raste kartica. Broj je
aritmetika, ne ukus: jedan red su njegova dva reda sloga plus `py="2.5"` i
obrub, oko 3.5rem, a redovi su razmaknuti `gap="2"` — dakle 3 × 3.5rem +
2 × 0.5rem. Prije je granica bila u `dvh` i na visokom telefonu puštala četvrti
red, što je karticu s presudom guralo s dna ekrana i vraćalo klizanje.

Kad je taj panel **otvoren**, kartica s presudom se crta **zbijeno**
(`BlokSummary compact`): manji razmaci i slog, ništa skriveno. Kartica
REZULTATA se pri tome ne dira — probano 2026-09-09 i odmah vraćeno: brojka koju
čovjek čita mijenjala je veličinu pod prstom svaki put kad bi otvorio chevron,
a to je gora greška od tijesnog ekrana. Sažetak koji
izbaci broj da bi stao je sažetak kojem se ne može vjerovati. Zato stanje
panela drži STRANICA, a ne `BlokHeader` — kartica ispod mora znati da je ona
gore upravo narasla.

**Dva gumba su u DONJOJ TRACI, ne na kartici** (2026-09-09, zahtjev korisnika).
Čim partija ima pobjednika, MI/VI gumbi nemaju što raditi — nema sljedeće
podjele za upisati — pa ta ista dva okvira preuzimaju jedina dva smisla koja
preostaju: **„Poništi zadnju rundu” na mjestu MI**, **„Sljedeća partija” (ili
„Nova igra” kad je serija gotova) na mjestu VI**. Palac se ne mora seliti, a
kartica sažetka ostaje ono što jest — presuda i brojke. To je ujedno i ono na
što strelica ispod sažetka konačno pokazuje.

**Pobjednik se zove svojim imenom.** Ako je ekipa upisala ime, piše „Perhaj i
Galinec su pobijedili”, a ne „Mi smo pobijedili” (`winner.named`,
`series.wonNamed`). MI/VI ostaje ono na što se vraća bezimena strana, jer većina
stolova nikad ništa ne upiše.

### 3.4 Serija partija — dodano 2026-09-08

**Blok JEST serija.** Partije se nižu za istim stolom, rezultat ide 1 : 0,
2 : 1, 3 : 1, i zatvara ga **samo „Nova igra”** (do 2026-09-08 „Resetiraj” —
BLOK-HISTORY.md §5.6) — trenutak kad igrač kaže da je večer gotova, serija ode
na profil i blok se očisti. To je bilo istina i prije; nedostajalo joj je samo
da se **vidi**.

**Rezultat serije u zaglavlju — ISPRAVAK 2026-09-08, zahtjev korisnika.**
Centrirana pilula „SERIJA 2 : 1” je **uklonjena**. Sada je to **jedan mali broj
iznad zbroja svake strane**, u boji te strane: lijevo dobivene partije lijeve
strane, desno desne. Bez oznake, bez dvotočke, ništa centrirano — isti podatak,
pročitan kao dio stupca kojem pripada. To je i oblik referentne aplikacije po
kojoj je blok modeliran (mala zelena 6 nad jednim rezultatom, mala crvena 5 nad
drugim).

Da se ne pomiješa s velikim zbrojem: **otprilike četvrtina njegove veličine**,
odmaknut razmakom, i **ne postoji dok serija nema nijednu gotovu partiju** (0
nad svježim blokom je oznaka za nešto što se nije dogodilo — ta odluka je
namjerna, ne posljedica). Pojavljuje se i nestaje **na obje strane odjednom**,
pa stupci nikad nisu različite visine.

Budući da izgovorene pilule („SERIJA 2 : 1”) više nema, **svaki broj nosi
vlastito pristupačno ime** u `srOnly` spanu (`series.sideAria` → „Serija — MI:
2 dobivene igre”, kroz `usePlural()`), a sama znamenka je `aria-hidden`. Ključevi
`series.score` i `series.scoreAria` su obrisani iz oba rječnika.

**Redak s ciljem nosi ostatak dogovora.** „do 2 dobivene igre”
(`series.badgeTarget`) je preseljen iz pilule u redak iznad zbrojeva.

> **ISPRAVAK 2026-09-08 (druga revizija, BLOK-HISTORY.md §5.5) — redak sada
> glasi „DO 1001 · PROLAZ”.** Dvije promjene:
>
> - **„Cilj” → „DO”** (`target.label`). Isto vrijedi svugdje gdje se cilj
>   ispisuje — kartica bloka, povijest na profilu, dijeljeni zapisnik.
> - **Pravilo se ispisuje UVIJEK**, ne samo kad nije zadano; raniji uvjet je
>   uklonjen. Iz istih podjela ispada različit pobjednik ovisno o pravilu, pa
>   redak koji kaže *do koliko* se igra mora reći i *po čemu*.
>
> Sa serijom redak glasi **„DO 1001 · PROLAZ · do 2 dobivene igre”**; redoslijed
> je fiksan (cilj i pravilo su jedna rečenica o **partiji**, duljina serije je o
> večeri i dolazi zadnja). Riječ pravila ima vlastite ključeve
> (`rule.prolazInline` / `rule.dostaInline`) kako bi format sažetka ostao
> neovisan o natpisima čipova.
>
> **Prelamanje na uskom telefonu:** redak se više ne spaja u jedan string nego
> se crta po dijelovima — svaki dio je `whiteSpace="nowrap"`, a razmaci oko `·`
> su jedine točke prijeloma. Tako se puni redak na 320 px prelomi **između**
> dogovora, a nikad unutar jednoga („DO” u prvom retku, „1001” u drugom).
> Razdjelnik ostaje u stablu pristupačnosti točno kao dok je bio dio stringa.

Dijelovi su spojeni znakom `·`; to je interpunkcija, svaka riječ u retku
dolazi iz rječnika.

**`seriesTarget` — neobavezan kraj.** `BlokGame.seriesTarget: number | null`;
**`null` (otvorena serija) je zadano** i to je točno ponašanje bloka prije ovog
polja. Postavi se u dijalogu „Promijeni cilj” — bodovni cilj, pravilo kraja
partije (§3.5) i duljina serije **zajedno** kažu kako se igra, pa dijele jedan
dijalog umjesto da izbornik dobije tri stavke. Ponuđeno: **Otvorena / 1 / 2 / 3**,
a gumb „Otvorena” je prvi u redu jer je to zadano stanje iz kojeg ostali izlaze.
Nasljeđuje se u `newGame()` („Sljedeća partija”) i `discardCurrent()` isto kao
`target` i `names` (sve partije jedne večeri moraju se slagati oko toga do
koliko se igra), a `resetSession()` ga prenosi u novu seriju.

> **ISPRAVAK 2026-09-08 — „Vlastiti broj igara” je uklonjen, a odjeljak se sada
> zove „Igra se do”.** Zahtjev korisnika: čipovi su samo **upisivali** u to
> polje, koje se onda moglo izmijeniti u nešto treće, pa je isti izbor imao dvije
> kontrole koje se mogu razići pred očima — a „igra se do 7” ionako nitko ne
> igra. Čipovi su sada cijeli izbor; `series.custom` je obrisan iz oba rječnika,
> a `series.title` („Serija”, natpis koji nije govorio što se bira) zamijenjen je
> s `series.playTo` („Igra se do”). **Bodovni cilj zadržava svoje polje** — 2001
> je sasvim običan dogovor za stolom, i to je cijela razlika između ta dva broja.
> `MAX_SERIES_TARGET` ostaje u `types.ts`: `sanitizeSeriesTarget` i dalje mora
> obraniti pročitanu vrijednost, bez obzira na to što je više ne može upisati
> zaslon.

**Kraj igre, tri pojavnosti sažetka:**
1. **otvorena serija** (zadano): pobjednik PARTIJE, ispod njega tekući rezultat
   serije, i **„Sljedeća partija”** kao glavna radnja. Ništa ovdje ne proglašava
   seriju gotovom, jer ništa i ne može — to radi „Nova igra” u izborniku.
2. **cilj postavljen, još nije dosegnut**: isto, plus redak „Serija 2 : 1 —
   igra se do 3 dobivene igre” (kroz `usePlural()`).
3. **cilj dosegnut**: presudak kaže da je gotova **SERIJA**, a glavna radnja
   postaje **„Nova igra”** (spremi na profil, rezultat serije na 0:0, prazan
   blok — BLOK-HISTORY.md §2.2 i §5.6). „Sljedeća partija” tu **nestaje** iz
   ove kartice: ponuđena uz radnju koja **završava** večer pretvorila bi gotovu
   seriju u četvrtu partiju koju nitko nije namjeravao odigrati.

> **DVIJE RADNJE, DVA IMENA — i to je cijela poanta §5.6.** Gumb ispod dobivene
> partije glasi **„Sljedeća partija”**, nikad „Započni novu igru”: riječi „nova
> igra” od 2026-09-08 pripadaju izborniku, koji seriju **zatvara**, a ista bi
> riječ za suprotan čin (jedan nastavlja 2 : 1, drugi ga vraća na 0:0) bila
> upravo zbrka koju je ta revizija maknula. Isto govore i ikone: strelica
> naprijed ovdje, plus iz izbornika za kraj. Ključ je `winner.nextGame`;
> `winner.newGame` je obrisan iz oba rječnika.

**Ništa izvedeno se ne sprema (§2).** Rezultat serije se **broji** iz partija
iste `sessionId` (`seriesWinsIn` → `winnerOf`), na svakom renderu, kao i
zbrojevi. Zato uređivanje ili brisanje podjele koja je odlučila drugu partiju
odmah pomakne i „2 : 1” u zaglavlju. Isto radi i backend: `games_us`/`games_them`
broji iz `winner` svake partije u poslanom zapisu (BLOK-HISTORY.md §3.1), pa se
broj na telefonu i broj na profilu ne mogu razići.

**Pohrana ostaje `v1`.** Partija spremljena bez `seriesTarget` se čita kao
`null`; nema migracije i nema podizanja verzije.

### 3.5 Kraj JEDNE partije — „dosta” / „prolaz” — dodano 2026-09-08

Drugi dogovor za stolom, i **druga razina od §3.4**: §3.4 kaže koliko partija
nosi seriju, ovo kaže kako završava **jedna** partija do 1001. Zato u dijalogu
stoji **odmah ispod bodovnog cilja**, a ne uz duljinu serije — tako je korisnik
i tražio.

`BlokGame.gameEndRule: "dosta" | "prolaz"`, **zadano `"prolaz"`** (odluka
korisnika, 2026-09-08 — BLOK-HISTORY.md §5.5; do tada je zadano bilo `"dosta"`):

- **Prolaz** — prijeći cilj nije dovoljno samo po sebi: partiju dobiva strana
  koja cilj prijeđe **u podjeli koju je zvala i u njoj prošla** (nije pala). Tko
  prijeđe padajući, ili u tuđoj podjeli, igra dalje. **Zadano.**
- **Dosta** — partija je gotova čim neka strana dosegne ili prijeđe cilj;
  pobjeđuje viši zbroj. To je bilo ponašanje bloka do 2026-09-08, a ta grana u
  kodu je **doslovno ista funkcija kao prije** ovog polja.

U oba pravila **izjednačen zbroj na cilju ili preko njega ne odlučuje ništa** —
igra se još jedna podjela. To pravilo je već postojalo (`winnerOf`) i ostaje.

> **⚠ NEPOTVRĐENO PRAVILO — pročitaj prije nego što ga „popraviš”.** Dio „strana
> koja je zvala mora i proći” je **čitanje agenta**, izvedeno iz korisnikovih
> riječi („mora se odigrati partija i tko na kraju ima više”) i iz načina na koji
> se bela igra za stolom. Korisnik ga **nije potvrdio**.
>
> Implementacija je na **jednom mjestu**: `store.ts` → `passedAndWon`. Ako je
> čitanje krivo, mijenja se ta funkcija i ništa više.
>
> **A od 2026-09-08 je ulog veći, na dva načina.** Prvo, rečenica koja je to
> čitanje držala na ekranu (`rule.prolazHint`) je **obrisana** na zahtjev
> korisnika (§3.3), pa se krivo čitanje više ne vidi nigdje osim ovdje. Drugo,
> „prolaz” je sada **zadano**, pa se po njemu sudi i svaka partija koja o
> pravilu nikad nije ništa rekla.

**Gdje pravilo živi.** `winnerFrom` u `store.ts` je i dalje **jedino** mjesto
koje odlučuje da je partija gotova. Pod `"prolaz"` mu treba podjela koja je
prešla cilj — njezin zvač i je li pao (`fell` iz `scoreManualDeal`, već izračunat
po podjeli u `perRound`/`scoreRounds`) — pa ta grana **hoda podjelu po podjelu**
umjesto da gleda konačne zbrojeve. Zaglavlje i sažetak **čitaju odgovor**
(`winner`, `winnerOf`); nigdje drugdje nema kopije pravila.

Posljedica te šetnje, namjerna: pod `"prolaz"` pobjednik je zamrznut na podjeli
koja je partiju dobila, pa podjela dodana **poslije** nje ne mijenja pobjednika
(mijenja zbrojeve, koji su i dalje suma svih podjela). Pod `"dosta"` se sve
računa iz konačnih zbrojeva, kao i dosad. U praksi se poslije gotove partije ne
piše dalje — otvara se „Sljedeća partija” — ali razlika je zapisana da ne bude
iznenađenje.

**Nasljeđivanje i pohrana.** Nasljeđuje se u `newGame()`, `discardCurrent()` i
`resetSession()` točno kao `target`, `names` i `seriesTarget` — sve partije
jedne večeri igraju se po istom pravilu. **Pohrana ostaje `v1`**: partija
spremljena bez polja se čita kao `"prolaz"` (`sanitizeGameEndRule` vraća zadano
za sve što nije doslovno `"dosta"`), nema migracije i nema podizanja verzije.

> **ŠTO PROMJENA ZADANOG RADI ZATEČENIM PARTIJAMA — ODLUKA, ne propust.**
> `winnerOf` pravilo računa **uživo**, pa se partija spremljena prije ove
> promjene ponovno sudi po „prolazu”. Konkretno: partija dobivena tako da je
> netko prešao cilj **u tuđoj podjeli** ili **padajući** prestaje biti dobivena
> dok je sljedeća podjela ne odluči — `withFinishedAt` joj pri čitanju očisti
> `finishedAt` i vraća je u tijek, a rezultat serije (koji se broji iz
> `winnerOf` po partijama) se može pomaknuti. **Migracije koja bi stare
> pobjednike zamrznula NEMA**: spremiti izvedenog pobjednika značilo bi drugi
> izvor istine za broj koji §2 izričito drži izvedenim, a pravilo je
> promijenjeno baš zato da vrijedi. Obrnuto vrijedi i dalje: partija koja je
> `"dosta"` spremila **izričito** ostaje `"dosta"` (test u `sanitizeGameEndRule`
> je na `"dosta"`, ne na zadanom — obrnuto bi tiho prekrstilo svaki svjestan
> odabir).

**Promjena pravila usred partije** prolazi kroz `updateCurrent`, koji ponovno
udara `finishedAt` prema izvedenom pobjedniku: prebacivanje na „Prolaz” na
partiji koja je dobivena prelaskom cilja u padu tu partiju **vraća u tijek** u
istom kadru. To je pošteno čitanje postavke koju je igrač upravo odabrao, i isti
mehanizam kojim uređivanje stare podjele već poništava kraj igre.

**ŠALJE se na profil — ISPRAVAK 2026-09-08 (BLOK-HISTORY.md §5.5).** Ranija
verzija ovog odjeljka je tvrdila suprotno. Razlog za promjenu: `winner` bez
pravila **nije provjerljiv** — iste podjele daju drugog pobjednika pod „dosta” i
pod „prolaz”, pa zapis na profilu i iza dijeljene poveznice nosi broj koji
nitko ne može ponoviti. Zato `blokHistoryApi.ts` šalje `gameEndRule`:

- **po partiji** (`games[].gameEndRule`) — to je pravilo koje je *tu* partiju
  presudilo, a mijenja se i usred serije;
- **i na razini serije** (uz `target` i `names`, iz **zadnje** partije) — za
  stupac `game_end_rule` iz §5.5.

Šalje se **bez obzira na to je li backend već dodao stupac**: nepoznato polje
se tiho odbaci, a polje koje nije poslano se ne može naknadno rekonstruirati.
`seriesTarget` se i dalje **ne** šalje. `winner` i `totals` i dalje računa
uređaj (`winnerOf`/`totalsOf`), pa već nose posljedicu pravila.

### 3.6 Dijeljenje zapisnika poveznicom — dodano 2026-09-08

BLOK-HISTORY.md §5.2. Gumb je u **gornjem lijevom kutu kartice s rezultatom**,
nasuprot izborniku: dijeljenje je česta i bezopasna radnja i ne pripada iza iste
tipke kao „Obriši igru”.

**Dijeli se poveznica, ne tekst.** Redoslijed je uvijek isti i nijedan korak
nije neobavezan:

1. serija se **spremi** na profil (isti put kao §3.7 — `saveSessionNow`);
2. server izda (ili vrati) **token** — `POST /user/me/blok-history/{uuid}/share`;
3. `blokShareUrl(token)` → `/blok/z/{token}`, pa Web Share API, a
   `navigator.clipboard` kao rezerva (`common.clipboard.*`).

Spremanje nije neobavezno: poveznica na zapis koji još ne postoji je 404, a
smisao poveznice je da pokazuje ono što je na bloku **sada**.

- **Token nije `uuid`.** Zapisi postoje bez ičijeg pristanka na dijeljenje, pa
  pogađanje `uuid`-a ne smije ništa otkriti. Frontend token nikad ne izvodi —
  samo nosi ono što je server rekao.
- **Neprijavljen ide na prijavu** i vrati se dovršiti radnju (§3.7, isti
  mehanizam). Poveznica traži zapis, a zapis traži račun.
- **Prekid dijeljenja** više nije stavka izbornika nego **isključeni položaj
  prekidača „Omogući dijeljenje”** u „Postavke” (§3.3.3, zahtjev korisnika
  2026-09-08). Token umire, **zapis na profilu ostaje** — zato `BlokShare.uuid`
  preživi, a `token` postaje `null`. Ključevi `share.stop` i `share.confirmStop`
  su obrisani iz oba rječnika; potvrda je `Spremi` u samom dijalogu.
- Gumb je obojen (`brand`) kad poveznica postoji, ali boja **nije jedini
  nositelj**: `aria-label`/`title` je `share.again` umjesto `share.action`.

### 3.7 „Nova igra” ZATVARA seriju — REVIDIRANO 2026-09-08 (§5.6)

> Ovaj odjeljak **zamjenjuje** raniju verziju („Nova igra je izbor”, dijalog s
> tri ishoda, `components/NewGameDialog.tsx`). Ta komponenta je **obrisana**.
> Korisnik: *„Nova igra bi trebalo staviti rezultate na 0:0 i one trenutne igre
> spremiti (osim ako partija nije dovršena onda se ona ne sprema), tako da bi
> ono trebalo raditi kao resetiraj”* — BLOK-HISTORY.md §5.6.

Tri radnje, tri imena, i nijedno se ne smije pročitati kao drugo:

| radnja | gdje | što radi |
|---|---|---|
| **Nova igra** | izbornik | zatvori **seriju**: dovršene partije na profil, rezultat serije na **0:0**, prazan blok |
| **Sljedeća partija** | sažetak, ispod dobivene partije | sljedeća partija **unutar** serije — tekući 2 : 1 se nastavlja |
| **Obriši igru** | izbornik | baci podjele tekuće partije, serija ostaje |

**NEDOVRŠENA PARTIJA SE NE SPREMA.** U zapis idu **samo partije koje imaju
pobjednika**; tekuća partija bez pobjednika se odbacuje zajedno s ostatkom
serije. To je ono što povijest na profilu čini vrijednom čitanja — spremljena
serija nikad ne sadrži pola partije.

- **Pravilo živi na jednom mjestu:** `store.ts → isRecordableGame(game)` =
  „ima podjela **i** ima pobjednika”. Pobjednik je `winnerOf`, dakle izveden
  uživo po pravilu te partije (§3.5), nikad spremljena zastavica — partija kojoj
  se odlučujuća podjela naknadno izmijeni prestaje biti zapisiva u istom kadru.
  Čitaju ga **točno dvoje**: `resetSession` (arhivira tekuću partiju samo ako je
  zapisiva; biljeg u `pendingSessions` ostavlja samo ako ima što slati) i
  `blokHistoryApi.ts → buildSessionPayload` (filtrira partije i vrati `null` kad
  ne ostane nijedna). **Filtar je u graditelju zapisa**, jer kroz njega prolaze
  sva tri puta do profila — zatvaranje, tihi retry i „Podijeli”, koji sprema
  prije nego zatraži token. Filtar samo u `store.ts` pustio bi dijeljenje da
  pošalje partiju koja se još igra, a `POST` je upsert — ta bi polovica partije
  sjela baš u zapis koji zatvaranje tek dovršava.
- **Serija čija je JEDINA partija nedovršena — ODLUKA:** ne šalje se ništa i ne
  ostaje ništa. Nema zapisa od nula partija (redak u povijesti koji ne govori
  ništa) i nema biljega koji bi ga jednom napravio.
- **Potvrda ide kroz `ConfirmDialog`** (nikad `confirm()`) i mora reći **oboje**:
  što se sprema i da rezultat serije ide na **0:0**. Tri rečenice, ne jedna s
  ogradom — prijavljenom se sprema, neprijavljenom se samo briše, a kad nijedna
  partija nije dovršena nema se što spremiti („serija (0 partija) sprema se…”
  bila bi laž koju piše predložak). Kad uz dovršene partije stoji i nedovršena
  tekuća, dodaje se zasebna rečenica; spajaju se **razmakom**, pa se gramatički
  ne sastavlja ništa ni u jednom jeziku. Broj partija ide kroz `usePlural()`.
- **Gumb potvrde nije crven.** Radnja prvo **sprema**; crveno bi govorilo
  suprotno od onoga što radi. Rečenica iznad nosi posljedicu.
- **Ništa se ne briše prije potvrde slanja.** `resetSession(signedIn)` je jedan
  upis u `localStorage` i ekran je prazan u istom kadru, bez obzira na mrežu;
  partije čekaju iza biljega u `pendingSessions`, a briše ih tek 200
  (`useBlokHistoryUpload`, BLOK-HISTORY.md §2.2).
- **Neprijavljen radi lokalno i to se kaže jednom**, mirno (`toast`,
  `newGame.signedOutNote`) — nikad kao poziv na prijavu, i **nema više prijelaza
  na prijavu** za ovu radnju: `?radnja=spremi-novu` je uklonjen, `?radnja=podijeli`
  (§3.6) ostaje jedini.
- **Stavka je onemogućena samo na praznom bloku** — kad nema ni dovršene ni
  započete partije, „Nova igra” bi samo iskovala novi `sessionId`.

### 3.8 Blok bez interneta — dodano 2026-09-08 (zahtjev korisnika)

> Korisnik: *„možeš li napraviti da se blok može koristiti i u offline modeu …
> ako je upisao više rezultata, više igra, čak i započeo nove igre, je li
> moguće da se to negdje sprema i onda kad dođe online sve syncira s njegovim
> profilom ako je prijavljen?”*

Blok je oduvijek bio `localStorage` i nula zahtjeva (§1, §4). Nedostajalo je
troje, i sve troje je **izvan** `store.ts`.

**1. Hladan start bez mreže mora doći do `/blok`.** `public/sw.js` je
network-first, pa je `/blok` preživljavao samo ako je taj build već bio u
kešu — a stranica je lijeno učitan chunk, pa korisnik koji ju nikad nije
otvorio dok je bio online nije imao ništa. Sada:

- `vite.config.ts` → plugin **`bela-precache-manifest`** u `generateBundle`
  izračuna **zatvarač statičkih uvoza** od dva korijena: ulazni chunk i chunk
  na koji se razriješi `React.lazy` za `/blok` (traži se po `facadeModuleId`,
  ne po imenu datoteke). Rezultat je `/precache-manifest.json`. **Popis se ne
  može napisati rukom** — Vite u svako ime stavlja hash sadržaja — ni izvesti
  u pregledniku, jer `index.html` ne spominje chunk lijene rute.
- Slijede se **samo statički** uvozi: to je točno „što mora biti tu da se ovaj
  modul može izvršiti”, pa `vendor-map` (Leaflet, samo `/karta`) i svaka druga
  ruta ostaju vani. **`importedAssets` se NE uzimaju**: `import.meta.glob` u
  `game/cards/madjarice` uvlači svih 32 slike karata (2,8 MB webp) u graf
  `PlayingCard`-a, do kojeg blok dođe samo zbog `SuitIcon` — četiri inline SVG
  putanje. Blok nikad ne crta lice karte.
- `sw.js` **dohvaća** taj popis (ne nosi ga u sebi): preglednik ponovno
  instalira workera samo kad se promijene njegovi **bajtovi**, a `public/sw.js`
  je identičan između deployeva — popis zapisan u njemu zamrznuo bi se na prvom
  buildu koji se instalirao. Zato `install` i **svako učitavanje stranice**
  (`SwUpdateToast` šalje `postMessage({type: "bela:precache"})`) pozovu
  `refreshPrecache`. Common case staje na ~300 bajta: `build` biljeg u kešu i
  provjera da je sve iz popisa još tu.
- Redoslijed unutar prolaza je normativan: **prvo dodaj nove chunkove, onda
  zamijeni `index.html`, tek onda pobriši stare.** Svaki drugi redoslijed može
  ostaviti keširani `index.html` koji pokazuje na već obrisani chunk — hladan
  start koji digne ljusku i umre na vlastitoj `<script>` oznaci.
- `/assets/*` više **nije** propušten pregledniku nego se poslužuje
  **cache-first**. Sigurno je po konstrukciji (ime nosi hash sadržaja), a stara
  napomena („HTTP keš već radi pravu stvar”) vrijedi samo za datoteku koju je
  uređaj već jednom dohvatio — što je upravo ono što offline blok nema.

**Ostale rute offline** dobivaju `components/OfflineNotice.tsx`, i **samo
one**: `lazyWithReload` više ne radi reload kad `navigator.onLine === false`
(reload bi stigao do iste nedostajuće datoteke) nego baca pod
`OFFLINE_CHUNK_ERROR`, a `ErrorBoundary` na taj i **samo** taj signal crta
ekran s poveznicom na blok. **Nije globalni „nemaš vezu” ekran — ODLUKA:**
`sw.js` čuva snimku anonimnih `GET /api/*`, pa se već posjećeno kolo i tablica
otvore bez signala; ekran preko svih ruta bi tu značajku zamijenio rečenicom.

**2. Red čekanja, ne jedno mjesto.** `pendingSessions` je lista (cap 20,
najstariji ispada), prazni se **s početka** — redoslijedom kojim su serije
igrane — i uvijek **jedna po jedna**: dvije paralelno bi utrkivale dva
read-modify-write upisa u isti ključ i jedno brisanje bi se izgubilo. Svaka se
serija briše lokalno **tek na 200 za njezino vlastito slanje**.

**3. Prijava naknadno prazni red.** `useBlokHistoryUpload` se **više ne
montira na `/blok`** nego u `src/blok/BlokOutbox.tsx`, koji `App.tsx` drži na
svakoj stranici. „Pokušaj kad se blok sljedeći put otvori” je pogrešan okidač
za red koji postoji zbog večeri bez signala: povratak mreže i prijava
(`/prijava` je druga ruta) događaju se drugdje. **Točno jedan montaž** — dva bi
oba slala `pendingSessions[0]` i pisala isti ključ. Neprijavljen: `enabled`
je `false`, nula slušača i nula zahtjeva, iz cijele aplikacije.

**Odbijeno slanje koje se nikad neće promijeniti — ODLUKA.** Treći ishod, uz
200 i „ne još”: `400` / `413` / `422` (granice iz BLOK-HISTORY.md §3.3) daju
isti odgovor zauvijek, pa bi vječni retry zakočio glavu reda i sve večeri iza
nje. Ni to ni tiho brisanje: biljeg se **seli** iz `pendingSessions` u
**`rejectedSessions`**, partije **ostaju** u arhivi, a blok jednom mirno kaže
koliko ih je (`archive.rejected`, plural). Kratka bijela lista, ne „bilo koji
4xx”: 401 je token koji se osvježava, 403 može biti proxy, 408/429 doslovno
kažu „kasnije”, 5xx je deploy u tijeku.

**Što korisnik vidi dok se čeka:** dva reda sitnog teksta iznad popisa podjela
(`archive.pending`, `archive.rejected`), nikad toast po pokušaju. Uspjeh je
**jedan** toast kad se red isprazni, ne jedan po seriji. Redovi su preseljeni
iz `BlokSeriesGames` (iza strelice, i ne renderira se dok serija nema dovršenu
partiju — dakle nevidljivi točno nakon „Nova igra”, kad je red sigurno pun).

**Pohrana ostaje `v1`.** `rejectedSessions` se čita tolerantno kao i
`pendingSessions` (odsutno = prazno), i uz to se **filtrira na biljege iza
kojih još ima partija** — inače bi redak brojao večeri kojih na uređaju više
nema.

---

## 4. Gdje što živi

| Što | Gdje | Zašto |
|---|---|---|
| Bodovanje (§1) | `game/packages/engine/src/manualScore.ts` | Engine je „čista pravila bele”, ima vitest i nula ovisnosti. Frontend ga već uvozi preko Vite aliasa `@bela/engine`. Bez testova ovdje se pad i štiglja tiho pokvare. |
| Model + tipovi | `frontend/src/blok/types.ts` | Ovaj dokument ih fiksira; agenti ih ne mijenjaju bez razloga. |
| Stanje + `localStorage` | `frontend/src/blok/store.ts` | Jedan hook, jedan ključ, jedno mjesto za migracije. |
| Zasloni | `frontend/src/blok/pages/BlokPage.tsx`, `frontend/src/blok/components/*` | |
| Prijevodi | `frontend/src/i18n/{hr,sl}/blok.ts` | Novi namespace, registrira se u `{hr,sl}/index.ts`. |
| Red čekanja (mreža) | `frontend/src/blok/BlokOutbox.tsx` + `components/useBlokHistoryUpload.ts` | §3.8. Montirano u `App.tsx`, jedanput, na svakoj stranici — prijava i povratak mreže događaju se izvan `/blok`. |
| Offline chunkovi | `frontend/vite.config.ts` (`bela-precache-manifest`) + `frontend/public/sw.js` | §3.8. Popis nosi hasheve, pa ga zna samo build; worker ga dohvaća jer se njegovi bajtovi ne mijenjaju. |

**Nijedan tekst se ne piše u komponentu** — svaki natpis je ključ u **oba**
rječnika (`hr` je izvor istine, `sl` se tipizira protiv njega, pa nedostajući
slovenski ključ ruši build namjerno). Brojivi pojmovi idu kroz `usePlural()` s
`.one/.two/.few/.other` — slovenski ima dvojinu.

Tema: samo semantički tokeni (`bg.panel`, `fg.muted`, `border.subtle`, `brand.*`).
Referenca je svijetla; naša aplikacija je po defaultu tamna i mora izgledati
namjerno u obje teme. Zelena/crvena strana: **ne** goli `green.*`/`red.*` bez
provjere kontrasta, i nikad boja kao jedini nositelj informacije.

---

## 5. API koji ostali agenti smiju pretpostaviti

```ts
// frontend/src/blok/store.ts
export function useBlok(): {
    game: BlokGame                     // uvijek postoji; nova prazna ako nema spremljene
    totals: Record<BlokSide, number>   // tekući zbroj
    perRound: RoundOutcome[]           // izračun po podjeli, isti redoslijed kao game.rounds
    winner: BlokSide | null
    calledCount: Record<BlokSide, number>

    /* Serija (§3.4). Oboje IZVEDENO iz partija te `sessionId`, nikad spremano.
       `seriesWinner` je uvijek null dok je serija otvorena
       (`game.seriesTarget === null`) — tada je zatvara samo „Nova igra”. */
    seriesWins: Record<BlokSide, number>
    seriesWinner: BlokSide | null

    addRound(round: Omit<BlokRound, "id">): void
    updateRound(id: string, round: Omit<BlokRound, "id">): void
    removeRound(id: string): void
    undoLast(): void
    rename(side: BlokSide, name: string): void
    setTarget(target: number): void
    setSeriesTarget(seriesTarget: number | null): void   // null = otvorena serija
    setGameEndRule(rule: "dosta" | "prolaz"): void       // §3.5; zadano "prolaz"
    /* Djelitelj i stol — §3.3.2. `setDealerSetup` je RUČNI odabir (`chosen:
       true`), `setDealDirection` je postavka koja ga ne smije prepisati:
       pod `chosen` drži trenutnog djelitelja, inače ponovno izvodi slijed. */
    setDealerSetup(setup: BlokDealerSetup): void           // { first, chosen }
    setDealDirection(direction: "right" | "left"): void    // zadano "right"
    setShowDealer(show: boolean): void                     // zadano true
    setShareEnabled(enabled: boolean): void                // §3.3.3; zadano true
    /* „Sljedeća partija” (§3.7): arhivira tekuću i otvara sljedeću u ISTOJ
       seriji. Više nije u izborniku — nudi se samo ispod dobivene partije. */
    newGame(): void
    discardCurrent(): void             // baci tekuću BEZ arhiviranja (v. §3.3)
    archive: BlokGame[]
    deleteArchived(id: string): void

    /* Serija i povijest — BLOK-HISTORY.md. Partije iste serije dijele
       `sessionId`; `newGame()` ga nasljeđuje, `resetSession` ga zatvara i
       vraća id zatvorene serije — to je izbornikova „Nova igra” (§3.7).
       `keepForUpload` = zadrži DOVRŠENE partije lokalno dok slanje na profil
       ne uspije; nedovršena tekuća se odbacuje (§5.6). */
    resetSession(keepForUpload: boolean): string
    /* Red čekanja, najstarija prva — to JE redoslijed slanja (§3.8). */
    pendingSessions: string[]
    /* Serije koje je server odbio zauvijek. Partije su i dalje u `archive`,
       ništa ih više neće pokušati poslati — `rejectSessionUpload`. */
    rejectedSessions: string[]

    /* Veza sa stolom na turniru — BLOK-LINK.md §3.2. */
    link: BlokLink | null
    setLink(link: BlokLink): void
    patchLink(patch: Partial<BlokLink>): void
    clearLink(): void

    /* Zapisnik ove serije na profilu i njegova poveznica — §3.6/§3.7,
       BLOK-HISTORY.md §5.1/§5.2. Kao `link`, ovo NIJE izvedeno: to je
       knjigovodstvo o razgovoru sa serverom (pod kojim je `uuid`-om serija
       spremljena, je li izdan token). Filtrirano na TEKUĆI `sessionId`;
       „Nova igra” ga briše jer serijom od tada upravlja profil. */
    share: BlokShare | null          // { sessionId, uuid, token: string | null }
    setShare(share: BlokShare): void
    clearShare(): void
}
```

Mreža ne živi u `store.ts` (on ne zna za `fetch`), nego u:

```ts
// frontend/src/blok/blokHistoryApi.ts
/* Filtrira partije kroz `isRecordableGame` i vrati `null` kad ne ostane
   nijedna — §3.7. Jedino mjesto na kojem se zapis sastavlja, pa se pravilo
   „nema pola partije u zapisu” ne može zaobići nijednim putem. */
buildSessionPayload(sessionId, games): BlokHistoryPayload | null
uploadBlokSession(payload): Promise<BlokHistoryRecord | null>  // { uuid, shareToken }
createBlokShare(uuid): Promise<string | null>                  // token, ili null
revokeBlokShare(uuid): Promise<void>
blokShareUrl(token): string                                    // /blok/z/{token}

// frontend/src/blok/components/useBlokHistoryUpload.ts
saveSessionNow(sessionId): Promise<BlokHistoryRecord | null>   // spremi SADA i zapamti `share`
useBlokHistoryUpload({ pendingSessions, enabled })             // tihi retry — v. §3.8

// frontend/src/blok/BlokOutbox.tsx   ← montiran u App.tsx, na SVAKOJ stranici
// Jedini montaž hooka iznad (§3.8). Ne renderira ništa; neprijavljenom ne radi
// ništa. `useBlokOutbox()` iz store.ts je njegov mršavi selektor.
```

`saveSessionNow` je **suprotnost** hooku u istoj datoteci: hook je tihi *retry*
za seriju koju je „Nova igra” već zatvorila, a ovo je radnja koju je korisnik
zatražio naglas i čeka odgovor — zato baca (pozivatelj kaže greškom u toastu),
vraća zapis (da dijeljenje zna koji `uuid` tražiti), i **ništa ne briše niti
dira `pendingSessions`**. Vraća `null` kad serija **nema nijednu dovršenu
partiju** (§3.7) — tada se nema što podijeliti i „Podijeli” to i kaže
(`share.nothing`), umjesto da poveznica pokaže pola partije. Odgovori se čitaju obrambeno (`shareToken` **ili**
`token`), jer se ovaj klijent i taj endpoint deployaju odvojeno: build u kojem
API još nema dijeljenje mora degradirati u „spremljeno, ne može se podijeliti”,
a ne pasti usred bloka.

Napomene uz `store.ts` (implementirano 2026-09-08), da se ne pogađa:
- `game.names` počinju **prazni** (`""`). Prazno ime znači „nema vlastitog” —
  zaslon tada prikazuje prijevod (`blok.side.us` / `blok.side.them`). Hard-kodirano
  „MI”/„VI” u modulu bilo bi tekst u kodu i zamrznulo bi hrvatsku riječ u
  spremljenoj igri slovenskog igrača. `rename(side, "")` vraća na prijevod.
- `winner` pod `"prolaz"` (zadano) se hoda podjelu po podjelu (§3.5). Pod
  `"dosta"` se računa iz **konačnih** zbrojeva: netko je `≥ target` i zbrojevi
  nisu izjednačeni. Izjednačenje na cilju nije pobjeda ni u jednom pravilu —
  igra se dalje. `finishedAt` prati `winner` u oba smjera: brisanje ili uređivanje
  podjele koja je odlučila igru — ili promjena pravila — vraća `finishedAt` na
  `null`.
- `newGame()` prenosi `target`, `seriesTarget`, `gameEndRule`, `names`,
  `showDealer`, `dealDirection` i `shareEnabled` u novu partiju (isti ljudi za
  istim stolom), a staru arhivira samo ako ima bar jednu podjelu. Arhiva je
  ograničena na 50 igara: neograničena bi jednom srušila kvotu, a neuspio upis
  gubi i **tekuću** igru.
- `isRecordableGame(game)` (izvezeno) je jedino mjesto koje kaže smije li
  partija u zapis: **ima podjela i ima pobjednika** (§3.7/§5.6). Čitaju ga
  `resetSession` i `buildSessionPayload`, i nitko treći — treći čitatelj bio bi
  treće mišljenje.

```ts
// game/packages/engine/src/manualScore.ts
export interface ManualDealInput {
    caller: "us" | "them"
    cards: { us: number; them: number }
    declarations: { us: number[]; them: number[] }
    stiglja: "us" | "them" | null
    /** §1.2. Neobavezno; odsutno = null (podjela zapisana prije belota). */
    belot?: "us" | "them" | null
    /** Bodovni cilj partije. OBAVEZAN točno kad je `belot` postavljen, inače
     *  se ne čita. */
    target?: number
}
export interface RoundOutcome {
    /** Konačni bodovi podjele nakon pravila pada — ili cilj, kod belota. */
    total: { us: number; them: number }
    /** Sastavnice, za prikaz u unosu: karte, zvanja, štiglja. Kod belota se
     *  prijavljuju, ali NIJEDNA nije u `total`. */
    cards: { us: number; them: number }
    declarations: { us: number; them: number }
    /** true kad je zvač pao. Kod belota uvijek false. */
    fell: boolean
}
export function scoreManualDeal(input: ManualDealInput): RoundOutcome
```

`store.ts` zato prosljeđuje cilj kroz izvedene funkcije:
`scoreRounds(rounds, target)`, a `totalsOf(game)` / `winnerOf(game)` ga uzimaju
iz same partije (arhivirana partija je možda igrana na drugi cilj).

---

## 6. Popis i18n ključeva (namespace `blok`)

`title`, `nav`, `seo.title`, `seo.description`,
`side.us`, `side.them`, `side.rename`, `side.renameTitle`,
`target.label` („DO”), `target.title`, `target.points` („Bodovi”),
`series.playTo`, `series.open`, `series.games` (plural),
`series.hint` (obrisan 2026-09-09), `series.badgeTarget`,
`dealer.first`, `dealer.next` (i natpis prekidača u „Postavke” — §3.3.2),
`dealer.self`, `dealer.rightOpponent`, `dealer.partner`, `dealer.leftOpponent`,
`dealer.direction`, `dealer.right`, `dealer.left`,
`series.sideAria`, `series.running`, `series.progress`, `series.won.us`,
`series.won.them`, `series.finish`,
`rule.title` („Igra se na”), `rule.dosta`, `rule.prolaz`,
`rule.dostaInline`, `rule.prolazInline` (za redak „DO 1001 · PROLAZ” — §3.4),
`round.addFor`, `round.calledBy`, `round.edit`, `round.delete`,
`round.undoLast`,
`entry.cards`, `entry.caller`, `entry.declarations`, `entry.stiglja`,
`entry.belot`, `entry.belotHint` (§1.2/§1.3 — riječ je i gumb i značka i
naslov čestitke, rečenica je objašnjenje u imenu gumba i ispod naslova),
`entry.fell`, `entry.sum`, `entry.save`, `entry.cancel`, `entry.clearChip`,
`entry.added` (plural), `entry.clearAll`, `entry.trump`, `entry.backspace`,
`entry.invalid`,
`winner.us`, `winner.them`, `winner.nextGame` („Sljedeća partija” — §3.7),
`summary.total`, `summary.points`, `summary.declarations`, `summary.stiglje`,
`menu.title`, `menu.newGame` (radnja koja ZATVARA seriju — §3.7),
`menu.target`, `menu.delete`,
`archive.empty`, `archive.pending` (plural), `archive.rejected` (plural — §3.8),
`confirm.deleteRound`, `confirm.deleteGame`,
`newGame.games` (plural), `newGame.confirmSignedIn`, `newGame.confirmSignedOut`,
`newGame.confirmNothing`, `newGame.confirmUnfinished`, `newGame.signedOutNote`,
`newGame.saved`,
`games.show`, `games.hide`, `games.showDeals`, `games.hideDeals`,
`share.action`, `share.again`, `share.nothing`, `share.failed`,
`share.stopped`, `share.stopFailed`, `share.enable` („Omogući dijeljenje” —
§3.3.3), `share.linkedNote`

Obrisani 2026-09-08 uz §5.6 iz `BLOK-HISTORY.md` („Nova igra” zatvara seriju,
„Resetiraj” je ukinut): `menu.reset` i cijela obitelj `reset.*`
(`reset.title`, `reset.confirm`, `reset.games.*`, `reset.confirmSignedIn`,
`reset.confirmSignedOut`, `reset.signedOutNote`, `reset.saved`) — zamjenjuju ih
`newGame.*` iznad; `winner.newGame` („Započni novu igru”, zamijenjen s
`winner.nextGame`); `newGame.body`, `newGame.saveAndStart`, `newGame.startOnly`
i `newGame.saveFailed` (dijaloga s tri ishoda više nema).

Obrisani 2026-09-08 uz §3.3.3: `share.stop` i `share.confirmStop` — stavku
izbornika „Prekini dijeljenje” zamijenio je prekidač `share.enable`, a potvrda
je `Spremi` u samom dijalogu.

Obrisani 2026-09-08 uz drugu reviziju (§3.3, zahtjev korisnika):
`target.custom` (polje „Vlastiti broj” je uklonjeno), `rule.dostaHint` i
`rule.prolazHint` (čipovi nose pravilo sami).

Obrisani 2026-09-08 uz §3.3.2 (zahtjev korisnika): `series.hintOpen`
(objašnjavao je pritisnuti gumb „Otvorena”), te `dealer.clockwise` i
`dealer.counterclockwise` — smjer se više ne imenuje rotacijom nego onako kako
se za stolom kaže (`dealer.right` / `dealer.left`).

Obrisani 2026-09-08 uz reviziju §5 iz `BLOK-HISTORY.md`: `menu.rename`,
`menu.archive`, `menu.share` (stavke su preseljene, v. §3.3), `share.text`
(dijeli se poveznica, ne rečenica — §3.6) i `confirm.newGame` („Nova igra” više
nije potvrda nego izbor — §3.7). `target.title` i `menu.target` sada glase
„Postavke”.

Imena boja aduta i ikonu preuzmi iz postojećeg (`game` namespace + `SuitGlyph`),
ne izmišljaj nove ključeve za herc/karo/pik/tref.
