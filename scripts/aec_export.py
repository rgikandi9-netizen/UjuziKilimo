#!/usr/bin/env python3
"""Validate AEC observation CSV files and generate signed per-node JSON exports."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REQUIRED_FIELDS = [
    "node_id",
    "observation_id",
    "observer_name",
    "observed_at_iso",
    "gps_latitude",
    "gps_longitude",
    "photo_reference",
    "timestamp_confirmed",
    "soil_moisture_vwc_10cm",
    "soil_moisture_vwc_30cm",
    "surface_temp_c",
    "subsurface_temp_c",
    "mulch_depth_cm",
    "biomass_dry_matter_g",
    "decomposition_mass_loss_pct",
    "canopy_vigour_score",
    "pest_disease_pressure_score",
    "ridge_structural_integrity",
]

NUMERIC_FIELDS = {
    "gps_latitude": (-90, 90),
    "gps_longitude": (-180, 180),
    "gps_accuracy_m": (0, None),
    "soil_moisture_vwc_10cm": (0, 100),
    "soil_moisture_vwc_30cm": (0, 100),
    "surface_temp_c": (-20, 80),
    "subsurface_temp_c": (-20, 80),
    "mulch_depth_cm": (0, None),
    "biomass_dry_matter_g": (0, None),
    "decomposition_mass_loss_pct": (0, 100),
}

INTEGER_FIELDS = {
    "canopy_vigour_score": (1, 5),
    "pest_disease_pressure_score": (0, 3),
}

RIDGE_VALUES = {"Intact", "Minor", "Compromised"}
TRUE_VALUES = {"true", "yes", "1", "y"}
FALSE_VALUES = {"false", "no", "0", "n"}


@dataclass
class ValidationResult:
    record: dict[str, Any]
    compliant: bool
    errors: list[str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_path", type=Path, help="AEC observation CSV to validate and export")
    parser.add_argument("--out", type=Path, default=Path("data/exports"), help="Output directory")
    parser.add_argument(
        "--farmer-pool-pct",
        type=float,
        default=50.0,
        help="Farmer Pool percentage used for Schedule A calculation",
    )
    return parser.parse_args()


def parse_bool(value: str) -> bool | None:
    normalized = value.strip().lower()
    if normalized in TRUE_VALUES:
        return True
    if normalized in FALSE_VALUES:
        return False
    return None


def parse_observed_at(value: str) -> str | None:
    candidate = value.strip()
    if candidate.endswith("Z"):
        candidate = f"{candidate[:-1]}+00:00"
    try:
        observed_at = datetime.fromisoformat(candidate)
    except ValueError:
        return None
    if observed_at.tzinfo is None:
        return None
    return observed_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_float(field: str, value: str, errors: list[str]) -> float | None:
    if value.strip() == "":
        return None
    try:
        parsed = float(value)
    except ValueError:
        errors.append(f"{field} must be numeric")
        return None

    minimum, maximum = NUMERIC_FIELDS[field]
    if minimum is not None and parsed < minimum:
        errors.append(f"{field} must be >= {minimum}")
    if maximum is not None and parsed > maximum:
        errors.append(f"{field} must be <= {maximum}")
    return parsed


def parse_int(field: str, value: str, errors: list[str]) -> int | None:
    try:
        parsed = int(value)
    except ValueError:
        errors.append(f"{field} must be an integer")
        return None

    minimum, maximum = INTEGER_FIELDS[field]
    if parsed < minimum or parsed > maximum:
        errors.append(f"{field} must be between {minimum} and {maximum}")
    return parsed


def validate_row(row: dict[str, str], row_number: int) -> ValidationResult:
    errors: list[str] = []
    record: dict[str, Any] = {key: (value.strip() if value is not None else "") for key, value in row.items()}

    for field in REQUIRED_FIELDS:
        if not record.get(field):
            errors.append(f"{field} is required")

    if record.get("observed_at_iso"):
        observed_at = parse_observed_at(record["observed_at_iso"])
        if observed_at is None:
            errors.append("observed_at_iso must be timezone-aware ISO 8601")
        else:
            record["observed_at_iso"] = observed_at

    for field in NUMERIC_FIELDS:
        if field in record and record.get(field) != "":
            parsed = parse_float(field, record[field], errors)
            if parsed is not None:
                record[field] = parsed

    for field in INTEGER_FIELDS:
        if record.get(field):
            parsed = parse_int(field, record[field], errors)
            if parsed is not None:
                record[field] = parsed

    if record.get("timestamp_confirmed"):
        timestamp_confirmed = parse_bool(record["timestamp_confirmed"])
        if timestamp_confirmed is None:
            errors.append("timestamp_confirmed must be true or false")
        else:
            record["timestamp_confirmed"] = timestamp_confirmed
            if not timestamp_confirmed:
                errors.append("timestamp_confirmed must be true for compliance")

    if record.get("ridge_structural_integrity") and record["ridge_structural_integrity"] not in RIDGE_VALUES:
        errors.append("ridge_structural_integrity must be Intact, Minor, or Compromised")

    record["row_number"] = row_number
    return ValidationResult(record=record, compliant=not errors, errors=errors)


def canonical_hash(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def build_exports(results: list[ValidationResult], farmer_pool_pct: float) -> dict[str, dict[str, Any]]:
    by_node: dict[str, list[ValidationResult]] = defaultdict(list)
    for result in results:
        node_id = result.record.get("node_id") or "UNASSIGNED"
        by_node[node_id].append(result)

    total_verified = sum(1 for result in results if result.compliant)
    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    exports: dict[str, dict[str, Any]] = {}

    for node_id, node_results in sorted(by_node.items()):
        verified = sum(1 for result in node_results if result.compliant)
        total = len(node_results)
        compliance_rate = (verified / total * 100) if total else 0.0
        node_share_pct = (verified / total_verified * farmer_pool_pct) if total_verified else 0.0
        payload: dict[str, Any] = {
            "node_id": node_id,
            "generated_at_iso": generated_at,
            "records": [
                {
                    **result.record,
                    "compliant": result.compliant,
                    "validation_errors": result.errors,
                }
                for result in node_results
            ],
            "compliance_summary": {
                "total_observations": total,
                "verified_observations": verified,
                "compliance_rate_pct": round(compliance_rate, 2),
                "bonus_eligible_90_pct": compliance_rate >= 90,
            },
            "schedule_a": {
                "formula": "(Node Verified Observations / Total Network Verified Observations) * Farmer Pool %",
                "farmer_pool_pct": farmer_pool_pct,
                "node_verified_observations": verified,
                "total_network_verified_observations": total_verified,
                "node_share_pct": round(node_share_pct, 4),
            },
        }
        payload["sha256"] = canonical_hash(payload)
        exports[node_id] = payload

    return exports


def write_exports(exports: dict[str, dict[str, Any]], out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    today = datetime.now(timezone.utc).date().isoformat()
    for node_id, payload in exports.items():
        safe_node_id = "".join(char if char.isalnum() or char in "-_" else "_" for char in node_id)
        out_path = out_dir / f"{safe_node_id}_{today}.json"
        out_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        written.append(out_path)
    return written


def main() -> int:
    args = parse_args()
    with args.csv_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        missing_headers = [field for field in REQUIRED_FIELDS if field not in (reader.fieldnames or [])]
        if missing_headers:
            raise SystemExit(f"Missing required CSV headers: {', '.join(missing_headers)}")
        results = [validate_row(row, row_number) for row_number, row in enumerate(reader, start=2)]

    exports = build_exports(results, args.farmer_pool_pct)
    written = write_exports(exports, args.out)

    for path in written:
        payload = json.loads(path.read_text(encoding="utf-8"))
        print(f"{path}: {payload['sha256']}")

    failed = sum(1 for result in results if not result.compliant)
    if failed:
        print(f"Warning: {failed} non-compliant observation(s) exported with validation errors.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
