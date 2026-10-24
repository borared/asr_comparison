import React from 'react';
import { Layers, Undo2, Trash2, Download, Inbox } from 'lucide-react';
import StackItemCard from './StackItemCard';

export default function StackManager({ stack, onPop, onClear, onExport }) {
  const isEmpty = stack.length === 0;

  return (
    <div className="bento-card">
      {/* Stack Header & Action Bar */}
      <div className="stack-action-bar">
        <div className="stack-title-group">
          <Layers size={20} color="var(--accent-cobalt)" />
          <h2 className="bento-title">LIFO Evaluation Stack</h2>
          <span className="stack-count-tag">{stack.length} in stack</span>
        </div>

        <div className="stack-btn-group">
          <button
            type="button"
            className="tactile-pill-btn"
            onClick={onPop}
            disabled={isEmpty}
            title="Pop (remove) the most recent evaluation from top of stack"
          >
            <Undo2 size={13} />
            Pop Top
          </button>

          <button
            type="button"
            className="tactile-pill-btn"
            onClick={onExport}
            disabled={isEmpty}
            title="Export stack evaluations to CSV (error_analysis format)"
          >
            <Download size={13} />
            Export CSV
          </button>

          <button
            type="button"
            className="tactile-pill-btn danger-btn"
            onClick={onClear}
            disabled={isEmpty}
            title="Clear all evaluations from session"
          >
            <Trash2 size={13} />
            Clear
          </button>
        </div>
      </div>

      {/* Stack Card Deck */}
      <div className="stack-deck">
        {isEmpty ? (
          <div className="stack-empty-editorial">
            <div className="stack-empty-icon">
              <Inbox size={26} color="var(--ink-muted)" />
            </div>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.1rem',
                fontWeight: '800',
                color: 'var(--ink-black)',
                marginBottom: '6px',
              }}
            >
              Evaluation Stack is Empty
            </h3>
            <p
              style={{
                fontSize: '0.85rem',
                color: 'var(--ink-secondary)',
                maxWidth: '380px',
                margin: '0 auto',
                lineHeight: '1.6',
              }}
            >
              Select a model above, choose or upload an audio recording, enter your expected Khmer text, and click{' '}
              <strong>"Run Model Prediction & Push to Stack"</strong> to start testing.
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
