function parseBahamutWorkOrigin(html) {
  const origin = html.match(/原作性質[：:]\s*([^<（(]+)/)?.[1]?.trim() || '';
  if (!origin) return null;
  const source = /輕小說|ライトノベル/.test(origin) ? 'light_novel'
    : /漫畫|漫画/.test(origin) ? 'manga'
    : /遊戲|游戏/.test(origin) ? 'game'
    : /原創|原创/.test(origin) ? 'original' : 'other';
  return { source, isShort: /泡麵番|輕動畫|短篇動畫/.test(html.match(/作品類型[：:]\s*([^<]+)/)?.[1] || '') };
}

function extractYoutubeThemeVideoId(html, songTitle) {
  const match = String(html || '').match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/);
  if (!match) {
    const fallback = String(html || '').match(/"videoId":"([A-Za-z0-9_-]{11})"/);
    return fallback ? fallback[1] : '';
  }
  try {
    const data = JSON.parse(match[1]);
    const candidates = [];
    const collect = (node) => {
      if (!node || typeof node !== 'object' || candidates.length >= 8) return;
      const vr = node.videoRenderer;
      if (vr && /^[A-Za-z0-9_-]{11}$/.test(vr.videoId || '')) {
        const videoTitle = (vr.title?.runs || []).map((r) => r.text || '').join('');
        const lengthText = vr.lengthText?.simpleText || '';
        const parts = lengthText.split(':');
        const isShort =
          /#shorts\b/i.test(videoTitle) ||
          (parts.length === 2 && Number(parts[0]) === 0 && Number(parts[1]) < 45);
        candidates.push({ id: vr.videoId, title: videoTitle, isShort });
        return;
      }
      if (Array.isArray(node)) {
        for (const item of node) collect(item);
      } else {
        for (const val of Object.values(node)) collect(val);
      }
    };
    collect(data);
    if (!candidates.length) return '';
    const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
    const splitTerms = (s) => {
      const raw = String(s || '').replace(/^[「『]|[」』]$/g, '').trim();
      const inner = [...raw.matchAll(/[（(]([^()（）]+)[）)]/g)].map((m) => m[1].trim()).filter(Boolean);
      const outer = raw.replace(/[（(][^()（）]*[）)]/g, ' ').replace(/\s+/g, ' ').trim();
      const hasJp = (v) => /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(v);
      const ordered = [...inner, outer, raw].filter(Boolean);
      return [...new Set([...ordered.filter(hasJp), ...ordered])];
    };
    const keys = splitTerms(songTitle).map(norm).filter(Boolean);
    const ranked = [...candidates].sort((a, b) => {
      const aMatch = keys.some((k) => norm(a.title).includes(k)) ? 1 : 0;
      const bMatch = keys.some((k) => norm(b.title).includes(k)) ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      if (a.isShort !== b.isShort) return a.isShort ? 1 : -1;
      const aCover = /piano|ピアノ|cover|female\s*vocal|male\s*vocal|歌ってみた|弾いてみた|譜面|楽譜|karaoke|カラオケ|nightcore/i.test(a.title) ? 1 : 0;
      const bCover = /piano|ピアノ|cover|female\s*vocal|male\s*vocal|歌ってみた|弾いてみた|譜面|楽譜|karaoke|カラオケ|nightcore/i.test(b.title) ? 1 : 0;
      if (aCover !== bCover) return aCover - bCover;
      const aOfficial = /official|music\s*video|\bmv\b|ノンクレジット|opening|ending|主題歌/i.test(a.title) ? 1 : 0;
      const bOfficial = /official|music\s*video|\bmv\b|ノンクレジット|opening|ending|主題歌/i.test(b.title) ? 1 : 0;
      return bOfficial - aOfficial;
    });
    return ranked[0]?.id || '';
  } catch {
    return '';
  }
}

async function fetchYoutubeThemeVideoId(title, artist, request) {
  const cleanTitle = String(title || '').replace(/^[「『]|[」』]$/g, '').trim();
  if (!cleanTitle || typeof request !== 'function') return '';
  const hasJp = (v) => /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(v);
  const titleInners = [...cleanTitle.matchAll(/[（(]([^()（）]+)[）)]/g)].map((m) => m[1].trim()).filter(Boolean);
  const titleOuter = cleanTitle.replace(/[（(][^()（）]*[）)]/g, ' ').replace(/\s+/g, ' ').trim();
  const titleVariants = [...new Set([...titleInners.filter(hasJp), titleOuter, cleanTitle].filter(Boolean))];
  const rawArtist = String(artist || '').replace(/\b(?:feat|ft|cv)\.?(?=\s|$|\W)/gi, ' ');
  const artistInners = [...rawArtist.matchAll(/[（(]([^()（）]+)[）)]/g)].map((m) => m[1].trim()).filter(Boolean);
  const artistOuter = rawArtist.replace(/[（(][^()（）]*[）)]/g, ' ').replace(/[()（）「」『』\[\]\/／]/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanArtist = rawArtist.replace(/[()（）「」『』\[\]\/／]/g, ' ').replace(/\s+/g, ' ').trim();
  const primaryArtist = (artistInners.find(hasJp) || artistOuter || cleanArtist).split(/\s+/)[0] || '';
  const hasBilingualTitle = titleInners.some(hasJp) && titleOuter !== cleanTitle;
  const queries = [...new Set([
    ...(hasBilingualTitle ? titleVariants.map((t) => (primaryArtist ? `${t} ${primaryArtist}` : '')) : []),
    cleanArtist ? `${cleanTitle} ${cleanArtist}` : '',
    primaryArtist ? `${cleanTitle} ${primaryArtist}` : '',
    ...titleVariants,
  ].filter(Boolean))];
  for (const query of queries) {
    try {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      const res = await request(url, {
        headers: { 'Accept-Language': 'ja,zh-TW;q=0.9,en;q=0.8' },
      });
      if (!res?.ok) continue;
      const html = typeof res.text === 'function' ? await res.text() : '';
      const id = extractYoutubeThemeVideoId(html, cleanTitle);
      if (id) return id;
    } catch {}
  }
  return '';
}
