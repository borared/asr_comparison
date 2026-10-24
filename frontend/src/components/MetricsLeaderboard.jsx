import React, { useState, useEffect } from 'react';
import { Trophy, BarChart2, CheckCircle2, ChevronRight, FileText } from 'lucide-react';

export default function MetricsLeaderboard() {
  const [metrics, setMetrics] = useState({ summary: [], breakdowns: {} });
  const [selectedBreakdown, setSelectedBreakdown] = useState('meta_mms_1b');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/metrics')
      .then((res) => res.json())
      .then((data) => {
        setMetrics(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load metrics:', err);
        setLoading(false);
      });
  }, []);

  const getRankBadge = (idx) => {
    if (idx === 0) return '🥇 1st';
    if (idx === 1) return '🥈 2nd';
    if (idx === 2) return '🥉 3rd';
    return `#${idx + 1}`;
  };

  const getCerColor = (cer) => {
    if (cer <= 50) return '#34d399';
    if (cer <= 65) return '#fbbf24';
    return '#f87171';
  };

  const activeBreakdown = metrics.breakdowns[selectedBreakdown] || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Leaderboard Table Card */}
      <div className="glass-card">
        <div className="panel-header">
          <h2 className="panel-title">
            <Trophy size={18} color="#eab308" />
            Standardized Khmer ASR Benchmark Leaderboard
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            16 Evaluated Samples (230.63s) • Metric: CER (%)
          </span>
        </div>

        <div className="table-container">
          <table className="metrics-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Model Identifier</th>
                <th>Type</th>
                <th>Samples</th>
                <th>Audio (s)</th>
                <th>CER (%)</th>
                <th>Avg Latency (s)</th>
                <th>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {metrics.summary.map((row, idx) => (
                <tr
                  key={row.model_name}
                  style={{
                    background:
                      selectedBreakdown === row.model_name
                        ? 'rgba(99, 102, 241, 0.08)'
                        : 'transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedBreakdown(row.model_name)}
                >
                  <td style={{ fontWeight: '700' }}>{getRankBadge(idx)}</td>
                  <td>
                    <strong>{row.model_name}</strong>
                  </td>
                  <td>
                    <span
                      className="model-tag"
                      style={{
                        background: row.model_name.includes('google')
                          ? 'rgba(6,182,212,0.2)'
                          : 'rgba(99,102,241,0.2)',
                        color: row.model_name.includes('google') ? '#22d3ee' : '#818cf8',
                      }}
                    >
                      {row.model_name.includes('google') ? 'Cloud API' : 'Open-Source'}
                    </span>
                  </td>
                  <td>{row.total_samples}</td>
                  <td>{row.total_duration_sec}s</td>
                  <td>
                    <strong style={{ color: getCerColor(row['CER (%)']), fontSize: '1rem' }}>
                      {row['CER (%)']}%
                    </strong>
                  </td>
                  <td>{row.avg_latency_sec}s</td>
                  <td>
                    <button
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                    >
                      View Breakdown <ChevronRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Model Breakdown Detail Table */}
      <div className="glass-card">
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700' }}>
              Error Breakdown for: <span style={{ color: '#818cf8' }}>{selectedBreakdown}</span>
            </h3>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Showing {activeBreakdown.length} Sentence Evaluations
          </span>
        </div>

        <div className="table-container" style={{ maxHeight: '520px', overflowY: 'auto' }}>
          <table className="metrics-table">
            <thead>
              <tr>
                <th style={{ width: '100px' }}>ID</th>
                <th style={{ minWidth: '220px' }}>Reference (Ground Truth)</th>
                <th style={{ minWidth: '220px' }}>Hypothesis (Model Output)</th>
                <th>S</th>
                <th>I</th>
                <th>D</th>
                <th>Sample CER</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {activeBreakdown.map((row) => (
                <tr key={row.id}>
                  <td style={{ fontWeight: '600', color: 'var(--text-dim)' }}>{row.id}</td>
                  <td className="khmer-text" style={{ fontSize: '0.88rem' }}>
                    {row.reference_raw || '(None)'}
                  </td>
                  <td className="khmer-text" style={{ fontSize: '0.88rem', color: '#cbd5e1' }}>
                    {row.hypothesis_raw || '(Empty)'}
                  </td>
                  <td style={{ color: '#fde68a' }}>{row.substitutions}</td>
                  <td style={{ color: '#fca5a5' }}>{row.insertions}</td>
                  <td style={{ color: '#c7d2fe' }}>{row.deletions}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background:
                          row.sample_cer_pct <= 30
                            ? 'var(--success-bg)'
                            : row.sample_cer_pct <= 60
                            ? 'var(--warning-bg)'
                            : 'var(--danger-bg)',
                        color:
                          row.sample_cer_pct <= 30
                            ? '#34d399'
                            : row.sample_cer_pct <= 60
                            ? '#fbbf24'
                            : '#f87171',
                      }}
                    >
                      {row.sample_cer_pct}%
                    </span>
                  </td>
                  <td>{row.latency_sec}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
