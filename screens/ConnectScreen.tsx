
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Smartphone, ArrowRight, ShieldCheck, Printer, Cloud } from 'lucide-react';

interface ConnectScreenProps {
  onConnect: (kioskId: string) => void;
  onSkip: () => void;
}

const ConnectScreen: React.FC<ConnectScreenProps> = ({ onConnect, onSkip }) => {
  const [isScanning, setIsScanning] = useState(false);

  const handleSimulateScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      onConnect('102');
    }, 2000);
  };

  return (
    <div className="flex-1 flex flex-col gap-10">
      <div className="max-w-xl">
        <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-5xl font-google-sans font-bold text-[#1a1c1e] leading-tight">
          How would you like <br/><span className="text-[#005fb0]">to print?</span>
        </motion.h2>
        <p className="text-xl text-[#44474e] mt-4 font-medium opacity-80">Choose the fastest way to get your documents.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.div whileHover={{ y: -5 }} className="bg-white p-10 rounded-[48px] border border-[#e1e2ec] shadow-xl shadow-blue-50 flex flex-col items-center text-center gap-8 group">
          <div className="w-40 h-40 bg-[#f1f3f9] rounded-[40px] flex items-center justify-center text-[#005fb0] relative">
            <QrCode size={64} className={isScanning ? 'animate-pulse' : ''} />
            {isScanning && <motion.div initial={{ top: '10%' }} animate={{ top: '80%' }} transition={{ duration: 1.5, repeat: Infinity }} className="absolute left-4 right-4 h-1 bg-[#005fb0] shadow-[0_0_15px_#005fb0]" />}
          </div>
          <div className="space-y-3">
            <h3 className="text-2xl font-google-sans font-bold">Direct Scan</h3>
            <p className="text-sm text-[#74777f] font-medium leading-relaxed">Connect to a kiosk first for instant automated printing.</p>
          </div>
          <button onClick={handleSimulateScan} disabled={isScanning} className="w-full py-5 bg-[#005fb0] text-white rounded-full font-bold text-lg hover:bg-[#004a8a] transition-all flex items-center justify-center gap-3">
            {isScanning ? 'Connecting...' : 'Scan Kiosk QR'}
            <ArrowRight size={20} />
          </button>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} className="bg-white p-10 rounded-[48px] border border-[#e1e2ec] flex flex-col items-center text-center gap-8 opacity-90">
          <div className="w-40 h-40 bg-[#f1f3f9] rounded-[40px] flex items-center justify-center text-[#74777f]">
            <Cloud size={64} />
          </div>
          <div className="space-y-3">
            <h3 className="text-2xl font-google-sans font-bold">Cloud Print</h3>
            <p className="text-sm text-[#74777f] font-medium leading-relaxed">Upload now and get a release code to use at any kiosk later.</p>
          </div>
          <button onClick={onSkip} className="w-full py-5 bg-[#f1f3f9] text-[#1a1c1e] rounded-full font-bold text-lg hover:bg-[#e1e2ec] transition-all flex items-center justify-center gap-3">
            Skip to Upload
            <ArrowRight size={20} />
          </button>
        </motion.div>
      </div>

      <div className="flex items-center justify-center gap-3 text-xs font-bold text-[#2e7d32] uppercase tracking-[0.2em] mt-4">
        <ShieldCheck size={16} /> Secure Peer-to-Peer Transfer Enabled
      </div>
    </div>
  );
};

export default ConnectScreen;
