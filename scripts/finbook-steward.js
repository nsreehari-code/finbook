#!/usr/bin/env node
// finbook-steward.js — Thin orchestrator for Finbook data steward
//
// Manages git branches and thread folders, delegates AI work to copilot CLI
// which reads copilot-instructions.md and uses the steward agent.
//
// Usage:
//   node finbook-steward.js --repo <path> ingest <doc1> [doc2 ...]   — create branch + thread, run steward
//   node finbook-steward.js --repo <path> clarify                     — re-run steward after user edits THREAD.md
//   node finbook-steward.js --repo <path> confirm                     — merge branch to main
//   node finbook-steward.js --repo <path> status                      — show active threads

const fs = require('fs');
const path = require('path');
const { spawnSync, execSync } = require('child_process');
const os = require('os');

// Parse --repo flag from argv
let args = process.argv.slice(2);
let repoArg = null;
const repoIdx = args.indexOf('--repo');
if (repoIdx !== -1) {
  repoArg = args[repoIdx + 1];
  args.splice(repoIdx, 2);
}

if (!repoArg) {
  console.error('--repo <path> is required.');
  process.exit(1);
}
const REPO_DIR = path.resolve(repoArg);
const WRAPPER = path.resolve(__dirname, 'copilot_wrapper.bat');
const TEMP_DIR = path.join(os.tmpdir(), 'finbook-steward');
const OUTPUT_FILE = path.join(TEMP_DIR, 'response.txt');

if (!fs.existsSync(REPO_DIR)) {
  console.error(`Repo directory not found: ${REPO_DIR}`);
  process.exit(1);
}
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ---- Git helpers ----
function git(...args) {
  const result = spawnSync('git', args, { cwd: REPO_DIR, encoding: 'utf-8' });
  if (result.error) throw result.error;
  return result.stdout.trim();
}

function currentBranch() {
  return git('rev-parse', '--abbrev-ref', 'HEAD');
}

function branchExists(name) {
  const result = spawnSync('git', ['rev-parse', '--verify', name], {
    cwd: REPO_DIR, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
  });
  return result.status === 0;
}

// ---- Copilot call ----
function callCopilot(prompt) {
  const promptFile = path.join(TEMP_DIR, 'prompt.txt');
  fs.writeFileSync(promptFile, prompt, 'utf-8');

  const sessionDir = path.join(TEMP_DIR, 'session');
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

  const cmdExe = process.env.COMSPEC || 'cmd.exe';
  const result = spawnSync(cmdExe, [
    '/c', WRAPPER,
    OUTPUT_FILE,
    sessionDir,
    REPO_DIR,
    `@${promptFile}`,
    '',
    'false',
    'finbook-steward'
  ], {
    timeout: 900000,
    stdio: 'inherit',
    windowsHide: true
  });

  if (result.error) {
    console.error(`Copilot call failed: ${result.error.message}`);
    return false;
  }
  return true;
}

// ---- Generate batch name ----
function batchName() {
  const now = new Date();
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  const t = now.toISOString().slice(11, 16).replace(':', '');
  return `batch-${d}-${t}`;
}

// ---- Find active thread ----
function findActiveThread() {
  const branch = currentBranch();
  if (!branch.startsWith('steward/')) return null;
  const batchId = branch.replace('steward/', '');
  const threadDir = path.join(REPO_DIR, 'threads', batchId);
  if (!fs.existsSync(threadDir)) return null;
  return { branch, batchId, threadDir };
}

// ---- Commands ----

function cmdIngest(docPaths) {
  if (docPaths.length === 0) {
    console.error('No documents specified.');
    process.exit(1);
  }

  // Ensure we're on main
  const branch = currentBranch();
  if (branch !== 'main') {
    console.error(`Must be on main branch (currently on ${branch}).`);
    console.error('Use "clarify" to continue an active thread, or merge/delete the branch first.');
    process.exit(1);
  }

  const batch = batchName();
  const threadDir = path.join(REPO_DIR, 'threads', batch);
  const branchName = `steward/${batch}`;

  // Create branch
  git('checkout', '-b', branchName);
  console.log(`Branch: ${branchName}`);

  // Create thread dir and copy documents
  fs.mkdirSync(threadDir, { recursive: true });
  const docNames = [];
  for (const docPath of docPaths) {
    const resolved = path.resolve(docPath);
    if (!fs.existsSync(resolved)) {
      console.error(`File not found: ${docPath}`);
      continue;
    }
    const name = path.basename(resolved);
    fs.copyFileSync(resolved, path.join(threadDir, name));
    docNames.push(name);
  }

  if (docNames.length === 0) {
    console.error('No valid documents. Aborting.');
    git('checkout', 'main');
    git('branch', '-D', branchName);
    process.exit(1);
  }

  // Create initial THREAD.md
  const threadMd = `# Thread: ${batch}
Branch: ${branchName}

## Documents
${docNames.map(d => `- ${d}`).join('\n')}

## Agent Analysis
_Processing..._

## Proposed Records
_Pending agent analysis._

## Open Items
_None yet._

## User Response
_Edit this section to respond to open items._

## Resolution
_Pending._

## Applied
_Not yet applied._
`;
  fs.writeFileSync(path.join(threadDir, 'THREAD.md'), threadMd, 'utf-8');

  // Commit documents + thread
  git('add', '-A');
  git('commit', '-m', `[steward] Thread ${batch}: ${docNames.join(', ')}`);
  console.log(`Thread created: threads/${batch}/`);
  console.log(`Documents: ${docNames.join(', ')}`);

  // Call copilot steward
  console.log('\nRunning steward agent...');
  const prompt = `You are the @steward agent. Process the documents in threads/${batch}/.

Read each document, read DB/finbook.json, read kb/knowledge.json.
Classify, extract records, check dedup, and update threads/${batch}/THREAD.md with:
- Your analysis (account, doc type, summary)
- Proposed records (structured, with key fields)
- Open items (if any)

If there are NO open items, also update DB/finbook.json with the new records and mark THREAD.md as applied.
If there ARE open items, do NOT update DB/finbook.json — just write the open items and proposed records to THREAD.md.

Follow all rules in copilot-instructions.md. Evidence-based only.`;

  callCopilot(prompt);

  // Commit any changes copilot made
  git('add', '-A');
  const diff = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: REPO_DIR });
  if (diff.status !== 0) {
    git('commit', '-m', `[steward] Analysis for ${batch}`);
    console.log('\nSteward analysis committed.');
  }

  // Show thread status
  const threadContent = fs.readFileSync(path.join(threadDir, 'THREAD.md'), 'utf-8');
  console.log('\n' + threadContent);
}

