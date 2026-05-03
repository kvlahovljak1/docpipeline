import React, { useState } from 'react';
import StatusBadge from './StatusBadge';
import { validateDocument, detectDuplicates } from '../lib/validation';
import { C } from '../App';

function IssueTag({ text }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 8px', borderRadius: 3,
      fontSize: 10, background: '#130808', color: '#cc7070',
      border: '1px solid #2e1212', marginRight: 4, marginBottom: 4,
      letterSpacing: '0.01em',
    }}>{text}</span>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        fontSize: 9, color: C.muted, display: 'block', marginBottom: 4,
        textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
      }}>{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '7px 10px',
          border: `1px solid ${focused ? C.accent : C.border}`,
          borderRadius: 5, fontSize: 12,
          background: focused ? '#12100d' : C.surface2,
          color: C.text, outline: 'none',
          transition: 'all 0.15s',
        }}
      />
    </div>
  );
}

export default function ReviewPanel({ doc, allDocs, onUpdate, onClose }) {
  const [fields, setFields] = useState(doc.extracted || {});
  const [saving, setSaving] = useState(false);
  const set = (key, val) => setFields(f => ({ ...f, [key]: val }));

  const dupNames = detectDuplicates({ ...doc, extracted: fields }, allDocs);
  const issues = [
    ...validateDocument({ extracted: fields }),
    ...(dupNames.length > 0 ? [`Duplicate doc number in: ${dupNames.join(', ')}`] : []),
  ];

  const handleSave = () => {
    setSaving(true);
    setTimeout(async () => {
      await onUpdate(doc.id, fields, issues.length === 0 ? 'validated' : 'needs_review');
      setSaving(false);
      onClose();
    }, 200);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(4px)',
      zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div
        className="fade-in"
        style={{
          background: C.surface, borderRadius: 10,
          border: `1px solid ${C.border}`,
          width: '100%', maxWidth: 640, maxHeight: '90vh',
          overflowY: 'auto', padding: 28,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14, color: C.text, marginBottom: 8, letterSpacing: '-0.01em' }}>{doc.name}</div>
            <StatusBadge status={doc.status} />
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 18, color: C.muted, padding: '2px 6px', lineHeight: 1, opacity: 0.6 }}
          >×</button>
        </div>

        {/* Issues */}
        {issues.length > 0 && (
          <div style={{
            background: '#0f0808', border: '1px solid #2a1010',
            borderRadius: 6, padding: '12px 14px', marginBottom: 22,
          }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#cc7070', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {issues.length} issue{issues.length > 1 ? 's' : ''} detected
            </div>
            {issues.map((iss, i) => <IssueTag key={i} text={iss} />)}
          </div>
        )}

        {/* Fields grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <Field label="Document Type"     value={fields.documentType}   onChange={v => set('documentType', v)} />
          <Field label="Supplier"          value={fields.supplier}       onChange={v => set('supplier', v)} />
          <Field label="Document Number"   value={fields.documentNumber} onChange={v => set('documentNumber', v)} />
          <Field label="Currency"          value={fields.currency}       onChange={v => set('currency', v)} />
          <Field label="Issue Date"        value={fields.issueDate}      onChange={v => set('issueDate', v)} type="date" />
          <Field label="Due Date"          value={fields.dueDate}        onChange={v => set('dueDate', v)}   type="date" />
          <Field label="Subtotal"          value={fields.subtotal}       onChange={v => set('subtotal', v)}  type="number" />
          <Field label="Tax"               value={fields.tax}            onChange={v => set('tax', v)}       type="number" />
          <Field label="Total"             value={fields.total}          onChange={v => set('total', v)}     type="number" />
        </div>

        {/* Line items */}
        {Array.isArray(fields.lineItems) && fields.lineItems.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 9, color: C.muted, marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Line Items</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Description', 'Qty', 'Unit Price', 'Total'].map(h => (
                    <th key={h} style={{ padding: '4px 8px', textAlign: 'left', color: C.muted, fontWeight: 500, fontSize: 10, letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fields.lineItems.map((item, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    {['description', 'qty', 'unitPrice', 'total'].map(k => (
                      <td key={k} style={{ padding: '5px 8px' }}>
                        <input
                          value={item[k] || ''}
                          onChange={e => {
                            const items = [...fields.lineItems];
                            items[i] = { ...items[i], [k]: e.target.value };
                            set('lineItems', items);
                          }}
                          style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 12, color: C.text, outline: 'none' }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={() => { onUpdate(doc.id, fields, 'rejected'); onClose(); }}
            style={{
              padding: '8px 18px', border: '1px solid #2e1212', borderRadius: 5,
              background: '#130808', color: '#cc7070', fontSize: 12, letterSpacing: '0.02em',
            }}
          >Reject</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 22px', borderRadius: 5, fontSize: 12, fontWeight: 500,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              background: saving ? C.accentDim : C.accent,
              color: saving ? C.muted : '#0a0a0b',
              border: 'none', opacity: saving ? 0.6 : 1,
              transition: 'all 0.15s',
            }}
          >
            {saving ? 'Saving…' : issues.length === 0 ? 'Confirm' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
