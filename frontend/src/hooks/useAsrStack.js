import { useState, useEffect } from 'react';

const STORAGE_KEY = 'khmer_asr_stack_history_v1';

export function useAsrStack() {
  const [stack, setStack] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load stack from localStorage:', e);
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stack));
    } catch (e) {
      console.error('Failed to persist stack:', e);
    }
  }, [stack]);

  // Push new prediction onto top of the stack
  const push = (item) => {
    setStack((prev) => [item, ...prev]);
  };

  // Pop (remove) the most recent prediction from top
  const pop = () => {
    if (stack.length === 0) return null;
    const [top, ...rest] = stack;
    setStack(rest);
    return top;
  };

  // Clear entire stack
  const clear = () => {
    setStack([]);
  };

  // Export stack to CSV formatted identically to error_analysis/*_cer_breakdown.csv
  const exportToCsv = () => {
    if (stack.length === 0) return;

    const headers = [
      'id',
      'audio_path',
      'duration_sec',
      'model_name',
      'reference_raw',
      'reference_norm',
      'hypothesis_raw',
      'hypothesis_norm',
      'ref_len',
      'hyp_len',
      'substitutions',
      'insertions',
      'deletions',
      'sample_cer_pct',
      'latency_sec',
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = stack.map((item) => [
      escapeCsv(item.id),
      escapeCsv(item.audio_filename),
      escapeCsv(item.duration_sec),
      escapeCsv(item.model_name),
      escapeCsv(item.reference_raw),
      escapeCsv(item.reference_norm),
      escapeCsv(item.hypothesis_raw),
      escapeCsv(item.hypothesis_norm),
      escapeCsv(item.ref_len),
      escapeCsv(item.hyp_len),
      escapeCsv(item.substitutions),
      escapeCsv(item.insertions),
      escapeCsv(item.deletions),
      escapeCsv(item.sample_cer_pct),
      escapeCsv(item.latency_sec),
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `asr_eval_stack_export_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return {
    stack,
    push,
    pop,
    clear,
    exportToCsv,
    count: stack.length,
    isEmpty: stack.length === 0,
    top: stack[0] || null,
  };
}
