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

public class MainActivity extends BridgeActivity {
    private static final int LOCK_REQUEST_CODE = 123;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativePrintPlugin.class);
        registerPlugin(UsbPrintPlugin.class);
        setTheme(R.style.AppTheme_NoActionBarLaunch);
        super.onCreate(savedInstanceState);

        // Every time the app is launched, enable the Kiosk Lock
        getSharedPreferences("kiosk_prefs", MODE_PRIVATE)
                .edit()
                .putBoolean("locked", true)
                .commit(); // Use .commit() for reliability

        // Add a floating "Exit" button top-left
        addExitButton();
    }

    private void addExitButton() {
        ImageButton exitBtn = new ImageButton(this);
        exitBtn.setImageResource(R.drawable.ic_exit_vector); // THE NEW VECTOR!
        exitBtn.setScaleType(ImageView.ScaleType.FIT_CENTER);
        exitBtn.setBackgroundColor(Color.parseColor("#44000000")); // Very subtle background
        exitBtn.setPadding(24, 24, 24, 24);
        exitBtn.setElevation(15);

        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(120, 120);
        params.gravity = Gravity.TOP | Gravity.START;
        params.setMargins(16, 16, 0, 0);

        exitBtn.setOnClickListener(v -> requestUnlock());

        addContentView(exitBtn, params);
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

    private void unlockAndExit() {
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
