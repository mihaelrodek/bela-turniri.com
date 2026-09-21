# bela.games — druga mobilna aplikacija

Kako iz **istog koda** napraviti i objaviti drugu, zasebnu aplikaciju koja
sadrži **samo online belu (`/igra`) i blok (`/blok`)** — bez turnira, kalendara
i karte.

| | aplikacija 1 (postojeća) | aplikacija 2 (nova) |
|---|---|---|
| domene | bela-turniri.com | **bela.games** + **belot.games** |
| appId / bundle id / applicationId | `com.belaturniri.app` | **`games.bela.app`** |
| ime na ekranu | Bela Turniri | **Bela Online** |
| native projekt | `frontend/ios`, `frontend/android` | **`frontend/ios-games`, `frontend/android-games`** |
| Vite mode | `native` (`.env.native`) | **`native-games` (`.env.native-games`)** |
| build | `npm run build:native` | **`npm run build:native:games`** |
| API / WS | `https://bela-turniri.com/api`, `wss://bela-turniri.com` | **`https://bela.games/api`, `wss://bela.games`** |

Sve je **jedan backend, jedan game server i jedan Firebase projekt** — račun
napravljen u jednoj aplikaciji radi i u drugoj, a lobi za igru je isti. Razlika
je isključivo u tome **što se prikazuje** (`frontend/src/site.ts`).

> **Dvije domene, jedna aplikacija.** `bela.games` i `belot.games` su
> **ravnopravni blizanci** — ni jedna ne preusmjerava na drugu, obje poslužuju
> isti SPA (`GAMES_DOMAINS` u `site.ts`). Nastaje **samo jedna** mobilna
> aplikacija koja **preuzima linkove obiju domena**. `bela.games` je *primarna*:
> to je `GAMES_ORIGIN`, to ide u `VITE_API_URL` / `VITE_WS_ORIGIN`, u share
> linkove koje aplikacija generira i u launcher shortcutove. `belot.games` se
> pojavljuje isključivo u konfiguraciji za preuzimanje linkova (Associated
> Domains, App Links) i u Firebase Authorized domains.
>
> Na webu je drukčije: tamo `publicOrigin` prati domenu na kojoj si, pa link
> podijeljen s belot.games kaže belot.games. Nativna ljuska nema hostname
> (`capacitor://localhost`) pa uvijek koristi primarnu.

> **Zašto ime "Bela Online", a ne "bela.games"?**
> Brend u aplikaciji i na webu ostaje `bela.games` (`siteName` u `site.ts`).
> Ali ispod ikone na početnom zaslonu i u tražilici trgovina, goli domenski
> naziv s točkom loše izgleda i loše se pretražuje. `Bela Online` ima 11 znakova
> (iOS/Android ne režu ništa do ~12), a limit imena u App Store Connectu i na
> Google Playu je 30 znakova — dakle ima mjesta i za podnaslov tipa
> `Bela Online — igraj belu`. Ako ipak želiš doslovno `bela.games`, to je jedna
> linija u `frontend/capacitor.config.ts` (`APPS.games.appName`) plus ista
> promjena u `Info.plist` / `strings.xml`.

---

## 0. Što je već napravljeno u repozitoriju

Ne treba ti ništa od ovoga raditi ručno:

- `frontend/capacitor.config.ts` — bira aplikaciju preko `CAP_APP` varijable
  okoline. Bez nje = ponaša se **točno kao dosad**. `CAP_APP=games` mijenja
  appId/appName i, što je najvažnije, `ios.path` / `android.path` tako da
  `cap sync` za jednu aplikaciju **fizički ne može** dirati projekt one druge.
- `frontend/.env.native-games` — Vite env za `--mode native-games`.
  Vite bira env datoteke **po imenu moda**, pa `--mode native-games` *ne čita*
  `.env.native`; zato je to zasebna datoteka koju treba ručno držati u koraku
  s `.env.native` kad se doda novi ključ. Tajne (npr. Google Maps ključ) idu u
  `frontend/.env.native-games.local`, koji je u `.gitignore`.
- `frontend/package.json` — skripte `build:native:games`, `cap:games:*`,
  `native:games:create`.
- `frontend/src/platform/NativeShell.tsx` — deep linkovi više nisu vezani uz
  jedan tvrdo upisani host, nego idu kroz `isGamesHost()` iz `site.ts`. Games
  aplikacija u sebi otvara `https://bela.games/igra/...` **i**
  `https://belot.games/igra/...` (te isto za `/blok/` i `/profil/`, uz `www.`
  varijante), a link na stranicu koje u njoj nema (npr. `/turniri/...`, bilo iz
  linka bilo iz push notifikacije) šalje u **sistemski preglednik** na
  bela-turniri.com umjesto da završi na 404 unutar aplikacije. Aplikacija za
  turnire je nepromijenjena — provjera `isGamesSite` osigurava da ona i dalje
  svoje `/turniri` linkove otvara u sebi.
- `frontend/scripts/create-games-native.sh` — radi `ios-games/` i
  `android-games/` iz postojećih projekata.

**Ovisnosti o drugim ljudima/agentima:** Caddy mora na **obje** domene
(`bela.games` i `belot.games`) posluživati `/api`, `/ws` i `/.well-known/*`
(istu datoteku iz `ops/well-known-games/`). Bez toga ni aplikacija ni deep
linkovi ne rade — a kod Androida je gore od toga, vidi §6.

---

## 1. Firebase Console — dvije nove aplikacije u **istom** projektu

⚠️ **Isti projekt**, ne novi. Ako napraviš novi Firebase projekt, korisnici bi
imali **drugi UID** i druge račune u dvije aplikacije — a cijela poanta je da
su isti.

1. Firebase Console → postojeći projekt → **Project settings → Your apps**.
2. **Add app → iOS**
   - Bundle ID: `games.bela.app`
   - Nadimak: `Bela Online (iOS)`
   - Preuzmi **`GoogleService-Info.plist`** →
     `frontend/ios-games/App/App/GoogleService-Info.plist`
     (dodaj ga u Xcode targetu App, "Copy items if needed", target membership ✓).
3. **Add app → Android**
   - Package name: `games.bela.app`
   - Nadimak: `Bela Online (Android)`
   - **SHA-1 i SHA-256** — obavezno za Google prijavu:
     - debug: `keytool -list -v -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android -keypass android`
     - release: SHA-256 uzmi iz **Play Console → Release → Setup → App signing
       → App signing key certificate** (Play App Signing potpisuje finalni APK
       svojim ključem, tvoj upload ključ nije taj koji korisnik dobije).
     - Oba SHA otiska dodaj na **Android aplikaciju** u Firebaseu, pa ponovno
       preuzmi `google-services.json` →
       `frontend/android-games/app/google-services.json`.
4. **APNs ključ (iOS push)** — *ne* radi novi. APNs Auth Key (.p8) vrijedi za
   cijeli Apple Developer Team, pa ga u
   **Project settings → Cloud Messaging → Apple app configuration** samo
   uploadaj **isti** ključ i za novu iOS aplikaciju (Key ID i Team ID su isti).
   Ako si ga izgubio, novi se radi na
   *developer.apple.com → Certificates, Identifiers & Profiles → Keys*.
