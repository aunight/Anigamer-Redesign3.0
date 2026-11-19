chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type === 'ani-fetch-ip') {
    (async () => {
      try {
        const r = await fetch('https://ipwho.is/?fields=success,city,latitude,longitude', { signal: AbortSignal.timeout(7000) });
        if (!r.ok) { reply({ ok: false }); return; }
        reply({ ok: true, data: await r.json() });
      } catch { reply({ ok: false }); }
    })();
    return true;
  }
  if (message?.type === 'ani-fetch-weather') {
    (async () => {
      try {
        const lat = Number(message.lat), lon = Number(message.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) { reply({ ok: false }); return; }
        const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=5&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min`;
        const r = await fetch(u, { signal: AbortSignal.timeout(9000) });
        if (!r.ok) { reply({ ok: false }); return; }
        reply({ ok: true, data: await r.json() });
      } catch { reply({ ok: false }); }
    })();
    return true;
  }
  if (message?.type === 'ani-search-city') {
    (async () => {
      try {
        const q = String(message.q || '').trim();
        if (!q) { reply({ ok: false }); return; }
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=6&language=zh&name=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(7000) });
        if (!r.ok) { reply({ ok: false }); return; }
        reply({ ok: true, data: await r.json() });
      } catch { reply({ ok: false }); }
    })();
    return true;
  }
  if (message?.type === 'ani-fetch-reviews') {
    (async () => {
      try {
        const sn = String(message.fanpageId || '').replace(/\D+/g, '');
        if (!sn) { reply({ myReview: null, reviews: [] }); return; }
        const t = Number(message.mediaType || 4) || 4;
        const r = await fetch(`https://api.gamer.com.tw/acg/v1/reviews_list.php?sn=${encodeURIComponent(sn)}&t=${t}&sort=1&page=1`, {
          credentials: 'include',
          signal: AbortSignal.timeout(9000),
        });
        if (!r.ok) { reply({ myReview: null, reviews: [] }); return; }
        const json = await r.json();
        const mapReviewItem = (item) => ({
          id: String(item.id || ''),
          author: String(item.publisher?.name || '巴哈勇者'),
          avatar: String(item.publisher?.propic || ''),
          time: String(item.time || ''),
          rating: Number(item.reviews?.rating ?? item.rating ?? item.star ?? 0) || 0,
          likeCount: Number(item.likeCount || 0),
          commentCount: Number(item.commentCount || 0),
          content: String(item.content || '').trim(),
        });
        const rawReviewed = Array.isArray(json?.data?.reviewed)
          ? json.data.reviewed.flat(2)
          : json?.data?.reviewed
          ? [json.data.reviewed]
          : [];
        const myAnyRaw = rawReviewed.find(Boolean);
        const myRating = Number(myAnyRaw?.reviews?.rating ?? myAnyRaw?.rating ?? myAnyRaw?.star ?? myAnyRaw?.score ?? 0) || 0;
        const myRaw = rawReviewed.find((it) => it && (it.content || '').trim().length > 0);
        const myReview = myRaw ? mapReviewItem(myRaw) : null;
        const rawList = Array.isArray(json?.data?.list) ? json.data.list.flat(2) : [];
        const reviews = rawList
          .filter((item) => item && (item?.content || '').trim().length > 0 && (!myReview || String(item.id || '') !== myReview.id))
          .sort((a, b) => Number(b?.likeCount || 0) - Number(a?.likeCount || 0))
          .slice(0, 10)
          .map(mapReviewItem);
        reply({ myReview, myRating, reviews });
      } catch (err) {
        reply({ myReview: null, myRating: 0, reviews: [], error: String(err?.message || err || '') });
      }
    })();
    return true;
  }
  if (message?.type === 'ani-fetch-acg-credits') {
    (async () => {
      try {
        const url = new URL(message.url);
        if (!sender.tab?.url?.startsWith('https://ani.gamer.com.tw/') ||
            url.origin !== 'https://acg.gamer.com.tw' || url.pathname !== '/acgDetail.php' ||
            !/^\d+$/.test(url.searchParams.get('s') || '')) throw new Error('Invalid ACG page');
        const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(8000) });
        const html = response.ok ? await response.text() : '';
        reply({ credits: html.match(/<b>[＜<]\s*(?:製作團隊|製作人員|STAFF)[＞>]<\/b>[\s\S]{1,32000}?(?=<script|$)/i)?.[0] || '' });
      } catch { reply({}); }
    })();
    return true;
  }
  if (message?.type === 'ani-fetch-work-meta') {
    (async () => {
      try {
        if (!sender.tab?.url?.startsWith('https://ani.gamer.com.tw/')) {
          reply({ ok: false, items: {} });
          return;
        }
        const rawTitles = Array.isArray(message.titles) ? message.titles : [];
        const titles = [...new Set(rawTitles.map((t) => String(t || '').trim()).filter(Boolean))].slice(0, 15);
        if (!titles.length) {
          reply({ ok: true, items: {} });
          return;
        }
        const items = await fetchAniListWorkMetaBatch(titles);
        reply({ ok: true, items });
      } catch {
        reply({ ok: false, items: {} });
      }
    })();
    return true;
  }
  if (message?.type === 'ani-fetch-episode-titles') {
    (async () => {
      try {
        if (!sender.tab?.url?.startsWith('https://ani.gamer.com.tw/')) {
          reply({ ok: false, episodes: {} });
          return;
        }
        const title = String(message.title || '').trim();
        if (!title) {
          reply({ ok: true, episodes: {} });
          return;
        }
        const episodes = await fetchEpisodeTitles(title);
        reply({ ok: true, episodes });
      } catch {
        reply({ ok: false, episodes: {} });
      }
    })();
    return true;
  }
  if (message?.type === 'ani-fetch-infoplus') {
    (async () => {
      try {
        const results = await fetchAniInfoPlusData(message.acgUrl, message.fallbackTitle);
        reply({ results });
      } catch (err) {
        reply({ error: String(err?.message || err || '查詢失敗') });
      }
    })();
    return true;
  }
  if (message?.type !== 'ani-cache-hero-image') return;
  (async () => {
    try {
      const url = new URL(message.url);
      if (!sender.tab?.url?.startsWith('https://ani.gamer.com.tw/') || url.protocol !== 'https:' || !['truth.bahamut.com.tw', 'p2.bahamut.com.tw', 'i2.bahamut.com.tw'].includes(url.hostname)) throw new Error('invalid source');
      const response = await fetch(url.href, { credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(12000) });
      const mime = response.headers.get('content-type') || '';
      if (!response.ok || !mime.startsWith('image/')) throw new Error('invalid response');
      const data = new Uint8Array(await response.arrayBuffer());
      if (data.length > 8 * 1024 * 1024) throw new Error('image too large');
      let binary = ''; for (let i = 0; i < data.length; i += 32768) binary += String.fromCharCode(...data.subarray(i, i + 32768));
      reply({ base64: btoa(binary), mime });
    } catch { reply({ error: '無法快取圖片' }); }
  })();
  return true;
});

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function syoboiMonthIndex(title) {
  return Number(title.FirstYear) * 12 + Number(title.FirstMonth);
}

