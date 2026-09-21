#!/usr/bin/env bash
#
# create-games-native.sh — build the ios-games/ and android-games/ native
# projects for the SECOND app (games.bela.app, "Bela Online", bela.games).
#
# ─────────────────────────────────────────────────────────────────────────────
# Why a copy and not `cap add`
# ─────────────────────────────────────────────────────────────────────────────
# `CAP_APP=games npx cap add ios` produces a VIRGIN Capacitor project. This
# repo's ios/ and android/ are anything but virgin — a year of hand edits lives
# in them that `cap add` would not reproduce:
#
#   iOS      App.entitlements (aps-environment, Sign in with Apple,
#            Associated Domains),
#            Info.plist (UIBackgroundModes remote-notification, the Croatian
#            NS*UsageDescription strings, NSSupportsLiveActivities,
#            UIRequiredDeviceCapabilities arm64, the scene manifest pointing
#            at Main.storyboard, the Google reversed-client-id URL scheme),
#            App/PrivacyInfo.xcprivacy (the app-level privacy manifest, and
#            the pbxproj Resources entry that actually bundles it),
#            AppDelegate.swift (guarded FirebaseApp.configure() + the stale
#            Live Activity sweep), SceneDelegate.swift (which must NOT
#            replace the storyboard's root view controller),
#            AppBridgeViewController.swift,
#            BelaLiveActivityPlugin.swift + BelaActivityAttributes.swift,
#            GuestKeychainPlugin.swift, Assets.xcassets (icon + splash),
#            debug.xcconfig, and the whole BelaActivity/ widget-extension
#            target (Live Activity + Dynamic Island).
#            (No Podfile — this project is on Swift Package Manager,
#            App/CapApp-SPM, which `cap sync` regenerates.)
#
#   Android  AndroidManifest.xml (App Links intent-filter, the FCM channel
#            meta-data, the BelaMessagingService swap that `tools:node="remove"`s
#            the plugin's own service, the FileProvider, the permission set
#            deliberately COARSE-only), app/build.gradle (firebase-messaging,
#            window-java, work-runtime-ktx, the google-services soft-apply),
#            MainActivity.java (registerPlugin Foldable + BelaLiveActivity),
#            FoldablePlugin, BelaLiveActivityPlugin, LiveGameState,
#            LiveGameNotification, BelaMessagingService, res/ (icons, splash,
#            values-sl, shortcuts.xml, widget layouts).
#
# So: copy, then patch identity. Everything generated (builds, Pods, Gradle
# caches, the synced web assets, the Cordova shims, Xcode user state) is left
# behind, because `cap sync` recreates all of it for the new project.
#
# ─────────────────────────────────────────────────────────────────────────────
# Usage
# ─────────────────────────────────────────────────────────────────────────────
#   cd frontend
#   npm run native:games:create            # refuses if ios-games/ exists
#   npm run native:games:create -- --force # wipes and recreates both
#   bash scripts/create-games-native.sh --ios-only | --android-only
#
# Idempotent: without --force it never touches an existing project, so a
# second run is a no-op rather than a silent overwrite of your work.
#
# It does NOT run cap sync, gradle, pod or xcodebuild — see
# docs/BELA-GAMES-NATIVE.md for the ordered checklist around this script.

set -euo pipefail

# ── identity ────────────────────────────────────────────────────────────────
OLD_ID="com.belaturniri.app"
NEW_ID="games.bela.app"
OLD_DIR="com/belaturniri/app"
NEW_DIR="games/bela/app"
OLD_NAME="Bela Turniri"
NEW_NAME="Bela Online"
OLD_HOST="bela-turniri.com"
# The games product is served on TWO equal apex domains (src/site.ts
# GAMES_DOMAINS). Neither redirects to the other, so the ONE app has to claim
# both: Associated Domains gets an applinks entry per domain, and the Android
# App Links intent-filter gets a <data> host per domain. NEW_HOST is the
# primary — the one baked into VITE_API_URL, outward share links and the
# shortcut targets; NEW_HOST_ALT is the twin, which only ever appears in the
# link-claiming configuration.
NEW_HOST="bela.games"
NEW_HOST_ALT="belot.games"

