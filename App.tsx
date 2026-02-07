
import React, { useState, useEffect } from 'react';
import { AppStep, AppMode, PrintSettings, PrintColorMode, PaperSize, FileData, PrintJob, PrintTransaction, PrintFlow } from './types';
import ConnectScreen from './screens/ConnectScreen';
import UploadScreen from './screens/UploadScreen';
import OptionsScreen from './screens/OptionsScreen';
import PaymentScreen from './screens/PaymentScreen';
import CodeReadyScreen from './screens/CodeReadyScreen';
import PrintingScreen from './screens/PrintingScreen';
import SuccessScreen from './screens/SuccessScreen';
import KioskScreen from './screens/KioskScreen';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, Monitor } from 'lucide-react';

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>(AppMode.USER);
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.CONNECT);
  const [printFlow, setPrintFlow] = useState<PrintFlow>(PrintFlow.CLOUD);
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [connectedKioskId, setConnectedKioskId] = useState<string | null>(null);
  const [releaseCode, setReleaseCode] = useState<string>('');
  const [currentJob, setCurrentJob] = useState<PrintJob | null>(null);
  const [history, setHistory] = useState<PrintTransaction[]>([]);
  
  const [settings, setSettings] = useState<PrintSettings>({
    colorMode: PrintColorMode.BW,
    paperSize: PaperSize.A4,
    copies: 1,
    pageRange: 'All',
  });

  // Effect to handle history and cross-tab sync for the Kiosk
  useEffect(() => {
    const savedHistory = localStorage.getItem('print_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const handleConnect = (kioskId: string) => {
    setConnectedKioskId(kioskId);
    setPrintFlow(PrintFlow.DIRECT);
    // Notify Kiosk that "Alex" (simulated user) has connected
    localStorage.setItem(`kiosk_status_${kioskId}`, JSON.stringify({
        status: 'CONNECTED',
        userName: 'Alex',
        timestamp: Date.now()
    }));
    setCurrentStep(AppStep.UPLOAD);
  };

  const handleSkipConnect = () => {
    setConnectedKioskId(null);
    setPrintFlow(PrintFlow.CLOUD);
    setCurrentStep(AppStep.UPLOAD);
  };

  const handleFileSelect = (file: FileData) => {
    setSelectedFile(file);
    setCurrentStep(AppStep.OPTIONS);
  };

  const handleProceedToPayment = (newSettings: PrintSettings) => {
    setSettings(newSettings);
    const base = newSettings.colorMode === PrintColorMode.COLOR ? 10 : 2;
    const multiplier = newSettings.paperSize === PaperSize.A3 ? 2.0 : 1.0;
    const total = (base * multiplier * (selectedFile?.pages || 1) * newSettings.copies).toFixed(2);

    const code = Math.floor(10000 + Math.random() * 90000).toString();
    setReleaseCode(code);

    setCurrentJob({
      id: `PG-${Math.floor(100000 + Math.random() * 900000)}`,
      releaseCode: code,
      file: selectedFile!,
      settings: newSettings,
      timestamp: Date.now(),
      amount: total,
      status: 'PENDING',
      kioskId: connectedKioskId || undefined,
      flow: printFlow
    });
    
    setCurrentStep(AppStep.PAYMENT);
  };

  const handlePaymentSuccess = () => {
    if (!currentJob) return;

    if (printFlow === PrintFlow.DIRECT && connectedKioskId) {
      // Send immediate print command to the specific kiosk
      localStorage.setItem(`kiosk_command_${connectedKioskId}`, JSON.stringify({
          type: 'START_PRINT',
          job: currentJob,
          timestamp: Date.now()
      }));
      setCurrentStep(AppStep.PRINTING);
    } else {
      // Save to cloud pending jobs for any kiosk to pick up
      const pendingJobs = JSON.parse(localStorage.getItem('pending_jobs') || '[]');
      localStorage.setItem('pending_jobs', JSON.stringify([...pendingJobs, currentJob]));
      setCurrentStep(AppStep.CODE_READY);
    }
  };

  const handlePrintComplete = () => {
    if (currentJob) {
      const newTransaction: PrintTransaction = {
        ...currentJob,
        status: 'COMPLETED'
      };
      const updatedHistory = [newTransaction, ...history];
      setHistory(updatedHistory);
      localStorage.setItem('print_history', JSON.stringify(updatedHistory));
      
      if (connectedKioskId) {
          localStorage.removeItem(`kiosk_status_${connectedKioskId}`);
          localStorage.removeItem(`kiosk_command_${connectedKioskId}`);
      }
    }
    setCurrentStep(AppStep.SUCCESS);
  };

  const resetApp = () => {
    if (connectedKioskId) {
        localStorage.removeItem(`kiosk_status_${connectedKioskId}`);
    }
    setSelectedFile(null);
    setCurrentJob(null);
    setConnectedKioskId(null);
    setPrintFlow(PrintFlow.CLOUD);
    setCurrentStep(AppStep.CONNECT);
  };

  return (
    <div className={`min-h-screen transition-all duration-1000 ${appMode === AppMode.USER ? 'bg-[#fdfcff] text-[#1a1c1e]' : 'bg-[#000d1a] text-[#e1e2ec]'}`}>
      
      {appMode === AppMode.USER && (
        <div className="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
          <motion.div 
            animate={{ scale: [1, 1.1, 1], rotate: [0, 5, 0], x: [0, 20, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-[10%] -right-[10%] w-[500px] h-[500px] bg-[#d3e4ff]/30 blur-[100px] rounded-full"
          />
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-10 min-h-screen flex flex-col relative">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <motion.div 
              whileTap={{ scale: 0.9 }}
              className={`w-12 h-12 rounded-[18px] flex items-center justify-center shadow-lg ${appMode === AppMode.USER ? 'bg-[#005fb0] text-white shadow-blue-100/50' : 'bg-[#d3e4ff] text-[#001c38]'}`}
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                <path d="M19,8H5c-1.66,0-3,1.34-3,3v6h4v4h12v-4h4v-6C22,9.34,20.66,8,19,8z M16,19H8v-5h8V19z M19,12c-0.55,0-1-0.45-1-1s0.45-1,1-1s1,0.45,1,1S19.55,12,19,12z M18,3H6v4h12V3z" />
              </svg>
            </motion.div>
            <div>
              <h1 className={`text-xl font-google-sans font-bold tracking-tight ${appMode === AppMode.USER ? 'text-[#001c38]' : 'text-white'}`}>PrintGo</h1>
              <p className={`text-[9px] font-black uppercase tracking-[0.2em] opacity-60 ${appMode === AppMode.USER ? 'text-[#005fb0]' : 'text-[#d3e4ff]'}`}>
                {appMode === AppMode.USER ? (connectedKioskId ? `Linked to ${connectedKioskId}` : 'Smart Vending') : 'Industrial Terminal'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {currentStep !== AppStep.CONNECT && appMode === AppMode.USER && (
               <button onClick={resetApp} className="px-4 py-2 text-xs font-bold text-[#44474e] hover:bg-[#f1f3f9] rounded-full transition-all border border-[#e1e2ec]">Disconnect</button>
             )}
          </div>
        </header>

        <main className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            {appMode === AppMode.USER ? (
              <motion.div key={currentStep} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex-1 flex flex-col">
                {currentStep === AppStep.CONNECT && <ConnectScreen onConnect={handleConnect} onSkip={handleSkipConnect} />}
                {currentStep === AppStep.UPLOAD && <UploadScreen onFileSelect={handleFileSelect} />}
                {currentStep === AppStep.OPTIONS && selectedFile && <OptionsScreen file={selectedFile} initialSettings={settings} onProceed={handleProceedToPayment} onBack={() => setCurrentStep(AppStep.UPLOAD)} />}
                {currentStep === AppStep.PAYMENT && <PaymentScreen settings={settings} onPaymentSuccess={handlePaymentSuccess} onBack={() => setCurrentStep(AppStep.OPTIONS)} />}
                {currentStep === AppStep.CODE_READY && <CodeReadyScreen code={releaseCode} onStartPrint={() => setCurrentStep(AppStep.PRINTING)} />}
                {currentStep === AppStep.PRINTING && <PrintingScreen onComplete={handlePrintComplete} />}
                {currentStep === AppStep.SUCCESS && <SuccessScreen history={history} onReset={resetApp} />}
              </motion.div>
            ) : (
              <motion.div key="kiosk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col">
                <KioskScreen />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-12 flex flex-col items-center gap-6">
          <div className="flex items-center gap-4 bg-black/5 p-1.5 rounded-full backdrop-blur-sm">
            <button onClick={() => setAppMode(AppMode.USER)} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${appMode === AppMode.USER ? 'bg-white text-[#005fb0] shadow-md' : 'text-[#74777f] hover:text-[#44474e]'}`}><Smartphone size={14} /> User Phone</button>
            <button onClick={() => setAppMode(AppMode.KIOSK)} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${appMode === AppMode.KIOSK ? 'bg-white text-[#001c38] shadow-md' : 'text-[#74777f] hover:text-[#44474e]'}`}><Monitor size={14} /> Printer Kiosk</button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
