import type { FormsDict } from "../hr/forms"

/* English `forms`. Typed as the Croatian namespace, so a dropped or
   misspelled key fails `tsc` instead of silently falling back at runtime.
   Register: plain, friendly, informal second person ("you"), matching the
   Croatian copy — see EN-CONTRACT.md for voice and glossary. */

export const forms: FormsDict = {
    // --- Shared across pages.tsx-adjacent standalone pages ------------------
    "shared.backToTournaments": "Back to tournaments",
    "shared.backHome": "Back home",

    // --- Auth (LoginPage.tsx + RegisterPage.tsx) ----------------------------
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.orDivider": "or",
    "auth.invalidEmail": "Invalid email format.",
    // Password show/hide toggle — the icon button's accessible name AND its
    // `aria-pressed` state read the same pair (src/auth/validation.ts owns
    // no copy; this lives here like every other auth string).
    "auth.password.show": "Show password",
    "auth.password.hide": "Hide password",
    // Client-side field validation (src/auth/validation.ts) — shown inline
    // under the field, distinct from the Firebase-error banner below.
    "auth.validation.emailRequired": "Enter your email address.",
    "auth.validation.passwordRequired": "Enter your password.",
    "auth.validation.nameInvalid": "Name can only contain letters, spaces, hyphens, apostrophes and periods (up to 50 characters).",
    "auth.validation.passwordTooLong": "Password is too long (128 characters max).",
    // Social sign-in failures a user can actually hit — shared by both pages
    // (src/auth/authErrors.ts). A cancelled sign-in shows nothing at all.
    "auth.error.popupBlocked": "Your browser blocked the pop-up. Allow pop-ups and try again.",
    "auth.error.accountExistsDifferentCredential": "An account with that email already exists, but with a different sign-in method. Sign in the way you did the first time.",
    "auth.error.providerNotEnabled": "This sign-in method isn't available right now.",
    "auth.error.network": "No internet connection. Check your network and try again.",
    // 16+ / terms gate — the sentence is split because two parts are links.
    "auth.consent.checkboxPrefix": "I'm at least 16 years old and accept the",
    "auth.consent.noticePrefix": "By continuing, you confirm you're 16+ years old and accept the",
    "auth.consent.terms": "Terms of Use",
    "auth.consent.and": "and",
    "auth.consent.privacy": "Privacy Policy",
    "auth.consent.required": "You must confirm you're at least 16 years old and accept the terms.",

    // --- LoginPage.tsx -------------------------------------------------------
    "login.heading": "Sign in",
    "login.subtitle": "Sign in and pick up where you left off.",
    "login.googleButton": "Continue with Google",
    "login.appleButton": "Sign in with Apple",
    "login.submit": "Sign in",
    "login.forgotPassword": "Forgot password?",
    "login.noAccount": "Don't have an account?",
    "login.registerLink": "Sign up",
    "login.validation.emailForReset": "Enter your email in the field above and try again.",
    "login.resetSent": "We've sent you a password reset link. Check your email.",
    "login.error.invalidCredential": "Incorrect email or password.",
    "login.error.userDisabled": "This account has been disabled.",
    "login.error.tooManyRequests": "Too many attempts. Try again later.",
    "login.error.generic": "Sign in failed.",

    // --- RegisterPage.tsx ------------------------------------------------------
    "register.heading": "Create account",
    "register.subtitle": "Create your account in a couple of minutes.",
    "register.googleButton": "Continue with Google",
    "register.appleButton": "Sign in with Apple",
    "register.nameLabel": "Name",
    "register.nameOptional": "(optional)",
    "register.namePlaceholder": "e.g. John",
    "register.passwordHelper": "At least 6 characters. We recommend 8+ for better security.",
    "register.confirmPasswordLabel": "Confirm password",
    "register.submit": "Create account",
    "register.hasAccount": "Already have an account?",
    "register.loginLink": "Sign in",
    "register.validation.weakPassword": "Password must be at least 6 characters.",
    "register.validation.passwordMismatch": "Passwords don't match.",
    "register.error.emailInUse": "An account with that email already exists. Try signing in instead.",
    "register.error.weakPassword": "Password is too weak. It must be at least 6 characters.",
    "register.error.generic": "Sign-up failed.",

    // --- Claim flow shared strings (ClaimNamePage.tsx + ClaimPairPage.tsx) --
    // Both pages are the same "claim a pair" UX against two different share
    // tokens (a preset name vs. a specific pair); text that reads identically
    // on both screens lives here so the two agents-of-one don't drift.
    "claim.label": "CLAIM PAIR",
    "claim.notFoundHeading": "Link not found",
    "claim.alreadyClaimedBadge": "Already claimed",
    "claim.alreadyClaimedMessage": "This pair has already been claimed by someone else and can't be claimed again.",
    "claim.success": "The pair has been added to your profile.",
    "claim.error.ownerSame": "You're already the owner of this pair — you can't claim your own pair.",
    "claim.error.alreadyClaimed": "This pair has already been claimed by someone else.",
    "claim.error.loginRequired": "Sign in to claim the pair.",
    "claim.error.generic": "Claim failed.",
    "claim.loginCta": "Sign in to claim",
    "claim.submit": "Claim pair",

    // --- ClaimNamePage.tsx (specific) ---------------------------------------
    "claimName.notFoundMessage": "This claim link isn't valid. Ask your teammate to send you a new link.",
    "claimName.sharedByLabel": "Shared by:",

    // --- ClaimPairPage.tsx (specific) ---------------------------------------
    "claimPair.notFoundMessage": "This claim link isn't valid, or the pair has been deleted. Ask your teammate to send you a new link.",
    "claimPair.tournamentLabel": "Tournament:",
    "claimPair.submittedByLabel": "Registered by:",

    // --- NotFoundPage.tsx ------------------------------------------------------
    "notFound.heading": "Page not found",
    "notFound.message": "The address you opened doesn't exist or has been moved.",

    // --- ProfileRedirect.tsx ----------------------------------------------------
    "profileRedirect.opening": "Opening your profile…",

    // --- CreateTournamentPage.tsx --------------------------------------------
    // Group headings INSIDE a wizard card. "Basics" has none — the step
    // strip above the card already names it — so there is no basicInfo key.
    "createTournament.section.pricing": "Entry fee and re-entry",
    "createTournament.section.gameRules": "Game rules",
    "createTournament.section.rewards": "Rewards",
    "createTournament.section.contact": "Organizer contact",

    "createTournament.name.label": "Tournament name",
    "createTournament.name.placeholder": "e.g. Bela Open",

    "createTournament.dateTime.label": "Date and time",
    "createTournament.dateTime.timeCaption": "Time",
    "createTournament.dateTime.placeholder": "DD/MM/YYYY HH:MM",

    "createTournament.maxPairs.label": "Max. pairs",
    // The placeholder carries the "optional, blank = no cap" meaning on its
    // own; a helper line under a 90px-wide field cost a whole extra row.
    "createTournament.maxPairs.placeholder": "Unlimited",

    "createTournament.location.label": "Location",
    "createTournament.location.placeholder": "Enter a location or pick one on the map",

    "createTournament.details.label": "Details",
    "createTournament.details.placeholder": "Additional information - rules, parking, food, drinks...",

    "createTournament.poster.label": "Poster",
    "createTournament.poster.optional": "(optional)",
    "createTournament.poster.alt": "Poster preview",
    "createTournament.poster.remove": "Remove poster",
    "createTournament.poster.change": "Change image",
    "createTournament.poster.choose": "Choose image",
    "createTournament.poster.hint": "PNG, JPG or WEBP, up to {maxMb} MB.",
    "createTournament.poster.errorType": "Allowed: JPG, PNG or WEBP.",
    "createTournament.poster.errorSize": "Maximum size is {maxMb} MB.",

    "createTournament.perPairSuffix": "/pair",
    "createTournament.perPlayerSuffix": "/player",

    "createTournament.entryPrice.label": "Entry fee",
    "createTournament.repassagePrice.label": "Re-entry",
    "createTournament.repassageSecondPrice.label": "Second re-entry",
    "createTournament.repassageSecondPrice.optional": "(opt.)",
    "createTournament.repassageUntil.label": "Re-entry possible until",
    "createTournament.repassageUntil.finals": "Finals",
    "createTournament.repassageUntil.semifinals": "Semifinals",
    "createTournament.repassageUntil.firstRound": "First round",
    "createTournament.repassageUntil.helper": "The last round before which an extra life can be bought.",

    "createTournament.targetScore.label": "Play to",
    "createTournament.gameEndRule.label": "Game ends on",
    "createTournament.gameEndRule.prolaz": "Play out",
    "createTournament.gameEndRule.dosta": "Cutoff",
    "createTournament.dealDirection.label": "Deal direction",
    "createTournament.dealDirection.right": "Right",
    "createTournament.dealDirection.left": "Left",
    "createTournament.declarations.label": "Declarations",
    "createTournament.declarations.enabled": "Enabled",
    "createTournament.declarations.disabled": "No declarations",
    "createTournament.allowBela.label": "Bela is allowed",
    "createTournament.allowBela.yes": "Yes",
    "createTournament.allowBela.no": "No",

    "createTournament.rewardsMode.fixed": "Fixed rewards (€)",
    "createTournament.rewardsMode.percentage": "Percentage of pool (%)",
    "createTournament.reward.first": "1st place",
    "createTournament.reward.second": "2nd place",
    "createTournament.reward.third": "3rd place",
    "createTournament.reward.fixedPlaceholder.first": "e.g. 200",
    "createTournament.reward.fixedPlaceholder.second": "e.g. 120",
    "createTournament.reward.fixedPlaceholder.third": "e.g. 60",
    "createTournament.reward.percentPlaceholder.first": "e.g. 50",
    "createTournament.reward.percentPlaceholder.second": "e.g. 30",
    "createTournament.reward.percentPlaceholder.third": "e.g. 20",

    "createTournament.contactName.label": "Name",
    "createTournament.contactName.placeholder": "Organizer name",
    "createTournament.contactPhone.label": "Phone number",
    "createTournament.contactPhone.placeholder": "91 234 5678",

    "createTournament.submit": "Create tournament",

    "createTournament.pastDateError": "Tournament date and time can't be in the past.",
    "createTournament.submitFailed.title": "Failed to create tournament.",
    "createTournament.submitFailed.message": "Check your internet connection and try again.",

    // Field names for the required-fields summary (`missingByStep` in the
    // page). Each entry is tagged with the wizard step that owns the field,
    // so the same list gates "Next" per step AND the publish button — these
    // labels are what the "still missing" banner and toast list by name.
    "createTournament.missingRequired.name": "Name",
    "createTournament.missingRequired.location": "Location",
    "createTournament.missingRequired.date": "Date",
    "createTournament.missingRequired.time": "Time",
    "createTournament.missingRequired.rewards": "Rewards",

    // --- CreateTournamentPage.tsx: wizard chrome ------------------------------
    // The form is a three-step wizard: basics → entry fee & rewards → review.
    // Keep the step names SHORT — on a phone the strip shows the current one
    // next to a "2 / 3" counter, and on desktop all three sit in one row and
    // truncate rather than wrap.
    "createTournament.wizard.ariaLabel": "Tournament creation steps",
    "createTournament.wizard.step.basics": "Basics",
    "createTournament.wizard.step.money": "Entry fee and rewards",
    "createTournament.wizard.step.review": "Review",
    "createTournament.wizard.progress": "{n} / {total}",
    "createTournament.wizard.stepAriaLabel": "Step {n} of {total}: {label}",
    "createTournament.wizard.back": "Back",
    "createTournament.wizard.next": "Next",
    "createTournament.wizard.missingFields": "Fill in before continuing: {fields}",
    // Plural family — the count of still-empty required fields on the step
    // the user tried to leave. English only distinguishes one/other, so
    // `.two`/`.few` repeat `.other`.
    "createTournament.wizard.missingCount.one": "Missing {n} required field",
    "createTournament.wizard.missingCount.two": "Missing {n} required fields",
    "createTournament.wizard.missingCount.few": "Missing {n} required fields",
    "createTournament.wizard.missingCount.other": "Missing {n} required fields",

    // --- CreateTournamentPage.tsx: "Učitaj iz predloška" -----------------------
    // Lets an organiser seed a new tournament from one they already ran —
    // everything except the date/time (and the map pin, which the backend
    // re-geocodes from the location text) is copied over and stays editable.
    "createTournament.template.button": "Load from preset",
    "createTournament.template.dialogTitle": "Load from preset",
    "createTournament.template.dialogHint": "Settings from the selected tournament are applied to this one. Enter a new date and time, and change anything else as you like.",
    "createTournament.template.empty": "You don't have any organized tournaments to use as a preset yet.",
    "createTournament.template.loadListError": "Couldn't load the list of tournaments.",
    "createTournament.template.loadDetailsError": "Couldn't load tournament details.",
    "createTournament.template.pick": "Load",
    "createTournament.template.applied.title": "Preset loaded",
    "createTournament.template.applied.message": "Settings from \"{name}\" have been applied. Check the date, time and other details.",

    // --- CreateTournamentPage.tsx: step 3 (Pregled) ---------------------------
    "createTournament.review.subheading": "Review the details before publishing the tournament.",
    "createTournament.review.unnamed": "Unnamed tournament",
    "createTournament.review.notEntered": "Not entered",
    "createTournament.review.unlimited": "Unlimited",
    "createTournament.review.free": "Free",
    "createTournament.review.noPoster": "No poster",
}
