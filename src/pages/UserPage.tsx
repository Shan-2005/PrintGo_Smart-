
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Smartphone, Monitor, Wifi, WifiOff, RotateCcw, X, AlertCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import client, { databases, storage, APPWRITE_CONFIG } from '@/src/lib/appwrite';
import { ID, Permission, Role, Query } from 'appwrite';
import { AppStep, PrintSettings, PrintColorMode, PaperSize, FileData, PrintJob, PrintTransaction, PrintFlow } from '@/types';
import ConnectScreen from '@/screens/ConnectScreen';
import UploadScreen from '@/screens/UploadScreen';
import OptionsScreen from '@/screens/OptionsScreen';
import PaymentScreen from '@/screens/PaymentScreen';
import CodeReadyScreen from '@/screens/CodeReadyScreen';
import PrintingScreen from '@/screens/PrintingScreen';
import SuccessScreen from '@/screens/SuccessScreen';
import { IS_TEST_MODE } from '@/src/constants';

const UserPage: React.FC = () => {
    const navigate = useNavigate();
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.CONNECT);
    const [printFlow, setPrintFlow] = useState<PrintFlow>(PrintFlow.CLOUD);
    const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
    const [connectedKioskId, setConnectedKioskId] = useState<string | null>(null);
    const [releaseCode, setReleaseCode] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [currentJob, setCurrentJob] = useState<PrintJob | null>(null);
    const [history, setHistory] = useState<PrintTransaction[]>([]);
    const [sessionDocId, setSessionDocId] = useState<string | null>(null);
    const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);

    const [settings, setSettings] = useState<PrintSettings>({
        colorMode: PrintColorMode.BW,
        paperSize: PaperSize.A4,
        copies: 1,
        pageRange: 'All',
    });

    const [searchParams] = useSearchParams();

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (currentStep === AppStep.SUCCESS) {
            timer = setTimeout(() => {
                window.location.reload();
            }, 30000); // 30 seconds
        }
        return () => clearTimeout(timer);
    }, [currentStep]);

    useEffect(() => {
        const projectId = APPWRITE_CONFIG.PROJECT_ID;
        const endpoint = APPWRITE_CONFIG.ENDPOINT;
        if (projectId && endpoint) {
            client.setEndpoint(endpoint).setProject(projectId);
        }

        const savedHistory = localStorage.getItem('print_history');
        if (savedHistory) {
            try {
                setHistory(JSON.parse(savedHistory));
            } catch (e) {
                console.error("Failed to parse history", e);
            }
        }

        const initAppwrite = async () => {
            const { ensureSession } = await import('@/src/lib/appwrite');
            await ensureSession();
        };
        initAppwrite();

        const startTime = Date.now();
        client.ping().then(() => {
            console.log(`[UserPage] Appwrite Connected in ${Date.now() - startTime}ms`);
            setIsConnected(true);
        }).catch((e) => {
            console.error(`[UserPage] Appwrite Connection Error after ${Date.now() - startTime}ms:`, e);
            if (e.message?.includes('fetch') || e.message?.includes('Network')) {
                console.warn("[UserPage] NETWORK ERROR: Check CORS or SSL certificates on fra.cloud.appwrite.io");
            }
            setIsConnected(false);
        });

        // RE-HYDRATE SESSION
        const activeKioskId = localStorage.getItem('active_kiosk_id');
        const activeSessionId = localStorage.getItem('active_session_doc_id');
        if (activeKioskId && activeSessionId) {
            console.log(`[UserPage] Restoring session for Kiosk ${activeKioskId}...`);
            setConnectedKioskId(activeKioskId);
            setSessionDocId(activeSessionId);
            setPrintFlow(PrintFlow.DIRECT);
            setCurrentStep(AppStep.UPLOAD); // Resume at upload
        }

        const kioskToConnect = searchParams.get('connect');
        if (kioskToConnect) {
            handleConnect(kioskToConnect);
            // Clean URL
            navigate('/app', { replace: true });
        }
    }, []);

    const handleConnect = async (kioskId: string) => {
        try {
            const dbId = APPWRITE_CONFIG.DATABASE_ID;
            const collId = APPWRITE_CONFIG.COLLECTION_ID;
            const projectId = APPWRITE_CONFIG.PROJECT_ID;
            const endpoint = APPWRITE_CONFIG.ENDPOINT;
            client.setEndpoint(endpoint).setProject(projectId);


            // Proceed with lock
            setConnectedKioskId(kioskId);
            setPrintFlow(PrintFlow.DIRECT);

            console.log(`[UserPage] Handshake: Creating document for Kiosk ${kioskId}...`);
            const doc = await databases.createDocument(dbId, collId, ID.unique(), {
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
            console.log(`[UserPage] Handshake SUCCESS: Document ID ${doc.$id}`);
            setSessionDocId(doc.$id);
            localStorage.setItem('active_kiosk_id', kioskId);
            localStorage.setItem('active_session_doc_id', doc.$id);


            // Only advance if Appwrite succeeded
            localStorage.setItem(`kiosk_status_${kioskId}`, JSON.stringify({
                status: 'CONNECTED',
                userName: 'Alex',
                timestamp: Date.now()
            }));

            setCurrentStep(AppStep.UPLOAD);

        } catch (e: any) {
            console.error("Handshake failed. Full Error:", e);
            const errorDetails = e.response || e.message || "Unknown error";
            console.error("Handshake Error Details:", errorDetails);
            setError(`Connection Failed: ${e.message || 'Server unreachable'}`);
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

        const newJob: PrintJob = {
            id: `PG-${Math.floor(100000 + Math.random() * 900000)}`,
            releaseCode: code,
            file: selectedFile!,
            settings: newSettings,
            timestamp: Date.now(),
            amount: total,
            status: 'PENDING',
            kioskId: connectedKioskId || undefined,
            flow: printFlow
        };

        console.log("Proceeding directly to print (Payment Bypassed for Testing):", newJob.id);
        setCurrentJob(newJob);

        // Always bypass payment screen for current testing phase
        handlePaymentSuccess(undefined, newJob);
    };

    const handlePaymentSuccess = async (paymentId?: string, jobOverride?: PrintJob) => {
        const job = jobOverride || currentJob;
        if (!job) {
            console.error("Payment Success but no Job data found!");
            return;
        }

        try {
            const dbId = APPWRITE_CONFIG.DATABASE_ID;
            const collId = APPWRITE_CONFIG.COLLECTION_ID;
            // Upload File to Storage
            const bucketId = APPWRITE_CONFIG.BUCKET_ID;
            let fileId = null;

            if (job.file && job.file.file && bucketId) {
                try {
                    const response = await storage.createFile(
                        bucketId,
                        ID.unique(),
                        job.file.file
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
                ...job.file,
                fileId: fileId // Add fileId to metadata
            };

            const payload = {
                kioskId: job.kioskId || connectedKioskId,
                fileData: JSON.stringify(fileDataObj),
                settings: JSON.stringify(job.settings),
                status: job.flow === PrintFlow.DIRECT ? 'QUEUED' : 'PENDING',
                releaseCode: job.releaseCode,
                amount: job.amount,
                timestamp: job.timestamp
            };

            const subTime = Date.now();
            console.log(`[UserPage] Releasing job document...`);
            // Create Document in Appwrite
            await databases.createDocument(dbId, collId, ID.unique(), payload, [
                Permission.read(Role.any()),
                Permission.update(Role.any()),
                Permission.delete(Role.any())
            ]);

            console.log(`[UserPage] Job Document Created in ${Date.now() - subTime}ms: ${job.releaseCode}`);

            if (job.flow === PrintFlow.DIRECT && (job.kioskId || connectedKioskId)) {
                console.log("[UserPage] Transitioning to PRINTING screen");
                setCurrentStep(AppStep.PRINTING);
            } else {
                // Cloud flow
                setCurrentStep(AppStep.CODE_READY);
            }

        } catch (error: any) {
            console.error("Appwrite Submission Failed:", error);
            alert(`Appwrite Error: ${error?.message || 'Unknown error submitting job'}`);
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
            localStorage.removeItem('active_kiosk_id');
            localStorage.removeItem('active_session_doc_id');
        }
        setSelectedFile(null);
        setCurrentJob(null);
        setConnectedKioskId(null);
        setSessionDocId(null);
        setPrintFlow(PrintFlow.CLOUD);
        setCurrentStep(AppStep.CONNECT);
    };

    const handleConfirmDisconnect = async () => {
        try {
            if (sessionDocId) {
                const dbId = APPWRITE_CONFIG.DATABASE_ID;
                const collId = APPWRITE_CONFIG.COLLECTION_ID;
                // Signal DISCONNECTED status to the session document (Master Switch)
                await databases.updateDocument(dbId, collId, sessionDocId, {
                    status: 'DISCONNECTED'
                });
            }
        } catch (e) {
            console.error("Session disconnect signal failed", e);
        }
        resetApp();
        setIsDisconnectModalOpen(false);
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
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between text-red-600 text-sm font-medium"
                    >
                        <div className="flex items-center gap-2">
                            <RotateCcw size={16} />
                            {error}
                        </div>
                        <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-full transition-all">
                            <X size={16} />
                        </button>
                    </motion.div>
                )}
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
                        {currentStep !== AppStep.CONNECT && printFlow !== PrintFlow.CLOUD && (
                            <button onClick={() => setIsDisconnectModalOpen(true)} className="px-4 py-2 text-xs font-bold text-[#44474e] hover:bg-[#f1f3f9] rounded-full transition-all border border-[#e1e2ec]">Disconnect</button>
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

                <AnimatePresence>
                    {isDisconnectModalOpen && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="bg-white rounded-[40px] p-10 max-w-sm w-full text-center space-y-8 shadow-2xl border border-[#e1e2ec]"
                            >
                                <div className="w-20 h-20 bg-red-50 rounded-[30px] flex items-center justify-center mx-auto text-red-500">
                                    <AlertCircle size={40} />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-google-sans font-bold text-[#1a1c1e]">End Session?</h3>
                                    <p className="text-[#44474e] leading-relaxed">
                                        Are you sure you want to disconnect the session? This will cancel any active print preparation.
                                    </p>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={handleConfirmDisconnect}
                                        className="w-full py-4 bg-red-600 text-white rounded-3xl font-bold hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-100"
                                    >
                                        Yes, Disconnect
                                    </button>
                                    <button
                                        onClick={() => setIsDisconnectModalOpen(false)}
                                        className="w-full py-4 bg-[#f1f3f9] text-[#44474e] rounded-3xl font-bold hover:bg-[#e1e2ec] transition-all active:scale-95"
                                    >
                                        Keep Session
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
};

export default UserPage;
