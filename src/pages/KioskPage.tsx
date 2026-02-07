
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Monitor } from 'lucide-react';
import KioskScreen from '@/screens/KioskScreen';

const KioskPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen transition-all duration-1000 bg-[#000d1a] text-[#e1e2ec]">
            <div className="max-w-5xl mx-auto px-6 py-10 min-h-screen flex flex-col relative">
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <motion.div
                            whileTap={{ scale: 0.9 }}
                            className="w-12 h-12 rounded-[18px] flex items-center justify-center shadow-lg bg-[#d3e4ff] text-[#001c38]"
                        >
                            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                                <path d="M19,8H5c-1.66,0-3,1.34-3,3v6h4v4h12v-4h4v-6C22,9.34,20.66,8,19,8z M16,19H8v-5h8V19z M19,12c-0.55,0-1-0.45-1-1s0.45-1,1-1s1,0.45,1,1S19.55,12,19,12z M18,3H6v4h12V3z" />
                            </svg>
                        </motion.div>
                        <div>
                            <h1 className="text-xl font-google-sans font-bold tracking-tight text-white">PrintGo</h1>
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60 text-[#d3e4ff]">
                                Industrial Terminal
                            </p>
                        </div>
                    </div>
                </header>

                <main className="flex-1 flex flex-col">
                    <AnimatePresence mode="wait">
                        <motion.div key="kiosk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col">
                            <KioskScreen />
                        </motion.div>
                    </AnimatePresence>
                </main>

            </div>
        </div>
    );
};

export default KioskPage;
