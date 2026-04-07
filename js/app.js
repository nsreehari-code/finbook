// app.js — Main initialization and event wiring

document.addEventListener('DOMContentLoaded', async () => {
  // Wire mobile nav hamburger
  const navScroll = document.getElementById('navScroll');
  const navOverlay = document.getElementById('navOverlay');
  const navHamburger = document.getElementById('navHamburger');

  function closeMobileNav() {
    navScroll.classList.remove('open');
    navOverlay.classList.remove('open');
  }

  navHamburger.addEventListener('click', () => {
    navScroll.classList.toggle('open');
    navOverlay.classList.toggle('open');
  });

  navOverlay.addEventListener('click', closeMobileNav);

  // Wire theme toggle (day/night)
  const themeToggle = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem('finbook_theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    if (next === 'light') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    localStorage.setItem('finbook_theme', next);
  });

  // Wire Bootstrap radio toggles for view switching
  document.querySelectorAll('input[name="aiView"]').forEach(radio => {
    radio.addEventListener('change', renderCurrentSection);
  });

  // Wire navigation (always)
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      const sectionId = btn.dataset.section;
      document.getElementById(sectionId).classList.add('active');
      currentSection = sectionId;
      updateHash();
      renderCurrentSection();
      closeMobileNav();
    });
  });

  // Wire filter changes
  document.getElementById('fyFilter').addEventListener('change', () => {
    const asOn = document.getElementById('sbAsOnDate');
    if (asOn) asOn.value = '';
    updateHash();
    renderCurrentSection();
  });
  document.getElementById('accountFilter').addEventListener('change', () => {
    selectedAccount = document.getElementById('accountFilter').value;
    populateFYFilter();
    restoreHashFY();
    updateHash();
    renderCurrentSection();
  });

  // Wire add buttons
  document.getElementById('addSalaryIncome').addEventListener('click', () => openModal('salaryIncome'));
  document.getElementById('addForeignIncome').addEventListener('click', () => openModal('foreignIncome'));
  document.getElementById('addPropertyIncome').addEventListener('click', () => openModal('propertyIncome'));
  document.getElementById('addCapitalGains').addEventListener('click', () => openModal('capitalGains'));
  document.getElementById('addOtherIncome').addEventListener('click', () => openModal('otherIncome'));
  document.getElementById('addStockPurchase').addEventListener('click', () => openModal('stockPurchase'));
  document.getElementById('addStockSale').addEventListener('click', () => openModal('stockSale'));
  document.getElementById('addAdvanceTax').addEventListener('click', () => openModal('advanceTax'));

  // Wire modal
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalForm').addEventListener('submit', handleFormSubmit);

  // Wire add account
  document.getElementById('addAccountBtn').addEventListener('click', () => {
    openModal('account');
  });


  // Close modal on outside click
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal')) closeModal();
  });

  // ---- Load/Save workflow ----

  // Header Save button
  document.getElementById('saveDataBtn').addEventListener('click', saveDataToFile);

  // Header Export button
  document.getElementById('exportDataBtn').addEventListener('click', exportComputedData);

  // Header Reset button
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (isDirty && !confirm('There are unsaved changes. Are you sure you want to reset?')) return;
    clearStorage();
    isDirty = false;
    dataLoaded = false;
    DB = { accounts: [], config: {} };
    selectedAccount = null;
    updateDataButtons();
    showLoadScreen();
  });

  // Load screen button
  document.getElementById('loadScreenBtn').addEventListener('click', () => {
    document.getElementById('loadScreenFileInput').click();
  });
  document.getElementById('loadScreenFileInput').addEventListener('change', (e) => {
    if (e.target.files[0]) {
      loadDataFromFile(e.target.files[0]).then(() => {
        populateFilters();
        restoreFromHash();
        renderCurrentSection();
        hideLoadScreen();
      });
      e.target.value = '';
    }
  });

  // Sample data button
  document.getElementById('loadSampleBtn').addEventListener('click', () => {
    fetch('data/sample.json')
      .then(r => r.json())
      .then(data => {
        DB = data;
        if (!DB.config) DB.config = {};
        saveToStorage();
        dataLoaded = true;
        isDirty = false;
        selectedAccount = DB.accounts.length > 0 ? DB.accounts[0].account : null;
        updateDataButtons();
        populateFilters();
        restoreFromHash();
        renderCurrentSection();
        hideLoadScreen();
      })
      .catch(() => alert('Could not load sample data.'));
  });


  // ---- Startup: check if data exists in localStorage ----
  if (hasStoredData()) {
    loadFromStorage();
    dataLoaded = true;
    isDirty = true; // unsaved session from before
    selectedAccount = DB.accounts.length > 0 ? DB.accounts[0].account : null;
    updateDataButtons();
    populateFilters();
    restoreFromHash();
    renderCurrentSection();

    // Handle ?export URL params
    handleExportParams();
  } else {
    showLoadScreen();
    updateDataButtons();
  }

  // ---- Repo connection: detect server and wire connect ----
  detectServer();
});

function showLoadScreen() {
  document.getElementById('loadScreen').classList.remove('d-none');
  document.querySelector('nav').classList.add('disabled');
  document.querySelector('main').classList.add('disabled');
}

function hideLoadScreen() {
  document.getElementById('loadScreen').classList.add('d-none');
  document.querySelector('nav').classList.remove('disabled');
  document.querySelector('main').classList.remove('disabled');
}

