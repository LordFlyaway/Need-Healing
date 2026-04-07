import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, doc, getDocs, orderBy } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import RecordForm from './RecordForm';
import RecordTimeline from './RecordTimeline';
import QRScanner from './QRScanner';

export default function DoctorDashboard({ user }) {
  const [scannedId, setScannedId] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [requestState, setRequestState] = useState('idle'); // idle, pending, denied
  const [showScanner, setShowScanner] = useState(false);
  const [activeTab, setActiveTab] = useState('records'); // records, add_record
  const [patientInfo, setPatientInfo] = useState(null);
  const [patientUid, setPatientUid] = useState(null);

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
          <div className="card doctor-guide-card">
            <h3 className="font-bold mb-3">How it works</h3>
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
            <button onClick={handleDisconnect} className="btn-danger">
              Disconnect
            </button>
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
              <RecordTimeline userId={patientUid} showAddButton={false} />
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