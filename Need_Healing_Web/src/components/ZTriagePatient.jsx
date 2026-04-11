import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebRTC } from '../hooks/useWebRTC';
import { simulateEdgeAI_NLP } from '../utils/ZTriageAI';

export default function ZTriagePatient({ user, patientHistory = [] }) {
  const { connectionState, joinTriageQueue, sendData, disconnect } = useWebRTC();
  const [symptoms, setSymptoms] = useState('');
  const [clinicId, setClinicId] = useState('');
  const [triageStatus, setTriageStatus] = useState('idle'); // idle, scoring, sent
  const [scoreResult, setScoreResult] = useState(null);

  useEffect(() => {
    return () => disconnect();
  }, []);

  const handleConnect = async () => {
    if (!clinicId.trim()) return;
    const joined = await joinTriageQueue(clinicId);
    if (!joined) alert("Could not find that clinic's active triage queue.");
  };

  const handleSubmit = () => {
    if (!symptoms.trim() || connectionState !== 'connected') return;

    setTriageStatus('scoring');
    
    // Simulate Edge computing delay for UI effect
    setTimeout(() => {
      // Run deterministic NLP locally on the client (Zero-Server)
      const aiResult = simulateEdgeAI_NLP(symptoms, patientHistory);
      setScoreResult(aiResult);
      
      const payload = {
        type: 'TRIAGE_SUBMISSION',
        patientId: user.patient_id,
        patientName: user.name,
        timestamp: Date.now(),
        rawSymptoms: symptoms,
        severityScore: aiResult.score,
        clinicalSummary: aiResult.summary
      };

      // Send 100% via WebRTC Data Channel
      sendData(payload);
      setTriageStatus('sent');
    }, 1500);
  };

  return (
    <div className="card w-full relative overflow-hidden bg-gradient-to-br from-[#1a0b1c] to-slate-900 border border-fuchsia-900/50">
      <div className="absolute inset-0 pointer-events-none bg-fuchsia-500/5"></div>
      
      <h2 className="text-xl font-bold bg-gradient-to-r from-fuchsia-400 to-rose-400 bg-clip-text text-transparent mb-4 flex items-center gap-2">
        <span>⚡</span> Z-Triage (Zero-Server Edge Node)
      </h2>
      <p className="text-sm text-slate-400 mb-6 relative z-10">
        Connect directly to a clinic's peer-to-peer mesh network. Your symptom data is evaluated linearly on your device using Edge AI and bypasses standard cloud queues for instant prioritization.
      </p>

      {connectionState !== 'connected' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 relative z-10">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Enter Clinic ID (e.g., DocUID)" 
              value={clinicId}
              onChange={e => setClinicId(e.target.value)}
              className="input-field flex-1"
            />
            <button 
              onClick={handleConnect}
              disabled={connectionState !== 'disconnected' && connectionState !== 'failed'}
              className="btn-primary whitespace-nowrap bg-fuchsia-600 hover:bg-fuchsia-500 border-fuchsia-500"
            >
              Connect to Mesh
            </button>
          </div>
          <div className="text-xs font-mono text-slate-500 mt-2">
             Connection Status: <span className={connectionState === 'connecting' ? 'text-yellow-400' : 'text-slate-400'}>{connectionState.toUpperCase()}</span>
          </div>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          {triageStatus === 'idle' && (
            <motion.div key="input" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-green-400 uppercase tracking-widest flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span> P2P Data Channel Linked</span>
                <button onClick={disconnect} className="text-xs text-slate-500 hover:text-white">Disconnect</button>
              </div>
              
              <div className="relative">
                <textarea 
                  value={symptoms}
                  onChange={e => setSymptoms(e.target.value)}
                  placeholder="Describe your symptoms in detail (e.g., 'Severe chest pain radiating to left arm since 20 mins ago')..."
                  className="w-full bg-slate-900/80 border border-fuchsia-900/50 p-4 rounded-xl text-white resize-none h-32 focus:border-fuchsia-500"
                ></textarea>
                <button className="absolute bottom-4 right-4 w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-xl hover:bg-slate-700 hover:text-fuchsia-400 transition-colors">
                  🎙️
                </button>
              </div>

              <button 
                onClick={handleSubmit}
                disabled={!symptoms.trim()}
                className="w-full py-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-xl text-lg shadow-[0_0_20px_rgba(192,38,211,0.4)] transition-all hover:scale-[1.02] active:scale-95"
              >
                Execute Edge Triage & Transmit
              </button>
            </motion.div>
          )}

          {triageStatus === 'scoring' && (
            <motion.div key="scoring" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 flex flex-col items-center relative z-10">
              <div className="text-4xl animate-bounce mb-4">🧠</div>
              <h3 className="text-xl font-bold text-fuchsia-400 animate-pulse">Computing Edge NLP...</h3>
              <p className="text-slate-400 text-sm mt-2 font-mono">Bypassing server queues. Calculating deterministics.</p>
            </motion.div>
          )}

          {triageStatus === 'sent' && scoreResult && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 relative z-10">
              <div className="bg-slate-900/80 p-6 rounded-xl border border-fuchsia-900 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Transmission Successful</h3>
                  <p className="text-sm text-slate-400">Your vitals and NLP summary are on the doctor's screen instantly.</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-fuchsia-400 uppercase tracking-widest mb-1">Calculated Priority</div>
                  <div className="text-3xl font-black text-white">{scoreResult.score}<span className="text-lg text-slate-500">/10</span></div>
                </div>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">Edge Node Clinical Payload</h4>
                <p className="text-sm font-mono text-fuchsia-200/80 leading-relaxed">{scoreResult.summary}</p>
              </div>
              
              <button 
                onClick={() => { setTriageStatus('idle'); setSymptoms(''); }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all"
              >
                Send Additional Updates
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
