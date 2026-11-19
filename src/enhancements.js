(() => {
  'use strict';

  // ── Shared Storage, Settings, Sanitization & Toast Helpers ──
  const SETTINGS_KEY = 'aniAmbientSettingsV1';
  const COL_STATUS_KEY = 'aniCollectionStatesV1';
  const PERM_HIST_KEY = 'aniPermanentHistoryV1';
  const TAG_CACHE_KEY = 'aniTagCacheV1';
  const CAT_EXCLUDE_KEY = 'aniCatalogExcludeV1';
  const WORK_META_CACHE_KEY = 'aniWorkMetaCacheV1';
  const LOCAL_MUTE_KEY = 'aniLocalMutedSendersV1';
  const EP_TITLES_CACHE_KEY = 'aniEpTitlesCacheV1';
  const OFFSHELF_CACHE_KEY = 'aniOffshelfCacheV1';
  const TAG_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const WORK_META_TTL_MS = 14 * 24 * 60 * 60 * 1000;

  const COL_STATUS_META = [
    ['plan', '待看'],
    ['watching', '追番中'],
    ['completed', '已看完'],
    ['paused', '暫停'],
  ];
  const COL_STATUS_MAP = Object.fromEntries(COL_STATUS_META);

  const enhIcon = (inner, size = 15) =>
    `<svg class="ani-enh-svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

  const COL_STATUS_ICONS = {
    all: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    plan: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    watching: '<polygon points="6 4 20 12 6 20 6 4"/>',
    completed: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
    paused: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    unset: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1"/>',
    clear: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    add: '<path d="M12 5v14M5 12h14"/>',
  };

  const ORIGIN_ICONS = {
    all: COL_STATUS_ICONS.all,
    manga: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    light_novel: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M9 2v7l2.5-1.5L14 9V2"/>',
    game: '<rect x="2" y="6" width="20" height="12" rx="3"/><path d="M6 12h4m-2-2v4m7-3h.01m2.99 2h.01"/>',
    original: '<path d="m12 3 1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3Z"/>',
    short: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  };

  const applyShadowMarquee = (box) => {
    if (!box) return;
    let track = box.querySelector(':scope > .ani-marquee-track');
    if (!track) {
      const txt = box.textContent || '';
      track = document.createElement('span');
      track.className = 'ani-marquee-track';
      track.textContent = txt;
      box.replaceChildren(track);
    }
    const avail = box.clientWidth;
    const total = Math.max(box.scrollWidth || 0, track.scrollWidth || 0, track.offsetWidth || 0);
    const distance = avail > 0 ? Math.max(0, total - avail) : 0;
    const isOverflow = distance > 2;
    if (isOverflow) {
      box.dataset.aniMarquee = 'true';
      box.style.setProperty('--ani-marquee-dist', `-${Math.ceil(distance + 16)}px`);
      box.style.setProperty('--ani-marquee-dur', `${Math.max(5.5, (distance + 16) / 16).toFixed(2)}s`);
    } else {
      delete box.dataset.aniMarquee;
      box.style.removeProperty('--ani-marquee-dist');
      box.style.removeProperty('--ani-marquee-dur');
    }
  };

  const escapeHtml = (str) =>
    String(str ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));

  const safeImageUrl = (raw) => {
    if (!raw) return '';
    try {
      const u = new URL(String(raw), location.href);
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
    } catch {
      return '';
    }
  };

  const formatMmSs = (sec) => {
    if (!Number.isFinite(sec) || sec < 0) return '—';
    const s = Math.floor(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`
      : `${m}:${String(rem).padStart(2, '0')}`;
  };

  const formatDateTime = (ts) => {
    if (!Number.isFinite(ts) || ts <= 0) return '';
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  const storageGet = async (key, fallback) => {
    let localVal = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) localVal = JSON.parse(raw);
    } catch {}
    if (globalThis.chrome?.storage?.local) {
      try {
        const res = await new Promise((resolve) =>
          chrome.storage.local.get({ [key]: localVal ?? fallback }, (out) => resolve(out?.[key])),
        );
        if (res !== undefined && res !== null && typeof res === typeof (fallback ?? {})) return res;
      } catch {}
    }
    return localVal !== null && typeof localVal === typeof (fallback ?? {}) ? localVal : fallback;
  };

  const storageSet = async (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
    if (globalThis.chrome?.storage?.local) {
      try {
        await new Promise((resolve) => chrome.storage.local.set({ [key]: value }, resolve));
      } catch {}
    }
  };

  const normalizeSettings = (values) => {
    const mod = globalThis.AniAmbientSettings;
    if (mod?.normalize) return mod.normalize(values, mod.defaults);
    return { ...(mod?.defaults || {}), ...(values || {}) };
  };

  let currentSettings = normalizeSettings({});
  const settingsListeners = new Set();

  const notifySettings = (next) => {
    currentSettings = normalizeSettings(next);
    for (const fn of settingsListeners) {
      try { fn(currentSettings); } catch {}
    }
  };

  const readSettings = async () => {
    const mod = globalThis.AniAmbientSettings;
    const defaults = mod?.defaults || {};
    if (globalThis.AniAmbientStorage?.get) {
      return new Promise((resolve) => {
        globalThis.AniAmbientStorage.get(defaults, (out) => {
          currentSettings = normalizeSettings(out);
          resolve(currentSettings);
        });
      });
    }
    if (globalThis.chrome?.storage?.sync) {
      try {
        const out = await new Promise((resolve) =>
          chrome.storage.sync.get(defaults, (res) => resolve(res || defaults)),
        );
        currentSettings = normalizeSettings(out);
        return currentSettings;
      } catch {}
    }
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        currentSettings = normalizeSettings(saved);
        return currentSettings;
      }
    } catch {}
    return currentSettings;
  };

  const writeSettings = async (patch) => {
    const next = normalizeSettings({ ...currentSettings, ...patch });
    notifySettings(next);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {}
    if (globalThis.AniAmbientStorage?.set) {
      try {
        await new Promise((resolve) => globalThis.AniAmbientStorage.set(next, resolve));
      } catch {}
    } else if (globalThis.chrome?.storage?.sync?.set) {
      try {
        await new Promise((resolve) => chrome.storage.sync.set(next, resolve));
      } catch {}
    }
    return next;
  };

  if (globalThis.AniAmbientStorage?.onChanged?.addListener) {
    globalThis.AniAmbientStorage.onChanged.addListener((changes) => {
      const merged = { ...currentSettings };
      for (const [k, delta] of Object.entries(changes || {})) {
        if (delta && 'newValue' in delta) merged[k] = delta.newValue;
      }
      notifySettings(merged);
    });
  }
  if (globalThis.chrome?.storage?.onChanged?.addListener) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' && area !== 'local') return;
      if (changes?.[SETTINGS_KEY]?.newValue) {
        notifySettings(changes[SETTINGS_KEY].newValue);
        return;
      }
      let touched = false;
      const merged = { ...currentSettings };
      const defaults = globalThis.AniAmbientSettings?.defaults || {};
      for (const [k, delta] of Object.entries(changes || {})) {
        if (Object.hasOwn(defaults, k) && delta && 'newValue' in delta) {
          merged[k] = delta.newValue;
          touched = true;
        }
      }
      if (touched) notifySettings(merged);
    });
  }
  window.addEventListener('storage', (ev) => {
    if (ev.key === SETTINGS_KEY && ev.newValue) {
      try { notifySettings(JSON.parse(ev.newValue)); } catch {}
    }
  });

  let toastTimer = 0;
  const showToast = (message) => {
    let toast = document.querySelector('.ani-bgm-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'ani-bgm-toast ani-enh-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.append(toast);
    }
    toast.textContent = String(message || '');
    toast.hidden = false;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
      toast.hidden = true;
    }, 2400);
  };

  const getSnFromHref = (href) => {
    if (!href) return '';
    try {
      const m = String(href).match(/[?&]sn=(\d+)/);
      if (m?.[1]) return m[1];
      return new URL(href, location.href).searchParams.get('sn') || '';
    } catch {
      return '';
    }
  };

  // ── Feature 1A: 「我的動畫」自訂收藏狀態分流 (/mygather.php) ──
  let colActiveFilter = 'all';
  let colStatesCache = null;
  let colBusy = false;

  const initCollectionStatusTagger = async () => {
    if (location.pathname !== '/mygather.php') return;
    if (colStatesCache === null) {
      colStatesCache = await storageGet(COL_STATUS_KEY, {});
      if (!colStatesCache || typeof colStatesCache !== 'object') colStatesCache = {};
    }

    const applyAndSync = () => {
      const list = document.querySelector('.animate-theme-list .theme-list-block');
      const filterBody = document.querySelector('.ani-collection-filters .ani-filter-body');
      if (!list) return;
      colBusy = true;
      try {
        const counts = { all: 0, plan: 0, watching: 0, completed: 0, paused: 0, unset: 0 };
        for (const card of list.querySelectorAll('.theme-list-main')) {
          const sn = getSnFromHref(card.getAttribute('href'));
          const entry = sn ? colStatesCache[sn] : null;
          const st = entry?.status && COL_STATUS_MAP[entry.status] ? entry.status : '';
          counts.all++;
          if (st) counts[st]++;
          else counts.unset++;

          const matched =
            colActiveFilter === 'all' ||
            (colActiveFilter === 'unset' ? !st : st === colActiveFilter);
          card.classList.toggle('ani-col-status-hidden', !matched);

          const imgHost = card.querySelector('.theme-img-block') || card.querySelector('.anime-detail-block') || card;
          let bar = card.querySelector('.ani-col-status-bar');
          if (!bar && sn) {
            bar = document.createElement('div');
            bar.className = 'ani-col-status-bar';
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'ani-col-status-chip';
            const menu = document.createElement('div');
            menu.className = 'ani-col-status-menu';
            menu.hidden = true;
            for (const [val, label] of COL_STATUS_META) {
              const opt = document.createElement('button');
              opt.type = 'button';
              opt.dataset.choice = val;
              opt.innerHTML = `${enhIcon(COL_STATUS_ICONS[val] || COL_STATUS_ICONS.add, 14)}<span>${escapeHtml(label)}</span>`;
              menu.append(opt);
            }
            const clearOpt = document.createElement('button');
            clearOpt.type = 'button';
            clearOpt.className = 'is-clear';
            clearOpt.dataset.choice = '';
            clearOpt.innerHTML = `${enhIcon(COL_STATUS_ICONS.clear, 14)}<span>清除標記</span>`;
            menu.append(clearOpt);
            bar.append(chip, menu);
            imgHost.append(bar);

            chip.addEventListener('click', (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              const willOpen = menu.hidden;
              for (const other of document.querySelectorAll('.ani-col-status-menu')) {
                other.hidden = true;
              }
              menu.hidden = !willOpen;
            });

            menu.addEventListener('click', async (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              const btn = ev.target.closest('button[data-choice]');
              if (!btn) return;
              const choice = btn.dataset.choice;
              if (choice && COL_STATUS_MAP[choice]) {
                colStatesCache[sn] = { status: choice, updatedAt: Date.now() };
              } else {
                delete colStatesCache[sn];
              }
              menu.hidden = true;
              await storageSet(COL_STATUS_KEY, colStatesCache);
              applyAndSync();
            });
          }
          const chipEl = bar?.querySelector('.ani-col-status-chip');
          if (chipEl) {
            chipEl.dataset.status = st;
            const labelTxt = st ? COL_STATUS_MAP[st] : '+ 標記狀態';
            const iconKey = st || 'add';
            chipEl.innerHTML = `${enhIcon(COL_STATUS_ICONS[iconKey] || COL_STATUS_ICONS.add, 13)}<span>${escapeHtml(labelTxt)}</span>`;
            chipEl.setAttribute('aria-label', st ? `收藏分類：${COL_STATUS_MAP[st]}` : '標記收藏分類');
          }
        }

        if (filterBody && !filterBody.querySelector('.ani-custom-status-filter')) {
          const section = document.createElement('section');
          section.className = 'class_list ani-custom-status-filter';
          section.setAttribute('role', 'group');
          section.setAttribute('aria-label', '自訂收藏分類');
          const header = document.createElement('div');
          header.className = 'ani-extra-filter-header';
          header.innerHTML = `<h3>${enhIcon('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>', 20)}收藏狀態</h3>`;
          const ul = document.createElement('ul');
          for (const [key, label] of [['all', '全部'], ...COL_STATUS_META, ['unset', '未分類']]) {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.filterStatus = key;
            btn.innerHTML = `${enhIcon(COL_STATUS_ICONS[key] || COL_STATUS_ICONS.all, 15)}<span>${escapeHtml(label)}</span> <small></small>`;
            btn.addEventListener('click', () => {
              colActiveFilter = key;
              applyAndSync();
            });
            li.append(btn);
            ul.append(li);
          }
          section.append(header, ul);
          const countEl = filterBody.querySelector('.ani-collection-count');
          if (countEl) countEl.before(section);
          else filterBody.append(section);
        }

        const filterSec = filterBody?.querySelector('.ani-custom-status-filter');
        if (filterSec) {
          for (const btn of filterSec.querySelectorAll('button[data-filter-status]')) {
            const key = btn.dataset.filterStatus;
            const active = key === colActiveFilter;
            btn.setAttribute('aria-pressed', String(active));
            btn.parentElement.classList.toggle('now', active);
            const sm = btn.querySelector('small');
            if (sm) sm.textContent = `(${counts[key] ?? 0})`;
          }
        }
      } finally {
        colBusy = false;
      }
    };

    if (!document.documentElement.dataset.aniColMenuClose) {
      document.documentElement.dataset.aniColMenuClose = '1';
      document.addEventListener('click', (ev) => {
        if (ev.target.closest('.ani-col-status-bar')) return;
        for (const m of document.querySelectorAll('.ani-col-status-menu')) m.hidden = true;
      });
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') {
          for (const m of document.querySelectorAll('.ani-col-status-menu')) m.hidden = true;
        }
      });
    }

    applyAndSync();
    const rootListWrap = document.querySelector('.animate-theme-list');
    if (rootListWrap && !rootListWrap.dataset.aniColStatusObs) {
      rootListWrap.dataset.aniColStatusObs = '1';
      let t = 0;
      new MutationObserver(() => {
        if (colBusy) return;
        clearTimeout(t);
        t = setTimeout(applyAndSync, 40);
      }).observe(rootListWrap, { childList: true, subtree: true });
    }
  };

  // ── Feature 1B: 永久本地觀看紀錄庫 (/animeVideo.php & /viewList.php) ──
  let histWriteQueue = Promise.resolve();
  const mutatePermanentHistory = (mutator) => {
    const job = histWriteQueue.then(async () => {
      const current = await storageGet(PERM_HIST_KEY, {});
      const data = current && typeof current === 'object' && !Array.isArray(current) ? { ...current } : {};
      const changed = mutator(data);
      if (changed) {
        const keys = Object.keys(data);
        if (keys.length > 5000) {
          keys
            .sort((a, b) => (data[b]?.watchedAt || 0) - (data[a]?.watchedAt || 0))
            .slice(5000)
            .forEach((oldKey) => { delete data[oldKey]; });
        }
        await storageSet(PERM_HIST_KEY, data);
      }
      return data;
    }).catch(() => ({}));
    histWriteQueue = job.then(() => {}, () => {});
    return job;
  };

  const extractCleanVideoInfo = () => {
    const videoSn = getSnFromHref(location.href);
    const refLink = document.querySelector('a[href*="animeRef.php?sn="]');
    const sn = getSnFromHref(refLink?.getAttribute('href')) || videoSn;
    const rawTitle = (document.querySelector('.anime_name h1')?.textContent || document.title || '').trim();
    const title = rawTitle.replace(/\s*(?:\[\s*\d+(?:\.\d+)?\s*\]|EP\.?\s*\d+(?:\.\d+)?)\s*$/i, '').replace(/\s*-\s*巴哈姆特動畫瘋.*$/, '').trim() || `動畫 #${sn}`;
    const epFromNav = document.querySelector('.season li.playing a')?.textContent?.trim();
    const epFromTitle = rawTitle.match(/(?:\[\s*|EP\.?\s*)(\d+(?:\.\d+)?)\s*\]?\s*$/i)?.[1];
    const episode = epFromNav || epFromTitle || '1';
    const cover = safeImageUrl(
      document.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
      document.querySelector('#ani_video video')?.getAttribute('poster'),
    );
    const video = document.querySelector('#ani_video video');
    const elapsedSec = video && Number.isFinite(video.currentTime) ? Math.floor(video.currentTime) : 0;
    const durationSec = video && Number.isFinite(video.duration) && video.duration > 0 ? Math.floor(video.duration) : 0;
    return { sn, videoSn, title, episode, cover, elapsedSec, durationSec };
  };

  const recordVideoProgress = () => {
    if (location.pathname !== '/animeVideo.php') return Promise.resolve();
    const info = extractCleanVideoInfo();
    if (!info.sn) return Promise.resolve();
    const now = Date.now();
    return mutatePermanentHistory((data) => {
      const prev = data[info.sn] && typeof data[info.sn] === 'object' ? data[info.sn] : {};
      const prevEps = prev.episodes && typeof prev.episodes === 'object' ? { ...prev.episodes } : {};
      if (info.episode) {
        prevEps[info.episode] = {
          videoSn: info.videoSn || prevEps[info.episode]?.videoSn || info.sn,
          watchedAt: now,
          elapsedSec: info.elapsedSec || prevEps[info.episode]?.elapsedSec || 0,
        };
      }
      data[info.sn] = {
        sn: info.sn,
        videoSn: info.videoSn || prev.videoSn || info.sn,
        title: info.title || prev.title || '',
        cover: info.cover || prev.cover || '',
        episode: info.episode || prev.episode || '',
        elapsedSec: info.elapsedSec > 0 ? info.elapsedSec : (prev.elapsedSec || 0),
        durationSec: info.durationSec > 0 ? info.durationSec : (prev.durationSec || 0),
        watchedAt: now,
        episodes: prevEps,
      };
      return true;
    });
  };

  const initVideoHistoryTracker = () => {
    if (location.pathname !== '/animeVideo.php') return;
    let lastSavedAt = 0;
    const bindVideo = (video) => {
      if (!video || video.dataset.aniPermTracked) return;
      video.dataset.aniPermTracked = '1';
      recordVideoProgress();
      lastSavedAt = Date.now();
      video.addEventListener('timeupdate', () => {
        if (Date.now() - lastSavedAt >= 15000) {
          lastSavedAt = Date.now();
          recordVideoProgress();
        }
      });
      video.addEventListener('ended', () => { recordVideoProgress(); });
    };
    const v = document.querySelector('#ani_video video');
    if (v) bindVideo(v);
    else recordVideoProgress();
    if (!document.documentElement.dataset.aniPermPagehide) {
      document.documentElement.dataset.aniPermPagehide = '1';
      window.addEventListener('pagehide', () => { recordVideoProgress(); });
    }
    const player = document.querySelector('#ani_video');
    if (player && !player.dataset.aniPermObs) {
      player.dataset.aniPermObs = '1';
      new MutationObserver(() => {
        const vid = player.querySelector('video');
        if (vid) bindVideo(vid);
      }).observe(player, { childList: true, subtree: true });
    }
  };

  const parseDateToMs = (raw) => {
    if (!raw) return Date.now();
    const m = String(raw).match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (!m) return Date.now();
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0)).getTime() || Date.now();
  };

  const snapshotNativeHistoryCards = () => {
    const cards = [...document.querySelectorAll('.user-watch-list > .anime-card')];
    if (!cards.length) return Promise.resolve({});
    return mutatePermanentHistory((data) => {
      let changed = false;
      for (const card of cards) {
        const more = card.querySelector('.more-btn');
        const play = card.querySelector('.play-btn, .click-area');
        const videoSn = getSnFromHref(play?.getAttribute('href'));
        const sn = more?.dataset.anime || card.querySelector('[data-anime-sn]')?.dataset.animeSn || videoSn;
        if (!sn) continue;
        const title = card.querySelector('.history-anime-title')?.textContent?.trim() || `動畫 #${sn}`;
        const coverEl = card.querySelector('.postimg img');
        const cover = safeImageUrl(coverEl?.dataset.src || coverEl?.getAttribute('src'));
        const episode = card.querySelector('.user-lastwatch')?.textContent?.trim() || '';
        const timingTxt = card.querySelector('.ani-history-timing')?.textContent || '';
        const nativeTxt = [...card.querySelectorAll('.history-lastwatch')].map((n) => n.textContent).join(' ');
        const minSec = nativeTxt.match(/(?:(\d+)\s*時\s*)?(\d+)\s*分\s*(\d+)\s*秒/);
        let elapsedSec = minSec ? (Number(minSec[1] || 0) * 3600 + Number(minSec[2]) * 60 + Number(minSec[3])) : 0;
        let durationSec = 0;
        const pb = card.querySelector('.progress-bar');
        const pbMax = Number(pb?.getAttribute('aria-valuemax'));
        const pbNow = Number(pb?.getAttribute('aria-valuenow'));
        if (Number.isFinite(pbMax) && pbMax > 0) durationSec = Math.floor(pbMax);
        if (!elapsedSec && Number.isFinite(pbNow) && pbNow > 0) elapsedSec = Math.floor(pbNow);
        if (!durationSec && /\//.test(timingTxt)) {
          const dm = timingTxt.split('/')[1]?.trim().match(/(?:(\d+):)?(\d+):(\d+)/);
          if (dm) durationSec = Number(dm[1] || 0) * 3600 + Number(dm[2]) * 60 + Number(dm[3]);
        }

        const prev = data[sn] && typeof data[sn] === 'object' ? data[sn] : null;
        const eps = prev?.episodes && typeof prev.episodes === 'object' ? { ...prev.episodes } : {};
        const subList = document.querySelector(`.user-watchTime-list[data-anime-sn="${sn}"], #sub-list-${sn}`);
        let latestMs = prev?.watchedAt || 0;
        if (subList) {
          for (const a of subList.querySelectorAll('a')) {
            const eTitle = a.querySelector('.history-list-anime-title')?.dataset?.aniOriginalTitle || a.querySelector('.history-list-anime-title')?.textContent || '';
            const ep = eTitle.match(/\[\s*(\d+(?:\.\d+)?)\s*\]/)?.[1] || eTitle.match(/EP\.(\d+(?:\.\d+)?)/i)?.[1];
            const dateStr = a.querySelector('.date')?.textContent?.trim();
            const ms = parseDateToMs(dateStr);
            if (ms > latestMs) latestMs = ms;
            if (ep) {
              const eSn = getSnFromHref(a.getAttribute('href')) || videoSn || sn;
              if (!eps[ep] || (eps[ep].watchedAt || 0) < ms) {
                eps[ep] = { videoSn: eSn, watchedAt: ms, elapsedSec: eps[ep]?.elapsedSec || 0 };
              }
            }
          }
        }
        if (episode && !eps[episode]) {
          eps[episode] = { videoSn: videoSn || sn, watchedAt: latestMs || Date.now(), elapsedSec };
        }
        const merged = {
          sn,
          videoSn: videoSn || prev?.videoSn || sn,
          title: title || prev?.title || '',
          cover: cover || prev?.cover || '',
          episode: episode || prev?.episode || '',
          elapsedSec: elapsedSec || prev?.elapsedSec || 0,
          durationSec: durationSec || prev?.durationSec || 0,
          watchedAt: prev?.watchedAt ? Math.max(prev.watchedAt, latestMs) : (latestMs || Date.now()),
          episodes: eps,
        };
        data[sn] = merged;
        changed = true;
      }
      return changed;
    });
  };

  let permHistoryBusy = false;
  let permActiveTab = 'native';

  const initPermanentHistoryPage = async () => {
    if (location.pathname !== '/viewList.php') return;
    await snapshotNativeHistoryCards();

    const hostParent =
      document.querySelector('.history-wrapper') ||
      document.querySelector('.center-container') ||
      document.querySelector('#BH_background');
    const nativeHistory = document.querySelector('#historyList, .history');
    if (!hostParent || document.querySelector('.ani-perm-history-shell')) return;

    const shell = document.createElement('section');
    shell.className = 'ani-perm-history-shell';

    const filterCard = document.createElement('div');
    filterCard.className = 'filter-section ani-browse-filters ani-perm-filter-card';
    filterCard.setAttribute('aria-label', '觀看紀錄分類與篩選');

    const sourceRow = document.createElement('div');
    sourceRow.className = 'ani-perm-filter-row';
    const sourceHead = document.createElement('div');
    sourceHead.className = 'ani-extra-filter-header';
    sourceHead.innerHTML = `<h3>${enhIcon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 20)}紀錄來源</h3>`;

    const tabs = document.createElement('div');
    tabs.className = 'ani-perm-tabs';
    tabs.setAttribute('role', 'tablist');
    const tabNative = document.createElement('button');
    tabNative.type = 'button';
    tabNative.className = 'ani-perm-tab';
    tabNative.setAttribute('role', 'tab');
    tabNative.innerHTML = `${enhIcon('<circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>', 15)}<span>官方觀看紀錄</span>`;
    const tabPerm = document.createElement('button');
    tabPerm.type = 'button';
    tabPerm.className = 'ani-perm-tab';
    tabPerm.setAttribute('role', 'tab');
    tabPerm.innerHTML = `${enhIcon('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>', 15)}<span class="ani-perm-tab-label">永久本地紀錄 (0)</span>`;
    tabs.append(tabNative, tabPerm);
    sourceRow.append(sourceHead, tabs);

    const toolbar = document.createElement('div');
    toolbar.className = 'ani-perm-toolbar';
    toolbar.hidden = true;
    toolbar.innerHTML = `
      <div class="ani-perm-filter-row">
        <div class="ani-extra-filter-header">
          <h3>${enhIcon('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>', 20)}觀看狀態</h3>
        </div>
        <div class="ani-perm-filter-pills" role="group" aria-label="進度篩選">
          <button type="button" class="ani-perm-btn" data-perm-prog="all" aria-pressed="true">${enhIcon(COL_STATUS_ICONS.all, 15)}<span>全部</span></button>
          <button type="button" class="ani-perm-btn" data-perm-prog="inprogress" aria-pressed="false">${enhIcon(COL_STATUS_ICONS.watching, 15)}<span>未看完</span></button>
          <button type="button" class="ani-perm-btn" data-perm-prog="completed" aria-pressed="false">${enhIcon(COL_STATUS_ICONS.completed, 15)}<span>已看完</span></button>
        </div>
      </div>
      <div class="ani-perm-filter-row">
        <div class="ani-extra-filter-header">
          <h3>${enhIcon('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', 20)}搜尋管理</h3>
        </div>
        <div class="ani-perm-manage-row">
          <div class="anime_search-input ani-collection-search-capsule ani-perm-search-capsule">
            <input type="search" class="ani-perm-search" placeholder="搜尋永久觀看紀錄…" aria-label="搜尋永久觀看紀錄">
            <button type="button" class="anime_search-icon ani-perm-search-icon" aria-label="搜尋紀錄" tabindex="-1">
              ${enhIcon('<circle cx="10" cy="10" r="6"/><path d="m14.4 14.4 5.6 5.6"/>', 16)}
            </button>
          </div>
          <div class="ani-perm-io-actions">
            <button type="button" class="ani-perm-btn" data-perm-export title="匯出 JSON">${enhIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>', 15)}<span>匯出 JSON</span></button>
            <button type="button" class="ani-perm-btn" data-perm-import title="匯入 JSON">${enhIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>', 15)}<span>匯入 JSON</span></button>
            <button type="button" class="ani-perm-btn is-danger" data-perm-clear title="清空永久本地紀錄">${enhIcon(COL_STATUS_ICONS.clear, 15)}<span class="ani-perm-clear-label">清空</span></button>
            <input type="file" data-perm-file accept="application/json,.json" hidden>
          </div>
        </div>
      </div>
    `;

    filterCard.append(sourceRow, toolbar);

    const panel = document.createElement('div');
    panel.className = 'ani-perm-history-panel';
    panel.hidden = true;
    panel.innerHTML = `<div class="ani-perm-grid"></div>`;

    shell.append(filterCard, panel);
    if (nativeHistory && nativeHistory.parentElement === hostParent) nativeHistory.before(shell);
    else hostParent.prepend(shell);

    let progFilter = 'all';
    const searchEl = filterCard.querySelector('.ani-perm-search');
    filterCard.querySelector('.ani-perm-search-icon')?.addEventListener('click', () => searchEl?.focus());
    const gridEl = panel.querySelector('.ani-perm-grid');
    const clearBtn = filterCard.querySelector('[data-perm-clear]');
    let clearArmed = false;

    const syncTabState = (records) => {
      const count = Object.keys(records || {}).length;
      const tabPermLabel = tabPerm.querySelector('.ani-perm-tab-label');
      if (tabPermLabel) tabPermLabel.textContent = `永久本地紀錄 (${count})`;
      else tabPerm.textContent = `永久本地紀錄 (${count})`;
      const isPerm = permActiveTab === 'perm';
      tabNative.setAttribute('aria-selected', String(!isPerm));
      tabPerm.setAttribute('aria-selected', String(isPerm));
      toolbar.hidden = !isPerm;
      panel.hidden = !isPerm;
      const nativeTargets = new Set([
        ...document.querySelectorAll('.history:not(.ani-perm-grid), #historyList, .history-year-month-block, .history-wrapper .anime-btn-show-more'),
      ]);
      const wrapper = document.querySelector('.history-wrapper');
      if (wrapper) {
        for (const child of wrapper.children) {
          if (child !== shell && !child.classList.contains('ani-perm-history-shell')) {
            nativeTargets.add(child);
          }
        }
      }
      for (const el of nativeTargets) {
        if (el.closest('.ani-perm-history-shell')) continue;
        el.classList.toggle('ani-perm-native-hidden', isPerm);
        if (isPerm) el.setAttribute('data-ani-perm-hidden', '1');
        else el.removeAttribute('data-ani-perm-hidden');
        el.hidden = isPerm;
      }
    };

    const renderGrid = async () => {
      const records = await storageGet(PERM_HIST_KEY, {});
      syncTabState(records);
      if (permActiveTab !== 'perm') return;
      const q = searchEl.value.trim().toLocaleLowerCase();
      const items = Object.values(records || {})
        .filter((it) => it && typeof it === 'object' && it.sn)
        .sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0))
        .filter((it) => {
          if (q && !(it.title || '').toLocaleLowerCase().includes(q)) return false;
          const isDone = it.durationSec > 0 && it.elapsedSec >= Math.max(1, it.durationSec - 15);
          if (progFilter === 'completed') return isDone;
          if (progFilter === 'inprogress') return !isDone;
          return true;
        });

      if (!items.length) {
        gridEl.innerHTML = '<div class="ani-perm-empty">尚無符合條件的永久本地紀錄。觀看影片時將自動寫入，超過 180 天也不會消失。</div>';
        return;
      }

      gridEl.innerHTML = items.map((it) => {
        const pct = it.durationSec > 0 ? Math.min(100, Math.max(0, Math.round((it.elapsedSec / it.durationSec) * 100))) : 0;
        const cover = safeImageUrl(it.cover);
        const epKeys = Object.keys(it.episodes || {}).sort((a, b) => Number(b) - Number(a)).slice(0, 8);
        const epPills = epKeys.map((ep) => {
          const epSn = encodeURIComponent(it.episodes[ep]?.videoSn || it.videoSn || it.sn);
          return `<a class="ani-perm-ep-pill" href="animeVideo.php?sn=${epSn}">EP.${escapeHtml(ep)}</a>`;
        }).join('');
        const resumeSn = encodeURIComponent(it.videoSn || it.sn);
        const watchedDate = formatDateTime(it.watchedAt);
        return `
          <div class="ani-perm-watch-slot">
            <article class="anime-card ani-history-card ani-perm-card" data-perm-sn="${escapeHtml(it.sn)}">
              <a class="click-area" href="animeVideo.php?sn=${resumeSn}" aria-label="${escapeHtml(it.title)}"></a>
              <div class="postimg ani-perm-cover-wrap">
                ${cover ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(it.title)}" loading="lazy">` : ''}
              </div>
              <div class="anime-info ani-perm-info">
                <p class="history-anime-title ani-perm-title" title="${escapeHtml(it.title)}"><span class="ani-marquee-track">${escapeHtml(it.title)}</span></p>
                <div class="ani-history-playback">
                  ${it.episode ? `<span class="ani-history-episode ani-perm-ep-badge">EP.${escapeHtml(it.episode)}</span>` : '<span></span>'}
                  <p class="ani-history-timing"><span class="ani-history-elapsed">${formatMmSs(it.elapsedSec)}</span> / ${formatMmSs(it.durationSec)}</p>
                </div>
                <div class="ani-history-secondary">
                  ${watchedDate ? `<p class="ani-history-update">${escapeHtml(watchedDate)}</p>` : ''}
                </div>
                <div class="progress-bar" aria-valuenow="${Math.round(it.elapsedSec || 0)}" aria-valuemax="${Math.round(it.durationSec || 0)}">
                  <div class="progress ani-perm-bar-fill" style="width:${pct}%"></div>
                </div>
                ${epPills ? `<div class="ani-perm-eps">${epPills}</div>` : ''}
              </div>
              <div class="btn-set ani-perm-actions">
                <a class="play-btn round-btn ani-perm-resume" href="animeVideo.php?sn=${resumeSn}">
                  <svg class="ani-history-play-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8Z"/></svg>
                  <span class="ani-history-play-label">繼續觀看</span>
                </a>
                <button type="button" class="round-btn ani-perm-del-btn" data-perm-delete="${escapeHtml(it.sn)}" aria-label="刪除「${escapeHtml(it.title)}」的本地紀錄" title="刪除此筆紀錄">
                  ${enhIcon(COL_STATUS_ICONS.clear, 18)}
                </button>
              </div>
            </article>
          </div>
        `;
      }).join('');
      for (const titleEl of gridEl.querySelectorAll('.ani-perm-title')) {
        applyShadowMarquee(titleEl);
      }
    };

    tabNative.addEventListener('click', () => {
      permActiveTab = 'native';
      renderGrid();
    });
    tabPerm.addEventListener('click', () => {
      permActiveTab = 'perm';
      renderGrid();
    });
    searchEl.addEventListener('input', () => { renderGrid(); });
    for (const pb of filterCard.querySelectorAll('[data-perm-prog]')) {
      pb.addEventListener('click', () => {
        progFilter = pb.dataset.permProg;
        for (const b of filterCard.querySelectorAll('[data-perm-prog]')) {
          b.setAttribute('aria-pressed', String(b === pb));
        }
        renderGrid();
      });
    }
    gridEl.addEventListener('click', async (ev) => {
      const del = ev.target.closest('[data-perm-delete]');
      if (!del) return;
      ev.preventDefault();
      ev.stopPropagation();
      const sn = del.dataset.permDelete;
      await mutatePermanentHistory((data) => {
        if (!Object.hasOwn(data, sn)) return false;
        delete data[sn];
        return true;
      });
      showToast('已從永久本地紀錄刪除');
      renderGrid();
    });

    filterCard.querySelector('[data-perm-export]').addEventListener('click', async () => {
      const records = await storageGet(PERM_HIST_KEY, {});
      const payload = JSON.stringify({ format: 'anigamer-redesign-history', version: 1, exportedAt: Date.now(), records }, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `anigamer-history-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('已匯出永久觀看紀錄');
    });

    const fileInput = filterCard.querySelector('[data-perm-file]');
    filterCard.querySelector('[data-perm-import]').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const incoming = parsed?.records && typeof parsed.records === 'object' ? parsed.records : parsed;
        if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new Error('invalid');
        let importedCount = 0;
        await mutatePermanentHistory((data) => {
          for (const [sn, item] of Object.entries(incoming)) {
            if (!/^\d+$/.test(sn) || !item || typeof item !== 'object') continue;
            const prev = data[sn];
            data[sn] = {
              sn,
              videoSn: String(item.videoSn || prev?.videoSn || sn),
              title: String(item.title || prev?.title || `動畫 #${sn}`).slice(0, 120),
              cover: safeImageUrl(item.cover || prev?.cover),
              episode: String(item.episode || prev?.episode || '').slice(0, 16),
              elapsedSec: Math.max(0, Number(item.elapsedSec || 0)),
              durationSec: Math.max(0, Number(item.durationSec || 0)),
              watchedAt: Math.max(Number(item.watchedAt || 0), Number(prev?.watchedAt || 0)) || Date.now(),
              episodes: { ...(prev?.episodes || {}), ...(item.episodes && typeof item.episodes === 'object' ? item.episodes : {}) },
            };
            importedCount++;
          }
          return importedCount > 0;
        });
        showToast(`已匯入 ${importedCount} 筆觀看紀錄`);
        renderGrid();
      } catch {
        showToast('匯入失敗：檔案格式無效');
      } finally {
        fileInput.value = '';
      }
    });

    const setClearLabel = (txt) => {
      const lbl = clearBtn.querySelector('.ani-perm-clear-label');
      if (lbl) lbl.textContent = txt;
      else clearBtn.textContent = txt;
    };

    clearBtn.addEventListener('click', async () => {
      if (!clearArmed) {
        clearArmed = true;
        clearBtn.classList.add('is-armed');
        setClearLabel('再點確認清空');
        setTimeout(() => {
          clearArmed = false;
          clearBtn.classList.remove('is-armed');
          setClearLabel('清空');
        }, 3500);
        return;
      }
      clearArmed = false;
      clearBtn.classList.remove('is-armed');
      setClearLabel('清空');
      await storageSet(PERM_HIST_KEY, {});
      showToast('已清空永久本地紀錄');
      renderGrid();
    });

    await renderGrid();

    const histWrap = document.querySelector('.history');
    if (histWrap && !histWrap.dataset.aniPermObs) {
      histWrap.dataset.aniPermObs = '1';
      let t = 0;
      new MutationObserver(() => {
        if (permHistoryBusy) return;
        clearTimeout(t);
        t = setTimeout(async () => {
          permHistoryBusy = true;
          try {
            await snapshotNativeHistoryCards();
            await renderGrid();
          } finally {
            permHistoryBusy = false;
          }
        }, 200);
      }).observe(histWrap, { childList: true });
    }
  };

  const sendWorkerMessage = (payload) =>
    new Promise((resolve) => {
      try {
        if (!globalThis.chrome?.runtime?.sendMessage) {
          resolve(null);
          return;
        }
        chrome.runtime.sendMessage(payload, (resp) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(resp ?? null);
        });
      } catch {
        resolve(null);
      }
    });

  const tagSnMemory = new Map();
  const tagFetchInflight = new Map();

  const readJsonLocal = (key, fallback = {}) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return fallback;
  };

  const writeJsonLocal = (key, obj) => {
    try {
      localStorage.setItem(key, JSON.stringify(obj));
    } catch {}
  };

  const fetchTagSnSet = (rawTag, hrefOverride = '') => {
    const tag = String(rawTag || '').trim();
    if (!tag) return Promise.resolve(new Set());
    const cachedMem = tagSnMemory.get(tag);
    if (cachedMem && Date.now() - cachedMem.ts < TAG_CACHE_TTL_MS) {
      return Promise.resolve(new Set(cachedMem.sns));
    }
    const cacheMap = readJsonLocal(TAG_CACHE_KEY, {});
    const diskEntry = cacheMap[tag];
    if (diskEntry && Array.isArray(diskEntry.sns) && Date.now() - Number(diskEntry.ts || 0) < TAG_CACHE_TTL_MS) {
      const mem = { ts: Number(diskEntry.ts), sns: new Set(diskEntry.sns) };
      tagSnMemory.set(tag, mem);
      return Promise.resolve(new Set(mem.sns));
    }
    if (tagFetchInflight.has(tag)) return tagFetchInflight.get(tag);

    const job = (async () => {
      const sns = new Set();
      let baseHref = '';
      if (hrefOverride) {
        try {
          const u = new URL(hrefOverride, location.origin);
          if (u.origin === location.origin) baseHref = u.href;
        } catch {}
      }
      if (!baseHref) {
        baseHref = `${location.origin}/animeList.php?tags=${encodeURIComponent(tag)}`;
      }
      let currentUrl = baseHref;
      for (let pageIdx = 1; pageIdx <= 3 && currentUrl; pageIdx++) {
        try {
          const u = new URL(currentUrl, location.origin);
          if (u.origin !== location.origin) break;
          if (pageIdx > 1) u.searchParams.set('page', String(pageIdx));
          const res = await fetch(u.href, {
            credentials: 'include',
            signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
          });
          if (!res?.ok) break;
          const html = await res.text();
          if (!html) break;
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const links = [...doc.querySelectorAll('.theme-list-main, a[href*="animeRef.php?sn="], a[href*="animeVideo.php?sn="]')];
          let foundHere = 0;
          for (const a of links) {
            const sn = getSnFromHref(a.getAttribute('href'));
            if (sn) {
              sns.add(sn);
              foundHere++;
            }
          }
          if (!foundHere) break;
          const hasNextPage = [...doc.querySelectorAll('.page_number a')].some(
            (a) => Number(a.textContent?.trim()) === pageIdx + 1,
          );
          if (!hasNextPage) break;
          currentUrl = baseHref;
        } catch {
          break;
        }
      }
      const ts = Date.now();
      tagSnMemory.set(tag, { ts, sns });
      const freshMap = readJsonLocal(TAG_CACHE_KEY, {});
      freshMap[tag] = { ts, sns: [...sns] };
      // Prune oldest entries if cache grows beyond 40 tags
      const keys = Object.keys(freshMap);
      if (keys.length > 40) {
        keys.sort((a, b) => (freshMap[b]?.ts || 0) - (freshMap[a]?.ts || 0)).slice(40).forEach((k) => delete freshMap[k]);
      }
      writeJsonLocal(TAG_CACHE_KEY, freshMap);
      return new Set(sns);
    })().finally(() => {
      tagFetchInflight.delete(tag);
    });

    tagFetchInflight.set(tag, job);
    return job;
  };

  // ── Feature 2: 所有動畫（片庫）反向排除標籤、原作分類與跳頁電梯 (/animeList.php) ──
  const DEFAULT_CATALOG_TAGS = [
    '動作', '奇幻', '冒險', '校園', '戀愛', '科幻', '懸疑', '治癒',
    '異世界', '泡麵番', 'BL', 'GL', '恐怖', '機戰', '運動',
  ];
  const ORIGIN_OPTIONS = [
    ['all', '全部'],
    ['manga', '漫畫改編'],
    ['light_novel', '輕小說改編'],
    ['game', '遊戲改編'],
    ['original', '原創動畫'],
    ['short', '輕動畫 / 泡麵番'],
  ];
  const ORIGIN_BADGE_LABELS = {
    manga: '漫改',
    light_novel: '輕改',
    game: '遊改',
    original: '原創',
    short: '輕動畫',
  };

  const buildCatalogPageUrl = (pageNum, baseHref = location.href) => {
    const u = new URL(baseHref, location.origin);
    const n = Math.max(1, Math.floor(Number(pageNum) || 1));
    u.searchParams.set('page', String(n));
    return u.href;
  };

  let catBusy = false;

  const initCatalogEnhancements = () => {
    if (location.pathname !== '/animeList.php') return;
    const filterSection = document.querySelector('.filter-section');
    const filterBody = filterSection?.querySelector('.ani-filter-body') || filterSection;
    const listBlock = document.querySelector('.animate-theme-list .theme-list-block');
    if (!listBlock) return;

    // Collect native tags before injecting extra panels
    const tagLinks = new Map();
    if (filterSection) {
      for (const a of filterSection.querySelectorAll('.class_list a')) {
        const label = (a.textContent || '').trim();
        const href = a.getAttribute('href') || '';
        if (!label || label === '全部' || label.length > 16 || /^javascript:/i.test(href)) continue;
        if (!tagLinks.has(label)) tagLinks.set(label, href);
      }
    }
    for (const dt of DEFAULT_CATALOG_TAGS) {
      if (!tagLinks.has(dt)) tagLinks.set(dt, '');
    }
    const availableTags = [...tagLinks.keys()].slice(0, 24);

    const savedEx = readJsonLocal(CAT_EXCLUDE_KEY, { tags: [], keyword: '' });
    const excludedTags = new Set(Array.isArray(savedEx.tags) ? savedEx.tags.map((t) => String(t).trim()).filter(Boolean) : []);
    let excludeKeyword = String(savedEx.keyword || '');
    let activeOrigin = 'all';
    const metaCache = readJsonLocal(WORK_META_CACHE_KEY, {});
    const metaPending = new Set();

    const saveExcludeState = () => {
      writeJsonLocal(CAT_EXCLUDE_KEY, { tags: [...excludedTags], keyword: excludeKeyword });
    };

    const getCardCleanTitle = (card) =>
      (card.querySelector('.theme-name')?.textContent || '')
        .replace(/\s*\[\s*\d+(?:\.\d+)?\s*\]\s*$/, '')
        .trim();

    const ensureOriginBadge = (card, meta) => {
      if (!meta) return;
      const host = card.querySelector('.theme-img-block');
      if (!host) return;
      const badgeKey = meta.isShort ? 'short' : meta.source;
      const label = ORIGIN_BADGE_LABELS[badgeKey];
      if (!label) return;
      let badge = host.querySelector('.ani-origin-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'ani-origin-badge';
        host.append(badge);
      }
      if (badge.textContent !== label) badge.textContent = label;
    };

    const applyCatalogFilters = async () => {
      if (catBusy) return;
      catBusy = true;
      try {
        const cards = [...listBlock.querySelectorAll('.theme-list-main')];
        // Gather SN sets for all currently excluded tags
        const excludedSnSets = excludedTags.size
          ? await Promise.all([...excludedTags].map((t) => fetchTagSnSet(t, tagLinks.get(t) || '')))
          : [];
        const excludedSns = new Set();
        for (const s of excludedSnSets) {
          for (const sn of s) excludedSns.add(sn);
        }
        const kwTokens = excludeKeyword
          .split(/[,，、\n]+/)
          .map((s) => s.trim().toLocaleLowerCase())
          .filter(Boolean);

        let excludedCount = 0;
        let originShown = 0;
        const now = Date.now();
        const missingTitles = [];

        for (const card of cards) {
          const sn = getSnFromHref(card.getAttribute('href'));
          const title = getCardCleanTitle(card);
          const textBlob = (card.textContent || '').toLocaleLowerCase();

          let isEx = false;
          if (sn && excludedSns.has(sn)) isEx = true;
          if (!isEx && kwTokens.length) {
            isEx = kwTokens.some((kw) => textBlob.includes(kw));
          }
          card.classList.toggle('ani-catalog-excluded', isEx);
          if (isEx) excludedCount++;

          const cached = title ? metaCache[title] : null;
          const validMeta = cached && now - Number(cached.ts || 0) < WORK_META_TTL_MS ? cached : null;
          if (validMeta) ensureOriginBadge(card, validMeta);
          else if (activeOrigin !== 'all' && title && !metaPending.has(title)) {
            missingTitles.push(title);
          }

          let hideByOrigin = false;
          if (activeOrigin !== 'all') {
            if (activeOrigin === 'short') {
              const hintShort = /泡麵番|輕動畫|短篇/.test(card.textContent || '');
              hideByOrigin = validMeta ? !validMeta.isShort && !hintShort : !hintShort;
            } else {
              hideByOrigin = validMeta ? validMeta.source !== activeOrigin : true;
            }
          }
          card.classList.toggle('ani-origin-hidden', hideByOrigin);
          if (!isEx && !hideByOrigin) originShown++;
        }

        if (filterBody) {
          const exCountEl = filterBody.querySelector('.ani-exclude-count');
          if (exCountEl) exCountEl.textContent = excludedCount ? `已排除 ${excludedCount} 部` : '';
          const origStatusEl = filterBody.querySelector('.ani-origin-status');
          if (origStatusEl) {
            origStatusEl.textContent =
              activeOrigin === 'all'
                ? ''
                : missingTitles.length
                ? `正在比對 ${missingTitles.length} 部作品資料…`
                : `符合此原作分類：${originShown} 部`;
          }
        }

        if (activeOrigin !== 'all' && missingTitles.length) {
          const batch = [...new Set(missingTitles)].slice(0, 15);
          batch.forEach((t) => metaPending.add(t));
          const resp = await sendWorkerMessage({ type: 'ani-fetch-work-meta', titles: batch });
          const tsNow = Date.now();
          let updated = false;
          for (const t of batch) {
            const hit = resp?.items?.[t];
            if (hit) {
              metaCache[t] = { ...hit, ts: tsNow };
              updated = true;
            } else {
              // Cache miss briefly (1 hour) to avoid spinning repeated requests
              metaCache[t] = { source: 'other', isShort: false, ts: tsNow - WORK_META_TTL_MS + 3600000 };
              updated = true;
            }
          }
          if (updated) {
            const keys = Object.keys(metaCache);
            if (keys.length > 400) {
              keys.sort((a, b) => (metaCache[b]?.ts || 0) - (metaCache[a]?.ts || 0)).slice(400).forEach((k) => delete metaCache[k]);
            }
            writeJsonLocal(WORK_META_CACHE_KEY, metaCache);
            catBusy = false;
            return applyCatalogFilters();
          }
        }
      } finally {
        catBusy = false;
      }
    };

    // 2A & 2B panels appended at the END of .ani-filter-body (preserving 年份 as firstElementChild & .class-header svg === 4)
    if (filterBody && !filterBody.querySelector('.ani-exclude-panel')) {
      const exPanel = document.createElement('section');
      exPanel.className = 'ani-exclude-panel';
      exPanel.setAttribute('aria-label', '反向排除篩選');
      exPanel.innerHTML = `
        <div class="ani-extra-filter-header">
          <h3>${enhIcon('<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>', 20)}排除標籤</h3>
          <span class="ani-exclude-count" role="status"></span>
        </div>
        <div class="ani-exclude-body">
          <div class="ani-exclude-pills"></div>
          <div class="ani-exclude-controls">
            <div class="anime_search-input ani-collection-search-capsule ani-exclude-search-capsule">
              <input type="search" class="ani-exclude-keyword" placeholder="輸入要排除的關鍵字（逗號分隔）…" aria-label="排除關鍵字">
              <button type="button" class="anime_search-icon ani-exclude-search-icon" aria-label="搜尋排除關鍵字" tabindex="-1">
                ${enhIcon('<circle cx="10" cy="10" r="6"/><path d="m14.4 14.4 5.6 5.6"/>', 16)}
              </button>
            </div>
            <button type="button" class="ani-exclude-clear" title="清除排除" aria-label="清除排除">
              ${enhIcon('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>', 16)}
              <span>清除排除</span>
            </button>
          </div>
        </div>
      `;
      const pillsWrap = exPanel.querySelector('.ani-exclude-pills');
      const setExPillContent = (btn, tag, isEx) => {
        const iconPath = isEx
          ? '<circle cx="12" cy="12" r="9"/><path d="m8.5 8.5 7 7M15.5 8.5l-7 7"/>'
          : '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1"/>';
        btn.innerHTML = `${enhIcon(iconPath, 14)}<span>${escapeHtml(tag)}</span>`;
      };
      for (const tag of availableTags) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ani-exclude-pill';
        btn.dataset.excludeTag = tag;
        const active = excludedTags.has(tag);
        btn.classList.toggle('is-excluded', active);
        btn.setAttribute('aria-pressed', String(active));
        setExPillContent(btn, tag, active);
        btn.addEventListener('click', () => {
          if (excludedTags.has(tag)) excludedTags.delete(tag);
          else excludedTags.add(tag);
          const nowEx = excludedTags.has(tag);
          btn.classList.toggle('is-excluded', nowEx);
          btn.setAttribute('aria-pressed', String(nowEx));
          setExPillContent(btn, tag, nowEx);
          saveExcludeState();
          applyCatalogFilters();
        });
        pillsWrap.append(btn);
      }
      const kwInput = exPanel.querySelector('.ani-exclude-keyword');
      exPanel.querySelector('.ani-exclude-search-icon')?.addEventListener('click', () => kwInput?.focus());
      kwInput.value = excludeKeyword;
      let kwTimer = 0;
      kwInput.addEventListener('input', () => {
        excludeKeyword = kwInput.value;
        saveExcludeState();
        clearTimeout(kwTimer);
        kwTimer = setTimeout(applyCatalogFilters, 80);
      });
      exPanel.querySelector('.ani-exclude-clear').addEventListener('click', () => {
        excludedTags.clear();
        excludeKeyword = '';
        kwInput.value = '';
        for (const b of pillsWrap.querySelectorAll('.ani-exclude-pill')) {
          b.classList.remove('is-excluded');
          b.setAttribute('aria-pressed', 'false');
          setExPillContent(b, b.dataset.excludeTag, false);
        }
        saveExcludeState();
        applyCatalogFilters();
      });
      filterBody.append(exPanel);
    }

    if (filterBody && !filterBody.querySelector('.ani-origin-panel')) {
      const originPanel = document.createElement('section');
      originPanel.className = 'ani-origin-panel';
      originPanel.setAttribute('aria-label', '原作 / 型態分類');
      originPanel.innerHTML = `
        <div class="ani-extra-filter-header">
          <h3>${enhIcon('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>', 20)}原作分類</h3>
          <span class="ani-origin-status" role="status"></span>
        </div>
        <div class="ani-origin-pills" role="group" aria-label="選擇原作類型"></div>
      `;
      const oWrap = originPanel.querySelector('.ani-origin-pills');
      for (const [key, label] of ORIGIN_OPTIONS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ani-origin-pill';
        btn.dataset.origin = key;
        btn.setAttribute('aria-pressed', String(key === activeOrigin));
        btn.innerHTML = `${enhIcon(ORIGIN_ICONS[key] || ORIGIN_ICONS.all, 15)}<span>${escapeHtml(label)}</span>`;
        btn.addEventListener('click', () => {
          activeOrigin = key;
          for (const b of oWrap.querySelectorAll('.ani-origin-pill')) {
            b.setAttribute('aria-pressed', String(b === btn));
          }
          applyCatalogFilters();
        });
        oWrap.append(btn);
      }
      filterBody.append(originPanel);
    }

    // 2C Page Elevator (.ani-page-elevator) mounted after .ani-load-more / .page_control
    const pagesEl = document.querySelector('.page_control');
    if (pagesEl && !document.querySelector('.ani-page-elevator')) {
      const currentPage =
        Number(pagesEl.querySelector('.page_number .now')?.textContent?.trim() || new URL(location.href).searchParams.get('page') || 1) || 1;
      const pageNums = [currentPage];
      for (const a of pagesEl.querySelectorAll('.page_number a')) {
        const txtNum = Number(a.textContent?.trim());
        if (Number.isFinite(txtNum) && txtNum > 0) pageNums.push(txtNum);
        try {
          const href = a.getAttribute('href');
          if (href) {
            const qPage = Number(new URL(href, location.origin).searchParams.get('page'));
            if (Number.isFinite(qPage) && qPage > 0) pageNums.push(qPage);
          }
        } catch {}
      }
      const totalPages = Math.max(...pageNums);
      if (totalPages > 1) {
        const el = document.createElement('nav');
        el.className = 'ani-page-elevator';
        el.setAttribute('aria-label', '分頁快速跳轉');

        const jumpToPage = (targetPage) => {
          const clamped = Math.min(totalPages, Math.max(1, Math.floor(Number(targetPage) || 1)));
          const url = buildCatalogPageUrl(clamped);
          const ev = new CustomEvent('ani-page-jump', { cancelable: true, detail: { page: clamped, url } });
          if (document.dispatchEvent(ev)) {
            location.assign(url);
          }
        };

        const quickWrap = document.createElement('div');
        quickWrap.className = 'ani-page-quick';
        const candidates = [...new Set([1, Math.max(1, currentPage - 1), currentPage, Math.min(totalPages, currentPage + 1), totalPages])].sort((a, b) => a - b);
        for (const p of candidates) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ani-page-quick-btn';
          btn.dataset.page = String(p);
          btn.dataset.href = buildCatalogPageUrl(p);
          if (p === currentPage) btn.setAttribute('aria-current', 'page');
          btn.textContent = String(p);
          btn.addEventListener('click', () => jumpToPage(p));
          quickWrap.append(btn);
        }

        const form = document.createElement('form');
        form.className = 'ani-page-jump-form';
        form.innerHTML = `
          <span>第</span>
          <input type="number" class="ani-page-input" min="1" max="${totalPages}" value="${currentPage}" aria-label="輸入頁碼">
          <span>/ ${totalPages} 頁</span>
          <button type="submit" class="ani-page-go-btn" title="前往頁碼" aria-label="前往">${enhIcon('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', 15)}<span>前往</span></button>
        `;
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const val = Number(form.querySelector('.ani-page-input')?.value);
          if (Number.isFinite(val) && val >= 1) jumpToPage(val);
        });

        el.append(quickWrap, form);
        const anchor = document.querySelector('.ani-load-more') || pagesEl;
        anchor.after(el);
      }
    }

    applyCatalogFilters();

    if (!listBlock.dataset.aniCatalogObs) {
      listBlock.dataset.aniCatalogObs = '1';
      let obsTimer = 0;
      new MutationObserver(() => {
        if (catBusy) return;
        clearTimeout(obsTimer);
        obsTimer = setTimeout(applyCatalogFilters, 60);
      }).observe(listBlock, { childList: true });
    }
  };

  // ── Feature 3: 避雷薄碼 / 預覽圖模糊遮罩 ──
  let blurBusy = false;
  let blurSubscribed = false;

  const clearSpoilerBlurFromCover = (cover) => {
    cover.classList.remove('ani-spoiler-blurred', 'is-unblurred');
    cover.querySelector('.ani-spoiler-mask')?.remove();
    cover.querySelector('.ani-blur-rehide-btn')?.remove();
  };

  const BLUR_EYE_ON_SVG = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  const BLUR_EYE_OFF_SVG = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';

  const renderBlurToggleInner = (btn, enabled) => {
    btn.setAttribute('aria-pressed', String(enabled));
    btn.innerHTML = `${enhIcon(enabled ? BLUR_EYE_ON_SVG : BLUR_EYE_OFF_SVG, 15)}<span>${enabled ? '避雷遮罩：開' : '避雷遮罩：關'}</span>`;
  };

  const applySpoilerBlur = async () => {
    if (blurBusy) return;
    blurBusy = true;
    try {
      const enabled = Boolean(currentSettings.spoilerBlurEnabled);
      const quickBtn = document.querySelector('.ani-blur-quick-toggle');
      if (quickBtn) {
        renderBlurToggleInner(quickBtn, enabled);
      }

      const cards = [...document.querySelectorAll('.theme-list-main, .anime-card-block, .ani-perm-card, .anime-card')];
      if (!enabled) {
        for (const cover of document.querySelectorAll('.ani-spoiler-blurred')) {
          clearSpoilerBlurFromCover(cover);
        }
        return;
      }

      const tags = String(currentSettings.spoilerBlurTags || '')
        .split(/[,，、\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const keywords = String(currentSettings.spoilerBlurKeywords || '')
        .split(/[,，、\n]+/)
        .map((s) => s.trim().toLocaleLowerCase())
        .filter(Boolean);
      const globalMode = tags.length === 0 && keywords.length === 0;

      const blurredSns = new Set();
      if (!globalMode && tags.length) {
        const snSets = await Promise.all(tags.map((t) => fetchTagSnSet(t)));
        for (const set of snSets) {
          for (const sn of set) blurredSns.add(sn);
        }
      }

      for (const card of cards) {
        const cover = card.querySelector('.theme-img-block, .anime-pic, .ani-perm-cover-wrap, .postimg');
        if (!cover) continue;

        let match = globalMode;
        if (!match) {
          const href =
            card.getAttribute('href') ||
            card.querySelector('a[href*="sn="]')?.getAttribute('href') ||
            '';
          const sn = card.dataset?.permSn || getSnFromHref(href);
          if (sn && blurredSns.has(sn)) match = true;
          if (!match && keywords.length) {
            const titleText =
              card.querySelector('.theme-name, .history-anime-title, .ani-perm-title, .anime-name')?.textContent || '';
            const imgAlt = cover.querySelector('img')?.getAttribute('alt') || '';
            const blob = `${titleText} ${imgAlt} ${card.textContent || ''}`.toLocaleLowerCase();
            match = keywords.some((kw) => blob.includes(kw));
          }
        }

        if (!match) {
          if (cover.classList.contains('ani-spoiler-blurred')) {
            clearSpoilerBlurFromCover(cover);
          }
          continue;
        }

        cover.classList.add('ani-spoiler-blurred');
        if (!cover.querySelector('.ani-spoiler-mask')) {
          const mask = document.createElement('div');
          mask.className = 'ani-spoiler-mask';
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ani-spoiler-reveal-btn';
          btn.innerHTML = `${enhIcon(BLUR_EYE_OFF_SVG, 14)}<span>避雷遮罩 · 點擊預覽</span>`;
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            cover.classList.add('is-unblurred');
          });
          mask.append(btn);
          cover.append(mask);
        }
        if (!cover.querySelector('.ani-blur-rehide-btn')) {
          const rehide = document.createElement('button');
          rehide.type = 'button';
          rehide.className = 'ani-blur-rehide-btn';
          rehide.innerHTML = `${enhIcon(BLUR_EYE_ON_SVG, 13)}<span>重新遮罩</span>`;
          rehide.title = '重新套用避雷模糊';
          rehide.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            cover.classList.remove('is-unblurred');
          });
          cover.append(rehide);
        }
      }
    } finally {
      blurBusy = false;
    }
  };

  const initSpoilerBlur = async () => {
    const allowedPaths = ['/', '/index.php', '/animeList.php', '/mygather.php', '/search.php', '/viewList.php', '/animeVideo.php'];
    if (!allowedPaths.includes(location.pathname)) return;

    const topRightSortHost =
      document.querySelector('.filter-title-block .ani-section-actions') ||
      document.querySelector('.animate-theme-list:has(> .filter-section) > .theme-title-block .ani-section-actions') ||
      document.querySelector('.ani-collection-sort-host') ||
      document.querySelector('.filter-title-block') ||
      document.querySelector('.animate-theme-list:has(> .filter-section) > .theme-title-block') ||
      document.querySelector('.ani-perm-tabs') ||
      document.querySelector('.ani-perm-io-actions');
    const filterSection = document.querySelector('.filter-section');
    const filterToggle = filterSection?.querySelector(':scope > .ani-filter-toggle');

    if ((topRightSortHost || filterToggle || filterSection) && !document.querySelector('.ani-blur-quick-toggle')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ani-blur-quick-toggle';
      renderBlurToggleInner(btn, Boolean(currentSettings.spoilerBlurEnabled));
      btn.addEventListener('click', async () => {
        await writeSettings({ spoilerBlurEnabled: !currentSettings.spoilerBlurEnabled });
      });
      if (topRightSortHost) {
        topRightSortHost.append(btn);
      } else if (filterSection) {
        filterSection.classList.add('has-top-right-blur-toggle');
        if (filterToggle) filterToggle.after(btn);
        else filterSection.prepend(btn);
      }
    }

    if (!blurSubscribed) {
      blurSubscribed = true;
      settingsListeners.add(() => {
        applySpoilerBlur();
      });
    }

    await applySpoilerBlur();

    for (const host of document.querySelectorAll('.animate-theme-list, .newanime-block, .history-wrapper')) {
      if (host.dataset.aniSpoilerObs) continue;
      host.dataset.aniSpoilerObs = '1';
      let t = 0;
      new MutationObserver(() => {
        if (blurBusy) return;
        clearTimeout(t);
        t = setTimeout(() => { applySpoilerBlur(); }, 120);
      }).observe(host, { childList: true, subtree: true });
    }
  };

  // ── Feature 4: 彈幕列表搜尋、多維排序與單一發送者局部消音 (/animeVideo.php) ──
  const parseDanmuSeconds = (row) => {
    const raw = (row.querySelector('b')?.textContent || '').trim();
    const parts = raw.split(':').map((n) => Number(n.trim()));
    if (parts.length === 2 && parts.every(Number.isFinite)) return parts[0] * 60 + parts[1];
    if (parts.length === 3 && parts.every(Number.isFinite)) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  };

  const getDanmuRowText = (row) =>
    (row.querySelector('.sub_content')?.textContent || row.textContent || '').trim();

  const extractDanmuSender = (row) => {
    const attrSender =
      row.dataset?.userid ||
      row.dataset?.user ||
      row.dataset?.uid ||
      row.getAttribute('data-userid') ||
      row.getAttribute('data-user') ||
      row.querySelector('.sub_user, .user-id, .name, [data-userid], [data-user]')?.getAttribute('data-userid') ||
      row.querySelector('.sub_user, .user-id, .name, [data-userid], [data-user]')?.getAttribute('data-user') ||
      row.querySelector('.sub_user, .user-id, .name')?.textContent?.trim();
    if (attrSender) return String(attrSender).trim();

    for (const el of row.querySelectorAll('.edit, button, a')) {
      const oc = el.getAttribute('onclick') || '';
      const strArgs = [...oc.matchAll(/['"]([a-zA-Z0-9._-]{2,32})['"]/g)].map((m) => m[1]);
      if (strArgs.length) return strArgs[strArgs.length - 1];
      const href = el.getAttribute('href') || '';
      const qUser = href.match(/[?&](?:user|userid|uid)=([^&]+)/i)?.[1];
      if (qUser) return decodeURIComponent(qUser);
    }
    return '';
  };

  let dmBusy = false;
  let dmObserver = null;
  let dmOverlayObserver = null;

  const initDanmuListTools = async () => {
    if (location.pathname !== '/animeVideo.php') return;
    const subList = document.querySelector('#sub_list');
    if (!subList) return;

    let mutedMap = await storageGet(LOCAL_MUTE_KEY, {});
    if (!mutedMap || typeof mutedMap !== 'object' || Array.isArray(mutedMap)) mutedMap = {};

    let searchQuery = '';
    let sortKey = 'time';
    let sortDir = 'asc';
    let origCounter = 0;

    let bar = document.querySelector('.ani-danmu-tools-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'ani-danmu-tools-bar';
      bar.innerHTML = `
        <div class="ani-danmu-search-row">
          <input type="search" class="ani-danmu-search" placeholder="搜尋彈幕或發送者…" aria-label="搜尋彈幕或發送者">
          <span class="ani-danmu-count" role="status"></span>
        </div>
        <div class="ani-danmu-sort-row">
          <div class="ani-danmu-sorts" role="group" aria-label="彈幕排序">
            <button type="button" class="ani-dm-sort-btn" data-dm-sort="time" aria-pressed="true">時間 ↑</button>
            <button type="button" class="ani-dm-sort-btn" data-dm-sort="length" aria-pressed="false">長度</button>
            <button type="button" class="ani-dm-sort-btn" data-dm-sort="sender" aria-pressed="false">發射</button>
          </div>
          <div class="ani-dm-muted-host">
            <button type="button" class="ani-danmu-muted-pill" aria-expanded="false">已消音 0 人</button>
            <div class="ani-danmu-muted-popover" hidden></div>
          </div>
        </div>
      `;
      subList.before(bar);
    }

    const searchInput = bar.querySelector('.ani-danmu-search');
    const countEl = bar.querySelector('.ani-danmu-count');
    const sortBtns = [...bar.querySelectorAll('.ani-dm-sort-btn')];
    const mutedPill = bar.querySelector('.ani-danmu-muted-pill');
    const mutedPopover = bar.querySelector('.ani-danmu-muted-popover');

    const syncLiveOverlayMute = () => {
      const hasMutes = Object.keys(mutedMap).length > 0;
      const overlay = document.querySelector('.danmu-container, .vjs-danmu-layer');
      const sweepOverlay = () => {
        if (!overlay) return;
        for (const item of overlay.querySelectorAll('[data-userid], [data-user], .danmu-item')) {
          const u = item.getAttribute('data-userid') || item.getAttribute('data-user') || '';
          const muted = Boolean(u && mutedMap[u]);
          item.classList.toggle('ani-dm-filtered-hidden', muted);
        }
      };
      if (hasMutes && overlay) {
        sweepOverlay();
        if (!dmOverlayObserver) {
          dmOverlayObserver = new MutationObserver(() => {
            if (Object.keys(mutedMap).length > 0) sweepOverlay();
          });
          dmOverlayObserver.observe(overlay, { childList: true });
        }
      } else if (dmOverlayObserver) {
        dmOverlayObserver.disconnect();
        dmOverlayObserver = null;
        if (overlay) {
          for (const item of overlay.querySelectorAll('.ani-dm-filtered-hidden')) {
            item.classList.remove('ani-dm-filtered-hidden');
          }
        }
      }
    };

    const DM_SORT_ICONS = {
      time: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      length: '<path d="M4 7h16M4 12h12M4 17h8"/>',
      sender: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    };
    const DM_MUTE_ICON = '<path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';

    const renderMutedPopover = () => {
      const senders = Object.keys(mutedMap);
      mutedPill.innerHTML = `${enhIcon(DM_MUTE_ICON, 13)}<span>已消音 ${senders.length} 人</span>`;
      if (!senders.length) {
        mutedPopover.innerHTML = '<p class="ani-dm-muted-empty">尚未消音任何發送者</p>';
        return;
      }
      mutedPopover.innerHTML = `
        <div class="ani-dm-muted-list">
          ${senders
            .map(
              (id) => `
            <div class="ani-dm-muted-item">
              <span title="${escapeHtml(id)}">${escapeHtml(id)}</span>
              <button type="button" class="ani-dm-unmute-one" data-unmute-sender="${escapeHtml(id)}" title="解除消音">${enhIcon('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>', 12)}<span>解除</span></button>
            </div>`,
            )
            .join('')}
        </div>
        <button type="button" class="ani-dm-unmute-all">${enhIcon(COL_STATUS_ICONS.clear, 13)}<span>全部解除</span></button>
      `;
    };

    const updateSortLabels = () => {
      const names = { time: '時間', length: '長度', sender: '發射' };
      for (const b of sortBtns) {
        const key = b.dataset.dmSort;
        const active = key === sortKey;
        b.setAttribute('aria-pressed', String(active));
        const label = active ? `${names[key]} ${sortDir === 'asc' ? '↑' : '↓'}` : names[key];
        b.innerHTML = `${enhIcon(DM_SORT_ICONS[key] || DM_SORT_ICONS.time, 13)}<span>${escapeHtml(label)}</span>`;
      }
    };

    const applyDanmuListState = () => {
      if (dmBusy) return;
      dmBusy = true;
      try {
        const rows = [...subList.querySelectorAll('.sub-list-li')];
        if (!rows.length) {
          countEl.textContent = '0 / 0';
          renderMutedPopover();
          syncLiveOverlayMute();
          return;
        }

        const senderFreq = Object.create(null);
        for (const row of rows) {
          if (!row.dataset.aniOrigIdx) {
            row.dataset.aniOrigIdx = String(++origCounter);
          }
          const sender = row.dataset.aniSender || extractDanmuSender(row);
          if (sender) {
            row.dataset.aniSender = sender;
            senderFreq[sender] = (senderFreq[sender] || 0) + 1;
          }
          if (sender && !row.querySelector('.ani-dm-local-mute')) {
            const muteBtn = document.createElement('button');
            muteBtn.type = 'button';
            muteBtn.className = 'ani-dm-local-mute';
            muteBtn.title = `局部消音 ${sender}`;
            muteBtn.setAttribute('aria-label', `局部消音 ${sender}`);
            muteBtn.innerHTML = `${enhIcon(DM_MUTE_ICON, 13)}<span>消音此人</span>`;
            muteBtn.addEventListener('click', async (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              const targetSender = row.dataset.aniSender;
              if (!targetSender) return;
              if (mutedMap[targetSender]) delete mutedMap[targetSender];
              else mutedMap[targetSender] = { mutedAt: Date.now() };
              await storageSet(LOCAL_MUTE_KEY, mutedMap);
              showToast(mutedMap[targetSender] ? `已局部消音：${targetSender}` : `已解除消音：${targetSender}`);
              applyDanmuListState();
            });
            const actionBox = row.querySelector(':scope > div:nth-child(2)') || row;
            actionBox.append(muteBtn);
          }
        }

        const q = searchQuery.trim().toLocaleLowerCase();
        let shown = 0;
        for (const row of rows) {
          const sender = row.dataset.aniSender || '';
          const txt = getDanmuRowText(row);
          const isMuted = Boolean(sender && mutedMap[sender]);
          const matchesQuery =
            !q || txt.toLocaleLowerCase().includes(q) || sender.toLocaleLowerCase().includes(q);
          const hidden = isMuted || !matchesQuery;
          row.classList.toggle('ani-dm-filtered-hidden', hidden);
          if (!hidden) shown++;
        }

        countEl.textContent = `${shown} / ${rows.length}`;
        renderMutedPopover();
        syncLiveOverlayMute();

        const sorted = [...rows].sort((a, b) => {
          let cmp = 0;
          if (sortKey === 'length') {
            cmp = getDanmuRowText(a).length - getDanmuRowText(b).length;
          } else if (sortKey === 'sender') {
            const fa = senderFreq[a.dataset.aniSender || ''] || 0;
            const fb = senderFreq[b.dataset.aniSender || ''] || 0;
            cmp = fa - fb;
          } else {
            cmp = parseDanmuSeconds(a) - parseDanmuSeconds(b);
          }
          if (cmp !== 0) return sortDir === 'asc' ? cmp : -cmp;
          return Number(a.dataset.aniOrigIdx) - Number(b.dataset.aniOrigIdx);
        });

        const orderChanged = sorted.some((node, idx) => node !== rows[idx]);
        if (orderChanged) {
          const frag = document.createDocumentFragment();
          for (const node of sorted) frag.append(node);
          subList.append(frag);
        }
      } finally {
        dmObserver?.takeRecords();
        dmBusy = false;
      }
    };

    if (!bar.dataset.aniDmWired) {
      bar.dataset.aniDmWired = '1';
      let searchTimer = 0;
      searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(applyDanmuListState, 80);
      });
      for (const b of sortBtns) {
        b.addEventListener('click', () => {
          const key = b.dataset.dmSort;
          if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
          else {
            sortKey = key;
            sortDir = key === 'time' ? 'asc' : 'desc';
          }
          updateSortLabels();
          applyDanmuListState();
        });
      }
      mutedPill.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextOpen = mutedPopover.hidden;
        mutedPopover.hidden = !nextOpen;
        mutedPill.setAttribute('aria-expanded', String(nextOpen));
      });
      mutedPopover.addEventListener('click', async (e) => {
        e.stopPropagation();
        const unmuteBtn = e.target.closest('.ani-dm-unmute-one');
        if (unmuteBtn) {
          const id = unmuteBtn.dataset.unmuteSender;
          if (id && mutedMap[id]) {
            delete mutedMap[id];
            await storageSet(LOCAL_MUTE_KEY, mutedMap);
            applyDanmuListState();
          }
          return;
        }
        if (e.target.closest('.ani-dm-unmute-all')) {
          mutedMap = {};
          await storageSet(LOCAL_MUTE_KEY, mutedMap);
          applyDanmuListState();
        }
      });
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.ani-dm-muted-host')) {
          mutedPopover.hidden = true;
          mutedPill.setAttribute('aria-expanded', 'false');
        }
      });
    }

    updateSortLabels();
    applyDanmuListState();

    // Critical contract: observe #sub_list with childList: true ONLY + debounced guard
    if (!subList.dataset.aniDmObs) {
      subList.dataset.aniDmObs = '1';
      let obsTimer = 0;
      dmObserver = new MutationObserver(() => {
        if (dmBusy) return;
        clearTimeout(obsTimer);
        obsTimer = setTimeout(applyDanmuListState, 150);
      });
      dmObserver.observe(subList, { childList: true });
    }
  };

  // ── Feature 5A: 長篇集數自動分組折疊 (/animeVideo.php) ──
  let epGroupSubscribed = false;

  const initLongEpisodeGrouping = () => {
    if (location.pathname !== '/animeVideo.php') return;
    const season = document.querySelector('.season');
    const ul = season?.querySelector('ul');
    if (!season || !ul) return;

    const applyGrouping = () => {
      const items = [...ul.querySelectorAll(':scope > li')];
      const existingBar = season.querySelector(':scope > .ani-ep-group-bar');
      if (!currentSettings.episodeAutoGroup || items.length < 50) {
        existingBar?.remove();
        for (const li of items) li.classList.remove('ani-ep-chunk-hidden');
        delete season.dataset.aniEpActiveGroup;
        return;
      }

      const CHUNK_SIZE = 25;
      const chunks = [];
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        chunks.push({ start: i, end: Math.min(items.length - 1, i + CHUNK_SIZE - 1) });
      }

      const playingIdx = items.findIndex((li) => li.classList.contains('playing'));
      const defaultIdx = playingIdx >= 0 ? Math.floor(playingIdx / CHUNK_SIZE) : 0;
      if (!season.dataset.aniEpActiveGroup) {
        season.dataset.aniEpActiveGroup = String(defaultIdx);
      }

      const bar = existingBar || document.createElement('div');
      bar.className = 'ani-ep-group-bar';
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', '集數區間分組');
      bar.innerHTML = '';

      const renderVisibility = () => {
        const active = season.dataset.aniEpActiveGroup;
        for (const btn of bar.querySelectorAll('.ani-ep-group-btn')) {
          btn.setAttribute('aria-pressed', String(btn.dataset.epGroup === active));
        }
        if (active === 'all') {
          for (const li of items) li.classList.remove('ani-ep-chunk-hidden');
          return;
        }
        const gIdx = Math.min(chunks.length - 1, Math.max(0, Number(active) || 0));
        const { start, end } = chunks[gIdx];
        items.forEach((li, idx) => {
          li.classList.toggle('ani-ep-chunk-hidden', idx < start || idx > end);
        });
      };

      chunks.forEach((ch, idx) => {
        const firstLabel = (items[ch.start]?.textContent || '').trim() || String(ch.start + 1);
        const lastLabel = (items[ch.end]?.textContent || '').trim() || String(ch.end + 1);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ani-ep-group-btn';
        btn.dataset.epGroup = String(idx);
        btn.textContent = /^\d+(?:\.\d+)?$/.test(firstLabel) && /^\d+(?:\.\d+)?$/.test(lastLabel)
          ? `${firstLabel}–${lastLabel}`
          : `${ch.start + 1}–${ch.end + 1}`;
        btn.addEventListener('click', () => {
          season.dataset.aniEpActiveGroup = String(idx);
          renderVisibility();
        });
        bar.append(btn);
      });

      const allBtn = document.createElement('button');
      allBtn.type = 'button';
      allBtn.className = 'ani-ep-group-btn';
      allBtn.dataset.epGroup = 'all';
      allBtn.innerHTML = `${enhIcon(COL_STATUS_ICONS.all, 13)}<span>全部</span>`;
      allBtn.addEventListener('click', () => {
        season.dataset.aniEpActiveGroup = 'all';
        renderVisibility();
      });
      bar.append(allBtn);

      if (!existingBar) ul.before(bar);
      renderVisibility();
    };

    if (!epGroupSubscribed) {
      epGroupSubscribed = true;
      settingsListeners.add(() => { applyGrouping(); });
    }
    applyGrouping();
  };

  // ── Feature 5B: 單集副標題懸浮預覽 ＋ 全螢幕中上副標題與長標題陰影遮罩跑馬燈 ──
  const getCleanAnimeTitle = () => {
    const raw = (document.querySelector('.anime_name h1')?.textContent || document.title || '').trim();
    return raw
      .replace(/\s*(?:\[\s*\d+(?:\.\d+)?\s*\]|EP\.?\s*\d+(?:\.\d+)?)\s*$/i, '')
      .replace(/\s*-\s*巴哈姆特動畫瘋.*$/, '')
      .trim();
  };

  const syncFullscreenSubtitleAndMarquee = () => {
    if (location.pathname !== '/animeVideo.php') return;
    const playerEl = document.querySelector('#ani_video');
    if (!playerEl) return;

    const titleH1 = document.querySelector('.anime-title .anime_name h1');
    const rawTitleText = (titleH1?.textContent || '').trim();
    const animeTitleText = rawTitleText ? rawTitleText.replace(/\s*\[([^\]]+)\]\s*$/, ' EP.$1') : '';

    let fsTitle = playerEl.querySelector('.ani-fs-title');
    if (!fsTitle && animeTitleText) {
      fsTitle = document.createElement('div');
      fsTitle.className = 'ani-fs-title';
      playerEl.append(fsTitle);
    }
    if (!fsTitle) return;

    let mainBox = fsTitle.querySelector('.ani-fs-title-main');
    let subBox = fsTitle.querySelector('.ani-fs-subtitle');
    if (!mainBox) {
      const initialTxt = animeTitleText || (fsTitle.textContent || '').trim();
      fsTitle.textContent = '';
      mainBox = document.createElement('div');
      mainBox.className = 'ani-fs-title-main';
      const mainTrack = document.createElement('span');
      mainTrack.className = 'ani-marquee-track';
      mainTrack.textContent = initialTxt;
      mainBox.append(mainTrack);

      subBox = document.createElement('div');
      subBox.className = 'ani-fs-subtitle';
      subBox.hidden = true;
      const subTrack = document.createElement('span');
      subTrack.className = 'ani-marquee-track';
      subBox.append(subTrack);

      fsTitle.append(mainBox, subBox);
    } else if (animeTitleText) {
      const mt = mainBox.querySelector('.ani-marquee-track');
      if (mt && mt.textContent !== animeTitleText) mt.textContent = animeTitleText;
    }

    const playingLink = document.querySelector('.season li.playing a');
    const epSub = playingLink?.dataset?.aniEpTitle || '';
    const epNum = (playingLink?.textContent || '').trim();
    if (subBox) {
      const st = subBox.querySelector('.ani-marquee-track');
      if (epSub) {
        const formatted = epNum && !/^第\s*\d+/.test(epSub) ? `第 ${epNum} 話：${epSub}` : epSub;
        if (st) st.textContent = formatted;
        subBox.hidden = false;
      } else {
        if (st) st.textContent = '';
        subBox.hidden = true;
      }
    }

    applyShadowMarquee(mainBox);
    if (subBox && !subBox.hidden) applyShadowMarquee(subBox);

    if (!fsTitle.dataset.aniFsMarqueeBound) {
      fsTitle.dataset.aniFsMarqueeBound = '1';
      const remeasure = () => {
        applyShadowMarquee(mainBox);
        if (subBox && !subBox.hidden) applyShadowMarquee(subBox);
      };
      document.addEventListener('fullscreenchange', remeasure);
      document.addEventListener('webkitfullscreenchange', remeasure);
      window.addEventListener('resize', remeasure, { passive: true });
      if (typeof ResizeObserver === 'function') {
        const ro = new ResizeObserver(remeasure);
        ro.observe(fsTitle);
        ro.observe(mainBox);
      }
    }
  };

  const getEpTooltipNode = () => {
    let tip = document.getElementById('ani-ep-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'ani-ep-tooltip';
      tip.className = 'ani-ep-tooltip';
      tip.setAttribute('role', 'tooltip');
      tip.hidden = true;
      document.body.append(tip);
    }
    return tip;
  };

  const initEpisodeTitleTooltips = async () => {
    if (location.pathname !== '/animeVideo.php') return;
    syncFullscreenSubtitleAndMarquee();
    const season = document.querySelector('.season');
    if (!season) return;
    const cleanTitle = getCleanAnimeTitle();
    if (!cleanTitle) return;

    const tip = getEpTooltipNode();
    if (!season.dataset.aniEpTipWired) {
      season.dataset.aniEpTipWired = '1';
      const showTip = (link) => {
        const epTitle = link?.dataset?.aniEpTitle;
        if (!epTitle) return;
        const epNum = (link.textContent || '').trim();
        const jp = link.dataset.aniEpJp || '';
        const airdate = link.dataset.aniEpAirdate || '';
        tip.innerHTML = `
          <div class="ani-ep-tip-head">第 ${escapeHtml(epNum)} 話${airdate ? `<span>${escapeHtml(airdate)}</span>` : ''}</div>
          <div class="ani-ep-tip-title">${escapeHtml(epTitle)}</div>
          ${jp && jp !== epTitle ? `<div class="ani-ep-tip-sub">${escapeHtml(jp)}</div>` : ''}
        `;
        tip.hidden = false;
        const rect = link.getBoundingClientRect();
        const left = Math.max(8, Math.min(window.innerWidth - 268, rect.left + rect.width / 2 - 120));
        const top = rect.top > 76 ? rect.top - 66 : rect.bottom + 8;
        tip.style.left = `${Math.round(left)}px`;
        tip.style.top = `${Math.round(top)}px`;
      };
      const hideTip = () => { tip.hidden = true; };
      season.addEventListener('mouseover', (e) => {
        const a = e.target.closest('a[data-ani-ep-title]');
        if (a) showTip(a);
      });
      season.addEventListener('focusin', (e) => {
        const a = e.target.closest('a[data-ani-ep-title]');
        if (a) showTip(a);
      });
      season.addEventListener('mouseout', (e) => {
        const a = e.target.closest('a[data-ani-ep-title]');
        if (a && !a.contains(e.relatedTarget)) hideTip();
      });
      season.addEventListener('focusout', hideTip);
      window.addEventListener('scroll', hideTip, { passive: true });
    }

    const cache = readJsonLocal(EP_TITLES_CACHE_KEY, {});
    const cachedEntry = cache[cleanTitle];
    let epMap =
      cachedEntry && Date.now() - Number(cachedEntry.ts || 0) < WORK_META_TTL_MS && cachedEntry.episodes
        ? cachedEntry.episodes
        : null;

    if (!epMap) {
      const resp = await sendWorkerMessage({ type: 'ani-fetch-episode-titles', title: cleanTitle });
      if (resp?.ok && resp.episodes && Object.keys(resp.episodes).length > 0) {
        epMap = resp.episodes;
        cache[cleanTitle] = { ts: Date.now(), episodes: epMap };
        const keys = Object.keys(cache);
        if (keys.length > 120) {
          keys.sort((a, b) => (cache[b]?.ts || 0) - (cache[a]?.ts || 0)).slice(120).forEach((k) => delete cache[k]);
        }
        writeJsonLocal(EP_TITLES_CACHE_KEY, cache);
      } else {
        epMap = {};
      }
    }

    for (const a of season.querySelectorAll('li a')) {
      const rawEp = (a.textContent || '').trim();
      const numMatch = rawEp.match(/(\d+(?:\.\d+)?)/)?.[1];
      const epData = epMap[rawEp] || (numMatch ? epMap[numMatch] || epMap[String(Number(numMatch))] : null);
      if (epData?.name) {
        a.dataset.aniEpTitle = epData.name;
        if (epData.jp) a.dataset.aniEpJp = epData.jp;
        if (epData.airdate) a.dataset.aniEpAirdate = epData.airdate;
        a.title = `第 ${rawEp} 話：${epData.name}`;
      }
    }
    syncFullscreenSubtitleAndMarquee();
  };

  // ── Feature 5C: 即將下架醒目提醒 ──
  const parseOffshelfNotice = (rawText) => {
    const text = String(rawText || '').replace(/\s+/g, ' ').trim();
    if (!text) return null;
    const dated = text.match(
      /(?:預計|將於|本作品將於)?\s*((?:20\d{2}[\/\-年])?\d{1,2}[\/\-月]\d{1,2}日?(?:\s*\d{1,2}:\d{2})?)\s*(?:起)?(?:下架|到期|停止授權)/,
    );
    const labeled = text.match(/(?:下架時間|授權到期)[：:]\s*([^\n，,。]{3,28})/);
    const generic = !dated && !labeled ? text.match(/(即將下架|即將到期|下架預告)/) : null;
    if (!dated && !labeled && !generic) return null;

    const dateText = (dated?.[1] || labeled?.[1] || '').trim();
    let daysLeft = null;
    if (dateText) {
      const ymd = dateText.match(/(?:(20\d{2})[\/\-年])?(\d{1,2})[\/\-月](\d{1,2})/);
      if (ymd) {
        const now = new Date();
        let yr = ymd[1] ? Number(ymd[1]) : now.getFullYear();
        const mo = Number(ymd[2]) - 1;
        const dy = Number(ymd[3]);
        let target = new Date(yr, mo, dy, 23, 59, 59);
        if (!ymd[1] && target.getTime() < now.getTime() - 7 * 86400000) {
          target = new Date(yr + 1, mo, dy, 23, 59, 59);
        }
        const diff = Math.ceil((target.getTime() - now.getTime()) / 86400000);
        if (diff >= 0 && diff <= 120) daysLeft = diff;
      }
    }
    const notice = dated?.[0] || labeled?.[0] || generic?.[0] || '即將下架';
    return { notice, dateText, daysLeft };
  };

  let offshelfSubscribed = false;

  const initOffshelfAlerts = () => {
    const allowedPaths = ['/', '/index.php', '/animeList.php', '/mygather.php', '/animeVideo.php', '/animeRef.php'];
    if (!allowedPaths.includes(location.pathname)) return;

    const run = () => {
      if (!currentSettings.showOffshelfAlert) {
        for (const el of document.querySelectorAll('.ani-offshelf-banner, .ani-offshelf-badge')) el.remove();
        return;
      }

      const offshelfCache = readJsonLocal(OFFSHELF_CACHE_KEY, {});
      const now = Date.now();
      let cacheUpdated = false;
      for (const [k, v] of Object.entries(offshelfCache)) {
        if (!v || now - Number(v.detectedAt || 0) > 60 * 86400000) {
          delete offshelfCache[k];
          cacheUpdated = true;
        }
      }

      if (location.pathname === '/animeVideo.php' || location.pathname === '/animeRef.php') {
        const scanText = [...document.querySelectorAll('.anime_info_detail, .data_intro, .notice, .season, .anime_name')]
          .map((el) => el.textContent || '')
          .join(' ');
        const parsed = parseOffshelfNotice(scanText);
        const refLink = document.querySelector('a[href*="animeRef.php?sn="]');
        const sn = getSnFromHref(refLink?.getAttribute('href')) || getSnFromHref(location.href);
        const title = getCleanAnimeTitle();
        if (parsed) {
          if (sn) {
            offshelfCache[sn] = { sn, title, ...parsed, detectedAt: now };
            cacheUpdated = true;
          }
          const hostAnchor =
            document.querySelector('.container-player > .anime-title') ||
            document.querySelector('.anime_name') ||
            document.querySelector('#BH_background');
          if (hostAnchor) {
            let banner = document.querySelector('.ani-offshelf-banner');
            if (!banner) {
              banner = document.createElement('div');
              banner.className = 'ani-offshelf-banner';
              banner.setAttribute('role', 'status');
              if (hostAnchor.classList.contains('anime-title')) hostAnchor.after(banner);
              else hostAnchor.prepend(banner);
            }
            const dayNote =
              parsed.daysLeft !== null
                ? parsed.daysLeft === 0
                  ? '（今天到期）'
                  : `（剩餘 ${parsed.daysLeft} 天）`
                : '';
            banner.innerHTML = `<span class="ani-offshelf-dot" aria-hidden="true">!</span><strong>即將下架提醒</strong><span>${escapeHtml(parsed.notice)}${escapeHtml(dayNote)}</span>`;
          }
        }
      } else {
        const expiringInCollection = [];
        for (const card of document.querySelectorAll('.theme-list-main')) {
          const sn = getSnFromHref(card.getAttribute('href'));
          const cover = card.querySelector('.theme-img-block');
          if (!cover) continue;
          const inlineMatch = parseOffshelfNotice(card.textContent || '');
          const hit = inlineMatch || (sn ? offshelfCache[sn] : null);
          if (inlineMatch && sn) {
            offshelfCache[sn] = {
              sn,
              title: (card.querySelector('.theme-name')?.textContent || '').trim(),
              ...inlineMatch,
              detectedAt: now,
            };
            cacheUpdated = true;
          }
          const existingBadge = cover.querySelector('.ani-offshelf-badge');
          if (!hit) {
            existingBadge?.remove();
            continue;
          }
          const cardTitle = (card.querySelector('.theme-name')?.textContent || hit.title || '').trim();
          expiringInCollection.push({ sn, title: cardTitle, dateText: hit.dateText, notice: hit.notice });
          const label = hit.daysLeft !== null && hit.daysLeft <= 30
            ? `${hit.daysLeft === 0 ? '今日' : `${hit.daysLeft}天`}下架`
            : hit.dateText
            ? `${hit.dateText} 下架`
            : '即將下架';
          const badge = existingBadge || document.createElement('span');
          badge.className = 'ani-offshelf-badge';
          badge.classList.toggle('has-score', Boolean(cover.querySelector('.ani-poster-score')));
          badge.textContent = label;
          if (!existingBadge) cover.append(badge);
        }

        if (location.pathname === '/mygather.php' && expiringInCollection.length) {
          const listWrap = document.querySelector('.animate-theme-list .theme-list-block');
          if (listWrap) {
            let banner = document.querySelector('.ani-offshelf-banner');
            if (!banner) {
              banner = document.createElement('div');
              banner.className = 'ani-offshelf-banner is-collection';
              banner.setAttribute('role', 'status');
              listWrap.before(banner);
            }
            const names = expiringInCollection.slice(0, 3).map((x) => x.title).filter(Boolean).join('、');
            const extra = expiringInCollection.length > 3 ? ` 等 ${expiringInCollection.length} 部` : '';
            banner.innerHTML = `<span class="ani-offshelf-dot" aria-hidden="true">!</span><strong>收藏即將下架提醒</strong><span>${escapeHtml(names)}${escapeHtml(extra)} 即將授權到期，建議優先補完！</span>`;
          }
        }
      }

      if (cacheUpdated) writeJsonLocal(OFFSHELF_CACHE_KEY, offshelfCache);
    };

    if (!offshelfSubscribed) {
      offshelfSubscribed = true;
      settingsListeners.add(() => { run(); });
    }
    run();
  };

  const state = {
    getSettings: () => currentSettings,
    onSettingsChange: (fn) => {
      settingsListeners.add(fn);
      return () => settingsListeners.delete(fn);
    },
    readSettings,
    writeSettings,
    storageGet,
    storageSet,
    escapeHtml,
    showToast,
    getSnFromHref,
    fetchTagSnSet,
    buildCatalogPageUrl,
    recordVideoProgress,
    reinit: async () => {
      await readSettings();
      await initCollectionStatusTagger();
      initCatalogEnhancements();
      await initSpoilerBlur();
      await initDanmuListTools();
      initLongEpisodeGrouping();
      await initEpisodeTitleTooltips();
      initOffshelfAlerts();
      initVideoHistoryTracker();
      await initPermanentHistoryPage();
    },
  };

  globalThis.AniEnhancements = state;

  const boot = async () => {
    await readSettings();
    await initCollectionStatusTagger();
    initCatalogEnhancements();
    await initSpoilerBlur();
    await initDanmuListTools();
    initLongEpisodeGrouping();
    await initEpisodeTitleTooltips();
    initOffshelfAlerts();
    initVideoHistoryTracker();
    await initPermanentHistoryPage();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { boot(); }, { once: true });
  } else {
    boot();
  }
})();
