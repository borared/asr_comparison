# Khmer Automatic Speech Recognition (ASR) Benchmark — Project Context & Documentation

## 1. Project Objective & Scope

This project conducts a standardized, empirical evaluation of Automatic Speech Recognition (ASR) models for the **Khmer language (km / khm)**. The benchmark evaluates both open-source local models and cloud API baselines across real conversational speech recordings, measuring performance exclusively through **Character Error Rate (CER %)** and **inference latency**.

* **Repository:** `borared/asr_comparison`
* **Active Working Branch:** `bora-dataset`
* **Target Metric:** Standardized Character Error Rate (CER %) exclusively (no WER, as Khmer text does not use standard whitespace for word boundaries).
* **Evaluation Dataset:** 16 natural Khmer speech audio recordings in `data/raw_audio/` (`km_eval_0001.wav` to `km_eval_0016.mp3`), spanning 230.63 seconds total duration.
* **Ground Truth References:** `data/ground_truth.jsonl` contains the verified Khmer transcriptions spoken by real speakers (restaurant booking, names, administrative regions, days/months, conversational dialogues).

---

## 2. Final Benchmark Results Summary

All models were evaluated on the complete 16-sample evaluation set following Unicode NFC normalization and zero-width character sanitization (`scripts/normalize.py`):

| Rank | Model Identifier | Architecture | Type | Parameters | Samples | Total Audio | **CER (%)** | Avg Latency | Fine-Tunable? |
| :---: | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| 🥇 | **`google_chirp`** | Conformer / Chirp-2 | Cloud API | Proprietary | 16 | 230.63s | **44.08%** | 5.47s | ❌ No (Closed API) |
| 🥈 | **`meta_mms_1b`** | Wav2Vec2 + Khmer Adapter | Open-Source | 1.0 Billion | 16 | 230.63s | **54.31%** | 5.51s | ✅ **Yes (Adapters/CTC)** |
| 🥉 | **`sengtha_whisper_base_khmer`** | Whisper-Base (encoder-decoder) | Open-Source | 74 Million | 16 | 230.63s | **56.26%** | 14.52s | ✅ **Yes (LoRA/Seq2Seq)** |
| 4 | **`seanghay_qwen3_asr_0_6b`** | Qwen3-Audio Thinker (LLM-based) | Open-Source | 600 Million | 16 | 230.63s | **59.39%** | 17.77s | ✅ **Yes (PEFT/LoRA)** |
| 5 | **`openai_whisper_large_v3`** | Whisper-Large-v3 (generic) | Open-Source | 1.55 Billion | 16 | 230.63s | **94.08%** | 93.06s | ✅ **Yes (LoRA/Full)** |

*Summary CSV: `results/metrics_summary.csv`*  
*Error Analysis Breakdowns: `results/error_analysis/*_cer_breakdown.csv`*

---

## 3. Key Research Findings & Insights

### A. Fine-Tuning Outweighs Raw Model Scale for Low-Resource ASR
A fine-tuned 74M parameter model (**`sengtha/whisper-base-khmer`** at **56.26% CER**) substantially outperformed the 20x larger 1.55B parameter **`openai/whisper-large-v3`** (**94.08% CER**). Without Khmer-specific fine-tuning, large multilingual models suffer from catastrophic hallucination and repetitive looping when transcribing low-resource Southeast Asian languages.

### B. Meta MMS-1B is the Strongest Open-Source Candidate for Fine-Tuning
**`facebook/mms-1b-all`** achieved the lowest CER among open-source models (**54.31%**) and the fastest inference latency (**5.51s on CPU**). Because MMS uses non-autoregressive CTC acoustic decoding with modular language adapters (`khm`), it avoids autoregressive repetition loops, runs extremely fast, and can be fine-tuned on modest GPUs.

### C. Modern Speech-LLM Capability (Qwen3-ASR)
**`seanghay/Qwen3-ASR-0.6B-Khmer`** achieved **59.39% CER**, demonstrating strong conversational transcription capability using a modern unified Speech-to-Text LLM architecture.

