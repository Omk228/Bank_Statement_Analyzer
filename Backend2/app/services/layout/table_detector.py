from typing import List, Dict, Optional
from ...models.document import PageExtractionResult
from ...models.transaction import TableHeaderCandidate, ColumnRange
from .column_detector import ColumnDetector


class TableDetector:
    @classmethod
    def detect_document_tables(cls, pages: List[PageExtractionResult]) -> Dict[int, TableHeaderCandidate]:
        """
        Detects table headers and column geometry for each page using Global Dominant Schema resolution:
        1. Identifies the strongest, most complete table schema across the entire document.
        2. Propagates dominant column boundaries to pages with noisy, partial, or missing headers.
        3. Supports page-specific schema overrides when justified by strong spatial evidence.
        """
        raw_candidates: Dict[int, Optional[TableHeaderCandidate]] = {}
        for page in pages:
            cand = ColumnDetector.detect_table_headers(page.tokens, page_number=page.page_number)
            raw_candidates[page.page_number] = cand

        # 1. Identify Dominant Document Schema
        dominant_schema: Optional[TableHeaderCandidate] = None
        best_score = -1.0

        for p_num, cand in raw_candidates.items():
            if cand and cand.columns:
                col_names = {c.name for c in cand.columns}
                score = len(cand.columns) * 10.0
                if 'DEBIT' in col_names and 'CREDIT' in col_names:
                    score += 25.0
                if 'BALANCE' in col_names:
                    score += 15.0
                if 'DATE' in col_names:
                    score += 10.0

                if score > best_score:
                    best_score = score
                    dominant_schema = cand

        table_schemas: Dict[int, TableHeaderCandidate] = {}
        last_known_schema = dominant_schema

        # 2. Reconcile each page
        for page in pages:
            p_num = page.page_number
            cand = raw_candidates.get(p_num)
            # Check if page is an explicit summary, notice, terms, or advertisement page without a transaction table header
            text_lower = page.raw_text.lower()
            is_non_table_page = any(k in text_lower for k in [
                "important information", "account summary", "end of statement", 
                "terms and conditions", "statutory notice", "step into the", "commonly used narrations"
            ]) and (not cand or not any(c.name == 'DATE' for c in cand.columns))

            if is_non_table_page:
                # Do not assign table schema to non-table notice/summary pages
                continue

            if cand and cand.columns:
                cand_col_names = {c.name for c in cand.columns}
                dominant_col_names = {c.name for c in dominant_schema.columns} if dominant_schema else set()

                # If candidate is complete (has all dominant financial columns) or dominant is none:
                if (not dominant_schema) or (len(cand.columns) >= len(dominant_schema.columns)) or (cand_col_names == dominant_col_names):
                    table_schemas[p_num] = cand
                    last_known_schema = cand
                else:
                    # Candidate has partial / noisy headers (e.g. missed Credit or Balance)
                    # Reconcile using dominant schema's column positions but page's y-header position
                    reconciled = TableHeaderCandidate(
                        page_number=p_num,
                        y0=cand.y0,
                        y1=cand.y1,
                        columns=dominant_schema.columns,
                        raw_text=cand.raw_text or dominant_schema.raw_text,
                        confidence=max(cand.confidence, dominant_schema.confidence * 0.9),
                    )
                    table_schemas[p_num] = reconciled
                    last_known_schema = reconciled

            elif last_known_schema:
                # Inherit schema for continued table across pages starting from top of page
                inherited = TableHeaderCandidate(
                    page_number=p_num,
                    y0=40.0,
                    y1=60.0,
                    columns=last_known_schema.columns,
                    raw_text=last_known_schema.raw_text,
                    confidence=last_known_schema.confidence * 0.9,
                )
                table_schemas[p_num] = inherited

        return table_schemas

