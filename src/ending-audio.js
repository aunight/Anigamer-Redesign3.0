(() => {
  'use strict';

  const tailSeconds = 240;
  const mediaHost = 'bahamut.akamaized.net';
  const maxAudioBytes = 44 * 1024 * 1024;
  const recentPlaylists = new Map();
  let announcedPlaylist;

  if (location.pathname === '/animeVideo.php' && typeof PerformanceObserver === 'function') {
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!entry.name.startsWith('https://' + mediaHost + '/') || !/\.m3u8(?:\?|$)/i.test(entry.name)) continue;
        recentPlaylists.delete(entry.name);
        recentPlaylists.set(entry.name, entry);
        if (recentPlaylists.size > 24) recentPlaylists.delete(recentPlaylists.keys().next().value);
      }
    });
    observer.observe({type:'resource', buffered:true});
  }
  if (location.pathname === '/animeVideo.php') {
    window.addEventListener('video_m3u8_src', event => {
      try {
        const url = new URL(event.detail?.src);
        if (url.origin === 'https://' + mediaHost && /\.m3u8$/i.test(url.pathname)) {
          announcedPlaylist = {url, time:performance.now()};
        }
      } catch {}
    });
  }

  function streamUrls(since = 0) {
    const urls = [...performance.getEntriesByType('resource'), ...recentPlaylists.values()]
      .filter(entry => entry.startTime >= since && entry.name.startsWith('https://' + mediaHost + '/'))
      .sort((a, b) => a.startTime - b.startTime)
      .map(entry => new URL(entry.name));
    const media = urls.findLast(url => /\/chunklist[^/]*\.m3u8$/i.test(url.pathname));
    const announced = announcedPlaylist?.time >= since ? announcedPlaylist.url : null;
    const master = urls.findLast(url => /\/playlist\.m3u8$/i.test(url.pathname) &&
      (!media || new URL('.', url).pathname === new URL('.', media).pathname)) || announced;
    const variants = [...new Map(urls.filter(url => /\/chunklist[^/]*\.m3u8$/i.test(url.pathname))
      .map(url => [url.href, url])).values()].reverse().slice(0, 4);
    return {media, master, variants};
  }

  function mediaPlaylist(text, url) {
    if (!text.includes('#EXT-X-ENDLIST') || /#EXT-X-(?:BYTERANGE|MAP)\b/.test(text)) return null;
    let sequence = 0, length = 0, duration = 0, key = null;
    const segments = [];
    const resolve = path => {
      const target = new URL(path, url);
      if (target.protocol !== 'https:' || target.hostname !== mediaHost) throw new Error('Unexpected media host');
      return target.href;
    };
    for (const line of text.split(/\r?\n/).map(part => part.trim())) {
      if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) sequence = Number(line.split(':')[1]);
      else if (line.startsWith('#EXTINF:')) length = Number.parseFloat(line.slice(8));
      else if (line.startsWith('#EXT-X-KEY:')) {
        const method = line.match(/METHOD=([^,]+)/)?.[1];
        if (method === 'NONE') key = null;
        else if (method === 'AES-128' && !/KEYFORMAT=/.test(line)) {
          const uri = line.match(/URI="([^"]+)"/)?.[1];
          const iv = line.match(/IV=0x([\da-f]+)(?:,|$)/i)?.[1];
          if (!uri || (iv && iv.length > 32) || (!iv && /\bIV=/.test(line))) return null;
          key = {url: resolve(uri), iv};
        } else return null;
      } else if (length > 0 && line && !line.startsWith('#')) {
        segments.push({url: resolve(line), start: duration, length, sequence: sequence++, key});
        duration += length;
        length = 0;
      }
    }
    return {duration, segments: segments.filter(part => part.start + part.length > duration - tailSeconds)};
  }

  function lowerBandwidthUrls(text, master) {
    const variants = [];
    const lines = text.split(/\r?\n/).map(line => line.trim());
    for (let index = 0; index < lines.length - 1; index++) {
      const line = lines[index];
      if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;
      const bandwidth = Number(line.match(/(?:[:,])BANDWIDTH=(\d+)/)?.[1]);
      const path = lines[index + 1];
      if (!bandwidth || bandwidth * tailSeconds / 8 > maxAudioBytes || !path || path.startsWith('#')) continue;
      const url = new URL(path, master);
      if (url.protocol === 'https:' && url.hostname === mediaHost) variants.push({bandwidth, url});
    }
    return variants.sort((a, b) => a.bandwidth - b.bandwidth).map(variant => variant.url);
  }

  // Take only the elementary AAC stream from standard MPEG-TS audio PES packets.
  function extractAac(transport) {
    const output = new Uint8Array(transport.length);
    let audioPid, written = 0;
    for (let offset = 0; offset + 188 <= transport.length; offset += 188) {
      if (transport[offset] !== 0x47) return null;
      const flags = transport[offset + 3];
      if (!(flags & 0x10)) continue;
      const end = offset + 188;
      let pos = offset + 4;
      if (flags & 0x20) pos += 1 + transport[pos];
      if (pos >= end) continue;
      const pid = ((transport[offset + 1] & 0x1f) << 8) | transport[offset + 2];
      if (transport[offset + 1] & 0x40) {
        if (pos + 9 > end || transport[pos] !== 0 || transport[pos + 1] !== 0 ||
            transport[pos + 2] !== 1 || (transport[pos + 3] & 0xe0) !== 0xc0) continue;
        audioPid ??= pid;
        pos += 9 + transport[pos + 8];
      }
      if (pid !== audioPid || pos >= end) continue;
      output.set(transport.subarray(pos, end), written);
      written += end - pos;
    }
    return written && output[0] === 0xff && (output[1] & 0xf6) === 0xf0 ? output.slice(0, written) : null;
  }

  const step = 0.125;
  function sampleAudio(buffer, offset) {
    const left = buffer.getChannelData(0);
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
    const width = Math.round(buffer.sampleRate * step);
    const samples = [];
    for (let start = 0; start + width <= left.length; start += width) {
      let peak = 0, energy = 0, side = 0;
      for (let i = start; i < start + width; i += 8) {
        peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
        energy += left[i] ** 2 + right[i] ** 2;
        side += (left[i] - right[i]) ** 2;
      }
      samples.push({time: offset + start / buffer.sampleRate, peak, stereo: side / Math.max(energy, 1e-9)});
    }
    return samples;
  }

  function findEnding(samples, duration) {
    // Look for sustained music between distinct pauses. Ambiguous sections are left alone.
    const onsetSearchSeconds = 20;
    const activePeakMin = 0.045;
    const stereoMin = 0.045;
    const candidates = [];
    for (const threshold of [0.012, 0.022, 0.035, 0.055]) {
      let start = 0, quiet = 0;
      for (let i = 0; i <= samples.length; i++) {
        const sample = samples[i];
        quiet = sample && sample.peak >= threshold ? 0 : quiet + 1;
        if (quiet < 3 && sample) continue;
        const end = i - quiet + 1;
        if (end > start && start > 0) {
          const first = samples[start];
          const endTime = sample ? samples[end - 1].time + step : duration;
          const length = endTime - first.time;
          if (length >= 52 && length <= 115 && duration - endTime <= 185) {
            const section = samples.slice(start, end);
            const stereo = section.filter(item => item.stereo > stereoMin).length / section.length;
            const levels = section.filter(item => item.peak >= activePeakMin).length / section.length;
            if (stereo >= 0.45 && levels >= 0.68) {
              candidates.push({startTime: first.time, endTime, score: stereo + levels - Math.abs(length - 90) / 90});
            }
          }
        }
        start = i + 1;
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    let best = candidates[0];
    // Prefer a tail ED near the episode end over earlier climax BGM.
    const isCanonicalTailEd = (c) => {
      const len = c.endTime - c.startTime;
      return len >= 52 && len <= 102 && duration - c.endTime <= 25;
    };
    const canonicalTail = candidates.find(isCanonicalTailEd);
    if (canonicalTail && best && !isCanonicalTailEd(best) && duration - best.endTime > 30) {
      best = canonicalTail;
    }
    // Nearby onsets with the same skip target are usually the same song
    // found at different silence thresholds.
    if (best && candidates.some(other => best.score - other.score < 0.25 &&
        !(isCanonicalTailEd(best) && duration - other.endTime > 30) &&
        (Math.abs(best.endTime - other.endTime) > 2 ||
          Math.abs(best.startTime - other.startTime) > onsetSearchSeconds))) return null;
    const perSecond = Math.round(1 / step);
    if (best && best.endTime - best.startTime < 72 && duration - best.endTime <= 20) {
      // A quiet mid-ED bridge may have split a ~90s tail ED into a shorter trailing fragment.
      const lastTailIdx = samples.findLastIndex(item => item.time < best.endTime);
      const tailEndIdx = lastTailIdx >= 0 ? lastTailIdx + 1 : samples.length;
      const fullStartIdx = Math.max(0, tailEndIdx - Math.round(90 * perSecond));
      const fullTail = samples.slice(fullStartIdx, tailEndIdx);
      const preWin = samples.slice(Math.max(0, fullStartIdx - 16 * perSecond), fullStartIdx);
      const stereo = fullTail.length ? fullTail.filter(item => item.stereo > stereoMin).length / fullTail.length : 0;
      const levels = fullTail.length ? fullTail.filter(item => item.peak >= activePeakMin).length / fullTail.length : 0;
      const preStereo = preWin.length ? preWin.filter(item => item.stereo > stereoMin).length / preWin.length : 0;
      if (stereo >= 0.50 && levels >= 0.72 && (preWin.length < 8 * perSecond || stereo - preStereo >= 0.08)) {
        best = { startTime: samples[fullStartIdx].time, endTime: best.endTime, score: stereo + levels };
      }
    }
    if (!best) {
      // Fallback for seamless EDs without a preceding silence pause, tolerating brief vocal/piano dips.
      let runStart = -1, lastMusic = -1, gap = 0;
      for (let i = 0; i <= samples.length; i++) {
        const s = samples[i];
        const isMusic = s && s.peak >= activePeakMin && s.stereo > stereoMin;
        if (isMusic) {
          if (runStart < 0) runStart = i;
          lastMusic = i;
          gap = 0;
          continue;
        }
        if (runStart >= 0 && s && ++gap <= 12) continue;
        if (runStart >= 0) {
          const endIdx = lastMusic + 1;
          const runLen = (endIdx - runStart) * step;
          const runEnd = samples[lastMusic].time + step;
          if (runLen >= 72 && runLen <= 105 && duration - runEnd <= 185) {
            const section = samples.slice(runStart, endIdx);
            const stereo = section.filter(item => item.stereo > stereoMin).length / section.length;
            const levels = section.filter(item => item.peak >= activePeakMin).length / section.length;
            if (stereo >= 0.62 && levels >= 0.72) {
              best = { startTime: samples[runStart].time, endTime: runEnd, score: stereo + levels };
              break;
            }
          } else if (runLen > 105 && duration - runEnd <= 25) {
            // Climax BGM merged into ED: locate strongest stereo/energy jump around ~90s before runEnd.
            const win = 8 * perSecond;
            let bestJump = 0, bestIdx = -1;
            const minIdx = Math.max(runStart + win, endIdx - Math.round(102 * perSecond));
            const maxIdx = Math.min(endIdx - Math.round(78 * perSecond), endIdx - win);
            for (let idx = minIdx; idx <= maxIdx; idx += perSecond) {
              let beforeS = 0, afterS = 0, beforeP = 0, afterP = 0;
              for (let k = 0; k < win; k++) {
                beforeS += samples[idx - win + k].stereo;
                beforeP += samples[idx - win + k].peak;
                afterS += samples[idx + k].stereo;
                afterP += samples[idx + k].peak;
              }
              const jump = ((afterS - beforeS) * 2 + (afterP - beforeP)) / win;
              if (jump > bestJump) {
                bestJump = jump;
                bestIdx = idx;
              }
            }
            if (bestIdx >= 0 && bestJump >= 0.025) {
              const tailSec = samples.slice(bestIdx, endIdx);
              const stereo = tailSec.filter(item => item.stereo > stereoMin).length / tailSec.length;
              const levels = tailSec.filter(item => item.peak >= activePeakMin).length / tailSec.length;
              if (stereo >= 0.55 && levels >= 0.70) {
                best = { startTime: samples[bestIdx].time, endTime: runEnd, score: stereo + levels };
                break;
              }
            }
            // If climax BGM seamlessly hands off to a ~90s ED with similar volume, pick lowest energy/stereo dip around 84-96s before runEnd.
            if (!best && duration - runEnd <= 15) {
              const dipStart = Math.max(runStart, endIdx - Math.round(96 * perSecond));
              const dipEnd = Math.min(endIdx - Math.round(84 * perSecond), endIdx - 1);
              let minScore = Infinity, dipIdx = -1;
              for (let idx = dipStart; idx <= dipEnd; idx++) {
                const sc = samples[idx].peak + samples[idx].stereo;
                if (sc < minScore) {
                  minScore = sc;
                  dipIdx = idx;
                }
              }
              if (dipIdx >= 0) {
                const tailSec = samples.slice(dipIdx, endIdx);
                const stereo = tailSec.filter(item => item.stereo > stereoMin).length / tailSec.length;
                const levels = tailSec.filter(item => item.peak >= activePeakMin).length / tailSec.length;
                if (stereo >= 0.52 && levels >= 0.70) {
                  best = { startTime: samples[dipIdx].time, endTime: runEnd, score: stereo + levels };
                  break;
                }
              }
            }
          }
          runStart = -1;
          lastMusic = -1;
          gap = 0;
        }
      }
      if (!best && samples.length >= Math.round(90 * perSecond)) {
        // Fallback if a >1.5s mid-ED vocal/piano bridge split the 90s ED into <72s fragments.
        const lastActiveIdx = samples.findLastIndex(s => s && s.peak >= activePeakMin && s.stereo > stereoMin);
        if (lastActiveIdx >= 0) {
          const tailEndIdx = lastActiveIdx + 1;
          const tailEnd = samples[lastActiveIdx].time + step;
          if (duration - tailEnd <= 20) {
            let bestStartIdx = -1, bestScore = -1;
            const win = 8 * perSecond;
            const winStartMin = Math.max(0, tailEndIdx - Math.round(100 * perSecond));
            const winStartMax = Math.max(0, tailEndIdx - Math.round(80 * perSecond));
            for (let idx = winStartMin; idx <= winStartMax; idx += perSecond) {
              const tailSec = samples.slice(idx, tailEndIdx);
              if (tailSec.length < 75 * perSecond) continue;
              const stereo = tailSec.filter(item => item.stereo > stereoMin).length / tailSec.length;
              const levels = tailSec.filter(item => item.peak >= activePeakMin).length / tailSec.length;
              if (stereo < 0.50 || levels < 0.72) continue;
              const preWin = samples.slice(Math.max(0, idx - 16 * perSecond), idx);
              const preStereo = preWin.length
                ? preWin.filter(item => item.stereo > stereoMin).length / preWin.length
                : 0;
              let stereoJump = 0;
              if (idx >= win && idx + win <= samples.length) {
                let beforeS = 0, afterS = 0;
                for (let k = 0; k < win; k++) {
                  beforeS += samples[idx - win + k].stereo;
                  afterS += samples[idx + k].stereo;
                }
                stereoJump = (afterS - beforeS) / win;
              }
              // Accept either a jump from mono dialogue OR a stereo-width jump from climax BGM.
              if (preWin.length >= 8 * perSecond && stereo - preStereo < 0.08 && stereoJump < 0.05) continue;
              const sc = stereo + levels + stereoJump * 2 - Math.abs(tailEnd - samples[idx].time - 90) / 90;
              if (sc > bestScore) {
                bestScore = sc;
                bestStartIdx = idx;
              }
            }
            if (bestStartIdx >= 0) {
              best = { startTime: samples[bestStartIdx].time, endTime: tailEnd, score: bestScore };
            }
          }
        }
      }
      if (!best) return null;
    }
    // Trim a quiet lead-in or score that briefly rises before the sustained song.
    const onset = samples.findIndex(sample => sample.time >= best.startTime);
    const findStableStart = (windowSeconds, minStereoShare) => {
      for (let index = onset; index < onset + onsetSearchSeconds * perSecond && index + windowSeconds * perSecond <= samples.length; index++) {
        if (samples[index].stereo <= stereoMin) continue;
        let stable = true;
        for (let second = 0; second < windowSeconds; second++) {
          const first = index + second * perSecond;
          const secondSamples = samples.slice(first, first + perSecond);
          const active = secondSamples.filter(sample => sample.peak >= activePeakMin);
          // Loud dialogue can precede the song without sharing its stereo profile.
          if (active.length < 0.70 * perSecond ||
              active.filter(sample => sample.stereo > stereoMin).length < minStereoShare * perSecond) {
            stable = false;
            break;
          }
        }
        if (stable) return samples[index].time;
      }
      return undefined;
    };
    const startTime = findStableStart(8, 0.5) ?? findStableStart(4, 0.25) ?? best.startTime;
    const endTime = Math.min(best.endTime, duration);
    if (startTime === undefined || endTime - startTime < 48) return null;
    const followingAudio = samples.filter(sample => sample.time >= endTime + 0.5 && sample.peak >= 0.022);
    const hasFollowingScene = (duration - endTime >= 25) && followingAudio.length * step >= 6;
    return {startTime, endTime, hasFollowingScene};
  }

  async function readThroughExtension(url, format, signal) {
    const source = new URL(url);
    if (source.origin !== 'https://' + mediaHost || !/\.(?:m3u8|m3u8key|ts)$/i.test(source.pathname)) return null;
    signal.throwIfAborted();
    const data = await new Promise(resolve => {
      if (typeof GM_xmlhttpRequest === 'function') {
        let request;
        const abort = () => request?.abort();
        const finish = result => {
          signal.removeEventListener('abort', abort);
          resolve(result);
        };
        request = GM_xmlhttpRequest({
          method:'GET', url, anonymous:true, responseType:'arraybuffer', timeout:10000,
          onload: response => finish(response.status === 200 && response.response &&
            response.response.byteLength <= 4 * 1024 * 1024 ? response.response : null),
          onerror: () => finish(null), ontimeout: () => finish(null), onabort: () => finish(null),
        });
        signal.addEventListener('abort', abort, {once:true});
      } else if (globalThis.chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage({type:'ani-read-ending-media', url}, response => {
          if (chrome.runtime.lastError || !response?.base64) return resolve(null);
          resolve(Uint8Array.from(atob(response.base64), char => char.charCodeAt(0)).buffer);
        });
      } else resolve(null);
    });
    signal.throwIfAborted();
    return data && format === 'text' ? new TextDecoder().decode(data) : data;
  }

  const malIdCache = new Map();
  const skipCache = new Map();

  function parseAniSkipResponse(data, duration) {
    if (!data?.found || !Array.isArray(data.results)) return null;
    const hit = data.results.find(r => r?.skipType === 'ed' && r?.interval)
      || data.results.find(r => r?.skipType === 'mixed-ed' && r?.interval);
    if (!hit) return null;
    const startTime = Number(hit.interval.startTime);
    const rawEnd = Number(hit.interval.endTime);
    if (!Number.isFinite(startTime) || !Number.isFinite(rawEnd) || rawEnd <= startTime + 15) return null;
    if (Number.isFinite(duration) && duration > 0 && startTime >= duration - 5) return null;
    const endTime = Number.isFinite(duration) && duration > 0 ? Math.min(rawEnd, duration) : rawEnd;
    const hasFollowingScene = Number.isFinite(duration) && duration > 0 ? (duration - endTime >= 25) : false;
    return { startTime, endTime, hasFollowingScene, source: 'aniskip' };
  }

  function parseAniSkipSegments(data, duration) {
    if (!data?.found || !Array.isArray(data.results)) return { op: null, ed: null };
    const ed = parseAniSkipResponse(data, duration);
    const opHit = data.results.find(r => r?.skipType === 'op' && r?.interval)
      || data.results.find(r => r?.skipType === 'mixed-op' && r?.interval);
    let op = null;
    if (opHit) {
      const startTime = Number(opHit.interval.startTime);
      const rawEnd = Number(opHit.interval.endTime);
      const validDur = Number.isFinite(duration) && duration > 0;
      if (Number.isFinite(startTime) && Number.isFinite(rawEnd) && startTime >= 0 && rawEnd > startTime + 15 &&
          (!validDur || (startTime < duration * 0.6 && rawEnd <= duration - 5))) {
        op = {
          startTime,
          endTime: validDur ? Math.min(rawEnd, duration) : rawEnd,
          skipType: opHit.skipType,
          source: 'aniskip',
        };
      }
    }
    return { op, ed };
  }

  function readEpisodeAndTitle() {
    const h1 = document.querySelector('.anime_name h1, .anime-title h1, h1')?.textContent?.trim() || '';
    const epFromTitle = h1.match(/(?:\[\s*(\d+(?:\.\d+)?)\s*\]|\bEP\.?\s*(\d+(?:\.\d+)?))(?:\s*\[[^\]]+\])*\s*$/i);
    const playingLink = document.querySelector('.season li.playing a');
    let rawSeasonEp = '';
    if (playingLink) {
      rawSeasonEp = playingLink.querySelector(':scope > .ani-episode-original-label')?.textContent?.trim()
        || playingLink.querySelector(':scope > .ani-episode-frame')?.dataset?.label?.trim()
        || Array.from(playingLink.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent || '').join('').trim()
        || playingLink.textContent?.trim()
        || '';
    }
    const epFromSeason = rawSeasonEp.match(/^(?:EP\.?\s*)?(\d+(?:\.\d+)?)$/i)?.[1];
    const episode = epFromTitle?.[1] || epFromTitle?.[2] || epFromSeason || '';
    const title = h1
      .replace(/(?:\s*(?:\[\s*(?:\d+(?:\.\d+)?|中文配音|中配|國語(?:配音)?|雙語|特別篇|OAD|OVA|電影|劇場版)\s*\]|EP\.?\s*\d+(?:\.\d+)?))+\s*$/i, '')
      .trim();
    return { title, episode };
  }

  async function resolveSearchTitles(title, signal) {
    const candidates = [];
    const pushTitle = (t) => {
      const clean = String(t || '').trim();
      if (clean && !candidates.includes(clean)) candidates.push(clean);
    };
    const isMovie = /電影|劇場版/.test(document.querySelector('.anime_name h1, .anime-title h1, h1')?.textContent || '');
    const bgmLink = document.querySelector('#bgmtv a[href*="bgm.tv/subject/"], a#bgmtv[href*="bgm.tv/subject/"], .ani-bgm-work-link[href*="bgm.tv/subject/"]');
    const bgmId = bgmLink?.getAttribute('href')?.match(/\/subject\/(\d+)/)?.[1];
    if (bgmId) {
      try {
        const res = await fetch(`https://api.bgm.tv/v0/subjects/${bgmId}`, {
          headers: { Accept: 'application/json' },
          signal,
        });
        if (res.ok) {
          const subject = await res.json();
          pushTitle(subject?.name);
          pushTitle(subject?.name_cn);
        }
      } catch (error) {
        if (signal?.aborted) throw error;
      }
    }
    if (!candidates.length) {
      try {
        const res = await fetch('https://api.bgm.tv/v0/search/subjects?limit=5', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ keyword: title, filter: { type: [2] } }),
          signal,
        });
        if (res.ok) {
          const json = await res.json();
          const list = Array.isArray(json?.data) ? json.data : [];
          const norm = (s) => {
            const tw = globalThis.AniEnhancements?.traditionalTitle?.(s) ?? s;
            return String(tw || '').normalize('NFKC').replace(/[\s\p{P}]/gu, '').toLowerCase();
          };
          const target = norm(title);
          const filtered = isMovie ? list : list.filter(item => !/劇場版|電影/.test(`${item?.name || ''} ${item?.name_cn || ''}`));
          const pool = filtered.length ? filtered : list;
          const exact = pool.find(item => norm(item?.name_cn) === target || norm(item?.name) === target);
          if (exact) pushTitle(exact.name);
          for (const item of pool) pushTitle(item?.name);
        }
      } catch (error) {
        if (signal?.aborted) throw error;
      }
    }
    pushTitle(title);
    return candidates;
  }

  function parseAnimeSkipEpisode(ep, duration) {
    const raw = Array.isArray(ep?.timestamps) ? ep.timestamps : [];
    if (!raw.length) return { op: null, ed: null };
    const total = Number.isFinite(duration) && duration > 0 ? duration : Number(ep?.baseDuration || 0);
    if (Number.isFinite(duration) && duration > 0 && Number(ep?.baseDuration) > 0 &&
        Math.abs(Number(ep.baseDuration) - duration) > 25) {
      return { op: null, ed: null };
    }
    const list = raw
      .map(item => ({ at: Number(item?.at), name: String(item?.type?.name || '') }))
      .filter(item => Number.isFinite(item.at) && item.at >= 0)
      .sort((a, b) => a.at - b.at);
    let op = null, ed = null;
    for (let i = 0; i < list.length; i++) {
      const cur = list[i];
      const nextAt = i + 1 < list.length ? list[i + 1].at : total;
      if (!op && /intro/i.test(cur.name) && nextAt - cur.at >= 20 && nextAt - cur.at <= 150) {
        op = { startTime: cur.at, endTime: nextAt, skipType: 'op', source: 'animeskip' };
      } else if (!ed && /credits|ending|outro/i.test(cur.name) && nextAt - cur.at >= 25 && nextAt - cur.at <= 150) {
        const endTime = total > 0 ? Math.min(nextAt, total) : nextAt;
        const hasFollowingScene = total > 0 ? (total - endTime >= 25) : false;
        ed = { startTime: cur.at, endTime, hasFollowingScene, source: 'animeskip' };
      }
    }
    return { op, ed };
  }

  const animeSkipShowCache = new Map();
  async function lookupAnimeSkip(titles, episode, duration, signal) {
    const queries = [...new Set((titles || []).map(t => String(t || '').trim()).filter(Boolean))];
    if (!queries.length || !episode) return { op: null, ed: null };
    const cacheKey = queries[0];
    let episodes = animeSkipShowCache.get(cacheKey);
    if (episodes === undefined) {
      episodes = null;
      for (const search of queries) {
        signal?.throwIfAborted?.();
        try {
          const res = await fetch('https://api.anime-skip.com/graphql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'X-Client-ID': 'th2oogUKrgOf1J8w0XATzuNPlcrTfId1',
            },
            body: JSON.stringify({
              query: 'query($s:String!){searchShows(search:$s){id name episodes{number baseDuration timestamps{at type{name}}}}}',
              variables: { s: search },
            }),
            signal,
          });
          if (!res.ok) continue;
          const json = await res.json();
          const show = json?.data?.searchShows?.find(item => Array.isArray(item?.episodes) && item.episodes.length);
          if (show) {
            episodes = show.episodes;
            break;
          }
        } catch (error) {
          if (signal?.aborted) throw error;
        }
      }
      animeSkipShowCache.set(cacheKey, episodes);
    }
    if (!Array.isArray(episodes)) return { op: null, ed: null };
    const epNum = String(episode).replace(/^0+(?=\d)/, '');
    const match = episodes.find(item => String(item?.number || '').replace(/^0+(?=\d)/, '') === epNum);
    return match ? parseAnimeSkipEpisode(match, duration) : { op: null, ed: null };
  }

  async function lookupSkipTimes(video, signal) {
    try {
      const { title, episode } = readEpisodeAndTitle();
      if (!title || !episode) return { op: null, ed: null, idMal: null, found: false };

      const cacheKey = `${title}#${episode}`;
      if (skipCache.has(cacheKey)) {
        const cached = skipCache.get(cacheKey);
        const parsed = cached.merged || parseAniSkipSegments(cached.data, video?.duration);
        return { ...parsed, idMal: cached.idMal, found: Boolean(parsed.op || parsed.ed) };
      }

      let meta = malIdCache.get(title);
      if (meta === undefined) {
        let idMal = null;
        const altTitles = [];
        const searchTitles = await resolveSearchTitles(title, signal);
        for (const search of searchTitles) {
          signal?.throwIfAborted?.();
          const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              query: 'query($search:String){Media(search:$search,type:ANIME){idMal title{english romaji native}}}',
              variables: { search },
            }),
            signal,
          });
          if (!res.ok) continue;
          const json = await res.json();
          const media = json?.data?.Media;
          if (media?.idMal) {
            idMal = media.idMal;
            if (media.title?.english) altTitles.push(media.title.english);
            if (media.title?.romaji) altTitles.push(media.title.romaji);
            if (media.title?.native) altTitles.push(media.title.native);
            break;
          }
        }
        meta = { idMal, altTitles };
        malIdCache.set(title, meta);
      }
      const idMal = meta?.idMal || null;
      let parsed = { op: null, ed: null };
      let data = { found: false, results: [] };
      if (idMal) {
        const epLen = Number.isFinite(video?.duration) && video.duration > 0 ? Math.round(video.duration) : 0;
        const skipRes = await fetch(
          `https://api.aniskip.com/v2/skip-times/${idMal}/${encodeURIComponent(episode)}?types=op&types=mixed-op&types=ed&types=mixed-ed&episodeLength=${epLen}`,
          { signal },
        );
        if (skipRes.ok) {
          data = await skipRes.json();
          parsed = parseAniSkipSegments(data, video?.duration);
        }
      }
      if ((!parsed.op || !parsed.ed) && meta?.altTitles?.length) {
        const fallback = await lookupAnimeSkip(meta.altTitles, episode, video?.duration, signal);
        parsed = { op: parsed.op || fallback.op, ed: parsed.ed || fallback.ed };
      }
      skipCache.set(cacheKey, { data, idMal, merged: parsed });
      return { ...parsed, idMal, found: Boolean(parsed.op || parsed.ed) };
    } catch (error) {
      if (signal?.aborted) throw error;
      return { op: null, ed: null, idMal: null, found: false };
    }
  }

  async function lookupAniSkip(video, signal) {
    const res = await lookupSkipTimes(video, signal);
    return res.ed;
  }

  async function analyzeAudio(video, signal, since) {
    const contextType = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    if (!contextType || !crypto.subtle) return null;
    const {variants, master} = streamUrls(since);
    if (!master && !variants.length) return undefined;
    let useFallback = false;
    const read = async (url, format) => {
      if (useFallback) {
        const body = await readThroughExtension(url, format, signal);
        if (body !== null) return body;
      }
      let failure = 'network';
      for (let attempt = 0; attempt < 2; attempt++) {
        signal.throwIfAborted();
        let response;
        try {
          response = await fetch(url, {signal, credentials:'omit'});
        } catch (error) {
          if (signal.aborted) throw error;
          if (attempt) break;
          continue;
        }
        if (response.ok) return response[format]();
        failure = 'HTTP ' + response.status;
        if (attempt || ![502, 503, 504].includes(response.status)) break;
      }
      if (!useFallback) {
        const body = await readThroughExtension(url, format, signal);
        if (body !== null) {
          useFallback = true;
          return body;
        }
      }
      const resource = format === 'text' ? 'playlist' : url.includes('m3u8key') ? 'key' : 'segment';
      throw new Error(resource + ': ' + failure);
    };
    let lowBandwidth = [];
    if (master) {
      try {
        lowBandwidth = lowerBandwidthUrls(await read(master.href, 'text'), master);
      } catch (error) {
        if (signal.aborted) throw error;
      }
    }
    const candidates = new Map([...lowBandwidth.slice(0, 2), ...variants, ...(master ? [master] : [])]
      .map(url => [url.href, url]));
    const context = new contextType(2, 1, 12000);
    const keys = new Map();
    let bytes = 0;
    const analyzeSegment = async segment => {
      let buffer = await read(segment.url, 'arrayBuffer');
      bytes += buffer.byteLength;
      if (bytes > maxAudioBytes) throw new Error('Audio analysis byte limit');
      if (segment.key) {
        const {url, iv: explicitIv} = segment.key;
        if (!keys.has(url)) keys.set(url, read(url, 'arrayBuffer').then(key =>
          crypto.subtle.importKey('raw', key, 'AES-CBC', false, ['decrypt'])));
        const iv = new Uint8Array(16);
        if (explicitIv) iv.set(explicitIv.padStart(32, '0').match(/../g).map(hex => Number.parseInt(hex, 16)));
        else new DataView(iv.buffer).setBigUint64(8, BigInt(segment.sequence));
        buffer = await crypto.subtle.decrypt({name:'AES-CBC', iv}, await keys.get(url), buffer);
      }
      const audio = extractAac(new Uint8Array(buffer));
      if (!audio) throw new Error('Unsupported audio stream');
      const decoded = await context.decodeAudioData(audio.buffer);
      if (Math.abs(decoded.duration - segment.length) > 0.5) throw new Error('Audio timing mismatch');
      return sampleAudio(decoded, segment.start).filter(sample => sample.time < segment.start + segment.length);
    };
    let playlist, samples, failedRead;
    for (const url of candidates.values()) {
      try {
        const candidate = mediaPlaylist(await read(url.href, 'text'), url);
        if (!candidate?.segments.length || Math.abs(candidate.duration - video.duration) > 3.5) continue;
        samples = await analyzeSegment(candidate.segments[0]);
        playlist = candidate;
        break;
      } catch (error) {
        if (signal.aborted) throw error;
        failedRead = error;
      }
    }
    if (!playlist && failedRead) throw failedRead;
    if (!playlist) return undefined;
    for (let i = 1; i < playlist.segments.length; i++) {
      signal.throwIfAborted();
      samples.push(...(await analyzeSegment(playlist.segments[i])));
      await new Promise(resolve => setTimeout(resolve, 60));
    }
    const detected = findEnding(samples, video.duration);
    if (!detected && samples.length) {
      const stereoCount = samples.filter(s => s.stereo > 0.045).length;
      const peakCount = samples.filter(s => s.peak >= 0.045).length;
      const buckets = [];
      for (let i = 0; i < samples.length; i += 80) {
        const chunk = samples.slice(i, i + 80);
        const avgP = chunk.reduce((a, b) => a + b.peak, 0) / chunk.length;
        const avgS = chunk.reduce((a, b) => a + b.stereo, 0) / chunk.length;
        buckets.push(`${Math.round(chunk[0].time)}s:p${avgP.toFixed(2)}/s${avgS.toFixed(2)}`);
      }
      console.info('[動畫瘋環境光][片尾偵測] 未找到符合區間', {
        duration: Math.round(video.duration),
        samples: samples.length,
        from: Math.round(samples[0].time),
        to: Math.round(samples[samples.length - 1].time),
        stereoRatio: +(stereoCount / samples.length).toFixed(2),
        activeRatio: +(peakCount / samples.length).toFixed(2),
        timeline: buckets.join(' '),
      });
    }
    return detected;
  }

  async function analyze(video, signal, since) {
    const aniSkipHit = await lookupAniSkip(video, signal);
    if (aniSkipHit) return aniSkipHit;
    return analyzeAudio(video, signal, since);
  }

  globalThis.AniEndingAudio = {analyze, analyzeAudio, lookupSkipTimes, streamUrls};
})();
