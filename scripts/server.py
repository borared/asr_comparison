import os
import sys
import json
import time
import shutil
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# Setup paths
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / "scripts"))

from scripts.normalize import normalize_khmer
from scripts.run_inference import MODEL_REGISTRY, ModelRunner

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("asr_server")

app = FastAPI(title="Khmer ASR Benchmark API", version="1.0.0")

# Enable CORS for Vite dev server & production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = BASE_DIR / "temp_uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
RAW_AUDIO_DIR = BASE_DIR / "data" / "raw_audio"
GROUND_TRUTH_FILE = BASE_DIR / "data" / "ground_truth.jsonl"
METRICS_SUMMARY_FILE = BASE_DIR / "results" / "metrics_summary.csv"
ERROR_ANALYSIS_DIR = BASE_DIR / "results" / "error_analysis"

# Cache loaded ModelRunners in memory for rapid repeated testing
MODEL_CACHE: Dict[str, ModelRunner] = {}


def get_or_load_runner(model_name: str) -> ModelRunner:
    """Retrieves or instantiates a ModelRunner for the given model key."""
    if model_name not in MODEL_REGISTRY:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model: '{model_name}'. Available: {list(MODEL_REGISTRY.keys())}",
        )
    meta = MODEL_REGISTRY[model_name]
    canonical = meta["canonical"]

    if canonical not in MODEL_CACHE:
        logger.info(f"Loading model runner for: {canonical}...")
        runner = ModelRunner(canonical)
        MODEL_CACHE[canonical] = runner
    return MODEL_CACHE[canonical]


def compute_character_diff(norm_ref: str, norm_hyp: str):
    """
    Computes Levenshtein edit distance and generates visual alignment tokens.
    Returns: substitutions, insertions, deletions, sample_cer_pct, diff_tokens.
    """
    import jiwer

    if not norm_ref and not norm_hyp:
        return 0, 0, 0, 0.0, []

    alignment = jiwer.process_characters(norm_ref, norm_hyp)
    s = alignment.substitutions
    d = alignment.deletions
    i = alignment.insertions
    ref_len = len(norm_ref)

    if ref_len > 0:
        cer_pct = round(((s + d + i) / ref_len) * 100.0, 2)
    else:
        cer_pct = 0.0 if len(norm_hyp) == 0 else 100.0

    # Build sequence alignment for visual highlight
    diff_tokens = []
    # Using python difflib for character-level visual display tags
    import difflib
    matcher = difflib.SequenceMatcher(None, norm_ref, norm_hyp)
    for tag, alo, ahi, blo, bhi in matcher.get_opcodes():
        diff_tokens.append({
            "tag": tag,  # 'equal', 'replace', 'delete', 'insert'
            "ref_text": norm_ref[alo:ahi],
            "hyp_text": norm_hyp[blo:bhi],
        })

    return s, i, d, cer_pct, diff_tokens


@app.get("/api/health")
def health():
    return {
        "status": "online",
        "loaded_models": list(MODEL_CACHE.keys()),
        "base_dir": str(BASE_DIR),
    }


@app.get("/api/models")
def get_models():
    """Returns available ASR models with metadata, architecture, and current benchmark ranking."""
    models_info = [
        {
            "id": "meta_mms_1b",
            "name": "Meta MMS-1B",
            "full_name": "facebook/mms-1b-all",
            "architecture": "Wav2Vec2 + Khmer Adapter (khm)",
            "type": "Open-Source (Local)",
            "parameters": "1.0B",
            "cer_pct": 54.31,
            "latency_avg": 5.51,
            "badge": "Top Open-Source",
            "fine_tunable": True,
            "recommended": True,
        },
        {
            "id": "sengtha_whisper_base_khmer",
            "name": "Sengtha Whisper Base",
            "full_name": "sengtha/whisper-base-khmer",
            "architecture": "Whisper-Base Seq2Seq",
            "type": "Open-Source (Local)",
            "parameters": "74M",
            "cer_pct": 56.26,
            "latency_avg": 14.52,
            "badge": "Lightweight & Fast",
            "fine_tunable": True,
            "recommended": False,
        },
        {
            "id": "seanghay_qwen3_asr_0_6b",
            "name": "Seanghay Qwen3-ASR 0.6B",
            "full_name": "seanghay/Qwen3-ASR-0.6B-Khmer",
            "architecture": "Qwen3 Audio LLM Thinker",
            "type": "Open-Source (Local)",
            "parameters": "600M",
            "cer_pct": 59.39,
            "latency_avg": 17.77,
            "badge": "Modern Speech-LLM",
            "fine_tunable": True,
            "recommended": False,
        },
        {
            "id": "google_chirp",
            "name": "Google Speech / Chirp",
            "full_name": "Google Cloud Speech-to-Text (km-KH)",
            "architecture": "Conformer / Chirp-2",
            "type": "Cloud API (Hosted)",
            "parameters": "Proprietary",
            "cer_pct": 44.08,
            "latency_avg": 5.47,
            "badge": "Lowest CER",
            "fine_tunable": False,
            "recommended": False,
        },
        {
            "id": "openai_whisper_large_v3",
            "name": "OpenAI Whisper Large v3",
            "full_name": "openai/whisper-large-v3",
            "architecture": "Whisper-Large Seq2Seq",
            "type": "Open-Source (Local)",
            "parameters": "1.55B",
            "cer_pct": 94.08,
            "latency_avg": 93.06,
            "badge": "Generic Multilingual",
            "fine_tunable": True,
            "recommended": False,
        },
    ]
    return {"models": models_info}


