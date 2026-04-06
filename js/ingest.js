// ingest.js — Ingest canvas: batch cards, drag-and-drop, chat interface

let ingestBatches = [];

// ---- Shared constants ----
const ALLOWED_EXTENSIONS = new Set([
  '.txt', '.csv', '.md', '.json', '.html', '.xml',
  '.pdf', '.xlsx', '.docx', '.pptx',
  '.png', '.jpg', '.jpeg'
]);

// ---- Load batches from API ----
async function loadBatches() {
  try {
    const resp = await fetch('/api/batches');
    if (!resp.ok) return;
    ingestBatches = await resp.json();
    renderIngestCanvas();
  } catch (e) {
    console.error('Failed to load batches:', e);
  }
}

// ---- Render the full ingest canvas ----
function renderIngestCanvas() {
  const container = document.getElementById('ingestContainer');
  if (!container) return;

  const hasActiveBatch = ingestBatches.some(b => b.status === 'ready' || b.status === 'open-items');

  let html = '';
  if (!hasActiveBatch) html += renderNewBatchCard();
  for (const batch of ingestBatches) {
    html += renderBatchCard(batch);
  }
  container.innerHTML = html;

  if (!hasActiveBatch) wireNewBatchCard();
  for (const batch of ingestBatches) {
    wireExistingBatchCard(batch);
  }
}

// ---- Shared: file staging logic ----
function createFileStagingUI(dropZoneEl, fileInputEl, stagedContainerEl, inputEl, onChange) {
  let stagedFiles = [];

  dropZoneEl.addEventListener('click', () => fileInputEl.click());
  dropZoneEl.addEventListener('dragover', e => { e.preventDefault(); dropZoneEl.classList.add('drag-over'); });
  dropZoneEl.addEventListener('dragleave', () => dropZoneEl.classList.remove('drag-over'));
  dropZoneEl.addEventListener('drop', e => {
    e.preventDefault();
    dropZoneEl.classList.remove('drag-over');
    addFiles(e.dataTransfer.files);
  });
  fileInputEl.addEventListener('change', e => {
    addFiles(e.target.files);
    e.target.value = '';
  });

  function addFiles(fileList) {
    const rejected = [];
    for (const f of fileList) {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) { rejected.push(f.name); continue; }
      if (!stagedFiles.find(s => s.name === f.name)) stagedFiles.push(f);
    }
    if (rejected.length > 0) {
      alert('Unsupported file(s) skipped:\n' + rejected.join('\n') +
        '\n\nSupported: ' + [...ALLOWED_EXTENSIONS].join(', '));
    }
    renderStaged();
    if (onChange) onChange();
  }

  function renderStaged() {
    if (stagedFiles.length === 0) {
      stagedContainerEl.innerHTML = '';
      if (inputEl) inputEl.placeholder = 'Add files or type a message...';
      return;
    }
    if (inputEl) inputEl.placeholder = 'Add a note (optional) and hit Send to process...';
    stagedContainerEl.innerHTML = stagedFiles.map((f, i) => `
      <div class="staged-file d-flex align-items-center gap-2 mb-1">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span class="small flex-grow-1 text-truncate">${f.name}</span>
        <button class="btn btn-sm btn-link text-danger p-0 remove-staged-file" data-idx="${i}" title="Remove">&times;</button>
      </div>
    `).join('');
    stagedContainerEl.querySelectorAll('.remove-staged-file').forEach(btn => {
      btn.addEventListener('click', () => {
        stagedFiles.splice(parseInt(btn.dataset.idx), 1);
        renderStaged();
        if (onChange) onChange();
      });
    });
  }

  return {
    getFiles: () => stagedFiles,
    clear: () => { stagedFiles = []; renderStaged(); }
  };
}

