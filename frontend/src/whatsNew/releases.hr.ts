import type { Release } from "./releases"
import { LATEST_VERSION } from "./latestVersion"

export const releasesHr: Release[] = [
    {
        version: LATEST_VERSION,
        date: "2026-09-10",
        title: "Novosti ukratko",
        groups: [
            {
                "heading": "Online bela — uskoro",
                "accent": true,
                "sections": [
                    {
                        "title": "Igra u četvero",
                        "body": [
                            "Igraj s drugim igračima ili botovima, uz statistiku partija i pobjeda."
                        ]
                    }
                ]
            },
            {
                "heading": "Blok",
                "sections": [
                    {
                        "title": "Bodovi bez papira",
                        "body": [
                            "Automatski zbroj bodova i zvanja, praćenje dijeljenja i pravila po dogovoru. Spremi seriju na profil, podijeli rezultat uživo ili poveži blok s turnirom. Radi i bez interneta."
                        ]
                    }
                ]
            },
            {
                "heading": "Turniri",
                "sections": [
                    {
                        "title": "Lakše pronađi i prijavi se",
                        "body": [
                            "Pretraži i završene turnire po imenu i mjestu. Par prijavi bez računa, uz broj telefona."
                        ]
                    }
                ]
            },
            {
                "heading": "Aplikacija",
                "sections": [
                    {
                        "title": "Preglednije na mobitelu",
                        "body": [
                            "Kompaktnije kartice i izbornici te instalacija na telefon. Nativne iOS i Android aplikacije stižu uskoro."
                        ]
                    }
                ]
            }
        ],
    },
]
