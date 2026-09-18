package com.belaturniri.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FoldablePlugin.class);
        registerPlugin(BelaLiveActivityPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
