import type { BlokDict } from "../hr/blok"

/* Slovenski `blok`. Tipiziran kot hrvaški namespace, tako da izpuščen ali
   napačno zapisan ključ pade na `tsc` in ne šele v teku.

   Domenske besede sledijo `sl/game.ts`: napovedi (zvanja), delitev
   (podjela), adut (adut), štiglja (isto kot hrvaško — glej BLOK.md §1 in
   root CLAUDE.md), padli (pad). Imena barv aduta prihajajo iz `game`
   namespacea — tu jih ne podvajamo.

   Slovenščina ima dvojino, zato vsaka števna družina potrebuje tudi `.two`
   kot resnično obliko — tu sta to `entry.added` in `reset.games`. */

export const blok: BlokDict = {
    /* ─── Naslov, navigacija, SEO ───────────────────────────────────── */
    title: "Bela blok",
    nav: "Blok",
    "seo.title": "Blok za beleženje rezultatov bele — bela-turniri.com",
    "seo.description":
        "Digitalni blok za beleženje rezultatov bele za mizo — vpisuj točke, napovedi in štiglje brez prijave in brez interneta.",

    /* ─── Strani (MI / VI, preimenljivo) ─────────────────────────────── */
    "side.us": "MI",
    "side.them": "VI",
    "side.rename": "Preimenuj",
    "side.renameTitle": "Preimenuj strani",

    /* ─── Nastavitve igre (točke, igra se na, dolžina serije) ────────── */
    // Prvi del vrstice nad seštevkoma v kartici: „Do 1001 · skozi”
    // (BLOK-HISTORY.md §5.5). Do 2026-09-08 je bilo „Cilj”.
    "target.label": "DO",
    // `target.custom` („Lastno število”) je bil 2026-09-08 odstranjen skupaj s
    // poljem: v oknu so ostali samo gumbi 501 / 701 / 1001. Zaledje še vedno
    // sprejme poljuben cilj — ozji je vmesnik, ne pravilo.
    // Naslov okna. Bil je „Spremeni cilj”, dokler je bila v njem ena sama
    // številka; odkar drži tudi „dovolj/skozi” in „igra se do”, se imenuje po
    // tem, kar je (BLOK-HISTORY.md §5.3). Isto besedilo nosi tudi menijska
    // postavka.
    "target.title": "Nastavitve",

    /* ─── Seznam delitev (glavni zaslon) ─────────────────────────────── */
    "round.addFor": "Dodaj delitev za {side}",
    "round.calledBy": "Klical {side}",
    "round.runningTotal": "skupaj {points}",
    "round.toGo": "do cilja",
    "round.difference": "razlika",
    "dealer.first": "Prvi deli",
    "dealer.next": "Naslednji deli",
    "dealer.self": "Jaz",
    "dealer.rightOpponent": "Desni nasprotnik",
    "dealer.partner": "Partner",
    "dealer.leftOpponent": "Levi nasprotnik",
    // `dealer.clockwise` in `dealer.counterclockwise` sta bila 2026-09-08
    // odstranjena: smer se ne imenuje več po vrtenju, ampak tako, kot se reče
    // za mizo — „Desno” / „Levo” (`dealer.right` / `dealer.left` na koncu).
    // `round.empty` je bil 2026-09-08 odstranjen: prazen seznam pod dvema
    // očitnima gumboma „MI +” / „VI +” pove vse sam.
    "round.edit": "Uredi delitev",
    "round.delete": "Izbriši delitev",
    "round.undoLast": "Razveljavi zadnjo rundo",

    /* ─── Vnos delitve (spodnji list) ─────────────────────────────────── */
    "entry.cards": "Točke iz kart",
    // Naslov lista in napis nad stikalom MI/VI, s katerim se izbere, kdo je
    // klical. Gumba sama kot dostopno ime nosita polni `round.calledBy`.
    "entry.caller": "Klical",
    "entry.declarations": "Napovedi",
    "entry.stiglja": "Štiglja",
    // Belot — druga polovica gumba „Štiglja” (BLOK.md §1.2); ista beseda je
    // tudi značka na kartici in v vrstici delitve.
    "entry.belot": "Belot",
    "entry.belotHint": "Osem enakih kart — partija je končana",
    "entry.fell": "PADLI",
    "entry.sum": "Skupaj",
    "entry.save": "Shrani",
    "entry.cancel": "Prekliči",
    "entry.clearChip": "Odstrani napoved {value}",
    // Slovenščina ima dvojino, zato je `.two` tu resnična oblika: 1 krat,
    // 2 krat, 3-4 krat, 5+ krat — glej `pluralCategory`.
    "entry.added.one": "dodano {n} krat",
    "entry.added.two": "dodano {n} krat",
    "entry.added.few": "dodano {n} krat",
    "entry.added.other": "dodano {n} krat",
    "entry.clearAll": "Počisti",
    "entry.trump": "Adut",
    "entry.backspace": "Izbriši zadnjo števko",

    /* ─── Konec igre ──────────────────────────────────────────────────── */
    "winner.us": "Zmagali smo.",
    "winner.them": "Vi ste zmagali.",
    // `winner.newGame` je bil 2026-09-08 odstranjen (§5.6): besedi „nova igra”
    // od takrat pripadata meniju, ki serijo ZAPRE. Nadomešča ga
    // `winner.nextGame` („Naslednja partija”) na koncu datoteke.

    /* ─── Povzetek (konec igre) ──────────────────────────────────────── */
    "summary.total": "Skupaj",
    "summary.points": "Točke",
    "summary.declarations": "Napovedi",
    "summary.stiglje": "Štiglje",

    /* ─── Meni ───────────────────────────────────────────────────────── */
    // Skrajšan 2026-09-08 (BLOK-HISTORY.md §5.3). Odstranjeno, ker je
    // preseljeno, ne ukinjeno: `menu.rename` (svinčnik pod vsakim rezultatom
    // to že počne), `menu.archive` (igre so zdaj v kartici, za puščico — §5.4)
    // in `menu.share` (gumb v zgornjem levem kotu kartice, deli povezavo
    // namesto besedila — §5.2, ključi `share.*` na koncu datoteke).
    "menu.title": "Meni",
    "menu.newGame": "Nova igra",
    "menu.target": "Nastavitve",
    "menu.delete": "Izbriši igro",

    /* ─── Arhiv odigranih iger ────────────────────────────────────────── */
    "archive.empty": "V tej seriji še ni odigranih iger.",
    "archive.pending.one": "{n} prejšnja serija še čaka na pošiljanje na profil.",
    "archive.pending.two": "{n} prejšnji seriji še čakata na pošiljanje na profil.",
    "archive.pending.few": "{n} prejšnje serije še čakajo na pošiljanje na profil.",
    "archive.pending.other": "{n} prejšnjih serij še čaka na pošiljanje na profil.",
    // Serije, ki jih je strežnik zavrnil in se ne pošiljajo več. Pove oboje:
    // da niso shranjene in da so igre ostale na napravi.
    "archive.rejected.one":
        "{n} serija ni shranjena na profil. Igre so ostale na napravi.",
    "archive.rejected.two":
        "{n} seriji nista shranjeni na profil. Igre so ostale na napravi.",
    "archive.rejected.few":
        "{n} serije niso shranjene na profil. Igre so ostale na napravi.",
    "archive.rejected.other":
        "{n} serij ni shranjenih na profil. Igre so ostale na napravi.",

    /* ─── Potrditve (ConfirmDialog, nikoli confirm()) ────────────────── */
    // `confirm.newGame` je bil 2026-09-08 odstranjen: „Nova igra” ni več
    // potrditev, ampak izbira med dvema dejanjema (`newGame.*` na koncu
    // datoteke, §5.1). Z njim je odšel `share.text` — deli se povezava, ne
    // stavek z rezultatom (§5.2).
    "confirm.deleteRound": "Izbrisati to delitev? Tega dejanja ni mogoče razveljaviti.",
    "confirm.deleteGame": "Izbrisati to igro? Tega dejanja ni mogoče razveljaviti.",

    /* ═══════════════════════════════════════════════════════════════════
       POVEZAVA Z MIZO NA TURNIRJU — `BLOK-LINK.md`
       ═══════════════════════════════════════════════════════════════════
       Edini del bloka, ki sploh zahteva prijavo, in edini, ki kliče strežnik.
       Blok brez povezave dela natanko kot prej.

       Kode napak (`LINK_EXISTS`, `ROUND_COMPLETED`, …) so strojne in se
       NIKOLI ne prevajajo; prevede se stavek, ki ga uporabnik vidi namesto
       kode. Ključ nosi kodo v imenu, da `hasTranslation()` lahko vpraša, ali
       stavek za to kodo obstaja — če ne, gre splošno besedilo, nikoli gola
       koda na zaslonu. */

    /* ─── Vstop (meni) in prijava ────────────────────────────────────── */
    "link.menu": "Poveži z mizo",
    "link.title": "Poveži blok z mizo",
    "link.signIn": "Prijavi se",

    /* ─── Trije koraki (turnir → miza → katera stran je kateri par) ──── */
    "link.step.tournament": "Izberi turnir, na katerem igraš.",
    "link.step.table": "Izberi svojo mizo v aktivni rundi.",
    "link.step.side": "Povej, kateri par ste vi — brez tega organizator dobi število brez imena.",
    "link.noTournaments": "Ni turnirjev, ki bi potekali ali se pripravljali.",
    "link.noTables": "V aktivni rundi ni mize, ki bi jo bilo mogoče povezati.",
    "link.loadFailed": "Pridobivanje ni uspelo.",
    "link.retry": "Poskusi znova",
    "link.back": "Nazaj",
    "link.send": "Pošlji zahtevo",

    /* ─── Miza in runda (oznaki, ne števna izraza) ───────────────────── */
    "link.round": "Runda {n}",
    "link.table": "Miza {n}",
    "link.tableUnknown": "Brez številke mize",

    /* ─── Preslikava strani na para ──────────────────────────────────── */
    "link.sideQuestion": "Kateri par igra kot „{side}”?",
    // Isti ključ nosita pregled v tretjem koraku in vrstica v glavi: obe
    // strani sta imenovani z vrednostma (`{us}` / `{them}`), nikoli z
    // besedilom v stavku — strani je mogoče preimenovati.
    "link.sideMapping": "{us} = {usPair} · {them} = {themPair}",

    /* ─── Trak stanja v glavi ────────────────────────────────────────── */
    "link.status.pending": "Čaka odobritev organizatorja",
    "link.status.approved": "Povezano z mizo",
    "link.status.rejected": "Organizator je povezavo zavrnil",
    "link.status.revoked": "Povezava z mizo je prekinjena",
    "link.pendingSend": "Zadnji rezultat še ni poslan — poskusili bomo znova.",
    "link.unlink": "Prekini povezavo",
    "link.dismiss": "Odstrani obvestilo",
    "link.confirmUnlink": "Prekiniti povezavo z mizo? Rezultat ne bo več prihajal do organizatorja.",

    /* ─── Sporočila ob uspešnih dejanjih (toast) ─────────────────────── */
    "link.requested": "Zahteva je poslana organizatorju.",
    "link.unlinked": "Povezava z mizo je prekinjena.",

    /* ─── Zakaj mize ni mogoče izbrati (`targets[].reason`) ──────────── */
    "link.notLinkable": "Te mize ni mogoče povezati.",
    "link.reason.MATCH_HAS_BYE": "Ta miza ima prost prehod, nasprotnika ni.",
    "link.reason.LINK_EXISTS": "To mizo je nekdo že zahteval.",

    /* ─── Zakaj zahteva ni uspela ────────────────────────────────────── */
    "link.error.generic": "Zahteva ni bila poslana. Poskusi znova.",
    "link.error.LINK_EXISTS": "To mizo je nekdo že zahteval.",
    "link.error.MATCH_HAS_BYE": "Ta miza ima prost prehod, nasprotnika ni.",
    "link.error.PAIR_NOT_IN_MATCH": "Izbrani par ne igra za to mizo.",
    "link.error.ROUND_COMPLETED": "Runda se je medtem končala.",
    "link.error.TOURNAMENT_FINISHED": "Turnir je končan.",

    /* ─── Zakaj je povezava prenehala (409 pri pošiljanju rezultata) ── */
    "link.ended.roundCompleted": "Runda je končana — povezava z mizo je prekinjena.",
    "link.ended.tournamentFinished": "Turnir je končan — povezava z mizo je prekinjena.",
    "link.ended.notApproved": "Povezava z mizo ni več odobrena.",

    /* ═══════════════════════════════════════════════════════════════════
       ZGODOVINA BLOKOV NA PROFILU — `BLOK-HISTORY.md`
       ═══════════════════════════════════════════════════════════════════
       „Resetiraj” zaključi serijo: vse igre, odigrane za isto mizo, se
       shranijo na profil kot EN zapis, nato se izbrišejo z naprave.

       CEL BLOK `reset.*` JE ODSTRANJEN 2026-09-08 (BLOK-HISTORY.md §5.6):
       „Resetiraj” in „Nova igra” sta bili dve besedi za isto dejanje, zato je
       postavka „Resetiraj” odstranjena, njen pomen pa je prevzela „Nova igra”.
       Odšli so `menu.reset`, `reset.title`, `reset.confirm`, `reset.games.*`,
       `reset.confirmSignedIn`, `reset.confirmSignedOut`, `reset.signedOutNote`
       in `reset.saved`; nadomeščajo jih ključi `newGame.*` na koncu datoteke. */

    /* ═══════════════════════════════════════════════════════════════════
       SERIJA IGER ZNOTRAJ ENEGA BLOKA — dodano 2026-09-08
       ═══════════════════════════════════════════════════════════════════
       Blok JE serija: igre si sledijo za isto mizo, izid gre 1 : 0, 2 : 1,
       3 : 1, zapre pa jo samo „Resetiraj”. Izid serije stoji v glavi, takoj
       ko je prva igra končana.

       PRIVZETO je odprta serija — ni števila iger, ki bi jo končalo. V oknu
       „Spremeni cilj” se lahko izbere „igra se do 2” in serija takrat dobi
       konec, ki ga zna razglasiti sama.

       `series.games` je števna družina (`usePlural()`), tu z resnično
       dvojino: 1 dobljena igra, 2 dobljeni igri, 3–4 dobljene igre,
       5+ dobljenih iger. */
    // Skrajšano s „Cilj točk” na „Točke” 2026-09-08: beseda „cilj” je z
    // vrstico „Cilj 1001” izginila z zaslona.
    "target.points": "Točke",
    // `series.title` in `series.custom` sta bila 2026-09-08 odstranjena:
    // odsek se zdaj imenuje „Igra se do” (`series.playTo` na koncu datoteke),
    // polja za lastno število iger pa ni več — gumbi so cela izbira.
    "series.open": "Neomejeno",
    "series.games.one": "{n} dobljena igra",
    "series.games.two": "{n} dobljeni igri",
    "series.games.few": "{n} dobljene igre",
    "series.games.other": "{n} dobljenih iger",
    // `series.hintOpen` je bil 2026-09-08 odstranjen (zahteva uporabnika):
    // stavek je razlagal gumb „Odprta”, ki je bil pritisnjen točno nad njim.
    // `series.score` in `series.scoreAria` sta bila odstranjena skupaj s
    // sredinsko značko „SERIJA 2 : 1”; izid serije sta zdaj dve majhni
    // številki nad seštevkoma (`series.sideAria` na koncu datoteke).
    "series.badgeTarget": "do {games}",
    "series.running": "Serija {usWins} : {themWins}",
    "series.progress": "Serija {usWins} : {themWins} — igra se do {games}",
    "series.won.us": "Dobili smo serijo",
    "series.won.them": "Vi ste dobili serijo",
    "series.finish": "Serija je končana. „Nova igra” jo shrani in počisti blok za naslednjo.",

    /* ═══════════════════════════════════════════════════════════════════
       KONEC IGRE („dovolj” / „skozi”) IN „IGRA SE DO” — dodano 2026-09-08
       ═══════════════════════════════════════════════════════════════════
       Besedišče sledi `sl/game.ts`: tam ekipa, ki je klicala, „gre skozi” ali
       „pade” (`deal.fallExplained`). Zato je hrvaški „prolaz” tu „Skozi”, in
       „dosta” je „Dovolj” — nobene nove besede za isti pojem.

       `rule.*` opisuje, kako se konča ENA igra (do 1001): „Skozi” je od
       2026-09-08 PRIVZETO (odločitev uporabnika, BLOK-HISTORY.md §5.5) in
       zahteva, da cilj preseže stran, ki je delitev klicala in šla skozi;
       „Dovolj” (konec takoj, ko kdo preseže cilj) je zdaj izbira.
       `rule.dostaHint` in `rule.prolazHint` sta bila 2026-09-08 odstranjena
       na željo uporabnika: „igra se na skozi” je stavek, ki ga za mizo vsi
       že poznajo.

       `series.playTo` je napis odseka o dolžini serije, `series.sideAria` pa
       dostopno ime majhne številke nad seštevkom ene strani. Število gre skozi
       `series.games` (`usePlural()`), nikoli kot gola števka v stavku. */
    "series.playTo": "Igra se do",
    "series.sideAria": "Serija — {side}: {games}",
    // Napis nad gumboma Skozi / Dovolj. Bil je „Konec igre”; zdaj se bere kot
    // stavek, ki ga gumba dokončata („igra se na skozi”).
    "rule.title": "Igra se na",
    "rule.dosta": "Dovolj",
    "rule.prolaz": "Skozi",

    /* ═══════════════════════════════════════════════════════════════════
       REVIZIJA 2026-09-08 — SHRANJEVANJE, ODIGRANE IGRE, DELJENJE
       BLOK-HISTORY.md §5.1, §5.2, §5.4
       ═══════════════════════════════════════════════════════════════════
       `newGame.*` — „Nova igra” ne pove več, da se nekaj „shrani v arhiv”,
       ampak PONUDI: shrani serijo na profil in začni novo igro v isti
       seriji, ali začni brez shranjevanja. Neprijavljeni, ki izbere
       shranjevanje, gre na prijavo in se vrne dokončat dejanje; „brez
       shranjevanja” dela brez računa, vedno. Zato tu ni nobenega stavka, ki
       bi silil v prijavo — `newGame.signedOutNote` je ugotovitev, ne vabilo.

       `games.*` — puščica pod črto v kartici z rezultatom in vrstica vsake
       končane igre. Kratki napisi za kontrolo, ne stavki: kartica je zaslon,
       na katerem vsak piksel drži številko. Seznam, ki se odpre, uporablja
       obstoječe `archive.*` ključe — ti so od nekdaj govorili o igrah
       TRENUTNE serije, kar panel tudi kaže.

       `share.*` — deli se POVEZAVA do zapisnika (`/blok/z/{token}`), ne
       besedilo z rezultatom, zato tu ni nobenega napisa s številkami. Serija
       se pred tem shrani (ista pot kot §5.1). „Prekini deljenje” je edino
       nepovratno dejanje tukaj in gre zato skozi `ConfirmDialog` ter stoji v
       meniju, ne ob gumbu, ki povezavo izda. */
    // `newGame.body`, `newGame.saveAndStart`, `newGame.startOnly` in
    // `newGame.saveFailed` so bili 2026-09-08 odstranjeni (§5.6): okna s tremi
    // izidi ni več. `newGame.saved` in `newGame.signedOutNote` sta preseljena
    // na konec datoteke, k ostalim ključem tega dejanja.

    "games.show": "Prikaži odigrane igre",
    "games.hide": "Skrij odigrane igre",
    "games.showDeals": "Prikaži delitve te igre",
    "games.hideDeals": "Skrij delitve te igre",

    "share.action": "Deli zapisnik",
    // Ko povezava že obstaja: isti gumb, a je jasno, da se nova ne izdaja.
    "share.again": "Deli zapisnik (povezava je aktivna)",
    // Deli se ZAPIS, ta pa ne sme vsebovati pol partije (§5.6).
    "share.nothing": "Za deljenje še ni nobene končane partije.",
    "share.failed": "Povezava ni bila izdana. Poskusi znova.",
    // `share.stop` in `share.confirmStop` sta bila 2026-09-08 odstranjena:
    // postavko menija „Prekini deljenje” je zamenjalo stikalo „Omogoči
    // deljenje” v „Nastavitve” (`share.enable` na koncu datoteke).
    "share.stopped": "Deljenje je prekinjeno.",
    "share.stopFailed": "Prekinitev deljenja ni uspela. Poskusi znova.",

    /* ═══════════════════════════════════════════════════════════════════
       REVIZIJA 2026-09-08 (druga) — „DO 1001 · SKOZI”
       BLOK-HISTORY.md §5.5
       ═══════════════════════════════════════════════════════════════════
       Vrstica nad seštevkoma ne piše več „Cilj 1001”, ampak „DO 1001”, ob
       njej pa VEDNO stoji pravilo konca igre — ne le, kadar ni privzeto. Iz
       istih delitev namreč dobimo drugega zmagovalca, odvisno od pravila.

       Ločena ključa `rule.prolazInline` / `rule.dostaInline` ohranjata ta
       povzetek neodvisen od napisov gumbov v oknu. */
    "rule.prolazInline": "SKOZI",
    "rule.dostaInline": "DOVOLJ",

    /* ═══════════════════════════════════════════════════════════════════
       REVIZIJA 2026-09-08 — POVEZAVA POMENI JAVEN ZAPISNIK
       BLOK-LINK.md §6.2
       ═══════════════════════════════════════════════════════════════════
       Stoji v zadnjem koraku okna, NAD gumbom, ki pošlje zahtevo — to je
       zadnja točka, na kateri se privolitev še lahko ne da. */
    "link.publicNote":
        "S povezavo se strinjaš, da je zapisnik te serije javen: organizator ga vidi ob mizi v žrebu, odpre pa ga lahko vsakdo, ki dobi povezavo — tudi po turnirju.",

    /* ═══════════════════════════════════════════════════════════════════
       REVIZIJA 2026-09-08 (druga) — POVEZAVA NE ZAHTEVA VEČ PRIJAVE
       BLOK-LINK.md §7
       ═══════════════════════════════════════════════════════════════════
       Okno se odpre naravnost v izbor turnirja. Zid s prijavo je odstranjen,
       zato `link.signInTitle` in `link.signInBody` zgoraj nimata več klica —
       namenoma ju tu ne brišemo, ker se isti datoteki hkrati dodajajo ključi
       za „belo”; brisanje gre v ločen prehod. */
    "link.tournamentsOnly":
        "To se uporablja samo na turnirjih: blok se veže na mizo v aktivni rundi in rezultat gre organizatorju.",
    "link.nameLabel": "Tvoje ime",
    "link.namePlaceholder": "Ime in priimek",
    "link.nameHelp": "Organizator odobri osebo, zato mora videti, kdo zahteva mizo.",
    "link.nameTooShort": "Vpiši ime, vsaj dva znaka.",
    "link.error.NAME_REQUIRED": "Vpiši ime — organizator ne more odobriti zahteve brez podpisa.",
    "link.signedOutGain":
        "Rezultat pride do organizatorja tudi brez prijave. S prijavo gre zraven še javen zapisnik serije s povezavo v žrebu.",

    /* ═══════════════════════════════════════════════════════════════════
       REVIZIJA 2026-09-08 (tretja) — BLOK SAM PONUDI MIZO
       BLOK-LINK.md §8
       ═══════════════════════════════════════════════════════════════════
       Trak na vrhu, kadar strežnik prepozna, da prijavljeni igralec sedi za
       mizo v aktivni rundi. Ponudba, ne obvestilo — zavrnitev se zapomni za
       tisto tekmo. */
    "link.offer.title": "Igraš na turnirju {tournament}",
    "link.offer.pairs": "{pair} proti {opponent}",
    "link.offer.action": "Vodi zapisnik",
    "link.offer.dismiss": "Ne, hvala",

    /* ═══════════════════════════════════════════════════════════════════
       NASTAVITVE: DOGOVORA O DELJENJU KART — 2026-09-08, zahteva uporabnika
       BLOK.md §3.3.2
       ═══════════════════════════════════════════════════════════════════
       Dve novi postavki v pogovornem oknu „Nastavitve”, poleg cilja v točkah,
       „igra se na” in „igra se do”:

         1. stikalo „Naslednji deli” — trak nad gumboma MI/VI postane
            neobvezen. Napis stikala NIMA svojega ključa: nosi ga
            `dealer.next`, isti, ki piše na traku samem;
         2. „Smer deljenja” — na katero stran gre deljenje okoli mize.

       Smer se imenuje tako, kot se reče za mizo, ne po vrtenju urinega
       kazalca; zato sta `dealer.clockwise` in `dealer.counterclockwise`
       odstranjena. Ista ključa nosita čipa v oknu in sredinski gumb v listu
       delilca — ena vrednost, eno ime. */
    "dealer.direction": "Smer deljenja",
    /* Tko miješa PRVU podjelu SLJEDEĆE partije — BLOK.md §3.3.4. Ne dira
       podjele UNUTAR partije; one i dalje idu po `dealer.direction`.
       „Sljedeći” = rotacija ide dalje oko stola; „Pobjednik” = rotacija ide
       dalje istim smjerom, ali preskače par koji je izgubio. */
    /* Dvije upute na kartici sažetka partije — strelica pokazuje na ono što je
       već na ekranu (partije serije gore iza chevrona, gumb dolje). */
    /* Kad je ekipa upisala svoje ime, zove se njime; MI/VI je ono na što se
       vraća bezimena strana. */
    "winner.named": "{name} so zmagali",
    "series.wonNamed": "{name} so dobili serijo",
    "summary.reviewGames": "poglej prejšnje partije",
    "summary.startNextGame": "začni novo igro",
    "summary.startNewSeries": "začni novo serijo",
    "dealer.newGame": "Novo partijo meša",
    "dealer.newGameNext": "Naslednji",
    "dealer.newGameWinner": "Zmagovalec",
    "dealer.right": "Desno",
    "dealer.left": "Levo",

    /* ═══════════════════════════════════════════════════════════════════
       REVIZIJA 2026-09-08 (tretja) — „NOVA IGRA” ZAPRE SERIJO
       BLOK-HISTORY.md §5.6, in stikalo „Omogoči deljenje”
       ═══════════════════════════════════════════════════════════════════
       Trije napisi, tri dejanja, in vsak mora povedati, katero je katero:

         `menu.newGame`      meni — ZAPRE serijo: končane partije gredo na
                             profil, izid serije se vrne na 0:0, blok ostane
                             prazen;
         `winner.nextGame`   povzetek pod dobljeno partijo — NASLEDNJA PARTIJA
                             znotraj iste serije, tekoči 2 : 1 se nadaljuje.
                             Zato „partija”, ne „igra”: ista beseda bi vrnila
                             zmedo, ki jo je ta revizija odpravila;
         `menu.delete`       „Izbriši igro” — vrže delitve tekoče partije,
                             serija ostane. Nespremenjeno.

       Potrditev za „Novo igro” gre skozi `ConfirmDialog` in mora povedati OBOJE:
       kaj se shrani in da gre izid serije na 0:0. Trije stavki namesto enega s
       pridržkom, ker se resnično razlikujejo: prijavljenemu se serija shrani
       (`confirmSignedIn`), neprijavljenemu se le izbriše (`confirmSignedOut`),
       kadar pa nobena partija ni končana, ni česa shraniti (`confirmNothing`).
       `confirmUnfinished` se doda kot samostojen stavek, kadar ob končanih
       partijah stoji še nedokončana tekoča; stavka se združita s presledkom,
       zato se slovnično ne sestavlja nič.

       `newGame.games` je števna družina (`usePlural()`), tu z resnično
       dvojino: 1 končana partija, 2 končani partiji, 3–4 končane partije,
       5+ končanih partij.

       `share.enable` je stikalo v „Nastavitve”, ki je zamenjalo postavko menija
       „Prekini deljenje” — privzeto VKLOPLJENO. Izklopljeno: gumba za deljenje
       ni, žeton, ki ga je izdal uporabnik sam, pa se prekliče.
       `share.linkedNote` je edina izjema in piše samo, dokler povezava z mizo
       obstaja: tisti zapisnik organizator odpre iz žreba (BLOK-LINK.md §6.2) in
       ostane javen ne glede na stikalo. */
    "winner.nextGame": "Naslednja partija",
    "newGame.games.one": "{n} končana partija",
    "newGame.games.two": "{n} končani partiji",
    "newGame.games.few": "{n} končane partije",
    "newGame.games.other": "{n} končanih partij",
    "newGame.confirmSignedIn":
        "Serija ({games}) se shrani v Blok na tvojem profilu, izid serije pa se vrne na 0:0.",
    "newGame.confirmSignedOut":
        "Serija ({games}) se izbriše s te naprave, izid serije pa se vrne na 0:0. Zgodovina se hrani le prijavljenim igralcem.",
    "newGame.confirmNothing":
        "Nobena partija ni končana, zato se nič ne shrani. Blok se izprazni, izid serije pa se vrne na 0:0.",
    "newGame.confirmUnfinished": "Trenutna partija ni končana in se ne shrani.",
    "newGame.signedOutNote": "Zgodovina blokov se hrani le prijavljenim igralcem.",
    "newGame.saved": "Serija je shranjena v Blok na tvojem profilu.",
    "share.enable": "Omogoči deljenje partije s povezavo",
    "share.linkedNote":
        "Zapisnik povezane mize ostane javen — organizator ga odpre iz žreba.",
}
