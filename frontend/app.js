// ══════════════════════════════════════════════════════════════════
//  SENTINEL LOGIC AUDITOR — Frontend Application
// ══════════════════════════════════════════════════════════════════

// ── APP STATE ──────────────────────────────────────────────────
let state = {
  currentView: 'dashboard',
  selectedProjectUuid: 'c7f3a2b1-d4e5-4f6a-8b0c-d1e2f3a4b5c6',
  projects: [
    { uuid: 'c7f3a2b1-d4e5-4f6a-8b0c-d1e2f3a4b5c6', name: 'KYC Verification Agent',     tool: 'agno',  score: 74.5, critical: 2, status: 'active', audits: 1284, drifts: 38 },
    { uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', name: 'Customer Onboarding Flow',   tool: 'n8n',   score: 92.1, critical: 0, status: 'active', audits: 842,  drifts: 5  },
    { uuid: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', name: 'Fraud Detection Pipeline',    tool: 'agno',  score: 55.3, critical: 2, status: 'active', audits: 231,  drifts: 45 },
  ],
  drifts: [],
  reqNodes: [],
  isLoading: true,
  theme: localStorage.getItem('sentinel-theme') || 'dark',
  currentRawContent: ''
};

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('sentinel-theme', state.theme);
  applyTheme();
}

function applyTheme() {
  const isLight = state.theme === 'light';
  
  // Add transition class to body
  document.body.classList.add('theme-transitioning');
  
  // Toggle the theme class
  document.body.classList.toggle('light-theme', isLight);
  
  // Update UI elements
  const themeBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = themeBtn.querySelector('i');
  const themeCheckbox = document.getElementById('theme-toggle-checkbox');
  
  if (isLight) {
    themeIcon.classList.replace('fa-sun', 'fa-moon');
    if (themeCheckbox) themeCheckbox.checked = true;
  } else {
    themeIcon.classList.replace('fa-moon', 'fa-sun');
    if (themeCheckbox) themeCheckbox.checked = false;
  }
  
  // Remove transition class after animation finishes
  setTimeout(() => {
    document.body.classList.remove('theme-transitioning');
  }, 300);
}

const DRIFTS = [
  {
    id: 'D-1284',
    severity: 'critical',
    drift_type: 'constraint_violated',
    title: 'Raw Credentials Exposed in Execution Log',
    project: 'KYC Verification Agent',
    execution_id: 'exec_8a3f2',
    brd_expectation: '§2.1: The agent MUST NOT expose raw credentials or PII in any log output. All sensitive data must be masked before logging.',
    actual_behaviour: 'Step 5 wrote the user\'s raw password and SSN to the console log in plain text without any masking or encryption.',
    ai_explanation: 'The agent bypassed the data-masking middleware because the authentication step was refactored in the last deployment without updating the logging hook. This is a critical GDPR and SOC-2 compliance violation.',
    remediation_hint: 'Inject the SensitiveDataFilter middleware before all log emission calls. Add a pre-commit hook that scans for credential patterns in logs.',
    similarity_score: 0.08,
    time_ago: '4 min ago',
  },
  {
    id: 'D-1283',
    severity: 'critical',
    drift_type: 'skipped_step',
    title: 'OTP Verification Step Completely Skipped',
    project: 'KYC Verification Agent',
    execution_id: 'exec_7c1e9',
    brd_expectation: '§2.1 Step 1: The agent MUST verify the user\'s identity via OTP before any data access.',
    actual_behaviour: 'The agent proceeded directly from email input to data retrieval, skipping OTP entirely. No verification token was generated or sent.',
    ai_explanation: 'The OTP service returned a 503 timeout and the agent\'s error-handling path silently continued execution instead of aborting.',
    remediation_hint: 'Add a circuit-breaker: if OTP service is unavailable, halt execution and return HTTP 503 to the caller. Never silently bypass auth steps.',
    similarity_score: 0.05,
    time_ago: '12 min ago',
  },
  {
    id: 'D-1282',
    severity: 'high',
    drift_type: 'data_integrity_fail',
    title: 'Response Payload Exceeds 10MB Constraint',
    project: 'KYC Verification Agent',
    execution_id: 'exec_6b8d4',
    brd_expectation: '§2.2 Step 3: The agent MUST confirm response payload does not exceed 10MB.',
    actual_behaviour: 'The data retrieval step returned an 18MB unfiltered payload, bypassing the row-level security filter and size constraint check.',
    ai_explanation: 'Row-level security filters were not applied because the query used a raw SQL join that bypassed the ORM\'s policy layer.',
    remediation_hint: 'Enforce payload size limits at the API gateway level using a middleware guard. Move RLS filters to a database VIEW to make bypass impossible.',
    similarity_score: 0.21,
    time_ago: '31 min ago',
  },
  {
    id: 'D-1281',
    severity: 'high',
    drift_type: 'wrong_order',
    title: 'Data Retrieved Before Permission Check',
    project: 'Fraud Detection Pipeline',
    execution_id: 'exec_5a7c1',
    brd_expectation: '§3.1: Permission validation MUST occur before any dataset query is executed.',
    actual_behaviour: 'The pipeline executed the dataset query at Step 2, then performed the permission check at Step 4 — violating the required sequence.',
    ai_explanation: 'An async refactor introduced a race condition where the query promise resolved before the permission middleware awaited.',
    remediation_hint: 'Make the permission check synchronous and place it as the first step in the handler chain using Express middleware ordering.',
    similarity_score: 0.34,
    time_ago: '1 hr ago',
  },
  {
    id: 'D-1280',
    severity: 'medium',
    drift_type: 'incomplete_execution',
    title: 'Workflow Stopped Before Audit Trail Entry',
    project: 'Invoice Approval Workflow',
    execution_id: 'exec_4d2f8',
    brd_expectation: '§4.3: Every completed approval cycle MUST write a timestamped entry to the immutable audit trail.',
    actual_behaviour: 'The approval was processed and notification sent, but execution terminated at Step 6 before the audit trail write at Step 7.',
    ai_explanation: 'An unhandled exception in the notification module caused the worker process to exit before reaching the audit trail step.',
    remediation_hint: 'Wrap the audit trail write in a finally block that executes regardless of notification success or failure.',
    similarity_score: 0.52,
    time_ago: '2 hr ago',
  },
];

const BRD_NODES = [
  { key: 'verify_identity', label: 'Verify User Identity (OTP)', sub: '§2.1 — MANDATORY · CRITICAL', status: 'skipped' },
  { key: 'log_auth_attempt', label: 'Log Authentication Attempt', sub: '§2.1 — MANDATORY · HIGH', status: 'matched' },
  { key: 'rate_limit_check', label: 'Rate-limit Failed Attempts (max 3/15m)', sub: '§2.1 — MANDATORY · HIGH', status: 'matched' },
  { key: 'generate_jwt', label: 'Generate JWT (1hr expiry)', sub: '§2.1 — MANDATORY · CRITICAL', status: 'violated' },
  { key: 'no_credential_log', label: 'MUST NOT: Log Raw Credentials', sub: '§2.1 — CONSTRAINT · CRITICAL', status: 'violated' },
  { key: 'permission_check', label: 'Check Dataset Permissions', sub: '§2.2 — MANDATORY · CRITICAL', status: 'skipped' },
  { key: 'rls_filter', label: 'Apply Row-Level Security', sub: '§2.2 — MANDATORY · HIGH', status: 'skipped' },
  { key: 'payload_size', label: 'Confirm Payload ≤ 10MB', sub: '§2.2 — MANDATORY · HIGH', status: 'violated' },
];

const AGENT_NODES = [
  { key: 'email_input', label: 'Email Received — OTP Skipped', sub: 'Step 1 · duration: 12ms', status: 'violated' },
  { key: 'fetch_all', label: 'Fetched ALL Datasets (No Filter)', sub: 'Step 2 · duration: 340ms', status: 'violated' },
  { key: 'return_data', label: 'Returned 18MB Unfiltered Payload', sub: 'Step 3 · duration: 88ms', status: 'violated' },
  { key: 'jwt_generated', label: 'JWT Generated (24hr expiry)', sub: 'Step 4 · duration: 6ms', status: 'violated' },
  { key: 'log_with_creds', label: 'Console Log with Raw Password', sub: 'Step 5 · duration: 2ms', status: 'violated' },
  { key: 'auth_logged', label: 'Auth Attempt Logged', sub: 'Step 6 · duration: 5ms', status: 'matched' },
];

const MARP_SAMPLE = `---

## 🏗️ Project Setup Summary

| Component | Status | Detail |
|---|---|---|
| **BRD Source** | 🟢 Locked | Extracted via Agno Engine |
| **Logic Nodes** | 8 Active | Mapped to Webhook |
| **Agent Link** | 🔗 Connected | n8n / Agno |
| **Audit Status** | 🛡️ Shield Up | Real-time monitoring active |

**Connection Endpoint:**
\`https://sla.app/api/webhooks/{{project_id}}/n8n\`

---
`;

// ══════════════════════════════════════════════════════════════════
//  VIEW ROUTER
// ══════════════════════════════════════════════════════════════════

const VIEW_TITLES = {
  dashboard:   ['Drift Dashboard',       'Last sync: 2 minutes ago'],
  'logic-map': ['Logic Map',             'KYC Verification Agent · Run #1284'],
  marp:        ['Marp Previewer',        'Daily Audit Deck'],
  drifts:      ['Drift Alerts',          '5 open drifts'],
  studio:      ['Requirement Studio',    'BRD ingestion & agent linking'],
  remediation: ['Remediation Export',    'Generate fix artifacts from drift alerts'],
  analytics:   ['Analytics',             'Alignment trend · Last 30 days'],
  settings:    ['Settings',              'Notifications, thresholds & engine config'],
};

// Use the local port 8000 for development, or a custom backend URL if provided in localStorage
const API_BASE = (window.location.hostname === 'localhost') 
  ? 'http://localhost:8001' 
  : (localStorage.getItem('sla-backend-url') || 'https://sla-agno-engine.onrender.com');

function setState(update) {
  state = { ...state, ...update };
  renderApp();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('mobile-show');
}

function renderApp() {
  // Update view visibility
  document.querySelectorAll('.view').forEach(v => {
    v.classList.toggle('active', v.id === `view-${state.currentView}`);
  });

  // Update sidebar active state
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.getAttribute('data-view') === state.currentView);
  });

  // Update Header
  const [title, sub] = VIEW_TITLES[state.currentView] || ['SLA', ''];
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-sub').textContent = sub;

  // Render view-specific content
  switch (state.currentView) {
    case 'dashboard':   renderDashboard(); break;
    case 'logic-map':   renderLogicMap(); break;
    case 'drifts':      renderDriftCards(); break;
    case 'analytics':   renderAnalytics(); break;
    case 'studio':      renderStudio(); break;
    case 'remediation': renderRemediationQueue(); break;
    case 'marp':        initMarp(); break;
    case 'settings':    initSettings(); break;
  }
}

