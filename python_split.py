import os

app_dir = os.path.dirname(os.path.abspath(__file__))
app_js_path = os.path.join(app_dir, 'app', 'app.js')
if not os.path.exists(app_js_path):
    app_js_path = os.path.join(app_dir, 'app', 'app_old.js')

with open(app_js_path, 'r', encoding='utf-8') as f:
    code = f.read()

def get_between(s, e):
    start = code.find(s)
    if start == -1: return ""
    if e:
        end = code.find(e, start)
        return code[start:end]
    return code[start:]

os.makedirs(os.path.join(app_dir, 'app', 'data'), exist_ok=True)
os.makedirs(os.path.join(app_dir, 'app', 'features'), exist_ok=True)
os.makedirs(os.path.join(app_dir, 'app', 'ui'), exist_ok=True)

store_js = """export const state = {
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
"""
with open(os.path.join(app_dir, 'app', 'store.js'), 'w', encoding='utf-8') as f: f.write(store_js)

toast_js = get_between('function showToast(message)', '// --- Selection Mode Logic ---').replace('function showToast', 'export function showToast') + "\\nwindow.showToast = showToast;\\n"
with open(os.path.join(app_dir, 'app', 'ui', 'toast.js'), 'w', encoding='utf-8') as f: f.write(toast_js)

theme1 = get_between('let isDarkMode = false;', 'const mediaQuery = window.matchMedia')
theme2 = get_between('const mediaQuery = window.matchMedia', '// --- Selection Mode Logic ---')
theme_js = "export " + theme1 + "\\nexport const initTheme = () => {\\n" + theme2 + "\\n};\\nwindow.applyTheme = applyTheme;\\nwindow.updateThemeIcons = updateThemeIcons;\\n"
with open(os.path.join(app_dir, 'app', 'ui', 'theme.js'), 'w', encoding='utf-8') as f: f.write(theme_js)

sel = get_between('function toggleSelectionMode()', '// --- Download Logic ---').replace('isSelectionMode', 'window.EchoState.isSelectionMode').replace('selectedClasses', 'window.EchoState.selectedClasses').replace('classData', 'window.EchoState.classData').replace('searchQuery', 'window.EchoState.searchQuery').replace('currentLayout', 'window.EchoState.currentLayout').replace('activeGridId', 'window.EchoState.activeGridId').replace('activeGridIndex', 'window.EchoState.activeGridIndex').replace('function toggle', 'export function toggle').replace('function update', 'export function update')
with open(os.path.join(app_dir, 'app', 'features', 'selection.js'), 'w', encoding='utf-8') as f:
    f.write("import { state } from '../store.js';\\n\\n" + sel + "\\nwindow.toggleSelectionMode = toggleSelectionMode;\\nwindow.toggleSelection = toggleSelection;\\nwindow.toggleSelectAll = toggleSelectAll;\\nwindow.updateSelectionUI = updateSelectionUI;\\n")

dl = get_between('function handleDownload', '// --- Transcript Search Logic ---').replace('function handle', 'export function handle').replace('function download', 'export function download').replace('window.startDownloads = function', 'export function startDownloads').replace('function close', 'export function close').replace('selectedClasses', 'window.EchoState.selectedClasses').replace('classData', 'window.EchoState.classData').replace('sectionId', 'window.EchoContext.sectionId').replace('hostname', 'window.EchoContext.hostname').replace('courseName', 'window.EchoContext.courseName').replace('showToast', 'window.showToast').replace('updateSelectionUI', 'window.updateSelectionUI')
with open(os.path.join(app_dir, 'app', 'features', 'downloads.js'), 'w', encoding='utf-8') as f:
    f.write("import { state, activeDownloads } from '../store.js';\\n\\n" + dl + "\\nwindow.startDownloads = startDownloads;\\nwindow.closeDownloadManager = closeDownloadManager;\\nwindow.handleDownload = handleDownload;\\nwindow.downloadSelected = downloadSelected;\\n")

