
import React, { useState } from 'react';
import { PrintSettings } from '../types';
import { ChevronLeft, ShieldCheck, Loader2, AlertCircle, CheckCircle2, CreditCard, Smartphone, QrCode, IndianRupee } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentScreenProps {
  settings: PrintSettings;
  amount: string;
  onPaymentSuccess: (paymentId?: string) => void;
  onBack: () => void;
}

type PaymentState = 'READY' | 'CREATING_ORDER' | 'AWAITING_PAYMENT' | 'VERIFYING' | 'SUCCESS' | 'ERROR';

const PaymentScreen: React.FC<PaymentScreenProps> = ({ settings, amount, onPaymentSuccess, onBack }) => {
  const [paymentState, setPaymentState] = useState<PaymentState>('READY');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const openRazorpayCheckout = async () => {
    // DEV BYPASS: Skip actual Razorpay integration to rapidly test Print Agent
    setPaymentState('CREATING_ORDER');
    setErrorMessage('');

    setTimeout(() => {
      setPaymentState('VERIFYING');

      setTimeout(() => {
        setPaymentState('SUCCESS');

        setTimeout(() => {
          onPaymentSuccess(`dev_test_pay_${Date.now()}`);
        }, 1500);
      }, 1000);
    }, 1000);
  };

  const renderStateContent = () => {
    switch (paymentState) {
      case 'CREATING_ORDER':
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 px-8 text-center"
          >
            <div className="w-20 h-20 bg-[#f1f3f9] rounded-full flex items-center justify-center mb-6">
              <Loader2 size={36} className="text-[#005fb0] animate-spin" />
            </div>
            <h3 className="text-xl font-google-sans font-medium mb-2 text-[#1a1c1e]">Preparing Checkout</h3>
            <p className="text-[#74777f] text-sm">Setting up your secure payment...</p>
          </motion.div>
        );

      case 'AWAITING_PAYMENT':
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 px-8 text-center"
          >
            <div className="w-20 h-20 bg-[#dbeafe] rounded-full flex items-center justify-center mb-6">
              <div className="w-4 h-4 bg-[#005fb0] rounded-full animate-ping"></div>
            </div>
            <h3 className="text-xl font-google-sans font-medium mb-2 text-[#1a1c1e]">Complete Payment</h3>
            <p className="text-[#74777f] text-sm">A secure Razorpay window is open. Complete your payment there.</p>
          </motion.div>
        );

      case 'VERIFYING':
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 px-8 text-center"
          >
            <div className="w-24 h-24 relative mb-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-[#f1f3f9]" />
                <circle
                  cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="4" fill="transparent"
                  strokeDasharray="251.2" strokeDashoffset="100"
                  className="text-[#005fb0] transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 bg-[#005fb0] rounded-full animate-ping"></div>
              </div>
            </div>
            <h3 className="text-xl font-google-sans font-medium mb-2 text-[#1a1c1e]">Verifying Payment</h3>
            <p className="text-[#74777f] text-sm">Please wait while we confirm your transaction with the bank.</p>
          </motion.div>
        );

      case 'SUCCESS':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-16 px-8 text-center"
          >
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 size={40} className="text-green-600" />
            </div>
            <h3 className="text-xl font-google-sans font-medium mb-2 text-[#1a1c1e]">Payment Successful!</h3>
            <p className="text-[#74777f] text-sm">Your print job is being prepared...</p>
          </motion.div>
        );

      case 'ERROR':
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-12 px-8 text-center"
          >
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <AlertCircle size={40} className="text-red-500" />
            </div>
            <h3 className="text-xl font-google-sans font-medium mb-2 text-[#1a1c1e]">Payment Failed</h3>
            <p className="text-[#74777f] text-sm mb-8 max-w-xs">{errorMessage}</p>
            <button
              onClick={() => { setPaymentState('READY'); setErrorMessage(''); }}
              className="px-8 py-4 bg-[#005fb0] text-white rounded-full font-google-sans font-medium hover:bg-[#004a8a] transition-all shadow-lg shadow-blue-100"
            >
              Try Again
            </button>
          </motion.div>
        );

      default: // READY
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto w-full pb-10">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          disabled={paymentState !== 'READY' && paymentState !== 'ERROR'}
          className="p-2 hover:bg-[#f1f3f9] rounded-full transition-colors disabled:opacity-30"
        >
          <ChevronLeft className="text-[#44474e]" />
        </button>
        <h2 className="text-2xl font-google-sans font-medium text-[#1a1c1e]">Payment Checkout</h2>
      </div>

      <div className="bg-white rounded-[40px] border border-[#e1e2ec] overflow-hidden flex flex-col shadow-sm relative">
        {/* Header - Amount Display */}
        <div className="p-10 text-center bg-[#f8f9fa] border-b border-[#e1e2ec]">
          <p className="text-[#74777f] text-xs uppercase tracking-[0.2em] font-bold mb-2">Total Amount</p>
          <h3 className="text-6xl font-google-sans font-bold text-[#001c38]">₹{amount}</h3>
        </div>

        {/* Dynamic Content Area */}
        <AnimatePresence mode="wait">
          {paymentState !== 'READY' ? (
            <motion.div key={paymentState}>
              {renderStateContent()}
            </motion.div>
          ) : (
            <motion.div
              key="ready"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-8"
            >
              {/* Payment Method Icons */}
              <div className="flex items-center justify-center gap-6 mb-8">
                <div className="flex flex-col items-center gap-2 text-[#74777f]">
                  <div className="w-14 h-14 bg-[#f1f3f9] rounded-2xl flex items-center justify-center">
                    <Smartphone size={22} className="text-[#005fb0]" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider">UPI</span>
                </div>
                <div className="flex flex-col items-center gap-2 text-[#74777f]">
                  <div className="w-14 h-14 bg-[#f1f3f9] rounded-2xl flex items-center justify-center">
                    <CreditCard size={22} className="text-[#005fb0]" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Card</span>
                </div>
                <div className="flex flex-col items-center gap-2 text-[#74777f]">
                  <div className="w-14 h-14 bg-[#f1f3f9] rounded-2xl flex items-center justify-center">
                    <QrCode size={22} className="text-[#005fb0]" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider">QR</span>
                </div>
                <div className="flex flex-col items-center gap-2 text-[#74777f]">
                  <div className="w-14 h-14 bg-[#f1f3f9] rounded-2xl flex items-center justify-center">
                    <IndianRupee size={22} className="text-[#005fb0]" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider">NetBank</span>
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-[#f8f9fa] p-5 rounded-[24px] mb-8 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#74777f] font-medium">Color Mode</span>
                  <span className="font-semibold text-[#1a1c1e]">{settings.colorMode === 'COLOR' ? 'Full Color' : 'Black & White'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#74777f] font-medium">Paper Size</span>
                  <span className="font-semibold text-[#1a1c1e]">{settings.paperSize}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#74777f] font-medium">Copies</span>
                  <span className="font-semibold text-[#1a1c1e]">{settings.copies}</span>
                </div>
              </div>

              {/* Pay Button */}
              <button
                onClick={openRazorpayCheckout}
                className="w-full py-5 rounded-[24px] font-google-sans font-medium text-lg transition-all flex items-center justify-center gap-3 bg-[#005fb0] text-white hover:bg-[#004a8a] shadow-xl shadow-blue-100 active:scale-[0.98]"
              >
                <ShieldCheck size={22} />
                Pay ₹{amount}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex flex-col items-center gap-4 text-[#74777f]">
        <div className="flex items-center gap-2 text-xs font-medium bg-[#f1f3f9] px-6 py-2.5 rounded-full">
          <ShieldCheck size={14} className="text-green-600" />
          Secured by Razorpay • PCI-DSS Compliant
        </div>
        <p className="text-[10px] text-center max-w-xs leading-relaxed">
          By clicking pay, you agree to our Terms of Service. Payment processing is handled securely by Razorpay.
        </p>
      </div>
    </div>
  );
};

export default PaymentScreen;
