# Brisanje računa

Zadnja izmjena: 2026-09-20.

Ovaj dokument opisuje kako brisanje korisničkog računa danas stvarno radi — od
gumba u aplikaciji do zadnjeg retka u bazi — te što treba upisati u Appleov
"App Privacy" i Googleov "Data safety" obrazac. Vrijedi za sve tri ulazne
točke (`bela-turniri.com`, `bela.games`, `belot.games`) i za native aplikaciju
"Bela Online", jer je backend, Firebase projekt i baza jedan te isti.

---

## 1. Zašto to uopće mora postojati

| Zahtjev | Što traži | Izvor |
| --- | --- | --- |
| Apple 5.1.1(v) | Račun otvoren u aplikaciji mora se moći obrisati **iz same aplikacije**, put do brisanja mora se **lako pronaći**, a brisanje mora biti stvarno (ne samo deaktivacija). | <https://developer.apple.com/app-store/review/guidelines/#5.1.1> |
| Apple, Sign in with Apple | Ako aplikacija nudi prijavu Apple ID-om, pri brisanju se **mora opozvati Appleov token** (Sign in with Apple REST API / `revokeToken`). Recenzent to provjerava. | <https://developer.apple.com/news/?id=12m75xbj> |
| Google Play | Brisanje mora biti moguće **u aplikaciji I putem javnog web resursa** dostupnog bez aplikacije; taj URL se upisuje u Data safety obrazac. | <https://support.google.com/googleplay/android-developer/answer/13327111> |
| Firebase (kako opozvati) | Firebase ne čuva Appleov token, pa se korisnika mora ponovno autentificirati (`reauthenticateWithPopup`), izvaditi token iz `OAuthProvider.credentialFromResult(...)` i pozvati `revokeAccessToken(auth, token)`. | <https://firebase.google.com/docs/auth/web/apple> |

---

## 2. Tok brisanja, korak po korak

Ulazna točka: **Profil → Postavke → "Brisanje računa"**, posljednja kartica na
stranici (`frontend/src/pages/profile/DeleteAccountCard.tsx`). Dvije brane:
gumb otvara dijalog, a destruktivni gumb u dijalogu je onemogućen dok se ne
upiše riječ `OBRIŠI` (sl. `IZBRIŠI`).

Nakon potvrde izvršavaju se četiri koraka, tim redom:

1. **Opoziv Apple tokena** — `frontend/src/auth/appleRevocation.ts`.
   Preskače se ako račun nema `apple.com` među pružateljima prijave.
   - Web: `reauthenticateWithPopup(user, appleProvider)` →
     `OAuthProvider.credentialFromResult(result).accessToken` →
     `revokeAccessToken(auth, token)`.
   - Native: `@capacitor-firebase/authentication` nema `reauthenticate`, pa se
     Appleov list ponovno otvara sa `signInWithApple({ skipNativeAuth: true })`
     (postojeća sesija ostaje netaknuta) i dobiveni `authorizationCode`
     (fallback `accessToken`) šalje u `revokeAccessToken({ token })`. Plugin to
     na iOS-u mapira na `Auth.revokeToken(withAuthorizationCode:)`, a na
     Androidu na `FirebaseAuth.revokeAccessToken`.

   **Zašto prvi:** opoziv traži živ račun i korisnika kojeg se još može
   pitati za ponovnu prijavu — oboje nestaje u koraku 2. Ponovna prijava
   ujedno usput rješava `auth/requires-recent-login` iz koraka 3.

   **Zašto smije pasti:** dva smjera pogreške nisu simetrična. *Opoziv uspio,
   brisanje palo* je bezopasno — opoziv povlači samo OAuth suglasnost, račun
   ostaje i korisnik sljedeći put samo vidi Appleov ekran privole. *Brisanje
   uspjelo, opoziv pao* je loš smjer i upravo ono zbog čega Apple odbija. Zato
   opoziv ide prvi, ali je **best-effort**: otkazan list, blokiran skočni
   prozor ili Appleov ispad ne smiju zarobiti korisnika u računu koji je
   tražio obrisati (nemogućnost brisanja je sama po sebi kršenje 5.1.1(v)).
   Pad se korisniku javi porukom `profile.deleteAccount.appleRevokeFailed`
   koja kaže gdje da sam ukloni aplikaciju u iOS postavkama.

2. **`DELETE /api/user/me`** — `UserMeController.deleteAccount` →
   `services/AccountDeletionService`. Cijela lista iz odjeljka 3 izvršava se
   unutar jedne transakcije (`@Transactional` je na metodi kontrolera), dakle
   ili sve ili ništa. Idempotentno: drugi poziv vraća 204 i ne piše ništa.
   Ako ovaj korak padne, klijent **staje** — ne odjavljuje korisnika iz računa
   koji još postoji.