srch = get_between('function handleSearch', '// --- Q&A Logic ---').replace('function handleSearch', 'export function handleSearch').replace('async function executeSearch', 'export async function executeSearch').replace('searchQuery', 'window.EchoState.searchQuery').replace('activeGridId', 'window.EchoState.activeGridId').replace('activeGridIndex', 'window.EchoState.activeGridIndex').replace('selectedClasses', 'window.EchoState.selectedClasses').replace('sectionId', 'window.EchoContext.sectionId').replace('classData', 'window.EchoState.classData').replace('searchData', 'window.EchoState.searchData').replace('getPlayerHTML', 'window.getPlayerHTML').replace('initEchoPlayer', 'window.initEchoPlayer').replace('renderClasses', 'window.renderClasses').replace('updateSelectionUI', 'window.updateSelectionUI')
with open(os.path.join(app_dir, 'app', 'features', 'search.js'), 'w', encoding='utf-8') as f:
    f.write("import { state } from '../store.js';\\n\\n" + srch + "\\nwindow.handleSearch = handleSearch;\\nwindow.executeSearch = executeSearch;\\n")

qa = get_between('async function loadQA', '// ==========================================').replace('async function loadQA', 'export async function loadQA').replace('async function interactQA', 'export async function interactQA').replace('async function createQuestion', 'export async function createQuestion').replace('function generateQAHTML', 'export function generateQAHTML').replace("function renderQA(query = '')", "export function renderQA(query = '')").replace('qaDataLoaded', 'window.EchoState.qaDataLoaded').replace('isFetchingQA', 'window.EchoState.isFetchingQA').replace('qaData', 'window.EchoState.qaData').replace('sectionId', 'window.EchoContext.sectionId').replace('renderQA', 'window.renderQA').replace('loadQA', 'window.loadQA')
with open(os.path.join(app_dir, 'app', 'features', 'qa.js'), 'w', encoding='utf-8') as f:
    f.write("import { state } from '../store.js';\\n\\n" + qa + "\\nwindow.loadQA = loadQA;\\nwindow.interactQA = interactQA;\\nwindow.createQuestion = createQuestion;\\nwindow.generateQAHTML = generateQAHTML;\\nwindow.renderQA = renderQA;\\n")

player = get_between('function getPlayerHTML', 'function getGridDropdownHTML').replace('function getPlayerHTML', 'export function getPlayerHTML').replace('async function initEchoPlayer', 'export async function initEchoPlayer').replace('hostname', 'window.EchoContext.hostname').replace('showToast', 'window.showToast')
with open(os.path.join(app_dir, 'app', 'ui', 'player.js'), 'w', encoding='utf-8') as f:
    f.write("import { resolveVideoUrl } from '../../lib/video-resolver.js';\\n\\n" + player + "\\nwindow.getPlayerHTML = getPlayerHTML;\\nwindow.initEchoPlayer = initEchoPlayer;\\n")

rend = get_between('function getGridDropdownHTML', 'async function loadData').replace('function getGridDropdownHTML', 'export function getGridDropdownHTML').replace('function renderClasses()', 'export function renderClasses()').replace('function toggleDropdown', 'export function toggleDropdown').replace('classData', 'window.EchoState.classData').replace('currentLayout', 'window.EchoState.currentLayout').replace('activeGridId', 'window.EchoState.activeGridId').replace('activeGridIndex', 'window.EchoState.activeGridIndex').replace('searchQuery', 'window.EchoState.searchQuery').replace('sortMode', 'window.EchoState.sortMode').replace('isSelectionMode', 'window.EchoState.isSelectionMode').replace('selectedClasses', 'window.EchoState.selectedClasses').replace('getPlayerHTML', 'window.getPlayerHTML').replace('generateQAHTML', 'window.generateQAHTML').replace('initEchoPlayer', 'window.initEchoPlayer')
with open(os.path.join(app_dir, 'app', 'ui', 'renderer.js'), 'w', encoding='utf-8') as f:
    f.write("import { state } from '../store.js';\\n\\n" + rend + "\\nwindow.getGridDropdownHTML = getGridDropdownHTML;\\nwindow.renderClasses = renderClasses;\\nwindow.toggleDropdown = toggleDropdown;\\n")

loader = get_between('async function loadData', 'setInterval(() => {').replace('async function loadData', 'export async function loadData').replace('async function loadEnrollments', 'export async function loadEnrollments').replace('sectionId', 'window.EchoContext.sectionId').replace('hostname', 'window.EchoContext.hostname').replace('classData', 'window.EchoState.classData').replace('renderClasses', 'window.renderClasses').replace('showToast', 'window.showToast')
with open(os.path.join(app_dir, 'app', 'data', 'loader.js'), 'w', encoding='utf-8') as f:
    f.write("import { EchoApiClient } from '../../lib/api-client.js';\\nimport { extractMediaId } from '../../lib/download-queue.js';\\nimport { state } from '../store.js';\\n\\n" + loader + "\\nwindow.loadData = loadData;\\nwindow.loadEnrollments = loadEnrollments;\\n")

