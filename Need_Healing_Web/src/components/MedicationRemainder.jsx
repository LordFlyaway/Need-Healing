import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DISPOSAL_METHODS = {
  flushable: { icon: '🚽', text: 'Flushable: Safe to flush down the toilet immediately to prevent accidental ingestion.', style: 'bg-blue-500/10 border-blue-500/30 text-blue-400' },
  trash: { icon: '🗑️', text: 'Household Trash: Mix with unappealing substance (coffee grounds, dirt), seal in bag, and throw away.', style: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
  takeback: { icon: '🏥', text: 'Take-back Program: Drop off at nearest authorized pharmacy or police station receptacle.', style: 'bg-green-500/10 border-green-500/30 text-green-400' }
};

export default function MedicationRemainder() {
  const [activeTab, setActiveTab] = useState('report');
  const [success, setSuccess] = useState(false);

  // Mocked expired prescriptions
  const expiredPrescriptions = [
    { id: 1, name: 'Amoxicillin 500mg', expiredOn: '2023-10-15', disposalType: 'trash' },
    { id: 2, name: 'Oxycodone 5mg', expiredOn: '2023-09-01', disposalType: 'flushable' },
    { id: 3, name: 'Lisinopril 10mg', expiredOn: '2024-01-20', disposalType: 'takeback' }
  ];

  const handleReport = (e) => {
    e.preventDefault();
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="card w-full">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <span className="text-2xl">♻️</span> Safety R&D: Medication Remainder
      </h2>

      <div className="flex gap-2 mb-6 border-b border-slate-700 pb-2 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('report')}
          className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${activeTab === 'report' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}
        >
          Report Leftovers
        </button>
        <button 
          onClick={() => setActiveTab('disposal')}
          className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${activeTab === 'disposal' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}
        >
          Safe Disposal Guides
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'report' && (
          <motion.div key="report" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <p className="text-sm text-slate-400 mb-6">
              Track unused pills after a prescription ends to prevent misuse or environmental harm. Logging remainders helps physicians adjust future prescribed quantities.
            </p>
            
            <form onSubmit={handleReport} className="space-y-4">
               <div>
                  <label className="text-xs text-slate-400 uppercase tracking-widest mb-1 block">Related Prescription</label>
                  <select className="w-full bg-slate-900 border border-slate-700 p-3 rounded-lg text-white appearance-none">
                     <option>Select an expired prescription...</option>
                     {expiredPrescriptions.map(p => (
                       <option key={p.id}>{p.name} (Expired: {p.expiredOn})</option>
                     ))}
                     <option>Other / Manual Entry</option>
                  </select>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs text-slate-400 uppercase tracking-widest mb-1 block">Quantity Left</label>
                    <input type="number" placeholder="e.g. 12" className="w-full bg-slate-900 border border-slate-700 p-3 rounded-lg text-white" required />
                 </div>
                 <div>
                    <label className="text-xs text-slate-400 uppercase tracking-widest mb-1 block">Unit</label>
                    <select className="w-full bg-slate-900 border border-slate-700 p-3 rounded-lg text-white">
                      <option>Pills/Tablets</option>
                      <option>mL (Liquid)</option>
                      <option>Inhalers/Patches</option>
                    </select>
                 </div>
               </div>

               <div>
                 <label className="text-xs text-slate-400 uppercase tracking-widest mb-1 block">Disposal Method Used</label>
                 <select className="w-full bg-slate-900 border border-slate-700 p-3 rounded-lg text-white">
                    <option>Pending Disposal (Need instructions)</option>
                    <option>Flushed down toilet/sink</option>
                    <option>Mixed in household trash</option>
                    <option>Returned to pharmacy take-back program</option>
                 </select>
               </div>

               <button type="submit" className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(22,163,74,0.3)] hover:shadow-[0_0_25px_rgba(22,163,74,0.5)]">
                 {success ? '✓ Logged Successfully' : 'Log Remainder & Ensure Safety'}
               </button>
            </form>
          </motion.div>
        )}

        {activeTab === 'disposal' && (
          <motion.div key="disposal" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
             {expiredPrescriptions.map(p => (
               <div key={p.id} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-start mb-3">
                     <h3 className="font-bold text-white text-lg">{p.name}</h3>
                     <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">Exp: {p.expiredOn}</span>
                  </div>
                  
                  <div className={`p-3 rounded-lg border ${DISPOSAL_METHODS[p.disposalType].style} flex gap-3 text-sm items-start`}>
                     <span className="text-2xl mt-1">{DISPOSAL_METHODS[p.disposalType].icon}</span>
                     <div>
                        <div className="font-bold uppercase tracking-wider text-xs opacity-80 mb-1">Recommended Safety R&D Action</div>
                        <div className="font-medium">{DISPOSAL_METHODS[p.disposalType].text}</div>
                     </div>
                  </div>
               </div>
             ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
