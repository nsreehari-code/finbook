#!/usr/bin/env node
// test-finbook-report.js — Tests for finbook-core + finbook-report

'use strict';

const core = require('./finbook-core');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n    ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ---- Test DB ----

function makeDB() {
  return {
    accounts: [{
      account: 'Test',
      name: 'Test User',
      StockPurchasesOrTransferIns: [
        { PurchaseDate: '2022-06-15', SecurityName: 'MSFT', CurrencyCode: 'USD', PurchaseQuantity: 100, PurchasePricePerUnit: 250, PurchaseExpenses: 10, ExchangeRateToINR: 80, PurchaseLotID: 'MSFT - 250 - 15-Jun-2022' },
        { PurchaseDate: '2024-01-10', SecurityName: 'AAPL', CurrencyCode: 'USD', PurchaseQuantity: 50, PurchasePricePerUnit: 180, PurchaseExpenses: 5, ExchangeRateToINR: 83, PurchaseLotID: 'AAPL - 180 - 10-Jan-2024', IsTransferIn: true },
        { PurchaseDate: '2024-09-20', SecurityName: 'MSFT', CurrencyCode: 'USD', PurchaseQuantity: 20, PurchasePricePerUnit: 420, PurchaseExpenses: 8, ExchangeRateToINR: 84, PurchaseLotID: 'MSFT - 420 - 20-Sep-2024' }
      ],
      StockSalesOrTransferOuts: [
        { SaleDate: '2024-12-20', SecurityName: 'MSFT', SaleQuantity: 30, SaleAmount: 12600, SaleExpenses: 15, DomesticExpensesINR: 500, ExchangeRateToINR: 85, BrokerageName: 'Schwab',
          PurchaseLots: [{ PurchaseLotID: 'MSFT - 250 - 15-Jun-2022', SaleQuantity: 30 }] },
        { SaleDate: '2024-11-15', SecurityName: 'AAPL', SaleQuantity: 50, SaleAmount: 0, SaleExpenses: 0, DomesticExpensesINR: 0, ExchangeRateToINR: 84, IsTransferOut: true, Remarks: 'Transferred to Schwab',
          PurchaseLots: [{ PurchaseLotID: 'AAPL - 180 - 10-Jan-2024', SaleQuantity: 50 }] }
      ],
      ForeignIncome: [
        { IncomeDate: '2024-09-15', IncomeSource: 'Stocks', IncomeType: 'Dividends', Currency: 'USD', IncomeAmount: 100, TaxesWithheld: 25, ExchangeRateToINR: 84 }
      ],
      PropertyIncome: [
        { IncomeDate: '2025-03-31', PropertyID: 'House1', GrossIncome: 600000, TotalExpenses: 20000, TDSDeducted: 40000 }
      ],
      OtherIncome: [
        { IncomeDate: '2024-06-15', IncomeDescription: 'Interest', IncomeAmount: 5000, TDSDeducted: 500 }
      ],
      SalaryIncome: [
        { EffectiveDate: '2024-04-30', Employer: 'Acme Corp', GrossTaxable: 1200000, TaxablePerquisites: 0, Exemptions: 50000, Deductions: 150000, TDSDeducted: 100000 }
      ],
      CapitalGainsConsolidated: [
        { IncomeDate: '2024-08-10', IncomeDescription: 'STCG-MutualFund', SaleValue: 50000, AcquisitionCost: 45000, Expenses: 200, GainsType: 'STCG' }
      ],
      AdvanceTax: [
        { EffectiveDate: '2024-06-15', TaxAmountPaid: 50000, PaymentDescription: 'Q1 Advance Tax' }
      ]
    }]
  };
}

console.log('\nfinbook-core + finbook-report tests\n');

// ---- Date utility tests ----

test('dateToFY returns correct FY for April-March', () => {
  assert(core.dateToFY('2024-04-01') === '2024-25');
  assert(core.dateToFY('2025-03-31') === '2024-25');
  assert(core.dateToFY('2024-03-31') === '2023-24');
  assert(core.dateToFY('2024-01-15') === '2023-24');
});

test('dateToQFY returns correct quarters', () => {
  assert(core.dateToQFY('2024-04-15') === 'Q1');
  assert(core.dateToQFY('2024-07-01') === 'Q2');
  assert(core.dateToQFY('2024-10-15') === 'Q3');
  assert(core.dateToQFY('2025-01-15') === 'Q4');
});

