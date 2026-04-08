#!/usr/bin/env node
// validate-finbook.js — Deterministic structural validator for finbook.json
//
// Usage:
//   node .github/scripts/validate-finbook.js DB/finbook.json
//
// Validates:
//   - Top-level structure (accounts array, config object)
//   - Required fields present on every record
//   - Date fields match YYYY-MM-DD format
//   - Number fields are numbers (not strings)
//   - No computed fields persisted (IDs, derived totals, QFY, CgQ)
//   - PurchaseLotID present on stock purchases
//   - PurchaseLots references valid (non-empty array for sales with lots)
//   - No unknown table names
//
// Exit codes:
//   0 = valid (outputs JSON summary)
//   1 = usage / file error
//   2 = validation errors found (outputs errors)

'use strict';

const fs = require('fs');
const path = require('path');
const core = require('./finbook-core');

// ---- Schema definitions (shared from finbook-core) ----

const { TABLE_NAMES, COMPUTED_FIELDS, REQUIRED_FIELDS, NUMBER_FIELDS } = core;

// Validator DATE_FIELDS: array of all date fields per table (broader than core's single FY-filter field)
const DATE_FIELDS = {
  SalaryIncome: ['EffectiveDate'],
  ForeignIncome: ['IncomeDate'],
  PropertyIncome: ['IncomeDate'],
  CapitalGainsConsolidated: ['IncomeDate'],
  OtherIncome: ['IncomeDate'],
  StockPurchasesOrTransferIns: ['PurchaseDate'],
  StockSalesOrTransferOuts: ['SaleDate'],
  AdvanceTax: ['PaymentDate', 'EffectiveDate']
};

// ---- Validation helpers ----

function isValidDate(str) {
  if (!str) return false;
  return /^\d{4}-\d{2}-\d{2}/.test(str) && !isNaN(new Date(str).getTime());
}

function validateRecord(acctCode, table, record, index) {
  const errors = [];
  const warnings = [];
  const prefix = `${acctCode}.${table}[${index}]`;

  // Required fields
  const required = REQUIRED_FIELDS[table];
  if (required) {
    for (const field of required) {
      if (record[field] === undefined || record[field] === null || record[field] === '') {
        errors.push(`${prefix}: missing required field '${field}'`);
      }
    }
  }

  // Date format
  const dateFlds = DATE_FIELDS[table] || [];
  for (const field of dateFlds) {
    const val = record[field];
    if (val !== undefined && val !== null && !isValidDate(val)) {
      errors.push(`${prefix}: invalid date '${field}' = '${val}' (expected YYYY-MM-DD)`);
    }
  }

  // Number types
  const numFlds = NUMBER_FIELDS[table] || [];
  for (const field of numFlds) {
    const val = record[field];
    if (val !== undefined && val !== null && typeof val !== 'number') {
      errors.push(`${prefix}: '${field}' must be a number, got ${typeof val} ('${val}')`);
    }
  }

  // Computed fields should not be persisted
  const computed = COMPUTED_FIELDS[table] || [];
  for (const field of computed) {
    if (record[field] !== undefined) {
      warnings.push(`${prefix}: computed field '${field}' should not be persisted — will be ignored on load`);
    }
  }

  // Stock purchase: PurchaseLotID should be present
  if (table === 'StockPurchasesOrTransferIns') {
    if (!record.PurchaseLotID && record.PurchaseDate && record.SecurityName) {
      warnings.push(`${prefix}: missing PurchaseLotID — sales cannot reference this lot`);
    }
  }

  // Stock sale PurchaseLots: each entry should have PurchaseLotID and SaleQuantity
  if (table === 'StockSalesOrTransferOuts' && record.PurchaseLots) {
    if (!Array.isArray(record.PurchaseLots)) {
      errors.push(`${prefix}: PurchaseLots must be an array`);
    } else {
      record.PurchaseLots.forEach((lot, li) => {
        if (!lot.PurchaseLotID) {
          errors.push(`${prefix}.PurchaseLots[${li}]: missing PurchaseLotID`);
        }
        if (typeof lot.SaleQuantity !== 'number' || lot.SaleQuantity <= 0) {
          errors.push(`${prefix}.PurchaseLots[${li}]: SaleQuantity must be a positive number`);
        }
      });
    }
  }

  return { errors, warnings };
}

// ---- Main ----

function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: node validate-finbook.js <finbook.json>');
    process.exit(1);
  }

  const filePath = path.resolve(args[0]);

  // Load file
  let db;
  try {
    db = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.error(`Error reading ${filePath}: ${e.message}`);
    process.exit(1);
  }

  // Top-level structure
  const allErrors = [];
  const allWarnings = [];

  if (!db.accounts || !Array.isArray(db.accounts)) {
    allErrors.push('Top-level: missing or invalid "accounts" array');
    outputResult(allErrors, allWarnings, {});
    return;
  }

  // Per-account validation
  const stats = {};
  for (const acct of db.accounts) {
    if (!acct.account) {
      allErrors.push('Account missing "account" code');
      continue;
    }
    const code = acct.account;
    stats[code] = {};

    // Check for unknown table keys
    for (const key of Object.keys(acct)) {
      if (['account', 'name', 'enabled'].includes(key)) continue;
      if (!TABLE_NAMES.includes(key)) {
        allWarnings.push(`${code}: unknown table key '${key}'`);
      }
    }

    // Validate each table
    for (const table of TABLE_NAMES) {
      const rows = acct[table];
      if (!rows) continue;
      if (!Array.isArray(rows)) {
        allErrors.push(`${code}.${table}: expected array, got ${typeof rows}`);
        continue;
      }

      stats[code][table] = rows.length;

      rows.forEach((record, i) => {
        const { errors, warnings } = validateRecord(code, table, record, i);
        allErrors.push(...errors);
        allWarnings.push(...warnings);
      });
    }
  }

  outputResult(allErrors, allWarnings, stats);
}

function outputResult(errors, warnings, stats) {
  const result = {
    valid: errors.length === 0,
    errors: errors.length,
    warnings: warnings.length,
    accounts: stats
  };

  if (errors.length > 0) {
    result.errorDetails = errors;
  }
  if (warnings.length > 0) {
    result.warningDetails = warnings;
  }

  console.log(JSON.stringify(result, null, 2));
  process.exit(errors.length > 0 ? 2 : 0);
}

main();
