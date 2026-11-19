import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

function bootEnhancements(html, path, { sharedStorage = {}, fetchImpl, chromeMock } = {}) {
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
  if (chromeMock) w.chrome = chromeMock;
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
  assert.equal(d.querySelector('.history').getAttribute('data-ani-perm-hidden'), '1');
  assert.equal(d.querySelectorAll('.ani-perm-card.anime-card.ani-history-card').length, 2);

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
            cb({
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
  d.querySelector('.ani-origin-pill[data-origin="original"]').click();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(cards[0].classList.contains('ani-origin-hidden'), true);
  assert.equal(cards[1].classList.contains('ani-origin-hidden'), true);
  assert.equal(cards[2].classList.contains('ani-origin-hidden'), false);
  assert.equal(cards[2].querySelector('.ani-origin-badge')?.textContent, '原創');

  // 2C: Page elevator builds preserved query URLs & dispatches cancelable ani-page-jump
  const jumps = [];
  d.addEventListener('ani-page-jump', (e) => {
    e.preventDefault();
    jumps.push(e.detail);
  });
  const input = d.querySelector('.ani-page-input');
  assert(input, 'page elevator rendered');
  assert.equal(input.max, '12');
  input.value = '7';
  d.querySelector('.ani-page-jump-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  assert.equal(jumps.length, 1);
  assert.equal(jumps[0].page, 7);
  assert.match(jumps[0].url, /tags=%E5%8B%95%E4%BD%9C/);
  assert.match(jumps[0].url, /page=7/);
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
    <div class="anime-title"><div class="season"><ul>${epLis}</ul></div></div>
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
                '33': { name: '命運的交會點', jp: '運命の交差点', airdate: '2026-05-01' },
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

  // 5A: 60 episodes grouped into 3 chunks (25 each) + 全部; playing ep 33 auto-selects chunk index 1 (26–50)
  const grpBtns = [...dW.querySelectorAll('.ani-ep-group-btn')];
  assert.equal(grpBtns.length, 4);
  assert.equal(grpBtns[1].textContent, '26–50');
  assert.equal(grpBtns[1].getAttribute('aria-pressed'), 'true');
  assert.equal(dW.querySelectorAll('.season li:not(.ani-ep-chunk-hidden)').length, 25);

  // Switch to '全部' shows all 60
  grpBtns[3].click();
  assert.equal(dW.querySelectorAll('.season li:not(.ani-ep-chunk-hidden)').length, 60);

  // Toggle episodeAutoGroup off cleanly removes bar & hidden class
  await wW.AniEnhancements.writeSettings({ episodeAutoGroup: false });
  assert.equal(dW.querySelector('.ani-ep-group-bar'), null);
  assert.equal(dW.querySelectorAll('.ani-ep-chunk-hidden').length, 0);

  // 5B: Episode title tooltip on hover/focus & fullscreen top-center subtitle
  const ep33Link = dW.querySelector('.season li.playing a');
  assert.equal(ep33Link.dataset.aniEpTitle, '命運的交會點');
  const fsMain = dW.querySelector('#ani_video .ani-fs-title .ani-fs-title-main');
  const fsSub = dW.querySelector('#ani_video .ani-fs-title .ani-fs-subtitle');
  assert(fsMain && fsSub, 'fullscreen title main and top-center subtitle elements exist');
  assert.equal(fsSub.hidden, false);
  assert.match(fsSub.textContent, /第 33 話：命運的交會點/);
  ep33Link.dispatchEvent(new wW.MouseEvent('mouseover', { bubbles: true }));
  const tip = dW.getElementById('ani-ep-tooltip');
  assert.equal(tip.hidden, false);
  assert.match(tip.textContent, /命運的交會點/);

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
