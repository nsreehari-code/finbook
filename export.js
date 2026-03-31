#!/usr/bin/env node
// export.js — CLI tool to export computed data from a Finbook JSON file
// Usage: node export.js <input.json> <account> <fy> <output.json>
//   fy can be "All" or a FY like "2025-26"

const fs = require('fs');
const path = require('path');

// ---- Args ----
const [,, inputFile, account, fy, outputFile] = process.argv;
if (!inputFile || !account || !fy || !outputFile) {
  console.error('Usage: node export.js <input.json> <account> <fy> <output.json>');
  console.error('  fy: "All" or financial year like "2025-26"');
  process.exit(1);
}

// ---- Load data ----
const raw = fs.readFileSync(path.resolve(inputFile), 'utf-8');
const DB = JSON.parse(raw);
if (!DB.accounts || !Array.isArray(DB.accounts)) {
  console.error('Invalid format: expected { accounts: [...] }');
  process.exit(1);
}

const acct = DB.accounts.find(a => a.account.toLowerCase() === account.toLowerCase() || (a.name && a.name.toLowerCase() === account.toLowerCase()));
if (!acct) {
  console.error(`Account "${account}" not found. Available: ${DB.accounts.map(a => a.account).join(', ')}`);
  process.exit(1);
}

// ---- Date helpers ----
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
  const month = d.getMonth();
  const year = d.getFullYear();
  const startYear = month >= 3 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function dateToQFY(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const m = d.getMonth();
  if (m >= 3 && m <= 5) return 'Q1';
  if (m >= 6 && m <= 8) return 'Q2';
  if (m >= 9 && m <= 11) return 'Q3';
  return 'Q4';
}

function dateToCgQ(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const m = d.getMonth();
  const day = d.getDate();
  if (m === 3 || m === 4 || (m === 5 && day <= 15)) return 'cgQ1';
  if ((m === 5 && day >= 16) || m === 6 || m === 7 || (m === 8 && day <= 15)) return 'cgQ2';
  if ((m === 8 && day >= 16) || m === 9 || m === 10 || (m === 11 && day <= 15)) return 'cgQ3';
  if ((m === 11 && day >= 16) || m === 0 || m === 1 || (m === 2 && day <= 15)) return 'cgQ4';
  return 'cgQ4a';
}

// ---- Computations (same as data.js) ----
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

const TABLE_NAMES = [
  'AdvanceTax', 'CapitalGainsConsolidated', 'ForeignAccounts',
  'ForeignIncome', 'OtherIncome', 'Properties', 'PropertyIncome',
  'SalaryIncome', 'StockPurchases', 'StockSales'
];

// ---- Helpers ----
function getTable(tableName) {
  const rows = (acct[tableName] || []).filter(r => !r.Deleted);
  const compute = COMPUTATIONS[tableName];
  if (compute) rows.forEach((r, i) => compute(r, i));
  return rows;
}

function filterByFY(data, selFY, tableName) {
  if (!selFY || selFY === 'All') return data;
  const dateField = DATE_FIELDS[tableName];
  if (!dateField) return data;
  return data.filter(row => dateToFY(row[dateField]) === selFY);
}

function getAsOnDate() {
  const today = new Date().toISOString().slice(0, 10);
  if (!fy || fy === 'All') return today;
  const endYear = parseInt(fy.split('-')[0]) + 1;
  const fyEnd = `${endYear}-03-31`;
  return fyEnd < today ? fyEnd : today;
}

// ---- Build export ----
const asOnDate = getAsOnDate();
const selectedFY = fy;

// Per-record computed data
const computedRecords = {};
TABLE_NAMES.forEach(t => {
  const rows = filterByFY(getTable(t), selectedFY, t);
  computedRecords[t] = rows.map(r => ({ ...r }));
});

// All Income unified rows
const incomeRows = [];
const lotMap = {};
getTable('StockPurchases').forEach(p => { if (p.PurchaseLotID) lotMap[p.PurchaseLotID] = p; });

