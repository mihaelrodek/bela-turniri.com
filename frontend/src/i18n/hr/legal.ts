/* `legal` — the long-form Privacy (PrivacyPage, /privatnost) and Terms
   (TermsPage, /uvjeti) texts. Split out of `pages.ts` on purpose: these two
   pages are almost entirely prose, and folding them into the already-large
   `pages` namespace would bury the short UI strings other pages need under
   a wall of paragraphs.

   Croatian is the source of truth: this file's shape defines what
   `src/i18n/sl/legal.ts` must provide, and a missing Slovenian key is a
   compile error. Keys stay flat (one string per leaf, per the whole i18n
   engine's contract — `t()` only ever resolves to a single string) rather
   than nesting sections as arrays in the dictionary; PrivacyPage.tsx /
   TermsPage.tsx assemble the section list themselves and pull each
   heading/body through `t()`.

   Grounded in what the app actually does today — see CLAUDE.md and the
   backend services (`StorageService`, `GeocodeService`, `PushService`,
   `MessageService`, `services/` generally) — not a generic boilerplate
   privacy policy. Review with a lawyer before this is treated as a final,
   binding policy for a live product.

   Last updated date is duplicated as plain text in both `privacy.lastUpdated`
   and `terms.lastUpdated` — bump both together when the wording changes. */

