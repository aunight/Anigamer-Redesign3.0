import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/ending-audio.js', import.meta.url), 'utf8');
const { findEnding, parseAniSkipResponse } = runInNewContext(
  source.replace('globalThis.AniEndingAudio = {analyze, streamUrls};', 'return { findEnding, parseAniSkipResponse };'),
  { location: { pathname: '/' } },
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

  assert.equal(parseAniSkipResponse({ found: false, results: [] }, 1420), null);
});