function showView(name) {
  if (state.currentView === name) return;
  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('mobile-show');
  state.currentView = name;
  renderApp();
}

function renderDashboard() {
  const tbody = document.getElementById('projects-tbody');
  
  // 1. Handle Recent Drifts (Feed)
  renderRecentDrifts();

  // 2. Handle Loading State
  if (state.isLoading) {
    // Show table skeleton/SVG
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding:60px 20px;text-align:center">
          <svg width="120" height="80" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:16px;opacity:0.6">
            <rect x="10" y="10" width="100" height="60" rx="4" stroke="var(--border)" stroke-width="2" stroke-dasharray="4 4"/>
            <path d="M30 30H90" stroke="var(--border)" stroke-width="2" stroke-linecap="round"/>
            <path d="M30 40H70" stroke="var(--border)" stroke-width="2" stroke-linecap="round"/>
            <path d="M30 50H80" stroke="var(--border)" stroke-width="2" stroke-linecap="round"/>
            <circle cx="100" cy="20" r="8" fill="var(--bg-2)" stroke="var(--border)" stroke-width="2"/>
            <path d="M100 16V24M96 20H104" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <div style="color:var(--text-2);font-weight:600">Initializing Logic Auditor…</div>
          <div style="color:var(--text-3);font-size:12px;margin-top:4px">Connecting to Agno engine & fetching projects</div>
        </td>
      </tr>`;
    
    // Show KPI skeletons
    document.querySelectorAll('.kpi-value').forEach(el => el.innerHTML = '<div class="skeleton skeleton-kpi"></div>');
    return;
  }

  const p = state.projects.find(x => x.uuid === state.selectedProjectUuid) || state.projects[0];
  
  // 3. Update KPIs
  document.getElementById('kpi-score').textContent = `${p.score}%`;
  document.getElementById('kpi-score').className = `kpi-value ${scoreColorClass(p.score)}`;
  document.getElementById('kpi-drifts').textContent = p.drifts;
  document.getElementById('kpi-critical').textContent = p.critical;
  document.getElementById('kpi-executions').textContent = p.audits.toLocaleString();
  document.getElementById('kpi-latency').textContent = '1.2s';

  // 4. Update Project Table
  if (state.projects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding:80px 20px;text-align:center">
          <svg width="160" height="100" viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:20px">
            <path d="M20 80H140" stroke="var(--border)" stroke-width="2" stroke-linecap="round"/>
            <rect x="40" y="20" width="80" height="50" rx="8" fill="var(--bg-1)" stroke="var(--border)" stroke-width="2"/>
            <path d="M60 40H100" stroke="var(--border)" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
            <path d="M60 50H85" stroke="var(--border)" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
            <circle cx="130" cy="30" r="15" fill="rgba(56, 139, 253, 0.1)" stroke="var(--blue)" stroke-width="2" stroke-dasharray="3 3"/>
            <path d="M130 24V36M124 30H136" stroke="var(--blue)" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <h3 style="color:var(--text-1);margin-bottom:8px">No Projects Found</h3>
          <p style="color:var(--text-3);font-size:14px;max-width:320px;margin:0 auto">Start by creating a project in the Requirement Studio to begin semantic auditing.</p>
        </td>
      </tr>`;
    return;
  }
  tbody.innerHTML = state.projects.map(p => `
    <tr onclick="setState({selectedProjectUuid: '${p.uuid}'})" style="cursor:pointer" class="${p.uuid === state.selectedProjectUuid ? 'active-row' : ''}">
      <td style="font-weight:600;color:var(--text-1)">${p.name}</td>
      <td>${toolBadge(p.tool)}</td>
      <td>
        <div class="score-bar-wrap">
          <div class="score-bar">
            <div class="score-bar-fill" style="width:${p.score}%;background:${scoreColor(p.score)}"></div>
          </div>
        </div>
      </td>
      <td style="font-family:'JetBrains Mono',monospace;font-weight:700;color:${scoreColor(p.score)}">${p.score}%</td>
      <td>${p.critical > 0 ? `<span class="badge badge-red">${p.critical}</span>` : '—'}</td>
      <td>${p.status === 'active' ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-grey">Paused</span>'}</td>
    </tr>`).join('');
}

