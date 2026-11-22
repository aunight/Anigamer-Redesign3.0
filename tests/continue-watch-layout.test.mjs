import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const bridge = readFileSync(new URL('../src/topbar-bridge.js', import.meta.url), 'utf8');

test('continue watching measures at Slick initialization and when the redesigned rail widens', async () => {
  const dom = new JSDOM('<div id="continueWatch"></div>', {
    url: 'https://ani.gamer.com.tw/',
    runScripts: 'outside-only',
  });
  try {
    const { window } = dom;
    window.matchMedia = () => ({ matches: false });
    let notifySize;
    window.ResizeObserver = class {
      constructor(callback) { notifySize = callback; }
      observe() {}
      disconnect() {}
    };
    const rail = window.document.getElementById('continueWatch');
    let width = 1248;
    Object.defineProperty(rail, 'clientWidth', { get: () => width });
    const measurements = [];
    window.eval(bridge);
    notifySize();
    assert.deepEqual(measurements, []);

    rail.classList.add('slick-initialized');
    rail.slick = { setPosition: () => measurements.push(rail.clientWidth) };
    await Promise.resolve();
    assert.equal(rail.dataset.aniContinueSized, 'true');
    assert.deepEqual(measurements, [1248]);

    width = 2182;
    notifySize();
    notifySize();
    assert.deepEqual(measurements, [1248, 2182]);
  } finally {
    dom.window.close();
  }
});
