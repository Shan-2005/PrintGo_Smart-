package com.printgo.smart;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Intent;
import android.graphics.Path;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Toast;
import java.util.List;

/**
 * V5.8 - Smart Return + Kiosk UI Cleanup.
 * 
 * 1. Waits for PrintHand to be IDLE (Preview screen visible).
 * 2. Returns to PrintGo Smart.
 * 3. Cleans up the "Processing Document..." overlay in the Kiosk app.
 */
public class PrintAutoClickService extends AccessibilityService {
    private static final String TAG = "PrintAutoClick";
    private Handler handler = new Handler(Looper.getMainLooper());
    private boolean chainRunning = false;
    private boolean serviceReady = false;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) return;
        
        // --- 1. Kiosk Watchdog Logic ---
        if (isLocked() && event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            CharSequence pkg = event.getPackageName();
            if (pkg != null) {
                String pkgName = pkg.toString();
                if (!isAuthorized(pkgName)) {
                    Log.w(TAG, "Watchdog: Unauthorized app detected (" + pkgName + "). Returning to Kiosk...");
                    returnToKioskForce();
                }
            }
        }

        // --- 2. Print Automation Logic ---
        CharSequence pkg = event.getPackageName();
        if (pkg == null) return;
        
        // Auto-detect PrintHand to start the chain
        if (pkg.toString().contains("printhand")) {
            if (!serviceReady) {
                serviceReady = true;
            }

            if (!chainRunning) {
                AccessibilityNodeInfo root = getRootInActiveWindow();
                if (root != null) {
                    if (findExact(root, "Color Mode") != null) {
                        chainRunning = true;
                        startAutomationChain();
                    }
                    root.recycle();
                }
            }
        }
    }

    private void startAutomationChain() {
        String target = (UsbPrintPlugin.targetColorMode == 1) ? "Color" : "Monochrome";
        int targetCopies = UsbPrintPlugin.targetCopies;
        int optionY = target.equals("Color") ? 835 : 974;

        toast("Printing started...");

        handler.postDelayed(() -> tapXY(480, 875), 400); // 1: Color Mode
        handler.postDelayed(() -> tapXY(1280, optionY), 800); // 2: Option
        handler.postDelayed(() -> tapXY(2200, 300), 1200); // 3: Close
        handler.postDelayed(() -> tapXY(480, 387), 1600); // 4: Print
        handler.postDelayed(() -> handleCopiesAndOK(targetCopies), 2000); // 5+6: Copies+OK
    }

    private void handleCopiesAndOK(int targetCopies) {
        int tapsNeeded = targetCopies - 1;
        if (tapsNeeded > 0) {
            for (int i = 0; i < tapsNeeded; i++) {
                final int n = i + 1;
                handler.postDelayed(() -> {
                    clickByText("+");
                }, i * 300L);
            }
            handler.postDelayed(() -> clickOKAndWatch(), tapsNeeded * 300L + 500L);
        } else {
            handler.postDelayed(() -> clickOKAndWatch(), 500);
        }
    }

    private void clickOKAndWatch() {
        clickByText("OK"); // Click OK on the copies dialog
        
        // Now wait for the "Print job is sent" popup
        toast("Waiting for print confirmation...");
        handler.postDelayed(() -> waitForSentPopup(0), 1000);
    }

    private void waitForSentPopup(int attempt) {
        if (attempt > 30) { // 30 seconds max
            Log.w(TAG, "Sent popup not found, forcing return...");
            returnToApp();
            return;
        }

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root != null) {
            // Look for "sent" or "job" or "Print job"
            boolean isSent = findByText(root, "sent") != null || findByText(root, "job") != null;
            
            if (isSent) {
                // Find the OK button on THIS popup
                AccessibilityNodeInfo okBtn = findExact(root, "OK");
                if (okBtn != null) {
                    Rect r = new Rect();
                    okBtn.getBoundsInScreen(r);
                    tapXY(r.centerX(), r.centerY());
                    toast("Job confirmed. Returning...");
                    handler.postDelayed(this::returnToApp, 1000);
                    root.recycle();
                    return;
                }
            }
            root.recycle();
        }
        handler.postDelayed(() -> waitForSentPopup(attempt + 1), 1000);
    }

    private AccessibilityNodeInfo findByText(AccessibilityNodeInfo root, String query) {
        if (root == null) return null;
        List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByText(query);
        if (nodes != null && !nodes.isEmpty()) return nodes.get(0);
        return null;
    }

    private void returnToApp() {
        try {
            Intent i = getPackageManager().getLaunchIntentForPackage("com.printgo.smart");
            if (i != null) {
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
                // After 4 seconds, clean up the "Processing..." overlay
                handler.postDelayed(this::cleanupKioskUI, 4000);
            }
        } catch (Exception ignored) {}
        
        // Reset for next job
        chainRunning = false;
        serviceReady = false;
    }

    private void cleanupKioskUI() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return;
        
        // Look for the "Force Reset / Cancel" button in the Kiosk app
        AccessibilityNodeInfo resetBtn = findExact(root, "Force Reset / Cancel");
        if (resetBtn != null) {
            Rect r = new Rect();
            resetBtn.getBoundsInScreen(r);
            tapXY(r.centerX(), r.centerY());
        }
        root.recycle();
    }

    // --- Helpers ---

    private void returnToKioskForce() {
        toast("Kiosk Mode Active: Unauthorized app blocked.");
        try {
            Intent i = getPackageManager().getLaunchIntentForPackage("com.printgo.smart");
            if (i != null) {
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                startActivity(i);
            }
        } catch (Exception ignored) {}
    }

    private boolean isAuthorized(String pkg) {
        // Whitelist: Kiosk, PrintHand, and critical system apps
        return pkg.equals("com.printgo.smart") 
            || pkg.contains("printhand")
            || pkg.contains("dynamixsoftware")
            || pkg.contains("android.permissioncontroller") // Permission dialogs
            || pkg.contains("android.settings") // Password/PIN challenge
            || pkg.contains("android.systemui") // Notifications/Status bar
            || pkg.contains("android.keyguard") // Lock screen
            || pkg.equals("android"); // Core system overlays
    }

    private boolean isLocked() {
        return getSharedPreferences("kiosk_prefs", MODE_PRIVATE)
                .getBoolean("locked", true);
    }

    private void clickByText(String text) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return;
        AccessibilityNodeInfo node = findExact(root, text);
        if (node != null) {
            Rect r = new Rect();
            node.getBoundsInScreen(r);
            tapXY(r.centerX(), r.centerY());
        }
        root.recycle();
    }

    private void tapXY(int x, int y) {
        Path path = new Path();
        path.moveTo(x, y);
        GestureDescription.Builder b = new GestureDescription.Builder();
        b.addStroke(new GestureDescription.StrokeDescription(path, 0, 200));
        dispatchGesture(b.build(), null, null);
    }

    private AccessibilityNodeInfo findExact(AccessibilityNodeInfo root, String text) {
        if (root == null) return null;
        List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByText(text);
        if (nodes != null) {
            for (AccessibilityNodeInfo n : nodes) {
                CharSequence t = n.getText();
                if (t == null) t = n.getContentDescription();
                if (t != null && t.toString().equalsIgnoreCase(text)) return n;
            }
        }
        return null;
    }

    private void toast(String msg) {
        Log.d(TAG, "ROBOT: " + msg);
        Intent intent = new Intent("com.printgo.smart.ROBOT_LOG");
        intent.putExtra("message", "ROBOT: " + msg);
        sendBroadcast(intent);
        handler.post(() -> {
            Toast t = Toast.makeText(getApplicationContext(), "🤖 " + msg, Toast.LENGTH_SHORT);
            t.setGravity(Gravity.TOP | Gravity.CENTER_HORIZONTAL, 0, 100);
            t.show();
        });
    }

    @Override
    public void onInterrupt() {}

    @Override
    protected boolean onKeyEvent(android.view.KeyEvent event) {
        if (isLocked() && event.getKeyCode() == android.view.KeyEvent.KEYCODE_BACK) {
            // Block Back button in Kiosk app to prevent exit
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root != null) {
                String pkg = root.getPackageName() != null ? root.getPackageName().toString() : "";
                root.recycle();
                if (pkg.equals("com.printgo.smart")) {
                    return true; // Consume event, don't let it go back
                }
            }
        }
        return super.onKeyEvent(event);
    }

    @Override protected void onServiceConnected() {
        super.onServiceConnected();
    }
}