### D. Google Chirp Closed-Source Status
While Google Chirp achieved the lowest overall CER (**44.08%**), it is closed-source. Model weights and training code are private and inaccessible. For academic projects requiring model fine-tuning and weight checkpoints, open-source models (`meta_mms_1b` or `whisper_base_khmer`) must be selected.

---

## 4. Key Engineering Fixes & Pipeline Implementation

### A. Qwen3-ASR Weight Tying (`lm_head.weight`)
* **Problem:** In `seanghay/Qwen3-ASR-0.6B-Khmer`, `tie_word_embeddings` is set to `True`. When instantiated via Hugging Face `AutoModel`, `thinker.lm_head.weight` was initialized with random weights, producing garbled transcription characters.
* **Fix:** Tied the output projection weights directly to the embedding layer in `scripts/run_inference.py`:
  ```python
  model.thinker.lm_head.weight = model.thinker.model.embed_tokens.weight
  ```

### B. Upstream Transformers Library Compatibility
To run `qwen_asr` with modern Hugging Face Transformers:
1. Fixed decorator syntax from `@check_model_inputs()` to `@check_model_inputs`.
2. Added `exist_ok=True` to dynamic AutoConfig and AutoModel registrations to prevent re-registration collisions.
3. Added fallback `_default_rope_init` when `'default'` was removed from `ROPE_INIT_FUNCTIONS`.
4. Mapped `input_features_mask` to `feature_attention_mask` and fixed `inputs_embeds` parameter names in causal attention masks.

### C. Whisper Repetition Control
* **Problem:** `openai/whisper-large-v3` entered repeating loops generating phrases like `"ស្លាប់ការបស់..."` until hitting `max_new_tokens=256`, taking ~180s per sample.
* **Fix:** Configured generation arguments with repetition penalties and length constraints:
  ```python
  generate_kwargs={
      "language": "km",
      "task": "transcribe",
      "no_repeat_ngram_size": 4,
      "max_new_tokens": 128,
  }
  ```

### D. Unified Inference Pipeline (`scripts/run_inference.py`)
* Supports all models via a single command-line interface:
  ```bash
  python scripts/run_inference.py --model meta_mms_1b
  python scripts/run_inference.py --model whisper_base_khmer
  python scripts/run_inference.py --model qwen3_khmer
  python scripts/run_inference.py --model whisper_large_v3
  python scripts/run_inference.py --model google_chirp
  ```
* **Real-time Incremental Persistence:** Appends/rewrites predictions immediately after each audio sample completes, ensuring live visibility in `hypotheses/*.jsonl` and preventing data loss.
* **Google Speech Engine Integration:** Automatically uses Google's Khmer Speech engine (`km-KH`) with in-memory WAV conversion when cloud service account credentials are not configured.

### E. Standardized Khmer Normalization & Evaluation (`scripts/normalize.py` & `scripts/evaluate_metrics.py`)
* Normalization cleans text across all references and hypotheses:
  * Unicode NFC normalization (`unicodedata.normalize('NFC', text)`).
  * Strips zero-width space (`\u200B`), zero-width non-joiner (`\u200C`), zero-width joiner (`\u200D`), and byte order marks (`\uFEFF`).
  * Collapses redundant spaces and non-breaking spaces (`\u00A0`).
* Standard Corpus CER is computed as:
  $$\text{CER} = \frac{\sum (S + D + I)}{\sum N_{\text{ref}}} \times 100$$
  using Levenshtein character alignment via `jiwer`.
* Exports detailed per-sample breakdown tables with character counts, insertions, deletions, substitutions, and latencies.

### F. Universal Audio Transcoding via FFmpeg
* Audio ingested from diverse browser microphone encoders (e.g., WebM / Opus) or non-standard container formats is automatically transcoded into canonical **16kHz 16-bit mono PCM WAV** via `convert_to_pcm_wav()`.
* Ensures 100% decoder compatibility across all backend model tokenizers (Wav2Vec2, Whisper log-mel spectrogram extractors, and Qwen3 audio encoders).

