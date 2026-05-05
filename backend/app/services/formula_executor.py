"""FormulaExecutor — applies Excel formulas to submitted xlsx files."""

from __future__ import annotations

import io
import json
import logging
import re
from typing import Any

import openpyxl
from xlcalculator import ModelCompiler, Evaluator

logger = logging.getLogger(__name__)


def _col_index_to_letter(index: int) -> str:
    result = ""
    while index > 0:
        index, remainder = divmod(index - 1, 26)
        result = chr(ord('A') + remainder) + result
    return result


def _translate_formula_columns(expression: str, header_to_col: dict[str, int]) -> str:
    """Translate header names to actual Excel column letters in a formula.

    Formulas use header names as column references (e.g. =O{row}/N{row} where
    "O" and "N" are header names). This translates them to the actual column
    letters based on the header row position.
    """
    name_to_letter = {
        name: _col_index_to_letter(col_idx)
        for name, col_idx in header_to_col.items()
    }

    def replace(m: re.Match) -> str:
        col_name = m.group(1)
        row_part = m.group(2)
        return name_to_letter.get(col_name, col_name) + row_part

    return re.sub(r'([A-Z]+)(\{row\}|\d+)', replace, expression)


def _apply_scoring(value: float, rules: list[dict]) -> int | None:
    """Map a numeric value to a score using range rules. Rules checked in order."""
    if value is None:
        return None
    for rule in rules:
        lo = rule.get("min")
        hi = rule.get("max")
        if (lo is None or value >= lo) and (hi is None or value <= hi):
            return rule.get("score")
    return None


class FormulaExecutor:

    @staticmethod
    def execute(xlsx_bytes: bytes, formulas: list[Any]) -> bytes:
        """
        Apply formulas to an xlsx file and return modified bytes.

        formulas: list of TemplateFormula ORM objects (or duck-typed equivalents).
        Each has: target_column, formula_type, expression, weight, benchmark, scoring_rules (JSON string).

        Returns original bytes unchanged if formulas list is empty.
        """
        if not formulas:
            return xlsx_bytes

        wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes))
        ws = wb.active
        sheet_name = ws.title

        # Build header → column-index map from row 1
        header_to_col: dict[str, int] = {}
        for col_idx in range(1, ws.max_column + 1):
            header = ws.cell(row=1, column=col_idx).value
            if header:
                header_to_col[str(header)] = col_idx

        # Detect data rows: row 2 through last row with any data
        data_start = 2
        data_end = ws.max_row

        # ── Write formula strings into cells ─────────────────────────────────
        target_col_indices: dict[str, int] = {}

        for formula in formulas:
            target = formula.target_column.upper()

            if target in header_to_col:
                target_col_idx = header_to_col[target]
            else:
                target_col_idx = ws.max_column + 1
                ws.cell(row=1, column=target_col_idx, value=target)
                header_to_col[target] = target_col_idx

            target_col_indices[target] = target_col_idx

            translated = _translate_formula_columns(formula.expression, header_to_col)

            if formula.formula_type == "column":
                for row in range(data_start, data_end + 1):
                    cell_formula = translated.replace("{row}", str(row))
                    ws.cell(row=row, column=target_col_idx, value=cell_formula)
            else:
                # single_cell: write formula once, in the data_start row of target column
                ws.cell(row=data_start, column=target_col_idx, value=translated)

        # ── Evaluate with xlcalculator ────────────────────────────────────────
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)

        try:
            compiler = ModelCompiler()
            model = compiler.read_and_parse_archive(buf, ignore_sheets=[])
            evaluator = Evaluator(model)
        except Exception as exc:
            logger.warning("xlcalculator failed to parse workbook: %s — returning unprocessed file", exc)
            buf.seek(0)
            return buf.read()

        # ── Write computed values back (replace formula strings with numbers) ─
        weighted: list[tuple[float, float]] = []  # (weight, score)

        for formula in formulas:
            target = formula.target_column.upper()
            target_col_idx = target_col_indices[target]
            scoring_rules = json.loads(formula.scoring_rules) if formula.scoring_rules else []

            if formula.formula_type == "column":
                for row in range(data_start, data_end + 1):
                    cell_addr = f"{sheet_name}!{_col_index_to_letter(target_col_idx)}{row}"
                    try:
                        computed = evaluator.evaluate(cell_addr)
                        numeric = float(computed) if computed not in (None, "") else None
                    except Exception:
                        numeric = None
                    ws.cell(row=row, column=target_col_idx, value=numeric)

                    if scoring_rules and numeric is not None:
                        score = _apply_scoring(numeric, scoring_rules)
                        score_header = f"{target}_score"
                        if score_header not in header_to_col:
                            score_col_idx = ws.max_column + 1
                            ws.cell(row=1, column=score_col_idx, value=score_header)
                            header_to_col[score_header] = score_col_idx
                        else:
                            score_col_idx = header_to_col[score_header]
                        ws.cell(row=row, column=score_col_idx, value=score)

                        if formula.weight and row == data_start:
                            weighted.append((formula.weight, score or 0))

            else:
                # single_cell
                cell_addr = f"{sheet_name}!{_col_index_to_letter(target_col_idx)}{data_start}"
                try:
                    computed = evaluator.evaluate(cell_addr)
                    numeric = float(computed) if computed not in (None, "") else None
                except Exception:
                    numeric = None
                ws.cell(row=data_start, column=target_col_idx, value=numeric)

        # ── Append weighted score summary ─────────────────────────────────────
        if weighted:
            total_weight = sum(w for w, _ in weighted)
            weighted_score = (
                sum(w * s for w, s in weighted) / total_weight
                if total_weight > 0 else 0
            )
            summary_row = data_end + 2
            ws.cell(row=summary_row, column=1, value="Weighted Score")
            ws.cell(row=summary_row, column=2, value=round(weighted_score, 2))

        result_buf = io.BytesIO()
        wb.save(result_buf)
        return result_buf.getvalue()
