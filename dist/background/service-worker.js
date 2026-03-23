/**
 * service-worker.js — Central event router and orchestrator
 *
 * Responsibilities:
 *  - Detect authentication state via ECHO_JWT cookie
 *  - Manage the parallel download queue
 *  - Passively capture M3U8 URLs via webRequest listener
 *  - Route messages between popup, content scripts, and offscreen document
 */

import { DownloadQueue, resolveHLSDownload, startStream } from '../lib/download-queue.js';

// Global queue instance (lives as long as the service worker is alive)
const queue = new DownloadQueue(3);

// ─── Cookie-based Authentication ────────────────────────────────────────────

/**
 * Check whether ECHO_JWT exists for the given hostname.
 * Cookie store persists across browser restarts — no manual restore needed.
 * @param {string} hostname - e.g. "https://echo360.org"
 * @returns {Promise<boolean>}
 */
async function isAuthenticated(hostname) {
  try {
    const domain = new URL(hostname).hostname;
    const cookies = await chrome.cookies.getAll({ domain });
    return cookies.some(c => c.name === 'ECHO_JWT');
  } catch {
    return false;
  }
}

/**
 * Get all known authenticated Echo360 sessions from the cookie store.
 * @returns {Promise<Array<{hostname, domain, authenticated}>>}
 */
async function getAuthSessions() {
  const domains = [
    'echo360.org', 'echo360.net',
    'echo360.org.au', 'echo360.net.au',
    'echo360.ca', 'echo360.org.uk',
  ];
  const sessions = [];
  for (const domain of domains) {
    const cookies = await chrome.cookies.getAll({ domain });
    const hasJwt = cookies.some(c => c.name === 'ECHO_JWT');
    if (hasJwt) {
      sessions.push({ hostname: `https://${domain}`, domain, authenticated: true });
    }
  }
  return sessions;
}

// React to login events — update storage when user logs in
chrome.cookies.onChanged.addListener(({ cookie, removed }) => {
  if (cookie.name === 'ECHO_JWT' && !removed) {
    const hostname = `https://${cookie.domain.replace(/^\./, '')}`;
    chrome.storage.local.set({
      [`auth_${cookie.domain}`]: { authenticated: true, hostname, timestamp: Date.now() },
    });
    console.log(`[Echo360] Authenticated on ${hostname}`);
  }
});

// ─── Passive M3U8 URL Capture ────────────────────────────────────────────────

// Intercept M3U8 requests made by the Echo360 video player
// Stores them in chrome.storage.local keyed by a path-based ID
// This is the most reliable URL source (passive, no regex needed)
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (!details.url.match(/\.m3u8(\?|$)/i)) return;
    // Try to extract a lesson/section identifier from the URL path
    const pathMatch = details.url.match(/\/([a-f0-9-]{36})\//i);
    if (pathMatch) {
      const key = `m3u8_${pathMatch[1]}`;
      chrome.storage.local.set({ [key]: details.url });
      console.debug(`[Echo360] Captured M3U8: ${details.url}`);
    }
  },
  {
    urls: [
      'https://content.echo360.org/*',
      'https://content.echo360.net/*',
      'https://*.amazonaws.com/*',
    ],
  }
);

// ─── Message Routing ─────────────────────────────────────────────────────────

