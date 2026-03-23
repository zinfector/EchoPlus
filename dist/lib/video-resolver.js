/**
 * video-resolver.js — Video streaming URL resolution
 *
 * The current Echo360 Cloud API (as of 2025-2026) no longer embeds streaming URLs
 * in the syllabus response. Instead they must be fetched via a media player API
 * or scraped from the classroom page HTML.
 *
 * Resolution order:
 *   0. Media player API  — GET /api/ui/echoplayer/lessons/{lessonId}/medias/{mediaId}/...
 *   1. Classroom page regex for .mp4   (brute-force, always works when authenticated)
 *   2. Classroom page regex for .m3u8  (brute-force fallback)
 *   Passive bonus: webRequest-captured M3U8 (checked before page-source methods)
 *
 * Legacy methods from echo360/videos.py:
 *   from_json_mp4 / from_json_m3u8 are kept as inner helpers for old API responses
 *   that still embed media data in the syllabus (some institutions/older deployments).
 */

/**
 * @typedef {Object} VideoUrls
 * @property {'mp4'|'m3u8'} type
 * @property {string[]} urls - ordered list (first = preferred)
 */

/**
 * Resolve video download URL(s) for a lesson.
 * @param {object} lessonData - syllabus item (lesson.medias[], lesson.lesson, etc.)
 * @param {string} hostname   - e.g. "https://echo360.org"
 * @param {string} mediaId    - lesson.medias[0].id from the syllabus item
 * @returns {Promise<VideoUrls>}
 */
export async function resolveVideoUrl(lessonData, hostname, mediaId) {
  const lessonId = lessonData?.lesson?.lesson?.id; // full G_... compound ID

  // ── Legacy Method 1: Direct MP4 from syllabus JSON (older API) ───────────
  // Mirrors from_json_mp4() in echo360/videos.py:492-500
  // Only present in older Echo360 deployments that embed full media data in syllabus
  try {
    const mp4Url = fromJsonMp4(lessonData);
    if (mp4Url) {
      console.log('[Echo360] Resolved via legacy JSON MP4');
      return { type: 'mp4', urls: [mp4Url] };
    }
  } catch { /* not available in current API */ }

  // ── Legacy Method 2: M3U8 from syllabus JSON (older API) ─────────────────
  // Mirrors from_json_m3u8() in echo360/videos.py:460-490
  try {
    const m3u8Urls = fromJsonM3u8(lessonData, hostname);
    if (m3u8Urls?.length > 0) {
      console.log('[Echo360] Resolved via legacy JSON M3U8');
      return { type: 'm3u8', urls: m3u8Urls };
    }
  } catch { /* not available in current API */ }

  // ── Method 1: Classroom HTML extraction ──────────────────────────────────
  // Fetch /lesson/{lessonId}/classroom, extract embedded player JSON, build signed URL.
  // Mirrors the approach in workingImplementation.js — reliable and fast.
  try {
    const result = await fromClassroomHtml(lessonData, hostname);
    if (result) return result;
  } catch (e) {
    console.log('[Echo360] Classroom HTML extraction failed:', e.message);
  }

  // ── Passive bonus: webRequest-captured M3U8 (already seen this lecture) ───
  try {
    const captured = await getCapturedM3u8(mediaId);
    if (captured) {
      console.log('[Echo360] Resolved via passive webRequest capture');
      return { type: 'm3u8', urls: [captured] };
    }
  } catch { /* miss */ }

  throw new Error(`All URL resolution methods failed for media ${mediaId}. Is the user logged in and does the lecture have a recording?`);
}

// ─── Media Player API (current Echo360 API) ───────────────────────────────────

/**
 * Try known Echo360 media player API endpoints.
 * Returns VideoUrls if successful, null if the endpoint doesn't exist or has no data.
 */
async function fetchMediaPlayerApi(hostname, mediaId) {
  // Known endpoints to try (discovered via network inspection)
  const candidates = [
    `${hostname}/api/ui/echoplayer/medias/${mediaId}/stream`,
    `${hostname}/api/ui/echoplayer/medias/${mediaId}`,
    `${hostname}/media/${mediaId}/stream`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      console.log(`[Echo360] Player API ${url} → ${res.status} ${res.headers.get('content-type')}`);
      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('json')) continue;
      const data = await res.json();
      console.log('[Echo360] Player API response keys:', Object.keys(data));

      // Try to extract streaming URLs from the response
      const mp4Url = extractMp4FromPlayerApi(data);
      if (mp4Url) return { type: 'mp4', urls: [mp4Url] };

      const m3u8Urls = extractM3u8FromPlayerApi(data, hostname);
      if (m3u8Urls?.length > 0) return { type: 'm3u8', urls: m3u8Urls };
    } catch (e) { console.log(`[Echo360] Player API candidate error (${url}):`, e.message); }
  }
  return null;
}

