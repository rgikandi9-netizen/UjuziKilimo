import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AEC_VARIABLES,
  addNode,
  addObservation,
  emptyState,
  nodeSummary,
  shareRows,
  signedExport,
  validateCoordinates,
} from '../src/tracker.js';

function completeVariables(prefix = 'value') {
  return Object.fromEntries(AEC_VARIABLES.map((variable, index) => [variable.id, `${prefix}-${index + 1}`]));
}

test('validates GPS coordinate bounds', () => {
  assert.deepEqual(validateCoordinates('-0.4231', '36.9503'), {
    latitude: -0.4231,
    longitude: 36.9503,
  });
  assert.throws(() => validateCoordinates('91', '36'), /Latitude/);
  assert.throws(() => validateCoordinates('0', '181'), /Longitude/);
});

test('requires all eight AEC variables before verification', () => {
  let state = emptyState();
  state = addNode(state, {
    id: 'aec-mai-001',
    farmerName: 'Raphie',
    location: 'Mairoinya',
  });

  assert.throws(() => addObservation(state, {
    nodeId: 'AEC-MAI-001',
    observer: 'Raphie',
    observedAt: '2026-05-13T08:00:00Z',
    latitude: -0.4231,
    longitude: 36.9503,
    spatialNote: 'Ridge A',
    photoRef: 'IMG_001.jpg',
    variables: { soilMoistureGradient: '10cm=22%, 30cm=29%' },
    timestampConfirmed: true,
  }), /All eight/);
});

test('calculates compliance, bonus eligibility, Schedule A share, and signed export', async () => {
  let state = emptyState();
  state = addNode(state, { id: 'AEC-MAI-001', farmerName: 'Raphie', location: 'Mairoinya' });
  state = addNode(state, { id: 'AEC-NYE-002', farmerName: 'Uncle', location: 'Kanjuri' });
  state = addObservation(state, {
    id: 'obs-1',
    nodeId: 'AEC-MAI-001',
    observer: 'Raphie',
    observedAt: '2026-05-13T08:00:00Z',
    latitude: -0.4231,
    longitude: 36.9503,
    accuracyMeters: 4,
    spatialNote: 'Ridge A fixed point',
    photoRef: 'IMG_001.jpg',
    variables: completeVariables('mai'),
    timestampConfirmed: true,
    createdAt: '2026-05-13T08:01:00Z',
  });

  assert.equal(nodeSummary(state, 'AEC-MAI-001').complianceRate, 100);
  assert.equal(nodeSummary(state, 'AEC-MAI-001').bonusEligible, true);
  assert.equal(shareRows(state).find((row) => row.node.id === 'AEC-MAI-001').sharePercent, 50);

  const exported = await signedExport(state, 'AEC-MAI-001');
  assert.equal(exported.observations[0].spatial.note, 'Ridge A fixed point');
  assert.match(exported.sha256, /^[a-f0-9]{64}$/);
});
