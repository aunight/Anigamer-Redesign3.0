(() => {
  'use strict';

  const TRACK_X = 260;
  const TRACK_W = 560;
  const KNOB_D = 196;
  const KNOB_GAP = 12;
  const KNOB_X_OFF = TRACK_X + KNOB_GAP;
  const KNOB_X_ON = TRACK_X + TRACK_W - KNOB_GAP - KNOB_D;
  const LENS_R = KNOB_D / 2;
  const FILAMENT_X = 64;
  const TRACK_H = 220;
  const MID_Y = TRACK_H / 2;
  const RIG_SCALE = 1.15;
  const MOON_X = KNOB_GAP + LENS_R;
  const SUN_X = TRACK_W - KNOB_GAP - LENS_R;
  const GRID = 9;
  const CELL = 10;
  const DOT = 7.8;
  const DOT_RADIUS = 1.8;
  const TICK_H = 26;
  const TICK_TALL_H = 44;
  const TICKS = Array.from({ length: 9 }, (_, i) => ({ x: 180 + 25 * i, tall: i % 4 === 0 }));

  const SPRING_K = 170;
  const SPRING_C = 17;
  const MAX_DT = 0.05;
  const WARM_RATE = 3.2;
  const COOL_RATE = 5.5;
  const FLICKER = 0.06;
  const FLICKER_SPEED = 37;
  const FLICKER_END = 1.4;
  const FOLLOW_RATE = 4;
  const SWAY_X = 0.25;
  const SWAY_X_SPEED = 0.5;
  const SWAY_Y = 0.2;
  const SWAY_Y_SPEED = 0.4;
  const SQUASH_SPEED = 9;
  const SQUASH_MAX = 0.14;
  const LENS_POWER = 1.65;
  const RIM_ON = -90;
  const RIM_TURN = -180;
  const RIM_K = 40;
  const RIM_C = 11;
  const MORPH = 0.62;
  const MORPH_STAGGER = 0.16;
  const SCATTER = 26;
  const SHRINK = 0.35;
  const TICK_LIT = 0.12;
  const TICK_GAIN = 0.5;
  const LENS_TICK_LIT = 0.25;
  const LENS_TICK_GAIN = 0.6;
  const LIGHT_FALLOFF = 260;
  const PIXEL_TRACK = 0.3;
  const PIXEL_TRACK_LIT = 0.7;
  const PIXEL_LENS = 0.65;
  const PIXEL_LENS_LIT = 1;
  const LIT_MIN = 0.01;

  const warp = (u, p) => Math.sign(u) * (1 - Math.pow(1 - Math.min(1, Math.abs(u)), p));
  const stretch = (u, p) => p * Math.pow(1 - Math.min(0.999, Math.abs(u)), p - 1);
  const swell = (u, p) => (1 + (p - 1) * (1 - u * u)) * (0.72 + 0.28 * Math.sqrt(Math.max(0, 1 - u * u)));
  const RIM_FADE = 0.12;
  const rimFade = (u) => Math.min(1, Math.max(0, (1 - Math.abs(u)) / RIM_FADE));

  // Adapted to Anigamer-Redesign 3.0 palette: luminous aqua moon <-> golden sunlit sun (9x9 crisp HiDPI grid)
  const PIXEL_COLD = [126, 243, 250];
  const PIXEL_WARM = [255, 224, 148];

  const SUN = [
    '....+....',
    '.+.....+.',
    '...###...',
    '..#####..',
    '+.#####.+',
    '..#####..',
    '...###...',
    '.+.....+.',
    '....+....',
  ];
  const SUN_PIXELS = [];
  SUN.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '#') SUN_PIXELS.push({ x, y, a: 1 });
      if (ch === '+') SUN_PIXELS.push({ x, y, a: 0.78 });
    });
  });

  const MOON = [
    '..###..+.',
    '.####.+..',
    '####.....',
    '###......',
    '###......',
    '####.....',
    '.#####..+',
    '..######.',
    '....##...',
  ];
  const MOON_PIXELS = [];
  MOON.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '#') MOON_PIXELS.push({ x, y, a: 1 });
      if (ch === '+') MOON_PIXELS.push({ x, y, a: 0.85 });
    });
  });

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
  const GONE = 0.01;
  const place = (p, cx) => ({ x: cx + (p.x - (GRID - 1) / 2) * CELL, y: MID_Y + (p.y - (GRID - 1) / 2) * CELL, a: p.a, s: 1 });
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  function shuffle(list) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  function createMorph(glyph, cx) {
    const flights = glyph.map((p) => place(p, cx)).map((d) => ({ from: d, to: d, delay: 0, dx: 0, dy: 0 }));
    return { flights, start: -Infinity };
  }
  function sample(m, now, reduced) {
    return m.flights.map((f) => {
      const k = clamp((now - m.start - f.delay) / MORPH);
      if (reduced) return k < 0.5 ? { ...f.from, a: f.from.a * (1 - 2 * k) } : { ...f.to, a: f.to.a * (2 * k - 1) };
      const e = ease(k);
      const burst = Math.sin(Math.PI * k);
      return { x: lerp(f.from.x, f.to.x, e) + f.dx * burst, y: lerp(f.from.y, f.to.y, e) + f.dy * burst, a: lerp(f.from.a, f.to.a, e), s: 1 - SHRINK * burst };
    });
  }
  function retarget(m, glyph, cx, now, reduced) {
    const current = shuffle(sample(m, now, reduced).filter((d) => d.a > GONE));
    const targets = glyph.map((p) => place(p, cx));
    const n = Math.max(current.length, targets.length);
    const flights = [];
    for (let i = 0; i < n; i++) {
      const from = i < current.length ? current[i] : { ...pick(current), a: 0 };
      const to = i < targets.length ? targets[i] : { ...pick(targets), a: 0 };
      const side = (from.y + to.y) / 2 - MID_Y;
      const angle = (side < 0 ? -Math.PI / 2 : Math.PI / 2) + (Math.random() - 0.5) * Math.PI * 0.9;
      const reach = SCATTER * (0.35 + 0.65 * Math.random());
      flights.push({ from, to, delay: Math.random() * MORPH_STAGGER, dx: Math.cos(angle) * reach, dy: Math.sin(angle) * reach });
    }
    return { flights, start: now };
  }

  let mounted = null;

  function mount({ initialLight = false, onToggle = null } = {}) {
    const member = document.querySelector('.top_sky .sky .member');
    if (!member || !member.parentElement) return null;

    if (mounted?.wrap?.isConnected) {
      mounted.setOn(initialLight ? 1 : 0, true);
      return mounted;
    }

    const wrap = document.createElement('div');
    wrap.className = 'ani-lens-theme-wrap';
    wrap.innerHTML =
      '<div class="stage" role="switch" aria-checked="false" aria-label="切換深淺模式" title="切換深色 / 淺色模式" tabindex="0">'
      + '<div class="halo"></div>'
      + '<div class="rig">'
      + '<div class="track"><div class="wash"></div><div class="ticks"></div><canvas class="track-pixels"></canvas><div class="filament-glow"></div><div class="filament"></div><div class="trim"></div></div>'
      + '<div class="knob"><div class="inner"></div>'
      + '<svg class="lens" viewBox="0 0 196 196" aria-hidden="true">'
      + '<defs><filter id="ani-lens-blur" filterUnits="userSpaceOnUse" x="-20" y="60" width="240" height="80"><feGaussianBlur stdDeviation="5"/></filter><clipPath id="ani-lens-clip"><circle cx="98" cy="98" r="97"/></clipPath></defs>'
      + '<g clip-path="url(#ani-lens-clip)" class="lens-ticks"></g>'
      + '<g class="refraction" clip-path="url(#ani-lens-clip)"><path class="glow" filter="url(#ani-lens-blur)"/><path class="core"/></g>'
      + '</svg>'
      + '<canvas class="lens-pixels"></canvas><div class="caustic"></div><div class="lit"></div><div class="edge"></div><div class="spec"></div><div class="spark"></div>'
      + '</div>'
      + '<div class="rim"><svg class="arc" viewBox="0 0 196 196" aria-hidden="true">'
      + '<defs><filter id="ani-rim-blur" filterUnits="userSpaceOnUse" x="-60" y="-60" width="316" height="316"><feGaussianBlur stdDeviation="7"/></filter></defs>'
      + '<g class="cold"><path class="rim-glow" d="M143.22015400625483 1.0250667870784582 A107 107 0 0 1 143.22015400625483 194.97493321292154" filter="url(#ani-rim-blur)"/><path class="rim-core" d="M143.22015400625483 1.0250667870784582 A107 107 0 0 1 143.22015400625483 194.97493321292154"/></g>'
      + '<g class="warm"><path class="rim-glow" d="M143.22015400625483 1.0250667870784582 A107 107 0 0 1 143.22015400625483 194.97493321292154" filter="url(#ani-rim-blur)"/><path class="rim-core" d="M143.22015400625483 1.0250667870784582 A107 107 0 0 1 143.22015400625483 194.97493321292154"/></g>'
      + '</svg></div></div></div>';

    member.before(wrap);

    const stage = wrap.querySelector('.stage');
    const $ = (q) => stage.querySelector(q);
    $('.ticks').innerHTML = TICKS.map((t) => `<div class="tick"${t.tall ? ' data-tall' : ''} style="--x:${t.x}"></div>`).join('');
    $('.lens-ticks').innerHTML = TICKS.map(() => '<rect class="lens-tick" width="5" rx="2.5"/>').join('');
    const ticks = [...$('.ticks').children].map((el, i) => ({ el, ...TICKS[i] }));
    const lensTicks = [...$('.lens-ticks').children].map((el, i) => ({ el, ...TICKS[i] }));
    const trackPixels = $('.track-pixels');
    const lensPixels = $('.lens-pixels');
    const refractionGlow = $('.glow');
    const refractionCore = $('.core');
    const query = matchMedia('(prefers-reduced-motion: reduce)');

    const initOn = initialLight ? 1 : 0;
    const s = {
      on: initOn,
      pos: initOn,
      vel: 0,
      glow: initOn,
      mx: 0,
      my: 0,
      tmx: 0,
      tmy: 0,
      last: null,
      angle: initOn ? RIM_ON : RIM_ON - RIM_TURN,
      spin: 0,
      rimTarget: initOn ? RIM_ON : RIM_ON - RIM_TURN,
      morph: createMorph(initOn ? SUN_PIXELS : MOON_PIXELS, initOn ? SUN_X : MOON_X),
      shown: initOn,
    };

    const setOn = (nextOn, silent = false) => {
      const target = nextOn ? 1 : 0;
      if (s.on === target) return;
      s.on = target;
      stage.setAttribute('aria-checked', target ? 'true' : 'false');
      if (!silent && typeof onToggle === 'function') onToggle(target === 1);
    };

    stage.addEventListener('pointerdown', (e) => {
      if (e.button === 0) e.preventDefault();
    });
    stage.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setOn(s.on ? 0 : 1, false);
    });
    stage.addEventListener('keydown', (e) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setOn(s.on ? 0 : 1, false);
      }
    });
    wrap.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      s.tmx = clamp((e.clientX - r.left) / r.width, 0, 1) * 2 - 1;
      s.tmy = clamp((e.clientY - r.top) / r.height, 0, 1) * 2 - 1;
    });
    wrap.addEventListener('pointerleave', () => {
      s.tmx = 0;
      s.tmy = 0;
    });

    function prepare(canvas, width, height) {
      const ctx = canvas.getContext('2d');
      if (!ctx || canvas.clientWidth === 0) return null;
      const k = (canvas.clientWidth * Math.max(2, devicePixelRatio || 1) * RIG_SCALE) / width;
      const w = Math.max(1, Math.round(width * k));
      const h = Math.max(1, Math.round(height * k));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.clearRect(0, 0, width, height);
      return ctx;
    }

    function pixel(ctx, x, y, side, a, fl) {
      const c = PIXEL_COLD.map((v, i) => Math.round(v + (PIXEL_WARM[i] - v) * fl));
      ctx.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
      ctx.beginPath();
      ctx.roundRect(x - side / 2, y - side / 2, side, side, DOT_RADIUS * (side / DOT));
      ctx.fill();
    }

    let checked = -1;
    let rafId = 0;
    let lastDrawIdle = false;

    function draw(f) {
      const set = (name, value) => wrap.style.setProperty(name, String(value));
      set('--fl', f.fl);
      set('--pos', f.pos);
      set('--kx', f.kx);
      set('--kc', f.kc);
      set('--sq', f.sq);
      set('--ix', f.ix);
      set('--iy', f.iy);
      set('--ra', f.angle);
      set('--gx', Math.cos((f.angle * Math.PI) / 180));
      set('--gy', Math.sin((f.angle * Math.PI) / 180));
      if (f.on !== checked) {
        checked = f.on;
        stage.setAttribute('aria-checked', f.on ? 'true' : 'false');
      }

      for (const tick of ticks) {
        const lit = tick.x < f.kc && f.fl > LIT_MIN;
        tick.el.toggleAttribute('data-lit', lit);
        if (lit) tick.el.style.setProperty('--a', String(TICK_LIT + TICK_GAIN * f.fl * Math.exp(-(f.kc - tick.x) / LIGHT_FALLOFF)));
      }

      const p = LENS_POWER;
      for (const tick of lensTicks) {
        const u = (tick.x - f.kc) / LENS_R;
        if (Math.abs(u) >= 1) {
          tick.el.setAttribute('opacity', '0');
          continue;
        }
        const lx = LENS_R + LENS_R * warp(u, p);
        const h = (tick.tall ? TICK_TALL_H : TICK_H) * swell(u, p);
        const w = Math.max(0.8, 2 * Math.min(1.6, stretch(u, p)));
        tick.el.setAttribute('x', String(lx - w / 2));
        tick.el.setAttribute('width', String(w));
        tick.el.setAttribute('y', String(LENS_R - h / 2));
        tick.el.setAttribute('height', String(h));
        const lit = tick.x < f.kc && f.fl > LIT_MIN;
        tick.el.toggleAttribute('data-lit', lit);
        if (lit) tick.el.style.setProperty('--a', String(LENS_TICK_LIT + LENS_TICK_GAIN * f.fl * Math.exp(-(f.kc - tick.x) / LIGHT_FALLOFF)));
        tick.el.setAttribute('opacity', String(rimFade(u)));
      }

      const fs = Math.max(0, Math.min(1, (f.kc - FILAMENT_X) / LENS_R));
      const ex = LENS_R + LENS_R * warp(-fs, p);
      const d = `M${ex} ${LENS_R} L${LENS_R} ${LENS_R}`;
      refractionGlow.setAttribute('d', d);
      refractionCore.setAttribute('d', d);
      refractionCore.setAttribute('stroke-width', String(2 * p));

      const tCtx = prepare(trackPixels, TRACK_W, TRACK_H);
      if (tCtx) {
        const shade = PIXEL_TRACK + (PIXEL_TRACK_LIT - PIXEL_TRACK) * f.fl;
        for (const dot of f.dots) if (dot.a > 0) pixel(tCtx, dot.x, dot.y, DOT * dot.s, dot.a * shade, f.fl);
      }

      const size = 2 * LENS_R;
      const lCtx = prepare(lensPixels, size, size);
      if (lCtx) {
        const shade = PIXEL_LENS + (PIXEL_LENS_LIT - PIXEL_LENS) * f.fl;
        for (const dot of f.dots) {
          if (dot.a <= 0) continue;
          const u = (dot.x - f.kc) / LENS_R;
          const v = (dot.y - MID_Y) / LENS_R;
          const r = Math.hypot(u, v);
          if (r >= 1) continue;
          const out = r < 1e-6 ? LENS_POWER : warp(r, LENS_POWER) / r;
          pixel(lCtx, LENS_R + u * out * LENS_R, LENS_R + v * out * LENS_R, DOT * dot.s * swell(r, LENS_POWER), dot.a * shade * rimFade(r), f.fl);
        }
      }
    }

    const loop = (nowMs) => {
      if (!wrap.isConnected) return;
      const t = nowMs / 1000;
      const reduced = query.matches;
      const dt = s.last === null ? 1 / 60 : Math.min(MAX_DT, t - s.last);
      s.last = t;

      if (s.on !== s.shown) {
        s.shown = s.on;
        s.rimTarget += RIM_TURN;
        s.morph = retarget(s.morph, s.on ? SUN_PIXELS : MOON_PIXELS, s.on ? SUN_X : MOON_X, t, reduced);
      }

      if (reduced) {
        s.pos = s.on;
        s.vel = 0;
        s.angle = s.rimTarget;
        s.spin = 0;
        s.tmx = 0;
        s.tmy = 0;
      } else {
        s.spin += (RIM_K * (s.rimTarget - s.angle) - RIM_C * s.spin) * dt;
        s.angle += s.spin * dt;
        const a = SPRING_K * (s.on - s.pos) - SPRING_C * s.vel;
        s.vel += a * dt;
        s.pos += s.vel * dt;
      }
      s.glow += ((s.on ? 1 : 0) - s.glow) * Math.min(1, dt * (s.on ? WARM_RATE : COOL_RATE));
      const fl = reduced
        ? s.glow
        : s.glow * (1 - FLICKER * Math.max(0, Math.sin(t * FLICKER_SPEED)) * Math.max(0, 1 - s.glow * FLICKER_END));

      s.mx += (s.tmx - s.mx) * Math.min(1, dt * FOLLOW_RATE);
      s.my += (s.tmy - s.my) * Math.min(1, dt * FOLLOW_RATE);
      const ix = reduced ? s.mx : s.mx + Math.sin(t * SWAY_X_SPEED) * SWAY_X;
      const iy = reduced ? s.my : s.my + Math.cos(t * SWAY_Y_SPEED) * SWAY_Y;
      const kx = lerp(KNOB_X_OFF, KNOB_X_ON, s.pos);
      const kc = kx - TRACK_X + KNOB_D / 2;
      const sq = clamp(Math.abs(s.vel) / SQUASH_SPEED, 0, SQUASH_MAX);

      const frame = { on: s.on, pos: s.pos, fl, kx, kc, sq, angle: s.angle, dots: sample(s.morph, t, reduced), ix, iy };
      if (!document.hidden || !lastDrawIdle) {
        draw(frame);
        lastDrawIdle = document.hidden;
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    mounted = {
      wrap,
      setOn,
      destroy() {
        cancelAnimationFrame(rafId);
        wrap.remove();
        if (mounted?.wrap === wrap) mounted = null;
      },
    };
    return mounted;
  }

  globalThis.AniLensSwitch = { mount };
})();
