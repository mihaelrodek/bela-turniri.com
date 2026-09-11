/* `whatsNew` — UI chrome for the "Novosti" (what's new) floating button and
   its release-notes dialog (`src/whatsNew/`).

   Only the CHROME lives here (chip labels, aria-labels, the footer's page
   counter). The actual release prose — version numbers, page headings,
   section bodies — is data, not UI text, and lives in
   `src/whatsNew/releases.hr.ts` / `releases.sl.ts` instead (see the header
   comment there for why). Hrvatski je izvor istine: oblik ove datoteke
   definira što `src/i18n/sl/whatsNew.ts` mora imati.

   `{n}` / `{total}` are interpolated via the app's `{placeholder}` engine —
   see `src/i18n/index.ts`. Not a counted noun phrase (it's a slash-separated
   position, "1 / 4", not "1 stranica"), so no plural family here. */

export const whatsNew = {
    "fab.ariaLabel": "Novosti",
    "dialog.badge": "NOVOSTI",
    "dialog.closeAria": "Zatvori",
    "dialog.closeCta": "Zatvori",
}
