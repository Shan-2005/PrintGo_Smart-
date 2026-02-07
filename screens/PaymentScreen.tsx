
import React, { useState, useEffect } from 'react';
import { PrintSettings } from '../types';
import { ChevronLeft, CreditCard, ShieldCheck, QrCode, Smartphone, ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PaymentScreenProps {
  settings: PrintSettings;
  onPaymentSuccess: () => void;
  onBack: () => void;
}

type PaymentMethod = 'UPI_QR' | 'UPI_APPS' | 'CARD';
type UPIApp = 'GPAY' | 'PHONEPE' | 'PAYTM';

const PaymentScreen: React.FC<PaymentScreenProps> = ({ settings, onPaymentSuccess, onBack }) => {
  const [method, setMethod] = useState<PaymentMethod>('UPI_APPS');
  const [selectedApp, setSelectedApp] = useState<UPIApp | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const calculateTotal = () => {
    // Pricing in INR: 2 for B&W, 10 for Color
    const basePrice = settings.colorMode === 'COLOR' ? 10 : 2;
    const sizeMultiplier = settings.paperSize === 'A3' ? 2.0 : 1.0;
    return (basePrice * sizeMultiplier * settings.copies).toFixed(2);
  };

  const handleAppPayment = (app: UPIApp) => {
    setSelectedApp(app);
    setIsRedirecting(true);
    
    // Simulate redirection to GPay/PhonePe
    setTimeout(() => {
      setIsRedirecting(false);
      setIsProcessing(true);
      // Simulate verification after returning from app
      setTimeout(() => {
        onPaymentSuccess();
      }, 2500);
    }, 2000);
  };

  const handleGeneralPayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      onPaymentSuccess();
    }, 2000);
  };

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto w-full pb-10">
      <div className="flex items-center gap-2">
        <button 
          onClick={onBack}
          disabled={isProcessing || isRedirecting}
          className="p-2 hover:bg-[#f1f3f9] rounded-full transition-colors disabled:opacity-30"
        >
          <ChevronLeft className="text-[#44474e]" />
        </button>
        <h2 className="text-2xl font-google-sans font-medium text-[#1a1c1e]">Payment Checkout</h2>
      </div>

      <div className="bg-white rounded-[40px] border border-[#e1e2ec] overflow-hidden flex flex-col shadow-sm relative">
        <AnimatePresence>
          {isRedirecting && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="w-20 h-20 bg-[#f1f3f9] rounded-full flex items-center justify-center mb-6">
                <div className="w-12 h-12 border-4 border-[#005fb0] border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h3 className="text-xl font-google-sans font-medium mb-2">Redirecting to {selectedApp === 'GPAY' ? 'Google Pay' : 'PhonePe'}...</h3>
              <p className="text-[#74777f] text-sm">Please complete the payment in your UPI app to proceed.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header - Amount Display */}
        <div className="p-10 text-center bg-[#f8f9fa] border-b border-[#e1e2ec]">
          <p className="text-[#74777f] text-xs uppercase tracking-[0.2em] font-bold mb-2">Total Amount</p>
          <h3 className="text-6xl font-google-sans font-bold text-[#001c38]">₹{calculateTotal()}</h3>
        </div>

        {/* Payment Tabs */}
        <div className="px-8 pt-8">
          <div className="flex p-1.5 bg-[#f1f3f9] rounded-[24px]">
            <button
              onClick={() => setMethod('UPI_APPS')}
              className={`flex-1 py-3 px-4 rounded-[18px] text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                method === 'UPI_APPS' ? 'bg-white text-[#005fb0] shadow-sm' : 'text-[#44474e]'
              }`}
            >
              <Smartphone size={16} />
              UPI Apps
            </button>
            <button
              onClick={() => setMethod('UPI_QR')}
              className={`flex-1 py-3 px-4 rounded-[18px] text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                method === 'UPI_QR' ? 'bg-white text-[#005fb0] shadow-sm' : 'text-[#44474e]'
              }`}
            >
              <QrCode size={16} />
              Scan QR
            </button>
            <button
              onClick={() => setMethod('CARD')}
              className={`flex-1 py-3 px-4 rounded-[18px] text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                method === 'CARD' ? 'bg-white text-[#005fb0] shadow-sm' : 'text-[#44474e]'
              }`}
            >
              <CreditCard size={16} />
              Card
            </button>
          </div>
        </div>

        {/* Method Content */}
        <div className="p-8">
          {method === 'UPI_APPS' && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-[#44474e] ml-2 mb-4">Select your UPI App</p>
              
              <button 
                onClick={() => handleAppPayment('GPAY')}
                className="w-full p-5 bg-white border border-[#e1e2ec] rounded-[24px] flex items-center justify-between hover:border-[#005fb0] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#f1f3f9] rounded-xl flex items-center justify-center text-[#005fb0] font-bold text-lg">G</div>
                  <span className="font-google-sans font-medium text-[#1a1c1e]">Google Pay</span>
                </div>
                <ArrowRight size={18} className="text-[#c4c6cf] group-hover:text-[#005fb0] transition-colors" />
              </button>

              <button 
                onClick={() => handleAppPayment('PHONEPE')}
                className="w-full p-5 bg-white border border-[#e1e2ec] rounded-[24px] flex items-center justify-between hover:border-[#005fb0] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#f1f3f9] rounded-xl flex items-center justify-center text-[#6739b7] font-bold text-lg">P</div>
                  <span className="font-google-sans font-medium text-[#1a1c1e]">PhonePe</span>
                </div>
                <ArrowRight size={18} className="text-[#c4c6cf] group-hover:text-[#005fb0] transition-colors" />
              </button>

              <button 
                onClick={() => handleAppPayment('PAYTM')}
                className="w-full p-5 bg-white border border-[#e1e2ec] rounded-[24px] flex items-center justify-between hover:border-[#005fb0] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#f1f3f9] rounded-xl flex items-center justify-center text-[#00baf2] font-bold text-lg">Py</div>
                  <span className="font-google-sans font-medium text-[#1a1c1e]">Paytm</span>
                </div>
                <ArrowRight size={18} className="text-[#c4c6cf] group-hover:text-[#005fb0] transition-colors" />
              </button>
            </div>
          )}

          {method === 'UPI_QR' && (
            <div className="flex flex-col items-center gap-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-6 bg-white border-4 border-[#f1f3f9] rounded-[32px] relative"
              >
                <div className="w-52 h-52 grid grid-cols-10 grid-rows-10 gap-0.5 opacity-90">
                  {Array.from({ length: 100 }).map((_, i) => (
                    <div key={i} className={`rounded-[1px] ${Math.random() > 0.6 ? 'bg-black' : 'bg-transparent'}`} />
                  ))}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 bg-white p-2 rounded-xl shadow-md flex items-center justify-center">
                      <div className="w-full h-full bg-[#005fb0] rounded-lg flex items-center justify-center text-white text-[10px] font-bold">BHIM</div>
                    </div>
                  </div>
                </div>
              </motion.div>
              <div className="text-center">
                <p className="font-google-sans font-medium text-[#1a1c1e]">Scan with any UPI App</p>
                <p className="text-xs text-[#74777f] mt-1 uppercase tracking-widest font-bold">Transaction ID: PT-{Math.floor(Math.random() * 900000)}</p>
              </div>
            </div>
          )}

          {method === 'CARD' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#74777f] ml-1 uppercase tracking-widest">Card Number</label>
                <div className="bg-[#f1f3f9] p-5 rounded-[20px] flex items-center gap-4 border border-transparent focus-within:border-[#005fb0] focus-within:bg-white transition-all">
                  <CreditCard size={20} className="text-[#74777f]" />
                  <input type="text" placeholder="XXXX XXXX XXXX XXXX" className="bg-transparent border-none outline-none w-full font-google-sans font-medium tracking-widest" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#74777f] ml-1 uppercase tracking-widest">Expiry Date</label>
                  <input type="text" placeholder="MM/YY" className="bg-[#f1f3f9] p-5 rounded-[20px] border border-transparent focus:border-[#005fb0] focus:bg-white outline-none w-full font-google-sans font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#74777f] ml-1 uppercase tracking-widest">CVV</label>
                  <input type="password" placeholder="***" className="bg-[#f1f3f9] p-5 rounded-[20px] border border-transparent focus:border-[#005fb0] focus:bg-white outline-none w-full font-google-sans font-medium" />
                </div>
              </div>
              <button
                onClick={handleGeneralPayment}
                disabled={isProcessing}
                className={`w-full py-5 rounded-[24px] font-google-sans font-medium text-lg transition-all flex items-center justify-center gap-3 ${
                  isProcessing ? 'bg-[#f1f3f9] text-[#74777f]' : 'bg-[#005fb0] text-white hover:bg-[#004a8a] shadow-xl shadow-blue-100'
                }`}
              >
                {isProcessing ? (
                  <div className="w-6 h-6 border-2 border-[#005fb0] border-t-transparent rounded-full animate-spin"></div>
                ) : 'Pay ₹' + calculateTotal()}
              </button>
            </div>
          )}
        </div>

        {/* Processing State Overlay for UPI/QR */}
        <AnimatePresence>
          {isProcessing && method !== 'CARD' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-40 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="w-24 h-24 relative mb-6">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    className="text-[#f1f3f9]"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray="251.2"
                    strokeDashoffset="251.2"
                    className="text-[#005fb0] transition-all duration-1000"
                    style={{ strokeDashoffset: '100' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-4 h-4 bg-[#005fb0] rounded-full animate-ping"></div>
                </div>
              </div>
              <h3 className="text-xl font-google-sans font-medium mb-2">Verifying Payment</h3>
              <p className="text-[#74777f] text-sm">Please wait while we confirm your transaction with the bank.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 flex flex-col items-center gap-4 text-[#74777f]">
        <div className="flex items-center gap-2 text-xs font-medium bg-[#f1f3f9] px-6 py-2.5 rounded-full">
          <ShieldCheck size={14} className="text-green-600" />
          PCI-DSS Compliant • 256-bit Secure Encryption
        </div>
        <p className="text-[10px] text-center max-w-xs leading-relaxed">
          By clicking pay, you agree to our Terms of Service. Payment processing is handled by PrintGo Smart Payments gateway.
        </p>
      </div>
    </div>
  );
};

export default PaymentScreen;
