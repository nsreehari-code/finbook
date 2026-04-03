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
const { spawnSync } = require('child_process');
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
function currentBranch() {
  const result = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: REPO_DIR, encoding: 'utf-8' });
  if (result.error) throw result.error;
  return result.stdout.trim();
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
    ''
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

  // Resolve absolute paths for the prompt
  const resolvedPaths = [];
  for (const docPath of docPaths) {
    const resolved = path.resolve(docPath);
    if (!fs.existsSync(resolved)) {
      console.error(`File not found: ${docPath}`);
      continue;
    }
    resolvedPaths.push(resolved);
  }

  if (resolvedPaths.length === 0) {
    console.error('No valid documents. Aborting.');
    process.exit(1);
  }

  console.log('Running steward agent...');
  const prompt = `Process these documents as a new batch following the batch workflow in copilot-instructions.md:

Documents to ingest:
${resolvedPaths.map(p => `- ${p}`).join('\n')}

Steps:
1. Create a batch branch from main: git checkout -b steward/batch-YYYYMMDD-HHMM
2. Create the thread directory: threads/<batch-name>/
3. Copy the documents into the thread directory
4. Create THREAD.md as an audit log
5. Read each document, read DB/finbook.json, read kb/knowledge.json
6. Classify, extract records, check dedup
7. If no open items: update DB/finbook.json, mark THREAD.md as applied
8. If open items: write them to THREAD.md, do NOT update DB
9. If any reusable knowledge is discovered, update kb/knowledge.json
10. Commit all changes with descriptive messages

Evidence-based only. Follow all rules in copilot-instructions.md.`;

  callCopilot(prompt);

  // Show thread status if available
  const active = findActiveThread();
  if (active) {
    const threadMdPath = path.join(active.threadDir, 'THREAD.md');
    if (fs.existsSync(threadMdPath)) {
      console.log('\n' + fs.readFileSync(threadMdPath, 'utf-8'));
    }
  }
}

function cmdClarify() {
  const active = findActiveThread();
  if (!active) {
    console.error('No active steward thread. Use "ingest" to start one.');
    process.exit(1);
  }

  console.log(`Resuming thread: ${active.batchId}`);

  const prompt = `The user has updated the "User Response" section of threads/${active.batchId}/THREAD.md.

Read the THREAD.md to see:
1. The current open items
2. The user's response

Then:
1. Map the user's response to open items
2. Resolve what you can
3. If any response contains reusable knowledge, update kb/knowledge.json
4. If all open items are resolved: update DB/finbook.json with the records and update THREAD.md
5. If open items remain: update THREAD.md with remaining items
6. Commit all changes with descriptive messages

Follow all rules in copilot-instructions.md.`;

  // Clear session for fresh context
  const sessionUuid = path.join(TEMP_DIR, 'session', 'session.uuid');
  if (fs.existsSync(sessionUuid)) fs.unlinkSync(sessionUuid);

  callCopilot(prompt);

  // Show thread status if available
  const threadMdPath = path.join(active.threadDir, 'THREAD.md');
  if (fs.existsSync(threadMdPath)) {
    console.log('\n' + fs.readFileSync(threadMdPath, 'utf-8'));
  }
}

function cmdConfirm() {
  const active = findActiveThread();
  if (!active) {
    console.error('No active steward thread to confirm.');
    process.exit(1);
  }

  // Check for unresolved open items
  const threadMdPath = path.join(active.threadDir, 'THREAD.md');
  if (fs.existsSync(threadMdPath)) {
    const content = fs.readFileSync(threadMdPath, 'utf-8');
    const openMatch = content.match(/## Open Items\n([\s\S]*?)(?=\n## )/);
    if (openMatch) {
      const openText = openMatch[1].trim();
      const hasUnresolved = openText && !openText.match(/^(_?none|_?n\/a|_?no open items)/i);
      if (hasUnresolved) {
        console.error('Cannot confirm — there are unresolved open items:');
        console.error(openText);
        console.error('\nUse "clarify" to resolve them first.');
        process.exit(1);
      }
    }
  }

  console.log(`Confirming thread: ${active.batchId}`);

  const prompt = `The user has confirmed batch ${active.batchId}. The current branch is ${active.branch}.

Merge this batch branch to main:
1. Run: git checkout main
2. Run: git merge ${active.branch} --no-ff -m "[steward] Confirm ${active.batchId}"
3. Run: git branch -d ${active.branch}
4. Confirm the merge is complete.

Follow the batch workflow in copilot-instructions.md.`;

  // Clear session for fresh context
  const sessionUuid = path.join(TEMP_DIR, 'session', 'session.uuid');
  if (fs.existsSync(sessionUuid)) fs.unlinkSync(sessionUuid);

  callCopilot(prompt);

  console.log(`Thread ${active.batchId} confirmed.`);
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