5. **Authentication → Sign-in method** ne treba dirati — providere (Google,
   Apple, e-mail) postavljaš na razini projekta, ne po aplikaciji.
6. Za **Sign in with Apple** u Firebaseu: `Services ID` i `OAuth redirect` su
   potrebni samo za *web* tok. Nativni iOS tok ide kroz `AuthenticationServices`
   i ne treba ništa dodatno — ali pročitaj §2.3 o grupiranju.
7. **Authentication → Settings → Authorized domains** — dodaj **sva četiri**
   hostnamea games strane:
   `bela.games`, `www.bela.games`, `belot.games`, `www.belot.games`
   (uz postojeće bela-turniri.com unose). Ovo je za **web** prijavu: Firebase
   odbija `signInWithPopup` / `signInWithRedirect` s domene koje nema na
   popisu, pa bi inače Google prijava na belot.games pukla s
   `auth/unauthorized-domain`. Nativna aplikacija ne prolazi kroz taj tok, ali
   isti Firebase projekt poslužuje i web, pa popis mora biti potpun.

**Provjera:** u `Project settings → Your apps` moraju stajati **četiri**
aplikacije (2× iOS, 2× Android) unutar jednog projekta.

---

## 2. Apple Developer

### 2.1 Novi App ID

*developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → +*

- Tip: **App IDs → App**
- Description: `Bela Online`
- Bundle ID: **Explicit** → `games.bela.app`
- Capabilities (mora biti uključeno **sve troje**, inače potpisivanje pukne jer
  ih `App.entitlements` traži):
  - ✅ **Push Notifications**
  - ✅ **Associated Domains**
  - ✅ **Sign in with Apple**

### 2.2 Associated Domains — **obje** domene

`ios-games/App/App/App.entitlements` (skripta iz §3 to već napravi) sadrži
**četiri** unosa, jer Apple uspoređuje entitlement string s točnim hostnameom i
ne postoji wildcard koji pokriva dva različita apexa:

```xml
<string>applinks:bela.games</string>
<string>applinks:belot.games</string>
<string>webcredentials:bela.games</string>
<string>webcredentials:belot.games</string>
```

`www.` se **ne** navodi — isto kao kod aplikacije za turnire: `www.*` je u
Caddyju 301 na goli host, a sustav slijedi preusmjeravanje do hosta koji jest
na popisu.

Da bi to radilo, **i** `https://bela.games/.well-known/apple-app-site-association`
**i** `https://belot.games/.well-known/apple-app-site-association` moraju vraćati
**istu** datoteku iz `ops/well-known-games/`, s `TEAMID.games.bela.app`
(TEAMID je tvoj Apple Team ID, vidi gore desno u developer portalu).
Bez `/turniri/*` putanje — games aplikacija tu rutu nema.

> AASA se ne veže uz domenu iznutra — u njoj piše samo koji App ID smije
> preuzeti koje *putanje*. Zato je jedna datoteka na dvije domene točno to što
> treba, bez ikakve varijante po domeni.

### 2.3 ⚠️ Sign in with Apple — grupiranje (**ovo je najvažniji korak**)

Apple po **App ID** generira **različit `sub`** (Apple korisnički ID) za istog
korisnika. Ako `games.bela.app` **ne grupiraš** s `com.belaturniri.app`:

> Korisnik koji se u Bela Turniri aplikaciji prijavio preko Applea, pa instalira
> Bela Online i opet se prijavi preko Applea, dobit će **drugi Apple `sub`**.
> Firebase iz tog `sub`-a radi **novi identitet**, dakle **novi Firebase UID** →
> novi profil, novi `UserProfile` red, nula odigranih partija, drugi slug.
> To izgleda kao izgubljen račun i nema čistog načina da se naknadno spoji.

**Rješenje — grupiranje App ID-eva (obavezno prije prve objave):**

1. *Identifiers → **App Groups** ne, nego:*
   otvori App ID `com.belaturniri.app` → **Sign in with Apple → Edit /
   Configure** → odaberi **"Enable as a primary App ID"**.
2. Otvori novi App ID `games.bela.app` → **Sign in with Apple → Edit /
   Configure** → **"Group with an existing primary App ID"** → odaberi
   `com.belaturniri.app`.
3. Uvjet: **oba App ID-a moraju biti u istom Apple Developer Teamu** (jesu) i
   grupiranje se radi **prije** nego što se ijedan korisnik prijavi u novoj
   aplikaciji. Nakon grupiranja obje aplikacije dobivaju **isti `sub`**, pa
   Firebase vraća **isti UID** — jedan račun, dvije aplikacije.

> Grupiranje se radi samo za Sign in with Apple. Google prijava dijeli identitet
> automatski jer ide preko istog Firebase projekta i iste Google adrese, a
> e-mail/lozinka isto tako.

### 2.4 App Store Connect

- **My Apps → + → New App**
- Platform iOS, Name: `Bela Online`, Primary Language: hrvatski,
  Bundle ID: `games.bela.app`, SKU: npr. `bela-games-ios`.
- Primary Category: **Games → Card**.
  (Postojeća aplikacija je *Sports* / *Utilities* — različite kategorije su
  korisna, stvarna razlika u pozicioniranju, vidi §7.)

---

## 3. Napravi native projekte

```bash
cd frontend
npm run native:games:create          # ios-games/ + android-games/
# ili: npm run native:games:create -- --force   (briše i radi ispočetka)
# ili: bash scripts/create-games-native.sh --ios-only | --android-only
```

Skripta **kopira** `ios/` → `ios-games/` i `android/` → `android-games/` i
zatim mijenja identitet. Kopira se, a **ne** radi `cap add`, zato što bi
`cap add` dao potpuno prazan projekt i izgubio sve ručne izmjene: Sign in with
Apple i Associated Domains entitlemente, `UIBackgroundModes`, hrvatske
`NS*UsageDescription` tekstove, Live Activities, `AppDelegate`-ov zaštićeni
`FirebaseApp.configure()`, `BelaLiveActivityPlugin`, `GuestKeychainPlugin`,
`FoldablePlugin`, `BelaMessagingService` (koji `tools:node="remove"`-a plugin
servis i zamjenjuje ga svojim), FileProvider, COARSE-only lokaciju, ikone,
splash, `values-sl` prijevode i shortcutove.

Zato skripte `npm run cap:games:add:ios` / `cap:games:add:android` **postoje,
ali ih ne koristi** osim ako svjesno želiš prazan projekt od nule.

Što skripta **namjerno ne kopira** (`cap sync` to ionako ponovno napravi, a
kopija bi bila pogrešna): `build/`, `.gradle/`, `.kotlin/`, `Pods/`,
`DerivedData/`, `xcuserdata/` (Xcode sheme drugog bundle id-a!),
`local.properties`, `app/src/main/assets/`, `App/App/public/`, generirani
`capacitor.config.json` / `config.xml`, `capacitor-cordova-*-plugins/`,
te `*.jks` / `*.keystore` / `keystore.properties` (potpisni ključevi).

