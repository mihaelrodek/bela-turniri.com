# Botova logika — nepisana pravila bele

Normativni dokument za `@bela/bots`. `README.md` §5 opisuje kako je bot uklopljen
u server; ovdje piše **što bot misli i zašto**. Mijenjaš li heuristiku, prvo
ovaj dokument pa kod.

Izvor je korisnikov dokument s nepisanim pravilima bele (`Bela Trikovi Legal
Advice.rtf`), primijenjen 2026-09-09. Gdje niže stoji „(TRIK)”, riječ je o
pravilu preuzetom iz tog dokumenta.

**§12 nosi cijenu.** Četiri pravila su izmjerena kao šteta i ipak su unutra, na
izričit zahtjev; taj odjeljak postoji da se to ne izgubi. Ovaj dokument opisuje
kod kakav jest, a ne kod kakav bi mogao biti.

---

## 0. Što bot smije znati

Bot odlučuje isključivo iz `PlayerView` — istog objekta koji dobiva čovjek, uz
**jednu** razliku: `trickHistory` mu je uvijek pun, bez obzira na sobnu opciju
`trickReview`. Ta opcija uređuje što *čovjek smije pregledati na ekranu*;
pamćenje javno odigranih karata nije povlaštena informacija i čovjek ga ima
besplatno, a bot je bez stanja pa bi bez toga zaboravljao svaki štih. Provedeno
u `gameRoom.actForSeat` preko `viewFor(st, seat, { recallTricks: true })`, i
isto tako u dev-mocku (`frontend/src/game/mock/mockGameServer.botView`) — inače
bi bot u `/igra?mock=1` igrao drugačije nego u pravoj sobi.

Sve ostalo ostaje skriveno i botu: tuđe ruke, talon, zvanja para koji je
izgubio natjecanje zvanja.

Iz toga slijedi tvrdo pravilo za cijeli dokument: **nijedno zaključivanje ne
smije pretpostaviti kartu koju bot ne vidi.** Funkcije zaključivanja vraćaju
„dokazano” ili „nije dokazano”, nikad „vjerojatno ima”. Gdje je procjena nužna
(raspodjela aduta), radi se iz brojeva karata u rukama, ne iz pogađanja.

Bot ne mijenja legalnost poteza. §1.5 READMEa (mora se ići preko; prazan s
adutom mora rezati) je enginov posao; bot bira **samo unutar `legalMoves`**.

---

## 1. Zvanje aduta

Dokument daje minimum za zvanje kao **dva „sigurna” štiha plus jedan
polusiguran** (TRIK), s primjerima: bela i 9 u adutu te bezec 10 u strancu;
dečko i mala u adutu te strani as; dečko i dva strana asa; četiri karte iste
boje.

Zvanje su **dva odvojena pitanja**, i kod ih tako i postavlja:

**Koja boja** — `bestTrumpSuit`, tj. `suitStrength`: J 4, 9 3, A 1.5, 10 1,
½ po dodatnoj karti, gledano **samo u toj boji**. Ne smije se birati po ocjeni
cijele ruke: ne-adutski dio je gotovo jednak u sve četiri boje, pa bi ruka s tri
strana asa dobila isti rezultat svugdje i zvala boju u kojoj nema ništa.

**Zvati ili ne** — dva praga koja oba moraju pasti:

1. `suitStrength(best) ≥ 4.5` (`MIN_TRUMP_STRENGTH`) — mora postojati sam adut.
   4.5 je dečko i još jedna karta, ili devetka s asom.
2. `handTricks(hand, best) ≥ 1.1` (`BID_THRESHOLD`) — očekivani štihovi cijele
   ruke. Kod zvanja se vidi **šest** karata, pa je i ovaj broj o šest karata.

`handTricks`:

