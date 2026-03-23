/**
 * hls-assembler.js — HLS segment download and assembly
 * Runs inside the offscreen document (persistent DOM context).
 *
 * Ports the logic from echo360/hls_downloader.py:
 *  - Downloader._download() → batched Promise.all (replaces gevent Pool)
 *  - Downloader._join_file() → ordered ArrayBuffer array → Blob
 *  - Downloader._worker() retry logic → fetchWithRetry()
 *
 * For large files (>500MB), streams directly to disk via showSaveFilePicker()
 * to avoid holding gigabytes in memory.
 */

const BATCH_SIZE = 20;  // concurrent fetches per video (browser connection limit)
const RETRY_COUNT = 3;  // mirrors Downloader.__init__ retry=3

/**
 * Fetch a single URL with retry on failure.
 * Mirrors the retry loop in Downloader._worker() in hls_downloader.py:193-221
 * @param {string} url
 * @param {number} retries
 * @param {AbortSignal} signal
 * @returns {Promise<ArrayBuffer>}
 */
async function fetchWithRetry(url, retries, signal) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { credentials: 'include', signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.arrayBuffer();
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      if (attempt === retries) throw err;
      // Exponential back-off: 200ms, 400ms, 800ms
      await new Promise(r => setTimeout(r, 200 * Math.pow(2, attempt)));
    }
  }
}

/**
 * Download all HLS segments and assemble into a Blob.
 * The buffers array is indexed to preserve order despite parallel fetching,
 * mirroring the _join_file() goroutine which writes by index in hls_downloader.py:223-249.
 *
 * @param {string[]} segmentUrls - ordered list of .ts segment URLs
 * @param {string} lessonId - for progress reporting
 * @param {AbortSignal} signal - for cancellation
 * @param {function} onProgress - called with (completed, total)
 * @returns {Promise<Blob>}
 */
export async function assembleHLS(segmentUrls, lessonId, signal, onProgress) {
  const buffers = new Array(segmentUrls.length);

  for (let i = 0; i < segmentUrls.length; i += BATCH_SIZE) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const batch = segmentUrls.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((url, j) =>
        fetchWithRetry(url, RETRY_COUNT, signal).then(buf => {
          buffers[i + j] = buf;
        })
      )
    );

    const completed = Math.min(i + BATCH_SIZE, segmentUrls.length);
    onProgress?.(completed, segmentUrls.length);
  }

  // Concatenate all segments in order — mirrors _join_file() in hls_downloader.py:223-249
  return new Blob(buffers, { type: 'video/mp2t' });
}

/**
 * Download all HLS segments and stream them directly to a file on disk.
 * Uses the File System Access API (showSaveFilePicker) to avoid holding
 * large files in memory — important for 1-3GB lectures.
 * Chrome 116+ required.
 *
 * @param {string[]} segmentUrls
 * @param {string} filename - suggested filename (e.g. "Lecture.ts")
 * @param {string} lessonId
 * @param {AbortSignal} signal
 * @param {function} onProgress
 * @returns {Promise<void>}
 */
export async function assembleHLSToFile(segmentUrls, filename, lessonId, signal, onProgress) {
  const fileHandle = await showSaveFilePicker({
    suggestedName: filename,
    types: [{ description: 'MPEG-TS Video', accept: { 'video/mp2t': ['.ts'] } }],
  });
  const writable = await fileHandle.createWritable();

  try {
    for (let i = 0; i < segmentUrls.length; i += BATCH_SIZE) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const batch = segmentUrls.slice(i, i + BATCH_SIZE);
      const batchBuffers = await Promise.all(
        batch.map(url => fetchWithRetry(url, RETRY_COUNT, signal))
      );

      for (const buf of batchBuffers) {
        await writable.write(buf);
      }

      const completed = Math.min(i + BATCH_SIZE, segmentUrls.length);
      onProgress?.(completed, segmentUrls.length);
    }
    await writable.close();
  } catch (err) {
    await writable.abort();
    throw err;
  }
}

/**
 * Download a direct MP4 file (S3 URL) using streaming to disk.
 * For Method 1 (direct MP4) — no HLS parsing needed.
 *
 * @param {string} mp4Url
 * @param {string} filename
 * @param {AbortSignal} signal
 * @param {function} onProgress - called with (bytesLoaded, totalBytes)
 * @returns {Promise<string>} - object URL or void if saved via picker
 */
export async function downloadDirectMP4(mp4Url, filename, signal, onProgress) {
  const res = await fetch(mp4Url, { credentials: 'include', signal });
  if (!res.ok) throw new Error(`Direct MP4 fetch failed: ${res.status}`);

  const total = parseInt(res.headers.get('content-length') || '0');
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress?.(loaded, total);
  }

  return new Blob(chunks, { type: 'video/mp4' });
}
