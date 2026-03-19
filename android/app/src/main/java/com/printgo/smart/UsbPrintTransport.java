package com.printgo.smart;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.util.Log;

import java.io.IOException;

/**
 * UsbPrintTransport
 *
 * Handles USB lifecycle, handshake, and bulk xfer for HP M1005.
 */
public class UsbPrintTransport {

    private static final String TAG = "UsbPrintTransport";

    private static final int REQ_CLASS_IN  = 0xA1;
    private static final int REQ_CLASS_OUT = 0x21;
    private static final int GET_DEVICE_ID  = 0x00;
    private static final int GET_PORT_STATUS= 0x01;
    private static final int SOFT_RESET     = 0x02;

    private static final int STATUS_PAPER_EMPTY = 0x20;
    private static final int STATUS_SELECTED    = 0x10;
    private static final int STATUS_NOT_ERROR   = 0x08;

    public interface TransportListener {
        void onStatus(String msg);
        void onProgress(int percent);
        void onDone();
        void onError(String msg);
    }

    public static void send(UsbManager usbManager, UsbDevice device, byte[] stream, TransportListener listener) {
        UsbDeviceConnection conn = usbManager.openDevice(device);
        if (conn == null) {
            listener.onError("Cannot open USB device.");
            return;
        }

        UsbInterface targetIface = null;
        UsbEndpoint targetEp = null;
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface iface = device.getInterface(i);
            for (int e = 0; e < iface.getEndpointCount(); e++) {
                UsbEndpoint ep = iface.getEndpoint(e);
                if (ep.getDirection() == UsbConstants.USB_DIR_OUT && ep.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK) {
                    targetIface = iface;
                    targetEp = ep;
                    break;
                }
            }
            if (targetEp != null) break;
        }

        if (targetIface == null || targetEp == null) {
            conn.close();
            listener.onError("No bulk OUT endpoint found.");
            return;
        }

        conn.claimInterface(targetIface, true);
        try {
            if (!handshake(conn, targetIface, listener)) return;
            bulkSend(conn, targetEp, stream, listener);
            listener.onDone();
        } finally {
            conn.releaseInterface(targetIface);
            conn.close();
        }
    }

    private static boolean handshake(UsbDeviceConnection conn, UsbInterface iface, TransportListener listener) {
        listener.onStatus("Connecting...");
        conn.controlTransfer(REQ_CLASS_OUT, SOFT_RESET, 0, iface.getId(), null, 0, 5000);
        try { Thread.sleep(600); } catch (Exception ignored) {}

        byte[] idBuf = new byte[1024];
        int idLen = conn.controlTransfer(REQ_CLASS_IN, GET_DEVICE_ID, 0, iface.getId(), idBuf, idBuf.length, 5000);
        if (idLen < 3) {
            listener.onError("Handshake failed (Device ID).");
            return false;
        }

        byte status = getPortStatus(conn, iface);
        if ((status & STATUS_PAPER_EMPTY) != 0) {
            listener.onError("Out of paper.");
            return false;
        }
        if ((status & STATUS_SELECTED) == 0 || (status & STATUS_NOT_ERROR) == 0) {
            listener.onError("Printer not ready.");
            return false;
        }

        listener.onStatus("Printer ready");
        return true;
    }

    private static void bulkSend(UsbDeviceConnection conn, UsbEndpoint ep, byte[] data, TransportListener listener) {
        int maxPacket = ep.getMaxPacketSize();
        int chunkSize = M1005DriverConfig.USB_CHUNK_SIZE;
        int total = data.length;
        int offset = 0;

        while (offset < total) {
            int len = Math.min(chunkSize, total - offset);
            byte[] chunk = new byte[len];
            System.arraycopy(data, offset, chunk, 0, len);

            int sent = conn.bulkTransfer(ep, chunk, len, M1005DriverConfig.USB_TIMEOUT_MS);
            if (sent < 0) {
                listener.onError("USB transfer failed.");
                return;
            }

            if (M1005DriverConfig.USB_ZLP_REQUIRED && len % maxPacket == 0) {
                conn.bulkTransfer(ep, new byte[0], 0, 1000);
            }

            offset += len;
            listener.onProgress((int)((offset / (float) total) * 100));
        }
        conn.bulkTransfer(ep, new byte[0], 0, 1000);
    }

    private static byte getPortStatus(UsbDeviceConnection conn, UsbInterface iface) {
        byte[] buf = new byte[1];
        int r = conn.controlTransfer(REQ_CLASS_IN, GET_PORT_STATUS, 0, iface.getId(), buf, 1, 5000);
        return r == 1 ? buf[0] : 0;
    }
}
