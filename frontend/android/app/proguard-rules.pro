# ProGuard/R8 rules for the Capacitor shell.
#
# minifyEnabled is currently FALSE (app/build.gradle), so none of this is
# applied today. It is written and kept correct anyway so that turning R8 on
# is a one-line change instead of an afternoon of "works in debug, blank
# screen in release". Everything below exists because the referenced code is
# reached by REFLECTION or from JavaScript — R8 cannot see either, and its
# default rules do not cover them.

# ── Capacitor plugin discovery ──────────────────────────────────────────────
# The bridge instantiates plugins by class and resolves @PluginMethod methods
# by name at runtime, from the JS call. Names must survive.
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod <methods>;
}
-keep class com.getcapacitor.** { *; }
-keepnames class com.getcapacitor.** { *; }
# Annotations themselves must not be stripped, or the lookups above find nothing.
-keepattributes *Annotation*, InnerClasses, Signature, EnclosingMethod

# ── @JavascriptInterface bridges ────────────────────────────────────────────
# Anything the WebView calls into is, by definition, only reachable reflectively.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── This app's own native plugins and their manifest-declared components ────
# BelaLiveActivityPlugin + FoldablePlugin: registered by class in
# MainActivity and addressed by jsName from src/platform/*.ts.
# BelaMessagingService / LiveGameTaskWatcherService /
# UpcomingTournamentsWidgetProvider: instantiated by the SYSTEM from the
# android:name in AndroidManifest.xml, which R8 does rewrite — but only for
# classes it can prove are the manifest's; keep them explicitly.
-keep class com.belaturniri.app.BelaLiveActivityPlugin { *; }
-keep class com.belaturniri.app.FoldablePlugin { *; }
-keep class com.belaturniri.app.MainActivity { *; }
-keep class com.belaturniri.app.BelaMessagingService { *; }
-keep class com.belaturniri.app.LiveGameTaskWatcherService { *; }
-keep class com.belaturniri.app.LiveGameNotification { *; }
-keep class com.belaturniri.app.LiveGameState { *; }
-keep class com.belaturniri.app.widget.** { *; }

# ── WorkManager ─────────────────────────────────────────────────────────────
# Workers are constructed by name from persisted work specs, so an obfuscated
# name in the database and a renamed class stop matching after an update.
-keep class * extends androidx.work.Worker { *; }
-keep class * extends androidx.work.ListenableWorker { *; }
-keepclassmembers class * extends androidx.work.ListenableWorker {
    public <init>(android.content.Context, androidx.work.WorkerParameters);
}

# ── Firebase / FCM ──────────────────────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**
# The messaging plugin we subclass in BelaMessagingService.
-keep class io.capawesome.capacitorjs.plugins.firebase.** { *; }

# ── Cordova plugin shims (capacitor-cordova-android-plugins) ────────────────
# Cordova resolves plugin classes from a generated name table — pure reflection.
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# ── Keep line numbers in crash reports ──────────────────────────────────────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
