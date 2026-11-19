(() => {
  'use strict';

  // ── Shared Storage, Settings, Sanitization & Toast Helpers ──
  const SETTINGS_KEY = 'aniAmbientSettingsV1';
  const COL_STATUS_KEY = 'aniCollectionStatesV1';
  const PERM_HIST_KEY = 'aniPermanentHistoryV1';

  const COL_STATUS_META = [
    ['plan', '待看'],
    ['watching', '追番中'],
    ['completed', '已看完'],
    ['paused', '暫停'],
  ];
  const COL_STATUS_MAP = Object.fromEntries(COL_STATUS_META);

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
              opt.textContent = label;
              menu.append(opt);
            }
            const clearOpt = document.createElement('button');
            clearOpt.type = 'button';
            clearOpt.className = 'is-clear';
            clearOpt.dataset.choice = '';
            clearOpt.textContent = '清除標記';
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
            chipEl.textContent = st ? COL_STATUS_MAP[st] : '+ 標記狀態';
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
          header.innerHTML = '<h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>自訂收藏分類</h3>';
          const ul = document.createElement('ul');
          for (const [key, label] of [['all', '全部'], ...COL_STATUS_META, ['unset', '未分類']]) {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.filterStatus = key;
            btn.innerHTML = `${escapeHtml(label)} <small></small>`;
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
    const title = rawTitle.replace(/\s*\[\s*\d+(?:\.\d+)?\s*\]\s*$/, '').replace(/\s*-\s*巴哈姆特動畫瘋.*$/, '').trim() || `動畫 #${sn}`;
    const epFromNav = document.querySelector('.season li.playing a')?.textContent?.trim();
    const epFromTitle = rawTitle.match(/\[\s*(\d+(?:\.\d+)?)\s*\]\s*$/)?.[1];
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

    const tabs = document.createElement('div');
    tabs.className = 'ani-perm-tabs';
    tabs.setAttribute('role', 'tablist');
    const tabNative = document.createElement('button');
    tabNative.type = 'button';
    tabNative.className = 'ani-perm-tab';
    tabNative.setAttribute('role', 'tab');
    tabNative.textContent = '官方觀看紀錄';
    const tabPerm = document.createElement('button');
    tabPerm.type = 'button';
    tabPerm.className = 'ani-perm-tab';
    tabPerm.setAttribute('role', 'tab');
    tabPerm.textContent = '永久本地紀錄 (0)';
    tabs.append(tabNative, tabPerm);

    const panel = document.createElement('div');
    panel.className = 'ani-perm-history-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="ani-perm-toolbar">
        <input type="search" class="ani-perm-search" placeholder="搜尋永久觀看紀錄…" aria-label="搜尋永久觀看紀錄">
        <div class="ani-perm-filter-pills" role="group" aria-label="進度篩選">
          <button type="button" class="ani-perm-btn" data-perm-prog="all" aria-pressed="true">全部</button>
          <button type="button" class="ani-perm-btn" data-perm-prog="inprogress" aria-pressed="false">未看完</button>
          <button type="button" class="ani-perm-btn" data-perm-prog="completed" aria-pressed="false">已看完</button>
        </div>
        <div class="ani-perm-io-actions">
          <button type="button" class="ani-perm-btn" data-perm-export>匯出 JSON</button>
          <button type="button" class="ani-perm-btn" data-perm-import>匯入 JSON</button>
          <button type="button" class="ani-perm-btn is-danger" data-perm-clear>清空</button>
          <input type="file" data-perm-file accept="application/json,.json" hidden>
        </div>
      </div>
      <div class="ani-perm-grid"></div>
    `;

    shell.append(tabs, panel);
    if (nativeHistory && nativeHistory.parentElement === hostParent) nativeHistory.before(shell);
    else hostParent.prepend(shell);

    let progFilter = 'all';
    const searchEl = panel.querySelector('.ani-perm-search');
    const gridEl = panel.querySelector('.ani-perm-grid');
    const clearBtn = panel.querySelector('[data-perm-clear]');
    let clearArmed = false;

    const syncTabState = (records) => {
      const count = Object.keys(records || {}).length;
      tabPerm.textContent = `永久本地紀錄 (${count})`;
      const isPerm = permActiveTab === 'perm';
      tabNative.setAttribute('aria-selected', String(!isPerm));
      tabPerm.setAttribute('aria-selected', String(isPerm));
      panel.hidden = !isPerm;
      for (const el of document.querySelectorAll('.history, #historyList, .history-wrapper .anime-btn-show-more')) {
        el.classList.toggle('ani-perm-native-hidden', isPerm);
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
        return `
          <article class="ani-perm-card" data-perm-sn="${escapeHtml(it.sn)}">
            <div class="ani-perm-cover-wrap">
              ${cover ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(it.title)}" loading="lazy">` : ''}
              ${it.episode ? `<span class="ani-perm-ep-badge">EP.${escapeHtml(it.episode)}</span>` : ''}
            </div>
            <div class="ani-perm-info">
              <h4 class="ani-perm-title" title="${escapeHtml(it.title)}">${escapeHtml(it.title)}</h4>
              <div class="ani-perm-meta">
                <span>${formatMmSs(it.elapsedSec)} / ${formatMmSs(it.durationSec)}</span>
                <span>${formatDateTime(it.watchedAt)}</span>
              </div>
              <div class="ani-perm-bar"><div class="ani-perm-bar-fill" style="width:${pct}%"></div></div>
              ${epPills ? `<div class="ani-perm-eps">${epPills}</div>` : ''}
              <div class="ani-perm-actions">
                <a class="ani-perm-resume" href="animeVideo.php?sn=${resumeSn}">繼續觀看</a>
                <button type="button" class="ani-perm-del-btn" data-perm-delete="${escapeHtml(it.sn)}" aria-label="刪除「${escapeHtml(it.title)}」的本地紀錄" title="刪除此筆紀錄">✕</button>
              </div>
            </div>
          </article>
        `;
      }).join('');
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
    for (const pb of panel.querySelectorAll('[data-perm-prog]')) {
      pb.addEventListener('click', () => {
        progFilter = pb.dataset.permProg;
        for (const b of panel.querySelectorAll('[data-perm-prog]')) {
          b.setAttribute('aria-pressed', String(b === pb));
        }
        renderGrid();
      });
    }
    gridEl.addEventListener('click', async (ev) => {
      const del = ev.target.closest('[data-perm-delete]');
      if (!del) return;
      const sn = del.dataset.permDelete;
      await mutatePermanentHistory((data) => {
        if (!Object.hasOwn(data, sn)) return false;
        delete data[sn];
        return true;
      });
      showToast('已從永久本地紀錄刪除');
      renderGrid();
    });

    panel.querySelector('[data-perm-export]').addEventListener('click', async () => {
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

    const fileInput = panel.querySelector('[data-perm-file]');
    panel.querySelector('[data-perm-import]').addEventListener('click', () => fileInput.click());
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

    clearBtn.addEventListener('click', async () => {
      if (!clearArmed) {
        clearArmed = true;
        clearBtn.classList.add('is-armed');
        clearBtn.textContent = '再點確認清空';
        setTimeout(() => {
          clearArmed = false;
          clearBtn.classList.remove('is-armed');
          clearBtn.textContent = '清空';
        }, 3500);
        return;
      }
      clearArmed = false;
      clearBtn.classList.remove('is-armed');
      clearBtn.textContent = '清空';
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

  const state = {
    getSettings: () => currentSettings,
    onSettingsChange: (fn) => {
      settingsListeners.add(fn);
      return () => settingsListeners.delete(fn);
    },
    readSettings,
    storageGet,
    storageSet,
    escapeHtml,
    showToast,
    getSnFromHref,
    recordVideoProgress,
    reinit: async () => {
      await readSettings();
      await initCollectionStatusTagger();
      initVideoHistoryTracker();
      await initPermanentHistoryPage();
    },
  };

  globalThis.AniEnhancements = state;

  const boot = async () => {
    await readSettings();
    await initCollectionStatusTagger();
    initVideoHistoryTracker();
    await initPermanentHistoryPage();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { boot(); }, { once: true });
  } else {
    boot();
  }
})();
