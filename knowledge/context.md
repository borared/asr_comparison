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
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
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
  * Collapses redundant spaces.
* Standard Corpus CER is computed as:
  $$\text{CER} = \frac{\sum (S + D + I)}{\sum N_{\text{ref}}} \times 100$$
  using Levenshtein character alignment via `jiwer`.
* Exports detailed per-sample breakdown tables with character counts, insertions, deletions, substitutions, and latencies.

---

## 5. Repository File Structure

```text
asr_testing/
├── data/
│   ├── ground_truth.jsonl          # 16 verified Khmer audio reference transcripts
│   └── raw_audio/                  # 16 audio recordings (km_eval_0001 to km_eval_0016)
├── hypotheses/                     # Model prediction outputs (JSONL)
│   ├── google_chirp.jsonl
│   ├── meta_mms_1b.jsonl
│   ├── openai_whisper_large_v3.jsonl
│   ├── seanghay_qwen3_asr_0_6b.jsonl
│   └── sengtha_whisper_base_khmer.jsonl
├── results/
│   ├── metrics_summary.csv         # Consolidated CER (%) and latency benchmark table
│   └── error_analysis/             # Detailed CSV error breakdowns per model
│       ├── google_chirp_cer_breakdown.csv
│       ├── meta_mms_1b_cer_breakdown.csv
│       ├── openai_whisper_large_v3_cer_breakdown.csv
│       ├── seanghay_qwen3_asr_0_6b_cer_breakdown.csv
│       └── sengtha_whisper_base_khmer_cer_breakdown.csv
├── scripts/
│   ├── evaluate_metrics.py         # Evaluates hypotheses against ground truth -> CER
│   ├── normalize.py                # Standardized Khmer Unicode NFC & ZWSP cleaner
│   ├── run_inference.py            # Unified batch inference runner for all models
│   └── transcribe_api.py           # CLI entrypoint forwarding to run_inference.py
├── knowledge/
│   └── context.md                  # Comprehensive project context and architecture documentation
├── .gitignore                      # Excludes virtual environments and model caches
└── requirements.txt                # Python package dependencies
```

---

## 6. Roadmap for Future 3-Month Fine-Tuning

1. **Model Selection:**
   * **Primary Target:** `facebook/mms-1b-all` (Wav2Vec2 with `khm` adapter).
   * **Secondary Target:** `sengtha/whisper-base-khmer` (74M Whisper).
2. **Hardware Compatibility:**
   * Both models can be trained/fine-tuned on consumer GPUs (e.g. RTX 3050 / RTX 4060) using LoRA (PEFT) and FP16 / 8-bit quantization.
3. **Training Data Recommendations:**
   * Supplement `km_eval` with public open datasets (OpenSLR Khmer, Mozilla Common Voice Khmer) alongside specialized conversational domain recordings.
