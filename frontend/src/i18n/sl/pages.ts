import type { PagesDict } from "../hr/pages"

/* Slovenian `pages`. Typed as the Croatian namespace, so a dropped or
   misspelled key fails `tsc` instead of silently falling back at runtime.
   Register: informal second person, matching the Croatian copy.

   Machine-assisted translation — should be reviewed by a native speaker
   before release. Plural families in particular (day counts, tournament /
   request counts) are a best effort at CLDR `sl` grammar and are flagged in
   the extraction report for a native check. */

export const pages: PagesDict = {
    // ═══════════════════════ TournamentsPage ═══════════════════════
    "tournaments.badge.finished": "Zaključen",
    "tournaments.badge.full": "Mesta polna",
    "tournaments.badge.upcoming": "Prihajajoč",
    "tournaments.noPoster": "Ni plakata",
    "tournaments.winnersLabel": "Zmagovalec",

    "tournaments.relativeDays.today": "Danes",
    "tournaments.relativeDays.tomorrow": "Jutri",
    "tournaments.relativeDays.inDays.one": "Čez {n} dan",
    "tournaments.relativeDays.inDays.two": "Čez {n} dneva",
    "tournaments.relativeDays.inDays.few": "Čez {n} dni",
    "tournaments.relativeDays.inDays.other": "Čez {n} dni",

    "tournaments.seo.title": "Bela turnirji na Hrvaškem — bela-turniri.com",
    "tournaments.seo.description":
        "Pregled vseh prihajajočih in odigranih Bela turnirjev na Hrvaškem in v regiji. Išči po lokaciji, datumu in ceni.",
    "tournaments.seo.ogTitle": "Bela turnirji na Hrvaškem",
    "tournaments.seo.ogDescription":
        "Pregled vseh prihajajočih in odigranih Bela turnirjev na Hrvaškem in v regiji.",

    "tournaments.nearMe.label": "Blizu mene",
    "tournaments.nearMe.deniedTitle": "Lokacija ni na voljo",
    "tournaments.nearMe.deniedDescription":
        "Dovoli dostop do lokacije v brskalniku, da bo filter razdalje deloval.",
    "tournaments.nearMe.unsupported": "Brskalnik ne podpira geolokacije.",
    "tournaments.nearMe.enable": "Vklopi",
    "tournaments.nearMe.denied": "Lokacija je zavrnjena v brskalniku.",

    "tournaments.search.placeholder": "Išči po imenu turnirja, mestu ali dvorani…",
    "tournaments.search.clearAria": "Počisti iskanje",
    "tournaments.filters.toggleShow": "Prikaži filtre",
    "tournaments.filters.toggleHide": "Skrij filtre",
    "tournaments.filters.button": "Filtri",
    "tournaments.createCta": "Ustvari turnir",
    "tournaments.filters.locationLabel": "Lokacija",
    "tournaments.filters.locationPlaceholder": "npr. Ljubljana",
    "tournaments.filters.priceLabel": "Kotizacija (€)",
    "tournaments.filters.repassageLabel": "Repasaž (€)",
    "tournaments.filters.priceFromPlaceholder": "od",
    "tournaments.filters.priceToPlaceholder": "do",
    "tournaments.filters.radiusLabel": "V krogu:",
    "tournaments.filters.radiusAll": "Vse",
    "tournaments.filters.clearAll": "Počisti vse",
    "tournaments.filters.clearAllTitleActive": "Počisti vse filtre",
    "tournaments.filters.clearAllTitleInactive": "Ni aktivnih filtrov",

    "tournaments.sort.label": "Razvrsti:",
    "tournaments.sort.dateAsc": "Najprej najzgodnejši",
    "tournaments.sort.dateDesc": "Najprej najpoznejši",
    "tournaments.sort.priceAsc": "Najprej najcenejši",
    "tournaments.sort.popular": "Najbolj priljubljeni",
    "tournaments.sort.nameAsc": "Po abecedi",
    "tournaments.sort.distanceAsc": "Najprej najbližji",

    "tournaments.view.label": "Prikaz turnirjev",
    "tournaments.view.grid": "Mreža",
    "tournaments.view.list": "Seznam",

    "tournaments.card.fillLabel": "Zasedenost",
    "tournaments.card.entryFeeLabel": "kotizacija",
    "tournaments.card.repassageLabel": "repasaž",
    "tournaments.card.freeEntry": "Brezplačno",
    "tournaments.card.noWinner": "Zmagovalec ni vpisan",

    "tournaments.empty.upcomingErrorTitle": "Turnirjev ni mogoče naložiti",
    "tournaments.empty.upcomingEmptyTitle": "Ni prihajajočih turnirjev",
    "tournaments.empty.upcomingEmptyDescription": "Ustvari turnir in začni sprejemati prijave parov.",
    "tournaments.empty.noneNearbyTitle": "Ni turnirjev v bližini",
    "tournaments.empty.noneNearbyDescription":
        "Noben prihajajoči turnir ni znotraj {radius} km od tebe. Povečaj radij ali prikaži vse razdalje.",
    "tournaments.empty.widenRadius": "Povečaj radij",
    "tournaments.empty.disableNearMe": "Prikaži vse razdalje",
    "tournaments.empty.noResultsTitle": "Ni rezultatov",
    "tournaments.empty.noResultsDescription": "Noben turnir ne ustreza izbranim filtrom.",
    "tournaments.empty.clearFilters": "Počisti filtre",

    "tournaments.missingLocation.one":
        "{n} turnir nima vnesene lokacije, zato ni prikazan v filtru razdalje.",
    "tournaments.missingLocation.two":
        "{n} turnirja nimata vnesene lokacije, zato nista prikazana v filtru razdalje.",
    "tournaments.missingLocation.few":
        "{n} turnirji nimajo vnesene lokacije, zato niso prikazani v filtru razdalje.",
    "tournaments.missingLocation.other":
        "{n} turnirjev nima vnesene lokacije, zato niso prikazani v filtru razdalje.",

    "tournaments.finishedHeading": "Zaključeni turnirji",
    "tournaments.empty.finishedErrorTitle": "Zaključenih turnirjev ni mogoče naložiti",
    "tournaments.empty.finishedEmptyTitle": "Še ni zaključenih turnirjev",
    "tournaments.empty.finishedEmptyDescription": "Zaključeni turnirji se bodo pojavili tukaj.",
    "tournaments.loadMore": "Naloži več ({count})",

    "tournaments.loadErrorFallback": "Nalaganje turnirjev ni uspelo.",
    "tournaments.loadFinishedErrorFallback": "Nalaganje zaključenih turnirjev ni uspelo.",

    // ═══════════════════════ CalendarPage ═══════════════════════
    "calendar.prevMonth": "Prejšnji mesec",
    "calendar.nextMonth": "Naslednji mesec",
    "calendar.today": "Danes",
    "calendar.moreCount": "+{n} več",

    "calendar.title": "Koledar turnirjev",

    "calendar.seo.title": "Koledar Bela turnirjev — bela-turniri.com",
    "calendar.seo.description":
        "Koledar vseh prihajajočih Bela turnirjev na Hrvaškem in v regiji. Naroči se in turnirji pridejo naravnost v tvoj koledar.",
    "calendar.seo.ogTitle": "Koledar Bela turnirjev",
    "calendar.seo.ogDescription": "Vsi prihajajoči Bela turnirji na enem mestu.",

    "calendar.view.label": "Prikaz koledarja",
    "calendar.view.agenda": "Seznam",
    "calendar.view.month": "Mesec",

    "calendar.upcomingCount.one": "{n} prihajajoč turnir",
    "calendar.upcomingCount.two": "{n} prihajajoča turnirja",
    "calendar.upcomingCount.few": "{n} prihajajoči turnirji",
    "calendar.upcomingCount.other": "{n} prihajajočih turnirjev",

    "calendar.monthCount.one": "{n} turnir",
    "calendar.monthCount.two": "{n} turnirja",
    "calendar.monthCount.few": "{n} turnirji",
    "calendar.monthCount.other": "{n} turnirjev",

    "calendar.moreMonths.one": "Prikaži še {n} mesec",
    "calendar.moreMonths.two": "Prikaži še {n} meseca",
    "calendar.moreMonths.few": "Prikaži še {n} mesece",
    "calendar.moreMonths.other": "Prikaži še {n} mesecev",

    "calendar.emptyAgenda.title": "Ni napovedanih turnirjev",
    "calendar.emptyAgenda.description":
        "Takoj ko kdo objavi nov turnir, se bo pojavil tukaj. Naroči se na koledar in pride samodejno.",
    "calendar.emptyAgenda.cta": "Poglej vse turnirje",
    "calendar.emptyMonth.title": "Ta mesec ni turnirjev",
    "calendar.emptyMonth.description":
        "Prazen mesec je običajen — turnirji se napovedujejo nekaj tednov vnaprej.",
    "calendar.emptyMonth.jump": "Skoči na {month}",
    "calendar.emptyMonth.noneAhead": "V nobenem drugem mesecu ni napovedanih turnirjev.",

    "calendar.day.selectAria": "Prikaži turnirje za {date}",
    "calendar.day.none": "Na ta dan ni turnirjev.",

    "calendar.openOnMap": "Prikaži na zemljevidu",
    "calendar.openOnMapAria": "Prikaži turnir {name} na zemljevidu",

    "calendar.nearMe.nearBadge": "blizu",

    "calendar.loadErrorFallback": "Nalaganje turnirjev ni uspelo.",

    "calendar.month.jan": "Januar",
    "calendar.month.feb": "Februar",
    "calendar.month.mar": "Marec",
    "calendar.month.apr": "April",
    "calendar.month.may": "Maj",
    "calendar.month.jun": "Junij",
    "calendar.month.jul": "Julij",
    "calendar.month.aug": "Avgust",
    "calendar.month.sep": "September",
    "calendar.month.oct": "Oktober",
    "calendar.month.nov": "November",
    "calendar.month.dec": "December",
    "calendar.weekday.mon": "PON",
    "calendar.weekday.tue": "TOR",
    "calendar.weekday.wed": "SRE",
    "calendar.weekday.thu": "ČET",
    "calendar.weekday.fri": "PET",
    "calendar.weekday.sat": "SOB",
    "calendar.weekday.sun": "NED",

    // ═══════════════════════ MapPage ═══════════════════════
    "map.loadErrorFallback": "Nalaganje turnirjev ni uspelo.",

    "map.seo.title": "Zemljevid Bela turnirjev — bela-turniri.com",
    "map.seo.description":
        "Zemljevid vseh prihajajočih Bela turnirjev na Hrvaškem in v regiji. Poišči turnirje v svoji bližini in poglej, kako daleč so.",
    "map.seo.ogTitle": "Zemljevid Bela turnirjev",
    "map.seo.ogDescription": "Prihajajoči Bela turnirji na zemljevidu — poišči tiste v svoji bližini.",
    "map.radiusLabel": "V krogu:",
    "map.radiusAll": "Vse",
    "map.hiddenByRadius": "({n} zunaj kroga)",
    "map.hideLocation": "Skrij mojo lokacijo",
    "map.showLocation": "Prikaži mojo lokacijo",
    "map.locationDenied": "Dostop do lokacije je zavrnjen. Lahko ga pozneje vklopiš v nastavitvah brskalnika.",
    "map.locationUnsupported": "Tvoj brskalnik ne podpira geolokacije.",
    "map.bucket.thisWeek": "Ta teden",
    "map.bucket.nextWeek": "Do naslednje nedelje",
    "map.bucket.beyond": "Kmalu",
    "map.popup.yourLocation": "Tvoja lokacija",
    "map.popup.entryPriceLabel": "Kotizacija:",
    "map.popup.repassagePriceLabel": "Repasaž:",
    "map.popup.moreDetails": "Več podrobnosti →",

    // --- Tournament list beside the map (desktop sidebar / mobile list below) --
    "map.list.count.one": "{n} turnir na zemljevidu",
    "map.list.count.two": "{n} turnirja na zemljevidu",
    "map.list.count.few": "{n} turnirji na zemljevidu",
    "map.list.count.other": "{n} turnirjev na zemljevidu",
    "map.list.clearSelection": "Počisti izbiro",
    "map.list.emptyNoResults": "V tem krogu ni turnirjev. Poskusi povečati radij.",
    "map.list.emptyNone": "Ni turnirjev z vneseno lokacijo.",
    "map.list.openDetailsAria": "Podrobnosti turnirja {name}",

    // ═══════════════════════ FindPairPage ═══════════════════════
    "findPair.tournamentLabel": "Turnir",
    "findPair.form.toggleShow": "Objavi zahtevo",
    "findPair.form.titleEdit": "Uredi zahtevo",
    "findPair.form.titleCreate": "Iščem para",
    "findPair.form.noUpcomingTournaments": "Ni prihajajočih turnirjev",
    "findPair.form.tournamentLockedHelp":
        "Turnirja ni mogoče spremeniti — izbriši zahtevo in ustvari novo za drug turnir.",
    "findPair.form.nameLabel": "Tvoje ime",
    "findPair.form.namePlaceholder": "npr. Marko",
    "findPair.form.phoneLabel": "Telefonska številka",
    "findPair.form.optional": "(neobvezno)",
    "findPair.form.phonePlaceholder": "91 234 5678",
    "findPair.form.phoneCountryAria": "Klicna številka države",
    "findPair.form.phoneVisibilityHelp": "Številko vidijo samo prijavljeni igralci.",
    "findPair.form.noteLabel": "Opomba (neobvezno)",
    "findPair.form.notePlaceholder": "Izkušnje, način igranja, prevoz...",
    "findPair.form.selectTournamentError": "Izberi turnir.",
    "findPair.form.nameRequiredError": "Ime je obvezno.",
    "findPair.form.saveEditError": "Shranjevanje sprememb ni uspelo.",
    "findPair.form.createError": "Objava zahteve ni uspela.",

    "findPair.toast.matchErrorTitle": "Označevanje ni uspelo",
    "findPair.toast.deleteErrorTitle": "Brisanje ni uspelo",

    "findPair.confirmDelete.title": "Izbrišem zahtevo?",
    "findPair.confirmDelete.description": "Zahteva za parom bo trajno odstranjena s table.",

    "findPair.filters.button": "Filtri",
    "findPair.filters.toggleShow": "Prikaži filtre",
    "findPair.filters.toggleHide": "Skrij filtre",
    "findPair.filters.searchPlaceholder": "Išči po imenu, turnirju, lokaciji…",
    "findPair.filters.searchClearAria": "Počisti iskanje",
    "findPair.filters.searchShortcutTitle": "Tipkovna bližnjica za iskanje",
    "findPair.filters.statusLabel": "Status",
    "findPair.filters.statusOpen": "Aktivne",
    "findPair.filters.statusMatched": "Spareni",
    "findPair.filters.statusAll": "Vse",
    "findPair.filters.allTournaments": "Vsi turnirji",
    "findPair.filters.onlyMine": "Samo moje",
    "findPair.filters.clearAll": "Počisti vse",
    "findPair.filters.clearAllTitleActive": "Počisti vse filtre",
    "findPair.filters.clearAllTitleInactive": "Ni aktivnih filtrov",


    "findPair.stats.count.one": "{n} zahtevek",
    "findPair.stats.count.two": "{n} zahtevka",
    "findPair.stats.count.few": "{n} zahtevki",
    "findPair.stats.count.other": "{n} zahtevkov",
    "findPair.stats.countOfTotal.one": "{n} od {total} zahtevkov",
    "findPair.stats.countOfTotal.two": "{n} od {total} zahtevkov",
    "findPair.stats.countOfTotal.few": "{n} od {total} zahtevkov",
    "findPair.stats.countOfTotal.other": "{n} od {total} zahtevkov",
    "findPair.stats.activeTotal.one": "{n} aktiven skupaj",
    "findPair.stats.activeTotal.two": "{n} aktivna skupaj",
    "findPair.stats.activeTotal.few": "{n} aktivni skupaj",
    "findPair.stats.activeTotal.other": "{n} aktivnih skupaj",

    "findPair.empty.noRequestsTitle": "Še nihče ne išče para",
    "findPair.empty.noRequestsDescription":
        "Bodi prvi — objavi zahtevo in igralci, ki iščejo para, jo bodo videli tukaj.",
    "findPair.empty.noRequestsAnonDescription":
        "Objavljenih zahtev še ni. Prijavi se in objavi prvo.",
    "findPair.empty.noResultsTitle": "Ni rezultatov",
    "findPair.empty.noResultsDescription": "Nobena zahteva ne ustreza izbranim filtrom.",
    "findPair.empty.clearFilters": "Počisti filtre",

    "findPair.anonNotice":
        "Kontakti so skriti neprijavljenim obiskovalcem. Prijavi se, da vidiš številke, ki so jih igralci pustili.",

    "findPair.badge.searching": "Iščem",
    "findPair.badge.matched": "Spareni",
    "findPair.card.matchAction": "Spareno",
    "findPair.card.editAria": "Uredi zahtevo",
    "findPair.card.deleteAria": "Izbriši zahtevo",
    "findPair.card.openMapAria": "Prikaži turnir na zemljevidu",
    "findPair.card.postedAt": "Objavljeno {date}",
    "findPair.card.noPhone": "Brez številke",
    "findPair.card.phoneHiddenTitle": "Kontakti so vidni samo prijavljenim igralcem",

    "findPair.loadRequestsError": "Napaka pri pridobivanju zahtev.",

    // ═══════════════════════ ContactPage (/kontakt) ═══════════════════════
    "contact.seo.title": "Kontakt — bela-turniri.com",
    "contact.seo.description": "Pošljite nam sporočilo — vprašanja, predlogi ali prijava težave z bela turnirji.",
    "contact.seo.ogTitle": "Kontaktirajte nas — bela-turniri.com",
    "contact.seo.ogDescription": "Pošljite nam sporočilo — vprašanja, predlogi ali prijava težave.",

    "contact.title": "Kontaktirajte nas",
    "contact.intro":
        "Imate vprašanje, predlog ali ste naleteli na težavo? Pošljite nam sporočilo in odgovorili vam bomo na vaš e-naslov.",

    "contact.nameLabel": "Ime",
    "contact.namePlaceholder": "Vaše ime",
    "contact.emailLabel": "E-pošta",
    "contact.emailPlaceholder": "ime@primer.com",
    "contact.subjectLabel": "Naslov",
    "contact.subjectOptional": "(neobvezno)",
    "contact.subjectPlaceholder": "Na kratko, za kaj gre",
    "contact.messageLabel": "Sporočilo",
    "contact.messagePlaceholder": "Opišite svoje vprašanje ali težavo…",
    "contact.submit": "Pošlji sporočilo",
    "contact.sending": "Pošiljam…",

    "contact.validation.nameRequired": "Vnesite svoje ime.",
    "contact.validation.emailInvalid": "Vnesite veljaven e-naslov.",
    "contact.validation.messageRequired": "Vnesite sporočilo.",

    "contact.error.rateLimited": "V kratkem času je bilo poslanih preveč sporočil — poskusite znova čez nekaj minut.",
    "contact.error.generic": "Pošiljanje sporočila ni uspelo. Poskusite znova.",

    "contact.success.title": "Sporočilo je poslano",
    "contact.success.description": "Hvala za sporočilo — odgovorili vam bomo čim prej na navedeni e-naslov.",
    "contact.success.backLink": "Nazaj na turnirje",
}
