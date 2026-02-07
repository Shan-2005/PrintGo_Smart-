
import React from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, ShieldCheck, History, FileText, Calendar, ChevronRight, Download } from 'lucide-react';
import { PrintTransaction } from '../types';

interface SuccessScreenProps {
  history: PrintTransaction[];
  onReset: () => void;
}

const SuccessScreen: React.FC<SuccessScreenProps> = ({ history, onReset }) => {
  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestamp));
  };

  return (
    <div className="flex flex-col gap-12 pb-20">
      {/* Success Hero */}
      <div className="flex flex-col items-center text-center gap-8">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 12, stiffness: 200 }}
          className="w-48 h-48 bg-[#e8f5e9] text-[#2e7d32] rounded-[60px] flex items-center justify-center shadow-2xl shadow-green-100"
        >
          <Check size={96} strokeWidth={3} />
        </motion.div>

        <div className="space-y-4 max-w-lg">
          <h2 className="text-6xl font-google-sans font-bold text-[#1a1c1e] tracking-tight">Success!</h2>
          <p className="text-xl text-[#44474e] font-medium opacity-80">
            Your print job is complete. Please collect your documents from the tray.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 justify-center">
          <div className="flex items-center gap-2 text-[#2e7d32] bg-[#e8f5e9] px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest">
            <ShieldCheck size={18} />
            Safe & Deleted
          </div>
          <button
            onClick={onReset}
            className="px-8 py-4 bg-[#005fb0] text-white rounded-full font-google-sans font-bold text-lg hover:bg-[#004a8a] transition-all flex items-center justify-center gap-3 m3-button-shadow"
          >
            Start Over
            <ArrowRight size={22} />
          </button>
        </div>
      </div>

      {/* Modern Transaction Feed */}
      <div className="w-full max-w-4xl mx-auto space-y-8 mt-8">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#f1f3f9] text-[#005fb0] rounded-2xl">
              <History size={24} />
            </div>
            <h3 className="text-2xl font-google-sans font-bold text-[#1a1c1e]">Your Session Activity</h3>
          </div>
          <button className="text-[10px] font-black text-[#005fb0] bg-[#d3e4ff] px-4 py-2 rounded-full uppercase tracking-widest hover:opacity-80 transition-opacity">
            Download Log
          </button>
        </div>

        <div className="bg-white rounded-[48px] border border-[#e1e2ec] shadow-sm overflow-hidden">
          <div className="max-h-[500px] overflow-y-auto divide-y divide-[#f1f3f9]">
            {history.length > 0 ? (
              history.map((tx, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={tx.id} 
                  className="p-8 hover:bg-[#f8f9ff] transition-all group flex items-center gap-6"
                >
                  <div className="w-16 h-16 bg-[#f1f3f9] rounded-3xl flex items-center justify-center text-[#44474e] group-hover:bg-[#d3e4ff] group-hover:text-[#005fb0] transition-all">
                    <FileText size={28} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xl font-google-sans font-bold text-[#1a1c1e] truncate pr-6">{tx.file.name}</h4>
                      <span className="font-google-sans font-bold text-[#005fb0] text-2xl">₹{tx.amount}</span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-[#74777f] uppercase tracking-widest">
                      <span className="flex items-center gap-1.5 bg-[#f1f3f9] px-3 py-1 rounded-lg">
                        <Calendar size={14} className="text-[#c4c6cf]" />
                        {formatDate(tx.timestamp)}
                      </span>
                      <span className="flex items-center gap-1.5 bg-[#f1f3f9] px-3 py-1 rounded-lg">
                        <Download size={14} className="text-[#c4c6cf]" />
                        ID: {tx.id}
                      </span>
                      <span className="text-[#2e7d32] flex items-center gap-1">
                        <Check size={14} /> Completed
                      </span>
                    </div>
                  </div>
                  
                  <div className="w-10 h-10 rounded-full bg-white border border-[#e1e2ec] flex items-center justify-center group-hover:bg-[#005fb0] group-hover:text-white transition-all">
                    <ChevronRight size={20} />
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="p-20 text-center space-y-4">
                <div className="w-20 h-20 bg-[#f1f3f9] rounded-full flex items-center justify-center mx-auto text-[#c4c6cf]">
                  <History size={40} />
                </div>
                <p className="text-[#74777f] font-bold text-lg">No previous session found.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuccessScreen;
