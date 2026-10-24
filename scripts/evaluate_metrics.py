"""
scripts/evaluate_metrics.py
Standalone evaluation pipeline comparing multiple ASR hypotheses against Ground Truth.
Computes Character Error Rate (CER %) exclusively.
"""

import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Ensure terminal stdout handles UTF-8 for Khmer characters on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

import jiwer
import pandas as pd
from normalize import normalize_khmer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("ASR_Evaluation")

# Project directories
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
HYPOTHESES_DIR = BASE_DIR / "hypotheses"
RESULTS_DIR = BASE_DIR / "results"
ERROR_ANALYSIS_DIR = RESULTS_DIR / "error_analysis"
GROUND_TRUTH_FILE = DATA_DIR / "ground_truth.jsonl"
SUMMARY_OUTPUT_FILE = RESULTS_DIR / "metrics_summary.csv"


def load_ground_truth(file_path: Path) -> Dict[str, Dict[str, Any]]:
    """Loads ground_truth.jsonl into a dictionary keyed by sample ID."""
    if not file_path.exists():
        raise FileNotFoundError(f"Ground truth file not found at: {file_path}")

    records = {}
    with open(file_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                sample_id = str(data["id"])
                records[sample_id] = {
                    "id": sample_id,
                    "audio_path": data.get("audio_path", ""),
                    "duration": float(data.get("duration", 0.0)),
                    "reference": data.get("reference", ""),
                }
            except (json.JSONDecodeError, KeyError) as e:
                logger.warning(f"Skipping malformed line {line_num} in {file_path}: {e}")

    logger.info(f"Loaded {len(records)} ground truth references from {file_path.name}")
    return records


def load_hypotheses(file_path: Path) -> Dict[str, Dict[str, Any]]:
    """Loads a model's hypothesis JSONL file into a dictionary keyed by sample ID."""
    predictions = {}
    with open(file_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                sample_id = str(data["id"])
                predictions[sample_id] = {
                    "hypothesis": data.get("hypothesis", ""),
                    "latency_sec": float(data.get("latency_sec", 0.0)),
                }
            except (json.JSONDecodeError, KeyError) as e:
                logger.warning(f"Skipping malformed line {line_num} in {file_path}: {e}")

    return predictions


def evaluate_model(
    model_name: str,
    hypotheses: Dict[str, Dict[str, Any]],
    ground_truth: Dict[str, Dict[str, Any]],
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Evaluates model predictions against ground truth references:
    - Normalizes both references and hypotheses with normalize_khmer.
    - Computes micro-averaged CER (%) at corpus level.
    - Tracks sample-level character insertions, deletions, substitutions, and CER.
    """
    sample_breakdown: List[Dict[str, Any]] = []

    total_substitutions = 0
    total_deletions = 0
    total_insertions = 0
    total_ref_chars = 0

    evaluated_samples = 0
    total_duration_sec = 0.0
    latencies: List[float] = []

    for sample_id, gt_entry in ground_truth.items():
        if sample_id not in hypotheses:
            logger.warning(
                f"[{model_name}] Missing hypothesis for ID '{sample_id}'. Counted as 100% deletion."
            )
            raw_hyp = ""
            latency = 0.0
        else:
            hyp_entry = hypotheses[sample_id]
            raw_hyp = hyp_entry["hypothesis"]
            latency = hyp_entry["latency_sec"]
            latencies.append(latency)

        raw_ref = gt_entry["reference"]
        norm_ref = normalize_khmer(raw_ref)
        norm_hyp = normalize_khmer(raw_hyp)

        # Character alignment and edit distance via jiwer
        alignment = jiwer.process_characters(norm_ref, norm_hyp)

        s = alignment.substitutions
        d = alignment.deletions
        i = alignment.insertions
        ref_len = len(norm_ref)

        total_substitutions += s
        total_deletions += d
        total_insertions += i
        total_ref_chars += ref_len

        # Sample-level CER calculation
        if ref_len > 0:
            sample_cer = ((s + d + i) / ref_len) * 100.0
        else:
            sample_cer = 0.0 if len(norm_hyp) == 0 else 100.0

        evaluated_samples += 1
        total_duration_sec += gt_entry["duration"]

        sample_breakdown.append(
            {
                "id": sample_id,
                "audio_path": gt_entry["audio_path"],
                "duration_sec": gt_entry["duration"],
                "reference_raw": raw_ref,
                "reference_norm": norm_ref,
                "hypothesis_raw": raw_hyp,
                "hypothesis_norm": norm_hyp,
                "ref_len": ref_len,
                "hyp_len": len(norm_hyp),
                "substitutions": s,
                "insertions": i,
                "deletions": d,
                "sample_cer_pct": round(sample_cer, 2),
                "latency_sec": round(latency, 3),
            }
        )

    # Standard ASR Corpus CER: Sum(S + D + I) / Sum(N_ref) * 100
    if total_ref_chars > 0:
        corpus_cer = ((total_substitutions + total_deletions + total_insertions) / total_ref_chars) * 100.0
    else:
        corpus_cer = 0.0

    avg_latency = (sum(latencies) / len(latencies)) if latencies else 0.0

    summary_metric = {
        "model_name": model_name,
        "total_samples": evaluated_samples,
        "total_duration_sec": round(total_duration_sec, 2),
        "CER (%)": round(corpus_cer, 2),
        "avg_latency_sec": round(avg_latency, 3),
    }

    return summary_metric, sample_breakdown


def main():
    logger.info("Initializing Khmer ASR Evaluation Benchmark Pipeline...")

    # Ensure output directories exist
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    ERROR_ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Load ground truth
    ground_truth = load_ground_truth(GROUND_TRUTH_FILE)
    if not ground_truth:
        logger.error("Ground truth dataset is empty. Aborting.")
        return

    # 2. Find all model prediction files
    hypothesis_files = list(HYPOTHESES_DIR.glob("*.jsonl"))
    if not hypothesis_files:
        logger.warning(
            f"No hypothesis files found in {HYPOTHESES_DIR}. Place {{model_name}}.jsonl files there."
        )
        return

    logger.info(f"Found {len(hypothesis_files)} model hypothesis files for evaluation.")

    summary_list = []

    # 3. Process each model
    for hyp_file in sorted(hypothesis_files):
        model_name = hyp_file.stem
        logger.info(f"Evaluating model: '{model_name}'...")

        hypotheses = load_hypotheses(hyp_file)
        summary, breakdown = evaluate_model(model_name, hypotheses, ground_truth)

        summary_list.append(summary)

        # Export sample-level breakdown CSV
        breakdown_file = ERROR_ANALYSIS_DIR / f"{model_name}_cer_breakdown.csv"
        df_breakdown = pd.DataFrame(breakdown)
        df_breakdown.to_csv(breakdown_file, index=False, encoding="utf-8-sig")
        logger.info(f"Sample breakdown saved to: {breakdown_file.relative_to(BASE_DIR)}")

    # 4. Export consolidated metrics summary
    df_summary = pd.DataFrame(summary_list)
    # Sort best-performing model (lowest CER %) to the top
    df_summary = df_summary.sort_values(by="CER (%)", ascending=True)
    df_summary.to_csv(SUMMARY_OUTPUT_FILE, index=False, encoding="utf-8-sig")

    logger.info(f"\n{'='*55}\nBENCHMARK RESULTS SUMMARY\n{'='*55}")
    print(df_summary.to_string(index=False))
    logger.info(f"\nFinal summary successfully exported to: {SUMMARY_OUTPUT_FILE.relative_to(BASE_DIR)}")


if __name__ == "__main__":
    main()
