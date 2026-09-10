# Bela online — igranje bele u pregledniku

Samostalan podsustav za **igranje** bele (4 igrača, 2 para, do 1001), odvojen od
organizacijskog dijela aplikacije (turniri, parovi, cjenik). Sve što je logika
igre, botovi, sobe i realtime živi ovdje u `game/`; jedino React ekrani žive u
`frontend/src/game/` jer moraju dijeliti temu, auth, router i i18n SPA-a.

```
game/
  README.md                 ← OVAJ DOKUMENT je ugovor. Pravila, arhitektura, odluke.
  package.json              npm workspaces (packages/*), scripts: test / typecheck / dev:server
  tsconfig.base.json
  packages/
    protocol/   @bela/protocol  — tipovi poruka klijent⇄server + view modeli (zero deps)
    engine/     @bela/engine    — čista pravila bele: špil, dijeljenje, zvanje aduta,
                                  zvanja, štihovi, bodovanje, state machine (zero deps,
                                  deterministički uz seeded RNG, redaktirani pogled po sjedalu)
    bots/       @bela/bots      — strategije botova nad engine API-jem (zero deps)
    server/     @bela/server    — Node WebSocket server: lobby, sobe, sjedala, botovi,
                                  timeri, reconnect, Firebase auth. Autoritativan.
frontend/src/game/            — React: lobby, soba, stol, ruka, animacije, hooks (UI)
```

Runtime: Node ≥ 22, TypeScript, ESM. `engine`/`protocol`/`bots` **nemaju runtime
dependencyja** i frontend ih uvozi izravno iz izvora preko Vite aliasa
(`@bela/engine` → `game/packages/engine/src/index.ts`). Zato moraju poštovati
frontendov `erasableSyntaxOnly`: **bez `enum`, bez parameter properties,
bez namespace-a** — koristi `as const` objekte i union tipove.

Portovi (shema projekta "85"): game server **8285**. Javna WS putanja
`/ws/game` (Caddy u produkciji, Vite proxy u devu → `ws://localhost:8285`).
Health: `GET /health` na 8285.

---

## 1. Pravila bele (hrvatska bela, 4 igrača) — NORMATIVNO

Engine implementira **točno ovo**. Tamo gdje postoje varijante, odabir je
naveden i ne mijenja se bez izmjene ovog dokumenta.

### 1.1 Karte i igrači
- 32 karte, 4 boje × 8 vrijednosti. Boje (hrvatski nazivi, francuski simboli za
  render): `HERC` ♥, `KARA` ♦, `PIK` ♠, `TREF` ♣. Vrijednosti:
  `7, 8, 9, 10, J (dečko), Q (dama), K (kralj), A (as)`.
- Sjedala `0..3`. **Timovi: sjedala 0 i 2 = tim A, sjedala 1 i 3 = tim B.**
- Redoslijed poteza: `next(seat) = (seat + 1) % 4`. Vizualni smjer (u
  smjeru suprotnom od kazaljke, kako se bela igra) je stvar UI-a, ne enginea.
- Djelitelj (`dealer`) rotira: prva podjela nasumični djelitelj, zatim
  `next(dealer)`.

### 1.2 Dijeljenje i zvanje aduta
1. Špil se miješa **seeded RNG-om** (engine je deterministički za dani seed).
2. Svakom igraču se podijeli **6 karata** (3+3). Preostalih 8 čeka.
3. **Zvanje aduta** kreće od `next(dealer)` i ide redom. Igrač bira jednu od 4 boje
   ili kaže **"dalje"**. Prvi koji zove postavlja adut — nema nadmetanja.
4. Ako sva trojica kažu dalje, **djelitelj mora zvati** ("mus") — ne može reći dalje.
5. Tim igrača koji je zvao = **zvao je** (`callerTeam`). On mora "proći" (v. 1.6).
6. Nakon zvanja svakom se podijele **još 2 karte** (ukupno 8). Talona nema.

### 1.3 Rang i vrijednost karata
| | Adut (redoslijed, jačina) | Ne-adut |
|---|---|---|
| Jačina | J > 9 > A > 10 > K > Q > 8 > 7 | A > 10 > K > Q > J > 9 > 8 > 7 |
| Bodovi | J 20, 9 14, A 11, 10 10, K 4, Q 3, 8 0, 7 0 | A 11, 10 10, K 4, Q 3, J 2, 9 0, 8 0, 7 0 |

Zbroj svih bodova u kartama = **152**, + **10 za zadnji štih** = **162** po podjeli.

### 1.4 Zvanja (deklaracije)
Engine **automatski detektira i prijavljuje** sva zvanja iz ruke od 8 karata
(nema ručnog biranja — odluka za online igru; izbjegava dodatni UI korak).

| Zvanje | Bodovi |
|---|---|
| 4 dečka (J) | 200 |
| 4 devetke | 150 |
| 4 asa / 4 desetke / 4 kralja / 4 dame | 100 |
| Niz od 5+ u boji (`7-8-9-10-J-Q-K-A` redoslijed) | 100 |
| Kvarta (niz 4) | 50 |
| Terca (niz 3) | 20 |
| **Bela** (K + Q u adutu) | 20 |

Pravila:
- Niz koristi **prirodni** redoslijed `7 8 9 10 J Q K A` (ne adutski).
- Ista karta može biti i u nizu i u "četiri iste" — oboje vrijedi.
- Nizovi u istoj boji se ne preklapaju: najdulji mogući niz se uzima; niz od 8 = 100.
- **Samo tim s najjačim pojedinačnim zvanjem boduje sva svoja zvanja**; sva zvanja
  drugog tima propadaju. Usporedba: veći bodovi > ; kod jednakih bodova niz s
  višom najvišom kartom > ; ako je i to jednako, pobjeđuje igrač **bliži
  `next(dealer)`** u redoslijedu poteza (tj. tko je "prije na redu").
  "Četiri iste" vs niz iste vrijednosti (100): četiri iste pobjeđuju.
- **Bela se boduje** timu koji je drži, neovisno o gornjoj usporedbi, i ne
  sudjeluje u usporedbi "najjače zvanje". **Ali se ne prijavljuje sama** — v.
  "Bela je izbor" niže.
- Zvanja se računaju i otkrivaju **odmah nakon izbora aduta i dijeljenja 8 karata**,
  prije prve odigrane karte (`DECLARATIONS_REVEALED`). Poslužitelj tijekom
  početnog prikaza blokira igrače i botove (`declarationsPending`, 4,2 s),
  a zatim pokreće puni timer prvog poteza. Gumb „Zvanja” ponovno otvara
  zvanja trenutačne podjele, uključujući nakon ponovnog povezivanja.

**Bela je IZBOR — NORMATIVNO (2026-09-08).** Bela se prije prijavljivala
automatski, čim igrač odigra prvu od K/Q aduta. Sada se igrača **pita**.

- **Zašto.** Na podjeli koja **pada** svi bodovi podjele idu protivnicima
  (§1.6), pa prijavljena bela znači **20 bodova poklonjenih protivniku**. Tko
  vidi da pada, želi šutjeti — i to je jedini razlog zbog kojeg pitanje postoji.
- **Pita se jednom**, kad se baca **prva** od te dvije karte, i odgovor vrijedi
  **za cijelu podjelu**. „Ne” ubija belu: druga karta se poslije igra kao svaka
  druga — ne pita se ponovno i ne boduje se ništa. (Razmotreno i odbačeno:
  pitati ponovno na drugoj karti.)
- **Bez odgovora bela SE PRIJAVLJUJE.** Istek `turnTimeoutMs` (20 s), odsutan
  igrač kojemu bot odigra potez i **svaki botov potez** stižu bez odgovora, a
  20 bodova je dobitak na velikoj većini podjela — šutnja to ne smije stajati.
  Bot uvijek zove (§5).
- **Odgovor putuje na samom potezu**, kao zastavica: engine akcija
  `{ type: "PLAY"; seat; card; bela?: boolean }`, na žici `game.play {card, bela?}`
  (§3). Nema nove faze, nema dodatnog kruga poruka i nema stanja u kojem
  poslužitelj nekoga čeka: pitanje se cijelo odvija **na klijentu, prije slanja
  poteza**, a poslužitelj vidi jedan običan potez.
- **Klijent nije mjerodavan.** Postoji li bela uopće izvodi **engine**, iz ruke,
  točno kao i dosad; zastavica belu može samo **ugasiti**, nikad stvoriti. Zato
  se `bela: true` koje ruka ne pokriva (sjedalo nema i K i Q aduta, ili karta
  nije jedna od njih) **ignorira, a ne odbija**: takva tvrdnja ionako ne bi
  ništa bodovala, a odbiti inače legalnu kartu usred štiha zbog zastale
  zastavice (stara verzija klijenta, reconnect koji je pogodio krivo) kaznilo bi
  igrača za bezopasnu tvrdnju. Isto vrijedi za `bela: false` kad nema što odbiti.
- **Odbijanje živi u stanju, ne u klijentu**: `GameState.belaRefused: Seat | null`
  (§2). Tako ga ne može uskrsnuti ni ponovno spojen klijent, ni bot na isteku
  timera, ni bot koji je trajno preuzeo sjedalo — svi vide istu mrtvu belu, tko
  god odigrao drugu kartu. Briše se s podjelom.
