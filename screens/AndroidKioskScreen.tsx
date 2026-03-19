
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Printer as PrinterIcon, CornerDownLeft, FileText, CheckCircle2, AlertTriangle,
    Droplet, QrCode, Smartphone, Users, Keyboard, Power, Wifi,
    Loader2, RefreshCw, XCircle
} from 'lucide-react';
import client, { databases, storage, APPWRITE_CONFIG } from '@/src/lib/appwrite';
import { Query } from 'appwrite';
import { PrintJob } from '../types';
import QRCode from 'react-qr-code';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { App } from '@capacitor/app';
import { jsPDF } from 'jspdf';

const NativePrint = registerPlugin<any>('NativePrint');
const UsbPrint = registerPlugin<any>('UsbPrint');

/**
 * AndroidKioskScreen
 * 
 * A unified component for Android tablets (Capacitor).
 * Combines the Kiosk Terminal UI with the "Background Agent" logic.
 * This file replaces the need for a separate Node.js agent process on the hardware.
 */

// Configuration Constants
const KIOSK_ID = '102';
const AGENT_POLL_INTERVAL = 2000; // Fast polling for Android reliability
const SESSION_TIMEOUT_MS = 180000;
const PRODUCTION_URL = 'https://print-go-smart.vercel.app';

type KioskStatus = 'IDLE' | 'CONNECTED' | 'MANUAL_ENTRY' | 'ADJUST_PRINT' | 'PRINTING' | 'COMPLETE' | 'ERROR';

