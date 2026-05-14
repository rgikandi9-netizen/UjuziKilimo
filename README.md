# AEC Compliance Tracker

A dependency-free browser tracker for Agricultural Edge Cloud node logging. It supports:

- AEC node registration by Node ID, farmer name, and location.
- Observation logging with GPS latitude, longitude, optional accuracy, and fixed-point spatial notes.
- Enforced completion of all eight AEC variables before an observation is verified.
- Dashboard compliance summaries with the 90% data-quality bonus eligibility flag.
- Blueprint Licensing Data Share calculations using the AEC-BSA-001 Schedule A formula.
- Signed per-node JSON exports with SHA-256 hashes for tamper detection.

## Run locally

Serve the directory with any static file server, then open the printed local URL. For example: `npm run start`.

## Checks

```bash
npm test
npm run lint
```
# AEC Field Data Logging Kit

This repository contains the minimum operational layer needed to turn field observations from AEC nodes into structured, auditable data exports.

The immediate priority is simple: log the real field data without inventing, estimating, or backfilling anything.

## Workflow

1. Register each plot in `templates/node_registry.csv` before observations begin.
2. Copy `templates/aec_observation_log.csv` into a dated working file for the node or field day.
3. Record every observation row in the field using the eight required AEC variables, photo proof, timestamp confirmation, and GPS coordinates.
4. Run the exporter to validate rows and generate per-node signed JSON exports.
5. Use the exported JSON to prepare the Month 1 Node Report.

## Required AEC Variables

Every compliant observation must include all eight variables:

1. Soil Moisture Gradient — VWC at 10 cm and 30 cm depth.
2. Thermal Stability Index — surface and sub-surface temperature readings.
3. Mulch Depth — centimetres at fixed ridge points.
4. Biomass Velocity — dry matter accumulation from sentinel sampling.
5. Decomposition Rate — mesh bag mass loss percentage.
6. Canopy / Haulm Vigour — categorical score from 1 to 5.
7. Pest & Disease Pressure — categorical score from 0 to 3.
8. Ridge Structural Integrity — `Intact`, `Minor`, or `Compromised`.

## Export command

```bash
python3 scripts/aec_export.py templates/aec_observation_log.csv --out data/exports
```

The exporter refuses incomplete rows unless they are explicitly marked non-compliant. Each generated JSON file includes the records, compliance summary, Schedule A blueprint licensing calculation, and a SHA-256 hash.