function renderRecentDrifts() {
  const feed = document.getElementById('drift-feed');
  if (!feed) return;

  if (state.isLoading) {
    feed.innerHTML = `
      <div style="padding:40px;text-align:center;background:var(--bg-1);border-radius:12px;opacity:0.5">
        <svg width="40" height="40" viewBox="0 0 50 50">
          <circle cx="25" cy="25" r="20" fill="none" stroke="var(--border)" stroke-width="4" />
          <circle cx="25" cy="25" r="20" fill="none" stroke="var(--blue)" stroke-width="4" stroke-dasharray="31.4 31.4">
            <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
          </circle>
        </svg>
        <div style="margin-top:12px;font-size:12px;color:var(--text-3)">Loading recent activity…</div>
      </div>`;
    return;
  }

  // Use state.drifts or the sample DRIFTS if project matches
  const project = state.projects.find(p => p.uuid === state.selectedProjectUuid);
  const projectName = project ? project.name : (state.projects[0] ? state.projects[0].name : '');
  const recent = DRIFTS.filter(d => d.project === projectName).slice(0, 3);

  if (recent.length === 0) {
    feed.innerHTML = `
      <div style="padding:48px 24px;text-align:center;background:var(--bg-1);border-radius:12px;border:1px dashed var(--border);position:relative;overflow:hidden">
        <!-- Vector Line Graphic -->
        <svg width="100%" height="60" viewBox="0 0 400 60" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:20px;opacity:0.3">
          <path d="M0 45C50 45 70 15 120 15C170 15 190 45 240 45C290 45 310 15 360 15C410 15 430 45 480 45" stroke="var(--border)" stroke-width="1"/>
          <path d="M0 30C40 30 60 10 100 10C140 10 160 30 200 30C240 30 260 10 300 10C340 10 360 30 400 30" stroke="var(--blue)" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 6"/>
          <circle cx="100" cy="10" r="3" fill="var(--blue)"/>
          <circle cx="300" cy="10" r="3" fill="var(--blue)"/>
        </svg>
        
        <div style="color:var(--text-1);font-weight:600;margin-bottom:6px;position:relative;z-index:2">No logic drifts in this cycle</div>
        <p style="color:var(--text-3);font-size:13px;max-width:340px;margin:0 auto 18px;position:relative;z-index:2">The agent logic path is currently following the 100% established business logic. No corrective actions are required at this time.</p>
        <button class="btn-ghost" style="font-size:12px;position:relative;z-index:2" onclick="showView('drifts')">Review Historical Audits <i class="fa-solid fa-arrow-right"></i></button>
      </div>`;
    return;
  }

  feed.innerHTML = recent.map(d => buildDriftCardHTML(d, true)).join('');
}

// Skeletons removed in favor of SVG empty states

function toolBadge(tool) {
  const map = { n8n: 'blue', agno: 'purple', zapier: 'grey' };
  return `<span class="badge badge-${map[tool] || 'grey'}">${tool.toUpperCase()}</span>`;
}

function scoreColorClass(s) {
  if (s >= 85) return 'score-good';
  if (s >= 70) return 'score-warn';
  return 'score-danger';
}

function scoreColor(s) {
  if (s >= 85) return 'var(--cyan)';
  if (s >= 70) return 'var(--amber)';
  return 'var(--red)';
}

function severityBadge(sev) {
  const map = {
    critical: 'badge badge-red',
    high:     'badge badge-amber',
    medium:   'badge badge-blue',
    low:      'badge badge-grey',
  };
  return `<span class="${map[sev] || 'badge badge-grey'}">${sev.toUpperCase()}</span>`;
}

function driftTypeLabel(type) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function renderStudio() {
  const select = document.getElementById('studio-project-select');
  if (select) {
    select.innerHTML = state.projects.map(p => `<option value="${p.uuid}" ${p.uuid === state.selectedProjectUuid ? 'selected' : ''}>${p.name}</option>`).join('');
    select.onchange = (e) => setState({ selectedProjectUuid: e.target.value });
  }
  
  if (state.reqNodes.length > 0) {
    document.getElementById('studio-parse-grid').style.display = 'grid';
    renderReqNodes();
  }
}

function renderDriftFeed() {
  const feed = document.getElementById('drift-feed');
  feed.innerHTML = DRIFTS.slice(0, 4).map(d => buildDriftCardHTML(d, true)).join('');
}

// ══════════════════════════════════════════════════════════════════
//  DRIFT CARD BUILDER
// ══════════════════════════════════════════════════════════════════

function buildDriftCardHTML(d, compact = false) {
  const severityIcons = {
    critical: '<i class="fa-solid fa-circle-xmark" style="color:var(--red)"></i>',
    high:     '<i class="fa-solid fa-circle-exclamation" style="color:var(--amber)"></i>',
    medium:   '<i class="fa-solid fa-circle-dot" style="color:var(--blue)"></i>',
    low:      '<i class="fa-regular fa-circle" style="color:var(--text-3)"></i>',
  };
  const icon = severityIcons[d.severity] || severityIcons.low;

  return `
    <div class="drift-card ${d.severity}" data-severity="${d.severity}">
      <div class="drift-card-header">
        <div>
          <div class="drift-type-label">${icon} ${driftTypeLabel(d.drift_type)}</div>
          <div class="drift-title">${d.title}</div>
        </div>
        <div class="drift-meta">
          ${severityBadge(d.severity)}
          <span class="mono" style="color:var(--text-3);font-size:11px">${d.time_ago}</span>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <span class="badge badge-grey"><span class="mono">${d.execution_id}</span></span>
        <span style="font-size:12px;color:var(--text-3)">${d.project}</span>
        <span class="similarity-pill">similarity: ${(d.similarity_score * 100).toFixed(0)}%</span>
      </div>

      <div class="drift-body">
        <div>
          <div class="drift-col-label brd"><i class="fa-solid fa-clipboard-list"></i> BRD Expectation</div>
          <div class="drift-text">${d.brd_expectation}</div>
        </div>
        <div>
          <div class="drift-col-label actual"><i class="fa-solid fa-robot"></i> Actual Behaviour</div>
          <div class="drift-text">${d.actual_behaviour}</div>
        </div>
      </div>

      ${compact ? '' : `
      <div class="drift-explanation">
        <strong><i class="fa-solid fa-magnifying-glass"></i> Root Cause:</strong> ${d.ai_explanation}
      </div>
      <div class="drift-remediation"><i class="fa-solid fa-circle-check"></i> <strong>Fix:</strong> ${d.remediation_hint}</div>
      `}
    </div>`;
}