filterByFY(getTable('ForeignIncome'), selectedFY, 'ForeignIncome').forEach(r => {
  incomeRows.push({ date: r.IncomeDate, category: 'Foreign', description: `${r.IncomeSource || ''} — ${r.IncomeType || ''}`, amount: r.IncomeAmountINR || 0, relief: r.TaxesWithheldINR || 0, tds: 0, quarter: r.QFY || '' });
});
filterByFY(getTable('PropertyIncome'), selectedFY, 'PropertyIncome').forEach(r => {
  incomeRows.push({ date: r.IncomeDate, category: 'Property', description: r.PropertyID || '', amount: r.GrossIncome || 0, relief: 0, tds: r.TDSDeducted || 0, quarter: r.QFY || '' });
});
filterByFY(getTable('CapitalGainsConsolidated'), selectedFY, 'CapitalGainsConsolidated').forEach(r => {
  incomeRows.push({ date: r.IncomeDate, category: 'Capital Gains', description: r.IncomeDescription || '', amount: r.IncomeAmount || 0, relief: 0, tds: r.TDSDeducted || 0, quarter: r.CgQ || '' });
});
filterByFY(getTable('StockSales'), selectedFY, 'StockSales').forEach(s => {
  const lots = s.PurchaseLots || [];
  let acqCostINR = 0;
  lots.forEach(l => { const p = lotMap[l.PurchaseLotID]; if (p) acqCostINR += (l.SaleQuantity || 0) * (p.TotalPurchasePricePerUnit || 0) * (p.ExchangeRateToINR || 0); });
  const saleINR = s.TotalSaleValueINR || 0;
  const expINR = s.DomesticExpensesINR || 0;
  incomeRows.push({ date: s.SaleDate, category: 'Capital Gains (Stock)', description: `${s.SecurityName || ''} (${s.SaleQuantity || 0} units)`, amount: saleINR - acqCostINR - expINR, relief: 0, tds: 0, quarter: s.CgQ || '' });
});
filterByFY(getTable('SalaryIncome'), selectedFY, 'SalaryIncome').forEach(r => {
  incomeRows.push({ date: r.EffectiveDate, category: 'Salary', description: r.Employer || '', amount: r.NetTaxableIncome || 0, relief: 0, tds: r.TDSDeducted || 0, quarter: r.QFY || '' });
});
filterByFY(getTable('OtherIncome'), selectedFY, 'OtherIncome').forEach(r => {
  incomeRows.push({ date: r.IncomeDate, category: 'Other', description: r.IncomeDescription || '', amount: r.IncomeAmount || 0, relief: 0, tds: r.TDSDeducted || 0, quarter: r.QFY || '' });
});
filterByFY(getTable('AdvanceTax'), selectedFY, 'AdvanceTax').forEach(r => {
  incomeRows.push({ date: r.EffectiveDate || r.PaymentDate, category: 'Advance Tax', description: r.PaymentDescription || '', amount: 0, relief: 0, tds: r.TaxAmountPaid || 0, quarter: r.QFY || '' });
});

// Income summary by category
const catSummary = {};
incomeRows.forEach(r => {
  if (!catSummary[r.category]) catSummary[r.category] = { income: 0, relief: 0, tds: 0 };
  catSummary[r.category].income += r.amount;
  catSummary[r.category].relief += r.relief;
  catSummary[r.category].tds += r.tds;
});
const totalTaxableIncome = Object.entries(catSummary).filter(([k]) => k !== 'Advance Tax').reduce((s, [, v]) => s + v.income, 0);
const totalRelief = Object.values(catSummary).reduce((s, v) => s + v.relief, 0);
const totalTDS = Object.values(catSummary).reduce((s, v) => s + v.tds, 0);