### G. In-Memory Model Caching (`MODEL_CACHE`)
* In the FastAPI backend (`scripts/server.py`), loaded model runners are cached in-memory across HTTP requests.
* Eliminates redundant PyTorch weight loading and cold-start penalties when evaluating multiple audio samples interactively.

---

## 5. Complete Repository File Structure

```text
asr_testing/
├── data/
│   ├── ground_truth.jsonl                # Verified Khmer audio reference transcripts & metadata
│   └── raw_audio/                        # Raw evaluation audio recordings (km_eval_0001 to km_eval_0016)
│       ├── km_eval_0001.wav
│       ├── km_eval_0002.mp3
│       └── ...
├── hypotheses/                           # Model prediction outputs (JSONL)
│   ├── google_chirp.jsonl
│   ├── meta_mms_1b.jsonl
│   ├── openai_whisper_large_v3.jsonl
│   ├── seanghay_qwen3_asr_0_6b.jsonl
│   └── sengtha_whisper_base_khmer.jsonl
├── results/
│   ├── metrics_summary.csv               # Consolidated CER (%) and latency benchmark table
│   └── error_analysis/                   # Sample-by-sample CSV error breakdowns per model
│       ├── google_chirp_cer_breakdown.csv
│       ├── meta_mms_1b_cer_breakdown.csv
│       ├── openai_whisper_large_v3_cer_breakdown.csv
│       ├── seanghay_qwen3_asr_0_6b_cer_breakdown.csv
│       └── sengtha_whisper_base_khmer_cer_breakdown.csv
├── scripts/
│   ├── __init__.py                       # Package initializer
│   ├── evaluate_metrics.py               # Standalone evaluation pipeline (calculates CER & exports CSVs)
│   ├── normalize.py                      # Standardized Khmer Unicode NFC & ZWSP cleaner
│   ├── run_inference.py                  # Unified batch inference runner for all 5 models
│   ├── server.py                         # FastAPI backend server with model caching & dataset lifecycle
│   └── transcribe_api.py                 # CLI wrapper forwarding directly to run_inference.py
├── frontend/                             # Interactive Evaluation Studio (React 19 + Vite)
│   ├── public/
│   │   ├── favicon.svg                   # Custom studio branding favicon
│   │   └── icons.svg                     # SVG icon assets
│   ├── src/
│   │   ├── assets/                       # Image assets and logos
│   │   ├── components/
│   │   │   ├── AudioInputCard.jsx        # Audio source switcher (preloaded/upload/mic) & 2-step buttons
│   │   │   ├── MetricsLeaderboard.jsx    # Benchmark leaderboard & sample breakdown with inline detail
│   │   │   ├── ModelSelector.jsx         # Model selection badge grid with parameter & architecture specs
│   │   │   ├── MultiModelComparisonCard.jsx # Side-by-side ranked comparison matrix for all 5 models
│   │   │   ├── Navbar.jsx                # Header navigation with tab switcher & evaluation count
│   │   │   ├── StackItemCard.jsx         # Card rendering reference, hypothesis, CER pill & diff alignment
│   │   │   └── StackManager.jsx          # LIFO evaluation stack controller (pop, clear, export CSV)
│   │   ├── hooks/
│   │   │   └── useAsrStack.js            # Custom React hook for LIFO evaluation stack state management
│   │   ├── App.css                       # Component-level styles
│   │   ├── App.jsx                       # Main application shell and tab coordination
│   │   ├── index.css                     # Editorial design system (variables, typography, cards, tables)
│   │   └── main.jsx                      # React entrypoint
│   ├── dist/                             # Production build bundle
│   ├── package.json                      # Frontend dependencies (React 19, Lucide, Vite)
│   └── vite.config.js                    # Vite bundler configuration with dev server proxy
├── knowledge/
│   ├── allpredict.md                     # Deep-dive architecture reference for ALL Models SSE suite & sync
│   └── context.md                        # Master project documentation, architecture, & research log
├── temp_uploads/                         # Temporary directory for converted 16kHz PCM audio files
├── model.py                              # Standalone Qwen3-ASR single-file transcription script
├── requirements.txt                      # Python dependencies (torch, transformers, jiwer, fastapi, etc.)
├── README.md                             # Top-level quickstart and pipeline instructions
└── .gitignore                            # Excludes venv, caches, audio temp files, and checkpoints
```