export const legal = {
    // ═══════════════════════ PrivacyPage (/privatnost) ═══════════════════════
    "privacy.documentTitle": "Pravila privatnosti — bela-turniri.com",
    "privacy.documentDescription":
        "Pravila privatnosti stranice bela-turniri.com: koje podatke prikupljamo, zašto ih obrađujemo i koja prava imate.",
    "privacy.title": "Pravila privatnosti",
    "privacy.lastUpdated": "Zadnja izmjena: 13. 9. 2026.",
    "privacy.intro":
        "Ovaj dokument opisuje koje osobne podatke prikupljamo putem stranice bela-turniri.com i naših mobilnih aplikacija, u koje svrhe ih obrađujemo i koja prava imate u vezi s njima.",

    "privacy.controller.heading": "Voditelj obrade",
    "privacy.controller.body":
        "Voditelj obrade osobnih podataka prikupljenih putem ove stranice je vlasnik stranice bela-turniri.com. Za sva pitanja, zahtjeve ili pritužbe vezane uz obradu osobnih podataka obratite nam se putem kontakt obrasca.",

    "privacy.dataCollected.heading": "Koje podatke prikupljamo",
    "privacy.dataCollected.intro":
        "U sklopu rada stranice i mobilnih aplikacija prikupljamo i obrađujemo sljedeće kategorije podataka:",
    "privacy.dataCollected.item.account":
        "Podaci o računu — putem usluge Firebase Authentication prijavljujete se e-poštom i lozinkom, Google računom ili (na iOS uređajima) Apple ID-om; pohranjujemo vašu e-poštu, ime i jedinstveni identifikator korisnika (UID).",
    "privacy.dataCollected.item.profile":
        "Podaci profila — javno prikazano ime, adresa profila (slug), neobavezan broj telefona i država, neobavezna profilna fotografija (pohranjuje se na vlastitom poslužitelju za pohranu objekata (MinIO), a ne kod treće strane), neobavezan odabrani crtani avatar, korisničko ime za online belu, odabrani jezik i tema sučelja.",
    "privacy.dataCollected.item.tournament":
        "Podaci o turnirima — naziv turnira, plakat, lokacija i cjenik koje unosi organizator, te nazivi parova. Anonimna prijava para (bez prijave na račun) prikuplja i kontaktni broj telefona koji je vidljiv isključivo organizatoru turnira, te generira jedinstvenu poveznicu za preuzimanje (claim link) tog para.",
    "privacy.dataCollected.item.media":
        "Fotografije i plakati — plakati turnira i profilne slike pohranjuju se na poslužitelju za pohranu objekata (MinIO) na infrastrukturi operatera stranice.",
    "privacy.dataCollected.item.location":
        "Lokacija uređaja — značajka \"turniri u blizini\" na vaš zahtjev traži okvirnu (gradsku) lokaciju vašeg uređaja te je koristi isključivo lokalno, na uređaju, za razvrstavanje i filtriranje popisa turnira; ta lokacija se nikada ne šalje na naš poslužitelj.",
    "privacy.dataCollected.item.addressSearch":
        "Pretraga adrese — kada organizator upisuje adresu turnira, uneseni tekst adrese šalje se pružatelju usluge pretrage adresa: Google Places (kada ga operater omogući) ili javnoj usluzi OpenStreetMap Nominatim.",
    "privacy.dataCollected.item.mapTiles":
        "Karta — sličice karte (map tiles) dohvaćaju se s usluga CARTO ili OpenFreeMap; svaki takav zahtjev tim uslugama otkriva približno područje karte koje gledate i vašu IP adresu.",
    "privacy.dataCollected.item.push":
        "Push obavijesti — ako odobrite primanje obavijesti, pohranjujemo tehničku pretplatu: adresu (endpoint) Web Push pretplate u pregledniku, odnosno token uređaja usluge Firebase Cloud Messaging (FCM) u mobilnim aplikacijama, te tijekom online igre token za Live Activity (iOS) odnosno Android Live Update. Token brišemo kada isključite obavijesti, kada poslužitelj pošiljatelja javi da je token nevažeći, ili prilikom brisanja računa.",
    "privacy.dataCollected.item.game":
        "Podaci o igri — pristupni kodovi konobara, računi za pića i rezultati susreta koje organizatori i konobari unose tijekom turnira.",
    "privacy.dataCollected.item.onlineGame":
        "Online bela — ako igrate online belu, rezultati partija i statistika pohranjuju se uz vaš račun. Ako igrate kao gost, dodjeljuje se anonimni identifikator koji se pohranjuje lokalno u pregledniku, a na iOS uređajima u sustavu Keychain kako bi identifikator preživio ponovnu instalaciju aplikacije. Ime koje koristite u igri možete promijeniti najviše jednom u 7 dana.",
    "privacy.dataCollected.item.analytics":
        "Analitika — Google Analytics 4 koristimo isključivo na web stranici bela-turniri.com, i to tek nakon što date privolu putem trake za privolu; analitika se ne koristi u mobilnim aplikacijama.",
    "privacy.dataCollected.item.logs":
        "Zapisi poslužitelja — poslužitelj bilježi IP adresu i identifikator zahtjeva (request ID) radi sigurnosti i otklanjanja poteškoća.",
    "privacy.dataCollected.item.device":
        "Podaci na uređaju — lokalna pohrana (localStorage) i predmemorija za rad izvan mreže čuvaju se isključivo na vašem uređaju.",
    "privacy.dataCollected.item.contactForm":
        "Kontakt obrazac — ime, e-pošta, predmet, poruka i vaša IP adresa. IP adresu brišemo najkasnije 30 dana od zaprimanja poruke, a cijelu poruku najkasnije 12 mjeseci od zaprimanja.",
    "privacy.dataCollected.item.reports":
        "Prijave i blokiranja — kada prijavite turnir, par ili profil, pohranjujemo razlog prijave, vašu neobaveznu poruku te identifikator vašeg računa kao podnositelja prijave, dok se prijava ne riješi. Blokiranje drugog korisnika pohranjuje se uz vaš račun radi primjene blokade; prijave pregledava operater stranice.",

    "privacy.purpose.heading": "Svrha i pravna osnova obrade",
    "privacy.purpose.body1":
        "Podatke obrađujemo radi izvršavanja usluge koju ste zatražili (izvršenje ugovora) — prijava, organizacija i praćenje Bela turnira, prijava parova, praćenje rezultata i računa za pića, te igranje online bele.",
    "privacy.purpose.body2":
        "Push obavijesti i analitika obrađuju se na temelju vaše privole, koju možete povući u bilo kojem trenutku.",
    "privacy.purpose.body3":
        "Zapisi poslužitelja i mjere sigurnosti temelje se na našem legitimnom interesu za sigurnost i stabilan rad stranice.",
    "privacy.purpose.body4":
        "Obradu prijava i blokiranja korisnika temeljimo na našem legitimnom interesu za sigurnost zajednice i sprječavanje zlouporabe.",

    "privacy.recipients.heading": "Tko ima pristup podacima",
    "privacy.recipients.body1":
        "Za autentifikaciju koristimo Firebase Authentication (Google Ireland Ltd. / Google LLC) te, na iOS uređajima, Apple Sign in (Apple Inc.); ti pružatelji podatke o prijavi obrađuju u skladu sa svojim pravilima privatnosti.",
    "privacy.recipients.body2":
        "Za pretragu i geokodiranje adresa koristimo, ovisno o postavkama, Google Places (Google Ireland Ltd. / Google LLC) ili javnu uslugu OpenStreetMap Nominatim; tim uslugama šaljemo isključivo uneseni tekst adrese, bez ostalih osobnih podataka.",
    "privacy.recipients.body3":
        "Za prikaz karte koristimo pružatelje sličica karte CARTO ili OpenFreeMap, kojima se pri svakom prikazu karte otkriva vaša IP adresa i približno prikazano područje.",
    "privacy.recipients.body4":
        "Za slanje push obavijesti koristimo standardne usluge preglednika (Web Push), Firebase Cloud Messaging (Google) te, za iOS Live Activity i Android Live Update, odgovarajuće sustave proizvođača uređaja i operacijskog sustava.",
    "privacy.recipients.body5":
        "Stranica se nalazi na poslužitelju kojim upravlja operater stranice; podaci se ne prodaju niti ustupaju trećim stranama u marketinške svrhe.",
    "privacy.recipients.body6":
        "Javne stranice turnira i profila igrača dostupne su svima na internetu i mogu ih indeksirati tražilice (npr. Google) — objavljujte samo podatke koje ste spremni učiniti javnima.",

    "privacy.retention.heading": "Koliko dugo čuvamo podatke",
    "privacy.retention.body":
        "Podatke čuvamo dok god je vaš račun aktivan ili dok postoji legitimna svrha za njihovo čuvanje (npr. povijest turnira). Nakon brisanja računa ili na vaš zahtjev, osobne podatke brišemo ili anonimiziramo u razumnom roku, osim ako je dulje čuvanje propisano zakonom.",
    "privacy.retention.body2":
        "Iznimke s točno određenim rokovima: IP adresa s kontakt obrasca briše se najkasnije 30 dana od zaprimanja poruke, a cijela poruka najkasnije 12 mjeseci od zaprimanja; prijave korisnika čuvamo dok se ne riješe.",

    "privacy.accountDeletion.heading": "Brisanje računa",
    "privacy.accountDeletion.body1":
        "Brisanje računa možete pokrenuti sami, u svakom trenutku, na stranici profila putem opcije \"Brisanje računa\".",
    "privacy.accountDeletion.body2":
        "Brisanje je anonimizacija: uklanjamo podatke profila, fotografiju, broj telefona, postavke, spremljenu povijest Blok bilježnice rezultata te push pretplate, a vaš Firebase račun se briše.",
    "privacy.accountDeletion.body3":
        "Turniri koje ste organizirali i rezultati u kojima su sudjelovali drugi igrači se zadržavaju, s oznakom \"Obrisani korisnik\" umjesto vašeg imena — jer podaci i povijest turnira drugih igrača moraju ostati netaknuti.",

    "privacy.accountDeletion.pageLink": "Detaljne upute i popis podataka: Brisanje računa",

    "privacy.rights.heading": "Vaša prava",
    "privacy.rights.body1":
        "Imate pravo na pristup, ispravak i brisanje svojih osobnih podataka, kao i na ograničenje obrade, prigovor na obradu te na prenosivost podataka.",
    "privacy.rights.body2":
        "Većinu podataka možete sami pregledati i izmijeniti u postavkama profila, a račun izbrisati putem opcije \"Brisanje računa\" na stranici profila. Za ostale zahtjeve obratite nam se putem kontakt obrasca.",
    "privacy.rights.body3":
        "Ako smatrate da se vaši podaci obrađuju suprotno propisima, imate pravo podnijeti pritužbu nadležnom nadzornom tijelu za zaštitu osobnih podataka.",

    "privacy.cookies.heading": "Kolačići i lokalna pohrana",
    "privacy.cookies.body1":
        "Stranica koristi lokalnu pohranu preglednika (localStorage) za pamćenje postavki (jezik, tema) i predmemoriju podataka radi bržeg rada i djelomičnog rada bez internetske veze.",
    "privacy.cookies.body2":
        "Analitičke kolačiće (Google Analytics 4) postavljamo isključivo na web stranici, tek nakon što date privolu putem trake za privolu; svoj izbor možete promijeniti u bilo kojem trenutku. Mobilne aplikacije ne koriste analitiku niti kolačiće.",

    "privacy.children.heading": "Djeca",
    "privacy.children.body":
        "Usluga nije namijenjena osobama mlađima od 16 godina. Ako ste mlađi od 16 godina, stranicu i aplikacije smijete koristiti isključivo uz privolu i nadzor roditelja ili skrbnika.",

    "privacy.changes.heading": "Izmjene pravila privatnosti",
    "privacy.changes.body":
        "Ova pravila privatnosti možemo povremeno ažurirati. O značajnijim izmjenama obavijestit ćemo korisnike na ovoj stranici; datum zadnje izmjene naveden je na vrhu stranice.",

    // ═══════════════════════ TermsPage (/uvjeti) ═══════════════════════
    "terms.documentTitle": "Uvjeti korištenja — bela-turniri.com",
    "terms.documentDescription": "Uvjeti korištenja stranice bela-turniri.com.",
    "terms.title": "Uvjeti korištenja",
    "terms.lastUpdated": "Zadnja izmjena: 13. 9. 2026.",
    "terms.intro":
        "Korištenjem stranice bela-turniri.com i naših mobilnih aplikacija prihvaćate ove uvjete korištenja. Ako se s njima ne slažete, molimo da uslugu ne koristite.",

    "terms.service.heading": "Opis usluge",
    "terms.service.body":
        "bela-turniri.com je besplatna platforma za organizaciju turnira u beli (bela): prijavu i pregled turnira, prijavu parova, izvlačenje rundi, unos rezultata, obračun pića, javne profile igrača te online igru bele.",

    "terms.accounts.heading": "Računi",
    "terms.accounts.body1":
        "Za pojedine radnje (npr. kreiranje turnira, prijavu para) potreban je korisnički račun putem Firebase prijave (e-pošta i lozinka, Google račun ili, na iOS uređajima, Apple ID).",
    "terms.accounts.body2":
        "Odgovorni ste za točnost podataka koje unesete i za čuvanje pristupnih podataka svog računa.",
    "terms.accounts.body3":
        "Svoj račun možete izbrisati u bilo kojem trenutku putem opcije \"Brisanje računa\" na stranici profila; što se pritom događa s vašim podacima opisano je u Pravilima privatnosti.",

    "terms.organiserContent.heading": "Sadržaj koji unose organizatori",
    "terms.organiserContent.body1":
        "Organizatori turnira samostalno unose podatke o turniru, parovima, kontaktnim osobama i lokaciji te snose punu odgovornost za točnost, zakonitost i ažurnost tih podataka.",
    "terms.organiserContent.body2":
        "Ako organizator unosi osobne podatke trećih osoba (npr. imena i telefonske brojeve igrača ili kontakt osoba), dužan je za to prethodno pribaviti njihov pristanak i obavijestiti ih o obradi tih podataka u skladu s propisima o zaštiti osobnih podataka.",
    "terms.organiserContent.body3":
        "Kontaktni broj telefona unesen prilikom anonimne prijave para vidljiv je isključivo organizatoru turnira.",

    "terms.prohibitedConduct.heading": "Zabranjeno ponašanje",
    "terms.prohibitedConduct.body":
        "Zabranjeno je: unositi netočne, uvredljive ili nezakonite sadržaje; zloupotrebljavati funkcionalnosti stranice (npr. automatizirano slanje zahtjeva, zaobilaženje sigurnosnih mjera); neovlašteno pristupati tuđim računima ili podacima; podnositi lažne ili zlonamjerne prijave protiv drugih korisnika; te koristiti stranicu u svrhe suprotne njezinoj namjeni.",

    "terms.reportsAndBlocking.heading": "Prijave i blokiranje korisnika",
    "terms.reportsAndBlocking.body":
        "Korisnici mogu prijaviti turnir, par ili profil koji krši ove uvjete, uz razlog i neobaveznu poruku, te blokirati druge korisnike. Prijave pregledava operater stranice i po potrebi poduzima odgovarajuće mjere, uključujući ukidanje računa iz odjeljka \"Ukidanje računa\".",

    "terms.onlineGame.heading": "Online igra bele",
    "terms.onlineGame.body1":
        "bela-turniri.com nudi i online igru bele, u sklopu koje se rezultati partija i statistika pohranjuju uz vaš račun ili, ako igrate kao gost, uz anonimni identifikator uređaja.",
    "terms.onlineGame.body2":
        "Igra ne uključuje kupnje unutar aplikacije niti igranje za novac ili drugu imovinsku vrijednost — igra se isključivo radi zabave i vođenja statistike.",

    "terms.payments.heading": "Plaćanja",
    "terms.payments.body":
        "Aplikacija ne nudi kupnje unutar aplikacije niti igre za novac. Cjenik pića i računi u sklopu turnira služe isključivo evidenciji potrošnje pića na mjestu održavanja turnira i ne predstavljaju platnu transakciju unutar aplikacije.",

    "terms.ip.heading": "Intelektualno vlasništvo",
    "terms.ip.body":
        "Naziv, logotip, dizajn i izvorni kod stranice bela-turniri.com vlasništvo su operatera stranice ili se koriste uz odgovarajuću dozvolu, te se ne smiju kopirati ili koristiti bez prethodnog pristanka. Sadržaj koji korisnici unesu ostaje u njihovom vlasništvu, uz pravo operatera da ga prikazuje u sklopu usluge.",

    "terms.liability.heading": "Ograničenje odgovornosti",
    "terms.liability.body":
        "Usluga se pruža \"kakva jest\" i \"kako je dostupna\", bez jamstava bilo koje vrste. Operater stranice ne odgovara za štetu nastalu korištenjem ili nemogućnošću korištenja usluge, netočnim podacima koje unesu organizatori, niti za prekide rada uzrokovane vanjskim uslugama (npr. Firebase, OpenStreetMap).",

    "terms.termination.heading": "Ukidanje računa",
    "terms.termination.body":
        "Zadržavamo pravo obustaviti ili ukinuti pristup računu koji krši ove uvjete, bez prethodne najave, posebno u slučaju zlouporabe, unošenja nezakonitog sadržaja ili zlonamjernog prijavljivanja drugih korisnika. Korisnik može sam izbrisati svoj račun putem opcije \"Brisanje računa\" na stranici profila ili zatražiti brisanje putem kontakt obrasca.",

    "terms.governingLaw.heading": "Mjerodavno pravo",
    "terms.governingLaw.body":
        "Na ove uvjete primjenjuje se pravo Republike Hrvatske. Svi eventualni sporovi rješavat će se pred stvarno i mjesno nadležnim sudom u Republici Hrvatskoj.",

    "terms.changes.heading": "Izmjene uvjeta",
    "terms.changes.body":
        "Ove uvjete možemo povremeno izmijeniti. Nastavkom korištenja stranice nakon objave izmjena smatra se da ste s njima suglasni; datum zadnje izmjene naveden je na vrhu stranice.",

    "terms.contact.heading": "Kontakt",
    "terms.contact.body": "Za sva pitanja vezana uz ove uvjete obratite nam se putem kontakt obrasca.",

    // ═════════════════ AccountDeletionPage (/brisanje-racuna) ═════════════════
    // Javna stranica, bez prijave — Google Play traži "web resurs" na kojem se
    // brisanje računa može zatražiti i objasniti bez instalirane aplikacije
    // (support.google.com/googleplay/android-developer/answer/13327111), a
    // Apple traži da put do brisanja bude lako pronaći (5.1.1(v)).
    //
    // `{site}` je naziv proizvoda, a `{origin}` njegova adresa — oba dolaze iz
    // `src/site.ts`, pa isti tekst ispravno glasi i na bela-turniri.com i na
    // bela.games / belot.games. Stavke označene "fullOnly" u
    // `AccountDeletionPage.tsx` ne prikazuju se na igraćim domenama jer tamo
    // turnira nema.
    "deletion.documentTitle": "Brisanje računa — {site}",
    "deletion.documentDescription":
        "Kako obrisati korisnički račun na {site}: koji se podaci brišu, što ostaje i kako zatražiti brisanje bez instalirane aplikacije.",
    "deletion.title": "Brisanje računa",
    "deletion.lastUpdated": "Zadnja izmjena: 20. 9. 2026.",
    "deletion.intro":
        "Na ovoj stranici piše kako obrisati svoj korisnički račun na {site}, koji se podaci pritom brišu, što ostaje i zašto, te kako zatražiti brisanje ako nemaš instaliranu aplikaciju.",

    "deletion.inApp.heading": "Brisanje u aplikaciji",
    "deletion.inApp.intro":
        "Račun možeš obrisati sam, u svakom trenutku i bez da nam pišeš:",
    "deletion.inApp.step1": "Prijavi se u aplikaciju.",
    "deletion.inApp.step2":
        "Otvori svoj profil i odaberi karticu \"Postavke\".",
    "deletion.inApp.step3":
        "Na dnu te kartice nalazi se odjeljak \"Brisanje računa\" — pritisni gumb \"Obriši račun\".",
    "deletion.inApp.step4":
        "U prozoru za potvrdu upiši riječ OBRIŠI i potvrdi. Brisanje se izvršava odmah i ne može se poništiti.",
    "deletion.inApp.apple":
        "Ako se prijavljuješ Apple ID-om, prilikom brisanja te još jednom pitamo za Apple prijavu kako bismo Appleu opozvali pristup aplikacije. Račun tada nestaje i s popisa \"Prijava s Appleom\" u postavkama tvog uređaja.",

    "deletion.noApp.heading": "Brisanje bez aplikacije",
    "deletion.noApp.body1":
        "Isti postupak radi i u običnom web pregledniku, bez ikakve instalacije: otvori {origin}, prijavi se i slijedi korake iznad.",
    "deletion.noApp.linkLabel": "Prijavi se i otvori profil",
    "deletion.noApp.body2":
        "Ako se više ne možeš prijaviti (izgubljen pristup e-pošti ili uređaju), pošalji nam zahtjev putem kontakt obrasca i navedi e-poštu s kojom je račun otvoren. Zahtjev rješavamo najkasnije u roku od 30 dana; prije brisanja možemo zatražiti potvrdu da je račun doista tvoj.",
    "deletion.noApp.contactLabel": "Zatraži brisanje putem kontakt obrasca",

    "deletion.deleted.heading": "Što se briše",
    "deletion.deleted.item.profile":
        "Podaci profila — prikazano ime, broj telefona i država, profilna fotografija (uključujući datoteku na poslužitelju), odabrani avatar, jezik i tema sučelja.",
    "deletion.deleted.item.auth":
        "Prijava — korisnik u usluzi Firebase Authentication, dakle e-pošta i lozinka odnosno povezani Google ili Apple račun. Kod Apple prijave dodatno opozivamo pristupni token kod Applea.",
    "deletion.deleted.item.gameName":
        "Ime za igru — ime koje se prikazuje za stolom u online beli.",
    "deletion.deleted.item.push":
        "Push obavijesti — sve pretplate preglednika i tokeni uređaja, pa obavijesti odmah prestaju.",
    "deletion.deleted.item.blok":
        "Blok bilježnica — spremljena povijest rezultata, i na poslužitelju i lokalno na uređaju s kojeg brišeš.",
    "deletion.deleted.item.blocks":
        "Blokirani korisnici — popis se briše u oba smjera.",
    "deletion.deleted.item.reliability":
        "Karma i zapisi o napuštanju partija u online beli.",
    "deletion.deleted.item.pairPhone":
        "Kontakt broj telefona na svim parovima koje si prijavio.",
    "deletion.deleted.item.pairRequests":
        "Oglasi \"tražim para\" koje si objavio, zajedno s imenom i kontakt brojem u njima.",
    "deletion.deleted.item.presets":
        "Spremljeni parovi i spremljeni predlošci cjenika. Spremljeni par koji dijeliš sa suvlasnikom prelazi njemu, jer je i on upisao pola tog imena.",
    "deletion.deleted.item.device":
        "Podaci na uređaju s kojeg brišeš — predmemorija podataka, red čekanja za rad bez mreže i spremljene konobarske sesije.",

    "deletion.kept.heading": "Što ostaje i zašto",
    "deletion.kept.intro":
        "Brisanje je anonimizacija: osoba nestaje, a zajednička povijest igre ostaje netaknuta. Nakon brisanja tvoje se ime nigdje više ne prikazuje — umjesto njega piše \"Obrisani korisnik\".",
    "deletion.kept.item.uid":
        "Prazan zapis računa s nasumičnim identifikatorom i adresom profila (slug). Zadržava se trajno: to je jedini način da stare poveznice na tvoj profil daju uredno \"stranica ne postoji\" umjesto da tu adresu naslijedi netko drugi čije se ime jednako piše.",
    "deletion.kept.item.tournaments":
        "Turniri koje si organizirao i parovi koje si prijavio — bez tvog imena i broja telefona. Rezultati drugih igrača ne smiju se promijeniti zato što si ti otišao.",
    "deletion.kept.item.gameResults":
        "Rezultati odigranih partija online bele, vezani uz onaj prazni identifikator. Za stolom su četiri igrača i njihova statistika ne smije se promijeniti.",
    "deletion.kept.item.reports":
        "Prijave sadržaja — čuvaju se dok se ne riješe, jer je to upravo onaj zapis koji ne smije nestati kada prijavljena strana obriše račun.",
    "deletion.kept.item.contact":
        "Poruke poslane putem kontakt obrasca — IP adresu brišemo najkasnije 30 dana od zaprimanja, a cijelu poruku najkasnije 12 mjeseci od zaprimanja.",
    "deletion.kept.item.logs":
        "Zapisi poslužitelja (IP adresa i identifikator zahtjeva) — kratkoročno, radi sigurnosti i otklanjanja poteškoća.",
    "deletion.kept.item.guest":
        "Gostujući identitet, ako si uz račun igrao i kao gost. On je zaseban i nije dio računa koji brišeš, pa ostaje na uređaju; ukloniš ga brisanjem podataka stranice odnosno deinstalacijom aplikacije.",

    "deletion.timing.heading": "Kada se brisanje izvršava",
    "deletion.timing.body":
        "Brisanje pokrenuto u aplikaciji izvršava se odmah, unutar istog zahtjeva — nema razdoblja čekanja i nema mogućnosti povrata. Sigurnosne kopije baze čuvaju se najviše 14 dana i u tom se roku automatski prepisuju, pa obrisani podaci nestaju i iz njih.",

    "deletion.more.heading": "Više informacija",
    "deletion.more.body":
        "Potpuni popis podataka koje prikupljamo, svrhe i pravne osnove obrade te tvoja prava opisani su u pravilima privatnosti.",
    "deletion.more.privacyLabel": "Pravila privatnosti",

    // ═══════════════════════ RulesPage (/pravila) ═══════════════════════
    // Presjek triju turnirskih pravilnika (Stefanje 2025., Prvenstvo Hrvatske
    // 2026., Prvomajski turnir Vrbovec 2026.); gdje su si proturječili,
    // odlučio je vlasnik (2026-09-29): kolo 70 min, novu partiju dijeli
    // sljedeći po redu, kazna je igra sa zvanjem, 4 desetke jače od 4
    // dame/kralja, neslužbeni naziv aduta = upozorenje, zvanje se najavljuje
    // samo po redu, dva kriva dijeljenja za redom = 162.
    "rules.documentTitle": "Pravila bele — bela-turniri.com",
    "rules.documentDescription": "Ujednačena pravila bele za turnire: igra do 1001, dijeljenje, zvanja, prekršaji i kazne, trajanje kola i ponašanje za stolom.",
    "rules.printNotice": "Uplatom kotizacije svaki igrač potvrđuje ova pravila.",
    "rules.edit": "Uredi",
    "rules.print": "Ispis",
    "rules.download": "Preuzmi",
    "rules.downloading": "Pripremam PDF…",
    "rules.downloadFailed": "PDF nije moguće izraditi",
    "rules.downloaded": "PDF je preuzet",
    "rules.tournament.title": "Pravila turnira",
    "rules.tournament.intro": "Pravila koja vrijede na ovom turniru. Organizator je mogao izmijeniti opća pravila bele.",
    "rules.decl.off": "Na ovom turniru zvanja ne vrijede.",
    "rules.decl.belaOnly": "Na ovom turniru vrijedi samo bela (20 bodova).",
    "rules.title": "Pravila bele",
    "rules.intro": "Ujednačena pravila za turnire u beli, složena iz pravilnika više hrvatskih turnira. Organizator može odrediti drukčije: tada vrijede pravila tog turnira.",
    "rules.glance.target": "Partija do",
    "rules.glance.targetValue": "1001",
    "rules.glance.match": "Meč",
    "rules.glance.matchValue.one": "{n} dobivena",
    "rules.glance.matchValue.two": "{n} dobivene",
    "rules.glance.matchValue.few": "{n} dobivene",
    "rules.glance.matchValue.other": "{n} dobivenih",
    "rules.glance.end": "Igra se na",
    "rules.glance.endProlaz": "Prolaz",
    "rules.glance.endDosta": "Dosta",
    "rules.glance.declarations": "Zvanja",
    "rules.glance.declarationsYes": "Vrijede",
    "rules.glance.declarationsNo": "Bez zvanja",
    "rules.glance.bela": "Bela",
    "rules.glance.belaYes": "Da",
    "rules.glance.belaNo": "Ne",
    "rules.glance.round": "Kolo",
    "rules.glance.roundValue": "{minutes} min",
    "rules.glance.direction": "Dijeljenje",
    "rules.glance.directionValue": "Ulijevo",
    "rules.glance.directionValueRight": "Udesno",
    "rules.game.heading": "Igra i bodovanje",
    "rules.game.1": "Partija se igra do {target}, na prolaz: dijeljenje se uvijek odigra do kraja, svih osam štihova, pa se tek onda zbraja.",
    "rules.game.1.dosta": "Partija se igra do {target}, na dosta: partija je gotova čim neki par dosegne ili prijeđe {target}.",
    "rules.game.2.dosta": "Par koji prvi dosegne ili prijeđe {target} pobjeđuje u partiji.",
    "rules.game.2": "Ako oba para prijeđu {target}, pobjeđuje par s više bodova. Ako imaju jednako, igra se još jedno dijeljenje, po redu.",
    "rules.game.3": "Meč se igra na {games}.",
    "rules.matchGames.one": "{n} dobivenu partiju",
    "rules.matchGames.two": "{n} dobivene partije",
    "rules.matchGames.few": "{n} dobivene partije",
    "rules.matchGames.other": "{n} dobivenih partija",
    "rules.game.4": "Zadnji igrač na redu obavezan je zvati aduta (mus).",
    "rules.game.5": "Kod jednakog broja bodova (81:81) par koji je zvao aduta pada: igra se piše protivniku.",
    "rules.game.6": "Štihovi se igraju do kraja i svaki se uzima sa stola. Gledanje odigranih štihova nije dozvoljeno.",
    "rules.deal.heading": "Dijeljenje karata",
    "rules.deal.1": "Prvog djelitelja određuje dizanje karata: dijeli par koji je digao veću kartu.",
    "rules.deal.2": "Karte se dijele ulijevo, u smjeru kazaljke na satu: svakom igraču po tri karte u dva kruga, a po dvije karte ostaju u talonu.",
    "rules.deal.2.right": "Karte se dijele udesno, suprotno od smjera kazaljke na satu: svakom igraču po tri karte u dva kruga, a po dvije karte ostaju u talonu.",
    "rules.deal.3": "Novu partiju dijeli sljedeći igrač po redu nakon onoga koji je prvi dijelio u prethodnoj.",
    "rules.deal.3.winner": "Novu partiju dijeli par koji je pobijedio u prethodnoj.",
    "rules.deal.4": "Karte se podižu tek kad su sve podijeljene, i to tek kad igrač dođe na red za zvanje aduta.",
    "rules.deal.5": "Igrač koji kaže „dalje” spušta karte na stol. Karte se ne preslaguju i talon se ne gleda dok adut nije pozvan.",
    "rules.deal.6": "Krivo dijeljenje nije kazna, nego ponovno miješanje. Ako isti igrač pogriješi dva puta za redom, protivniku se piše 162.",
    "rules.trump.heading": "Zvanje aduta",
    "rules.trump.1": "Adut se najavljuje službenim nazivom boje. Tko ga najavi drukčije, dobiva upozorenje.",
    "rules.trump.suit.herc": "Herc / Srce",
    "rules.trump.suit.karo": "Kara / Bundeva",
    "rules.trump.suit.pik": "Pik / Zelje",
    "rules.trump.suit.tref": "Tref / Žir",
    "rules.decl.heading": "Zvanja",
    "rules.decl.table.what": "Zvanje",
    "rules.decl.table.points": "Bodovi",
    "rules.decl.v.seq3": "Tri karte u nizu",
    "rules.decl.v.seq4": "Četiri karte u nizu",
    "rules.decl.v.seq5": "Pet ili više karata u nizu",
    "rules.decl.v.four100": "Četiri desetke, dame, kralja ili asa",
    "rules.decl.v.four9": "Četiri devetke",
    "rules.decl.v.fourJ": "Četiri dečka",
    "rules.decl.v.bela": "Bela (kralj i dama aduta)",
    "rules.decl.v.belot": "Belot (osam karata u nizu)",
    "rules.decl.v.belotValue": "Partija",
    "rules.decl.1": "Četiri sedmice i četiri osmice nisu zvanje.",
    "rules.decl.2": "Četiri iste karte jače su od niza od pet karata. Četiri desetke jače su od četiri dame ili četiri kralja.",
    "rules.decl.3": "Vezano zvanje vrijedi. Belot vrijedi u svakoj boji i donosi cijelu partiju.",
    "rules.decl.4": "Igrač koji prvi igra pita ima li tko zvanje. Igrači se javljaju po redu i govore samo visinu: 20, 50, 100, 150 ili 200.",
    "rules.decl.5": "Ako više igrača ima istu visinu, po redu govore do koje karte im zvanje ide. Igrač sa slabijim zvanjem to ne govori.",
    "rules.decl.6": "Četiri iste karte vrijedne 100 najavljuju se kao „100”, bez govorenja koje su to karte.",
    "rules.decl.7": "Vrijedi samo prvo najavljeno zvanje: nema naknadne prijave većeg. Zvanje pokazuje igrač s najjačim zvanjem, po mogućnosti složeno po skali.",
    "rules.decl.8": "Belu je obavezno najaviti riječju „bela”. Reći „od bele” uz drugu kartu nije obavezno.",
    "rules.foul.heading": "Prekršaji i kazne",
    "rules.foul.intro": "„Pisanje partije” znači da se protivniku upisuju svi bodovi tog dijeljenja (162) i sva zvanja. Partija se nastavlja.",
    "rules.foul.table.what": "Prekršaj",
    "rules.foul.table.penalty": "Kazna",
    "rules.foul.penalty.deal": "Pisanje partije",
    "rules.foul.penalty.warningDeal": "Upozorenje, zatim pisanje partije",
    "rules.foul.penalty.warning": "Upozorenje",
    "rules.foul.penalty.redeal": "Ponovno miješanje",
    "rules.foul.penalty.162": "162 protivniku",
    "rules.foul.penalty.expel": "Izbacivanje s turnira",
    "rules.foul.d.1": "Nepoštivanje boje ili ibera",
    "rules.foul.d.2": "Igranje prije reda",
    "rules.foul.d.3": "Pokazana karta ili karta koja ispadne licem prema gore",
    "rules.foul.d.4": "Gledanje ili dizanje talona prije reda",
    "rules.foul.d.5": "Dizanje karata prije reda",
    "rules.foul.d.6": "„Dalje” na musu, kad je igrač obavezan zvati",
    "rules.foul.d.7": "Bacanje karata na stol prije kraja dijeljenja",
    "rules.foul.d.8": "Pokazivanje zvanja koje nije najavljeno",
    "rules.foul.d.9": "Najava zvanja preko reda uz kartu do koje ide",
    "rules.foul.d.10": "Učestalo sumnjivo preslagivanje karata",
    "rules.foul.w.1": "Najava zvanja preko reda, bez visine",
    "rules.foul.w.2": "Neslužbeni naziv aduta",
    "rules.foul.r.1": "Krivo dijeljenje",
    "rules.foul.r.2": "Krivo dijeljenje dva puta za redom",
    "rules.tour.heading": "Tijek turnira",
    "rules.tour.1": "Jedno kolo traje najviše {minutes} minuta. Parovi sjedaju za stol i počinju tek kad organizator da znak.",
    "rules.tour.2": "Organizator najavljuje zadnje dijeljenje. Dijeljenje koje je već podijeljeno igra se do kraja, bez obzira na istek vremena.",
    "rules.tour.3": "Po isteku vremena prvo se gledaju dobivene partije. Kod 1:1 pobjeđuje par koji ima više bodova u trećoj partiji.",
    "rules.tour.4": "Odugovlačenje igre, miješanja ili dijeljenja prvo se upozorava, a zatim kažnjava diskvalifikacijom bez povrata uloga.",
    "rules.tour.5": "Parovi se za svako kolo izvlače nasumično. Isti par može biti slobodan najviše jedno kolo.",
    "rules.tour.6": "Nakon meča oba para zajedno dolaze do zapisničkog stola, a pobjednik prijavljuje rezultat.",
    "rules.conduct.heading": "Ponašanje za stolom",
    "rules.conduct.1": "Svađa i galama nisu dozvoljene: prvo opomena, a zatim izbacivanje s turnira bez povrata uloga.",
    "rules.conduct.2": "Svako dogovaranje i varanje kažnjava se izbacivanjem s turnira.",
    "rules.conduct.3": "Kibiceri ne smiju komentirati igru niti razgovarati s igračima.",
}

/** Contract every other locale's `legal` namespace must satisfy. */
export type LegalDict = typeof legal
