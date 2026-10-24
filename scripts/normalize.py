"""
scripts/normalize.py
Khmer Text Normalizer for ASR Character Error Rate (CER) Evaluation.
"""

import re
import unicodedata


def normalize_khmer(text: str) -> str:
    """
    Standardize Khmer transcriptions for deterministic evaluation:
    1. Null/type safety.
    2. Unicode normalization (NFC) to compose combining characters/diacritics consistently.
    3. Removal of Zero-Width Space (\\u200B), Zero-Width Non-Joiner (\\u200C),
       and Zero-Width Joiner (\\u200D).
    4. Collapsing consecutive whitespaces and trimming margins.
    """
    if text is None:
        return ""

    if not isinstance(text, str):
        text = str(text)

    # 1. Canonical Unicode normalization (NFC)
    text = unicodedata.normalize("NFC", text)

    # 2. Strip zero-width characters (ZWSP, ZWNJ, ZWJ, BOM)
    text = re.sub(r"[\u200B\u200C\u200D\uFEFF]", "", text)

    # 3. Collapse multiple spaces and replace non-breaking spaces
    text = text.replace("\u00A0", " ")
    text = re.sub(r"\s+", " ", text)

    # 4. Trim leading and trailing whitespace
    return text.strip()


if __name__ == "__main__":
    # Quick self-test demonstration
    test_str = "សួស្តី​\u200bពិភពលោក   "
    normalized = normalize_khmer(test_str)
    print(f"Raw:        {repr(test_str)}")
    print(f"Normalized: {repr(normalized)}")