// ---- Shared: unified send (files + optional message, or message only) ----
async function unifiedSend(batchId, staging, inputEl, sendBtnEl, dropZoneEl, chatContainerId, confirmBtnEl) {
  const message = inputEl.value.trim();
  const files = staging.getFiles();

  if (files.length === 0 && !message) return null;
  if (files.length === 0 && !batchId) {
    appendChat(chatContainerId, 'system', 'Drop some files first to start a batch.');
    return null;
  }

  // Get or create batch ID
  let targetBatchId = batchId;
  if (!targetBatchId) {
    try {
      const resp = await fetch('/api/batch/new', { method: 'POST' });
      const result = await resp.json();
      targetBatchId = result.batchId;
    } catch (e) {
      appendChat(chatContainerId, 'system', 'Failed to create batch: ' + e.message);
      return null;
    }
  }

  // Build request body — always FormData
  const body = new FormData();
  for (const f of files) body.append('files', f, f.name);
  if (message) body.append('message', message);

  // Show in chat
  if (message) appendChat(chatContainerId, 'user', message);
  for (const f of files) appendChat(chatContainerId, 'system', '📎 ' + f.name);

  // Disable UI
  sendBtnEl.disabled = true;
  inputEl.disabled = true;
  inputEl.value = '';
  if (dropZoneEl) dropZoneEl.classList.add('disabled');
  if (confirmBtnEl) confirmBtnEl.disabled = true;
  staging.clear();
  showProcessingIndicator(chatContainerId);

  // Single API call
  try {
    const resp = await fetch(`/api/batch/${targetBatchId}/send`, { method: 'POST', body });
    const result = await resp.json();
    if (!resp.ok) {
      removeProcessingIndicator(chatContainerId);
      appendChat(chatContainerId, 'system', result.error || 'Request failed');
      sendBtnEl.disabled = false;
      inputEl.disabled = false;
      if (dropZoneEl) dropZoneEl.classList.remove('disabled');
      return null;
    }
    connectSSE(targetBatchId, chatContainerId, sendBtnEl, inputEl, dropZoneEl, confirmBtnEl);
  } catch (e) {
    removeProcessingIndicator(chatContainerId);
    appendChat(chatContainerId, 'system', 'Failed: ' + e.message);
    sendBtnEl.disabled = false;
    inputEl.disabled = false;
    if (dropZoneEl) dropZoneEl.classList.remove('disabled');
    return null;
  }

  return targetBatchId;
}

// ---- Shared: SSE connection ----
function connectSSE(batchId, chatContainerId, sendBtnEl, inputEl, dropZoneEl, confirmBtnEl) {
  const sse = new EventSource(`/api/batch/${batchId}/stream`);

  sse.addEventListener('processing', e => {
    showProcessingIndicator(chatContainerId);
    if (confirmBtnEl) confirmBtnEl.disabled = true;
  });

  sse.addEventListener('message', e => {
    const data = JSON.parse(e.data);
    if (data.role) {
      if (data.role === 'system' && /^(Processing|Running|Ingesting|Starting|Loading)/i.test(data.text.trim())) {
        updateProcessingIndicator(chatContainerId, data.text);
        return;
      }
      removeProcessingIndicator(chatContainerId);
      appendChat(chatContainerId, data.role, data.text);
    }
  });

  sse.addEventListener('done', e => {
    const data = JSON.parse(e.data);
    removeProcessingIndicator(chatContainerId);
    appendChat(chatContainerId, 'system', data.summary || 'Done.');
    if (sendBtnEl) sendBtnEl.disabled = false;
    if (inputEl) { inputEl.disabled = false; inputEl.placeholder = 'Add files or type a message...'; }
    if (dropZoneEl) dropZoneEl.classList.remove('disabled');
    if (confirmBtnEl) confirmBtnEl.disabled = false;
    loadBatches();
    sse.close();
  });

  sse.onerror = () => {
    sse.close();
    if (sendBtnEl) sendBtnEl.disabled = false;
    if (inputEl) inputEl.disabled = false;
    if (dropZoneEl) dropZoneEl.classList.remove('disabled');
    removeProcessingIndicator(chatContainerId);
  };
}

