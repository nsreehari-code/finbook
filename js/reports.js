// reports.js — Rendering logic for each section/report

function getSelectedFY() {
  return document.getElementById('fyFilter').value;
}

function actionBtns(formKey, id, isLocked) {
  if (isLocked) {
    return `<button class="btn-sm btn-unlock" onclick="unlockEntry('${formKey}','${id}')">Unlock</button>`;
  }
  return `<button class="btn-sm" onclick="openModal('${formKey}', getEntryById('${formKey}','${id}'))">Edit</button>
          <button class="btn-sm btn-danger" onclick="deleteEntry('${formKey}','${id}')">Del</button>
          <button class="btn-sm btn-lock" onclick="lockEntry('${formKey}','${id}')">Lock</button>`;
}

function getEntryById(formKey, id) {
  const def = FORM_DEFS[formKey];
  return getTable(def.table).find(r => r[def.idField] === id);
}

// ---- Dashboard ----
// ---- Foreign Income ----
function renderForeignIncome() {
  const fy = getSelectedFY();
  const data = filterByFY(getTable('ForeignIncome'), fy, 'ForeignIncome')
    .sort((a, b) => (a.IncomeDate || '').localeCompare(b.IncomeDate || ''));

  document.querySelector('#foreignIncomeTable tbody').innerHTML = data.map(r => `
    <tr>
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
    </tr>
  `).join('');

  document.getElementById('fiTotalAmountINR').textContent = fmtR(data.reduce((s, r) => s + (r.IncomeAmountINR || 0), 0));
  document.getElementById('fiTotalTaxINR').textContent = fmtR(data.reduce((s, r) => s + (r.TaxesWithheldINR || 0), 0));
}

// ---- Property Income ----
function renderPropertyIncome() {
  const fy = getSelectedFY();
  const data = filterByFY(getTable('PropertyIncome'), fy, 'PropertyIncome');

  document.querySelector('#propertyIncomeTable tbody').innerHTML = data.map(r => `
    <tr>
      <td>${fmtDate(r.IncomeDate)}</td>
      <td>${r.PropertyID || ''}</td>
      <td class="num">${fmtR(r.GrossIncome)}</td>
      <td class="num">${fmtR(r.TotalExpenses)}</td>
      <td class="num">${fmtR(r.NetIncome)}</td>
      <td class="num">${fmtR(r.TDSDeducted)}</td>
      <td>${r.Details || ''}</td>
      <td>${actionBtns('propertyIncome', r.PropertyIncomeID, r.IsLocked)}</td>
    </tr>
  `).join('');

  document.getElementById('piTotalGross').textContent = fmtR(data.reduce((s, r) => s + (r.GrossIncome || 0), 0));
  document.getElementById('piTotalExpenses').textContent = fmtR(data.reduce((s, r) => s + (r.TotalExpenses || 0), 0));
  document.getElementById('piTotalNet').textContent = fmtR(data.reduce((s, r) => s + (r.NetIncome || 0), 0));
  document.getElementById('piTotalTDS').textContent = fmtR(data.reduce((s, r) => s + (r.TDSDeducted || 0), 0));
}

// ---- Capital Gains ----
function renderCapitalGains() {
  const fy = getSelectedFY();
  const data = filterByFY(getTable('CapitalGainsConsolidated'), fy, 'CapitalGainsConsolidated');

  document.querySelector('#capitalGainsTable tbody').innerHTML = data.map(r => `
    <tr>
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
    </tr>
  `).join('');

  document.getElementById('cgTotalSale').textContent = fmtR(data.reduce((s, r) => s + (r.SaleValue || 0), 0));
  document.getElementById('cgTotalAcq').textContent = fmtR(data.reduce((s, r) => s + (r.AcquisitionCost || 0), 0));
  document.getElementById('cgTotalExp').textContent = fmtR(data.reduce((s, r) => s + (r.Expenses || 0), 0));
  document.getElementById('cgTotalGain').textContent = fmtR(data.reduce((s, r) => s + (r.IncomeAmount || 0), 0));
  document.getElementById('cgTotalTDS').textContent = fmtR(data.reduce((s, r) => s + (r.TDSDeducted || 0), 0));
}

