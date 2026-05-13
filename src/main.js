const VARIABLE_DEFINITIONS = [
  ['soilMoistureGradient', 'V1 Soil Moisture Gradient', 'Record volumetric water content at 10cm and 30cm depth from the same ridge point.', ['vwc10', 'vwc30']],
  ['thermalStabilityIndex', 'V2 Thermal Stability Index', 'Record surface and sub-surface temperatures, then compare the differential.', ['surfaceTemp', 'subsurfaceTemp']],
  ['mulchDepth', 'V3 Mulch Depth', 'Measure mulch depth in centimetres at the fixed ridge observation point.', ['depthCm']],
  ['biomassVelocity', 'V4 Biomass Velocity', 'Log sentinel plant dry-matter accumulation and sampling interval.', ['sampleId', 'dryMatterGrams', 'daysSinceLastSample']],
  ['decompositionRate', 'V5 Decomposition Rate', 'Record mesh-bag start mass, recovered mass, and burial duration.', ['bagId', 'startMassGrams', 'recoveredMassGrams', 'daysBuried']],
  ['canopyHaulmVigour', 'V6 Canopy / Haulm Vigour', 'Score 1–5: 1 poor or sparse, 3 moderate, 5 closed blue-green vigorous canopy.', ['score']],
  ['pestDiseasePressure', 'V7 Pest & Disease Pressure', 'Score 0–3: 0 absent, 1 low, 2 moderate, 3 severe or spreading.', ['score']],
  ['ridgeStructuralIntegrity', 'V8 Ridge Structural Integrity', 'Classify ridge as Intact, Minor, or Compromised after rain and field work.', ['status']],
];

const STORAGE_KEY = 'aec-compliance-tracker-v4';
const TABS = ['Dashboard', 'Record Log', 'Data Share', 'Export', 'Nodes'];
const state = loadState();
let activeTab = 'Dashboard';
let farmerPoolPercentage = 50;

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : { nodes: [], records: [], lastExportHash: '' };
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function blankVariableChecks() {
  return Object.fromEntries(VARIABLE_DEFINITIONS.map(([id]) => [id, false]));
}

function blankVariableValues() {
  return Object.fromEntries(VARIABLE_DEFINITIONS.map(([id, , , fields]) => [id, Object.fromEntries(fields.map((field) => [field, '']))]));
}

function calculateRecordCompliance(record) {
  const completedVariables = VARIABLE_DEFINITIONS.filter(([id]) => record.variableChecks[id]).length;
  const requiredProof = record.timestampConfirmed && record.photoConfirmed && Boolean(record.photoReference);
  const spatialProof = Boolean(record.latitude) && Boolean(record.longitude) && Boolean(record.ridgePoint);
  const totalItems = VARIABLE_DEFINITIONS.length + 2;
  const completedItems = completedVariables + (requiredProof ? 1 : 0) + (spatialProof ? 1 : 0);
  return Math.round((completedItems / totalItems) * 100);
}

function calculateNodeSummary(nodeId) {
  const nodeRecords = state.records.filter((record) => record.nodeId === nodeId);
  const verifiedRecords = nodeRecords.filter((record) => calculateRecordCompliance(record) === 100);
  const totalVerifiedRecords = state.records.filter((record) => calculateRecordCompliance(record) === 100).length;
  const complianceRate = nodeRecords.length
    ? Math.round(nodeRecords.reduce((sum, record) => sum + calculateRecordCompliance(record), 0) / nodeRecords.length)
    : 0;
  const licensingShare = totalVerifiedRecords
    ? Number(((verifiedRecords.length / totalVerifiedRecords) * farmerPoolPercentage).toFixed(2))
    : 0;
  return { totalRecords: nodeRecords.length, verifiedRecords: verifiedRecords.length, totalVerifiedRecords, complianceRate, bonusEligible: complianceRate >= 90, licensingShare };
}

function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(options).forEach(([key, value]) => {
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) node.setAttribute(key, '');
    else if (value !== false && value !== null && value !== undefined) node.setAttribute(key, value);
  });
  children.forEach((child) => node.append(child));
  return node;
}

