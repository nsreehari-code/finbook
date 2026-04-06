// server.js — Finbook bridge server
// Serves static finbook app + API for repo connection, data sync, and steward pipeline
//
// Usage: node scripts/server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

// ---- Config ----
const CONFIG_PATH = path.join(__dirname, 'server-config.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
const PORT = config.port || 8080;
const STATIC_ROOT = path.resolve(__dirname, '..');
const WRAPPER = path.resolve(__dirname, 'copilot_wrapper.bat');
const TEMP_DIR = path.join(os.tmpdir(), 'finbook-steward');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// Resolve repo paths relative to config file
const repos = config.repos.map(r => ({
  ...r,
  resolvedPath: path.resolve(__dirname, r.path)
}));

let activeRepo = null; // set via POST /api/connect

// ---- Active batch tracking ----
let activeBatch = null; // { id, sseClients: Set, chatLog: [] }

// ---- MIME types ----
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

// ---- Helpers ----
function jsonResp(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function repoDir() {
  if (!activeRepo) return null;
  return activeRepo.resolvedPath;
}

function dbPath() {
  const rd = repoDir();
  return rd ? path.join(rd, 'DB', 'finbook.json') : null;
}

function threadsDir() {
  const rd = repoDir();
  return rd ? path.join(rd, 'threads') : null;
}

function currentBranch(rd) {
  const { execSync } = require('child_process');
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: rd, encoding: 'utf-8' }).trim();
  } catch { return 'unknown'; }
}

// Find actual branch name for a batchId (could be "batch-*" or "steward/batch-*")
function findBatchBranch(rd, batchId) {
  const { execSync } = require('child_process');
  try {
    const branches = execSync('git branch --list', { cwd: rd, encoding: 'utf-8' })
      .split('\n').map(b => b.replace(/^\*?\s+/, '').trim()).filter(Boolean);
    return branches.find(b => b === batchId || b === `steward/${batchId}`) || batchId;
  } catch { return batchId; }
}

// ---- Parse multipart form data ----
function parseMultipart(buf, boundary) {
  const files = [];
  const sep = Buffer.from('--' + boundary);
  const parts = [];
  let idx = 0;

  while (true) {
    const start = buf.indexOf(sep, idx);
    if (start === -1) break;
    if (parts.length > 0) {
      parts[parts.length - 1].end = start - 2; // strip \r\n before boundary
    }
    const headerEnd = buf.indexOf('\r\n\r\n', start);
    if (headerEnd === -1) break;
    parts.push({ headerStart: start, bodyStart: headerEnd + 4, end: buf.length });
    idx = headerEnd + 4;
  }

  for (const part of parts) {
    const header = buf.slice(part.headerStart, part.bodyStart).toString('utf-8');
    const nameMatch = header.match(/name="([^"]+)"/);
    const filenameMatch = header.match(/filename="([^"]+)"/);
    if (nameMatch && filenameMatch) {
      files.push({
        fieldName: nameMatch[1],
        filename: filenameMatch[1],
        data: buf.slice(part.bodyStart, part.end)
      });
    }
  }
  return files;
}

// ---- DB file watcher SSE ----
const dataWatchers = new Set();
let dbWatcher = null;

function startDbWatcher() {
  if (dbWatcher) { dbWatcher.close(); dbWatcher = null; }
  const dp = dbPath();
  if (!dp || !fs.existsSync(dp)) return;

  let debounce = null;
  dbWatcher = fs.watch(dp, () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      for (const client of dataWatchers) {
        client.write(`data: ${JSON.stringify({ event: 'db-changed' })}\n\n`);
      }
    }, 500);
  });
}

// ---- Batch helpers ----

// Chat persistence: each message saved as NNN-role.md in threads/<batch>/chat/
function saveChatMessage(batchId, role, text) {
  const td = threadsDir();
  if (!td) return;
  const chatDir = path.join(td, batchId, 'chat');
  if (!fs.existsSync(chatDir)) fs.mkdirSync(chatDir, { recursive: true });

  const existing = fs.readdirSync(chatDir).filter(f => f.match(/^\d{3}-/));
  const seq = String(existing.length + 1).padStart(3, '0');
  const filename = `${seq}-${role}.md`;
  fs.writeFileSync(path.join(chatDir, filename), text, 'utf-8');
}

