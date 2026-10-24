import React, { useState, useRef, useEffect } from 'react';
import { Upload, Mic, Square, Play, RotateCcw, FileAudio, Sparkles, Loader2 } from 'lucide-react';

export default function AudioInputCard({
  datasetSamples,
  selectedSampleId,
  setSelectedSampleId,
  uploadedFile,
  setUploadedFile,
  expectedOutput,
  setExpectedOutput,
  onRun,
  isLoading,
  elapsedSec,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  // When preloaded sample is selected from dropdown
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

  // When a local file is uploaded
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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const file = new File([audioBlob], `mic_recording_${Date.now()}.wav`, {
          type: 'audio/wav',
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
      alert('Microphone access denied or unavailable: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  // Format seconds to mm:ss
  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const hasAudio = !!uploadedFile || !!selectedSampleId;

  return (
    <div className="input-section">
      {/* 1. Preloaded Dataset Selector */}
      <div>
        <label className="input-label">1. Choose Preloaded Audio Sample (Optional)</label>
        <select
          className="select-input"
          value={selectedSampleId}
          onChange={handleSampleChange}
          disabled={isLoading}
        >
          <option value="">-- Or select from 16 benchmark samples --</option>
          {datasetSamples.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id} ({s.audio_filename} — {s.duration_sec}s) :{' '}
              {s.reference.slice(0, 35)}...
            </option>
          ))}
        </select>
      </div>

      {/* 2. Drag & Drop File Upload or Mic Recording */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label className="input-label">2. Upload Audio or Record Voice</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            {!isRecording ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={startRecording}
                disabled={isLoading}
              >
                <Mic size={14} color="#ef4444" />
                Record Mic
              </button>
            ) : (
              <button
                type="button"
                className="btn-danger-outline"
                onClick={stopRecording}
              >
                <Square size={14} fill="#ef4444" />
                Stop ({formatTime(recordingTime)})
              </button>
            )}
          </div>
        </div>

        <div
          className={`dropzone ${isDragging ? 'drag-active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".wav,.mp3,audio/wav,audio/mpeg"
            onChange={handleFileChange}
            disabled={isLoading}
          />
          <div className="dropzone-icon">
            <Upload size={22} />
          </div>
          <div className="dropzone-title">
            {uploadedFile
              ? uploadedFile.name
              : 'Click or drop .wav / .mp3 audio file here'}
          </div>
          <div className="dropzone-desc">
            {uploadedFile
              ? `${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB uploaded`
              : 'Supports 16kHz/44.1kHz WAV and MP3 recordings'}
          </div>
        </div>
      </div>

      {/* Audio Preview Widget */}
      {audioPreviewUrl && (
        <div className="audio-widget">
          <FileAudio size={16} color="var(--primary)" />
          <audio controls src={audioPreviewUrl} style={{ width: '100%' }} />
        </div>
      )}

      {/* 3. Expected Output Field (Manual Ground Truth) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label className="input-label">
            3. Expected Output (Ground Truth Khmer Reference)
          </label>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
            Used to calculate exact CER (%)
          </span>
        </div>
        <textarea
          className="textarea-input"
          placeholder="បញ្ចូលអត្ថបទគំរូ ឬអត្ថបទពិតប្រាកដដែលបាននិយាយ (Type or paste the true spoken Khmer sentence here)..."
          value={expectedOutput}
          onChange={(e) => setExpectedOutput(e.target.value)}
          disabled={isLoading}
        />
      </div>

      {/* 4. Run Button */}
      <button
        className="btn-primary"
        onClick={onRun}
        disabled={isLoading || !hasAudio}
      >
        {isLoading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Transcribing with Model... ({elapsedSec}s)
          </>
        ) : (
          <>
            <Sparkles size={18} />
            Run Model Prediction & Push to Stack
          </>
        )}
      </button>
    </div>
  );
}
