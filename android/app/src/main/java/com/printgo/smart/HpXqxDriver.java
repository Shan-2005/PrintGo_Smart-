package com.printgo.smart;

import android.graphics.Bitmap;
import android.util.Log;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static com.printgo.smart.M1005DriverConfig.*;

/**
 * HpXqxDriver.java
 * Optimized XQX print stream builder for HP M1005.
 * Ported from verified foo2xqx / PrintHand logic.
 */
public class HpXqxDriver {

    private static final String TAG = "HpXqxDriver";

    public static byte[] generateFullXqxJob(Bitmap bitmap, int dpiX, int dpiY, String jobName) throws IOException {
        Log.d(TAG, "Generating XQX job: " + jobName + " DPI:" + dpiX + "x" + dpiY + " BPP:" + BITS_PER_PIXEL);
        
        ByteArrayOutputStream mainBuffer = new ByteArrayOutputStream();
        DataOutputStream dos = new DataOutputStream(mainBuffer);

        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        
        // Rasterize to XQX format (Plane 0 only for grayscale)
        byte[][] rasterDataRows = bitmapToXqxRaster(bitmap);

        // 1. PJL HEADER
        writePjlHeader(dos, jobName);

        // 2. XQX MAGIC (,XQX)
        dos.write(XQX_MAGIC);

        // 3. START_DOC
        writeXqxRecord(dos, XQX_RECORD_START_DOC, inner -> {
            writeXqxItem(inner, XQX_TAG_BLOCK_SIZE, XQX_START_DOC_BLOCK_SIZE);
            writeXqxItem(inner, 0x10000005L, 1L); // dmOrientation: Portrait
            writeXqxItem(inner, 0x10000001L, 9L); // dmPaperSize: A4
            writeXqxItem(inner, XQX_TAG_DUPLEX, Duplex.OFF);
            writeXqxItem(inner, 0x10000000L, 0L);
            writeXqxItem(inner, 0x10000003L, 1L);
            writeXqxEndItem(inner);
        });

        // 4. START_PAGE
        writeXqxRecord(dos, XQX_RECORD_START_PAGE, inner -> {
            writeXqxItem(inner, XQX_TAG_BLOCK_SIZE, XQX_START_PAGE_BLOCK_SIZE);
            writeXqxItem(inner, 0x20000005L, 1L); 
            writeXqxItem(inner, 0x20000001L, 1L);
            writeXqxItem(inner, XQX_TAG_SOURCE, Source.AUTO);
            writeXqxItem(inner, XQX_TAG_MEDIA, Media.STANDARD);
            writeXqxItem(inner, 0x20000007L, 1L);
            writeXqxItem(inner, XQX_TAG_RESOLUTION_X, (long) dpiX);
            writeXqxItem(inner, XQX_TAG_RESOLUTION_Y, (long) dpiY);
            writeXqxItem(inner, XQX_TAG_RASTER_X, (long) width);
            writeXqxItem(inner, XQX_TAG_RASTER_Y, (long) height);
            writeXqxItem(inner, XQX_TAG_VIDEO_BPP, (long) BITS_PER_PIXEL);
            writeXqxItem(inner, XQX_TAG_VIDEO_X, (long) width);
            writeXqxItem(inner, XQX_TAG_VIDEO_Y, (long) height);
            writeXqxItem(inner, 0x20000009L, 0L);
            writeXqxEndItem(inner);
        });

        // 5. RASTER DATA (PLANE_DATA)
        writeRasterRecords(dos, rasterDataRows, width, height);

        // 6. END_PAGE
        writeXqxRecord(dos, XQX_RECORD_END_PAGE, inner -> {
            writeXqxItem(inner, XQX_TAG_BLOCK_SIZE, XQX_END_PAGE_BLOCK_SIZE);
            writeXqxItem(inner, 0x30000001L, 0L);
            writeXqxEndItem(inner);
        });

        // 7. END_DOC
        writeXqxRecord(dos, XQX_RECORD_END_DOC, inner -> {
            writeXqxItem(inner, XQX_TAG_BLOCK_SIZE, XQX_END_DOC_BLOCK_SIZE);
            writeXqxEndItem(inner);
        });

        // 8. PJL FOOTER
        writePjlFooter(dos);

        byte[] finalJob = mainBuffer.toByteArray();
        Log.d(TAG, "Generated XQX job size: " + finalJob.length + " bytes.");
        return finalJob;
    }

