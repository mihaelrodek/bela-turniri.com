/* ──────────────────────────────────────────────────────────────────────────
   Bela blok — model podataka. Ugovor je `BLOK.md` u ovom direktoriju.

   Blok je zbrajanje bele koja se igra ZA STOLOM pravim kartama: nema partije,
   nema servera, nema prijave. Zato ovdje nema ničega iz `@bela/protocol` —
   jedina zajednička stvar s online igrom su pravila bodovanja, koja žive u
   `@bela/engine` (`scoreManualDeal`) jer su ista i moraju biti testirana.

   Sve što se može izvesti iz `rounds` NE spremamo (zbrojevi, pobjednik, broj
   zvanja): dva izvora istine za isti broj razilaze se prvi put kad netko
   uredi staru podjelu.

   Jedina iznimka od „nema servera” je NEOBAVEZNI `BlokGame.link` (v. dolje i
   `BLOK-LINK.md`): igrač koji sjedi za stolom na turniru može zamoliti
   organizatora da mu poveže blok sa stolom, pa rezultat sam stiže u zapisnik.
   Blok bez veze radi točno kao i prije — bez prijave, bez ijednog zahtjeva.
   ────────────────────────────────────────────────────────────────────── */

/** Naša / njihova strana. Imena su korisnička (`BlokGame.names`), ovo su ključevi. */
export type BlokSide = "us" | "them"

export const BLOK_SIDES: readonly BlokSide[] = ["us", "them"]

/** Four physical seats around the table, seen from the person using Blok. */
export type BlokDealerSeat = "self" | "rightOpponent" | "partner" | "leftOpponent"

/* ──────────────────── smjer kartanja (BLOK.md §3.3.2) ────────────────────
   Which way the deal travels around the table — the table convention people
   actually say out loud ("dijeli se u desno"), so it is spelled the way they
   say it and NOT as a rotation. Seen from the scorekeeper's own seat at the
   bottom of the drawn table, "right" reaches the right-hand opponent first,
   which happens to be counter-clockwise on screen; naming it after the
   rotation was the previous spelling and it never survived being read aloud.

   Stored values written before this rename are read forward in `store.ts`
   (`sanitizeDealDirection`): `"clockwise"` → `"left"`, `"counterclockwise"` →
   `"right"`. Nothing is rewritten on disk, so `BLOK_STORAGE_KEY` stays `v1`. */
/**
 * The longest a side's name may be — 32 characters (2026-09-09, user request).
 *
 * Enforced in the STORE, not only on the input: the rename dialog is one way
 * in, and a name that arrived any other way (a restored `localStorage`, a
 * linked table) must not be able to overflow the score card either. Counted in
 * characters as typed, punctuation included.
 */
export const MAX_SIDE_NAME = 32

export type BlokDealDirection = "right" | "left"

/** Chip order in "Postavke"; the default is first. */
export const DEAL_DIRECTIONS: readonly BlokDealDirection[] = ["right", "left"]
export const DEFAULT_DEAL_DIRECTION: BlokDealDirection = "right"

/* ──────────── tko miješa novu partiju (BLOK.md §3.3.4) ────────────
   Who deals the FIRST deal of the NEXT game of a series. Deals INSIDE a game
   always follow `BlokDealDirection`; this decides only where the next game
   picks the rotation up.

     • `"next"`    — carry straight on round the table. Whoever would have
                     dealt the next deal of the finished game deals the first
                     of the new one. This is what the blok has always done, so
                     it is the default and a stored game without the field
                     reads as this.
     • `"winner"`  — the pair that WON the game deals it. The rotation still
                     moves in the same direction; it just keeps stepping until
                     it lands on a seat of the winning pair, skipping the
                     losers. A game nobody won (no winner yet) falls back to
                     `"next"` — there is nothing to skip towards.

   Example, dealing to the LEFT, and the one the setting was written from: I
   dealt game one and we won it. Under `"next"` the left-hand opponent deals
   game two; under `"winner"` he is skipped and my PARTNER deals. */
