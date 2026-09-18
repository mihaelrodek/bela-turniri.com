# BelaActivity — drop-in Live Activity view

Ovo je SwiftUI prikaz za iOS Live Activity (lock screen + Dynamic Island) online
bela partije. Widget-extension target (`BelaActivity`) u Xcodeu još ne postoji,
pa se ova datoteka za sada ne može dodati ni u jedan target — samo je
type-checkana direktno protiv iOS SDK-a (`swiftc -typecheck`, vidi bilješku na
dnu). Kad target nastane, datoteku samo povučeš unutra.

## Koraci u Xcodeu

1. Otvori `frontend/ios/App/App.xcworkspace` (ili `.xcodeproj`, ovisno što
   koristiš) u Xcodeu.
2. **File → New → Target…** → odaberi **Widget Extension**.
   - Product Name: `BelaActivity`
   - **Obavezno uključi kvačicu "Include Live Activity"**.
   - "Include Configuration App Intent" nije potreban — Live Activity nema
     korisnički konfigurabilne opcije — pa je slobodno isključi.
3. Xcode generira template s vlastitim `BelaActivityLiveActivity.swift` i
   `BelaActivityAttributes.swift` (ili sličnim imenom) unutar novog
   `BelaActivity` foldera. **Obriši oba generirana fajla** — zamjenjujemo ih
   ovim.
4. Povuci (`drag & drop`) `BelaActivityLiveActivity.swift` iz ovog foldera
   (`frontend/ios/BelaActivity-dropin/`) u grupu `BelaActivity` u Xcode
   navigatoru. U dijalogu koji se pojavi:
   - "Copy items if needed" — uključeno.
   - Target Membership — samo `BelaActivity` (ne `App`).
5. Postojeći `App/App/BelaActivityAttributes.swift` (koji već koristi
   `BelaLiveActivityPlugin` u `App` targetu) **ne premještaj i ne kopiraj** —
   umjesto toga u Xcode navigatoru klikni na taj fajl, otvori File Inspector
   (desni panel), pod **Target Membership** dodaj kvačicu za `BelaActivity`
   (uz postojeću za `App`). Time oba targeta dijele točno istu definiciju
   `BelaActivityAttributes`/`ContentState` — ActivityKit to zahtijeva da bi
   push-driven update uopće dekodirao stanje.
6. Postavi deployment target `BelaActivity` extensiona na **iOS 16.2** (Project
   → target `BelaActivity` → General → Minimum Deployments), isto kao i
   `App` target — Live Activity API ispod 16.1/16.2 ionako ne radi.
7. Dodaj **istu App Group** i `App` i `BelaActivity` targetu (Signing &
   Capabilities → + Capability → App Groups → isti identifier na oba, npr.
   `group.hr.mrodek.belaturniri`). Bez toga extension ne može dijeliti podatke
   s app targetom ako to ikad zatreba (trenutno komunikacija ide isključivo
   preko ActivityKit-a, ali App Group je standardna priprema za widget
   extensione i vjerojatno će zatrebati).
8. Build. Ako Xcode zapne na duplikatu simbola `BelaActivityAttributes`,
   provjeri da stari generirani stub iz koraka 3 stvarno više ne postoji u
   projektu (obrisan iz diska, ne samo uklonjen iz targeta).

## Pregled u Xcode canvasu

Datoteka na dnu ima dva `#Preview` bloka (`"Tvoj red"` i `"Kraj igre"`),
oba iza `#if DEBUG`. Kad je fajl dio `BelaActivity` targeta:

- Otvori `BelaActivityLiveActivity.swift`, otvori Canvas (**Editor → Canvas**,
  ili `⌥⌘↩`).
- Xcode prikazuje oba stanja kao zasebne preglede lock-screen izgleda.
  Dynamic Island (compact/expanded/minimal) canvas preview trenutno ne
  podržava izravno — za to je najpouzdanije pokrenuti Live Activity na
  stvarnom simulatoru/uređaju iz `App` targeta (Simulate Dynamic Island u
  Xcode Debug baru, ili scheme koja pokreće `BelaActivity` extension).
- `#Preview(as: .content, using:)` makro zahtijeva Xcode s iOS 17 SDK-om
  (vidi bilješku u kodu) — canvas ionako uvijek pregledava na trenutnom
  simulatoru, pa to ne diže stvarni deployment target extensiona.

## Napomena o dizajnu

Sve stringove drži jedan `enum L10n` na vrhu datoteke (widget extension ne
dijeli `frontend/src/i18n` rječnike s web appom, pa je hrvatski hard-kodiran
namjerno). Boje su iz brand palete (`felt green #2F8F52`, `deep #1E5C36`,
`mađarice red #B4342A`, `gold #D9A521`, `cream #F6EFE0`).

Adut (`trump`) je engine `Suit` ("HERC"/"KARA"/"PIK"/"TREF"), prikazan kao
mađarička boja: HERC → srce (`heart.fill`, crvena), KARA → bundeva
(`bell.fill`, zlatna), PIK → list (`leaf.fill`, zelena), TREF → žir — SF
Symbols nema simbol žira, pa je to ručno nacrtan oblik (kapica + zrno).
