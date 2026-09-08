# Poveži blok sa stolom — ugovor (2026-09-08)

Igrač za stolom vodi **bela blok** (`frontend/src/blok/`, lokalno, bez prijave).
Ako se taj stol igra na turniru, blok se može **povezati sa stolom u aktivnoj
rundi**, pa rezultat koji igrač upisuje sam stiže organizatoru u zapisnik.

**Organizator mora odobriti povezivanje prije nego išta uđe u zapisnik.** Bez
odobrenja bilo tko bi mogao pisati tuđi rezultat.

Ovaj dokument je ugovor: backend, blok i organizatorov ekran grade se prema
njemu i nijedna strana ga ne mijenja sama.

---

## 1. Što se s čim spaja

- **Stol = `Matches`.** `Matches.tableNo` je broj stola, jedinstven unutar runde
  (`uq_table_per_round`). Meč već ima globalno jedinstven `id`, i to je ono što
  putuje kroz API — `tableNo` je samo za prikaz čovjeku.
- **Runda** mora biti nezavršena: `Rounds.status != COMPLETED`. Nema zastavice
  „aktivna runda”; aktivna je ona s najvećim `number` koja nije `COMPLETED`.
- **Turnir** mora biti `DRAFT` ili `STARTED`. (`UPCOMING` ne postoji — stanje
  prije početka zove se `DRAFT`.) `FINISHED` ne prima ništa.
- **Meč mora imati oba para** (`pair2 != null`); BYE se ne povezuje.

### Koja strana je koji par
Blok zna samo `us` / `them`. Meč zna `pair1` / `pair2`. **Kod slanja zahtjeva
igrač bira koji je par njegova strana** (`usPairId`), i to se sprema na vezu.
Bez toga organizatoru stiže broj bez naznake kome pripada. Mapiranje se poslije
ne mijenja — tko je pogriješio, prekida vezu i traži novu.

---

## 2. Backend

### 2.1 Entitet `MatchScoreLink` → tablica `match_score_links`

| stupac | tip | napomena |
|---|---|---|
| `id` | bigint PK | sekvenca `seq_match_score_links_id`, kao ostali entiteti |
| `uuid` | uuid, unique | ono što putuje u API-ju; `@PrePersist` kao na `Tournaments` |
| `match_id` | bigint FK → `matches(id)`, `ON DELETE CASCADE` | |
| `tournament_id` | bigint FK → `tournaments(id)`, `ON DELETE CASCADE` | denormalizirano zbog upita „sve veze ovog turnira” |
| `us_pair_id` | bigint FK → `pairs(id)` | koji je par igračeva strana |
| `status` | varchar(16) | `PENDING` / `APPROVED` / `REJECTED` / `REVOKED` |
| `requested_by_uid` | varchar(64) | Firebase UID podnositelja |
| `requested_by_name` | varchar(120) | ime u trenutku zahtjeva, za prikaz |
| `created_at` | timestamptz | |
| `decided_at` | timestamptz null | |
| `decided_by_uid` | varchar(64) null | tko je odobrio/odbio |

**Najviše jedna aktivna veza po meču**: parcijalni unique indeks na `match_id`
`WHERE status IN ('PENDING','APPROVED')`. Drugi zahtjev za isti stol dobiva
409 `LINK_EXISTS`.

Liquibase: novi `db/changelog/blok_match_links.xml` + `<include>` **na kraj**
`changelog-master.xml`. Changeset id `2026-09-08-blok-match-links`, autor
`mrodek`, s `<preConditions onFail="MARK_RAN">` i `<rollback>` kao u
`tournament_waiter_multi.xml`.

### 2.2 Endpointi

Svi pod `/api`, JSON, `ApiError` omotnica kao i ostatak.

