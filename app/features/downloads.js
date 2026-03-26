import { state, activeDownloads } from '../store.js';

export function handleDownload(event, id) {
            event.stopPropagation();
            startDownloads([id]);
        }

        export function downloadSelected() {
            const ids = Array.from(selectedClasses);
            startDownloads(ids);
            
            selectedClasses.clear();
            document.querySelectorAll('.class-checkbox').forEach(cb => cb.checked = false);
            updateSelectionUI();
        }

        export function startDownloads(ids) {
            const lessonsToDownload = ids.map(id => {
                const cls = classData.find(c => c.id === id);
                return { lessonId: cls.id, title: cls.titleRaw, date: cls.date, sectionId: sectionId, hostname: hostname, courseName: courseName };
            });
            chrome.runtime.sendMessage({ type: 'START_DOWNLOADS', payload: { lessons: lessonsToDownload, hostname: hostname } });
            if (typeof showToast === 'function') window.showToast(`Queued ${lessonsToDownload.length} downloads`);       
        };
        export function closeDownloadManager() {
            document.getElementById('download-manager').classList.add('translate-y-[150%]', 'opacity-0');
        }

        export function handleSearch(query) {
            searchQuery = query.toLowerCase();
            if (activeGridId !== null) {
                const globalDropdown = document.getElementById('global-grid-dropdown');
                if(globalDropdown) globalDropdown.classList.remove('open');
                activeGridId = null;
                activeGridIndex = -1;
            }
            
            // Clear selection on search
            selectedClasses.clear();
            updateSelectionUI();

            renderClasses();
        }

        
window.startDownloads = startDownloads;
window.closeDownloadManager = closeDownloadManager;
window.handleDownload = handleDownload;
window.downloadSelected = downloadSelected;
