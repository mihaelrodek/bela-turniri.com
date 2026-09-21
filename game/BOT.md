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

**Završnica** (`mustNotPass`): ako bi jednom podjelom (uzeto kao 90 bodova) do
cilja došle OBJE strane, zove se bez praga — „tad se mora zvati i ne dozvoliti
protivniku da bira aduta”. (Do 2026-09-20 dovoljno je bilo da ih protivnici
dosegnu, pa je bot pri 572:924 zvao na 7/8/10 i pao.) Traži `view.targetScore`; bez njega se
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

Suigračevo **otvaranje štiha** je druga rečenica i čita se u §13.2. Zaključak
iz odbacivanja se koristi **pri otvaranju štiha** (§5, pravilo 1). Uz to i dalje
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
ide **devetka ako je imam, inače dečko** (`highTrumpOnPartnersLowTrump`). Baba
ili kralj jesu jeftiniji, ali iznad njih mogu ostati 10, as i 9. Otvorio je
nisko jer želi da aduti izađu; 9 ili J su karte koje ih zaista izvlače.

---

## 5. Otvaranje štiha

Redoslijed u `leadCard`. Nijedno pravilo ne prolazi bez uvjeta — neograničeno
pravilo je ono što je 2026-09-08 izlazilo adutom osam puta po podjeli.

0. **Prvo otvaranje za partnerov poziv** (`openingTrumpForCallingPartner`): ako
   je partner dobrovoljno zvao adut, a ja otvaram prvi štih, obavezno mu
   podigravam adut. Pretpostavka je da je zvao na dečka; zato ide i usamljena
   adutska 10 kada nemam jeftiniji adut. Preskače se samo kad javna zvanja
   dokazuju da partner nema adutskog dečka ili kad je poziv bio prisilni mus.
   Ovo nije dopuštenje zvaču da kasnije vodi 10 pod protivničku 9.
1. **Boja koju je suigrač tražio** (§3), ako je mogu otvoriti — otvaram je
   nisko, jer je njegova 10 najjača, a moja karta je samo ulaz.
1a. **Vrijedan adut na obrani** (`defensiveTrumpCapture`): ako držim dokazano
   najjači preostali adut, a jedini drugi neodigrani adut koji protivnik još
   može imati jest **10 ili as**, vodim najslabiji svoj adut koji ga sigurno
   izvlači i čuvam jaču kontrolu za sljedeći štih. To je
   slučaj J, Q, K i 8 već vani, ja držim 9, a neodigrana je 10. Ne okida se
   zbog gole 7 ili 8: za bezvrijednu kartu nema smisla trošiti kontrolu aduta.
1b. **„Vrati aduta”** (`partnerAskedForTrump`, TRIK): suigrač je negdje u ovoj
   podjeli otvorio **niskim adutom** (7, 8 ili 9). To je rečenica — „imam
   sljedeću najjaču u adutu ili sva tri strana asa, vrati adut” — pa kad lead
   dođe do mene, ide natrag u adut. Samo dok protivnici još mogu imati adut;
   kad dokazano nemaju, rečenica je odgovorena.
   Povratna karta bira se kao kod vađenja aduta: najjači preostali adut ako ga
   držim, inače samo jeftini 7/8/Q/K. **Adutska 10 ili as ne vode se ispod još
   neodigrane 9 ili J** samo zato što je partner ranije zatražio povrat.
1c. **Istjerivanje zadnjeg aduta** (`forceOutTheLastTrump`, TRIK): ako je u
   igri ostao **jedan jedini** adut i jači je od svih mojih, ne dajem adut da
   ga izvučem nego otvaram najdužu boju bez asa — tko ga drži mora ga potrošiti
   na štih koji smo ionako gubili, a ako je kod suigrača, reže boju koju ionako
   nisam mogao ubrati.
1d. **Obrambena knjiga otvaranja** (§7) kad su protivnici zvali. Ide **prije**
   vođenja asa: prvo što dokument kaže jest da se na obrani ne otvara vlastita
   asova boja.
2. **Vađenje aduta**, samo kad ima svrhu (`shouldDrawTrumps`, README §5).
   Karta kojom vadim, kao zvač (`callerTrumpLead`, TRIK):
   - imam J, 9 i A aduta **i** stranog asa → počinjem **adutskim asom** („ne
     odbacuj potkovanu 10, imat ćeš vremena”);
   - imam J, 9 i A aduta **bez** stranog asa → počinjem **devetkom**;
   - kad je zvač prvi u štihu i ima dečka, vodi **dečka**. Tako sigurno skuplja
     izdvojenu 9 i asa. Odluka je deterministička; nema nasumične iznimke;
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

