import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

const SELF_REPORT_TYPES = [
  { key: 'symptom', label: 'Current Symptom', icon: 'Sym', color: '#fb923c' },
];

const INITIAL_FIELDS = {
  symptom: { symptom_name: '', severity: 'Mild', duration: '', notes: '' },
};

export default function SelfReportForm({ userId, onClose }) {
  const [selectedType, setSelectedType] = useState('symptom');
  const [fields, setFields] = useState({ ...INITIAL_FIELDS.symptom });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  const handleTypeChange = (type) => {
    setSelectedType(type);
    setFields({ ...INITIAL_FIELDS[type] });
    setSuccess('');
  };

  const handleFieldChange = (key, value) => {
    setFields(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    const hasData = Object.values(fields).some(v => v.toString().trim() !== '');
    if (!hasData) return;

    setSubmitting(true);
    try {
      const meta = SELF_REPORT_TYPES.find(r => r.key === selectedType);
      await addDoc(collection(db, "users", userId, "records"), {
        type: selectedType,
        label: meta.label,
        icon: meta.icon,
        ...fields,
        date: fields.date || fields.date_administered || fields.diagnosed_date || new Date().toISOString(),
        created_at: new Date().toISOString(),
        addedBy: 'self',
        addedByName: 'Self-Reported',
      });
      setFields({ ...INITIAL_FIELDS[selectedType] });
      setSuccess('Record added to your vault!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
    }
    setSubmitting(false);
  };

  const renderFields = () => {
    switch (selectedType) {
      case 'symptom':
        return (
          <>
            <div className="record-form-grid">
              <div className="record-field-group">
                <label className="record-label">Symptom *</label>
                <input type="text" placeholder="e.g. Headache, Fever, Nausea" value={fields.symptom_name} onChange={e => handleFieldChange('symptom_name', e.target.value)} className="input-field" />
              </div>
              <div className="record-field-group">
                <label className="record-label">Severity</label>
                <select value={fields.severity} onChange={e => handleFieldChange('severity', e.target.value)} className="input-field">
                  <option value="Mild">Mild</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Severe">Severe</option>
                </select>
              </div>
            </div>
            <div className="record-field-group">
              <label className="record-label">Duration</label>
              <input type="text" placeholder="e.g. 2 days, Since morning" value={fields.duration} onChange={e => handleFieldChange('duration', e.target.value)} className="input-field" />
            </div>
            <div className="record-field-group">
              <label className="record-label">Notes</label>
              <textarea placeholder="Describe how you feel..." value={fields.notes} onChange={e => handleFieldChange('notes', e.target.value)} className="input-field record-textarea" />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="self-report-overlay" onClick={onClose}>
      <div className="self-report-modal" onClick={e => e.stopPropagation()}>
        <div className="self-report-header">
          <h2>Report Current Symptoms</h2>
          <button onClick={onClose} className="self-report-close">✕</button>
        </div>

          {/* Only 1 choice now, but we'll leave it in the same structure in case more are added later */}
          {SELF_REPORT_TYPES.length > 1 && (
            <div className="record-type-selector">
              {SELF_REPORT_TYPES.map(rt => (
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
          )}

        <div className="record-form-fields">
          {renderFields()}
        </div>

        {success && (
          <div className="record-success-msg">
            <span>✓</span> {success}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="btn-primary w-full record-submit-btn"
        >
          {submitting ? 'Saving...' : 'Save to My Vault'}
        </button>
      </div>
    </div>
  );
}
