function workSynopsisIdentity(html) {
  return {
    title: html.match(/<h1[^>]*>[^<]*<\/h1>\s*<h2[^>]*>([^<]+)<\/h2>/i)?.[1]?.replace(/&amp;/g, '&').trim() || '',
    year: Number(html.match(/當地首播[：:]\s*(\d{4})[-/]/)?.[1]) || 0,
  };
}

function synopsisPlainText(value) {
  return (typeof value === 'string' ? value : '')
    .replace(/<br\s*\/?\s*>|<\/(?:p|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(?:amp|quot|apos|nbsp|lt|gt|#39|#x27);/gi, entity => ({
      '&amp;': '&', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ', '&lt;': '<', '&gt;': '>', '&#39;': "'", '&#x27;': "'",
    })[entity.toLowerCase()])
    .trim();
}

async function translateWorkSynopsis(value, request) {
  const text = synopsisPlainText(value);
  if (!text || text.length > 5000) return '';
  const han = (text.match(/\p{Script=Han}/gu) || []).length;
  const latin = (text.match(/[a-z]/gi) || []).length;
  const japanese = (text.match(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu) || []).length;
  const korean = (text.match(/\p{Script=Hangul}/gu) || []).length;
  if (han > 0 && han >= latin / 2 && japanese < Math.max(2, han / 5) && korean < Math.max(2, han / 5)) return text;
  const language = korean > Math.max(japanese, latin / 4) ? 'ko' : japanese > latin / 4 ? 'ja' : 'en';
  const encoder = new TextEncoder();
  const paragraphs = text.split(/\n+/);
  const translated = [];
  for (const paragraph of paragraphs) {
    const chunks = [];
    let chunk = '';
    for (const word of paragraph.match(/.{1,90}?(?:[。！？.!?]|\s+|$)|.{1,90}/gu) || []) {
      if (encoder.encode(chunk + word).length > 500) {
        chunks.push(chunk);
        chunk = '';
      }
      chunk += word;
    }
    if (chunk.trim()) chunks.push(chunk);
    const parts = [];
    for (const part of chunks) {
      const url = new URL('https://api.mymemory.translated.net/get');
      url.searchParams.set('q', part.trim());
      url.searchParams.set('langpair', language + '|zh-TW');
      const response = await request(url.href, { signal: AbortSignal.timeout(6500) });
      const data = response.ok ? await response.json() : null;
      const result = synopsisPlainText(data?.responseData?.translatedText);
      if (Number(data?.responseStatus) !== 200 || !/\p{Script=Han}/u.test(result)) return '';
      parts.push(result);
    }
    if (parts.length) translated.push(parts.join(''));
  }
  return translated.join('\n\n');
}

