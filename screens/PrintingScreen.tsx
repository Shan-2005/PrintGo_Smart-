
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Printer, CheckCircle2 } from 'lucide-react';

interface PrintingScreenProps {
  onComplete: () => void;
}

const PrintingScreen: React.FC<PrintingScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Preparing printer...');

  useEffect(() => {
    const statuses = [
      'Preparing printer...',
      'Warming up...',
      'Fetching document...',
      'Formatting pages...',
      'Applying color settings...',
      'Printing page 1...',
      'Printing page 2...',
      'Finalizing...',
    ];

    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev + 1;
        
        // Update status text based on progress
        const statusIdx = Math.floor((next / 100) * statuses.length);
        if (statuses[statusIdx]) setStatus(statuses[statusIdx]);

        if (next >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 800);
          return 100;
        }
        return next;
      });
    }, 60);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-12 max-w-lg mx-auto w-full">
      <div className="relative">
        {/* Printer Animation */}
        <motion.div
          animate={{
            y: [0, -4, 0],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="w-40 h-40 bg-[#d3e4ff] rounded-[40px] flex items-center justify-center text-[#005fb0] shadow-xl shadow-blue-50"
        >
          <Printer size={64} strokeWidth={1.5} />
        </motion.div>

        {/* Paper coming out animation */}
        <motion.div
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: 60, opacity: [0, 1, 0] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute left-1/2 -translate-x-1/2 top-3/4 w-24 h-32 bg-white rounded-md shadow-md border border-[#e1e2ec] -z-10"
        >
          <div className="p-3 space-y-1.5">
            <div className="h-1 w-full bg-[#f1f3f9] rounded-full"></div>
            <div className="h-1 w-full bg-[#f1f3f9] rounded-full"></div>
            <div className="h-1 w-3/4 bg-[#f1f3f9] rounded-full"></div>
          </div>
        </motion.div>
      </div>

      <div className="w-full space-y-6 text-center">
        <div className="space-y-2">
          <h2 className="text-3xl font-medium text-[#1a1c1e]">Printing in progress</h2>
          <p className="text-[#44474e] font-medium h-6">{status}</p>
        </div>

        <div className="space-y-3">
          <div className="h-4 w-full bg-[#f1f3f9] rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-[#005fb0] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "linear" }}
            />
          </div>
          <div className="flex justify-between text-xs font-bold text-[#74777f] tracking-widest uppercase">
            <span>{progress}% Complete</span>
            <span>~{Math.ceil((100 - progress) / 10)}s remaining</span>
          </div>
        </div>
      </div>

      <div className="bg-[#fdfcff] p-6 rounded-[24px] border border-[#e1e2ec] w-full flex items-center gap-4">
         <div className="p-3 bg-[#d3e4ff] text-[#005fb0] rounded-full animate-pulse">
            <CheckCircle2 size={24} />
         </div>
         <div>
            <h4 className="font-medium text-[#1a1c1e] text-sm">Please do not leave</h4>
            <p className="text-xs text-[#74777f]">Collect your pages from the tray below</p>
         </div>
      </div>
    </div>
  );
};

export default PrintingScreen;