| metoda | putanja | tko | što |
|---|---|---|---|
| `GET` | `/blok-links/targets?tournament={uuidOrSlug}` | `@Authenticated` | stolovi u aktivnoj rundi koji se mogu povezati: `matchId`, `tableNo`, `roundNumber`, `pair1{id,name}`, `pair2{id,name}`, `linkable` + razlog kad nije |
| `POST` | `/blok-links` | `@Authenticated` | zahtjev: `{ matchId, usPairId }` → veza u `PENDING` |
| `GET` | `/blok-links/mine` | `@Authenticated` | veze podnositelja (za blok: status, stol, imena parova) |
| `DELETE` | `/blok-links/{uuid}` | podnositelj **ili** organizator | prekid veze → `REVOKED` |
| `GET` | `/tournaments/{idOrSlug}/blok-links` | organizator/admin | sve veze turnira, `PENDING` prve |
| `POST` | `/tournaments/{idOrSlug}/blok-links/{uuid}/approve` | organizator/admin | → `APPROVED` |
| `POST` | `/tournaments/{idOrSlug}/blok-links/{uuid}/reject` | organizator/admin | → `REJECTED` |
| `PUT` | `/blok-links/{uuid}/score` | **samo podnositelj odobrene veze** | `{ us: int, them: int, final: boolean }` |

Organizatorski endpointi idu kroz `access.loadForEdit(idOrSlug)`
(`TournamentAccess`), točno kao `approvePair`. Ne uspoređuj `jwt.getSubject()`
ručno.

Kodovi grešaka (bare string, `errors/ApiCodes`, SPA ih uspoređuje doslovno):
`LINK_EXISTS`, `LINK_NOT_APPROVED`, `ROUND_COMPLETED`, `TOURNAMENT_FINISHED`,
`MATCH_HAS_BYE`, `PAIR_NOT_IN_MATCH`.

### 2.3 Upis rezultata — NORMATIVNO

Ovo je jedino mjesto gdje netko tko nije organizator piše u meč, pa su pravila
uska:

1. Veza mora biti `APPROVED`, pozivatelj mora biti `requested_by_uid`.
   Inače 409 `LINK_NOT_APPROVED` (ne 403 — veza možda postoji, ali nije njegova
   za pisanje).
2. Runda ne smije biti `COMPLETED`, turnir ne smije biti `FINISHED`. Ako jest,
   veza se **automatski gasi** (`REVOKED`) i vraća se 409.
3. `us`/`them` se preslikavaju preko `us_pair_id` u `score1`/`score2` prema
   `pair1`/`pair2` mečа.
4. **`final: false` je PRIVREMENI rezultat**: upisuje se `score1`/`score2`, ali
   meč **ostaje `SCHEDULED`**, `winnerPair` ostaje `null`, statistika parova se
   NE dira i nitko se ne eliminira. Ovo je bitno: postojeći
   `RoundService.updateMatchScore` proglašava meč `FINISHED` čim se dva različita
   broja upišu — a blok tijekom igre šalje rezultat koji se još mijenja. Kad bi
   išao kroz taj put, par bi bio eliminiran nasred partije, a runda bi se mogla
   sama zaključiti.
5. **`final: true` ide kroz postojeći `RoundService.updateMatchScore`**, sa svime
   što on radi (pobjednik, statistika, eliminacija, obavijest gubitniku,
   auto-završetak runde, broadcast). Ne prepisuj tu logiku — pozovi je.
6. Oba puta na kraju rade `broadcast(t, LiveBroadcaster.SCOPE_MATCH)`.
   **Ne uvodi novi scope**: frontend ionako na svaki ping osvježi sve, a novi
   scope traži i izmjenu bijelog popisa u `LiveBroadcaster`.

### 2.4 Obavijesti

- Novi zahtjev → push **organizatoru** (`t.createdByUid`), preko
  `pushService.sendToUser(uid, locale -> payload)` s **primateljevim** jezikom
  (`MessageService.t(locale, key)`), po uzoru na `TournamentPairService.approve`.
  Poveznica vodi na ždrijeb turnira.
- Odluka (odobreno/odbijeno) → push **podnositelju**, istim putem.
- Ključevi u `messages_hr.properties` i `messages_sl.properties`, isti skup
  ključeva u oba.

