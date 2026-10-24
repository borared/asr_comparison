import React from 'react';
import { Layers, BarChart3, Radio } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, stackCount }) {
  return (
    <header className="editorial-header">
      {/* Brand Wordmark (Inspired by Dsgners®) */}
      <div className="brand-section">
        <div className="brand-badge">
          <span>KM</span>
        </div>
        <div className="brand-text-block">
          <h1>
            KHMER ASR <span className="brand-reg">®</span>
          </h1>
          <div className="brand-sublabel">Speech Evaluation Platform</div>
        </div>
      </div>

      {/* Segmented Editorial Pill Tabs */}
      <div className="nav-tab-deck">
        <button
          className={`editorial-tab-btn ${activeTab === 'studio' ? 'active' : ''}`}
          onClick={() => setActiveTab('studio')}
        >
          <Layers size={15} />
          01. Studio & Stack
          {stackCount > 0 && (
            <span className="tab-counter-pill">{stackCount}</span>
          )}
        </button>
        <button
          className={`editorial-tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          <BarChart3 size={15} />
          02. Benchmark Directory
        </button>
      </div>

      {/* Status & Session Tags */}
      <div className="header-meta-group">
        <div className="status-pill">
          <span className="status-indicator-dot" />
          <span>API: ONLINE</span>
        </div>
        <div className="status-pill" style={{ display: 'none', md: 'inline-flex' }}>
          <span>16 SAMPLES</span>
        </div>
      </div>
    </header>
  );
}
