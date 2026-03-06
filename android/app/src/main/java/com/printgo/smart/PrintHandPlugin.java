package com.printgo.smart;

import android.content.Intent;
import android.net.Uri;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PrintHand")
public class PrintHandPlugin extends Plugin {

    private static final String TAG = "PrintHandPlugin";
    // Change package name if the free version is used: "com.dynamixsoftware.printhand"
    private static final String PRINTHAND_PACKAGE = "com.dynamixsoftware.printhand.premium";

    @PluginMethod
    public void printDocument(PluginCall call) {
        String uriString = call.getString("uri");
        String mimeType = call.getString("mimeType", "application/pdf");

        if (uriString == null || uriString.isEmpty()) {
            call.reject("Must provide a file URI");
            return;
        }

        try {
            Uri fileUri = Uri.parse(uriString);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(fileUri, mimeType);
            
            // Explicitly target PrintHand
            intent.setPackage(PRINTHAND_PACKAGE);
            
            // Required flags for granting read access to the target app
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            getContext().startActivity(intent);
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Intent sent to PrintHand successfully.");
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "Error launching PrintHand intent", e);
            call.reject("Failed to open PrintHand: " + e.getMessage());
        }
    }
}
