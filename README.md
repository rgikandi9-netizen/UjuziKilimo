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