// ---- Shared: chat helpers ----
function appendChat(containerId, role, text) {
  const container = document.getElementById(containerId);
  if (!container) return;
  removeProcessingIndicator(containerId);
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble chat-${role}`;
  const icon = role === 'user' ? '👤' : role === 'assistant' ? '🤖' : 'ℹ️';
  const rendered = role === 'assistant' && typeof marked !== 'undefined'
    ? marked.parse(text)
    : escapeHtml(text);
  bubble.innerHTML = `<span class="chat-icon">${icon}</span><span class="chat-text">${rendered}</span>`;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function showProcessingIndicator(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  removeProcessingIndicator(containerId);
  const indicator = document.createElement('div');
  indicator.className = 'chat-bubble chat-system chat-processing';
  indicator.innerHTML = `<span class="chat-icon"><span class="spinner-border spinner-border-sm" role="status"></span></span><span class="chat-text">Processing...</span>`;
  container.appendChild(indicator);
  container.scrollTop = container.scrollHeight;
}

function removeProcessingIndicator(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const indicator = container.querySelector('.chat-processing');
  if (indicator) indicator.remove();
}

function updateProcessingIndicator(containerId, text) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let indicator = container.querySelector('.chat-processing');
  if (!indicator) {
    showProcessingIndicator(containerId);
    indicator = container.querySelector('.chat-processing');
  }
  if (indicator) {
    const span = indicator.querySelector('.chat-text');
    if (span) span.textContent = text;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showChatModal(batchId, messages) {
  // Remove any existing modal
  let modal = document.getElementById('chatModal');
  if (modal) modal.remove();
  let backdrop = document.querySelector('.modal-backdrop');
  if (backdrop) backdrop.remove();

  const modalEl = document.createElement('div');
  modalEl.innerHTML = `
    <div class="modal fade" id="chatModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h6 class="modal-title">${escapeHtml(batchId)}</h6>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="chat-messages" id="modalChat-${batchId}"></div>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modalEl.firstElementChild);

  // Reuse appendChat for consistent markdown rendering
  for (const msg of messages) appendChat(`modalChat-${batchId}`, msg.role, msg.text);

  const bsModal = new bootstrap.Modal(document.getElementById('chatModal'));
  bsModal.show();

  // Clean up on close
  document.getElementById('chatModal').addEventListener('hidden.bs.modal', () => {
    document.getElementById('chatModal').remove();
  });
}