| Karta | Vrijednost | Zašto |
|---|---|---|
| adutski J | 1.0 | najjača karta u igri |
| adutska 9 | 0.9 | druga najjača; pada samo pod dečka |
| adutski A | 0.55 | uzima tek kad J i 9 prođu |
| adutska 10 | 0.3 | isto, jedan red niže |
| svaki adut preko trećeg | 0.45 | duljina reže strance |
| strani as | 0.8 | uzima dok ga netko ne presiječe |
| „potkovana” strana 10 | 0.45 | 10 uz koju u ruci stoji A ili K |
| gola strana 10 | 0.1 | u pravilu je hrana |
| bela (K+Q aduta) | +0.2 | 20 bodova, i K je ulaz |

Zašto strani as vrijedi gotovo kao adutska devetka (TRIK): **aduti su samo 62
boda, a ostale karte 100.**

Pomaci praga po sjedalu (`bidThreshold`), svi iz dokumenta:

- **suigrač prvi na igri** → −0.25: „Najlakše je zvati ako je suigrač prvi na
  igri jer će ti pokazati svojom igrom što ima i što nema.”
- **ja prvi na igri** → −0.1: lakše je diktirati igru.
- **prvi na igri je protivnik, a nemam dečka** → +0.35: „Rizik je zvati bez
  dečka ako ti je igrač prvi na igri.”
- **suigrač je djelitelj i svi prije njega su pasirali** → −0.4: pasiram li,
  on je u musu. „Pokušaj ga spasiti i zovi ako imaš neke mogućnosti.”

Ti su pomaci na tri skupa seedova **unutar šuma**; zadržani su jer su izravno iz
dokumenta, a ne zato što mjere bolje.

**Završnica** (`mustNotPass`): ako bi protivnici jednom podjelom (uzeto kao 90
bodova) došli do cilja, a mi ne bismo, zove se bez praga — „tad se mora zvati i
ne dozvoliti protivniku da bira aduta”. Traži `view.targetScore`; bez njega se
pravilo preskače.

U musu se i dalje zove najbolja boja bez ijednog praga.

---

## 2. Signalizacija odbacivanjem

Najvažniji dio dokumenta i izravan povod ovoj promjeni:

> VAŽNO JE SUIGRAČU POKAZATI ŠTO IMAŠ I OMOGUĆITI SUIGRAČU DA TO POKAŽE TEBI.

### 2.0 Samo kad štih nosi NAŠ par

`signalDiscard` prvo provjerava `feeding` i uz `false` vraća `null` — dok štih
nose protivnici ne govori se ništa, nego se igra najjeftinije
(`cheapestDiscard`).

To nije kompromis nego čitanje dokumenta: konvencija „od veće ka manjoj” stoji u
njegovu odjeljku **„Ako suigrač odigrava adute”**, gdje svaki bačeni bod ionako
ide nama. Izvan toga svaki stupanj poruke plaća se protivničkim bodovima, i to
se vidi u brojkama: signaliziranje i na protivnički štih mjerilo je **−1,5
postotna boda** snage u self-playu. Uz to je `cheapestDiscard` sa svojim
tie-breakom na najkraću boju već ono što dokument traži pod „očisti se u boji
gdje nemaš štiha”.

### 2.1 Koju boju odbacujem

Boje se dijele na **„za preuzeti”** (`suitWorthKeeping`: as, potkovana 10,
najjača preostala karta, ili četiri i više karata) i **nikakve**. Odbacuje se
nikakva (TRIK), i to prvo ona u kojoj sam najkraći — u njoj se najprije
ispraznim, pa poruka bude dovršena umjesto započeta u tri boje.

### 2.2 Kojim redom unutar boje

Boju koju napuštam bacam **od veće ka manjoj** (TRIK): poruka „ovdje nemam
ništa”.

### 2.2a Zadnja karta boje koju nitko nema

Ako je boje nestalo iz svih ostalih ruku (`isLastOfADeadSuit`), moja zadnja
karta te boje se **ne** odbacuje na protivnički štih ni kad je sedmica: ona je
ono čime se kasnije izbija zadnji adut. „Rađe mu daj kralja gdje imaš asa nego
tu 7 ili 8” (TRIK).

