import type { FormsDict } from "../hr/forms"

/* Slovenian `forms`. Typed as the Croatian namespace, so a dropped or
   misspelled key fails `tsc` instead of silently falling back at runtime.
   Register: informal second person, matching the Croatian copy. Machine-
   assisted translation — should be reviewed by a native speaker before
   release. */

export const forms: FormsDict = {
    // --- Shared across pages.tsx-adjacent standalone pages ------------------
    "shared.backToTournaments": "Nazaj na turnirje",

    // --- Auth (LoginPage.tsx + RegisterPage.tsx) ----------------------------
    "auth.email": "E-pošta",
    "auth.password": "Geslo",
    "auth.orDivider": "ali",
    "auth.invalidEmail": "Neveljavna oblika e-poštnega naslova.",

    // --- LoginPage.tsx -------------------------------------------------------
    "login.heading": "Prijava",
    "login.googleButton": "Nadaljuj z Googlom",
    "login.submit": "Prijavi se",
    "login.forgotPassword": "Pozabljeno geslo?",
    "login.noAccount": "Nimaš računa?",
    "login.registerLink": "Registriraj se",
    "login.validation.emailPassword": "Vnesi e-pošto in geslo.",
    "login.validation.emailForReset": "Vpiši e-pošto v zgornje polje in poskusi znova.",
    "login.resetSent": "Poslali smo ti povezavo za spremembo gesla. Preveri e-pošto.",
    "login.error.invalidCredential": "Napačen e-poštni naslov ali geslo.",
    "login.error.userDisabled": "Uporabniški račun je onemogočen.",
    "login.error.tooManyRequests": "Preveč poskusov. Poskusi znova pozneje.",
    "login.error.generic": "Prijava ni uspela.",

    // --- RegisterPage.tsx ------------------------------------------------------
    "register.heading": "Registracija",
    "register.googleButton": "Registriraj se z Googlom",
    "register.nameLabel": "Ime",
    "register.nameOptional": "(neobvezno)",
    "register.namePlaceholder": "npr. Marko",
    "register.passwordHelper": "Vsaj 6 znakov.",
    "register.confirmPasswordLabel": "Potrdi geslo",
    "register.submit": "Ustvari račun",
    "register.hasAccount": "Že imaš račun?",
    "register.loginLink": "Prijavi se",
    "register.validation.required": "E-pošta in geslo sta obvezna.",
    "register.validation.weakPassword": "Geslo mora imeti vsaj 6 znakov.",
    "register.validation.passwordMismatch": "Gesli se ne ujemata.",
    "register.error.emailInUse": "Račun s tem e-poštnim naslovom že obstaja. Poskusi se prijaviti.",
    "register.error.weakPassword": "Geslo je prešibko. Imeti mora vsaj 6 znakov.",
    "register.error.generic": "Registracija ni uspela.",

    // --- Claim flow shared strings (ClaimNamePage.tsx + ClaimPairPage.tsx) --
    "claim.label": "PREVZEMI PAR",
    "claim.notFoundHeading": "Povezava ni najdena",
    "claim.alreadyClaimedBadge": "Že prevzet",
    "claim.alreadyClaimedMessage": "Par je že prevzel nekdo drug in ga ni več mogoče prevzeti.",
    "claim.success": "Par je dodan na tvoj profil.",
    "claim.error.ownerSame": "Že si lastnik tega para — ne moreš prevzeti lastnega para.",
    "claim.error.alreadyClaimed": "Ta par je že prevzel nekdo drug.",
    "claim.error.loginRequired": "Prijavi se, da prevzameš par.",
    "claim.error.generic": "Prevzem ni uspel.",
    "claim.loginCta": "Prijavi se za prevzem",
    "claim.submit": "Prevzemi par",

    // --- ClaimNamePage.tsx (specific) ---------------------------------------
    "claimName.notFoundMessage": "Povezava za prevzem para ni veljavna. Prosi soigralca, naj ti pošlje novo povezavo.",
    "claimName.sharedByLabel": "Deli:",

    // --- ClaimPairPage.tsx (specific) ---------------------------------------
    "claimPair.notFoundMessage": "Povezava za prevzem para ni veljavna ali pa je par izbrisan. Prosi soigralca, naj ti pošlje novo povezavo.",
    "claimPair.tournamentLabel": "Turnir:",
    "claimPair.submittedByLabel": "Prijavil:",

    // --- NotFoundPage.tsx ------------------------------------------------------
    "notFound.heading": "Stran ni najdena",
    "notFound.message": "Naslov, ki si ga odprl, ne obstaja ali je bil premaknjen.",

    // --- ProfileRedirect.tsx ----------------------------------------------------
    "profileRedirect.opening": "Odpiram tvoj profil…",

    // --- CreateTournamentPage.tsx --------------------------------------------
    "createTournament.section.pricing": "Kotizacija in repasaž",
    "createTournament.section.rewards": "Nagrade",
    "createTournament.section.contact": "Kontakt organizatorja",

    "createTournament.name.label": "Ime turnirja",
    "createTournament.name.placeholder": "npr. Bela open",

    "createTournament.dateTime.label": "Datum in ura",
    "createTournament.dateTime.timeCaption": "Ura",
    "createTournament.dateTime.placeholder": "DD/MM/LLLL HH:MM",

    "createTournament.maxPairs.label": "Maks. parov",
    "createTournament.maxPairs.placeholder": "Nedoločeno",

    "createTournament.location.label": "Lokacija",
    "createTournament.location.placeholder": "Vnesi lokacijo ali izberi na zemljevidu",

    "createTournament.details.label": "Podrobnosti",
    "createTournament.details.placeholder": "Dodatne informacije - pravila, parkiranje, hrana, pijača...",

    "createTournament.poster.label": "Plakat",
    "createTournament.poster.optional": "(neobvezno)",
    "createTournament.poster.alt": "Predogled plakata",
    "createTournament.poster.remove": "Odstrani plakat",
    "createTournament.poster.change": "Zamenjaj sliko",
    "createTournament.poster.choose": "Izberi sliko",
    "createTournament.poster.hint": "PNG, JPG ali WEBP, do {maxMb} MB.",
    "createTournament.poster.errorType": "Dovoljeno: JPG, PNG ali WEBP.",
    "createTournament.poster.errorSize": "Največja velikost je {maxMb} MB.",

    "createTournament.perPairSuffix": "/par",
    "createTournament.perPlayerSuffix": "/igralec",

    "createTournament.entryPrice.label": "Kotizacija",
    "createTournament.repassagePrice.label": "Repasaž",
    "createTournament.repassageSecondPrice.label": "Drugi repasaž",
    "createTournament.repassageSecondPrice.optional": "(neobv.)",
    "createTournament.repassageUntil.label": "Repasaž mogoč do",
    "createTournament.repassageUntil.finals": "Finala",
    "createTournament.repassageUntil.semifinals": "Polfinala",
    "createTournament.repassageUntil.firstRound": "Prvega kroga",
    "createTournament.repassageUntil.helper": "Zadnji krog, pred katerim je mogoče kupiti dodatno življenje.",

    "createTournament.rewardsMode.fixed": "Fiksne nagrade (€)",
    "createTournament.rewardsMode.percentage": "Odstotek sklada (%)",
    "createTournament.reward.first": "1. mesto",
    "createTournament.reward.second": "2. mesto",
    "createTournament.reward.third": "3. mesto",
    "createTournament.reward.fixedPlaceholder.first": "npr. 200",
    "createTournament.reward.fixedPlaceholder.second": "npr. 120",
    "createTournament.reward.fixedPlaceholder.third": "npr. 60",
    "createTournament.reward.percentPlaceholder.first": "npr. 50",
    "createTournament.reward.percentPlaceholder.second": "npr. 30",
    "createTournament.reward.percentPlaceholder.third": "npr. 20",

    "createTournament.contactName.label": "Ime",
    "createTournament.contactName.placeholder": "Ime organizatorja",
    "createTournament.contactPhone.label": "Telefonska številka",
    "createTournament.contactPhone.placeholder": "91 234 5678",

    "createTournament.submit": "Ustvari turnir",

    "createTournament.pastDateError": "Datum in ura turnirja ne moreta biti v preteklosti.",
    "createTournament.submitFailed.title": "Ustvarjanje turnirja ni uspelo.",
    "createTournament.submitFailed.message": "Preveri internetno povezavo in poskusi znova.",

    "createTournament.missingRequired.name": "Ime",
    "createTournament.missingRequired.location": "Lokacija",
    "createTournament.missingRequired.date": "Datum",
    "createTournament.missingRequired.time": "Ura",
    "createTournament.missingRequired.rewards": "Nagrade",

    // --- CreateTournamentPage.tsx: wizard chrome ------------------------------
    "createTournament.wizard.ariaLabel": "Koraki ustvarjanja turnirja",
    "createTournament.wizard.step.basics": "Osnovno",
    "createTournament.wizard.step.money": "Kotizacija in nagrade",
    "createTournament.wizard.step.review": "Pregled",
    "createTournament.wizard.progress": "{n} / {total}",
    "createTournament.wizard.stepAriaLabel": "Korak {n} od {total}: {label}",
    "createTournament.wizard.back": "Nazaj",
    "createTournament.wizard.next": "Naprej",
    "createTournament.wizard.missingFields": "Pred nadaljevanjem izpolni: {fields}",
    // Slovenian keeps the dual, so `.two` is a genuinely different form here.
    "createTournament.wizard.missingCount.one": "Manjka {n} obvezno polje",
    "createTournament.wizard.missingCount.two": "Manjkata {n} obvezni polji",
    "createTournament.wizard.missingCount.few": "Manjkajo {n} obvezna polja",
    "createTournament.wizard.missingCount.other": "Manjka {n} obveznih polj",

    // --- CreateTournamentPage.tsx: "Učitaj iz predloška" -----------------------
    "createTournament.template.button": "Naloži iz predloge",
    "createTournament.template.dialogTitle": "Naloži iz predloge",
    "createTournament.template.dialogHint": "Nastavitve izbranega turnirja se uporabijo za tega. Vnesi nov datum in čas, ostalo po želji spremeni.",
    "createTournament.template.empty": "Še nimaš organiziranih turnirjev za predlogo.",
    "createTournament.template.loadListError": "Seznama turnirjev ni mogoče naložiti.",
    "createTournament.template.loadDetailsError": "Podatkov turnirja ni mogoče naložiti.",
    "createTournament.template.pick": "Naloži",
    "createTournament.template.applied.title": "Predloga naložena",
    "createTournament.template.applied.message": "Nastavitve iz \"{name}\" so uporabljene. Preveri datum, čas in ostale podrobnosti.",

    // --- CreateTournamentPage.tsx: step 3 (Pregled) ---------------------------
    "createTournament.review.subheading": "Preveri podatke pred objavo turnirja.",
    "createTournament.review.unnamed": "Turnir brez imena",
    "createTournament.review.notEntered": "Ni vneseno",
    "createTournament.review.unlimited": "Neomejeno",
    "createTournament.review.free": "Brezplačno",
    "createTournament.review.noPoster": "Brez plakata",
}