let creatingOffscreen = null;
async function setupOffscreenDocument(path) {
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    return;
  }

  if (creatingOffscreen) {
    await creatingOffscreen;
  } else {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: path,
      reasons: ['WORKERS'], // or DOM_PARSER if processing HTML, but workers fits the WASM/Blob profile
      justification: 'FFmpeg Muxing of Audio and Video',
    });
    await creatingOffscreen;
    creatingOffscreen = null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  switch (type) {
    // ── From content script / popup ──
    case 'START_STREAM': {
      const { lesson, hostname } = payload;
      const enriched = { ...lesson, hostname: lesson.hostname || hostname };
      startStream(enriched);
      sendResponse({ ok: true });
      return true;
    }

    case 'START_DOWNLOADS': {
      setupOffscreenDocument('offscreen/offscreen.html').then(() => {
        const { lessons, hostname } = payload;
        const tabId = sender.tab?.id;
        const enriched = lessons.map(l => ({ ...l, hostname: l.hostname || hostname, tabId }));
        queue.enqueue(enriched);
        queue.persistState();
        sendResponse({ ok: true, queued: enriched.length });
      });
      return true;
    }

    case 'CANCEL_DOWNLOAD': {
      queue.cancel(payload.lessonId);
      sendResponse({ ok: true });
      break;
    }

    case 'SET_MAX_CONCURRENT': {
      queue.setMaxConcurrent(payload.max);
      sendResponse({ ok: true });
      break;
    }

    case 'GET_AUTH_SESSIONS': {
      getAuthSessions().then(sessions => sendResponse({ sessions }));
      return true; // async
    }

    case 'CHECK_AUTH': {
      isAuthenticated(payload.hostname).then(ok => sendResponse({ authenticated: ok }));
      return true; // async
    }

    case 'GET_QUEUE_STATE': {
      chrome.storage.local.get('echo360_queue_state', (result) => {
        sendResponse({ state: result.echo360_queue_state || null });
      });
      return true; // async
    }

    // ── From content script ──
    case 'START_FFMPEG_MUX': {
      const { lessonId, videoBlobUrl, audioBlobUrl, filename } = payload;
      chrome.storage.local.set({
        [`ffmpeg_job_${lessonId}`]: {
          status: 'pending',
          videoBlobUrl,
          audioBlobUrl,
          filename
        }
      });
      sendResponse({ ok: true });
      break;
    }

    case 'FFMPEG_DONE': {
      const { lessonId, blobUrl, filename } = payload;
      console.log(`[Background] FFMPEG_DONE received. Raw filename:`, filename);
      
      const entry = queue.active.get(lessonId);
      if (entry) {
        queue.updateProgress(lessonId, entry.total, entry.total);
        entry.status = 'complete';
        queue.persistState();
      }

      // The actual file download is now handled directly inside offscreen.js 
      // via a hidden anchor tag to prevent Chrome from stripping the filename 
      // and assigning a UUID hash to blob:// URLs.
      console.log(`[Background] Muxing finished. Download was triggered in offscreen DOM.`);
      resolveHLSDownload(lessonId, { ok: true });
      sendResponse({ ok: true });
      break;
    }

    case 'ASSEMBLY_DONE': {
      const { lessonId, blobUrl, filename } = payload;
      console.log(`[Background] ASSEMBLY_DONE received. Raw filename:`, filename);
      
      const safeFilename = (filename && typeof filename === 'string') 
        ? (filename.endsWith('.mp4') || filename.endsWith('.ts') ? filename : filename + '.mp4') 
        : `fallback_${lessonId}.mp4`;
        
      console.log(`[Background] Attempting to save assembled file as:`, safeFilename);

      chrome.downloads.download({ url: blobUrl, filename: safeFilename, saveAs: false }, (downloadId) => {
        if (chrome.runtime.lastError) {
            console.error(`[Background] Chrome Download Error for assembled filename "${safeFilename}":`, chrome.runtime.lastError.message);
            chrome.downloads.download({ url: blobUrl, filename: `echo360_assembled_${Date.now()}.mp4`, saveAs: false }, () => {
                resolveHLSDownload(lessonId, { ok: true });
            });
        } else {
            console.log(`[Background] Download started successfully with ID: ${downloadId}`);
            resolveHLSDownload(lessonId, { ok: true });
        }
      });
      sendResponse({ ok: true });
      break;
    }

    case 'DOWNLOAD_PROGRESS': {
      const { lessonId, completed, total } = payload;
      console.log(`[Echo360] Progress update: ${completed}/${total} for ${lessonId}`);
      if (completed !== null && completed !== undefined && !isNaN(completed) && !isNaN(total)) {
        queue.updateProgress(lessonId, completed, total);
      }
      sendResponse({ ok: true });
      break;
    }

    case 'DOWNLOAD_COMPLETE': {
      const { lessonId } = payload;
      resolveHLSDownload(lessonId, { ok: true });
      sendResponse({ ok: true });
      break;
    }

    case 'DOWNLOAD_ERROR': {
      const { lessonId, error } = payload;
      if (queue.active.has(lessonId)) {
        queue.active.get(lessonId).status = 'error';
        queue.active.get(lessonId).error = error;
        queue.persistState();
      }
      sendResponse({ ok: true });
      break;
    }
	
	case 'FFMPEG_LOG':
      console.log(`%c[FFmpeg Worker] ${payload.message}`, 'color: #cc00ff');
      sendResponse({ ok: true });
      break;

    case 'FFMPEG_PROGRESS':
      // Optional: don't log every single tick to avoid spam, or log only at 10% increments
      if (Math.random() < 0.05) { 
        console.log(`[FFmpeg Progress] ${(payload.progress * 100).toFixed(1)}%`);
      }
      sendResponse({ ok: true });
      break;

    default:
      sendResponse({ error: `Unknown message type: ${type}` });
  }
});

// ─── On Install ──────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Echo360] Extension installed/updated');
  chrome.storage.local.set({ echo360_queue_state: { active: {}, pending: [], maxConcurrent: 3 } });
});