Od 2026-09-20 u ovaj redoslijed ulaze i četiri pravila iz **§13**: zvačevo
izbijanje dečka malim adutom i povrat malog aduta nakon dečka idu **iznad**
vađenja aduta (točka 2), a vraćanje suigračeve boje i čitanje njegova niskog
otvaranja kao „vrati aduta" sjede uz točke 1 i 1b.

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
| staro: **dečko se nikad ne podiže „u glavu”** | **46,5 %** (−3,5 pp) | rijetko |
| „zadnja boja koju nitko nema” | 49,6 % (−0,4 pp) | 2 674 / 2400 partija |
| „vrati aduta” | 50,2 % / 49,6 % ovisno o skupu | 494 |
| ciljanje štiglje | 50,0 % | 128 vodstava |

Sva četiri tadašnja pravila zajedno: **45,8 %**. Bez starog pravila za dečka:
**49,3 %** — dakle ono je bilo gotovo cijela razlika. Zato je 2026-09-13
zamijenjeno pravilom da zvač na svom otvaranju vodi dečka. Brojevi u tablici su
povijesno mjerenje stare, uvijek-niske varijante; novo pravilo još nema A/B
mjerenje. Regresijski guard je s tadašnjim pravilima pao s 27/30 na 25/30
protiv nasumičnog igrača (prag je 18/30).

Staro pravilo za niski adut bilo je i dvaput mrtav kod prije nego što je
proradilo: uvjet je pitao `hasWinnersToCash`, a to broji i sam adutski dečko.
To je pravilo uklonjeno kada je uvedeno determinističko vođenje dečka.

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

---

## 13. Stol, 2026-09-20

Šest pravila iz jedne korisnikove prijave. Sva su o karti koja **sada** vrijedi
više nego za dva štiha: as pod rez koji dolazi, boja koju je suigrač iznio, i
dečko koji mora van prije nego pojede nešto vrijedno. Nijedno nije A/B mjereno
(§9) — ušla su kao pravila stola, kao i §12.

### 13.1 Zadnji sam, a doma su as i desetka (`aceOverCheapWinner`)

Prijavljeni štih: na stolu 7, 8 i dečko strane boje, u ruci A, 10 i kralj. Bot
je bacio **kralja** — najjeftiniji dobitni potez, štih je ionako njegov. Ali as
i desetka su 21 bod u boji koja je sad prošla jedan krug, pa je sljedeći krug
onaj u kojem netko reže. **Kad sam zadnji u štihu bočne boje i imam i asa i
desetku te boje, ide AS.** Njegovih 11 bodova je ubrano dok je boja još sigurna,
a desetka ostaje najjača iza njega.

Samo kad as **stvarno uzima**: ako je netko već presjekao, as nije dobitna karta
i odluku vodi obično odbacivanje. Pravilo stoji u grani „mogu uzeti štih”, pa
nikad ne pretvara propuštanje u uzimanje, i ne dira granu u kojoj štih drži
suigrač — ona ima svoja pravila o asu (§4).

### 13.2 Suigrač je iznio boju (`suitToReturnToPartner`, `partnerLowPlainLeadAsksForTrump`)

Suigrač je otvorio štih bočnom bojom, a ja sam ga uzeo **asom** te boje. Što
dalje, odlučuje **tko je zvao** (ispravak vlasnika, 2026-09-20 — prva verzija
je dijelila po visini karte i time je krivo čitala nezvačevu malu kartu):

| Tko je otvorio | Njegova karta | Značenje | Odgovor |
|---|---|---|---|
| suigrač koji **nije zvao** | bilo koja, mala ili veća | možda mu je to solo karta; ako je vratim, on siječe i „spasi aduta” kojeg bi inače izgubio | ta boja natrag, **uvijek**, nisko |
| suigrač **zvač** | **7, 8 ili 9** | „imam adutskog dečka, vrati aduta” | adut natrag (`trumpDrawCard`) |
| suigrač **zvač** | 10, J, Q, K | boju je iznio i želi je nastaviti | ta boja natrag, nisko |

Zvačevo otvaranje **malim adutom** je zasebna rečenica (§5 pravilo 1b, §13.4):
ako imam dečka, adut se vraća — uvijek kad ga imam i dok protivnici još mogu
imati adut.

Dug se plaća **jednom**: štih koji sam kasnije sam otvorio u toj boji ga briše,
da pravilo ne prikuje bota na jednu boju do kraja podjele. „Vrati aduta” ima
iste dvije brane kao i §5 pravilo 1b — samo dok protivnici mogu imati adut i
samo dok zvanja ne dokazuju da suigrač nema dečka.

### 13.3 Zvač koji je zvao na količinu (`callerLengthTrumpLead`)

