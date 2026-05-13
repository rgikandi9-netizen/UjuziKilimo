# AEC Field Logging Protocol

## Purpose

The tracker only becomes an economic instrument when field observations are logged in a repeatable format. This protocol defines the minimum record needed for an AEC observation to count as verified for compliance, bonus eligibility, and Schedule A blueprint licensing calculations.

## Visit procedure

1. Confirm the Node ID before measuring anything.
2. Capture timestamped photos before disturbance.
3. Capture GPS coordinates at the observation point.
4. Measure and record all eight AEC variables during the same visit.
5. Link any sentinel sample or decomposition bag measurement by ID.
6. Record missed measurements honestly in `missed_reason`.
7. Run the validator before sharing the dataset.

## Verification rules

An observation is compliant only when:

- `node_id` matches a registered node.
- `observed_at_utc` is present and ISO-like.
- `latitude` and `longitude` are present and numeric.
- `photo_refs` is present.
- `timestamp_confirmed` is `true`.
- all eight AEC variable fields are complete and inside accepted ranges.
- `ridge_integrity` is one of `Intact`, `Minor`, or `Compromised`.

Missed observations should not be fabricated. Use `missed_reason` to preserve the audit trail.

## Compliance threshold

The data-quality bonus flag is calculated per node as:

```text
compliance_rate = compliant_observations / total_observation_rows
```

A node is bonus eligible when compliance is at least 90%.