// ---- New Batch Card ----
function renderNewBatchCard() {
  return `
    <div class="col">
      <div class="card h-100 border-primary" id="newBatchCard">
        <div class="card-header bg-primary text-white d-flex align-items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Batch
        </div>
        <div class="card-body d-flex flex-column">
          <div id="newChatMessages" class="chat-messages flex-grow-1 mb-2"></div>
          <div class="batch-input-bar">
            <div id="newDropZone" class="drop-zone mb-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted mb-2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <div class="small text-muted">Drop files here or click to browse</div>
              <input type="file" id="newFileInput" multiple class="d-none" accept=".txt,.csv,.md,.json,.html,.xml,.pdf,.xlsx,.docx,.pptx,.png,.jpg,.jpeg">
            </div>
            <div id="newStagedFiles"></div>
            <div class="input-group input-group-sm">
              <input type="text" id="newChatInput" class="form-control" placeholder="Add files or type a message...">
              <button id="newSendBtn" class="btn btn-outline-primary" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function wireNewBatchCard() {
  const dropZone = document.getElementById('newDropZone');
  const fileInput = document.getElementById('newFileInput');
  const stagedContainer = document.getElementById('newStagedFiles');
  const chatInput = document.getElementById('newChatInput');
  const sendBtn = document.getElementById('newSendBtn');
  if (!dropZone || !fileInput) return;

  const updateSendState = () => {
    sendBtn.disabled = staging.getFiles().length === 0 && !chatInput.value.trim();
  };

  const staging = createFileStagingUI(dropZone, fileInput, stagedContainer, chatInput, updateSendState);
  sendBtn.disabled = true;
  let activeBatchId = null;

  const doSend = async () => {
    const resultId = await unifiedSend(activeBatchId, staging, chatInput, sendBtn, dropZone, 'newChatMessages');
    if (resultId) activeBatchId = resultId;
  };

  sendBtn.addEventListener('click', doSend);
  chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !sendBtn.disabled) doSend(); });
  chatInput.addEventListener('input', updateSendState);
}

// ---- Existing Batch Card ----
function renderBatchCard(batch) {
  const isConfirmed = batch.status === 'confirmed';
  const statusBadge = isConfirmed
    ? '<span class="badge bg-success">Confirmed</span>'
    : batch.status === 'open-items'
      ? '<span class="badge bg-warning text-dark">Open Items</span>'
      : '<span class="badge bg-info">Ready</span>';

  const filesHtml = batch.files.map(f =>
    `<a href="/api/batch/${batch.id}/files/${encodeURIComponent(f)}" class="batch-file-link d-flex align-items-center gap-1 small" target="_blank" download>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      ${escapeHtml(f)}
    </a>`
  ).join('');

  const decisionsHtml = batch.decisions.length > 0
    ? `<div class="mt-2">
        <span class="badge bg-secondary decisions-pill" data-batch="${batch.id}" role="button" tabindex="0">
          ${batch.decisions.length} decision(s) resolved
        </span>
        <div class="decisions-popover d-none" id="decisions-${batch.id}">
          <div class="small">${batch.decisions.map(d => escapeHtml(d)).join('<hr>')}</div>
        </div>
      </div>`
    : '';

  const isActive = batch.status === 'ready' || batch.status === 'open-items';

  let activeHtml = '';
  if (isActive) {
    activeHtml = `
      <div class="batch-active-layout d-flex flex-column">
        <div class="chat-messages flex-grow-1 mb-2" id="batchChat-${batch.id}"></div>
        <div class="batch-input-bar">
          <div class="drop-zone drop-zone-sm mb-2" id="batchDropZone-${batch.id}">
            <div class="small text-muted">+ Drop more files</div>
            <input type="file" class="d-none batch-file-input" data-batch="${batch.id}" multiple accept=".txt,.csv,.md,.json,.html,.xml,.pdf,.xlsx,.docx,.pptx,.png,.jpg,.jpeg">
          </div>
          <div id="batchStaged-${batch.id}"></div>
          <div class="input-group input-group-sm">
            <input type="text" class="form-control batch-chat-input" data-batch="${batch.id}" placeholder="Add files or type a message...">
            <button class="btn btn-outline-primary batch-send-btn" data-batch="${batch.id}" type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
        <div class="batch-actions d-flex gap-2 mt-2">
            <button class="btn btn-success btn-sm batch-confirm-btn" data-batch="${batch.id}"${batch.status !== 'ready' || batch.processing ? ' disabled' : ''}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Confirm &amp; Merge
            </button>
            <button class="btn btn-outline-danger btn-sm batch-discard-btn" data-batch="${batch.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Discard
            </button>
          </div>
      </div>`;
  }

  // For confirmed batches with chat, show a pill that opens a modal
  let confirmedChatHtml = '';
  if (isConfirmed && batch.chatCount > 0) {
    confirmedChatHtml = `
      <div class="mt-2">
        <span class="badge bg-secondary chat-pill" data-batch="${batch.id}" role="button" tabindex="0">
          💬 ${batch.chatCount} message(s)
        </span>
      </div>`;
  }

  return `
    <div class="col">
      <div class="card h-100${isActive ? ' border-primary' : ''}">
        <div class="card-header d-flex align-items-center justify-content-between">
          <span class="small fw-medium">${batch.id}</span>
          ${statusBadge}
        </div>
        <div class="card-body">
          <div class="batch-files">${filesHtml}</div>
          ${decisionsHtml}
          ${activeHtml}
          ${confirmedChatHtml}
        </div>
      </div>
    </div>`;
}

function wireExistingBatchCard(batch) {
  // Wire decisions pill hover
  const pill = document.querySelector(`.decisions-pill[data-batch="${batch.id}"]`);
  if (pill) {
    const popover = document.getElementById(`decisions-${batch.id}`);
    pill.addEventListener('mouseenter', () => popover.classList.remove('d-none'));
    pill.addEventListener('mouseleave', () => popover.classList.add('d-none'));
    pill.addEventListener('focus', () => popover.classList.remove('d-none'));
    pill.addEventListener('blur', () => popover.classList.add('d-none'));
  }

  const isActive = batch.status === 'ready' || batch.status === 'open-items';
  const chatContainerId = `batchChat-${batch.id}`;

  // For confirmed batches: open chat in modal on pill click
  const chatPill = document.querySelector(`.chat-pill[data-batch="${batch.id}"]`);
  if (chatPill) {
    chatPill.addEventListener('click', async () => {
      chatPill.textContent = '💬 Loading...';
      try {
        const msgs = await fetch(`/api/batch/${batch.id}/chat`).then(r => r.json());
        showChatModal(batch.id, msgs);
      } catch (e) {
        alert('Failed to load chat');
      }
      chatPill.textContent = `💬 ${batch.chatCount} message(s)`;
    });
  }

  if (!isActive) return;

  // For active batches: populate chat immediately
  if (batch.chat && batch.chat.length > 0) {
    for (const msg of batch.chat) appendChat(chatContainerId, msg.role, msg.text);
  }

  // If batch is processing, show spinner and connect SSE
  const confirmBtn = document.querySelector(`.batch-confirm-btn[data-batch="${batch.id}"]`);
  if (batch.processing) {
    showProcessingIndicator(chatContainerId);
    if (confirmBtn) confirmBtn.disabled = true;
    connectSSE(batch.id, chatContainerId,
      document.querySelector(`.batch-send-btn[data-batch="${batch.id}"]`),
      document.querySelector(`.batch-chat-input[data-batch="${batch.id}"]`),
      document.getElementById(`batchDropZone-${batch.id}`),
      confirmBtn);
  }

  // Wire file staging + unified send (reusing shared helpers)
  const dropZone = document.getElementById(`batchDropZone-${batch.id}`);
  const fileInput = document.querySelector(`.batch-file-input[data-batch="${batch.id}"]`);
  const stagedContainer = document.getElementById(`batchStaged-${batch.id}`);
  const input = document.querySelector(`.batch-chat-input[data-batch="${batch.id}"]`);
  const sendBtn = document.querySelector(`.batch-send-btn[data-batch="${batch.id}"]`);

  const updateSendState = () => {
    if (sendBtn) sendBtn.disabled = staging.getFiles().length === 0 && !input.value.trim();
  };

  const staging = createFileStagingUI(dropZone, fileInput, stagedContainer, input, updateSendState);
  if (sendBtn) sendBtn.disabled = true;

  if (sendBtn && input) {
    const doSend = () => unifiedSend(batch.id, staging, input, sendBtn, dropZone, chatContainerId, confirmBtn);
    sendBtn.addEventListener('click', doSend);
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !sendBtn.disabled) doSend(); });
    input.addEventListener('input', updateSendState);
  }

  // Wire confirm (confirmBtn already queried above)
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      try {
        const resp = await fetch(`/api/batch/${batch.id}/confirm`, { method: 'POST' });
        if (!resp.ok) {
          const err = await resp.json();
          appendChat(chatContainerId, 'system', err.error || 'Confirm failed');
          confirmBtn.disabled = false;
          return;
        }
        appendChat(chatContainerId, 'system', 'Confirming and merging...');
        connectSSE(batch.id, chatContainerId, sendBtn, input, dropZone, confirmBtn);
      } catch (e) {
        appendChat(chatContainerId, 'system', 'Confirm failed: ' + e.message);
        confirmBtn.disabled = false;
      }
    });
  }

  // Wire discard
  const discardBtn = document.querySelector(`.batch-discard-btn[data-batch="${batch.id}"]`);
  if (discardBtn) {
    discardBtn.addEventListener('click', async () => {
      if (!confirm(`Discard batch ${batch.id}? This will delete the branch and all changes.`)) return;
      discardBtn.disabled = true;
      try {
        await fetch(`/api/batch/${batch.id}/discard`, { method: 'POST' });
        loadBatches();
      } catch (e) {
        discardBtn.disabled = false;
      }
    });
  }
}
