
export enum AppStep {
  CONNECT = 'CONNECT',
  UPLOAD = 'UPLOAD',
  OPTIONS = 'OPTIONS',
  PAYMENT = 'PAYMENT',
  CODE_READY = 'CODE_READY',
  PRINTING = 'PRINTING',
  SUCCESS = 'SUCCESS'
}

export enum AppMode {
  USER = 'USER',
  KIOSK = 'KIOSK'
}

export enum PrintFlow {
  DIRECT = 'DIRECT', // Linked to a specific kiosk
  CLOUD = 'CLOUD'    // Generates a release code for any kiosk
}

export enum PrintColorMode {
  BW = 'BLACK_WHITE',
  COLOR = 'COLOR'
}

export enum PaperSize {
  A4 = 'A4',
  A3 = 'A3',
  LETTER = 'Letter'
}

export interface PrintSettings {
  colorMode: PrintColorMode;
  paperSize: PaperSize;
  copies: number;
  pageRange: string;
}

export interface FileData {
  name: string;
  size: number;
  type: string;
  pages: number;
  previewUrl?: string;
}

export interface PrintJob {
  id: string;
  releaseCode?: string; 
  file: FileData;
  settings: PrintSettings;
  timestamp: number;
  amount: string;
  status: 'PENDING' | 'COMPLETED' | 'PRINTING';
  kioskId?: string;
  flow: PrintFlow;
}

export interface PrintTransaction extends PrintJob {
  status: 'COMPLETED';
}