Što skripta **mijenja**: `PRODUCT_BUNDLE_IDENTIFIER`, `applicationId`,
`namespace`, Java/Kotlin package direktorij
(`com/belaturniri/app` → `games/bela/app`) i sve `package` deklaracije,
`CFBundleDisplayName` / `app_name` / `title_activity_main`,
`applinks:` i `webcredentials:` domene (**obje**, vidi §2.2), App Links host
(dodaje **drugi `<data ... host="belot.games">`** u *isti* intent-filter — 
Android kombinira `<data>` elemente, pa se svi path prefixi automatski odnose
na obje domene), URL-ove u `shortcuts.xml` (ostaju na primarnoj domeni: jedan
shortcut treba jedan konkretan URL), te `custom_url_scheme` i `package_name`
u `strings.xml`.
Briše `DEVELOPMENT_TEAM` / `PROVISIONING_PROFILE_SPECIFIER` iz pbxproj-a (da
nova aplikacija ne naslijedi tuđi profil), resetira Google reversed client id
na placeholder, i briše eventualno kopirane `GoogleService-Info.plist` /
`google-services.json`.

Što skripta **izbacuje** jer je vezano uz turnire: home-screen widget
"Nadolazeći turniri" (`widget/`, receiver iz manifesta, layout i
`upcoming_tournaments_widget_info.xml`), shortcut "Novi turnir", i
`/turniri/` path prefix iz App Links intent-filtera. `/blok/`, `/igra/` i
`/profil/` ostaju — te stranice games aplikacija ima.

### 3.1 Ručno, odmah nakon skripte

1. Ubaci oba Firebase config fajla iz §1 (`GoogleService-Info.plist`,
   `google-services.json`). Dok ih nema, aplikacija se **pokreće normalno**
   ali bez pusha i bez nativne Google prijave — to je namjerno.
2. `ios-games/App/App/Info.plist` → zalijepi pravi **`REVERSED_CLIENT_ID`** iz
   novog `GoogleService-Info.plist` preko placeholdera
   `com.googleusercontent.apps.REPLACE_WITH_REVERSED_CLIENT_ID_FOR_games.bela.app`.
   Bez toga Google gumb na iOS-u vodi u slijepu ulicu.
3. **Ikone i splash su još uvijek Bela Turniri** *(2026-09-21: nova grafika je
   izrađena u `frontend/resources-games/` iz `logo_export_bela_games/`; ostaje samo
   pokrenuti naredbu ispod, a `icon-only.png` je bez alfa kanala zbog ITMS-90717)*. Nova grafika za bela.games
   ide u `frontend/resources-games/` (`icon-only.png`, `icon-foreground.png`,
   `icon-background.png`, `splash.png`, `splash-dark.png`), pa
   `npx @capacitor/assets generate --assetPath resources-games --ios --iosProject ios-games/App --android --androidProject android-games`
   (provjeri točne zastavice za verziju alata koju koristiš), ili ručno
   zamijeni `Assets.xcassets/AppIcon.appiconset`, `Splash.imageset` i
   `android-games/app/src/main/res/mipmap-*` + `drawable*`.
4. Otvori `ios-games/App/App.xcodeproj` u Xcodeu jednom i u
   **Signing & Capabilities** odaberi Team te potvrdi da piše
   Push Notifications, Sign in with Apple i Associated Domains s **oba**
   unosa: `applinks:bela.games` i `applinks:belot.games`.

---

## 4. Build

```bash
cd frontend
npm ci

# aplikacija 1 — nepromijenjeno
npm run build:native                 # tsc + vite --mode native + cap sync  → ios/, android/

# aplikacija 2
npm run build:native:games           # tsc + vite --mode native-games + CAP_APP=games cap sync
                                     #   → ios-games/, android-games/
```

Otvaranje projekata:

```bash
npx cap open ios                       # Bela Turniri
npx cap open android
npm run cap:games:open:ios             # Bela Online
npm run cap:games:open:android
```

Android release:

```bash
cd frontend/android-games
./gradlew bundleRelease                # AAB za Play
```

iOS release: Xcode → `ios-games/App/App.xcodeproj` → Product → Archive →
Distribute App → App Store Connect.

> **CI:** `.github/workflows/native.yml` gradi samo prvu aplikaciju. Ako želiš
> da CI gradi i drugu, dodaj `npm run build:native:games` i drugi
> `xcodebuild -project ios-games/App/App.xcodeproj` / `gradlew` korak. Nije
> obavezno za objavu.

---

## 5. Google Play

1. Play Console → **Create app**: naziv `Bela Online`, kategorija
   **Games → Card**, besplatno.
2. Prvi upload AAB-a → Play uključuje **Play App Signing**.
3. **Release → Setup → App signing** → kopiraj **SHA-256** *App signing key
   certificate* (ne upload ključa!) u:
   - Firebase Android aplikaciju `games.bela.app` (§1.3), i
   - `ops/well-known-games/assetlinks.json`, polje
     `sha256_cert_fingerprints`, uz `"package_name": "games.bela.app"`.
4. Deploy Caddyja da **i** `https://bela.games/.well-known/assetlinks.json`
   **i** `https://belot.games/.well-known/assetlinks.json` vraćaju tu
   datoteku, pa provjeri: Play Console → **Setup → App links** mora pokazati
   **obje** domene kao *Verified*.
   ⚠️ Androidov `autoVerify` provjerava **svaki** host iz intent-filtera i ako
   jedan padne, **cijeli filter ostaje neverificiran** — dakle ni bela.games
   linkovi tada ne bi otvarali aplikaciju. Zato belot.games nije "nice to
   have": ili obje domene poslužuju assetlinks, ili se drugi host mora izbaciti
   iz manifesta.
5. **Data safety** formular — prepiši iz `docs/store/play-data-safety.md`, ali
   **makni** sve što games aplikacija ne prikuplja: lokaciju (nema karte ni
   filtera "u blizini") i fotografije/kameru (nema postera ni uploada postera).
   Ostaje: e-mail/ime (račun), identifikatori uređaja (FCM token, gost id),
   podaci o igri.

---

## 6. `ops/well-known-games/`

Direktorij radi drugi agent; ovdje su vrijednosti koje u njega idu:

`apple-app-site-association`

```json
{
  "applinks": {
    "details": [
      { "appIDs": ["TEAMID.games.bela.app"],
        "components": [ { "/": "/igra/*" }, { "/": "/blok/*" }, { "/": "/profil/*" } ] }
    ]
  },
  "webcredentials": { "apps": ["TEAMID.games.bela.app"] }
}
```

`assetlinks.json`

```json
[
  { "relation": ["delegate_permission/common.handle_all_urls"],
    "target": { "namespace": "android_app",
                "package_name": "games.bela.app",
                "sha256_cert_fingerprints": ["REPLACE_WITH_PLAY_APP_SIGNING_SHA256"] } }
]
```

`TEAMID` i SHA-256 zamijeni stvarnim vrijednostima.

**Ista, nepromijenjena datoteka poslužuje se na obje domene** — i na
`https://bela.games/.well-known/...` i na `https://belot.games/.well-known/...`.
Ni AASA ni assetlinks u sebi ne spominju domenu: govore samo *koja aplikacija*
smije preuzeti *koje putanje*, pa nema potrebe ni za dvije varijante ni za
ikakvim razlikovanjem. U Caddyju je to jedan `handle` blok dijeljen između oba
site bloka (ili jedan blok s oba imena hosta).

