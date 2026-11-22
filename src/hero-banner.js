(() => {
  'use strict';

  // Only extension-owned enrichment requests use this gate; native requests are untouched.
  const aniFetch = globalThis.AniAmbientFetch || (globalThis.AniAmbientFetch = (() => {
    const pending = new Map(); let tail = Promise.resolve(), last = 0, blockedUntil = 0;
    try { blockedUntil = Number(sessionStorage.getItem('aniRequestCooldown') || 0); } catch {}
    return (input, init) => {
      const key = String(input);
      if (pending.has(key)) return pending.get(key).then(r => r.clone ? r.clone() : r);
      const task = tail.catch(() => {}).then(async () => {
        if (blockedUntil > Date.now()) throw new Error('Extension requests paused after rate limit');
        const delay = Math.max(0, 400 - (Date.now() - last));
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        last = Date.now();
        const { timeoutMs, ...requestInit } = init || {};
        if (timeoutMs) requestInit.signal = AbortSignal.timeout(timeoutMs);
        const response = await globalThis.fetch(input, requestInit);
        if (response.status === 429 || response.status === 503) {
          blockedUntil = Date.now() + 10 * 60 * 1000;
          try { sessionStorage.setItem('aniRequestCooldown', String(blockedUntil)); } catch {}
        }
        return response;
      });
      pending.set(key, task); tail = task.then(() => {}, () => {});
      return task.then(r => r.clone ? r.clone() : r);
    };
  })());

  const KEY = 'aniHeroBannerV1', MAX = 10, TTL = 6 * 3600e3;
  const IMAGE_HOSTS = new Set(['truth.bahamut.com.tw', 'p2.bahamut.com.tw', 'i2.bahamut.com.tw']);
  let instance, syncState, enabledPreview = false;
  let homeIndexRequest;
  function getHomeIndex() {
    return homeIndexRequest ||= fetch('https://api.gamer.com.tw/anime/v1/index.php', {
      credentials: 'include', signal: AbortSignal.timeout(8000),
    }).then(response => {
      if (!response.ok) throw new Error('Homepage data unavailable');
      return response.json();
    }).catch(() => {
      homeIndexRequest = null;
      return null;
    });
  }
  function validImage(value) {
    try { const u = new URL(value); return u.protocol === 'https:' && IMAGE_HOSTS.has(u.hostname); } catch { return false; }
  }
  function candidates(doc) {
    return [...doc.querySelectorAll('.big_banner a[href]')].flatMap(a => {
      const image = a.querySelector('img');
      const src = image?.getAttribute('data-src') || image?.getAttribute('src');
      const url = new URL(a.getAttribute('href'), 'https://ani.gamer.com.tw/');
      return validImage(src) && url.origin === 'https://ani.gamer.com.tw' && /\/anime(?:Video|Ref)\.php$/.test(url.pathname)
        ? [{ image: src, href: url.href, seen: Date.now() }] : [];
    });
  }
  function metadata(doc) {
    let video;
    for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(script.textContent);
        video = (Array.isArray(data) ? data : data['@graph'] || [data]).find(x => x['@type'] === 'VideoObject') || video;
      } catch {}
    }
    const number = doc.querySelector('.score-overall-number')?.textContent.trim() || video?.aggregateRating?.ratingValue;
    const episodes = [...doc.querySelectorAll('.season li a')].map(a => a.textContent.trim()).filter(t => /^\d+(?:\.\d+)?$/.test(t));
    const count = video?.interactionStatistic?.find?.(x => /WatchAction/.test(x.interactionType?.['@type'] || x.interactionType || ''))?.userInteractionCount;
    const favoriteButton = doc.querySelector('.anime_name button[onclick*="toggleGather"], button[onclick*="animefun.toggleGather"]');
    const favoriteIds = favoriteButton?.getAttribute('onclick')?.match(/toggleGather\(\s*(\d+)\s*,\s*(\d+)/);
    const rawTitle = video?.name || doc.querySelector('.anime_name h1, .anime_name')?.textContent || doc.title;
    return {
      title: String(rawTitle || '').replace(/\s*\[\d+(?:\.\d+)?\].*$/, '').replace(/\s*線上看.*$/, '').trim(),
      description: String(video?.description || doc.querySelector('meta[name="description"]')?.content || '').replace(/^.*?線上看[!！]?\s*/, '').trim(),
      score: number && Number.isFinite(Number(number)) ? Number(number).toFixed(1) : null,
      views: Number.isFinite(Number(count)) && Number(count) > 0 ? Number(count) : null,
      episodes: episodes.length ? new Set(episodes).size : null,
      favorite: favoriteIds ? { acgSn: favoriteIds[1], animeSn: favoriteIds[2], saved: favoriteButton.classList.contains('ordered') } : null,
      version: 2, updated: Date.now(),
    };
  }
  const compact = n => n >= 1e4 ? `${(n / 1e4).toFixed(1)}萬` : n.toLocaleString('zh-TW');
  async function imageBlob(url) {
    if (typeof GM_xmlhttpRequest === 'function') return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({ method: 'GET', url, responseType: 'arraybuffer', timeout: 12000,
        onload: r => r.status === 200 ? resolve(new Blob([r.response], { type: r.responseHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1] || 'image/jpeg' })) : reject(new Error('image')),
        onerror: reject, ontimeout: reject });
    });
    if (globalThis.chrome?.runtime?.id) {
      const result = await chrome.runtime.sendMessage({ type: 'ani-cache-hero-image', url });
      if (!result?.base64) throw new Error('image unavailable');
      return new Blob([Uint8Array.from(atob(result.base64), c => c.charCodeAt(0))], { type: result.mime });
    }
    const response = await aniFetch(url, { credentials: 'omit', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('image unavailable');
    return response.blob();
  }
  async function cachedImage(url) {
    if (!validImage(url)) throw new Error('invalid image');
    const cache = await caches.open('ani-hero-images-v1');
    const key = `https://ani.gamer.com.tw/__ani_hero_image__?url=${encodeURIComponent(url)}`;
    let response = await cache.match(key);
    if (!response) {
      const blob = await imageBlob(url);
      if (!blob.type.startsWith('image/') || blob.size > 8 * 1024 * 1024) throw new Error('invalid image');
      response = new Response(blob, { headers: { 'Content-Type': blob.type } });
      await cache.put(key, response.clone());
      const keys = await cache.keys();
      for (const old of keys.slice(0, Math.max(0, keys.length - MAX))) await cache.delete(old);
    }
    return URL.createObjectURL(await response.blob());
  }
  function mount(enabled) {
    if (!/^\/(?:index\.php)?$/.test(location.pathname)) return;
    const host = document.querySelector('.big_banner');
    if (!host) return;
    enabledPreview = Boolean(enabled);
    host.classList.toggle('ani-hero-enabled', enabledPreview && Boolean(instance?.querySelector('.ani-hero-images img')));
    if (!enabledPreview) host.classList.remove('ani-hero-pending');
    syncState?.();
    if (!enabled || instance) return;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
    const native = candidates(document);
    const cachedEntries = Array.isArray(saved.entries) ? saved.entries : [];
    const entries = [...cachedEntries, ...native]
      .filter(x => validImage(x.image) && /^https:\/\/ani\.gamer\.com\.tw\/anime(?:Video|Ref)\.php\?/.test(x.href))
      .filter((x, i, all) => all.findIndex(y => y.image === x.image) === i).slice(-MAX);
    if (!entries.length) { host.classList.remove('ani-hero-enabled'); return; }
    const root = document.createElement('section');
    root.className = 'ani-hero';
    root.setAttribute('aria-label', '精選動畫輪播');
    root.setAttribute('aria-roledescription', '輪播');
    root.innerHTML = '<a class="ani-hero-open" aria-label="開啟精選動畫"><div class="ani-hero-images" aria-hidden="true"></div></a><div class="ani-hero-shade"></div><div class="ani-hero-panel"><div class="ani-hero-heading"><h2></h2><div class="ani-hero-stats"></div></div><p class="ani-hero-description"></p></div><a class="ani-hero-watch"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l14-8Z"/></svg>立即觀看</a><div class="ani-hero-dots" role="group" aria-label="選擇精選動畫"></div>';
    const buttons = [];
    for (const dir of [-1, 1]) {
      const button = document.createElement('button'); button.type = 'button';
      button.className = `ani-hero-arrow ani-hero-${dir < 0 ? 'prev' : 'next'}`;
      button.setAttribute('aria-label', dir < 0 ? '上一張精選動畫' : '下一張精選動畫');
      button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${dir < 0 ? 'm14 6-6 6 6 6' : 'm10 6 6 6-6 6'}"/></svg>`;
      button.addEventListener('click', () => show(index + dir)); root.append(button); buttons.push(button);
    }
    host.classList.add('ani-hero-pending');
    host.append(root); instance = root;
    const images = root.querySelector('.ani-hero-images'), dots = root.querySelector('.ani-hero-dots');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let index = -1, timer, paused = reduced, hover = false, focused = false, renderVersion = 0;
    const objectUrls = new Map(), loadingMetadata = new Map();
    let indexInfo;
    const getIndexInfo = () => indexInfo ||= getHomeIndex().then(result => {
        const rows = [], visit = value => {
          if (Array.isArray(value)) value.forEach(visit);
          else if (value && typeof value === 'object') {
            if (value.videoSn && value.popular) rows.push(value);
            else Object.values(value).forEach(visit);
          }
        }; visit(result?.data); return rows;
      }).catch(() => []);
    const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ entries, sampled: saved.sampled || 0, sampleVersion: 2 })); } catch {} };
    function schedule() {
      clearTimeout(timer);
      if (!paused && !hover && !focused && !document.hidden && host.classList.contains('ani-hero-enabled') && entries.length > 1)
        timer = setTimeout(() => show(index + 1), 7000);
    }
    syncState = schedule;
    function renderDots() {
      if (dots.children.length === entries.length) return;
      dots.replaceChildren();
      entries.forEach((entry, i) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', `第 ${i + 1} 張精選動畫`); b.addEventListener('click', () => show(i)); dots.append(b); });
      for (const b of buttons) b.disabled = entries.length < 2;
    }
    function renderInfo(entry) {
      const info = entry.meta;
      root.querySelector('h2').textContent = info?.title || '精選動畫';
      root.querySelector('h2').title = info?.title || '精選動畫';
      const description = info?.description || '';
      root.querySelector('.ani-hero-description').textContent = description.length > 180 ? description.slice(0, 180).trimEnd() + '...' : description;
      root.querySelector('.ani-hero-description').title = description;
      const stats = root.querySelector('.ani-hero-stats'); stats.replaceChildren();
      const icons = {
        score: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
        views: '<path fill-rule="evenodd" d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12Zm15 0a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z"/><circle cx="12" cy="12" r="2"/>',
        episodes: '<path fill-rule="evenodd" d="M6 2h12v2H6Zm-2 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm6 4v8l7-4Z"/>',
      };
      for (const [kind, label, text] of [ ['score', '評分', info?.score || (info ? '尚無評分' : null)], ['views', '觀看數', info?.views ? compact(info.views) : info ? '統計中' : null], ['episodes', '已上架集數', info?.episodes ? `已上架 ${info.episodes} 集` : info ? '集數更新中' : null] ]) {
        if (!text) continue;
        const pill = document.createElement('span'); pill.className = 'ani-hero-stat'; pill.setAttribute('aria-label', `${label} ${text}`);
        pill.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">${icons[kind]}</svg>`;
        pill.append(document.createTextNode(text)); stats.append(pill);
      }
      root.querySelector('.ani-hero-open').href = entry.href;
      root.querySelector('.ani-hero-open').setAttribute('aria-label', `觀看 ${info?.title || '精選動畫'}`);
      root.querySelector('.ani-hero-favorite')?.remove();
      if (info?.favorite && /^\d+$/.test(info.favorite.acgSn) && /^\d+$/.test(info.favorite.animeSn)) {
        const favorite = document.createElement('button'); favorite.type = 'button'; favorite.className = 'ani-hero-favorite';
        favorite.classList.toggle('ani-saved', info.favorite.saved);
        favorite.setAttribute('onclick', `event.preventDefault();event.stopPropagation();animefun.toggleGather(${info.favorite.acgSn},${info.favorite.animeSn},$(this),"ani-saved");return false;`);
        favorite.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
        const sync = () => { const saved = favorite.classList.contains('ani-saved'); favorite.setAttribute('aria-pressed', String(saved)); favorite.setAttribute('aria-label', saved ? '取消收藏動畫' : '收藏動畫'); favorite.title = favorite.getAttribute('aria-label'); if (info.favorite.saved !== saved) { info.favorite.saved = saved; persist(); } };
        new MutationObserver(sync).observe(favorite, { attributes: true, attributeFilter: ['class'] }); sync();
        root.querySelector('.ani-hero-heading').append(favorite);
      }
      root.querySelector('.ani-hero-watch').href = entry.href;
    }
    async function loadMeta(entry) {
      if (entry.meta?.version === 2 && entry.meta?.updated > Date.now() - TTL || loadingMetadata.has(entry.href)) return;
      const promise = aniFetch(entry.href, { credentials: 'same-origin', signal: AbortSignal.timeout(10000) }).then(r => { if (!r.ok) throw new Error('metadata'); return r.text(); })
        .then(async html => {
          entry.meta = metadata(new DOMParser().parseFromString(html, 'text/html'));
          const sn = new URL(entry.href).searchParams.get('sn');
          const row = (await getIndexInfo()).find(x => String(x.videoSn) === sn);
          if (row) {
            if (Number(row.popular) > 0) entry.meta.views = Number(row.popular);
            if (Number(row.totalEpisode) > 0) entry.meta.episodes = Number(row.totalEpisode);
          }
          persist(); if (entries[index] === entry) renderInfo(entry);
        }).catch(() => {}).finally(() => loadingMetadata.delete(entry.href));
      loadingMetadata.set(entry.href, promise); await promise;
    }
    async function show(next) {
      if (!entries.length) return;
      index = (next + entries.length) % entries.length; const entry = entries[index], version = ++renderVersion;
      renderDots(); renderInfo(entry); [...dots.children].forEach((b, i) => b.setAttribute('aria-current', String(i === index)));
      if (!reduced) root.querySelector('.ani-hero-panel')?.animate?.([{ opacity: 0.45, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' });
      const firstPaint = !images.children.length;
      const img = new Image();
      img.alt = '';
      if (firstPaint) img.fetchPriority = 'high';
      let src = objectUrls.get(entry.image);
      try {
        if (!src && !firstPaint) {
          try { src = await cachedImage(entry.image); objectUrls.set(entry.image, src); } catch {}
        }
        if (version !== renderVersion) return;
        img.src = src || entry.image;
        const alreadyDecoded = firstPaint && !src && img.complete && img.naturalWidth > 0;
        if (!alreadyDecoded) {
          try { await img.decode(); } catch (error) {
            if (!firstPaint || src || version !== renderVersion) throw error;
            src = await cachedImage(entry.image);
            if (version !== renderVersion) { URL.revokeObjectURL(src); return; }
            objectUrls.set(entry.image, src);
            img.src = src;
            await img.decode();
          }
        }
      } catch {
        if (version === renderVersion) {
          host.classList.remove('ani-hero-pending');
          schedule();
        }
        return;
      }
      if (version !== renderVersion) return;
      host.style.setProperty('--ani-hero-cover', 'url(' + JSON.stringify(img.src) + ')');
      const previous = [...images.children];
      const ambient = img.cloneNode(); ambient.className = 'ani-hero-ambient';
      images.append(ambient, img);
      host.classList.remove('ani-hero-pending');
      host.classList.toggle('ani-hero-enabled', enabledPreview);
      if (!reduced) previous.forEach(n => n.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'both' }));
      if (!firstPaint && !reduced) {
        ambient.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 450, fill: 'both' });
        img.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 450, fill: 'both' });
      }
      setTimeout(() => previous.forEach(n => n.remove()), 500);
      loadMeta(entry); schedule();
    }
    root.addEventListener('mouseenter', () => { hover = true; schedule(); }); root.addEventListener('mouseleave', () => { hover = false; schedule(); });
    root.addEventListener('focusin', () => { focused = true; schedule(); }); root.addEventListener('focusout', e => { if (!root.contains(e.relatedTarget)) { focused = false; schedule(); } });
    root.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); show(index + (e.key === 'ArrowLeft' ? -1 : 1)); } });
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('pagehide', () => { clearTimeout(timer); for (const u of objectUrls.values()) URL.revokeObjectURL(u); }, { once: true });
    // Start with today's native banner, keeping its cached metadata if present.
    const firstNativeIndex = entries.findIndex(entry => entry.image === native[0]?.image);
    const firstRender = show(Math.max(0, firstNativeIndex));
    persist();
    // A small bounded sample, at most once per six hours, never a polling loop.
    if (!(saved.sampled > Date.now() - TTL) || (entries.length < 6 && saved.sampleVersion !== 2)) {
      const sample = async () => {
        if (!enabledPreview || document.hidden) return;
        saved.sampled = Date.now(); persist();
        for (let attempt = 0; attempt < 1 && entries.length < 6; attempt++) {
          try {
            const r = await aniFetch('/', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) });
            if (!r.ok) break;
            for (const entry of candidates(new DOMParser().parseFromString(await r.text(), 'text/html'))) {
              if (entries.some(x => x.image === entry.image)) continue;
              entries.push(entry); persist(); renderDots(); schedule();
            }
          } catch { break; }
        }
      };
      firstRender.then(() => {
        setTimeout(() => {
          if (typeof requestIdleCallback === 'function') requestIdleCallback(() => { void sample(); }, { timeout: 3000 });
          else void sample();
        }, 2000);
      });
    }
  }
  globalThis.AniHeroBanner = { mount, candidates, metadata, getHomeIndex };
})();