export type BlokNewGameDealer = "next" | "winner"

/** Chip order in "Postavke"; the default is first. */
export const NEW_GAME_DEALERS: readonly BlokNewGameDealer[] = ["next", "winner"]
export const DEFAULT_NEW_GAME_DEALER: BlokNewGameDealer = "next"

export interface BlokDealerSetup {
    /**
     * The seat that dealt the FIRST deal of this game. Every later dealer is
     * derived from it (`dealerAt`), so nothing about the rotation is stored
     * twice — BLOK.md §2.
     */
    first: BlokDealerSeat
    /**
     * True once a person has NAMED the dealer in the tracker; false while the
     * blok is only guessing ("self dealt first" is the guess a fresh game
     * starts with).
     *
     * Not derived from `rounds` and so not a violation of §2: it is a record
     * of what somebody at the table said, in the same family as `sessionId`
     * and `BlokLink` — and it is the whole reason changing "Smjer kartanja"
     * cannot quietly overwrite a hand-set dealer (BLOK.md §3.3.2). Absent on
     * read means `false`, which keeps storage at `v1` with no migration.
     */
    chosen: boolean
}

/** Boje, istim imenima kao engine — blok ih koristi samo za ikonu u povijesti. */
export type BlokSuit = "HERC" | "KARA" | "PIK" | "TREF"

/** Zvanja koja se nude kao gumbi u unosu. Svako se može dodati više puta. */
export const DECLARATION_VALUES: readonly number[] = [20, 50, 100, 150, 200]

/* ─────────────── koliko puta jedno zvanje stane u JEDNU podjelu ───────────────
   Ograničenje GUMBA, ne pravilo bodovanja (BLOK.md §3.2). Špil je jedan: četiri
   dečka postoje jednom, pa 200 u jednoj podjeli može biti samo jednom — bez
   obzira na to kod koga je. Zato se broji PREKO OBJE STRANE podjele, nikad po
   strani: po strani bi list mirno primio dva 200, što fizički ne postoji.

   Namjerno NIJE u `scoreManualDeal` (BLOK.md §1.1): engine ne sudi kućna
   pravila i prima zvanja izvan ovih pet vrijednosti. Ovo samo onemogući gumb;
   podjela učitana iz pohrane koja premašuje granicu i dalje se prikazuje i
   dalje se uređuje (✕ je tu da se višak skine). */
export const DECLARATION_MAX_PER_DEAL: Readonly<Record<number, number>> = {
    20: 6,
    50: 4,
    100: 2,
    150: 1,
    200: 1,
}

/** Granica za vrijednost, ili `null` kad je nema (zvanje koje nije naš gumb —
 *  kućna pravila variraju i blok ih ne presuđuje). */
export function declarationCap(value: number): number | null {
    return DECLARATION_MAX_PER_DEAL[value] ?? null
}

/** Ponuđeni ciljevi; korisnik može upisati i svoj. */
export const TARGETS: readonly number[] = [501, 701, 1001]
export const DEFAULT_TARGET = 1001

/* ──────────────────── kako završava JEDNA partija ────────────────────
   Drugi dogovor za stolom, uz bodovni cilj i uz duljinu serije, i tiče se
   samo JEDNE partije (do 1001), ne serije:

   - `"prolaz"` — prijeći cilj nije dovoljno samo po sebi: partiju dobiva
     strana koja cilj prijeđe u podjeli koju je ZVALA i u njoj PROŠLA (nije
     pala). Tko prijeđe padajući, ili u tuđoj podjeli, igra dalje. Ovo je
     ZADANO pravilo (odluka korisnika, BLOK-HISTORY.md §5.5), pa se i partija
     spremljena bez ovog polja čita upravo tako.
   - `"dosta"` — partija završava čim neka strana dosegne ili prijeđe cilj;
     pobjeđuje viši zbroj. To je bilo ponašanje bloka do 2026-09-08 i sada je
     izbor koji se mora izričito odabrati.

   U oba slučaja izjednačen zbroj na cilju ili preko njega ne odlučuje ništa
   — igra se još jedna podjela (`winnerFrom` u `store.ts`, BLOK.md §1).

   PRAVILO ŽIVI NA JEDNOM MJESTU: `store.ts` → `winnerFrom` / `passedAndWon`.
   Zaglavlje i sažetak samo čitaju odgovor. */
