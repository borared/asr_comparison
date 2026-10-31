# Khmer ASR Benchmark & Empirical Performance Report

This benchmark report details the empirical findings, comparative metrics, and technical challenges encountered when evaluating Automatic Speech Recognition (ASR) models on spoken Khmer audio datasets.

---

## 1. Executive Summary & Leaderboard

The benchmark evaluated **6 models** across standard spoken Khmer test audio containing continuous natural speech, conversational restaurant/ordering inquiries, fast spoken enumerations (names, calendar terms, honorifics), and code-switched phrases (Khmer mixed with English loanwords).

Because Khmer is a continuous script without natural spaces between words, **Character Error Rate (CER %)** is adopted as the primary accuracy metric, computed using standard Levenshtein distance on normalized text ($CER = \frac{S + D + I}{N} \times 100\%$).

### Ranked Performance Leaderboard

| Rank | Model Name | Architecture / Provider | Samples | Total Audio | Overall CER (%) | Avg Latency (s) | Real-Time Factor (RTF) |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| 🥇 **1** | **Google Cloud Chirp (v2)** | Conformer-based Cloud Speech API | 17 | 239.45s | **42.40%** | **5.47s** | ~0.39x |
| 🥈 **2** | **Hongleng Kasekor ASR (v0)** | Domain fine-tuned (Agriculture/Single sample test) | 1 | 8.82s | **42.86%** | **5.09s** | ~0.58x |
| 🥉 **3** | **Sengtha Whisper Base Khmer** | OpenAI Whisper Base fine-tune (~74M params) | 17 | 239.45s | **55.73%** | **14.24s** | ~1.01x |
| **4** | **Meta MMS-1B (Khmer)** | wav2vec 2.0 / CTC (~1B params) | 18 | 246.17s | **58.73%** | **5.86s** | **~0.42x** (Fastest local) |
| **5** | **Seanghay Whisper Small Khmer v2** | OpenAI Whisper Small fine-tune (~244M params) | 17 | 239.45s | **60.44%** | **32.68s** | ~2.32x (Slowest) |
| **6** | **Seanghay Qwen3 ASR 0.6B** | Qwen Audio / LLM-based ASR (~0.6B params) | 17 | 239.45s | **60.93%** | **17.01s** | ~1.21x |

---

## 2. Key Challenges & Benchmarks We Face

Through extensive error analysis across individual audio samples, several systemic issues and bottlenecks were identified:

### A. Dataset Annotation Mismatches & Spurious Insertions
- **Ground Truth vs Audio Content Discrepancy:**
  - In samples such as `km_eval_0004` and `km_eval_0009`, the reference transcript in `ground_truth.jsonl` was brief (e.g. `km_eval_0004`: *"ការប្រៀបធៀបគំរូវាយតម្លៃលើសំណុំទិន្នន័យជាក់ស្តែង"* [47 chars]), but the actual recorded audio contained full conversational speech (*"ជម្រាបសួរបងខាងពូហ្វេបងម៉ោង 5:00..."* [130+ chars]).
  - This mismatch caused massive insertion penalties ($I > 90$ characters), inflating sample CER above **250%** across all models and distorting aggregate benchmark scores.
- **Empty Reference / Hallucination Trap:**
  - Samples with unannotated speech or empty references (`km_eval_0003`, `km_eval_0018`) caused 100% CER penalties regardless of transcription fidelity.

### B. Khmer Orthography, Zero-Width Spaces (ZWSP), and Tokenization
- **Continuous Script Boundaries:** Khmer has no explicit word delimiters. Different models predict word-breaks differently:
  - Meta MMS predicts compact strings without spaces.
  - Whisper models attempt pseudo-word segmentation or insert whitespace.
  - When comparing raw predictions against references with mixed whitespace or invisible zero-width spaces (`\u200b`), character distance is severely penalized unless strict Unicode normalization (NFC) and whitespace stripping are consistently enforced.
- **Sub-character Component Confusion:**
  - Khmer characters consist of base consonants, subscripts (ជើង - Coeng), dependent vowels (ស្រៈនិស្ស័យ), and diacritics.
  - CTC models (like Meta MMS) frequently misordered stacked sub-characters (e.g., swapping subscript triggers `្` with adjacent vowels), leading to multiple substitution and insertion errors per syllable.

### C. Code-Switching & English Loanwords
- Real-world conversational Khmer frequently incorporates English loanwords:
  - *Example:* `"drink"`, `"homemade"`, `"signature"`, `"recommend"`, `"buffet"`.
