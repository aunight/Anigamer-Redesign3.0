import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

test('the keyboard shortcut stays inside player settings with or without Plus', async t => {
  const dom = new JSDOM(`<div id="BH_background"><div class="image_tool"></div>
    <div id="ani_video"><div class="top-tool-bar"><div class="tools"><button class="shortcut-button"></button></div></div></div>
    <div class="anime-title"><div class="anime_name"><h1>測試作品 [1]</h1><button>收藏</button></div></div>
  </div>`, {
    url: 'https://ani.gamer.com.tw/animeVideo.php?sn=123',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  const d = w.document;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  const shortcut = d.querySelector('.shortcut-button');
  const player = d.getElementById('ani_video');
  for (const file of ['settings.js', 'content.js']) w.eval(fs.readFileSync('src/' + file, 'utf8'));
  assert.equal(shortcut.parentElement, player);
  assert(shortcut.classList.contains('ani-shortcut-in-player'));
  assert.equal(d.querySelector('.anime_name .shortcut-button'), null);
  assert.equal(shortcut.getAttribute('aria-label'), '鍵盤快捷鍵');

  const settingsBody = d.createElement('div');
  settingsBody.className = 'ani-player-settings-body';
  settingsBody.innerHTML = '<div class="ani-settings-anim-inner"></div>';
  const settingsHost = settingsBody.firstElementChild;
  d.getElementById('BH_background').append(settingsBody);
  await new Promise(resolve => w.setTimeout(resolve, 230));
  assert.equal(shortcut.parentElement, settingsHost);
  assert(shortcut.classList.contains('ani-shortcut-in-settings'));
  assert(!shortcut.classList.contains('ani-shortcut-in-player'));

  const toolbar = d.createElement('div');
  toolbar.className = 'plus_imagetool_box';
  d.querySelector('.image_tool').append(toolbar);
  await new Promise(resolve => w.setTimeout(resolve, 230));
  assert.equal(shortcut.parentElement, settingsHost);
  assert.equal(toolbar.querySelector('.shortcut-button'), null);
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  shortcut.click();
  assert(d.querySelector('#ani-shortcut-modal').open);
  assert.equal(shortcut.querySelectorAll('.ani-shortcut-btn-glyph').length, 1);
});

test('late Plus toolbar buttons get tooltips and stay mounted across player updates', async t => {
  const dom = new JSDOM('<div id="BH_background"><div class="image_tool"></div></div>', {
    url: 'https://ani.gamer.com.tw/animeVideo.php?sn=123',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  for (const file of ['settings.js', 'content.js']) {
    w.eval(fs.readFileSync('src/' + file, 'utf8'));
  }
  const host = w.document.querySelector('.image_tool');
  host.innerHTML = `<div class="plus_imagetool_box">
    <div id="fusion" class="plus_button_box"><button class="plus_button">圖像融合</button></div>
    <div id="reconstruct" class="plus_button_box"><button class="plus_button">映像重構</button></div>
    <div class="plus_button_box"><button class="plus_button">截圖</button></div>
  </div>`;
  await new Promise(resolve => w.setTimeout(resolve, 0));
  const toolbar = host.querySelector('.plus_imagetool_box');
  const fusion = toolbar.querySelector('#fusion');
  const reconstruct = toolbar.querySelector('#reconstruct');
  const originalButton = fusion.querySelector('button');
  let clicked = 0;
  originalButton.onclick = () => clicked++;

  const mutations = [];
  const observer = new w.MutationObserver(records => mutations.push(...records));
  observer.observe(toolbar, { childList: true });
  host.append(w.document.createElement('span'));
  await new Promise(resolve => w.setTimeout(resolve, 0));
  assert(!mutations.some(record => [...record.removedNodes].some(node => node === fusion || node === reconstruct)),
    'player updates must not remove and reinsert the two Plus controls');
  assert.match(fusion.dataset.aniPlusTip, /^圖像融合：/);
  assert.match(reconstruct.dataset.aniPlusTip, /^映像重構：/);
  assert.equal(fusion.querySelector('button'), originalButton);
  originalButton.click();
  assert.equal(clicked, 1);
});
