/**
 * utils.js — shared utility functions
 * Ports of Python equivalents from echo360/hls_downloader.py and echo360/videos.py
 */

/**
 * Non-standard URL join — exact port of hls_downloader.py:12-18.
 * Truncates `a` at its last '/' then appends `b` with leading slashes stripped.
 * DO NOT replace with new URL(b, a) — the Python version is intentionally non-standard.
 * @param {string} a - base URL
 * @param {string} b - relative path
 * @returns {string}
 */
export function urlJoin(a, b) {
  a = a.slice(0, a.lastIndexOf('/') + 1);
  b = b.replace(/^\/+/, '');
  return a + b;
}

/**
 * Replace characters invalid in filenames with underscores.
 * Mirrors: regex_replace_invalid.sub("_", name) in Python.
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFilename(name) {
  // Chrome download API is very strict about filenames.
  // We must strip slashes, colons, stars, question marks, quotes, angle brackets, pipes,
  // AND control characters, tildes, and leading/trailing periods or spaces.
  return name
    .replace(/[\\/:*?"<>|~]/g, '-')
    .replace(/[\x00-\x1F\x7F]/g, '') // remove control chars
    .replace(/^\.+|\.+$/g, '') // remove leading/trailing periods
    .trim();
}

/**
 * Extract the section UUID from the current page URL.
 * Works for both direct echo360.org and iframe contexts.
 * URL format: /section/{uuid}/home
 * @returns {string|null}
 */
export function extractSectionIdFromUrl() {
  const match = window.location.pathname.match(
    /\/section\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  return match ? match[1] : null;
}

/**
 * Extract the section UUID from any echo360 URL string.
 * @param {string} url
 * @returns {string|null}
 */
export function extractSectionIdFromUrlString(url) {
  const match = url.match(
    /\/section\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  return match ? match[1] : null;
}

/**
 * Parse the lesson UUID from a data-test-lessonid attribute value.
 * Format: G_{groupId}_{sectionId}_{startISO}_{endISO}
 * The groupId is the actual lesson UUID used for API calls.
 * @param {string} dataTestLessonId
 * @returns {string|null}
 */
export function parseLessonId(dataTestLessonId) {
  if (!dataTestLessonId) return null;
  // Format starts with "G_" then the groupId UUID
  const parts = dataTestLessonId.split('_');
  if (parts.length >= 6 && parts[0] === 'G') {
    // UUID is parts[1]-parts[5] (UUID has 5 segments joined by -)
    return `${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}-${parts[5]}`;
  }
  return null;
}

/**
 * Parse a date string from lesson data.
 * Mirrors EchoCloudVideo._extract_date() in echo360/videos.py:550-561.
 * @param {object} lessonJson
 * @returns {string} - YYYY-MM-DD or '1970-01-01'
 */
export function parseDateFromLesson(lessonJson) {
  try {
    let dateStr = null;
    if (lessonJson?.lesson?.startTimeUTC) {
      dateStr = lessonJson.lesson.startTimeUTC;
    } else if (lessonJson?.lesson?.lesson?.createdAt) {
      dateStr = lessonJson.lesson.lesson.createdAt;
    } else if (lessonJson?.groupInfo?.createdAt) {
      dateStr = lessonJson.groupInfo.createdAt;
    }
    if (!dateStr) return '1970-01-01';
    const d = new Date(dateStr);
    return d.toISOString().slice(0, 10);
  } catch {
    return '1970-01-01';
  }
}

/**
 * Build an output filename mirroring the Python format:
 * "{courseId} - {date} - {title}"
 * @param {string} courseId
 * @param {string} date - YYYY-MM-DD
 * @param {string} title
 * @returns {string}
 */
export function formatFilename(courseId, date, title) {
  return sanitizeFilename(`${courseId} - ${date} - ${title}`);
}

/**
 * Get the echo360 hostname from any echo360 URL or the current page.
 * @param {string} [url]
 * @returns {string} e.g. "https://echo360.org"
 */
export function getHostname(url) {
  try {
    const u = new URL(url || window.location.href);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return 'https://echo360.org';
  }
}
