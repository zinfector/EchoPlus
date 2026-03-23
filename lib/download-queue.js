/**
 * download-queue.js — Parallel video download queue
 *
 * Manages up to MAX_CONCURRENT simultaneous video downloads.
 * State is persisted to chrome.storage.local so popup and content scripts can poll it.
 *
 * Key fix: Echo360 has no per-lesson JSON API.
 * All video metadata comes from GET /section/{uuid}/syllabus (the syllabus endpoint).
 * The syllabus returns { data: [...] } where each item already contains the full
 * video media JSON (primaryFiles, manifests, etc.) needed for URL resolution.
 * This mirrors exactly what EchoCloudCourse._get_course_data() does in course.py.
 */

import { EchoApiClient } from './api-client.js';
import { resolveVideoUrl } from './video-resolver.js';
import { parseMasterPlaylist, fetchSegmentUrls } from './m3u8-parser.js';
import { formatFilename, parseDateFromLesson, sanitizeFilename } from './utils.js';

const STORAGE_KEY = 'echo360_queue_state';

// In-memory syllabus cache: sectionId → { data, fetchedAt }
// Avoids redundant API calls when bulk-downloading from the same course
const syllabusCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class DownloadQueue {
  constructor(maxConcurrent = 3) {
    this.max = maxConcurrent;
    this.active = new Map();   // lessonId → { status, progress, total, filename, title, date }
    this.pending = [];          // [{ lessonId, title, date, sectionId, hostname, startTime }]
    this.abortControllers = new Map(); // lessonId → AbortController
  }

  /**
   * Add lessons to the download queue and start downloading up to max slots.
   * @param {Array<{lessonId, title, date, sectionId, hostname, startTime?}>} lessons
   */
  enqueue(lessons) {
    const activeIds = new Set([...this.active.keys(), ...this.pending.map(l => l.lessonId)]);
    for (const lesson of lessons) {
      if (!activeIds.has(lesson.lessonId)) {
        this.pending.push(lesson);
      }
    }
    this.flush();
    this.persistState();
  }

  cancel(lessonId) {
    const ctrl = this.abortControllers.get(lessonId);
    if (ctrl) {
      ctrl.abort();
      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_CANCEL',
        payload: { lessonId }
      });
    }
    this.pending = this.pending.filter(l => l.lessonId !== lessonId);
    this.persistState();
  }

  setMaxConcurrent(n) {
    this.max = Math.max(1, Math.min(10, n));
    this.flush();
    this.persistState();
  }

  flush() {
    while (this.active.size < this.max && this.pending.length > 0) {
      const lesson = this.pending.shift();
      this._startDownload(lesson);
    }
  }

  async _startDownload(lesson) {
    const { lessonId, title, date, sectionId, hostname, startTime, tabId } = lesson;
    const ctrl = new AbortController();
    this.abortControllers.set(lessonId, ctrl);
    this.active.set(lessonId, { status: 'resolving', progress: 0, total: 0, title, date });
    this.persistState();

    try {
      const client = new EchoApiClient(hostname);

      // ── Step 1: Fetch the section syllabus (cached) ──────────────────────
      // Mirrors EchoCloudCourse._get_course_data() in course.py:195-217
      // GET /section/{sectionId}/syllabus → { data: [...lesson objects...] }
      this._setStatus(lessonId, 'fetching syllabus');
      const syllabus = await fetchCachedSyllabus(client, sectionId);

      // ── Step 2: Find this lesson in the syllabus data ────────────────────
      // lessonId == the full data-test-lessonid value == lesson.lesson.id in the syllabus
      const lessonData = findLessonInSyllabus(syllabus, lessonId);
      if (!lessonData) {
        throw new Error(`Lesson not found in section syllabus (id: ${lessonId.slice(0, 40)}...)`);
      }

      // ── Step 3: Get the media ID for streaming URL resolution ─────────────
      // Current Echo360 API: streaming URLs are not in the syllabus directly.
      // They are fetched using the media ID from lesson.medias[0].id.
      const mediaId = extractMediaId(lessonData);
      if (!mediaId) {
        throw new Error(`No available media found for lesson ${lessonId.slice(0, 40)}`);
      }
      console.log(`[Echo360] mediaId for download: ${mediaId}`);

      // ── Step 4: Build filename ───────────────────────────────────────────
      const lessonDate = date || parseDateFromLesson(lessonData);
      const courseTitle = lesson.courseName || lessonData?.lesson?.lesson?.name || sectionId.slice(0, 8);
      
      console.log(`[Echo360 Naming Debug] Raw values -> courseTitle: "${courseTitle}", lessonDate: "${lessonDate}"`);
      
      const baseFilename = sanitizeFilename(`${courseTitle} (${lessonDate})`);
      console.log(`[Echo360 Naming Debug] Sanitized baseFilename: "${baseFilename}"`);

      // ── Step 5: Resolve video URL ─────────────────────────────────────────
      // In the current API, streaming URLs are obtained by:
      //   1. Fetching the media player API with mediaId
      //   2. Falling back to regex-scanning the classroom page HTML
      this._setStatus(lessonId, 'resolving URL');
      const resolved = await resolveVideoUrl(lessonData, hostname, mediaId);

      // ── Step 6: Download ──────────────────────────────────────────────────
      if (resolved.type === 'mp4') {
        for (let i = 0; i < resolved.urls.length; i++) {
          const viewFilename = resolved.urls.length > 1 ? `${baseFilename} Recording ${i+1}.mp4` : `${baseFilename} Recording 1.mp4`;
          console.log(`[Echo360 Naming Debug] Dispatching _downloadMP4 with viewFilename: "${viewFilename}"`);
          await this._downloadMP4(lessonId, resolved.urls[i], viewFilename, ctrl.signal);
        }
      } else {
        for (let i = 0; i < resolved.urls.length; i++) {
          const viewFilename = resolved.urls.length > 1 ? `${baseFilename} Recording ${i+1}.mp4` : `${baseFilename} Recording 1.mp4`;
          console.log(`[Echo360 Naming Debug] Dispatching _downloadHLS with viewFilename: "${viewFilename}"`);
          await this._downloadHLS(lessonId, resolved.urls[i], viewFilename, ctrl.signal, tabId);
        }
      }

      this._setStatus(lessonId, 'complete');
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log(`[Echo360] Download cancelled: ${lessonId}`);
      } else {
        console.error(`[Echo360] Download failed for ${lessonId}:`, err);
        if (this.active.has(lessonId)) {
          this.active.get(lessonId).status = 'error';
          this.active.get(lessonId).error = err.message;
        }
      }
      this.persistState();
    } finally {
      setTimeout(() => {
        this.active.delete(lessonId);
        this.abortControllers.delete(lessonId);
        this.flush();
        this.persistState();
      }, 4000);
    }
  }

  async _downloadHLS(lessonId, m3u8Url, filename, signal, tabId) {
    this._setStatus(lessonId, 'parsing playlist');

    // Parse master playlist to get video and audio stream URLs
    let videoM3u8Url, audioM3u8Url;
    try {
      ({ videoM3u8Url, audioM3u8Url } = await parseMasterPlaylist(m3u8Url));
    } catch (e) {
      console.log('[Echo360] Not a master playlist, using URL directly:', e.message);
      videoM3u8Url = m3u8Url;
      audioM3u8Url = null;
    }

    // Fallback: Echo360 names audio 's0_a.m3u8' when not declared in master playlist
    if (!audioM3u8Url && m3u8Url.includes('s2_av.m3u8')) {
      audioM3u8Url = m3u8Url.replace('s2_av.m3u8', 's0_a.m3u8');
      console.log('[Echo360] Guessing audio URL:', audioM3u8Url);
    }

    // Fetch the video media playlist as raw text
    const playlistRes = await fetch(videoM3u8Url, { credentials: 'include' });
    if (!playlistRes.ok) throw new Error(`Media playlist fetch failed: ${playlistRes.status}`);
    const playlistText = await playlistRes.text();

    // ── fMP4 path: deduplicate .mp4 file references (mirrors downloadEchoAV) ──
    // Echo360 uses fMP4 where the same s2q0.mp4 appears hundreds of times with
    // #EXT-X-BYTERANGE offsets. Deduplicate and download each unique file once.
    const mp4Matches = playlistText.match(/([a-zA-Z0-9_\-]+\.mp4)/g);
    if (mp4Matches) {
      const uniqueFiles = [...new Set(mp4Matches.map(m => m.replace(/['"]/g, '')))];
      const resolveUrl = (rel) => {
        const abs = new URL(rel, videoM3u8Url).href;
        return abs.includes('?') ? abs : abs + new URL(videoM3u8Url).search;
      };
      const mp4Urls = uniqueFiles.map(resolveUrl);
      console.log(`[Echo360] fMP4 playlist: ${mp4Urls.length} unique file(s) from ${mp4Matches.length} entries`);

      // Resolve audio fMP4 URLs using the same deduplication logic
      let audioMp4Urls = [];
      if (audioM3u8Url) {
        try {
          const audioRes = await fetch(audioM3u8Url, { credentials: 'include' });
          if (audioRes.ok) {
            const audioText = await audioRes.text();
            const audioMatches = audioText.match(/([a-zA-Z0-9_\-]+\.mp4)/g);
            if (audioMatches) {
              const uniqueAudio = [...new Set(audioMatches.map(m => m.replace(/['"]/g, '')))];
              const resolveAudio = (rel) => {
                const abs = new URL(rel, audioM3u8Url).href;
                return abs.includes('?') ? abs : abs + new URL(audioM3u8Url).search;
              };
              audioMp4Urls = uniqueAudio.map(resolveAudio);
              console.log(`[Echo360] Audio fMP4: ${audioMp4Urls.length} unique file(s)`);
            }
          }
        } catch (e) {
          console.log('[Echo360] Audio playlist fetch failed:', e.message);
        }
      }

      this.active.get(lessonId).total = audioMp4Urls.length > 0 ? 300 : 200;
      this.active.get(lessonId).progress = 0;
      this._setStatus(lessonId, `downloading ${filename}`);

      await new Promise((resolve, reject) => {
        _pendingHLS.set(lessonId, { resolve, reject });
        chrome.runtime.sendMessage({
          type: 'OFFSCREEN_JOB',
          payload: {
            lessonId,
            job: {
              type: 'ffmpeg',
              mp4Urls,
              audioMp4Urls,
              filename
            }
          }
        });
      });
      return;
    }

    // ── Fallback: standard .ts segment path ──────────────────────────────────
    const segmentUrls = await fetchSegmentUrls(videoM3u8Url);
    this.active.get(lessonId).total = segmentUrls.length;
    this._setStatus(lessonId, `downloading ${filename}`);

    await new Promise((resolve, reject) => {
      _pendingHLS.set(lessonId, { resolve, reject });
      const safeFilename = filename.endsWith('.ts') ? filename : filename + '.ts';
      chrome.tabs.sendMessage(tabId, {
        type: 'DOWNLOAD_SEGMENTS',
        payload: { lessonId, segmentUrls, filename: safeFilename },
      }, (response) => {
        if (chrome.runtime.lastError) {
          _pendingHLS.delete(lessonId);
          reject(new Error('Content script not reachable: ' + chrome.runtime.lastError.message));
        }
      });
    });
  }

  async _downloadMP4(lessonId, mp4Url, filename, signal) {
    this._setStatus(lessonId, `downloading ${filename}`);
    
    const safeFilename = filename.endsWith('.mp4') ? filename : filename + '.mp4';
    console.log(`[Echo360 Naming Debug] _downloadMP4 attempting to save as: "${safeFilename}"`);
    
    await new Promise((resolve, reject) => {
      chrome.downloads.download(
        { url: mp4Url, filename: safeFilename, saveAs: false },
        (downloadId) => {
          if (chrome.runtime.lastError) {
             console.error(`[Echo360 Naming Debug] Chrome rejected MP4 filename "${safeFilename}":`, chrome.runtime.lastError.message);
             // Try a completely safe fallback name to verify if filename was the issue
             chrome.downloads.download({ url: mp4Url, filename: `echo360_fallback_${Date.now()}.mp4`, saveAs: false }, (fallbackId) => {
                 if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                 else resolve(fallbackId);
             });
          } else {
             resolve(downloadId);
          }
        }
      );
    });
  }

  _setStatus(lessonId, status) {
    if (this.active.has(lessonId)) {
      this.active.get(lessonId).status = status;
      this.persistState();
    }
  }

  updateProgress(lessonId, completed, total) {
    if (this.active.has(lessonId)) {
      const entry = this.active.get(lessonId);
      entry.progress = completed;
      entry.total = total;
      // Preserve "downloading View X" status if it exists
      if (!entry.status.startsWith('downloading')) {
          entry.status = 'downloading';
      }
    }
    this.persistState();
  }

  persistState() {
    const state = {
      active: Object.fromEntries(this.active),
      pending: this.pending.map(({ lessonId, title, date }) => ({ lessonId, title, date })),
      maxConcurrent: this.max,
      updatedAt: Date.now(),
    };
    chrome.storage.local.set({ [STORAGE_KEY]: state });
  }
}

export async function startStream(lesson) {
  const { lessonId, sectionId, hostname } = lesson;
  try {
    const client = new EchoApiClient(hostname);
    const syllabus = await fetchCachedSyllabus(client, sectionId);
    const lessonData = findLessonInSyllabus(syllabus, lessonId);
    if (!lessonData) throw new Error(`Lesson not found in section syllabus`);
    
    const mediaId = extractMediaId(lessonData);
    if (!mediaId) throw new Error(`No available media found for lesson`);
    
    const resolved = await resolveVideoUrl(lessonData, hostname, mediaId);
    if (resolved && resolved.urls && resolved.urls.length > 0) {
      const streamUrl = chrome.runtime.getURL('stream/stream.html') + '?urls=' + encodeURIComponent(JSON.stringify(resolved.urls));
      chrome.tabs.create({ url: streamUrl });
    } else {
      throw new Error("Could not resolve streaming URL");
    }
  } catch (e) {
    console.error('[Echo360] Stream start failed:', e);
    // You could optionally send a message back to the UI here if needed
  }
}

// ─── Syllabus Cache ───────────────────────────────────────────────────────────

async function fetchCachedSyllabus(client, sectionId) {
  const cached = syllabusCache.get(sectionId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }
  const data = await client.fetchSyllabus(sectionId);
  syllabusCache.set(sectionId, { data, fetchedAt: Date.now() });
  return data;
}

// ─── Lesson Lookup ────────────────────────────────────────────────────────────

/**
 * Find a lesson in syllabus data by its full lesson ID.
 *
 * The data-test-lessonid attribute value == lesson.lesson.id in the syllabus exactly.
 * Format: G_{scheduleUUID}_{sectionUUID}_{startISO}_{endISO}
 *
 * @param {object} syllabus - { data: [...] }
 * @param {string} lessonId - full data-test-lessonid value (== lesson.lesson.id)
 * @returns {object|null}
 */
function findLessonInSyllabus(syllabus, lessonId) {
  const items = syllabus?.data || [];

  for (const item of items) {
    if (item.lessons) {
      // Multi-part group: check container and sub-lessons
      if (item.lesson?.lesson?.id === lessonId) return item.lessons[0] || null;
      for (const sub of item.lessons) {
        if (sub?.lesson?.lesson?.id === lessonId) return sub;
      }
    } else {
      if (item?.lesson?.lesson?.id === lessonId) return item;
    }
  }

  console.warn('[Echo360] findLessonInSyllabus: lesson not found:', lessonId);
  console.warn('[Echo360] First item lesson.lesson.id:', items[0]?.lesson?.lesson?.id);
  return null;
}

/**
 * Extract the media ID from a syllabus lesson item.
 * In the current Echo360 API, streaming URLs are fetched separately using this ID.
 * @param {object} lessonItem - syllabus data[] item
 * @returns {string|null}
 */
export function extractMediaId(lessonItem) {
  const medias = lessonItem?.lesson?.medias;
  if (Array.isArray(medias) && medias.length > 0) {
    // Prefer the first available video
    const video = medias.find(m => m.mediaType === 'Video' && m.isAvailable) || medias[0];
    return video?.id || null;
  }
  return null;
}

// ─── Offscreen Document Helpers ───────────────────────────────────────────────

// Pending HLS download completions: lessonId → { resolve, reject }
// Resolved by resolveHLSDownload() when service-worker receives ASSEMBLY_DONE.
const _pendingHLS = new Map();
export function resolveHLSDownload(lessonId, result) {
  const pending = _pendingHLS.get(lessonId);
  if (pending) {
    _pendingHLS.delete(lessonId);
    if (result.error) pending.reject(new Error(result.error));
    else pending.resolve(result);
  }
}


