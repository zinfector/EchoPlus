// offscreen.js

// 1. Setup the Sandbox
const iframe = document.createElement('iframe');
iframe.src = 'sandbox.html';
// CRITICAL: Grant the iframe permission to be Cross-Origin Isolated
iframe.allow = "cross-origin-isolated"; 
document.body.appendChild(iframe);

let sandboxReady = false;
const pendingJobs = [];

// 2. Listen for Sandbox Messages
window.addEventListener('message', (event) => {
  // Ensure message comes from our iframe
  if (event.source !== iframe.contentWindow) return;

  const data = event.data;

  switch (data.type) {
    case 'READY':
      console.log('[Offscreen] Sandbox is ready.');
      sandboxReady = true;
      // Process any jobs that queued up while loading
      while (pendingJobs.length > 0) processJob(pendingJobs.shift());
      break;

    case 'LOG':
      console.log('[FFmpeg Worker]', data.payload);
      break;

    case 'MUX_DONE':
      console.log(`[Offscreen] Muxing complete for ${data.lessonId}!`);
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const finalUrl = URL.createObjectURL(blob);

      // The Chrome downloads API drops filenames from blob:// URLs and generates UUIDs.
      // We bypass it by simulating a standard anchor click right here in the DOM!
      const a = document.createElement('a');
      a.href = finalUrl;
      a.download = data.filename.endsWith('.mp4') ? data.filename : data.filename + '.mp4';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Clean up memory after a generous 15-second delay to ensure the browser captures it
      setTimeout(() => URL.revokeObjectURL(finalUrl), 15000);

      chrome.runtime.sendMessage({
        type: 'FFMPEG_DONE',
        payload: { lessonId: data.lessonId, blobUrl: finalUrl, filename: data.filename }
      });
      break;

    case 'ERROR':
      console.error(`[Offscreen] Sandbox Error for ${data.lessonId}:`, data.error);
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_ERROR',
        payload: { lessonId: data.lessonId, error: data.error }
      });
      break;
  }
});

// 3. Process Logic
async function processJob(payload) {
  if (!sandboxReady) {
    pendingJobs.push(payload);
    return;
  }

  const { lessonId, job } = payload;

  try {
    console.log(`[Offscreen] Downloading raw streams for ${lessonId}...`);

    // Use your existing fetchAndConcatMP4 function
    const videoBuffer = await fetchAndConcatMP4(job.mp4Urls, lessonId, 1, 3);

    let audioBuffer = null;
    if (job.audioMp4Urls && job.audioMp4Urls.length > 0) {
      audioBuffer = await fetchAndConcatMP4(job.audioMp4Urls, lessonId, 2, 3);
    }

    console.log(`[Offscreen] Sending buffers to Sandbox for ${lessonId}...`);

    // Transfer buffers to sandbox (zero-copy)
    const transferList = [videoBuffer];
    if (audioBuffer) transferList.push(audioBuffer);

    iframe.contentWindow.postMessage(
      {
        type: 'START_MUX',
        payload: { lessonId, videoBuffer, audioBuffer, filename: job.filename }
      },
      '*',
      transferList
    );

  } catch (err) {
    console.error(`[Offscreen] Download failed for ${lessonId}:`, err);
    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_ERROR',
      payload: { lessonId, error: err.message }
    });
  }
}
// ─── FFmpeg Muxing ────────────────────────────────────────────────────────────

async function fetchAndConcatMP4(urls, lessonId, step, totalSteps) {
 const buffers = [];
    const baseProgress = (step - 1) * 100;
    const fullTotal = totalSteps * 100;
  
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const resp = await fetch(url, { credentials: 'include' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  
      const contentLength = parseInt(resp.headers.get('content-length') || '0', 10);
      
      if (resp.body) {
        const reader = resp.body.getReader();
        const chunks = [];
        let loaded = 0;
        let lastReportTime = 0;
  
        while(true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.byteLength;
          
          const now = Date.now();
          if (now - lastReportTime > 200) {
             lastReportTime = now;
             const currentPct = contentLength > 0 ? Math.floor((loaded / contentLength) * 100) : 50;
             chrome.runtime.sendMessage({
               type: 'DOWNLOAD_PROGRESS',
               payload: { lessonId: lessonId, completed: baseProgress + currentPct, total: fullTotal }
             }).catch(() => {});
          }
        }
        
        const fileTotal = chunks.reduce((sum, b) => sum + b.byteLength, 0);
        const fileMerged = new Uint8Array(fileTotal);
        let offset = 0;
        for (const chunk of chunks) {
          fileMerged.set(chunk, offset);
          offset += chunk.byteLength;
        }
        buffers.push(fileMerged.buffer);
      } else {
        buffers.push(await resp.arrayBuffer());
      }
    }
    
    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_PROGRESS',
      payload: { lessonId: lessonId, completed: step * 100, total: fullTotal }
    }).catch(() => {});
  
    const total = buffers.reduce((sum, b) => sum + b.byteLength, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const buf of buffers) {
      merged.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }
    return merged.buffer;
}

// 5. Listen for Background messages
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'OFFSCREEN_JOB') {
    processJob(message.payload);
  }
});