Zvao sam na **duljinu**: tri ili više aduta, ali bez dečka (prijavljeni oblik
7, 9, 10, baba, as). Dečko je vani i svaka moja karta živi ispod njega, pa se
izbija **malim adutom** — 7, 8, baba ili kralj, nikad 9/10/as, jer bi to bilo
deset bodova poklonjenih baš toj karti koju izbijam.

Namjerno **izvan `shouldDrawTrumps`**: to pravilo traži najjači adut u ruci ili
suigrača koji je zvao, a ruka bez dečka nema ni jedno ni drugo — grana unutar
njega nikad se ne bi okinula. Gasi se sama: čim je dečko na stolu ili lociran
kod nas (`opponentCanHold`), nema se što izbijati. **Mus** je isključen (to nije
zvanje na količinu), a s **dva** aduta se i dalje ne vodi mali adut — to je
postojeće pravilo i njegov test („as s desetkom iza njega, ne adut”).

### 13.4 Mali adut natrag nakon dečka (`lowTrumpBackAfterJack`)

Suigrač je otvorio **niskim adutom** (što po §11.2 znači da nema dečka), a ja
sam taj štih uzeo **dečkom**. Tada najjači preostali adut vrlo vjerojatno leži u
mojoj ruci (devetka), pa se vraća **mali** adut: dva protivnička aduta padnu na
bezvrijednu kartu, a devetka ostaje za štih poslije.

Dva uvjeta, oba provjerena a ne pretpostavljena:

- moram **stvarno držati** najjači preostali adut (`isMasterCard`) — inače nema
  što čuvati i obično vađenje aduta je bolje;
- protivnici još moraju moći imati adut (`trumpOutlook`) — ako je sve preostalo
  suigračevo, mali adut vuče samo njegovo.

Stoji **iznad** vađenja aduta, jer `trumpDrawCard` vodi najjači adut kad ga ima,
a to je točno karta koju ovo pravilo čuva.

### 13.5 Dečko, ne as, dok je devetka iza mene (`jackOverAceOnTrumpLead`)

Prijavljeni štih: suigrač je izašao adutskim **kraljem**, protivnik je pokrio
adutskom **desetkom**, a ja imam i **asa** i **dečka**. Bot je igrao asa jer je
jeftiniji dobitni potez po bodovima — i četvrti igrač ga je uzeo **devetkom**.
Kad se prati adutsko otvaranje s dečkom i asom u ruci, a **devetka nije
odigrana** i može biti kod nekoga tko igra **poslije mene**, ide **dečko**.
Njega ne uzima ništa.

Ne dira zvačevo **otvaranje** (`callerTrumpLead`, §5): ono i dalje kreće asom
(uz strani as) ili devetkom i čuva dečka za kraj. Ovo pravilo radi samo kad je
karta već na stolu, a ono samo kad stola još nema. Kad sam **zadnji**, devetka
je propustila svoju priliku i as je u redu.

### 13.6 Otvaranje solo kartom (`singletonLead`)

Zrcalna slika §13.2: kad sam **ja** prvi na redu i imam solo kartu u bočnoj
boji, otvaram njome — suigrač je uzme i vrati, a ja siječem malim adutom.
Odluka je zaključak, ne postotak:

- nisam zvač (zvačevi aduti služe za izvlačenje, ne za sječenje);
- imam **malog** aduta za sječenje — dečko i devetka nisu karte za to;
- boja još nije igrana i suigrač nije pokazao da je nema;
- as te boje nije poznat kod protivnika (tad im samo dajem tempo). Poznat kod
  **suigrača** (zvanja, `locatedCards`) je najbolji slučaj i jedini u kojem se
  smije otvoriti i solo **desetkom** — ide kući pod njegovim asom;
- solo as nije stvar ovog pravila.

Stoji iznad obrambene knjige i tihog otvaranja, koji bi solo kartu inače
odbili kao „tanko” otvaranje (`isThinLead`, §5) — ta cijena vrijedi za solo
kartu bez plana; ova ima plan. Ruka bez malog aduta i dalje pada na staro
pravilo.

## 14. Štihak, 2026-09-20

`stigljaLead` (§8) je samo **kraj** štihaka: pali tek kad je prolaz u džepu i
svaka karta u ruci je najjača. Sredina je nedostajala — bot s pet najjačih
aduta izvukao bi protivničke adute i stao, pa suigrač nije imao na što
odbacivati. Tri sjedala, tri pravila; sva tri su zaključak, nijedno postotak.

### 14.1 Onaj koji vuče (`stigljaTrumpRun`)