// ---- Other Income ----
function renderOtherIncome() {
  const fy = getSelectedFY();
  const data = filterByFY(getTable('OtherIncome'), fy, 'OtherIncome');

  document.querySelector('#otherIncomeTable tbody').innerHTML = data.map(r => `
    <tr>
      <td>${fmtDate(r.IncomeDate)}</td>
      <td>${r.IncomeDescription || ''}</td>
      <td class="num">${fmtR(r.IncomeAmount)}</td>
      <td class="num">${fmtR(r.TDSDeducted)}</td>
      <td>${r.NonTaxable ? 'No' : 'Yes'}</td>
      <td>${r.Remarks || ''}</td>
      <td>${actionBtns('otherIncome', r.OtherIncomeID, r.IsLocked)}</td>
    </tr>
  `).join('');

  document.getElementById('oiTotalAmount').textContent = fmtR(data.reduce((s, r) => s + (r.IncomeAmount || 0), 0));
  document.getElementById('oiTotalTDS').textContent = fmtR(data.reduce((s, r) => s + (r.TDSDeducted || 0), 0));
}

// ---- Stock Purchases ----
function renderStockPurchases() {
  const fy = getSelectedFY();
  const data = filterByFY(getTable('StockPurchases'), fy, 'StockPurchases')
    .sort((a, b) => (a.PurchaseDate || '').localeCompare(b.PurchaseDate || ''));

  document.querySelector('#stockPurchasesTable tbody').innerHTML = data.map(r => `
    <tr>
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
      <td>${actionBtns('stockPurchase', r.StockPurchaseID, r.IsLocked)}</td>
    </tr>
  `).join('');
}

// ---- Stock Sales ----
function renderStockSales() {
  const fy = getSelectedFY();
  const data = filterByFY(getTable('StockSales'), fy, 'StockSales')
    .sort((a, b) => (a.SaleDate || '').localeCompare(b.SaleDate || ''));

  // Build currency map from purchases
  const secCurrencyMap = {};
  getTable('StockPurchases').forEach(p => {
    const key = `${p.BrokerageName}|${p.SecurityName}`;
    if (p.CurrencyCode) secCurrencyMap[key] = p.CurrencyCode;
  });

  document.querySelector('#stockSalesTable tbody').innerHTML = data.map(r => {
    const lotInfo = (r.PurchaseLots || []).map(l =>
      `${l.SaleQuantity} × ${l.PurchaseLotID || 'Unknown'}`
    ).join('<br>');
    const cur = secCurrencyMap[`${r.BrokerageName}|${r.SecurityName}`] || '';

    return `
      <tr>
        <td>${fmtDate(r.SaleDate)}</td>
        <td>${r.BrokerageName || '—'}</td>
        <td>${r.SecurityName || '—'}</td>
        <td class="num">${fmt(r.SaleQuantity)}</td>
        <td class="num">${fmtC(r.SaleAmount, cur)}</td>
        <td class="num">${fmtC(r.SaleExpenses, cur)}</td>
        <td class="num">${fmt(r.ExchangeRateToINR)}</td>
        <td class="num">${fmtR(r.TotalSaleValueINR)}</td>
        <td>${lotInfo || '—'}</td>
        <td>${actionBtns('stockSale', r.StockSaleID, r.IsLocked)}</td>
      </tr>
    `;
  }).join('');
}

// ---- Advance Tax ----
function renderAdvanceTax() {
  const fy = getSelectedFY();
  const data = filterByFY(getTable('AdvanceTax'), fy, 'AdvanceTax');

  document.querySelector('#advanceTaxTable tbody').innerHTML = data.map(r => `
    <tr>
      <td>${fmtDate(r.PaymentDate)}</td>
      <td>${fmtDate(r.EffectiveDate)}</td>
      <td class="num">${fmtR(r.TaxAmountPaid)}</td>
      <td>${r.PaymentDescription || ''}</td>
      <td>${r.Remarks || ''}</td>
      <td>${actionBtns('advanceTax', r.AdvanceTaxID, r.IsLocked)}</td>
    </tr>
  `).join('');

  document.getElementById('atTotalAmount').textContent = fmtR(data.reduce((s, r) => s + (r.TaxAmountPaid || 0), 0));
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
  { key: 'amountFgn',   label: 'Amount (Cur)',          type: 'number' },
  { key: 'withheldFgn', label: 'Tax Withheld (Cur)',    type: 'number' },
  { key: 'relief',      label: 'Tax Relief',            type: 'number' },
  { key: 'tds',         label: 'TDS / Taxes Paid',      type: 'number' },
  { key: 'quarter',     label: 'Quarter',              type: 'string' }
];

