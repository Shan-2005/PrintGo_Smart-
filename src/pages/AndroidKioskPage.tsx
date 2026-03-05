
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AndroidKioskScreen from '@/screens/AndroidKioskScreen';

const AndroidKioskPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#000d1a] text-[#e1e2ec]">
            <div className="h-screen flex flex-col relative w-full overflow-hidden">
                <main className="flex-1 flex flex-col">
                    <AnimatePresence mode="wait">
                        <motion.div key="android-kiosk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col">
                            <AndroidKioskScreen />
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
};

export default AndroidKioskPage;