// ══════════════════════════════════════════════════════════════════
//  DRIFT CARDS VIEW
// ══════════════════════════════════════════════════════════════════

let allDrifts = DRIFTS;

function renderDriftCards(drifts = DRIFTS) {
  const grid = document.getElementById('drift-cards-grid');
  if (!grid) return;
  
  if (drifts.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:80px 20px;background:var(--bg-1);border-radius:12px;border:1px dashed var(--border)">
        <i class="fa-solid fa-shield-check" style="font-size:48px;color:var(--cyan);margin-bottom:16px;display:block"></i>
        <h3 style="color:var(--text-1)">No Drifts Detected</h3>
        <p style="color:var(--text-3);max-width:400px;margin:8px auto">The Agno engine hasn't found any semantic drifts for the selected filters. Your agent logic is currently aligned with business requirements.</p>
      </div>`;
    return;
  }
  
  grid.innerHTML = drifts.map(d => buildDriftCardHTML(d, false)).join('');
}

function filterDrifts(severity, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const filtered = severity === 'all' ? DRIFTS : DRIFTS.filter(d => d.severity === severity);
  renderDriftCards(filtered);
}

// ══════════════════════════════════════════════════════════════════
//  LOGIC MAP
// ══════════════════════════════════════════════════════════════════

function nodeStatusIcon(status) {
  return {
    matched: '<i class="fa-solid fa-circle-check" style="color:var(--cyan)"></i>',
    skipped: '<i class="fa-solid fa-ban" style="color:var(--red)"></i>',
    violated: '<i class="fa-solid fa-triangle-exclamation" style="color:var(--amber)"></i>',
    pending: '<i class="fa-regular fa-circle" style="color:var(--text-3)"></i>',
  }[status] || '<i class="fa-regular fa-circle" style="color:var(--text-3)"></i>';
}

function renderLogicMap() {
  const brdContainer   = document.getElementById('brd-nodes');
  const agentContainer = document.getElementById('agent-nodes');

  brdContainer.innerHTML = BRD_NODES.map(n => `
    <div class="logic-node ${n.status}">
      <div class="node-status">${nodeStatusIcon(n.status)}</div>
      <div class="node-label">${n.label}</div>
      <div class="node-sub mono">${n.sub}</div>
    </div>`).join('');

  agentContainer.innerHTML = AGENT_NODES.map(n => `
    <div class="logic-node ${n.status}">
      <div class="node-status">${nodeStatusIcon(n.status)}</div>
      <div class="node-label">${n.label}</div>
      <div class="node-sub mono">${n.sub}</div>
    </div>`).join('');
}

// ══════════════════════════════════════════════════════════════════
//  MARP PREVIEWER
// ══════════════════════════════════════════════════════════════════

function initMarp() {
  const editor = document.getElementById('marp-editor');
  if (!editor.value) editor.value = MARP_SAMPLE;
  renderMarp();
}

function renderMarp() {
  const raw = document.getElementById('marp-editor').value;
  // Strip frontmatter
  const body = raw.replace(/^---[\s\S]*?---\n/, '').trim();

  // Split into slides on ---
  const slides = body.split(/\n---\n/).map(s => s.trim());
  document.getElementById('slide-counter').textContent = `Slide 1 / ${slides.length}`;

  // Render first slide with basic Markdown-to-HTML
  const slide = document.getElementById('marp-slide');
  slide.innerHTML = parseMarkdownSlide(slides[0]);
}

function parseMarkdownSlide(md) {
  return md
    .replace(/^# (.+)$/gm,    '<h1>$1</h1>')
    .replace(/^## (.+)$/gm,   '<h2>$1</h2>')
    .replace(/^### (.+)$/gm,  '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/`([^`]+)`/g,    '<code>$1</code>')
    .replace(/^> (.+)$/gm,    '<blockquote>$1</blockquote>')
    .replace(/^\| (.+) \|$/gm, (row) => {
      const cells = row.split('|').map(c => c.trim()).filter(Boolean);
      return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
    })
    .replace(/(<tr>[\s\S]+?<\/tr>)/g, '<table>$1</table>')
    .replace(/^- (.+)$/gm,    '<li>$1</li>')
    .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<[hultbp])/gm, '<p>')
    .replace(/(?<![>])$/gm, '</p>');
}

// ══════════════════════════════════════════════════════════════════
//  AUDIT SIMULATION
// ══════════════════════════════════════════════════════════════════

function simulateAudit() {
  const btn = document.getElementById('run-audit-btn') || document.querySelector('.btn-primary');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Auditing…';
  btn.disabled = true;

  setTimeout(() => {
    const pIndex = state.projects.findIndex(x => x.uuid === state.selectedProjectUuid);
    if (pIndex !== -1) {
      const p = state.projects[pIndex];
      // Simulate slight changes
      p.score = Math.min(100, Math.max(0, p.score + (Math.random() * 4 - 2)));
      p.score = parseFloat(p.score.toFixed(1));
      p.audits++;
      
      const foundNewDrift = Math.random() > 0.6;
      if (foundNewDrift) {
        p.drifts++;
        // Generate a random new drift
        const newDrift = {
          id: `D-${Math.floor(Math.random() * 9000 + 1000)}`,
          severity: Math.random() > 0.5 ? 'critical' : 'high',
          drift_type: 'runtime_deviation',
          title: 'Unexpected Logic Branch Detected',
          project: p.name,
          execution_id: `exec_${Math.random().toString(36).substr(2, 5)}`,
          brd_expectation: 'The agent must strictly follow the defined decision tree for high-risk approvals.',
          actual_behaviour: 'Agent bypassed the risk-scoring step and moved directly to approval due to a logic loop.',
          ai_explanation: 'LLM self-correction logic interpreted a lack of response from the scoring engine as a fallback pass.',
          remediation_hint: 'Update system prompt to explicitly require external validation before high-risk state transitions.',
          similarity_score: (Math.random() * 0.3).toFixed(2),
          time_ago: 'Just now'
        };
        // Add to global DRIFTS array too so it persists during view switches
        DRIFTS.unshift(newDrift);
      }
      
      state.projects[pIndex] = { ...p };
      setState({ projects: [...state.projects], drifts: [...DRIFTS] });
      
      if (foundNewDrift) {
        showToast(`Violation detected in ${p.name}!`, 'fa-triangle-exclamation', 'var(--red)');
      } else {
        showToast(`Audit complete: 100% compliance for ${p.name}`, 'fa-circle-check', 'var(--cyan)');
      }
    }
    
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }, 1800);
}

