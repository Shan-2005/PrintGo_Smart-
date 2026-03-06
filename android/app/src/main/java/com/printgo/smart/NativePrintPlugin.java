package com.printgo.smart;

import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.InputStream;
import java.io.OutputStream;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "NativePrint")
public class NativePrintPlugin extends Plugin {

    private static final String TAG = "NativePrintPlugin";

    @PluginMethod
    public void printDocument(PluginCall call) {
        String uriString = call.getString("uri");

        if (uriString == null || uriString.isEmpty()) {
            call.reject("Must provide a file URI");
            return;
        }

        try {
            Uri fileUri = Uri.parse(uriString);
            
            PrintManager printManager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
            if (printManager == null) {
                call.reject("PrintService unavailable");
                return;
            }

            String jobName = "PrintGo_Smart_" + System.currentTimeMillis();

            PrintDocumentAdapter pda = new PrintDocumentAdapter() {
                @Override
                public void onWrite(PageRange[] pages, ParcelFileDescriptor destination, CancellationSignal cancellationSignal, WriteResultCallback callback) {
                    InputStream input = null;
                    OutputStream output = null;

                    try {
                        input = getContext().getContentResolver().openInputStream(fileUri);
                        output = new FileOutputStream(destination.getFileDescriptor());

                        byte[] buf = new byte[1024];
                        int bytesRead;

                        while ((bytesRead = input.read(buf)) > 0) {
                            output.write(buf, 0, bytesRead);
                        }

                        callback.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});

                    } catch (Exception e) {
                        Log.e(TAG, "Failed to write document", e);
                        callback.onWriteFailed(e.toString());
                    } finally {
                        try {
                            if (input != null) input.close();
                            if (output != null) output.close();
                        } catch (Exception e) {
                            Log.e(TAG, "Error closing streams", e);
                        }
                    }
                }

                @Override
                public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes, CancellationSignal cancellationSignal, LayoutResultCallback callback, Bundle extras) {
                    if (cancellationSignal.isCanceled()) {
                        callback.onLayoutCancelled();
                        return;
                    }

                    PrintDocumentInfo pdi = new PrintDocumentInfo.Builder(jobName)
                            .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                            .build();

                    callback.onLayoutFinished(pdi, true);
                }
            };

            printManager.print(jobName, pda, null);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Print job issued to Native Print Manager.");
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "Error initiating print job", e);
            call.reject("Failed to open PrintManager: " + e.getMessage());
        }
    }
}
