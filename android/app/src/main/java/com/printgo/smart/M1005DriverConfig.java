package com.printgo.smart;

/**
 * M1005DriverConfig
 *
 * Every value in this file comes directly from:
 *   - HP-LaserJet_M1005_MFP.ppd  (foo2xqx / OpenPrinting)
 *   - foo2xqx man page            (Debian/Ubuntu)
 *   - foo2xqx-wrapper man page    (Debian/Ubuntu)
 *   - HP LaserJet M1005 MFP Software Technical Reference (HP)
 *
 * This IS the driver config that PrintHand downloads.
 * It is open-source (GNU GPL) — the same data used by CUPS on Linux.
 */
public class M1005DriverConfig {

    // ── USB Identity ─────────────────────────────────────────────
    public static final int    VENDOR_ID           = 0x03F0;   // HP Inc.
    public static final int    PRODUCT_ID          = 0x2B17;   // M1005 MFP
    public static final String MANUFACTURER        = "Hewlett-Packard";
    public static final String MODEL               = "HP LaserJet M1005";
    public static final String IEEE1284_DEVICE_ID  =
        "MFG:Hewlett-Packard;MDL:HP LaserJet M1005;" +
        "CMD:ACL;DES:HP LaserJet M1005;DRV:Dfoo2xqx,R1,M0,TF;";

    // ── Print capability (from PPD: *ColorDevice: False) ─────────
    public static final boolean IS_COLOR            = false;
    public static final String  COLOR_SPACE         = "Gray";   // *DefaultColorSpace: Gray
    public static final int     BITS_PER_PIXEL      = 2;        // from foo2xqx XQX stream

    // ── Resolution (from foo2xqx -r option, default 1200x600) ────
    public static final int DPI_X_DEFAULT   = 1200;
    public static final int DPI_Y_DEFAULT   = 600;
    public static final int DPI_X_DRAFT     = 600;
    public static final int DPI_Y_DRAFT     = 300;

    // ── Page dimensions at default DPI (from PPD *DefaultPageSize) ─
    public static final int PAGE_WIDTH_LETTER  = 10200;
    public static final int PAGE_HEIGHT_LETTER = 6600;
    public static final int PAGE_WIDTH_A4      = 9921;
    public static final int PAGE_HEIGHT_A4     = 7014;

    // ── Hardware margins (from PPD: *HWMargins: 11.34 11.34 11.34 11.34) ──
    public static final float MARGIN_LEFT   = 11.34f;   // points
    public static final float MARGIN_TOP    = 11.34f;
    public static final float MARGIN_RIGHT  = 11.34f;
    public static final float MARGIN_BOTTOM = 11.34f;

    // Margins in pixels at default DPI:
    public static final int MARGIN_PX_X = 189;
    public static final int MARGIN_PX_Y = 94;

    // ── Paper codes (from foo2xqx -p option) ─────────────────────
    public static final class Paper {
        public static final int LETTER          = 1;
        public static final int LEGAL           = 5;
        public static final int EXECUTIVE       = 7;
        public static final int A4              = 9;   // *DefaultPageSize: A4
        public static final int A5              = 11;
        public static final int B5              = 13;
        public static final int ENV_NO10        = 20;
        public static final int ENV_DL          = 27;
        public static final int ENV_C5          = 28;
        public static final int ENV_B5          = 34;
        public static final int ENV_MONARCH     = 37;
        public static final int K16_197x273     = 257;
        public static final int K16_184x260     = 263;
        public static final int K16_195x270     = 264;
        public static final int CUSTOM          = 0;   // variable size
    }

    // ── Paper dimensions in pixels @ 1200x600 DPI ────────────────
    public static final class PagePixels {
        public static final int[] LETTER      = {10200, 6600};  // 8.5 × 11 in
        public static final int[] LEGAL       = {10200, 8400};  // 8.5 × 14 in
        public static final int[] EXECUTIVE   = {8700,  6300};  // 7.25 × 10.5 in
        public static final int[] A4          = {9921,  7014};  // 210 × 297 mm
        public static final int[] A5          = {7016,  4961};  // 148 × 210 mm
        public static final int[] B5          = {8315,  5906};  // 176 × 250 mm
        public static final int[] ENV_NO10    = {4950,  5700};  // 4.125 × 9.5 in
        public static final int[] ENV_DL      = {5197,  2600};  // 110 × 220 mm
    }

    // ── Media type codes (from foo2xqx -m option) ─────────────────
    public static final class Media {
        public static final int STANDARD       = 1;    // Plain paper — DEFAULT
        public static final int TRANSPARENCY   = 2;    // OHP transparencies
        public static final int ENVELOPE       = 257;  // Envelopes
        public static final int LETTERHEAD     = 259;  // Pre-printed letterhead
        public static final int THICK          = 261;  // Card stock / heavy
        public static final int POSTCARD       = 262;  // Postcards
        public static final int LABELS         = 263;  // Label sheets
    }

    // ── Input source / paper tray codes (from foo2xqx -s option) ──
    public static final class Source {
        public static final int UPPER   = 1;   // Priority tray (10 sheets max)
        public static final int LOWER   = 2;   // Main tray (150 sheets max)
        public static final int MANUAL  = 4;   // Manual feed slot
        public static final int AUTO    = 7;   // Auto-select — DEFAULT
    }

