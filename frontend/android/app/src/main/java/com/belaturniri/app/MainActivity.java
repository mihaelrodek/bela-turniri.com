package com.belaturniri.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FoldablePlugin.class);
        registerPlugin(BelaLiveActivityPlugin.class);

        // Sweep any leftover "partija uživo" notification from a PREVIOUS
        // process. Those are posted with setOngoing(true), so the user cannot
        // dismiss them; if the process died (crash, low memory, task swiped
        // away) before end() ran, nothing else would ever take them down.
        // Safe to do unconditionally: if a game really is still in progress,
        // useLiveActivity re-posts within a second of the table mounting and
        // the stable per-room id makes that a silent replace.
        //
        // savedInstanceState == null restricts this to a genuine fresh start
        // rather than an Activity re-creation, and it runs before super so a
        // notification tap that is about to route into the game cannot race
        // a cancel of the notification it came from.
        if (savedInstanceState == null) {
            LiveGameNotification.INSTANCE.cancelAll(getApplicationContext());
        }

        super.onCreate(savedInstanceState);
    }
}
