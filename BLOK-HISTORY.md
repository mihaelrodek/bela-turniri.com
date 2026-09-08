# Povijest blokova na profilu — ugovor (2026-09-08)

Prijavljeni korisnik dobiva **povijest odigranih blokova na svom profilu**.
Sprema se **tek na „Resetiraj”**, i to cijela serija odjednom: sve partije koje
su se do tada odigrale i sve podjele unutar svake partije, sa zvanjima,
štigljama i adutima.

Primjer koji je zadao korisnik: serija je završila **4 : 3** → to je **jedan**
zapis u povijesti, a u njemu **sedam** partija, svaka sa svojim podjelama.

Blok bez prijave radi točno kao i dosad — bez ijednog zahtjeva. Povijest je
dodatak za prijavljene, ne uvjet.

---

## 1. Pojmovi (i zašto uvodimo treći)

| pojam | što je | gdje živi |
|---|---|---|
| **podjela** (`BlokRound`) | jedno „pisanje”: bodovi, zvanja, štiglja, adut, tko je zvao | već postoji |
| **partija** (`BlokGame`) | niz podjela do cilja (1001); ima pobjednika | već postoji |
| **serija** (`BlokSession`) | niz partija za istim stolom, npr. 4 : 3 | **novo** |

Danas „Nova igra” arhivira partiju lokalno i kreće sljedeća. To je već serija —
samo joj nedostaje ime. Zato **serija nije novi tok, nego identifikator**:
`BlokGame` dobiva `sessionId`, `newGame()` ga **prenosi**, a „Resetiraj” ga
zatvara i otvara novi.

---

## 2. Lokalno (frontend/src/blok)

### 2.1 Model

```ts
/** Sve partije s istim `sessionId` čine jednu seriju. */
BlokGame.sessionId: string        // OBAVEZNO, `crypto.randomUUID()`
```

- `emptyGame()` generira novi `sessionId` **samo** kad ga se ne naslijedi.
- `newGame()` **nasljeđuje** `sessionId` (ista serija, sljedeća partija) —
  kao što već nasljeđuje cilj i imena strana.
- `discardCurrent()` (Obriši igru) također zadržava `sessionId`.
- Stare spremljene igre nemaju to polje: pri učitavanju im se dodijeli jedan
  zajednički `sessionId` („zatečeno”), pa se ne gubi ništa i verzija
  `localStorage` ostaje **v1**. Bez migracije.

### 2.2 „Resetiraj” — novi postupak u izborniku

Uz postojeće „Nova igra” i „Obriši igru” dolazi **„Resetiraj”**:

1. tekuća partija, ako ima podjela, ide u arhivu;
2. sve partije te serije (arhiva + tekuća) šalju se na profil kao **jedan**
   zapis — samo ako je korisnik prijavljen;
3. serija se lokalno zatvara: novi `sessionId`, prazna tekuća partija,
   a partije te serije se brišu iz lokalne arhive tek **nakon potvrđenog
   slanja**.

Potvrda kroz `ConfirmDialog` (nikad `confirm()`), s jasnim tekstom o tome što
se sprema i što se briše.

**Neprijavljen korisnik**: „Resetiraj” radi lokalno (zatvori seriju, očisti),
uz jednu rečenicu da se povijest sprema samo prijavljenima. Ne otvara se
prijava na silu.

**Offline / neuspjelo slanje**: serija se **ne briše** lokalno. Označi se kao
„čeka slanje” i pokuša ponovno pri sljedećem otvaranju bloka ili povratku
mreže. Bolje dvaput poslana serija (server dedupira po `sessionId`) nego
izgubljena.

### 2.3 Što se šalje

