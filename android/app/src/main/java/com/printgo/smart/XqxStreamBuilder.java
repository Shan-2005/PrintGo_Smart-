package com.printgo.smart;

import android.graphics.Bitmap;
import android.graphics.Color;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;

/**
 * XqxStreamBuilder
 *
 * Builds a complete binary XQX print stream for the HP M1005 MFP.
 * Ported from verified professional specifications.
 */
public class XqxStreamBuilder {

    private static final String TAG = "XqxStreamBuilder";

    private int    paperCode  = M1005DriverConfig.Paper.A4;
    private int    mediaCode  = M1005DriverConfig.Media.STANDARD;
    private int    sourceCode = M1005DriverConfig.Source.AUTO;
    private int    duplexCode = M1005DriverConfig.Duplex.OFF;
    private int    density    = M1005DriverConfig.PJL_DENSITY;
    private boolean draftMode = M1005DriverConfig.ECONOMY_MODE_DEFAULT;
    private String jobName    = "PrintJob";
    private String userName   = "android";

    public XqxStreamBuilder setPaper(int paperCode)   { this.paperCode  = paperCode;  return this; }
    public XqxStreamBuilder setMedia(int mediaCode)   { this.mediaCode  = mediaCode;  return this; }
    public XqxStreamBuilder setSource(int sourceCode) { this.sourceCode = sourceCode; return this; }
    public XqxStreamBuilder setDuplex(int duplexCode) { this.duplexCode = duplexCode; return this; }
    public XqxStreamBuilder setDensity(int density)   { this.density    = density;    return this; }
    public XqxStreamBuilder setDraftMode(boolean d)   { this.draftMode  = d;          return this; }
    public XqxStreamBuilder setJobName(String name)   { this.jobName    = name;       return this; }
    public XqxStreamBuilder setUserName(String name)  { this.userName   = name;       return this; }

    public byte[] build(Bitmap[] pages) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        DataOutputStream dos = new DataOutputStream(baos);

        Log.d(TAG, "Building XQX stream for " + pages.length + " page(s)");

        writePjlHeader(dos);
        dos.write(M1005DriverConfig.XQX_MAGIC);
        writeStartDoc(dos);

        for (int i = 0; i < pages.length; i++) {
            Bitmap bmp = pages[i];
            if (draftMode) bmp = applyDraftMode(bmp);

            byte[][] mono = bitmapToMono(bmp);
            writeStartPage(dos, bmp.getWidth(), bmp.getHeight());
            writeRasterBands(dos, mono, bmp.getWidth(), bmp.getHeight());
            writeEndPage(dos);
        }

        writeEndDoc(dos);
        writePjlFooter(dos);

