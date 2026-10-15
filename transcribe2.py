import json
import sys
from pathlib import Path
import torch
from transformers import pipeline

# Ensure terminal stdout handles UTF-8 for Khmer characters on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# Detect device
device = "cuda:0" if torch.cuda.is_available() else "cpu"
torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32

print(f"Loading model on {device}...")

# Initialize Whisper Khmer pipeline
asr = pipeline(
    "automatic-speech-recognition",
    model="sengtha/whisper-base-khmer",
    chunk_length_s=30,
    device=device,
    dtype=torch_dtype,
    generate_kwargs={"language": "km", "task": "transcribe"},
)

# Audio file path
audio_path = Path(__file__).parent / "dataset" / "buffet2.mp3"

print(f"Transcribing {audio_path.name}...")
output = asr(str(audio_path))

# Prepare JSON result
result_data = {
    "model": "sengtha/whisper-base-khmer",
    "audio": str(audio_path),
    "text": output.get("text", "").strip(),
}

# Serialize to JSON (ensure_ascii=False preserves Khmer Unicode characters)
json_output = json.dumps(result_data, ensure_ascii=False, indent=2)

# 1. Print JSON to console
print(json_output)

# 2. Save JSON to a file (result2.json)
output_file = Path(__file__).parent / "result2.json"
with open(output_file, "w", encoding="utf-8") as f:
    f.write(json_output)
print(f"Saved result to {output_file.name}")
