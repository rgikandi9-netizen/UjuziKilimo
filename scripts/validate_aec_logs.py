#!/usr/bin/env python3
"""Validate AEC field logs and generate a Month 1 summary report."""

from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

REQUIRED_FILES = {
    "nodes": "nodes.csv",
    "observations": "observations.csv",
    "sentinel_samples": "sentinel_samples.csv",
    "decomposition_bags": "decomposition_bags.csv",
}

RIDGE_VALUES = {"Intact", "Minor", "Compromised"}
TRUE_VALUES = {"true", "yes", "1"}


@dataclass
class NodeSummary:
    total: int = 0
    compliant: int = 0
    errors: list[str] = field(default_factory=list)

    @property
    def compliance_rate(self) -> float:
        if self.total == 0:
            return 0.0
        return self.compliant / self.total

    @property
    def bonus_eligible(self) -> bool:
        return self.total > 0 and self.compliance_rate >= 0.9


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(f"Missing required file: {path}")
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def require_value(row: dict[str, str], field_name: str, errors: list[str]) -> str:
    value = (row.get(field_name) or "").strip()
    if not value:
        errors.append(f"missing {field_name}")
    return value


def require_float(row: dict[str, str], field_name: str, errors: list[str]) -> float | None:
    value = require_value(row, field_name, errors)
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        errors.append(f"{field_name} must be numeric")
        return None


def require_int_range(
    row: dict[str, str], field_name: str, minimum: int, maximum: int, errors: list[str]
) -> int | None:
    value = require_value(row, field_name, errors)
    if not value:
        return None
    try:
        number = int(value)
    except ValueError:
        errors.append(f"{field_name} must be an integer")
        return None
    if number < minimum or number > maximum:
        errors.append(f"{field_name} must be between {minimum} and {maximum}")
    return number


def valid_timestamp(value: str) -> bool:
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True


def validate_observation(
    row: dict[str, str], row_number: int, node_ids: set[str], sample_ids: set[str], bag_ids: set[str]
) -> tuple[str, list[str]]:
    errors: list[str] = []
    node_id = require_value(row, "node_id", errors)
    if node_id and node_id not in node_ids:
        errors.append(f"node_id {node_id} is not registered")

    observed_at = require_value(row, "observed_at_utc", errors)
    if observed_at and not valid_timestamp(observed_at):
        errors.append("observed_at_utc must be ISO format, for example 2026-05-13T09:00:00Z")

    require_value(row, "observation_id", errors)
    require_value(row, "observer_name", errors)
    require_float(row, "latitude", errors)
    require_float(row, "longitude", errors)
    require_value(row, "photo_refs", errors)

    timestamp_confirmed = (row.get("timestamp_confirmed") or "").strip().lower()
    if timestamp_confirmed not in TRUE_VALUES:
        errors.append("timestamp_confirmed must be true")

    require_float(row, "soil_moisture_10cm_vwc", errors)
    require_float(row, "soil_moisture_30cm_vwc", errors)
    require_float(row, "surface_temp_c", errors)
    require_float(row, "subsurface_temp_c", errors)
    require_float(row, "mulch_depth_cm", errors)

    biomass_sample_id = (row.get("biomass_sample_id") or "").strip()
    if not biomass_sample_id:
        errors.append("missing biomass_sample_id")
    elif sample_ids and biomass_sample_id not in sample_ids:
        errors.append(f"biomass_sample_id {biomass_sample_id} is not registered")

    decomposition_bag_id = (row.get("decomposition_bag_id") or "").strip()
    if not decomposition_bag_id:
        errors.append("missing decomposition_bag_id")
    elif bag_ids and decomposition_bag_id not in bag_ids:
        errors.append(f"decomposition_bag_id {decomposition_bag_id} is not registered")

    require_int_range(row, "canopy_vigour_1_5", 1, 5, errors)
    require_int_range(row, "pest_disease_pressure_0_3", 0, 3, errors)

    ridge_integrity = require_value(row, "ridge_integrity", errors)
    if ridge_integrity and ridge_integrity not in RIDGE_VALUES:
        errors.append(f"ridge_integrity must be one of {', '.join(sorted(RIDGE_VALUES))}")

    if errors:
        errors = [f"row {row_number}: {error}" for error in errors]
    return node_id or "UNASSIGNED", errors


def unique_values(rows: Iterable[dict[str, str]], field_name: str) -> set[str]:
    return {(row.get(field_name) or "").strip() for row in rows if (row.get(field_name) or "").strip()}


def write_report(path: Path, summaries: dict[str, NodeSummary], generated_at: datetime) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# AEC Month 1 Summary",
        "",
        f"Generated at: {generated_at.isoformat()}",
        "",
        "| Node ID | Total Rows | Compliant Rows | Compliance Rate | 90% Bonus Eligible |",
        "| --- | ---: | ---: | ---: | --- |",
    ]
    for node_id in sorted(summaries):
        summary = summaries[node_id]
        lines.append(
            f"| {node_id} | {summary.total} | {summary.compliant} | "
            f"{summary.compliance_rate:.1%} | {'Yes' if summary.bonus_eligible else 'No'} |"
        )
    lines.extend(["", "## Validation findings", ""])
    findings_written = False
    for node_id in sorted(summaries):
        for error in summaries[node_id].errors:
            lines.append(f"- `{node_id}` {error}")
            findings_written = True
    if not findings_written:
        lines.append("- No validation errors found.")
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", default="data", type=Path, help="Directory containing AEC CSV logs")
    parser.add_argument("--report", default=Path("reports/month1_summary.md"), type=Path, help="Report path")
    args = parser.parse_args()

    nodes = read_csv(args.data_dir / REQUIRED_FILES["nodes"])
    observations = read_csv(args.data_dir / REQUIRED_FILES["observations"])
    sentinel_samples = read_csv(args.data_dir / REQUIRED_FILES["sentinel_samples"])
    decomposition_bags = read_csv(args.data_dir / REQUIRED_FILES["decomposition_bags"])

    node_ids = unique_values(nodes, "node_id")
    sample_ids = unique_values(sentinel_samples, "sample_id")
    bag_ids = unique_values(decomposition_bags, "bag_id")
    summaries = {node_id: NodeSummary() for node_id in node_ids}

    for row_number, row in enumerate(observations, start=2):
        node_id, errors = validate_observation(row, row_number, node_ids, sample_ids, bag_ids)
        summaries.setdefault(node_id, NodeSummary())
        summaries[node_id].total += 1
        if errors:
            summaries[node_id].errors.extend(errors)
        else:
            summaries[node_id].compliant += 1

    write_report(args.report, summaries, datetime.now(timezone.utc))

    total_errors = sum(len(summary.errors) for summary in summaries.values())
    print(f"Validated {len(observations)} observation row(s) across {len(summaries)} node(s).")
    print(f"Report written to {args.report}.")
    if total_errors:
        print(f"Found {total_errors} validation error(s).")
        return 1
    print("No validation errors found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
