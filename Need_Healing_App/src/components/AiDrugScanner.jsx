import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AiDrugScanner() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle'); // idle, scanning, analyzing, complete
  const [result, setResult] = useState(null);

  const simulateAnalysis = () => {
    if (!query.trim()) return;
    setStatus('scanning');
    
    setTimeout(() => {
      setStatus('analyzing');
      setTimeout(() => {
        // Mock a stunning AI response for the user
        setResult({
          drugName: query.toUpperCase(),
          confidence: '99.4%',
          activeIngredient: 'Amoxicillin Trihydrate',
          interactions: [
             { level: 'High', msg: 'Interacts with Warfarin (reduces effectiveness)' },
             { level: 'None', msg: 'No known interaction with your active prescriptions' }
          ],
          sideEffects: ['Nausea', 'Skin Rash', 'Dizziness'],
          authenticity: 'Verified ✨',
          actionRequired: false
        });
        setStatus('complete');
      }, 2500);
    }, 1500);
  };

  return (
    <div className="card w-full relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
      <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-4 flex items-center gap-2">
        <span>🧠</span> AI Drug Scanner & Checker
      </h2>
      <p className="text-sm text-slate-400 mb-6">Enter a medication name or simulated barcode to run a deep AI analysis against your health profile.</p>

      {status === 'idle' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
          <input 
            type="text" 
            placeholder="e.g. Amoxicillin 500mg" 
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="input-field w-full text-lg p-4 bg-slate-900/50 border border-slate-700 focus:border-cyan-500 rounded-xl transition-all"
            onKeyDown={e => e.key === 'Enter' && simulateAnalysis()}
          />
          <button 
            onClick={simulateAnalysis}
            disabled={!query.trim()}
            className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/50 py-4 rounded-xl font-bold text-lg shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all hover:shadow-[0_0_25px_rgba(6,182,212,0.4)]"
          >
            Run Deep AI Scan
          </button>
        </motion.div>
      )}

      {(status === 'scanning' || status === 'analyzing') && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 flex flex-col items-center">
          <div className="relative w-32 h-32 mb-6">
            <div className="absolute inset-0 border-4 border-cyan-500/30 rounded-full animate-ping"></div>
            <div className="absolute inset-2 border-4 border-cyan-500 rounded-full border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-3xl">
              {status === 'scanning' ? '📷' : '🧠'}
            </div>
          </div>
          <h3 className="text-xl font-bold text-cyan-400 animate-pulse">
            {status === 'scanning' ? 'Optical Recognition Active...' : 'Cross-referencing Medical Database...'}
          </h3>
          <p className="text-slate-400 text-sm mt-2 font-mono">
            {status === 'scanning' ? 'Analyzing visual signatures & text...' : 'Checking interactions against 14 active records...'}
          </p>
        </motion.div>
      )}

      {status === 'complete' && result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center justify-between bg-slate-800/80 p-4 rounded-xl border border-slate-700">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Detected Match</div>
              <div className="text-2xl font-bold text-white">{result.drugName}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-cyan-400 uppercase tracking-widest mb-1">Confidence</div>
              <div className="text-xl font-mono text-cyan-300">{result.confidence}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
               <h4 className="font-semibold text-slate-300 mb-2">Key Ingredients</h4>
               <p className="text-cyan-400 font-mono text-sm">{result.activeIngredient}</p>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
               <h4 className="font-semibold text-slate-300 mb-2">Authenticity</h4>
               <p className="text-green-400 font-mono text-sm">{result.authenticity}</p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-white">AI Interaction Analysis</h4>
            {result.interactions.map((int, idx) => (
              <div key={idx} className={`p-3 rounded-lg border ${int.level === 'High' ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'} flex gap-3 text-sm`}>
                <span className="text-xl">{int.level === 'High' ? '⚠️' : '✅'}</span>
                <div>
                  <div className={`font-semibold ${int.level === 'High' ? 'text-red-400' : 'text-green-400'}`}>
                    {int.level === 'High' ? 'Warning: High Interaction Risk' : 'Safe to Use'}
                  </div>
                  <div className="text-slate-300">{int.msg}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
             <h4 className="font-semibold text-orange-400 mb-2">Common Side Effects</h4>
             <div className="flex flex-wrap gap-2">
               {result.sideEffects.map(sf => (
                 <span key={sf} className="px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full text-xs border border-orange-500/30">{sf}</span>
               ))}
             </div>
          </div>

          <button 
            onClick={() => { setStatus('idle'); setQuery(''); setResult(null); }}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all"
          >
            Scan Another Medication
          </button>
        </motion.div>
      )}
    </div>
  );
}
