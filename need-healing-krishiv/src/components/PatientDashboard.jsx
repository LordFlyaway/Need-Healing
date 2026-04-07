import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, orderBy, limit, setDoc, deleteDoc } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import RecordTimeline from './RecordTimeline';
import SelfReportForm from './SelfReportForm';
import { ReminderForm } from './ReminderForm';
import { ReminderChecker } from './ReminderChecker';
import { useReminders } from '../hooks/useReminders';

const dummyHealthData = [
  { name: 'Mon', wellness: 85, records: 1 },
  { name: 'Tue', wellness: 88, records: 0 },
  { name: 'Wed', wellness: 86, records: 2 },
  { name: 'Thu', wellness: 92, records: 0 },
  { name: 'Fri', wellness: 90, records: 1 },
  { name: 'Sat', wellness: 95, records: 0 },
  { name: 'Sun', wellness: 98, records: 0 },
];

const SESSION_DURATION_SECONDS = 900; // 15 minutes

const RECORD_TYPE_META = {
  prescription: { icon: '💊', label: 'Prescription', color: '#3b82f6' },
  allergy: { icon: '⚠️', label: 'Allergy', color: '#f59e0b' },
  surgery: { icon: '🩹', label: 'Surgery', color: '#ef4444' },
  diagnosis: { icon: '🩺', label: 'Diagnosis', color: '#8b5cf6' },
  immunization: { icon: '💉', label: 'Immunization', color: '#10b981' },
  lab_result: { icon: '🧪', label: 'Lab Result', color: '#06b6d4' },
  vitals: { icon: '❤️', label: 'Vitals', color: '#ec4899' },
  family_history: { icon: '👨‍👩‍👧', label: 'Family History', color: '#6366f1' },
  visit_note: { icon: '📝', label: 'Visit Note', color: '#78716c' },
  radiology: { icon: '🩻', label: 'Radiology', color: '#a855f7' },
  dental: { icon: '🦷', label: 'Dental', color: '#0ea5e9' },
  mental_health: { icon: '🧠', label: 'Mental Health', color: '#f43f5e' },
  physiotherapy: { icon: '💪', label: 'Physiotherapy', color: '#f97316' },
  device_implant: { icon: '🦿', label: 'Device Implant', color: '#64748b' },
  dietary_plan: { icon: '🥗', label: 'Dietary Plan', color: '#84cc16' },
  symptom: { icon: '🤒', label: 'Current Symptom', color: '#fb923c' },
};

function getRecordTitle(payload) {
  if (!payload) return 'Record';
  if (payload.medication) return payload.medication;
  if (payload.allergen) return payload.allergen;
  if (payload.procedure) return payload.procedure;
  if (payload.condition) return payload.condition;
  if (payload.vaccine) return payload.vaccine;
  if (payload.test_name) return payload.test_name;
  if (payload.chief_complaint) return payload.chief_complaint;
  if (payload.blood_pressure) return `BP: ${payload.blood_pressure}`;
  if (payload.relation) return `${payload.relation}: ${payload.condition || ''}`;
  if (payload.imaging_type) return payload.imaging_type;
  if (payload.session_type) return payload.session_type;
  if (payload.device_type) return payload.device_type;
  if (payload.plan_name) return payload.plan_name;
  if (payload.symptom_name) return payload.symptom_name;
  return payload.label || 'Record';
}

