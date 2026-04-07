import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

// ─── DECRYPTION (mirrors RecordForm encryptField) ────────────────────────────
const APP_SALT = 'MediVault::E2EE::v1';

async function deriveKey() {
  const raw = (sessionStorage.getItem('mv_ek') || APP_SALT);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(raw),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(APP_SALT),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function decryptField(ciphertext) {
  if (!ciphertext || !ciphertext.startsWith('ENC::')) return ciphertext;
  try {
    const [, ivHex, cipherHex] = ciphertext.split('::');
    const iv = new Uint8Array(ivHex.match(/.{2}/g).map(b => parseInt(b, 16)));
    const cipherBuf = new Uint8Array(cipherHex.match(/.{2}/g).map(b => parseInt(b, 16)));
    const key = await deriveKey();
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBuf);
    return new TextDecoder().decode(plainBuf);
  } catch {
    return '[Decryption failed]';
  }
}

async function decryptRecord(record) {
  const result = { ...record };
  const entries = await Promise.all(
    Object.entries(result).map(async ([key, val]) => {
      if (typeof val === 'string' && val.startsWith('ENC::')) {
        return [key, await decryptField(val)];
      }
      return [key, val];
    })
  );
  return Object.fromEntries(entries);
}

// ─── TYPE META ────────────────────────────────────────────────────────────────
const TYPE_META = {
  prescription:   { icon: '💊', color: '#3b82f6', label: 'Prescription' },
  allergy:        { icon: '⚠️',  color: '#f59e0b', label: 'Allergy' },
  surgery:        { icon: '🔪', color: '#ef4444', label: 'Surgery' },
  diagnosis:      { icon: '🩺', color: '#8b5cf6', label: 'Diagnosis' },
  immunization:   { icon: '💉', color: '#10b981', label: 'Immunization' },
  lab_result:     { icon: '🧪', color: '#06b6d4', label: 'Lab Result' },
  vitals:         { icon: '❤️',  color: '#ec4899', label: 'Vitals' },
  family_history: { icon: '👨‍👩‍👧', color: '#6366f1', label: 'Family History' },
  visit_note:     { icon: '📋', color: '#78716c', label: 'Visit Note' },
  radiology:      { icon: '🩻', color: '#a855f7', label: 'Radiology' },
  dental:         { icon: '🦷', color: '#0ea5e9', label: 'Dental' },
  mental_health:  { icon: '🧠', color: '#f43f5e', label: 'Mental Health' },
  physiotherapy:  { icon: '💪', color: '#f97316', label: 'Physiotherapy' },
  device_implant: { icon: '🦿', color: '#64748b', label: 'Device Implant' },
  dietary_plan:   { icon: '🥗', color: '#84cc16', label: 'Dietary Plan' },
  symptom:        { icon: '🤒', color: '#fb923c', label: 'Current Symptom' },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function formatRecordDetails(record) {
  const skip = ['type', 'label', 'icon', 'created_at', 'date', 'addedBy', 'addedByName', '__e2ee'];
  return Object.entries(record)
    .filter(([key, val]) => !skip.includes(key) && val && val.toString().trim() !== '')
    .map(([key, val]) => ({
      label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: val,
    }));
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function groupByDate(records) {
  const groups = {};
  records.forEach(rec => {
    const dateKey = rec.date ? formatDate(rec.date) : formatDate(rec.created_at);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(rec);
  });
  return groups;
}

function buildTitle(rec) {
  if (rec.type === 'prescription')   return rec.medication      || 'Prescription';
  if (rec.type === 'allergy')        return rec.allergen        || 'Allergy';
  if (rec.type === 'surgery')        return rec.procedure       || 'Surgery';
  if (rec.type === 'diagnosis')      return rec.condition       || 'Diagnosis';
  if (rec.type === 'immunization')   return rec.vaccine         || 'Immunization';
  if (rec.type === 'lab_result')     return rec.test_name       || 'Lab Result';
  if (rec.type === 'vitals')         return `BP: ${rec.blood_pressure || '—'} HR: ${rec.heart_rate || '—'}`;
  if (rec.type === 'family_history') return `${rec.relation}: ${rec.condition || ''}`;
  if (rec.type === 'visit_note')     return rec.chief_complaint  || 'Visit Note';
  if (rec.type === 'radiology')      return rec.imaging_type    || 'Radiology';
  if (rec.type === 'dental')         return rec.procedure       || 'Dental';
  if (rec.type === 'mental_health')  return rec.session_type    || 'Mental Health';
  if (rec.type === 'physiotherapy')  return rec.condition       || 'Physiotherapy';
  if (rec.type === 'device_implant') return rec.device_type     || 'Device Implant';
  if (rec.type === 'dietary_plan')   return rec.plan_name       || 'Dietary Plan';
  if (rec.type === 'symptom')        return rec.symptom_name    || 'Current Symptom';
  return TYPE_META[rec.type]?.label || 'Record';
}

// ─── RECORD CARD (handles its own async decryption) ──────────────────────────
function RecordCard({ rec, index }) {
  const [decrypted, setDecrypted] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [decrypting, setDecrypting] = useState(false);

  const meta = TYPE_META[rec.type] || { icon: '📄', color: '#94a3b8', label: 'Record' };
  const title = buildTitle(rec);
  const isE2EE = rec.__e2ee === true;

  const handleExpand = async () => {
    if (!expanded && isE2EE && !decrypted) {
      setDecrypting(true);
      const plain = await decryptRecord(rec);
      setDecrypted(plain);
      setDecrypting(false);
    }
    setExpanded(v => !v);
  };

  const displayRec = (expanded && decrypted) ? decrypted : rec;
  const details = formatRecordDetails(displayRec);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      layout
      className={`timeline-record-card ${expanded ? 'expanded' : ''}`}
      onClick={handleExpand}
    >
      <div className="timeline-record-header">
        <div className="timeline-record-icon" style={{ background: meta.color + '20', color: meta.color }}>
          {meta.icon}
        </div>
        <div className="timeline-record-info">
          <div className="timeline-record-title">{title}</div>
          <div className="timeline-record-type" style={{ color: meta.color }}>{meta.label}</div>
        </div>
        <div className="timeline-record-right">
          {isE2EE && (
            <div className="e2ee-badge-sm" title="End-to-End Encrypted fields">
              🔒
            </div>
          )}
          <div className="timeline-record-chevron">{expanded ? '▲' : '▼'}</div>
        </div>
      </div>

      {expanded && (
        <div className="timeline-record-details">
          {decrypting ? (
            <div className="timeline-decrypting">
              <span className="record-spinner small"></span>
              <span>Decrypting…</span>
            </div>
          ) : (
            <>
              {isE2EE && (
                <div className="e2ee-decrypted-notice">
                  <span>🔓</span> Fields decrypted on-device. Not stored in plaintext.
                </div>
              )}
              {details.map(({ label, value }) => (
                <div key={label} className="timeline-detail-row">
                  <span className="timeline-detail-label">{label}</span>
                  <span className="timeline-detail-value">{value}</span>
                </div>
              ))}
              {rec.addedByName && (
                <div className="timeline-detail-added-by">
                  Added by {rec.addedByName}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function RecordTimeline({ userId, showAddButton, onAddRecord }) {
  const [records, setRecords] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'users', userId, 'records'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recs = [];
      snapshot.forEach((doc) => recs.push({ id: doc.id, ...doc.data() }));
      setRecords(recs);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching records:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userId]);

  const filteredRecords = records.filter(r => {
    const matchesType = filterType === 'all' || r.type === filterType;
    if (!searchQuery.trim()) return matchesType;
    const searchLower = searchQuery.toLowerCase();
    // Search in plaintext fields only (skip ENC:: blobs)
    const allValues = Object.values(r)
      .filter(v => typeof v === 'string' && !v.startsWith('ENC::'))
      .join(' ')
      .toLowerCase();
    return matchesType && allValues.includes(searchLower);
  });

  const grouped = groupByDate(filteredRecords);
  const typeKeys = ['all', ...Object.keys(TYPE_META)];

  const typeCounts = {};
  records.forEach(r => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });

  if (loading) {
    return (
      <div className="timeline-loading">
        <div className="timeline-loading-spinner"></div>
        <p>Loading health records…</p>
      </div>
    );
  }

  return (
    <div className="record-timeline">
      {/* Header Bar */}
      <div className="timeline-header">
        <div className="timeline-header-left">
          <h2 className="timeline-title">Health Records</h2>
          <span className="timeline-count">{records.length} records</span>
          {records.some(r => r.__e2ee) && (
            <span className="e2ee-header-badge" title="Some records contain E2EE encrypted fields">
              🔒 E2EE Protected
            </span>
          )}
        </div>
        {showAddButton && (
          <button onClick={onAddRecord} className="btn-primary timeline-add-btn">
            <span>+</span> Add Record
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="timeline-search-bar">
        <span className="timeline-search-icon">🔍</span>
        <input
          type="text"
          placeholder="Search records…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="input-field timeline-search-input"
        />
      </div>

      {/* Filter Chips */}
      <div className="timeline-filters">
        {typeKeys.map(key => {
          const meta = key === 'all' ? { icon: '📁', label: 'All', color: 'var(--primary)' } : TYPE_META[key];
          const count = key === 'all' ? records.length : (typeCounts[key] || 0);
          if (key !== 'all' && count === 0) return null;
          return (
            <button
              key={key}
              onClick={() => setFilterType(key)}
              className={`timeline-filter-chip ${filterType === key ? 'active' : ''}`}
              style={filterType === key ? { borderColor: meta.color, background: meta.color + '18', color: meta.color } : {}}
            >
              <span>{meta.icon}</span>
              <span>{meta.label}</span>
              <span className="timeline-filter-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <AnimatePresence>
        {filteredRecords.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="timeline-empty"
          >
            <div className="timeline-empty-icon" style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">No Records Found</h3>
            <p className="opacity-70 mt-2">{searchQuery ? 'Try a different search term.' : 'No health records have been added yet.'}</p>
          </motion.div>
        ) : (
        <div className="timeline-body">
          {Object.entries(grouped).map(([dateLabel, recs]) => (
            <div key={dateLabel} className="timeline-date-group">
              <div className="timeline-date-label">
                <div className="timeline-date-dot"></div>
                <span>{dateLabel}</span>
              </div>
              <div className="timeline-date-records">
                {recs.map((rec, i) => (
                  <RecordCard key={rec.id} rec={rec} index={i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      </AnimatePresence>
    </div>
  );
}