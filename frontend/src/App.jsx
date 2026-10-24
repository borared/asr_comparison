import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import ModelSelector from './components/ModelSelector';
import AudioInputCard from './components/AudioInputCard';
import StackManager from './components/StackManager';
import MetricsLeaderboard from './components/MetricsLeaderboard';
import { useAsrStack } from './hooks/useAsrStack';

export default function App() {
  const [activeTab, setActiveTab] = useState('studio');
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('meta_mms_1b');
  const [datasetSamples, setDatasetSamples] = useState([]);
  const [selectedSampleId, setSelectedSampleId] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [expectedOutput, setExpectedOutput] = useState('');
  const [nextSampleId, setNextSampleId] = useState('km_eval_0017');
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  const timerRef = useRef(null);
  const { stack, push, pop, clear, exportToCsv, count } = useAsrStack();

  const fetchDataset = () => {
    fetch('/api/dataset')
      .then((res) => res.json())
      .then((data) => setDatasetSamples(data.samples || []))
      .catch((err) => console.error('Error fetching dataset:', err));

    fetch('/api/dataset/next-id')
      .then((res) => res.json())
      .then((data) => {
        if (data.next_id) {
          setNextSampleId(data.next_id);
        }
      })
      .catch((err) => console.error('Error fetching next sample id:', err));
  };

  // Fetch models & dataset on mount
  useEffect(() => {
    fetch('/api/models')
      .then((res) => res.json())
      .then((data) => setModels(data.models || []))
      .catch((err) => console.error('Error fetching models:', err));

    fetchDataset();
  }, []);

  const [lastPrediction, setLastPrediction] = useState(null);

  // Standard Run Prediction (Test & Stack only)
  const handleRunTest = async () => {
    if (!uploadedFile && !selectedSampleId) {
      alert('Please upload an audio file or select a preloaded sample.');
      return;
    }

    setIsLoading(true);
    setElapsedSec(0);
    timerRef.current = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    const formData = new FormData();
    formData.append('model_name', selectedModel);
    formData.append('expected_output', expectedOutput || '');

    if (uploadedFile) {
      formData.append('file', uploadedFile);
    } else if (selectedSampleId) {
      formData.append('sample_id', selectedSampleId);
    }

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
      // Push updated item with is_benchmark_sample flag
      push(result);
      // Refresh dataset and next ID
      fetchDataset();
      // Clear last prediction state
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
      />

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
