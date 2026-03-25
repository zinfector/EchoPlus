export let isDarkMode = false;

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
    \nexport const initTheme = () => {\nconst mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

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
            sortMode = e.target.value;
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
});\n};\nwindow.applyTheme = applyTheme;\nwindow.updateThemeIcons = updateThemeIcons;\n