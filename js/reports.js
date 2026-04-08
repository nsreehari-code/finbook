// reports.js — Rendering logic for each section/report

// Globe icon for foreign currency columns
const FC = '<svg class="fc-icon" title="Foreign Currency" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>';

function getSelectedFY() {
  return document.getElementById('fyFilter').value;
}

function actionBtns(formKey, id, isLocked) {
  if (isLocked) {
    return `<button class="btn btn-sm btn-outline-success" title="Unlock" onclick="unlockEntry('${formKey}','${id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg></button>`;
  }
  return `<button class="btn btn-sm btn-outline-secondary" title="Edit" onclick="openModal('${formKey}', getEntryById('${formKey}','${id}'))"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn btn-sm btn-outline-danger" title="Delete" onclick="deleteEntry('${formKey}','${id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a2 2 0 012-2h0a2 2 0 012 2v2"/></svg></button>
          <button class="btn btn-sm btn-outline-warning" title="Lock" onclick="lockEntry('${formKey}','${id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></button>`;
}

function getEntryById(formKey, id) {
  const def = FORM_DEFS[formKey];
  return getTable(def.table).find(r => r[def.idField] === id);
}

/** Render data into a container with FY grouping. dateField is used to derive FY per row. */
function renderWithFyGrouping(containerId, data, fy, dateField, buildTableFn) {
  const container = document.getElementById(containerId);
  const isAllYears = !fy || fy === 'All';
  if (isAllYears) {
    const groups = {};
    data.forEach(r => {
      const rfy = dateToFY(r[dateField]) || 'Unknown';
      if (!groups[rfy]) groups[rfy] = [];
      groups[rfy].push(r);
    });
    const sorted = Object.keys(groups).sort().reverse();
    container.innerHTML = sorted.map(k =>
      `<h5 class="mt-4 mb-2 fw-bold">FY ${k}</h5>` + buildTableFn(groups[k])
    ).join('');
  } else {
    container.innerHTML = `<h5 class="mt-4 mb-2 fw-bold">FY ${fy}</h5>` + buildTableFn(data);
  }
}

// ---- Dashboard ----
// ---- Foreign Income ----
function renderForeignIncome() {
  const fy = getSelectedFY();
  const data = filterByFY(getTable('ForeignIncome'), fy, 'ForeignIncome')
    .sort((a, b) => (a.IncomeDate || '').localeCompare(b.IncomeDate || ''));

  renderWithFyGrouping('foreignIncomeTableContainer', data, fy, 'IncomeDate', rows => {
    const tbody = rows.map(r => `<tr>
      <td>${fmtDate(r.IncomeDate)}</td>
      <td>${r.IncomeSource || ''}</td>
      <td>${r.IncomeType || ''}</td>
      <td>${r.ForeignAccount || ''}</td>
      <td>${r.Currency || ''}</td>
      <td class="num">${fmtC(r.IncomeAmount, r.Currency)}</td>
      <td class="num">${fmtC(r.TaxesWithheld, r.Currency)}</td>
      <td class="num">${fmt(r.ExchangeRateToINR)}</td>
      <td class="num">${fmtR(r.IncomeAmountINR)}</td>
      <td class="num">${fmtR(r.TaxesWithheldINR)}</td>
      <td>${r.NonTaxable ? 'No' : 'Yes'}</td>
      <td>${actionBtns('foreignIncome', r.ForeignIncomeID, r.IsLocked)}</td>
    </tr>`).join('');
    return `<table class="table table-sm table-hover align-middle">
      <thead><tr><th>Date</th><th>Source</th><th>Type</th><th>Foreign Account</th><th>Currency</th><th class="text-end">Amount (Cur)</th><th class="text-end">Tax Withheld (Cur)</th><th class="text-end">Rate (INR)</th><th class="text-end">Amount</th><th class="text-end">Tax</th><th>Taxable</th><th>Actions</th></tr></thead>
      <tbody>${tbody}</tbody>
      <tfoot><tr><td colspan="8"><strong>Total</strong></td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.IncomeAmountINR || 0), 0))}</td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.TaxesWithheldINR || 0), 0))}</td><td colspan="2"></td></tr></tfoot>
    </table>`;
  });
}

// ---- Property Income ----
function renderPropertyIncome() {
  const fy = getSelectedFY();
  const data = filterByFY(getTable('PropertyIncome'), fy, 'PropertyIncome');

  renderWithFyGrouping('propertyIncomeTableContainer', data, fy, 'IncomeDate', rows => {
    const tbody = rows.map(r => `<tr>
      <td>${fmtDate(r.IncomeDate)}</td>
      <td>${r.PropertyID || ''}</td>
      <td class="num">${fmtR(r.GrossIncome)}</td>
      <td class="num">${fmtR(r.TotalExpenses)}</td>
      <td class="num">${fmtR(r.NetIncome)}</td>
      <td class="num">${fmtR(r.TDSDeducted)}</td>
      <td>${r.Details || ''}</td>
      <td>${actionBtns('propertyIncome', r.PropertyIncomeID, r.IsLocked)}</td>
    </tr>`).join('');
    return `<table class="table table-sm table-hover align-middle">
      <thead><tr><th>Date</th><th>Property</th><th class="text-end">Gross Income</th><th class="text-end">Expenses</th><th class="text-end">Net Income</th><th class="text-end">TDS</th><th>Details</th><th>Actions</th></tr></thead>
      <tbody>${tbody}</tbody>
      <tfoot><tr><td colspan="2"><strong>Total</strong></td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.GrossIncome || 0), 0))}</td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.TotalExpenses || 0), 0))}</td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.NetIncome || 0), 0))}</td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.TDSDeducted || 0), 0))}</td><td colspan="2"></td></tr></tfoot>
    </table>`;
  });
}

// ---- Capital Gains ----
function renderCapitalGains() {
  const fy = getSelectedFY();
  const data = filterByFY(getTable('CapitalGainsConsolidated'), fy, 'CapitalGainsConsolidated');

  renderWithFyGrouping('capitalGainsTableContainer', data, fy, 'IncomeDate', rows => {
    const tbody = rows.map(r => `<tr>
      <td>${fmtDate(r.IncomeDate)}</td>
      <td>${r.GainsType || ''}</td>
      <td>${r.IncomeDescription || ''}</td>
      <td class="num">${fmtR(r.SaleValue)}</td>
      <td class="num">${fmtR(r.AcquisitionCost)}</td>
      <td class="num">${fmtR(r.Expenses)}</td>
      <td class="num ${(r.IncomeAmount || 0) >= 0 ? 'positive' : 'negative'}">${fmtR(r.IncomeAmount)}</td>
      <td class="num">${fmtR(r.TDSDeducted)}</td>
      <td>${r.NonTaxable ? 'No' : 'Yes'}</td>
      <td>${r.Remarks || ''}</td>
      <td>${actionBtns('capitalGains', r.CapitalGainsID, r.IsLocked)}</td>
    </tr>`).join('');
    return `<table class="table table-sm table-hover align-middle">
      <thead><tr><th>Date</th><th>Type</th><th>Description</th><th class="text-end">Sale Value</th><th class="text-end">Acquisition Cost</th><th class="text-end">Expenses</th><th class="text-end">Gain/Loss</th><th class="text-end">TDS</th><th>Taxable</th><th>Remarks</th><th>Actions</th></tr></thead>
      <tbody>${tbody}</tbody>
      <tfoot><tr><td colspan="3"><strong>Total</strong></td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.SaleValue || 0), 0))}</td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.AcquisitionCost || 0), 0))}</td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.Expenses || 0), 0))}</td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.IncomeAmount || 0), 0))}</td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.TDSDeducted || 0), 0))}</td><td colspan="3"></td></tr></tfoot>
    </table>`;
  });
}

