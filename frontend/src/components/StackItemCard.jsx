import React, { useState } from 'react';
import { Clock, Volume2, ChevronDown, ChevronUp, CheckCircle, AlertCircle } from 'lucide-react';

export default function StackItemCard({ item, isTop }) {
  const [showTechnical, setShowTechnical] = useState(false);

  const cer = item.sample_cer_pct;

  const getCerClass = (cerVal) => {
    if (cerVal === null || cerVal === undefined) return '';
    if (cerVal <= 50.0) return 'cer-good';
    if (cerVal <= 70.0) return 'cer-mid';
    return 'cer-high';
  };

  return (
    <div className={`stack-item-card ${isTop ? 'is-top' : ''}`}>
      {/* Header with Model, CER Pill & Latency */}
      <div className="stack-item-header">
        <div className="stack-item-badges">
          <span className="model-name-pill">{item.model_name}</span>

          {cer !== null && cer !== undefined ? (
            <span className={`cer-pill ${getCerClass(cer)}`}>
              CER: {cer}%
            </span>
          ) : (
            <span className="cer-pill" style={{ background: '#F1F5F9', color: '#475569' }}>
              No CER (No Expected Text)
            </span>
          )}

          <span className="latency-pill">
            <Clock size={13} />
            {item.latency_sec}s
          </span>

          {item.duration_sec > 0 && (
            <span className="latency-pill">
              <Volume2 size={13} />
              {item.duration_sec}s
            </span>
          )}
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
          {item.timestamp}
        </div>
      </div>

      {/* Audio Playback Bar */}
      {item.audio_url && (
        <div className="audio-player-strip">
          <Volume2 size={16} color="var(--accent-cobalt)" />
          <audio controls src={item.audio_url} style={{ width: '100%', height: '30px' }} />
        </div>
      )}

      {/* Comparison Grid: Expected vs Prediction */}
      <div className="comparison-grid">
        <div className="comparison-box">
          <div className="comparison-title">
            <span>Expected Output (Reference)</span>
            <span>{item.ref_len || 0} Chars</span>
          </div>
          <div className="comparison-text khmer-text">
            {item.reference_raw ? (
              item.reference_raw
            ) : (
              <span style={{ color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                (No ground truth reference provided)
              </span>
            )}
          </div>
        </div>

        <div className="comparison-box prediction-box">
          <div className="comparison-title" style={{ color: 'var(--accent-cobalt)' }}>
            <span>Model Prediction (hypothesis_raw)</span>
            <span>{item.hyp_len || 0} Chars</span>
          </div>
          <div className="comparison-text khmer-text">
            {item.hypothesis_raw ? (
              item.hypothesis_raw
            ) : (
              <span style={{ color: '#DC2626', fontStyle: 'italic' }}>
                (Empty prediction)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Visual Character Alignment Diff */}
      {item.diff_tokens && item.diff_tokens.length > 0 && (
        <div className="diff-editorial-box">
          <div className="diff-legend-row">
            <span>CHARACTER-LEVEL ALIGNMENT DIFF</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ color: '#854D0E' }}>● Sub ({item.substitutions})</span>
              <span style={{ color: '#0369A1' }}>● Ins ({item.insertions})</span>
              <span style={{ color: '#9F1239' }}>● Del ({item.deletions})</span>
            </div>
          </div>

          <div className="diff-stream khmer-text">
            {item.diff_tokens.map((token, idx) => {
              if (token.tag === 'equal') {
                return <span key={idx}>{token.ref_text}</span>;
              }
              if (token.tag === 'replace') {
                return (
                  <span
                    key={idx}
                    className="token-sub"
                    title={`Substituted: "${token.ref_text}" → "${token.hyp_text}"`}
                  >
                    {token.hyp_text || ' '}
                  </span>
                );
              }
              if (token.tag === 'insert') {
                return (
                  <span
                    key={idx}
                    className="token-ins"
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
                    className="token-del"
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
          type="button"
          className="tactile-pill-btn"
          style={{ width: '100%', justifyContent: 'center', fontSize: '0.74rem' }}
          onClick={() => setShowTechnical(!showTechnical)}
        >
          {showTechnical ? (
            <>
              Hide Normalized Inspection <ChevronUp size={14} />
            </>
          ) : (
            <>
              Inspect Normalized Data (NFC & ZWSP Stripped) <ChevronDown size={14} />
            </>
          )}
        </button>

        {showTechnical && (
          <div
            style={{
              marginTop: '10px',
              padding: '14px',
              background: 'var(--card-warm)',
              border: 'var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div>
              <strong style={{ color: 'var(--ink-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                Normalized Reference:
              </strong>
              <div className="khmer-text">{item.reference_norm || '(None)'}</div>
            </div>
            <div>
              <strong style={{ color: 'var(--ink-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                Normalized Hypothesis:
              </strong>
              <div className="khmer-text">{item.hypothesis_norm || '(Empty)'}</div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: '14px',
                borderTop: '1px solid #E2E8F0',
                paddingTop: '8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                color: 'var(--ink-muted)',
                flexWrap: 'wrap',
              }}
            >
              <span>Audio: {item.audio_filename}</span>
              <span>Substitutions: {item.substitutions}</span>
              <span>Insertions: {item.insertions}</span>
              <span>Deletions: {item.deletions}</span>
              <span>Ref Chars: {item.ref_len}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
