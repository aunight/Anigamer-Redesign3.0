/**
 * Homepage Dashboard: AniGamer Footprint & Weather Widget.
 * Ported & adapted for Bahamut AniGamer from jiuyang5354/bilibili-margin (MIT License),
 * https://github.com/jiuyang5354/bilibili-margin
 */
(() => {
  'use strict';

  const FP_KEY = 'aniFootprintV1';
  const FP_VIEW_KEY = 'aniFootprintViewV1';
  const WX_LOC_KEY = 'aniWeatherLocV1';
  const WX_CACHE_KEY = 'aniWeatherCacheV1';
  const BEAT_MS = 15000;
  const ACTIVE_SEC = 60;
  const WX_TTL = 30 * 60 * 1000;
  const DEFAULT_LOC = { name: '台北市', region: '台灣', lat: 25.033, lon: 121.565, manual: false };
  const QUICK_CITIES = [
    { name: '台北市', region: '台灣', lat: 25.033, lon: 121.565 },
    { name: '新北市', region: '台灣', lat: 25.012, lon: 121.465 },
    { name: '基隆市', region: '台灣', lat: 25.128, lon: 121.741 },
    { name: '桃園市', region: '台灣', lat: 24.993, lon: 121.301 },
    { name: '新竹市', region: '台灣', lat: 24.803, lon: 120.968 },
    { name: '台中市', region: '台灣', lat: 24.147, lon: 120.673 },
    { name: '台南市', region: '台灣', lat: 22.999, lon: 120.227 },
    { name: '高雄市', region: '台灣', lat: 22.627, lon: 120.301 },
    { name: '花蓮縣', region: '台灣', lat: 23.987, lon: 121.601 },
    { name: '香港', region: 'HK', lat: 22.319, lon: 114.169 },
    { name: '東京', region: '日本', lat: 35.676, lon: 139.65 },
    { name: '大阪', region: '日本', lat: 34.693, lon: 135.502 },
  ];

  const pad2 = (n) => String(n).padStart(2, '0');
  const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const hhmm = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const deg = (n) => `${Math.round(n)}°`;
  const WEEK_ZH = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  const WEEK_1 = ['日', '一', '二', '三', '四', '五', '六'];
  const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const h = (tag, attrs, ...children) => {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'onclick' && typeof v === 'function') el.onclick = v;
        else if (k === 'disabled') el.disabled = Boolean(v);
        else el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    for (const c of children) {
      if (c === null || c === undefined || c === false) continue;
      el.append(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  };

  const fmtSec = (sec) => {
    const s = Math.round(sec || 0);
    if (s > 0 && s < 60) return '不到 1 分鐘';
    const hr = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return hr ? `${hr} 小時 ${m} 分` : `${m} 分鐘`;
  };

  // ── Storage bridge (extension storage.local + localStorage mirror for Userscript) ──
  const storageGet = async (key, fallback) => {
    let localVal = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) localVal = JSON.parse(raw);
    } catch {}
    if (globalThis.chrome?.storage?.local) {
      try {
        const res = await new Promise((resolve) =>
          chrome.storage.local.get({ [key]: localVal ?? fallback }, (out) => resolve(out?.[key]))
        );
        if (res && typeof res === 'object') return res;
      } catch {}
    }
    return localVal && typeof localVal === 'object' ? localVal : fallback;
  };

  const storageSet = async (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    if (globalThis.chrome?.storage?.local) {
      try {
        await new Promise((resolve) => chrome.storage.local.set({ [key]: value }, resolve));
      } catch {}
    }
  };

  let fpWriteQueue = Promise.resolve();
  const updateFootprint = (mutator) => {
    const job = fpWriteQueue.then(async () => {
      const data = { ...(await storageGet(FP_KEY, {})) };
      const changed = mutator(data);
      if (changed) {
        await storageSet(FP_KEY, data);
        window.dispatchEvent(new CustomEvent('ani-fp-updated', { detail: data }));
      }
      return data;
    }).catch(() => ({}));
    fpWriteQueue = job.then(() => {}, () => {});
    return job;
  };

  const recSeconds = (r) => Math.max(0, Number(r?.s || 0), Number(r?.h || 0));
  const recFirst = (r) => r?.f || r?.hf || null;
  const recActive = (r) => Number(r?.s || 0) >= ACTIVE_SEC || Number(r?.h || 0) >= ACTIVE_SEC;
  const recSource = (r) => (Number(r?.s || 0) > 0 ? 'local' : Number(r?.h || 0) > 0 ? 'history' : 'local');

  const computeThresholds = (values) => {
    const positive = values.filter((v) => v >= ACTIVE_SEC).sort((a, b) => a - b);
    if (positive.length < 14) return [900, 2700, 5400];
    const q = (p) => positive[Math.min(positive.length - 1, Math.floor(positive.length * p))];
    return [Math.max(ACTIVE_SEC, q(0.25)), Math.max(600, q(0.55)), Math.max(1800, q(0.82))];
  };
  const levelOf = (sec, thr) => {
    if (!sec || sec < 60) return 0;
    if (sec <= thr[0]) return 1;
    if (sec <= thr[1]) return 2;
    if (sec <= thr[2]) return 3;
    return 4;
  };

  // ── 1. Footprint Heartbeat Tracker (runs on all ani.gamer.com.tw pages when enabled) ──
  let trackTimer = null;
  let trackActive = false;
  let lastInputAt = Date.now();
  let lastBeatAt = 0;

  function startTracking(shouldTrack = true) {
    trackActive = Boolean(shouldTrack);
    if (!trackActive) {
      if (trackTimer) { clearInterval(trackTimer); trackTimer = null; }
      return;
    }
    if (trackTimer) return;
    for (const evName of ['pointermove', 'keydown', 'wheel', 'pointerdown', 'scroll']) {
      window.addEventListener(evName, () => { lastInputAt = Date.now(); }, { passive: true, capture: true });
    }
    const isPlaying = (requireAudio) =>
      [...document.querySelectorAll('video')].some(
        (v) => !v.paused && !v.ended && v.readyState > 2 && (!requireAudio || (!v.muted && v.volume > 0))
      );
    const isUserActive = () =>
      document.visibilityState === 'visible' ? Date.now() - lastInputAt < 90000 || isPlaying(false) : isPlaying(true);

    const recordOpen = () => {
      if (!trackActive || document.visibilityState !== 'visible') return;
      const now = new Date();
      const k = dayKey(now);
      const t = hhmm(now);
      void updateFootprint((data) => {
        const cur = data[k] || {};
        if (cur.f && cur.f <= t) return false;
        data[k] = { ...cur, f: cur.f && cur.f < t ? cur.f : t };
        return true;
      });
    };

    const recordBeat = () => {
      if (!trackActive || !isUserActive()) { lastBeatAt = 0; return; }
      const now = Date.now();
      const deltaSec = lastBeatAt && now - lastBeatAt <= 70000 ? Math.max(1, Math.round((now - lastBeatAt) / 1000)) : 15;
      lastBeatAt = now;
      const d = new Date(now);
      const k = dayKey(d);
      const t = hhmm(d);
      void updateFootprint((data) => {
        const cur = data[k] || {};
        const nextSec = Math.min(86400, (Number(cur.s) || 0) + deltaSec);
        data[k] = { ...cur, s: nextSec, f: cur.f && cur.f <= t ? cur.f : t };
        return true;
      });
    };

    const flush = () => {
      if (!trackActive || !lastBeatAt) return;
      const now = Date.now();
      if (now > lastBeatAt && now - lastBeatAt <= 70000 && (now - lastInputAt < 90000 || isPlaying(false))) {
        const add = Math.max(1, Math.round((now - lastBeatAt) / 1000));
        const d = new Date(now);
        const k = dayKey(d);
        void updateFootprint((data) => {
          const cur = data[k] || {};
          data[k] = { ...cur, s: Math.min(86400, (Number(cur.s) || 0) + add), f: cur.f || hhmm(d) };
          return true;
        });
      }
      lastBeatAt = 0;
    };

    lastBeatAt = isUserActive() ? Date.now() : 0;
    recordOpen();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
      else { lastBeatAt = isUserActive() ? Date.now() : 0; recordOpen(); }
    });
    window.addEventListener('pagehide', flush);
    trackTimer = setInterval(recordBeat, BEAT_MS);
  }

  // Conservative backfill from logged-in Bahamut AniGamer viewList.php
  async function syncBahamutHistory() {
    try {
      const resp = await fetch('https://ani.gamer.com.tw/viewList.php', { credentials: 'include', signal: AbortSignal.timeout(10000) });
      if (!resp.ok) return { status: 'fail', count: 0 };
      const html = await resp.text();
      if (/login\.php|尚未登入|會員登入/.test(html) && !/history-card|theme-list-main/.test(html)) {
        return { status: 'nologin', count: 0 };
      }
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const dates = {};
      for (const card of doc.querySelectorAll('.history-card, .theme-list-main, .user-watchTime-item, li')) {
        const txt = (card.textContent || '').trim();
        const m = txt.match(/(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})(?:\s+(\d{1,2}:\d{2}))?/);
        if (!m) continue;
        const k = `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
        dates[k] = {
          h: Math.min(3600, (dates[k]?.h || 0) + 1200),
          hf: m[4] ? (!dates[k]?.hf || m[4] < dates[k].hf ? m[4] : dates[k].hf) : dates[k]?.hf,
        };
      }
      const keys = Object.keys(dates);
      if (!keys.length) return { status: 'empty', count: 0 };
      await updateFootprint((data) => {
        let changed = false;
        for (const k of keys) {
          const cur = data[k] || {};
          const nextH = Math.max(Number(cur.h || 0), dates[k].h);
          const nextHf = cur.hf || dates[k].hf;
          if (nextH !== cur.h || nextHf !== cur.hf) {
            data[k] = { ...cur, h: nextH, ...(nextHf ? { hf: nextHf } : {}) };
            changed = true;
          }
        }
        return changed;
      });
      return { status: 'ok', count: keys.length };
    } catch {
      return { status: 'fail', count: 0 };
    }
  }

  // ── 2. Weather Pixel Sky & Glyphs (ported cleanly from jiuyang5354/bilibili-margin & 21st) ──
  const SKY_LAYERS = ['off', 'glow', 'star', 'moonDark', 'moon', 'sun', 'ray', 'heat', 'bird', 'snow', 'rain', 'bolt', 'cloud', 'cloudDark', 'fog', 'wind', 'hill', 'hz'];
  const WEATHER_SKIES = {
    clear: { birds: 2 },
    partly: { clouds: [{ x: 0.18, y: 0.24, size: 3 }, { x: 0.62, y: 0.42, size: 5 }] },
    cloud: { overcast: true, clouds: [{ x: 0.1, y: 0.24, size: 4 }, { x: 0.45, y: 0.4, size: 5, dark: true }, { x: 0.8, y: 0.2, size: 4 }, { x: 0.65, y: 0.62, size: 3 }] },
    drizzle: { overcast: true, rain: 0.3, clouds: [{ x: 0.3, y: 0.2, size: 5 }, { x: 0.75, y: 0.28, size: 4 }] },
    rain: { overcast: true, rain: 0.6, clouds: [{ x: 0.22, y: 0.2, size: 5, dark: true }, { x: 0.68, y: 0.3, size: 5, dark: true }] },
    storm: { overcast: true, rain: 1, thunder: true, wind: 0.5, clouds: [{ x: 0.12, y: 0.18, size: 6, dark: true }, { x: 0.52, y: 0.24, size: 6, dark: true }, { x: 0.92, y: 0.14, size: 5, dark: true }] },
    snow: { overcast: true, snow: 0.8, clouds: [{ x: 0.25, y: 0.14, size: 5 }, { x: 0.72, y: 0.2, size: 4 }] },
    sleet: { overcast: true, snow: 0.4, rain: 0.4, clouds: [{ x: 0.25, y: 0.16, size: 5, dark: true }, { x: 0.7, y: 0.22, size: 4 }] },
    mist: { mist: 0.8 },
    windy: { wind: 0.9, clouds: [{ x: 0.4, y: 0.26, size: 3 }] },
    heat: { heat: 1 },
  };
  const wrap = (v, n) => ((v % n) + n) % n;
  const clamp01 = (v) => Math.min(1, Math.max(0, v ?? 0));
  const FULL_MOON = Date.UTC(2026, 8, 26, 16, 49);
  const moonAge = (date) => {
    const a = (((date.getTime() - FULL_MOON) / 86400000 / 29.530589) + 0.5) % 1;
    return a < 0 ? a + 1 : a;
  };
  const moonLit = (dx, r, age) => {
    const lit = (1 - Math.cos(age * 2 * Math.PI)) / 2;
    const nx = dx / r;
    return age < 0.5 ? nx >= 1 - 2 * lit : nx <= -(1 - 2 * lit);
  };
  const isDayHr = (hr) => { const x = wrap(hr, 24); return x >= 6.5 && x <= 18.5; };

  function weatherScene({ cols, rows, horizon: hz, hour, sky, tick = 0 }) {
    const grid = new Map();
    const put = (x, y, layer) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= cols || y >= hz) return;
      grid.set(`${x},${y}`, layer);
    };
    const hr = wrap(hour, 24);
    const day = hr >= 6.5 && hr <= 18.5;
    const td = (hr - 6.5) / 12;
    const tn = wrap(hr - 18.5, 24) / 12;
    const arc = (t) => [3 + t * (cols - 7), hz - 1 - Math.sin(Math.PI * t) * (hz - 6)];
    const rain = clamp01(sky.rain), snow = clamp01(sky.snow), mist = clamp01(sky.mist), wind = clamp01(sky.wind), heat = clamp01(sky.heat);
    const covered = !!sky.overcast;
    if (day && (td < 0.12 || td > 0.88) && !covered) {
      for (let y = hz - 4; y < hz; y++) for (let x = 0; x < cols; x++) if ((x + y) % 2 === 0 && (y >= hz - 2 || x % 4 === 0)) put(x, y, 'glow');
    }
    if (!day && !covered) {
      for (let s = 0; s < 8; s++) if (wrap(tick + s * 3, 9) !== 0) put(wrap(s * 17 + 5, cols), wrap(s * 7 + 1, hz - 4), 'star');
    }
    if (!covered) {
      if (day) {
        const r = 2.6, [px, py] = arc(td), sx = Math.round(px), sy = Math.round(py);
        for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) if (dx * dx + dy * dy <= r * r + 0.3) put(sx + dx, sy + dy, 'sun');
        const dirs = wrap(tick, 4) < 2 ? [[0, -1], [0, 1], [-1, 0], [1, 0]] : [[-0.72, -0.72], [0.72, -0.72], [-0.72, 0.72], [0.72, 0.72]];
        for (const [ddx, ddy] of dirs) for (let k = r + 1.6; k <= r + 2.8; k += 1) put(sx + ddx * k, sy + ddy * k, 'ray');
        for (let b = 0; b < Math.min(2, Math.round(sky.birds ?? 0)); b++) {
          const bx = wrap(Math.floor(cols * 0.55) + b * 7 + Math.floor(tick / 2), cols + 4) - 2;
          const by = 4 + b * 3, up = wrap(tick, 2) === 0 ? 1 : 0;
          put(bx - 1, by - up, 'bird'); put(bx, by, 'bird'); put(bx + 1, by - up, 'bird');
        }
      } else {
        const r = 2.3, age = sky.moonPhase ?? 0.5, [qx, qy] = arc(tn), mx = Math.round(qx), my = Math.round(qy);
        for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) if (dx * dx + dy * dy <= r * r + 0.4) put(mx + dx, my + dy, moonLit(dx, r, age) ? 'moon' : 'moonDark');
      }
    }
    if (heat > 0) for (let x = 1; x < cols; x += 4) for (let y = hz - 6; y < hz; y++) if (wrap(y + tick, 3) === 0) put(x + wrap(y + tick, 2), y, 'heat');
    if (snow > 0) for (let f = 0; f < Math.round(snow * 16); f++) put(wrap(f * 13 + Math.round(Math.sin(tick / 3 + f)), cols), wrap(f * 7 + Math.floor(tick / 2), hz), 'snow');
    const drift = tick * (0.25 + wind * 0.7);
    const clouds = (sky.clouds ?? []).map((c) => {
      const w = Math.max(2, Math.round(c.size * 0.85));
      const cx = wrap(Math.round(c.x * cols + drift), cols + 2 * w + 4) - w - 2;
      return { cx, cy: Math.round(c.y * hz), w, layer: c.dark ? 'cloudDark' : 'cloud' };
    });
    if (rain > 0) {
      const step = rain > 0.7 ? 1 : 2, fast = rain > 0.7 ? 2 : 1, gap = rain < 0.4 ? 6 : 4;
      for (const { cx, cy, w } of clouds) for (let x = cx - w + 1; x <= cx + w - 1; x++) if (wrap(x, step) === 0) for (let y = cy + 2; y < hz; y++) if (wrap(y - tick * fast + x * 3, gap) === 0) put(x, y, 'rain');
    }
    if (sky.thunder && clouds.length && wrap(tick, 18) < 3 && wrap(tick, 18) !== 1) {
      let lx = (clouds[1] ?? clouds[0]).cx;
      for (let y = (clouds[1] ?? clouds[0]).cy + 2, s = 0; y < hz; y++, s++) { lx += wrap(s, 6) < 3 ? -1 : 1; put(lx, y, 'bolt'); put(lx + 1, y, 'bolt'); }
    }
    for (const { cx, cy, w, layer } of clouds) {
      for (let x = cx - w + 1; x <= cx + w - 1; x++) put(x, cy + 1, layer);
      for (let x = cx - w; x <= cx + w; x++) put(x, cy, layer);
      for (let x = cx - w + 1; x <= cx + w - 2; x++) put(x, cy - 1, layer);
      for (let x = cx - 1; x <= cx + 2; x++) put(x, cy - 2, layer);
      put(cx, cy - 3, layer); put(cx + 1, cy - 3, layer);
    }
    if (mist > 0) [2, 4, 7].forEach((d, i) => { for (let x = 0; x < cols; x++) if (wrap(x + (i % 2 ? -1 : 1) * Math.floor(tick / 2) + i * 3, 9) < 5) put(x, hz - d, 'fog'); });
    if (wind > 0.3) for (let g = 0; g < 4; g++) { const wy = 2 + wrap(g * 5, hz - 4), wx = wrap(g * 17 + tick * 2, cols + 8) - 4; for (let k = 0; k < 3; k++) put(wx + k, wy, 'wind'); }
    for (let x = 0; x < cols; x++) {
      const hill = Math.max(0, Math.round(3 - Math.abs(x - cols * 0.8) / 2.4)) + Math.max(0, Math.round(1.6 - Math.abs(x - cols * 0.12) / 2.2));
      for (let y = hz - hill; y < hz; y++) grid.set(`${x},${y}`, 'hill');
      grid.set(`${x},${hz}`, 'hz');
    }
    const out = Object.fromEntries(SKY_LAYERS.map((l) => [l, '']));
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) out[grid.get(`${x},${y}`) ?? 'off'] += `M${x * 8 + 1} ${y * 8 + 1}h6v6h-6Z`;
    return out;
  }

  const MINI_GLYPHS = {
    sun: ['...S...', '.S...S.', '..SSS..', 'S.SSS.S', '..SSS..', '.S...S.', '...S...'],
    moon: ['..MMM..', '.MM....', 'MM.....', 'MM.....', 'MM.....', '.MM....', '..MMM..'],
    partly: ['S.S....', '.SSS...', 'SSSCC..', '.SCCCC.', 'CCCCCCC', '.CCCCC.', '.......'],
    partlyNight: ['MM.....', 'M......', 'M..CC..', 'MMCCCC.', 'CCCCCCC', '.CCCCC.', '.......'],
    cloud: ['.......', '..CC...', '.CCCCC.', 'CCCCCCC', 'CCCCCCC', '.CCCCC.', '.......'],
    drizzle: ['..CC...', '.CCCCC.', 'CCCCCCC', '.CCCCC.', '.......', '.R...R.', '...R...'],
    rain: ['..DD...', '.DDDDD.', 'DDDDDDD', '.DDDDD.', '.......', '.R.R.R.', 'R.R.R..'],
    storm: ['..DD...', '.DDDDD.', 'DDDDDDD', '..Z...R', '.ZZ..R.', '..Z....', '.Z.....'],
    snow: ['N..N..N', '.......', '.N..N..', '.......', 'N..N..N', '.......', '.N..N..'],
    sleet: ['..DD...', '.DDDDD.', 'DDDDDDD', '.DDDDD.', '.......', '.N.R.N.', 'R.N.R..'],
    mist: ['FFFFF..', '.......', '..FFFFF', '.......', 'FFFFF..', '.......', '.FFFFFF'],
    windy: ['WWWWW..', '.....W.', 'WWWWW..', '.......', 'WWWWWW.', '......W', 'WWWW...'],
    heat: ['.SSS...', 'SSSSS..', '.SSS...', '.......', 'S.S.S.S', '.S.S.S.', '.......'],
  };
  const MINI_LAYER = { S: 'sun', M: 'moon', C: 'cloud', D: 'cloudDark', R: 'rain', Z: 'bolt', F: 'fog', N: 'snow', W: 'wind' };
  const GLYPH_LAYERS = ['sun', 'moon', 'cloud', 'cloudDark', 'rain', 'bolt', 'fog', 'snow', 'wind'];
  function glyphSvg(kind, hr = 12) {
    const day = isDayHr(hr);
    const key = kind === 'clear' ? (day ? 'sun' : 'moon') : kind === 'partly' && !day ? 'partlyNight' : kind;
    const paths = Object.fromEntries(GLYPH_LAYERS.map((l) => [l, '']));
    (MINI_GLYPHS[key] ?? MINI_GLYPHS.cloud).forEach((row, y) => {
      [...row].forEach((c, x) => { const l = MINI_LAYER[c]; if (l) paths[l] += `M${x * 3 + 0.3} ${y * 3 + 0.3}h2.4v2.4h-2.4Z`; });
    });
    return `<svg class="ani-wx-glyph" viewBox="0 0 21 21" shape-rendering="crispEdges" aria-hidden="true">${GLYPH_LAYERS.map((l) => (paths[l] ? `<path class="i-${l}" d="${paths[l]}"/>` : '')).join('')}</svg>`;
  }

  const wmoInfo = (code) => {
    if (code === 0) return ['clear', '晴朗'];
    if (code === 1) return ['partly', '大致晴朗'];
    if (code === 2) return ['partly', '多雲'];
    if (code === 3) return ['cloud', '陰天'];
    if (code === 45 || code === 48) return ['mist', '霧'];
    if (code >= 51 && code <= 55) return ['drizzle', '毛毛雨'];
    if (code === 56 || code === 57 || code === 66 || code === 67) return ['sleet', '凍雨'];
    if (code === 61 || code === 80) return ['rain', '小雨'];
    if (code === 63 || code === 81) return ['rain', '中雨'];
    if (code === 65 || code === 82) return ['rain', '大雨'];
    if (code >= 71 && code <= 77) return ['snow', '降雪'];
    if (code >= 85 && code <= 86) return ['snow', '陣雪'];
    if (code >= 95) return ['storm', '雷雨'];
    return ['cloud', '多雲'];
  };

  async function externalJson(workerType, payload, directUrl) {
    if (globalThis.chrome?.runtime?.id) {
      try {
        const reply = await chrome.runtime.sendMessage({ type: workerType, ...payload });
        if (reply?.ok && reply.data) return reply.data;
      } catch {}
    }
    if (typeof GM_xmlhttpRequest === 'function') {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET', url: directUrl, timeout: 10000,
          onload: (r) => { try { resolve(JSON.parse(r.responseText)); } catch { reject(new Error('parse')); } },
          onerror: () => reject(new Error('network')),
          ontimeout: () => reject(new Error('timeout')),
        });
      });
    }
    const r = await fetch(directUrl, { signal: AbortSignal.timeout(9000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  const CITY_ZH = {
    'taipei': '台北市', 'new taipei': '新北市', 'keelung': '基隆市', 'taoyuan': '桃園市',
    'hsinchu': '新竹市', 'taichung': '台中市', 'changhua': '彰化縣', 'tainan': '台南市',
    'kaohsiung': '高雄市', 'pingtung': '屏東縣', 'yilan': '宜蘭縣', 'hualien': '花蓮縣',
    'taitung': '台東縣', 'hong kong': '香港', 'tokyo': '東京', 'osaka': '大阪',
  };
  const localizeCity = (name) => CITY_ZH[String(name || '').trim().toLowerCase()] || String(name || '台北市');

  async function resolveWeatherLoc() {
    const saved = await storageGet(WX_LOC_KEY, null);
    if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon)) {
      const normalized = { ...saved, name: saved.manual ? saved.name : localizeCity(saved.name) };
      if (saved.manual || (saved.at && Date.now() - saved.at < 12 * 3600 * 1000)) return normalized;
    }
    try {
      const ip = await Promise.race([
        externalJson('ani-fetch-ip', {}, 'https://ipwho.is/?fields=success,city,latitude,longitude'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('ip-timeout')), 2000)),
      ]);
      if (ip?.success && Number.isFinite(ip.latitude) && Number.isFinite(ip.longitude)) {
        const next = { name: localizeCity(ip.city), region: '', lat: ip.latitude, lon: ip.longitude, manual: false, at: Date.now() };
        await storageSet(WX_LOC_KEY, next);
        return next;
      }
    } catch {}
    return saved || DEFAULT_LOC;
  }

  async function fetchWeather(loc, force = false) {
    try {
      const c = JSON.parse(localStorage.getItem(WX_CACHE_KEY) || 'null');
      if (!force && c && c.loc?.lat === loc.lat && c.loc?.lon === loc.lon && Date.now() - c.at < WX_TTL) return c;
    } catch {}
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&timezone=auto&forecast_days=5&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min`;
    const d = await externalJson('ani-fetch-weather', { lat: loc.lat, lon: loc.lon }, url);
    if (!d?.current || !Array.isArray(d.hourly?.time) || !Array.isArray(d.daily?.time)) throw new Error('天氣資料不完整');
    const offset = Number(d.utc_offset_seconds) || 0;
    const nowH = new Date(`${String(d.current.time).slice(0, 13)}:00Z`).getTime();
    let i0 = d.hourly.time.findIndex((t) => new Date(`${t}Z`).getTime() >= nowH);
    if (i0 < 0) i0 = 0;
    const hours = [];
    for (let k = 0; k < 6; k++) {
      const idx = i0 + k * 3;
      if (idx >= d.hourly.time.length) break;
      const hr = Number(d.hourly.time[idx].slice(11, 13));
      hours.push({ label: k === 0 ? '現在' : pad2(hr), hour: hr, kind: wmoInfo(d.hourly.weather_code[idx])[0], temp: d.hourly.temperature_2m[idx] });
    }
    const days = d.daily.time.map((t, i) => ({
      name: i === 0 ? '今天' : i === 1 ? '明天' : `週${WEEK_1[new Date(`${t}T00:00Z`).getUTCDay()]}`,
      kind: wmoInfo(d.daily.weather_code[i])[0],
      low: d.daily.temperature_2m_min[i],
      high: d.daily.temperature_2m_max[i],
    }));
    const [kind, condition] = wmoInfo(d.current.weather_code);
    const wx = {
      loc, temp: d.current.temperature_2m, feels: d.current.apparent_temperature, wind: d.current.wind_speed_10m,
      rainPct: d.hourly.precipitation_probability?.[i0] ?? 0, kind, condition, offset, hours, days, at: Date.now(),
    };
    try { localStorage.setItem(WX_CACHE_KEY, JSON.stringify(wx)); } catch {}
    return wx;
  }

  // ── 3. UI Builders (Footprint Card & Weather Card) ──
  function createFootprintCard() {
    const el = h('section', { class: 'ani-fp-card', 'aria-label': '動畫瘋足跡' });
    const tip = h('div', { class: 'ani-fp-tip', hidden: '' });
    let view = 'year';
    try { if (localStorage.getItem(FP_VIEW_KEY) === 'month') view = 'month'; } catch {}
    let monthAt = new Date(); monthAt.setDate(1); monthAt.setHours(0, 0, 0, 0);
    let picked = null, syncMsg = '（本機紀錄即時統計 · 僅保存於此裝置瀏覽器）';
    let activity = {}, ro = null, syncing = false;

    const paint = (data) => {
      activity = data || {};
      tip.hidden = true;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const start = new Date(today); start.setDate(start.getDate() - 364 - today.getDay());
      const todayK = dayKey(today), yearAgo = dayKey(new Date(+today - 364 * 864e5));
      const thr = computeThresholds(Object.keys(activity).filter((k) => k >= yearAgo && k <= todayK).map((k) => recSeconds(activity[k])));
      const totalDays = Math.round((+today - +start) / 864e5) + 1 + (6 - today.getDay());
      const cells = [], months = [];
      let active = 0, total = 0, best = 0, run = 0, lastMonth = -1;
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const k = dayKey(d), rec = activity[k], s = recSeconds(rec), future = d > today;
        const on = !future && recActive(rec);
        if (!future) { if (on) { active++; total += s; run++; best = Math.max(best, run); } else run = 0; }
        if (d.getDate() <= 7 && d.getDay() === 0 && d.getMonth() !== lastMonth) { months.push([Math.floor(i / 7), d.getMonth() + 1]); lastMonth = d.getMonth(); }
        if (view === 'year') {
          const c = h('i', { class: `ani-fp-cell${future ? ' future' : ''}${+d === +today ? ' today' : ''}`, 'data-k': k, 'data-l': future ? '0' : String(levelOf(s, thr)) });
          cells.push(c);
        }
      }
      let streak = 0;
      for (let i = 0; ; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        if (recActive(activity[dayKey(d)])) streak++;
        else if (i > 0) break;
      }
      const pk = view === 'month' && picked ? picked : todayK;
      const t = activity[pk], pd = new Date(`${pk}T00:00:00`);
      const pLabel = pk === todayK ? '今日' : `${pd.getMonth() + 1}月${pd.getDate()}日`;
      const stat = (nodes, label) => h('div', { class: 'ani-fp-stat' }, h('b', {}, ...(Array.isArray(nodes) ? nodes : [nodes])), h('small', {}, label));
      const fmtSecNodes = (sec) => {
        const mins = Math.floor((sec || 0) / 60);
        if (mins < 1) return [sec > 0 ? '<1' : '0', h('span', { class: 'ani-fp-unit' }, ' 分鐘')];
        if (mins < 60) return [String(mins), h('span', { class: 'ani-fp-unit' }, ' 分鐘')];
        const hr = Math.floor(mins / 60), rm = mins % 60;
        return rm
          ? [String(hr), h('span', { class: 'ani-fp-unit' }, ' 小時 '), String(rm), h('span', { class: 'ani-fp-unit' }, ' 分')]
          : [String(hr), h('span', { class: 'ani-fp-unit' }, ' 小時')];
      };
      const fmtTime12Nodes = (hhmmStr) => {
        if (!hhmmStr || !/^\d{1,2}:\d{2}$/.test(hhmmStr)) return ['—'];
        const [rawH, rawM] = hhmmStr.split(':');
        const h24 = Number(rawH);
        const ampm = h24 >= 12 ? 'pm' : 'am';
        const h12 = h24 % 12 || 12;
        return [`${h12}:${rawM}`, h('span', { class: 'ani-ampm-unit' }, ampm)];
      };
      const segBtn = (v, label) => h('button', {
        type: 'button', class: 'ani-fp-seg-b', 'aria-pressed': String(view === v),
        onclick: () => { if (view === v) return; view = v; try { localStorage.setItem(FP_VIEW_KEY, v); } catch {} paint(activity); },
      }, label);
      const weeks = Math.ceil(cells.length / 7);
      const graph = h('div', { class: 'ani-fp-graph' },
        h('div', { class: 'ani-fp-months', style: `width:calc(${weeks} * (var(--c) + var(--gp)))` },
          ...months.filter(([w]) => weeks - w >= 3).map(([w, m]) => h('span', { style: `left:calc(${w} * (var(--c) + var(--gp)))` }, `${m}月`))),
        h('div', { class: 'ani-fp-days' }, ...['', '一', '', '三', '', '五', ''].map((x) => h('span', {}, x))),
        h('div', { class: 'ani-fp-cells' }, ...cells)
      );

      let mainVisual = graph;
      if (view === 'month') {
        const y = monthAt.getFullYear(), m = monthAt.getMonth(), daysInMonth = new Date(y, m + 1, 0).getDate();
        const isThisMonth = y === today.getFullYear() && m === today.getMonth();
        const prevOff = +new Date(y, m, 1) <= +new Date(today.getFullYear() - 1, today.getMonth(), 1);
        const strip = h('div', { class: 'ani-fp-strip' });
        let selCol = null;
        for (let i = 1; i <= daysInMonth; i++) {
          const d = new Date(y, m, i), k = dayKey(d), future = d > today, rec = activity[k], s = recSeconds(rec);
          const b = h('button', {
            type: 'button', class: 'ani-fp-day-b', disabled: future, 'aria-pressed': String(picked === k),
            'data-l': future ? '0' : String(levelOf(s, thr)), 'data-k': k, ...(+(d) === +(today) ? { 'data-today': '' } : {}),
            title: `${m + 1}月${i}日${s ? ` · ${fmtSec(s)}` : ''}`,
            onclick: () => { picked = picked === k ? null : k; paint(activity); },
          }, String(i));
          const col = h('div', { class: 'ani-fp-day' }, h('span', {}, WEEK_1[d.getDay()]), b);
          if (picked === k || (!picked && +d === +today)) selCol = col;
          strip.append(col);
        }
        requestAnimationFrame(() => { if (selCol && strip.isConnected) strip.scrollLeft = selCol.offsetLeft - strip.clientWidth / 2 + selCol.offsetWidth / 2; });
        mainVisual = h('div', { class: 'ani-fp-month' },
          h('div', { class: 'ani-fp-mhead' },
            h('p', { class: 'ani-fp-mname' }, h('span', { class: 'en' }, MONTH_EN[m]), h('small', {}, `${y} 年 ${m + 1} 月`)),
            h('div', { class: 'ani-fp-mnav' },
              h('button', { type: 'button', 'aria-label': '上個月', disabled: prevOff, onclick: () => { monthAt = new Date(y, m - 1, 1); picked = null; paint(activity); } }, '‹'),
              h('button', { type: 'button', 'aria-label': '下個月', disabled: isThisMonth, onclick: () => { monthAt = new Date(y, m + 1, 1); picked = null; paint(activity); } }, '›'))),
          strip
        );
      }

      const syncBtn = h('button', {
        type: 'button', class: 'ani-fp-sync-btn', disabled: syncing,
        onclick: async () => {
          if (syncing) return;
          syncing = true;
          syncMsg = '正在讀取巴哈觀看紀錄…';
          paint(activity);
          const res = await syncBahamutHistory();
          syncing = false;
          syncMsg = res.status === 'ok' ? `已從觀看紀錄補全 ${res.count} 天紀錄（本機紀錄優先）`
            : res.status === 'nologin' ? '未登入巴哈帳號，目前僅顯示本機統計'
            : res.status === 'empty' ? '觀看紀錄尚無可補全日期，將持續以本機紀錄統計'
            : '觀看紀錄暫時無法讀取，將持續以本機紀錄統計';
          const fresh = await storageGet(FP_KEY, {});
          paint(fresh);
        },
      }, syncing ? '同步中…' : '同步紀錄');

      const legend = h('span', { class: 'ani-fp-legend' }, '少', ...[0, 1, 2, 3, 4].map((l) => h('i', { class: 'ani-fp-cell', 'data-l': String(l) })), '多');

      el.dataset.view = view;
      el.replaceChildren(
        h('div', { class: 'ani-fp-side' },
          h('div', { class: 'ani-fp-top' },
            h('div', { class: 'ani-fp-eyebrow' }, h('strong', {}, '動畫瘋足跡'), h('span', {}, view === 'year' ? '近一年' : '按月')),
            h('div', { class: 'ani-fp-seg', role: 'group', 'aria-label': '視圖' }, segBtn('year', '年'), segBtn('month', '月'))),
          h('h3', { class: 'ani-fp-head' }, String(active), h('span', { class: 'ani-fp-head-unit' }, ' 天打開過動畫瘋')),
          h('div', { class: 'ani-fp-stats' },
            stat(fmtTime12Nodes(recFirst(t)), `${pLabel}首次打開`),
            stat(fmtSecNodes(recSeconds(t)), `${pLabel}時長`),
            stat(fmtSecNodes(total), '近一年累計'),
            stat([String(streak), h('span', { class: 'ani-fp-unit' }, ' 天')], `目前連續 · 最長 ${best} 天`))),
        h('div', { class: 'ani-fp-main' }, mainVisual,
          h('div', { class: 'ani-fp-foot' },
            h('span', { class: 'ani-fp-status', role: 'status' }, syncMsg),
            syncBtn,
            legend)),
        tip
      );

      ro?.disconnect();
      if (view === 'year') {
        let lastWidth = -1;
        const fit = ([entry]) => {
          if (!graph.isConnected || !graph.parentElement) return;
          const w = entry.contentRect.width;
          if (w === lastWidth) return;
          lastWidth = w;
          tip.hidden = true;
          const per = Math.floor((w - 34) / weeks);
          const gp = per < 12 ? 2 : 3;
          const cs = Math.max(6, Math.min(18, per - gp));
          graph.style.setProperty('--c', `${cs}px`);
          graph.style.setProperty('--gp', `${gp}px`);
          requestAnimationFrame(() => { graph.scrollLeft = graph.scrollWidth; });
        };
        ro = new ResizeObserver(fit);
        ro.observe(graph.parentElement);
        graph.onpointerover = (e) => {
          const c = e.target?.closest?.('.ani-fp-cells .ani-fp-cell');
          if (!c || c.classList.contains('future')) { tip.hidden = true; return; }
          const k = c.dataset.k, r = activity[k], d = new Date(`${k}T00:00:00`), s = recSeconds(r), f = recFirst(r);
          tip.replaceChildren(
            h('b', {}, `${d.getMonth() + 1}月${d.getDate()}日 ${WEEK_ZH[d.getDay()]}`),
            h('br'),
            ...(s || f ? [`首次打開 ${f ?? '—'} · 時長 ${fmtSec(s)}`, h('br'), h('small', {}, `${recSource(r) === 'local' ? '本機即時紀錄' : '觀看歷史補全'}${recActive(r) ? '' : ' · 未滿 1 分鐘不計入天數'}`)]
              : [h('small', {}, '尚無紀錄 · 尚未開啟或累積滿 1 分鐘')])
          );
          tip.hidden = false;
          const b = c.getBoundingClientRect(), card = el.getBoundingClientRect();
          const cx = b.left + b.width / 2 - card.left;
          const left = Math.max(8, Math.min(el.clientWidth - tip.offsetWidth - 8, cx - tip.offsetWidth / 2));
          const above = b.top - card.top - 8 - tip.offsetHeight;
          tip.style.left = `${Math.round(left)}px`;
          tip.style.top = `${Math.round(above >= 8 ? above : b.bottom - card.top + 8)}px`;
        };
        graph.onpointerleave = () => { tip.hidden = true; };
      }
    };

    const onUpdate = (ev) => { if (el.isConnected) paint(ev.detail || activity); };
    window.addEventListener('ani-fp-updated', onUpdate);
    el._aniDispose = () => { ro?.disconnect(); window.removeEventListener('ani-fp-updated', onUpdate); };
    storageGet(FP_KEY, {}).then((data) => { if (el.isConnected) paint(data); });
    return el;
  }

  function createWeatherCard() {
    const el = h('section', { class: 'ani-wx-card', 'aria-label': '天氣實況' });
    el.append(h('div', { class: 'ani-wx-sky sk' }), h('div', { class: 'ani-wx-side' }));
    let wx = null, tick = 0, visible = false, animTimer = null, clockTimer = null;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const GRID = { cols: 30, rows: 26, horizon: 19 };

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${GRID.cols * 8} ${GRID.rows * 8}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMax slice');
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('aria-hidden', 'true');
    const layers = new Map();
    for (const l of SKY_LAYERS) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('class', `s-${l}`);
      layers.set(l, p); svg.append(p);
    }

    const clockParts = () => {
      const d = new Date(Date.now() + (wx?.offset ?? 28800) * 1000);
      const h24 = d.getUTCHours();
      const ampm = h24 >= 12 ? 'pm' : 'am';
      const h12 = h24 % 12 || 12;
      return [`${h12}:${pad2(d.getUTCMinutes())}`, h('span', { class: 'ani-ampm-unit' }, ampm)];
    };
    const localHour = () => {
      const d = new Date(Date.now() + (wx?.offset ?? 28800) * 1000);
      return d.getUTCHours() + d.getUTCMinutes() / 60;
    };
    const paintSky = () => {
      if (!wx) return;
      const p = weatherScene({ ...GRID, hour: localHour(), sky: { ...(WEATHER_SKIES[wx.kind] || WEATHER_SKIES.partly), moonPhase: moonAge(new Date()) }, tick });
      for (const [l, pathEl] of layers) {
        const d = p[l] || '';
        if (pathEl.getAttribute('d') !== d) {
          if (d) pathEl.setAttribute('d', d);
          else pathEl.removeAttribute('d');
        }
      }
    };

    const clockEl = h('span', { class: 'ani-wx-clock' }, ...clockParts());
    const stopTimers = () => {
      if (animTimer) { clearInterval(animTimer); animTimer = null; }
      if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
    };
    const startTimers = () => {
      stopTimers();
      if (!wx || !visible || document.hidden || !el.isConnected) return;
      clockEl.replaceChildren(...clockParts());
      clockTimer = setInterval(() => {
        clockEl.replaceChildren(...clockParts());
        if (reduced) paintSky();
      }, 15000);
      if (!reduced) {
        animTimer = setInterval(() => {
          if (!document.hidden && visible) { tick++; paintSky(); }
        }, 180);
      }
    };

    let closePicker = null;
    const openPicker = (anchorBtn) => {
      closePicker?.();
      const input = h('input', { type: 'search', class: 'ani-wx-city-input', placeholder: '輸入城市名，例如 台北 / 高雄 / 東京' });
      const list = h('div', { class: 'ani-wx-city-list' });
      const picker = h('div', { class: 'ani-wx-city-picker' }, input, list);
      closePicker = () => { closePicker = null; picker.remove(); };
      const pick = async (loc) => {
        const next = { ...loc, manual: true, at: Date.now() };
        await storageSet(WX_LOC_KEY, next);
        localStorage.removeItem(WX_CACHE_KEY);
        closePicker?.();
        loadWeather(next, true);
      };
      const showCities = (items) => {
        list.replaceChildren(...items.map((c) => h('button', {
          type: 'button', class: 'ani-wx-city-opt',
          onclick: () => void pick(c),
        }, h('b', {}, c.name), h('small', {}, c.region || ''))));
      };
      showCities(QUICK_CITIES);
      let qTimer = 0;
      input.addEventListener('input', () => {
        clearTimeout(qTimer);
        const q = input.value.trim();
        if (!q) { showCities(QUICK_CITIES); return; }
        const localMatches = QUICK_CITIES.filter((c) => c.name.includes(q));
        if (localMatches.length) showCities(localMatches);
        qTimer = setTimeout(async () => {
          try {
            const url = `https://geocoding-api.open-meteo.com/v1/search?count=6&language=zh&name=${encodeURIComponent(q)}`;
            const res = await externalJson('ani-search-city', { q }, url);
            const arr = (res?.results || []).map((g) => ({
              name: g.name,
              region: [g.admin1, g.country].filter((s) => s && s !== g.name).join(' · '),
              lat: g.latitude,
              lon: g.longitude,
            }));
            if (arr.length && picker.isConnected) showCities(arr);
          } catch {}
        }, 260);
      });
      picker.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePicker?.(); anchorBtn.focus(); } });
      el.append(picker);
      input.focus();
    };

    const renderWeather = () => {
      if (!wx) return;
      const w = wx;
      const skyBox = h('div', { class: 'ani-wx-sky', role: 'img', 'aria-label': `${w.loc.name} ${w.condition} ${deg(w.temp)}` },
        svg,
        h('div', { class: 'ani-wx-now' }, h('span', { class: 'ani-wx-temp' }, deg(w.temp)), h('span', { class: 'ani-wx-cond' }, w.condition))
      );
      const cityBtn = h('button', { type: 'button', class: 'ani-wx-city', title: '點擊切換城市', onclick: () => openPicker(cityBtn) }, w.loc.name);
      const subTxt = [w.wind !== null ? `${Math.round(w.wind)} km/h` : '', w.feels !== null ? `體感 ${deg(w.feels)}` : '', w.rainPct !== null ? `降雨 ${w.rainPct}%` : ''].filter(Boolean).join(' · ');

      const hours = h('ol', { class: 'ani-wx-hours' });
      hours.innerHTML = (w.hours || []).map((x) => `<li><span class="ani-wx-hl">${x.label}</span>${glyphSvg(x.kind, x.hour)}<b>${deg(x.temp)}</b></li>`).join('');

      const days = (w.days || []).slice(0, 3);
      const lo = Math.floor(Math.min(...days.map((d) => d.low), w.temp));
      const hi = Math.ceil(Math.max(...days.map((d) => d.high), w.temp));
      const span = Math.max(1, Math.min(20, hi - lo));
      const mkBar = (low, high, cur) => {
        let off = '', lit = '', now = '';
        for (let t = lo; t <= lo + span; t++) {
          const d = `M${(t - lo) * 8 + 1} 0h6v6h-6Z`;
          if (cur !== undefined && t === Math.round(cur)) now += d;
          else if (t >= Math.round(low) && t <= Math.round(high)) lit += d;
          else off += d;
        }
        return `<svg class="ani-wx-bar" viewBox="0 0 ${(span + 1) * 8} 6" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true"><path class="b-off" d="${off}"/><path class="b-lit" d="${lit}"/><path class="b-now" d="${now}"/></svg>`;
      };
      const week = h('ul', { class: 'ani-wx-week' });
      week.innerHTML = days.map((d, i) => `<li data-kind="${d.kind}"><span class="ani-wx-dn">${d.name}</span>${glyphSvg(d.kind)}<span class="ani-wx-lo">${deg(d.low)}</span>${mkBar(d.low, d.high, i === 0 ? w.temp : undefined)}<span class="ani-wx-hi">${deg(d.high)}</span></li>`).join('');

      clockEl.replaceChildren(...clockParts());
      const side = h('div', { class: 'ani-wx-side' },
        h('header', { class: 'ani-wx-head' },
          h('div', { class: 'ani-wx-place' }, cityBtn, h('small', {}, subTxt)),
          h('div', { class: 'ani-wx-live' }, h('i', { class: 'ani-wx-led' }), h('span', {}, 'Open-Meteo'), clockEl)),
        hours, week
      );
      el.replaceChildren(skyBox, side);
      paintSky();
      startTimers();
    };

    const loadWeather = async (customLoc = null, force = false) => {
      try {
        const loc = customLoc || (await resolveWeatherLoc());
        wx = await fetchWeather(loc, force);
        if (el.isConnected) {
          delete el.dataset.aniWxErr;
          renderWeather();
        }
      } catch (err) {
        el.dataset.aniWxErr = String(err?.message || err || 'unknown');
        console.warn('[Anigamer-Redesign] weather failed:', err);
        if (!el.isConnected) return;
        const choose = h('button', { type: 'button', class: 'ani-wx-retry', onclick: () => openPicker(choose) }, '選擇城市');
        const retry = h('button', { type: 'button', class: 'ani-wx-retry', onclick: () => loadWeather(customLoc, true) }, '重試');
        el.replaceChildren(h('div', { class: 'ani-wx-empty' }, h('p', {}, '天氣資料暫時無法取得'), h('div', { class: 'ani-wx-recovery' }, choose, retry)));
      }
    };

    const io = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) startTimers(); else stopTimers(); })
      : null;
    if (io) io.observe(el);
    else visible = true;
    el._aniDispose = () => { stopTimers(); io?.disconnect(); };
    void loadWeather();
    return el;
  }

  function mount(opts = {}) {
    const isHome = location.pathname === '/' || location.pathname === '/index.php';
    const themeEnabled = opts.themeEnabled !== false;
    const showFp = opts.showFootprint !== false;
    const showWx = opts.showWeather !== false;

    startTracking(showFp);

    const existing = document.querySelector('#BH_background .ani-home-dash');
    if (!isHome || !themeEnabled || (!showFp && !showWx)) {
      if (existing) {
        existing.querySelectorAll('section').forEach((s) => s._aniDispose?.());
        existing.remove();
      }
      return;
    }

    const bgRoot = document.querySelector('#BH_background');
    const hero = document.querySelector('#BH_background .big_banner, .ani-hero-banner, .big_banner');
    const containerHost =
      document.querySelector('#BH_background > .container') ||
      document.querySelector('#BH_background > .animate-content') ||
      bgRoot ||
      document.querySelector('.animate-content');
    if (!containerHost) return;

    let dash = existing;
    if (!dash) {
      dash = document.createElement('div');
      dash.className = 'ani-home-dash';
    }
    if (hero && hero.parentElement) {
      if (dash.previousElementSibling !== hero) hero.after(dash);
    } else if (!dash.isConnected) {
      const anchor = containerHost.querySelector('#blockContinueWatch, #blockVideoInSeason');
      if (anchor) anchor.before(dash);
      else containerHost.prepend(dash);
    }

    const curFp = dash.querySelector('.ani-fp-card');
    const curWx = dash.querySelector('.ani-wx-card');
    if (showFp && !curFp) {
      dash.prepend(createFootprintCard());
    } else if (!showFp && curFp) {
      curFp._aniDispose?.();
      curFp.remove();
    }
    if (showWx && !curWx) {
      dash.append(createWeatherCard());
    } else if (!showWx && curWx) {
      curWx._aniDispose?.();
      curWx.remove();
    }
  }

  globalThis.AniHomeDashboard = { mount, startTracking };
})();
