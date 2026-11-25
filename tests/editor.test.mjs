import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {JSDOM}=require('jsdom');
const dom=new JSDOM('<body><div class="top_sky"><div class="sky"><div class="container-player"></div></div></div><div id="BH_background"><div class="container-player"><section class="player"><div class="videoframe"><div class="video"><div id="video-container"><div id="ani_video" class="video-js"><video class="vjs-tech"></video><div class="vjs-control-bar"></div></div></div></div></div><div class="subtitle"></div></section><div class="anime-title"><div class="season"><ul><li><a href="#">1</a></li></ul></div></div></div></div></body>',{url:'https://ani.gamer.com.tw/animeVideo.php?sn=48204',runScripts:'outside-only',pretendToBeVisual:true});
const fixtures=dom.window.document.querySelector('#BH_background .container-player');
fixtures.insertAdjacentHTML('beforeend','<section class="data">資料</section><div class="old_list">相關動畫</div><div class="animate-theme-list"><div class="theme-extend-block"><article class="extend-card">新聞</article></div></div><div id="w-post-box">留言</div>');
const w=dom.window;w.matchMedia=()=>({matches:false,addEventListener(){}});
w.sessionStorage.setItem('aniPreviousBackground','silk');
const playerBar=w.document.querySelector('.vjs-control-bar');
playerBar.innerHTML='<div class="control-bar-leftbtn"><button class="vjs-play-control"><span class="vjs-icon-placeholder"></span></button></div><div class="danmutext_area"><button class="danmu-send_btn">送出</button></div><div class="control-bar-rightbtn"><button class="vjs-fullscreen-control"><span class="vjs-icon-placeholder"></span></button></div>';
let sent=0;playerBar.querySelector('.danmu-send_btn').addEventListener('click',()=>sent++);
playerBar.querySelector('.control-bar-leftbtn').insertAdjacentHTML('beforeend','<div class="vjs-volume-panel"><button class="vjs-mute-control"></button><div class="vjs-volume-control"></div></div>');
w.document.body.insertAdjacentHTML('beforeend','<div class="dialogify__content"><h5 class="dialogify_title">分享</h5><div class="dialogify__body"><textarea id="share-url-text">https://ani.baha.tw/1</textarea><input class="check_timecode" type="checkbox"><label class="label_timecode">從<input id="share-url-tc">開始播放</label></div><div class="btn-box"><button>複製網址</button></div></div>');
let copied=0;const copyAction=w.document.querySelector('.dialogify__content .btn-box button');copyAction.addEventListener('click',()=>copied++);
w.HTMLCanvasElement.prototype.getContext=()=>({});w.AniAmbientRenderer={create:()=>({kind:'gpu',draw:()=>true,destroy(){},clear(){}})};
let mutations=0;const OriginalObserver=w.MutationObserver;
w.MutationObserver=class extends OriginalObserver{constructor(fn){super((entries,observer)=>{mutations++;if(mutations>100)throw new Error('Observer feedback loop');fn(entries,observer);});}};
fixtures.insertAdjacentHTML('beforeend', '<div id="blockVideoInSeason"><div class="newanime-nav"><div class="btn-newanime-filter"><p class="newanime-filter-text">依更新日排列</p><ul class="filter-items"><li class="item-newupdate">依更新日排列</li><li class="item-famous">依平均人氣排列</li></ul></div></div></div>');
for (const item of w.document.querySelectorAll('.filter-items li')) item.addEventListener('click', () => { w.document.querySelector('.newanime-filter-text').textContent = item.textContent; });
let syncMiniPlayerIntersection;
w.IntersectionObserver = class {
  constructor(callback, options) {
    if (options?.rootMargin === '-48px 0px 0px') syncMiniPlayerIntersection = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};
const danmuSidebar = w.document.querySelector('.subtitle');
danmuSidebar.innerHTML = '<div id="ani-tab-content-1"><div class="anime-tip"><div>本動畫共 433 筆彈幕</div></div></div>';
const nativeDanmuCount = danmuSidebar.querySelector('.anime-tip > div');
for(const file of ['settings.js','topbar-bridge.js','content.js'])w.eval(fs.readFileSync('src/'+file,'utf8'));
assert.equal(danmuSidebar.querySelector('.anime-tip > div'), nativeDanmuCount);
const sendButton=playerBar.querySelector('.danmu-send_btn');
assert.equal(sendButton.getAttribute('aria-label'),'發送彈幕');
assert(sendButton.querySelector('.ani-send-glyph'),'send icon follows the supplied paper-plane reference');
sendButton.click();assert.equal(sent,1,'native send handler survives the icon replacement');
const volumeSlider=playerBar.querySelector('.ani-volume-slider');assert(volumeSlider);volumeSlider.value='35';volumeSlider.dispatchEvent(new w.Event('input'));assert.equal(w.document.querySelector('video').volume,.35,'horizontal slider updates the actual media volume');
assert(w.document.querySelector('.ani-share-preview canvas'));assert(w.document.querySelector('.ani-share-time-row .check_timecode'));copyAction.click();assert.equal(copied,1,'native copy handler survives share card rearrangement');
const sortOptions = w.document.querySelector('.ani-sort-options');
assert.equal(sortOptions.children.length, 2);
assert.equal(sortOptions.children[0].getAttribute('aria-pressed'), 'true');
sortOptions.children[1].click();
assert.equal(w.document.querySelector('.newanime-filter-text').textContent, '依平均人氣排列');
assert.equal(sortOptions.children[1].getAttribute('aria-pressed'), 'true');
assert.equal(sortOptions.children[0].getAttribute('aria-pressed'), 'false');
sortOptions.children[0].click();
assert.equal(sortOptions.children[0].getAttribute('aria-pressed'), 'true');
const panel=w.document.querySelector('.ani-view-settings-panel'),change=(key,value)=>{const e=panel.querySelector(`[data-setting="${key}"]`);if(e.type==='checkbox')e.checked=value;else e.value=value;e.dispatchEvent(new w.Event('input',{bubbles:true}));};
let heatRequests = 0;
w.fetch = async (url, init) => {
  assert.equal(url, '/ajax/danmuGet.php');
  assert.equal(init.body.get('sn'), '48204');
  heatRequests++;
  return { ok: true, json: async () => [{ time: 100 }, { time: 500 }, { time: 501 }] };
};
const heatVideo = w.document.querySelector('video');
Object.defineProperty(heatVideo, 'duration', { configurable: true, value: 120 });
playerBar.insertAdjacentHTML('afterbegin', '<div class="vjs-progress-control"></div>');
heatVideo.dispatchEvent(new w.Event('durationchange'));
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(panel.querySelector('[data-setting="showDanmuHeat"]').checked, true);
assert(playerBar.querySelector('.ani-danmu-heat path'));
change('showDanmuHeat', false);
assert.equal(playerBar.querySelector('.ani-danmu-heat'), null);
change('showDanmuHeat', true);
assert(playerBar.querySelector('.ani-danmu-heat path'));
const plusHeat = w.document.createElement('input');
plusHeat.type = 'checkbox';
plusHeat.checked = true;
plusHeat.setAttribute('data-ani-plus-danmu-heat', '');
fixtures.append(plusHeat);
plusHeat.click();
assert.equal(playerBar.querySelector('.ani-danmu-heat'), null);
heatVideo.dispatchEvent(new w.Event('playing'));
assert.equal(playerBar.querySelector('.ani-danmu-heat'), null);
plusHeat.click();
assert(playerBar.querySelector('.ani-danmu-heat path'));
plusHeat.remove();
assert.equal(heatRequests, 1);
fixtures.insertAdjacentHTML('beforeend', '<div class="plus-toast-item">設定已儲存</div><div class="plus-toast-item">無法儲存設定</div>');
const [savedNotice, failedNotice] = fixtures.querySelectorAll('.plus-toast-item');
await Promise.resolve();
assert(savedNotice.classList.contains('ani-settings-save-notice'));
assert(!failedNotice.classList.contains('ani-settings-save-notice'));
savedNotice.textContent = '已複製';
await Promise.resolve();
assert(!savedNotice.classList.contains('ani-settings-save-notice'));
assert.equal(panel.querySelector('[data-setting="method"]').value,'diffuse','Fresh defaults use the requested soft diffusion');
assert.equal(panel.querySelector('[data-setting="diffusionDepth"]').value,'100');
assert.equal(panel.querySelector('[data-category-shortcut="general"]').getAttribute('aria-current'),'page','Settings open directly to first category 一般設定');
assert(w.document.querySelector('meta[data-ani-theme-lock]'),'theme palette is not recolored by another dark-mode pass');
panel.querySelector('[data-category-shortcut="themes"]').click();
w.document.querySelector('.ani-view-settings').click();
assert.equal(panel.querySelector('[data-category-shortcut="general"]').getAttribute('aria-current'),'page','Every settings opening starts on first category 一般設定');
panel.querySelector('[data-effect-choice="soft"]').click();
assert.equal(panel.querySelector('[data-effect-choice="soft"]').getAttribute('aria-pressed'),'true');
panel.querySelector('[data-category="light"]').click();
panel.querySelector('[data-reset-category]').click();
assert.equal(panel.querySelector('[data-setting="method"]').value,w.AniAmbientSettings.defaults.method);
assert.equal(panel.querySelector('[data-setting="blur"]').value,String(w.AniAmbientSettings.defaults.blur));
change('textSize',18);change('headerOpacity',50);
panel.querySelector('[data-category="surfaces"]').click();panel.querySelector('[data-reset-category]').click();
assert.equal(panel.querySelector('[data-setting="headerOpacity"]').value,String(w.AniAmbientSettings.defaults.headerOpacity));
assert.equal(panel.querySelector('[data-setting="textSize"]').value,'18','Category reset preserves unrelated fields');
assert.equal(w.AniAmbientSettings.normalize({customFontName:'Name;url(test)'}).customFontName,'Nameurltest');
await new Promise(resolve=>setTimeout(resolve,25));assert.ok(mutations<30,'Paused native player must remain idle');
assert.equal(panel.querySelector('[data-setting="watchWidth"]').disabled,true);
assert.equal(w.document.body.classList.contains('ani-custom-watch-width'),false);
change('customWatchWidth',true);assert.equal(panel.querySelector('[data-setting="watchWidth"]').disabled,false);change('customWatchWidth',false);
assert.equal(w.document.body.classList.contains('ani-theater-layout'),false,'Native layout is the default');
change('playerLayout','columns');assert.equal(w.document.body.classList.contains('ani-theater-layout'),true);
const frame=w.document.querySelector('.videoframe'),box=frame.querySelector('.video');frame.classList.add('vjs-fullwindow');box.classList.add('fullwindow');
await new Promise(resolve=>setTimeout(resolve,25));assert.equal(w.document.body.classList.contains('ani-theater-layout'),false,'Native theater mode must take priority');
frame.classList.remove('vjs-fullwindow');box.classList.remove('fullwindow');await new Promise(resolve=>setTimeout(resolve,25));assert.equal(w.document.body.classList.contains('ani-theater-layout'),true);
change('episodesLayout',false);assert.equal(w.document.querySelector('.ani-episode-shelf'),null);assert.ok(w.document.querySelector('.anime-title .season'));
change('navLayout',false);assert.equal(w.document.body.classList.contains('ani-layout-nav'),false);assert.equal(w.document.body.classList.contains('ani-layout-info'),true);
for(const key of ['cinema','charcoal','paper','forest','violet','reading']){panel.querySelector(`[data-theme-preset="${key}"]`).click();assert.equal(panel.querySelector(`[data-theme-preset="${key}"]`).getAttribute('aria-pressed'),'true');assert.equal(panel.querySelector('[data-setting="playerLayout"]').value,'columns');assert.equal(panel.querySelector('[data-setting="customWatchWidth"]').checked,false);}

{
  const slot = w.document.querySelector('.videoframe');
  const player = slot.querySelector('#ani_video');
  let bottom = -100;
  slot.getBoundingClientRect = () => ({ top: bottom - 300, bottom, height: 300 });
  const intersect = () => syncMiniPlayerIntersection([{ boundingClientRect: slot.getBoundingClientRect() }]);
  assert(panel.querySelector('[data-settings-page="general"] [data-setting="scrollMiniPlayer"]'));
  intersect();
  assert(player.classList.contains('ani-mini-pip'));
  const video = player.querySelector('video');
  Object.defineProperty(video, 'duration', { value: 30 });
  const mainSeek = player.querySelector('.ani-playback-seek-group');
  const miniSeek = player.querySelector('.ani-mini-pip-controls');
  const seek = (group, direction) => group.querySelector(`[data-ani-playback-seek="${direction}"]`);
  video.currentTime = 3;
  seek(miniSeek, -1).click();
  assert.equal(video.currentTime, 0);
  seek(miniSeek, 1).click();
  assert.equal(video.currentTime, 5);
  change('playbackSeekSeconds', 12);
  assert.equal(seek(mainSeek, 1).getAttribute('aria-label'), '快轉 12 秒');
  assert(!seek(mainSeek, 1).hasAttribute('title') && !seek(miniSeek, 1).hasAttribute('title'));
  assert.equal(seek(miniSeek, -1).textContent, '12');
  seek(mainSeek, 1).click();
  assert.equal(video.currentTime, 17);
  seek(miniSeek, 1).click();
  seek(miniSeek, 1).click();
  assert.equal(video.currentTime, 30);
  player.classList.add('vjs-ad-playing');
  seek(mainSeek, -1).click();
  assert.equal(video.currentTime, 30);
  player.classList.remove('vjs-ad-playing');
  change('scrollMiniPlayer', false);
  assert(!player.classList.contains('ani-mini-pip'));
  assert.equal(slot.style.minHeight, '');
  intersect();
  assert(!player.classList.contains('ani-mini-pip'));
  change('scrollMiniPlayer', true);
  assert(player.classList.contains('ani-mini-pip'));
  bottom = 48;
  intersect();
  assert(!player.classList.contains('ani-mini-pip'));
  assert.equal(slot.style.minHeight, '');
}
assert.equal(w.AniAmbientSettings.defaults.quickCollapse,true);
assert.equal(panel.querySelector('[data-setting="commentArrangement"], [data-setting="foldComments"]'), null);
assert.ok(w.document.querySelector('.ani-watch-tools').previousElementSibling.matches('section.player'),'Viewing tools follow the native player');
assert.equal(w.AniAmbientSettings.defaults.hideDanmuScrollbar,true);
assert.ok(w.document.querySelector('.ani-region-fold-control'),'Default page provides fold controls');
panel.querySelector('[data-method-choice="radial"]').click();assert.equal(panel.querySelector('[data-setting="method"]').value,'radial');
w.document.querySelector('.ani-focus-toggle').click();assert.equal(w.document.body.classList.contains('ani-focus-mode'),true);
w.document.querySelector('.ani-focus-toggle').click();assert.equal(w.document.body.classList.contains('ani-focus-mode'),false);
w.document.querySelector('.ani-danmu-toggle').click();assert.equal(w.document.body.classList.contains('ani-hide-danmu'),true);
w.document.querySelector('.ani-danmu-toggle').click();assert.equal(w.document.body.classList.contains('ani-hide-danmu'),false);
const custom=panel.querySelector('[data-setting="customFontName"]');custom.value='Noto Sans TC';custom.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(custom.value,'Noto Sans TC');
assert.equal(panel.querySelector('[data-setting="hideDuringAds"]'),null);
change('quickCollapse',false);
change('episodesLayout',true);change('episodeStyle','collapse');
const shelf=w.document.querySelector('.ani-episode-shelf'),episodeButton=shelf.querySelector('.ani-region-toggle'),season=shelf.querySelector('.season');
assert.equal(season.hidden,true);assert.equal(episodeButton.getAttribute('aria-expanded'),'false');
episodeButton.click();assert.equal(season.hidden,false);assert.equal(episodeButton.getAttribute('aria-expanded'),'true');
change('episodeStyle','wrap');assert.equal(shelf.querySelector('.ani-region-toggle'),null);assert.equal(season.hidden,false);
for(const [flag,selector] of [['foldInfo','section.data'],['foldRelated','.old_list'],['foldNews','.theme-extend-block']]){
  change(flag,true);const target=w.document.querySelector(selector),button=w.document.querySelector('[aria-controls="'+target.id+'"]');
  assert.ok(button,`${flag} must provide a control`);
  if (flag === 'foldNews') {
    assert.equal(button.nextElementSibling, target);
    assert.ok(button.querySelector('.ani-section-icon svg'));
  }
  button.click();assert.equal(target.hidden,true);assert.equal(button.getAttribute('aria-expanded'),'false');
  change(flag,false);assert.equal(target.hidden,false);assert.equal(button.isConnected,false);
}
for(const key of ['showInfo','showRelated','showNews','showComments'])change(key,false);
assert.ok(w.document.body.classList.contains('ani-hide-comments'));
await new Promise(resolve=>setTimeout(resolve,25));assert.ok(mutations<50);
assert.equal(panel.querySelectorAll('[data-category]').length,10);
panel.querySelector('[data-category-shortcut="credit"]').click();
assert.equal(panel.querySelector('[data-settings-page="credit"]').hidden,false);
assert.ok(panel.querySelector('[data-action="check-update"]'));
panel.querySelector('[data-category-shortcut="light"]').click();
assert.equal(panel.querySelector('[data-settings-page="light"]').hidden,false);
assert.equal(panel.querySelector('[data-category-shortcut="light"]').getAttribute('aria-current'),'page');
panel.querySelector('[data-category-shortcut="themes"]').click();
assert.equal(panel.querySelector('[data-settings-page="themes"]').hidden,false);
assert.equal(panel.querySelector('[data-category-shortcut="light"]').hasAttribute('aria-current'),false);
change('method','band');assert.equal(panel.querySelector('[data-setting="bandWidth"]').closest('.ani-setting-row').hidden,false);
assert.equal(panel.querySelector('[data-setting="projectionDepth"]').closest('.ani-setting-row').hidden,true);
const performancePreset=panel.querySelector('[data-performance-preset]');performancePreset.value='smooth';performancePreset.dispatchEvent(new w.Event('input',{bubbles:true}));
assert.equal(panel.querySelector('[data-setting="renderWidth"]').value,'960');assert.equal(panel.querySelector('[data-setting="fps"]').value,'0');assert.equal(panel.querySelector('[data-setting="smoothing"]').value,'0');
assert.equal(panel.querySelectorAll('[data-setting-row-boolean], .ani-setting-row:has(input[type="checkbox"]) [data-reset-setting]').length,0);
for(const row of panel.querySelectorAll('.ani-setting-row')){
  if(row.querySelector('input[type="checkbox"]')) assert.equal(row.querySelector('.ani-setting-reset'),null);
  else assert.ok(row.querySelector('.ani-setting-reset'));
}
assert.equal(panel.querySelectorAll('[data-settings-overview] .ani-setting-reset').length,0);
for(const input of panel.querySelectorAll('[data-settings-overview] [data-setting]')) {
  assert.equal(input.getAttribute('aria-label'),input.closest('label').querySelector('span').textContent);
}
assert.deepEqual([...panel.querySelectorAll('.ani-method-group')].map(group=>group.querySelectorAll('[data-method-choice]').length),[4,2,2]);
assert.equal(dom.window.AniAmbientSettings.defaults.settingsOpacity,70);
assert.equal(dom.window.AniAmbientSettings.normalize({method:'swirl',swirlAmount:65}).swirlAmount,65);
const originalBase=w.document.body.style.getPropertyValue('--ani-base');
const hexField=panel.querySelector('[data-setting="customBase"]');
hexField.value='#abc';hexField.dispatchEvent(new w.Event('change',{bubbles:true}));
assert.equal(hexField.value,'#aabbcc');
change('customPalette',true);
assert.equal(w.document.body.style.getPropertyValue('--ani-base'),'#aabbcc');
assert.equal(w.AniAmbientSettings.normalize({customBase:'url(bad)'}).customBase,'#0f1621');
change('customPalette',false);
assert.equal(w.document.body.style.getPropertyValue('--ani-base'),originalBase);
assert.equal(w.document.body.classList.contains('ani-footer-glow'),true);
change('footerGlow',false);assert.equal(w.document.body.classList.contains('ani-footer-glow'),false);
change('footerGlow',true);
for(const button of panel.querySelectorAll('[data-method-choice]')){
  button.click();assert.equal(panel.querySelector('[data-setting="method"]').value,button.dataset.methodChoice);
  assert.equal(panel.querySelectorAll('[data-method-choice][aria-pressed="true"]').length,1);
}
// 舊版與較新備份都保留已知欄位，新增欄位補預設；未知欄位不套用。
const importInput=panel.querySelector('[data-import-file]');
for(const backup of [{version:1,settings:{intensity:75}}, {format:'anigamer-ambilight',version:2,scriptVersion:'2.0.0',settings:{intensity:80,futureSetting:999}}]) {
  Object.defineProperty(importInput,'files',{configurable:true,value:[{size:100,text:async()=>JSON.stringify(backup)}]});
  importInput.dispatchEvent(new w.Event('change'));
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(panel.querySelector('[data-setting="intensity"]').value,String(backup.settings.intensity));
  assert.equal(panel.querySelector('[data-setting="swirlAmount"]').value,'35');
  assert.match(panel.querySelector('.ani-settings-status').textContent,/已匯入/);
}
const ratingLauncher = w.document.createElement('div');
ratingLauncher.className = 'top_btn_rating_setting';
ratingLauncher.innerHTML = '<a href="#">評分設定</a>';
let ratingSaves = 0;
let ratingExports = 0;
ratingLauncher.addEventListener('click', event => {
  event.preventDefault();
  const overlay = w.document.createElement('div');
  overlay.id = 'ani-rating-overlay';
  overlay.style.cssText = 'position:fixed!important;background:#000!important;';
  overlay.innerHTML = `<div id="ani-rating-modal" style="width:420px!important;display:block!important">
    <header class="arm-header"><h2 class="arm-title">評分顯示設定</h2></header>
    <div class="arm-body">
      <div class="arm-section"><div class="arm-section-header">核心功能</div>
        <div class="arm-list-item"><span class="arm-list-title">評分徽章</span><div class="arm-toggle-pill on" id="arm-toggle"></div></div>
        <div class="arm-list-item"><span class="arm-list-title">防雷遮罩</span><div class="arm-toggle-pill" id="arm-mask-toggle"></div></div>
        <input id="arm-threshold" type="number" min="0" max="5" step="0.1" value="3.5">
        <div style="background:#000!important">💡 <strong>功能提示：</strong>快捷功能如下：<br>排序；遮罩；屏蔽。<br>自動排序會立即更新。</div></div>
      <div class="arm-section"><div class="arm-section-header">徽章外觀樣式</div><input id="arm-fs" type="number" min="8" max="24" value="14"></div>
      <div class="arm-section"><div class="arm-section-header">系統效能與快取</div>
        <div><button id="arm-export-history">匯出觀看紀錄</button></div>
        <div><button id="arm-restart-tour">開啟導覽</button></div>
        <div><button id="arm-reset">復原預設</button><p>警告</p></div>
      </div>
    </div>
    <footer class="arm-footer"><button id="arm-cancel">取消</button><button id="arm-save">儲存設定</button></footer>
  </div>`;
  overlay.querySelector('#arm-save').addEventListener('click', () => { ratingSaves++; overlay.remove(); });
  overlay.querySelector('#arm-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#arm-export-history').addEventListener('click', () => ratingExports++);
  w.document.body.append(overlay);
});
w.document.querySelector('.top_sky .sky').append(ratingLauncher);
await Promise.resolve();
assert.equal(w.document.documentElement.dataset.aniRatingIntegrated, 'true');
const ratingPage = panel.querySelector('[data-settings-page="rating"]');
const about = panel.querySelector('[data-settings-page="credit"]');
const ratingShortcut = panel.querySelector('[data-category-shortcut="rating"]');
const openRating = () => {
  const home = panel.querySelector('[data-settings-home]');
  (home.hidden ? ratingShortcut : home.querySelector('[data-category="rating"]')).click();
};
if (panel.hidden) w.document.querySelector('.ani-view-settings').click();
openRating();
assert.equal(ratingPage.hidden, false);
assert.equal(panel.querySelector('[data-category-title]').textContent, '評分顯示設定');
assert.equal(panel.querySelector('[data-reset-category]').hidden, true);
const embedded = ratingPage.querySelector('#ani-rating-overlay');
fixtures.insertAdjacentHTML('beforeend', '<div class="animate-theme-list"><div class="theme-list-block"><a class="theme-list-main" href="animeRef.php?sn=99744" data-rating-score="3.2"><div class="theme-img-block"><img></div></a></div></div>');
const ratedCard = fixtures.querySelector('[data-rating-score="3.2"]');
assert.equal(embedded.dataset.aniStarmapEmbedded, 'true');
assert.equal(embedded.querySelector('#ani-rating-modal').hasAttribute('aria-modal'), false);
assert.equal(embedded.hasAttribute('style'), false, 'the external backdrop cannot cover settings');
assert.equal(embedded.querySelector('#ani-rating-modal').hasAttribute('style'), false);
assert.equal(about.querySelector('[data-category="rating"]'), null);
assert.equal(ratingShortcut.getAttribute('aria-current'), 'page');
assert.equal(ratingShortcut.previousElementSibling.dataset.categoryShortcut, 'content');
assert.equal(panel.querySelector('[data-settings-back]').getAttribute('aria-label'), '返回設定分類');
const ratingTabs = [...embedded.querySelectorAll('.ani-rating-tabs [role="tab"]')];
assert.deepEqual(ratingTabs.map(button => button.textContent), ['顯示與篩選', '徽章外觀', '效能與快取', '資料與維護']);
assert(ratingTabs.every(button => button.querySelector('svg')));
assert.equal(embedded.querySelector('.ani-starmap-tip'), null);
embedded.querySelector('#arm-mask-toggle').click();
assert.equal(w.localStorage.getItem('aniRating_maskEnabled'), 'true');
assert.equal(embedded.querySelector('#arm-mask-toggle').getAttribute('aria-checked'), 'true');
assert.equal(embedded.querySelector('.ani-rating-save-status').textContent, '已套用。');
await new Promise(resolve => w.requestAnimationFrame(resolve));
assert.equal(w.document.body.classList.contains('ani-disable-masking'), false);
assert(ratedCard.querySelector('img').classList.contains('ani-low-rating-masked'));
const threshold = embedded.querySelector('#arm-threshold');
threshold.value = '3';
threshold.dispatchEvent(new w.Event('input', {bubbles: true}));
await new Promise(resolve => w.requestAnimationFrame(resolve));
assert.equal(ratedCard.querySelector('img').classList.contains('ani-low-rating-masked'), false);
embedded.querySelector('#arm-toggle').click();
assert(w.document.body.classList.contains('ani-starmap-rating-off'));
embedded.querySelector('#arm-toggle').click();
assert.equal(w.document.body.classList.contains('ani-starmap-rating-off'), false);
ratingTabs[1].click();
const fontSize = embedded.querySelector('#arm-fs');
assert.equal(fontSize.closest('[role="tabpanel"]').hidden, false);
const liveRating = {};
w.__aniConfig = { setBatch: values => Object.assign(liveRating, values), get: key => liveRating[key] };
fontSize.value = '18';
fontSize.dispatchEvent(new w.Event('input', {bubbles: true}));
assert.equal(liveRating.fontSize, 18);
assert.equal(w.document.body.style.getPropertyValue('--ani-starmap-badge-size'), '18px');
fontSize.value = '1';
fontSize.dispatchEvent(new w.Event('change', {bubbles: true}));
assert.equal(fontSize.value, '18');
ratingTabs[1].dispatchEvent(new w.KeyboardEvent('keydown', {key: 'End', bubbles: true}));
assert.equal(ratingTabs[3].getAttribute('aria-selected'), 'true');
assert.equal(embedded.querySelector('#arm-fs').closest('[role="tabpanel"]').hidden, true);
assert.equal(embedded.querySelector('#arm-export-history').closest('[role="tabpanel"]').hidden, false);
assert.equal(embedded.querySelectorAll('.ani-rating-maintenance .arm-list-item').length, 3);
embedded.querySelector('#arm-export-history').click();
assert.equal(ratingExports, 1);
assert.equal(embedded.querySelector('#arm-save, #arm-cancel'), null);
assert.equal(ratingSaves, 0);
assert.equal(ratingPage.hidden, false);
panel.querySelector('[data-settings-back]').click();
assert.equal(ratingPage.hidden, true);
assert.equal(panel.querySelector('[data-settings-home]').hidden, false);
openRating();
w.document.querySelector('.ani-view-settings').click();
assert.equal(w.document.getElementById('ani-rating-overlay'), null);
w.document.querySelector('.ani-view-settings').click();
openRating();
assert.equal(ratingPage.querySelector('#arm-mask-toggle').getAttribute('aria-checked'), 'true', 'storage fallback survives reopening');
nativeDanmuCount.innerHTML = '<div><i class="material-icons">info_outline</i><div>本動畫共 433 筆彈幕<br>動畫瘋·Plus已過濾 3 筆彈幕</div></div>';
await new Promise(resolve => setTimeout(resolve, 0));
assert(nativeDanmuCount.classList.contains('ani-plus-danmu-count'));
assert.match(nativeDanmuCount.textContent, /Plus已過濾 3 筆彈幕/);
assert.equal(w.document.body.dataset.aniBackground,'silk','extension/page reload retains this tab random background');
{
  const aniVideo = w.document.querySelector('#ani_video');
  const vjsDanmu = w.document.createElement('div');
  vjsDanmu.className = 'vjs-danmu';
  const warp = w.document.createElement('div');
  warp.className = 'danmu-warp';
  Object.defineProperty(warp, 'clientWidth', { value: 1000, configurable: true });
  Object.defineProperty(warp, 'clientHeight', { value: 112, configurable: true });
  warp.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1000, bottom: 112, width: 1000, height: 112 });
  vjsDanmu.append(warp);
  aniVideo.append(vjsDanmu);
  await new Promise(resolve => setTimeout(resolve, 0));

  const makeCmt = (mode, width) => {
    const el = w.document.createElement('div');
    el.className = `danmu danmu-mode-${mode}`;
    Object.defineProperty(el, 'offsetWidth', { value: width, configurable: true });
    Object.defineProperty(el, 'offsetHeight', { value: 24, configurable: true });
    el.getBoundingClientRect = () => {
      const top = Number.parseFloat(el.style.top || '6');
      return { left: 1000, top, right: 1000 + width, bottom: top + 24, width, height: 24 };
    };
    return el;
  };

  const topCmt = makeCmt('top', 200);
  const r1 = makeCmt('rolling', 120);
  const r2 = makeCmt('rolling', 360);
  const r3 = makeCmt('rolling', 180);
  const r4 = makeCmt('rolling', 150);
  warp.append(topCmt, r1, r2, r3, r4);
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(topCmt.style.top, '6px');
  assert.equal(r1.style.top, '34px');
  assert.equal(r2.style.top, '62px');
  assert.equal(r3.dataset.aniDanmuHidden, '1');
  assert.equal(r4.dataset.aniDanmuHidden, '1');
  const speed1 = (1000 + 120 * 1.1) / (Number.parseFloat(r1.style.animationDuration) / 1000);
  const speed2 = (1000 + 360 * 1.1) / (Number.parseFloat(r2.style.animationDuration) / 1000);
  assert(Math.abs(speed1 - speed2) < 0.5, 'rolling danmu use equalized pixel velocity');

  change('danmuAntiOverlap', false);
  assert.equal(r3.dataset.aniDanmuHidden, undefined);
  assert.equal(r4.dataset.aniDanmuHidden, undefined);
  change('danmuAntiOverlap', true);
}
dom.window.close();console.log('Passed: native geometry, bounded observer, reversible layouts, themes, per-setting reset, eight grouped methods, old and newer backup import, embedded rating settings.');
