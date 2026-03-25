import { state, activeDownloads } from '../store.js';

export function handleDownload(event, id) {
            event.stopPropagation();
            startDownloads([id]);
        }

        export function downloadSelected() {
            const ids = Array.from(window.EchoState.selectedClasses);
            startDownloads(ids);
            
            window.EchoState.selectedClasses.clear();
            document.querySelectorAll('.class-checkbox').forEach(cb => cb.checked = false);
            window.updateSelectionUI();
        }

        export function startDownloads(ids) {
            const lessonsToDownload = ids.map(id => {
                const cls = window.EchoState.classData.find(c => c.id === id);
                return { lessonId: cls.id, title: cls.titleRaw, date: cls.date, window.EchoContext.sectionId: window.EchoContext.sectionId, window.EchoContext.hostname: window.EchoContext.hostname, window.EchoContext.courseName: window.EchoContext.courseName };
            });
            chrome.runtime.sendMessage({ type: 'START_DOWNLOADS', payload: { lessons: lessonsToDownload, window.EchoContext.hostname: window.EchoContext.hostname } });
            if (typeof window.showToast === 'function') window.showToast(`Queued ${lessonsToDownload.length} downloads`);       
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
            window.EchoState.selectedClasses.clear();
            window.updateSelectionUI();

            renderClasses();
        }

        
window.startDownloads = startDownloads;
window.closeDownloadManager = closeDownloadManager;
window.handleDownload = handleDownload;
window.downloadSelected = downloadSelected;
