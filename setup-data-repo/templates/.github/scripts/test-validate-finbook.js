#!/usr/bin/env node
// test-validate-finbook.js — Tests for the validate-finbook tool

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TOOL = path.join(__dirname, 'validate-finbook.js');
let tmpDir;
let passed = 0;
let failed = 0;

function setup() { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-val-')); }
function teardown() { fs.rmSync(tmpDir, { recursive: true, force: true }); }

function writeJson(name, obj) {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  return p;
}

function run(dbPath) {
  try {
    const out = execFileSync('node', [TOOL, dbPath], { encoding: 'utf-8' });
    return { ok: true, result: JSON.parse(out) };
  } catch (e) {
    try { return { ok: false, result: JSON.parse(e.stdout), code: e.status }; }
    catch (_) { return { ok: false, stderr: e.stderr, code: e.status }; }
  }
}

function assert(cond, msg) { if (!cond) throw new Error(`Assertion failed: ${msg}`); }

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}: ${e.message}`); }
}

function makeDb(acctOverrides) {
  return {
    config: {},
    accounts: [{
      account: 'A1', name: 'Test',
      SalaryIncome: [], ForeignIncome: [], PropertyIncome: [],
      CapitalGainsConsolidated: [], OtherIncome: [],
      StockPurchasesOrTransferIns: [], StockSalesOrTransferOuts: [],
      AdvanceTax: [], ForeignAccounts: [], Properties: [],
      ...acctOverrides
    }]
  };
}

console.log('\nvalidate-finbook tool tests\n');
setup();

try {
  test('valid empty DB passes', () => {
    const p = writeJson('db.json', makeDb());
    const r = run(p);
    assert(r.ok, 'should pass');
    assert(r.result.valid === true, 'should be valid');
    assert(r.result.errors === 0, 'should have 0 errors');
  });

  test('valid DB with records passes', () => {
    const p = writeJson('db.json', makeDb({
      SalaryIncome: [{ EffectiveDate: '2024-06-15', Employer: 'Acme', GrossTaxable: 500000 }],
      StockPurchasesOrTransferIns: [{
        PurchaseDate: '2024-05-30', SecurityName: 'MSFT', CurrencyCode: 'USD',
        PurchaseQuantity: 10, PurchasePricePerUnit: 429.17, ExchangeRateToINR: 83.5,
        LotTag: 0, PurchaseLotID: 'MSFT - 429.17 - 30-May-2024'
      }]
    }));
    const r = run(p);
    assert(r.ok, 'should pass');
    assert(r.result.valid === true, 'should be valid');
  });

  test('missing required field is error', () => {
    const p = writeJson('db.json', makeDb({
      SalaryIncome: [{ EffectiveDate: '2024-06-15' }]  // missing Employer, GrossTaxable
    }));
    const r = run(p);
    assert(!r.ok, 'should fail');
    assert(r.result.errors === 2, `expected 2 errors, got ${r.result.errors}`);
  });

  test('invalid date format is error', () => {
    const p = writeJson('db.json', makeDb({
      SalaryIncome: [{ EffectiveDate: '15/06/2024', Employer: 'Acme', GrossTaxable: 500000 }]
    }));
    const r = run(p);
    assert(!r.ok, 'should fail');
    assert(r.result.errorDetails.some(e => e.includes('invalid date')), 'should mention invalid date');
  });

  test('string in number field is error', () => {
    const p = writeJson('db.json', makeDb({
      SalaryIncome: [{ EffectiveDate: '2024-06-15', Employer: 'Acme', GrossTaxable: '500000' }]
    }));
    const r = run(p);
    assert(!r.ok, 'should fail');
    assert(r.result.errorDetails.some(e => e.includes('must be a number')), 'should mention number type');
  });

  test('computed field persisted is warning (not error)', () => {
    const p = writeJson('db.json', makeDb({
      SalaryIncome: [{
        EffectiveDate: '2024-06-15', Employer: 'Acme', GrossTaxable: 500000,
        SalaryIncomeID: '0', QFY: 'Q1', GrossTaxableIncome: 500000
      }]
    }));
    const r = run(p);
    assert(r.ok, 'should pass (warnings only)');
    assert(r.result.valid === true, 'still valid');
    assert(r.result.warnings >= 3, `expected >=3 warnings, got ${r.result.warnings}`);
  });

  test('missing PurchaseLotID is warning', () => {
    const p = writeJson('db.json', makeDb({
      StockPurchasesOrTransferIns: [{
        PurchaseDate: '2024-05-30', SecurityName: 'MSFT', CurrencyCode: 'USD',
        PurchaseQuantity: 10, PurchasePricePerUnit: 429.17, ExchangeRateToINR: 83.5
      }]
    }));
    const r = run(p);
    assert(r.ok, 'should pass (warning only)');
    assert(r.result.warningDetails.some(w => w.includes('PurchaseLotID')), 'should warn about PurchaseLotID');
  });

  test('PurchaseLots with missing PurchaseLotID is error', () => {
    const p = writeJson('db.json', makeDb({
      StockSalesOrTransferOuts: [{
        SaleDate: '2024-07-05', SecurityName: 'MSFT', SaleQuantity: 10,
        SaleAmount: 4500, ExchangeRateToINR: 85,
        PurchaseLots: [{ SaleQuantity: 10 }]
      }]
    }));
    const r = run(p);
    assert(!r.ok, 'should fail');
    assert(r.result.errorDetails.some(e => e.includes('PurchaseLots') && e.includes('PurchaseLotID')), 'should mention lot ID');
  });

  test('PurchaseLots with bad SaleQuantity is error', () => {
    const p = writeJson('db.json', makeDb({
      StockSalesOrTransferOuts: [{
        SaleDate: '2024-07-05', SecurityName: 'MSFT', SaleQuantity: 10,
        SaleAmount: 4500, ExchangeRateToINR: 85,
        PurchaseLots: [{ PurchaseLotID: 'MSFT - 429.17 - 30-May-2024', SaleQuantity: 0 }]
      }]
    }));
    const r = run(p);
    assert(!r.ok, 'should fail');
    assert(r.result.errorDetails.some(e => e.includes('SaleQuantity must be a positive')), 'should mention SaleQuantity');
  });

  test('missing accounts array is error', () => {
    const p = writeJson('db.json', { config: {} });
    const r = run(p);
    assert(!r.ok, 'should fail');
    assert(r.result.errorDetails.some(e => e.includes('accounts')), 'should mention accounts');
  });

  test('unknown table key is warning', () => {
    const p = writeJson('db.json', makeDb({ RandomStuff: [{ foo: 'bar' }] }));
    const r = run(p);
    assert(r.ok, 'should pass (warning only)');
    assert(r.result.warningDetails.some(w => w.includes("unknown table key 'RandomStuff'")), 'should warn about unknown key');
  });

  test('transfer-out with SaleAmount 0 passes', () => {
    const p = writeJson('db.json', makeDb({
      StockSalesOrTransferOuts: [{
        SaleDate: '2024-07-05', SecurityName: 'MSFT', SaleQuantity: 91,
        SaleAmount: 0, SaleExpenses: 0, ExchangeRateToINR: 1,
        IsTransferOut: true, Remarks: 'Transferred to Schwab',
        PurchaseLots: [{ PurchaseLotID: 'MSFT - 429.17 - 30-May-2024', SaleQuantity: 19 }]
      }]
    }));
    const r = run(p);
    assert(r.ok, 'should pass');
    assert(r.result.valid === true, 'should be valid');
  });

  test('multiple accounts validated independently', () => {
    const db = {
      config: {},
      accounts: [
        { account: 'A1', name: 'Good', SalaryIncome: [{ EffectiveDate: '2024-06-15', Employer: 'Acme', GrossTaxable: 500000 }] },
        { account: 'A2', name: 'Bad', SalaryIncome: [{ EffectiveDate: 'bad-date', Employer: 'Acme', GrossTaxable: 500000 }] }
      ]
    };
    const p = writeJson('db.json', db);
    const r = run(p);
    assert(!r.ok, 'should fail');
    assert(r.result.errors === 1, `expected 1 error, got ${r.result.errors}`);
    assert(r.result.errorDetails[0].includes('A2'), 'error should be for A2');
  });

} finally {
  teardown();
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