function renderAllIncome() {
  const fy = getSelectedFY();
  const viewToggle = document.getElementById('aiViewToggle');
  const isDetailed = viewToggle.dataset.value === 'detailed';

  // Show/hide filters based on view mode
  document.getElementById('aiCategoryFilter').closest('label').style.display = isDetailed ? '' : 'none';
  document.getElementById('aiQuarterFilter').closest('label').style.display = isDetailed ? '' : 'none';

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
  getTable('StockPurchases').forEach(p => {
    if (p.PurchaseLotID) lotMap[p.PurchaseLotID] = p;
  });
  filterByFY(getTable('StockSales'), fy, 'StockSales').forEach(s => {
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

  if (isDetailed) {
    // Detailed view: row-by-row with sortable headers
    const sc = AI_COLUMNS.find(c => c.key === aiSort.col);
    if (sc) {
      filtered.sort((a, b) => {
        const av = a[sc.key], bv = b[sc.key];
        if (sc.type === 'number') return ((av || 0) - (bv || 0)) * aiSort.dir;
        return (av || '').localeCompare(bv || '') * aiSort.dir;
      });
    }

    const arrow = col => aiSort.col === col ? (aiSort.dir === 1 ? ' ▲' : ' ▼') : '';
    document.querySelector('#allIncomeTable thead tr').innerHTML = AI_COLUMNS.map(c =>
      `<th class="sortable" data-sort="${c.key}">${c.label}${arrow(c.key)}</th>`
    ).join('');

    document.querySelectorAll('#allIncomeTable th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (aiSort.col === col) { aiSort.dir *= -1; }
        else { aiSort.col = col; aiSort.dir = 1; }
        renderAllIncome();
      });
    });

    document.querySelector('#allIncomeTable tbody').innerHTML = filtered.map(r => {
      const rowClass = r.category === 'Advance Tax' ? '' : (r.amount > 0 ? 'row-positive' : r.amount < 0 ? 'row-negative' : '');
      return `
      <tr class="${rowClass}">
        <td>${fmtDate(r.date)}</td>
        <td>${r.category}</td>
        <td>${r.description}</td>
        <td class="num">${r.amount ? fmtR(r.amount) : ''}</td>
        <td class="num">${r.amountFgn ? fmtC(r.amountFgn, r.currency) : ''}</td>
        <td class="num">${r.withheldFgn ? fmtC(r.withheldFgn, r.currency) : ''}</td>
        <td class="num">${r.relief ? fmtR(r.relief) : ''}</td>
        <td class="num">${r.tds ? fmtR(r.tds) : ''}</td>
        <td>${r.quarter}</td>
      </tr>
    `;
    }).join('');

    document.querySelector('#allIncomeTable tfoot').innerHTML = `
      <tr class="total-row">
        <td colspan="3">Total</td>
        <td class="num">${fmtR(filtered.reduce((s, r) => s + r.amount, 0))}</td>
        <td class="num">${fmt(filtered.reduce((s, r) => s + r.amountFgn, 0))}</td>
        <td class="num">${fmt(filtered.reduce((s, r) => s + r.withheldFgn, 0))}</td>
        <td class="num">${fmtR(filtered.reduce((s, r) => s + r.relief, 0))}</td>
        <td class="num">${fmtR(filtered.reduce((s, r) => s + r.tds, 0))}</td>
        <td></td>
      </tr>`;

  } else {
    // Summary view: one row per category
    const cats = {};
    filtered.forEach(r => {
      if (!cats[r.category]) cats[r.category] = { income: 0, relief: 0, tds: 0 };
      cats[r.category].income += r.amount;
      cats[r.category].relief += r.relief;
      cats[r.category].tds += r.tds;
    });

    document.querySelector('#allIncomeTable thead tr').innerHTML =
      '<th>Income Head</th><th>Income</th><th>Tax Relief</th><th>TDS / Taxes Paid</th>';

    const catOrder = ['Foreign', 'Property', 'Capital Gains', 'Capital Gains (Stock)', 'Other', 'Advance Tax'];
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

    document.querySelector('#allIncomeTable tbody').innerHTML = catRows.join('');
    document.querySelector('#allIncomeTable tfoot').innerHTML = `
      <tr class="total-row">
        <td>Total Taxable Income</td>
        <td class="num">${fmtR(totalIncome)}</td>
        <td class="num">${fmtR(totalRelief)}</td>
        <td class="num">${fmtR(totalTDS)}</td>
      </tr>`;
  }

  // Wire filter change events
  ['aiCategoryFilter', 'aiQuarterFilter'].forEach(id => {
    document.getElementById(id).onchange = renderAllIncome;
  });
}

