
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, Smartphone, ArrowRight, ShieldCheck, Printer, Cloud, X, CheckCircle2, RotateCcw } from 'lucide-react';
import { Html5Qrcode } from "html5-qrcode";

interface ConnectScreenProps {
  onConnect: (kioskId: string) => void;
  onSkip: () => void;
}

const ConnectScreen: React.FC<ConnectScreenProps> = ({ onConnect, onSkip }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const SCAN_REGION_ID = "qr-reader";

  useEffect(() => {
    if (isScanning) {
      const startScanner = async () => {
        try {
          const html5QrCode = new Html5Qrcode(SCAN_REGION_ID);
          scannerRef.current = html5QrCode;

          const qrCodeSuccessCallback = (decodedText: string) => {
            handleScan(decodedText);
          };

          const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          };

          await html5QrCode.start(
            { facingMode: "environment" },
            config,
            qrCodeSuccessCallback,
            undefined // ignore errors
          );
        } catch (err: any) {
          console.error("Failed to start scanner:", err);
          setError(`Camera Error: ${err.message || 'Check permissions'}`);
        }
      };

      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isScanning]);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
    }
  };

  const handleScan = async (result: string) => {
    if (result) {
      await stopScanner();
      try {
        // result connects to: http://localhost:5173/app?connect=102
        const url = new URL(result);
        const kioskId = url.searchParams.get('connect');

        if (kioskId) {
          setIsScanning(false);
          setIsSuccess(true);
          setTimeout(() => {
            onConnect(kioskId);
          }, 1500);
        } else {
          // Try regex if URL parsing fails or param missing
          const match = result.match(/connect=(\d+)/);
          if (match && match[1]) {
            setIsScanning(false);
            setIsSuccess(true);
            setTimeout(() => onConnect(match[1]), 1500);
          } else {
            setError("QR valid, but no Kiosk ID found");
            setIsScanning(false);
          }
        }
      } catch (e) {
        // Fallback: Just the ID?
        if (result.length > 0 && result.length < 15) {
          setIsScanning(false);
          setIsSuccess(true);
          setTimeout(() => onConnect(result), 1500);
        } else {
          setError("Invalid QR Format");
          setIsScanning(false);
        }
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 max-w-md mx-auto w-full">
      <AnimatePresence>
        {isScanning ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            <div className="relative flex-1 flex flex-col items-center justify-center bg-black">
              {/* HTML5 QR Code Container */}
              <div id={SCAN_REGION_ID} className="w-full h-full max-h-[70vh] overflow-hidden" />

              {/* Overlay UI */}
              <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent z-10">
                <button
                  onClick={() => setIsScanning(false)}
                  className="bg-white/20 backdrop-blur-md p-2 rounded-full text-white"
                >
                  <X size={24} />
                </button>
                <div className="bg-blue-500/20 backdrop-blur-md px-4 py-2 rounded-full border border-blue-500/30">
                  <p className="text-blue-300 text-[10px] font-black uppercase tracking-widest">Live Scanner</p>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent text-white text-center z-10">
                <p className="font-google-sans font-bold text-xl uppercase tracking-tighter">Scan QR Code</p>
                <p className="text-sm opacity-60 mt-2 font-medium">Align the code within the frame</p>
                {error && (
                  <div className="mt-4 p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-200 text-xs flex items-center justify-center gap-2">
                    <RotateCcw size={14} /> {error}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : isSuccess ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-50 bg-[#005fb0]"
          >
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
            <div className="flex flex-col items-center justify-center h-full text-white">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-8 shadow-2xl"
              >
                <CheckCircle2 size={64} className="text-[#005fb0]" />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-4xl font-google-sans font-bold mb-2 shadow-sm"
              >
                Connected!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-white/80 font-medium"
              >
                Kiosk Linked Successfully
              </motion.p>
            </div>
          </motion.div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium mb-4">
                <Printer size={14} />
                <span>Smart Vending Ready</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3 font-google-sans">
                How would you like<br /> to <span className="text-[#005fb0]">print?</span>
              </h1>
              <p className="text-gray-500">Choose the fastest way to get your documents.</p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 gap-4 w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {/* Direct Scan Option */}
              <button
                onClick={() => setIsScanning(true)}
                className="group relative flex flex-col items-center p-6 bg-white border-2 border-dashed border-[#005fb0]/30 rounded-2xl hover:border-[#005fb0] hover:bg-blue-50/50 transition-all active:scale-[0.98]"
              >
                <div className="w-16 h-16 bg-blue-100/50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-[#005fb0]">
                  <QrCode size={32} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Direct Scan</h3>
                <p className="text-xs text-gray-500 text-center mb-4">Connect to a kiosk first for instant automated printing.</p>
                <div className="flex items-center gap-2 text-sm font-medium text-[#005fb0]">
                  Scan Kiosk QR <ArrowRight size={16} />
                </div>
              </button>

              {/* Cloud Print Option */}
              <button
                onClick={onSkip}
                className="group relative flex flex-col items-center p-6 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3 text-gray-600">
                  <Cloud size={24} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Cloud Print</h3>
                <p className="text-xs text-gray-500 text-center mb-4">Upload now and get a release code to use at any kiosk later.</p>

                <div className="flex items-center gap-2 text-sm font-medium text-gray-600 group-hover:text-gray-900">
                  Skip to Upload <ArrowRight size={16} />
                </div>
              </button>
            </motion.div>

            {/* Manual Entry Fallback */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-6 w-full max-w-sm"
            >
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter Kiosk ID Manually"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#005fb0] focus:ring-2 focus:ring-blue-100 outline-none transition-all text-center font-mono uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:font-sans"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val.length > 0) onConnect(val);
                    }
                  }}
                />
              </div>
              <p className="text-[10px] text-gray-400 text-center mt-2">
                Can't scan? Type the code shown on the screen.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-400"
            >
              <ShieldCheck size={14} />
              <span>Secure & Private Printing</span>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div >
  );
};

export default ConnectScreen;
