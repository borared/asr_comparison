import React from 'react';
import { Layers, Undo2, Trash2, Download, Inbox } from 'lucide-react';
import StackItemCard from './StackItemCard';

export default function StackManager({ stack, onPop, onClear, onExport }) {
  const isEmpty = stack.length === 0;

  return (
    <div className="glass-card stack-panel" style={{ padding: '20px 24px' }}>
      {/* Stack Controls Bar */}
      <div className="stack-controls">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Layers size={18} color="var(--primary)" />
          <h2 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#f8fafc' }}>
            Evaluation Stack
          </h2>
          <span className="stack-count-badge">{stack.length} in stack</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-secondary"
            onClick={onPop}
            disabled={isEmpty}
            title="Pop (remove) the most recent item from top of the stack"
          >
            <Undo2 size={14} />
            Pop Top
          </button>

          <button
            className="btn-secondary"
            onClick={onExport}
            disabled={isEmpty}
            title="Export full stack history to CSV (error_analysis format)"
          >
            <Download size={14} />
            Export CSV
          </button>

          <button
            className="btn-danger-outline"
            onClick={onClear}
            disabled={isEmpty}
            title="Clear all predictions from stack"
          >
            <Trash2 size={13} />
            Clear
          </button>
        </div>
      </div>

      {/* Stack Items (LIFO: newest on top) */}
      <div className="stack-list">
        {isEmpty ? (
          <div className="stack-empty">
            <Inbox size={42} style={{ opacity: 0.25, marginBottom: '12px' }} />
            <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Stack is Currently Empty
            </h3>
            <p style={{ fontSize: '0.82rem', maxWidth: '340px', margin: '0 auto' }}>
              Select a model, upload or choose an audio file, type the expected text, and click 
              <strong> "Run Model Prediction & Push to Stack"</strong> to begin testing.
            </p>
          </div>
        ) : (
          stack.map((item, index) => (
            <StackItemCard key={item.id} item={item} isTop={index === 0} />
          ))
        )}
      </div>
    </div>
  );
}
