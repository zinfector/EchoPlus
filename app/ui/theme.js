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
    
export const initTheme = () => {

};
window.applyTheme = applyTheme;
window.updateThemeIcons = updateThemeIcons;