```ts
POST /user/me/blok-history
{
  sessionId: string,            // idempotencija: isti id = isti zapis
  target: number,
  names: { us: string, them: string },   // "" = prijevod (MI / VI)
  startedAt: number, finishedAt: number, // epoch ms
  games: [{
    id: string,
    createdAt: number, finishedAt: number | null,
    target: number,
    winner: "us" | "them" | null,
    totals: { us: number, them: number },
    rounds: [{
      caller: "us" | "them",
      cards: { us: number, them: number },
      declarations: { us: number[], them: number[] },
      stiglja: "us" | "them" | null,
      trump: "HERC" | "KARA" | "PIK" | "TREF" | null
    }]
  }]
}
```

`winner` i `totals` računa **klijent** kroz `scoreManualDeal` (isti engine koji
crta ekran) i šalju se izračunati, da povijest prikazuje točno ono što je igrač
vidio za stolom.

---

## 3. Backend

### 3.1 Tablica `blok_sessions`

| stupac | tip | napomena |
|---|---|---|
| `id` | bigint PK | sekvenca `seq_blok_sessions_id` |
| `uuid` | uuid unique | u API-ju |
| `session_id` | varchar(64) | klijentov id serije |
| `user_uid` | varchar(64) | vlasnik |
| `started_at`, `finished_at` | timestamptz | |
| `target` | int | |
| `name_us`, `name_them` | varchar(60) | prazno = prijevod |
| `games_us`, `games_them` | int | **rezultat serije, npr. 4 i 3** |
| `games_count` | int | |
| `payload` | jsonb | pune partije i podjele |
| `created_at` | timestamptz | |

**Unique `(user_uid, session_id)`** — ponovno slanje iste serije (retry nakon
prekida veze) je **200 s postojećim zapisom**, ne duplikat.

Zašto `jsonb` a ne tri normalizirane tablice: zapis se piše jednom, čita cijeli,
i nikad se ne pretražuje po polju unutar podjele. Sažetak koji lista treba
(`games_us/them`, `target`, datumi, imena) stoji u stupcima, pa popis povijesti
ne dira `payload`. Normalizacija bi ovdje dodala tri tablice i nula upita.

Liquibase: novi `db/changelog/blok_sessions.xml`, changeset
`2026-09-08-blok-sessions`, autor `mrodek`, `<preConditions onFail="MARK_RAN">`
+ `<rollback>`, `<include>` **na kraj** `changelog-master.xml`.

### 3.2 Endpointi — svi `@Authenticated`, pod `/user/me/blok-history`

| metoda | putanja | što |
|---|---|---|
| `POST` | `/user/me/blok-history` | spremi seriju; idempotentno po `sessionId` |
| `GET` | `/user/me/blok-history?limit=&offset=` | sažeci, najnoviji prvi, **bez `payload`** |
| `GET` | `/user/me/blok-history/{uuid}` | puni zapis s partijama i podjelama |
| `DELETE` | `/user/me/blok-history/{uuid}` | obriši vlastiti zapis |

Vlasništvo se provjerava **uvijek** po `currentUser.requireUid()`; tuđi `uuid`
vraća **404**, ne 403 (ne otkrivaj da zapis postoji).

### 3.3 Granice (ulaz je korisnički JSON — tretiraj ga kao takav)

Odbij s 400 (`errors/ApiCodes.badRequest`):
- više od **50 partija** u seriji ili više od **300 podjela** u partiji;
- `payload` veći od **256 KB** nakon serijalizacije;
- **bodovi jedne podjele** (`cards.us` / `cards.them`) i **svako pojedino
  zvanje** koji nisu cijeli brojevi u `0..1000`;
  — ISPRAVAK 2026-09-08: ova granica vrijedi **po podjeli**, ne za `totals`
  partije. Partija se igra do 1001, pa svaka odigrana partija ima ukupno
  ≥ 1001 i granica od 1000 odbila bi svaku normalnu seriju. `totals` ima
  samo zaštitu od besmislice (`0..1 000 000`), `target` `1..100 000`;
- `sessionId` dulji od 64 znaka ili prazan.

