import os
import sys
from pathlib import Path
import tempfile
import json
import argparse

# Force ALL HuggingFace cache and Windows temporary downloads to Drive E (130+ GB free)
cache_dir = Path(__file__).parent / ".cache"
temp_dir = cache_dir / "temp"
cache_dir.mkdir(parents=True, exist_ok=True)
temp_dir.mkdir(parents=True, exist_ok=True)

# Set environment variables BEFORE importing transformers / datasets / torch
os.environ["HF_HOME"] = str(cache_dir)
os.environ["TEMP"] = str(temp_dir)
os.environ["TMP"] = str(temp_dir)
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
# Limit BLAS threads to prevent OpenBLAS memory allocation failures on Windows CPU
os.environ["OPENBLAS_NUM_THREADS"] = "4"
os.environ["OMP_NUM_THREADS"] = "4"
os.environ["MKL_NUM_THREADS"] = "4"
tempfile.tempdir = str(temp_dir)

# Ensure terminal stdout handles UTF-8 for Khmer Unicode characters on Windows with immediate flush
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
else:
    sys.stdout.reconfigure(line_buffering=True)

import torch
torch.set_num_threads(4)

from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
from datasets import load_dataset


def main():
    parser = argparse.ArgumentParser(description="Transcribe audio using openai/whisper-large-v3")
    parser.add_argument(
        "--librispeech",
        action="store_true",
        help="Transcribe a sample from distil-whisper/librispeech_long instead of local dataset/buffet2.mp3",
    )
    parser.add_argument(
        "--audio",
        type=str,
        default=str(Path(__file__).parent / "dataset" / "buffet2.mp3"),
        help="Path to audio file to transcribe (default: dataset/buffet2.mp3)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=str(Path(__file__).parent / "result4.json"),
        help="Path to output JSON file (default: result4.json)",
    )
    args = parser.parse_args()

    # 1. Device and dtype detection
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32

    model_id = "openai/whisper-large-v3"
    print(f"Using device: {device} ({torch_dtype})", flush=True)
    print(f"Model cache target: {cache_dir}", flush=True)

    # 2. Load model and processor
    print(f"Loading {model_id}...", flush=True)
    model = AutoModelForSpeechSeq2Seq.from_pretrained(
        model_id,
        dtype=torch_dtype,
        low_cpu_mem_usage=True,
        use_safetensors=True,
        cache_dir=str(cache_dir),
    )
    model.to(device)

    processor = AutoProcessor.from_pretrained(model_id, cache_dir=str(cache_dir))

    # 3. Create pipeline (standard Whisper pipeline matching official snippet)
    pipe = pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        torch_dtype=torch_dtype,
        device=device,
    )

    # 4. Run transcription
    if args.librispeech:
        print("Loading sample from distil-whisper/librispeech_long (split: validation)...", flush=True)
        dataset = load_dataset(
            "distil-whisper/librispeech_long",
            "clean",
            split="validation",
            cache_dir=str(cache_dir),
        )
        sample = dataset[0]["audio"]

        print("Running transcription on librispeech sample...", flush=True)
        result = pipe(sample, generate_kwargs={"task": "transcribe", "max_new_tokens": 256})
        transcription_text = result.get("text", "").strip()

        print("\n--- Transcription Result ---", flush=True)
        print(transcription_text, flush=True)

        result_data = {
            "model": model_id,
            "dataset": "distil-whisper/librispeech_long",
            "sample_index": 0,
            "text": transcription_text,
        }
    else:
        audio_path = Path(args.audio)
        if not audio_path.exists():
            print(f"Audio file not found at: {audio_path}", flush=True)
            return

        print(f"Transcribing {audio_path.name}...", flush=True)
        # Instruct whisper to transcribe with Khmer language code ("km")
        result = pipe(
            str(audio_path),
            generate_kwargs={"task": "transcribe", "language": "km", "max_new_tokens": 256},
        )
        transcription_text = result.get("text", "").strip()

        result_data = {
            "model": model_id,
            "language": "Khmer (km)",
            "audio": str(audio_path),
            "text": transcription_text,
        }

    # 5. Output JSON
    json_output = json.dumps(result_data, ensure_ascii=False, indent=2)
    print("\n--- JSON Result ---", flush=True)
    print(json_output, flush=True)

    output_file = Path(args.output)
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(json_output)
    print(f"\nSaved result to {output_file.name}", flush=True)


if __name__ == "__main__":
    main()
