// sandbox.js

// 1. Access the UMD Globals
const FFmpeg = window.FFmpegWASM?.FFmpeg;
const { fetchFile } = window.FFmpegUtil || {};

let ffmpegInstance = null;

async function getFFmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  
  parent.postMessage({ type: 'LOG', payload: 'Sandbox: Inside getFFmpeg()...' }, '*');

  // ─── DIAGNOSTIC CHECK ───
  const isIsolated = window.crossOriginIsolated;
  parent.postMessage({ 
      type: 'LOG', 
      payload: `[Diagnostics] SharedArrayBuffer: ${!!window.SharedArrayBuffer}, CrossOriginIsolated: ${isIsolated}` 
  }, '*');

  if (!isIsolated) {
      parent.postMessage({ type: 'ERROR', error: "CRITICAL: Sandbox is not Cross-Origin Isolated. Multithreading will fail." }, '*');
      throw new Error("Isolation Missing");
  }
  // ────────────────────────

  parent.postMessage({ type: 'LOG', payload: 'Sandbox: Creating FFmpeg instance...' }, '*');
  ffmpegInstance = new FFmpeg();

  ffmpegInstance.on('log', ({ message }) => {
    parent.postMessage({ type: 'LOG', payload: `[FFmpeg Core Log] ${message}` }, '*');
  });

  ffmpegInstance.on('progress', ({ progress, time }) => {
    parent.postMessage({ type: 'LOG', payload: `[FFmpeg Progress] ${progress * 100}% (time: ${time})` }, '*');
  });

  parent.postMessage({ type: 'LOG', payload: 'Sandbox: Calling ffmpegInstance.load()...' }, '*');

  const coreUrlResolved = new URL('/lib/ffmpeg/ffmpeg-core.js', document.location.href).href;
  const wasmUrlResolved = new URL('/lib/ffmpeg/ffmpeg-core.wasm', document.location.href).href;
  const workerUrlResolved = new URL('/lib/ffmpeg/ffmpeg-core.worker.js', document.location.href).href;
  const classWorkerUrlResolved = new URL('/lib/ffmpeg/814.ffmpeg.js', document.location.href).href;

  parent.postMessage({ type: 'LOG', payload: `Sandbox: coreURL=${coreUrlResolved}, wasmURL=${wasmUrlResolved}` }, '*');

  // Track promise resolution and timeout
  const loadPromise = ffmpegInstance.load({
    coreURL: coreUrlResolved,
    wasmURL: wasmUrlResolved,
    workerURL: workerUrlResolved,
    classWorkerURL: classWorkerUrlResolved
  });

  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("ffmpegInstance.load() timed out after 30 seconds")), 30000)
  );

  try {
    await Promise.race([loadPromise, timeoutPromise]);
    parent.postMessage({ type: 'LOG', payload: 'Sandbox: ffmpegInstance.load() completed successfully!' }, '*');
  } catch (err) {
    // Print the raw error and attempt to extract a message if available. It might not be an Error object.
    parent.postMessage({ type: 'ERROR', error: `Sandbox: ffmpegInstance.load() threw an error: ${err?.message ? err.message : JSON.stringify(err) || err}` }, '*');
    throw err;
  }

  return ffmpegInstance;
}

window.addEventListener('error', (event) => {
  parent.postMessage({ type: 'ERROR', error: `Sandbox Global Error: ${event.message} at ${event.filename}:${event.lineno}` }, '*');
});

window.addEventListener('unhandledrejection', (event) => {
  parent.postMessage({ type: 'ERROR', error: `Sandbox Unhandled Rejection: ${event.reason?.message || event.reason}` }, '*');
});

const muxQueue = [];
let isMuxing = false;

async function processMuxQueue() {
  if (isMuxing || muxQueue.length === 0) return;
  isMuxing = true;

  const payload = muxQueue.shift();
  const { lessonId, videoBuffer, audioBuffer, filename } = payload;

  try {
    parent.postMessage({ type: 'LOG', payload: `Sandbox: Starting Engine for ${lessonId}...` }, '*');
    const ff = await getFFmpeg();

    parent.postMessage({ type: 'LOG', payload: `Sandbox: Writing Files for ${lessonId}...` }, '*');
    await ff.writeFile('video.mp4', new Uint8Array(videoBuffer));

    if (audioBuffer) {
      await ff.writeFile('audio.mp4', new Uint8Array(audioBuffer));
    }

    parent.postMessage({ type: 'LOG', payload: `Sandbox: Muxing ${lessonId}...` }, '*');

    const args = audioBuffer
      ? ['-i', 'video.mp4', '-i', 'audio.mp4', '-c', 'copy', 'output.mp4']
      : ['-i', 'video.mp4', '-c', 'copy', 'output.mp4'];

    await ff.exec(args);

    parent.postMessage({ type: 'LOG', payload: `Sandbox: Reading Output for ${lessonId}...` }, '*');
    const data = await ff.readFile('output.mp4');

    // Cleanup
    await ff.deleteFile('video.mp4');
    if (audioBuffer) await ff.deleteFile('audio.mp4');
    await ff.deleteFile('output.mp4');

    const buffer = data.buffer;
    parent.postMessage(
      { type: 'MUX_DONE', lessonId: lessonId, buffer: buffer, filename: filename },
      '*',
      [buffer]
    );

  } catch (err) {
    parent.postMessage({ type: 'ERROR', lessonId: lessonId, error: err.message }, '*');
  } finally {
    isMuxing = false;
    processMuxQueue(); // Process the next job in the queue
  }
}

window.addEventListener('message', async (event) => {
  const { type, payload } = event.data;

  if (type === 'START_MUX') {
    muxQueue.push(payload);
    processMuxQueue();
  }
});
parent.postMessage({ type: 'READY' }, '*');