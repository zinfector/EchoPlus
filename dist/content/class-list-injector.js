/**
 * class-list-injector.js — Replaces the Echo360 UI with EchoPlus overlay
 */

(function () {
  'use strict';

  const HOSTNAME = `${location.protocol}//${location.hostname}`;
  const SECTION_ID = location.pathname.match(
    /\/section\/([0-9a-f-]{36})/i
  )?.[1];

  if (!SECTION_ID) return;

  // Immediately hide body/root to prevent original content flash
  const style = document.createElement('style');
  style.textContent = `
    body > *:not(#echoplus-overlay-root) { display: none !important; }
    html, body { overflow: hidden !important; height: 100% !important; width: 100% !important; margin: 0; padding: 0; }
  `;
  document.documentElement.appendChild(style);

  function launchEchoPlus() {
    console.log('[Echo360 Downloader] Launching EchoPlus Overlay');

    // Fallback course name if we injected before title was set
    let courseName = document.title || 'Echo360 Course';
    // Sometimes title is just "Echo360", try to clean it up or leave it generic
    if (courseName.trim() === 'Echo360') courseName = 'Course List';

    const overlay = document.createElement('div');
    overlay.id = 'echoplus-overlay-root';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.zIndex = '2147483647'; // max z-index
    overlay.style.backgroundColor = '#fff';

    const url = chrome.runtime.getURL('app/index.html') +
      '?sectionId=' + SECTION_ID +
      '&hostname=' + encodeURIComponent(HOSTNAME) +
      '&courseName=' + encodeURIComponent(courseName);

    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.allowFullscreen = true;

    overlay.appendChild(iframe);

    // Inject as soon as body is available
    if (document.body) {
      document.body.appendChild(overlay);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(overlay);
      });
    }
  }

  launchEchoPlus();

})();