function loadChatMessages(batchId) {
  const td = threadsDir();
  if (!td) return [];
  const chatDir = path.join(td, batchId, 'chat');
  if (!fs.existsSync(chatDir)) return [];

  return fs.readdirSync(chatDir)
    .filter(f => f.match(/^\d{3}-(user|assistant|system)\.md$/))
    .sort()
    .map(f => {
      const role = f.replace(/^\d{3}-/, '').replace('.md', '');
      const text = fs.readFileSync(path.join(chatDir, f), 'utf-8');
      return { role, text };
    });
}

function listBatches() {
  const td = threadsDir();
  if (!td || !fs.existsSync(td)) return [];

  const rd = repoDir();
  const branch = currentBranch(rd);
  // Match branch names: "batch-*" or "steward/batch-*"
  const batchMatch = branch.match(/(?:^|\/)(batch-\d{8}-\d{4})$/);
  const activeBatchName = batchMatch ? batchMatch[1] : null;

  const entries = fs.readdirSync(td, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && e.name.startsWith('batch-'))
    .map(e => {
      const batchDir = path.join(td, e.name);
      const threadPath = path.join(batchDir, 'THREAD.md');
      const threadContent = fs.existsSync(threadPath) ? fs.readFileSync(threadPath, 'utf-8') : '';

      // List files (exclude THREAD.md, chat dir)
      const files = fs.readdirSync(batchDir).filter(f => f !== 'THREAD.md' && f !== '.gitkeep' && f !== 'chat');

      // Determine status
      const isActive = e.name === activeBatchName;
      const hasOpenItems = checkOpenItems(threadContent);

      let status = 'confirmed';
      if (isActive) {
        status = hasOpenItems ? 'open-items' : 'ready';
      }

      // Extract resolved decisions from thread
      const decisions = extractDecisions(threadContent);

      // Load chat only for active batches; for confirmed, just return count
      let chat = [];
      let chatCount = 0;
      if (isActive) {
        chat = loadChatMessages(e.name);
        chatCount = chat.length;
      } else {
        // Just count chat files without reading content
        const chatDir = path.join(batchDir, 'chat');
        if (fs.existsSync(chatDir)) {
          chatCount = fs.readdirSync(chatDir).filter(f => f.endsWith('.md')).length;
        }
      }

      // Check if batch is currently processing
      const processingFile = path.join(batchDir, 'chat', '.processing');
      const processing = fs.existsSync(processingFile);

      return {
        id: e.name,
        files,
        status,
        thread: threadContent,
        decisions,
        chat,
        chatCount,
        hasOpenItems,
        processing
      };
    })
    .sort((a, b) => b.id.localeCompare(a.id)); // newest first
}

