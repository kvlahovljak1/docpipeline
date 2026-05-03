import React from 'react';
import StatusBadge from './StatusBadge';
import { validateDocument } from '../lib/validation';
import { C } from '../App';

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: '18px 20px',
      transition: 'border-color 0.15s',
    }}>
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 500, color: color || C.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ActionBtn({ label, onClick, danger }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '4px 12px', fontSize: 11, letterSpacing: '0.02em',
        border: `1px solid ${hovered ? (danger ? C.red : C.accent) : C.border}`,
        borderRadius: 4, background: 'transparent',
        color: hovered ? (danger ? C.red : C.accent) : C.muted,
        transition: 'all 0.15s',
      }}
    >{label}</button>
  );
}

export default function Dashboard({ docs, onReview, onDelete }) {
  const stats = {
    total:        docs.length,
    validated:    docs.filter(d => d.status === 'validated').length,
    needs_review: docs.filter(d => d.status === 'needs_review').length,
    rejected:     docs.filter(d => d.status === 'rejected').length,
  };

  const byCurrency = {};
  docs.filter(d => d.status === 'validated' && d.extracted?.total && d.extracted?.currency)
    .forEach(d => {
      const c = d.extracted.currency;
      byCurrency[c] = (byCurrency[c] || 0) + parseFloat(d.extracted.total);
    });

  return (
    <div style={{ animation: 'slideUp 0.2s ease' }}>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 28 }}>
        <StatCard label="Total"        value={stats.total} />
        <StatCard label="Validated"    value={stats.validated}    color="#4ade80" />
        <StatCard label="Needs Review" value={stats.needs_review} color="#c8873a" />
        <StatCard label="Rejected"     value={stats.rejected}     color="#f87171" />
      </div>

      {/* Currency totals */}
      {Object.keys(byCurrency).length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {Object.entries(byCurrency).map(([cur, amt]) => (
            <div key={cur} style={{
              background: '#0a130d', border: '1px solid #163322',
              borderRadius: 4, padding: '4px 12px', fontSize: 12, color: '#4ade80',
              letterSpacing: '0.02em',
            }}>
              <span style={{ fontWeight: 600, marginRight: 6 }}>{cur}</span>
              {amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {docs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '100px 0', color: C.muted }}>
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12, color: C.subtle }}>No documents</div>
          <div style={{ fontSize: 13, marginBottom: 20, color: C.muted }}>Upload invoices or purchase orders to get started.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            background: C.surface, borderRadius: 8, overflow: 'hidden',
            border: `1px solid ${C.border}`,
          }}>
            <thead>
              <tr style={{ background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
                {['Document', 'Supplier', 'Doc #', 'Date', 'Total', 'Status', 'Issues', ''].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: 'left',
                    fontSize: 9, fontWeight: 600, color: C.muted,
                    textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map((doc, idx) => {
                const issues = validateDocument(doc);
                return (
                  <tr
                    key={doc.id}
                    className="fade-in"
                    style={{ borderBottom: `1px solid ${C.border}`, transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 500, fontSize: 12, color: C.text }}>{doc.name}</div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 2, letterSpacing: '0.02em' }}>
                        {doc.extracted?.documentType?.replace('_', ' ') || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#a09888' }}>{doc.extracted?.supplier || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: C.muted, fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                      {doc.extracted?.documentNumber || '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: C.muted }}>{doc.extracted?.issueDate || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                      {doc.extracted?.total
                        ? `${doc.extracted.currency || ''} ${parseFloat(doc.extracted.total).toFixed(2)}`
                        : '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}><StatusBadge status={doc.status} /></td>
                    <td style={{ padding: '12px 14px', fontSize: 11 }}>
                      {issues.length > 0
                        ? <span style={{ color: '#c8873a' }}>{issues.length} issue{issues.length > 1 ? 's' : ''}</span>
                        : <span style={{ color: '#3a6644' }}>Clean</span>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <ActionBtn label="Review" onClick={() => onReview(doc)} />
                        <ActionBtn label="✕" onClick={() => { if (window.confirm(`Delete "${doc.name}"?`)) onDelete(doc.id); }} danger />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
