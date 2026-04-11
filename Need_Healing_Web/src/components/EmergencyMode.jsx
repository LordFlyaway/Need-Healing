import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

export default function EmergencyMode({ user, onClose }) {
  const [step, setStep] = useState(1);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    let timer;
    if (step === 2 && countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (step === 2 && countdown === 0) {
      setStep(3); // Ambulance Dispatched
    }
    return () => clearTimeout(timer);
  }, [step, countdown]);

  const handleSOS = () => setStep(2);

  return (
    <motion.div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 pointer-events-none bg-red-500/10 animate-pulse"></div>
      
      <motion.div 
        className="w-full max-w-md bg-[#0f172a] border border-red-500/30 rounded-2xl p-6 shadow-[0_0_50px_rgba(239,68,68,0.3)] relative overflow-hidden"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
        >
          ✕
        </button>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                🚑
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Emergency Hub</h2>
              <p className="text-slate-400 text-sm mb-6">Paramedics can scan this code to bypass authentication and view critical vitals/allergies instantly.</p>
              
              <div className="bg-white p-4 rounded-xl inline-block mx-auto mb-6 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                <QRCodeSVG value={`EMERGENCY:${user.patient_id}`} size={160} level="H" fgColor="#ef4444" />
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6 text-left">
                <div className="text-xs text-red-400 font-bold uppercase tracking-wider mb-1">Critical Medical Info Exposed</div>
                <div className="text-sm font-mono text-white">Blood Type: O+</div>
                <div className="text-sm font-mono text-white">Allergies: Penicillin</div>
              </div>

              <button 
                onClick={handleSOS}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-lg shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all hover:scale-[1.02] active:scale-95"
              >
                CALL AMBULANCE (SOS)
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center py-8">
              <h2 className="text-3xl font-bold text-red-500 mb-2">DISPATCHING...</h2>
              <div className="text-6xl font-black text-white my-8 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                {countdown}
              </div>
              <p className="text-slate-300 text-sm mb-8">Transmitting GPS coordinates to nearest dispatch center.</p>
              <button 
                onClick={() => setStep(1)}
                className="py-3 px-8 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all"
              >
                CANCEL SOS
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-6">
              <div className="w-24 h-24 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 border border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.5)]">
                ✓
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Ambulance Dispatched</h2>
              <p className="text-green-400 font-mono text-sm mb-6">ETA: 6 Minutes</p>
              <div className="bg-slate-800/50 p-4 rounded-xl text-left mb-6 border border-slate-700">
                <p className="text-sm text-slate-300 mb-2">• Stay where you are.</p>
                <p className="text-sm text-slate-300 mb-2">• Keep the QR code above visible for paramedics.</p>
                <p className="text-sm text-slate-300">• Dispatch has been given your medical profile.</p>
              </div>
              <button 
                onClick={onClose}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
