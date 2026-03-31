// data.js — Data layer: account-grouped JSON schema
//
// Schema: { accounts: [ { account, name, ForeignIncome:[], ... }, ... ] }
//

let DB = { accounts: [], config: {} };

const TABLE_NAMES = [
  'AdvanceTax', 'CapitalGainsConsolidated', 'ForeignAccounts',
  'ForeignIncome', 'OtherIncome', 'Properties', 'PropertyIncome',
  'SalaryIncome', 'StockPurchases', 'StockSales'
];

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
    if (resetBtn) resetBtn.classList.add('d-none');
  } else {
    if (saveBtn) saveBtn.classList.add('d-none');
    if (dirtyDot) dirtyDot.classList.add('d-none');
    if (resetBtn) resetBtn.classList.toggle('d-none', !dataLoaded);
  }
  if (exportBtn) exportBtn.classList.toggle('d-none', !dataLoaded);
}

// ---- localStorage persistence ----

const STORAGE_KEY = 'taxtracker_db';
const SCHEMA_VERSION = 9; // bump when schema changes

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

// ---- Computed fields ----

const COMPUTATIONS = {
  ForeignIncome: (r, i) => {
    r.ForeignIncomeID = String(i);
    r.IncomeAmountINR = (r.IncomeAmount || 0) * (r.ExchangeRateToINR || 0);
    r.TaxesWithheldINR = (r.TaxesWithheld || 0) * (r.ExchangeRateToINR || 0);
    r.QFY = dateToQFY(r.IncomeDate);
  },
  PropertyIncome: (r, i) => {
    r.PropertyIncomeID = String(i);
    const gross = r.GrossIncome || 0;
    r.NetIncome = gross - (r.TotalExpenses || 0) - (gross * 0.3);
    r.QFY = dateToQFY(r.IncomeDate);
  },
  CapitalGainsConsolidated: (r, i) => {
    r.CapitalGainsID = String(i);
    r.IncomeAmount = (r.SaleValue || 0) - (r.AcquisitionCost || 0) - (r.Expenses || 0);
    r.QFY = dateToQFY(r.IncomeDate);
    r.CgQ = dateToCgQ(r.IncomeDate);
  },
  OtherIncome: (r, i) => {
    r.OtherIncomeID = String(i);
    r.QFY = dateToQFY(r.IncomeDate);
  },
  StockPurchases: (r, i) => {
    r.StockPurchaseID = String(i);
    const qty = r.PurchaseQuantity || 0;
    r.TotalPurchaseValue = qty * (r.PurchasePricePerUnit || 0) + (r.PurchaseExpenses || 0);
    r.TotalPurchasePricePerUnit = qty > 0 ? r.TotalPurchaseValue / qty : 0;
    r.TotalPurchaseValueINR = r.TotalPurchaseValue * (r.ExchangeRateToINR || 0);
    r.QFY = dateToQFY(r.PurchaseDate);
  },
  StockSales: (r, i) => {
    r.StockSaleID = String(i);
    const qty = r.SaleQuantity || 0;
    r.TotalSaleValue = (r.SaleAmount || 0) - (r.SaleExpenses || 0);
    r.TotalSalePricePerUnit = qty > 0 ? r.TotalSaleValue / qty : 0;
    r.TotalSaleValueINR = r.TotalSaleValue * (r.ExchangeRateToINR || 0);
    r.QFY = dateToQFY(r.SaleDate);
    r.CgQ = dateToCgQ(r.SaleDate);
  },
  SalaryIncome: (r, i) => {
    r.SalaryIncomeID = String(i);
    const gross = (r.GrossTaxable || 0) + (r.TaxablePerquisites || 0);
    r.GrossTaxableIncome = gross + (r.Exemptions || 0);
    r.NetTaxableIncome = r.GrossTaxableIncome - (r.Deductions || 0);
    r.QFY = dateToQFY(r.EffectiveDate);
  },
  AdvanceTax: (r, i) => {
    r.AdvanceTaxID = String(i);
    r.QFY = dateToQFY(r.EffectiveDate || r.PaymentDate);
    r.CgQ = dateToCgQ(r.EffectiveDate || r.PaymentDate);
  }
};

const COMPUTED_FIELDS = {
  ForeignIncome: ['ForeignIncomeID', 'IncomeAmountINR', 'TaxesWithheldINR', 'QFY'],
  PropertyIncome: ['PropertyIncomeID', 'NetIncome', 'QFY'],
  CapitalGainsConsolidated: ['CapitalGainsID', 'IncomeAmount', 'QFY', 'CgQ'],
  OtherIncome: ['OtherIncomeID', 'QFY'],
  StockPurchases: ['StockPurchaseID', 'TotalPurchaseValue', 'TotalPurchasePricePerUnit', 'TotalPurchaseValueINR', 'QFY'],
  StockSales: ['StockSaleID', 'TotalSaleValue', 'TotalSalePricePerUnit', 'TotalSaleValueINR', 'QFY', 'CgQ'],
  SalaryIncome: ['SalaryIncomeID', 'GrossTaxableIncome', 'NetTaxableIncome', 'QFY'],
  AdvanceTax: ['AdvanceTaxID', 'QFY', 'CgQ']
};

// ---- Helpers ----

const DATE_FIELDS = {
  AdvanceTax: 'EffectiveDate',
  CapitalGainsConsolidated: 'IncomeDate',
  ForeignIncome: 'IncomeDate',
  OtherIncome: 'IncomeDate',
  PropertyIncome: 'IncomeDate',
  SalaryIncome: 'EffectiveDate',
  StockPurchases: 'PurchaseDate',
  StockSales: 'SaleDate'
};

function dateToFY(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const month = d.getMonth(); // 0-based, Apr=3
  const year = d.getFullYear();
  const startYear = month >= 3 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function dateToQFY(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const m = d.getMonth(); // 0=Jan
  if (m >= 3 && m <= 5) return 'Q1';
  if (m >= 6 && m <= 8) return 'Q2';
  if (m >= 9 && m <= 11) return 'Q3';
  return 'Q4'; // Jan-Mar
}

function dateToCgQ(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const m = d.getMonth(); // 0=Jan
  const day = d.getDate();
  // mmdd for easy range comparison (FY month-day)
  if (m === 3 || (m === 4) || (m === 5 && day <= 15)) return 'cgQ1';               // 01-Apr → 15-Jun
  if ((m === 5 && day >= 16) || m === 6 || m === 7 || (m === 8 && day <= 15)) return 'cgQ2'; // 16-Jun → 15-Sep
  if ((m === 8 && day >= 16) || m === 9 || m === 10 || (m === 11 && day <= 15)) return 'cgQ3'; // 16-Sep → 15-Dec
  if ((m === 11 && day >= 16) || m === 0 || m === 1 || (m === 2 && day <= 15)) return 'cgQ4'; // 16-Dec → 15-Mar
  return 'cgQ4a'; // 16-Mar → 31-Mar
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function derivePurchaseLotID(data) {
  const d = data.PurchaseDate ? new Date(data.PurchaseDate) : null;
  if (!d || !data.SecurityName) return '';
  const tag = data.LotTag || 0;
  const day = d.getDate();
  return `${data.SecurityName} - ${data.PurchasePricePerUnit} - ${day}-${MONTHS[d.getMonth()]}-${d.getFullYear()}${tag > 0 ? '-' + tag : ''}`;
}

function nextLotTag(data) {
  const purchases = getTable('StockPurchases');
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
