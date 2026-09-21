import type { Release } from "./releases"
import { LATEST_VERSION } from "./latestVersion"

export const releasesHr: Release[] = [
    {
        version: LATEST_VERSION,
        date: "2026-09-21",
        title: "Novi izgled i pametniji botovi",
        groups: [
            {
                heading: "Aplikacija",
                area: "general",
                sections: [
                    {
                        title: "Novi izgled",
                        body: [
                            "Potpuno redizajnirano sučelje — nova tema, boje i tipografija, u svijetloj i tamnoj varijanti."
                        ],
                    },
                ],
            },
            {
                heading: "Bela Online",
                area: "game",
                sections: [
                    {
                        title: "Zvuk i animacije",
                        bullets: true,
                        body: [
                            "Novi zvukovi u igri.",
                            "Nove animacije dijeljenja karata i otkrivanja talona.",
                            "Bodovi se sada prelijevaju u ukupni rezultat uz animaciju.",
                            "Nove animacije i u predvorju.",
                        ],
                    },
                    {
                        title: "Pametniji botovi",
                        body: [
                            "Botovi sada zovu i igraju pametnije."
                        ],
                    },
                ],
            },
        ],
    },
    {
        version: "v3",
        date: "2026-09-18",
        title: "Bela Online je uživo",
        groups: [
            {
                heading: "Bela Online",
                area: "game",
                sections: [
                    {
                        title: "Od sad igraj belu uživo!",
                        body: [
                            "Bela Online je uživo.",
                            "Još poboljšanja stižu uskoro.",
                        ],
                    },
                ],
            },
        ],
    },
    {
        version: "v3",
        date: "2026-09-10",
        title: "Novosti ukratko",
        groups: [
            {
                "heading": "Online bela — uskoro",
                "area": "game",
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
                "area": "blok",
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
                "area": "tournaments",
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
                "area": "general",
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