FRONTEND="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$FRONTEND"

FORCE=0
DO_IOS=1
DO_ANDROID=1
for arg in "$@"; do
    case "$arg" in
        --force) FORCE=1 ;;
        --ios-only) DO_ANDROID=0 ;;
        --android-only) DO_IOS=0 ;;
        -h|--help) sed -n '1,60p' "${BASH_SOURCE[0]}"; exit 0 ;;
        *) echo "unknown argument: $arg" >&2; exit 2 ;;
    esac
done

say()  { printf '  %s\n' "$*"; }
step() { printf '\n▸ %s\n' "$*"; }
die()  { printf '\n✗ %s\n' "$*" >&2; exit 1; }

command -v rsync   >/dev/null || die "rsync not found"
command -v python3 >/dev/null || die "python3 not found (used for the block edits)"

[ -d ios ]     || die "frontend/ios does not exist — nothing to copy from"
[ -d android ] || die "frontend/android does not exist — nothing to copy from"

guard() {  # guard <dir>
    [ -e "$1" ] || return 0
    [ "$FORCE" = "1" ] || die "$1 already exists. Re-run with --force to wipe and recreate it (you WILL lose any hand edits in there)."
    say "--force: removing existing $1"
    rm -rf "$1"
}

# Remove a file or directory that is EXPECTED to be there, and say so loudly
# when it is not. `rm -f` on a path that moved upstream succeeds and leaves
# the feature shipped; this turns that silent success into a log line.
rm_checked() {  # rm_checked <path>
    if [ ! -e "$1" ]; then
        printf '  ! expected to remove %s but it does not exist — check whether it moved\n' "$1" >&2
        return 0
    fi
    rm -rf "$1"
    say "removed $1"
}

# `sed -i ''` on macOS vs `sed -i` on GNU — normalise once.
sedi() { if sed --version >/dev/null 2>&1; then sed -i "$@"; else sed -i '' "$@"; fi; }