### 2.3 As se ne odbacuje — osim potkovan

Korisnikovo pravilo, doslovno: **asa odbacujem samo zato jer imam i desetku
doma**. Tada odbačeni as znači „podigraj mi ovu boju, moji štihovi idu do
kraja” — 11 bodova je ubrano, a moja 10 postaje najjača u boji. **Goli as se ne
odbacuje nikad** dok postoji išta drugo: to je štih.

Primjer iz kojeg je pravilo napisano (korisnikov): suigrač vuče pet najjačih
karo aduta, bot ima herc A-10-K, žir A-10, pik 8-7 i karo 7. Ispravno je redom:
karo 7 (obveza boje), pa pik 8, pa pik 7 (nikakva boja, od veće ka manjoj), pa
tek na zadnja dva aduta herc as i žir as — jer su **potkovani** desetkama.

Zato `fillCard`, dok **suigrač vuče adute**, prvo troši bezvrijedne karte iz
napuštenih boja pa tek onda vrijedne: ako suigraču aduti presuše ranije nego
što se činilo, kod kuće su ostale dobre karte, a ne smeće. Mjereno neutralno;
zadržano jer je skraćeni niz strogo bolji ovako.

---

## 3. Čitanje suigračevih signala

Ono što bot pošalje mora znati i pročitati. `partnerSignal` iz `trickHistory`
(§0) izvodi dvije tvrdnje, obje o onome što je suigrač **učinio**:

- **bacio je ASA** u nekoj boji → drži 10 iza njega i traži tu boju (druga
  polovica pravila §2.3). Najviša pouzdanost, i to je slučaj koji je korisnik
  opisao;
- **odbacivao je iz svih bočnih boja osim jedne**, a u toj jednoj nije dokazano
  prazan → ona koju čuva je ona koju želi.

`avoids` je popis boja iz kojih je odbacivao. Kad se ne da ništa pročitati, oba
polja šute: bot koji izmisli signal gori je od bota bez signala.

Zaključak se koristi **pri otvaranju štiha** (§5, pravilo 1). Uz to i dalje
vrijedi `seatShownVoidIn`. Ovo je zaključivanje iz **odbacivanja**; ono iz
zvanja, podigravanja i bele je §11.

---

## 4. Punjenje suigračevog štiha

Osnovno pravilo (TRIK): **na suigračevo nošenje nastoj upuniti svaki bod**, uz
dva ograničenja:

- **`partnerTrickIsSafe`** — ne puni se dok iza mene još netko može uzeti štih.
  Siguran je štih ako sam zadnji, ili ako suigrač drži **najjači preostali
  adut** (njega nitko ne može preuzeti, s bilo koje pozicije), ili ako drži
  najjaču kartu boje a nijedno sjedalo iza mene ne može presjeći.
- **`isSureFutureWinner`** — karta koja je i sama sigurni štih (najjači adut;
  najjača karta boje kad protivnici dokazano nemaju aduta) ne troši se na
  punjenje: ona poslije uzima cijeli štih, ne samo svojih 11 bodova.
- **goli as** nikad, **potkovani as** da (§2.3).

**A ili 10 iste boje** (TRIK, `fillPreferringTen`) — čisto signalizacija:

| Tko je zvao | Dajem | Zašto |
|---|---|---|
| **mi** | asa | suigrač zna zadržati bezec 10 |
| **protivnici** | 10 | zvač misli da je as kod njegovog suigrača |

**Potkovana 10 kad nosi prolaz** (`tenThatSecuresThePass`): 10 koju inače
čuvam ipak ide ako baš ona prenosi naš par preko prolaza (82 boda iz karata,
uz zvanja). „Upuni i potkovanu 10, osim ako vidiš da to nije dovoljno za
prolaz.”