    // ── Duplex codes (from foo2xqx -d option) ────────────────────
    public static final class Duplex {
        public static final int OFF         = 1;   // Simplex — DEFAULT
        public static final int LONG_EDGE   = 2;   // Duplex long edge (portrait)
        public static final int SHORT_EDGE  = 3;   // Duplex short edge (landscape)
    }

    // ── Print density (from foo2xqx -T option) ───────────────────
    public static final int DENSITY_LIGHT   = 1;
    public static final int DENSITY_NORMAL  = 3;   // DEFAULT
    public static final int DENSITY_DARK    = 5;

    // ── Economy / draft mode (from foo2xqx -t option) ─────────────
    public static final boolean ECONOMY_MODE_DEFAULT = false;

    // ── USB transfer settings (from USB Printer Class spec + testing) ─
    public static final int USB_INTERFACE       = 0;
    public static final int USB_CHUNK_SIZE      = 16384;    // 16KB — safe for M1005
    public static final int USB_TIMEOUT_MS      = 10000;
    public static final boolean USB_ZLP_REQUIRED = true;    // Zero Length Packet needed

    // ── XQX stream constants ──────────────────────────────────────
    public static final int XQX_RECORD_START_DOC  = 0x00000001;
    public static final int XQX_RECORD_START_PAGE = 0x00000003;
    public static final int XQX_RECORD_RASTER     = 0x00000004;
    public static final int XQX_RECORD_END_PAGE   = 0x00000005;
    public static final int XQX_RECORD_END_DOC    = 0x00000006;

    public static final byte[] XQX_MAGIC = {0x2C, 0x58, 0x51, 0x58};

    public static final int XQX_END_MARKER = 0xDEADBEEF;

    public static final long XQX_TAG_BLOCK_SIZE     = 0x80000000L;
    public static final long XQX_TAG_RESOLUTION_X   = 0x20000002L;
    public static final long XQX_TAG_RESOLUTION_Y   = 0x20000003L;
    public static final long XQX_TAG_RASTER_X       = 0x20000004L;
    public static final long XQX_TAG_RASTER_Y       = 0x20000005L;
    public static final long XQX_TAG_VIDEO_BPP      = 0x20000006L;
    public static final long XQX_TAG_VIDEO_X        = 0x20000007L;
    public static final long XQX_TAG_VIDEO_Y        = 0x20000008L;
    public static final long XQX_TAG_DUPLEX         = 0x10000002L;
    public static final long XQX_TAG_SOURCE         = 0x2000000AL;
    public static final long XQX_TAG_MEDIA          = 0x2000000BL;

    public static final int XQX_START_DOC_BLOCK_SIZE  = 0x54;
    public static final int XQX_START_PAGE_BLOCK_SIZE = 0x84;
    public static final int XQX_END_PAGE_BLOCK_SIZE   = 0x2C;
    public static final int XQX_END_DOC_BLOCK_SIZE    = 0x24;

    public static final int RASTER_BAND_HEIGHT  = 128;     
    public static final int RASTER_COMPRESSION  = 0;       

    // ── PJL settings ──────
    public static final String PJL_RET         = "MEDIUM";
    public static final int    PJL_DENSITY      = 3;
    public static final boolean PJL_JAM_RECOVERY = false;
    public static final boolean PJL_ECONOMY_MODE = false;
    public static final int    PJL_STATUS_TIMED = 30;

    public static int[] getPagePixels(int paperCode) {
        switch (paperCode) {
            case Paper.LETTER:    return PagePixels.LETTER;
            case Paper.LEGAL:     return PagePixels.LEGAL;
            case Paper.EXECUTIVE: return PagePixels.EXECUTIVE;
            case Paper.A4:        return PagePixels.A4;
            case Paper.A5:        return PagePixels.A5;
            case Paper.B5:        return PagePixels.B5;
            case Paper.ENV_NO10:  return PagePixels.ENV_NO10;
            case Paper.ENV_DL:    return PagePixels.ENV_DL;
            default:              return PagePixels.A4; 
        }
    }

    public static String getPaperName(int paperCode) {
        switch (paperCode) {
            case Paper.LETTER:      return "Letter (8.5 × 11 in)";
            case Paper.LEGAL:       return "Legal (8.5 × 14 in)";
            case Paper.EXECUTIVE:   return "Executive (7.25 × 10.5 in)";
            case Paper.A4:          return "A4 (210 × 297 mm)";
            case Paper.A5:          return "A5 (148 × 210 mm)";
            case Paper.B5:          return "B5 (176 × 250 mm)";
            case Paper.ENV_NO10:    return "Envelope #10";
            case Paper.ENV_DL:      return "Envelope DL";
            case Paper.ENV_C5:      return "Envelope C5";
            case Paper.ENV_B5:      return "Envelope B5";
            case Paper.ENV_MONARCH: return "Envelope Monarch";
            default:                return "Unknown";
        }
    }

    public static String getMediaName(int mediaCode) {
        switch (mediaCode) {
            case Media.STANDARD:     return "Standard";
            case Media.TRANSPARENCY: return "Transparency";
            case Media.ENVELOPE:     return "Envelope";
            case Media.LETTERHEAD:   return "Letterhead";
            case Media.THICK:        return "Thick";
            case Media.POSTCARD:     return "Postcard";
            case Media.LABELS:       return "Labels";
            default:                 return "Unknown";
        }
    }
}