# Run sedi over every file matching a find expression, without ever invoking
# sed with an empty file list (BSD xargs would then leave sed reading stdin
# and the script would hang).
sed_find() {  # sed_find <sed-script> <dir> <find-args...>
    local script="$1" dir="$2"; shift 2
    local files=()
    while IFS= read -r -d '' f; do files+=("$f"); done < <(find "$dir" "$@" -print0)
    [ ${#files[@]} -gt 0 ] || { say "! no files matched under $dir — skipped"; return 0; }
    sedi "$script" "${files[@]}"
}

# Remove one exact literal block from a file. Warns (does not fail) when the
# block is not found, because that means the upstream file drifted and the
# owner has to look at it — silently continuing with a half-patched project
# would be worse than a loud note in the log.
py_drop() {  # py_drop <file> <<'EOF' ...block... EOF
    local file="$1"
    local block
    block="$(cat)"
    BLOCK="$block" python3 - "$file" <<'PY'
import os, sys
path = sys.argv[1]
block = os.environ["BLOCK"]
src = open(path, encoding="utf-8").read()
if block not in src:
    sys.stderr.write(f"  ! block not found in {path} — remove it by hand (see docs/BELA-GAMES-NATIVE.md)\n")
    sys.exit(0)
open(path, "w", encoding="utf-8").write(src.replace(block, "", 1))
print(f"  removed a block from {path}")
PY
}

# Append <add> straight after the first occurrence of <anchor>. Idempotent:
# if <add> is already in the file, nothing happens, so re-running the script
# over a half-patched tree never duplicates a line. Same loud-warn-on-miss
# contract as py_drop.
py_after() {  # py_after <file> <anchor> <add>
    ANCHOR="$2" ADD="$3" python3 - "$1" <<'PY'
import os, sys
path, anchor, add = sys.argv[1], os.environ["ANCHOR"], os.environ["ADD"]
src = open(path, encoding="utf-8").read()
if add in src:
    print(f"  already present in {path} — left alone")
    sys.exit(0)
if anchor not in src:
    sys.stderr.write(f"  ! anchor not found in {path} — add this by hand:\n      {add.strip()}\n")
    sys.exit(0)
open(path, "w", encoding="utf-8").write(src.replace(anchor, anchor + add, 1))
print(f"  added {add.strip()} to {path}")
PY
}

# ═══════════════════════════════════════════════════════════════════════════
# iOS
# ═══════════════════════════════════════════════════════════════════════════
if [ "$DO_IOS" = "1" ]; then
    guard ios-games

    step "copying ios/ → ios-games/"
    # Excludes, in order: Xcode build output, CocoaPods (unused here but a
    # stale checkout may have them), the web assets cap sync copies in, the
    # SPM checkout state, Xcode per-user state (breakpoints, schemes, the
    # window layout — carrying another project's xcuserdata over is how you
    # get a scheme pointing at the wrong bundle id), the Cordova shim dir and
    # the two config files `cap sync` regenerates from capacitor.config.ts.
    rsync -a \
        --exclude 'App/build/' \
        --exclude 'App/output/' \
        --exclude 'App/Pods/' \
        --exclude 'Podfile.lock' \
        --exclude 'App/App/public/' \
        --exclude 'App/App/capacitor.config.json' \
        --exclude 'App/App/config.xml' \
        --exclude 'DerivedData/' \
        --exclude '*.xcuserdatad/' \
        --exclude 'xcuserdata/' \
        --exclude '*.xcuserstate' \
        --exclude '.swiftpm/' \
        --exclude '.build/' \
        --exclude 'capacitor-cordova-ios-plugins/' \
        ios/ ios-games/

    step "patching iOS identity"
    # Bundle id in every build configuration of EVERY target. No trailing ';'
    # in the pattern on purpose: the BelaActivity widget extension's id is
    # "<app id>.BelaActivity", and Apple requires an extension's bundle id to
    # stay a prefix-child of its host app's, so it has to move along.
    sed_find "s|PRODUCT_BUNDLE_IDENTIFIER = ${OLD_ID}|PRODUCT_BUNDLE_IDENTIFIER = ${NEW_ID}|g" ios-games -name 'project.pbxproj'
    say "PRODUCT_BUNDLE_IDENTIFIER → ${NEW_ID} (+ ${NEW_ID}.BelaActivity)"

    # Signing must be re-chosen in Xcode for the new App ID. Automatic signing
    # is already the mode (CODE_SIGN_STYLE = Automatic) and no DEVELOPMENT_TEAM
    # is committed; strip one anyway in case a local build wrote it in, so the
    # copy can never inherit a team/profile pairing that belongs to the other
    # app's provisioning profile.
    sed_find '/DEVELOPMENT_TEAM = /d' ios-games -name 'project.pbxproj'
    sed_find '/PROVISIONING_PROFILE_SPECIFIER = /d' ios-games -name 'project.pbxproj'

    # Home-screen name.
    sedi "s|<string>${OLD_NAME}</string>|<string>${NEW_NAME}</string>|g" ios-games/App/App/Info.plist
    say "CFBundleDisplayName → ${NEW_NAME}"

    # Associated Domains: this app owns the links of BOTH games twins, and
    # none of the tournaments host's. Apple matches the entitlement string
    # against the exact hostname, so each domain needs its own entry — there
    # is no wildcard that covers two different apexes. (`www.` is not listed,
    # matching how the tournaments app does it: www.* is a 301 to the apex in
    # Caddy, and the OS follows the redirect to a host that IS claimed.)
    sedi "s|applinks:${OLD_HOST}|applinks:${NEW_HOST}|g;s|webcredentials:${OLD_HOST}|webcredentials:${NEW_HOST}|g" \
        ios-games/App/App/App.entitlements
    py_after ios-games/App/App/App.entitlements \
        "<string>applinks:${NEW_HOST}</string>" \
        "
		<string>applinks:${NEW_HOST_ALT}</string>"
    py_after ios-games/App/App/App.entitlements \
        "<string>webcredentials:${NEW_HOST}</string>" \
        "
		<string>webcredentials:${NEW_HOST_ALT}</string>"
    # The entitlements file names the App ID in a comment ("…must have the
    # capability enabled in the Apple Developer portal"). Keep it honest.
    sedi "s|${OLD_ID}|${NEW_ID}|g" ios-games/App/App/App.entitlements
    say "Associated Domains → applinks/webcredentials for ${NEW_HOST} + ${NEW_HOST_ALT}"

    # Google sign-in URL scheme. The new Firebase iOS app has its OWN reversed
    # client id; carrying the tournaments app's over would send the Safari
    # callback to a scheme this bundle does not own. Reset it to a placeholder
    # that is impossible to mistake for a working value.
    sedi "s|com.googleusercontent.apps.REPLACE_WITH_REVERSED_CLIENT_ID|com.googleusercontent.apps.REPLACE_WITH_REVERSED_CLIENT_ID_FOR_${NEW_ID}|g" \
        ios-games/App/App/Info.plist
    # …and if the owner had already filled the real one in, blow it away too.
    python3 - ios-games/App/App/Info.plist <<'PY'
import re, sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
s2 = re.sub(r"com\.googleusercontent\.apps\.\d[\w.-]*",
            "com.googleusercontent.apps.REPLACE_WITH_REVERSED_CLIENT_ID_FOR_games.bela.app", s)
if s2 != s:
    open(p, "w", encoding="utf-8").write(s2)
    print("  reset a real reversed client id to the games placeholder")
PY

    # Camera / photo-library usage strings. The tournaments wording mentions
    # posters, which the games app has no screen for; the only image picker
    # it can reach is the avatar on /profil. A usage string that describes a
    # feature the reviewer cannot find is a Resolution Center round trip.
    # (There is deliberately NO NSLocation*UsageDescription in either app —
    # see the comment in ios/App/App/Info.plist.)
    sedi \
        "s|<string>Koristi se za snimanje fotografija za postere turnira i profilne slike.</string>|<string>Koristi se za snimanje profilne slike.</string>|; \
         s|<string>Koristi se za odabir fotografija za postere turnira i profilne slike.</string>|<string>Koristi se za odabir profilne slike iz galerije.</string>|" \
        ios-games/App/App/Info.plist
    say "NSCamera/NSPhotoLibrary usage strings → profile-photo wording"

    # The other app's Firebase config must never ride along: it would point
    # this binary at the wrong iOS app in the Firebase project, and FCM tokens
    # would be minted for a bundle id that does not match.
    if [ -f ios-games/App/App/GoogleService-Info.plist ]; then
        rm -f ios-games/App/App/GoogleService-Info.plist
        say "removed the copied GoogleService-Info.plist"
    fi

    # Nothing to patch for `aps-environment`: it stays "development" in the
    # committed entitlements of both apps and Xcode rewrites it to
    # "production" when signing for distribution. The privacy manifests
    # (App/PrivacyInfo.xcprivacy and BelaActivity/PrivacyInfo.xcprivacy)
    # describe the product, not the bundle id, so they copy over unchanged —
    # and their pbxproj Resources entries came along with the pbxproj.

    # Safety net: the widget-extension target only exists if
    # add-live-activity-target.rb has been run against ios/. If the copy did
    # not inherit it, say so loudly instead of shipping a games app whose
    # Info.plist advertises NSSupportsLiveActivities with nothing to draw.
    if grep -q 'BelaActivity.appex' ios-games/App/App.xcodeproj/project.pbxproj; then
        say "BelaActivity widget extension carried over (id ${NEW_ID}.BelaActivity)"
    else
        say "! ios-games has NO BelaActivity target — run"
        say "    ruby scripts/add-live-activity-target.rb ios/App/App.xcodeproj"
        say "  against ios/ first, then re-run this script with --force,"
        say "  or run it against ios-games/App/App.xcodeproj directly."
    fi

    say "done: ios-games/"
fi

# ═══════════════════════════════════════════════════════════════════════════
# Android
# ═══════════════════════════════════════════════════════════════════════════
if [ "$DO_ANDROID" = "1" ]; then
    guard android-games

    step "copying android/ → android-games/"
    # Excludes: Gradle build output and caches, the machine-local SDK path,
    # the web assets + config.xml cap sync writes, and the Cordova shim module
    # cap sync regenerates. capacitor.settings.gradle / capacitor.build.gradle
    # ARE copied — they only contain ../node_modules paths, which resolve the
    # same from android-games/ as from android/ (same depth), and cap sync
    # rewrites them on the first run anyway.
    rsync -a \
        --exclude 'build/' \
        --exclude '.gradle/' \
        --exclude '.kotlin/' \
        --exclude '.idea/' \
        --exclude 'local.properties' \
        --exclude 'app/src/main/assets/' \
        --exclude 'app/src/main/res/xml/config.xml' \
        --exclude 'capacitor-cordova-android-plugins/' \
        --exclude '*.jks' --exclude '*.keystore' --exclude '*.p12' --exclude '*.pepk' \
        --exclude 'keystore.properties' --exclude 'keystore.properties.local' \
        android/ android-games/
    # Signing material is never copied: the games app gets its OWN upload key
    # (its own Play listing, its own App Signing key). app/build.gradle leaves
    # `release` unsigned when no keystore.properties / BELA_KEYSTORE_* is
    # present, so the copy configures and builds fine without one.
    #
    # Everything else IS carried by the copy, including the files added in the
    # 2026-09-20 Android pass: res/drawable/ic_stat_bela.xml (notification
    # small icon), res/xml/{backup_rules,data_extraction_rules,locales_config}
    # .xml, LiveGameTaskWatcherService.kt, and the app/.gitignore that keeps
    # keystores out of git. They need no patching beyond the package/host
    # rewrites below, which reach them like every other source and resource.

    step "patching Android identity"
    # 1. Move the Java/Kotlin package directory. Gradle does not care, but
    #    every IDE and every `package` statement does, and leaving sources in
    #    com/belaturniri/app while the namespace says games.bela.app is the
    #    classic "class not found at runtime" setup.
    for root in android-games/app/src/main/java android-games/app/src/debug/java android-games/app/src/release/java; do
        [ -d "$root/$OLD_DIR" ] || continue
        mkdir -p "$root/$(dirname "$NEW_DIR")"
        mv "$root/$OLD_DIR" "$root/$NEW_DIR"
        # Clean up the now-empty com/belaturniri chain.
        rmdir -p "$root/$(dirname "$OLD_DIR")" 2>/dev/null || true
        say "moved $root/$OLD_DIR → $root/$NEW_DIR"
    done

    # 2. applicationId, namespace, package statements, strings.xml
    #    package_name/custom_url_scheme, shortcut targetPackage/targetClass,
    #    the FileProvider authority (that one is ${applicationId}, so it
    #    follows on its own).
    sed_find "s|${OLD_ID}|${NEW_ID}|g" android-games \
        \( -name '*.java' -o -name '*.kt' -o -name '*.gradle' -o -name '*.xml' -o -name '*.pro' \)
    say "applicationId / namespace / package → ${NEW_ID}"

    # 3. App Links host + every deep link baked into resources. The shortcut
    #    intents keep pointing at the PRIMARY domain only — a launcher
    #    shortcut needs one concrete URL, and the twin resolves to the same
    #    screen anyway.
    #
    #    Kotlin/Java are swept too, and that is not belt-and-braces paranoia:
    #    LiveGameNotification.kt used to hold
    #    `DEEP_LINK_BASE = "https://bela-turniri.com/igra/"` as a constant, an
    #    *.xml-only rewrite left it untouched, and the games build then posted
    #    a live-game notification whose tap NativeShell.tsx's isGamesHost()
    #    check rejected — a dead notification, in the one app that is actually
    #    shipping. The host now lives in R.string.live_deep_link_base (i.e. in
    #    an .xml, where the rewrite reaches it); this sweep is the guard
    #    against the next constant someone inlines.
    sed_find "s|${OLD_HOST}|${NEW_HOST}|g" android-games \
        \( -name '*.xml' -o -name '*.kt' -o -name '*.java' -o -name '*.gradle' -o -name '*.pro' \)
    say "App Links host + shortcut URLs + any host in sources → ${NEW_HOST}"

    #    The twin domain gets a second <data> host inside the SAME
    #    intent-filter. Android expands <data> elements combinatorially, so
    #    one added host line applies to every path prefix already listed, and
    #    autoVerify then checks /.well-known/assetlinks.json on both domains
    #    (both must serve it, or Android marks the whole filter unverified).
    py_after android-games/app/src/main/AndroidManifest.xml \
        "<data android:scheme=\"https\" android:host=\"${NEW_HOST}\" />" \
        "
                <data android:scheme=\"https\" android:host=\"${NEW_HOST_ALT}\" />"

    # 4. Launcher label.
    sed_find "s|>${OLD_NAME}<|>${NEW_NAME}<|g" android-games -name 'strings.xml'
    say "app_name / title_activity_main → ${NEW_NAME}"

    # 5. The other app's Firebase config must not ride along (same reasoning
    #    as iOS). build.gradle already soft-applies the google-services
    #    plugin only when the file is present, so the project still builds
    #    without it — just with no push.
    if [ -f android-games/app/google-services.json ]; then
        rm -f android-games/app/google-services.json
        say "removed the copied google-services.json"
    fi

    step "stripping tournaments-only Android features"
    # The home-screen widget lists UPCOMING TOURNAMENTS and the "Novi turnir"
    # shortcut opens the create-tournament form — neither route exists in a
    # games build (src/site.ts FULL_SITE_ONLY_PREFIXES), and shipping either
    # one is also the fastest way to make a reviewer ask why a "games only"
    # app advertises the other app's features.
    #
    # ORDER MATTERS, and the original order was wrong: the files were deleted
    # FIRST and the XML that references them dropped afterwards. Since py_drop
    # only warns when its block has drifted, a single upstream reformat of
    # shortcuts.xml produced a project whose remaining <shortcut> pointed at a
    # `@drawable/ic_shortcut_plus` that no longer existed — an aapt2 "resource
    # not found" at build time, discovered by the owner and not by the script.
    # References are dropped first now, and a file is only deleted once
    # nothing points at it (verified at the end of this block).
    py_drop android-games/app/src/main/AndroidManifest.xml <<'BLOCK'

        <!-- N5.3: "Nadolazeći turniri" home-screen widget. Not exported —
             the system delivers APPWIDGET_UPDATE to this app's own receiver
             by explicit package, so no other app needs to reach it directly.
             See UpcomingTournamentsWidgetProvider.kt / TournamentsWidgetWorker.kt. -->
        <receiver
            android:name=".widget.UpcomingTournamentsWidgetProvider"
            android:exported="false"
            android:label="@string/widget_title">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/upcoming_tournaments_widget_info" />
        </receiver>
BLOCK

    py_drop android-games/app/src/main/res/xml/shortcuts.xml <<'BLOCK'

    <shortcut
        android:shortcutId="new_tournament"
        android:enabled="true"
        android:icon="@drawable/ic_shortcut_plus"
        android:shortcutShortLabel="@string/shortcut_new_tournament_short"
        android:shortcutLongLabel="@string/shortcut_new_tournament_long">
        <intent
            android:action="android.intent.action.VIEW"
            android:targetPackage="games.bela.app"
            android:targetClass="games.bela.app.MainActivity"
            android:data="https://bela.games/turniri/novi" />
    </shortcut>
BLOCK

    # The App Links intent-filter still lists /turniri/, which this build has
    # no route for; drop it so Android never hands this app a link it would
    # only bounce straight back out to the browser. /blok/, /igra/ and
    # /profil/ all stay — the games site has every one of them (see
    # src/site.ts: only the tournaments/calendar/map family is full-site-only).
    py_drop android-games/app/src/main/AndroidManifest.xml <<'BLOCK'
                <data android:pathPrefix="/turniri/" />
BLOCK

    # Only NOW delete the files those blocks referenced. rm_checked warns on a
    # miss instead of succeeding silently: a path that has moved upstream must
    # show up in the log, otherwise the widget quietly ships in the "games
    # only" app.
    rm_checked android-games/app/src/main/java/"$NEW_DIR"/widget
    rm_checked android-games/app/src/main/res/xml/upcoming_tournaments_widget_info.xml
    rm_checked android-games/app/src/main/res/layout/widget_upcoming_tournaments.xml
    rm_checked android-games/app/src/main/res/drawable/ic_shortcut_plus.xml
    # Drawables used only by the widget layout. Harmless if left (unused
    # resources), removed for tidiness and a smaller APK.
    rm_checked android-games/app/src/main/res/drawable/widget_background.xml
    rm_checked android-games/app/src/main/res/drawable/widget_row_background.xml

    # Verify the strip actually held. Any of these surviving means a py_drop
    # block drifted and the project will fail to build (dangling @drawable /
    # @layout / @xml reference, or a <receiver> pointing at a deleted class).
    step "verifying the Android strip"
    strip_ok=1
    android_grep() {  # android_grep <label> <pattern>
        if grep -rq -- "$2" android-games/app/src/main 2>/dev/null; then
            printf '  ! %s still referenced in android-games (pattern: %s)\n' "$1" "$2" >&2
            grep -rn -- "$2" android-games/app/src/main 2>/dev/null | sed 's/^/      /' >&2
            strip_ok=0
        fi
    }
    android_grep "the tournaments widget provider" '.widget.UpcomingTournamentsWidgetProvider'
    android_grep "the widget info xml"             '@xml/upcoming_tournaments_widget_info'
    android_grep "the widget layout"               '@layout/widget_upcoming_tournaments'
    android_grep "the 'Novi turnir' shortcut icon" '@drawable/ic_shortcut_plus'
    android_grep "a /turniri/ deep link"           '/turniri/'
    android_grep "the tournaments host"            "${OLD_HOST}"
    android_grep "the tournaments applicationId"   "${OLD_ID}"
    if [ "$strip_ok" = "1" ]; then
        say "clean: no tournaments-only references left in android-games/app/src/main"
    else
        say "! fix the references listed above BEFORE building — see docs/BELA-GAMES-NATIVE.md §3"
    fi

    say "done: android-games/"
fi

# ═══════════════════════════════════════════════════════════════════════════
step "leftovers to check by hand"
cat <<EOF
  1. Drop in the NEW Firebase config files (see docs/BELA-GAMES-NATIVE.md §1):
       ios-games/App/App/GoogleService-Info.plist
       android-games/app/google-services.json
     Until they exist, push and native Google sign-in are dead: AppDelegate
     skips FirebaseApp.configure(), and app/build.gradle skips the
     google-services plugin. The app still launches — that is deliberate.
  2. ios-games/App/App/Info.plist — paste the REVERSED_CLIENT_ID out of the
     new GoogleService-Info.plist over the placeholder URL scheme.
  3. Icons and splash: ios-games/App/App/Assets.xcassets and
     android-games/app/src/main/res/ are still the TOURNAMENTS artwork. Put
     the bela.games artwork in frontend/resources-games/ and regenerate, or
     replace the image sets by hand.
  4. Xcode: open ios-games/App/App.xcodeproj once and re-pick the signing
     team for BOTH targets (App and BelaActivity), then confirm the App
     target's Signing & Capabilities tab shows Push Notifications, Sign in
     with Apple and Associated Domains with BOTH applinks:${NEW_HOST} and
     applinks:${NEW_HOST_ALT}, against the NEW App ID.
     The App ID ${NEW_ID} must have the Push Notifications capability
     enabled in the developer portal, or signing fails on aps-environment.
     Automatic signing creates the extension's own App ID
     (${NEW_ID}.BelaActivity) by itself — it needs no capabilities.
  5. Both ${NEW_HOST} AND ${NEW_HOST_ALT} must serve the SAME
     /.well-known/apple-app-site-association and /.well-known/assetlinks.json
     (ops/well-known-games/). Android's autoVerify checks every host in the
     intent-filter and marks the whole filter unverified if one fails.
  6. Then, from frontend/:  npm run build:native:games
EOF

printf '\n✓ done\n'