function cmdClarify() {
  const active = findActiveThread();
  if (!active) {
    console.error('No active steward thread. Use "ingest" to start one.');
    process.exit(1);
  }

  console.log(`Resuming thread: ${active.batchId}`);
  console.log('Running steward agent to process user response...');

  const prompt = `You are the @steward agent. The user has updated the "User Response" section of threads/${active.batchId}/THREAD.md.

Read the THREAD.md to see:
1. The current open items
2. The user's response

Then:
1. Map the user's response to open items
2. Resolve what you can
3. If any response contains reusable knowledge (entity mappings, processing decisions), delegate to @kb-curator
4. If all open items are resolved: update DB/finbook.json with the records and update THREAD.md
5. If open items remain: update THREAD.md with remaining items

Follow all rules in copilot-instructions.md.`;

  // Clear session for fresh context
  const sessionUuid = path.join(TEMP_DIR, 'session', 'session.uuid');
  if (fs.existsSync(sessionUuid)) fs.unlinkSync(sessionUuid);

  callCopilot(prompt);

  // Commit
  git('add', '-A');
  const diff = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: REPO_DIR });
  if (diff.status !== 0) {
    git('commit', '-m', `[steward] Resolution for ${active.batchId}`);
    console.log('Resolution committed.');
  }

  const threadContent = fs.readFileSync(path.join(active.threadDir, 'THREAD.md'), 'utf-8');
  console.log('\n' + threadContent);
}

function cmdConfirm() {
  const active = findActiveThread();
  if (!active) {
    console.error('No active steward thread to confirm.');
    process.exit(1);
  }

  console.log(`Merging thread: ${active.batchId}`);
  const branch = active.branch;

  git('checkout', 'main');
  git('merge', branch, '--no-ff', '-m', `[steward] Confirm ${active.batchId}`);
  git('branch', '-d', branch);

  console.log(`Thread ${active.batchId} confirmed and merged to main.`);
}

function cmdStatus() {
  const threadsDir = path.join(REPO_DIR, 'threads');
  if (!fs.existsSync(threadsDir)) {
    console.log('No threads directory.');
    return;
  }

  const branch = currentBranch();
  console.log(`Current branch: ${branch}`);

  const active = findActiveThread();
  if (active) {
    console.log(`\nActive thread: ${active.batchId}`);
    const threadMd = path.join(active.threadDir, 'THREAD.md');
    if (fs.existsSync(threadMd)) {
      const content = fs.readFileSync(threadMd, 'utf-8');
      // Show just the key sections
      const openMatch = content.match(/## Open Items\n([\s\S]*?)(?=\n## )/);
      const appliedMatch = content.match(/## Applied\n([\s\S]*?)$/);
      if (openMatch) console.log(`\nOpen Items:\n${openMatch[1].trim()}`);
      if (appliedMatch) console.log(`\nApplied:\n${appliedMatch[1].trim()}`);
    }
  } else {
    console.log('No active thread.');
  }

  // List completed threads on main
  const threads = fs.readdirSync(threadsDir).filter(d =>
    fs.statSync(path.join(threadsDir, d)).isDirectory()
  );
  if (threads.length > 0) {
    console.log(`\nAll threads: ${threads.join(', ')}`);
  }
}

// ---- Main ----
const cmd = args[0];
const rest = args.slice(1);

switch (cmd) {
  case 'ingest':
    cmdIngest(rest);
    break;
  case 'clarify':
    cmdClarify();
    break;
  case 'confirm':
    cmdConfirm();
    break;
  case 'status':
    cmdStatus();
    break;
  default:
    console.log(`Usage:
  node finbook-steward.js [--repo <path>] ingest <doc1> [doc2 ...]   Ingest documents
  node finbook-steward.js [--repo <path>] clarify                     Resume after user edits THREAD.md
  node finbook-steward.js [--repo <path>] confirm                     Merge branch to main
  node finbook-steward.js [--repo <path>] status                      Show active threads

  --repo <path>   Path to finbook-data repo (default: ../../finbook-data relative to script)`);
}
