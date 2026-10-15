import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Transcribe Khmer audio with Qwen3-ASR.")
    parser.add_argument("audio", type=Path, help="Path to the audio file to transcribe")
    args = parser.parse_args()

    if not args.audio.is_file():
        parser.error(f"audio file does not exist: {args.audio}")

    import torch
    from qwen_asr import Qwen3ASRModel

    has_cuda = torch.cuda.is_available()
    if not has_cuda:
        print("CUDA is unavailable; using CPU. Inference will be slower.")

    model = Qwen3ASRModel.from_pretrained(
        "seanghay/Qwen3-ASR-0.6B-Khmer",
        dtype=torch.bfloat16 if has_cuda else torch.float32,
        device_map="cuda:0" if has_cuda else "cpu",
        max_inference_batch_size=32,
        max_new_tokens=256,
    )

    results = model.transcribe(audio=str(args.audio))
    print(results[0].text)


if __name__ == "__main__":
    main()
