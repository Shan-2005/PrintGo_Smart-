
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Printer as PrinterIcon, CornerDownLeft, FileText, CheckCircle2, AlertTriangle,
    Droplet, QrCode, Smartphone, Users, Keyboard, Power, Wifi,
    Loader2, RefreshCw, XCircle
} from 'lucide-react';
import client, { databases, storage } from '@/src/lib/appwrite';
import { Query } from 'appwrite';
import { PrintJob } from '../types';
import QRCode from 'react-qr-code';
import { Printer } from '@capgo/capacitor-printer';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

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

    // --- Refs for Synchronization ---
    const lastProcessedStateKey = useRef<string | null>(null);
    const isInitialBoot = useRef(true);
    const syncTimer = useRef<NodeJS.Timeout | null>(null);
    const [isAgentProcessing, setIsAgentProcessing] = useState(false);
    const isAgentRef = useRef(false);
    useEffect(() => { isAgentRef.current = isAgentProcessing; }, [isAgentProcessing]);
    const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);

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
            if (Capacitor.isPluginAvailable('SplashScreen')) {
                try {
                    await SplashScreen.hide();
                    addLog('Splash Screen Hidden (Immediate)');
                } catch (e) {
                    addLog(`Splash Hide Error: ${e}`);
                }
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

        const timeout = setTimeout(initApp, 100);
        return () => clearTimeout(timeout);
    }, [addLog]);

    // --- Core Handlers ---
    const resetKiosk = useCallback(() => {
        addLog('Resetting to IDLE state');
        setStatus('IDLE');
        setActiveJob(null);
        setConnectedUser(null);
        setProgress(0);
        setInputCode('');
    }, [addLog]);

    // --- Refs for State Access (Prevents Effect Churn) ---
    const statusRef = useRef<KioskStatus>(status);
    useEffect(() => { statusRef.current = status; }, [status]);

    // --- THE ACTION HANDLER ---
    const handleJobReceived = useCallback(async (doc: any) => {
        const startTime = Date.now();
        const stateKey = `${doc.$id}_${doc.status}`;
        if (stateKey === lastProcessedStateKey.current) return;
        lastProcessedStateKey.current = stateKey;

        addLog(`>>> [RECV] Action: ${doc.status} | ID: ${doc.$id}`);

        const currentStatus = statusRef.current;
        const currentIsAgent = isAgentRef.current;

        // Case A: User Connected via QR
        if (doc.status === 'CONNECTED' && currentStatus === 'IDLE') {
            addLog(`HANDSHAKE: User connected to Terminal-${KIOSK_ID}`);
            setConnectedUser('User');
            setStatus('CONNECTED');
        }
        // Case B: Job Ready to Print (Local Agent Takeover)
        else if (doc.status === 'QUEUED' || doc.status === 'PENDING') {
            if (currentIsAgent) {
                addLog('AGENT BUSY: Skipping duplicate trigger');
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

        addLog(`<<< [RECV] Handled in ${Date.now() - startTime}ms`);
    }, [addLog]); // Only depends on addLog

    // --- "THE AGENT" - Background Job Processing (Native Print) ---
    const processJobLocally = async (doc: any) => {
        if (isAgentRef.current) return;
        isAgentRef.current = true;
        setIsAgentProcessing(true);
        addLog(`Native Agent: Processing Job ${doc.$id}`);

        try {
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

            // 2. Download file as base64
            addLog(`Downloading ${fileData.name}...`);
            setProgress(20);

            const fileUrl = storage.getFileDownload(
                import.meta.env.VITE_APPWRITE_BUCKET_ID,
                fileData.fileId
            ).toString();

            addLog(`Fetch URL: ${fileUrl.substring(0, 60)}...`);

            const response = await fetch(fileUrl);
            if (!response.ok) {
                throw new Error(`Download failed: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            addLog(`Downloaded: ${blob.size} bytes, type: ${blob.type}`);
            setProgress(40);

            // Convert Blob to full data URI
            const dataUri = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error('FileReader failed'));
                reader.readAsDataURL(blob);
            });

            addLog(`Base64 ready: ${dataUri.substring(0, 50)}...`);
            setProgress(60);

            // 3. Automated Save (Bypassing manual print dialog for now)
            addLog('Automating: Saving to storage...');
            const mimeType = fileData.mimeType || blob.type || 'application/pdf';
            const base64Only = dataUri.split(',')[1];

            try {
                // Save to Documents directory (User doesn't need to interact)
                const fileName = `PrintGo_${Date.now()}_${fileData.name || 'document'}`;
                const savedFile = await Filesystem.writeFile({
                    path: fileName,
                    data: base64Only,
                    directory: Directory.Documents
                });
                addLog(`Automated Save Success: ${savedFile.uri}`);
                setProgress(80);
            } catch (saveErr: any) {
                addLog(`Auto-save failed: ${saveErr.message}. Trying Cache...`);
                // Fallback to Cache if Documents is restricted
                const fileName = `auto_print_${Date.now()}.pdf`;
                await Filesystem.writeFile({
                    path: fileName,
                    data: base64Only,
                    directory: Directory.Cache
                });
                addLog('Saved to Cache as fallback.');
            }



            // 4. Update Cloud Status
            setProgress(90);
            addLog('Updating Appwrite: COMPLETED');
            await databases.updateDocument(
                import.meta.env.VITE_APPWRITE_DATABASE_ID,
                import.meta.env.VITE_APPWRITE_COLLECTION_ID,
                doc.$id,
                { status: 'COMPLETED' }
            );

            setProgress(100);
            setStatus('COMPLETE');
            addLog('Print Sequence Finished!');

        } catch (error: any) {
            addLog(`Agent Error: ${error.message}`);
            setStatus('ERROR');
            lastProcessedStateKey.current = null;
        } finally {
            isAgentRef.current = false;
            setIsAgentProcessing(false);
        }

    };

    // --- Appwrite Synchronization Effect (Subscription + Polling) ---
    useEffect(() => {
        const dbId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
        const collId = import.meta.env.VITE_APPWRITE_COLLECTION_ID;

        const performSync = async () => {
            const syncStartTime = Date.now();
            try {
                addLog(`SYNC [${KIOSK_ID}] polling...`);
                const response = await databases.listDocuments(dbId, collId, [
                    Query.equal('kioskId', KIOSK_ID),
                    Query.orderDesc('$createdAt'),
                    Query.limit(1)
                ]);

                if (response.documents.length > 0) {
                    const doc = response.documents[0];
                    if (isInitialBoot.current) {
                        isInitialBoot.current = false;
                        addLog(`INIT: Baseline Job ID ${doc.$id} [${doc.status}]`);

                        // If the job is old but still QUEUED, don't baseline it, process it!
                        if (doc.status === 'QUEUED' || doc.status === 'PENDING') {
                            addLog(`INIT: Resuming unfinished job found on boot!`);
                            handleJobReceived(doc);
                        } else {
                            lastProcessedStateKey.current = `${doc.$id}_${doc.status}`;
                        }
                        return;
                    }
                    handleJobReceived(doc);
                } else {
                    isInitialBoot.current = false;
                }
                addLog(`SYNC OK: ${response.documents.length} docs, latest: ${response.documents[0]?.$id || 'none'} [${response.documents[0]?.status || '-'}]`);
            } catch (err: any) {
                addLog(`SYNC ERROR [${Date.now() - syncStartTime}ms]: ${err.message}`);
            }
        };

        // 1. Real-time Subscription (with safety delay and retry)
        let unsubscribe: (() => void) | null = null;
        let retryCount = 0;
        const maxRetries = 3;

        const startSubscription = () => {
            try {
                unsubscribe = client.subscribe(
                    [`databases.${dbId}.collections.${collId}.documents`],
                    (response) => {
                        const payload = response.payload as any;
                        if (String(payload.kioskId) === KIOSK_ID) {
                            handleJobReceived(payload);
                        }
                    }
                );
                addLog("REALTIME: Subscription active");
            } catch (err: any) {
                addLog(`REALTIME ERROR: ${err.message}`);
                if (retryCount < maxRetries) {
                    retryCount++;
                    addLog(`REALTIME: Retrying in ${retryCount * 2}s...`);
                    setTimeout(startSubscription, retryCount * 2000);
                }
            }
        };

        // Delay subscription to ensure WebSocket handshake is ready
        const subTimeout = setTimeout(startSubscription, 1500);

        // 2. Polling Fallback (1s interval for Android stability)
        const interval = setInterval(performSync, AGENT_POLL_INTERVAL);
        performSync(); // Initial check

        return () => {
            clearTimeout(subTimeout);
            if (unsubscribe) unsubscribe();
            clearInterval(interval);
        };
    }, [handleJobReceived, addLog]);

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
            const dbId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
            const collId = import.meta.env.VITE_APPWRITE_COLLECTION_ID;

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
            <div className="flex items-center justify-between px-10 py-6 z-10">
                <div className="flex gap-4">
                    <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
                        <div className={`w-2 h-2 rounded-full ${status === 'IDLE' ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Android Node Active</span>
                    </div>
                </div>
                <div className="text-white/20 text-xs font-bold tracking-[0.5em] uppercase">Vending Unit-{KIOSK_ID}</div>
            </div>

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

                {/* PRINTING STATE */}
                {status === 'PRINTING' && (
                    <div key="printing-content" className="w-full max-w-2xl space-y-12 text-center">
                        <div className="flex justify-center">
                            <div className="p-10 bg-blue-500/10 rounded-full border border-blue-500/20 text-blue-400">
                                <PrinterIcon size={120} className="animate-bounce" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-5xl font-bold">{activeJob?.file?.name || 'Processing Document...'}</h2>
                            <div className="text-7xl font-bold text-blue-300">{progress}%</div>
                            <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/10">
                                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                            </div>
                            <p className="text-white/30 tracking-widest uppercase text-xs font-black">Sending to Native Android Print Manager</p>
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
                    <div key="complete-content" className="flex flex-col items-center gap-8">
                        <div className="w-40 h-40 bg-green-500/10 rounded-full flex items-center justify-center border-2 border-green-500/20 text-green-400">
                            <CheckCircle2 size={80} />
                        </div>
                        <h2 className="text-6xl font-bold text-white">Done!</h2>
                        <p className="text-xl text-white/30">Please collect your prints.</p>
                    </div>
                )}

                {/* ERROR STATE */}
                {status === 'ERROR' && (
                    <div key="error-content" className="flex flex-col items-center gap-8 text-center">
                        <div className="w-40 h-40 bg-red-500/10 rounded-full flex items-center justify-center border-2 border-red-500/20 text-red-400">
                            <AlertTriangle size={80} />
                        </div>
                        <h2 className="text-6xl font-bold text-white">Error</h2>
                        <p className="text-xl text-white/30">Something went wrong. Try again.</p>
                        <button onClick={resetKiosk} className="mt-4 px-10 py-4 bg-white/5 border border-white/10 rounded-full font-bold">Restart</button>
                    </div>
                )}
            </main>

            {/* --- DEBUG OVERLAY (Repositioned to bottom small strip) --- */}
            <div className="bg-black/80 border-t border-white/10 p-2 z-50">
                <div className="flex items-center gap-3 px-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
                    <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${status === 'IDLE' ? 'bg-green-500' : 'bg-blue-500'}`} />
                        <span className="text-[9px] font-mono text-white/60 uppercase">{status}</span>
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