test('dateToCgQ returns CG quarters', () => {
  assert(core.dateToCgQ('2024-04-15') === 'cgQ1');
  assert(core.dateToCgQ('2024-08-01') === 'cgQ2');
  assert(core.dateToCgQ('2024-11-01') === 'cgQ3');
  assert(core.dateToCgQ('2025-01-15') === 'cgQ4');
  assert(core.dateToCgQ('2025-03-20') === 'cgQ4a');
});

test('derivePurchaseLotID formats correctly', () => {
  const id = core.derivePurchaseLotID({ PurchaseDate: '2024-06-15', SecurityName: 'MSFT', PurchasePricePerUnit: 420, LotTag: 0 });
  assert(id === 'MSFT - 420 - 15-Jun-2024', `Got: ${id}`);
  const id2 = core.derivePurchaseLotID({ PurchaseDate: '2024-06-15', SecurityName: 'MSFT', PurchasePricePerUnit: 420, LotTag: 1 });
  assert(id2 === 'MSFT - 420 - 15-Jun-2024-1', `Got: ${id2}`);
});

// ---- createContext tests ----

test('createContext finds account by code', () => {
  const ctx = core.createContext(makeDB(), 'Test');
  assert(ctx.acct.account === 'Test');
});

test('createContext finds account case-insensitively', () => {
  const ctx = core.createContext(makeDB(), 'test');
  assert(ctx.acct.account === 'Test');
});

test('createContext throws for unknown account', () => {
  let threw = false;
  try { core.createContext(makeDB(), 'Nope'); } catch (e) { threw = true; assert(e.message.includes('not found')); }
  assert(threw, 'Should have thrown');
});

test('getTable computes fields', () => {
  const ctx = core.createContext(makeDB(), 'Test');
  const purchases = ctx.getTable('StockPurchasesOrTransferIns');
  assert(purchases[0].TotalPurchaseValue > 0, 'Should have computed TotalPurchaseValue');
  assert(purchases[0].QFY, 'Should have computed QFY');
});

test('filterByFY filters correctly', () => {
  const ctx = core.createContext(makeDB(), 'Test');
  const all = ctx.getTable('StockPurchasesOrTransferIns');
  const fy2425 = ctx.filterByFY(all, '2024-25', 'StockPurchasesOrTransferIns');
  assert(fy2425.length === 1, `Expected 1 purchase in 2024-25, got ${fy2425.length}`);
  assert(fy2425[0].SecurityName === 'MSFT');
});

// ---- Income summary tests ----

test('income-summary includes all categories', () => {
  const ctx = core.createContext(makeDB(), 'Test');
  const report = core.reports.incomeSummary(ctx, '2024-25');
  assert(report.byCategory['Foreign'], 'Should have Foreign income');
  assert(report.byCategory['Property'], 'Should have Property income');
  assert(report.byCategory['Salary'], 'Should have Salary income');
  assert(report.byCategory['Other'], 'Should have Other income');
  assert(report.byCategory['Capital Gains'], 'Should have Capital Gains');
  assert(report.byCategory['Advance Tax'], 'Should have Advance Tax');
});

test('income-summary skips transfer-out sales', () => {
  const ctx = core.createContext(makeDB(), 'Test');
  const report = core.reports.incomeSummary(ctx, '2024-25');
  // Only 1 non-transfer stock sale → 1 Capital Gains (Stock) entry
  assert(report.byCategory['Capital Gains (Stock)'].count === 1);
});

test('income-summary FY=null returns all rows', () => {
  const ctx = core.createContext(makeDB(), 'Test');
  const report = core.reports.incomeSummary(ctx, null);
  assert(report.rows.length > 0);
});

// ---- Capital gains tests ----

test('capital-gains excludes transfer-out', () => {
  const ctx = core.createContext(makeDB(), 'Test');
  const report = core.reports.capitalGains(ctx, '2024-25');
  const stockRows = report.rows.filter(r => r.source === 'Stock');
  assert(stockRows.length === 1, `Expected 1 stock CG row, got ${stockRows.length}`);
  assert(stockRows[0].security === 'MSFT');
});

test('capital-gains computes holding period', () => {
  const ctx = core.createContext(makeDB(), 'Test');
  const report = core.reports.capitalGains(ctx, '2024-25');
  const msft = report.rows.find(r => r.security === 'MSFT');
  assert(msft.holdingDays > 365, `Expected LTCG, got ${msft.holdingDays} days`);
  assert(msft.holdingType === 'LTCG');
});

test('capital-gains includes manual entries', () => {
  const ctx = core.createContext(makeDB(), 'Test');
  const report = core.reports.capitalGains(ctx, '2024-25');
  const manualRows = report.rows.filter(r => r.source === 'Manual');
  assert(manualRows.length === 1, `Expected 1 manual CG, got ${manualRows.length}`);
  assert(manualRows[0].holdingType === 'STCG');
});

