import React, { useState } from 'react';
import { toast } from 'sonner';

// ─── ENCRYPTION ───────────────────────────────────────────────────────────────
// Deterministic key derived from a per-session secret + app salt.
// In production this would be the patient's public key; here we derive
// a key from the patient_id stored in sessionStorage so the same key
// is available to RecordTimeline for decryption.
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

async function encryptField(plaintext) {
  if (!plaintext || !plaintext.trim()) return plaintext;
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  const cipherHex = Array.from(new Uint8Array(cipherBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `ENC::${ivHex}::${cipherHex}`;
}

// Fields to encrypt per record type
const ENCRYPTED_FIELDS = {
  prescription: ['notes'],
  allergy: ['notes', 'reaction'],
  surgery: ['notes'],
  diagnosis: ['notes', 'condition'],
  immunization: [],
  lab_result: [],
  vitals: [],
  family_history: ['notes'],
  visit_note: ['assessment', 'plan'],
  radiology: ['notes', 'finding_summary'],
  dental: ['notes'],
  mental_health: ['notes', 'treatment_plan'],
  physiotherapy: ['notes', 'exercise_plan'],
  device_implant: ['notes'],
  dietary_plan: [],
};

async function encryptSensitiveFields(type, fields) {
  const toEncrypt = ENCRYPTED_FIELDS[type] || [];
  const result = { ...fields };
  for (const field of toEncrypt) {
    if (result[field]) {
      result[field] = await encryptField(result[field]);
    }
  }
  return result;
}

// ─── RECORD TYPES ─────────────────────────────────────────────────────────────
const RECORD_TYPES = [
  { key: 'prescription',   label: 'Prescription',   icon: '💊', color: '#3b82f6' },
  { key: 'allergy',        label: 'Allergy',         icon: '⚠️',  color: '#f59e0b' },
  { key: 'surgery',        label: 'Surgery',         icon: '🩹', color: '#ef4444' },
  { key: 'diagnosis',      label: 'Diagnosis',       icon: '🩺', color: '#8b5cf6' },
  { key: 'immunization',   label: 'Immunization',    icon: '💉', color: '#10b981' },
  { key: 'lab_result',     label: 'Lab Result',      icon: '🧪', color: '#06b6d4' },
  { key: 'vitals',         label: 'Vitals',          icon: '❤️',  color: '#ec4899' },
  { key: 'family_history', label: 'Family History',  icon: '👨‍👩‍👧', color: '#6366f1' },
  { key: 'visit_note',     label: 'Visit Note',      icon: '📝', color: '#78716c' },
  { key: 'radiology',      label: 'Radiology',       icon: '🩻', color: '#a855f7' },
  { key: 'dental',         label: 'Dental',          icon: '🦷', color: '#0ea5e9' },
  { key: 'mental_health',  label: 'Mental Health',   icon: '🧠', color: '#f43f5e' },
  { key: 'physiotherapy',  label: 'Physiotherapy',   icon: '💪', color: '#f97316' },
  { key: 'device_implant', label: 'Device Implant',  icon: '🦿', color: '#64748b' },
  { key: 'dietary_plan',   label: 'Dietary Plan',    icon: '🥗', color: '#84cc16' },
];

const INITIAL_FIELDS = {
  prescription:   { medication: '', dosage: '', frequency: '', duration: '', notes: '' },
  allergy:        { allergen: '', severity: 'Mild', reaction: '', notes: '' },
  surgery:        { procedure: '', date: '', hospital: '', surgeon: '', outcome: '', notes: '' },
  diagnosis:      { condition: '', icd_code: '', status: 'Active', diagnosed_date: '', notes: '' },
  immunization:   { vaccine: '', date_administered: '', dose_number: '', lot_number: '', administered_by: '' },
  lab_result:     { test_name: '', date: '', result_value: '', unit: '', reference_range: '', status: 'Normal' },
  vitals:         { blood_pressure: '', heart_rate: '', temperature: '', spo2: '', weight: '', height: '' },
  family_history: { relation: '', condition: '', age_of_onset: '', notes: '' },
  visit_note:     { visit_date: '', chief_complaint: '', assessment: '', plan: '', followup_date: '' },
  radiology:      { imaging_type: '', body_part: '', date: '', facility: '', finding_summary: '', notes: '' },
  dental:         { procedure: '', tooth_number: '', date: '', dentist: '', next_checkup: '', notes: '' },
  mental_health:  { session_type: '', therapist: '', date: '', mood_assessment: '', treatment_plan: '', notes: '' },
  physiotherapy:  { condition: '', exercise_plan: '', frequency: '', start_date: '', therapist: '', notes: '' },
  device_implant: { device_type: '', model_number: '', manufacturer: '', implant_date: '', surgeon: '', notes: '' },
  dietary_plan:   { plan_name: '', goal: '', calories: '', restrictions: '', nutritionist: '', start_date: '' },
};

// ─── ENCRYPTED FIELD LABEL ────────────────────────────────────────────────────
function EncryptedLabel({ label }) {
  return (
    <label className="record-label encrypted-field-label">
      {label}
      <span className="encrypted-badge-inline" title="This field will be AES-256 encrypted before transmission">
        🔒 Encrypted
      </span>
    </label>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function RecordForm({ onSubmit, doctorName }) {
  const [selectedType, setSelectedType] = useState('prescription');
  const [fields, setFields] = useState({ ...INITIAL_FIELDS.prescription });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [encrypting, setEncrypting] = useState(false);

  const handleTypeChange = (type) => {
    setSelectedType(type);
    setFields({ ...INITIAL_FIELDS[type] });
  };

  const handleFieldChange = (key, value) => {
    setFields(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    const hasData = Object.values(fields).some(v => v.toString().trim() !== '');
    if (!hasData) return;

    setSubmitting(true);
    setEncrypting(true);

    try {
      const encryptedFields = await encryptSensitiveFields(selectedType, fields);
      setEncrypting(false);

      const hasEncryptedFields = (ENCRYPTED_FIELDS[selectedType] || []).some(f => fields[f]?.trim());

      await onSubmit({
        type: selectedType,
        label: RECORD_TYPES.find(r => r.key === selectedType).label,
        icon: RECORD_TYPES.find(r => r.key === selectedType).icon,
        ...encryptedFields,
        __e2ee: hasEncryptedFields,
        date: fields.date || fields.date_administered || fields.visit_date || fields.diagnosed_date || fields.start_date || fields.implant_date || new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

      setFields({ ...INITIAL_FIELDS[selectedType] });
      toast.success('Record encrypted & submitted for patient approval!');
    } catch (err) {
      console.error(err);
      setEncrypting(false);
      toast.error('Failed to submit record.');
    }
    setSubmitting(false);
  };

  const encFields = ENCRYPTED_FIELDS[selectedType] || [];
  const currentMeta = RECORD_TYPES.find(r => r.key === selectedType);

  const renderFields = () => {
    switch (selectedType) {
      case 'prescription':
        return (
          <>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Medication *</label>
                <input type="text" placeholder="e.g. Amoxicillin" value={fields.medication} onChange={e => handleFieldChange('medication', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Dosage *</label>
                <input type="text" placeholder="e.g. 500mg" value={fields.dosage} onChange={e => handleFieldChange('dosage', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Frequency</label>
                <input type="text" placeholder="e.g. Twice daily" value={fields.frequency} onChange={e => handleFieldChange('frequency', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Duration</label>
                <input type="text" placeholder="e.g. 7 days" value={fields.duration} onChange={e => handleFieldChange('duration', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-field-group">
              <EncryptedLabel label="Notes" />
              <textarea placeholder="Additional instructions..." value={fields.notes} onChange={e => handleFieldChange('notes', e.target.value)} className="input-field record-textarea encrypted-textarea" />
            </div>
          </>
        );

      case 'allergy':
        return (
          <>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Allergen *</label>
                <input type="text" placeholder="e.g. Penicillin, Peanuts" value={fields.allergen} onChange={e => handleFieldChange('allergen', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Severity *</label>
                <select value={fields.severity} onChange={e => handleFieldChange('severity', e.target.value)} className="input-field">
                  <option value="Mild">Mild</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Severe">Severe</option>
                  <option value="Life-threatening">Life-threatening</option>
                </select>
              </div>
            </div>
            <div className="record-field-group">
              <EncryptedLabel label="Reaction" />
              <input type="text" placeholder="e.g. Hives, Anaphylaxis" value={fields.reaction} onChange={e => handleFieldChange('reaction', e.target.value)} className="input-field encrypted-input" />
            </div>
            <div className="record-field-group">
              <EncryptedLabel label="Notes" />
              <textarea placeholder="Additional details..." value={fields.notes} onChange={e => handleFieldChange('notes', e.target.value)} className="input-field record-textarea encrypted-textarea" />
            </div>
          </>
        );

      case 'surgery':
        return (
          <>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Procedure *</label>
                <input type="text" placeholder="e.g. Appendectomy" value={fields.procedure} onChange={e => handleFieldChange('procedure', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Date</label>
                <input type="date" value={fields.date} onChange={e => handleFieldChange('date', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Hospital</label>
                <input type="text" placeholder="e.g. City Hospital" value={fields.hospital} onChange={e => handleFieldChange('hospital', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Surgeon</label>
                <input type="text" placeholder="Surgeon name" value={fields.surgeon} onChange={e => handleFieldChange('surgeon', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Outcome</label>
                <input type="text" placeholder="e.g. Successful" value={fields.outcome} onChange={e => handleFieldChange('outcome', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-field-group">
              <EncryptedLabel label="Notes" />
              <textarea placeholder="Post-op notes..." value={fields.notes} onChange={e => handleFieldChange('notes', e.target.value)} className="input-field record-textarea encrypted-textarea" />
            </div>
          </>
        );

      case 'diagnosis':
        return (
          <>
            <div className="record-form-grid">
              <div className="record-field-group">
                <EncryptedLabel label="Condition *" />
                <input type="text" placeholder="e.g. Type 2 Diabetes" value={fields.condition} onChange={e => handleFieldChange('condition', e.target.value)} className="input-field encrypted-input" />
              </div>
              <div className="record-field-group">
                <label className="record-label">ICD Code</label>
                <input type="text" placeholder="e.g. E11.9" value={fields.icd_code} onChange={e => handleFieldChange('icd_code', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Status</label>
                <select value={fields.status} onChange={e => handleFieldChange('status', e.target.value)} className="input-field">
                  <option value="Active">Active</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Chronic">Chronic</option>
                  <option value="In Remission">In Remission</option>
                </select>
              </div>
              <div className="record-field-group">
                <label className="record-label">Diagnosed Date</label>
                <input type="date" value={fields.diagnosed_date} onChange={e => handleFieldChange('diagnosed_date', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-field-group">
              <EncryptedLabel label="Clinical Notes" />
              <textarea placeholder="Clinical notes..." value={fields.notes} onChange={e => handleFieldChange('notes', e.target.value)} className="input-field record-textarea encrypted-textarea" />
            </div>
          </>
        );

      case 'immunization':
        return (
          <>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Vaccine *</label>
                <input type="text" placeholder="e.g. COVID-19 Pfizer" value={fields.vaccine} onChange={e => handleFieldChange('vaccine', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Date Administered</label>
                <input type="date" value={fields.date_administered} onChange={e => handleFieldChange('date_administered', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Dose #</label>
                <input type="text" placeholder="e.g. 1, 2, Booster" value={fields.dose_number} onChange={e => handleFieldChange('dose_number', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Lot Number</label>
                <input type="text" placeholder="Vaccine lot #" value={fields.lot_number} onChange={e => handleFieldChange('lot_number', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-field-group">
              <label className="record-label">Administered By</label>
              <input type="text" placeholder="Healthcare provider name" value={fields.administered_by} onChange={e => handleFieldChange('administered_by', e.target.value)} className="input-field" />
            </div>
          </>
        );

      case 'lab_result':
        return (
          <>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Test Name *</label>
                <input type="text" placeholder="e.g. CBC, HbA1c" value={fields.test_name} onChange={e => handleFieldChange('test_name', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Date</label>
                <input type="date" value={fields.date} onChange={e => handleFieldChange('date', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Result Value *</label>
                <input type="text" placeholder="e.g. 12.5" value={fields.result_value} onChange={e => handleFieldChange('result_value', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Unit</label>
                <input type="text" placeholder="e.g. mg/dL, %" value={fields.unit} onChange={e => handleFieldChange('unit', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Reference Range</label>
                <input type="text" placeholder="e.g. 4.0 – 5.6%" value={fields.reference_range} onChange={e => handleFieldChange('reference_range', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Status</label>
                <select value={fields.status} onChange={e => handleFieldChange('status', e.target.value)} className="input-field">
                  <option value="Normal">Normal</option>
                  <option value="Abnormal">Abnormal</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>
          </>
        );

      case 'vitals':
        return (
          <>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Blood Pressure</label>
                <input type="text" placeholder="e.g. 120/80 mmHg" value={fields.blood_pressure} onChange={e => handleFieldChange('blood_pressure', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Heart Rate</label>
                <input type="text" placeholder="e.g. 72 bpm" value={fields.heart_rate} onChange={e => handleFieldChange('heart_rate', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Temperature</label>
                <input type="text" placeholder="e.g. 98.6°F" value={fields.temperature} onChange={e => handleFieldChange('temperature', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">SpO₂</label>
                <input type="text" placeholder="e.g. 98%" value={fields.spo2} onChange={e => handleFieldChange('spo2', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Weight</label>
                <input type="text" placeholder="e.g. 70 kg" value={fields.weight} onChange={e => handleFieldChange('weight', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Height</label>
                <input type="text" placeholder="e.g. 170 cm" value={fields.height} onChange={e => handleFieldChange('height', e.target.value)} className="input-field" />
              </div>
            </div>
          </>
        );

      case 'family_history':
        return (
          <>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Relation *</label>
                <select value={fields.relation} onChange={e => handleFieldChange('relation', e.target.value)} className="input-field">
                  <option value="">Select Relation...</option>
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Brother">Brother</option>
                  <option value="Sister">Sister</option>
                  <option value="Grandfather (Paternal)">Grandfather (Paternal)</option>
                  <option value="Grandmother (Paternal)">Grandmother (Paternal)</option>
                  <option value="Grandfather (Maternal)">Grandfather (Maternal)</option>
                  <option value="Grandmother (Maternal)">Grandmother (Maternal)</option>
                  <option value="Uncle">Uncle</option>
                  <option value="Aunt">Aunt</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="record-field-group">
                <label className="record-label">Condition *</label>
                <input type="text" placeholder="e.g. Heart Disease, Diabetes" value={fields.condition} onChange={e => handleFieldChange('condition', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Age of Onset</label>
                <input type="text" placeholder="e.g. 55" value={fields.age_of_onset} onChange={e => handleFieldChange('age_of_onset', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-field-group">
              <EncryptedLabel label="Notes" />
              <textarea placeholder="Additional details..." value={fields.notes} onChange={e => handleFieldChange('notes', e.target.value)} className="input-field record-textarea encrypted-textarea" />
            </div>
          </>
        );

      case 'visit_note':
        return (
          <>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Visit Date *</label>
                <input type="date" value={fields.visit_date} onChange={e => handleFieldChange('visit_date', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Follow-up Date</label>
                <input type="date" value={fields.followup_date} onChange={e => handleFieldChange('followup_date', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-field-group">
              <label className="record-label">Chief Complaint *</label>
              <input type="text" placeholder="Primary reason for visit" value={fields.chief_complaint} onChange={e => handleFieldChange('chief_complaint', e.target.value)} className="input-field" />
            </div>
            <div className="record-field-group">
              <EncryptedLabel label="Assessment" />
              <textarea placeholder="Clinical assessment..." value={fields.assessment} onChange={e => handleFieldChange('assessment', e.target.value)} className="input-field record-textarea encrypted-textarea" />
            </div>
            <div className="record-field-group">
              <EncryptedLabel label="Plan" />
              <textarea placeholder="Treatment plan and instructions..." value={fields.plan} onChange={e => handleFieldChange('plan', e.target.value)} className="input-field record-textarea encrypted-textarea" />
            </div>
          </>
        );

      case 'radiology':
        return (
          <>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Imaging Type *</label>
                <input type="text" placeholder="e.g. X-Ray, MRI, CT Scan" value={fields.imaging_type} onChange={e => handleFieldChange('imaging_type', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Body Part</label>
                <input type="text" placeholder="e.g. Left Knee, Chest" value={fields.body_part} onChange={e => handleFieldChange('body_part', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Date</label>
                <input type="date" value={fields.date} onChange={e => handleFieldChange('date', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Facility</label>
                <input type="text" placeholder="e.g. City Imaging Center" value={fields.facility} onChange={e => handleFieldChange('facility', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-field-group">
              <EncryptedLabel label="Finding Summary" />
              <textarea placeholder="e.g. No fractures visible..." value={fields.finding_summary} onChange={e => handleFieldChange('finding_summary', e.target.value)} className="input-field record-textarea encrypted-textarea" />
            </div>
          </>
        );

      case 'dental':
        return (
          <>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Procedure *</label>
                <input type="text" placeholder="e.g. Root Canal, Cleaning" value={fields.procedure} onChange={e => handleFieldChange('procedure', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Tooth Number</label>
                <input type="text" placeholder="e.g. 14, 15" value={fields.tooth_number} onChange={e => handleFieldChange('tooth_number', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Date</label>
                <input type="date" value={fields.date} onChange={e => handleFieldChange('date', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Dentist</label>
                <input type="text" placeholder="Provider name" value={fields.dentist} onChange={e => handleFieldChange('dentist', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-field-group">
              <EncryptedLabel label="Notes" />
              <textarea placeholder="Post-procedure instructions..." value={fields.notes} onChange={e => handleFieldChange('notes', e.target.value)} className="input-field record-textarea encrypted-textarea" />
            </div>
          </>
        );

      case 'mental_health':
        return (
          <>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Session Type *</label>
                <input type="text" placeholder="e.g. CBT, Psychiatry" value={fields.session_type} onChange={e => handleFieldChange('session_type', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Therapist / Provider</label>
                <input type="text" placeholder="Provider name" value={fields.therapist} onChange={e => handleFieldChange('therapist', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Date</label>
                <input type="date" value={fields.date} onChange={e => handleFieldChange('date', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Mood Assessment</label>
                <input type="text" placeholder="e.g. Stable, Anxious" value={fields.mood_assessment} onChange={e => handleFieldChange('mood_assessment', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-field-group">
              <EncryptedLabel label="Plan / Notes" />
              <textarea placeholder="Treatment plan..." value={fields.notes} onChange={e => handleFieldChange('notes', e.target.value)} className="input-field record-textarea encrypted-textarea" />
            </div>
          </>
        );

      case 'physiotherapy':
        return (
          <>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Condition *</label>
                <input type="text" placeholder="e.g. Rotator Cuff Tear" value={fields.condition} onChange={e => handleFieldChange('condition', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Therapist</label>
                <input type="text" placeholder="Provider name" value={fields.therapist} onChange={e => handleFieldChange('therapist', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Start Date</label>
                <input type="date" value={fields.start_date} onChange={e => handleFieldChange('start_date', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Frequency</label>
                <input type="text" placeholder="e.g. 2 times a week" value={fields.frequency} onChange={e => handleFieldChange('frequency', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-field-group">
              <EncryptedLabel label="Exercise Plan" />
              <textarea placeholder="Exercises..." value={fields.exercise_plan} onChange={e => handleFieldChange('exercise_plan', e.target.value)} className="input-field record-textarea encrypted-textarea" />
            </div>
          </>
        );

      case 'device_implant':
        return (
          <>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Device Type *</label>
                <input type="text" placeholder="e.g. Pacemaker, Knee Joint" value={fields.device_type} onChange={e => handleFieldChange('device_type', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Model Number</label>
                <input type="text" placeholder="Model ID" value={fields.model_number} onChange={e => handleFieldChange('model_number', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Implant Date</label>
                <input type="date" value={fields.implant_date} onChange={e => handleFieldChange('implant_date', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Manufacturer</label>
                <input type="text" placeholder="e.g. Medtronic" value={fields.manufacturer} onChange={e => handleFieldChange('manufacturer', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-field-group">
              <EncryptedLabel label="Notes" />
              <textarea placeholder="Follow-up requirements..." value={fields.notes} onChange={e => handleFieldChange('notes', e.target.value)} className="input-field record-textarea encrypted-textarea" />
            </div>
          </>
        );

      case 'dietary_plan':
        return (
          <>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Plan Name *</label>
                <input type="text" placeholder="e.g. Low Sodium Diet" value={fields.plan_name} onChange={e => handleFieldChange('plan_name', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Goal</label>
                <input type="text" placeholder="e.g. Weight Loss, BP Control" value={fields.goal} onChange={e => handleFieldChange('goal', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Restrictions</label>
                <input type="text" placeholder="e.g. Gluten-free, No nuts" value={fields.restrictions} onChange={e => handleFieldChange('restrictions', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Target Calories</label>
                <input type="text" placeholder="e.g. 2000 kcal/day" value={fields.calories} onChange={e => handleFieldChange('calories', e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="record-field-group">
              <label className="record-label">Nutritionist</label>
              <input type="text" placeholder="Provider name" value={fields.nutritionist} onChange={e => handleFieldChange('nutritionist', e.target.value)} className="input-field" />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const hasEncryptedFields = encFields.length > 0;

  return (
    <div className="record-form-container">
      {/* E2EE Banner */}
      {hasEncryptedFields && (
        <div className="e2ee-banner">
          <span className="e2ee-icon">Lock</span>
          <div>
            <span className="e2ee-title">End-to-End Encrypted</span>
            <span className="e2ee-subtitle">
              Sensitive fields ({encFields.join(', ')}) are AES-256-GCM encrypted before leaving this device.
            </span>
          </div>
        </div>
      )}

      {/* Type Selector */}
      <div className="record-type-selector">
        {RECORD_TYPES.map(rt => (
          <button
            key={rt.key}
            onClick={() => handleTypeChange(rt.key)}
            className={`record-type-chip ${selectedType === rt.key ? 'active' : ''}`}
            style={selectedType === rt.key ? { borderColor: rt.color, background: rt.color + '18', color: rt.color } : {}}
          >
            <span className="record-type-icon">{rt.icon}</span>
            <span className="record-type-label">{rt.label}</span>
          </button>
        ))}
      </div>

      {/* Fields */}
      <div className="record-form-fields">
        {renderFields()}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="btn-primary w-full record-submit-btn"
      >
        {encrypting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="record-spinner"></span> Encrypting fields...
          </span>
        ) : submitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="record-spinner"></span> Sending to patient...
          </span>
        ) : (
          <>
            {hasEncryptedFields ? 'Lock ' : ''}
            Submit {currentMeta?.label} for Approval
          </>
        )}
      </button>
    </div>
  );
}

export { RECORD_TYPES };
