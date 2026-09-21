import type { LegalDict } from "../hr/legal"

/* Slovenian `legal`. Typed as the Croatian namespace, so a dropped or
   misspelled key fails `tsc` instead of silently falling back at runtime.
   Full translation of the Privacy/Terms prose — not a stub — reviewed for
   sense against the Croatian source paragraph by paragraph. Should still
   get a native-speaker legal review before being treated as final. */

export const legal: LegalDict = {
    // ═══════════════════════ PrivacyPage (/privatnost) ═══════════════════════
    "privacy.documentTitle": "Pravilnik o zasebnosti — bela-turniri.com",
    "privacy.documentDescription":
        "Pravilnik o zasebnosti strani bela-turniri.com: katere podatke zbiramo, zakaj jih obdelujemo in katere pravice imate.",
    "privacy.title": "Pravilnik o zasebnosti",
    "privacy.lastUpdated": "Zadnja sprememba: 13. 9. 2026.",
    "privacy.intro":
        "Ta dokument opisuje, katere osebne podatke zbiramo prek strani bela-turniri.com in naših mobilnih aplikacij, za katere namene jih obdelujemo in katere pravice imate v zvezi z njimi.",

    "privacy.controller.heading": "Upravljavec podatkov",
    "privacy.controller.body":
        "Upravljavec osebnih podatkov, zbranih prek te strani, je lastnik strani bela-turniri.com. Za vsa vprašanja, zahteve ali pritožbe v zvezi z obdelavo osebnih podatkov nas kontaktirajte prek kontaktnega obrazca.",

    "privacy.dataCollected.heading": "Katere podatke zbiramo",
    "privacy.dataCollected.intro":
        "V okviru delovanja strani in mobilnih aplikacij zbiramo in obdelujemo naslednje kategorije podatkov:",
    "privacy.dataCollected.item.account":
        "Podatki o računu — prek storitve Firebase Authentication se prijavite z e-pošto in geslom, z računom Google ali (na napravah iOS) z Apple ID-jem; shranjujemo vaš e-naslov, ime in enolični identifikator uporabnika (UID).",
    "privacy.dataCollected.item.profile":
        "Podatki profila — javno prikazano ime, spletni naslov profila (slug), neobvezna telefonska številka in država, neobvezna profilna fotografija (shranjena na lastnem strežniku za shranjevanje datotek (MinIO), ne pri tretji osebi), neobvezen izbran risan avatar, uporabniško ime za online belo, izbrani jezik in tema vmesnika.",
    "privacy.dataCollected.item.tournament":
        "Podatki o turnirjih — naziv turnirja, plakat, lokacija in cenik, ki jih vnese organizator, ter imena parov. Anonimna prijava para (brez prijave v račun) zbere tudi kontaktno telefonsko številko, ki je vidna izključno organizatorju turnirja, ter ustvari enolično povezavo za prevzem (claim link) tega para.",
    "privacy.dataCollected.item.media":
        "Fotografije in plakati — plakati turnirjev in profilne slike so shranjeni na strežniku za shranjevanje datotek (MinIO) v infrastrukturi upravljavca strani.",
    "privacy.dataCollected.item.location":
        "Lokacija naprave — funkcija \"turnirji v bližini\" na vašo zahtevo pridobi okvirno (mestno) lokacijo vaše naprave in jo uporabi izključno lokalno, na napravi, za razvrščanje in filtriranje seznama turnirjev; ta lokacija se nikoli ne pošlje na naš strežnik.",
    "privacy.dataCollected.item.addressSearch":
        "Iskanje naslova — ko organizator vnese naslov turnirja, se vneseno besedilo naslova pošlje ponudniku storitve iskanja naslovov: Google Places (kadar ga upravljavec omogoči) ali javni storitvi OpenStreetMap Nominatim.",
    "privacy.dataCollected.item.mapTiles":
        "Zemljevid — sličice zemljevida (map tiles) se pridobivajo od storitev CARTO ali OpenFreeMap; vsaka taka zahteva tema storitvama razkrije približno prikazano območje zemljevida in vaš naslov IP.",
    "privacy.dataCollected.item.push":
        "Potisna obvestila — če dovolite prejemanje obvestil, shranimo tehnično naročnino: naslov (endpoint) naročnine Web Push v brskalniku oziroma žeton naprave storitve Firebase Cloud Messaging (FCM) v mobilnih aplikacijah, med online igro pa tudi žeton za Live Activity (iOS) oziroma Android Live Update. Žeton izbrišemo, ko izklopite obvestila, ko strežnik pošiljatelja sporoči, da žeton ni več veljaven, ali ob izbrisu računa.",
    "privacy.dataCollected.item.game":
        "Podatki o igri — dostopne kode natakarjev, računi za pijačo in rezultati srečanj, ki jih med turnirjem vnašajo organizatorji in natakarji.",
    "privacy.dataCollected.item.onlineGame":
        "Online bela — če igrate online belo, se rezultati partij in statistika shranjujejo skupaj z vašim računom. Če igrate kot gost, se dodeli anonimni identifikator, ki se shrani lokalno v brskalniku, na napravah iOS pa v sistemu Keychain, da identifikator preživi ponovno namestitev aplikacije. Ime, ki ga uporabljate v igri, lahko spremenite največ enkrat na 7 dni.",
    "privacy.dataCollected.item.analytics":
        "Analitika — orodje Google Analytics 4 uporabljamo izključno na spletni strani bela-turniri.com, in sicer šele po vaši privolitvi prek pasice za soglasje; analitike ne uporabljamo v mobilnih aplikacijah.",
    "privacy.dataCollected.item.logs":
        "Dnevniki strežnika — strežnik beleži naslov IP in identifikator zahteve (request ID) zaradi varnosti in odpravljanja težav.",
    "privacy.dataCollected.item.device":
        "Podatki na napravi — lokalna shramba (localStorage) in predpomnilnik za delovanje brez povezave se hranita izključno na vaši napravi.",
    "privacy.dataCollected.item.contactForm":
        "Kontaktni obrazec — ime, e-pošta, zadeva, sporočilo in vaš naslov IP. Naslov IP izbrišemo najpozneje 30 dni od prejema sporočila, celotno sporočilo pa najpozneje 12 mesecev od prejema.",
    "privacy.dataCollected.item.reports":
        "Prijave in blokade — ko prijavite turnir, par ali profil, shranimo razlog prijave, vaše neobvezno sporočilo ter identifikator vašega računa kot vložnika prijave, dokler prijava ni rešena. Blokada drugega uporabnika se shrani skupaj z vašim računom zaradi uveljavljanja blokade; prijave pregleduje upravljavec strani.",

    "privacy.purpose.heading": "Namen in pravna podlaga obdelave",
    "privacy.purpose.body1":
        "Podatke obdelujemo za izvajanje storitve, ki ste jo zahtevali (izvajanje pogodbe) — prijavo, organizacijo in spremljanje turnirjev v beli, prijavo parov, spremljanje rezultatov in računov za pijačo ter igranje online bele.",
    "privacy.purpose.body2":
        "Potisna obvestila in analitika se obdelujejo na podlagi vaše privolitve, ki jo lahko kadar koli prekličete.",
    "privacy.purpose.body3":
        "Dnevniki strežnika in varnostni ukrepi temeljijo na našem zakonitem interesu za varnost in stabilno delovanje strani.",
    "privacy.purpose.body4":
        "Obdelavo prijav in blokad uporabnikov utemeljujemo na našem zakonitem interesu za varnost skupnosti in preprečevanje zlorab.",

    "privacy.recipients.heading": "Kdo ima dostop do podatkov",
    "privacy.recipients.body1":
        "Za avtentikacijo uporabljamo Firebase Authentication (Google Ireland Ltd. / Google LLC) ter, na napravah iOS, Apple Sign in (Apple Inc.); ta ponudnika podatke o prijavi obdelujeta v skladu s svojima pravilnikoma o zasebnosti.",
    "privacy.recipients.body2":
        "Za iskanje in geokodiranje naslovov glede na nastavitve uporabljamo Google Places (Google Ireland Ltd. / Google LLC) ali javno storitev OpenStreetMap Nominatim; tema storitvama pošljemo izključno vneseno besedilo naslova, brez drugih osebnih podatkov.",
    "privacy.recipients.body3":
        "Za prikaz zemljevida uporabljamo ponudnika sličic zemljevida CARTO ali OpenFreeMap, ki jima ob vsakem prikazu zemljevida razkrijemo vaš naslov IP in približno prikazano območje.",
    "privacy.recipients.body4":
        "Za pošiljanje potisnih obvestil uporabljamo standardne storitve brskalnika (Web Push), Firebase Cloud Messaging (Google) ter, za iOS Live Activity in Android Live Update, ustrezne sisteme proizvajalca naprave oziroma operacijskega sistema.",
    "privacy.recipients.body5":
        "Stran gostuje na strežniku, ki ga upravlja upravljavec strani; podatkov ne prodajamo niti jih ne posredujemo tretjim osebam v trženjske namene.",
    "privacy.recipients.body6":
        "Javne strani turnirjev in profilov igralcev so dostopne vsem na internetu in jih lahko indeksirajo iskalniki (npr. Google) — objavite le podatke, ki jih želite narediti javne.",

    "privacy.retention.heading": "Kako dolgo hranimo podatke",
    "privacy.retention.body":
        "Podatke hranimo, dokler je vaš račun aktiven oziroma dokler obstaja upravičen namen za njihovo hrambo (npr. zgodovina turnirjev). Po izbrisu računa ali na vašo zahtevo osebne podatke izbrišemo ali anonimiziramo v razumnem roku, razen če daljšo hrambo zahteva zakon.",
    "privacy.retention.body2":
        "Izjeme z natančno določenimi roki: naslov IP s kontaktnega obrazca izbrišemo najpozneje 30 dni od prejema sporočila, celotno sporočilo pa najpozneje 12 mesecev od prejema; prijave uporabnikov hranimo, dokler niso rešene.",

    "privacy.accountDeletion.heading": "Brisanje računa",
    "privacy.accountDeletion.body1":
        "Brisanje računa lahko kadar koli sprožite sami, na strani profila prek možnosti \"Brisanje računa\".",
    "privacy.accountDeletion.body2":
        "Brisanje je anonimizacija: odstranimo podatke profila, fotografijo, telefonsko številko, nastavitve, shranjeno zgodovino Blok beležke rezultatov in potisne naročnine, vaš račun Firebase pa se izbriše.",
    "privacy.accountDeletion.body3":
        "Turnirji, ki ste jih organizirali, in rezultati, pri katerih so sodelovali drugi igralci, se ohranijo, z oznako \"Izbrisani uporabnik\" namesto vašega imena — ker morajo podatki in zgodovina turnirjev drugih igralcev ostati nedotaknjeni.",

    "privacy.accountDeletion.pageLink": "Podrobna navodila in seznam podatkov: Izbris računa",

    "privacy.rights.heading": "Vaše pravice",
    "privacy.rights.body1":
        "Imate pravico do dostopa, popravka in izbrisa svojih osebnih podatkov, kot tudi do omejitve obdelave, ugovora nanjo in prenosljivosti podatkov.",
    "privacy.rights.body2":
        "Večino podatkov lahko sami pregledate in spremenite v nastavitvah profila, račun pa izbrišete prek možnosti \"Brisanje računa\" na strani profila. Za druge zahteve nas kontaktirajte prek kontaktnega obrazca.",
    "privacy.rights.body3":
        "Če menite, da obdelava vaših podatkov ni skladna s predpisi, imate pravico vložiti pritožbo pri pristojnem nadzornem organu za varstvo osebnih podatkov.",

    "privacy.cookies.heading": "Piškotki in lokalna shramba",
    "privacy.cookies.body1":
        "Stran uporablja lokalno shrambo brskalnika (localStorage) za pomnjenje nastavitev (jezik, tema) in predpomnjenje podatkov zaradi hitrejšega delovanja ter delnega delovanja brez internetne povezave.",
    "privacy.cookies.body2":
        "Analitične piškotke (Google Analytics 4) namestimo izključno na spletni strani, šele po vaši privolitvi prek pasice za soglasje; svojo izbiro lahko kadar koli spremenite. Mobilne aplikacije ne uporabljajo analitike niti piškotkov.",

    "privacy.children.heading": "Otroci",
    "privacy.children.body":
        "Storitev ni namenjena osebam, mlajšim od 16 let. Če ste mlajši od 16 let, lahko stran in aplikacije uporabljate izključno s privolitvijo in pod nadzorom staršev ali skrbnika.",

    "privacy.changes.heading": "Spremembe pravilnika o zasebnosti",
    "privacy.changes.body":
        "Ta pravilnik o zasebnosti lahko občasno posodobimo. O pomembnejših spremembah bomo uporabnike obvestili na tej strani; datum zadnje spremembe je naveden na vrhu strani.",

    // ═══════════════════════ TermsPage (/uvjeti) ═══════════════════════
    "terms.documentTitle": "Pogoji uporabe — bela-turniri.com",
    "terms.documentDescription": "Pogoji uporabe strani bela-turniri.com.",
    "terms.title": "Pogoji uporabe",
    "terms.lastUpdated": "Zadnja sprememba: 13. 9. 2026.",
    "terms.intro":
        "Z uporabo strani bela-turniri.com in naših mobilnih aplikacij sprejemate te pogoje uporabe. Če se z njimi ne strinjate, storitve prosimo ne uporabljajte.",

    "terms.service.heading": "Opis storitve",
    "terms.service.body":
        "bela-turniri.com je brezplačna platforma za organizacijo turnirjev v beli: prijavo in pregled turnirjev, prijavo parov, žrebanje krogov, vnos rezultatov, obračun pijače, javne profile igralcev in online igro bele.",

    "terms.accounts.heading": "Računi",
    "terms.accounts.body1":
        "Za posamezna dejanja (npr. ustvarjanje turnirja, prijavo para) je potreben uporabniški račun prek prijave Firebase (e-pošta in geslo, račun Google ali, na napravah iOS, Apple ID).",
    "terms.accounts.body2":
        "Odgovorni ste za točnost podatkov, ki jih vnesete, in za varovanje dostopnih podatkov svojega računa.",
    "terms.accounts.body3":
        "Svoj račun lahko kadar koli izbrišete prek možnosti \"Brisanje računa\" na strani profila; kaj se pri tem zgodi z vašimi podatki, je opisano v Pravilniku o zasebnosti.",

    "terms.organiserContent.heading": "Vsebina, ki jo vnašajo organizatorji",
    "terms.organiserContent.body1":
        "Organizatorji turnirjev samostojno vnašajo podatke o turnirju, parih, kontaktnih osebah in lokaciji ter v celoti odgovarjajo za točnost, zakonitost in ažurnost teh podatkov.",
    "terms.organiserContent.body2":
        "Če organizator vnaša osebne podatke tretjih oseb (npr. imena in telefonske številke igralcev ali kontaktnih oseb), mora zanje predhodno pridobiti njihovo privolitev in jih obvestiti o obdelavi teh podatkov v skladu s predpisi o varstvu osebnih podatkov.",
    "terms.organiserContent.body3":
        "Kontaktna telefonska številka, vnesena ob anonimni prijavi para, je vidna izključno organizatorju turnirja.",

    "terms.prohibitedConduct.heading": "Prepovedano ravnanje",
    "terms.prohibitedConduct.body":
        "Prepovedano je: vnašati netočne, žaljive ali nezakonite vsebine; zlorabljati funkcionalnosti strani (npr. avtomatizirano pošiljanje zahtev, izogibanje varnostnim ukrepom); nepooblaščeno dostopati do tujih računov ali podatkov; vlagati lažne ali zlonamerne prijave zoper druge uporabnike; ter uporabljati stran v namene, ki nasprotujejo njenemu namenu.",

    "terms.reportsAndBlocking.heading": "Prijave in blokiranje uporabnikov",
    "terms.reportsAndBlocking.body":
        "Uporabniki lahko prijavijo turnir, par ali profil, ki krši te pogoje, z navedbo razloga in neobveznim sporočilom, ter blokirajo druge uporabnike. Prijave pregleduje upravljavec strani in po potrebi sprejme ustrezne ukrepe, vključno z ukinitvijo računa iz razdelka \"Ukinitev računa\".",

    "terms.onlineGame.heading": "Online igra bele",
    "terms.onlineGame.body1":
        "bela-turniri.com ponuja tudi online igro bele, v okviru katere se rezultati partij in statistika shranjujejo skupaj z vašim računom ali, če igrate kot gost, z anonimnim identifikatorjem naprave.",
    "terms.onlineGame.body2":
        "Igra ne vključuje nakupov znotraj aplikacije niti igranja za denar ali drugo premoženjsko vrednost — igra se izključno za zabavo in vodenje statistike.",

    "terms.payments.heading": "Plačila",
    "terms.payments.body":
        "Aplikacija ne ponuja nakupov znotraj aplikacije niti iger za denar. Cenik pijače in računi v okviru turnirja služijo izključno evidenci porabe pijače na kraju izvedbe turnirja in ne predstavljajo plačilne transakcije znotraj aplikacije.",

    "terms.ip.heading": "Intelektualna lastnina",
    "terms.ip.body":
        "Ime, logotip, oblikovanje in izvorna koda strani bela-turniri.com so last upravljavca strani ali so uporabljeni z ustreznim dovoljenjem ter jih ni dovoljeno kopirati ali uporabljati brez predhodne privolitve. Vsebina, ki jo vnesejo uporabniki, ostaja v njihovi lasti, upravljavec pa ima pravico, da jo prikazuje v okviru storitve.",

    "terms.liability.heading": "Omejitev odgovornosti",
    "terms.liability.body":
        "Storitev je na voljo \"takšna, kot je\" in \"kot je dosegljiva\", brez kakršnihkoli jamstev. Upravljavec strani ne odgovarja za škodo, nastalo zaradi uporabe ali nezmožnosti uporabe storitve, netočnih podatkov, ki jih vnesejo organizatorji, niti za prekinitve delovanja, ki jih povzročijo zunanje storitve (npr. Firebase, OpenStreetMap).",

    "terms.termination.heading": "Ukinitev računa",
    "terms.termination.body":
        "Pridržujemo si pravico, da začasno ali trajno onemogočimo dostop do računa, ki krši te pogoje, brez predhodnega obvestila, zlasti v primeru zlorabe, vnosa nezakonite vsebine ali zlonamernega prijavljanja drugih uporabnikov. Uporabnik lahko sam izbriše svoj račun prek možnosti \"Brisanje računa\" na strani profila ali zahteva izbris prek kontaktnega obrazca.",

    "terms.governingLaw.heading": "Pravo, ki se uporablja",
    "terms.governingLaw.body":
        "Za te pogoje se uporablja pravo Republike Hrvaške. Vsak morebiten spor bo reševalo stvarno in krajevno pristojno sodišče v Republiki Hrvaški.",

    "terms.changes.heading": "Spremembe pogojev",
    "terms.changes.body":
        "Te pogoje lahko občasno spremenimo. Če stran uporabljate tudi po objavi sprememb, se šteje, da se z njimi strinjate; datum zadnje spremembe je naveden na vrhu strani.",

    "terms.contact.heading": "Kontakt",
    "terms.contact.body": "Za vsa vprašanja v zvezi s temi pogoji nas kontaktirajte prek kontaktnega obrazca.",

    // ═════════════════ AccountDeletionPage (/brisanje-racuna) ═════════════════
    "deletion.documentTitle": "Izbris računa — {site}",
    "deletion.documentDescription":
        "Kako izbrisati uporabniški račun na {site}: kateri podatki se izbrišejo, kaj ostane in kako zahtevati izbris brez nameščene aplikacije.",
    "deletion.title": "Izbris računa",
    "deletion.lastUpdated": "Zadnja sprememba: 20. 9. 2026.",
    "deletion.intro":
        "Na tej strani piše, kako izbrisati svoj uporabniški račun na {site}, kateri podatki se pri tem izbrišejo, kaj ostane in zakaj ter kako zahtevati izbris, če aplikacije nimate nameščene.",

    "deletion.inApp.heading": "Izbris v aplikaciji",
    "deletion.inApp.intro":
        "Račun lahko izbrišeš sam, kadar koli in ne da bi nam pisal:",
    "deletion.inApp.step1": "Prijavi se v aplikacijo.",
    "deletion.inApp.step2":
        "Odpri svoj profil in izberi zavihek \"Nastavitve\".",
    "deletion.inApp.step3":
        "Na dnu tega zavihka je razdelek \"Izbris računa\" — pritisni gumb \"Izbriši račun\".",
    "deletion.inApp.step4":
        "V oknu za potrditev vpiši besedo IZBRIŠI in potrdi. Izbris se izvede takoj in ga ni mogoče razveljaviti.",
    "deletion.inApp.apple":
        "Če se prijavljaš z Apple ID-jem, te pri izbrisu še enkrat vprašamo za prijavo z Applom, da Applu prekličemo dostop aplikacije. Račun takrat izgine tudi s seznama \"Prijava z Applom\" v nastavitvah tvoje naprave.",

    "deletion.noApp.heading": "Izbris brez aplikacije",
    "deletion.noApp.body1":
        "Isti postopek deluje tudi v običajnem spletnem brskalniku, brez kakršne koli namestitve: odpri {origin}, prijavi se in sledi korakom zgoraj.",
    "deletion.noApp.linkLabel": "Prijavi se in odpri profil",
    "deletion.noApp.body2":
        "Če se ne moreš več prijaviti (izgubljen dostop do e-pošte ali naprave), nam pošlji zahtevo prek kontaktnega obrazca in navedi e-pošto, s katero je bil račun odprt. Zahtevo rešimo najpozneje v 30 dneh; pred izbrisom lahko zahtevamo potrditev, da je račun res tvoj.",
    "deletion.noApp.contactLabel": "Zahtevaj izbris prek kontaktnega obrazca",

    "deletion.deleted.heading": "Kaj se izbriše",
    "deletion.deleted.item.profile":
        "Podatki profila — prikazano ime, telefonska številka in država, profilna fotografija (vključno z datoteko na strežniku), izbrani avatar, jezik in tema vmesnika.",
    "deletion.deleted.item.auth":
        "Prijava — uporabnik v storitvi Firebase Authentication, torej e-pošta in geslo oziroma povezani Google ali Apple račun. Pri prijavi z Applom dodatno prekličemo dostopni žeton pri Applu.",
    "deletion.deleted.item.gameName":
        "Ime za igro — ime, ki je prikazano za mizo v spletni beli.",
    "deletion.deleted.item.push":
        "Potisna obvestila — vse naročnine brskalnika in žetoni naprav, zato obvestila takoj prenehajo.",
    "deletion.deleted.item.blok":
        "Blok beležka — shranjena zgodovina rezultatov, tako na strežniku kot lokalno na napravi, s katere brišeš.",
    "deletion.deleted.item.blocks":
        "Blokirani uporabniki — seznam se izbriše v obe smeri.",
    "deletion.deleted.item.reliability":
        "Karma in zapisi o zapuščanju partij v spletni beli.",
    "deletion.deleted.item.pairPhone":
        "Kontaktna telefonska številka na vseh parih, ki si jih prijavil.",
    "deletion.deleted.item.pairRequests":
        "Oglasi \"iščem para\", ki si jih objavil, skupaj z imenom in kontaktno številko v njih.",
    "deletion.deleted.item.presets":
        "Shranjeni pari in shranjene predloge cenikov. Shranjen par, ki ga deliš s solastnikom, preide nanj, saj je tudi on vpisal polovico tega imena.",
    "deletion.deleted.item.device":
        "Podatki na napravi, s katere brišeš — predpomnilnik podatkov, čakalna vrsta za delo brez povezave in shranjene natakarske seje.",

    "deletion.kept.heading": "Kaj ostane in zakaj",
    "deletion.kept.intro":
        "Izbris je anonimizacija: oseba izgine, skupna zgodovina igre pa ostane nedotaknjena. Po izbrisu tvoje ime ni nikjer več prikazano — namesto njega piše \"Izbrisan uporabnik\".",
    "deletion.kept.item.uid":
        "Prazen zapis računa z naključnim identifikatorjem in naslovom profila (slug). Ohrani se trajno: le tako stare povezave do tvojega profila vrnejo urejeno \"strani ni\", namesto da bi ta naslov podedoval nekdo drug z enako zapisanim imenom.",
    "deletion.kept.item.tournaments":
        "Turnirji, ki si jih organiziral, in pari, ki si jih prijavil — brez tvojega imena in telefonske številke. Rezultati drugih igralcev se ne smejo spremeniti zato, ker si ti odšel.",
    "deletion.kept.item.gameResults":
        "Rezultati odigranih partij spletne bele, vezani na tisti prazni identifikator. Za mizo so štirje igralci in njihova statistika se ne sme spremeniti.",
    "deletion.kept.item.reports":
        "Prijave vsebine — hranijo se, dokler niso rešene, saj je prav to zapis, ki ne sme izginiti, ko prijavljena stran izbriše račun.",
    "deletion.kept.item.contact":
        "Sporočila, poslana prek kontaktnega obrazca — IP-naslov izbrišemo najpozneje 30 dni po prejemu, celotno sporočilo pa najpozneje 12 mesecev po prejemu.",
    "deletion.kept.item.logs":
        "Strežniški dnevniki (IP-naslov in identifikator zahteve) — kratkoročno, zaradi varnosti in odpravljanja težav.",
    "deletion.kept.item.guest":
        "Gostujoča identiteta, če si poleg računa igral tudi kot gost. Ta je samostojna in ni del računa, ki ga brišeš, zato ostane na napravi; odstraniš jo z brisanjem podatkov strani oziroma z odstranitvijo aplikacije.",

    "deletion.timing.heading": "Kdaj se izbris izvede",
    "deletion.timing.body":
        "Izbris, sprožen v aplikaciji, se izvede takoj, znotraj iste zahteve — ni čakalne dobe in ni možnosti obnovitve. Varnostne kopije baze hranimo največ 14 dni in se v tem roku samodejno prepišejo, zato izbrisani podatki izginejo tudi iz njih.",

    "deletion.more.heading": "Več informacij",
    "deletion.more.body":
        "Celoten seznam podatkov, ki jih zbiramo, nameni in pravne podlage obdelave ter tvoje pravice so opisani v pravilniku o zasebnosti.",
    "deletion.more.privacyLabel": "Pravilnik o zasebnosti",
}
