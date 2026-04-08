#!/usr/bin/env node
// export.js — CLI tool to export computed data from a Finbook JSON file
// Usage: node export.js <input.json> <account> <fy> <output.json>
//   fy can be "All" or a FY like "2025-26"

const fs = require('fs');
const path = require('path');
const core = require('./js/finbook-core');

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

let ctx;
try {
  ctx = core.createContext(DB, account);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

// ---- Determine as-on date ----
function getAsOnDate() {
  const today = new Date().toISOString().slice(0, 10);
  if (!fy || fy === 'All') return today;
  const endYear = parseInt(fy.split('-')[0]) + 1;
  const fyEnd = `${endYear}-03-31`;
  return fyEnd < today ? fyEnd : today;
}

const asOnDate = getAsOnDate();
const selectedFY = fy;

// ---- Build export using core reports ----
const incomeSummary = core.reports.incomeSummary(ctx, selectedFY);
const capitalGains = core.reports.capitalGains(ctx, selectedFY);
const stockBook = core.reports.holdings(ctx, asOnDate);

// Per-record computed data (all tables, filtered by FY)
const computedRecords = {};
core.TABLE_NAMES.forEach(t => {
  const rows = ctx.filterByFY(ctx.getTable(t), selectedFY, t);
  computedRecords[t] = rows.map(r => ({ ...r }));
});

// ---- Write output ----
const result = {
  exportDate: new Date().toISOString().slice(0, 10),
  account: ctx.acct.name || ctx.acct.account,
  financialYear: selectedFY,
  incomeSummary: { byCategory: incomeSummary.byCategory, totalTaxableIncome: incomeSummary.totalIncome, totalRelief: incomeSummary.totalRelief, totalTDS: incomeSummary.totalTDS },
  capitalGains: { transactions: capitalGains.rows, totalGainLoss: capitalGains.totalGainLoss, ltcgTotal: capitalGains.ltcg, stcgTotal: capitalGains.stcg },
  stockBook: { asOnDate: stockBook.asOnDate, holdings: stockBook.holdings, totalPortfolioValue: stockBook.totalPortfolioValue },
  allIncomeRows: incomeSummary.rows,
  computedRecords
};

fs.writeFileSync(path.resolve(outputFile), JSON.stringify(result, null, 2), 'utf-8');
const catSummary = incomeSummary.byCategory;
console.log(`Exported: ${ctx.acct.name || ctx.acct.account} | FY: ${selectedFY} | ${outputFile}`);
console.log(`  Income: ${Object.keys(catSummary).length} categories, Total: ${incomeSummary.totalIncome.toFixed(2)}`);
console.log(`  Capital Gains: ${capitalGains.rows.length} transactions, Net: ${capitalGains.totalGainLoss.toFixed(2)} (LTCG: ${capitalGains.ltcg.toFixed(2)}, STCG: ${capitalGains.stcg.toFixed(2)})`);
console.log(`  Stock Book: ${stockBook.holdings.length} securities, Value: ${stockBook.totalPortfolioValue.toFixed(2)} (as-on: ${asOnDate})`);