export type BlokGameEndRule = "dosta" | "prolaz"

/** Redoslijed čipova u dijalogu; zadano je prvo (v. `DEFAULT_GAME_END_RULE`). */
export const GAME_END_RULES: readonly BlokGameEndRule[] = ["prolaz", "dosta"]
export const DEFAULT_GAME_END_RULE: BlokGameEndRule = "prolaz"

/* ─────────────────────────── serija ───────────────────────────
   Blok JE serija: partije za istim stolom teku jedna za drugom, rezultat
   ide 1:0, 2:1, 3:1, a zatvara je samo „Nova igra” — trenutak kad igrač
   kaže da je večer gotova, spremi je na profil i očisti blok (§5.6; do
   2026-09-08 se ta radnja zvala „Resetiraj”).

   Zato je zadano stanje OTVORENO (`seriesTarget === null`): nema broja
   partija koji seriju završava, i to je točno dosadašnje ponašanje.
   Neobavezno se može reći „igra se do 2” i tada serija ima kraj koji zna
   sama proglasiti. Ponuđeni izbor je 1 / 2 / 3 plus vlastiti broj, uz
   bodovni cilj i u istom dijalogu: to su dva broja koja zajedno opisuju
   kako se igra. */
export const SERIES_TARGETS: readonly number[] = [1, 2, 3]
/** Gornja granica; „do 100 dobivenih” nije serija nego pogrešan upis. */
export const MAX_SERIES_TARGET = 99

/* ─────────────────────── dijeljenje zapisnika ───────────────────────
   „Omogući dijeljenje” (BLOK.md §3.3.3, zahtjev korisnika 2026-09-08) —
   prekidač u „Postavke”, ZADANO uključen. Ugašen znači dvoje: gumb za
   dijeljenje se ne nudi, a token koji je korisnik sam izdao se poništava.

   JEDNA IZNIMKA, i nije pregovor: serija povezana sa stolom na turniru
   ostaje javna (BLOK-LINK.md §6.2 — organizator je otvara iz ždrijeba, i
   to je isti `share_token`). Klijent tu razliku zna po tome ima li partija
   `link`; bez njega je token samo korisnikov i smije se povući. */
export const DEFAULT_SHARE_ENABLED = true

/** Bodovi iz karata u jednoj podjeli (152 + 10 za zadnji štih). */
export const DEAL_CARD_POINTS = 162
/** Štiglja: sve karte + 90. */
export const STIGLJA_POINTS = DEAL_CARD_POINTS + 90

