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
    fire: delay => {
      const [id, timer] = [...timers].find(([, candidate]) => candidate.delay === delay);
      timers.delete(id);
      timer.callback();
    },
  };
}

function markReady(w, enhancements = false) {
  const root = w.document.documentElement;
  if (enhancements) root.dataset.aniEnhancementsUiReady = 'true';
  else root.dataset.aniUiReady = 'true';
  w.dispatchEvent(new w.Event(enhancements ? 'ani-enhancements-ui-ready' : 'ani-ui-ready'));
}

test('the opening waits for both UI phases and its minimum duration but does not wait for web fonts', t => {
  const { w, timers, paint, fire } = createPage(t);
  w.document.body.remove();
  w.localStorage.setItem('aniFontUrlHint', 'https://fonts.googleapis.com/css2?family=Iansui&display=block');
  w.eval(entry);
  const curtain = w.document.querySelector('.ani-home-intro');
  assert.equal(curtain.parentElement, w.document.documentElement);
  assert.equal(curtain.querySelector('.ani-intro-credit').textContent, '（此版本為 秋夜 AuNight 設計版本）');
  const font = w.document.querySelector('#ani-intro-font');
  assert.equal(font.media, 'print');
  assert.equal(new URL(font.href).searchParams.get('display'), 'swap');
  markReady(w);
  markReady(w, true);
  paint();
  assert(!curtain.classList.contains('ani-intro-reveal'));
  fire(750);
  paint();
  assert(!curtain.classList.contains('ani-intro-reveal'));
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
  markReady(reduced);
  markReady(reduced, true);
  assert(!reduced.document.documentElement.dataset.aniBooting);
  assert(!reduced.document.querySelector('.ani-home-intro'));
});

test('internal navigation keeps its cover after parsing until both UI phases are ready', t => {
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
  assert(!cover.classList.contains('ani-route-visible'));
  markReady(w);
  paint();
  assert(!cover.classList.contains('ani-route-visible'));
  markReady(w, true);
  paint();
  paint();
  assert(cover.classList.contains('ani-route-visible'));
  assert.equal(timers.size, 1);
  const [cleanup] = timers.values();
  assert(cleanup.delay <= 150);
  cleanup.callback();
  assert(!cover.isConnected);
});

test('reload shows the full opening until the themed UI is ready even on an internal route', t => {
  const { w, paint, fire } = createPage(t, {
    path: '/mygather.php',
    referrer: 'https://ani.gamer.com.tw/',
  });
  w.performance.getEntriesByType = () => [{ type: 'reload' }];
  w.eval(entry);
  const root = w.document.documentElement;
  const curtain = w.document.querySelector('.ani-home-intro');
  assert(curtain);
  assert(!w.document.querySelector('.ani-route-cover'));
  assert.equal(root.dataset.aniReloading, 'true');

  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  paint();
  assert.equal(root.dataset.aniReloading, 'true');
  assert(!curtain.classList.contains('ani-intro-reveal'));

  fire(750);
  markReady(w);
  paint();
  assert(!curtain.classList.contains('ani-intro-reveal'), 'core readiness alone does not reveal the player');
  markReady(w, true);
  paint();
  assert(!curtain.classList.contains('ani-intro-reveal'), 'the opening has a frame to paint');
  paint();
  assert(curtain.classList.contains('ani-intro-reveal'));
  assert.equal(root.dataset.aniReloading, undefined);
  assert.equal(root.dataset.aniBooting, undefined);
});

test('a missing readiness event cannot keep the opening overlay indefinitely', t => {
  const { w, fire } = createPage(t);
  w.eval(entry);
  fire(750);
  fire(5000);
  assert(!w.document.documentElement.dataset.aniBooting);
  assert(w.document.querySelector('.ani-intro-reveal'));
});

test('playback reload reveals after the themed layout paints without a fixed intro delay', t => {
  const { w, paint } = createPage(t, { path: '/animeVideo.php?sn=33122' });
  w.performance.getEntriesByType = () => [{ type: 'reload' }];
  w.eval(entry);
  const curtain = w.document.querySelector('.ani-home-intro');
  assert(curtain);
  markReady(w, true);
  paint();
  assert(!curtain.classList.contains('ani-intro-reveal'), 'waits for the themed layout');
  markReady(w);
  paint();
  assert(!curtain.classList.contains('ani-intro-reveal'), 'the opening has a frame to paint');
  paint();
  assert(curtain.classList.contains('ani-intro-reveal'));
});

test('playback reload can reveal an already themed page when enhancements are delayed', t => {
  const { w, paint, fire } = createPage(t, { path: '/animeVideo.php?sn=33122' });
  w.performance.getEntriesByType = () => [{ type: 'reload' }];
  w.eval(entry);
  markReady(w);
  fire(250);
  paint();
  paint();
  assert(w.document.querySelector('.ani-intro-reveal'));
  assert(!w.document.documentElement.dataset.aniBooting);
  assert(!w.document.documentElement.dataset.aniEpisodePreview);
});
