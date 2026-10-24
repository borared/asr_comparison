"""
scripts/run_inference.py
Unified Batch Inference Runner for Khmer ASR Evaluation.

Supports all models across the project:
1. Local Models:
   - qwen3_khmer / seanghay_qwen3_asr_0_6b   (seanghay/Qwen3-ASR-0.6B-Khmer)
   - meta_mms_1b / facebook_mms_1b_all       (facebook/mms-1b-all)
   - whisper_base_khmer / sengtha_whisper_base_khmer (sengtha/whisper-base-khmer)
   - whisper_large_v3 / openai_whisper_large_v3      (openai/whisper-large-v3)
2. Cloud API Models:
   - google_chirp                           (Google Cloud Speech-to-Text v2 / Chirp-2)
   - openai_whisper                         (OpenAI Whisper-1 API)
3. Batch Mode:
   - all_local                              (Runs all 4 local models sequentially)

Iterates over data/ground_truth.jsonl and outputs directly to hypotheses/{model_name}.jsonl.
"""

import argparse
import json
import logging
import os
import sys
import tempfile
import time
from pathlib import Path

# Setup cache and temp directories on Drive E
BASE_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = BASE_DIR / ".cache"
TEMP_DIR = CACHE_DIR / "temp"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)

os.environ["HF_HOME"] = str(CACHE_DIR)
os.environ["TEMP"] = str(TEMP_DIR)
os.environ["TMP"] = str(TEMP_DIR)
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "4"
os.environ["OMP_NUM_THREADS"] = "4"
os.environ["MKL_NUM_THREADS"] = "4"
tempfile.tempdir = str(TEMP_DIR)

