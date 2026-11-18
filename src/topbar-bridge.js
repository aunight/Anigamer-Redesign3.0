(() => {
  'use strict';
  if (globalThis.__aniTopbarBridgeInstalled) return;
  globalThis.__aniTopbarBridgeInstalled = true;
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
