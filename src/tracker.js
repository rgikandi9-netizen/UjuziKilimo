export const AEC_VARIABLES = [
  {
    id: 'soilMoistureGradient',
    label: 'Soil Moisture Gradient',
    guidance: 'VWC at 10cm and 30cm depth.',
  },
  {
    id: 'thermalStabilityIndex',
    label: 'Thermal Stability Index',
    guidance: 'Surface vs sub-surface temperature differential.',
  },
  {
    id: 'mulchDepth',
    label: 'Mulch Depth',
    guidance: 'Measured at fixed ridge points in centimetres.',
  },
  {
    id: 'biomassVelocity',
    label: 'Biomass Velocity',
    guidance: 'Dry matter accumulation rate via sentinel sampling.',
  },
  {
    id: 'decompositionRate',
    label: 'Decomposition Rate',
    guidance: 'Mesh bag mass loss at fixed intervals.',
  },
  {
    id: 'canopyVigour',
    label: 'Canopy / Haulm Vigour',
    guidance: 'Categorical score from 1 to 5.',
  },
  {
    id: 'pestDiseasePressure',
    label: 'Pest & Disease Pressure',
    guidance: 'Categorical score from 0 to 3.',
  },
  {
    id: 'ridgeStructuralIntegrity',
    label: 'Ridge Structural Integrity',
    guidance: 'Intact / Minor / Compromised.',
  },
];

export function emptyState() {
  return {
    nodes: [],
    observations: [],
    farmerPoolPercent: 50,
  };
}

export function addNode(state, node) {
  const normalizedId = node.id.trim().toUpperCase();
  if (!normalizedId) throw new Error('Node ID is required.');
  if (state.nodes.some((existing) => existing.id === normalizedId)) {
    throw new Error(`Node ${normalizedId} already exists.`);
  }

  return {
    ...state,
    nodes: [
      ...state.nodes,
      {
        id: normalizedId,
        farmerName: node.farmerName.trim(),
        location: node.location.trim(),
        registeredAt: node.registeredAt ?? new Date().toISOString(),
      },
    ],
  };
}

export function validateCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error('Latitude must be between -90 and 90.');
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error('Longitude must be between -180 and 180.');
  }
  return { latitude: lat, longitude: lon };
}

export function variableCompletion(variables) {
  const completed = AEC_VARIABLES.filter((variable) => {
    const value = variables?.[variable.id];
    return typeof value === 'string' && value.trim().length > 0;
  }).length;

  return {
    completed,
    required: AEC_VARIABLES.length,
    rate: Math.round((completed / AEC_VARIABLES.length) * 100),
    complete: completed === AEC_VARIABLES.length,
  };
}

export function addObservation(state, observation) {
  if (!state.nodes.some((node) => node.id === observation.nodeId)) {
    throw new Error(`Node ${observation.nodeId} is not registered.`);
  }
  const coordinates = validateCoordinates(observation.latitude, observation.longitude);
  const completion = variableCompletion(observation.variables);
  if (!completion.complete) {
    throw new Error('All eight AEC variables are required before an observation can be verified.');
  }
  if (!observation.timestampConfirmed) {
    throw new Error('Timestamp and photo confirmation is required.');
  }

  const saved = {
    id: observation.id ?? globalThis.crypto.randomUUID(),
    nodeId: observation.nodeId,
    observer: observation.observer.trim(),
    observedAt: new Date(observation.observedAt).toISOString(),
    spatial: {
      ...coordinates,
      accuracyMeters: observation.accuracyMeters === '' ? null : Number(observation.accuracyMeters ?? 0) || null,
      note: observation.spatialNote.trim(),
    },
    photoRef: observation.photoRef.trim(),
    variables: observation.variables,
    compliance: completion,
    timestampConfirmed: true,
    createdAt: observation.createdAt ?? new Date().toISOString(),
  };

  return {
    ...state,
    observations: [...state.observations, saved],
  };
}

export function nodeSummary(state, nodeId) {
  const observations = state.observations.filter((record) => record.nodeId === nodeId);
  const verifiedObservations = observations.filter((record) => record.compliance.complete).length;
  const complianceRate = observations.length === 0
    ? 0
    : Math.round((verifiedObservations / observations.length) * 100);

  return {
    observations: observations.length,
    verifiedObservations,
    complianceRate,
    bonusEligible: complianceRate >= 90 && observations.length > 0,
  };
}

export function shareRows(state) {
  const totalVerified = state.nodes.reduce(
    (sum, node) => sum + nodeSummary(state, node.id).verifiedObservations,
    0,
  );

  return state.nodes.map((node) => {
    const summary = nodeSummary(state, node.id);
    const sharePercent = totalVerified === 0
      ? 0
      : (summary.verifiedObservations / totalVerified) * state.farmerPoolPercent;

    return {
      node,
      ...summary,
      totalVerified,
      farmerPoolPercent: state.farmerPoolPercent,
      sharePercent: Number(sharePercent.toFixed(2)),
    };
  });
}

export async function signedExport(state, nodeId) {
  const node = state.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error(`Node ${nodeId} is not registered.`);

  const rows = shareRows(state);
  const exportBody = {
    schema: 'AEC Compliance Tracker v3 Spatial Export',
    exportedAt: new Date().toISOString(),
    node,
    observations: state.observations.filter((record) => record.nodeId === nodeId),
    complianceSummary: nodeSummary(state, nodeId),
    scheduleA: rows.find((row) => row.node.id === nodeId),
  };
  const canonicalJson = JSON.stringify(exportBody);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson));
  const hash = [...new Uint8Array(hashBuffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

  return {
    ...exportBody,
    canonicalJson,
    sha256: hash,
  };
}

export function demoState() {
  let state = emptyState();
  state = addNode(state, {
    id: 'AEC-MAI-001',
    farmerName: 'Raphie Demo Node',
    location: 'Mairoinya, Nyandarua County',
    registeredAt: '2026-05-13T00:00:00.000Z',
  });
  state = addNode(state, {
    id: 'AEC-NYE-002',
    farmerName: 'Karatina / Kanjuri Demo Node',
    location: 'Nyeri County',
    registeredAt: '2026-05-13T00:00:00.000Z',
  });
  return state;
}
