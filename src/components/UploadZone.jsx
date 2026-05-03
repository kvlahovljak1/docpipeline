import React, { useRef, useState } from 'react';
import { C } from '../App';

export default function UploadZone({ onFiles }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleDrop = e => {
    e.preventDefault(); setDragging(false);
    onFiles([...e.dataTransfer.files]);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current.click()}
      style={{
        border: `1px solid ${dragging ? C.accent : C.border}`,
        borderRadius: 8,
        padding: '36px 24px',
        textAlign: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        background: dragging ? C.accentDim : C.surface,
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <input ref={inputRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.csv,.txt"
        style={{ display: 'none' }} onChange={e => onFiles([...e.target.files])} />

      {/* Upload icon */}
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: dragging ? C.accentBorder : C.surface2,
        border: `1px solid ${dragging ? C.accent : C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 14px',
        transition: 'all 0.2s',
        fontSize: 16, color: dragging ? C.accent : C.muted,
      }}>
        ↑
      </div>

      <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 4 }}>
        {dragging ? 'Drop to upload' : 'Drop files or click to browse'}
      </div>
      <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.02em' }}>
        .txt · .csv · .pdf · .png · .jpg
      </div>
    </div>
  );
}