function extractMp4FromPlayerApi(data) {
  // Try common response shapes for MP4 URLs
  return data?.primaryFiles?.[0]?.s3Url
      || data?.media?.current?.primaryFiles?.[0]?.s3Url
      || data?.stream?.url
      || null;
}

function extractM3u8FromPlayerApi(data, hostname) {
  const manifests = data?.manifests
    || data?.media?.versions?.[0]?.manifests
    || data?.versions?.[0]?.manifests;
  if (!manifests?.length) return null;

  const echoHostname = new URL(hostname).hostname;
  return manifests.map(m => {
    if (m.uri.startsWith('http')) {
      // It might already be pointing to content.echo360.org
      return m.uri;
    }
    // Handle relative URI
    const u = new URL(m.uri, hostname);
    return `https://content.${echoHostname}${u.pathname}${u.search}`;
  });
}

// ─── Legacy Methods (older Echo360 API where syllabus contained full media data) ─

function fromJsonMp4(lessonData) {
  const primaryFiles = lessonData?.lesson?.video?.media?.media?.current?.primaryFiles;
  if (!primaryFiles?.length) throw new Error('No primaryFiles in syllabus');
  const urls = primaryFiles.map(f => f.s3Url).filter(Boolean);
  if (!urls.length) throw new Error('No s3Url found');
  return urls[urls.length - 1];
}

function fromJsonM3u8(lessonData, hostname) {
  if (!lessonData?.lesson?.hasVideo || !lessonData?.lesson?.hasAvailableVideo) {
    throw new Error('No available video in lesson');
  }
  const manifests = lessonData?.lesson?.video?.media?.media?.versions?.[0]?.manifests;
  if (!manifests?.length) throw new Error('No manifests in syllabus');
  const echoHostname = new URL(hostname).hostname;
  return manifests.map(m => {
    if (m.uri.startsWith('http')) return m.uri;
    const u = new URL(m.uri, hostname);
    return `https://content.${echoHostname}${u.pathname}${u.search}`;
  });
}

// ─── Classroom HTML Extraction (from workingImplementation.js) ────────────────

/**
 * Extract and parse the embedded player JSON from classroom HTML.
 * The page embeds data as: Echo["echoPlayerV2FullApp"]("...escaped JSON...");
 */
function extractAndParse(html) {
  const regex = /Echo\["echoPlayerV2FullApp"\]\(([\s\S]*?)"\);/;
  const match = html.match(regex);
  if (!match || !match[1]) return null;
  const cleaned = match[1].replace(/\\/g, '').replace(/^"|"$/g, '');
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn('[Echo360] extractAndParse JSON error:', e.message);
    return null;
  }
}

/**
 * Build the signed content URL from embedded player JSON.
 * Mirrors makeEchoUrl() from workingImplementation.js.
 */
function makeEchoUrl(data, version = '1', qualityFile = 's2_av.m3u8') {
  const params = new URLSearchParams();
  params.append('x-uid',    data.user.id);
  params.append('x-instid', data.lesson.institutionId);
  params.append('x-oid',    data.context.organizationId);
  params.append('x-did',    data.context.departmentId);
  params.append('x-lid',    data.lesson.id);
  params.append('x-sid',    data.context.sectionId);
  params.append('x-mid',    data.video.mediaId);
  params.append('x-act',    'videoView');
  params.append('x-src',    'desktop');
  const { institutionId } = data.lesson;
  const { mediaId } = data.video;
  return `https://content.echo360.org/0000.${institutionId}/${mediaId}/${version}/${qualityFile}?${params.toString()}`;
}

/**
 * Fetch the classroom HTML and extract a signed M3U8 URL directly.
 * This is the primary method used by workingImplementation.js — reliable and fast.
 *
 * @param {object} lessonData - syllabus item
 * @param {string} hostname   - e.g. "https://echo360.org"
 * @returns {Promise<VideoUrls|null>}
 */
