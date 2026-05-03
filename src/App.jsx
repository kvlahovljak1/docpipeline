import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import UploadZone from './components/UploadZone';
import ReviewPanel from './components/ReviewPanel';
import { readAndExtract } from './lib/extractor';
import { validateDocument } from './lib/validation';
import { fetchAllDocs, insertDoc, updateDoc as updateDocDB, deleteDoc } from './lib/supabase';

// ── Design tokens — CoffeeTech-inspired ─────────────────────────────────────
export const C = {
  bg:        '#0a0a0b',       // near-black
  nav:       '#0d0d0f',       // slightly lighter nav
  surface:   '#111114',       // card/panel backgrounds
  surface2:  '#161619',       // hover / table header
  border:    '#222228',       // subtle borders
  text:      '#e8e3dc',       // warm off-white
  muted:     '#4a4a52',       // secondary text
  subtle:    '#2a2a2e',       // very dim text/icons
  accent:    '#c8873a',       // amber/orange — the CoffeeTech orange
  accentDim: '#1e1409',       // accent background tint
  accentBorder: '#3d2810',    // accent border tint
  green:     '#4ade80',
  amber:     '#f0a843',
  red:       '#f87171',
};

function Spinner({ size = 13 }) {
  return <span style={{
    display: 'inline-block', width: size, height: size,
    border: `1.5px solid ${C.subtle}`, borderTopColor: C.accent,
    borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0,
  }} />;
}

function NavDot({ ok }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 11, letterSpacing: '0.04em',
      color: ok ? '#3a6644' : '#6b3030',
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: ok ? C.green : C.red,
        boxShadow: ok ? `0 0 6px ${C.green}55` : `0 0 6px ${C.red}55`,
        display: 'inline-block',
      }} />
      {ok ? 'Connected' : 'DB offline'}
    </span>
  );
}

function TabBtn({ active, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 14px', borderRadius: 5, border: 'none', fontSize: 12,
      fontWeight: 400, letterSpacing: '0.02em',
      background: 'transparent',
      color: active ? C.text : C.muted,
      borderBottom: active ? `1px solid ${C.accent}` : '1px solid transparent',
      transition: 'all 0.15s',
      borderRadius: 0,
      paddingBottom: 6,
    }}>{label}</button>
  );
}