test('capital-gains totals are correct', () => {
  const ctx = core.createContext(makeDB(), 'Test');
  const report = core.reports.capitalGains(ctx, '2024-25');
  const sumRows = report.rows.reduce((s, r) => s + r.gainLoss, 0);
  assert(Math.abs(sumRows - report.totalGainLoss) < 0.01, `Total mismatch: ${sumRows} vs ${report.totalGainLoss}`);
});

// ---- Stock transactions tests ----

test('stock-transactions includes buys and sells', () => {
  const ctx = core.createContext(makeDB(), 'Test');
  const report = core.reports.stockTransactions(ctx, '2024-25');
  const types = new Set(report.transactions.map(t => t.type));
  assert(types.has('Buy'), 'Should have Buy');
  assert(types.has('Sell'), 'Should have Sell');
});

test('stock-transactions shows Transfer In/Out types', () => {
  const ctx = core.createContext(makeDB(), 'Test');
  const report = core.reports.stockTransactions(ctx, null); // all FYs
  const types = new Set(report.transactions.map(t => t.type));
  assert(types.has('Transfer In'), 'Should have Transfer In');
  assert(types.has('Transfer Out'), 'Should have Transfer Out');
});

test('stock-transactions sorted by date', () => {
  const ctx = core.createContext(makeDB(), 'Test');
  const report = core.reports.stockTransactions(ctx, null);
  for (let i = 1; i < report.transactions.length; i++) {
    assert(report.transactions[i].date >= report.transactions[i - 1].date, 'Not sorted');
  }
});

// ---- Holdings tests ----

test('holdings reflects sold lots correctly', () => {
  const ctx = core.createContext(makeDB(), 'Test');
  const report = core.reports.holdings(ctx, '2025-03-31');
  const msft = report.holdings.find(h => h.security === 'MSFT');
  // 100 + 20 purchased, 30 sold = 90 remaining
  assert(msft.quantity === 90, `Expected 90 MSFT, got ${msft.quantity}`);
});

test('holdings excludes fully sold securities', () => {
  const ctx = core.createContext(makeDB(), 'Test');
  const report = core.reports.holdings(ctx, '2025-03-31');
  // AAPL: 50 purchased, 50 transferred out → 0 remaining
  const aapl = report.holdings.find(h => h.security === 'AAPL');
  assert(!aapl, 'AAPL should be fully transferred out');
});

test('holdings respects as-on date', () => {
  const ctx = core.createContext(makeDB(), 'Test');
  const report = core.reports.holdings(ctx, '2024-06-30');
  // Only first MSFT lot (100) purchased by June 2022
  const msft = report.holdings.find(h => h.security === 'MSFT');
  assert(msft.quantity === 100, `Expected 100 MSFT as of 2024-06-30, got ${msft.quantity}`);
});

test('holdings reports totalPortfolioValue', () => {
  const ctx = core.createContext(makeDB(), 'Test');
  const report = core.reports.holdings(ctx, '2025-03-31');
  assert(report.totalPortfolioValue > 0, 'Should have positive portfolio value');
  const sumCost = report.holdings.reduce((s, h) => s + h.totalCostINR, 0);
  assert(Math.abs(sumCost - report.totalPortfolioValue) < 0.01);
});

// ---- Stock purchases / sales raw reports ----

test('stock-purchases returns raw records', () => {
  const ctx = core.createContext(makeDB(), 'Test');
  const report = core.reports.stockPurchases(ctx, null);
  assert(report.count === 3, `Expected 3 purchases, got ${report.count}`);
});

test('stock-sales returns raw records', () => {
  const ctx = core.createContext(makeDB(), 'Test');
  const report = core.reports.stockSales(ctx, null);
  assert(report.count === 2, `Expected 2 sales, got ${report.count}`);
});

// ---- Schema exports ----

test('core exports schema constants', () => {
  assert(Array.isArray(core.TABLE_NAMES), 'TABLE_NAMES should be array');
  assert(core.TABLE_NAMES.length === 10, `Expected 10 tables, got ${core.TABLE_NAMES.length}`);
  assert(core.REQUIRED_FIELDS.SalaryIncome, 'Should have SalaryIncome required fields');
  assert(core.COMPUTED_FIELDS.ForeignIncome, 'Should have ForeignIncome computed fields');
  assert(core.NUMBER_FIELDS.AdvanceTax, 'Should have AdvanceTax number fields');
});

// ---- Summary ----

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