// ---- Salary Income ----
function renderSalaryIncome() {
  const fy = getSelectedFY();
  const data = filterByFY(getTable('SalaryIncome'), fy, 'SalaryIncome')
    .sort((a, b) => (a.EffectiveDate || '').localeCompare(b.EffectiveDate || ''));

  renderWithFyGrouping('salaryIncomeTableContainer', data, fy, 'EffectiveDate', rows => {
    const tbody = rows.map(r => `<tr>
      <td>${fmtDate(r.EffectiveDate)}</td>
      <td>${r.Employer || ''}</td>
      <td class="num">${fmtR(r.GrossTaxable)}</td>
      <td class="num">${fmtR(r.TaxablePerquisites)}</td>
      <td class="num">${fmtR(r.Exemptions)}</td>
      <td class="num">${fmtR(r.GrossTaxableIncome)}</td>
      <td class="num">${fmtR(r.Deductions)}</td>
      <td class="num">${fmtR(r.NetTaxableIncome)}</td>
      <td class="num">${fmtR(r.TDSDeducted)}</td>
      <td>${r.Remarks || ''}</td>
      <td>${actionBtns('salaryIncome', r.SalaryIncomeID, r.IsLocked)}</td>
    </tr>`).join('');
    return `<table class="table table-sm table-hover align-middle">
      <thead><tr><th>Date</th><th>Employer</th><th class="text-end">Gross Taxable</th><th class="text-end">Perquisites</th><th class="text-end">Exemptions</th><th class="text-end">Gross Taxable Income</th><th class="text-end">Deductions</th><th class="text-end">Net Taxable</th><th class="text-end">TDS</th><th>Remarks</th><th>Actions</th></tr></thead>
      <tbody>${tbody}</tbody>
      <tfoot><tr><td colspan="2"><strong>Total</strong></td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.GrossTaxable || 0), 0))}</td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.TaxablePerquisites || 0), 0))}</td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.Exemptions || 0), 0))}</td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.GrossTaxableIncome || 0), 0))}</td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.Deductions || 0), 0))}</td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.NetTaxableIncome || 0), 0))}</td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.TDSDeducted || 0), 0))}</td><td colspan="2"></td></tr></tfoot>
    </table>`;
  });
}

// ---- Other Income ----
function renderOtherIncome() {
  const fy = getSelectedFY();
  const data = filterByFY(getTable('OtherIncome'), fy, 'OtherIncome');

  renderWithFyGrouping('otherIncomeTableContainer', data, fy, 'IncomeDate', rows => {
    const tbody = rows.map(r => `<tr>
      <td>${fmtDate(r.IncomeDate)}</td>
      <td>${r.IncomeDescription || ''}</td>
      <td class="num">${fmtR(r.IncomeAmount)}</td>
      <td class="num">${fmtR(r.TDSDeducted)}</td>
      <td>${r.NonTaxable ? 'No' : 'Yes'}</td>
      <td>${r.Remarks || ''}</td>
      <td>${actionBtns('otherIncome', r.OtherIncomeID, r.IsLocked)}</td>
    </tr>`).join('');
    return `<table class="table table-sm table-hover align-middle">
      <thead><tr><th>Date</th><th>Description</th><th class="text-end">Amount</th><th class="text-end">TDS</th><th>Taxable</th><th>Remarks</th><th>Actions</th></tr></thead>
      <tbody>${tbody}</tbody>
      <tfoot><tr><td colspan="2"><strong>Total</strong></td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.IncomeAmount || 0), 0))}</td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.TDSDeducted || 0), 0))}</td><td colspan="3"></td></tr></tfoot>
    </table>`;
  });
}

// ---- Stock Purchases ----
function renderStockPurchases() {
  const fy = getSelectedFY();
  const data = filterByFY(getTable('StockPurchasesOrTransferIns'), fy, 'StockPurchasesOrTransferIns')
    .sort((a, b) => (a.PurchaseDate || '').localeCompare(b.PurchaseDate || ''));

  renderWithFyGrouping('stockPurchasesTableContainer', data, fy, 'PurchaseDate', rows => {
    const tbody = rows.map(r => `<tr class="${r.IsTransferIn ? 'row-transfer' : ''}">
      <td>${fmtDate(r.PurchaseDate)}</td>
      <td>${r.BrokerageName || ''}</td>
      <td>${r.SecurityName || ''}</td>
      <td class="num">${r.PurchaseQuantity}</td>
      <td class="num">${fmtC(r.PurchasePricePerUnit, r.CurrencyCode)}</td>
      <td>${r.CurrencyCode || ''}</td>
      <td class="num">${fmtC(r.TotalPurchaseValue, r.CurrencyCode)}</td>
      <td class="num">${fmt(r.ExchangeRateToINR)}</td>
      <td class="num">${fmtR(r.TotalPurchaseValueINR)}</td>
      <td>${r.PurchaseLotID || ''}</td>
      <td>${r.IsSTTPaid ? 'Yes' : 'No'}</td>
      <td>${r.IsTransferIn ? '↓ In' : ''}</td>
      <td>${actionBtns('stockPurchase', r.StockPurchaseID, r.IsLocked)}</td>
    </tr>`).join('');
    return `<table class="table table-sm table-hover align-middle">
      <thead><tr><th>Date</th><th>Brokerage</th><th>Security</th><th class="text-end">Qty</th><th class="text-end">Price/Unit (Cur)</th><th>Currency</th><th class="text-end">Total Value (Cur)</th><th class="text-end">Rate (INR)</th><th class="text-end">Value</th><th>Lot ID</th><th>STT</th><th>Transfer</th><th>Actions</th></tr></thead>
      <tbody>${tbody}</tbody>
    </table>`;
  });
}

// ---- Stock Sales ----
function renderStockSales() {
  const fy = getSelectedFY();
  const data = filterByFY(getTable('StockSalesOrTransferOuts'), fy, 'StockSalesOrTransferOuts')
    .sort((a, b) => (a.SaleDate || '').localeCompare(b.SaleDate || ''));

  // Build currency map from purchases
  const secCurrencyMap = {};
  getTable('StockPurchasesOrTransferIns').forEach(p => {
    const key = `${p.BrokerageName}|${p.SecurityName}`;
    if (p.CurrencyCode) secCurrencyMap[key] = p.CurrencyCode;
  });

  renderWithFyGrouping('stockSalesTableContainer', data, fy, 'SaleDate', rows => {
    const tbody = rows.map(r => {
      const lotInfo = (r.PurchaseLots || []).map(l =>
        `${l.SaleQuantity} × ${l.PurchaseLotID || 'Unknown'}`
      ).join('<br>');
      const cur = secCurrencyMap[`${r.BrokerageName}|${r.SecurityName}`] || '';
      return `<tr class="${r.IsTransferOut ? 'row-transfer' : ''}">
        <td>${fmtDate(r.SaleDate)}</td>
        <td>${r.BrokerageName || '—'}</td>
        <td>${r.SecurityName || '—'}</td>
        <td class="num">${fmt(r.SaleQuantity)}</td>
        <td class="num">${fmtC(r.SaleAmount, cur)}</td>
        <td class="num">${fmtC(r.SaleExpenses, cur)}</td>
        <td class="num">${fmt(r.ExchangeRateToINR)}</td>
        <td class="num">${fmtR(r.TotalSaleValueINR)}</td>
        <td>${lotInfo || '—'}</td>
        <td>${r.IsTransferOut ? '↑ Out' : ''}</td>
        <td>${actionBtns('stockSale', r.StockSaleID, r.IsLocked)}</td>
      </tr>`;
    }).join('');
    return `<table class="table table-sm table-hover align-middle">
      <thead><tr><th>Sale Date</th><th>Brokerage</th><th>Security</th><th class="text-end">Qty</th><th class="text-end">Sale Amount (Cur)</th><th class="text-end">Expenses (Cur)</th><th class="text-end">Rate (INR)</th><th class="text-end">Total Value</th><th>Purchase Lots</th><th>Transfer</th><th>Actions</th></tr></thead>
      <tbody>${tbody}</tbody>
    </table>`;
  });
}

