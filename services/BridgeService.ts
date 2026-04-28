import { registerPlugin } from '@capacitor/core';

export interface PrintGoBridgePlugin {
  printWithPrintHand(options: { uri: string, copies?: number, colorMode?: number, orientation?: string }): Promise<{ success: boolean, error?: string }>;
  discoverPrinters(): Promise<{ devices: any[] }>;
  requestPermission(options: { vendorId: number, productId: number }): Promise<{ granted?: boolean, requested?: boolean }>;
  connect(options: { vendorId: number, productId: number, skipFirmware?: boolean }): Promise<{ 
    success: boolean, 
    productName?: string, 
    restarting?: boolean, 
    message?: string,
    vendorId?: number,
    productId?: number,
    interfaceId?: number,
    interfaceClass?: number
  }>;
  prepareTestPage(): Promise<{ success: boolean, uri: string }>;
  exitKiosk(): Promise<void>;
  addListener(eventName: string, listenerFunc: (data: any) => void): Promise<any>;
}

export const PrintGoBridge = registerPlugin<PrintGoBridgePlugin>(
  'PrintGoBridge',
  {
    web: () => import('./PrintGoBridgeWeb').then(m => new m.PrintGoBridgeWeb()),
  }
);
