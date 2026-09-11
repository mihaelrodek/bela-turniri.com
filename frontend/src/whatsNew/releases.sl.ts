import type { Release } from "./releases"
import { LATEST_VERSION } from "./latestVersion"

export const releasesSl: Release[] = [
    {
        version: LATEST_VERSION,
        date: "2026-09-10",
        title: "Novosti na kratko",
        groups: [
            {
                "heading": "Spletna bela — kmalu",
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