Ovo je **osobni zapisnik**, ne izvor istine ni za što drugo: ne ulazi u
turnirske rezultate, ne dira `Matches`, ne utječe na statistiku igrača. Zato se
brojevi ne preračunavaju na serveru (pravila bodovanja žive u TypeScript
engineu i portanje u Javu bi stvorilo drugi izvor istine). Ograničenja su tu
zbog veličine i besmislica, ne zbog povjerenja u rezultat.

---

## 4. Profil (frontend)

Nova sekcija **„Blok”**, vidljiva **samo vlasniku profila**, po uzoru na
`predlosci` / `racuni`: dodaj ključ u `pages/profile/sections.ts` i karticu u
`pages/profile/`. **Ne prikazuje se na tuđem profilu** — ovo je privatni
zapisnik i nema ga na javnoj stranici.

- **Popis serija**: datum, rezultat velikim brojem (`4 : 3`), imena strana,
  cilj, broj partija. Brisanje kroz `ConfirmDialog`.
- **Otvorena serija**: partije jedna ispod druge (`1. partija — 1012 : 786`),
  a unutar partije **sve podjele**: tko je zvao, bodovi obje strane, zvanja
  (pojedinačno, npr. `20 + 50`), štiglja, adut (`SuitGlyph`), oznaka PAD.
- Prazno stanje kroz `components/EmptyState.tsx`.

Dohvat kroz `useQuery` s ključem u `qk` registru (`queryClient.ts`), i **izuzmi
ga iz trajnog localStorage keša** (`NON_PERSISTED_KEY_ROOTS`) — kao `blokLinks`.

Svaki natpis je ključ u **oba** rječnika. Brojivi pojmovi (partije, podjele)
kroz `usePlural()` — slovenski ima dvojinu.

---

## 5. REVIZIJA 2026-09-08 — spremanje, dijeljenje, izbornik

Korisnik je nakon prve verzije prošao tok na telefonu i promijenio model.
Ovo poglavlje ima prednost nad §2.2 i §4 gdje se razilaze.

### 5.1 Spremanje je izbor pri „Novoj igri”, ne skrivena posljedica

> **ZAMIJENJENO §5.6 (2026-09-08, treća revizija) — pročitaj §5.6 prvo.**
> Dijalog s tri ishoda opisan ovdje **ne postoji više**: „Nova igra” od §5.6
> **zatvara seriju** (spremi na profil, rezultat serije na 0:0, prazan blok), pa
> nema što ponuditi kao izbor — pita se jednom, kroz `ConfirmDialog`. Ono što
> iz ovog odjeljka **ostaje na snazi** je zadnji dio: obećanje da spremanje
> nikad ne briše ništa lokalno prije potvrde, i **zahtjev prema backendu** da
> `POST` bude upsert (v. dolje). Prijelaz na prijavu (`?radnja=spremi-novu`) je
> uklonjen — neprijavljenom „Nova igra” radi lokalno i jednom to kaže.

*(povijesno, zamijenjeno)* Dijalog **„Nova igra”** više ne govori da će se nešto
„spremiti u arhivu”. Nudi dvije radnje i odustajanje:

| radnja | što se dogodi |
|---|---|
| **Spremi i započni novu** | cijela serija (sve partije te `sessionId`) ode na profil, pa počinje nova partija u **istoj** seriji |
| **Započni bez spremanja** | nova partija, ništa ne ide na server |
| Odustani | ništa |

**Neprijavljen korisnik koji odabere „Spremi” vodi se na prijavu** i nakon nje
se radnja dovršava; „Započni bez spremanja” radi i bez računa. Ovo je jedino
mjesto (uz dijeljenje) gdje blok traži račun.

