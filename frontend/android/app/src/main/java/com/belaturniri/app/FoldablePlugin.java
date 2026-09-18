package com.belaturniri.app;

import android.graphics.Rect;

import androidx.core.content.ContextCompat;
import androidx.core.util.Consumer;
import androidx.window.java.layout.WindowInfoTrackerCallbackAdapter;
import androidx.window.layout.DisplayFeature;
import androidx.window.layout.FoldingFeature;
import androidx.window.layout.WindowInfoTracker;
import androidx.window.layout.WindowLayoutInfo;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

@CapacitorPlugin(name = "Foldable")
public class FoldablePlugin extends Plugin {
    private WindowInfoTrackerCallbackAdapter tracker;
    private Consumer<WindowLayoutInfo> listener;
    private JSObject current = emptyState();

    @Override
    protected void handleOnStart() {
        super.handleOnStart();
        if (listener != null) return;

        tracker = new WindowInfoTrackerCallbackAdapter(
            WindowInfoTracker.Companion.getOrCreate(getContext())
        );
        Executor executor = ContextCompat.getMainExecutor(getContext());
        listener = this::onLayoutInfo;
        tracker.addWindowLayoutInfoListener(getActivity(), executor, listener);
    }

    @Override
    protected void handleOnStop() {
        if (tracker != null && listener != null) {
            tracker.removeWindowLayoutInfoListener(listener);
        }
        listener = null;
        tracker = null;
        super.handleOnStop();
    }

    @PluginMethod
    public void getState(PluginCall call) {
        call.resolve(current);
    }

    private void onLayoutInfo(WindowLayoutInfo info) {
        FoldingFeature fold = null;
        for (DisplayFeature feature : info.getDisplayFeatures()) {
            if (feature instanceof FoldingFeature) {
                fold = (FoldingFeature) feature;
                break;
            }
        }

        current = fold == null ? emptyState() : stateFor(fold);
        notifyListeners("foldChange", current, true);
    }

    private JSObject stateFor(FoldingFeature fold) {
        float density = getContext().getResources().getDisplayMetrics().density;
        Rect bounds = fold.getBounds();
        JSObject cssBounds = new JSObject();
        cssBounds.put("left", bounds.left / density);
        cssBounds.put("top", bounds.top / density);
        cssBounds.put("width", bounds.width() / density);
        cssBounds.put("height", bounds.height() / density);

        JSObject state = new JSObject();
        state.put("present", true);
        state.put("separating", fold.isSeparating());
        state.put("orientation", fold.getOrientation() == FoldingFeature.Orientation.VERTICAL ? "vertical" : "horizontal");
        state.put("state", fold.getState() == FoldingFeature.State.HALF_OPENED ? "half-opened" : "flat");
        state.put("occlusion", fold.getOcclusionType() == FoldingFeature.OcclusionType.FULL ? "full" : "none");
        state.put("bounds", cssBounds);
        return state;
    }

    private static JSObject emptyState() {
        JSObject bounds = new JSObject();
        bounds.put("left", 0);
        bounds.put("top", 0);
        bounds.put("width", 0);
        bounds.put("height", 0);

        JSObject state = new JSObject();
        state.put("present", false);
        state.put("separating", false);
        state.put("orientation", "none");
        state.put("state", "none");
        state.put("occlusion", "none");
        state.put("bounds", bounds);
        return state;
    }
}
