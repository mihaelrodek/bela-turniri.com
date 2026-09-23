# DEMO-LOBBY — lažna živost za testiranje prije lansiranja

> **PRIVREMENO.** Uključuje se samo s `GAME_DEMO_LOBBY=1`. Mora biti ugašeno
> prije pravog lansiranja i prije svake predaje u App Store / Google Play:
> recenzent bi vidio izmišljene igrače, a to je lažno predstavljanje.
> Bez zastavice poslužitelj se ponaša bajt-po-bajt kao prije.

## 1. Što korisnik treba vidjeti

- 8–12 soba, broj **luta** (nasumična šetnja, cilj se mijenja svakih par minuta).
- 5–6 soba **u igri**; od njih točno ~2 dopuštaju gledatelje, ostale ne.
- Ostale **čekaju**: netko sjedi, slobodno je 1 ili 2 mjesta (rijetko 3).
- Ciljevi: barem jedna 501, barem jedna 701, ostalo 1001 (povremeno brza 163).
  „Prolaz" i „dosta" pomiješano. Jedna do dvije **privatne** (zaključane) sobe
  kao kulisa.
- Sve se kreće: ljudi dolaze i odlaze iz čekaonica, sobe se pune i kreću,
  partije završavaju i sobe nestaju, otvaraju se nove. Ništa se ne događa u
  pravilnim razmacima.
- Pravi igrač koji sjedne u čekaonicu dobije suigrače: za 3–12 s dođe tko
  fali (ne svi odjednom), i kad je on „Spreman", igra krene za 2–5 s.

## 2. Tri dijela, jedan ugovor (`packages/server/src/demo/types.ts`)

| Dio | Datoteka | Zna | Ne zna |
|---|---|---|---|
| Tko su | `demo/identities.ts`, `demo/names.ts` | imena, lica, statistike, tempo | ništa o sobama |
| Kako | `room.ts`, `lobby.ts`, `gameRoom.ts` | sjesti, igrati, otići, zamijeniti | koliko soba treba |
| Kada | `demo/director.ts` | populaciju, životni ciklus, vrijeme | niz sjedala |

### 2.1 Lažna osoba na sjedalu

Novo **interno** stanje sjedala `kind: "DEMO"` (nosi `DemoIdentity`). Prema
klijentu se serijalizira **točno kao pravi igrač** (`kind: "PLAYER"`,
`connected: true`, `ready: true`, `UserInfo` s `uid: demo:…`, imenom, licem,
`gameStats`, `karma`, `reliability`). Kartama upravlja postojeći bot
(`isBotControlled`), a vrijeme razmišljanja dolazi iz `DemoTempo`, ne iz
`botThinkMin/Max`.

`DEMO` **nije** `PLAYER`: ne ulazi u statistiku, karmu, napuštanja, Live
Activity ni analitiku (`isDemoUid`). Ali se **broji kao čovjek** tamo gdje bi
soba inače bila raspuštena ili obrisana zbog „premalo ljudi".

`identity.karma` i `identity.reliability` (2026-09-21) su izgrađeni
ZAJEDNO i konzistentno (`demo/identities.ts` `makeKarma` +
`makeReliability`: `recentAbandons = KARMA_MAX − karma`) — popup uz karmu
lažne osobe mora imati isti trag kao popup uz karmu pravog igrača, nikad
prazan popover uz puni broj.

### 2.2 Životni ciklus sobe (jedan za sve)

`ČEKA (1–3 sjede) → PUNI SE → IGRA → GOTOVO (ljudi se raziđu) → nestaje`

Redatelj ne stvara „sobe koje igraju" i „sobe koje čekaju" — stvara sobe, a
**tempo punjenja** drži omjer. Iznimka je pokretanje poslužitelja: tada se
dio soba stvara odmah u igri i **premota** nekoliko dijeljenja unaprijed, da
lobby ne krene s osam partija na 0:0.

**Rok na tri sjedeća** (2026-09-21). Soba koja dođe do **tri** dobije rok od
20–70 s. Na roku se, kroz isti `structural()` mutex, dogodi točno jedno:
**dođe četvrti** i partija krene nakon uobičajene kratke stanke (dopušteno i
kad to digne broj partija JEDAN iznad trenutnog cilja; tvrda granica je
`max + 1` pojasa), ili **netko ode** pa soba padne na dva. Ta stolica onda
ostaje prazna **20–45 s** (`fillPauseUntil`) prije nego što je popunjavanje
smije opet dirati — soba koja se vrati na tri u istoj sekundi nikad nije ni
IZGLEDALA kao da je pala, a to je točno ono protiv čega je rok napisan.
Kasnije smije opet gore, s NOVIM rokom. Omjer je otprilike 65/35 u korist
četvrtog kad ima mjesta. Nitko se ne diže iz sobe kojoj već otkucava početak
(`startPending`) ni iz one koja se namjerno puni (`rushing`), a soba koja se
puni ne smije ostati zaključana u tom stanju: `rushUntil` je vraća pod
obična pravila. Sobe s jednim ili dva sjedeća smiju čekati dulje, ali ne
zauvijek: soba koja nakon 6–10 min još nije krenula ili se napuni i krene ili
se zatvori pa je zamijeni nova — popis se mora vidljivo mijenjati.