function getRecordSummaryFields(payload) {
  if (!payload) return [];
  const skip = ['type', 'label', 'icon', 'created_at', 'date', 'addedBy', 'addedByName'];
  return Object.entries(payload)
    .filter(([key, val]) => !skip.includes(key) && val && val.toString().trim() !== '')
    .map(([key, val]) => ({
      label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: val,
    }));
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

function formatAuditTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function useCountdown(startedAt, durationSeconds) {
  const [remaining, setRemaining] = useState(durationSeconds);

  useEffect(() => {
    if (!startedAt) return;
    const startMs = startedAt.toDate ? startedAt.toDate().getTime() : new Date(startedAt).getTime();
    const endMs = startMs + durationSeconds * 1000;

    const tick = () => {
      const left = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      setRemaining(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, durationSeconds]);

  return remaining;
}

function SessionCard({ session, onRevoke, isProcessing }) {
  const remaining = useCountdown(session.timestamp, SESSION_DURATION_SECONDS);
  const urgency = remaining < 300;

  return (
    <div className={`active-session-card ${urgency ? 'session-expiring' : ''}`} style={{ animationDelay: '0ms' }}>
      <div className="active-session-info">
        <div className="active-session-avatar">
          {session.doctorName?.charAt(4) || 'D'}
        </div>
        <div>
          <p className="font-bold text-sm">{session.doctorName}</p>
          <p className="text-xs font-mono font-bold active-session-status">
            <span className="active-session-dot"></span>
            LIVE
          </p>
          <div className={`session-countdown ${urgency ? 'countdown-urgent' : ''}`}>
            <span className="countdown-icon">T</span>
            <span className="countdown-value">{formatTime(remaining)}</span>
          </div>
        </div>
      </div>
      <button
        onClick={() => onRevoke(session.id)}
        disabled={isProcessing}
        className="btn-danger text-xs revoke-btn"
      >
        {isProcessing ? '...' : 'Revoke'}
      </button>
    </div>
  );
}

function AuditItem({ event, index }) {
  const icons = {
    access_granted: 'OK',
    access_denied: 'NO',
    access_revoked: 'OFF',
    record_added: 'ADD',
    record_rejected: 'REJ',
    session_expired: 'EXP',
  };
  const colors = {
    access_granted: '#10b981',
    access_denied: '#ef4444',
    access_revoked: '#f59e0b',
    record_added: '#3b82f6',
    record_rejected: '#ef4444',
    session_expired: '#94a3b8',
  };
  const icon = icons[event.event_type] || 'LOG';
  const color = colors[event.event_type] || '#94a3b8';

  return (
    <div
      className="audit-item stagger-in"
      style={{ animationDelay: `${index * 60}ms`, borderLeftColor: color }}
    >
      <div className="audit-item-icon" style={{ color }}>
        {icon}
      </div>
      <div className="audit-item-body">
        <p className="audit-item-message">{event.message}</p>
        <p className="audit-item-time">{formatAuditTime(event.timestamp)}</p>
      </div>
    </div>
  );
}

export default function PatientDashboard({ user }) {
  const [pendingReadRequests, setPendingReadRequests] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [writeRequests, setWriteRequests] = useState([]);
  const [deleteRequests, setDeleteRequests] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [showSelfReport, setShowSelfReport] = useState(false);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [showAudit, setShowAudit] = useState(true);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [emergencyProfile, setEmergencyProfile] = useState({
    blood_group: user.blood_group || '',
    allergies: user.allergies || '',
    emergency_contact_name: user.emergency_contact?.name || '',
    emergency_contact_phone: user.emergency_contact?.phone || '',
  });
  const [savedEmergencyProfile, setSavedEmergencyProfile] = useState({
    blood_group: user.blood_group || '',
    allergies: user.allergies || '',
    emergency_contact_name: user.emergency_contact?.name || '',
    emergency_contact_phone: user.emergency_contact?.phone || '',
  });
  const autoRevokeTimers = useRef({});
  const { reminders, addReminder, toggleReminder } = useReminders(user.uid);
  const emergencyQrUrl = `${window.location.origin}/ambulance?uid=${encodeURIComponent(user.uid)}`;

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      const nextProfile = {
        blood_group: data.blood_group || '',
        allergies: data.allergies || '',
        emergency_contact_name: data.emergency_contact?.name || '',
        emergency_contact_phone: data.emergency_contact?.phone || '',
      };
      setSavedEmergencyProfile(nextProfile);
      setEmergencyProfile(nextProfile);
    });
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const q = query(collection(db, 'access_requests'), where('patientId', '==', user.patient_id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pending = [], sessions = [], writes = [], deletes = [];
      snapshot.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() };
        if (data.status === 'pending' && data.type === 'read') pending.push(data);
        if (data.status === 'approved' && data.type === 'read') sessions.push(data);
        if (data.status === 'pending' && data.type === 'write') writes.push(data);
        if (data.status === 'pending' && data.type === 'delete') deletes.push(data);
      });
      setPendingReadRequests(pending);
      setActiveSessions(sessions);
      setWriteRequests(writes);
      setDeleteRequests(deletes);
    });
    return () => unsubscribe();
  }, [user.patient_id]);

  useEffect(() => {
    activeSessions.forEach((session) => {
      if (autoRevokeTimers.current[session.id]) return;
      const startMs = session.timestamp?.toDate
        ? session.timestamp.toDate().getTime()
        : new Date(session.timestamp || Date.now()).getTime();
      const expiresAt = startMs + SESSION_DURATION_SECONDS * 1000;
      const delay = expiresAt - Date.now();
      if (delay <= 0) {
        endSession(session.id, true);
        return;
      }
      autoRevokeTimers.current[session.id] = setTimeout(() => {
        endSession(session.id, true);
        delete autoRevokeTimers.current[session.id];
      }, delay);
    });

    Object.keys(autoRevokeTimers.current).forEach((id) => {
      if (!activeSessions.find((s) => s.id === id)) {
        clearTimeout(autoRevokeTimers.current[id]);
        delete autoRevokeTimers.current[id];
      }
    });
  }, [activeSessions]);

  useEffect(() => {
    const q = query(
      collection(db, 'users', user.uid, 'audit_log'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const events = [];
      snapshot.forEach((docSnap) => events.push({ id: docSnap.id, ...docSnap.data() }));
      setAuditLog(events);
    });
    return () => unsubscribe();
  }, [user.uid]);

  const logAuditEvent = async (event_type, message) => {
    try {
      await addDoc(collection(db, 'users', user.uid, 'audit_log'), {
        event_type,
        message,
        timestamp: new Date(),
      });
    } catch (e) {
      console.warn('Audit log write failed:', e);
    }
  };

  const markProcessing = (id) =>
    setProcessingIds((prev) => new Set([...prev, id]));
  const unmarkProcessing = (id) =>
    setProcessingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });

  const handleReadRequest = async (req, approved) => {
    markProcessing(req.id);
    try {
      await updateDoc(doc(db, 'access_requests', req.id), {
        status: approved ? 'approved' : 'denied',
        ...(approved ? { timestamp: new Date() } : {}),
      });
      await logAuditEvent(
        approved ? 'access_granted' : 'access_denied',
        approved
          ? `Access granted to ${req.doctorName}`
          : `Access denied to ${req.doctorName}`
      );
      if (approved) toast.success(`Access granted to ${req.doctorName}`);
      else toast.info(`Access denied to ${req.doctorName}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to process request');
    }
    unmarkProcessing(req.id);
  };

  const endSession = async (sessionId, isExpiry = false) => {
    markProcessing(sessionId);
    try {
      const session = activeSessions.find((s) => s.id === sessionId);
      await updateDoc(doc(db, 'access_requests', sessionId), { status: 'terminated' });
      await logAuditEvent(
        isExpiry ? 'session_expired' : 'access_revoked',
        isExpiry
          ? `Session with ${session?.doctorName || 'doctor'} expired automatically`
          : `Access revoked from ${session?.doctorName || 'doctor'}`
      );
      if (!isExpiry) toast.success(`Access revoked from ${session?.doctorName || 'doctor'}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to end session');
    }
    unmarkProcessing(sessionId);
  };

  const handleWriteRequest = async (request, isApproved) => {
    markProcessing(request.id);
    try {
      if (isApproved) {
        await addDoc(collection(db, 'users', user.uid, 'records'), request.payload);
        await updateDoc(doc(db, 'access_requests', request.id), { status: 'approved' });
        await logAuditEvent(
          'record_added',
          `Record "${getRecordTitle(request.payload)}" added by ${request.doctorName}`
        );
        toast.success(`Record added by ${request.doctorName}`);
      } else {
        await updateDoc(doc(db, 'access_requests', request.id), { status: 'denied' });
        await logAuditEvent(
          'record_rejected',
          `Record rejected from ${request.doctorName}`
        );
        toast.info("Record request rejected");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to process write request");
    }
    unmarkProcessing(request.id);
  };

  const handleDeleteRequest = async (request, isApproved) => {
    markProcessing(request.id);
    try {
      if (isApproved) {
        await deleteDoc(doc(db, 'users', user.uid, 'records', request.payload.recordId));
        await updateDoc(doc(db, 'access_requests', request.id), { status: 'approved' });
        await logAuditEvent(
          'record_removed',
          `Record "${request.payload.recordTitle || 'Record'}" removed by ${request.doctorName}`
        );
        toast.success(`Record removed after approval for ${request.doctorName}`);
      } else {
        await updateDoc(doc(db, 'access_requests', request.id), { status: 'denied' });
        await logAuditEvent(
          'record_rejected',
          `Delete request rejected from ${request.doctorName}`
        );
        toast.info('Delete request rejected');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to process delete request');
    }
    unmarkProcessing(request.id);
  };

  const saveEmergencyProfile = async () => {
    markProcessing('emergency-profile');
    try {
      await setDoc(doc(db, 'users', user.uid), {
        blood_group: emergencyProfile.blood_group.trim(),
        allergies: emergencyProfile.allergies.trim(),
        emergency_contact: {
          name: emergencyProfile.emergency_contact_name.trim(),
          phone: emergencyProfile.emergency_contact_phone.trim(),
        },
      }, { merge: true });
      toast.success('Emergency profile updated');
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'Failed to save emergency profile');
    }
    unmarkProcessing('emergency-profile');
  };

  const handleAddReminder = async (form) => {
    try {
      await addReminder(form);
      toast.success('Reminder saved');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save reminder');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <AnimatePresence>
        {showSelfReport && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SelfReportForm userId={user.uid} onClose={() => setShowSelfReport(false)} />
          </motion.div>
        )}
        {showReminderForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ReminderForm onSave={handleAddReminder} onClose={() => setShowReminderForm(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <ReminderChecker reminders={reminders} />

      {pendingReadRequests.map((req, i) => (
        <div
          key={req.id}
          className="access-request-banner incoming stagger-in"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="access-request-pulse"></div>
          <div className="access-request-content">
            <div className="access-request-icon">Ask</div>
            <div className="access-request-info">
              <h3 className="font-bold text-lg">{req.doctorName}</h3>
              <p className="text-sm mt-1 opacity-80">wants to view your medical records</p>
              <p className="text-xs mt-1 opacity-60">Session expires automatically in {formatTime(SESSION_DURATION_SECONDS)}</p>
            </div>
          </div>
          <div className="access-request-actions">
            <button
              onClick={() => handleReadRequest(req, false)}
              disabled={processingIds.has(req.id)}
              className="btn-danger"
            >
              Deny
            </button>
            <button
              onClick={() => handleReadRequest(req, true)}
              disabled={processingIds.has(req.id)}
              className="btn-approve"
            >
              {processingIds.has(req.id) ? 'Processing...' : 'Approve (15m)'}
            </button>
          </div>
        </div>
      ))}

      {writeRequests.map((req, i) => {
        const meta = RECORD_TYPE_META[req.payload?.type] || { icon: 'Doc', label: 'Record', color: '#94a3b8' };
        const title = getRecordTitle(req.payload);
        const details = getRecordSummaryFields(req.payload);
        return (
          <div
            key={req.id}
            className="write-request-banner stagger-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="write-request-header">
              <div className="write-request-type-icon" style={{ background: meta.color + '20', color: meta.color }}>
                {meta.icon}
              </div>
              <div className="write-request-info">
                <h3 className="font-bold">{req.doctorName} wants to add a {meta.label}</h3>
                <p className="text-sm font-semibold mt-0.5" style={{ color: meta.color }}>{title}</p>
              </div>
              {req.payload?.__e2ee && (
                <div className="e2ee-badge write-e2ee-badge" title="End-to-End Encrypted Fields">
                  <span>🔒</span> E2EE
                </div>
              )}
            </div>
            {details.length > 0 && (
              <div className="write-request-details">
                {details.slice(0, 6).map(({ label, value }) => (
                  <div key={label} className="write-request-detail-row">
                    <span className="write-request-detail-label">{label}</span>
                    <span className="write-request-detail-value">
                      {typeof value === 'string' && value.startsWith('ENC::')
                        ? <span className="encrypted-preview">🔒 Encrypted</span>
                        : value}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="write-request-actions">
              <button
                onClick={() => handleWriteRequest(req, false)}
                disabled={processingIds.has(req.id)}
                className="btn-danger"
              >
                Reject
              </button>
              <button
                onClick={() => handleWriteRequest(req, true)}
                disabled={processingIds.has(req.id)}
                className="btn-approve"
              >
                {processingIds.has(req.id) ? 'Saving...' : 'Approve & Save'}
              </button>
            </div>
          </div>
        );
      })}

      {deleteRequests.map((req, i) => (
        <div
          key={req.id}
          className="write-request-banner stagger-in"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="write-request-header">
            <div className="write-request-type-icon" style={{ background: '#ef444420', color: '#ef4444' }}>
              🗑️
            </div>
            <div className="write-request-info">
              <h3 className="font-bold">{req.doctorName} wants to remove a record</h3>
              <p className="text-sm font-semibold mt-0.5" style={{ color: '#ef4444' }}>
                {req.payload?.recordTitle || 'Record'} ({req.payload?.recordType || 'record'})
              </p>
            </div>
          </div>
          <div className="write-request-details">
            <div className="write-request-detail-row">
              <span className="write-request-detail-label">Action</span>
              <span className="write-request-detail-value">Delete from current records</span>
            </div>
            <div className="write-request-detail-row">
              <span className="write-request-detail-label">Requested by</span>
              <span className="write-request-detail-value">{req.doctorName}</span>
            </div>
          </div>
          <div className="write-request-actions">
            <button
              onClick={() => handleDeleteRequest(req, false)}
              disabled={processingIds.has(req.id)}
              className="btn-danger"
            >
              Reject
            </button>
            <button
              onClick={() => handleDeleteRequest(req, true)}
              disabled={processingIds.has(req.id)}
              className="btn-approve"
            >
              {processingIds.has(req.id) ? 'Removing...' : 'Approve Delete'}
            </button>
          </div>
        </div>
      ))}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card patient-qr-card">
          <div className="patient-qr-content">
            <div className="patient-qr-wrapper qr-glow">
              <QRCodeSVG value={user.patient_id} size={150} level="H" fgColor="#0f172a" />
              <div className="qr-scan-corner qr-corner-tl"></div>
              <div className="qr-scan-corner qr-corner-tr"></div>
              <div className="qr-scan-corner qr-corner-bl"></div>
              <div className="qr-scan-corner qr-corner-br"></div>
            </div>
            <div className="patient-qr-info">
              <h2 className="text-lg font-bold mb-2">Universal Health QR</h2>
              <p className="text-sm text-text3 mb-4">Doctors scan this to request access. Sessions auto-expire after 15 minutes. You always have final approval.</p>
              <div className="patient-public-id">
                <span className="patient-public-id-label">Public ID</span>
                <span className="patient-public-id-value">{user.public_id}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Active Sessions</h2>
            {activeSessions.length > 0 && (
              <span className="session-count-badge">{activeSessions.length} active</span>
            )}
          </div>
          {activeSessions.length === 0 ? (
            <div className="empty-sessions">
              <div className="empty-sessions-icon">🔒</div>
              <p className="text-sm text-text3">No doctors currently have access to your records.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeSessions.map((session, i) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onRevoke={(id) => endSession(id, false)}
                  isProcessing={processingIds.has(session.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card patient-qr-card">
          <div className="patient-qr-content">
            <div className="patient-qr-wrapper qr-glow">
              <QRCodeSVG value={emergencyQrUrl} size={150} level="H" fgColor="#7f1d1d" />
              <div className="qr-scan-corner qr-corner-tl"></div>
              <div className="qr-scan-corner qr-corner-tr"></div>
              <div className="qr-scan-corner qr-corner-bl"></div>
              <div className="qr-scan-corner qr-corner-br"></div>
            </div>
            <div className="patient-qr-info">
              <h2 className="text-lg font-bold mb-2">Emergency QR</h2>
              <p className="text-sm text-text3 mb-4">Use this QR for ambulance or emergency situations. It opens your saved emergency profile.</p>
              <div className="patient-public-id">
                <span className="patient-public-id-label">Emergency route</span>
                <span className="patient-public-id-value text-[10px] break-all">{emergencyQrUrl}</span>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span>🩸</span>
                  <span>{savedEmergencyProfile.blood_group || 'Blood group not saved yet'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span>⚠️</span>
                  <span>{savedEmergencyProfile.allergies || 'No allergies saved yet'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span>📞</span>
                  <span>
                    {savedEmergencyProfile.emergency_contact_name || savedEmergencyProfile.emergency_contact_phone
                      ? `${savedEmergencyProfile.emergency_contact_name || 'Emergency contact'}${savedEmergencyProfile.emergency_contact_phone ? ` - ${savedEmergencyProfile.emergency_contact_phone}` : ''}`
                      : 'No emergency contact saved yet'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Emergency Profile</h2>
            <span className="text-xs font-semibold text-red-700 bg-red-100 px-3 py-1 rounded-full">Emergency</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="record-label">Blood Group</label>
              <input
                type="text"
                value={emergencyProfile.blood_group}
                onChange={(e) => setEmergencyProfile((prev) => ({ ...prev, blood_group: e.target.value }))}
                placeholder="e.g. O+"
                className="input-field"
              />
            </div>
            <div>
              <label className="record-label">Allergies</label>
              <input
                type="text"
                value={emergencyProfile.allergies}
                onChange={(e) => setEmergencyProfile((prev) => ({ ...prev, allergies: e.target.value }))}
                placeholder="e.g. Penicillin, peanuts"
                className="input-field"
              />
            </div>
            <div>
              <label className="record-label">Emergency Contact Name</label>
              <input
                type="text"
                value={emergencyProfile.emergency_contact_name}
                onChange={(e) => setEmergencyProfile((prev) => ({ ...prev, emergency_contact_name: e.target.value }))}
                placeholder="Full name"
                className="input-field"
              />
            </div>
            <div>
              <label className="record-label">Emergency Contact Phone</label>
              <input
                type="text"
                value={emergencyProfile.emergency_contact_phone}
                onChange={(e) => setEmergencyProfile((prev) => ({ ...prev, emergency_contact_phone: e.target.value }))}
                placeholder="Phone number"
                className="input-field"
              />
            </div>
            <button
              onClick={saveEmergencyProfile}
              disabled={processingIds.has('emergency-profile')}
              className="btn-primary w-full"
            >
              {processingIds.has('emergency-profile') ? 'Saving...' : 'Save Emergency Profile'}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Medicine Reminders</h2>
            <p className="text-sm text-text3 mt-1">These reminders notify you while this app is open.</p>
          </div>
          <button onClick={() => setShowReminderForm(true)} className="btn-primary text-sm">
            💊 Add Reminder
          </button>
        </div>
        {reminders.length === 0 ? (
          <p className="text-sm text-text3">No reminders yet. Add one to start seeing medicine alerts.</p>
        ) : (
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <div key={reminder.id} className="rounded-2xl border border-[var(--border2)] p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold">💊 {reminder.med_name || 'Medication'}</div>
                  <div className="text-sm text-text3">{reminder.dosage || 'No dosage set'}</div>
                  <div className="text-xs text-text3 mt-1">
                    {(reminder.days || []).join(', ')} | {(reminder.times || []).join(', ')}
                  </div>
                </div>
                <button
                  onClick={() => toggleReminder(reminder.id, !reminder.active)}
                  className={reminder.active ? 'btn-danger text-sm' : 'btn-approve text-sm'}
                >
                  {reminder.active ? 'Pause Reminder' : 'Enable Reminder'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Health Overview</h2>
          <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">Past 7 Days</span>
        </div>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dummyHealthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorWellness" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border2)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text3)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text3)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border2)', borderRadius: '8px' }}
                itemStyle={{ color: 'var(--text)' }}
              />
              <Area type="monotone" dataKey="wellness" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorWellness)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card audit-log-card">
        <div className="audit-log-header" onClick={() => setShowAudit((v) => !v)}>
          <div className="audit-log-title-group">
            <div className="audit-log-shield">Log</div>
            <div>
              <h2 className="text-lg font-bold">Security Audit Log</h2>
              <p className="text-xs text-text3 mt-0.5">Real-time trail of all access events</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {auditLog.length > 0 && (
              <span className="audit-event-count">{auditLog.length} events</span>
            )}
            <span className="audit-chevron">{showAudit ? 'Hide' : 'Show'}</span>
          </div>
        </div>

        {showAudit && (
          <div className="audit-log-body">
            {auditLog.length === 0 ? (
              <div className="audit-empty">
                <p className="text-sm text-text3 text-center py-4">No security events recorded yet.</p>
              </div>
            ) : (
              <div className="audit-list">
                {auditLog.map((event, i) => (
                  <AuditItem key={event.id} event={event} index={i} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <RecordTimeline
        userId={user.uid}
        showAddButton={true}
        onAddRecord={() => setShowSelfReport(true)}
      />
    </motion.div>
  );
}
