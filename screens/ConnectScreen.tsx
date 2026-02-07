
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, Smartphone, ArrowRight, ShieldCheck, Printer, Cloud, X } from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';

interface ConnectScreenProps {
  onConnect: (kioskId: string) => void;
  onSkip: () => void;
}

const ConnectScreen: React.FC<ConnectScreenProps> = ({ onConnect, onSkip }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = (result: string) => {
    if (result) {
      try {
        // result connects to: http://localhost:5173/app?connect=102
        const url = new URL(result);
        const kioskId = url.searchParams.get('connect');

        if (kioskId) {
          onConnect(kioskId);
          setIsScanning(false);
        } else {
          setError("Invalid QR Code (No Kiosk ID found)");
        }
      } catch (e) {
        // Fallback: Maybe the QR is JUST the ID?
        if (result.length < 10) {
          onConnect(result);
          setIsScanning(false);
        } else {
          setError("Invalid QR Code Format");
        }
      }
    }
  };

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
            <div className="relative flex-1 flex items-center justify-center">
              <Scanner
                onScan={(result) => {
                  if (result && result.length > 0) {
                    handleScan(result[0].rawValue);
                  }
                }}
                onError={(error) => console.error(error)}
                components={{
                  finder: true,
                }}
                formats={['qr_code', 'rm_qr_code', 'micro_qr_code']}
                styles={{
                  container: { width: '100%', height: '100%' }
                }}
              />

              {/* Overlay UI */}
              <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start bg-gradient-to-b from-black/50 to-transparent">
                <button
                  onClick={() => setIsScanning(false)}
                  className="bg-white/20 backdrop-blur-md p-2 rounded-full text-white"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent text-white text-center">
                <p className="font-medium text-lg">Scan Kiosk QR Code</p>
                <p className="text-sm opacity-80 mt-1">Point your camera at the kiosk screen</p>
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
