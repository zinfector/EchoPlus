import { resolveVideoUrl } from '../../lib/video-resolver.js';

export function getPlayerHTML(cls) {
            const clsId = cls.id;
            return `
                <div data-lesson-id="${clsId}" class="echo-player w-full bg-black rounded-lg shadow-2xl flex flex-col relative group/player overflow-hidden border border-gray-800 font-sans select-none pb-16">
                    
                    <!-- Video Area (Interactive) -->
                    <div class="video-area flex w-full relative bg-gray-900">

                        <audio class="hidden feed-audio" playsinline></audio>

                        <!-- Feed 1: Screen -->                        <div class="feed-1 flex flex-col relative bg-gray-900 border-r border-black z-0 aspect-video" style="width: 50%;">
                            <video class="absolute inset-0 w-full h-full object-contain z-10 hidden feed-video-1" playsinline></video>
                            <!-- Centered, shrink-to-fit container mimicking object-fit -->
                            <div class="absolute inset-0 p-3 flex items-center justify-center pointer-events-none">
                                <div class="aspect-video w-full h-full max-h-full max-w-full bg-gray-950 rounded border border-gray-700/50 flex flex-col items-center justify-center shadow-inner">
                                    <i data-lucide="monitor" class="w-12 h-12 text-gray-600 mb-2 feed-icon"></i>
                                    <span class="text-gray-600 text-[10px] uppercase font-bold tracking-widest feed-label">Screen Feed</span>
                                </div>
                            </div>
                        </div>

                        <!-- Draggable Divider for Side-by-Side -->
                        <div class="resizer w-2 bg-black hover:bg-brand-light cursor-col-resize z-10 flex items-center justify-center transition-colors">
                            <div class="h-8 w-0.5 bg-gray-600 rounded pointer-events-none"></div>
                        </div>

                        <!-- Feed 2: Camera -->
                        <div class="feed-2 flex flex-col relative bg-gray-900 z-0 aspect-video" style="width: 50%;">
                            <video class="absolute inset-0 w-full h-full object-contain z-10 hidden feed-video-2" playsinline></video>
                            <div class="absolute inset-0 p-3 flex items-center justify-center pointer-events-none">
                                <div class="aspect-video w-full h-full max-h-full max-w-full bg-gray-950 rounded border border-gray-700/50 flex flex-col items-center justify-center shadow-inner">
                                    <i data-lucide="user" class="w-12 h-12 text-gray-600 mb-2 feed-icon"></i>
                                    <span class="text-gray-600 text-[10px] uppercase font-bold tracking-widest feed-label">Camera Feed</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Big Play Overlay (Hidden when playing) -->
                        <div class="big-play-overlay absolute inset-0 flex items-center justify-center bg-black/40 group-hover/player:bg-transparent transition-all z-10 pointer-events-none">
                            <div class="play-toggle w-16 h-16 rounded-full bg-brand-light/90 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform pointer-events-auto cursor-pointer">
                                <svg viewBox="0 0 24 24" class="w-8 h-8 fill-current ml-1"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                        </div>

                        <!-- Captions Overlay -->
                        <div class="captions-overlay absolute bottom-4 group-hover/player:bottom-[72px] left-0 right-0 flex items-end justify-center pointer-events-none z-10 opacity-0 transition-all duration-300">
                            <div class="captions-text bg-black/80 text-white font-medium px-4 py-2 rounded max-w-[80%] text-center leading-relaxed"></div>
                        </div>
                    </div>

                    <!-- Echo360-style Controls Bar -->
                    <div class="controls-bar absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/95 via-black/70 to-transparent flex flex-col justify-end z-20 opacity-0 group-hover/player:opacity-100 transition-opacity duration-300">
                        <!-- Progress Bar -->
                        <div class="w-full px-4 mb-1 relative group/progress-container">
                            <!-- Thumbnail Preview -->
                            <div class="hover-thumbnail absolute bottom-full mb-2 left-0 transform -translate-x-1/2 hidden flex-col items-center pointer-events-none z-[100]">
                                <div class="w-32 aspect-video bg-black border border-gray-600 rounded shadow-lg overflow-hidden relative">
                                    <img src="" crossorigin="anonymous" class="w-full h-full object-cover">
                                    <div class="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded font-mono hover-time-text">00:00</div>
                                </div>
                                <div class="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-gray-600"></div>
                            </div>
                            
                            <div class="h-1 bg-gray-600/60 rounded cursor-pointer relative hover:h-1.5 transition-all group/progress">
                                <div class="absolute left-0 top-0 bottom-0 bg-brand-light rounded w-0">
                                    <div class="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-brand-light rounded-full opacity-0 group-hover/progress:opacity-100 shadow"></div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Control Buttons -->
                        <div class="flex items-center justify-between px-4 pb-3">
                            <div class="flex items-center space-x-4">
                                <button class="play-toggle text-white hover:text-brand-light transition-colors focus:outline-none flex items-center justify-center w-6 h-6">
                                    <svg viewBox="0 0 24 24" class="w-5 h-5 fill-current"><path d="M8 5v14l11-7z"/></svg>
                                </button>
                                <button class="skip-back text-white hover:text-brand-light transition-colors focus:outline-none flex items-center justify-center w-6 h-6" title="Back 10s">
                                    <svg viewBox="0 0 24 24" class="w-5 h-5 fill-current"><path d="M12.5 3C17.15 3 21 6.85 21 11.5S17.15 20 12.5 20c-3.74 0-7.01-2.42-8.1-5.83l1.89-.62c.86 2.65 3.39 4.55 6.21 4.55 3.6 0 6.5-2.9 6.5-6.5S16.1 5.1 12.5 5.1V8l-4-4 4-4v3zm-2.8 9.9c0-1.8.8-2.6 2.1-2.6 1.3 0 2.1.8 2.1 2.6v2.1c0 1.8-.8 2.6-2.1 2.6-1.3 0-2.1-.8-2.1-2.6v-2.1zm1.3.1v1.9c0 .7.2 1.3.8 1.3s.8-.6.8-1.3v-1.9c0-.7-.2-1.3-.8-1.3s-.8.6-.8 1.3zm-3.6 2.8H8.8V11.5H7.1v1h1.7v3.3z"/></svg>
                                </button>
                                <button class="skip-forward text-white hover:text-brand-light transition-colors focus:outline-none flex items-center justify-center w-6 h-6" title="Forward 10s">
                                    <svg viewBox="0 0 24 24" class="w-5 h-5 fill-current"><path d="M11.5 3C6.85 3 3 6.85 3 11.5S6.85 20 11.5 20c3.74 0 7.01-2.42 8.1-5.83l-1.89-.62c-.86 2.65-3.39 4.55-6.21 4.55-3.6 0-6.5-2.9-6.5-6.5S8.9 5.1 11.5 5.1V8l4-4-4-4v3zm2.8 9.9c0-1.8-.8-2.6-2.1-2.6-1.3 0-2.1.8-2.1 2.6v2.1c0 1.8.8 2.6 2.1 2.6 1.3 0 2.1-.8 2.1-2.6v-2.1zm-1.3.1v1.9c0 .7-.2 1.3-.8 1.3s-.8-.6-.8-1.3v-1.9c0-.7.2-1.3.8-1.3s.8.6.8 1.3zm3.6 2.8h-1.4V11.5h-1.7v1h1.7v3.3z"/></svg>
                                </button>
                                <div class="flex items-center space-x-2 group/vol cursor-pointer ml-2">
                                    <button class="vol-btn text-white hover:text-brand-light transition-colors focus:outline-none"><i data-lucide="volume-2" class="vol-icon w-5 h-5"></i></button>
                                    <div class="w-0 overflow-hidden group-hover/vol:w-16 transition-all duration-300 ease-out">
                                        <div class="w-16 h-1 bg-gray-600 rounded mt-0.5"><div class="w-2/3 h-full bg-brand-light rounded"></div></div>
                                    </div>
                                </div>
                                <span class="text-white text-xs font-medium tabular-nums mt-0.5">00:00 / 00:00</span>
                            </div>
                            
                            <div class="flex items-center space-x-4">
                                <button class="speed-btn text-white hover:text-brand-light transition-colors focus:outline-none text-xs font-bold mr-1"><span>1x</span></button>
                                <button class="cc-btn text-white hover:text-brand-light transition-colors focus:outline-none" title="Captions"><i data-lucide="subtitles" class="w-5 h-5"></i></button>
                                <button class="swap-btn text-white hover:text-brand-light transition-colors focus:outline-none" title="Swap Feeds"><i data-lucide="arrow-left-right" class="w-5 h-5"></i></button>
                                <button class="layout-btn text-white hover:text-brand-light transition-colors focus:outline-none" title="Sources Layout"><i data-lucide="layout-template" class="w-5 h-5"></i></button>
                                <button class="settings-btn text-white hover:text-brand-light transition-colors focus:outline-none" title="Settings"><i data-lucide="settings" class="w-5 h-5"></i></button>
                                <button class="pip-btn text-white hover:text-brand-light transition-colors focus:outline-none" title="Pop Out Player"><i data-lucide="external-link" class="w-5 h-5"></i></button>
                                <button class="max-btn text-white hover:text-brand-light transition-colors focus:outline-none" title="Fullscreen"><i data-lucide="maximize" class="w-5 h-5"></i></button>
                            </div>
                        </div>
                    </div>

                    <!-- GUI Menus / Popups -->
                    <div class="popup-menu layout-menu hidden absolute bottom-14 right-16 w-56 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-lg shadow-xl py-2 z-30 text-sm text-gray-200">
                        <div class="px-4 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 border-b border-gray-800 pb-2">Layout Option</div>
                        <button class="opt-sbs w-full text-left px-4 py-2 hover:bg-gray-800 flex items-center text-brand-light"><i data-lucide="columns" class="w-4 h-4 mr-3"></i> Side by Side <i data-lucide="check" class="w-4 h-4 ml-auto"></i></button>
                        <button class="opt-pip w-full text-left px-4 py-2 hover:bg-gray-800 flex items-center"><i data-lucide="picture-in-picture" class="w-4 h-4 mr-3"></i> Freeform (Drag & Resize)</button>
                    </div>

                    <div class="popup-menu speed-menu hidden absolute bottom-14 right-28 w-32 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-lg shadow-xl py-2 z-30 text-sm text-gray-200">
                        <div class="px-3 pb-2 mb-1 border-b border-gray-800 flex items-center">
                            <input type="number" step="0.1" min="0.1" max="4.0" placeholder="Custom" class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-brand-light custom-speed-input">
                            <button class="ml-2 text-brand-light hover:text-white transition-colors custom-speed-apply"><i data-lucide="check" class="w-4 h-4"></i></button>
                        </div>
                        <div class="speed-options-container">
                            <button class="w-full text-left px-4 py-2 hover:bg-gray-800 flex items-center justify-between speed-opt">2x</button>
                            <button class="w-full text-left px-4 py-2 hover:bg-gray-800 flex items-center justify-between speed-opt">1.5x</button>
                            <button class="w-full text-left px-4 py-2 hover:bg-gray-800 flex items-center justify-between text-brand-light speed-opt">1x <i data-lucide="check" class="w-4 h-4 check-icon"></i></button>
                            <button class="w-full text-left px-4 py-2 hover:bg-gray-800 flex items-center justify-between speed-opt">0.5x</button>
                        </div>
                    </div>

                    <div class="popup-menu settings-menu hidden absolute bottom-14 right-10 w-48 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-lg shadow-xl py-2 z-30 text-sm text-gray-200">
                        <button class="w-full text-left px-4 py-2 hover:bg-gray-800 flex items-center justify-between">Quality <span class="text-gray-400 text-xs">Auto</span></button>
                        <button class="w-full text-left px-4 py-2 hover:bg-gray-800 flex items-center justify-between btn-caption-size">Caption Size <span class="text-brand-light text-xs font-bold caption-size-val">Medium</span></button>
                        <button class="w-full text-left px-4 py-2 hover:bg-gray-800 flex items-center justify-between">Report Issue</button>
                    </div>
                </div>
            `;
        }

        // Initialize Player Interaction Logic (Scoped per player instance)
        window.initEchoPlayer = function(player) {
        if (!player || player.dataset.initialized) return;
        player.dataset.initialized = 'true';

        const lessonId = player.dataset.lessonId;
        const cls = classData.find(c => c.id === lessonId);

        const v1 = player.querySelector('.feed-video-1');
        const v2 = player.querySelector('.feed-video-2');

        const playBtns = player.querySelectorAll('.play-toggle');
        const playIcons = player.querySelectorAll('.play-icon');
        const bigOverlay = player.querySelector('.big-play-overlay');
        const volBtn = player.querySelector('.vol-btn');
        const volIcon = player.querySelector('.vol-icon');
        const ccBtn = player.querySelector('.cc-btn');
        const swapBtn = player.querySelector('.swap-btn');
        const maxBtn = player.querySelector('.max-btn');
        const controlsBar = player.querySelector('.controls-bar');
        const videoArea = player.querySelector('.video-area');

        const popups = player.querySelectorAll('.popup-menu');
        const closePopups = () => popups.forEach(p => p.classList.add('hidden'));

        const attachPopup = (btnClass, menuClass) => {
        const btn = player.querySelector(btnClass);
        const menu = player.querySelector(menuClass);
        if (btn && menu) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = menu.classList.contains('hidden');
                closePopups();
                if (isHidden) menu.classList.remove('hidden');
            });
        }
        };
        attachPopup('.layout-btn', '.layout-menu');
        attachPopup('.speed-btn', '.speed-menu');
        attachPopup('.settings-btn', '.settings-menu');

        player.addEventListener('click', () => closePopups());
        videoArea.addEventListener('click', (e) => {
            if (e.target.closest('.resizer')) return;
            if (hasMovedDuringDrag) {
                hasMovedDuringDrag = false;
                return;
            }
            closePopups();
            togglePlay();
        });
    if (cls && cls.hasVideo) {
        bigOverlay.innerHTML = '<div class="text-white animate-pulse">Resolving stream...</div>';
        
        console.log(`[Echo360 Debug] Attempting to resolve video for lesson:`, cls);
        console.log(`[Echo360 Debug] Calling resolveVideoUrl with mediaId:`, cls.mediaId);

        resolveVideoUrl(cls.lessonData, window.EchoContext.hostname, cls.mediaId).then(resolved => {
            console.log(`[Echo360 Debug] resolveVideoUrl returned:`, resolved);
            
            bigOverlay.innerHTML = '<div class="play-toggle w-16 h-16 rounded-full bg-brand-light/90 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform pointer-events-auto cursor-pointer"><i data-lucide="play" class="play-icon w-8 h-8 ml-1"></i></div>';
            lucide.createIcons({ root: player });
            
            player.querySelectorAll('.play-toggle').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    togglePlay();
                });
            });

            if (resolved && resolved.urls) {
                setupVideo(v1, resolved.urls[0], player.querySelector('.feed-1'));
                if (resolved.urls.length > 1) {
                    setupVideo(v2, resolved.urls[1], player.querySelector('.feed-2'));
                    v2.muted = true;
                } else {
                    player.querySelector('.feed-2').style.display = 'none';
                    player.querySelector('.resizer').style.display = 'none';
                    player.querySelector('.feed-1').style.width = '100%';
                    player.querySelector('.feed-1').style.borderRight = 'none';
                }
                
                const vA = player.querySelector('.feed-audio');
                if (resolved.audioUrl && vA) {
                    setupVideo(vA, resolved.audioUrl, null);
                    v1.muted = true; // Mute v1 so we only hear the high-quality audio stream
                    
                    vA.addEventListener('play', () => { isPlaying = true; updatePlayUI(); });
                    vA.addEventListener('pause', () => { isPlaying = false; updatePlayUI(); });
                }

                // Dynamically spawn N-extra feeds if available
                for (let i = 2; i < resolved.urls.length; i++) {
                    const extraFeed = document.createElement('div');
                    // In SBS mode they are hidden by default, in PIP mode they appear
                    extraFeed.className = `extra-feed absolute bottom-${4 + (i-1)*14} right-4 w-1/4 min-w-[150px] aspect-video bg-black border border-gray-600 rounded-lg shadow-2xl z-20 overflow-hidden resize hover:ring-2 hover:ring-brand-light cursor-move`;
                    extraFeed.style.width = '25%';
                    extraFeed.style.height = 'auto';
                    extraFeed.style.display = 'none'; // Hidden until PIP mode
                    
                    extraFeed.innerHTML = `
                        <video class="absolute inset-0 w-full h-full object-contain z-10 hidden" playsinline></video>
                        <div class="absolute inset-0 p-3 flex items-center justify-center pointer-events-none">
                            <div class="aspect-video w-full h-full max-h-full max-w-full bg-gray-950 rounded border border-gray-700/50 flex flex-col items-center justify-center shadow-inner">
                                <i data-lucide="video" class="w-12 h-12 text-gray-600 mb-2 feed-icon"></i>
                                <span class="text-gray-600 text-[10px] uppercase font-bold tracking-widest feed-label">Extra Feed ${i-1}</span>
                            </div>
                        </div>
                    `;
                    videoArea.insertBefore(extraFeed, player.querySelector('.big-play-overlay'));
                    
                    const vx = extraFeed.querySelector('video');
                    setupVideo(vx, resolved.urls[i], extraFeed);
                    vx.muted = true;
                    
                    extraFeed.addEventListener('mousedown', initPipDrag);
                    
                    vx.addEventListener('play', () => { 
                        isPlaying = true; 
                        updatePlayUI(); 
                    });
                    vx.addEventListener('pause', () => { 
                        isPlaying = false; 
                        updatePlayUI(); 
                    });
                }
                
                lucide.createIcons({ root: player });
            }
        }).catch(e => {
            bigOverlay.innerHTML = `<div class="text-red-500 text-sm font-bold bg-black/80 px-4 py-2 rounded">Error: ${e.message}</div>`;
        });
    }

    function setupVideo(vidElement, url, container) {
        vidElement.classList.remove('hidden');
        if (container) {
            if (container.querySelector('.feed-icon')) container.querySelector('.feed-icon').classList.add('hidden');
            if (container.querySelector('.feed-label')) container.querySelector('.feed-label').classList.add('hidden');
        }
        
        if (typeof Hls !== 'undefined' && Hls.isSupported()) {
            const hls = new Hls({ xhrSetup: function(xhr) { xhr.withCredentials = true; } });
            hls.loadSource(url);
            hls.attachMedia(vidElement);
            return hls;
        } else if (vidElement.canPlayType('application/vnd.apple.mpegurl')) {
            vidElement.src = url;
        }
        return null;
    }

    let isPlaying = false;
    
    function updatePlayUI() {
        const playIconSvg = '<svg viewBox="0 0 24 24" class="w-5 h-5 fill-current"><path d="M8 5v14l11-7z"/></svg>';
        const pauseIconSvg = '<svg viewBox="0 0 24 24" class="w-5 h-5 fill-current"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
        const playIconBig = '<svg viewBox="0 0 24 24" class="w-8 h-8 fill-current ml-1"><path d="M8 5v14l11-7z"/></svg>';
        const pauseIconBig = '<svg viewBox="0 0 24 24" class="w-8 h-8 fill-current ml-1"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
        
        player.querySelectorAll('.play-toggle').forEach(btn => {
            const isBig = btn.classList.contains('w-16');
            if (isBig) {
                btn.innerHTML = isPlaying ? pauseIconBig : playIconBig;
            } else {
                btn.innerHTML = isPlaying ? pauseIconSvg : playIconSvg;
            }
        });
        
        if (isPlaying) {
            bigOverlay.classList.add('opacity-0');
            bigOverlay.classList.remove('pointer-events-auto');
        } else {
            bigOverlay.classList.remove('opacity-0');
            bigOverlay.classList.add('pointer-events-auto');
        }
    }

    function togglePlay() {
        const activeMedia = Array.from(player.querySelectorAll('video, audio')).filter(m => m.src || m.srcObject || m.src !== "");
        if (activeMedia.length === 0) return;
        
        if (activeMedia[0].paused) {
            activeMedia.forEach(m => m.play().catch(()=>{}));
        } else {
            activeMedia.forEach(m => m.pause());
        }
    }

    v1.addEventListener('play', () => { 
        isPlaying = true; 
        updatePlayUI(); 
    });
    v1.addEventListener('pause', () => { 
        isPlaying = false; 
        updatePlayUI(); 
    });
    v1.addEventListener('seeked', () => { 
        const activeMedia = Array.from(player.querySelectorAll('video, audio')).filter(m => m.src || m.srcObject || m.src !== "");
        activeMedia.forEach(m => {
            if (m !== v1) m.currentTime = v1.currentTime; 
        });
    });

    // Keyboard Shortcuts
    player.tabIndex = 0; // Make player focusable
    player.addEventListener('keydown', (e) => {
        if (!v1.duration) return;
        switch(e.key.toLowerCase()) {
            case ' ':
            case 'k':
                e.preventDefault();
                togglePlay();
                break;
            case 'f':
                e.preventDefault();
                maxBtn.click();
                break;
            case 'm':
                e.preventDefault();
                volBtn.click();
                break;
            case 'c':
                e.preventDefault();
                ccBtn.click();
                break;
            case 'arrowright':
                e.preventDefault();
                v1.currentTime = Math.min(v1.currentTime + 10, v1.duration);
                break;
            case 'arrowleft':
                e.preventDefault();
                v1.currentTime = Math.max(v1.currentTime - 10, 0);
                break;
            case 'arrowup':
                e.preventDefault();
                if (volSliderWrap) {
                    let newVol = Math.min((v1.volume || 0) + 0.05, 1);
                    setVolumeVisuals(newVol);
                }
                break;
            case 'arrowdown':
                e.preventDefault();
                if (volSliderWrap) {
                    let newVol = Math.max((v1.volume || 0) - 0.05, 0);
                    setVolumeVisuals(newVol);
                }
                break;
        }
    });
    
    // Focus player when clicking the video area so hotkeys work immediately
    videoArea.addEventListener('mousedown', () => player.focus());

    // --- Captions Logic ---
    let ccEnabled = false;
    let transcriptData = null;
    let isFetchingTranscript = false;
    const captionsOverlay = player.querySelector('.captions-overlay');
    const captionsText = player.querySelector('.captions-text');
    const captionSizeBtn = player.querySelector('.btn-caption-size');
    const captionSizeVal = player.querySelector('.caption-size-val');

    const ccSizes = [
        { label: 'Small', class: 'text-sm md:text-base' },
        { label: 'Medium', class: 'text-lg md:text-xl' },
        { label: 'Large', class: 'text-2xl md:text-3xl' }
    ];
    let currentSizeIndex = parseInt(localStorage.getItem('echo360_cc_size')) || 1;
    if (isNaN(currentSizeIndex) || currentSizeIndex < 0 || currentSizeIndex >= ccSizes.length) currentSizeIndex = 1;

    const applyCaptionSize = () => {
        const size = ccSizes[currentSizeIndex];
        if (captionSizeVal) captionSizeVal.innerText = size.label;
        captionsText.className = `captions-text bg-black/80 text-white font-medium px-4 py-2 rounded max-w-[80%] text-center leading-relaxed ${size.class}`;
    };
    applyCaptionSize();

    if (captionSizeBtn) {
        captionSizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentSizeIndex = (currentSizeIndex + 1) % ccSizes.length;
            localStorage.setItem('echo360_cc_size', currentSizeIndex);
            applyCaptionSize();
        });
    }

    const updateCaptions = () => {
        if (!ccEnabled || !transcriptData || !v1.duration) {
            captionsText.innerText = '';
            return;
        }
        const currentMs = v1.currentTime * 1000;
        const activeCue = transcriptData.find(cue => currentMs >= cue.startMs && currentMs <= cue.endMs);
        if (activeCue) {
            captionsText.innerText = activeCue.content;
        } else {
            captionsText.innerText = '';
        }
    };

    ccBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        ccEnabled = !ccEnabled;
        ccBtn.classList.toggle('text-brand-light', ccEnabled);
        
        if (ccEnabled) {
            captionsOverlay.classList.remove('opacity-0');
            captionsOverlay.classList.add('opacity-100');
            
            if (!transcriptData && !isFetchingTranscript && cls.mediaId) {
                isFetchingTranscript = true;
                captionsText.innerText = 'Loading captions...';
                try {
                    const lessonIdFull = cls.lessonData?.lesson?.lesson?.id;
                    if (lessonIdFull) {
                        const res = await fetch(`https://echo360.org/api/ui/echoplayer/lessons/${lessonIdFull}/medias/${cls.mediaId}/transcript`);
                        const data = await res.json();
                        if (data?.data?.contentJSON?.cues) {
                            transcriptData = data.data.contentJSON.cues;
                            updateCaptions();
                        } else {
                            captionsText.innerText = 'No captions available.';
                            setTimeout(() => { if (ccEnabled && !transcriptData) captionsText.innerText = ''; }, 3000);
                        }
                    }
                } catch (err) {
                    console.error("[Echo360 Debug] Failed to fetch transcript:", err);
                    captionsText.innerText = 'Error loading captions.';
                    setTimeout(() => { if (ccEnabled && !transcriptData) captionsText.innerText = ''; }, 3000);
                } finally {
                    isFetchingTranscript = false;
                }
            } else {
                updateCaptions();
            }
        } else {
            captionsOverlay.classList.remove('opacity-100');
            captionsOverlay.classList.add('opacity-0');
            captionsText.innerText = '';
        }
    });

    const volSliderWrap = player.querySelector('[class*="group/vol"]');
    if (volSliderWrap) {
        const volSliderLine = volSliderWrap.querySelector('.w-16.h-1');
        const volFill = volSliderWrap.querySelector('.bg-brand-light.rounded');
        
        let isMuted = false;
        let lastVolume = parseFloat(localStorage.getItem('echo360_volume')) || 1;
        if (isNaN(lastVolume)) lastVolume = 1;
        let isDraggingVol = false;

        const setVolumeVisuals = (percentage) => {
            volFill.style.width = `${percentage * 100}%`;
            const vA = player.querySelector('.feed-audio');
            if (vA && (vA.src || vA.srcObject || vA.src !== "")) {
                vA.volume = percentage;
                v1.muted = true; // Ensure video feed doesn't echo
            } else {
                v1.volume = percentage;
            }
            if (percentage === 0) {
                isMuted = true;
                volIcon.setAttribute('data-lucide', 'volume-x');
            } else {
                isMuted = false;
                volIcon.setAttribute('data-lucide', 'volume-2');
            }
            localStorage.setItem('echo360_volume', percentage);
            lucide.createIcons({ root: player });
        };
        
        // Initialize volume
        setVolumeVisuals(lastVolume);

        const updateVolumeFromMouse = (e) => {
            const rect = volSliderLine.getBoundingClientRect();
            let percentage = (e.clientX - rect.left) / rect.width;
            percentage = Math.max(0, Math.min(1, percentage));
            if (percentage > 0) lastVolume = percentage;
            setVolumeVisuals(percentage);
        };

        volBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isMuted) setVolumeVisuals(lastVolume > 0 ? lastVolume : 1);
            else setVolumeVisuals(0);
        });

        volSliderWrap.addEventListener('mousedown', (e) => {
            if(e.target.closest('.w-0') || e.target === volSliderLine || volSliderLine.contains(e.target)) {
                isDraggingVol = true;
                updateVolumeFromMouse(e);
            }
        });

        document.addEventListener('mousemove', (e) => { if (isDraggingVol) updateVolumeFromMouse(e); });
        document.addEventListener('mouseup', () => { isDraggingVol = false; });
    }

    const progBar = player.querySelector('[class*="group/progress"]');
    if (progBar) {
        const progFill = progBar.querySelector('[class*="bg-brand-light w-0"]') || progBar.querySelector('.bg-brand-light');
        const timeSpan = player.querySelector('.tabular-nums');
        const hoverContainer = player.querySelector('.hover-thumbnail');
        const hoverImg = hoverContainer?.querySelector('img');
        const hoverTimeText = hoverContainer?.querySelector('.hover-time-text');
        
        let isDraggingProg = false;
        let isHovering = false;
        let initialSeekDone = false;

        const formatTime = (sec) => {
            if (isNaN(sec) || !isFinite(sec)) return "00:00";
            const m = Math.floor(sec / 60);
            const s = Math.floor(sec % 60);
            return `${m}:${s.toString().padStart(2, '0')}`;
        };

        v1.addEventListener('loadedmetadata', () => {
            if (!initialSeekDone && cls.progress > 0) {
                const targetTime = (cls.progress / 100) * v1.duration;
                v1.currentTime = targetTime;
                if (v2) v2.currentTime = targetTime;
                initialSeekDone = true;
            }
            timeSpan.innerText = `${formatTime(v1.currentTime)} / ${formatTime(v1.duration)}`;
        });

        v1.addEventListener('timeupdate', () => {
            if (!isDraggingProg && v1.duration) {
                const pct = (v1.currentTime / v1.duration) * 100;
                if(progFill) progFill.style.width = `${pct}%`;
                timeSpan.innerText = `${formatTime(v1.currentTime)} / ${formatTime(v1.duration)}`;        
                if (cls.mediaId) localStorage.setItem(`echo360_progress_${cls.mediaId}`, pct);
            }
            if (ccEnabled && transcriptData) {
                updateCaptions();
            }
        });
        const updateProgFromMouse = (e) => {
            const rect = progBar.getBoundingClientRect();
            let pct = (e.clientX - rect.left) / rect.width;
            pct = Math.max(0, Math.min(1, pct));
            if(progFill) progFill.style.width = `${pct * 100}%`;
            if (v1.duration) {
                v1.currentTime = pct * v1.duration;
                timeSpan.innerText = `${formatTime(v1.currentTime)} / ${formatTime(v1.duration)}`;
            }
        };

        progBar.addEventListener('mousedown', (e) => {
            isDraggingProg = true;
            updateProgFromMouse(e);
        });
        document.addEventListener('mousemove', (e) => { if (isDraggingProg) updateProgFromMouse(e); });
        document.addEventListener('mouseup', () => { isDraggingProg = false; });
        
        // Hover Thumbnail Peek Logic
        if (hoverContainer && hoverImg && hoverTimeText) {
            progBar.addEventListener('mouseenter', () => { isHovering = true; hoverContainer.classList.remove('hidden'); hoverContainer.classList.add('flex'); });
            progBar.addEventListener('mouseleave', () => { isHovering = false; hoverContainer.classList.add('hidden'); hoverContainer.classList.remove('flex'); });
            
            progBar.addEventListener('mousemove', (e) => {
                if (!v1.duration) return;
                const rect = progBar.getBoundingClientRect();
                let pct = (e.clientX - rect.left) / rect.width;
                pct = Math.max(0, Math.min(1, pct));
                
                let hoverSeconds = Math.floor(pct * v1.duration);
                // Snap to nearest 60 for Echo360 thumbnails API (0, 60, 120, etc.)
                const snappedSeconds = Math.max(0, Math.floor(hoverSeconds / 60) * 60);
                
                hoverTimeText.innerText = formatTime(hoverSeconds);
                
                // Keep the popover clamped within the player bounds
                let pxOffset = e.clientX - rect.left;
                const popoverHalfWidth = 64; // w-32 is 128px
                if (pxOffset < popoverHalfWidth) pxOffset = popoverHalfWidth;
                if (pxOffset > rect.width - popoverHalfWidth) pxOffset = rect.width - popoverHalfWidth;
                
                hoverContainer.style.left = `${pxOffset}px`;
                
                // Update image src using snapped seconds
                if (cls.mediaId && cls.instId) {
                    hoverImg.src = `https://thumbnails.echo360.org/0000.${cls.instId}/${cls.mediaId}/1/thumbnails1/${snappedSeconds}.jpg`;
                }
            });
        }
    }

    const skipBackBtn = player.querySelector('.skip-back');
    if (skipBackBtn) {
        skipBackBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (v1.duration) v1.currentTime = Math.max(0, v1.currentTime - 10);
        });
    }

    const skipForwardBtn = player.querySelector('.skip-forward');
    if (skipForwardBtn) {
        skipForwardBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (v1.duration) v1.currentTime = Math.min(v1.duration, v1.currentTime + 10);
        });
    }

    const speedBtns = player.querySelectorAll('.speed-opt');
    const mainSpeedBtnText = player.querySelector('.speed-btn span');
    const customSpeedInput = player.querySelector('.custom-speed-input');
    const customSpeedApply = player.querySelector('.custom-speed-apply');

    customSpeedInput.addEventListener('click', (e) => e.stopPropagation());

    const setSpeed = (text, val) => {
        speedBtns.forEach(b => {
            if (b.textContent.trim() === text) b.classList.add('text-brand-light');
            else b.classList.remove('text-brand-light');
        });
        mainSpeedBtnText.innerText = text;
        v1.playbackRate = val;
        v2.playbackRate = val;
        const vA = player.querySelector('.feed-audio');
        if (vA) vA.playbackRate = val;
        localStorage.setItem('echo360_speed', val);
        closePopups();
    };

    let savedSpeed = parseFloat(localStorage.getItem('echo360_speed')) || 1;
    if (isNaN(savedSpeed)) savedSpeed = 1;
    setSpeed(`${savedSpeed}x`, savedSpeed);

    speedBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = btn.textContent.trim();
            const val = parseFloat(text.replace('x',''));
            setSpeed(text, val);
        });
    });

    customSpeedApply.addEventListener('click', (e) => {
        e.stopPropagation();
        let val = parseFloat(customSpeedInput.value);
        if (!isNaN(val) && val > 0) setSpeed(`${val}x`, val);
    });
    
    const pipBtn = player.querySelector('.pip-btn');
    if (pipBtn) {
        pipBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                const resolved = await resolveVideoUrl(cls.lessonData, window.EchoContext.hostname, cls.mediaId);
                if (resolved && resolved.urls) {
                    if (isPlaying) togglePlay(); // pause main player
                    const extUrl = chrome.runtime.getURL(`stream/stream.html?urls=${encodeURIComponent(JSON.stringify(resolved.urls))}`);
                    window.open(extUrl, `Echo360_PIP_${cls.mediaId}`, 'width=800,height=450,popup=yes');
                }
            } catch (err) {
                console.error("Failed to open PIP:", err);
                if (typeof window.showToast === 'function') window.showToast("Failed to open Pop Out player");
            }
        });
    }
    maxBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!document.fullscreenElement) {
            if (player.requestFullscreen) {
                player.requestFullscreen().catch(err => console.warn(err));
            }
        } else {
            document.exitFullscreen();
        }
    });

    document.addEventListener('fullscreenchange', () => {
        const isFs = document.fullscreenElement === player;
        if (isFs) {
            player.classList.add('justify-center', 'items-center');
            player.classList.remove('pb-16', 'rounded-lg');
            
            // Mathematically constrain the video area so it perfectly hugs the video stream
            // without overflowing the monitor, allowing PIP percentages to scale flawlessly.
            videoArea.style.maxHeight = '100vh';
            videoArea.style.margin = '0 auto';
            if (feed2.classList.contains('absolute')) {
                videoArea.style.maxWidth = 'calc(100vh * (16 / 9))'; // PIP mode (16:9)
            } else {
                videoArea.style.maxWidth = 'calc(100vh * (32 / 9))'; // SBS mode (32:9)
            }
        } else {
            player.classList.remove('justify-center', 'items-center');
            player.classList.add('pb-16', 'rounded-lg');
            
            videoArea.style.maxHeight = '';
            videoArea.style.maxWidth = '';
            videoArea.style.margin = '';
        }
    });

    ccBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        ccBtn.classList.toggle('text-brand-light');
    });

    const optSbs = player.querySelector('.opt-sbs');
    const optPip = player.querySelector('.opt-pip');
    const feed1 = player.querySelector('.feed-1');
    const feed2 = player.querySelector('.feed-2');
    const resizer = player.querySelector('.resizer');

    let isSwapped = false;
    swapBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isSwapped = !isSwapped;
        if (isSwapped) {
            feed1.appendChild(v2);
            feed2.appendChild(v1);
        } else {
            feed1.appendChild(v1);
            feed2.appendChild(v2);
        }
    });

    let isDraggingPIP = false;
    let hasMovedDuringDrag = false;
    let dragStartX, dragStartY, initialLeft, initialTop;
    let activeDragFeed = null;
    
    const onPipDrag = (e) => {
        if (!isDraggingPIP || !activeDragFeed) return;
        hasMovedDuringDrag = true;
        requestAnimationFrame(() => {
            const bounds = videoArea.getBoundingClientRect();
            let newLeft = initialLeft + (e.clientX - dragStartX);
            let newTop = initialTop + (e.clientY - dragStartY);
            newLeft = Math.max(0, Math.min(newLeft, bounds.width - activeDragFeed.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, bounds.height - activeDragFeed.offsetHeight));
            
            let leftPct = (newLeft / bounds.width) * 100;
            let topPct = (newTop / bounds.height) * 100;
            
            activeDragFeed.style.left = `${leftPct}%`;
            activeDragFeed.style.top = `${topPct}%`;
            activeDragFeed.style.right = 'auto';
            activeDragFeed.style.bottom = 'auto';
        });
    };
    const onPipDragEnd = () => {
        isDraggingPIP = false;
        document.removeEventListener('mousemove', onPipDrag);
        document.removeEventListener('mouseup', onPipDragEnd);
    };
    const initPipDrag = (e) => {
        const feed = e.currentTarget;
        const rect = feed.getBoundingClientRect();
        if (e.clientX - rect.left > rect.width - 25 && e.clientY - rect.top > rect.height - 25) return;
        isDraggingPIP = true;
        hasMovedDuringDrag = false;
        activeDragFeed = feed;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        initialLeft = feed.offsetLeft;
        initialTop = feed.offsetTop;
        document.addEventListener('mousemove', onPipDrag);
        document.addEventListener('mouseup', onPipDragEnd);
    };

    optPip.addEventListener('click', (e) => {
        e.stopPropagation();
        closePopups();
        resizer.classList.add('hidden');
        
        // Ensure videoArea maintains a minimum height so it doesn't collapse
        videoArea.classList.add('min-h-[400px]', 'aspect-video');
        
        feed1.className = 'feed-1 absolute inset-0 w-full h-full bg-black z-0';
        feed1.style.width = '100%';
        feed2.className = 'feed-2 absolute bottom-4 right-4 w-1/4 min-w-[150px] aspect-video bg-black border border-gray-600 rounded-lg shadow-2xl z-10 overflow-hidden resize hover:ring-2 hover:ring-brand-light cursor-move';
        feed2.style.width = '25%';
        feed2.style.height = 'auto';
        feed2.addEventListener('mousedown', initPipDrag);
        
        // Show N-extra feeds
        player.querySelectorAll('.extra-feed').forEach(feed => feed.style.display = 'flex');

        optSbs.classList.remove('text-brand-light');
        optPip.classList.add('text-brand-light');
    });

    optSbs.addEventListener('click', (e) => {
        e.stopPropagation();
        closePopups();
        resizer.classList.remove('hidden');
        feed1.className = 'feed-1 flex flex-col relative bg-gray-900 border-r border-black z-0' + (document.fullscreenElement ? '' : ' aspect-video');
        feed1.style.width = '50%';
        feed2.className = 'feed-2 flex flex-col relative bg-gray-900 z-0' + (document.fullscreenElement ? '' : ' aspect-video');
        feed2.style.width = '50%';
        feed2.style.height = '100%';
        feed2.style.left = ''; feed2.style.top = ''; feed2.style.right = ''; feed2.style.bottom = '';
        feed2.removeEventListener('mousedown', initPipDrag);
        
        // Hide N-extra feeds
        player.querySelectorAll('.extra-feed').forEach(feed => feed.style.display = 'none');

        optPip.classList.remove('text-brand-light');
        optSbs.classList.add('text-brand-light');
    });

    let isResizingSplit = false;
    let splitAnimationFrame;
    resizer.addEventListener('mousedown', (e) => {
        isResizingSplit = true;
        player.classList.add('select-none');
        const onSplitDrag = (e) => {
            if (!isResizingSplit) return;
            if (splitAnimationFrame) cancelAnimationFrame(splitAnimationFrame);
            splitAnimationFrame = requestAnimationFrame(() => {
                const rect = videoArea.getBoundingClientRect();
                let percentage = ((e.clientX - rect.left) / rect.width) * 100;
                percentage = Math.max(15, Math.min(percentage, 85));
                feed1.style.width = `${percentage}%`;
                feed2.style.width = `${100 - percentage}%`;
            });
        };
        const onSplitEnd = () => {
            isResizingSplit = false;
            player.classList.remove('select-none');
            document.removeEventListener('mousemove', onSplitDrag);
            document.removeEventListener('mouseup', onSplitEnd);
            if (splitAnimationFrame) cancelAnimationFrame(splitAnimationFrame);
        };
        document.addEventListener('mousemove', onSplitDrag);
        document.addEventListener('mouseup', onSplitEnd);
    });
};
;

        
window.getPlayerHTML = getPlayerHTML;
window.initEchoPlayer = initEchoPlayer;