export default function App() {
  const [docs, setDocs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [processing, setProcessing]   = useState(false);
  const [processingName, setName]     = useState('');
  const [ocrProgress, setOcrProgress] = useState(null);
  const [reviewing, setReviewing]     = useState(null);
  const [tab, setTab]                 = useState('dashboard');
  const [errors, setErrors]           = useState([]);
  const [dbError, setDbError]         = useState(null);

  const addError = msg => setErrors(p => [...p, msg]);
  const removeError = i => setErrors(p => p.filter((_, idx) => idx !== i));

  useEffect(() => {
    fetchAllDocs()
      .then(data => { setDocs(data); setLoading(false); })
      .catch(err => { setDbError(err.message); setLoading(false); });
  }, []);

  const processFiles = async (files) => {
    for (const file of files) {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      setName(file.name); setProcessing(true); setOcrProgress(null);
      setDocs(prev => [{ id: tempId, name: file.name, status: 'uploaded', extracted: {}, type: file.type }, ...prev]);
      try {
        const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name);
        if (isImage) setOcrProgress(0);
        const extracted = await readAndExtract(file, isImage ? pct => setOcrProgress(pct) : null);
        const issueCount = validateDocument({ extracted }).length;
        const status = issueCount > 0 ? 'needs_review' : 'validated';
        const saved = await insertDoc({ id: tempId, name: file.name, type: file.type, status, extracted });
        setDocs(prev => prev.map(d => d.id === tempId ? saved : d));
      } catch (err) {
        addError(`"${file.name}" — ${err.message}`);
        setDocs(prev => prev.filter(d => d.id !== tempId));
      }
      setProcessing(false); setOcrProgress(null); setName('');
    }
    setTab('dashboard');
  };

  const handleUpdateDoc = async (id, fields, status) => {
    try {
      const saved = await updateDocDB(id, fields, status);
      setDocs(prev => prev.map(d => d.id === id ? saved : d));
    } catch (err) { addError(`Save failed: ${err.message}`); }
  };

  const handleDeleteDoc = async (id) => {
    try {
      await deleteDoc(id);
      setDocs(prev => prev.filter(d => d.id !== id));
    } catch (err) { addError(`Delete failed: ${err.message}`); }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>

      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: `${C.nav}ee`, backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${C.border}`,
        padding: '0 32px', display: 'flex', alignItems: 'center', height: 52, gap: 32,
      }}>
        {/* Wordmark */}
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', color: C.text, textTransform: 'uppercase' }}>
          Doc<span style={{ color: C.accent }}>Pipeline</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: 'none' }}>
          <TabBtn active={tab === 'dashboard'} label="Dashboard" onClick={() => setTab('dashboard')} />
          <TabBtn active={tab === 'upload'}    label="Upload"    onClick={() => setTab('upload')} />
        </div>

        {/* Right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          {processing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: C.muted, letterSpacing: '0.02em' }}>
              <Spinner size={11} />
              {ocrProgress !== null ? `OCR ${ocrProgress}%` : 'Processing'}&nbsp;·&nbsp;
              <span style={{ color: C.text, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{processingName}</span>
            </div>
          )}
          <NavDot ok={!dbError} />
        </div>
      </nav>

      {/* ── Content ── */}
      <main style={{ padding: '36px 32px', maxWidth: 1140, margin: '0 auto' }}>

        {/* DB error banner */}
        {dbError && (
          <div style={{
            background: C.accentDim, border: `1px solid #3a1515`,
            borderRadius: 6, padding: '12px 16px', marginBottom: 20,
            fontSize: 12, color: C.red, lineHeight: 1.6,
          }}>
            <strong>Database unreachable</strong> — {dbError}<br/>
            <span style={{ color: '#a07070', fontSize: 11 }}>Check your .env file and run supabase/schema.sql in your Supabase SQL editor.</span>
          </div>
        )}

        {/* Processing errors */}
        {errors.map((err, i) => (
          <div key={i} style={{
            background: '#130d0d', border: '1px solid #2e1515',
            borderRadius: 6, padding: '9px 14px', marginBottom: 8,
            fontSize: 12, color: '#cc7070',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          }}>
            <span>{err}</span>
            <button onClick={() => removeError(i)} style={{ background: 'none', border: 'none', color: '#cc7070', fontSize: 15, lineHeight: 1, opacity: 0.7 }}>×</button>
          </div>
        ))}

        {/* ── Upload tab ── */}
        {tab === 'upload' && (
          <div style={{ maxWidth: 520, animation: 'slideUp 0.2s ease' }}>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 20, fontWeight: 500, color: C.text, letterSpacing: '-0.02em', marginBottom: 6 }}>
                Upload Documents
              </h1>
              <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
                Invoices and purchase orders. Extraction runs locally — no API key required.
              </p>
            </div>

            <UploadZone onFiles={processFiles} />

            {/* OCR progress */}
            {ocrProgress !== null && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, display: 'flex', justifyContent: 'space-between', letterSpacing: '0.02em' }}>
                  <span>OCR · {processingName}</span>
                  <span style={{ color: C.accent }}>{ocrProgress}%</span>
                </div>
                <div style={{ height: 2, background: C.subtle, borderRadius: 1, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${ocrProgress}%`, background: C.accent, transition: 'width 0.3s ease' }} />
                </div>
              </div>
            )}

            {/* Format cards */}
            <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { fmt: '.txt',      note: 'Free text or key: value pairs' },
                { fmt: '.csv',      note: 'Header row + line items' },
                { fmt: '.pdf',      note: 'Text-based PDFs only' },
                { fmt: '.png/.jpg', note: 'OCR via Tesseract (~10s)' },
              ].map(({ fmt, note }) => (
                <div key={fmt} style={{
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 6, padding: '10px 12px',
                  transition: 'border-color 0.15s',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.accent, marginBottom: 3, fontFamily: 'monospace', letterSpacing: '0.04em' }}>{fmt}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{note}</div>
                </div>
              ))}
            </div>

            {/* Sample */}
            <div style={{ marginTop: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Sample .txt</div>
              <pre style={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7, color: C.muted, whiteSpace: 'pre-wrap' }}>{`INVOICE #INV-2024-007
From: Acme Corp
Date: 2024-03-15   Due: 2024-04-15

Item: Consulting   10   150.00   1500.00
Item: Hosting       1    50.00     50.00

Subtotal: 1550.00
Tax: 155.00
Total: 1705.00
Currency: USD`}</pre>
            </div>
          </div>
        )}

        {/* ── Dashboard tab ── */}
        {tab === 'dashboard' && (
          loading
            ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.muted, padding: '64px 0', fontSize: 13 }}>
                <Spinner size={14} /> Loading…
              </div>
            )
            : <Dashboard docs={docs} onReview={setReviewing} onDelete={handleDeleteDoc} />
        )}
      </main>

      {reviewing && (
        <ReviewPanel doc={reviewing} allDocs={docs} onUpdate={handleUpdateDoc} onClose={() => setReviewing(null)} />
      )}
    </div>
  );
}