Na redu sam, protivnici nisu uzeli nijedan štih, zvala je moja strana i **svaki
adut u mojoj ruci je najjači** — takvo otvaranje ne može izgubiti štih, pa
„ne riskiraj pad da bi išao na štiglju" vrijedi samo po sebi. Aduti se vuku i
**nakon** što protivnici ostanu bez njih (`shouldDrawTrumps` tu staje): svaki
je besplatno odbacivanje za suigrača, a njegovo odbacivanje je jedini način da
mi kaže gdje preuzima. Stoji ispod izvlačenja, pa zvačev redoslijed (as/devetka
prije dečka, §5) i dalje otvara.

Staje kad štihak više nije moguć:

- suigrač je odbacio iz **svake** boje u kojoj bih ga trebao, a nijednu nije
  zatražio — tamo nema ništa, pa ostatak aduta više vrijedi za sječenje i
  povratak u igru nego za paradu;
- **zadnji** adut ide samo kad ništa ne košta: sve bočne karte su mi najjače,
  ili je suigrač zatražio boju koju mu mogu dati.

Nakon niza vrijede stara pravila vođenja: moj as kad protivnici ne mogu sjeći
(`aceToCash`), inače boja koju je suigrač zatražio (`partnerSignal.wants`), a
boje koje je odbacio se izbjegavaju.

### 14.2 Suigrač onoga koji vuče (`stigljaSignalDiscard`)

Nemam aduta, a suigrač ih vuče za štihak: boja u kojoj mogu preuzeti ostaje
**cijela**, ostale idu van **od veće prema manjoj, najkraća prva** („imaš u
jednoj boji dečka solo, a u drugoj babu i sedmicu: prvo dečka, pa babu, pa
sedmicu"). Poziva se iz `fillCard`, ispred punjenja: `fillCard` bi inače s
A-10-K stavio upravo desetku te boje, a devedeset bodova je više od deset.

### 14.3 Obrana (`opponentsChasingStiglja`, `stigljaDefenceDiscard`)

Protivnici su uzeli sve štihove dosad, najmanje dva. Jedan naš štih sprema
devedeset bodova, pa se odbacuje iz boje u kojoj ga nikad ne mogu uzeti, a
**čuvar se ne skida sa stopera**: desetka uz dvije male ispod asa koji je još
vani zadržava obje male (`stopperGuard` = broj jačih karata vani + 1), najjača
karta zadržava samu sebe. Kad je svaka ponuđena karta dio nekog čuvara, pravilo
šuti i bira staro odbacivanje.

Nije napravljeno: čitanje **protivničkog** odbacivanja radi pogađanja boje u
koju će izaći, i dogovor dvojice braniča tko čuva koju boju.

## 15. Usklađivanje s dokumentom, 2026-09-21

Dokument „Bela trikovi" je ponovno pročitan red po red uz kod (ne uz ovaj
tekst). Nalaz koji je najviše boljelo: **`signalDiscard` (§2) nije pozivao
nitko** — odbacivanje je radio `fillCard`, koji puni najvrednijom kartom, pa je
bot s A-10-K bacao desetku baš one boje koju je htio da mu se otvori. Sedam
ispravaka:

