/* ──────────────────────────────────────────────────────────────────────────
   `common` — strings shared by more than one page/component. Croatian is the
   source of truth: this file's shape defines what `src/i18n/sl/common.ts`
   must provide, and a missing Slovenian key is a compile error.

   What belongs here: button labels used across the app, generic status text,
   and the HTTP error fallbacks the axios interceptor shows. Anything specific
   to one screen belongs in `tournament` / `profile` / `pages` / `forms` /
   `admin` instead — those namespaces are filled by the extraction pass and
   each is owned by one agent, so keeping page copy out of `common` is what
   lets that run in parallel.

   Leaf names may contain dots ("error.http.400"); `t()` splits the key at the
   FIRST dot only, so the namespace stays exactly one level deep.
   ────────────────────────────────────────────────────────────────────── */

export const common = {
    // --- Actions -----------------------------------------------------------
    save: "Spremi",
    cancel: "Odustani",
    confirm: "Potvrdi",
    delete: "Obriši",
    close: "Zatvori",
    loading: "Učitavanje…",

    // --- Generic feedback --------------------------------------------------
    saved: "Spremljeno.",
    sessionExpired: "Sesija je istekla, prijavi se ponovno.",
    appUpdating: "Aplikacija se ažurira, pokušaj za minutu.",

    // --- SEO defaults (hooks/useDocumentHead.ts fallback <meta name="description">) --
    "meta.defaultDescription":
        "Bela turniri — organiziraj i prati Bela turnire. Pretraži nadolazeće turnire, pridruži se paru i prati rezultate.",

    /* --- HTTP error fallbacks ------------------------------------------------
       Shown by the axios interceptor (api/http.ts → toaster.ts `statusFallback`)
       when the backend returned no usable message of its own. Keyed by status;
       `error.http.unknown` covers anything not enumerated and takes a
       {status} placeholder. Wording is unchanged from the pre-i18n
       STATUS_FALLBACKS_HR table. */
    "error.network": "Greška u mreži.",
    "error.http.unknown": "Greška (HTTP {status}).",
    "error.http.400": "Neispravan zahtjev.",
    "error.http.401": "Niste prijavljeni.",
    "error.http.403": "Nemate ovlasti za ovu akciju.",
    "error.http.404": "Resurs nije pronađen.",
    "error.http.409": "Konflikt — pokušajte osvježiti stranicu.",
    "error.http.413": "Datoteka je prevelika.",
    "error.http.422": "Neispravni podaci.",
    "error.http.429": "Previše zahtjeva — pokušajte za nekoliko sekundi.",
    "error.http.500": "Greška na poslužitelju.",
    "error.http.502": "Poslužitelj nedostupan.",
    "error.http.503": "Servis privremeno nedostupan.",

    // --- Language switcher (components/LanguagePicker.tsx) ------------------
    "language.label": "Jezik",

    // --- Navigation (components/NavBar.tsx, components/MobileTabBar.tsx) ---
    "nav.brandAriaLabel": "Bela Turniri — naslovnica",
    "nav.brandName": "Bela Turniri",
    "nav.turniri": "Turniri",
    "nav.kalendar": "Kalendar",
    "nav.kreirajTurnir": "Kreiraj turnir",
    "nav.karta": "Karta",
    "nav.pronadjiPara": "Pronađi para",
    "nav.login": "Prijava",
    "nav.profil": "Profil",
    "nav.logout": "Odjavi se",
    "nav.profileMenuAriaLabel": "Profil meni",
    "nav.avatarAlt": "Profilna slika",
    "nav.themeLabel": "Tema",
    "nav.menuAriaLabel": "Izbornik",
    "mobileNav.ariaLabel": "Mobilna navigacija",
    "mobileNav.kreiraj": "Kreiraj",

    // --- Auth loading state (components/RequireAuth.tsx) --------------------
    "checkingAuth": "Provjeravam prijavu…",

    // --- Guided tour chrome (components/PageTour.tsx — react-joyride locale) --
    "tour.nav.back": "Natrag",
    "tour.nav.last": "Završi",
    "tour.nav.next": "Dalje",
    "tour.nav.skip": "Preskoči",
    "tour.nav.open": "Otvori",
    "tour.nav.nextWithProgress": "Dalje ({step}/{steps})",

    // --- Guided tour copy (components/tourSteps.ts) — /turniri list tour ----
    "tour.list.welcome.title": "Dobrodošli na Bela Turniri!",
    "tour.list.welcome.content":
        "Krenimo sa upoznavanjem sa stranicom — gdje su turniri, kako ih pretraživati te što se sve nalazi na stranici jednog turnira. Klikni \"Dalje\" da krenemo, ili \"Preskoči\" ako želiš sam pogledati.",
    "tour.list.navItems.title": "Glavni izbornik",
    "tour.list.navItems.content":
        "Ovo je glavni izbornik. Iz ovog izbornika možeš doći na popis turnira, kalendar, kartu turnira i do alata za pronalazak para za turnir.",
    "tour.list.navAuth.title": "Prijava",
    "tour.list.navAuth.content":
        "Prijavi se za pristup dodtanim značajkama - vlastitom profilu, statistici, povijesti turnira i organizaciji vlastitih turnira.",
    "tour.list.upcoming.title": "Nadolazeći turniri",
    "tour.list.upcoming.content":
        "Ovdje se nalaze svi turniri koji još nisu započeli ili su u tijeku. Turniri su sortirani po datumu — najbliži je gore.",
    "tour.list.finished.title": "Završeni turniri",
    "tour.list.finished.content":
        "Ispod nadolazećih turnira nalaze se završeni turniri koje možeš otvoriti i pregledati ždrijeb i pobjednike.",
    "tour.list.filters.title": "Filteri pretrage",
    "tour.list.filters.content":
        "Ovdje možeš pretraživati turnire po imenu. Klikom na 'Filteri' otvaraš dodatne opcije — filtriraj po lokaciji, cijeni i udaljenosti od tebe.",
    "tour.list.demoCard.title": "Pogledajmo jedan turnir",
    "tour.list.demoCard.content":
        "Klikni \"Dalje\" — otvorit će se upravo ovaj završeni turnir pa možeš vidjeti njegove detalje.",

    // --- Guided tour copy (components/tourSteps.ts) — /turniri/{slug} detail tour --
    "tour.detail.details.title": "Kartica \"Detalji\"",
    "tour.detail.details.content":
        "Krećemo sa karticom \"Detalji\". Ovdje se nalaze svi osnovni podaci o turniru — lokacija, datum, kotizacija, nagrade i kontakt organizatora.",
    "tour.detail.pairs.title": "Kartica \"Parovi\"",
    "tour.detail.pairs.content":
        "U kartici \"Parovi\" vidiš sve prijavljene parove i njihov status u turniru.",
    "tour.detail.firstPair.title": "Kartica para",
    "tour.detail.firstPair.content":
        "Svaka kartica prikazuje ime para, broj pobjeda i poraza, te tko ga je prijavio. Klikom na karticu otvaraš povijest svih njegovih mečeva u turniru.",
    "tour.detail.cjenik.title": "Kartica \"Cjenik\"",
    "tour.detail.cjenik.content":
        "Kartica \"Cjenik\" služi za organizatore. Ovdje organizator može dodjeliti cijene pića te ih kasnije dodati na račun određenog stola.",
    "tour.detail.bracket.title": "Kartica \"Ždrijeb\"",
    "tour.detail.bracket.content":
        "Kartica \"Ždrijeb\" prikazuje sva kola turnira, svaki meč i rezultat. Svako kolo je vlastita kartica koju možeš proširiti za prikaz svih mečeva i rezultata.",
    "tour.detail.firstRound.title": "Proširivanje i puni zaslon",
    "tour.detail.firstRound.content":
        "Prošireno kolo prikazuje svaki meč pojedinačno. Klikom na ikonu punog zaslona uz ždrijeb otvaraš veliki prikaz — koristi ga kad pokazuješ rezultate publici ili na velikom ekranu u kafiću.",
    "tour.detail.endState.title": "Kraj turnira",
    "tour.detail.endState.content":
        "Kad turnir završi, ovdje će biti prikazan cijeli ždrijeb, sva kola s rezultatima i konačni pobjednik. Završeni turniri ostaju vidljivi i kasnije za referencu.",
    "tour.detail.helpInstall.title": "Pomoć i instalacija",
    "tour.detail.helpInstall.content":
        "Uvijek možeš ponovno pokrenuti ovu turu klikom na upitnik (?) ili instalirati aplikaciju na svoj uređaj klikom na strelicu (↓). Ova dva gumba uvijek su ti dostupna u izborniku.",
    "tour.detail.farewell.title": "To je to!",
    "tour.detail.farewell.content":
        "Hvala što si pogledao ovaj kratki uvod u stranicu. Sad slobodno razgledaj stranicu — kreiraj svoj turnir, pridruži se postojećem ili samo prati rezultate. Sretno!",

    // --- Install prompts (components/FirstRunInstallPrompt.tsx, InstallAppButton.tsx) --
    "install.title": "Instaliraj Bela Turniri",
    "install.iosSubtitle": "Dodaj aplikaciju na svoj iPhone u 3 koraka:",
    "install.genericSubtitle":
        "Spremi Bela Turniri kao aplikaciju i otvori je jednim klikom s početnog zaslona.",
    "install.dismissIos": "Razumijem",
    "install.dismissLater": "Možda kasnije",
    "install.installButton": "Instaliraj",
    "install.installAppLabel": "Instaliraj aplikaciju",

    // --- iOS "Add to Home Screen" walkthrough (components/IosInstallSteps.tsx) --
    "install.ios.intro": "Otvori stranicu u Safari pregledniku, a zatim:",
    "install.ios.step1.action": "Klikni ikonu",
    "install.ios.step1.share": "Podijeli",
    "install.ios.step1.location": "u donjem dijelu Safarija.",
    "install.ios.step2.action": "Pomakni se i odaberi",
    "install.ios.step2.addToHome": "Dodaj na početni zaslon",
    "install.ios.step3.action": "Potvrdi",
    "install.ios.step3.confirm": "Dodaj",
    "install.ios.step3.location": "u gornjem desnom kutu.",
    "install.ios.footer":
        "Nakon dodavanja, ikona aplikacije će se pojaviti na tvojem početnom zaslonu i otvarat će se kao samostalna aplikacija.",

    // --- Crash fallback (components/ErrorBoundary.tsx) -----------------------
    "errorBoundary.title": "Nešto je pošlo po krivu",
    "errorBoundary.description": "Dogodila se neočekivana greška. Osvježi stranicu i pokušaj ponovno.",
    "errorBoundary.home": "Natrag na početnu",
    "errorBoundary.refresh": "Osvježi stranicu",

    // --- Offline: stranica nije na uređaju (components/OfflineNotice.tsx) ----
    "offline.title": "Nema internetske veze",
    "offline.description":
        "Ova stranica treba internet. Blok radi i bez veze — sve što upišeš ostaje na uređaju.",
    "offline.descriptionBlok":
        "Ova stranica treba internet, a nije spremljena na uređaj. Pokušaj ponovno kad se veza vrati.",
    "offline.retry": "Pokušaj ponovno",
    "offline.blok": "Otvori blok",

    // --- Podium editor (components/PodiumEditor.tsx) -------------------------
    "podium.title": "Postolje",
    "podium.description":
        "Odaberi parove koji su završili na drugom i trećem mjestu. Pojavit će se na vrhu liste sa srebrnim i brončanim oznakama.",
    "podium.second": "2. mjesto (srebro)",
    "podium.third": "3. mjesto (bronca)",
    "podium.notSet": "— nije postavljeno —",

    // --- Manual round dialog (components/ManualRoundDialog.tsx) -------------
    "manualRound.title": "Ručna generacija kola",
    "manualRound.titleNumbered": "Ručna generacija kola {round}",
    "manualRound.description":
        "Odaberi par-protiv-para za svaki stol. Možeš dodati ili ukloniti redove po potrebi. Ako je broj aktivnih parova neparan, postavi jedan par na \"Slobodan stol (bye)\".",
    "manualRound.noMatches": "Nema mečeva. Dodaj prvi mečom ispod.",
    "manualRound.table": "Stol",
    "manualRound.removeMatch": "Ukloni meč",
    "manualRound.selectPair": "— odaberi par —",
    "manualRound.byeOption": "Slobodan stol (bye)",
    "manualRound.vs": "vs",
    "manualRound.addMatch": "Dodaj meč",
    "manualRound.generate": "Generiraj",

    // --- Location autocomplete / map picker (components/LocationAutocomplete.tsx, LocationMapPicker.tsx) --
    "location.fetchError": "Greška pri dohvaćanju prijedloga.",
    "location.searching": "Tražim…",
    "location.noResults": "Nema rezultata.",
    "location.clickHint": "Klikni na kartu za odabir lokacije",
    "location.searchingAddress": "Tražim adresu…",
    "location.reverseGeocodeError": "Greška pri dohvaćanju adrese.",

    // --- Clipboard feedback, shared by CalendarSubscribeButton.tsx & TournamentQrDialog.tsx --
    "clipboard.copyLink": "Kopiraj poveznicu",
    "clipboard.copied": "Poveznica je kopirana",
    "clipboard.copyFailed": "Kopiranje nije uspjelo",

    // --- Calendar subscribe dialog (components/CalendarSubscribeButton.tsx) --
    "calendar.subscribeButton": "Pretplati se",
    "calendar.dialogTitle": "Pretplata na kalendar turnira",
    "calendar.description":
        "Pretplati se jednom i kalendar će se sam osvježavati — novi i nadolazeći turniri pojavit će se automatski, bez ponovnog preuzimanja.",
    "calendar.subscribeWebcal": "Pretplati se (webcal)",
    "calendar.manualHint":
        "Ako se kalendar ne otvori sam, dodaj ovu poveznicu ručno („Pretplati se na kalendar putem URL-a“):",
    "calendar.downloadIcs": "Preuzmi .ics",
    "calendar.copyFailedDescription": "Poveznicu možeš kopirati ručno iz okvira ispod.",

    // --- Tournament QR dialog (components/TournamentQrDialog.tsx) -----------
    "qr.dialogTitle": "QR kod turnira",
    "qr.scanHint":
        "Skeniranjem se otvara stranica turnira „{name}“. Prikaži ovaj kod na ekranu ili ga ispiši i objesi na mjestu održavanja.",
    "qr.altText": "QR kod za turnir {name}",
    "qr.downloadButton": "Preuzmi QR",
    "qr.downloadSuccess": "QR kod je preuzet",
    "qr.downloadFailedTitle": "Preuzimanje nije uspjelo",
    "qr.downloadFailedDescription": "Pokušaj ponovno za nekoliko trenutaka.",
    "qr.copyFailedDescription": "Poveznicu možeš kopirati ručno iz adresne trake.",

    // --- API toast messages (src/api/*.ts successMessage/errorMessage,
    //     resolved via `t()` at call time — see src/i18n/index.ts) --------
    "toast.tournamentCreated": "Turnir je kreiran.",
    "toast.tournamentUpdated": "Turnir je ažuriran.",
    "toast.tournamentStarted": "Turnir je pokrenut.",
    "toast.tournamentFinished": "Turnir je završen.",
    "toast.tournamentReset": "Turnir je resetiran.",
    "toast.tournamentDeleted": "Turnir je obrisan.",
    "toast.podiumSaved": "Postolje spremljeno.",
    "toast.registrationSent": "Prijava poslana.",
    "toast.pairApproved": "Par je odobren.",
    "toast.pairDeleted": "Par je obrisan.",
    "toast.extraLifeBought": "Dodatni život je kupljen.",
    "toast.cjenikSaved": "Cjenik spremljen",
    "toast.templateSavedAs": "Spremljeno u predložak \"{name}\"",
    "toast.templateImported": "Predložak \"{name}\" učitan",
    "toast.templateSaved": "Predložak \"{name}\" spremljen",
    "toast.templateRenamed": "Predložak preimenovan",
    "toast.templateDeletedNamed": "Predložak \"{name}\" obrisan",
    "toast.matchPaid": "Plaćeno",
    "toast.matchUnpaid": "Označeno kao neplaćeno",
    "toast.pairHidden": "Par sakriven od drugih",
    "toast.pairVisible": "Par vidljiv svima",
    "toast.archiveRequestSent": "Zahtjev poslan — čeka se odgovor partnera.",
    "toast.presetArchived": "Par obrisan.",
    "toast.archiveCancelled": "Zahtjev otkazan.",
    "toast.profileSaved": "Profil je spremljen.",
    "toast.avatarSaved": "Profilna slika je spremljena.",
    "toast.avatarRemoved": "Profilna slika je uklonjena.",
    "toast.pairAttached": "Par pridružen korisniku.",
    "toast.tournamentTransferred": "Turnir prenesen novom vlasniku.",
    "toast.tournamentStatusUpdated": "Status turnira ažuriran.",
    "toast.roundGenerated": "Kolo generirano.",
    "toast.roundFinished": "Runda je završena.",
    "toast.pairClaimed": "Par preuzet — pojavit će se na tvojem profilu.",

    // --- Drink preset categories (utils/drinkPresets.ts, CjenikTab.tsx,
    //     PublicProfilePage.tsx drink-template editor) — display-only
    //     category headings above the quick-add chips. The chip's own
    //     persisted row name stays Croatian regardless of locale; see the
    //     note in drinkPresets.ts. --------------------------------------
    "drinkCategory.beer": "Pivo",
    "drinkCategory.spritzer": "Gemišt",
    "drinkCategory.juice": "Sok",
    "drinkCategory.wine": "Vino",
    "drinkCategory.water": "Voda",
    "drinkCategory.spirits": "Žestoko piće",

    // --- Service-worker update toast (components/SwUpdateToast.tsx) --------
    "swUpdate.title": "Nova verzija dostupna",
    "swUpdate.description": "Osvježi stranicu da bi vidio najnovije izmjene.",
    "swUpdate.reload": "Osvježi",

    // --- Cookie/analytics consent (components/CookieConsent.tsx) -----------
    "cookieConsent.description":
        "Koristimo kolačiće za analitiku posjeta i poboljšanje stranice.",
    "cookieConsent.privacyLink": "Pravila privatnosti",
    "cookieConsent.accept": "Prihvaćam",
    "cookieConsent.decline": "Odbijam",

    // --- SiteFooter (rendered once in App.tsx under every routed page) -----
    "footer.contactLink": "Kontakt",
    "footer.privacyLink": "Privatnost",
    "footer.termsLink": "Uvjeti",
    "footer.copyright": "© {year} bela-turniri.com",
}

/** Contract every other locale's `common` namespace must satisfy. */
export type CommonDict = typeof common
