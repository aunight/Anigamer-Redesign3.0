import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
function boot(html,path){const dom=new JSDOM(html,{url:'https://ani.gamer.com.tw'+path,runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;w.matchMedia=()=>({matches:false,addEventListener(){}});w.fetch=async()=>({ok:true,text:async()=>'<div class="theme-list-block"><a class="theme-list-main" href="animeRef.php?sn=2"></a></div>'});for(const file of ['page-entry.js','settings.js','content.js'])w.eval(fs.readFileSync('src/'+file,'utf8'));return dom;}
const card=(id,year,progress)=>`<a class="theme-list-main" href="animeRef.php?sn=${id}"><div class="theme-img-block"><img class="theme-img"><span class="ani-watch-progress-badge">看到第 ${progress} 話</span></div><div class="anime-detail-block"><div class="theme-info-block"><p class="theme-name">作品${id}</p><div class="theme-detail-info-block"><p class="theme-time">${year} 春番</p><span class="theme-number">${progress} / 12 集</span></div></div></div></a>`;
test('movie filter labels untitled movies and keeps the paid lock', t => {
  const movie = card(1, 2026, 0).replace('0 / 12 集', '0 / 1 集')
    .replace('<div class="anime-detail-block">', '<div class="anime-detail-block"><span class="label-edition">付費會員</span>');
  const dom = boot(`<div id="BH_background"><div class="animate-theme-list"><div class="theme-list-block">${movie}</div></div></div>`, '/animeList.php?category=' + encodeURIComponent('電影'));
  t.after(() => dom.window.close());
  const episode = dom.window.document.querySelector('.theme-number');
  assert.equal(episode.textContent, '電影');
  assert(episode.firstElementChild?.matches('.ani-member-lock'));
});

test('related movies show a check only when completed while specials retain episode progress', async t => {
  const movie = card(1, 2026, 0).replace('作品1', '作品劇場版').replace(' / 12 集', ' / 1 集');
  const tagged = card(2, 2026, 0).replace(' / 12 集', ' / 1 集')
    .replace('<div class="anime-detail-block">', '<div class="anime-detail-block"><span class="label-edition">電影</span>');
  const special = card(3, 2026, 0).replace(' / 12 集', ' / 1 集');
  const untaggedMovies = ['113603', '113435', '101403'].map(id => card(id, 2023, 0).replace(' / 12 集', ' / 1 集')).join('');
  const dom = boot(`<div id="BH_background"><section class="old_list"><div class="theme-list-block">${movie}${tagged}${special}${untaggedMovies}</div></section></div>`, '/animeVideo.php?sn=101');
  t.after(() => dom.window.close());
  const labels = [...dom.window.document.querySelectorAll('.old_list .theme-number')].map(node => node.textContent);
  assert.deepEqual(labels, ['電影', '電影', '0 / 1 集', '電影', '電影', '電影']);
  const w = dom.window;
  const [watched, unfinished] = w.document.querySelectorAll('.old_list .theme-number');
  w.localStorage.setItem('aniPermanentHistoryV1', JSON.stringify({
    1: {title: '作品劇場版', completed: true},
    2: {title: '作品2', elapsedSec: 40, durationSec: 3600},
  }));
  w.eval(fs.readFileSync('src/enhancements.js', 'utf8'));
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(watched.querySelectorAll('svg').length, 1);
  assert.equal(watched.title, '已看過');
  assert.equal(unfinished.querySelector('svg'), null);
});
test('studio view restores its tab and scroll positions and prepares nearby rows separately', t => {
  const dom = new JSDOM('<main><section><div class="filter-title-block"></div></section></main>', {
    url: 'https://ani.gamer.com.tw/animeList.php', runScripts: 'outside-only',
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  let intersect;
  const idle = [];
  const scrolls = [];
  w.ResizeObserver = class { observe() {} disconnect() {} };
  w.IntersectionObserver = class {
    constructor(callback) { intersect = callback; }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  w.requestIdleCallback = callback => idle.push(callback);
  w.matchMedia = () => ({matches: true});
  w.scrollTo = options => scrolls.push(options);
  w.STUDIO_CATALOG_DATA = [
    [1, 1, '作品 1', '2025', '100', '12 集', '', [], ['ufotable']],
    [2, 2, '作品 2', '2026', '200', '12 集', '', [], ['MAPPA']],
    [3, 3, '作品 3', '2026', '50', '12 集', '', [], ['Other Studio']],
    [4, 4, '作品 4', '2026', '40', '12 集', '', [], Array.from({length: 13}, (_, index) => `Test Studio ${index}`)],
    [5, 5, '作品 5', '2026', '60', '12 集', '', [], ['Wonderland', 'Fanworks']],
  ];
  w.STUDIO_PROFILE_DATA = {};
  w.STUDIO_LOGO_DATA = {};
  w.STUDIO_DIRECTORY_ICON_DATA = {};
  w.history.replaceState({native: true, aniStudioView: {active: true, top: 640, rails: {ufotable: 125}}}, '');
  w.eval(fs.readFileSync('src/studio-catalog.js', 'utf8'));
  const d = w.document;
  w.mountStudioCatalog(d.querySelector('section'), () => {}, () => {});
  const studioTab = [...d.querySelectorAll('.ani-studio-shell button')].find(button => button.textContent === '製作組動畫');
  assert.equal(studioTab.getAttribute('aria-pressed'), 'true');
  assert.equal(scrolls.at(-1).top, 640);
  const slots = [...d.querySelectorAll('.ani-studio-slot')];
  intersect(slots.map(target => ({target, isIntersecting: true})));
  assert.equal(idle.length, 1);
  idle.shift()();
  assert.equal(slots[0].querySelector('.theme-list-block').scrollLeft, 125);
  assert.equal(slots[1].querySelector('.theme-list-block'), null);
  idle.shift()();
  assert(slots[1].querySelector('.theme-list-block'));
  w.scrollY = 720;
  w.dispatchEvent(new w.Event('pagehide'));
  assert.equal(w.history.state.aniStudioView.top, 720);
  assert.equal(w.history.state.native, true);
  const directory = d.querySelector('.ani-studio-directory');
  const featuredWorks = d.querySelector('.ani-studio-featured-works');
  const other = [...directory.querySelectorAll('.ani-studio-chip')].find(button => button.lastElementChild?.textContent === 'Other Studio');
  assert(other, directory.textContent);
  const all = directory.querySelector('.ani-studio-chip');
  const search = directory.querySelector('input');
  other.click();
  const row = directory.querySelector('.ani-studio-row');
  assert.equal(other.getAttribute('aria-pressed'), 'true');
  assert.equal(featuredWorks.hidden, true);
  other.click();
  assert.equal(all.getAttribute('aria-pressed'), 'true');
  assert.equal(featuredWorks.hidden, false);
  search.value = 'Other Studio';
  search.dispatchEvent(new w.Event('input'));
  other.click();
  assert.equal(directory.querySelector('.ani-studio-row'), row);
  search.value = '';
  search.dispatchEvent(new w.Event('input'));
  search.dispatchEvent(new w.Event('search'));
  assert.equal(all.getAttribute('aria-pressed'), 'true');
  assert.equal(featuredWorks.hidden, false);
  assert.equal(directory.querySelector('.ani-studio-row'), null);
  const more = directory.querySelector('.ani-studio-show-more');
  assert.equal(more.hidden, false);
  search.value = 'Studio';
  search.dispatchEvent(new w.Event('input'));
  assert.equal(directory.querySelectorAll('.ani-studio-chip').length, 15);
  assert.equal(more.hidden, true);
  search.value = 'w';
  search.dispatchEvent(new w.Event('input'));
  const matchingNames = [...directory.querySelectorAll('.ani-studio-chip')].slice(1)
    .map(button => button.lastElementChild.textContent);
  assert.deepEqual(matchingNames, ['Wonderland', 'Fanworks']);
});
test('collection shares the catalog panel and combines official classifications with collection filters', async t => {
  const dom = boot(`<div id="BH_background"><div class="container"><div class="animate-theme-list"><div class="theme-list-block">${card(1,2026,12)}${card(2,2025,3)}${card(3,2026,0)}</div></div></div></div>`, '/mygather.php');
  t.after(() => dom.window.close());
  const w = dom.window, d = w.document;
  w.eval(fs.readFileSync('src/enhancements.js', 'utf8'));
  const requests = [];
  w.fetch = async input => {
    requests.push(new URL(input, w.location.href).searchParams);
    return {ok:true,text:async()=>'<div class="theme-list-block"><a class="theme-list-main" href="animeRef.php?sn=2"></a></div>'};
  };
  const cards = [...d.querySelectorAll('.theme-list-main')];
  let clicks = 0;
  cards[0].addEventListener('click', e => { e.preventDefault(); clicks++; });
  const group = name => d.querySelector(`[role="group"][aria-label="${name}"]`);
  const click = (name, text) => [...group(name).querySelectorAll('button')].find(b => (b.querySelector('span') || b).textContent === text).click();
  const hidden = () => cards.map(c => c.hidden || c.classList.contains('ani-col-status-hidden'));
  await new Promise(resolve => setTimeout(resolve, 40));
  click('收藏狀態', '已看完');
  assert.deepEqual(hidden(), [false,true,true]);
  const year = d.querySelector('[aria-label="播出年份"]');
  const selectYear = value => { year.value = value; year.dispatchEvent(new w.Event('change')); };
  selectYear('2025');
  assert(hidden().every(Boolean));
  selectYear('');
  click('播出季度', '冬番');
  assert(hidden().every(Boolean));
  click('播出季度', '春番');
  assert.deepEqual(hidden(), [false,true,true]);
  click('收藏狀態', '全部');
  const toggle = d.querySelector('.ani-filter-toggle');
  const body = d.getElementById(toggle.getAttribute('aria-controls'));
  assert(body.contains(group('對象')));
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  click('屬性', '校園');
  click('屬性', '戀愛');
  const classifications = group('作品分類');
  assert.deepEqual([...classifications.querySelectorAll('button')].map(button => button.textContent.trim()),
    ['全部', '漫畫改編', '輕小說改編', '遊戲改編', '原創動畫', '電影', 'OVA', '雙語', '泡麵番', '輕動畫', '真人演出']);
  click('作品分類', '電影');
  click('對象', '闔家觀賞');
  await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(requests.length, 1);
  assert.deepEqual(new Set(requests[0].get('tags').split(',')), new Set(['校園','戀愛']));
  assert.equal(requests[0].get('category'), '電影');
  assert.equal(requests[0].get('target'), '闔家觀賞');
  assert.deepEqual(hidden(), [true,false,true]);
  click('作品分類', '漫畫改編');
  assert.deepEqual([...classifications.querySelectorAll('button[aria-pressed="true"]')].map(button => button.textContent.trim()), ['漫畫改編']);
  click('屬性', '全部');
  click('作品分類', '全部');
  click('對象', '全部');
  assert(cards.every(c => !c.hidden));
  const search = d.querySelector('input[type="search"]');
  search.value = '作品2';
  search.dispatchEvent(new w.Event('input'));
  assert.deepEqual(hidden(), [true,false,true]);
  search.value = '';
  search.dispatchEvent(new w.Event('input'));
  cards[0].click();
  assert.equal(clicks,1);
});
test('catalog and collection keep bilingual and age labels and show the member lock inside the episode pill', t => {
  const marked = card(1, 2026, 12).replace('<div class="anime-detail-block">', `<div class="anime-detail-block">
    <div class="anime-tag-row"><div class="anime-label-block">
      <span class="label-edition">雙語</span><span class="label-edition">年齡限制</span><span class="label-edition">付費會員</span>
    </div></div>`);
  for (const path of ['/animeList.php', '/mygather.php']) {
    const dom = boot(`<div id="BH_background"><div class="animate-theme-list"><div class="theme-list-block">${marked}</div></div></div>`, path);
    t.after(() => dom.window.close());
    const image = dom.window.document.querySelector('.theme-img-block');
    assert.deepEqual([...image.querySelectorAll(':scope > .ani-poster-episode-labels > .label-edition')]
      .map(label => label.textContent.trim()), ['雙語', '18+']);
    const episodes = image.querySelector(':scope > .theme-number.ani-member-episodes');
    assert(episodes.firstElementChild.matches('.ani-member-lock[title="付費會員限定"]'));
    assert(image.querySelector('.ani-age-restricted[title="年齡限制"]'));
    assert.match(episodes.getAttribute('aria-label'), /^付費會員限定，/);
  }
});
test('weekly expansion exposes remaining native tiles and closes reversibly',()=>{const tiles=Array.from({length:6},(_,i)=>`<a class="text-anime-info" href="animeVideo.php?sn=${i}"><span class="text-anime-name">作品${i}</span></a>`).join('');const dom=boot(`<div id="BH_background"><section id="blockVideoInSeason"><div class="textpage-switch-page nav-choose-segment"></div><div class="programlist-wrap_block"><div class="programlist-block"><div class="day-list today-list"><h3 class="day-title">週二</h3>${tiles}</div></div></div></section></div>`,'/');const d=dom.window.document;assert.equal(d.querySelectorAll('.ani-week-extra').length,1);const button=d.querySelector('.ani-week-expand');button.click();assert(d.querySelector('#blockVideoInSeason').classList.contains('ani-week-expanded'));assert.equal(button.getAttribute('aria-expanded'),'true');button.click();assert.equal(button.getAttribute('aria-expanded'),'false');assert(d.documentElement.dataset.aniUiReady);dom.window.close();});

test('weekly disclosure reverses and animates the panel again after closing',async()=>{
 const tiles=Array.from({length:7},(_,i)=>`<a class="text-anime-info"><span class="text-anime-name">作品${i}</span></a>`).join('');
 const dom=boot(`<div id="BH_background"><section id="blockVideoInSeason"><div class="programlist-wrap_block"><div class="programlist-block"><div class="day-list"><h3>週一</h3>${tiles}</div></div></div></section></div>`,'/');
 const d=dom.window.document;
 const viewport=d.querySelector('.ani-season-viewport');
 const motions=[];
 let collapsedHeight=100;
 viewport.getBoundingClientRect=()=>({height:d.querySelector('#blockVideoInSeason').classList.contains('ani-week-expanded')?240:collapsedHeight});
 viewport.firstElementChild.getBoundingClientRect=()=>({height:240});
 const fades=[];
 const record = list => (frames, timing) => {
   const motion={frames,timing,reversals:0,reverse(){this.reversals++;},cancel(){}};
   list.push(motion);
   return motion;
 };
 viewport.animate=record(motions);
 for(const tile of viewport.querySelectorAll('.ani-week-extra-shell')) tile.animate=record(fades);
 const button=d.querySelector('.ani-week-expand');
 button.click();
 button.click();
 assert.equal(motions.length,1);
 assert.equal(motions[0].reversals,1);
 assert(fades.length===2 && fades.every(fade=>fade.reversals===1));
 motions[0].onfinish();
 assert(!d.querySelector('#blockVideoInSeason').classList.contains('ani-week-expanded'));
 button.click();
 assert.deepEqual(Array.from(motions[1].frames, frame => frame.height), ['100px', '240px', '240px']);
 motions[1].onfinish();
 assert.equal(button.getAttribute('aria-expanded'),'true');
 collapsedHeight=130;
 button.click();
 assert.deepEqual(Array.from(motions[2].frames, frame => frame.height), ['130px', '240px', '240px']);
 assert.equal(motions[2].timing.direction,'reverse');
 motions[2].onfinish();
 assert.equal(button.getAttribute('aria-expanded'),'false');
 dom.window.close();
});

test('homepage cover glow samples artwork rather than the clock icon',()=>{
 const dom=boot('<div id="BH_background"><section id="blockVideoInSeason"><a class="anime-card-block"><div class="anime-pic-block"><img class="anime-clock-img" src="https://i2.bahamut.com.tw/anime/pic_time_icon.svg"><div class="anime-blocker"><img src="https://p2.bahamut.com.tw/B/2KU/cover.JPG"></div></div><div class="anime-detail-block"></div></a></section></div>','/');
 assert.equal(dom.window.document.querySelector('.anime-card-block').style.getPropertyValue('--ani-card-cover'),'url("https://p2.bahamut.com.tw/B/2KU/cover.JPG")');dom.window.close();
});

test('collection loads the next page in place and reapplies active filters',async t=>{
 const dom=new JSDOM(`<div id="BH_background"><div class="container"><div class="animate-theme-list"><div class="theme-list-block">${card(1,2026,12)}</div></div><div class="page_control"><div class="page_number"><span class="now">1</span><a href="mygather.php?page=2">2</a></div></div></div></div>`,{url:'https://ani.gamer.com.tw/mygather.php',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.matchMedia=()=>({matches:false,addEventListener(){}});w.IntersectionObserver=class{observe(){}};w.AbortSignal.timeout=()=>undefined;
 t.after(() => dom.window.close());
 w.fetch=async(url)=>({ok:true,text:async()=>String(url).includes('page=2')?`<div class="theme-list-block">${card(2,2025,3)}</div>`:'<li class="type"><ul class="tag-list"><li class="tag">校園</li></ul></li>'});
 for(const f of ['settings.js','content.js','enhancements.js'])w.eval(fs.readFileSync('src/'+f,'utf8'));
 await new Promise(r=>setTimeout(r,40));
 const d=w.document;d.querySelector('[data-filter-status="completed"]').click();d.querySelector('.ani-load-more').click();await new Promise(r=>setTimeout(r,1800));
 assert.equal(d.querySelectorAll('.theme-list-main').length,2);assert(d.querySelector('a[href="animeRef.php?sn=2"]').classList.contains('ani-col-status-hidden'));assert(d.querySelector('.page_control').hidden);assert(d.querySelector('.ani-load-more').hidden);
});

test('collection origin filter searches later pages and combines with the current broadcast season', async t => {
  const current = new Intl.DateTimeFormat('en', {
    year: 'numeric', month: 'numeric', timeZone: 'Asia/Taipei',
  }).formatToParts(new Date());
  const year = Number(current.find(part => part.type === 'year').value);
  const month = Number(current.find(part => part.type === 'month').value);
  const season = ['冬番', '春番', '夏番', '秋番'][Math.floor((month - 1) / 3)];
  const currentCard = card(3, year, 0).replace(' 春番', ` ${season}`);
  const pages = (next) => `<div class="page_control"><div class="page_number"><a href="?page=${next}">下一頁</a></div></div>`;
  const dom = new JSDOM(`<div id="BH_background"><div class="animate-theme-list">
    <div class="theme-list-block">${card(1, year - 1, 12)}</div>
  </div>${pages(2)}</div>`, {
    url: 'https://ani.gamer.com.tw/mygather.php', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  const d = w.document;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.IntersectionObserver = class { observe() {} };
  const fetched = [];
  w.fetch = async input => {
    const page = new URL(input, w.location.href).searchParams.get('page');
    if (page) fetched.push(page);
    const response = page === '2' ? `<div class="theme-list-block">${card(2, year, 3)}</div>${pages(3)}`
      : page === '3' ? `<div class="theme-list-block">${currentCard}</div>`
      : new URL(input, w.location.href).searchParams.get('sn') === '3'
      ? '<a href="//acg.gamer.com.tw/acgDetail.php?s=33">作品資料</a>'
      : new URL(input, w.location.href).searchParams.get('sn') === '2'
      ? '<a href="//acg.gamer.com.tw/acgDetail.php?s=22">作品資料</a>' : '';
    return { ok: true, text: async () => response };
  };
  w.chrome = {
    runtime: {
      sendMessage(message, reply) {
        if (message.type !== 'ani-fetch-work-meta') return reply({});
        if (message.acgIds) {
          if (message.acgIds['作品2'] === '22') {
            return reply({ ok: true, items: { 作品2: { source: 'game', isShort: false } }, failed: [] });
          }
          assert.equal(message.acgIds['作品3'], '33');
          return reply({ ok: true, items: { 作品3: { source: 'manga', isShort: true } }, failed: [] });
        }
        reply({ ok: true, items: Object.fromEntries(message.titles.filter(title => title !== '作品3').map(title =>
          [title, { source: title === '作品2' ? 'original' : 'manga', isShort: false }])) });
      },
    },
  };
  for (const file of ['settings.js', 'content.js', 'enhancements.js']) w.eval(fs.readFileSync(`src/${file}`, 'utf8'));
  await new Promise(resolve => setTimeout(resolve, 40));
  d.querySelector('[data-origin="manga"]').click();
  await new Promise(resolve => setTimeout(resolve, 1500));
  assert.deepEqual(fetched, ['2', '3']);
  const pager = d.querySelector('.page_control');
  assert.equal(pager.hidden, true);
  assert.equal(pager.dataset.aniInfinite, 'true');
  const visible = () => [...d.querySelectorAll('.theme-list-main:not([hidden]):not(.ani-origin-hidden)')]
    .map(node => node.getAttribute('href'));
  assert.deepEqual(visible(), ['animeRef.php?sn=1', 'animeRef.php?sn=3']);
  const seasonGroup = d.querySelector('[aria-label="播出季度"]');
  assert.equal(seasonGroup.children[1].textContent, `${year} ${season}`);
  seasonGroup.querySelector('[value="current"]').click();
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.deepEqual(visible(), ['animeRef.php?sn=3']);
  assert.match(d.querySelector('.ani-collection-count').textContent, /顯示 1 \/ 3 部/);
  const nextQuarter = new Date(Date.UTC(year, Math.floor((month - 1) / 3) * 3 + 3, 1));
  const NativeDate = w.Date;
  w.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [nextQuarter.getTime()])); }
  };
  d.dispatchEvent(new w.Event('visibilitychange'));
  assert.equal(seasonGroup.children[1].textContent, `${nextQuarter.getUTCFullYear()} ${['冬番', '春番', '夏番', '秋番'][nextQuarter.getUTCMonth() / 3]}`);
  assert.deepEqual(visible(), [], 'an active current-season filter follows the new quarter');
  seasonGroup.querySelector('[value=""]').click();
  d.querySelector('[data-origin="game"]').click();
  await new Promise(resolve => setTimeout(resolve, 1300));
  assert.deepEqual(visible(), ['animeRef.php?sn=2'], 'official origin restores a game adaptation missed by title lookup');
});