Poslužuje se bez preusmjeravanja i kao `application/json`. Ako `www.bela.games`
/ `www.belot.games` nisu 301 na goli host, datoteka mora biti dostupna i tamo.

---

## 7. Rizici pri recenziji

### 7.1 Apple guideline 4.3 — "Spam" / duplicirane aplikacije

Ovo je **stvarni rizik**: dvije aplikacije istog developera iz istog koda.
4.3(a) cilja "više verzija iste aplikacije s malim razlikama". Odbijanje se
izbjegava tako da razlika bude **funkcionalna, a ne kozmetička**, i da se to
vidi već iz store stranice:

- **Različit primarni sadržaj.** Bela Turniri je alat za *organizaciju turnira
  uživo* (prijave parova, ždrijeb rundi, rezultati, obračun pića, kalendar i
  karta turnira po Hrvatskoj). Bela Online je *online kartaška igra protiv
  ljudi i botova*. Zajednički su im samo prijava i pravila bele — kao što
  fizička kartaška igra i softver za vođenje lige nisu ista stvar.
- **Različita kategorija** u trgovini: Games → Card vs. Sports/Utilities.
- **Različit screenshot set i opis** — nijedan screenshot ne smije biti isti.
  Bela Online: lobi, stol, karte u ruci, statistika. Bela Turniri: lista
  turnira, karta, ždrijeb, blok.
- **Bez unakrsnog reklamiranja i bez mrtvih ruta.** U games buildu uopće nema
  ekrana za turnire (`src/site.ts`), pa recenzent ne može naletjeti na "isto
  je". Zato skripta briše i widget "Nadolazeći turniri" i shortcut "Novi
  turnir" — inače bi upravo to bio dokaz da je riječ o istoj aplikaciji.
- **Ako ipak dođe 4.3 odbijanje**, u Resolution Centeru odgovori konkretno:
  navedi da su to dva različita proizvoda na dvije domene s dvije publike
  (organizatori turnira vs. igrači online partija), pobroji ekrane koje jedna
  ima a druga nema, i ponudi demo račun za oboje. Najčešći ishod je da
  recenzent traži jasniju diferencijaciju opisa/screenshota, ne brisanje.
- **Plan B** ako Apple ustraje: objaviti samo bela.games aplikaciju, a
  tournament funkcije zadržati kao PWA/web — ili obrnuto. Kod to podnosi bez
  promjena.

Bilješke o recenziji drži u `docs/store/review-notes.md` (dodaj zaseban odjeljak
za Bela Online s demo računom i uputom kako doći do partije u jednom potezu —
recenzent koji ne uspije naći protivnika u lobiju odbija aplikaciju kao
"nefunkcionalnu"; osiguraj da igra protiv botova kreće odmah).

### 7.2 Dobna oznaka i "simulirano kockanje"

Bela je kartaška igra **bez ikakvog novca**: nema kupnje žetona, nema
in-app purchasea, nema nagrada koje se mogu unovčiti, nema oglasa za kladionice.
Odgovori dosljedno na sva tri formulara:

- **Apple (App Store Connect → Age Rating)**
  - *Contests* / *Gambling*: **No**.
  - *Simulated Gambling*: **No** — Apple pod time misli na simulaciju kockanja
    (virtualni slot/casino/poker za žetone). Bela s partijama bez uloga tu ne
    spada; ako ikad dodaš virtualne žetone koji se kupuju, odgovor postaje
    **Yes** i rating skače na 17+/18+.
  - Očekivana oznaka: **4+**, eventualno 9+ ako uključiš "Infrequent/Mild
    Contests". Provjeri i `docs/store/age-rating.md` da odgovori budu isti kao
    za prvu aplikaciju.
- **Google Play (IARC upitnik)**
  - *"Does the app contain gambling themes?"* / *"simulated gambling"*: **No**.
  - *"Can users interact / communicate?"* — **Yes** ako igra ima chat ili
    prikazuje korisnička imena drugih igrača (prikaz imena da, i to treba
    prijaviti); to samo po sebi ne diže dobnu granicu, ali **mora** biti
    prijavljeno, inače je to razlog za skidanje aplikacije.
  - *User-generated content* — nadimak gosta je UGC; navedi da postoji
    prijava/moderacija ako je imaš.
  - Očekivano: **PEGI 3 / ESRB Everyone**.
- **Ne koristi riječi "casino", "poker", "bet", "chips", "jackpot"** u nazivu,
  opisu ni ključnim riječima. To je najbrži način da automatska provjera
  aplikaciju gurne u kockarsku kategoriju, gdje slijede licencni zahtjevi po
  državama.

---

## 8. Kontrolna lista prije prve objave

- [ ] Firebase: 2 nove aplikacije u **istom** projektu, oba config fajla na mjestu
- [ ] SHA-1 (debug) + SHA-256 (Play App Signing) upisani u Firebase
- [ ] Firebase **Authorized domains**: `bela.games`, `www.bela.games`,
      `belot.games`, `www.belot.games` (§1.7)
- [ ] APNs .p8 ključ povezan i s novom iOS aplikacijom
- [ ] App ID `games.bela.app` s Push + Associated Domains + Sign in with Apple
- [ ] **Sign in with Apple grupiran** s `com.belaturniri.app` (§2.3)
- [ ] `REVERSED_CLIENT_ID` upisan u `ios-games/App/App/Info.plist`
- [ ] Ikone i splash zamijenjeni bela.games grafikom
- [ ] `ops/well-known-games/` popunjen, Caddy deployan, i AASA i assetlinks
      vraćaju JSON na **obje** domene (4 URL-a ukupno)
- [ ] Play App links = *Verified* za **bela.games i belot.games**;
      iOS universal link otvara aplikaciju s obje domene
- [ ] Deep link test na uređaju: `https://bela.games/igra/soba/<id>`,
      `https://belot.games/igra/soba/<id>` i `https://bela.games/blok/z/<id>`
      otvaraju **aplikaciju**;
      `https://bela-turniri.com/turniri/<slug>` otvara **preglednik**
- [ ] Regresija: aplikacija Bela Turniri i dalje otvara
      `https://bela-turniri.com/turniri/<slug>` **u sebi**, ne u pregledniku
- [ ] Push test: notifikacija stiže i na Bela Online uređaj, tap otvara pravu rutu
- [ ] Prijava istim Apple/Google računom u obje aplikacije daje **isti profil**
- [ ] Store: različita kategorija, različiti screenshotovi, različit opis (§7.1)
- [ ] Dobna oznaka ispunjena kao u §7.2

---

## 9. iOS popravci 2026-09-20

Revizija iOS projekta (`frontend/ios/` — **izvor istine**, iz kojeg
`scripts/create-games-native.sh` kopira `ios-games/`) našla je četiri stvari
koje bi objavu ili srušile ili prošle kroz recenziju kao tiho pokvarene.
Sve je popravljeno u `ios/`, a skripta je usklađena.

### 9.1 Lokalni pluginovi se nisu registrirali (blocker)

`SceneDelegate.swift` je radio **svoj** `UIWindow` s golim
`CAPBridgeViewController()` i time bacao root view controller iz
`Main.storyboard`, kojem je `customClass` = `AppBridgeViewController` — a to
je **jedino** mjesto gdje se na bridge registriraju `GuestKeychainPlugin` i
`BelaLiveActivityPlugin`. Posljedica: gost identitet se nije spremao u
Keychain, a Live Activity se nikad nije ni pokretala. Bez greške, bez loga.

