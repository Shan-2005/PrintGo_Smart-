
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, ArrowRight, ShieldCheck, Printer, Cloud, X } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface ConnectScreenProps {
  onConnect: (kioskId: string) => void;
  onSkip: () => void;
}

const ConnectScreen: React.FC<ConnectScreenProps> = ({ onConnect, onSkip }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string>("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const handleScan = (result: string) => {
    if (result) {
      setLastScanned(result);
      try {
        const url = new URL(result);
        const kioskId = url.searchParams.get('connect');

        if (kioskId) {
          onConnect(kioskId);
          stopScanner();
        } else {
          setError("Invalid QR Code (No Kiosk ID found)");
        }
      } catch (e) {
        // Fallback: Maybe the QR is JUST the ID?
        if (result.length < 10) {
          onConnect(result);
          stopScanner();
        } else {
          setError("Invalid QR Code Format");
        }
      }
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        setIsScanning(false);
      }).catch((err) => console.error("Stop error:", err));
    }
  };

  useEffect(() => {
    if (isScanning) {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          handleScan(decodedText);
        },
        (errorMessage) => {
          // Suppress continuous error logs
        }
      ).catch((err) => {
        setError("Camera access failed. Please allow camera permissions.");
        console.error("Scanner error:", err);
      });

      return () => {
        if (scannerRef.current) {
          scannerRef.current.stop().catch((err) => console.error("Cleanup error:", err));
        }
      };
    }
  }, [isScanning]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 max-w-md mx-auto w-full">
      <AnimatePresence>
        {isScanning ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            <div className="relative flex-1 flex flex-col items-center justify-center">
              <div id="qr-reader" className="w-full max-w-md"></div>

              {/* Overlay UI */}
              <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start bg-gradient-to-b from-black/50 to-transparent">
                <button
                  onClick={stopScanner}
                  className="bg-white/20 backdrop-blur-md p-2 rounded-full text-white"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent text-white text-center">
                <p className="font-medium text-lg">Scan Kiosk QR Code</p>
                <p className="text-sm opacity-80 mt-1">Point your camera at the kiosk screen</p>
                {lastScanned && <p className="text-xs font-mono text-yellow-400 bg-black/50 p-1 mt-2 rounded break-all">RAW: {lastScanned}</p>}
                {error && <p className="text-red-400 mt-2 font-medium">{error}</p>}
              </div>
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
    </div>
  );
};

export default ConnectScreen;
