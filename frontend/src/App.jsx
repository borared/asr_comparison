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
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  const timerRef = useRef(null);
  const { stack, push, pop, clear, exportToCsv, count } = useAsrStack();

  // Fetch models & dataset on mount
  useEffect(() => {
    fetch('/api/models')
      .then((res) => res.json())
      .then((data) => setModels(data.models || []))
      .catch((err) => console.error('Error fetching models:', err));

    fetch('/api/dataset')
      .then((res) => res.json())
      .then((data) => setDatasetSamples(data.samples || []))
      .catch((err) => console.error('Error fetching dataset:', err));
  }, []);

  // Handle Run Prediction
  const handleRun = async () => {
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
      // Push prediction result onto the Stack
      push(result);
    } catch (err) {
      console.error('Prediction Error:', err);
      alert('Error during prediction: ' + err.message);
    } finally {
      setIsLoading(false);
      clearInterval(timerRef.current);
    }
  };

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stackCount={count}
      />

      {/* View Tabs */}
      {activeTab === 'studio' ? (
        <div className="main-grid">
          {/* Left Column: Model Selection & Audio Input with Manual Expected Text */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Model Selector Card */}
            <div className="glass-card">
              <ModelSelector
                models={models}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
              />
            </div>

            {/* Audio Upload, Recording & Manual Expected Output Card */}
            <div className="glass-card">
              <div className="panel-header">
                <h2 className="panel-title">Audio & Expected Output</h2>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                  Step 2 & 3
                </span>
              </div>
              <AudioInputCard
                datasetSamples={datasetSamples}
                selectedSampleId={selectedSampleId}
                setSelectedSampleId={setSelectedSampleId}
                uploadedFile={uploadedFile}
                setUploadedFile={setUploadedFile}
                expectedOutput={expectedOutput}
                setExpectedOutput={setExpectedOutput}
                onRun={handleRun}
                isLoading={isLoading}
                elapsedSec={elapsedSec}
              />
            </div>
          </div>

          {/* Right Column: LIFO Evaluation Stack (Pop & Push) */}
          <div>
            <StackManager
              stack={stack}
              onPop={pop}
              onClear={clear}
              onExport={exportToCsv}
            />
          </div>
        </div>
      ) : (
        /* Leaderboard Tab */
        <MetricsLeaderboard />
      )}
    </div>
  );
}
