// Traditional Chinese summaries for episodes with a Japanese-only source.
const traditionalEpisodeDescriptions = new Map([
  [1749241, '颯太在自家咖啡店替小春解圍，發現看似冷淡的她其實怕生，也不擅長拍照。他決定教她拍照，幫她交朋友。'],
  [1749242, '小春鼓起勇氣約颯太喝珍珠奶茶。兩人因拍照越走越近，但她提出週末一起吃甜點時，颯太卻婉拒了。'],
  [1749243, '颯太和小春找各自的朋友幫忙準備約會服裝。聽完雫的戀愛建議後，颯太意外向小春告白。'],
  [1749244, '約會前夕，小春突然失聯。得知是她父親要求取消約會後，颯太決定當面說服他。'],
  [1749245, '互相告白後，颯太和小春迎來第一次約會。擔心感情停滯的颯太向凜香求助，凜香也開始察覺自己的心意。'],
  [1749246, '颯太和小春到海邊玩，除了遇見當地女孩圓花，還和朋友們會合。害羞的小春卻因為穿泳裝躲到岩石後面。'],
  [1749247, '泳裝被看見後，小春慌張逃走。在圓花直率的勸說和鼓勵下，她決定回去面對颯太。'],
  // https://sasapi-anime.com/story_2nd.html
  [1748350, '小嗶誤觸直播，把自己和艾莎的影像傳上網。星崎小姐、鄰居妹妹等人循著影片找到了他們的藏身處。'],
]);

async function fetchEpisodeTitles(rawTitle, request = fetch, acgUrl = '') {
  const cleanTitle = String(rawTitle || '')
    .replace(/\s*(?:\[\s*\d+(?:\.\d+)?\s*\]|EP\.?\s*\d+(?:\.\d+)?)\s*$/i, '')
    .replace(/\s*-\s*巴哈姆特動畫瘋.*$/, '')
    .replace(/\s*\[(?:特別篇|劇場版|電影版|OAD|OVA|中文配音|年齡限制版)\]\s*/g, ' ')
    .trim();
  const stripped = cleanTitle
    .replace(/\s*(?:第[一二三四五六七八九十\d]+[季期部]|Season\s*\d+|Part\s*\d+)\s*$/i, '')
    .trim();
  const strippedSeason = stripped !== cleanTitle;
  let nativeTitle = '';
  let premiere = '';
  if (/^https:\/\/acg\.gamer\.com\.tw\/acgDetail\.php\?s=\d+$/.test(acgUrl)) {
    try {
      const response = await request(acgUrl, { signal: AbortSignal.timeout(8000) });
      if (response.ok) {
        const html = await response.text();
        premiere = html.match(/當地首播[：:]\s*(\d{4}-\d{2}-\d{2})/)?.[1] || '';
        nativeTitle = html.match(/<h1[^>]*>[^<]*<\/h1>\s*<h2[^>]*>([^<]+)<\/h2>/i)?.[1]?.replace(/&amp;/g, '&').trim() || '';
      }
    } catch {}
  }
  const candidates = [...new Set([nativeTitle, cleanTitle].filter(s => s.length >= 2))];
  let episodes = {};

  for (const kw of candidates) {
    try {
      const sRes = await request('https://api.bgm.tv/v0/search/subjects', {
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
      const normalize = text => String(text || '').normalize('NFKC').replace(/(?:シーズン|season)\s*(\d+)|第\s*(\d+)\s*[期季]/gi, (_, a, b) => 'season' + (a || b)).replace(/[\s\p{P}]/gu, '').toLowerCase();
      let subject = sJson?.data?.find(item => [item.name, item.name_cn, ...(Array.isArray(item.alias) ? item.alias : [])]
        .some(name => normalize(name) === normalize(kw)));
      if (!subject && kw === nativeTitle && premiere) {
        const [year, month] = premiere.split('-');
        for (let offset = 0; offset < 300; offset += 100) {
          const res = await request(`https://api.bgm.tv/v0/subjects?type=2&year=${year}&month=${Number(month)}&limit=100&offset=${offset}`, { signal: AbortSignal.timeout(8000) });
          if (!res.ok) break;
          const page = await res.json();
          subject = page.data?.find(item => normalize(item.name) === normalize(nativeTitle));
          if (subject || offset + 100 >= page.total || !page.data?.length) break;
        }
      }
      if (!subject && !nativeTitle && kw === cleanTitle && !strippedSeason) subject = sJson?.data?.[0];
      const subjectId = subject?.id;
      if (!subjectId) continue;

      const matchedEpisodes = {};
      for (let offset = 0; offset <= 200; offset += 100) {
        const epRes = await request(
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
          const name = String(ep.name_cn || '').trim();
          const jp = String(ep.name || '').trim();
          const description = traditionalEpisodeDescriptions.get(ep.id) || (typeof ep.desc === 'string' ? ep.desc.trim() : '');
          if (!name && !description) continue;
          matchedEpisodes[String(epNum)] = {
            name,
            jp,
            airdate: String(ep.airdate || '').trim(),
            description,
          };
        }
        const total = Number(epJson?.total) || rows.length;
        if (offset + 100 >= total || rows.length < 100) break;
      }
      if (Object.values(matchedEpisodes).some(ep => ep.name)) return matchedEpisodes;
      if (Object.keys(episodes).length === 0) episodes = matchedEpisodes;
    } catch {}
  }

  for (const kw of candidates) {
    try {
      const res = await request('https://graphql.anilist.co', {
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
          episodes[num] = { jp: '', airdate: '', ...episodes[num], name: sub };
        }
      }
      if (Object.values(episodes).some(ep => ep.name)) return episodes;
    } catch {}
  }

  return episodes;
}
