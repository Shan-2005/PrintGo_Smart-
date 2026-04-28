import { WebPlugin } from '@capacitor/core';
import type { PrintGoBridgePlugin } from './BridgeService';

export class PrintGoBridgeWeb extends WebPlugin implements PrintGoBridgePlugin {
  async printWithPrintHand(options: { uri: string, copies?: number, colorMode?: number, orientation?: string }): Promise<{ success: boolean, error?: string }> {
    console.warn('[PrintGoBridgeWeb] Native bridge not available. URI:', options.uri);
    return { success: false, error: 'Web fallback — native only' };
  }

  async discoverPrinters(): Promise<{ devices: any[] }> {
    console.warn('[PrintGoBridgeWeb] discoverPrinters not available on web');
    return { devices: [] };
  }

  async requestPermission(options: { vendorId: number, productId: number }): Promise<{ granted?: boolean, requested?: boolean }> {
    console.warn('[PrintGoBridgeWeb] requestPermission not available on web');
    return { granted: false };
  }

  async connect(options: { vendorId: number, productId: number }): Promise<{ success: boolean, productName?: string }> {
    console.warn('[PrintGoBridgeWeb] connect not available on web');
    return { success: false };
  }

  async prepareTestPage(): Promise<{ success: boolean }> {
    console.warn('[PrintGoBridgeWeb] prepareTestPage not available on web');
    return { success: true };
  }
}
