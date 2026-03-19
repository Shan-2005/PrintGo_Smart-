
import React from 'react';
import { motion } from 'framer-motion';
import { QrCode, Info, Printer, Copy, Share2, Download } from 'lucide-react';

interface CodeReadyScreenProps {
  code: string;
  onStartPrint: () => void;
}

const CodeReadyScreen: React.FC<CodeReadyScreenProps> = ({ code, onStartPrint }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 max-w-lg mx-auto w-full pb-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#e8f5e9] text-[#2e7d32] rounded-full text-xs font-bold uppercase tracking-widest mb-2">
          <div className="w-2 h-2 bg-[#2e7d32] rounded-full animate-pulse"></div>
          Payment Confirmed
        </div>
        <h2 className="text-3xl font-google-sans font-medium text-[#1a1c1e]">Ready to Print</h2>
        <p className="text-[#44474e]">Your document is queued at the kiosk.</p>
      </motion.div>

      {/* Ticket Container */}
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="w-full relative group"
      >
        {/* Ticket Top Shadow/Glow */}
        <div className="absolute -inset-4 bg-[#005fb0]/5 blur-2xl rounded-[48px] -z-10 group-hover:bg-[#005fb0]/10 transition-colors"></div>
        
        <div className="bg-white rounded-[40px] border border-[#e1e2ec] shadow-xl overflow-hidden relative">
          {/* Perforation Line Simulation */}
          <div className="absolute top-[42%] left-0 right-0 flex items-center justify-between px-[-10px] pointer-events-none">
            <div className="w-6 h-6 rounded-full bg-[#fdfcff] border border-[#e1e2ec] -ml-3 shadow-inner"></div>
            <div className="flex-1 border-t-2 border-dashed border-[#e1e2ec] mx-2"></div>
            <div className="w-6 h-6 rounded-full bg-[#fdfcff] border border-[#e1e2ec] -mr-3 shadow-inner"></div>
          </div>

          {/* Top Section: Code */}
          <div className="p-10 pb-16 text-center space-y-6">
            <div className="space-y-4">
              <p className="text-xs font-bold text-[#74777f] uppercase tracking-[0.2em]">Release Code</p>
              <div className="flex justify-center gap-3">
                {code.split('').map((char, i) => (
                  <motion.div
                    key={i}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 + (i * 0.05) }}
                    className="w-14 h-20 bg-[#f8f9ff] rounded-[20px] flex items-center justify-center text-4xl font-google-sans font-bold text-[#005fb0] border-b-4 border-[#d3e4ff] shadow-sm"
                  >
                    {char}
                  </motion.div>
                ))}
              </div>
            </div>
            
            <button className="inline-flex items-center gap-2 text-xs font-medium text-[#005fb0] hover:bg-[#f1f3f9] px-4 py-2 rounded-full transition-colors">
              <Copy size={14} /> Copy Code
            </button>
          </div>

          {/* Bottom Section: QR */}
          <div className="p-10 pt-16 bg-[#f8f9fa] flex flex-col items-center gap-6">
            <div className="p-5 bg-white rounded-[32px] shadow-sm border border-[#f1f3f9]">
               <div className="w-40 h-40 grid grid-cols-10 grid-rows-10 gap-0.5 relative">
                  {/* Visual QR simulation */}
                  {Array.from({ length: 100 }).map((_, i) => (
                      <div key={i} className={`rounded-[1px] ${Math.random() > 0.4 ? 'bg-[#001c38]' : 'bg-transparent'}`} />
                  ))}
                  {/* Position markers */}
                  <div className="absolute top-0 left-0 w-10 h-10 border-4 border-[#005fb0] rounded-lg bg-white p-1">
                    <div className="w-full h-full bg-[#005fb0] rounded-[2px]"></div>
                  </div>
                  <div className="absolute top-0 right-0 w-10 h-10 border-4 border-[#005fb0] rounded-lg bg-white p-1">
                    <div className="w-full h-full bg-[#005fb0] rounded-[2px]"></div>
                  </div>
                  <div className="absolute bottom-0 left-0 w-10 h-10 border-4 border-[#005fb0] rounded-lg bg-white p-1">
                    <div className="w-full h-full bg-[#005fb0] rounded-[2px]"></div>
                  </div>
                  {/* Center branding */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-md">
                      <div className="w-5 h-5 bg-[#005fb0] rounded-md"></div>
                    </div>
                  </div>
               </div>
            </div>
            
            <div className="text-center space-y-1">
              <p className="font-google-sans font-medium text-[#1a1c1e]">Scan at Kiosk</p>
              <p className="text-sm text-[#74777f]">Quick access to your print</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <div className="w-full space-y-4">
        <div className="flex gap-3">
          <button 
            onClick={() => window.print()}
            className="flex-1 py-4 bg-white border border-[#e1e2ec] rounded-[24px] text-sm font-google-sans font-medium text-[#44474e] hover:bg-[#f1f3f9] transition-all flex items-center justify-center gap-2"
          >
            <Download size={16} /> Save Ticket
          </button>
          <button 
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: 'PrintGo Smart Release Code',
                  text: `My PrintGo Smart release code is: ${code}. Visit any Kiosk to print!`,
                  url: window.location.href
                }).catch(() => {});
              } else {
                navigator.clipboard.writeText(code);
                alert('Code copied to clipboard: ' + code);
              }
            }}
            className="flex-1 py-4 bg-white border border-[#e1e2ec] rounded-[24px] text-sm font-google-sans font-medium text-[#44474e] hover:bg-[#f1f3f9] transition-all flex items-center justify-center gap-2"
          >
            <Share2 size={16} /> Share
          </button>
        </div>
      </div>

      <div className="flex items-start gap-4 p-5 bg-[#f1f3f9] rounded-[28px] w-full">
        <div className="p-2.5 bg-white rounded-2xl text-[#005fb0] shadow-sm">
          <Info size={18} />
        </div>
        <p className="text-xs text-[#44474e] leading-relaxed font-medium">
          Note: This code is valid for 24 hours at any PrintGo Smart Kiosk in this facility. Make sure your paper is ready in the output tray.
        </p>
      </div>
    </div>
  );
};

export default CodeReadyScreen;
