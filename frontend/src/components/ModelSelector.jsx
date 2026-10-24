import React from 'react';
import { Cpu, Check } from 'lucide-react';

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
      {currentModel && (
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
      )}
    </div>
  );
}