Kad me §1.5 tjera **preko vlastitog suigrača** (u boji ili rezanjem), idem
najslabijom kartom koja to čini — štih je ionako naš, dečko bačen na njega je
bačen dečko. **Iznimka**: suigrač je otvorio **niskim adutom (7 ili 8)** — tada
ide **devetka** (`nineOnPartnersLowTrump`, TRIK). Baba je jeftinija i tuče
osmicu, ali babu tuku 10, as i dečko; devetku samo dečko. Otvorio je nisko jer
želi da aduti izađu, a devetka je karta koja ih zaista izvlači.

---

## 5. Otvaranje štiha

Redoslijed u `leadCard`. Nijedno pravilo ne prolazi bez uvjeta — neograničeno
pravilo je ono što je 2026-09-08 izlazilo adutom osam puta po podjeli.

1. **Boja koju je suigrač tražio** (§3), ako je mogu otvoriti — otvaram je
   nisko, jer je njegova 10 najjača, a moja karta je samo ulaz.
1a. **„Vrati aduta”** (`partnerAskedForTrump`, TRIK): suigrač je negdje u ovoj
   podjeli otvorio **niskim adutom** (7, 8 ili 9). To je rečenica — „imam
   sljedeću najjaču u adutu ili sva tri strana asa, vrati adut” — pa kad lead
   dođe do mene, ide natrag u adut. Samo dok protivnici još mogu imati adut;
   kad dokazano nemaju, rečenica je odgovorena.
1b. **Istjerivanje zadnjeg aduta** (`forceOutTheLastTrump`, TRIK): ako je u
   igri ostao **jedan jedini** adut i jači je od svih mojih, ne dajem adut da
   ga izvučem nego otvaram najdužu boju bez asa — tko ga drži mora ga potrošiti
   na štih koji smo ionako gubili, a ako je kod suigrača, reže boju koju ionako
   nisam mogao ubrati.
1c. **Obrambena knjiga otvaranja** (§7) kad su protivnici zvali. Ide **prije**
   vođenja asa: prvo što dokument kaže jest da se na obrani ne otvara vlastita
   asova boja.
2. **Vađenje aduta**, samo kad ima svrhu (`shouldDrawTrumps`, README §5).
   Karta kojom vadim, kao zvač (`callerTrumpLead`, TRIK):
   - imam J, 9 i A aduta **i** stranog asa → počinjem **adutskim asom** („ne
     odbacuj potkovanu 10, imat ćeš vremena”);
   - imam J, 9 i A aduta **bez** stranog asa → počinjem **devetkom**;
   - **dečko se ne podiže „u glavu”** s tri ili manje aduta, osim ako je
     **svaka bočna boja koju držim predvođena najjačom preostalom kartom**
     (`plainSuitsAllTopped`) — tada ide najslabiji adut. Dečko inače uzme svoj
     jedan štih i vrati lead ruci koja nema što ubrati. Uvjet mora pitati za
     **bočne** boje: `hasWinnersToCash` broji bilo koju najjaču kartu, a
     adutski dečko je i sam takva, pa je s njim ova grana bila mrtav kod;
   - inače `trumpDrawCard`: najjači adut ako ga imam, inače najslabiji.
3. **Strani as kad protivnici dokazano nemaju aduta** (`aceToCash`, TRIK) —
   odigra se čim su aduti pokupljeni, da suigrač zna zadržati bezec 10. **Solo**
   strani as je izuzet: njega ne pokazujem, da suigrača ne navedem da čuva 10 u
   boji koju mu ne mogu otvoriti.
4. **As kojeg vrijedi potrošiti** (`shouldSpendAce`, §6), ili 10 koja je postala
   najjača u boji.
5. **Tiho otvaranje** (`quietLeadCard`): najjeftinija ne-adutska karta po
   bodovima, pa iz najkraće boje, pa najniža. Bodovi idu **prije** duljine boje —
   staro „najniža karta najkraće boje” otvaralo je golu 10 kad je ona bila
   najkraća boja.