// ---- Advance Tax ----
function renderAdvanceTax() {
  const fy = getSelectedFY();
  const data = filterByFY(getTable('AdvanceTax'), fy, 'AdvanceTax');

  renderWithFyGrouping('advanceTaxTableContainer', data, fy, 'EffectiveDate', rows => {
    const tbody = rows.map(r => `<tr>
      <td>${fmtDate(r.PaymentDate)}</td>
      <td>${fmtDate(r.EffectiveDate)}</td>
      <td class="num">${fmtR(r.TaxAmountPaid)}</td>
      <td>${r.PaymentDescription || ''}</td>
      <td>${r.Remarks || ''}</td>
      <td>${actionBtns('advanceTax', r.AdvanceTaxID, r.IsLocked)}</td>
    </tr>`).join('');
    return `<table class="table table-sm table-hover align-middle">
      <thead><tr><th>Paid Date</th><th>Effective Date</th><th class="text-end">Amount</th><th>Description</th><th>Remarks</th><th>Actions</th></tr></thead>
      <tbody>${tbody}</tbody>
      <tfoot><tr><td colspan="2"><strong>Total</strong></td><td class="num">${fmtR(rows.reduce((s, r) => s + (r.TaxAmountPaid || 0), 0))}</td><td colspan="3"></td></tr></tfoot>
    </table>`;
  });
}

// ---- Settings ----
const CONFIG_LISTS = [
  { key: 'CapitalGainsTypes', label: 'Capital Gains Types', placeholder: 'e.g. STCG' },
  { key: 'ForeignStockTickers', label: 'Foreign Stock Tickers', placeholder: 'e.g. AAPL' },
  { key: 'ForeignCurrencies', label: 'Foreign Currencies', placeholder: 'e.g. EUR' },
  { key: 'ForeignIncomeSource', label: 'Foreign Income Sources', placeholder: 'e.g. Stocks' },
  { key: 'ForeignIncomeType', label: 'Foreign Income Types', placeholder: 'e.g. Dividends' }
];

function renderConfigTags(containerId, configKey) {
  const items = getConfigList(configKey);
  const rates = (configKey === 'ForeignCurrencies') ? ((DB.config && DB.config.CurrencyRates) || {}) : null;
  const symbols = (configKey === 'ForeignCurrencies') ? ((DB.config && DB.config.CurrencySymbols) || {}) : null;
  const container = document.getElementById(containerId);
  container.innerHTML = items.map((val, i) => {
    const extras = rates !== null
      ? `<input type="text" class="config-symbol-input" data-currency="${val}" value="${symbols[val] || ''}" placeholder="\u00A4" title="Currency symbol" maxlength="3"><input type="number" step="0.01" class="config-rate-input" data-currency="${val}" value="${rates[val] || ''}" placeholder="Rate" title="Exchange rate to INR">`
      : '';
    return `<span class="config-tag">${val}${extras}<button class="config-tag-remove" data-key="${configKey}" data-container="${containerId}" data-idx="${i}">&times;</button></span>`;
  }).join('');
  container.querySelectorAll('.config-tag-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = e.target.dataset.key;
      const cid = e.target.dataset.container;
      const idx = parseInt(e.target.dataset.idx);
      const list = getConfigList(key).slice();
      list.splice(idx, 1);
      setConfigList(key, list);
      renderConfigTags(cid, key);
    });
  });
  // Wire currency rate inputs
  container.querySelectorAll('.config-rate-input').forEach(inp => {
    inp.addEventListener('change', (e) => {
      if (!DB.config) DB.config = {};
      if (!DB.config.CurrencyRates) DB.config.CurrencyRates = {};
      const v = parseFloat(e.target.value);
      if (v > 0) DB.config.CurrencyRates[e.target.dataset.currency] = v;
      else delete DB.config.CurrencyRates[e.target.dataset.currency];
      saveTable();
    });
  });
  // Wire currency symbol inputs
  container.querySelectorAll('.config-symbol-input').forEach(inp => {
    inp.addEventListener('change', (e) => {
      if (!DB.config) DB.config = {};
      if (!DB.config.CurrencySymbols) DB.config.CurrencySymbols = {};
      const v = e.target.value.trim();
      if (v) DB.config.CurrencySymbols[e.target.dataset.currency] = v;
      else delete DB.config.CurrencySymbols[e.target.dataset.currency];
      saveTable();
    });
  });
}

function wireConfigAddButtons() {
  document.querySelectorAll('.cfg-add-btn').forEach(btn => {
    const key = btn.dataset.cfgKey;
    const input = document.querySelector(`.cfg-add-input[data-cfg-key="${key}"]`);
    const containerId = 'cfg_' + key;
    function add() {
      const val = input.value.trim();
      if (!val) return;
      const list = getConfigList(key).slice();
      if (!list.includes(val)) {
        list.push(val);
        list.sort();
        setConfigList(key, list);
      }
      input.value = '';
      renderConfigTags(containerId, key);
    }
    btn.addEventListener('click', add);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); add(); }
    });
  });
}

function renderSettings() {
  const acct = getCurrentAccountData();

  // Show selected account name in header
  const label = document.getElementById('settingsAccountLabel');
  if (label) label.textContent = acct ? `\u2014 ${acct.name}` : '';

  const props = acct ? (acct.Properties || []) : [];
  document.querySelector('#propertiesTable tbody').innerHTML =
    props.map(r => `<tr><td>${r.PropertyID}</td><td>${r.PropertyAddress}</td><td>${r.OwnershipSharePercent}%</td><td>${r.PropertyType}</td></tr>`).join('');

  const foreignAccs = acct ? (acct.ForeignAccounts || []) : [];
  document.querySelector('#foreignAccountsTable tbody').innerHTML =
    foreignAccs.map(r => `<tr><td>${r.ForeignAccount}</td><td>${r.Entity}</td><td>${r.AccountNumber}</td></tr>`).join('');
}

