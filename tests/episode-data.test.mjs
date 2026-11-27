import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const code = fs.readFileSync(new URL('../src/episode-data.js', import.meta.url), 'utf8');
const fetchEpisodeTitles = new Function(code + '\nreturn fetchEpisodeTitles;')();
const fetchWorkSynopsis = new Function(code + '\nreturn fetchWorkSynopsis;')();

test('Bunny Girl Senpai uses the official synopsis when Bangumi has no episode description', async () => {
  const result = await fetchEpisodeTitles('青春豬頭少年不會夢到兔女郎學姊', async url => {
    const parsed = new URL(url);
    if (parsed.hostname === 'www.aniplex.co.jp') return {
      ok: true,
      text: async () => '<h4 class="p-work:story-episode__no">01</h4><div class="p-work:story-episode__outline">第一集劇情</div><h4 class="p-work:story-episode__no">02</h4><div class="p-work:story-episode__outline">第二集劇情</div>',
    };
    const payload = parsed.pathname.endsWith('/search/subjects')
      ? [{ id: 10, name: '青春豬頭少年不會夢到兔女郎學姊' }]
      : [{ sort: 1, name_cn: '第一集' }, { sort: 2, name_cn: '第二集', desc: '既有的中文劇情' }];
    return { ok: true, json: async () => ({ data: payload }) };
  });
  assert.equal(result[1].description, '第一集劇情');
  assert.equal(result[2].description, '既有的中文劇情');
});

test('work synopsis uses AniList when Bangumi is blank and translates the exact premiere match', async () => {
  const hosts = [];
  const request = async (url, options) => {
    const parsed = new URL(url);
    hosts.push(parsed.hostname);
    let payload;
    if (parsed.hostname === 'api.bgm.tv') {
      payload = { type: 2, name: 'Same Name', summary: '' };
    } else if (parsed.hostname === 'graphql.anilist.co') {
      assert.equal(JSON.parse(options.body).variables.search, 'Same Name');
      payload = { data: { Page: { media: [
        { title: { english: 'Same Name' }, startDate: { year: 2010 }, description: 'The wrong show.' },
        { title: { english: 'Same Name' }, startDate: { year: 2026 }, description: '<b>The sequel begins.</b>' },
      ] } } };
    } else {
      assert.equal(parsed.searchParams.get('langpair'), 'en|zh-TW');
      assert.equal(parsed.searchParams.get('q'), 'The sequel begins.');
      payload = { responseStatus: 200, responseData: { translatedText: '續篇開始了。' } };
    }
    return { ok: true, json: async () => payload };
  };
  assert.deepEqual(await fetchWorkSynopsis({ id: '42', title: '同名動畫', year: 2026 }, request),
    { summary: '續篇開始了。', source: 'AniList' });
  assert.deepEqual(hosts, ['api.bgm.tv', 'graphql.anilist.co', 'api.mymemory.translated.net']);
});

test('a Chinese Bangumi synopsis needs no translation and ambiguous AniList results are skipped', async () => {
  const bangumi = await fetchWorkSynopsis({ id: '42' }, async url => {
    assert.equal(new URL(url).hostname, 'api.bgm.tv');
    return { ok: true, json: async () => ({ type: 2, summary: '男孩在學校交到朋友。' }) };
  });
  assert.equal(bangumi.source, 'Bangumi');
  const ambiguous = await fetchWorkSynopsis({ title: 'Same Name' }, async url => {
    assert.equal(new URL(url).hostname, 'graphql.anilist.co');
    const anime = { title: { english: 'Same Name' }, description: 'A story.' };
    return { ok: true, json: async () => ({ data: { Page: { media: [anime, anime] } } }) };
  });
  assert.deepEqual(ambiguous, {});
});

test('merges continuous sequel numbering while skipping sequels that restart at episode one', async () => {
  const subjects = [
    { id: 10, name: '測試動畫' },
    { id: 20, name: '測試動畫 第2期' },
    { id: 30, name: '測試動畫 第三季' },
    { id: 40, name: '其他動畫 Season 2' },
  ];
  const episodes = {
    10: [{ sort: 1, name_cn: '第一集' }, { sort: 2, name_cn: '第二集' }],
    20: [{ sort: 1, name_cn: '從第一集重編的續季' }],
    30: [{ sort: 3, ep: 1, name_cn: '第三集', desc: '第三集描述' }],
  };
  const requested = [];
  const request = async url => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith('/search/subjects')) return { ok: true, json: async () => ({ data: subjects }) };
    const id = parsed.searchParams.get('subject_id');
    requested.push(Number(id));
    return { ok: true, json: async () => ({ data: episodes[id] }) };
  };
  const result = await fetchEpisodeTitles('測試動畫', request, '', 3);
  assert.deepEqual(requested, [10, 20, 30]);
  assert.equal(result[1].name, '第一集');
  assert.equal(result[3].name, '第三集');
  assert.equal(result[3].description, '第三集描述');
});

test('fetchWorkSynopsis and fetchEpisodeTitles fall back from Chinese title to Bangumi Japanese title for AniList', async () => {
  const synopsisHosts = [];
  const synopsisResult = await fetchWorkSynopsis({ title: '世界最強的魔女，就此開始', year: 2026 }, async (url, opts) => {
    const parsed = new URL(url);
    synopsisHosts.push(parsed.hostname);
    if (parsed.hostname === 'graphql.anilist.co') {
      const s = JSON.parse(opts.body).variables.search;
      if (s === '世界最強の魔女、始めました') {
        return {
          ok: true,
          json: async () => ({
            data: {
              Page: {
                media: [{
                  title: { native: '世界最強の魔女、始めました' },
                  synonyms: [],
                  startDate: { year: 2026 },
                  format: 'TV',
                  description: '測試作品簡介。',
                }],
              },
            },
          }),
        };
      }
      return { ok: true, json: async () => ({ data: { Page: { media: [] } } }) };
    }
    if (parsed.hostname === 'api.bgm.tv') {
      return {
        ok: true,
        json: async () => ({
          data: [{ id: 646154, name: '世界最強の魔女、始めました', name_cn: '世界最強的魔女，就此開始', date: '2026-10-07', summary: '' }],
        }),
      };
    }
    return { ok: false };
  });
  assert.deepEqual(synopsisResult, { summary: '測試作品簡介。', source: 'AniList' });
  assert.deepEqual(synopsisHosts, ['graphql.anilist.co', 'api.bgm.tv', 'graphql.anilist.co']);

  const epQueries = [];
  const epResult = await fetchEpisodeTitles('世界最強的魔女，就此開始', async (url, opts) => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith('/search/subjects')) {
      return { ok: true, json: async () => ({ data: [{ id: 646154, name: '世界最強の魔女、始めました', name_cn: '世界最強的魔女，就此開始' }] }) };
    }
    if (parsed.pathname === '/v0/episodes') {
      return { ok: true, json: async () => ({ data: [] }) };
    }
    if (parsed.hostname === 'graphql.anilist.co') {
      const s = JSON.parse(opts.body).variables.search;
      epQueries.push(s);
      if (s === '世界最強の魔女、始めました') {
        return { ok: true, json: async () => ({ data: { Page: { media: [{ streamingEpisodes: [{ title: 'Episode 1 - Awakening' }] }] } } }) };
      }
      return { ok: true, json: async () => ({ data: { Page: { media: [] } } }) };
    }
    return { ok: false };
  });
  assert.equal(epResult[1]?.name, 'Awakening');
  assert.equal(epQueries.includes('世界最強の魔女、始めました'), true);
});
