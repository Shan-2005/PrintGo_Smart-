package com.printgo.smart;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Intent;
import android.content.res.Configuration;
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
 * V7.0 - Portrait Scroll-Into-View Fix.
 *
 * 1. Detects orientation (portrait vs landscape).
 * 2. Landscape: Uses proven hardcoded XY coordinates.
 * 3. Portrait: Scrolls nodes into view before clicking (layout differs + options may be off-screen).
 * 4. Returns to PrintGo Smart after print confirmation.
 */
public class PrintAutoClickService extends AccessibilityService {
    private static final String TAG = "PrintAutoClick";
    private Handler handler = new Handler(Looper.getMainLooper());
    private boolean chainRunning = false;
    private boolean serviceReady = false;

    private boolean isPortrait() {
        return getResources().getConfiguration().orientation == Configuration.ORIENTATION_PORTRAIT;
    }

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
                tryStartChain(0);
            }
        }
    }

    private void tryStartChain(int attempt) {
        if (chainRunning || attempt > 20) return; // 10 seconds max

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root != null) {
            if (findExact(root, "Color Mode") != null || findExact(root, "Copies") != null) {
                Log.i(TAG, "PrintHand UI detected! Starting automation chain...");
                chainRunning = true;
                startAutomationChain();
            } else {
                if (attempt == 5 || attempt == 15) {
                    Log.d(TAG, "Search attempt " + attempt + ": Color Mode not found. Dumping nodes...");
                    // dumpNodeTree(root, 0); // Optional: add this for deep debugging
                }
            }
            root.recycle();
        }

        if (!chainRunning) {
            handler.postDelayed(() -> tryStartChain(attempt + 1), 500);
        }
    }

    private void startAutomationChain() {
        int targetCopies = PrintGoBridge.targetCopies;
        PrintGoBridge.notifyRobot("Automation chain started...");

        toast("PrintHand automation started...");

        // Step 1: Click "Color Mode" row
        waitForNodeAndClick("Color Mode", 0, () -> {
            // Step 2: Select Color or B&W in the dialog
            if (PrintGoBridge.targetColorMode == 1) {
                waitForDialogAndSelect("Color", 0);
            } else {
                waitForDialogAndSelectBW(0);
            }

            // Step 3: Handle Page Orientation after a short delay for dialog dismissal
            handler.postDelayed(() -> {
                String orient = PrintGoBridge.targetOrientation;
                if (orient != null && !"Auto".equalsIgnoreCase(orient)) {
                    waitForNodeAndClick("Page Orientation", 0, () -> {
                        waitForDialogAndSelect(orient, 0);
                        delayPrint(targetCopies);
                    });
                } else {
                    delayPrint(targetCopies);
                }
            }, 1000);
        });
    }

    private void delayPrint(int targetCopies) {
        // Step 4: Click Print after everything is set
        handler.postDelayed(() -> waitForDialogDismissAndPrint(0, targetCopies), 500);
    }

    private void waitForNodeAndClick(String text, int attempt, Runnable onSuccess) {
        if (attempt > 30) { // Extra retries to allow portrait scrolling to settle
            toast("ERR: Failed to find " + text);
            return;
        }

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root != null) {
            AccessibilityNodeInfo node = findExact(root, text);
            if (node != null) {
                boolean scrolled = ensureNodeVisible(node);
                root.recycle();

                if (scrolled) {
                    // Give the list time to settle after scroll, then re-find and click
                    handler.postDelayed(() -> {
                        AccessibilityNodeInfo root2 = getRootInActiveWindow();
                        if (root2 != null) {
                            AccessibilityNodeInfo node2 = findExact(root2, text);
                            if (node2 != null) {
                                clickNodeProperly(node2);
                            }
                            root2.recycle();
                        }
                        if (onSuccess != null) onSuccess.run();
                    }, 500); // 500 ms for scroll animation + layout pass
                } else {
                    // Already visible — click immediately
                    AccessibilityNodeInfo root2 = getRootInActiveWindow();
                    if (root2 != null) {
                        AccessibilityNodeInfo node2 = findExact(root2, text);
                        if (node2 != null) clickNodeProperly(node2);
                        root2.recycle();
                    }
                    if (onSuccess != null) onSuccess.run();
                }
                return;
            }
            root.recycle();
        }
        handler.postDelayed(() -> waitForNodeAndClick(text, attempt + 1, onSuccess), 300);
    }

    /**
     * Scrolls a node into the visible screen area if it is currently off-screen.
     * Uses ACTION_SCROLL_INTO_VIEW (API 23+) and falls back to scrolling the
     * nearest scrollable ancestor.
     *
     * @return true if a scroll action was dispatched, false if node was already visible.
     */
    private boolean ensureNodeVisible(AccessibilityNodeInfo node) {
        Rect bounds = new Rect();
        node.getBoundsInScreen(bounds);
        int screenHeight = getResources().getDisplayMetrics().heightPixels;
        int screenWidth  = getResources().getDisplayMetrics().widthPixels;

        boolean offScreen = bounds.bottom > screenHeight || bounds.top < 0
                         || bounds.right > screenWidth  || bounds.left < 0
                         || bounds.isEmpty();

        if (!offScreen) return false; // Already visible, nothing to do

        // 1. Try ACTION_SCROLL_INTO_VIEW (value 0x00001000, API 23+) to let the system scroll
        node.performAction(0x00001000 /* ACTION_SCROLL_INTO_VIEW */);

        // 2. Also drive the scrollable ancestor for devices that ignore the above
        AccessibilityNodeInfo scrollable = findScrollableParent(node);
        if (scrollable != null) {
            if (bounds.top < 0) {
                scrollable.performAction(AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD);
            } else {
                scrollable.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD);
            }
        }

        Log.d(TAG, "Scrolled to bring '" + node.getText() + "' into view (portrait mode)");
        return true;
    }

    /**
     * Walks up the accessibility tree to find the nearest scrollable ancestor.
     */
    private AccessibilityNodeInfo findScrollableParent(AccessibilityNodeInfo node) {
        AccessibilityNodeInfo current = node.getParent();
        while (current != null) {
            if (current.isScrollable()) return current;
            current = current.getParent();
        }
        return null;
    }

    /**
     * Tries "Grayscale" first (HP printers), then "Monochrome" (Epson printers).
     */
    private void waitForDialogAndSelectBW(int attempt) {
        if (attempt > 30) { // Increased from 20 to 30
            toast("ERR: BW dialog timeout, seeking row fallback");
            return;
        }

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root != null) {
            // Check for "Choose Value" or similar dialog indicators
            AccessibilityNodeInfo dialogTitle = findExact(root, "Choose Value");
            if (dialogTitle != null || findExact(root, "Color Mode") == null) { // If "Color Mode" row is gone, dialog is likely up
                // Try Grayscale first (HP), then Monochrome (Epson), then Black & White
                AccessibilityNodeInfo option = findExact(root, "Grayscale");
                if (option == null) option = findExact(root, "Monochrome");
                if (option == null) option = findExact(root, "Black & White");
                
                if (option != null) {
                    clickNodeProperly(option);
                    toast("Selected: B&W");
                    root.recycle();
                    return;
                }
            }
            root.recycle();
        }
        handler.postDelayed(() -> waitForDialogAndSelectBW(attempt + 1), 200);
    }

    private void clickNodeProperly(AccessibilityNodeInfo node) {
        AccessibilityNodeInfo clickTarget = node;
        AccessibilityNodeInfo parent = node.getParent();
        while (parent != null) {
            if (parent.isClickable()) { clickTarget = parent; break; }
            parent = parent.getParent();
        }
        Rect r = new Rect();
        clickTarget.getBoundsInScreen(r);
        tapXY(r.centerX(), r.centerY());
    }

    /**
     * Waits for the "Choose Value" dialog to fully dismiss before clicking Print.
     * This prevents the Print tap from landing on the still-open dialog.
     */
    private void waitForDialogDismissAndPrint(int attempt, int targetCopies) {
        if (attempt > 20) {
            // Force click Print anyway
            toast("Dialog dismiss timeout, forcing Print click");
            clickByResourceId("com.dynamixsoftware.printhand:id/button_print", "Print");
            handler.postDelayed(() -> handleCopiesAndOK(targetCopies), 1500);
            return;
        }

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root != null) {
            AccessibilityNodeInfo dialogTitle = findExact(root, "Choose Value");
            if (dialogTitle == null) {
                // Dialog is gone — safe to click Print
                clickByResourceId("com.dynamixsoftware.printhand:id/button_print", "Print");
                root.recycle();
                handler.postDelayed(() -> handleCopiesAndOK(targetCopies), 1000);
                return;
            }
            root.recycle();
        }
        handler.postDelayed(() -> waitForDialogDismissAndPrint(attempt + 1, targetCopies), 200);
    }

    private void dumpNodeTree(AccessibilityNodeInfo node, int depth) {
        if (node == null || depth > 5) return;
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < depth; i++) sb.append("  ");
        sb.append("Text: ").append(node.getText())
          .append(", Desc: ").append(node.getContentDescription())
          .append(", ID: ").append(node.getViewIdResourceName());
        Log.d(TAG, sb.toString());
        for (int i = 0; i < node.getChildCount(); i++) {
            dumpNodeTree(node.getChild(i), depth + 1);
        }
    }

    /**
     * Waits for the "Choose Value" dialog to appear and selects the target option.
     * Retries up to 10 times (100ms intervals).
     */
    private void waitForDialogAndSelect(String optionText, int attempt) {
        if (attempt > 20) { // Increased from 10 to 20
            toast("ERR: Dialog timeout for " + optionText);
            return;
        }

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root != null) {
            // Check if the "Choose Value" dialog title is visible OR if the main screen is gone
            AccessibilityNodeInfo dialogTitle = findExact(root, "Choose Value");
            if (dialogTitle != null || findExact(root, "Color Mode") == null) {
                // Find and click the target option
                AccessibilityNodeInfo option = findExact(root, optionText);
                if (option != null) {
                    clickNodeProperly(option);
                    toast("Selected: " + optionText);
                    root.recycle();
                    return;
                }
            }
            root.recycle();
        }
        // Retry
        handler.postDelayed(() -> waitForDialogAndSelect(optionText, attempt + 1), 150);
    }

    /**
     * Click a node by its resource ID, with text fallback.
     */
    private void clickByResourceId(String resourceId, String fallbackText) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) { toast("ERR: No root for " + fallbackText); return; }

        List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByViewId(resourceId);
        if (nodes != null && !nodes.isEmpty()) {
            Rect r = new Rect();
            nodes.get(0).getBoundsInScreen(r);
            tapXY(r.centerX(), r.centerY());
            toast("Clicked: " + fallbackText);
        } else {
            // Fallback to text-based
            clickByText(fallbackText);
            toast("Clicked (text fallback): " + fallbackText);
        }
        root.recycle();
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
        if (attempt > 45) { // 45 seconds max (printing can be slow)
            Log.w(TAG, "Sent popup not found, forcing return...");
            returnToApp();
            return;
        }

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root != null) {
            // Look for "sent", "job", "Print job", "completed" (case-insensitive done in findExact/findByText)
            boolean isSent = findByText(root, "sent") != null 
                          || findByText(root, "job") != null 
                          || findByText(root, "Print job") != null
                          || findByText(root, "has been sent") != null;
            
            if (isSent) {
                // Find the OK button on THIS popup
                AccessibilityNodeInfo okBtn = findExact(root, "OK");
                if (okBtn == null) okBtn = findExact(root, "Close"); // Fallback for some versions
                
                if (okBtn != null) {
                    clickNodeProperly(okBtn);
                    toast("Job confirmed. Returning...");
                    handler.postDelayed(this::returnToApp, 1500); // 1.5s delay for cleaner exit
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
        PrintGoBridge.notifyStatus("PRINTING", "Step: " + msg);
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
