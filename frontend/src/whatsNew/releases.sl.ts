import type { Release } from "./releases"
import { LATEST_VERSION } from "./latestVersion"

export const releasesSl: Release[] = [
    {
        version: LATEST_VERSION,
        date: "2026-09-21",
        title: "Nova podoba in pametnejši boti",
        groups: [
            {
                heading: "Aplikacija",
                area: "general",
                sections: [
                    {
                        title: "Nova podoba",
                        body: [
                            "Popolnoma prenovljen vmesnik — nova tema, barve in tipografija, v svetli in temni različici."
                        ],
                    },
                ],
            },
            {
                heading: "Bela Online",
                area: "game",
                sections: [
                    {
                        title: "Zvok in animacije",
                        bullets: true,
                        body: [
                            "Novi zvoki v igri.",
                            "Nove animacije delitve kart in odkrivanja talona.",
                            "Točke se zdaj prelivajo v skupni rezultat z animacijo.",
                            "Nove animacije tudi v predverju.",
                        ],
                    },
                    {
                        title: "Pametnejši boti",
                        body: [
                            "Boti zdaj bolj pametno napovedujejo in igrajo."
                        ],
                    },
                ],
            },
        ],
    },
    {
        version: "v3",
        date: "2026-09-18",
        title: "Bela Online je v živo",
        groups: [
            {
                heading: "Bela Online",
                area: "game",
                sections: [
                    {
                        title: "Igra je na voljo",
                        body: [
                            "Bela Online je v živo.",
                            "Kmalu prihaja še več izboljšav.",
                        ],
                    },
                ],
            },
        ],
    },
    {
        version: "v3",
        date: "2026-09-10",
        title: "Novosti na kratko",
        groups: [
            {
                "heading": "Spletna bela — kmalu",
                "area": "game",
                "accent": true,
                "sections": [
                    {
                        "title": "Igra v štiri",
                        "body": [
                            "Igraj z drugimi igralci ali boti, s statistiko partij in zmag."
                        ]
                    }
                ]
            },
            {
                "heading": "Blok",
                "area": "blok",
                "sections": [
                    {
                        "title": "Točke brez papirja",
                        "body": [
                            "Samodejni seštevek točk in napovedi, spremljanje delitve in pravila po dogovoru. Shrani serijo na profil, deli rezultat v živo ali poveži blok s turnirjem. Deluje tudi brez interneta."
                        ]
                    }
                ]
            },
            {
                "heading": "Turnirji",
                "area": "tournaments",
                "sections": [
                    {
                        "title": "Lažje iskanje in prijava",
                        "body": [
                            "Poišči tudi končane turnirje po imenu in kraju. Par prijavi brez računa, s telefonsko številko."
                        ]
                    }
                ]
            },
            {
                "heading": "Aplikacija",
                "area": "general",
                "sections": [
                    {
                        "title": "Pregledneje na telefonu",
                        "body": [
                            "Bolj strnjene kartice in meniji ter namestitev na telefon. Nativni aplikaciji za iOS in Android prihajata kmalu."
                        ]
                    }
                ]
            }
        ],
    },
]
