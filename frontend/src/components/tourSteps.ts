import type { Step } from "react-joyride"

/**
 * Step content for the tours running on the Turniri list and Turnir
 * detail pages. Keeping the copy in one module makes it easy to revise
 * tour wording without diving into the JSX of the actual pages.
 *
 * <p>Selector convention: all anchors use {@code [data-tour="…"]}
 * attributes (not classes / ids) so styling / refactors don't break
 * the tour by accident. Each data-tour value is declared exactly
 * once in this file.
 */

/** Steps shown on the /turniri page. Ends with a navigate-to-detail step. */
export const TURNIRI_LIST_TOUR_STEPS: Step[] = [
    {
        target: '[data-tour="turniri-upcoming"]',
        title: "Nadolazeći turniri",
        content:
            "Ovdje vidiš sve turnire koji još nisu počeli ili su u tijeku. Kartice su sortirane po datumu — najbliži je gore.",
        placement: "bottom",
        disableBeacon: true,
    },
    {
        target: '[data-tour="turniri-finished"]',
        title: "Završeni turniri",
        content:
            "Ispod nadolazećih nalaze se završeni turniri s prikazom pobjednika. Pomakni se prema dolje da ih vidiš sve.",
        placement: "top",
    },
    {
        target: '[data-tour="turniri-filters"]',
        title: "Pretraga i filteri",
        content:
            "Pretraži turnire po imenu, mjestu ili cijeni. Klizač \"U krugu od\" sužava prikaz na turnire blizu tebe.",
        placement: "bottom",
    },
    {
        target: '[data-tour="turniri-first-card"]',
        title: "Pogledajmo jedan turnir",
        content:
            "Klikni \"Dalje\" da otvorimo jedan završeni turnir i prošetamo se kroz njegove kartice.",
        placement: "bottom",
    },
]

/** Steps shown on the /turniri/{slug} page when continuing from the list tour. */
export const TURNIR_DETAIL_TOUR_STEPS: Step[] = [
    {
        target: '[data-tour="detail-tab-details"]',
        title: "Detalji turnira",
        content:
            "Kartica \"Detalji\" sadrži osnovne informacije: lokaciju, datum, kotizaciju, nagrade i kontakt organizatora.",
        placement: "bottom",
        disableBeacon: true,
    },
    {
        target: '[data-tour="detail-tab-pairs"]',
        title: "Parovi",
        content:
            "U kartici \"Parovi\" vidiš sve prijavljene parove. Pobjednik je istaknut zlatnom bojom, drugo i treće mjesto srebrnom i brončanom.",
        placement: "bottom",
    },
    {
        target: '[data-tour="detail-tab-bracket"]',
        title: "Ždrijeb",
        content:
            "Kartica \"Ždrijeb\" prikazuje sva odigrana kola s rezultatima. Klikni kolo da vidiš detaljan raspored mečeva.",
        placement: "bottom",
    },
    {
        target: '[data-tour="detail-tab-cjenik"]',
        title: "Cjenik pića",
        content:
            "Posljednja kartica je \"Cjenik\" — popis pića s cijenama koje organizator naplaćuje na turniru.",
        placement: "bottom",
    },
]

/** localStorage keys used by the tours to track whether a user has seen them. */
export const TURNIRI_LIST_TOUR_KEY = "bela-tour-seen:turniri-list"
export const TURNIR_DETAIL_TOUR_KEY = "bela-tour-seen:turnir-detail"

/**
 * sessionStorage key for the cross-page handoff. When the user reaches
 * the last step of the list tour and confirms "Dalje", we set this and
 * navigate to a finished tournament. The detail page reads it on mount
 * and auto-runs its tour as a continuation. Cleared as soon as the
 * detail tour starts so a manual refresh doesn't replay it forever.
 */
export const TOUR_RESUME_DETAIL_KEY = "bela-tour-resume:turnir-detail"