export interface BlokRound {
    /** `crypto.randomUUID()`. Redoslijed podjela je redoslijed u polju. */
    id: string
    /** Tko je zvao — bez toga se pad ne može izračunati. */
    caller: BlokSide
    /** Bodovi iz karata po strani: zbroj 162, ili 252/0 kod štiglje. */
    cards: Record<BlokSide, number>
    /** Pojedinačna zvanja kako su upisana (`[20, 20, 50]`), ne zbroj — u
     *  povijesti se onda vidi ŠTO je zvano, ne samo koliko. */
    declarations: Record<BlokSide, number[]>
    /** Strana koja je uzela svih 8 štihova, ili null. */
    stiglja: BlokSide | null
    /**
     * Strana koja je pokazala BELOT — svih osam karata jedne boje — ili null.
     *
     * Belot završava partiju na mjestu: ta strana dobiva **bodovni cilj**
     * partije (`BlokGame.target`) za tu podjelu, dakle 1001 na zadanoj igri i
     * 501 na igri do 501. Cilj se NE sprema u podjelu — prosljeđuje se
     * `scoreManualDeal`-u (BLOK.md §1.2), jer je dogovor partije, a ne
     * činjenica o podjeli.
     *
     * Podjela se ne igra, pa su `cards` **0/0** i `stiglja` je nužno `null`;
     * engine baca za svaki drugi oblik (§1.1).
     *
     * Pri čitanju iz pohrane se **toleriraju odsutna vrijednost** (svaka
     * podjela spremljena prije ove značajke) — čita se kao `null`, ništa se ne
     * prepisuje na disku i `BLOK_STORAGE_KEY` ostaje `v1`, bez migracije.
     */
    belot: BlokSide | null
    /** Adut te podjele, samo za prikaz; null kad nije upisan. */
    trump: BlokSuit | null
}

/** Status veze sa stolom, isti skup kao `match_score_links.status`. */
export type BlokLinkStatus = "PENDING" | "APPROVED" | "REJECTED" | "REVOKED"

/**
 * Veza ove igre sa stolom na turniru — BLOK-LINK.md §3.2.
 *
 * Sve osim zadnja tri polja je preslika onoga što server zna o vezi. Zadnja
 * tri su knjigovodstvo OVOG uređaja o mreži: nisu izvedena iz `rounds` (pa
 * ne krše pravilo „ništa izvedeno se ne sprema” iz §2), nego pamte što je i
 * kad otišlo van. Bez njih bi se isti rezultat slao u krug, a neuspjelo slanje
 * bi se zaboravilo čim se stranica ponovno učita.
 *
 * Veza traje koliko i SERIJA, ne pojedina partija (BLOK-LINK.md §6.1): meč se
 * na turniru vodi kao 2:0, pa je „Sljedeća partija” nasljeđuje, a gasi
 * je tek „Nova igra” — radnja koja zatvara seriju (BLOK-HISTORY.md §5.6).
 */
export interface BlokLink {
    uuid: string
    status: BlokLinkStatus
    tournamentUuid: string
    tournamentName: string
    roundNumber: number
    tableNo: number | null
    matchId: number
    /** Koji par je NAŠA strana. Fiksira se pri zahtjevu i ne mijenja se. */
    usPairId: number
    usPairName: string
    themPairName: string
    /**
     * Zadnji uspješno poslani rezultat SERIJE — koliko je partija koja strana
     * dobila (2 : 0), a NE zbroj bodova (BLOK-LINK.md §6.1). Služi samo tome da
     * se isto ne šalje dvaput.
     *
     * Polje se zove drukčije od prijašnjeg `syncedTotals` namjerno, i to je
     * jedina „migracija” koja je potrebna: veza spremljena prije revizije nosi
     * `syncedTotals` s BODOVIMA (npr. `{us: 543, them: 149}`), što bi pod novim
     * značenjem bila besmislena vrijednost. `sanitizeLink` čita samo ovo ime,
     * pa se stara vrijednost jednostavno ne pročita — `null` — i prvi ispravni
     * upis (rezultat serije) sigurno izađe van. `BLOK_STORAGE_KEY` ostaje `v1`.
     */
    syncedGames: { us: number; them: number } | null
    /**
     * Je li zadnji uspješno poslani upis bio KONAČAN (`final: true`).
     *
     * Dio je istog odgovora kao `syncedGames` — „što je zadnje otišlo van” — jer
     * isti rezultat serije može otići dvaput s različitim značenjem: privremeno
     * dok se igra, pa konačno kad serija bude odlučena. Bez ovoga bi promjena
     * «igra se do» s otvorene serije na «do 1» pri rezultatu 1:0 ostala
     * neposlana (brojevi se nisu promijenili), a „Nova igra” bi ponovila već
     * poslan konačan rezultat.
     */
    syncedFinal: boolean
    /** Epoch ms zadnjeg neuspjelog pokušaja; null kad je sve poslano. */
    pendingSince: number | null
    /**
     * Tajna kojom se NEPRIJAVLJENI uređaj dokazuje pri upisu rezultata i
     * čitanju stanja veze (BLOK-LINK.md §7.1). Server ju vraća **jednom**, pri
     * stvaranju veze, i nema je ni u jednom kasnijem odgovoru — pa ako se ovdje
     * izgubi, izgubljena je zauvijek i veza tiho prestane pisati.
     *
     * Neobavezna je jer je prijavljeni korisnik ne treba (njega server prepoznaje
     * po `requested_by_uid`), i jer veze spremljene prije §7 nemaju.
     */
    writeToken?: string
}

