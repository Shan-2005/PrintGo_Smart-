
import React, { useState } from 'react';
import { PrintSettings } from '../types';
import { ChevronLeft, ShieldCheck, Loader2, AlertCircle, CheckCircle2, CreditCard, Smartphone, QrCode, IndianRupee } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PaymentScreenProps {
  settings: PrintSettings;
  amount: string;
  onPaymentSuccess: (paymentId?: string) => void;
  onBack: () => void;
}

type PaymentState = 'READY' | 'PROCESSING' | 'SUCCESS' | 'ERROR';

const PaymentScreen: React.FC<PaymentScreenProps> = ({ settings, amount, onPaymentSuccess, onBack }) => {
  const [paymentState, setPaymentState] = useState<PaymentState>('READY');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handlePay = async () => {
    setPaymentState('PROCESSING');
    setErrorMessage('');

    try {
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      setPaymentState('SUCCESS');
      setTimeout(() => {
        onPaymentSuccess(`pay_${Date.now()}`);
      }, 1200);
    } catch (error: any) {
      setPaymentState('ERROR');
      setErrorMessage(error.message || 'Payment failed. Please try again.');
    }
  };

  const renderStateContent = () => {
    switch (paymentState) {
      case 'PROCESSING':
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 px-8 text-center"
          >
            <div className="w-20 h-20 bg-[#f1f3f9] rounded-full flex items-center justify-center mb-6">
              <Loader2 size={36} className="text-[#005fb0] animate-spin" />
            </div>
            <h3 className="text-xl font-google-sans font-medium mb-2 text-[#1a1c1e]">Processing Payment</h3>
            <p className="text-[#74777f] text-sm">Please wait while we confirm your payment...</p>
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
    <>
      {/* ── Scrollable content area ── */}
      <div className="flex flex-col gap-5 max-w-xl mx-auto w-full pb-28 px-1">

        {/* Header */}
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

        {/* Card */}
        <div className="bg-white rounded-[40px] border border-[#e1e2ec] overflow-hidden flex flex-col shadow-sm">
          {/* Amount */}
          <div className="p-8 text-center bg-[#f8f9fa] border-b border-[#e1e2ec]">
            <p className="text-[#74777f] text-xs uppercase tracking-[0.2em] font-bold mb-2">Total Amount</p>
            <h3 className="text-5xl font-google-sans font-bold text-[#001c38]">₹{amount}</h3>
          </div>

          {/* Dynamic content */}
          <AnimatePresence mode="wait">
            {paymentState !== 'READY' ? (
              <motion.div key={paymentState}>{renderStateContent()}</motion.div>
            ) : (
              <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
                {/* Payment icons */}
                <div className="flex items-center justify-center gap-5 mb-6">
                  {[
                    { icon: <Smartphone size={20} className="text-[#005fb0]" />, label: 'UPI' },
                    { icon: <CreditCard size={20} className="text-[#005fb0]" />, label: 'Card' },
                    { icon: <QrCode size={20} className="text-[#005fb0]" />, label: 'QR' },
                    { icon: <IndianRupee size={20} className="text-[#005fb0]" />, label: 'NetBank' },
                  ].map(({ icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1.5 text-[#74777f]">
                      <div className="w-12 h-12 bg-[#f1f3f9] rounded-2xl flex items-center justify-center">{icon}</div>
                      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Order summary */}
                <div className="bg-[#f8f9fa] p-4 rounded-[20px] space-y-3">
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Security badge */}
        <div className="flex flex-col items-center gap-2 text-[#74777f]">
          <div className="flex items-center gap-2 text-xs font-medium bg-[#f1f3f9] px-5 py-2 rounded-full">
            <ShieldCheck size={13} className="text-green-600" />
            Secured • PCI-DSS Compliant
          </div>
        </div>
      </div>

      {/* ── Sticky Pay Button — ALWAYS visible at bottom ── */}
      {paymentState === 'READY' && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 px-4 py-4 bg-white/90 backdrop-blur-lg border-t border-[#e1e2ec]"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        >
          <div className="max-w-xl mx-auto">
            <button
              onClick={handlePay}
              className="w-full py-5 rounded-[24px] font-google-sans font-medium text-lg transition-all flex items-center justify-center gap-3 bg-[#005fb0] text-white hover:bg-[#004a8a] shadow-xl shadow-blue-200 active:scale-[0.98]"
            >
              <ShieldCheck size={22} />
              Pay ₹{amount}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PaymentScreen;