3. **Brisanje Firebase korisnika** — tri neovisna puta, jer svaki može pasti
   sam za sebe:
   - poslužitelj: `FirebaseAuth.deleteUser(uid)` preko Admin SDK-a, ako su
     vjerodajnice konfigurirane (vidi odjeljak 6);
   - native: `FirebaseAuthentication.deleteUser()` (plugin ima vlastitu
     sesiju, onu s kojom je povezan FCM token);
   - web/JS: `deleteUser(currentUser)`.

   `auth/requires-recent-login` nije greška brisanja — korak 2 je već prošao —
   pa se objasni porukom i odjava se nastavlja.

4. **Odjava i čišćenje uređaja** — `signOut()`, `queryClient.clear()`,
   `persister.removeClient()` te `frontend/src/auth/localPurge.ts`:
   briše `bela:blok:v1`, `bela:opq:v1`, `bela:selfreg:v1`, sve `bela:waiter:*`
   i predmemoriju `bela-api*` u Cache Storageu.

### Sigurnosna mreža: ponovno stvaranje profila

Profili se stvaraju lijeno (`SlugService.ensureProfile`), pa bi
`POST /user/me/sync` na sljedećem bootu mogao tiho uskrsnuti obrisani račun.
Ne može: `SlugService` za profil s `deleted_at` baca **410 `ACCOUNT_DELETED`**,
`api/userMe.ts#syncProfileTolerant` to prevodi u `{ deleted: true }`, a
`auth/AuthContext.tsx#abandonDeletedAccount` tu sesiju odjavi i objasni.

---

## 3. Tablica podataka

### Briše se

| Tablica / mjesto | Napomena |
| --- | --- |
| `user_profiles` (polja) | ime, telefon, država, avatar preset, jezik, tema — postavljeni na `null`, `deleted_at` ožigosan |
| avatar u MinIO + `resources` red | `StorageService.releaseIfOrphaned` (best-effort; izvan transakcije) |
| `game_names` | ime za stolom |
| `push_subscriptions`, `push_devices` | sve pretplate i tokeni uređaja |
| `blok_sessions` | povijest Blok bilježnice |
| `user_blocks` | u oba smjera |
| `user_pair_presets` | vlastiti se brišu; oni sa suvlasnikom prelaze suvlasniku; `co_owner_uid` i `archive_request_by_uid` se čiste |
| `pair_requests` | **dodano 2026-09-20** — oglas "tražim para" nosi ime i telefon u vlastitim stupcima, ništa ga ne referencira |
| `user_drink_templates` | **dodano 2026-09-20** — vlastiti predlošci cjenika, ključani samo na uid |
| `game_reliability_events` | **dodano 2026-09-20** — karma i napuštanja; zapis o osobi, ne o partiji |
| `processed_operations` | **dodano 2026-09-20** — idempotencijski dnevnik pohranjuje **tijelo odgovora** svake operacije iz offline reda (imena parova, telefoni) |
| `pairs.contact_phone` | postavljen na `null` na svim parovima koje je korisnik prijavio ili suprijavio |
| Firebase Auth korisnik | e-pošta/lozinka odnosno vezani Google/Apple račun; Apple token dodatno opozvan |
| localStorage / Cache Storage | vidi korak 4 gore |

### Zadržava se — i zašto

| Tablica / polje | Razlog |
| --- | --- |
| `user_profiles` red + `slug` | Prazan red drži uid koji stoji na tuđim redovima (prikaz "Obrisani korisnik" umjesto NPE-a) i **zauzima slug zauvijek**, da stare poveznice daju uredan 404 umjesto da adresu naslijedi netko drugi s istim imenom |
| `tournaments.created_by_uid` | Osiroteli turnir i dalje treba vlasnički uid za admin preglase |
| `pairs.submitted_by_uid` / `co_submitted_by_uid` | Turnir je zajednička povijest — brisanje parova prepisalo bi rezultate svih ostalih |
| `game_results`, `game_result_players` | Za stolom su četiri igrača; `game_result_players` nosi samo uid i sjedalo, nikakvo ime |
| `content_reports` | Moderacijski zapis — upravo ono što ne smije nestati kad prijavljena strana ode. Čuva se do rješavanja |
| `contact_messages` | Vlastiti rok čuvanja: IP ≤ 30 dana, poruka ≤ 12 mjeseci |
| `matches.paid_by_uid`, `match_score_links.*_uid` | Zapis o računu/rezultatu turnira, bez osobnih podataka osim uida |
| Zapisi poslužitelja (IP, request id) | Legitimni interes: sigurnost i otklanjanje poteškoća, kratkoročno |
| `bela.guest` (lokalno + iOS Keychain) | **Zasebna anonimna identitet**, nikad dio Firebase računa koji se briše; može pripadati drugoj osobi na istom uređaju |

---

## 4. Javna stranica

`https://bela.games/brisanje-racuna` — `frontend/src/pages/AccountDeletionPage.tsx`,
ruta u `App.tsx`, tekst u `i18n/{hr,sl}/legal.ts` pod `deletion.*`.

