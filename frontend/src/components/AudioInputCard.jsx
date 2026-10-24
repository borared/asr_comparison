import React, { useState, useRef, useEffect } from 'react';
import { Upload, Mic, Square, FileAudio, ArrowRight, Loader2, Play, PlusCircle, Volume2, CheckCircle2 } from 'lucide-react';

export default function AudioInputCard({
  datasetSamples,
  selectedSampleId,
  setSelectedSampleId,
  uploadedFile,
  setUploadedFile,
  expectedOutput,
  setExpectedOutput,
  onRunTest,
  onSaveBenchmarkSample,
  isLoading,
  elapsedSec,
  nextSampleId,
  lastPrediction,
}) {
  const [inputMode, setInputMode] = useState('preloaded'); // 'preloaded' | 'upload' | 'mic'
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  // When preloaded sample is picked
  const handleSampleChange = (e) => {
    const id = e.target.value;
    setSelectedSampleId(id);
    setUploadedFile(null);
    setAudioPreviewUrl(null);

    const match = datasetSamples.find((s) => s.id === id);
    if (match) {
      setExpectedOutput(match.reference || '');
      setAudioPreviewUrl(match.audio_url);
    } else {
      setExpectedOutput('');
    }
  };

  // When a local file is picked
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFile(file);
      setSelectedSampleId('');
      setAudioPreviewUrl(URL.createObjectURL(file));
    }
  };

  // Drag and drop handlers
  const [isDragging, setIsDragging] = useState(false);
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.wav') || file.name.endsWith('.mp3'))) {
      setUploadedFile(file);
      setSelectedSampleId('');
      setAudioPreviewUrl(URL.createObjectURL(file));
    }
  };

  // Browser microphone recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], `mic_recording_${Date.now()}.webm`, {
          type: 'audio/webm',
        });
        setUploadedFile(file);
        setSelectedSampleId('');
        setAudioPreviewUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert('Microphone access denied: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const hasAudio = !!uploadedFile || !!selectedSampleId;
  const hasPredicted = !!lastPrediction && !lastPrediction.is_benchmark_sample;

  return (
    <div className="input-block">
      {/* 01. Audio Source Mode Switcher */}
      <div>
        <div className="field-label-row">
          <label className="field-label">01. Audio Input Source</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              className="tab-counter-pill"
              style={{ background: 'var(--card-warm)', color: 'var(--ink-black)' }}
            >
              NEXT INDEX: {nextSampleId || 'km_eval_0019'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`tactile-pill-btn ${inputMode === 'preloaded' ? 'active' : ''}`}
            style={{
              background: inputMode === 'preloaded' ? 'var(--ink-black)' : '#FFFFFF',
              color: inputMode === 'preloaded' ? '#FFFFFF' : 'var(--ink-black)',
            }}
            onClick={() => setInputMode('preloaded')}
          >
            Preloaded Samples ({datasetSamples.length})
          </button>
          <button
            type="button"
            className={`tactile-pill-btn ${inputMode === 'upload' ? 'active' : ''}`}
            style={{
              background: inputMode === 'upload' ? 'var(--ink-black)' : '#FFFFFF',
              color: inputMode === 'upload' ? '#FFFFFF' : 'var(--ink-black)',
            }}
            onClick={() => setInputMode('upload')}
          >
            Upload File (.wav/.mp3)
          </button>
          <button
            type="button"
            className={`tactile-pill-btn ${inputMode === 'mic' ? 'active' : ''}`}
            style={{
              background: inputMode === 'mic' ? 'var(--ink-black)' : '#FFFFFF',
              color: inputMode === 'mic' ? '#FFFFFF' : 'var(--ink-black)',
            }}
            onClick={() => setInputMode('mic')}
          >
            Record Mic
          </button>
        </div>

        {/* Option A: Preloaded Samples */}
        {inputMode === 'preloaded' && (
          <div>
            <select
              className="editorial-select"
              value={selectedSampleId}
              onChange={handleSampleChange}
              disabled={isLoading}
            >
              <option value="">-- Choose from {datasetSamples.length} verified evaluation samples --</option>
              {datasetSamples.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} ({s.audio_filename} — {s.duration_sec}s) : {s.reference ? s.reference.slice(0, 40) + '...' : '(No reference)'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Option B: File Upload */}
        {inputMode === 'upload' && (
          <div
            className={`dropzone-bento ${isDragging ? 'drag-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".wav,.mp3,audio/wav,audio/mpeg,audio/webm"
              onChange={handleFileChange}
              disabled={isLoading}
            />
            <div className="dropzone-icon-box">
              <Upload size={20} color="var(--accent-cobalt)" />
            </div>
            <div className="dropzone-primary-text">
              {uploadedFile ? uploadedFile.name : 'Click or drag .wav / .mp3 / audio file'}
            </div>
            <div className="dropzone-sub-text">
              {uploadedFile
                ? `${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB file ready`
                : `Target ID: ${nextSampleId || 'km_eval_0019'}`}
            </div>
          </div>
        )}

        {/* Option C: Live Microphone */}
        {inputMode === 'mic' && (
          <div className="dropzone-bento" style={{ padding: '24px' }}>
            {!isRecording ? (
              <button
                type="button"
                className="tactile-pill-btn"
                style={{
                  background: '#DC2626',
                  color: '#FFFFFF',
                  margin: '0 auto',
                  padding: '10px 20px',
                  fontSize: '0.9rem',
                }}
                onClick={startRecording}
                disabled={isLoading}
              >
                <Mic size={16} />
                Start Recording Microphone
              </button>
            ) : (
              <button
                type="button"
                className="tactile-pill-btn"
                style={{
                  background: '#B91C1C',
                  color: '#FFFFFF',
                  margin: '0 auto',
                  padding: '10px 20px',
                  fontSize: '0.9rem',
                }}
                onClick={stopRecording}
              >
                <Square size={16} fill="#FFFFFF" />
                Stop Recording ({formatTime(recordingTime)})
              </button>
            )}
            <div className="dropzone-sub-text" style={{ marginTop: '10px' }}>
              {isRecording
                ? 'Recording voice audio...'
                : `Target ID: ${nextSampleId || 'km_eval_0019'}`}
            </div>
          </div>
        )}
      </div>

      {/* Audio Playback Bar */}
      {audioPreviewUrl && (
        <div className="audio-player-strip">
          <Volume2 size={18} color="var(--accent-cobalt)" />
          <audio controls src={audioPreviewUrl} style={{ width: '100%', height: '32px' }} />
        </div>
      )}

      {/* 02. Expected Output (Ground Truth Khmer Reference) */}
      <div>
        <div className="field-label-row">
          <label className="field-label">02. Expected Output (Ground Truth Reference)</label>
          <span className="field-hint">
            {expectedOutput ? `${expectedOutput.length} characters` : 'Manual or Auto-filled'}
          </span>
        </div>
        <textarea
          className="editorial-textarea"
          placeholder="បញ្ចូលអត្ថបទគំរូពិតប្រាកដដែលបាននិយាយ (Type or paste the expected spoken Khmer text here)..."
          value={expectedOutput}
          onChange={(e) => setExpectedOutput(e.target.value)}
          disabled={isLoading}
        />
      </div>

      {/* 03. Two-Step Execution Flow */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Step 1: Run Model Prediction First (Yellow Button) */}
        <button
          type="button"
          className="btn-mogo-run"
          onClick={onRunTest}
          disabled={isLoading || !hasAudio}
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Evaluating Audio with Model... ({elapsedSec}s)
            </>
          ) : (
            <>
              <Play size={16} fill="currentColor" />
              <span>Run Model Prediction & Push to Stack</span>
              <ArrowRight size={18} strokeWidth={2.5} />
            </>
          )}
        </button>

        {/* Step 2: Save to Benchmark Dataset (Blue Button) - Enabled after prediction */}
        {hasPredicted && (
          <button
            type="button"
            className="btn-mogo-run"
            style={{
              background: 'var(--accent-cobalt)',
              color: '#FFFFFF',
              borderColor: 'var(--ink-black)',
            }}
            onClick={onSaveBenchmarkSample}
            disabled={isLoading}
          >
            <PlusCircle size={18} />
            <span>
              Save This Prediction to Benchmark Dataset (as {nextSampleId || 'km_eval_0019'})
            </span>
            <CheckCircle2 size={18} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