        byte[] stream = baos.toByteArray();
        Log.d(TAG, "XQX stream built: " + stream.length + " bytes");
        return stream;
    }

    private void writePjlHeader(DataOutputStream dos) throws IOException {
        String pjl = "\u001B%-12345X@PJL JOB NAME=\"" + jobName + "\"\r\n"
            + "@PJL SET USERNAME=\"" + userName + "\"\r\n"
            + "@PJL SET JAMRECOVERY="  + (M1005DriverConfig.PJL_JAM_RECOVERY ? "ON" : "OFF") + "\r\n"
            + "@PJL SET DENSITY="      + density + "\r\n"
            + "@PJL SET ECONOMODE="    + (draftMode ? "ON" : "OFF") + "\r\n"
            + "@PJL SET RET="          + M1005DriverConfig.PJL_RET + "\r\n"
            + "@PJL INFO STATUS\r\n"
            + "@PJL USTATUS DEVICE=ON\r\n"
            + "@PJL USTATUS JOB=ON\r\n"
            + "@PJL USTATUS PAGE=ON\r\n"
            + "@PJL USTATUS TIMED=" + M1005DriverConfig.PJL_STATUS_TIMED + "\r\n"
            + "@PJL SET JOBATTR=\"JobAttr4=" + System.currentTimeMillis() + "\"\r\n";
        dos.write(pjl.getBytes("ISO-8859-1"));
    }

    private void writePjlFooter(DataOutputStream dos) throws IOException {
        String footer = "\u001B%-12345X@PJL EOJ\r\n\u001B%-12345X";
        dos.write(footer.getBytes("ISO-8859-1"));
    }

    private void writeStartDoc(DataOutputStream dos) throws IOException {
        writeRecord(dos, M1005DriverConfig.XQX_RECORD_START_DOC, ids -> {
            writeItem(ids, M1005DriverConfig.XQX_TAG_BLOCK_SIZE, (long) M1005DriverConfig.XQX_START_DOC_BLOCK_SIZE);
            writeItem(ids, 0x10000005L, 1L);
            writeItem(ids, 0x10000001L, 0L);
            writeItem(ids, M1005DriverConfig.XQX_TAG_DUPLEX, (long) duplexCode);
            writeItem(ids, 0x10000000L, 0L);
            writeItem(ids, 0x10000003L, 1L);
            writeEndItem(ids);
        });
    }

    private void writeStartPage(DataOutputStream dos, int pw, int ph) throws IOException {
        writeRecord(dos, M1005DriverConfig.XQX_RECORD_START_PAGE, ids -> {
            writeItem(ids, M1005DriverConfig.XQX_TAG_BLOCK_SIZE, (long) M1005DriverConfig.XQX_START_PAGE_BLOCK_SIZE);
            writeItem(ids, 0x20000005L, 1L);
            writeItem(ids, M1005DriverConfig.XQX_TAG_SOURCE, (long) sourceCode);
            writeItem(ids, M1005DriverConfig.XQX_TAG_MEDIA, (long) mediaCode);
            writeItem(ids, 0x20000007L, 1L);
            writeItem(ids, M1005DriverConfig.XQX_TAG_RESOLUTION_X, (long) M1005DriverConfig.DPI_X_DEFAULT);
            writeItem(ids, M1005DriverConfig.XQX_TAG_RESOLUTION_Y, (long) M1005DriverConfig.DPI_Y_DEFAULT);
            writeItem(ids, M1005DriverConfig.XQX_TAG_RASTER_X, (long) pw);
            writeItem(ids, M1005DriverConfig.XQX_TAG_RASTER_Y, (long) ph);
            writeItem(ids, M1005DriverConfig.XQX_TAG_VIDEO_BPP, (long) M1005DriverConfig.BITS_PER_PIXEL);
            writeItem(ids, M1005DriverConfig.XQX_TAG_VIDEO_X, (long) pw);
            writeItem(ids, M1005DriverConfig.XQX_TAG_VIDEO_Y, (long) ph);
            writeItem(ids, 0x20000009L, 0L);
            writeEndItem(ids);
        });
    }

    private void writeRasterBands(DataOutputStream dos, byte[][] mono, int pw, int ph) throws IOException {
        int y = 0;
        while (y < ph) {
            int bandH = Math.min(M1005DriverConfig.RASTER_BAND_HEIGHT, ph - y);
            ByteArrayOutputStream bandBuf = new ByteArrayOutputStream();
            for (int row = y; row < y + bandH; row++) {
                bandBuf.write(mono[row]);
            }
            byte[] raw = bandBuf.toByteArray();

            dos.writeInt(M1005DriverConfig.XQX_RECORD_RASTER);
            dos.writeInt(raw.length + 20);
            dos.write(le32(M1005DriverConfig.RASTER_COMPRESSION));
            dos.write(le32(y));
            dos.write(le32(bandH));
            dos.write(le32(pw));
            dos.write(raw);

            y += bandH;
        }
    }

    private void writeEndPage(DataOutputStream dos) throws IOException {
        writeRecord(dos, M1005DriverConfig.XQX_RECORD_END_PAGE, ids -> {
            writeItem(ids, M1005DriverConfig.XQX_TAG_BLOCK_SIZE, (long) M1005DriverConfig.XQX_END_PAGE_BLOCK_SIZE);
            writeItem(ids, 0x30000001L, 0L);
            writeEndItem(ids);
        });
    }

    private void writeEndDoc(DataOutputStream dos) throws IOException {
        writeRecord(dos, M1005DriverConfig.XQX_RECORD_END_DOC, ids -> {
            writeItem(ids, M1005DriverConfig.XQX_TAG_BLOCK_SIZE, (long) M1005DriverConfig.XQX_END_DOC_BLOCK_SIZE);
            writeEndItem(ids);
        });
    }

    private byte[][] bitmapToMono(Bitmap bitmap) {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        int bytesPerRow = (width + 7) / 8;
        byte[][] rows = new byte[height][bytesPerRow];
        float[] errors = new float[width + 2];

        for (int y = 0; y < height; y++) {
            float[] nextErrors = new float[width + 2];
            for (int x = 0; x < width; x++) {
                int px = bitmap.getPixel(x, y);
                float lum = (Color.red(px) * 0.299f + Color.green(px) * 0.587f + Color.blue(px) * 0.114f) + errors[x + 1];
                int pixel = (lum < 128f) ? 0 : 255;
                float diffErr = lum - pixel;
                if (pixel == 0) {
                    rows[y][x / 8] |= (byte) (0x80 >> (x % 8));
                }
                errors[x + 2] += diffErr * 7f / 16f;
                nextErrors[x] += diffErr * 3f / 16f;
                nextErrors[x + 1] += diffErr * 5f / 16f;
                nextErrors[x + 2] += diffErr * 1f / 16f;
            }
            errors = nextErrors;
        }
        return rows;
    }

    private Bitmap applyDraftMode(Bitmap src) {
        Bitmap dst = src.copy(src.getConfig(), true);
        for (int y = 0; y < dst.getHeight(); y++) {
            for (int x = (y % 2); x < dst.getWidth(); x += 2) {
                dst.setPixel(x, y, Color.WHITE);
            }
        }
        return dst;
    }

    interface RecordBody {
        void write(DataOutputStream dos) throws IOException;
    }

    private void writeRecord(DataOutputStream dos, int type, RecordBody body) throws IOException {
        ByteArrayOutputStream inner = new ByteArrayOutputStream();
        DataOutputStream ids = new DataOutputStream(inner);
        body.write(ids);
        byte[] data = inner.toByteArray();
        dos.writeInt(type);
        dos.writeInt(data.length + 8);
        dos.write(data);
    }

    private void writeItem(DataOutputStream dos, long tag, long value) throws IOException {
        dos.write(le32((int) tag));
        dos.write(le32((int) value));
    }

    private void writeEndItem(DataOutputStream dos) throws IOException {
        dos.write(le32(0x00000000));
        dos.write(le32(M1005DriverConfig.XQX_END_MARKER));
    }

    private byte[] le32(int v) {
        return new byte[]{(byte)(v & 0xFF), (byte)((v >> 8) & 0xFF), (byte)((v >> 16) & 0xFF), (byte)((v >> 24) & 0xFF)};
    }
}
