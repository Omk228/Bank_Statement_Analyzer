import re
from typing import List, Dict, Any
from ...models.document import SpatialToken


class OCRQualityGate:
    BANK_KEYWORDS = {
        'statement', 'account', 'balance', 'transaction', 'debit', 'credit',
        'withdrawal', 'deposit', 'bank', 'branch', 'ifsc', 'particulars',
        'narration', 'cheque', 'opening', 'closing', 'date', 'amount', 'inr', 'cr', 'dr'
    }

    @classmethod
    def evaluate_tokens_quality(cls, tokens: List[SpatialToken]) -> Dict[str, Any]:
        """
        Calculates quality metrics for extracted tokens:
        - token_count
        - avg_confidence
        - keyword_density
        - spatial_alignment_score
        - passed_gate (True if sufficient to proceed without further OCR passes)
        """
        if not tokens:
            return {
                "token_count": 0,
                "avg_confidence": 0.0,
                "keyword_density": 0.0,
                "spatial_alignment_score": 0.0,
                "passed_gate": False,
            }

        token_count = len(tokens)
        confidences = [t.confidence for t in tokens if t.confidence > 0]
        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0

        # Keyword density check
        found_keywords = 0
        for t in tokens:
            cleaned = re.sub(r'[^a-zA-Z]', '', t.text.lower())
            if cleaned in cls.BANK_KEYWORDS:
                found_keywords += 1

        keyword_density = round(found_keywords / max(1, token_count), 4)

        # Spatial alignment check (variance of line heights and aligned columns)
        y_positions = [t.y0 for t in tokens]
        has_spatial_variance = (max(y_positions) - min(y_positions)) > 50 if y_positions else False

        passed_gate = (
            (token_count >= 15 and avg_conf >= 0.60 and found_keywords >= 2) or
            (token_count >= 30 and avg_conf >= 0.50)
        )

        return {
            "token_count": token_count,
            "avg_confidence": round(avg_conf, 4),
            "keyword_density": keyword_density,
            "keywords_found": found_keywords,
            "has_spatial_spread": has_spatial_variance,
            "passed_gate": passed_gate,
        }