function handleExportParams() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('export')) return;

  // Set account if specified
  const account = params.get('account');
  if (account) {
    const accSelect = document.getElementById('accountFilter');
    const accounts = getAccounts();
    const match = accounts.find(a => a.toLowerCase() === account.toLowerCase());
    if (match) {
      selectedAccount = match;
      accSelect.value = match;
      populateFYFilter();
    }
  }

  // Set FY if specified
  const fy = params.get('fy');
  if (fy) {
    const fySelect = document.getElementById('fyFilter');
    fySelect.value = fy;
  }

  // Re-render with new filters, then export
  renderCurrentSection();
  const data = buildExportData();
  if (!data) return;

  const filename = params.get('export') || `${(data.account || 'export').replace(/\s+/g, '_')}_Computed_${data.financialYear}`;
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.json') ? filename : filename + '.json';
  a.click();
  URL.revokeObjectURL(url);

  // Clean URL without reloading
  window.history.replaceState({}, '', window.location.pathname);
}

function populateFilters() {
  const accSelect = document.getElementById('accountFilter');

  // Accounts from data
  const accounts = getAccounts();
  accSelect.innerHTML = accounts.map(a => `<option value="${a}">${a}</option>`).join('');

  if (selectedAccount && accounts.includes(selectedAccount)) {
    accSelect.value = selectedAccount;
  } else if (accounts.length > 0) {
    selectedAccount = accounts[0];
    accSelect.value = selectedAccount;
  }

  populateFYFilter();
}

function populateFYFilter() {
  const fySelect = document.getElementById('fyFilter');
  const years = getFinancialYears();
  fySelect.innerHTML = '<option value="All">All Years</option>' +
    years.map(y => `<option value="${y}">${y}</option>`).join('');
  if (years.length > 0) fySelect.value = years[0];
}

function updateHash() {
  const acc = document.getElementById('accountFilter').value || '';
  const fy = document.getElementById('fyFilter').value || '';
  location.hash = `${currentSection}/${encodeURIComponent(acc)}/${encodeURIComponent(fy)}`;
}

function restoreFromHash() {
  const parts = location.hash.replace('#', '').split('/').map(decodeURIComponent);
  const [section, account, fy] = parts;

  if (section) {
    const targetBtn = document.querySelector(`.nav-btn[data-section="${section}"]`);
    if (targetBtn) {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      targetBtn.classList.add('active');
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.getElementById(section).classList.add('active');
      currentSection = section;
    }
  }

  if (account) {
    const accSelect = document.getElementById('accountFilter');
    const match = [...accSelect.options].find(o => o.value === account);
    if (match) {
      accSelect.value = account;
      selectedAccount = account;
    }
  }

  populateFYFilter();

  if (fy) restoreHashFY();
}

function restoreHashFY() {
  const parts = location.hash.replace('#', '').split('/').map(decodeURIComponent);
  const fy = parts[2];
  if (fy) {
    const fySelect = document.getElementById('fyFilter');
    const match = [...fySelect.options].find(o => o.value === fy);
    if (match) fySelect.value = fy;
  }
}

// ---- Repo connection ----

let repoMode = false;
let repoDataWatcher = null;

async function detectServer() {
  try {
    const resp = await fetch('/api/health', { signal: AbortSignal.timeout(2000) });
    if (!resp.ok) return;
    const health = await resp.json();

    // Server is running — show repo connect area on load screen
    const area = document.getElementById('repoConnectArea');
    if (area) area.classList.remove('d-none');

    // Load available repos into dropdown
    const reposResp = await fetch('/api/repos');
    const repos = await reposResp.json();
    const select = document.getElementById('repoSelect');
    select.innerHTML = repos
      .filter(r => r.valid)
      .map(r => `<option value="${r.id}">${r.name}</option>`)
      .join('');

    // If already connected (server remembers), auto-load
    if (health.activeRepo) {
      await loadRepoData();
    }

    // Wire connect button
    document.getElementById('connectRepoBtn').addEventListener('click', async () => {
      const repoId = select.value;
      if (!repoId) return;
      try {
        const resp = await fetch('/api/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: repoId })
        });
        if (!resp.ok) { alert('Failed to connect'); return; }
        await loadRepoData();
      } catch (e) {
        alert('Connection failed: ' + e.message);
      }
    });
  } catch (e) {
    // Server not running — repo connect stays hidden, file mode only
  }
}

async function loadRepoData() {
  try {
    const resp = await fetch('/api/data');
    if (!resp.ok) { alert('Failed to load repo data'); return; }
    DB = await resp.json();
    if (!DB.config) DB.config = {};

    repoMode = true;
    dataLoaded = true;
    isDirty = false;
    selectedAccount = DB.accounts.length > 0 ? DB.accounts[0].account : null;

    updateDataButtons();
    populateFilters();
    restoreFromHash();
    renderCurrentSection();
    hideLoadScreen();

    // Show ingest nav
    const ingestNav = document.getElementById('navGroupIngest');
    if (ingestNav) ingestNav.classList.remove('d-none');

    // Load ingest batches
    if (typeof loadBatches === 'function') loadBatches();

    // Start watching for DB changes
    startDataWatcher();
  } catch (e) {
    alert('Failed to load repo data: ' + e.message);
  }
}

function startDataWatcher() {
  if (repoDataWatcher) repoDataWatcher.close();
  repoDataWatcher = new EventSource('/api/data/watch');
  repoDataWatcher.onmessage = async (e) => {
    const data = JSON.parse(e.data);
    if (data.event === 'db-changed') {
      // Reload DB from repo
      try {
        const resp = await fetch('/api/data');
        if (resp.ok) {
          DB = await resp.json();
          if (!DB.config) DB.config = {};
          isDirty = false;
          updateDataButtons();
          populateFilters();
          renderCurrentSection();
        }
      } catch (e) { /* ignore */ }
    }
  };
}
