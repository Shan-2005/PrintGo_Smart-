
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Smartphone, Monitor, Wifi, WifiOff } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import client, { databases, storage } from '@/src/lib/appwrite';
import { ID, Permission, Role } from 'appwrite';
import { AppStep, PrintSettings, PrintColorMode, PaperSize, FileData, PrintJob, PrintTransaction, PrintFlow } from '@/types';
import ConnectScreen from '@/screens/ConnectScreen';
import UploadScreen from '@/screens/UploadScreen';
import OptionsScreen from '@/screens/OptionsScreen';
import PaymentScreen from '@/screens/PaymentScreen';
import CodeReadyScreen from '@/screens/CodeReadyScreen';
import PrintingScreen from '@/screens/PrintingScreen';
import SuccessScreen from '@/screens/SuccessScreen';

const UserPage: React.FC = () => {
    const navigate = useNavigate();
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.CONNECT);
    const [printFlow, setPrintFlow] = useState<PrintFlow>(PrintFlow.CLOUD);
    const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
    const [connectedKioskId, setConnectedKioskId] = useState<string | null>(null);
    const [releaseCode, setReleaseCode] = useState<string>('');
    const [currentJob, setCurrentJob] = useState<PrintJob | null>(null);
    const [history, setHistory] = useState<PrintTransaction[]>([]);
    const [debugInfo, setDebugInfo] = useState<string>('Booting UserApp...');

    const [settings, setSettings] = useState<PrintSettings>({
        colorMode: PrintColorMode.BW,
        paperSize: PaperSize.A4,
        copies: 1,
        pageRange: 'All',
    });

    const [searchParams] = useSearchParams();

    useEffect(() => {
        const savedHistory = localStorage.getItem('print_history');
        if (savedHistory) {
            try {
                setHistory(JSON.parse(savedHistory));
            } catch (e) {
                console.error("Failed to parse history", e);
            }
        }

        client.ping().then(() => {
            setIsConnected(true);
        }).catch(() => {
            setIsConnected(false);
        });

        const kioskToConnect = searchParams.get('connect');
        if (kioskToConnect) {
            handleConnect(kioskToConnect);
            // Clean URL
            navigate('/app', { replace: true });
        }
    }, []);

    const handleConnect = async (kioskId: string) => {
        setConnectedKioskId(kioskId);
        setPrintFlow(PrintFlow.DIRECT);

        try {
            const dbId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
            const collId = import.meta.env.VITE_APPWRITE_COLLECTION_ID;
            setDebugInfo(`Appwrite Connect Attempt: Project:${import.meta.env.VITE_APPWRITE_PROJECT_ID}`);

            await databases.createDocument(dbId, collId, ID.unique(), {
                kioskId: kioskId,
                status: 'CONNECTED',
                fileData: '{}', // Dummy data to satisfy schema if needed
                settings: '{}',
                releaseCode: '00000',
                amount: '0',
                timestamp: Date.now()
            }, [
                Permission.read(Role.any()),
                Permission.update(Role.any()),
                Permission.delete(Role.any())
            ]);

            setDebugInfo('Handshake Document Created OK!');

            // Only advance if Appwrite succeeded
            localStorage.setItem(`kiosk_status_${kioskId}`, JSON.stringify({
                status: 'CONNECTED',
                userName: 'Alex',
                timestamp: Date.now()
            }));

            setCurrentStep(AppStep.UPLOAD);

        } catch (e: any) {
            console.error("Handshake failed", e);
            setDebugInfo(`Handshake Fail: ${e?.message || JSON.stringify(e)}`);
            // Stop progression
            return;
        }
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

    const handlePaymentSuccess = async (paymentId?: string) => {
        if (!currentJob) return;

        try {
            const dbId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
            const collId = import.meta.env.VITE_APPWRITE_COLLECTION_ID;

            // Upload File to Storage
            const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_ID;
            let fileId = null;

            if (currentJob.file && currentJob.file.file && bucketId) {
                try {
                    const response = await storage.createFile(
                        bucketId,
                        ID.unique(),
                        currentJob.file.file
                    );
                    fileId = response.$id;
                    console.log("File uploaded:", fileId);
                } catch (uploadError) {
                    console.error("File upload failed", uploadError);
                    alert("Failed to upload file. Please try again.");
                    return;
                }
            }

            // Prepare payload
            const fileDataObj = {
                ...currentJob.file,
                fileId: fileId // Add fileId to metadata
            };

            const payload = {
                kioskId: connectedKioskId,
                fileData: JSON.stringify(fileDataObj),
                settings: JSON.stringify(currentJob.settings),
                status: printFlow === PrintFlow.DIRECT ? 'QUEUED' : 'PENDING',
                releaseCode: currentJob.releaseCode,
                amount: currentJob.amount,
                timestamp: currentJob.timestamp
            };

            // Create Document in Appwrite
            if (paymentId) {
                (payload as any).paymentId = paymentId;
            }
            await databases.createDocument(dbId, collId, ID.unique(), payload, [
                Permission.read(Role.any()),
                Permission.update(Role.any()),
                Permission.delete(Role.any())
            ]);

            if (printFlow === PrintFlow.DIRECT && connectedKioskId) {
                // For Direct flow, we still rely on the subscription on the other end
                // We don't strictly *need* localStorage commands anymore if the Kiosk listens to Appwrite!
                // But for now, let's keep the UI flow SAME.
                setCurrentStep(AppStep.PRINTING);
            } else {
                // Cloud flow
                setCurrentStep(AppStep.CODE_READY);
            }

        } catch (error) {
            console.error("Appwrite Submission Failed:", error);
            alert("Failed to submit print job. Check console.");
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
        <div className="min-h-screen transition-all duration-1000 bg-[#fdfcff] text-[#1a1c1e]">
            <div className="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
                <motion.div
                    animate={{ scale: [1, 1.1, 1], rotate: [0, 5, 0], x: [0, 20, 0] }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-[10%] -right-[10%] w-[500px] h-[500px] bg-[#d3e4ff]/30 blur-[100px] rounded-full"
                />
            </div>

            <div className="max-w-5xl mx-auto px-6 py-10 min-h-screen flex flex-col relative">
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <motion.div
                            whileTap={{ scale: 0.9 }}
                            className="w-12 h-12 rounded-[18px] flex items-center justify-center shadow-lg bg-[#005fb0] text-white shadow-blue-100/50"
                        >
                            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                                <path d="M19,8H5c-1.66,0-3,1.34-3,3v6h4v4h12v-4h4v-6C22,9.34,20.66,8,19,8z M16,19H8v-5h8V19z M19,12c-0.55,0-1-0.45-1-1s0.45-1,1-1s1,0.45,1,1S19.55,12,19,12z M18,3H6v4h12V3z" />
                            </svg>
                        </motion.div>
                        <div>
                            <div>
                                <h1 className="text-xl font-google-sans font-bold tracking-tight text-[#001c38] flex items-center gap-2">
                                    PrintGo
                                    {isConnected === true && <Wifi size={14} className="text-green-600" />}
                                    {isConnected === false && <WifiOff size={14} className="text-red-500" />}
                                </h1>
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60 text-[#005fb0]">
                                    {connectedKioskId ? `Linked to ${connectedKioskId}` : 'Smart Vending'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {currentStep !== AppStep.CONNECT && (
                            <button onClick={resetApp} className="px-4 py-2 text-xs font-bold text-[#44474e] hover:bg-[#f1f3f9] rounded-full transition-all border border-[#e1e2ec]">Disconnect</button>
                        )}
                    </div>
                </header>

                <main className="flex-1 flex flex-col">
                    <AnimatePresence mode="wait">
                        <motion.div key={currentStep} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex-1 flex flex-col">
                            {currentStep === AppStep.CONNECT && <ConnectScreen onConnect={handleConnect} onSkip={handleSkipConnect} />}
                            {currentStep === AppStep.UPLOAD && <UploadScreen onFileSelect={handleFileSelect} />}
                            {currentStep === AppStep.OPTIONS && selectedFile && <OptionsScreen file={selectedFile} initialSettings={settings} onProceed={handleProceedToPayment} onBack={() => setCurrentStep(AppStep.UPLOAD)} />}
                            {currentStep === AppStep.PAYMENT && <PaymentScreen settings={settings} amount={currentJob?.amount || '0'} onPaymentSuccess={handlePaymentSuccess} onBack={() => setCurrentStep(AppStep.OPTIONS)} />}
                            {currentStep === AppStep.CODE_READY && <CodeReadyScreen code={releaseCode} onStartPrint={() => setCurrentStep(AppStep.PRINTING)} />}
                            {currentStep === AppStep.PRINTING && <PrintingScreen onComplete={handlePrintComplete} />}
                            {currentStep === AppStep.SUCCESS && <SuccessScreen history={history} onReset={resetApp} />}
                        </motion.div>
                    </AnimatePresence>
                </main>

                {/* VERCEL PRODUCTION DEBUG OVERLAY */}
                <div className="fixed bottom-0 left-0 p-4 bg-black/80 text-red-400 font-mono text-xs z-50 max-w-lg break-words pointer-events-none">
                    Debug: {debugInfo}
                </div>

            </div>
        </div>
    );
};

export default UserPage;
