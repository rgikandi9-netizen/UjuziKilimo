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
# AEC Compliance Tracker

A field-first tracker for Agricultural Edge Cloud demonstration nodes. The app registers AEC nodes, logs all eight biological variables, binds each observation to timestamped photo evidence and GPS coordinates, calculates compliance and 90% bonus eligibility, renders Schedule A blueprint licensing shares, and exports per-node signed JSON with a SHA-256 hash.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Data integrity model

A record is fully verified only when it includes:

1. All eight AEC variable confirmations.
2. Timestamp confirmation and photo reference confirmation.
3. GPS latitude, longitude, and fixed ridge or sentinel point.

The export payload includes node metadata, records, compliance summary, Schedule A calculation, and SHA-256 signature. Any modification to the exported JSON will produce a different hash.
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

## Node identifiers

Use stable Node IDs on contracts, field sheets, photos, and digital exports. Suggested initial IDs:

- `AEC-KE-NYA-MAI-001` — Mairoinya, Nyandarua County.
- `AEC-KE-NYE-KAR-002` — Karatina area, Nyeri County.
- `AEC-KE-NYE-KAN-003` — Kanjuri area, Nyeri County.

Do not backdate records. If an observation was missed, log the visit with `missed_reason` instead of inventing values.
## Export command

```bash
python3 scripts/aec_export.py templates/aec_observation_log.csv --out data/exports
```

The exporter refuses incomplete rows unless they are explicitly marked non-compliant. Each generated JSON file includes the records, compliance summary, Schedule A blueprint licensing calculation, and a SHA-256 hash.
