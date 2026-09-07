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
    "privacy.lastUpdated": "Zadnja sprememba: 4. 9. 2026.",
    "privacy.intro":
        "Ta dokument opisuje, katere osebne podatke zbiramo prek strani bela-turniri.com, za katere namene jih obdelujemo in katere pravice imate v zvezi z njimi.",

    "privacy.controller.heading": "Upravljavec podatkov",
    "privacy.controller.body":
        "Upravljavec osebnih podatkov, zbranih prek te strani, je lastnik strani bela-turniri.com. Za vsa vprašanja, zahteve ali pritožbe v zvezi z obdelavo osebnih podatkov nas kontaktirajte prek kontaktnega obrazca.",

    "privacy.dataCollected.heading": "Katere podatke zbiramo",
    "privacy.dataCollected.intro":
        "V okviru delovanja strani zbiramo in obdelujemo naslednje kategorije podatkov:",
    "privacy.dataCollected.item.account":
        "Podatki o računu — prek storitve Firebase Authentication se prijavite z e-pošto in geslom ali z računom Google; shranjujemo vaš e-naslov, ime in enolični identifikator uporabnika (UID).",
    "privacy.dataCollected.item.profile":
        "Podatki profila — javno prikazano ime, spletni naslov profila (slug), profilna slika (avatar), izbrani jezik in tema vmesnika.",
    "privacy.dataCollected.item.tournament":
        "Podatki o turnirjih — imena parov, ime in telefonska številka kontaktne osebe organizatorja ter lokacija turnirja, ki jo geokodiramo prek javne storitve OpenStreetMap Nominatim, da jo lahko prikažemo na zemljevidu.",
    "privacy.dataCollected.item.media":
        "Fotografije in plakati — plakati turnirjev in profilne slike so shranjeni na strežniku za shranjevanje datotek (MinIO) v infrastrukturi upravljavca strani.",
    "privacy.dataCollected.item.push":
        "Potisna obvestila — če dovolite prejemanje obvestil, na strežniku shranimo tehnični naslov (endpoint) vaše naročnine za pošiljanje obvestil o turnirjih.",
    "privacy.dataCollected.item.game":
        "Podatki o igri — dostopne kode natakarjev, računi za pijačo in rezultati srečanj, ki jih med turnirjem vnašajo organizatorji in natakarji.",
    "privacy.dataCollected.item.analytics":
        "Analitika — orodje Google Analytics 4 uporabljamo izključno po vaši privolitvi prek pasice za soglasje.",
    "privacy.dataCollected.item.logs":
        "Dnevniki strežnika — strežnik beleži naslov IP in identifikator zahteve (request ID) zaradi varnosti in odpravljanja težav.",
    "privacy.dataCollected.item.device":
        "Podatki na napravi — lokalna shramba (localStorage) in predpomnilnik za delovanje brez povezave se hranita izključno na vaši napravi.",

    "privacy.purpose.heading": "Namen in pravna podlaga obdelave",
    "privacy.purpose.body1":
        "Podatke obdelujemo za izvajanje storitve, ki ste jo zahtevali (izvajanje pogodbe) — prijavo, organizacijo in spremljanje turnirjev v beli, prijavo parov, spremljanje rezultatov in računov za pijačo.",
    "privacy.purpose.body2":
        "Potisna obvestila in analitika se obdelujejo na podlagi vaše privolitve, ki jo lahko kadar koli prekličete.",
    "privacy.purpose.body3":
        "Dnevniki strežnika in varnostni ukrepi temeljijo na našem zakonitem interesu za varnost in stabilno delovanje strani.",

    "privacy.recipients.heading": "Kdo ima dostop do podatkov",
    "privacy.recipients.body1":
        "Za avtentikacijo uporabljamo Firebase Authentication (Google Ireland Ltd. / Google LLC), ki podatke o prijavi obdeluje v skladu s svojim pravilnikom o zasebnosti.",
    "privacy.recipients.body2":
        "Za geokodiranje lokacij uporabljamo javno storitev OpenStreetMap Nominatim, ki ji pošljemo izključno vneseni naslov, brez osebnih podatkov.",
    "privacy.recipients.body3":
        "Stran gostuje na strežniku, ki ga upravlja upravljavec strani; podatkov ne prodajamo niti jih ne posredujemo tretjim osebam v trženjske namene.",
    "privacy.recipients.body4":
        "Javne strani turnirjev in profilov igralcev so dostopne vsem na internetu in jih lahko indeksirajo iskalniki (npr. Google) — objavite le podatke, ki jih želite narediti javne.",

    "privacy.retention.heading": "Kako dolgo hranimo podatke",
    "privacy.retention.body":
        "Podatke hranimo, dokler je vaš račun aktiven oziroma dokler obstaja upravičen namen za njihovo hrambo (npr. zgodovina turnirjev). Po izbrisu računa ali na vašo zahtevo osebne podatke izbrišemo ali anonimiziramo v razumnem roku, razen če daljšo hrambo zahteva zakon.",

    "privacy.rights.heading": "Vaše pravice",
    "privacy.rights.body1":
        "Imate pravico do dostopa, popravka in izbrisa svojih osebnih podatkov, kot tudi do omejitve obdelave, ugovora nanjo in prenosljivosti podatkov.",
    "privacy.rights.body2":
        "Večino podatkov lahko sami pregledate in spremenite v nastavitvah profila. Za izbris računa ali druge zahteve nas kontaktirajte prek kontaktnega obrazca.",
    "privacy.rights.body3":
        "Če menite, da obdelava vaših podatkov ni skladna s predpisi, imate pravico vložiti pritožbo pri pristojnem nadzornem organu za varstvo osebnih podatkov.",

    "privacy.cookies.heading": "Piškotki in lokalna shramba",
    "privacy.cookies.body1":
        "Stran uporablja lokalno shrambo brskalnika (localStorage) za pomnjenje nastavitev (jezik, tema) in predpomnjenje podatkov zaradi hitrejšega delovanja ter delnega delovanja brez internetne povezave.",
    "privacy.cookies.body2":
        "Analitične piškotke (Google Analytics 4) namestimo šele po vaši privolitvi prek pasice za soglasje; svojo izbiro lahko kadar koli spremenite.",

    "privacy.children.heading": "Otroci",
    "privacy.children.body":
        "Storitev ni namenjena osebam, mlajšim od 16 let. Če ste mlajši od 16 let, lahko stran uporabljate izključno s privolitvijo in pod nadzorom staršev ali skrbnika.",

    "privacy.changes.heading": "Spremembe pravilnika o zasebnosti",
    "privacy.changes.body":
        "Ta pravilnik o zasebnosti lahko občasno posodobimo. O pomembnejših spremembah bomo uporabnike obvestili na tej strani; datum zadnje spremembe je naveden na vrhu strani.",

    // ═══════════════════════ TermsPage (/uvjeti) ═══════════════════════
    "terms.documentTitle": "Pogoji uporabe — bela-turniri.com",
    "terms.documentDescription": "Pogoji uporabe strani bela-turniri.com.",
    "terms.title": "Pogoji uporabe",
    "terms.lastUpdated": "Zadnja sprememba: 4. 9. 2026.",
    "terms.intro":
        "Z uporabo strani bela-turniri.com sprejemate te pogoje uporabe. Če se z njimi ne strinjate, strani prosimo ne uporabljajte.",

    "terms.service.heading": "Opis storitve",
    "terms.service.body":
        "bela-turniri.com je brezplačna spletna platforma za organizacijo turnirjev v beli: prijavo in pregled turnirjev, prijavo parov, žrebanje krogov, vnos rezultatov, obračun pijače in javne profile igralcev.",

    "terms.accounts.heading": "Računi",
    "terms.accounts.body1":
        "Za posamezna dejanja (npr. ustvarjanje turnirja, prijavo para) je potreben uporabniški račun prek prijave Firebase (e-pošta in geslo ali račun Google).",
    "terms.accounts.body2":
        "Odgovorni ste za točnost podatkov, ki jih vnesete, in za varovanje dostopnih podatkov svojega računa.",

    "terms.organiserContent.heading": "Vsebina, ki jo vnašajo organizatorji",
    "terms.organiserContent.body1":
        "Organizatorji turnirjev samostojno vnašajo podatke o turnirju, parih, kontaktnih osebah in lokaciji ter v celoti odgovarjajo za točnost, zakonitost in ažurnost teh podatkov.",
    "terms.organiserContent.body2":
        "Če organizator vnaša osebne podatke tretjih oseb (npr. imena in telefonske številke igralcev ali kontaktnih oseb), mora zanje predhodno pridobiti njihovo privolitev in jih obvestiti o obdelavi teh podatkov v skladu s predpisi o varstvu osebnih podatkov.",

    "terms.prohibitedConduct.heading": "Prepovedano ravnanje",
    "terms.prohibitedConduct.body":
        "Prepovedano je: vnašati netočne, žaljive ali nezakonite vsebine; zlorabljati funkcionalnosti strani (npr. avtomatizirano pošiljanje zahtev, izogibanje varnostnim ukrepom); nepooblaščeno dostopati do tujih računov ali podatkov; ter uporabljati stran v namene, ki nasprotujejo njenemu namenu.",

    "terms.ip.heading": "Intelektualna lastnina",
    "terms.ip.body":
        "Ime, logotip, oblikovanje in izvorna koda strani bela-turniri.com so last upravljavca strani ali so uporabljeni z ustreznim dovoljenjem ter jih ni dovoljeno kopirati ali uporabljati brez predhodne privolitve. Vsebina, ki jo vnesejo uporabniki, ostaja v njihovi lasti, upravljavec pa ima pravico, da jo prikazuje v okviru storitve.",

    "terms.liability.heading": "Omejitev odgovornosti",
    "terms.liability.body":
        "Storitev je na voljo \"takšna, kot je\" in \"kot je dosegljiva\", brez kakršnihkoli jamstev. Upravljavec strani ne odgovarja za škodo, nastalo zaradi uporabe ali nezmožnosti uporabe storitve, netočnih podatkov, ki jih vnesejo organizatorji, niti za prekinitve delovanja, ki jih povzročijo zunanje storitve (npr. Firebase, OpenStreetMap).",

    "terms.termination.heading": "Ukinitev računa",
    "terms.termination.body":
        "Pridržujemo si pravico, da začasno ali trajno onemogočimo dostop do računa, ki krši te pogoje, brez predhodnega obvestila, zlasti v primeru zlorabe ali vnosa nezakonite vsebine. Uporabnik lahko zahteva izbris svojega računa prek kontaktnega obrazca.",

    "terms.governingLaw.heading": "Pravo, ki se uporablja",
    "terms.governingLaw.body":
        "Za te pogoje se uporablja pravo Republike Hrvaške. Vsak morebiten spor bo reševalo stvarno in krajevno pristojno sodišče v Republiki Hrvaški.",

    "terms.changes.heading": "Spremembe pogojev",
    "terms.changes.body":
        "Te pogoje lahko občasno spremenimo. Če stran uporabljate tudi po objavi sprememb, se šteje, da se z njimi strinjate; datum zadnje spremembe je naveden na vrhu strani.",

    "terms.contact.heading": "Kontakt",
    "terms.contact.body": "Za vsa vprašanja v zvezi s temi pogoji nas kontaktirajte prek kontaktnega obrazca.",
}
