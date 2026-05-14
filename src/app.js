import {
  AEC_VARIABLES,
  addNode,
  addObservation,
  demoState,
  emptyState,
  nodeSummary,
  shareRows,
  signedExport,
} from './tracker.js';

const STORAGE_KEY = 'aec-compliance-tracker-state';
const $ = (selector) => document.querySelector(selector);

let state = loadState();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : emptyState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setDefaultDate() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  $('#observed-at').value = now.toISOString().slice(0, 16);
}

function renderVariables() {
  $('#variable-inputs').innerHTML = AEC_VARIABLES.map((variable) => `
    <label class="variable-card">
      <span>${variable.label}</span>
      <small>${variable.guidance}</small>
      <input name="${variable.id}" required placeholder="Enter measured value / score" />
    </label>
  `).join('');
}

function renderNodeOptions() {
  const options = state.nodes.map((node) => `<option value="${node.id}">${node.id} — ${node.farmerName}</option>`).join('');
  const placeholder = '<option value="" disabled selected>Register a node first</option>';
  $('#log-node').innerHTML = options || placeholder;
  $('#export-node').innerHTML = options || placeholder;
}

function renderDashboard() {
  const rows = shareRows(state);
  $('#node-cards').innerHTML = rows.length ? rows.map((row) => `
    <article class="card">
      <p class="eyebrow">${row.node.id}</p>
      <h3>${row.node.farmerName}</h3>
      <p>${row.node.location}</p>
      <dl>
        <div><dt>Verified observations</dt><dd>${row.verifiedObservations}</dd></div>
        <div><dt>Compliance rate</dt><dd>${row.complianceRate}%</dd></div>
        <div><dt>90% bonus</dt><dd>${row.bonusEligible ? 'Eligible' : 'Not yet'}</dd></div>
        <div><dt>Schedule A share</dt><dd>${row.sharePercent}%</dd></div>
      </dl>
    </article>
  `).join('') : '<p class="empty">No nodes registered yet. Open the Nodes tab to create the first AEC node.</p>';
}

function renderRecords() {
  $('#record-rows').innerHTML = state.observations.length ? state.observations.map((record) => `
    <tr>
      <td>${new Date(record.observedAt).toLocaleString()}</td>
      <td>${record.nodeId}</td>
      <td>${record.spatial.latitude.toFixed(6)}, ${record.spatial.longitude.toFixed(6)}<br><small>${record.spatial.note}</small></td>
      <td>${record.compliance.completed}/${record.compliance.required}</td>
      <td>${record.compliance.rate}%</td>
    </tr>
  `).join('') : '<tr><td colspan="5">No observations logged yet.</td></tr>';
}

function renderShares() {
  $('#farmer-pool').value = state.farmerPoolPercent;
  const rows = shareRows(state);
  $('#share-rows').innerHTML = rows.length ? rows.map((row) => `
    <article class="share-row">
      <strong>${row.node.id}</strong>
      <span>${row.verifiedObservations} ÷ ${row.totalVerified || 0} × ${row.farmerPoolPercent}% = ${row.sharePercent}%</span>
    </article>
  `).join('') : '<p class="empty">Register nodes to calculate Schedule A shares.</p>';
}

function renderNodes() {
  $('#node-list').innerHTML = state.nodes.length ? state.nodes.map((node) => {
    const summary = nodeSummary(state, node.id);
    return `
      <article class="share-row">
        <strong>${node.id}</strong>
        <span>${node.farmerName} — ${node.location} — ${summary.verifiedObservations} verified</span>
      </article>
    `;
  }).join('') : '<p class="empty">No nodes registered.</p>';
}

function renderAll() {
  renderNodeOptions();
  renderDashboard();
  renderRecords();
  renderShares();
  renderNodes();
}

function collectVariables(form) {
  return Object.fromEntries(AEC_VARIABLES.map((variable) => [
    variable.id,
    new FormData(form).get(variable.id).trim(),
  ]));
}

document.addEventListener('click', (event) => {
  if (!event.target.matches('.tab')) return;
  document.querySelectorAll('.tab, .panel').forEach((element) => element.classList.remove('active'));
  event.target.classList.add('active');
  $(`#${event.target.dataset.tab}`).classList.add('active');
});

$('#node-form').addEventListener('submit', (event) => {
  event.preventDefault();
  state = addNode(state, {
    id: $('#node-id').value,
    farmerName: $('#farmer-name').value,
    location: $('#node-location').value,
  });
  saveState();
  event.target.reset();
  renderAll();
});

$('#observation-form').addEventListener('submit', (event) => {
  event.preventDefault();
  state = addObservation(state, {
    nodeId: $('#log-node').value,
    observer: $('#observer').value,
    observedAt: $('#observed-at').value,
    latitude: $('#latitude').value,
    longitude: $('#longitude').value,
    accuracyMeters: $('#accuracy').value,
    spatialNote: $('#spatial-note').value,
    photoRef: $('#photo-ref').value,
    variables: collectVariables(event.target),
    timestampConfirmed: $('#timestamp-confirmed').checked,
  });
  saveState();
  event.target.reset();
  setDefaultDate();
  renderAll();
});

$('#use-location').addEventListener('click', () => {
  if (!navigator.geolocation) {
    $('#hash-output').textContent = 'Device GPS is not available in this browser.';
    return;
  }
  navigator.geolocation.getCurrentPosition((position) => {
    $('#latitude').value = position.coords.latitude.toFixed(6);
    $('#longitude').value = position.coords.longitude.toFixed(6);
    $('#accuracy').value = position.coords.accuracy.toFixed(1);
  }, () => {
    $('#hash-output').textContent = 'Device GPS permission was denied or unavailable.';
  }, { enableHighAccuracy: true, timeout: 10000 });
});

$('#farmer-pool').addEventListener('input', (event) => {
  state = { ...state, farmerPoolPercent: Number(event.target.value) };
  saveState();
  renderAll();
});

$('#seed-demo').addEventListener('click', () => {
  state = demoState();
  saveState();
  renderAll();
});

$('#export-json').addEventListener('click', async () => {
  const exported = await signedExport(state, $('#export-node').value);
  const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${exported.node.id}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  $('#hash-output').textContent = `SHA-256: ${exported.sha256}`;
});

renderVariables();
setDefaultDate();
renderAll();