**Posljedica za backend — OBAVEZNO, i vrijedi i dalje:** `POST
/user/me/blok-history` nije „upiši jednom”. Ista serija se šalje **više puta** —
„Podijeli” je sprema dok se još igra, a povezan stol pri svakoj promjeni
rezultata (BLOK-LINK.md §6.2) — pa sukob na `(user_uid, session_id)` mora
**dopuniti postojeći zapis** (partije, `games_us/them`, `games_count`,
`finished_at`, imena, cilj), a ne ga preskočiti. `uuid` i `created_at` se
pritom **ne mijenjaju** — dijeljena poveznica mora preživjeti dopunu.

### 5.2 Dijeljenje zapisnika poveznicom

Gumb **„Podijeli”** seli iz izbornika u **gornji lijevi kut kartice s
rezultatom** (dijeljenje je česta radnja i ne pripada u izbornik s postavkama).

Dijeli se **poveznica na zapisnik**, ne tekst:

- serija se najprije spremi (v. 5.1), pa server izda **token za dijeljenje**;
- token je zaseban nasumičan niz, **ne** `uuid` zapisa — zapisi postoje bez
  pristanka na dijeljenje i pogađanje `uuid`-a ne smije ništa otkriti;
- javna putanja: **`/blok/z/{token}`**, bez prijave, **samo za čitanje**;
- vlasnik može **prekinuti dijeljenje** (token se poništi, poveznica prestaje
  raditi);
- javna stranica pokazuje isto što i profil: rezultat serije, partije i sve
  podjele sa zvanjima, štigljom i adutom. **Ne pokazuje tko je vlasnik zapisa**
  — samo imena strana koja je korisnik sam upisao.

Backend: `share_token varchar(48) unique null` na `blok_sessions`,
`POST /user/me/blok-history/{uuid}/share` (izda ili vrati token),
`DELETE /user/me/blok-history/{uuid}/share` (poništi),
`GET /blok-share/{token}` — **javno, bez `@Authenticated`**, vraća isti oblik
kao detalj iz §3.2 minus sve o vlasniku. Token generira `services/ClaimTokens`
(već postoji, `SecureRandom`). Liquibase changeset
`2026-09-08-blok-session-share`.

### 5.3 Izbornik se skraćuje

> **DOPUNJENO §5.6 (2026-09-08, treća revizija).** Zadnja dva retka ove tablice
> više ne vrijede: **„Resetiraj” je uklonjen** (njegovo značenje je preuzela
> „Nova igra”), a **„Prekini dijeljenje”** je iz izbornika prešao u „Postavke”
> kao prekidač **„Omogući dijeljenje”** (zadano uključen — BLOK.md §3.3.3).
> Konačan izbornik je: **Nova igra · Postavke · Poveži sa stolom · Obriši igru**.

| prije | sad |
|---|---|
| Nova igra | ostaje — ali od §5.6 **zatvara seriju** |
| Preimenuj strane | **uklonjeno** — imena se mijenjaju olovkom ispod rezultata |
| Promijeni cilj | **Postavke** (bodovi, dosta/prolaz, igra se do, dogovori o dijeljenju karata, „Omogući dijeljenje”) |
| Odigrane partije | **uklonjeno** — v. 5.4 |
| Podijeli sažetak | **uklonjeno iz izbornika** — gumb u kartici, v. 5.2 |
| Poveži sa stolom | ostaje |
| Obriši igru | ostaje |
| Prekini dijeljenje | **uklonjeno iz izbornika** — prekidač u „Postavke” (§5.6) |
| Resetiraj | **uklonjeno** — v. 5.6 |

### 5.4 Odigrane partije žive u kartici, ne u dijalogu

Ispod crte koja dijeli dva rezultata stoji **strelica prema dolje**. Klik
proširi karticu i pokaže **završene partije te serije** (rezultat i datum).
Klik na partiju otvara **njezine podjele** — isti prikaz kao u povijesti na
profilu.

Time nestaje razlika „lokalna arhiva vs profil” koja je korisnika zbunila:
kartica pokazuje **tekuću seriju**, profil čuva **spremljene serije**.

### 5.5 REVIZIJA 2026-09-08 (druga) — pravilo kraja putuje, i „Do 1001”