Kako su početci sad vođeni VREMENOM, prosjek se drži s druge strane: dok je
partija **više** nego što cilj traži, nitko se ne gura na tri (novi dolasci
samo dižu sobu s jedan na dva), a gotove partije se brže raziđu. Kad ih je
**manje**, redatelj je nestrpljiv: kraj partije odmah gurne populacijski
korak, razmak između koraka padne na 2–6 s, a soba koja pokriva manjak puni
se u NIZU (`rushFill`, stolica svakih 1,5–5 s) umjesto jedan čovjek po
koraku. Nikad više takvih nizova nego što je sam manjak i nikad preko stropa
pojasa — inače tri partije koje završe zajedno ostave lobby na tri stola
punu minutu.

Soba u kojoj sjedi PRAVI čovjek zadržava svoj ljudski tempo (puni se jedan po
jedan, 3–12 s) — na nju se ovo ne odnosi, i **nitko lažan iz nje ne ustaje**
dok čovjek sjedi i čeka: prazno mjesto se popunjava (`stepHumanFill`), nikad
se ne otvara.

### 2.3 Pravi igrač

- Sjeda normalno. Domaćin je lažna osoba, pa **redatelj** pokreće igru.
- Ode prije početka: soba se vraća u čekanje (netko lažan možda ode, netko dođe).
- Nestane usred igre (istek zadrške): sjedalo preuzima **nova lažna osoba**
  (`replace`), ne „Bot Ana". Bez kazne za karmu (nije bilo drugih ljudi).
- Rezultat partije protiv lažnih ljudi boduje se **isto kao protiv botova**.

### 2.4 Gosti u pravim sobama

Pravi čovjek otvori **javnu** sobu i čeka — i dosad bi zurio u tri prazne
stolice. Sad mu, nakon vjerodostojne pauze, dolaze **gosti**: lažne osobe na
sjedalima u sobi koju je otvorio pravi čovjek.

**Ugovor.** `RealRoomHandle` + `watchRealRooms` / `realWaitingRooms` na
`DemoLobbyApi` (`demo/types.ts`). Ručka je namjerno sitna: gost može **sjesti,
ustati i reagirati**, ništa drugo. Ne pokreće, ne zatvara, ne mijenja postavke
i nikad nije domaćin. `realWaitingRooms()` vraća prazno dok netko ne pozove
`watchRealRooms` — a to radi samo redatelj, pa je to ujedno i brava zastavice.

