package com.printgo.smart;

import android.content.Context;
import android.graphics.Bitmap;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.net.Uri;
import android.util.Log;

/**
 * PrintManager
 *
 * Orchestration layer for the modular print system.
 */
public class PrintManager {

    private static final String TAG = "PrintManager";

    public static class Job {
        Uri    uri;
        String mimeType;
        int    paperCode  = M1005DriverConfig.Paper.A4;
        int    mediaCode  = M1005DriverConfig.Media.STANDARD;
        int    sourceCode = M1005DriverConfig.Source.AUTO;
        int    duplexCode = M1005DriverConfig.Duplex.OFF;
        int    density    = M1005DriverConfig.PJL_DENSITY;
        boolean draftMode = false;
        String jobName    = "PrintJob";

        public Job setUri(Uri uri)            { this.uri        = uri;        return this; }
        public Job setMimeType(String t)      { this.mimeType   = t;          return this; }
        public Job setPaper(int code)         { this.paperCode  = code;       return this; }
        public Job setMedia(int code)         { this.mediaCode  = code;       return this; }
        public Job setSource(int code)        { this.sourceCode = code;       return this; }
        public Job setDuplex(int code)        { this.duplexCode = code;       return this; }
        public Job setDensity(int d)          { this.density    = d;          return this; }
        public Job setDraftMode(boolean dm)   { this.draftMode  = dm;         return this; }
        public Job setJobName(String name)    { this.jobName    = name;       return this; }
    }

    public interface PrintListener {
        void onStatus(String message);
        void onProgress(int percent);
        void onComplete();
        void onError(String error);
    }

    public static void print(Context context, UsbManager usbManager, UsbDevice device, Job job, PrintListener listener) {
        if (job.uri == null) {
            listener.onError("No file selected.");
            return;
        }

        try {
            listener.onStatus("Preparing document...");
            FileRenderer renderer = new FileRenderer(context, job.paperCode);
            Bitmap[] pages = renderer.render(job.uri, job.mimeType, status -> listener.onStatus(status));

            if (pages == null || pages.length == 0) {
                listener.onError("Could not read file.");
                return;
            }

            listener.onStatus("Building print stream...");
            XqxStreamBuilder builder = new XqxStreamBuilder()
                    .setPaper(job.paperCode).setMedia(job.mediaCode).setSource(job.sourceCode)
                    .setDuplex(job.duplexCode).setDensity(job.density).setDraftMode(job.draftMode).setJobName(job.jobName);

            byte[] stream = builder.build(pages);

            for (Bitmap bmp : pages) if (bmp != null) bmp.recycle();

            UsbPrintTransport.send(usbManager, device, stream, new UsbPrintTransport.TransportListener() {
                @Override public void onStatus(String msg) { listener.onStatus(msg); }
                @Override public void onProgress(int pct) { listener.onProgress(pct); }
                @Override public void onDone() { listener.onComplete(); }
                @Override public void onError(String msg) { listener.onError(msg); }
            });

        } catch (Exception e) {
            Log.e(TAG, "Print failed", e);
            listener.onError("Print failed: " + e.getMessage());
        }
    }
}