---

## 3. Blok (frontend)

### 3.1 Ovo je prvi mrežni kod u `blok/`

Dosad je ugovor bio „bez servera, bez prijave” (`BLOK.md`). Povezivanje to ne
ukida:

- **Blok bez prijave radi u cijelosti.** Povezivanje je jedina stvar koja traži
  prijavu, i nudi se tek kad je korisnik prijavljen; inače stavka izbornika vodi
  na prijavu i objašnjava zašto.
- **Upis podjele nikad ne čeka mrežu.** Lokalno se sprema odmah; slanje je
  posljedica, ne uvjet. Neuspjelo slanje je stanje na ekranu, ne niz toastova.
- Nema odobrene veze → nijedan zahtjev ne izlazi iz uređaja.

### 3.2 Stanje

`BlokGame` dobiva neobavezno polje:

```ts
export interface BlokLink {
    uuid: string
    status: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED"
    tournamentUuid: string
    tournamentName: string
    roundNumber: number
    tableNo: number | null
    matchId: number
    usPairId: number
    usPairName: string
    themPairName: string
    /** Zadnji uspješno poslani rezultat, da se isto ne šalje dvaput. */
    syncedTotals: { us: number; them: number } | null
    /** Epoch ms zadnjeg neuspjelog pokušaja; null kad je sve poslano. */
    pendingSince: number | null
}
```

`BlokGame.link?: BlokLink`. Polje je **neobavezno**, pa `BlokStorageV1` ostaje
verzija 1 i stare spremljene igre se učitavaju bez migracije.

### 3.3 Slanje

- Nakon svake promjene podjela, ako je veza `APPROVED`: pošalji tekuće zbrojeve
  s `final: false`. Prigušeno (debounce ~1,5 s) — igrač zna tipkati u rafalu.
- Kad `winner !== null` (netko dosegao cilj): pošalji `final: true`.
- Ako se zbroj nije promijenio od `syncedTotals`, ne šalji ništa.
- Neuspjeh (offline, 5xx): zapamti `pendingSince`, pokušaj ponovno kad se
  aplikacija vrati u prvi plan ili na sljedeću promjenu. Ne diraj lokalne
  podatke.
- 409 `ROUND_COMPLETED` / `TOURNAMENT_FINISHED` / `LINK_NOT_APPROVED`: veza se
  gasi lokalno u `REVOKED` i korisniku se to kaže jednom.

### 3.4 Ekran

Stavka izbornika **„Poveži sa stolom”**, pa u tri koraka: turnir (samo `DRAFT`
i `STARTED`) → stol u aktivnoj rundi → koja strana je koji par. Nakon slanja
zahtjeva zaglavlje bloka nosi traku sa stanjem: „Čeka odobrenje”, „Povezano:
Runda 3 · Stol 4”, ili razlog prekida. Iz trake se veza prekida.

---

## 4. Organizatorov ekran

Zahtjevi za povezivanje idu u **Ždrijeb** (`BracketSection`), jer je veza uvijek
o stolu u rundi i organizator tamo ionako gleda. Vizualni jezik je već postavljen
u `PairsSection` za parove koji čekaju odobrenje (žuta grupa iznad ostalog,
brojač u naslovu, gumb za odobravanje u retku) — preslikaj ga, ne izmišljaj
novi.

Svaki redak: tko traži, koji stol, koji par je njegova strana, gumbi **Odobri** /
**Odbij**. Odobrena veza se vidi na retku mečа, s mogućnošću prekida.

---

## 5. Što ovaj ugovor NAMJERNO ne radi

- **Ne uvodi članstvo korisnika u paru.** Danas par ima najviše dva UID-a
  (`submittedByUid`, `coSubmittedByUid`), a par koji je unio organizator nema
  nijedan. Zato zahtjev smije poslati **bilo koji prijavljeni korisnik**, a
  obrana je odobrenje organizatora — ne pripadnost paru.