---

## 6. Roadmap for Future 3-Month Fine-Tuning

1. **Model Selection:**
   * **Primary Target:** `facebook/mms-1b-all` (Wav2Vec2 with `khm` adapter) — fastest CPU/GPU inference, modular adapter architecture, lowest open-source CER (54.31%).
   * **Secondary Target:** `sengtha/whisper-base-khmer` (74M Whisper) — lightweight footprint, strong sequence-to-sequence structure, low memory requirement (56.26%).
2. **Hardware Compatibility:**
   * Both models can be trained/fine-tuned on consumer GPUs (e.g. RTX 3050 / RTX 4060) using LoRA (PEFT) and FP16 / 8-bit quantization.
3. **Training Data Recommendations:**
   * Supplement `km_eval` with public open datasets (OpenSLR Khmer, Mozilla Common Voice Khmer) alongside specialized conversational domain recordings.

---

## 7. Interactive Evaluation Studio (Frontend & Backend)

An interactive web application was developed for testing, comparing, and managing Khmer ASR benchmark datasets in real-time.

### A. Tech Stack & Design Philosophy
* **Frontend:** React 19 + Vite, Vanilla CSS design system inspired by contemporary graphic editorial design (Dsgners®) and bold neo-pop (MOGO).
* **Zero AI Slop:** Completely avoids generic dark-mode glowing gradients and blurry glassmorphism. Uses warm editorial paper canvas (`#F6F4EE`), crisp flat borders (`1.5px solid #0F172A`), zero hard drop-shadows, and typography paired with `Kantumruy Pro` (Khmer), `Plus Jakarta Sans` / `Syne` (Headers), and `JetBrains Mono` (Metrics).
* **Vertical 3-Container Flow:**
  1. `Model Architecture` (Software badge selector with live architecture & parameter specs)
  2. `Audio & Expected Output` (Preloaded sample picker, file upload, mic recorder, ground truth textarea)
  3. `LIFO Evaluation Stack` (Push, pop, clear, CSV export, side-by-side comparison, character-level diffs)
* **Backend Bridge:** Python FastAPI (`scripts/server.py`) running on `http://127.0.0.1:8000`, interfacing directly with `scripts/run_inference.py`, `scripts/normalize.py`, `jiwer`, and `data/`.

### B. Core Features & Dynamic Dataset Auto-Indexing
1. **Model Selector:** Switch between all 5 benchmarked models (`meta_mms_1b`, `sengtha_whisper_base_khmer`, `seanghay_qwen3_asr_0_6b`, `google_chirp`, `openai_whisper_large_v3`).
2. **Dynamic Auto-Indexing (`km_eval_0017...`):**
   * Automatically scans existing dataset samples and calculates the next available ID (e.g. `km_eval_0017`).
   * When saving a new audio recording or upload, saves directly into `data/raw_audio/km_eval_XXXX.<ext>`, registers in `data/ground_truth.jsonl`, runs the model, appends the evaluation directly to `results/error_analysis/<model>_cer_breakdown.csv`, and recalculates `results/metrics_summary.csv`.
   * The sample immediately appears in the **Sample-by-Sample Breakdown** table and increments the total dataset count.
3. **Sample Deletion & Automatic Recalculation:**
   * Each row in the **Sample-by-Sample Breakdown** table features a two-step `Delete` -> `Confirm?` button.
   * Deleting a sample removes the audio file from `data/raw_audio/`, updates `data/ground_truth.jsonl`, cleans all breakdown CSVs, updates hypotheses JSONLs, recalculates the Leaderboard summary, decrements the total count, and frees up the index.