**Mehanika** (`room.guestSit` / `guestLeave` / `guestReact`). Gost se na žici
serijalizira **kao i svaka lažna osoba** (`PLAYER`, `connected`, `ready`),
sjeda po `SEAT_FILL_ORDER`, karte mu igra bot s njegovim tempom, i ne ulazi ni
u jednu statistiku (rezultat se boduje kao protiv botova). Razlika prema demo
sobi je jedna: **gost ne drži sobu na životu.** Kad ode zadnji pravi čovjek iz
čekaonice, soba nestaje kao i svaka prazna obična soba, a gosti s njom; ako
usred partije istekne zadrška jedinom pravom igraču, stol se raspusti kao i
protiv botova (gosti se NE broje kao ljudi u običnoj sobi). Domaćin zadržava
sve ovlasti: „Pokreni igru" ide normalnim putem (gosti se broje kao zauzeti i
spremni), „Dodaj bota" i dalje dodaje **vidljivog bota**, a zaključa li sobu,
gosti ostaju (oni su „ljudi") ali novih više nema.

**Tempo** (`director.ts`). Prvi gost ne prije 25–60 s od otvaranja sobe,
sljedeći svakih 10–35 s. Dok je u sobi samo JEDAN pravi čovjek i soba je mlađa
od 2 min, **zadnja stolica se ne dira** — možda čeka prijatelja; poslije toga
smije i četvrti. S dvoje ili više pravih ljudi popunjava se normalno. Svaki
dolazak ili odlazak pravog čovjeka vraća „tišinu" na ≥ 15 s. Gost koji
4–6 min čeka partiju koja ne kreće odustane i ode (kasnije može doći drugi), a
nakon partije se gosti raziđu jedan po jedan kroz 10–60 s. Najviše **dvije**
prave sobe istovremeno, i ništa od svega ovoga ako u lobbyju ima ≥ 6 pravih
soba. Sobe s gostima su PRAVE sobe i ne ulaze ni u jedan demo zbroj —
`demo.status` ih prijavljuje zasebno (`guestRooms`, `guestsSeated`).

## 3. Vjerodostojnost — što ne smije procuriti

Ime s „Bot", ikona bota, prazna statistika ili karma, identičan tempo svih
četvero, isti čovjek u dvije sobe, soba koja se napuni u istoj sekundi,
savršeno pravilni razmaci, „Bot X" nakon što pravi igrač ode, demo sobe u
admin analitici.

## 4. Zastavice

`GAME_DEMO_LOBBY=1` uključuje. Neobavezno: `GAME_DEMO_ROOMS=8-12`,
`GAME_DEMO_PLAYING=5-6`, `GAME_DEMO_WATCHABLE=2`. Pri pokretanju jedan glasan
`WARN` u zapisniku.

## 5. Klijent

Klijent (`frontend/src/game/**`) ne razlikuje `PLAYER` od lažne osobe na žici —
nema `isDemoUid` ni bilo kakvu granu po prefiksu uida bilo gdje u
`frontend/src`. Sve što slijedi mora doći TOČNO ovako da lažna osoba na
ekranu ne izgleda drukčije od pravog igrača:

- `occupant.kind: "PLAYER"` na svakom sjedalu (`SeatInfo.occupant` i
  `RoomOccupant` u lobby popisu) — nikad `"BOT"`. Klijent bota crta
  poluprozirno (`opacity 0.6` u `RoomListItem`) i preskače njegov turn-ring
  (`isBotTurn` u `GameRoomPage.tsx`), pa bi lažna osoba serijalizirana kao BOT
  odmah odala sebe.
- `connected: true`, `ready: true` uvijek. Klijent inače crta "Nije spojen"
  (`Seat.tsx`/`RoomPanel.tsx`) i pokreće `ReconnectBanner` s odbrojavanjem
  (`socket.holdUntil`) — ta dva prikaza se NIKAD ne smiju pojaviti za lažnu
  osobu jer prema ugovoru (§3.1) ona nikad ne "gubi vezu".
- `holdUntil: null/absent` iz istog razloga (drži zaslon Seat.tsx-a mirnim).
- `user.uid`: bilo koji string, `demo:` prefiks nikad ne smije procuriti u
  DOM/aria — klijent ga koristi samo za usporedbe (`room.hostUid ===
  socket.me.uid`, sjedanje/odlazak zvuk u `GameRoomPage`'s `seatedRef` efektu),
  nikad ga ne ispisuje.
- `user.name`: ≤ 16 znakova, prolazi `validatePlayerName` — klijent ga
  ispisuje doslovno (sjedalo, red u lobbyju, popup zvanja/belota, trick
  history).
- `user.avatarUrl: null` i `user.avatarPreset`: uvijek jedan od
  `AVATAR_PRESETS` (`@bela/protocol`). Bez valjanog presetа klijent pada na
  inicijale imena (`PlayerAvatar`/`SeatAvatar`), što ne bi bilo "isto kao
  pravi igrač".
- `user.gameStats`, `user.karma` i `user.reliability`: moraju biti popunjeni
  (ne `null`/`undefined`) da bi se prikazale `SeatStatPill`/`SeatKarmaPill` i
  njen popover — bez njih par u sobi ne pokazuje statistiku (ili karma-popup
  ostane prazan), što je točno "prazna statistika ili karma" iz §3 na koju
  upozorava ovaj dokument.
- `game.state.turnDeadline` / `turnDurationMs` moraju biti popunjeni za
  potez lažne osobe baš kao za ljudski (klijent gasi prsten SAMO za
  `occupant.kind === "BOT"`, ne za "PLAYER" — vidi `isBotTurn` u
  `GameRoomPage.tsx`). Bez toga bi prsten oko lažnog igrača ili stajao pun
  cijelo vrijeme ili se prazno ponašao — obje su primjetne anomalije.
- `room.hostUid` smije biti uid lažne osobe bez ikakvih dodatnih naprava na
  klijentu: "Pokreni igru" je već otvoren SVAKOM sjedećem igraču (ne samo
  domaćinu, 2026-09-20 promjena), a postavke sobe (ciljni rezultat, kraj
  igre…) su već sakrivene svakom ne-domaćinu, pravom ili lažnom — isto
  ponašanje kao u bilo kojoj sobi s ljudskim domaćinom, pa pravi igrač koji
  uđe u demo sobu s lažnim domaćinom ne može ostati "zaglavljen".
- Promjena okupanta sjedala (uid se promijeni dok par igra) klijent čuje kao
  "netko je otišao" / "netko je sjeo" (`seatedRef` efekt u `GameRoomPage.tsx`,
  po uidu, ne po kind-u) — ako redatelj ikad zamijeni jednu lažnu osobu za
  drugu NA istom sjedalu dok se igra, klijent će to odsvirati kao odlazak
  igrača. Nije greška, ali server tim treba znati da svaka promjena uida na
  zauzetom sjedalu proizvodi zvuk.
- Nema klik/link sa sjedala na `/profil/:slug` niti "prijavi" akciju bilo
  gdje u `frontend/src/game/**` — provjereno gredanjem cijelog stabla.
  Dakle nema rizika od 404 na lažnom profilu jer ta veza danas ne postoji;
  ako se ikad doda, mora pratiti isti "nema profila" prikaz koji već postoji
  za gosta/nepovezanog igrača (`profile.notFound` na `/profil/:slug`), a ne
  provjeru uid prefiksa.
