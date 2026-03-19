package com.printgo.smart;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

public class HpDriver {

    // 1. Job Start (PJL Header)
    public static byte[] generateJobHeader() throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write("\u001B%-12345X@PJL JOB NAME=\"PrintGo\"\r\n".getBytes());
        out.write("@PJL ENTER LANGUAGE=PCL\r\n".getBytes());
        out.write("\u001BE".getBytes()); // PCL Reset
        return out.toByteArray();
    }

    // 2. Page Start (Resolution + Setup)
    public static byte[] generatePageHeader(int width, int height, int dpi) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write("\u001B&l26A".getBytes()); // A4
        out.write("\u001B&l0O".getBytes());  // Portrait
        out.write(("\u001B*t" + dpi + "R").getBytes()); // Resolution
        out.write("\u001B*r1A".getBytes()); // Start Raster Graphics
        return out.toByteArray();
    }

    // 3. Raster Packet
    public static byte[] generateRasterPacket(byte[] monochromeData, int y, int width, int bytesPerRow) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        // Transfer Raster Data: \x1B*b[length]W
        out.write(("\u001B*b" + bytesPerRow + "W").getBytes());
        out.write(monochromeData, y * bytesPerRow, bytesPerRow);
        return out.toByteArray();
    }

    // 4. Page End (FF + Reset)
    public static byte[] generatePageFooter() throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write("\u001B*rC".getBytes()); // End Raster Graphics
        out.write("\u000C".getBytes());    // Form Feed
        return out.toByteArray();
    }

    // 5. Job End (PJL EOJ)
    public static byte[] generateJobFooter() throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write("\u001BE".getBytes()); // PCL Reset
        out.write("\u001B%-12345X@PJL EOJ\r\n".getBytes());
        out.write("\u001B%-12345X".getBytes());
        return out.toByteArray();
    }

    // 6. Direct PDF Job (for PCLm/PCLmS models like M127fn)
    public static byte[] generatePdfJob(byte[] pdfData) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        // PJL Header
        out.write("\u001B%-12345X@PJL JOB NAME=\"PrintGo\"\r\n".getBytes());
        out.write("@PJL ENTER LANGUAGE=PDF\r\n".getBytes()); // Some models use PCLMS
        
        // Raw PDF data
        out.write(pdfData);
        
        // PJL Footer
        out.write("\r\n\u001B%-12345X@PJL EOJ\r\n".getBytes());
        out.write("\u001B%-12345X".getBytes());
        return out.toByteArray();
    }
}
