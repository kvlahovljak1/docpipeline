import React from 'react';

const CONFIG = {
  uploaded:     { label: 'Uploaded',     bg: '#0f1118', color: '#5a7da8', border: '#1a2535' },
  needs_review: { label: 'Needs Review', bg: '#130f07', color: '#c8873a', border: '#2e1e08' },
  validated:    { label: 'Validated',    bg: '#0a130d', color: '#4ade80', border: '#163322' },
  rejected:     { label: 'Rejected',     bg: '#130808', color: '#f87171', border: '#2e1212' },
};

export default function StatusBadge({ status }) {
  const cfg = CONFIG[status] || CONFIG.uploaded;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 3,
      fontSize: 10,
      fontWeight: 500,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      background: cfg.bg,
      color: cfg.color,
      border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </span>
  );
}
