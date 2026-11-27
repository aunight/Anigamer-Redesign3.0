import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/ending-audio.js', import.meta.url), 'utf8');
const { findEnding, parseAniSkipResponse, parseAniSkipSegments, mediaPlaylist } = runInNewContext(
  source.replace('globalThis.AniEndingAudio = {analyze, analyzeAudio, lookupSkipTimes, streamUrls};', 'return { findEnding, parseAniSkipResponse, parseAniSkipSegments, mediaPlaylist };'),
  { location: { pathname: '/' }, URL },
);

function sampleTail(peakAt) {
  return Array.from({ length: 240 * 8 }, (_, index) => {
    const time = index / 8;
    const peak = peakAt(time);
    return { time, peak, stereo: peak > 0 ? 0.2 : 0 };
  });
}

test('a short dip can move the detected onset without making one ending ambiguous', () => {
  const samples = sampleTail(time => {
    if (time < 128 || time >= 239) return 0;
    return time >= 141.5 && time < 142 ? 0.015 : 0.2;
  });

  const ending = findEnding(samples, 240);
  assert.equal(ending?.startTime, 142);
  assert.equal(ending.endTime, 239);
  assert.equal(ending.hasFollowingScene, false);
});

test('similar music candidates with different skip targets remain ambiguous', () => {
  const samples = sampleTail(time => (time >= 56 && time < 116) || (time >= 137 && time < 197) ? 0.2 : 0);
  assert.equal(findEnding(samples, 240), null);
});

test('centered dialogue before a sustained stereo song does not set the skip onset', () => {
  const samples = sampleTail(time => time >= 135 && time < 237 ? 0.2 : 0);
  for (const sample of samples) {
    if (sample.time < 150) sample.stereo = 0.02;
  }
  assert.equal(findEnding(samples, 240)?.startTime, 150);
});

test('widely separated onsets can still indicate different sections', () => {
  const samples = sampleTail(time => {
    if (time < 131 || time >= 239) return 0;
    return time >= 158.5 && time < 159 ? 0.015 : 0.2;
  });
  assert.equal(findEnding(samples, 240), null);
});

test('detects a standard 90s ending followed by a long post-credits scene (>125s)', () => {
  const samples = sampleTail(time => {
    if (time >= 12 && time < 102) return 0.2;
    if (time >= 108 && time < 236) return 0.05;
    return 0;
  });
  for (const sample of samples) {
    if (sample.time >= 108) sample.stereo = 0.02;
  }
  const ending = findEnding(samples, 240);
  assert.equal(ending?.startTime, 12);
  assert.equal(ending?.endTime, 102);
  assert.equal(ending?.hasFollowingScene, true);
});

test('parseAniSkipResponse extracts ED interval and detects post-credits scene', () => {
  const withPostCredits = parseAniSkipResponse({
    found: true,
    results: [{ skipType: 'ed', interval: { startTime: 1205.2, endTime: 1295.2 } }],
  }, 1420);
  assert.deepEqual({ ...withPostCredits }, {
    startTime: 1205.2,
    endTime: 1295.2,
    hasFollowingScene: true,
    source: 'aniskip',
  });

  const atEnd = parseAniSkipResponse({
    found: true,
    results: [{ skipType: 'mixed-ed', interval: { startTime: 1329, endTime: 1419.5 } }],
  }, 1420);
  assert.deepEqual({ ...atEnd }, {
    startTime: 1329,
    endTime: 1419.5,
    hasFollowingScene: false,
    source: 'aniskip',
  });

  const shortPreview = parseAniSkipResponse({
    found: true,
    results: [{ skipType: 'ed', interval: { startTime: 1315, endTime: 1405 } }],
  }, 1420);
  assert.equal(shortPreview?.hasFollowingScene, false);

  assert.equal(parseAniSkipResponse({ found: false, results: [] }, 1420), null);
});

test('parseAniSkipSegments extracts OP and ED segments independently', () => {
  const opOnly = parseAniSkipSegments({
    found: true,
    results: [{ skipType: 'op', interval: { startTime: 7.8, endTime: 98.5 } }],
  }, 1420);
  assert.deepEqual({ ...opOnly.op }, {
    startTime: 7.8,
    endTime: 98.5,
    skipType: 'op',
    source: 'aniskip',
  });
  assert.equal(opOnly.ed, null);

  const both = parseAniSkipSegments({
    found: true,
    results: [
      { skipType: 'mixed-op', interval: { startTime: 45, endTime: 135 } },
      { skipType: 'ed', interval: { startTime: 1300, endTime: 1390 } },
    ],
  }, 1420);
  assert.equal(both.op?.endTime, 135);
  assert.equal(both.ed?.hasFollowingScene, true);
});

test('findEnding detects soft ballad EDs and seamless-onset EDs, and mediaPlaylist allows discontinuity', () => {
  const ballad = sampleTail(time => (time >= 140 && time < 230 ? 0.06 : 0));
  const balladResult = findEnding(ballad, 240);
  assert.equal(balladResult?.startTime, 140);
  assert.equal(balladResult?.endTime, 230);

  const seamless = sampleTail(time => (time >= 135 && time < 225 ? 0.08 : 0.04));
  for (const s of seamless) {
    if (s.time < 135 || s.time >= 225) s.stereo = 0.02;
  }
  const seamlessResult = findEnding(seamless, 240);
  assert.equal(seamlessResult?.startTime, 135);
  assert.equal(seamlessResult?.endTime, 225);

  const playlist = mediaPlaylist([
    '#EXTM3U',
    '#EXT-X-DISCONTINUITY',
    '#EXTINF:10.0,',
    'seg0.ts',
    '#EXTINF:10.0,',
    'seg1.ts',
    '#EXT-X-ENDLIST',
  ].join('\n'), 'https://bahamut.akamaized.net/test/chunklist.m3u8');
  assert.equal(playlist?.segments.length, 2);
});