async function fetchWorkSynopsis({ id, title, nativeTitle, year, movie }, request = fetch) {
  let bangumiTitle;
  if (/^\d{1,10}$/.test(String(id || ''))) {
    try {
      const response = await request('https://api.bgm.tv/v0/subjects/' + id, { signal: AbortSignal.timeout(8000) });
      const work = response.ok ? await response.json() : null;
      if (work?.type === 2) {
        bangumiTitle = work.name;
        const summary = await translateWorkSynopsis(work.summary, request);
        if (summary) return { summary, source: 'Bangumi' };
      }
    } catch {}
  }

  const search = String(nativeTitle || bangumiTitle || title || '').trim().slice(0, 240);
  if (search.length < 2) return {};
  const normalize = name => String(name || '').normalize('NFKC').replace(/[\s\p{P}]/gu, '').toLowerCase();
  const queryAniList = async (term) => {
    const response = await request('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        query: `query ($search: String!) {
          Page(perPage: 12) { media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
            title { native romaji english }
            synonyms
            startDate { year }
            format
            description(asHtml: false)
          } }
        }`,
        variables: { search: term },
      }),
    });
    const data = response.ok ? await response.json() : null;
    const media = Array.isArray(data?.data?.Page?.media) ? data.data.Page.media : [];
    const exact = normalize(term);
    const matches = media.filter(work =>
      (!year || Number(year) === work.startDate?.year) && (!movie || work.format === 'MOVIE') &&
      [...Object.values(work.title || {}), ...(work.synonyms || [])].some(name => normalize(name) === exact));
    return { media, matches };
  };
  try {
    let { media, matches } = await queryAniList(search);
    if (matches.length !== 1 && !media.length && !bangumiTitle && !nativeTitle && title) {
      try {
        const bgmRes = await request('https://api.bgm.tv/v0/search/subjects?limit=5', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'aunight/Anigamer-Redesign3.0 (https://github.com/aunight/Anigamer-Redesign3.0)',
          },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({ keyword: String(title).trim(), filter: { type: [2] } }),
        });
        if (bgmRes.ok) {
          const bgmJson = await bgmRes.json();
          const list = Array.isArray(bgmJson?.data) ? bgmJson.data : [];
          const normTitle = normalize(title);
          const pick = list.find(item => (!year || Number((item?.date || '').slice(0, 4)) === Number(year)) &&
              (normalize(item?.name_cn) === normTitle || normalize(item?.name) === normTitle))
            || list.find(item => !year || Number((item?.date || '').slice(0, 4)) === Number(year))
            || list[0];
          if (pick?.summary) {
            const bgmSummary = await translateWorkSynopsis(pick.summary, request);
            if (bgmSummary) return { summary: bgmSummary, source: 'Bangumi' };
          }
          if (pick?.name && normalize(pick.name) !== normTitle) {
            ({ media, matches } = await queryAniList(String(pick.name).trim().slice(0, 240)));
          }
        }
      } catch {}
    }
    if (matches.length !== 1) return {};
    const summary = await translateWorkSynopsis(matches[0].description, request);
    return summary ? { summary, source: 'AniList' } : {};
  } catch { return {}; }
}

// Traditional Chinese summaries for episodes with a Japanese-only source.
const traditionalEpisodeDescriptions = new Map([
  [1749241, '颯太在自家咖啡店替小春解圍，發現看似冷淡的她其實怕生，也不擅長拍照。他決定教她拍照，幫她交朋友。'],
  [1749242, '小春鼓起勇氣約颯太喝珍珠奶茶。兩人因拍照越走越近，但她提出週末一起吃甜點時，颯太卻婉拒了。'],
  [1749243, '颯太和小春找各自的朋友幫忙準備約會服裝。聽完雫的戀愛建議後，颯太意外向小春告白。'],
  [1749244, '約會前夕，小春突然失聯。得知是她父親要求取消約會後，颯太決定當面說服他。'],
  [1749245, '互相告白後，颯太和小春迎來第一次約會。擔心感情停滯的颯太向凜香求助，凜香也開始察覺自己的心意。'],
  [1749246, '颯太和小春到海邊玩，除了遇見當地女孩圓花，還和朋友們會合。害羞的小春卻因為穿泳裝躲到岩石後面。'],
  [1749247, '泳裝被看見後，小春慌張逃走。在圓花直率的勸說和鼓勵下，她決定回去面對颯太。'],
  // Bangumi episode 1746082 supplies a Japanese synopsis only.
  [1746082, '露法絲派勇者一行尋找射手的故鄉，自己則前往阻止雷昂。途中，昔日戰友貝涅特奈修向她提出決鬥。'],
  // https://sasapi-anime.com/story_2nd.html
  [1748350, '小嗶誤觸直播，把自己和艾莎的影像傳上網。星崎小姐、鄰居妹妹等人循著影片找到了他們的藏身處。'],
]);

async function fetchBangumiEpisodes(subjectId, request) {
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
      if (!name && !jp && !description && !ep.airdate) continue;
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
  return matchedEpisodes;
}

const officialBunnyGirlStoryRequests = new WeakMap();
function fetchOfficialBunnyGirlStories(request = fetch) {
  if (!officialBunnyGirlStoryRequests.has(request)) {
    const result = request('https://www.aniplex.co.jp/lineup/ao-buta/story/', { signal: AbortSignal.timeout(8000) })
      .then(async response => {
        const html = response.ok ? await response.text() : '';
        const stories = {};
        const sections = html.split(/<h4 class="p-work:story-episode__no">\s*(\d+)\s*<\/h4>/i);
        for (let index = 1; index < sections.length; index += 2) {
          const description = synopsisPlainText(sections[index + 1].match(/<div class="p-work:story-episode__outline">([\s\S]*?)<\/div>/i)?.[1]);
          if (description) stories[Number(sections[index])] = description;
        }
        return stories;
      }).catch(() => ({}))
      .then(stories => {
        if (!Object.keys(stories).length) officialBunnyGirlStoryRequests.delete(request);
        return stories;
      });
    officialBunnyGirlStoryRequests.set(request, result);
  }
  return officialBunnyGirlStoryRequests.get(request);
}

async function fetchEpisodeTitles(rawTitle, request = fetch, acgUrl = '', lastEpisode = 0) {
  const cleanTitle = String(rawTitle || '')
    .replace(/\s*(?:\[\s*\d+(?:\.\d+)?\s*\]|EP\.?\s*\d+(?:\.\d+)?)\s*$/i, '')
    .replace(/\s*-\s*巴哈姆特動畫瘋.*$/, '')
    .replace(/\s*\[(?:特別篇|劇場版|電影版|OAD|OVA|中文配音|年齡限制版)\]\s*/g, ' ')
    .trim();
  const officialStories = cleanTitle === '青春豬頭少年不會夢到兔女郎學姊' ? fetchOfficialBunnyGirlStories(request) : null;
  const withOfficialStories = async episodes => {
    if (!officialStories) return episodes;
    const stories = await officialStories;
    for (const [number, description] of Object.entries(stories)) {
      const episode = episodes[number];
      if (!episode?.description || /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(episode.description)) {
        episodes[number] = { ...episode, description };
      }
    }
    return episodes;
  };
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
  const resolvedJpTitles = [];
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
      if (subject?.name && !resolvedJpTitles.includes(subject.name)) resolvedJpTitles.push(subject.name);
      const subjectId = subject?.id;
      if (!subjectId) continue;

      const matchedEpisodes = await fetchBangumiEpisodes(subjectId, request);
      if (Object.values(matchedEpisodes).some(ep => ep.name || ep.jp)) {
        let lastMatched = Math.max(...Object.keys(matchedEpisodes).map(Number));
        if (!strippedSeason && lastEpisode > lastMatched) {
          const workNames = new Set([kw, subject.name, subject.name_cn].map(normalize).filter(Boolean));
          const continuations = (sJson?.data || []).flatMap(item => {
            if (item.id === subjectId) return [];
            const season = [item.name, item.name_cn].map(normalize).map(name => {
              const suffix = name.match(/(?:season(\d+)|part(\d+)|(\d+)(?:nd|rd|th)season|第([二三四五六七八九十])[季期部])$/);
              if (!suffix || !workNames.has(name.slice(0, suffix.index))) return 0;
              return Number(suffix[1] || suffix[2] || suffix[3]) || ('一二三四五六七八九十'.indexOf(suffix[4]) + 1);
            }).find(number => number >= 2);
            return season ? [{ id: item.id, season }] : [];
          }).sort((a, b) => a.season - b.season);
          for (const continuation of continuations) {
            if (lastMatched >= lastEpisode) break;
            const next = await fetchBangumiEpisodes(continuation.id, request).catch(() => ({}));
            if (!Object.hasOwn(next, lastMatched + 1)) continue;
            for (const [number, episode] of Object.entries(next)) {
              if (Number(number) > lastMatched) matchedEpisodes[number] = episode;
            }
            lastMatched = Math.max(...Object.keys(matchedEpisodes).map(Number));
          }
        }
        return withOfficialStories(matchedEpisodes);
      }
      if (Object.keys(episodes).length === 0) episodes = matchedEpisodes;
    } catch {}
  }

  for (const kw of [...new Set([nativeTitle, ...resolvedJpTitles, cleanTitle].filter(s => s.length >= 2))]) {
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
      if (Object.values(episodes).some(ep => ep.name)) return withOfficialStories(episodes);
    } catch {}
  }

  return withOfficialStories(episodes);
}
