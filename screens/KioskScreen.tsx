
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Printer, CornerDownLeft, FileText, CheckCircle2, AlertTriangle,
  Droplet, QrCode, Smartphone, Users, Keyboard, Power, Wifi,
  Loader2, RefreshCw, XCircle
} from 'lucide-react';
import client, { databases } from '@/src/lib/appwrite';
import { Query } from 'appwrite';
import { PrintJob } from '../types';
import QRCode from 'react-qr-code';

/**
 * KioskSide Reconstruction
 * 
 * Rebuilds the Kiosk terminal logic to be modular, robust, and visually premium.
 * Uses a unified synchronization effect for Appwrite events and polling.
 */

// Configuration Constants
const KIOSK_ID = '102';
const SYNC_INTERVAL_MS = 3000;
const SESSION_TIMEOUT_MS = 180000; // 3 minutes

type KioskStatus = 'IDLE' | 'CONNECTED' | 'MANUAL_ENTRY' | 'PRINTING' | 'COMPLETE' | 'ERROR';

const KioskScreen: React.FC = () => {
  // --- State ---
  const [status, setStatus] = useState<KioskStatus>('IDLE');
  const [activeJob, setActiveJob] = useState<PrintJob | null>(null);
  const [connectedUser, setConnectedUser] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [inputCode, setInputCode] = useState('');

  // --- Refs for Synchronization ---
  const lastProcessedDocId = useRef<string | null>(null);
  const isInitialBoot = useRef(true);
  const syncTimer = useRef<NodeJS.Timeout | null>(null);
  const progressTimer = useRef<NodeJS.Timeout | null>(null);

  // --- Utility: Logging ---
  const addLog = useCallback((msg: string) => {
    console.log(`[Kiosk] ${msg}`);
  }, []);

  // --- Core Handlers ---
  const resetKiosk = useCallback(() => {
    addLog('Resetting to IDLE state');
    setStatus('IDLE');
    setActiveJob(null);
    setConnectedUser(null);
    setProgress(0);
    setInputCode('');
    // Note: We don't reset lastProcessedDocId here because we want to keep ignoring old docs
  }, [addLog]);

  const handleJobReceived = useCallback((doc: any) => {
    if (doc.$id === lastProcessedDocId.current) return;
    lastProcessedDocId.current = doc.$id;

    addLog(`Incoming Action: ${doc.status}`);

    if (doc.status === 'CONNECTED' && status === 'IDLE') {
      setConnectedUser('User');
      setStatus('CONNECTED');
    }
    else if (doc.status === 'QUEUED' || doc.status === 'PENDING') {
      try {
        const job: PrintJob = {
          id: doc.$id,
          file: JSON.parse(doc.fileData || '{}'),
          settings: JSON.parse(doc.settings || '{}'),
          timestamp: doc.timestamp,
          amount: doc.amount,
          status: 'PENDING',
          releaseCode: doc.releaseCode,
          kioskId: String(doc.kioskId),
          flow: doc.flow || 'DIRECT'
        };
        setActiveJob(job);
        setStatus('PRINTING');
        setProgress(0);
      } catch (e) {
        addLog('Error parsing job data');
      }
    }
    else if (doc.status === 'COMPLETED' && status === 'PRINTING') {
      setStatus('COMPLETE');
      setProgress(100);
    }
  }, [status, addLog]);

  // --- Appwrite Synchronization Effect ---
  useEffect(() => {
    const dbId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
    const collId = import.meta.env.VITE_APPWRITE_COLLECTION_ID;

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
            lastProcessedDocId.current = latestDoc.$id;
            isInitialBoot.current = false;
            addLog(`Baseline set: ${latestDoc.$id}`);
            return;
          }

          if (latestDoc.$id !== lastProcessedDocId.current) {
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
    const unsubscribe = client.subscribe(
      [`databases.${dbId}.collections.${collId}.documents`],
      (response) => {
        const payload = response.payload as any;
        if (String(payload.kioskId) === KIOSK_ID) {
          handleJobReceived(payload);
        }
      }
    );

    // 2. Polling Fallback
    syncTimer.current = setInterval(performSync, SYNC_INTERVAL_MS);
    performSync(); // Initial check

    return () => {
      unsubscribe();
      if (syncTimer.current) clearInterval(syncTimer.current);
    };
  }, [handleJobReceived, addLog]);

  // --- Side Effects: Animations & Timeouts ---
  useEffect(() => {
    // Session Timeout
    if (status === 'CONNECTED') {
      const timer = setTimeout(() => {
        addLog('Session Timeout');
        resetKiosk();
      }, SESSION_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }

    // Printing Progress Decoration (Visual only, real status comes from Appwrite/Agent)
    if (status === 'PRINTING') {
      progressTimer.current = setInterval(() => {
        setProgress(prev => (prev < 90 ? prev + 1 : prev)); // Cap at 90% until agent marks COMPLETED
      }, 500);
      return () => clearInterval(progressTimer.current);
    }

    // Auto-reset after completion
    if (status === 'COMPLETE') {
      const timer = setTimeout(resetKiosk, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, resetKiosk, addLog]);

  // --- UI Handlers ---
  const handleManualEntry = async () => {
    if (inputCode.length !== 5) return;
    setStatus('PRINTING'); // Immediate feedback
    addLog(`Verifying Code: ${inputCode}...`);

    try {
      const dbId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
      const collId = import.meta.env.VITE_APPWRITE_COLLECTION_ID;

      addLog(`Searching Appwrite Collection: ${collId}`);

      const response = await databases.listDocuments(
        dbId,
        collId,
        [Query.equal('releaseCode', inputCode), Query.limit(1)]
      );

      if (response.documents.length > 0) {
        const doc = response.documents[0];
        addLog(`Match found! Doc: ${doc.$id} Current Status: ${doc.status}`);

        // Trigger agent by updating status and assigning THIS kiosk
        await databases.updateDocument(dbId, collId, doc.$id, {
          status: 'QUEUED',
          kioskId: KIOSK_ID
        });

        // Re-use job processing logic
        handleJobReceived({ ...doc, status: 'QUEUED', kioskId: KIOSK_ID });
      } else {
        addLog(`No matching code found for: ${inputCode}`);
        setStatus('ERROR');
        setTimeout(() => {
          setStatus('MANUAL_ENTRY');
          setInputCode(''); // Clear code on fail
        }, 2000);
      }
    } catch (e: any) {
      addLog(`Verification Error: ${e.message || JSON.stringify(e)}`);
      setStatus('ERROR');
      setTimeout(() => {
        setStatus('MANUAL_ENTRY');
        setInputCode('');
      }, 2000);
    }
  };

  const handleForceSync = () => {
    addLog('Forcing Sync...');
    isInitialBoot.current = false; // Ensure it doesn't just baseline
    // The interval will pick it up or we could trigger performSync directly if it was exposed
  };

  // --- Render Helpers ---
  const renderHeader = () => (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex gap-4">
        <div className="flex items-center gap-3 bg-white/5 px-5 py-2.5 rounded-2xl border border-white/10 shadow-lg backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">System Live</span>
        </div>
        <div className="flex items-center gap-3 bg-white/5 px-5 py-2.5 rounded-2xl border border-white/10 shadow-lg backdrop-blur-md">
          <Wifi size={14} className="text-[#d3e4ff]" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">Kiosk-{KIOSK_ID}</span>
        </div>
      </div>

      <div className="flex gap-4">
        {['C', 'M', 'Y', 'K'].map((ink, idx) => (
          <div key={ink} className="flex flex-col gap-1.5 items-center">
            <div className="h-14 w-3.5 bg-white/5 rounded-full overflow-hidden border border-white/10 relative">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: idx === 3 ? '25%' : '85%' }}
                className={`absolute bottom-0 w-full rounded-full ${idx === 0 ? 'bg-cyan-400' : idx === 1 ? 'bg-teal-400' : idx === 2 ? 'bg-indigo-400' : 'bg-white'
                  } shadow-[0_0_10px_rgba(255,255,255,0.2)]`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#000d1a] flex items-center justify-center p-4 lg:p-12 overflow-hidden">
      {/* 16:9 Aspect Ratio Container */}
      <div className="relative w-full max-w-[1920px] aspect-video bg-[#000d1a] rounded-[40px] border border-white/5 shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">
        {renderHeader()}

        <main className="flex-1 flex flex-col items-center justify-center -mt-6">
          <AnimatePresence mode="wait">
            {/* --- IDLE STATE --- */}
            {status === 'IDLE' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="w-full grid grid-cols-1 lg:grid-cols-2 gap-24 items-center px-16"
              >
                <div className="space-y-12">
                  <div className="space-y-6">
                    <motion.div
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      className="inline-flex items-center gap-3 px-4 py-1.5 bg-blue-500/10 text-blue-300 rounded-full text-[11px] font-black uppercase tracking-[0.3em] border border-blue-500/20"
                    >
                      Premium Printing Terminal
                    </motion.div>
                    <h2 className="text-6xl md:text-8xl lg:text-9xl font-google-sans font-bold text-white tracking-tighter leading-[0.85]">
                      Print <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-200">Better.</span>
                    </h2>
                    <p className="text-xl md:text-2xl text-white/40 leading-relaxed font-medium max-w-md">
                      Scan the secure code to link your device or use a digital release code.
                    </p>
                  </div>

                  <div className="flex flex-col gap-4 max-w-md">
                    <button
                      onClick={() => setStatus('MANUAL_ENTRY')}
                      className="group relative flex items-center gap-8 p-8 bg-white/5 border border-white/10 rounded-[40px] text-white hover:bg-white/10 transition-all active:scale-[0.98]"
                    >
                      <div className="w-16 h-16 bg-blue-500/10 rounded-3xl flex items-center justify-center text-blue-300 group-hover:scale-110 transition-transform">
                        <Keyboard size={32} />
                      </div>
                      <div className="text-left">
                        <div className="text-2xl font-google-sans font-bold">Release Code</div>
                        <div className="text-sm text-white/30 font-medium">Direct 5-digit entry</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="relative group">
                  <div className="absolute -inset-4 bg-gradient-to-tr from-blue-500/20 to-indigo-500/20 rounded-[80px] blur-3xl opacity-50 group-hover:opacity-100 transition-opacity" />
                  <div className="relative bg-white p-12 lg:p-16 rounded-[72px] flex flex-col items-center gap-12 shadow-[0_0_80px_rgba(255,255,255,0.05)] overflow-hidden">
                    <div className="p-8 bg-blue-50 rounded-[48px] w-full aspect-square flex items-center justify-center border-4 border-white/50 shadow-inner">
                      <QRCode
                        value={`${window.location.protocol}//${window.location.host}/app?connect=${KIOSK_ID}`}
                        size={320}
                        level="H"
                        marginSize={0}
                        className="w-full h-auto"
                      />
                    </div>
                    <div className="text-center space-y-6">
                      <div className="text-4xl font-google-sans font-bold text-[#001c38]">Terminal {KIOSK_ID}</div>
                      <div className="px-12 py-5 bg-blue-600 text-white rounded-full text-sm font-black uppercase tracking-[0.25em] shadow-2xl shadow-blue-500/40 active:scale-95 transition-all">
                        Scan with Phone
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- CONNECTED STATE --- */}
            {status === 'CONNECTED' && (
              <motion.div
                key="connected"
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-16 text-center"
              >
                <div className="relative">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1], filter: ['blur(0px)', 'blur(1px)', 'blur(0px)'] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="w-64 h-64 bg-blue-500/10 border border-blue-500/30 rounded-[80px] flex items-center justify-center text-blue-300 shadow-[0_0_60px_rgba(59,130,246,0.2)]"
                  >
                    <Users size={120} strokeWidth={0.5} />
                  </motion.div>
                  <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-green-500 rounded-full border-[10px] border-[#000d1a] flex items-center justify-center shadow-2xl">
                    <CheckCircle2 size={40} className="text-white" />
                  </div>
                </div>

                <div className="space-y-6">
                  <h2 className="text-8xl font-google-sans font-bold text-white tracking-tighter">
                    Welcome, <br /><span className="text-blue-300">{connectedUser}!</span>
                  </h2>
                  <p className="text-2xl text-white/30 font-medium">Session Active. Continue on your mobile device.</p>
                </div>

                <button
                  onClick={resetKiosk}
                  className="mt-8 px-12 py-5 bg-white/5 border border-white/10 rounded-full text-white/60 text-xs font-black uppercase tracking-widest hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/20 transition-all"
                >
                  End Session
                </button>
              </motion.div>
            )}

            {/* --- PRINTING STATE --- */}
            {status === 'PRINTING' && activeJob && (
              <motion.div
                key="printing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full max-w-4xl flex flex-col items-center gap-24 px-8"
              >
                <div className="relative">
                  <motion.div
                    animate={{ y: [0, -20, 0], scale: [1, 1.02, 1] }}
                    transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                    className="w-72 h-72 bg-blue-500/10 border border-blue-400/20 rounded-[80px] flex items-center justify-center text-blue-300 shadow-[0_0_80px_rgba(59,130,246,0.15)]"
                  >
                    <Printer size={140} strokeWidth={0.5} />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 0 }}
                    animate={{ opacity: [0, 1, 0], y: 240 }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="absolute top-[80%] left-1/2 -translate-x-1/2 w-40 h-56 bg-white/10 blur-[1px] rounded-2xl -z-10 shadow-2xl"
                  />
                </div>

                <div className="w-full space-y-12">
                  <div className="flex justify-between items-end border-b border-white/10 pb-8">
                    <div className="space-y-3">
                      <div className="text-[11px] font-black text-blue-400 uppercase tracking-[0.5em] opacity-80">Job In Progress: {activeJob.id}</div>
                      <h4 className="text-6xl font-google-sans font-bold text-white">{activeJob.file.name}</h4>
                    </div>
                    <div className="text-8xl font-google-sans font-bold text-blue-300 tabular-nums">
                      {progress}%
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="h-4 bg-white/5 rounded-full overflow-hidden p-1 border border-white/10 shadow-inner luxury-progress">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-600 via-indigo-400 to-blue-300 rounded-full shadow-[0_0_30px_rgba(59,130,246,0.5)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[11px] font-black text-white/30 uppercase tracking-[0.4em]">
                      <div className="flex gap-4">
                        <span className="flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Hardware Link Active</span>
                        <span className="flex items-center gap-2 decoration-green-500/50 underline">{activeJob.settings.colorMode}</span>
                      </div>
                      <span>{activeJob.file.pages} Pages • Single Copy</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- MANUAL ENTRY STATE --- */}
            {status === 'MANUAL_ENTRY' && (
              <motion.div
                key="manual"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-xl flex flex-col gap-10"
              >
                <div className="bg-white/5 backdrop-blur-3xl p-16 rounded-[64px] border border-white/10 shadow-2xl">
                  <h3 className="text-center text-white/40 font-black uppercase tracking-[0.4em] text-xs mb-12">Enter Release Code</h3>
                  <div className="flex justify-center gap-5 mb-16">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="w-20 h-28 bg-[#000d1a] border-2 border-white/10 rounded-3xl flex items-center justify-center text-6xl font-google-sans font-bold text-blue-300 shadow-inner">
                        {inputCode[i] || ''}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                      <button
                        key={n}
                        onClick={() => inputCode.length < 5 && setInputCode(p => p + n)}
                        className="h-24 bg-white/5 rounded-[32px] text-4xl font-bold text-white hover:bg-white/10 active:scale-90 transition-all border border-white/5"
                      >
                        {n}
                      </button>
                    ))}
                    <button onClick={resetKiosk} className="h-24 bg-red-500/10 rounded-[32px] text-red-500 flex items-center justify-center hover:bg-red-500/20 active:scale-90 transition-all border border-red-500/10"><XCircle size={32} /></button>
                    <button onClick={() => inputCode.length < 5 && setInputCode(p => p + '0')} className="h-24 bg-white/5 rounded-[32px] text-4xl font-bold text-white hover:bg-white/10 border border-white/5">0</button>
                    <button
                      onClick={handleManualEntry}
                      disabled={inputCode.length < 5}
                      className="h-24 bg-blue-600 rounded-[32px] text-white flex items-center justify-center disabled:opacity-20 active:scale-90 shadow-xl shadow-blue-600/30 transition-all"
                    >
                      <CornerDownLeft size={36} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- COMPLETE STATE --- */}
            {status === 'COMPLETE' && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-16 text-center"
              >
                <div className="w-64 h-64 bg-green-500/10 rounded-[80px] flex items-center justify-center border-4 border-green-500/20 shadow-[0_0_60px_rgba(34,197,94,0.15)]">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }}>
                    <CheckCircle2 size={160} strokeWidth={0.5} className="text-green-400" />
                  </motion.div>
                </div>
                <div className="space-y-6">
                  <h2 className="text-8xl font-google-sans font-bold text-white tracking-tighter">Collection Ready</h2>
                  <p className="text-3xl text-white/30 font-medium max-w-2xl">Please retrieve your documents from the exit tray. Have a great day!</p>
                </div>
                <button onClick={resetKiosk} className="mt-8 px-16 py-6 bg-white text-blue-900 rounded-[36px] font-bold text-2xl hover:scale-105 active:scale-95 transition-all shadow-2xl">
                  Done
                </button>
              </motion.div>
            )}

            {/* --- ERROR STATE --- */}
            {status === 'ERROR' && (
              <motion.div key="error" className="flex flex-col items-center gap-8">
                <div className="w-32 h-32 bg-red-500/10 rounded-full flex items-center justify-center border-2 border-red-500/20">
                  <AlertTriangle size={64} className="text-red-400 animate-bounce" />
                </div>
                <div className="text-center space-y-3">
                  <h2 className="text-4xl font-bold text-white">Verification Failed</h2>
                  <p className="text-xl text-white/30">The code entered is invalid or expired.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* --- Operator Controls (Hidden/Subtle) --- */}
        <footer className="fixed bottom-0 left-0 right-0 p-8 pointer-events-none flex justify-end items-end gap-4">
          {/* Controls removed for production */}
        </footer>

        <style>{`
        .luxury-progress::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          animation: shine 2s infinite;
        }
        @keyframes shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .luxury-progress {
          position: relative;
          overflow: hidden;
        }
      `}</style>
      </div>
    </div>
  );
};

export default KioskScreen;
