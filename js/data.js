// data.js — Data layer: account-grouped JSON schema
//
// Schema: { accounts: [ { account, name, ForeignIncome:[], ... }, ... ] }
// Depends on: finbook-core.js (loaded before this script)
//

let DB = { accounts: [], config: {} };

// ---- Imports from FinbookCore ----
const { TABLE_NAMES, DATE_FIELDS, COMPUTATIONS, COMPUTED_FIELDS, MONTHS,
        dateToFY, dateToQFY, dateToCgQ, derivePurchaseLotID } = FinbookCore;

let isDirty = false;
let dataLoaded = false;
let selectedAccount = null; // current account code

// ---- Dirty tracking ----

function markDirty() {
  if (!isDirty) {
    isDirty = true;
    updateDataButtons();
  }
}

function updateDataButtons() {
  const saveBtn = document.getElementById('saveDataBtn');
  const dirtyDot = document.getElementById('dirtyIndicator');
  const resetBtn = document.getElementById('resetBtn');
  const exportBtn = document.getElementById('exportDataBtn');

  if (isDirty) {
    if (saveBtn) saveBtn.classList.remove('d-none');
    if (dirtyDot) dirtyDot.classList.remove('d-none');
  } else {
    if (saveBtn) saveBtn.classList.add('d-none');
    if (dirtyDot) dirtyDot.classList.add('d-none');
  }
  if (resetBtn) resetBtn.classList.toggle('d-none', !dataLoaded);
  if (exportBtn) exportBtn.classList.toggle('d-none', !dataLoaded);
}

// ---- localStorage persistence ----

const STORAGE_KEY = 'taxtracker_db';
const SCHEMA_VERSION = 10; // bump when schema changes

function hasStoredData() {
  if (localStorage.getItem('taxtracker_schema') !== String(SCHEMA_VERSION)) {
    clearStorage();
    return false;
  }
  return !!localStorage.getItem(STORAGE_KEY);
}

function loadFromStorage() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      DB = JSON.parse(stored);
      return true;
    } catch (e) { /* ignore */ }
  }
  return false;
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
  localStorage.setItem('taxtracker_schema', String(SCHEMA_VERSION));
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('taxtracker_schema');
}

// Called after any table edit — persist and mark dirty
function saveTable() {
  saveToStorage();
  markDirty();
}

// ---- File I/O ----

function stripComputedFields(db) {
  return {
    config: db.config || {},
    accounts: db.accounts.map(acct => {
      const clean = { account: acct.account, name: acct.name };
      for (const t of TABLE_NAMES) {
        const rows = acct[t] || [];
        const fields = COMPUTED_FIELDS[t];
        if (fields) {
          clean[t] = rows.map(r => {
            const copy = { ...r };
            fields.forEach(f => delete copy[f]);
            return copy;
          });
        } else {
          clean[t] = rows;
        }
      }
      return clean;
    })
  };
}

async function saveDataToFile() {
  const jsonStr = JSON.stringify(stripComputedFields(DB), null, 2);

  // Repo mode: save via API
  if (typeof repoMode !== 'undefined' && repoMode) {
    try {
      const resp = await fetch('/api/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: jsonStr
      });
      if (!resp.ok) { alert('Failed to save to repo'); return; }
      isDirty = false;
      updateDataButtons();
      return;
    } catch (e) {
      alert('Save failed: ' + e.message);
      return;
    }
  }

  // File mode: download as file
  const blob = new Blob([jsonStr], { type: 'application/json' });

  try {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'Sarala_Database.json',
        types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Sarala_Database.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
    console.error('Save failed:', e);
    return;
  }

  clearStorage();
  isDirty = false;
  dataLoaded = false;
  DB = { accounts: [], config: {} };
  selectedAccount = null;
  updateDataButtons();
  showLoadScreen();
}

function loadDataFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (imported.accounts && Array.isArray(imported.accounts)) {
          DB = imported;
          if (!DB.config) DB.config = {};
        } else {
          alert('Invalid format: expected { accounts: [...] }');
          reject(new Error('Invalid format'));
          return;
        }
        saveToStorage();
        dataLoaded = true;
        isDirty = false;
        selectedAccount = DB.accounts.length > 0 ? DB.accounts[0].account : null;
        updateDataButtons();
        resolve();
      } catch (err) {
        alert('Invalid JSON file');
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}

// ---- Data accessors ----

function getAccounts() {
  return DB.accounts.filter(a => a.enabled !== false).map(a => a.account);
}

function addAccount(code, name) {
  if (!code || !name) return false;
  if (DB.accounts.some(a => a.account === code)) return false;
  const acct = { account: code, name: name, enabled: true };
  TABLE_NAMES.forEach(t => acct[t] = []);
  DB.accounts.push(acct);
  saveTable();
  return true;
}

function getAccountData(accountCode) {
  return DB.accounts.find(a => a.account === accountCode);
}

function getCurrentAccountData() {
  return getAccountData(selectedAccount);
}

function getTable(tableName) {
  const acct = getCurrentAccountData();
  if (!acct) return [];
  const rows = acct[tableName] || [];
  const compute = COMPUTATIONS[tableName];
  if (compute) rows.forEach((r, i) => compute(r, i));
  return rows.filter(r => !r.Deleted);
}

function getRawTable(tableName) {
  const acct = getCurrentAccountData();
  if (!acct) return [];
  return acct[tableName] || [];
}

function getFinancialYears() {
  const acct = getCurrentAccountData();
  if (!acct) return [];
  const years = new Set();
  TABLE_NAMES.forEach(t => {
    const df = DATE_FIELDS[t];
    if (!df) return;
    (acct[t] || []).forEach(row => {
      const fy = dateToFY(row[df]);
      if (fy) years.add(fy);
    });
  });
  return [...years].sort().reverse();
}

function filterByFY(data, fy, tableName) {
  if (!fy || fy === 'All') return data;
  const dateField = DATE_FIELDS[tableName];
  if (!dateField) return data;
  return data.filter(row => dateToFY(row[dateField]) === fy);
}

// ---- Browser-only helpers (depend on getTable / global state) ----

function nextLotTag(data) {
  const purchases = getTable('StockPurchasesOrTransferIns');
  const d = data.PurchaseDate ? new Date(data.PurchaseDate) : null;
  if (!d) return 0;
  const matches = purchases.filter(p => {
    const pd = p.PurchaseDate ? new Date(p.PurchaseDate) : null;
    return pd && p.SecurityName === data.SecurityName
      && p.PurchasePricePerUnit === data.PurchasePricePerUnit
      && pd.getDate() === d.getDate()
      && pd.getMonth() === d.getMonth()
      && pd.getFullYear() === d.getFullYear();
  });
  if (matches.length === 0) return 0;
  return Math.max(...matches.map(p => p.LotTag || 0)) + 1;
}

function getConfigList(key) {
  return (DB.config && DB.config[key]) || [];
}

function setConfigList(key, arr) {
  if (!DB.config) DB.config = {};
  DB.config[key] = arr;
  saveTable();
}

function fmt(num) {
  if (num == null || isNaN(num)) return '—';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

function fmtC(val, currencyCode) {
  const sym = (DB.config && DB.config.CurrencySymbols && DB.config.CurrencySymbols[currencyCode]) || '';
  return sym + fmt(val);
}

function fmtR(val) {
  const show = DB.config && DB.config.ShowRupeeSymbol !== false;
  return (show ? '₹' : '') + fmt(val);
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
