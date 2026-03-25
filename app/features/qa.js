import { state } from '../store.js';

export async function window.loadQA() {
            if (window.EchoState.window.EchoState.qaDataLoaded || window.EchoState.isFetchingQA) return;
            window.EchoState.isFetchingQA = true;
            try {
                const res = await fetch(`https://echo360.org/questions/search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ window.EchoContext.sectionId: window.EchoContext.sectionId, isClassroom: false, sortDirection: 'desc', pageNumber: 0, requested: true })
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
                    window.EchoState.window.EchoState.qaDataLoaded = true;

                    // Re-render any currently open dropdowns to show loaded QA
                    document.querySelectorAll('.qa-section-container').forEach(container => {
                        const containerLessonId = container.getAttribute('data-lesson-id');
                        if (containerLessonId) {
                            container.innerHTML = generateQAHTML(containerLessonId);
                            lucide.createIcons({ root: container });
                        }
                    });

                    const qaContainer = document.getElementById('qaListContainer');
                    if (qaContainer) window.renderQA();
                }
            } catch (e) {
                console.error("Error loading Q&A:", e);
            } finally {
                window.EchoState.isFetchingQA = false;
            }
        }

        export async function interactQA(action, questionId, bodyData = null) {
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
                    window.EchoState.window.EchoState.qaDataLoaded = false;
                    await window.loadQA(); 
                } else if (!res.ok) {
                    console.error(`QA action ${action} failed with status ${res.status}`);
                }
            } catch (err) {
                console.error(`Error performing QA action ${action}:`, err);
            }
        }

        export async function createQuestion(lessonId, text, anonymous = false) {
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
                        window.EchoContext.sectionId: window.EchoContext.sectionId,
                        lessonId: lessonId,
                        contentReference: false,
                        anonymous: anonymous
                    })
                });
                if (res.ok) {
                    window.EchoState.isFetchingQA = false;
                    window.EchoState.window.EchoState.qaDataLoaded = false;
                    await window.loadQA();
                } else {
                    console.error(`Create question failed with status ${res.status}`);
                }
            } catch (err) {
                console.error('Error creating question:', err);
            }
        }        
        export function generateQAHTML(targetLessonId) {
            // Echo360 QA endpoint lessonIds sometimes are compound strings or differ slightly, but they always contain the core UUID
            // E.g. "G_dfa54292-1b8d-4ad6-9dee-5277b1ed1189_05e93c4d-e6..."
            // Target lesson ID might be "05e93c4d-e6..."
            // We use .includes() for robust matching

            if (!window.EchoState.window.EchoState.qaDataLoaded) {
                // Ensure window.loadQA gets called if it hasn't been yet
                window.loadQA();
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
        }        export function window.renderQA(query = '') {
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
            if (currentLayout === layout) return;
            currentLayout = layout;
            
            const btnList = document.getElementById('btn-layout-list');
            const btnGrid = document.getElementById('btn-layout-grid');

            if (layout === 'list') {
                btnList.className = 'flex items-center justify-center w-8 h-8 rounded-md bg-white dark:bg-gray-600 shadow-sm text-brand-light dark:text-brand-dark transition-all focus:outline-none';
                btnGrid.className = 'flex items-center justify-center w-8 h-8 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-all focus:outline-none';
            } else {
                btnGrid.className = 'flex items-center justify-center w-8 h-8 rounded-md bg-white dark:bg-gray-600 shadow-sm text-brand-light dark:text-brand-dark transition-all focus:outline-none';
                btnList.className = 'flex items-center justify-center w-8 h-8 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-all focus:outline-none';
            }

            activeGridId = null;
            activeGridIndex = -1;
            renderClasses();
        }

        
window.loadQA = loadQA;
window.interactQA = interactQA;
window.createQuestion = createQuestion;
window.generateQAHTML = generateQAHTML;
window.renderQA = renderQA;
