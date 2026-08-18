package com.printgo.smart;

import android.app.ActivityManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.pdf.PdfRenderer;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.net.Uri;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.util.Base64;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;

@CapacitorPlugin(name = "PrintGoBridge")
public class PrintGoBridge extends Plugin {

    private static final String TAG = "NativePrintPlugin";
    private static final String PRINTHAND_PACKAGE = "com.dynamixsoftware.printhand";
    private static final String ACTION_USB_PERMISSION = "com.printgo.smart.USB_PERMISSION";

    // Shared state for Accessibility Service (PrintAutoClickService)
    public static int targetCopies = 1;
    public static int targetColorMode = 0; // 0=B&W, 1=Color
    public static String targetOrientation = "Auto"; // Auto, Portrait, Landscape

    // USB State
    private UsbManager usbManager;
    private UsbDeviceConnection connection;
    private UsbDevice connectionDevice;
    private UsbInterface usbInterface;
    private UsbEndpoint endpointOut;
    private UsbEndpoint endpointIn;

    private static PrintGoBridge instance;

    @Override
    public void load() {
        instance = this;
        usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
    }

    public static void notifyStatus(String status, String details) {
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("status", status);
            data.put("details", details);
            instance.notifyListeners("printStatusUpdate", data);
        }
    }

    public static void notifyRobot(String message) {
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("message", message);
            instance.notifyListeners("robotLog", data);
        }
    }

    @PluginMethod
    public void printWithPrintHand(PluginCall call) {
        String uriString = call.getString("uri");

        if (uriString == null || uriString.isEmpty()) {
            call.reject("Must provide a file URI");
            return;
        }

        try {
            Context context = getContext();

            // --- Step 1: Resolve the source file ---
            File sourceFile;
            if (uriString.startsWith("file://")) {
                sourceFile = new File(Uri.parse(uriString).getPath());
            } else if (uriString.startsWith("content://")) {
                sourceFile = new File(context.getCacheDir(), "printgo_temp_" + System.currentTimeMillis() + ".pdf");
                try (InputStream in = context.getContentResolver().openInputStream(Uri.parse(uriString));
                     FileOutputStream out = new FileOutputStream(sourceFile)) {
                    if (in == null) throw new Exception("Cannot open input stream for: " + uriString);
                    byte[] buf = new byte[4096];
                    int len;
                    while ((len = in.read(buf)) > 0) out.write(buf, 0, len);
                }
            } else {
                sourceFile = new File(uriString);
            }

            if (!sourceFile.exists()) {
                call.reject("File does not exist: " + sourceFile.getAbsolutePath());
                return;
            }

            Log.d(TAG, "Source file: " + sourceFile.getAbsolutePath() + " size=" + sourceFile.length());

            // --- Step 2: Expose via FileProvider ---
            Uri contentUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                sourceFile
            );

            Log.d(TAG, "FileProvider URI: " + contentUri);

            // --- Step 3: Get Settings from Call ---
            targetCopies = call.getInt("copies", 1);
            targetColorMode = call.getInt("colorMode", 0);
            targetOrientation = call.getString("orientation", "Auto");

            Log.d(TAG, "Settings: Copies=" + targetCopies + ", Color=" + targetColorMode + ", Orient=" + targetOrientation);

            // --- Step 4: Send to PrintHand ---
            boolean printHandInstalled = isAppInstalled(context, PRINTHAND_PACKAGE);
            if (!printHandInstalled) {
                // Try premium package
                if (isAppInstalled(context, "com.dynamixsoftware.printhand.premium")) {
                    printHandInstalled = true;
                }
            }

            // ── Step 4a: Force-stop PrintHand (works even if it's in the foreground) ──
            // am force-stop is the only reliable way to kill a foreground app without root.
            try {
                Runtime.getRuntime().exec(new String[]{"am", "force-stop", PRINTHAND_PACKAGE});
                Log.d(TAG, "am force-stop sent to PrintHand.");
            } catch (Exception e) {
                Log.w(TAG, "am force-stop failed: " + e.getMessage());
            }
            // Also kill via ActivityManager as a belt-and-suspenders fallback
            try {
                ActivityManager am = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
                if (am != null) am.killBackgroundProcesses(PRINTHAND_PACKAGE);
            } catch (Exception ignored) {}

            // ── Step 4b: Build a fresh ACTION_SEND intent ──
            // ACTION_SEND with EXTRA_STREAM is the correct way to trigger PrintHand's
            // print dialog (Color Mode, Copies, etc.) directly. ACTION_VIEW only opens
            // PrintHand's file viewer — the print settings screen never appears.
            final Intent printIntent = new Intent(Intent.ACTION_SEND);
            printIntent.setType("application/pdf");
            printIntent.setPackage(PRINTHAND_PACKAGE);
            printIntent.putExtra(Intent.EXTRA_STREAM, contentUri);

            // Automation hints passed via extras
            printIntent.putExtra("com.dynamixsoftware.printhand.EXTRA_COPIES", targetCopies);
            printIntent.putExtra("com.dynamixsoftware.printhand.EXTRA_AUTO_PRINT", true);

            // FLAG_ACTIVITY_CLEAR_TASK wipes PrintHand's entire back-stack so the
            // previous document's activity is gone before we launch the new one.
            printIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            printIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            printIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK);

            // Android 11+ ClipData URI grant
            printIntent.setClipData(android.content.ClipData.newRawUri("", contentUri));

            Log.d(TAG, "Launching PrintHand ACTION_SEND (print dialog) for: " + sourceFile.getName());

            // Wait 2000 ms so the OS fully tears down PrintHand before relaunch,
            // ensuring no stale document session is restored.
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                context.startActivity(printIntent);
                Log.d(TAG, "PrintHand launched fresh — print dialog should appear.");
            }, 2000);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "Error launching print intent", e);
            call.reject("Failed to launch print: " + e.getMessage());
        }
    }

    @PluginMethod
    public void discoverPrinters(PluginCall call) {
        HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
        JSArray devicesArray = new JSArray();

        for (UsbDevice device : deviceList.values()) {
            int vid = device.getVendorId();
            if (vid == 1008 || vid == 1208 || vid == 0x03f0 || vid == 0x04b8) {
                JSObject devObj = new JSObject();
                devObj.put("name", device.getDeviceName());
                devObj.put("vendorId", vid);
                devObj.put("productId", device.getProductId());
                devObj.put("productName", device.getProductName());
                devObj.put("manufacturerName", device.getManufacturerName());
                devicesArray.put(devObj);
            }
        }

        JSObject ret = new JSObject();
        ret.put("devices", devicesArray);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        int vendorId = call.getInt("vendorId", -1);
        int productId = call.getInt("productId", -1);

        if (vendorId == -1 || productId == -1) {
            call.reject("Must provide vendorId and productId");
            return;
        }

        HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
        UsbDevice targetDevice = null;
        for (UsbDevice device : deviceList.values()) {
            if (device.getVendorId() == vendorId && device.getProductId() == productId) {
                targetDevice = device;
                break;
            }
        }

        if (targetDevice == null) {
            call.reject("Device not found");
            return;
        }

        if (usbManager.hasPermission(targetDevice)) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
        } else {
            int flags = PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pi = PendingIntent.getBroadcast(getContext(), 0, new Intent(ACTION_USB_PERMISSION), flags);
            usbManager.requestPermission(targetDevice, pi);
            JSObject ret = new JSObject();
            ret.put("requested", true);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        int vendorId = call.getInt("vendorId", -1);
        int productId = call.getInt("productId", -1);

        if (vendorId == -1 || productId == -1) {
            call.reject("Must provide vendorId and productId");
            return;
        }

        HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
        UsbDevice targetDevice = null;

        if (connection != null) {
            try { connection.close(); } catch (Exception ignored) {}
            connection = null;
        }

        for (UsbDevice device : deviceList.values()) {
            if (device.getVendorId() == vendorId && device.getProductId() == productId) {
                targetDevice = device;
                break;
            }
        }

        if (targetDevice == null) {
            call.reject("Device not found");
            return;
        }

        if (!usbManager.hasPermission(targetDevice)) {
            call.reject("Permission not granted");
            return;
        }

        try {
            connection = usbManager.openDevice(targetDevice);
            if (connection == null) {
                call.reject("Could not open device");
                return;
            }
            connectionDevice = targetDevice;
            
            // Just claim the first interface for basic connection success status
            if (targetDevice.getInterfaceCount() > 0) {
                usbInterface = targetDevice.getInterface(0);
                connection.claimInterface(usbInterface, true);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("productName", targetDevice.getProductName());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Connect error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void exitKiosk(PluginCall call) {
        android.app.Activity activity = getActivity();
        if (activity instanceof MainActivity) {
            activity.runOnUiThread(() -> {
                ((MainActivity) activity).unlockAndExit();
            });
            call.resolve();
        } else {
            call.reject("MainActivity not available");
        }
    }

    @PluginMethod
    public void prepareTestPage(PluginCall call) {
        // Mock success for consolidated flow
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    private boolean isAppInstalled(Context context, String packageName) {
        try {
            context.getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }
}
