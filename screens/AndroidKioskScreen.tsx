
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Printer as PrinterIcon, CornerDownLeft, FileText, CheckCircle2, AlertTriangle,
    Droplet, QrCode, Smartphone, Users, Keyboard, Power, Wifi,
    Loader2, RefreshCw, XCircle
} from 'lucide-react';
import client, { databases, storage, APPWRITE_CONFIG, ensureSession } from '@/src/lib/appwrite';
import { Query, ID, Permission, Role } from 'appwrite';
import { PrintJob } from '../types';
import QRCode from 'react-qr-code';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import { PrintGoBridge as NativePrint } from '../services/BridgeService';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { App } from '@capacitor/app';
import { jsPDF } from 'jspdf';

// UsbPrint is consolidated into NativePrint

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

type KioskStatus = 'IDLE' | 'CONNECTED' | 'MANUAL_ENTRY' | 'PRINTING' | 'COMPLETE' | 'ERROR';

const AndroidKioskScreen: React.FC = () => {
    // --- State: UI ---
    const [status, setStatus] = useState<KioskStatus>('IDLE');
    const [activeJob, setActiveJob] = useState<PrintJob | null>(null);
    const [connectedUser, setConnectedUser] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [inputCode, setInputCode] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [resetCountdown, setResetCountdown] = useState(6);

    // --- State: Local file URI for printing ---
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

    // --- Hidden Exit Trigger ---
    const exitTapsRef = useRef(0);
    const exitTapsTimerRef = useRef<NodeJS.Timeout | null>(null);
    const handleExitTap = useCallback(() => {
        exitTapsRef.current += 1;
        if (exitTapsTimerRef.current) clearTimeout(exitTapsTimerRef.current);
        
        if (exitTapsRef.current >= 5) {
            addLog('SECRET: Exit trigger activated!');
            NativePrint.exitKiosk().catch(err => addLog(`Exit Error: ${err.message}`));
        } else {
            exitTapsTimerRef.current = setTimeout(() => {
                exitTapsRef.current = 0;
            }, 2000);
        }
    }, [addLog]);

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
                addLog('Kiosk System Initialized');
            } catch (err) {
                addLog(`Init Error: ${err}`);
                setHasPermissions(true);
            }
        };

        // --- Real-time Print Status Listener ---
        const statusListener = NativePrint.addListener('printStatusUpdate', (data: any) => {
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

        const robotListener = NativePrint.addListener('robotLog', (data: any) => {
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
            statusListener.then(h => h.remove());
            robotListener.then(h => h.remove());
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
        
        // --- CRITICAL: Do NOT clear processedJobs.current here ---
        // This set prevents the sync loop from re-triggering the same job 
        // before the cloud update is fully propagated. It is cleared only on mount.
        
        setIsAgentProcessing(false);
        setIsIntentLaunching(false);
        isAgentRef.current = false;
        isIntentLaunchingRef.current = false;
        
        activeSessionId.current = null;
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
            const { devices } = await NativePrint.discoverPrinters();
            if (!devices || devices.length === 0) {
                addLog('USB: No HP or Epson printers found.');
                return false;
            }

            const device = devices[0]; // Take primary printer
            addLog(`USB: Found ${device.productName || 'Printer'} (${device.vendorId})`);

            // Request permission
            addLog('USB: Requesting Permission...');
            await NativePrint.requestPermission({
                vendorId: device.vendorId,
                productId: device.productId
            });

            // Connect
            addLog('USB: Connecting...');
            const result = await NativePrint.connect({
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
            const result = await NativePrint.prepareTestPage();
            addLog('TEST: Page ready. Sharing to PrintHand...');
            
            await NativePrint.printWithPrintHand({
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

            // 2. Download and prepare file
            addLog(`Downloading ${fileData.name}...`);
            setProgress(30);

            const timestamp = Date.now();
            const targetPath = `PrintQueue/job_${doc.$id}_${timestamp}.pdf`;
            const fileUrl = storage.getFileDownload(APPWRITE_CONFIG.BUCKET_ID, fileData.fileId).toString();
            
            let fileUri: string = '';
            let orientation = 'Auto';
            const isImage = fileData.type && fileData.type.startsWith('image/');
            
            if (isImage) {
                // For images, we must wrap them in a PDF
                const response = await fetch(fileUrl);
                const blob = await response.blob();
                
                const { base64Data, width, height } = await new Promise<{base64Data: string, width: number, height: number}>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64 = reader.result as string;
                        const dataUrl = base64;
                        const img = new Image();
                        img.onload = () => {
                            resolve({
                                base64Data: base64.split(',')[1],
                                width: img.width,
                                height: img.height
                            });
                        };
                        img.onerror = reject;
                        img.src = dataUrl;
                    };
                    reader.readAsDataURL(blob);
                });

                const isLandscape = width > height;
                orientation = isLandscape ? 'Landscape' : 'Portrait';
                
                const pdf = new jsPDF({ 
                    orientation: isLandscape ? 'landscape' : 'portrait', 
                    unit: 'mm', 
                    format: 'a4' 
                });
                
                const a4Width = pdf.internal.pageSize.getWidth();
                const a4Height = pdf.internal.pageSize.getHeight();
                
                // Maintain aspect ratio while fitting to A4
                let drawWidth = a4Width;
                let drawHeight = (height * a4Width) / width;
                
                if (drawHeight > a4Height) {
                    drawHeight = a4Height;
                    drawWidth = (width * a4Height) / height;
                }

                // Center the image
                const xOffset = (a4Width - drawWidth) / 2;
                const yOffset = (a4Height - drawHeight) / 2;

                pdf.addImage(
                    `data:${fileData.type};base64,${base64Data}`, 
                    fileData.type.includes('png') ? 'PNG' : 'JPEG', 
                    xOffset, yOffset, drawWidth, drawHeight
                );
                const pdfBase64 = pdf.output('datauristring').split(',')[1];
                
                const writeResult = await Filesystem.writeFile({
                    path: targetPath,
                    data: pdfBase64,
                    directory: Directory.Cache,
                    recursive: true
                });
                fileUri = writeResult.uri;
                addLog(`Image wrapped in PDF (${orientation})`);
            } else {
                // For PDFs, download directly to the target path
                await Filesystem.downloadFile({
                    url: fileUrl,
                    path: targetPath,
                    directory: Directory.Cache,
                    recursive: true
                });
                const uriResult = await Filesystem.getUri({
                    path: targetPath,
                    directory: Directory.Cache
                });
                fileUri = uriResult.uri;
                addLog('PDF downloaded directly');
                orientation = 'Auto'; // Trust PrintHand for PDF orientation
            }

            setLocalPdfUri(fileUri);
            setProgress(80);

            // --- VALIDATION: Ensure file is not empty/malformed before PrintHand ---
            try {
                const stats = await Filesystem.stat({
                    path: targetPath,
                    directory: Directory.Cache
                });
                addLog(`Validation: File size = ${stats.size} bytes`);
                if (stats.size < 100) { // Extremely small PDF is likely malformed or empty
                    throw new Error(`Downloaded file is too small (${stats.size} bytes). Likely corrupted.`);
                }
            } catch (statErr: any) {
                throw new Error(`File Validation Failed: ${statErr.message}`);
            }

            // --- AUTO-PRINT: Send directly to PrintHand (no preview screen) ---
            addLog(`Auto-Print: Sending to PrintHand...`);
            setStatus('PRINTING');
            setIsIntentLaunching(true);

            // Persist intent ID for crash recovery
            localStorage.setItem('pending_print_intent_id', doc.$id);
            saveJobAsProcessed(doc.$id);

            await NativePrint.printWithPrintHand({ 
                uri: fileUri,
                colorMode: settings.color === 'Color' ? 1 : 0,
                copies: settings.copies || 1,
                orientation: orientation
            });

            addLog('Auto-Print: Intent sent to PrintHand via NativePrint!');
            setProgress(100);
            setStatus('COMPLETE');

            // Mark job as COMPLETED in Appwrite
            try {
                await databases.updateDocument(
                    APPWRITE_CONFIG.DATABASE_ID,
                    APPWRITE_CONFIG.COLLECTION_ID,
                    doc.$id,
                    { status: 'COMPLETED' }
                );
            } catch (err: any) {
                addLog(`Cloud finalize warning: ${err.message}`);
            }

        } catch (error: any) {
            const msg = error.message || String(error);
            addLog(`Agent Error: ${msg}`);
            setErrorMsg(msg);
            setStatus('ERROR');
            
            // Lock this job so it's not re-triggered
            lastProcessedStateKey.current = `${doc.$id}_ERROR`;
            processedJobs.current.add(doc.$id);
            
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
            setIsIntentLaunching(false);
        }
    };



    // --- Appwrite Synchronization Effect ---
    useEffect(() => {
        if (!isProcessedJobsLoaded) return;
        
        const dbId = APPWRITE_CONFIG.DATABASE_ID;
        const collId = APPWRITE_CONFIG.COLLECTION_ID;

        const performSync = async () => {
            try {
                // Fail-safe: If we have an active handshake ID, check for its existence specifically (v5.9.38)
                if (activeSessionId.current && statusRef.current !== 'IDLE' && statusRef.current !== 'MANUAL_ENTRY') {
                    try {
                        await databases.getDocument(dbId, collId, activeSessionId.current);
                    } catch (e: any) {
                        if (e.code === 404) {
                            addLog(`SYNC: Active session/handshake ${activeSessionId.current} deleted. Resetting...`);
                            resetKiosk();
                            return;
                        }
                    }
                }

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
                    // Fail-safe fallback if no records at all exist for this kiosk
                    if (statusRef.current !== 'IDLE' && statusRef.current !== 'MANUAL_ENTRY' && statusRef.current !== 'ERROR') {
                        addLog("SYNC: Zero records found for Kiosk. Resetting.");
                        resetKiosk();
                    }
                }
            } catch (err: any) {
                addLog(`Sync Warning: ${err.message}`);
            }
        };

        // 1. Real-time Subscription
        let unsubscribe: (() => void) | null = null;
        const startSubscription = async () => {
            try {
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

    // --- Render Helpers ---
    const renderHeader = () => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.6rem 1.25rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                    <span style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.8)' }}>System Live</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.6rem 1.25rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Wifi size={14} color="#d3e4ff" />
                    <span 
                        onClick={handleExitTap}
                        style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.8)', cursor: 'pointer' }}
                    >
                        Kiosk-{KIOSK_ID}
                    </span>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
                {['C', 'M', 'Y', 'K'].map((ink, idx) => (
                    <div key={ink} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                        <div style={{ height: '3.5rem', width: '0.8rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '1rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: idx === 3 ? '25%' : '85%' }}
                                style={{
                                    position: 'absolute', bottom: 0, width: '100%', borderRadius: '1rem',
                                    backgroundColor: idx === 0 ? '#22d3ee' : idx === 1 ? '#2dd4bf' : idx === 2 ? '#818cf8' : '#ffffff'
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    // --- Render (Shared with KioskScreen.tsx but streamlined) ---
    // --- Render ---
    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: '#000d1a',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            color: 'white',
            fontFamily: 'sans-serif'
        }}>
            {/* Visual Header */}
            {renderHeader()}
            <main style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                position: 'relative',
                zIndex: 10,
                width: '100%',
                height: '100%'
            }}>
                {/* --- IDLE STATE --- */}
                {status === 'IDLE' && (
                    <motion.div
                        key="idle"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            width: '100%',
                            gap: '3rem',
                            padding: '1rem'
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                style={{
                                    display: 'inline-flex', padding: '0.4rem 1rem',
                                    background: 'rgba(59, 130, 246, 0.1)', color: '#93c5fd',
                                    borderRadius: '9999px', fontSize: '10px', fontWeight: 'bold',
                                    letterSpacing: '0.25em', border: '1px solid rgba(59, 130, 246, 0.2)',
                                    textTransform: 'uppercase'
                                }}
                            >
                                Premium Printing Terminal
                            </motion.div>
                            
                            <h1 style={{
                                fontSize: 'min(12vw, 5rem)', fontWeight: 'bold',
                                letterSpacing: '-0.05em', lineHeight: '0.9',
                                color: 'white'
                            }}>
                                Print <br /><span style={{ color: '#60a5fa' }}>Better.</span>
                            </h1>
                            
                            <p style={{
                                fontSize: '1.1rem', color: 'rgba(255,255,255,0.4)',
                                maxWidth: '20rem', lineHeight: '1.4'
                            }}>
                                Scan code to link device <br /> or use a release code.
                            </p>
                        </div>

                        <div style={{ position: 'relative', width: '100%', maxWidth: '22rem' }}>
                            <div style={{
                                position: 'absolute', inset: '-1rem',
                                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
                                borderRadius: '3rem', blur: '40px'
                            }} />
                            <div style={{
                                position: 'relative', background: 'white',
                                padding: '2.5rem', borderRadius: '4rem',
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', gap: '2rem',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                            }}>
                                <div style={{
                                    padding: '1.5rem', background: '#f8fafc',
                                    borderRadius: '2rem', border: '2px solid #e2e8f0',
                                    width: '100%', aspectRatio: '1/1',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <QRCode
                                        value={`${PRODUCTION_URL}/app?connect=${KIOSK_ID}`}
                                        size={220}
                                        level="H"
                                        style={{ width: '100%', height: 'auto' }}
                                    />
                                </div>
                                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#001c38' }}>Terminal {KIOSK_ID}</div>
                                    <button
                                        onClick={() => setStatus('MANUAL_ENTRY')}
                                        style={{
                                            padding: '0.8rem 2rem', background: '#2563eb',
                                            color: 'white', borderRadius: '9999px',
                                            fontSize: '11px', fontWeight: '900',
                                            letterSpacing: '0.15em', textTransform: 'uppercase',
                                            boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.4)',
                                            border: 'none', transition: 'transform 0.2s'
                                        }}
                                    >
                                        Enter Code Instead
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* CONNECTED STATE */}
                {status === 'CONNECTED' && (
                    <div key="connected-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4rem', textAlign: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <div style={{ width: '16rem', height: '16rem', backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#93c5fd', boxShadow: '0 0 60px rgba(59,130,246,0.2)' }}>
                                <Users size={120} strokeWidth={0.5} />
                            </div>
                            <div style={{ position: 'absolute', bottom: '-1rem', right: '-1rem', width: '5rem', height: '5rem', backgroundColor: '#22c55e', borderRadius: '50%', border: '10px solid #000d1a', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                                <CheckCircle2 size={40} style={{ color: 'white' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <h2 style={{ fontSize: '6rem', fontWeight: 'bold', letterSpacing: '-0.05em' }}>
                                Welcome, <br /><span style={{ color: '#93c5fd' }}>User!</span>
                            </h2>
                            <p style={{ fontSize: '1.5rem', color: 'rgba(255,255,255,0.3)', fontWeight: '500' }}>Session Active. Continue on your mobile device.</p>
                        </div>
                        <button
                            onClick={resetKiosk}
                            style={{ marginTop: '2rem', padding: '1rem 2rem', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                        >
                            End Session
                        </button>
                    </div>
                )}


                {/* PRINTING STATE */}
                {status === 'PRINTING' && (
                    <div key="printing-content" style={{ width: '100%', maxWidth: '42rem', display: 'flex', flexDirection: 'column', gap: '3rem', textAlign: 'center', alignItems: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <div style={{ padding: '2.5rem', backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: '50%', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}>
                                <PrinterIcon size={120} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <h2 style={{ fontSize: '3.75rem', fontWeight: '900', color: 'white', letterSpacing: '-0.05em', textTransform: 'uppercase' }}>Preparing Document</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '100%', height: '0.75rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '9999px', overflow: 'hidden' }}>
                                    <motion.div
                                        style={{ height: '100%', backgroundColor: '#3b82f6' }}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                    />
                                </div>
                                <span style={{ color: '#60a5fa', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1.5rem' }}>
                                    {progress}% Processing...
                                </span>
                            </div>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: '900' }}>Connecting to Terminal Hardware</p>
                        <div style={{ paddingTop: '1rem', display: 'flex', justifyContent: 'center' }}>
                            <button
                                onClick={resetKiosk}
                                style={{ padding: '1rem 2.5rem', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: '9999px', fontWeight: 'bold' }}
                            >
                                Force Reset / Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* MANUAL ENTRY STATE */}
                {status === 'MANUAL_ENTRY' && (
                    <div key="manual-content" style={{ width: '100%', maxWidth: '24rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '40px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
                            {[...Array(5)].map((_, i) => (
                                <div key={i} style={{ width: '3rem', height: '4rem', backgroundColor: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.875rem', fontWeight: 'bold', color: '#93c5fd' }}>
                                    {inputCode[i] || ''}
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => (
                                <button key={n} onClick={() => inputCode.length < 5 && setInputCode(p => p + n)} style={{ height: '3.5rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.75rem', fontSize: '1.25rem', fontWeight: 'bold', color: 'white', border: 'none' }}>{n}</button>
                            ))}
                            <button onClick={resetKiosk} style={{ height: '3.5rem', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: '0.75rem', color: '#f87171', fontWeight: 'bold', border: 'none' }}>CLR</button>
                            <button onClick={handleManualEntry} disabled={inputCode.length < 5} style={{ height: '3.5rem', backgroundColor: inputCode.length < 5 ? 'rgba(37,99,235,0.3)' : '#2563eb', borderRadius: '0.75rem', color: 'white', fontWeight: 'bold', border: 'none', opacity: inputCode.length < 5 ? 0.5 : 1 }}>OK</button>
                        </div>
                    </div>
                )}

                {/* COMPLETE STATE */}
                {status === 'COMPLETE' && (
                    <div key="complete-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', textAlign: 'center', padding: '0 3rem' }}>
                        <div style={{ width: '14rem', height: '14rem', backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid rgba(34,197,94,0.2)', color: '#4ade80', boxShadow: '0 0 80px rgba(34,197,94,0.3)' }}>
                            <CheckCircle2 size={120} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <h2 style={{ fontSize: '4.5rem', fontWeight: '900', color: 'white', letterSpacing: '-0.05em', textTransform: 'uppercase', fontStyle: 'italic', textAlign: 'center' }}>Printing Successful</h2>
                            <p style={{ fontSize: '2.25rem', color: 'rgba(255,255,255,0.7)', fontWeight: 'bold', textAlign: 'center' }}>Your documents are ready at the tray.</p>
                        </div>
                        <button
                            onClick={resetKiosk}
                            style={{ marginTop: '1rem', padding: '1.5rem 3rem', backgroundColor: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.2)', borderRadius: '9999px', fontSize: '1.25rem', fontWeight: 'bold', color: 'white' }}
                        >
                            Back to Home ({resetCountdown}s)
                        </button>
                    </div>
                )}

                {/* ERROR STATE */}
                {status === 'ERROR' && (
                    <div key="error-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', textAlign: 'center' }}>
                        <div style={{ width: '10rem', height: '10rem', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                            <AlertTriangle size={80} />
                        </div>
                        <h2 style={{ fontSize: '3.75rem', fontWeight: 'bold', color: 'white' }}>Error</h2>
                        <p style={{ fontSize: '1.25rem', color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '32rem' }}>{errorMsg || 'Something went wrong. Try again.'}</p>
                        <button onClick={resetKiosk} style={{ marginTop: '1rem', padding: '1rem 2.5rem', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9999px', fontWeight: 'bold', color: 'white' }}>Restart</button>
                    </div>
                )}
            </main>

            {/* --- DEBUG OVERLAY (Repositioned to bottom small strip) --- */}
            <div style={{ backgroundColor: 'rgba(0,0,0,0.8)', borderTop: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem', zIndex: 50 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0 0.5rem', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: status === 'IDLE' ? '#22c55e' : '#3b82f6' }} />
                        <span style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>{status} | v6.0.0</span>
                    </div>
                    <span style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)' }}>|</span>
                    {debugLogs.slice(0, 3).map((log, i) => (
                        <span key={i} style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(74,222,128,0.5)' }}>{log.substring(log.indexOf(']') + 1)}</span>
                    ))}
                    <span style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', marginLeft: 'auto', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>
                        Kiosk {KIOSK_ID} • {debugLogs.length} L
                    </span>
                </div>
            </div>
        </div>
    );
};

export default AndroidKioskScreen;