// Capital Gains detail
const cgRows = [];
filterByFY(getTable('StockSales'), selectedFY, 'StockSales').forEach(s => {
  const lots = s.PurchaseLots || [];
  let acqCostINR = 0, earliestPurchaseDate = null;
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
  const holdingType = holdingDays != null ? (holdingDays > 365 ? 'LTCG' : 'STCG') : null;
  const saleValueINR = s.TotalSaleValueINR || 0;
  const expINR = s.DomesticExpensesINR || 0;
  cgRows.push({ date: s.SaleDate, source: 'Stock', security: s.SecurityName || '', quantity: s.SaleQuantity || 0, holdingType, holdingDays, saleValue: saleValueINR, acquisitionCost: acqCostINR, expenses: expINR, gainLoss: saleValueINR - acqCostINR - expINR, quarter: s.CgQ || '' });
});
filterByFY(getTable('CapitalGainsConsolidated'), selectedFY, 'CapitalGainsConsolidated').forEach(r => {
  cgRows.push({ date: r.IncomeDate, source: 'Manual', description: r.IncomeDescription || '', holdingType: r.GainsType || null, holdingDays: null, saleValue: r.SaleValue || 0, acquisitionCost: r.AcquisitionCost || 0, expenses: r.Expenses || 0, gainLoss: r.IncomeAmount || 0, tds: r.TDSDeducted || 0, quarter: r.CgQ || '', taxable: !r.NonTaxable });
});
const totalGainLoss = cgRows.reduce((s, r) => s + r.gainLoss, 0);
const ltcgTotal = cgRows.filter(r => r.holdingType === 'LTCG').reduce((s, r) => s + r.gainLoss, 0);
const stcgTotal = cgRows.filter(r => r.holdingType === 'STCG').reduce((s, r) => s + r.gainLoss, 0);

// Stock Book holdings as-on
const purchases = getTable('StockPurchases');
const sales = getTable('StockSales');
const asOn = new Date(asOnDate + 'T23:59:59');
const soldPerLot = {};
sales.forEach(s => {
  if (new Date(s.SaleDate) > asOn) return;
  (s.PurchaseLots || []).forEach(l => { soldPerLot[l.PurchaseLotID] = (soldPerLot[l.PurchaseLotID] || 0) + (l.SaleQuantity || 0); });
});
const holdings = {};
purchases.forEach(p => {
  if (new Date(p.PurchaseDate) > asOn) return;
  const sec = p.SecurityName || '';
  if (!holdings[sec]) holdings[sec] = { quantity: 0, totalCostINR: 0, lots: [] };
  const sold = soldPerLot[p.PurchaseLotID] || 0;
  const remaining = Math.max(0, (p.PurchaseQuantity || 0) - sold);
  if (remaining < 0.0005) return;
  const costRatio = (p.PurchaseQuantity || 0) > 0 ? remaining / p.PurchaseQuantity : 0;
  const costINR = (p.TotalPurchaseValueINR || 0) * costRatio;
  holdings[sec].quantity += remaining;
  holdings[sec].totalCostINR += costINR;
  holdings[sec].lots.push({ lotId: p.PurchaseLotID, purchaseDate: p.PurchaseDate, remaining, pricePerUnit: p.PurchasePricePerUnit || 0, currency: p.CurrencyCode || '', costINR });
});
const holdingsArray = Object.entries(holdings).filter(([, v]) => v.quantity > 0.0005).sort((a, b) => a[0].localeCompare(b[0])).map(([sec, v]) => ({
  security: sec, quantity: v.quantity, avgCostINR: v.quantity > 0 ? v.totalCostINR / v.quantity : 0, totalCostINR: v.totalCostINR, lots: v.lots
}));
const totalPortfolioValue = holdingsArray.reduce((s, h) => s + h.totalCostINR, 0);

// ---- Write output ----
const result = {
  exportDate: new Date().toISOString().slice(0, 10),
  account: acct.name || acct.account,
  financialYear: selectedFY,
  incomeSummary: { byCategory: catSummary, totalTaxableIncome, totalRelief, totalTDS },
  capitalGains: { transactions: cgRows, totalGainLoss, ltcgTotal, stcgTotal },
  stockBook: { asOnDate, holdings: holdingsArray, totalPortfolioValue },
  allIncomeRows: incomeRows,
  computedRecords
};

fs.writeFileSync(path.resolve(outputFile), JSON.stringify(result, null, 2), 'utf-8');
console.log(`Exported: ${acct.name || acct.account} | FY: ${selectedFY} | ${outputFile}`);
console.log(`  Income: ${Object.keys(catSummary).length} categories, Total: ${totalTaxableIncome.toFixed(2)}`);
console.log(`  Capital Gains: ${cgRows.length} transactions, Net: ${totalGainLoss.toFixed(2)} (LTCG: ${ltcgTotal.toFixed(2)}, STCG: ${stcgTotal.toFixed(2)})`);
console.log(`  Stock Book: ${holdingsArray.length} securities, Value: ${totalPortfolioValue.toFixed(2)} (as-on: ${asOnDate})`);
