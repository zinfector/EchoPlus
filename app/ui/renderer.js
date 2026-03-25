import { state } from '../store.js';\n\nexport function getGridDropdownHTML(cls, clsId, clickedIndex) {
            try {
                return `
                    <div class="flex items-center justify-between mb-6 border-b border-gray-200 dark:border-gray-800 pb-4">
                        <div>
                            <h4 class="text-2xl font-bold text-gray-800 dark:text-gray-100">${cls.title}</h4>
                            <p class="text-sm text-gray-400 dark:text-gray-400 mt-1">${cls.date} &middot; ${cls.time}</p>
                        </div>
                        <button data-action="toggleDropdownGrid" data-id="${clsId}" data-index="${clickedIndex}" class="text-gray-400 hover:text-brand-light transition-colors focus:outline-none"><i data-lucide="x" class="w-6 h-6"></i></button>
                    </div>
                    ${cls.hasVideo ? getPlayerHTML(cls) : `<div class="text-center text-sm text-gray-500 py-16 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">No video recording available for this session.</div>`}
                    
                    <div class="mt-8 border-t border-gray-200 dark:border-gray-800 pt-6">
                        <div class="flex items-center space-x-2 mb-4">
                            <i data-lucide="message-square" class="w-5 h-5 text-brand-light dark:text-brand-dark"></i>
                            <h3 class="text-lg font-bold text-gray-800 dark:text-gray-200">Class Q&A</h3>
                        </div>
                        <div class="qa-section-container" data-lesson-id="${cls.lessonData?.lesson?.lesson?.id || clsId}">
                            ${generateQAHTML(cls.lessonData?.lesson?.lesson?.id || clsId)}
                        </div>
                    </div>
                `;
            } catch (err) {
                console.error("[Echo360 Debug] Error generating player HTML:", err);
                return `<div class="text-red-500">Error generating player: ${err.message}</div>`;
            }
        }

        export function renderClasses() {
            const container = document.getElementById('classList');
            container.innerHTML = '';

            if (window.EchoState.classData.length === 0) {
                container.className = "border-t border-gray-200 dark:border-gray-800 theme-transition";   
                container.innerHTML = `<div class="py-16 text-center text-gray-500 dark:text-gray-400 animate-pulse">Loading classes...</div>`;
                return;
            }

            let filteredData = window.EchoState.classData.filter(cls =>
                cls.title.toLowerCase().includes(window.EchoState.searchQuery) ||
                cls.date.toLowerCase().includes(window.EchoState.searchQuery) ||
                cls.time.toLowerCase().includes(window.EchoState.searchQuery)
            );

            // Apply sorting
            filteredData.sort((a, b) => {
                const dateA = new Date(a.lessonData?.lesson?.startTimeUTC || 0);
                const dateB = new Date(b.lessonData?.lesson?.startTimeUTC || 0);
                const durA = a.lessonData?.lesson?.duration || 0;
                const durB = b.lessonData?.lesson?.duration || 0;

                switch (window.EchoState.sortMode) {
                    case 'newest': return dateB - dateA;
                    case 'oldest': return dateA - dateB;
                    case 'most_qs': return b.qs - a.qs;
                    case 'least_qs': return a.qs - b.qs;
                    case 'longest': return durB - durA;
                    case 'shortest': return durA - durB;
                    case 'custom':
                    default: return 0; // Default Echo360 array order
                }
            });
            if (filteredData.length === 0) {
                container.className = "border-t border-gray-200 dark:border-gray-800 theme-transition";
                container.innerHTML = `<div class="py-16 text-center text-gray-500 dark:text-gray-400">No classes match your search.</div>`;
                return;
            }

            if (window.EchoState.currentLayout === 'list') {
                container.className = "flex flex-col border-t border-gray-200 dark:border-gray-800 theme-transition pb-20";
            } else {
                container.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pt-4 border-t border-gray-200 dark:border-gray-800 theme-transition items-start pb-20";
            }

            filteredData.forEach((cls) => {
                const titleColorClass = cls.special ? 'text-gray-900 dark:text-gray-100 opacity-60' : 'text-gray-800 dark:text-gray-200';
                const qaBadge = `<span class="ml-1 text-xs text-gray-800 dark:text-gray-300 font-bold">${cls.qs}</span>`;
                const imgSrc = cls.thumbnail || `https://picsum.photos/seed/echo${cls.id}/320/180`;
                const isSelected = window.EchoState.selectedClasses.has(cls.id);

                const row = document.createElement('div');

                if (window.EchoState.currentLayout === 'list') {
                    row.className = `theme-transition border-b border-gray-200 dark:border-gray-800 group hover:bg-[#f2f9fa] dark:hover:bg-gray-800/60`;

                const progressHtml = cls.progress > 0
                    ? `<div class="absolute bottom-0 left-0 h-1 bg-brand-light z-20" style="width: ${cls.progress}%"></div>`
                    : '';

                let thumbnailHtml;
                if (cls.isFuture) {
                    thumbnailHtml = `<div class="w-20 h-11 bg-gray-100 dark:bg-gray-800 rounded flex flex-col items-center justify-center flex-shrink-0 shadow-sm border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500"><i data-lucide="calendar-clock" class="w-4 h-4 mb-0.5"></i><span class="text-[6px] font-bold uppercase tracking-wider">Future</span></div>`;
                } else if (cls.hasVideo) {
                    thumbnailHtml = `<div class="relative w-20 h-11 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0 shadow-sm"><img src="${imgSrc}" crossorigin="anonymous" class="object-cover w-full h-full" alt="Thumbnail"><div class="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors z-10"></div>${progressHtml}</div>`;
                } else {
                    thumbnailHtml = `<div class="w-20 h-11 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-200 dark:border-gray-700"><i data-lucide="video-off" class="w-4 h-4 text-gray-400"></i></div>`;
                }

                const checkboxHtml = cls.hasVideo ? `<div class="class-checkbox-container flex items-center justify-center" ><input type="checkbox" class="class-checkbox w-4 h-4 text-brand-light border-gray-300 rounded focus:ring-brand-light cursor-pointer" value="${cls.id}" ${isSelected ? 'checked' : ''} data-action="toggleSelection" data-id="${cls.id}"></div>` : `<div class="class-checkbox-container"></div>`;

                row.innerHTML = `
                        <div class="flex items-center justify-between py-3 px-2 cursor-pointer transition-colors" data-action="toggleDropdown" data-id="${cls.id}">
                            <div class="flex flex-1 items-center">
                                ${checkboxHtml}
                                <div class="flex items-center space-x-4">
                                    ${thumbnailHtml}
                                    <h3 class="text-sm font-medium ${titleColorClass} theme-transition">${cls.title}</h3>
                                </div>
                            </div>
                            <div class="flex items-center space-x-4 md:space-x-6">
                                <div class="hidden md:flex items-center space-x-2 text-[13px] text-gray-500 dark:text-gray-400 theme-transition w-64 justify-end"><span>${cls.date}</span><span>${cls.time}</span></div>
                                <div class="flex items-center w-12 justify-center border-l border-gray-200 dark:border-gray-700 pl-4 h-6"><i data-lucide="message-square" class="w-4 h-4 text-gray-400 dark:text-gray-500"></i>${qaBadge}</div>
                                <div class="flex items-center space-x-2 w-16 justify-end border-l border-gray-200 dark:border-gray-700 pl-4 h-6">
                                    ${cls.hasVideo ? `<button data-action="handleDownload" data-id="${cls.id}" class="text-gray-400 hover:text-brand-light dark:hover:text-brand-dark transition-colors focus:outline-none opacity-0 group-hover:opacity-100 list-action" title="Download"><i data-lucide="download" class="w-4 h-4"></i></button>` : `<div class="w-4 h-4"></div>`}
                                    <div class="text-gray-400 transition-transform duration-300"><i data-lucide="chevron-down" id="list-icon-${cls.id}" class="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity list-icon"></i></div>
                                </div>
                            </div>
                        </div>
                        <div id="list-video-${cls.id}" class="dropdown-grid">
                            <div class="dropdown-inner theme-transition bg-gray-50 dark:bg-gray-800/30">  
                                <div class="list-dropdown-wrap border-t border-transparent transition-colors duration-300">
                                    <div class="py-6 w-full">
                                        ${cls.hasVideo ? getPlayerHTML(cls) : `<div class="text-center text-sm text-gray-500 py-8">No video recording available for this class.</div>`}
                                        
                                        <div class="mt-8 border-t border-gray-200 dark:border-gray-800 pt-6">
                                            <div class="flex items-center space-x-2 mb-4">
                                                <i data-lucide="message-square" class="w-5 h-5 text-brand-light dark:text-brand-dark"></i>
                                                <h3 class="text-lg font-bold text-gray-800 dark:text-gray-200">Class Q&A</h3>
                                            </div>
                                            <div class="qa-section-container" data-lesson-id="${cls.lessonData?.lesson?.lesson?.id || cls.id}">
                                                ${generateQAHTML(cls.lessonData?.lesson?.lesson?.id || cls.id)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    row.className = `grid-card theme-transition bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden group hover:shadow-md dark:hover:border-gray-600 flex flex-col h-full cursor-pointer relative`;
                row.setAttribute('data-action', 'toggleDropdown');
                row.setAttribute('data-id', cls.id);

                const progressHtml = cls.progress > 0
                    ? `<div class="absolute bottom-0 left-0 h-1.5 bg-brand-light z-20" style="width: ${cls.progress}%"></div>`
                    : '';

                const checkboxHtml = cls.hasVideo ? `<div class="grid-checkbox-container absolute top-2 left-2 z-30 bg-white/70 dark:bg-gray-900/70 rounded flex items-center justify-center w-7 h-7 backdrop-blur-sm shadow-sm" ><input type="checkbox" class="class-checkbox w-4 h-4 text-brand-light border-gray-300 rounded focus:ring-brand-light cursor-pointer" value="${cls.id}" ${isSelected ? 'checked' : ''} data-action="toggleSelection" data-id="${cls.id}"></div>` : '';

                let thumbnailHtml;
                if (cls.isFuture) {
                    thumbnailHtml = `<div class="w-full h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded shadow-sm border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500"><i data-lucide="calendar-clock" class="w-6 h-6 mb-1"></i><span class="text-[10px] font-bold uppercase tracking-wider">Future Stream</span></div>`;
                } else if (cls.hasVideo) {
                    thumbnailHtml = `${checkboxHtml}<img src="${imgSrc}" crossorigin="anonymous" class="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-500" alt="Thumbnail"><div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center z-10"><div class="w-12 h-12 rounded-full bg-brand-light/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 shadow-lg pointer-events-none"><i data-lucide="play" class="w-5 h-5 ml-1"></i></div></div>${progressHtml}`;
                } else {
                    thumbnailHtml = `<div class="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700/50"><i data-lucide="video-off" class="w-8 h-8 text-gray-300 dark:text-gray-500"></i></div>`;
                }

                row.innerHTML = `                        <div class="relative w-full aspect-video bg-gray-200 dark:bg-gray-700 overflow-hidden border-b border-gray-100 dark:border-gray-800">${thumbnailHtml}</div>
                        <div class="p-4 flex flex-col flex-1">
                            <h3 class="text-sm font-semibold ${titleColorClass} theme-transition line-clamp-2 mb-1">${cls.title}</h3>
                            <div class="text-[11px] text-gray-500 dark:text-gray-400 theme-transition mb-4"><p>${cls.date}</p><p class="mt-0.5">${cls.time}</p></div>
                            <div class="mt-auto flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700/50">
                                <div class="flex items-center text-gray-500 dark:text-gray-400 text-xs"><i data-lucide="message-square" class="w-4 h-4 mr-1"></i>${qaBadge}</div>
                                <div class="flex items-center space-x-3 text-gray-400">
                                    ${cls.hasVideo ? `<button data-action="handleDownload" data-id="${cls.id}" class="hover:text-brand-light dark:hover:text-brand-dark transition-colors focus:outline-none grid-action" title="Download"><i data-lucide="download" class="w-4 h-4"></i></button>` : ``}
                                    <div><i data-lucide="chevron-down" id="grid-icon-${cls.id}" class="w-4 h-4 transition-transform duration-300 grid-icon"></i></div>
                                </div>
                            </div>
                        </div>
                        <div id="active-arrow-${cls.id}" class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gray-50 dark:bg-gray-900 border-l border-t border-gray-200 dark:border-gray-700 rotate-45 opacity-0 transition-opacity z-20"></div>
                    `;
                }

                container.appendChild(row);
            });

            if (window.EchoState.currentLayout === 'grid') {
                const globalPlayer = document.createElement('div');
                globalPlayer.id = 'global-grid-dropdown';
                globalPlayer.className = 'col-span-full dropdown-grid';
                container.appendChild(globalPlayer);
            }
            
            lucide.createIcons();
            
            // Re-apply selection mode class if active
            if (window.EchoState.isSelectionMode) {
                container.classList.add('selection-mode');
            }
            
            updateSelectionUI();
        }

        export function toggleDropdown(e, clsId, element) {
            console.log(`[Echo360 Debug] toggleDropdown called with clsId: ${clsId}`, element);
            if (e && (e.target.closest('.list-action') || e.target.closest('.grid-action') || window.EchoState.isSelectionMode)) {
                // If in selection mode, clicking the row should ideally toggle the checkbox instead of opening the video
                if (window.EchoState.isSelectionMode && e.target.closest('.cursor-pointer')) {
                    const cb = element.querySelector('.class-checkbox');
                    if (cb) {
                        cb.checked = !cb.checked;
                        toggleSelection(clsId);
                    }
                }
                return;
            }

            if (window.EchoState.currentLayout === 'list') {
                const dropdownId = `list-video-${clsId}`;
                const iconId = `list-icon-${clsId}`;
                const dropdown = document.getElementById(dropdownId);
                const icon = document.getElementById(iconId);
                const isOpen = dropdown.classList.contains('open');
                
                document.querySelectorAll('.dropdown-grid.open').forEach(el => {
                    if (el.id !== dropdownId) {
                        el.classList.remove('open');
                        const inner = el.querySelector('.list-dropdown-wrap');
                        if (inner) {
                            inner.classList.remove('border-gray-200', 'dark:border-gray-700');
                            inner.classList.add('border-transparent');
                        }
                    }
                });
                document.querySelectorAll('.list-icon').forEach(el => {
                    if (el.id !== iconId) {
                        el.classList.remove('rotate-180', 'opacity-100');
                        el.classList.add('opacity-0', 'group-hover:opacity-100');
                    }
                });

                if (!isOpen) {
                    dropdown.classList.add('open');
                    icon.classList.add('rotate-180', 'opacity-100');
                    icon.classList.remove('opacity-0', 'group-hover:opacity-100');
                    dropdown.querySelector('.list-dropdown-wrap').classList.replace('border-transparent', 'border-gray-200');
                    dropdown.querySelector('.list-dropdown-wrap').classList.add('dark:border-gray-700');
                    
                    const playerEl = dropdown.querySelector('.echo-player');
                    if (playerEl) window.initEchoPlayer(playerEl);
                } else {
                    dropdown.classList.remove('open');
                    icon.classList.remove('rotate-180', 'opacity-100');
                    icon.classList.add('opacity-0', 'group-hover:opacity-100');
                    dropdown.querySelector('.list-dropdown-wrap').classList.replace('border-gray-200', 'border-transparent');
                    dropdown.querySelector('.list-dropdown-wrap').classList.remove('dark:border-gray-700');
                }

            } else {
                const globalDropdown = document.getElementById('global-grid-dropdown');
                const icon = document.getElementById(`grid-icon-${clsId}`);
                const arrow = document.getElementById(`active-arrow-${clsId}`);
                const isOpen = globalDropdown.classList.contains('open') && window.EchoState.activeGridId === clsId;

                const allCards = Array.from(document.querySelectorAll('.grid-card'));
                const clickedIndex = allCards.indexOf(element);
                let insertAfterIndex = clickedIndex;
                const topPos = element.offsetTop;

                for (let i = clickedIndex + 1; i < allCards.length; i++) {
                    if (allCards[i].offsetTop > topPos) break;
                    insertAfterIndex = i;
                }

                const cls = window.EchoState.classData.find(c => c.id === clsId);
                const isSameRow = (globalDropdown.classList.contains('open') && window.EchoState.activeGridId !== null && globalDropdown.previousElementSibling === allCards[insertAfterIndex]);

                if (isOpen) {
                    globalDropdown.classList.remove('open');
                    document.querySelectorAll('.grid-icon').forEach(el => el.classList.remove('rotate-180', 'text-brand-light', 'dark:text-brand-dark'));
                    document.querySelectorAll('.grid-card').forEach(el => el.classList.remove('ring-2', 'ring-brand-light', 'dark:ring-brand-dark', 'border-transparent'));
                    document.querySelectorAll('[id^="active-arrow-"]').forEach(el => el.classList.replace('opacity-100', 'opacity-0'));
                    window.EchoState.activeGridId = null;
                    window.EchoState.activeGridIndex = -1;
                } else if (isSameRow) {
                    const viewport = globalDropdown.querySelector('.slider-viewport');
                    const oldPane = viewport.querySelector('.slider-pane.active');
                    const isMovingRight = clickedIndex > window.EchoState.activeGridIndex;
                    
                    const newPane = document.createElement('div');
                    newPane.className = `slider-pane p-6 md:p-8 ${isMovingRight ? 'next-right' : 'next-left'}`;
                    newPane.innerHTML = getGridDropdownHTML(cls, clsId, clickedIndex);
                    
                    viewport.appendChild(newPane);
                    lucide.createIcons();
                    
                    // Initialize the new player
                    window.initEchoPlayer(newPane.querySelector('.echo-player'));
                    
                    document.querySelectorAll('.grid-icon').forEach(el => el.classList.remove('rotate-180', 'text-brand-light', 'dark:text-brand-dark'));
                    document.querySelectorAll('.grid-card').forEach(el => el.classList.remove('ring-2', 'ring-brand-light', 'dark:ring-brand-dark', 'border-transparent'));
                    document.querySelectorAll('[id^="active-arrow-"]').forEach(el => el.classList.replace('opacity-100', 'opacity-0'));
                    
                    icon.classList.add('rotate-180', 'text-brand-light', 'dark:text-brand-dark');
                    element.classList.add('ring-2', 'ring-brand-light', 'dark:ring-brand-dark', 'border-transparent');
                    arrow.classList.replace('opacity-0', 'opacity-100');

                    void viewport.offsetWidth; 

                    oldPane.classList.add(isMovingRight ? 'slide-out-left' : 'slide-out-right');
                    oldPane.classList.remove('active');
                    
                    newPane.classList.remove('next-right', 'next-left');
                    newPane.classList.add('active');

                    window.EchoState.activeGridId = clsId;
                    window.EchoState.activeGridIndex = clickedIndex;

                    setTimeout(() => { if (oldPane && oldPane.parentNode) oldPane.remove(); }, 500);

                } else if (!isOpen) {
                    globalDropdown.classList.remove('open');

                    document.querySelectorAll('.grid-icon').forEach(el => el.classList.remove('rotate-180', 'text-brand-light', 'dark:text-brand-dark'));
                    document.querySelectorAll('.grid-card').forEach(el => el.classList.remove('ring-2', 'ring-brand-light', 'dark:ring-brand-dark', 'border-transparent'));
                    document.querySelectorAll('[id^="active-arrow-"]').forEach(el => el.classList.replace('opacity-100', 'opacity-0'));

                    globalDropdown.innerHTML = `
                        <div class="dropdown-inner w-full relative">
                            <div class="py-4 px-1">
                                <div class="slider-viewport bg-gray-50 dark:bg-gray-900 theme-transition w-full rounded-xl border border-gray-200 dark:border-gray-700 shadow-inner">
                                    <div class="slider-pane active p-6 md:p-8">
                                        ${getGridDropdownHTML(cls, clsId, clickedIndex)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;

                    allCards[insertAfterIndex].after(globalDropdown);
                    lucide.createIcons();
                    
                    // Initialize newly injected grid player
                    window.initEchoPlayer(globalDropdown.querySelector('.echo-player'));
                    
                    void globalDropdown.offsetWidth;
                    
                    globalDropdown.classList.add('open');
                    icon.classList.add('rotate-180', 'text-brand-light', 'dark:text-brand-dark');
                    element.classList.add('ring-2', 'ring-brand-light', 'dark:ring-brand-dark', 'border-transparent');
                    arrow.classList.replace('opacity-0', 'opacity-100');
                    
                    window.EchoState.activeGridId = clsId;
                    window.EchoState.activeGridIndex = clickedIndex;
                } else {
                    globalDropdown.classList.remove('open');
                    document.querySelectorAll('.grid-icon').forEach(el => el.classList.remove('rotate-180', 'text-brand-light', 'dark:text-brand-dark'));
                    document.querySelectorAll('.grid-card').forEach(el => el.classList.remove('ring-2', 'ring-brand-light', 'dark:ring-brand-dark', 'border-transparent'));
                    document.querySelectorAll('[id^="active-arrow-"]').forEach(el => el.classList.replace('opacity-100', 'opacity-0'));
                    window.EchoState.activeGridId = null;
                    window.EchoState.activeGridIndex = -1;
                }
            }
        }

        window.addEventListener('resize', () => {
            if (window.EchoState.currentLayout === 'grid' && window.EchoState.activeGridId !== null) {
                const globalDropdown = document.getElementById('global-grid-dropdown');
                if (globalDropdown && globalDropdown.classList.contains('open')) {
                    globalDropdown.classList.remove('open');
                    document.querySelectorAll('.grid-icon').forEach(el => el.classList.remove('rotate-180', 'text-brand-light', 'dark:text-brand-dark'));
                    document.querySelectorAll('.grid-card').forEach(el => el.classList.remove('ring-2', 'ring-brand-light', 'dark:ring-brand-dark', 'border-transparent'));
                    document.querySelectorAll('[id^="active-arrow-"]').forEach(el => el.classList.replace('opacity-100', 'opacity-0'));
                    window.EchoState.activeGridId = null;
                    window.EchoState.activeGridIndex = -1;
                }
            }
        });

        renderClasses();
    
window.addEventListener('error', function(event) {
    console.error("[Echo360 GLOBAL ERROR]", event.message, event.error?.stack);
});
window.addEventListener('unhandledrejection', function(event) {
    console.error("[Echo360 PROMISE REJECTION]", event.reason?.stack || event.reason);
});

\nwindow.getGridDropdownHTML = getGridDropdownHTML;\nwindow.renderClasses = renderClasses;\nwindow.toggleDropdown = toggleDropdown;\n