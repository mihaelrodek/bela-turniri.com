import type { Release } from "./releases"
import { LATEST_VERSION } from "./latestVersion"

export const releasesEn: Release[] = [
    {
        version: LATEST_VERSION,
        date: "2026-09-21",
        title: "New look and smarter bots",
        groups: [
            {
                heading: "App",
                area: "general",
                sections: [
                    {
                        title: "New look",
                        body: [
                            "Completely redesigned interface — new theme, colors, and typography, in light and dark modes."
                        ],
                    },
                ],
            },
            {
                heading: "Bela Online",
                area: "game",
                sections: [
                    {
                        title: "Sound and animations",
                        bullets: true,
                        body: [
                            "New sounds in the game.",
                            "New animations for dealing cards and revealing the talon.",
                            "Points now flow into the total score with animation.",
                            "New animations in the lobby too.",
                        ],
                    },
                    {
                        title: "Smarter bots",
                        body: [
                            "Bots now call and play more intelligently."
                        ],
                    },
                ],
            },
        ],
    },
    {
        version: "v3",
        date: "2026-09-18",
        title: "Bela Online is live",
        groups: [
            {
                heading: "Bela Online",
                area: "game",
                sections: [
                    {
                        title: "Play Bela live now!",
                        body: [
                            "Bela Online is live.",
                            "More improvements coming soon.",
                        ],
                    },
                ],
            },
        ],
    },
    {
        version: "v3",
        date: "2026-09-10",
        title: "What's new in a nutshell",
        groups: [
            {
                heading: "Bela online — coming soon",
                area: "game",
                accent: true,
                sections: [
                    {
                        title: "Four-player game",
                        body: [
                            "Play with other players or bots, with game and win statistics."
                        ]
                    }
                ]
            },
            {
                heading: "Score pad",
                area: "blok",
                sections: [
                    {
                        title: "Points without paper",
                        body: [
                            "Automatic scoring and declarations, track deals and house rules. Save games to your profile, share results live or link the score pad with a tournament. Works offline too."
                        ]
                    }
                ]
            },
            {
                heading: "Tournaments",
                area: "tournaments",
                sections: [
                    {
                        title: "Find and register more easily",
                        body: [
                            "Search finished tournaments too by name and location. Register a pair without an account, just a phone number."
                        ]
                    }
                ]
            },
            {
                heading: "App",
                area: "general",
                sections: [
                    {
                        title: "Cleaner on mobile",
                        body: [
                            "More compact cards and menus, plus install on your phone. Native iOS and Android apps coming soon."
                        ]
                    }
                ]
            }
        ],
    },
]
