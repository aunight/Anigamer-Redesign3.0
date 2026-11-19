import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
function boot(html,path){const dom=new JSDOM(html,{url:'https://ani.gamer.com.tw'+path,runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;w.matchMedia=()=>({matches:false,addEventListener(){}});w.fetch=async()=>({ok:true,text:async()=>'<div class="theme-list-block"><a class="theme-list-main" href="animeRef.php?sn=2"></a></div>'});for(const file of ['page-entry.js','settings.js','content.js'])w.eval(fs.readFileSync('src/'+file,'utf8'));return dom;}
const card=(id,year,progress)=>`<a class="theme-list-main" href="animeRef.php?sn=${id}"><div class="theme-img-block"><img class="theme-img"><span class="ani-watch-progress-badge">看到第 ${progress} 話</span></div><div class="anime-detail-block"><div class="theme-info-block"><p class="theme-name">作品${id}</p><div class="theme-detail-info-block"><p class="theme-time">${year} 春番</p><span class="theme-number">${progress} / 12 集</span></div></div></div></a>`;
test('collection shares the catalog panel and combines official classifications with collection filters', async t => {
  const dom = boot(`<div id="BH_background"><div class="container"><div class="animate-theme-list"><div class="theme-list-block">${card(1,2026,12)}${card(2,2025,3)}${card(3,2026,0)}</div></div></div></div>`, '/mygather.php');
  t.after(() => dom.window.close());
  const w = dom.window, d = w.document;
  const requests = [];
  w.fetch = async input => {
    requests.push(new URL(input, w.location.href).searchParams);
    return {ok:true,text:async()=>'<div class="theme-list-block"><a class="theme-list-main" href="animeRef.php?sn=2"></a></div>'};
  };
  const cards = [...d.querySelectorAll('.theme-list-main')];
  let clicks = 0;
  cards[0].addEventListener('click', e => { e.preventDefault(); clicks++; });
  const group = name => d.querySelector(`[role="group"][aria-label="${name}"]`);
  const click = (name, text) => [...group(name).querySelectorAll('button')].find(b => b.textContent === text).click();
  const hidden = () => cards.map(c => c.hidden);
  click('觀看狀態', '已追完');
  assert.deepEqual(hidden(), [false,true,true]);
  const year = d.querySelector('[aria-label="播出年份"]');
  const selectYear = value => { year.value = value; year.dispatchEvent(new w.Event('change')); };
  selectYear('2025');
  assert(cards.every(c => c.hidden));
  selectYear('');
  click('播出季度', '冬番');
  assert(cards.every(c => c.hidden));
  click('播出季度', '春番');
  assert.deepEqual(hidden(), [false,true,true]);
  click('觀看狀態', '全部');
  const toggle = d.querySelector('.ani-filter-toggle');
  const body = d.getElementById(toggle.getAttribute('aria-controls'));
  assert(body.contains(group('對象')));
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  click('屬性', '校園');
  click('屬性', '戀愛');
  click('類型', '電影');
  click('對象', '闔家觀賞');
  await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(requests.length, 1);
  assert.deepEqual(new Set(requests[0].get('tags').split(',')), new Set(['校園','戀愛']));
  assert.equal(requests[0].get('category'), '電影');
  assert.equal(requests[0].get('target'), '闔家觀賞');
  assert.deepEqual(hidden(), [true,false,true]);
  click('屬性', '全部');
  click('類型', '全部');
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
test('weekly expansion exposes remaining native tiles and closes reversibly',()=>{const tiles=Array.from({length:6},(_,i)=>`<a class="text-anime-info" href="animeVideo.php?sn=${i}"><span class="text-anime-name">作品${i}</span></a>`).join('');const dom=boot(`<div id="BH_background"><section id="blockVideoInSeason"><div class="textpage-switch-page nav-choose-segment"></div><div class="programlist-wrap_block"><div class="programlist-block"><div class="day-list today-list"><h3 class="day-title">週二</h3>${tiles}</div></div></div></section></div>`,'/');const d=dom.window.document;assert.equal(d.querySelectorAll('.ani-week-extra').length,1);const button=d.querySelector('.ani-week-expand');button.click();assert(d.querySelector('#blockVideoInSeason').classList.contains('ani-week-expanded'));assert.equal(button.getAttribute('aria-expanded'),'true');button.click();assert.equal(button.getAttribute('aria-expanded'),'false');assert(d.documentElement.dataset.aniUiReady);dom.window.close();});

test('weekly reveal animates its control without fading the entire schedule',async()=>{
 const tiles=Array.from({length:7},(_,i)=>`<a class="text-anime-info"><span class="text-anime-name">作品${i}</span></a>`).join('');
 const dom=boot(`<div id="BH_background"><section id="blockVideoInSeason"><div class="programlist-wrap_block"><div class="programlist-block"><div class="day-list"><h3>週一</h3>${tiles}</div></div></div></section></div>`,'/');
 const d=dom.window.document;let animations=0;
 d.querySelector('.programlist-wrap_block').animate=()=>assert.fail('full schedule should not fade');
 d.querySelector('.ani-week-expand').animate=frames=>{assert(frames.every(frame=>!('height' in frame)));animations++;return {finished:Promise.resolve()};};
 const button=d.querySelector('.ani-week-expand');button.click();assert.equal(animations,1);button.click();await new Promise(r=>setTimeout(r,0));assert(!d.querySelector('#blockVideoInSeason').classList.contains('ani-week-expanded'));dom.window.close();
});

test('homepage cover glow samples artwork rather than the clock icon',()=>{
 const dom=boot('<div id="BH_background"><section id="blockVideoInSeason"><a class="anime-card-block"><div class="anime-pic-block"><img class="anime-clock-img" src="https://i2.bahamut.com.tw/anime/pic_time_icon.svg"><div class="anime-blocker"><img src="https://p2.bahamut.com.tw/B/2KU/cover.JPG"></div></div><div class="anime-detail-block"></div></a></section></div>','/');
 assert.equal(dom.window.document.querySelector('.anime-card-block').style.getPropertyValue('--ani-card-cover'),'url("https://p2.bahamut.com.tw/B/2KU/cover.JPG")');dom.window.close();
});

test('collection loads the next page in place and reapplies active filters',async()=>{
 const dom=new JSDOM(`<div id="BH_background"><div class="container"><div class="animate-theme-list"><div class="theme-list-block">${card(1,2026,12)}</div></div><div class="page_control"><div class="page_number"><span class="now">1</span><a href="mygather.php?page=2">2</a></div></div></div></div>`,{url:'https://ani.gamer.com.tw/mygather.php',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.matchMedia=()=>({matches:false,addEventListener(){}});w.IntersectionObserver=class{observe(){}};w.AbortSignal.timeout=()=>undefined;
 w.fetch=async(url)=>({ok:true,text:async()=>String(url).includes('page=2')?`<div class="theme-list-block">${card(2,2025,3)}</div>`:'<li class="type"><ul class="tag-list"><li class="tag">校園</li></ul></li>'});
 for(const f of ['settings.js','content.js'])w.eval(fs.readFileSync('src/'+f,'utf8'));
 const d=w.document;[...d.querySelectorAll('[role="group"][aria-label="觀看狀態"] button')].find(b=>b.textContent==='已追完').click();d.querySelector('.ani-load-more').click();await new Promise(r=>setTimeout(r,1800));
 assert.equal(d.querySelectorAll('.theme-list-main').length,2);assert(d.querySelector('a[href="animeRef.php?sn=2"]').hidden);assert(d.querySelector('.page_control').hidden);assert.equal(d.querySelector('.ani-load-more').textContent,'已顯示全部動畫（共 2 部）');dom.window.close();
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
