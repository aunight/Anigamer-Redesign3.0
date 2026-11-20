import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { Converter } from 'opencc-js';

function bootEnhancements(html, path, { sharedStorage = {}, fetchImpl, chromeMock } = {}) {
  const dom = new JSDOM(html, {
    url: 'https://ani.gamer.com.tw' + path,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.AbortSignal.timeout = () => undefined;
  w.fetch = fetchImpl || (async () => ({ ok: true, text: async () => '' }));
  w.OpenCC = { Converter };
  if (chromeMock) w.chrome = chromeMock;
  for (const [k, v] of Object.entries(sharedStorage)) {
    w.localStorage.setItem(k, JSON.stringify(v));
  }
  for (const file of ['settings.js', 'content.js', 'enhancements.js']) {
    w.eval(fs.readFileSync(`src/${file}`, 'utf8'));
  }
  return dom;
}

test('Collection status follows progress, accepts persistent overrides, and preserves link clicks', async (t) => {
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
  const filterGroup = d.querySelector('.ani-custom-status-filter');
  const statusOf = (card) => card.querySelector('.ani-col-status-chip').dataset.status;
  assert.equal(d.querySelector('[role="group"][aria-label="觀看狀態"]'), null);
  assert.deepEqual(cards.map(statusOf), ['completed', 'watching', 'plan']);
  assert.equal(filterGroup.querySelector('[data-filter-status="plan"] small').textContent, '(1)');
  let navClicks = 0;
  cards[0].addEventListener('click', (e) => { e.preventDefault(); navClicks++; });

  // Open menu on card 101 -> click 待看 (must not trigger card navigation)
  const chip1 = cards[0].querySelector('.ani-col-status-chip');
  assert(chip1, 'collection card should render custom status chip');
  chip1.click();
  const menu1 = cards[0].querySelector('.ani-col-status-menu');
  assert.equal(menu1.hidden, false);
  cards[0].dispatchEvent(new w.Event('pointerleave'));
  assert.equal(menu1.hidden, true);
  chip1.click();
  menu1.querySelector('button[data-choice="plan"]').click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(navClicks, 0, 'clicking status chip/menu must not trigger <a> navigation');
  assert.equal(chip1.dataset.status, 'plan');
  assert.equal(chip1.textContent, '');
  assert.equal(chip1.getAttribute('aria-label'), '收藏分類：待看');

  // Set card 102 to watching
  const chip2 = cards[1].querySelector('.ani-col-status-chip');
  chip2.click();
  cards[1].querySelector('.ani-col-status-menu button[data-choice="watching"]').click();
  await new Promise((r) => setTimeout(r, 20));

  filterGroup.querySelector('button[data-filter-status="plan"]').click();
  assert.equal(cards[0].classList.contains('ani-col-status-hidden'), false);
  assert.equal(cards[1].classList.contains('ani-col-status-hidden'), true);
  assert.equal(cards[2].classList.contains('ani-col-status-hidden'), false);

  chip1.click();
  menu1.querySelector('button[data-choice=""]').click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(statusOf(cards[0]), 'completed');
  assert.equal(cards[0].classList.contains('ani-col-status-hidden'), true);
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
  const savedChip = dom2.window.document.querySelector('a[href="animeRef.php?sn=102"] .ani-col-status-chip');
  assert.equal(savedChip.dataset.manualStatus, 'watching');
  dom2.window.dispatchEvent(new dom2.window.StorageEvent('storage', {
    key: 'aniCollectionStatesV1', newValue: JSON.stringify({102: {status: 'paused'}}),
  }));
  assert.equal(savedChip.dataset.status, 'paused');
});

test('Playback collection status uses the current work and follows changes from other tabs', async t => {
  const dom = bootEnhancements(`
    <div id="BH_background">
      <div class="anime_name"><button onclick="animefun.toggleGather(144453, 114044, $(this), 'ordered')"></button></div>
      <div class="old_list"><a href="animeRef.php?sn=113642">相關動畫</a></div>
    </div>
  `, '/animeVideo.php?sn=48502', {
    sharedStorage: { aniCollectionStatesV1: {114044: {status: 'completed'}, 113642: {status: 'paused'}} },
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  await w.AniEnhancements.reinit();
  const bar = w.document.querySelector('.ani-col-status-bar.is-watch-chip');
  const chip = bar.querySelector('.ani-col-status-chip');
  assert.equal(chip.textContent, '已看完');
  w.dispatchEvent(new w.StorageEvent('storage', {
    key: 'aniCollectionStatesV1', newValue: JSON.stringify({114044: {status: 'watching'}}),
  }));
  assert.equal(chip.textContent, '追番中');
  const auto = bar.querySelector('button[data-choice=""]');
  assert.equal(auto.textContent, '自動');
  auto.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(chip.textContent, '自動');
  assert.equal(auto.getAttribute('aria-pressed'), 'true');
  const states = JSON.parse(w.localStorage.getItem('aniCollectionStatesV1'));
  assert.equal(states[114044], undefined);
  assert.equal(states[113642].status, 'paused');
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
  storedAfterWatch['555'].episodes.special = { videoSn: '99013' };
  domV.window.close();

  const viewHtml = `<style>.ani-perm-tabs { background: #12202c; border: 1px solid #555; }</style>
  <div id="BH_background"><div class="theme-title-block"></div><div class="center-container"><div class="history-wrapper"><div class="history">
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
  assert.equal(d.querySelector('.ani-perm-tabs').classList.contains('ani-bgm-toast'), false);
  assert.equal(d.querySelectorAll('.ani-perm-tab > svg').length, 2);
  assert.match(tabs[1].textContent, /永久本地紀錄 \(2\)/);
  const filterCard = d.querySelector('.ani-perm-filter-card');
  assert.equal(filterCard.hidden, true);

  // Default tab keeps native .history visible
  assert.equal(d.querySelector('.history').classList.contains('ani-perm-native-hidden'), false);
  // Switch to Permanent History tab
  tabs[1].click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(d.querySelector('.history').classList.contains('ani-perm-native-hidden'), true);
  assert.equal(d.querySelector('.history').getAttribute('data-ani-perm-hidden'), '1');
  assert.equal(d.querySelectorAll('.ani-perm-card.anime-card.ani-history-card').length, 2);
  assert.equal(filterCard.hidden, false);
  const more = () => d.querySelector('[data-perm-more="555"]');
  const drawer = () => d.getElementById(more().getAttribute('aria-controls'));
  let drawerMotion;
  const recordDrawerMotion = () => {
    drawer().animate = (frames, options) => {
      drawerMotion = { frames: Array.from(frames, frame => frame.transform), ...options };
      return drawerMotion;
    };
  };
  recordDrawerMotion();
  more().click();
  assert.equal(more().getAttribute('aria-expanded'), 'true');
  assert.equal(drawer().style.display, 'block');
  assert.deepEqual([...drawer().querySelectorAll('.history-list-anime-title')].map(label => label.textContent), ['EP.12']);
  assert.deepEqual(drawerMotion, { frames: ['translateY(-8px)', 'translateY(0)'], duration: 220, easing: 'ease-out' });

  const otherMore = d.querySelector('[data-perm-more="777"]');
  const otherDrawer = d.getElementById(otherMore.getAttribute('aria-controls'));
  otherMore.click();
  assert.equal(otherMore.getAttribute('aria-expanded'), 'true');
  assert.equal(otherDrawer.style.display, 'block');
  assert.equal(more().getAttribute('aria-expanded'), 'false');
  assert.equal(more().getAttribute('aria-label'), '展開每集紀錄');
  assert.equal(drawerMotion.duration, 190, 'switching series animates the previous drawer closed');
  drawerMotion.onfinish();
  assert.equal(drawer().style.display, 'none');

  more().click();
  assert.equal(otherMore.getAttribute('aria-expanded'), 'false');
  assert.equal(otherDrawer.style.display, 'none');

  // Search filter
  const search = d.querySelector('.ani-perm-search');
  search.value = '芙莉蓮';
  search.dispatchEvent(new domH.window.Event('input'));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(d.querySelectorAll('.ani-perm-card').length, 1);
  assert.equal(drawer().style.display, 'block', 'an open drawer survives a list refresh');
  recordDrawerMotion();
  more().click();
  assert.equal(more().getAttribute('aria-expanded'), 'false');
  assert.deepEqual(drawerMotion.frames, ['translateY(0)', 'translateY(-6px)']);
  assert.equal(drawerMotion.duration, 190);
  assert.equal(drawerMotion.easing, 'ease-in');
  assert.equal(drawer().style.display, 'block');
  drawerMotion.onfinish();
  assert.equal(drawer().style.display, 'none');

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

test('Phase 2: catalog negative tags, keyword exclude, origin classification, page elevator, and DOM invariants', async (t) => {
  const catCard = (sn, title) => `
    <a class="theme-list-main" href="animeRef.php?sn=${sn}">
      <div class="theme-img-block"><img class="theme-img" alt="${title}"></div>
      <div class="anime-detail-block"><div class="theme-info-block">
        <p class="theme-name">${title}</p>
        <div class="theme-detail-info-block"><p class="theme-time">年份：2026/04</p><span class="theme-number">共12集</span></div>
      </div></div>
    </a>`;
  const group = (name) => `<section class="class_list"><div class="class-header"><h3>${name}</h3></div><ul><li class="now"><a href="#">全部</a></li><li><a href="animeList.php?tags=異世界">異世界</a></li><li><a href="animeList.php?tags=戀愛">戀愛</a></li></ul></section>`;
  const html = `<div id="BH_background"><div class="container"><div class="animate-theme-list">
    <div class="filter-section">${group('屬性')}<div class="class-wrapper">${group('類型')}${group('對象')}</div></div>
    <div class="theme-list-block">${catCard(201, '轉生異世界冒險')}${catCard(202, '敗北女角太多了')}${catCard(203, '夜晚的水母不會游泳')}</div>
  </div><div class="page_control"><div class="page_number"><a class="now">2</a><a href="?tags=%E5%8B%95%E4%BD%9C&page=1">1</a><a href="?tags=%E5%8B%95%E4%BD%9C&page=3">3</a><a href="?tags=%E5%8B%95%E4%BD%9C&page=12">12</a></div></div></div></div>`;

  let replyOrigin;
  let originRequests = 0;
  const dom = bootEnhancements(html, '/animeList.php?tags=%E5%8B%95%E4%BD%9C&page=2', {
    fetchImpl: async (url) => {
      if (String(url).includes('tags=')) {
        return { ok: true, text: async () => '<div class="theme-list-block"><a class="theme-list-main" href="animeRef.php?sn=201">轉生異世界冒險</a></div>' };
      }
      return { ok: true, text: async () => '' };
    },
    chromeMock: {
      runtime: {
        lastError: null,
        sendMessage(msg, cb) {
          if (msg?.type === 'ani-fetch-work-meta') {
            originRequests++;
            replyOrigin = () => cb({
              ok: true,
              items: {
                '轉生異世界冒險': { source: 'light_novel', format: 'TV', duration: 24, episodes: 12, isShort: false },
                '敗北女角太多了': { source: 'light_novel', format: 'TV', duration: 24, episodes: 12, isShort: false },
                '夜晚的水母不會游泳': { source: 'original', format: 'TV', duration: 24, episodes: 12, isShort: false },
              },
            });
          } else {
            cb({});
          }
        },
      },
    },
  });
  t.after(() => { try { dom.window.close(); } catch {} });
  const w = dom.window, d = w.document;
  await new Promise((r) => setTimeout(r, 40));

  // Verify catalog-ui invariants strictly preserved
  assert.equal(d.querySelectorAll('.ani-filter-body .class-header svg').length, 4);
  assert.equal(d.querySelector('.ani-filter-body').firstElementChild.querySelector('h3').textContent, '年份');
  assert.equal(d.querySelector('.page_control').hidden, true);
  assert.equal(d.querySelector('.ani-load-more').textContent, '繼續往下瀏覽');

  // 2A: Negative tag exclude hides sn=201 via CSS class (never touching card.hidden)
  const cards = [...d.querySelectorAll('.theme-list-main')];
  d.querySelector('.ani-exclude-pill[data-exclude-tag="異世界"]').click();
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(cards[0].classList.contains('ani-catalog-excluded'), true);
  assert.equal(cards[1].classList.contains('ani-catalog-excluded'), false);
  assert.equal(cards[0].hidden, false, 'must not mutate card.hidden');
  assert.match(d.querySelector('.ani-exclude-count').textContent, /已排除 1 部/);

  // Keyword exclusion excludes sn=202 too
  const kw = d.querySelector('.ani-exclude-keyword');
  kw.value = '女角';
  kw.dispatchEvent(new w.Event('input'));
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(cards[1].classList.contains('ani-catalog-excluded'), true);
  d.querySelector('.ani-exclude-clear').click();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(cards.some((c) => c.classList.contains('ani-catalog-excluded')), false);

  // 2B: Origin filter queries worker meta & keeps only 原創動畫 (sn=203)
  const originStatus = d.querySelector('.ani-origin-status');
  assert.equal(originRequests, 1, 'starts metadata prefetch before the first click');
  d.querySelector('.ani-origin-pill[data-origin="light_novel"]').click();
  assert.match(originStatus.textContent, /正在比對 3 部/);
  d.querySelector('.ani-origin-pill[data-origin="all"]').click();
  assert.equal(originStatus.textContent, '');
  assert.equal(cards.some((card) => card.classList.contains('ani-origin-hidden')), false);
  d.querySelector('.ani-origin-pill[data-origin="original"]').click();
  assert.equal(originRequests, 1, 'changing filters reuses the in-flight request');
  replyOrigin();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(cards[0].classList.contains('ani-origin-hidden'), true);
  assert.equal(cards[1].classList.contains('ani-origin-hidden'), true);
  assert.equal(cards[2].classList.contains('ani-origin-hidden'), false);
  assert.equal(cards[2].querySelector('.ani-origin-badge')?.textContent, '原創');
  assert.equal(originStatus.textContent, '符合此原作分類：1 部');

  // 2C: Page elevator removed (infinite scroll only)
  assert.equal(d.querySelector('.ani-page-elevator'), null, 'page elevator removed in favor of infinite scroll');
});

test('Phase 3: spoiler blur matches keywords/tags or blurs all when filters are empty, supports click reveal/rehide, and tears down cleanly when disabled', async (t) => {
  const card = (sn, title) => `
    <a class="theme-list-main" href="animeRef.php?sn=${sn}">
      <div class="theme-img-block"><img class="theme-img" src="https://p2.bahamut.com.tw/B/2KU/c${sn}.JPG" alt="${title}"></div>
      <div class="anime-detail-block"><div class="theme-info-block"><p class="theme-name">${title}</p></div></div>
    </a>`;
  const html = `<div id="BH_background"><div class="container"><div class="animate-theme-list">
    <div class="filter-section"></div>
    <div class="theme-list-block">${card(301, '黑暗獵奇物語')}${card(302, '輕鬆日常咖啡廳')}</div>
  </div></div></div>`;

  // 1. Default off -> zero blurred cards
  const domOff = bootEnhancements(html, '/animeList.php');
  t.after(() => { try { domOff.window.close(); } catch {} });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(domOff.window.document.querySelectorAll('.ani-spoiler-blurred').length, 0);
  domOff.window.close();

  // 2. Enabled with keyword filter -> blurs only matching card, click reveal + rehide works, live disable cleans DOM
  const dom = bootEnhancements(html, '/animeList.php', {
    sharedStorage: {
      aniAmbientSettingsV1: { spoilerBlurEnabled: true, spoilerBlurTags: '恐怖', spoilerBlurKeywords: '獵奇' },
    },
    fetchImpl: async (url) => {
      if (String(url).includes('tags=')) {
        return { ok: true, text: async () => '<div class="theme-list-block"><a class="theme-list-main" href="animeRef.php?sn=301"></a></div>' };
      }
      return { ok: true, text: async () => '' };
    },
  });
  t.after(() => { try { dom.window.close(); } catch {} });
  const w = dom.window, d = w.document;
  await new Promise((r) => setTimeout(r, 50));

  const covers = [...d.querySelectorAll('.theme-img-block')];
  assert.equal(covers[0].classList.contains('ani-spoiler-blurred'), true);
  assert.equal(covers[1].classList.contains('ani-spoiler-blurred'), false);

  let cardNav = 0;
  d.querySelectorAll('.theme-list-main')[0].addEventListener('click', (e) => { e.preventDefault(); cardNav++; });
  covers[0].querySelector('.ani-spoiler-reveal-btn').click();
  assert.equal(covers[0].classList.contains('is-unblurred'), true);
  assert.equal(cardNav, 0, 'reveal button must not trigger link navigation');

  covers[0].querySelector('.ani-blur-rehide-btn').click();
  assert.equal(covers[0].classList.contains('is-unblurred'), false);
  assert.equal(cardNav, 0, 'rehide button must not trigger link navigation');

  // Toggle off via quick button -> cleans all blur classes & masks
  const qt = d.querySelector('.ani-blur-quick-toggle');
  assert(qt, 'quick toggle rendered next to filter toggle');
  qt.click();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(d.querySelectorAll('.ani-spoiler-blurred').length, 0);
  assert.equal(d.querySelectorAll('.ani-spoiler-mask').length, 0);

  // 3. Enabled with empty tags & keywords -> global privacy mode blurs all cards
  await w.AniEnhancements.writeSettings({ spoilerBlurEnabled: true, spoilerBlurTags: '', spoilerBlurKeywords: '' });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(d.querySelectorAll('.ani-spoiler-blurred').length, 2);
});

test('Phase 4: danmu list search, multi-sort (time/length/sender freq), local per-sender mute, and bounded idle mutations', async (t) => {
  const mkRow = (time, text, user) => `
    <li class="sub-list-li" data-userid="${user}">
      <div><b>${time}</b><div class="sub_content"><span>${text}</span></div></div>
      <div><a class="edit">複製</a></div>
    </li>`;
  const html = `<div id="BH_background"><div class="container-player"><section class="player">
    <div id="ani_video"><video></video></div>
    <div class="subtitle"><div id="ani-tab-content-1"><ul id="sub_list">
      ${mkRow('01:20', '哈哈', 'userA')}
      ${mkRow('00:15', '這幕作畫太神了吧！！', 'userB')}
      ${mkRow('02:05', '來了', 'userA')}
      ${mkRow('00:40', '前方高能', 'userC')}
    </ul></div></div>
  </section></div></div>`;

  const dom = bootEnhancements(html, '/animeVideo.php?sn=30789');
  t.after(() => { try { dom.window.close(); } catch {} });
  const w = dom.window, d = w.document;
  await new Promise((r) => setTimeout(r, 40));

  const subList = d.querySelector('#sub_list');
  const getTexts = () => [...subList.querySelectorAll('.sub-list-li')].map((li) => li.querySelector('.sub_content').textContent.trim());

  // Initial time asc sort -> 00:15, 00:40, 01:20, 02:05
  assert.deepEqual(getTexts(), ['這幕作畫太神了吧！！', '前方高能', '哈哈', '來了']);

  // Search filter
  const search = d.querySelector('.ani-danmu-search');
  search.value = '作畫';
  search.dispatchEvent(new w.Event('input'));
  await new Promise((r) => setTimeout(r, 110));
  assert.equal(subList.querySelectorAll('.sub-list-li:not(.ani-dm-filtered-hidden)').length, 1);
  assert.equal(d.querySelector('.ani-danmu-count').textContent, '1 / 4');

  search.value = '';
  search.dispatchEvent(new w.Event('input'));
  await new Promise((r) => setTimeout(r, 110));
  assert.equal(d.querySelector('.ani-danmu-count').textContent, '4 / 4');

  // Sort by length desc -> longest text first
  d.querySelector('[data-dm-sort="length"]').click();
  assert.equal(getTexts()[0], '這幕作畫太神了吧！！');

  // Sort by sn (posting order) desc -> newest row (last original index: 前方高能) first, and toggle asc
  d.querySelector('[data-dm-sort="sn"]').click();
  assert.equal(getTexts()[0], '前方高能');
  d.querySelector('[data-dm-sort="sn"]').click();
  assert.equal(getTexts()[0], '哈哈');

  // No duplicate per-row local mute button (respects official mute button)
  assert.equal(subList.querySelectorAll('.ani-dm-local-mute').length, 0);

  // Confirm idle #sub_list causes 0 self-triggered mutations
  let idleMut = 0;
  const obs = new w.MutationObserver((m) => { idleMut += m.length; });
  obs.observe(subList, { childList: true, subtree: true, attributes: true });
  await new Promise((r) => setTimeout(r, 250));
  obs.disconnect();
  assert.equal(idleMut, 0);
});

test('Phase 5: long-series episode grouping, Bangumi/AniList episode title tooltips, and off-shelf alerts', async (t) => {
  const epLis = Array.from({ length: 60 }, (_, idx) => {
    const n = idx + 1;
    return `<li${n === 33 ? ' class="playing"' : ''}><a href="?sn=${5000 + n}">${n}</a></li>`;
  }).join('');
  const watchHtml = `<div id="BH_background"><div class="container-player">
    <div class="anime_name"><h1>雙城之戰測試篇 [33]</h1><a href="animeRef.php?sn=707">作品資料</a></div>
    <div class="anime_info_detail"><p>本作品將於 2099/12/31 下架</p></div>
    <section class="player"><div id="ani_video"><div class="ani-fs-title">雙城之戰測試篇 [33]</div><video></video></div></section>
    <div class="anime-title"><div class="ani-season-more"><div class="ani-season-more-btn">全部展開</div><section class="season"><p>本篇</p><ul>${epLis}</ul></section></div></div>
  </div></div>`;

  const domW = bootEnhancements(watchHtml, '/animeVideo.php?sn=5033', {
    chromeMock: {
      runtime: {
        lastError: null,
        sendMessage(msg, cb) {
          if (msg?.type === 'ani-fetch-episode-titles') {
            cb({
              ok: true,
              episodes: {
                '33': { name: '命運的交會點', jp: '運命の交差点', airdate: '2026-05-01', description: '两人决定寻找失散的队友。' },
                '34': { description: '队伍来到了新城市。\r\n  \r\n一行は新しい町を訪れる。\n腳本：某人 分鏡：某人' },
                '35': { description: '二人は街を訪れる。\n腳本：某人 分鏡：某人 演出：某人' },
              },
            });
          } else cb({});
        },
      },
    },
  });
  t.after(() => { try { domW.window.close(); } catch {} });
  const wW = domW.window, dW = wW.document;
  await new Promise((r) => setTimeout(r, 50));

  assert.equal(dW.querySelectorAll('.ani-episode-cards .ani-episode-frame').length, 60);
  const layoutSwitch = dW.querySelector('.ani-ep-layout-switch');
  assert.equal(layoutSwitch.previousElementSibling, dW.querySelector('.ani-ep-order'));
  assert.equal(layoutSwitch.getAttribute('aria-checked'), 'false');
  const currentFrame = dW.querySelector('li.playing .ani-episode-frame');
  const video = dW.querySelector('video');
  Object.defineProperty(video, 'duration', { value: 100, configurable: true });
  video.currentTime = 25;
  video.dispatchEvent(new wW.Event('timeupdate'));
  assert.equal(currentFrame.style.getPropertyValue('--episode-progress'), '25%');
  layoutSwitch.click();
  assert.equal(layoutSwitch.getAttribute('aria-checked'), 'true');
  assert.equal(dW.querySelectorAll('.ani-episode-frame').length, 0);
  // The original layout defaults to 全部 with a single preview row.
  const grpBtns = [...dW.querySelectorAll('.ani-ep-group-btn')];
  assert.equal(grpBtns.length, 4);
  assert.equal(grpBtns[0].textContent, '全部');
  assert.equal(grpBtns[0].childElementCount, 0);
  assert.equal(grpBtns[2].textContent, '26–50');
  assert.equal(grpBtns[0].getAttribute('aria-pressed'), 'true');
  assert.equal(dW.querySelectorAll('.season li:not([data-ani-ep-hidden])').length, 6);
  assert.equal(dW.querySelector('.season li:not([data-ani-ep-hidden])').textContent.trim(), '1');

  const expand = dW.querySelector('.ani-ep-list-expand');
  assert.equal(expand.getAttribute('aria-expanded'), 'false');
  assert.equal(dW.querySelector('.season').classList.contains('is-open'), false);
  assert.equal(dW.querySelector('.season li.playing').hasAttribute('data-ani-ep-hidden'), true);
  expand.click();
  assert.equal(expand.getAttribute('aria-expanded'), 'true');
  assert.equal(dW.querySelectorAll('.season li:not([data-ani-ep-hidden])').length, 60);

  const originalList = dW.querySelector('.season ul');
  originalList.getBoundingClientRect = () => ({ width: 540, left: 0, right: 540 });
  expand.click();
  assert.equal(originalList.querySelectorAll('li:not([data-ani-ep-hidden])').length, 8);
  assert.equal(originalList.querySelector('li:not([data-ani-ep-hidden])').textContent.trim(), '1');
  expand.click();

  const season = dW.querySelector('.season');
  const dubbed = season.querySelector('ul').cloneNode(true);
  dubbed.removeAttribute('id');
  delete dubbed.dataset.aniEpExpanded;
  season.append(dubbed);
  await new Promise(resolve => setTimeout(resolve, 0));
  const dubBar = dubbed.previousElementSibling;
  const dubExpand = dubbed.nextElementSibling;
  assert.equal(dubExpand.getAttribute('aria-expanded'), 'false');
  assert.equal(dubBar.querySelectorAll('.ani-ep-group-btn').length, 4);
  assert.equal(dubbed.querySelectorAll('li:not([data-ani-ep-hidden])').length, 6);
  assert.equal(dubbed.querySelector('li:not([data-ani-ep-hidden])').textContent.trim(), '1');
  expand.click();
  const order = dW.querySelector('.ani-ep-order');
  assert.equal(order.textContent, '正序');
  order.click();
  assert.equal(order.textContent, '倒序');
  assert.equal(originalList.firstElementChild.textContent.trim(), '60');
  assert.equal(dubbed.firstElementChild.textContent.trim(), '60');
  assert.equal(expand.getAttribute('aria-expanded'), 'false');
  assert.equal(dubExpand.getAttribute('aria-expanded'), 'false');
  order.click();
  assert.equal(order.textContent, '正序');
  assert.equal(originalList.firstElementChild.textContent.trim(), '1');
  assert.equal(dubbed.firstElementChild.textContent.trim(), '1');
  expand.click();
  expand.click();
  const mainAll = originalList.previousElementSibling.querySelector('[data-ep-group="all"]');
  mainAll.click();
  assert.equal(originalList.querySelectorAll('li:not([data-ani-ep-hidden])').length, 60);
  assert.equal(dubExpand.getAttribute('aria-expanded'), 'false');
  assert.equal(dubbed.querySelectorAll('li:not([data-ani-ep-hidden])').length, 6);
  expand.click();
  const dubAll = dubBar.querySelector('[data-ep-group="all"]');
  dubAll.click();
  assert.equal(dubExpand.getAttribute('aria-expanded'), 'true');
  assert.equal(dubbed.querySelectorAll('li:not([data-ani-ep-hidden])').length, 60);
  dubAll.click();
  assert.equal(dubbed.querySelectorAll('li:not([data-ani-ep-hidden])').length, 60);
  dubExpand.click();
  assert.equal(dubbed.querySelectorAll('li:not([data-ani-ep-hidden])').length, 6);
  dubBar.querySelector('[data-ep-group="2"]').click();
  assert.equal(dubExpand.hidden, true);
  assert.equal(dubbed.querySelectorAll('li:not([data-ani-ep-hidden])').length, 10);
  dubAll.click();
  assert.equal(dubExpand.getAttribute('aria-expanded'), 'true');
  assert.equal(dubbed.querySelectorAll('li:not([data-ani-ep-hidden])').length, 60);
  assert.equal(expand.getAttribute('aria-expanded'), 'false');
  assert.equal(originalList.querySelectorAll('li:not([data-ani-ep-hidden])').length, 8);
  dubBar.remove();
  dubExpand.remove();
  dubbed.remove();

  // Disabling range filters retains the single-row preview.
  await wW.AniEnhancements.writeSettings({ episodeAutoGroup: false });
  assert.equal(dW.querySelector('.ani-ep-group-bar'), null);
  assert.equal(expand.getAttribute('aria-expanded'), 'false');
  assert.equal(originalList.querySelectorAll('li:not([data-ani-ep-hidden])').length, 8);

  dubbed.replaceChildren(...[...dubbed.children].slice(0, 12));
  delete dubbed.dataset.aniEpExpanded;
  season.append(dubbed);
  await new Promise(resolve => setTimeout(resolve, 0));
  const shortExpand = dubbed.nextElementSibling;
  assert.equal(shortExpand.getAttribute('aria-expanded'), 'false');
  assert.equal(dubbed.querySelectorAll('li:not([data-ani-ep-hidden])').length, 6);
  shortExpand.click();
  assert.equal(dubbed.querySelectorAll('li:not([data-ani-ep-hidden])').length, 12);
  assert.equal(expand.getAttribute('aria-expanded'), 'false');
  shortExpand.remove();
  dubbed.remove();

  // 5B: Episode title tooltip on hover/focus & fullscreen top-center subtitle
  const ep33Link = dW.querySelector('.season li.playing a');
  assert.equal(ep33Link.dataset.aniEpTitle, '命運的交會點');
  assert.equal(ep33Link.dataset.aniEpDescription, '兩人決定尋找失散的隊友。');
  assert.equal(dW.querySelector('.season a[href="?sn=5034"]').dataset.aniEpDescription, '隊伍來到了新城市。');
  assert.equal(dW.querySelector('.season a[href="?sn=5035"]').dataset.aniEpDescription, undefined);
  const fsMain = dW.querySelector('#ani_video .ani-fs-title .ani-fs-title-main');
  const fsSub = dW.querySelector('#ani_video .ani-fs-title .ani-fs-subtitle');
  assert(fsMain && fsSub, 'fullscreen title main and top-center subtitle elements exist');
  assert.equal(fsSub.hidden, false);
  assert.match(fsSub.textContent, /EP\.33\s+命運的交會點/);
  ep33Link.dataset.aniUploadDate = '2026/10/20';
  ep33Link.getBoundingClientRect = () => ({ top: 100, bottom: 136, left: 48, width: 36 });
  ep33Link.dispatchEvent(new wW.MouseEvent('mouseover', { bubbles: true }));
  const tip = dW.getElementById('ani-ep-tooltip');
  assert.equal(tip.hidden, false);
  assert.equal(tip.firstElementChild.textContent, '命運的交會點');
  assert.equal(tip.querySelector('.ani-ep-tip-synopsis').textContent, '兩人決定尋找失散的隊友。');
  assert.equal(tip.lastElementChild.dateTime, '2026-10-20');
  assert.equal(tip.style.top, '144px');
  dW.body.classList.add('ani-hide-episode-description');
  ep33Link.dispatchEvent(new wW.MouseEvent('mouseover', { bubbles: true }));
  assert.equal(tip.querySelector('.ani-ep-tip-synopsis'), null);

  // 5C: Off-shelf banner displayed on watch page & cached for /mygather.php
  const watchBanner = dW.querySelector('.ani-offshelf-banner');
  assert(watchBanner, 'off-shelf alert banner rendered on watch page');
  assert.match(watchBanner.textContent, /即將下架提醒/);
  const offshelfCache = JSON.parse(wW.localStorage.getItem('aniOffshelfCacheV1'));
  assert(offshelfCache['707'], 'off-shelf anime sn stored in cache');
  domW.window.close();

  // Verify /mygather.php reads off-shelf cache, shows badge + collection summary banner, and clears when toggled off
  const gatherHtml = `<div id="BH_background"><div class="container"><div class="animate-theme-list">
    <div class="theme-list-block"><a class="theme-list-main" href="animeRef.php?sn=707"><div class="theme-img-block"><img class="theme-img"><span class="ani-poster-score">★ 4.8</span></div><div class="anime-detail-block"><p class="theme-name">雙城之戰測試篇</p></div></a></div>
  </div></div></div>`;
  const domG = bootEnhancements(gatherHtml, '/mygather.php', { sharedStorage: { aniOffshelfCacheV1: offshelfCache } });
  t.after(() => { try { domG.window.close(); } catch {} });
  await new Promise((r) => setTimeout(r, 40));
  const dG = domG.window.document;
  assert(dG.querySelector('.ani-offshelf-badge.has-score'), 'card badge positioned under poster score');
  assert(dG.querySelector('.ani-offshelf-banner.is-collection'), 'collection expiring banner rendered');

  await domG.window.AniEnhancements.writeSettings({ showOffshelfAlert: false });
  assert.equal(dG.querySelectorAll('.ani-offshelf-badge, .ani-offshelf-banner').length, 0);
});

test('Long episode lists retain the selected range when reversed and absorb a trailing singleton', async t => {
  const episodes = Array.from({ length: 151 }, (_, i) => `<li><a href="?sn=${i + 1}">${i + 1}</a></li>`).join('');
  const dom = bootEnhancements(`<div id="BH_background"><div class="season"><ul>${episodes}</ul></div></div>`, '/animeVideo.php?sn=151');
  t.after(() => dom.window.close());
  const { document } = dom.window;
  await new Promise(resolve => setTimeout(resolve, 40));

  const options = () => [...document.querySelectorAll('.ani-ep-range-menu [role="option"]')];
  const selected = () => options().findIndex(option => option.getAttribute('aria-selected') === 'true');
  const visible = () => [...document.querySelectorAll('.season li:not([data-ani-ep-hidden])')].map(row => Number(row.textContent));
  const lastRange = Array.from({ length: 26 }, (_, i) => 126 + i);
  assert.equal(options().length, 7);
  assert.equal(options()[0].textContent, '全部');
  for (const row of document.querySelectorAll('.season li')) row.className = '';
  assert.deepEqual(visible(), [1, 2, 3, 4, 5, 6]);
  assert.equal(options()[6].textContent, '126–151');
  options()[6].click();
  assert.deepEqual(visible(), lastRange);

  document.querySelector('.ani-ep-order').click();
  assert.equal(selected(), 1);
  assert.equal(options()[selected()].textContent, '126–151');
  assert.deepEqual(visible(), lastRange.reverse());
  document.querySelector('[aria-label="下一組集數"]').click();
  assert.equal(options()[selected()].textContent, '101–125');
  assert.equal(visible()[0], 125);
});

test('bilingual tracks use Japanese and Chinese labels and only movie tracks omit episode badges', async t => {
  for (const [headings, labels, japaneseIndex, movieTracks] of [
    [['電影', '中文電影', '特別篇'], ['日文配音', '中文配音', '特別篇'], 0, [0, 1]],
    [['', '中文配音', '特別篇'], ['日文配音', '中文配音', '特別篇'], 0, []],
    [['國語配音', '日語配音'], ['日文配音', '中文配音'], 1, []],
    [['本篇', '特別篇'], ['本篇', '特別篇'], null, []],
  ]) {
    const tracks = headings.map((heading, index) => `${heading ? `<p>${heading}</p>` : ''}
      <ul><li${index === 1 ? ' class="playing"' : ''}><a href="?sn=${8101 + index}">1</a></li></ul>`).join('');
    const dom = bootEnhancements(`<div id="BH_background"><div class="container-player">
      <section class="player"><div id="ani_video"><div class="vjs-control-bar">
        <div class="control-bar-rightbtn"></div>
      </div></div></section>
      <div class="anime-title"><div class="season">${tracks}</div></div>
    </div></div>`, '/animeVideo.php?sn=8102');
    t.after(() => dom.window.close());
    await new Promise(resolve => setTimeout(resolve, 40));
    const { document } = dom.window;
    const choices = [...document.querySelectorAll('.ani-episode-track-choices > button')];
    const lists = [...document.querySelectorAll('.season > ul')];
    assert.deepEqual(choices.map(button => button.textContent), labels);
    assert.equal(lists[1].classList.contains('ani-episode-track-hidden'), false);
    if (japaneseIndex !== null) {
      choices[0].click();
      assert.equal(choices[0].getAttribute('aria-pressed'), 'true');
      assert.equal(lists.findIndex(list => !list.classList.contains('ani-episode-track-hidden')), japaneseIndex);
    }
    const badges = lists.map(list => list.querySelector('.ani-episode-frame').dataset.label);
    assert.deepEqual(badges, headings.map((_, index) => movieTracks.includes(index) ? undefined : 'EP.1'));
    document.querySelector('.ani-episodes-control').click();
    const tabs = [...document.querySelectorAll('.ani-ep-drawer-tab')];
    assert.deepEqual(tabs.map(tab => tab.textContent), labels);
    assert.equal(document.querySelector('.ani-ep-row.is-playing')?.dataset.videoSn, '8102');
    assert.equal(document.querySelector('.ani-ep-row .ani-ep-meta strong')?.textContent, movieTracks.includes(1) ? '電影' : 'EP.1');
  }
});

test('episode thumbnail selection uses six-column cards up to 100 episodes and restores the original picker at 101', async t => {
  const episodes = Array.from({length:100}, (_, i) => '<li><a href="?sn='+(1000+i)+'">'+(i+1)+'</a></li>').join('');
  const dom = bootEnhancements('<div id="BH_background"><section class="season"><ul>'+episodes+'</ul></section></div>', '/animeVideo.php?sn=1000');
  t.after(() => dom.window.close());
  const ul = dom.window.document.querySelector('.season ul');
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(ul.querySelectorAll('.ani-episode-frame').length, 100);
  assert.ok(dom.window.document.querySelector('.ani-ep-layout-switch'));
  ul.insertAdjacentHTML('beforeend','<li><a href="?sn=1100">101</a></li>');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(ul.classList.contains('ani-episode-cards'), false);
  assert.equal(ul.querySelectorAll('.ani-episode-frame').length, 0);
  assert.equal(ul.querySelectorAll('a').length, 101);
  assert.equal(dom.window.document.querySelector('.ani-ep-layout-switch'), null);
  assert.ok(dom.window.document.querySelector('.ani-ep-order'));
});

test('Polar Opposites season two fills missing Traditional Chinese episode descriptions', async t => {
  const episodes = Array.from({ length: 15 }, (_, index) => {
    const number = 12 + index;
    return `<li><a href="?sn=${5000 + number}">${number}</a></li>`;
  }).join('');
  const dom = bootEnhancements(`<div id="BH_background">
    <div class="anime_name"><h1>相反的你和我 第二季 [13]</h1></div>
    <section class="season"><ul>${episodes}</ul></section>
  </div>`, '/animeVideo.php?sn=5013');
  t.after(() => dom.window.close());
  await new Promise(resolve => setTimeout(resolve, 40));
  const { document } = dom.window;
  for (let number = 12; number <= 26; number++) {
    const card = document.querySelector(`a[href="?sn=${5000 + number}"]`);
    const synopsis = card.querySelector('.ani-episode-card-description').dataset.text;
    assert.equal(Boolean(synopsis), number >= 13 && number <= 25, `episode ${number}`);
    assert.equal(card.querySelector('.ani-episode-card-synopsis').dataset.text, synopsis);
    assert.equal(card.querySelector('.ani-episode-card-details > .ani-episode-card-synopsis + time')?.className, 'ani-episode-card-date');
  }
});

test('Slime first season uses verified Traditional Chinese summaries only for episodes 1 to 24', async t => {
  const episodes = Array.from({ length: 25 }, (_, index) =>
    `<li><a href="?sn=${6001 + index}">${index + 1}</a></li>`).join('');
  const dom = bootEnhancements(`<div id="BH_background">
    <div class="anime_name"><h1>關於我轉生變成史萊姆這檔事 [1]</h1></div>
    <section class="season"><ul>${episodes}</ul></section>
  </div>`, '/animeVideo.php?sn=6001');
  t.after(() => dom.window.close());
  await new Promise(resolve => setTimeout(resolve, 50));
  const cards = [...dom.window.document.querySelectorAll('.season a')];
  assert.equal(cards.filter(card => card.dataset.aniEpDescription).length, 24);
  assert.match(cards[0].dataset.aniEpDescription, /暴風龍/);
  assert.match(cards[23].dataset.aniEpDescription, /復活的惡魔/);
  assert.equal(cards[24].dataset.aniEpDescription, undefined);
});

test('Slime seasons two to four use series episode numbers and skip unmatched specials', async t => {
  for (const [label, start, first, last] of [
    ['二', 25, /獸王國/, /克雷曼/],
    ['三', 49, /迪亞布羅/, /東方商人/],
    ['四', 73, /地下迷宮/, /克羅諾亞/],
  ]) {
    const numbers = [...Array.from({ length: 24 }, (_, index) => start + index), start + 0.5, start + 24];
    const episodes = numbers.map((number, index) =>
      `<li><a href="?sn=${7001 + index}">${number}</a></li>`).join('');
    const dom = bootEnhancements(`<div id="BH_background">
      <div class="anime_name"><h1>關於我轉生變成史萊姆這檔事 第${label}季 [${start}]</h1></div>
      <section class="season"><ul>${episodes}</ul></section>
    </div>`, '/animeVideo.php?sn=7001');
    t.after(() => dom.window.close());
    await new Promise(resolve => setTimeout(resolve, 50));
    const cards = [...dom.window.document.querySelectorAll('.season a')];
    assert.equal(cards.filter(card => card.dataset.aniEpDescription).length, 24);
    assert.match(cards[0].dataset.aniEpDescription, first);
    assert.match(cards[23].dataset.aniEpDescription, last);
  }
});

test('Slime dub and Coleus playlists get verified titles and summaries without Bangumi data', async t => {
  for (const [title, episode, subtitle] of [
    ['關於我轉生變成史萊姆這檔事 第二季 [25] [中文配音]', 25, '利姆路忙碌的日常'],
    ['關於我轉生變成史萊姆這檔事 柯里烏斯之夢 [1] [特別篇]', 1, '前往柯里烏斯國'],
    ['轉生史萊姆日記 關於我轉生變成史萊姆這檔事 [12]', 12, '享受新年假期'],
  ]) {
    const dom = bootEnhancements(`<div id="BH_background">
      <div class="anime_name"><h1>${title}</h1></div>
      <section class="season">
        <ul><li><a href="?sn=8101">${episode}</a></li></ul>
        <p>中文配音</p><ul><li><a href="?sn=8102">${episode}</a></li></ul>
      </section>
    </div>`, '/animeVideo.php?sn=8102');
    t.after(() => dom.window.close());
    await new Promise(resolve => setTimeout(resolve, 50));
    const cards = [...dom.window.document.querySelectorAll('.season a')];
    assert.equal(cards[0].dataset.aniEpTitle, subtitle);
    assert.equal(cards[1].dataset.aniEpTitle, subtitle);
    assert.ok(cards[0].dataset.aniEpDescription);
    assert.equal(cards[1].dataset.aniEpDescription, cards[0].dataset.aniEpDescription);
  }
});