- **Odbijanje je tiho: nema događaja za njega.** „Sjedalo 2 nije zvalo belu” je
  ista rečenica kao „sjedalo 2 drži K+Q aduta”, a to je upravo ono što igrač
  skriva. Iz istog razloga `belaRefused` **nije u `PlayerView`** i nikad ne
  izlazi iz enginea.
- **`allowBela: false` (i `noDeclarations`) rade točno kao prije**: kad bela ne
  može bodovati, ne pita se ništa i odbijanje se ne bilježi.
- **`declarationPoints` ostaje jedan broj u oba smjera** (§2): odbijena bela u
  njemu ne postoji, prijavljena postoji, i semaforski „+x” i
  `DealScore.declarationPoints` na obračunu i dalje daju isto.
- Testovi: `packages/engine/test/game.test.ts` („bela is a choice”),
  `packages/engine/test/view.test.ts` (redakcija odbijanja),
  `packages/bots/test/heuristicBot.test.ts` (bot zove).

**Vidljivost zvanja — NORMATIVNO (2026-09-08).** Otkrivaju se **samo zvanja
para koji boduje**. Zvanja drugog para propadaju i **nikad se ne šalju ni ne
prikazuju** — ni preko `PlayerView`, ni u događaju.

| Primatelj | Što vidi |
|---|---|
| igrač čiji par **boduje** | svoja + partnerova (dakle sva zvanja svog para) |
| igrač čiji par **propada** | **samo svoja** + zvanja para koji boduje |
| gledatelj | samo zvanja para koji boduje |
| prije izbora aduta | samo svoja (gledatelj ništa) |

- **Zašto.** Tuđa terca su tri **imenovane karte ruke koja još nije odigrana**.
  Prije je `viewFor` nakon izbora aduta slao zvanja *svih* sjedala *svima*, a
  overlay ih je i crtao — besplatna informacija svake podjele. Svoja zvanja
  igrač vidi uvijek: to su njegove vlastite karte, tu nema što procuriti.
- **Redakcija je u `viewFor`** (kao i §1.8), plus u samom događaju: `game.events`
  se emitira kao **jedan isti okvir svima za stolom**, pa `DECLARATIONS_REVEALED`
  nosi `perSeat` **samo za sjedala tima koji boduje** (`Partial<Record<Seat,…>>`
  — sjedalo koje ne boduje nema unos, a ne prazan niz). Redakcija po vezi bila
  bi drugi mehanizam za isto pravilo; ovako okvir ostaje jedan i siguran za
  svakog primatelja.
- `state.declarations` i dalje drži **sve** — bodovanje ga treba (§1.6). Reže se
  samo ono što izlazi iz enginea.
- Posljedica za botove: `@bela/bots` čita `PlayerView.declarations` i time
  gubi zaključivanje o protivničkim zvanjima
  (`seatProvablyLacksTrumpJack`) kad protivnik nije bodovao — namjerno, jer
  je bot dotad znao ono što čovjek za stolom ne zna.
- Testovi: `packages/engine/test/view.test.ts` (redakcija po sjedalu, gledatelj,
  negativan slučaj „nijedna karta protivničkog zvanja nije u okviru”, te isti
  test nad `DECLARATIONS_REVEALED`).

### 1.5 Igranje štihova
Prvi štih otvara `next(dealer)`; svaki sljedeći otvara pobjednik prethodnog.
Legalan potez (`legalMoves(state, seat)`), gdje je `L` boja prve karte, `T` adut:

1. **Imaš `L`** → moraš igrati `L`, i to **jaču kartu od one koja trenutno
   drži štih** ako je imaš ("mora se ići preko") — u svakoj boji, ne samo u
   adutu, i preko vlastitog partnera. Jačina: ne-adut `7 8 9 J Q K 10 A`,
   adut `7 8 Q K 10 A 9 J`. Nemaš jaču → bilo koja karta boje `L`.
   - Ako je štih **već presječen adutom**, a `L` nije adut, obveza „preko”
     otpada (nijedna karta boje `L` ne može nadjačati adut) → bilo koja `L`.
2. **Nemaš `L`**:
   - Ako imaš adut → **moraš adutirati**, bez obzira na to tko drži štih —
     **nema iznimke za partnera** (promjena 2026-09-09; prijašnje „partner drži
     štih → bilo što” dvaput je prijavljeno kao krivo). Ako je već adut u štihu,
     moraš igrati **jači adut** ako ga imaš, inače bilo koji adut (i manji).
   - Ako nemaš adut → bilo što.

Pobjednik štiha: najjači adut ako ima aduta; inače najjača karta boje `L`.

### 1.6 Bodovanje podjele
- Svaki tim zbraja bodove karata iz osvojenih štihova. Tim koji uzme zadnji
  štih dobiva **+10**.
- **Štiglja**: tim koji osvoji **svih 8 štihova** dobiva **+90** (ukupno 252 iz karata).
- Zvanja (1.4) se dodaju timu koji ih je obranio; bela svome timu.
- **Prolaz / pad**: neka je `C` = zbroj tima koji je zvao (karte + zvanja), `O` =
  zbroj protivnika. Tim koji je zvao **prolazi ako je `C > O`**. Inače je **pad**:
  protivnici dobivaju **sve** bodove podjele (`C + O`), tim koji je zvao 0.
- Nema zaokruživanja bodova (varijanta "zaokruži na desetice" se NE koristi).

### 1.7 Kraj igre
- Cilj: `targetScore` (default **1001**, opcije 501/701/1001) i pravilo
  `gameEndRule` (default **`prolaz`**):
  - **prolaz** — partiju dobiva par koji u podjeli koju je zvao prođe, dosegne
    cilj i nakon obračuna vodi u ukupnom rezultatu;
  - **dosta** — čim nakon obračuna barem jedan par dosegne cilj, pobjeđuje par
    s višim ukupnim rezultatom.
  Kod oba pravila izjednačenje na cilju ili iznad njega znači još jednu
  podjelu.
- **Gdje se to događa (odluka, 2026-09-08).** "Kraj podjele" znači **trenutak
  obračuna**, a ne sljedeća akcija: `reduce` na četvrtoj karti osmog štiha
  obračuna podjelu i, ako odabrano pravilo daje pobjednika, odmah
  postavlja `phase: "GAME_OVER"` i emitira `DEAL_SCORED` pa `GAME_OVER` u
  istom nizu događaja. Prije je igra završavala tek na `NEXT_DEAL`, pa je
  `DEAL_DONE` izgledao jednako i kad iduće podjele nema — klijent je nudio
  „Sljedeća podjela” za podjelu koja se nikad neće odigrati, a soba se
  otvarala tek nakon klika.
  - **Zašto u engineu, a ne u `gameRoom.ts` ili klijentu.** Kraj igre je
    pravilo (§1.7), a ne prikaz. Auto-`NEXT_DEAL` na poslužitelju značio bi da
    ista sekvenca akcija daje različita stanja ovisno o tome tko je pokreće
    (server vs. `bots` simulacija vs. test), a skrivanje gumba u UI-u ostavilo
    bi lažni `DEAL_DONE` u protokolu. Ovako je `DEAL_DONE` jednoznačan:
    **slijedi još jedna podjela**. Engine ostaje deterministički — isti seed +
    iste akcije daju isto stanje, samo je akcija manje.
  - `NEXT_DEAL` i dalje provjerava isto pravilo i završava igru ako mu netko
    preda već odlučen `DEAL_DONE` (ručno složeno stanje, test, budući server
    koji korigira rezultat između podjela). Izjednačenje na cilju ne završava
    ništa — igra se još jedna podjela, koliko god oba tima bila preko cilja.
  - Posljedica za UI: zadnja podjela nema svoj `DEAL_DONE`, pa ni sažetak
    podjele; njezini brojevi ostaju u `history` (povijest na semaforu), a
    kraj partije objavljuje **jedan** dijalog s konačnim rezultatom.

### 1.8 Gledanje štihova — NORMATIVNO (2026-09-08)

Postavka **sobe** s tri stanja (`TrickReview`), bira se pri otvaranju sobe,
vrijedi za cijelu sobu i vidi je svatko tko je u njoj. **Zadano je
`off`.** Kad je uključena, pregled prikazuje **tko je odigrao koju kartu** u
svakom dovršenom štihu tekuće podjele.

| Vrijednost | Tko smije pregledavati odigrane štihove |
|---|---|
| `off` | **nitko** (zadano) |
| `leaderPair` | sjedalo koje **započinje** trenutni štih i **njegov par** |
| `all` | svi za stolom, uključujući gledatelje |

- `leaderPair` je par igrača koji je **otvorio** štih (`trick.leader`) — **ne**
  onaj tko je trenutno na potezu. Nakon što štih završi, `trick.leader` je
  pobjednik tog štiha, pa je odgovor definiran u svakom trenutku podjele
  (uključujući `DEAL_DONE`/`GAME_OVER`).
