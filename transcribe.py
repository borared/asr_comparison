import json
import sys
from pathlib import Path
import torch
from qwen_asr import Qwen3ASRModel

# Ensure terminal stdout handles UTF-8 for Khmer characters on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# Detect device
device = "cuda:0" if torch.cuda.is_available() else "cpu"
dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32

model = Qwen3ASRModel.from_pretrained(
    "seanghay/Qwen3-ASR-0.6B-Khmer",
    dtype=dtype,
    device_map=device,
    max_inference_batch_size=32,
    max_new_tokens=256,  # increase for long audio to avoid truncation
)

audio_path = Path(__file__).parent / "dataset" / "buffet2.mp3"

results = model.transcribe(
    audio=str(audio_path),  # local path, URL, base64, or (np.ndarray, sr)
)

# Convert transcription result to a dictionary
result_data = {
    "audio": str(audio_path),
    "text": results[0].text,
    "language": results[0].language,
}

# Serialize to JSON (ensure_ascii=False preserves Khmer Unicode characters)
json_output = json.dumps(result_data, ensure_ascii=False, indent=2)

# 1. Print JSON to console
print(json_output)

# 2. Save JSON to a file (result.json)
output_file = Path(__file__).parent / "result.json"
with open(output_file, "w", encoding="utf-8") as f:
    f.write(json_output)