5a. **Zvanja protivnika** (`declarationRead`, TRIK): protivnik **lijevo** od
   mene igra poslije mene, pa boju u kojoj je zvanjem pokazao asa **ne**
   otvaram; protivnik **desno** igra prije mene, pa baš tu boju otvaram — as mu
   izlazi prije nego što se ja moram obvezati.
6. Ako je tiho otvaranje ispalo **solo karta ili nepotkovana 10** (`isThinLead`),
   uzima se najjeftinija karta boje koje imam više. Oboje je 2:1 protiv mene
   (TRIK), a solo karta se vodi samo ako drugih bočnih karata nema — **nikad se
   ne bježi u adut**, jer bi to bilo vađenje aduta koje je pravilo 2 upravo
   odbilo.
7. Najslabija karta koju imam (u praksi: ruka od samih aduta).

---

## 6. Kad se as vodi (`shouldSpendAce`)

As se otvara samo ako:

- protivnik dokazano ne može imati adut, ili
- je kraj podjele (≤ 2 karte u ruci), ili
- je **prva runda te boje**, nijedan protivnik nije pokazao prazninu u njoj, i
  bar 4 karte boje su izvan moje ruke.

Veto: ako je **suigrač** pokazao prazninu u boji a može još imati adut, as se ne
vodi — morao bi rezati moj vlastiti dobitni štih (posljedica §1.5, koji nema
iznimku za partnera).

---

## 7. Obrana (protivnik zvao)

`defensiveLead`, i **oblik ruke je poanta**. Dokument daje četiri pravila za
četiri oblika; verzija koja se okidala na svako obrambeno otvaranje (oko 3 000
puta na 800 partija) koštala je pola postotnog boda, pa se okida samo na njih:

1. **as u jednoj boji, potkovana 10 u drugoj** → otvaram boju s desetkom.
   „Tad ćeš imati dvije boje za potencijalni štih”;
2. **tri ili više aduta** → duga boja u kojoj nemam asa;
3. **točno dva strana asa** → treća boja, ona bez asa;
4. **loša ruka**, bez asa i bez potkovane 10 → duga boja.

Sva četiri kažu isto o dvije stvari: obrambeno otvaranje nije vlastita asova
boja i nije solo karta.

**K ili Q na suigračevu malu kartu** iz dokumenta NIJE zaseban kod — ispravljeni
§1.5 to već prisiljava. Ako suigrač otvori malu kartu boje koju imam, moram ići
preko nje, pa je jedina legalna karta baš ta viša. Napisano je i izmjereno: ta
se funkcija nije mogla okinuti nijednom u 800 partija.

---

## 8. Prolaz i štiglja

Bot broji koliko mu do prolaza nedostaje (`pointsShortOfPass`): 82 boda iz
karata, plus zvanja, minus ono što je već uzeto u dovršenim štihovima. Iz toga
vise dvije odluke: punjenje potkovane 10 (§4) i štiglja.

**Štiglja** (`shouldChaseStiglja`) je svih osam štihova, plus 90 bodova. Juri se
samo kad vrijede oba uvjeta iz dokumenta odjednom:

- protivnici **nemaju nijedan štih** u ovoj podjeli (`stigljaIsLive`);
- **prolaz je već ubran** — „ne riskiraj pad da bi išao na štiglju”. U račun
  ulaze i bodovi na stolu, jer je s dosad svim štihovima našima i tekući naš;
  bez toga se juriti moglo tek štih nakon što je prolaz stvarno sjeo.

Dvije stvari se tada mijenjaju:

- **`stigljaLead`** — otvara se samo iz ruke u kojoj je **svaka** karta najjača
  preostala u svojoj boji, pa je put do kraja aritmetika, a ne nada. Šire od
  toga pravilo pre-otima posao `shouldDrawTrumps`, koje je cijelo o tome kada
  vađenje aduta ima svrhu, i mjerilo je lošije. Adut se vodi dok protivnici još
  mogu presjeći, inače se prvo ubiru bočne.