- **Ne sprema podjele na server.** `Matches` ima dva cijela broja i ništa za
  pojedinu podjelu. U zapisnik ide zbroj; detalj ostaje na telefonu.
- **Ne mijenja postojeće endpointe za rezultat.** Organizator i dalje piše
  rezultat kao i dosad; veza je dodatni put do istog polja.

---

## 6. REVIZIJA 2026-09-08 — u zapisnik ide rezultat SERIJE, i javni zapisnik

Nakon prve verzije korisnik je vidio kako to izgleda u ždrijebu i promijenio
dvoje. Ovo poglavlje ima prednost nad §2.3 gdje se razilaze.

### 6.1 `{us, them}` su DOBIVENE PARTIJE, ne bodovi

Meč na turniru se vodi kao **2:0, 2:1** — koliko je partija koja strana dobila —
a ne kao zbroj bodova (`543 : 149`). Bodovi su unutarnja stvar zapisnika.

- `PUT /blok-links/{uuid}/score` prima `{ us, them }` = **broj dobivenih partija
  u toj seriji**, i to se preslikava u `score1`/`score2` mečа.
- Privremeni upis (`final: false`) šalje se kad god se rezultat serije promijeni
  (dakle na kraju svake partije), ne na svaku podjelu.
- `final: true` kad je serija odlučena: dosegnut je zadani broj dobivenih, ili
  je korisnik zaključio seriju („Nova igra” — v. BLOK-HISTORY.md §5.6, koja je
  preuzela tu ulogu od nekadašnjeg „Resetiraj”).

### 6.2 Zapisnik povezanog stola je JAVAN

Povezivanjem sa stolom igrač pristaje da zapisnik bude javan — organizator i
svatko tko dobije poveznicu mora ga moći otvoriti, i nakon turnira.

- `MatchScoreLink` dobiva `session_id varchar(64)` — koju seriju blok šalje.
  Klijent ga pošalje pri zahtjevu (`POST /blok-links`) i uz svaki upis
  rezultata.
- Kad server upisuje rezultat za odobrenu vezu, **osigura token za dijeljenje**
  za tu seriju (`blok_sessions.share_token`, BLOK-HISTORY.md §5.2) ako ga još
  nema. Povezivanje je pristanak; token se ne izdaje ni za jednu seriju koja
  nije povezana ili sama podijeljena.
- DTO veze (`BlokLinkDto`) nosi `shareToken` (ili `null` dok serija još nije
  spremljena), pa ždrijeb prikaže poveznicu `/blok/z/{token}`.
- Poveznica u ždrijebu stoji u retku mečа, uz oznaku povezanog bloka.

Posljedica za blok: dok je veza odobrena, serija se **sprema pri svakoj
promjeni rezultata** (isti idempotentni `POST /user/me/blok-history`), jer bez
spremljene serije nema ni zapisnika ni poveznice. Prijava je ionako uvjet za
povezivanje.

---

## 7. REVIZIJA 2026-09-08 (druga) — povezivanje bez obavezne prijave

Korisnik: *„povezivanje bloka sa stolom ne treba nužno prijavu, samo jasno
označi da se ovo koristi samo na turnirima”.* Prijava prestaje biti uvjet.

### 7.1 Čime se onda dokazuje pravo pisanja

Prijava je dosad služila jednoj stvari: da server zna **tko** smije pisati u
taj meč. Bez nje tu ulogu preuzima **tajna vezanog uređaja**, po uzoru na
konobarske sesije koje ovaj projekt već ima:

- `POST /blok-links` **više nije `@Authenticated`**. Odgovor **jednom** vraća
  `writeToken` (32 znaka, `services/ClaimTokens`), koji klijent sprema uz vezu.
- `PUT /blok-links/{uuid}/score` prihvaća **ili** prijavljenog podnositelja
  (`requested_by_uid`, kako je i dosad) **ili** ispravan `writeToken`. Kriv ili
  odsutan token bez prijave = 401.