Sada `SceneDelegate` **ne dira** `window` koji je UIKit već složio iz
storyboarda (scene manifest u `Info.plist` ima
`UISceneStoryboardFile = Main`), a ako ga ikad ne bi bilo, rezervna grana
instancira **isti** storyboard — pa custom klasa preživi u oba slučaja.
`SceneDelegateProxy` prosljeđivanje je ostalo netaknuto.

### 9.2 Nedostajao `aps-environment` (blocker)

Bez tog entitlementa `registerForRemoteNotifications` nikad ne vrati token,
pa ne rade **ni** FCM push **ni** ActivityKit push tokeni. Dodan u
`App/App/App.entitlements` s vrijednošću `development`; Xcode ga pri
potpisivanju za distribuciju sam prepiše u `production`, pa se **ne** mijenja
ručno. `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` je provjereno prisutan
u **obje** konfiguracije (Debug i Release) App targeta.

> Uvjet sa strane Applea: App ID mora imati uključenu **Push Notifications**
> capability, inače potpisivanje pukne baš na `aps-environment`.

### 9.3 Nedostajao `PrivacyInfo.xcprivacy` (blocker)

Dodan `App/App/PrivacyInfo.xcprivacy` i — što je zapravo važnije — **upisan u
Resources build phase** App targeta u `project.pbxproj`. Privacy manifest koji
nije ni u jednoj build fazi se ne pakira i Apple se ponaša kao da ga nema.

Sadržaj je izveden iz koda, ne izmišljen:

| polje | vrijednost | odakle |
|---|---|---|
| `NSPrivacyTracking` | `false` | nema ad/analytics SDK-a, nema IDFA/ATT |
| `NSPrivacyTrackingDomains` | prazno | isto |
| e-mail adresa | linked, App Functionality | Firebase Auth; backendov principal **jest** `email` claim |
| ime | linked, App Functionality | display name za stolom i na javnom profilu |
| user ID | linked, App Functionality | Firebase UID + gost id iz Keychaina |
| device ID | linked, App Functionality | FCM token + ActivityKit push tokeni |
| fotografije | linked, App Functionality | avatar s `/profil` (`MyDataCard.tsx`) |
| `CA92.1` | UserDefaults | `@capacitor/preferences` (nema vlastiti manifest) |
| `C617.1` | file timestamp | `@capacitor/filesystem` (`stat` → mtime) + `WebViewAssetHandler` |

Firebase SDK-ovi i `@capacitor/ios` nose **vlastite** manifeste u svojim SPM
paketima; Xcode ih spaja u završni privacy report. Ovaj fajl pokriva samo
kod aplikacije i pluginove bez vlastitog manifesta.

Widget extension je dobio svoj, namjerno prazan manifest
(`App/BelaActivity/PrivacyInfo.xcprivacy`) — on ne prikuplja ništa.

⚠️ Odgovori u **App Store Connect → App Privacy** moraju reći isto što i ova
tablica. Ako se razilaze, Apple gleda formular.

### 9.4 Live Activity target sada stvarno postoji

Bivši `ios/BelaActivity-dropin/` (kod u nijednom targetu, dok je `Info.plist`
javno oglašavao `NSSupportsLiveActivities`) je **ukinut**. Izvor je premješten
u `ios/App/BelaActivity/`, a target je stvoren skriptom:

```bash
cd frontend
gem install --user-install xcodeproj          # jednom
export GEM_HOME="$(ruby -e 'puts Gem.user_dir')"
ruby scripts/add-live-activity-target.rb      # idempotentno
xcodebuild -list -project ios/App/App.xcodeproj   # → Targets: App, BelaActivity
```

Skripta je **idempotentna** (drugi prolaz ne mijenja ništa) i radi i nad
`ios-games/App/App.xcodeproj` ako joj se putanja preda kao argument.
Što slaže:

- target `BelaActivity`, tip `app-extension`, deployment target **16.2**;
- bundle id `<app id>.BelaActivity` — čita se iz App targeta, pa se u games
  projektu sam prelomi u `games.bela.app.BelaActivity`;
- `BelaActivityAttributes.swift` u **oba** targeta (ista `ContentState`
  definicija je uvjet da push-driven update uopće dekodira);
- `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` prepisani s App targeta —
  Apple odbija extension čije se verzije razlikuju od host aplikacije;
- "Embed Foundation Extensions" copy faza → `PlugIns/`, plus target
  dependency;
- `App/App/PrivacyInfo.xcprivacy` u Resources fazi App targeta (§9.3).

Sam widget (`BelaActivityLiveActivity.swift`) je dopunjen:

- `@main struct BelaActivityBundle: WidgetBundle` — widget extension **bez**
  `@main` se izgradi, ali ne registrira ništa i Live Activity se nikad ne
  nacrta;
- Dynamic Island je već imao compact leading/trailing, minimal i expanded
  (leading/trailing/bottom) regije te Lock Screen prikaz — pregledani su i
  ostavljeni, uz `context.isStale` → "Čeka ažuriranje" na svim površinama.

**`.supplementalActivityFamilies([.small])` namjerno NIJE dodan** (Apple Watch
Smart Stack / male površine). Modifikator traži **iOS 18.0**, a extension
deploya na **16.2** da Live Activity radi i na 16.2–17.x. Uvjetno nuđenje bi
tražilo runtime *ili-ili* između dva widgeta, a `WidgetBundleBuilder` to ne
može izraziti: njegov `buildOptional` je doslovno
`@available(*, unavailable, message: "if statements in a WidgetBundleBuilder
can only be used with #available clauses")`, `buildEither` ne postoji, a
funkcija koja vraća `some WidgetConfiguration` ne može vratiti dva različita
opaque tipa. Registriranje **oba** widgeta se prevede, ali bi značilo dvije
`ActivityConfiguration` za isti `BelaActivityAttributes` — i tada je
nedefinirano koju WidgetKit crta. Provjereno `swiftc -typecheck` protiv
iOS 26 SDK-a (verzija modifikatora u `WidgetKit.swiftinterface`: iOS 18.0).

> Kad deployment target extensiona jednom padne na iOS 18.0, dovoljno je
> dodati taj jedan modifikator na `belaActivityConfiguration()`. Razlog i
> postupak stoje u komentaru iznad `BelaActivityBundle`.

**Čišćenje zaostalih aktivnosti.** Live Activity nadživi proces. Zato:

- `AppDelegate.applicationWillTerminate` zove
  `BelaLiveActivityPlugin.endAllActivitiesOnTerminate()` — *best effort*;
- `AppDelegate.didFinishLaunching` zove
  `BelaLiveActivityPlugin.sweepStaleActivities()`, koji gasi aktivnosti u
  fazi `gameOver` ili one kojima je prošao `staleDate`. To je pouzdani dio:
  `applicationWillTerminate` se za suspendiranu aplikaciju koju sustav ubije
  **ne** pozove. Partija koja još traje se namjerno ne dira.

`isAvailable` nije mijenjan — sada je pošten jer target postoji.

### 9.5 Sitnije