function render() {
  document.querySelector('#root').innerHTML = '';
  const shell = element('main', { className: 'app-shell' }, [
    element('header', { className: 'hero' }, [
      element('p', { className: 'eyebrow', text: 'Agricultural Edge Cloud' }),
      element('h1', { text: 'AEC Compliance Tracker v4' }),
      element('p', { text: 'Log field-native biological observations, bind each record to Node ID and GPS coordinates, and export tamper-detectable Schedule A evidence.' }),
    ]),
    renderTabs(),
    renderActiveTab(),
  ]);
  document.querySelector('#root').append(shell);
}

function renderTabs() {
  return element('nav', { className: 'tabs', 'aria-label': 'Tracker sections' }, TABS.map((tab) => element('button', {
    className: activeTab === tab ? 'active' : '',
    type: 'button',
    text: tab,
    onclick: () => { activeTab = tab; render(); },
  })));
}

function renderActiveTab() {
  if (activeTab === 'Dashboard') return renderDashboard();
  if (activeTab === 'Record Log') return renderRecordLog();
  if (activeTab === 'Data Share') return renderDataShare();
  if (activeTab === 'Export') return renderExport();
  return renderNodes();
}

function renderDashboard() {
  const cards = state.nodes.map((node) => {
    const summary = calculateNodeSummary(node.nodeId);
    return element('article', { className: 'card' }, [
      element('div', { className: 'card-header' }, [
        element('div', {}, [element('p', { className: 'eyebrow', text: node.locationName || node.county || 'AEC node' }), element('h2', { text: node.nodeId })]),
        element('span', { className: summary.bonusEligible ? 'pill success' : 'pill', text: summary.bonusEligible ? '90%+ bonus eligible' : 'Below bonus threshold' }),
      ]),
      metricList([['Farmer', node.farmerName], ['Records', summary.totalRecords], ['Verified', summary.verifiedRecords], ['Compliance', `${summary.complianceRate}%`], ['Schedule A Share', `${summary.licensingShare}%`]]),
    ]);
  });
  if (!cards.length) cards.push(element('article', { className: 'empty' }, [element('h2', { text: 'No nodes registered' }), element('p', { text: 'Register Mairoinya, Karatina, or Kanjuri nodes before logging observations.' })]));
  return element('section', { className: 'grid cards' }, cards);
}

function metricList(items) {
  return element('dl', { className: 'metrics' }, items.map(([term, description]) => element('div', {}, [element('dt', { text: term }), element('dd', { text: String(description) })])));
}

function renderRecordLog() {
  const form = element('form', { className: 'form-grid', onsubmit: saveRecord });
  form.append(
    field('Node ID', selectNode()),
    field('Observer name', input('observerName', 'Raphie / field worker')),
    field('Observed at', input('observedAt', '', 'datetime-local', true)),
    field('Ridge / sentinel point', input('ridgePoint', 'Ridge A / Bag 03 / Sentinel 02')),
    field('Latitude', input('latitude', '-0.123456')),
    field('Longitude', input('longitude', '36.123456')),
    field('GPS accuracy metres', input('gpsAccuracy', 'Optional')),
    element('button', { className: 'secondary', type: 'button', text: 'Use device GPS', onclick: useCurrentPosition }),
    field('Photo reference', input('photoReference', 'Photo filename, CID, or drive ID', 'text', true)),
    checkbox('timestampConfirmed', 'Timestamp confirmed'),
    checkbox('photoConfirmed', 'Photo captured at observation point'),
    field('Notes', textarea('notes', 'Rainfall, ridge slump, mulch changes, pest notes, buyer visit, or anomaly'), 'wide'),
    renderVariableList(),
    element('div', { className: 'compliance-preview wide', id: 'compliance-preview', text: 'Current record compliance: 0%' }),
    element('button', { className: 'primary wide', type: 'submit', text: 'Save observation record' }),
  );
  return panel('Field observation', 'Log the eight AEC variables', 'Each compliant record requires all eight variables, a timestamp, photo reference, ridge point, and GPS coordinates.', form);
}

