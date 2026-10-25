import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import ModelSelector from './components/ModelSelector';
import AudioInputCard from './components/AudioInputCard';
import StackManager from './components/StackManager';
import MetricsLeaderboard from './components/MetricsLeaderboard';
import { useAsrStack } from './hooks/useAsrStack';

const FALLBACK_MODELS = [
  {
    id: 'meta_mms_1b',
    name: 'Meta MMS-1B',
    full_name: 'facebook/mms-1b-all',
    architecture: 'Wav2Vec2 + Khmer Adapter (khm)',
    type: 'Open-Source (Local)',
    parameters: '1.0B',
    cer_pct: 54.31,
    latency_avg: 5.51,
    badge: 'Top Open-Source',
    fine_tunable: true,
    recommended: true,
  },
  {
    id: 'sengtha_whisper_base_khmer',
    name: 'Sengtha Whisper Base',
    full_name: 'sengtha/whisper-base-khmer',
    architecture: 'Whisper-Base Seq2Seq',
    type: 'Open-Source (Local)',
    parameters: '74M',
    cer_pct: 56.26,
    latency_avg: 14.52,
    badge: 'Lightweight & Fast',
    fine_tunable: true,
    recommended: false,
  },
  {
    id: 'seanghay_qwen3_asr_0_6b',
    name: 'Seanghay Qwen3-ASR 0.6B',
    full_name: 'seanghay/Qwen3-ASR-0.6B-Khmer',
    architecture: 'Qwen3 Audio LLM Thinker',
    type: 'Open-Source (Local)',
    parameters: '600M',
    cer_pct: 59.39,
    latency_avg: 17.77,
    badge: 'Modern Speech-LLM',
    fine_tunable: true,
    recommended: false,
  },
  {
    id: 'google_chirp',
    name: 'Google Speech / Chirp',
    full_name: 'Google Cloud Speech-to-Text (km-KH)',
    architecture: 'Conformer / Chirp-2',
    type: 'Cloud API (Hosted)',
    parameters: 'Proprietary',
    cer_pct: 44.08,
    latency_avg: 5.47,
    badge: 'Lowest CER',
    fine_tunable: false,
    recommended: false,
  },
  {
    id: 'openai_whisper_large_v3',
    name: 'OpenAI Whisper Large v3',
    full_name: 'openai/whisper-large-v3',
    architecture: 'Whisper-Large Seq2Seq',
    type: 'Open-Source (Local)',
    parameters: '1.55B',
    cer_pct: 94.08,
    latency_avg: 93.06,
    badge: 'Generic Multilingual',
    fine_tunable: true,
    recommended: false,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('studio');
  const [models, setModels] = useState(FALLBACK_MODELS);
  const [selectedModel, setSelectedModel] = useState('meta_mms_1b');
  const [datasetSamples, setDatasetSamples] = useState([]);
  const [selectedSampleId, setSelectedSampleId] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [expectedOutput, setExpectedOutput] = useState('');
  const [nextSampleId, setNextSampleId] = useState('km_eval_0017');
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [apiOnline, setApiOnline] = useState(true);

  const timerRef = useRef(null);
  const { stack, push, pop, clear, exportToCsv, count } = useAsrStack();

  const fetchDataset = () => {
    fetch('/api/dataset')
      .then((res) => {
        if (!res.ok) throw new Error('API offline');
        return res.json();
      })
      .then((data) => {
        setDatasetSamples(data.samples || []);
        setApiOnline(true);
      })
      .catch((err) => {
        console.warn('Dataset fetch failed:', err);
        setApiOnline(false);
      });

    fetch('/api/dataset/next-id')
      .then((res) => res.json())
      .then((data) => {
        if (data.next_id) {
          setNextSampleId(data.next_id);
        }
      })
      .catch(() => {});
  };

  // Fetch models & dataset on mount
  useEffect(() => {
    fetch('/api/models')
      .then((res) => {
        if (!res.ok) throw new Error('API offline');
        return res.json();
      })
      .then((data) => {
        if (data.models && data.models.length > 0) {
          setModels(data.models);
        }
        setApiOnline(true);
      })
      .catch((err) => {
        console.warn('Models fetch failed:', err);
        setApiOnline(false);
      });

    fetchDataset();

    const interval = setInterval(() => {
      fetch('/api/health')
        .then((res) => setApiOnline(res.ok))
        .catch(() => setApiOnline(false));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const [lastPrediction, setLastPrediction] = useState(null);
  const [streamProgress, setStreamProgress] = useState(null);

  // Standard Run Prediction (Test & Stack only)
  const handleRunTest = async () => {
    if (!uploadedFile && !selectedSampleId) {
      alert('Please upload an audio file or select a preloaded sample.');
      return;
    }

    setIsLoading(true);
    setElapsedSec(0);
    setStreamProgress(null);
    timerRef.current = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    const formData = new FormData();
    formData.append('expected_output', expectedOutput || '');

    if (uploadedFile) {
      formData.append('file', uploadedFile);
    } else if (selectedSampleId) {
      formData.append('sample_id', selectedSampleId);
    }

    // Branch A: Evaluate ALL models via SSE Stream
    if (selectedModel === 'all') {
      try {
        const response = await fetch('/api/predict-all-stream', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || 'Multi-model streaming evaluation failed');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop(); // keep remaining unfinished line

          for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.startsWith('data: ')) {
              try {
                const payload = JSON.parse(trimmed.slice(6));
                if (payload.event === 'model_start') {
                  setStreamProgress({
                    step: payload.step,
                    total: payload.total,
                    model_name: payload.model_name,
                  });
                } else if (payload.event === 'complete') {
                  push(payload.data);
                  setLastPrediction(payload.data);
                  setStreamProgress(null);
                }
              } catch (e) {
                console.warn('Error parsing SSE event:', e);
              }
            }
          }
        }
      } catch (err) {
        console.error('All Models Prediction Error:', err);
        alert('Error during all-model prediction: ' + err.message);
      } finally {
        setIsLoading(false);
        setStreamProgress(null);
        clearInterval(timerRef.current);
      }
    } else {
      // Branch B: Single Model Evaluation
      formData.append('model_name', selectedModel);

      try {
        const response = await fetch('/api/predict', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Inference request failed');
        }

        const result = await response.json();
        push(result);
        setLastPrediction(result);
      } catch (err) {
        console.error('Prediction Error:', err);
        alert('Error during prediction: ' + err.message);
      } finally {
        setIsLoading(false);
        clearInterval(timerRef.current);
      }
    }
  };

  // Step 2: Save the already predicted evaluation into the Benchmark Dataset & Breakdown
  const handleSaveBenchmarkSample = async () => {
    if (!lastPrediction) {
      alert('Please run model prediction first before saving to benchmark dataset.');
      return;
    }

    setIsLoading(true);
    setElapsedSec(0);
    timerRef.current = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    // Branch A: Commit across ALL 5 models simultaneously
    if (lastPrediction.is_multi_model) {
      const formData = new FormData();
      formData.append('expected_output', lastPrediction.reference_raw || expectedOutput || '');
      formData.append('cached_filename', lastPrediction.cached_filename || lastPrediction.audio_filename);
      formData.append('results_json', JSON.stringify(lastPrediction.results || []));

      try {
        const response = await fetch('/api/dataset/create-sample-all', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to create dataset sample across all models');
        }

        const result = await response.json();
        push(result);
        fetchDataset();
        setLastPrediction(null);
        alert(
          `Successfully saved sample as ${result.id}!\n\nStored audio in data/raw_audio/, registered in ground_truth.jsonl, and synchronized predictions across ALL 5 model breakdowns simultaneously.`
        );
      } catch (err) {
        console.error('Create Dataset All Error:', err);
        alert('Error saving multi-model benchmark sample: ' + err.message);
      } finally {
        setIsLoading(false);
        clearInterval(timerRef.current);
      }
    } else {
      // Branch B: Single model commit
      const formData = new FormData();
      formData.append('model_name', lastPrediction.model_id || selectedModel);
      formData.append('expected_output', lastPrediction.reference_raw || expectedOutput || '');
      formData.append('cached_filename', lastPrediction.cached_filename || lastPrediction.audio_filename);
      formData.append('hypothesis_raw', lastPrediction.hypothesis_raw || '');
      formData.append('latency_sec', String(lastPrediction.latency_sec || 0.0));

      try {
        const response = await fetch('/api/dataset/create-sample', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to create dataset sample');
        }

        const result = await response.json();
        push(result);
        fetchDataset();
        setLastPrediction(null);
        alert(
          `Successfully saved sample as ${result.id}!\n\nStored in data/raw_audio/, registered in ground_truth.jsonl, and added directly to the ${selectedModel} Sample-by-Sample Breakdown.`
        );
      } catch (err) {
        console.error('Create Dataset Error:', err);
        alert('Error saving benchmark sample: ' + err.message);
      } finally {
        setIsLoading(false);
        clearInterval(timerRef.current);
      }
    }
  };

  const handleDeleteSample = async (sampleId) => {
    try {
      const res = await fetch(`/api/dataset/delete-sample/${sampleId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Failed to delete sample from server.');
      }
      if (selectedSampleId === sampleId) {
        setSelectedSampleId('');
        setExpectedOutput('');
        setLastPrediction(null);
      }
      fetchDataset();
    } catch (err) {
      alert('Error deleting sample: ' + err.message);
    }
  };

  return (
    <div className="app-container">
      {/* Editorial Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stackCount={count}
        apiOnline={apiOnline}
      />

      {/* Offline Alert Strip when Backend is not running */}
      {!apiOnline && (
        <div
          style={{
            background: '#FEF2F2',
            border: '2px solid #EF4444',
            borderRadius: 'var(--radius-lg)',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.82rem',
            color: '#991B1B',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <strong>⚠️ FastAPI Backend Offline:</strong> Port 8000 is not reachable. Run in a terminal:
            <code
              style={{
                background: '#FEE2E2',
                padding: '2px 8px',
                borderRadius: '4px',
                marginLeft: '8px',
                fontWeight: 'bold',
                color: '#7F1D1D',
              }}
            >
              .venv\Scripts\python.exe -m uvicorn scripts.server:app --host 127.0.0.1 --port 8000
            </code>
          </div>
          <button
            type="button"
            className="tactile-pill-btn"
            style={{
              padding: '5px 12px',
              fontSize: '0.75rem',
              background: '#DC2626',
              color: '#FFF',
              borderColor: '#991B1B',
            }}
            onClick={() => {
              fetchDataset();
              fetch('/api/models')
                .then((r) => r.json())
                .then((d) => d.models && setModels(d.models));
            }}
          >
            Retry Connection ⟳
          </button>
        </div>
      )}

      {/* Editorial Hero Banner */}
      <section className="editorial-hero-banner">
        <div className="hero-left">
          <h2>KHMER SPEECH EVALUATION STUDIO</h2>
          <p>
            Standardized Character Error Rate (CER %) benchmarking and live prediction analysis 
            for conversational Khmer speech across 5 contemporary ASR models.
          </p>
        </div>

        <div className="hero-tags">
          <div className="hero-tag-item">● {datasetSamples.length} BENCHMARK SAMPLES</div>
          <div className="hero-tag-item">● NEXT INDEX: {nextSampleId}</div>
          <div className="hero-tag-item">● ZERO-WIDTH NFC NORMALIZED</div>
        </div>
      </section>

      {/* Active Tab View */}
      {activeTab === 'studio' ? (
        <main className="studio-vertical-flow">
          {/* 1. Model Architecture */}
          <div className="bento-card">
            <ModelSelector
              models={models}
              selectedModel={selectedModel}
              setSelectedModel={(id) => {
                setSelectedModel(id);
                setLastPrediction(null);
              }}
            />
          </div>

          {/* 2. Audio & Expected Output */}
          <div className="bento-card">
            <div className="bento-header">
              <h2 className="bento-title">Audio & Expected Output</h2>
              <span className="bento-tag">Step 02 / 03</span>
            </div>
            <AudioInputCard
              datasetSamples={datasetSamples}
              selectedSampleId={selectedSampleId}
              setSelectedSampleId={setSelectedSampleId}
              uploadedFile={uploadedFile}
              setUploadedFile={setUploadedFile}
              expectedOutput={expectedOutput}
              setExpectedOutput={setExpectedOutput}
              onRunTest={handleRunTest}
              onSaveBenchmarkSample={handleSaveBenchmarkSample}
              onDeleteSample={handleDeleteSample}
              isLoading={isLoading}
              elapsedSec={elapsedSec}
              nextSampleId={nextSampleId}
              lastPrediction={lastPrediction}
              setLastPrediction={setLastPrediction}
              selectedModel={selectedModel}
              streamProgress={streamProgress}
            />
          </div>

          {/* 3. LIFO Evaluation Stack */}
          <StackManager
            stack={stack}
            onPop={pop}
            onClear={clear}
            onExport={exportToCsv}
          />
        </main>
      ) : (
        /* Benchmark Leaderboard & Breakdown View */
        <MetricsLeaderboard onDatasetChanged={fetchDataset} />
      )}
    </div>
  );
}