- `UIRequiredDeviceCapabilities`: `armv7` → **`arm64`**.
- **Maknuti** `NSLocationWhenInUseUsageDescription`. U iOS projektu ništa ne
  linka CoreLocation, nema `@capacitor/geolocation`, a jedina geolokacija je
  web `navigator.geolocation` u `src/hooks/useUserLocation.ts`, koji koriste
  samo karta i kalendar — stranice kojih u games buildu nema.
- **Zadržani** `NSCamera` / `NSPhotoLibrary` / `NSPhotoLibraryAdd` stringovi:
  `/profil` postoji u obje aplikacije i ima
  `<input type="file" accept="image/jpeg,image/png,image/webp">`
  (`src/pages/profile/MyDataCard.tsx`), a WKWebView picker nudi "Take Photo".
  Bez tih ključeva aplikacija puca. Skripta im za games verziju suzi tekst na
  profilnu sliku (nema postera turnira).
- **Ikona**: `AppIcon-512@2x.png` je imala alpha kanal (ITMS-90717).
  Provjereno `sips -g hasAlpha` → `yes`, alpha extrema `(255, 255)` (dakle
  potpuno neprozirna), pa je spljoštena u RGB; usporedba piksela prije/poslije
  (`PIL.ImageChops.difference().getbbox()`) vraća `None` — **izgled je
  identičan**. Obrisano je i 12 `appicon_*.png` datoteka koje nisu bile u
  `Contents.json` (na njih se ništa u repozitoriju nije pozivalo).
- **`GuestKeychainPlugin`**: Keychain `service` više nije tvrdo upisan
  `com.belaturniri.app.guest`, nego `Bundle.main.bundleIdentifier + ".guest"`.
  Isti fajl ide u obje aplikacije; s literalom bi na uređaju s obje
  instalirane jedna prepisivala gost identitet druge.

### 9.6 Verzije — pravilo podizanja

`MARKETING_VERSION` (= `CFBundleShortVersionString`) i
`CURRENT_PROJECT_VERSION` (= `CFBundleVersion`) su **ostavljeni** na `1.0` /
`1`. Pravilo:

- `CURRENT_PROJECT_VERSION` se podiže **za svaki upload** u App Store Connect,
  i unutar iste `MARKETING_VERSION`. Dva builda s istim parom verzija ASC
  odbija.
- `MARKETING_VERSION` se podiže kad se mijenja ono što korisnik vidi
  (`1.0` → `1.1` → `2.0`); tada `CURRENT_PROJECT_VERSION` smije krenuti od `1`,
  ali je jednostavnije nastaviti monotono.
- Oba se mijenjaju **samo u App targetu**; `add-live-activity-target.rb` ih
  prepisuje u `BelaActivity` target, pa nakon ručne promjene u Xcodeu provjeri
  da se **podudaraju** (Apple odbija extension s drugom verzijom od hosta).
- Android `versionCode` / `versionName` u
  `android-games/app/build.gradle` drži u koraku — nisu povezani, ali je
  puno lakše kad su isti broj.

### 9.7 Što ostaje **isključivo** na vlasniku

Ništa od ovoga agent ne može napraviti (traži Apple/Firebase račun, ključeve
ili Xcode GUI):

1. **Apple Developer portal** — App ID `games.bela.app` s uključenim
   **Push Notifications** (obavezno zbog `aps-environment`), **Associated
   Domains** i **Sign in with Apple**, te grupiranje SIWA App ID-eva iz §2.3.
   Extension App ID (`games.bela.app.BelaActivity`) automatsko potpisivanje
   stvara samo; ne treba mu nijedna capability.
2. **APNs `.p8` ključ** povezan i s novom iOS aplikacijom u
   **Firebase → Project settings → Cloud Messaging** (§1.4). Bez toga push
   i remote Live Activity update ne rade iako je entitlement na mjestu.
3. **`GoogleService-Info.plist`** iz Firebasea u `ios-games/App/App/`, plus
   pravi **`REVERSED_CLIENT_ID`** preko placeholdera u `Info.plist` (§3.1).
4. **Signing team** u Xcodeu za **oba** targeta (`App` i `BelaActivity`).
5. **Provjera na uređaju** (agent ne pokreće ništa): da se Live Activity
   pojavi na zaključanom zaslonu i u Dynamic Islandu kad partija krene, i da
   nestane kad partija završi ili se aplikacija ubije pa ponovno otvori.
6. **App Store Connect → App Privacy** popuniti identično tablici iz §9.3.
7. Ako `gem install xcodeproj` na nekom stroju ne prođe, target se dodaje
   ručno: **File → New → Target… → Widget Extension**, Product Name
   `BelaActivity`, kvačica **Include Live Activity**, bez App Intenta; zatim
   obriši generirane fajlove, povuci `App/BelaActivity/*` u novi target,
   `App/App/BelaActivityAttributes.swift` dobije **dodatnu** kvačicu za
   `BelaActivity` u Target Membershipu, Minimum Deployments → **16.2**,
   bundle id → `<app id>.BelaActivity`, i provjeri da je u App targetu
   nastala "Embed Foundation Extensions" faza.

---

## 9. Android popravci 2026-09-20

Sve ispod je napravljeno u **`frontend/android/`** (izvor istine) pa to
`scripts/create-games-native.sh` kopira i zakrpa u `android-games/`. Ništa od
ovoga nije buildano ni pokrenuto — provjere su statičke (`bash -n`,
`xmllint --noout`, `tsc -b`, `eslint`, čitanje `androidx.core` jara iz Gradle
cachea). Prvi `./gradlew` ostaje na tebi.

### 9.1 Notifikacija partije uživo više ne ostaje zauvijek (BLOKER)

`useLiveActivity.ts` je na izlazak iz sobe i na unmount zvao `plugin.end({})`
bez stanja. Na Androidu je to završavalo u `LiveGameState.fromJson(null)` →
`null` → `LiveGameNotification.end()` koji je **odmah izlazio**, a
`cancel()` nije imao nijednog pozivatelja. Kako je notifikacija
`setOngoing(true)`, korisnik je ne može maknuti prstom — ostajala je u shadeu
dok se aplikacija ne deinstalira.

Popravljeno kroz cijeli lanac:

- `end` sada nosi `roomId` kad nema završnog rezultata:
  `end({ state })` = ostavi konačni rezultat, `end({ roomId })` = **ugasi**.
  iOS ugovor je netaknut — `BelaLiveActivityPlugin.swift` čita samo
  `call.options["state"]` i gasi sve svoje aktivnosti, pa mu je dodatni ključ
  nevidljiv. (`src/platform/liveActivityPlugin.ts`,
  `src/game/hooks/useLiveActivity.ts` — soba se pamti u `session.current.room`
  jer je u trenutku gašenja `room` već `null`.)
- `LiveGameNotification.end(context, state, roomId)`: `state == null` više
  nije no-op nego **cancel**.
- `MainActivity.onCreate` (samo kod pravog hladnog starta) pomete sve zaostale
  notifikacije s kanala `bela_live` — `LiveGameNotification.cancelAll()`. To je
  mreža za slučaj da je proces umro usred partije.
- Novi `LiveGameTaskWatcherService` hvata **swipe aplikacije iz recentsa**
  (`onTaskRemoved`), što Activity ne dobiva. Nije foreground servis, ništa ne
  radi, pokreće se samo iz foregrounda (plugin poziv), a FCM put ga namjerno
  ne pokreće jer bi to na API 26+ bacilo iznimku. Best effort — `cancelAll` na
  startu je i dalje garancija.

