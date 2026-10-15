import os
import sys
from pathlib import Path
import tempfile

# Force ALL HuggingFace cache and Windows temporary downloads to Drive E (136+ GB free)
cache_dir = Path(__file__).parent / ".cache"
temp_dir = cache_dir / "temp"
cache_dir.mkdir(parents=True, exist_ok=True)
temp_dir.mkdir(parents=True, exist_ok=True)

# Set environment variables BEFORE importing transformers/huggingface
os.environ["HF_HOME"] = str(cache_dir)
os.environ["TEMP"] = str(temp_dir)
os.environ["TMP"] = str(temp_dir)
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
tempfile.tempdir = str(temp_dir)

# Ensure terminal stdout handles UTF-8 for Khmer characters on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

import json
import librosa
import torch
from transformers import AutoProcessor, Wav2Vec2ForCTC

# Detect device & data type
device = "cuda:0" if torch.cuda.is_available() else "cpu"
dtype = torch.float16 if torch.cuda.is_available() else torch.float32
print(f"Using device: {device} ({dtype})")
print(f"Storage target on Drive E: {cache_dir}")

model_id = "facebook/mms-1b-all"
target_lang = "khm"  # ISO 639-3 language code for Khmer

print(f"Loading processor and model ({model_id})...")
processor = AutoProcessor.from_pretrained(model_id, cache_dir=str(cache_dir))
model = Wav2Vec2ForCTC.from_pretrained(
    model_id,
    cache_dir=str(cache_dir),
    dtype=dtype,
).to(device)

print(f"Setting target language and adapter to '{target_lang}' (Khmer)...")
processor.tokenizer.set_target_lang(target_lang)
model.load_adapter(target_lang)

# Audio file path (supports .wav, .mp3, etc.)
audio_path = Path(__file__).parent / "dataset" / "buffet2.mp3"

print(f"Loading and resampling {audio_path.name} to 16,000 Hz...")
audio_array, _ = librosa.load(str(audio_path), sr=16_000)

print("Running transcription...")
inputs = processor(audio_array, sampling_rate=16_000, return_tensors="pt")
inputs = {k: v.to(device=device, dtype=dtype if torch.is_floating_point(v) else None) for k, v in inputs.items()}

with torch.no_grad():
    outputs = model(**inputs).logits

predicted_ids = torch.argmax(outputs, dim=-1)[0]
transcription = processor.decode(predicted_ids)

# Prepare JSON result
result_data = {
    "model": model_id,
    "language": "Khmer (khm)",
    "audio": str(audio_path),
    "text": transcription.strip(),
}

# Serialize to JSON (ensure_ascii=False preserves Khmer Unicode characters)
json_output = json.dumps(result_data, ensure_ascii=False, indent=2)

# 1. Print JSON to console
print(json_output)

# 2. Save JSON to file (result3.json)
output_file = Path(__file__).parent / "result3.json"
with open(output_file, "w", encoding="utf-8") as f:
    f.write(json_output)
print(f"Saved result to {output_file.name}")
