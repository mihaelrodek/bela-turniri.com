import type { LegalDict } from "../hr/legal"

/* English `legal`. Typed as the Croatian namespace, so a dropped or
   misspelled key fails `tsc` instead of silently falling back at runtime.
   Full translation of the Privacy/Terms prose — not a stub — reviewed for
   sense against the Croatian source paragraph by paragraph. Should still
   get a native-speaker legal review before being treated as final. */

export const legal: LegalDict = {
    // ═══════════════════════ PrivacyPage (/privatnost) ═══════════════════════
    "privacy.documentTitle": "Privacy Policy — bela-turniri.com",
    "privacy.documentDescription":
        "Privacy Policy for bela-turniri.com: what data we collect, why we process it, and what rights you have.",
    "privacy.title": "Privacy Policy",
    "privacy.lastUpdated": "Last updated: September 13, 2026.",
    "privacy.intro":
        "This document describes what personal data we collect through bela-turniri.com and our mobile apps, the purposes for which we process it, and what rights you have regarding it.",

    "privacy.controller.heading": "Data controller",
    "privacy.controller.body":
        "The controller of personal data collected through this site is the owner of bela-turniri.com. For any questions, requests, or complaints about the processing of personal data, contact us through the contact form.",

    "privacy.dataCollected.heading": "What data we collect",
    "privacy.dataCollected.intro":
        "As part of running the site and mobile apps, we collect and process the following categories of data:",
    "privacy.dataCollected.item.account":
        "Account data — you sign in through Firebase Authentication using email and password, a Google account, or (on iOS devices) Apple ID; we store your email, name, and unique user identifier (UID).",
    "privacy.dataCollected.item.profile":
        "Profile data — your publicly shown name, profile URL (slug), optional phone number and country, optional profile photo (stored on our own object storage server (MinIO), not with a third party), an optional chosen cartoon avatar, your username for online Bela (Belot), and your chosen language and interface theme.",
    "privacy.dataCollected.item.tournament":
        "Tournament data — the tournament name, poster, location, and price list entered by the organizer, plus pair names. An anonymous pair registration (without signing in) also collects a contact phone number that is visible only to the tournament organizer, and generates a unique claim link for that pair.",
    "privacy.dataCollected.item.media":
        "Photos and posters — tournament posters and profile photos are stored on an object storage server (MinIO) on the site operator's infrastructure.",
    "privacy.dataCollected.item.location":
        "Device location — the \"tournaments nearby\" feature, at your request, retrieves your device's approximate (city-level) location and uses it only locally, on the device, to sort and filter the tournament list; this location is never sent to our server.",
    "privacy.dataCollected.item.addressSearch":
        "Address search — when an organizer types a tournament address, the entered address text is sent to an address search provider: Google Places (when enabled by the operator) or the public OpenStreetMap Nominatim service.",
    "privacy.dataCollected.item.mapTiles":
        "Map — map tiles are fetched from CARTO or OpenFreeMap; each such request reveals to those services the approximate map area you're viewing and your IP address.",
    "privacy.dataCollected.item.push":
        "Push notifications — if you allow notifications, we store a technical subscription: the Web Push subscription address (endpoint) in your browser, or a Firebase Cloud Messaging (FCM) device token in the mobile apps, and, during an online game, a token for Live Activity (iOS) or Android Live Update. We delete the token when you turn off notifications, when the sending server reports the token as invalid, or when your account is deleted.",
    "privacy.dataCollected.item.game":
        "Game data — waiter access codes, drink bills, and match results entered by organizers and waiters during a tournament.",
    "privacy.dataCollected.item.onlineGame":
        "Online Bela — if you play online Bela, game results and statistics are stored with your account. If you play as a guest, an anonymous identifier is assigned and stored locally in the browser, and on iOS devices in the Keychain, so the identifier survives a reinstall of the app. You can change the name you use in the game at most once every 7 days.",
    "privacy.dataCollected.item.analytics":
        "Analytics — we use Google Analytics 4 only on the bela-turniri.com website, and only after you give consent via the consent banner; analytics isn't used in the mobile apps.",
    "privacy.dataCollected.item.logs":
        "Server logs — the server logs your IP address and a request identifier (request ID) for security and troubleshooting.",
    "privacy.dataCollected.item.device":
        "Data on your device — local storage (localStorage) and the offline cache are kept only on your device.",
    "privacy.dataCollected.item.contactForm":
        "Contact form — name, email, subject, message, and your IP address. We delete the IP address no later than 30 days after receiving the message, and the full message no later than 12 months after receiving it.",
    "privacy.dataCollected.item.reports":
        "Reports and blocks — when you report a tournament, pair, or profile, we store the reason for the report, your optional message, and your account identifier as the reporter, until the report is resolved. Blocking another user is stored with your account to enforce the block; reports are reviewed by the site operator.",

    "privacy.purpose.heading": "Purpose and legal basis for processing",
    "privacy.purpose.body1":
        "We process data to provide the service you requested (performance of a contract) — registering, organizing, and following Bela tournaments, registering pairs, tracking results and drink bills, and playing online Bela.",
    "privacy.purpose.body2":
        "Push notifications and analytics are processed based on your consent, which you can withdraw at any time.",
    "privacy.purpose.body3":
        "Server logs and security measures are based on our legitimate interest in the security and stable operation of the site.",
    "privacy.purpose.body4":
        "We base the processing of reports and user blocks on our legitimate interest in community safety and preventing abuse.",

    "privacy.recipients.heading": "Who has access to the data",
    "privacy.recipients.body1":
        "For authentication we use Firebase Authentication (Google Ireland Ltd. / Google LLC) and, on iOS devices, Sign in with Apple (Apple Inc.); these providers process your sign-in data in accordance with their own privacy policies.",
    "privacy.recipients.body2":
        "For address search and geocoding we use, depending on configuration, Google Places (Google Ireland Ltd. / Google LLC) or the public OpenStreetMap Nominatim service; we send these services only the entered address text, with no other personal data.",
    "privacy.recipients.body3":
        "To display the map we use the map-tile providers CARTO or OpenFreeMap, which learn your IP address and the approximate displayed area each time the map is shown.",
    "privacy.recipients.body4":
        "To send push notifications we use standard browser services (Web Push), Firebase Cloud Messaging (Google), and, for iOS Live Activity and Android Live Update, the corresponding device manufacturer and operating system services.",
    "privacy.recipients.body5":
        "The site is hosted on a server run by the site operator; data isn't sold or shared with third parties for marketing purposes.",
    "privacy.recipients.body6":
        "Public tournament and player profile pages are available to everyone on the internet and can be indexed by search engines (e.g., Google) — only publish data you're willing to make public.",

    "privacy.retention.heading": "How long we keep data",
    "privacy.retention.body":
        "We keep data for as long as your account is active or as long as there's a legitimate purpose for keeping it (e.g., tournament history). After account deletion or at your request, we delete or anonymize personal data within a reasonable period, unless a longer retention period is required by law.",
    "privacy.retention.body2":
        "Exceptions with specific deadlines: the IP address from the contact form is deleted no later than 30 days after the message is received, and the full message no later than 12 months after receipt; user reports are kept until resolved.",

    "privacy.accountDeletion.heading": "Account deletion",
    "privacy.accountDeletion.body1":
        "You can start deleting your account yourself, at any time, on the profile page via the \"Delete account\" option.",
    "privacy.accountDeletion.body2":
        "Deletion means anonymization: we remove your profile data, photo, phone number, settings, saved score pad history, and push subscriptions, and your Firebase account is deleted.",
    "privacy.accountDeletion.body3":
        "Tournaments you organized and results involving other players are kept, labeled \"Deleted user\" instead of your name — because other players' data and tournament history must remain intact.",

    "privacy.accountDeletion.pageLink": "Detailed instructions and a list of data: Account deletion",

    "privacy.rights.heading": "Your rights",
    "privacy.rights.body1":
        "You have the right to access, correct, and delete your personal data, as well as to restrict processing, object to processing, and data portability.",
    "privacy.rights.body2":
        "You can review and change most data yourself in your profile settings, and delete your account via the \"Delete account\" option on the profile page. For other requests, contact us through the contact form.",
    "privacy.rights.body3":
        "If you believe your data is being processed in violation of the regulations, you have the right to file a complaint with the competent data protection supervisory authority.",

    "privacy.cookies.heading": "Cookies and local storage",
    "privacy.cookies.body1":
        "The site uses browser local storage (localStorage) to remember settings (language, theme) and to cache data for faster performance and partial offline use.",
    "privacy.cookies.body2":
        "We set analytics cookies (Google Analytics 4) only on the website, and only after you give consent via the consent banner; you can change your choice at any time. The mobile apps don't use analytics or cookies.",

    "privacy.children.heading": "Children",
    "privacy.children.body":
        "The service isn't intended for people under 16. If you're under 16, you may only use the site and apps with the consent and supervision of a parent or guardian.",

    "privacy.changes.heading": "Changes to this Privacy Policy",
    "privacy.changes.body":
        "We may update this Privacy Policy from time to time. We'll notify users of significant changes on this page; the date of the last update is shown at the top of the page.",

    // ═══════════════════════ TermsPage (/uvjeti) ═══════════════════════
    "terms.documentTitle": "Terms of Use — bela-turniri.com",
    "terms.documentDescription": "Terms of Use for bela-turniri.com.",
    "terms.title": "Terms of Use",
    "terms.lastUpdated": "Last updated: September 13, 2026.",
    "terms.intro":
        "By using bela-turniri.com and our mobile apps, you agree to these Terms of Use. If you don't agree with them, please don't use the service.",

    "terms.service.heading": "Description of the service",
    "terms.service.body":
        "bela-turniri.com is a free platform for organizing Bela (Belot) tournaments: registering and browsing tournaments, registering pairs, drawing rounds, entering results, tallying drink bills, public player profiles, and online Bela.",

    "terms.accounts.heading": "Accounts",
    "terms.accounts.body1":
        "Certain actions (e.g., creating a tournament, registering a pair) require a user account via Firebase sign-in (email and password, a Google account, or, on iOS devices, Apple ID).",
    "terms.accounts.body2":
        "You're responsible for the accuracy of the data you enter and for safeguarding your account credentials.",
    "terms.accounts.body3":
        "You can delete your account at any time via the \"Delete account\" option on the profile page; what happens to your data is described in the Privacy Policy.",

    "terms.organiserContent.heading": "Content entered by organizers",
    "terms.organiserContent.body1":
        "Tournament organizers independently enter data about the tournament, pairs, contact persons, and location, and bear full responsibility for the accuracy, legality, and currency of that data.",
    "terms.organiserContent.body2":
        "If an organizer enters personal data of third parties (e.g., names and phone numbers of players or contact persons), they must first obtain that person's consent and inform them about the processing of that data in accordance with personal data protection regulations.",
    "terms.organiserContent.body3":
        "A contact phone number entered during an anonymous pair registration is visible only to the tournament organizer.",

    "terms.prohibitedConduct.heading": "Prohibited conduct",
    "terms.prohibitedConduct.body":
        "It's prohibited to: enter inaccurate, offensive, or unlawful content; misuse the site's functionality (e.g., automated requests, bypassing security measures); access other users' accounts or data without authorization; file false or malicious reports against other users; or use the site for purposes contrary to its intended use.",

    "terms.reportsAndBlocking.heading": "Reports and blocking users",
    "terms.reportsAndBlocking.body":
        "Users can report a tournament, pair, or profile that violates these terms, providing a reason and an optional message, and can block other users. Reports are reviewed by the site operator, who takes appropriate action as needed, including account termination as described in the \"Account termination\" section.",

    "terms.onlineGame.heading": "Online Bela",
    "terms.onlineGame.body1":
        "bela-turniri.com also offers online Bela, in which game results and statistics are stored with your account or, if you play as a guest, with an anonymous device identifier.",
    "terms.onlineGame.body2":
        "The game doesn't include in-app purchases or playing for money or any other property value — it's played purely for fun and to keep statistics.",

    "terms.payments.heading": "Payments",
    "terms.payments.body":
        "The app doesn't offer in-app purchases or games for money. The drink price list and bills within a tournament are used only to track drink consumption at the tournament venue and don't constitute a payment transaction within the app.",

    "terms.ip.heading": "Intellectual property",
    "terms.ip.body":
        "The name, logo, design, and source code of bela-turniri.com are owned by the site operator or used under appropriate license, and may not be copied or used without prior consent. Content entered by users remains their property, with the operator having the right to display it as part of the service.",

    "terms.liability.heading": "Limitation of liability",
    "terms.liability.body":
        "The service is provided \"as is\" and \"as available\", without warranties of any kind. The site operator isn't liable for damage arising from use or inability to use the service, inaccurate data entered by organizers, or interruptions caused by external services (e.g., Firebase, OpenStreetMap).",

    "terms.termination.heading": "Account termination",
    "terms.termination.body":
        "We reserve the right to suspend or terminate access to an account that violates these terms, without prior notice, particularly in cases of abuse, entering unlawful content, or maliciously reporting other users. A user can delete their own account via the \"Delete account\" option on the profile page, or request deletion through the contact form.",

    "terms.governingLaw.heading": "Governing law",
    "terms.governingLaw.body":
        "These terms are governed by the law of the Republic of Croatia (Republika Hrvatska). Any disputes will be resolved before the competent court in Croatia.",

    "terms.changes.heading": "Changes to these terms",
    "terms.changes.body":
        "We may change these terms from time to time. Continuing to use the site after changes are published means you agree to them; the date of the last update is shown at the top of the page.",

    "terms.contact.heading": "Contact",
    "terms.contact.body": "For any questions about these terms, contact us through the contact form.",

    // ═════════════════ AccountDeletionPage (/brisanje-racuna) ═════════════════
    "deletion.documentTitle": "Account deletion — {site}",
    "deletion.documentDescription":
        "How to delete your user account on {site}: what data is deleted, what stays, and how to request deletion without the app installed.",
    "deletion.title": "Account deletion",
    "deletion.lastUpdated": "Last updated: September 20, 2026.",
    "deletion.intro":
        "This page explains how to delete your user account on {site}, what data is deleted in the process, what stays and why, and how to request deletion if you don't have the app installed.",

    "deletion.inApp.heading": "Deleting in the app",
    "deletion.inApp.intro":
        "You can delete your account yourself, at any time, without contacting us:",
    "deletion.inApp.step1": "Sign in to the app.",
    "deletion.inApp.step2":
        "Open your profile and select the \"Settings\" tab.",
    "deletion.inApp.step3":
        "At the bottom of that tab is the \"Delete account\" section — tap the \"Delete account\" button.",
    "deletion.inApp.step4":
        "In the confirmation dialog, type the word DELETE and confirm. Deletion happens immediately and can't be undone.",
    "deletion.inApp.apple":
        "If you sign in with Apple ID, when you delete your account we'll ask you to sign in with Apple once more, so we can revoke the app's access with Apple. Your account then also disappears from the \"Sign in with Apple\" list in your device settings.",

    "deletion.noApp.heading": "Deleting without the app",
    "deletion.noApp.body1":
        "The same process works in a regular web browser too, with no installation needed: open {origin}, sign in, and follow the steps above.",
    "deletion.noApp.linkLabel": "Sign in and open your profile",
    "deletion.noApp.body2":
        "If you can no longer sign in (lost access to your email or device), send us a request through the contact form and give us the email the account was opened with. We handle requests within 30 days at the latest; before deleting we may ask you to confirm the account is really yours.",
    "deletion.noApp.contactLabel": "Request deletion through the contact form",

    "deletion.deleted.heading": "What gets deleted",
    "deletion.deleted.item.profile":
        "Profile data — your displayed name, phone number and country, profile photo (including the file on the server), chosen avatar, language, and interface theme.",
    "deletion.deleted.item.auth":
        "Sign-in — your user record in Firebase Authentication, meaning your email and password, or your linked Google or Apple account. For Apple sign-in, we additionally revoke the access token with Apple.",
    "deletion.deleted.item.gameName":
        "Game name — the name shown at the table in online Bela.",
    "deletion.deleted.item.push":
        "Push notifications — all browser subscriptions and device tokens, so notifications stop immediately.",
    "deletion.deleted.item.blok":
        "Score pad — saved score history, both on the server and locally on the device you're deleting from.",
    "deletion.deleted.item.blocks":
        "Blocked users — the list is cleared in both directions.",
    "deletion.deleted.item.reliability":
        "Karma and records of abandoned games in online Bela.",
    "deletion.deleted.item.pairPhone":
        "The contact phone number on every pair you registered.",
    "deletion.deleted.item.pairRequests":
        "\"Looking for a partner\" posts you published, along with the name and contact number in them.",
    "deletion.deleted.item.presets":
        "Saved pairs and saved price list templates. A saved pair you share with a co-owner passes to them, since they entered half of that name too.",
    "deletion.deleted.item.device":
        "Data on the device you're deleting from — the data cache, the offline work queue, and saved waiter sessions.",

    "deletion.kept.heading": "What stays, and why",
    "deletion.kept.intro":
        "Deletion means anonymization: the person disappears, but the shared game history stays intact. After deletion your name is no longer shown anywhere — it's replaced with \"Deleted user\".",
    "deletion.kept.item.uid":
        "An empty account record with a random identifier and profile URL (slug). It's kept permanently: it's the only way old links to your profile cleanly show \"page doesn't exist\" instead of that address being inherited by someone else with the same spelled name.",
    "deletion.kept.item.tournaments":
        "Tournaments you organized and pairs you registered — without your name and phone number. Other players' results must not change just because you left.",
    "deletion.kept.item.gameResults":
        "Results of games played in online Bela, linked to that empty identifier. There are four players at the table, and their statistics must not change.",
    "deletion.kept.item.reports":
        "Content reports — kept until resolved, since this is exactly the record that must not disappear when the reported party deletes their account.",
    "deletion.kept.item.contact":
        "Messages sent through the contact form — we delete the IP address no later than 30 days after receipt, and the full message no later than 12 months after receipt.",
    "deletion.kept.item.logs":
        "Server logs (IP address and request identifier) — kept short-term, for security and troubleshooting.",
    "deletion.kept.item.guest":
        "Your guest identity, if you also played as a guest alongside your account. It's separate and not part of the account you're deleting, so it stays on the device; you remove it by clearing the site's data or uninstalling the app.",

    "deletion.timing.heading": "When deletion happens",
    "deletion.timing.body":
        "Deletion started in the app happens immediately, within the same request — there's no waiting period and no way to undo it. Database backups are kept for at most 14 days and are automatically overwritten within that period, so deleted data disappears from them too.",

    "deletion.more.heading": "More information",
    "deletion.more.body":
        "The full list of data we collect, the purposes and legal bases for processing, and your rights are described in the Privacy Policy.",
    "deletion.more.privacyLabel": "Privacy Policy",
}
