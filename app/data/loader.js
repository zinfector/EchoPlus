import { EchoApiClient } from '../../lib/api-client.js';
import { extractMediaId } from '../../lib/download-queue.js';
import { state } from '../store.js';

export async function loadData() {
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
        window.renderClasses();        console.log("[Echo360 Debug] window.renderClasses() completed successfully.");
    } catch (e) {
        console.error("[Echo360 Debug] 💥 FATAL ERROR in loadData:", e.stack || e);
        if (typeof window.showToast === 'function') window.showToast("Error loading syllabus");
    }
}
export async function loadEnrollments() {
    const client = new EchoApiClient(window.EchoContext.hostname);
    try {
        const enrollments = await client.fetchEnrollments();
        if (enrollments && enrollments.data && enrollments.data.length > 0) {
            const data = enrollments.data[0];
            const termsById = data.termsById || {};
            const userSections = data.userSections || [];

            // Update the main header with the actual course name
            const currentCourse = userSections.find(c => c.window.EchoContext.sectionId === window.EchoContext.sectionId);
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
                                        <a href="${window.EchoContext.hostname}/section/${course.window.EchoContext.sectionId}/home" class="course-link block w-full px-3 py-2 rounded hover:bg-white dark:hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600 shadow-sm hover:shadow">
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

window.loadData = loadData;
window.loadEnrollments = loadEnrollments;
