import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

test('confirmed native review posts and edits update the sidebar immediately', async t => {
  const stars = Array.from({ length: 5 }, (_, i) => `<button data-acgstar="${i + 1}"></button>`).join('');
  const dom = new JSDOM(`<div id="BH_background">
    <section class="player"><div class="subtitle">
      <div class="ani-tabs"><a class="ani-tabs-link" href="#ani-tab-content-1">彈幕列表</a></div>
      <div class="ani-tab-content"><div id="ani-tab-content-1" class="ani-tab-content__item"></div></div>
    </div></section>
    <div id="acg_review">
      <div class="score-overall-number">4.9</div>
      <div class="acg-score-user"><div class="user-score-block"><div class="user-star-block">${stars}</div></div></div>
      <button class="user-score-more" onclick="acgReview.navAllReviews(123, 4)">查看所有評價</button>
    </div>
  </div>`, { url: 'https://ani.gamer.com.tw/animeVideo.php?sn=123', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const w = dom.window;
  const d = w.document;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  const handlers = new Map();
  w.jQuery = target => ({
    on(events, handler) {
      assert.equal(target, w);
      for (const name of events.split(' ')) handlers.set(name.split('.')[0], handler);
    },
  });
  const requests = [];
  w.chrome = { runtime: { sendMessage(message, respond) {
    if (message.type === 'ani-fetch-reviews') requests.push(respond);
    else respond({});
  } } };
  for (const file of ['settings.js', 'content.js', 'topbar-bridge.js']) w.eval(fs.readFileSync('src/' + file, 'utf8'));
  await new Promise(resolve => w.setTimeout(resolve, 0));
  const button = () => d.querySelector('.ani-my-write-review-btn');
  const displayed = () => d.querySelector('.ani-rating-own-review .ani-rev-body')?.textContent;
  const review = content => ({ id: '12345', author: '測試勇者', rating: 5, content });
  assert.equal(requests.length, 1);
  requests.shift()({ reviews: [] });
  await new Promise(resolve => w.setTimeout(resolve, 0));
  assert.equal(button().textContent, '寫評論');
  assert.equal(displayed(), undefined);

  handlers.get('AcgScorePostNew')({}, { content: '新評論 <文字>' });
  assert.equal(button().textContent, '修改評論');
  assert.equal(displayed(), '新評論 <文字>');
  assert.equal(requests.length, 1);
  requests.shift()({ myReview: review('新評論 <文字>') });
  await new Promise(resolve => w.setTimeout(resolve, 0));
  assert.equal(d.querySelector('.ani-rating-own-review .ani-review-card').href, 'https://wall.gamer.com.tw/post.php?sn=12345');
  const nativeBlock = d.querySelector('.user-score-block');
  nativeBlock.parentElement.classList.add('is-scored');
  let clickedTarget;
  nativeBlock.addEventListener('click', event => { clickedTarget = event.target; });
  button().click();
  assert.equal(clickedTarget, nativeBlock);

  handlers.get('AcgScorePostEdit')({}, { content: '只修改文字，星數不變' });
  assert.equal(displayed(), '只修改文字，星數不變');
  assert.equal(requests.length, 1);
  requests.shift()({ myReview: review('新評論 <文字>') });
  await new Promise(resolve => w.setTimeout(resolve, 0));
  assert.equal(displayed(), '只修改文字，星數不變', 'a stale list response cannot restore the old text');
  assert.equal(button().textContent, '修改評論');

  nativeBlock.parentElement.classList.remove('is-scored');
  await new Promise(resolve => w.setTimeout(resolve, 0));
  assert.equal(displayed(), undefined);
  assert.equal(button().textContent, '寫評論');
});
