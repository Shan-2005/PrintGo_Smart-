package com.printgo.smart;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.pdf.PdfDocument;
import android.graphics.pdf.PdfRenderer;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.net.Uri;
import android.os.Bundle;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

@CapacitorPlugin(name = "UsbPrint")
public class UsbPrintPlugin extends Plugin {

    private static final String TAG = "UsbPrintPlugin";
    private static final String ACTION_USB_PERMISSION = "com.printgo.smart.USB_PERMISSION";
    
    private UsbManager usbManager;

    // Shared state for Accessibility Service (UI-Agent)
    public static int targetCopies = 1;
    public static int targetColorMode = 0; // 0=B&W, 1=Color
    public static String targetPaperSize = "A4";

    private UsbDevice connectionDevice;
    private UsbDeviceConnection connection;
    private UsbInterface usbInterface;
    private UsbEndpoint endpointIn;
    private UsbEndpoint endpointOut;

    @Override
    public void load() {
        usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        registerPrintStatusReceiver();
    }

    private void registerPrintStatusReceiver() {
        IntentFilter filter = new IntentFilter();
        filter.addAction("com.dynamixsoftware.printhand.PRINT_STATUS");
        filter.addAction("com.printgo.smart.ROBOT_LOG");

        getContext().registerReceiver(new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                if ("com.printgo.smart.ROBOT_LOG".equals(action)) {
                    String msg = intent.getStringExtra("message");
                    JSObject logData = new JSObject();
                    logData.put("message", msg);
                    notifyListeners("robotLog", logData);
                    return;
                }

                int status = intent.getIntExtra("status", -1);
                String error = intent.getStringExtra("error");
                long jobId = intent.getLongExtra("job_id", -1);

                JSObject data = new JSObject();
                data.put("jobId", jobId);
                data.put("statusCode", status);
                data.put("error", error);

                String statusString = "UNKNOWN";
                int progress = 0;

                switch (status) {
                    case 0: statusString = "IDLE"; progress = 0; break;
                    case 1: statusString = "CONNECTING"; progress = 10; break;
                    case 2: statusString = "RENDERING"; progress = 30; break;
                    case 3: statusString = "SENDING"; progress = 60; break;
                    case 4: statusString = "COMPLETED"; progress = 100; break;
                    case 5: statusString = "ERROR"; progress = 0; break;
                }

                data.put("status", statusString);
                data.put("progress", progress);

                Log.d(TAG, "PrintHand Status: " + statusString + " (Job:" + jobId + ")");
                notifyListeners("printStatusUpdate", data);
            }
        }, filter, Context.RECEIVER_EXPORTED);
    }

    @PluginMethod
    public void discoverPrinters(PluginCall call) {
        HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
        JSArray devicesArray = new JSArray();

        for (UsbDevice device : deviceList.values()) {
            int vid = device.getVendorId();
            // HP=1008 (0x03f0), Epson=1208 (0x04b8)
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
            PendingIntent pi = PendingIntent.getBroadcast(getContext(), 0, new Intent(ACTION_USB_PERMISSION), PendingIntent.FLAG_IMMUTABLE);
            usbManager.requestPermission(targetDevice, pi);
            // We resolve immediately as the broadcast handles the actual state, 
            // but the UI will retry connect which checks hasPermission again.
            JSObject ret = new JSObject();
            ret.put("requested", true);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        int vendorId = call.getInt("vendorId", -1);
        int productId = call.getInt("productId", -1);
        boolean skipFirmware = Boolean.TRUE.equals(call.getBoolean("skipFirmware", false));

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
            call.reject("Permission not granted. Call requestPermission first.");
            return;
        }

        try {
            connection = usbManager.openDevice(targetDevice);
            if (connection == null) {
                call.reject("Could not open connection to device");
                return;
            }
            connectionDevice = targetDevice;

            // --- Robust Interface/Endpoint Discovery ---
            usbInterface = null;
            endpointOut = null;
            endpointIn = null;

            int interfaceCount = targetDevice.getInterfaceCount();
            Log.d(TAG, "USB: VID:0x" + Integer.toHexString(vendorId) + " PID:0x" + Integer.toHexString(productId) + " IntfCount:" + interfaceCount);

            // 1. Priority: Look for the Printer Class (7) or FALLBACK Bulk OUT
            UsbInterface printerIntf = null;
            UsbEndpoint outEp = null;
            UsbEndpoint inEp = null;

            for (int i = 0; i < interfaceCount; i++) {
                UsbInterface intf = targetDevice.getInterface(i);
                Log.d(TAG, "USB:  Intf " + i + " Class:" + intf.getInterfaceClass() + " Subclass:" + intf.getInterfaceSubclass() + " Proto:" + intf.getInterfaceProtocol());
                
                if (intf.getInterfaceClass() == UsbConstants.USB_CLASS_PRINTER || intf.getInterfaceClass() == 0xFF) {
                    // Try to find endpoints in this interface
                    UsbEndpoint tempOut = null;
                    UsbEndpoint tempIn = null;
                    for (int j = 0; j < intf.getEndpointCount(); j++) {
                        UsbEndpoint ep = intf.getEndpoint(j);
                        if (ep.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK) {
                            if (ep.getDirection() == UsbConstants.USB_DIR_OUT) tempOut = ep;
                            else if (ep.getDirection() == UsbConstants.USB_DIR_IN) tempIn = ep;
                        }
                    }
                    if (tempOut != null) {
                        printerIntf = intf;
                        outEp = tempOut;
                        inEp = tempIn;
                        Log.d(TAG, "USB:   -> Selected as Printer Interface (Class " + intf.getInterfaceClass() + ")");
                        break; 
                    }
                }
            }

            if (printerIntf == null) {
                // Secondary check: look for any interface with a Bulk OUT endpoint (Fallback)
                Log.d(TAG, "USB:  No ideal printer interface found, scanning for any Bulk OUT fallback...");
                for (int i = 0; i < interfaceCount; i++) {
                    UsbInterface intf = targetDevice.getInterface(i);
                    if (intf.getInterfaceClass() == UsbConstants.USB_CLASS_MASS_STORAGE) continue;

                    for (int j = 0; j < intf.getEndpointCount(); j++) {
                        UsbEndpoint ep = intf.getEndpoint(j);
                        if (ep.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK && ep.getDirection() == UsbConstants.USB_DIR_OUT) {
                            printerIntf = intf;
                            outEp = ep;
                            Log.d(TAG, "USB:   -> Selected Generic Bulk Interface " + i);
                            break;
                        }
                    }
                    if (printerIntf != null) break;
                }
            }

            // 2. Handle HP Mode Switch ONLY if no printer interface was found
            if (printerIntf == null && vendorId == 1008) {
                UsbInterface storageIntf = null;
                for (int i = 0; i < interfaceCount; i++) {
                    if (targetDevice.getInterface(i).getInterfaceClass() == UsbConstants.USB_CLASS_MASS_STORAGE) {
                        storageIntf = targetDevice.getInterface(i);
                        break;
                    }
                }

                if (storageIntf != null) {
                    Log.d(TAG, "No Printer interface found. Triggering HP Mode Switch...");
                    connection.controlTransfer(0x40, 0x01, 0x0000, 0x0000, null, 0, 1000);
                    
                    if (connection.claimInterface(storageIntf, true)) {
                        UsbEndpoint storageOut = null;
                        for (int j = 0; j < storageIntf.getEndpointCount(); j++) {
                            UsbEndpoint ep = storageIntf.getEndpoint(j);
                            if (ep.getDirection() == UsbConstants.USB_DIR_OUT) { storageOut = ep; break; }
                        }
                        if (storageOut != null) {
                            byte[] eject = new byte[] {
                                0x55, 0x53, 0x42, 0x43, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x06, 0x1B, 
                                0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
                            };
                            connection.bulkTransfer(storageOut, eject, eject.length, 1000);
                        }
                        connection.releaseInterface(storageIntf);
                        
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("restarting", true);
                        ret.put("message", "HP Mode Switch triggered. Reconnecting in 5s...");
                        call.resolve(ret);
                        return;
                    }
                }
            }
            
            // 3. HP M1005 Firmware Upload (sihp1005.dl)
            if (vendorId == 1008 && productId == 0x3b17 && printerIntf != null && outEp != null && !skipFirmware) {
                // If it's the HP M1005, we push the firmware. Since we cannot easily ask the device if firmware is already loaded,
                // pushing it again is usually safe or we can just push it every time we first connect in a session.
                Log.d(TAG, "HP M1005 Detected. Uploading firmware...");
                if (connection.claimInterface(printerIntf, true)) {
                    try {
                        java.io.InputStream is = getContext().getAssets().open("sihp1005.dl");
                        byte[] buffer = new byte[16384];
                        int bytesRead;
                        int totalUploaded = 0;
                        while ((bytesRead = is.read(buffer)) != -1) {
                            byte[] chunk = new byte[bytesRead];
                            System.arraycopy(buffer, 0, chunk, 0, bytesRead);
                            int transferred = connection.bulkTransfer(outEp, chunk, bytesRead, 5000);
                            if (transferred >= 0) {
                                totalUploaded += transferred;
                            } else {
                                Log.e(TAG, "Firmware upload transfer failed");
                                break;
                            }
                        }
                        is.close();
                        Log.d(TAG, "Firmware upload complete. Bytes: " + totalUploaded);
                        
                        // The printer will reset its USB connection after firmware upload.
                        connection.releaseInterface(printerIntf);
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("restarting", true);
                        ret.put("message", "Firmware uploaded. Printer restarting...");
                        call.resolve(ret);
                        return;
                        
                    } catch (IOException e) {
                        Log.e(TAG, "Failed to read firmware sihp1005.dl from assets", e);
                    }
                }
            }

            usbInterface = printerIntf;
            endpointOut = outEp;
            endpointIn = inEp;

            if (!connection.claimInterface(usbInterface, true)) {
                call.reject("Could not claim interface");
                return;
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("interfaceId", usbInterface.getId());
            ret.put("interfaceClass", usbInterface.getInterfaceClass());
            ret.put("vendorId", targetDevice.getVendorId());
            ret.put("productId", targetDevice.getProductId());
            ret.put("productName", targetDevice.getProductName());
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("Connect error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPrintPreview(PluginCall call) {
        String uriString = call.getString("uri");
        int dpi = call.getInt("dpi", 600);
        float scale = call.getFloat("scale", 0.90f);
        int rotation = call.getInt("rotation", 0);
        float offsetX = call.getFloat("offsetX", 0f);
        float offsetY = call.getFloat("offsetY", 0f);

        if (uriString == null || uriString.isEmpty()) {
            call.reject("Must provide a file URI");
            return;
        }

        try {
            Uri fileUri = parseUri(uriString);
            ParcelFileDescriptor fd = getContext().getContentResolver().openFileDescriptor(fileUri, "r");
            PdfRenderer renderer = new PdfRenderer(fd);
            PdfRenderer.Page page = renderer.openPage(0);

            float dpiScale = dpi / 72.0f;
            int width = (int) (page.getWidth() * dpiScale);
            int height = (int) (page.getHeight() * dpiScale);

            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            bitmap.eraseColor(Color.WHITE);

            Matrix matrix = new Matrix();
            matrix.postScale(dpiScale, dpiScale);
            matrix.postScale(scale, scale, width / 2f, height / 2f);
            matrix.postRotate(rotation, width / 2f, height / 2f);
            matrix.postTranslate(offsetX * dpiScale, offsetY * dpiScale);

            page.render(bitmap, null, matrix, PdfRenderer.Page.RENDER_MODE_FOR_PRINT);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, 70, baos);
            byte[] bytes = baos.toByteArray();
            String base64Generated = Base64.encodeToString(bytes, Base64.NO_WRAP);

            JSObject ret = new JSObject();
            ret.put("preview", "data:image/jpeg;base64," + base64Generated);

            bitmap.recycle();
            page.close();
            renderer.close();
            fd.close();
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Preview error: " + e.getMessage());
        }
    }

    private Uri parseUri(String uriString) {
        if (uriString.startsWith("file://")) return Uri.parse(uriString);
        if (uriString.startsWith("/")) return Uri.fromFile(new File(uriString));
        return Uri.parse(uriString);
    }

    @PluginMethod
    public void printPdf(PluginCall call) {
        String uriString = call.getString("uri");
        if (uriString == null || uriString.isEmpty()) {
            call.reject("Must provide a file URI");
            return;
        }

        if (connection == null || connectionDevice == null) {
            call.reject("Printer not connected");
            return;
        }

        try {
            Uri fileUri = parseUri(uriString);
            Log.d(TAG, "Starting print job for URI: " + fileUri);

            PrintManager.Job job = new PrintManager.Job()
                .setUri(fileUri)
                .setPaper(M1005DriverConfig.Paper.A4) 
                .setJobName("SmartPrint_" + System.currentTimeMillis());

            // Diagnostic: Log connection state
            if (connection == null) {
                Log.e(TAG, "Connection is null in printPdf!");
                call.reject("Printer connection lost");
                return;
            }

            PrintManager.print(getContext(), usbManager, connectionDevice, job, new PrintManager.PrintListener() {
                @Override public void onStatus(String msg) { 
                    Log.d(TAG, "Print Status Update: " + msg); 
                }
                @Override public void onProgress(int pct) { 
                    Log.d(TAG, "Print Progress: " + pct + "%"); 
                }
                @Override public void onComplete() { 
                    Log.d(TAG, "Print Job Completed Successfully");
                    call.resolve(); 
                }
                @Override public void onError(String err) { 
                    Log.e(TAG, "Print Job Error: " + err);
                    call.reject(err); 
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "PrintPdf Exception", e);
            call.reject("Print error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void prepareTestPage(PluginCall call) {
        try {
            File file = generateTestPdf();
            JSObject ret = new JSObject();
            ret.put("uri", Uri.fromFile(file).toString());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Prepare Test Page Error: " + e.getMessage());
        }
    }

    private File generateTestPdf() throws IOException {
        PdfDocument document = new PdfDocument();
        PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(595, 842, 1).create(); // A4
        PdfDocument.Page page = document.startPage(pageInfo);
        Canvas canvas = page.getCanvas();
        Paint paint = new Paint();
        paint.setColor(Color.BLACK);
        paint.setAntiAlias(true);

        // Header
        paint.setTextSize(30);
        paint.setFakeBoldText(true);
        canvas.drawText("PrintGo Smart", 50, 100, paint);

        // Subtitle
        paint.setTextSize(18);
        paint.setFakeBoldText(false);
        canvas.drawText("Professional Kiosk Print Solution", 50, 130, paint);

        // Driver Details
        paint.setTextSize(14);
        paint.setColor(Color.DKGRAY);
        if (connectionDevice != null) {
            canvas.drawText("Device: " + connectionDevice.getProductName(), 50, 180, paint);
            canvas.drawText("Vendor ID: 0x" + Integer.toHexString(connectionDevice.getVendorId()), 50, 200, paint);
            canvas.drawText("Product ID: 0x" + Integer.toHexString(connectionDevice.getProductId()), 50, 220, paint);
        } else {
            canvas.drawText("Device: [Not Connected]", 50, 180, paint);
        }

        // XQX/PCL Fix Verification
        paint.setColor(Color.BLACK);
        paint.setFakeBoldText(true);
        canvas.drawText("Driver Verification:", 50, 260, paint);
        paint.setFakeBoldText(false);
        canvas.drawText("1. Bits-Per-Pixel (BPP) = 1 [FIXED]", 70, 285, paint);
        canvas.drawText("2. PJL Job Wrapper [ENABLED]", 70, 310, paint);
        canvas.drawText("3. USB Pacing (20ms/KB) [OPTIMIZED]", 70, 335, paint);
        canvas.drawText("4. Safety Margins (0.90 Scale) [ACTIVE]", 70, 360, paint);

        // Test Pattern (Gradients / Shapes)
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(2);
        canvas.drawRect(50, 420, 545, 600, paint); // Test Border

        for(int i=0; i<10; i++) {
            canvas.drawLine(50 + (i*50), 420, 50 + (i*50), 600, paint);
        }

        paint.setStyle(Paint.Style.FILL);
        for(int i=0; i<5; i++) {
            paint.setAlpha(50 + (i*40));
            canvas.drawRect(70 + (i*90), 450, 140 + (i*90), 570, paint);
        }

        document.finishPage(page);
        File file = new File(getContext().getCacheDir(), "test_page.pdf");
        document.writeTo(new FileOutputStream(file));
        document.close();
        return file;
    }

    @PluginMethod
    public void printTestPage(PluginCall call) {
        if (connection == null || connectionDevice == null) {
            call.reject("Not connected to a printer");
            return;
        }
        try {
            File file = generateTestPdf();
            PrintManager.Job job = new PrintManager.Job()
                .setUri(Uri.fromFile(file))
                .setJobName("TestPage");

            PrintManager.print(getContext(), usbManager, connectionDevice, job, new PrintManager.PrintListener() {
                @Override public void onStatus(String msg) { Log.d(TAG, "TestPrint: " + msg); }
                @Override public void onProgress(int pct) { Log.d(TAG, "Progress: " + pct + "%"); }
                @Override public void onComplete() { call.resolve(); }
                @Override public void onError(String err) { call.reject(err); }
            });
        } catch (Exception e) {
            call.reject("Test Page Error: " + e.getMessage());
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
            Uri fileUri = parseUri(uriString);
            File file = new File(fileUri.getPath());

            if (!file.exists()) {
                call.reject("File does not exist: " + file.getAbsolutePath());
                return;
            }

            Context context = getContext();
            Uri contentUri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);

            // Correct package names for PrintHand
            String[] packages = {
                "com.dynamixsoftware.printhand",
                "com.dynamixsoftware.printhand.premium",
                "com.dynamicg.printhand",
                "com.dynamicg.printhand.premium"
            };

            String targetPackage = null;
            android.content.pm.PackageManager pm = context.getPackageManager();
            for (String pkg : packages) {
                try {
                    pm.getPackageInfo(pkg, 0);
                    targetPackage = pkg;
                    break;
                } catch (Exception ignored) {}
            }

            if (targetPackage == null) {
                call.reject("PrintHand app not found. Please install it.");
                return;
            }

            Log.d(TAG, "Launching PrintHand for " + file.getName() + " using package: " + targetPackage);

            // Using the specialized PrintHand PRINT action for better automation
            // If the specialized action fails, we fall back to ACTION_VIEW
            Intent intent = new Intent("com.dynamixsoftware.printhand.PRINT");
            intent.setPackage(targetPackage);
            intent.setDataAndType(contentUri, "application/pdf");
            
            // Passthrough settings - Try multiple keys for compatibility
            int copies = call.getInt("copies", 1);
            int color = call.getInt("colorMode", 0); // 0=B&W, 1=Color
            String paperSize = call.getString("paperSize", "A4");

            // Update shared state for Accessibility Service
            targetCopies = copies;
            targetColorMode = color;
            targetPaperSize = paperSize;

            // Automation extras
            intent.putExtra("com.dynamixsoftware.printhand.EXTRA_AUTO_PRINT", true);
            intent.putExtra("EXTRA_AUTO_PRINT", true);

            // Copies
            intent.putExtra("com.dynamixsoftware.printhand.EXTRA_PRINTING_COPIES", copies);
            intent.putExtra("com.dynamixsoftware.printhand.COPIES", copies);
            intent.putExtra("copies", copies);
            intent.putExtra("EXTRA_COPIES", copies);
            
            // Color Mode
            intent.putExtra("com.dynamixsoftware.printhand.EXTRA_PRINTING_COLOR", color);
            intent.putExtra("com.dynamixsoftware.printhand.COLOR_MODE", color);
            intent.putExtra("colorMode", color);
            intent.putExtra("EXTRA_COLOR_MODE", color);
            
            // Paper Size
            intent.putExtra("com.dynamixsoftware.printhand.EXTRA_PRINTING_PAPER_SIZE", paperSize);
            intent.putExtra("com.dynamixsoftware.printhand.PAPER_SIZE", paperSize.equals("A4") ? "ISO_A4" : paperSize);
            intent.putExtra("paperSize", paperSize);
            
            // Grant permissions
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            
            // For Android 11+ compatibility
            intent.setClipData(android.content.ClipData.newRawUri("", contentUri));

            // Verify if the specialized action is supported, otherwise fallback to ACTION_VIEW
            if (pm.resolveActivity(intent, 0) == null) {
                Log.w(TAG, "Specialized PRINT action not supported, falling back to ACTION_VIEW");
                intent.setAction(Intent.ACTION_VIEW);
            }

            context.startActivity(intent);
            call.resolve();

        } catch (Exception e) {
            Log.e(TAG, "PrintHand Error", e);
            call.reject("PrintHand Integration failed: " + e.getMessage());
        }
    }
}
