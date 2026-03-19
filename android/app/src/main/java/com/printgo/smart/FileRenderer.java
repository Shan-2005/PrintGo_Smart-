package com.printgo.smart;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.Typeface;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.util.Log;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;

/**
 * FileRenderer
 *
 * Converts any supported file type to an array of Bitmaps (one per page).
 */
public class FileRenderer {

    private static final String TAG = "FileRenderer";

    private final int pageW;
    private final int pageH;
    private final Context context;

    public FileRenderer(Context context, int paperCode) {
        this.context = context;
        int[] dims = M1005DriverConfig.getPagePixels(paperCode);
        this.pageW = dims[0];
        this.pageH = dims[1];
    }

    public interface RenderCallback {
        void onProgress(String status);
    }

    public Bitmap[] render(Uri uri, String mimeType, RenderCallback cb) throws Exception {
        if (mimeType == null) mimeType = guessType(uri);
        Log.d(TAG, "Rendering: " + uri + " mimeType=" + mimeType);

        if ("application/pdf".equals(mimeType)) {
            return renderPdf(uri, cb);
        } else if (mimeType != null && mimeType.startsWith("image/")) {
            return renderImage(uri, cb);
        } else if (mimeType != null && mimeType.startsWith("text/")) {
            return renderText(uri, cb);
        } else {
            try { return renderPdf(uri, cb); } 
            catch (Exception e) {
                try { return renderImage(uri, cb); } 
                catch (Exception e2) { return renderText(uri, cb); }
            }
        }
    }

    private Bitmap[] renderPdf(Uri uri, RenderCallback cb) throws Exception {
        cb.onProgress("Opening PDF...");
        ParcelFileDescriptor pfd = context.getContentResolver().openFileDescriptor(uri, "r");
        if (pfd == null) throw new Exception("Cannot open PDF");

        PdfRenderer renderer = new PdfRenderer(pfd);
        int pageCount = renderer.getPageCount();
        Bitmap[] pages = new Bitmap[pageCount];

        for (int i = 0; i < pageCount; i++) {
            cb.onProgress("Rendering PDF page " + (i + 1) + " of " + pageCount);
            PdfRenderer.Page page = renderer.openPage(i);

            float scaleX = (float) M1005DriverConfig.DPI_X_DEFAULT / 72f;
            float scaleY = (float) M1005DriverConfig.DPI_Y_DEFAULT / 72f;

            int w = Math.round(page.getWidth()  * scaleX);
            int h = Math.round(page.getHeight() * scaleY);

            w = Math.min(w, pageW - M1005DriverConfig.MARGIN_PX_X * 2);
            h = Math.min(h, pageH - M1005DriverConfig.MARGIN_PX_Y * 2);

            Bitmap bmp = Bitmap.createBitmap(pageW, pageH, Bitmap.Config.ARGB_8888);
            bmp.eraseColor(Color.WHITE);

            page.render(bmp, new Rect(M1005DriverConfig.MARGIN_PX_X, M1005DriverConfig.MARGIN_PX_Y, 
                                     M1005DriverConfig.MARGIN_PX_X + w, M1005DriverConfig.MARGIN_PX_Y + h),
                        null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT);
            page.close();
            pages[i] = bmp;
        }
        renderer.close();
        pfd.close();
        return pages;
    }

    private Bitmap[] renderImage(Uri uri, RenderCallback cb) throws Exception {
        cb.onProgress("Loading image...");
        InputStream is = context.getContentResolver().openInputStream(uri);
        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inJustDecodeBounds = true;
        BitmapFactory.decodeStream(is, null, opts);
        is.close();

        int sampleSize = 1;
        while ((opts.outWidth / sampleSize) > pageW * 2 || (opts.outHeight / sampleSize) > pageH * 2) sampleSize *= 2;

        is = context.getContentResolver().openInputStream(uri);
        opts = new BitmapFactory.Options();
        opts.inSampleSize = sampleSize;
        Bitmap src = BitmapFactory.decodeStream(is, null, opts);
        is.close();
        if (src == null) throw new Exception("Cannot decode image");

        int printW = pageW - M1005DriverConfig.MARGIN_PX_X * 2;
        int printH = pageH - M1005DriverConfig.MARGIN_PX_Y * 2;
        float scale = Math.min((float) printW / src.getWidth(), (float) printH / src.getHeight());
        scale = Math.min(scale, 1.0f);

        int scaledW = Math.round(src.getWidth() * scale);
        int scaledH = Math.round(src.getHeight() * scale);

        Bitmap page = Bitmap.createBitmap(pageW, pageH, Bitmap.Config.ARGB_8888);
        page.eraseColor(Color.WHITE);
        Canvas canvas = new Canvas(page);
        Bitmap scaled = Bitmap.createScaledBitmap(src, scaledW, scaledH, true);
        canvas.drawBitmap(scaled, M1005DriverConfig.MARGIN_PX_X + (printW - scaledW) / 2f, 
                                 M1005DriverConfig.MARGIN_PX_Y + (printH - scaledH) / 2f, null);
        src.recycle();
        scaled.recycle();
        return new Bitmap[]{page};
    }

    private Bitmap[] renderText(Uri uri, RenderCallback cb) throws Exception {
        cb.onProgress("Reading text...");
        InputStream is = context.getContentResolver().openInputStream(uri);
        BufferedReader reader = new BufferedReader(new InputStreamReader(is, "UTF-8"));
        List<String> lines = new ArrayList<>();
        String line;
        while ((line = reader.readLine()) != null) lines.add(line);
        reader.close(); is.close();

        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(Color.BLACK);
        paint.setTypeface(Typeface.MONOSPACE);
        paint.setTextSize(28f);

        int printW = pageW - M1005DriverConfig.MARGIN_PX_X * 2;
        int printH = pageH - M1005DriverConfig.MARGIN_PX_Y * 2;
        float lineH = paint.getFontSpacing();
        int linesPerPage = (int)(printH / lineH);

        List<String> wrapped = new ArrayList<>();
        for (String l : lines) {
            while (paint.measureText(l) > printW) {
                int cut = l.length() - 1;
                while (cut > 0 && paint.measureText(l, 0, cut) > printW) cut--;
                wrapped.add(l.substring(0, cut));
                l = l.substring(cut);
            }
            wrapped.add(l);
        }

        List<Bitmap> pages = new ArrayList<>();
        int totalPages = (int) Math.ceil((double) wrapped.size() / linesPerPage);
        for (int p = 0; p < totalPages; p++) {
            Bitmap bmp = Bitmap.createBitmap(pageW, pageH, Bitmap.Config.ARGB_8888);
            bmp.eraseColor(Color.WHITE);
            Canvas canvas = new Canvas(bmp);
            int start = p * linesPerPage;
            int end = Math.min(start + linesPerPage, wrapped.size());
            for (int li = start; li < end; li++) {
                canvas.drawText(wrapped.get(li), M1005DriverConfig.MARGIN_PX_X, 
                               M1005DriverConfig.MARGIN_PX_Y + paint.getTextSize() + (li - start) * lineH, paint);
            }
            pages.add(bmp);
        }
        return pages.toArray(new Bitmap[0]);
    }

    private String guessType(Uri uri) {
        String low = uri.getPath() != null ? uri.getPath().toLowerCase() : "";
        if (low.endsWith(".pdf")) return "application/pdf";
        if (low.endsWith(".jpg") || low.endsWith(".jpeg")) return "image/jpeg";
        if (low.endsWith(".png")) return "image/png";
        if (low.endsWith(".txt")) return "text/plain";
        return null;
    }
}
