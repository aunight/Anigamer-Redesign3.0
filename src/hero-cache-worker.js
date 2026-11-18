chrome.runtime.onMessage.addListener((message, sender, reply) => {
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
      if (!media || !edges.length) continue;
      const rawCast = [];
      for (const e of edges) {
        const va = e.voiceActors?.[0];
        if (!va) continue;
        const charName = e.node?.name?.native || e.node?.name?.full || '';
        const cvName = (va.name?.native || va.name?.full || '').replace(/\s+/g, '');
        if (charName || cvName) rawCast.push({ char: charName, cv: cvName });
      }
      if (!rawCast.length) continue;
      const cast = await resolveWikiCast(rawCast);
      return [{
        source: media.siteUrl || `https://anilist.co/anime/${media.id}`,
        title: media.title?.native || media.title?.romaji || media.title?.english || search,
        cast,
        song: [],
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

  // Fallback: AniList GraphQL (reliable CORS-enabled Japanese cast database)
  const aniListResults = await fetchFromAniList([baseJp, strippedJp, nameEn, prefixJp, cleanFallback]);
  if (aniListResults.length) return aniListResults;

  return [];
}