# Ensure terminal stdout handles UTF-8 for Khmer characters on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
else:
    sys.stdout.reconfigure(line_buffering=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("ASR_Runner")

DATA_DIR = BASE_DIR / "data"
HYPOTHESES_DIR = BASE_DIR / "hypotheses"
GROUND_TRUTH_FILE = DATA_DIR / "ground_truth.jsonl"

# Canonical mapping of model aliases to canonical IDs and default hypothesis filenames
MODEL_REGISTRY = {
    "qwen3_khmer": {
        "canonical": "qwen3_khmer",
        "output_file": "seanghay_qwen3_asr_0_6b.jsonl",
        "description": "seanghay/Qwen3-ASR-0.6B-Khmer",
    },
    "seanghay_qwen3_asr_0_6b": {
        "canonical": "qwen3_khmer",
        "output_file": "seanghay_qwen3_asr_0_6b.jsonl",
        "description": "seanghay/Qwen3-ASR-0.6B-Khmer",
    },
    "meta_mms_1b": {
        "canonical": "meta_mms_1b",
        "output_file": "meta_mms_1b.jsonl",
        "description": "facebook/mms-1b-all",
    },
    "facebook_mms_1b_all": {
        "canonical": "meta_mms_1b",
        "output_file": "meta_mms_1b.jsonl",
        "description": "facebook/mms-1b-all",
    },
    "whisper_base_khmer": {
        "canonical": "whisper_base_khmer",
        "output_file": "sengtha_whisper_base_khmer.jsonl",
        "description": "sengtha/whisper-base-khmer",
    },
    "sengtha_whisper_base_khmer": {
        "canonical": "whisper_base_khmer",
        "output_file": "sengtha_whisper_base_khmer.jsonl",
        "description": "sengtha/whisper-base-khmer",
    },
    "whisper_large_v3": {
        "canonical": "whisper_large_v3",
        "output_file": "openai_whisper_large_v3.jsonl",
        "description": "openai/whisper-large-v3 (local)",
    },
    "openai_whisper_large_v3": {
        "canonical": "whisper_large_v3",
        "output_file": "openai_whisper_large_v3.jsonl",
        "description": "openai/whisper-large-v3 (local)",
    },
    "google_chirp": {
        "canonical": "google_chirp",
        "output_file": "google_chirp.jsonl",
        "description": "Google Cloud Speech-to-Text v2 / Chirp-2",
    },
    "openai_whisper": {
        "canonical": "openai_whisper",
        "output_file": "openai_whisper_api.jsonl",
        "description": "OpenAI Whisper-1 Hosted API",
    },
}


class ModelRunner:
    """Manages model loading and single-sample inference."""

    def __init__(self, canonical_key: str, **kwargs):
        self.canonical_key = canonical_key
        self.kwargs = kwargs
        self.device = "cuda:0" if self._has_cuda() else "cpu"
        self._setup()

    def _has_cuda(self) -> bool:
        try:
            import torch
            return torch.cuda.is_available()
        except ImportError:
            return False

    def _setup(self):
        import torch

        logger.info(f"Setting up [{self.canonical_key}] on device: {self.device}...")

        if self.canonical_key == "qwen3_khmer":
            from qwen_asr import Qwen3ASRModel
            dtype = torch.bfloat16 if self.device.startswith("cuda") else torch.float32
            self.model = Qwen3ASRModel.from_pretrained(
                "seanghay/Qwen3-ASR-0.6B-Khmer",
                dtype=dtype,
                device_map=self.device,
                max_inference_batch_size=32,
                max_new_tokens=256,
            )
            self.model.model.thinker.lm_head.weight = self.model.model.thinker.model.embed_tokens.weight

        elif self.canonical_key == "meta_mms_1b":
            from transformers import AutoProcessor, Wav2Vec2ForCTC
            self.dtype = torch.float16 if self.device.startswith("cuda") else torch.float32
            model_id = "facebook/mms-1b-all"
            self.processor = AutoProcessor.from_pretrained(model_id, cache_dir=str(CACHE_DIR))
            self.model = Wav2Vec2ForCTC.from_pretrained(
                model_id,
                cache_dir=str(CACHE_DIR),
                torch_dtype=self.dtype,
            ).to(self.device)
            self.processor.tokenizer.set_target_lang("khm")
            self.model.load_adapter("khm")

        elif self.canonical_key == "whisper_base_khmer":
            from transformers import pipeline
            torch_dtype = torch.float16 if self.device.startswith("cuda") else torch.float32
            self.pipe = pipeline(
                "automatic-speech-recognition",
                model="sengtha/whisper-base-khmer",
                chunk_length_s=30,
                device=self.device,
                torch_dtype=torch_dtype,
                generate_kwargs={"language": "km", "task": "transcribe"},
            )

        elif self.canonical_key == "whisper_large_v3":
            from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
            torch_dtype = torch.float16 if self.device.startswith("cuda") else torch.float32
            model_id = "openai/whisper-large-v3"
            model = AutoModelForSpeechSeq2Seq.from_pretrained(
                model_id,
                torch_dtype=torch_dtype,
                low_cpu_mem_usage=True,
                use_safetensors=True,
                cache_dir=str(CACHE_DIR),
            ).to(self.device)
            processor = AutoProcessor.from_pretrained(model_id, cache_dir=str(CACHE_DIR))
            self.pipe = pipeline(
                "automatic-speech-recognition",
                model=model,
                tokenizer=processor.tokenizer,
                feature_extractor=processor.feature_extractor,
                torch_dtype=torch_dtype,
                chunk_length_s=30,
                device=self.device,
            )

        elif self.canonical_key == "google_chirp":
            project_id = self.kwargs.get("google_project_id") or os.environ.get("GOOGLE_CLOUD_PROJECT")
            if project_id and os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
                try:
                    import importlib
                    speech_v2 = importlib.import_module("google.cloud.speech_v2")
                    types_mod = importlib.import_module("google.cloud.speech_v2.types")
                    SpeechClient = speech_v2.SpeechClient
                    self.cloud_speech = types_mod.cloud_speech
                    region = self.kwargs.get("google_region", "us-central1")
                    self.google_client = SpeechClient(
                        client_options={"api_endpoint": f"{region}-speech.googleapis.com"}
                    )
                    self.google_backend = "cloud_api"
                except Exception as e:
                    logger.warning(f"Could not initialize Cloud Speech v2 ({e}), falling back to Google Speech engine.")
                    self.google_backend = "speech_recognition"
                    import speech_recognition as sr
                    self.sr_recognizer = sr.Recognizer()
            else:
                logger.info("Using Google Speech recognition engine (km-KH).")
                self.google_backend = "speech_recognition"
                import speech_recognition as sr
                self.sr_recognizer = sr.Recognizer()

        elif self.canonical_key == "openai_whisper":
            try:
                import importlib
                openai_mod = importlib.import_module("openai")
                OpenAI = openai_mod.OpenAI
            except ImportError:
                raise ImportError("openai is not installed. Run: pip install openai")
            self.openai_client = OpenAI()

        logger.info(f"Model [{self.canonical_key}] is loaded and ready.")

    def transcribe(self, audio_path: Path) -> tuple[str, float]:
        start = time.perf_counter()

        if self.canonical_key == "qwen3_khmer":
            res = self.model.transcribe(audio=str(audio_path))
            text = res[0].text if res else ""

        elif self.canonical_key == "meta_mms_1b":
            import librosa
            import torch
            audio_array, _ = librosa.load(str(audio_path), sr=16_000)
            inputs = self.processor(audio_array, sampling_rate=16_000, return_tensors="pt")
            inputs = {
                k: v.to(device=self.device, dtype=self.dtype if torch.is_floating_point(v) else None)
                for k, v in inputs.items()
            }
            with torch.no_grad():
                logits = self.model(**inputs).logits
            predicted_ids = torch.argmax(logits, dim=-1)
            text = self.processor.batch_decode(predicted_ids)[0]

        elif self.canonical_key == "whisper_base_khmer":
            res = self.pipe(str(audio_path))
            text = res.get("text", "")

        elif self.canonical_key == "whisper_large_v3":
            res = self.pipe(
                str(audio_path),
                generate_kwargs={
                    "language": "km",
                    "task": "transcribe",
                    "no_repeat_ngram_size": 4,
                    "max_new_tokens": 128,
                },
            )
            text = res.get("text", "")

        elif self.canonical_key == "google_chirp":
            if getattr(self, "google_backend", "speech_recognition") == "cloud_api":
                project_id = self.kwargs.get("google_project_id") or os.environ.get("GOOGLE_CLOUD_PROJECT")
                region = self.kwargs.get("google_region", "us-central1")
                with open(audio_path, "rb") as f:
                    content = f.read()
                config = self.cloud_speech.RecognitionConfig(
                    auto_decoding_config=self.cloud_speech.AutoDetectDecodingConfig(),
                    language_codes=["km-KH"],
                    model="chirp_2",
                )
                req = self.cloud_speech.RecognizeRequest(
                    recognizer=f"projects/{project_id}/locations/{region}/recognizers/_",
                    config=config,
                    content=content,
                )
                response = self.google_client.recognize(request=req)
                text = "".join(r.alternatives[0].transcript for r in response.results if r.alternatives)
            else:
                import io
                import librosa
                import soundfile as sf
                import speech_recognition as sr

                y, sr_rate = librosa.load(str(audio_path), sr=16000)
                buf = io.BytesIO()
                sf.write(buf, y, sr_rate, format="WAV")
                buf.seek(0)
                with sr.AudioFile(buf) as source:
                    audio_data = self.sr_recognizer.record(source)
                try:
                    text = self.sr_recognizer.recognize_google(audio_data, language="km-KH")
                except sr.UnknownValueError:
                    text = ""
                except Exception as e:
                    logger.warning(f"Google speech error: {e}")
                    text = ""

        elif self.canonical_key == "openai_whisper":
            with open(audio_path, "rb") as f:
                obj = self.openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=f,
                    language="km",
                    temperature=0.0,
                )
            text = obj.text

        else:
            raise ValueError(f"Unknown canonical model: {self.canonical_key}")

        latency = time.perf_counter() - start
        return text.strip(), latency