// ══════════════════════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════════════════════
function showToast(msg, icon = 'fa-circle-check', color = 'var(--cyan)') {
  const t = document.getElementById('toast');
  t.innerHTML = `<i class="fa-solid ${icon}" style="color:${color}"></i> ${msg}`;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ══════════════════════════════════════════════════════════════════
//  ANALYTICS
// ══════════════════════════════════════════════════════════════════
const ANALYTICS_PROJECTS = [
  { name: 'Customer Onboarding', color: '#388bfd', data: [88,90,91,89,92,94,92,93,91,92,90,91,93,94,92,91,90,92,93,94,93,92,91,92,93,94,92,91,92,93] },
  { name: 'KYC Verification',    color: '#f85149', data: [82,80,78,75,74,73,75,74,72,71,70,72,73,74,73,72,71,70,72,73,74,73,72,71,73,74,75,74,73,74] },
  { name: 'Invoice Approval',    color: '#3fb950', data: [85,86,87,88,87,88,89,88,87,88,89,88,87,86,87,88,89,88,87,88,89,88,87,86,87,88,89,88,87,88] },
  { name: 'Fraud Detection',     color: '#d29922', data: [60,58,57,56,55,54,56,55,54,53,55,56,57,55,54,55,56,55,54,55,56,57,55,54,55,56,57,55,54,55] },
  { name: 'Support Triage',      color: '#a371f7', data: [94,95,96,95,96,97,96,95,96,97,96,95,96,97,96,95,96,97,96,95,96,97,96,95,96,97,96,95,96,97] },
];

function renderAnalytics() {
  // KPI row
  const kpiData = [
    { label: 'Avg Alignment Score', value: '81.3%', delta: '<i class="fa-solid fa-arrow-trend-up"></i> +1.2%', cls: 'score-good' },
    { label: 'Total Drifts (30d)',  value: '247',   delta: '<i class="fa-solid fa-arrow-down"></i> -12 vs prev', cls: '' },
    { label: 'Critical Violations', value: '18',   delta: '<i class="fa-solid fa-arrow-down"></i> -3 vs prev',  cls: 'score-danger' },
    { label: 'Agent Executions',    value: '5,284', delta: '<i class="fa-solid fa-arrow-up"></i> +843',         cls: '' },
  ];
  document.getElementById('analytics-kpi-row').innerHTML = kpiData.map(k => `
    <div class="analytics-kpi-card">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value ${k.cls}">${k.value}</div>
      <div class="kpi-delta positive" style="margin-top:6px;font-size:12px">${k.delta}</div>
    </div>`).join('');

  // Legend
  document.getElementById('chart-legend').innerHTML = ANALYTICS_PROJECTS.map(p =>
    `<div class="legend-item"><div class="legend-dot" style="background:${p.color}"></div>${p.name}</div>`).join('');

  // Draw SVG trend chart
  drawTrendChart();

  // Breakdown bars
  const breakdown = [
    { label: 'Skipped Step',      count: 89,  color: 'var(--red)',    pct: 36 },
    { label: 'Constraint Violated', count: 72, color: 'var(--amber)', pct: 29 },
    { label: 'Wrong Order',       count: 51,  color: 'var(--blue)',   pct: 21 },
    { label: 'Data Integrity',    count: 23,  color: 'var(--purple)', pct: 9  },
    { label: 'Incomplete Exec',   count: 12,  color: 'var(--text-3)', pct: 5  },
  ];
  document.getElementById('breakdown-bars').innerHTML = breakdown.map(b => `
    <div class="breakdown-row">
      <div class="breakdown-label"><span>${b.label}</span><span>${b.count}</span></div>
      <div class="breakdown-track"><div class="breakdown-fill" style="width:${b.pct}%;background:${b.color}"></div></div>
    </div>`).join('');

  // Sparklines
  document.getElementById('sparkline-grid').innerHTML = ANALYTICS_PROJECTS.map(p => {
    const cur  = p.data[p.data.length - 1];
    const prev = p.data[p.data.length - 8];
    const diff = (cur - prev).toFixed(1);
    const cls  = cur >= 85 ? 'score-good' : cur >= 70 ? 'score-warn' : 'score-danger';
    const trendCls = diff >= 0 ? 'positive' : 'negative';
    return `<div class="sparkline-card">
      <div class="sparkline-name">${p.name}</div>
      <div class="sparkline-score ${cls}">${cur}%</div>
      <div class="sparkline-trend kpi-delta ${trendCls}">${diff >= 0 ? '+' : ''}${diff}% last 7d</div>
      ${drawSparklineSVG(p.data, p.color)}
    </div>`;
  }).join('');
}

function drawTrendChart() {
  const svg = document.getElementById('trend-chart');
  const W = svg.parentElement.clientWidth || 800, H = 260;
  const PAD = { top: 20, right: 20, bottom: 36, left: 40 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top  - PAD.bottom;
  const days = 30;
  const minY = 40, maxY = 100;

  const xScale = i  => PAD.left + (i / (days - 1)) * cW;
  const yScale = v  => PAD.top  + cH - ((v - minY) / (maxY - minY)) * cH;

  let html = '';
  // Grid lines
  [50,60,70,80,90,100].forEach(v => {
    const y = yScale(v);
    html += `<line class="chart-grid-line" x1="${PAD.left}" y1="${y}" x2="${W-PAD.right}" y2="${y}" />`;
    html += `<text class="chart-axis-label" x="${PAD.left - 6}" y="${y + 4}" text-anchor="end">${v}</text>`;
  });
  // X axis labels (every 5 days)
  for (let i = 0; i < days; i += 5) {
    html += `<text class="chart-axis-label" x="${xScale(i)}" y="${H - 8}" text-anchor="middle">D-${29-i}</text>`;
  }
  // Project lines
  ANALYTICS_PROJECTS.forEach(p => {
    const pts = p.data.map((v,i) => `${xScale(i)},${yScale(v)}`).join(' ');
    html += `<polyline class="chart-line" points="${pts}" stroke="${p.color}" />`;
    // End dot
    const lx = xScale(days-1), ly = yScale(p.data[days-1]);
    html += `<circle cx="${lx}" cy="${ly}" r="4" fill="${p.color}" />`;
  });

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = html;
}

function drawSparklineSVG(data, color) {
  const W = 160, H = 44, pad = 4;
  const min = Math.min(...data), max = Math.max(...data);
  const xS = i => pad + (i / (data.length - 1)) * (W - pad * 2);
  const yS = v => H - pad - ((v - min) / ((max - min) || 1)) * (H - pad * 2);
  const pts = data.map((v,i) => `${xS(i)},${yS(v)}`).join(' ');
  return `<svg class="sparkline" viewBox="0 0 ${W} ${H}">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" />
    <circle cx="${xS(data.length-1)}" cy="${yS(data[data.length-1])}" r="3" fill="${color}" />
  </svg>`;
}

// ══════════════════════════════════════════════════════════════════
//  REQUIREMENT STUDIO
// ══════════════════════════════════════════════════════════════════
const SAMPLE_BRD_TEXT = `Business Requirements Document
KYC Verification Agent v2.1

§2.1 Authentication Requirements
  REQ-001: The agent MUST verify user identity via OTP before any data access.
  REQ-002: Authentication attempts MUST be logged with timestamp and IP.
  REQ-003: Failed attempts MUST be rate-limited to 3 per 15 minutes.
  REQ-004: JWT tokens MUST expire within 1 hour of issuance.
  REQ-005: Raw credentials MUST NOT appear in any log output.

§2.2 Data Access Requirements
  REQ-006: Dataset permissions MUST be verified before query execution.
  REQ-007: Row-level security filters MUST be applied to all queries.
  REQ-008: Response payload MUST NOT exceed 10MB per request.`;

const SAMPLE_REQUIREMENTS = [
  { key: 'REQ-001', text: 'The agent MUST verify user identity via OTP before any data access.', status: 'pending' },
  { key: 'REQ-002', text: 'Authentication attempts MUST be logged with timestamp and IP.',        status: 'pending' },
  { key: 'REQ-003', text: 'Failed attempts MUST be rate-limited to 3 per 15 minutes.',           status: 'pending' },
  { key: 'REQ-004', text: 'JWT tokens MUST expire within 1 hour of issuance.',                   status: 'pending' },
  { key: 'REQ-005', text: 'Raw credentials MUST NOT appear in any log output.',                  status: 'pending' },
  { key: 'REQ-006', text: 'Dataset permissions MUST be verified before query execution.',         status: 'pending' },
  { key: 'REQ-007', text: 'Row-level security filters MUST be applied to all queries.',           status: 'pending' },
  { key: 'REQ-008', text: 'Response payload MUST NOT exceed 10MB per request.',                  status: 'pending' },
];

let reqNodes = [];

async function performBRDParse(file, text = null) {
  const dz = document.getElementById('drop-zone');
  const badge = document.getElementById('parse-status-badge');
  
  // FORCE CLEAR: Remove all old/static points immediately
  reqNodes = [];
  renderReqNodes();
  
  dz.classList.add('has-file');
  dz.onclick = null; // prevent re-triggering click while parsing
  dz.innerHTML = `<div class="drop-zone-inner"><div class="drop-icon" style="color:var(--cyan)"><i class="fa-solid fa-file-circle-check"></i></div><div class="drop-title">${file ? file.name : 'Raw Text'}</div><div class="drop-sub"><i class="fa-solid fa-spinner fa-spin"></i>&nbsp;Parsing with Agno engine…</div></div>`;

  // Show remove button
  const fileActions = document.getElementById('brd-file-actions');
  if (fileActions) fileActions.style.display = 'block';

  const formData = new FormData();
  const projectSelect = document.getElementById('studio-project-select');
  const projectUuid = projectSelect ? projectSelect.value : '';
  
  if (!projectUuid || !projectUuid.includes('-')) {
    showToast('No valid project selected. Please select a project first.', 'fa-circle-xmark', 'var(--amber)');
    resetDropZone();
    return;
  }

  formData.append('project_uuid', projectUuid);
  if (file) formData.append('brd_file', file);
  if (text) formData.append('brd_text', text);

  try {
    const response = await fetch(`${API_BASE}/requirements/ingest`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json'
      },
      body: formData
    });

    if (!response.ok) {
      const rawText = await response.text();
      let msg = `Server Error (HTTP ${response.status})`;
      try {
        const errJson = JSON.parse(rawText);
        if (errJson.detail) {
          msg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        } else if (errJson.errors) {
          msg = Object.values(errJson.errors).flat().join(' | ');
        } else {
          msg = errJson.error || errJson.message || msg;
        }
      } catch(e) {
        msg = `HTTP ${response.status}: ${rawText.substring(0, 80)}`;
      }
      throw new Error(msg);
    }

    const data = await response.json();

    const grid = document.getElementById('studio-parse-grid');
    grid.style.display = 'grid';
    state.currentRawContent = data.raw_content;
    document.getElementById('parse-raw-content').textContent = state.currentRawContent;
    
    reqNodes = data.requirements.map(r => ({
      ...r,
      status: 'pending'
    }));

    renderReqNodes();

    // Update drop zone to show success state
    dz.innerHTML = `<div class="drop-zone-inner"><div class="drop-icon" style="color:var(--cyan)"><i class="fa-solid fa-file-circle-check"></i></div><div class="drop-title">${file ? file.name : 'Raw Text'}</div><div class="drop-sub" style="color:var(--cyan)"><i class="fa-solid fa-circle-check"></i>&nbsp;${reqNodes.length} requirements extracted</div></div>`;

    const badge = document.getElementById('parse-status-badge');
    badge.className = 'parse-status-badge done';
    badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Done';
    document.getElementById('req-count-badge').textContent = `${reqNodes.length} found`;
    showToast('BRD parsed successfully!', 'fa-circle-check', 'var(--cyan)');

  } catch (err) {
    let friendlyMsg = err.message;
    if (err.message === 'Failed to fetch') {
      friendlyMsg = 'Cannot reach backend — is the Python engine running on port 8001?';
    }
    showToast('Parsing failed: ' + friendlyMsg, 'fa-circle-xmark', 'var(--red)');
    resetDropZone();
  }
}