### 9.2 Android 16 Live Updates (BLOKER)

- Dodan `android.permission.POST_PROMOTED_NOTIFICATIONS`. Bez njega promocije
  u status-bar chip **nema**, što god `setRequestPromotedOngoing` govorio.
- **Refleksija izbačena.** Provjereno raspakiravanjem
  `~/.gradle/.../androidx.core/core/1.17.0/core-1.17.0.aar` i `javap`-om:
  `NotificationCompat.Builder#setRequestPromotedOngoing(boolean)`,
  `#setShortCriticalText(String)` i `NotificationCompat.ProgressStyle` postoje
  u 1.17.0. U 1.13.0 ih **nema** — a 1.13.0 je ono što se bez dodatne linije
  rezolvira na *compile* classpathu, jer `capacitor-android` deklarira
  `androidx.core` kao `implementation` (ne `api`), pa je jedini compile put
  `appcompat 1.7.1` koji pina 1.13.0. Zato je u `app/build.gradle` dodan
  eksplicitan `implementation "androidx.core:core:$androidxCoreVersion"`.
  **Ovo je jedina promjena koja može srušiti build ako nešto previdim — prvi
  gradle build to odmah pokaže.**
- Provjereni uvjeti promocije (prema developer.android.com stranici o Live
  Updates): dozvola ✓, `setRequestPromotedOngoing(true)` ✓, `setOngoing(true)`
  ✓, `contentTitle` ✓, small icon ✓, `ProgressStyle` (jedan od dopuštenih) ✓,
  kanal `IMPORTANCE_DEFAULT` (nije `IMPORTANCE_MIN`) ✓, nema custom
  `RemoteViews` ✓, nije group summary ✓, nije `setColorized(true)` ✓.
- Chip dobiva `setShortCriticalText("us:them")` — goli rezultat.

### 9.3 Potpisivanje i verzioniranje release builda (BLOKER)

`app/build.gradle` sada čita, tim redom: `android/keystore.properties` →
`BELA_KEYSTORE_FILE` / `BELA_KEYSTORE_PASSWORD` / `BELA_KEY_ALIAS` /
`BELA_KEY_PASSWORD` → ništa. Kad nema ničega, `signingConfigs.release` se
**uopće ne stvara**, pa debug build i CI bez tajni i dalje rade.

`android/.gitignore` sada stvarno ignorira `*.jks`, `*.keystore`, `*.p12`,
`*.pepk`, `keystore.properties(.local)`. **Nijedan ključ nije napravljen ni
commitan.**

`keystore.properties` (nikad u git):

```properties
storeFile=/apsolutna/putanja/bela-games-upload.jks
storePassword=...
keyAlias=upload
keyPassword=...
```

**Pravilo za versionCode:** mora **strogo rasti za svaki** artefakt poslan na
Play — uključujući ponovni upload iste `versionName` nakon odbijene recenzije.
Play zauvijek pamti viđene brojeve. Dakle: `belaVersionCode` +1 po uploadu,
`belaVersionName` (semver `x.y.z`) samo kad se mijenja verzija koju korisnik
vidi. Bez uređivanja datoteke:

```bash
./gradlew bundleRelease -PbelaVersionCode=12 -PbelaVersionName=1.2.0
```

### 9.4 Backup — isključen (VISOKO)

`android:allowBackup="false"` + `res/xml/data_extraction_rules.xml` (API 31+,
pokriva i **device-to-device transfer**, koji `allowBackup` ne pokriva) +
`res/xml/backup_rules.xml` (API 23–30).

Obrazloženje: sve lokalno stanje je ili vjerodajnica koja je na drugom uređaju
**kriva** (Firebase Auth sesija i nativno i u WebView localStorageu, FCM token,
Installations id), ili predmemorija nečega što backend ionako posjeduje
(Capacitor Preferences, gost id, offline queue `bela:opq:v1`, TanStack Query
snapshot). Ništa što korisnik sam nije napisao. Vraćanje prijavljene sesije na
uređaj koji korisnik možda više nema nema protuvrijednost.

### 9.5 Ikona notifikacije (VISOKO)

Novi `res/drawable/ic_stat_bela.xml` — bijeli vektor na prozirnoj podlozi
(obris karte + pik), jer Android small icon koristi kao **masku** pa se
šarena launcher ikona pretvara u bijelu mrlju. Koristi ga
`LiveGameNotification`, a dodan je i za FCM:
`com.google.firebase.messaging.default_notification_icon` +
`default_notification_color` (`@color/notification_accent`, `#2F8F52`).

### 9.6 Srednje (VISOKO/SREDNJE)

- Kanal `bela_live` dobio `lockscreenVisibility = VISIBILITY_PUBLIC` i svaka
  notifikacija `setPublicVersion(...)` — na zaključanom ekranu sa sakrivenim
  osjetljivim sadržajem piše „Partija u tijeku" bez rezultata (hr + sl string).
- `android:localeConfig` + `res/xml/locales_config.xml` (`hr`, `sl` — točno
  ono što postoji kao `values/` + `values-sl/`). Ispod API 33 atribut se
  ignorira.
- `proguard-rules.pro` je sad stvaran: keep pravila za Capacitor refleksiju
  (`@CapacitorPlugin`, `@PluginMethod`, `@JavascriptInterface`), za naše
  pluginove i manifestom deklarirane komponente, WorkManager, Firebase/GMS i
  Cordova shim. **`minifyEnabled` ostaje `false`** — pravila postoje da
  uključivanje R8 kasnije bude jedna linija, a ne debugging sesija.
- `TournamentsWidgetWorker`: `Result.retry()` više nije bezuvjetan (3 pokušaja
  pa `success()`), a jednokratni refresh ide s `ExistingWorkPolicy.REPLACE`
  umjesto `KEEP` — inače jedan zaglavljeni pokušaj proguta svaki sljedeći
  zahtjev i widget se prestane osvježavati. (Widget ionako ne ide u games
  aplikaciju, ali `frontend/android` je izvor istine.)

### 9.7 Lokacija maknuta (odluka vlasnika)

`ACCESS_COARSE_LOCATION` je izbačen iz manifesta. Provjereno: jedini potrošač
geolokacije u `frontend/src` je `hooks/useUserLocation.ts`, a do njega se dolazi
samo s kalendara i karte turnira; `@capacitor/geolocation` uopće nije u
`package.json`. U Play **Data safety** formularu lokacije sada nema.
Ako se ikad oživi nativni build za turnire, dozvola se vraća (komentar u
manifestu to kaže doslovno).

### 9.8 Popravci u `create-games-native.sh` (samo Android dio)

- **Host se više ne upisuje u Kotlin.** `LiveGameNotification.DEEP_LINK_BASE`
  je bio `"https://bela-turniri.com/igra/"`, a skripta je host mijenjala samo
  u `*.xml` — u games aplikaciji bi tap na notifikaciju pao na `isGamesHost()`
  provjeri u `NativeShell.tsx`. Sada ide kroz
  `R.string.live_deep_link_base` (dakle *jest* xml), a skripta uz to mijenja
  host i u `*.kt` / `*.java` / `*.gradle` / `*.pro` kao osigurač za sljedeću
  konstantu koju netko ugradi.