    private static void writePjlHeader(DataOutputStream dos, String jobName) throws IOException {
        String pjl = "\u001B%-12345X@PJL JOB\r\n" +
                "@PJL SET JAMRECOVERY=OFF\r\n" +
                "@PJL SET DENSITY=3\r\n" +
                "@PJL SET ECONOMODE=OFF\r\n" +
                "@PJL SET RET=MEDIUM\r\n" +
                "@PJL INFO STATUS\r\n" +
                "@PJL USTATUS DEVICE=ON\r\n" +
                "@PJL USTATUS JOB=ON\r\n" +
                "@PJL USTATUS PAGE=ON\r\n" +
                "@PJL USTATUS TIMED=30\r\n" +
                "@PJL SET JOBATTR=\"JobAttr4=" + System.currentTimeMillis() + "\"\r\n";
        dos.write(pjl.getBytes(StandardCharsets.ISO_8859_1));
    }

    private static void writePjlFooter(DataOutputStream dos) throws IOException {
        String pjl = "\u001B%-12345X@PJL EOJ\r\n\u001B%-12345X";
        dos.write(pjl.getBytes(StandardCharsets.ISO_8859_1));
    }

    private interface RecordBodyWriter {
        void write(DataOutputStream out) throws IOException;
    }

    private static void writeXqxRecord(DataOutputStream dos, int recordType, RecordBodyWriter writer) throws IOException {
        ByteArrayOutputStream inner = new ByteArrayOutputStream();
        DataOutputStream innerDos = new DataOutputStream(inner);
        writer.write(innerDos);
        byte[] data = inner.toByteArray();

        // Big Endian Headers
        dos.writeInt(recordType);
        dos.writeInt(data.length + 8);
        dos.write(data);
    }

    private static void writeXqxItem(DataOutputStream dos, long tag, long value) throws IOException {
        // Little Endian Payload
        dos.write(intToLe((int) tag));
        dos.write(intToLe((int) value));
    }

    private static void writeXqxEndItem(DataOutputStream dos) throws IOException {
        dos.write(intToLe(0x00000000));
        dos.write(intToLe(XQX_END_MARKER));
    }

    private static void writeRasterRecords(DataOutputStream dos, byte[][] rows, int width, int height) throws IOException {
        int y = 0;
        while (y < height) {
            int bandH = Math.min(RASTER_BAND_HEIGHT, height - y);
            ByteArrayOutputStream bandBuffer = new ByteArrayOutputStream();
            for (int row = y; row < y + bandH; row++) {
                bandBuffer.write(rows[row]);
            }
            byte[] bandData = bandBuffer.toByteArray();

            // Record Header: BIG ENDIAN
            dos.writeInt(XQX_RECORD_RASTER);
            dos.writeInt(bandData.length + 20); // Header(8) + Metadata(12) + Data
            
            // Record Metadata: LITTLE ENDIAN
            dos.write(intToLe(0)); // compression: none
            dos.write(intToLe(y));
            dos.write(intToLe(bandH));
            dos.write(intToLe(width));
            
            // Raw Bits
            dos.write(bandData);
            y += bandH;
        }
    }

    private static byte[][] bitmapToXqxRaster(Bitmap bitmap) {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        int bytesPerRow = (width + 7) / 8;
        byte[][] result = new byte[height][bytesPerRow];

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int pixel = bitmap.getPixel(x, y);
                int r = (pixel >> 16) & 0xFF;
                int g = (pixel >> 8) & 0xFF;
                int b = pixel & 0xFF;
                int gray = (r * 299 + g * 587 + b * 114) / 1000;
                
                // M1005 BPP=2 but effectively uses a 1-bit mask or 
                // dithering. For now, simple 1-bit threshold.
                if (gray < 128) {
                    result[y][x / 8] |= (byte) (0x80 >> (x % 8));
                }
            }
        }
        return result;
    }

    private static byte[] intToLe(int value) {
        return new byte[]{
                (byte) (value & 0xFF),
                (byte) ((value >> 8) & 0xFF),
                (byte) ((value >> 16) & 0xFF),
                (byte) ((value >> 24) & 0xFF)
        };
    }
}