def get_next_sample_id() -> str:
    """Determines the next sequential sample ID based on ground_truth.jsonl and data/raw_audio/."""
    import re
    ids = []
    if GROUND_TRUTH_FILE.exists():
        with open(GROUND_TRUTH_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        data = json.loads(line)
                        ids.append(data.get("id", ""))
                    except Exception:
                        pass

    if RAW_AUDIO_DIR.exists():
        for p in RAW_AUDIO_DIR.glob("km_eval_*.*"):
            ids.append(p.stem)

    max_num = 0
    for sid in ids:
        match = re.search(r"km_eval_(\d+)", sid)
        if match:
            num = int(match.group(1))
            if num > max_num:
                max_num = num

    return f"km_eval_{max_num + 1:04d}"


def recalculate_metrics_summary():
    """Recalculates metrics_summary.csv based on current error_analysis/*.csv files."""
    import pandas as pd
    if not ERROR_ANALYSIS_DIR.exists():
        return

    summary_rows = []
    for csv_file in sorted(ERROR_ANALYSIS_DIR.glob("*_cer_breakdown.csv")):
        model_key = csv_file.name.replace("_cer_breakdown.csv", "")
        try:
            df = pd.read_csv(csv_file).fillna("")
            if len(df) == 0:
                continue
            total_samples = len(df)
            total_duration = round(pd.to_numeric(df["duration_sec"], errors="coerce").fillna(0).sum(), 2)
            total_s = pd.to_numeric(df["substitutions"], errors="coerce").fillna(0).sum()
            total_i = pd.to_numeric(df["insertions"], errors="coerce").fillna(0).sum()
            total_d = pd.to_numeric(df["deletions"], errors="coerce").fillna(0).sum()
            total_ref = pd.to_numeric(df["ref_len"], errors="coerce").fillna(0).sum()

            if total_ref > 0:
                cer_pct = round(((total_s + total_d + total_i) / total_ref) * 100.0, 2)
            else:
                cer_pct = 0.0

            latencies = pd.to_numeric(df["latency_sec"], errors="coerce").dropna()
            avg_latency = round(latencies.mean(), 3) if len(latencies) > 0 else 0.0

            summary_rows.append({
                "model_name": model_key,
                "total_samples": total_samples,
                "total_duration_sec": total_duration,
                "CER (%)": cer_pct,
                "avg_latency_sec": avg_latency,
            })
        except Exception as e:
            logger.warning(f"Error recalculating summary for {csv_file}: {e}")

    if summary_rows:
        df_summary = pd.DataFrame(summary_rows)
        df_summary = df_summary.sort_values(by="CER (%)", ascending=True)
        df_summary.to_csv(METRICS_SUMMARY_FILE, index=False)
        logger.info(f"Updated {METRICS_SUMMARY_FILE.name} with {len(summary_rows)} models.")


@app.get("/api/dataset/next-id")
def get_next_id():
    """Returns the next auto-indexed sample ID and current total count."""
    next_id = get_next_sample_id()
    count = 0
    if GROUND_TRUTH_FILE.exists():
        with open(GROUND_TRUTH_FILE, "r", encoding="utf-8") as f:
            count = sum(1 for line in f if line.strip())
    return {"next_id": next_id, "current_count": count}


@app.get("/api/dataset")
def get_dataset_samples():
    """Returns all evaluation samples from ground_truth.jsonl."""
    if not GROUND_TRUTH_FILE.exists():
        return {"samples": []}

    samples = []
    with open(GROUND_TRUTH_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                item = json.loads(line)
                samples.append({
                    "id": item["id"],
                    "audio_filename": Path(item["audio_path"]).name,
                    "audio_url": f"/api/audio/{Path(item['audio_path']).name}",
                    "duration_sec": item.get("duration", 0.0),
                    "reference": item.get("reference", ""),
                })
    return {"samples": samples}


@app.get("/api/audio/{filename}")
def serve_audio(filename: str):
    """Serves audio from data/raw_audio/ or temp_uploads/."""
    # Check temp uploads first
    temp_path = UPLOAD_DIR / filename
    if temp_path.exists():
        media_type = "audio/wav" if filename.endswith(".wav") else "audio/mpeg"
        return FileResponse(temp_path, media_type=media_type)

    # Check raw_audio
    raw_path = RAW_AUDIO_DIR / filename
    if raw_path.exists():
        media_type = "audio/wav" if filename.endswith(".wav") else "audio/mpeg"
        return FileResponse(raw_path, media_type=media_type)

    raise HTTPException(status_code=404, detail="Audio file not found.")


@app.get("/api/metrics")
def get_metrics_summary():
    """Returns metrics_summary.csv and error analysis data."""
    import pandas as pd
    if not METRICS_SUMMARY_FILE.exists():
        return {"summary": [], "breakdown": {}}
    
    df_summary = pd.read_csv(METRICS_SUMMARY_FILE).fillna("")
    summary_data = df_summary.to_dict(orient="records")

    breakdowns = {}
    if ERROR_ANALYSIS_DIR.exists():
        for f in ERROR_ANALYSIS_DIR.glob("*_cer_breakdown.csv"):
            model_key = f.name.replace("_cer_breakdown.csv", "")
            try:
                df_b = pd.read_csv(f).fillna("")
                breakdowns[model_key] = df_b.to_dict(orient="records")
            except Exception as e:
                logger.warning(f"Error reading {f.name}: {e}")

    return {"summary": summary_data, "breakdowns": breakdowns}


@app.post("/api/predict")
async def predict_audio(
    model_name: str = Form("meta_mms_1b"),
    expected_output: Optional[str] = Form(""),
    sample_id: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    """
    Transcribes audio using the selected model, computes CER if expected_output is provided,
    and returns full comparison payload.
    """
    audio_path = None
    audio_filename = ""
    audio_url = ""
    duration_sec = 0.0

    # 1. Determine audio source
    if file and file.filename:
        # User uploaded a file
        filename = f"upload_{int(time.time() * 1000)}_{file.filename}"
        audio_path = UPLOAD_DIR / filename
        with open(audio_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        audio_filename = file.filename
        audio_url = f"/api/audio/{filename}"
        try:
            import librosa
            duration_sec = round(float(librosa.get_duration(path=str(audio_path))), 2)
        except Exception:
            duration_sec = 0.0

    elif sample_id:
        # Preloaded sample selected
        found = False
        if GROUND_TRUTH_FILE.exists():
            with open(GROUND_TRUTH_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        item = json.loads(line)
                        if item["id"] == sample_id:
                            rel_path = Path(item["audio_path"])
                            audio_path = BASE_DIR / rel_path
                            audio_filename = audio_path.name
                            audio_url = f"/api/audio/{audio_path.name}"
                            duration_sec = item.get("duration", 0.0)
                            if not expected_output:
                                expected_output = item.get("reference", "")
                            found = True
                            break
        if not found or not audio_path or not audio_path.exists():
            raise HTTPException(status_code=404, detail=f"Dataset sample '{sample_id}' not found.")

    else:
        raise HTTPException(status_code=400, detail="Must provide an uploaded audio file or sample_id.")

    # 2. Run inference via ModelRunner
    runner = get_or_load_runner(model_name)
    try:
        raw_hypothesis, latency_sec = runner.transcribe(audio_path)
    except Exception as e:
        logger.error(f"Inference error with model {model_name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")

    # 3. Normalization
    norm_hyp = normalize_khmer(raw_hypothesis)
    raw_ref = (expected_output or "").strip()
    norm_ref = normalize_khmer(raw_ref)

    # 4. CER & Diff evaluation
    substitutions, insertions, deletions, sample_cer_pct, diff_tokens = 0, 0, 0, None, []
    if norm_ref:
        substitutions, insertions, deletions, sample_cer_pct, diff_tokens = compute_character_diff(
            norm_ref, norm_hyp
        )

    # 5. Build response payload
    item_id = f"pred_{int(time.time() * 1000)}"
    return {
        "id": item_id,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "model_id": model_name,
        "model_name": MODEL_REGISTRY.get(model_name, {}).get("description", model_name),
        "audio_filename": audio_filename,
        "audio_url": audio_url,
        "duration_sec": duration_sec,
        "latency_sec": round(latency_sec, 3),
        "reference_raw": raw_ref,
        "reference_norm": norm_ref,
        "hypothesis_raw": raw_hypothesis,
        "hypothesis_norm": norm_hyp,
        "ref_len": len(norm_ref),
        "hyp_len": len(norm_hyp),
        "substitutions": substitutions,
        "insertions": insertions,
        "deletions": deletions,
        "sample_cer_pct": sample_cer_pct,
        "diff_tokens": diff_tokens,
    }


@app.post("/api/dataset/create-sample")
async def create_dataset_sample(
    model_name: str = Form("meta_mms_1b"),
    expected_output: str = Form(""),
    file: UploadFile = File(...),
):
    """
    Saves new audio directly into data/raw_audio/ with auto-incremented index (km_eval_XXXX),
    appends ground truth to data/ground_truth.jsonl, runs inference, appends to the model's
    error breakdown CSV, updates hypotheses/*.jsonl, and recalculates metrics_summary.csv.
    """
    import io
    import librosa
    import pandas as pd

    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Audio file is required.")

    next_id = get_next_sample_id()
    ext = ".mp3" if file.filename.lower().endswith(".mp3") else ".wav"
    target_filename = f"{next_id}{ext}"
    target_audio_path = RAW_AUDIO_DIR / target_filename

    # 1. Save audio to data/raw_audio/
    content = await file.read()
    with open(target_audio_path, "wb") as f:
        f.write(content)

    duration_sec = 0.0
    try:
        y, sr = librosa.load(io.BytesIO(content), sr=None)
        duration_sec = round(float(len(y)) / float(sr), 2)
    except Exception as e:
        logger.warning(f"Could not compute audio duration: {e}")

    raw_ref = (expected_output or "").strip()
    norm_ref = normalize_khmer(raw_ref)

    # 2. Append to data/ground_truth.jsonl
    gt_entry = {
        "id": next_id,
        "audio_path": f"data/raw_audio/{target_filename}",
        "duration": duration_sec,
        "reference": raw_ref,
    }
    with open(GROUND_TRUTH_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(gt_entry, ensure_ascii=False) + "\n")

    # 3. Run inference on selected model
    runner = get_or_load_runner(model_name)
    try:
        raw_hyp, latency_sec = runner.transcribe(str(target_audio_path))
    except Exception as e:
        logger.error(f"Inference error on created sample: {e}", exc_info=True)
        raw_hyp = ""
        latency_sec = 0.0

    norm_hyp = normalize_khmer(raw_hyp)

    # Compute CER & diff
    s, i, d, sample_cer_pct, diff_tokens = compute_character_diff(norm_ref, norm_hyp)

    # 4. Append to results/error_analysis/{model_name}_cer_breakdown.csv
    breakdown_file = ERROR_ANALYSIS_DIR / f"{model_name}_cer_breakdown.csv"
    new_row = {
        "id": next_id,
        "audio_path": f"data/raw_audio/{target_filename}",
        "duration_sec": duration_sec,
        "reference_raw": raw_ref,
        "reference_norm": norm_ref,
        "hypothesis_raw": raw_hyp,
        "hypothesis_norm": norm_hyp,
        "ref_len": len(norm_ref),
        "hyp_len": len(norm_hyp),
        "substitutions": s,
        "insertions": i,
        "deletions": d,
        "sample_cer_pct": sample_cer_pct,
        "latency_sec": round(latency_sec, 3),
    }

    if breakdown_file.exists():
        df_b = pd.read_csv(breakdown_file).fillna("")
        df_b = pd.concat([df_b, pd.DataFrame([new_row])], ignore_index=True)
    else:
        df_b = pd.DataFrame([new_row])
    df_b.to_csv(breakdown_file, index=False)

    # 5. Append to hypotheses/{model_name}.jsonl
    hyp_file = BASE_DIR / "hypotheses" / f"{model_name}.jsonl"
    if hyp_file.exists():
        with open(hyp_file, "a", encoding="utf-8") as f:
            f.write(
                json.dumps(
                    {"id": next_id, "hypothesis": raw_hyp, "latency_sec": round(latency_sec, 3)},
                    ensure_ascii=False,
                )
                + "\n"
            )

    # 6. Recalculate summary metrics across all models
    recalculate_metrics_summary()

    # 7. Return payload
    return {
        "id": next_id,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "model_id": model_name,
        "model_name": MODEL_REGISTRY.get(model_name, {}).get("description", model_name),
        "audio_filename": target_filename,
        "audio_url": f"/api/audio/{target_filename}",
        "duration_sec": duration_sec,
        "latency_sec": round(latency_sec, 3),
        "reference_raw": raw_ref,
        "reference_norm": norm_ref,
        "hypothesis_raw": raw_hyp,
        "hypothesis_norm": norm_hyp,
        "ref_len": len(norm_ref),
        "hyp_len": len(norm_hyp),
        "substitutions": s,
        "insertions": i,
        "deletions": d,
        "sample_cer_pct": sample_cer_pct,
        "diff_tokens": diff_tokens,
        "is_benchmark_sample": True,
    }


@app.delete("/api/dataset/delete-sample/{sample_id}")
def delete_dataset_sample(sample_id: str):
    """
    Deletes a sample across ground_truth.jsonl, data/raw_audio/, all error breakdown CSVs,
    and hypotheses JSONLs, then recalculates metrics_summary.csv.
    """
    import pandas as pd
    logger.info(f"Deleting sample {sample_id}...")

    # 1. Remove from ground_truth.jsonl
    if GROUND_TRUTH_FILE.exists():
        lines = []
        with open(GROUND_TRUTH_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line_str = line.strip()
                if line_str:
                    try:
                        entry = json.loads(line_str)
                        if entry.get("id") != sample_id:
                            lines.append(line_str)
                    except Exception:
                        lines.append(line_str)
        with open(GROUND_TRUTH_FILE, "w", encoding="utf-8") as f:
            for l in lines:
                f.write(l + "\n")

    # 2. Remove audio file from data/raw_audio/
    for audio_file in RAW_AUDIO_DIR.glob(f"{sample_id}.*"):
        try:
            audio_file.unlink()
            logger.info(f"Removed audio file {audio_file.name}")
        except Exception as e:
            logger.warning(f"Could not delete {audio_file}: {e}")

    # 3. Remove row from all results/error_analysis/*_cer_breakdown.csv
    if ERROR_ANALYSIS_DIR.exists():
        for csv_file in ERROR_ANALYSIS_DIR.glob("*_cer_breakdown.csv"):
            try:
                df = pd.read_csv(csv_file).fillna("")
                if "id" in df.columns:
                    df = df[df["id"] != sample_id]
                    df.to_csv(csv_file, index=False)
            except Exception as e:
                logger.warning(f"Error removing {sample_id} from {csv_file.name}: {e}")

    # 4. Remove row from hypotheses/*.jsonl
    hyp_dir = BASE_DIR / "hypotheses"
    if hyp_dir.exists():
        for hyp_file in hyp_dir.glob("*.jsonl"):
            try:
                hlines = []
                with open(hyp_file, "r", encoding="utf-8") as f:
                    for hline in f:
                        hline_str = hline.strip()
                        if hline_str:
                            try:
                                hentry = json.loads(hline_str)
                                if hentry.get("id") != sample_id:
                                    hlines.append(hline_str)
                            except Exception:
                                hlines.append(hline_str)
                with open(hyp_file, "w", encoding="utf-8") as f:
                    for hl in hlines:
                        f.write(hl + "\n")
            except Exception as e:
                logger.warning(f"Error removing {sample_id} from {hyp_file.name}: {e}")

    # 5. Recalculate summary metrics
    recalculate_metrics_summary()

    # 6. Count remaining samples
    remaining_count = 0
    if GROUND_TRUTH_FILE.exists():
        with open(GROUND_TRUTH_FILE, "r", encoding="utf-8") as f:
            remaining_count = sum(1 for line in f if line.strip())

    return {"deleted_id": sample_id, "remaining_count": remaining_count}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
