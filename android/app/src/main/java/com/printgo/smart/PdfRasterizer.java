package com.printgo.smart;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Matrix;
import android.graphics.Rect;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class PdfRasterizer {

    private static final String TAG = "PdfRasterizer";

    public static List<Bitmap> rasterize(Context context, Uri fileUri, int dpi) throws IOException {
        ParcelFileDescriptor fd = context.getContentResolver().openFileDescriptor(fileUri, "r");
        if (fd == null) {
            throw new IOException("Failed to open file descriptor for " + fileUri);
        }

        PdfRenderer renderer = new PdfRenderer(fd);
        List<Bitmap> bitmaps = new ArrayList<>();

        try {
            int pageCount = renderer.getPageCount();
            for (int i = 0; i < pageCount; i++) {
                PdfRenderer.Page page = renderer.openPage(i);
                
                // Calculate scale for target DPI
                // Android Points are 1/72 inch. Target DPI is typically 300 or 600.
                float scale = dpi / 72f;
                int width = Math.round(page.getWidth() * scale);
                int height = Math.round(page.getHeight() * scale);

                Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
                // Clear to white
                bitmap.eraseColor(0xFFFFFFFF);
                
                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT);
                bitmaps.add(bitmap);
                
                page.close();
            }
        } finally {
            renderer.close();
            fd.close();
        }

        return bitmaps;
    }

    /**
     * Resizes and converts bitmap to monochrome (1-bit per pixel simulated via thresholding)
     * This is an intermediate step before PCL/ESC-P encoding.
     */
    public static byte[] convertToMonochrome(Bitmap bitmap) {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        
        // Ensure width is a multiple of 8 for bit packing
        int paddedWidth = (width + 7) / 8 * 8;
        byte[] monochrome = new byte[(paddedWidth * height) / 8];
        
        // Create error buffer for Floyd-Steinberg (Error Diffusion)
        // We use a float array to store intensities (0=black, 255=white)
        float[] pixels = new float[width * height];
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int pixel = bitmap.getPixel(x, y);
                // Extract R, G, B and calculate luminance
                int r = (pixel >> 16) & 0xFF;
                int g = (pixel >> 8) & 0xFF;
                int b = pixel & 0xFF;
                pixels[y * width + x] = (float) (0.299 * r + 0.587 * g + 0.114 * b);
            }
        }

        int idx = 0;
        for (int y = 0; y < height; y++) {
            int currentByte = 0;
            int bitCount = 0;
            for (int x = 0; x < paddedWidth; x++) {
                boolean isBlack = false;
                
                if (x < width) {
                    float oldPixel = pixels[y * width + x];
                    float newPixel = (oldPixel < 128) ? 0 : 255;
                    isBlack = (newPixel == 0);
                    float error = oldPixel - newPixel;
                    
                    // Floyd-Steinberg Error Diffusion:
                    //   [ * ]  7/16
                    // 3/16 5/16 1/16
                    if (x + 1 < width) pixels[y * width + (x + 1)] += error * 7/16f;
                    if (y + 1 < height) {
                        if (x > 0) pixels[(y + 1) * width + (x - 1)] += error * 3/16f;
                        pixels[(y + 1) * width + x] += error * 5/16f;
                        if (x + 1 < width) pixels[(y + 1) * width + (x + 1)] += error * 1/16f;
                    }
                }
                
                if (isBlack) {
                    currentByte |= (1 << (7 - bitCount));
                }
                
                bitCount++;
                if (bitCount == 8) {
                    monochrome[idx++] = (byte) currentByte;
                    currentByte = 0;
                    bitCount = 0;
                }
            }
        }
        
        return monochrome;
    }
}
