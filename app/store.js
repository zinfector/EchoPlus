export const state = {
    classData: [], currentLayout: 'list', activeGridId: null, activeGridIndex: -1,
    searchQuery: '', sortMode: 'custom', isSelectionMode: false, selectedClasses: new Set(),
    qaData: [], qaDataLoaded: false, isFetchingQA: false, searchData: []
};
window.EchoState = state;
export const activeDownloads = new Map();
window.activeDownloads = activeDownloads;
const urlParams = new URLSearchParams(window.location.search);
export const sectionId = urlParams.get('sectionId');
export const hostname = urlParams.get('hostname');
export const courseName = urlParams.get('courseName') || 'Echo360 Course';
window.EchoContext = { sectionId, hostname, courseName };