4. **LIFO Evaluation Stack:**
   * Stack-based evaluation history with `pop`, `clear`, and CSV export matching the `error_analysis` format.
5. **Exact Metrics & Character Alignment:**
   * Computes $S, I, D, N$, and CER (%) with color-coded character alignment tokens.
6. **Benchmark Leaderboard Directory:**
   * Live consolidated ranking table with interactive sample-by-sample breakdown inspector.

### C. Guided Two-Step Execution Workflow
To prevent accidental dataset contamination, the studio enforces a strict two-step execution pattern:
* **Step 1: Run Model Prediction & Push to Stack (Yellow Button):**
  * Transcribes the audio using the selected model.
  * Computes CER % and character alignment against the ground truth (if provided).
  * Pushes the result to the LIFO Evaluation Stack for inspection.
  * Caches the transcoded 16kHz audio and prediction output in memory/temp storage.
* **Step 2: Save Verified Prediction to Dataset (Blue Button):**
  * Becomes active only after Step 1 has successfully executed.
  * Allows the user to inspect the transcription hypothesis, edit the ground truth if necessary, and explicitly commit the sample.
  * Automatically assigns the next sequential sample ID (`km_eval_XXXX`), moves the audio into `data/raw_audio/`, appends to `ground_truth.jsonl`, registers the prediction in the model's error analysis breakdown, and recomputes the benchmark leaderboard.

### D. In-Place Sample Detail Inspector
* The **Sample-by-Sample Breakdown** table features a dedicated `Detail / Hide` button (`Eye` icon) on every evaluation row.
* Clicking `Detail` expands an inline accordion card directly within the table without navigating away.
* Fetches full evaluation metrics from `/api/dataset/sample-detail/{model_name}/{sample_id}`, rendering:
  * Playable audio strip linked to `/api/audio/{filename}`
  * Side-by-side comparison of Raw and Normalized Reference vs. Model Hypothesis
  * Color-coded character alignment diff tokens ($S$ Substitutions in amber, $I$ Insertions in blue, $D$ Deletions in crimson)
  * Character counts ($N_{\text{ref}}$, $N_{\text{hyp}}$), sample CER %, and latency in seconds.

### E. Backend REST API Endpoints Specification

| Method | Endpoint | Description | Key Parameters / Payload |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status and loaded models | None |
| `GET` | `/api/models` | List of 5 models with metadata and CER rank | None |
| `GET` | `/api/dataset` | Retrieve all samples from `ground_truth.jsonl` | None |
| `GET` | `/api/dataset/next-id` | Returns next sequential ID (e.g. `km_eval_0017`) and count | None |
| `GET` | `/api/audio/{filename}` | Stream audio from `data/raw_audio/` or `temp_uploads/` | `filename` (path parameter) |
| `GET` | `/api/metrics` | Consolidated summary and error breakdown tables | None |
| `GET` | `/api/dataset/sample-detail/{model}/{id}` | Full sample evaluation with diff tokens and audio URL | `model`, `id` (path parameters) |
| `POST` | `/api/predict` | Step 1 single-model inference runner and CER calculator | `model_name`, `file` / `sample_id`, `expected_output` |
| `POST` | `/api/predict-all-stream` | Step 1 SSE streaming runner evaluating all 5 models sequentially with memory cleanup | `file` / `sample_id`, `expected_output` |
| `POST` | `/api/dataset/create-sample` | Step 2 commit (single-model): saves audio, registers GT & breakdown | `model_name`, `expected_output`, `cached_filename`, `file` |
| `POST` | `/api/dataset/create-sample-all` | Step 2 commit (multi-model): synchronizes all 5 breakdowns simultaneously | `expected_output`, `cached_filename`, `results_json`, `file` |
| `DELETE` | `/api/dataset/delete-sample/{id}` | Purges sample across GT, audio, CSVs, and hypotheses | `id` (path parameter) |

