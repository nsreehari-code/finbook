// forms.js — Form definitions and modal handling for each entity

const FORM_DEFS = {
  account: {
    title: 'Account',
    table: '__account__',
    idField: null,
    fields: [
      { name: 'account', label: 'Account Code', type: 'text', required: true },
      { name: 'name', label: 'Account Name', type: 'text', required: true }
    ]
  },

  foreignIncome: {
    title: 'Foreign Income Entry',
    table: 'ForeignIncome',
    idField: 'ForeignIncomeID',
    fields: [
      { name: 'IncomeDate', label: 'Date', type: 'date', required: true },
      { name: 'IncomeSource', label: 'Source', type: 'configList', configKey: 'ForeignIncomeSource', required: true },
      { name: 'IncomeType', label: 'Type', type: 'configList', configKey: 'ForeignIncomeType', required: true },
      { name: 'ForeignAccount', label: 'Foreign Account', type: 'lookup', lookupTable: 'ForeignAccounts', lookupField: 'ForeignAccount', required: true },
      { name: 'Currency', label: 'Currency', type: 'configList', configKey: 'ForeignCurrencies', required: true },
      { name: 'IncomeAmount', label: 'Amount (Foreign)', type: 'number', step: '0.01', required: true },
      { name: 'TaxesWithheld', label: 'Tax Withheld (Foreign)', type: 'number', step: '0.01' },
      { name: 'ExchangeRateToINR', label: 'Exchange Rate to INR', type: 'number', step: '0.01', required: true },
      { name: 'IncomeAmountINR', label: 'Amount (₹)', type: 'number', step: '0.01', computed: true },
      { name: 'TaxesWithheldINR', label: 'Tax Withheld (₹)', type: 'number', step: '0.01', computed: true },
      { name: 'NonTaxable', label: 'Non-Taxable', type: 'checkbox', default: false },
      { name: 'Remarks', label: 'Remarks', type: 'text' }
    ]
  },

  propertyIncome: {
    title: 'Property Income Entry',
    table: 'PropertyIncome',
    idField: 'PropertyIncomeID',
    fields: [
      { name: 'IncomeDate', label: 'Date', type: 'date', required: true },
      { name: 'PropertyID', label: 'Property', type: 'lookup', lookupTable: 'Properties', lookupField: 'PropertyID', required: true },
      { name: 'GrossIncome', label: 'Gross Income (₹)', type: 'number', step: '0.01', required: true },
      { name: 'TotalExpenses', label: 'Expenses (₹)', type: 'number', step: '0.01' },
      { name: 'NetIncome', label: 'Net Income (₹)', type: 'number', step: '0.01', computed: true },
      { name: 'TDSDeducted', label: 'TDS Deducted (₹)', type: 'number', step: '0.01' },
      { name: 'TDSDeductor', label: 'TDS Deductor', type: 'text' },
      { name: 'Details', label: 'Details', type: 'text' }
    ]
  },

  capitalGains: {
    title: 'Capital Gains Entry',
    table: 'CapitalGainsConsolidated',
    idField: 'CapitalGainsID',
    fields: [
      { name: 'IncomeDate', label: 'Date', type: 'date', required: true },
      { name: 'GainsType', label: 'Type', type: 'configList', configKey: 'CapitalGainsTypes', required: true },
      { name: 'IncomeDescription', label: 'Description', type: 'text', required: true },
      { name: 'SaleValue', label: 'Sale Value (₹)', type: 'number', step: '0.01', required: true },
      { name: 'AcquisitionCost', label: 'Acquisition Cost (₹)', type: 'number', step: '0.01', required: true },
      { name: 'Expenses', label: 'Expenses (₹)', type: 'number', step: '0.01' },
      { name: 'IncomeAmount', label: 'Gain/Loss (₹)', type: 'number', step: '0.01', computed: true },
      { name: 'TDSDeducted', label: 'TDS (₹)', type: 'number', step: '0.01' },
      { name: 'TDSDeductor', label: 'TDS Deductor', type: 'text' },
      { name: 'NonTaxable', label: 'Non-Taxable', type: 'checkbox', default: false },
      { name: 'Remarks', label: 'Remarks', type: 'text' }
    ]
  },

  otherIncome: {
    title: 'Other Income Entry',
    table: 'OtherIncome',
    idField: 'OtherIncomeID',
    fields: [
      { name: 'IncomeDate', label: 'Date', type: 'date', required: true },
      { name: 'IncomeDescription', label: 'Description', type: 'text', required: true },
      { name: 'IncomeAmount', label: 'Amount (₹)', type: 'number', step: '0.01', required: true },
      { name: 'TDSDeducted', label: 'TDS Deducted (₹)', type: 'number', step: '0.01' },
      { name: 'TDSDeductor', label: 'TDS Deductor', type: 'text' },
      { name: 'NonTaxable', label: 'Non-Taxable', type: 'checkbox', default: false },
      { name: 'Remarks', label: 'Remarks', type: 'text' }
    ]
  },

  stockPurchase: {
    title: 'Stock Purchase',
    table: 'StockPurchasesOrTransferIns',
    idField: 'StockPurchaseID',
    fields: [
      { name: 'PurchaseDate', label: 'Date', type: 'date', required: true },
      { name: 'BrokerageName', label: 'Brokerage', type: 'lookup', lookupTable: 'ForeignAccounts', lookupField: 'ForeignAccount', required: true },
      { name: 'SecurityName', label: 'Security', type: 'configList', configKey: 'ForeignStockTickers', required: true },
      { name: 'CurrencyCode', label: 'Currency', type: 'configList', configKey: 'ForeignCurrencies', required: true },
      { name: 'PurchaseQuantity', label: 'Quantity', type: 'number', step: '0.001', required: true },
      { name: 'PurchasePricePerUnit', label: 'Price Per Unit', type: 'number', step: '0.01', required: true },
      { name: 'PurchaseExpenses', label: 'Expenses', type: 'number', step: '0.01' },
      { name: 'ExchangeRateToINR', label: 'Rate to INR', type: 'number', step: '0.01', required: true },
      { name: 'TotalPurchaseValue', label: 'Total Value', type: 'number', step: '0.01', computed: true },
      { name: 'TotalPurchasePricePerUnit', label: 'Total Price/Unit', type: 'number', step: '0.01', computed: true },
      { name: 'TotalPurchaseValueINR', label: 'Value (₹)', type: 'number', step: '0.01', computed: true },
      { name: 'PurchaseLotID', label: 'Lot ID', type: 'text', computed: true },
      { name: 'LotTag', label: 'Lot Tag', type: 'number', step: '1', default: 0 },
      { name: 'IsSTTPaid', label: 'STT Paid', type: 'checkbox', default: false },
      { name: 'IsTransferIn', label: 'Transfer In', type: 'checkbox', default: false },
      { name: 'Remarks', label: 'Remarks', type: 'text' }
    ]
  },

  stockSale: {
    title: 'Stock Sale',
    table: 'StockSalesOrTransferOuts',
    idField: 'StockSaleID',
    fields: [
      { name: 'SaleDate', label: 'Sale Date', type: 'date', required: true },
      { name: 'SaleQuantity', label: 'Total Quantity', type: 'number', step: '0.001', required: true },
      { name: 'SaleAmount', label: 'Sale Amount', type: 'number', step: '0.01', required: true },
      { name: 'SaleExpenses', label: 'Expenses', type: 'number', step: '0.01' },
      { name: 'DomesticExpensesINR', label: 'Domestic Expenses (₹)', type: 'number', step: '1' },
      { name: 'ExchangeRateToINR', label: 'Rate to INR', type: 'number', step: '0.01', required: true },
      { name: 'TotalSaleValue', label: 'Total Sale Value', type: 'number', step: '0.01', computed: true },
      { name: 'TotalSalePricePerUnit', label: 'Price/Unit', type: 'number', step: '0.01', computed: true },
      { name: 'TotalSaleValueINR', label: 'Total Value (₹)', type: 'number', step: '0.01', computed: true },
      { name: 'IsTransferOut', label: 'Transfer Out', type: 'checkbox', default: false },
      { name: 'Remarks', label: 'Remarks', type: 'text' }
    ],
    hasSubform: true
  },

  salaryIncome: {
    title: 'Salary Income Entry',
    table: 'SalaryIncome',
    idField: 'SalaryIncomeID',
    fields: [
      { name: 'EffectiveDate', label: 'Date', type: 'date', required: true },
      { name: 'Employer', label: 'Employer', type: 'text', required: true },
      { name: 'GrossTaxable', label: 'Payroll Gross Taxable (A)', type: 'number', step: '0.01', required: true },
      { name: 'TaxablePerquisites', label: 'Taxable Perquisites (B)', type: 'number', step: '0.01' },
      { name: 'Exemptions', label: 'Exemptions (C)', type: 'number', step: '0.01' },
      { name: 'Deductions', label: 'Deductions (D)', type: 'number', step: '0.01' },
      { name: 'TDSDeducted', label: 'TDS Deducted (₹)', type: 'number', step: '0.01' },
      { name: 'GrossTaxableIncome', label: 'Gross Taxable Income (A+B+C)', type: 'number', step: '0.01', computed: true },
      { name: 'NetTaxableIncome', label: 'Net Taxable Income (G−D)', type: 'number', step: '0.01', computed: true },
      { name: 'Remarks', label: 'Remarks', type: 'text' }
    ]
  },

  advanceTax: {
    title: 'Advance Tax Payment',
    table: 'AdvanceTax',
    idField: 'AdvanceTaxID',
    fields: [
      { name: 'PaymentDate', label: 'Paid Date', type: 'date', required: true },
      { name: 'EffectiveDate', label: 'Effective Date', type: 'date', required: true },
      { name: 'TaxAmountPaid', label: 'Amount (₹)', type: 'number', step: '0.01', required: true },
      { name: 'PaymentDescription', label: 'Description', type: 'text' },
      { name: 'Remarks', label: 'Remarks', type: 'text' }
    ]
  }
};

