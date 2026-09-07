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
- **Bela se uvijek boduje** timu koji je drži, neovisno o gornjoj usporedbi, i
  ne sudjeluje u usporedbi "najjače zvanje". Automatski se prijavljuje kad igrač
  odigra prvu od te dvije karte (K ili Q aduta).
- Zvanja se prijavljuju u **prvom štihu**, kad igrač odigra svoju prvu kartu, i
  postaju vidljiva svima (karte zvanja se prikazuju) tek kad prvi štih završi.
  Engine ih računa odmah nakon dijeljenja 8 karata i pamti; UI ih otkriva
  nakon prvog štiha (`deal.declarationsRevealed` event).

### 1.5 Igranje štihova
Prvi štih otvara `next(dealer)`; svaki sljedeći otvara pobjednik prethodnog.
Legalan potez (`legalMoves(state, seat)`), gdje je `L` boja prve karte, `T` adut:

1. **Imaš `L`** → moraš igrati `L`.
   - Ako je `L === T` (aduti vode): moraš igrati **jači adut od trenutno
     najjačeg u štihu** ako ga imaš ("u adutu se mora ići preko"); inače bilo koji adut.
2. **Nemaš `L`**:
   - Ako tvoj **partner trenutno drži štih** → smiješ igrati **bilo što**.
   - Inače, ako imaš adut → **moraš adutirati**; ako je već adut u štihu, moraš
     igrati **jači adut** ako ga imaš, inače bilo koji adut.
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
- Cilj: `targetScore` (default **1001**, opcija 501). Igra završava **na kraju
  podjele** u kojoj je bar jedan tim `≥ target`. Pobjeđuje tim s više bodova;
  kod izjednačenja igra se još jedna podjela.

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

// Faze podjele
type Phase = "BIDDING" | "PLAYING" | "DEAL_DONE" | "GAME_OVER"

interface GameConfig { targetScore: 501 | 1001; seed: string }

interface GameState {                   // PUNO stanje — samo server ga vidi
  config: GameConfig
  dealNo: number                        // 1-based
  dealer: Seat
  phase: Phase
  hands: Record<Seat, Card[]>           // karte u ruci (sortirane deterministički)
  bidding: { turn: Seat; passes: Seat[]; trump: Suit | null; caller: Seat | null }
  trick: { leader: Seat; turn: Seat; cards: { seat: Seat; card: Card }[] }
  tricksWon: Record<Team, { cards: Card[] }[]>   // po redu osvajanja
  declarations: Record<Seat, Declaration[]>      // izračunato nakon 8 karata
  belaDeclared: Team | null
  dealScore: DealScore | null            // popunjeno u DEAL_DONE
  score: Record<Team, number>            // ukupno kroz igru
  history: DealScore[]                   // sve završene podjele
  rng: RngState
  winner: Team | null
}

interface Declaration { kind: "FOUR" | "SEQUENCE" ; cards: Card[]; points: number }
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
  | { type: "PLAY"; seat: Seat; card: Card }
  | { type: "NEXT_DEAL" }                // iz DEAL_DONE → nova podjela (ili GAME_OVER)