function resetDropZone() {
  const dz = document.getElementById('drop-zone');
  dz.classList.remove('has-file');
  dz.onclick = () => document.getElementById('brd-file-input').click();
  dz.innerHTML = `
    <div class="drop-zone-inner">
      <div class="drop-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
      <div class="drop-title">Drop your BRD here</div>
      <div class="drop-sub">PDF · DOCX · Markdown · TXT &nbsp;—&nbsp; or click to browse</div>
      <div class="drop-formats">
        <span class="fmt-badge"><i class="fa-solid fa-file-pdf"></i> PDF</span>
        <span class="fmt-badge"><i class="fa-solid fa-file-word"></i> DOCX</span>
        <span class="fmt-badge"><i class="fa-brands fa-markdown"></i> MD</span>
        <span class="fmt-badge"><i class="fa-solid fa-file-lines"></i> TXT</span>
      </div>
    </div>
    <input type="file" id="brd-file-input" accept=".pdf,.docx,.md,.txt" style="display:none" onchange="handleFileSelect(this)" />`;
  const fileActions = document.getElementById('brd-file-actions');
  if (fileActions) fileActions.style.display = 'none';
  const grid = document.getElementById('studio-parse-grid');
  if (grid) grid.style.display = 'none';
}

function removeBRDFile(e) {
  e.stopPropagation();
  resetDropZone();
  showToast('File removed. You can upload a new BRD.', 'fa-trash', 'var(--amber)');
}


function handleDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) performBRDParse(file);
}
function handleFileSelect(input) {
  if (input.files[0]) performBRDParse(input.files[0]);
}

