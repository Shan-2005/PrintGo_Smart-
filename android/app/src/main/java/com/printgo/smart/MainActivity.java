package com.printgo.smart;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import com.getcapacitor.BridgeActivity;
import com.printgo.smart.PrintGoBridge;

public class MainActivity extends BridgeActivity {
    private static final int LOCK_REQUEST_CODE = 123;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrintGoBridge.class);
        super.onCreate(savedInstanceState);

        // Ensure kiosk mode state is persistent
        getSharedPreferences("kiosk_prefs", MODE_PRIVATE)
                .edit()
                .putBoolean("locked", true)
                .apply();
    }

    private void requestUnlock() {
        KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        if (km != null && km.isDeviceSecure()) {
            Intent intent = km.createConfirmDeviceCredentialIntent("Exit Kiosk", "Enter password to exit the application");
            if (intent != null) {
                startActivityForResult(intent, LOCK_REQUEST_CODE);
            } else {
                unlockAndExit();
            }
        } else {
            unlockAndExit();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == LOCK_REQUEST_CODE && resultCode == RESULT_OK) {
            unlockAndExit();
        }
    }

    public void unlockAndExit() {
        // Disable the watchdog persistently so the service doesn't force-restart the app
        getSharedPreferences("kiosk_prefs", MODE_PRIVATE)
                .edit()
                .putBoolean("locked", false)
                .commit(); // FORCE SAVE TO DISK NOW

        finishAffinity();
        // Delay slightly to ensure disk write is finished before process death
        new android.os.Handler().postDelayed(() -> {
            System.exit(0);
        }, 500);
    }
}
