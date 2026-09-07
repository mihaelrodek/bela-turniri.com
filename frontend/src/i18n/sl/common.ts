import type { CommonDict } from "../hr/common"

/* Slovenian `common`. Typed as the Croatian namespace, so dropping or
   misspelling a key fails `tsc` rather than silently falling back at runtime.

   Register: informal second person, matching the Croatian copy. Machine-
   assisted translation — should be reviewed by a native speaker before
   release.

   One deliberate divergence from a literal translation: the Croatian HTTP
   fallbacks below use the FORMAL second person ("Niste prijavljeni.") because
   that is what the pre-i18n table said; the Slovenian keeps the same formal
   register for those specific strings so the two read as the same voice. */

export const common: CommonDict = {
    // --- Actions -----------------------------------------------------------
    save: "Shrani",
    cancel: "Prekliči",
    confirm: "Potrdi",
    delete: "Izbriši",
    close: "Zapri",
    loading: "Nalaganje…",

    // --- Generic feedback --------------------------------------------------
    saved: "Shranjeno.",
    sessionExpired: "Seja je potekla, prijavi se znova.",
    appUpdating: "Aplikacija se posodablja, poskusi čez minuto.",

    // --- SEO defaults (fallback <meta name="description">) ------------------
    "meta.defaultDescription":
        "Bela turnirji — organiziraj in spremljaj turnirje bele. Preišči prihajajoče turnirje, se pridruži paru in spremljaj rezultate.",

    // --- HTTP error fallbacks ----------------------------------------------
    "error.network": "Napaka v omrežju.",
    "error.http.unknown": "Napaka (HTTP {status}).",
    "error.http.400": "Neveljavna zahteva.",
    "error.http.401": "Niste prijavljeni.",
    "error.http.403": "Nimate dovoljenja za to dejanje.",
    "error.http.404": "Vira ni bilo mogoče najti.",
    "error.http.409": "Konflikt — poskusite osvežiti stran.",
    "error.http.413": "Datoteka je prevelika.",
    "error.http.422": "Neveljavni podatki.",
    "error.http.429": "Preveč zahtev — poskusite čez nekaj sekund.",
    "error.http.500": "Napaka na strežniku.",
    "error.http.502": "Strežnik ni dosegljiv.",
    "error.http.503": "Storitev je začasno nedosegljiva.",

    // --- Language switcher -------------------------------------------------
    "language.label": "Jezik",

    // --- Navigation ----------------------------------------------------------
    "nav.brandAriaLabel": "Bela Turniri — domača stran",
    "nav.brandName": "Bela Turniri",
    "nav.turniri": "Turnirji",
    "nav.kalendar": "Koledar",
    "nav.kreirajTurnir": "Ustvari turnir",
    "nav.karta": "Zemljevid",
    "nav.pronadjiPara": "Najdi para",
    "nav.login": "Prijava",
    "nav.profil": "Profil",
    "nav.logout": "Odjavi se",
    "nav.profileMenuAriaLabel": "Meni profila",
    "nav.avatarAlt": "Profilna slika",
    "nav.themeLabel": "Tema",
    "nav.menuAriaLabel": "Meni",
    "mobileNav.ariaLabel": "Mobilna navigacija",
    "mobileNav.kreiraj": "Ustvari",

    // --- Auth loading state ---------------------------------------------------
    "checkingAuth": "Preverjam prijavo…",

    // --- Guided tour chrome (react-joyride locale) ----------------------------
    "tour.nav.back": "Nazaj",
    "tour.nav.last": "Zaključi",
    "tour.nav.next": "Naprej",
    "tour.nav.skip": "Preskoči",
    "tour.nav.open": "Odpri",
    "tour.nav.nextWithProgress": "Naprej ({step}/{steps})",

    // --- Guided tour copy — /turniri list tour --------------------------------
    "tour.list.welcome.title": "Dobrodošli na Bela Turniri!",
    "tour.list.welcome.content":
        "Začnimo s spoznavanjem strani — kje so turnirji, kako jih iskati in kaj vse najdeš na strani posameznega turnirja. Klikni \"Naprej\" za začetek ali \"Preskoči\", če želiš sam pogledati.",
    "tour.list.navItems.title": "Glavni meni",
    "tour.list.navItems.content":
        "To je glavni meni. Iz njega lahko dostopaš do seznama turnirjev, koledarja, zemljevida turnirjev in orodja za iskanje para za turnir.",
    "tour.list.navAuth.title": "Prijava",
    "tour.list.navAuth.content":
        "Prijavi se za dostop do dodatnih funkcij - lastnega profila, statistike, zgodovine turnirjev in organizacije lastnih turnirjev.",
    "tour.list.upcoming.title": "Prihajajoči turnirji",
    "tour.list.upcoming.content":
        "Tukaj so vsi turnirji, ki se še niso začeli ali so v teku. Turnirji so razvrščeni po datumu — najbližji je zgoraj.",
    "tour.list.finished.title": "Zaključeni turnirji",
    "tour.list.finished.content":
        "Pod prihajajočimi turnirji so zaključeni turnirji, ki jih lahko odpreš in si ogledaš žreb ter zmagovalce.",
    "tour.list.filters.title": "Filtri iskanja",
    "tour.list.filters.content":
        "Tukaj lahko iščeš turnirje po imenu. S klikom na 'Filtri' odpreš dodatne možnosti — filtriraj po lokaciji, ceni in oddaljenosti od tebe.",
    "tour.list.demoCard.title": "Poglejmo en turnir",
    "tour.list.demoCard.content":
        "Klikni \"Naprej\" — odprl se bo prav ta zaključeni turnir, tako da boš videl njegove podrobnosti.",

    // --- Guided tour copy — /turniri/{slug} detail tour -----------------------
    "tour.detail.details.title": "Zavihek \"Podrobnosti\"",
    "tour.detail.details.content":
        "Začnimo z zavihkom \"Podrobnosti\". Tukaj so vsi osnovni podatki o turnirju — lokacija, datum, kotizacija, nagrade in kontakt organizatorja.",
    "tour.detail.pairs.title": "Zavihek \"Pari\"",
    "tour.detail.pairs.content":
        "V zavihku \"Pari\" vidiš vse prijavljene pare in njihov status v turnirju.",
    "tour.detail.firstPair.title": "Kartica para",
    "tour.detail.firstPair.content":
        "Vsaka kartica prikazuje ime para, število zmag in porazov ter kdo ga je prijavil. S klikom na kartico odpreš zgodovino vseh njegovih tekem v turnirju.",
    "tour.detail.cjenik.title": "Zavihek \"Cjenik\"",
    "tour.detail.cjenik.content":
        "Zavihek \"Cjenik\" je namenjen organizatorjem. Tukaj lahko organizator določi cene pijač in jih kasneje doda na račun določene mize.",
    "tour.detail.bracket.title": "Zavihek \"Žreb\"",
    "tour.detail.bracket.content":
        "Zavihek \"Žreb\" prikazuje vsa kola turnirja, vsako tekmo in rezultat. Vsako kolo je svoja kartica, ki jo lahko razširiš za prikaz vseh tekem in rezultatov.",
    "tour.detail.firstRound.title": "Razširitev in celozaslonski prikaz",
    "tour.detail.firstRound.content":
        "Razširjeno kolo prikazuje vsako tekmo posebej. S klikom na ikono celozaslonskega prikaza ob žrebu odpreš velik prikaz — uporabi ga, ko rezultate prikazuješ publiki ali na velikem zaslonu v kavarni.",
    "tour.detail.endState.title": "Konec turnirja",
    "tour.detail.endState.content":
        "Ko se turnir konča, bo tukaj prikazan celoten žreb, vsa kola z rezultati in končni zmagovalec. Zaključeni turnirji ostanejo vidni tudi kasneje za referenco.",
    "tour.detail.helpInstall.title": "Pomoč in namestitev",
    "tour.detail.helpInstall.content":
        "To turo lahko kadarkoli znova zaženeš s klikom na vprašaj (?) ali namestiš aplikacijo na svojo napravo s klikom na puščico (↓). Ta dva gumba sta ti vedno na voljo v meniju.",
    "tour.detail.farewell.title": "To je to!",
    "tour.detail.farewell.content":
        "Hvala, da si si ogledal ta kratek uvod v stran. Zdaj prosto razišči stran — ustvari svoj turnir, se pridruži obstoječemu ali samo spremljaj rezultate. Srečno!",

    // --- Install prompts -------------------------------------------------------
    "install.title": "Namesti Bela Turniri",
    "install.iosSubtitle": "Dodaj aplikacijo na svoj iPhone v 3 korakih:",
    "install.genericSubtitle":
        "Shrani Bela Turniri kot aplikacijo in jo odpri z enim klikom z domačega zaslona.",
    "install.dismissIos": "Razumem",
    "install.dismissLater": "Morda kasneje",
    "install.installButton": "Namesti",
    "install.installAppLabel": "Namesti aplikacijo",

    // --- iOS "Add to Home Screen" walkthrough -----------------------------------
    "install.ios.intro": "Odpri stran v brskalniku Safari, nato:",
    "install.ios.step1.action": "Klikni ikono",
    "install.ios.step1.share": "Deli",
    "install.ios.step1.location": "v spodnjem delu Safarija.",
    "install.ios.step2.action": "Pomakni se in izberi",
    "install.ios.step2.addToHome": "Dodaj na domači zaslon",
    "install.ios.step3.action": "Potrdi",
    "install.ios.step3.confirm": "Dodaj",
    "install.ios.step3.location": "v zgornjem desnem kotu.",
    "install.ios.footer":
        "Po dodajanju se bo ikona aplikacije pojavila na tvojem domačem zaslonu in se bo odpirala kot samostojna aplikacija.",

    // --- Crash fallback ----------------------------------------------------------
    "errorBoundary.title": "Nekaj je šlo narobe",
    "errorBoundary.description": "Prišlo je do nepričakovane napake. Osveži stran in poskusi znova.",
    "errorBoundary.home": "Nazaj na domačo stran",
    "errorBoundary.refresh": "Osveži stran",

    // --- Podium editor -------------------------------------------------------------
    "podium.title": "Stopničke",
    "podium.description":
        "Izberi para, ki sta končala na drugem in tretjem mestu. Pojavila se bosta na vrhu seznama s srebrno in bronasto oznako.",
    "podium.second": "2. mesto (srebro)",
    "podium.third": "3. mesto (bron)",
    "podium.notSet": "— ni nastavljeno —",

    // --- Manual round dialog -------------------------------------------------------
    "manualRound.title": "Ročno ustvarjanje kola",
    "manualRound.titleNumbered": "Ročno ustvarjanje kola {round}",
    "manualRound.description":
        "Izberi par proti paru za vsako mizo. Po potrebi lahko dodaš ali odstraniš vrstice. Če je število aktivnih parov liho, nastavi enega para na \"Prosta miza (bye)\".",
    "manualRound.noMatches": "Ni tekem. Dodaj prvo tekmo spodaj.",
    "manualRound.table": "Miza",
    "manualRound.removeMatch": "Odstrani tekmo",
    "manualRound.selectPair": "— izberi para —",
    "manualRound.byeOption": "Prosta miza (bye)",
    "manualRound.vs": "vs",
    "manualRound.addMatch": "Dodaj tekmo",
    "manualRound.generate": "Ustvari",

    // --- Location autocomplete / map picker -----------------------------------------
    "location.fetchError": "Napaka pri pridobivanju predlogov.",
    "location.searching": "Iščem…",
    "location.noResults": "Ni rezultatov.",
    "location.clickHint": "Klikni na zemljevid za izbiro lokacije",
    "location.searchingAddress": "Iščem naslov…",
    "location.reverseGeocodeError": "Napaka pri pridobivanju naslova.",

    // --- Clipboard feedback, shared by CalendarSubscribeButton & TournamentQrDialog --
    "clipboard.copyLink": "Kopiraj povezavo",
    "clipboard.copied": "Povezava je kopirana",
    "clipboard.copyFailed": "Kopiranje ni uspelo",

    // --- Calendar subscribe dialog -----------------------------------------------
    "calendar.subscribeButton": "Naroči se na koledar",
    "calendar.dialogTitle": "Naročnina na koledar turnirjev",
    "calendar.description":
        "Naroči se enkrat in koledar se bo samodejno osveževal — novi in prihajajoči turnirji se bodo pojavili samodejno, brez ponovnega prenosa.",
    "calendar.subscribeWebcal": "Naroči se (webcal)",
    "calendar.manualHint":
        "Če se koledar ne odpre samodejno, dodaj to povezavo ročno („Naroči se na koledar prek URL-ja“):",
    "calendar.downloadIcs": "Prenesi .ics",
    "calendar.copyFailedDescription": "Povezavo lahko kopiraš ročno iz okvirja spodaj.",

    // --- Tournament QR dialog -------------------------------------------------------
    "qr.dialogTitle": "QR koda turnirja",
    "qr.scanHint":
        "S skeniranjem se odpre stran turnirja „{name}“. Prikaži to kodo na zaslonu ali jo natisni in obesi na mestu prireditve.",
    "qr.altText": "QR koda za turnir {name}",
    "qr.downloadButton": "Prenesi QR",
    "qr.downloadSuccess": "QR koda je prenesena",
    "qr.downloadFailedTitle": "Prenos ni uspel",
    "qr.downloadFailedDescription": "Poskusi znova čez nekaj trenutkov.",
    "qr.copyFailedDescription": "Povezavo lahko kopiraš ročno iz naslovne vrstice.",

    // --- API toast messages -------------------------------------------------
    "toast.tournamentCreated": "Turnir je ustvarjen.",
    "toast.tournamentUpdated": "Turnir je posodobljen.",
    "toast.tournamentStarted": "Turnir je začet.",
    "toast.tournamentFinished": "Turnir je končan.",
    "toast.tournamentReset": "Turnir je ponastavljen.",
    "toast.tournamentDeleted": "Turnir je izbrisan.",
    "toast.podiumSaved": "Zmagovalni oder je shranjen.",
    "toast.registrationSent": "Prijava je poslana.",
    "toast.pairApproved": "Par je odobren.",
    "toast.pairDeleted": "Par je izbrisan.",
    "toast.extraLifeBought": "Dodatno življenje je kupljeno.",
    "toast.cjenikSaved": "Cenik shranjen",
    "toast.templateSavedAs": "Shranjeno v predlogo „{name}“",
    "toast.templateImported": "Predloga „{name}“ naložena",
    "toast.templateSaved": "Predloga „{name}“ shranjena",
    "toast.templateRenamed": "Predloga preimenovana",
    "toast.templateDeletedNamed": "Predloga „{name}“ izbrisana",
    "toast.matchPaid": "Plačano",
    "toast.matchUnpaid": "Označeno kot neplačano",
    "toast.pairHidden": "Par skrit pred drugimi",
    "toast.pairVisible": "Par viden vsem",
    "toast.archiveRequestSent": "Zahteva poslana — čaka se odgovor partnerja.",
    "toast.presetArchived": "Par izbrisan.",
    "toast.archiveCancelled": "Zahteva preklicana.",
    "toast.profileSaved": "Profil je shranjen.",
    "toast.avatarSaved": "Profilna slika je shranjena.",
    "toast.avatarRemoved": "Profilna slika je odstranjena.",
    "toast.pairAttached": "Par dodeljen uporabniku.",
    "toast.tournamentTransferred": "Turnir prenesen novemu lastniku.",
    "toast.tournamentStatusUpdated": "Status turnirja posodobljen.",
    "toast.roundGenerated": "Runda je generirana.",
    "toast.roundFinished": "Runda je končana.",
    "toast.pairClaimed": "Par prevzet — pojavil se bo na tvojem profilu.",

    // --- Drink preset categories -----------------------------------------
    "drinkCategory.beer": "Pivo",
    "drinkCategory.spritzer": "Gemišt",
    "drinkCategory.juice": "Sok",
    "drinkCategory.wine": "Vino",
    "drinkCategory.water": "Voda",
    "drinkCategory.spirits": "Žgana pijača",

    // --- Service-worker update toast (components/SwUpdateToast.tsx) --------
    "swUpdate.title": "Na voljo je nova različica",
    "swUpdate.description": "Osveži stran, da vidiš najnovejše spremembe.",
    "swUpdate.reload": "Osveži",

    // --- Cookie/analytics consent (components/CookieConsent.tsx) -----------
    "cookieConsent.description":
        "Uporabljamo piškotke za analitiko obiska in izboljšanje strani.",
    "cookieConsent.privacyLink": "Pravilnik o zasebnosti",
    "cookieConsent.accept": "Sprejmem",
    "cookieConsent.decline": "Zavrnem",

    // --- SiteFooter (rendered once in App.tsx under every routed page) -----
    "footer.contactLink": "Kontakt",
    "footer.privacyLink": "Zasebnost",
    "footer.termsLink": "Pogoji",
    "footer.copyright": "© {year} bela-turniri.com",
}
