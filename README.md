# UjuziKilimo AEC Field Data Pack

This repository is the working data pack for the Agricultural Edge Cloud (AEC) demonstration nodes.
It is designed to move the project from photographed field observations into structured, auditable logs.

## Immediate workflow

1. Register each physical plot in `templates/nodes.csv` and copy the completed file to `data/nodes.csv`.
2. Record every field visit in `templates/observations.csv`, including GPS coordinates, timestamp, photo references, and all eight AEC variables.
3. Record sentinel plant pulls in `templates/sentinel_samples.csv`.
4. Record decomposition mesh bag checks in `templates/decomposition_bags.csv`.
5. Run the validator before exporting or sharing any dataset:

```bash
python3 scripts/validate_aec_logs.py --data-dir data --report reports/month1_summary.md
```

The validator refuses incomplete AEC observations, calculates node compliance, flags 90%+ data-quality bonus eligibility, and writes a Month 1 report scaffold from the records actually present.

## AEC variables required for every observation

1. Soil Moisture Gradient — volumetric water content at 10 cm and 30 cm depth.
2. Thermal Stability Index — surface and sub-surface temperature readings.
3. Mulch Depth — centimetres measured at fixed ridge points.
4. Biomass Velocity — dry matter accumulation rate through sentinel sampling references.
5. Decomposition Rate — mesh bag mass-loss references.
6. Canopy / Haulm Vigour — categorical score from 1 to 5.
7. Pest & Disease Pressure — categorical score from 0 to 3.
8. Ridge Structural Integrity — `Intact`, `Minor`, or `Compromised`.

## Node identifiers

Use stable Node IDs on contracts, field sheets, photos, and digital exports. Suggested initial IDs:

- `AEC-KE-NYA-MAI-001` — Mairoinya, Nyandarua County.
- `AEC-KE-NYE-KAR-002` — Karatina area, Nyeri County.
- `AEC-KE-NYE-KAN-003` — Kanjuri area, Nyeri County.

Do not backdate records. If an observation was missed, log the visit with `missed_reason` instead of inventing values.
