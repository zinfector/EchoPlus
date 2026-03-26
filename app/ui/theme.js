export let isDarkMode = false;

export const updateThemeIcons = (isDark) => {
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

export const applyTheme = (isDark) => {
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

export const initTheme = () => {
    const themeToggleBtn = document.getElementById('themeToggle');
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
            const newState = !isDarkMode;
            applyTheme(newState);
            console.log(`[Echo360 Theme] State after toggle: isDarkMode=${isDarkMode}. HTML Classes:`, document.documentElement.className);
            localStorage.theme = newState ? 'dark' : 'light';
        });
    } else {
        console.error("[Echo360 Theme] 💥 FATAL: themeToggle button was not found in the DOM!");
    }
};

window.applyTheme = applyTheme;
window.updateThemeIcons = updateThemeIcons;
