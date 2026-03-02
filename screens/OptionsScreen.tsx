
import React, { useState } from 'react';
import { PrintSettings, PrintColorMode, PaperSize, FileData } from '../types';
import { ChevronLeft, FileText, Layers, Palette, Maximize, CreditCard, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface OptionsScreenProps {
  file: FileData;
  initialSettings: PrintSettings;
  onProceed: (settings: PrintSettings) => void;
  onBack: () => void;
}

const OptionsScreen: React.FC<OptionsScreenProps> = ({ file, initialSettings, onProceed, onBack }) => {
  const [settings, setSettings] = useState<PrintSettings>(initialSettings);

  const calculateUnitCost = () => {
    const base = settings.colorMode === PrintColorMode.COLOR ? 10 : 2;
    const multiplier = settings.paperSize === PaperSize.A3 ? 2.0 : 1.0;
    return base * multiplier;
  };

  const calculateTotal = () => {
    return (calculateUnitCost() * file.pages * settings.copies).toFixed(2);
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="w-12 h-12 flex items-center justify-center bg-white rounded-full border border-[#e1e2ec] hover:bg-[#f1f3f9] transition-all"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-3xl font-google-sans font-bold text-[#1a1c1e]">Print Options</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 space-y-8">
          {/* File Hero */}
          <div className="bg-[#f1f3f9] p-8 rounded-[40px] flex items-center gap-6 border border-white shadow-sm">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-[#005fb0] shadow-md">
              <FileText size={40} strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-2xl font-google-sans font-bold text-[#1a1c1e] truncate">{file.name}</h3>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-3 py-1 bg-[#d3e4ff] text-[#005fb0] text-[10px] font-black uppercase tracking-widest rounded-full">
                  {file.pages} {file.pages === 1 ? 'Page' : 'Pages'}
                </span>
                <span className="text-sm font-semibold text-[#74777f]">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Setting Item */}
            <div className="bg-white p-6 rounded-[32px] border border-[#e1e2ec] space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#f1f3f9] rounded-xl text-[#005fb0]"><Palette size={18} /></div>
                <span className="font-bold text-[#1a1c1e] text-sm">Color Mode</span>
              </div>
              <div className="grid grid-cols-2 p-1.5 bg-[#f1f3f9] rounded-2xl">
                <button
                  onClick={() => setSettings({ ...settings, colorMode: PrintColorMode.BW })}
                  className={`py-3 rounded-[14px] text-xs font-bold transition-all ${settings.colorMode === PrintColorMode.BW ? 'bg-white text-[#005fb0] shadow-sm' : 'text-[#44474e]'
                    }`}
                >
                  B & W
                </button>
                <button
                  onClick={() => setSettings({ ...settings, colorMode: PrintColorMode.COLOR })}
                  className={`py-3 rounded-[14px] text-xs font-bold transition-all ${settings.colorMode === PrintColorMode.COLOR ? 'bg-white text-[#005fb0] shadow-sm' : 'text-[#44474e]'
                    }`}
                >
                  Color
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] border border-[#e1e2ec] space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#f1f3f9] rounded-xl text-[#005fb0]"><Maximize size={18} /></div>
                <span className="font-bold text-[#1a1c1e] text-sm">Paper Size</span>
              </div>
              <select
                value={settings.paperSize}
                onChange={(e) => setSettings({ ...settings, paperSize: e.target.value as PaperSize })}
                className="w-full bg-[#f1f3f9] border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-[#005fb0] outline-none"
              >
                <option value={PaperSize.A4}>A4 Standard</option>
                <option value={PaperSize.A3}>A3 Premium</option>
                <option value={PaperSize.LETTER}>US Letter</option>
              </select>
            </div>

            <div className="bg-white p-6 rounded-[32px] border border-[#e1e2ec] space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#f1f3f9] rounded-xl text-[#005fb0]"><Layers size={18} /></div>
                <span className="font-bold text-[#1a1c1e] text-sm">Copies</span>
              </div>
              <div className="flex items-center justify-between bg-[#f1f3f9] rounded-2xl p-1.5">
                <button
                  onClick={() => setSettings({ ...settings, copies: Math.max(1, settings.copies - 1) })}
                  className="w-12 h-12 flex items-center justify-center bg-white rounded-xl shadow-sm text-2xl font-bold text-[#005fb0]"
                >
                  −
                </button>
                <span className="font-google-sans font-bold text-xl">{settings.copies}</span>
                <button
                  onClick={() => setSettings({ ...settings, copies: settings.copies + 1 })}
                  className="w-12 h-12 flex items-center justify-center bg-white rounded-xl shadow-sm text-2xl font-bold text-[#005fb0]"
                >
                  +
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] border border-[#e1e2ec] space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#f1f3f9] rounded-xl text-[#005fb0]"><FileText size={18} /></div>
                <span className="font-bold text-[#1a1c1e] text-sm">Page Range</span>
              </div>
              <input
                type="text"
                placeholder="All"
                value={settings.pageRange}
                onChange={(e) => setSettings({ ...settings, pageRange: e.target.value })}
                className="w-full bg-[#f1f3f9] border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-[#005fb0] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Desktop Summary Card / Mobile Sticky Bar */}
        <div className="lg:col-span-5 relative">
          <motion.div
            layout
            className="hidden lg:flex bg-[#001c38] p-10 rounded-[48px] sticky top-8 text-white shadow-2xl shadow-[#001c38]/20 flex-col gap-10 overflow-hidden"
          >
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl rounded-full"></div>

            <div className="flex items-center justify-between relative">
              <h3 className="text-2xl font-google-sans font-bold">Summary</h3>
              <Sparkles className="text-[#005fb0]" />
            </div>

            <div className="space-y-5 relative">
              <div className="flex justify-between text-white/50 text-xs font-black uppercase tracking-widest">
                <span>Color</span>
                <span className="text-white">{settings.colorMode === PrintColorMode.COLOR ? 'Full Color' : 'B & W'}</span>
              </div>
              <div className="flex justify-between text-white/50 text-xs font-black uppercase tracking-widest">
                <span>Paper</span>
                <span className="text-white">{settings.paperSize}</span>
              </div>
              <div className="h-px bg-white/10"></div>
              <div className="flex justify-between items-end pt-4">
                <span className="text-white/60 font-bold">Total Amount</span>
                <span className="text-5xl font-google-sans font-bold text-white">₹{calculateTotal()}</span>
              </div>
            </div>

            <button
              onClick={() => onProceed(settings)}
              className="w-full py-5 px-6 bg-[#005fb0] text-white rounded-full font-google-sans font-bold text-lg hover:bg-[#004a8a] transition-all flex items-center justify-center gap-3 m3-button-shadow group"
            >
              {import.meta.env.VITE_SKIP_PAYMENT === 'true' ? (
                <>
                  <Sparkles size={22} className="group-hover:scale-110 transition-transform" />
                  Proceed to Print (Test Mode)
                </>
              ) : (
                <>
                  <CreditCard size={22} className="group-hover:scale-110 transition-transform" />
                  Pay with Checkout
                </>
              )}
            </button>
          </motion.div>

          {/* Mobile Sticky Bottom Bar */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-[#e1e2ec] z-40 flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-[#74777f] uppercase tracking-widest leading-none mb-1">Total Amount</span>
              <span className="text-2xl font-google-sans font-bold text-[#1a1c1e]">₹{calculateTotal()}</span>
            </div>
            <button
              onClick={() => onProceed(settings)}
              className="flex-1 py-4 px-6 bg-[#005fb0] text-white rounded-2xl font-google-sans font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
            >
              {import.meta.env.VITE_SKIP_PAYMENT === 'true' ? (
                <>
                  <Sparkles size={18} />
                  Print Now
                </>
              ) : (
                <>
                  <CreditCard size={18} />
                  Pay Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptionsScreen;
