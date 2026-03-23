/**
 * classroom-extractor.js — Fallback content script for Methods 3 & 4.
 *
 * Injected programmatically via chrome.scripting.executeScript() into
 * /lesson/{id}/classroom pages when JSON-based URL resolution fails.
 *
 * Returns regex matches for .mp4 and .m3u8 URLs from the page source,
 * mirroring brute_force_get_url() in echo360/videos.py:409-444.
 */

(function () {
  const html = document.documentElement.outerHTML.replace(/\\\//g, '/');

  const mp4Urls = [...new Set(html.match(/https:\/\/[^,"]*?\.mp4/g) || [])];
  const m3u8Urls = [...new Set(html.match(/https:\/\/[^,"]*?av\.m3u8/g) || [])];

  return {
    mp4: mp4Urls.sort().slice(0, 2),
    m3u8: m3u8Urls.sort().reverse().slice(0, 2),
  };
})();