// Funkcije
newGame(config: GameConfig): GameState            // odmah dijeli prvu podjelu (6 karata), phase BIDDING
reduce(state, action): { state: GameState; events: GameEvent[] }   // baca EngineError na ilegalnu akciju
legalMoves(state, seat): Card[]                   // [] ako nije na potezu / nije PLAYING
legalBids(state, seat): { canPass: boolean; suits: Suit[] }
viewFor(state, seat: Seat | null): PlayerView     // REDAKTIRANO stanje (tuđe karte → samo broj); null = promatrač
teamOf(seat): Team ; nextSeat(seat): Seat ; partnerOf(seat): Seat
cardPoints(card, trump): number ; trickWinner(cards, trump): Seat
findDeclarations(hand: Card[]): Declaration[]     // čisto, testabilno
```

`GameEvent` (za animacije/UI, isti tipovi su u `@bela/protocol`):
`DEALT`, `BID` {seat,trump}, `PASS` {seat}, `TRUMP_SET` {trump,caller}, `HAND_COMPLETED`
(8 karata), `CARD_PLAYED` {seat,card}, `BELA` {seat}, `TRICK_WON` {winner, cards, points},
`DECLARATIONS_REVEALED` {perSeat, scoringTeam}, `DEAL_SCORED` {dealScore}, `GAME_OVER` {winner}.

Engine je **deterministički**: `newGame({seed})` + isti niz akcija ⇒ isto stanje.
Test-suite (vitest) mora pokriti: kompletnu podjelu iz seeda, sva pravila
legalnih poteza (svaka grana 1.5), svako zvanje i usporedbu, štiglja, pad,
bela, kraj igre, mus djelitelja.

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
- **Soba**: `room.create {name, targetScore, private}` → `room.joined {room}`;
  `room.join {roomId}`; `room.sit {seat}`; `room.stand`; `room.addBot {seat, level}`;
  `room.removeBot {seat}`; `room.ready {ready}`; `room.start` (host; prazna sjedala
  se pune botovima "srednje"); `room.leave`. Server emitira `room.state` svima u sobi.
- **Igra**: `game.bid {trump}` / `game.pass` / `game.play {card}` / `game.nextDeal`
  → server emitira `game.state {view}` + `game.events {events}`.
- **Chat**: `chat.send {text}` → `chat.msg`. Max 300 znakova, rate-limit 1/s.
- **Timeri**: potez ima `turnTimeoutMs` (default 30 000). Istekom bot odigra za
  igrača (`game.state.autoPlayed` označava). Disconnect: sjedalo se čuva
  `reconnectGraceMs` (default 90 000), bot igra u međuvremenu; nakon isteka bot
  trajno preuzima do kraja igre.
- **Greške**: `error { code, message }`, `code` ∈ `UNAUTHENTICATED | ROOM_NOT_FOUND |
  ROOM_FULL | SEAT_TAKEN | NOT_HOST | NOT_YOUR_TURN | ILLEGAL_MOVE | RATE_LIMITED | BAD_REQUEST`.
  Poruke su hrvatske, ali klijent prevodi po `code` (hr/sl).

## 4. Server (`@bela/server`)
- `ws` biblioteka, jedan proces, sve u memoriji (v1: bez baze). Sobe nestaju
  kad su prazne 5 min ili igra završi + 10 min.
- Struktura: `config.ts` (env), `auth.ts` (JWKS, `jose`), `ws.ts` (konekcije, parse,
  rate-limit, heartbeat ping 25 s), `lobby.ts`, `room.ts` (sjedala, ready, host),
  `gameRoom.ts` (drži `GameState`, poziva `reduce`, botove, timere, šalje
  `viewFor` svakom sjedalu), `bots/` adapter na `@bela/bots`.
- Botovi igraju s malim kašnjenjem (600–1400 ms) da izgleda prirodno.
- Env: `GAME_PORT=8285`, `FIREBASE_PROJECT_ID`, `GAME_DEV_ALLOW_ANON`, `GAME_CORS_ORIGINS`.
- Dockerfile (multi-stage, node:22-alpine), `docker-compose.prod.yaml` servis `game`,
  Caddy: `handle /ws/game* { reverse_proxy game:8285 }` **prije** generičkog `/ws/*`.

## 5. Botovi (`@bela/bots`)
```ts
interface Bot {
  level: "lako" | "srednje" | "tesko"
  chooseBid(view: PlayerView, legal: {canPass: boolean; suits: Suit[]}, rng: () => number): Suit | "PASS"
  chooseCard(view: PlayerView, legal: Card[], rng: () => number): Card
}
createBot(level): Bot
```
- `lako`: nasumičan legalan potez; zove adut samo kad mora (mus) — najjaču boju.
- `srednje` (default): heuristika. Zvanje: ocjena boje = J 4 + 9 3 + A 1.5 +
  10 1 + 0.5 po dodatnoj karti; zovi ako ≥ 5.5 (djelitelj: najbolja boja bez
  praga). Igra: ako partner drži štih i ja sam zadnji → daj najvrjedniju
  legalnu ("dodaj bode"); ako mogu uzeti štih → uzmi najjeftinijom kartom koja
  pobjeđuje (osim ako je štih siromašan i trošim J/9 aduta); inače baci
  najjeftiniju; kad otvaram: adut J ako zovem i imam ga, inače as ne-adutske boje,
  inače najkraća boja najniža karta. Nikad ne "loži" (ne daje bodove) protivniku
  kad ima izbor.
- `tesko`: `srednje` + jednostavna determinizacija (N=40 nasumičnih raspodjela
  neviđenih karata, odigraj do kraja štiha heuristikom, izaberi kartu s najboljim
  prosjekom bodova). Opcionalno — smije ostati alias za `srednje` ako ne stigne,
  ali API mora postojati.

## 6. UI (`frontend/src/game/`)
Rute: `/igra` (lobby) i `/igra/soba/:roomId`. Lazy chunk, `RequireAuth`.
- `hooks/useGameSocket.ts` — jedna WS konekcija po stranici, auto-reconnect s
  backoffom, `hello` s Firebase tokenom, tipizirani `send`/`on`.
- Komponente: `GameLobbyPage`, `GameRoomPage`, `Table` (4 sjedala oko stola,
  moj sjedalo uvijek dolje), `Seat` (avatar/ime/bot badge/timer prsten),
  `Hand` (lepeza, legalne karte podignute, ilegalne zatamnjene), `PlayingCard`
  (DOM/CSS karta, francuski simboli, hrvatske boje u tooltipu), `TrickArea`
  (4 karte, animacija "let" iz sjedala u centar, pobjednik skuplja), `BiddingPanel`,
  `ScoreBoard` (tekuće + povijest podjela), `DeclarationsReveal`,
  `RoomPanel` (sjedala, botovi, ready, start), `Chat`, `GameOverDialog`.
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
- **Bez perzistencije v1**: sobe u memoriji. Statistika/ELO = kasniji korak
  (backend endpoint `POST /api/game/results`).