test('lookupSkipTimes resolves Japanese title via Bangumi before querying AniList and AniSkip', async () => {
  const requests = [];
  const doc = {
    querySelector: (sel) => {
      if (sel.includes('h1')) return { textContent: '世界最強的魔女，就此開始 [8]' };
      return null;
    },
  };
  const { lookupSkipTimes } = runInNewContext(
    source.replace('globalThis.AniEndingAudio = {analyze, analyzeAudio, lookupSkipTimes, streamUrls};', 'return { lookupSkipTimes };'),
    {
      location: { pathname: '/animeVideo.php' },
      window: { addEventListener: () => {} },
      document: doc,
      URL,
      fetch: async (url, opts) => {
        requests.push({ url, body: opts?.body ? JSON.parse(opts.body) : null });
        if (url.includes('api.bgm.tv/v0/search/subjects')) {
          return {
            ok: true,
            json: async () => ({
              data: [{ id: 646154, name: '世界最強の魔女、始めました', name_cn: '世界最强的魔女，就此开始' }],
            }),
          };
        }
        if (url.includes('graphql.anilist.co')) {
          const s = JSON.parse(opts.body).variables.search;
          if (s === '世界最強の魔女、始めました') {
            return { ok: true, json: async () => ({ data: { Media: { idMal: 64084 } } }) };
          }
          return { ok: false, status: 404, json: async () => ({ data: { Media: null } }) };
        }
        if (url.includes('api.aniskip.com/v2/skip-times/64084/8')) {
          return {
            ok: true,
            json: async () => ({
              found: true,
              results: [{ skipType: 'op', interval: { startTime: 7.8, endTime: 98.5 } }],
            }),
          };
        }
        return { ok: false, status: 404 };
      },
    },
  );
  const res = await lookupSkipTimes({ duration: 1419.989 }, new AbortController().signal);
  assert.equal(res.idMal, 64084);
  assert.equal(res.found, true);
  assert.equal(res.op?.startTime, 7.8);
  assert.equal(res.op?.endTime, 98.5);
  assert.equal(res.ed, null);
  assert.equal(requests.some(r => r.url.includes('api.aniskip.com') && r.url.includes('types=op') && r.url.includes('types=ed')), true);
});

test('seamless ED fallback bridges brief mid-song vocal or piano dips without losing detection', () => {
  const step = 0.125;
  const duration = 1420;
  const samples = [];
  for (let t = 1220; t < duration; t += step) {
    // Non-silent dialogue/BGM up to 1320s, then 90s ED (1320-1410) with two 0.5s mid-song dips
    const inEd = t >= 1320 && t < 1410;
    const inDip = (t >= 1352 && t < 1352.5) || (t >= 1384 && t < 1384.5);
    samples.push({
      time: t,
      peak: inEd ? (inDip ? 0.03 : 0.18) : 0.08,
      stereo: inEd && !inDip ? 0.24 : 0.02,
    });
  }
  const result = findEnding(samples, duration);
  assert.ok(result, 'seamless ED with brief dips is detected');
  assert.ok(result.startTime >= 1319.5 && result.startTime <= 1321);
  assert.ok(result.endTime >= 1409.5 && result.endTime <= 1410.5);
});

test('prefers canonical 90s tail ED over earlier climax BGM and handles merged climax+ED runs', () => {
  const step = 0.125;
  const duration = 1420;
  // Case 1: two distinct blocks — 85s climax BGM (1200-1285) + 90s ED (1315-1405)
  const twoBlocks = [];
  for (let t = 1180; t < duration; t += step) {
    const inBgm = t >= 1200 && t < 1285;
    const inEd = t >= 1315 && t < 1405;
    twoBlocks.push({ time: t, peak: inBgm || inEd ? 0.2 : 0, stereo: inBgm || inEd ? 0.22 : 0 });
  }
  const res1 = findEnding(twoBlocks, duration);
  assert.ok(res1, 'canonical 90s tail ED selected over climax BGM');
  assert.equal(res1.startTime, 1315);
  assert.equal(res1.endTime, 1405);

  // Case 2: continuous merged 190s run (climax BGM 1220-1320 + louder/wider ED 1320-1410)
  const merged = [];
  for (let t = 1180; t < duration; t += step) {
    const inBgm = t >= 1220 && t < 1320;
    const inEd = t >= 1320 && t < 1410;
    merged.push({
      time: t,
      peak: inEd ? 0.24 : inBgm ? 0.12 : 0.01,
      stereo: inEd ? 0.28 : inBgm ? 0.08 : 0.01,
    });
  }
  const res2 = findEnding(merged, duration);
  assert.ok(res2, 'merged climax+ED run finds ED onset via stereo/energy jump');
  assert.ok(res2.startTime >= 1319 && res2.startTime <= 1321);
  assert.ok(res2.endTime >= 1409.5 && res2.endTime <= 1410.5);
});