function renderConfig() {
  // Show Rupee Symbol toggle
  const rupeeToggle = document.getElementById('cfgShowRupeeSymbol');
  rupeeToggle.checked = !DB.config || DB.config.ShowRupeeSymbol !== false;
  rupeeToggle.onchange = () => {
    if (!DB.config) DB.config = {};
    DB.config.ShowRupeeSymbol = rupeeToggle.checked;
    saveTable();
  };

  document.getElementById('accountCards').innerHTML =
    DB.accounts.map((r, i) => `<label class="account-card ${r.enabled !== false ? '' : 'disabled'}">
      <input type="checkbox" data-acc-idx="${i}" class="acc-toggle" ${r.enabled !== false ? 'checked' : ''}>
      <span class="account-card-code">${r.account}</span>
      <span class="account-card-name">${r.name}</span>
    </label>`).join('');

  // Wire enable/disable toggles
  document.querySelectorAll('.acc-toggle').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.accIdx);
      DB.accounts[idx].enabled = e.target.checked;
      saveTable();
      populateFilters();
    });
  });

  // Render all config tag lists
  const configContainer = document.getElementById('configLists');
  configContainer.innerHTML = CONFIG_LISTS.map(c =>
    `<div class="config-section">
      <h3>${c.label}</h3>
      <div id="cfg_${c.key}" class="config-tag-list"></div>
      <div class="config-add-row">
        <input type="text" data-cfg-key="${c.key}" placeholder="${c.placeholder}" class="config-input cfg-add-input">
        <button class="btn btn-sm cfg-add-btn" data-cfg-key="${c.key}">+ Add</button>
      </div>
    </div>`
  ).join('');
  CONFIG_LISTS.forEach(c => renderConfigTags('cfg_' + c.key, c.key));
  wireConfigAddButtons();

  // Render config reference tables
  const CONFIG_TABLES = [
    { key: 'CapitalGainsQuarters', label: 'Capital Gains Quarters (CgQ)' },
    { key: 'FYQuarters', label: 'Financial Year Quarters (QFY)' }
  ];
  const tablesContainer = document.getElementById('configTables');
  tablesContainer.innerHTML = CONFIG_TABLES.map(t => {
    const rows = (DB.config && DB.config[t.key]) || [];
    return `<div class="config-section">
      <h3>${t.label}</h3>
      <table class="config-ref-table">
        <thead><tr><th>Quarter</th><th>From</th><th>To</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${r.quarter}</td><td>${r.from}</td><td>${r.to}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
  }).join('');
}

// ---- All Income & Tax (unified view) ----
let aiSort = { col: 'date', dir: 1 }; // 1 = asc, -1 = desc

const AI_COLUMNS = [
  { key: 'date',        label: 'Date',                 type: 'string' },
  { key: 'category',    label: 'Category',             type: 'string' },
  { key: 'description', label: 'Description',          type: 'string' },
  { key: 'amount',      label: 'Amount',               type: 'number' },
  { key: 'amountFgn',   label: 'Amount ' + FC,          type: 'number' },
  { key: 'withheldFgn', label: 'Tax Withheld ' + FC,    type: 'number' },
  { key: 'relief',      label: 'Tax Relief',            type: 'number' },
  { key: 'tds',         label: 'TDS / Taxes Paid',      type: 'number' },
  { key: 'quarter',     label: 'Quarter',              type: 'string' }
];

function renderAllIncome() {
  const fy = getSelectedFY();
  const isDetailed = document.querySelector('input[name="aiView"]:checked')?.value === 'detailed';

  // Show/hide filters based on view mode
  const catLabel = document.getElementById('aiCategoryFilter').closest('label');
  const qtrLabel = document.getElementById('aiQuarterFilter').closest('label');
  if (isDetailed) {
    catLabel.classList.remove('d-none');
    qtrLabel.classList.remove('d-none');
  } else {
    catLabel.classList.add('d-none');
    qtrLabel.classList.add('d-none');
  }

  const rows = [];

  // Foreign Income
  filterByFY(getTable('ForeignIncome'), fy, 'ForeignIncome').forEach(r => {
    rows.push({
      date: r.IncomeDate,
      category: 'Foreign',
      description: `${r.IncomeSource || ''} — ${r.IncomeType || ''}`,
      amount: r.IncomeAmountINR || 0,
      amountFgn: r.IncomeAmount || 0,
      withheldFgn: r.TaxesWithheld || 0,
      relief: r.TaxesWithheldINR || 0,
      tds: 0,
      quarter: r.QFY || '',
      currency: r.Currency || ''
    });
  });

  // Property Income
  filterByFY(getTable('PropertyIncome'), fy, 'PropertyIncome').forEach(r => {
    rows.push({
      date: r.IncomeDate,
      category: 'Property',
      description: r.PropertyID || '',
      amount: r.GrossIncome || 0,
      amountFgn: 0, withheldFgn: 0, relief: 0,
      tds: r.TDSDeducted || 0,
      quarter: r.QFY || '',
      currency: ''
    });
  });

  // Capital Gains (manual)
  filterByFY(getTable('CapitalGainsConsolidated'), fy, 'CapitalGainsConsolidated').forEach(r => {
    rows.push({
      date: r.IncomeDate,
      category: 'Capital Gains',
      description: r.IncomeDescription || '',
      amount: r.IncomeAmount || 0,
      amountFgn: 0, withheldFgn: 0, relief: 0,
      tds: r.TDSDeducted || 0,
      quarter: r.CgQ || '',
      currency: ''
    });
  });

  // Capital Gains from Stock Sales
  const lotMap = {};
  getTable('StockPurchasesOrTransferIns').forEach(p => {
    if (p.PurchaseLotID) lotMap[p.PurchaseLotID] = p;
  });
  filterByFY(getTable('StockSalesOrTransferOuts'), fy, 'StockSalesOrTransferOuts').forEach(s => {
    if (s.IsTransferOut) return;
    const lots = s.PurchaseLots || [];
    let acqCostINR = 0;
    lots.forEach(l => {
      const p = lotMap[l.PurchaseLotID];
      if (p) acqCostINR += (l.SaleQuantity || 0) * (p.TotalPurchasePricePerUnit || 0) * (p.ExchangeRateToINR || 0);
    });
    const saleINR = s.TotalSaleValueINR || 0;
    const expINR = s.DomesticExpensesINR || 0;
    rows.push({
      date: s.SaleDate,
      category: 'Capital Gains (Stock)',
      description: `${s.SecurityName || ''} (${s.SaleQuantity || 0} units)`,
      amount: saleINR - acqCostINR - expINR,
      amountFgn: 0, withheldFgn: 0, relief: 0,
      tds: 0,
      quarter: s.CgQ || '',
      currency: ''
    });
  });

  // Salary Income
  filterByFY(getTable('SalaryIncome'), fy, 'SalaryIncome').forEach(r => {
    rows.push({
      date: r.EffectiveDate,
      category: 'Salary',
      description: r.Employer || '',
      amount: r.NetTaxableIncome || 0,
      amountFgn: 0, withheldFgn: 0, relief: 0,
      tds: r.TDSDeducted || 0,
      quarter: r.QFY || '',
      currency: ''
    });
  });

  // Other Income
  filterByFY(getTable('OtherIncome'), fy, 'OtherIncome').forEach(r => {
    rows.push({
      date: r.IncomeDate,
      category: 'Other',
      description: r.IncomeDescription || '',
      amount: r.IncomeAmount || 0,
      amountFgn: 0, withheldFgn: 0, relief: 0,
      tds: r.TDSDeducted || 0,
      quarter: r.QFY || '',
      currency: ''
    });
  });

  // Advance Tax
  filterByFY(getTable('AdvanceTax'), fy, 'AdvanceTax').forEach(r => {
    rows.push({
      date: r.EffectiveDate || r.PaymentDate,
      category: 'Advance Tax',
      description: r.PaymentDescription || '',
      amount: 0,
      amountFgn: 0, withheldFgn: 0, relief: 0,
      tds: r.TaxAmountPaid || 0,
      quarter: r.QFY || '',
      currency: ''
    });
  });

  // Apply filters (detailed view only)
  let filtered = rows;
  if (isDetailed) {
    const catFilter = document.getElementById('aiCategoryFilter').value;
    const qFilter = document.getElementById('aiQuarterFilter').value;
    filtered = rows.filter(r => {
      if (catFilter && r.category !== catFilter) return false;
      if (qFilter && r.quarter !== qFilter) return false;
      return true;
    });
  }

  const isAllYears = !fy || fy === 'All';
  const container = document.getElementById('allIncomeTableContainer');

  if (isAllYears) {
    // Group rows by FY, render one table per FY
    const fyGroups = {};
    filtered.forEach(r => {
      const rfy = dateToFY(r.date) || 'Unknown';
      if (!fyGroups[rfy]) fyGroups[rfy] = [];
      fyGroups[rfy].push(r);
    });
    const sortedFYs = Object.keys(fyGroups).sort().reverse();
    let html = '';
    sortedFYs.forEach(fyKey => {
      html += `<h5 class="mt-4 mb-2 fw-bold">FY ${fyKey}</h5>`;
      html += isDetailed ? buildDetailedTable(fyGroups[fyKey]) : buildSummaryTable(fyGroups[fyKey]);
    });
    container.innerHTML = html;
  } else {
    // Single FY — one table with FY header
    const table = isDetailed ? buildDetailedTable(filtered) : buildSummaryTable(filtered);
    container.innerHTML = `<h5 class="mt-4 mb-2 fw-bold">FY ${fy}</h5>${table}`;
  }

  // Wire sort handlers for detailed view
  if (isDetailed) {
    container.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (aiSort.col === col) { aiSort.dir *= -1; }
        else { aiSort.col = col; aiSort.dir = 1; }
        renderAllIncome();
      });
    });
  }

  // Compute and show total income cards (summary view only)
  const aiCardsEl = document.getElementById('aiTotalCards');
  if (!isDetailed) {
    const totalIncome_all = rows.filter(r => r.category !== 'Advance Tax').reduce((s, r) => s + r.amount, 0);
    const totalTDS_all = rows.reduce((s, r) => s + r.tds, 0);
    const totalRelief_all = rows.reduce((s, r) => s + r.relief, 0);
    aiCardsEl.innerHTML = `<div class="summary-cards d-flex gap-3 flex-wrap">
      <div class="summary-card card p-3"><span class="label">Total Taxable Income</span><div class="value ${totalIncome_all >= 0 ? 'positive' : 'negative'}">${fmtR(totalIncome_all)}</div></div>
      <div class="summary-card card p-3"><span class="label">Tax Relief</span><div class="value">${fmtR(totalRelief_all)}</div></div>
      <div class="summary-card card p-3"><span class="label">TDS / Taxes Paid</span><div class="value">${fmtR(totalTDS_all)}</div></div>
    </div>`;
  } else {
    aiCardsEl.innerHTML = '';
  }

  // Wire filter change events
  ['aiCategoryFilter', 'aiQuarterFilter'].forEach(id => {
    document.getElementById(id).onchange = renderAllIncome;
  });
}

function buildSummaryTable(rows) {
  const cats = {};
  rows.forEach(r => {
    if (!cats[r.category]) cats[r.category] = { income: 0, relief: 0, tds: 0 };
    cats[r.category].income += r.amount;
    cats[r.category].relief += r.relief;
    cats[r.category].tds += r.tds;
  });

  const catOrder = ['Salary', 'Foreign', 'Property', 'Capital Gains', 'Capital Gains (Stock)', 'Other', 'Advance Tax'];
  const catRows = catOrder.filter(c => cats[c]).map(c => {
    const d = cats[c];
    const rowClass = c === 'Advance Tax' ? '' : (d.income > 0 ? 'row-positive' : d.income < 0 ? 'row-negative' : '');
    return `<tr class="${rowClass}">
      <td>${c}</td>
      <td class="num">${d.income ? fmtR(d.income) : ''}</td>
      <td class="num">${d.relief ? fmtR(d.relief) : ''}</td>
      <td class="num">${d.tds ? fmtR(d.tds) : ''}</td>
    </tr>`;
  });

  const totalIncome = Object.entries(cats).filter(([k]) => k !== 'Advance Tax').reduce((s, [, v]) => s + v.income, 0);
  const totalRelief = Object.values(cats).reduce((s, v) => s + v.relief, 0);
  const totalTDS = Object.values(cats).reduce((s, v) => s + v.tds, 0);

  return `<table class="table table-sm table-hover align-middle">
    <thead><tr>
      <th>Income Head</th><th class="text-end">Income</th><th class="text-end">Tax Relief</th><th class="text-end">TDS / Taxes Paid</th>
    </tr></thead>
    <tbody>${catRows.join('')}</tbody>
    <tfoot><tr class="total-row">
      <td>Total Taxable Income</td>
      <td class="num">${fmtR(totalIncome)}</td>
      <td class="num">${fmtR(totalRelief)}</td>
      <td class="num">${fmtR(totalTDS)}</td>
    </tr></tfoot>
  </table>`;
}

function buildDetailedTable(rows) {
  const sc = AI_COLUMNS.find(c => c.key === aiSort.col);
  if (sc) {
    rows.sort((a, b) => {
      const av = a[sc.key], bv = b[sc.key];
      if (sc.type === 'number') return ((av || 0) - (bv || 0)) * aiSort.dir;
      return (av || '').localeCompare(bv || '') * aiSort.dir;
    });
  }

  const arrow = col => aiSort.col === col ? (aiSort.dir === 1 ? ' ▲' : ' ▼') : '';
  const thead = AI_COLUMNS.map(c =>
    `<th class="sortable${c.type === 'number' ? ' text-end' : ''}" data-sort="${c.key}">${c.label}${arrow(c.key)}</th>`
  ).join('');

  const tbody = rows.map(r => {
    const rowClass = r.category === 'Advance Tax' ? '' : (r.amount > 0 ? 'row-positive' : r.amount < 0 ? 'row-negative' : '');
    return `<tr class="${rowClass}">
      <td>${fmtDate(r.date)}</td>
      <td>${r.category}</td>
      <td>${r.description}</td>
      <td class="num">${r.amount ? fmtR(r.amount) : ''}</td>
      <td class="num">${r.amountFgn ? fmtC(r.amountFgn, r.currency) : ''}</td>
      <td class="num">${r.withheldFgn ? fmtC(r.withheldFgn, r.currency) : ''}</td>
      <td class="num">${r.relief ? fmtR(r.relief) : ''}</td>
      <td class="num">${r.tds ? fmtR(r.tds) : ''}</td>
      <td>${r.quarter}</td>
    </tr>`;
  }).join('');

  return `<table class="table table-sm table-hover align-middle">
    <thead><tr>${thead}</tr></thead>
    <tbody>${tbody}</tbody>
    <tfoot><tr class="total-row">
      <td colspan="3">Total</td>
      <td class="num">${fmtR(rows.reduce((s, r) => s + r.amount, 0))}</td>
      <td class="num">${fmt(rows.reduce((s, r) => s + r.amountFgn, 0))}</td>
      <td class="num">${fmt(rows.reduce((s, r) => s + r.withheldFgn, 0))}</td>
      <td class="num">${fmtR(rows.reduce((s, r) => s + r.relief, 0))}</td>
      <td class="num">${fmtR(rows.reduce((s, r) => s + r.tds, 0))}</td>
      <td></td>
    </tr></tfoot>
  </table>`;
}

// ---- Stock Holdings (as-on date, inventory view) ----
function getAsOnDefault() {
  const fy = getSelectedFY();
  const today = new Date().toISOString().slice(0, 10);
  if (!fy || fy === 'All') return today;
  const endYear = parseInt(fy.split('-')[0]) + 1;
  const fyEnd = `${endYear}-03-31`;
  return fyEnd < today ? fyEnd : today;
}

function renderStockHoldings() {
  const asOnInput = document.getElementById('shAsOnDate');
  const secFilter = document.getElementById('shSecurityFilter');
  if (!asOnInput.value) asOnInput.value = getAsOnDefault();
  const asOn = new Date(asOnInput.value + 'T23:59:59');

  const purchases = getTable('StockPurchasesOrTransferIns');
  const sales = getTable('StockSalesOrTransferOuts');

  // Populate security filter
  const allSecurities = [...new Set(purchases.map(p => p.SecurityName).filter(Boolean))].sort();
  const curSec = secFilter.value;
  secFilter.innerHTML = '<option value="">All</option>' +
    allSecurities.map(s => `<option value="${s}"${s === curSec ? ' selected' : ''}>${s}</option>`).join('');
  const secVal = secFilter.value;

  // Currency map
  const secCurrencyMap = {};
  purchases.forEach(p => { if (p.SecurityName && p.CurrencyCode) secCurrencyMap[p.SecurityName] = p.CurrencyCode; });

  // Filter purchases by as-on and security
  const filteredPurchases = purchases.filter(p => {
    if (secVal && p.SecurityName !== secVal) return false;
    if (asOn && new Date(p.PurchaseDate) > asOn) return false;
    return true;
  });

  // Compute sold qty per lot
  const soldPerLot = {};
  sales.forEach(s => {
    if (asOn && new Date(s.SaleDate) > asOn) return;
    (s.PurchaseLots || []).forEach(l => {
      soldPerLot[l.PurchaseLotID] = (soldPerLot[l.PurchaseLotID] || 0) + (l.SaleQuantity || 0);
    });
  });

  // Build inventory
  const inventory = {};
  filteredPurchases.forEach(p => {
    const sec = p.SecurityName || '';
    if (!inventory[sec]) inventory[sec] = { qty: 0, totalCost: 0, totalCostINR: 0, lots: [] };
    const inv = inventory[sec];
    const sold = soldPerLot[p.PurchaseLotID] || 0;
    const remaining = Math.max(0, (p.PurchaseQuantity || 0) - sold);
    const costRatio = (p.PurchaseQuantity || 0) > 0 ? remaining / p.PurchaseQuantity : 0;
    const lotCost = (p.TotalPurchaseValue || 0) * costRatio;
    const lotCostINR = (p.TotalPurchaseValueINR || 0) * costRatio;
    inv.qty += remaining;
    inv.totalCost += lotCost;
    inv.totalCostINR += lotCostINR;
    if (remaining > 0.0005) {
      inv.lots.push({
        lotId: p.PurchaseLotID || '',
        date: p.PurchaseDate,
        brokerage: p.BrokerageName || '',
        remaining,
        price: p.PurchasePricePerUnit || 0,
        currency: p.CurrencyCode || '',
        cost: lotCost,
        costINR: lotCostINR
      });
    }
  });

  const showLots = document.getElementById('shShowLots').checked;
  const totalEl = document.getElementById('shTotalHoldings');
  const container = document.getElementById('shTableContainer');

  if (showLots) {
    const thead = `<th>Security</th><th>Lot ID</th><th>Date</th><th>Brokerage</th><th class="text-end">Remaining</th><th class="text-end">Price ${FC}</th><th class="text-end">Cost ${FC}</th><th class="text-end">Cost (INR)</th>`;
    const entries = Object.entries(inventory).filter(([, v]) => v.qty > 0.0005).sort((a, b) => a[0].localeCompare(b[0]));
    let tbody = '';
    entries.forEach(([sec, inv]) => {
      const cur = secCurrencyMap[sec] || '';
      inv.lots.forEach((lot, i) => {
        tbody += `<tr class="lot-detail-row">
          <td>${i === 0 ? sec : ''}</td>
          <td class="text-muted">${lot.lotId}</td>
          <td>${fmtDate(lot.date)}</td>
          <td>${lot.brokerage}</td>
          <td class="num">${lot.remaining.toFixed(3)}</td>
          <td class="num">${fmtC(lot.price, lot.currency)}</td>
          <td class="num">${fmtC(lot.cost, lot.currency)}</td>
          <td class="num">${fmtR(lot.costINR)}</td>
        </tr>`;
      });
      const avg = inv.qty > 0 ? inv.totalCost / inv.qty : 0;
      tbody += `<tr class="lot-total-row fw-bold">
        <td>${sec} Total</td><td></td><td></td><td></td>
        <td class="num">${inv.qty.toFixed(3)}</td>
        <td class="num">${fmtC(avg, cur)}</td>
        <td class="num">${fmtC(inv.totalCost, cur)}</td>
        <td class="num">${fmtR(inv.totalCostINR)}</td>
      </tr>`;
    });
    container.innerHTML = `<h5 class="mt-4 mb-2 fw-bold">Holdings as on ${fmtDate(asOnInput.value)}</h5><table class="table table-sm table-hover align-middle"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
  } else {
    const thead = `<th>Security</th><th class="text-end">Quantity</th><th class="text-end">Avg Cost ${FC}</th><th class="text-end">Total Cost ${FC}</th><th class="text-end">Total Cost (INR)</th>`;
    const entries = Object.entries(inventory).filter(([, v]) => v.qty > 0.0005).sort((a, b) => a[0].localeCompare(b[0]));
    const tbody = entries.map(([sec, inv]) => {
      const avg = inv.qty > 0 ? inv.totalCost / inv.qty : 0;
      const cur = secCurrencyMap[sec] || '';
      return `<tr>
        <td>${sec}</td>
        <td class="num">${inv.qty.toFixed(3)}</td>
        <td class="num">${fmtC(avg, cur)}</td>
        <td class="num">${fmtC(inv.totalCost, cur)}</td>
        <td class="num">${fmtR(inv.totalCostINR)}</td>
      </tr>`;
    }).join('');
    container.innerHTML = `<h5 class="mt-4 mb-2 fw-bold">Holdings as on ${fmtDate(asOnInput.value)}</h5><table class="table table-sm table-hover align-middle"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
  }

  // Total holdings
  let grandTotalINR = 0;
  Object.values(inventory).forEach(inv => { grandTotalINR += inv.totalCostINR; });
  totalEl.classList.remove('d-none');
  totalEl.innerHTML = `<div class="summary-cards"><div class="summary-card card p-3"><span class="label">Total Holdings Value</span><div class="value">${fmtR(grandTotalINR)}</div></div></div>`;

  asOnInput.onchange = renderStockHoldings;
  secFilter.onchange = renderStockHoldings;
  document.getElementById('shShowLots').onchange = renderStockHoldings;
}

// ---- Stock Transactions (FY-filtered transaction log) ----
function renderStockTransactions() {
  const secFilter = document.getElementById('stSecurityFilter');
  const fy = getSelectedFY();

  const purchases = getTable('StockPurchasesOrTransferIns');
  const sales = getTable('StockSalesOrTransferOuts');

  // Populate security filter
  const allSecurities = [...new Set(purchases.map(p => p.SecurityName).filter(Boolean))].sort();
  const curSec = secFilter.value;
  secFilter.innerHTML = '<option value="">All</option>' +
    allSecurities.map(s => `<option value="${s}"${s === curSec ? ' selected' : ''}>${s}</option>`).join('');
  const secVal = secFilter.value;

  // Currency map
  const secCurrencyMap = {};
  purchases.forEach(p => { if (p.SecurityName && p.CurrencyCode) secCurrencyMap[p.SecurityName] = p.CurrencyCode; });

  const rows = [];

  // Add purchases (FY-filtered)
  filterByFY(purchases, fy, 'StockPurchasesOrTransferIns').forEach(p => {
    if (secVal && p.SecurityName !== secVal) return;
    rows.push({
      date: p.PurchaseDate,
      type: p.IsTransferIn ? 'Transfer In' : 'Buy',
      security: p.SecurityName || '',
      brokerage: p.BrokerageName || '',
      qty: p.PurchaseQuantity || 0,
      price: p.PurchasePricePerUnit || 0,
      value: p.TotalPurchaseValue || 0,
      currency: p.CurrencyCode || '',
      rate: p.ExchangeRateToINR || 0,
      valueINR: p.TotalPurchaseValueINR || 0,
      lotId: p.PurchaseLotID || ''
    });
  });

  // Add sales (FY-filtered)
  filterByFY(sales, fy, 'StockSalesOrTransferOuts').forEach(s => {
    if (secVal && s.SecurityName !== secVal) return;
    const lots = s.PurchaseLots || [];
    const totalLotQty = lots.reduce((sum, l) => sum + (l.SaleQuantity || 0), 0);
    const pricePerUnit = totalLotQty > 0 ? (s.SaleAmount || 0) / totalLotQty : 0;
    rows.push({
      date: s.SaleDate,
      type: s.IsTransferOut ? 'Transfer Out' : 'Sell',
      security: s.SecurityName || '',
      brokerage: s.BrokerageName || '',
      qty: -(s.SaleQuantity || 0),
      price: pricePerUnit,
      value: s.TotalSaleValue || 0,
      currency: '',
      rate: s.ExchangeRateToINR || 0,
      valueINR: s.TotalSaleValueINR || 0,
      lotId: lots.map(l => l.PurchaseLotID).join(', ')
    });
  });

  // Resolve currency for sell rows
  rows.forEach(r => { if (!r.currency && r.security) r.currency = secCurrencyMap[r.security] || ''; });

  // Sort by date, buys before sells on same date
  rows.sort((a, b) => {
    const dc = (a.date || '').localeCompare(b.date || '');
    if (dc !== 0) return dc;
    return (a.type === 'Buy' || a.type === 'Transfer In') ? -1 : 1;
  });

  const container = document.getElementById('stTableContainer');
  const isAllYears = !fy || fy === 'All';

  if (isAllYears) {
    const fyGroups = {};
    rows.forEach(r => {
      const rfy = dateToFY(r.date) || 'Unknown';
      if (!fyGroups[rfy]) fyGroups[rfy] = [];
      fyGroups[rfy].push(r);
    });
    const sortedFYs = Object.keys(fyGroups).sort().reverse();
    let html = '';
    sortedFYs.forEach(fyKey => {
      html += `<h5 class="mt-4 mb-2 fw-bold">FY ${fyKey}</h5>`;
      html += buildStockTxnTable(fyGroups[fyKey]);
    });
    container.innerHTML = html;
  } else {
    container.innerHTML = `<h5 class="mt-4 mb-2 fw-bold">FY ${fy}</h5>` + buildStockTxnTable(rows);
  }

  secFilter.onchange = renderStockTransactions;
}

function buildStockTxnTable(rows) {
  const balances = {};
  const thead = `<th>Date</th><th>Type</th><th>Security</th><th>Brokerage</th><th class="text-end">Qty</th><th class="text-end">Price/Unit ${FC}</th><th class="text-end">Value ${FC}</th><th class="text-end">Rate (INR)</th><th class="text-end">Value (INR)</th><th class="text-end">Balance Units</th><th>Lot ID</th>`;

  const tbody = rows.map(r => {
    balances[r.security] = (balances[r.security] || 0) + r.qty;
    const bal = balances[r.security];
    const rowClass = (r.type === 'Sell' || r.type === 'Transfer Out') ? 'row-sell' : 'row-buy';
    return `<tr class="${rowClass}">
      <td>${fmtDate(r.date)}</td>
      <td>${r.type}</td>
      <td>${r.security}</td>
      <td>${r.brokerage}</td>
      <td class="num">${r.qty > 0 ? '+' : ''}${r.qty}</td>
      <td class="num">${fmtC(r.price, r.currency)}</td>
      <td class="num">${fmtC(r.value, r.currency)}</td>
      <td class="num">${fmt(r.rate)}</td>
      <td class="num">${fmtR(r.valueINR)}</td>
      <td class="num">${bal.toFixed(3)}</td>
      <td>${r.lotId}</td>
    </tr>`;
  }).join('');

  return `<table class="table table-sm table-hover align-middle">
    <thead><tr>${thead}</tr></thead>
    <tbody>${tbody}</tbody>
  </table>`;
}

// ---- Capital Gains View (unified) ----
let cgvSort = { col: 'date', dir: 1 };

const CGV_COLUMNS = [
  { key: 'date',        label: 'Date',             type: 'string' },
  { key: 'source',      label: 'Source',            type: 'string' },
  { key: 'description', label: 'Description',       type: 'string' },
  { key: 'holdingType', label: 'Type',              type: 'string' },
  { key: 'saleValue',   label: 'Sale Value',        type: 'number' },
  { key: 'acqCost',     label: 'Acquisition Cost',  type: 'number' },
  { key: 'expenses',    label: 'Expenses',          type: 'number' },
  { key: 'gainLoss',    label: 'Gain/Loss',         type: 'number' },
  { key: 'tds',         label: 'TDS',               type: 'number' },
  { key: 'quarter',     label: 'Quarter',           type: 'string' }
];

function renderCapitalGainsView() {
  const fy = getSelectedFY();
  const rows = [];

  // Build purchase lot lookup: PurchaseLotID -> purchase record
  const lotMap = {};
  getTable('StockPurchasesOrTransferIns').forEach(p => {
    if (p.PurchaseLotID) lotMap[p.PurchaseLotID] = p;
  });

  // Stock Sales → Capital Gains rows
  filterByFY(getTable('StockSalesOrTransferOuts'), fy, 'StockSalesOrTransferOuts').forEach(s => {
    if (s.IsTransferOut) return;
    const lots = s.PurchaseLots || [];
    let acqCostINR = 0;
    let earliestPurchaseDate = null;

    lots.forEach(l => {
      const p = lotMap[l.PurchaseLotID];
      if (p) {
        acqCostINR += (l.SaleQuantity || 0) * (p.TotalPurchasePricePerUnit || 0) * (p.ExchangeRateToINR || 0);
        const pd = p.PurchaseDate ? new Date(p.PurchaseDate) : null;
        if (pd && (!earliestPurchaseDate || pd < earliestPurchaseDate)) earliestPurchaseDate = pd;
      }
    });

    const saleDate = s.SaleDate ? new Date(s.SaleDate) : null;
    const holdingDays = (saleDate && earliestPurchaseDate) ? Math.floor((saleDate - earliestPurchaseDate) / 86400000) : null;
    const holdingType = holdingDays != null ? (holdingDays > 365 ? 'LTCG' : 'STCG') : '—';

    const saleValueINR = s.TotalSaleValueINR || 0;
    const expINR = (s.DomesticExpensesINR || 0);
    const gainLoss = saleValueINR - acqCostINR - expINR;

    rows.push({
      date: s.SaleDate,
      source: 'Stock',
      description: `${s.SecurityName || ''} (${s.SaleQuantity || 0} units)`,
      holdingType,
      saleValue: saleValueINR,
      acqCost: acqCostINR,
      expenses: expINR,
      gainLoss,
      tds: 0,
      quarter: s.CgQ || '',
      taxable: 'Yes'
    });
  });

  // Capital Gains Consolidated → rows
  filterByFY(getTable('CapitalGainsConsolidated'), fy, 'CapitalGainsConsolidated').forEach(r => {
    rows.push({
      date: r.IncomeDate,
      source: 'Manual',
      description: r.IncomeDescription || '',
      holdingType: r.GainsType || '—',
      saleValue: r.SaleValue || 0,
      acqCost: r.AcquisitionCost || 0,
      expenses: r.Expenses || 0,
      gainLoss: r.IncomeAmount || 0,
      tds: r.TDSDeducted || 0,
      quarter: r.CgQ || '',
      taxable: r.NonTaxable ? 'No' : 'Yes'
    });
  });

  // Apply filters
  const srcFilter = document.getElementById('cgvSourceFilter').value;
  const qFilter = document.getElementById('cgvQuarterFilter').value;
  const typeFilter = document.getElementById('cgvTypeFilter').value;

  const filtered = rows.filter(r => {
    if (srcFilter && r.source !== srcFilter) return false;
    if (qFilter && r.quarter !== qFilter) return false;
    if (typeFilter && r.holdingType !== typeFilter) return false;
    return true;
  });

  // Sort
  const sc = CGV_COLUMNS.find(c => c.key === cgvSort.col);
  if (sc) {
    filtered.sort((a, b) => {
      const av = a[sc.key], bv = b[sc.key];
      if (sc.type === 'number') return ((av || 0) - (bv || 0)) * cgvSort.dir;
      return (av || '').localeCompare(bv || '') * cgvSort.dir;
    });
  }

  // Render into container with FY grouping
  const isAllYears = !fy || fy === 'All';
  const container = document.getElementById('cgvTableContainer');

  if (isAllYears) {
    const fyGroups = {};
    filtered.forEach(r => {
      const rfy = dateToFY(r.date) || 'Unknown';
      if (!fyGroups[rfy]) fyGroups[rfy] = [];
      fyGroups[rfy].push(r);
    });
    const sortedFYs = Object.keys(fyGroups).sort().reverse();
    let html = '';
    sortedFYs.forEach(fyKey => {
      html += `<h5 class="mt-4 mb-2 fw-bold">FY ${fyKey}</h5>`;
      html += buildCgvTable(fyGroups[fyKey]);
    });
    container.innerHTML = html;
  } else {
    container.innerHTML = `<h5 class="mt-4 mb-2 fw-bold">FY ${fy}</h5>` + buildCgvTable(filtered);
  }

  // Wire sort handlers
  container.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (cgvSort.col === col) { cgvSort.dir *= -1; }
      else { cgvSort.col = col; cgvSort.dir = 1; }
      renderCapitalGainsView();
    });
  });

  // Summary cards
  const cgvTotalSaleVal = filtered.reduce((s, r) => s + r.saleValue, 0);
  const cgvTotalGainVal = filtered.reduce((s, r) => s + r.gainLoss, 0);
  document.getElementById('cgvTotalCards').innerHTML = `<div class="summary-cards d-flex gap-3 flex-wrap">
    <div class="summary-card card p-3"><span class="label">Total Sale Consideration</span><div class="value">${fmtR(cgvTotalSaleVal)}</div></div>
    <div class="summary-card card p-3"><span class="label">Total Gain / Loss</span><div class="value ${cgvTotalGainVal >= 0 ? 'positive' : 'negative'}">${fmtR(cgvTotalGainVal)}</div></div>
  </div>`;

  // Wire filters
  ['cgvSourceFilter', 'cgvQuarterFilter', 'cgvTypeFilter'].forEach(id => {
    document.getElementById(id).onchange = renderCapitalGainsView;
  });
}

function buildCgvTable(rows) {
  const arrow = col => cgvSort.col === col ? (cgvSort.dir === 1 ? ' ▲' : ' ▼') : '';
  const thead = CGV_COLUMNS.map(c =>
    `<th class="sortable${c.type === 'number' ? ' text-end' : ''}" data-sort="${c.key}">${c.label}${arrow(c.key)}</th>`
  ).join('');

  const tbody = rows.map(r => {
    const rowClass = r.gainLoss > 0 ? 'row-positive' : r.gainLoss < 0 ? 'row-negative' : '';
    return `<tr class="${rowClass}">
      <td>${fmtDate(r.date)}</td>
      <td>${r.source}</td>
      <td>${r.description}</td>
      <td>${r.holdingType}</td>
      <td class="num">${fmtR(r.saleValue)}</td>
      <td class="num">${fmtR(r.acqCost)}</td>
      <td class="num">${fmtR(r.expenses)}</td>
      <td class="num ${r.gainLoss >= 0 ? 'positive' : 'negative'}">${fmtR(r.gainLoss)}</td>
      <td class="num">${r.tds ? fmtR(r.tds) : ''}</td>
      <td>${r.quarter}</td>
    </tr>`;
  }).join('');

  return `<table class="table table-sm table-hover align-middle">
    <thead><tr>${thead}</tr></thead>
    <tbody>${tbody}</tbody>
    <tfoot><tr class="total-row">
      <td colspan="4"><strong>Total</strong></td>
      <td class="num">${fmtR(rows.reduce((s, r) => s + r.saleValue, 0))}</td>
      <td class="num">${fmtR(rows.reduce((s, r) => s + r.acqCost, 0))}</td>
      <td class="num">${fmtR(rows.reduce((s, r) => s + r.expenses, 0))}</td>
      <td class="num">${fmtR(rows.reduce((s, r) => s + r.gainLoss, 0))}</td>
      <td class="num">${fmtR(rows.reduce((s, r) => s + r.tds, 0))}</td>
      <td></td>
    </tr></tfoot>
  </table>`;
}

// ============================================================
// Export Computations
// ============================================================
function buildExportData() {
  const fy = getSelectedFY();
  const acct = getCurrentAccountData();
  if (!acct) return null;

  const asOnDate = getAsOnDefault();

  // Build a FinbookCore context using the browser's global DB + selectedAccount
  const ctx = FinbookCore.createContext(DB, selectedAccount);
  const incomeSummary = FinbookCore.reports.incomeSummary(ctx, fy);
  const capitalGains = FinbookCore.reports.capitalGains(ctx, fy);
  const stockBook = FinbookCore.reports.holdings(ctx, asOnDate);

  // Per-record computed data (all tables, FY-filtered)
  const computedRecords = {};
  TABLE_NAMES.forEach(t => {
    const rows = filterByFY(getTable(t), fy, t);
    computedRecords[t] = rows.map(r => ({ ...r }));
  });

  return {
    exportDate: new Date().toISOString().slice(0, 10),
    account: acct.name || acct.account,
    financialYear: fy || 'All',
    incomeSummary: {
      byCategory: incomeSummary.byCategory,
      totalTaxableIncome: incomeSummary.totalIncome,
      totalRelief: incomeSummary.totalRelief,
      totalTDS: incomeSummary.totalTDS
    },
    capitalGains: {
      transactions: capitalGains.rows,
      totalGainLoss: capitalGains.totalGainLoss,
      ltcgTotal: capitalGains.ltcg,
      stcgTotal: capitalGains.stcg
    },
    stockBook: {
      asOnDate: stockBook.asOnDate,
      holdings: stockBook.holdings,
      totalPortfolioValue: stockBook.totalPortfolioValue
    },
    allIncomeRows: incomeSummary.rows,
    computedRecords
  };
}

function exportComputedData() {
  const data = buildExportData();
  if (!data) return;
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const acctSlug = (data.account || 'export').replace(/\s+/g, '_');
  a.download = `${acctSlug}_Computed_${data.financialYear}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Render map
const SECTION_RENDERERS = {
  salaryIncome: renderSalaryIncome,
  foreignIncome: renderForeignIncome,
  propertyIncome: renderPropertyIncome,
  capitalGains: renderCapitalGains,
  otherIncome: renderOtherIncome,
  stockPurchases: renderStockPurchases,
  stockSales: renderStockSales,
  stockBook: renderStockHoldings,
  stockHoldings: renderStockHoldings,
  stockTransactions: renderStockTransactions,
  capitalGainsView: renderCapitalGainsView,
  advanceTax: renderAdvanceTax,
  allIncome: renderAllIncome,
  settings: renderSettings,
  config: renderConfig,
  help: () => {} // static HTML, no render needed
};

let currentSection = 'allIncome';

function renderCurrentSection() {
  const renderer = SECTION_RENDERERS[currentSection];
  if (renderer) renderer();
}
