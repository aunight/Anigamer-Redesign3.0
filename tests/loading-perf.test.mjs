import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

function matchGlob(pattern, url) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*');
  return new RegExp(`^${escaped}$`).test(url);
}

test('manifest routes only inject scripts and stylesheets needed on home and watch pages', () => {
  const manifest = JSON.parse(fs.readFileSync('src/manifest.json', 'utf8'));
  const scriptsFor = (url, runAt) =>
    manifest.content_scripts
      .filter((entry) => (!runAt || entry.run_at === runAt) && entry.matches.some((m) => matchGlob(m, url)))
      .flatMap((entry) => entry.js || []);
  const stylesFor = (url) =>
    manifest.content_scripts
      .filter((entry) => entry.matches.some((m) => matchGlob(m, url)))
      .flatMap((entry) => entry.css || []);

  const homeUrl = 'https://ani.gamer.com.tw/';
  const homeScripts = scriptsFor(homeUrl);
  for (const unwanted of ['opencc.js', 'studio-catalog.js', 'studio-credits.js', 'black-bars.js', 'ambient-renderer.js']) {
    assert(!homeScripts.includes(unwanted), `home should not inject ${unwanted}`);
  }
  assert(homeScripts.includes('hero-banner.js'));
  assert(homeScripts.includes('home-dashboard.js'));

  const watchUrl = 'https://ani.gamer.com.tw/animeVideo.php?sn=123';
  const watchEndScripts = scriptsFor(watchUrl, 'document_end');
  const watchIdleScripts = scriptsFor(watchUrl, 'document_idle');
  const watchStyles = stylesFor(watchUrl);
  assert(watchEndScripts.includes('studio-credits.js'));
  assert(!watchEndScripts.includes('studio-catalog.js'));
  assert(!watchEndScripts.includes('hero-banner.js'));
  assert(!watchEndScripts.includes('opencc.js'));
  assert(watchIdleScripts.includes('opencc.js'));
  assert(!watchStyles.includes('hero-banner.css'));
  assert(!watchStyles.includes('home-dashboard.css'));
});

test('studio-catalog defers reading catalog JSON payloads until a helper is invoked', (t) => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://ani.gamer.com.tw/animeList.php',
    runScripts: 'outside-only',
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  let reads = 0;
  for (const [name, value] of [
    ['STUDIO_CATALOG_DATA', [[1, 10, '測試作品', ['ufotable']]]],
    ['STUDIO_PROFILE_DATA', { ufotable: ['幽浮社'] }],
    ['STUDIO_DIRECTORY_ICON_DATA', {}],
    ['STUDIO_LOGO_DATA', {}],
  ]) {
    Object.defineProperty(w, name, {
      configurable: true,
      get() {
        reads++;
        return value;
      },
    });
  }
  w.eval(fs.readFileSync('src/studio-catalog.js', 'utf8'));
  assert.equal(reads, 0);
  assert.equal(w.catalogStudiosForEpisode(10, ''), 'ufotable');
  assert(reads > 0);
});

test('home page skips hidden weekly schedule enhancement until switched to weekly view', (t) => {
  const dom = new JSDOM(
    `<div id="BH_background">
      <section id="blockVideoInSeason">
        <div class="nav-segment-control newanime-switch-page nav-choose-segment"></div>
        <div class="nav-segment-control textpage-switch-page"></div>
        <div class="newanime-wrap sort-selected">
          <div class="newanime-block">
            <div class="newanime-date-area">
              <a class="anime-card-block" href="animeRef.php?sn=99">
                <div class="anime-pic-block"><div class="anime-blocker"><img src="https://p2.bahamut.com.tw/B/ACG/cover.JPG"></div></div>
                <div class="anime-detail-block"><div class="anime-name">測試番劇</div></div>
              </a>
            </div>
          </div>
        </div>
        <div class="programlist-wrap newanime-content-hide">
          <div class="programlist-wrap_block">
            <div class="programlist-block">
              <div class="day-list today-list">
                <a class="text-anime-info" href="animeRef.php?sn=99"><span class="text-anime-name">測試番劇</span></a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>`,
    { url: 'https://ani.gamer.com.tw/', runScripts: 'outside-only', pretendToBeVisual: true },
  );
  t.after(() => dom.window.close());
  const w = dom.window;
  const d = w.document;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  for (const file of ['settings.js', 'content.js']) {
    w.eval(fs.readFileSync(`src/${file}`, 'utf8'));
  }

  assert.equal(d.querySelector('.ani-week-cover'), null);
  assert.equal(d.querySelector('.ani-week-marquee'), null);

  d.querySelector('.textpage-switch-page').click();
  const cover = d.querySelector('.ani-week-cover');
  assert(cover, 'weekly cover mounts when switched to weekly schedule');
  assert.equal(cover.loading, 'lazy');
  assert(d.querySelector('.ani-week-marquee'));
});

