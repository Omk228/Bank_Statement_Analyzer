import re
from typing import List, Dict, Optional, Tuple
from ...models.document import SpatialToken
from ...models.transaction import ColumnRange, TableHeaderCandidate


class ColumnDetector:
    COLUMN_ALIASES = {
        'DATE': [
            r'\bdate\b', r'\btran\s*date\b', r'\btrans\s*date\b', r'\btransaction\s*date\b',
            r'\bvalue\s*date\b', r'\bposting\s*date\b', r'\btxn\s*date\b', r'\btxndate\b'
        ],
        'DESCRIPTION': [
            r'\bdescription\b', r'\bparticulars\b', r'\bnarration\b', r'\bnarrations\b',
            r'\btransaction\s*details\b', r'\bremarks\b', r'\bdetails\b', r'\bparticular\b'
        ],
        'REFERENCE': [
            r'\breference\b', r'\bref\s*no\b', r'\bref\b', r'\bcheque\s*no\b', r'\bchq\s*no\b',
            r'\bchq\b', r'\butr\b', r'\btransaction\s*id\b', r'\btxn\s*id\b',
            r'\bchq\s*/\s*ref\s*no\b', r'\bref\s*/\s*chq\s*no\b', r'\bcha\s*/\s*ref\b', r'\bcha/ref\b'
        ],
        'DEBIT': [
            r'\bdebit\b', r'\bdr\b', r'\bwithdrawal\b', r'\bwithdrawals\b',
            r'\bdebit\s*amount\b', r'\bpaid\s*out\b', r'\bdebits\b',
            r'\bwithdrawal\s*\(?dr\.?\)?\b', r'\bdebit\s*\(?dr\.?\)?\b',
            r'\(dr\.?\)', r'\bdr\.', r'\(or\.?\)'
        ],
        'CREDIT': [
            r'\bcredit\b', r'\bcr\b', r'\bdeposit\b', r'\bdeposits\b',
            r'\bcredit\s*amount\b', r'\bpaid\s*in\b', r'\bcredits\b',
            r'\bdeposit\s*\(?cr\.?\)?\b', r'\bcredit\s*\(?cr\.?\)?\b',
            r'\(cr\.?\)', r'\bcr\.'
        ],
        'BALANCE': [
            r'\bbalance\b', r'\brunning\s*balance\b', r'\bavailable\s*balance\b',
            r'\bclosing\s*balance\b', r'\bnet\s*balance\b', r'\bbal\b',
            r'\bbalance\s*\(?inr\)?\b', r'\bbalance\s*\(?rs\)?\b'
        ],
        'AMOUNT': [
            r'\bamount\b', r'\btxn\s*amount\b', r'\btransaction\s*amount\b',
            r'\bamount\s*\(?inr\)?\b', r'\bamount\s*\(?rs\)?\b'
        ],
        'DR_CR': [
            r'\bcr\s*/\s*dr\b', r'\bdr\s*/\s*cr\b', r'\btype\b', r'\bc\s*/\s*d\b', r'\bd\s*/\s*c\b'
        ],
    }

    @classmethod
    def match_column_name(cls, text: str) -> Optional[str]:
        clean = text.lower().strip()
        for col_name, patterns in cls.COLUMN_ALIASES.items():
            for pat in patterns:
                if re.search(pat, clean):
                    return col_name
        return None

    @classmethod
    def detect_table_headers(cls, tokens: List[SpatialToken], page_number: int = 1) -> Optional[TableHeaderCandidate]:
        """
        Finds a horizontal band of tokens representing the table header (Date, Description, Debit, Credit, Balance, etc.).
        Dynamically handles various schema models (5-col, 4-col, 3-col).
        """
        if not tokens:
            return None

        # Group tokens by vertical lines (Y proximity within 8 points)
        line_groups: Dict[int, List[SpatialToken]] = {}
        for t in sorted(tokens, key=lambda x: x.y0):
            matched_bucket = None
            for bucket_y in line_groups:
                if abs(t.y0 - bucket_y) <= 8:
                    matched_bucket = bucket_y
                    break
            if matched_bucket is not None:
                line_groups[matched_bucket].append(t)
            else:
                line_groups[int(t.y0)] = [t]

        best_candidate: Optional[TableHeaderCandidate] = None
        max_score = 0.0

        for bucket_y, line_tokens in line_groups.items():
            line_tokens_sorted = sorted(line_tokens, key=lambda x: x.x0)
            full_line_text = " ".join([t.text for t in line_tokens_sorted])

            detected_cols: List[ColumnRange] = []
            matched_types = set()

            # Merge adjacent words that form multi-word headers
            i = 0
            while i < len(line_tokens_sorted):
                curr = line_tokens_sorted[i]
                curr_col = cls.match_column_name(curr.text)

                curr_x0 = curr.x0
                curr_x1 = curr.x1
                col_name = curr_col

                # Absorb leading punctuation / symbol if it forms a column bigram
                if not col_name and i + 1 < len(line_tokens_sorted):
                    next_t = line_tokens_sorted[i + 1]
                    bigram = f"{curr.text} {next_t.text}".strip()
                    bigram_col = cls.match_column_name(bigram)
                    if bigram_col:
                        col_name = bigram_col
                        curr_x1 = next_t.x1
                        i += 1

                # Continue merging subsequent tokens that belong to the SAME column
                while i + 1 < len(line_tokens_sorted):
                    next_t = line_tokens_sorted[i + 1]
                    next_col = cls.match_column_name(next_t.text)
                    bigram = f"{line_tokens_sorted[i].text} {next_t.text}".strip()
                    bigram_col = cls.match_column_name(bigram)

                    is_suffix = next_t.text.lower() in (
                        'no', 'no.', 'id', 'num', 'number', 'details',
                        'dr', 'cr', 'dr.', 'cr.', '(dr)', '(cr)', '(dr.)', '(cr.)', '(or)', '(or.)'
                    )

                    if col_name and next_col and col_name != next_col:
                        # Conflicting distinct columns (e.g. Deposit followed by Balance) -> Never merge across columns
                        break
                    elif col_name and next_col and col_name == next_col:
                        curr_x1 = next_t.x1
                        i += 1
                    elif col_name and (is_suffix or bigram_col == col_name):
                        curr_x1 = next_t.x1
                        i += 1
                    else:
                        break

                if col_name and col_name not in matched_types:
                    matched_types.add(col_name)
                    detected_cols.append(
                        ColumnRange(
                            name=col_name,
                            x0=curr_x0,
                            x1=curr_x1,
                            confidence=0.95,
                        )
                    )
                i += 1

            # Check if this line qualifies as a table header
            has_date = 'DATE' in matched_types
            has_desc = 'DESCRIPTION' in matched_types or 'REFERENCE' in matched_types
            has_financial = any(c in matched_types for c in ('DEBIT', 'CREDIT', 'AMOUNT', 'BALANCE'))

            if (has_date and has_desc) or (has_date and has_financial) or (has_desc and len(matched_types) >= 3):
                # Calculate quality score
                score = len(matched_types) * 10.0
                if 'DEBIT' in matched_types and 'CREDIT' in matched_types:
                    score += 15.0
                if 'BALANCE' in matched_types:
                    score += 10.0
                if has_date:
                    score += 10.0

                if score > max_score:
                    max_score = score
                    y0 = min([t.y0 for t in line_tokens_sorted])
                    y1 = max([t.y1 for t in line_tokens_sorted])

                    expanded_cols = cls._expand_column_boundaries(detected_cols)

                    best_candidate = TableHeaderCandidate(
                        page_number=page_number,
                        y0=y0,
                        y1=y1,
                        columns=expanded_cols,
                        raw_text=full_line_text,
                        confidence=min(1.0, 0.4 + len(matched_types) * 0.15),
                    )

        return best_candidate

    @classmethod
    def _expand_column_boundaries(cls, cols: List[ColumnRange]) -> List[ColumnRange]:
        """
        Extends column x0/x1 ranges continuously so tokens fall into strictly non-overlapping intervals.
        """
        if not cols:
            return []

        sorted_cols = sorted(cols, key=lambda c: c.x0)
        expanded: List[ColumnRange] = []

        for i, col in enumerate(sorted_cols):
            x0 = 0.0 if i == 0 else (sorted_cols[i - 1].x1 + col.x0) / 2.0
            x1 = 10000.0 if i == len(sorted_cols) - 1 else (col.x1 + sorted_cols[i + 1].x0) / 2.0
            expanded.append(
                ColumnRange(
                    name=col.name,
                    x0=x0,
                    x1=x1,
                    confidence=col.confidence,
                )
            )

        return expanded


