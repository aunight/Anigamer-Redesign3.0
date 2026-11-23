import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

function setup() {
  const dom = new JSDOM('<body><div class="big_banner"><a href="animeVideo.php?sn=1"><img src="https://truth.bahamut.com.tw/a.jpg"></a></div></body>', { url: 'https://ani.gamer.com.tw/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = () => ({ matches: true });
  w.URL.createObjectURL = () => 'blob:test'; w.URL.revokeObjectURL = () => {};
  w.HTMLImageElement.prototype.decode = async () => {};
  w.caches = { open: async () => ({ match: async () => new Response(new Blob(['image'], { type: 'image/jpeg' })) }) };
  w.eval(fs.readFileSync('src/hero-banner.js', 'utf8'));
  return dom;
}

test('banner discovery rejects unrelated destinations and untrusted image sources', () => {
  const dom = setup(), w = dom.window;
  const page = new w.DOMParser().parseFromString('<div class="big_banner"><a href="animeVideo.php?sn=2"><img src="https://truth.bahamut.com.tw/b.jpg"></a><a href="https://evil.test/animeVideo.php?sn=3"><img src="https://truth.bahamut.com.tw/c.jpg"></a><a href="animeVideo.php?sn=4"><img src="https://evil.test/d.jpg"></a></div>', 'text/html');
  const result = w.AniHeroBanner.candidates(page);
  assert.equal(result.length, 1);
  assert.equal(result[0].href, 'https://ani.gamer.com.tw/animeVideo.php?sn=2');
  dom.window.close();
});

test('metadata uses source values and leaves absent statistics unknown', () => {
  const dom = setup(), w = dom.window;
  const doc = new w.DOMParser().parseFromString('<title>測試</title><script type="application/ld+json">{"@type":"VideoObject","name":"動畫 [2]","description":"動畫 [2] 線上看! 故事內容","aggregateRating":{"ratingValue":"4.7"},"interactionStatistic":[{"interactionType":"WatchAction","userInteractionCount":12000}]}</script><section class="season"><li><a>1</a></li><li><a>2</a></li><li><a>2</a></li></section>', 'text/html');
  const info = w.AniHeroBanner.metadata(doc);
  assert.equal(info.title, '動畫'); assert.equal(info.description, '故事內容');
  assert.equal(info.score, '4.7'); assert.equal(info.views, 12000); assert.equal(info.episodes, 2);
  doc.querySelector('script').textContent = JSON.stringify({
    '@type': 'VideoObject',
    description: '※第一季：第1-12集（2025年09月首播） ※第二季：第13-??集（2026年09月首播） 劇情開始。 ＜製作團隊＞ ｜原作性質：輕小說',
  });
  assert.equal(w.AniHeroBanner.metadata(doc).description, '劇情開始。');
  doc.body.insertAdjacentHTML('beforeend', '<section class="data"><div class="data-intro"><p>完整劇情。<br>旅程仍在繼續。</p></div></section>');
  assert.equal(w.AniHeroBanner.metadata(doc).description, '完整劇情。 旅程仍在繼續。');
  const missing = w.AniHeroBanner.metadata(new w.DOMParser().parseFromString('<title>沒有資料</title>', 'text/html'));
  assert.equal(missing.score, null); assert.equal(missing.views, null); assert.equal(missing.episodes, null);
  dom.window.close();
});

test('cached banners mount once, retain native markup, and navigate without a network refresh', async () => {
  const dom = setup(), w = dom.window;
  const now = Date.now();
  const entries = [1, 2].map(n => ({ image: `https://truth.bahamut.com.tw/${n}.jpg`, href: `https://ani.gamer.com.tw/animeVideo.php?sn=${n}`, meta: { title: `動畫 ${n}`, description: '簡介', score: '4.8', views: 12345, episodes: 12, version: 3, updated: now } }));
  entries[0].meta.description = '※第二季：第13-??集（2026年09月首播） 現有簡介。 <製作團隊> ｜原作';
  entries[1].meta.description = '冒險就此開始。新的旅程';
  w.localStorage.setItem('aniHeroBannerV1', JSON.stringify({ entries, sampled: now, sampleVersion: 2 }));
  // Match the native image to an already cached entry to exercise deduplication.
  w.document.querySelector('.big_banner img').src = entries[0].image;
  w.fetch = () => { throw new Error('Unexpected network request for fresh cache'); };
  w.AniHeroBanner.mount(true); w.AniHeroBanner.mount(true);
  assert.equal(w.document.querySelectorAll('.ani-hero').length, 1);
  assert.equal(w.document.querySelector('.ani-hero h2').textContent, '動畫 1');
  assert.equal(w.document.querySelector('.ani-hero-description').textContent, '現有簡介。');
  assert.equal(w.document.querySelectorAll('.ani-hero-dots button').length, 2);
  assert.equal(w.document.querySelectorAll('.ani-hero-stat').length, 3);
  w.document.querySelector('.ani-hero-next').click();
  assert.equal(w.document.querySelector('.ani-hero h2').textContent, '動畫 2');
  assert.equal(w.document.querySelector('.ani-hero-description').textContent, '冒險就此開始。新的旅程');
  assert.equal(w.document.querySelector('.ani-hero-description').title, '冒險就此開始。新的旅程');
  assert.equal(w.document.querySelector('.ani-hero-watch').href, entries[1].href);
  w.AniHeroBanner.mount(false);
  assert.equal(w.document.querySelector('.big_banner').classList.contains('ani-hero-enabled'), false);
  assert.ok(w.document.querySelector('.big_banner > a'));
  await new Promise(resolve => setTimeout(resolve, 0));
  dom.window.close();
});