1. **Odbacivanje dok suigrač vuče adute** (`fillCard`). Redom: na njegovog
   **dečka** ide as koji ima svoju desetku („da ti napuni, a ujedno pokaže da
   ima desetku"); zatim §14.2 dok je štihak živ; zatim, ako imam boju za
   preuzeti, `signalDiscard` — napuštene boje od veće prema manjoj, čuvana
   zadnja i odozdo; tek bez ičega za preuzeti puni se svaki bod.
2. **Rampa opasnosti i mus** (`chooseBid`). Suigrač je djelitelj i dva su pasa
   već pala: moj pas njega stavlja u mus na ruku koju nije birao, pa se rampa
   (§1) gasi i vrijedi obično „spasi suigrača".
3. **Asova boja** (`shouldSpendAce`). Suigrač zvao, prvi sam, nemam aduta: boja
   u kojoj imam asa se ne otvara — as je moj povratak u igru.
4. **Podigravanje zvaču** (`openingTrumpForCallingPartner`). Solo devetka i
   gole 7/8 se ne podigravaju; tada vrijede obična pravila otvaranja.
5. **Desetkom, ne asom** (`aceOverCheapWinner`, `partnerSuitTakenByMyAce`).
   Zvač-suigrač otvori bočnu kartu, a ja imam asa i desetku: nosi desetka, as
   ostaje kao poruka. „Vrati aduta" (§13.2) i „vrati boju" priznaju i štih
   uzet desetkom.
6. **Zvač bez dečka** (`callerLengthTrumpLead`, mijenja §13.3). Vodi **babu ili
   kralja** ako ih ima, tek inače najmanji adut: 7/8 je rečenica „vrati aduta",
   a dokument kaže „podigrati aduta (ne 7 i 8)".
7. **Dva minimuma za zvanje** (`documentedMinimumCall`). Bela uz devetku i
   potkovanu desetku sa strane, te četiri karte iste boje — oba samo kad
   otvaram igru i samo kad rampa opasnosti miruje. Izmjereno na 2000 uparenih
   partija do 501: 50,1 % ± 2,2, oko četiri dodatna zvanja na sto partija.
   Neutralno; ostaje zbog vjernosti dokumentu, ne zbog snage.

Još nije napravljeno (iz istog čitanja): tri aduta od manje prema većoj na
suigračevo vučenje, zaključci iz suigračevog bočnog otvaranja, karta koja
„bježi" odmah iza aduta, dovođenje desnog u štih, as ili desetka prema viđenom
zvanju, i ići ispod asa kad je suigrač bacio desetku.

### 15.8 Solo karta i suigračevo zvanje (dopuna §13.6, prijava 2026-09-21)

Suigrač je pokazao 8-9-10 u kari, bot je otvorio svojim solo dečkom kare:
suigrač je morao preko (§1.5) i desetka je izletjela pod asa koji je drugdje —
„spašen" jedan mali adut, plaćeno deset bodova i boja. `singletonLead` sada
preskače boju u kojoj **zvanje pokazuje suigračeve karte bez asa**. As poznat
kod suigrača i dalje je najbolji slučaj i otvara se.

### 15.9 Zvačev dečko čeka suigračevu POKAZANU devetku (prijava 2026-09-21)

Suigrač je pokazao 7-8-9 ili 8-9-10 u adutu, pa cijeli stol zna gdje je
devetka. Dečko otvoren u to samo vuče i njegove adute. Zato:

- **zvač** (`callerLeadsToPartnersNine`): ima dečka, zvanje smješta devetku kod
  suigrača, protivnici još mogu imati adut → ne vodi dečka nego traži
  suigračevu ruku: mala karta iz bočne boje u kojoj **nema asa** (nikad desetka
  naslijepo, nikad boja u kojoj zvanje pokazuje protivnikov as, nikad boja koju
  suigrač nema); najbolje boja u kojoj zvanje pokazuje **suigračev** as. Bez
  takve karte vrijedi obično otvaranje dečkom;
- **suigrač** (`declaredNineThrough`): pokazao je devetku, zvao je suigrač,
  dečko još nije pao → kad dođe na red, **devetka ide kroz**. Bije je samo
  zvačev dečko, a on ostaje doma za sljedeći krug. Samo POKAZANA devetka:
  jedino tada zvačevo čekanje jest plan, a ne nagađanje.

Oba stoje iznad `callerJackLead` i izvlačenja, koji bi inače potrošili dečka
na suigračeve adute.

### 15.10 Zadnji adut u igri ide prvi (dopuna §14.1, prijava 2026-09-21)

Sedam aduta je palo u dva kruga, zvač drži osmi i jednog asa. §14.1 ga je
čuvao kao povratak u igru — ali povratak treba samo dok netko drugi može imati
adut. Kad je svaki drugi adut već odigran, zadnji ne košta ništa: uzimam štih i
**i dalje sam na redu**, a suigrač dobiva još jedno odbacivanje. Jedno
odbacivanje ga ostavlja između dvije boje, drugo imenuje onu koju želi
(`partnerSignal.wants`), i tek tada se otvara ta boja.

**Ne uvijek** (ispravak vlasnika isti dan): zadnji adut ide samo kad iza njega
ima nešto — moja vlastita najjača bočna karta (as), boja koju je suigrač već
zatražio, ili as koji suigračevo zvanje pokazuje. Ruka koja osim tog aduta nema
ništa jako ne igra na štihak: karta normalno, a adut ostaje doma.

### 15.11 Mjerenje do 1001 (2026-09-21, 20 000 uparenih partija po retku)

Pogled građen kao na poslužitelju (`viewFor(…, { recallTricks: true })`) —
`simulation.test.ts` to ne radi, pa su ranija mjerenja pravila koja čitaju
`trickHistory` podcjenjivala.

| mjerenje | pobjede ±95 % |
|---|---|
| novi vs stari (commit) @1001 | 49,0 % ±0,7 |
| novi vs stari @501 | 49,2 % ±0,7 |
| novi vs random @1001 | 85,9 % ±0,5 |
| bez `singletonLead` (§13.6) | puni bot 49,0 % ±0,7 — **jedino mjerljivo štetno** |
| bez `stigljaTrumpRun` (§14.1) | puni bot 49,3 % ±0,7 — na rubu |
| ostala nova pravila | unutar ±0,7 — neutralna |

Mjereno PRIJE §15.8–§15.10 i prije ispravka `passes.length` (pravilo „spasi
suigrača u musu" nije palilo nikad: tražilo je dva pasa na mjestu koje uvijek
vidi točno jedan).

### 15.12 As prije ostatka niza (dopuna §14.1, 2026-09-21)

„Stranog asa odigravaš čim si protivnicima pokupio adute (tako da tvoj suigrač
zna zadržati bezec desetku), a onda nastaviš s povlačenjem aduta." Niz iz §14.1
stajao je **iznad** `aceToCash`, pa je as čekao da aduti prođu i suigrač je
odbacivao ne znajući koju desetku čuvati. Sada `stigljaTrumpRun`, čim protivnici
nemaju aduta, prvo vraća `aceToCash` — pa tek onda adute, jedan, dva ili tri.
Solo as i dalje ide **nakon** aduta (`aceToCash` ga namjerno preskače), da
suigrač ne čuva desetku u boji koju mu ne mogu otvoriti.

Uvjet iz §15.10 („nešto iza zadnjeg aduta") priznaje i asa koji je upravo
odigran: ako sam ga otvorio i uzeo, a još držim kartu te boje, to je put do
suigračeve desetke.

### 15.13 Predaja partije suigraču: desetka, ne sedmica (`stigljaHandOver`, 2026-09-21)

Štihak je živ, moji aduti i moji vlastiti štihovi su potrošeni, protivnici
nemaju aduta, a **zvanje pokazuje suigračevog asa** u boji u kojoj imam karte
(npr. pokazao je baba-kralj-as, ja držim 10 i 7). Predajem mu **najjačom**
kartom te boje: sa sedmicom bi on uzeo asom, a u sljedećem krugu bi moja
desetka sjela preko njegovog kralja — uzeo bih štih koji ne mogu nastaviti i niz
bi umro u mojoj ruci. Pod njegovim asom desetka ne košta ništa, bodovi su naši.

Samo uz **dokazanog** asa (zvanje). Na samo odbacivanje desetka bi mogla ući u
protivničkog asa, a to je druga oklada. Dok još imam ijednu najjaču kartu,
pravilo šuti i vrijede §14.1 / `stigljaLead`.

**Dopuna §15.13 (isti dan):** predaja desetkom vrijedi i kad as **nije** pokazan
zvanjem, ali ga je suigrač rekao odbacivanjem koliko se to uopće da reći:
odbacio je iz **obje** druge bočne boje, iz ove nikad, a njezin as još nije
viđen i nije kod mene (ni kod protivnika po zvanju). Jedno odbacivanje manje od
toga — ide mala karta, kao i prije.

### 15.14 Suigrač bez ičega javlja „stani" (`stigljaStopSignal`, 2026-09-21)

Suigrač vuče adute za štihak, a ja nemam nijednu boju za preuzeti. To treba
reći **odmah**: svaki daljnji adut je adut koji je mogao zadržati. Rečenica je
**miješanje boja** — karta iz boje iz koje još nisam odbacivao, pa iz druge, pa
iz treće — jer on čita upravo to: „odbacio je iz svake boje u kojoj bih ga
trebao" (`partnerSignal.avoids`, stop u `stigljaTrumpRun`, §14.1). Unutar
odabrane boje i dalje ide najvrednija karta, pa se usput ništa ne baca.

S bojom za preuzeti vrijedi §15.1: napuštene boje od veće prema manjoj, a
**čuvana boja, kad se mora dirati, od manje prema većoj**.

**Ispravak isti dan (vlasnik):** „stani" je **niska** karta. Onaj tko želi
treću boju odbacuje ostale **od vrha** (prva karta mu je kralj ili baba), pa se
rečenice razlikuju po visini, ne po broju boja:

- odbacuje `stigljaStopSignal`: najniža karta iz boje iz koje još nisam
  odbacivao, najradije iz boje koja uopće ima bezvrijednu kartu;
- čita `partnerSaysStop` / `partnerSignal`: **dvije niske karte zaredom iz dvije
  različite boje** = „stani" — `wants` je tada `null`, `stigljaTrumpRun` staje, a
  predaja desetkom (§15.13) ne pali.

Ostaje prosudba koju pravilo ne može imati: suigrač koji u dvije boje ima samo
po jednu malu kartu izgledat će kao „stani" iako želi treću. Jedna niska karta
sama ne znači ništa.

### 15.15 „Mora se zvati" nije „zovi na bilo što" (prijava 2026-09-21)

92:90 u brzoj igri do 163; bot je kao treći zvao herc na **8-baba-as**, a iza
njega je bila samo protivnička djeliteljica. `mustNotPass` (§1) je palio bez
ikakvog praga — i u igri do 163 pali gotovo u svakom dijeljenju nakon prvog.
Dvije granice (`worthAForcedEndgameCall`):

- ako moj pas ostavlja **protivnika u musu** (on dijeli, ja sam zadnji prije
  njega), on ne „bira aduta" nego mora zvati na ono što drži — bolje od toga ne
  može; tada se pasa, kakva god ruka bila;
- adut mora biti **stvaran**: `suitStrength >= 4` (sam dečko prolazi, devetka
  uz asa prolazi; 8-baba-as, gola devetka ili tri asa bez aduta ne). Pad na tom
  rezultatu je izgubljena partija, a ne izgubljeno dijeljenje.

Djeliteljev mus ostaje kakav jest — tamo izbora nema.

Treća granica (isti dan): **prozor „kraja partije" najviše je četvrtina cilja**
(`endgameWindow` = min(90, cilj/4)). Na 501/701/1001 ostaje 90; u brzoj igri do
163 je 41, pa pravilo pali tek kad su obje strane na 122 ili više, a ne od 73.

### 15.16 Najjači adut uzima ZADNJI štih (`plainBeforeLastTrump`, 2026-09-21)

Ostale su dvije karte, na redu sam, jedna je najjači adut, druga bočna karta
koja nije najjača. **Prvo ide bočna**, adut uzima zadnji štih i njegovih deset
bodova. Obrnuto bih uzeo sedmi štih, a osmi — s desetkom — dao onome tko tuče
moju bočnu kartu. Ako je i bočna karta najjača, redoslijed više ništa ne košta
pa adut ide prvi kao i inače (usput izvuče zadnji adut koji bi je mogao
presjeći). Stoji na samom vrhu `chooseLead`: nijedno drugo pravilo otvaranja ne
gleda bodove zadnjeg štiha, a nekoliko njih bi ovdje otvorilo adutom.

### 15.17 Bez „šaranja" (`continueAceSuit`, dopuna `isThinLead`, 2026-09-21)

**As pa as pa treća boja.** Bot s dva asa otvarao je jednog, pa drugog, pa
treću boju — svakim otvaranjem nova boja za protivnike, a suigraču nijedna
poruka. Sada: otvorio sam bočnog asa, uzeo ga i svi su pratili → sljedeća karta
je iz **iste boje**. Desetka ako je postala najjača i vani su još barem tri
karte te boje (da je nitko ne siječe), inače najmanja. Šuti kad netko nije
pratio asa (boja će biti presječena), kad više nemam tu boju, ili kad je vani
ostala samo jedna njezina karta. Stoji ispred `aceToCash` i trošenja asova.

**Kratka boja s desetkom.** `isThinLead` je „tankom" smatrao samo samu desetku.
Sada je tanko i **svako** otvaranje iz boje od najviše tri karte u kojoj je
desetka, a as je još vani (7-dečko-10: otvoriš sedmicom, as nosi štih, desetku
netko presiječe u sljedećem krugu). Ostavljena na miru, desetka ide na tuđeg
asa ili dočeka svoju priliku. Kad je as već pao, desetka je najjača i boja je
opet obična.

### 15.18 As odmah nakon mog vlastitog štiha (`aceAfterMyWin`, prijava 2026-09-21)

Protivnik otvori kartu, bot je uzme **desetkom** (as ostaje doma), suigrač
odbaci jer nema te boje ni aduta, a bot je sada na redu — i otvori **malu kartu
iz druge boje**. As je tada bio najsigurniji što će ikad biti; odgođen, netko ga
presiječe ili ga bot nikad ne otvori i baci ga na zadnjem štihu ni za što.

Razlog nije bio jedan izričit „ne": `chooseLead` asove drži izvan „tihog
otvaranja" (`kept`), a `shouldSpendAce` ih pušta samo u prvom krugu boje, dok
protivnici nemaju aduta, ili s dvije karte. Nakon prvog kruga svi su uvjeti
otpali, pa je as čekao.

Sada as ide **odmah**, ako vrijedi sve od navedenog: uzeo sam upravo taj štih;
oba protivnika su pratila boju (nitko nije bio prazan prije kruga); nitko nije
sjekao; ovo je bio **prvi krug** te boje; vani su **barem tri** njezine karte;
suigrač nije prisiljen sjeći moj as (prazan je u boji, a još ima aduta).
Suigračevo odbacivanje umjesto sječenja dokazuje da nema aduta — pravila igre
ga ne bi pustila odbaciti. Ostaje rizik ≈ 25 % da jedan protivnik drži svu
preostalu boju pa sječe; to je cijena koja je manja od sigurnog gubitka asa.

Stoji iznad `defensiveLead`, `singletonLead` i `worthSpending` — svi bi otvorili
nešto drugo, a jedan od njih je vjerojatno i napravio prijavljenu grešku.

### 15.19 „Zadnja karta mrtve boje" ne vrijedi asa (`chooseCard`, prijava 2026-09-21)

Ostale su dvije karte: as kare i sedmica boje u kojoj nitko drugi nema ništa.
Protivnik vodi adut, a bot nema aduta pa smije baciti bilo što. Pravilo
„zadnja karta mrtve boje ostaje doma" (`isLastOfADeadSuit`, §2) štitilo je
sedmicu — pa je jedina „dopuštena" odbačena karta bio **as**, jedanaest bodova,
na štih koji uzimaju protivnici. Igrač je pritom proglasio pedeset u kari i bilo
je jasno da će ga upravo taj as kasnije dobiti.

To pravilo je tempo (netko će jednom morati sjeći), vrijedi nekoliko bodova, a ne
smije se plaćati asom: kad bi zaštita koštala **deset bodova ili više** više od
najjeftinije karte uopće, ide najjeftinija — sedmica.

Nije riješeno: kako je as uopće ostao neigran do sedmog štiha (prethodni štih se
iz slike ne može rekonstruirati). Ako se ponovi, treba točan tijek partije.

### 15.20 Sigurne štihove odigraj dok imaš izlaz (`sureWinnerToCash`, prijava 2026-09-21)

Bot je imao četiri herca, svi aduti već pali, hercem je izašao dva puta — i onda
odigrao kartu **druge boje**. Preostali hercevi nikad nisu odigrani i „propali"
su s partijom. Nitko drugi u boji nije imao ništa, a nitko nije imao ni aduta da
siječe: svaki taj herc bio je siguran štih, ali nijedno pravilo nije govorilo
„uzmi ih dok si na izlazu". Svaka karta odigrana u drugoj boji je izgubljen
izlaz, a izgubljen izlaz je izgubljen štih.

Pravilo (u `chooseLead`, odmah iza štihaka i „zadnjeg štiha", ispred svega
ostalog): kad je **dokazano** da protivnici nemaju aduta
(`trumpOutlook.opponentMax === 0`) i držim običnu kartu koju **ništa u igri ne
može prebiti** (`isMasterCard`), izlazim njome. Kad je boja iscrpljena drugdje,
to vrijedi za svaku moju kartu u njoj — drugi i treći herc postaju „gospodari"
čim je prvi otišao, pa se boja odigra do kraja. Prednost ima boja s najviše
sigurnih štihova, a u njoj najjača karta prva.

Izuzeci, oba namjerna: adut se ne dira (ima vlastita pravila, §14 i §15.16), a
**usamljeni as** ostaje gdje ga drži §5.3 (`aceToCash`). Protivnici koji još mogu
imati adut ne pokreću pravilo — sijeku li, boja nije sigurna.

Testovi: `scenarios.lead.test.ts`, „cash a certain suit while I still have the
lead". Nisu pokrenuti u trenutku pisanja; mjerenje jakosti bota (`10 000`
parova) treba ponoviti jer je ovo novo pravilo visoko u redoslijedu.

### 15.21 Dečko i jedna mala nisu zvanje sami po sebi (`isBareJackCall`, prijava 2026-09-21)

Bot je zvao na dečka i kralja u adutu, a sa strane nije imao ništa. Zvanje na
dečka i kralja je normalno — ali **uz nešto**: asa sa strane ili dužinu (tri
aduta). Samo po sebi jamči jedan štih, dečkov, i ništa drugo.

Uzrok: `handTricks` za J + K iznosi 1,0, a bonusi za mjesto u `bidThreshold`
(suigrač prvi na igri −0,25, spašavanje djelitelja −0,4 …) spuštaju prag na 0,85
i niže, pa je ruka prolazila.

Pravilo: dobrovoljno zvanje otpada kad ruka ima **najviše dva aduta**, među njima
**samo jedan od J / 9 / A**, i **nijednog asa sa strane**. J + 9 ostaje zvanje
(dva sigurna štiha), J + K + as sa strane također, J + K + treći adut također.
Prisilna zvanja — djelitelj na musu i „ne smije se proći" u završnici — ne
prolaze kroz ovo pravilo: tamo nema „dalje".

Testovi: `scenarios.bidding.test.ts`, „the jack and one small trump is not a call
by itself". Nisu pokrenuti u trenutku pisanja.