function openModal(formKey, existingData) {
  const def = FORM_DEFS[formKey];
  if (!def) return;

  const modal = document.getElementById('modal');
  const title = document.getElementById('modalTitle');
  const fieldsEl = document.getElementById('modalFields');
  const form = document.getElementById('modalForm');

  title.textContent = existingData ? `Edit ${def.title}` : `New ${def.title}`;
  fieldsEl.innerHTML = '';
  document.getElementById('modalSaveBtn').disabled = false;
  document.getElementById('modalValidation').textContent = '';

  // Determine which fields are "short" (can pair in 2-col rows)
  const visibleFields = def.fields.filter(f => !f.computed);
  const isShort = f => f.type === 'date' || f.type === 'number' || f.type === 'checkbox' ||
    f.type === 'select' || f.type === 'configList' || f.type === 'lookup' || f.type === 'dynamicSelect';

  let pendingRow = null; // holds a form-row div waiting for a second short field

  def.fields.forEach(f => {
    if (f.computed) return; // skip computed fields in form

    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.textContent = f.label;
    label.setAttribute('for', `field_${f.name}`);
    group.appendChild(label);

    let input;

    if (f.type === 'select') {
      input = document.createElement('select');
      f.options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        input.appendChild(o);
      });
    } else if (f.type === 'configList') {
      input = document.createElement('select');
      const items = getConfigList(f.configKey);
      items.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        input.appendChild(o);
      });
    } else if (f.type === 'dynamicSelect') {
      input = document.createElement('select');
      // populated after all fields are created (needs parent values)
    } else if (f.type === 'lookup') {
      input = document.createElement('select');
      const items = getTable(f.lookupTable) || [];
      items.forEach(item => {
        const o = document.createElement('option');
        o.value = item[f.lookupField];
        o.textContent = item[f.lookupField];
        input.appendChild(o);
      });
    } else if (f.type === 'checkbox') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = existingData ? !!existingData[f.name] : (f.default || false);
    } else if (f.type === 'date') {
      input = document.createElement('input');
      input.type = 'date';
    } else if (f.type === 'number') {
      input = document.createElement('input');
      input.type = 'number';
      if (f.step) input.step = f.step;
    } else {
      input = document.createElement('input');
      input.type = 'text';
    }

    input.id = `field_${f.name}`;
    input.name = f.name;
    if (f.required) input.required = true;

    // Add Bootstrap classes
    if (input.tagName === 'SELECT') {
      input.classList.add('form-select');
    } else if (f.type === 'checkbox') {
      input.classList.add('form-check-input');
    } else {
      input.classList.add('form-control');
    }

    // Set value
    if (existingData && existingData[f.name] != null) {
      if (f.type === 'checkbox') {
        input.checked = !!existingData[f.name];
      } else if (f.type === 'date') {
        input.value = existingData[f.name] ? existingData[f.name].slice(0, 10) : '';
      } else {
        input.value = existingData[f.name];
      }
    } else if (!existingData) {
      if (f.type === 'number') input.value = f.default || '';
    }

    group.appendChild(input);

    // Layout: pair short fields into 2-column rows, text fields go full-width
    if (isShort(f)) {
      if (pendingRow) {
        pendingRow.appendChild(group);
        fieldsEl.appendChild(pendingRow);
        pendingRow = null;
      } else {
        pendingRow = document.createElement('div');
        pendingRow.className = 'form-row';
        pendingRow.appendChild(group);
      }
    } else {
      // Flush any pending short field as single-column
      if (pendingRow) {
        fieldsEl.appendChild(pendingRow);
        pendingRow = null;
      }
      fieldsEl.appendChild(group);
    }
  });
  // Flush final pending row
  if (pendingRow) {
    fieldsEl.appendChild(pendingRow);
    pendingRow = null;
  }

  // Store context on form
  form.dataset.formKey = formKey;
  form.dataset.editId = existingData ? existingData[def.idField] : '';

  // Populate dynamicSelect fields and wire cascading
  const dynamicFields = def.fields.filter(f => f.type === 'dynamicSelect');
  dynamicFields.forEach(f => {
    const el = document.getElementById(`field_${f.name}`);
    populateDynamicSelect(el, f, def, existingData);

    // If other fields depend on this one, re-populate them on change
    const dependents = dynamicFields.filter(d => d.dependsOn === f.name);
    if (dependents.length) {
      el.addEventListener('change', () => {
        dependents.forEach(dep => {
          const depEl = document.getElementById(`field_${dep.name}`);
          populateDynamicSelect(depEl, dep, def, null);
          // cascade further
          const subDeps = dynamicFields.filter(d => d.dependsOn === dep.name);
          subDeps.forEach(sd => {
            const sdEl = document.getElementById(`field_${sd.name}`);
            populateDynamicSelect(sdEl, sd, def, null);
          });
        });
      });
    }
  });

  // Wire currency → ExchangeRateToINR auto-fill
  const currencyFields = def.fields.filter(f => f.type === 'configList' && f.configKey === 'ForeignCurrencies');
  const rateField = def.fields.find(f => f.name === 'ExchangeRateToINR');
  if (currencyFields.length && rateField) {
    currencyFields.forEach(cf => {
      const sel = document.getElementById(`field_${cf.name}`);
      const rateEl = document.getElementById('field_ExchangeRateToINR');
      function applyCurrencyRate() {
        const rates = (DB.config && DB.config.CurrencyRates) || {};
        const rate = rates[sel.value];
        if (rate && (!rateEl.value || rateEl.value === '0')) {
          rateEl.value = rate;
        }
      }
      sel.addEventListener('change', () => {
        const rates = (DB.config && DB.config.CurrencyRates) || {};
        const rate = rates[sel.value];
        if (rate) rateEl.value = rate;
      });
      // Auto-fill on initial load for new entries
      if (!existingData) applyCurrencyRate();
    });
  }

  // Purchase lots subform for stockSale
  if (formKey === 'stockSale') {
    const subform = document.createElement('div');
    subform.className = 'subform';
    subform.innerHTML = `
      <h4 class="subform-title">Purchase Lots</h4>
      <div class="subform-filters">
        <div class="form-group form-group-inline">
          <label for="field_BrokerageName">Brokerage</label>
          <select id="field_BrokerageName" class="form-select form-select-sm" required></select>
        </div>
        <div class="form-group form-group-inline">
          <label for="field_SecurityName">Security</label>
          <select id="field_SecurityName" class="form-select form-select-sm" required></select>
        </div>
      </div>
      <div id="purchaseLotsList"></div>
      <div class="subform-total">Selected Lot Qty: <strong id="lotQtyTotal">0</strong></div>
    `;
    fieldsEl.appendChild(subform);

    // Populate brokerage dropdown
    const brokerages = [...new Set(getTable('StockPurchasesOrTransferIns').map(p => p.BrokerageName).filter(Boolean))].sort();
    const brokEl = document.getElementById('field_BrokerageName');
    brokEl.innerHTML = '<option value="">— Select —</option>' + brokerages.map(b => `<option>${b}</option>`).join('');
    if (existingData && existingData.BrokerageName) brokEl.value = existingData.BrokerageName;

    function populateSecurities() {
      const brokerage = brokEl.value;
      const purchases = getTable('StockPurchasesOrTransferIns');
      const filtered = brokerage ? purchases.filter(p => p.BrokerageName === brokerage) : purchases;
      const securities = [...new Set(filtered.map(p => p.SecurityName).filter(Boolean))].sort();
      const secEl = document.getElementById('field_SecurityName');
      secEl.innerHTML = '<option value="">— Select —</option>' + securities.map(s => `<option>${s}</option>`).join('');
      if (existingData && existingData.SecurityName) secEl.value = existingData.SecurityName;
    }

    // Compute already-sold qty per lot (excluding current sale if editing)
    const editId = existingData ? existingData[def.idField] : null;
    const allSales = getTable('StockSalesOrTransferOuts');
    const soldMap = {}; // lotID -> total sold elsewhere
    allSales.forEach(sale => {
      if (editId != null && sale[def.idField] === editId) return; // skip self
      (sale.PurchaseLots || []).forEach(l => {
        soldMap[l.PurchaseLotID] = (soldMap[l.PurchaseLotID] || 0) + (l.SaleQuantity || 0);
      });
    });

    function refreshLots() {
      const brokerage = brokEl.value;
      const security = document.getElementById('field_SecurityName').value;
      const purchases = getTable('StockPurchasesOrTransferIns').filter(p =>
        (!brokerage || p.BrokerageName === brokerage) &&
        (!security || p.SecurityName === security)
      );
      const existingLots = existingData ? (existingData.PurchaseLots || []) : [];
      const lotMap = {};
      existingLots.forEach(l => { lotMap[l.PurchaseLotID] = l.SaleQuantity; });

      document.getElementById('purchaseLotsList').innerHTML = purchases.map(p => {
        const checked = lotMap[p.PurchaseLotID] != null;
        const qty = lotMap[p.PurchaseLotID] || '';
        const sold = soldMap[p.PurchaseLotID] || 0;
        const available = Math.max(0, (p.PurchaseQuantity || 0) - sold);
        return `<div class="lot-row">
          <label><input type="checkbox" class="lot-check" data-lot-id="${p.PurchaseLotID}" data-available="${available}" ${checked ? 'checked' : ''}>
          ${p.PurchaseLotID}</label>
          <span class="lot-avail">Avail: ${available.toFixed(3)}</span>
          <input type="number" class="lot-qty" data-lot-id="${p.PurchaseLotID}" step="0.001" max="${available}" placeholder="Sale Qty" value="${qty}" ${checked ? '' : 'disabled'}>
          <span class="lot-error" data-lot-id="${p.PurchaseLotID}"></span>
        </div>`;
      }).join('') || '<em>No purchase lots match</em>';

      document.querySelectorAll('.lot-check').forEach(cb => {
        cb.addEventListener('change', () => {
          const qtyInput = document.querySelector(`.lot-qty[data-lot-id="${cb.dataset.lotId}"]`);
          qtyInput.disabled = !cb.checked;
          if (!cb.checked) qtyInput.value = '';
          validateForm();
        });
      });
      document.querySelectorAll('.lot-qty').forEach(q => q.addEventListener('input', validateForm));
      validateForm();
    }

    populateSecurities();
    refreshLots();

    function fillRateFromPurchases() {
      const brokerage = brokEl.value;
      const security = document.getElementById('field_SecurityName').value;
      if (!brokerage || !security) return;
      const purchase = getTable('StockPurchasesOrTransferIns').find(p => p.BrokerageName === brokerage && p.SecurityName === security);
      if (!purchase || !purchase.CurrencyCode) return;
      const rates = (DB.config && DB.config.CurrencyRates) || {};
      const rate = rates[purchase.CurrencyCode];
      const rateEl = document.getElementById('field_ExchangeRateToINR');
      if (rate && rateEl) rateEl.value = rate;
    }

    brokEl.addEventListener('change', () => { populateSecurities(); refreshLots(); fillRateFromPurchases(); validateForm(); });
    document.getElementById('field_SecurityName').addEventListener('change', () => { refreshLots(); fillRateFromPurchases(); validateForm(); });
    if (!existingData) fillRateFromPurchases();
  }

  // Wire real-time form validation on all required inputs
  function validateForm() {
    const form = document.getElementById('modalForm');
    const saveBtn = document.getElementById('modalSaveBtn');
    const msg = document.getElementById('modalValidation');

    // Check all required inputs in the form (including subform selects)
    let valid = true;
    form.querySelectorAll('[required]').forEach(el => {
      if (!el.value) valid = false;
    });

    // For stockSale, also check lot qty validation
    if (formKey === 'stockSale') {
      const saleQty = parseFloat(document.getElementById('field_SaleQuantity').value) || 0;
      let lotTotal = 0;
      let hasOverage = false;
      document.querySelectorAll('.lot-check:checked').forEach(cb => {
        const lotId = cb.dataset.lotId;
        const available = parseFloat(cb.dataset.available) || 0;
        const qtyInput = document.querySelector(`.lot-qty[data-lot-id="${lotId}"]`);
        const errSpan = document.querySelector(`.lot-error[data-lot-id="${lotId}"]`);
        const qty = parseFloat(qtyInput.value) || 0;
        lotTotal += qty;
        if (qty > available + 0.0005) {
          hasOverage = true;
          errSpan.textContent = `Exceeds available (${available.toFixed(3)})`;
          qtyInput.classList.add('input-error');
        } else {
          errSpan.textContent = '';
          qtyInput.classList.remove('input-error');
        }
      });
      document.querySelectorAll('.lot-check:not(:checked)').forEach(cb => {
        const errSpan = document.querySelector(`.lot-error[data-lot-id="${cb.dataset.lotId}"]`);
        if (errSpan) errSpan.textContent = '';
      });
      document.getElementById('lotQtyTotal').textContent = lotTotal.toFixed(3);

      const match = Math.abs(saleQty - lotTotal) < 0.0005;
      if (hasOverage) {
        valid = false;
        msg.textContent = 'Lot qty exceeds available';
      } else if (saleQty > 0 && !match) {
        valid = false;
        msg.textContent = `Lot total ${lotTotal.toFixed(3)} ≠ Sale qty ${saleQty.toFixed(3)}`;
      } else if (!valid) {
        msg.textContent = 'Required fields missing';
      } else {
        msg.textContent = '';
      }
    } else {
      if (!valid) {
        msg.textContent = 'Required fields missing';
      } else {
        msg.textContent = '';
      }
    }

    saveBtn.disabled = !valid;
  }

  // Attach validation to all inputs
  fieldsEl.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', validateForm);
    el.addEventListener('change', validateForm);
  });

  validateForm();

  modal.classList.remove('d-none');
}

