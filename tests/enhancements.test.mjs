import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

function bootEnhancements(html, path, { sharedStorage = {}, fetchImpl } = {}) {
  const dom = new JSDOM(html, {
    url: 'https://ani.gamer.com.tw' + path,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.IntersectionObserver = class { observe() {} disconnect() {} };
  w.AbortSignal.timeout = () => undefined;
  w.fetch = fetchImpl || (async () => ({ ok: true, text: async () => '' }));
  for (const [k, v] of Object.entries(sharedStorage)) {
    w.localStorage.setItem(k, JSON.stringify(v));
  }
  for (const file of ['settings.js', 'content.js', 'enhancements.js']) {
    w.eval(fs.readFileSync(`src/${file}`, 'utf8'));
  }
  return dom;
}

test('Phase 1A: collection custom status tags persist, compose with native filters, and preserve link clicks', async (t) => {
  const card = (id, progress) => `
    <a class="theme-list-main" href="animeRef.php?sn=${id}">
      <div class="theme-img-block"><img class="theme-img" alt="作品${id}"><span class="ani-watch-progress-badge">看到第 ${progress} 話</span></div>
      <div class="anime-detail-block">
        <div class="theme-info-block">
          <p class="theme-name">測試動畫 ${id}</p>
          <div class="theme-detail-info-block">
            <p class="theme-time">2026 春番</p>
            <span class="theme-number">${progress} / 12 集</span>
          </div>
        </div>
      </div>
    </a>`;
  const html = `<div id="BH_background"><div class="container"><div class="animate-theme-list"><div class="theme-list-block">${card(101, 12)}${card(102, 3)}${card(103, 0)}</div></div></div></div>`;
  const dom = bootEnhancements(html, '/mygather.php');
  t.after(() => { try { dom.window.close(); } catch {} });
  const w = dom.window, d = w.document;
  await new Promise((r) => setTimeout(r, 30));

  const cards = [...d.querySelectorAll('.theme-list-main')];
  let navClicks = 0;
  cards[0].addEventListener('click', (e) => { e.preventDefault(); navClicks++; });

  // Open menu on card 101 -> click 待看 (must not trigger card navigation)
  const chip1 = cards[0].querySelector('.ani-col-status-chip');
  assert(chip1, 'collection card should render custom status chip');
  chip1.click();
  const menu1 = cards[0].querySelector('.ani-col-status-menu');
  assert.equal(menu1.hidden, false);
  menu1.querySelector('button[data-choice="plan"]').click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(navClicks, 0, 'clicking status chip/menu must not trigger <a> navigation');
  assert.equal(chip1.dataset.status, 'plan');
  assert.equal(chip1.textContent, '待看');

  // Set card 102 to watching
  const chip2 = cards[1].querySelector('.ani-col-status-chip');
  chip2.click();
  cards[1].querySelector('.ani-col-status-menu button[data-choice="watching"]').click();
  await new Promise((r) => setTimeout(r, 20));

  // Filter by 'plan' -> only card 101 stays without .ani-col-status-hidden
  const filterGroup = d.querySelector('.ani-custom-status-filter');
  assert(filterGroup, 'custom collection filter group rendered');
  filterGroup.querySelector('button[data-filter-status="plan"]').click();
  assert.equal(cards[0].classList.contains('ani-col-status-hidden'), false);
  assert.equal(cards[1].classList.contains('ani-col-status-hidden'), true);
  assert.equal(cards[2].classList.contains('ani-col-status-hidden'), true);

  // Native 觀看狀態 filter composes cleanly via card.hidden without erasing custom filter class
  const nativeWatchBtns = [...d.querySelectorAll('[role="group"][aria-label="觀看狀態"] button')];
  nativeWatchBtns.find((b) => b.textContent === '已追完')?.click();
  assert.equal(cards[0].hidden, false);
  assert.equal(cards[1].hidden, true);
  filterGroup.querySelector('button[data-filter-status="all"]').click();
  assert.equal(cards[0].classList.contains('ani-col-status-hidden'), false);
  cards[0].click();
  assert.equal(navClicks, 1, 'normal card click still works');

  // Verify persistence across simulated reload
  const savedMap = JSON.parse(w.localStorage.getItem('aniCollectionStatesV1'));
  dom.window.close();
  const dom2 = bootEnhancements(html, '/mygather.php', { sharedStorage: { aniCollectionStatesV1: savedMap } });
  t.after(() => { try { dom2.window.close(); } catch {} });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(dom2.window.document.querySelector('a[href="animeRef.php?sn=101"] .ani-col-status-chip').dataset.status, 'plan');
});

test('Phase 1B: permanent local history records video visits, snapshots native history, deletes items, and supports JSON import/export', async (t) => {
  const videoHtml = `
    <html><head><meta property="og:image" content="https://p2.bahamut.com.tw/B/2KU/demo.JPG"></head>
    <body><div id="BH_background"><div class="container-player">
      <div class="anime_name"><h1>葬送的芙莉蓮 [12]</h1><a href="animeRef.php?sn=555">作品資料</a></div>
      <section class="player"><div id="ani_video"><video></video></div></section>
      <div class="anime-title"><div class="season"><ul><li class="playing"><a href="?sn=99012">12</a></li></ul></div></div>
    </div></div></body></html>`;
  const domV = bootEnhancements(videoHtml, '/animeVideo.php?sn=99012');
  t.after(() => { try { domV.window.close(); } catch {} });
  const v = domV.window.document.querySelector('video');
  Object.defineProperty(v, 'currentTime', { value: 420, configurable: true });
  Object.defineProperty(v, 'duration', { value: 1440, configurable: true });
  await domV.window.AniEnhancements.recordVideoProgress();
  const storedAfterWatch = JSON.parse(domV.window.localStorage.getItem('aniPermanentHistoryV1'));
  assert.equal(storedAfterWatch['555'].title, '葬送的芙莉蓮');
  assert.equal(storedAfterWatch['555'].episode, '12');
  assert.equal(storedAfterWatch['555'].elapsedSec, 420);
  assert.equal(storedAfterWatch['555'].episodes['12'].videoSn, '99012');
  domV.window.close();

  const viewHtml = `<div id="BH_background"><div class="center-container"><div class="history-wrapper"><div class="history">
    <div class="user-watch-list" id="list-1"><div class="anime-card">
      <a class="click-area" href="animeVideo.php?sn=88805"></a>
      <div class="postimg"><img src="https://p2.bahamut.com.tw/B/2KU/native.JPG"></div>
      <div class="anime-info">
        <p class="history-anime-title">原生紀錄動畫</p>
        <p class="history-lastwatch">觀看至 <span class="user-lastwatch">5</span> 集｜已更新至 第12集</p>
        <p class="history-lastwatch">觀看至 05 分 30 秒</p>
        <div class="progress-bar" aria-valuenow="330" aria-valuemax="1440"><div class="progress"></div></div>
      </div>
      <div class="btn-set"><a class="play-btn" href="animeVideo.php?sn=88805"></a><div class="more-btn" data-anime="777"></div></div>
    </div></div>
  </div></div></div></div>`;
  const domH = bootEnhancements(viewHtml, '/viewList.php', { sharedStorage: { aniPermanentHistoryV1: storedAfterWatch } });
  t.after(() => { try { domH.window.close(); } catch {} });
  await new Promise((r) => setTimeout(r, 40));
  const d = domH.window.document;
  const tabs = d.querySelectorAll('.ani-perm-tab');
  assert.equal(tabs.length, 2);
  assert.match(tabs[1].textContent, /永久本地紀錄 \(2\)/);

  // Default tab keeps native .history visible
  assert.equal(d.querySelector('.history').classList.contains('ani-perm-native-hidden'), false);
  // Switch to Permanent History tab
  tabs[1].click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(d.querySelector('.history').classList.contains('ani-perm-native-hidden'), true);
  assert.equal(d.querySelectorAll('.ani-perm-card').length, 2);

  // Search filter
  const search = d.querySelector('.ani-perm-search');
  search.value = '芙莉蓮';
  search.dispatchEvent(new domH.window.Event('input'));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(d.querySelectorAll('.ani-perm-card').length, 1);

  // Delete single entry
  d.querySelector('[data-perm-delete="555"]').click();
  await new Promise((r) => setTimeout(r, 30));
  search.value = '';
  search.dispatchEvent(new domH.window.Event('input'));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(d.querySelectorAll('.ani-perm-card').length, 1);
  assert.equal(d.querySelector('.ani-perm-card').dataset.permSn, '777');

  // JSON import merges back cleanly
  const importInput = d.querySelector('[data-perm-file]');
  Object.defineProperty(importInput, 'files', {
    configurable: true,
    value: [{
      text: async () => JSON.stringify({
        records: { '999': { sn: '999', videoSn: '99901', title: '匯入動畫', episode: '1', elapsedSec: 120, durationSec: 1440, watchedAt: Date.now() } },
      }),
    }],
  });
  importInput.dispatchEvent(new domH.window.Event('change'));
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(d.querySelectorAll('.ani-perm-card').length, 2);
  domH.window.close();
});