**Zadano pravilo kraja partije je `prolaz`, ne `dosta`.** Odluka korisnika.
Partija spremljena bez tog polja čita se kao **`prolaz`**.

**Pravilo mora biti u zapisu.** Dvije partije s istim podjelama imaju različitog
pobjednika ovisno o pravilu, pa spremljeni `winner` bez njega nije provjerljiv —
ni na profilu ni na dijeljenoj poveznici. Zato:

- `BlokGame.gameEndRule` ulazi u payload iz §2.3 (`"dosta" | "prolaz"`);
- `blok_sessions` dobiva `game_end_rule varchar(8)` (zadano `'prolaz'`) za
  sažetak koji lista treba, uz `payload` gdje je po partiji;
- svi DTO-ovi iz §3.2 i javni iz §5.2 ga nose.

**Natpis svugdje u aplikaciji:** umjesto „Cilj 1001” piše **„Do 1001 · prolaz”**
(odnosno `· dosta`). Vrijedi za karticu bloka, povijest na profilu i dijeljeni
zapisnik. U dijeljenom zapisniku **nestaje „N partija”** iz tog retka — broj
partija se ionako vidi ispod.

### 5.6 REVIZIJA 2026-09-08 (treća) — „Nova igra” JE zatvaranje serije

Korisnik: *„Nova igra bi trebalo staviti rezultate na 0:0 i one trenutne igre
spremiti (osim ako partija nije dovršena onda se ona ne sprema), tako da bi ono
trebalo raditi kao resetiraj”.*

Time **„Resetiraj” nestaje** — bila je to ista radnja pod drugim imenom.

| radnja | gdje | što radi |
|---|---|---|
| **Nova igra** | izbornik | zaključi **seriju**: spremi na profil, rezultat serije na **0:0**, nova prazna partija |
| **Sljedeća partija** | sažetak, kad je partija dobivena | sljedeća partija **unutar** serije — rezultat serije se nastavlja (2:1) |
| **Obriši igru** | izbornik | baci podjele tekuće partije, serija ostaje |

**Nedovršena partija se ne sprema.** Kad se serija zatvara, u zapis idu samo
partije koje imaju pobjednika; tekuća partija bez pobjednika se odbacuje
zajedno s ostatkom. Zapis serije tako nikad ne sadrži pola partije.

Spremanje na profil (§5.1) i dalje traži prijavu; neprijavljenom korisniku
„Nova igra” radi lokalno i jednom kaže da se povijest čuva prijavljenima.

#### 5.6.1 Kako je to izvedeno (implementirano 2026-09-08)

**Pravilo živi na JEDNOM mjestu:** `store.ts → isRecordableGame(game)` =
„ima podjela **i** ima pobjednika”. Pobjednik je `winnerOf`, dakle **izveden
uživo** po pravilu te partije (§5.5), nikad spremljena zastavica: partija kojoj
je odlučujuća podjela naknadno izmijenjena prestaje biti dovršena — i time
prestaje biti zapisiva — u istom kadru.

Koristi ga **točno dvoje**:

- `resetSession(keepForUpload)` — tekuća partija se arhivira **samo** ako je
  zapisiva; sve ostalo te serije se briše. Ako nakon toga nema nijedne zapisive
  partije, `pendingSessions` **ne dobiva biljeg** — nema se što slati i nema
  čega da se vječno pokušava.
- `blokHistoryApi.ts → buildSessionPayload` — filtrira `games` prije slanja i
  vraća `null` kad ne ostane nijedna. Filtar je **ovdje**, na jedinom mjestu
  gdje se zapis sastavlja, pa ga poštuju sva tri puta do profila: zatvaranje
  serije, tihi retry i **„Podijeli”** (koji sprema prije nego zatraži token).
  Da je filtar bio samo u `store.ts`, dijeljenje bi poslalo partiju koja se još
  igra — a `POST` je upsert, pa bi ta polovica partije sjela točno u zapis koji
  zatvaranje tek treba dovršiti.

