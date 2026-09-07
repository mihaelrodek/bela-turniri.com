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
    "privacy.lastUpdated": "Zadnja izmjena: 4. 9. 2026.",
    "privacy.intro":
        "Ovaj dokument opisuje koje osobne podatke prikupljamo putem stranice bela-turniri.com, u koje svrhe ih obrađujemo i koja prava imate u vezi s njima.",

    "privacy.controller.heading": "Voditelj obrade",
    "privacy.controller.body":
        "Voditelj obrade osobnih podataka prikupljenih putem ove stranice je vlasnik stranice bela-turniri.com. Za sva pitanja, zahtjeve ili pritužbe vezane uz obradu osobnih podataka obratite nam se putem kontakt obrasca.",

    "privacy.dataCollected.heading": "Koje podatke prikupljamo",
    "privacy.dataCollected.intro":
        "U sklopu rada stranice prikupljamo i obrađujemo sljedeće kategorije podataka:",
    "privacy.dataCollected.item.account":
        "Podaci o računu — putem usluge Firebase Authentication prijavljujete se e-poštom i lozinkom ili Google računom; pohranjujemo vašu e-poštu, ime i jedinstveni identifikator korisnika (UID).",
    "privacy.dataCollected.item.profile":
        "Podaci profila — javno prikazano ime, adresa profila (slug), profilna slika (avatar), odabrani jezik i tema sučelja.",
    "privacy.dataCollected.item.tournament":
        "Podaci o turnirima — nazivi parova, ime i telefon kontakt osobe organizatora te lokacija turnira, koju geokodiramo putem javne usluge OpenStreetMap Nominatim kako bismo je prikazali na karti.",
    "privacy.dataCollected.item.media":
        "Fotografije i plakati — plakati turnira i profilne slike pohranjuju se na poslužitelju za pohranu objekata (MinIO) na infrastrukturi operatera stranice.",
    "privacy.dataCollected.item.push":
        "Push obavijesti — ako odobrite primanje obavijesti, na poslužitelju pohranjujemo tehničku adresu (endpoint) vaše pretplate radi slanja obavijesti o turnirima.",
    "privacy.dataCollected.item.game":
        "Podaci o igri — pristupni kodovi konobara, računi za pića i rezultati susreta koje organizatori i konobari unose tijekom turnira.",
    "privacy.dataCollected.item.analytics":
        "Analitika — Google Analytics 4 koristimo isključivo nakon što date privolu putem trake za privolu.",
    "privacy.dataCollected.item.logs":
        "Zapisi poslužitelja — poslužitelj bilježi IP adresu i identifikator zahtjeva (request ID) radi sigurnosti i otklanjanja poteškoća.",
    "privacy.dataCollected.item.device":
        "Podaci na uređaju — lokalna pohrana (localStorage) i predmemorija za rad izvan mreže čuvaju se isključivo na vašem uređaju.",

    "privacy.purpose.heading": "Svrha i pravna osnova obrade",
    "privacy.purpose.body1":
        "Podatke obrađujemo radi izvršavanja usluge koju ste zatražili (izvršenje ugovora) — prijava, organizacija i praćenje Bela turnira, prijava parova, praćenje rezultata i računa za pića.",
    "privacy.purpose.body2":
        "Push obavijesti i analitika obrađuju se na temelju vaše privole, koju možete povući u bilo kojem trenutku.",
    "privacy.purpose.body3":
        "Zapisi poslužitelja i mjere sigurnosti temelje se na našem legitimnom interesu za sigurnost i stabilan rad stranice.",

    "privacy.recipients.heading": "Tko ima pristup podacima",
    "privacy.recipients.body1":
        "Za autentifikaciju koristimo Firebase Authentication (Google Ireland Ltd. / Google LLC), koji podatke o prijavi obrađuje u skladu sa svojim pravilima privatnosti.",
    "privacy.recipients.body2":
        "Za geokodiranje lokacija koristimo javnu uslugu OpenStreetMap Nominatim, kojoj šaljemo isključivo unesenu adresu, bez osobnih podataka.",
    "privacy.recipients.body3":
        "Stranica se nalazi na poslužitelju kojim upravlja operater stranice; podaci se ne prodaju niti ustupaju trećim stranama u marketinške svrhe.",
    "privacy.recipients.body4":
        "Javne stranice turnira i profila igrača dostupne su svima na internetu i mogu ih indeksirati tražilice (npr. Google) — objavljujte samo podatke koje ste spremni učiniti javnima.",

    "privacy.retention.heading": "Koliko dugo čuvamo podatke",
    "privacy.retention.body":
        "Podatke čuvamo dok god je vaš račun aktivan ili dok postoji legitimna svrha za njihovo čuvanje (npr. povijest turnira). Nakon brisanja računa ili na vaš zahtjev, osobne podatke brišemo ili anonimiziramo u razumnom roku, osim ako je dulje čuvanje propisano zakonom.",

    "privacy.rights.heading": "Vaša prava",
    "privacy.rights.body1":
        "Imate pravo na pristup, ispravak i brisanje svojih osobnih podataka, kao i na ograničenje obrade, prigovor na obradu te na prenosivost podataka.",
    "privacy.rights.body2":
        "Većinu podataka možete sami pregledati i izmijeniti u postavkama profila. Za brisanje računa ili druge zahtjeve obratite nam se putem kontakt obrasca.",
    "privacy.rights.body3":
        "Ako smatrate da se vaši podaci obrađuju suprotno propisima, imate pravo podnijeti pritužbu nadležnom nadzornom tijelu za zaštitu osobnih podataka.",

    "privacy.cookies.heading": "Kolačići i lokalna pohrana",
    "privacy.cookies.body1":
        "Stranica koristi lokalnu pohranu preglednika (localStorage) za pamćenje postavki (jezik, tema) i predmemoriju podataka radi bržeg rada i djelomičnog rada bez internetske veze.",
    "privacy.cookies.body2":
        "Analitičke kolačiće (Google Analytics 4) postavljamo tek nakon što date privolu putem trake za privolu; svoj izbor možete promijeniti u bilo kojem trenutku.",

    "privacy.children.heading": "Djeca",
    "privacy.children.body":
        "Usluga nije namijenjena osobama mlađima od 16 godina. Ako ste mlađi od 16 godina, stranicu smijete koristiti isključivo uz privolu i nadzor roditelja ili skrbnika.",

    "privacy.changes.heading": "Izmjene pravila privatnosti",
    "privacy.changes.body":
        "Ova pravila privatnosti možemo povremeno ažurirati. O značajnijim izmjenama obavijestit ćemo korisnike na ovoj stranici; datum zadnje izmjene naveden je na vrhu stranice.",

    // ═══════════════════════ TermsPage (/uvjeti) ═══════════════════════
    "terms.documentTitle": "Uvjeti korištenja — bela-turniri.com",
    "terms.documentDescription": "Uvjeti korištenja stranice bela-turniri.com.",
    "terms.title": "Uvjeti korištenja",
    "terms.lastUpdated": "Zadnja izmjena: 4. 9. 2026.",
    "terms.intro":
        "Korištenjem stranice bela-turniri.com prihvaćate ove uvjete korištenja. Ako se s njima ne slažete, molimo da stranicu ne koristite.",

    "terms.service.heading": "Opis usluge",
    "terms.service.body":
        "bela-turniri.com je besplatna internetska platforma za organizaciju turnira u beli (bela): prijavu i pregled turnira, prijavu parova, izvlačenje rundi, unos rezultata, obračun pića i javne profile igrača.",

    "terms.accounts.heading": "Računi",
    "terms.accounts.body1":
        "Za pojedine radnje (npr. kreiranje turnira, prijavu para) potreban je korisnički račun putem Firebase prijave (e-pošta i lozinka ili Google račun).",
    "terms.accounts.body2":
        "Odgovorni ste za točnost podataka koje unesete i za čuvanje pristupnih podataka svog računa.",

    "terms.organiserContent.heading": "Sadržaj koji unose organizatori",
    "terms.organiserContent.body1":
        "Organizatori turnira samostalno unose podatke o turniru, parovima, kontakt osobama i lokaciji te snose punu odgovornost za točnost, zakonitost i ažurnost tih podataka.",
    "terms.organiserContent.body2":
        "Ako organizator unosi osobne podatke trećih osoba (npr. imena i telefonske brojeve igrača ili kontakt osoba), dužan je za to prethodno pribaviti njihov pristanak i obavijestiti ih o obradi tih podataka u skladu s propisima o zaštiti osobnih podataka.",

    "terms.prohibitedConduct.heading": "Zabranjeno ponašanje",
    "terms.prohibitedConduct.body":
        "Zabranjeno je: unositi netočne, uvredljive ili nezakonite sadržaje; zloupotrebljavati funkcionalnosti stranice (npr. automatizirano slanje zahtjeva, zaobilaženje sigurnosnih mjera); neovlašteno pristupati tuđim računima ili podacima; te koristiti stranicu u svrhe suprotne njezinoj namjeni.",

    "terms.ip.heading": "Intelektualno vlasništvo",
    "terms.ip.body":
        "Naziv, logotip, dizajn i izvorni kod stranice bela-turniri.com vlasništvo su operatera stranice ili se koriste uz odgovarajuću dozvolu, te se ne smiju kopirati ili koristiti bez prethodnog pristanka. Sadržaj koji korisnici unesu ostaje u njihovom vlasništvu, uz pravo operatera da ga prikazuje u sklopu usluge.",

    "terms.liability.heading": "Ograničenje odgovornosti",
    "terms.liability.body":
        "Usluga se pruža \"kakva jest\" i \"kako je dostupna\", bez jamstava bilo koje vrste. Operater stranice ne odgovara za štetu nastalu korištenjem ili nemogućnošću korištenja usluge, netočnim podacima koje unesu organizatori, niti za prekide rada uzrokovane vanjskim uslugama (npr. Firebase, OpenStreetMap).",

    "terms.termination.heading": "Ukidanje računa",
    "terms.termination.body":
        "Zadržavamo pravo obustaviti ili ukinuti pristup računu koji krši ove uvjete, bez prethodne najave, posebno u slučaju zlouporabe ili unošenja nezakonitog sadržaja. Korisnik može zatražiti brisanje svog računa putem kontakt obrasca.",

    "terms.governingLaw.heading": "Mjerodavno pravo",
    "terms.governingLaw.body":
        "Na ove uvjete primjenjuje se pravo Republike Hrvatske. Svi eventualni sporovi rješavat će se pred stvarno i mjesno nadležnim sudom u Republici Hrvatskoj.",

    "terms.changes.heading": "Izmjene uvjeta",
    "terms.changes.body":
        "Ove uvjete možemo povremeno izmijeniti. Nastavkom korištenja stranice nakon objave izmjena smatra se da ste s njima suglasni; datum zadnje izmjene naveden je na vrhu stranice.",

    "terms.contact.heading": "Kontakt",
    "terms.contact.body": "Za sva pitanja vezana uz ove uvjete obratite nam se putem kontakt obrasca.",
}

/** Contract every other locale's `legal` namespace must satisfy. */
export type LegalDict = typeof legal
