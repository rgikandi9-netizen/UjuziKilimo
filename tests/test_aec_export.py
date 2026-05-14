import csv
import json
import subprocess
from pathlib import Path

from scripts.aec_export import build_exports, validate_row


def valid_row():
    return {
        "node_id": "AEC-NYA-MAI-001",
        "observation_id": "OBS-001",
        "observer_name": "Raphie",
        "observed_at_iso": "2026-05-13T08:00:00+03:00",
        "gps_latitude": "-0.4000",
        "gps_longitude": "36.5000",
        "gps_accuracy_m": "5",
        "photo_reference": "IMG_0001.jpg",
        "timestamp_confirmed": "true",
        "soil_moisture_vwc_10cm": "22.4",
        "soil_moisture_vwc_30cm": "31.8",
        "surface_temp_c": "24.2",
        "subsurface_temp_c": "20.1",
        "mulch_depth_cm": "3.5",
        "biomass_dry_matter_g": "15.2",
        "decomposition_mass_loss_pct": "8.5",
        "canopy_vigour_score": "4",
        "pest_disease_pressure_score": "1",
        "ridge_structural_integrity": "Minor",
        "notes": "First structured observation.",
    }


def test_validate_row_accepts_complete_observation():
    result = validate_row(valid_row(), 2)

    assert result.compliant is True
    assert result.errors == []
    assert result.record["observed_at_iso"] == "2026-05-13T05:00:00Z"
    assert result.record["timestamp_confirmed"] is True


def test_validate_row_rejects_missing_timestamp_confirmation():
    row = valid_row()
    row["timestamp_confirmed"] = "false"

    result = validate_row(row, 2)

    assert result.compliant is False
    assert "timestamp_confirmed must be true for compliance" in result.errors


def test_build_exports_calculates_schedule_a_share():
    results = [validate_row(valid_row(), 2)]

    exports = build_exports(results, farmer_pool_pct=50.0)

    assert exports["AEC-NYA-MAI-001"]["compliance_summary"]["bonus_eligible_90_pct"] is True
    assert exports["AEC-NYA-MAI-001"]["schedule_a"]["node_share_pct"] == 50.0
    assert len(exports["AEC-NYA-MAI-001"]["sha256"]) == 64


def test_cli_writes_signed_export(tmp_path):
    csv_path = tmp_path / "observations.csv"
    out_dir = tmp_path / "exports"
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(valid_row().keys()))
        writer.writeheader()
        writer.writerow(valid_row())

    subprocess.run(
        ["python3", "scripts/aec_export.py", str(csv_path), "--out", str(out_dir)],
        check=True,
        cwd=Path(__file__).resolve().parents[1],
    )

    files = list(out_dir.glob("AEC-NYA-MAI-001_*.json"))
    assert len(files) == 1
    payload = json.loads(files[0].read_text(encoding="utf-8"))
    assert payload["compliance_summary"]["verified_observations"] == 1
