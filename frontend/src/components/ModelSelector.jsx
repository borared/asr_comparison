import React from 'react';
import { Cpu } from 'lucide-react';

export default function ModelSelector({ models, selectedModel, setSelectedModel }) {
  const currentModel = models.find((m) => m.id === selectedModel) || models[0] || {};

  return (
    <div>
      <div className="bento-header">
        <h2 className="bento-title">
          <Cpu size={18} color="var(--accent-cobalt)" />
          Model Architecture
        </h2>
        <span className="bento-tag">Step 01 / 03</span>
      </div>

      {/* Software Badges Row (Inspired by Dsgners® [Ai][Ps][Ae][Fg]) */}
      <div className="model-badges-row">
        {/* Button ALL Models Suite */}
        <button
          type="button"
          className={`software-badge-btn ${selectedModel === 'all' ? 'active' : ''}`}
          style={{
            borderWidth: '2px',
            borderColor: selectedModel === 'all' ? 'var(--ink-black)' : 'var(--ink-black)',
            background: selectedModel === 'all' ? 'var(--ink-black)' : '#FFFBEB',
            color: selectedModel === 'all' ? '#FFFFFF' : 'var(--ink-black)',
          }}
          onClick={() => setSelectedModel('all')}
        >
          <span style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>⚡ ALL MODELS</span>
          </span>
          <span
            className="tab-counter-pill"
            style={{
              fontSize: '0.68rem',
              padding: '1px 6px',
              background: selectedModel === 'all' ? 'var(--accent-yellow)' : '#FEF3C7',
              color: 'var(--ink-black)',
            }}
          >
            5 Models Suite
          </span>
        </button>

        {models.map((m) => {
          const isSelected = selectedModel === m.id;
          return (
            <button
              key={m.id}
              type="button"
              className={`software-badge-btn ${isSelected ? 'active' : ''}`}
              onClick={() => setSelectedModel(m.id)}
            >
              <span>{m.name}</span>
              <span className="badge-tag-mini">{m.cer_pct}% CER</span>
            </button>
          );
        })}
      </div>

      {/* Selected Model Specifications Strip */}
      {selectedModel === 'all' ? (
        <div className="model-specs-strip" style={{ background: '#FFFDF5', borderColor: 'var(--ink-black)' }}>
          <div className="spec-item">
            <span className="spec-label">Evaluation Mode</span>
            <span className="spec-val" style={{ color: 'var(--accent-cobalt)', fontWeight: '800' }}>
              ⚡ All 5 Models (Sequential SSE Suite)
            </span>
          </div>

          <div className="spec-item">
            <span className="spec-label">Architectures</span>
            <span className="spec-val" style={{ fontSize: '0.82rem' }}>
              Conformer + Wav2Vec2 + Whisper + Qwen3
            </span>
          </div>

          <div className="spec-item">
            <span className="spec-label">Parameter Scope</span>
            <span className="spec-val">74M to 1.55B + Cloud API</span>
          </div>

          <div className="spec-item">
            <span className="spec-label">CER Benchmark Span</span>
            <span className="spec-val" style={{ color: 'var(--status-good-text)', fontWeight: '800' }}>
              44.08% — 94.08%
            </span>
          </div>

          <div className="spec-item">
            <span className="spec-label">Output View</span>
            <span className="spec-val" style={{ fontSize: '0.78rem', fontWeight: '700' }}>
              Side-by-Side Ranked Matrix
            </span>
          </div>
        </div>
      ) : (
        currentModel && (
          <div className="model-specs-strip">
            <div className="spec-item">
              <span className="spec-label">Selected Model</span>
              <span className="spec-val" style={{ color: 'var(--accent-cobalt)' }}>
                {currentModel.name}
              </span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Architecture</span>
              <span className="spec-val" style={{ fontSize: '0.82rem' }}>
                {currentModel.architecture}
              </span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Parameters</span>
              <span className="spec-val">{currentModel.parameters}</span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Benchmark CER</span>
              <span
                className="spec-val"
                style={{
                  color:
                    currentModel.cer_pct <= 50
                      ? 'var(--status-good-text)'
                      : currentModel.cer_pct <= 65
                      ? 'var(--status-mid-text)'
                      : 'var(--status-high-text)',
                }}
              >
                {currentModel.cer_pct}%
              </span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Type</span>
              <span className="spec-val" style={{ fontSize: '0.78rem' }}>
                {currentModel.type}
              </span>
            </div>
          </div>
        )
      )}
    </div>
  );
}
