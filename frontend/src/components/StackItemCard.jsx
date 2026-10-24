import React, { useState } from 'react';
import { Clock, Play, FileAudio, Check, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

export default function StackItemCard({ item, isTop }) {
  const [showDetails, setShowDetails] = useState(false);

  // CER color classification
  const getCerBadgeClass = (cer) => {
    if (cer === null || cer === undefined) return 'badge-latency';
    if (cer <= 30.0) return 'badge-cer-good';
    if (cer <= 60.0) return 'badge-cer-mid';
    return 'badge-cer-high';
  };

  const cer = item.sample_cer_pct;

  return (
    <div className={`stack-card ${isTop ? 'top-item' : ''}`}>
      {/* Header with Badges */}
      <div className="stack-card-header">
        <div className="stack-badges">
          <span className="badge badge-model">{item.model_name}</span>

          {cer !== null && cer !== undefined ? (
            <span className={`badge ${getCerBadgeClass(cer)}`}>
              CER: {cer}%
            </span>
          ) : (
            <span className="badge badge-latency">No Reference CER</span>
          )}

          <span className="badge badge-latency">
            <Clock size={12} />
            {item.latency_sec}s
          </span>

          {item.duration_sec > 0 && (
            <span className="badge badge-latency">
              {item.duration_sec}s audio
            </span>
          )}
        </div>

        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
          {item.timestamp}
        </div>
      </div>

      {/* Audio Playback if available */}
      {item.audio_url && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <audio controls src={item.audio_url} style={{ height: '30px', width: '100%' }} />
        </div>
      )}

      {/* Side-by-side or stacked Expected Output vs Model Hypothesis */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Expected Output */}
        <div className="compare-box">
          <div className="compare-header">
            <span>Expected Output (Ground Truth Reference)</span>
            <span>{item.ref_len || 0} chars</span>
          </div>
          <div className="compare-content khmer-text">
            {item.reference_raw ? (
              item.reference_raw
            ) : (
              <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                (No expected output specified)
              </span>
            )}
          </div>
        </div>

        {/* Model Prediction */}
        <div className="compare-box" style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}>
          <div className="compare-header">
            <span style={{ color: '#818cf8' }}>Model Prediction (hypothesis_raw)</span>
            <span>{item.hyp_len || 0} chars</span>
          </div>
          <div className="compare-content khmer-text">
            {item.hypothesis_raw || (
              <span style={{ color: '#f87171', fontStyle: 'italic' }}>(Empty prediction)</span>
            )}
          </div>
        </div>
      </div>

      {/* Visual Character Alignment Diff (if reference exists) */}
      {item.diff_tokens && item.diff_tokens.length > 0 && (
        <div className="compare-box" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="compare-header">
            <span>Character-Level Visual Alignment Diff</span>
            <div style={{ display: 'flex', gap: '8px', textTransform: 'none' }}>
              <span style={{ color: '#fde68a' }}>● Sub ({item.substitutions})</span>
              <span style={{ color: '#fca5a5' }}>● Ins ({item.insertions})</span>
              <span style={{ color: '#c7d2fe' }}>● Del ({item.deletions})</span>
            </div>
          </div>
          <div className="diff-container khmer-text">
            {item.diff_tokens.map((token, idx) => {
              if (token.tag === 'equal') {
                return <span key={idx}>{token.ref_text}</span>;
              }
              if (token.tag === 'replace') {
                return (
                  <span
                    key={idx}
                    className="diff-token-replace"
                    title={`Sub: "${token.ref_text}" → "${token.hyp_text}"`}
                  >
                    {token.hyp_text || ' '}
                  </span>
                );
              }
              if (token.tag === 'insert') {
                return (
                  <span
                    key={idx}
                    className="diff-token-insert"
                    title={`Inserted: "${token.hyp_text}"`}
                  >
                    {token.hyp_text}
                  </span>
                );
              }
              if (token.tag === 'delete') {
                return (
                  <span
                    key={idx}
                    className="diff-token-delete"
                    title={`Deleted: "${token.ref_text}"`}
                  >
                    {token.ref_text}
                  </span>
                );
              }
              return null;
            })}
          </div>
        </div>
      )}

      {/* Collapsible Inspection Details */}
      <div>
        <button
          className="btn-secondary"
          style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem' }}
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? (
            <>
              Hide Normalized Data & Parameters <ChevronUp size={14} />
            </>
          ) : (
            <>
              Inspect Normalized Data (NFC & Zero-Width stripped) <ChevronDown size={14} />
            </>
          )}
        </button>

        {showDetails && (
          <div
            style={{
              marginTop: '10px',
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '8px',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div>
              <strong style={{ color: 'var(--text-muted)' }}>Normalized Reference:</strong>
              <div className="khmer-text" style={{ color: '#cbd5e1' }}>
                {item.reference_norm || 'None'}
              </div>
            </div>
            <div>
              <strong style={{ color: 'var(--text-muted)' }}>Normalized Hypothesis:</strong>
              <div className="khmer-text" style={{ color: '#cbd5e1' }}>
                {item.hypothesis_norm || 'None'}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: '16px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                paddingTop: '6px',
                color: 'var(--text-dim)',
              }}
            >
              <span>Audio: {item.audio_filename}</span>
              <span>Substitutions: {item.substitutions}</span>
              <span>Insertions: {item.insertions}</span>
              <span>Deletions: {item.deletions}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