/**
 * Zajednički `sessionId` za sve igre spremljene PRIJE nego što je serija
 * postojala (BLOK-HISTORY.md §2.1).
 *
 * Stara spremljena igra nema `sessionId`, a polje je obavezno — pa joj se pri
 * učitavanju dodjeljuje ovaj jedan, zajednički id. Time se ništa ne gubi:
 * zatečene igre čine jednu „zatečenu” seriju koja se na prvu „Novu igru”
 * spremi i zatvori kao i svaka druga. Zato `BLOK_STORAGE_KEY` ostaje `v1` i
 * nema migracije — vrijednost se izvodi pri čitanju, ne prepisuje na disku.
 */
export const LEGACY_SESSION_ID = "blok-legacy-session"

export interface BlokGame {
    id: string
    /**
     * Serija kojoj ova partija pripada — sve partije s istim `sessionId` su
     * jedan zapis u povijesti (BLOK-HISTORY.md §2.1).
     *
     * Nije izvedeno iz `rounds` i zato ne krši pravilo „ništa izvedeno se ne
     * sprema” (BLOK.md §2): ovo je knjigovodstvo o tome za kojim se stolom
     * sjedilo, isto kao `BlokLink.syncedGames` niže. `newGame()` ga nasljeđuje
     * (ista serija, SLJEDEĆA PARTIJA — gumb u sažetku), `discardCurrent()` ga
     * zadržava, a `resetSession()` — izbornikova „Nova igra” od §5.6 — zatvara
     * staru i otvara novu seriju.
     */
    sessionId: string
    createdAt: number
    /** Postavlja se kad neka strana dosegne cilj; null dok igra traje. */
    finishedAt: number | null
    target: number
    /**
     * Koliko dobivenih partija nosi seriju („igra se do 2”), ili `null` za
     * OTVORENU seriju — a otvorena je zadano.
     *
     * `null` znači da ništa ne proglašava seriju gotovom: partije se nižu i
     * rezultat raste dok igrač ne pritisne „Nova igra”. To je i ponašanje
     * bloka prije nego što je ovo polje postojalo, pa spremljena partija bez
     * njega ostaje ista — `BLOK_STORAGE_KEY` ostaje `v1`, bez migracije.
     *
     * Nije izvedeno iz `rounds` — kao `target` i `names`, ovo je dogovor za
     * stolom, a ne rezultat. Sam REZULTAT serije (2 : 1) se nikad ne sprema:
     * broji se iz partija iste `sessionId` kroz `winnerOf` (BLOK.md §2).
     *
     * Nasljeđuje se u `newGame()` i `discardCurrent()` isto kao `target` i
     * `names`, da se sve partije jedne večeri slažu oko toga do koliko se
     * igra.
     */
    seriesTarget: number | null
    /**
     * Kako završava OVA partija — `"prolaz"` (zadano) ili `"dosta"`; v.
     * `BlokGameEndRule` gore i BLOK.md §3.5.
     *
     * Nije izvedeno iz `rounds`: kao `target`, `seriesTarget` i `names`, ovo
     * je dogovor za stolom. Partija spremljena bez polja se čita kao
     * `"prolaz"` (BLOK-HISTORY.md §5.5) — `BLOK_STORAGE_KEY` ostaje `v1`, bez
     * migracije. Posljedica je stvarna i namjerna: `winnerOf` pravilo
     * računa uživo, pa se partija spremljena prije ove promjene ponovno sudi
     * po „prolazu”.
     *
     * Nasljeđuje se u `newGame()`, `discardCurrent()` i `resetSession()` isto
     * kao ostala tri: sve partije jedne večeri igraju se po istom pravilu.
     */
    gameEndRule: BlokGameEndRule
    /** Who dealt the first deal of this game, and whether anybody said so. */
    dealer: BlokDealerSetup
    /**
     * Which way the deal goes round the table — `"right"` (the default) or
     * `"left"`. BLOK.md §3.3.2.
     *
     * A table convention, so it sits here beside `target`, `seriesTarget` and
     * `gameEndRule` rather than inside `dealer`: it is chosen once in
     * "Postavke" for the whole evening, and it is inherited by `newGame()`,
     * `discardCurrent()` and `resetSession()` exactly like those three.
     *
     * It drives the DEFAULT of who deals next (`dealerAt`) and the direction
     * the tracker shows. It never overrules a dealer somebody set by hand —
     * see `BlokDealerSetup.chosen` and `store.ts → setDealDirection`.
     *
     * Absent on read means the default, and a value written under the old
     * `dealer.direction` spelling is read forward, so storage stays `v1` with
     * no migration.
     */
    dealDirection: BlokDealDirection
    /**
     * Who deals the first deal of the NEXT game — `"next"` (the default) or
     * `"winner"`. BLOK.md §3.3.4.
     *
     * The fifth table convention, and it sits beside the other four for the
     * same reason: it is agreed once for the evening, out loud, and inherited
     * by `newGame()`, `discardCurrent()` and `resetSession()` exactly like
     * them. It changes nothing INSIDE a game — deals there follow
     * `dealDirection` as they always have.
     *
     * Absent on read means `"next"`, which is what every game saved before the
     * setting existed did, so storage stays `v1` with no migration.
     */
    newGameDealer: BlokNewGameDealer
    /**
     * Whether the "Sljedeći dijeli" strip above the MI/VI buttons is shown —
     * `true` by default (BLOK.md §3.3.2).
     *
     * The tracker was made OPTIONAL, not demoted: a table that passes the deal
     * without being told does not need a strip, and the row it costs is the row
     * the deal list wants. Absent on read means `true` — every game saved
     * before this setting existed had the strip — so storage stays `v1`.
     */
    showDealer: boolean
    /**
     * Whether this blok offers the "Podijeli zapisnik" control at all —
     * `true` by default (BLOK.md §3.3.3, user request 2026-09-08).
     *
     * A table agreement like the four above it, so it sits here and is
     * inherited by `newGame()`, `discardCurrent()` and `resetSession()` exactly
     * like them. Turning it OFF also revokes a token the player issued
     * themselves; it never touches the token a LINKED table's logbook is
     * published under (BLOK-LINK.md §6.2) — that record is what the organiser
     * opens from the bracket, and `game.link` is how this client tells the two
     * apart.
     *
     * Absent on read means `true` — every game saved before the switch existed
     * offered sharing — so storage stays `v1` with no migration.
     */
    shareEnabled: boolean
    names: Record<BlokSide, string>
    rounds: BlokRound[]
    /**
     * Veza sa stolom na turniru, ako je igrač povezao blok — NEOBAVEZNO.
     *
     * Neobavezno je namjerno i to je razlog zašto `BLOK_STORAGE_KEY` ostaje
     * `v1`: svaka već spremljena igra se učitava netaknuta, bez migracije.
     * Blok bez veze je i dalje isti blok bez servera i bez prijave.
     *
     * Veza pripada SERIJI, ne pojedinoj partiji (BLOK-LINK.md §6.1): meč na
     * turniru se vodi kao 2:0, dakle traje koliko i serija. Zato je `newGame()`
     * nasljeđuje kao i `sessionId`, a gasi je samo „Nova igra”, koja zatvara
     * seriju. Stoji na `BlokGame` samo zato što je ondje i `sessionId` — jedna
     * struktura, jedan zapis u `localStorage`.
     */
    link?: BlokLink
}