cache_raw = get_between('const cachedKey', 'setInterval(() => {')
poller_raw = get_between('setInterval(() => {', 'loadEnrollments();')

bind_idx = code.find("document.addEventListener('DOMContentLoaded'")
bindings_raw = code[bind_idx:]

main_js = f"""import {{ state, activeDownloads, sectionId, hostname, courseName }} from './store.js';
import {{ initTheme }} from './ui/theme.js';
import './ui/toast.js';
import './features/selection.js';
import './features/downloads.js';
import './features/search.js';
import './features/qa.js';
import './ui/player.js';
import './ui/renderer.js';
import {{ loadData, loadEnrollments }} from './data/loader.js';
import {{ extractMediaId }} from '../lib/download-queue.js';

window.switchTab = function(tabId) {{
    const tabs = ['tab-classes', 'tab-search'];
    tabs.forEach(id => {{
        const el = document.getElementById(id);
        if (el) {{
            el.classList.remove('text-brand-light', 'dark:text-brand-dark', 'border-brand-light', 'dark:border-brand-dark');
            el.classList.add('text-gray-500', 'hover:text-gray-800', 'dark:text-gray-400', 'dark:hover:text-gray-200', 'border-transparent');
        }}
    }});

    const activeTab = document.getElementById(tabId);
    if (activeTab) {{
        activeTab.classList.add('text-brand-light', 'dark:text-brand-dark', 'border-brand-light', 'dark:border-brand-dark');
        activeTab.classList.remove('text-gray-500', 'hover:text-gray-800', 'dark:text-gray-400', 'dark:hover:text-gray-200', 'border-transparent');
    }}

    if (tabId === 'tab-classes') {{
        document.getElementById('classesControls').classList.remove('hidden');
        document.getElementById('classesControls').classList.add('flex');
        document.getElementById('classList').classList.remove('hidden');
        
        document.getElementById('searchControls').classList.remove('flex');
        document.getElementById('searchControls').classList.add('hidden');
        document.getElementById('searchList').classList.remove('flex');
        document.getElementById('searchList').classList.add('hidden');
        
        document.querySelectorAll('#searchList video').forEach(v => v.pause());
    }} else if (tabId === 'tab-search') {{
        document.getElementById('classesControls').classList.remove('flex');
        document.getElementById('classesControls').classList.add('hidden');
        document.getElementById('classList').classList.add('hidden');
        
        document.getElementById('searchControls').classList.remove('hidden');
        document.getElementById('searchControls').classList.add('flex');
        document.getElementById('searchList').classList.remove('hidden');
        document.getElementById('searchList').classList.add('flex');
        
        document.querySelectorAll('#classList video').forEach(v => v.pause());
    }}
}};

window.switchLayout = function(layout) {{
    if (window.EchoState.currentLayout === layout) return;
    window.EchoState.currentLayout = layout;
    
    const btnList = document.getElementById('btn-layout-list');
    const btnGrid = document.getElementById('btn-layout-grid');

    if (layout === 'list') {{
        btnList.className = 'flex items-center justify-center w-8 h-8 rounded-md bg-white dark:bg-gray-600 shadow-sm text-brand-light dark:text-brand-dark transition-all focus:outline-none';
        btnGrid.className = 'flex items-center justify-center w-8 h-8 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-all focus:outline-none';
    }} else {{
        btnGrid.className = 'flex items-center justify-center w-8 h-8 rounded-md bg-white dark:bg-gray-600 shadow-sm text-brand-light dark:text-brand-dark transition-all focus:outline-none';
        btnList.className = 'flex items-center justify-center w-8 h-8 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-all focus:outline-none';
    }}

    window.EchoState.activeGridId = null;
    window.EchoState.activeGridIndex = -1;
    window.renderClasses();
}};

document.title = `${{courseName}} | Class List`;
document.querySelector('h1').textContent = courseName;

{cache_raw.replace('classData', 'window.EchoState.classData')}
setInterval(() => {{
{poller_raw.replace('classData', 'window.EchoState.classData')}
{bindings_raw}
"""

if not os.path.exists(os.path.join(app_dir, 'app', 'app_old.js')):
    os.rename(os.path.join(app_dir, 'app', 'app.js'), os.path.join(app_dir, 'app', 'app_old.js'))
with open(os.path.join(app_dir, 'app', 'app.js'), 'w', encoding='utf-8') as f:
    f.write(main_js)

print("Refactoring complete.")
