# Khmer ASR Benchmark & Evaluation Pipeline

A clean, standardized, automated evaluation pipeline for benchmarking Automatic Speech Recognition (ASR) models (Google Chirp, OpenAI Whisper, Meta MMS, etc.) on Khmer speech datasets.

The metric calculated is exclusively **Character Error Rate (CER %)**, which is the standard evaluation metric for continuous scripts like Khmer.

---

## 📁 Directory Structure

```text
asr_testing/
├── data/
│   ├── raw_audio/                   # All raw audio files (.wav, .mp3, .flac)
│   │   ├── buffet1.wav
│   │   ├── buffet2.mp3
│   │   ├── test1.wav
│   │   ├── bora_record_01.mp3
│   │   └── ...
│   └── ground_truth.jsonl           # Ground truth references & audio metadata
├── hypotheses/                      # One JSONL per model containing transcript predictions
│   ├── google_chirp.jsonl
│   ├── sengtha_whisper_base_khmer.jsonl
│   ├── meta_mms_1b.jsonl
│   └── openai_whisper_large_v3.jsonl
├── results/
│   ├── error_analysis/              # Fine-grained sample-level breakdown CSVs
│   │   ├── google_chirp_cer_breakdown.csv
│   │   ├── sengtha_whisper_base_khmer_cer_breakdown.csv
│   │   ├── meta_mms_1b_cer_breakdown.csv
│   │   └── openai_whisper_large_v3_cer_breakdown.csv
│   └── metrics_summary.csv          # Consolidated benchmark ranking table
├── scripts/
│   ├── __init__.py
│   ├── normalize.py                 # Khmer Unicode NFC + ZWSP normalizer
│   ├── evaluate_metrics.py          # Automated evaluation runner
│   └── run_inference.py             # Batch inference runner for all 4 local models + Cloud APIs
├── requirements.txt
└── README.md
```

---

## ⚙️ Setup & Installation

Ensure you have Python 3.10+ installed:

```bash
pip install -r requirements.txt
```

---

## 🚀 Running the Evaluation Pipeline

To evaluate all model hypothesis files currently in `hypotheses/` against `data/ground_truth.jsonl`:

```bash
python scripts/evaluate_metrics.py
```

### Outputs:
1. **Console Table:** Prints a ranked leaderboard of models from lowest to highest CER (%).
2. **`results/metrics_summary.csv`:**
   ```csv
   model_name,total_samples,total_duration_sec,CER (%),avg_latency_sec
   google_chirp,17,239.31,1.38,0.469
   sengtha_whisper_base_khmer,17,239.31,2.88,0.951
   meta_mms_1b,17,239.31,4.5,0.625
   openai_whisper_large_v3,17,239.31,6.5,2.155
   ```
3. **`results/error_analysis/{model_name}_cer_breakdown.csv`:**
   Sample-by-sample analysis reporting reference text, hypothesis text, character counts, substitutions ($S$), insertions ($I$), deletions ($D$), sample CER %, and latency.

---

## 📝 File Schemas

### 1. `data/ground_truth.jsonl`
```json
{"id": "buffet2", "audio_path": "data/raw_audio/buffet2.mp3", "duration": 12.98, "reference": "ជម្រាបសួរ ខ្ញុំចង់កក់ប៊ូហ្វេ កក់តុមួយ ម៉ោងប្រាំពីរ ហើយមនុស្សបួននាក់"}
```

### 2. `hypotheses/{model_name}.jsonl`
```json
{"id": "buffet2", "hypothesis": "ជម្រាបសួរ ខ្ញុំចង់កក់ប៊ូហ្វេ កក់តុមួយ ម៉ោង៧ ហើយមនុស្ស៤នាក់", "latency_sec": 0.42}
```

---

## 🇰🇭 Khmer Text Normalization Details (`scripts/normalize.py`)
Khmer script presents unique challenges for ASR evaluation:
- **Unicode Decomposition:** Khmer vowels and subscript consonants (*Coeng*) may be encoded as separate or composed codepoints. We apply **Unicode NFC** (`unicodedata.normalize('NFC', text)`).
- **Zero-Width Spaces:** Digital Khmer text frequently embeds `\u200B` (ZWSP), `\u200C` (ZWNJ), or `\u200D` (ZWJ) for line-breaking cues. These are invisible but artificially skew character edit distance. Our normalizer strips them completely.
- **Whitespace Collapsing:** Replaces non-breaking spaces (`\u00A0`) and merges redundant spaces.

---

## 🏃 Running Inference across the Dataset (`scripts/run_inference.py`)

Run batch inference across all 17 samples in `data/ground_truth.jsonl` and automatically output to `hypotheses/`:

### A. Run Any of the 4 Local Models:
```bash
# Model 1 (transcribe.py): Qwen3-ASR 0.6B Khmer
python scripts/run_inference.py --model qwen3_khmer

# Model 2 (transcribe2.py): Whisper-Base Khmer
python scripts/run_inference.py --model whisper_base_khmer

# Model 3 (transcribe3.py): Meta MMS 1B
python scripts/run_inference.py --model meta_mms_1b

# Model 4 (transcribe4.py): OpenAI Whisper-Large-v3 (local)
python scripts/run_inference.py --model whisper_large_v3

# Or run all 4 local models in sequence:
python scripts/run_inference.py --model all_local
```

### B. Run Cloud API Models:
```bash
# Google Cloud Speech-to-Text (Chirp-2)
$env:GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account.json"
python scripts/run_inference.py --model google_chirp --google-project-id "YOUR_GCP_PROJECT_ID"

# OpenAI Whisper API
$env:OPENAI_API_KEY="sk-..."
python scripts/run_inference.py --model openai_whisper
```