- **Redoslijed brisanja ispravljen.** Prvo se iz XML-a izbacuju reference
  (widget receiver, shortcut „Novi turnir", `/turniri/` path prefix), pa tek
  onda brišu datoteke — prije je `ic_shortcut_plus.xml` nestajao prije
  shortcuta koji ga referencira, pa je promjena uzvodnog bloka ostavljala
  viseći `@drawable` i aapt2 grešku.
- `rm_checked` glasno javi kad datoteka koju očekuje ne postoji (prije je
  `rm -f` tiho uspijevao i widget bi se prošvercao u games aplikaciju).
- Novi korak **„verifying the Android strip"** na kraju grepa `android-games`
  za `.widget.UpcomingTournamentsWidgetProvider`,
  `@xml/upcoming_tournaments_widget_info`, `@layout/widget_upcoming_tournaments`,
  `@drawable/ic_shortcut_plus`, `/turniri/`, stari host i stari applicationId.
- rsync sada izuzima i `*.p12`, `*.pepk`, `keystore.properties.local` —
  games aplikacija dobiva **svoj** upload ključ.
- Nove datoteke (`ic_stat_bela.xml`, `backup_rules.xml`,
  `data_extraction_rules.xml`, `locales_config.xml`,
  `LiveGameTaskWatcherService.kt`) prenose se običnim kopiranjem i hvataju ih
  postojeće zamjene paketa/hosta.

### 9.9 Što ostaje **isključivo** na vlasniku

1. **Napraviti upload keystore** (nijedan nije napravljen ni commitan):
   ```bash
   keytool -genkeypair -v -keystore ~/keys/bela-games-upload.jks \
     -storetype JKS -keyalg RSA -keysize 4096 -validity 10000 -alias upload
   ```
   pa `frontend/android-games/keystore.properties` popuniti kao u §9.3.
   Backup ključa izvan repozitorija; gubitak = reset upload ključa preko
   Google podrške.
2. **Play App Signing SHA-256** (Play Console → Release → Setup → App signing →
   *App signing key certificate*, **ne** upload ključ) upisati u:
   - `ops/well-known-games/assetlinks.json` →
     `sha256_cert_fingerprints`, uz `"package_name": "games.bela.app"`, i
   - Firebase Android aplikaciju `games.bela.app`.
   Tek nakon toga App Links mogu biti *Verified* na **obje** domene (§5.4).
3. **`google-services.json`** za `games.bela.app` u
   `frontend/android-games/app/` (§1.3). Bez njega aplikacija radi, ali nema
   pusha ni nativne Google prijave — namjerno.
4. **Zatvoreno testiranje je obavezno za osobne račune.** Ako je Play
   developer račun otvoren kao **pojedinac** (ne tvrtka) poslije 13.11.2023.,
   Google traži **zatvoreni test s najmanje 12 testera koji su bili prijavljeni
   (opted in) neprekidno 14 dana** prije nego što se uopće može zatražiti
   produkcijski pristup. Planiraj tjedne, ne dane: skupi 12 Google računa,
   dodaj ih u closed testing listu i ne diraj je 14 dana.
5. Ikone/splash su još uvijek Bela Turniri grafika (§3.1.3) — vrijedi i za
   `ic_stat_bela`, koji je namjerno generički obris karte s pikom; ako želiš
   drugi glif, to je jedna vektorska putanja.

---

## 10. Stanje 2026-09-20 (navečer)

### ✅ Napravljeno u kodu

- [x] Privacy manifest dodan (`PrivacyInfo.xcprivacy` na iOS, prijavljen u build fazi)
- [x] Push entitlement dodan (`aps-environment` u `App.entitlements`)
- [x] Live Activity extension target ostvaren (`BelaActivity` target na iOS 16.2+)
- [x] Release signing config čita `keystore.properties` (Android)
- [x] Backups isključeni (`allowBackup=false` + `data_extraction_rules.xml` + `backup_rules.xml` na Androidu)
- [x] Notification icon dodan (`ic_stat_bela.xml` na Androidu)
- [x] Offensive-name filter za display nazive (backend filtracija, nema report/block)
- [x] Android hardware back traži potvrdu na game tablici
- [x] Account deletion dostupna u profilu + javna stranica `https://bela.games/brisanje-racuna`

### ⚠️ Samo vlasnik — Apple i Firebase

- [ ] App ID `games.bela.app` s Push Notifications, Associated Domains, Sign in with Apple
- [ ] Sign in with Apple grupiranje s `com.belaturniri.app` (obavezno prije objave)
- [ ] Firebase Console: 2 nove aplikacije (iOS + Android) u istom projektu
- [ ] iOS Firebase config (`GoogleService-Info.plist`) + REVERSED_CLIENT_ID u Info.plist
- [ ] Android Firebase config (`google-services.json`)
- [ ] APNs .p8 ključ povezan s novom iOS aplikacijom
- [ ] Apple provider keys za Sign in with Apple (ako nije već postavljeno)
- [ ] Xcode: Team odabran i potpisivanje konfigurirano za App i BelaActivity target
- [ ] App Store Connect: nova aplikacija `Bela Online` + App Privacy popunjena

### ⚠️ Samo vlasnik — Google Play i ključi

- [ ] Upload keystore za release potpisivanje (nijedan nije u git-u)
- [ ] `keystore.properties` popunjena putanjom i lozinkama za upload keystore
- [ ] Play App Signing SHA-256 (ne upload ključ!) upisana u `ops/well-known-games/assetlinks.json`
- [ ] Play App Signing SHA-256 upisana u Firebase Android aplikaciju
- [ ] Caddy deployment: `/api/.well-known/assetlinks.json` vraća JSON na obje domene (`bela.games` i `belot.games`)
- [ ] Play App Links verificirani na obje domene (*Verified* u Play Console)
- [ ] Zatvoreno testiranje: 12+ testera, 14 dana za osobne računike (ako je novi račun nakon 13.11.2023.)
- [ ] FIREBASE_SERVICE_ACCOUNT_JSON u produkciji (ako je potreban za bilo što)

### ⚠️ Samo vlasnik — Grafika, dizajn i pravo

- [ ] Screenshots za iOS/Android (5–10 slika po veličini, različit set od Bela Turniri aplikacije)
- [ ] App Icon i Feature Graphic (1024×1024, 1024×500 px)
- [ ] Splash grafika za bela.games branding
- [ ] Store opisi i ključne riječi (hr i en)
- [ ] Pravna provjera stranice za brisanje računa (`https://bela.games/brisanje-racuna`)

### 📋 Provjera prije prvog uploada

- [ ] Deep link test na uređaju: `https://bela.games/igra/...` i `https://belot.games/igra/...` otvaraju aplikaciju
- [ ] Push test: notifikacija stignu na oba brendinga i tap otvara pravu rutu
- [ ] Prijava s Google/Apple u Bela Online vraća isti profil kao u Bela Turniri
- [ ] Live Activity vidljiv na zaključanom zaslonu kada partija traje
- [ ] Android back dugme traži potvrdu na game tablici
- [ ] Account deletion radi iz profila i putem javne stranice
