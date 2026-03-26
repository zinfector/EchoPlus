import { state } from '../store.js';

export function toggleSelectionMode() {
            isSelectionMode = !isSelectionMode;
            const container = document.getElementById('classList');
            const controls = document.getElementById('selectionControls');
            const toggleBtnSpan = document.querySelector('#toggleSelectionModeBtn span');

            if (isSelectionMode) {
                container.classList.add('selection-mode');
                controls.classList.add('show');
                toggleBtnSpan.innerText = 'Cancel Selection';
                
                // If we are in grid layout and a video is open, close it to avoid layout issues during selection
                if (currentLayout === 'grid' && activeGridId !== null) {
                    const globalDropdown = document.getElementById('global-grid-dropdown');
                    if (globalDropdown) globalDropdown.classList.remove('open');
                    activeGridId = null;
                    activeGridIndex = -1;
                }
            } else {
                container.classList.remove('selection-mode');
                controls.classList.remove('show');
                
                toggleBtnSpan.innerText = 'Select to Download';
                
                // Clear selection when exiting mode
                selectedClasses.clear();
                document.querySelectorAll('.class-checkbox').forEach(cb => cb.checked = false);
                updateSelectionUI();
            }
        }

        // --- Selection Logic ---
        export function toggleSelection(id) {
            if (selectedClasses.has(id)) {
                selectedClasses.delete(id);
            } else {
                selectedClasses.add(id);
            }
            updateSelectionUI();
        }

        export function toggleSelectAll(checked) {
            const filteredData = classData.filter(cls => 
                (cls.title.toLowerCase().includes(searchQuery) || 
                cls.date.toLowerCase().includes(searchQuery) ||
                cls.time.toLowerCase().includes(searchQuery)) && cls.hasVideo
            );
            
            if (checked) {
                filteredData.forEach(cls => selectedClasses.add(cls.id));
            } else {
                selectedClasses.clear();
            }
            
            document.querySelectorAll('.class-checkbox').forEach(cb => {
                cb.checked = selectedClasses.has(parseInt(cb.value));
            });
            updateSelectionUI();
        }

        export function updateSelectionUI() {
            const btnContainer = document.getElementById('downloadBtnContainer');
            const countSpan = document.getElementById('selectedCount');
            const selectAllCb = document.getElementById('selectAllCheckbox');
            
            const filteredWithVideo = classData.filter(cls => 
                (cls.title.toLowerCase().includes(searchQuery) || 
                cls.date.toLowerCase().includes(searchQuery) ||
                cls.time.toLowerCase().includes(searchQuery)) && cls.hasVideo
            );

            if (selectedClasses.size > 0) {
                btnContainer.classList.add('show');
                countSpan.innerText = selectedClasses.size;
            } else {
                btnContainer.classList.remove('show');
            }
            
            if (filteredWithVideo.length > 0 && selectedClasses.size === filteredWithVideo.length) {
                selectAllCb.checked = true;
                selectAllCb.indeterminate = false;
            } else if (selectedClasses.size > 0) {
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
