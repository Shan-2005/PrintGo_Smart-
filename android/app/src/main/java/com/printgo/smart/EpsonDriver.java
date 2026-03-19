package com.printgo.smart;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

public class EpsonDriver {

    // 1. Job Start (Reset + Units)
    public static byte[] generateJobHeader() throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(new byte[]{0x1B, 0x40}); // ESC @ (Reset)
        // Set Units to 1/360" (BC=1, n=10)
        out.write(new byte[]{0x1B, 0x28, 0x55, 0x01, 0x00, 0x0A});
        return out.toByteArray();
    }

    // 2. Page Start (Page Length + Graphics Mode)
    public static byte[] generatePageHeader(int height) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        
        // ESC ( c BC=4 nL nH mL mH (Set Page Length)
        // For A4 at 360 DPI, height is approx 4209
        out.write(new byte[]{0x1B, 0x28, 0x63, 0x04, 0x00});
        out.write(new byte[]{(byte) (height & 0xFF), (byte) ((height >> 8) & 0xFF)});
        out.write(new byte[]{0x00, 0x00}); // Unused / reserved

        // ESC ( G BC=1 n=01 (Select Graphics Mode)
        out.write(new byte[]{0x1B, 0x28, 0x47, 0x01, 0x00, 0x01});
        return out.toByteArray();
    }

    // 3. Raster Packet
    public static byte[] generateRasterPacket(byte[] monochromeData, int y, int width, int bytesPerRow) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        
        // A. Set Absolute Vertical Position
        out.write(new byte[]{0x1B, 0x28, 0x56, 0x02, 0x00});
        out.write(new byte[]{(byte) (y & 0xFF), (byte) ((y >> 8) & 0xFF)});

        // B. Set Horizontal Position to 0
        out.write(new byte[]{0x1B, 0x24});
        out.write(new byte[]{0x00, 0x00});

        // C. Raster Command (ESC . c v h m nL nH)
        // c=0 (Uncompressed), v=10, h=10 (360 DPI), m=1 (vertical density bits)
        out.write(new byte[]{0x1B, 0x2E, 0x00, 0x0A, 0x0A, 0x01});
        out.write(new byte[]{(byte) (width & 0xFF), (byte) ((width >> 8) & 0xFF)});
        
        out.write(monochromeData, y * bytesPerRow, bytesPerRow);
        return out.toByteArray();
    }

    // 4. Page End (Form Feed)
    public static byte[] generatePageFooter() throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(new byte[]{0x0C}); // FF
        return out.toByteArray();
    }

    // 5. Job End
    public static byte[] generateJobFooter() throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(new byte[]{0x1B, 0x40}); // Final Reset
        return out.toByteArray();
    }
}