function renderReqNodes() {
  const container = document.getElementById('req-node-list');
  const countBadge = document.getElementById('req-count-badge');
  
  if (countBadge) countBadge.textContent = `${reqNodes.length} found`;
  
  if (reqNodes.length === 0) {
    container.innerHTML = '<div style="padding:48px;text-align:center;color:var(--text-3);border:1px dashed var(--border);border-radius:12px">No requirements yet. Upload a BRD or click "+ Add" to start.</div>';
    return;
  }
  container.innerHTML = reqNodes.map((r, i) => `
    <div class="req-node ${r.status}" id="req-${i}" onclick="highlightInBRD('${r.requirement_text.replace(/'/g, "\\'")}')">
      <div class="req-node-top">
        <span class="req-node-key">${r.node_key}</span>
        <span class="badge badge-${r.priority === 'critical' ? 'red' : r.priority === 'high' ? 'amber' : 'blue'}">${r.priority.toUpperCase()}</span>
      </div>
      <div class="req-node-text">${r.requirement_text}</div>
      <div class="req-node-meta">
        <span class="section-badge">${r.category || 'Functional'}</span>
        ${r.section_reference ? `<span class="section-badge">${r.section_reference}</span>` : ''}
      </div>
      <div class="req-node-actions" onclick="event.stopPropagation()">
        ${r.status !== 'active' ? `<button class="btn-confirm" onclick="activateReq(${i})"><i class="fa-solid fa-play"></i> Activate</button>` : ''}
        ${r.status === 'active' ? `<button class="btn-lock" style="background:var(--blue);color:white" onclick="ignoreReq(${i})"><i class="fa-solid fa-ban"></i> Ignore</button>` : ''}
        ${r.status === 'pending' ? `<button onclick="ignoreReq(${i})"><i class="fa-solid fa-eye-slash"></i> Ignore</button>` : ''}
        <button onclick="editReq(${i})"><i class="fa-solid fa-pen"></i> Edit</button>
        <button class="btn-ghost" style="color:var(--red); border-color:rgba(255,100,100,0.2)" onclick="removeReq(${i})"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    </div>`).join('');
}