const draft = { nodeId: '', observerName: '', observedAt: '', latitude: '', longitude: '', gpsAccuracy: '', ridgePoint: '', photoReference: '', timestampConfirmed: false, photoConfirmed: false, notes: '', variableChecks: blankVariableChecks(), variableValues: blankVariableValues() };

function input(name, placeholder, type = 'text', required = false) {
  const control = element('input', { name, placeholder, type, value: draft[name] || '' });
  if (required) control.required = true;
  control.addEventListener('input', updateDraft);
  return control;
}

function textarea(name, placeholder) {
  const control = element('textarea', { name, placeholder });
  control.value = draft[name] || '';
  control.addEventListener('input', updateDraft);
  return control;
}

function selectNode() {
  const select = element('select', { name: 'nodeId' }, [element('option', { value: '', text: 'Select node' })]);
  state.nodes.forEach((node) => select.append(element('option', { value: node.nodeId, text: node.nodeId })));
  select.value = draft.nodeId;
  select.required = true;
  select.addEventListener('change', updateDraft);
  return select;
}

function field(labelText, control, className = '') {
  return element('label', { className, text: labelText }, [control]);
}

function checkbox(name, labelText) {
  const control = element('input', { type: 'checkbox', name });
  control.checked = draft[name];
  control.addEventListener('change', updateDraft);
  return element('label', { className: 'check' }, [control, document.createTextNode(labelText)]);
}

function updateDraft(event) {
  const { name, value, type, checked } = event.target;
  draft[name] = type === 'checkbox' ? checked : value;
  updateCompliancePreview();
}

function renderVariableList() {
  const wrapper = element('div', { className: 'wide variable-list' });
  VARIABLE_DEFINITIONS.forEach(([id, label, guidance, fields]) => {
    const check = element('input', { type: 'checkbox' });
    check.checked = draft.variableChecks[id];
    check.addEventListener('change', () => { draft.variableChecks[id] = check.checked; updateCompliancePreview(); });
    const miniGrid = element('div', { className: 'mini-grid' });
    fields.forEach((fieldName) => {
      const control = element('input', { value: draft.variableValues[id][fieldName] || '' });
      control.addEventListener('input', () => { draft.variableValues[id][fieldName] = control.value; });
      miniGrid.append(field(labelize(fieldName), control));
    });
    wrapper.append(element('article', { className: 'variable-card' }, [
      element('label', { className: 'check strong' }, [check, document.createTextNode(label)]),
      element('p', { text: guidance }),
      miniGrid,
    ]));
  });
  return wrapper;
}

function updateCompliancePreview() {
  const preview = document.querySelector('#compliance-preview');
  if (preview) preview.textContent = `Current record compliance: ${calculateRecordCompliance(draft)}%`;
}

function saveRecord(event) {
  event.preventDefault();
  const record = structuredClone(draft);
  record.recordId = `AEC-OBS-${Date.now()}`;
  record.savedAt = new Date().toISOString();
  record.complianceScore = calculateRecordCompliance(record);
  state.records.unshift(record);
  const lastNodeId = draft.nodeId;
  Object.assign(draft, { nodeId: lastNodeId, observerName: '', observedAt: '', latitude: '', longitude: '', gpsAccuracy: '', ridgePoint: '', photoReference: '', timestampConfirmed: false, photoConfirmed: false, notes: '', variableChecks: blankVariableChecks(), variableValues: blankVariableValues() });
  persist();
  activeTab = 'Dashboard';
  render();
}

function useCurrentPosition() {
  navigator.geolocation.getCurrentPosition((position) => {
    draft.latitude = position.coords.latitude.toFixed(6);
    draft.longitude = position.coords.longitude.toFixed(6);
    draft.gpsAccuracy = Math.round(position.coords.accuracy).toString();
    activeTab = 'Record Log';
    render();
  });
}

