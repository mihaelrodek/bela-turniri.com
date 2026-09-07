/* `forms` — form labels, placeholders, helper text and client-side
   validation messages.

   Croatian is the source of truth: this file's shape defines what
   `src/i18n/sl/forms.ts` must provide, and a missing Slovenian key is a
   compile error. Keys are flat within the namespace (leaf names may contain
   dots; `t()` splits at the first dot only), and are addressed as
   `t("forms.someKey")`.

   Owned by ONE agent of the extraction pass — nobody else edits this file. */

export const forms = {
    // --- Shared across pages.tsx-adjacent standalone pages ------------------
    "shared.backToTournaments": "Natrag na turnire",

    // --- Auth (LoginPage.tsx + RegisterPage.tsx) ----------------------------
    "auth.email": "Email",
    "auth.password": "Lozinka",
    "auth.orDivider": "ili",
    "auth.invalidEmail": "Neispravan format email adrese.",

    // --- LoginPage.tsx -------------------------------------------------------
    "login.heading": "Prijava",
    "login.googleButton": "Nastavi s Googleom",
    "login.submit": "Prijavi se",
    "login.forgotPassword": "Zaboravljena lozinka?",
    "login.noAccount": "Nemaš račun?",
    "login.registerLink": "Registriraj se",
    "login.validation.emailPassword": "Unesi email i lozinku.",
    "login.validation.emailForReset": "Upiši email u polje iznad i ponovi.",
    "login.resetSent": "Poslali smo ti link za promjenu lozinke. Provjeri email.",
    "login.error.invalidCredential": "Pogrešan email ili lozinka.",
    "login.error.userDisabled": "Korisnički račun je deaktiviran.",
    "login.error.tooManyRequests": "Previše pokušaja. Pokušaj ponovno kasnije.",
    "login.error.generic": "Prijava nije uspjela.",

    // --- RegisterPage.tsx ------------------------------------------------------
    "register.heading": "Registracija",
    "register.googleButton": "Registriraj se s Googleom",
    "register.nameLabel": "Ime",
    "register.nameOptional": "(opcionalno)",
    "register.namePlaceholder": "npr. Marko",
    "register.passwordHelper": "Najmanje 6 znakova.",
    "register.confirmPasswordLabel": "Potvrdi lozinku",
    "register.submit": "Kreiraj račun",
    "register.hasAccount": "Već imaš račun?",
    "register.loginLink": "Prijavi se",
    "register.validation.required": "Email i lozinka su obavezni.",
    "register.validation.weakPassword": "Lozinka mora imati barem 6 znakova.",
    "register.validation.passwordMismatch": "Lozinke se ne podudaraju.",
    "register.error.emailInUse": "Već postoji račun s tom email adresom. Probaj se prijaviti.",
    "register.error.weakPassword": "Lozinka je preslaba. Mora imati barem 6 znakova.",
    "register.error.generic": "Registracija nije uspjela.",

    // --- Claim flow shared strings (ClaimNamePage.tsx + ClaimPairPage.tsx) --
    // Both pages are the same "preuzmi par" UX against two different share
    // tokens (a preset name vs. a specific pair); text that reads identically
    // on both screens lives here so the two agents-of-one don't drift.
    "claim.label": "PREUZMI PAR",
    "claim.notFoundHeading": "Veza nije pronađena",
    "claim.alreadyClaimedBadge": "Već preuzet",
    "claim.alreadyClaimedMessage": "Par je već preuzeo netko drugi i ne može se ponovno preuzeti.",
    "claim.success": "Par je dodan na tvoj profil.",
    "claim.error.ownerSame": "Već si vlasnik ovog para — ne možeš preuzeti vlastiti par.",
    "claim.error.alreadyClaimed": "Ovaj par je već preuzeo netko drugi.",
    "claim.error.loginRequired": "Prijavi se da preuzmeš par.",
    "claim.error.generic": "Preuzimanje nije uspjelo.",
    "claim.loginCta": "Prijavi se da preuzmeš",
    "claim.submit": "Preuzmi par",

    // --- ClaimNamePage.tsx (specific) ---------------------------------------
    "claimName.notFoundMessage": "Poveznica za preuzimanje para nije valjana. Pitaj suigrača da ti pošalje novu vezu.",
    "claimName.sharedByLabel": "Dijeli:",

    // --- ClaimPairPage.tsx (specific) ---------------------------------------
    "claimPair.notFoundMessage": "Poveznica za preuzimanje para nije valjana ili je par obrisan. Pitaj svojeg suigrača da ti pošalje novu vezu.",
    "claimPair.tournamentLabel": "Turnir:",
    "claimPair.submittedByLabel": "Prijavio:",

    // --- NotFoundPage.tsx ------------------------------------------------------
    "notFound.heading": "Stranica nije pronađena",
    "notFound.message": "Adresa koju si otvorio ne postoji ili je premještena.",

    // --- ProfileRedirect.tsx ----------------------------------------------------
    "profileRedirect.opening": "Otvaram tvoj profil…",

    // --- CreateTournamentPage.tsx --------------------------------------------
    // Group headings INSIDE a wizard card. „Osnovno“ has none — the step
    // strip above the card already names it — so there is no basicInfo key.
    "createTournament.section.pricing": "Kotizacija i repasaž",
    "createTournament.section.rewards": "Nagrade",
    "createTournament.section.contact": "Kontakt organizatora",

    "createTournament.name.label": "Ime turnira",
    "createTournament.name.placeholder": "npr. Bela open",

    "createTournament.dateTime.label": "Datum i vrijeme",
    "createTournament.dateTime.timeCaption": "Vrijeme",
    "createTournament.dateTime.placeholder": "DD/MM/GGGG HH:MM",

    "createTournament.maxPairs.label": "Max. parova",
    // The placeholder carries the "optional, blank = no cap" meaning on its
    // own; a helper line under a 90px-wide field cost a whole extra row.
    "createTournament.maxPairs.placeholder": "Neodređeno",

    "createTournament.location.label": "Lokacija",
    "createTournament.location.placeholder": "Unesi lokaciju ili izaberi na karti",

    "createTournament.details.label": "Detalji",
    "createTournament.details.placeholder": "Dodatne informacije - pravila, parking, hrana, piće...",

    "createTournament.poster.label": "Plakat",
    "createTournament.poster.optional": "(opcionalno)",
    "createTournament.poster.alt": "Pregled plakata",
    "createTournament.poster.remove": "Ukloni plakat",
    "createTournament.poster.change": "Promijeni sliku",
    "createTournament.poster.choose": "Odaberi sliku",
    "createTournament.poster.hint": "PNG, JPG ili WEBP, do {maxMb} MB.",
    "createTournament.poster.errorType": "Dozvoljeno: JPG, PNG ili WEBP.",
    "createTournament.poster.errorSize": "Maksimalna veličina je {maxMb} MB.",

    "createTournament.perPairSuffix": "/par",
    "createTournament.perPlayerSuffix": "/igrač",

    "createTournament.entryPrice.label": "Kotizacija",
    "createTournament.repassagePrice.label": "Repasaž",
    "createTournament.repassageSecondPrice.label": "Drugi repasaž",
    "createTournament.repassageSecondPrice.optional": "(opc.)",
    "createTournament.repassageUntil.label": "Repasaž moguć do",
    "createTournament.repassageUntil.finals": "Finala",
    "createTournament.repassageUntil.semifinals": "Polufinala",
    "createTournament.repassageUntil.firstRound": "Prvog kruga",
    "createTournament.repassageUntil.helper": "Zadnja runda prije koje je moguće kupiti dodatni život.",

    "createTournament.rewardsMode.fixed": "Fixne nagrade (€)",
    "createTournament.rewardsMode.percentage": "Postotak fonda (%)",
    "createTournament.reward.first": "1. mjesto",
    "createTournament.reward.second": "2. mjesto",
    "createTournament.reward.third": "3. mjesto",
    "createTournament.reward.fixedPlaceholder.first": "npr. 200",
    "createTournament.reward.fixedPlaceholder.second": "npr. 120",
    "createTournament.reward.fixedPlaceholder.third": "npr. 60",
    "createTournament.reward.percentPlaceholder.first": "npr. 50",
    "createTournament.reward.percentPlaceholder.second": "npr. 30",
    "createTournament.reward.percentPlaceholder.third": "npr. 20",

    "createTournament.contactName.label": "Ime",
    "createTournament.contactName.placeholder": "Ime organizatora",
    "createTournament.contactPhone.label": "Broj telefona",
    "createTournament.contactPhone.placeholder": "91 234 5678",

    "createTournament.submit": "Kreiraj turnir",

    "createTournament.pastDateError": "Datum i vrijeme turnira ne mogu biti u prošlosti.",
    "createTournament.submitFailed.title": "Kreiranje turnira nije uspjelo.",
    "createTournament.submitFailed.message": "Provjeri internetsku vezu i pokušaj ponovno.",

    // Field names for the required-fields summary (`missingByStep` in the
    // page). Each entry is tagged with the wizard step that owns the field,
    // so the same list gates "Dalje" per step AND the publish button — these
    // labels are what the "still missing" banner and toast list by name.
    "createTournament.missingRequired.name": "Ime",
    "createTournament.missingRequired.location": "Lokacija",
    "createTournament.missingRequired.date": "Datum",
    "createTournament.missingRequired.time": "Vrijeme",
    "createTournament.missingRequired.rewards": "Nagrade",

    // --- CreateTournamentPage.tsx: wizard chrome ------------------------------
    // The form is a three-step wizard: osnovno → kotizacija i nagrade →
    // pregled. Keep the step names SHORT — on a phone the strip shows the
    // current one next to a "2 / 3" counter, and on desktop all three sit in
    // one row and truncate rather than wrap.
    "createTournament.wizard.ariaLabel": "Koraci kreiranja turnira",
    "createTournament.wizard.step.basics": "Osnovno",
    "createTournament.wizard.step.money": "Kotizacija i nagrade",
    "createTournament.wizard.step.review": "Pregled",
    "createTournament.wizard.progress": "{n} / {total}",
    "createTournament.wizard.stepAriaLabel": "Korak {n} od {total}: {label}",
    "createTournament.wizard.back": "Natrag",
    "createTournament.wizard.next": "Dalje",
    "createTournament.wizard.missingFields": "Popuni prije nastavka: {fields}",
    // Plural family — the count of still-empty required fields on the step
    // the user tried to leave. Croatian uses one/few/other; `.two` repeats
    // `.few` so the Slovenian dual has a slot of the same shape to override.
    "createTournament.wizard.missingCount.one": "Nedostaje {n} obavezno polje",
    "createTournament.wizard.missingCount.two": "Nedostaju {n} obavezna polja",
    "createTournament.wizard.missingCount.few": "Nedostaju {n} obavezna polja",
    "createTournament.wizard.missingCount.other": "Nedostaje {n} obaveznih polja",

    // --- CreateTournamentPage.tsx: "Učitaj iz predloška" -----------------------
    // Lets an organiser seed a new tournament from one they already ran —
    // everything except the date/time (and the map pin, which the backend
    // re-geocodes from the location text) is copied over and stays editable.
    "createTournament.template.button": "Učitaj iz predloška",
    "createTournament.template.dialogTitle": "Učitaj iz predloška",
    "createTournament.template.dialogHint": "Postavke odabranog turnira primjenjuju se na ovaj. Upiši novi datum i vrijeme, ostalo po želji izmijeni.",
    "createTournament.template.empty": "Još nemaš organiziranih turnira za predložak.",
    "createTournament.template.loadListError": "Popis turnira nije moguće učitati.",
    "createTournament.template.loadDetailsError": "Podatke turnira nije moguće učitati.",
    "createTournament.template.pick": "Učitaj",
    "createTournament.template.applied.title": "Predložak učitan",
    "createTournament.template.applied.message": "Postavke iz \"{name}\" su primijenjene. Provjeri datum, vrijeme i ostale detalje.",

    // --- CreateTournamentPage.tsx: step 3 (Pregled) ---------------------------
    "createTournament.review.subheading": "Provjeri podatke prije objave turnira.",
    "createTournament.review.unnamed": "Turnir bez imena",
    "createTournament.review.notEntered": "Nije uneseno",
    "createTournament.review.unlimited": "Neograničeno",
    "createTournament.review.free": "Besplatno",
    "createTournament.review.noPoster": "Bez plakata",
}

/** Contract every other locale's `forms` namespace must satisfy. */
export type FormsDict = typeof forms
