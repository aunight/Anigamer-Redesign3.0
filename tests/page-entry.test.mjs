import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const entry = fs.readFileSync('src/page-entry.js', 'utf8');

function createPage(t, { path = '/', referrer, reduced = false } = {}) {
  const dom = new JSDOM('', {
    url: 'https://ani.gamer.com.tw' + path,
    referrer,
    runScripts: 'outside-only',
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  const frames = [];
  const timers = new Map();
  let nextId = 0;
  w.matchMedia = () => ({ matches: reduced });
  w.requestAnimationFrame = callback => frames.push(callback);
  w.setTimeout = (callback, delay) => {
    timers.set(++nextId, { callback, delay });
    return nextId;
  };
  w.clearTimeout = id => timers.delete(id);
  return {
    w, timers,
    paint: () => frames.splice(0).forEach(callback => callback()),
  };
}

test('the opening leaves on the first ready frame while a custom font is pending', t => {
  const { w, timers, paint } = createPage(t);
  w.document.body.remove();
  w.localStorage.setItem('aniFontUrlHint', 'https://fonts.googleapis.com/css2?family=Iansui&display=block');
  w.eval(entry);
  const curtain = w.document.querySelector('.ani-home-intro');
  assert.equal(curtain.parentElement, w.document.documentElement);
  assert.equal(curtain.querySelector('.ani-intro-credit').textContent, '（此版本為 秋夜 AuNight 設計版本）');
  const font = w.document.querySelector('#ani-intro-font');
  assert.equal(font.media, 'print');
  assert.equal(new URL(font.href).searchParams.get('display'), 'swap');
  w.dispatchEvent(new w.Event('ani-ui-ready'));
  paint();
  assert(curtain.classList.contains('ani-intro-reveal'));
  assert(!w.document.documentElement.dataset.aniBooting);
  assert.equal(font.media, 'print', 'reveal does not wait for a font response');
  const [cleanup] = timers.values();
  assert(cleanup.delay <= 250);
  cleanup.callback();
  assert(!curtain.isConnected);
  font.dispatchEvent(new w.Event('load'));
  assert.equal(font.media, 'all');
});

test('opening respects disabled themes and reduced motion', t => {
  const disabled = createPage(t).w;
  disabled.chrome = { storage: { sync: { get(_defaults, callback) { callback({ themeEnabled: false }); } } } };
  disabled.eval(entry);
  assert.equal(disabled.document.querySelector('.ani-home-intro'), null);

  const reduced = createPage(t, { path: '/mygather.php', reduced: true }).w;
  reduced.eval(entry);
  assert.equal(reduced.document.documentElement.dataset.aniBooting, 'true');
  reduced.dispatchEvent(new reduced.Event('ani-ui-ready'));
  assert(!reduced.document.documentElement.dataset.aniBooting);
  assert(!reduced.document.querySelector('.ani-home-intro'));
});

test('internal navigation releases its cover when parsing completes without the extension event', t => {
  const { w, paint, timers } = createPage(t, {
    path: '/mygather.php',
    referrer: 'https://ani.gamer.com.tw/',
  });
  w.eval(entry);
  const cover = w.document.querySelector('.ani-route-cover');
  assert(cover);
  assert(!w.document.querySelector('.ani-home-intro'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  paint();
  assert(cover.classList.contains('ani-route-visible'));
  assert.equal(timers.size, 1);
  const [cleanup] = timers.values();
  assert(cleanup.delay <= 150);
  cleanup.callback();
  assert(!cover.isConnected);
});

test('a missing readiness event cannot keep the opening overlay indefinitely', t => {
  const { w, timers } = createPage(t);
  w.eval(entry);
  const [deadline] = timers.values();
  assert(deadline.delay < 1000);
  deadline.callback();
  assert(!w.document.documentElement.dataset.aniBooting);
  assert(w.document.querySelector('.ani-intro-reveal'));
});
