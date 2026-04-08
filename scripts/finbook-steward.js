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
let batchIdArg = null;
const repoIdx = args.indexOf('--repo');
if (repoIdx !== -1) {
  repoArg = args[repoIdx + 1];
  args.splice(repoIdx, 2);
}
const batchIdx = args.indexOf('--batch-id');
if (batchIdx !== -1) {
  batchIdArg = args[batchIdx + 1];
  args.splice(batchIdx, 2);
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
  if (!branch.startsWith('batch-')) return null;
  const batchId = branch;
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

  // When called from bridge server with --batch-id, branch is already created
  if (!batchIdArg) {
    // Ensure we're on main (CLI-only mode)
    const branch = currentBranch();
    if (branch !== 'main') {
      console.error(`Must be on main branch (currently on ${branch}).`);
      console.error('Use "clarify" to continue an active thread, or merge/delete the branch first.');
      process.exit(1);
    }
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
  const batchName = batchIdArg || 'batch-YYYYMMDD-HHMM';
  const branchName = batchName;
  const prompt = `Process these documents as a new batch following the batch workflow in copilot-instructions.md:

Documents to ingest:
${resolvedPaths.map(p => `- ${p}`).join('\n')}

IMPORTANT: The batch branch and thread directory have already been created by the bridge server.
- Branch: ${branchName} (you are already on this branch)
- Thread directory: threads/${batchName}/ (already exists)
- The source documents have already been copied into the thread directory.

Do NOT create the branch or directory. Do NOT copy the documents. They are already in place.

Steps:
1. Read threads/${batchName}/THREAD.md if it exists
2. Read each source document in threads/${batchName}/
3. Read DB/finbook.json and lore/knowledge.json
4. Classify, extract records, check dedup
5. If no open items: update DB/finbook.json, create/update THREAD.md as applied
6. If open items: write them to THREAD.md, do NOT update DB
7. If any reusable knowledge is discovered, update lore/knowledge.json
8. Commit all changes with descriptive messages

Evidence-based only. Follow all rules in copilot-instructions.md.`;

  callCopilot(prompt);
}

function cmdClarify() {
  const active = findActiveThread();
  if (!active) {
    console.error('No active steward thread. Use "ingest" to start one.');
    process.exit(1);
  }

  console.log(`Resuming thread: ${active.batchId}`);

  const prompt = `The user has updated threads/${active.batchId}/THREAD.md with their response to open items.

Read the THREAD.md to see:
1. The current open items
2. The user's response

Then:
1. Map the user's response to open items
2. Resolve what you can
3. If any response contains reusable knowledge, update lore/knowledge.json
4. If all open items are resolved: update DB/finbook.json with the records and update THREAD.md — clear open items
5. If open items remain: update THREAD.md with remaining items
6. Commit all changes with descriptive messages

Follow all rules in copilot-instructions.md.`;

  // Clear session for fresh context
  const sessionUuid = path.join(TEMP_DIR, 'session', 'session.uuid');
  if (fs.existsSync(sessionUuid)) fs.unlinkSync(sessionUuid);

  callCopilot(prompt);
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
    const content = fs.readFileSync(threadMdPath, 'utf-8').toLowerCase();
    // Look for any open item markers that aren't resolved
    const hasOpenSection = content.includes('## open items') || content.includes('## open questions');
    if (hasOpenSection) {
      // Check if section contains actual unresolved items (not just "none" or empty)
      const openMatch = content.match(/## open (items|questions)\n([\s\S]*?)(?=\n## |$)/);
      if (openMatch) {
        const openText = openMatch[2].trim();
        const isEmpty = !openText
          || openText.match(/^[_*]*(none|n\/a|no open|all resolved|no unresolved)[_*]*/i)
          || openText === '-' || openText === '';
        if (!isEmpty) {
          console.error('Cannot confirm — THREAD.md has unresolved open items.');
          console.error('Use "clarify" to resolve them first, or edit THREAD.md to clear them.');
          process.exit(1);
        }
      }
    }
  }

  console.log(`Confirming thread: ${active.batchId}`);

  // Validate finbook.json before merge
  const validateScript = path.join(REPO_DIR, '.github', 'scripts', 'validate-finbook.js');
  const finbookJson = path.join(REPO_DIR, 'DB', 'finbook.json');
  if (fs.existsSync(validateScript) && fs.existsSync(finbookJson)) {
    console.log('Running finbook validation...');
    try {
      const { execFileSync } = require('child_process');
      const out = execFileSync('node', [validateScript, finbookJson], { encoding: 'utf-8' });
      const result = JSON.parse(out);
      if (!result.valid) {
        console.error('Cannot confirm — finbook.json has validation errors:');
        (result.errorDetails || []).forEach(e => console.error(`  - ${e}`));
        console.error('Fix the errors and try again.');
        process.exit(1);
      }
      if (result.warnings > 0) {
        console.warn(`Validation passed with ${result.warnings} warning(s):`);
        (result.warningDetails || []).forEach(w => console.warn(`  - ${w}`));
      } else {
        console.log('Validation passed.');
      }
    } catch (e) {
      if (e.status === 2) {
        // Validation errors
        try {
          const result = JSON.parse(e.stdout);
          console.error('Cannot confirm — finbook.json has validation errors:');
          (result.errorDetails || []).forEach(err => console.error(`  - ${err}`));
        } catch (_) {
          console.error('Cannot confirm — finbook.json validation failed.');
          console.error(e.stderr || e.message);
        }
        process.exit(1);
      }
      console.error(`Validation script error: ${e.message}`);
      process.exit(1);
    }
  }

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
  const prompt = `Report the current status of the finbook-data repository:

1. What branch are we on?
2. Is there an active steward batch? If so, what's the batch name?
3. If there's an active batch, read its THREAD.md and summarize: what documents were processed, what records were added or proposed, are there any open items?
4. List all completed threads in the threads/ directory.

Be concise.`;

  // Clear session for fresh context
  const sessionUuid = path.join(TEMP_DIR, 'session', 'session.uuid');
  if (fs.existsSync(sessionUuid)) fs.unlinkSync(sessionUuid);

  callCopilot(prompt);
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