**Serija čija je JEDINA partija nedovršena — ODLUKA:** ne šalje se **ništa** i
ne ostaje **ništa**. `buildSessionPayload` vrati `null`, `resetSession` ne
zadrži nijednu partiju i ne upiše biljeg, pa nema ni zapisa na profilu ni
retryja koji bi ga jednom napravio. Zapis od nula partija bio bi redak u
povijesti koji ne govori ništa, a zadržana polovica partije bila bi upravo ono
što §5.6 zabranjuje — samo odgođeno.

**Potvrda (`ConfirmDialog`, nikad `confirm()`)** kaže oboje: **što se sprema** i
**da rezultat serije ide na 0:0**. Tri rečenice, ne jedna s ogradom
(`newGame.confirmSignedIn` / `confirmSignedOut` / `confirmNothing`), plus
`confirmUnfinished` kao zasebna rečenica kad uz dovršene partije stoji i
nedovršena tekuća. Broj partija ide kroz `usePlural()` (`newGame.games`).
Gumb potvrde **nije crven**: radnja prvo **sprema**.

Obrisani ključevi: `menu.reset`, `reset.*` (cijela obitelj), `winner.newGame`,
`newGame.body`, `newGame.saveAndStart`, `newGame.startOnly`,
`newGame.saveFailed`. Obrisana komponenta: `components/NewGameDialog.tsx`.
Uklonjen je i povratak s prijave za tu radnju (`?radnja=spremi-novu`);
`?radnja=podijeli` ostaje.

### 5.7 REVIZIJA 2026-09-08 (četvrta) — zapisnik se osvježava u stvarnom vremenu

Korisnik: *„kad dodam, obrišem ili nešto na bloku, to mora se u realnom vremenu
odmah vidjeti … ne treba nikakav reload … tako kod mene a tako i na shareanom
linku”*, i izričito: **novi websocket**, ne prozivanje.

Tri različita problema, ne jedan:

1. **Vlastiti ekran** je već trenutan (`useBlok` je store s pretplatnicima).
2. **Druga kartica istog preglednika** — riješi `window`ov `storage` događaj,
   koji se okida u SVIM ostalim karticama iste domene; `store.ts` već ima
   `notify()` na koji se to zakvači.
3. **Dijeljena poveznica** — dvije stvari moraju vrijediti zajedno:
   - blok **šalje na svaku promjenu** dok je dijeljenje (ili veza sa stolom)
     živo, prigušeno (~1,5 s), kroz isti idempotentni `POST /user/me/blok-history`;
   - gledatelj dobiva **ping preko websocketa** i sam ponovno dohvati zapis.

#### Websocket

Putanja: **`/live/blok/{token}`** na backendu, javno **`/ws/live/blok/{token}`**.
Caddy već generički prosljeđuje `/ws/*` na `/api/*` (`handle_path /ws/*`), a
Vite proxy radi isto u devu — **nije potrebna nijedna izmjena u Caddyju**.

Ista pravila kao `realtime/LiveSocket.java`:
- **bez autentikacije i bez podataka u poruci** — okvir je samo „osvježi”, a
  svako čitanje ide kroz javni `GET /blok-share/{token}`, koji već sam provjerava
  vrijedi li token. Token u putanji je ista tajna koja je i u URL-u poveznice;
  ništa se novo ne otkriva.
- ping se šalje **nakon commita** (interponirani JTA `Synchronization`), kao
  `LiveBroadcaster`;
- poništen token = poveznica prestaje raditi i socket se zatvara; klijent to
  vidi kao 404 na sljedećem dohvatu i pokazuje već postojeći „ova poveznica više
  ne radi” ekran.

Prozivanje ostaje samo kao **rezerva** kad socket nije spojen, kao što
`useTournamentData` već radi uz `useLiveSocket`.
