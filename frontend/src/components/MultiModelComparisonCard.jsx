import React, { useState } from 'react';
import { Volume2, Trophy, Eye } from 'lucide-react';

export default function MultiModelComparisonCard({ item, isTop }) {
  const [expandedModelId, setExpandedModelId] = useState(null);

  const getRankBadge = (idx) => {
    if (idx === 0) return '🥇 1st';
    if (idx === 1) return '🥈 2nd';
    if (idx === 2) return '🥉 3rd';
    return `#${idx + 1}`;
  };

  const getCerClass = (cerVal) => {
    if (cerVal === null || cerVal === undefined) return '';
    if (cerVal <= 50.0) return 'cer-good';
    if (cerVal <= 70.0) return 'cer-mid';
    return 'cer-high';
  };

  const toggleDiff = (modelId) => {
    setExpandedModelId((prev) => (prev === modelId ? null : modelId));
  };

  const results = item.results || [];

  return (
    <div className={`stack-item-card ${isTop ? 'is-top' : ''}`} style={{ borderColor: 'var(--ink-black)' }}>
      {/* Header */}
      <div className="stack-item-header">
        <div className="stack-item-badges">
          <span
            className="model-name-pill"
            style={{
              background: 'var(--ink-black)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Trophy size={13} color="var(--accent-yellow)" />
            <span>ALL 5 MODELS BENCHMARK SUITE</span>
          </span>

          {item.is_benchmark_sample && (
            <span
              className="tab-counter-pill"
              style={{
                background: 'var(--card-warm)',
                color: 'var(--ink-black)',
                fontWeight: '800',
              }}
            >
              ID: {item.id}
            </span>
          )}

          {item.duration_sec > 0 && (
            <span className="latency-pill">
              <Volume2 size={13} />
              {item.duration_sec}s Audio
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

      {/* Expected Output Box */}
      <div className="comparison-box" style={{ marginBottom: '16px' }}>
        <div className="comparison-title">
          <span>Expected Output (Ground Truth Reference)</span>
          <span>{item.ref_len || (item.reference_raw ? item.reference_raw.length : 0)} Chars</span>
        </div>
        <div className="comparison-text khmer-text" style={{ fontSize: '1rem', color: 'var(--ink-black)' }}>
          {item.reference_raw ? (
            item.reference_raw
          ) : (
            <span style={{ color: 'var(--ink-muted)', fontStyle: 'italic' }}>
              (No expected reference provided — CER cannot be computed without expected text)
            </span>
          )}
        </div>
      </div>

      {/* Ranked Side-by-Side Comparison Table */}
      <div className="editorial-table-container" style={{ background: '#FFFFFF', borderRadius: 'var(--radius-lg)' }}>
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1.5px solid var(--border-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--card-warm)',
          }}
        >
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: '800', fontSize: '0.85rem' }}>
            SIDE-BY-SIDE RANKED MODEL PREDICTIONS ({results.length} MODELS)
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--ink-secondary)' }}>
            Sorted by lowest CER (%)
          </span>
        </div>

        <table className="editorial-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Rank</th>
              <th style={{ minWidth: '160px' }}>Model & Architecture</th>
              <th style={{ minWidth: '220px' }}>Predicted Hypothesis (Output)</th>
              <th style={{ width: '50px' }} title="Substitutions">S</th>
              <th style={{ width: '50px' }} title="Insertions">I</th>
              <th style={{ width: '50px' }} title="Deletions">D</th>
              <th style={{ width: '100px' }}>CER (%)</th>
              <th style={{ width: '85px' }}>Latency</th>
              <th style={{ width: '100px', textAlign: 'center' }}>Diff Inspector</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, idx) => {
              const isExpanded = expandedModelId === r.model_id;
              const hasDiff = r.diff_tokens && r.diff_tokens.length > 0;

              return (
                <React.Fragment key={r.model_id}>
                  <tr
                    className={idx === 0 ? 'top-ranked-row' : ''}
                    style={{
                      background: idx === 0 ? '#FEFCE8' : isExpanded ? '#F8FAFC' : 'inherit',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <td className="rank-badge-cell" style={{ fontWeight: '800' }}>
                      {getRankBadge(idx)}
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem' }}>
                          {r.model_name}
                        </strong>
                        <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                          {r.architecture} • {r.parameters}
                        </span>
                      </div>
                    </td>

                    <td className="khmer-text" style={{ fontSize: '0.92rem', color: 'var(--ink-black)' }}>
                      {r.hypothesis_raw ? (
                        r.hypothesis_raw
                      ) : (
                        <span style={{ color: '#DC2626', fontStyle: 'italic', fontSize: '0.82rem' }}>
                          {r.error ? `Error: ${r.error}` : '(Empty transcription)'}
                        </span>
                      )}
                    </td>

                    <td style={{ color: '#854D0E', fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
                      {r.substitutions}
                    </td>
                    <td style={{ color: '#0369A1', fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
                      {r.insertions}
                    </td>
                    <td style={{ color: '#9F1239', fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
                      {r.deletions}
                    </td>

                    <td>
                      {r.sample_cer_pct !== null && r.sample_cer_pct !== undefined ? (
                        <span className={`cer-pill ${getCerClass(r.sample_cer_pct)}`}>
                          {r.sample_cer_pct}%
                        </span>
                      ) : (
                        <span className="cer-pill" style={{ background: '#F1F5F9', color: '#64748B' }}>
                          N/A
                        </span>
                      )}
                    </td>

                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                      {r.latency_sec}s
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      {hasDiff ? (
                        <button
                          type="button"
                          className="tactile-pill-btn"
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.7rem',
                            background: isExpanded ? 'var(--ink-black)' : '#FFFFFF',
                            color: isExpanded ? '#FFFFFF' : 'var(--ink-black)',
                          }}
                          onClick={() => toggleDiff(r.model_id)}
                          title="View Character-level alignment diff"
                        >
                          <Eye size={12} />
                          {isExpanded ? 'Close' : 'Diff'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>-</span>
                      )}
                    </td>
                  </tr>

                  {/* Expandable Character Diff Accordion */}
                  {isExpanded && hasDiff && (
                    <tr className="diff-inline-row">
                      <td colSpan={9} style={{ padding: '14px 20px', background: '#FAFAF9', borderBottom: '2px solid var(--ink-black)' }}>
                        <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: '800', color: 'var(--ink-secondary)' }}>
                            CHARACTER ALIGNMENT DIFF FOR: {r.model_name}
                          </span>
                          <div style={{ display: 'flex', gap: '8px', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                            <span style={{ color: '#854D0E', fontWeight: '700' }}>● Sub ({r.substitutions})</span>
                            <span style={{ color: '#0369A1', fontWeight: '700' }}>● Ins ({r.insertions})</span>
                            <span style={{ color: '#9F1239', fontWeight: '700' }}>● Del ({r.deletions})</span>
                          </div>
                        </div>

                        <div className="diff-stream khmer-text" style={{ fontSize: '1rem', lineHeight: '1.9' }}>
                          {r.diff_tokens.map((token, tIdx) => {
                            if (token.tag === 'equal') {
                              return <span key={tIdx} className="diff-char-equal">{token.ref_text}</span>;
                            }
                            if (token.tag === 'replace') {
                              return (
                                <span key={tIdx} className="diff-char-replace" title={`Expected: '${token.ref_text}' -> Got: '${token.hyp_text}'`}>
                                  <span className="diff-sub-del">{token.ref_text}</span>
                                  <span className="diff-sub-ins">{token.hyp_text}</span>
                                </span>
                              );
                            }
                            if (token.tag === 'delete') {
                              return (
                                <span key={tIdx} className="diff-char-delete" title={`Deleted: '${token.ref_text}'`}>
                                  {token.ref_text}
                                </span>
                              );
                            }
                            if (token.tag === 'insert') {
                              return (
                                <span key={tIdx} className="diff-char-insert" title={`Inserted: '${token.hyp_text}'`}>
                                  {token.hyp_text}
                                </span>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