/**
 * Zapisnik ove serije na profilu i njegova poveznica za dijeljenje —
 * BLOK-HISTORY.md §5.1 i §5.2.
 *
 * Nije izvedeno ni iz čega (kao `BlokLink.syncedGames` i `pendingSessions`):
 * ovo je knjigovodstvo o razgovoru sa serverom — pod kojim je `uuid`-om serija
 * spremljena i je li za nju izdan token. Bez toga „Podijeli” ne zna kome se
 * obratiti, a gašenje prekidača „Omogući dijeljenje” ne zna da ima što povući.
 *
 * `uuid` postoji čim je serija jednom spremljena; `token` je `null` dok
 * korisnik nije zatražio poveznicu. Vrijedi samo za `sessionId` koji nosi —
 * „Nova igra” zatvara seriju i briše ovaj zapis (zapisnik i dalje živi na
 * profilu, gdje se njime i upravlja).
 */
export interface BlokShare {
    sessionId: string
    /** `uuid` zapisa na profilu — meta za `/share` endpointe. */
    uuid: string
    /** Token javne poveznice `/blok/z/{token}`, ili null ako nije izdan. */
    token: string | null
}

/** Sve što je spremljeno u `localStorage` pod jednim ključem. */
export interface BlokStorageV1 {
    version: 1
    current: BlokGame | null
    archive: BlokGame[]
    /**
     * Serije koje je „Nova igra” zatvorila, ali čije slanje na profil još nije
     * potvrđeno (BLOK-HISTORY.md §2.2, „Offline / neuspjelo slanje”).
     *
     * Dok je id ovdje, partije te serije OSTAJU u `archive` — brišu se tek kad
     * server potvrdi zapis. Namjerna zamjena: dvaput poslana serija je
     * bezopasna (server dedupira po `sessionId`), a serija obrisana prije nego
     * što je stigla nestala je zauvijek.
     *
     * Nije izvedeno ni iz čega — kao `BlokLink.pendingSince`, ovo je zapis o
     * razgovoru s mrežom, a ne o igri. Neobavezno pri čitanju, pa spremljeno
     * stanje starije od ove značajke i dalje ostaje `v1` bez migracije.
     */
    pendingSessions: string[]
    /**
     * Serije koje je server ODBIO tako da se odbijanje neće promijeniti (400 —
     * payload preko granica iz BLOK-HISTORY.md §3.3). Ni retry ni tiho
     * brisanje: partije ostaju u `archive`, id izlazi iz `pendingSessions` da
     * ne blokira red iza sebe, a blok jednom mirno kaže koliko ih je.
     *
     * Odvojeno polje, a ne zastavica na `pendingSessions`, jer je razlika
     * upravo u tome hoće li se ikad više slati. Neobavezno pri čitanju kao i
     * `pendingSessions`, pa pohrana ostaje `v1` bez migracije.
     */
    rejectedSessions: string[]
    /**
     * Zapisnik TEKUĆE serije na profilu i njegova poveznica — v. `BlokShare`.
     *
     * NEOBAVEZNO, pa spremljeno stanje starije od ove značajke ostaje `v1` bez
     * migracije. Uvijek najviše jedan: serija koju „Nova igra” zatvori više se
     * odavde ne dira, njome se od tog trenutka upravlja na profilu.
     */
    share?: BlokShare | null
}

export const BLOK_STORAGE_KEY = "bela:blok:v1"