function syoboiSongType(heading) {
  if (heading.includes('オープニング')) return 'OP';
  if (heading.includes('エンディング')) return 'ED';
  if (heading.includes('挿入歌')) return '插入曲';
  if (heading.includes('主題歌')) return '主題曲';
  return null;
}

function parseSyoboiComment(comment) {
  const cast = [];
  const song = [];
  let section = null;
  for (let line of (comment || '').split(/\r?\n/)) {
    line = line.trim();
    if (line.startsWith('*')) {
      const heading = line.replace(/^\*+/, '').trim();
      const type = syoboiSongType(heading);
      if (heading.startsWith('キャスト')) {
        section = { kind: 'cast' };
      } else if (type) {
        const s = { type, title: heading.match(/「.*」/)?.[0] ?? 'N/A', singer: undefined };
        song.push(s);
        section = { kind: 'song', song: s };
      } else {
        section = null;
      }
      continue;
    }
    const match = line.match(/^:([^:]*):(.*)$/);
    if (!match || !section) continue;
    const [, key, value] = match;
    if (section.kind === 'cast') {
      cast.push({ char: key.trim(), cv: value.trim() });
    } else if (key.includes('歌') && !section.song.singer) {
      section.song.singer = value.trim();
    }
  }
  return { cast, song };
}

