
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, CornerDownLeft, FileText, CheckCircle2, AlertTriangle, Droplet, QrCode, Smartphone, Users, Keyboard, Power, Wifi } from 'lucide-react';
import client, { databases } from '@/src/lib/appwrite';
import { Query } from 'appwrite';
import { PrintJob } from '../types';
import QRCode from 'react-qr-code';

const KioskScreen: React.FC = () => {
  const kioskId = '102';
  const [inputCode, setInputCode] = useState('');
  const [kioskStatus, setKioskStatus] = useState<'IDLE' | 'CONNECTED' | 'MANUAL_ENTRY' | 'PRINTING' | 'COMPLETE' | 'ERROR'>('IDLE');
  const [activeJob, setActiveJob] = useState<PrintJob | null>(null);
  const [connectedUser, setConnectedUser] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Real-time synchronization with Appwrite
  useEffect(() => {
    const dbId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
    const collId = import.meta.env.VITE_APPWRITE_COLLECTION_ID;

    console.log("Starting Realtime Subscription...", { dbId, collId });

    try {
      const unsubscribe = client.subscribe(
        [`databases.${dbId}.collections.${collId}.documents`],
        (response) => {
          console.log("Realtime Event Received:", response);
          if (response.events.some(e => e.includes('.create') || e.includes('.update'))) {
            const job = response.payload as any; // Type assertion needed or precise type
            console.log("New Document Created:", job);

            // Check if job is for this Kiosk
            if (job.kioskId === kioskId) {
              if (job.status === 'CONNECTED') {
                console.log("User Connected Handshake Received!");
                setConnectedUser('User'); // Could pass name in handshake later
                setKioskStatus('CONNECTED');
              } else if (job.status === 'PENDING') {
                console.log("Job Matches Kiosk ID! Starting Print...");
                // Convert Appwrite doc to PrintJob (parsing JSON strings back)
                const newJob: PrintJob = {
                  id: job.$id,
                  file: JSON.parse(job.fileData),
                  settings: JSON.parse(job.settings),
                  timestamp: job.timestamp,
                  amount: job.amount,
                  status: 'PENDING',
                  releaseCode: job.releaseCode,
                  kioskId: job.kioskId,
                  flow: 'DIRECT' as any
                };

                setActiveJob(newJob);
                setKioskStatus('PRINTING');
              }
            } else {
              console.log("Job ignored (ID mismatch)", { jobKioskId: job.kioskId, myKioskId: kioskId });
            }
          }
        }
      );
      console.log("Subscribed successfully.");

      return () => {
        unsubscribe();
      };
    } catch (err) {
      console.error("Subscription Error:", err);
    }

    // Fallback: Check Appwrite periodically in case Realtime socket fails or gets blocked by the network
    const fallbackInterval = setInterval(async () => {
      if (kioskStatus === 'IDLE') {
        try {
          const response = await databases.listDocuments(
            dbId,
            collId,
            [
              Query.equal('kioskId', kioskId),
              Query.equal('status', 'CONNECTED'),
              Query.orderDesc('$createdAt'),
              Query.limit(1)
            ]
          );

          if (response.documents.length > 0) {
            const doc = response.documents[0];
            // Only accept recent connections (within the last 2 minutes)
            if (Date.now() - doc.timestamp < 2 * 60 * 1000) {
              console.log("Fallback: Handshake found via REST polling!");
              setConnectedUser('User');
              setKioskStatus('CONNECTED');
            }
          }
        } catch (e) {
          // Ignore polling errors to not flood console
        }
      }
    }, 3000);

    return () => {
      clearInterval(fallbackInterval);
    };
  }, [kioskStatus]);

  const handleKeyPress = (num: string) => {
    if (inputCode.length < 5) setInputCode(prev => prev + num);
  };

  const handleManualVerify = async () => {
    try {
      const dbId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
      const collId = import.meta.env.VITE_APPWRITE_COLLECTION_ID;

      const response = await databases.listDocuments(
        dbId,
        collId,
        [Query.equal('releaseCode', inputCode)]
      );

      if (response.documents.length > 0) {
        const job = response.documents[0];
        const foundJob: PrintJob = {
          id: job.$id,
          file: JSON.parse(job.fileData),
          settings: JSON.parse(job.settings),
          timestamp: job.timestamp,
          amount: job.amount,
          status: 'PENDING',
          releaseCode: job.releaseCode,
          kioskId: job.kioskId,
          flow: 'CLOUD' as any
        };
        setActiveJob(foundJob);

        try {
          // Trigger Print Agent by updating status to QUEUED
          await databases.updateDocument(dbId, collId, job.$id, {
            status: 'QUEUED'
          });
          console.log("Status updated to QUEUED");
        } catch (updateError: any) {
          console.error("Failed to update status:", updateError);
          alert(`Error: Kiosk cannot update job. Check Permissions! ${updateError.message}`);
        }

        setKioskStatus('PRINTING');
      } else {
        setKioskStatus('ERROR');
        setTimeout(() => setKioskStatus('MANUAL_ENTRY'), 2000);
      }
    } catch (e) {
      console.error("Verification failed", e);
      setKioskStatus('ERROR');
      setTimeout(() => setKioskStatus('MANUAL_ENTRY'), 2000);
    }
  };

  useEffect(() => {
    if (kioskStatus === 'PRINTING') {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => setKioskStatus('COMPLETE'), 1500);
            return 100;
          }
          return prev + 1;
        });
      }, 40);
      return () => clearInterval(interval);
    }

    // Auto-reset after completion
    if (kioskStatus === 'COMPLETE') {
      const resetTimer = setTimeout(() => {
        console.log('Auto-resetting kiosk to home screen...');
        resetKiosk();
      }, 5000); // 5 seconds after showing completion message

      return () => clearTimeout(resetTimer);
    }
  }, [kioskStatus]);

  const resetKiosk = () => {
    localStorage.removeItem(`kiosk_status_${kioskId}`);
    localStorage.removeItem(`kiosk_command_${kioskId}`);
    setInputCode('');
    setActiveJob(null);
    setConnectedUser(null);
    setKioskStatus('IDLE');
    setProgress(0);
  };

  return (
    <div className="flex-1 flex flex-col gap-10 max-w-6xl mx-auto w-full pt-2">
      {/* Top Header Stat Bar */}
      <div className="flex items-center justify-between px-4">
        <div className="flex gap-4">
          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
            <Power size={14} className="text-green-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/60">System Ready</span>
          </div>
          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
            <Wifi size={14} className="text-[#d3e4ff]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Linked: {kioskId}</span>
          </div>
        </div>

        <div className="flex gap-3">
          {['C', 'M', 'Y', 'K'].map((ink, idx) => (
            <div key={ink} className="flex flex-col gap-1">
              <div className="h-12 w-3 bg-white/10 rounded-full overflow-hidden relative">
                <div
                  className={`absolute bottom-0 w-full rounded-full ${idx === 0 ? 'bg-cyan-400' : idx === 1 ? 'bg-pink-400' : idx === 2 ? 'bg-yellow-400' : 'bg-white'}`}
                  style={{ height: idx === 3 ? '15%' : '70%' }}
                />
              </div>
              <span className="text-[8px] font-bold text-center text-white/40">{ink}</span>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {kioskStatus === 'IDLE' && (
          <motion.div key="idle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-10 pl-4">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#d3e4ff]/10 text-[#d3e4ff] rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-[#d3e4ff]/20">
                  Terminal Online
                </div>
                <h2 className="text-5xl md:text-6xl lg:text-8xl font-google-sans font-bold text-white tracking-tighter leading-[0.9]">Start <br /><span className="text-[#d3e4ff]">Printing.</span></h2>
                <p className="text-lg md:text-xl lg:text-2xl text-white/40 leading-relaxed font-medium max-w-sm">Scan the QR code to link your device or use a release code.</p>
              </div>

              <button onClick={() => setKioskStatus('MANUAL_ENTRY')} className="group flex items-center gap-6 p-6 md:p-6 lg:p-8 bg-white/5 border border-white/10 rounded-[32px] md:rounded-[40px] text-white font-bold hover:bg-white/10 transition-all w-full max-w-md">
                <div className="w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 bg-[#d3e4ff]/10 rounded-2xl flex items-center justify-center text-[#d3e4ff] group-hover:scale-110 transition-transform">
                  <Keyboard size={24} className="md:w-6 md:h-6 lg:w-8 lg:h-8" />
                </div>
                <div className="text-left">
                  <div className="text-xl md:text-xl lg:text-2xl font-google-sans">Release Code</div>
                  <div className="text-xs md:text-sm text-white/30 font-medium">Enter 5-digit ticket manually</div>
                </div>
              </button>
            </div>

            <div className="bg-white p-6 md:p-10 lg:p-14 rounded-[40px] md:rounded-[56px] lg:rounded-[72px] flex flex-col items-center gap-6 md:gap-8 lg:gap-10 shadow-2xl relative overflow-hidden group w-full max-w-md mx-auto">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <QrCode size={80} className="md:w-[100px] md:h-[100px] lg:w-[120px] lg:h-[120px]" />
              </div>
              <div className="w-full aspect-square bg-[#f8f9ff] rounded-[32px] md:rounded-[40px] lg:rounded-[48px] p-4 md:p-6 lg:p-8 border-4 border-[#f1f3f9] relative flex items-center justify-center">
                <div className="p-6 md:p-8 bg-white rounded-[24px] md:rounded-[32px] lg:rounded-[40px] w-full h-full flex items-center justify-center">
                  <QRCode
                    value={`${window.location.protocol}//${window.location.host}/app?connect=${kioskId}`}
                    size={256}
                    level="L"
                    marginSize={4}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    viewBox={`0 0 256 256`}
                  />
                </div>
              </div>
              <div className="text-center space-y-2 md:space-y-3">
                <div className="text-xl md:text-2xl lg:text-3xl font-google-sans font-bold text-[#001c38]">Kiosk Terminal {kioskId}</div>
                <div className="px-6 py-2 md:px-8 md:py-3 bg-[#005fb0] text-white rounded-full text-[10px] md:text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-200">
                  Scan with your Phone
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {kioskStatus === 'CONNECTED' && (
          <motion.div key="conn" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center text-center gap-12">
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-56 h-56 bg-[#d3e4ff]/10 border border-[#d3e4ff]/30 rounded-[72px] flex items-center justify-center text-[#d3e4ff] shadow-3xl"
              >
                <Users size={96} strokeWidth={1} />
              </motion.div>
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="absolute -bottom-2 -right-2 w-16 h-16 bg-green-500 rounded-full border-8 border-[#000d1a] flex items-center justify-center shadow-lg"
              >
                <CheckCircle2 size={32} className="text-white" />
              </motion.div>
            </div>

            <div className="space-y-4">
              <h2 className="text-7xl font-google-sans font-bold text-white tracking-tighter">Hello, <span className="text-[#d3e4ff]">{connectedUser || 'Alex'}!</span></h2>
              <p className="text-2xl text-white/40 font-medium">You are securely linked. Follow instructions on your phone.</p>
            </div>

            <button onClick={resetKiosk} className="px-10 py-4 bg-white/5 border border-white/10 rounded-full text-white/40 font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all">
              Disconnect Session
            </button>
          </motion.div>
        )}

        {kioskStatus === 'MANUAL_ENTRY' && (
          <motion.div key="manual" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center gap-10">
            <div className="bg-white/5 p-12 rounded-[56px] border border-white/10 backdrop-blur-xl w-full max-w-lg shadow-2xl">
              <h3 className="text-center text-white/40 font-black uppercase tracking-widest text-xs mb-8">Enter Release Code</h3>
              <div className="flex justify-center gap-4 mb-12">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-16 h-24 bg-[#000d1a] border-2 border-white/10 rounded-2xl flex items-center justify-center text-5xl font-google-sans font-bold text-[#d3e4ff] shadow-inner">
                    {inputCode[i] || ''}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <button key={n} onClick={() => handleKeyPress(n.toString())} className="h-20 bg-white/5 rounded-3xl text-3xl font-bold text-white hover:bg-white/10 active:scale-90 transition-all border border-white/5">{n}</button>)}
                <button onClick={() => setKioskStatus('IDLE')} className="h-20 bg-red-500/10 rounded-3xl text-red-400 flex items-center justify-center hover:bg-red-500/20 active:scale-90 transition-all border border-red-500/20"><AlertTriangle size={32} /></button>
                <button onClick={() => handleKeyPress('0')} className="h-20 bg-white/5 rounded-3xl text-3xl font-bold text-white hover:bg-white/10 border border-white/5">0</button>
                <button onClick={handleManualVerify} disabled={inputCode.length < 5} className="h-20 bg-[#d3e4ff] rounded-3xl text-[#001c38] flex items-center justify-center disabled:opacity-20 active:scale-90 shadow-xl shadow-blue-500/20"><CornerDownLeft size={32} /></button>
              </div>
            </div>
          </motion.div>
        )}

        {kioskStatus === 'PRINTING' && activeJob && (
          <motion.div key="print" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center gap-16">
            <div className="relative">
              <motion.div
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 0.4, repeat: Infinity, ease: "easeInOut" }}
                className="w-64 h-64 bg-[#d3e4ff]/10 border border-[#d3e4ff]/20 rounded-[80px] flex items-center justify-center text-[#d3e4ff] shadow-3xl"
              >
                <Printer size={120} strokeWidth={1} />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: [0, 1, 0], y: 220 }}
                transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                className="absolute left-1/2 -translate-x-1/2 top-3/4 w-32 h-44 bg-white/20 border border-white/30 rounded-xl backdrop-blur-md -z-10 shadow-2xl"
              />
            </div>

            <div className="w-full max-w-3xl space-y-8">
              <div className="flex justify-between items-end text-white">
                <div className="space-y-1">
                  <p className="text-xs font-black text-[#d3e4ff] uppercase tracking-[0.4em] opacity-60">Task ID: {activeJob.id}</p>
                  <h4 className="text-5xl font-google-sans font-bold">{activeJob.file.name}</h4>
                </div>
                <div className="text-7xl font-google-sans font-bold text-[#d3e4ff]">{progress}%</div>
              </div>
              <div className="h-8 bg-white/5 rounded-full overflow-hidden p-2 border border-white/10 shadow-inner">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#005fb0] to-[#d3e4ff] rounded-full shadow-[0_0_40px_rgba(211,228,255,0.5)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-black text-white/30 uppercase tracking-[0.5em]">
                <span>CYMK ACTIVE</span>
                <span>PAGE {Math.floor((progress / 100) * (activeJob?.file.pages || 1)) + 1} OF {activeJob.file.pages}</span>
              </div>
            </div>
          </motion.div>
        )}

        {kioskStatus === 'COMPLETE' && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center text-center gap-12">
            <motion.div
              initial={{ rotate: -15, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }}
              className="w-56 h-56 bg-green-500/20 text-green-400 rounded-[80px] flex items-center justify-center border-4 border-green-500/30 shadow-2xl shadow-green-500/10"
            >
              <CheckCircle2 size={120} strokeWidth={1} />
            </motion.div>
            <div className="space-y-4">
              <h2 className="text-7xl font-google-sans font-bold text-white tracking-tighter">Collection Ready</h2>
              <p className="text-2xl text-white/40 font-medium">Your documents are in the exit tray. Have a great day!</p>
            </div>
            <button onClick={resetKiosk} className="mt-8 px-16 py-6 bg-white text-[#001c38] rounded-[36px] font-bold text-2xl hover:bg-[#d3e4ff] transition-all shadow-2xl active:scale-95">
              Back to Home
            </button>
          </motion.div>
        )}

        {kioskStatus === 'ERROR' && (
          <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center text-center gap-8">
            <div className="w-32 h-32 bg-red-500/10 rounded-full flex items-center justify-center border-2 border-red-500/20">
              <AlertTriangle size={64} className="text-red-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-4xl font-google-sans font-bold text-white">Invalid Release Code</h2>
              <p className="text-xl text-white/30">Code {inputCode} was not found in our secure database.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default KioskScreen;
