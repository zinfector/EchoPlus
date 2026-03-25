import { state } from '../store.js';

export function toggleSelectionMode() {
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
        export function toggleSelection(id) {
            if (window.EchoState.selectedClasses.has(id)) {
                window.EchoState.selectedClasses.delete(id);
            } else {
                window.EchoState.selectedClasses.add(id);
            }
            updateSelectionUI();
        }

        export function toggleSelectAll(checked) {
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

        export function updateSelectionUI() {
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

        
window.toggleSelectionMode = toggleSelectionMode;
window.toggleSelection = toggleSelection;
window.toggleSelectAll = toggleSelectAll;
window.updateSelectionUI = updateSelectionUI;