function populateDynamicSelect(selectEl, fieldDef, formDef, existingData) {
  const rows = getTable(fieldDef.source.table);
  let filtered = rows;

  // Apply parent filter if this field depends on another
  if (fieldDef.dependsOn) {
    const parentVal = document.getElementById(`field_${fieldDef.dependsOn}`).value;
    if (parentVal) {
      // Find the parent field's source.field to filter by
      const parentDef = formDef.fields.find(f => f.name === fieldDef.dependsOn);
      const parentDataField = parentDef && parentDef.source ? parentDef.source.field : fieldDef.dependsOn;
      filtered = rows.filter(r => r[parentDataField] === parentVal);
    }
  }

  // Get distinct values
  const values = [...new Set(filtered.map(r => r[fieldDef.source.field]).filter(Boolean))].sort();

  selectEl.innerHTML = '';
  values.forEach(val => {
    const o = document.createElement('option');
    o.value = val;
    o.textContent = val;
    selectEl.appendChild(o);
  });

  // Set existing value if editing
  if (existingData && existingData[fieldDef.name] != null) {
    selectEl.value = existingData[fieldDef.name];
  }
}

function closeModal() {
  document.getElementById('modal').classList.add('d-none');
}

function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const formKey = form.dataset.formKey;
  const editId = form.dataset.editId;
  const def = FORM_DEFS[formKey];

  // Collect data
  const data = {};
  def.fields.forEach(f => {
    if (f.computed || f.uiOnly) return;
    const input = document.getElementById(`field_${f.name}`);
    if (!input) return;

    if (f.type === 'checkbox') {
      data[f.name] = input.checked;
    } else if (f.type === 'number') {
      data[f.name] = input.value ? parseFloat(input.value) : 0;
    } else {
      data[f.name] = input.value;
    }
  });

  // Collect PurchaseLots and subform fields for stockSale
  if (formKey === 'stockSale') {
    data.BrokerageName = document.getElementById('field_BrokerageName').value;
    data.SecurityName = document.getElementById('field_SecurityName').value;
    const lots = [];
    document.querySelectorAll('.lot-check:checked').forEach(cb => {
      const lotId = cb.dataset.lotId;
      const qtyInput = document.querySelector(`.lot-qty[data-lot-id="${lotId}"]`);
      const qty = qtyInput && qtyInput.value ? parseFloat(qtyInput.value) : 0;
      if (qty > 0) lots.push({ PurchaseLotID: lotId, SaleQuantity: qty });
    });
    data.PurchaseLots = lots;
  }

  // For stockPurchase: auto-assign LotTag and derive PurchaseLotID
  if (formKey === 'stockPurchase') {
    if (!editId) {
      data.LotTag = nextLotTag(data);
    }
    data.PurchaseLotID = derivePurchaseLotID(data);
  }

  // Special handling for account creation
  if (formKey === 'account') {
    if (!addAccount(data.account, data.name)) {
      alert('Account code already exists.');
      return;
    }
    populateFilters();
    closeModal();
    renderCurrentSection();
    return;
  }

  if (editId) {
    // Update existing (getTable returns references to originals)
    const table = getTable(def.table);
    const idx = table.findIndex(r => r[def.idField] === editId);
    if (idx !== -1) {
      Object.assign(table[idx], data);
    }
  } else {
    // New entry — push onto raw array; ID is computed on next getTable() call
    getRawTable(def.table).push(data);
  }

  saveTable();
  closeModal();
  renderCurrentSection();
}

function deleteEntry(formKey, id) {
  if (!confirm('Delete this entry?')) return;
  const def = FORM_DEFS[formKey];
  const record = getTable(def.table).find(r => r[def.idField] === id);
  if (record) {
    record.Deleted = true;
    saveTable();
    renderCurrentSection();
  }
}

function lockEntry(formKey, id) {
  const def = FORM_DEFS[formKey];
  const record = getTable(def.table).find(r => r[def.idField] === id);
  if (record) {
    record.IsLocked = true;
    saveTable();
    renderCurrentSection();
  }
}

function unlockEntry(formKey, id) {
  if (!confirm('Are you sure you want to unlock this record?')) return;
  const def = FORM_DEFS[formKey];
  const record = getTable(def.table).find(r => r[def.idField] === id);
  if (record) {
    record.IsLocked = false;
    saveTable();
    renderCurrentSection();
  }
}
