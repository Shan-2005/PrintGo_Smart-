
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Monitor } from 'lucide-react';
import KioskScreen from '@/screens/KioskScreen';

const KioskPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen transition-all duration-1000 bg-[#000d1a] text-[#e1e2ec]">
            <div className="min-h-screen flex flex-col relative w-full overflow-hidden">
                {/* Redundant header removed for full-screen immersion */}

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