- **`stigljaTakeOver`** — suigrač drži štih, ali ne sigurno: štih izgubljen
  ovdje je 90 bodova izgubljenih, pa ga uzimam sam. Izvan štiglje bi to bila
  greška koju bot inače ne radi (§4), zato je zatvoreno u ovaj uvjet.

Štiglja je rijetka po prirodi — oko 0,4 % podjela — pa ni najbolje pravilo ovdje
ne može puno pomaknuti ukupnu snagu.

---

## 9. Mjerenje

Regresijski guard je `packages/bots/test/simulation.test.ts`: bot mora dobiti
≥ 60 % od 30 seedanih partija protiv nasumičnog legalnog igrača (zadnje 27/30).

Za usporedbu verzija koristi se A/B nad seedanim partijama, i **svaki seed mora
biti odigran u obje postave sjedala**: bez toga harness daje 46 % za dva
identična bota, jer postava sjedala sama nosi tu razliku. 800 partija po skupu
seedova, i najmanje jedan skup na kojem se nije ugađalo. Brojke su u README §5.

---

## 10. Što bot namjerno NE radi

- **Ne blefira.** Dokument blef dopušta, ali samo protiv igrača koji te
  poznaju, i nikad na suigračevo podigravanje.
- **Ne pretpostavlja karte.** Nema „vjerojatno suigrač ima asa” — po dokumentu
  je to 2:1 protiv.
- **Ne gleda tuđe ruke.** §0.

---

## 11. Zaključivanje — tko što ima

Bot ne nagađa. Sve niže je **dokaz**: karta je locirana samo kad pravila čine
nemogućim da bude drugdje. Nema „vjerojatno ima asa” — po dokumentu je to 2:1
protiv, a bot koji izmisli kartu gori je od bota bez zaključka.

### 11.1 Zvanja imenuju točne karte

`locatedCards` je najveći komad besplatne informacije u podjeli, a bot ga je
dotad bacao: **zvanje NAVODI svoje karte**, pa je svaka karta iz vidljivog
zvanja locirana u toj ruci. Vidljiva su vlastita zvanja i zvanja **para koji je
dobio natjecanje zvanja** (§0) — dakle ili partnerova, ili obojice protivnika.
Odigrane karte ispadaju iz mape: locirana karta koja je pala je samo pala karta.

Prije je od svih zvanja korišten jedan jedini zaključak (nema dečka), i to samo
za partnera.

### 11.2 Podigravanje kao rečenica

`readSeatFromLeads` čita ono što bot i sam govori (`callerTrumpLead`):

| Otvaranje | Zaključak |
|---|---|
| **zvač** izašao adutskim **asom** | ima **dečka i devetku** — inače bi mu ih netko preuzeo |
| **zvač** izašao adutskom **devetkom** | ima **dečka i asa** (to je grana bez stranog asa) |
| bilo tko izašao adutskim **K ili Q** | **nema dečka** — s dečkom se izlazi dečkom |

Zaključak se primjenjuje **samo na partnera**, nikad na vlastito sjedalo:
vlastitu ruku bot zna točno, a čitanje sebe iz vlastitog poteza pretvara svako
otvaranje koje konvencija nije diktirala u lažnu tvrdnju.

### 11.3 Bela

`PlayerView.belaDeclared` je **tim**, ne sjedalo, pa se mora vezati uz sjedalo
koje je odigralo prvu od K/Q aduta — to je u zapisu štihova (`belaSeat`). To
sjedalo drži **oba** ta aduta, a po konvenciji iz §11.2 nema dečka.

Slanje te poruke je `belaLead`: kao **suigrač zvača**, dolaskom na štih s belom
izlazi se **kraljem**, a s belom i devetkom **babom** — „on će znati da je devet
kod tebe”. S dečkom u ruci se ne radi ništa od toga: tada je dečko potez, i baš
zato su K i Q čitljivi.

