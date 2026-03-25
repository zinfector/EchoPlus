const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, 'app');
const oldAppPath = path.join(appDir, 'app_old.js');
const newAppPath = path.join(appDir, 'app.js');

const code = fs.readFileSync(fs.existsSync(oldAppPath) ? oldAppPath : newAppPath, 'utf8');

function getBetween(startStr, endStr) {
    const start = code.indexOf(startStr);
    if (start === -1) return '';
    const end = endStr ? code.indexOf(endStr, start) : code.length;
    if (end === -1) return '';
    return code.substring(start, end);
}

['data', 'features', 'ui'].forEach(dir => {
    const d = path.join(appDir, dir);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

fs.writeFileSync(path.join(appDir, 'store.js'), `
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
`);

let toast = getBetween('function showToast(message)', '// --- Selection Mode Logic ---').replace('function showToast', 'export function showToast');
fs.writeFileSync(path.join(appDir, 'ui', 'toast.js'), `${toast}
window.showToast = showToast;
`);

let theme1 = getBetween('let isDarkMode = false;', 'const mediaQuery = window.matchMedia');
let theme2 = getBetween('const mediaQuery = window.matchMedia', '// --- Selection Mode Logic ---');
fs.writeFileSync(path.join(appDir, 'ui', 'theme.js'), `export ${theme1}
export const initTheme = () => {
${theme2}
};
window.applyTheme = applyTheme;
window.updateThemeIcons = updateThemeIcons;
`);

let sel = getBetween('function toggleSelectionMode()', '// --- Download Logic ---')
    .replace(/isSelectionMode/g, 'window.EchoState.isSelectionMode')
    .replace(/selectedClasses/g, 'window.EchoState.selectedClasses')
    .replace(/classData/g, 'window.EchoState.classData')
    .replace(/searchQuery/g, 'window.EchoState.searchQuery')
    .replace(/currentLayout/g, 'window.EchoState.currentLayout')
    .replace(/activeGridId/g, 'window.EchoState.activeGridId')
    .replace(/activeGridIndex/g, 'window.EchoState.activeGridIndex')
    .replace(/function toggle/g, 'export function toggle')
    .replace(/function update/g, 'export function update');
fs.writeFileSync(path.join(appDir, 'features', 'selection.js'), `import { state } from '../store.js';

${sel}
window.toggleSelectionMode = toggleSelectionMode;
window.toggleSelection = toggleSelection;
window.toggleSelectAll = toggleSelectAll;
window.updateSelectionUI = updateSelectionUI;
`);

let dl = getBetween('function handleDownload(event, id)', '// --- Transcript Search Logic ---')
    .replace(/function handle/g, 'export function handle')
    .replace(/function download/g, 'export function download')
    .replace(/window\.startDownloads = function/g, 'export function startDownloads')
    .replace(/function close/g, 'export function close')
    .replace(/selectedClasses/g, 'window.EchoState.selectedClasses')
    .replace(/classData/g, 'window.EchoState.classData')
    .replace(/sectionId/g, 'window.EchoContext.sectionId')
    .replace(/hostname/g, 'window.EchoContext.hostname')
    .replace(/courseName/g, 'window.EchoContext.courseName')
    .replace(/showToast/g, 'window.showToast')
    .replace(/updateSelectionUI/g, 'window.updateSelectionUI');
fs.writeFileSync(path.join(appDir, 'features', 'downloads.js'), `import { state, activeDownloads } from '../store.js';

${dl}
window.startDownloads = startDownloads;
window.closeDownloadManager = closeDownloadManager;
window.handleDownload = handleDownload;
window.downloadSelected = downloadSelected;
`);

let search = getBetween('function handleSearch(query)', '// --- Q&A Logic ---')
    .replace('function handleSearch', 'export function handleSearch')
    .replace('async function executeSearch', 'export async function executeSearch')
    .replace(/searchQuery/g, 'window.EchoState.searchQuery')
    .replace(/activeGridId/g, 'window.EchoState.activeGridId')
    .replace(/activeGridIndex/g, 'window.EchoState.activeGridIndex')
    .replace(/selectedClasses/g, 'window.EchoState.selectedClasses')
    .replace(/sectionId/g, 'window.EchoContext.sectionId')
    .replace(/classData/g, 'window.EchoState.classData')
    .replace(/searchData/g, 'window.EchoState.searchData')
    .replace(/getPlayerHTML/g, 'window.getPlayerHTML')
    .replace(/initEchoPlayer/g, 'window.initEchoPlayer')
    .replace(/renderClasses/g, 'window.renderClasses')
    .replace(/updateSelectionUI/g, 'window.updateSelectionUI');
fs.writeFileSync(path.join(appDir, 'features', 'search.js'), `import { state } from '../store.js';

${search}
window.handleSearch = handleSearch;
window.executeSearch = executeSearch;
`);

let qa = getBetween('async function loadQA()', '// ==========================================')
    .replace('async function loadQA', 'export async function loadQA')
    .replace('async function interactQA', 'export async function interactQA')
    .replace('async function createQuestion', 'export async function createQuestion')
    .replace('function generateQAHTML', 'export function generateQAHTML')
    .replace("function renderQA(query = '')", "export function renderQA(query = '')")
    .replace(/qaDataLoaded/g, 'window.EchoState.qaDataLoaded')
    .replace(/isFetchingQA/g, 'window.EchoState.isFetchingQA')
    .replace(/qaData/g, 'window.EchoState.qaData')
    .replace(/sectionId/g, 'window.EchoContext.sectionId')
    .replace(/renderQA/g, 'window.renderQA')
    .replace(/loadQA/g, 'window.loadQA');
fs.writeFileSync(path.join(appDir, 'features', 'qa.js'), `import { state } from '../store.js';

${qa}
window.loadQA = loadQA;
window.interactQA = interactQA;
window.createQuestion = createQuestion;
window.generateQAHTML = generateQAHTML;
window.renderQA = renderQA;
`);

let player = getBetween('function getPlayerHTML(cls)', 'function getGridDropdownHTML')
    .replace('function getPlayerHTML', 'export function getPlayerHTML')
    .replace('async function initEchoPlayer', 'export async function initEchoPlayer')
    .replace(/hostname/g, 'window.EchoContext.hostname')
    .replace(/showToast/g, 'window.showToast');
fs.writeFileSync(path.join(appDir, 'ui', 'player.js'), `import { resolveVideoUrl } from '../../lib/video-resolver.js';

${player}
window.getPlayerHTML = getPlayerHTML;
window.initEchoPlayer = initEchoPlayer;
`);

let renderer = getBetween('function getGridDropdownHTML(cls, clsId, clickedIndex)', 'async function loadData()')
    .replace('function getGridDropdownHTML', 'export function getGridDropdownHTML')
    .replace('function renderClasses()', 'export function renderClasses')
    .replace('function toggleDropdown', 'export function toggleDropdown')
    .replace(/classData/g, 'window.EchoState.classData')
    .replace(/currentLayout/g, 'window.EchoState.currentLayout')
    .replace(/activeGridId/g, 'window.EchoState.activeGridId')
    .replace(/activeGridIndex/g, 'window.EchoState.activeGridIndex')
    .replace(/searchQuery/g, 'window.EchoState.searchQuery')
    .replace(/sortMode/g, 'window.EchoState.sortMode')
    .replace(/isSelectionMode/g, 'window.EchoState.isSelectionMode')
    .replace(/selectedClasses/g, 'window.EchoState.selectedClasses')
    .replace(/getPlayerHTML/g, 'window.getPlayerHTML')
    .replace(/generateQAHTML/g, 'window.generateQAHTML')
    .replace(/initEchoPlayer/g, 'window.initEchoPlayer');
fs.writeFileSync(path.join(appDir, 'ui', 'renderer.js'), `import { state } from '../store.js';

${renderer}
window.getGridDropdownHTML = getGridDropdownHTML;
window.renderClasses = renderClasses;
window.toggleDropdown = toggleDropdown;
`);

let loader = getBetween('async function loadData()', 'setInterval(() => {')
    .replace('async function loadData', 'export async function loadData')
    .replace('async function loadEnrollments', 'export async function loadEnrollments')
    .replace(/sectionId/g, 'window.EchoContext.sectionId')
    .replace(/hostname/g, 'window.EchoContext.hostname')
    .replace(/classData/g, 'window.EchoState.classData')
    .replace(/renderClasses/g, 'window.renderClasses')
    .replace(/showToast/g, 'window.showToast');
fs.writeFileSync(path.join(appDir, 'data', 'loader.js'), `import { EchoApiClient } from '../../lib/api-client.js';
import { extractMediaId } from '../../lib/download-queue.js';
import { state } from '../store.js';

${loader}
window.loadData = loadData;
window.loadEnrollments = loadEnrollments;
`);

let cache = getBetween('const cachedKey', 'setInterval(() => {').replace(/classData/g, 'window.EchoState.classData');
let poller = getBetween('setInterval(() => {', 'loadEnrollments();').replace(/classData/g, 'window.EchoState.classData');
let bindings = code.substring(code.indexOf("document.addEventListener('DOMContentLoaded'"));

let mainApp = `
import { state, activeDownloads, sectionId, hostname, courseName } from './store.js';
import { initTheme } from './ui/theme.js';
import './ui/toast.js';
import './features/selection.js';
import './features/downloads.js';
import './features/search.js';
import './features/qa.js';
import './ui/player.js';
import './ui/renderer.js';
import { loadData, loadEnrollments } from './data/loader.js';
import { extractMediaId } from '../lib/download-queue.js';

window.switchTab = function(tabId) {
    const tabs = ['tab-classes', 'tab-search'];
    tabs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('text-brand-light', 'dark:text-brand-dark', 'border-brand-light', 'dark:border-brand-dark');
            el.classList.add('text-gray-500', 'hover:text-gray-800', 'dark:text-gray-400', 'dark:hover:text-gray-200', 'border-transparent');
        }
    });

    const activeTab = document.getElementById(tabId);
    if (activeTab) {
        activeTab.classList.add('text-brand-light', 'dark:text-brand-dark', 'border-brand-light', 'dark:border-brand-dark');
        activeTab.classList.remove('text-gray-500', 'hover:text-gray-800', 'dark:text-gray-400', 'dark:hover:text-gray-200', 'border-transparent');
    }

    if (tabId === 'tab-classes') {
        document.getElementById('classesControls').classList.remove('hidden');
        document.getElementById('classesControls').classList.add('flex');
        document.getElementById('classList').classList.remove('hidden');
        document.getElementById('searchControls').classList.remove('flex');
        document.getElementById('searchControls').classList.add('hidden');
        document.getElementById('searchList').classList.remove('flex');
        document.getElementById('searchList').classList.add('hidden');
        document.querySelectorAll('#searchList video').forEach(v => v.pause());
    } else if (tabId === 'tab-search') {
        document.getElementById('classesControls').classList.remove('flex');
        document.getElementById('classesControls').classList.add('hidden');
        document.getElementById('classList').classList.add('hidden');
        document.getElementById('searchControls').classList.remove('hidden');
        document.getElementById('searchControls').classList.add('flex');
        document.getElementById('searchList').classList.remove('hidden');
        document.getElementById('searchList').classList.add('flex');
        document.querySelectorAll('#classList video').forEach(v => v.pause());
    }
};

window.switchLayout = function(layout) {
    if (window.EchoState.currentLayout === layout) return;
    window.EchoState.currentLayout = layout;
    const btnList = document.getElementById('btn-layout-list');
    const btnGrid = document.getElementById('btn-layout-grid');
    if (layout === 'list') {
        btnList.className = 'flex items-center justify-center w-8 h-8 rounded-md bg-white dark:bg-gray-600 shadow-sm text-brand-light dark:text-brand-dark transition-all focus:outline-none';
        btnGrid.className = 'flex items-center justify-center w-8 h-8 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-all focus:outline-none';
    } else {
        btnGrid.className = 'flex items-center justify-center w-8 h-8 rounded-md bg-white dark:bg-gray-600 shadow-sm text-brand-light dark:text-brand-dark transition-all focus:outline-none';
        btnList.className = 'flex items-center justify-center w-8 h-8 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-all focus:outline-none';
    }
    window.EchoState.activeGridId = null;
    window.EchoState.activeGridIndex = -1;
    window.renderClasses();
};

document.title = courseName + ' | Class List';
document.querySelector('h1').textContent = courseName;

const cachedKey = ${cache}
setInterval(() => {${poller}
${bindings}
`;

if (!fs.existsSync(oldAppPath)) fs.renameSync(newAppPath, oldAppPath);
fs.writeFileSync(newAppPath, mainApp);

console.log("Refactoring complete.");
