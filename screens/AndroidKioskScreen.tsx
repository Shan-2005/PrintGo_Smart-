
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

    // --- Utility: Logging ---
    const addLog = useCallback((msg: string) => {
        console.log(`[Android-Kiosk] ${msg}`);
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

            // 1. Initial State
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

            // 2. Download File Manually (Native Printers need local file:// paths)
            addLog(`Downloading ${fileData.name}...`);
            setProgress(30);

            const fileUrl = storage.getFileDownload(
                import.meta.env.VITE_APPWRITE_BUCKET_ID,
                fileData.fileId
            ).toString();

            const response = await fetch(fileUrl);
            const blob = await response.blob();

            // Convert Blob to Base64 (Capacitor Filesystem requires base64)
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve) => {
                reader.onloadend = () => {
                    const res = reader.result as string;
                    resolve(res.split(',')[1]); // Strip data:mimetype;base64,
                };
                reader.readAsDataURL(blob);
            });

            const fileName = `temp_${Date.now()}_${fileData.name}`;
            const savedFile = await Filesystem.writeFile({
                path: fileName,
                data: base64,
                directory: Directory.Cache
            });

            addLog(`Local Copy Saved: ${savedFile.uri}`);
            setProgress(60);

            // 3. Trigger Native Android Print
            addLog('Invoking Native Android Print Framework...');
            try {
                await Printer.printFile({
                    path: savedFile.uri, // This is a real file:/// path
                    name: fileData.name,
                    mimeType: fileData.mimeType || 'application/pdf'
                });
            } catch (printErr: any) {
                addLog(`Native Print Failed: ${printErr.message}`);
                throw printErr;
            }

            // 4. Update Cloud Status
            setProgress(90);
            addLog('Update Appwrite: COMPLETED');
            await databases.updateDocument(
                import.meta.env.VITE_APPWRITE_DATABASE_ID,
                import.meta.env.VITE_APPWRITE_COLLECTION_ID,
                doc.$id,
                { status: 'COMPLETED' }
            );

            setProgress(100);
            setStatus('COMPLETE');
            addLog('Native Print Sequence Finished');

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
    return (
        <div className="h-screen w-screen bg-[#000d1a] flex flex-col relative overflow-hidden font-google-sans">
            {/* Visual Header */}
            <div className="flex items-center justify-between px-10 py-6">
                <div className="flex gap-4">
                    <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Android Node Active</span>
                    </div>
                </div>
                <div className="text-white/20 text-xs font-bold tracking-[0.5em] uppercase">Vending Unit-{KIOSK_ID}</div>
            </div>

            <main className="flex-1 flex flex-col items-center justify-center p-8">
                <AnimatePresence mode="wait">
                    {status === 'IDLE' && (
                        <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-12">
                            <h1 className="text-8xl font-bold text-white tracking-tighter text-center">
                                Ready to <br /><span className="text-blue-400">Print.</span>
                            </h1>
                            <div className="flex gap-6">
                                <button onClick={() => setStatus('MANUAL_ENTRY')} className="px-10 py-6 bg-white/5 border border-white/10 rounded-full text-white text-xl font-bold flex items-center gap-4 hover:bg-white/10 transition-all">
                                    <Keyboard size={24} /> Enter Code
                                </button>
                                <div className="bg-white p-6 rounded-[40px] shadow-2xl">
                                    <QRCode value={`${PRODUCTION_URL}/app?connect=${KIOSK_ID}`} size={160} />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {status === 'CONNECTED' && (
                        <motion.div key="connected" initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-16 text-center">
                            <div className="relative">
                                <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 4, repeat: Infinity }} className="w-64 h-64 bg-blue-500/10 border border-blue-500/30 rounded-[80px] flex items-center justify-center text-blue-300 shadow-[0_0_60px_rgba(59,130,246,0.2)]">
                                    <Users size={120} strokeWidth={0.5} />
                                </motion.div>
                                <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-green-500 rounded-full border-[10px] border-[#000d1a] flex items-center justify-center shadow-2xl">
                                    <CheckCircle2 size={40} className="text-white" />
                                </div>
                            </div>
                            <div className="space-y-6">
                                <h2 className="text-8xl font-bold text-white tracking-tighter">
                                    Welcome, <br /><span className="text-blue-300">User!</span>
                                </h2>
                                <p className="text-2xl text-white/30 font-medium">Session Active. Continue on your mobile device.</p>
                            </div>

                            <div className="flex flex-col gap-4 w-full max-w-xs mt-8">
                                <button onClick={() => {
                                    addLog('Running Manual Print Test...');
                                    processJobLocally({
                                        $id: 'TEST_ID',
                                        status: 'QUEUED',
                                        fileData: JSON.stringify({ name: 'TEST_PAGE', fileId: '67c81523000f04e4c2be', mimeType: 'application/pdf' }),
                                        settings: '{}',
                                        amount: '0',
                                        kioskId: KIOSK_ID
                                    });
                                }} className="px-8 py-4 bg-blue-500/20 border border-blue-500/30 rounded-2xl text-blue-300 text-sm font-bold hover:bg-blue-500/30 transition-all flex items-center justify-center gap-3">
                                    <PrinterIcon size={20} /> Force Print Test
                                </button>

                                <button onClick={resetKiosk} className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white/40 text-xs font-black uppercase tracking-widest hover:bg-red-500/10 transition-all">
                                    End Session
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {status === 'PRINTING' && (
                        <motion.div key="printing" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-2xl space-y-12 text-center">
                            <div className="flex justify-center">
                                <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="p-10 bg-blue-500/10 rounded-full border border-blue-500/20 text-blue-400">
                                    <PrinterIcon size={120} />
                                </motion.div>
                            </div>
                            <div className="space-y-4">
                                <h2 className="text-5xl font-bold text-white">{activeJob?.file?.name || 'Processing...'}</h2>
                                <div className="text-7xl font-bold text-blue-300">{progress}%</div>
                                <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/10">
                                    <motion.div className="h-full bg-blue-500" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
                                </div>
                                <p className="text-white/30 tracking-widest uppercase text-xs font-black">Spooling to Native Android Print Manager</p>
                            </div>
                        </motion.div>
                    )}

                    {status === 'MANUAL_ENTRY' && (
                        <motion.div key="manual" className="w-full max-w-sm bg-white/5 p-8 rounded-[40px] border border-white/10">
                            <div className="flex justify-center gap-2 mb-8">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="w-12 h-16 bg-black/40 border-2 border-white/10 rounded-xl flex items-center justify-center text-3xl font-bold text-blue-300">
                                        {inputCode[i] || ''}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => (
                                    <button key={n} onClick={() => inputCode.length < 5 && setInputCode(p => p + n)} className="h-14 bg-white/5 rounded-xl text-xl font-bold text-white active:scale-95">{n}</button>
                                ))}
                                <button onClick={resetKiosk} className="h-14 bg-red-500/10 rounded-xl text-red-400 font-bold active:scale-95">CLR</button>
                                <button onClick={handleManualEntry} className="h-14 bg-blue-600 rounded-xl text-white font-bold active:scale-95" disabled={inputCode.length < 5}>OK</button>
                            </div>
                        </motion.div>
                    )}

                    {status === 'COMPLETE' && (
                        <motion.div key="complete" className="flex flex-col items-center gap-8">
                            <div className="w-40 h-40 bg-green-500/10 rounded-full flex items-center justify-center border-2 border-green-500/20 text-green-400">
                                <CheckCircle2 size={80} />
                            </div>
                            <h2 className="text-6xl font-bold text-white">Done!</h2>
                            <p className="text-xl text-white/30">Please collect your prints.</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

export default AndroidKioskScreen;