// ---- Stock Book (transaction log) ----
function renderStockBook() {
  const asOnInput = document.getElementById('sbAsOnDate');
  const secFilter = document.getElementById('sbSecurityFilter');
  const viewToggle = document.getElementById('sbViewToggle');
  if (!asOnInput.value) asOnInput.value = new Date().toISOString().slice(0, 10);
  const asOn = new Date(asOnInput.value + 'T23:59:59');

  // Build merged transaction rows from purchases and sales
  const purchases = getTable('StockPurchases');
  const sales = getTable('StockSales');

  // Populate security filter options
  const allSecurities = [...new Set(purchases.map(p => p.SecurityName).filter(Boolean))].sort();
  const curSec = secFilter.value;
  secFilter.innerHTML = '<option value="">All</option>' +
    allSecurities.map(s => `<option value="${s}"${s === curSec ? ' selected' : ''}>${s}</option>`).join('');

  const secVal = secFilter.value;
  const rows = [];

  // Add purchases
  purchases.forEach(p => {
    if (secVal && p.SecurityName !== secVal) return;
    const d = new Date(p.PurchaseDate);
    if (asOn && d > asOn) return;
    rows.push({
      date: p.PurchaseDate,
      type: 'Buy',
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

  // Add sales (expand each sale's lots as separate rows)
  sales.forEach(s => {
    if (secVal && s.SecurityName !== secVal) return;
    const d = new Date(s.SaleDate);
    if (asOn && d > asOn) return;
    const lots = s.PurchaseLots || [];
    const totalLotQty = lots.reduce((sum, l) => sum + (l.SaleQuantity || 0), 0);
    const pricePerUnit = totalLotQty > 0 ? (s.SaleAmount || 0) / totalLotQty : 0;
    rows.push({
      date: s.SaleDate,
      type: 'Sell',
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

  // Resolve currency for sell rows from purchases
  const secCurrencyMap = {};
  purchases.forEach(p => { if (p.SecurityName && p.CurrencyCode) secCurrencyMap[p.SecurityName] = p.CurrencyCode; });
  rows.forEach(r => { if (!r.currency && r.security) r.currency = secCurrencyMap[r.security] || ''; });

  // Sort by date, then buys before sells on same date
  rows.sort((a, b) => {
    const dc = (a.date || '').localeCompare(b.date || '');
    if (dc !== 0) return dc;
    return a.type === 'Buy' ? -1 : 1;
  });

  const isDetailed = viewToggle.dataset.value === 'detailed';

  if (isDetailed) {
    // Detailed view: all transactions with running balance per security
    const balances = {}; // security -> running qty
    document.querySelector('#stockBookTable thead tr').innerHTML =
      '<th>Date</th><th>Type</th><th>Security</th><th>Brokerage</th><th>Qty</th><th>Price/Unit (Cur)</th><th>Transaction Value (Cur)</th><th>Rate (INR)</th><th>Transaction Value</th><th>Balance Units</th><th>Lot ID</th>';

    document.querySelector('#stockBookTable tbody').innerHTML = rows.map(r => {
      balances[r.security] = (balances[r.security] || 0) + r.qty;
      const bal = balances[r.security];
      return `<tr class="${r.type === 'Sell' ? 'row-sell' : 'row-buy'}">
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
  } else {
    // Summary view: inventory as-on date, one row per security
    const inventory = {}; // security -> { qty, totalCost, totalCostINR }
    rows.forEach(r => {
      if (!inventory[r.security]) inventory[r.security] = { qty: 0, totalCost: 0, totalCostINR: 0 };
      const inv = inventory[r.security];
      inv.qty += r.qty;
      if (r.type === 'Buy') {
        inv.totalCost += r.value;
        inv.totalCostINR += r.valueINR;
      } else {
        // For sells, reduce cost basis proportionally
        if (inv.qty + Math.abs(r.qty) > 0) {
          const ratio = Math.abs(r.qty) / (inv.qty + Math.abs(r.qty));
          inv.totalCost -= inv.totalCost * ratio;
          inv.totalCostINR -= inv.totalCostINR * ratio;
        }
      }
    });

    document.querySelector('#stockBookTable thead tr').innerHTML =
      '<th>Security</th><th>Quantity</th><th>Avg Cost (Cur)</th><th>Total Cost (Cur)</th><th>Total Cost</th>';

    const entries = Object.entries(inventory).filter(([, v]) => v.qty > 0.0005).sort((a, b) => a[0].localeCompare(b[0]));
    document.querySelector('#stockBookTable tbody').innerHTML = entries.map(([sec, inv]) => {
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
  }

  // Wire filter change events
  asOnInput.onchange = renderStockBook;
  secFilter.onchange = renderStockBook;
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
  getTable('StockPurchases').forEach(p => {
    if (p.PurchaseLotID) lotMap[p.PurchaseLotID] = p;
  });

  // Stock Sales → Capital Gains rows
  filterByFY(getTable('StockSales'), fy, 'StockSales').forEach(s => {
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

  // Render sortable headers
  const arrow = col => cgvSort.col === col ? (cgvSort.dir === 1 ? ' ▲' : ' ▼') : '';
  document.querySelector('#capitalGainsViewTable thead tr').innerHTML = CGV_COLUMNS.map(c =>
    `<th class="sortable" data-sort="${c.key}">${c.label}${arrow(c.key)}</th>`
  ).join('');

  document.querySelectorAll('#capitalGainsViewTable th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (cgvSort.col === col) { cgvSort.dir *= -1; }
      else { cgvSort.col = col; cgvSort.dir = 1; }
      renderCapitalGainsView();
    });
  });

  // Render rows
  document.querySelector('#capitalGainsViewTable tbody').innerHTML = filtered.map(r => {
    const rowClass = r.gainLoss > 0 ? 'row-positive' : r.gainLoss < 0 ? 'row-negative' : '';
    return `
    <tr class="${rowClass}">
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
    </tr>
  `;
  }).join('');

  // Totals
  document.getElementById('cgvTotalSale').textContent = fmtR(filtered.reduce((s, r) => s + r.saleValue, 0));
  document.getElementById('cgvTotalAcq').textContent = fmtR(filtered.reduce((s, r) => s + r.acqCost, 0));
  document.getElementById('cgvTotalExp').textContent = fmtR(filtered.reduce((s, r) => s + r.expenses, 0));
  document.getElementById('cgvTotalGain').textContent = fmtR(filtered.reduce((s, r) => s + r.gainLoss, 0));
  document.getElementById('cgvTotalTDS').textContent = fmtR(filtered.reduce((s, r) => s + r.tds, 0));

  // Wire filters
  ['cgvSourceFilter', 'cgvQuarterFilter', 'cgvTypeFilter'].forEach(id => {
    document.getElementById(id).onchange = renderCapitalGainsView;
  });
}

// Render map
const SECTION_RENDERERS = {
  foreignIncome: renderForeignIncome,
  propertyIncome: renderPropertyIncome,
  capitalGains: renderCapitalGains,
  otherIncome: renderOtherIncome,
  stockPurchases: renderStockPurchases,
  stockSales: renderStockSales,
  stockBook: renderStockBook,
  capitalGainsView: renderCapitalGainsView,
  advanceTax: renderAdvanceTax,
  allIncome: renderAllIncome,
  settings: renderSettings,
  config: renderConfig
};

let currentSection = 'allIncome';

function renderCurrentSection() {
  const renderer = SECTION_RENDERERS[currentSection];
  if (renderer) renderer();
}
