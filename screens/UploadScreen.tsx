
import React, { useState, useRef } from 'react';
import { FileData } from '../types';
import { Upload, Smartphone, Cloud, ShieldCheck, AlertCircle, FilePlus } from 'lucide-react';
import { motion } from 'framer-motion';

interface UploadScreenProps {
  onFileSelect: (file: FileData) => void;
}

const UploadScreen: React.FC<UploadScreenProps> = ({ onFileSelect }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = (file: File) => {
    setError(null);
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];

    if (!validTypes.includes(file.type)) {
      setError("File format not supported. Use PDF, DOCX, or Images.");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError("File is too large (Limit: 25MB)");
      return;
    }

    const simulatedPages = file.type.startsWith('image/') ? 1 : Math.max(1, Math.ceil(file.size / 51200));

    onFileSelect({
      name: file.name,
      size: file.size,
      type: file.type,
      pages: simulatedPages,
      file: file
    });
  };

  return (
    <div className="flex flex-col gap-10">
      <div className="max-w-xl">
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-5xl font-google-sans font-bold text-[#1a1c1e] leading-tight"
        >
          Ready to <span className="text-[#005fb0]">print?</span>
        </motion.h2>
        <p className="text-xl text-[#44474e] mt-4 font-medium opacity-80">
          Upload your documents and collect them in seconds.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8">
          <motion.div
            whileHover={{ scale: 1.005 }}
            whileTap={{ scale: 0.995 }}
            className={`relative min-h-[420px] rounded-[48px] border-2 border-dashed transition-all duration-500 flex flex-col items-center justify-center p-12 text-center cursor-pointer group ${isDragging
                ? 'border-[#005fb0] bg-[#d3e4ff]/30'
                : 'border-[#e1e2ec] bg-white hover:border-[#005fb0] hover:shadow-2xl hover:shadow-blue-100/40'
              }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) validateAndSelect(e.dataTransfer.files[0]); }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && validateAndSelect(e.target.files[0])}
              className="hidden"
              accept=".pdf,.docx,.jpg,.png"
            />

            <div className="relative mb-8">
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="w-28 h-28 bg-[#f1f3f9] group-hover:bg-[#d3e4ff] rounded-[38px] flex items-center justify-center text-[#005fb0] transition-colors duration-500"
              >
                <FilePlus size={48} strokeWidth={1.5} />
              </motion.div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-[#005fb0] rounded-full flex items-center justify-center text-white shadow-lg">
                <Upload size={18} strokeWidth={2.5} />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-2xl font-google-sans font-bold text-[#1a1c1e]">Drop your file here</h3>
              <p className="text-[#74777f] font-medium">Or click to browse from device</p>
            </div>

            <div className="mt-10 flex gap-2">
              {['PDF', 'DOCX', 'IMAGES'].map(t => (
                <span key={t} className="px-4 py-2 bg-[#f1f3f9] text-[#44474e] rounded-full text-[10px] font-black tracking-widest uppercase">
                  {t}
                </span>
              ))}
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute top-6 bg-[#ba1a1a] text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-xl"
              >
                <AlertCircle size={18} />
                <span className="text-sm font-bold">{error}</span>
              </motion.div>
            )}
          </motion.div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="p-8 bg-[#f1f3f9]/50 backdrop-blur-sm rounded-[40px] border border-white flex flex-col gap-6">
            <h4 className="text-sm font-black text-[#1a1c1e]/40 uppercase tracking-[0.2em]">Quick Links</h4>

            <button className="flex items-center gap-4 p-5 bg-white rounded-[28px] hover:shadow-lg transition-all text-left group">
              <div className="w-12 h-12 bg-[#e8f5e9] text-[#2e7d32] rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                <Smartphone size={24} />
              </div>
              <div>
                <span className="block font-bold text-[#1a1c1e]">Mobile App</span>
                <span className="text-xs text-[#74777f]">Transfer wirelessly</span>
              </div>
            </button>

            <button className="flex items-center gap-4 p-5 bg-white rounded-[28px] hover:shadow-lg transition-all text-left group">
              <div className="w-12 h-12 bg-[#d3e4ff] text-[#005fb0] rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                <Cloud size={24} />
              </div>
              <div>
                <span className="block font-bold text-[#1a1c1e]">Cloud Storage</span>
                <span className="text-xs text-[#74777f]">Drive, OneDrive</span>
              </div>
            </button>
          </div>

          <div className="p-6 flex items-center gap-3 text-[#74777f] text-[11px] font-bold uppercase tracking-widest justify-center">
            <ShieldCheck size={16} className="text-[#2e7d32]" />
            Privacy First Encryption
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadScreen;
