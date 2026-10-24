import React, { useState, useEffect } from 'react';
import { Trophy, FileText, ChevronRight, BarChart2, Trash2 } from 'lucide-react';

export default function MetricsLeaderboard({ onDatasetChanged }) {
  const [metrics, setMetrics] = useState({ summary: [], breakdowns: {} });
  const [selectedBreakdown, setSelectedBreakdown] = useState('meta_mms_1b');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const fetchMetrics = () => {
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
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleDeleteSample = async (sampleId) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${sampleId} from the benchmark dataset?\n\nThis will remove its audio, ground truth reference, and recalculate all model CER metrics.`
    );
    if (!confirmed) return;

    setDeletingId(sampleId);
    try {
      const res = await fetch(`/api/dataset/delete-sample/${sampleId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Failed to delete sample from server.');
      }
      // Refresh local metrics table and notify parent
      fetchMetrics();
      if (onDatasetChanged) {
        onDatasetChanged();
      }
    } catch (err) {
      alert('Error deleting sample: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const getRankBadge = (idx) => {
    if (idx === 0) return '🥇 1st';
    if (idx === 1) return '🥈 2nd';
    if (idx === 2) return '🥉 3rd';
    return `#${idx + 1}`;
  };

  const getCerPillClass = (cer) => {
    if (cer <= 50) return 'cer-good';
    if (cer <= 70) return 'cer-mid';
    return 'cer-high';
  };

  const activeBreakdown = metrics.breakdowns[selectedBreakdown] || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Leaderboard Table Card */}
      <div className="bento-card">
        <div className="bento-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trophy size={20} color="var(--accent-yellow)" />
            <h2 className="bento-title">Consolidated Benchmark Directory</h2>
          </div>
          <span className="bento-tag">
            {metrics.summary.length > 0 ? `${metrics.summary[0].total_samples} Verified Samples` : 'Benchmark Samples'}
          </span>
        </div>

        <div className="editorial-table-container">
          <table className="editorial-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Model Identifier</th>
                <th>Type</th>
                <th>Samples</th>
                <th>Duration</th>
                <th>CER (%)</th>
                <th>Avg Latency</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {metrics.summary.map((row, idx) => {
                const isSelected = selectedBreakdown === row.model_name;
                return (
                  <tr
                    key={row.model_name}
                    className={isSelected ? 'selected-row' : ''}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedBreakdown(row.model_name)}
                  >
                    <td className="rank-badge-cell">{getRankBadge(idx)}</td>
                    <td>
                      <strong style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem' }}>
                        {row.model_name}
                      </strong>
                    </td>
                    <td>
                      <span className="model-type-tag">
                        {row.model_name.includes('google') ? 'Cloud API' : 'Open-Source'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{row.total_samples}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{row.total_duration_sec}s</td>
                    <td>
                      <span className={`cer-pill ${getCerPillClass(row['CER (%)'])}`}>
                        {row['CER (%)']}%
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{row.avg_latency_sec}s</td>
                    <td>
                      <button
                        type="button"
                        className="tactile-pill-btn"
                        style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                      >
                        Inspect Breakdown <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Model Breakdown Detail Table with Sample Deletion */}
      <div className="bento-card">
        <div className="bento-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={20} color="var(--accent-cobalt)" />
            <h3 className="bento-title">
              Sample-by-Sample Breakdown:{' '}
              <span style={{ color: 'var(--accent-cobalt)' }}>{selectedBreakdown}</span>
            </h3>
          </div>
          <span className="bento-tag">{activeBreakdown.length} Evaluations</span>
        </div>

        <div className="editorial-table-container" style={{ maxHeight: '520px', overflowY: 'auto' }}>
          <table className="editorial-table">
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Sample ID</th>
                <th style={{ minWidth: '220px' }}>Reference (Ground Truth)</th>
                <th style={{ minWidth: '220px' }}>Hypothesis (Model Output)</th>
                <th>S</th>
                <th>I</th>
                <th>D</th>
                <th>CER</th>
                <th>Latency</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Manage</th>
              </tr>
            </thead>
            <tbody>
              {activeBreakdown.map((row) => (
                <tr key={row.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--ink-muted)' }}>
                    {row.id}
                  </td>
                  <td className="khmer-text" style={{ fontSize: '0.92rem' }}>
                    {row.reference_raw || '(None)'}
                  </td>
                  <td className="khmer-text" style={{ fontSize: '0.92rem', color: 'var(--ink-secondary)' }}>
                    {row.hypothesis_raw || '(Empty)'}
                  </td>
                  <td style={{ color: '#854D0E', fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
                    {row.substitutions}
                  </td>
                  <td style={{ color: '#0369A1', fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
                    {row.insertions}
                  </td>
                  <td style={{ color: '#9F1239', fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
                    {row.deletions}
                  </td>
                  <td>
                    <span className={`cer-pill ${getCerPillClass(row.sample_cer_pct)}`}>
                      {row.sample_cer_pct}%
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{row.latency_sec}s</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="tactile-pill-btn danger-btn"
                      style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                      onClick={() => handleDeleteSample(row.id)}
                      disabled={deletingId === row.id}
                      title={`Delete ${row.id} from dataset`}
                    >
                      <Trash2 size={11} />
                      {deletingId === row.id ? '...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
