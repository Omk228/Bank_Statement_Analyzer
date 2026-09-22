import re
from typing import List, Dict, Any, Tuple
from ...models.document import SpatialToken, PageExtractionResult, BoundingBox


class DocumentRegionDetector:
    """
    Segments PDF pages into semantic functional zones based on spatial geometry:
    - HEADER (Top 0-25% of page 1)
    - ACCOUNT_INFORMATION (Upper 15-40% of page 1)
    - STATEMENT_PERIOD (Upper 15-35% of page 1)
    - TRANSACTION_TABLE (Middle 25-90% containing columnar ledger data)
    - SUMMARY (Bottom 75-100% or page 1 summary box)
    - FOOTER (Bottom 5-10% of each page)
    """

    @classmethod
    def segment_page(cls, page: PageExtractionResult) -> Dict[str, List[SpatialToken]]:
        tokens = page.tokens
        if not tokens:
            return {
                "HEADER": [],
                "ACCOUNT_INFORMATION": [],
                "STATEMENT_PERIOD": [],
                "TRANSACTION_TABLE": [],
                "SUMMARY": [],
                "FOOTER": [],
            }

        height = page.height or 842.0
        
        header_tokens = []
        account_tokens = []
        table_tokens = []
        summary_tokens = []
        footer_tokens = []

        for t in tokens:
            rel_y = t.y0 / height

            if rel_y < 0.15:
                header_tokens.append(t)
            elif 0.15 <= rel_y < 0.38:
                account_tokens.append(t)
                # Could also be part of table on later pages
                if page.page_number > 1:
                    table_tokens.append(t)
            elif 0.38 <= rel_y < 0.88:
                table_tokens.append(t)
            else:
                summary_tokens.append(t)
                footer_tokens.append(t)

        # On pages after page 1, table typically starts higher up
        if page.page_number > 1:
            table_tokens = [t for t in tokens if 0.08 <= (t.y0 / height) < 0.92]

        return {
            "HEADER": header_tokens,
            "ACCOUNT_INFORMATION": account_tokens if page.page_number == 1 else [],
            "STATEMENT_PERIOD": account_tokens if page.page_number == 1 else [],
            "TRANSACTION_TABLE": table_tokens,
            "SUMMARY": summary_tokens,
            "FOOTER": footer_tokens,
        }