function renderDataShare() {
  const pool = element('input', { type: 'number', min: '0', max: '100', value: farmerPoolPercentage });
  pool.addEventListener('input', () => { farmerPoolPercentage = Number(pool.value); render(); });
  const body = element('tbody');
  state.nodes.forEach((node) => {
    const summary = calculateNodeSummary(node.nodeId);
    body.append(element('tr', {}, [element('td', { text: node.nodeId }), element('td', { text: String(summary.verifiedRecords) }), element('td', { text: String(summary.totalVerifiedRecords) }), element('td', { text: `${summary.licensingShare}%` })]));
  });
  return panel('AEC-BSA-001 Schedule A', 'Blueprint Licensing Data Share', 'Node Share (%) = (Node Verified Observations ÷ Total Network Verified Observations) × Farmer Pool %', element('div', {}, [
    field('Farmer Pool %', pool, 'pool-input'),
    element('div', { className: 'table-wrap' }, [element('table', {}, [element('thead', {}, [element('tr', {}, ['Node', 'Verified observations', 'Network verified', 'Node share'].map((heading) => element('th', { text: heading })))]), body])]),
  ]));
}

function renderExport() {
  const exports = element('div', { className: 'export-list' });
  state.nodes.forEach((node) => exports.append(element('button', { className: 'primary', type: 'button', text: `Export ${node.nodeId}`, onclick: () => exportNode(node) })));
  const content = [exports];
  if (state.lastExportHash) content.push(element('pre', { className: 'hash', text: `Last export SHA-256: ${state.lastExportHash}` }));
  return panel('Provenance', 'Signed JSON export', 'Export each node as signed JSON. Any edit to the downloaded file changes the SHA-256 hash.', element('div', {}, content));
}

async function exportNode(node) {
  const summary = calculateNodeSummary(node.nodeId);
  const payload = {
    schema: 'AEC Compliance Tracker Export v4',
    exportedAt: new Date().toISOString(),
    node,
    records: state.records.filter((record) => record.nodeId === node.nodeId),
    complianceSummary: summary,
    scheduleA: {
      formula: 'Node Share (%) = (Node Verified Observations / Total Network Verified Observations) × Farmer Pool %',
      nodeVerifiedObservations: summary.verifiedRecords,
      totalNetworkVerifiedObservations: summary.totalVerifiedRecords,
      farmerPoolPercentage,
      nodeSharePercentage: summary.licensingShare,
    },
  };
  const unsignedJson = JSON.stringify(payload, null, 2);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(unsignedJson));
  const hash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const signedJson = JSON.stringify({ ...payload, sha256: hash }, null, 2);
  const url = URL.createObjectURL(new Blob([signedJson], { type: 'application/json' }));
  const link = element('a', { href: url, download: `${node.nodeId}-${new Date().toISOString().slice(0, 10)}-aec-export.json` });
  link.click();
  URL.revokeObjectURL(url);
  state.lastExportHash = hash;
  persist();
  render();
}

function renderNodes() {
  const form = element('form', { className: 'form-grid', onsubmit: saveNode });
  ['nodeId', 'farmerName', 'county', 'locationName', 'plotSize'].forEach((name) => form.append(field(labelize(name), element('input', { name, placeholder: nodePlaceholder(name), required: ['nodeId', 'farmerName'].includes(name) }))));
  form.append(element('button', { className: 'primary wide', type: 'submit', text: 'Save node' }));
  return panel('Node registry', 'Register AEC nodes', 'Node ID anchors the contract, field log, GPS record, and export payload.', form);
}

function saveNode(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  const existingIndex = state.nodes.findIndex((node) => node.nodeId === data.nodeId);
  if (existingIndex >= 0) state.nodes[existingIndex] = data;
  else state.nodes.push(data);
  persist();
  activeTab = 'Dashboard';
  render();
}

function panel(eyebrow, title, description, content) {
  return element('section', { className: 'panel' }, [
    element('div', { className: 'section-heading' }, [element('p', { className: 'eyebrow', text: eyebrow }), element('h2', { text: title }), element('p', { text: description })]),
    content,
  ]);
}

function labelize(value) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
}

function nodePlaceholder(name) {
  return { nodeId: 'AEC-NYA-MAI-001', farmerName: 'Farmer / signatory', county: 'Nyandarua / Nyeri', locationName: 'Mairoinya / Karatina / Kanjuri', plotSize: '5 acres' }[name];
}

render();