- **Redakcija je na poslužitelju, u `viewFor`.** Tim koji ne smije gledati ne
  dobiva povijest **uopće**: `PlayerView.trickHistory` je `null`. Skrivanje u
  UI-u bilo bi ukrasno — podatak bi i dalje bio u okviru koji stiže u
  preglednik. Test: `packages/engine/test/trickReview.test.ts` (uključujući
  negativni slučaj — pogrešan tim ne dobije ništa).
- **Podatkovni model.** Štih se pamti onako kako je odigran:
  `WonTrick { no, leader, winner, plays: {seat, card}[], cards }`. Prije je
  `WonTrick` bio `{ winner, cards }` — bez sjedala, dakle "tko je što odigrao"
  se iz njega nije moglo prikazati, a redoslijed štihova i njihove voditelje
  `view.ts` je rekonstruirao hodanjem lanca pobjednika unatrag. Sada je
  redoslijed obično sortiranje po `no`. `winner` i `cards` **ostaju i uvijek su
  popunjeni** (`cards === plays.map(p => p.card)`) jer ih čitaju `scoreDeal`,
  `@bela/bots` i UI.
- **Zašto je u `GameConfig`, a ne izvan enginea.** Ovo **nije** pravilo igre:
  `reduce`, `legalMoves`, `legalBids` i `scoreDeal` ga nikad ne čitaju i ista
  partija s `off` i s `all` daje bit-po-bit isto stanje (test
  „visibility rule, not a rule of play"). Ali redakcija smije živjeti **samo**
  u `viewFor(state, seat)`, a `state` je jedini ulaz te funkcije — pa
  postavka putuje u `state.config`, isto kao `noDeclarations`. Da je pravilo
  sobe treći argument `viewFor`-u, svaki bi ga pozivatelj morao pamtiti i jedan
  zaboravljeni poziv bi ga procurio; ovako je zadano stanje uvijek redaktirano.
- **Botovi uvijek pamte sve — `viewFor(state, seat, { recallTricks: true })`
  (2026-09-09).** Postavka sobe kaže što smije pregledavati **čovjek**: to je
  pomagalo u sučelju. Bot nije čovjek koji nešto naknadno gleda — on je
  **bez pamćenja** između poteza (`chooseCard(view, legal, rng)` ne nosi ništa
  iz prošlog poziva), pa bi sa zadanim `off` vidio samo `lastTrick` i ravni,
  bezsjedalni `played`: ne bi mogao znati tko je bacio što prije dva štiha —
  a to svaki igrač za stolom pamti besplatno. Koje su **javne** karte pale i
  iz čije ruke nije skrivena informacija, pa je ovo pamćenje, ne varanje.
  - Zastavicu postavlja **samo** `actForSeat` u `packages/server/src/gameRoom.ts`,
    i to i kad bot igra **umjesto čovjeka** (istek poteza ili prekid veze,
    `autoPlayed`) — čovjek kojeg mijenja pamtio bi istu javnu igru.
  - Ne širi **ništa** drugo: tuđe ruke, talon i zvanja para koji je izgubio
    natjecanje ostaju redaktirani i botu kao i čovjeku. Zadana vrijednost je
    točno današnje ponašanje, pa okvir koji ide u preglednik (`stateMessage`)
    i dalje sluša `trickReview`. Testovi: `packages/engine/test/trickReview.test.ts`
    („recallTricks (bot memory)") i `packages/server/test/oneGame.test.ts`
    („keeps the bots' full recall out of the broadcast").
- `lastTrick` **nije** dio ovog pravila: to je štih koji je upravo pokupljen s
  otvorenog stola i UI ga animira; njega vide svi, uvijek.

---

## 2. Engine (`@bela/engine`) — javni API (UGOVOR)

Čisti funkcijski reducer nad **nepromjenjivim** stanjem; nikad ne mutira ulaz.

```ts
// Osnovno
type Suit = "HERC" | "KARA" | "PIK" | "TREF"
type Rank = "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A"
type Card = `${Rank}${Suit}`            // npr. "JHERC", "10PIK" — string id, stabilan za mrežu
type Seat = 0 | 1 | 2 | 3
type Team = "A" | "B"                   // teamOf(seat): 0,2 → A; 1,3 → B

// Faze podjele. DEAL_DONE znači "podjela je obračunata i SLIJEDI još jedna";
// podjela koja odluči partiju ide ravno u GAME_OVER (§1.7).
type Phase = "BIDDING" | "PLAYING" | "DEAL_DONE" | "GAME_OVER"

type TrickReview = "off" | "leaderPair" | "all"   // §1.8; default "off"
interface GameConfig {
  targetScore: 501 | 701 | 1001; seed: string
  noDeclarations?: boolean; allowBela?: boolean
  trickReview?: TrickReview            // vidljivost, NE pravilo igre (§1.8)
}

interface GameState {                   // PUNO stanje — samo server ga vidi
  config: GameConfig
  dealNo: number                        // 1-based
  dealer: Seat
  phase: Phase
  hands: Record<Seat, Card[]>           // karte u ruci (sortirane deterministički)
  bidding: { turn: Seat; passes: Seat[]; trump: Suit | null; caller: Seat | null }
  trick: { leader: Seat; turn: Seat; cards: { seat: Seat; card: Card }[] }
  tricksWon: Record<Team, WonTrick[]>            // po timu; globalni red je `no`
  declarations: Record<Seat, Declaration[]>      // izračunato nakon 8 karata
  belaDeclared: Team | null
  belaRefused: Seat | null               // sjedalo koje NIJE zvalo belu (§1.4);
                                         // konačno za podjelu, NIKAD u PlayerView
  dealScore: DealScore | null            // popunjeno u DEAL_DONE
  score: Record<Team, number>            // ukupno kroz igru
  history: DealScore[]                   // sve završene podjele
  rng: RngState
  winner: Team | null
}

interface Declaration { kind: "FOUR" | "SEQUENCE" ; cards: Card[]; points: number }
// Štih onako kako je odigran (§1.8). `cards === plays.map(p => p.card)`.
interface WonTrick { no: number; leader: Seat; winner: Seat
                     plays: { seat: Seat; card: Card }[]; cards: Card[] }
interface DealScore {
  dealNo: number; trump: Suit; caller: Seat; callerTeam: Team
  cardPoints: Record<Team, number>       // uklj. +10 zadnji štih i +90 štiglja
  declarationPoints: Record<Team, number>// samo obranjena zvanja + bela
  stiglja: Team | null
  passed: boolean                        // je li zvač prošao
  total: Record<Team, number>            // ono što se stvarno dodaje score-u
}

// Akcije (input reducer-a)
type GameAction =
  | { type: "BID"; seat: Seat; trump: Suit }
  | { type: "PASS"; seat: Seat }
  // `bela` je odgovor na „Zovi belu?” (§1.4): nema ga ili je `true` → prijavi
  // (šutnja zove); `false` → ne zovi, konačno za podjelu. Zastavica belu može
  // samo ugasiti — onu koju ruka ne pokriva engine IGNORIRA, ne odbija.
  | { type: "PLAY"; seat: Seat; card: Card; bela?: boolean }
  | { type: "NEXT_DEAL" }                // iz DEAL_DONE → nova podjela (§1.7)

// Funkcije
newGame(config: GameConfig): GameState            // odmah dijeli prvu podjelu (6 karata), phase BIDDING
reduce(state, action): { state: GameState; events: GameEvent[] }   // baca EngineError na ilegalnu akciju
legalMoves(state, seat): Card[]                   // [] ako nije na potezu / nije PLAYING
legalBids(state, seat): { canPass: boolean; suits: Suit[] }
interface ViewOptions { recallTricks?: boolean }  // §1.8; SAMO za odluke botova
viewFor(state, seat: Seat | null, opts?: ViewOptions): PlayerView
                                                  // REDAKTIRANO stanje (tuđe karte → samo broj); null = promatrač
                                                  // bez `opts` = točno kao prije; `recallTricks` dira SAMO trickHistory
// PlayerView.currentDealPoints: Record<Team, number> — "bodovi mješanja", zbroj
// karata iz **dovršenih** štihova tekuće podjele. Nije tajna: te su karte pale
// otvoreno pred sva četiri igrača, pa ih svatko može zbrojiti i sam. Iz njega
// je namjerno izostavljeno sve što JEST tajna ili još nije odlučeno: karte u
// štihu u tijeku, karte u rukama, zvanja (§1.4 — vidljiva su tek nakon izbora
// aduta i ionako su zaseban podatak u view-u), završnih +10, štiglja i
// eventualni pad — sve to primjenjuje `scoreDeal` u trenutku obračuna.
// Prije aduta je `{A: 0, B: 0}`. UI ovo prikazuje kao VELIKI broj po timu,
// s ukupnim rezultatom partije (`score`) malim ispod.
// PlayerView.trickHistory?: WonTrick[] | null — dovršeni štihovi tekuće
// podjele, redom, SA sjedalima (§1.8). `null` = ovo sjedalo ne smije
// pregledavati, i tada podatka u okviru nema. Postavka sobe `trickReview`
// vrijedi za ČOVJEKA; odluka bota gradi se s `{ recallTricks: true }` i uvijek
// dobiva punu listu — pamćenje javno odigranih karata nije povlaštena
// informacija (§1.8). Opcionalno polje jer `@bela/bots` sam sastavlja
// PlayerView za svoje simulacije.
// PlayerView.declarations: Partial<Record<Seat, Declaration[]>> — svoja uvijek,
// plus zvanja para koji BODUJE nakon izbora aduta. Zvanja para koji propada
// nikad ne izlaze iz enginea (§1.4, tablica vidljivosti).
// PlayerView.declarationPoints?: Record<Team, number> — koliko dodatnih bodova
// iz zvanja tim ima u ovoj podjeli: zbroj zvanja para koji boduje, **plus 20
// za prijavljenu belu** timu koji ju je prijavio. Bela je UNUTRA namjerno:
// nije dio natjecanja „najjače zvanje” (§1.4), ali jest bod iz zvanja, javna
// je čim se odigra prva od K/Q aduta, i `DealScore.declarationPoints` ju je
// oduvijek uključivao — da je nema, semaforski „+x” bi na obračunu skočio za
// 20 bez vidljivog razloga. NE uključuje bodove iz karata, +10 za zadnji štih,
// štiglju ni pad. Prije aduta `{A: 0, B: 0}`; tim koji je izgubio natjecanje
// ima 0 (osim eventualne bele). Ista aritmetika kao `DealScore.declarationPoints`
// — jedna funkcija (`declarationPoints(state)`), pa se semafor i sažetak
// podjele ne mogu razići. UI ga crta kao mali „+150” uz veliki broj podjele,
// samo kad nije nula. Opcionalno iz istog razloga kao `trickHistory`.
teamOf(seat): Team ; nextSeat(seat): Seat ; partnerOf(seat): Seat
cardPoints(card, trump): number ; trickWinner(cards, trump): Seat
findDeclarations(hand: Card[]): Declaration[]     // čisto, testabilno
declarationPoints(state): Record<Team, number>    // bodovi iz zvanja + bela (v. gore)
```

`GameEvent` (za animacije/UI, isti tipovi su u `@bela/protocol`):
`DEALT`, `BID` {seat,trump}, `PASS` {seat}, `TRUMP_SET` {trump,caller}, `HAND_COMPLETED`
(8 karata), `CARD_PLAYED` {seat,card}, `BELA` {seat}, `TRICK_WON` {winner, cards, points},
`DECLARATIONS_REVEALED` {perSeat, scoringTeam} — `perSeat` je
`Partial<Record<Seat, Declaration[]>>` i nosi **samo sjedala tima koji boduje**
(§1.4); okvir je jedan i isti za sve za stolom, pa ne smije sadržavati ništa
tuđe. `DEAL_SCORED` {dealScore}, `GAME_OVER` {winner, score}.
Zadnja karta partije nosi `CARD_PLAYED`, `TRICK_WON`, `DEAL_SCORED` **i**
`GAME_OVER` u jednom nizu (§1.7) — UI ih odigrava redom, pa se zadnji štih
pokupi prije nego što se objavi kraj partije.

Engine je **deterministički**: `newGame({seed})` + isti niz akcija ⇒ isto stanje.
Test-suite (vitest) mora pokriti: kompletnu podjelu iz seeda, sva pravila
legalnih poteza (svaka grana 1.5), svako zvanje i usporedbu, štiglja, pad,
belu (i njezino **odbijanje**, §1.4), kraj igre, mus djelitelja.

Za odbijenu belu **nema događaja**: `BELA` postoji samo za prijavljenu (§1.4).
Šutljivo odbijanje je namjerno — događaj bi objavio da to sjedalo drži K+Q
aduta.

## 3. Protokol (`@bela/protocol`) — poruke preko WS

JSON tekstualni okviri, `{ "t": "<tip>", ...payload }`. Klijent prvo šalje `hello`.
Vidi `packages/protocol/src/index.ts` — to je izvor istine za tipove.
Server nikad ne šalje tuđe karte: klijent dobiva `PlayerView` iz `viewFor`.

Ključni tokovi:
- **Auth**: `hello { token }` → `hello.ok { user }` ili `error`. Token = Firebase ID
  token (verifikacija JWKS `securetoken.google.com`, issuer
  `https://securetoken.google.com/<FIREBASE_PROJECT_ID>`). U devu
  `GAME_DEV_ALLOW_ANON=1` dopušta `hello { devName }` bez tokena.
- **Lobby**: `lobby.subscribe` → server šalje `lobby.rooms` na svaku promjenu.
  `RoomSummary` je **javan** — ide svakom pretplatniku, i onome tko nikad neće
  ući u sobu — pa nosi samo ono što smije vidjeti bilo tko: uz `name`, `status`,
  `targetScore`, `private`, `allowSpectators`, `seatsTaken`, `humans` i
  `createdAt` još i `occupants` (4 mjesta redom, `RoomOccupant` = *samo* ime +
  `connected`, ili `{kind:"BOT",name}`, ili `null`) te `joinable`. Nema uid-a
  (`hostUid` živi na `RoomState`, ne na sažetku) i nema šifre privatne sobe —
  `code` je `""` svima osim članovima te sobe. `joinable` je serverov vlastiti
  odgovor na „može li netko novi uopće ući” (`Room.canAdmitNewcomer`, ista
  provjera koju `assertCanJoin` primjenjuje), pa predvorje odbija punu sobu
  **unaprijed** i ne može tvrditi „puna” dok sjedalo još postoji. Šifra
  privatne sobe nije dio te procjene i provjerava se zasebno.
- **Soba**: `room.create {name, targetScore, gameEndRule?, private, allowSpectators?, noDeclarations?, allowBela?,
  trickReview?}` → `room.joined {room}`; `allowSpectators` je zadano `false` i
  vrijedi **cijelo vrijeme**, ne tek od početka partije: tko ne može sjesti u
  sobu bez gledatelja, taj se **odbija** (`ROOM_FULL` prije početka,
  `SPECTATORS_DISABLED` u započetoj partiji) umjesto da tiho postane gledatelj.
  Iz istog razloga `room.stand` u takvoj sobi vraća `SPECTATORS_DISABLED` —
  izlaz iz stolice je `room.leave`. (Uklanjanje gledatelja pri `room.start`
  ostaje kao obrana, ali ih po ovim pravilima više ne može ni biti.)
  `trickReview` (§1.8) je `off` ako ga
  nema, bira se pri stvaranju sobe (i mijenja `room.setOptions` dok je soba u
  `LOBBY`) te putuje u `RoomState.trickReview`
  (dakle vidi ga svatko u sobi) te u `GameConfig` pokrenute partije;
  `room.join {roomId}`; `room.sit {seat}` (premještanje unutar stola);
  `room.stand`; `room.addBot {seat}`;
  `room.removeBot {seat}`; `room.ready {ready}`; `room.start` (može pokrenuti bilo
  koji igrač za stolom kada su sva četiri mjesta popunjena i svi ljudski igrači
  spremni; botove domaćin dodaje prije pokretanja); `room.leave`. Server emitira
  `room.state` svima u sobi.
- **Postavke sobe**: `room.setOptions {targetScore?, gameEndRule?, allowSpectators?,
  noDeclarations?, allowBela?, trickReview?}` — domaćin mijenja pravila **već
  otvorene** sobe (2026-09-09). Postavke su prvo što lista sheet „postavke ove
  igre”, pa moraju biti promjenjive dok se čeka četvrti, a ne samo u dijalogu za
  stvaranje.
  - **Svako polje je neobavezno i izostanak znači „ne diraj”**, pa klijent šalje
    jedan prekidač bez ponavljanja ostalih pet. Vrijednost koja *jest* poslana,
    a nije valjana, vraća `BAD_REQUEST` — ne tiho se ispravlja, jer bi prekidač
    kod domaćina ostao prikazivati postavku koju soba nikad nije primila.
  - **Samo domaćin** (`NOT_HOST`), kao i za svaki drugi prekidač cijele sobe.
  - **Samo u `LOBBY`** (`ALREADY_STARTED`): ovo su pravila *podjele*, a
    `GameRoom` ih je pri `room.start` već prepisao u `GameConfig` — promjena u
    tijeku partije ostavila bi sobu koja oglašava jednu igru i engine koji
    boduje drugu. `private` zato ovdje **nije**: privatnost nije pravilo
    podjele, mijenja se i tijekom igre i već ima `room.setPrivate` (dva puta za
    upis iste zastavice je način da se te dvije razidu).
  - `noDeclarations` i `allowBela` rješavaju se **zajedno**, istim pravilom koje
    primjenjuje `room.create` (`belaCounts` u `room.ts`): uz uključena zvanja
    bela je zvanje kao i svako drugo i **uvijek** se broji, pa `allowBela: false`
    sam za sebe ne mijenja ništa. Samo soba bez zvanja bira „…ali belu zovi”
    (zadano) ili „ni belu”.
  - Nakon promjene soba emitira `room.state` svima u sobi **i** osvježi
    predvorje (`targetScore`, `gameEndRule`, `noDeclarations` i
    `allowSpectators` stoje i na javnom `RoomSummary`) — isti fan-out koji radi
    `room.setPrivate`. Rate-limit je opći, po vezi (`LIMITS.messagesPerSecond`).
  - Testovi: `packages/server/test/roomOptions.test.ts`.
- **Ime za igru**: `profile.setName {name}` → `profile.name {name, nextChangeAt}`
  (2026-09-09). Ime koje igrač nosi **za stolom**, odvojeno od imena računa.
  - **Ide preko socketa, ne preko REST-a**, jer isti kontrolnik mora posluživati
    i gosta: gost nema bearer token, njegov identitet postoji samo kao uid koji
    je ovaj server izveo iz tajne u pregledniku (`guest:<sha256(secret)>`) — a
    upravo se protiv tog uid-a mjeri ograničenje.
  - **Jedna promjena u sedam dana.** Pravilo drži backend
    (`GameNameService.CHANGE_INTERVAL`), koji ima sat i redak; server ga samo
    prenosi. Odbijenica je `NAME_RATE_LIMITED`.
  - **Prije odbijenice server pošalje `profile.name` s nepromijenjenim imenom i
    s `nextChangeAt`**: `error` okvir nema gdje nositi vrijeme, a klijent koji je
    čuo samo „ne” ne može reći kad da se vrati.
  - Pohranjeno ime **nadjačava** ime računa i ime koje gost tipka (`withAppProfile`
    u `auth.ts`) — inače bi gost brisanjem `localStorage`-a zaobišao ograničenje.
  - Nakon uspjeha soba prepisuje svoje kopije sjedala (`renameOccupant`) i emitira
    `room.state` + osvježi predvorje; nema zasebne poruke za ostale.
  - Testovi: `packages/server/test/gameName.test.ts`, `guest.test.ts`,
    `profiles.test.ts`.
- **Igra**: `game.bid {trump}` / `game.pass` / `game.play {card, bela?}` / `game.nextDeal`
  → server emitira `game.state {view}` + `game.events {events}`. `view` je uvijek
  `PlayerView` iz `viewFor`, pa uz `score` (ukupno kroz partiju) nosi i
  `currentDealPoints` — bodove tekuće podjele iz **dovršenih** štihova (§2) —
  te `declarationPoints`, dodatne bodove iz zvanja (+ bela) po timu.
  Semafor prikazuje bodove podjele veliko, uz njih mali „+150” kad zvanja
  postoje, a `score` malo ispod. Zvanja u `view.declarations` su redaktirana
  (§1.4): svoja + para koji boduje.
  `game.nextDeal` je smislen **samo** u `DEAL_DONE`; podjela koja odluči
  partiju stiže već kao `GAME_OVER` (§1.7) i server takav zahtjev tiho
  ignorira.
  `game.play.bela` je odgovor na „Zovi belu?” (§1.4), koji je klijent postavio
  **prije** slanja poteza — nema zasebne poruke ni faze. Poslužitelj provjeri
  samo **oblik** (boolean ili ništa; sve drugo je `BAD_REQUEST`), a je li
  sjedalo doista drži K+Q aduta odlučuje engine. Zastavicu koju ruka ne
  pokriva engine **ignorira** (ne odbija potez), pa `bela: true` iz krivotvorenog
  ili zastarjelog klijenta ne može stvoriti bodove.
- **Chat**: `chat.send {text}` → `chat.msg`. Max 300 znakova, rate-limit 1/s.
- **Aktivno sjedalo**: `game.active { seat: ActiveSeatInfo | null }` — server→klijent,
  bez zahtjeva. Kaže *koja soba još drži sjedalo za ovog korisnika* i do kada:
  `{ roomId, roomName, code, status, targetScore, seat, present, holdUntil }`.
  Šalje se odmah nakon `hello.ok`, uz **svaki** `lobby.rooms` fan-out (isti
  `changed()` okida i početak i kraj čuvanja) te nakon join/leave. `present` je
  true dok smo stvarno u sobi; `holdUntil` je apsolutni epoch ms (nikad trajanje
  — tako suspendirani tab pokaže istinu čim se probudi). Predvorje na temelju
  ovoga prikazuje karticu „Imaš aktivnu igru”.

### 3.1 Timeri i čuvanje sjedala — NORMATIVNO

- **Potez**: `turnTimeoutMs` (default 20 000). Istekom bot odigra **jedan**
  potez za igrača; `game.state.autoPlayed` to označava. Taj potez ide **bez
  `bela` zastavice**, pa se eventualna bela prijavljuje — nitko nije odgovorio,
  a šutnja zove (§1.4).
- **Čuvanje sjedala (`reconnectGraceMs`, default 120 000 = 2 min)**. Pokreće ga
  pad socketa. Izričit `room.leave` u sobi `PLAYING` pokreće ga samo ako nakon
  izlaska za stolom ostanu najmanje dvije osobe. Za to vrijeme:
  - sjedalo i dalje pripada tom uid-u; soba ga prikazuje kao
    `connected: false` uz `holdUntil` (`SeatInfo.occupant`), **ne** kao bota;
  - njegovi potezi se **ne** igraju odmah — teče obični `turnTimeoutMs`, i tek
    istekom bot odigra jedan potez (`autoPlayed`). Bot ne „preuzima” stol;
  - povratak (`room.join`, `room.joinByCode`, ili `hello` kad je razlog pada
    bio disconnect) vraća sjedalo i poništava čuvanje;
  - istekom čuvanja bot trajno preuzima sjedalo do kraja partije (u `LOBBY`
    statusu se sjedalo samo oslobodi).
- **Raspad partije**: ako izričit izlazak tijekom igre ostavi manje od dvije
  osobe, cijela soba se odmah uklanja. To obuhvaća 1 osobu + 3 bota i
  2 osobe + 2 bota kada jedna osoba izađe. Preostali članovi dobivaju
  `room.left`, vraćaju se u predvorje, a soba se više ne oglašava kao aktivna.
  Kod puknute veze soba pričeka dvominutni reconnect; ako bi nakon isteka
  ostala ista takva postava, tada se također raspušta umjesto da ostane puna
  botova.
- **Razlog čuvanja** (`HoldReason` u `room.ts`) razlikuje `disconnect` od `left`:
  novi `hello` automatski vraća u sobu **samo** kod `disconnect`. Nakon
  izričitog izlaska korisnik dobiva `game.active` i vraća se gumbom — inače bi
  otvaranje predvorja tiho poništilo čuvanje i sjedalo se ne bi nikad izgubilo.
- U `LOBBY` statusu izričit `room.leave` oslobađa sjedalo odmah (nema što čuvati).
  Ako nakon toga ne ostane nijedan čovjek ni aktivni član, soba se odmah briše;
  botovi sami ne mogu održavati sobu aktivnom niti vidljivom u predvorju.
- **Greške**: `error { code, message }`, `code` ∈ `UNAUTHENTICATED | ROOM_NOT_FOUND |
  ROOM_FULL | ROOM_CODE_REQUIRED | SPECTATORS_DISABLED | SEAT_TAKEN | NOT_HOST | NOT_IN_ROOM | NOT_YOUR_TURN | ILLEGAL_MOVE |
  RATE_LIMITED | BAD_REQUEST | ALREADY_STARTED | NOT_ENOUGH_PLAYERS | ALREADY_IN_GAME`.
  Poruke su hrvatske, ali klijent prevodi po `code` (hr/sl).

### 3.2 Jedno sjedalo po osobi — NORMATIVNO (2026-09-08)

Tko već ima sjedalo u nekoj sobi **ne može** otvoriti novu ni ući u tuđu:
`room.create`, `room.join` i `room.joinByCode` u **drugu** sobu vraćaju
`error ALREADY_IN_GAME` (`Lobby.requireNoSeatElsewhere`, provjera **prije**
napuštanja trenutne sobe — inače bi izlazak iz `LOBBY` sobe oslobodio sjedalo
i propustio provjeru).

- Ranije je bilo obrnuto: ulazak bilo gdje drugdje tiho je **prepustio** staro
  sjedalo botu (`Lobby.abandonSeatsExcept`, sada uklonjeno). Jedan promašen
  klik u predvorju značio je izgubljenu partiju, bez upozorenja i bez povratka.
- **Povratak u vlastitu sobu nikad nije blokiran**: `keepRoomId` je soba u koju
  se ulazi, pa `room.join`/`room.joinByCode` u sobu koja nam čuva sjedalo i
  dalje rade, kao i automatski reconnect nakon pada socketa (§3.1).
- Izlaz je namjeran: `room.leave` (u predvorju „Napusti igru", koja odustaje i
  od čuvanja) oslobodi sjedalo, i tek tada je nova soba moguća.
- Klijent to isto stanje već zna iz `game.active`, pa predvorje **onemogući**
  „Nova igra", „Pridruži se šifrom" i retke tuđih soba i objasni zašto —
  umjesto da šalje zahtjev koji sigurno pada. Poslužiteljska provjera ostaje
  mjerodavna (klijent nije granica sigurnosti).
- Gledatelj (bez sjedala) nema ograničenje „jedna igra”, ali u započetu sobu
  smije ući samo kada je domaćin pri stvaranju uključio gledatelje.
- Testovi: `packages/server/test/oneGame.test.ts`.

### 3.3 Ulazak = sjedalo — NORMATIVNO (2026-09-08)

**Ako postoji slobodno sjedalo, onaj tko ulazi ga dobiva.** Nema više „ušao
sam, a sad nekako sjedni”: `Room.attach` — jedina točka kroz koju prolaze sva
četiri ulaza (`hello` reconnect, `room.join`, `room.joinByCode`,
`Lobby.create`) — u statusu `LOBBY` posjedne pridošlicu na **prvo slobodno
sjedalo iz `SEAT_FILL_ORDER`**. `room.sit` ostaje, ali sada služi samo
premještanju za stolom.

**Redoslijed popunjavanja je `0 → 2 → 1 → 3`, ne `0 → 1 → 2 → 3`.** Sjedala se
izmjenjuju po timovima (0+2 su jedan par, 1+3 drugi, §1.1), pa bi „najniže
slobodno” drugoga posjelo **nasuprot** domaćinu, trećega uz njega, i oba bi
para ostala polovična dok ne stigne četvrti: izvana stol izgleda kao da
posjeda nasumično, a domaćin gleda kako mu „oni” raste prije nego što je „mi”
uopće cijelo. `0 → 2 → 1 → 3` popuni **prvi par do kraja, pa drugi** — dvoje za
stolom su uvijek suigrači, troje su uvijek pun par plus jedan.

Redoslijed stoji na **jednom** mjestu, konstanti `SEAT_FILL_ORDER` u
`packages/server/src/room.ts`. Čita ga `Room.nextSeatForNewcomer()` (dodjela
sjedala) i preko njega `Room.canAdmitNewcomer()` (odbijanje i
`RoomSummary.joinable`), pa se promjena redoslijeda ne može dogoditi samo na
jednoj strani. `frontend/src/game/mock/mockGameServer.ts` drži identičnu
kopiju — mock koji posjeda drukčije uči UI stol kakav server nikad ne složi.

Odbijanje i posjedanje računa **ista** funkcija `Room.canAdmitNewcomer()`:

| stanje sobe | novi korisnik |
|---|---|
| `LOBBY`, ima slobodno sjedalo | sjeda (`yourSeat` ≠ null) |
| `LOBBY`, puna, `allowSpectators` | gledatelj |
| `LOBBY`, puna, bez gledatelja | `error ROOM_FULL` |
| `PLAYING`, `allowSpectators` | gledatelj |
| `PLAYING`, bez gledatelja | `error SPECTATORS_DISABLED` |

Ista se funkcija objavljuje kao `RoomSummary.joinable`, pa poruka i stanje ne
mogu razići: predvorje ne može reći „puna” sobi koja ima sjedalo, ni pustiti
klik u sobu koja će ga odbiti. Provjera i posjedanje događaju se u istoj
sinkronoj obradi jedne poruke (Node, jedna dretva), pa se dva istovremena
ulaska ne mogu potući oko istog sjedala — drugi vidi stol već popunjen.

- Uzrok bugova koje je ovo zamijenilo: klijent je (redizajnom sobe) izgubio
  gumb „Sjedni” i pretpostavio da server posjeda, a server to nikad nije radio.
  Drugi igrač je tako u sobi s tri prazna sjedala vidio „Sva su mjesta
  zauzeta — gledaš igru”, a soba s badgeom „Bez gledatelja” je istovremeno
  imala gledatelja.
- Testovi: `packages/server/test/joinSeating.test.ts` — uključujući svojstvo
  koje stoji iza redoslijeda, izrečeno bez brojeva sjedala: nakon svakog
  ulaska parovi se razlikuju za najviše jedan.

**Strane stola su vezane uz domaćina, ne uz gledatelja (2026-09-08).** Timovi
su na žici već apsolutni (A = sjedala 0+2, B = 1+3); klijent ih je u sobi
prelabelirao u „MI”/„ONI” prema tome tko gleda, pa je isti stol dvojici za
njim izgledao zrcalno i „sjedni lijevo od mene” nije značilo isto mjesto.
`RoomPanel` sada lijevo uvijek prikazuje **domaćinov par** (izveden iz
`hostUid`, jer ga `room.sit` može premjestiti), za sve jednako — tko sjedne u
drugi par, vidi se u drugom paru. Naslovi „MI”/„ONI” i brojači „1/2” su
maknuti: sjedala pokazuju tko je tu, a brojač je prazno sjedalo pretvarao u
statistiku. Grupiranje nose dvije kartice (+ `role="group"` i `aria-label`
„Par 1” / „Par 2” za čitač ekrana). Rezultat u igri (`ScoreBoard`,
`DealSummary`, `GameOverDialog`, `ActiveRoomWidget`) ostaje relativan prema
igraču — „moji bodovi” su moji — jer to je bodovanje, ne raspored sjedenja.

## 4. Server (`@bela/server`)
- `ws` biblioteka, jedan proces, sve u memoriji (v1: bez baze). Namjerno
  napuštena prazna soba nestaje odmah; nakon puknute veze vrijedi reconnect
  prozor i prazne sobe imaju sigurnosni TTL od 5 min. Završene nestaju nakon
  10 min.
- Struktura: `config.ts` (env), `auth.ts` (JWKS, `jose`), `ws.ts` (konekcije, parse,
  rate-limit, heartbeat ping 25 s), `lobby.ts`, `room.ts` (sjedala, ready, host,
  **primanje u sobu** — `firstFreeSeat`, `canAdmitNewcomer`, `assertCanJoin`,
  auto-posjedanje u `attach` (§3.3),
  **čuvanje sjedala** — `holds: Map<uid, SeatHold>`, `holdFor`, `activeSeatFor`,
  `abandonSeat`), `gameRoom.ts` (drži `GameState`, poziva `reduce`, botove,
  timere, šalje `viewFor` svakom sjedalu), `bots/` adapter na `@bela/bots`.
- `gameRoom.isBotControlled(seat)` je **isključivo** „je li na sjedalu bot”.
  Odsutan čovjek nije bot: njemu teče normalan `turnTimeoutMs` i bot odigra tek
  na isteku (§3.1). Ranije je vraćalo `!slot.connected`, pa je bot počinjao
  igrati istog trenutka kad bi nekome puknula veza.
- Botovi igraju s malim kašnjenjem (900–1700 ms) da se svako zvanje i odigrana
  karta mogu jasno pratiti, a tempo i dalje ostane prirodan.
- Env: `GAME_PORT=8285`, `FIREBASE_PROJECT_ID`, `GAME_DEV_ALLOW_ANON`, `GAME_CORS_ORIGINS`.
- Dockerfile (multi-stage, node:22-alpine), `docker-compose.prod.yaml` servis `game`,
  Caddy: `handle /ws/game* { reverse_proxy game:8285 }` **prije** generičkog `/ws/*`.

## 5. Bot (`@bela/bots`)
```ts
interface Bot {
  chooseBid(view: PlayerView, legal: {canPass: boolean; suits: Suit[]}, rng: () => number): Suit | "PASS"
  chooseCard(view: PlayerView, legal: Card[], rng: () => number): Card
}
createBot(): Bot
```
**Postoji točno JEDAN bot** (`heuristicBot`) — razine težine ukinute su
2026-09-08. `createBot()` ne prima argument, `Bot` nema polje za težinu, a
`SeatInfo.occupant` bota nosi samo `name`. Bot je bez stanja, pa jedna
instanca posluži sva botovska sjedala u sobi.

**Bot uvijek zove belu.** `Bot` nema metodu za taj izbor i `gameRoom` botov
potez šalje **bez `bela` zastavice**, a bez odgovora se bela prijavljuje
(§1.4) — 20 bodova je dobitak na velikoj većini podjela. Isti put prolazi i
potez koji bot odigra umjesto čovjeka kojemu je istekao timer ili je otišao
(§3.1), pa je pravilo jedno za sve „nitko nije odgovorio” slučajeve.
- **Heuristika: `game/BOT.md`.** Botova logika je zaseban normativni dokument,
  jer je prerasla ovaj odjeljak: što bot misli, zašto, i iz kojeg nepisanog
  pravila bele to dolazi (izvor je korisnikov dokument s trikovima, primijenjen
  2026-09-09). Ukratko: zvanje se ocjenjuje po **cijeloj ruci**
  (`handTricks`) uz minimum u samoj adutskoj boji; odbacivanje na štih koji
  nosi NAŠ par je **poruka** suigraču (`signalDiscard`), a ta se poruka i
  **čita** (`partnerSignal`); otvaranje ide po redoslijedu iz BOT.md §5.
  Mijenjaš li heuristiku, prvo BOT.md pa kod.

- **Bot pamti sve odigrano.** `gameRoom.actForSeat` gradi pogled s
  `viewFor(st, seat, { recallTricks: true })`, pa bot uvijek ima
  seat-atribuiranu povijest štihova bez obzira na sobnu opciju `trickReview`
  (§1.8). To nije povlaštena informacija — čovjek za stolom pamti iste javno
  odigrane karte — a bez toga signalizacija iz §2 BOT.md ne bi bila moguća jer
  je bot bez stanja. Sve ostalo ostaje skriveno i botu: tuđe ruke, talon,
  zvanja para koji je izgubio natjecanje zvanja.

- **Mjerenje 2026-09-09.** Seeded self-play, novi bot protiv prethodnog, svaki
  seed odigran u **obje** postave sjedala (bez toga harness daje 46 % za dva
  IDENTIČNA bota — postava sjedala sama nosi tu razliku). Tri odvojena skupa
  seedova, 800 partija do 501 po skupu:

  | skup seedova | pobjede isporučenog bota |
  |---|---|
  | prvi (na kojem je ugađano) | 59,4 % |
  | drugi (neviđen) | 60,5 % |
  | treći (neviđen) | 60,5 % |

  Protivnik je bot od **prije oba današnja zahvata**, a mjereno je pod **novim**
  §1.5, za koji stari bot nije pisan — dio te razlike je taj nesklad, ne sama
  heuristika. Mjereno samo protiv bota od neposredno prije ove promjene (dakle
  već s ispravljenim §1.5), dobitak je 56,5 / 53,6 / 54,4 % po istim skupovima
  seedova.

  Doprinosi, mjereni pojedinačno na istom harnessu (50,0 % = nema razlike):
  - **zvanje** je cijeli dobitak. Najveći dio nije nova ocjena ruke nego to što
    je stari prag bio prestrog: sam spust `suitStrength ≥ 5.5` na `≥ 5.0` daje
    54,6 %. Ocjena cijele ruke uz minimum u adutu dodaje na to još ~1 pp.
    Stari prag je značio da je **34,3 % svih zvanja bilo na „mus”** — trećina
    podjela odlučena prisilnim zvanjem djelitelja na ruci koju nitko nije htio;
    sada je to 5,4 %, uz porast padova s 25,5 % na 29,0 %;
  - **igra** (signalizacija, punjenje, otvaranje) mjeri se **neutralno**
    (50,0 %). Zadržana je jer ispravlja konkretne prijavljene greške, ne zato
    što jača bota;
  - pozicijske korekcije praga (suigrač prvi na igri, bez dečka pod protivnikom,
    spašavanje suigrača iz musa) su unutar šuma na tri skupa seedova. Zadržane
    su jer su izravno iz dokumenta.

  **Drugi krug istog dana** — preostala pravila iz BOT.md (obrambena otvaranja,
  čitanje protivničkih zvanja, izbor A/10 po zvaču, devetka na suigračev niski
  adut, brojanje prolaza, istjerivanje zadnjeg aduta). Zajedno **51,0 %** na
  ista tri skupa seedova (51,0 / 51,5 / 50,5), dakle mali ali dosljedan
  dobitak. Pojedinačno, na istih 2400 partija:

  | pravilo | mjera | ishod |
  |---|---|---|
  | obrambena otvaranja | 50,6 % | ušlo |
  | protivnička zvanja usmjeravaju otvaranje | 50,3 % | ušlo |
  | prolaz nosi potkovanu 10 | 50,2 % | ušlo |
  | istjerivanje zadnjeg aduta | 50,0 % | ušlo |
  | A/10 po zvaču + devetka na niski adut | 49,9 % | ušlo (rijetko se okidaju) |
  | „zadnja boja koju nitko nema” | 49,3 % | **izvan**, BOT.md §11 |
  | „vrati aduta” | 49,6 % | **izvan**, BOT.md §11 |

  Obrambena otvaranja su morala biti **sužena na četiri oblika ruke** iz
  dokumenta; verzija koja se okidala na svako obrambeno otvaranje koštala je
  pola postotnog boda. Pravilo „K ili Q na suigračevu malu kartu” pokazalo se
  suvišnim: ispravljeni §1.5 ga već prisiljava, pa se funkcija nije okinula
  nijednom u 800 partija.

  **Treći krug (isti dan), na izričit zahtjev.** Četiri pravila koja je
  mjerenje bilo izbacilo vraćena su u bota, plus ciljanje štiglje koje dotad
  nije bilo napisano. Cijena je izmjerena i stoji u BOT.md §11: sva četiri
  zajedno **45,8 %** protiv verzije prije njih, a bez „dečka u glavu” 49,3 % —
  dakle dečko je gotovo cijela razlika (−3,5 pp sam). Regresijski guard protiv
  nasumičnog igrača pao je s 27/30 na 25/30 (prag je 18/30). Ciljanje štiglje
  mjeri se neutralno i po prirodi je rijetko (štiglja pada u oko 0,4 % podjela).
  Jedino blefiranje ostaje neimplementirano.

  **Četvrti krug: zaključivanje (BOT.md §11).** Bot je dotad brojao što je
  VIĐENO, ali ne i što je REČENO. Dodano: zvanja **imenuju točne karte**, pa se
  svaka karta iz vidljivog zvanja locira u tu ruku; adutsko otvaranje se čita
  kao rečenica (zvač izašao asom → ima dečka i devetku; K ili Q → nema dečka);
  bela se veže uz **sjedalo** koje je odigralo K ili Q, jer je u pogledu samo
  tim. Sve to ulazi u jedno mjesto — procjenu mogu li protivnici presjeći — pa
  svako pitanje nizvodno dobiva točniji odgovor. Uz to bot sad i **šalje** belu
  po konvenciji (kralj, a s devetkom baba).

  Mjereno **50,7 %** (50,7 / 50,6 / 50,7 po skupovima), pozitivno na sva tri.
  Regresijski guard se vratio s 25/30 na 26/30.

  Probano i obrisano: „najjača karta protiv protivnika” umjesto obične najjače,
  −0,5 do −0,9 pp u svakoj kombinaciji. Razlog je poučan: pod ispravljenim §1.5
  partnerova jača karta pri **vođenju** nije prednost nego teret, jer ga pravila
  tjeraju da prijeđe preko mene i potroši je na moj štih.

  Što je nestalo iz ponašanja (brojano na 60 seedanih partija u self-playu):
  odbacivanja **golog asa** 29 → **0**; otvaranja solo kartom 440 → 272.
  Karata od ≥10 bodova upunjenih u suigračev štih koji protivnik onda ukrade:
  **0** — to je bila prijava „bot bezveze puni s jakim kartama”. Preostali
  „darovi” protivniku dolaze isključivo iz **vođenja** asa (namjeran rizik koji
  `shouldSpendAce` odvaguje), a ne iz odbacivanja.

- **Regresijski guard.** `packages/bots/test/simulation.test.ts` drži lokalni
  *test-baseline*: nasumičan legalan igrač (pasira kad smije, u musu zove
  najjaču boju). To NIJE bot — ne izvozi se i ne smije se ugraditi u server —
  nego fiksno mjerilo protiv kojega bot mora dobiti **≥ 60 % od 30 seedanih
  partija** (zadnje mjereno 27/30 = 90,0 %; prije ove promjene 26/30 = 86,7 %). To je jedini detektor regresije
  koji botovska heuristika ima; ne briši ga bez zamjene.

## 6. UI (`frontend/src/game/`)
Rute: `/igra` (lobby) i `/igra/soba/:roomId`. Lazy chunk, `GameIdentityGate`.
Gosti unose ime spremljeno u pregledniku. `hello { guest: { name, secret } }`
koristi nasumičnu 256-bitnu tajnu za stabilan identitet; poslužitelj objavljuje
samo njezin SHA-256 identifikator. Tajna se ne šalje drugim igračima.
Statistika gosta nema UID (`isGuest: true`, `isBot: false`) i ne veže se uz profil;
prijavljeni suigrači zadržavaju svoju statistiku prema pravilima prihvatljivosti.
- `game/gameConnection.ts` — **jedna WS konekcija po kartici, izvan Reacta**
  (modul-singleton), a `hooks/useGameSocket.ts` je samo `useSyncExternalStore`
  nad njim + „retainer”. Odluka i zašto baš tako:
  - članstvo u sobi mora **preživjeti odlazak s `/igra/*`** (v. `ActiveRoomWidget`
    i „ostani u sobi” niže). Dok je socket živio unutar stranice, odlazak je
    rušio vezu, server je vidio disconnect i sjedalo je bez razloga trošilo
    svoje čuvanje;
  - **nije** provider u `main.tsx`: to bi otvaralo WebSocket **svakom**
    posjetitelju stranice i uvuklo game-chunk u kritični bundle. Ovako se modul
    uvozi samo iz `src/game/**`, ne otvara ništa dok ga netko *aktivno* ne
    zadrži (game stranica, ili widget kad postoji „sticky” članstvo) i sam se
    zatvara 3 s nakon zadnjeg korisnika;
  - `sessionStorage["bela:game:room"]` (`game/activeRoomKey.ts`, modul bez
    ijedne dependencyje da ga `App.tsx` smije uvesti) pamti sobu čije članstvo
    svjesno držimo, pa reload na bilo kojoj ruti vraća widget.
- `components/ActiveRoomWidget.tsx` — mali „aktivna soba” dock dolje desno na
  **svim rutama osim `/igra*`** (stol je stol, a predvorje ima svoju veću
  karticu): ime sobe, tko je za stolom, povratak, izlaz; sklopiv i odbaciv.
  Diže se iznad `MobileTabBar`-a preko `MOBILE_TABBAR_CLEARANCE`.
- `components/GameRoomExitGuard.tsx` — klik iz sobe na ne-game rutu pita
  „ostani u sobi ili izađi”. **Ne** koristi `useBlocker` jer aplikacija ima
  obični `<BrowserRouter>` (blocker traži data router), nego hvata klik na
  `<a href>` u capture fazi prije react-routera. Pita samo kad stvarno sjedimo
  za stolom; gledatelj prolazi bez pitanja.
- `components/ReconnectBanner.tsx` + `hooks/useHoldCountdown.ts` — odbrojavanje
  čuvanja sjedala, isto i nad stolom i u predvorju. Stol prosljeđuje
  `socket.holdUntil`: to je **izvedena** vrijednost (trenutak pada socketa +
  `DEFAULTS.reconnectGraceMs`), jer kad veza pukne server nema kome javiti
  svoj rok; predvorje koristi mjerodavni `activeSeat.holdUntil` sa servera.
- Komponente: `GameLobbyPage`, `GameRoomPage`, `Table` (4 sjedala oko stola,
  moj sjedalo uvijek dolje), `Seat` (avatar/ime/bot badge/timer prsten),
  `Hand` (lepeza, legalne karte podignute, ilegalne zatamnjene), `PlayingCard`
  (DOM/CSS karta, francuski simboli, hrvatske boje u tooltipu), `TrickArea`
  (4 karte, animacija "let" iz sjedala u centar, pobjednik skuplja), `BiddingPanel`,
  `ScoreBoard` (tekuće + povijest podjela), `DeclarationsReveal`,
  `TrickHistory` (gledanje štihova, §1.8 — otvara se gumbom „Štihovi" na stolu
  i prikazuje se samo ako soba to dopušta; sadržaj dolazi gotov iz
  `view.trickHistory`), `RoomPanel` (sjedala, botovi, ready, start; „Sva su
  mjesta zauzeta” piše **samo** kad slobodnog sjedala doista nema, inače nudi
  „Sjedni ovdje”), `RoomListItem` (redak predvorja: `occupants` po imenima,
  botovi kao botovi, badge „Puna” i odbijanje klika kad `joinable` nije
  istinit), `Chat`.
  Završena partija vraća istu sobu u LOBBY, uz konačni rezultat, sačuvana
  mjesta i pravila. Nova partija resetira rezultat i povijest.
- Animacije: CSS transitions/keyframes (bez novih dependencyja): dijeljenje
  (karte "izlaze" iz djelitelja), bacanje (translate iz sjedala u centar 250 ms),
  skupljanje štiha (klizi prema pobjedniku, 400 ms), `prefers-reduced-motion`.
- Sve stringove u `i18n/{hr,sl}/game.ts` (novi namespace `game` — registrirati u
  oba `index.ts` composera). Plurali kroz `usePlural`.
- Mobitel: stol full-height (`100dvh - chrome`), ruka je scrollabilna lepeza,
  `MobileTabBar`/`SiteFooter` skriveni na `/igra/*` (isti obrazac kao `/turniri/novi`).

## 7. Odluke (zašto)
- **TS engine dijeljen server/klijent** umjesto Jave u Quarkusu: jedan jezik za
  pravila, botove i UI; klijent može lokalno računati legalne poteze za UX bez
  round-tripa; engine je čist i testabilan bez kontejnera.
- **Zaseban Node proces** umjesto proširenja Quarkusa: izolacija (pad igre ne
  ruši turnire), horizontalno neovisan deploy, zero-dep engine u istom jeziku.
- **Auto-zvanja**: manje UI-a, nema "zaboravio sam zvati"; jasno dokumentirano.
- **Bez perzistencije v1**: sobe u memoriji. Statistika je perzistentna od v2
  (§8) — living u glavnoj Postgres bazi (backendu), ne u Node procesu; sobe
  same ostaju in-memory, samo je gotova partija ono što se sprema.

## 8. Statistika igrača (v2)

Perzistencija živi u **glavnoj aplikaciji** (Postgres, Quarkus backend), ne u
`game/`-u — jedna baza, jedan Liquibase changelog, isti obrazac kao
`UserProfile` (keyed po Firebase UID-u). Node game server je samo
**izvjestitelj**: na `GAME_OVER` javlja gotovu partiju backendu preko
internog, ne-javnog endpointa; ne drži ništa perzistentno sam.

### 8.1 Pravilo brojanja — NORMATIVNO
**Partija se broji u statistiku samo ako OBA tima imaju barem jednog
čovjeka.** Ekvivalentno: ne broji se ako je jedan cijeli tim (oba sjedala)
sačinjen isključivo od botova — to pokriva najčešći slučaj (1 čovjek + 3
bota, zadani tijek kad netko sam pokrene igru) i simetrični slučaj obrnuto.
Par čovjek+bot naspram dva čovjeka **se broji** — igrač je stvarno igrao
protiv pravih ljudi, bot-partner ne obezvrjeđuje to. Ovu odluku donosi
**Node server** (`gameRoom.ts`/`room.ts` u trenutku `GAME_OVER`, zna točno
tko je čovjek/bot po sjedalu) — backend ne filtrira ništa, prima samo ono što
vrijedi zabilježiti.

### 8.2 Kategorije
Kategorija = `targetScore` partije: `501 | 701 | 1001`. Globalna statistika =
zbroj preko sve tri kategorije. Nema drugih kategorija u v2 (razina botova,
adut i sl. NE ulaze u kategorizaciju).

### 8.3 Shema (Postgres, Liquibase, backend)
Dvije tablice, changeset id `2026-09-08-game-stats`, autor `mrodek`:

```sql
game_results (
  id            BIGSERIAL PRIMARY KEY,
  uuid          UUID NOT NULL UNIQUE,      -- idempotency key, generira ga Node
  played_at     TIMESTAMPTZ NOT NULL,
  target_score  SMALLINT NOT NULL CHECK (target_score IN (501, 701, 1001)),
  winner_team   CHAR(1) NOT NULL CHECK (winner_team IN ('A','B')),
  score_a       INTEGER NOT NULL,
  score_b       INTEGER NOT NULL,
  deals_count   SMALLINT
)

game_result_players (
  id               BIGSERIAL PRIMARY KEY,
  game_result_id   BIGINT NOT NULL REFERENCES game_results(id) ON DELETE CASCADE,
  seat             SMALLINT NOT NULL CHECK (seat BETWEEN 0 AND 3),
  team             CHAR(1) NOT NULL CHECK (team IN ('A','B')),
  uid              VARCHAR(128),           -- NULL za bota
  is_bot           BOOLEAN NOT NULL,
  won              BOOLEAN NOT NULL,       -- team = winner_team, denormalizirano radi jednostavnog upita
  UNIQUE (game_result_id, seat)
)
-- index: game_result_players(uid), game_result_players(uid, ...) preko join na game_results.target_score
```
Statistika je uvijek **izračunata upitom** (GROUP BY po `target_score`, i bez
filtra za globalno) — nema odvojene agregatne tablice koja bi mogla otići iz
sinkronizacije.

### 8.4 Interni endpoint (Node → Java) — NIJE za korisnike
`POST /api/internal/game-results` — zaštićen dijeljenom tajnom, NE Firebase
tokenom (ovo je server-server poziv). Header `X-Internal-Token: <GAME_RESULTS_TOKEN>`,
ista env varijabla na oba servisa; 401 bez nje/pogrešne. Caddy mora **blokirati
ovaj put izvana** (404), isto kao `/api/q/*` — interni promet ide preko
`bela_internal` docker mreže, token je dodatni sloj obrane, ne jedini.

Tijelo (Node šalje ovo TOČNO nakon `GAME_OVER`, samo ako §8.1 kaže da se broji):
```json
{
  "resultId": "uuid-v4",
  "playedAt": "2026-09-08T20:00:00Z",
  "targetScore": 1001,
  "winnerTeam": "A",
  "scoreA": 1041, "scoreB": 789,
  "dealsCount": 10,
  "players": [
    { "seat": 0, "team": "A", "uid": "firebase-uid-1", "isBot": false },
    { "seat": 1, "team": "B", "uid": "firebase-uid-2", "isBot": false },
    { "seat": 2, "team": "A", "uid": null, "isBot": true },
    { "seat": 3, "team": "B", "uid": "firebase-uid-3", "isBot": false }
  ]
}
```
Backend: upsert na `uuid` (ON CONFLICT DO NOTHING, isti obrazac kao
`IdempotencyService` — retry s istim `resultId` ne smije duplo zabrojiti,
Node ne pamti je li POST prošao ako veza padne usred odgovora).
Odgovor `200 { "recorded": true|false }`. Node best-effort: ako POST padne
(backend dolje), zabilježi grešku i nastavi — gubitak jedne partije statistike
nije kritičan, partija za igrače nije pogođena.

### 8.5 Korisnički endpoint (čitanje, Firebase auth)
`GET /user/me/game-stats` (postojeći `UserMeController`, `@Authenticated`):
```json
{
  "global": { "games": 42, "wins": 25, "losses": 17, "winRate": 0.595 },
  "byTargetScore": {
    "501":  { "games": 10, "wins": 6,  "losses": 4,  "winRate": 0.6 },
    "701":  { "games": 5,  "wins": 2,  "losses": 3,  "winRate": 0.4 },
    "1001": { "games": 27, "wins": 17, "losses": 10, "winRate": 0.63 }
  }
}
```
Prikaz: nova kartica na profilu (`frontend/src/pages/profile/`), uz postojeće
`TournamentsCard`/`MyPairsCard` uzorak. hr + sl i18n, obavezno.
