import { state } from '../store.js';\n\nexport function handleSearch(query) {
            window.EchoState.searchQuery = query.toLowerCase();
            if (window.EchoState.activeGridId !== null) {
                const globalDropdown = document.getElementById('global-grid-dropdown');
                if(globalDropdown) globalDropdown.classList.remove('open');
                window.EchoState.activeGridId = null;
                window.EchoState.activeGridIndex = -1;
            }
            
            // Clear selection on search
            window.EchoState.selectedClasses.clear();
            updateSelectionUI();

            renderClasses();
        }

        // --- Transcript Search Logic ---
        let window.EchoState.searchData = [];
        
        export async function executeSearch(query) {
            const stats = document.getElementById('searchStats');
            const searchList = document.getElementById('searchList');
            
            if (!query || query.trim() === '') return;
            
            stats.innerHTML = `<span class="animate-pulse">Searching transcripts...</span>`;
            searchList.innerHTML = '';
            
            try {
                const res = await fetch(`https://echo360.org/section/${window.EchoContext.sectionId}/search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        contentType: "Transcription",
                        searchText: query,
                        pageNumber: 0
                    })
                });
                
                const data = await res.json();
                console.log("[Echo360 Debug] Search Response:", data);

                const docs = data.docs || (data.data && data.data.length > 0 ? data.data[0].docs : null) || [];

                if (docs && docs.length > 0) {
                    console.log(`[Echo360 Debug] Search Docs Found: ${docs.length}`);

                    stats.innerText = `Found ${docs.length} matches across ${new Set(docs.map(d => d.lesson?.id || d.media?.id)).size} lessons.`;

                    // Group by lesson
                    const grouped = {};
                    docs.forEach(doc => {
                        const lId = doc.lesson?.id || doc.media?.id || 'unknown';
                        if (!grouped[lId]) grouped[lId] = [];
                        grouped[lId].push(doc);
                    });                    
                    Object.keys(grouped).forEach(lessonId => {
                        const lessonDocs = grouped[lessonId];
                        // Find matching class
                        // Note: docs.lesson.id is the long ID. window.EchoState.classData[i].id might be the short ID or long ID.
                        // We'll search by matching any part of the ID just in case.
                        const cls = window.EchoState.classData.find(c => lessonId.includes(c.id) || c.id.includes(lessonId)) || {
                            id: lessonId,
                            title: lessonDocs[0].lesson.name,
                            hasVideo: true,
                            mediaId: lessonDocs[0].media.id,
                            lessonData: { lesson: { lesson: { id: lessonId } } }
                        };
                        
                        // We only support searching videos for now
                        if (!cls.hasVideo) return;
                        
                        const container = document.createElement('div');
                        container.className = 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-lg flex flex-col xl:flex-row';
                        
                        // Left: Video Player
                        const playerContainer = document.createElement('div');
                        playerContainer.className = 'w-full xl:w-2/3 p-4 border-b xl:border-b-0 xl:border-r border-gray-200 dark:border-gray-700 relative';
                        
                        // Pre-calculate anchor points
                        const durationStr = lessonDocs[0].media?.duration || "00:00:00"; // HH:MM:SS
                        const durParts = durationStr.split(':').map(Number);
                        const durationSec = (durParts[0] || 0) * 3600 + (durParts[1] || 0) * 60 + (durParts[2] || 0);
                        
                        playerContainer.innerHTML = `
                            <h3 class="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">${cls.title}</h3>
                            ${getPlayerHTML(cls)}
                        `;
                        
                        // Right: Excerpts
                        const excerptsContainer = document.createElement('div');
                        excerptsContainer.className = 'w-full xl:w-1/3 flex flex-col max-h-[600px] overflow-y-auto custom-scrollbar p-4 space-y-3 bg-white dark:bg-gray-900/50';
                        
                        lessonDocs.forEach(doc => {
                            const sec = Math.floor(doc.cueStartTime / 1000);
                            const min = Math.floor(sec / 60);
                            const s = Math.floor(sec % 60);
                            const timeStr = `${min}:${s.toString().padStart(2, '0')}`;
                            
                            const instId = lessonDocs[0].media?.media?.current?.primaryThumbnails?.baseUrl?.match(/0000\.([^\/]+)/)?.[1] || cls.instId;
                            // Thumbnails are snapped to 60s
                            const snappedSeconds = Math.floor(sec / 60) * 60;
                            const thumbUrl = (cls.mediaId && instId) ? `https://thumbnails.echo360.org/0000.${instId}/${cls.mediaId}/1/thumbnails1/${snappedSeconds}.jpg` : cls.thumbnail;
                            
                            let docText = "";
                            try {
                                if (doc.text) docText = Array.isArray(doc.text) ? doc.text[0] : doc.text;
                                if (!docText && doc.document && doc.document.text) docText = Array.isArray(doc.document.text) ? doc.document.text[0] : doc.document.text;
                                if (!docText && doc.document && doc.document.obj) docText = JSON.parse(doc.document.obj).text;
                                if (!docText && doc.obj) docText = JSON.parse(doc.obj).text;
                                if (!docText && doc.snippet) docText = doc.snippet;
                                if (!docText && doc.content) docText = doc.content;
                                if (!docText && doc.document && doc.document.content) docText = doc.document.content;
                            } catch (e) {
                                console.warn("[Echo360 Debug] Failed to extract search text:", e);
                            }
                            
                            if (typeof docText !== 'string' || !docText) {
                                docText = "Transcript excerpt unavailable";
                            }
                            
                            // Strip out any <v Speaker X> internal tags Echo360 uses
                            docText = docText.replace(/<v[^>]*>/g, '').replace(/<\/v>/g, '');
                            
                            excerptsContainer.innerHTML += `
                                <div class="excerpt-item flex space-x-3 p-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-brand-light/10 dark:hover:bg-brand-dark/20 cursor-pointer transition-colors group" data-sec="${sec}">
                                    <div class="w-24 h-14 bg-black rounded overflow-hidden shadow-sm shrink-0 relative">
                                        <img src="${thumbUrl}" crossorigin="anonymous" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity">
                                        <div class="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded font-bold">${timeStr}</div>
                                    </div>
                                    <div class="text-sm text-gray-700 dark:text-gray-300 italic flex-1 line-clamp-3 leading-snug">
                                        "...${docText.replace(/<em>/g, '<span class="text-brand-light dark:text-brand-dark font-bold not-italic">').replace(/<\/em>/g, '</span>')}..."
                                    </div>
                                </div>
                            `;
                        });
                        
                        container.appendChild(playerContainer);
                        container.appendChild(excerptsContainer);
                        searchList.appendChild(container);
                        
                        // Initialize Player
                        const playerEl = playerContainer.querySelector('.echo-player');
                        if (playerEl) {
                            window.initEchoPlayer(playerEl);
                            
                            // Inject Anchors
                            if (durationSec > 0) {
                                const progBar = playerEl.querySelector('.group\\/progress');
                                if (progBar) {
                                    const anchorsHtml = lessonDocs.map(doc => {
                                        const sec = doc.cueStartTime / 1000;
                                        const pct = (sec / durationSec) * 100;
                                        return `<div class="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-yellow-400 z-30 pointer-events-none rounded-full shadow-sm" style="left: ${pct}%;"></div>`;
                                    }).join('');
                                    progBar.insertAdjacentHTML('beforeend', anchorsHtml);
                                }
                            }
                            
                            // Hover Excerpt logic
                            const v1 = playerEl.querySelector('.feed-video-1');
                            const v2 = playerEl.querySelector('.feed-video-2');
                            excerptsContainer.querySelectorAll('.excerpt-item').forEach(item => {
                                item.addEventListener('mouseenter', () => {
                                    const sec = parseFloat(item.getAttribute('data-sec'));
                                    if (v1 && v1.duration) {
                                        v1.currentTime = sec;
                                        if (v2) v2.currentTime = sec;
                                    }
                                });
                                item.addEventListener('click', () => {
                                    const sec = parseFloat(item.getAttribute('data-sec'));
                                    if (v1 && v1.duration) {
                                        v1.currentTime = sec;
                                        if (v2) v2.currentTime = sec;
                                        // Auto-play on click
                                        if (v1.paused) v1.play();
                                        if (v2 && v2.paused) v2.play();
                                    }
                                });
                            });
                        }
                    });
                    
                    lucide.createIcons();
                } else {
                    stats.innerText = 'Search failed or no results.';
                }
            } catch (err) {
                console.error("Search error:", err);
                stats.innerText = 'An error occurred during search.';
            }
        }
        function switchTab(tabId) {
            const tabs = ['tab-classes', 'tab-search']; // Add more tabs here if needed
            
            tabs.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.classList.remove('text-brand-light', 'dark:text-brand-dark', 'border-brand-light', 'dark:border-brand-dark');
                    el.classList.add('text-gray-500', 'hover:text-gray-800', 'dark:text-gray-400', 'dark:hover:text-gray-200', 'border-transparent');
                }
            });

            const activeTab = document.getElementById(tabId);
            if (activeTab) {
                activeTab.classList.add('text-brand-light', 'dark:text-brand-dark', 'border-brand-light', 'dark:border-brand-dark');
                activeTab.classList.remove('text-gray-500', 'hover:text-gray-800', 'dark:text-gray-400', 'dark:hover:text-gray-200', 'border-transparent');
            }

            if (tabId === 'tab-classes') {
                document.getElementById('classesControls').classList.remove('hidden');
                document.getElementById('classesControls').classList.add('flex');
                document.getElementById('classList').classList.remove('hidden');
                
                document.getElementById('searchControls').classList.remove('flex');
                document.getElementById('searchControls').classList.add('hidden');
                document.getElementById('searchList').classList.remove('flex');
                document.getElementById('searchList').classList.add('hidden');
                
                // Need to pause any search players?
                document.querySelectorAll('#searchList video').forEach(v => v.pause());
            } else if (tabId === 'tab-search') {
                document.getElementById('classesControls').classList.remove('flex');
                document.getElementById('classesControls').classList.add('hidden');
                document.getElementById('classList').classList.add('hidden');
                
                document.getElementById('searchControls').classList.remove('hidden');
                document.getElementById('searchControls').classList.add('flex');
                document.getElementById('searchList').classList.remove('hidden');
                document.getElementById('searchList').classList.add('flex');
                
                // Need to pause any main players?
                document.querySelectorAll('#classList video').forEach(v => v.pause());
            }
        }

        async function loadQA() {
            if (window.EchoState.qaDataLoaded || window.EchoState.isFetchingQA) return;
            window.EchoState.isFetchingQA = true;
            try {
                const res = await fetch(`https://echo360.org/questions/search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sectionId: window.EchoContext.sectionId, isClassroom: false, sortDirection: 'desc', pageNumber: 0, requested: true })
                });
                const data = await res.json();
                if (data.status === 'ok' && data.data) {

                    // Parse top-level questions
                    window.EchoState.qaData = data.data.map(q => {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(q.html, 'text/html');
                        const sq = doc.querySelector('.single-question');
                        const likeEl = doc.querySelector('.like');
                        const bookmarkEl = doc.querySelector('.bookmark');

                        // Note: Echo360 adds 'liked' or 'active' or 'true' classes to the element. 
                        // In some versions it adds 'liked' to the parent or element itself. 
                        // We will check for 'liked', 'active', or 'bookmarked'.
                        const isLiked = likeEl ? (likeEl.classList.contains('liked') || likeEl.classList.contains('active') || doc.querySelector('.liked') !== null) : false;
                        const isBookmarked = bookmarkEl ? (bookmarkEl.classList.contains('bookmarked') || bookmarkEl.classList.contains('active') || doc.querySelector('.bookmarked') !== null) : false;

                        return {
                            id: sq?.getAttribute('data-id') || Math.random().toString(),
                            lessonId: sq?.getAttribute('data-lesson-id') || null,
                            title: doc.querySelector('.title')?.innerText.trim() || 'General Question',
                            time: doc.querySelector('.timestamp')?.innerText.trim() || '',
                            body: doc.querySelector('.question-body')?.innerHTML.trim() || '',
                            likes: parseInt(likeEl?.innerText.trim() || '0'),
                            isLiked: isLiked,
                            isBookmarked: isBookmarked,
                            responsesCount: parseInt(doc.querySelector('.responseCount')?.innerText.trim() || '0'),
                            replies: []
                        };
                    });

                    // Fetch replies for questions that have them
                    const replyPromises = window.EchoState.qaData.filter(q => q.responsesCount > 0).map(async q => {
                        try {
                            const fullRes = await fetch(`https://echo360.org/question/full?isClassroom=false&questionId=${q.id}`);
                            const fullData = await fullRes.json();
                            if (fullData.status === 'ok' && fullData.data && fullData.data.length > 0) {
                                const parser = new DOMParser();
                                const doc = parser.parseFromString(fullData.data[0].html, 'text/html');
                                const responseNodes = doc.querySelectorAll('.responses-list .single-response');

                                responseNodes.forEach(rn => {
                                    const likeEl = rn.querySelector('.like');
                                    q.replies.push({
                                        id: rn.getAttribute('data-id') || Math.random().toString(),
                                        questionId: rn.getAttribute('data-question-id') || q.id,
                                        author: rn.querySelector('.by')?.innerText.trim().replace(/^by\s+/i, '').replace(/\n/g, '').trim() || 'Student',
                                        time: rn.querySelector('.timestamp')?.innerText.trim() || '',
                                        body: rn.querySelector('.response-body')?.innerHTML.trim() || '',
                                        likes: parseInt(likeEl?.innerText.trim() || '0'),
                                        isLiked: likeEl ? (likeEl.classList.contains('liked') || likeEl.classList.contains('active')) : false
                                    });
                                });
                            }
                        } catch (err) {
                            console.error(`Error fetching replies for ${q.id}:`, err);
                        }
                    });

                    await Promise.all(replyPromises);
                    window.EchoState.qaDataLoaded = true;

                    // Re-render any currently open dropdowns to show loaded QA
                    document.querySelectorAll('.qa-section-container').forEach(container => {
                        const containerLessonId = container.getAttribute('data-lesson-id');
                        if (containerLessonId) {
                            container.innerHTML = generateQAHTML(containerLessonId);
                            lucide.createIcons({ root: container });
                        }
                    });

                    const qaContainer = document.getElementById('qaListContainer');
                    if (qaContainer) renderQA();
                }
            } catch (e) {
                console.error("Error loading Q&A:", e);
            } finally {
                window.EchoState.isFetchingQA = false;
            }
        }

        async function interactQA(action, questionId, bodyData = null) {
            // Optimistic UI updates
            const isLikeToggle = action === 'like' || action === 'dislike';
            const isBookmarkToggle = action === 'bookmark' || action === 'forget';

            if (isLikeToggle || isBookmarkToggle) {
                let targetQ = window.EchoState.qaData.find(q => q.id === questionId);
                if (!targetQ) {
                    // Try to find it in replies
                    window.EchoState.qaData.forEach(q => {
                        const reply = q.replies.find(r => r.id === questionId);
                        if (reply) targetQ = reply;
                    });
                }

                if (targetQ) {
                    if (action === 'like') { targetQ.isLiked = true; targetQ.likes++; }
                    if (action === 'dislike') { targetQ.isLiked = false; targetQ.likes = Math.max(0, targetQ.likes - 1); }
                    if (action === 'bookmark') { targetQ.isBookmarked = true; }
                    if (action === 'forget') { targetQ.isBookmarked = false; }

                    // Instantly re-render the UI
                    document.querySelectorAll('.qa-section-container').forEach(container => {
                        const containerLessonId = container.getAttribute('data-lesson-id');
                        if (containerLessonId) {
                            container.innerHTML = generateQAHTML(containerLessonId);
                            lucide.createIcons({ root: container });
                        }
                    });
                }
            }

            // Actions: like, dislike, bookmark, forget, responses, delete, edit
            let url = `https://echo360.org/questions/${questionId}`;
            let method = 'POST';
            if (['like', 'dislike', 'bookmark', 'forget', 'responses'].includes(action)) url += `/${action}`;
            if (action === 'delete') method = 'DELETE';
            if (action === 'edit') method = 'PUT';

            const headers = {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest'
            };

            if (bodyData) {
                headers['Content-Type'] = 'application/json';
            }

            try {
                const reqObj = { method, headers };
                if (bodyData) reqObj.body = JSON.stringify(bodyData);
                const res = await fetch(url, reqObj);

                // If it's a deletion or new reply, we must reload the data entirely
                if (res.ok && (action === 'delete' || action === 'responses')) {
                    window.EchoState.isFetchingQA = false;
                    window.EchoState.qaDataLoaded = false;
                    await loadQA(); 
                } else if (!res.ok) {
                    console.error(`QA action ${action} failed with status ${res.status}`);
                }
            } catch (err) {
                console.error(`Error performing QA action ${action}:`, err);
            }
        }

        async function createQuestion(lessonId, text, anonymous = false) {
            try {
                const res = await fetch('https://echo360.org/questions', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'Accept': 'application/json, text/javascript, */*; q=0.01',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({
                        removeExistingAttachment: true,
                        body: text,
                        isClassroom: false,
                        sectionId: window.EchoContext.sectionId,
                        lessonId: lessonId,
                        contentReference: false,
                        anonymous: anonymous
                    })
                });
                if (res.ok) {
                    window.EchoState.isFetchingQA = false;
                    window.EchoState.qaDataLoaded = false;
                    await loadQA();
                } else {
                    console.error(`Create question failed with status ${res.status}`);
                }
            } catch (err) {
                console.error('Error creating question:', err);
            }
        }        
        function generateQAHTML(targetLessonId) {
            // Echo360 QA endpoint lessonIds sometimes are compound strings or differ slightly, but they always contain the core UUID
            // E.g. "G_dfa54292-1b8d-4ad6-9dee-5277b1ed1189_05e93c4d-e6..."
            // Target lesson ID might be "05e93c4d-e6..."
            // We use .includes() for robust matching

            if (!window.EchoState.qaDataLoaded) {
                // Ensure loadQA gets called if it hasn't been yet
                loadQA();
                return `<div class="text-center py-4 text-gray-500 dark:text-gray-400 text-sm animate-pulse">Loading Q&A...</div>`;
            }

            const lessonQA = window.EchoState.qaData.filter(q => q.lessonId && targetLessonId && (q.lessonId.includes(targetLessonId) || targetLessonId.includes(q.lessonId)));

            if (lessonQA.length === 0) {
                return `
                <div class="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">No questions have been asked for this class yet.</div>
                <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button data-action="qa-ask" data-lesson-id="${targetLessonId}" class="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-semibold py-2 rounded transition-colors flex items-center justify-center">
                        <i data-lucide="plus" class="w-4 h-4 mr-2"></i> Ask a Question
                    </button>
                </div>`;
            }

            const qs = lessonQA.map(q => {
                let repliesHtml = '';
                if (q.replies && q.replies.length > 0) {
                    repliesHtml = `<div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3 pl-4 border-l-2 border-brand-light/30">`;
                    repliesHtml += q.replies.map(r => `
                        <div class="flex flex-col relative group/reply">
                            <div class="flex justify-between items-start mb-1">
                                <div class="flex items-center space-x-2">
                                    <div class="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500"><i data-lucide="user" class="w-3 h-3"></i></div>
                                    <span class="font-bold text-xs text-gray-800 dark:text-gray-200">${r.author}</span>
                                </div>
                                <div class="flex items-center">
                                    <span class="text-[10px] text-gray-400 whitespace-nowrap ml-2">${r.time}</span>
                                    <button data-action="qa-delete" data-question-id="${r.questionId}" data-reply-id="${r.id}" class="ml-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover/reply:opacity-100" title="Delete Reply"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                                </div>
                            </div>
                            <div class="text-xs text-gray-700 dark:text-gray-300 pl-7">
                                ${r.body}
                            </div>
                        </div>
                    `).join('');
                    repliesHtml += `</div>`;
                }

                const likeColor = q.isLiked ? 'text-brand-light' : 'hover:text-brand-light';
                const likeAction = q.isLiked ? 'dislike' : 'like';
                const bookmarkColor = q.isBookmarked ? 'text-brand-light' : 'hover:text-brand-light';
                const bookmarkAction = q.isBookmarked ? 'forget' : 'bookmark';

                return `
                <div class="bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm flex flex-col relative group">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex items-center space-x-2">
                            <div class="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500"><i data-lucide="user" class="w-3.5 h-3.5"></i></div>
                            <span class="font-bold text-sm text-gray-800 dark:text-gray-200">Student</span>
                        </div>
                        <div class="flex items-center">
                            <span class="text-xs text-gray-400 whitespace-nowrap ml-2">${q.time}</span>   
                            <button data-action="qa-delete" data-question-id="${q.id}" class="ml-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" title="Delete Question"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                        </div>
                    </div>
                    <div class="text-sm text-gray-700 dark:text-gray-300 mb-4 pl-8">
                        ${q.body}
                    </div>
                    <div class="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-3 pl-8">
                        <div class="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 font-medium">
                            <button data-action="qa-toggle-like" data-action-type="${likeAction}" data-question-id="${q.id}" class="flex items-center transition-colors ${likeColor}"><i data-lucide="thumbs-up" class="w-3.5 h-3.5 mr-1.5"></i> ${q.likes}</button>
                            <button data-action="qa-toggle-bookmark" data-action-type="${bookmarkAction}" data-question-id="${q.id}" class="flex items-center transition-colors ${bookmarkColor}"><i data-lucide="bookmark" class="w-3.5 h-3.5 mr-1.5"></i> Bookmark</button>
                            <div class="flex items-center"><i data-lucide="message-square" class="w-3.5 h-3.5 mr-1.5"></i> ${q.responsesCount} replies</div>
                        </div>
                        <button data-action="qa-reply" data-question-id="${q.id}" class="text-xs text-brand-light hover:text-brand-hover font-semibold transition-colors">Reply</button>
                    </div>
                    ${repliesHtml}
                </div>
            `}).join('');

            const askBtnHtml = `
                <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button data-action="qa-ask" data-lesson-id="${targetLessonId}" class="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-semibold py-2 rounded transition-colors flex items-center justify-center">
                        <i data-lucide="plus" class="w-4 h-4 mr-2"></i> Ask a Question
                    </button>
                </div>
            `;

            return `<div class="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">${qs}</div>${askBtnHtml}`;
        }        function renderQA(query = '') {
            const qaContainer = document.getElementById('qaListContainer');
            if (!qaContainer) return;

            if (window.EchoState.qaData.length === 0) {
                qaContainer.innerHTML = '<div class="text-center text-gray-500 mt-10">No questions found.</div>';
                return;
            }
            
            const filtered = window.EchoState.qaData.filter(q => q.title.toLowerCase().includes(query.toLowerCase()) || q.body.toLowerCase().includes(query.toLowerCase()));
            
            if (filtered.length === 0) {
                qaContainer.innerHTML = '<div class="text-center text-gray-500 mt-10">No matching questions.</div>';
                return;
            }

            qaContainer.innerHTML = filtered.map(q => `
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow transition-shadow flex flex-col">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-bold text-sm text-brand-light dark:text-brand-dark">${q.title}</h3>
                        <span class="text-xs text-gray-400 whitespace-nowrap ml-2">${q.time}</span>
                    </div>
                    <div class="text-sm text-gray-700 dark:text-gray-300 mb-4 flex-1">
                        ${q.body}
                    </div>
                    <div class="flex items-center justify-between border-t border-gray-100 dark:border-gray-700/50 pt-3">
                        <div class="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                            <div class="flex items-center"><i data-lucide="thumbs-up" class="w-3.5 h-3.5 mr-1.5"></i> ${q.likes}</div>
                            <div class="flex items-center"><i data-lucide="message-square" class="w-3.5 h-3.5 mr-1.5"></i> ${q.responses} replies</div>
                        </div>
                    </div>
                </div>
            `).join('');
            lucide.createIcons();
        }

        function switchLayout(layout) {
            if (window.EchoState.currentLayout === layout) return;
            window.EchoState.currentLayout = layout;
            
            const btnList = document.getElementById('btn-layout-list');
            const btnGrid = document.getElementById('btn-layout-grid');

            if (layout === 'list') {
                btnList.className = 'flex items-center justify-center w-8 h-8 rounded-md bg-white dark:bg-gray-600 shadow-sm text-brand-light dark:text-brand-dark transition-all focus:outline-none';
                btnGrid.className = 'flex items-center justify-center w-8 h-8 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-all focus:outline-none';
            } else {
                btnGrid.className = 'flex items-center justify-center w-8 h-8 rounded-md bg-white dark:bg-gray-600 shadow-sm text-brand-light dark:text-brand-dark transition-all focus:outline-none';
                btnList.className = 'flex items-center justify-center w-8 h-8 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-all focus:outline-none';
            }

            window.EchoState.activeGridId = null;
            window.EchoState.activeGridIndex = -1;
            renderClasses();
        }

        // ==========================================
        // ADVANCED ECHO360-STYLE PLAYER ARCHITECTURE
        // ==========================================

        function getPlayerHTML(cls) {
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
        const cls = window.EchoState.classData.find(c => c.id === lessonId);

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
                if (typeof showToast === 'function') showToast("Failed to open Pop Out player");
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

        function getGridDropdownHTML(cls, clsId, clickedIndex) {
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

        function renderClasses() {
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

        function toggleDropdown(e, clsId, element) {
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

async function loadData() {
    const client = new EchoApiClient(window.EchoContext.hostname);
    try {
        console.log("[Echo360 Debug] Starting loadData...");

        let syllabus;
        const cachedKey = `echo360_syllabus_${window.EchoContext.sectionId}`;
        const cachedData = localStorage.getItem(cachedKey);
        const cachedTime = localStorage.getItem(`${cachedKey}_time`);

        // Cache valid for 5 minutes (300,000 ms)
        if (cachedData && cachedTime && (Date.now() - parseInt(cachedTime) < 300000)) {
            console.log("[Echo360 Debug] Loading syllabus from cache");
            syllabus = JSON.parse(cachedData);
        } else {
            console.log("[Echo360 Debug] Fetching fresh syllabus from API...");
            syllabus = await client.fetchSyllabus(window.EchoContext.sectionId);
            localStorage.setItem(cachedKey, JSON.stringify(syllabus));
            localStorage.setItem(`${cachedKey}_time`, Date.now().toString());
        }

        console.log(`[Echo360 Debug] Fetched syllabus successfully. Items:`, syllabus?.data?.length);

        window.EchoState.classData = syllabus.data.map((item, index) => {
            const lesson = item.lesson?.lesson;
            const mediaId = extractMediaId(item);

            // The API uses 'hasVideo', but as a fallback we can also just check if we found a mediaId
            const hasVideo = item.lesson?.hasVideo || !!mediaId;

            let date = '';
            let time = '';
            const startUTC = item.lesson?.startTimeUTC;
            const endUTC = item.lesson?.endTimeUTC;
            if (startUTC) {
                const dtStart = new Date(startUTC);
                date = dtStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                const startTimeStr = dtStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().replace(' ', '');
                
                if (endUTC) {
                    const dtEnd = new Date(endUTC);
                    const endTimeStr = dtEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().replace(' ', '');
                    time = `${startTimeStr}-${endTimeStr}`;
                } else {
                    time = startTimeStr;
                }
            }

            const instId = lesson?.institutionId;
            let thumbnail = '';
            if (mediaId && instId) {
                thumbnail = `https://thumbnails.echo360.org/0000.${instId}/${mediaId}/1/poster1.jpg`;
            }

            const savedProg = mediaId ? localStorage.getItem(`echo360_progress_${mediaId}`) : null;
            const progress = savedProg ? parseFloat(savedProg) : 0;
            const isFuture = item.lesson?.isFuture || false;

            const mappedItem = {
                id: lesson?.id || String(index),
                date: date,
                time: time,
                title: lesson?.name || 'Untitled Lesson',
                hasVideo: hasVideo,
                isFuture: isFuture,
                qs: item.lesson?.questionCount || 0,
                progress: progress,
                mediaId: mediaId,
                instId: instId,
                thumbnail: thumbnail,
                lessonData: item,
                titleRaw: lesson?.name || 'Untitled Lesson'
            };

            if (index === 0) {
                console.log(`[Echo360 Debug] Sample mapped window.EchoState.classData item (first row):`, mappedItem);
            }
            return mappedItem;
        });
        console.log("[Echo360 Debug] Mapped window.EchoState.classData. Rendering classes...");
        renderClasses();        console.log("[Echo360 Debug] renderClasses() completed successfully.");
    } catch (e) {
        console.error("[Echo360 Debug] 💥 FATAL ERROR in loadData:", e.stack || e);
        if (typeof showToast === 'function') showToast("Error loading syllabus");
    }
}
async function loadEnrollments() {
    const client = new EchoApiClient(window.EchoContext.hostname);
    try {
        const enrollments = await client.fetchEnrollments();
        if (enrollments && enrollments.data && enrollments.data.length > 0) {
            const data = enrollments.data[0];
            const termsById = data.termsById || {};
            const userSections = data.userSections || [];

            // Update the main header with the actual course name
            const currentCourse = userSections.find(c => c.sectionId === window.EchoContext.sectionId);
            if (currentCourse) {
                const fullTitle = `${currentCourse.courseCode || ''} ${currentCourse.courseName || ''}`.trim();
                if (fullTitle) {
                    document.title = `${fullTitle} | Class List`;
                    const h1El = document.querySelector('h1');
                    if (h1El) h1El.textContent = fullTitle;
                }
            }

            // Group courses by term
            const termsMap = new Map();
            userSections.forEach(sec => {
                const termId = sec.termId;
                if (!termsMap.has(termId)) {
                    termsMap.set(termId, {
                        ...termsById[termId],
                        courses: []
                    });
                }
                termsMap.get(termId).courses.push(sec);
            });
            
            // Sort terms (most recent first, assuming name or startDate)
            const sortedTerms = Array.from(termsMap.values()).sort((a, b) => {
                if (a.startDate && b.startDate) return b.startDate.localeCompare(a.startDate);
                return (b.name || '').localeCompare(a.name || '');
            });
            
            const termList = document.getElementById('term-list');
            
            // Fix: remove the problematic CSS class that causes vertical centering overflow
            termList.classList.remove('parent-flex');
            termList.classList.add('flex', 'flex-col', 'w-full');
            termList.innerHTML = '';
            
            sortedTerms.forEach(term => {
                // Sort courses alphabetically by name
                term.courses.sort((a, b) => (a.courseCode || '').localeCompare(b.courseCode || ''));

                const termLi = document.createElement('li');
                termLi.className = 'border-b border-gray-100 dark:border-gray-800 last:border-0 w-full flex flex-col';
                termLi.innerHTML = `
                    <details class="group [&_summary::-webkit-details-marker]:hidden w-full">
                        <summary class="flex justify-between items-center font-medium cursor-pointer list-none px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-full">
                            <span class="truncate pr-4">${term.name || 'Other'}</span>
                            <span class="transition-transform duration-300 group-open:rotate-180 flex-shrink-0">
                                <i data-lucide="chevron-down" class="w-4 h-4 text-gray-400"></i>
                            </span>
                        </summary>
                        <div class="bg-gray-50 dark:bg-gray-800/50 px-2 py-2 max-h-64 overflow-y-auto w-full">
                            <ul class="space-y-1 w-full flex flex-col">
                                ${term.courses.map(course => `
                                    <li class="w-full flex flex-col">
                                        <a href="${window.EchoContext.hostname}/section/${course.sectionId}/home" class="course-link block w-full px-3 py-2 rounded hover:bg-white dark:hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600 shadow-sm hover:shadow">
                                            <div class="font-bold text-xs text-brand-light dark:text-brand-dark mb-0.5 truncate w-full">${course.courseCode}</div>
                                            <div class="text-sm text-gray-700 dark:text-gray-300 truncate w-full" title="${course.courseName}">${course.courseName}</div>
                                        </a>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </details>
                `;
                termList.appendChild(termLi);
            });
            lucide.createIcons();
        }
    } catch (e) {
        console.error("[Echo360 Debug] Failed to load enrollments:", e);
        document.getElementById('term-list').innerHTML = `<li class="px-4 py-2 text-xs text-red-500 w-full">Error loading courses</li>`;
    }
}
loadEnrollments();
loadData();

setInterval(() => {
document.addEventListener('DOMContentLoaded', () => renderClasses());
        } else {
            renderClasses();
        }
    } catch(e) {
        console.warn("Failed to parse initial cache", e);
    }
}

        lucide.createIcons();

        // Toast Notification
        function showToast(message) {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-3 rounded shadow-xl transform transition-all duration-300 translate-y-10 opacity-0 flex items-center space-x-3 pointer-events-auto`;
            toast.innerHTML = `<div class="bg-brand-light dark:bg-brand-dark p-1 rounded-full text-white"><i data-lucide="check" class="w-4 h-4"></i></div><span class="font-medium text-sm">${message}</span>`;
            
            container.appendChild(toast);
            lucide.createIcons();

            requestAnimationFrame(() => toast.classList.remove('translate-y-10', 'opacity-0'));
            setTimeout(() => {
                toast.classList.add('translate-y-10', 'opacity-0');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        // --- Selection Mode Logic ---
        function toggleSelectionMode() {
            window.EchoState.isSelectionMode = !window.EchoState.isSelectionMode;
            const container = document.getElementById('classList');
            const controls = document.getElementById('selectionControls');
            const toggleBtnSpan = document.querySelector('#toggleSelectionModeBtn span');

            if (window.EchoState.isSelectionMode) {
                container.classList.add('selection-mode');
                controls.classList.add('show');
                toggleBtnSpan.innerText = 'Cancel Selection';
                
                // If we are in grid layout and a video is open, close it to avoid layout issues during selection
                if (window.EchoState.currentLayout === 'grid' && window.EchoState.activeGridId !== null) {
                    const globalDropdown = document.getElementById('global-grid-dropdown');
                    if (globalDropdown) globalDropdown.classList.remove('open');
                    window.EchoState.activeGridId = null;
                    window.EchoState.activeGridIndex = -1;
                }
            } else {
                container.classList.remove('selection-mode');
                controls.classList.remove('show');
                
                toggleBtnSpan.innerText = 'Select to Download';
                
                // Clear selection when exiting mode
                window.EchoState.selectedClasses.clear();
                document.querySelectorAll('.class-checkbox').forEach(cb => cb.checked = false);
                updateSelectionUI();
            }
        }

        // --- Selection Logic ---
        function toggleSelection(id) {
            if (window.EchoState.selectedClasses.has(id)) {
                window.EchoState.selectedClasses.delete(id);
            } else {
                window.EchoState.selectedClasses.add(id);
            }
            updateSelectionUI();
        }

        function toggleSelectAll(checked) {
            const filteredData = window.EchoState.classData.filter(cls => 
                (cls.title.toLowerCase().includes(window.EchoState.searchQuery) || 
                cls.date.toLowerCase().includes(window.EchoState.searchQuery) ||
                cls.time.toLowerCase().includes(window.EchoState.searchQuery)) && cls.hasVideo
            );
            
            if (checked) {
                filteredData.forEach(cls => window.EchoState.selectedClasses.add(cls.id));
            } else {
                window.EchoState.selectedClasses.clear();
            }
            
            document.querySelectorAll('.class-checkbox').forEach(cb => {
                cb.checked = window.EchoState.selectedClasses.has(parseInt(cb.value));
            });
            updateSelectionUI();
        }

        function updateSelectionUI() {
            const btnContainer = document.getElementById('downloadBtnContainer');
            const countSpan = document.getElementById('selectedCount');
            const selectAllCb = document.getElementById('selectAllCheckbox');
            
            const filteredWithVideo = window.EchoState.classData.filter(cls => 
                (cls.title.toLowerCase().includes(window.EchoState.searchQuery) || 
                cls.date.toLowerCase().includes(window.EchoState.searchQuery) ||
                cls.time.toLowerCase().includes(window.EchoState.searchQuery)) && cls.hasVideo
            );

            if (window.EchoState.selectedClasses.size > 0) {
                btnContainer.classList.add('show');
                countSpan.innerText = window.EchoState.selectedClasses.size;
            } else {
                btnContainer.classList.remove('show');
            }
            
            if (filteredWithVideo.length > 0 && window.EchoState.selectedClasses.size === filteredWithVideo.length) {
                selectAllCb.checked = true;
                selectAllCb.indeterminate = false;
            } else if (window.EchoState.selectedClasses.size > 0) {
                selectAllCb.checked = false;
                selectAllCb.indeterminate = true;
            } else {
                selectAllCb.checked = false;
                selectAllCb.indeterminate = false;
            }
        }

        // --- Download Logic ---
        function handleDownload(event, id) {
            event.stopPropagation();
            startDownloads([id]);
        }

        function downloadSelected() {
            const ids = Array.from(window.EchoState.selectedClasses);
            startDownloads(ids);
            
            window.EchoState.selectedClasses.clear();
            document.querySelectorAll('.class-checkbox').forEach(cb => cb.checked = false);
            updateSelectionUI();
        }

        window.startDownloads = function(ids) {
            const lessonsToDownload = ids.map(id => {
                const cls = window.EchoState.classData.find(c => c.id === id);
                return { lessonId: cls.id, title: cls.titleRaw, date: cls.date, sectionId: window.EchoContext.sectionId, hostname: window.EchoContext.hostname, courseName: window.EchoContext.courseName };
            });
            chrome.runtime.sendMessage({ type: 'START_DOWNLOADS', payload: { lessons: lessonsToDownload, hostname: window.EchoContext.hostname } });
            if (typeof showToast === 'function') showToast(`Queued ${lessonsToDownload.length} downloads`);       
        };
        function closeDownloadManager() {
            document.getElementById('download-manager').classList.add('translate-y-[150%]', 'opacity-0');
        }

        export function handleSearch(query) {
            window.EchoState.searchQuery = query.toLowerCase();
            if (window.EchoState.activeGridId !== null) {
                const globalDropdown = document.getElementById('global-grid-dropdown');
                if(globalDropdown) globalDropdown.classList.remove('open');
                window.EchoState.activeGridId = null;
                window.EchoState.activeGridIndex = -1;
            }
            
            // Clear selection on search
            window.EchoState.selectedClasses.clear();
            updateSelectionUI();

            renderClasses();
        }

        // --- Transcript Search Logic ---
        let window.EchoState.searchData = [];
        
        export async function executeSearch(query) {
            const stats = document.getElementById('searchStats');
            const searchList = document.getElementById('searchList');
            
            if (!query || query.trim() === '') return;
            
            stats.innerHTML = `<span class="animate-pulse">Searching transcripts...</span>`;
            searchList.innerHTML = '';
            
            try {
                const res = await fetch(`https://echo360.org/section/${window.EchoContext.sectionId}/search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        contentType: "Transcription",
                        searchText: query,
                        pageNumber: 0
                    })
                });
                
                const data = await res.json();
                console.log("[Echo360 Debug] Search Response:", data);

                const docs = data.docs || (data.data && data.data.length > 0 ? data.data[0].docs : null) || [];

                if (docs && docs.length > 0) {
                    console.log(`[Echo360 Debug] Search Docs Found: ${docs.length}`);

                    stats.innerText = `Found ${docs.length} matches across ${new Set(docs.map(d => d.lesson?.id || d.media?.id)).size} lessons.`;

                    // Group by lesson
                    const grouped = {};
                    docs.forEach(doc => {
                        const lId = doc.lesson?.id || doc.media?.id || 'unknown';
                        if (!grouped[lId]) grouped[lId] = [];
                        grouped[lId].push(doc);
                    });                    
                    Object.keys(grouped).forEach(lessonId => {
                        const lessonDocs = grouped[lessonId];
                        // Find matching class
                        // Note: docs.lesson.id is the long ID. window.EchoState.classData[i].id might be the short ID or long ID.
                        // We'll search by matching any part of the ID just in case.
                        const cls = window.EchoState.classData.find(c => lessonId.includes(c.id) || c.id.includes(lessonId)) || {
                            id: lessonId,
                            title: lessonDocs[0].lesson.name,
                            hasVideo: true,
                            mediaId: lessonDocs[0].media.id,
                            lessonData: { lesson: { lesson: { id: lessonId } } }
                        };
                        
                        // We only support searching videos for now
                        if (!cls.hasVideo) return;
                        
                        const container = document.createElement('div');
                        container.className = 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-lg flex flex-col xl:flex-row';
                        
                        // Left: Video Player
                        const playerContainer = document.createElement('div');
                        playerContainer.className = 'w-full xl:w-2/3 p-4 border-b xl:border-b-0 xl:border-r border-gray-200 dark:border-gray-700 relative';
                        
                        // Pre-calculate anchor points
                        const durationStr = lessonDocs[0].media?.duration || "00:00:00"; // HH:MM:SS
                        const durParts = durationStr.split(':').map(Number);
                        const durationSec = (durParts[0] || 0) * 3600 + (durParts[1] || 0) * 60 + (durParts[2] || 0);
                        
                        playerContainer.innerHTML = `
                            <h3 class="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">${cls.title}</h3>
                            ${getPlayerHTML(cls)}
                        `;
                        
                        // Right: Excerpts
                        const excerptsContainer = document.createElement('div');
                        excerptsContainer.className = 'w-full xl:w-1/3 flex flex-col max-h-[600px] overflow-y-auto custom-scrollbar p-4 space-y-3 bg-white dark:bg-gray-900/50';
                        
                        lessonDocs.forEach(doc => {
                            const sec = Math.floor(doc.cueStartTime / 1000);
                            const min = Math.floor(sec / 60);
                            const s = Math.floor(sec % 60);
                            const timeStr = `${min}:${s.toString().padStart(2, '0')}`;
                            
                            const instId = lessonDocs[0].media?.media?.current?.primaryThumbnails?.baseUrl?.match(/0000\.([^\/]+)/)?.[1] || cls.instId;
                            // Thumbnails are snapped to 60s
                            const snappedSeconds = Math.floor(sec / 60) * 60;
                            const thumbUrl = (cls.mediaId && instId) ? `https://thumbnails.echo360.org/0000.${instId}/${cls.mediaId}/1/thumbnails1/${snappedSeconds}.jpg` : cls.thumbnail;
                            
                            let docText = "";
                            try {
                                if (doc.text) docText = Array.isArray(doc.text) ? doc.text[0] : doc.text;
                                if (!docText && doc.document && doc.document.text) docText = Array.isArray(doc.document.text) ? doc.document.text[0] : doc.document.text;
                                if (!docText && doc.document && doc.document.obj) docText = JSON.parse(doc.document.obj).text;
                                if (!docText && doc.obj) docText = JSON.parse(doc.obj).text;
                                if (!docText && doc.snippet) docText = doc.snippet;
                                if (!docText && doc.content) docText = doc.content;
                                if (!docText && doc.document && doc.document.content) docText = doc.document.content;
                            } catch (e) {
                                console.warn("[Echo360 Debug] Failed to extract search text:", e);
                            }
                            
                            if (typeof docText !== 'string' || !docText) {
                                docText = "Transcript excerpt unavailable";
                            }
                            
                            // Strip out any <v Speaker X> internal tags Echo360 uses
                            docText = docText.replace(/<v[^>]*>/g, '').replace(/<\/v>/g, '');
                            
                            excerptsContainer.innerHTML += `
                                <div class="excerpt-item flex space-x-3 p-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-brand-light/10 dark:hover:bg-brand-dark/20 cursor-pointer transition-colors group" data-sec="${sec}">
                                    <div class="w-24 h-14 bg-black rounded overflow-hidden shadow-sm shrink-0 relative">
                                        <img src="${thumbUrl}" crossorigin="anonymous" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity">
                                        <div class="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded font-bold">${timeStr}</div>
                                    </div>
                                    <div class="text-sm text-gray-700 dark:text-gray-300 italic flex-1 line-clamp-3 leading-snug">
                                        "...${docText.replace(/<em>/g, '<span class="text-brand-light dark:text-brand-dark font-bold not-italic">').replace(/<\/em>/g, '</span>')}..."
                                    </div>
                                </div>
                            `;
                        });
                        
                        container.appendChild(playerContainer);
                        container.appendChild(excerptsContainer);
                        searchList.appendChild(container);
                        
                        // Initialize Player
                        const playerEl = playerContainer.querySelector('.echo-player');
                        if (playerEl) {
                            window.initEchoPlayer(playerEl);
                            
                            // Inject Anchors
                            if (durationSec > 0) {
                                const progBar = playerEl.querySelector('.group\\/progress');
                                if (progBar) {
                                    const anchorsHtml = lessonDocs.map(doc => {
                                        const sec = doc.cueStartTime / 1000;
                                        const pct = (sec / durationSec) * 100;
                                        return `<div class="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-yellow-400 z-30 pointer-events-none rounded-full shadow-sm" style="left: ${pct}%;"></div>`;
                                    }).join('');
                                    progBar.insertAdjacentHTML('beforeend', anchorsHtml);
                                }
                            }
                            
                            // Hover Excerpt logic
                            const v1 = playerEl.querySelector('.feed-video-1');
                            const v2 = playerEl.querySelector('.feed-video-2');
                            excerptsContainer.querySelectorAll('.excerpt-item').forEach(item => {
                                item.addEventListener('mouseenter', () => {
                                    const sec = parseFloat(item.getAttribute('data-sec'));
                                    if (v1 && v1.duration) {
                                        v1.currentTime = sec;
                                        if (v2) v2.currentTime = sec;
                                    }
                                });
                                item.addEventListener('click', () => {
                                    const sec = parseFloat(item.getAttribute('data-sec'));
                                    if (v1 && v1.duration) {
                                        v1.currentTime = sec;
                                        if (v2) v2.currentTime = sec;
                                        // Auto-play on click
                                        if (v1.paused) v1.play();
                                        if (v2 && v2.paused) v2.play();
                                    }
                                });
                            });
                        }
                    });
                    
                    lucide.createIcons();
                } else {
                    stats.innerText = 'Search failed or no results.';
                }
            } catch (err) {
                console.error("Search error:", err);
                stats.innerText = 'An error occurred during search.';
            }
        }
        function switchTab(tabId) {
            const tabs = ['tab-classes', 'tab-search']; // Add more tabs here if needed
            
            tabs.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.classList.remove('text-brand-light', 'dark:text-brand-dark', 'border-brand-light', 'dark:border-brand-dark');
                    el.classList.add('text-gray-500', 'hover:text-gray-800', 'dark:text-gray-400', 'dark:hover:text-gray-200', 'border-transparent');
                }
            });

            const activeTab = document.getElementById(tabId);
            if (activeTab) {
                activeTab.classList.add('text-brand-light', 'dark:text-brand-dark', 'border-brand-light', 'dark:border-brand-dark');
                activeTab.classList.remove('text-gray-500', 'hover:text-gray-800', 'dark:text-gray-400', 'dark:hover:text-gray-200', 'border-transparent');
            }

            if (tabId === 'tab-classes') {
                document.getElementById('classesControls').classList.remove('hidden');
                document.getElementById('classesControls').classList.add('flex');
                document.getElementById('classList').classList.remove('hidden');
                
                document.getElementById('searchControls').classList.remove('flex');
                document.getElementById('searchControls').classList.add('hidden');
                document.getElementById('searchList').classList.remove('flex');
                document.getElementById('searchList').classList.add('hidden');
                
                // Need to pause any search players?
                document.querySelectorAll('#searchList video').forEach(v => v.pause());
            } else if (tabId === 'tab-search') {
                document.getElementById('classesControls').classList.remove('flex');
                document.getElementById('classesControls').classList.add('hidden');
                document.getElementById('classList').classList.add('hidden');
                
                document.getElementById('searchControls').classList.remove('hidden');
                document.getElementById('searchControls').classList.add('flex');
                document.getElementById('searchList').classList.remove('hidden');
                document.getElementById('searchList').classList.add('flex');
                
                // Need to pause any main players?
                document.querySelectorAll('#classList video').forEach(v => v.pause());
            }
        }

        async function loadQA() {
            if (window.EchoState.qaDataLoaded || window.EchoState.isFetchingQA) return;
            window.EchoState.isFetchingQA = true;
            try {
                const res = await fetch(`https://echo360.org/questions/search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sectionId: window.EchoContext.sectionId, isClassroom: false, sortDirection: 'desc', pageNumber: 0, requested: true })
                });
                const data = await res.json();
                if (data.status === 'ok' && data.data) {

                    // Parse top-level questions
                    window.EchoState.qaData = data.data.map(q => {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(q.html, 'text/html');
                        const sq = doc.querySelector('.single-question');
                        const likeEl = doc.querySelector('.like');
                        const bookmarkEl = doc.querySelector('.bookmark');

                        // Note: Echo360 adds 'liked' or 'active' or 'true' classes to the element. 
                        // In some versions it adds 'liked' to the parent or element itself. 
                        // We will check for 'liked', 'active', or 'bookmarked'.
                        const isLiked = likeEl ? (likeEl.classList.contains('liked') || likeEl.classList.contains('active') || doc.querySelector('.liked') !== null) : false;
                        const isBookmarked = bookmarkEl ? (bookmarkEl.classList.contains('bookmarked') || bookmarkEl.classList.contains('active') || doc.querySelector('.bookmarked') !== null) : false;

                        return {
                            id: sq?.getAttribute('data-id') || Math.random().toString(),
                            lessonId: sq?.getAttribute('data-lesson-id') || null,
                            title: doc.querySelector('.title')?.innerText.trim() || 'General Question',
                            time: doc.querySelector('.timestamp')?.innerText.trim() || '',
                            body: doc.querySelector('.question-body')?.innerHTML.trim() || '',
                            likes: parseInt(likeEl?.innerText.trim() || '0'),
                            isLiked: isLiked,
                            isBookmarked: isBookmarked,
                            responsesCount: parseInt(doc.querySelector('.responseCount')?.innerText.trim() || '0'),
                            replies: []
                        };
                    });

                    // Fetch replies for questions that have them
                    const replyPromises = window.EchoState.qaData.filter(q => q.responsesCount > 0).map(async q => {
                        try {
                            const fullRes = await fetch(`https://echo360.org/question/full?isClassroom=false&questionId=${q.id}`);
                            const fullData = await fullRes.json();
                            if (fullData.status === 'ok' && fullData.data && fullData.data.length > 0) {
                                const parser = new DOMParser();
                                const doc = parser.parseFromString(fullData.data[0].html, 'text/html');
                                const responseNodes = doc.querySelectorAll('.responses-list .single-response');

                                responseNodes.forEach(rn => {
                                    const likeEl = rn.querySelector('.like');
                                    q.replies.push({
                                        id: rn.getAttribute('data-id') || Math.random().toString(),
                                        questionId: rn.getAttribute('data-question-id') || q.id,
                                        author: rn.querySelector('.by')?.innerText.trim().replace(/^by\s+/i, '').replace(/\n/g, '').trim() || 'Student',
                                        time: rn.querySelector('.timestamp')?.innerText.trim() || '',
                                        body: rn.querySelector('.response-body')?.innerHTML.trim() || '',
                                        likes: parseInt(likeEl?.innerText.trim() || '0'),
                                        isLiked: likeEl ? (likeEl.classList.contains('liked') || likeEl.classList.contains('active')) : false
                                    });
                                });
                            }
                        } catch (err) {
                            console.error(`Error fetching replies for ${q.id}:`, err);
                        }
                    });

                    await Promise.all(replyPromises);
                    window.EchoState.qaDataLoaded = true;

                    // Re-render any currently open dropdowns to show loaded QA
                    document.querySelectorAll('.qa-section-container').forEach(container => {
                        const containerLessonId = container.getAttribute('data-lesson-id');
                        if (containerLessonId) {
                            container.innerHTML = generateQAHTML(containerLessonId);
                            lucide.createIcons({ root: container });
                        }
                    });

                    const qaContainer = document.getElementById('qaListContainer');
                    if (qaContainer) renderQA();
                }
            } catch (e) {
                console.error("Error loading Q&A:", e);
            } finally {
                window.EchoState.isFetchingQA = false;
            }
        }

        async function interactQA(action, questionId, bodyData = null) {
            // Optimistic UI updates
            const isLikeToggle = action === 'like' || action === 'dislike';
            const isBookmarkToggle = action === 'bookmark' || action === 'forget';

            if (isLikeToggle || isBookmarkToggle) {
                let targetQ = window.EchoState.qaData.find(q => q.id === questionId);
                if (!targetQ) {
                    // Try to find it in replies
                    window.EchoState.qaData.forEach(q => {
                        const reply = q.replies.find(r => r.id === questionId);
                        if (reply) targetQ = reply;
                    });
                }

                if (targetQ) {
                    if (action === 'like') { targetQ.isLiked = true; targetQ.likes++; }
                    if (action === 'dislike') { targetQ.isLiked = false; targetQ.likes = Math.max(0, targetQ.likes - 1); }
                    if (action === 'bookmark') { targetQ.isBookmarked = true; }
                    if (action === 'forget') { targetQ.isBookmarked = false; }

                    // Instantly re-render the UI
                    document.querySelectorAll('.qa-section-container').forEach(container => {
                        const containerLessonId = container.getAttribute('data-lesson-id');
                        if (containerLessonId) {
                            container.innerHTML = generateQAHTML(containerLessonId);
                            lucide.createIcons({ root: container });
                        }
                    });
                }
            }

            // Actions: like, dislike, bookmark, forget, responses, delete, edit
            let url = `https://echo360.org/questions/${questionId}`;
            let method = 'POST';
            if (['like', 'dislike', 'bookmark', 'forget', 'responses'].includes(action)) url += `/${action}`;
            if (action === 'delete') method = 'DELETE';
            if (action === 'edit') method = 'PUT';

            const headers = {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest'
            };

            if (bodyData) {
                headers['Content-Type'] = 'application/json';
            }

            try {
                const reqObj = { method, headers };
                if (bodyData) reqObj.body = JSON.stringify(bodyData);
                const res = await fetch(url, reqObj);

                // If it's a deletion or new reply, we must reload the data entirely
                if (res.ok && (action === 'delete' || action === 'responses')) {
                    window.EchoState.isFetchingQA = false;
                    window.EchoState.qaDataLoaded = false;
                    await loadQA(); 
                } else if (!res.ok) {
                    console.error(`QA action ${action} failed with status ${res.status}`);
                }
            } catch (err) {
                console.error(`Error performing QA action ${action}:`, err);
            }
        }

        async function createQuestion(lessonId, text, anonymous = false) {
            try {
                const res = await fetch('https://echo360.org/questions', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'Accept': 'application/json, text/javascript, */*; q=0.01',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({
                        removeExistingAttachment: true,
                        body: text,
                        isClassroom: false,
                        sectionId: window.EchoContext.sectionId,
                        lessonId: lessonId,
                        contentReference: false,
                        anonymous: anonymous
                    })
                });
                if (res.ok) {
                    window.EchoState.isFetchingQA = false;
                    window.EchoState.qaDataLoaded = false;
                    await loadQA();
                } else {
                    console.error(`Create question failed with status ${res.status}`);
                }
            } catch (err) {
                console.error('Error creating question:', err);
            }
        }        
        function generateQAHTML(targetLessonId) {
            // Echo360 QA endpoint lessonIds sometimes are compound strings or differ slightly, but they always contain the core UUID
            // E.g. "G_dfa54292-1b8d-4ad6-9dee-5277b1ed1189_05e93c4d-e6..."
            // Target lesson ID might be "05e93c4d-e6..."
            // We use .includes() for robust matching

            if (!window.EchoState.qaDataLoaded) {
                // Ensure loadQA gets called if it hasn't been yet
                loadQA();
                return `<div class="text-center py-4 text-gray-500 dark:text-gray-400 text-sm animate-pulse">Loading Q&A...</div>`;
            }

            const lessonQA = window.EchoState.qaData.filter(q => q.lessonId && targetLessonId && (q.lessonId.includes(targetLessonId) || targetLessonId.includes(q.lessonId)));

            if (lessonQA.length === 0) {
                return `
                <div class="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">No questions have been asked for this class yet.</div>
                <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button data-action="qa-ask" data-lesson-id="${targetLessonId}" class="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-semibold py-2 rounded transition-colors flex items-center justify-center">
                        <i data-lucide="plus" class="w-4 h-4 mr-2"></i> Ask a Question
                    </button>
                </div>`;
            }

            const qs = lessonQA.map(q => {
                let repliesHtml = '';
                if (q.replies && q.replies.length > 0) {
                    repliesHtml = `<div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3 pl-4 border-l-2 border-brand-light/30">`;
                    repliesHtml += q.replies.map(r => `
                        <div class="flex flex-col relative group/reply">
                            <div class="flex justify-between items-start mb-1">
                                <div class="flex items-center space-x-2">
                                    <div class="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500"><i data-lucide="user" class="w-3 h-3"></i></div>
                                    <span class="font-bold text-xs text-gray-800 dark:text-gray-200">${r.author}</span>
                                </div>
                                <div class="flex items-center">
                                    <span class="text-[10px] text-gray-400 whitespace-nowrap ml-2">${r.time}</span>
                                    <button data-action="qa-delete" data-question-id="${r.questionId}" data-reply-id="${r.id}" class="ml-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover/reply:opacity-100" title="Delete Reply"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                                </div>
                            </div>
                            <div class="text-xs text-gray-700 dark:text-gray-300 pl-7">
                                ${r.body}
                            </div>
                        </div>
                    `).join('');
                    repliesHtml += `</div>`;
                }

                const likeColor = q.isLiked ? 'text-brand-light' : 'hover:text-brand-light';
                const likeAction = q.isLiked ? 'dislike' : 'like';
                const bookmarkColor = q.isBookmarked ? 'text-brand-light' : 'hover:text-brand-light';
                const bookmarkAction = q.isBookmarked ? 'forget' : 'bookmark';

                return `
                <div class="bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm flex flex-col relative group">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex items-center space-x-2">
                            <div class="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500"><i data-lucide="user" class="w-3.5 h-3.5"></i></div>
                            <span class="font-bold text-sm text-gray-800 dark:text-gray-200">Student</span>
                        </div>
                        <div class="flex items-center">
                            <span class="text-xs text-gray-400 whitespace-nowrap ml-2">${q.time}</span>   
                            <button data-action="qa-delete" data-question-id="${q.id}" class="ml-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" title="Delete Question"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                        </div>
                    </div>
                    <div class="text-sm text-gray-700 dark:text-gray-300 mb-4 pl-8">
                        ${q.body}
                    </div>
                    <div class="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-3 pl-8">
                        <div class="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 font-medium">
                            <button data-action="qa-toggle-like" data-action-type="${likeAction}" data-question-id="${q.id}" class="flex items-center transition-colors ${likeColor}"><i data-lucide="thumbs-up" class="w-3.5 h-3.5 mr-1.5"></i> ${q.likes}</button>
                            <button data-action="qa-toggle-bookmark" data-action-type="${bookmarkAction}" data-question-id="${q.id}" class="flex items-center transition-colors ${bookmarkColor}"><i data-lucide="bookmark" class="w-3.5 h-3.5 mr-1.5"></i> Bookmark</button>
                            <div class="flex items-center"><i data-lucide="message-square" class="w-3.5 h-3.5 mr-1.5"></i> ${q.responsesCount} replies</div>
                        </div>
                        <button data-action="qa-reply" data-question-id="${q.id}" class="text-xs text-brand-light hover:text-brand-hover font-semibold transition-colors">Reply</button>
                    </div>
                    ${repliesHtml}
                </div>
            `}).join('');

            const askBtnHtml = `
                <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button data-action="qa-ask" data-lesson-id="${targetLessonId}" class="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-semibold py-2 rounded transition-colors flex items-center justify-center">
                        <i data-lucide="plus" class="w-4 h-4 mr-2"></i> Ask a Question
                    </button>
                </div>
            `;

            return `<div class="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">${qs}</div>${askBtnHtml}`;
        }        function renderQA(query = '') {
            const qaContainer = document.getElementById('qaListContainer');
            if (!qaContainer) return;

            if (window.EchoState.qaData.length === 0) {
                qaContainer.innerHTML = '<div class="text-center text-gray-500 mt-10">No questions found.</div>';
                return;
            }
            
            const filtered = window.EchoState.qaData.filter(q => q.title.toLowerCase().includes(query.toLowerCase()) || q.body.toLowerCase().includes(query.toLowerCase()));
            
            if (filtered.length === 0) {
                qaContainer.innerHTML = '<div class="text-center text-gray-500 mt-10">No matching questions.</div>';
                return;
            }

            qaContainer.innerHTML = filtered.map(q => `
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow transition-shadow flex flex-col">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-bold text-sm text-brand-light dark:text-brand-dark">${q.title}</h3>
                        <span class="text-xs text-gray-400 whitespace-nowrap ml-2">${q.time}</span>
                    </div>
                    <div class="text-sm text-gray-700 dark:text-gray-300 mb-4 flex-1">
                        ${q.body}
                    </div>
                    <div class="flex items-center justify-between border-t border-gray-100 dark:border-gray-700/50 pt-3">
                        <div class="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                            <div class="flex items-center"><i data-lucide="thumbs-up" class="w-3.5 h-3.5 mr-1.5"></i> ${q.likes}</div>
                            <div class="flex items-center"><i data-lucide="message-square" class="w-3.5 h-3.5 mr-1.5"></i> ${q.responses} replies</div>
                        </div>
                    </div>
                </div>
            `).join('');
            lucide.createIcons();
        }

        function switchLayout(layout) {
            if (window.EchoState.currentLayout === layout) return;
            window.EchoState.currentLayout = layout;
            
            const btnList = document.getElementById('btn-layout-list');
            const btnGrid = document.getElementById('btn-layout-grid');

            if (layout === 'list') {
                btnList.className = 'flex items-center justify-center w-8 h-8 rounded-md bg-white dark:bg-gray-600 shadow-sm text-brand-light dark:text-brand-dark transition-all focus:outline-none';
                btnGrid.className = 'flex items-center justify-center w-8 h-8 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-all focus:outline-none';
            } else {
                btnGrid.className = 'flex items-center justify-center w-8 h-8 rounded-md bg-white dark:bg-gray-600 shadow-sm text-brand-light dark:text-brand-dark transition-all focus:outline-none';
                btnList.className = 'flex items-center justify-center w-8 h-8 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-all focus:outline-none';
            }

            window.EchoState.activeGridId = null;
            window.EchoState.activeGridIndex = -1;
            renderClasses();
        }

        // ==========================================
        // ADVANCED ECHO360-STYLE PLAYER ARCHITECTURE
        // ==========================================

        function getPlayerHTML(cls) {
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
        const cls = window.EchoState.classData.find(c => c.id === lessonId);

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
                if (typeof showToast === 'function') showToast("Failed to open Pop Out player");
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

        function getGridDropdownHTML(cls, clsId, clickedIndex) {
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

        function renderClasses() {
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

        function toggleDropdown(e, clsId, element) {
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

async function loadData() {
    const client = new EchoApiClient(window.EchoContext.hostname);
    try {
        console.log("[Echo360 Debug] Starting loadData...");

        let syllabus;
        const cachedKey = `echo360_syllabus_${window.EchoContext.sectionId}`;
        const cachedData = localStorage.getItem(cachedKey);
        const cachedTime = localStorage.getItem(`${cachedKey}_time`);

        // Cache valid for 5 minutes (300,000 ms)
        if (cachedData && cachedTime && (Date.now() - parseInt(cachedTime) < 300000)) {
            console.log("[Echo360 Debug] Loading syllabus from cache");
            syllabus = JSON.parse(cachedData);
        } else {
            console.log("[Echo360 Debug] Fetching fresh syllabus from API...");
            syllabus = await client.fetchSyllabus(window.EchoContext.sectionId);
            localStorage.setItem(cachedKey, JSON.stringify(syllabus));
            localStorage.setItem(`${cachedKey}_time`, Date.now().toString());
        }

        console.log(`[Echo360 Debug] Fetched syllabus successfully. Items:`, syllabus?.data?.length);

        window.EchoState.classData = syllabus.data.map((item, index) => {
            const lesson = item.lesson?.lesson;
            const mediaId = extractMediaId(item);

            // The API uses 'hasVideo', but as a fallback we can also just check if we found a mediaId
            const hasVideo = item.lesson?.hasVideo || !!mediaId;

            let date = '';
            let time = '';
            const startUTC = item.lesson?.startTimeUTC;
            const endUTC = item.lesson?.endTimeUTC;
            if (startUTC) {
                const dtStart = new Date(startUTC);
                date = dtStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                const startTimeStr = dtStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().replace(' ', '');
                
                if (endUTC) {
                    const dtEnd = new Date(endUTC);
                    const endTimeStr = dtEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().replace(' ', '');
                    time = `${startTimeStr}-${endTimeStr}`;
                } else {
                    time = startTimeStr;
                }
            }

            const instId = lesson?.institutionId;
            let thumbnail = '';
            if (mediaId && instId) {
                thumbnail = `https://thumbnails.echo360.org/0000.${instId}/${mediaId}/1/poster1.jpg`;
            }

            const savedProg = mediaId ? localStorage.getItem(`echo360_progress_${mediaId}`) : null;
            const progress = savedProg ? parseFloat(savedProg) : 0;
            const isFuture = item.lesson?.isFuture || false;

            const mappedItem = {
                id: lesson?.id || String(index),
                date: date,
                time: time,
                title: lesson?.name || 'Untitled Lesson',
                hasVideo: hasVideo,
                isFuture: isFuture,
                qs: item.lesson?.questionCount || 0,
                progress: progress,
                mediaId: mediaId,
                instId: instId,
                thumbnail: thumbnail,
                lessonData: item,
                titleRaw: lesson?.name || 'Untitled Lesson'
            };

            if (index === 0) {
                console.log(`[Echo360 Debug] Sample mapped window.EchoState.classData item (first row):`, mappedItem);
            }
            return mappedItem;
        });
        console.log("[Echo360 Debug] Mapped window.EchoState.classData. Rendering classes...");
        renderClasses();        console.log("[Echo360 Debug] renderClasses() completed successfully.");
    } catch (e) {
        console.error("[Echo360 Debug] 💥 FATAL ERROR in loadData:", e.stack || e);
        if (typeof showToast === 'function') showToast("Error loading syllabus");
    }
}
async function loadEnrollments() {
    const client = new EchoApiClient(window.EchoContext.hostname);
    try {
        const enrollments = await client.fetchEnrollments();
        if (enrollments && enrollments.data && enrollments.data.length > 0) {
            const data = enrollments.data[0];
            const termsById = data.termsById || {};
            const userSections = data.userSections || [];

            // Update the main header with the actual course name
            const currentCourse = userSections.find(c => c.sectionId === window.EchoContext.sectionId);
            if (currentCourse) {
                const fullTitle = `${currentCourse.courseCode || ''} ${currentCourse.courseName || ''}`.trim();
                if (fullTitle) {
                    document.title = `${fullTitle} | Class List`;
                    const h1El = document.querySelector('h1');
                    if (h1El) h1El.textContent = fullTitle;
                }
            }

            // Group courses by term
            const termsMap = new Map();
            userSections.forEach(sec => {
                const termId = sec.termId;
                if (!termsMap.has(termId)) {
                    termsMap.set(termId, {
                        ...termsById[termId],
                        courses: []
                    });
                }
                termsMap.get(termId).courses.push(sec);
            });
            
            // Sort terms (most recent first, assuming name or startDate)
            const sortedTerms = Array.from(termsMap.values()).sort((a, b) => {
                if (a.startDate && b.startDate) return b.startDate.localeCompare(a.startDate);
                return (b.name || '').localeCompare(a.name || '');
            });
            
            const termList = document.getElementById('term-list');
            
            // Fix: remove the problematic CSS class that causes vertical centering overflow
            termList.classList.remove('parent-flex');
            termList.classList.add('flex', 'flex-col', 'w-full');
            termList.innerHTML = '';
            
            sortedTerms.forEach(term => {
                // Sort courses alphabetically by name
                term.courses.sort((a, b) => (a.courseCode || '').localeCompare(b.courseCode || ''));

                const termLi = document.createElement('li');
                termLi.className = 'border-b border-gray-100 dark:border-gray-800 last:border-0 w-full flex flex-col';
                termLi.innerHTML = `
                    <details class="group [&_summary::-webkit-details-marker]:hidden w-full">
                        <summary class="flex justify-between items-center font-medium cursor-pointer list-none px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-full">
                            <span class="truncate pr-4">${term.name || 'Other'}</span>
                            <span class="transition-transform duration-300 group-open:rotate-180 flex-shrink-0">
                                <i data-lucide="chevron-down" class="w-4 h-4 text-gray-400"></i>
                            </span>
                        </summary>
                        <div class="bg-gray-50 dark:bg-gray-800/50 px-2 py-2 max-h-64 overflow-y-auto w-full">
                            <ul class="space-y-1 w-full flex flex-col">
                                ${term.courses.map(course => `
                                    <li class="w-full flex flex-col">
                                        <a href="${window.EchoContext.hostname}/section/${course.sectionId}/home" class="course-link block w-full px-3 py-2 rounded hover:bg-white dark:hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600 shadow-sm hover:shadow">
                                            <div class="font-bold text-xs text-brand-light dark:text-brand-dark mb-0.5 truncate w-full">${course.courseCode}</div>
                                            <div class="text-sm text-gray-700 dark:text-gray-300 truncate w-full" title="${course.courseName}">${course.courseName}</div>
                                        </a>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </details>
                `;
                termList.appendChild(termLi);
            });
            lucide.createIcons();
        }
    } catch (e) {
        console.error("[Echo360 Debug] Failed to load enrollments:", e);
        document.getElementById('term-list').innerHTML = `<li class="px-4 py-2 text-xs text-red-500 w-full">Error loading courses</li>`;
    }
}
loadEnrollments();
loadData();
setInterval(() => {
    chrome.storage.local.get('echo360_queue_state', ({ echo360_queue_state: state }) => {
        if (!state) return;
        const manager = document.getElementById('download-manager');
        const list = document.getElementById('download-list');
        const activeCount = Object.keys(state.active || {}).length;
        const pendingCount = (state.pending || []).length;
        
        if (activeCount > 0 || pendingCount > 0) {
            manager.classList.remove('translate-y-[150%]', 'opacity-0');
        }
        
        list.innerHTML = '';

        const activeIds = Object.keys(state.active || {});
        document.querySelectorAll('.dl-progress-bar').forEach(bar => {
            const row = bar.closest('.flex.items-center.justify-between') || bar.closest('.grid-card');
            if (row) {
                const cb = row.querySelector('.class-checkbox');
                if (cb && !activeIds.includes(cb.value)) {
                    bar.style.opacity = '0';
                    setTimeout(() => bar.remove(), 500);
                }
            } else {
                bar.remove();
            }
        });

        let allComplete = true;
        let hasDownloads = false;

        for (const [id, dl] of Object.entries(state.active || {})) {
            hasDownloads = true;
            if (dl.status !== 'complete' && dl.status !== 'error') {
                allComplete = false;
            }

            const cls = window.EchoState.classData.find(c => c.id === id) || { titleRaw: 'Video', date: '' };
            let pct = dl.total > 0 ? Math.round((dl.progress / dl.total) * 100) : 0;
            if (pct > 100) pct = 100;

            let statusStr = dl.status === 'error' ? 'Error' : `${pct}%`;
            let statusColor = dl.status === 'error' ? 'text-red-500' : 'text-brand-light';

            list.innerHTML += `
            <div class="bg-white dark:bg-gray-800 p-3 rounded border border-gray-100 dark:border-gray-700 shadow-sm text-sm flex flex-col mb-2">
                <div class="flex justify-between items-center mb-1.5">
                    <span class="font-medium text-gray-800 dark:text-gray-200 truncate pr-2 text-xs">${cls.titleRaw} - ${cls.date}</span>
                    <span class="${statusColor} font-bold text-xs">${statusStr}</span>
                </div>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">      
                    <div class="bg-brand-light h-1.5 rounded-full transition-all duration-300" style="width: ${pct}%"></div>
                </div>
            </div>`;

            const classRowCb = document.querySelector(`.class-checkbox[value="${id}"]`);
            if (classRowCb) {
                const row = classRowCb.closest('.flex.items-center.justify-between') || classRowCb.closest('.grid-card');
                if (row) {
                    let dlProgDiv = row.querySelector('.dl-progress-bar');
                    if (!dlProgDiv) {
                        const container = row.querySelector('.relative.w-20.h-11, .relative.w-full.aspect-video');
                        if (container) {
                            container.insertAdjacentHTML('beforeend', `<div class="dl-progress-bar absolute top-0 left-0 h-1.5 bg-blue-500 z-30 transition-all duration-300 shadow-md" style="width: ${pct}%"></div>`);
                        }
                    } else {
                        dlProgDiv.style.width = `${pct}%`;
                    }
                }
            }
        }
        
        // Auto-close manager if all downloads are finished and it is currently visible
        if (hasDownloads && allComplete) {
            const manager = document.getElementById('download-manager');
            if (manager && !manager.classList.contains('translate-y-[150%]')) {
                setTimeout(() => {
                    closeDownloadManager();
                }, 3000); // Give user 3 seconds to see that it hit 100%
            }
        }        
        (state.pending || []).forEach(p => {
            list.innerHTML += `
            <div class="bg-white dark:bg-gray-800 p-3 rounded border border-gray-100 dark:border-gray-700 shadow-sm text-sm flex flex-col mb-2 opacity-70">
                <div class="flex justify-between items-center mb-1.5">
                    <span class="font-medium text-gray-800 dark:text-gray-200 truncate pr-2 text-xs">${p.title} - ${p.date}</span>
                    <span class="text-gray-500 font-bold text-xs">Queued</span>
                </div>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden"></div>
            </div>`;
        });
    });
}, 1000);

// --- EVENT DELEGATION & BINDINGS ---
document.addEventListener('DOMContentLoaded', () => {
    const el = (id) => document.getElementById(id);
    
    // System Preference Dark Mode Logic
    const themeToggleBtn = el('themeToggle');
    console.log("[Echo360 Theme] Initializing Dark Mode. Button found:", !!themeToggleBtn);

    let isDarkMode = false;

    const updateThemeIcons = (isDark) => {
        const moonIcon = document.getElementById('moonIcon');
        const sunIcon = document.getElementById('sunIcon');
        if (moonIcon && sunIcon) {
            if (isDark) {
                moonIcon.classList.remove('hidden');
                moonIcon.classList.add('block');
                sunIcon.classList.add('hidden');
                sunIcon.classList.remove('block');
            } else {
                moonIcon.classList.add('hidden');
                moonIcon.classList.remove('block');
                sunIcon.classList.remove('hidden');
                sunIcon.classList.add('block');
            }
        }
    };

    const applyTheme = (isDark) => {
        console.log("[Echo360 Theme] Applying theme:", isDark ? 'dark' : 'light');
        isDarkMode = isDark;

        if (isDark) {
            document.documentElement.classList.add('dark');
            document.body.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
            document.body.classList.remove('dark');
        }
        updateThemeIcons(isDark);
    };
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    if (localStorage.theme === 'dark') applyTheme(true);
    else if (localStorage.theme === 'light') applyTheme(false);
    else applyTheme(mediaQuery.matches);

    mediaQuery.addEventListener('change', (e) => {
        if (!localStorage.theme) applyTheme(e.matches);
    });

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            console.log(`[Echo360 Theme] Button clicked. Memory state before: isDarkMode=${isDarkMode}. HTML Classes:`, document.documentElement.className);
            
            // Explicitly invert our memory state
            const newState = !isDarkMode;
            
            // Forcefully apply the state to the DOM
            applyTheme(newState);
            
            console.log(`[Echo360 Theme] State after toggle: isDarkMode=${isDarkMode}. HTML Classes:`, document.documentElement.className);
            localStorage.theme = newState ? 'dark' : 'light';
        });
    } else {
        console.error("[Echo360 Theme] 💥 FATAL: themeToggle button was not found in the DOM!");
    }

    if (el('toggleSelectionModeBtn')) el('toggleSelectionModeBtn').addEventListener('click', toggleSelectionMode);
    if (el('selectAllCheckbox')) el('selectAllCheckbox').addEventListener('change', (e) => toggleSelectAll(e.target.checked));
    if (el('downloadSelectedBtn')) el('downloadSelectedBtn').addEventListener('click', downloadSelected);
    if (el('searchInput')) el('searchInput').addEventListener('input', (e) => handleSearch(e.target.value));
    if (el('btn-layout-list')) el('btn-layout-list').addEventListener('click', () => switchLayout('list'));
    if (el('btn-layout-grid')) el('btn-layout-grid').addEventListener('click', () => switchLayout('grid'));
    if (el('closeDownloadManagerBtn')) el('closeDownloadManagerBtn').addEventListener('click', closeDownloadManager);
    
    // Sort logic bindings
    if (el('sortSelect')) {
        el('sortSelect').addEventListener('change', (e) => {
            window.EchoState.sortMode = e.target.value;
            renderClasses();
        });
    }

    // Tab switching bindings
    if (el('tab-classes')) el('tab-classes').addEventListener('click', (e) => { e.preventDefault(); switchTab('tab-classes'); });
    if (el('tab-search')) el('tab-search').addEventListener('click', (e) => { e.preventDefault(); switchTab('tab-search'); });

    // Transcript Search bindings
    if (el('executeSearchBtn')) {
        el('executeSearchBtn').addEventListener('click', () => {
            const val = el('transcriptSearchInput')?.value;
            if (val) executeSearch(val);
        });
    }
    if (el('transcriptSearchInput')) {
        el('transcriptSearchInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const val = e.target.value;
                if (val) executeSearch(val);
            }
        });
    }

    // Q&A Sidebar Bindings
    const openQASidebarTab = el('openQASidebarTab');
    const qaSidebarBtn = el('qaSidebarBtn');
    const qaSidebarOverlay = el('qaSidebarOverlay');
    const qaSidebar = el('qaSidebar');
    const closeQASidebarBtn = el('closeQASidebarBtn');
    const qaSearchInput = el('qaSearchInput');

    const toggleQASidebar = (show) => {
        if (show) {
            qaSidebarOverlay.classList.remove('opacity-0', 'pointer-events-none');
            qaSidebar.classList.remove('translate-x-full');
            loadQA(); // fetch the latest questions
        } else {
            qaSidebarOverlay.classList.add('opacity-0', 'pointer-events-none');
            qaSidebar.classList.add('translate-x-full');
        }
    };

    if (openQASidebarTab) openQASidebarTab.addEventListener('click', (e) => { e.preventDefault(); toggleQASidebar(true); });
    if (qaSidebarBtn) qaSidebarBtn.addEventListener('click', () => toggleQASidebar(true));
    if (closeQASidebarBtn) closeQASidebarBtn.addEventListener('click', () => toggleQASidebar(false));
    if (qaSidebarOverlay) qaSidebarOverlay.addEventListener('click', () => toggleQASidebar(false));
    if (qaSearchInput) qaSearchInput.addEventListener('input', (e) => renderQA(e.target.value));

    if (el('coursesDropdownBtn')) {
        el('coursesDropdownBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = el('coursesDropdownMenu');
            const icon = el('coursesDropdownIcon');
            menu.classList.toggle('hidden');
            if (icon) icon.classList.toggle('rotate-180');
        });
        
        document.addEventListener('click', (e) => {
            const menu = el('coursesDropdownMenu');
            const btn = el('coursesDropdownBtn');
            if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && !btn.contains(e.target)) {
                menu.classList.add('hidden');
                const icon = el('coursesDropdownIcon');
                if (icon) icon.classList.remove('rotate-180');
            }
        });
    }

    // The themeToggle event listener has been consolidated into the top-level initialization block.

    document.body.addEventListener('click', (e) => {
        const courseLink = e.target.closest('.course-link');
        if (courseLink) {
            e.preventDefault();
            e.stopPropagation();
            const url = courseLink.getAttribute('href');
            // Safely attempt to navigate the parent, but fallback to the iframe itself if blocked by Cross-Origin rules
            try {
                if (window.parent && window.parent !== window) {
                    window.parent.location.href = url;
                } else {
                    window.location.href = url;
                }
            } catch (err) {
                // SecurityError: Cross-Origin parent.
                // We cannot push the URL up to the LMS container, so navigate the Echo360 iframe directly.
                console.warn("[Echo360 Debug] Cross-Origin parent blocked navigation. Navigating iframe directly.");
                window.location.href = url;
            }
            return;
        }

        const target = e.target.closest('[data-action]');
        if (!target) return;
        
        const action = target.getAttribute('data-action');
        const id = target.getAttribute('data-id');
        
        if (action === 'toggleDropdown') {
            toggleDropdown(e, id, target);
        } else if (action === 'handleDownload') {
            e.stopPropagation();
            e.preventDefault();
            handleDownload(e, id);
        } else if (action === 'toggleDropdownGrid') {
            e.stopPropagation();
            const idx = target.getAttribute('data-index');
            const gridCard = document.querySelectorAll('.grid-card')[idx];
            if (gridCard) toggleDropdown(e, id, gridCard);
        } else if (action.startsWith('qa-')) {
            e.stopPropagation();
            e.preventDefault();
            const questionId = target.getAttribute('data-question-id');
            const replyId = target.getAttribute('data-reply-id');
            const actionType = target.getAttribute('data-action-type');
            
            if (action === 'qa-ask') {
                const lessonId = target.getAttribute('data-lesson-id');
                const t = prompt('Ask a question:');
                if (t) createQuestion(lessonId, t, false);
            } else if (action === 'qa-reply') {
                const t = prompt('Enter reply:');
                if (t) interactQA('responses', questionId, {removeExistingAttachment:true, body:t, anonymous:false});
            } else if (action === 'qa-toggle-like') {
                interactQA(actionType || 'like', questionId);
            } else if (action === 'qa-toggle-bookmark') {
                interactQA(actionType || 'bookmark', questionId);
            } else if (action === 'qa-delete') {
                if (replyId) {
                    if (confirm('Are you sure you want to delete this reply?')) {
                        interactQA('delete', replyId);
                    }
                } else {
                    if (confirm('Are you sure you want to delete this question?')) {
                        interactQA('delete', questionId);
                    }
                }
            }
        }
    });

    document.body.addEventListener('change', (e) => {
        const target = e.target.closest('[data-action="toggleSelection"]');
        if (target) {
            const id = target.getAttribute('data-id');
            toggleSelection(id);
        }
    });
});\nwindow.handleSearch = handleSearch;\nwindow.executeSearch = executeSearch;\n