def run_single_model(model_name: str, output_name: str = "", **kwargs):
    """Executes batch inference for one model over data/ground_truth.jsonl."""
    if model_name not in MODEL_REGISTRY:
        raise ValueError(f"Unrecognized model: '{model_name}'. Choose from: {list(MODEL_REGISTRY.keys())}")

    meta = MODEL_REGISTRY[model_name]
    canonical_key = meta["canonical"]
    out_filename = output_name or meta["output_file"]
    if not out_filename.endswith(".jsonl"):
        out_filename += ".jsonl"
    output_path = HYPOTHESES_DIR / out_filename

    # Validate Cloud API credentials before running
    if canonical_key == "google_chirp":
        project_id = kwargs.get("google_project_id") or os.environ.get("GOOGLE_CLOUD_PROJECT", "")
        if not project_id:
            logger.info("No Google Cloud Project ID provided; using Google Speech recognition engine directly.")
        else:
            kwargs["google_project_id"] = project_id
    elif canonical_key == "openai_whisper":
        if "OPENAI_API_KEY" not in os.environ:
            logger.error("Missing OPENAI_API_KEY environment variable.")
            sys.exit(1)

    # Load ground truth entries
    if not GROUND_TRUTH_FILE.exists():
        logger.error(f"Cannot find ground truth file: {GROUND_TRUTH_FILE}")
        sys.exit(1)

    with open(GROUND_TRUTH_FILE, "r", encoding="utf-8") as f:
        samples = [json.loads(line) for line in f if line.strip()]

    limit = kwargs.get("limit", 0)
    if limit and limit > 0:
        samples = samples[:limit]

    logger.info(f"\n{'='*55}\nRunning [{meta['description']}] on {len(samples)} samples\nTarget: {output_path.name}\n{'='*55}")

    runner = ModelRunner(canonical_key, **kwargs)

    predictions = []
    for idx, item in enumerate(samples, 1):
        sample_id = item["id"]
        rel_audio_path = item["audio_path"]
        abs_audio_path = BASE_DIR / rel_audio_path

        if not abs_audio_path.exists():
            logger.warning(f"Audio file not found: {abs_audio_path}")
            predictions.append({"id": sample_id, "hypothesis": "", "latency_sec": 0.0})
            continue

        logger.info(f"[{idx}/{len(samples)}] Transcribing ID: {sample_id} ({abs_audio_path.name})...")
        try:
            hyp, latency = runner.transcribe(abs_audio_path)
            logger.info(f" -> Latency: {latency:.2f}s | Result: {repr(hyp[:50])}...")
            predictions.append({
                "id": sample_id,
                "hypothesis": hyp,
                "latency_sec": round(latency, 3),
            })
        except Exception as e:
            logger.error(f"Error transcribing {sample_id}: {e}", exc_info=True)
            predictions.append({"id": sample_id, "hypothesis": "", "latency_sec": 0.0})

        # Incrementally persist after every sample so progress is visible immediately
        HYPOTHESES_DIR.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            for p in predictions:
                f.write(json.dumps(p, ensure_ascii=False) + "\n")

    logger.info(f"Successfully saved {len(predictions)} predictions to: {output_path.relative_to(BASE_DIR)}")


