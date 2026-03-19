package com.printgo.smart;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.InputStream;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "NativePrint")
public class NativePrintPlugin extends Plugin {

    private static final String TAG = "NativePrintPlugin";
    private static final String PRINTHAND_PACKAGE = "com.dynamixsoftware.printhand";

    @PluginMethod
    public void printDocument(PluginCall call) {
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

            // --- Step 3: Send to PrintHand (supports HP LaserJet via USB) ---
            boolean printHandInstalled = isAppInstalled(context, PRINTHAND_PACKAGE);
            Log.d(TAG, "PrintHand installed: " + printHandInstalled);

            Intent printIntent;

            if (printHandInstalled) {
                // Using the specialized PrintHand PRINT action for better automation
                printIntent = new Intent("com.dynamixsoftware.printhand.PRINT");
                printIntent.setPackage(PRINTHAND_PACKAGE);
                printIntent.setDataAndType(contentUri, "application/pdf");
                
                // Automation extras
                printIntent.putExtra("com.dynamixsoftware.printhand.EXTRA_AUTO_PRINT", true);
                
                // Grant permissions
                printIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                printIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                
                // For Android 11+ compatibility
                printIntent.setClipData(android.content.ClipData.newRawUri("", contentUri));

                // Verify if the specialized action is supported, otherwise fallback to ACTION_VIEW
                if (context.getPackageManager().resolveActivity(printIntent, 0) == null) {
                    Log.w(TAG, "Specialized PRINT action not supported, falling back to ACTION_VIEW");
                    printIntent.setAction(Intent.ACTION_VIEW);
                }
                
                Log.d(TAG, "Launching PrintHand (PRINT action) for direct print");
            } else {
                // Fallback: generic PDF viewer / system print
                printIntent = new Intent(Intent.ACTION_VIEW);
                printIntent.setDataAndType(contentUri, "application/pdf");
                printIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                printIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                Log.d(TAG, "PrintHand not found, using ACTION_VIEW fallback");
            }

            context.startActivity(printIntent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("app", printHandInstalled ? "printhand" : "viewer");
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "Error launching print intent", e);
            call.reject("Failed to launch print: " + e.getMessage());
        }
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
