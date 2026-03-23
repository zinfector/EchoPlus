'use strict';

const STORAGE_KEY = 'echo360_queue_state';
const POLL_MS = 1000;

// ─── Auth section ─────────────────────────────────────────────────────────────

function renderAuth(sessions) {
  const list = document.getElementById('auth-list');
  if (!sessions || sessions.length === 0) {
    list.innerHTML = '<p class="muted">Not logged in to any Echo360 domain.</p>';
    return;
  }
  list.innerHTML = sessions.map(s => `
    <div class="auth-item">
      <div class="auth-dot ${s.authenticated ? 'ok' : 'no'}"></div>
      <span>${s.domain}</span>
    </div>
  `).join('');
}

// ─── Queue section ────────────────────────────────────────────────────────────

function renderQueue(state) {
  const activeList = document.getElementById('active-list');
  const emptyMsg = document.getElementById('empty-msg');
  const pendingSection = document.getElementById('pending-section');
  const pendingList = document.getElementById('pending-list');

  const active = state?.active || {};
  const pending = state?.pending || [];
  const activeEntries = Object.entries(active);

  if (activeEntries.length === 0) {
    emptyMsg.style.display = '';
    activeList.querySelectorAll('.dl-item').forEach(el => el.remove());
  } else {
    emptyMsg.style.display = 'none';
    // Sync active items
    const existingIds = new Set([...activeList.querySelectorAll('.dl-item')].map(el => el.dataset.lessonId));
    const currentIds = new Set(activeEntries.map(([id]) => id));

    // Remove stale items
    existingIds.forEach(id => {
      if (!currentIds.has(id)) activeList.querySelector(`[data-lesson-id="${id}"]`)?.remove();
    });

    // Add or update
    for (const [lessonId, info] of activeEntries) {
      let item = activeList.querySelector(`[data-lesson-id="${lessonId}"]`);
      if (!item) {
        item = document.createElement('div');
        item.className = 'dl-item';
        item.dataset.lessonId = lessonId;
        activeList.appendChild(item);
      }

      const pct = info.total > 0 ? Math.round((info.progress / info.total) * 100) : 0;
      const statusClass = info.status === 'complete' ? 'done' : info.status === 'error' ? 'error' : '';
      const statusText = info.status === 'complete' ? '✓ Done'
        : info.status === 'error' ? `✗ ${info.error || 'Error'}`
        : info.total > 0 ? `${pct}% · ${info.progress}/${info.total} segments`
        : info.status;

      item.innerHTML = `
        <div class="dl-header">
          <span class="dl-title" title="${escHtml(info.title || lessonId)}">${escHtml(info.title || lessonId)}</span>
          <span class="dl-date">${escHtml(info.date || '')}</span>
          <button class="dl-cancel" data-id="${lessonId}" title="Cancel">✕</button>
        </div>
        <div class="dl-bar"><div class="dl-fill" style="width:${pct}%"></div></div>
        <div class="dl-status ${statusClass}">${statusText}</div>
      `;

      item.querySelector('.dl-cancel').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'CANCEL_DOWNLOAD', payload: { lessonId } });
      });
    }
  }

  if (pending.length > 0) {
    pendingSection.style.display = '';
    pendingList.innerHTML = pending.map(p =>
      `<li title="${escHtml(p.title || p.lessonId)}">${escHtml(p.title || p.lessonId)}</li>`
    ).join('');
  } else {
    pendingSection.style.display = 'none';
  }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

document.getElementById('max-concurrent').addEventListener('change', (e) => {
  const max = parseInt(e.target.value);
  chrome.runtime.sendMessage({ type: 'SET_MAX_CONCURRENT', payload: { max } });
  chrome.storage.local.get(STORAGE_KEY, ({ echo360_queue_state: state }) => {
    if (state) {
      chrome.storage.local.set({ [STORAGE_KEY]: { ...state, maxConcurrent: max } });
    }
  });
});

// ─── Polling ──────────────────────────────────────────────────────────────────

function refresh() {
  // Auth state
  chrome.runtime.sendMessage({ type: 'GET_AUTH_SESSIONS' }, ({ sessions } = {}) => {
    if (chrome.runtime.lastError) return;
    renderAuth(sessions);
  });

  // Queue state
  chrome.storage.local.get(STORAGE_KEY, ({ echo360_queue_state: state }) => {
    renderQueue(state);
    // Sync max-concurrent setting
    if (state?.maxConcurrent) {
      document.getElementById('max-concurrent').value = state.maxConcurrent;
    }
  });
}

refresh();
setInterval(refresh, POLL_MS);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