def main():
    parser = argparse.ArgumentParser(
        description="Unified ASR inference pipeline for Khmer speech evaluation."
    )
    parser.add_argument(
        "--model",
        type=str,
        choices=list(MODEL_REGISTRY.keys()) + ["all_local"],
        help="Model to run, or 'all_local' to run all 4 local models in sequence.",
    )
    parser.add_argument(
        "--output-name",
        type=str,
        default="",
        help="Custom output filename in hypotheses/ (default: auto per model).",
    )
    parser.add_argument(
        "--google-project-id",
        type=str,
        default=os.environ.get("GOOGLE_CLOUD_PROJECT", ""),
        help="Google Cloud Project ID (required for google_chirp).",
    )
    parser.add_argument(
        "--google-region",
        type=str,
        default="us-central1",
        help="Google Cloud Region for Chirp (default: us-central1).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Limit number of samples to process (default: 0 for all).",
    )
    args = parser.parse_args()

    if not args.model:
        parser.print_help()
        sys.exit(1)

    if args.model == "all_local":
        local_models = ["qwen3_khmer", "meta_mms_1b", "whisper_base_khmer", "whisper_large_v3"]
        for m in local_models:
            run_single_model(
                m,
                google_project_id=args.google_project_id,
                google_region=args.google_region,
                limit=args.limit,
            )
    else:
        run_single_model(
            args.model,
            output_name=args.output_name,
            google_project_id=args.google_project_id,
            google_region=args.google_region,
            limit=args.limit,
        )

    logger.info("\nInference complete! Run: python scripts/evaluate_metrics.py")


if __name__ == "__main__":
    main()
