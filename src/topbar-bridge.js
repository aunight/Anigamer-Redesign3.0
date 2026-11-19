(() => {
  'use strict';
  if (globalThis.__aniTopbarBridgeInstalled) return;
  globalThis.__aniTopbarBridgeInstalled = true;
  document.addEventListener('click', (event) => {
    if (!document.body.classList.contains('ani-layout-comments')) return;
    const report = event.target.closest?.('#w-post-box a.reply_menu');
    if (!report) return;
    let actions;
    try { actions = JSON.parse(report.dataset.tippyMenuComment); } catch { return; }
    if (!actions.accusable) return;
    // The native delegated click has populated the menu before bubbling here.
    const nativeReport = report.wrappedJSObject || report;
    nativeReport._tippy?.popper.querySelector('[data-w-menu="accuse"]')?.click();
  });
  document.addEventListener('ani-topbar-open', (event) => {
    const id = event?.detail;
    if (!id || typeof globalThis.TOPBAR_show !== 'function') return;
    const msgBox = document.getElementById(`topBarMsg_${id}`);
    if (msgBox && getComputedStyle(msgBox).display !== 'none') return;
    try {
      globalThis.TOPBAR_show(id);
    } catch {}
  });

  document.addEventListener('ani-topbar-close', () => {
    if (typeof globalThis.TOPBAR_close !== 'function') return;
    try {
      globalThis.TOPBAR_close();
    } catch {}
  });
})();