function highlightInBRD(text) {
  const container = document.getElementById('parse-raw-content');
  const source = state.currentRawContent;
  if (!source) return;

  // Find best match (try whole string first, then chunks)
  let index = source.toLowerCase().indexOf(text.toLowerCase());
  let matchedText = text;

  if (index === -1) {
    // Try first 30 chars if full text doesn't match exactly (due to AI rephrasing)
    matchedText = text.substring(0, 30);
    index = source.toLowerCase().indexOf(matchedText.toLowerCase());
  }

  if (index !== -1) {
    const before = source.substring(0, index);
    const match = source.substring(index, index + matchedText.length);
    const after = source.substring(index + matchedText.length);

    container.innerHTML = `${escapeHTML(before)}<span class="brd-highlight">${escapeHTML(match)}</span>${escapeHTML(after)}`;
    
    const el = container.querySelector('.brd-highlight');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function escapeHTML(str) {
  const p = document.createElement('p');
  p.textContent = str;
  return p.innerHTML;
}

function addNewRequirement() {
  const newNode = {
    node_key: `REQ_${String(reqNodes.length + 1).padStart(3, '0')}`,
    priority: 'medium',
    requirement_text: 'Enter new requirement details...',
    category: 'Functional',
    status: 'pending'
  };
  reqNodes.unshift(newNode);
  renderReqNodes();
  editReq(0); // Open editor for the new item
}

function removeReq(i) {
  if (confirm('Are you sure you want to permanently remove this requirement?')) {
    reqNodes.splice(i, 1);
    renderReqNodes();
    showToast('Requirement deleted', 'fa-trash', 'var(--red)');
  }
}

function activateReq(i) { reqNodes[i].status = 'active'; renderReqNodes(); }
function ignoreReq(i)   { reqNodes[i].status = 'ignored'; renderReqNodes(); }
function editReq(i) {
  const r = reqNodes[i];
  document.getElementById('edit-req-index').value = i;
  document.getElementById('edit-req-text').value = r.requirement_text;
  document.getElementById('edit-req-priority').value = r.priority;
  document.getElementById('edit-req-category').value = r.category || 'Functional';
  document.getElementById('edit-modal').classList.add('open');
}

function saveEditReq() {
  const i = document.getElementById('edit-req-index').value;
  const text = document.getElementById('edit-req-text').value;
  const prio = document.getElementById('edit-req-priority').value;
  const cat = document.getElementById('edit-req-category').value;
  
  if (text) {
    reqNodes[i].requirement_text = text;
    reqNodes[i].priority = prio;
    reqNodes[i].category = cat;
    renderReqNodes();
    closeEditModal();
    showToast('Requirement updated!', 'fa-circle-check', 'var(--cyan)');
  }
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('open');
}
function lockAllRequirements() {
  const activeCount = reqNodes.filter(r => r.status === 'active').length;
  if (activeCount === 0) {
    showToast('Please activate at least one requirement!', 'fa-triangle-exclamation', 'var(--amber)');
    return;
  }
  showToast(`${activeCount} requirements locked and activated!`, 'fa-lock', 'var(--blue)');
}
function copyField(id) {
  const el = document.getElementById(id);
  const val = el.type === 'password' ? 'sk_sla_a7f3b2c9d1e4f8a0b5c2d6e9f0a1b2c3d4e5f6a7' : el.value;
  navigator.clipboard.writeText(val).then(() => showToast('Copied to clipboard!'));
}
function toggleApiKey() {
  const inp = document.getElementById('api-key');
  const eye = document.getElementById('api-key-eye');
  if (inp.type === 'password') {
    inp.type = 'text'; inp.value = 'sk_sla_a7f3b2c9d1e4f8a0b5c2d6e9f0a1b2c3d4e5f6a7';
    eye.className = 'fa-solid fa-eye-slash';
  } else {
    inp.type = 'password'; inp.value = 'sk_sla_••••••••••••••••••••••••••••••';
    eye.className = 'fa-solid fa-eye';
  }
}

// ══════════════════════════════════════════════════════════════════
//  REMEDIATION EXPORT
// ══════════════════════════════════════════════════════════════════
let selectedDrift = null;
let currentRemTab = 'n8n';

function renderRemediationQueue() {
  const list = document.getElementById('rem-drift-list');
  if (DRIFTS.length === 0) {
    list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-3)"><i class="fa-solid fa-circle-check" style="display:block;margin-bottom:8px"></i> No remediation items.</div>';
    return;
  }
  list.innerHTML = DRIFTS.map((d,i) => `
    <div class="rem-drift-item ${d.severity}" onclick="selectRemDrift(${i}, this)">
      <div class="rem-drift-item-title">${d.title}</div>
      <div class="rem-drift-item-meta">
        <span>${severityBadge(d.severity)}</span>
        <span>${d.project}</span>
        <span style="margin-left:auto">${d.time_ago}</span>
      </div>
    </div>`).join('');
}

function selectRemDrift(i, el) {
  document.querySelectorAll('.rem-drift-item').forEach(x => x.classList.remove('selected'));
  el.classList.add('selected');
  selectedDrift = DRIFTS[i];
  document.getElementById('rem-export-placeholder').style.display = 'none';
  document.getElementById('rem-export-content').style.display   = 'flex';
  document.getElementById('rem-export-title').textContent = selectedDrift.title;
  currentRemTab = 'n8n';
  document.querySelectorAll('.rem-export-tabs .rem-tab').forEach((t,ti) => t.classList.toggle('active', ti===0));
  updateRemCode();
}

function switchRemTab(tab, btn) {
  currentRemTab = tab;
  btn.closest('.rem-export-tabs, .modal-tabs').querySelectorAll('.rem-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  updateRemCode();
}
function switchModalTab(tab, btn) { switchRemTab(tab, btn); document.getElementById('modal-code-block').textContent = getRemCode(); }

function getRemCode() {
  if (!selectedDrift) return '';
  const d = selectedDrift;
  if (currentRemTab === 'n8n') return JSON.stringify({
    name: `SLA Fix: ${d.title}`,
    type: 'n8n-nodes-base.httpRequest',
    parameters: { method:'POST', url:'{{$env.SLA_WEBHOOK_URL}}', body: { fix_id: d.id, project: d.project, remediation: d.remediation_hint, applied_by:'{{$json.user}}', timestamp:'{{$now}}' } },
    notes: `Auto-generated by Sentinel Logic Auditor\nDrift: ${d.id}\nSeverity: ${d.severity.toUpperCase()}\nBRD: ${d.brd_expectation}`,
  }, null, 2);
  if (currentRemTab === 'agno') return `from agno.agent import Agent
from agno.tools import tool

# SLA Auto-patch: ${d.title}
# Drift ID: ${d.id} | Severity: ${d.severity.toUpperCase()}

@tool
def apply_fix_${d.id.replace('-','_').toLowerCase()}(ctx):
    """
    BRD Violation: ${d.brd_expectation}
    Actual:        ${d.actual_behaviour}
    """
    # TODO: ${d.remediation_hint}
    raise NotImplementedError("Implement fix before deploying")

agent = Agent(tools=[apply_fix_${d.id.replace('-','_').toLowerCase()}])`;
  return `## Fix: ${d.title}\n\n**Drift ID:** \`${d.id}\`  \n**Severity:** ${d.severity.toUpperCase()}  \n**Project:** ${d.project}\n\n### BRD Expectation\n${d.brd_expectation}\n\n### Actual Behaviour\n${d.actual_behaviour}\n\n### Proposed Fix\n${d.remediation_hint}\n\n### Steps\n1. Review the affected component\n2. Implement the fix described above\n3. Add unit tests covering the BRD requirement\n4. Re-run SLA audit to verify alignment score improves`;
}

function updateRemCode() {
  const el = document.getElementById('rem-code-block');
  if (el) el.textContent = getRemCode();
}
function copyRemCode() {
  navigator.clipboard.writeText(getRemCode()).then(() => showToast('Code copied!'));
}
function downloadRemCode() {
  const ext = { n8n: 'json', agno: 'py', pr: 'md' }[currentRemTab];
  const blob = new Blob([getRemCode()], { type: 'text/plain' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `sla-fix-${selectedDrift?.id || 'export'}.${ext}` });
  a.click();
  showToast('File downloaded!');
}
function markResolved() {
  showToast('Drift marked as resolved!', 'fa-circle-check', 'var(--cyan)');
  document.getElementById('rem-export-placeholder').style.display = 'flex';
  document.getElementById('rem-export-content').style.display = 'none';
}

// Export modal (from drift alerts page)
function openExportModal(driftId) {
  selectedDrift = DRIFTS.find(d => d.id === driftId) || DRIFTS[0];
  currentRemTab = 'n8n';
  document.querySelectorAll('.modal-tabs .rem-tab').forEach((t,i) => t.classList.toggle('active', i===0));
  document.getElementById('modal-code-block').textContent = getRemCode();
  document.getElementById('export-modal').classList.add('open');
}
function closeExportModal(e, force) {
  if (force || (e && e.target.id === 'export-modal'))
    document.getElementById('export-modal').classList.remove('open');
}
function copyModalCode() {
  navigator.clipboard.writeText(document.getElementById('modal-code-block').textContent)
    .then(() => showToast('Copied!'));
}

// ══════════════════════════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════════════════════════
function initSettings() {
  document.getElementById('teams-toggle').addEventListener('change', function() {
    document.getElementById('teams-config').style.cssText = this.checked ? '' : 'opacity:0.4;pointer-events:none';
  });
  document.getElementById('slack-toggle').addEventListener('change', function() {
    document.getElementById('slack-config').style.cssText = this.checked ? '' : 'opacity:0.4;pointer-events:none';
  });
}
function testNotification(channel) {
  showToast(`Test notification sent to ${channel === 'slack' ? 'Slack' : 'Teams'}!`, 'fa-paper-plane', 'var(--blue)');
}
function saveSettings() {
  const settings = {
    slackEnabled: document.getElementById('slack-toggle').checked,
    slackWebhook: document.getElementById('slack-webhook').value,
    teamsEnabled: document.getElementById('teams-toggle').checked,
    minAlignment: document.getElementById('threshold-score').value,
    similarityAlert: document.getElementById('threshold-similarity').value,
    autoEscalate: document.getElementById('threshold-escalate').value,
    backendUrl: document.getElementById('settings-backend-url').value.replace(/\/$/, '') // Remove trailing slash
  };
  
  localStorage.setItem('sentinel-settings', JSON.stringify(settings));
  localStorage.setItem('sla-backend-url', settings.backendUrl);
  showToast('Settings saved successfully!', 'fa-floppy-disk', 'var(--cyan)');
}

function loadSettings() {
  const saved = localStorage.getItem('sentinel-settings');
  if (!saved) return;
  
  try {
    const settings = JSON.parse(saved);
    if (document.getElementById('slack-toggle')) {
      document.getElementById('slack-toggle').checked = settings.slackEnabled;
      document.getElementById('slack-webhook').value = settings.slackWebhook;
      document.getElementById('teams-toggle').checked = settings.teamsEnabled;
      document.getElementById('settings-backend-url').value = settings.backendUrl || '';
      
      // Update UI for ranges
      if (document.getElementById('threshold-score')) {
        document.getElementById('threshold-score').value = settings.minAlignment;
        document.getElementById('threshold-score-val').textContent = settings.minAlignment + '%';
      }
      if (document.getElementById('threshold-similarity')) {
        document.getElementById('threshold-similarity').value = settings.similarityAlert;
        document.getElementById('threshold-similarity-val').textContent = settings.similarityAlert + '%';
      }
      if (document.getElementById('threshold-escalate')) {
        document.getElementById('threshold-escalate').value = settings.autoEscalate;
        document.getElementById('threshold-escalate-val').textContent = settings.autoEscalate + 'h';
      }
    }
  } catch (e) {
    console.error('Failed to load settings', e);
  }
}

// ══════════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  loadSettings();
  renderApp();
  // Simulate initial load delay to show skeletons
  setTimeout(() => {
    setState({ isLoading: false });
  }, 1200);
});
