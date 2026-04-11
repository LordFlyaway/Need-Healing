import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, doc, getDocs, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import RecordForm from './RecordForm';
import RecordTimeline from './RecordTimeline';
import QRScanner from './QRScanner';
import { useWebRTC } from '../hooks/useWebRTC';

export default function DoctorDashboard({ user }) {
  const [scannedId, setScannedId] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [requestState, setRequestState] = useState('idle'); // idle, pending, denied
  const [showScanner, setShowScanner] = useState(false);
  const [activeTab, setActiveTab] = useState('records'); // records, add_record
  const [patientInfo, setPatientInfo] = useState(null);
  const [patientUid, setPatientUid] = useState(null);

  // Z-Triage Queue State
  const { connectionState, messages, createTriageQueue, disconnect } = useWebRTC();
  const [triageQueue, setTriageQueue] = useState([]);
  
  useEffect(() => {
    // Process incoming P2P WebRTC data payloads
    if (messages.length > 0) {
      const latest = messages[messages.length - 1]; // Assume latest message
      if (latest.type === 'TRIAGE_SUBMISSION') {
        setTriageQueue(prev => {
          // Avoid duplicates by patientId
          const filtered = prev.filter(p => p.patientId !== latest.patientId);
          const newQueue = [...filtered, latest];
          // Deterministic Auto-sorting by severity score
          return newQueue.sort((a, b) => b.severityScore - a.severityScore);
        });
        toast.warning(`New Triage Alert: Priority ${latest.severityScore}/10 for ${latest.patientName}`);
      }
    }
  }, [messages]);

  useEffect(() => {
    return () => disconnect();
  }, []);

  // Lookup patient UID from patient_id hash
  const findPatientUid = async (patientIdHash) => {
    const q = query(collection(db, "users"), where("patient_id", "==", patientIdHash));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const patientData = snap.docs[0].data();
      setPatientUid(patientData.uid);
      setPatientInfo(patientData);
      return patientData.uid;
    }
    return null;
  };

  const requestAccess = async (targetId = scannedId) => {
    if (!targetId) return;
    setRequestState('pending');

    try {
      const docRef = await addDoc(collection(db, "access_requests"), {
        patientId: targetId,
        doctorId: user.uid,
        doctorName: `Dr. ${user.name}`,
        type: "read",
        status: "pending",
        timestamp: new Date()
      });

      // Listen for the patient to approve or deny
      const unsubscribe = onSnapshot(doc(db, "access_requests", docRef.id), async (docSnap) => {
        const data = docSnap.data();
        if (!data) return;

        if (data.status === 'approved') {
          await findPatientUid(targetId);
          setActiveSession({ patientId: targetId, requestId: docRef.id, unsubscribe });
          setRequestState('idle');
          toast.success("Access granted by patient!");
        }
        if (data.status === 'terminated') {
          setActiveSession(null);
          setPatientUid(null);
          setPatientInfo(null);
          setRequestState('idle');
          setScannedId('');
          unsubscribe();
          toast.info("Session terminated securely.");
        }
        if (data.status === 'denied') {
          setRequestState('denied');
          setTimeout(() => setRequestState('idle'), 3000);
          unsubscribe();
          toast.error("Access request denied by patient.");
        }
      });
    } catch (err) {
      console.error("Error requesting access:", err);
      setRequestState('idle');
      toast.error("Error requesting access");
    }
  };

  const handleQRScan = (patientId) => {
    setScannedId(patientId);
    setShowScanner(false);
    requestAccess(patientId);
  };

  const submitRecord = async (recordPayload) => {
    if (!activeSession) return;

    await addDoc(collection(db, "access_requests"), {
      patientId: activeSession.patientId,
      doctorId: user.uid,
      doctorName: `Dr. ${user.name}`,
      type: "write",
      status: "pending",
      payload: {
        ...recordPayload,
        addedBy: user.uid,
        addedByName: `Dr. ${user.name}`,
      }
    });
  };

  const handleDeleteRequest = async (record) => {
    if (!activeSession) return;
    try {
      await addDoc(collection(db, "access_requests"), {
        patientId: activeSession.patientId,
        doctorId: user.uid,
        doctorName: `Dr. ${user.name}`,
        type: "delete",
        status: "pending",
        payload: record,
        timestamp: new Date()
      });
      toast.success('Delete request sent to patient.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to send delete request');
    }
  };

  const handleDisconnect = () => {
    if (activeSession && activeSession.unsubscribe) {
      activeSession.unsubscribe();
    }
    setActiveSession(null);
    setPatientUid(null);
    setPatientInfo(null);
    setScannedId('');
    setActiveTab('records');
    toast.info("Disconnected from patient session.");
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {showScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {!activeSession ? (
        <div className="doctor-connect-section">
          <div className="card doctor-terminal-card">
            <div className="doctor-terminal-header">
              <div className="doctor-terminal-icon">🔗</div>
              <div>
                <h2 className="text-xl font-bold">Patient Terminal</h2>
                <p className="text-sm text-text3 mt-1">Scan a patient's QR code or enter their ID hash to request a live session.</p>
              </div>
            </div>

            <div className="flex gap-4 mb-6 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 items-center justify-between">
              <div>
                <h3 className="font-bold text-fuchsia-400">Z-Triage Mesh</h3>
                <p className="text-xs text-slate-400 mt-1">Host a zero-server peer-to-peer triage queue. ID: <code className="bg-slate-800 text-fuchsia-300 px-2 py-0.5 rounded">{user.uid}</code></p>
              </div>
              <button 
                onClick={() => createTriageQueue(user.uid)}
                disabled={connectionState !== 'disconnected' && connectionState !== 'failed'}
                className={`py-2 px-4 rounded-lg font-bold text-sm transition-all ${connectionState === 'connected' ? 'bg-fuchsia-900/50 text-fuchsia-400 border border-fuchsia-500/50' : 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white'}`}
              >
                {connectionState === 'connected' ? 'Mesh Active ✨' : connectionState === 'connecting' ? 'Initializing...' : 'Host Triage Node'}
              </button>
            </div>

            <div className="doctor-input-group">
              <div className="doctor-input-row">
                <input
                  type="text"
                  value={scannedId}
                  onChange={e => setScannedId(e.target.value)}
                  placeholder="Patient ID Hash…"
                  className="input-field flex-1"
                  disabled={requestState === 'pending'}
                />
                <button
                  onClick={() => setShowScanner(true)}
                  className="btn-scan"
                  disabled={requestState === 'pending'}
                  title="Scan QR Code"
                >
                  📷 Scan QR
                </button>
              </div>

              {requestState === 'pending' ? (
                <div className="doctor-pending-state">
                  <div className="doctor-pending-pulse"></div>
                  <div>
                    <h3 className="font-semibold">Waiting for patient approval…</h3>
                    <p className="text-sm text-text3 mt-1">The patient will see your request on their device. Please wait.</p>
                  </div>
                </div>
              ) : requestState === 'denied' ? (
                <div className="doctor-denied-state">
                  <span className="doctor-denied-icon">✕</span>
                  <div>
                    <h3 className="font-semibold">Access Denied</h3>
                    <p className="text-sm mt-1">The patient has denied your access request.</p>
                  </div>
                  <button onClick={() => setRequestState('idle')} className="btn-primary text-sm">Try Again</button>
                </div>
              ) : (
                <button
                  onClick={requestAccess}
                  disabled={!scannedId}
                  className="btn-primary w-full doctor-connect-btn"
                >
                  🔐 Request Secure Access
                </button>
              )}
            </div>
          </div>

          {/* Quick Guide */}
          <div className="card doctor-guide-card relative overflow-hidden">
            <h3 className="font-bold mb-3 flex items-center justify-between">
               <span>How it works</span>
               {connectionState === 'connected' && <span className="text-xs bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/40 px-2 py-1 rounded flex items-center gap-2"><span className="w-2 h-2 bg-fuchsia-400 rounded-full animate-pulse"></span> Z-Triage Live</span>}
            </h3>
            <div className="doctor-guide-steps">
              <div className="doctor-guide-step">
                <div className="doctor-guide-num">1</div>
                <div>
                  <div className="font-medium">Scan or Enter ID</div>
                  <div className="text-sm text-text3">Scan the patient's QR code or enter their ID hash manually</div>
                </div>
              </div>
              <div className="doctor-guide-step">
                <div className="doctor-guide-num">2</div>
                <div>
                  <div className="font-medium">Patient Approves</div>
                  <div className="text-sm text-text3">The patient sees your request in real-time and can approve or deny it</div>
                </div>
              </div>
              <div className="doctor-guide-step">
                <div className="doctor-guide-num">3</div>
                <div>
                  <div className="font-medium">View & Update Records</div>
                  <div className="text-sm text-text3">Access the patient timeline and submit new records for approval</div>
                </div>
              </div>
            </div>

            {/* Smart Queue Display for Z-Triage */}
            {triageQueue.length > 0 && (
              <div className="mt-8 border-t border-slate-700/50 pt-6">
                <h3 className="font-bold mb-4 text-fuchsia-400 flex items-center gap-2">
                  <span>🧠</span> Active Edge Triage Queue
                </h3>
                <div className="space-y-3">
                  <AnimatePresence>
                    {triageQueue.map((patient) => (
                      <motion.div 
                        key={patient.patientId}
                        layout 
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className={`p-4 rounded-xl border flex items-start gap-4 ${
                          patient.severityScore >= 8 ? 'bg-red-900/20 border-red-500/50' : 
                          patient.severityScore >= 5 ? 'bg-orange-900/20 border-orange-500/50' : 
                          'bg-slate-800 border-slate-700'
                        }`}
                      >
                        <div className={`w-12 h-12 flex items-center justify-center rounded-lg font-black text-xl flex-shrink-0 ${
                          patient.severityScore >= 8 ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.6)]' : 
                          patient.severityScore >= 5 ? 'bg-orange-500 text-white' : 
                          'bg-slate-700 text-slate-300'
                        }`}>
                          {patient.severityScore}
                        </div>
                        <div className="flex-1">
                           <div className="flex justify-between items-center mb-1">
                             <h4 className="font-bold text-white text-lg">{patient.patientName}</h4>
                             <span className="text-xs text-slate-400 font-mono">{new Date(patient.timestamp).toLocaleTimeString()}</span>
                           </div>
                           <p className="text-sm font-mono text-fuchsia-200/80 mb-3 leading-relaxed">{patient.clinicalSummary}</p>
                           <button 
                             onClick={() => handleQRScan(patient.patientId)}
                             className="w-full py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-bold rounded-lg transition-colors"
                           >
                             Pull Records & Connect
                           </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="doctor-session-active">
          {/* Session Header */}
          <div className="doctor-session-header card">
            <div className="doctor-session-info">
              <div className="doctor-session-status">
                <span className="doctor-live-dot"></span>
                <span className="doctor-live-text">LIVE SESSION</span>
              </div>
              {patientInfo && (
                <div className="doctor-patient-info">
                  <h2 className="text-lg font-bold">{patientInfo.name}</h2>
                  <span className="text-sm text-text3 font-mono">ID: {patientInfo.public_id}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => requestAccess(activeSession.patientId)} className="px-4 py-2 font-bold text-sm rounded bg-indigo-900/40 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-800/60 transition-colors whitespace-nowrap">
                +15m
              </button>
              <button onClick={handleDisconnect} className="btn-danger">
                Disconnect
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="doctor-tabs">
            <button
              onClick={() => setActiveTab('records')}
              className={`doctor-tab ${activeTab === 'records' ? 'active' : ''}`}
            >
              📋 Patient Records
            </button>
            <button
              onClick={() => setActiveTab('add_record')}
              className={`doctor-tab ${activeTab === 'add_record' ? 'active' : ''}`}
            >
              ✏️ Add New Record
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'records' ? (
            patientUid ? (
              <RecordTimeline 
                userId={patientUid} 
                showAddButton={false} 
                viewer="doctor"
                onRequestDelete={handleDeleteRequest}
              />
            ) : (
              <div className="card text-center p-8">
                <div className="timeline-loading-spinner"></div>
                <p className="text-text3 mt-4">Loading patient data…</p>
              </div>
            )
          ) : (
            <div className="card">
              <h2 className="text-lg font-bold mb-2">Submit Record</h2>
              <p className="text-sm text-text3 mb-4">All records require patient approval before being permanently saved to their vault.</p>
              <RecordForm onSubmit={submitRecord} doctorName={`Dr. ${user.name}`} />
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}