- **Model behavior on loanwords:**
  - **Google Chirp** rendered loanwords into phonetically adapted Khmer (e.g., `"dream"`, `"អ្នកឈើ"`, `"រីខមិន"`), but occasionally lost semantic context.
  - **Whisper & Qwen3** exhibited high substitution errors on English terms (`"ទ្រីង"`, `"ហូបេន"`, `"សេនិឈើរ"`).
  - **Meta MMS (CTC)** struggled the most with loanwords, outputting corrupted roman letters mixed with Khmer characters (e.g., `bូfe`, `kancែដ`).

### D. Honorifics, Proper Nouns, and Rare Names
- Testing on rapid lists of Cambodian names (`km_eval_0005`, `km_eval_0006`) showed that:
  - Rare personal names (e.g., `បុផ្ផា`, `កេតនា`, `យៀកខៃ`, `បញ្ចពណ៌`) suffered high error rates across all open-weight models.
  - Models defaulted to common homophones (e.g., `បូរ៉ា` instead of `បុផ្ផា`, `ចេតនា` instead of `កេតនា`).

### E. Inference Latency vs. Accuracy Trade-Off
- **Meta MMS 1B (CTC)** delivers the highest throughput for local inference (~5.8s per ~14s audio file), but suffers from phonetic spelling degradation and lacks the contextual language modeling of autoregressive decoders.
- **Whisper Small v2** achieved a high CER (60.44%) while being the slowest model by far (**32.68s average latency**, RTF > 2.3x), making it impractical for real-time applications without quantization (ONNX, CTranslate2, or TensorRT-LLM).
- **Google Chirp** provided the best balance of CER (42.4%) and latency (5.47s), but requires internet connectivity and recurring API billing.

---

## 3. Detailed Model-by-Model Analysis

### 1. Google Cloud Chirp
- **Strengths:** Robust acoustic handling; best overall Khmer vocabulary understanding; handles punctuation and Western numerals (`5:20`, `4`) cleanly.
- **Weaknesses:** Cloud API dependency; high cost at scale; occasionally converts numerals to digits rather than Khmer spoken words, which increases character mismatch against spoken-form references.

### 2. Sengtha Whisper Base Khmer
- **Strengths:** Strongest local open-source model in this benchmark (**55.73% CER**); relatively lightweight footprint (~74M parameters); decent grammatical cohesion.
- **Weaknesses:** Prone to hallucinating conversational prefixes in silence or background noise; requires fine-grained VAD to prevent decoding runaway.

### 3. Meta MMS-1B (Khmer)
- **Strengths:** Blazing fast local execution; non-autoregressive CTC decoding prevents infinite repetition loops; good baseline phonetic acoustic alignment.
- **Weaknesses:** High spelling error rate due to lack of a strong language model head; mixes ASCII and Khmer characters when encountering unfamiliar acoustic tokens.

### 4. Seanghay Whisper Small Khmer v2
- **Strengths:** Captures richer conversational phrasing when speech is clean.
- **Weaknesses:** Unfavorable compute-to-accuracy ratio; severe latency overhead (~32.7s); sensitive to domain drift outside its training distribution.

### 5. Seanghay Qwen3 ASR 0.6B
- **Strengths:** Modern decoder architecture; generates well-formed Khmer phrases.
- **Weaknesses:** Still high character error rate (60.93%); occasionally introduces filler artifacts or repetition loops on non-speech segments.

---

## 4. Recommendations for Next Iterations

1. **Ground Truth Audit & Clean-up:**
   - Re-align audio files `km_eval_0004` and `km_eval_0009` with their exact spoken text to eliminate artificial 200%+ CER outliers.
   - Filter or separate empty/ambient audio clips from speech evaluation sets.
2. **Text Normalization Harmonization:**
   - Strip all non-semantic ZWSP (`\u200b`), enforce Khmer Unicode NFC normalization, and normalize digits (e.g., map numeric digits to Khmer text or vice-versa) before running Levenshtein alignment.
3. **Audio Preprocessing Pipeline:**
   - Run Silero VAD + DeepFilterNet prior to inference to remove non-speech segments and reduce hallucinations in autoregressive models (Whisper/Qwen).
4. **Local Model Acceleration:**
   - Quantize Whisper and Qwen models using `int8` / `float16` or CTranslate2 to bring inference latency below 1.0x RTF for practical edge deployments.