const AndroidKioskScreen: React.FC = () => {
    // --- State: UI ---
    const [status, setStatus] = useState<KioskStatus>('IDLE');
    const [activeJob, setActiveJob] = useState<PrintJob | null>(null);
    const [connectedUser, setConnectedUser] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [inputCode, setInputCode] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [resetCountdown, setResetCountdown] = useState(6);

    // --- State: Print Adjustments ---
    const [printScale, setPrintScale] = useState(0.90); // 0.90 for "Safety Fit"
    const [printRotation, setPrintRotation] = useState(0);
    const [printOffsetX, setPrintOffsetX] = useState(0);
    const [printOffsetY, setPrintOffsetY] = useState(0);
    const [hpMode, setHpMode] = useState<'AUTO' | 'XQX' | 'PCL' | 'PDF'>('AUTO');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [localPdfUri, setLocalPdfUri] = useState<string | null>(null);

    // --- Refs for Synchronization ---
    const lastProcessedStateKey = useRef<string | null>(null);
    const processedJobs = useRef<Set<string>>(new Set());
    const isInitialBoot = useRef(true);
    const syncTimer = useRef<NodeJS.Timeout | null>(null);
    const [isAgentProcessing, setIsAgentProcessing] = useState(false);
    const isAgentRef = useRef(false);
    useEffect(() => { isAgentRef.current = isAgentProcessing; }, [isAgentProcessing]);
    const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);
    const [usbConnected, setUsbConnected] = useState(false);
    const usbDeviceRef = useRef<any>(null);
    const [isProcessedJobsLoaded, setIsProcessedJobsLoaded] = useState(false);
    const [isIntentLaunching, setIsIntentLaunching] = useState(false);
    const isIntentLaunchingRef = useRef(false);
    useEffect(() => { isIntentLaunchingRef.current = isIntentLaunching; }, [isIntentLaunching]);

    // --- Refs for State Management (Inside Listeners) ---
    const statusRef = useRef<KioskStatus>(status);
    useEffect(() => { statusRef.current = status; }, [status]);
    const activeJobRef = useRef<PrintJob | null>(activeJob);
    useEffect(() => { activeJobRef.current = activeJob; }, [activeJob]);
    const activeSessionId = useRef<string | null>(null);

    // --- Utility: Logging (Visible on screen for debugging) ---
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const addLog = useCallback((msg: string) => {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${msg}`;
        console.log(`[Android-Kiosk] ${msg}`);
        setDebugLogs(prev => [logEntry, ...prev].slice(0, 15)); // Keep last 15 logs
    }, []);

    // --- Initialization: Immediate Splash Hide ---
    useEffect(() => {
        const hideSplash = async () => {
            try {
                // Wait a tiny bit for React to paint first frame
                await new Promise(resolve => setTimeout(resolve, 500));
                if (Capacitor.isPluginAvailable('SplashScreen')) {
                    await SplashScreen.hide();
                    addLog('Splash Screen Hidden');
                }
            } catch (e) {
                console.warn('Splash Hide Error:', e);
            }
        };
        hideSplash();
    }, [addLog]);

    // --- Initialization: Permissions & Plugins ---
    useEffect(() => {
        const initApp = async () => {
            if (Capacitor.getPlatform() !== 'android') {
                setHasPermissions(true);
                return;
            }

            try {
                addLog('Initializing Appwrite Session...');
                const { ensureSession } = await import('@/src/lib/appwrite');
                await ensureSession();
                addLog('Appwrite Session Ready');

                addLog('Requesting Permissions (Non-blocking)...');
                const requestPerms = async () => {
                    try {
                        const plugins = (window as any).Capacitor?.Plugins;
                        if (plugins?.Permissions) {
                            await plugins.Permissions.request({ name: 'bluetooth' });
                            addLog('Permissions Handled');
                        }
                    } catch (pErr) {
                        addLog(`Permission Request Error: ${pErr}`);
                    }
                };
                requestPerms();

                setHasPermissions(true);
                addLog('Plugins Initialized');
            } catch (err) {
                addLog(`Init Error: ${err}`);
                setHasPermissions(true);
            }
        };

        // --- Real-time Print Status Listener ---
        const statusListener = UsbPrint.addListener('printStatusUpdate', (data: any) => {
            const currentStatus = statusRef.current;
            addLog(`STATUS: ${data.status} (${data.progress}%)`);
            setProgress(data.progress);
            
            // Allow transitions to PRINTING only if we aren't already DONE or ERROR
            if (data.status === 'RENDERING' || data.status === 'SENDING') {
                if (currentStatus !== 'COMPLETE' && currentStatus !== 'ERROR') {
                    setStatus('PRINTING');
                }
            } else if (data.status === 'COMPLETED') {
                setStatus('COMPLETE');
                setProgress(100);
                
                // Finalize job in Appwrite
                if (activeJobRef.current && activeJobRef.current.$id) {
                    databases.updateDocument(
                        APPWRITE_CONFIG.DATABASE_ID,
                        APPWRITE_CONFIG.COLLECTION_ID,
                        activeJobRef.current.$id,
                        { status: 'COMPLETED' }
                    ).catch(e => console.error("Failed to mark job COMPLETED:", e));
                }
            } else if (data.status === 'ERROR') {
                setStatus('ERROR');
                setErrorMsg(data.error || 'PrintHand reported an error');
            }
        });

        const robotListener = UsbPrint.addListener('robotLog', (data: any) => {
            addLog(data.message);
        });

        const loadProcessedJobs = async () => {
            try {
                const result = await Filesystem.readFile({
                    path: 'processed_jobs.json',
                    directory: Directory.Data,
                    encoding: 'utf8' as any
                });
                if (result.data) {
                    const list = JSON.parse(result.data as string);
                    list.forEach((id: string) => processedJobs.current.add(id));
                    addLog(`SYNC: Loaded ${list.length} processed jobs from disk.`);
                }
                setIsProcessedJobsLoaded(true);
            } catch (e) {
                setIsProcessedJobsLoaded(true);
            }
        };
        loadProcessedJobs();

        const handleAppStateChange = (state: { isActive: boolean }) => {
            addLog(`APP STATE: ${state.isActive ? 'ACTIVE' : 'INACTIVE'}`);
            if (state.isActive) {
                // 1. Check PERSISTENT intent tracking (survives app restart/recreation)
                const pendingIntentId = localStorage.getItem('pending_print_intent_id');
                if (pendingIntentId) {
                    addLog(`RESUME: Detected persistent intent for ${pendingIntentId}`);
                    
                    // Finalize locally
                    saveJobAsProcessed(pendingIntentId);
                    localStorage.removeItem('pending_print_intent_id');
                    setIsIntentLaunching(false);
                    setStatus('COMPLETE');

                    // Finalize in CLOUD
                    addLog(`RESUME: Marking job ${pendingIntentId} as COMPLETED in cloud...`);
                    databases.updateDocument(
                        APPWRITE_CONFIG.DATABASE_ID,
                        APPWRITE_CONFIG.COLLECTION_ID,
                        pendingIntentId,
                        { status: 'COMPLETED' }
                    ).catch(e => addLog(`Resume Cloud Update Error: ${e.message}`));

                    return;
                }

                // 2. Fallback to component state tracking
                if (isIntentLaunchingRef.current && activeJobRef.current) {
                    addLog('RESUME: Returning from PrintHand, finishing job...');
                    saveJobAsProcessed(activeJobRef.current.id);
                    setIsIntentLaunching(false);
                    setStatus('COMPLETE');
                }
                else if (statusRef.current === 'PRINTING' && activeJobRef.current) {
                    if (processedJobs.current.has(activeJobRef.current.id)) {
                        addLog('RESUME: Job already handled, forcing SUCCESS screen');
                        setStatus('COMPLETE');
                    }
                }
            }
        };

        const appStateListener = App.addListener('appStateChange', handleAppStateChange);

        const timeout = setTimeout(initApp, 100);
        return () => {
            clearTimeout(timeout);
            statusListener.remove();
            robotListener.remove();
            appStateListener.then(h => h.remove());
        };
    }, [addLog]);

    // --- Core Handlers ---
    const resetKiosk = useCallback(() => {
        addLog('Resetting to IDLE state');
        setStatus('IDLE');
        setActiveJob(null);
        setConnectedUser(null);
        setProgress(0);
        setInputCode('');
        setErrorMsg(null);
        processedJobs.current.clear();
        activeSessionId.current = null; // Clear session ref v5.9.33
        addLog('Kiosk Reset to IDLE');
    }, [addLog]);

    // --- Effect: Auto-reset after completion ---
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (status === 'COMPLETE') {
            setResetCountdown(6);
            interval = setInterval(() => {
                setResetCountdown(prev => {
                    if (prev <= 1) {
                        resetKiosk();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [status, resetKiosk]);

    // --- Effect: Fail-safe transition to COMPLETE ---
    useEffect(() => {
        if (status === 'PRINTING' && activeJob && processedJobs.current.has(activeJob.id)) {
            addLog('FAIL-SAFE: Job detected as handled, entering COMPLETE state');
            setStatus('COMPLETE');
        }
    }, [status, activeJob, addLog]);

    const saveJobAsProcessed = useCallback(async (jobId: string) => {
        processedJobs.current.add(jobId);
        try {
            const list = Array.from(processedJobs.current);
            await Filesystem.writeFile({
                path: 'processed_jobs.json',
                data: JSON.stringify(list),
                directory: Directory.Data,
                encoding: 'utf8' as any
            });
        } catch (e) {}
    }, []);

    // --- THE ACTION HANDLER ---
    const ensureUsbConnection = async (skipFirmware = false) => {
        if (usbDeviceRef.current && usbConnected) return true;

        addLog('USB: Discovering printers...');
        try {
            const { devices } = await UsbPrint.discoverPrinters();
            if (!devices || devices.length === 0) {
                addLog('USB: No HP or Epson printers found.');
                return false;
            }

            const device = devices[0]; // Take primary printer
            addLog(`USB: Found ${device.productName || 'Printer'} (${device.vendorId})`);

            // Request permission
            addLog('USB: Requesting Permission...');
            await UsbPrint.requestPermission({
                vendorId: device.vendorId,
                productId: device.productId
            });

            // Connect
            addLog('USB: Connecting...');
            const result = await UsbPrint.connect({
                vendorId: device.vendorId,
                productId: device.productId,
                skipFirmware: skipFirmware
            });

            if (result.restarting) {
                addLog(`USB: ${result.message}`);
                setUsbConnected(false);
                // Wait for the hardware to re-enumerate
                await new Promise(r => setTimeout(r, 6000)); 
                return ensureUsbConnection(true); // Recursive retry with fresh discovery
            }

            usbDeviceRef.current = device;
            setUsbConnected(true);
            addLog(`USB: Ready! VID:0x${result.vendorId.toString(16)} PID:0x${result.productId.toString(16)}`);
            addLog(`USB: Interface:${result.interfaceId} Class:${result.interfaceClass}`);
            return true;
        } catch (err: any) {
            addLog(`USB Error: ${err.message || String(err)}`);
            setUsbConnected(false);
            return false;
        }
    };

    const handleDebugTestPrint = async () => {
        addLog('TEST: Preparing Test Page...');
        try {
            const result = await UsbPrint.prepareTestPage();
            addLog('TEST: Page ready. Sharing to PrintHand...');
            
            await UsbPrint.printWithPrintHand({
                uri: result.uri
            });
            
            addLog('TEST: Shared to PrintHand successfully!');
            setStatus('COMPLETE');
            setProgress(100);
        } catch (err: any) {
            addLog(`TEST ERROR: ${err.message || String(err)}`);
            setErrorMsg(err.message);
            setStatus('ERROR');
        }
    };

    const handleJobReceived = useCallback(async (doc: any) => {
        const startTime = Date.now();
        const stateKey = `${doc.$id}_${doc.status}`;
        if (stateKey === lastProcessedStateKey.current) return;
        if (processedJobs.current.has(doc.$id) && (doc.status === 'QUEUED' || doc.status === 'PENDING')) {
            addLog(`SYNC: Skipping already processed job ${doc.$id}`);
            return;
        }
        lastProcessedStateKey.current = stateKey;

        addLog(`>>> [RECV] Action: ${doc.status} | ID: ${doc.$id}`);

        const currentStatus = statusRef.current;
        const currentIsAgent = isAgentRef.current;

        // Case A: User Connected via QR
        if (doc.status === 'CONNECTED' && currentStatus === 'IDLE') {
            addLog(`HANDSHAKE: User connected. Session ID: ${doc.$id}`);
            activeSessionId.current = doc.$id;
            setConnectedUser('User');
            setStatus('CONNECTED');
        }
        // Case B: Job Ready to Print (Local Agent Takeover)
        else if (doc.status === 'QUEUED' || doc.status === 'PENDING') {
            const isSelfBusy = currentStatus !== 'IDLE' && currentStatus !== 'CONNECTED' && currentStatus !== 'MANUAL_ENTRY';
            
            if (currentIsAgent || isSelfBusy || processedJobs.current.has(doc.$id)) {
                if (processedJobs.current.has(doc.$id) && doc.status !== 'COMPLETED') {
                     // Silently ignore already handled docs
                     return;
                }
                addLog(`SYNC SKIP: System Busy (${currentStatus}) or Job ${doc.$id} already processed.`);
                return;
            }
            addLog(`TRIGGER: Native Print process starting for ${doc.$id}`);
            processJobLocally(doc);
        }
        // Case C: Job Finished (Sync UI)
        else if (doc.status === 'COMPLETED' && currentStatus === 'PRINTING') {
            addLog('SYNC: Job completed on another agent or finished locally');
            setStatus('COMPLETE');
            setProgress(100);
        }
        // Case D: Reset / Idle
        else if (doc.status === 'IDLE') {
            // Protect COMPLETE state: only reset if we aren't already finished, already idle, 
            // OR if this job hasn't been handled yet locally.
            const isHandledLocally = processedJobs.current.has(doc.$id);
            if (currentStatus !== 'IDLE' && currentStatus !== 'COMPLETE' && !isHandledLocally) {
                addLog('REMOTE: Force Reset to IDLE');
                resetKiosk();
            }
        }

        addLog(`<<< [RECV] Handled in ${Date.now() - startTime}ms`);
    }, [addLog]); // Only depends on addLog

    const processJobLocally = async (doc: any) => {
        if (isAgentRef.current || processedJobs.current.has(doc.$id)) return;
        isAgentRef.current = true;
        setIsAgentProcessing(true);
        addLog(`Native Agent: CLAIMING Job ${doc.$id} in cloud...`);

        try {
            // Immediately claim the job in Appwrite so other polls/nodes stop seeing it as QUEUED
            await databases.updateDocument(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTION_ID,
                doc.$id,
                { status: 'PRINTING' }
            );

            setStatus('PRINTING');
            setProgress(10);

            const fileData = JSON.parse(doc.fileData || '{}');
            const settings = JSON.parse(doc.settings || '{}');

            // 1. Set up job state
            const job: PrintJob = {
                id: doc.$id,
                file: fileData,
                settings: settings,
                timestamp: doc.timestamp,
                amount: doc.amount,
                status: 'PRINTING',
                releaseCode: doc.releaseCode,
                kioskId: String(doc.kioskId),
                flow: doc.flow || 'DIRECT'
            };
            setActiveJob(job);

            // 2. Download file using native Filesystem plugin (more reliable on Android)
            addLog(`Downloading ${fileData.name}...`);
            setProgress(30);

            const fileUrl = storage.getFileDownload(
                APPWRITE_CONFIG.BUCKET_ID,
                fileData.fileId
            ).toString();

            const fileName = `job_${doc.$id}.pdf`;
            const downloadResult = await Filesystem.downloadFile({
                url: fileUrl,
                path: fileName,
                directory: Directory.Cache
            });

            addLog(`Download success: ${fileName}`);
            setProgress(60);

            // Read file back as base64 for processing if it's an image
            const fileContent = await Filesystem.readFile({
                path: fileName,
                directory: Directory.Cache
            });
            let base64Only = fileContent.data as string;

            addLog('Preparing for Native Print...');
            // Robustly extract just the base64 characters if it has a prefix
            if (base64Only.includes('base64,')) {
                base64Only = base64Only.substring(base64Only.indexOf('base64,') + 7);
            }

            const isImage = fileData.type && fileData.type.startsWith('image/');
            if (isImage) {
                addLog('Converting image to PDF format...');
                const pdf = new jsPDF({
                    orientation: 'p',
                    unit: 'px',
                    format: 'a4'
                });
                
                const a4Width = pdf.internal.pageSize.getWidth();
                const a4Height = pdf.internal.pageSize.getHeight();
                
                // Construct a full data URI for jsPDF
                const dataUri = base64Only.startsWith('data:') ? base64Only : `data:${fileData.type};base64,${base64Only}`;
                pdf.addImage(dataUri, fileData.type.includes('png') ? 'PNG' : 'JPEG', 0, 0, a4Width, a4Height);
                const pdfDataUri = pdf.output('datauristring');
                base64Only = pdfDataUri.substring(pdfDataUri.indexOf('base64,') + 7);
                addLog('Image wrapped in PDF successfully!');
            } else {
                addLog(`Base64 ready, length: ${base64Only.length}`);
            }

            try {
                // Save locally first so the PrintManager InputStream can access it via URI
                const timestamp = Date.now();
                const fileName = `PrintQueue/job_${timestamp}.pdf`;

                addLog(`Saving to: Cache/${fileName}`);

                const writeResult = await Filesystem.writeFile({
                    path: fileName,
                    data: base64Only,
                    directory: Directory.Cache,
                    recursive: true
                });

                addLog('File ready. Automating PrintHand sharing...');
                setLocalPdfUri(writeResult.uri);
                
                // CRITICAL: We skip ADJUST_PRINT and go straight to PrintHand
                addLog(`Auto-Print: Starting process for ${doc.$id}...`);
                processedJobs.current.add(doc.$id);

                setTimeout(async () => {
                    try {
                        let printSettings = { copies: 1, colorMode: 0, paperSize: 'A4' };
                        try {
                            if (doc.settings) {
                                const parsed = typeof doc.settings === 'string' ? JSON.parse(doc.settings) : doc.settings;
                                printSettings.copies = parseInt(parsed.copies) || 1;
                                printSettings.colorMode = (parsed.colorMode?.toLowerCase() === 'color') ? 1 : 0;
                                printSettings.paperSize = parsed.paperSize || 'A4';
                            }
                        } catch (parseError) {
                            addLog('Settings parse error: ' + parseError.message);
                        }

                        await UsbPrint.printWithPrintHand({ 
                            uri: writeResult.uri,
                            copies: printSettings.copies,
                            colorMode: printSettings.colorMode,
                            paperSize: printSettings.paperSize
                        });
                        addLog(`PrintHand: Job sent. Settings: [Copies: ${printSettings.copies}, Color: ${printSettings.colorMode === 1 ? 'Color' : 'BW'}]`);
                    } catch (e: any) {
                        addLog(`Auto-Print Intent Error: ${e.message}`);
                        setStatus('ERROR');
                        setErrorMsg(e.message);
                    }
                }, 500);

            } catch (queueErr: any) {
                addLog(`Queue Failed: ${queueErr.message}.`);
                return;
            }

            // Waiting for user confirmation in ADJUST_PRINT screen
            addLog('Ready for Preview Adjustments');

        } catch (error: any) {
            const msg = error.message || String(error);
            addLog(`Agent Error: ${msg}`);
            setErrorMsg(msg);
            setStatus('ERROR');
            
            // DO NOT clear lastProcessedStateKey here - that would cause the loop!
            // Instead, lock the key so this job is never re-triggered.
            lastProcessedStateKey.current = `${doc.$id}_ERROR`;
            processedJobs.current.add(doc.$id);
            processedJobs.current.add(doc.$id);
            
            // Also update Appwrite so other agents/polls don't pick this up again
            try {
                await databases.updateDocument(
                    APPWRITE_CONFIG.DATABASE_ID,
                    APPWRITE_CONFIG.COLLECTION_ID,
                    doc.$id,
                    { status: 'COMPLETED' }
                );
            } catch (err: any) { 
                addLog(`Appwrite Cleanup Error: ${err.message}`);
            }
        } finally {
            isAgentRef.current = false;
            setIsAgentProcessing(false);
        }
    };

    // --- Effect: Debounced Preview Update ---
    useEffect(() => {
        if (statusRef.current !== 'ADJUST_PRINT' || !localPdfUri) return;

        const updatePreview = async () => {
            setIsPreviewLoading(true);
            try {
                const targetDevice = usbDeviceRef.current;
                const targetDpi = (targetDevice?.vendorId === 1208) ? 360 : 600;
                
                const result = await UsbPrint.getPrintPreview({
                    uri: localPdfUri,
                    pageIndex: 0,
                    dpi: targetDpi,
                    scale: printScale,
                    rotation: printRotation,
                    offsetX: printOffsetX,
                    offsetY: printOffsetY
                });
                setPreviewUrl(result.preview);
            } catch (err: any) {
                addLog(`Preview Error: ${err.message}`);
            } finally {
                setIsPreviewLoading(false);
            }
        };

        const timer = setTimeout(updatePreview, 500); 
        return () => clearTimeout(timer);
    }, [printScale, printRotation, printOffsetX, printOffsetY, localPdfUri, addLog]);

    const handleConfirmPrint = async () => {
        if (!localPdfUri || isAgentRef.current) return;
        
        isAgentRef.current = true;
        setIsAgentProcessing(true);
        setStatus('PRINTING');
        setProgress(0);

        try {
            const connected = await ensureUsbConnection();
            if (!connected) throw new Error('No printer connection.');

            addLog('USB: Starting Adjusted Job...');
            const targetDevice = usbDeviceRef.current;
            const targetDpi = (targetDevice?.vendorId === 1208 || targetDevice?.vendorId === 0x04b8) ? 360 : 600;

            const result = await UsbPrint.printPdf({
                uri: localPdfUri,
                dpi: targetDpi,
                scale: printScale,
                rotation: printRotation,
                offsetX: printOffsetX,
                offsetY: printOffsetY,
                hpMode: hpMode
            });

            addLog(`USB: Bytes Sent: ${result.bytesSent}`);
            
            if (activeJob && !activeJob.id.startsWith('test_job_')) {
                addLog(`USB: Marking Job ${activeJob.id} as COMPLETED...`);
                await databases.updateDocument(
                    APPWRITE_CONFIG.DATABASE_ID,
                    APPWRITE_CONFIG.COLLECTION_ID,
                    activeJob.id,
                    { status: 'COMPLETED' }
                );
                processedJobs.current.add(activeJob.id);
            } else if (activeJob) {
                addLog('USB: Test Job complete (Local-only).');
            }

            setProgress(100);
            setStatus('COMPLETE');
        } catch (err: any) {
            addLog(`Print Error: ${err.message}`);
            setErrorMsg(err.message);
            setStatus('ERROR');
        } finally {
            isAgentRef.current = false;
            setIsAgentProcessing(false);
        }
    };

    const handlePrintWithPrintHand = async () => {
        if (!localPdfUri || isAgentRef.current) return;
        
        isAgentRef.current = true;
        setIsAgentProcessing(true);
        addLog('PrintHand: Sharing file directly...');

        try {
            // 1. Set UI to PRINTING (Preparing) while intent is launching
            setIsIntentLaunching(true);
            setStatus('PRINTING');
            setIsAgentProcessing(true);
            
            // 2. Persistent Tracking: Save ID to localStorage (survives activity destruction)
            if (activeJob) {
                localStorage.setItem('pending_print_intent_id', activeJob.id);
            }
            
            // 3. Update Cloud status to PRINTING (without finishing the job yet)
            if (activeJob && !activeJob.id.startsWith('test_job_')) {
                databases.updateDocument(
                    APPWRITE_CONFIG.DATABASE_ID,
                    APPWRITE_CONFIG.COLLECTION_ID,
                    activeJob.id,
                    { status: 'PRINTING' }
                ).catch(e => addLog(`Cloud Update Error: ${e.message}`));
            }

            // 4. Finally, send the intent
            await UsbPrint.printWithPrintHand({
                uri: localPdfUri,
                copies: activeJob?.settings?.copies || 1,
                colorMode: activeJob?.settings?.colorMode === 'Color' ? 1 : 0,
                paperSize: activeJob?.settings?.paperSize || 'A4'
            });

            addLog('PrintHand: Intent Sent Success');

            setProgress(100);
            setStatus('COMPLETE');
        } catch (err: any) {
            addLog(`PrintHand Error: ${err.message}`);
            setErrorMsg(err.message);
            setStatus('ERROR');
        } finally {
            isAgentRef.current = false;
            setIsAgentProcessing(false);
        }
    };

    // --- Appwrite Synchronization Effect ---
    useEffect(() => {
        if (!isProcessedJobsLoaded) return;
        
        const dbId = APPWRITE_CONFIG.DATABASE_ID;
        const collId = APPWRITE_CONFIG.COLLECTION_ID;

        const performSync = async () => {
            try {
                const response = await databases.listDocuments(
                    dbId,
                    collId,
                    [
                        Query.equal('kioskId', KIOSK_ID),
                        Query.orderDesc('$createdAt'),
                        Query.limit(1)
                    ]
                );

                if (response.documents.length > 0) {
                    const latestDoc = response.documents[0];

                    if (isInitialBoot.current) {
                        lastProcessedStateKey.current = `${latestDoc.$id}_${latestDoc.status}`;
                        isInitialBoot.current = false;
                        addLog(`Baseline set: ${lastProcessedStateKey.current}`);
                        return;
                    }

                    const stateKey = `${latestDoc.$id}_${latestDoc.status}`;
                    if (stateKey !== lastProcessedStateKey.current) {
                        handleJobReceived(latestDoc);
                    }
                } else {
                    isInitialBoot.current = false;
                }
            } catch (err: any) {
                addLog(`Sync Warning: ${err.message}`);
            }
        };

        // 1. Real-time Subscription
        let unsubscribe: (() => void) | null = null;
        const startSubscription = async () => {
            try {
                const { ensureSession } = await import('@/src/lib/appwrite');
                await ensureSession();
                unsubscribe = client.subscribe(
                    [`databases.${dbId}.collections.${collId}.documents`],
                    (response) => {
                        const payload = response.payload as any;
                        const isDelete = response.events.some(e => e.includes('.delete'));
                        
                        addLog(`REALTIME: ${isDelete ? 'DELETE' : 'UPDATE'} for Doc ${payload.$id} Status ${payload.status}`);
                        
                        if (isDelete) {
                            // If the deleted document was for this Kiosk, reset.
                            if (String(payload.kioskId) === KIOSK_ID || activeSessionId.current === payload.$id) {
                                addLog(`REALTIME: Active session/kiosk document deleted. Resetting...`);
                                resetKiosk();
                            }
                            return;
                        }

                        if (String(payload.kioskId) === KIOSK_ID) {
                            handleJobReceived(payload);
                        }
                    }
                );
                addLog("REALTIME: Subscription active");
            } catch (err: any) {
                addLog(`REALTIME ERROR: ${err.message}`);
            }
        };

        startSubscription();

        // 2. Polling Fallback
        const pollInterval = setInterval(performSync, AGENT_POLL_INTERVAL);
        performSync(); // Initial check

        return () => {
            if (unsubscribe) unsubscribe();
            clearInterval(pollInterval);
        };
    }, [handleJobReceived, addLog, isProcessedJobsLoaded]);

    // --- UI Lifecycle Effects (Timeouts) ---
    useEffect(() => {
        if (status === 'CONNECTED') {
            const timer = setTimeout(() => {
                addLog('Session Timeout');
                resetKiosk();
            }, SESSION_TIMEOUT_MS);
            return () => clearTimeout(timer);
        }

        if (status === 'COMPLETE') {
            const timer = setTimeout(resetKiosk, 5000);
            return () => clearTimeout(timer);
        }
    }, [status, resetKiosk, addLog]);

    // --- Manual Release Handler ---
    const handleManualEntry = async () => {
        if (inputCode.length !== 5) return;
        addLog(`Verifying Code: ${inputCode}...`);

        try {
            const dbId = APPWRITE_CONFIG.DATABASE_ID;
            const collId = APPWRITE_CONFIG.COLLECTION_ID;

            const response = await databases.listDocuments(dbId, collId, [
                Query.equal('releaseCode', inputCode),
                Query.limit(1)
            ]);

            if (response.documents.length > 0) {
                const doc = response.documents[0];
                addLog(`Match found! Taking over for local print.`);

                // Mark as QUEUED and assigned to THIS Android Kiosk
                await databases.updateDocument(dbId, collId, doc.$id, {
                    status: 'QUEUED',
                    kioskId: KIOSK_ID
                });

                // The background loop checkCloudStatus will pick this up in < 1sec
            } else {
                setStatus('ERROR');
                setTimeout(() => { setStatus('MANUAL_ENTRY'); setInputCode(''); }, 2000);
            }
        } catch (e: any) {
            setStatus('ERROR');
            setTimeout(() => setStatus('MANUAL_ENTRY'), 2000);
        }
    };

    // --- Render (Shared with KioskScreen.tsx but streamlined) ---
    // --- Render ---
    return (
        <div className="h-screen w-screen bg-[#000d1a] flex flex-col relative overflow-hidden font-google-sans text-white">
            {/* Visual Header */}
            <main className="flex-1 flex flex-col items-center justify-center p-8 relative z-10">
                {/* IDLE STATE */}
                {status === 'IDLE' && (
                    <div key="idle-content" className="flex flex-col items-center gap-12">
                        <h1 className="text-7xl font-bold tracking-tighter text-center">
                            Ready to <br /><span className="text-blue-400">Print.</span>
                        </h1>
                        <p className="text-xl text-white/40">Scan the QR code or enter a release code</p>
                        <div className="flex gap-6 items-center">
                            <button
                                onClick={() => setStatus('MANUAL_ENTRY')}
                                className="px-10 py-6 bg-white/5 border border-white/10 rounded-full text-xl font-bold flex items-center gap-4 hover:bg-white/10 transition-all active:scale-95"
                            >
                                <Keyboard size={24} /> Enter Code
                            </button>
                            <div className="bg-white p-6 rounded-[40px] shadow-2xl">
                                <QRCode value={`${PRODUCTION_URL}/app?connect=${KIOSK_ID}`} size={160} />
                            </div>
                        </div>
                    </div>
                )}

                {/* CONNECTED STATE */}
                {status === 'CONNECTED' && (
                    <div key="connected-content" className="flex flex-col items-center gap-16 text-center">
                        <div className="relative">
                            <div className="w-64 h-64 bg-blue-500/10 border border-blue-500/30 rounded-[80px] flex items-center justify-center text-blue-300 shadow-[0_0_60px_rgba(59,130,246,0.2)]">
                                <Users size={120} strokeWidth={0.5} />
                            </div>
                            <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-green-500 rounded-full border-[10px] border-[#000d1a] flex items-center justify-center shadow-2xl">
                                <CheckCircle2 size={40} className="text-white" />
                            </div>
                        </div>
                        <div className="space-y-6">
                            <h2 className="text-8xl font-bold tracking-tighter">
                                Welcome, <br /><span className="text-blue-300">User!</span>
                            </h2>
                            <p className="text-2xl text-white/30 font-medium">Session Active. Continue on your mobile device.</p>
                        </div>
                        <button
                            onClick={resetKiosk}
                            className="mt-8 px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white/40 text-xs font-black uppercase tracking-widest hover:bg-red-500/10 transition-all"
                        >
                            End Session
                        </button>
                    </div>
                )}

                {/* ADJUST PRINT STATE */}
                {status === 'ADJUST_PRINT' && (
                    <div key="adjust-content" className="w-full max-w-5xl flex gap-12 items-start">
                        {/* Left: Preview */}
                        <div className="flex-1 space-y-4">
                            <div className="bg-white/5 border border-white/10 rounded-[40px] aspect-[1/1.4] overflow-hidden relative flex items-center justify-center shadow-2xl">
                                {isPreviewLoading && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10 backdrop-blur-sm">
                                        <Loader2 className="animate-spin text-blue-400" size={60} />
                                    </div>
                                )}
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Print Preview" className="w-full h-full object-contain" />
                                ) : (
                                    <div className="text-white/20 text-center">
                                        <FileText size={100} strokeWidth={0.5} className="mx-auto mb-4" />
                                        <p>Generating Preview...</p>
                                    </div>
                                )}
                            </div>
                            <p className="text-center text-white/30 text-xs font-black uppercase tracking-widest">Monochrome Driver Preview (1:1)</p>
                        </div>

                        {/* Right: Controls */}
                        <div className="w-[340px] space-y-3 bg-white/5 p-5 rounded-[24px] border border-white/10 self-center h-full max-h-[90vh] overflow-y-auto">
                            <h2 className="text-2xl font-bold tracking-tighter">Adjust <span className="text-blue-400">Layout</span></h2>
                            
                            <div className="space-y-3">
                                {/* Scale */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/40">
                                        <span>Scale</span>
                                        <div className="flex gap-4 items-center">
                                            <button 
                                                onClick={() => { setPrintScale(0.90); setPrintOffsetX(0); setPrintOffsetY(0); setPrintRotation(0); }}
                                                className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30 hover:bg-blue-500/40 transition-all"
                                            >
                                                Fit
                                            </button>
                                            <span className="text-blue-400">{Math.round(printScale * 100)}%</span>
                                        </div>
                                    </div>
                                    <input 
                                        type="range" min="0.5" max="1.5" step="0.01" 
                                        value={printScale} 
                                        onChange={(e) => setPrintScale(parseFloat(e.target.value))}
                                        className="w-full accent-blue-500"
                                    />
                                </div>

                                {/* Rotation */}
                                <div className="space-y-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Rotation</span>
                                    <div className="flex gap-1">
                                        {[0, 90, 180, 270].map(deg => (
                                            <button 
                                                key={deg}
                                                onClick={() => setPrintRotation(deg)}
                                                className={`flex-1 py-2 text-[11px] rounded-lg font-bold transition-all ${printRotation === deg ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/40'}`}
                                            >
                                                {deg}°
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Offsets */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40 text-center block">X-Offset</span>
                                        <div className="flex gap-1">
                                            <button onClick={() => setPrintOffsetX(p => p - 10)} className="flex-1 bg-white/5 py-2 text-xs rounded-lg hover:bg-white/10">-</button>
                                            <button onClick={() => setPrintOffsetX(p => p + 10)} className="flex-1 bg-white/5 py-2 text-xs rounded-lg hover:bg-white/10">+</button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40 text-center block">Y-Offset</span>
                                        <div className="flex gap-1">
                                            <button onClick={() => setPrintOffsetY(p => p - 10)} className="flex-1 bg-white/5 py-2 text-xs rounded-lg hover:bg-white/10">-</button>
                                            <button onClick={() => setPrintOffsetY(p => p + 10)} className="flex-1 bg-white/5 py-2 text-xs rounded-lg hover:bg-white/10">+</button>
                                        </div>
                                    </div>
                                </div>

                                {/* HP Mode Selector */}
                                {usbDeviceRef.current?.vendorId === 1008 && (
                                    <div className="space-y-2 border-t border-white/10 pt-4">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 block">HP Protocol (Troubleshoot)</span>
                                        <div className="grid grid-cols-4 gap-1">
                                            {(['AUTO', 'XQX', 'PCL', 'PDF'] as const).map(m => (
                                                <button 
                                                    key={m}
                                                    onClick={() => setHpMode(m)}
                                                    className={`py-1.5 rounded-lg text-[9px] font-bold transition-all ${hpMode === m ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/40 border border-white/5'}`}
                                                >
                                                    {m}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-[8px] text-white/30 italic">Try "PDF" or "PCL" if printer is silent.</p>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2 space-y-2">
                                <button 
                                    onClick={handlePrintWithPrintHand}
                                    className="w-full py-5 bg-blue-600 rounded-xl text-lg font-black shadow-[0_10px_20px_-5px_rgba(37,99,235,0.4)] active:scale-95 transition-all border-2 border-blue-400"
                                >
                                    Print Now (PrintHand)
                                </button>
                                
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleConfirmPrint}
                                        className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold text-white/40 hover:bg-white/10 transition-all uppercase tracking-widest"
                                    >
                                        Direct Driver (Beta)
                                    </button>
                                    <button 
                                        onClick={resetKiosk}
                                        className="flex-1 py-3 bg-white/5 text-white/40 text-[10px] font-bold rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all uppercase tracking-widest"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* PRINTING STATE */}
                {status === 'PRINTING' && (
                    <div key="printing-content" className="w-full max-w-2xl space-y-12 text-center">
                        <div className="flex justify-center">
                            <div className="p-10 bg-blue-500/10 rounded-full border border-blue-500/20 text-blue-400">
                                <PrinterIcon size={120} className="animate-bounce" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-6xl font-black text-white tracking-tighter uppercase">Preparing Document</h2>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-blue-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                    />
                                </div>
                                <span className="text-blue-400 font-mono font-bold text-2xl animate-pulse">
                                    {progress}% Processing...
                                </span>
                            </div>
                        </div>
                        <p className="text-white/30 tracking-widest uppercase text-xs font-black">Connecting to Terminal Hardware</p>
                        <div className="pt-4 flex justify-center">
                            <button
                                onClick={resetKiosk}
                                className="px-10 py-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full font-bold hover:bg-red-500/20 transition-all active:scale-95"
                            >
                                Force Reset / Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* MANUAL ENTRY STATE */}
                {status === 'MANUAL_ENTRY' && (
                    <div key="manual-content" className="w-full max-w-sm bg-white/5 p-8 rounded-[40px] border border-white/10">
                        <div className="flex justify-center gap-2 mb-8">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="w-12 h-16 bg-black/40 border-2 border-white/10 rounded-xl flex items-center justify-center text-3xl font-bold text-blue-300">
                                    {inputCode[i] || ''}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => (
                                <button key={n} onClick={() => inputCode.length < 5 && setInputCode(p => p + n)} className="h-14 bg-white/5 rounded-xl text-xl font-bold text-white active:scale-95 hover:bg-white/10 transition-all">{n}</button>
                            ))}
                            <button onClick={resetKiosk} className="h-14 bg-red-500/10 rounded-xl text-red-400 font-bold active:scale-95">CLR</button>
                            <button onClick={handleManualEntry} className="h-14 bg-blue-600 rounded-xl text-white font-bold active:scale-95 disabled:opacity-50 disabled:active:scale-100" disabled={inputCode.length < 5}>OK</button>
                        </div>
                    </div>
                )}

                {/* COMPLETE STATE */}
                {status === 'COMPLETE' && (
                    <div key="complete-content" className="flex flex-col items-center gap-8 text-center px-12">
                        <div className="w-56 h-56 bg-green-500/10 rounded-full flex items-center justify-center border-4 border-green-500/20 text-green-400 shadow-[0_0_80px_rgba(34,197,94,0.3)]">
                            <CheckCircle2 size={120} />
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-7xl font-black text-white tracking-tighter uppercase italic text-center">Printing Successful</h2>
                            <p className="text-4xl text-white/70 font-bold text-center">Your documents are ready at the tray.</p>
                        </div>
                        <button
                            onClick={resetKiosk}
                            className="mt-4 px-12 py-6 bg-white/10 border-2 border-white/20 rounded-full text-xl font-bold hover:bg-white/20 transition-all active:scale-95 text-white"
                        >
                            Back to Home ({resetCountdown}s)
                        </button>
                    </div>
                )}

                {/* ERROR STATE */}
                {status === 'ERROR' && (
                    <div key="error-content" className="flex flex-col items-center gap-8 text-center">
                        <div className="w-40 h-40 bg-red-500/10 rounded-full flex items-center justify-center border-2 border-red-500/20 text-red-400">
                            <AlertTriangle size={80} />
                        </div>
                        <h2 className="text-6xl font-bold text-white">Error</h2>
                        <p className="text-xl text-white/30 truncate max-w-lg">{errorMsg || 'Something went wrong. Try again.'}</p>
                        <button onClick={resetKiosk} className="mt-4 px-10 py-4 bg-white/5 border border-white/10 rounded-full font-bold">Restart</button>
                    </div>
                )}
            </main>

            {/* --- DEBUG OVERLAY (Repositioned to bottom small strip) --- */}
            <div className="bg-black/80 border-t border-white/10 p-2 z-50">
                <div className="flex items-center gap-3 px-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
                    <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${status === 'IDLE' ? 'bg-green-500' : 'bg-blue-500'}`} />
                        <span className="text-[9px] font-mono text-white/60 uppercase">{status} | v5.9.26</span>
                    </div>
                    <span className="text-[9px] font-mono text-white/30">|</span>
                    {debugLogs.slice(0, 3).map((log, i) => (
                        <span key={i} className="text-[9px] font-mono text-green-400/50">{log.substring(log.indexOf(']') + 1)}</span>
                    ))}
                    <span className="text-[9px] font-mono text-white/30 ml-auto uppercase tracking-tighter">
                        Kiosk {KIOSK_ID} • {debugLogs.length} L
                    </span>
                </div>
            </div>
        </div>
    );
};

export default AndroidKioskScreen;