async function fromClassroomHtml(lessonData, hostname) {
  const lessonId = lessonData?.lesson?.lesson?.id;
  if (!lessonId) return null;
  const classroomUrl = `${hostname}/lesson/${encodeURIComponent(lessonId)}/classroom`;
  console.log('[Echo360] Fetching classroom HTML:', classroomUrl);
  const res = await fetch(classroomUrl, { credentials: 'include' });
  if (!res.ok) throw new Error(`Classroom HTML fetch failed: ${res.status}`);
  const html = await res.text();
  const videoPageData = extractAndParse(html);
  if (!videoPageData) throw new Error('Could not extract player JSON from classroom HTML');
  
  // Try extracting all views from the embedded JSON
  let urls = [];
  const m3u8Urls1 = extractM3u8FromPlayerApi(videoPageData, hostname);
  if (m3u8Urls1?.length > 0) urls = urls.concat(m3u8Urls1);

  const m3u8Urls2 = extractM3u8FromPlayerApi(videoPageData.video?.media?.media, hostname);
  if (m3u8Urls2?.length > 0) urls = urls.concat(m3u8Urls2);

  if (urls.length > 0) {
    // Return all found manifests. Remove duplicates just in case.
    urls = [...new Set(urls)];
    return { type: 'm3u8', urls };
  }

  // Fallback to building the URL manually. We check if they exist by doing a quick fetch.
  const url1 = makeEchoUrl(videoPageData, '1', 's1_v.m3u8');
  const url2 = makeEchoUrl(videoPageData, '1', 's2_av.m3u8');

  console.log('[Echo360] Testing fallback URLs...');
  
  // Use Promise.all to test both URLs instantly in parallel
  const [res1, res2] = await Promise.all([
    fetch(url1, { method: 'HEAD', credentials: 'include' }).catch(() => ({ ok: false })),
    fetch(url2, { method: 'HEAD', credentials: 'include' }).catch(() => ({ ok: false }))
  ]);

  urls = [];
  if (res1.ok) urls.push(url1);
  if (res2.ok) urls.push(url2);

  // Ultimate fallback if HEAD requests get blocked by weird CORS rules but the URLs are actually valid
  if (urls.length === 0) {
      console.log('[Echo360] HEAD tests failed, falling back to basic extraction.');
      urls = [url2];
      const hasView2 = videoPageData.video?.hasView2 || videoPageData.video?.media?.hasView2 || false;      
      if (hasView2) urls.unshift(url1);
  }

  console.log('[Echo360] Resolved via classroom HTML extraction:', urls);
  return { type: 'm3u8', urls };}

// ─── Tab-based Classroom Capture ─────────────────────────────────────────────

/**
 * Open the lesson's classroom page as a real Chrome tab so the Echo360 player
 * JavaScript executes. The player makes XHR requests for M3U8 URLs, which our
 * webRequest listener (in service-worker.js) stores in chrome.storage.local.
 * We poll for the captured URL, then close the tab.
 *
 * @param {string} hostname     - e.g. "https://echo360.org"
 * @param {string} classroomId  - lesson.lesson.id (full G_... string) or mediaId fallback
 * @param {string} mediaId      - used as the preferred storage key
 * @returns {Promise<string>}   - the captured M3U8 URL
 */
async function openTabAndCaptureM3u8(hostname, classroomId, mediaId) {
  const classroomUrl = `${hostname}/lesson/${encodeURIComponent(classroomId)}/classroom`;
  console.log('[Echo360] Opening classroom tab:', classroomUrl);

  // Snapshot existing M3U8 keys so we can detect newly captured ones
  const existingKeys = await new Promise(resolve => {
    chrome.storage.local.get(null, items =>
      resolve(new Set(Object.keys(items).filter(k => k.startsWith('m3u8_'))))
    );
  });

  // active: true — Echo360 player defers loading when tab is hidden (Page Visibility API)
  const tab = await chrome.tabs.create({ url: classroomUrl, active: true });

  return new Promise((resolve, reject) => {
    let done = false;

    const finish = (url) => {
      if (done) return;
      done = true;
      clearInterval(pollId);
      clearTimeout(timerId);
      chrome.tabs.remove(tab.id).catch(() => {});
      if (url) resolve(url);
      else reject(new Error('Timed out waiting for M3U8 from classroom tab'));
    };

    // Poll every 500ms for a newly captured M3U8 key
    const pollId = setInterval(() => {
      chrome.storage.local.get(null, items => {
        // Prefer the key tied to our mediaId
        if (items[`m3u8_${mediaId}`]) return finish(items[`m3u8_${mediaId}`]);
        // Also accept any new M3U8 key captured since we opened the tab
        for (const key of Object.keys(items)) {
          if (key.startsWith('m3u8_') && !existingKeys.has(key)) {
            console.log('[Echo360] Captured new M3U8 key:', key, items[key]);
            return finish(items[key]);
          }
        }
      });
    }, 500);

    // 45-second timeout — Echo360 player can be slow to initialise
    const timerId = setTimeout(() => finish(null), 45000);
  });
}

async function getCapturedM3u8(mediaId) {
  return new Promise((resolve) => {
    chrome.storage.local.get([`m3u8_${mediaId}`], (result) => {
      resolve(result[`m3u8_${mediaId}`] || null);
    });
  });
}
