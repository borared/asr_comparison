import React, { useState, useEffect } from 'react';
import { Trophy, FileText, ChevronRight, BarChart2, Trash2, Eye } from 'lucide-react';
import StackItemCard from './StackItemCard';

export default function MetricsLeaderboard({ onDatasetChanged }) {
  const [metrics, setMetrics] = useState({ summary: [], breakdowns: {} });
  const [selectedBreakdown, setSelectedBreakdown] = useState('meta_mms_1b');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [expandedSampleId, setExpandedSampleId] = useState(null);
  const [expandedDetailData, setExpandedDetailData] = useState({});
  const [loadingDetailId, setLoadingDetailId] = useState(null);

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

  const handleToggleDetail = async (sampleId) => {
    if (expandedSampleId === sampleId) {
      setExpandedSampleId(null);
      return;
    }

    setExpandedSampleId(sampleId);
    const cacheKey = `${selectedBreakdown}_${sampleId}`;
    if (!expandedDetailData[cacheKey]) {
      setLoadingDetailId(sampleId);
      try {
        const res = await fetch(`/api/dataset/sample-detail/${selectedBreakdown}/${sampleId}`);
        if (res.ok) {
          const detail = await res.json();
          setExpandedDetailData((prev) => ({ ...prev, [cacheKey]: detail }));
        }
      } catch (err) {
        console.error('Error fetching sample detail:', err);
      } finally {
        setLoadingDetailId(null);
      }
    }
  };

  const executeDelete = async (sampleId) => {
    setDeletingId(sampleId);
    setConfirmingId(null);

    // Optimistic UI update: instantly remove sample from current state
    setMetrics((prev) => {
      const nextBreakdowns = { ...prev.breakdowns };
      for (const key of Object.keys(nextBreakdowns)) {
        nextBreakdowns[key] = nextBreakdowns[key].filter((r) => r.id !== sampleId);
      }
      const nextSummary = prev.summary.map((s) => ({
        ...s,
        total_samples: Math.max(0, s.total_samples - 1),
      }));
      return { ...prev, breakdowns: nextBreakdowns, summary: nextSummary };
    });

    try {
      const res = await fetch(`/api/dataset/delete-sample/${sampleId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Failed to delete sample from server.');
      }
      // Re-fetch authoritative recalculated metrics from server
      fetchMetrics();
      if (onDatasetChanged) {
        onDatasetChanged();
      }
    } catch (err) {
      alert('Error deleting sample: ' + err.message);
      fetchMetrics(); // Rollback if server errored
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
                <th style={{ minWidth: '140px', textAlign: 'center' }}>Manage</th>
              </tr>
            </thead>
            <tbody>
              {activeBreakdown.map((row) => (
                <React.Fragment key={row.id}>
                  <tr>
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
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="tactile-pill-btn"
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.7rem',
                            background: expandedSampleId === row.id ? 'var(--ink-black)' : '#FFFFFF',
                            color: expandedSampleId === row.id ? '#FFFFFF' : 'var(--ink-black)',
                          }}
                          onClick={() => handleToggleDetail(row.id)}
                          title={`View detailed comparison and audio for ${row.id}`}
                        >
                          <Eye size={12} />
                          {expandedSampleId === row.id ? 'Hide' : 'Detail'}
                        </button>

                        {confirmingId === row.id ? (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              className="tactile-pill-btn"
                              style={{
                                background: '#DC2626',
                                color: '#FFFFFF',
                                borderColor: '#991B1B',
                                padding: '4px 8px',
                                fontSize: '0.7rem',
                                fontWeight: '700',
                              }}
                              onClick={() => executeDelete(row.id)}
                              disabled={deletingId === row.id}
                            >
                              Confirm?
                            </button>
                            <button
                              type="button"
                              className="tactile-pill-btn"
                              style={{
                                background: '#F1F5F9',
                                color: '#475569',
                                padding: '4px 6px',
                                fontSize: '0.7rem',
                              }}
                              onClick={() => setConfirmingId(null)}
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="tactile-pill-btn danger-btn"
                            style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                            onClick={() => setConfirmingId(row.id)}
                            disabled={deletingId === row.id}
                            title={`Delete ${row.id} from dataset`}
                          >
                            <Trash2 size={11} />
                            {deletingId === row.id ? '...' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Detail View */}
                  {expandedSampleId === row.id && (
                    <tr className="detail-expanded-row">
                      <td colSpan={9} style={{ padding: '16px 20px', background: '#FAF8F5', borderBottom: '2px solid var(--ink-black)' }}>
                        {loadingDetailId === row.id ? (
                          <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                            Loading evaluation details for {row.id}...
                          </div>
                        ) : expandedDetailData[`${selectedBreakdown}_${row.id}`] ? (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '0.82rem', color: 'var(--ink-secondary)' }}>
                                DETAIL ANALYSIS: {row.id} ({selectedBreakdown})
                              </span>
                              <button
                                type="button"
                                className="tactile-pill-btn"
                                style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                                onClick={() => setExpandedSampleId(null)}
                              >
                                Close Detail ✕
                              </button>
                            </div>

                            <StackItemCard
                              item={expandedDetailData[`${selectedBreakdown}_${row.id}`]}
                              isTop={true}
                            />
                          </div>
                        ) : (
                          <div style={{ padding: '16px', color: 'var(--ink-muted)' }}>
                            No detail data available for {row.id}.
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
