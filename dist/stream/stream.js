const urlParams = new URLSearchParams(window.location.search);
const urlsParam = urlParams.get('urls');
let streamUrls = [];

console.log('[Echo360 Stream] Raw URL parameter:', urlsParam);

try {
  streamUrls = JSON.parse(urlsParam);
} catch {
  // Fallback if someone passes just a raw string
  if (urlsParam) streamUrls = [urlsParam];
}

console.log('[Echo360 Stream] Parsed stream URLs:', streamUrls);

const container = document.getElementById('video-container');
const loading = document.getElementById('loading');
const videos = [];

if (streamUrls.length === 0) {
  loading.textContent = 'No stream URLs provided.';
} else {
  streamUrls.forEach((url, index) => {
    console.log(`[Echo360 Stream] Initializing video ${index + 1} with URL:`, url);
    const video = document.createElement('video');
    video.className = 'stream-view';
    video.controls = false;
    if (index > 0) video.muted = true; // Mute secondary streams by default

    container.appendChild(video);
    videos.push(video);

    // Bi-directional sync
    video.addEventListener('play', () => {
      videos.forEach(v => { if (v !== video && v.paused) v.play().catch(()=>{}); });
      if (typeof updatePlayPauseIcon === 'function') updatePlayPauseIcon(true);
    });
    video.addEventListener('pause', () => {
      videos.forEach(v => { if (v !== video && !v.paused) v.pause(); });
      if (typeof updatePlayPauseIcon === 'function') updatePlayPauseIcon(false);
    });
    video.addEventListener('seeked', () => {
      videos.forEach(v => { 
        if (v !== video && Math.abs(v.currentTime - video.currentTime) > 0.5) {
          v.currentTime = video.currentTime; 
        }
      });
    });
    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: function(xhr, url) {
          xhr.withCredentials = true; 
        }
      });

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, function() {
        console.log(`[Echo360 Stream] Manifest parsed for video ${index + 1}`);
        loading.style.display = 'none';
        if (index === 0) {
          video.play().catch(e => console.warn('Autoplay prevented:', e));
        }
      });

      hls.on(Hls.Events.ERROR, function (event, data) {
        console.error(`[Echo360 Stream] HLS Error on video ${index + 1}:`, data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              if (index === 0) {
                loading.textContent = 'Fatal stream error.';
                loading.style.display = 'block';
              }
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('loadedmetadata', function() {
        loading.style.display = 'none';
        if (index === 0) video.play();
      });
    }
  });
}

// PIP Custom Controls Logic
const playPauseBtn = document.getElementById('play-pause');
const playIconHtml = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
const pauseIconHtml = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

function updatePlayPauseIcon(isPlaying) {
  if (playPauseBtn) playPauseBtn.innerHTML = isPlaying ? pauseIconHtml : playIconHtml;
}

if (playPauseBtn && videos.length > 0) {
  playPauseBtn.addEventListener('click', () => {
    const mainVideo = videos[0];
    if (mainVideo.paused) mainVideo.play();
    else mainVideo.pause();
  });
}

const skipBackBtn = document.getElementById('skip-back');
if (skipBackBtn && videos.length > 0) {
  skipBackBtn.addEventListener('click', () => {
    const mainVideo = videos[0];
    mainVideo.currentTime = Math.max(0, mainVideo.currentTime - 10);
  });
}

const skipForwardBtn = document.getElementById('skip-forward');
if (skipForwardBtn && videos.length > 0) {
  skipForwardBtn.addEventListener('click', () => {
    const mainVideo = videos[0];
    mainVideo.currentTime = Math.min(mainVideo.duration || 0, mainVideo.currentTime + 10);
  });
}

const progressContainer = document.getElementById('progress-container');
const progressFill = document.getElementById('progress-fill');
const timeDisplay = document.getElementById('time-display');

const formatTime = (sec) => {
  if (isNaN(sec) || !isFinite(sec)) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

if (videos.length > 0) {
  const mainVideo = videos[0];
  
  mainVideo.addEventListener('timeupdate', () => {
    if (mainVideo.duration) {
      const pct = (mainVideo.currentTime / mainVideo.duration) * 100;
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (timeDisplay) timeDisplay.innerText = `${formatTime(mainVideo.currentTime)} / ${formatTime(mainVideo.duration)}`;
    }
  });

  let isDragging = false;
  const updateProgress = (e) => {
    if (!mainVideo.duration) return;
    const rect = progressContainer.getBoundingClientRect();
    let pct = (e.clientX - rect.left) / rect.width;
    pct = Math.max(0, Math.min(1, pct));
    mainVideo.currentTime = pct * mainVideo.duration;
  };

  progressContainer.addEventListener('mousedown', (e) => {
    isDragging = true;
    updateProgress(e);
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) updateProgress(e);
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Volume
  const volBtn = document.getElementById('vol-btn');
  const volIconOn = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
  const volIconOff = '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
  
  if (volBtn) {
    let isMuted = mainVideo.muted;
    volBtn.addEventListener('click', () => {
      isMuted = !isMuted;
      mainVideo.muted = isMuted;
      volBtn.innerHTML = isMuted ? volIconOff : volIconOn;
    });
  }

  // Speed
  const speedBtn = document.getElementById('speed-btn');
  const speeds = [0.5, 1, 1.5, 2];
  let speedIdx = 1;
  if (speedBtn) {
    speedBtn.addEventListener('click', () => {
      speedIdx = (speedIdx + 1) % speeds.length;
      const newSpeed = speeds[speedIdx];
      videos.forEach(v => v.playbackRate = newSpeed);
      speedBtn.innerText = `${newSpeed}x`;
    });
  }

  // Swap
  const swapBtn = document.getElementById('swap-btn');
  if (swapBtn && videos.length > 1) {
    let swapped = false;
    swapBtn.addEventListener('click', () => {
      swapped = !swapped;
      if (swapped) {
        container.appendChild(videos[0]);
      } else {
        container.appendChild(videos[1]);
      }
    });
  } else if (swapBtn) {
    swapBtn.style.display = 'none';
  }

  // Fullscreen
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.error(err));
      } else {
        document.exitFullscreen();
      }
    });
  }
}