async function syoboiJson(params) {
  const urlObj = new URL('https://cal.syoboi.jp/json.php');
  for (const [k, v] of Object.entries(params)) {
    urlObj.searchParams.append(k, String(v));
  }
  const res = await fetch(urlObj.toString(), { credentials: 'omit', signal: AbortSignal.timeout(8000) });
  const text = await res.text();
  if (!text || !text.trim().startsWith('{')) return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function resolveWikiCast(cast) {
  if (!cast || !cast.length) return [];
  const cloned = cast.map(c => ({ ...c }));
  try {
    const names = [...new Set(cloned.map(c => c.cv).filter(Boolean))].slice(0, 50);
    if (!names.length) return cloned;
    const wikiUrl = new URL('https://ja.wikipedia.org/w/api.php');
    wikiUrl.searchParams.set('action', 'query');
    wikiUrl.searchParams.set('format', 'json');
    wikiUrl.searchParams.set('prop', 'langlinks|pageprops');
    wikiUrl.searchParams.set('titles', names.join('|'));
    wikiUrl.searchParams.set('redirects', '1');
    wikiUrl.searchParams.set('lllang', 'zh');
    wikiUrl.searchParams.set('lllimit', '100');
    wikiUrl.searchParams.set('ppprop', 'disambiguation');
    const res = await fetch(wikiUrl.toString(), { credentials: 'omit', signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    const pages = Object.values(data?.query?.pages || {});
    const redirects = data?.query?.redirects || [];
    const normalized = data?.query?.normalized || [];
    for (const item of cloned) {
      let targetTitle = item.cv;
      for (const n of normalized) if (n.from === targetTitle) targetTitle = n.to;
      for (const r of redirects) if (r.from === targetTitle) targetTitle = r.to;
      const page = pages.find(p => p.title === targetTitle || p.title === item.cv);
      if (page && page.missing === undefined) {
        const zhName = page.langlinks?.[0]?.['*'];
        item.wikiUrl = zhName
          ? `https://zh.wikipedia.org/zh-tw/${encodeURIComponent(zhName)}`
          : `https://ja.wikipedia.org/wiki/${encodeURIComponent(targetTitle)}`;
        item.wikiText = zhName ? 'Wiki' : 'WikiJP';
      }
    }
  } catch {}
  return cloned;
}

async function getSyoboiByTid(tid) {
  if (!tid) return null;
  const json = await syoboiJson({ Req: 'TitleFull', TID: tid });
  const data = json?.Titles?.[tid];
  if (!data) return null;
  const title = data.Title;
  const parsed = parseSyoboiComment(data.Comment ?? '');
  const cast = await resolveWikiCast(parsed.cast);
  return {
    source: `https://cal.syoboi.jp/tid/${tid}`,
    title,
    cast,
    song: parsed.song,
  };
}

async function fetchMalSongs(idMal) {
  if (!idMal) return [];
  try {
    const res = await fetch(`https://myanimelist.net/anime/${idMal}`, {
      credentials: 'omit',
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const opIdx = html.indexOf('theme-songs js-theme-songs opnening');
    const edIdx = html.indexOf('theme-songs js-theme-songs ending');
    const parseBlock = (blockHtml, label) => {
      if (!blockHtml) return [];
      const out = [];
      const seen = new Set();
      for (const m of blockHtml.matchAll(/<tr[\s\S]*?<\/tr>/g)) {
        const clean = decodeHtmlEntities(
          m[0]
            .replace(/<script[\s\S]*?<\/script>/g, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        );
        if (!clean || /Spotify|Apple Music|Amazon Music|No opening|No ending/i.test(clean)) continue;
        const parsed = clean.match(/^(?:\d+:\s*)?"([^"]+)"\s+by\s+(.+?)(?:\s*\(eps\s*[^)]*\))?$/i);
        if (parsed) {
          const title = `「${parsed[1].trim()}」`;
          const singer = parsed[2].replace(/\s*Spotify[\s\S]*$/i, '').trim();
          const key = `${label}|${title}`;
          if (!seen.has(key)) {
            seen.add(key);
            out.push({ type: label, title, singer });
          }
        }
      }
      return out;
    };
    const opBlock = opIdx !== -1 ? html.slice(opIdx, edIdx !== -1 && edIdx > opIdx ? edIdx : opIdx + 12000) : '';
    const edEnd = edIdx !== -1 ? Math.min(edIdx + 12000, html.indexOf('<div class="clearfix', edIdx) !== -1 ? html.indexOf('<div class="clearfix', edIdx) : edIdx + 12000) : -1;
    const edBlock = edIdx !== -1 ? html.slice(edIdx, edEnd) : '';
    return [...parseBlock(opBlock, 'OP'), ...parseBlock(edBlock, 'ED')];
  } catch {
    return [];
  }
}

async function fetchFromAniList(candidates) {
  for (const search of candidates) {
    if (!search || search.length < 2) continue;
    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(9000),
        body: JSON.stringify({
          query: `query ($search: String) {
            Media(search: $search, type: ANIME) {
              id
              idMal
              siteUrl
              title { native romaji english }
              characters(sort: ROLE, perPage: 25) {
                edges {
                  node { name { native full } }
                  voiceActors(language: JAPANESE) { name { native full } }
                }
              }
            }
          }`,
          variables: { search },
        }),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const media = json?.data?.Media;
      const edges = media?.characters?.edges || [];
      if (!media) continue;
      const rawCast = [];
      for (const e of edges) {
        const va = e.voiceActors?.[0];
        if (!va) continue;
        const charName = e.node?.name?.native || e.node?.name?.full || '';
        const cvName = (va.name?.native || va.name?.full || '').replace(/\s+/g, '');
        if (charName || cvName) rawCast.push({ char: charName, cv: cvName });
      }
      const [cast, song] = await Promise.all([
        resolveWikiCast(rawCast),
        fetchMalSongs(media.idMal),
      ]);
      if (!cast.length && !song.length) continue;
      return [{
        source: media.siteUrl || `https://anilist.co/anime/${media.id}`,
        title: media.title?.native || media.title?.romaji || media.title?.english || search,
        cast,
        song,
      }];
    } catch {}
  }
  return [];
}

async function fetchAniInfoPlusData(acgUrl, fallbackTitle) {
  let nameJp = '';
  let nameEn = '';
  let site = '';
  let fullUrl = '';
  let onAirMonth = null;
  if (acgUrl) {
    try {
      const normalizedAcgUrl = acgUrl.startsWith('//') ? 'https:' + acgUrl : acgUrl;
      const acgRes = await fetch(normalizedAcgUrl, { credentials: 'omit', signal: AbortSignal.timeout(10000) });
      const acgHtml = await acgRes.text();
      const container = acgHtml.match(/<div class="ACG-info-container"[\s\S]*?<\/div>/)?.[0] || acgHtml;
      const h2s = [...container.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map(m => decodeHtmlEntities(m[1].trim()));
      nameJp = h2s[0] || '';
      nameEn = h2s[1] || '';
      const boxA = acgHtml.match(/<ul class="ACG-box1listA">([\s\S]*?)<\/ul>/)?.[1] || '';
      const boxB = acgHtml.match(/<ul class="ACG-box1listB">([\s\S]*?)<\/ul>/)?.[1] || '';
      const timeLi = [...boxA.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(m => m[1].replace(/<[^>]+>/g, '')).find(t => t.includes('當地')) || '';
      onAirMonth = timeLi.match(/(\d{4})-(\d{2})/)?.slice(1, 3).join('-') || null;
      const siteHref = [...boxB.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(m => m[1]).find(t => t.includes('官方網站'))?.match(/href="([^"]+)"/)?.[1] || '';
      try {
        fullUrl = new URL(siteHref.startsWith('//') ? 'https:' + siteHref : siteHref).searchParams.get('url') || '';
        site = fullUrl ? new URL(fullUrl).hostname.replace(/^www\./, '') : '';
      } catch {}
    } catch {}
  }

  let searchSite = site;
  const exceptionSites = ['tv-tokyo.co.jp', 'tbs.co.jp', 'sunrise-inc.co.jp', 'sh-anime.shochiku.co.jp', 'fujitv.co.jp', 'tohoanimation.jp'];
  if (searchSite && exceptionSites.includes(searchSite) && fullUrl) {
    for (const ex of exceptionSites) {
      const m = fullUrl.match(new RegExp(`(${ex.replace(/\./g, '\\.')}(?:\/anime)?\/[^/?#]+)`));
      if (m?.[1]) {
        searchSite = m[1];
        break;
      }
    }
  }

  const cleanTitle = (t) => (t || '').replace(/\s*\[\s*\d+(?:\.\d+)?\s*\]\s*$/, '').replace(/\s*EP\.\d+(?:\.\d+)?\s*$/i, '').trim();
  const baseJp = cleanTitle(nameJp);
  const strippedJp = baseJp.replace(/\s*(?:第\d+期|Season\s*\d+|シーズン\s*\d+|Part\s*\d+|Ⅱ|II|2)\s*$/i, '').trim();
  const prefixJp = strippedJp.split(/[\s　～〜\-－:：!！?？]/)[0]?.trim() || '';
  const cleanFallback = cleanTitle(fallbackTitle);

  const queries = [];
  if (searchSite) queries.push({ q: searchSite, strictMonth: true });
  if (baseJp) queries.push({ q: baseJp, strictMonth: false });
  if (strippedJp && strippedJp !== baseJp) queries.push({ q: strippedJp, strictMonth: false });
  if (prefixJp && prefixJp.length >= 3 && prefixJp !== strippedJp) queries.push({ q: prefixJp, strictMonth: false });
  if (nameEn && nameEn.length >= 3) queries.push({ q: nameEn, strictMonth: false });

  const targetMonth = onAirMonth ? (() => { const [y, m] = onAirMonth.split('-').map(Number); return y * 12 + m; })() : null;

  let matchedTid = null;
  for (const { q, strictMonth } of queries) {
    const json = await syoboiJson({ Req: 'TitleSearch', Search: q, Limit: 100 });
    if (!json) break; // Syoboi rate-limited/blocked; fall back immediately to AniList
    const titles = Object.values(json?.Titles || {});
    if (!titles.length) continue;
    if (targetMonth) {
      const ranked = titles
        .map(t => ({ t, diff: Math.abs(syoboiMonthIndex(t) - targetMonth) }))
        .sort((a, b) => a.diff - b.diff);
      if (strictMonth) {
        const within = ranked.find(r => r.diff <= 2);
        if (within) { matchedTid = within.t.TID; break; }
      } else {
        matchedTid = ranked[0].t.TID;
        break;
      }
    } else {
      matchedTid = titles[0].TID;
      break;
    }
  }

  if (matchedTid) {
    const primary = await getSyoboiByTid(matchedTid);
    if (primary) {
      return [primary];
    }
  }

  // Fallback 1: AniList GraphQL (Japanese / English candidates)
  let aniListResults = await fetchFromAniList([baseJp, strippedJp, nameEn, prefixJp]);
  if (aniListResults.length) return aniListResults;

  // Fallback 2: Bangumi v0 search resolves Traditional Chinese -> exact Japanese title -> AniList + MAL
  if (cleanFallback && cleanFallback.length >= 2) {
    try {
      const bgmRes = await fetch('https://api.bgm.tv/v0/search/subjects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'aunight/Anigamer-Redesign3.0 (https://github.com/aunight/Anigamer-Redesign3.0)',
        },
        signal: AbortSignal.timeout(7000),
        body: JSON.stringify({ keyword: cleanFallback, filter: { type: [2] } }),
      });
      if (bgmRes.ok) {
        const bgmData = await bgmRes.json();
        const jpFromBgm = (bgmData?.data?.[0]?.name || '').trim();
        if (jpFromBgm) {
          aniListResults = await fetchFromAniList([
            jpFromBgm,
            jpFromBgm.split(/[\s　～〜\-－:：]/)[0]?.trim(),
          ]);
          if (aniListResults.length) return aniListResults;
        }
      }
    } catch {}
  }

  if (cleanFallback) {
    aniListResults = await fetchFromAniList([cleanFallback]);
    if (aniListResults.length) return aniListResults;
  }

  return [];
}

const ANILIST_SOURCE_MAP = {
  MANGA: 'manga',
  LIGHT_NOVEL: 'light_novel',
  VIDEO_GAME: 'game',
  VISUAL_NOVEL: 'game',
  ORIGINAL: 'original',
};

async function fetchAniListWorkMetaBatch(titles) {
  const cleanSearch = (t) =>
    String(t || '')
      .replace(/\s*\[\s*\d+(?:\.\d+)?\s*\]\s*$/, '')
      .replace(/\s*(?:第[一二三四五六七八九十\d]+[季期部]|Season\s*\d+|Part\s*\d+)\s*$/i, '')
      .trim();

  const items = {};
  const varDecls = [];
  const variables = {};
  const aliases = [];
  const entries = titles.map((orig, idx) => ({ orig, search: cleanSearch(orig) || orig, key: `m${idx}` }));

  for (const e of entries) {
    varDecls.push(`$${e.key}: String`);
    variables[e.key] = e.search;
    aliases.push(
      `${e.key}: Page(perPage: 1) { media(search: $${e.key}, type: ANIME, sort: SEARCH_MATCH) { id source format duration episodes studios(isMain: true) { nodes { name } } } }`
    );
  }

  try {
    const query = `query (${varDecls.join(', ')}) { ${aliases.join(' ')} }`;
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(9000),
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) return items;
    const json = await res.json();
    const data = json?.data || {};
    for (const e of entries) {
      const m = data[e.key]?.media?.[0];
      if (!m) continue;
      const duration = Number(m.duration) || 0;
      const format = String(m.format || '');
      const source = ANILIST_SOURCE_MAP[m.source] || 'other';
      const isShort =
        format === 'TV_SHORT' ||
        format === 'ONA' ||
        format === 'SPECIAL' ||
        (duration > 0 && duration <= 15);
      items[e.orig] = {
        source,
        format,
        duration,
        episodes: Number(m.episodes) || 0,
        isShort,
        studio: String(m.studios?.nodes?.[0]?.name || ''),
      };
    }
  } catch {}
  return items;
}

async function fetchEpisodeTitles(rawTitle) {
  const cleanTitle = String(rawTitle || '')
    .replace(/\s*(?:\[\s*\d+(?:\.\d+)?\s*\]|EP\.?\s*\d+(?:\.\d+)?)\s*$/i, '')
    .replace(/\s*-\s*巴哈姆特動畫瘋.*$/, '')
    .replace(/\s*\[(?:特別篇|劇場版|電影版|OAD|OVA|中文配音|年齡限制版)\]\s*/g, ' ')
    .trim();
  const stripped = cleanTitle
    .replace(/\s*(?:第[一二三四五六七八九十\d]+[季期部]|Season\s*\d+|Part\s*\d+)\s*$/i, '')
    .trim();
  const candidates = [...new Set([cleanTitle, stripped].filter((s) => s.length >= 2))];
  const episodes = {};

  for (const kw of candidates) {
    try {
      const sRes = await fetch('https://api.bgm.tv/v0/search/subjects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'aunight/Anigamer-Redesign3.0 (https://github.com/aunight/Anigamer-Redesign3.0)',
        },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({ keyword: kw, filter: { type: [2] } }),
      });
      if (!sRes.ok) continue;
      const sJson = await sRes.json();
      const subjectId = sJson?.data?.[0]?.id;
      if (!subjectId) continue;

      for (let offset = 0; offset <= 200; offset += 100) {
        const epRes = await fetch(
          `https://api.bgm.tv/v0/episodes?subject_id=${subjectId}&type=0&limit=100&offset=${offset}`,
          {
            headers: {
              'User-Agent': 'aunight/Anigamer-Redesign3.0 (https://github.com/aunight/Anigamer-Redesign3.0)',
            },
            signal: AbortSignal.timeout(8000),
          },
        );
        if (!epRes.ok) break;
        const epJson = await epRes.json();
        const rows = Array.isArray(epJson?.data) ? epJson.data : [];
        for (const ep of rows) {
          const epNum = ep?.sort ?? ep?.ep;
          if (epNum === undefined || epNum === null) continue;
          const name = String(ep.name_cn || ep.name || '').trim();
          const jp = String(ep.name || '').trim();
          if (!name && !jp) continue;
          episodes[String(epNum)] = {
            name: name || jp,
            jp,
            airdate: String(ep.airdate || '').trim(),
          };
        }
        const total = Number(epJson?.total) || rows.length;
        if (offset + 100 >= total || rows.length < 100) break;
      }
      if (Object.keys(episodes).length > 0) return episodes;
    } catch {}
  }

  for (const kw of candidates) {
    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          query: `query ($search: String) { Page(perPage: 1) { media(search: $search, type: ANIME, sort: SEARCH_MATCH) { streamingEpisodes { title } } } }`,
          variables: { search: kw },
        }),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const streamEps = json?.data?.Page?.media?.[0]?.streamingEpisodes || [];
      for (const se of streamEps) {
        const raw = String(se?.title || '').trim();
        const m = raw.match(/(?:Episode|EP\.?|#)\s*(\d+(?:\.\d+)?)\s*(?:[-–—:]\s*(.+))?$/i);
        if (!m) continue;
        const num = String(Number(m[1]));
        const sub = (m[2] || '').trim();
        if (sub) {
          episodes[num] = { name: sub, jp: '', airdate: '' };
        }
      }
      if (Object.keys(episodes).length > 0) return episodes;
    } catch {}
  }

  return episodes;
}
