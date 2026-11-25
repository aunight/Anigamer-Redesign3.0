import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { Converter } from 'opencc-js';

function bootEnhancements(html, path, { sharedStorage = {}, fetchImpl, chromeMock, onObserve } = {}) {
  const dom = new JSDOM(html, {
    url: 'https://ani.gamer.com.tw' + path,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; }
    observe(target) { onObserve?.(target, this.callback); }
    unobserve() {}
    disconnect() {}
  };
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

test('episode cover fallback reads the native poster from the current and other episode pages', async t => {
  const first = 'https://p2.bahamut.com.tw/ep1.png';
  const second = 'https://p2.bahamut.com.tw/ep2.png';
  let episodePageRequests = 0;
  const dom = bootEnhancements('<div data-video-poster="' + first + '"></div>', '/animeVideo.php?sn=4414', {
    fetchImpl: async url => {
      if (String(url).includes('animeVideo.php?sn=4425')) {
        episodePageRequests++;
        return { ok: true, text: async () => '<meta property="og:image" content="' + second + '">' };
      }
      return { ok: false };
    },
  });
  t.after(() => dom.window.close());
  const getPoster = dom.window.aniGetEpisodePagePoster;
  assert.equal(await getPoster('4414'), first);
  assert.deepEqual(await Promise.all([getPoster('4425'), getPoster('4425')]), [second, second]);
  assert.equal(episodePageRequests, 1);
});

test('cached episode translations render before a metadata refresh finishes', async t => {
  const title = '測試動畫';
  const foreign = '学校で新しい友達に出会った。';
  const translation = '在學校認識了新朋友。';
  let refresh;
  let translationRequests = 0;
  const dom = bootEnhancements(`<div id="BH_background">
    <div class="anime_name"><h1>${title} [1]</h1></div>
    <section class="season"><ul><li class="playing"><a href="?sn=123">1</a></li></ul></section>
  </div>`, '/animeVideo.php?sn=123', {
    sharedStorage: {
      aniEpTitlesCacheV5: { [title]: { ts: Date.now(), metadataVersion: 6, lastEpisode: 1, episodes: { 1: { description: foreign } } } },
      aniEpisodeSynopsisTranslationsV1: { [foreign]: translation },
    },
    chromeMock: { runtime: {
      sendMessage(message, done) {
        if (message.type === 'ani-fetch-episode-titles') refresh = done;
        else {
          if (message.type === 'ani-translate-episode-synopsis') translationRequests++;
          done({});
        }
      },
    } },
  });
  t.after(() => dom.window.close());
  const episode = () => dom.window.document.querySelector('.season li.playing a');
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(typeof refresh, 'function');
  assert.equal(episode().dataset.aniEpDescription, translation);
  assert.equal(translationRequests, 0);
  refresh({ ok: true, episodes: { 1: { description: '巴哈版本測試簡介。' } } });
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(episode().dataset.aniEpDescription, '巴哈版本測試簡介。');
});

test('episode progress prefers newer playback and displays watched records without timestamps as full bars', t => {
  const dom = bootEnhancements('<div id="BH_background"></div>', '/');
  t.after(() => dom.window.close());
  const resolve = dom.window.AniEnhancements.resolveEpisodeProgress;
  const partial = resolve({
    local: {elapsedSec: 181, durationSec: 1420, watchedAt: 100},
    native: {elapsedSec: 445, durationSec: 1420, watchedAt: 200},
  });
  assert.equal(partial.elapsed, 445);
  assert.equal(partial.progress, 445 / 1420);
  assert.equal(partial.displayProgress, partial.progress);
  assert.equal(resolve({local: {completed: true}}).progress, 1);
  assert.equal(resolve({details: {duration: 1420, playback: {elapsedSec: 1412}}}).progress, 1);
  const historical = resolve({native: {watched: true}, details: {duration: 1420}});
  assert.equal(historical.watched, true);
  assert.equal(historical.completed, false);
  assert.equal(historical.progress, 0);
  assert.equal(historical.displayProgress, 1);
  assert.equal(historical.watchedWithoutTiming, true);
  assert.equal(resolve({details: {duration: 1420}}).displayProgress, 0);
});

test('episode media becomes ready with both decoded artwork and viewing history', async t => {
  let reveal;
  let finishHistory;
  let finishDecode;
  const episodes = Array.from({length: 7}, (_, i) => `<li><a href="?sn=${1001 + i}">${i + 1}</a></li>`).join('');
  const dom = bootEnhancements(`<div id="BH_background"><section class="season"><ul>${episodes}</ul></section></div>`, '/animeVideo.php?sn=1001', {
    onObserve(target, callback) {
      if (target.matches('.ani-episode-frame[data-video-sn="1001"]')) {
        reveal = () => callback([{target, isIntersecting: true}]);
      }
    },
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  const tick = () => new Promise(resolve => w.setTimeout(resolve, 0));
  w.aniGetEpisodeWatchHistory = () => new Promise(resolve => { finishHistory = resolve; });
  w.aniGetEpisodeDetails = async () => ({duration: 1380, cover: 'https://example.com/episode.jpg'});
  w.HTMLImageElement.prototype.decode = function () {
    if (this.decoding !== 'async') return Promise.resolve();
    return new Promise(resolve => { finishDecode = resolve; });
  };
  await tick();
  reveal();
  await tick();
  finishDecode();
  await tick();
  const frame = w.document.querySelector('.ani-episode-frame[data-video-sn="1001"]');
  const card = frame.parentElement;
  assert.equal(card.dataset.aniEpisodeMediaReady, undefined);
  assert.equal(frame.querySelector('img'), null);
  finishHistory(new Map([['1001', {local: {elapsedSec: 82, durationSec: 1380}}]]));
  await tick();
  assert.equal(card.dataset.aniEpisodeMediaReady, 'true');
  assert.equal(card.querySelector('.ani-episode-card-glow img').src, 'https://example.com/episode.jpg');
  assert.equal(frame.querySelector('img').src, 'https://example.com/episode.jpg');
  assert.equal(frame.dataset.playbackTime, '1:22 / 23:00');
  assert.equal(frame.querySelector('.ani-episode-card-progress').hidden, false);
});

test('episode thumbnails fill bars for native history entries with no saved seconds', async t => {
  const episodes = Array.from({length: 7}, (_, i) => `<li><a href="?sn=${1001 + i}">${i + 1}</a></li>`).join('');
  const html = `<nav><a href="/viewList.php?u=fixture">觀看紀錄</a></nav><div id="BH_background"><section class="season"><ul>${episodes}</ul></section></div>`;
  const historyPages = [];
  const dom = bootEnhancements(html, '/animeVideo.php?sn=1001', {
    fetchImpl: async url => {
      const request = new URL(url, 'https://ani.gamer.com.tw');
      if (request.pathname === '/anime/v1/video.php') {
        return {ok: true, json: async () => ({data: {
          video: {videoSn: 1001},
          anime: {animeSn: 10, episodes: {0: Array.from({length: 7}, (_, i) => ({videoSn: 1001 + i}))}},
        }})};
      }
      if (request.pathname !== '/anime/v3/history.php') return {ok: false};
      const page = request.searchParams.get('page');
      historyPages.push(page);
      return {ok: true, json: async () => ({data: {totalPage: 12, history: page === '1' ? [{
        animeSn: 10, videoSn: 1001, duration: 47, episode: 1, breakPoint: {breakPoint: 542},
        history: Array.from({length: 5}, (_, i) => ({
          videoSn: 1002 + i, title: `作品 [${2 + i}]`, duration: i === 4 ? undefined : 1420 / 60,
        })),
      }] : []}})};
    },
  });
  t.after(() => dom.window.close());
  await new Promise(resolve => setTimeout(resolve, 40));
  const frames = [...dom.window.document.querySelectorAll('.ani-episode-frame')];
  assert.equal(frames.length, 7);
  assert.equal(frames[0].style.getPropertyValue('--episode-progress'), `${542 / (47 * 60) * 100}%`);
  assert.equal(frames[0].dataset.playbackTime, '9:02 / 47:00');
  assert.equal(frames[0].querySelector('.ani-episode-card-watch').hidden, true);
  for (const frame of frames.slice(1, 6)) {
    assert.equal(frame.style.getPropertyValue('--episode-progress'), '100%');
    assert.equal(frame.querySelector('.ani-episode-card-watch').dataset.label, '已看完');
  }
  assert.equal(frames[1].dataset.playbackTime, '23:40 / 23:40');
  assert.equal(frames[5].dataset.playbackTime, undefined);
  assert.equal(frames[6].querySelector('.ani-episode-card-progress').hidden, true);
  assert.deepEqual(historyPages, ['1']);
});

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
  await new Promise(resolve => setTimeout(resolve, 30));
  domV.window.document.querySelector('.anime_name').insertAdjacentHTML('beforeend', '<a id="bgmtv" href="https://bangumi.tv/subject/400602?from=plugin">點格子</a>');
  await new Promise(resolve => setTimeout(resolve, 30));
  const storedAfterWatch = JSON.parse(domV.window.localStorage.getItem('aniPermanentHistoryV1'));
  assert.equal(storedAfterWatch['555'].title, '葬送的芙莉蓮');
  assert.equal(storedAfterWatch['555'].episode, '12');
  assert.equal(storedAfterWatch['555'].elapsedSec, 420);
  assert.equal(storedAfterWatch['555'].episodes['12'].videoSn, '99012');
  assert.equal(storedAfterWatch['555'].bangumi, 'https://bgm.tv/subject/400602');
  storedAfterWatch['555'].cover = 'https://p2.bahamut.com.tw/B/ACG/c/55/mock.jpg';
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
  const frieren = d.querySelector('.ani-perm-card[data-perm-sn="555"]');
  const originalCover = frieren.querySelector('.postimg img');
  assert(originalCover);
  assert.equal(frieren.querySelector('.ani-history-bangumi').href, 'https://bgm.tv/subject/400602');
  assert.equal(d.querySelector('.ani-perm-card[data-perm-sn="777"] .ani-history-bangumi'), null);
  const more = () => d.querySelector('[data-perm-more="555"]');
  const drawer = () => d.getElementById(more().getAttribute('aria-controls'));
  let drawerMotion;
  const recordDrawerMotion = () => {
    drawer().getBoundingClientRect = () => ({ height: 140 });
    drawer().animate = (frames, options) => {
      drawerMotion = { heights: Array.from(frames, frame => frame.maxHeight), ...options, cancel() {} };
      return drawerMotion;
    };
  };
  recordDrawerMotion();
  more().click();
  assert.equal(more().getAttribute('aria-expanded'), 'true');
  assert.equal(drawer().style.display, 'block');
  assert.deepEqual([...drawer().querySelectorAll('.history-list-anime-title')].map(label => label.textContent), ['EP.12']);
  assert.deepEqual(drawerMotion.heights, ['0px', '140px']);
  assert.equal(drawerMotion.duration, 220);

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
  assert.equal(d.querySelector('.ani-perm-card .postimg img'), originalCover, 'refresh keeps the existing cover node');
  assert.equal(drawer().style.display, 'block', 'an open drawer survives a list refresh');
  recordDrawerMotion();
  more().click();
  assert.equal(more().getAttribute('aria-expanded'), 'false');
  assert.deepEqual(drawerMotion.heights, ['140px', '0px']);
  assert.equal(drawerMotion.duration, 190);
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

test('Bangumi uses the current episode when both seasons share one work', async t => {
  const title = '野生的大魔王出現了！';
  const seasonOne = 'https://bgm.tv/subject/509355';
  const seasonTwo = 'https://bgm.tv/subject/616808';
  const playback = bootEnhancements(`<div id="BH_background"><div class="anime_name"><h1>${title} [13]</h1>
    <a id="bgmtv" href="${seasonOne}">點格子</a></div></div>`, '/animeVideo.php?sn=45013');
  t.after(() => playback.window.close());
  await new Promise(resolve => setTimeout(resolve, 40));
  const link = playback.window.document.querySelector('#bgmtv');
  assert.equal(link.href, seasonTwo);
  const markup = playback.window.AniEnhancements.historyBangumiLink;
  assert.match(markup(title, '12', seasonTwo), /\/subject\/509355/);
  assert.match(markup(title, '13', seasonOne), /\/subject\/616808/);
  assert.match(markup(title, '13', seasonOne), /img\/favicon\.ico/);
  assert.equal(markup('別的作品', '13', 'https://bgm.tv/subject_search/test'), '');
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
  const group = (name) => `<section class="class_list"><div class="class-header"><h3>${name}</h3></div><ul><li class="now"><a href="#">全部</a></li>${name === '類型'
    ? ['真人演出', 'OVA', '泡麵番', '雙語', '電影'].map(label => `<li><a href="?category=${label}">${label}</a></li>`).join('')
    : `<li><a href="animeList.php?tags=異世界">異世界</a></li><li><a href="animeList.php?tags=戀愛">戀愛</a></li>${name === '對象' ? '<li><a href="animeList.php?tags=年齡限制">年齡限制</a></li>' : ''}`}</ul></section>`;
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
  cards[1].insertAdjacentHTML('beforeend', '<span class="label-edition ani-age-restricted" aria-label="年齡限制">18+</span>');
  const ageExclusion = d.querySelector('.ani-exclude-pill[data-exclude-tag="年齡限制"]');
  ageExclusion.click();
  assert(cards[1].classList.contains('ani-catalog-excluded'), 'Age badges exclude cards before the tag request returns');
  assert(!cards[2].classList.contains('ani-catalog-excluded'));
  ageExclusion.click();
  assert(!cards[1].classList.contains('ani-catalog-excluded'));

  const typeSection = [...d.querySelectorAll('.class_list')].find(section => section.querySelector('h3')?.textContent.trim() === '作品分類');
  assert.deepEqual([...typeSection.querySelectorAll('li')].map(item => item.textContent.trim()),
    ['全部', '漫畫改編', '輕小說改編', '遊戲改編', '原創動畫', '電影', 'OVA', '雙語', '泡麵番', '輕動畫', '真人演出']);
  assert.equal(originRequests, 1);
  const original = typeSection.querySelector('[data-origin="original"]');
  original.click();
  replyOrigin();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(cards[0].classList.contains('ani-origin-hidden'), true);
  assert.equal(original.getAttribute('aria-pressed'), 'true');
  assert.equal(typeSection.querySelector('li.now'), null);
  assert.equal(w.location.hash, '#ani-origin=original');
  typeSection.querySelector('li:first-child a').click();
  assert.equal(original.getAttribute('aria-pressed'), 'false');
  assert.equal(typeSection.querySelector('li.now a').textContent, '全部');
  assert.equal(cards.some(card => card.classList.contains('ani-origin-hidden')), false);
  assert.equal(cards[2].querySelector('.ani-origin-badge')?.textContent, '原創');

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
    <div class="subtitle"><div id="ani-tab-content-1"><ul id="sub_list" data-tip="彈幕為公共空間，發表時須以不影響他人之觀看體驗為原則。">
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
  assert.equal(subList.hasAttribute('data-tip'), false, 'removes Bahamut public-space danmu notice');
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

test('playback displays one off-shelf reminder and restores the banner if the title pill is removed', async t => {
  const dom = bootEnhancements(`<div id="BH_background"><div class="container-player">
    <div id="ani_video"></div>
    <div class="anime-title"><div class="anime_name"><h1>測試作品</h1></div>
    <div class="anime_info_detail"><p>上架時間：2021/12/01 14:00</p><p id="offshelf">預定下架日期：2099/11/30</p></div></div>
  </div></div>`, '/animeVideo.php?sn=123');
  const { window } = dom;
  t.after(() => window.close());
  const { document } = window;
  await new Promise(resolve => window.addEventListener('ani-enhancements-ui-ready', resolve, { once: true }));
  const pill = document.querySelector('#offshelf');
  assert.equal(pill.textContent, '下架 2099/11/30');
  assert.equal(document.querySelector('.ani-offshelf-banner'), null);
  assert.equal(JSON.parse(window.localStorage.getItem('aniOffshelfCacheV1'))['123'].dateText, '2099/11/30');

  document.querySelector('#ani_video').remove();
  pill.parentElement.innerHTML = '<p class="uploadtime">上架時間：2021/12/01 14:00</p><p class="is-deathline">預定下架日期：2099/11/30</p>';
  await Promise.resolve();
  assert.equal(document.querySelector('.uploadtime').textContent, '2021/12/01 14:00');
  const restoredPill = document.querySelector('.is-deathline');
  assert.equal(restoredPill.textContent, '下架 2099/11/30');
  assert.equal(document.querySelector('.ani-offshelf-banner'), null);

  const fallback = document.createElement('p');
  fallback.textContent = '本作品將於 2099/12/01 下架';
  restoredPill.replaceWith(fallback);
  await Promise.resolve();
  const banner = document.querySelector('.ani-offshelf-banner');
  assert.match(banner.textContent, /2099\/12\/01 下架/);
  assert.doesNotMatch(banner.textContent, /2021\/12\/01/);

  fallback.replaceWith(pill);
  await Promise.resolve();
  assert.equal(document.querySelector('.ani-offshelf-banner'), null);
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
  const fsEp = dW.querySelector('#ani_video .ani-fs-title .ani-fs-episode');
  const fsMain = dW.querySelector('#ani_video .ani-fs-title .ani-fs-title-main');
  const fsSub = dW.querySelector('#ani_video .ani-fs-title .ani-fs-subtitle');
  assert(fsEp && fsMain && fsSub, 'fullscreen episode, title main, and top-center subtitle elements exist');
  assert.equal(fsEp.nextElementSibling, fsMain);
  assert.equal(fsEp.hidden, false);
  assert.equal(fsEp.textContent, 'EP.33');
  assert.equal(fsSub.hidden, false);
  assert.equal(fsMain.textContent, '雙城之戰測試篇');
  assert.equal(fsSub.textContent, '命運的交會點');
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
    const episodeButton = document.querySelector('.ani-episodes-control');
    const drawer = document.querySelector('.ani-player-episodes-drawer');
    episodeButton.click();
    assert.equal(drawer.getAttribute('aria-hidden'), 'true');
    episodeButton.click();
    drawer.querySelector('.ani-ep-drawer-panel').click();
    assert.equal(drawer.getAttribute('aria-hidden'), 'false');
    document.body.click();
    assert.equal(drawer.getAttribute('aria-hidden'), 'true');
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

test('the sidebar restores two-column credits from a flattened playback synopsis and the full work table', async t => {
  let resolveCredits;
  const dom = bootEnhancements(`<div id="BH_background">
    <div class="anime_name"><h1>測試作品 [1]</h1></div>
    <div class="subtitle"><div class="ani-tabs"></div><div class="ani-tab-content"></div></div>
    <section class="data"><div class="data-intro"><p>劇情第一段。<br><br>劇情第二段。
    <br>──STAFF──<br>──CAST──<br>原作插畫：測試畫家<br>梓川 咲太：石川界人
    <br>監督：測試監督<br>古賀</p><a href="https://acg.gamer.com.tw/acgDetail.php?s=94844">作品資料</a></div></section>
  </div>`, '/animeVideo.php?sn=10837', { chromeMock: { runtime: {
    sendMessage(message, reply) {
      if (message.type === 'ani-fetch-acg-credits') resolveCredits = reply;
    },
  } } });
  t.after(() => dom.window.close());
  const { document } = dom.window;
  const staff = () => document.querySelector('[data-credit-panel="製作團隊"]').textContent;
  const cast = () => document.querySelector('[data-credit-panel="聲優"]').textContent;
  assert.equal(document.querySelector('.ani-side-synopsis').textContent, '劇情第一段。\n\n劇情第二段。');
  assert.match(staff(), /測試畫家/);
  assert.doesNotMatch(staff(), /石川界人/);
  assert.match(cast(), /石川界人/);

  resolveCredits({ credits: `<table>
    <tr><td><b>──STAFF──</b></td><td><b>──CAST──</b></td></tr>
    <tr><td>原作插畫：測試畫家</td><td>梓川 咲太：石川界人</td></tr>
    <tr><td>角色設計：測試設計師</td><td>古賀 朋絵：東山奈央</td></tr>
  </table>` });
  assert.match(staff(), /測試設計師/);
  assert.match(cast(), /古賀 朋絵.*東山奈央/);
  assert.equal(document.querySelectorAll('.ani-side-cast li').length, 2);
});

test('the sidebar fills missing work synopsis from Bahamut, then only from the linked Bangumi subject', async t => {
  for (const synopsisHtml of ['<div class="wikiContent"><p>作品資料的正文。</p></div>', '']) {
    let bangumiRequests = 0;
    const dom = bootEnhancements(`<div id="BH_background">
      <div class="anime_name"><h1>青春豬頭少年不會夢到兔女郎學姊 [1]</h1><a id="bgmtv" href="https://bgm.tv/subject/123">點格子</a></div>
      <div class="subtitle"><div class="ani-tabs"></div><div class="ani-tab-content"></div></div>
      <section class="data"><div class="data-intro"></div><a href="https://acg.gamer.com.tw/acgDetail.php?s=94844">作品資料</a></section>
    </div>`, '/animeVideo.php?sn=10837', { chromeMock: { runtime: {
      sendMessage(message, reply) {
        if (message.type === 'ani-fetch-acg-credits') {
          queueMicrotask(() => reply({ credits: '<b>＜製作團隊＞</b><li>｜原作：測試作者</li>', synopsisHtml }));
        }
        if (message.type === 'ani-fetch-work-synopsis') {
          assert.equal(message.id, '123');
          bangumiRequests++;
          queueMicrotask(() => reply({ summary: 'Bangumi 的正文。' }));
        }
      },
    } } });
    t.after(() => dom.window.close());
    const { document } = dom.window;
    document.querySelector('.ani-tabs-link[href="#ani-tab-content-intro"]').click();
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));
    const items = [...document.querySelectorAll('.ani-side-meta-grid > .ani-side-meta-item')];
    assert.deepEqual(items.map(item => [...item.children].map(child => child.textContent)), [
      ['原作性質', '輕小說改編'], ['原作', '測試作者'],
    ]);
    assert(items[0].classList.contains('is-wide'));
    assert.equal(document.querySelector('.ani-side-synopsis').textContent, synopsisHtml ? '作品資料的正文。' : 'Bangumi 的正文。');
    assert.equal(bangumiRequests, synopsisHtml ? 0 : 1);
  }
});

test('the shared cast panel upgrades Japanese links and adds missing Wiki buttons', async t => {
  const dom = bootEnhancements(`<div id="BH_background">
    <div class="anime_name"><h1>測試作品 [1]</h1></div>
    <div class="subtitle"><div class="ani-tabs"></div><div class="ani-tab-content"></div></div>
    <section class="data"></section>
    <div id="ani-info"><div class="grid cast">
      <span>甲</span><span>測試聲優甲</span><a href="https://ja.wikipedia.org/wiki/Actor_A">Wiki</a>
      <span>乙</span><span>測試聲優乙</span><span></span>
    </div></div>
  </div>`, '/animeVideo.php?sn=123', { chromeMock: { runtime: {
    sendMessage(message, reply) {
      if (message.type !== 'ani-resolve-cast-wiki') return;
      assert(message.names.includes('Actor A'));
      reply([
        { cv: 'Actor A', wikiUrl: 'https://zh.wikipedia.org/zh-tw/A' },
        { cv: '測試聲優乙', wikiUrl: 'https://ja.wikipedia.org/wiki/B' },
      ]);
    },
  } } });
  t.after(() => dom.window.close());
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  const links = [...dom.window.document.querySelectorAll('.ani-side-cast a')].map(link => link.href);
  assert.deepEqual(links, ['https://zh.wikipedia.org/zh-tw/A', 'https://ja.wikipedia.org/wiki/B']);
});

test('Sakurasou uses Traditional Chinese cast credits and keeps both roles played by one actor', t => {
  const dom = bootEnhancements(`<div id="BH_background">
    <div class="anime_name"><h1>櫻花莊的寵物女孩 [1]</h1></div>
    <div class="subtitle"><div class="ani-tabs"></div><div class="ani-tab-content"></div></div>
    <section class="data"></section>
    <div id="ani-info"><div class="grid cast">
      <span>千石千尋</span><span>豊口めぐみ</span><span></span>
      <span>メイドちゃん</span><span>堀江由衣</span><span></span>
      <span>リタ・エインズワース</span><span>川澄綾子</span><span></span>
      <span>川澄綾子測試角色</span><span>川澄綾子</span><span></span>
    </div></div>
  </div>`, '/animeVideo.php?sn=4414');
  t.after(() => dom.window.close());
  const rows = [...dom.window.document.querySelectorAll('.ani-side-cast li')].map(row =>
    [...row.querySelectorAll(':scope > span')].map(text => text.textContent));
  assert.deepEqual(rows.filter(([, actor]) => actor === '堀江由衣'), [
    ['赤坂龍之介', '堀江由衣'], ['小女僕', '堀江由衣'],
  ]);
  assert.deepEqual(rows.filter(([role]) => role === '千石千尋'), [['千石千尋', '豐口惠']]);
  assert.deepEqual(rows.filter(([, actor]) => actor === '川澄綾子').map(([role]) => role),
    ['麗塔·愛因茲渥司', '川澄綾子測試角色']);
  assert(rows.some(([role, actor]) => role === '館林總一郎' && actor === '日野聰'));
  const haruka = [...dom.window.document.querySelectorAll('.ani-side-cast li')]
    .find(row => row.firstElementChild.textContent === '長谷栞奈');
  assert.equal(decodeURI(haruka.querySelector('a').href), 'https://zh.wikipedia.org/zh-tw/山崎遙');
  assert(rows.some(([role, actor]) => role === '椎名真白' && actor === '茅野愛衣'));
  assert(rows.some(([role, actor]) => role === '川澄綾子測試角色' && actor === '川澄綾子'));
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

test('next episode uses a future schedule and the work widescreen cover', async t => {
  const dom = bootEnhancements(`<div id="BH_background">
    <div class="anime-title"><div class="anime_name"><h1>連載測試 [2]</h1></div><div class="anime_info_detail">上架時間：2099/11/13 23:30</div></div>
    <section class="season"><ul><li><a href="?sn=5001">1</a></li><li class="playing"><a href="?sn=5002">2</a></li></ul></section>
  </div>`, '/animeVideo.php?sn=5002', {
    chromeMock: { runtime: { lastError: null, sendMessage(message, done) {
      done(message.type === 'ani-fetch-episode-titles' ? {
        ok: true, episodes: { 3: { jp: '最終話', airdate: '2099-11-27', description: '旅程の終わり。\n\n兩人再次踏上旅程。\n腳本：測試' } },
      } : {});
    } } },
  });
  t.after(() => dom.window.close());
  dom.window.AniAmbientFetch = async () => ({
    ok: true, text: async () => '<div class="program-card"><div class="title-row"><h5 class="title">連載測試</h5></div><div class="theme-img-bg" style="background-image: url(https://example.com/work.jpg)"></div></div>',
  });
  await new Promise(resolve => setTimeout(resolve, 50));
  const preview = dom.window.document.querySelector('.ani-upcoming-episode');
  assert.equal(preview.querySelector('strong').textContent, '連載測試');
  assert.equal(preview.previousElementSibling.textContent.trim(), '2');
  assert.equal(dom.window.document.querySelector('.season .playing').nextElementSibling, null);
  assert.equal(preview.querySelector('.ani-upcoming-episode-status').textContent, '即將更新');
  assert.equal(preview.querySelector('time span').textContent, '11/27 23:30');
  assert.equal(preview.querySelector('time').dateTime, '2099-11-27T23:30:00+08:00');
  assert.equal(preview.querySelector('.ani-upcoming-episode-number').textContent, 'EP.3');
  assert.equal(preview.querySelector('img').src, 'https://example.com/work.jpg');
  assert.equal(preview.querySelector('.ani-episode-frame time').dateTime, '2099-11-27T23:30:00+08:00');
  assert.equal(preview.querySelector('.ani-episode-card-description').dataset.text, '兩人再次踏上旅程。');
  assert.equal(preview.querySelector('.ani-upcoming-hover-date'), null);
  const order = dom.window.document.querySelector('.ani-ep-order');
  const episodes = () => [...preview.closest('ul').children].flatMap(row =>
    [...row.children].filter(child => child === preview || child.matches('a'))
      .map(child => child === preview ? 'EP.3' : child.textContent.trim()));
  order.click();
  assert.deepEqual(episodes(), ['EP.3', '2', '1']);
  assert.equal(dom.window.document.querySelector('.season .playing').previousElementSibling, null);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(episodes(), ['EP.3', '2', '1']);
  order.click();
  assert.deepEqual(episodes(), ['1', '2', 'EP.3']);
});

test('Wild Last Boss episode cards fill both fields when a valid cache ends at episode 12', async t => {
  const work = '野生的大魔王出現了！';
  const numbers = Array.from({ length: 21 }, (_, index) => index + 1);
  const episodes = numbers.map(number => `<li><a href="?sn=${45000 + number}">${number}</a></li>`).join('');
  const dom = bootEnhancements(`<div id="BH_background">
    <div class="anime_name"><h1>${work} EP.21</h1></div>
    <section class="season"><ul>${episodes}</ul><div>特別篇</div><ul><li><a href="?sn=45113">13</a></li></ul></section>
  </div>`, '/animeVideo.php?sn=45021', {
    sharedStorage: {
      aniEpTitlesCacheV5: {
        [work]: {
          ts: Date.now(), metadataVersion: 6, lastEpisode: 21,
          episodes: { 12: { name: '在故鄉有個不得了的存在！', description: '既有分集簡介。' } },
        },
      },
    },
  });
  t.after(() => dom.window.close());
  await new Promise(resolve => setTimeout(resolve, 50));
  const d = dom.window.document;
  const cards = numbers.slice(12).map(number => d.querySelector(`.season a[href="?sn=${45000 + number}"]`));
  for (const card of cards) {
    assert.ok(card.querySelector('.ani-episode-card-heading').dataset.title, `missing title for ${card.href}`);
    assert.ok(card.querySelector('.ani-episode-card-synopsis').dataset.text, `missing synopsis for ${card.href}`);
  }
  assert.equal(cards[0].dataset.aniEpTitle, '機動王都布魯托剛格出現了！');
  assert.equal(cards.at(-1).dataset.aniEpTitle, '吸血姬貝涅特奈修出現了！');
  assert.equal(d.querySelector('.season a[href="?sn=45012"]').dataset.aniEpDescription, '既有分集簡介。');
  assert.equal(d.querySelector('.season a[href="?sn=45113"]').dataset.aniEpDescription, undefined);
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

test('hovering the player episode button shows progress from all history pages', async t => {
  const dom = bootEnhancements(`<nav><a href="/viewList.php?u=fixture">觀看紀錄</a></nav>
    <div id="BH_background"><div class="container-player">
      <section class="player"><div id="ani_video"><div class="vjs-control-bar"><div class="control-bar-rightbtn"></div></div></div></section>
      <div class="anime-title"><div class="season"><ul>
        <li class="playing"><a href="?sn=8101">1</a></li>
        <li><a href="?sn=8102">2</a></li>
        <li class="saw"><a href="?sn=8103">3</a></li>
        <li><a href="?sn=8104">4</a></li>
      </ul></div></div>
    </div></div>`, '/animeVideo.php?sn=8101', {
    fetchImpl: async url => {
      const request = new URL(url, 'https://ani.gamer.com.tw/');
      if (!request.pathname.endsWith('/history.php')) return {ok: false};
      const page = Number(request.searchParams.get('page'));
      return {ok: true, json: async () => ({
        data: {totalPage: 2, history: [{videoSn: 8100 + page, duration: 20, breakPoint: 300 * page}]},
      })};
    },
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  await new Promise(resolve => setTimeout(resolve, 40));
  const hover = new w.Event('pointerenter');
  Object.defineProperty(hover, 'pointerType', {value: 'mouse'});
  w.document.querySelector('.ani-episodes-control').dispatchEvent(hover);
  assert.equal(w.document.querySelector('.ani-player-episodes-drawer').getAttribute('aria-hidden'), 'false');
  await new Promise(resolve => setTimeout(resolve, 40));
  const bars = [...w.document.querySelectorAll('.ani-ep-row progress')];
  assert.deepEqual(bars.map(bar => bar.position), [0.25, 0.5, 1, 0]);
  assert.deepEqual(bars.map(bar => bar.closest('.ani-ep-row').hasAttribute('data-ani-episode-completed')),
    [false, false, true, false]);
});

test('comment send button uses one native Enter event for the current reply editor without hovering comment images expanding layout', async t => {
  const dom = bootEnhancements(`<div id="BH_background">
    <div id="w-post-box">
      <div class="webview_commendlist">
        <div class="c-reply__item" data-w-comment-row="1">
          <div class="reply-content">
            <article class="reply-content__cont">
              <img src="https://p2.bahamut.com.tw/pic.png" data-evt-show-img="comment" width="120" height="90">
              <p class="text_content-hide">長留言測試</p>
              <a class="more-text" href="javascript:;"><b>&nbsp;......閱讀更多</b></a>
            </article>
          </div>
        </div>
        <div class="c-reply__editor">
          <div class="reply-input">
            <div class="input-article-content" contenteditable="true">測試留言</div>
            <textarea></textarea>
            <div class="comment_icon"><a href="javascript:;"></a></div>
          </div>
        </div>
      </div>
    </div>
  </div>`, '/animeVideo.php?sn=8201');
  t.after(() => dom.window.close());
  const w = dom.window;
  w.eval(fs.readFileSync('src/topbar-bridge.js', 'utf8'));
  await new Promise(resolve => setTimeout(resolve, 40));
  const original = w.document.querySelector('.c-reply__editor');
  const reply = original.cloneNode(true);
  const input = reply.querySelector('.input-article-content');
  input.textContent = '新回覆';
  original.after(reply);
  const sendBtn = reply.querySelector('.ani-comment-send-btn');
  assert.ok(sendBtn, 'cloned reply editor already has a send button');
  const events = [];
  for (const type of ['input', 'keydown', 'keypress', 'keyup']) {
    w.document.body.addEventListener(type, event => events.push(event));
  }
  sendBtn.click();
  assert.deepEqual(events.map(event => event.type), ['input', 'keypress']);
  assert(events.every(event => event.target === input), 'uses the current reply editor');
  assert.equal(events[1].key, 'Enter');
  assert.equal(w.document.activeElement, input);
  const img = w.document.querySelector('.reply-content__cont img[data-evt-show-img]');
  Object.defineProperty(img, 'naturalWidth', { value: 400 });
  Object.defineProperty(img, 'naturalHeight', { value: 300 });
  img.getBoundingClientRect = () => ({ left: 40, top: 80, width: 160, height: 120 });
  const over = new w.Event('pointerover', { bubbles: true });
  Object.defineProperty(over, 'pointerType', { value: 'mouse' });
  img.dispatchEvent(over);
  assert.equal(img.hasAttribute('data-ani-image-expanded'), false);
  assert.equal(img.style.getPropertyValue('--ani-expanded-comment-width'), '');
  const preview = w.document.querySelector('.ani-comment-hover-zoom');
  assert.ok(preview, 'hover zoom overlay renders without reflowing comment layout');
  assert.equal(preview.style.pointerEvents, 'none');
  const out = new w.Event('pointerout', { bubbles: true });
  img.dispatchEvent(out);
  assert.equal(w.document.querySelector('.ani-comment-hover-zoom'), null);

  const viewer = w.document.createElement('div');
  viewer.className = 'pswp';
  w.document.body.append(viewer);
  Object.defineProperty(w, 'scrollY', { value: 250 });
  let getBounds;
  w.PhotoSwipe = class {
    constructor(_viewer, _ui, _items, options) {
      getBounds = options.getThumbBoundsFn;
    }
  };
  img.addEventListener('click', () => new w.PhotoSwipe(viewer, null, [{ w: 400, h: 300 }], {}));
  img.dispatchEvent(over);
  const enlarged = w.document.querySelector('.ani-comment-hover-zoom');
  enlarged.getBoundingClientRect = () => {
    assert(enlarged.isConnected, 'capture the hover bounds before removing the overlay');
    return { left: 36, top: 65, width: 235, height: 176.25 };
  };
  img.click();
  assert.equal(w.document.querySelector('.ani-comment-hover-zoom'), null);
  assert.deepEqual({ ...getBounds(0) }, { x: 36, y: 315, w: 235 });
  assert.deepEqual({ ...getBounds(0) }, { x: 40, y: 330, w: 160 });

  const repairsCss = fs.readFileSync('src/ui-repairs.css', 'utf8');
  assert.match(repairsCss, /a\.more-text[\s\S]*text-decoration:\s*none/);
  assert.match(repairsCss, /a\.more-text:is\(:hover,\s*:focus-visible\)[\s\S]*text-decoration:\s*underline/);
  assert.match(repairsCss, /\.reply-content__cont a:not\(\.more-text\)[\s\S]*color:\s*var\(--ani-accent/);
  assert.match(repairsCss, /\.reply-content__cont a:not\(\.more-text\):is\(:hover,\s*:focus-visible\)[\s\S]*text-decoration:\s*underline/);
  assert.match(repairsCss, /\.ani-time-capsule\s*\{[\s\S]*padding:\s*0 20px !important/);
  assert.match(repairsCss, /\.ani-time-capsule > \.vjs-time-divider\s*\{[\s\S]*padding:\s*0 4px !important/);
  assert.doesNotMatch(repairsCss, /img\[data-ani-image-expanded\]/);
});

test('original episode toggle keeps control position, avoids duplicate work, and caches card elements', async t => {
  const episodes = Array.from({ length: 8 }, (_, index) =>
    `<li${index === 7 ? ' class="playing"' : ''}><a href="?sn=${9001 + index}">${index + 1}</a></li>`).join('');
  const storageOnChanged = [];
  let currentSyncState = { episodeThumbnailGrid: true };
  let themeSyncSkips = 0;
  const dom = bootEnhancements(`<div id="BH_background"><div class="container-player">
    <div class="anime-title"><div class="anime_name"><h1>測試番劇 [8]</h1></div><section class="season"><ul>${episodes}</ul></section></div>
  </div></div>`, '/animeVideo.php?sn=9008', {
    chromeMock: {
      storage: {
        sync: {
          get(defaults, cb) { queueMicrotask(() => cb({ ...defaults, ...currentSyncState })); },
          set(next, cb) {
            const changes = {};
            for (const [k, v] of Object.entries(next || {})) {
              if (currentSyncState[k] !== v) changes[k] = { oldValue: currentSyncState[k], newValue: v };
            }
            currentSyncState = { ...currentSyncState, ...next };
            for (const fn of storageOnChanged) fn(changes, 'sync');
            cb?.();
          },
        },
        onChanged: { addListener(fn) { storageOnChanged.push(fn); } },
      },
    },
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  const d = w.document;
  await new Promise(resolve => setTimeout(resolve, 40));

  const ul = d.querySelector('.season ul');
  const toggle = d.querySelector('.ani-ep-layout-switch');
  assert.ok(toggle);
  const initialFrames = [...ul.querySelectorAll('.ani-episode-frame')];
  assert.equal(initialFrames.length, 8);
  for (const link of ul.querySelectorAll('li > a')) link.dataset.aniEpisodeMediaReady = 'true';

  const animCalls = [];
  ul.animate = (frames, options) => {
    animCalls.push({ frames, options });
    return { cancel() {}, onfinish: null, oncancel: null };
  };
  const itemAnims = [];
  for (const li of ul.querySelectorAll('li')) {
    li.animate = (frames, options) => {
      itemAnims.push({ frames, options });
      return { cancel() {} };
    };
  }
  const toggleAnims = [];
  toggle.animate = (frames, options) => {
    toggleAnims.push({ frames, options });
    return { cancel() {} };
  };
  let scrollDeltas = [];
  Object.defineProperty(w, 'scrollY', { value: 300, configurable: true });
  w.scrollBy = (opts) => { scrollDeltas.push(opts.top); };
  toggle.getBoundingClientRect = () => ({ top: 120 });

  let historyCalls = 0;
  w.aniGetEpisodeWatchHistory = () => {
    historyCalls++;
    return Promise.resolve(new Map());
  };

  // Switch to original layout: onChanged echo must not trigger a second ul.animate
  const origSetProperty = d.body.style.setProperty.bind(d.body.style);
  d.body.style.setProperty = (...args) => {
    if (String(args[0]).startsWith('--ani-')) themeSyncSkips++;
    return origSetProperty(...args);
  };
  toggle.click();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(toggle.getAttribute('aria-checked'), 'true');
  assert.equal(ul.querySelectorAll('.ani-episode-frame').length, 0);
  assert.equal(animCalls.length, 0);
  assert.equal(toggleAnims.length, 1);
  assert.equal(itemAnims.length, 6);
  assert.equal(itemAnims[0].options.fill, 'backwards');
  assert.equal(themeSyncSkips, 0);

  // Switch back to card layout: restores cached frames without re-querying watch history
  toggle.click();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(toggle.getAttribute('aria-checked'), 'false');
  assert.equal(ul.querySelectorAll('.ani-episode-frame').length, 8);
  assert.equal(ul.querySelector('.ani-episode-frame'), initialFrames[0]);
  assert.equal(d.querySelector('.season ul > li > a').dataset.aniEpisodeMediaCached, 'true');
  assert.equal(historyCalls, 0);
  assert.equal(animCalls.length, 0);
  assert.equal(toggleAnims.length, 2);
  assert.equal(itemAnims.length, 14);

  // Scroll anchoring adjusts window scroll when button top shifts on next frame
  const prevOnclick = toggle.onclick;
  toggle.onclick = () => {
    const origGetRect = toggle.getBoundingClientRect;
    let calls = 0;
    toggle.getBoundingClientRect = () => ({ top: calls++ === 0 ? 120 : 180 });
    prevOnclick();
    setTimeout(() => { toggle.getBoundingClientRect = origGetRect; }, 30);
  };
  toggle.click();
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.deepEqual(scrollDeltas, [60]);

  const enhCss = fs.readFileSync('src/enhancements.css', 'utf8');
  assert.match(enhCss, /\.ani-episode-shelf\s*\{[^}]*overflow-anchor:\s*none/);
  assert.match(enhCss, /\.ani-episode-shelf\s+\.season\s+li\s*>\s*a\s*\{[^}]*transition:\s*none\s*!important/);
  assert.match(enhCss, /\.ani-episode-shelf\s+\.season\s*>\s*ul\.ani-ep-managed\s*\{[^}]*margin-block-start:\s*12px\s*!important/);
});

test('upcoming episode without synopsis displays 本集暫無簡介 even before earlier episodes finish translating', async t => {
  const dom = bootEnhancements(`<div id="BH_background">
    <div class="anime-title"><div class="anime_name"><h1>未公布簡介測試 [1]</h1></div><div class="anime_info_detail">上架時間：2099/11/13 23:30</div></div>
    <section class="season"><ul><li><a href="?sn=9101">1</a></li></ul></section>
  </div>`, '/animeVideo.php?sn=9101', {
    chromeMock: { runtime: { lastError: null, sendMessage(message, done) {
      done(message.type === 'ani-fetch-episode-titles' ? {
        ok: true,
        episodes: {
          1: { jp: '第1話', description: '日本語のあらすじです。' },
          2: { jp: '第2話', airdate: '2099-11-20', description: '' },
        },
      } : {});
    } } },
  });
  t.after(() => dom.window.close());
  await new Promise(resolve => setTimeout(resolve, 50));
  const preview = dom.window.document.querySelector('.ani-upcoming-episode');
  assert.ok(preview, 'upcoming episode card renders');
  assert.equal(preview.querySelector('.ani-episode-card-description').dataset.text, '本集暫無簡介');
});

test('upcoming episode keeps weekly release time across hiatus weeks', async t => {
  const dom = bootEnhancements(`<div id="BH_background">
    <div class="anime-title"><div class="anime_name"><h1>休刊時間測試 [8]</h1></div><div class="anime_info_detail">上架時間：2099/11/23 21:00</div></div>
    <section class="season"><ul><li class="playing"><a href="?sn=9308">8</a></li></ul></section>
  </div>`, '/animeVideo.php?sn=9308', {
    chromeMock: { runtime: { lastError: null, sendMessage(message, done) {
      done(message.type === 'ani-fetch-episode-titles' ? {
        ok: true,
        episodes: { 9: { jp: '第9話', airdate: '2099-12-07', description: '' } },
      } : {});
    } } },
  });
  t.after(() => dom.window.close());
  await new Promise(resolve => setTimeout(resolve, 50));
  const preview = dom.window.document.querySelector('.ani-upcoming-episode');
  assert.equal(preview.querySelector('time span').textContent, '12/07 21:00');
  assert.equal(preview.querySelector('time').dateTime, '2099-12-07T21:00:00+08:00');
});

test('consent redirect guard blocks idle homepage navigation even with active userActivation', async t => {
  const dom = bootEnhancements(`<div id="BH_background">
    <div id="ani_video"><div class="R18"><button class="choose-btn-agree">同意</button><button class="choose-btn-disagree">不同意</button></div></div>
  </div>`, '/animeVideo.php?sn=9201');
  t.after(() => dom.window.close());
  const w = dom.window;
  const navListeners = [];
  w.navigation = {
    addEventListener(type, fn) { if (type === 'navigate') navListeners.push(fn); },
  };
  Object.defineProperty(w.navigator, 'userActivation', { value: { isActive: true }, configurable: true });
  w.eval(fs.readFileSync('src/topbar-bridge.js', 'utf8'));
  assert.equal(navListeners.length, 1);

  // Player removes prompt before requesting an idle redirect to http://ani.gamer.com.tw/index.php
  w.document.querySelector('.R18').remove();
  let prevented = false;
  navListeners[0]({
    cancelable: true,
    userInitiated: false,
    navigationType: 'push',
    destination: { url: 'http://ani.gamer.com.tw/index.php' },
    preventDefault() { prevented = true; },
  });
  assert.equal(prevented, true, 'idle redirect is blocked even when userActivation is active');
});

test('comment read-more and expand-replies trigger smooth entrance animations', async t => {
  const dom = bootEnhancements(`<div id="BH_background">
    <div id="w-post-box">
      <div class="webview_commendlist">
        <div class="main-container_wall-post">
          <div class="c-reply__item" data-w-comment-row="1">
            <div class="reply-content">
              <article class="reply-content__cont">
                <p class="text_content-hide">這是一段很長的留言內容</p>
                <a class="more-text" href="javascript:;"><b>&nbsp;......閱讀更多</b></a>
              </article>
            </div>
            <a class="c-more-msg" href="javascript:;">展開 2 則回覆</a>
            <div class="reply-list"></div>
          </div>
        </div>
      </div>
    </div>
  </div>`, '/animeVideo.php?sn=8202');
  t.after(() => dom.window.close());
  const w = dom.window;
  const d = w.document;
  await new Promise(resolve => setTimeout(resolve, 40));

  const cont = d.querySelector('.reply-content__cont');
  let contHeight = 48;
  cont.getBoundingClientRect = () => ({ height: contHeight });
  const contAnims = [];
  cont.animate = (frames, options) => {
    const anim = { frames, options, onfinish: null, oncancel: null };
    contAnims.push(anim);
    return anim;
  };
  const moreLink = d.querySelector('a.more-text');
  moreLink.addEventListener('click', () => {
    contHeight = 140;
    moreLink.remove();
  });
  moreLink.click();
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(contAnims.length, 1);
  assert.equal(contAnims[0].frames[0].height, '48px');
  assert.equal(contAnims[0].frames[1].height, '140px');
  contAnims[0].onfinish?.();
  assert.equal(cont.style.overflow, '');

  const replyBtn = d.querySelector('.c-more-msg');
  const replyList = d.querySelector('.reply-list');
  const replyAnims = [];
  let image;
  let avatar;
  replyBtn.addEventListener('click', () => {
    const r1 = d.createElement('div');
    r1.className = 'c-msg-item';
    r1.animate = (frames, options) => { replyAnims.push({ frames, options }); return {}; };
    const r2 = d.createElement('div');
    r2.className = 'c-msg-item';
    r2.innerHTML = '<div class="reply-avatar"><img class="lazyload" data-src="/avatar.png" alt=""></div><article class="reply-content__cont"><img class="lazyload" data-src="/reply.png" alt=""></article>';
    [avatar, image] = r2.querySelectorAll('img');
    r2.animate = (frames, options) => { replyAnims.push({ frames, options }); return {}; };
    replyList.append(r1, r2);
  });
  replyBtn.click();
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(replyAnims.length, 1);
  assert.equal(replyAnims[0].frames[0].opacity, 0);
  assert(replyList.lastElementChild.classList.contains('ani-reply-media-pending'));
  assert.equal(image.getAttribute('src'), '/reply.png');
  assert.equal(avatar.getAttribute('src'), '/avatar.png');
  image.dispatchEvent(new w.Event('load'));
  await Promise.resolve();
  assert.equal(replyAnims.length, 1);
  avatar.dispatchEvent(new w.Event('error'));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(replyAnims.length, 2);
  assert.equal(replyAnims[1].options.delay ?? 0, 0);
  assert.equal(replyAnims[1].options.duration, 180);
  assert(!replyList.lastElementChild.classList.contains('ani-reply-media-pending'));
});

test('sidebar strips truncated trailing staff label and enriches sparse staff from Bangumi and linked ACG credits', async t => {
  const dom = bootEnhancements(`<div id="BH_background">
    <div class="anime_name"><h1>冷淡的佐藤同學 [1]</h1><a id="bgmtv" href="https://bgm.tv/subject/555666">點格子</a></div>
    <div class="subtitle"><div class="ani-tabs"></div><div class="ani-tab-content"></div></div>
    <section class="data">
      <ul class="type-list">
        <li class="type"><span class="title">導演監督</span><span class="content">吉村文宏</span></li>
        <li class="type"><span class="title">製作廠商</span><span class="content">手塚製作公司</span></li>
      </ul>
      <div class="data-intro">
        <p>班上的高嶺之花・佐藤小春。<br>｜導演監督：</p>
        <a href="https://acg.gamer.com.tw/acgDetail.php?s=99900">作品資料</a>
      </div>
    </section>
  </div>`, '/animeVideo.php?sn=10838', {
    chromeMock: {
      runtime: {
        lastError: null,
        sendMessage(message, reply) {
          if (message.type === 'ani-fetch-acg-credits') {
            queueMicrotask(() => reply({
              credits: '<b>＜製作團隊＞</b><li>｜劇本統籌：青島崇</li><li>｜音樂：<a href="#">成田旬</a></li>',
            }));
          } else if (message.type === 'ani-fetch-bangumi-staff') {
            assert.equal(message.id, '555666');
            queueMicrotask(() => reply({
              staff: [
                { title: '导演', val: '吉村文宏' },
                { title: '系列构成', val: '青島崇' },
                { title: '美术监督', val: '測試美術' },
                { title: '色彩设计', val: '測試色彩' },
                { title: '音响监督', val: '測試音響' },
              ],
            }));
          }
        },
      },
    },
  });
  t.after(() => dom.window.close());
  const { document } = dom.window;
  await new Promise(resolve => dom.window.setTimeout(resolve, 20));
  assert.equal(document.querySelector('.ani-side-synopsis').textContent, '班上的高嶺之花・佐藤小春。');
  const staffText = document.querySelector('[data-credit-panel="製作團隊"]').textContent;
  assert.match(staffText, /劇本統籌.*青島崇/);
  assert.match(staffText, /音樂.*成田旬/);
  assert.match(staffText, /美術監督.*測試美術/);
  assert.match(staffText, /色彩設計.*測試色彩/);
  assert.match(staffText, /音響監督.*測試音響/);
});

test('fullscreen paused-idle centers title overlay after inactivity and clears on activity or play', async (t) => {
  const dom = bootEnhancements(`
    <div id="BH_background">
      <div class="anime-title">
        <div class="anime_name"><h1>測試動畫 [8]</h1></div>
      </div>
      <div id="ani_video" class="video-js vjs-fullscreen vjs-has-started vjs-paused" data-ani-paused-idle-delay="25">
        <video></video>
        <div class="vjs-control-bar"></div>
      </div>
      <section class="season">
        <ul>
          <li class="playing"><a href="?sn=9008">8</a></li>
        </ul>
      </section>
    </div>
  `, '/animeVideo.php?sn=9008', {
    fetch: () => Promise.resolve({ ok: false, status: 404, json: async () => ({}) }),
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  const { document } = window;
  const player = document.getElementById('ani_video');

  await new Promise((r) => setTimeout(r, 15));
  assert.equal(player.querySelector('.ani-fs-episode')?.textContent, 'EP.8');
  assert.equal(player.classList.contains('ani-fs-paused-idle'), false);

  await new Promise((r) => setTimeout(r, 45));
  assert.equal(player.classList.contains('ani-fs-paused-idle'), true);

  player.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true }));
  assert.equal(player.classList.contains('ani-fs-paused-idle'), false);

  await new Promise((r) => setTimeout(r, 45));
  assert.equal(player.classList.contains('ani-fs-paused-idle'), true);

  player.classList.remove('vjs-paused');
  player.classList.add('vjs-playing');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(player.classList.contains('ani-fs-paused-idle'), false);

  player.classList.remove('vjs-playing', 'vjs-fullscreen');
  player.classList.add('vjs-paused');
  await new Promise((r) => setTimeout(r, 45));
  assert.equal(player.classList.contains('ani-fs-paused-idle'), false);

  const enhCss = fs.readFileSync('src/enhancements.css', 'utf8');
  assert.match(enhCss, /#ani_video \.ani-fs-episode\s*\{[^}]*font-size:\s*18px;/);
  assert.match(enhCss, /aniFsPausedCenterIn\s*\{\s*from\s*\{\s*transform:[^}]*\}\s*to\s*\{\s*transform:/);
  assert.match(enhCss, /\.ani-fs-episode:not\(\[hidden\]\)\s*\{[^}]*-webkit-backdrop-filter:\s*blur\(24px\)/);
  assert.match(enhCss, /\.ani-fs-subtitle:not\(\[hidden\]\)\s*\{[^}]*-webkit-backdrop-filter:\s*blur\(24px\)/);
});

test('legacy danmu refresh icon is hidden unconditionally before new danmu tools bar mounts', () => {
  const uiCss = fs.readFileSync('src/ui-repairs.css', 'utf8');
  const enhCss = fs.readFileSync('src/enhancements.css', 'utf8');
  assert.match(uiCss, /#ani-tab-content-1\s+:is\([^\n]*button\.refresh[^\n]*\.ani-danmu-reload-pill[^\n]*\):not\(\.ani-dm-refresh-btn\)\s*\{\s*display:\s*none\s*!important;/);
  assert.doesNotMatch(uiCss, /\.ani-danmu-count-box\s*>\s*button\.refresh\s*\{/);
  assert.match(enhCss, /body\.ani-ambientlight-ui\s+#BH_background\s+\.subtitle\s+#ani-tab-content-1\s+:is\([^\n]*button\.refresh[^\n]*\):not\(\.ani-dm-refresh-btn\)/);
});

test('theme song fallback cards resolve YouTube thumbnails asynchronously and keep unified grid layout', async t => {
  const vm = await import('node:vm');
  const originContext = vm.createContext({ URL, Number, String, Array, Object, Set, JSON });
  vm.runInContext(fs.readFileSync('src/work-origin.js', 'utf8'), originContext);
  const sampleSearchHtml = `<html><script>var ytInitialData = ${JSON.stringify({
    contents: [
      { videoRenderer: { videoId: 'SHORT123456', title: { runs: [{ text: '初恋リプライ #shorts' }] }, lengthText: { simpleText: '0:28' } } },
      { videoRenderer: { videoId: 'I1IWV7ZuQbM', title: { runs: [{ text: '【MV】初恋リプライ／HoneyWorks feat.星川サラ' }] }, lengthText: { simpleText: '3:52' } } },
    ],
  })};</script></html>`;
  const requestedQueries = [];
  const resolvedId = await originContext.fetchYoutubeThemeVideoId('「初恋リプライ」', 'HoneyWorks feat. 星川サラ', async (url) => {
    requestedQueries.push(new URL(url).searchParams.get('search_query'));
    return {
      ok: requestedQueries.length >= 2,
      text: async () => sampleSearchHtml,
    };
  });
  assert.deepEqual(requestedQueries, ['初恋リプライ HoneyWorks 星川サラ', '初恋リプライ HoneyWorks']);
  assert.equal(resolvedId, 'I1IWV7ZuQbM');

  const dom = bootEnhancements(`<div id="BH_background">
    <div id="ani-info">
      <div class="grid song">
        <div>OP「シュガーソルト」</div>
        <div>オーイシマサヨシ</div>
        <a href="https://www.youtube.com/results?search_query=sugar">YT</a>
        <div>ED「初恋リプライ」</div>
        <div>HoneyWorks feat. 星川サラ</div>
        <a href="https://www.youtube.com/results?search_query=reply">YT</a>
      </div>
    </div>
    <section class="data"><div class="data-intro"><p>測試作品簡介。</p></div></section>
    <div class="anime_name"><h1>測試動畫 [1]</h1></div>
    <div class="subtitle"><div class="ani-tabs"></div><div class="ani-tab-content"></div></div>
  </div>`, '/animeVideo.php?sn=10839', {
    chromeMock: {
      runtime: {
        lastError: null,
        sendMessage(message, reply) {
          if (message.type === 'ani-fetch-theme-video') {
            const videoId = message.title.includes('シュガーソルト') ? '_7O9YnwO3d4' : 'I1IWV7ZuQbM';
            queueMicrotask(() => reply({ videoId }));
          }
        },
      },
    },
  });
  t.after(() => dom.window.close());
  const { document } = dom.window;
  await new Promise(resolve => dom.window.setTimeout(resolve, 40));

  const imgs = [...document.querySelectorAll('[data-credit-panel="主題曲"] .ani-theme-song-cover img')].map(img => img.getAttribute('src'));
  assert.deepEqual(imgs, [
    'https://i.ytimg.com/vi/_7O9YnwO3d4/mqdefault.jpg',
    'https://i.ytimg.com/vi/I1IWV7ZuQbM/mqdefault.jpg',
  ]);
  const ytLinks = [...document.querySelectorAll('[data-credit-panel="主題曲"] .ani-theme-song-youtube')].map(a => a.getAttribute('href'));
  assert.deepEqual(ytLinks, [
    'https://www.youtube.com/watch?v=_7O9YnwO3d4',
    'https://www.youtube.com/watch?v=I1IWV7ZuQbM',
  ]);

  const repairsCss = fs.readFileSync('src/ui-repairs.css', 'utf8');
  assert.doesNotMatch(repairsCss, /:is\(\s*>/, 'avoids invalid relative combinators inside :is()');
  assert.match(repairsCss, /\.ani-theme-song-row\s*>\s*details\s*\{[\s\S]*grid-area:\s*summary/);
  assert.match(repairsCss, /\.ani-theme-song:not\(:has\(>\s*\.ani-theme-song-cover\)\)\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(repairsCss, /@keyframes aniCreditPanelIn/);
  assert.match(repairsCss, /\.ani-credit-switch button:is\(\[data-credit-choice="聲優"\], \[data-credit-choice="主題曲"\]\) > svg\s*\{\s*width:15px;\s*height:15px;\s*\}/);

  const switcher = document.querySelector('.ani-credit-switch');
  assert.equal(switcher.dataset.creditActive, '0');
  const themeBtn = switcher.querySelector('[data-credit-choice="主題曲"]');
  themeBtn.click();
  assert.equal(switcher.dataset.creditActive, '2');
  const themePanel = document.querySelector('[data-credit-panel="主題曲"]');
  assert.equal(themePanel.hidden, false);
  assert.equal(themePanel.classList.contains('is-credit-entering'), true);
  assert.match(repairsCss, /@keyframes aniCreditPanelIn\s*\{\s*from\s*\{\s*opacity:\s*0\.25;\s*transform:\s*translateY\(8px\)/);
  assert.doesNotMatch(repairsCss, /ani-credit-reveal/);
  assert.match(repairsCss, /@keyframes aniDanmuFadeIn\s*\{\s*from\s*\{\s*opacity:\s*0\.2;\s*transform:\s*translateY\(8px\)/);
  assert.match(repairsCss, /@keyframes aniDanmuSoftFade/);
  assert.match(repairsCss, /\.ani-plus-danmu-count\s*>\s*:nth-child\(n\+2\)/);
  assert.match(repairsCss, /#sub_list:is\(\.ani-dm-loading,\s*:not\(\[data-tip\]\):empty\)::before/);
});
