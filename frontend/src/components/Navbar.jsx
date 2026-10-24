import React from 'react';
import { Mic, BarChart3, Layers, Sparkles } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, stackCount }) {
  return (
    <nav className="glass-card navbar">
      <div className="nav-brand">
        <div className="brand-icon">
          <Mic size={22} />
        </div>
        <div>
          <h1 className="brand-title">Khmer ASR Studio</h1>
          <p className="brand-subtitle">Benchmark & Interactive Model Evaluator</p>
        </div>
      </div>

      <div className="nav-tabs">
        <button
          className={`nav-tab-btn ${activeTab === 'studio' ? 'active' : ''}`}
          onClick={() => setActiveTab('studio')}
        >
          <Layers size={16} />
          Evaluation Studio
          {stackCount > 0 && (
            <span
              style={{
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '999px',
                padding: '1px 6px',
                fontSize: '0.7rem',
              }}
            >
              {stackCount}
            </span>
          )}
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          <BarChart3 size={16} />
          Leaderboard & Metrics
        </button>
      </div>
    </nav>
  );
}