Bez prijave, bez API poziva. Naziv i adresa dolaze iz `src/site.ts`
(`siteName`, `publicOrigin`), pa se ista stranica ispravno čita na sve tri
domene; na igraćim domenama (`isGamesSite`) izostavljene su stavke koje
spominju turnire. Put namjerno **nije** u `FULL_SITE_ONLY_PREFIXES`.

Poveznice na nju: kartica za brisanje u profilu i odjeljak "Brisanje računa"
u pravilima privatnosti (`/privatnost`).

Iste adrese na ostalim domenama, ako zatrebaju:
`https://belot.games/brisanje-racuna`, `https://bela-turniri.com/brisanje-racuna`.

Brisanje bez mogućnosti prijave ide preko kontakt obrasca (`/kontakt`) —
aplikacija nema objavljenu e-mail adresu, obrazac je jedini kanal.

---

## 5. Što upisati u obrasce trgovina

### Apple — App Store Connect

- **App Review Information → Notes**: napiši da se račun briše u
  *Profil → Postavke → Brisanje računa*, uz potvrdu upisom riječi `OBRIŠI`, i
  da se za Apple prijavu poziva opoziv tokena. Dodaj i javni URL
  `https://bela.games/brisanje-racuna`.
- **App Privacy → Data Types**: postojeće izjave se ne mijenjaju; brisanje
  računa nije zaseban tip podatka. Bitno je da su *Contact Info (Email,
  Phone, Name)*, *User Content (Photos)*, *Identifiers (User ID)* i
  *Usage/Diagnostics* vezani uz identitet deklarirani i **povezani s
  korisnikom** (Linked to You), jer to i jesu.
- **Account Deletion**: u recenzentskim bilješkama navedi testni račun i
  napomenu da je brisanje trenutno i nepovratno (nema "grace period").

### Google Play — Data safety

- *Does your app allow users to request that some or all of their data is
  deleted?* → **Yes**.
- *Account deletion*: **"Users can request account deletion"** → Yes, uz
  **Account deletion URL**: `https://bela.games/brisanje-racuna`.
- Ako se objavi i verzija za `belot.games`, koristi URL te domene.
- *Data deletion request URL* (brisanje podataka bez brisanja računa) —
  ista stranica, jer opisuje i taj put (kontakt obrazac).

---

## 6. Preduvjeti u produkciji

| Preduvjet | Stanje prema repozitoriju |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` ili `FIREBASE_SERVICE_ACCOUNT_FILE` | **Nije potvrđeno da je postavljeno.** `docker-compose.prod.yaml:209-210` ih prosljeđuje s praznim defaultom (`:-`), a `.env.example:81,83` ih ostavlja prazne. Stvarni `.env` na poslužitelju nije u repozitoriju, pa se iz koda **ne može zaključiti** je li konfiguriran. Bez njega `AccountDeletionService.deleteFirebaseUser` zapiše WARN *"Firebase Auth user … was NOT deleted server-side"*, a brisanje Firebase korisnika ovisi isključivo o klijentskom `deleteUser()`. **Provjeriti prije predaje u trgovine.** |
| Apple Sign in ključ u Firebase konzoli | Opoziv tokena radi samo ako je Apple pružatelj u Firebaseu konfiguriran s Services ID-om, Team ID-om, Key ID-om i privatnim ključem. Bez toga `revokeAccessToken` padne, a tok se nastavi (korisnik dobije poruku da sam ukloni aplikaciju u postavkama). |
| Ruta na igraćim domenama | Caddyjev `@full_only` blok u `Caddyfile` mora nastaviti propuštati `/brisanje-racuna` (nije na popisu, pa propušta). |
| Sigurnosne kopije | `./ops/backup-db.sh` čuva 14 dnevnih kopija; obrisani podaci iz njih nestaju unutar tog roka. To je rok naveden na javnoj stranici. |

---

## 7. Poznata ograničenja (nisu popravljena)

1. **Token obrisanog korisnika ostaje valjan do isteka.** Firebase ID token je
   JWT bez provjere opoziva; brisanje Auth korisnika ne poništava već izdane
   tokene. Backend i game server (`game/packages/server/src/auth.ts`) ih
   prihvaćaju do `exp` (do ~1 h). U praksi se klijent odmah odjavi i socket
   se zatvori, ali teoretski se može nastaviti igrati do isteka. Ispravak
   traži provjeru `tokens_valid_after` / `deleted_at` pri verifikaciji, u
   backendu i u game serveru.
2. **Game server drži predmemoriju profila 5 minuta**
   (`profiles.ts`, `HIT_TTL_MS`). Nakon brisanja interni endpoint vraća 200 s
   `null` imenom, pa sjedalo padne na `Igrač`, ali tek nakon isteka TTL-a.
   Bezopasno, ali nije trenutno.
3. **`contact_messages` se ne brišu pri brisanju računa** — oslanjaju se na
   vlastiti rok (30 dana IP / 12 mjeseci poruka). Navedeno je na javnoj
   stranici i u pravilima privatnosti kao svjesna odluka.