function checkOpenItems(threadContent) {
  const lower = threadContent.toLowerCase();
  const openMatch = lower.match(/## open (items|questions)\n([\s\S]*?)(?=\n## |$)/);
  if (!openMatch) return false;
  const text = openMatch[2].trim();
  if (!text || text.match(/^[_*]*(none|n\/a|no open|all resolved|no unresolved)[_*]*/i)) return false;
  return true;
}

function extractDecisions(threadContent) {
  // Look for applied section or resolved items
  const decisions = [];
  const appliedMatch = threadContent.match(/## Applied\n([\s\S]*?)(?=\n## |$)/);
  if (appliedMatch) {
    decisions.push(appliedMatch[1].trim());
  }
  return decisions;
}

// ---- Steward integration ----
// Single copilot call for all batch interactions (ingest, respond, clarify).
// Server does deterministic setup first (branch, files, chat messages), then calls this.
// Copilot is expected to produce two outputs:
//   1. Update threads/<batchId>/THREAD.md (audit digest)
//   2. Write user-facing response to threads/<batchId>/chat/<NNN>-assistant.md
// onDone(err, response, code) — response is the content of the response file
function callBatchCopilot(batchId, onDone) {
  const rd = repoDir();
  if (!rd) { onDone('No repo connected'); return; }

  const td = threadsDir();
  if (!td) { onDone('No threads dir'); return; }

  const batchDir = path.join(td, batchId);
  const chatDir = path.join(batchDir, 'chat');
  if (!fs.existsSync(chatDir)) fs.mkdirSync(chatDir, { recursive: true });

  // Compute next sequence number for the assistant response file
  const existing = fs.readdirSync(chatDir).filter(f => f.match(/^\d{3}-/));
  const nextSeq = String(existing.length + 1).padStart(3, '0');
  const responseFileName = `${nextSeq}-assistant.md`;
  const responseFilePath = path.join(chatDir, responseFileName);
  const responseFileRel = `threads/${batchId}/chat/${responseFileName}`;

  // Build list of source files in the batch
  let filesList = '';
  if (fs.existsSync(batchDir)) {
    const files = fs.readdirSync(batchDir).filter(f => f !== 'THREAD.md' && f !== '.gitkeep' && f !== 'chat');
    filesList = files.map(f => `- threads/${batchId}/${f}`).join('\n');
  }

  const prompt = `You are the Finbook data steward assistant. Batch: ${batchId}

## Three-way architecture
1. **You (Copilot CLI)** — read files, process, write two outputs (see below). Stdout is discarded.
2. **Bridge Server** — manages files and chat persistence; reads your response file and streams it to the user.
3. **User's Chat UI** — user only sees the content of the response file you write.

## Git constraints — DO NOT VIOLATE
- Do NOT create branches, checkout branches, or merge branches. The server manages all branch operations.
- Do NOT run git merge, git checkout, or git branch commands.
- You ARE allowed to: git add, git commit (version_enabled handles this), read files, write files.
- Confirm/merge is a user action through the UI. Never auto-confirm or auto-merge.

## Two outputs required

### Output 1: Update THREAD.md
Update threads/${batchId}/THREAD.md as the structured audit digest. This is NOT shown to the user.
Follow the THREAD.md format from .github/copilot-instructions.md: batch info, document analysis, dedup results, audit log.
If THREAD.md doesn't exist, create it. If it exists, update it to reflect the current state.

### Output 2: Write user response
Write your user-facing response to this exact file path:
  ${responseFileRel}

This is the ONLY way your response reaches the user. Be direct and meaningful — summarize what happened, what was found, and whether any action is needed. No fluff, no internal reasoning.

## Context
Batch directory: threads/${batchId}/
Source documents:
${filesList || '(none)'}

Chat history: threads/${batchId}/chat/ (read all .md files in numeric order)
DB: DB/finbook.json
KB: kb/knowledge.json
Instructions: .github/copilot-instructions.md

Read everything, then produce both outputs.`;

  const outputFile = path.join(TEMP_DIR, 'bridge-response.txt');
  const sessionDir = path.join(TEMP_DIR, `bridge-session-${Date.now()}`);
  fs.mkdirSync(sessionDir, { recursive: true });

  const promptFile = path.join(TEMP_DIR, 'bridge-prompt.txt');
  fs.writeFileSync(promptFile, prompt, 'utf-8');

  const cmdExe = process.env.COMSPEC || 'cmd.exe';
  const proc = spawn(cmdExe, [
    '/c', WRAPPER,
    outputFile,
    sessionDir,
    rd,
    `@${promptFile}`,
    '',      // model
    'true',  // version_enabled — commit after copilot runs
    'steward' // agent_name
  ], {
    cwd: rd,
    windowsHide: true,
    stdio: 'pipe'
  });

  proc.on('close', code => {
    let response = '';

    // Read the response file that copilot wrote
    try {
      if (fs.existsSync(responseFilePath)) {
        response = fs.readFileSync(responseFilePath, 'utf-8').trim();
      }
    } catch (e) { /* ignore */ }

    // Clean up one-time session dir
    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    onDone(null, response, code);
  });
}

// ---- SSE helpers for batch streaming ----
function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ---- Route handling ----
function handleAPI(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const apiPath = url.pathname;
  const method = req.method;

  // --- GET /api/health ---
  if (method === 'GET' && apiPath === '/api/health') {
    return jsonResp(res, 200, {
      status: 'ok',
      activeRepo: activeRepo ? { id: activeRepo.id, name: activeRepo.name } : null
    });
  }

  // --- GET /api/repos ---
  if (method === 'GET' && apiPath === '/api/repos') {
    return jsonResp(res, 200, repos.map(r => ({
      id: r.id, name: r.name,
      valid: fs.existsSync(r.resolvedPath)
    })));
  }

  // --- POST /api/connect ---
  if (method === 'POST' && apiPath === '/api/connect') {
    return readBody(req).then(body => {
      const { id } = JSON.parse(body.toString());
      const repo = repos.find(r => r.id === id);
      if (!repo) return jsonResp(res, 404, { error: 'Repo not found' });
      if (!fs.existsSync(repo.resolvedPath)) return jsonResp(res, 400, { error: 'Repo path not found on disk' });
      activeRepo = repo;
      startDbWatcher();
      return jsonResp(res, 200, { connected: true, id: repo.id, name: repo.name });
    });
  }

  // --- GET /api/data ---
  if (method === 'GET' && apiPath === '/api/data') {
    const dp = dbPath();
    if (!dp) return jsonResp(res, 400, { error: 'No repo connected' });
    if (!fs.existsSync(dp)) return jsonResp(res, 404, { error: 'DB file not found' });
    const data = JSON.parse(fs.readFileSync(dp, 'utf-8'));
    return jsonResp(res, 200, data);
  }

  // --- PUT /api/data ---
  if (method === 'PUT' && apiPath === '/api/data') {
    const dp = dbPath();
    if (!dp) return jsonResp(res, 400, { error: 'No repo connected' });
    return readBody(req).then(body => {
      // Validate JSON before writing
      try { JSON.parse(body.toString()); } catch { return jsonResp(res, 400, { error: 'Invalid JSON' }); }
      fs.writeFileSync(dp, body.toString(), 'utf-8');
      return jsonResp(res, 200, { saved: true });
    });
  }

  // --- GET /api/data/watch (SSE) ---
  if (method === 'GET' && apiPath === '/api/data/watch') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(`data: ${JSON.stringify({ event: 'connected' })}\n\n`);
    dataWatchers.add(res);
    req.on('close', () => dataWatchers.delete(res));
    return;
  }

  // --- GET /api/batches ---
  if (method === 'GET' && apiPath === '/api/batches') {
    if (!repoDir()) return jsonResp(res, 400, { error: 'No repo connected' });
    return jsonResp(res, 200, listBatches());
  }

  // --- POST /api/batch/new ---
  if (method === 'POST' && apiPath === '/api/batch/new') {
    if (!repoDir()) return jsonResp(res, 400, { error: 'No repo connected' });
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const batchId = `batch-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    return jsonResp(res, 200, { batchId });
  }

  // --- POST /api/batch/:id/send ---
  // Unified endpoint: handles files + message, or message only.
  // If batch doesn't exist yet, creates branch + dir. If files present, copies them. If message, saves it. Then calls copilot.
  const sendMatch = apiPath.match(/^\/api\/batch\/([^/]+)\/send$/);
  if (method === 'POST' && sendMatch) {
    if (!repoDir()) return jsonResp(res, 400, { error: 'No repo connected' });

    const batchId = sendMatch[1];
    const rd = repoDir();
    const td = threadsDir();

    return readBody(req).then(body => {
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      if (!boundaryMatch) return jsonResp(res, 400, { error: 'Expected multipart/form-data' });

      const files = parseMultipart(body, boundaryMatch[1]);
      const msgMatch = body.toString('latin1').match(/name="message"\r?\n\r?\n([^\r]*)/);
      const userMessage = msgMatch ? msgMatch[1].trim() : '';

      if (files.length === 0 && !userMessage) {
        return jsonResp(res, 400, { error: 'No files or message' });
      }

      const { execSync } = require('child_process');

      // Ensure batch branch exists (could be "batch-*" or "steward/batch-*")
      try {
        const branch = currentBranch(rd);
        const existingBranch = findBatchBranch(rd, batchId);
        if (branch !== batchId && branch !== `steward/${batchId}`) {
          if (branch !== 'main') {
            execSync('git checkout main', { cwd: rd, encoding: 'utf-8' });
          }
          if (existingBranch !== batchId) {
            // Branch exists with a different name (e.g. steward/batch-*)
            execSync(`git checkout ${existingBranch}`, { cwd: rd, encoding: 'utf-8' });
          } else {
            execSync(`git checkout -b ${batchId}`, { cwd: rd, encoding: 'utf-8' });
          }
        }
      } catch (e) {
        // Branch may already exist — try switching to it
        try {
          const existingBranch = findBatchBranch(rd, batchId);
          execSync(`git checkout ${existingBranch}`, { cwd: rd, encoding: 'utf-8' });
        } catch (e2) {
          return jsonResp(res, 500, { error: `Failed to setup branch: ${e2.message}` });
        }
      }

      // Ensure batch directory exists
      const batchDir = path.join(td, batchId);
      fs.mkdirSync(batchDir, { recursive: true });
      fs.mkdirSync(path.join(batchDir, 'chat'), { recursive: true });

      // Copy files if present
      if (files.length > 0) {
        for (const f of files) {
          const safeName = path.basename(f.filename).replace(/[^a-zA-Z0-9._-]/g, '_');
          fs.writeFileSync(path.join(batchDir, safeName), f.data);
        }
      }

      // Initialize activeBatch if needed
      if (!activeBatch || activeBatch.id !== batchId) {
        activeBatch = { id: batchId, sseClients: new Set(), chatLog: [] };
      }

      // Save chat messages
      if (files.length > 0) {
        const fileNames = files.map(f => f.filename).join(', ');
        const sysMsg = `Ingesting ${files.length} file(s) — ${fileNames}`;
        activeBatch.chatLog.push({ role: 'system', text: sysMsg, ts: Date.now() });
        saveChatMessage(batchId, 'system', sysMsg);
      }
      if (userMessage) {
        activeBatch.chatLog.push({ role: 'user', text: userMessage, ts: Date.now() });
        saveChatMessage(batchId, 'user', userMessage);
        for (const client of activeBatch.sseClients) {
          sendSSE(client, 'message', { role: 'user', text: userMessage });
        }
      }

      // Mark batch as processing
      const processingFile = path.join(td, batchId, 'chat', '.processing');
      fs.writeFileSync(processingFile, new Date().toISOString());

      // Call copilot
      callBatchCopilot(batchId, (err, response, code) => {
        // Remove processing flag
        try { fs.unlinkSync(processingFile); } catch (e) { /* ignore */ }

        if (err) {
          const errMsg = `Error: ${err}`;
          activeBatch.chatLog.push({ role: 'system', text: errMsg, ts: Date.now() });
          saveChatMessage(batchId, 'system', errMsg);
          for (const client of activeBatch.sseClients) {
            sendSSE(client, 'done', { summary: errMsg, code });
          }
          return;
        }
        if (response) {
          activeBatch.chatLog.push({ role: 'assistant', text: response, ts: Date.now() });
          for (const client of activeBatch.sseClients) {
            sendSSE(client, 'message', { role: 'assistant', text: response });
          }
        }
        for (const client of activeBatch.sseClients) {
          sendSSE(client, 'done', { summary: 'Done', code });
        }
        for (const client of dataWatchers) {
          client.write(`data: ${JSON.stringify({ event: 'db-changed' })}\n\n`);
        }
      });

      return jsonResp(res, 200, { batchId, files: files.map(f => f.filename) });
    });
  }

  // --- GET /api/batch/:id/stream (SSE) ---
  const streamMatch = apiPath.match(/^\/api\/batch\/([^/]+)\/stream$/);
  if (method === 'GET' && streamMatch) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const streamBatchId = streamMatch[1];
    const streamProcessingFile = path.join(threadsDir(), streamBatchId, 'chat', '.processing');

    if (activeBatch && activeBatch.id === streamBatchId) {
      if (fs.existsSync(streamProcessingFile)) {
        sendSSE(res, 'processing', { text: 'Processing...' });
      }
      activeBatch.sseClients.add(res);
      req.on('close', () => activeBatch.sseClients.delete(res));
    } else if (fs.existsSync(streamProcessingFile)) {
      // Server restarted mid-processing — stale flag
      try { fs.unlinkSync(streamProcessingFile); } catch (e) { /* ignore */ }
      sendSSE(res, 'done', { summary: 'Batch complete (recovered)' });
      res.end();
    } else {
      sendSSE(res, 'done', { summary: 'Batch complete' });
      res.end();
    }
    return;
  }

  // --- POST /api/batch/:id/confirm ---
  const confirmMatch = apiPath.match(/^\/api\/batch\/([^/]+)\/confirm$/);
  if (method === 'POST' && confirmMatch) {
    if (!repoDir()) return jsonResp(res, 400, { error: 'No repo connected' });
    const rd = repoDir();
    const batchId = confirmMatch[1];
    const branchName = findBatchBranch(rd, batchId);

    // Guard: block confirm if batch is still processing
    const td = threadsDir();
    const processingFile = path.join(td, batchId, 'chat', '.processing');
    if (fs.existsSync(processingFile)) {
      return jsonResp(res, 409, { error: 'Batch is still processing. Wait for completion before confirming.' });
    }

    // Guard: block confirm if batch has open items
    const threadPath = path.join(td, batchId, 'THREAD.md');
    const threadContent = fs.existsSync(threadPath) ? fs.readFileSync(threadPath, 'utf-8') : '';
    if (checkOpenItems(threadContent)) {
      return jsonResp(res, 409, { error: 'Batch has open items. Resolve them before confirming.' });
    }

    // Guard: clean up stale .processing file in branch before merging
    try {
      const { execSync } = require('child_process');
      const branchProcessing = path.join(rd, 'threads', batchId, 'chat', '.processing');
      const currentBr = currentBranch(rd);
      if (currentBr !== branchName) {
        execSync(`git checkout ${branchName}`, { cwd: rd, encoding: 'utf-8' });
      }
      if (fs.existsSync(branchProcessing)) {
        execSync(`git rm -f threads/${batchId}/chat/.processing`, { cwd: rd, encoding: 'utf-8' });
        execSync('git commit -m "[steward] cleanup: remove stale .processing"', { cwd: rd, encoding: 'utf-8' });
      }
      execSync('git checkout main', { cwd: rd, encoding: 'utf-8' });
      execSync(`git merge ${branchName} --no-ff -m "[steward] Confirm ${batchId}"`, { cwd: rd, encoding: 'utf-8' });
      try { execSync(`git branch -d ${branchName}`, { cwd: rd, encoding: 'utf-8' }); } catch (e) { /* ignore */ }

      if (activeBatch) {
        for (const client of activeBatch.sseClients) {
          sendSSE(client, 'done', { summary: 'Batch confirmed and merged' });
        }
        activeBatch = null;
      }
      for (const client of dataWatchers) {
        client.write(`data: ${JSON.stringify({ event: 'db-changed' })}\n\n`);
      }
      return jsonResp(res, 200, { confirmed: true });
    } catch (e) {
      return jsonResp(res, 500, { error: e.message });
    }
  }

  // --- POST /api/batch/:id/discard ---
  const discardMatch = apiPath.match(/^\/api\/batch\/([^/]+)\/discard$/);
  if (method === 'POST' && discardMatch) {
    if (!repoDir()) return jsonResp(res, 400, { error: 'No repo connected' });
    const rd = repoDir();
    const batchId = discardMatch[1];
    const branchName = findBatchBranch(rd, batchId);

    try {
      const { execSync } = require('child_process');
      const branch = currentBranch(rd);

      // Switch to main if on the batch branch
      if (branch === branchName) {
        execSync('git checkout main', { cwd: rd, encoding: 'utf-8' });
      }

      // Delete the branch
      try {
        execSync(`git branch -D ${branchName}`, { cwd: rd, encoding: 'utf-8' });
      } catch (e) { /* branch may not exist */ }

      // Remove the thread directory
      const td = threadsDir();
      const threadDir = path.join(td, batchId);
      if (fs.existsSync(threadDir)) {
        fs.rmSync(threadDir, { recursive: true, force: true });
      }

      // Clear active batch
      if (activeBatch && activeBatch.id === batchId) {
        activeBatch = null;
      }

      return jsonResp(res, 200, { discarded: true });
    } catch (e) {
      return jsonResp(res, 500, { error: e.message });
    }
  }

  // --- GET /api/batch/:id/chat ---
  const chatMatch = apiPath.match(/^\/api\/batch\/([^/]+)\/chat$/);
  if (method === 'GET' && chatMatch) {
    const batchId = chatMatch[1];
    const chat = loadChatMessages(batchId);
    return jsonResp(res, 200, chat);
  }

  // --- GET /api/batch/:id/files/:filename ---
  const fileMatch = apiPath.match(/^\/api\/batch\/([^/]+)\/files\/(.+)$/);
  if (method === 'GET' && fileMatch) {
    const td = threadsDir();
    if (!td) return jsonResp(res, 400, { error: 'No repo connected' });
    const filePath = path.join(td, fileMatch[1], path.basename(fileMatch[2]));
    if (!fs.existsSync(filePath)) return jsonResp(res, 404, { error: 'File not found' });

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Unknown API
  return jsonResp(res, 404, { error: 'Not found' });
}

// ---- Static file server ----
function serveStatic(req, res) {
  let filePath = path.join(STATIC_ROOT, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (filePath.endsWith(path.sep) || filePath === STATIC_ROOT) {
    filePath = path.join(STATIC_ROOT, 'index.html');
  }

  // Prevent path traversal
  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Not Found');
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    filePath = path.join(filePath, 'index.html');
    if (!fs.existsSync(filePath)) { res.writeHead(404); return res.end('Not Found'); }
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

// ---- HTTP Server ----
const server = http.createServer((req, res) => {
  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.url.startsWith('/api/')) {
    handleAPI(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`Finbook server running at http://localhost:${PORT}`);
  console.log(`Configured repos: ${repos.map(r => r.name).join(', ')}`);
});
