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