- `GET /blok-links/{uuid}` s tokenom vraća stanje te veze, da neprijavljeni
  klijent može vidjeti je li odobrena. `GET /blok-links/mine` ostaje za
  prijavljene.
- `match_score_links` dobiva `write_token varchar(48)` (unique, null za stare
  veze). Changeset `2026-09-08-blok-link-write-token`.

**Organizator mora znati tko traži.** Neprijavljeni podnositelj zato u zahtjevu
šalje **ime** (`requestedByName`, obavezno kad nema prijave, 2–60 znakova).
Zahtjev bez imena i bez prijave se odbija — organizator ne može odobriti nešto
što nema potpis.

Odobrenje organizatora ostaje jedina prava obrana i ne mijenja se.

### 7.2 Što prijava i dalje donosi

**Zapisnik na profilu i javna poveznica** (§6.2) traže račun — zapisi žive na
profilu vlasnika. Dakle:

- neprijavljen: rezultat serije stiže organizatoru, zapisnika nema;
- prijavljen: uz rezultat ide i javni zapisnik, i poveznica u ždrijebu.

To se u dijalogu kaže **jednom rečenicom**, kao dobitak od prijave, ne kao
prijetnja.

### 7.3 Što piše na ekranu

Dijalog se otvara **odmah u izbor turnira**, bez zida s prijavom. Na vrhu stoji
jasno: **ovo se koristi samo na turnirima** — blok za stolom kod kuće nema što
povezivati. Ponuda za prijavu ostaje, kao sporedna radnja uz rečenicu iz §7.2.

---

## 8. REVIZIJA 2026-09-08 (treća) — blok sam ponudi stol na kojem igraš

Korisnik: *„ako je korisnik prijavljen i prijavljen je s jednim od svojih parova
na turnir, onda čim dođe na blok mu se ponudi da vodi zapisnik aktivne
runde/stola za taj turnir, inače mu se ne nudi”.*

Dosad je povezivanje bilo skriveno u izborniku i tražilo da igrač sam nađe
turnir, rundu i stol koji pred sobom već ima. Ako sve to server zna, treba
ponuditi.

### 8.1 Tko dobiva ponudu

Uvjeti, svi moraju vrijediti:

1. korisnik je **prijavljen**;
2. postoji par na kojem je on `submittedByUid` **ili** `coSubmittedByUid`
   (jedini pojam „moj par” koji ovaj sustav ima — v. §5);
3. par je **odobren** (`pendingApproval = false`) na turniru koji je `DRAFT`
   ili `STARTED`;
4. u **aktivnoj rundi** (najveći `number`, `status != COMPLETED`) postoji meč s
   tim parom, s oba para (BYE ne);
5. taj meč **nema aktivnu vezu** (`PENDING`/`APPROVED`).

Ako ijedan ne vrijedi — **ništa se ne nudi**. Blok bez turnira ostaje čist.

### 8.2 Endpoint

`GET /blok-links/suggestions` — `@Authenticated`. Vraća polje (najčešće nula
ili jedan element):

```json
[{
  "tournamentUuid": "…", "tournamentSlug": "…|null", "tournamentName": "…",
  "roundId": 5, "roundNumber": 3,
  "matchId": 12, "tableNo": 4,
  "myPairId": 34, "myPairName": "Ivan i Marko",
  "opponentPairId": 35, "opponentPairName": "Ana i Petra"
}]
```

Nema novih tablica ni stupaca — sve je upit nad postojećim `Pairs`, `Matches`,
`Rounds`, `Tournaments`.

### 8.3 Što blok radi s tim

Kad blok nema vezu, a ponuda postoji: **traka na vrhu** („Igraš na turniru X —
Runda 3, stol 4. Vodi zapisnik?”) s radnjom koja **preskače biranje turnira i
stola** i odmah šalje zahtjev s prepoznatim parom kao „našom” stranom.

- Ponuda se može odbaciti; odbačaj se pamti za taj meč, da se ne vraća na
  svakom otvaranju.
- Ručni put kroz izbornik ostaje za sve ostale slučajeve (§7.3).
