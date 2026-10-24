import React from 'react';
import { Cpu, CheckCircle2 } from 'lucide-react';

export default function ModelSelector({ models, selectedModel, setSelectedModel }) {
  return (
    <div>
      <div className="panel-header">
        <h2 className="panel-title">
          <Cpu size={18} color="#6366f1" />
          Select ASR Model
        </h2>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
          {models.length} Models Available
        </span>
      </div>

      <div className="model-grid">
        {models.map((m) => {
          const isSelected = selectedModel === m.id;
          return (
            <div
              key={m.id}
              className={`model-card ${isSelected ? 'active' : ''}`}
              onClick={() => setSelectedModel(m.id)}
            >
              <div>
                <div className="model-card-header">
                  <span className="model-name">{m.name}</span>
                  {isSelected && <CheckCircle2 size={16} color="#6366f1" />}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <span
                    className={`model-tag ${
                      m.id === 'google_chirp'
                        ? 'tag-cloud'
                        : m.id === 'meta_mms_1b'
                        ? 'tag-best'
                        : 'tag-open'
                    }`}
                  >
                    {m.badge}
                  </span>
                </div>
              </div>

              <div>
                <div className="model-meta">
                  <span>
                    CER: <strong>{m.cer_pct}%</strong>
                  </span>
                  <span>
                    Latency: <strong>{m.latency_avg}s</strong>
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-dim)',
                    marginTop: '4px',
                  }}
                >
                  {m.architecture}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
