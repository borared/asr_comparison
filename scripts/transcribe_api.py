"""
scripts/transcribe_api.py
Wrapper entrypoint forwarding directly to scripts/run_inference.py.

Usage is identical:
    python scripts/transcribe_api.py --model meta_mms_1b
    python scripts/transcribe_api.py --model qwen3_khmer
    python scripts/transcribe_api.py --model whisper_base_khmer
    python scripts/transcribe_api.py --model whisper_large_v3
    python scripts/transcribe_api.py --model google_chirp --google-project-id <PROJECT_ID>
    python scripts/transcribe_api.py --model openai_whisper
"""

from run_inference import main

if __name__ == "__main__":
    main()