### F. Launch Instructions
```bash
# Terminal 1: Launch FastAPI Backend
.venv\Scripts\python.exe -m uvicorn scripts.server:app --host 127.0.0.1 --port 8000

# Terminal 2: Launch Vite Frontend
cd frontend
npm run dev
# Studio is accessible at http://localhost:5173
```

---

## 8. Summary of Completed Deliverables ("What Has Been Done So Far")

The following components, experiments, and features have been fully implemented, tested, and integrated into the repository:

1. **Khmer Audio Evaluation Dataset:**
   * 16 verified audio samples (`km_eval_0001` to `km_eval_0016`) covering diverse Khmer conversational domains (restaurant bookings, full names, administrative divisions, numerals, and calendar terms).
   * Verified ground truth reference transcriptions stored in `data/ground_truth.jsonl`.
2. **Khmer Unicode Normalization Pipeline (`scripts/normalize.py`):**
   * Canonical Unicode NFC normalization.
   * Total removal of zero-width control characters (`\u200B` ZWSP, `\u200C` ZWNJ, `\u200D` ZWJ, `\uFEFF` BOM).
   * Redundant whitespace and non-breaking space collapsing.
3. **Five Benchmarked ASR Models:**
   * **Google Chirp (Cloud API):** 44.08% CER, 5.47s latency.
   * **Meta MMS-1B (facebook/mms-1b-all):** 54.31% CER, 5.51s latency (Top Open-Source recommendation).
   * **Sengtha Whisper Base Khmer (sengtha/whisper-base-khmer):** 56.26% CER, 14.52s latency (74M lightweight model).
   * **Seanghay Qwen3-ASR 0.6B (seanghay/Qwen3-ASR-0.6B-Khmer):** 59.39% CER, 17.77s latency (Modern Speech-LLM).
   * **OpenAI Whisper Large v3 (openai/whisper-large-v3):** 94.08% CER, 93.06s latency (Baseline demonstration of scale vs fine-tuning).
4. **Engineering Architecture Fixes:**
   * Fixed Qwen3-ASR `lm_head.weight` tying bug preventing garbled output characters.
   * Patched Hugging Face Transformers compatibility for dynamic RoPE initialization and attention masks.
   * Added repetition penalty constraints to prevent autoregressive infinite loops in Whisper.
5. **Unified Batch Inference & CLI Pipeline (`scripts/run_inference.py`, `scripts/transcribe_api.py`):**
   * Real-time incremental persistence to `hypotheses/*.jsonl`.
   * Support for all individual models and sequential batch execution (`--model all_local`).
6. **Automated Evaluation Pipeline (`scripts/evaluate_metrics.py`):**
   * Corpus-level micro-averaged CER (%) computation via Levenshtein edit distance.
   * Per-sample CSV error breakdown tables in `results/error_analysis/`.
   * Consolidated summary table in `results/metrics_summary.csv`.
7. **FastAPI Backend Service (`scripts/server.py`):**
   * In-memory model caching (`MODEL_CACHE`) for fast interactive inference.
   * Universal audio transcoding to 16kHz PCM mono WAV via FFmpeg.
   * Dynamic next-ID auto-indexing (`get_next_sample_id`).
   * Atomically synchronized sample creation and deletion across ground truth, audio files, breakdown CSVs, and leaderboard summaries.
   * Rich sample-detail endpoint providing character-level sequence diff opcodes.
8. **Interactive Evaluation Studio Frontend (`frontend/`):**
   * Modern editorial paper aesthetic with zero generic AI styling.
   * Three-container layout: Model Selector, Audio Input & Expected Output Card, and LIFO Evaluation Stack.
   * Multi-source audio input: preloaded dataset picker, file drag-and-drop upload, and live in-browser microphone recording.
   * Enforced two-step workflow (Step 1: Predict & Inspect -> Step 2: Commit to Benchmark).
   * Interactive Benchmark Leaderboard with sorting and ranking.
   * Sample-by-Sample Breakdown table with inline `Detail` inspection and two-step confirmation deletion.
   * Evaluation stack history with CSV export matching benchmark format.