test('watch page defers ambient renderer creation until video frame is ready', (t) => {
  const dom = new JSDOM(
    `<div id="BH_background">
      <section class="player">
        <div class="videoframe">
          <div id="ani_video" class="video-js">
            <video></video>
            <div class="vjs-control-bar"><div class="control-bar-rightbtn"></div></div>
          </div>
        </div>
        <div class="subtitle"></div>
      </section>
    </div>`,
    { url: 'https://ani.gamer.com.tw/animeVideo.php?sn=123', runScripts: 'outside-only', pretendToBeVisual: true },
  );
  t.after(() => dom.window.close());
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  let created = 0;
  w.AniAmbientRenderer = {
    create() {
      created++;
      return { kind: 'canvas', acceleration: 'hardware', draw() { return true; }, destroy() {} };
    },
  };
  for (const file of ['settings.js', 'content.js']) {
    w.eval(fs.readFileSync(`src/${file}`, 'utf8'));
  }
  assert.equal(created, 0);
});

test('enhancements reuses resolved settings without duplicate storage get', async (t) => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://ani.gamer.com.tw/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  let storageGets = 0;
  w.chrome = {
    storage: {
      sync: {
        get(defaults, cb) {
          storageGets++;
          cb(defaults);
        },
      },
    },
  };
  w.__aniResolvedSettings = { themeEnabled: true, episodeThumbnailGrid: false };
  for (const file of ['settings.js', 'enhancements.js']) {
    w.eval(fs.readFileSync(`src/${file}`, 'utf8'));
  }
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(storageGets, 0);
});

test('home page hides late legacy score pills inside hours block even when cached top-left score is already visible', async (t) => {
  const dom = new JSDOM(
    `<div id="BH_background">
      <section id="blockVideoInSeason">
        <div class="newanime-wrap sort-selected">
          <div class="newanime-block">
            <div class="newanime-date-area">
              <a class="anime-card-block" href="animeRef.php?sn=101">
                <div class="anime-pic-block">
                  <div class="anime-blocker"><img src="https://p2.bahamut.com.tw/B/ACG/cover.JPG"></div>
                  <div class="anime-hours-block"><div class="anime-hours">17:00</div></div>
                </div>
                <div class="anime-detail-block"><div class="anime-name">測試新番</div></div>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>`,
    { url: 'https://ani.gamer.com.tw/', runScripts: 'outside-only', pretendToBeVisual: true },
  );
  t.after(() => dom.window.close());
  const w = dom.window;
  const d = w.document;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.localStorage.setItem('ani-ambilight-scores-v1', JSON.stringify({ 101: { s: '4.81', t: Date.now() } }));
  for (const file of ['settings.js', 'content.js']) {
    w.eval(fs.readFileSync(`src/${file}`, 'utf8'));
  }

  const badge = d.querySelector('.ani-score-badge-top-left');
  assert(badge && !badge.hidden, 'cached top-left score badge should render immediately');

  const hoursBlock = d.querySelector('.anime-hours-block');
  const legacyPill = d.createElement('span');
  legacyPill.textContent = '4.81';
  hoursBlock.append(legacyPill);

  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(legacyPill.style.display, 'none', 'late legacy rating pill inside hours block must be hidden');
  assert.notEqual(hoursBlock.style.display, 'none');
});
