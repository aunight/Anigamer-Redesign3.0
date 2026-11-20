import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {JSDOM} from 'jsdom';

test('history keeps native controls and keeps each episode list inside its owning card slot',async()=>{
  const dom=new JSDOM(`<body><div id="BH_background"><div class="center-container"><div class="history"><div class="user-watch-list" id="list-1"><div class="anime-card"><a class="click-area" href="animeVideo.php?sn=1"></a><div class="postimg"><img></div><div class="anime-info"><p class="history-anime-title">測試作品</p><div class="tm-acg-rating">★ 4.8 / 5 (10 人評價)</div><p class="history-lastwatch">觀看至 <span class="user-lastwatch">6</span> 集｜已更新至 第12集</p><p class="history-lastwatch">觀看至 06 分 00 秒</p><div class="progress-bar"><div class="progress" style="width:50%"></div></div></div><div class="delete-btn" data-anime-sn="101"></div><div class="btn-set"><a class="play-btn" href="animeVideo.php?sn=1"></a><div class="more-btn" data-anime="101"></div></div></div></div><div class="user-watch-list" id="list-2"></div><div class="user-watchTime-list" id="sub-list-101" data-anime-sn="101" style="display:none"><a href="animeVideo.php?sn=1"><span class="history-list-anime-title">測試作品 [6]</span><span class="date">2026.11.17 12:30</span></a></div></div></div></div></body>`,{url:'https://ani.gamer.com.tw/viewList.php?u=fixture',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document;
  w.matchMedia=()=>({matches:false,addEventListener(){}});
  w.fetch=async()=>({ok:true,text:async()=>'<li class="type"><span class="title">作品分類</span><ul class="tag-list"><li class="tag">奇幻</li><li class="tag">冒險</li></ul></li><li><span class="title">製作廠商</span><p>NUT</p></li><script type="application/ld+json">{"@type":"VideoObject","duration":"PT24M"}</script><button class="ordered" onclick="animefun.toggleGather(123,101,$(this))"></button>'});
  const more=d.querySelector('.more-btn'),details=d.querySelector('.user-watchTime-list');
  d.querySelector('.user-lastwatch').textContent = '1';
  d.querySelector('.click-area').setAttribute('href', 'animeVideo.php?sn=99');
  details.insertAdjacentHTML('beforeend', '<a href="animeVideo.php?sn=7"><span class="history-list-anime-title">測試作品 ［７］</span></a>');
  details.style.backgroundColor = '#182433';
  details.insertAdjacentHTML('beforeend', '<ul class="user-watch-textlist"><li><a href="animeVideo.php?sn=8"><span class="history-list-anime-title">測試作品 特別篇</span><span class="date">54 分前</span></a></li></ul>');
  d.querySelector('#BH_background').insertAdjacentHTML('beforeend', `
    <div class="animate-theme-list">
      <a class="theme-list-main" href="animeRef.php?sn=101">
        <div class="theme-img-block"><span class="theme-number">共 12 集</span></div>
      </a>
    </div>`);
  d.querySelector('.center-container').append(details);
  let nativeClicks=0;
  more.addEventListener('click',()=>{nativeClicks++;const open=d.querySelector('.anime-card').classList.toggle('is-open');details.style.display=open?'block':'none';});
  for(const file of ['settings.js','content.js'])w.eval(fs.readFileSync(`src/${file}`,'utf8'));
  assert(d.body.classList.contains('ani-history-page'));
  assert.equal(details.parentElement.id, 'list-1');
  assert(details.previousElementSibling.classList.contains('anime-card'));
  assert.equal(details.dataset.aniOwner,'101');
  assert(!details.closest('.ani-bgm-toast'), 'short episode history must never be styled as a player toast');
  assert(!details.querySelector('.ani-bgm-toast-icon'));
  assert.equal(d.querySelector('.ani-history-play-label').textContent,'繼續觀看');
  assert.equal(more.hasAttribute('title'),false,'no browser tooltip duplicates the native action');
  assert.equal(d.querySelector('.ani-history-score').textContent,'★ 4.8');
  assert.equal(more.getAttribute('aria-expanded'),'false');
  more.click();await new Promise(r=>setTimeout(r,40));
  assert.equal(more.getAttribute('aria-expanded'),'true');
  assert.equal(d.querySelector('.ani-history-meta').textContent,'動畫類型：奇幻、冒險\n製作組：NUT','metadata comes from native public labels');
  assert.equal(nativeClicks,1,'native event remains attached');
  assert.equal(d.querySelector('.ani-history-timing').textContent,'6:00 / 24:00');
  assert.equal(d.querySelector('.ani-history-episode').textContent,'EP.6');
  assert.equal(d.querySelector('.theme-number').textContent,'7 / 12 集');
  assert.equal(d.querySelector('.ani-history-progress-text').textContent,'已看 25% · 剩餘 18分00秒');
  assert(d.querySelector('.postimg .ani-history-score'),'rating shares the poster corner design');
  assert.equal(d.querySelector('.history-list-anime-title').textContent,'EP.6');
  assert.deepEqual(
    [...details.querySelectorAll('.history-list-anime-title')]
      .filter(label => !label.closest('[data-ani-history-unnumbered]'))
      .map(label => label.textContent),
    ['EP.6', 'EP.7'],
  );
  assert.equal(details.querySelector('li[data-ani-history-unnumbered] .date').textContent, '54 分前');
  const favorite=d.querySelector('.ani-history-favorite');assert(favorite);assert.equal(favorite.getAttribute('aria-pressed'),'true');
  assert.equal(favorite.parentElement.className,'postimg');
  assert.equal(details.parentElement.id,'list-1');
  favorite.classList.remove('ani-saved');await new Promise(r=>setTimeout(r,20));assert.equal(favorite.getAttribute('aria-pressed'),'false');
  more.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  await new Promise(r=>setTimeout(r,40));
  assert.equal(more.getAttribute('aria-expanded'),'false');
  assert.equal(details.style.display,'none');
  assert.equal(d.querySelector('.progress').style.width,'25%','progress uses native elapsed time and the verified full duration');
  assert.equal(d.querySelector('.progress-bar').getAttribute('aria-valuenow'),'360');
  assert.equal(d.querySelector('.play-btn').getAttribute('href'),'animeVideo.php?sn=1');
  w.innerWidth=800;w.dispatchEvent(new w.Event('resize'));await new Promise(r=>setTimeout(r,40));
  assert.equal(details.parentElement.id,'list-1','narrow layouts retain the correct owner');
  w.innerWidth=1200;w.dispatchEvent(new w.Event('resize'));await new Promise(r=>setTimeout(r,40));
  assert.equal(details.parentElement.id,'list-1');
  await new Promise(r=>setTimeout(r,220));
  assert.equal(d.querySelectorAll('.ani-history-score').length,1,'enhancement is idempotent');
  more.dataset.listCode='1';w.dispatchEvent(new w.Event('resize'));await new Promise(r=>setTimeout(r,40));
  const beforeNative=nativeClicks;more.click();assert.equal(nativeClicks,beforeNative,'native clone/slide handler is bypassed for native history cards');assert.equal(details.style.display,'block');assert.equal(d.querySelectorAll('.tmp-list').length,0);more.click();assert.equal(details.style.display,'none');
  const fallback = more.cloneNode(true);
  delete fallback.dataset.aniHistoryKey;
  delete fallback.dataset.aniNativeFold;
  delete fallback.dataset.listCode;
  details.id = 'native-episodes-101';
  more.replaceWith(fallback);
  w.dispatchEvent(new w.Event('resize'));
  await new Promise(r=>setTimeout(r,40));
  fallback.click();
  await new Promise(r=>setTimeout(r,40));
  assert.equal(fallback.getAttribute('aria-controls'), details.id);
  assert.equal(fallback.getAttribute('aria-expanded'), 'true');
  assert.equal(details.style.display, 'block', 'the owning drawer opens when the native button does nothing');
  w.close();
});

test('scroll sentinel delegates loading to the existing history control once',()=>{
 const dom=new JSDOM('<div id="BH_background"><div class="history-wrapper"><div class="anime-btn-show-more"></div></div></div>',{url:'https://ani.gamer.com.tw/viewList.php',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window,d=w.document;w.matchMedia=()=>({matches:false,addEventListener(){}});const observations=[];w.IntersectionObserver=class{constructor(callback){this.callback=callback;}observe(node){observations.push({node,callback:this.callback});}disconnect(){}};const more=d.querySelector('.anime-btn-show-more');let calls=0;more.addEventListener('click',()=>{calls++;more.remove();});
 for(const f of ['settings.js','content.js'])w.eval(fs.readFileSync('src/'+f,'utf8'));const sentinel=observations.find(o=>o.node===more);assert(sentinel);sentinel.callback([{isIntersecting:true}]);sentinel.callback([{isIntersecting:true}]);assert.equal(calls,1);w.close();
});
