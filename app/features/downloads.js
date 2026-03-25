import { state, activeDownloads } from '../store.js';\n\nexport function handleDownload(event, id) {
            event.stopPropagation();
            startDownloads([id]);
        }

        export function downloadSelected() {
            const ids = Array.from(window.EchoState.selectedClasses);
            startDownloads(ids);
            
            window.EchoState.selectedClasses.clear();
            document.querySelectorAll('.class-checkbox').forEach(cb => cb.checked = false);
            updateSelectionUI();
        }

        export function startDownloads(ids) {
            const lessonsToDownload = ids.map(id => {
                const cls = window.EchoState.classData.find(c => c.id === id);
                return { lessonId: cls.id, title: cls.titleRaw, date: cls.date, sectionId: window.EchoContext.sectionId, hostname: window.EchoContext.hostname, courseName: window.EchoContext.courseName };
            });
            chrome.runtime.sendMessage({ type: 'START_DOWNLOADS', payload: { lessons: lessonsToDownload, hostname: window.EchoContext.hostname } });
            if (typeof showToast === 'function') showToast(`Queued ${lessonsToDownload.length} downloads`);       
        };
        export function closeDownloadManager() {
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

        \nwindow.startDownloads = startDownloads;\nwindow.closeDownloadManager = closeDownloadManager;\nwindow.handleDownload = handleDownload;\nwindow.downloadSelected = downloadSelected;\n