### 11.4 Gdje to ulazi u odluku

Jedno mjesto, i namjerno samo jedno: **`trumpOutlook`**. Od preostalih aduta
odbijaju se oni koje protivnik **ne može** imati (`opponentCanHold`), pa svako
pitanje nizvodno — „mogu li me presjeći”, „ima li vađenje aduta smisla”, „smijem
li voditi asa” — dobiva točniji odgovor.

Uz to `shouldDrawTrumpsForPartner` sada pita `provablyNoTrumpJack`, koji uz
zvanja gleda i izgovorene dokaze iz §11.2.

**Što je probano i izvađeno.** Napisan je i `isMasterAgainstOpponents` — „ništa
što protivnik može imati ne tuče ovu kartu” — i uguran redom u `hasWinnersToCash`,
`trumpDrawCard`, `partnerTrickIsSafe`, `isSureFutureWinner` i `stigljaLead`.
Mjerio je **−0,5 do −0,9 pp** u svakoj kombinaciji i na kraju je obrisan. Dva
razloga, oba korisna za ubuduće:

1. **Pri vođenju partnerova jača karta nije prednost nego teret.** Po
   ispravljenom §1.5 partner **mora** preko mene. Ako mu zvanje locira dečka, a
   ja izađem devetkom „jer je najjača protiv protivnika”, on je prisiljen baciti
   dečka na moj štih — potrošena su oba.
2. Šira definicija najjače karte čini `partnerTrickIsSafe` češće istinitim, pa
   se češće puni bodovima, a punjenje se i ranije pokazalo precijenjenim.

---

## 12. Cijena, i što je ostalo vani

Sva pravila iz dokumenta su sada u botu, osim jednog. Četiri od njih su
**izmjerena kao šteta** i ipak su unutra, na izričit zahtjev korisnika
2026-09-09; ovaj odjeljak postoji da se ta cijena ne izgubi.

Mjera je uvijek ista: A/B protiv prethodnog bota, 2400 partija do 501, tri
odvojena skupa seedova, svaki seed u obje postave sjedala (50,0 % = nema
razlike).

| pravilo | mjera | koliko se okida |
|---|---|---|
| **dečko se ne podiže „u glavu”** | **46,5 %** (−3,5 pp) | rijetko |
| „zadnja boja koju nitko nema” | 49,6 % (−0,4 pp) | 2 674 / 2400 partija |
| „vrati aduta” | 50,2 % / 49,6 % ovisno o skupu | 494 |
| ciljanje štiglje | 50,0 % | 128 vodstava |

Sva četiri zajedno: **45,8 %**. Bez dečka u glavu: **49,3 %** — dakle dečko je
gotovo cijela razlika. Regresijski guard je s tim pravilima pao s 27/30 na
25/30 protiv nasumičnog igrača (prag je 18/30).

Dečko u glavu je i dvaput bio mrtav kod prije nego što je proradio: uvjet je
pitao `hasWinnersToCash`, a to broji i sam adutski dečko. Sada pita
`plainSuitsAllTopped` (§5.2).

**Što još nije implementirano** (ispravak 2026-09-09: raniji tekst je tvrdio da
je ostalo samo blefiranje, što nije bilo točno):

- **Blefiranje** — ići „ispod”, zastati prije poteza. Dokument ga dopušta samo
  protiv igrača koji te poznaju i nikad na suigračevo podigravanje; bot igra
  protiv nepoznatih ljudi, pa bi to bio šum, a ne informacija.
- **„Podigrao mi je stranog asa → nema adutsku 9”** i ostale rečenice iz
  *bočnih* podigravanja. §11.2 čita samo adutska otvaranja; obitelj zaključaka
  iz bočnih karata nije napisana.
- **`isMasterAgainstOpponents`** — vidi §11.4: napisano, izmjereno na −0,5 do
  −0,9 pp u svakoj kombinaciji, obrisano.
