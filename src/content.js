(() => {
  'use strict';

  // Only extension-owned enrichment requests use this gate; native requests are untouched.
  const aniFetch = globalThis.AniAmbientFetch || (globalThis.AniAmbientFetch = (() => {
    const pending = new Map(); let tail = Promise.resolve(), last = 0, blockedUntil = 0;
    try { blockedUntil = Number(sessionStorage.getItem('aniRequestCooldown') || 0); } catch {}
    return (input, init, getInterval) => {
      const key = String(input);
      if (pending.has(key)) return pending.get(key).then(r => r.clone ? r.clone() : r);
      const task = tail.catch(() => {}).then(async () => {
        if (blockedUntil > Date.now()) throw new Error('Extension requests paused after rate limit');
        let delay;
        while ((delay = Math.max(400, getInterval?.() || 0) - (Date.now() - last)) > 0) {
          await new Promise(resolve => setTimeout(resolve, Math.min(delay, 100)));
        }
        last = Date.now();
        const { timeoutMs, ...requestInit } = init || {};
        if (timeoutMs) requestInit.signal = AbortSignal.timeout(timeoutMs);
        const response = await globalThis.fetch(input, requestInit);
        if (response.status === 429 || response.status === 503) {
          blockedUntil = Date.now() + 10 * 60 * 1000;
          try { sessionStorage.setItem('aniRequestCooldown', String(blockedUntil)); } catch {}
        }
        return response;
      });
      pending.set(key, task); tail = task.then(() => {}, () => {});
      task.then(response => {
        if (!response.ok) pending.delete(key);
      }, () => pending.delete(key));
      return task.then(r => r.clone ? r.clone() : r);
    };
  })());


  // ── 一、啟動狀態與網站相容選擇器 ──
  const options = globalThis.AniAmbientSettings;
  if (!options) return;
  const DEFAULTS = options.defaults;
  // Prefer the official player, but allow its surrounding markup to change.
  const VIDEO_SELECTOR =
    '#video-container video, #ani_video video, section.player video, video.vjs-tech';
  const AD_PLAYER_SELECTOR = '.vjs-ad-playing, .vjs-ad-loading, .vjs-anigamer-ad-playing, .vjs-anigamer-m3u8-ad-playing';
  const NON_EPISODE_PLAYER_SELECTOR = `${AD_PLAYER_SELECTOR}, .ani-age-screen-ready, .ani-has-consent`;
  const SAMPLE_WIDTH = 192;
  const SAMPLE_HEIGHT = 108;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const settings = { ...DEFAULTS };
  // 第一季主要製作名單，以 8bit 作品頁與首播時公布的 STAFF 為準。
  const slimeSeasonOneStaff = [
    ['原作', '川上泰樹、伏瀨、みっつばー'],
    ['導演', '菊地康仁'],
    ['副導演', '中山敦史'],
    ['系列構成', '筆安一幸'],
    ['角色設計', '江畑諒真'],
    ['魔物設計', '岸田隆宏'],
    ['美術監督', '佐藤步'],
    ['美術設定', '藤瀨智康、佐藤正浩'],
    ['色彩設計', '齊藤麻記'],
    ['攝影監督', '佐藤洋'],
    ['平面設計', '生原雄次'],
    ['剪輯', '神宮司由美'],
    ['音響監督', '明田川仁'],
    ['音樂', 'Elements Garden'],
    ['動畫製作', '8-bit'],
  ];
  // 第二、三季依 8bit 作品頁，第四季依動畫官方 STAFF&CAST 頁。
  const slimeSeasonStaffOverrides = {
    2: { '導演': '中山敦史', '副導演': null },
    3: {
      '導演': '中山敦史', '副導演': null, '系列構成': '根元歲三',
      '概念美術': '富安健一郎（INEI）', '美術': 'Studio Naya',
      '美術設定': 'Rémi Boisseuil、藤瀨智康、佐藤正浩', '音樂': '藤間仁（Elements Garden）',
    },
    4: {
      '導演': '津田尚克', '副導演': '安田賢司', '監修': '中山敦史', '系列構成': '小川ひとみ',
      '總作畫監督': '小峰正賴、山崎秀樹、伊藤智子', '美術': 'Studio Naya',
      '美術設定': 'Rémi Boisseuil、佐藤正浩、日高綾美', 'CG 導演': '森野浩典', '音樂': 'R・O・N',
    },
  };
  // 各外傳的職務以各自的官方 STAFF&CAST 為準。
  const slimeSpinoffStaffOverrides = {
    diary: {
      '原作': '柴、伏瀨、みっつばー', '導演': '生原雄次', '副導演': null,
      '動畫導演': '井之川慎太郎、登坂晉', '系列構成': 'コタツミカン',
      '角色設計': '高井里沙、入江篤', '魔物設計': null, '美術設定': null,
      '平面設計': null, 'CG 導演': '生原雄次、相澤楓馬', '音樂': 'R・O・N',
    },
    coleus: {
      ...slimeSeasonStaffOverrides[3],
      '美術設定': '藤瀨智康、佐藤正浩',
    },
    oad: {
      '系列構成': null, '劇本': '筆安一幸', '音響製作': 'Magic Capsule', '製作': '講談社',
    },
  };
  const slimeMovieStaff = {
    '原作': '川上泰樹、伏瀨、みっつばー',
    '導演': '菊地康仁',
    '角色設計': '江畑諒真',
    '魔物設計': '岸田隆宏',
    '美術監督': '佐藤步',
    '美術': 'Studio Naya',
    '色彩設計': '齊藤麻記',
    '畫面圖像設計': '生原雄次',
    '剪輯': '神宮司由美',
    '攝影監督': '佐藤洋',
    '攝影': 'Chiptune',
    '音響監督': '明田川仁',
    '音樂': '藤間仁（Elements Garden）',
    '動畫製作': '8-bit',
    '日本發行': '萬代南夢宮影像製作',
  };
  const slimeMovies = {
    '紅蓮之絆篇': {
      synopsis: '魔國聯邦西方的拉賈小亞國陷入危機，擁有神祕力量的女王永遠也受到威脅。曾受她救助的食人魔緋色前往魔國聯邦求援，意外與視他如兄長的紅丸重逢。利姆路一行人出手相助，逐步揭開籠罩小國多年的陰謀。',
      staff: {
        ...slimeMovieStaff,
        '故事原案': '伏瀨',
        '劇本': '筆安一幸',
        '總作畫監督': '田中雄一',
        '概念美術': '富安健一郎（INEI）',
        '美術設計': 'Rémi Boisseuil、佐藤正浩',
        'CG 製作人': '町田政彌',
      },
    },
    '蒼海之淚篇': {
      synopsis: '魔國聯邦開國祭結束後，利姆路一行人到渡假島休息，遇見帶著傳家笛前來求援的巫女尤菈。有人企圖喚醒海淵國的守護神水龍，藉牠的力量攻打陸地。利姆路等人受艾爾梅西亞所託前往海底，追查水龍與尤菈身上力量的祕密。',
      staff: {
        ...slimeMovieStaff,
        '故事原案與監修': '伏瀨',
        '劇本': '根元歲三、菊地康仁',
        '總作畫監督': '小峰正賴、山崎秀樹',
        '概念美術': 'Romain Thomas',
        '意象圖與服裝設計': 'pomodorosa',
        '美術設計': 'Rémi Boisseuil、佐藤正浩、藤瀨智康',
        'CG 導演': '森野浩典',
        '動畫製作人': '江口浩平',
        '製作': '轉生史萊姆製作委員會',
      },
    },
  };
  const staffRoleAliases = new Map(Object.entries({
    '監督': '導演', '導演監督': '導演', '副監督': '副導演',
    'アニメーションディレクター': '動畫導演', 'シリーズ構成': '系列構成',
    'キャラクターデザイン': '角色設計', '角色設定': '角色設計', '人物設定': '角色設計',
    'モンスターデザイン': '魔物設計', '怪物設計': '魔物設計',
    'CGIディレクター': 'CG 導演', 'CGディレクター': 'CG 導演',
    'CGIプロデューサー': 'CG 製作人', '編集': '剪輯', '編輯': '剪輯',
    '色彩設定': '色彩設計', '撮影監督': '攝影監督', '撮影': '攝影',
    '脚本': '劇本', '腳本': '劇本', '腳本編劇': '劇本', '編劇': '劇本',
    '総作画監督': '總作畫監督', 'コンセプトアート': '概念美術', '概念藝術': '概念美術',
    'ストーリー原案': '故事原案', 'ストーリー原案・監修': '故事原案與監修',
    '故事原案・監修': '故事原案與監修', '美術デザイン': '美術設計',
    'モニターグラフィックス': '畫面圖像設計', 'アニメーションプロデューサー': '動畫製作人',
    'アニメーション制作': '動畫製作', '動畫制作': '動畫製作',
    'イメージボード・衣装デザイン': '意象圖與服裝設計', '配給': '日本發行',
  }));
  const normalizeStaffRole = role => staffRoleAliases.get(role.normalize('NFKC')) || role;
  const normalizeStaffValue = value => value.normalize('NFKC').toLowerCase()
    .replace(/エイトビット/g, '8bit').replace(/[\s.,，、・/／\p{Pd}]/gu, '');

  let danmuHeatData;
  const videoDetails = new Map();
  const getEpisodeDetails = (sn) => {
    if (!videoDetails.has(sn)) {
      const request = fetch(`https://api.gamer.com.tw/anime/v1/video.php?videoSn=${sn}`, {
        credentials: 'include', signal: AbortSignal.timeout(8000),
      })
        .then(response => response.ok ? response.json() : null)
        .then(result => {
          const video = result?.data?.video;
          if (String(video?.videoSn) !== sn) throw new Error('Missing episode');
          const breakpoint = video.breakpoint;
          const elapsedSec = Number(breakpoint?.breakPoint);
          const watchTime = String(breakpoint?.watchTime || '').replace(' ', 'T');
          const taipeiTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(watchTime)
            ? `${watchTime}+08:00` : watchTime;
          return {
            date: String(video.upTime || '').split(' ')[0].replaceAll('-', '/'),
            cover: video.cover,
            views: result.data.anime?.popular,
            duration: Number(video.duration) * 60,
            playback: elapsedSec > 0 ? { elapsedSec, watchedAt: Date.parse(taipeiTime) || 0 } : null,
          };
        }).catch(() => { videoDetails.delete(sn); return null; });
      videoDetails.set(sn, request);
    }
    return videoDetails.get(sn);
  };
  globalThis.aniGetEpisodeDetails = getEpisodeDetails;
  const episodeFrameStorageKey = 'aniEpisodeFramesV1';
  function readEpisodeFrames() {
    try {
      return new Map(JSON.parse(localStorage.getItem(episodeFrameStorageKey) || '[]'));
    } catch {
      return new Map();
    }
  }
  const episodeFrameReady = 'ani-episode-frame-ready';

  // Keep the pending age prompt in place when a page script requests home on idle.
  if (location.pathname === '/animeVideo.php') {
    const speedKey = 'ani-player-playback-speed';
    let preferredSpeed = 0;
    try { preferredSpeed = Number(localStorage.getItem(speedKey)); } catch {}
    const restoreSpeed = (event) => {
      const video = event.target;
      if (settings.themeEnabled && video.id === 'ani_video_html5_api' && preferredSpeed > 0 &&
          Number.isFinite(video.duration) && video.duration > 0 && !video.closest('.vjs-ad-playing, .vjs-ad-loading')) {
        video.playbackRate = preferredSpeed;
      }
    };
    document.addEventListener('loadedmetadata', restoreSpeed, true);
    document.addEventListener('playing', restoreSpeed, true);
    document.addEventListener('durationchange', syncDanmuHeat, true);
    document.addEventListener('playing', syncDanmuHeat, true);
    document.addEventListener('change', (event) => {
      if (event.target.matches?.('input[data-ani-plus-danmu-heat]')) syncDanmuHeat();
    }, true);
    document.addEventListener('click', (event) => {
      if (!settings.themeEnabled) return;
      const item = event.target.closest?.('#ani_video .vjs-playback-rate .vjs-menu-item');
      const rate = Number(item?.textContent.trim().match(/^(\d+(?:\.\d+)?)\s*[x×](?:\s*,.*)?$/i)?.[1]);
      if (!Number.isFinite(rate) || rate < 0.25 || rate > 4) return;
      preferredSpeed = rate;
      try { localStorage.setItem(speedKey, String(rate)); } catch {}
    }, true);
    window.navigation?.addEventListener('navigate', event => {
      if (!settings.themeEnabled || !event.cancelable || event.userInitiated ||
          event.navigationType === 'traverse' || navigator.userActivation?.isActive) return;
      const to = new URL(event.destination.url);
      if (to.origin !== location.origin || !['/', '/index.php'].includes(to.pathname)) return;
      const consent = document.querySelector('#ani_video .choose-btn-agree, #ani_video .ani-consent-accept');
      if (consent?.getClientRects().length) event.preventDefault();
    });
  }
  const systemAppearance = matchMedia('(prefers-color-scheme:light)');
  systemAppearance.addEventListener('change', () => {
    if (settings.appearance === 'system') applyPageTheme();
  });
  let active = null;
  let syncScrollMiniPlayer;
  let rebindTimer;
  let saveTimer;
  let settingsPanel;
  let watchLayout;
  let watchRelatedPlacement = null;
  const observedCommentLists = new WeakSet();
  let infoLinkPlacement = null;
  const regionFolds = new Map();
  const originalControlStyles = new Map();
  let navLayout;
  let fontLink;
  let fontStatus = '使用系統字體，無需下載。';
  let fontRequest = 0;
  const fonts = {
    wenkai: {
      family: '"LXGW WenKai TC"',
      url: 'https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC:wght@300;400;700&display=swap',
    },
    chironHei: {
      family: '"Chiron Hei HK"',
      url: 'https://fonts.googleapis.com/css2?family=Chiron+Hei+HK:wght@400;500;700&display=swap',
    },
    chironSung: {
      family: '"Chiron Sung HK"',
      url: 'https://fonts.googleapis.com/css2?family=Chiron+Sung+HK:wght@400;600;700&display=swap',
    },
    sans: {
      family: '"Noto Sans TC"',
      url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&display=swap',
    },
    serif: {
      family: '"Noto Serif TC"',
      url: 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;500;600;700&display=swap',
    },
    iansui: {
      family: '"Iansui"',
      url: 'https://fonts.googleapis.com/css2?family=Iansui&display=swap',
    },
  };
  const imageObserver =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              const image = entry.target;
              imageObserver.unobserve(image);
              if (image.src.startsWith('data:image/gif') && image.dataset.src) {
                image.src = image.dataset.src;
              }
            }
          },
          { rootMargin: '500px 0px' },
        )
      : null;

  const storage =
    globalThis.AniAmbientStorage || globalThis.chrome?.storage?.sync;
  let fontSettingsKnown = !storage;
  let initialUiBound = false;
  if (storage) {
    storage.get(DEFAULTS, (saved) => {
      fontSettingsKnown = true;
      if (!globalThis.chrome?.runtime?.lastError) Object.assign(settings, options.normalize(saved));
      applyPageTheme();
      active?.applySettings();
      active?.refresh();
      syncSettingsPanel();
      markInitialUiReady();
    });
    (
      globalThis.AniAmbientStorage?.onChanged ||
      globalThis.chrome?.storage?.onChanged
    )?.addListener((changes, area) => {
      if (area !== 'sync') return;
      const updated = {};
      for (const key of Object.keys(DEFAULTS))
        if (changes[key]) updated[key] = changes[key].newValue;
      Object.assign(settings, options.normalize(updated, settings));
      applyPageTheme();
      active?.applySettings();
      active?.refresh();
      syncSettingsPanel();
    });
  }

  // ── 二、主題配色、字體與可逆的頁面重排 ──
  let randomBackground;
  const siteAnimations = new WeakMap();
  function animateSiteElement(element,kind='fadeIn',duration=200){
    if(!element||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    siteAnimations.get(element)?.();
    const animationClass=`animate__${kind}`;
    element.style.setProperty('--animate-duration',`${duration}ms`);
    const cleanup=()=>{element.classList.remove('animate__animated',animationClass);element.removeEventListener('animationend',end);clearTimeout(timer);siteAnimations.delete(element);};
    const end=event=>{if(event.target===element)cleanup();};
    const timer=setTimeout(cleanup,duration+120);
    element.addEventListener('animationend',end);element.classList.add('animate__animated',animationClass);siteAnimations.set(element,cleanup);
  }
  document.addEventListener('visibilitychange', () => document.body?.classList.toggle('ani-background-paused',document.hidden));
  function applySelectedFont() {
    const font =
      settings.fontFamily === 'custom' && settings.customFontName
        ? {
            family: JSON.stringify(settings.customFontName),
            url: settings.customFontGoogle
              ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(settings.customFontName)}&display=swap`
              : null,
          }
        : fonts[settings.fontFamily];
    if (font?.url) {
      try {
        localStorage.setItem('aniFontUrlHint', font.url);
      } catch {}
    } else {
      try {
        localStorage.removeItem('aniFontUrlHint');
      } catch {}
    }
    const preloadedFontLink =
      font?.url && document.getElementById('ani-intro-font')?.getAttribute('href') === font.url
        ? document.getElementById('ani-intro-font')
        : null;
    if (font?.url && (!fontLink?.isConnected || fontLink.getAttribute('href') !== font.url)) {
      const request = ++fontRequest;
      fontStatus = '正在載入 Google 字體…';
      fontLink?.remove();
      const link = preloadedFontLink || document.createElement('link');
      fontLink = link;
      link.rel = 'stylesheet';
      if (!preloadedFontLink) {
        link.href = font.url;
        link.media = 'print';
      }
      link.onload = async () => {
        if (request !== fontRequest) return;
        link.media = 'all';
        try {
          const loaded = await document.fonts.load(
            `16px ${font.family}`,
            '動畫瘋看見光故事',
          );
          if (!loaded.length) throw new Error('Font unavailable');
          if (request === fontRequest) {
            fontStatus = '字體已載入，已套用頁面文字。';
            syncSettingsPanel();
          }
        } catch {
          if (request === fontRequest) {
            fontStatus = '字體未能載入，目前使用系統字體。';
            syncSettingsPanel();
          }
        }
      };
      link.onerror = () => {
        if (request === fontRequest) {
          fontStatus = '無法連線 Google Fonts，目前使用系統字體。';
          syncSettingsPanel();
        }
      };
      if (!link.isConnected) document.head.append(link);
      else if (link.sheet && link.media === 'all') void link.onload();
    } else if (!font?.url) {
      fontRequest++;
      fontLink?.remove();
      fontLink = null;
      fontStatus = font
        ? '使用裝置字體；裝置未安裝時會使用備用字體。'
        : '使用系統字體，無需下載。';
    }
    document.body?.style.setProperty(
      '--ani-font',
      font
        ? `${font.family},system-ui,"Microsoft JhengHei",sans-serif`
        : 'system-ui,"Microsoft JhengHei",sans-serif',
    );
    const introFont=font?`${font.family},system-ui,"Microsoft JhengHei",sans-serif`:'system-ui,"Microsoft JhengHei",sans-serif';document.documentElement.style.setProperty('--ani-font',introFont);try{localStorage.setItem('aniIntroFontHint',introFont);sessionStorage.setItem('aniIntroFont',introFont);}catch{}
    document.body?.classList.toggle('ani-custom-font', Boolean(font));
  }

  function applyPageTheme() {
    // This theme owns both light and dark palettes. A second automatic
    // recoloring pass turns translucent white rims into dark opaque fills.
    let themeLock=document.querySelector('meta[data-ani-theme-lock]');
    if(settings.themeEnabled && !document.querySelector('meta[name="darkreader-lock"]')) {
      themeLock=document.createElement('meta');themeLock.name='darkreader-lock';themeLock.dataset.aniThemeLock='true';document.head.append(themeLock);
    } else if(!settings.themeEnabled) themeLock?.remove();
    if (document.body) {
      document.body.classList.toggle('ani-home-page',location.pathname === '/' || location.pathname === '/index.php');
      document.body.classList.toggle('ani-video-page', location.pathname === '/animeVideo.php');
      document.body.classList.toggle('ani-party-page',location.pathname === '/party_entrance.php');
      document.body.classList.toggle('ani-collection-page',location.pathname === '/mygather.php');
      document.body.classList.toggle('ani-history-page',location.pathname === '/viewList.php');
      document.body.classList.toggle('ani-redeem-page',location.pathname === '/redeem.php');
      const choices = ['silk','mist','firefly','sand','rays','diffuse','aurora','cloud','mesh','grain','ice','flow','dots'];
      if (!randomBackground) {
        let previous = '';
        try { previous = sessionStorage.getItem('aniPreviousBackground') || ''; } catch {}
        // Reloading the extension/page must not shuffle the current tab's backdrop.
        randomBackground = choices.includes(previous) ? previous : choices[Math.floor(Math.random()*choices.length)];
        try { sessionStorage.setItem('aniPreviousBackground',randomBackground); } catch {}
      }
      const mode = settings.pageBackgroundMode;
      document.body.dataset.aniBackground = !settings.themeEnabled || mode === 'off' ? 'off' : mode === 'random' ? randomBackground : mode === 'image' ? 'image' : settings.pageBackgroundStyle;
      const image = settings.pageBackgroundImage;
      document.body.style.setProperty('--ani-background-image', typeof image === 'string' && image.startsWith('https://') ? `url(${JSON.stringify(image)})` : 'none');
    }
    document.body?.classList.toggle(
      'ani-controls-transparent',
      settings.controlStyle === 'transparent',
    );
    document.body?.classList.toggle(
      'ani-custom-danmu-font',
      settings.danmuFontEnabled,
    );
    document.body?.style.setProperty(
      '--ani-editor-opacity',
      String(settings.settingsOpacity / 100),
    );
    document.body?.style.setProperty(
      '--ani-collapsed-player-spacing',
      `${settings.collapsedPlayerSpacing}px`,
    );
    const danmuButton = document.querySelector('.ani-danmu-toggle');
    if (danmuButton) {
      danmuButton.textContent = settings.showDanmu ? '收合彈幕' : '展開彈幕';
      danmuButton.setAttribute('aria-expanded', String(settings.showDanmu));
    }
    document.body?.classList.toggle('ani-focus-mode', settings.focusMode);
    document.body?.classList.toggle('ani-footer-glow', settings.footerGlow);
    document.body?.style.setProperty('--ani-card-glow-opacity',String(settings.cardGlowEnabled?settings.cardGlowIntensity/100:0));
    document.body?.classList.toggle(
      'ani-hidden-danmu-scrollbar',
      settings.hideDanmuScrollbar,
    );
    globalThis.AniHomeDashboard?.mount(settings);
    document.body?.style.setProperty(
      '--ani-button-opacity',
      String(settings.buttonOpacity / 100),
    );
    document.body?.style.setProperty(
      '--ani-comment-width',
      `${settings.commentWidth}px`,
    );
    const focusButton = document.querySelector('.ani-focus-toggle');
    if (focusButton) {
      focusButton.textContent = settings.focusMode ? '結束專注' : '專注觀看';
      focusButton.setAttribute('aria-pressed', String(settings.focusMode));
    }
    if (fontSettingsKnown) applySelectedFont();
    document.body?.classList.toggle(
      'ani-ambientlight-page',
      Boolean(settings.themeEnabled),
    );
    document.body?.classList.toggle(
      'ani-ambientlight-ui',
      Boolean(settings.uiEffectsEnabled),
    );
    document.documentElement.classList.toggle('ani-ambientlight-ui', Boolean(settings.uiEffectsEnabled));
    for (const [suffix, key] of Object.entries({
      nav: 'navLayout',
      watch: 'watchLayout',
      episodes: 'episodesLayout',
      info: 'infoLayout',
      related: 'relatedLayout',
      news: 'newsLayout',
      comments: 'commentsLayout',
    }))
      document.body?.classList.toggle(
        `ani-layout-${suffix}`,
        Boolean(settings.themeEnabled && settings[key]),
      );
    document.body?.classList.toggle(
      'ani-custom-watch-width',
      Boolean(settings.customWatchWidth),
    );
    document.body?.classList.toggle(
      'ani-episodes-scroll',
      settings.episodeStyle === 'scroll',
    );
    document.body?.classList.toggle(
      'ani-comments-compact',
      settings.commentDensity === 'compact',
    );
    for (const [suffix, key] of Object.entries({
      info: 'showInfo',
      related: 'showRelated',
      merch: 'showMerch',
      news: 'showNews',
      'home-news': 'showHomeNews',
      comments: 'showComments',
    }))
      document.body?.classList.toggle(`ani-hide-${suffix}`, !settings[key]);
    document.body?.classList.toggle(
      'ani-hide-sidebar-ads',
      Boolean(settings.hideSidebarAds),
    );
    document.body?.classList.toggle('ani-hide-danmu', !settings.showDanmu);
    syncDanmuHeat();
    document.body?.classList.toggle('ani-blur-episode-thumbnails', settings.blurEpisodeThumbnails);
    document.body?.classList.toggle('ani-hide-episode-description', !settings.showEpisodeDescription);
    if (!settings.showInfo && document.querySelector('.subtitle .ani-tabs-link.is-active[href="#ani-tab-content-intro"]'))
      document.querySelector('.subtitle .ani-tabs-link[href="#ani-tab-content-1"]')?.click();
    document.body?.classList.toggle(
      'ani-theme-light',
      settings.appearance === 'light' ||
        (settings.appearance === 'system' && systemAppearance.matches),
    );
    for (const key of [
      'headerOpacity',
      'headerTint',
      'panelOpacity',
      'panelTint',
      'infoOpacity',
      'relatedOpacity',
      'newsOpacity',
      'commentOpacity',
    ])
      document.body?.style.setProperty(
        `--ani-${key.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase())}`,
        String(
          (settings.uiEffectsEnabled ? settings[key] : DEFAULTS[key]) / 100,
        ),
      );
    document.body?.style.setProperty(
      '--ani-watch-width',
      `${settings.watchWidth}px`,
    );
    for (const [name, value] of Object.entries({
      'text-size': `${settings.textSize}px`,
      'text-leading': settings.textLeading / 100,
      radius: `${settings.cornerRadius}px`,
      'section-spacing': `${settings.sectionSpacing}px`,
      'comment-image-width': `${settings.commentImageWidth}px`,
      'danmu-font': `${settings.danmuTextSize}px`,
      'danmu-row-spacing': `${settings.danmuRowSpacing}px`,
      'danmu-width': `${settings.danmuWidth}px`,
    }))
      document.body?.style.setProperty(`--ani-${name}`, String(value));
    const light =
      settings.appearance === 'light' ||
      (settings.appearance === 'system' && systemAppearance.matches);
    const palettes = {
      slate: {
        dark: ['#0f1621', '23,35,50', '#1e2d40', '#e2eaf2', '#94a6ba'],
        light: ['#f4f4f6', '252,252,253', '#e5e7eb', '#1e2024', '#535965'],
      },
      neutral: {
        dark: ['#161618', '31,31,33', '#2a2a2d', '#d8d8da', '#a0a0a6'],
        light: ['#f5f5f5', '252,252,253', '#e7e7e9', '#202022', '#5a5a5e'],
      },
      paper: {
        dark: ['#1c1812', '38,34,26', '#342e23', '#dddad5', '#aca69a'],
        light: ['#f6f5f3', '253,253,252', '#ece9e4', '#24221e', '#655e53'],
      },
      forest: {
        dark: ['#141a17', '27,36,32', '#25312b', '#d5ddd9', '#9aaca3'],
        light: ['#f4f6f5', '252,253,252', '#e5ebe8', '#1e2421', '#53655c'],
      },
      violet: {
        dark: ['#16141a', '31,27,36', '#2a2531', '#d8d5dd', '#a29aac'],
        light: ['#f5f4f6', '252,252,253', '#e8e5eb', '#211e24', '#5a5365'],
      },
    };
    const surfaceRgb = settings.customSurface
      .slice(1)
      .match(/.{2}/g)
      .map((c) => parseInt(c, 16))
      .join(',');
    const palette = settings.customPalette
      ? [
          settings.customBase,
          surfaceRgb,
          settings.customSoft,
          settings.customText,
          settings.customMuted,
        ]
      : palettes[settings.colorTheme][light ? 'light' : 'dark'];
    if (settings.uiEffectsEnabled) {
      ['base', 'surface-rgb', 'soft', 'text', 'muted'].forEach((key, index) =>
        document.body?.style.setProperty(`--ani-${key}`, palette[index]),
      );
      const accentColor = settings.customPalette
        ? settings.customAccent
        : !light && settings.accentHue === 185 && settings.accentStrength === 50
          ? '#3dafb6'
          : `hsl(${settings.accentHue} ${settings.accentStrength}% ${light ? 30 : 72}%)`;
      document.body?.style.setProperty('--ani-accent', accentColor);
      document.body?.style.setProperty(
        '--ani-line',
        light ? '#2a425738' : '#b7c7d330',
      );
    } else
      for (const key of [
        'base',
        'surface-rgb',
        'soft',
        'text',
        'muted',
        'accent',
        'line',
      ])
        document.body?.style.removeProperty(`--ani-${key}`);
    arrangeWatchPage();
    arrangeNavigation();
    syncCollapsibleRegions();
    syncNativeControls();
    syncScrollMiniPlayer?.();
  }
  applyPageTheme();

  function arrangeWatchPage() {
    const enabled =
      settings.themeEnabled && settings.watchLayout && settings.episodesLayout;
    if (watchLayout && (!watchLayout.root.isConnected || !enabled)) {
      if (watchLayout.anchor.isConnected)
        watchLayout.anchor.replaceWith(watchLayout.season);
      watchLayout.season.hidden = false;
      watchLayout.season.classList.remove('ani-fold-content');
      watchLayout.shelf.remove();
      watchLayout = null;
    }
    if (watchLayout) {
      syncEpisodeFold();
    }
    if (!enabled || watchLayout) return;
    const root = document.querySelector(
      '#BH_background > .container-player:has(> section.player)',
    );
    const title = root?.querySelector(':scope > .anime-title');
    const season = title?.querySelector('.season');
    if (!root || !season) return;
    const anchor = document.createComment('ani-original-episodes');
    season.before(anchor);
    const shelf = document.createElement('section');
    shelf.className = 'ani-episode-shelf';
    shelf.setAttribute('aria-label', '集數');
    const heading = document.createElement('div');
    heading.className = 'ani-episode-heading';
    const label = document.createElement('h2');
    label.innerHTML = '<span class="ani-section-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3.5" y="4" width="7" height="7" rx="1.6"/><rect x="13.5" y="4" width="7" height="7" rx="1.6"/><rect x="3.5" y="13" width="7" height="7" rx="1.6"/><rect x="13.5" y="13" width="7" height="7" rx="1.6"/></svg></span>集數';
    const count = document.createElement('span');
    count.textContent = `${season.querySelectorAll('li:not(.ani-upcoming-episode)').length} 集`;
    heading.append(label, count);
    shelf.append(heading, season);
    title.after(shelf);
    for (const link of season.querySelectorAll('li.playing a'))
      link.setAttribute('aria-current', 'page');
    watchLayout = { root, season, anchor, shelf, heading };
    syncEpisodeFold();
  }

  // 收合僅由使用者開啟；取消功能時，原內容與顯示狀態會復原。
  function syncEpisodeFold() {
    if (!watchLayout) return;
    const { season, heading } = watchLayout;
    const enabled =
      settings.quickCollapse || settings.episodeStyle === 'collapse';
    if (!enabled) {
      watchLayout.foldButton?.remove();
      watchLayout.foldButton = null;
      season.classList.remove('ani-fold-content');
      season.hidden = false;
      return;
    }
    if (watchLayout.foldButton) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className =
      'ani-region-toggle ani-section-toggle ani-episode-section-toggle';
    season.id = season.id || 'ani-episode-list';
    button.setAttribute('aria-controls', season.id);
    const refreshLabel = () => {
      const action = season.hidden ? '展開' : '收合';
      button.setAttribute('aria-label', action + '集數');
      button.innerHTML = `<strong><span class="ani-section-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3.5" y="4" width="7" height="7" rx="1.6"/><rect x="13.5" y="4" width="7" height="7" rx="1.6"/><rect x="3.5" y="13" width="7" height="7" rx="1.6"/><rect x="13.5" y="13" width="7" height="7" rx="1.6"/></svg></span>集數 <small>${season.querySelectorAll('li').length} 集</small></strong><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
    };
    const toggle = () => {
      season.hidden = !season.hidden;
      button.setAttribute('aria-expanded', String(!season.hidden));
      refreshLabel();
    };
    season.classList.add('ani-fold-content');
    season.hidden = settings.episodeStyle === 'collapse';
    button.setAttribute('aria-expanded', String(!season.hidden));
    refreshLabel();
    button.addEventListener('click', toggle);
    heading.append(button);
    watchLayout.foldButton = button;
  }

  function syncCollapsibleRegions() {
    const rearrangeInfo = settings.themeEnabled && settings.infoLayout;
    if (!rearrangeInfo && infoLinkPlacement) {
      const { poster, link, posterAnchor, linkAnchor, rail } =
        infoLinkPlacement;
      posterAnchor.replaceWith(poster);
      linkAnchor.replaceWith(link);
      rail.remove();
      infoLinkPlacement = null;
    } else if (rearrangeInfo && !infoLinkPlacement) {
      const file = document.querySelector('section.data .data-file');
      const poster = file?.querySelector(':scope > .data-img');
      const link = file?.querySelector('.data-intro .link');
      if (poster && link) {
        const posterAnchor = document.createComment('ani-original-poster');
        const linkAnchor = document.createComment('ani-original-info-links');
        const rail = document.createElement('div');
        rail.className = 'ani-info-poster';
        poster.before(posterAnchor);
        link.before(linkAnchor);
        posterAnchor.after(rail);
        rail.append(poster, link);
        infoLinkPlacement = { poster, link, posterAnchor, linkAnchor, rail };
      }
    }
    const commentHeader = document.querySelector(
      '.commend-title .commend-segment-wrapper',
    );
    if (commentHeader && settings.themeEnabled && settings.commentsLayout) {
      for (const menu of document.querySelectorAll('#w-post-box a.reply_menu:not(:has(.ani-report-flag))')) {
        menu.setAttribute('aria-label', '留言操作與檢舉');
        menu.insertAdjacentHTML('afterbegin','<svg class="ani-report-flag" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 21V4q4-3 8 0t7 0v10q-4 3-8 0t-7 0"/></svg>');
      }
      for (const time of document.querySelectorAll('#w-post-box .reply_time')) {
        const formatted = time.textContent.replace(/(\d{1,2})月(\d{1,2})日/g, '$1/$2').replace(/(\d{4})-(\d{2})-(\d{2})/g,'$1/$2/$3');
        if (formatted !== time.textContent) time.textContent = formatted;
      }
      const title = commentHeader.querySelector('.commend-board p');
      if (title && !title.querySelector('svg')) {
        title.insertAdjacentHTML('afterbegin', '<svg class="ani-comment-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-6 4V5a1 1 0 0 1 1-1Z"/><path d="M7 9h10M7 13h7"/></svg>');
      }
      const count = commentHeader.querySelector('#w-anime-comment-count');
      if (title && count && title.nextElementSibling !== count) title.after(count);
      if (count && !count.hasAttribute('data-ani-last-count')) {
        const rememberCount = () => {
          const label = count.textContent.trim();
          if (label) count.dataset.aniLastCount = label;
        };
        count.dataset.aniLastCount = '';
        rememberCount();
        new MutationObserver(rememberCount).observe(count, {childList:true, characterData:true, subtree:true});
      }
      const filter = commentHeader.querySelector('.btn-newanime-filter');
      if (filter && !commentHeader.querySelector('.ani-comment-sort')) {
        const options = [...filter.querySelectorAll('.filter-items li')];
        if (options.length) {
          const group = document.createElement('div');
          group.className = 'ani-comment-sort';
          group.setAttribute('role', 'group');
          group.setAttribute('aria-label', '留言排序');
          const sync = () => options.forEach((opt,i) => group.children[i].setAttribute('aria-pressed', String(opt.classList.contains('is-active'))));
          for (const opt of options) {
            const button = document.createElement('button');
            button.type = 'button';
            button.innerHTML = opt.matches('.item-recommend')
              ? '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9Z"/></svg>'
              : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l4 2"/></svg>';
            button.append(opt.textContent.trim().replace(/排序$/, ''));
            button.addEventListener('click', () => { opt.click(); sync(); });
            group.append(button);
          }
          filter.after(group);
          sync();
        }
      }
      const commentBox = document.querySelector('#w-post-box');
      const list = commentBox?.querySelector('.webview_commendlist');
      if (commentBox && !commentBox.parentElement.classList.contains('ani-comment-columns')) {
        const columns = document.createElement('div');
        columns.className = 'ani-comment-columns';
        commentBox.before(columns);
        columns.append(commentBox);
        const aside = document.createElement('aside');
        aside.className = 'ani-comment-recommendations';
        aside.hidden = true;
        columns.append(aside);
        renderCommentRecommendations(aside);
      }
      if (list && !observedCommentLists.has(list)) {
        observedCommentLists.add(list);
        let lastPage = '';
        const loadMore = () => {
          const more = list.querySelector(':scope > [data-evt-morecomment]');
          if (!more?.getClientRects().length) return;
          const key = more.getAttribute('data-evt-morecomment') + ':' + list.querySelectorAll(':scope > [id^="CBX"] > [data-w-comment-row]').length;
          if (lastPage === key) return;
          lastPage = key;
          more.click();
        };
        new MutationObserver(loadMore).observe(list, {childList:true, subtree:true});
        loadMore();

      }
    }
    const watchContainer = document.querySelector('#BH_background > .container-player:has(> section.player)');
    const storeEl = watchContainer?.querySelector('.store_wrapper');
    const merchContainer = storeEl
      ? [...watchContainer.children].find(
          (el) => !el.matches('section.player, .old_list, .anime-title, .ani-episode-shelf, section.data, .ani-watch-related-row') && el.contains(storeEl)
        ) || storeEl.closest('.ani-merch-section')
      : null;
    if (merchContainer) merchContainer.classList.add('ani-merch-section');
    const relatedEl = watchContainer?.querySelector('.old_list:not(:has(.search_result))') || null;
    const shouldGroupWatchRow = Boolean(settings.themeEnabled && settings.watchLayout && watchContainer && (relatedEl || merchContainer));
    if (watchRelatedPlacement && (!shouldGroupWatchRow || watchRelatedPlacement.container !== watchContainer)) {
      if (watchRelatedPlacement.relatedAnchor?.isConnected && watchRelatedPlacement.relatedEl) {
        watchRelatedPlacement.relatedAnchor.replaceWith(watchRelatedPlacement.relatedEl);
      }
      if (watchRelatedPlacement.merchAnchor?.isConnected && watchRelatedPlacement.merchEl) {
        watchRelatedPlacement.merchAnchor.replaceWith(watchRelatedPlacement.merchEl);
      }
      watchRelatedPlacement.row.remove();
      watchRelatedPlacement = null;
    }
    if (shouldGroupWatchRow) {
      let state = watchRelatedPlacement;
      if (!state || !state.row.isConnected) {
        const row = document.createElement('div');
        row.className = 'ani-watch-related-row';
        state = { container: watchContainer, row, relatedEl: null, relatedAnchor: null, merchEl: null, merchAnchor: null, relatedCol: null, merchCol: null };
        watchRelatedPlacement = state;
      }
      const relatedCount = relatedEl?.querySelectorAll('.theme-list-main').length ?? 0;
      const productCount = storeEl?.querySelectorAll('.store_item, li').length ?? 0;
      state.row.classList.toggle('ani-watch-related-compact', relatedCount <= 2 && productCount <= 2);
      const afterEl = watchContainer.querySelector(':scope > .ani-episode-shelf, :scope > .anime-title');
      if (afterEl && afterEl.nextElementSibling !== state.row) afterEl.after(state.row);
      else if (!afterEl && state.row.parentElement !== watchContainer) watchContainer.append(state.row);
      if (relatedEl && relatedEl.closest('.ani-watch-related-row') !== state.row) {
        const anchor = document.createComment('ani-original-related');
        relatedEl.before(anchor);
        const col = document.createElement('div');
        col.className = 'ani-watch-col ani-watch-col-related';
        col.append(relatedEl);
        state.row.prepend(col);
        state.relatedEl = relatedEl;
        state.relatedAnchor = anchor;
        state.relatedCol = col;
      }
      if (merchContainer && merchContainer.closest('.ani-watch-related-row') !== state.row) {
        const anchor = document.createComment('ani-original-merch');
        merchContainer.before(anchor);
        const col = document.createElement('div');
        col.className = 'ani-watch-col ani-watch-col-merch';
        col.append(merchContainer);
        state.row.append(col);
        state.merchEl = merchContainer;
        state.merchAnchor = anchor;
        state.merchCol = col;
      }
    }
    const hasSidebarTabs = Boolean(document.querySelector('.subtitle .ani-tabs'));
    const regions = {
      ...(hasSidebarTabs ? {} : { info: ['section.data', '作品資訊', 'foldInfo', 'showInfo', 3] }),
      related: ['.old_list:not(:has(.search_result))', '相關動畫', 'foldRelated', 'showRelated', 4],
      merch: ['.ani-merch-section', '相關商品', 'foldRelated', 'showMerch', 7],
      news: ['.animate-theme-list > .theme-extend-block:has(.extend-card)', '相關新聞', 'foldNews', 'showNews', 8],
    };
    for (const [key, [selector, name, flag, visible, order]] of Object.entries(
      regions,
    )) {
      const target = key === 'news' && location.pathname !== '/animeVideo.php'
        ? null
        : document.querySelector('#BH_background ' + selector);
      let state = regionFolds.get(key);
      const enabled =
        settings.themeEnabled &&
        (settings.quickCollapse || settings[flag]) &&
        settings[visible] &&
        target;
      if (
        state &&
        (!enabled || state.target !== target || !state.target.isConnected)
      ) {
        state.target.hidden = state.originalHidden;
        state.target.classList.remove('ani-fold-content');
        state.button.remove();
        regionFolds.delete(key);
        state = null;
      }
      if (!enabled || state) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ani-region-toggle ani-region-fold-control';
      button.dataset.aniRegion = key;
      if (key !== 'comments') button.classList.add('ani-section-toggle');
      if (key !== 'news') button.style.order = String(order);
      const originalHidden = target.hidden;
      target.id = target.id || 'ani-fold-' + key;
      button.setAttribute('aria-controls', target.id);
      button.setAttribute('aria-expanded', String(!originalHidden));
      const refreshLabel = () => {
        const action = target.hidden ? '展開' : '收合';
        button.setAttribute('aria-label', action + name);
        if (key === 'comments') {
          button.title = action + name;
          button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>';
        }
        else {
          const toggleIcon =
            key === 'related'
              ? '<span class="ani-section-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m10 9 5 3-5 3V9Z"/></svg></span>'
              : key === 'merch'
                ? '<span class="ani-section-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7.5" width="16" height="13.5" rx="3"/><path d="M8.5 7.5V6a3.5 3.5 0 0 1 7 0v1.5"/><path d="M9.5 12a2.5 2.5 0 0 0 5 0"/></svg></span>'
                : key === 'news'
                  ? '<span class="ani-section-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h4v4H7zM14 12h3m-3 4h3"/></svg></span>'
                  : '';
          button.innerHTML = `<strong>${toggleIcon}${name}</strong><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
        }
      };
      refreshLabel();
      button.addEventListener('click', () => {
        target.hidden = !target.hidden;
        button.setAttribute('aria-expanded', String(!target.hidden));
        refreshLabel();
      });
      target.classList.add('ani-fold-content');
      const commentHeader =
        key === 'comments'
          ? document.querySelector(
              '#BH_background .commend-title .commend-segment-wrapper',
            )
          : null;
      if (commentHeader) (commentHeader.querySelector('.ani-comment-actions') || commentHeader).append(button);
      else target.before(button);
      regionFolds.set(key, { target, button, originalHidden });
    }
  }

  // 原站模式保留實際底色與文字色，切回主題時還原既有行內樣式。
  function syncNativeControls() {
    if (settings.controlStyle !== 'native' || !settings.uiEffectsEnabled) {
      for (const [node, styles] of originalControlStyles) {
        for (const [key, [value, priority]] of Object.entries(styles)) {
          if (value) node.style.setProperty(key, value, priority);
          else node.style.removeProperty(key);
        }
      }
      originalControlStyles.clear();
      return;
    }
    for (const node of originalControlStyles.keys())
      if (!node.isConnected) originalControlStyles.delete(node);
    const body = document.body,
      active = body.classList.contains('ani-ambientlight-ui');
    const props = ['background-color', 'color', 'border-color'];
    const pending = [...document.querySelectorAll(
      '.anime_search-input,.anime_search-input input,.anime_search-icon,.anime_name>button,.ani-episode-shelf .season a,.subtitle button,.user-score-more',
    )].filter(node => !originalControlStyles.has(node));
    if (!pending.length) return;
    body.classList.remove('ani-ambientlight-ui');
    const snapshots = pending.map(node => {
      const computed = getComputedStyle(node);
      return props.map(key => computed.getPropertyValue(key));
    });
    if (active) body.classList.add('ani-ambientlight-ui');
    pending.forEach((node, idx) => {
      const saved = Object.fromEntries(
        props.map((key) => [
          key,
          [
            node.style.getPropertyValue(key),
            node.style.getPropertyPriority(key),
          ],
        ]),
      );
      const colors = snapshots[idx];
      originalControlStyles.set(node, saved);
      props.forEach((key, index) =>
        node.style.setProperty(key, colors[index], 'important'),
      );
    });
  }

  function getNavIconSvg(href, text) {
    const target = `${href} ${text}`.toLowerCase();
    if (/index\.php|^\/$|^首頁$/.test(href) || text.includes('首頁')) {
      return '<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M37.1681 21.645H33.7616V33.9493C33.7616 34.8619 33.3664 36 31.7243 36H23.5748V23.6958H15.4254V36H7.27595C5.63383 36 5.23858 34.8619 5.23858 33.9493V21.645H1.83212C0.613773 21.645 0.874556 20.9806 1.70987 20.1111L18.0577 3.63982C18.4549 3.22558 18.9765 3.02051 19.5001 3C20.0237 3.02051 20.5453 3.22353 20.9426 3.63982L37.2883 20.1091C38.1257 20.9806 38.3865 21.645 37.1681 21.645Z" fill="currentColor"/></svg>';
    }
    if (/animelist/i.test(target) || text.includes('所有動畫')) {
      return '<svg viewBox="0 0 55 55" fill="none" aria-hidden="true"><path d="M34.9736 32.8947C36.7649 31.7083 36.7649 29.0788 34.9736 27.8924L26.5316 22.3011C24.5373 20.9803 21.875 22.4103 21.875 24.8023V35.9848C21.875 38.3768 24.5373 39.8068 26.5316 38.486L34.9736 32.8947Z" fill="currentColor"/><path d="M36.9214 0.546411C37.5564 -0.182137 38.5861 -0.182137 39.2212 0.546411C39.8563 1.27496 39.8563 2.45617 39.2212 3.18472L36.1094 6.75452C37.9452 6.76169 39.5726 6.79042 40.9751 6.90501C42.9519 7.06652 44.918 7.4231 46.8099 8.38707C49.6323 9.82517 51.927 12.1199 53.3651 14.9423C54.3291 16.8342 54.6856 18.8003 54.8472 20.777C55.0002 22.6498 55.0001 24.9235 55 27.5591V33.2276C55.0001 35.8632 55.0002 38.1373 54.8472 40.0101C54.6856 41.9868 54.3291 43.9529 53.3651 45.8448C51.927 48.6672 49.6323 50.9619 46.8099 52.4C44.918 53.364 42.9519 53.7206 40.9751 53.8821C39.1024 54.0351 36.8288 54.035 34.1933 54.0349H20.8074C18.1718 54.035 15.8976 54.0351 14.0249 53.8821C12.0481 53.7206 10.082 53.364 8.19015 52.4C5.36772 50.9619 3.07301 48.6672 1.63491 45.8448C0.670941 43.9529 0.314361 41.9868 0.152856 40.0101C-0.000161797 38.1372 -8.48852e-05 35.8634 4.28274e-06 33.2277L4.28414e-06 27.5594C-8.48838e-05 24.9237 -0.000161797 22.6499 0.152856 20.777C0.314361 18.8003 0.670941 16.8342 1.63491 14.9423C3.07301 12.1199 5.36772 9.82517 8.19015 8.38707C10.082 7.4231 12.0481 7.06652 14.0249 6.90501C15.6902 6.76895 17.6726 6.75393 19.9446 6.75234L17.1499 3.54641C16.5148 2.81786 16.5148 1.63665 17.1499 0.908104C17.785 0.179556 18.8147 0.179556 19.4498 0.908104L24.221 6.38145C24.3201 6.49515 24.4037 6.61986 24.4719 6.75216H31.756C31.8331 6.48442 31.9645 6.23275 32.1502 6.01976L36.9214 0.546411ZM5.00001 27.7522C5.00001 22.1516 5.00001 19.3514 6.08994 17.2123C7.04868 15.3306 8.57848 13.8008 10.4601 12.8421C12.5992 11.7522 15.3995 11.7522 21 11.7522H34C39.6005 11.7522 42.4008 11.7522 44.5399 12.8421C46.4215 13.8008 47.9513 15.3306 48.9101 17.2123C50 19.3514 50 22.1516 50 27.7522V33.0349C50 38.6354 50 41.4357 48.9101 43.5748C47.9513 45.4564 46.4215 46.9862 44.5399 47.945C42.4008 49.0349 39.6005 49.0349 34 49.0349H21C15.3995 49.0349 12.5992 49.0349 10.4601 47.945C8.57848 46.9862 7.04868 45.4564 6.08994 43.5748C5.00001 41.4357 5.00001 38.6354 5.00001 33.0349V27.7522Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg>';
    }
    if (/history|紀錄/i.test(target)) {
      return '<svg viewBox="0 0 50 50" fill="none" aria-hidden="true"><path d="M32.1719 34.375L23.4375 25.6406V10.9375H26.5625V24.3438L34.375 32.1719L32.1719 34.375Z" fill="currentColor"/><path d="M25 3.125C22.0859 3.12541 19.2014 3.71059 16.5175 4.84588C13.8337 5.98117 11.4049 7.64348 9.375 9.73438V3.125H6.25V15.625H18.75V12.5H11.0625C13.9938 9.24265 17.9734 7.11489 22.3102 6.48626C26.647 5.85763 31.0669 6.76784 34.8025 9.05881C38.538 11.3498 41.3532 14.8768 42.7589 19.0273C44.1647 23.1778 44.0724 27.6896 42.4979 31.779C40.9235 35.8685 37.9664 39.2774 34.1402 41.4136C30.3141 43.5498 25.8605 44.2784 21.5531 43.4728C17.2457 42.6672 13.3565 40.3784 10.5609 37.0038C7.76539 33.6292 6.24011 29.3821 6.25 25H3.125C3.125 29.3265 4.40795 33.5558 6.8116 37.1531C9.21526 40.7504 12.6317 43.5542 16.6288 45.2099C20.6259 46.8655 25.0243 47.2987 29.2676 46.4547C33.5109 45.6106 37.4087 43.5272 40.468 40.468C43.5272 37.4087 45.6106 33.5109 46.4547 29.2676C47.2987 25.0243 46.8655 20.6259 45.2099 16.6288C43.5542 12.6317 40.7504 9.21526 37.1531 6.8116C33.5558 4.40795 29.3265 3.125 25 3.125V3.125Z" fill="currentColor"/></svg>';
    }
    if (/myanime|favorite|我的動畫/i.test(target)) {
      return '<svg viewBox="0 0 50 50" fill="none" aria-hidden="true"><path d="M24.9999 43.75C24.3726 43.7492 23.7601 43.5597 23.2421 43.2061C15.5672 37.9961 12.244 34.4238 10.411 32.1904C6.50475 27.4297 4.63463 22.542 4.68736 17.249C4.74889 11.1836 9.6151 6.25 15.535 6.25C19.8397 6.25 22.8212 8.6748 24.5575 10.6943C24.6125 10.7577 24.6804 10.8084 24.7568 10.8432C24.8331 10.878 24.916 10.8961 24.9999 10.8961C25.0837 10.8961 25.1666 10.878 25.243 10.8432C25.3193 10.8084 25.3872 10.7577 25.4422 10.6943C27.1786 8.67285 30.16 6.25 34.4647 6.25C40.3846 6.25 45.2508 11.1836 45.3124 17.25C45.3651 22.5439 43.493 27.4316 39.5887 32.1914C37.7557 34.4248 34.4325 37.9971 26.7577 43.207C26.2395 43.5603 25.627 43.7495 24.9999 43.75V43.75Z" fill="currentColor"/></svg>';
    }
    if (/party|派對/i.test(target)) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v14M16 5v14M3 10h5M3 14h5M16 10h5M16 14h5"/></svg>';
    }
    if (/pay|vip|付費/i.test(target) || text.includes('方案')) {
      return '<svg viewBox="0 0 50 50" fill="none" aria-hidden="true"><path d="M42.1875 16.25C42.1875 11.536 42.1875 9.17893 40.723 7.71447C39.2586 6.25 36.9015 6.25 32.1875 6.25H11.5625C6.84845 6.25 4.49143 6.25 3.02697 7.71447C1.5625 9.17893 1.5625 11.536 1.5625 16.25V27.5C1.5625 32.214 1.5625 34.5711 3.02697 36.0355C4.49143 37.5 6.84845 37.5 11.5625 37.5H32.1875C36.9015 37.5 39.2586 37.5 40.723 36.0355C42.1875 34.5711 42.1875 32.214 42.1875 27.5V16.25ZM39.0625 24.375C39.0625 29.089 39.0625 31.4461 37.598 32.9105C36.1336 34.375 33.7765 34.375 29.0625 34.375H14.6875C9.97346 34.375 7.61643 34.375 6.15197 32.9105C4.6875 31.4461 4.6875 29.089 4.6875 24.375V19.375C4.6875 14.661 4.6875 12.3039 6.15197 10.8395C7.61643 9.375 9.97346 9.375 14.6875 9.375H29.0625C33.7765 9.375 36.1336 9.375 37.598 10.8395C39.0625 12.3039 39.0625 14.661 39.0625 19.375V24.375Z" fill="#EB9D3D" fill-opacity="0.9"/><path d="M46.875 14.0625C46.0121 14.0625 45.3125 14.7621 45.3125 15.625V30.625C45.3125 35.339 45.3125 37.6961 43.848 39.1605C42.3836 40.625 40.0265 40.625 35.3125 40.625H10.9375C10.0746 40.625 9.375 41.3246 9.375 42.1875C9.375 43.0504 10.0746 43.75 10.9375 43.75H38.4375C43.1515 43.75 45.5086 43.75 46.973 42.2855C48.4375 40.8211 48.4375 38.464 48.4375 33.75V15.625C48.4375 14.7621 47.7379 14.0625 46.875 14.0625Z" fill="#EB9D3D" fill-opacity="0.9"/><path d="M21.875 29.5363C25.752 29.5363 28.9062 26.105 28.9062 21.8873C28.9062 17.6696 25.752 14.2383 21.875 14.2383C17.998 14.2383 14.8438 17.6695 14.8438 21.8873C14.8438 26.1051 17.998 29.5363 21.875 29.5363ZM21.875 17.3633C24.0289 17.3633 25.7812 19.3928 25.7812 21.8873C25.7812 24.3818 24.0289 26.4113 21.875 26.4113C19.7211 26.4113 17.9688 24.3818 17.9688 21.8873C17.9688 19.3928 19.7211 17.3633 21.875 17.3633Z" fill="#EB9D3D" fill-opacity="0.9"/><path d="M7.8125 14.8437C7.8125 13.9808 8.51206 13.2812 9.375 13.2812C10.2379 13.2812 10.9375 13.9808 10.9375 14.8438V28.9062C10.9375 29.7692 10.2379 30.4688 9.375 30.4688C8.51206 30.4688 7.8125 29.7692 7.8125 28.9062V14.8437Z" fill="#EB9D3D" fill-opacity="0.9"/><path d="M32.8125 14.8437C32.8125 13.9808 33.5121 13.2812 34.375 13.2812C35.2379 13.2812 35.9375 13.9808 35.9375 14.8438V28.9062C35.9375 29.7692 35.2379 30.4688 34.375 30.4688C33.5121 30.4688 32.8125 29.7692 32.8125 28.9062V14.8437Z" fill="#EB9D3D" fill-opacity="0.9"/></svg>';
    }
    if (/redeem|兌換/i.test(target)) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/></svg>';
    }
    if (/agevalidate|年齡/i.test(target)) {
      return '<svg viewBox="0 0 50 48" fill="none" aria-hidden="true"><path d="M41.67 31.27C42.54 29.03 43.01 26.63 43.01 24C43.01 22.11 42.73 20.29 42.26 18.61C40.65 19 38.96 19.21 37.2 19.21C33.6 19.22 30.04 18.3 26.84 16.54C23.64 14.78 20.88 12.23 18.8 9.11C16.58 14.82 12.38 19.41 7.07 21.95C6.97 22.61 6.97 23.32 6.97 24C6.97 26.51 7.44 29 8.34 31.32C9.25 33.64 10.58 35.75 12.25 37.53C15.63 41.12 20.22 43.13 25 43.13C27.6 43.13 30.11 42.53 32.37 41.45C33.78 44.32 34.42 45.74 34.37 45.74C30.31 47.19 27.16 47.9 25 47.9C19 47.9 13.27 45.4 9.05 40.9C6.49 38.18 4.58 34.85 3.5 31.19H0.2V19.21H2.9C3.72 14.98 5.6 11.07 8.35 7.88C11.1 4.69 14.61 2.36 18.51 1.11C22.4 -0.13 26.55 -0.22 30.49 0.83C34.44 1.89 38.04 4.05 40.92 7.11C44.05 10.41 46.18 14.62 47.05 19.21H49.8V31.19H49.65L40.82 39.79L27.68 38.21V33.82H39.66L41.67 31.27ZM18.23 23.4C18.97 23.4 19.69 23.71 20.21 24.29C20.74 24.85 21.03 25.61 21.03 26.4C21.03 27.19 20.74 27.94 20.21 28.5C19.69 29.05 18.97 29.37 18.23 29.37C16.67 29.37 15.4 28.05 15.4 26.4C15.4 24.74 16.67 23.4 18.23 23.4ZM31.75 23.4C33.31 23.4 34.55 24.74 34.55 26.4C34.55 28.05 33.31 29.37 31.75 29.37C30.18 29.37 28.92 28.05 28.92 26.4C28.92 25.6 29.22 24.84 29.75 24.28C30.28 23.71 31 23.4 31.75 23.4Z" fill="currentColor"/></svg>';
    }
    if (/forms\.gle|問題|回報/i.test(target)) {
      return '<svg viewBox="0 0 50 50" fill="none" aria-hidden="true"><path d="M41.67 4.17H8.35C6.06 4.17 4.19 6.04 4.19 8.33V41C4.19 42.78 6.34 43.67 7.6 42.41L11.91 38.09C12.29 37.71 12.8 37.5 13.33 37.5H41.67C43.96 37.5 45.83 35.63 45.83 33.33V8.33C45.83 6.04 43.96 4.17 41.67 4.17ZM27.08 27.17C27.08 28.27 26.19 29.17 25.08 29.17H24.92C23.81 29.17 22.92 28.27 22.92 27.17V27C22.92 25.9 23.81 25 24.92 25H25.08C26.19 25 27.08 25.9 27.08 27V27.17ZM27.08 18.75C27.08 19.9 26.15 22 25 22C23.85 22 22.92 19.9 22.92 18.75V14.58C22.92 13.44 23.85 11.5 25 11.5C26.15 11.5 27.08 13.44 27.08 14.58V18.75Z" fill="currentColor"/></svg>';
    }
    if (/\bapp\b|下載|dynamic_link_anime|apps\.apple/i.test(target)) {
      return '<svg viewBox="0 0 50 50" fill="none" aria-hidden="true"><path d="M12.65 32.91L21.76 41.5C22.32 42.03 23.06 42.32 23.83 42.32C24.59 42.32 25.33 42.03 25.89 41.5L35 32.91L40.66 27.58C41.1 27.17 41.41 26.63 41.55 26.04C41.68 25.45 41.63 24.83 41.41 24.27C41.18 23.71 40.79 23.23 40.29 22.89C39.79 22.55 39.2 22.37 38.59 22.38H34.4V3.14C34.4 2.31 34.06 1.51 33.47 0.92C32.88 0.33 32.08 0 31.25 0H16.4C15.57 0 14.77 0.33 14.18 0.92C13.59 1.51 13.25 2.31 13.25 3.14V22.38H9.06C8.46 22.38 7.86 22.55 7.36 22.89C6.86 23.23 6.47 23.71 6.25 24.28C6.03 24.84 5.98 25.45 6.11 26.04C6.25 26.63 6.56 27.17 7 27.58L12.65 32.91Z" fill="currentColor"/><path d="M41.77 45.5H6.23C5.54 45.5 4.98 46.06 4.98 46.75C4.98 47.44 5.54 48 6.23 48H41.77C42.46 48 43.02 47.44 43.02 46.75C43.02 46.06 42.46 45.5 41.77 45.5Z" fill="currentColor"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>';
  }

  function arrangeNavigation() {
    if (
      navLayout &&
      (!settings.themeEnabled ||
        !settings.navLayout ||
        !navLayout.root.isConnected)
    ) {
      for (const entry of navLayout.iconized || []) {
        if (entry.cleanup) { entry.cleanup(); continue; }
        entry.link.innerHTML = entry.originalHtml;
        entry.link.classList.remove('ani-nav-icon-link', 'ani-nav-payment-link');
        entry.item?.classList.remove('ani-nav-bottom-start');
        entry.link.removeAttribute('data-ani-tooltip');
        if (entry.hadAriaLabel === null) entry.link.removeAttribute('aria-label');
        else entry.link.setAttribute('aria-label', entry.hadAriaLabel);
      }
      for (const node of navLayout.hiddenDuplicates || []) {
        node.hidden = false;
        delete node.dataset.aniDuplicateApp;
      }
      navLayout.more?.remove();
      navLayout = null;
    }
    if (!settings.themeEnabled || !settings.navLayout || navLayout) return;
    const root = document.querySelector('.mainmenu > .container-player > ul');
    if (!root) return;
    const appNodes = [...root.children].filter((n) => {
      const href = n.querySelector('a')?.getAttribute('href') || '';
      const text = n.textContent || '';
      return /\bAPP\b|下載APP/i.test(text) || /apps\.apple\.com|dynamic_link_anime/i.test(href);
    });
    const iconized = [];
    const hiddenDuplicates = [];
    let markedBottomStart = false;
    for (const item of [...root.children]) {
      const link = item.querySelector('a');
      const isApp = appNodes.includes(item);
      if (isApp && appNodes.length > 1 && item.classList.contains('btn-app-download')) {
        item.dataset.aniDuplicateApp = 'true';
        item.hidden = true;
        hiddenDuplicates.push(item);
        continue;
      }
      const targetEl = link || (item.classList.contains('btn-app-download') ? item.querySelector('.btn-title') : null);
      if (!targetEl) continue;
      const toolbox = isApp && root.querySelector('.app-download-toolbox');
      if (toolbox && link) {
        const openDownload = event => {
          event.preventDefault();
          let dialog = document.querySelector('#ani-download-dialog');
          if (!dialog) {
            dialog = document.createElement('dialog');
            dialog.id = 'ani-download-dialog';
            dialog.setAttribute('aria-label', '下載 APP');
            const close = document.createElement('button');
            close.type = 'button';
            close.textContent = '×';
            close.className = 'ani-download-close';
            close.setAttribute('aria-label', '關閉');
            dialog.addEventListener('click', event => {
              if (event.target !== dialog) return;
              const rect = dialog.getBoundingClientRect();
              if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
            });
            close.addEventListener('click', () => dialog.close());
            for (const child of toolbox.children) dialog.append(child.cloneNode(true));
            const heading = dialog.querySelector('.title');
            if (heading) {
              const title = document.createElement('h2');
              title.innerHTML = getNavIconSvg('app', '下載APP');
              title.append(heading.textContent);
              heading.replaceWith(title);
            }
            dialog.append(close);
            document.body.append(dialog);
          }
          if (!dialog.open) dialog.showModal();
        };
        link.addEventListener('click', openDownload);
        iconized.push({cleanup: () => link.removeEventListener('click', openDownload)});
      }
      const originalHtml = targetEl.innerHTML;
      const hadAriaLabel = targetEl.getAttribute('aria-label');
      const rawText = targetEl.textContent.replace(/\s+/g, ' ').trim();
      const href = link?.getAttribute('href') || '';
      const isUtility =
        isApp ||
        /redeem\.php|animeAgeValidate\.php|forms\.gle|apps\.apple\.com|dynamic_link_anime/i.test(
          href,
        ) ||
        /\bAPP\b|下載APP|序號兌換|年齡驗證|問題回報/i.test(rawText);
      if (isUtility && !markedBottomStart) {
        item.classList.add('ani-nav-bottom-start');
        markedBottomStart = true;
      }
      targetEl.classList.add('ani-nav-icon-link');
      if (/pay|vip|付費/i.test(href + rawText) || rawText.includes('方案')) {
        targetEl.classList.add('ani-nav-payment-link');
      }
      if (rawText) {
        targetEl.setAttribute('aria-label', rawText);
        targetEl.setAttribute('data-ani-tooltip', rawText);
      }
      const shortLabel = rawText.replace(/beta/i, '').trim();
      targetEl.innerHTML = `<span class="ani-nav-icon" aria-hidden="true">${getNavIconSvg(href, rawText)}</span><span class="ani-nav-short">${shortLabel}</span><span class="ani-nav-label">${originalHtml}</span>`;
      iconized.push({ item, link: targetEl, originalHtml, hadAriaLabel });
    }
    navLayout = { root, more: null, hiddenDuplicates, iconized };
  }
  document.addEventListener('pointerdown', (event) => {
    if (navLayout?.more && !navLayout.more.contains(event.target)) {
      navLayout.menu.hidden = true;
      navLayout.button.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navLayout?.more && !navLayout.menu.hidden) {
      navLayout.menu.hidden = true;
      navLayout.button.setAttribute('aria-expanded', 'false');
      navLayout.button.focus();
    }
  });

  const SCORE_CACHE_KEY = 'ani-ambilight-scores-v1';
  const SCORE_CACHE_TTL = 6 * 60 * 60 * 1000;
  const SCORE_STAR_SVG =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>';
  let scoreCacheStore = null;
  const scorePendingFetches = new Set();
  const scoreFetchQueue = [];
  let activeScoreFetches = 0;

  function readScoreCache() {
    if (scoreCacheStore) return scoreCacheStore;
    scoreCacheStore = {};
    try {
      const raw = localStorage.getItem(SCORE_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const now = Date.now();
          for (const [k, v] of Object.entries(parsed)) {
            if (v && typeof v.s === 'string' && now - (v.t || 0) < SCORE_CACHE_TTL) {
              scoreCacheStore[k] = v;
            }
          }
        }
      }
    } catch {}
    return scoreCacheStore;
  }

  function writeScoreCache(sn, scoreText) {
    const cache = readScoreCache();
    cache[sn] = { s: scoreText, t: Date.now() };
    try {
      const entries = Object.entries(cache).slice(-300);
      scoreCacheStore = Object.fromEntries(entries);
      localStorage.setItem(SCORE_CACHE_KEY, JSON.stringify(scoreCacheStore));
    } catch {}
  }

  function renderTopLeftScoreBadge(picBlock, scoreText) {
    if (!picBlock) return;
    let badge = picBlock.querySelector(':scope > .ani-score-badge-top-left');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'ani-score-badge-top-left';
      badge.innerHTML = `<span class="ani-score-star" aria-hidden="true" style="display:inline-flex;align-items:center;">${SCORE_STAR_SVG}</span><span class="ani-score-value"></span>`;
      badge.lastElementChild.append(document.createTextNode(''));
      badge.hidden = !scoreText;
      picBlock.append(badge);
    }
    if (!scoreText) return;
    const value = badge.querySelector('.ani-score-value');
    if (value && value.textContent !== scoreText) {
      if (value.firstChild) value.firstChild.nodeValue = scoreText;
      else value.textContent = scoreText;
    }
    if (badge.hidden) badge.hidden = false;
  }

  function createFavoriteButton(fav) {
        const button=document.createElement('button');button.type='button';button.className='ani-history-favorite round-btn';button.classList.toggle('ani-saved',fav.saved);
        button.setAttribute('onclick',`event.preventDefault();event.stopPropagation();if(window.animefun&&animefun.toggleGather){animefun.toggleGather(${fav.acgSn},${fav.animeSn},$(this),"ani-saved");}else{this.classList.toggle("ani-saved");}return false;`);
        button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
        const sync=()=>{fav.saved=button.classList.contains('ani-saved');button.setAttribute('aria-pressed',String(fav.saved));button.setAttribute('aria-label',fav.saved?'取消收藏動畫':'收藏動畫');};new MutationObserver(sync).observe(button,{attributes:true,attributeFilter:['class']});sync();
    return button;
  }

  function readCommentRecommendations(source) {
    const cards = new Map();
    for (const card of source.querySelectorAll('a.theme-list-main[href*="animeRef.php"]')) {
      const href = card.getAttribute('href');
      if (!URL.canParse(href, location.origin)) continue;
      const url = new URL(href, location.origin);
      const title = card.querySelector('.theme-name')?.textContent.trim();
      const image = card.querySelector('img.theme-img');
      if (url.origin !== location.origin || !title || !image) continue;
      const previous = cards.get(url.href);
      const yearMonth = card.querySelector('.theme-time')?.textContent.match(/年份[：:]\s*(\d{4})\/(\d{1,2})/);
      const month = Number(yearMonth?.[2]);
      const season = month >= 1 && month <= 12
        ? yearMonth[1] + ' ' + ['冬', '春', '夏', '秋'][Math.floor((month - 1) / 3)] + '番'
        : previous?.season;
      cards.set(url.href, {
        title, season, serial:previous?.serial || Boolean(card.querySelector('.color-now-playing')),
        views:card.querySelector('.show-view-number p')?.textContent.trim(),
        episodes:card.querySelector('.theme-number')?.textContent.trim(),
        src:image.dataset.src || image.getAttribute('src')
      });
    }
    return [...cards.entries()];
  }

  const recommendationMetadataKey = 'ani-recommendation-metadata-v2';
  const recommendationPoolKey = 'ani-comment-recommendation-pool-v1';
  const recommendationSeason = (date) => {
    const match = String(date || '').match(/(\d{4})[/-](\d{1,2})/);
    const month = Number(match?.[2]);
    return month >= 1 && month <= 12 ? `${match[1]} ${['冬', '春', '夏', '秋'][Math.floor((month - 1) / 3)]}番` : '';
  };

  function readRecommendationIndex(data) {
    const cards = new Map();
    const airing = [data?.newAnime?.date, data?.newAnime?.popular].filter(Array.isArray).flat();
    for (const [entries, scheduled] of [[airing, true], [data?.hotAnime, false], [data?.newAdded, false]]) {
      if (!Array.isArray(entries)) continue;
      for (const work of entries) {
        if (!/^\d+$/.test(String(work?.animeSn)) || !work.title) continue;
        const url = new URL(`/animeRef.php?sn=${work.animeSn}`, location.origin).href;
        const previous = cards.get(url);
        const wideCover = previous?.wideCover || (scheduled ? work.cover : '');
        const views = Number(work.popular);
        const count = work.totalEpisode || String(work.info || '').match(/共\s*(\d+)\s*集/)?.[1];
        cards.set(url, {
          title: work.title,
          videoSn: Number(work.videoSn) > 0 ? String(work.videoSn) : previous?.videoSn,
          wideCover,
          src: wideCover || work.acgCover || work.cover || previous?.src,
          season: recommendationSeason(work.info) || previous?.season,
          serial: scheduled || Number(work.flag) === 1 || previous?.serial,
          views: scheduled && previous?.views ? previous.views : views >= 10000
            ? `${(views / 10000).toFixed(1)}萬` : views > 0 ? String(views) : previous?.views,
          episodes: count ? `共 ${count} 集` : previous?.episodes,
        });
      }
    }
    return [...cards.entries()];
  }

  async function fetchRecommendationMetadata(href, videoSn) {
    const fromEpisode = async (sn) => {
      if (!/^\d+$/.test(sn || '') || Number(sn) === 0) return {};
      try {
        const response = await aniFetch(`https://api.gamer.com.tw/anime/v1/video.php?videoSn=${sn}`, { timeoutMs: 6000 });
        const anime = response.ok ? (await response.json())?.data?.anime : null;
        if (!anime) return {};
        return {
          score: Number(anime.score) > 0 ? String(anime.score) : '',
          season: recommendationSeason(anime.seasonStart),
          genres: Array.isArray(anime.tags) ? anime.tags.join(' · ') : '',
        };
      } catch { return {}; }
    };
    let meta = await fromEpisode(videoSn);
    if (meta.score && meta.season && meta.genres) return meta;
    const response = await aniFetch(href, { timeoutMs: 6000 });
    if (!response.ok) return Object.values(meta).some(Boolean) ? meta : null;
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = [...doc.querySelectorAll('li.type')];
    const premiere = rows.find(row => row.querySelector('.title')?.textContent.trim() === '首播日期');
    const genres = [...doc.querySelectorAll('li.type .tag-list .tag')].map(node => node.textContent.trim()).filter(Boolean);
    const episodeUrl = doc.querySelector('meta[property="og:url"]')?.content || '';
    const resolvedSn = episodeUrl.match(/\/animeVideo\.php\?sn=(\d+)(?:[&#]|$)/)?.[1];
    if (resolvedSn && resolvedSn !== videoSn) {
      const resolved = await fromEpisode(resolvedSn);
      meta = { score: meta.score || resolved.score, season: meta.season || resolved.season, genres: meta.genres || resolved.genres };
    }
    const combined = {
      score: meta.score || parseScoreFromVideoHtml(html),
      season: meta.season || recommendationSeason(premiere?.querySelector('.content')?.textContent),
      genres: meta.genres || genres.join(' · '),
    };
    return Object.values(combined).some(Boolean) ? combined : null;
  }

  async function renderCommentRecommendations(aside) {
    try {
      let pool = [];
      try {
        const response = await aniFetch('https://api.gamer.com.tw/anime/v1/index.php', { credentials: 'include', timeoutMs: 8000 });
        if (response.ok) pool = readRecommendationIndex((await response.json())?.data);
      } catch {
        // The playback page already includes related works when available.
      }
      if (pool.length) {
        try { localStorage.setItem(recommendationPoolKey, JSON.stringify({ savedAt: Date.now(), entries: pool })); } catch {}
      } else {
        const relatedLists = document.querySelectorAll('#BH_background .old_list:not(:has(.search_result))');
        pool = [...new Map([...relatedLists].flatMap(readCommentRecommendations))];
        if (!pool.length) {
          try {
            const cached = JSON.parse(localStorage.getItem(recommendationPoolKey) || 'null');
            if (Array.isArray(cached?.entries) && Date.now() - cached.savedAt < 86400000) {
              pool = cached.entries.filter(entry => Array.isArray(entry) && entry[1]?.title &&
                typeof entry[0] === 'string' && entry[0].startsWith(`${location.origin}/animeRef.php?sn=`));
            }
          } catch {}
        }
      }
      if (!aside.isConnected) return;
      const heading = document.createElement('h3');
      heading.className = 'ani-recommend-heading';
      heading.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linejoin="round" d="m9 3 1.9 5.6L16.5 11l-5.6 2.4L9 19l-2-5.6L1.5 11 7 8.6Z M19 2l1 3 3 1-3 1-1 3-1-3-3-1 3-1Z"/></svg>推薦動畫';
      aside.replaceChildren(heading);
      if (!pool.length) {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'ani-pill-btn';
        retry.textContent = '重新載入推薦動畫';
        retry.addEventListener('click', async () => {
          retry.disabled = true;
          await renderCommentRecommendations(aside);
          retry.disabled = false;
        });
        aside.append(retry);
        aside.hidden = false;
        return;
      }
      const count = document.querySelector('#w-anime-comment-count');
      const syncCount = () => {
        const total = Number(count?.textContent.replace(/[^0-9]/g, '') || 0);
        const limit = Math.min(48, 12 + Math.ceil(total / 3));
        [...aside.querySelectorAll('a')].forEach((link, index) => { link.hidden = index >= limit; });
      };
      const metaCache = new Map();
      try {
        for (const [href, item] of Object.entries(JSON.parse(localStorage.getItem(recommendationMetadataKey) || '{}'))) {
          if (item && Date.now() - item.updatedAt < SCORE_CACHE_TTL) metaCache.set(href, item);
        }
      } catch {}
      const renderMetadata = (link, meta) => {
        if (meta.score) link.querySelector('.ani-history-score').textContent = '★ ' + meta.score;
        if (meta.season) {
          const release = link.querySelector('.ani-rec-release');
          release.querySelector('span').textContent = meta.season;
          release.hidden = false;
        }
        link.querySelector('.ani-rec-genres').textContent = meta.genres || '';
      };
      const metadata = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const link = entry.target;
          metadata.unobserve(link);
          fetchRecommendationMetadata(link.href, link.dataset.videoSn).then(meta => {
            if (!meta) return;
            metaCache.set(link.href, { ...meta, updatedAt: Date.now() });
            if (metaCache.size > 160) metaCache.delete(metaCache.keys().next().value);
            try { localStorage.setItem(recommendationMetadataKey, JSON.stringify(Object.fromEntries(metaCache))); } catch {}
            if (link.isConnected) renderMetadata(link, meta);
          }).catch(() => {});
        }
      }, { rootMargin: '1100px 0px' }) : null;
      while (pool.length && aside.childElementCount <= 48) {
        const [[href, item]] = pool.splice(Math.floor(Math.random() * pool.length), 1);
        const link = document.createElement('a');
        link.href = href;
        const image = document.createElement('img');
        image.loading = 'lazy';
        image.alt = '';
        if (item.src) {
          try { image.src = new URL(item.src, location.origin).href; } catch {}
        }
        const copy = document.createElement('span');
        const facts = document.createElement('span');
        facts.className = 'ani-rec-facts';
        facts.innerHTML = '<span class="ani-rec-view" title="觀看數"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 5c5 0 9 4 11 7-2 3-6 7-11 7S3 15 1 12c2-3 6-7 11-7Zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"/></svg><span></span></span><span class="ani-rec-release" title="播出季番" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/></svg><span></span></span>';
        facts.querySelector('.ani-rec-view span').textContent = item.views || '統計中';
        const release = facts.querySelector('.ani-rec-release');
        if (item.season) {
          release.querySelector('span').textContent = item.season;
          release.hidden = false;
        }
        if (item.serial) {
          const status = document.createElement('span');
          status.textContent = '連載中';
          facts.append(status);
        }
        const title = document.createElement('strong');
        title.textContent = item.title;
        const genres = document.createElement('small');
        genres.className = 'ani-rec-genres';
        copy.append(title, facts, genres);
        const poster = document.createElement('span');
        poster.className = 'ani-rec-poster';
        const score = document.createElement('b');
        score.className = 'ani-history-score ani-score-badge-top-left';
        const episodes = document.createElement('span');
        episodes.className = 'ani-rec-episodes';
        episodes.textContent = /^共\s*1\s*集$/.test(item.episodes) ? '電影' : item.episodes || '';
        poster.append(image, score, episodes);
        link.append(poster, copy);
        const cached = metaCache.get(href);
        if (cached) renderMetadata(link, cached);
        else {
          if (item.videoSn) {
            link.dataset.videoSn = item.videoSn;
            const cachedScore = readScoreCache()[item.videoSn]?.s;
            if (cachedScore) score.textContent = '★ ' + cachedScore;
          }
          metadata?.observe(link);
        }
        aside.append(link);
      }
      syncCount();
      if (count) new MutationObserver(syncCount).observe(count, {childList:true, characterData:true, subtree:true});
      const desktop = matchMedia('(min-width:900px)');
      const placeHeading = () => {
        if (!aside.isConnected) return;
        for (const stale of document.querySelectorAll('.commend-title .ani-recommend-heading')) {
          if (stale !== heading) stale.remove();
        }
        heading.classList.toggle('ani-recommend-heading-desktop', desktop.matches);
        const segment = desktop.matches && document.querySelector('.commend-title .commend-segment-wrapper');
        if (segment) segment.after(heading);
        else aside.prepend(heading);
      };
      placeHeading();
      desktop.addEventListener('change',placeHeading);
      aside.hidden = false;
    } catch { aside.parentElement?.classList.add('ani-recs-unavailable'); }
  }

  function parseScoreFromVideoHtml(html) {
    let weighted = 0;
    let totalWeight = 0;
    for (const m of html.matchAll(
      /data-acgstar=['"]?([1-5])['"]?[\s\S]{0,400}?scored-line[^>]*width:\s*([\d.]+)%/gi,
    )) {
      const star = Number(m[1]);
      const pct = Number(m[2]);
      if (star >= 1 && star <= 5 && pct > 0) {
        weighted += star * pct;
        totalWeight += pct;
      }
    }
    if (totalWeight > 0) return (weighted / totalWeight).toFixed(2);
    const overall = html.match(
      /class=['"]score-overall-number['"][^>]*>\s*([0-5](?:\.\d{1,2})?)/i,
    );
    return overall ? overall[1] : '';
  }

  function pumpScoreFetchQueue() {
    while (activeScoreFetches < 1 && scoreFetchQueue.length > 0) {
      const sn = scoreFetchQueue.shift();
      activeScoreFetches += 1;
      aniFetch(`animeVideo.php?sn=${encodeURIComponent(sn)}`, {
        credentials: 'same-origin',
      })
        .then((res) => (res.ok ? res.text() : ''))
        .then((html) => {
          const score = html ? parseScoreFromVideoHtml(html) : '';
          if (!score) return;
          writeScoreCache(sn, score);
          isBindingPlayer = true;
          try {
            for (const link of document.querySelectorAll(
              `#blockVideoInSeason .anime-card-block[href*="sn=${sn}"]`,
            )) {
              const pic = link.querySelector('.anime-pic-block');
              if (pic) renderTopLeftScoreBadge(pic, score);
            }
          } finally {
            isBindingPlayer = false;
            observer?.takeRecords();
          }
        })
        .catch(() => {})
        .finally(() => {
          scorePendingFetches.delete(sn);
          activeScoreFetches -= 1;
          pumpScoreFetchQueue();
        });
    }
  }

  function queueScoreFetch(sn) {
    if (
      !sn ||
      scorePendingFetches.has(sn) ||
      typeof fetch !== 'function' ||
      typeof location === 'undefined' ||
      !/gamer\.com\.tw$/i.test(location.hostname || '')
    ) {
      return;
    }
    scorePendingFetches.add(sn);
    scoreFetchQueue.push(sn);
    pumpScoreFetchQueue();
  }

  const MEMBER_ICON_SVGS = {
    top_btn_notice:
      '<svg class="ani-member-icon" viewBox="0 0 33 36" fill="currentColor" aria-hidden="true"><path d="M 16.5 36 C 17.64 36 18.74 35.66 19.67 35.01 C 20.59 34.37 21.29 33.45 21.67 32.4 L 11.33 32.4 C 11.71 33.45 12.41 34.37 13.33 35.01 C 14.26 35.66 15.36 36 16.5 36 Z M 29.33 22.65 L 29.33 14.4 C 29.33 8.61 25.33 3.73 19.9 2.26 C 19.36 0.94 18.05 0 16.5 0 C 14.95 0 13.64 0.94 13.1 2.26 C 7.67 3.73 3.67 8.61 3.67 14.4 L 3.67 22.65 L 0.54 25.73 C 0.19 26.06 0 26.52 0 27 L 0 28.8 C 0 29.28 0.19 29.74 0.54 30.07 C 0.88 30.41 1.35 30.6 1.83 30.6 L 31.17 30.6 C 31.65 30.6 32.12 30.41 32.46 30.07 C 32.81 29.74 33 29.28 33 28.8 L 33 27 C 33 26.52 32.81 26.06 32.46 25.73 L 29.33 22.65 Z"/></svg>',
    top_btn_subscription:
      '<svg class="ani-member-icon" viewBox="0 0 37 36" fill="currentColor" aria-hidden="true"><path d="M 3.32 36 C 2.37 36 1.58 35.68 0.95 35.05 C 0.32 34.42 0 33.63 0 32.68 L 0 14.68 C 0 13.74 0.32 12.95 0.95 12.32 C 1.59 11.69 2.38 11.37 3.32 11.37 L 33.68 11.37 C 34.63 11.37 35.42 11.68 36.05 12.32 C 36.68 12.95 37 13.74 37 14.68 L 37 32.68 C 37 33.63 36.68 34.42 36.05 35.05 C 35.41 35.69 34.62 36 33.68 36 L 3.32 36 Z M 16.69 29.12 L 23.86 24.36 C 24.11 24.18 24.24 23.95 24.24 23.68 C 24.24 23.41 24.11 23.19 23.86 23.01 L 16.69 18.25 C 16.4 18.06 16.12 18.04 15.84 18.19 C 15.56 18.34 15.42 18.58 15.42 18.91 L 15.42 28.46 C 15.42 28.79 15.56 29.03 15.84 29.18 C 16.12 29.33 16.4 29.31 16.69 29.12 Z M 4.11 7.74 C 3.82 7.74 3.57 7.64 3.38 7.44 C 3.18 7.25 3.08 7 3.08 6.71 C 3.08 6.41 3.18 6.17 3.38 5.98 C 3.57 5.78 3.82 5.68 4.11 5.68 L 32.89 5.68 C 33.18 5.68 33.43 5.78 33.62 5.98 C 33.82 6.17 33.92 6.42 33.92 6.71 C 33.92 7 33.82 7.25 33.62 7.44 C 33.43 7.64 33.18 7.74 32.89 7.73 L 4.11 7.74 Z M 10.28 2.05 C 9.99 2.05 9.74 1.95 9.54 1.76 C 9.35 1.56 9.25 1.32 9.25 1.03 C 9.25 0.73 9.35 0.49 9.54 0.29 C 9.74 0.1 9.98 0 10.28 0 L 26.72 0 C 27.02 0 27.26 0.1 27.46 0.29 C 27.65 0.49 27.75 0.73 27.75 1.03 C 27.75 1.32 27.65 1.56 27.46 1.76 C 27.26 1.95 27.02 2.05 26.72 2.05 L 10.28 2.05 Z"/></svg>',
    top_btn_recommend:
      '<svg class="ani-member-icon" viewBox="0 0 36 36" fill="currentColor" aria-hidden="true"><path d="M 36 15.18 L 36 21.52 C 36 23.13 35.53 24.7 34.64 26.05 C 33.76 27.39 32.51 28.45 31.03 29.1 L 31.03 18.91 C 31.03 16.01 28.34 13.63 25.77 13.66 L 18.62 13.66 L 18.62 9.39 C 18.5 6.9 17.23 5.16 16.01 4.96 L 16.29 2.91 C 16.45 1.9 16.73 0 18.62 0 L 19.86 0 C 22.05 0 23.58 1.82 23.58 4.43 L 23.59 9.93 L 30.74 9.93 C 32.14 9.93 33.47 10.48 34.46 11.47 C 35.44 12.45 36 13.79 36 15.18 Z M 23.29 16.14 L 16.14 16.14 L 16.13 10.64 C 16.13 8.03 14.6 6.21 12.41 6.21 L 11.17 6.21 C 9.27 6.21 8.99 8.1 8.84 9.12 L 8 15.09 L 6.21 18.46 L 6.2 36 L 20.27 36 C 22.47 36 24.57 35.13 26.12 33.57 C 27.67 32.02 28.55 29.92 28.55 27.72 L 28.55 21.39 C 28.55 20.7 28.41 20.02 28.15 19.38 C 27.88 18.74 27.5 18.16 27.01 17.67 C 26.52 17.19 25.94 16.8 25.3 16.54 C 24.66 16.27 23.98 16.14 23.29 16.14 Z M 3.72 36 L 3.72 19.86 L 0 19.86 L 0 36 L 3.72 36 Z"/></svg>',
  };
  let memberHoverCloseTimer = 0;

  function closeTopBarMenus() {
    document.dispatchEvent(new CustomEvent('ani-topbar-close'));
    for (const activeLi of document.querySelectorAll('.sky .member > li.is-active')) {
      activeLi.classList.remove('is-active');
    }
    for (const box of document.querySelectorAll('[id^="topBarMsg_"]')) {
      box.style.display = 'none';
    }
  }

  let continueTimesRequested = false;
  const continueTimes = new Map();
  const continueDetailsRequested = new Set();
  let continueSectionAnchor;
  const refreshContinueTitle = (target) => {
    const track = target.querySelector('.ani-marquee-track');
    if (!track || !target.clientWidth || target.closest('.continue-watch-card:hover')) return;
    const overflow = Math.max(0, track.scrollWidth - target.clientWidth);
    target.classList.toggle('ani-continue-overflow', overflow > 2);
    target.style.setProperty('--ani-marquee-dist', `-${overflow + 8}px`);
    target.style.setProperty('--ani-marquee-dur', `${Math.max(6, overflow / 18)}s`);
  };
  const continueVisibilityObserver = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
        for (const entry of entries) if (entry.isIntersecting) refreshContinueTitle(entry.target);
      })
    : null;
  const formatContinueTime = (seconds) => {
    const value = Math.floor(seconds);
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  };
  const continueTitleObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver((entries) => {
        for (const { target } of entries) {
          refreshContinueTitle(target);
        }
      })
    : null;

  function enhanceContinueWatch() {
    const section = document.querySelector('#blockContinueWatch');
    if (!section) return;
    const list = section.querySelector('#continueWatch');
    if (list) requestAnimationFrame(() => {
      const grid = document.querySelector('#blockVideoInSeason .newanime-block');
      if (!grid || !grid.clientWidth) return;
      const width = `${grid.clientWidth}px`;
      const offset = `${grid.getBoundingClientRect().left - section.getBoundingClientRect().left}px`;
      if (list.style.width !== width || list.style.marginLeft !== offset) {
        list.style.setProperty('width', width, 'important');
        list.style.setProperty('margin-left', offset, 'important');
        window.dispatchEvent(new Event('resize'));
      }
    });
    if (list && !section.querySelector('.ani-continue-body')) {
      const body = document.createElement('div');
      body.className = 'ani-continue-body';
      const inner = document.createElement('div');
      inner.className = 'ani-continue-body-inner';
      list.before(body);
      body.append(inner);
      inner.append(list);
    }
    const season = document.querySelector('#blockVideoInSeason');
    if (settings.themeEnabled && season && section.parentElement === season.parentElement) {
      if (!continueSectionAnchor) {
        continueSectionAnchor = document.createComment('continue-watch-original-position');
        section.before(continueSectionAnchor);
      }
      if (section.nextElementSibling !== season) season.before(section);
    } else if (!settings.themeEnabled && continueSectionAnchor?.isConnected) {
      continueSectionAnchor.after(section);
    }
    const heading = section.querySelector('.theme-title');
    if (heading && !section.querySelector('.ani-continue-toggle')) {
      const header = heading.parentElement;
      header.classList.add('ani-continue-header');
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'ani-continue-toggle';
      toggle.setAttribute('aria-controls', 'continueWatch');
      toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
      const sync = () => {
        const collapsed = section.dataset.aniCollapsed === 'true';
        toggle.setAttribute('aria-expanded', String(!collapsed));
        toggle.setAttribute('aria-label', `${collapsed ? '展開' : '收合'}繼續觀看`);
        toggle.title = toggle.getAttribute('aria-label');
        const inner = section.querySelector('.ani-continue-body-inner');
        if (inner) inner.inert = collapsed;
      };
      let foldAnimation;
      toggle.addEventListener('click', () => {
        const body = section.querySelector('.ani-continue-body');
        const startHeight = body?.getBoundingClientRect().height || 0;
        foldAnimation?.cancel();
        section.dataset.aniCollapsed = String(section.dataset.aniCollapsed !== 'true');
        sync();
        if (body && typeof body.animate === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const collapsed = section.dataset.aniCollapsed === 'true';
          const endHeight = collapsed ? 0 : body.querySelector('.ani-continue-body-inner').scrollHeight;
          foldAnimation = body.animate([
            { height: `${startHeight}px`, opacity: collapsed ? 1 : 0 },
            { height: `${endHeight}px`, opacity: collapsed ? 0 : 1 },
          ], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
        }
        if (section.dataset.aniCollapsed !== 'true') {
          window.dispatchEvent(new Event('resize'));
          requestAnimationFrame(() => {
            for (const title of section.querySelectorAll('.anime-name')) refreshContinueTitle(title);
          });
        }
      });
      sync();
      header.append(toggle);
    }
    if (!section.dataset.aniSlideRefresh) {
      section.dataset.aniSlideRefresh = 'true';
      let refreshTimer;
      const refresh = () => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          enhanceContinueWatch();
          for (const title of section.querySelectorAll('.anime-name')) refreshContinueTitle(title);
        }, 340);
      };
      for (const event of ['transitionend', 'pointerup', 'touchend', 'click', 'focusout', 'mouseleave'])
        section.addEventListener(event, refresh, { passive: true });
    }
    if (!continueTimesRequested) {
      continueTimesRequested = true;
      try {
        const local = JSON.parse(localStorage.getItem('ANIME_BP') || 'null');
        if (local && Number.isFinite(local.breakPoint) && local.breakPoint >= 0)
          continueTimes.set(String(local.videoSn), { position: local.breakPoint });
      } catch {}
      // Fetch index API immediately (not queued behind 10+ animeVideo.php HTML fetches)
      fetch('https://api.gamer.com.tw/anime/v1/index.php', {
        credentials: 'include', signal: AbortSignal.timeout(8000),
      }).then((response) => response.ok ? response.json() : null).then((result) => {
        const entries = result?.data?.continueWatch;
        if (Array.isArray(entries)) {
          for (const item of entries) {
            const itemSn = String(item.videoSn ?? item.sn ?? '');
            if (itemSn && Number.isFinite(item.breakPoint) && item.breakPoint >= 0)
              continueTimes.set(itemSn, { ...continueTimes.get(itemSn), position: item.breakPoint, ...(Number(item.duration) > 0 ? { duration: Number(item.duration) * 60 } : {}) });
          }
        }
      }).catch(() => {}).finally(enhanceContinueWatch);
    }
    for (const card of section.querySelectorAll('.continue-watch-card')) {
      card.querySelector('.ani-continue-favorite')?.remove();
      const next = card.querySelector('.btn-next');
      if (next && !next.dataset.aniNextMotion) {
        next.dataset.aniNextMotion = 'true';
        next.querySelector('.material-icons-round')?.remove();
        const icon = document.createElement('span');
        icon.className = 'ani-next-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m5 6 6 6-6 6m8-12 6 6-6 6"/></svg>';
        next.append(icon);
        next.title = '預覽下一集，點擊播放';
        const animateEpisode = () => {
          if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
          const episode = card.querySelector('.episode-block');
          episode?.animate?.([{ opacity: .35, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 260, easing: 'ease-out' });
        };
        next.addEventListener('mouseenter', animateEpisode);
        next.addEventListener('mouseleave', animateEpisode);
      }
      const name = card.querySelector('.anime-name');
      if (name && !name.querySelector('.ani-marquee-track')) {
        const track = document.createElement('span');
        track.className = 'ani-marquee-track';
        track.textContent = name.textContent.trim();
        name.title = track.textContent;
        name.replaceChildren(track);
        continueTitleObserver?.observe(name);
        continueVisibilityObserver?.observe(name);
        requestAnimationFrame(() => refreshContinueTitle(name));
      }
      const row = card.querySelector('.info-row');
      const sn = card.closest('[data-video-sn]')?.dataset.videoSn;
      for (const episode of card.querySelectorAll('.episode-watched')) {
        for (const key of ['episode', 'nextEpisode']) {
          if (episode.dataset[key]) episode.dataset[key] = episode.dataset[key].replace(/第\s*(\d+)\s*集/g, 'EP.$1');
        }
        const label = episode.textContent.replace(/第\s*(\d+)\s*集/g, 'EP.$1').trim();
        if (episode.textContent !== label) episode.textContent = label;
      }
      const picture = card.querySelector('.img-block');
      const cachedScore = readScoreCache()[sn]?.s;
      if (picture && cachedScore) renderTopLeftScoreBadge(picture, cachedScore);
      if (sn && !continueDetailsRequested.has(sn)) {
        continueDetailsRequested.add(sn);
        aniFetch(`animeVideo.php?sn=${encodeURIComponent(sn)}`, { credentials: 'same-origin' })
          .then((response) => response.ok ? response.text() : '')
          .then((html) => {
            if (!html) return;
            const page = new DOMParser().parseFromString(html, 'text/html');
            const score = parseScoreFromVideoHtml(html);
            if (score) writeScoreCache(sn, score);
            let duration;
            for (const script of page.querySelectorAll('script[type="application/ld+json"]')) {
              try {
                const data = JSON.parse(script.textContent);
                for (const entry of Array.isArray(data) ? data : [data]) {
                  const match = entry.duration?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
                  if (match) duration = Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
                }
              } catch {}
            }
            if (duration) continueTimes.set(sn, { ...continueTimes.get(sn), duration });
            for (const target of section.querySelectorAll('[data-video-sn]')) {
              if (target.dataset.videoSn !== sn) continue;
              const image = target.querySelector('.img-block');
              if (score && image) renderTopLeftScoreBadge(image, score);

            }
            enhanceContinueWatch();
          }).catch(() => {});
      }
      const timing = continueTimes.get(sn);
      const seconds = timing?.position;
      if (row && Number.isFinite(seconds)) {
        const position = row.querySelector('.ani-continue-position') || document.createElement('span');
        position.className = 'ani-continue-position';
        const label = `${formatContinueTime(seconds)} / ${Number.isFinite(timing.duration) ? formatContinueTime(timing.duration) : '—'}`;
        if (position.textContent !== label) position.textContent = label;
        position.title = '播放時間／完整片長';
        if (!position.isConnected) row.append(position);
      }
    }
  }

  function prepareWeekCover(tile, url) {
    if (tile.dataset.aniCoverUrl === url) return;
    tile.dataset.aniCoverUrl = url;
    const cover = tile.querySelector('.ani-week-cover') || document.createElement('img');
    cover.className = 'ani-week-cover';
    cover.setAttribute('aria-hidden', 'true');
    cover.alt = '';
    cover.onerror = () => { if (tile.dataset.aniCoverUrl === url) delete tile.dataset.aniCoverUrl; };
    cover.src = url;
    if (!cover.parentNode) tile.prepend(cover);
  }

  function fitPremiumCard() {
    const dates=[...document.querySelectorAll('#blockVideoInSeason .newanime-block > .newanime-date-area')];
    const dateKey = date => date?.querySelector('.anime-date-info')?.textContent.match(/\d{1,2}\/\d{1,2}/)?.[0];
    const latestDate = dateKey(dates[0]);
    const geometry = dates.map(date => {
      const rail = date.querySelector('.date-block-border');
      return {top: date.offsetTop, left: date.offsetLeft, width: date.offsetWidth,
        center: rail ? rail.offsetTop + rail.offsetHeight / 2 : null};
    });
    dates.forEach((date, index) => {
      const current = geometry[index];
      const previous = geometry[index - 1];
      const next = geometry[index + 1];
      const sameRow = other => other && Math.abs(other.top - current.top) <= 5;
      date.classList.toggle('ani-date-row-start', !sameRow(previous));
      date.classList.toggle('ani-date-row-end', !sameRow(next));
      const key = dateKey(date);
      date.classList.toggle('ani-date-current', Boolean(key && key === latestDate));
      const gap = sameRow(next) ? Math.max(0, next.left - current.left - current.width) : 0;
      date.style.setProperty('--ani-date-gap', `${gap}px`);
      const center = current.center;
      if (center !== null) {
        for (const marker of date.querySelectorAll('.date-block :is(.double-circle,.pic-continue,.pic-selected-continue)')) {
          marker.style.setProperty('top', `${center}px`, 'important');
        }
      }
      for (const label of date.querySelectorAll(':scope > .anime-date-info')) {
        label.style.setProperty('left', '0', 'important');
        label.style.setProperty('margin-left', '0', 'important');
      }
    });
    for(const wrap of document.querySelectorAll('#blockVideoInSeason .newanime-wrap'))if(!wrap.dataset.aniCursorDate){
      wrap.dataset.aniCursorDate='true';const cursor=document.createElement('span');cursor.className='ani-date-cursor';cursor.setAttribute('aria-hidden','true');wrap.append(cursor);let frame=0,target=null,x=0;
      wrap.addEventListener('pointermove',event=>{target=event.target.closest?.('.newanime-date-area');if(!target){wrap.classList.remove('ani-date-following');return;}x=event.clientX;if(frame)return;frame=requestAnimationFrame(()=>{frame=0;if(!target)return;const label=target.querySelector('.anime-date-info');if(!label)return;const text=label.textContent.match(/\d{1,2}\/\d{1,2}\s*[（(][一二三四五六日天][）)]/)?.[0]||label.textContent.match(/\d{1,2}\/\d{1,2}/)?.[0]||'';if(cursor.textContent!==text)cursor.textContent=text;const latest=dates[0]?.querySelector('.anime-date-info')?.textContent.match(/\d{1,2}\/\d{1,2}/)?.[0];cursor.classList.toggle('ani-date-previous',text.match(/\d{1,2}\/\d{1,2}/)?.[0]!==latest);const rect=wrap.getBoundingClientRect(),area=target.getBoundingClientRect();wrap.classList.add('ani-date-following');const left=Math.max(0,Math.min(rect.width-cursor.offsetWidth,x-rect.left-cursor.offsetWidth/2));cursor.style.left=`${left}px`;const rail=target.querySelector('.date-block-border')?.getBoundingClientRect();cursor.style.top=`${(rail?rail.top+rail.height/2:area.top)-rect.top-cursor.offsetHeight/2}px`;});});
      wrap.addEventListener('pointerleave',()=>{target=null;wrap.classList.remove('ani-date-following');if(frame){cancelAnimationFrame(frame);frame=0;}});
    }
    for (const premium of document.querySelectorAll('#blockVideoInSeason .newanime-block > .premium-block')) {
      updatePremiumMeter(premium);
    }
  }

  function updatePremiumMeter(premium) {
    const grid = premium.parentElement;
    const info = premium.querySelector('.premium-info');
    const ratio = Number.parseFloat(info?.querySelector('.number')?.textContent || '');
    if (info && Number.isFinite(ratio)) {
      const value = `${Math.max(0, Math.min(100, ratio))}%`;
      if (info.style.getPropertyValue('--ani-paid-ratio') !== value) info.style.setProperty('--ani-paid-ratio', value);
    }
    if (info && !info.querySelector('.ani-premium-brand')) {
      const brand = document.createElement('div');
      brand.className = 'ani-premium-brand';
      brand.setAttribute('aria-hidden', 'true');
      const logo = document.createElement('img');
      logo.src = 'https://i2.bahamut.com.tw/anime/baha_s.png';
      logo.alt = '';
      brand.append(logo);
      info.append(brand);
    }
    const brandImage = info?.querySelector('.ani-premium-brand img');
    if (brandImage && brandImage.src !== 'https://i2.bahamut.com.tw/anime/baha_s.png') brandImage.src = 'https://i2.bahamut.com.tw/anime/baha_s.png';
    if (info && Number.isFinite(ratio)) {
      let meter = info.querySelector('.ani-premium-meter');
      if (!meter) {
        meter = document.createElement('div'); meter.className = 'ani-premium-meter';
        meter.innerHTML = '<div class="ani-premium-meter-labels"><span></span><span></span></div><div class="ani-premium-meter-track" role="progressbar" aria-label="付費比例" aria-valuemin="0" aria-valuemax="100"><span></span></div>';
        info.append(meter);
      }
      const paid = Math.max(0, Math.min(100, ratio));
      const labels = meter.querySelectorAll('.ani-premium-meter-labels span');
      const texts = ['', '100%'];
      labels.forEach((n,i) => { if(i===1){if(!n.querySelector('small'))n.innerHTML='<strong>100</strong><small>%</small>';}else if(n.textContent !== texts[i]) n.textContent = texts[i]; });
      meter.style.setProperty('--ani-free-label-start',`${paid}%`);
      const track = meter.querySelector('[role="progressbar"]');
      if (track.getAttribute('aria-valuenow') !== String(paid)) track.setAttribute('aria-valuenow', String(paid));
      if(!meter.dataset.aniReveal&&typeof IntersectionObserver==='function'&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
        meter.dataset.aniReveal='waiting';
        const fill=track.querySelector('span');
        fill.style.transform='scaleX(0)';
        fill.style.transformOrigin='left';
        const startAnim=()=>{
          if(meter.dataset.aniReveal==='done')return;
          meter.dataset.aniReveal='done';
          fill.style.transform='scaleX(1)';
          fill.animate?.([{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:900,easing:'cubic-bezier(.16,1,.3,1)'});
        };
        const reveal=new IntersectionObserver(entries=>{
          if(!entries.some(e=>e.isIntersecting))return;
          reveal.disconnect();
          if(document.documentElement.dataset.aniBooting!=='true'){setTimeout(startAnim,220);return;}
          const bootObs=new MutationObserver(()=>{if(document.documentElement.dataset.aniBooting!=='true'){bootObs.disconnect();setTimeout(startAnim,260);}});
          bootObs.observe(document.documentElement,{attributes:true,attributeFilter:['data-ani-booting']});
        },{threshold:.65});
        reveal.observe(meter);
      }
    }
    const columns = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length;
    if (!columns || getComputedStyle(grid).display !== 'grid') return;
    let count = 0;
    for (const child of grid.children) {
      if (child === premium) break;
      if (child.matches('.newanime-date-area') && getComputedStyle(child).display !== 'none') count++;
    }
    const span = columns - (count % columns);
    const value = `span ${span}`;
    if (premium.style.gridColumn !== value) premium.style.setProperty('grid-column', value, 'important');
  }
  let premiumGridObserver;
  const posterSorters = new WeakMap();
  const starMapLive = {};
  let starMapScoreObserver;
  let starMapFetchMissing = false;
  let starMapRatingCache = {};
  function pruneStarMapRatingCache() {
    const cutoff = Date.now() - (starMapLive.ttlHours ?? 24) * 3600000;
    starMapRatingCache = Object.fromEntries(Object.entries(starMapRatingCache)
      .filter(([, record]) => record?.timestamp >= cutoff)
      .sort(([, a], [, b]) => (b.lastUsed || b.timestamp) - (a.lastUsed || a.timestamp))
      .slice(0, starMapLive.cacheLimit ?? 500));
  }
  let starMapLiveFrame = 0;

  function applyStarMapRatingToCard(card, scoreText, image) {
    if (!Object.hasOwn(starMapLive, 'enabled') || !image) return;
    const watched = card.querySelector('.theme-number')?.textContent.match(/(\d+)\s*\/\s*\d+/);
    card.classList.toggle('ani-starmap-progress-fade', Boolean(starMapLive.fadeWatched && Number(watched?.[1]) > 0));
    if (scoreText === undefined || scoreText === null || scoreText === '') return;
    const score = Number(scoreText);
    if (!Number.isFinite(score)) return;
    const enabled = starMapLive.enabled !== false;
    const poster = image.querySelector('img');
    poster?.classList.toggle('ani-low-rating-masked', enabled && score < (starMapLive.threshold ?? 3.5));
    card.classList.toggle('ani-rating-blocked', enabled && score < (starMapLive.blockThreshold ?? 3));
    const id = card.getAttribute('href')?.match(/[?&]sn=(\d+)/)?.[1];
    const countLabel = image.querySelector('.acr-count')?.textContent;
    const count = Number(card.dataset.aniRatingCount || starMapRatingCache[id]?.count || countLabel?.replace(/[^\d]/g, ''));
    image.querySelector('.ani-poster-score')?.classList.toggle(
      'ani-rating-low-sample',
      enabled && Number.isFinite(count) && count > 0 && count < (starMapLive.sampleThreshold ?? 800),
    );
  }

  function fetchStarMapScore(card) {
    if (!card.isConnected || card.dataset.aniScoreRequested || starMapLive.enabled === false) return;
    const url = new URL(card.href);
    if (url.origin !== location.origin || !/^\/anime(?:Ref|Video)\.php$/.test(url.pathname)) return;
    card.dataset.aniScoreRequested = 'true';
    aniFetch(url.href, { credentials: 'same-origin', signal: AbortSignal.timeout(8000) },
      () => starMapLive.fetchInterval)
      .then(response => response.ok ? response.text() : '')
      .then(html => {
        const rawScore = Number(html.match(/"ratingValue"\s*:\s*"?([\d.]+)/)?.[1]);
        const score = Number.isFinite(rawScore) ? (rawScore > 5 ? rawScore / 2 : rawScore).toFixed(2) : parseScoreFromVideoHtml(html);
        if (!score || !card.isConnected) return;
        card.dataset.aniRelatedScore = score;
        const count = html.match(/"ratingCount"\s*:\s*"?(\d+)/)?.[1];
        if (count) card.dataset.aniRatingCount = count;
        starMapRatingCache[url.searchParams.get('sn')] = { score, count, timestamp: Date.now() };
        pruneStarMapRatingCache();
        scheduleStarMapCardRefresh();
      }).catch(() => {});
  }

  function scheduleStarMapCardRefresh() {
    if (starMapLiveFrame) return;
    starMapLiveFrame = requestAnimationFrame(() => {
      starMapLiveFrame = 0;
      enhancePosterRails();
    });
  }

  function syncStarMapDisplay() {
    const body = document.body;
    body.classList.toggle('ani-starmap-rating-off', starMapLive.enabled === false);
    body.classList.toggle('ani-disable-masking', starMapLive.enabled === false || starMapLive.maskEnabled === false);
    body.classList.toggle('ani-disable-blocking', starMapLive.enabled === false || starMapLive.blockEnabled === false);
    body.classList.toggle('ani-watched-fade-enabled', Boolean(starMapLive.fadeWatched));
    if (starMapLive.fontSize !== undefined) body.style.setProperty('--ani-starmap-badge-size', `${starMapLive.fontSize}px`);
    if (starMapLive.radius !== undefined) body.style.setProperty('--ani-starmap-badge-radius', `${starMapLive.radius}px`);
    scheduleStarMapCardRefresh();
  }
  const nativeWatch = new Map();
  const completedNativeWorks = new Set();
  const nativeWatchPositions = new Map();
  const localWatch = new Map();
  let localEpisodeProgress = new Map();
  function readNativePlayerBreakpoint() {
    try {
      const entry = JSON.parse(localStorage.getItem('ANIME_BP'));
      const elapsedSec = Number(entry?.breakPoint);
      if (!/^\d+$/.test(String(entry?.videoSn)) || !(elapsedSec > 0)) return null;
      return {
        videoSn: String(entry.videoSn),
        elapsedSec,
        watchedAt: Date.parse(String(entry.watchTime || '').replace(' ', 'T')) || 0,
      };
    } catch {
      return null;
    }
  }
  function indexEpisodeProgress(records) {
    const byVideo = new Map();
    function merge(videoSn, entry) {
      if (!videoSn) return;
      const key = String(videoSn);
      const previous = byVideo.get(key);
      const useEntry = !previous || (entry.elapsedSec > 0 &&
        (!(previous.elapsedSec > 0) || (entry.watchedAt || 0) > (previous.watchedAt || 0)));
      const current = useEntry ? entry : previous;
      byVideo.set(key, {
        ...current,
        durationSec: current.durationSec || (useEntry ? previous?.durationSec : entry.durationSec),
        watched: Boolean(previous?.watched || entry.watched || entry.elapsedSec > 0 || entry.watchedAt > 0),
        completed: Boolean(previous?.completed || entry.completed),
      });
    }
    for (const record of Object.values(records || {})) {
      for (const ep of [...Object.values(record?.episodes || {}), ...Object.values(record?.videoProgress || {})]) {
        if (ep?.videoSn) merge(ep.videoSn, ep);
      }
      if (record?.videoSn) merge(record.videoSn, record);
    }
    return byVideo;
  }
  const localWatchByTitle = new Map();
  const completedLocalTitles = new Set();
  const normalizeWatchTitle = title => title.normalize('NFKC').replace(/\s+/g, ' ').trim();
  const episodeOrdinals = new Map();
  function loadLocalPosterProgress(snapshot) {
    const storageGet = globalThis.AniEnhancements?.storageGet;
    if (!storageGet) return;
    const recordsReady = snapshot ? Promise.resolve(snapshot) : storageGet('aniPermanentHistoryV1', {});
    recordsReady.then(records => {
      localEpisodeProgress = indexEpisodeProgress(records);
      localWatch.clear();
      localWatchByTitle.clear();
      completedLocalTitles.clear();
      for (const [id, record] of Object.entries(records || {})) {
        if (typeof record?.title === 'string' && globalThis.AniEnhancements?.resolveEpisodeProgress?.({
          local: localEpisodeProgress.get(String(record.videoSn)) || record,
        })?.completed) {
          completedLocalTitles.add(normalizeWatchTitle(record.title));
        }
        const episodes = [record?.episode, ...Object.keys(record?.episodes || {})]
          .map(Number).filter(n => Number.isFinite(n) && n > 0);
        if (!episodes.length) continue;
        const progress = Math.max(...episodes);
        localWatch.set(String(record.sn || id), progress);
        if (String(record.sn || id) === String(record.videoSn) && typeof record.title === 'string') {
          const title = record.title.trim();
          localWatchByTitle.set(title, Math.max(localWatchByTitle.get(title) || 0, progress));
        }
      }
      if (settings.themeEnabled) enhancePosterRails();
      if (location.pathname === '/viewList.php') enhanceWatchHistory();
    }).catch(() => {});
  }
  document.addEventListener('ani-enhancements-ready', () => loadLocalPosterProgress(), { once: true });
  if (globalThis.AniEnhancements) loadLocalPosterProgress();
  if (location.pathname === '/viewList.php') {
    window.addEventListener('storage', event => {
      if (event.key !== 'aniPermanentHistoryV1') return;
      try { loadLocalPosterProgress(JSON.parse(event.newValue) || {}); } catch {}
    });
    window.addEventListener('pageshow', event => {
      if (event.persisted) loadLocalPosterProgress();
    });
  }
  function historyEpisodeFromLabel(label) {
    const normalized = label.normalize('NFKC').trim();
    return normalized.match(/\[\s*(\d+(?:\.\d+)?)\s*\]$/)?.[1] ||
      normalized.match(/^EP\.\s*(\d+(?:\.\d+)?)$/i)?.[1];
  }
  function getHistoryEpisodes(card, animeId) {
    if (!/^\d+$/.test(animeId)) return [];
    const doc = card.ownerDocument;
    const details = doc.getElementById(`sub-list-${animeId}`)
      || doc.querySelector(`.user-watchTime-list[data-anime-sn="${animeId}"]:not(.tmp-list)`);
    return Array.from(details?.querySelectorAll('a[href]') || []).flatMap(link => {
      const title = link.querySelector('.history-list-anime-title');
      const label = title?.dataset.aniOriginalTitle || title?.textContent.trim() || '';
      const episode = historyEpisodeFromLabel(label);
      const videoSn = link.getAttribute('href').match(/[?&]sn=(\d+)/)?.[1];
      return episode && videoSn ? [{ episode, videoSn }] : [];
    });
  }
  function mapSeasonEpisode(card,id,episode,total) {
    if (episodeOrdinals.has(id)) return;
    episodeOrdinals.set(id,null);
    aniFetch(card.href,{credentials:'include',signal:AbortSignal.timeout(10000)}).then(r=>r.ok?r.text():'').then(html=>{
      const doc = new DOMParser().parseFromString(html,'text/html');
      for (const season of doc.querySelectorAll('.season')) {
        const labels = [...new Set([...season.querySelectorAll('li a')].map(a=>a.textContent.trim()).filter(t=>/^\d+$/.test(t)).map(Number))];
        if (labels.length === Number(total) && labels.includes(episode)) {
          episodeOrdinals.set(id,new Map(labels.map((n,i)=>[n,i+1]))); break;
        }
      }
      enhancePosterRails();
    }).catch(()=>{});
  }
  function readNativeWatchPosition(card) {
    const text = [...card.querySelectorAll('.history-lastwatch')].map(node => node.textContent).join(' ');
    const time = text.match(/(?:(\d+)\s*時\s*)?(?:(\d+)\s*分\s*)?(\d+)\s*秒/);
    const bar = card.querySelector('.progress-bar');
    const elapsedSec = time
      ? Number(time[1] || 0) * 3600 + Number(time[2] || 0) * 60 + Number(time[3])
      : Number(bar?.getAttribute('aria-valuenow')) || undefined;
    const durationSec = Number(bar?.getAttribute('aria-valuemax')) || undefined;
    const width = bar?.querySelector('.progress')?.style.width.match(/^([\d.]+)%$/)?.[1];
    const fraction = width ? clamp(Number(width) / 100, 0, 1) : undefined;
    return { elapsedSec, durationSec, fraction, completed: /觀看結束|已看完/.test(text) || fraction === 1 };
  }
  let nativeWatchRequest;
  let nativeHistoryPage = 1;
  let nativeHistoryLastPage = 1;
  const nativeHistoryRequests = new Map();
  function fetchNativeHistoryPage(page) {
    if (nativeHistoryRequests.has(page)) return nativeHistoryRequests.get(page);
    const request = fetch(`https://api.gamer.com.tw/anime/v3/history.php?page=${page}`, {
      credentials: 'include', signal: AbortSignal.timeout(8000),
    }).then(response => response.ok ? response.json() : null).then(result => {
      const data = result?.data;
      if (!Array.isArray(data?.history)) return false;
      nativeHistoryPage = Math.max(nativeHistoryPage, page);
      nativeHistoryLastPage = Math.max(page, Number(data.totalPage) || 1);
      for (const anime of data.history) {
        const episodes = [anime.episode];
        for (const entry of anime.history || []) {
          const sn = String(entry.videoSn);
          if (/^\d+$/.test(sn) && !nativeWatchPositions.has(sn)) {
            nativeWatchPositions.set(sn, readNativeHistoryEntry(entry));
          }
          episodes.push(historyEpisodeFromLabel(String(entry.title || '')));
        }
        const watched = Math.max(0, ...episodes.map(Number).filter(Number.isFinite));
        if (anime.animeSn && watched > 0) nativeWatch.set(String(anime.animeSn), watched);
        if (!/^\d+$/.test(String(anime.videoSn))) continue;
        const position = readNativeHistoryEntry(anime);
        if (anime.animeSn && position.completed) completedNativeWorks.add(String(anime.animeSn));
        nativeWatchPositions.set(String(anime.videoSn), position);
      }
      return true;
    }).catch(() => false);
    nativeHistoryRequests.set(page, request);
    return request;
  }
  function readNativeHistoryEntry(entry) {
    const breakpoint = entry.breakPoint || entry.breakpoint;
    const elapsedSec = Number(breakpoint?.breakPoint ?? breakpoint) || undefined;
    const durationSec = Number(entry.duration) * 60 || undefined;
    const timestamp = String(breakpoint?.watchTime || entry.watchTime || '').replace(' ', 'T');
    const watchedAt = Date.parse(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(timestamp) ? timestamp + '+08:00' : timestamp) || 0;
    return {watched:true, elapsedSec, durationSec, watchedAt, completed:entry.completed === true || elapsedSec >= durationSec};
  }
  async function findNativeEpisodeHistory(videoSns) {
    const positions = await syncNativeWatch();
    while (nativeHistoryPage < nativeHistoryLastPage && !videoSns.some(sn => positions.has(sn))) {
      const nextPage = nativeHistoryPage + 1;
      if (!(await fetchNativeHistoryPage(nextPage))) break;
    }
    return positions;
  }
  async function getEpisodeWatchHistory(videoSns) {
    const [native, local] = await Promise.all([
      findNativeEpisodeHistory(videoSns),
      Promise.resolve(globalThis.AniEnhancements?.storageGet('aniPermanentHistoryV1', {}))
        .then(indexEpisodeProgress).catch(() => new Map()),
    ]);
    const breakpoint = readNativePlayerBreakpoint();
    return new Map(videoSns.map(sn => [sn, {
      native: native.get(sn),
      local: local.get(sn),
      breakpoint: breakpoint?.videoSn === sn ? breakpoint : null,
    }]));
  }
  globalThis.aniGetEpisodeWatchHistory = getEpisodeWatchHistory;
  function syncNativeWatch() {
    const collect = doc => {
      for (const c of doc.querySelectorAll('.user-watch-list .anime-card')) {
        const id = c.querySelector('.more-btn')?.dataset.anime || c.querySelector('[data-anime-sn]')?.dataset.animeSn;
        const nativeEpisode = c.querySelector('.user-lastwatch')?.textContent.trim();
        const historyEpisodes = getHistoryEpisodes(c, id);
        const episodes = historyEpisodes.map(entry => Number(entry.episode));
        for (const { videoSn } of historyEpisodes) {
          if (!nativeWatchPositions.has(videoSn)) nativeWatchPositions.set(videoSn, { watched: true });
        }
        if (nativeEpisode && Number.isFinite(Number(nativeEpisode))) episodes.push(Number(nativeEpisode));
        if (id && episodes.length) nativeWatch.set(id, Math.max(...episodes));
        const play = c.querySelector('.play-btn[href]') || c.querySelector('.click-area[href]');
        const videoSn = play?.getAttribute('href')?.match(/[?&]sn=(\d+)/)?.[1];
        if (videoSn) {
          const progress = readNativeWatchPosition(c);
          if (id && progress.completed) completedNativeWorks.add(String(id));
          nativeWatchPositions.set(videoSn, { ...progress, watched: true });
        }
      }
      return nativeWatchPositions;
    };
    if (location.pathname === '/viewList.php') return Promise.resolve(collect(document));
    if (nativeWatchRequest) return nativeWatchRequest;
    const link = document.querySelector('a[href*="viewList.php"]');
    if (!link || link.origin !== location.origin || link.pathname !== '/viewList.php' || /[?&]u=guest(?:&|$)/.test(link.href)) {
      return Promise.resolve(nativeWatchPositions);
    }
    nativeWatchRequest = fetchNativeHistoryPage(1).then(async loaded => {
      if (!loaded) {
        const response = await fetch(link.href, { credentials: 'same-origin', signal: AbortSignal.timeout(8000) });
        if (response.ok) collect(new DOMParser().parseFromString(await response.text(), 'text/html'));
      }
      enhancePosterRails();
      return nativeWatchPositions;
    }).catch(()=>nativeWatchPositions);
    return nativeWatchRequest;
  }
  function measureReleaseTitle(nameEl) {
    scheduleRailMeasurement(() => {
      const width = nameEl.clientWidth;
      const scrollWidth = nameEl.scrollWidth;
      return () => {
        if (!width || nameEl.dataset.aniMarqueeInit) return;
        const area = nameEl.closest('.newanime-date-area');
        if (!area) return;
        nameEl.dataset.aniMarqueeInit = 'true';
        const overflow = scrollWidth - width;
        const ownerCard = area.querySelector('.anime-card-block') || area.closest('.anime-card-block') || area;
        ownerCard.classList.toggle('ani-card-has-overflow', overflow > 2);
        if (overflow > 2) {
          const text = (nameEl.textContent || '').trim();
          const dist = Math.ceil(overflow + 16);
          const dur = Math.max(5.5, dist / 14).toFixed(2);
          const track = document.createElement('span');
          track.className = 'ani-marquee-track';
          track.textContent = text;
          nameEl.replaceChildren(track);
          nameEl.dataset.aniMarquee = 'true';
          nameEl.style.setProperty('--ani-marquee-dist', `-${dist}px`);
          nameEl.style.setProperty('--ani-marquee-dur', `${dur}s`);
        }
      };
    });
  }
  const releaseTitles = typeof IntersectionObserver === 'function' && new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      releaseTitles.unobserve(entry.target);
      measureReleaseTitle(entry.target);
    }
  }, {rootMargin: '200px 0px'});
  const pendingRailMeasurements = new Set();
  let railFrame = 0;
  function scheduleRailMeasurement(read) {
    pendingRailMeasurements.add(read);
    if (railFrame) return;
    railFrame = requestAnimationFrame(() => {
      railFrame = 0;
      const writes = [...pendingRailMeasurements].map(measure => measure());
      pendingRailMeasurements.clear();
      for (const write of writes) write();
    });
  }
  const preparedHomeRails = new WeakSet();
  const homeRailObserver = typeof IntersectionObserver === 'function' && new IntersectionObserver(entries => {
    const sections = entries.filter(entry => entry.isIntersecting).map(entry => entry.target);
    if (!sections.length) return;
    for (const section of sections) {
      homeRailObserver.unobserve(section);
      preparedHomeRails.add(section);
    }
    enhancePosterRails(sections);
  }, { rootMargin: '500px 0px' });
  function bindPosterRail(rail, list, cardSelector, label) {
    const arrows = [];
    for (const direction of [-1, 1]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `ani-rail-arrow ${direction < 0 ? 'ani-rail-prev' : 'ani-rail-next'}`;
      button.setAttribute('aria-label', (direction < 0 ? '向左瀏覽' : '向右瀏覽') + label);
      button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${direction < 0 ? 'm14 6-6 6 6 6' : 'm10 6 6 6-6 6'}"/></svg>`;
      button.addEventListener('click', () => list.scrollBy({ left: direction * list.clientWidth * .8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
      rail.append(button);
      arrows.push(button);
    }
    const measure = () => {
      const cards = list.querySelectorAll(cardSelector);
      const card = cards[0];
      const image = card?.querySelector('.theme-img-block');
      const imageHeight = image && Math.ceil(image.getBoundingClientRect().height) + 'px';
      const bounds = card?.getBoundingClientRect();
      const height = bounds && Math.ceil(bounds.height) + 'px';
      const center = bounds && rail.classList.contains('ani-watch-poster-rail')
        ? bounds.top - rail.getBoundingClientRect().top + bounds.height / 2
        : null;
      const left = list.scrollLeft > 2;
      const right = list.scrollLeft + list.clientWidth < list.scrollWidth - 2;
      return () => {
        if (imageHeight) rail.style.setProperty('--ani-rail-image-height', imageHeight);
        if (height) rail.style.setProperty('--ani-rail-card-height', height);
        if (center !== null) rail.style.setProperty('--ani-rail-center', center + 'px');
        rail.classList.toggle('ani-can-prev', left);
        rail.classList.toggle('ani-can-next', right);
        rail.classList.toggle('ani-rail-no-scroll', cards.length <= 1 || (!left && !right));
        arrows[0].disabled = !left;
        arrows[1].disabled = !right;
      };
    };
    const sync = () => scheduleRailMeasurement(measure);
    list.addEventListener('scroll', sync, { passive: true });
    if (typeof ResizeObserver === 'function') new ResizeObserver(sync).observe(list);
    new MutationObserver(sync).observe(list, { childList: true, subtree: true });
    sync();
  }

  function enhancePosterRails(sections) {
    syncNativeWatch();
    for (const section of sections || document.querySelectorAll('#BH_background .animate-theme-list, #BH_background .old_list:not(:has(.search_result))')) {
      if (homeRailObserver && document.body.classList.contains('ani-home-page') && !preparedHomeRails.has(section)) {
        homeRailObserver.observe(section);
        continue;
      }
      if (section.matches('.old_list')) section.classList.add('ani-related-list');
      const isRelated = section.matches('.old_list:not(:has(.search_result))');
      section.classList.toggle('ani-filtered-list', Boolean(section.querySelector(':scope > .filter-section')));
      const heading = section.querySelector('.theme-title, :scope > h2, .old_list-title > h2');
      if (section.matches('.animate-wish') && heading && !heading.querySelector('.ani-section-icon')) {
        heading.insertAdjacentHTML('afterbegin', '<span class="ani-section-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/><path d="M9 8h6m-6 4h6"/></svg></span>');
      }
      const headerIcon = section.id === 'blockHotAnime' ? 'hot' : section.id === 'blockAnimeNewArrive' ? 'new' : section.matches('.old_list') || /相關動畫/.test(heading?.textContent || '') ? 'related' : '';
      if (heading && headerIcon && !heading.querySelector('.ani-section-icon')) {
        const icon = document.createElement('span');
        icon.className = 'ani-section-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = headerIcon === 'hot'
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3c1 4-3 5-2 8-2-1-3-2-3-4-2 3-4 5-4 8a8 8 0 0 0 16 0c0-5-4-10-7-12Z"/><path d="M10 16c-1 1-1 2-1 3a3 3 0 0 0 6 0c0-2-1-3-2-4 0 2-1 3-3 1Z"/></svg>'
          : headerIcon === 'related'
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m10 9 5 3-5 3V9Z"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="14" rx="3"/><path d="M8 3h8M6 5h12m-6 6v6m-3-3h6"/></svg>';
        heading.prepend(icon);
      }
      for (const card of section.querySelectorAll('.theme-list-main')) {
        if (!card.classList.contains('ani-poster-card')) card.classList.add('ani-poster-card');
        if (card.matches('.wish-card[onclick]') && !card.querySelector('.ani-wish-vote')) {
          const star = card.querySelector('.btn-card-block.btn-star');
          if (star) {
            card.removeAttribute('href');
            const vote = document.createElement('button');
            vote.type = 'button';
            vote.className = 'ani-wish-vote';
            vote.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span></span>';
            card.append(vote);
            card.addEventListener('click', event => {
              if (!vote.contains(event.target)) event.stopImmediatePropagation();
            }, true);
            const syncVote = () => {
              const active = star.classList.contains('btn-is-active');
              vote.setAttribute('aria-pressed', String(active));
              vote.querySelector('span').textContent = active ? '已投票' : '投票';
            };
            syncVote();
            new MutationObserver(syncVote).observe(star, { attributes: true, attributeFilter: ['class'] });
          }
        }
        const image = card.querySelector('.theme-img-block');
        const score = [...card.querySelectorAll('.label-edition')].find(n => /^[0-5](?:\.\d+)?$/.test(n.textContent.trim()));
        const externalScore = card.querySelector('.tm-acg-rating,.ani-custom-rating');
        const id = card.getAttribute('href')?.match(/[?&]sn=(\d+)/)?.[1];
        const cached = starMapRatingCache[id];
        const freshScore = cached && Date.now() - cached.timestamp < (starMapLive.ttlHours ?? 24) * 3600000 ? cached.score : undefined;
        const scoreText = score?.textContent.trim() || externalScore?.textContent.match(/(?:★\s*|^\s*)([0-5](?:\.\d+)?)(?=\s|\/|$)/)?.[1] ||
          card.dataset.aniRelatedScore || card.dataset.ratingScore || freshScore;
        if (!scoreText && image && starMapFetchMissing && starMapLive.enabled === true && !card.dataset.aniScoreRequested && card.matches('a[href]')) {
          if (!starMapScoreObserver && typeof IntersectionObserver === 'function') {
            starMapScoreObserver = new IntersectionObserver(entries => {
              for (const { isIntersecting, target } of entries) {
                if (!isIntersecting) continue;
                starMapScoreObserver.unobserve(target);
                fetchStarMapScore(target);
              }
            }, { rootMargin: '120px' });
          }
          if (starMapScoreObserver) starMapScoreObserver.observe(card);
          else fetchStarMapScore(card);
        }
        if (!scoreText && image && section.matches('.old_list,#blockHotAnime,[id^="blockAnimeNewArrive"]') && !card.dataset.aniScoreRequested && card.matches('a[href*="animeRef.php?sn="],a[href*="animeVideo.php?sn="]')) {
          card.dataset.aniScoreRequested = 'true';
          aniFetch(card.href).then(response => response.ok ? response.text() : '').then(html => {
            const value = parseScoreFromVideoHtml(html);
            if (value && card.isConnected) {
              card.dataset.aniRelatedScore = value;
              enhancePosterRails();
            }
          }).catch(() => {});
        }
        if (score && !score.classList.contains('ani-rating-source')) score.classList.add('ani-rating-source');
        if (scoreText && image && !image.querySelector('.ani-poster-score')) {
          const pill = document.createElement('span');
          pill.className = 'ani-poster-score';
          pill.textContent = `★ ${scoreText}`;
          image.append(pill);
        }
        const scorePill = image?.querySelector('.ani-poster-score');
        if (scoreText && scorePill && scorePill.textContent !== `★ ${scoreText}`) scorePill.textContent = `★ ${scoreText}`;
        applyStarMapRatingToCard(card, scoreText, image);
        const footer=card.querySelector('.anime-detail-block');
        footer?.querySelectorAll(':scope > .ani-footer-frost').forEach(layer=>layer.remove());
        const favorite = card.querySelector('.btn-favorite');
        const labels = card.querySelector('.anime-tag-row .anime-label-block');
        if (image && labels && labels.querySelector('.label-edition:not(.ani-rating-source)')) {
          labels.classList.add('ani-poster-labels');
          image.append(labels);
        }
        if (favorite && !favorite.querySelector('svg')) {
          favorite.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
        }
        for (const date of card.querySelectorAll('.theme-time')) {
          const release=date.textContent.trim().match(/^(最近更新|上架日)\s*[：:]\s*(\d{1,2}\/\d{1,2})$/);
          if(release&&!date.classList.contains('ani-release-date')){date.classList.add('ani-release-date');date.setAttribute('aria-label',date.textContent.trim());const update=release[1]==='最近更新';date.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${update?'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>':'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/>'}</svg><span>${update?'更新':'上架'} ${release[2]}</span>`;}
          const match = date.textContent.match(/年份[：:]\s*(\d{4})\/(\d{1,2})/);
          if (match && Number(match[2]) >= 1 && Number(match[2]) <= 12) {
            date.title = date.textContent.trim();
            date.textContent = `${match[1]} ${['冬', '春', '夏', '秋'][Math.floor((Number(match[2]) - 1) / 3)]}番`;
          }
        }
        for(const label of card.querySelectorAll('span,div')){
          if(label.children.length||label.closest('.ani-age-restricted'))continue;const text=label.textContent.trim();
          if(text==='年齡限制'){label.classList.add('ani-age-restricted');label.setAttribute('aria-label','年齡限制');label.innerHTML='<span class="ani-age-symbol" aria-hidden="true">18+</span>';}
          if(text==='連載中')label.classList.add('ani-serial-label');
        }
        const episodes = card.querySelector('.theme-number');
        card.classList.toggle('ani-age-anime',!!card.querySelector('.ani-age-restricted'));
        for(const label of card.querySelectorAll('.label-edition'))if(/年齡限制|限制級|18禁/.test(label.textContent))label.classList.add('ani-age-restricted');
        const paidLabels=[...card.querySelectorAll('.label-edition')].filter(el=>el.textContent.trim()==='付費會員');
        card.classList.toggle('ani-member-anime',paidLabels.length>0);
        for(const label of paidLabels)label.classList.add('ani-paid-label-source');
        if(episodes){
          episodes.classList.toggle('ani-member-episodes',paidLabels.length>0);
        }
        const cover=card.querySelector('.theme-img');
        const coverUrl=cover?.dataset.src||cover?.getAttribute('src');
        if(coverUrl&&/^https:\/\/(?:p2|i2|truth)\.bahamut\.com\.tw\//.test(coverUrl)){
          const value=`url("${coverUrl.replace(/["\\\n\r]/g,'')}")`;
          if(card.style.getPropertyValue('--ani-card-cover')!==value)card.style.setProperty('--ani-card-cover',value);
        }
        const imageProgress = card.querySelector('.ani-watch-progress-badge');
        const totalMatch = episodes?.textContent.match(/(?:共\s*)?(\d+)\s*集/);
        if (episodes && image) {
          if (totalMatch && (!episodes.dataset.aniTotalEpisodes || /^共/.test(episodes.textContent.trim()))) episodes.dataset.aniTotalEpisodes = totalMatch[1];
          const total = episodes.dataset.aniTotalEpisodes;
          const original = imageProgress?.textContent || '';
          const watched = original.match(/看到第\s*(\d+)\s*[話集]/);
          const animeId = card.getAttribute('href')?.match(/[?&]sn=(\d+)/)?.[1];
          const native = nativeWatch.get(animeId);
          const title = card.querySelector('.theme-name')?.textContent.trim();
          const saved = localWatch.get(animeId) ?? localWatchByTitle.get(title);
          const position = native === undefined && saved === undefined
            ? (watched ? Number(watched[1]) : undefined)
            : Math.max(native ?? 0, saved ?? 0);
          if (position > Number(total)) mapSeasonEpisode(card,animeId,position,total);
          const normalized = episodeOrdinals.get(animeId)?.get(position);
          const isMovie = isRelated && (episodes.textContent.trim() === '電影'
            || /劇[場场]版|電影版/.test(title || '')
            || [...card.querySelectorAll('.label-edition')].some(badge => /^(電影|劇場版)$/.test(badge.textContent.trim())));
          const label = isMovie ? '電影'
            : position !== undefined && total ? (position > Number(total) && normalized === undefined ? `已看第 ${position} 集` : `${normalized ?? position} / ${total} 集`)
            : /尚未觀看/.test(original) && total ? `0 / ${total} 集`
            : total ? `共 ${total} 集` : '';
          if (label && episodes.textContent.trim() !== label) episodes.textContent = label;
          const movieWatched = isMovie && (completedNativeWorks.has(animeId)
            || (title && completedLocalTitles.has(normalizeWatchTitle(title))));
          if (movieWatched && !episodes.classList.contains('ani-movie-watched')) {
            episodes.classList.add('ani-movie-watched');
            episodes.insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.3 2.3 4.7-4.7"/></svg>');
            episodes.title = '已看過';
          }
          if (!movieWatched && episodes.classList.contains('ani-movie-watched')) {
            episodes.classList.remove('ani-movie-watched');
            episodes.querySelector('svg')?.remove();
            episodes.removeAttribute('title');
          }
          if (episodes.parentElement !== image) image.append(episodes);
        }
        if (episodes && paidLabels.length) {
          episodes.setAttribute('aria-label', `付費會員限定，${episodes.textContent.trim()}${episodes.classList.contains('ani-movie-watched') ? '，已看過' : ''}`);
        }
        const views = card.querySelector('.show-view-number');
        const marqueeTitle=card.querySelector('.theme-name');
        if(marqueeTitle&&!marqueeTitle.querySelector('.ani-title-marquee')){const text=marqueeTitle.textContent;const span=document.createElement('span');span.className='ani-title-marquee';span.textContent=text;marqueeTitle.replaceChildren(span);}
        if(marqueeTitle&&!marqueeTitle.dataset.aniMarquee){
          marqueeTitle.dataset.aniMarquee='true';
          const measure = () => {
            const track = marqueeTitle.querySelector('.ani-title-marquee');
            // A wrapped title cannot be used to measure the collapsed single line.
            if (!track || card.matches('.ani-card-has-overflow:is(:hover,:focus-within)')) return;
            const parent = marqueeTitle.parentElement;
            const style = getComputedStyle(parent);
            const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
            const distance = Math.max(0, track.scrollWidth - (parent.clientWidth - padding));
            // The related title mask extends into the gutters, leaving both endpoints fully visible.
            const travel = distance + (isRelated ? 0 : 16);
            const offset = `${-Math.ceil(travel)}px`;
            const duration = `${Math.max(5.5, travel / 14).toFixed(2)}s`;
            if (marqueeTitle.style.getPropertyValue('--ani-marquee-dist') !== offset) {
              marqueeTitle.style.setProperty('--ani-marquee-dist', offset);
            }
            if (marqueeTitle.style.getPropertyValue('--ani-marquee-dur') !== duration) {
              marqueeTitle.style.setProperty('--ani-marquee-dur', duration);
            }
            marqueeTitle.classList.toggle('ani-title-overflow', distance > 2);
            card.classList.toggle('ani-card-has-overflow', distance > 2);
          };
          if (section.matches('.ani-studio-row')) {
            card.addEventListener('pointerenter', measure);
            card.addEventListener('focusin', measure);
          } else {
            let measuredWidth = -1;
            const measureWidth = () => {
              const width = marqueeTitle.clientWidth;
              if (width === measuredWidth) return;
              measuredWidth = width;
              measure();
            };
            if (typeof ResizeObserver === 'function') new ResizeObserver(measureWidth).observe(marqueeTitle);
            requestAnimationFrame(measureWidth);
            document.fonts?.ready.then(measure);
          }
          card.addEventListener('mouseleave', measure);
          card.addEventListener('focusout', () => requestAnimationFrame(measure));
        }
        const details = card.querySelector('.theme-detail-info-block');
        if (views && details && views.parentElement !== details) details.append(views);
      }
      const list = section.querySelector('.theme-list-block');
      if (section.matches('.old_list') && !section.dataset.aniOldlistScrollSync) {
        section.dataset.aniOldlistScrollSync = 'true';
        const syncOldListScroll = () => {
          const cards = [...section.querySelectorAll('.theme-list-main')];
          const sliderEl = section.querySelector('.anime_slider') || list;
          const trackEl = section.querySelector('.anime_slider > ul, .theme-list-block');
          const trackWidth = trackEl ? Math.max(trackEl.scrollWidth, cards.length * 200 - 16) : 0;
          const viewportWidth = sliderEl ? sliderEl.clientWidth : section.clientWidth;
          const canScroll = cards.length > 1 && viewportWidth > 0 && trackWidth > viewportWidth + 4;
          section.classList.toggle('ani-oldlist-can-scroll', canScroll);
        };
        if (typeof ResizeObserver === 'function') {
          new ResizeObserver(syncOldListScroll).observe(section);
        }
        requestAnimationFrame(syncOldListScroll);
      }
      const relatedTrack = location.pathname === '/animeVideo.php'
        ? section.querySelector('.anime_slider > ul')
        : null;
      if (relatedTrack && !relatedTrack.parentElement.classList.contains('ani-poster-rail')) {
        const rail = relatedTrack.parentElement;
        rail.classList.add('ani-poster-rail', 'ani-watch-poster-rail');
        bindPosterRail(rail, relatedTrack, '.theme-list-main', '動畫');
      }
      if (!list || (location.pathname === '/mygather.php' && !section.matches('.ani-studio-row')) || section.matches('.animate-wish') || section.closest('.old_list:has(.search_result)') || section.querySelector(':scope > .filter-section') || !list.querySelector('.theme-list-main') || list.closest('.ani-poster-rail')) continue;
      const rail = document.createElement('div');
      rail.className = 'ani-poster-rail';
      list.before(rail);
      rail.append(list);
      bindPosterRail(rail, list, '.theme-list-main', '動畫');
    }
    for (const actions of document.querySelectorAll('.ani-section-actions')) {
      if (location.pathname === '/viewList.php' || actions.closest('.animate-wish')) continue;
      let input = actions.querySelector('input.ani-owned-rating-toggle');
      const externalToggle = actions.querySelector('input[type="checkbox"]:not(.ani-owned-rating-toggle)');
      if (!input) {
        input = document.createElement('input'); input.type='checkbox'; input.hidden=true;
        input.className='ani-owned-rating-toggle'; input.checked=starMapLive.sortEnabled ?? Boolean(externalToggle?.checked);
        // The external helper otherwise sorts on every individual response.
        // Its data stays readable; the shared control owns ordering only.
        if (externalToggle) externalToggle.checked=false;
        actions.append(input);
      }
      const section = actions.closest('.animate-theme-list');
      const list = section?.querySelector('.theme-list-block');
      const staleProgress = [...(section?.querySelectorAll('.theme-title > span') || [])].find(n=>/讀取評分中/.test(n.textContent));
      if (staleProgress && !staleProgress.classList.contains('ani-legacy-rating-progress')) staleProgress.classList.add('ani-legacy-rating-progress');
      actions.querySelector('.ani-rating-status')?.remove();
      if (input && list && !posterSorters.has(list)) {
        const original = new Map([...list.children].filter(card => card.matches('.theme-list-main')).map((card, index) => [card, index]));
        let timer;
        const sort = () => {
          const cards = [...list.children].filter(c => c.matches('.theme-list-main'));
          cards.forEach(c => { if (!original.has(c)) original.set(c, original.size); });
          const score = c => {
            const text = c.querySelector('.ani-poster-score')?.textContent || c.querySelector('.tm-acg-rating')?.textContent || '';
            const value = text.match(/★\s*([0-5](?:\.\d+)?)/)?.[1] ?? c.dataset.ratingScore;
            return value === undefined ? -1 : Number(value);
          };
          const ordered = [...cards].sort(input.checked ? (a,b) => score(b)-score(a) || original.get(a)-original.get(b) : (a,b) => original.get(a)-original.get(b));
          list.classList.add('ani-owned-card-order');
          if (ordered.some((c,i) => c !== cards[i])) ordered.forEach(c => list.append(c));
        };
        // Scores arrive in batches. Keep the visible order stable until the
        // batch settles; a deliberate click still applies immediately.
        const schedule = () => {
          if (!input.checked || timer) return;
          timer = setTimeout(() => { timer = 0; if (input.checked) sort(); }, 120);
        };
        new MutationObserver(schedule).observe(list, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['data-rating-score']});
        input.addEventListener('change', sort);
        posterSorters.set(list, sort);
        const initialCards = [...list.querySelectorAll('.theme-list-main')];
        if (initialCards.every(c=>c.querySelector('.ani-poster-score'))) sort();
        else schedule();
      }
      if (!input || actions.querySelector('.ani-rating-sort')) continue;
      const group = document.createElement('div');
      group.className = 'ani-rating-options';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', '作品排序');
      for (const [rated, label] of [[false, '預設'], [true, '評分']]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ani-rating-sort';
        button.innerHTML = rated
          ? '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg>'
          : '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 12h11M4 18h6"/></svg>';
        button.append(label);
        button.addEventListener('click', () => {
          if (input.checked === rated) return;
          input.checked = rated;
          input.dispatchEvent(new Event('change'));
          list?.scrollTo?.({left:0});
        });
        group.append(button);
      }
      const sync = () => [...group.children].forEach((button, index) =>
        button.setAttribute('aria-pressed', String(input.checked === Boolean(index))));
      input.addEventListener('change', sync);
      actions.append(group);
      sync();
    }
    const qaInfoSvg = '<svg class="ani-info-i-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><circle cx="12" cy="8.2" r="0.6" fill="currentColor" stroke="none"/></svg>';
    for (const qa of document.querySelectorAll('.qa-icon')) {
      if (!qa.querySelector('.ani-info-i-icon')) {
        qa.innerHTML = qaInfoSvg;
        qa.classList.add('ani-info-badge-host');
      }
    }
    const decorateExternalRatingPills = () => {
      for (const pill of document.querySelectorAll('#BH_background :is(button, a, div, span), body > :is(button, div)')) {
        if (pill.closest('#ani_video, .ani-player-settings-drawer, .ani-settings-panel, .ani-view-settings-panel, .ani-home-dash')) continue;
        if (pill.childElementCount > 2) continue;
        const txt = (pill.textContent || '').replace(/\s+/g, ' ').trim();
        if (!txt || txt.length > 48) continue;
        if (!/(?:預先載入.*評等|排序完成|載入所有評等)/.test(txt)) continue;
        if ([...pill.children].some((c) => !c.classList.contains('ani-ext-sort-icon') && /(?:預先載入.*評等|排序完成|載入所有評等)/.test(c.textContent || ''))) continue;
        pill.classList.add('ani-ext-rating-pill');
        if (/排序完成/.test(txt)) pill.classList.add('is-done');
        const tw = document.createTreeWalker(pill, NodeFilter.SHOW_TEXT);
        let tNode;
        while ((tNode = tw.nextNode())) {
          const cleaned = (tNode.nodeValue || '').replace(/[\u2705\u2714\u2611\uFE0F]/g, '').replace(/^\s+/, '');
          if (cleaned !== tNode.nodeValue) tNode.nodeValue = cleaned;
        }
        if (!pill.querySelector('.ani-ext-sort-icon')) {
          const ic = document.createElement('span');
          ic.className = 'ani-ext-sort-icon';
          ic.setAttribute('aria-hidden', 'true');
          ic.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
          pill.prepend(ic);
        }
      }
    };
    decorateExternalRatingPills();
    for (const tb of document.querySelectorAll('.user-setting-toolbox')) {
      const secBtn = tb.querySelector('a.btn-account-manage');
      if (secBtn && !secBtn.dataset.aniSecPolished) {
        secBtn.dataset.aniSecPolished = 'true';
        secBtn.dataset.aniSecTip = '帳號安全';
        secBtn.setAttribute('aria-label', '帳號安全');
        secBtn.removeAttribute('title');
        secBtn.innerHTML = '<svg class="ani-sec-shield-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 5 6v6c0 4.5 3 8.2 7 9.5 4-1.3 7-5 7-9.5V6l-7-3Z"/><path d="m9.5 12 1.8 1.8 3.6-3.8"/></svg>';
      }
      const tbIcons = [
        [/闇黑/, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>'],
        [/家長/, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'],
        [/動漫通/, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 14.5 9.5 21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/></svg>'],
        [/推播|通知/, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>'],
      ];
      for (const titleEl of tb.querySelectorAll('.item-title')) {
        if (!titleEl.querySelector('.ani-tb-row-icon')) {
          const m = tbIcons.find(([re]) => re.test(titleEl.textContent || ''));
          if (m) titleEl.insertAdjacentHTML('afterbegin', `<span class="ani-tb-row-icon" aria-hidden="true">${m[1]}</span>`);
        }
        const rowEl = titleEl.closest('.setting-item, li, div');
        const siblingQa = rowEl && [...rowEl.children].find((c) => c.matches?.('.qa-icon'));
        if (siblingQa && siblingQa.parentElement !== titleEl) {
          titleEl.append(siblingQa);
        }
      }
      for (const sw of tb.querySelectorAll('ul.switch-toggle')) {
        const onRadio = sw.querySelector('input[value="moon"], input[value="1"]');
        const offRadio = sw.querySelector('input[value="sun"], input[value="0"]');
        if (!onRadio || !offRadio) continue;
        if (onRadio.value === 'moon') {
          const darkRow = sw.closest('.ani-setting-item, .setting-item, .dark-mode-setting, li, div');
          if (darkRow && darkRow !== tb) darkRow.classList.add('ani-tb-hidden-darkmode');
          continue;
        }
        sw.classList.add('ani-toolbox-pill-switch');
        const syncSw = () => sw.classList.toggle('is-on', !!onRadio.checked);
        syncSw();
        if (!sw.dataset.aniSwBound) {
          sw.dataset.aniSwBound = 'true';
          onRadio.addEventListener('change', syncSw);
          offRadio.addEventListener('change', syncSw);
          sw.addEventListener('click', (ev) => {
            if (ev.target?.tagName === 'INPUT' || ev.target?.tagName === 'LABEL') {
              setTimeout(syncSw, 20);
              return;
            }
            ev.preventDefault();
            (onRadio.checked ? offRadio : onRadio).click();
            setTimeout(syncSw, 20);
          });
        }
      }
    }
  }
  function showAniToast(message) {
    let toast = document.querySelector('#ani-copy-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'ani-copy-toast';
      toast.className = 'ani-copy-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('popover', 'manual');
      document.body?.append(toast);
    }
    toast.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg><span></span>';
    toast.querySelector('span').textContent = message;
    try { toast.showPopover?.(); } catch {}
    toast.classList.add('is-visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => {
        if (!toast.classList.contains('is-visible')) {
          try { toast.hidePopover?.(); } catch {}
        }
      }, 200);
    }, 1800);
  }
  function syncLastWatchedEpisodes() {
    if (location.pathname === '/animeVideo.php') {
      for (const control of document.querySelectorAll('#BH_background .container-player .ani-season-more > .ani-season-more-btn')) {
        control.remove();
      }
      for (const control of document.querySelectorAll('#BH_background .container-player :is(button, a, input[type="button"], [role="button"], .btn-show-more):not(.season li *)')) {
        const label = control.value || control.textContent.trim();
        if (label === '全部展開' || label === '全部收合') control.remove();
      }
    }
    for (const epLi of document.querySelectorAll('#BH_background .season li')) {
      if (epLi.classList.contains('ani-last-watched')) continue;
      let isLast = /\b(?:saw|last|last-?watch(?:ed)?)\b/i.test(epLi.className || '');
      for (const el of [epLi, ...epLi.querySelectorAll('*')]) {
        if (el.classList.contains('saw')) isLast = true;
        const markerClass = /watch|last|saw/i.test(el.getAttribute('class') || '');
        const text = el.textContent || '';
        if (el !== epLi && ((!el.children.length && text.includes('上次觀看')) ||
            (markerClass && /上次/.test(el.getAttribute('title') || el.getAttribute('aria-label') || text)))) {
          el.classList.add('ani-last-watched-badge');
          el.style.setProperty('display', 'none', 'important');
          isLast = true;
        }
        if (markerClass && ['::before', '::after'].some(pseudo => /上次觀看/.test(getComputedStyle(el, pseudo).content || ''))) {
          el.classList.add('ani-last-watched-pseudo');
          isLast = true;
        }
      }
      if (isLast) epLi.classList.add('ani-last-watched');
    }
    const lastSn = new Set(
      [...document.querySelectorAll('.season li.ani-last-watched a')]
        .map((a) => (a.getAttribute('href') || '').match(/[?&]sn=(\d+)/)?.[1])
        .filter(Boolean)
    );
    if (lastSn.size) {
      for (const btn of document.querySelectorAll('#ani_video .ani-ep-drawer-btn:not(.is-last-watched)')) {
        const bSn = (btn.getAttribute('href') || '').match(/[?&]sn=(\d+)/)?.[1];
        if (bSn && lastSn.has(bSn)) btn.classList.add('is-last-watched');
      }
    }
  }
  function styleSkipIntroPill(box) {
    if (!box) return;
    box.classList.add('ani-skip-intro-pill');
    box.style.setProperty('border-radius', '999px', 'important');
    const twSkip = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    let sn;
    while ((sn = twSkip.nextNode())) {
      if (sn.parentElement?.closest('.ani-skip-close')) continue;
      const raw = sn.nodeValue || '';
      const next = raw.replace(/按此\s*跳過片頭(?:曲)?/g, '跳過片頭').replace(/按此\s*(?=跳過|略過)/g, '');
      if (next !== raw) sn.nodeValue = next;
    }
    if (!box.querySelector('.ani-skip-close')) {
      let closeEl = [...box.querySelectorAll('button, a, span, div, i, svg')].find((n) => {
        if (n === box) return false;
        const txt = (n.textContent || '').trim();
        if (/^(?:×|✕|✖|close|x)$/i.test(txt) || n.matches('i.material-icons, .material-icons, .material-icons-round, [class*="close" i], [aria-label*="關閉" i], [aria-label*="close" i], [title*="關閉" i], [title*="close" i]')) {
          return true;
        }
        return n.matches('svg') && !txt && !/(?:skip|forward|fast)/i.test(n.className?.baseVal || '');
      });
      if (closeEl?.tagName?.toLowerCase() === 'svg' && closeEl.parentElement && closeEl.parentElement !== box && !/跳過|略過|Skip/i.test(closeEl.parentElement.textContent || '') && closeEl.parentElement.children.length === 1) {
        closeEl = closeEl.parentElement;
      }
      if (!closeEl) {
        const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
        let tNode;
        while ((tNode = w.nextNode())) {
          const m = (tNode.nodeValue || '').match(/^([\s\S]*?)([×✕✖])\s*$/);
          if (m && tNode.parentNode) {
            const closeSpan = document.createElement('span');
            closeSpan.className = 'ani-skip-close';
            closeSpan.textContent = m[2];
            tNode.nodeValue = m[1].replace(/\s+$/, '');
            tNode.parentNode.insertBefore(closeSpan, tNode.nextSibling);
            closeEl = closeSpan;
            break;
          }
        }
      }
      if (closeEl) closeEl.classList.add('ani-skip-close');
    }
    for (const inner of box.querySelectorAll('*')) {
      if (inner.classList.contains('ani-skip-close') || inner.closest('.ani-skip-close')) continue;
      inner.classList.add('ani-skip-intro-inner');
      inner.style.setProperty('background', 'transparent', 'important');
      inner.style.setProperty('background-color', 'transparent', 'important');
      inner.style.setProperty('background-image', 'none', 'important');
      inner.style.setProperty('backdrop-filter', 'none', 'important');
      inner.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
      inner.style.setProperty('filter', 'none', 'important');
      inner.style.setProperty('box-shadow', 'none', 'important');
      inner.style.setProperty('border', '0', 'important');
    }
  }
  let fullscreenObserver;

  function syncPlaybackSeekLabels(root = document) {
    for (const button of root.querySelectorAll('[data-ani-playback-seek]')) {
      const direction = button.dataset.aniPlaybackSeek === '-1' ? '倒轉' : '快轉';
      const label = `${direction} ${settings.playbackSeekSeconds} 秒`;
      if (button.getAttribute('aria-label') === label) continue;
      button.setAttribute('aria-label', label);
      button.querySelector('span').textContent = settings.playbackSeekSeconds;
    }
  }

  function createPlaybackSeekButton(player, direction) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ani-playback-seek';
    button.dataset.aniPlaybackSeek = String(direction);
    const paths = direction < 0
      ? 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5'
      : 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5';
    button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths}"/></svg><span aria-hidden="true"></span>`;
    button.addEventListener('click', event => {
      event.stopPropagation();
      if (player.matches('.vjs-ad-playing, .vjs-ad-loading')) return;
      const video = player.querySelector('video');
      if (!video || !Number.isFinite(video.currentTime)) return;
      const target = video.currentTime + direction * settings.playbackSeekSeconds;
      video.currentTime = Math.max(0, Number.isFinite(video.duration) ? Math.min(video.duration, target) : target);
    });
    return button;
  }

  function syncDanmuHeat() {
    if (location.pathname !== '/animeVideo.php') return;
    const player = document.querySelector('#ani_video');
    const progress = player?.querySelector('.vjs-progress-control');
    const chart = progress?.querySelector('.ani-danmu-heat');
    const duration = player?.querySelector('video')?.duration;
    const sn = new URLSearchParams(location.search).get('sn') || '';
    const plusHeat = document.querySelector('input[data-ani-plus-danmu-heat]');
    if (!fontSettingsKnown || !settings.themeEnabled || !settings.showDanmuHeat ||
        plusHeat?.checked === false ||
        player?.matches(NON_EPISODE_PLAYER_SELECTOR) || !progress ||
        !Number.isFinite(duration) || duration <= 0 || !/^\d+$/.test(sn)) {
      chart?.remove();
      return;
    }
    if (chart?.dataset.sn === sn && chart.dataset.duration === String(duration)) return;
    chart?.remove();

    if (danmuHeatData?.sn !== sn) {
      const entry = { sn, times: null };
      danmuHeatData = entry;
      fetch('/ajax/danmuGet.php', {
        method: 'POST',
        credentials: 'same-origin',
        body: new URLSearchParams({ sn }),
        signal: AbortSignal.timeout(8000),
      }).then(response => response.ok ? response.json() : null)
        .then(rows => {
          entry.times = Array.isArray(rows) ? rows.flatMap(row => {
            const time = row?.time == null ? NaN : Number(row.time) / 10;
            return Number.isFinite(time) && time >= 0 ? [time] : [];
          }) : [];
          if (danmuHeatData === entry) syncDanmuHeat();
        }).catch(() => { entry.times = []; });
      return;
    }
    if (!danmuHeatData.times?.length) return;

    const buckets = new Uint32Array(100);
    for (const time of danmuHeatData.times) {
      if (time <= duration) buckets[Math.min(buckets.length - 1, Math.floor(time / duration * buckets.length))]++;
    }
    const peak = Math.max(...buckets);
    if (!peak) return;
    const namespace = 'http://www.w3.org/2000/svg';
    const graph = document.createElementNS(namespace, 'svg');
    graph.classList.add('ani-danmu-heat');
    graph.dataset.sn = sn;
    graph.dataset.duration = String(duration);
    graph.setAttribute('aria-hidden', 'true');
    graph.setAttribute('viewBox', '0 0 100 24');
    graph.setAttribute('preserveAspectRatio', 'none');
    const area = document.createElementNS(namespace, 'path');
    const points = [...buckets].map((count, index) =>
      `${(index + 0.5)} ${(24 - 22 * Math.sqrt(count / peak)).toFixed(2)}`);
    area.setAttribute('d', `M0 24 L${points.join(' L')} L100 24 Z`);
    graph.append(area);
    progress.prepend(graph);
  }

  function enhancePlayerControls() {
    syncDanmuHeat();
    const dlgMuteSvg = '<svg class="ani-dlg-title-icon" viewBox="0 0 576 512" fill="currentColor" aria-hidden="true"><path d="M301.1 34.8C312.6 40 320 51.4 320 64l0 384c0 12.6-7.4 24-18.9 29.2s-25 3.1-34.4-5.3L131.8 352 64 352c-35.3 0-64-28.7-64-64l0-64c0-35.3 28.7-64 64-64l67.8 0L266.7 40.1c9.4-8.4 22.9-10.4 34.4-5.3zM425 167l55 55 55-55c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-55 55 55 55c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-55-55-55 55c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l55-55-55-55c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0z"/></svg>';
    const dlgFlagSvg = '<svg class="ani-dlg-title-icon" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true"><path d="M64 32C64 14.3 49.7 0 32 0S0 14.3 0 32L0 64 0 368 0 480c0 17.7 14.3 32 32 32s32-14.3 32-32l0-128 64.3-16.1c41.1-10.3 84.6-5.5 122.5 13.4c44.2 22.1 95.5 24.8 141.7 7.4l34.7-13c12.5-4.7 20.8-16.6 20.8-30l0-247.7c0-23-24.2-38-44.8-27.7l-9.6 4.8c-46.3 23.2-100.8 23.2-147.1 0c-35.1-17.6-75.4-22-113.5-12.5L64 48l0-16z"/></svg>';
    const dlgInfoSvg = '<svg class="ani-dlg-title-icon" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336l24 0 0-64-24 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l48 0c13.3 0 24 10.7 24 24l0 88 8 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-80 0c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg>';
    for (const dlg of document.querySelectorAll('.dialogify:not([data-ani-share])')) {
      if (dlg.querySelector('#share-url-text, .ani-share-card')) continue;
      dlg.querySelectorAll('.dialogify__close').forEach((c) => { c.style.setProperty('display', 'none', 'important'); });
      const dlgTitle = dlg.querySelector('.dialogify_title');
      if (dlgTitle && !dlgTitle.dataset.aniTitleIcon) {
        dlgTitle.dataset.aniTitleIcon = 'true';
        dlgTitle.querySelectorAll('img').forEach(n => { n.style.display = 'none'; });
        const text = dlgTitle.textContent.trim();
        const iconSvg = /消音|靜音/.test(text) ? dlgMuteSvg : /檢舉/.test(text) ? dlgFlagSvg : dlgInfoSvg;
        dlgTitle.insertAdjacentHTML('afterbegin', iconSvg);
      } else if (!dlgTitle && !dlg.querySelector('.ani-dlg-title-icon')) {
        const bodyEl = dlg.querySelector('.dialogify__body');
        const msgTarget = bodyEl?.querySelector(':scope > p, :scope > div:not(.dialogify__footer):not(.btn-box)') || bodyEl;
        const txt = (msgTarget?.textContent || '').trim();
        if (msgTarget && txt) {
          const iconSvg = /檢舉/.test(txt) ? dlgFlagSvg : /消音|靜音/.test(txt) ? dlgMuteSvg : '';
          if (iconSvg) {
            msgTarget.classList.add('ani-dlg-inline-row');
            msgTarget.insertAdjacentHTML('afterbegin', iconSvg);
          }
        }
      }
    }
    const shareUrl=document.querySelector('#share-url-text');
    const shareBody=shareUrl?.closest('.dialogify__body'),shareCard=shareUrl?.closest('.dialogify__content');
    if(shareBody&&shareCard&&!shareCard.dataset.aniShare){
      shareCard.closest('.dialogify')?.classList.add('ani-share-dialog');
      shareCard.dataset.aniShare='true';shareCard.classList.add('ani-share-card');
      const video=document.querySelector('#ani_video video'),preview=document.createElement('div');preview.className='ani-share-preview';
      const header=document.createElement('div');header.className='ani-share-caption';const heading=document.createElement('h3');
      const rawShareTitle=document.querySelector('.anime_name h1')?.textContent.trim()||'分享動畫';
      heading.textContent=rawShareTitle.replace(/\s*\[(\d+(?:\.\d+)?)\]\s*$/,' EP.$1');
      const curSec=Math.floor(video?.currentTime||0),durSec=video&&Number.isFinite(video.duration)?video.duration:null;
      const time=document.createElement('button');time.type='button';time.className='ani-share-time-toggle';time.dataset.aniTip='切換包含播放時間';time.setAttribute('aria-label','切換是否包含目前播放時間');
      time.textContent=video?`${formatContinueTime(curSec)} / ${durSec!==null?formatContinueTime(durSec):'—'}`:'';
      header.append(heading);
      const shareDialogHost=shareCard.closest('dialog, .dialogify, .dialogify__window')||shareCard;
      const closeBtn=shareDialogHost.querySelector('.dialogify__close');
      const closeShareDialog=()=>{if(closeBtn)closeBtn.click();else shareCard.closest('dialog')?.close?.();};
      if(closeBtn)closeBtn.style.setProperty('display','none','important');
      if(shareDialogHost&&!shareDialogHost.dataset.aniShareDismiss){
        shareDialogHost.dataset.aniShareDismiss='true';
        shareDialogHost.addEventListener('click',ev=>{if(ev.target===shareDialogHost)closeShareDialog();});
        let sy=null;
        shareCard.addEventListener('pointerdown',ev=>{if(ev.target?.closest?.('.ani-share-caption, .ani-share-preview'))sy=ev.clientY;else sy=null;});
        shareCard.addEventListener('pointerup',ev=>{if(sy!==null&&ev.clientY-sy>64)closeShareDialog();sy=null;});
      }
      if(!shareCard.querySelector('.ani-share-close-btn')){
        const xBtn=document.createElement('button');
        xBtn.type='button';
        xBtn.className='ani-share-close-btn';
        xBtn.setAttribute('aria-label','關閉');
        xBtn.innerHTML='<svg viewBox="0 0 384 512" fill="currentColor" aria-hidden="true"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>';
        xBtn.addEventListener('click',closeShareDialog);
        shareCard.append(xBtn);
      }
      const frame=document.createElement('canvas');frame.width=video?.videoWidth||960;frame.height=video?.videoHeight||540;try{if(video?.readyState>=2)frame.getContext('2d')?.drawImage(video,0,0,frame.width,frame.height);}catch{}preview.append(frame);shareBody.prepend(header,preview);
      const bottomBar=document.createElement('div');bottomBar.className='ani-share-bottom-bar';
      const tvBadge=document.createElement('span');tvBadge.className='ani-share-tv';tvBadge.innerHTML='<svg viewBox="0 0 60 63" fill="none" aria-hidden="true"><path d="M58.7586 22.7029C58.7586 22.3924 58.5029 22.1367 58.1924 22.1367L55.6475 22.1428C56.1087 22.6086 56.3949 23.2448 56.3949 23.9434L56.646 52.4287C56.649 52.8016 56.3751 53.1197 56.0067 53.173L19.8975 58.3129L20.0679 59.9689C20.0679 60.2794 20.3236 60.5351 20.6341 60.5351L58.4755 55.3556C58.7875 55.3556 59.0417 55.1014 59.0417 54.7894L58.7586 22.7029Z" fill="#E5E5E5"/><path d="M46.288 43.6704C44.6731 44.5091 43.2987 45.5973 42.1419 46.6095C42.0993 46.6475 42.0415 46.6536 41.9913 46.6262C40.3931 45.7556 38.5499 45.0266 36.2577 44.3584C35.661 44.1849 35.0431 44.5243 34.8696 45.1194C34.6961 45.713 35.0355 46.334 35.6306 46.5075C38.0126 47.2046 39.8513 47.9565 41.4205 48.8774C41.6716 49.0235 41.9289 49.095 42.183 49.095C42.5316 49.095 42.8725 48.9595 43.1724 48.6917C44.3185 47.6628 45.7066 46.4984 47.32 45.6582C47.8694 45.3736 48.0825 44.6978 47.7964 44.1499C47.5133 43.5989 46.8375 43.3827 46.288 43.6704Z" fill="white"/><path d="M35.043 33.0356C35.043 32.1041 34.288 31.3477 33.355 31.3477H32.9258C31.9928 31.3477 31.2363 32.1041 31.2363 33.0371V37.2959C31.2363 38.2289 31.9928 38.9853 32.9258 38.9853H33.355C34.2865 38.9853 35.043 38.2304 35.043 37.2974V33.0356Z" fill="white"/><path d="M47.3746 31.0195H46.8647C46.0489 31.0195 45.3838 31.6847 45.3838 32.5005V36.6831C45.3838 37.4989 46.0489 38.1641 46.8647 38.1641H47.3746C48.1905 38.1641 48.8556 37.4989 48.8556 36.6831V32.5005C48.8541 31.6847 48.1905 31.0195 47.3746 31.0195Z" fill="white"/><path d="M12.3917 23.9616C12.4282 23.1427 12.1725 22.3939 11.6642 21.8398C11.1406 21.2706 10.4039 20.957 9.58807 20.957C8.69919 20.957 7.94729 21.3269 7.57895 21.5476L7.52264 21.5811L7.46937 21.6176L1.32939 25.7956C0.376586 26.4166 -0.131781 27.5369 0.029557 28.6662L4.19695 57.6157C4.34002 58.6142 5.00059 59.4757 5.92448 59.8775L11.5667 62.4376C12.413 62.8227 13.0614 62.9932 13.6657 62.9932C14.5241 62.9932 15.2775 62.6416 15.7859 62.0038C16.6626 60.9049 16.3521 59.5488 16.2364 59.0373C15.9457 57.3296 12.5104 26.024 12.3917 23.9616ZM13.6641 60.7557C13.4008 60.7557 13.0188 60.6401 12.4906 60.3996L6.82706 57.8304C6.60484 57.739 6.44807 57.5366 6.41306 57.2976L2.24567 28.3481C2.2061 28.0772 2.33091 27.8078 2.56378 27.6632L8.72811 23.4684C8.98533 23.3147 9.31258 23.1945 9.58807 23.1945C9.93205 23.1945 10.1969 23.3801 10.1512 23.9144C10.0858 24.6861 13.8483 58.6386 14.0523 59.5366C14.2334 60.3311 14.1679 60.7557 13.6641 60.7557Z" fill="white"/><path d="M58.6848 40.0239C58.0668 40.03 57.5645 40.5353 57.5706 41.1533L57.7639 54.7894C57.7639 55.0999 57.5082 55.3556 57.1977 55.3556L20.6334 60.5352C20.3213 60.5352 20.0672 60.281 20.0672 59.969L16.2575 22.9145C16.2575 22.604 16.5132 22.3483 16.8237 22.3483L56.9146 22.1367C57.2266 22.1367 57.4808 22.3909 57.4808 22.7029L57.6483 34.3056C57.6543 34.9205 58.1536 35.4151 58.767 35.4151H58.7776C59.3956 35.4091 59.8933 34.9037 59.8872 34.2858L59.7198 22.6847C59.7198 21.1581 58.461 19.8993 56.9146 19.8993H56.9024L34.1751 20.0196C34.1188 19.4807 34.0122 18.9617 33.8524 18.4594C39.3318 17.9313 47.5388 13.8278 47.9862 13.598L48.1171 13.5249C49.5631 12.738 49.3211 11.6711 49.0958 11.216C49.0532 11.0973 48.0441 8.28146 45.7762 5.37433C43.5479 2.51896 41.347 0.640739 41.309 0.613342C40.6058 -0.0685386 39.5784 -0.194869 38.7565 0.299799C38.6895 0.339372 38.6271 0.386556 38.5693 0.439828C37.6058 1.3348 29.5404 8.90702 27.7444 12.9892C27.2543 12.8948 26.752 12.837 26.236 12.837C25.6364 12.837 25.058 12.9207 24.4963 13.047C24.4324 13.0607 24.3731 13.0333 24.3472 12.974C22.746 9.28754 17.0215 4.22214 16.2194 3.52808C15.8465 3.26324 15.3914 3.15822 14.9393 3.23584C14.5527 3.30129 14.3808 3.45198 13.95 3.77922C13.3853 4.24953 11.5452 5.83856 10.2225 7.68481C8.54519 10.0288 8.25904 12.7883 8.23773 12.9055C8.17533 13.2236 8.03226 14.3027 8.91962 14.9252C9.7948 15.4275 12.9607 17.2022 15.8374 18.3529V18.3636C16.0428 18.4473 16.2468 18.5279 16.4477 18.604C16.5786 18.6543 16.7125 18.6771 16.845 18.6771C17.2955 18.6771 17.7217 18.4031 17.8921 17.9556C18.1113 17.3773 17.8206 16.7319 17.2422 16.5127C16.8967 16.3818 16.5329 16.2251 16.1707 16.0683C14.5056 15.3621 12.6045 14.4138 11.0201 13.5447C10.6761 13.356 10.5102 12.9679 10.6076 12.5874C10.8435 11.665 11.3275 10.0744 12.0901 8.92072C12.7993 7.84768 13.8876 6.79746 14.6258 6.14145C14.9622 5.84313 15.4614 5.83856 15.7917 6.14297C18.1174 8.2845 21.0352 11.3591 22.1052 13.426C22.2422 13.6908 22.1265 14.0059 21.8769 14.1688L21.6958 14.286C19.9834 15.4123 18.7658 17.1855 18.3807 19.3088L18.3396 19.5645L18.2879 20.1033L17.2696 20.1094C16.0489 20.1154 14.8328 20.7106 14.2894 21.8034C14.0687 22.2478 13.9805 22.7014 14.0261 23.1443L17.8282 60.1273C17.9104 61.6006 19.1357 62.7741 20.6288 62.7741C20.7338 62.7741 20.8388 62.7665 20.9423 62.7513L57.4093 57.5854C58.8552 57.4743 59.9998 56.2628 59.9998 54.7894L59.8065 41.1335C59.8035 40.5186 59.2997 40.0239 58.6848 40.0239ZM26.2376 15.0729C29.0838 15.0729 31.4354 17.1474 31.9103 19.8597C31.9255 19.948 31.854 20.0317 31.7657 20.0317L20.7034 20.0896C20.6136 20.0896 20.542 20.0074 20.5573 19.9191C21.0078 17.1764 23.37 15.0729 26.2376 15.0729ZM38.7337 3.37283C39.3699 2.7564 40.379 2.76857 41.0091 3.39109C41.8097 4.18104 42.9132 5.34542 44.0091 6.75027C45.2191 8.29973 46.0395 9.84004 46.5175 10.8644C46.7229 11.3027 46.5464 11.8172 46.1095 12.0272C43.8219 13.1216 37.1553 16.1474 33.0975 16.2677C32.9072 16.2738 32.7383 16.1779 32.6226 16.0257C32.0046 15.2144 31.2314 14.5356 30.3517 14.0105C30.0762 13.8461 29.9544 13.5021 30.1112 13.2236C31.6257 10.5448 35.9833 6.04099 38.7337 3.37283Z" fill="white"/></svg>';
      const row=document.createElement('div');row.className='ani-share-link-row';row.append(shareUrl);const copy=shareCard.querySelector('.btn-box button');
      if(copy){copy.setAttribute('aria-label','複製分享連結');copy.innerHTML='<svg viewBox="0 0 43 43" fill="none" aria-hidden="true"><path d="M11.9295 18.6399L7.13226 23.4371C5.51081 25.0585 4.59988 27.2577 4.59988 29.5508C4.59988 31.8439 5.51081 34.043 7.13226 35.6645C8.75372 37.2859 10.9529 38.1969 13.246 38.1969C15.5391 38.1969 17.7382 37.2859 19.3597 35.6645L25.4734 29.5508C26.4522 28.5729 27.1821 27.3745 27.6018 26.0561C28.0214 24.7376 28.1184 23.3378 27.8848 21.974C27.6512 20.6103 27.0937 19.3226 26.2592 18.219C25.4247 17.1154 24.3375 16.2282 23.089 15.6319L21.3976 17.3234C21.2223 17.4986 21.0715 17.6902 20.9513 17.896C21.9155 18.1729 22.7908 18.6966 23.4906 19.4154C24.1904 20.1343 24.6905 21.0233 24.9414 21.9946C25.1923 22.9659 25.1854 23.9859 24.9212 24.9537C24.6571 25.9215 24.145 26.8037 23.4355 27.5129L17.3218 33.6266C16.2408 34.7076 14.7747 35.3148 13.246 35.3148C11.7172 35.3148 10.2511 34.7076 9.17016 33.6266C8.08919 32.5456 7.48191 31.0795 7.48191 29.5508C7.48191 28.0221 8.08919 26.5559 9.17016 25.475L12.2983 22.3468C11.9764 21.1363 11.852 19.883 11.9315 18.6378L11.9295 18.6399Z" fill="currentColor"/><path d="M17.322 13.2483C16.3431 14.2262 15.6132 15.4246 15.1936 16.743C14.774 18.0615 14.6769 19.4613 14.9105 20.8251C15.1441 22.1888 15.7016 23.4765 16.5361 24.5801C17.3707 25.6837 18.4578 26.5709 19.7063 27.1672L21.944 24.9296C20.9666 24.6677 20.0755 24.1532 19.36 23.4378C18.6446 22.7223 18.1301 21.8312 17.8682 20.8538C17.6063 19.8765 17.6063 18.8475 17.8681 17.8702C18.13 16.8929 18.6445 16.0017 19.3599 15.2862L25.4736 9.17252C26.5546 8.09155 28.0207 7.48426 29.5494 7.48426C31.0781 7.48426 32.5442 8.09155 33.6252 9.17252C34.7062 10.2535 35.3135 11.7196 35.3135 13.2483C35.3135 14.777 34.7062 16.2432 33.6252 17.3241L30.497 20.4523C30.8187 21.6607 30.9425 22.9133 30.8639 24.1613L35.6631 19.362C36.466 18.5592 37.1028 17.606 37.5374 16.557C37.9719 15.508 38.1955 14.3837 38.1955 13.2483C38.1955 12.1129 37.9719 10.9886 37.5374 9.93961C37.1028 8.89061 36.466 7.93748 35.6631 7.13461C34.8603 6.33175 33.9071 5.69488 32.8581 5.26038C31.8091 4.82587 30.6848 4.60223 29.5494 4.60223C28.414 4.60223 27.2897 4.82587 26.2407 5.26038C25.1917 5.69488 24.2386 6.33175 23.4357 7.13461L17.322 13.2483Z" fill="currentColor"/></svg>';copy.addEventListener('click',()=>showAniToast('已複製分享連結'));row.append(copy);}
      const copyShot=document.createElement('button');copyShot.type='button';copyShot.className='ani-share-shot-btn';copyShot.setAttribute('aria-label','複製時間點截圖');copyShot.dataset.aniTip='複製截圖';
      copyShot.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/></svg>';
      copyShot.addEventListener('click',()=>{
        frame.toBlob(async blob=>{
          try{
            if(blob&&navigator.clipboard?.write&&typeof ClipboardItem!=='undefined'){
              await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
            }else if(blob&&navigator.clipboard?.writeText){
              await navigator.clipboard.writeText(shareUrl.value||location.href);
            }
          }catch{}
          copyShot.classList.add('is-copied');
          showAniToast('已複製截圖');
          setTimeout(()=>copyShot.classList.remove('is-copied'),1500);
        },'image/png');
      });
      bottomBar.append(tvBadge,time,row,copyShot);
      const socials=document.createElement('div');socials.className='ani-share-socials';
      const socialDefs=[
        {name:'下方留言區',vb:'0 0 512 512',action:url=>{
          closeShareDialog();
          const box=document.querySelector('#w-post-box .input-article-content, #w-post-box .reply-input, .commendlist-wrapper textarea, #BH_background .animate-theme-list textarea');
          if(box){
            box.scrollIntoView({behavior:'smooth',block:'center'});
            box.focus();
            if(box.isContentEditable){
              const next=(box.textContent?.trim()?`${box.textContent.trimEnd()}\n`:'')+url;
              box.textContent=next;
            }else{
              box.value=(box.value?`${box.value.trimEnd()}\n`:'')+url;
            }
            box.dispatchEvent(new Event('input',{bubbles:true}));
            box.dispatchEvent(new Event('change',{bubbles:true}));
          }else{
            navigator.clipboard?.writeText(url).catch(()=>{});
            document.querySelector('#w-post-box, #BH_background .animate-theme-list')?.scrollIntoView({behavior:'smooth',block:'start'});
          }
        },path:'<path fill="currentColor" d="M512 240c0 114.9-114.6 208-256 208c-37.1 0-72.3-6.4-104.1-17.9c-11.9 8.7-31.3 20.6-54.3 30.6C73.6 471.1 44.7 480 16 480c-6.5 0-12.3-3.9-14.8-9.9c-2.5-6-1.1-12.8 3.4-17.4c0 0 0 0 0 0s0 0 0 0s0 0 0 0c0 0 0 0 0 0l.3-.3c.3-.3 .7-.7 1.3-1.4c1.1-1.2 2.8-3.1 4.9-5.7c4.1-5 9.6-12.4 15.2-21.6c10-16.6 19.5-38.4 21.4-62.9C17.7 326.8 0 285.1 0 240C0 125.1 114.6 32 256 32s256 93.1 256 208zM128 272a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm128 0a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm160-32a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"/>'},
        {name:'巴哈酒館',vb:'0 0 512 512',href:()=>'https://wall.gamer.com.tw/',copyFirst:true,path:'<path fill="currentColor" d="M32 64c0-17.7 14.3-32 32-32l288 0c17.7 0 32 14.3 32 32l0 32 32 0c53 0 96 43 96 96l0 96c0 53-43 96-96 96l-32 0 0 16c0 44.2-35.8 80-80 80l-192 0c-44.2 0-80-35.8-80-80L32 64zm352 96l0 160 32 0c17.7 0 32-14.3 32-32l0-96c0-17.7-14.3-32-32-32l-32 0zM128 160c-8.8 0-16 7.2-16 16l0 192c0 8.8 7.2 16 16 16s16-7.2 16-16l0-192c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16l0 192c0 8.8 7.2 16 16 16s16-7.2 16-16l0-192c0-8.8-7.2-16-16-16z"/>'},
        {name:'Threads',vb:'0 0 448 512',href:u=>`https://www.threads.net/intent/post?text=${encodeURIComponent(u)}`,path:'<path fill="currentColor" d="M331.5 235.7c2.2 .9 4.2 1.9 6.3 2.8c29.2 14.1 50.6 35.2 61.8 61.4c15.7 36.5 17.2 95.8-30.3 143.2c-36.2 36.2-80.3 52.5-142.6 53h-.3c-70.2-.5-124.1-24.1-160.4-70.2c-32.3-41-48.9-98.1-49.5-169.6V256v-.2C17 184.3 33.6 127.2 65.9 86.2C102.2 40.1 156.2 16.5 226.4 16h.3c70.3 .5 124.9 24 162.3 69.9c18.4 22.7 32 50 40.6 81.7l-40.4 10.8c-7.1-25.8-17.8-47.8-32.2-65.4c-29.2-35.8-73-54.2-130.5-54.6c-57 .5-100.1 18.8-128.2 54.4C72.1 146.1 58.5 194.3 58 256c.5 61.7 14.1 109.9 40.3 143.3c28 35.6 71.2 53.9 128.2 54.4c51.4-.4 85.4-12.6 113.7-40.9c32.3-32.2 31.7-71.8 21.4-95.9c-6.1-14.2-17.1-26-31.9-34.9c-3.7 26.9-11.8 48.3-24.7 64.8c-17.1 21.8-41.4 33.6-72.7 35.3c-23.6 1.3-46.3-4.4-63.9-16c-20.8-13.8-33-34.8-34.3-59.3c-2.5-48.3 35.7-83 95.2-86.4c21.1-1.2 40.9-.3 59.2 2.8c-2.4-14.8-7.3-26.6-14.6-35.2c-10-11.7-25.6-17.7-46.2-17.8H227c-16.6 0-39 4.6-53.3 26.3l-34.4-23.6c19.2-29.1 50.3-45.1 87.8-45.1h.8c62.6 .4 99.9 39.5 103.7 107.7l-.2 .2zm-156 68.8c1.3 25.1 28.4 36.8 54.6 35.3c25.6-1.4 54.6-11.4 59.5-73.2c-13.2-2.9-27.8-4.4-43.4-4.4c-4.8 0-9.6 .1-14.4 .4c-42.9 2.4-57.2 23.2-56.2 41.8l-.1 .1z"/>'},
        {name:'Discord',vb:'0 0 640 512',href:()=>'https://discord.com/channels/@me',copyFirst:true,path:'<path fill="currentColor" d="M524.5 69.8a1.5 1.5 0 0 0 -.8-.7A485.1 485.1 0 0 0 404.1 32a1.8 1.8 0 0 0 -1.9 .9 337.5 337.5 0 0 0 -14.9 30.6 447.8 447.8 0 0 0 -134.4 0 309.5 309.5 0 0 0 -15.1-30.6 1.9 1.9 0 0 0 -1.9-.9A483.7 483.7 0 0 0 116.1 69.1a1.7 1.7 0 0 0 -.8 .7C39.1 183.7 18.2 294.7 28.4 404.4a2 2 0 0 0 .8 1.4A487.7 487.7 0 0 0 176 479.9a1.9 1.9 0 0 0 2.1-.7A348.2 348.2 0 0 0 208.1 430.4a1.9 1.9 0 0 0 -1-2.6 321.2 321.2 0 0 1 -45.9-21.9 1.9 1.9 0 0 1 -.2-3.1c3.1-2.3 6.2-4.7 9.1-7.1a1.8 1.8 0 0 1 1.9-.3c96.2 43.9 200.4 43.9 295.5 0a1.8 1.8 0 0 1 1.9 .2c2.9 2.4 6 4.9 9.1 7.2a1.9 1.9 0 0 1 -.2 3.1 301.4 301.4 0 0 1 -45.9 21.8 1.9 1.9 0 0 0 -1 2.6 391.1 391.1 0 0 0 30 48.8 1.9 1.9 0 0 0 2.1 .7A486 486 0 0 0 610.7 405.7a1.9 1.9 0 0 0 .8-1.4C623.7 277.6 590.9 167.5 524.5 69.8zM222.5 337.6c-29 0-52.8-26.6-52.8-59.2S193.1 219.1 222.5 219.1c29.7 0 53.3 26.8 52.8 59.2C275.3 311 251.9 337.6 222.5 337.6zm195.4 0c-29 0-52.8-26.6-52.8-59.2S388.4 219.1 417.9 219.1c29.7 0 53.3 26.8 52.8 59.2C470.7 311 447.5 337.6 417.9 337.6z"/>'},
        {name:'LINE',vb:'0 0 24 24',href:u=>`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(u)}`,path:'<path fill="currentColor" d="M12 2.5C6.2 2.5 1.5 6.4 1.5 11.2c0 4.3 3.8 7.9 9 8.6.4.1.8.3.9.6.1.3.1.8 0 1.2l-.3 1.4c-.1.4.3.7.7.5 3.1-1.6 6.8-4.5 9.1-7.4 1-1.3 1.6-2.9 1.6-4.9C22.5 6.4 17.8 2.5 12 2.5Z"/><text x="12" y="13.8" text-anchor="middle" fill="#162232" font-family="system-ui,sans-serif" font-size="6.4" font-weight="900" letter-spacing="-0.2">LINE</text>'},
        {name:'Telegram',vb:'0 0 496 512',href:u=>`https://t.me/share/url?url=${encodeURIComponent(u)}`,path:'<path fill="currentColor" d="M248 8C111 8 0 119 0 256S111 504 248 504 496 393 496 256 385 8 248 8zM363 176.7c-3.7 39.2-19.9 134.4-28.1 178.3-3.5 18.6-10.3 24.8-16.9 25.4-14.4 1.3-25.3-9.5-39.3-18.7-21.8-14.3-34.2-23.2-55.3-37.2-24.5-16.1-8.6-25 5.3-39.5 3.7-3.8 67.1-61.5 68.3-66.7 .2-.7 .3-3.1-1.2-4.4s-3.6-.8-5.1-.5q-3.3 .7-104.6 69.1-14.8 10.2-26.9 9.9c-8.9-.2-25.9-5-38.6-9.1-15.5-5-27.9-7.7-26.8-16.3q.8-6.7 18.5-13.7 108.4-47.2 144.6-62.3c68.9-28.6 83.2-33.6 92.5-33.8 2.1 0 6.6 .5 9.6 2.9a10.5 10.5 0 0 1 3.5 6.7A43.8 43.8 0 0 1 363 176.7z"/>'},
        {name:'Messenger',vb:'0 0 512 512',href:u=>`https://www.facebook.com/dialog/send?link=${encodeURIComponent(u)}`,path:'<path fill="currentColor" d="M256.6 8C116.5 8 8 110.3 8 248.6c0 72.3 29.7 134.8 78.1 177.9 8.4 7.5 6.6 11.9 8.1 58.2A19.9 19.9 0 0 0 122 502.3c52.9-23.3 53.6-25.1 62.6-22.7C337.9 521.8 504 423.7 504 248.6 504 110.3 396.6 8 256.6 8zm149.2 185.1l-73 115.6a37.4 37.4 0 0 1 -53.9 9.9l-58.1-43.5a15 15 0 0 0 -18 0l-78.4 59.4c-10.5 7.9-24.2-4.6-17.1-15.7l73-115.6a37.4 37.4 0 0 1 53.9-9.9l58.1 43.5a15 15 0 0 0 18 0l78.4-59.4c10.4-8 24.1 4.5 17.1 15.7z"/>'},
        {name:'Facebook',vb:'0 0 320 512',href:u=>`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,path:'<path fill="currentColor" d="M80 299.3V512H196V299.3h86.5l18-97.8H196V166.9c0-51.7 20.3-71.5 72.7-71.5c16.3 0 29.4 .4 37 1.2V7.9C291.4 4 256.4 0 236.2 0C129.3 0 80 50.5 80 159.4v42.1H14v97.8H80z"/>'}
      ];
      for(const s of socialDefs){const a=document.createElement('a');a.className='ani-share-social-btn';a.href='#';a.setAttribute('aria-label',s.name);a.dataset.aniTip=s.name;a.innerHTML=`<svg viewBox="${s.vb}" aria-hidden="true">${s.path}</svg>`;a.addEventListener('click',e=>{e.preventDefault();const url=shareUrl.value||location.href;if(s.action){s.action(url);return;}if(s.copyFirst)navigator.clipboard?.writeText(url).catch(()=>{});window.open(s.href(url),'_blank','noopener,noreferrer');});socials.append(a);}
      bottomBar.append(socials);
      const checkTc=shareBody.querySelector('.check_timecode input[type="checkbox"], input.check_timecode, #check-timecode')||shareBody.querySelector('input[type="checkbox"]');
      const tcTrigger=checkTc?.closest('label, .check_timecode')||checkTc;
      const syncTimeToggle=()=>{const on=Boolean(checkTc?.checked);time.classList.toggle('is-active',on);time.setAttribute('aria-pressed',String(on));time.dataset.aniTip=on?'已包含播放時間':'點擊包含播放時間';};
      if(checkTc){
        time.addEventListener('click',()=>{if(tcTrigger!==checkTc)tcTrigger.click();else{checkTc.click();}syncTimeToggle();});
        checkTc.addEventListener('change',syncTimeToggle);
        syncTimeToggle();
      }
      const timeRow=document.createElement('div');timeRow.className='ani-share-time-row';for(const control of [...shareBody.querySelectorAll(':scope > .check_timecode,:scope > .label_timecode')])timeRow.append(control);
      shareBody.append(bottomBar,timeRow);
    }
    const volumePanel=document.querySelector('#ani_video .vjs-volume-panel');
    const volumeVideo=document.querySelector('#ani_video video');
    if(volumePanel&&volumeVideo&&!volumePanel.dataset.aniHorizontal){
      volumePanel.dataset.aniHorizontal='true';const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.step='1';slider.className='ani-volume-slider';slider.setAttribute('aria-label','音量');
      const syncVolume=()=>{
        const effVol=volumeVideo.muted?0:volumeVideo.volume;
        const pct=Math.round(effVol*100);
        slider.value=String(pct);
        slider.style.setProperty('--ani-range-pct',`${pct}%`);
        const lvl=pct<=0?'0':pct<34?'1':pct<68?'2':'3';
        const muteBtn=volumePanel.querySelector('.vjs-mute-control');
        if(muteBtn){
          muteBtn.dataset.aniVol=lvl;
          muteBtn.classList.remove('vjs-vol-0','vjs-vol-1','vjs-vol-2','vjs-vol-3');
          muteBtn.classList.add(`vjs-vol-${lvl}`);
        }
      };
      syncVolume();volumeVideo.addEventListener('volumechange',syncVolume);
      slider.addEventListener('input',()=>{const val=Number(slider.value);volumeVideo.volume=val/100;volumeVideo.muted=val===0;syncVolume();});
      volumePanel.addEventListener('wheel',event=>{event.preventDefault();const delta=event.deltaY<0?0.05:-0.05;const next=Math.max(0,Math.min(1,(volumeVideo.muted&&delta>0?0:volumeVideo.volume)+delta));if(delta>0&&volumeVideo.muted)volumeVideo.muted=false;volumeVideo.volume=next;if(next<=0)volumeVideo.muted=true;syncVolume();},{passive:false});
      volumePanel.append(slider);
    }
    const svg = (body, cls = '') => `<svg class="ani-player-glyph ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
    for (const send of document.querySelectorAll('#ani_video .danmu-send_btn:not([data-ani-send])')) {
      send.dataset.aniSend = 'true';
      send.setAttribute('aria-label', '發送彈幕');
      send.textContent = '';
      send.insertAdjacentHTML('afterbegin', svg('<path fill="currentColor" stroke="none" d="m3 3 19 9-19 9 3-8 10-1-10-1Z"/>', 'ani-send-glyph'));
    }
    const icons = {
      '.vjs-play-control': svg('<path fill="currentColor" stroke="none" d="M7 4v16l14-8Z"/>', 'ani-glyph-play') + svg('<path fill="currentColor" stroke="none" d="M6 4h4v16H6zm8 0h4v16h-4Z"/>', 'ani-glyph-pause'),
      '.vjs-pre-button': svg('<path fill="currentColor" stroke="none" d="M5 4h3v16H5zm15 0L8 12l12 8Z"/>'),
      '.vjs-next-button': svg('<path fill="currentColor" stroke="none" d="M16 4h3v16h-3zM4 4v16l12-8Z"/>'),
      '.vjs-mute-control': svg('<path fill="currentColor" stroke="none" d="M3 9v6h4l6 5V4L7 9Z"/><path class="ani-volume-waves" d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path class="ani-volume-muted" d="m16 9 5 6m0-6-5 6"/>'),
      '.vjs-fullscreen-control': svg('<path fill="currentColor" stroke="none" d="M3 3h7v3H6v4H3zm11 0h7v7h-3V6h-4zM3 14h3v4h4v3H3zm15 0h3v7h-7v-3h4Z"/>'),
      '.vjs-indent-button': svg('<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm1 3v8h14V7Z"/>'),
      '.plus_picture_in_picture_icon': '<svg class="ani-player-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><rect x="11.5" y="10.5" width="7" height="5.5" rx="1.2" fill="currentColor" stroke="none"/></svg>',
    };
    Object.assign(icons,{".vjs-play-control": "<svg class=\"ani-player-glyph ani-glyph-play\" viewBox=\"0 0 24 24\" fill=\"currentColor\" stroke=\"none\" aria-hidden=\"true\">\n  <path fill-rule=\"evenodd\" d=\"M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z\" clip-rule=\"evenodd\"/>\n</svg>\n<svg class=\"ani-player-glyph ani-glyph-pause\" viewBox=\"0 0 24 24\" fill=\"currentColor\" stroke=\"none\" aria-hidden=\"true\">\n  <path fill-rule=\"evenodd\" d=\"M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z\" clip-rule=\"evenodd\"/>\n</svg>\n", ".vjs-pre-button": "<svg class=\"ani-player-glyph\" viewBox=\"0 0 24 24\" fill=\"currentColor\" stroke=\"none\" aria-hidden=\"true\">\n  <path d=\"M9.195 18.44c1.25.714 2.805-.189 2.805-1.629v-2.34l6.945 3.968c1.25.715 2.805-.188 2.805-1.628V8.69c0-1.44-1.555-2.343-2.805-1.628L12 11.029v-2.34c0-1.44-1.555-2.343-2.805-1.628l-7.108 4.061c-1.26.72-1.26 2.536 0 3.256l7.108 4.061Z\"/>\n</svg>\n", ".vjs-next-button": "<svg class=\"ani-player-glyph\" viewBox=\"0 0 24 24\" fill=\"currentColor\" stroke=\"none\" aria-hidden=\"true\">\n  <path d=\"M5.055 7.06C3.805 6.347 2.25 7.25 2.25 8.69v8.122c0 1.44 1.555 2.343 2.805 1.628L12 14.471v2.34c0 1.44 1.555 2.343 2.805 1.628l7.108-4.061c1.26-.72 1.26-2.536 0-3.256l-7.108-4.061C13.555 6.346 12 7.249 12 8.689v2.34L5.055 7.061Z\"/>\n</svg>\n", ".vjs-mute-control": "<svg class=\"ani-player-glyph ani-speaker-on\" viewBox=\"0 0 24 24\" fill=\"currentColor\" stroke=\"none\" aria-hidden=\"true\">\n  <path d=\"M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06Z\"/>\n  <path d=\"M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z\"/>\n  <path d=\"M18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z\"/>\n</svg>\n<svg class=\"ani-player-glyph ani-speaker-off\" viewBox=\"0 0 24 24\" fill=\"currentColor\" stroke=\"none\" aria-hidden=\"true\">\n  <path d=\"M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM17.78 9.22a.75.75 0 1 0-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 1 0 1.06-1.06L20.56 12l1.72-1.72a.75.75 0 1 0-1.06-1.06l-1.72 1.72-1.72-1.72Z\"/>\n</svg>\n", ".vjs-indent-button": "<svg class=\"ani-player-glyph\" viewBox=\"0 0 24 24\" fill=\"currentColor\" stroke=\"none\" aria-hidden=\"true\">\n  <path fill-rule=\"evenodd\" d=\"M1.5 7.125c0-1.036.84-1.875 1.875-1.875h6c1.036 0 1.875.84 1.875 1.875v3.75c0 1.036-.84 1.875-1.875 1.875h-6A1.875 1.875 0 0 1 1.5 10.875v-3.75Zm12 1.5c0-1.036.84-1.875 1.875-1.875h5.25c1.035 0 1.875.84 1.875 1.875v8.25c0 1.035-.84 1.875-1.875 1.875h-5.25a1.875 1.875 0 0 1-1.875-1.875v-8.25ZM3 16.125c0-1.036.84-1.875 1.875-1.875h5.25c1.036 0 1.875.84 1.875 1.875v2.25c0 1.035-.84 1.875-1.875 1.875h-5.25A1.875 1.875 0 0 1 3 18.375v-2.25Z\" clip-rule=\"evenodd\"/>\n</svg>\n", ".plus_picture_in_picture_icon": "<svg class=\"ani-player-glyph\" viewBox=\"0 0 24 24\" fill=\"currentColor\" stroke=\"none\" aria-hidden=\"true\">\n  <path fill-rule=\"evenodd\" d=\"M2.25 6a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V6Zm18 3H3.75v9a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V9Zm-15-3.75A.75.75 0 0 0 4.5 6v.008c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75V6a.75.75 0 0 0-.75-.75H5.25Zm1.5.75a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V6Zm3-.75A.75.75 0 0 0 9 6v.008c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75V6a.75.75 0 0 0-.75-.75H9.75Z\" clip-rule=\"evenodd\"/>\n</svg>\n", ".vjs-fullscreen-control": "<svg class=\"ani-player-glyph\" viewBox=\"0 0 24 24\" fill=\"currentColor\" stroke=\"none\" aria-hidden=\"true\">\n  <path fill-rule=\"evenodd\" d=\"M15 3.75a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V5.56l-3.97 3.97a.75.75 0 1 1-1.06-1.06l3.97-3.97h-2.69a.75.75 0 0 1-.75-.75Zm-12 0A.75.75 0 0 1 3.75 3h4.5a.75.75 0 0 1 0 1.5H5.56l3.97 3.97a.75.75 0 0 1-1.06 1.06L4.5 5.56v2.69a.75.75 0 0 1-1.5 0v-4.5Zm11.47 11.78a.75.75 0 1 1 1.06-1.06l3.97 3.97v-2.69a.75.75 0 0 1 1.5 0v4.5a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1 0-1.5h2.69l-3.97-3.97Zm-4.94-1.06a.75.75 0 0 1 0 1.06L5.56 19.5h2.69a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 1 1.5 0v2.69l3.97-3.97a.75.75 0 0 1 1.06 0Z\" clip-rule=\"evenodd\"/>\n</svg>\n"});
    icons['.plus_picture_in_picture_icon']='<svg class="ani-player-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><rect x="11.5" y="10.5" width="7" height="5.5" rx="1.2" fill="currentColor" stroke="none"/></svg>';
    icons['.vjs-indent-button']='<svg class="ani-player-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="13" rx="2.2"/><path d="M6.5 9.5h11v5h-11z" fill="currentColor" fill-opacity="0.25" stroke="none"/></svg>';
    const danmuPane = document.querySelector('.subtitle #ani-tab-content-1');
    if (danmuPane && !danmuPane.dataset.aniCountObserved) {
      danmuPane.dataset.aniCountObserved = 'true';
      const tipSelector = '.anime-tip, .danmu-tip, .sub-list-tip';
      const styleCounts = () => {
        for (const tip of danmuPane.querySelectorAll(tipSelector)) {
          const counts = tip.querySelector(':scope > div');
          if (!counts || !counts.textContent.trim()) continue;
          tip.classList.add('ani-danmu-count-box');
          // Plus replaces the contents of .anime-tip > div after filtering.
          counts.classList.add('ani-danmu-count-lines');
          counts.classList.toggle('ani-plus-danmu-count', /動畫瘋[·.]Plus\s*已過濾/.test(counts.textContent));
          for (const icon of counts.querySelectorAll('i, svg, img, .material-icons, .material-icons-round, .qa-icon')) {
            if (!icon.closest('.is-hint, button')) icon.classList.add('ani-danmu-hidden-info');
          }
          if (!tip.querySelector(':scope > .ani-danmu-count-icon')) {
            tip.insertAdjacentHTML('afterbegin', '<svg class="ani-danmu-count-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="3.2"/><path d="M6.5 9.5h5M13.5 9.5h4M6.5 14h3.5M12 14h5.5"/></svg>');
          }
        }
      };
      const observer = new MutationObserver(records => {
        if (records.some(({ target, addedNodes }) =>
          (target.parentElement?.closest(tipSelector) || target.closest?.(tipSelector)) ||
          [...addedNodes].some(node => node.matches?.(tipSelector) || node.querySelector?.(tipSelector))
        )) styleCounts();
      });
      styleCounts();
      observer.observe(danmuPane, { childList: true, characterData: true, subtree: true });
    }
    const toggle=document.querySelector('#danmuToggle');
    if(toggle&&!toggle.dataset.aniStateBound){
      toggle.dataset.aniStateBound='true';
      const sync=()=>{
        const toggleBtn=toggle.querySelector('button')||toggle;
        const hint=toggleBtn.title||toggleBtn.getAttribute('data-ani-tip')||toggleBtn.getAttribute('aria-label')||toggle.title||toggle.getAttribute('data-ani-tip')||'';
        const on=/關閉彈幕/.test(hint);
        toggle.setAttribute('aria-pressed',String(on));
      };
      const dismissDanmuMenu=()=>{
        toggle.dataset.aniMenuDismissed='true';
        toggle.classList.remove('vjs-lock-showing','vjs-hover','open');
        const m=toggle.querySelector(':scope > .vjs-menu');
        if(m)m.classList.remove('vjs-lock-showing','open');
        if(document.activeElement&&toggle.contains(document.activeElement)&&typeof document.activeElement.blur==='function'){
          document.activeElement.blur();
        }
      };
      const allowDanmuHover=()=>{
        delete toggle.dataset.aniMenuDismissed;
      };
      toggle.addEventListener('pointerenter',allowDanmuHover);
      toggle.addEventListener('mouseenter',allowDanmuHover);
      toggle.addEventListener('pointerleave',()=>{
        dismissDanmuMenu();
        delete toggle.dataset.aniMenuDismissed;
      });
      toggle.addEventListener('mouseleave',()=>{
        dismissDanmuMenu();
        delete toggle.dataset.aniMenuDismissed;
      });
      toggle.addEventListener('click',(ev)=>{
        if(!ev.target?.closest?.('.vjs-menu'))dismissDanmuMenu();
        setTimeout(sync,40);
      });
      if(!window.__aniDanmuDocDismissBound){
        window.__aniDanmuDocDismissBound=true;
        document.addEventListener('pointerdown',(ev)=>{
          const dt=document.querySelector('#danmuToggle');
          if(!dt||dt.contains(ev.target))return;
          dt.dataset.aniMenuDismissed='true';
          dt.classList.remove('vjs-lock-showing','vjs-hover','open');
          const m=dt.querySelector(':scope > .vjs-menu');
          if(m)m.classList.remove('vjs-lock-showing','open');
          if(document.activeElement&&dt.contains(document.activeElement)&&typeof document.activeElement.blur==='function'){
            document.activeElement.blur();
          }
        },true);
      }
      new MutationObserver(sync).observe(toggle,{attributes:true,subtree:true,attributeFilter:['title','data-ani-tip','aria-label','class']});
      sync();
    }
    
      const aniInfoBox = document.querySelector('#BH_background #ani-info');
      const aniInfoMsg = aniInfoBox?.querySelector('#ani-info-msg');
      if (
        aniInfoBox &&
        aniInfoMsg &&
        /無法取得資料|查無資料|搜尋失敗/.test(aniInfoMsg.textContent || '') &&
        !aniInfoBox.dataset.aniInfoRescued &&
        typeof chrome !== 'undefined' &&
        chrome.runtime?.sendMessage
      ) {
        aniInfoBox.dataset.aniInfoRescued = 'pending';
        const acgLinkEl =
          document.querySelector('section.data a[href*="acgDetail.php"]') ||
          document.querySelector('#BH_background a[href*="acgDetail.php"]');
        const acgUrl = acgLinkEl?.href || '';
        const rawH1 = (document.querySelector('.anime-title .anime_name h1')?.textContent || '').trim();
        chrome.runtime.sendMessage(
          { type: 'ani-fetch-infoplus', acgUrl, fallbackTitle: rawH1 },
          (resp) => {
            const results = resp?.results;
            if (!Array.isArray(results) || !results.length) {
              aniInfoBox.dataset.aniInfoRescued = 'failed';
              return;
            }
            aniInfoBox.dataset.aniInfoRescued = 'done';
            const savedEpisodes = aniInfoBox.querySelector('.ani-sidebar-episodes');
            aniInfoBox.innerHTML = '<div class="ani-info-tabs"></div><div class="ani-info-content"></div>';
            const tabContainer = aniInfoBox.querySelector('.ani-info-tabs');
            const contentContainer = aniInfoBox.querySelector('.ani-info-content');
            const renderPane = (pane, data) => {
              const castHtml =
                data.cast && data.cast.length
                  ? data.cast
                      .map((j) => {
                        const linkPart = j.wikiUrl
                          ? `<a href="${j.wikiUrl}" target="_blank" rel="noopener noreferrer"><svg class="ani-wiki-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l.564.031c.485.029.727.164.727.436 0 .135-.053.33-.166.601 1.082 2.646 4.818 10.521 4.818 10.521l.136.046 2.411-4.81-.482-1.067-1.658-3.264s-.318-.654-.428-.872c-.728-1.443-.712-1.518-1.447-1.617-.207-.023-.313-.05-.313-.149v-.468l.06-.045h4.292l.113.037v.451c0 .105-.076.15-.227.15l-.308.047c-.792.061-.661.381-.136 1.422l1.582 3.252 1.758-3.504c.293-.64.233-.801-.416-.872-.231-.027-.346-.063-.346-.184v-.434l.044-.053h4.294l.06.045v.434c0 .119-.089.176-.268.176l-.657.031c-.629.051-.846.235-1.262 1.007-1.06 1.981-2.094 4.027-2.094 4.027l2.536 5.261 4.212-9.512c.259-.61.186-.86-.508-.903l-.671-.031c-.163 0-.244-.046-.244-.15v-.451l.06-.053 4.041.008.045.045v.434c0 .119-.067.176-.202.176l-.491.031c-.792.049-1.158.299-1.564 1.196-.93 2.025-3.953 8.859-5.059 11.494-.39.873-.905 1.029-1.48.03-.758-1.387-1.751-3.361-2.345-4.576l-.189-.39-2.587 4.961c-.616 1.106-1.127.959-1.532.029z"/></svg></a>`
                          : '<div></div>';
                        return `<div>${j.char || ''}</div><div>${j.cv || ''}</div>${linkPart}`;
                      })
                      .join('')
                  : '';
              const songHtml =
                data.song && data.song.length
                  ? data.song
                      .map((j) => {
                        const cleanSong = (j.title || '').replace(/^[「『]|[」』]$/g, '');
                        const q = encodeURIComponent(`${cleanSong} ${j.singer || ''}`.trim());
                        return `<div>${j.type || '主題曲'}${j.title || ''}</div><div>${j.singer || '-'}</div><a href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener noreferrer" aria-label="在 YouTube 搜尋" title="在 YouTube 搜尋"><svg class="ani-yt-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3.01 3.01 0 0 0-2.12-2.13C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.52A3.01 3.01 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3.01 3.01 0 0 0 2.12 2.13c1.88.52 9.38.52 9.38.52s7.5 0 9.38-.52a3.01 3.01 0 0 0 2.12-2.13A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z"/></svg></a>`;
                      })
                      .join('')
                  : '';
              let html = '';
              html += castHtml
                ? `<ul class="data_type"><li><span class="ani-infoplus-badge">CAST</span><div class="grid cast">${castHtml}</div></li></ul>`
                : '<ul class="data_type"><li><span class="ani-infoplus-badge">CAST</span>(無資料)</li></ul>';
              html += songHtml
                ? `<ul class="data_type"><li><span class="ani-infoplus-badge">主題曲</span><div class="grid song">${songHtml}</div></li></ul>`
                : '<ul class="data_type"><li><span class="ani-infoplus-badge">主題曲</span>(無資料)</li></ul>';
              html += `<ul class="data_type"><li><span class="ani-infoplus-badge">aniInfo+</span>資料來源：<a href="${data.source}" target="_blank" rel="noopener noreferrer">${data.title}</a></li></ul>`;
              pane.innerHTML = html;
              pane.dataset.loaded = 'true';
            };
            results.forEach((r, idx) => {
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'ani-tab-btn' + (idx === 0 ? ' active' : '');
              btn.textContent = r.title || `Part ${idx + 1}`;
              const pane = document.createElement('div');
              pane.className = 'ani-tab-pane' + (idx === 0 ? ' active' : '');
              pane.id = `ani-part-${idx}`;
              btn.addEventListener('click', () => {
                for (const b of tabContainer.querySelectorAll('.ani-tab-btn')) b.classList.remove('active');
                for (const p of contentContainer.querySelectorAll('.ani-tab-pane')) p.classList.remove('active');
                btn.classList.add('active');
                pane.classList.add('active');
                if (!pane.dataset.loaded) renderPane(pane, r);
              });
              tabContainer.append(btn);
              contentContainer.append(pane);
              if (idx === 0) renderPane(pane, r);
            });
            if (savedEpisodes) aniInfoBox.append(savedEpisodes);
            setTimeout(enhancePlayerControls, 0);
          },
        );
      }

    
    const iconifyInfoLinks = (root) => {
      if (!root) return;
      for (const pill of root.querySelectorAll('.data_type li > span')) {
        if (pill.querySelector('.ani-info-pill-svg')) continue;
        const t = (pill.textContent || '').trim();
        if (/^CAST$/i.test(t) || /^聲優$/.test(t)) {
          pill.classList.add('ani-infoplus-badge');
          pill.textContent = '聲優';
          pill.insertAdjacentHTML('afterbegin', '<svg class="ani-info-pill-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a1 1 0 1 0-2 0 3 3 0 0 1-6 0 1 1 0 1 0-2 0 5 5 0 0 0 4 4.9V19H8.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2H13v-3.1A5 5 0 0 0 17 11Z"/></svg>');
        } else if (/主題曲/.test(t)) {
          pill.classList.add('ani-infoplus-badge');
          pill.textContent = '主題曲';
          pill.insertAdjacentHTML('afterbegin', '<svg class="ani-info-pill-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z"/></svg>');
        } else if (/^aniInfo\+$/i.test(t)) {
          pill.classList.add('ani-infoplus-badge');
          pill.insertAdjacentHTML('afterbegin', '<svg class="ani-info-pill-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z"/></svg>');
        }
      }
      for (const a of root.querySelectorAll('a[href*="wikipedia.org"]')) {
        if (!a.querySelector('.ani-wiki-svg') || /[🔗]|\bWiki/i.test(a.textContent || '')) {
          a.classList.add('ani-wiki-link');
          const cleanLabel = (a.title || a.textContent || '').replace(/[🔗🔎]/g, '').trim() || 'Wikipedia';
          a.title = cleanLabel;
          a.setAttribute('aria-label', cleanLabel);
          a.innerHTML = '<svg class="ani-wiki-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l.564.031c.485.029.727.164.727.436 0 .135-.053.33-.166.601 1.082 2.646 4.818 10.521 4.818 10.521l.136.046 2.411-4.81-.482-1.067-1.658-3.264s-.318-.654-.428-.872c-.728-1.443-.712-1.518-1.447-1.617-.207-.023-.313-.05-.313-.149v-.468l.06-.045h4.292l.113.037v.451c0 .105-.076.15-.227.15l-.308.047c-.792.061-.661.381-.136 1.422l1.582 3.252 1.758-3.504c.293-.64.233-.801-.416-.872-.231-.027-.346-.063-.346-.184v-.434l.044-.053h4.294l.06.045v.434c0 .119-.089.176-.268.176l-.657.031c-.629.051-.846.235-1.262 1.007-1.06 1.981-2.094 4.027-2.094 4.027l2.536 5.261 4.212-9.512c.259-.61.186-.86-.508-.903l-.671-.031c-.163 0-.244-.046-.244-.15v-.451l.06-.053 4.041.008.045.045v.434c0 .119-.067.176-.202.176l-.491.031c-.792.049-1.158.299-1.564 1.196-.93 2.025-3.953 8.859-5.059 11.494-.39.873-.905 1.029-1.48.03-.758-1.387-1.751-3.361-2.345-4.576l-.189-.39-2.587 4.961c-.616 1.106-1.127.959-1.532.029z"/></svg>';
        }
      }
      for (const a of root.querySelectorAll('a[href*="youtube.com"]')) {
        if (!a.querySelector('.ani-yt-svg') || (a.textContent || '').trim().length > 0) {
          a.classList.add('ani-yt-link');
          a.title = a.title || '在 YouTube 搜尋';
          a.setAttribute('aria-label', '在 YouTube 搜尋');
          a.innerHTML = '<svg class="ani-yt-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3.01 3.01 0 0 0-2.12-2.13C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.52A3.01 3.01 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3.01 3.01 0 0 0 2.12 2.13c1.88.52 9.38.52 9.38.52s7.5 0 9.38-.52a3.01 3.01 0 0 0 2.12-2.13A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z"/></svg>';
        }
      }
    };
    window.__aniIconifyInfoLinks = iconifyInfoLinks;
    iconifyInfoLinks(document.querySelector('#BH_background #ani-info'));
    iconifyInfoLinks(document.querySelector('#ani-tab-content-intro'));

    for(const badge of document.querySelectorAll('#BH_background span, #BH_background div, #BH_background a, #BH_background button')){
      if(!badge.children.length&&/^\s*aniInfo\+\s*$/i.test(badge.textContent||'')){
        badge.classList.add('ani-infoplus-badge');
      }
    }
    for(const option of document.querySelectorAll('.danmusetting_area .danmusize-btn > div')){const labels=['A','A+','A++'];const value=Number(option.dataset.value);if(labels[value]){option.textContent=labels[value];option.setAttribute('aria-label',['小字','標準字','大字'][value]);}}
    const sizeWrap=document.querySelector('.danmusetting_area .danmusize-send');
    const sizeGroup=sizeWrap?.querySelector('.danmusize-btn');
    if(sizeWrap&&sizeGroup&&!sizeWrap.dataset.aniSizeSlider){
      sizeWrap.dataset.aniSizeSlider='true';
      const opts=[...sizeGroup.querySelectorAll(':scope > div[data-value]')];
      if(opts.length===3){
        const wrap=document.createElement('section');
        wrap.className='ani-size-slider-box';
        wrap.innerHTML=`<div class="ani-size-slider-labels"><span>小</span><span>標準</span><span>大</span></div><div class="ani-size-slider-row"><svg class="ani-size-icon ani-size-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 8h12M12 8v9M9.5 17h5"/></svg><input type="range" class="ani-size-range" min="0" max="2" step="1" aria-label="文字大小"><svg class="ani-size-icon ani-size-icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M12 6v13M8 19h8"/></svg></div>`;
        const range=wrap.querySelector('.ani-size-range');
        const syncFromDOM=()=>{const activeIdx=Math.max(0,opts.findIndex(o=>o.classList.contains('active')));range.value=String(activeIdx);range.style.setProperty('--ani-range-pct',`${activeIdx*50}%`);};
        range.addEventListener('input',()=>{const idx=Math.max(0,Math.min(2,Number(range.value||0)));range.style.setProperty('--ani-range-pct',`${idx*50}%`);const target=opts.find(o=>Number(o.dataset.value)===idx)||opts[idx];if(target&&!target.classList.contains('active'))target.click();});
        for(const o of opts)new MutationObserver(syncFromDOM).observe(o,{attributes:true,attributeFilter:['class']});
        syncFromDOM();
        sizeGroup.after(wrap);
      }
    }
    const danmuHeadingIcons={"circle-half-stroke": "<svg class=\"ani-player-glyph ani-menu-heading-icon\" fill=\"currentColor\" stroke=\"none\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><path d=\"M448 256c0-106-86-192-192-192l0 384c106 0 192-86 192-192zM0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256z\"/></svg>", "text-height": "<svg class=\"ani-player-glyph ani-menu-heading-icon\" fill=\"currentColor\" stroke=\"none\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 576 512\"><path d=\"M64 128l0-32 64 0 0 320-32 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l128 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-32 0 0-320 64 0 0 32c0 17.7 14.3 32 32 32s32-14.3 32-32l0-48c0-26.5-21.5-48-48-48L160 32 48 32C21.5 32 0 53.5 0 80l0 48c0 17.7 14.3 32 32 32s32-14.3 32-32zM502.6 41.4c-12.5-12.5-32.8-12.5-45.3 0l-64 64c-9.2 9.2-11.9 22.9-6.9 34.9s16.6 19.8 29.6 19.8l32 0 0 192-32 0c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l64 64c12.5 12.5 32.8 12.5 45.3 0l64-64c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8l-32 0 0-192 32 0c12.9 0 24.6-7.8 29.6-19.8s2.2-25.7-6.9-34.9l-64-64z\"/></svg>", "palette": "<svg class=\"ani-player-glyph ani-menu-heading-icon\" fill=\"currentColor\" stroke=\"none\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><path d=\"M512 256c0 .9 0 1.8 0 2.7c-.4 36.5-33.6 61.3-70.1 61.3L344 320c-26.5 0-48 21.5-48 48c0 3.4 .4 6.7 1 9.9c2.1 10.2 6.5 20 10.8 29.9c6.1 13.8 12.1 27.5 12.1 42c0 31.8-21.6 60.7-53.4 62c-3.5 .1-7 .2-10.6 .2C114.6 512 0 397.4 0 256S114.6 0 256 0S512 114.6 512 256zM128 288a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm0-96a32 32 0 1 0 0-64 32 32 0 1 0 0 64zM288 96a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm96 96a32 32 0 1 0 0-64 32 32 0 1 0 0 64z\"/></svg>", "rectangle-list": "<svg class=\"ani-player-glyph ani-menu-heading-icon\" fill=\"currentColor\" stroke=\"none\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 576 512\"><path d=\"M0 96C0 60.7 28.7 32 64 32l448 0c35.3 0 64 28.7 64 64l0 320c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64L0 96zM128 288a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm32-128a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zM128 384a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm96-248c-13.3 0-24 10.7-24 24s10.7 24 24 24l224 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-224 0zm0 96c-13.3 0-24 10.7-24 24s10.7 24 24 24l224 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-224 0zm0 96c-13.3 0-24 10.7-24 24s10.7 24 24 24l224 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-224 0z\"/></svg>"};
    for(const heading of document.querySelectorAll('#danmuToggle .vjs-menu-item > p,.danmusetting_area .title')){
      const text=heading.textContent,key=text.includes('透明')?'circle-half-stroke':text.includes('大小')?'text-height':text.includes('顏色')?'palette':'rectangle-list';
      if(!heading.querySelector('[data-ani-fa]')){heading.querySelectorAll('svg').forEach(n=>n.remove());heading.insertAdjacentHTML('afterbegin',danmuHeadingIcons[key].replace('<svg ','<svg data-ani-fa="true" '));}
    }
    const typeButton=document.querySelector('.danmu-setting_btn');if(typeButton)typeButton.setAttribute('aria-label','彈幕樣式設定');
    const danmuArea=document.querySelector('#ani_video .danmutext_area');
    if(danmuArea){
      for(const ch of danmuArea.children){
        if(!ch.matches('.danmu-setting_btn,.danmu-text,.danmu-send_btn'))ch.style.setProperty('display','none','important');
      }
    }
    const controlBar=document.querySelector('#ani_video .vjs-control-bar');
    controlBar?.querySelectorAll('.ani-player-brand').forEach(logo=>logo.remove());
    const playerEl=document.querySelector('#ani_video');
    if(playerEl){
      const existingAmbient=playerEl.querySelector('.ani-ambientlight-toggle');
      const rightCtrl=controlBar?.querySelector('.control-bar-rightbtn');
      if(existingAmbient&&rightCtrl&&existingAmbient.parentElement!==rightCtrl){
        rightCtrl.prepend(existingAmbient);
      }
      const titleH1=document.querySelector('.anime-title .anime_name h1');
      if(titleH1){
        titleH1.classList.remove('ani-title-source');
        if(titleH1.nextElementSibling?.classList?.contains('ani-title-display'))titleH1.nextElementSibling.remove();
        for(const tag of titleH1.querySelectorAll('.ani-ep-tag')){tag.replaceWith(document.createTextNode(tag.textContent||''));}
        titleH1.normalize();
        const raw=titleH1.textContent||'';
        if(/\[\s*\d+(?:\.\d+)?\s*\]\s*$/.test(raw)){
          titleH1.dataset.aniDisplayTitle=raw.trim().replace(/\s*\[\s*(\d+(?:\.\d+)?)\s*\]\s*$/,' EP.$1');
        }else{
          delete titleH1.dataset.aniDisplayTitle;
        }
      }
      const infoDetail=document.querySelector('.anime-title .anime_info_detail');
      if(infoDetail){
        for(const p of infoDetail.querySelectorAll('p, span, div')){
          if(/上架(?:時間|日期)/.test(p.textContent||'')&&![...p.children].some(c=>/上架(?:時間|日期)/.test(c.textContent||''))&&!p.querySelector('.ani-info-clock')){
            const walk=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);
            let tn;while((tn=walk.nextNode())){
              if(/上架(?:時間|日期)/.test(tn.textContent)){
                tn.textContent=tn.textContent.replace(/上架(?:時間|日期)\s*[：:]?\s*/,'');
              }
            }
            p.classList.add('ani-info-upload-time');
            p.insertAdjacentHTML('afterbegin','<svg class="ani-info-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/></svg>');
            break;
          }
        }
        for(const item of infoDetail.children){
          if(item.classList.contains('ani-info-upload-time')||item.querySelector('.ani-info-clock'))continue;
          const txt=(item.textContent||'').trim();
          if(!txt)continue;
          const isCounting=/統計中/.test(txt);
          item.classList.toggle('ani-info-counting',isCounting);
          item.classList.toggle('ani-info-views',!isCounting);
        }
      }
      const rawTitleText=titleH1?.textContent.trim();
      const animeTitleText=rawTitleText?.replace(/(?:\s*\[[^\]]+\])+\s*$/, '');
      if(animeTitleText&&!playerEl.querySelector('.ani-fs-title')){
        const fsTitle=document.createElement('div');
        fsTitle.className='ani-fs-title';
        fsTitle.textContent=animeTitleText;
        playerEl.append(fsTitle);
      }
      const animeName=document.querySelector('.anime-title .anime_name');
      const animeTitleRoot=document.querySelector('.anime-title');
      const shareBtn=playerEl.querySelector('.top-tool-bar .share-button');
      const shortcutBtn=playerEl.querySelector('.top-tool-bar .shortcut-button');
      const bgmtv=document.querySelector('#bgmtv')||[...document.querySelectorAll('#BH_background a, #BH_background button')].find(el=>!el.matches('.ani-bgm-search') && /^\s*點格子\s*$/.test(el.textContent||''));
      const linkPool=[...document.querySelectorAll('#BH_background a')].filter(a=>!a.closest('.ani-title-actions,.mainmenu,footer,#ani_video'));
      const infoLink=document.querySelector('section.data a[href*="acgDetail.php"], .anime-option a[href*="acgDetail.php"]')||linkPool.find(a=>/acg\.gamer\.com\.tw\/acgDetail\.php/i.test(a.href||''))||linkPool.find(a=>/作品資料/.test(a.textContent||''));
      const forumLink=linkPool.find(a=>/哈啦[板版]/.test(a.textContent||'')||/forum\.gamer\.com\.tw\/B\.php/i.test(a.href||''));
      if(animeName&&(shareBtn||shortcutBtn||bgmtv||infoLink||forumLink)){
        let actions=animeName.querySelector('.ani-title-actions');
        if(!actions){
          actions=document.createElement('div');
          actions.className='ani-title-actions';
          const favBtn=animeName.querySelector(':scope > button');
          if(favBtn){favBtn.before(actions);actions.append(favBtn);}else{animeName.append(actions);}
        }
        let searchLink = actions.querySelector('.ani-bgm-search');
        if (!bgmtv && rawTitleText && !searchLink) {
          searchLink = document.createElement('a');
          searchLink.className = 'ani-title-pill-link ani-bgm-search';
          searchLink.href = 'https://bgm.tv/subject_search/' + encodeURIComponent(rawTitleText.replace(/\s*\[[^\]]+\]\s*$/, '')) + '?cat=2';
          searchLink.target = '_blank';
          searchLink.rel = 'noopener noreferrer';
          searchLink.innerHTML = '<svg class="ani-bgm-icon" width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3l2.5 3M16 3l-2.5 3" stroke="#f09199" stroke-width="2" stroke-linecap="round"/><rect x="3" y="6" width="18" height="14" rx="4" fill="#f09199"/><rect x="5.5" y="8.5" width="13" height="9" rx="2" fill="#ffffff"/><path d="M8.5 11.5h2M13.5 11.5h2M10 14.5h4" stroke="#f09199" stroke-width="1.6" stroke-linecap="round"/></svg>點格子';
          actions.append(searchLink);
        }
        if(bgmtv && bgmtv !== searchLink){
          searchLink?.remove();
          const bgmLink=bgmtv.querySelector('a')||bgmtv;
          if(bgmLink&&!bgmLink.querySelector('.ani-bgm-icon')){
            const iconImg=document.createElement('img');
            iconImg.className='ani-bgm-icon';
            iconImg.src='https://bgm.tv/img/favicon.ico';
            iconImg.alt='';
            iconImg.setAttribute('aria-hidden','true');
            iconImg.addEventListener('error',()=>{
              iconImg.outerHTML='<svg class="ani-bgm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3l2.5 3M16 3l-2.5 3" stroke="#f09199" stroke-width="2" stroke-linecap="round"/><rect x="3" y="6" width="18" height="14" rx="4" fill="#f09199"/><rect x="5.5" y="8.5" width="13" height="9" rx="2" fill="#ffffff"/><path d="M8.5 11.5h2M13.5 11.5h2M10 14.5h4" stroke="#f09199" stroke-width="1.6" stroke-linecap="round"/></svg>';
            },{once:true});
            bgmLink.prepend(iconImg);
          }
          if(!bgmtv.closest('.ani-title-actions'))actions.append(bgmtv);
        }
        const bgmNode=actions.querySelector('#bgmtv, .ani-bgm-search');
        for(const [link,iconSvg,cls] of [
          [infoLink,'<svg class="ani-title-pill-icon" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true"><path d="M96 0C43 0 0 43 0 96L0 416c0 53 43 96 96 96l288 0 32 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l0-64c17.7 0 32-14.3 32-32l0-320c0-17.7-14.3-32-32-32L384 0 96 0zm0 384l256 0 0 64L96 448c-17.7 0-32-14.3-32-32s14.3-32 32-32zm32-240c0-8.8 7.2-16 16-16l192 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-192 0c-8.8 0-16-7.2-16-16zm16 48l192 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-192 0c-8.8 0-16-7.2-16-16s7.2-16 16-16z"/></svg>','ani-title-pill-info'],
          [forumLink,'<svg class="ani-title-pill-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-5.2L12 21.8 9.2 18H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/></svg>','ani-title-pill-forum']
        ]){
          if(link&&!actions.querySelector('.'+cls)){
            const pill=document.createElement('a');
            pill.className='ani-title-pill-link '+cls;
            pill.href=link.href;
            if(link.target)pill.target=link.target;
            if(link.rel)pill.rel=link.rel;
            pill.insertAdjacentHTML('beforeend',iconSvg);
            pill.append(document.createTextNode(cls==='ani-title-pill-info'?'作品資料':'哈啦板'));
            if(bgmNode)bgmNode.before(pill);else actions.append(pill);
          }
        }
        if(shareBtn){
          if(!shareBtn.closest('.ani-title-actions'))actions.append(shareBtn);
          if(!shareBtn.querySelector('.ani-share-pill-label')){
            shareBtn.insertAdjacentHTML('beforeend','<span class="ani-share-pill-label">分享</span>');
          }
        }
      const plusBarForShortcut = document.querySelector('.plus_imagetool_box');
      if (shortcutBtn) {
        if (plusBarForShortcut && !shortcutBtn.closest('.plus_imagetool_box')) {
          plusBarForShortcut.append(shortcutBtn);
          shortcutBtn.classList.add('ani-shortcut-in-toolbar');
        } else if (!plusBarForShortcut && !shortcutBtn.closest('.ani-title-actions')) {
          actions.prepend(shortcutBtn);
        }
        if(!shortcutBtn.dataset.aniShortcutModal){
            shortcutBtn.dataset.aniShortcutModal='true';
            shortcutBtn.setAttribute('role','button');
            shortcutBtn.setAttribute('tabindex','0');
            shortcutBtn.setAttribute('aria-label','鍵盤快捷鍵');
            if(!shortcutBtn.querySelector('.ani-shortcut-btn-glyph')){
              shortcutBtn.querySelectorAll(':scope > img, :scope > .material-icons-round, :scope > i').forEach(n=>{n.style.display='none';});
              shortcutBtn.insertAdjacentHTML('afterbegin','<svg class="ani-shortcut-btn-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6"/></svg><span class="ani-shortcut-label">鍵盤快捷鍵</span>');
            }
            const openShortcutModal=(e)=>{
              e.preventDefault();e.stopPropagation();
              let modal=document.querySelector('#ani-shortcut-modal');
              if(!modal){
                modal=document.createElement('dialog');modal.id='ani-shortcut-modal';modal.className='ani-shortcut-modal';
                modal.setAttribute('aria-label','鍵盤快捷鍵');
                const cap=document.createElement('div');cap.className='ani-shortcut-caption';
                const h=document.createElement('h3');h.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6"/></svg><span>鍵盤快捷鍵</span>';
                const close=document.createElement('button');close.type='button';close.className='ani-shortcut-close';close.setAttribute('aria-label','關閉');
                close.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
                close.addEventListener('click',()=>modal.close());
                cap.append(h,close);
                const body=document.createElement('div');body.className='ani-shortcut-body';
                const sourcePanel=shortcutBtn.querySelector('.shortcut-panel-inner, .shortcut-panel');
                const items=sourcePanel?[...sourcePanel.querySelectorAll('li, .shortcut-item, tr, p, div')].filter(el=>!el.querySelector('li, .shortcut-item, tr, p, div')&&el.textContent.trim()&&!/^鍵盤快捷鍵$/.test(el.textContent.trim())):[];
                if(items.length){
                  for(const item of items){
                    const row=document.createElement('div');row.className='ani-shortcut-row';
                    row.innerHTML=item.innerHTML;
                    body.append(row);
                  }
                }else{
                  const fallback=[['播放 / 暫停','空白鍵'],['靜音 / 取消靜音','M'],['調整音量','↑ / ↓'],['快轉 / 倒轉','→ / ←'],['開啟 / 關閉全螢幕','F'],['開啟 / 關閉彈幕','D'],['劇場模式','T']];
                  for(const [label,key] of fallback){
                    const row=document.createElement('div');row.className='ani-shortcut-row';
                    row.innerHTML=`<span>${label}</span><kbd>${key}</kbd>`;
                    body.append(row);
                  }
                }
                modal.append(cap,body);
                modal.addEventListener('click',ev=>{if(ev.target===modal)modal.close();});
                document.body.append(modal);
              }
              if(!modal.open)modal.showModal();
            };
            shortcutBtn.addEventListener('click',openShortcutModal);
            shortcutBtn.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' ')openShortcutModal(ev);});
          }
      }
      }
      syncLastWatchedEpisodes();
      const isQrOrDownloadBox = (node) => {
        if (!node) return false;
        if (/掃描|QR\s*code|App\s*Store|Google\s*Play|前往動畫瘋APP|立即下載/i.test(node.textContent || '')) return true;
        if (node.matches('.app-download-toolbox, .btn-app-download, [class*="qrcode" i], [class*="download" i]') || node.querySelector('img, canvas, .app-download-toolbox, a.apple, a[href*="apple"], a[href*="play.google"]')) return true;
        const rect = node.getBoundingClientRect();
        return rect.height > 110;
      };
      for (const existingPill of document.querySelectorAll('.ani-skip-intro-pill')) {
        if (!existingPill.querySelector('.ani-skip-close')) styleSkipIntroPill(existingPill);
      }
      const skipScope = playerEl.closest('.videoframe') || playerEl;
      for (const skipEl of skipScope.querySelectorAll('a,button,div,span,p')) {
        if (skipEl.closest('.vjs-control-bar,.ani-age-screen,.ani-skip-intro-pill,.top-tool-bar,.ani-fs-title,.plus_imagetool_box,.ani-ambientlight-toggle,.ani-player-episodes-drawer,.app-download-toolbox')) continue;
        if (skipEl.matches('#ani_video,.video-js,.videoframe,.video,#video-container') || isQrOrDownloadBox(skipEl)) continue;
        const txt = (skipEl.textContent || '').replace(/\s+/g, '');
        if (!/(?:按此)?(?:跳過|略過)(?:片頭|片尾|OP|ED)/.test(txt) || txt.length > 36) continue;
        if ([...skipEl.children].some(c => /(?:按此)?(?:跳過|略過)(?:片頭|片尾|OP|ED)/.test((c.textContent || '').replace(/\s+/g, '')))) continue;
        let box = skipEl;
        while (
          box.parentElement &&
          box.parentElement !== skipScope &&
          box.parentElement !== playerEl &&
          !box.parentElement.matches('#ani_video,.video-js,.videoframe,.video,#video-container,.vjs-control-bar') &&
          box.parentElement.children.length <= 3 &&
          (box.parentElement.textContent || '').replace(/\s+/g, '').length <= 36 &&
          !isQrOrDownloadBox(box.parentElement)
        ) {
          box = box.parentElement;
        }
        styleSkipIntroPill(box);
      }
      for(const wm of playerEl.querySelectorAll('a[href*="ani.gamer"],.vjs-watermark,.vjs-logo,.vjs-ani-logo,.ani-logo,[class*="watermark" i],[class*="brand" i],[class*="logo" i]:not(.ani-player-glyph):not(.vjs-control),img[src*="logo" i]')){
        if(wm.dataset.aniWatermarkPlaced||wm.closest('.vjs-poster,.ani-age-screen'))continue;
        wm.dataset.aniWatermarkPlaced='true';
        wm.classList.add('ani-player-watermark');
        if(wm.closest('.vjs-control-bar'))playerEl.append(wm);
      }
    }
    for (const [selector, markup] of Object.entries(icons)) {
      for (const button of document.querySelectorAll(`#ani_video ${selector}`)) {
        if (button.querySelector(':scope > .ani-player-glyph, :scope > .vjs-icon-placeholder > .ani-player-glyph, :scope > button > .vjs-icon-placeholder > .ani-player-glyph')) continue;
        const placeholder = button.querySelector(':scope > .vjs-icon-placeholder, :scope > button > .vjs-icon-placeholder') || button.querySelector(':scope > button') || button;
        placeholder.insertAdjacentHTML('beforeend', markup);
        button.classList.add('ani-player-icon-button');
      }
    }
    for (const resLabel of document.querySelectorAll('#ani_video .vjs-res-button .vjs-menu-item .vjs-menu-item-text, #ani_video .vjs-res-button > button > .vjs-control-text')) {
      if (/^\s*auto\s*$/i.test(resLabel.textContent || '')) resLabel.textContent = '自動';
    }
    const plusToolBox = document.querySelector('.plus_imagetool_box');
    if (plusToolBox && !plusToolBox.dataset.aniToolCollapsedInit) {
      plusToolBox.dataset.aniToolCollapsedInit = 'true';
      let hidden = false;
      try { hidden = localStorage.getItem('aniHidePlusTools') === '1'; } catch {}
      plusToolBox.classList.toggle('ani-tools-collapsed', hidden);
      const toggleTools = document.createElement('button');
      toggleTools.type = 'button';
      toggleTools.className = 'ani-tools-toggle-btn';
      const syncToolToggle = () => {
        const isCollapsed = plusToolBox.classList.contains('ani-tools-collapsed');
        const label = isCollapsed ? '顯示工具列' : '隱藏工具列';
        toggleTools.setAttribute('aria-label', label);
        toggleTools.title = label;
        toggleTools.setAttribute('aria-expanded', String(!isCollapsed));
        toggleTools.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/></svg>'
          + `<span class="ani-tools-toggle-label">${isCollapsed ? '顯示工具欄' : '隱藏工具欄'}</span>`;
      };
      toggleTools.addEventListener('click', () => {
        const next = !plusToolBox.classList.contains('ani-tools-collapsed');
        plusToolBox.classList.toggle('ani-tools-collapsed', next);
        try { localStorage.setItem('aniHidePlusTools', next ? '1' : '0'); } catch {}
        syncToolToggle();
      });
      syncToolToggle();
      plusToolBox.prepend(toggleTools);
    }
    if (plusToolBox) {
      const floatingShortcut = document.querySelector('.shortcut-button');
      if (floatingShortcut && !floatingShortcut.closest('.plus_imagetool_box')) {
        plusToolBox.append(floatingShortcut);
        floatingShortcut.classList.add('ani-shortcut-in-toolbar');
      }
    }
    for (const box of document.querySelectorAll('.plus_imagetool_box .plus_button_box')) {
      for (const child of box.children) {
        if (!child.matches('.plus_button, input, label')) {
          child.style.setProperty('display', 'none', 'important');
        }
      }
      const headerBtn = box.querySelector(':scope > .plus_button[button-type="text"]');
      if (headerBtn && !box.dataset.aniPresetBound) {
        box.dataset.aniPresetBound = 'true';
        const headerText = headerBtn.textContent || '';
        const storeKey = /解析度/.test(headerText) ? 'aniPlusRecRes' : /格式/.test(headerText) ? 'aniPlusRecFormat' : '';
        const priority = /格式/.test(headerText) ? /^mp4$/i : /720p/i;
        const labels = [...box.querySelectorAll(':scope > label.plus_button')];
        const firstLbl = labels.find(l => priority.test(l.textContent.trim()));
        if (firstLbl) {
          const firstInput = firstLbl.control || (firstLbl.htmlFor ? box.querySelector(`#${CSS.escape(firstLbl.htmlFor)}`) : null) || firstLbl.previousElementSibling;
          if (firstInput?.matches?.('input')) headerBtn.after(firstInput, firstLbl);
          else headerBtn.after(firstLbl);
        }
        if (storeKey) {
          let saved = '';
          try { saved = localStorage.getItem(storeKey) || ''; } catch {}
          if (!saved && storeKey === 'aniPlusRecFormat') saved = 'MP4';
          if (saved) {
            const matchLbl = labels.find(l => l.textContent.trim().toUpperCase() === saved.toUpperCase());
            const matchInput = matchLbl ? (matchLbl.control || (matchLbl.htmlFor ? box.querySelector(`#${CSS.escape(matchLbl.htmlFor)}`) : null) || matchLbl.previousElementSibling) : null;
            if (matchLbl && matchInput && !matchInput.checked) {
              setTimeout(() => { if (matchLbl.isConnected && !matchInput.checked) matchLbl.click(); }, 0);
            }
          }
          box.addEventListener('change', (ev) => {
            const inp = ev.target;
            if (!inp?.matches?.('input[type="radio"]')) return;
            const lbl = inp.labels?.[0] || (inp.id ? box.querySelector(`label[for="${CSS.escape(inp.id)}"]`) : null) || inp.nextElementSibling;
            const val = lbl?.textContent?.trim();
            if (val) { try { localStorage.setItem(storeKey, val); } catch {} }
          });
        }
      }
    }
    for (const textBtn of document.querySelectorAll('.plus_imagetool_box .plus_button[button-type="text"]')) {
      for (const node of [...textBtn.childNodes]) {
        if (node.nodeType === 3) {
          node.textContent = node.textContent.replace(/[：:]\s*$/, '').trim();
        }
      }
      if (!textBtn.querySelector('.ani-tool-glyph')) {
        const label = textBtn.textContent.trim();
        const path = /解析度/.test(label)
          ? '<line x1="4" y1="8" x2="20" y2="8"/><circle cx="9" cy="8" r="2" fill="currentColor"/><line x1="4" y1="16" x2="20" y2="16"/><circle cx="15" cy="16" r="2" fill="currentColor"/>'
          : '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 8h4M3 12h18M3 16h4M17 8h4M17 16h4"/>';
        textBtn.insertAdjacentHTML('afterbegin', svg(path, 'ani-tool-glyph'));
      }
      if (!textBtn.querySelector('.ani-tool-hover-label')) {
        for (const n of [...textBtn.childNodes]) {
          if (n.nodeType === 3 && n.textContent.trim()) {
            const span = document.createElement('span');
            span.className = 'ani-tool-hover-label';
            span.textContent = n.textContent.trim();
            n.replaceWith(span);
          }
        }
        textBtn.closest('.plus_button_box')?.classList.add('ani-tool-hover-pill');
      }
    }
    for (const tool of document.querySelectorAll('.plus_imagetool_box .plus_button:not([button-type="text"]):not(label):not(.ani-plus-capture-btn)')) {
      const label = tool.textContent.trim();
      if (/圖像融合|映像重構/.test(label)) tool.classList.add('ani-tool-fixed-icon');
      if (!tool.dataset.aniCleaned) {
        tool.dataset.aniCleaned = 'true';
        if (/圖像融合/.test(label)) {
          tool.title = '圖像融合：加入本機圖片、貼圖與圖形疊加到畫面中';
        } else if (/映像重構/.test(label)) {
          tool.title = '映像重構：開啟 AniGamer Plus 映像重構編輯面板';
        } else if (label && !tool.title) {
          tool.title = label;
        }
      }
      tool.style.setProperty('background-image', 'none', 'important');
      for (const extra of tool.querySelectorAll('svg:not(.ani-tool-glyph), img, [class*="beta" i], [class*="help" i], [class*="info" i], [class*="tip" i], [class*="material" i], i')) {
        extra.style.setProperty('display', 'none', 'important');
      }
      for (const el of tool.querySelectorAll('*')) {
        if (el.classList.contains('ani-tool-glyph') || el.closest('.ani-tool-glyph')) continue;
        el.style.setProperty('background-image', 'none', 'important');
        const txt = (el.textContent || '').trim();
        if (!el.children.length && (!txt || /^(?:BETA|help(?:_outline)?|info(?:_outline)?|\?)$/i.test(txt))) {
          el.style.setProperty('display', 'none', 'important');
        }
      }
      for (const node of [...tool.childNodes]) {
        if (node.nodeType === 3) {
          const cleaned = node.textContent
            .replace(/\s*按\s*[a-zA-Z]\s*鍵/g, '')
            .replace(/\/停止/g, '')
            .replace(/\bBETA\b/gi, '')
            .replace(/\s{2,}/g, ' ');
          if (node.textContent !== cleaned) node.textContent = cleaned;
        }
      }
      if (!tool.querySelector('.ani-tool-glyph')) {
        const cleanLabel = tool.textContent.trim();
        const path = /下載/.test(cleanLabel)
          ? '<path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>'
          : /錄影/.test(cleanLabel)
          ? '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>'
          : /封面/.test(cleanLabel)
            ? '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5-4 4-2-2-7 7"/>'
            : /截圖/.test(cleanLabel)
              ? '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="m8 6 2-3h4l2 3"/><circle cx="12" cy="13" r="4"/>'
              : /圖像融合/.test(cleanLabel)
                ? '<rect x="3" y="3" width="11" height="11" rx="2"/><rect x="10" y="10" width="11" height="11" rx="2"/>'
                : '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>';
        tool.insertAdjacentHTML('afterbegin', svg(path, 'ani-tool-glyph'));
      }
      if (!tool.querySelector('.ani-tool-hover-label')) {
        for (const n of [...tool.childNodes]) {
          if (n.nodeType === 3 && n.textContent.trim()) {
            const span = document.createElement('span');
            span.className = 'ani-tool-hover-label';
            span.textContent = n.textContent.trim();
            n.replaceWith(span);
          } else if (n.nodeType === 1 && !n.classList.contains('ani-tool-glyph') && (n.textContent || '').trim() && getComputedStyle(n).display !== 'none') {
            n.classList.add('ani-tool-hover-label');
          }
        }
        tool.closest('.plus_button_box')?.classList.add('ani-tool-hover-pill');
      }
    }
    const captureRoots = [...new Set([
      ...document.querySelectorAll('#BH_background .image_tool'),
      plusToolBox?.parentElement,
    ].filter(Boolean))];
    const legacyCapture = document.querySelector('#BH_background .but_ct');
    if (legacyCapture && !legacyCapture.dataset.aniCaptureOrigin && legacyCapture.parentElement?.querySelector('#ct_output')) {
      legacyCapture.parentElement.classList.add('ani-standalone-capture');
      legacyCapture.dataset.aniCaptureOrigin = 'true';
      legacyCapture.classList.add('ani-standalone-capture-trigger');
    }
    const captureToolbar = plusToolBox || document.querySelector('.ani-drawer-toggles');
    if (legacyCapture?.dataset.aniCaptureOrigin && captureToolbar && !captureToolbar.contains(legacyCapture)) {
      legacyCapture.parentElement.classList.add('ani-capture-moved');
      captureToolbar.append(legacyCapture);
      legacyCapture.title = '截圖（F8）';
    }
    for (const root of captureRoots) {
      if (!root.matches('.image_tool') || root.contains(plusToolBox)) continue;
      const trigger = [...root.querySelectorAll('button, a, input[type="button"]')]
        .find(el => /^(?:截圖|擷圖|螢幕截圖)$/.test((el.value || el.textContent).trim()));
      if (!trigger) continue;
      root.classList.add('ani-standalone-capture');
      trigger.classList.add('ani-standalone-capture-trigger');
    }
    const captureIcons = [
      { re: /播放|預覽|play|preview/i, path: '<polygon points="7 5 19 12 7 19 7 5" fill="currentColor" stroke="none"/>' },
      { re: /下載|儲存|保存|save|download/i, path: '<path d="M12 4v11m0 0-4-4m4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>' },
      { re: /複製|copy/i, path: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' },
      { re: /刪除|移除|delete|remove|trash/i, path: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>', isDelete: true },
    ];
    for (const scope of captureRoots) {
      for (const box of scope.querySelectorAll('div, ul, nav')) {
        if (box.closest('#ani_video, .plus_button_box, .ani-watch-tools, .anime-title, .subtitle, .ani-plus-dark-drawer, .data_acgbox, #acg_review, section.data, .ACG-box, .acg-score-user')) continue;
        const btns = [...box.children].filter(el => el.nodeType === 1 && !el.matches('img, video, canvas'));
        if (btns.length !== 4) continue;
        const card = box.parentElement;
        if (!card) continue;
        const hasMedia = Boolean(card.querySelector('img, video, canvas'));
        const hasCapText = /第\s*\d+(?:\.\d+)?\s*集\s*\d+\s*[:：]\s*\d+/.test(card.textContent || '');
        if (!hasCapText) continue;
        box.classList.add('ani-plus-capture-actions');
        btns.forEach((btn, idx) => {
          btn.classList.add('ani-plus-capture-btn');
          btn.style.setProperty('background-image', 'none', 'important');
          const hint = `${btn.title || ''} ${btn.getAttribute('aria-label') || ''} ${btn.className || ''} ${btn.textContent || ''}`;
          const matched = captureIcons.find(item => item.re.test(hint)) || captureIcons[idx];
          if (matched?.isDelete) btn.classList.add('is-delete');
          for (const child of [...btn.childNodes]) {
            if (child.nodeType === 3 && /SVGSVGElement/i.test(child.nodeValue || '')) {
              child.remove();
            }
          }
          for (const oldIcon of btn.querySelectorAll('svg:not(.ani-capture-glyph), i, img, span')) {
            oldIcon.style.setProperty('display', 'none', 'important');
          }
          let glyph = btn.querySelector('.ani-capture-glyph');
          if (!glyph) {
            const created = svg(matched.path, 'ani-tool-glyph ani-capture-glyph');
            if (typeof created === 'string') {
              btn.insertAdjacentHTML('afterbegin', created);
              glyph = btn.querySelector('.ani-capture-glyph');
            } else if (created) {
              btn.prepend(created);
              glyph = created;
            }
          }
          if (glyph) {
            glyph.classList.add('ani-tool-glyph', 'ani-capture-glyph');
            glyph.style.setProperty('display', 'block', 'important');
            glyph.style.setProperty('visibility', 'visible', 'important');
            glyph.style.setProperty('opacity', '1', 'important');
          }
        });
      }
    }
    if (plusToolBox && !plusToolBox.dataset.aniDrawerClickBound) {
      plusToolBox.dataset.aniDrawerClickBound = 'true';
      plusToolBox.addEventListener('click', () => {
        setTimeout(enhancePlayerControls, 80);
        setTimeout(enhancePlayerControls, 300);
      });
    }
    for (const el of document.querySelectorAll('body div, body section, body aside, body dialog')) {
      if (el.id === 'BH_background' || el.classList.contains('ani-plus-dark-drawer') || el.closest('.ani-plus-dark-drawer, #ani_video, .plus_imagetool_box, #BH_menu')) continue;
      const txt = el.textContent || '';
      const hasContent = /目前沒有可用素材|加入本機圖片|請先加入本機圖片|請選擇.*素材|加入圖片或影片/.test(txt);
      const isHeadingPanel = /^(?:圖像融合|映像重構)/.test(txt.trim()) && getComputedStyle(el).position === 'fixed' && el.getBoundingClientRect().height > 200;
      if (!hasContent && !isHeadingPanel) continue;
      if (el.querySelector('#ani_video, .plus_imagetool_box, #BH_menu')) continue;
      let root = el;
      while (root.parentElement && root.parentElement !== document.body && root.parentElement.id !== 'BH_background' && !root.parentElement.querySelector('#ani_video, .plus_imagetool_box, #BH_menu')) {
        const cs = getComputedStyle(root);
        if (cs.position === 'fixed') break;
        root = root.parentElement;
      }
      root.classList.add('ani-plus-dark-drawer');
    }
    for (const el of document.querySelectorAll('#ani_video div, .videoframe div, body > div, body > section, body > aside, #BH_background div, :fullscreen :is(div, section, aside, [role="status"])')) {
      if (el.id === 'BH_background' || el.id === 'ani_video' || el.id === 'ani-copy-toast' || el.closest('.ani-bgm-toast, .ani-plus-dark-drawer, .ani-player-settings-drawer, .ani-settings-panel, .ani-view-settings-panel, .ani-perm-history-shell, .ani-enh-toast')) continue;
      if (el.closest('.history, .user-watch-list, .user-watchTime-list') ||
          el.querySelector('#ani_video, video, .videoframe, .user-watchTime-list')) continue;
      const rawTxt = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!rawTxt || rawTxt.length > 90) continue;
      if (!/觀看[記紀]錄/.test(rawTxt)) continue;
      if (el.closest('[role="tablist"]') || el.querySelector('[role="tablist"]')) continue;
      if (el.closest('.vjs-control-bar') && !/^(?:[✓✔✅]\s*)?(?:已)?儲存觀看[記紀]錄/.test(rawTxt)) continue;
      const csToast = getComputedStyle(el);
      const isOuterColoredBox =
        parseFloat(csToast.borderTopWidth || '0') > 0 ||
        (csToast.backgroundColor && !/rgba?\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/i.test(csToast.backgroundColor)) ||
        /fixed|absolute/i.test(csToast.position || '');
      if (!isOuterColoredBox && [...el.querySelectorAll('div, section, p')].some((c) => /觀看[記紀]錄/.test(c.textContent || ''))) continue;
      el.classList.add('ani-bgm-toast');
      el.style.setProperty('display', 'inline-flex', 'important');
      el.style.setProperty('flex-direction', 'row', 'important');
      el.style.setProperty('flex-wrap', 'nowrap', 'important');
      el.style.setProperty('align-items', 'center', 'important');
      el.style.setProperty('gap', '8px', 'important');
      el.style.setProperty('width', 'max-content', 'important');
      el.style.setProperty('min-width', '0', 'important');
      el.style.setProperty('max-width', 'calc(100vw - 32px)', 'important');
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('padding', '8px 12px 8px 14px', 'important');
      el.style.setProperty('border-radius', '999px', 'important');
      el.style.setProperty('background', 'rgba(18, 30, 44, 0.86)', 'important');
      el.style.setProperty('background-color', 'rgba(18, 30, 44, 0.86)', 'important');
      el.style.setProperty('background-image', 'none', 'important');
      el.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.28)', 'important');
      el.style.setProperty('box-shadow', 'inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 8px 24px rgba(0, 0, 0, 0.36)', 'important');
      el.style.setProperty('color', '#ffffff', 'important');
      el.style.setProperty('white-space', 'nowrap', 'important');
      el.style.setProperty('writing-mode', 'horizontal-tb', 'important');
      for (const child of el.querySelectorAll('*')) {
        if (child.closest('.ani-bgm-toast-close')) continue;
        child.style.setProperty('background', 'transparent', 'important');
        child.style.setProperty('background-color', 'transparent', 'important');
        child.style.setProperty('background-image', 'none', 'important');
        child.style.setProperty('box-shadow', 'none', 'important');
        child.style.setProperty('border', '0', 'important');
        if (!child.matches('svg, path, circle, line, polyline')) {
          child.style.setProperty('white-space', 'nowrap', 'important');
          child.style.setProperty('width', 'auto', 'important');
          child.style.setProperty('min-width', '0', 'important');
          child.style.setProperty('flex', 'none', 'important');
        }
      }
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let tn;
      while ((tn = walk.nextNode())) {
        if (/[\u2705\u2714\u2611\uFE0E\uFE0F]/.test(tn.textContent)) {
          tn.textContent = tn.textContent.replace(/[\u2705\u2714\u2611\uFE0E\uFE0F]+/g, '').replace(/^\s+/, '');
        }
        if (/^\s*(?:\[X\]|[×✕✖])\s*$/i.test(tn.textContent)) {
          const p = tn.parentElement;
          if (p && !p.querySelector('.ani-bgm-toast-close-icon')) {
            tn.textContent = '';
            p.classList.add('ani-bgm-toast-close');
            p.innerHTML = '<svg class="ani-bgm-toast-close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
          }
        }
      }
      for (const btn of el.querySelectorAll('button, a, span, div')) {
        if (btn === el || btn.classList.contains('ani-bgm-toast-close')) continue;
        const bt = (btn.textContent || '').trim();
        if (/^(?:\[X\]|[×✕✖]|X)$/i.test(bt) && btn.childElementCount <= 1) {
          btn.classList.add('ani-bgm-toast-close');
          btn.innerHTML = '<svg class="ani-bgm-toast-close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
        }
      }
      for (const oldSvg of [...el.querySelectorAll('svg:not(.ani-bgm-toast-icon):not(.ani-bgm-toast-close-icon)')]) {
        if (!oldSvg.closest('.ani-bgm-toast-close')) oldSvg.remove();
      }
      if (!el.querySelector('.ani-bgm-toast-icon')) {
        el.insertAdjacentHTML('afterbegin', '<svg class="ani-bgm-toast-icon" style="width:17px!important;height:17px!important;min-width:17px!important;min-height:17px!important;flex:none!important;color:#5ee2ea!important;display:block!important" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>');
      } else {
        const ic = el.querySelector('.ani-bgm-toast-icon');
        if (ic) {
          ic.style.setProperty('width', '17px', 'important');
          ic.style.setProperty('height', '17px', 'important');
          ic.style.setProperty('min-width', '17px', 'important');
          ic.style.setProperty('flex', 'none', 'important');
          ic.style.setProperty('color', '#5ee2ea', 'important');
        }
      }
    }
    if (plusToolBox) {
      const shortcutInBar = plusToolBox.querySelector(':scope > .shortcut-button.ani-shortcut-in-toolbar');
      for (const box of [...plusToolBox.querySelectorAll(':scope > .plus_button_box')]) {
        if (/圖像融合|映像重構/.test(box.textContent || '')) {
          if (shortcutInBar) plusToolBox.insertBefore(box, shortcutInBar);
          else plusToolBox.append(box);
        }
      }
    }
    for(const range of document.querySelectorAll('#ani_video #danmuToggle input[type="range"]')){
      const syncRange=()=>{const min=Number(range.min||0),max=Number(range.max||100),val=Number(range.value||0);const pct=max>min?Math.max(0,Math.min(100,((val-min)/(max-min))*100)):0;range.style.setProperty('--ani-range-pct',`${pct.toFixed(1)}%`);};
      if(!range.dataset.aniRangeBound){range.dataset.aniRangeBound='true';range.addEventListener('input',syncRange);range.addEventListener('change',syncRange);}
      syncRange();
    }
    const videoEl=document.querySelector('#ani_video video');
    const muteBtn=document.querySelector('#ani_video .vjs-mute-control');
    if(videoEl&&muteBtn&&!muteBtn.dataset.aniVolBound){
      muteBtn.dataset.aniVolBound='true';
      const syncVol=()=>{const lvl=videoEl.muted||videoEl.volume<=0?'0':videoEl.volume<=0.34?'1':videoEl.volume<=0.67?'2':'3';muteBtn.dataset.aniVol=lvl;};
      videoEl.addEventListener('volumechange',syncVol);
      syncVol();
    }
    const aniPlayer=document.querySelector('#ani_video');
    if (aniPlayer && !aniPlayer.dataset.aniFsSyncBound) {
      aniPlayer.dataset.aniFsSyncBound = 'true';
      const syncFullscreen = () => {
        const fullWindow = Boolean(document.querySelector('.vjs-fullwindow, .fullwindow'));
        const fullScreen = fullWindow || Boolean(document.fullscreenElement ||
          document.webkitFullscreenElement || document.querySelector('.vjs-fullscreen'));
        const changed = document.body.classList.contains('ani-is-fullscreen') !== fullScreen;
        document.body.classList.toggle('ani-is-fullscreen', fullScreen);
        document.body.classList.toggle('ani-is-fullwindow', fullWindow);
        if (changed) setTimeout(enhancePlayerControls, 0);
      };
      fullscreenObserver?.disconnect();
      fullscreenObserver = new MutationObserver(syncFullscreen);
      for (const node of [document.body, aniPlayer, ...document.querySelectorAll('.videoframe, section.player, #video-container')]) {
        fullscreenObserver.observe(node, {attributes: true, attributeFilter: ['class']});
      }
      if (!document.body.dataset.aniFsSyncBound) {
        document.body.dataset.aniFsSyncBound = 'true';
        document.addEventListener('fullscreenchange', syncFullscreen);
        document.addEventListener('webkitfullscreenchange', syncFullscreen);
      }
      syncFullscreen();
    }
    if(aniPlayer&&!aniPlayer.dataset.aniStartedBound){
      aniPlayer.dataset.aniStartedBound='true';
      const syncStarted=()=>{
        const started=aniPlayer.classList.contains('vjs-has-started')||(videoEl&&(!videoEl.paused||videoEl.currentTime>0));
        aniPlayer.classList.toggle('ani-video-unstarted',!started);
      };
      videoEl?.addEventListener('play',syncStarted);
      videoEl?.addEventListener('playing',syncStarted);
      videoEl?.addEventListener('timeupdate',syncStarted,{once:true});
      syncStarted();
    }
    if(aniPlayer&&typeof IntersectionObserver==='function'&&!aniPlayer.dataset.aniMiniPipBound){
      const playerSlot=aniPlayer.closest('.videoframe')||aniPlayer.parentElement;
      if(playerSlot){
        aniPlayer.dataset.aniMiniPipBound='true';
        let dismissed = false;
        let slotStyle;
        let miniMotion;
        const stopMiniMotion = () => {
          miniMotion?.cancel();
          miniMotion = undefined;
        };
        const restorePlayer = () => {
          stopMiniMotion();
          aniPlayer.classList.remove('ani-mini-pip');
          document.body.classList.remove('ani-pip-active');
          if (!slotStyle) return;
          playerSlot.style.minHeight = slotStyle.minHeight;
          playerSlot.style.background = slotStyle.background;
          slotStyle = null;
        };
        const closeBtn=document.createElement('button');
        closeBtn.type='button';
        closeBtn.className='ani-mini-pip-close';
        closeBtn.setAttribute('aria-label','關閉縮小畫面');
        closeBtn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
        closeBtn.addEventListener('click',(e)=>{
          e.stopPropagation();
          dismissed=true;
          restorePlayer();
          aniPlayer.dataset.aniPipDismissed='true';
          document.body.classList.add('ani-pip-dismissed');
        });
        aniPlayer.append(closeBtn);
        try {
          const savedW = Number(localStorage.getItem('aniMiniPipWidth') || 0);
          if (savedW >= 240 && savedW <= 760) aniPlayer.style.setProperty('--ani-mini-pip-w', `${savedW}px`);
          const savedPos = JSON.parse(localStorage.getItem('aniMiniPipRightPos') || 'null');
          if (savedPos && Number.isFinite(savedPos.x) && Number.isFinite(savedPos.y)) {
            aniPlayer.style.setProperty('--ani-mini-pip-x', `${Math.max(12, Math.min(window.innerWidth - 252, savedPos.x))}px`);
            aniPlayer.style.setProperty('--ani-mini-pip-y', `${Math.max(12, Math.min(window.innerHeight - 150, savedPos.y))}px`);
            aniPlayer.classList.add('ani-mini-pip-moved');
          }
        } catch {}
        const miniControls=document.createElement('div');
        miniControls.className='ani-mini-pip-controls';
        miniControls.innerHTML =
          '<button type="button" class="ani-mini-pip-play" aria-label="播放 / 暫停" title="播放 / 暫停"><svg class="ani-mp-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.5 4.8c0-1.1 1.2-1.8 2.2-1.2l11 6.7c.9.5.9 1.9 0 2.4l-11 6.7c-1 .6-2.2-.1-2.2-1.2V4.8Z"/></svg><svg class="ani-mp-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4.5" height="16" rx="1.2"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.2"/></svg></button>';
        const miniPlay=miniControls.querySelector('.ani-mini-pip-play');
        const back = createPlaybackSeekButton(aniPlayer, -1);
        const forward = createPlaybackSeekButton(aniPlayer, 1);
        back.classList.add('ani-mini-pip-seek');
        forward.classList.add('ani-mini-pip-seek');
        miniControls.prepend(back);
        miniControls.append(forward);
        syncPlaybackSeekLabels(miniControls);
        const syncMiniPlay=()=>{
          const v=aniPlayer.querySelector('video');
          miniPlay.dataset.playing=v&&!v.paused?'true':'false';
        };
        miniPlay.addEventListener('click',(e)=>{e.stopPropagation();const v=aniPlayer.querySelector('video');if(!v)return;if(v.paused)v.play().catch(()=>{});else v.pause();syncMiniPlay();});
        videoEl?.addEventListener('play',syncMiniPlay);
        videoEl?.addEventListener('pause',syncMiniPlay);
        syncMiniPlay();
        aniPlayer.append(miniControls);
        aniPlayer.addEventListener('pointerdown',(ev)=>{
          if(!aniPlayer.classList.contains('ani-mini-pip'))return;
          if(ev.button!==0||ev.target.closest('button, input, .ani-mini-pip-edge, .vjs-control-bar'))return;
          const rect=aniPlayer.getBoundingClientRect();
          const startX=ev.clientX,startY=ev.clientY,origX=rect.left,origY=rect.top;
          let moved=false;
          const onMove=(m)=>{
            const dx=m.clientX-startX,dy=m.clientY-startY;
            if(!moved&&Math.hypot(dx,dy)>4)moved=true;
            if(!moved)return;
            const x=Math.round(Math.max(12,Math.min(window.innerWidth-rect.width-12,origX+dx)));
            const y=Math.round(Math.max(12,Math.min(window.innerHeight-rect.height-12,origY+dy)));
            aniPlayer.classList.add('ani-mini-pip-moved');
            aniPlayer.style.setProperty('--ani-mini-pip-x',`${x}px`);
            aniPlayer.style.setProperty('--ani-mini-pip-y',`${y}px`);
          };
          const onUp=()=>{
            window.removeEventListener('pointermove',onMove);
            window.removeEventListener('pointerup',onUp);
            if(moved){
              aniPlayer.dataset.aniPipDragged='1';
              setTimeout(()=>{delete aniPlayer.dataset.aniPipDragged;},80);
              const r=aniPlayer.getBoundingClientRect();
              try{localStorage.setItem('aniMiniPipRightPos',JSON.stringify({x:Math.round(r.left),y:Math.round(r.top)}));}catch{}
            }
          };
          window.addEventListener('pointermove',onMove);
          window.addEventListener('pointerup',onUp);
        });
        aniPlayer.addEventListener('click',(ev)=>{
          if(aniPlayer.dataset.aniPipDragged){ev.preventDefault();ev.stopPropagation();}
        },true);
        const returnBtn=document.createElement('button');
        returnBtn.type='button';
        returnBtn.className='ani-mini-pip-return';
        returnBtn.setAttribute('aria-label','回到主畫面');
        returnBtn.title='回到主畫面';
        returnBtn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
        returnBtn.addEventListener('click',(e)=>{
          e.stopPropagation();
          playerSlot.scrollIntoView({behavior:'instant',block:'center'});
          syncScrollMiniPlayer?.();
        });
        aniPlayer.append(returnBtn);
        for(const [cls,axis] of [['ani-mini-pip-edge-r','x'],['ani-mini-pip-edge-t','y'],['ani-mini-pip-edge-br','xy']]){
          const edge=document.createElement('div');
          edge.className=`ani-mini-pip-edge ${cls}`;
          edge.title='拖曳調整大小';
          edge.addEventListener('pointerdown',(ev)=>{
            ev.preventDefault();ev.stopPropagation();
            edge.setPointerCapture?.(ev.pointerId);
            const startX=ev.clientX,startY=ev.clientY;
            const startW=aniPlayer.getBoundingClientRect().width||360;
            const onMove=(m)=>{
              const dx=m.clientX-startX,dy=axis==='y'?(startY-m.clientY)*(16/9):(m.clientY-startY)*(16/9);
              const delta=axis==='x'?dx:axis==='y'?dy:Math.max(dx,dy);
              const nextW=Math.round(Math.max(240,Math.min(Math.min(760,window.innerWidth-40),startW+delta)));
              aniPlayer.style.setProperty('--ani-mini-pip-w',`${nextW}px`);
            };
            const onUp=()=>{
              window.removeEventListener('pointermove',onMove);
              window.removeEventListener('pointerup',onUp);
              const w=parseInt(aniPlayer.style.getPropertyValue('--ani-mini-pip-w'),10);
              if(w>=240){try{localStorage.setItem('aniMiniPipWidth',String(w));}catch{}}
            };
            window.addEventListener('pointermove',onMove);
            window.addEventListener('pointerup',onUp);
          });
          aniPlayer.append(edge);
        }
        syncScrollMiniPlayer = (bounds = playerSlot.getBoundingClientRect()) => {
          if (!aniPlayer.isConnected) return;
          const outAbove = bounds.bottom < 48;
          if (!outAbove || !settings.scrollMiniPlayer) {
            dismissed = false;
            delete aniPlayer.dataset.aniPipDismissed;
            document.body.classList.remove('ani-pip-dismissed');
          }
          const animate = typeof aniPlayer.animate === 'function' &&
            !matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (!settings.scrollMiniPlayer || document.fullscreenElement || dismissed) {
            restorePlayer();
            return;
          }
          if (outAbove === Boolean(slotStyle)) return;
          const from = animate && aniPlayer.getBoundingClientRect();
          if (outAbove) {
            stopMiniMotion();
            slotStyle = { minHeight: playerSlot.style.minHeight, background: playerSlot.style.background };
            playerSlot.style.minHeight = `${Math.round(bounds.height)}px`;
            playerSlot.style.background = 'transparent';
            aniPlayer.classList.add('ani-mini-pip');
            document.body.classList.add('ani-pip-active');
          } else {
            restorePlayer();
          }
          if (!from) return;
          const to = aniPlayer.getBoundingClientRect();
          if (!from.width || !from.height || !to.width || !to.height) return;
          // Start at the previous visual position after switching the player layout.
          miniMotion = aniPlayer.animate([
            { transformOrigin: '0 0', transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})` },
            { transformOrigin: '0 0', transform: 'none' },
          ], { duration: 180, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)' });
        };
        const syncPlayer = syncScrollMiniPlayer;
        const syncAfterLayout = () => {
          if (!aniPlayer.isConnected) {
            miniPlayerObserver.disconnect();
            window.removeEventListener('scroll', onMiniPlayerScroll);
            if (syncScrollMiniPlayer === syncPlayer) {
              restorePlayer();
              document.body.classList.remove('ani-pip-dismissed');
              syncScrollMiniPlayer = undefined;
            }
            return;
          }
          syncPlayer();
        };
        const onMiniPlayerScroll = () => {
          if (settings.scrollMiniPlayer || slotStyle) syncAfterLayout();
        };
        const miniPlayerObserver = new IntersectionObserver(syncAfterLayout, {
          rootMargin: '-48px 0px 0px', threshold: 0,
        });
        miniPlayerObserver.observe(playerSlot);
        window.addEventListener('scroll', onMiniPlayerScroll, { passive: true });
      }
    }
    if(controlBar){
      if (playerEl && !controlBar.querySelector('.ani-playback-seek-group')) {
        const seekGroup = document.createElement('div');
        seekGroup.className = 'ani-playback-seek-group';
        seekGroup.setAttribute('role', 'group');
        seekGroup.setAttribute('aria-label', '播放時間跳轉');
        seekGroup.append(createPlaybackSeekButton(playerEl, -1), createPlaybackSeekButton(playerEl, 1));
        syncPlaybackSeekLabels(seekGroup);
        controlBar.append(seekGroup);
      }
      const leftGrp=controlBar.querySelector('.control-bar-leftbtn');
      if(leftGrp){
        const nextEpBtn=leftGrp.querySelector('.vjs-next-button');
        const volPanel=leftGrp.querySelector('.vjs-volume-panel');
        if(nextEpBtn&&volPanel&&nextEpBtn.nextElementSibling!==volPanel){
          volPanel.before(nextEpBtn);
        }
      }
      if(leftGrp&&!leftGrp.querySelector('.ani-time-capsule')){
        const cur=leftGrp.querySelector('.vjs-current-time');
        const div=leftGrp.querySelector('.vjs-time-divider');
        const dur=leftGrp.querySelector('.vjs-duration');
        if(cur&&dur){
          const cap=document.createElement('div');
          cap.className='ani-time-capsule';
          cur.before(cap);
          cap.append(cur);
          if(div)cap.append(div);
          cap.append(dur);
        }
      }
      // Episode picker icon right next to Ambient Light toggle (works in Normal, Theater, and Fullscreen)
      const rightGrp = controlBar.querySelector('.control-bar-rightbtn');
      const seasonRoot = document.querySelector('.season');
      if (rightGrp && seasonRoot && seasonRoot.querySelector('.season ul li a, ul li a') && !rightGrp.querySelector('.ani-episodes-control')) {
        const displayTitle = (title) => globalThis.AniEnhancements?.traditionalTitle(title) ?? title;
        const epBtn = document.createElement('button');
        epBtn.type = 'button';
        epBtn.className = 'vjs-control vjs-button ani-episodes-control';
        epBtn.setAttribute('aria-label', '選集');
        epBtn.innerHTML = '<svg class="ani-player-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3.5" y="4" width="7" height="7" rx="1.6"/><rect x="13.5" y="4" width="7" height="7" rx="1.6"/><rect x="3.5" y="13" width="7" height="7" rx="1.6"/><rect x="13.5" y="13" width="7" height="7" rx="1.6"/></svg>';
        const ambBtn = rightGrp.querySelector('.ani-ambientlight-toggle');
        if (ambBtn) ambBtn.after(epBtn);
        else rightGrp.prepend(epBtn);

        let epDrawer = playerEl.querySelector('.ani-player-episodes-drawer');
        const onEpisodeDrawerOutsideClick = (ev) => {
          if (epDrawer.isConnected && epBtn.isConnected &&
              (epBtn.contains(ev.target) || epDrawer.contains(ev.target))) return;
          setEpisodeDrawerOpen(false);
        };
        const setEpisodeDrawerOpen = (open) => {
          if (open) document.addEventListener('click', onEpisodeDrawerOutsideClick, true);
          else document.removeEventListener('click', onEpisodeDrawerOutsideClick, true);
          epDrawer.classList.toggle('is-open', open);
          epDrawer.inert = !open;
          epDrawer.setAttribute('aria-hidden', String(!open));
          epBtn.setAttribute('aria-expanded', String(open));
        };
        const closeEpisodeDrawer = () => {
          setEpisodeDrawerOpen(false);
          epBtn.focus();
        };
        if (!epDrawer) {
          epDrawer = document.createElement('div');
          epDrawer.className = 'ani-player-episodes-drawer';
          epDrawer.inert = true;
          epDrawer.setAttribute('aria-hidden', 'true');
          epDrawer.innerHTML = '<div class="ani-ep-drawer-backdrop"></div><aside class="ani-ep-drawer-panel" aria-label="集數選擇"><div class="ani-ep-drawer-tabs" role="tablist"></div><div class="ani-ep-drawer-scroll"><div class="ani-ep-drawer-body"></div></div></aside>';
          playerEl.append(epDrawer);
          const stopEvt = (ev) => ev.stopPropagation();
          epDrawer.addEventListener('dblclick', stopEvt);
          epDrawer.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') {
              closeEpisodeDrawer();
            }
            ev.stopPropagation();
          });
          epDrawer.querySelector('.ani-ep-drawer-backdrop')?.addEventListener('click', (ev) => {
            ev.stopPropagation();
            closeEpisodeDrawer();
          });
        }
        const clockText = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
        const readEpisodeMedia = (row) => row.classList.contains('is-playing') &&
          !playerEl.matches(NON_EPISODE_PLAYER_SELECTOR) ? playerEl.querySelector('video') : null;
        const setEpisodePlayback = (row, {elapsed, duration, completed, displayProgress, watched, watchedWithoutTiming}) => {
          const time = row.querySelector('.ani-ep-time');
          const text = duration > 0 && (elapsed > 0 || completed) ? `${clockText(elapsed)} / ${clockText(duration)}`
            : completed || watchedWithoutTiming ? '已看完' : '—:— / —:—';
          if (time.textContent !== text) time.textContent = text;
          const progress = row.querySelector('progress');
          const max = duration || 1;
          const position = displayProgress * max;
          row.toggleAttribute('data-ani-watch-known', watched);
          if (progress.getAttribute('aria-label') !== '觀看進度') progress.setAttribute('aria-label', '觀看進度');
          if (watchedWithoutTiming) progress.setAttribute('aria-valuetext', '已看完');
          else progress.removeAttribute('aria-valuetext');
          if (progress.max !== max) progress.max = max;
          if (progress.value !== position) progress.value = position;
        };
        const setEpisodeDate = (element, date) => {
          element.textContent = date.replaceAll('-', '/');
          element.dateTime = date.replaceAll('/', '-');
        };
        const loadedThumbnails = new Map();
        async function loadEpisodeThumbnail(row) {
          const sn = row.dataset.videoSn;
          const thumb = row.querySelector('.ani-ep-thumb');
          if (!sn || !thumb || thumb.querySelector('img') || thumb.dataset.aniThumbLoading) return;
          thumb.dataset.aniThumbLoading = 'true';
          try {
            const frame = readEpisodeFrames().get(sn);
            const captured = typeof frame === 'string' && frame.startsWith('data:image/jpeg;base64,');
            const cover = captured ? '' : (await getEpisodeDetails(sn))?.cover?.trim();
            const url = cover && URL.canParse(cover, location.href) ? new URL(cover, location.href) : null;
            const src = url?.protocol === 'https:' ? url.href : captured ? frame : '';
            if (!src || !row.isConnected) return;
            const img = document.createElement('img');
            img.alt = '';
            img.decoding = 'async';
            img.src = src;
            await img.decode();
            img.dataset.aniThumbReady = 'true';
            loadedThumbnails.set(sn, img);
            if (row.isConnected) {
              thumb.prepend(img);
            }
          } catch {
            // A failed image stays empty and can be retried on the next expansion.
          } finally {
            delete thumb.dataset.aniThumbLoading;
          }
        }
        let visibleEpisodes;
        playerEl.addEventListener(episodeFrameReady, ({ detail }) => {
          const row = epDrawer.querySelector('.ani-ep-row.is-playing');
          if (row?.dataset.videoSn === detail) void loadEpisodeThumbnail(row);
        });
        const bodyEl = epDrawer.querySelector('.ani-ep-drawer-body');
        let updateActiveEpisode;
        const syncActiveEpisode = event => {
          if (!epDrawer.classList.contains('is-open')) return;
          const row = bodyEl.querySelector('.is-playing');
          if (!row) return;
          const media = readEpisodeMedia(row);
          if (media === event.target) updateActiveEpisode?.(row);
        };
        for (const event of ['timeupdate', 'seeked', 'ended']) {
          playerEl.addEventListener(event, syncActiveEpisode, true);
        }
        const scrollArea = epDrawer.querySelector('.ani-ep-drawer-scroll');
        const updateScrollEdges = () => {
          const remaining = bodyEl.scrollHeight - bodyEl.clientHeight - bodyEl.scrollTop;
          scrollArea.classList.toggle('can-scroll-up', bodyEl.scrollTop > 1);
          scrollArea.classList.toggle('can-scroll-down', remaining > 1);
        };
        bodyEl.addEventListener('scroll', updateScrollEdges, { passive: true });
        const scrollObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(updateScrollEdges) : null;
        const renderEpDrawer = () => {
          const tabsEl = epDrawer.querySelector('.ani-ep-drawer-tabs');
          if (!tabsEl) return;
          const sections = [];
          let pendingTitle = '';
          for (const child of seasonRoot.children) {
            if (child.matches('.ani-ep-group-bar, .ani-episode-track-choices')) continue;
            if (/^(P|H[1-6]|DIV|SPAN)$/i.test(child.tagName) && !child.querySelector('ul')) {
              const t = child.textContent.replace(/[:：\s]+$/g, '').trim();
              if (t) pendingTitle = t;
            } else if (child.tagName === 'UL' || child.querySelector('ul')) {
              const ulEl = child.tagName === 'UL' ? child : child.querySelector('ul');
              const items = [...ulEl.querySelectorAll('li a')];
              if (items.length) {
                const heading = child.querySelector(':scope > :is(p, h2, h3, h4)')?.textContent?.trim().replace(/[:：\s]+$/g, '');
                const label = heading || pendingTitle || (sections.length === 0 ? '本篇' : '特別篇');
                const isMovie = globalThis.AniEnhancements?.isMovieEpisodeTrack?.(label);
                sections.push({ label, items, isMovie });
                pendingTitle = '';
              }
            }
          }
          if (!sections.length) {
            const allItems = [...seasonRoot.querySelectorAll('ul li a')];
            if (allItems.length) sections.push({ label: '本篇', items: allItems });
          }
          globalThis.AniEnhancements?.normalizeBilingualEpisodeTracks?.(sections);
          let activeIdx = sections.findIndex((s) => s.items.some((a) => a.closest('li')?.classList.contains('playing')));
          if (activeIdx < 0) activeIdx = 0;
          const getVideoSn = link => link.dataset.aniVideoSn || new URL(link.href, location.href).searchParams.get('sn');
          const episodeSns = sections.flatMap(section => section.items.map(getVideoSn)).filter(Boolean);
          const watchHistory = getEpisodeWatchHistory(episodeSns);

          const showSection = (idx) => {
            for (const [i, tabBtn] of [...tabsEl.querySelectorAll('.ani-ep-drawer-tab')].entries()) {
              const act = i === idx;
              tabBtn.classList.toggle('is-active', act);
              tabBtn.setAttribute('aria-selected', String(act));
            }
            visibleEpisodes?.disconnect();
            scrollObserver?.disconnect();
            const visibleDetails = new WeakMap();
            let records;
            const updatePlayback = (row) => {
                if (!row.isConnected) return;
                const state = globalThis.AniEnhancements?.resolveEpisodeProgress({
                  ...records?.get(row.dataset.videoSn),
                  details: visibleDetails.get(row),
                  media: readEpisodeMedia(row),
                });
                if (state) setEpisodePlayback(row, state);
            };
            updateActiveEpisode = updatePlayback;
            const hydrateEpisode = row => {
              const sn = row.dataset.videoSn;
              if (!sn || visibleDetails.has(row)) return;
              visibleDetails.set(row, null);
              getEpisodeDetails(sn).then(details => {
                if (!row.isConnected) return;
                visibleDetails.set(row, details);
                if (details?.date) setEpisodeDate(row.querySelector('time'), details.date);
                if (details) {
                  const views = Number(details.views);
                  const count = Number.isFinite(views) && views > 0
                    ? views.toLocaleString('zh-TW')
                    : '統計中';
                  const viewsElement = row.querySelector('.ani-ep-views');
                  viewsElement.textContent = count;
                  viewsElement.setAttribute('aria-label', `播放數 ${count}`);
                }
                updatePlayback(row);
                void loadEpisodeThumbnail(row);
              });
            };
            visibleEpisodes = new IntersectionObserver((entries, observer) => {
              for (const entry of entries) {
                if (!entry.isIntersecting || !entry.target.isConnected) continue;
                observer.unobserve(entry.target);
                hydrateEpisode(entry.target);
              }
            }, { root: bodyEl });
            bodyEl.innerHTML = '';
            const grid = document.createElement('div');
            grid.className = 'ani-ep-drawer-grid';
            const sec = sections[idx];
            if (sec) {
              for (const [index, srcLink] of sec.items.entries()) {
                const row = document.createElement('div');
                const epBtnItem = document.createElement('button');
                epBtnItem.type = 'button';
                epBtnItem.className = 'ani-ep-drawer-btn';
                const isPlaying = Boolean(srcLink.closest('li')?.classList.contains('playing'));
                row.className = isPlaying ? 'ani-ep-row is-playing' : 'ani-ep-row';
                row.append(epBtnItem);
                const sn = getVideoSn(srcLink);
                const thumb = document.createElement('span');
                thumb.className = 'ani-ep-thumb';
                const cachedThumb = loadedThumbnails.get(sn);
                if (cachedThumb) thumb.append(cachedThumb.cloneNode());
                if (isPlaying) {
                  const badge = document.createElement('span');
                  badge.className = 'ani-ep-playing-label';
                  badge.textContent = '播放中';
                  const bars = document.createElement('span');
                  bars.className = 'ani-ep-bars';
                  bars.setAttribute('aria-hidden', 'true');
                  for (let i = 0; i < 4; i++) bars.append(document.createElement('i'));
                  badge.prepend(bars);
                  thumb.append(badge);
                }
                const label = document.createElement('span');
                label.className = 'ani-ep-copy';
                label.id = `ani-ep-row-title-${index}`;
                epBtnItem.setAttribute('aria-labelledby', label.id);
                const name = document.createElement('strong');
                const number = srcLink.textContent.trim();
                name.textContent = sec.isMovie ? '電影' : /^\d+(?:\.\d+)?$/.test(number) ? `EP.${number}` : displayTitle(number);
                const info = document.createElement('small');
                info.className = 'ani-ep-time';
                info.textContent = '—:— / —:—';
                if (isPlaying) epBtnItem.setAttribute('aria-current', 'true');
                const subtitle = document.createElement('span');
                const date = document.createElement('time');
                subtitle.textContent = srcLink.dataset.aniEpTitle || '';
                if (srcLink.dataset.aniEpAirdate) setEpisodeDate(date, srcLink.dataset.aniEpAirdate);
                subtitle.className = 'ani-ep-name';
                const meta = document.createElement('span');
                meta.className = 'ani-ep-meta';
                const progress = document.createElement('progress');
                progress.setAttribute('aria-label', '觀看進度');
                progress.value = 0;
                const playback = document.createElement('span');
                playback.className = 'ani-ep-playback';
                playback.append(progress, info);
                meta.append(name, subtitle);
                const details = document.createElement('span');
                details.className = 'ani-ep-details';
                const views = document.createElement('span');
                views.className = 'ani-ep-views';
                views.setAttribute('role', 'img');
                const stats = document.createElement('span');
                stats.className = 'ani-ep-stats';
                stats.append(views, date);
                details.append(playback, stats);
                label.append(meta);
                const description = document.createElement('span');
                description.className = 'ani-ep-description';
                description.textContent = srcLink.dataset.aniEpDescription || '';
                row.append(label, thumb, details, description);
                epBtnItem.setAttribute('aria-expanded', String(isPlaying));
                if (/^\d+$/.test(sn)) {
                  row.dataset.videoSn = sn;
                  visibleEpisodes.observe(row);
                }
                const playEpisode = (ev) => {
                  ev.stopPropagation();
                  closeEpisodeDrawer();
                  srcLink.click();
                };
                if (!isPlaying) {
                  const play = document.createElement('button');
                  play.type = 'button';
                  play.className = 'ani-ep-play';
                  play.setAttribute('aria-label', `播放 ${name.textContent}`);
                  play.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="M8 4v16l13-8z"/></svg>';
                  play.addEventListener('click', playEpisode);
                  row.append(play);
                }
                epBtnItem.addEventListener('click', (ev) => {
                  ev.stopPropagation();
                  const expanded = epBtnItem.getAttribute('aria-expanded') === 'true';
                  if (expanded) {
                    if (isPlaying) epBtnItem.setAttribute('aria-expanded', 'false');
                    else playEpisode(ev);
                    return;
                  }
                  grid.querySelector('.ani-ep-row > [aria-expanded="true"]')?.setAttribute('aria-expanded', 'false');
                  epBtnItem.setAttribute('aria-expanded', 'true');
                  hydrateEpisode(row);
                  void loadEpisodeThumbnail(row);
                });
                grid.append(row);
              }
            }
            bodyEl.append(grid);
            watchHistory.then(history => {
              records = history;
              for (const row of grid.children) updatePlayback(row);
            });
            bodyEl.scrollTop = 0;
            const playingRow = grid.querySelector('.is-playing');
            if (playingRow) {
              hydrateEpisode(playingRow);
              void loadEpisodeThumbnail(playingRow);
              const inset = Number.parseFloat(getComputedStyle(bodyEl).scrollPaddingBlockStart) || 0;
              bodyEl.scrollTop = playingRow.getBoundingClientRect().top - bodyEl.getBoundingClientRect().top - inset;
            }
            scrollObserver?.observe(bodyEl);
            scrollObserver?.observe(grid);
            updateScrollEdges();
          };

          tabsEl.innerHTML = '';
          sections.forEach((sec, idx) => {
            const tabBtn = document.createElement('button');
            tabBtn.type = 'button';
            tabBtn.role = 'tab';
            tabBtn.className = 'ani-ep-drawer-tab';
            tabBtn.textContent = displayTitle(sec.label);
            tabBtn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              showSection(idx);
            });
            tabsEl.append(tabBtn);
          });
          showSection(activeIdx);
        };
        seasonRoot.addEventListener('ani-episode-titles-ready', () => {
          if (!epDrawer.classList.contains('is-open')) return;
          const rows = new Map([...epDrawer.querySelectorAll('[data-video-sn]')].map(row => [row.dataset.videoSn, row]));
          for (const link of seasonRoot.querySelectorAll('li a')) {
            const sn = link.dataset.aniVideoSn || new URL(link.href, location.href).searchParams.get('sn');
            if (!/^\d+$/.test(sn)) continue;
            const row = rows.get(sn);
            if (!row) continue;
            row.querySelector('.ani-ep-name').textContent = link.dataset.aniEpTitle || '';
            row.querySelector('.ani-ep-description').textContent = link.dataset.aniEpDescription || '';
            const date = row.querySelector('time');
            if (!date.dateTime && link.dataset.aniEpAirdate) {
              setEpisodeDate(date, link.dataset.aniEpAirdate);
            }
          }
        });
        epBtn.setAttribute('aria-expanded', 'false');
        epBtn.addEventListener('keydown', (ev) => {
          if (ev.key !== 'Escape' || !epDrawer.classList.contains('is-open')) return;
          ev.stopPropagation();
          closeEpisodeDrawer();
        });
        epBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const opening = !epDrawer.classList.contains('is-open');
          if (opening) renderEpDrawer();
          setEpisodeDrawerOpen(opening);
          if (opening && ev.detail === 0) epDrawer.querySelector('[aria-selected="true"]')?.focus();
        });
      }
      const fallbackTips={'.vjs-pre-button':'上一集','.vjs-next-button':'下一集','.vjs-res-button':'畫質','.vjs-playback-rate':'播放速度','.ani-ambientlight-toggle':'環境光'};
      for(const btn of controlBar.querySelectorAll('.vjs-play-control,.vjs-mute-control,.vjs-pre-button,.vjs-next-button,.vjs-danmu-button,.vjs-res-button,.vjs-playback-rate,.vjs-indent-button,.plus_picture_in_picture_icon,.vjs-fullscreen-control,.ani-ambientlight-toggle')){
        if(btn.dataset.aniTipBound)continue;
        btn.dataset.aniTipBound='true';
        const syncTip=()=>{
          const raw=btn.getAttribute('title')||btn.getAttribute('aria-label')||btn.querySelector('.vjs-control-text')?.textContent||'';
          let tip=raw.replace(/\s+/g,' ').trim();
          if(!tip||/^[\d.]+x$/i.test(tip)||/^\d+p|auto/i.test(tip)){for(const [sel,fb] of Object.entries(fallbackTips)){if(btn.matches(sel)){tip=fb;break;}}}
          if(tip)btn.dataset.aniTip=tip;
          if(btn.hasAttribute('title')&&!btn.matches('.vjs-danmu-button,#danmuToggle')&&!btn.closest('#danmuToggle'))btn.removeAttribute('title');
        };
        new MutationObserver(syncTip).observe(btn,{attributes:true,attributeFilter:['title','aria-label'],childList:true,subtree:true});
        syncTip();
      }
    }
  }
  function browseFilterIcon(index) {
    const paths = ['<path d="m3 3 9 0 9 9-9 9-9-9Z"/><circle cx="8" cy="8" r="1"/>', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M3 9h5M3 15h5"/>', '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/>'];
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[index] || paths[0]}</svg>`;
  }

  const collectionCatalogGroups = [
    ['tags', '屬性', '動作 冒險 奇幻 異世界 魔法 超能力 科幻 機甲 校園 喜劇 戀愛 青春 勵志 溫馨 悠閒 料理 親情 感人 運動 競技 偶像 音樂 職場 推理 懸疑 時間穿越 歷史 戰爭 血腥暴力 靈異神怪 黑暗 特攝 BL GL'],
    ['category', '類型', '電影 OVA 雙語 泡麵番 真人演出'],
    ['target', '對象', '闔家觀賞 付費會員 年齡限制'],
  ];

  function createCollectionFilterRow(key, label, values, index, state) {
    const row = document.createElement('section');
    row.className = 'class_list';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', label);
    const heading = document.createElement('div');
    heading.className = 'class-header';
    const title = document.createElement('h3');
    title.innerHTML = browseFilterIcon(index);
    title.append(label);
    heading.append(title);
    const counter = key === 'tags' ? document.createElement('span') : null;
    if (counter) heading.append(counter);
    const list = document.createElement('ul');
    for (const value of ['全部', ...values.split(' ')]) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.value = value;
      button.textContent = value;
      item.append(button);
      list.append(item);
      button.addEventListener('click', () => {
        const selected = state.selected[key];
        if (key !== 'tags') state.selected[key] = value;
        else if (value === '全部') selected.clear();
        else if (!selected.delete(value) && selected.size < 5) selected.add(value);
        sync();
        loadCollectionCatalogMatches(state);
      });
    }
    function sync() {
      const selected = state.selected[key];
      if (counter) counter.textContent = `(${selected.size}/5)`;
      for (const button of list.querySelectorAll('button')) {
        const chosen = key === 'tags'
          ? (button.value === '全部' ? !selected.size : selected.has(button.value))
          : button.value === selected;
        button.setAttribute('aria-pressed', String(chosen));
        button.parentElement.classList.toggle('now', chosen);
        button.disabled = key === 'tags' && button.value !== '全部' && !chosen && selected.size >= 5;
      }
    }
    sync();
    row.append(heading, list);
    return row;
  }

  async function loadCollectionCatalogMatches(state) {
    state.catalogRequest?.abort();
    const {tags, category, target} = state.selected;
    const active = tags.size || category !== '全部' || target !== '全部';
    const params = new URLSearchParams({tags: [...tags].sort().join(',') || '全部', category, target, sort: '1'});
    const cacheKey = params.toString();
    state.catalogMatches = active ? (state.catalogCache.get(cacheKey) || new Set()) : null;
    state.catalogStatus = '';
    if (!active || state.catalogCache.has(cacheKey)) {
      state.apply();
      return;
    }

    const request = new AbortController();
    state.catalogRequest = request;
    state.catalogStatus = '正在比對動畫瘋分類…';
    state.apply();
    try {
      await new Promise(resolve => setTimeout(resolve, 180));
      for (let page = 1; !request.signal.aborted; page++) {
        params.set('page', page);
        // Let an in-flight shared request finish; stale filters ignore the response.
        const signal = AbortSignal.timeout?.(12000);
        const response = await aniFetch(`/animeList.php?${params}`, {credentials: 'same-origin', signal});
        if (!response.ok) throw new Error('catalog unavailable');
        const html = await response.text();
        if (request.signal.aborted) return;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const results = doc.querySelector('.theme-list-block');
        if (!results) throw new Error('catalog results missing');
        for (const card of results.querySelectorAll('.theme-list-main[href]')) {
          const id = new URL(card.getAttribute('href'), location.href).searchParams.get('sn');
          if (id) state.catalogMatches.add(id);
        }
        state.apply();
        if (!nextBrowsePage(doc, new URL(`/animeList.php?${params}`, location.href), page)) break;
      }
      if (request.signal.aborted) return;
      state.catalogCache.set(cacheKey, state.catalogMatches);
      state.catalogStatus = '';
    } catch {
      if (request.signal.aborted) return;
      state.catalogStatus = '分類載入失敗，點選分類可重試';
    }
    state.apply();
  }

  const collectionFilters = new WeakMap();
  function enhanceCollectionFilters() {
    if(location.pathname!=='/mygather.php')return;
    if (typeof mountStudioCatalog === 'function') {
      const host =
        document.querySelector('#BH_background .animate-theme-list.ani-studio-explore') ||
        document.querySelector('#BH_background .animate-theme-list:not(.ani-studio-row):has(.theme-list-block)') ||
        document.querySelector('#BH_background .animate-theme-list:not(.ani-studio-row):has(> .theme-title-block)');
      mountStudioCatalog(host, enhancePosterRails, fetchRecommendationMetadata, {favoritesOnly:true});
    }
    for(const leaf of document.querySelectorAll('a,span,li,button,p')){
      if(leaf.children.length||!/^依(?:更新|加入)日排序$/.test(leaf.textContent.trim()))continue;
      const item=leaf.closest('a,button')||leaf;if(item.classList.contains('ani-collection-sort-item'))continue;
      item.classList.add('ani-collection-sort-item');const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');icon.innerHTML=leaf.textContent.includes('更新')?'<path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/>':'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-9 3v4m-2-2h4"/>';item.prepend(icon);const menu=item.closest('ul');if(menu)menu.classList.add('ani-collection-sort-menu');
    }
    for(const menu of document.querySelectorAll('.ani-collection-sort-menu:not([data-ani-segment])')){
      menu.dataset.aniSegment='true';menu.classList.add('ani-collection-sort-segment');menu.setAttribute('aria-label','收藏排序');const host=menu.parentElement;host.classList.add('ani-collection-sort-host');
      const selected=[...host.children].find(n=>n!==menu&&/依(?:更新|加入)日排序/.test(n.textContent))?.textContent||'';
      for(const child of host.children)if(child!==menu)child.classList.add('ani-old-sort-trigger');
      for(const item of menu.querySelectorAll('.ani-collection-sort-item')){const active=item.closest('li')?.classList.contains('now')||selected.includes(item.textContent.trim());item.setAttribute('aria-current',active?'true':'false');for(const node of item.childNodes)if(node.nodeType===3)node.textContent=node.textContent.replace('依更新日排序','更新日').replace('依加入日排序','加入日');}
    }
    for(const old of document.querySelectorAll('.ani-collection-sort-item'))if(!old.closest('.ani-collection-sort-segment'))old.classList.add('ani-old-sort-trigger');
    const list=document.querySelector('.animate-theme-list .theme-list-block');if(!list)return;
    const segment = document.querySelector('.ani-collection-sort-segment');
    if (segment && !segment.dataset.aniSortBound) {
      segment.dataset.aniSortBound = 'true';
      segment.addEventListener('click', async event => {
        const item = event.target.closest('a.ani-collection-sort-item[href]');
        if (!item || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        const url = new URL(item.href);
        if (url.origin !== location.origin || url.pathname !== location.pathname || !url.search) return;
        event.preventDefault();
        if (segment.getAttribute('aria-busy') === 'true' || item.getAttribute('aria-current') === 'true') return;
        segment.setAttribute('aria-busy', 'true');
        try {
          const response = await aniFetch(url.href);
          if (!response.ok) throw new Error('Collection sort request failed');
          const page = new DOMParser().parseFromString(await response.text(), 'text/html');
          const nextList = page.querySelector('.animate-theme-list .theme-list-block');
          if (!nextList) throw new Error('Collection list missing');
          const pages = document.querySelector('.page_control');
          pages?.nextElementSibling?.matches('.ani-load-more') && pages.nextElementSibling.remove();
          const nextPages = page.querySelector('.page_control');
          if (pages && nextPages) pages.replaceWith(nextPages);
          else if (pages) pages.remove();
          else if (nextPages) document.querySelector('.animate-theme-list .theme-list-block').after(nextPages);
          const currentList = document.querySelector('.animate-theme-list .theme-list-block');
          collectionFilters.get(currentList)?.panel.remove();
          currentList.replaceWith(nextList);
          history.replaceState(history.state, '', url);
          for (const option of segment.querySelectorAll('.ani-collection-sort-item')) {
            option.setAttribute('aria-current', String(option === item));
          }
          enhancePosterRails();
          enhanceCollectionFilters();
          enhanceInfiniteCatalog();
          globalThis.AniEnhancements?.initBrowseFilters?.();
        } catch {
          // Keep the current results and leave the selected sort unchanged.
        } finally {
          segment.removeAttribute('aria-busy');
        }
      });
    }
    let state=collectionFilters.get(list);
    if(!settings.themeEnabled){if(state)state.panel.hidden=true;for(const card of list.querySelectorAll('.theme-list-main[hidden]'))card.hidden=false;return;}
    if(state)state.panel.hidden=false;
    if(!state){
      const panel=document.createElement('div');panel.className='ani-collection-filters filter-section';
      panel.setAttribute('aria-label','篩選收藏動畫');
      const search=document.createElement('input');search.type='search';search.placeholder='搜尋收藏動畫';search.setAttribute('aria-label','搜尋收藏動畫');
      const count=document.createElement('p');count.className='ani-collection-count';count.setAttribute('role','status');
      const field = document.createElement('div');
      field.className = 'ani-collection-search-field';
      const label = document.createElement('label');
      label.htmlFor = search.id = 'ani-collection-search';
      label.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 8.8c0 4.6-8.8 9.6-8.8 9.6s-8.8-5-8.8-9.6a4.4 4.4 0 0 1 8.8-.3 4.4 4.4 0 0 1 8.8.3Z"/></svg>搜尋收藏動畫';
      search.placeholder = '請輸入動畫名稱';
      search.removeAttribute('aria-label');
      const capsule = document.createElement('div');
      capsule.className = 'anime_search-input ani-collection-search-capsule';
      const icon = document.createElement('button');
      icon.type = 'button';
      icon.className = 'anime_search-icon';
      icon.setAttribute('aria-label', '搜尋動畫');
      icon.innerHTML = '<svg class="ani-search-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m14.4 14.4 5.6 5.6"/></svg>';
      icon.addEventListener('click', () => search.focus());
      capsule.append(search, icon);
      field.append(label, capsule);
      const body = mountBrowseFilterPanel(panel, 'ani-collection-filter-body');
      state = {
        panel, search, count,
        selected: {tags:new Set(), category:'全部', target:'全部'},
        dateFilter: {year:'', season:''},
        catalogMatches: null, catalogCache: new Map(), catalogStatus: '',
      };
      const dates = createBroadcastDateFilters(filter => {
        state.dateFilter = filter;
        state.apply();
        list.dispatchEvent(new CustomEvent('ani-catalog-date-change', {detail: filter}));
      });
      const rows = collectionCatalogGroups.map(([key, label, values], index) =>
        createCollectionFilterRow(key, label, values, index, state));
      body.append(field, dates, ...rows, count);
      list.before(panel);
      collectionFilters.set(list,state);
      search.addEventListener('input',()=>state.apply());
      list.addEventListener('ani-origin-results-change', () => state.apply());
      list.addEventListener('ani-collection-status-change', () => state.apply());
    }
    state.apply = () => {
      const cards = [...list.querySelectorAll('.theme-list-main')];
      const {year, season} = state.dateFilter;
      const search = state.search.value.trim().toLocaleLowerCase();
      let shown = 0;
      for (const card of cards) {
        const id = card.getAttribute('href')?.match(/[?&]sn=(\d+)/)?.[1];
        const name = card.querySelector('.theme-name')?.textContent || '';
        const date = broadcastDate(card);
        const visible = (!year || date.year === year) && (!season || date.season === season)
          && (!state.catalogMatches || state.catalogMatches.has(id))
          && name.toLocaleLowerCase().includes(search);
        if (card.hidden === visible) card.hidden = !visible;
        if (visible && !card.matches('.ani-origin-hidden, .ani-col-status-hidden')) shown++;
      }
      const progress = state.catalogStatus ? `，${state.catalogStatus}` : '';
      const text = `顯示 ${shown} / ${cards.length} 部收藏${progress}`;
      if (state.count.textContent !== text) state.count.textContent = text;
    };
    state.apply();
  }
  function createBroadcastDateFilters(onChange, status) {
    const dates = document.createElement('section');
    dates.className = 'class_list ani-catalog-dates';
    const heading = document.createElement('div');
    heading.className = 'class-header';
    heading.innerHTML = '<h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16"/></svg>年份</h3>';
    const year = document.createElement('select');
    year.setAttribute('aria-label', '播出年份');
    year.add(new Option('全部年份', ''));
    const taiwanDate = new Intl.DateTimeFormat('en', {
      year: 'numeric', month: 'numeric', timeZone: 'Asia/Taipei',
    });
    const readCurrentSeason = () => {
      const parts = taiwanDate.formatToParts(new Date());
      const year = parts.find(part => part.type === 'year').value;
      const month = Number(parts.find(part => part.type === 'month').value);
      const quarter = Math.floor((month - 1) / 3);
      return { year, season: broadcastSeasons[quarter], label: `${year} ${['冬番','春番','夏番','秋番'][quarter]}` };
    };
    let current = readCurrentSeason();
    for (let n = Number(current.year); n >= 1960; n--) year.add(new Option(`${n} 年`, String(n)));
    const seasons = document.createElement('div');
    seasons.className = 'ani-catalog-seasons';
    seasons.setAttribute('role', 'group');
    seasons.setAttribute('aria-label', '播出季度');
    let season = '';
    let previousYear = '';
    const update = () => onChange(season === 'current'
      ? {year: current.year, season: current.season}
      : {year: year.value, season});
    for (const [label, value] of [['全部季度',''],[current.label,'current'],['春番','spring'],['夏番','summer'],['秋番','autumn'],['冬番','winter']]) {
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.value = value;
      choice.textContent = label;
      if (value === 'current') choice.title = '當前季番（台灣時間）';
      choice.setAttribute('aria-pressed', String(value === season));
      choice.addEventListener('click', () => {
        if (season === value) return;
        if (season === 'current') year.value = previousYear;
        if (value === 'current') {
          previousYear = year.value;
          year.value = current.year;
        }
        season = value;
        year.disabled = value === 'current';
        for (const option of seasons.children) option.setAttribute('aria-pressed', String(option === choice));
        update();
      });
      seasons.append(choice);
    }
    const currentChoice = seasons.querySelector('[value="current"]');
    const syncCurrentSeason = () => {
      if (!dates.isConnected) {
        clearInterval(seasonTimer);
        document.removeEventListener('visibilitychange', syncCurrentSeason);
        return;
      }
      const next = readCurrentSeason();
      if (next.label === current.label) return;
      for (let n = Number(current.year) + 1; n <= Number(next.year); n++) {
        year.add(new Option(`${n} 年`, String(n)), 1);
      }
      current = next;
      currentChoice.textContent = current.label;
      if (season === 'current') {
        year.value = current.year;
        update();
      }
    };
    const seasonTimer = setInterval(syncCurrentSeason, 60000);
    document.addEventListener('visibilitychange', syncCurrentSeason);
    const options = document.createElement('div');
    options.className = 'ani-catalog-date-options';
    const field = document.createElement('span');
    field.className = 'ani-catalog-date-field';
    field.append(year);
    options.append(field, seasons);
    if (status) options.append(status);
    dates.append(heading, options);
    year.addEventListener('change', update);
    return dates;
  }

  const broadcastSeasons = ['winter', 'spring', 'summer', 'autumn'];
  function broadcastDate(card) {
    const time = card.querySelector('.theme-time');
    const value = time?.getAttribute('title') || time?.textContent || '';
    const match = value.match(/(\d{4})(?:\s*[\/年.\-]\s*(\d{1,2}))?/);
    const month = Number(match?.[2]);
    const namedSeason = ['冬', '春', '夏', '秋'].indexOf(value.match(/([冬春夏秋])番/)?.[1]);
    const season = month >= 1 && month <= 12 ? broadcastSeasons[Math.floor((month - 1) / 3)] : broadcastSeasons[namedSeason];
    return {year: match?.[1], season};
  }

  function mountBrowseFilterPanel(filter, id) {
    const body = document.createElement('div');
    body.className = 'ani-filter-body';
    body.id = id;
    filter.classList.add('ani-browse-filters');
    while (filter.firstChild) body.append(filter.firstChild);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'ani-filter-toggle';
    button.setAttribute('aria-expanded', 'true'); button.setAttribute('aria-controls', body.id);
    button.innerHTML = '<span>篩選動畫</span><svg class="ani-filter-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>';
    let animation;
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      const from = body.getBoundingClientRect().height;
      animation?.cancel();
      body.inert = !open;
      body.style.height = open ? 'auto' : '0px';
      const to = open ? body.scrollHeight : 0;
      button.setAttribute('aria-expanded', String(open));
      animation = body.animate?.([{height: `${from}px`, opacity: open ? 0 : 1}, {height: `${to}px`, opacity: open ? 1 : 0}], {duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280, easing: 'ease-out'});
    });
    filter.append(button, body);
    return body;
  }

  function enhanceCatalogFilters() {
    if (location.pathname !== '/animeList.php') return;
    if (!document.body.classList.contains('ani-catalog-page')) document.body.classList.add('ani-catalog-page');
    const filter = document.querySelector('.filter-section');
    if (filter && typeof mountStudioCatalog === 'function') mountStudioCatalog(filter.closest('.animate-theme-list'), enhancePosterRails, fetchRecommendationMetadata);
    if (!filter || filter.querySelector('.ani-filter-toggle')) return;
    const body = mountBrowseFilterPanel(filter, 'ani-catalog-filters');
    const status = document.createElement('span');
    status.className = 'ani-catalog-date-status';
    status.setAttribute('role', 'status');
    const dates = createBroadcastDateFilters(detail => {
      document.dispatchEvent(new CustomEvent('ani-catalog-date-change', {detail}));
    }, status);
    [...body.querySelectorAll('.class-header h3')].forEach((heading, index) => {
      heading.insertAdjacentHTML('afterbegin', browseFilterIcon(index));
    });
    body.prepend(dates);
  }
  function nextBrowsePage(doc, currentUrl, currentPage) {
    for (const link of doc.querySelectorAll('.page_control a[href], .page_number a[href]')) {
      const href = link.getAttribute('href');
      if (!URL.canParse(href, currentUrl)) continue;
      const url = new URL(href, currentUrl);
      if (url.origin !== currentUrl.origin || url.pathname !== currentUrl.pathname) continue;
      const page = Number(url.searchParams.get('page') || link.dataset.aniListPage || link.textContent.trim());
      if (page === currentPage + 1) {
        if (!url.searchParams.has('page')) url.searchParams.set('page', String(page));
        url.hash = '';
        return url.href;
      }
    }
    return null;
  }
  function enhanceInfiniteCatalog() {
    if (!['/animeList.php','/mygather.php'].includes(location.pathname)) return;
    const list = document.querySelector('.animate-theme-list .theme-list-block');
    const pages = document.querySelector('.page_control');
    if (!list || list.dataset.aniInfinite) return;
    list.dataset.aniInfinite = 'true';
    const initialUrl = new URL(location.href);
    const initialPage = Number(initialUrl.searchParams.get('page') || document.querySelector('.page_number .now')?.textContent.trim()) || 1;
    let next = nextBrowsePage(document, initialUrl, initialPage), busy = false;
    const urlPage = url => Number(new URL(url).searchParams.get('page')) || 1;
    const nextByPage = new Map([[initialPage, next]]);
    const firstPageUrl = new URL(initialUrl);
    firstPageUrl.searchParams.set('page', '1');
    const findUnloaded = url => {
      while (url && nextByPage.has(urlPage(url))) url = nextByPage.get(urlPage(url));
      return url;
    };
    const button = document.createElement('button'); button.type = 'button'; button.className = 'ani-load-more';
    button.textContent = '繼續往下瀏覽';
    button.disabled = !next;
    if (pages) {
      pages.dataset.aniInfinite = 'true';
      pages.after(button);
      pages.hidden = true;
    }
    const seen = new Set([...list.querySelectorAll('.theme-list-main')].map(c => new URL(c.getAttribute('href'),location.href).href));
    let dateFilter = {year: '', season: ''}, failed = false, originActive = false;
    let resumeAt = 0;
    const hasDateFilter = () => Boolean(dateFilter.year || dateFilter.season);
    const shouldSearchAllPages = () => hasDateFilter() || originActive;
    const syncPageStatus = () => {
      button.hidden = !next;
      const status = next ? (resumeAt > Date.now() ? 'cooldown' : failed ? 'failed' : 'pending') : 'complete';
      if (list.dataset.aniBrowsePages !== status) list.dataset.aniBrowsePages = status;
    };
    const matchesDate = card => {
      const {year, season} = broadcastDate(card);
      return (!dateFilter.year || year === dateFilter.year) && (!dateFilter.season || season === dateFilter.season);
    };
    const applyDates = () => {
      syncPageStatus();
      if (location.pathname !== '/animeList.php') return;
      const active = hasDateFilter();
      let shown = 0;
      const cards = [...list.querySelectorAll('.theme-list-main')];
      for (const card of cards) {
        const visible = !active || matchesDate(card);
        if (card.hidden === visible) card.hidden = !visible;
        if (visible) shown++;
      }
      const status = document.querySelector('.ani-catalog-date-status');
      if (!status) return;
      let progress = '已搜尋全部頁面';
      if (next) {
        if (failed) progress = '載入失敗，請重試';
        else progress = '正在搜尋其餘頁面…';
      }
      const text = active ? `顯示 ${shown} 部，${progress}` : '';
      if (status.textContent !== text) status.textContent = text;
    };
    const onFilterChange = () => {
      failed = false;
      if (pages && !busy && shouldSearchAllPages()) next = findUnloaded(firstPageUrl.href);
      applyDates();
      if (shouldSearchAllPages() && next && !busy) load();
      else if (next && !busy) {
        button.textContent = '繼續往下瀏覽';
        requestAnimationFrame(checkBottom);
      }
    };
    const dateEventTarget = location.pathname === '/mygather.php' ? list : document;
    dateEventTarget.addEventListener('ani-catalog-date-change', event => {
      if (!list.isConnected) return;
      dateFilter = event.detail;
      onFilterChange();
    });
    list.addEventListener('ani-origin-filter-change', event => {
      originActive = event.detail;
      onFilterChange();
    });
    const load = async (manual = false) => {
      if (!list.isConnected || busy || !next || resumeAt > Date.now() || (!manual && failed)) return;
      busy = true; failed = false; button.disabled = true; button.textContent = '載入動畫中…';
      applyDates();
      let succeeded=false;
      try {
        const url = new URL(next,location.href);
        if (url.origin !== location.origin || url.pathname !== location.pathname) throw new Error('invalid catalog page');
        const response = await aniFetch(url.href, { credentials: 'include', timeoutMs: 12000 });
        if (!response.ok) throw new Error('catalog unavailable');
        const doc = new DOMParser().parseFromString(await response.text(),'text/html');
        if (!list.isConnected) return;
        const cards = [...doc.querySelectorAll('.theme-list-block .theme-list-main')];
        if (!cards.length && !doc.querySelector('.theme-list-block')) throw new Error('catalog unavailable');
        const batch = document.createDocumentFragment();
        for (const card of cards) {
          const key = new URL(card.getAttribute('href'),url).href;
          if (seen.has(key)) continue;
          seen.add(key); card.querySelectorAll('script,iframe,object').forEach(n=>n.remove());
          batch.append(document.importNode(card,true));
        }
        list.append(batch);
        const current = urlPage(url);
        nextByPage.set(current, nextBrowsePage(doc, url, current));
        next = findUnloaded(shouldSearchAllPages() ? firstPageUrl.href : nextByPage.get(current));
        succeeded = true;
        button.textContent = '繼續往下瀏覽';
        enhancePosterRails();
        enhanceCollectionFilters();
      } catch (error) {
        console.warn('[AniAmbient] Catalog page load failed', next, error);
        failed = true;
        resumeAt = Number(sessionStorage.getItem('aniRequestCooldown')) || 0;
        button.textContent = resumeAt > Date.now() ? '巴哈暫時限制請求，稍後自動接續' : '載入失敗，點此重試';
        if (resumeAt > Date.now()) setTimeout(() => {
          if (list.isConnected) load(true);
        }, resumeAt - Date.now() + 100);
      }
      finally {
        busy = false; button.disabled = !next || resumeAt > Date.now(); applyDates();
        if (succeeded && next) {
          if (shouldSearchAllPages()) setTimeout(function continueSearch() {
            if (!list.isConnected || !shouldSearchAllPages()) return;
            if (originActive && list.dataset.aniOriginBusy === 'true') setTimeout(continueSearch, 1000);
            else load();
          }, originActive && location.pathname === '/animeList.php' ? 5000 : 100);
          else requestAnimationFrame(checkBottom);
        }
      }
    };
    const checkBottom=()=>{if(shouldSearchAllPages()||busy||!next||!button.isConnected||document.hidden||!button.getClientRects().length)return;const rect=button.getBoundingClientRect();if(rect.top<=window.innerHeight+600&&rect.bottom>=-600)load();};
    button.addEventListener('click', () => load(true));
    if (pages && typeof IntersectionObserver === 'function') new IntersectionObserver(entries=>{if(!shouldSearchAllPages() && entries.some(e=>e.isIntersecting))load();},{rootMargin:'600px'}).observe(button);
    let scrollFrame=0;window.addEventListener('scroll',()=>{if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;checkBottom();});},{passive:true});
    syncPageStatus();
  }
  function enhanceAccountPages() {
    const accountIcon=path=>`<svg class="ani-account-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
    const headingIcons={
      '購買方案':'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18m-13 5h4"/>',
      '付款方式':'<path d="M3 7h18v13H3zM3 7l14-4v4m0 6h4"/><circle cx="17" cy="14" r="1"/>',
      '開始時間':'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-9 3v4m-2-2h4"/>',
      '結束時間':'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m5 5 3 3 5-5"/>'
    };
    for(const icon of document.querySelectorAll('.record-list .info-content.title .ani-account-icon'))icon.remove();
    for(const status of document.querySelectorAll('.status-info:not([data-ani-status-icon])')){status.dataset.aniStatusIcon='true';status.insertAdjacentHTML('afterbegin',accountIcon('<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 10h18m5 5 3 3 5-5"/>'));}
    for(const label of document.querySelectorAll('.userpay-precautions > div:not(.item)')){if(!label.querySelector('.ani-account-icon'))label.insertAdjacentHTML('afterbegin',accountIcon('<path d="M12 3 2 21h20Z"/><path d="M12 9v5m0 3v.1"/>'));}
    for(const action of document.querySelectorAll('.payarea-content.other .paycard')){
      if(!/停用自動扣款/.test(action.textContent)||action.querySelector('.ani-cancel-renew-icon'))continue;
      action.classList.add('ani-cancel-renew');action.querySelector('.img-icon')?.classList.add('ani-cancel-native-icon');
      action.insertAdjacentHTML('afterbegin',accountIcon('<path d="M20 10a8 8 0 0 0-13-5L4 8m0-5v5h5M4 14a8 8 0 0 0 13 5l3-3m0 5v-5h-5M3 3l18 18"/>').replace('ani-account-icon','ani-account-icon ani-cancel-renew-icon'));
    }
    for(const heading of document.querySelectorAll('.payarea-title,.theme-title,h1,h2,h3')){
      if(heading.textContent.trim()==='會員狀態'&&!heading.querySelector('.ani-account-icon')){heading.classList.add('ani-membership-heading');heading.insertAdjacentHTML('afterbegin',accountIcon('<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'));}
    }
    const membership=document.querySelector('.pay-state');
    if(location.pathname==='/animePayed.php'&&membership&&!membership.dataset.aniPlans){
      membership.dataset.aniPlans='loading';
      const section=document.createElement('section');section.className='ani-membership-plans';const title=document.createElement('h2');title.textContent='付費方案';
      title.insertAdjacentHTML('afterbegin',accountIcon('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18m-13 5h4"/>'));section.append(title);
      const grid=document.createElement('div');grid.className='ani-plan-grid';grid.hidden=true;section.append(grid);
      const free=document.createElement('div');free.className='paycard-container ani-free-plan';free.innerHTML='<div class="paycard"><p class="programtitle">免費觀看</p><div class="programoney"><span class="money-unit">NTD</span><span class="money-main">0</span><span class="money-sub">元</span></div><div class="ani-plan-detail"><p class="ani-plan-daily">540p 畫質</p><p class="ani-free-note">加入會員後享有 720p</p></div></div><a class="ani-free-watch" href="/">免費觀看</a>';grid.append(free);
      document.body.classList.add('ani-membership-page');
      if (!document.querySelector('.ani-membership-background')) {
        const background = document.createElement('div');
        background.className = 'ani-membership-background';
        background.setAttribute('aria-hidden', 'true');
        const covers = [
          "https://p2.bahamut.com.tw/B/ACG/c/62/0000148362.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/62/0000149262.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/41/0000149241.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/57/0000146157.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/16/0000143816.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/86/0000148486.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/23/0000151823.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/62/0000147362.JPG",
          "https://p2.bahamut.com.tw/B/2KU/70/3854a4a691bc2a8c1347e436d520mmy5.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/69/0000137069.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/01/0000138501.JPG",
          "https://p2.bahamut.com.tw/B/2KU/68/bfc82dfdd40d2a7e3f15e50bca20mmw5.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/75/0000140275.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/91/0000152891.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/78/0000151278.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/87/0000153887.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/16/0000149516.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/87/0000149687.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/53/0000147753.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/38/0000150438.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/96/0000142896.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/86/0000144986.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/24/0000150424.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/59/0000150359.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/92/0000150292.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/35/0000145035.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/81/0000147781.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/83/0000143583.JPG",
          "https://p2.bahamut.com.tw/B/2KU/07/fc64db79f79afd6c8a027d6bf1214ev5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/06/fc0805f35a103610b3544064dd214eu5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/88/59ae1ae5de63e289c95511b01b214mo5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/36/07e2ceabd4e79da4b0912e6945213w85.JPG",
          "https://p2.bahamut.com.tw/B/2KU/55/ce979669d6e22d195fc420a6ef213iv5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/56/33139aa08e3b7633ccd97130f1213iw5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/62/9c6023ed5e29abe9a565e9c971213u65.JPG",
          "https://p2.bahamut.com.tw/B/2KU/44/de274922c3429906018443e995213lc5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/39/a6b7bd589a38f088487b797d80213l75.JPG",
          "https://p2.bahamut.com.tw/B/2KU/93/682bf34a188cee060710bc792c213ph5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/91/eb3847a6ddfde6381cac8d6267213pf5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/92/48b8e7001cc59127bf0112bdce213pg5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/19/e55ce53d786e8e1934d1da7048214cf5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/54/75790e49d590a0d1f9a2c23466213iu5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/53/ded297ed43592d15d289692105214515.JPG",
          "https://p2.bahamut.com.tw/B/2KU/50/7e7fd199a86d0bee97ddc07fa72144y5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/60/2354af8657cc7d15d0cf0351b3214585.JPG",
          "https://p2.bahamut.com.tw/B/2KU/89/428be899c14ed04ff8b3fd8083213pd5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/46/0721b8842377e8d0fbb3f542252144u5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/97/8a9147820ee6d19982803f4f762143h5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/25/91b1c4245bd3a5386305a00431213nl5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/52/97b6aa2feaee542914195258ef214505.JPG",
          "https://p2.bahamut.com.tw/B/2KU/38/9d743c0919842d8e73ffc2e0f32144m5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/53/c51cc18496a3e4ed6c1e08a454213it5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/81/0c5d099f10bf26ff0011e9e28d213e15.JPG",
          "https://p2.bahamut.com.tw/B/2KU/83/8c7e0b51269fef8b4d635fd2b9213ur5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/80/4f2a6e947216a416b8ed82c339213e05.JPG",
          "https://p2.bahamut.com.tw/B/2KU/79/b6cec843dd999f1388eb91a920213dz5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/61/01ca6eedcb88340a3c1ed3855b213j15.JPG",
          "https://p2.bahamut.com.tw/B/2KU/86/51867bfd922e4aff0abe158508213mi5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/00/a061a2e009d74d4e6e11b08c1c213685.JPG",
          "https://p2.bahamut.com.tw/B/2KU/56/a562a9e58a88525e297b12efbc213285.JPG",
          "https://p2.bahamut.com.tw/B/2KU/64/a2b55186596c1f4552dd1b89992132g5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/96/6752e9642fb2da6604dd9f35062130k5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/88/cdbc1e0d5790920c7ff0ec8999212us5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/41/232b9d0e9d042cad25196b4188212qp5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/76/0f4ca2f8ef8d2de84e6a93fee2212m45.JPG",
          "https://p2.bahamut.com.tw/B/2KU/26/f52bfecf0da43acc29fd7f4d17212vu5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/65/10e2c577b17a1e68b576afec33212ol5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/56/207a417142534e01d0fdd2e8f2212g05.JPG",
          "https://p2.bahamut.com.tw/B/2KU/38/d80175c8f4542a7982b181f39d212l25.JPG",
          "https://p2.bahamut.com.tw/B/2KU/80/1e84ea6570b6e6f0707f89d7d4212rs5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/95/a3cd35e80a413af4c2086ebc4a212mn5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/17/dfc3f8e9fde2f54036fbeb70e7211vh5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/06/8a7c8d37ab2641180d761e0545211v65.JPG",
          "https://p2.bahamut.com.tw/B/2KU/73/ed1c82b02c3e89205cbaaff434211zt5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/97/3479283a46505da4b0363b483e211ux5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/73/dbb958df77e7602a142308f2af211u95.JPG",
          "https://p2.bahamut.com.tw/B/2KU/72/0b8c8f41caa786a7c651256ef9211u85.JPG",
          "https://p2.bahamut.com.tw/B/2KU/82/15cd29b595359a53d44012fbfd212025.JPG",
          "https://p2.bahamut.com.tw/B/2KU/71/9c922162fd9b97d273ed588634211u75.JPG",
          "https://p2.bahamut.com.tw/B/2KU/68/e73ea055ecc2b1e80369c2cb37211zo5.JPG",
          "https://p2.bahamut.com.tw/B/2KU/70/0cb2f807b690c058a04d7ab211211u65.JPG",
          "https://p2.bahamut.com.tw/B/2KU/08/d18fc33b1f184296a6a3962b2f20xp85.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/45/0000136745.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/62/0000141262.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/56/0000141656.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/26/0000058226.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/87/0000086687.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/49/0000000549.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/57/0000143057.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/41/0000155241.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/10/0000144110.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/33/0000137133.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/64/0000140264.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/38/0000135738.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/46/0000146146.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/82/0000057082.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/55/0000063155.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/84/0000017484.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/44/0000154944.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/13/0000030413.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/33/0000045733.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/71/0000072071.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/88/0000143788.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/55/0000031655.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/52/0000155252.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/58/0000077058.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/78/0000016478.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/51/0000155251.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/53/0000155253.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/20/0000155020.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/19/0000104019.JPG",
          "https://p2.bahamut.com.tw/B/ACG/c/38/0000146138.JPG",
        ];
        const validPortraitCovers = [];
        let fallbackCoverCursor = 0;
        const showCover = async (image) => {
          try {
            await image.decode();
            if (image.naturalWidth < image.naturalHeight) {
              if (!validPortraitCovers.includes(image.src)) validPortraitCovers.push(image.src);
              image.classList.add('ani-cover-ready');
              return;
            }
          } catch {}
          // Keep a tile's grid position during a retry or a failed load.
          if (!image.dataset.aniFallbackApplied && validPortraitCovers.length) {
            image.dataset.aniFallbackApplied = 'true';
            image.src = validPortraitCovers[fallbackCoverCursor++ % validPortraitCovers.length];
            await showCover(image);
          }
        };
        for (const cover of [...covers, ...covers]) {
          const image = document.createElement('img');
          image.alt = '';
          image.decoding = 'async';
          image.loading = 'eager';
          image.src = cover;
          background.append(image);
          void showCover(image);
        }
        document.body.prepend(background);
      }

      const fallback=document.createElement('a');fallback.className='ani-plans-fallback';fallback.href='animePay.php';fallback.textContent='正在載入方案…也可開啟完整方案頁';section.append(fallback);
      const statusCard=membership.querySelector('.usercard:has(.user-status)');if(statusCard)statusCard.after(section);else membership.prepend(section);
      const mountPlans=doc=>{
        const cards=[...doc.querySelectorAll('.paycard-container')].filter(c=>c.querySelector('.money-main')&&c.querySelector('a[href*="animePay2.php"]'));if(!cards.length)return false;
        const activePlan=document.querySelector('.status-info-program')?.textContent.trim()||'';
        const activeDays=activePlan.match(/(\d+)\s*天/)?.[1];
        for(const source of cards){
          const card=document.importNode(source,true);card.querySelectorAll('script,iframe,object').forEach(n=>n.remove());
          const trigger=card.querySelector('.paycard .paychose'),methods=card.querySelector('.userpaychose');
          const days=card.querySelector('.programtitle')?.textContent.match(/(\d+)\s*天/)?.[1];
          const planBody=card.querySelector('.paycard');
          if(planBody&&days){
            const detail=document.createElement('div');detail.className='ani-plan-detail';
            const price=Number(card.querySelector('.money-main')?.textContent.replace(/[^\d.]/g,''));
            const daily=document.createElement('p');daily.className='ani-plan-daily';daily.textContent=Number.isFinite(price)&&price>0?`NT$ ${(price/Number(days)).toFixed(2)}／天`:`${days} 天觀看方案`;
            detail.append(daily);planBody.append(detail);
          }

          if(activeDays&&days===activeDays){card.classList.add('ani-current-plan');const badge=document.createElement('div');badge.className='ani-current-plan-tag';badge.textContent='目前方案';badge.setAttribute('aria-label',activePlan);card.prepend(badge);}
          if(trigger&&methods){
            trigger.classList.add('ani-payment-trigger');card.append(trigger);trigger.setAttribute('role','button');trigger.tabIndex=0;trigger.setAttribute('aria-expanded','false');trigger.insertAdjacentHTML('beforeend',accountIcon('<path d="m6 9 6 6 6-6"/>'));
            const paymentLogos={"全家": "data:image/png;base64,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", "中華電信": "data:image/png;base64,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", "購買序號": "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJf5ZyW5bGkXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHZpZXdCb3g9IjAgMCA1MTYgMjAwIj48ZGVmcz48c3R5bGU+LmNscy0xe2ZpbGw6I2QxNWU3ZDt9LmNscy0xLC5jbHMtMiwuY2xzLTMsLmNscy00LC5jbHMtNSwuY2xzLTYsLmNscy03LC5jbHMtOHtzdHJva2Utd2lkdGg6MHB4O30uY2xzLTEsLmNscy0zLC5jbHMtN3tmaWxsLXJ1bGU6ZXZlbm9kZDt9LmNscy0ye2ZpbGw6I2VmOWIzZjt9LmNscy0ze2ZpbGw6I2VhN2I5NDt9LmNscy00e2ZpbGw6IzAwOTRhODt9LmNscy01e2ZpbGw6I2QzN2YyZDt9LmNscy05e29wYWNpdHk6Ljk1O30uY2xzLTZ7ZmlsbDojMDBiNGQ4O30uY2xzLTcsLmNscy04e2ZpbGw6I2ZmZjt9PC9zdHlsZT48c3ltYm9sIGlkPSJf5paw5aKe56ym6JmfIiB2aWV3Qm94PSIwIDAgOTkzLjMgMzg1LjQ1Ij48cmVjdCBjbGFzcz0iY2xzLTQiIHg9IjE4LjUiIHk9IjQ3Ljk5IiB3aWR0aD0iMzIwIiBoZWlnaHQ9IjMyMCIgcng9IjExIiByeT0iMTEiLz48cmVjdCBjbGFzcz0iY2xzLTYiIHg9IjAiIHk9IjI5LjUiIHdpZHRoPSIzMjAiIGhlaWdodD0iMzIwIiByeD0iMTEiIHJ5PSIxMSIvPjxyZWN0IGNsYXNzPSJjbHMtNSIgeD0iMzMzLjA0IiB5PSIxOC41IiB3aWR0aD0iMzIwIiBoZWlnaHQ9IjMyMCIgcng9IjExIiByeT0iMTEiLz48cmVjdCBjbGFzcz0iY2xzLTIiIHg9IjMxNC41NCIgeT0iMCIgd2lkdGg9IjMyMCIgaGVpZ2h0PSIzMjAiIHJ4PSIxMSIgcnk9IjExIi8+PGcgY2xhc3M9ImNscy05Ij48cmVjdCBjbGFzcz0iY2xzLTgiIHg9IjM3LjY4IiB5PSI2NS44NSIgd2lkdGg9IjE1Ni42NCIgaGVpZ2h0PSIxMy43IiByeD0iMiIgcnk9IjIiLz48cmVjdCBjbGFzcz0iY2xzLTgiIHg9IjI0LjA4IiB5PSIxMDQuNzkiIHdpZHRoPSIxNzAuMjQiIGhlaWdodD0iMTMuOTMiIHJ4PSIyIiByeT0iMiIvPjxyZWN0IGNsYXNzPSJjbHMtOCIgeD0iMTk4LjUiIHk9IjExNC4zOSIgd2lkdGg9Ijk5Ljg5IiBoZWlnaHQ9IjEzLjkzIiByeD0iMiIgcnk9IjIiLz48cGF0aCBjbGFzcz0iY2xzLTciIGQ9Ik0xMDQuODUsMzA0LjVWNzguOGMwLTEuMS45LTIsMi0yaDE0LjQzYzEuMSwwLDIsLjksMiwydjIyNS43YzAsMS4xLS45LDItMiwyaC0xNC40M2MtMS4xLDAtMi0uOS0yLTJaIi8+PHBvbHlnb24gY2xhc3M9ImNscy03IiBwb2ludHM9IjIxMy45IDM0OS41IDIxMy45IDI5LjUgMjMyLjMyIDI5LjUgMjMyLjMyIDM0OS41IDIxMy45IDM0OS41Ii8+PHBhdGggY2xhc3M9ImNscy03IiBkPSJNNDUuMDcsMjI5Ljk0di04Ni42OGMwLTEuMS45LTIsMi0yaDE0LjQzYzEuMSwwLDIsLjksMiwydjg2LjY4YzAsMS4xLS45LDItMiwyaC0xNC40M2MtMS4xLDAtMi0uOS0yLTJaIi8+PHBhdGggY2xhc3M9ImNscy03IiBkPSJNMTY0LjY0LDIyOS45NHYtODYuNjhjMC0xLjEuOS0yLDItMmgxNC40M2MxLjEsMCwyLC45LDIsMnY4Ni42OGMwLDEuMS0uOSwyLTIsMmgtMTQuNDNjLTEuMSwwLTItLjktMi0yWiIvPjxyZWN0IGNsYXNzPSJjbHMtOCIgeD0iNDUuMDciIHk9IjE0MS4yNiIgd2lkdGg9IjEzOCIgaGVpZ2h0PSIxMy45MyIgcng9IjIiIHJ5PSIyIi8+PHJlY3QgY2xhc3M9ImNscy04IiB4PSI0NS4wNyIgeT0iMTgxLjQ2IiB3aWR0aD0iMTM4IiBoZWlnaHQ9IjEzLjkzIiByeD0iMiIgcnk9IjIiLz48cmVjdCBjbGFzcz0iY2xzLTgiIHg9IjQ1LjA3IiB5PSIyMjEuNjUiIHdpZHRoPSIxMzgiIGhlaWdodD0iMTMuOTMiIHJ4PSIyIiByeT0iMiIvPjxyZWN0IGNsYXNzPSJjbHMtOCIgeD0iMzkuOTQiIHk9IjI1OS44IiB3aWR0aD0iMTQ0LjI1IiBoZWlnaHQ9IjEzLjkzIiByeD0iMiIgcnk9IjIiLz48cGF0aCBjbGFzcz0iY2xzLTciIGQ9Ik0xODguNTIsMzA2Ljg1bC0xNjIuODMsMjIuMTFjLTEuMTEuMTUtMi4wOC0uNzMtMi4wNS0xLjg1di0xMS4wMWMuMDMtLjk2Ljc4LTEuNywxLjc0LTEuNzYsMjMuOTctMS40MiwxNDQuNTQtMTguODksMTYxLjMtMjEuMjgsMS0uMTQsMS45Mi41NiwyLjA1LDEuNTZsMS4zNSwxMC4yYy4xMy45OS0uNTcsMS45LTEuNTYsMi4wNFoiLz48cGF0aCBjbGFzcz0iY2xzLTciIGQ9Ik0yODEuOCwxMTkuMzRjLTEuMDEsMC0xLjgzLjgyLTEuODEsMS44My4yMSwxNS44OSwxLjcxLDEyOS45OSwxLjI1LDE0Ny4wNS0uNTEsMTguNzEtMTAuNzksMzMuNDgtMjQuNzgsMzQuNTctLjk0LjA3LTEuNjguODUtMS42OCwxLjh2MTQuMjNjMCwxLjA0Ljg3LDEuODYsMS45MSwxLjgxLDIxLjgtLjksNDEuNy0xNy4yNyw0MS43LTUyLjQyVjEyMS4xNmMwLTEtLjgxLTEuODEtMS44MS0xLjgxaC0xNC43N1oiLz48L2c+PGcgY2xhc3M9ImNscy05Ij48cmVjdCBjbGFzcz0iY2xzLTgiIHg9IjM2OS4zNCIgeT0iMzIuNDYiIHdpZHRoPSIyMTAuNDEiIGhlaWdodD0iMTMuOTMiIHJ4PSIyLjIiIHJ5PSIyLjIiLz48cmVjdCBjbGFzcz0iY2xzLTgiIHg9IjMyOS42NyIgeT0iNjMuNjUiIHdpZHRoPSIyODkuNzQiIGhlaWdodD0iMTMuOTMiIHJ4PSIyLjA1IiByeT0iMi4wNSIvPjxyZWN0IGNsYXNzPSJjbHMtOCIgeD0iMzYyLjYyIiB5PSI5NS43NCIgd2lkdGg9IjIyMy44NCIgaGVpZ2h0PSIxMy45MyIgcng9IjIuMiIgcnk9IjIuMiIvPjxyZWN0IGNsYXNzPSJjbHMtOCIgeD0iMzYyLjYyIiB5PSIxMjYuNDgiIHdpZHRoPSIyMjMuODQiIGhlaWdodD0iMTMuOTMiIHJ4PSIyLjA4IiByeT0iMi4wOCIvPjxyZWN0IGNsYXNzPSJjbHMtOCIgeD0iMzQwLjA2IiB5PSIxNTcuMjIiIHdpZHRoPSIyNjcuMTkiIGhlaWdodD0iMTMuOTMiIHJ4PSIyLjEiIHJ5PSIyLjEiLz48cmVjdCBjbGFzcz0iY2xzLTgiIHg9IjMyOS42NyIgeT0iMjgxLjkzIiB3aWR0aD0iMjg5Ljc0IiBoZWlnaHQ9IjEzLjkzIiByeD0iMi4wNyIgcnk9IjIuMDciLz48cG9seWdvbiBjbGFzcz0iY2xzLTciIHBvaW50cz0iNDYzLjIyIDE3MC4xNiA0NjMuMjIgMCA0ODEuNjQgMCA0ODEuNjQgMTcwLjE2IDQ2My4yMiAxNzAuMTYiLz48cGF0aCBjbGFzcz0iY2xzLTciIGQ9Ik01NjguMDQsMTA4LjUxVjMzLjYyYzAtLjY0LjUyLTEuMTYsMS4xNi0xLjE2aDE2LjExYy42NCwwLDEuMTYuNTIsMS4xNiwxLjE2djc0Ljg5YzAsLjY0LS41MiwxLjE2LTEuMTYsMS4xNmgtMTYuMTFjLS42NCwwLTEuMTYtLjUyLTEuMTYtMS4xNloiLz48cmVjdCBjbGFzcz0iY2xzLTgiIHg9IjM2OC43NiIgeT0iMTg3LjA4IiB3aWR0aD0iMjExLjU2IiBoZWlnaHQ9IjEzLjkzIiByeD0iMi4xNCIgcnk9IjIuMTQiLz48cmVjdCBjbGFzcz0iY2xzLTgiIHg9IjM2OC43NiIgeT0iMjE5LjU3IiB3aWR0aD0iMjExLjU2IiBoZWlnaHQ9IjEzLjkzIiByeD0iMi4xNCIgcnk9IjIuMTQiLz48cmVjdCBjbGFzcz0iY2xzLTgiIHg9IjM2OC43NiIgeT0iMjUyLjA3IiB3aWR0aD0iMjExLjU2IiBoZWlnaHQ9IjEzLjkzIiByeD0iMi4xNCIgcnk9IjIuMTQiLz48cGF0aCBjbGFzcz0iY2xzLTciIGQ9Ik00NjMuMjIsMjY0di03Mi4zYzAtMS4xLjktMiwyLTJoMTQuNDNjMS4xLDAsMiwuOSwyLDJ2NzIuM2MwLDEuMS0uOSwyLTIsMmgtMTQuNDNjLTEuMSwwLTItLjktMi0yWiIvPjxwYXRoIGNsYXNzPSJjbHMtNyIgZD0iTTM2Mi42MiwyNjMuOTZ2LTc0Ljg1YzAtMS4xMi45MS0yLjAzLDIuMDMtMi4wM2gxNC4zNmMxLjEyLDAsMi4wMy45MSwyLjAzLDIuMDN2NzQuODVjMCwxLjEyLS45MSwyLjAzLTIuMDMsMi4wM2gtMTQuMzZjLTEuMTIsMC0yLjAzLS45MS0yLjAzLTIuMDNaIi8+PHBhdGggY2xhc3M9ImNscy03IiBkPSJNNTY4LjA0LDI2My45NnYtNzQuODVjMC0xLjEyLjkxLTIuMDMsMi4wMy0yLjAzaDE0LjM2YzEuMTIsMCwyLjAzLjkxLDIuMDMsMi4wM3Y3NC44NWMwLDEuMTItLjkxLDIuMDMtMi4wMywyLjAzaC0xNC4zNmMtMS4xMiwwLTIuMDMtLjkxLTIuMDMtMi4wM1oiLz48L2c+PHBhdGggY2xhc3M9ImNscy0xIiBkPSJNOTgzLjgxLDM0NC41N2wtMjk1LjIsNDAuNzdjLTYuMDIuODMtMTEuNTctMy4zNy0xMi40LTkuMzlsLTQwLjc3LTI5NS4yYy0uODMtNi4wMiwzLjM3LTExLjU3LDkuMzktMTIuNGwyOTUuMi00MC43N2M2LjAyLS44MywxMS41NywzLjM3LDEyLjQsOS4zOWw0MC43NywyOTUuMmMuODMsNi4wMi0zLjM3LDExLjU3LTkuMzksMTIuNFoiLz48cGF0aCBjbGFzcz0iY2xzLTMiIGQ9Ik05NjIuOTUsMzI4Ljc4bC0yOTUuMiw0MC43N2MtNi4wMi44My0xMS41Ny0zLjM3LTEyLjQtOS4zOWwtNDAuNzctMjk1LjJjLS44My02LjAyLDMuMzctMTEuNTcsOS4zOS0xMi40TDkxOS4xNywxMS43OWM2LjAyLS44MywxMS41NywzLjM3LDEyLjQsOS4zOWw0MC43NywyOTUuMmMuODMsNi4wMi0zLjM3LDExLjU3LTkuMzksMTIuNFoiLz48ZyBjbGFzcz0iY2xzLTkiPjxwYXRoIGNsYXNzPSJjbHMtNyIgZD0iTTkxNi42NCw1Ny4zN2wtMjQ0Ljc4LDMzLjgxYy0xLjA5LjE1LTIuMS0uNjEtMi4yNS0xLjcxbC0xLjM2LTkuODRjLS4xNS0xLjA5LjYxLTIuMSwxLjcxLTIuMjVsMjQ0Ljc4LTMzLjgxYzEuMDktLjE1LDIuMS42MSwyLjI1LDEuNzFsMS4zNiw5Ljg0Yy4xNSwxLjA5LS42MSwyLjEtMS43MSwyLjI1WiIvPjxwYXRoIGNsYXNzPSJjbHMtNyIgZD0iTTY4Ni4xNCwxNjEuODFsLTQyLjg2LTE3LjQ0Yy0uNjEtLjI1LTEuMDQtLjgxLTEuMTItMS40NmwtMS40NC0xMS43MWMtLjE3LTEuMzcsMS4yLTIuNDIsMi40OC0xLjlsNDIuMzcsMTcuMjRjLjU5LjI0LDEuMDEuNzcsMS4xMSwxLjM5bDEuOTMsMTEuOTFjLjIzLDEuNC0xLjE2LDIuNS0yLjQ3LDEuOTdaIi8+PHBhdGggY2xhc3M9ImNscy03IiBkPSJNNjYxLjE5LDI2MC43OGwzNi41My0yOC40Yy41Mi0uNC43OC0xLjA2LjY4LTEuNzFsLTEuNzktMTEuNjZjLS4yMS0xLjM3LTEuODEtMi4wMS0yLjkxLTEuMTZsLTM2LjExLDI4LjA4Yy0uNS4zOS0uNzYsMS4wMS0uNjksMS42NGwxLjM3LDExLjk5Yy4xNiwxLjQxLDEuOCwyLjEsMi45MiwxLjIzWiIvPjxwYXRoIGNsYXNzPSJjbHMtNyIgZD0iTTg5My40OSw5Ni43MWwtMTc1LjIsMjQuMmMtMS4wOS4xNS0yLjEtLjYxLTIuMjUtMS43MWwtMS4zNi05Ljg0Yy0uMTUtMS4wOS42MS0yLjEsMS43MS0yLjI1bDE3NS4yLTI0LjJjMS4wOS0uMTUsMi4xLjYxLDIuMjUsMS43MWwxLjM2LDkuODRjLjE1LDEuMDktLjYxLDIuMS0xLjcxLDIuMjVaIi8+PHBhdGggY2xhc3M9ImNscy03IiBkPSJNNjY5LjcxLDc3LjQxYy0xLC4xNC0xLjcsMS4wNy0xLjU1LDIuMDcsMi4zOCwxNS43MSwyNi43NiwxODEuMjUsMjguNjQsMTk4LjIxLDIuMDYsMTguNi02LjExLDM0LjY0LTE5LjgyLDM3LjY0LS45My4yLTEuNTQsMS4wOC0xLjQxLDIuMDFsMS45NSwxNC4xYy4xNCwxLjAzLDEuMTIsMS43MiwyLjE0LDEuNTQsMjEuNDctMy44NywzOC45NS0yMi44MSwzNC4xNC01Ny42NGwtMjcuNC0xOTguNGMtLjE0LS45OS0xLjA1LTEuNjktMi4wNS0xLjU1bC0xNC42NCwyLjAyWiIvPjxwYXRoIGNsYXNzPSJjbHMtNyIgZD0iTTkxNy4wOCwzMTMuODhsLTMxLjc4LTIzMC4wOCwxNi4yOS0yLjI1YzEuMDgtLjE1LDIuMDguNjEsMi4yMywxLjY5bDMxLjUxLDIyOC4xMmMuMTUsMS4wOC0uNjEsMi4wOC0xLjY5LDIuMjNsLTE0LjMzLDEuOThjLTEuMDguMTUtMi4wOC0uNjEtMi4yMy0xLjY5WiIvPjxwYXRoIGNsYXNzPSJjbHMtNyIgZD0iTTc0OS4wMSwzNTguMzRsLTM0LjM5LTI0OC45NmMtLjE1LTEuMDkuNjEtMi4xLDEuNy0yLjI1bDE0LjMtMS45OGMxLjA5LS4xNSwyLjEuNjEsMi4yNSwxLjdsMzQuMzksMjQ4Ljk2LTE4LjI1LDIuNTJaIi8+PHBhdGggY2xhc3M9ImNscy03IiBkPSJNODg3LjQ5LDMxNi41OGwtMjcuODctNTIuNzRjLS41NS0xLjA1LjAzLTIuMzQsMS4xOS0yLjYxbDEwLjM0LTIuNDVjLjgtLjE5LDEuNjQuMTksMi4wMi45MmwyNi44NCw1MC43OGMuNDguOTEuMTEsMi4wNC0uODMsMi40OWwtOS4zMSw0LjQxYy0uODguNDItMS45My4wNy0yLjM4LS43OVoiLz48cGF0aCBjbGFzcz0iY2xzLTciIGQ9Ik04MjguODQsMzAyLjIxbC0yMy4wNi0xNjYuOTZjLS4xNS0xLjA5LjYxLTIuMSwxLjcxLTIuMjVsMTQuMjktMS45N2MxLjA5LS4xNSwyLjEuNjEsMi4yNSwxLjcxbDIzLjA2LDE2Ni45NmMuMTUsMS4wOS0uNjEsMi4xLTEuNzEsMi4yNWwtMTQuMjksMS45N2MtMS4wOS4xNS0yLjEtLjYxLTIuMjUtMS43MVoiLz48cGF0aCBjbGFzcz0iY2xzLTgiIGQ9Ik03NTkuNjYsMTQxLjE2bDEuNDEsMTAuMjFjLjE0Ljk5LDEuMDUsMS42OSwyLjA1LDEuNTUsMjMuNTktMy4zMyw1My4xMy03LjkxLDc5LjEyLTE0LjMyLDkuODctMi40NCwxOC40Ny00Ljg5LDI0LjcyLTcuMi44LS4zLDEuMjktMS4xMSwxLjE3LTEuOTVsLTEuMzQtMTEuMTJjLS4xNi0xLjE1LTEuMzItMS44NS0yLjQxLTEuNDYtMjcuNyw5LjkxLTY0LjAxLDE3LjIyLTEwMy4xOCwyMi4yNi0uOTkuMTMtMS42OCwxLjA1LTEuNTQsMi4wNFoiLz48cGF0aCBjbGFzcz0iY2xzLTgiIGQ9Ik03NzkuOSwzMDYuNDNsMS40MSwxMC4yYy4xNCwxLDEuMDYsMS42OSwyLjA1LDEuNTUsMjIuOTktMy4yNSw0Ni4wNi03LjkyLDcyLjA0LTE0LjM0LDkuODctMi40NCwxOC40Ny00Ljg5LDI0LjcyLTcuMi44LS4zLDEuMjktMS4xMSwxLjE3LTEuOTVsLTEuNC0xMC4xMmMtLjE2LTEuMTUtMS4zMy0xLjg1LTIuNDItMS40NS0yMi40Miw4LjI2LTY0LjI3LDE2Ljc4LTk2LjA0LDIxLjI2LS45OS4xNC0xLjY4LDEuMDUtMS41NCwyLjA0WiIvPjxwYXRoIGNsYXNzPSJjbHMtNyIgZD0iTTg2OC45NCwxNzguNzZsLTk0LjkxLDEzLjExYy0xLjA5LjE1LTIuMS0uNjEtMi4yNS0xLjcxbC0xLjM2LTkuODRjLS4xNS0xLjA5LjYxLTIuMSwxLjcxLTIuMjVsOTQuOTEtMTMuMTFjMS4wOS0uMTUsMi4xLjYxLDIuMjUsMS43MWwxLjM2LDkuODRjLjE1LDEuMDktLjYxLDIuMS0xLjcxLDIuMjVaIi8+PHBhdGggY2xhc3M9ImNscy03IiBkPSJNODc3LjQ3LDI0MC41NGwtOTQuOTEsMTMuMTFjLTEuMDkuMTUtMi4xLS42MS0yLjI1LTEuNzFsLTEuMzYtOS44NGMtLjE1LTEuMDkuNjEtMi4xLDEuNzEtMi4yNWw5NC45MS0xMy4xMWMxLjA5LS4xNSwyLjEuNjEsMi4yNSwxLjcxbDEuMzYsOS44NGMuMTUsMS4wOS0uNjEsMi4xLTEuNzEsMi4yNVoiLz48cGF0aCBjbGFzcz0iY2xzLTciIGQ9Ik03ODAuMzEsMjUxLjk0bC05Ljg5LTcxLjYyYy0uMTUtMS4wOS42MS0yLjEsMS43MS0yLjI1bDE0LjI5LTEuOTdjMS4wOS0uMTUsMi4xLjYxLDIuMjUsMS43MWw5Ljg5LDcxLjYyYy4xNSwxLjA5LS42MSwyLjEtMS43MSwyLjI1bC0xNC4yOSwxLjk3Yy0xLjA5LjE1LTIuMS0uNjEtMi4yNS0xLjcxWiIvPjxwYXRoIGNsYXNzPSJjbHMtNyIgZD0iTTg2MC44MywyNDAuODJsLTkuODktNzEuNjJjLS4xNS0xLjA5LjYxLTIuMSwxLjcxLTIuMjVsMTQuMjktMS45N2MxLjA5LS4xNSwyLjEuNjEsMi4yNSwxLjcxbDkuODksNzEuNjJjLjE1LDEuMDktLjYxLDIuMS0xLjcxLDIuMjVsLTE0LjI5LDEuOTdjLTEuMDkuMTUtMi4xLS42MS0yLjI1LTEuNzFaIi8+PHBvbHlnb24gY2xhc3M9ImNscy03IiBwb2ludHM9Ijc4My43MiA3NS4zNSA3NzQuNTUgMzEuNzYgNzkyLjgxIDI5LjI0IDgwMS45NyA3Mi44MyA3ODMuNzIgNzUuMzUiLz48cGF0aCBjbGFzcz0iY2xzLTciIGQ9Ik05NzEuMjQsMzA4LjM4bC00NC40LDYuMTNjLTEuMDkuMTUtMi4xLS42MS0yLjI1LTEuNzFsLTEuMzYtOS44NGMtLjE1LTEuMDkuNjEtMi4xLDEuNzEtMi4yNWw0NC40LTYuMTMsMS45MSwxMy44WiIvPjwvZz48L3N5bWJvbD48L2RlZnM+PHVzZSBpZD0ibG9nb190dyIgd2lkdGg9Ijk5My4zIiBoZWlnaHQ9IjM4NS40NSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLjMpIHNjYWxlKC41MikiIHhsaW5rOmhyZWY9IiNf5paw5aKe56ym6JmfIi8+PC9zdmc+"};
            for(const link of methods.querySelectorAll('a')){const brand=Object.keys(paymentLogos).find(name=>link.textContent.includes(name));if(brand){link.querySelectorAll('svg,img').forEach(n=>n.remove());const logo=document.createElement('img');logo.className='ani-payment-logo';logo.src=paymentLogos[brand];logo.alt=brand;link.prepend(logo);}}
            for(const link of methods.querySelectorAll('a'))if(!link.querySelector('img,svg')){
              const label=link.textContent.trim();
              const path=label.includes('信用卡')?'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18m-13 5h4"/>':label.includes('全家')?'<path d="M3 10h18l-2-6H5zM5 10v10h14V10M9 20v-6h6v6"/>':label.includes('電信')?'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>':'<path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4Z"/><path d="M15 8v8"/>';
              link.insertAdjacentHTML('afterbegin',accountIcon(path));
            }
            const cardBrands={"Visa": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIYAAACGCAYAAAAYefKRAAAACXBIWXMAAC4jAAAuIwF4pT92AAAE9ElEQVR42u2czY2jQBBGJwQODoAQODgAQiAEQiAEQnAIHQIhcPeFEAiBDLw7EiOtRva6q+srmF29J/VpNPTfR1V1VeOPDwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4d7hc762wNeKxNZ6+jWOvHGMcLtd7+v2c+XK9r5fr/fGtbfvfpsv1Pnr6E+xlk/uwh7h9LkwnmGRt7PfmmVuBGNK+4Z61WnZRVY516nbB5Y5ly31w/7mo+yCVAhmdwhiN/dVP3p7sDTIIYg54mVqHtSrpry55S/tdgYoJ1w5hrIZ+JqewUoBQLa0qWJ/KYbE6rykfjBv01rwbzKNrokZx9282YAkUxVq4RrezrPn3jSoxoXNhf5N3YY2Cbk4SRZa1EluL4n3524AG6yAOCDoH7zNEAi1tQ8Ea9d5+I463KTLOMPry7Zl/NrqiOWrxowJPkRVr1MJoIgMdowtIAnGNAaY60qK2or77CKuxRQQ6BZN+FRvMzsC1xFrM+//VL+bV79Z29fj6AostPRgog8M5aNKzKGlXC2KLvsDqJuvm7JZMZa3mCGFY3qgtaNK9wNWtAouof/MOyqVEDLBWJ3CMJ55NJNpJIND2QGGsPyHjqhxkK37eKHJHoyDOSQeJIlfwk2Eth4iBJlUAWrAZtego14qi/v4AYeQG1L1hb9LZccYkFNm7Z7ldXKFZniJK6UbXvRnd8nJ2nLEIg85WZHmWAF++7QFidZJ1TtZ1OD0YEgWdqzBqT0EFqi+B9KI1tiTb2gKr154dZ7SCt7MX5leGN9ZQkfl0X1oyuOy1MNYaI4TROYtdrbcuoq6oegqGEfGHYU63Qqs3RQij8iSCjBYnKXMrB6efv4TdGNe3LT2plVoapTiWkhRsQaGqFlqvqDS99Ghr6HtxZoCrCGHcSt5S43F3zhjHGJXGFqeisyyH0QIOzmN3d3ac0RQmovqMccyRC7GbdVVKes2Il0ZBPmY+MwCtrBuiKHSpK6pG66E4sQyiqw2TwJrPZ8cZozqdXiC0TfQyeAWyirLKvcCab1HCyDV7c0HQmVOZlaXnCwUi/bzC4AI2YZxSRwijtWQE1ZVLtQUqmH9TeA+zdVq/OeOTxPMCUKOPX9Tp2ohnFlqPVSAM9fH43AtHAZ/uLQGifERVQD/KPpRqnbkdZZvPjjOkiaCIb1QPcKmvhDGcJIrQSmsrTgJVmf0OoopqLVgD6+3yJvjq3rnfmjgvuLj8nbCiuuytL5x7Y3QDm9MNRbQ+ShiHfyWvqqg+sVjp1XciT46EJTmNFLR2PzIAVfjIydBfpfChGW7w6xdxvjeP6W9LK8OBbYkSRiMYXGfoT1JRDf7ti5xK8+2HCOMRGZmHpIkjK6oHm/Htyd0Jy5qlfd7Wdu53Ms5FHox9SSqqB58GOsdJZnPcBFsi9uCoOKMKtE614uaXOuo3Zm2TY1/O+9bEGWekwH42Ybay9P5FI1ir7oAXdomMM9bo5IqqonpA4Hn7y0WaFBV/OROQVZQwUnSe3hjJj2/yEDdxnLHtz6xVR21FjuEnBKDdi3P/q9YVCiP3+Y3BPf35K78WIcxfv/obtEaNYF9y1yz8W9z/goifmgYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAkPEL3gdNSNmsQqQAAAAASUVORK5CYII=", "Mastercard": "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDIzLjAuMSwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIKCSBpZD0ic3ZnMzQwOSIgaW5rc2NhcGU6dmVyc2lvbj0iMC45MSByMTM3MjUiIHNvZGlwb2RpOmRvY25hbWU9Ik1hc3RlckNhcmQgMjAxNi5zdmciIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6aW5rc2NhcGU9Imh0dHA6Ly93d3cuaW5rc2NhcGUub3JnL25hbWVzcGFjZXMvaW5rc2NhcGUiIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIiB4bWxuczpzdmc9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgoJIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IiB3aWR0aD0iOTk5LjJweCIgaGVpZ2h0PSI3NzZweCIKCSB2aWV3Qm94PSIwIDAgOTk5LjIgNzc2IiBlbmFibGUtYmFja2dyb3VuZD0ibmV3IDAgMCA5OTkuMiA3NzYiIHhtbDpzcGFjZT0icHJlc2VydmUiPgo8cGF0aCBpZD0iWE1MSURfMTc3NV8iIGlua3NjYXBlOmNvbm5lY3Rvci1jdXJ2YXR1cmU9IjAiIGQ9Ik0xODEuMSw3NzQuM3YtNTEuNWMwLTE5LjctMTItMzIuNi0zMi42LTMyLjYKCWMtMTAuMywwLTIxLjUsMy40LTI5LjIsMTQuNmMtNi05LjQtMTQuNi0xNC42LTI3LjUtMTQuNmMtOC42LDAtMTcuMiwyLjYtMjQsMTJ2LTEwLjNoLTE4djgyLjRoMTh2LTQ1LjVjMC0xNC42LDcuNy0yMS41LDE5LjctMjEuNQoJczE4LDcuNywxOCwyMS41djQ1LjVoMTh2LTQ1LjVjMC0xNC42LDguNi0yMS41LDE5LjctMjEuNWMxMiwwLDE4LDcuNywxOCwyMS41djQ1LjVIMTgxLjF6IE00NDguMSw2OTEuOWgtMjkuMlY2NjdoLTE4djI0LjloLTE2LjMKCXYxNi4zaDE2LjN2MzcuOGMwLDE4LjksNy43LDMwLDI4LjMsMzBjNy43LDAsMTYuMy0yLjYsMjIuMy02bC01LjItMTUuNWMtNS4yLDMuNC0xMS4yLDQuMy0xNS41LDQuM2MtOC42LDAtMTItNS4yLTEyLTEzLjd2LTM2LjkKCWgyOS4yVjY5MS45eiBNNjAwLjksNjkwLjFjLTEwLjMsMC0xNy4yLDUuMi0yMS41LDEydi0xMC4zaC0xOHY4Mi40aDE4di00Ni40YzAtMTMuNyw2LTIxLjUsMTcuMi0yMS41YzMuNCwwLDcuNywwLjksMTEuMiwxLjcKCWw1LjItMTcuMkM2MDkuNCw2OTAuMSw2MDQuMyw2OTAuMSw2MDAuOSw2OTAuMUw2MDAuOSw2OTAuMXogTTM3MCw2OTguN2MtOC42LTYtMjAuNi04LjYtMzMuNS04LjZjLTIwLjYsMC0zNC4zLDEwLjMtMzQuMywyNi42CgljMCwxMy43LDEwLjMsMjEuNSwyOC4zLDI0bDguNiwwLjljOS40LDEuNywxNC42LDQuMywxNC42LDguNmMwLDYtNi45LDEwLjMtMTguOSwxMC4zYy0xMiwwLTIxLjUtNC4zLTI3LjUtOC42bC04LjYsMTMuNwoJYzkuNCw2LjksMjIuMywxMC4zLDM1LjIsMTAuM2MyNCwwLDM3LjgtMTEuMiwzNy44LTI2LjZjMC0xNC42LTExLjItMjIuMy0yOC4zLTI0LjlsLTguNi0wLjljLTcuNy0wLjktMTMuNy0yLjYtMTMuNy03LjcKCWMwLTYsNi05LjQsMTUuNS05LjRjMTAuMywwLDIwLjYsNC4zLDI1LjgsNi45TDM3MCw2OTguN0wzNzAsNjk4Ljd6IE04NDguOSw2OTAuMWMtMTAuMywwLTE3LjIsNS4yLTIxLjUsMTJ2LTEwLjNoLTE4djgyLjRoMTh2LTQ2LjQKCWMwLTEzLjcsNi0yMS41LDE3LjItMjEuNWMzLjQsMCw3LjcsMC45LDExLjIsMS43TDg2MSw2OTFDODU3LjUsNjkwLjEsODUyLjQsNjkwLjEsODQ4LjksNjkwLjFMODQ4LjksNjkwLjF6IE02MTguOSw3MzMuMQoJYzAsMjQuOSwxNy4yLDQyLjksNDMuOCw0Mi45YzEyLDAsMjAuNi0yLjYsMjkuMi05LjRsLTguNi0xNC42Yy02LjksNS4yLTEzLjcsNy43LTIxLjUsNy43Yy0xNC42LDAtMjQuOS0xMC4zLTI0LjktMjYuNgoJYzAtMTUuNSwxMC4zLTI1LjgsMjQuOS0yNi42YzcuNywwLDE0LjYsMi42LDIxLjUsNy43bDguNi0xNC42Yy04LjYtNi45LTE3LjItOS40LTI5LjItOS40QzYzNi4xLDY5MC4xLDYxOC45LDcwOC4yLDYxOC45LDczMy4xCglMNjE4LjksNzMzLjFMNjE4LjksNzMzLjF6IE03ODUuNCw3MzMuMXYtNDEuMmgtMTh2MTAuM2MtNi03LjctMTQuNi0xMi0yNS44LTEyYy0yMy4yLDAtNDEuMiwxOC00MS4yLDQyLjljMCwyNC45LDE4LDQyLjksNDEuMiw0Mi45CgljMTIsMCwyMC42LTQuMywyNS44LTEydjEwLjNoMThWNzMzLjFMNzg1LjQsNzMzLjF6IE03MTkuMyw3MzMuMWMwLTE0LjYsOS40LTI2LjYsMjQuOS0yNi42YzE0LjYsMCwyNC45LDExLjIsMjQuOSwyNi42CgljMCwxNC42LTEwLjMsMjYuNi0yNC45LDI2LjZDNzI4LjgsNzU4LjgsNzE5LjMsNzQ3LjYsNzE5LjMsNzMzLjFMNzE5LjMsNzMzLjF6IE01MDMuOSw2OTAuMWMtMjQsMC00MS4yLDE3LjItNDEuMiw0Mi45CgljMCwyNS44LDE3LjIsNDIuOSw0Mi4xLDQyLjljMTIsMCwyNC0zLjQsMzMuNS0xMS4ybC04LjYtMTIuOWMtNi45LDUuMi0xNS41LDguNi0yNCw4LjZjLTExLjIsMC0yMi4zLTUuMi0yNC45LTE5LjdoNjAuOQoJYzAtMi42LDAtNC4zLDAtNi45QzU0Mi41LDcwNy4zLDUyNyw2OTAuMSw1MDMuOSw2OTAuMUw1MDMuOSw2OTAuMUw1MDMuOSw2OTAuMXogTTUwMy45LDcwNS42YzExLjIsMCwxOC45LDYuOSwyMC42LDE5LjdoLTQyLjkKCUM0ODMuMyw3MTQuMiw0OTEsNzA1LjYsNTAzLjksNzA1LjZMNTAzLjksNzA1LjZ6IE05NTEuMSw3MzMuMXYtNzMuOGgtMTh2NDIuOWMtNi03LjctMTQuNi0xMi0yNS44LTEyYy0yMy4yLDAtNDEuMiwxOC00MS4yLDQyLjkKCWMwLDI0LjksMTgsNDIuOSw0MS4yLDQyLjljMTIsMCwyMC42LTQuMywyNS44LTEydjEwLjNoMThWNzMzLjFMOTUxLjEsNzMzLjF6IE04ODUsNzMzLjFjMC0xNC42LDkuNC0yNi42LDI0LjktMjYuNgoJYzE0LjYsMCwyNC45LDExLjIsMjQuOSwyNi42YzAsMTQuNi0xMC4zLDI2LjYtMjQuOSwyNi42Qzg5NC40LDc1OC44LDg4NSw3NDcuNiw4ODUsNzMzLjFMODg1LDczMy4xeiBNMjgyLjQsNzMzLjF2LTQxLjJoLTE4djEwLjMKCWMtNi03LjctMTQuNi0xMi0yNS44LTEyYy0yMy4yLDAtNDEuMiwxOC00MS4yLDQyLjljMCwyNC45LDE4LDQyLjksNDEuMiw0Mi45YzEyLDAsMjAuNi00LjMsMjUuOC0xMnYxMC4zaDE4VjczMy4xTDI4Mi40LDczMy4xegoJIE0yMTUuNSw3MzMuMWMwLTE0LjYsOS40LTI2LjYsMjQuOS0yNi42YzE0LjYsMCwyNC45LDExLjIsMjQuOSwyNi42YzAsMTQuNi0xMC4zLDI2LjYtMjQuOSwyNi42CglDMjI0LjksNzU4LjgsMjE1LjUsNzQ3LjYsMjE1LjUsNzMzLjF6Ii8+CjxnPgoJPHJlY3QgaWQ9InJlY3QxOSIgeD0iMzY0IiB5PSI2Ni4xIiBmaWxsPSIjRkY1QTAwIiB3aWR0aD0iMjcwLjQiIGhlaWdodD0iNDg1LjgiLz4KCTxwYXRoIGlkPSJYTUxJRF8zMzBfIiBpbmtzY2FwZTpjb25uZWN0b3ItY3VydmF0dXJlPSIwIiBmaWxsPSIjRUIwMDFCIiBkPSJNMzgyLDMwOWMwLTk4LjcsNDYuNC0xODYuMywxMTcuNi0yNDIuOQoJCUM0NDcuMiwyNC45LDM4MS4xLDAsMzA5LDBDMTM4LjIsMCwwLDEzOC4yLDAsMzA5czEzOC4yLDMwOSwzMDksMzA5YzcyLjEsMCwxMzguMi0yNC45LDE5MC42LTY2LjFDNDI4LjMsNDk2LjEsMzgyLDQwNy43LDM4MiwzMDl6IgoJCS8+Cgk8cGF0aCBpZD0icGF0aDIyIiBpbmtzY2FwZTpjb25uZWN0b3ItY3VydmF0dXJlPSIwIiBmaWxsPSIjRjc5RTFCIiBkPSJNOTk5LjIsMzA5YzAsMTcwLjgtMTM4LjIsMzA5LTMwOSwzMDkKCQljLTcyLjEsMC0xMzguMi0yNC45LTE5MC42LTY2LjFjNzIuMS01Ni43LDExNy42LTE0NC4yLDExNy42LTI0Mi45UzU3MC44LDEyMi43LDQ5OS42LDY2LjFDNTUxLjksMjQuOSw2MTgsMCw2OTAuMSwwCgkJQzg2MSwwLDk5OS4yLDEzOS4xLDk5OS4yLDMwOXoiLz4KPC9nPgo8L3N2Zz4K"};for(const link of methods.querySelectorAll('a')){if(link.textContent.trim()==='信用卡'){link.querySelectorAll('svg').forEach(n=>n.remove());for(const [name,src] of Object.entries(cardBrands)){const img=document.createElement('img');img.src=src;img.alt=name;img.className='ani-payment-logo ani-brand-'+name.toLowerCase();link.insertBefore(img,link.childNodes[[...link.childNodes].findIndex(n=>n.nodeType===3)]||null);}}if(link.textContent.includes('全家')){link.setAttribute('aria-label','全家超商代收');}}
            methods.setAttribute('role','group');methods.setAttribute('aria-label','選擇付款方式');

            const setOpen=open=>{trigger.setAttribute('aria-expanded',String(open));card.classList.toggle('ani-methods-open',open);methods.style.display=open?'flex':'none';};
            trigger.addEventListener('pointerenter', event => {
              if (event.pointerType === 'mouse') setOpen(true);
            });
            card.addEventListener('pointerleave', event => {
              if (event.pointerType === 'mouse' && !methods.contains(document.activeElement)) setOpen(false);
            });
            card.addEventListener('focusout',()=>requestAnimationFrame(()=>{if(!card.contains(document.activeElement))setOpen(false);}));
            trigger.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(e.detail===0||!trigger.matches(':hover')||trigger.getAttribute('aria-expanded')!=='true')setOpen(trigger.getAttribute('aria-expanded')!=='true');});trigger.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setOpen(true);}if(e.key==='Escape')setOpen(false);});methods.addEventListener('keydown',e=>{if(e.key==='Escape'){setOpen(false);trigger.focus();}});
          }
          const money=card.querySelector('.programoney');
          if(money){for(const node of [...money.childNodes]){if(node.nodeType===3&&/原價/.test(node.textContent)){const original=document.createElement('span');original.className='ani-original-price';original.textContent=node.textContent.trim();node.replaceWith(original);}else if(node.nodeType===1&&/原價/.test(node.textContent)&&!node.querySelector('.money-main'))node.classList.add('ani-original-price');}}
          grid.append(card);
        }
        fallback.remove();grid.hidden=false;membership.dataset.aniPlans='loaded';return true;
      };
      const loadRenderedPlans=()=>{
        const frame=document.createElement('iframe');frame.hidden=true;frame.style.setProperty('display','none','important');frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.src='animePay.php';
        let watcher,timeout;const cleanup=()=>{watcher?.disconnect();clearTimeout(timeout);frame.remove();};
        frame.addEventListener('load',()=>{try{const doc=frame.contentDocument;if(!doc)return;if(mountPlans(doc)){cleanup();return;}watcher=new MutationObserver(()=>{if(mountPlans(doc))cleanup();});watcher.observe(doc.documentElement,{childList:true,subtree:true});}catch{cleanup();fallback.textContent='開啟完整付費方案';grid.hidden=false;membership.dataset.aniPlans='failed';}});
        timeout=setTimeout(()=>{cleanup();if(membership.dataset.aniPlans!=='loaded'){grid.hidden=false;membership.dataset.aniPlans='failed';fallback.textContent='開啟完整付費方案';}},12000);document.body.append(frame);
      };
      aniFetch(new URL('animePay.php',location.href).href,{credentials:'include',signal:AbortSignal.timeout(12000)}).then(r=>{if(!r.ok)throw new Error('plans unavailable');return r.text();}).then(html=>{if(!mountPlans(new DOMParser().parseFromString(html,'text/html')))loadRenderedPlans();}).catch(()=>{grid.hidden=false;membership.dataset.aniPlans='failed';fallback.textContent='開啟完整付費方案';});
    }
    for(const item of document.querySelectorAll('.userpay-precautions .item > svg'))item.remove();
    const status=document.querySelector('.status-info');
    if(status&&!status.parentElement.querySelector('.ani-membership-summary')){
      const text=status.textContent,plan=status.querySelector('.status-info-program')?.textContent.trim();
      const end=text.match(/最終服務到期日為\s*([\d-]+\s[\d:]+)/)?.[1],renew=text.match(/預定下一期扣款日\s*([\d-]+\s[\d:]+)/)?.[1];
      if(plan){const summary=document.createElement('div');summary.className='ani-membership-summary';for(const [label,value] of [['目前方案',plan],['服務到期',end],['下次扣款',renew]]){if(!value)continue;const cell=document.createElement('div'),name=document.createElement('span'),detail=document.createElement('strong');name.textContent=label;detail.textContent=value;cell.append(name,detail);summary.append(cell);}status.dataset.aniOriginalStatus='true';status.closest('.usercard')?.classList.add('ani-status-shell');status.after(summary);}
    }
    for(const label of document.querySelectorAll('.ani-membership-summary > div > span:not([data-ani-icon])')){label.dataset.aniIcon='true';label.insertAdjacentHTML('afterbegin',accountIcon(label.textContent==='目前方案'?headingIcons['購買方案']:label.textContent==='服務到期'?headingIcons['結束時間']:headingIcons['開始時間']));}
    if(membership){
      const ledger=membership.querySelector('.usercard:has(.record-list)');
      if(ledger&&!ledger.previousElementSibling?.classList.contains('ani-ledger-heading')){const heading=document.createElement('h2');heading.className='ani-account-section-title ani-ledger-heading';heading.textContent='購買紀錄';heading.insertAdjacentHTML('afterbegin',accountIcon('<path d="M5 3h14v18l-3-2-4 2-4-2-3 2Z"/><path d="M8 8h8m-8 4h8m-8 4h5"/>'));ledger.before(heading);}
      if(!membership.querySelector('.ani-membership-footer')){
        const notes=membership.querySelector('.userpay-precautions'),other=document.querySelector('.payarea-content.other'),cancel=other?.querySelector('.paycard');
        if(notes||cancel){const footer=document.createElement('div');footer.className='ani-membership-footer';membership.append(footer);
          if(notes){const oldCard=notes.closest('.usercard'),pane=document.createElement('section'),heading=document.createElement('h2');pane.className='ani-membership-notes';heading.className='ani-account-section-title';heading.textContent='注意事項';heading.insertAdjacentHTML('afterbegin',accountIcon('<path d="M12 3 2 21h20Z"/><path d="M12 9v5m0 3v.1"/>'));notes.querySelector(':scope > div:not(.item)')?.remove();pane.append(heading,notes);footer.append(pane);if(oldCard&&!oldCard.children.length)oldCard.remove();}
          if(cancel){const pane=document.createElement('section'),heading=document.createElement('h2'),body=document.createElement('div'),description=document.createElement('p');pane.className='ani-membership-renewal';heading.className='ani-account-section-title';heading.textContent='自動扣款管理';heading.insertAdjacentHTML('afterbegin',accountIcon('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18m5 5h4"/>'));body.className='ani-renewal-body';description.textContent='管理目前方案的自動續訂。';cancel.querySelector('.ani-cancel-renew-icon')?.remove();cancel.insertAdjacentHTML('afterbegin',accountIcon('<circle cx="12" cy="12" r="9"/><path d="M7 12h10"/>').replace('ani-account-icon','ani-account-icon ani-cancel-renew-icon'));body.append(description,cancel);pane.append(heading,body);footer.append(pane);if(other)other.hidden=true;}
        }
      }
    }
    const party=document.querySelector('.party-kv-block');
    if(location.pathname==='/party_entrance.php'&&party&&!party.dataset.aniParty){
      party.dataset.aniParty='true';
      const heading=party.querySelector('.party-info h4'),description=party.querySelector('.party-info .content'),start=party.querySelector('#startParty');
      if(heading){heading.textContent='一起開場，同步追番';heading.insertAdjacentHTML('afterbegin','<svg class="ani-party-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 4h18v13H3zM7 19h10v2H7z"/><path d="m10 7 5 3-5 3Z" fill="#143443"/></svg>');}
      if(description)description.textContent='和同好同步看動畫，即時聊天，一起吐槽。';
      if(start){start.textContent='建立動畫派對';start.insertAdjacentHTML('afterbegin','<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8Z"/></svg>');}
    }
    if(location.pathname==='/party_entrance.php')for(const block of document.querySelectorAll('.common-content')){const heading=block.querySelector('.theme-title'),body=block.querySelector('.party-entrance-desc-block');if(heading&&body){block.classList.add('ani-party-secondary');if(!heading.querySelector('.ani-account-icon'))heading.insertAdjacentHTML('afterbegin',accountIcon(heading.textContent.includes('更新')?'<path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/>':'<path d="M12 3 2 21h20Z"/><path d="M12 9v5m0 3v.1"/>'));}}
    const accountPage = /\/(?:animePay(?:ed|Router)?|animeAgeValidate|redeem)\.php$/i.test(location.pathname);
    document.body?.classList.toggle('ani-account-page', accountPage);
    document.body?.classList.toggle('ani-account-has-plans', accountPage && Boolean(document.querySelector('.pay-state')));
    if (!settings.themeEnabled) return;
    for (const toggle of document.querySelectorAll('.pay-state .list-morebtn:not([data-ani-expand])')) {
      toggle.dataset.aniExpand = 'true';
      toggle.setAttribute('role','button'); toggle.tabIndex = 0;
      toggle.setAttribute('aria-label','展開全部購買紀錄');
      toggle.setAttribute('aria-controls','historyList');
      const sync = () => {
        const expanded = !document.querySelector('#historyList')?.classList.contains('is-more');
        toggle.setAttribute('aria-expanded',String(expanded));
        const label = expanded ? '收合紀錄' : '展開全部';
        toggle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 ${expanded?'15 6-6 6 6':'9 6 6 6-6'}"/></svg><span>${label}</span>`;
      };
      toggle.addEventListener('click',()=>requestAnimationFrame(sync));
      toggle.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle.click();}});
      const history = document.querySelector('#historyList');
      if(history) new MutationObserver(sync).observe(history,{attributes:true,attributeFilter:['class']});
      sync();
    }
    if(window.self!==window.top)return;
    for (const link of document.querySelectorAll('.mainmenu a[href="redeem.php"]:not([data-ani-redeem])')) {
      link.dataset.aniRedeem = 'true';
      const prepare = () => {
        let modal = document.querySelector('#ani-redeem-modal');
        if(!modal){
          modal = document.createElement('dialog'); modal.id='ani-redeem-modal'; modal.className='ani-account-modal';
          modal.setAttribute('aria-label','序號兌換');
          const close=document.createElement('button');close.type='button';close.className='ani-modal-close';close.setAttribute('aria-label','關閉序號兌換');close.textContent='×';
          close.addEventListener('click',()=>modal.close());
          const frame=document.createElement('iframe');frame.title='序號兌換';frame.src=link.href;
          frame.style.visibility='hidden';
          const loading=document.createElement('p');loading.className='ani-modal-loading';loading.setAttribute('role','status');loading.textContent='正在載入兌換表單…';
          modal.setAttribute('aria-busy','true');
          frame.addEventListener('load',()=>{
            const doc=frame.contentDocument;if(!doc)return;
            if(!doc.querySelector('meta[name="darkreader-lock"]')){const lock=doc.createElement('meta');lock.name='darkreader-lock';doc.head.append(lock);}
            doc.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();modal.close();}});
            const style=doc.createElement('style');style.textContent='html,body,#BH_background{background:transparent!important;min-width:0!important;margin:0!important;padding:0!important}.top_sky,.mainmenu,.universal-bigtitle,footer,#ani-view-settings-panel,.ani-view-settings{display:none!important}#BH_background>.container,.redeem-content{width:100%!important;max-width:none!important;padding:0!important;margin:0!important}.redeem-card{width:100%!important;box-sizing:border-box!important;margin:0!important;padding:32px!important;background:transparent!important;color:#e7edf5!important}.redeem-key{width:100%!important;box-sizing:border-box!important;background:#ffffff0d!important;color:#fff!important;border:1px solid #ffffff26!important;border-radius:12px!important}.redeem-nextbtn{border-radius:999px!important;background:#3dafb6!important;color:#09242b!important}';doc.head.append(style);
            const detailStyle=doc.createElement('style');detailStyle.textContent='.redeem-card .programtitle{display:flex!important;align-items:center;gap:12px;color:#e7edf5!important;font:600 24px/1.4 system-ui,sans-serif!important}.redeem-card .programtitle svg{width:28px;height:28px;flex:none;color:#68cbd2}.redeem-card .redeem-notice{font:14px/1.7 system-ui,sans-serif!important;color:#c4d1df!important;white-space:nowrap!important;margin:20px 0 24px!important}@media(max-width:620px){.redeem-card .redeem-notice{white-space:normal!important}}';doc.head.append(detailStyle);
            const iconStyle=doc.createElement('style');iconStyle.textContent='.redeem-card .programtitle svg{color:#edf3f7!important;fill:none!important}';doc.head.append(iconStyle);const title=doc.querySelector('.redeem-card .programtitle');if(title&&!title.querySelector('svg'))title.insertAdjacentHTML('afterbegin',getNavIconSvg('redeem.php','序號兌換'));
          });
          frame.addEventListener('load',()=>{
            const doc=frame.contentDocument,card=doc?.querySelector('.redeem-card');if(!card)return;
            const syncTheme = () => {
              const light = document.body.classList.contains('ani-light-mode');
              doc.documentElement.style.setProperty('color-scheme', light ? 'light' : 'dark', 'important');
              doc.documentElement.classList.toggle('ani-redeem-light', light);
            };
            syncTheme();
            modal.addEventListener('ani-sync-theme', syncTheme);
            const palette = doc.createElement('style');
            palette.textContent = '.ani-redeem-light .redeem-card :is(.programtitle,.programtitle svg,.redeem-notice,.redeem-key){color:#21384b!important}.ani-redeem-light .redeem-card .redeem-key{background:#fff!important;border-color:#93a6b5!important}';
            palette.textContent += '.ani-redeem-light .redeem-card .redeem-key{color:#20384a!important;-webkit-text-fill-color:#20384a!important}.ani-redeem-light .redeem-card .redeem-key::placeholder{color:#52677a!important;-webkit-text-fill-color:#52677a!important;opacity:1!important}.redeem-card .programtitle svg path{fill:none!important}';
            doc.head.append(palette);
            for(const surface of doc.querySelectorAll('html,body,#BH_background,#BH_background > .container,.redeem-content')){
              for(const [key,value] of Object.entries({background:'transparent',margin:'0',padding:'0','min-height':'0',height:'auto'}))surface.style.setProperty(key,value,'important');
            }
            for(const [key,value] of Object.entries({background:'transparent',border:'0','box-shadow':'none','backdrop-filter':'none','min-height':'0',height:'auto'}))card.style.setProperty(key,value,'important');
            const style=doc.createElement('style');style.textContent='body::before,body::after,footer,.footer-topline,#ani-sort-progress-bar,#ani-history-progress-bar,hr{display:none!important}html,body,#BH_background,.redeem-content,.redeem-card,.programtitle,.redeem-notice{border:0!important;box-shadow:none!important}.redeem-content::before,.redeem-content::after,.redeem-card::before,.redeem-card::after{display:none!important}';doc.head.append(style);
            const fit=()=>{const height=card.scrollHeight+8,limit=window.innerHeight-100;frame.style.height=`${Math.min(height,limit)}px`;doc.documentElement.style.overflow=height>limit?'auto':'hidden';};
            if(typeof ResizeObserver==='function')new ResizeObserver(fit).observe(card);
            requestAnimationFrame(()=>{fit();frame.style.visibility='visible';loading.remove();modal.removeAttribute('aria-busy');modal.dataset.aniReady='true';});
          });
          modal.append(close,loading,frame);document.body.append(modal);
          modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)modal.close();}});
          modal.addEventListener('close',()=>link.focus({preventScroll:true}));
        }
        return modal;
      };
      link.addEventListener('pointerenter',prepare,{once:true});
      link.addEventListener('focus',prepare,{once:true});
      link.addEventListener('click',e=>{
        if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey) return;
        e.preventDefault();
        const modal=prepare();
        modal.dispatchEvent(new Event('ani-sync-theme'));
        if(!modal.open){modal.showModal();animateSiteElement(modal,'fadeIn',180);}
        if(modal.dataset.aniReady==='true')requestAnimationFrame(()=>{const frame=modal.querySelector('iframe'),card=frame.contentDocument?.querySelector('.redeem-card');if(card)frame.style.height=`${Math.min(card.scrollHeight+8,window.innerHeight-100)}px`;});
      });
    }
  }
  const historyMetadata = new Map(), historyMetadataQueue = [];
  let historyMetadataActive = 0;
  function loadHistoryMetadata(id,href) {
    if(!id||!/^\d+$/.test(id)||typeof fetch!=='function')return;
    const url=new URL(href||`animeRef.php?sn=${id}`,location.href);
    if(url.origin!==location.origin||!/^\/anime(?:Video|Ref)\.php$/.test(url.pathname))return;
    const requestKey=`${id}:${url.searchParams.get('sn')||id}`;
    if(historyMetadata.has(requestKey))return;
    historyMetadata.set(requestKey,null);historyMetadataQueue.push({requestKey,url});
    const work=()=>{
      while(historyMetadataActive<2&&historyMetadataQueue.length){
        const {requestKey:key,url}=historyMetadataQueue.shift();historyMetadataActive++;
        (async()=>{
          const cacheKey=`ani-history-meta:${key}`;let meta;
          try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');if(cached?.expires>Date.now())meta=cached.value;}catch{}
          if(!meta){
            const response=await aniFetch(url,{credentials:'include',signal:AbortSignal.timeout(10000)});if(!response.ok)return;
            const doc=new DOMParser().parseFromString(await response.text(),'text/html');
            const tags=[...doc.querySelectorAll('li.type .tag-list .tag')].map(n=>n.textContent.trim()).filter(t=>t&&t.length<30);
            const studioNode=[...doc.querySelectorAll('.title')].find(n=>n.textContent.trim()==='製作廠商')?.parentElement.cloneNode(true);
            studioNode?.querySelector('.title')?.remove();
            let duration;
            for(const script of doc.querySelectorAll('script[type="application/ld+json"]'))try{const value=JSON.parse(script.textContent);for(const video of Array.isArray(value)?value:value['@graph']||[value]){const match=video.duration?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);if(match)duration=Number(match[1]||0)*3600+Number(match[2]||0)*60+Number(match[3]||0);}}catch{}
            const favorite=doc.querySelector('.anime_name button[onclick*="toggleGather"],button[onclick*="animefun.toggleGather"]');
            const ids=favorite?.getAttribute('onclick')?.match(/toggleGather\(\s*(\d+)\s*,\s*(\d+)/);
            meta={tags,studio:studioNode?.textContent.trim().replace(/\s+/g,' ').slice(0,80)||'',duration,favorite:ids?{acgSn:ids[1],animeSn:ids[2],saved:favorite.classList.contains('ordered')}:null};
            try{localStorage.setItem(cacheKey,JSON.stringify({value:meta,expires:Date.now()+5*60000}));}catch{}
          }
          historyMetadata.set(key,meta);enhanceWatchHistory();
        })().catch(()=>{}).finally(()=>{historyMetadataActive--;work();});
      }
    };work();
  }
  window.addEventListener('resize',()=>{if(location.pathname==='/viewList.php')requestAnimationFrame(enhanceWatchHistory);},{passive:true});
  function animateHistoryDrawer(details, open) {
    details.getAnimations?.().forEach(animation => animation.cancel());
    if (open) details.style.display = 'block';
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || typeof details.animate !== 'function') {
      if (!open) details.style.display = 'none';
      return;
    }
    if (open) {
      details.animate(
        [{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 220, easing: 'ease-out' },
      );
      return;
    }
    details.style.display = 'block';
    const animation = details.animate(
      [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-6px)' }],
      { duration: 190, easing: 'ease-in' },
    );
    animation.onfinish = () => { details.style.display = 'none'; };
  }
  globalThis.aniAnimateHistoryDrawer = animateHistoryDrawer;

  const originalHistoryPositions = new WeakMap();
  function enhanceWatchHistory() {
    if(location.pathname!=='/viewList.php'||!settings.themeEnabled)return;
    for(const card of document.querySelectorAll('.user-watch-list > .anime-card')) {
      card.classList.add('ani-history-card');
      const title=card.querySelector('.history-anime-title');
      title?.removeAttribute('title');
      if (title) {
        const original = title.textContent;
        const localized = globalThis.AniEnhancements?.traditionalTitle(original);
        if (localized && localized !== original) title.textContent = localized;
      }
      const source=card.querySelector('.tm-acg-rating,.ani-custom-rating');
      const score=source?.textContent.match(/★\s*([0-5](?:\.\d+)?)/)?.[1];
      if(score&&title){let pill=card.querySelector('.ani-history-score');if(!pill){pill=document.createElement('span');pill.className='ani-history-score';title.after(pill);}const text=`★ ${score}`;if(pill.textContent!==text)pill.textContent=text;}
      const info=card.querySelector('.anime-info'),more=card.querySelector('.more-btn'),id=more?.dataset.anime||card.querySelector('[data-anime-sn]')?.dataset.animeSn;
      const playLink = card.querySelector('.play-btn[href]') || card.querySelector('.click-area[href]');
      const href = playLink?.getAttribute('href'), videoSn = href?.match(/[?&]sn=(\d+)/)?.[1];
      const metadata=historyMetadata.get(`${id}:${videoSn||id}`);
      const savedPlayback = localEpisodeProgress.get(videoSn);
      const data = { ...metadata, duration: savedPlayback?.durationSec || metadata?.duration };
      if(info){
        let meta=info.querySelector('.ani-history-meta:not(.ani-history-studios)');if(!meta){meta=document.createElement('div');meta.className='ani-history-meta';info.append(meta);}
        const markup = globalThis.AniEnhancements?.renderHistoryMetadata(data.tags, data.studio);
        if (markup && meta.dataset.markup !== markup.genres) {
          meta.innerHTML = markup.genres;
          meta.dataset.markup = markup.genres;
        }
        const nativeText=[...info.querySelectorAll('.history-lastwatch')].map(n=>n.textContent).join(' ');
        if (!originalHistoryPositions.has(card)) originalHistoryPositions.set(card, readNativeWatchPosition(card));
        const nativePosition = originalHistoryPositions.get(card);
        const resolved = globalThis.AniEnhancements?.resolveEpisodeProgress?.({
          native: nativePosition, local: savedPlayback, details: metadata,
        });
        const duration = resolved?.duration || data.duration || nativePosition.durationSec;
        const completed = resolved?.completed ?? nativePosition.completed;
        const elapsed = completed && duration ? duration
          : resolved?.elapsed || savedPlayback?.elapsedSec || nativePosition.elapsedSec;
        const fraction = completed ? 1 : resolved?.progress ?? (duration && elapsed ? clamp(elapsed / duration, 0, 1) : nativePosition.fraction);
        let progress = info.querySelector('.progress-bar');
        if (!progress) {
          progress = document.createElement('div');
          progress.className = 'progress-bar';
        }
        let fill = progress.querySelector('.progress');
        if (!fill) {
          fill = document.createElement('div');
          fill.className = 'progress';
          progress.append(fill);
        }
        const progressFraction = Number.isFinite(fraction) ? fraction : 0;
        const max = duration || 100;
        progress.setAttribute('role','progressbar');progress.setAttribute('aria-label','播放進度');progress.setAttribute('aria-valuemin','0');progress.setAttribute('aria-valuemax',String(max));progress.setAttribute('aria-valuenow',String(progressFraction * max));
        const width = `${progressFraction * 100}%`;
        if (fill.style.width !== width) fill.style.width = width;
        const episode = getHistoryEpisodes(card, id).find(entry => entry.videoSn === videoSn)?.episode
          || info.querySelector('.user-lastwatch')?.textContent.trim();
        let timing=info.querySelector('.ani-history-timing');if(!timing){timing=document.createElement('p');timing.className='ani-history-timing';title?.after(timing);}
        const timeLabel=`${Number.isFinite(elapsed)?formatContinueTime(elapsed):'—'} / ${duration?formatContinueTime(duration):'—'}`;if(timing.dataset.aniLabel!==timeLabel){timing.dataset.aniLabel=timeLabel;const position=document.createElement('span');position.className='ani-history-elapsed';position.textContent=Number.isFinite(elapsed)?formatContinueTime(elapsed):'—';timing.replaceChildren(position,document.createTextNode(' / '+(duration?formatContinueTime(duration):'—')));}
        let playback=info.querySelector('.ani-history-playback');if(!playback){playback=document.createElement('div');playback.className='ani-history-playback';timing.before(playback);}
        let position=playback.querySelector('.ani-history-position');
        if(!position){position=document.createElement('div');position.className='ani-history-position';playback.prepend(position);}
        if(timing.parentElement!==position)position.prepend(timing);
        if(progress.parentElement!==position)position.append(progress);
        let studios = info.querySelector('.ani-history-studios');
        if (markup?.studios) {
          if (!studios) {
            studios = document.createElement('div');
            studios.className = 'ani-history-meta ani-history-studios';
            studios.setAttribute('aria-label', '製作組');
            playback.before(studios);
          }
          if (studios.dataset.markup !== markup.studios) {
            studios.innerHTML = markup.studios;
            studios.dataset.markup = markup.studios;
          }
        } else studios?.remove();
        let ep=playback.querySelector('.ani-history-episode');if(!ep){ep=document.createElement('span');ep.className='ani-history-episode';playback.append(ep);}const epLabel=episode?`EP.${episode}`:'';if(ep.textContent!==epLabel)ep.textContent=epLabel;
        let secondary=info.querySelector('.ani-history-secondary');if(!secondary){secondary=document.createElement('div');secondary.className='ani-history-secondary';playback.after(secondary);}
        let updated=info.querySelector('.ani-history-update');if(!updated){updated=document.createElement('p');updated.className='ani-history-update';}if(updated.parentElement!==secondary)secondary.append(updated);
        const scorePill=card.querySelector('.ani-history-score'),poster=card.querySelector('.postimg');if(scorePill&&poster&&scorePill.parentElement!==poster)poster.append(scorePill);
        const latest=nativeText.match(/已更新至\s*第?\s*(\d+)\s*集/),updateText=latest?`已更新至 EP.${latest[1]}`:'';if(updated.textContent!==updateText)updated.textContent=updateText;
        loadHistoryMetadata(id,href);
      }
      const actions=card.querySelector('.btn-set');
      if(data?.favorite&&actions&&!card.querySelector('.ani-history-favorite')){
        (card.querySelector('.postimg')||actions).append(createFavoriteButton(data.favorite));
      }
      const play=card.querySelector('.play-btn');if(play&&!play.querySelector('.ani-history-play-label')){const label=document.createElement('span');label.className='ani-history-play-label';label.textContent='繼續觀看';play.append(label);}
      if(play&&!play.querySelector('.ani-history-play-icon'))play.insertAdjacentHTML('afterbegin','<svg class="ani-history-play-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8Z"/></svg>');
      for(const [selector,label] of [['.delete-btn','移除這部觀看紀錄'],['.play-btn','繼續播放'],['.next-btn','播放下一集'],['.more-btn','展開每集紀錄']]) {
        const control=card.querySelector(selector);if(!control)continue;
        control.setAttribute('aria-label',selector==='.more-btn'&&card.classList.contains('is-open')?'收合每集紀錄':label);control.removeAttribute('title');
        if(control.tagName!=='A'&&!control.dataset.aniHistoryKey){control.dataset.aniHistoryKey='true';control.setAttribute('role','button');control.tabIndex=0;control.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();control.click();}});}
      }
      if (more) {
        const getDetails = () => card.parentElement?.querySelector(':scope > .user-watchTime-list:not(.tmp-list):not(.ani-perm-ep-drawer)');
        more.setAttribute('aria-expanded', String(card.classList.contains('is-open')));
        more.setAttribute('aria-controls', getDetails()?.id || `sub-list-${more.dataset.anime}`);
        if (!more.dataset.aniNativeFold) {
          more.dataset.aniNativeFold = 'true';
          more.addEventListener('click', (event) => {
            const details = getDetails();
            const wasOpen = card.classList.contains('is-open');
            const toggle = () => {
              document.querySelectorAll('.tmp-list').forEach((node) => node.remove());
              for (const other of document.querySelectorAll('.user-watch-list > .user-watchTime-list')) {
                if (other !== details) {
                  other.style.display = 'none';
                  other.parentElement.querySelector('.ani-history-card')?.classList.remove('is-open');
                }
              }
              card.classList.toggle('is-open', !wasOpen);
              if (wasOpen) animateHistoryDrawer(details, false);
              else details.style.display = 'block';
              enhanceWatchHistory();
            };
            if (more.dataset.listCode && details?.querySelector('a')) {
              event.preventDefault();
              event.stopImmediatePropagation();
              toggle();
              return;
            }
            requestAnimationFrame(() => {
              if (details?.querySelector('a') && card.classList.contains('is-open') === wasOpen) toggle();
              else {
                if (details?.querySelector('a') && wasOpen && details.style.display === 'none') {
                  animateHistoryDrawer(details, false);
                }
                enhanceWatchHistory();
              }
            });
          }, true);
        }
      }
    }
    // Keep the native episode list in the same grid item as its card.
    for (const details of document.querySelectorAll('.user-watchTime-list:not(.tmp-list):not(.ani-perm-ep-drawer)')) {
      const id = details.dataset.animeSn || details.id.match(/sub-list-(\d+)/)?.[1];
      if (!id || !/^\d+$/.test(id)) continue;
      const owner = document.querySelector(`.more-btn[data-anime="${id}"]`)?.closest('.user-watch-list');
      if (!owner) continue;
      if (details.parentElement !== owner) owner.append(details);
      if (details.id) owner.querySelector('.more-btn')?.setAttribute('aria-controls', details.id);
        for(const name of details.querySelectorAll('.history-list-anime-title')){
          if (!Object.hasOwn(name.dataset, 'aniOriginalTitle')) name.dataset.aniOriginalTitle = name.textContent.trim();
          const original = name.dataset.aniOriginalTitle;
          const episode = historyEpisodeFromLabel(original);
          const link = name.closest('a');
          const row = link?.closest('.user-watch-textlist > li') || link || name;
          row.toggleAttribute('data-ani-history-unnumbered', !episode);
          if (!episode) continue;
          const label = `EP.${episode}`;
          if(name.textContent!==label)name.textContent=label;
          const dateEl = link?.querySelector('.date');
          if(dateEl){
            const formatted=dateEl.textContent.replace(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/g,'$1/$2/$3');
            if(dateEl.textContent!==formatted)dateEl.textContent=formatted;
          }
          const date=dateEl?.textContent.trim();
          if(link)link.setAttribute('aria-label',`${original}${date?`，${date}`:''}`);
        }
      const open = owner.querySelector('.anime-card')?.classList.contains('is-open') && details.style.display !== 'none';
      if (open && details.dataset.aniRevealed !== 'true') animateHistoryDrawer(details, true);
      details.dataset.aniRevealed = String(Boolean(open));
      details.dataset.aniOwner = id;
    }
  }
  function stylePlayerConsent() {
    const consentButtons=[...document.querySelectorAll('#ani_video button,#ani_video a,#ani_video input[type="button"]')].filter(n=>/^(同意|不同意)$/.test((n.value||n.textContent).trim()));
    const agree=consentButtons.find(n=>(n.value||n.textContent).trim()==='同意'),decline=consentButtons.find(n=>(n.value||n.textContent).trim()==='不同意');
    if(agree&&decline){let panel=agree.parentElement;for(let level=0;panel&&!panel.contains(decline)&&level<6;level++)panel=panel.parentElement;if(panel&&panel.id!=='ani_video'){panel.classList.add('ani-age-consent');agree.classList.add('ani-consent-accept');decline.classList.add('ani-consent-decline');
      let screen=panel.parentElement;for(let level=0;screen&&screen.id!=='ani_video'&&level<7;level++,screen=screen.parentElement){if(/未滿\s*\d+\s*歲/.test(screen.textContent)&&screen.querySelector('img')){screen.classList.add('ani-age-screen');
        const notice = [...screen.querySelectorAll('*')].find(element =>
          [...element.childNodes].some(node => node.nodeType === 3 && /未滿\s*\d+\s*歲/.test(node.textContent))
        );
        const rating = screen.querySelector('img');
        if (notice && rating && !notice.contains(agree) && !notice.contains(decline)) {
          notice.classList.add('ani-age-notice-row');
          if (rating.parentElement !== notice) notice.prepend(rating);
          screen.classList.add('ani-age-centered');
        }
        const player = screen.closest('.video-js') || screen.closest('#ani_video');
        player.classList.add('ani-age-player');
        for (let wrapper = screen.parentElement; wrapper && wrapper !== player; wrapper = wrapper.parentElement) {
          wrapper.classList.add('ani-age-wrapper');
        }
        const playerRoot = screen.closest('#ani_video');
        playerRoot?.classList.add('ani-age-player');
        const poster=document.querySelector('#ani_video video')?.poster||document.querySelector('meta[property="og:image"]')?.content;if(poster&&/^https:\/\//.test(poster))screen.style.setProperty('--ani-consent-cover',`url("${poster.replace(/["\\]/g,'')}")`);
        screen.classList.add('ani-age-ready');
        playerRoot?.classList.add('ani-age-screen-ready');
        break;}}
}}

    const consentPlayer = document.querySelector('#ani_video');
    if (consentPlayer) {
      const consentScreen = consentPlayer.querySelector('.ani-age-screen');
      consentPlayer.classList.toggle('ani-has-consent', Boolean(agree && decline && !consentScreen));
      consentPlayer.classList.toggle('ani-age-screen-ready', Boolean(consentScreen?.classList.contains('ani-age-ready')));
    }
  }

  const articleMoreButtons = new WeakMap();
  const articleArrowIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
  const conanNewsSourceId = '312186';
  const conanNewsSearchUrl = `https://gnn.gamer.com.tw/search_tag.php?q=${encodeURIComponent('名偵探柯南')}`;
  let conanNewsRequest;
  function fetchGnnArticle(id) {
    const url = `https://gnn.gamer.com.tw/detail.php?sn=${id}`;
    return new Promise(resolve => {
      if (typeof GM_xmlhttpRequest === 'function') {
        GM_xmlhttpRequest({ method: 'GET', url, timeout: 8000,
          onload: response => resolve(response.status === 200 ? response.responseText : ''),
          onerror: () => resolve(''), ontimeout: () => resolve('') });
      } else if (globalThis.chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'ani-conan-related-news', articleId: id }, response => {
          resolve(chrome.runtime.lastError ? '' : response?.html || '');
        });
      } else resolve('');
    }).catch(() => '');
  }
  const gnnNewsSummaries = new Map();
  function getGnnNewsSummary(id) {
    if (!gnnNewsSummaries.has(id)) {
      const request = fetchGnnArticle(id).then(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const lead = [...doc.querySelectorAll('#article_content > :is(div, p)')]
          .map(paragraph => paragraph.textContent.replace(/\s+/g, ' ').trim())
          .find(Boolean);
        const description = lead || doc.querySelector('meta[property="og:description"]')?.content.trim() ||
          doc.querySelector('meta[name="description"]')?.content.trim() || '';
        if (!description) gnnNewsSummaries.delete(id);
        return description;
      });
      gnnNewsSummaries.set(id, request);
    }
    return gnnNewsSummaries.get(id);
  }
  const checkedConanNewsLists = new WeakSet();
  function conanNewsTitleKey(title) {
    const normalized = title.normalize('NFKC').replace(/\s+/g, '');
    if (/名偵探柯南TV動畫播放30週年紀念展/i.test(normalized) &&
        normalized.includes('高雄夢時代')) {
      return '名偵探柯南TV動畫播放30週年紀念展@高雄夢時代';
    }
    return normalized;
  }
  function supplementConanNews(list) {
    if (checkedConanNewsLists.has(list) || list.querySelectorAll(':scope > .extend-card').length >= 4) return;
    checkedConanNewsLists.add(list);
    conanNewsRequest ||= fetchGnnArticle(conanNewsSourceId);
    conanNewsRequest.then(html => {
      if (!html || !list.isConnected || !settings.themeEnabled || !settings.uiEffectsEnabled || !settings.showNews) return;
      const remaining = 4 - list.querySelectorAll(':scope > .extend-card').length;
      if (remaining <= 0) return;
      const nativeLinks = [...list.querySelectorAll('a[href], a.extend-card[href]')];
      const articleId = href => href?.match(/gnn\.gamer\.com\.tw\/detail\.php\?sn=(\d+)/)?.[1];
      const seen = new Set(nativeLinks.map(link => articleId(link.getAttribute('href'))).filter(Boolean));
      const seenTitles = new Set([...list.querySelectorAll('.extend-title')].map(title => conanNewsTitleKey(title.textContent)));
      const page = new DOMParser().parseFromString(html, 'text/html');
      const cards = document.createDocumentFragment();
      const pendingSummaries = [];
      for (const link of page.querySelectorAll('.promotenews-maybelike[data-gtmgnn="相關新聞"]')) {
        const id = articleId(link.getAttribute('href'));
        const title = link.querySelector('.title')?.textContent.trim();
        if (!id || !title?.includes('名偵探柯南') || seen.has(id)) continue;
        const titleKey = conanNewsTitleKey(title);
        if (seenTitles.has(titleKey)) continue;
        seen.add(id);
        seenTitles.add(titleKey);
        const card = document.createElement('a');
        card.className = 'extend-card';
        card.href = `https://gnn.gamer.com.tw/detail.php?sn=${id}`;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        const picture = document.createElement('div');
        picture.className = 'extend-pic-block';
        const cover = link.querySelector('.promotenews-img img')?.getAttribute('data-src');
        if (/^https:\/\/(?:p2|i2)\.bahamut\.com\.tw\//.test(cover || '')) {
          const image = document.createElement('img');
          image.alt = '';
          image.loading = 'lazy';
          image.src = cover;
          picture.append(image);
        }
        const copy = document.createElement('div');
        copy.className = 'extend-content-block';
        const heading = document.createElement('div');
        heading.className = 'extend-title';
        heading.textContent = title;
        const summary = document.createElement('div');
        summary.className = 'extend-content';
        summary.textContent = id === '311769'
          ? '《名偵探柯南》電視動畫推出 30 週年兩小時特別篇〈30 號殺人事件〉，日本預定於 9 月 25 日晚間播出。官方也公開了預告與集結 16 位角色的主視覺。'
          : '';
        summary.toggleAttribute('hidden', !summary.textContent);
        pendingSummaries.push({ id, summary });
        const readMore = document.createElement('span');
        readMore.className = 'btn-read-more ani-more-capsule';
        readMore.dataset.aniMoreCapsule = 'true';
        readMore.innerHTML = `繼續閱讀${articleArrowIcon}`;
        copy.append(heading, summary, readMore);
        card.append(picture, copy);
        cards.append(card);
        if (cards.childElementCount === remaining) break;
      }
      if (!cards.childElementCount) return;
      list.append(cards);
      bindPlayer();
      for (const { id, summary } of pendingSummaries) {
        void getGnnNewsSummary(id).then(description => {
          if (!description || !summary.isConnected) return;
          summary.textContent = description;
          summary.hidden = false;
        });
      }
    });
  }
  function enhanceArticleButton(button, list) {
    const expanded = list.dataset.aniArticlesExpanded === 'true';
    const label = expanded ? '收起更多' : '看更多';
    const text = button.querySelector('span');
    if (text.textContent !== label) text.textContent = label;
    button.setAttribute('aria-expanded', String(expanded));
  }

  function enhanceSiteControls() {
    stylePlayerConsent();
    const sectionIcons={"忍者": "<svg class=\"ani-section-icon\" fill=\"currentColor\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 448 512\"><path d=\"M224 256c-57.2 0-105.6-37.5-122-89.3c-1.1 1.3-2.2 2.6-3.5 3.8c-15.8 15.8-38.8 20.7-53.6 22.1c-8.1 .8-14.6-5.7-13.8-13.8c1.4-14.7 6.3-37.8 22.1-53.6c5.8-5.8 12.6-10.1 19.6-13.4c-7-3.2-13.8-7.6-19.6-13.4C37.4 82.7 32.6 59.7 31.1 44.9c-.8-8.1 5.7-14.6 13.8-13.8c14.7 1.4 37.8 6.3 53.6 22.1c4.8 4.8 8.7 10.4 11.7 16.1C131.4 28.2 174.4 0 224 0c70.7 0 128 57.3 128 128s-57.3 128-128 128zM0 482.3C0 399.5 56.4 330 132.8 309.9c6-1.6 12.2 .9 15.9 5.8l62.5 83.3c6.4 8.5 19.2 8.5 25.6 0l62.5-83.3c3.7-4.9 9.9-7.4 15.9-5.8C391.6 330 448 399.5 448 482.3c0 16.4-13.3 29.7-29.7 29.7L29.7 512C13.3 512 0 498.7 0 482.3zM160 96c-8.8 0-16 7.2-16 16s7.2 16 16 16l128 0c8.8 0 16-7.2 16-16s-7.2-16-16-16L160 96z\"/></svg>", "競速": "<svg class=\"ani-section-icon\" fill=\"currentColor\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 448 512\"><path d=\"M32 0C49.7 0 64 14.3 64 32l0 16 69-17.2c38.1-9.5 78.3-5.1 113.5 12.5c46.3 23.2 100.8 23.2 147.1 0l9.6-4.8C423.8 28.1 448 43.1 448 66.1l0 279.7c0 13.3-8.3 25.3-20.8 30l-34.7 13c-46.2 17.3-97.6 14.6-141.7-7.4c-37.9-19-81.3-23.7-122.5-13.4L64 384l0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-80 0-66L0 64 0 32C0 14.3 14.3 0 32 0zM64 187.1l64-13.9 0 65.5L64 252.6 64 318l48.8-12.2c5.1-1.3 10.1-2.4 15.2-3.3l0-63.9 38.9-8.4c8.3-1.8 16.7-2.5 25.1-2.1l0-64c13.6 .4 27.2 2.6 40.4 6.4l23.6 6.9 0 66.7-41.7-12.3c-7.3-2.1-14.8-3.4-22.3-3.8l0 71.4c21.8 1.9 43.3 6.7 64 14.4l0-69.8 22.7 6.7c13.5 4 27.3 6.4 41.3 7.4l0-64.2c-7.8-.8-15.6-2.3-23.2-4.5l-40.8-12 0-62c-13-3.8-25.8-8.8-38.2-15c-8.2-4.1-16.9-7-25.8-8.8l0 72.4c-13-.4-26 .8-38.7 3.6L128 173.2 128 98 64 114l0 73.1zM320 335.7c16.8 1.5 33.9-.7 50-6.8l14-5.2 0-71.7-7.9 1.8c-18.4 4.3-37.3 5.7-56.1 4.5l0 77.4zm64-149.4l0-70.8c-20.9 6.1-42.4 9.1-64 9.1l0 69.4c13.9 1.4 28 .5 41.7-2.6l22.3-5.2z\"/></svg>", "音樂": "<svg class=\"ani-section-icon\" fill=\"currentColor\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><path d=\"M499.1 6.3c8.1 6 12.9 15.6 12.9 25.7l0 72 0 264c0 44.2-43 80-96 80s-96-35.8-96-80s43-80 96-80c11.2 0 22 1.6 32 4.6L448 147 192 223.8 192 432c0 44.2-43 80-96 80s-96-35.8-96-80s43-80 96-80c11.2 0 22 1.6 32 4.6L128 200l0-72c0-14.1 9.3-26.6 22.8-30.7l320-96c9.7-2.9 20.2-1.1 28.3 5z\"/></svg>", "職業": "<svg class=\"ani-section-icon\" fill=\"currentColor\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><path d=\"M184 48l144 0c4.4 0 8 3.6 8 8l0 40L176 96l0-40c0-4.4 3.6-8 8-8zm-56 8l0 40L64 96C28.7 96 0 124.7 0 160l0 96 192 0 128 0 192 0 0-96c0-35.3-28.7-64-64-64l-64 0 0-40c0-30.9-25.1-56-56-56L184 0c-30.9 0-56 25.1-56 56zM512 288l-192 0 0 32c0 17.7-14.3 32-32 32l-64 0c-17.7 0-32-14.3-32-32l0-32L0 288 0 416c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-128z\"/></svg>", "經典": "<svg class=\"ani-section-icon\" fill=\"currentColor\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><path d=\"M0 96C0 60.7 28.7 32 64 32l384 0c35.3 0 64 28.7 64 64l0 320c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64L0 96zM48 368l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16zm368-16c-8.8 0-16 7.2-16 16l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0zM48 240l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16zm368-16c-8.8 0-16 7.2-16 16l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0zM48 112l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16L64 96c-8.8 0-16 7.2-16 16zM416 96c-8.8 0-16 7.2-16 16l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0zM160 128l0 64c0 17.7 14.3 32 32 32l128 0c17.7 0 32-14.3 32-32l0-64c0-17.7-14.3-32-32-32L192 96c-17.7 0-32 14.3-32 32zm32 160c-17.7 0-32 14.3-32 32l0 64c0 17.7 14.3 32 32 32l128 0c17.7 0 32-14.3 32-32l0-64c0-17.7-14.3-32-32-32l-128 0z\"/></svg>", "到期": "<svg class=\"ani-section-icon\" fill=\"currentColor\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 384 512\"><path d=\"M32 0C14.3 0 0 14.3 0 32S14.3 64 32 64l0 11c0 42.4 16.9 83.1 46.9 113.1L146.7 256 78.9 323.9C48.9 353.9 32 394.6 32 437l0 11c-17.7 0-32 14.3-32 32s14.3 32 32 32l32 0 256 0 32 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l0-11c0-42.4-16.9-83.1-46.9-113.1L237.3 256l67.9-67.9c30-30 46.9-70.7 46.9-113.1l0-11c17.7 0 32-14.3 32-32s-14.3-32-32-32L320 0 64 0 32 0zM96 75l0-11 192 0 0 11c0 19-5.6 37.4-16 53L112 128c-10.3-15.6-16-34-16-53zm16 309c3.5-5.3 7.6-10.3 12.1-14.9L192 301.3l67.9 67.9c4.6 4.6 8.6 9.6 12.1 14.9L112 384z\"/></svg>", "新聞": "<svg class=\"ani-section-icon\" fill=\"currentColor\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><path d=\"M96 96c0-35.3 28.7-64 64-64l288 0c35.3 0 64 28.7 64 64l0 320c0 35.3-28.7 64-64 64L80 480c-44.2 0-80-35.8-80-80L0 128c0-17.7 14.3-32 32-32s32 14.3 32 32l0 272c0 8.8 7.2 16 16 16s16-7.2 16-16L96 96zm64 24l0 80c0 13.3 10.7 24 24 24l112 0c13.3 0 24-10.7 24-24l0-80c0-13.3-10.7-24-24-24L184 96c-13.3 0-24 10.7-24 24zm208-8c0 8.8 7.2 16 16 16l48 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-48 0c-8.8 0-16 7.2-16 16zm0 96c0 8.8 7.2 16 16 16l48 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-48 0c-8.8 0-16 7.2-16 16zM160 304c0 8.8 7.2 16 16 16l256 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-256 0c-8.8 0-16 7.2-16 16zm0 96c0 8.8 7.2 16 16 16l256 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-256 0c-8.8 0-16 7.2-16 16z\"/></svg>", "話題": "<svg class=\"ani-section-icon\" fill=\"currentColor\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 640 512\"><path d=\"M208 352c114.9 0 208-78.8 208-176S322.9 0 208 0S0 78.8 0 176c0 38.6 14.7 74.3 39.6 103.4c-3.5 9.4-8.7 17.7-14.2 24.7c-4.8 6.2-9.7 11-13.3 14.3c-1.8 1.6-3.3 2.9-4.3 3.7c-.5 .4-.9 .7-1.1 .8l-.2 .2s0 0 0 0s0 0 0 0C1 327.2-1.4 334.4 .8 340.9S9.1 352 16 352c21.8 0 43.8-5.6 62.1-12.5c9.2-3.5 17.8-7.4 25.2-11.4C134.1 343.3 169.8 352 208 352zM448 176c0 112.3-99.1 196.9-216.5 207C255.8 457.4 336.4 512 432 512c38.2 0 73.9-8.7 104.7-23.9c7.5 4 16 7.9 25.2 11.4c18.3 6.9 40.3 12.5 62.1 12.5c6.9 0 13.1-4.5 15.2-11.1c2.1-6.6-.2-13.8-5.8-17.9c0 0 0 0 0 0s0 0 0 0l-.2-.2c-.2-.2-.6-.4-1.1-.8c-1-.8-2.5-2-4.3-3.7c-3.6-3.3-8.5-8.1-13.3-14.3c-5.5-7-10.7-15.4-14.2-24.7c24.9-29 39.6-64.7 39.6-103.4c0-92.8-84.9-168.9-192.6-175.5c.4 5.1 .6 10.3 .6 15.5z\"/></svg>"};
    for(const heading of document.querySelectorAll('#BH_background .theme-title')){
      const text=heading.textContent,key=text.includes('2000')||text.includes('經典')?'經典':Object.keys(sectionIcons).find(k=>text.includes(k));
      if(key&&!heading.querySelector('.ani-section-icon')){heading.classList.add('ani-section-title');heading.insertAdjacentHTML('afterbegin',sectionIcons[key]);}
    }
    for(const more of document.querySelectorAll('#BH_background .theme-show-more-list,#BH_background .btn-read-more')){
      if(more.dataset.aniMoreCapsule)continue;more.dataset.aniMoreCapsule='true';more.classList.add('ani-more-capsule');more.querySelectorAll('svg,i,.material-icons,.material-icons-round,.title-arrow').forEach(n=>n.remove());more.insertAdjacentHTML('beforeend',articleArrowIcon);
    }

    enhanceCollectionFilters();
    enhanceAccountPages();
    enhanceWatchHistory();
    if(location.pathname==='/viewList.php'&&typeof IntersectionObserver==='function')for(const more of document.querySelectorAll('.history-wrapper .anime-btn-show-more:not([data-ani-infinite])')){more.dataset.aniInfinite='true';more.setAttribute('aria-label','載入更多觀看紀錄');more.setAttribute('role','button');more.tabIndex=0;const loader=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)&&more.isConnected){loader.disconnect();more.click();}},{rootMargin:'600px'});loader.observe(more);}

    for (const status of document.querySelectorAll('#BH_background .theme-title > span, #BH_background .theme-title-block > span, #BH_background .ani-section-actions > span')) {
      if (/^(?:讀取評分|評分(?:載入|已就緒)|載入評分)/.test(status.textContent.trim()) && !status.classList.contains('ani-legacy-rating-progress')) status.classList.add('ani-legacy-rating-progress');
    }
    const pageTitles = { '所有動畫':'探索動畫', '我的動畫':'收藏片單', '觀看紀錄':'最近看過' };
    for (const title of document.querySelectorAll('#BH_background h1.theme-title')) {
      for (const node of title.childNodes) {
        if (node.nodeType === 3 && pageTitles[node.textContent.trim()]) node.textContent = pageTitles[node.textContent.trim()];
      }
    }
    enhanceCatalogFilters();
    enhanceInfiniteCatalog();
    const weekly = document.querySelector('#blockVideoInSeason');
    if (weekly) {
      if (!weekly.dataset.aniScheduleTabs) {
        weekly.dataset.aniScheduleTabs = 'true';
        weekly.addEventListener('click', event => {
          const tab = event.target.closest?.('.textpage-switch-page, .newanime-switch-page');
          if (!settings.themeEnabled || !tab) return;
          const week = weekly.querySelector('.programlist-wrap');
          const releases = weekly.querySelector('.newanime-wrap.sort-selected') || weekly.querySelector('.newanime-wrap');
          if (!week || !releases) return;
          event.stopPropagation();
          if (tab.classList.contains('nav-choose-segment')) return;
          const weeklyView = tab.matches('.textpage-switch-page');
          releases.classList.toggle('ani-release-panel', weeklyView);
          for (const button of tab.parentElement.querySelectorAll('.nav-segment-control')) {
            button.classList.toggle('nav-choose-segment', button === tab);
          }
          for (const [panel, visible] of [[week, weeklyView], [releases, !weeklyView]]) {
            panel.style.removeProperty('display');
            panel.classList.toggle('newanime-content-hide', !visible);
          }
          const filter = weekly.querySelector('.btn-newanime-filter');
          if (filter) filter.style.display = weeklyView ? 'none' : 'flex';
        }, true);
      }
      const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric', day: 'numeric'});
      const parts = Object.fromEntries(today.formatToParts(new Date()).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
      const monday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
      monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
      let hasExtra=false;
      [...weekly.querySelectorAll('.day-list')].forEach((day,dayIndex)=>{
        if(day.dataset.aniWeekDay!==String(dayIndex))day.dataset.aniWeekDay=String(dayIndex);
        const date = new Date(monday);
        date.setUTCDate(date.getUTCDate() + dayIndex);
        const dateLabel=`${date.getUTCMonth()+1}/${date.getUTCDate()}`;
        let dayLabel=day.querySelector(':scope > .ani-week-hover-date');
        if(!dayLabel){dayLabel=document.createElement('span');dayLabel.className='ani-week-hover-date';dayLabel.setAttribute('aria-hidden','true');day.append(dayLabel);}
        if(dayLabel.textContent!==dateLabel)dayLabel.textContent=dateLabel;
        if(!day.dataset.aniDateFollow){day.dataset.aniDateFollow='true';let frame=0,x=0;day.addEventListener('pointermove',event=>{x=event.clientX;if(frame)return;frame=requestAnimationFrame(()=>{frame=0;const label=day.querySelector(':scope > .ani-week-hover-date');if(!label)return;const rect=day.getBoundingClientRect(),half=label.offsetWidth/2;label.style.left=`${Math.min(rect.width-half-4,Math.max(half+4,x-rect.left))}px`;});});}

        [...day.querySelectorAll('.text-anime-info')].forEach((tile,index)=>{
          tile.classList.toggle('ani-week-extra',index>=5);if(index>=5)hasExtra=true;
          let shell=tile.parentElement;
          if(!shell.classList.contains('ani-week-tile-shell')){shell=document.createElement('div');shell.className='ani-week-tile-shell';tile.before(shell);shell.append(tile);}
          shell.classList.toggle('ani-week-extra-shell', index >= 5);
          shell.querySelector('.ani-week-hover-date')?.remove();
        });
      });
      if(hasExtra&&!weekly.querySelector('.ani-week-expand')){
        const button=document.createElement('button');button.type='button';button.className='ani-week-expand';button.setAttribute('aria-expanded','false');
        button.innerHTML = '<span></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
        const label = button.firstElementChild;
        const sync = () => {
          const open = weekly.classList.contains('ani-week-expanded');
          button.setAttribute('aria-expanded', String(open));
          label.textContent = open ? '收合週期表' : '展開完整週期表';
        };
        button.addEventListener('click',event=>{
          event.stopPropagation();
          const open=!weekly.classList.contains('ani-week-expanded');
          weekly.classList.toggle('ani-week-expanded',open);
          sync();
          if (open && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
            button.animate?.([{opacity: 0.65}, {opacity: 1}], {duration: 150, easing: 'ease-out'});
          }
        });sync();
        (weekly.querySelector('.programlist-wrap_block')||weekly.querySelector('.programlist-block'))?.after(button);
      }
      const sourceByHref = new Map();
      const sourceByName = new Map();
      for (const card of weekly.querySelectorAll('.anime-card-block')) {
        const href = card.getAttribute('href');
        const name = card.querySelector('.anime-name')?.textContent.trim();
        if (href && !sourceByHref.has(href)) sourceByHref.set(href, card);
        if (name && !sourceByName.has(name)) sourceByName.set(name, card);
      }
      for (const tile of weekly.querySelectorAll('.text-anime-info')) {
        const title=tile.querySelector('.text-anime-name');
        if(title&&!title.querySelector('.ani-week-marquee')){const track=document.createElement('span');track.className='ani-week-marquee';track.textContent=title.textContent.trim();title.title=track.textContent;title.replaceChildren(track);const measure=()=>{const distance=track.scrollWidth-title.clientWidth;title.classList.toggle('ani-week-overflow',distance>2);title.style.setProperty('--ani-week-travel',`${-Math.max(0,distance)}px`);};tile.addEventListener('pointerenter',measure);tile.addEventListener('focusin',measure);}

        for(const node of tile.querySelector('.text-anime-number')?.childNodes||[]){if(node.nodeType===3){const text=node.textContent.replace(/第\s*(\d+(?:\.\d+)?)\s*集/g,'EP.$1');if(node.textContent!==text)node.textContent=text;}}
        for (const [selector,path] of [['.text-anime-time','M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm1 4v5l4 2-1 2-5-3V7Z'],['.text-anime-number','M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm4 4v10l8-5Z']]) {
          const badge=tile.querySelector(selector);
          if(badge&&!badge.querySelector('svg')) badge.insertAdjacentHTML('afterbegin',`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="${path}"/></svg>`);
        }
        const name = tile.querySelector('.text-anime-name')?.textContent.trim();
        const source = sourceByHref.get(tile.getAttribute('href')) || sourceByName.get(name);
        const image = source?.querySelector('.anime-blocker img');
        const url = image?.dataset.src || image?.src;
        if (url && /^https:\/\/(?:p2|i2|truth)\.bahamut\.com\.tw\//.test(url)) prepareWeekCover(tile, url);
        if (!tile.querySelector('.ani-week-score')) {
          const score = [...(source?.querySelectorAll('.ani-score-badge-top-left,.label-edition') || [])].map(n=>n.textContent.trim()).find(t=>/^(?:★\s*)?[0-5](?:\.\d+)?$/.test(t));
          if (score) { const pill = document.createElement('span'); pill.className = 'ani-week-score'; pill.textContent = `★ ${score.replace(/★\s*/,'')}`; tile.append(pill); }
        }
        if (source && !tile.querySelector('.ani-week-favorite')) {
          const original = source.querySelector('.btn-favorite');
          if (original) { const favorite = original.cloneNode(true); favorite.classList.add('ani-week-favorite'); favorite.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>'; tile.append(favorite); }
        }
      }
    }
    const continueRail=document.querySelector('#continueWatch');
    const continueImage=continueRail?.querySelector('.img-block');
    if(continueImage){const height=`${Math.ceil(continueImage.getBoundingClientRect().height)}px`;if(continueRail.style.getPropertyValue('--ani-continue-image-height')!==height)continueRail.style.setProperty('--ani-continue-image-height',height);}
    enhancePlayerControls();
  if (typeof window !== 'undefined' && !window.__aniSkipIntroTimer) {
    window.__aniSkipIntroTimer = setInterval(() => {
      try {
        for (const qa of document.querySelectorAll('.qa-icon:not(.ani-info-badge-host)')) {
          qa.innerHTML = '<svg class="ani-info-i-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><circle cx="12" cy="8.2" r="0.6" fill="currentColor" stroke="none"/></svg>';
          qa.classList.add('ani-info-badge-host');
        }
        for (const pill of document.querySelectorAll('#BH_background :is(button, a, div, span), body > :is(button, div)')) {
          if (pill.closest('#ani_video, .ani-player-settings-drawer, .ani-settings-panel, .ani-view-settings-panel, .ani-home-dash')) continue;
          if (pill.childElementCount > 2) continue;
          const pTxt = (pill.textContent || '').replace(/\s+/g, ' ').trim();
          if (!pTxt || pTxt.length > 48 || !/(?:預先載入.*評等|排序完成|載入所有評等)/.test(pTxt)) continue;
          if ([...pill.children].some((c) => !c.classList.contains('ani-ext-sort-icon') && /(?:預先載入.*評等|排序完成|載入所有評等)/.test(c.textContent || ''))) continue;
          pill.classList.add('ani-ext-rating-pill');
          if (/排序完成/.test(pTxt)) pill.classList.add('is-done');
          const tw = document.createTreeWalker(pill, NodeFilter.SHOW_TEXT);
          let tNode;
          while ((tNode = tw.nextNode())) {
            const cleaned = (tNode.nodeValue || '').replace(/[\u2705\u2714\u2611\uFE0F]/g, '').replace(/^\s+/, '');
            if (cleaned !== tNode.nodeValue) tNode.nodeValue = cleaned;
          }
          if (!pill.querySelector('.ani-ext-sort-icon')) {
            const ic = document.createElement('span');
            ic.className = 'ani-ext-sort-icon';
            ic.setAttribute('aria-hidden', 'true');
            ic.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
            pill.prepend(ic);
          }
        }
        if (!document.querySelector('#ani_video')) return;
        const msgEl = document.querySelector('#BH_background #ani-info #ani-info-msg');
        const boxEl = document.querySelector('#BH_background #ani-info');
        if (typeof window.__aniSyncSidebarIntro === 'function') window.__aniSyncSidebarIntro();
        if (boxEl && boxEl.querySelector('.data_type li > span:not(:has(.ani-info-pill-svg))')) {
          enhancePlayerControls();
        }
        const orphanBgm = document.querySelector('#bgmtv:not(.ani-title-actions #bgmtv)');
        const plusToolbar = document.querySelector('.plus_imagetool_box');
        const floatingToggle = document.querySelector('.ani-player-settings-toggle');
        if (orphanBgm || (plusToolbar && floatingToggle && !plusToolbar.contains(floatingToggle))) {
          enhancePlayerControls();
        }
        if (msgEl && boxEl && !boxEl.dataset.aniInfoRescued && /無法取得資料|查無資料|搜尋失敗/.test(msgEl.textContent || '')) {
          enhancePlayerControls();
        }
      } catch (_) {}
      try {
        const badQrBox = (node) => {
          if (!node) return false;
          if (/掃描|QR\s*code|App\s*Store|Google\s*Play|前往動畫瘋APP|立即下載/i.test(node.textContent || '')) return true;
          if (node.matches('.app-download-toolbox, [class*="qrcode" i], [class*="download" i]') || node.querySelector('img, canvas, .app-download-toolbox, a.apple, a[href*="apple"], a[href*="play.google"]')) return true;
          const r = node.getBoundingClientRect();
          return r.height > 110;
        };
        for (const rootEl of document.querySelectorAll('#BH_background #ani_video, #BH_background .videoframe')) {
          for (const qrBox of rootEl.querySelectorAll('div, section')) {
            if (/掃描\s*QR\s*code|前往動畫瘋APP觀看/i.test(qrBox.textContent || '') && qrBox.querySelector('img, canvas, a[href*="apple"], .apple') && !qrBox.querySelector('#ani_video, .video-js')) {
              const r = qrBox.getBoundingClientRect();
              if (r.width > 120 && r.width < 520 && r.height > 120 && r.height < 520) {
                qrBox.classList.add('ani-app-qr-popup');
                qrBox.classList.remove('ani-skip-intro-pill');
              }
            }
          }
          const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
          let textNode;
          while ((textNode = walker.nextNode())) {
            const val = (textNode.nodeValue || '').trim();
            if (!/(?:跳過|略過)(?:片頭|片尾)|按此跳過/.test(val)) continue;
            const leaf = textNode.parentElement;
            if (!leaf || leaf.closest('.vjs-control-bar, .vjs-menu, .ani-DanmuMenu, .plus_imagetool_box, .app-download-toolbox, .ani-app-qr-popup')) continue;
            if (badQrBox(leaf)) continue;
            let box = leaf;
            while (
              box.parentElement &&
              box.parentElement !== rootEl &&
              !box.parentElement.matches('#ani_video, .video-js, .videoframe, .video, #video-container, .vjs-control-bar') &&
              ((box.parentElement.textContent || '').replace(/\s+/g, '').length <= 36) &&
              !badQrBox(box.parentElement)
            ) {
              box = box.parentElement;
            }
            styleSkipIntroPill(box);
          }
        }
        syncLastWatchedEpisodes();
      } catch (_) {}
    }, 700);
  }
    for (const card of document.querySelectorAll('#blockContinueWatch .continue-watch-card, #blockVideoInSeason .anime-card-block, #BH_background .animate-theme-list .theme-list-main, #BH_background .old_list:not(:has(.search_result)) .theme-list-main')) {
      if (!card.classList.contains('ani-card-surface')) card.classList.add('ani-card-surface');
      const glowImage=card.querySelector('img.card-img:not(.is-next),.anime-blocker img,.anime-pic-block img:not(.anime-clock-img):not([src$=".svg"]),.theme-img');
      const glowUrl=glowImage?.dataset.src||glowImage?.getAttribute('src');
      if(glowUrl&&/^https:\/\/(?:p2|i2|truth)\.bahamut\.com\.tw\//.test(glowUrl)){const cover=`url("${glowUrl.replace(/["\\\n\r]/g,'')}")`;if(card.style.getPropertyValue('--ani-card-cover')!==cover)card.style.setProperty('--ani-card-cover',cover);}
      if(glowUrl&&!card.querySelector(':scope > .ani-season-glow')){const glow=document.createElement('span');glow.className='ani-season-glow';glow.setAttribute('aria-hidden','true');card.prepend(glow);}
      const info = card.querySelector('.content-block, .anime-detail-block');
      if (info && !info.classList.contains('ani-card-info')) info.classList.add('ani-card-info');
      if (card.querySelector(':scope > .ani-hover-outline')) continue;
      const footer = card.querySelector('.content-block, .anime-detail-block');
      if (!footer) continue;
      const outline = document.createElement('span');
      outline.className = 'ani-hover-outline';
      outline.setAttribute('aria-hidden', 'true');
      card.append(outline);
      let footerObserver;
      const measure = () => {
        const bounds = card.getBoundingClientRect();
        const height = `${Math.max(bounds.height, footer.getBoundingClientRect().bottom - bounds.top)}px`;
        if (outline.style.height !== height) outline.style.height = height;
      };
      const trackOutline = () => {
        measure();
        if (card.classList.contains('ani-card-has-overflow') && typeof ResizeObserver === 'function') {
          footerObserver ||= new ResizeObserver(measure);
          footerObserver.observe(card);
          footerObserver.observe(footer);
        }
      };
      card.addEventListener('mouseenter', trackOutline);
      card.addEventListener('focusin', trackOutline);
      const resetOutline = () => {
        if (card.matches(':hover, :focus-within')) return;
        footerObserver?.disconnect();
        outline.style.removeProperty('height');
      };
      card.addEventListener('mouseleave', resetOutline);
      card.addEventListener('focusout', () => requestAnimationFrame(resetOutline));
    }
    const conanWatchPage = location.pathname === '/animeVideo.php' && settings.showNews &&
      /名偵探柯南/.test(document.querySelector('.anime_name h1')?.textContent || '');
    for (const list of document.querySelectorAll('#BH_background .theme-extend-block')) {
      const section = list.closest('.animate-theme-list');
      if (!section) continue;
      const homeArticles = document.body.classList.contains('ani-home-page');
      if (homeArticles && settings.themeEnabled && settings.uiEffectsEnabled) {
        let header = section.querySelector(':scope > .theme-title-block');
        const nativeTitle = header?.querySelector('.theme-title') || section.querySelector(':scope > .theme-title');
        if (!nativeTitle?.textContent.trim() && !section.dataset.aniHomeArticleHeading) {
          section.dataset.aniHomeArticleHeading = 'true';
          if (!header) {
            header = document.createElement('div');
            header.className = 'theme-title-block';
            section.prepend(header);
          }
          const title = nativeTitle || document.createElement('h2');
          title.classList.add('theme-title', 'ani-section-title');
          const news = [...list.querySelectorAll('a[href]')].some(link => link.hostname === 'gnn.gamer.com.tw');
          title.innerHTML = news ? sectionIcons['新聞'] + '新聞' : sectionIcons['話題'] + '熱門話題';
          if (!nativeTitle) header.prepend(title);
        }
      }
      if (conanWatchPage && settings.themeEnabled && settings.uiEffectsEnabled) supplementConanNews(list);
      let more = articleMoreButtons.get(list);
      const nativeMore = homeArticles && section.querySelector(':scope > .theme-title-block .theme-show-more-list');
      if (nativeMore || !settings.themeEnabled || !settings.uiEffectsEnabled ||
          (!conanWatchPage && list.querySelectorAll(':scope > .extend-card').length <= 4)) {
        more?.remove();
        delete list.dataset.aniArticlesExpanded;
        continue;
      }
      if (more && more.matches('a') !== conanWatchPage) {
        more.remove();
        more = null;
      }
      if (!more && conanWatchPage) {
        more = document.createElement('a');
        more.href = conanNewsSearchUrl;
        more.className = 'ani-pill-btn ani-articles-more';
        more.innerHTML = `<span>看更多</span>${articleArrowIcon}`;
        articleMoreButtons.set(list, more);
      } else if (!more) {
        more = document.createElement('button');
        more.type = 'button';
        more.className = 'ani-pill-btn ani-articles-more';
        more.innerHTML = `<span></span>${articleArrowIcon}`;
        more.addEventListener('click', () => {
          list.dataset.aniArticlesExpanded = String(list.dataset.aniArticlesExpanded !== 'true');
          enhanceArticleButton(more, list);
        });
        articleMoreButtons.set(list, more);
      }
      if (!list.dataset.aniArticlesExpanded || (conanWatchPage && list.dataset.aniArticlesExpanded !== 'false')) {
        list.dataset.aniArticlesExpanded = 'false';
      }
      if (more.nextElementSibling !== list) list.before(more);
      if (!conanWatchPage) enhanceArticleButton(more, list);
    }
    for (const summary of document.querySelectorAll('#BH_background .extend-card .extend-content')) {
      const walker = document.createTreeWalker(summary, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const trimmed = node.data.trimStart();
        if (node.data !== trimmed) node.data = trimmed;
        if (trimmed) break;
      }
    }
    for (const pic of document.querySelectorAll('#BH_background .extend-card .extend-pic-block')) {
      const img = pic.querySelector('img');
      const url = img?.dataset.src || img?.getAttribute('src');
      if (url && /^https?:\/\//i.test(url)) {
        const cover = `url("${url.replace(/["\\\n\r]/g, '')}")`;
        if (pic.style.getPropertyValue('--ani-card-cover') !== cover) {
          pic.style.setProperty('--ani-card-cover', cover);
        }
      }
    }
    for (const toast of document.querySelectorAll('#toast-container > .toast')) {
      if (/收藏|作品.*我的動畫/.test(toast.textContent || '')) toast.classList.add('ani-favorite-toast');
    }
    globalThis.AniHeroBanner?.mount(Boolean(settings.themeEnabled));
    globalThis.AniHomeDashboard?.mount(settings);
    if (globalThis.AniLensSwitch) {
      let savedLight = false;
      try { savedLight = localStorage.getItem('aniLightMode') === '1'; } catch {}
      document.documentElement.classList.toggle('ani-light-mode', savedLight);
      document.body?.classList.toggle('ani-light-mode', savedLight);
      globalThis.AniLensSwitch.mount({
        initialLight: savedLight,
        onToggle: (isLight) => {
          document.documentElement.classList.toggle('ani-light-mode', isLight);
          document.body?.classList.toggle('ani-light-mode', isLight);
          try { localStorage.setItem('aniLightMode', isLight ? '1' : '0'); } catch {}
        },
      });
    }
    const catalogHeading = document.querySelector('.filter-title-block .theme-title');
    if (catalogHeading && !catalogHeading.querySelector('.ani-section-icon')) {
      const icon = document.createElement('span');
      icon.className = 'ani-section-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="14" rx="3"/><path d="m8 3 4 4 4-4m-6 8 5 3-5 3Z"/></svg>';
      catalogHeading.prepend(icon);
    }
    for (const native of document.querySelectorAll('.filter-title-block .btn-newanime-filter:not([data-ani-catalog-sort])')) {
      const items = [...native.querySelectorAll('[data-ani-list-sort]')];
      if (!items.length) continue;
      native.dataset.aniCatalogSort = 'true';
      const group = document.createElement('div');
      group.className = 'ani-catalog-sort';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', '動畫排序');
      const sync = () => {
        const text = native.querySelector('.newanime-filter-text')?.textContent || '';
        for (const button of group.children) button.setAttribute('aria-pressed', String(text.includes(button.dataset.mode)));
      };
      for (const item of items) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.mode = item.textContent.includes('年份') ? '年份' : '月人氣';
        button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">' + (button.dataset.mode === '年份' ? '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16"/>' : '<path d="M5 19v-6m7 6V5m7 14v-9"/>') + '</svg>' + button.dataset.mode;
        button.addEventListener('click', () => { item.click(); sync(); });
        group.append(button);
      }
      native.after(group);
      sync();
      new MutationObserver(sync).observe(native, { childList: true, subtree: true, characterData: true });
    }
    const channelHeading = document.querySelector('#blockAnimePublisherChannel .theme-title');
    if (channelHeading && !channelHeading.querySelector('.ani-section-icon')) {
      const icon = document.createElement('span');
      icon.className = 'ani-section-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="14" rx="3"/><path d="m8 3 4 4 4-4m-6 8 5 3-5 3Z"/></svg>';
      channelHeading.prepend(icon);
    }
    // Rating controls are injected inside h1 by the site's rating helper.
    // Move the existing label, retaining its input and listeners, into the row.
    for (const header of document.querySelectorAll('#BH_background > .container .theme-title-block')) {
      if (header.closest('#blockHotAnime, [id^="blockAnimeNewArrive"]') && !header.querySelector('.ani-section-actions')) {
        const actions = document.createElement('div');
        actions.className = 'ani-section-actions';
        header.append(actions);
      }
      for (const label of header.querySelectorAll('.theme-title label:has(input[type="checkbox"])')) {
        let actions = header.querySelector(':scope > .ani-section-actions');
        if (!actions) {
          actions = document.createElement('div');
          actions.className = 'ani-section-actions';
          header.append(actions);
        }
        actions.append(label);
      }
    }
    enhancePosterRails();
    requestAnimationFrame(fitPremiumCard);
    const premiumGrid = document.querySelector('#blockVideoInSeason .newanime-block:has(> .premium-block)');
    if (premiumGrid && !premiumGridObserver && typeof ResizeObserver === 'function') {
      premiumGridObserver = new ResizeObserver(([entry]) => {
        if (entry.contentRect.width && !entry.target.closest('.newanime-content-hide')) fitPremiumCard();
      });
      premiumGridObserver.observe(premiumGrid);
    }
    enhanceContinueWatch();
    for (const item of document.querySelectorAll(
      '.sky .member > li:has(> .tooltip)',
    )) {
      const link = item.querySelector(':scope > a'),
        label = item.querySelector(':scope > .tooltip')?.textContent;
      if (link && label && !link.getAttribute('aria-label'))
        link.setAttribute('aria-label', label);
    }
    for (const item of document.querySelectorAll(
      '.sky .member > :is(.top_btn_notice, .top_btn_subscription, .top_btn_recommend):not([data-ani-member-ready])',
    )) {
      item.dataset.aniMemberReady = 'true';
      const link = item.querySelector(':scope > a');
      const iconKey = Object.keys(MEMBER_ICON_SVGS).find((k) => item.classList.contains(k));
      if (link && iconKey && !link.querySelector('svg.ani-member-icon')) {
        link.innerHTML = MEMBER_ICON_SVGS[iconKey];
      }
      const lightId =
        item.querySelector('[id^="topBar_"]')?.id?.replace(/^topBar_/, '') ||
        link?.getAttribute('href')?.match(/TOPBAR_show\(['"]([^'"]+)['"]\)/)?.[1] ||
        '';
      const getMsgBox = () => (lightId ? document.getElementById(`topBarMsg_${lightId}`) : null);
      const scheduleClose = () => {
        clearTimeout(memberHoverCloseTimer);
        memberHoverCloseTimer = setTimeout(() => {
          const msg = getMsgBox();
          if (!item.matches(':hover') && !(msg && msg.matches(':hover'))) {
            closeTopBarMenus();
          }
        }, 200);
      };
      item.addEventListener('mouseenter', () => {
        clearTimeout(memberHoverCloseTimer);
        if (lightId) {
          document.dispatchEvent(new CustomEvent('ani-topbar-open', { detail: lightId }));
          const msg = getMsgBox();
          if (msg && getComputedStyle(msg).display === 'none' && link && /^javascript:\s*TOPBAR_show\(/i.test(link.getAttribute('href') || '')) {
            link.click();
          }
          if (msg && !msg.dataset.aniHoverBound) {
            msg.dataset.aniHoverBound = 'true';
            msg.addEventListener('mouseenter', () => clearTimeout(memberHoverCloseTimer));
            msg.addEventListener('mouseleave', scheduleClose);
          }
        } else if (!item.classList.contains('is-active') && link && /^javascript:\s*TOPBAR_show\(/i.test(link.getAttribute('href') || '')) {
          link.click();
        }
      });
      item.addEventListener('mouseleave', scheduleClose);
    }
    const headItem = document.querySelector('.sky .member > li.head:not([data-ani-head-hover])');
    if (headItem) {
      headItem.dataset.aniHeadHover = 'true';
      headItem.addEventListener('mouseenter', () => {
        clearTimeout(memberHoverCloseTimer);
        closeTopBarMenus();
      });
    }
    const bahaLink = document.querySelector('.sky .member > li.bahago > a:not(:has(img.ani-bahago-icon))');
    if (bahaLink) {
      bahaLink.innerHTML =
        '<img class="ani-bahago-icon" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAQAElEQVR4Aex9B3xVRfb/d+4rSd5LIBTBIL03BUEpgoj4FxCQpiK6EGoSdF0V/en+dXc1+7OsuutihyQIJKEjCKKgIiCLgCiodBABqaEbIK/klTu/cyZ5yWsJgVBeXN5nzr1TzpQ73ztnzpyZm2i49ouoHrgGSETBAVwD5BogEdYDEdacayPkGiAR1gMR1pxrI+QaIBffA91TU43Xvf9+rHXq+9dHT51Y359iMifeUGny5KrMgwr8i8gRUvmDD6pYstP6xmSmP2XJTJtiyZ68xJqZvu/7hrVc9jjTORhMOQaDYZ8/acJwyGvWTxGP25qVfjQ2K2OtJStjIflftUxL7x87M71VRcApIgBp/M47UXFZk++1ZmVMiM1O/9kTazwlpPhUE3hTCDFKSP0eCNQH6Ioy/WpKyM4CcgBxPyc0LJIebCVQcy1Z6R9bs9Iejpn1fh1Kizh3eQApy2NKKayZGcMs2emLcuJjTujQPwHkk1KiCWUXRJfeCVSmggcCYobmNh2wZqVvjMlOf4pFICLkd8UBiZua1twyPWOidXrGIQiZLST6ExBxwf1hMRrRrHI8xjVrhbc7dsWzN96MphQO5itnuJ0m8SYMpoOWzPR5JCIHtZw711zOMsuV/YoBEjtlUktLVsZnukFsErocB4lawS2Pj4pCn9r1MKd7T2wdNBQb+z+Af3W4DWOatsALbW/Bhnvvx5K7++K+eg3BgAXnL0fYKATuJxG5YL/zt41xWRljWHkoR3kXnfWyA2KdnnajJTNtvjRqW0im96GWhryBPRJqI+22O7BpwBDMvbMn+taphxrRMcQa6DTqtW7X10Jmt7sUWP+8tTNax1cNZCp3SLTWISfb44wbLFkTk8pd3AUWcNkAiZ0y5Tprdtob8IrVQojB1K6AuviVHNKgEdb1G4wFd/XGHxo1RbWoaGIrm6tjjcUjzVtjdd9BmN39bgymUcOAFeWWIIkYSLign2gmYEi3ZKd/U2nqB51whX4BnXSp6rSSFiONnvWQ4hnSiyoHlzuIOm89iZ8pXXvgxirVwOAE85Q1bNI09KtTH1k0arYMfBBPt26LSiYahDR7y0ICaQokJqF5pSJB4bKWT3NcF6/B+I11Wtrb7dPSTGXNd7F8lxQQNSqy0qeCtBgADYgCXNtq1fFV7/7Ips7jCTsg8RIE6sXG4e8334ptg4fiLVIE6scV6ApSE6C5i96PgkqEDgWMpks1igpiS70aoInHd8aIrdbsSW1K5SxnolbO/EXZrTPS20qjdwVFjCQKcFGaAc+3aY/V9wxEp+tqBqRdjkAVcxTGkiLwbd/7MInmppbxVVQ1AcBIiiJgRNGoofD5XVPo2noaLc/SqBPnZ79wjksCiHXapEToWEvqa+vgJjSpHI/1996H529qB5pLgpMvazjWZMIwmpu+I/E4mzS3m6pWU/UpYIwC0vf0BI4CxiPPP2IEomi0vG7JyphY/cPXC4agKvXSXLTyFhObmfEiNC0DEjHBZT1QvxFW9OqPxpUqBydd8XA/0tzW9h2Mabf3wO01E1T9kkUZA2MQUPONRq+USjn/RQikOMxVP7Z8+GGI+n7+3CVzUBNKTjxfijUz7Q0pZCrxmYmKnBACT7Rsg8ld70QVWlsUJZTPc0ly308vydKe/bCMXhRezxiprQoMA4FCAIEEEc9F0Qbj+euT8i5h8nzBhs3zM5eN46IBYTAgSIsKqsdM88W/br0Nr7TvAAM9bFByxAQ716ip1jMbaPH5crsO+FOLGzGmSXN8dGcv/ETrobsSbgD/WJTRfMHeEki0FsKw6lKBclGAxGanvYISwHj9lk5IadayhMZHXjSL0ydbtcE/qN1vd7odvWvXBavSSc1aqMayWBNuCZBGpiLCXGhQNdKEYVn81KnxYZIvKOqCAbFmpY2XUjwfrpZXb+mIpAoERrhn8MV1rVkLrKaDepsmcShQSCPzpYe5t3BrrkU0mjhHmOSyRWllYyvgis3K6AGINxHm90LbW5UhMExShYyKNhjwItnPeC6RBqGegUERHtKVVSjMRYhusdMz3ikPKGUGpEpmWl0JOZ2aUdA68vhc/7r1yRrb1hf83dzvrlUHySy66ImlWVNqMu2rAKWAIiUes2Smj7vYTigbIFIKl9DmUSUJRAGOV9zvkuwNiKyggV1nctF8/kw88/1a5Njt6ilebtcR/MIp0UWgqLuHkkoBRWjig6ipk5oQ1wW7MgESNz39OUB2CC6dVcZ5pJVciFEwuIxICk/auRWH7DZM3LkN49augkfqNH0IzLzjbtyVULugqTRaSCQBPNG7SxZfRqNhcs2sLGtBprJfzwtI9IwpDXWp/S1ckX8lGdswrlK4pAoXd5RGxIL9++i9o6ZLieU5h5C+czsFCpyXTBHsYzVYSKgVPc8pKGmil7JbnnA+hgv8nRcQg9f7LrUyxC7Ooop19wusL2LZp+zegVP5TjU/CCf1OLX0lc0b8c2xHPIBXp/ay0l+JFw0SghAxRR8kfL5qOzJjYOjSwuXCkhs9sTuBMY94Qp4pX1HRJEmEi6tQsVRY126Fx/u3kk+QJA9C7oO7ugzLheS1nytRJeBV/Hw/fwQIaCEU/clBN1FJaPUXwqKLDVYKiCQhrcpN0tNuhW7gfUaoPcNdYsjKrgvk8A45rBDiSMSQYL6mwHh8EFbHmbu2Y3KvMdCz8nGB5XOPD7iPCXPJ4Njpk/uQlnL5EoEpFLWpD5U303BpWjUot+TqOLn+6BwrlAgUAS/gYp4tFB4zr7duD7GQj5ymlCKliCvP2lKdFFkqDPT5thTodHhY0oERIdGmlVoJh4ZHa/AnkZozZcnZlXOEew+m6tGh4EA0CRQRPTW82hYc/wYrEaTagCbUorS/XlJailQFFfghXYo+8ZMKds5sLCAWKZ90J7q6hpYbEHoiZYhg6YgoYJeq0RHqZZzxwvy+ZPqeHrzPTSnLDtyiFLJUY/58/j7jcRLnU9MQU4gSjOY/hgUGzaohY01GseGi29XtTo6k5U0XFpFjWtWKR5moUE3igJRRG+iAqfwblCdDGz57ZR6REEjwT892G/IJwbFGXwRY5GWVjDMgpP8wqGALHkniirt7cdT5O1JiyON5pCiiAru+fDnnRBCoHtCwR6TNIDWFzKAeN/dbHPDQAtBHgEmpycgnUeEPzEPhxH8E7KaJVbrExwdHA4BJPZkNB954XO0AbxcyYMNL8oaEFBOpAR43nj6u2/w2cFfyeReTzVLN4Z0h4oXXsBk98Do8IJeVhVX4kUCGoEXNt0rB4aN94vU/PzKqwsMUZ6gS3NrPJrExwfFVtxg+q7ttL6Q+MvG9erghaBH8Zg0ugoEi6ELDfMooYJCnAD6kNmFbiFJRRHcgqIAe4QUITYrjucjnnz/PRAbDuft26Me5QCtM57ZsA4D6jYAqKu8ZsG3chFra6TqIsyvRtz0yWGVJR9vACBsYqeVeYgdncVVl9/RZD7v119wkswkRlJrNVrUrSHzyKbTJ1WfqMmdTCH8zOUgGEsQWySB2quKSrgEAOKSxubEF7K7b6BGd6gVYnkn1ornvNTZ727fohputnsRc84Nfpv35Z1TcSbSqpS6K1G8HrkIv6EE87yu67eqikq4BAAC4WkTjq+m2YL4CDs9Eq6dZYlbtH8vcshMYqTRwS+apgOWs25E2zyIyXPDVKLaWpbSi3k0jywO+Pk0oNSFHKUXc0uhFagbxVHK16ry72cyf+mnjeqZzKQx0QRLElqqY6UGAkgnFdhpMcJpNcJeyYS8+EKqQncmDvM9DJ2rYoaP8sjvjjJAhMVEtEJqaogUUo2iSwAg1J5GFBfiqhsLVrMhCRUsYmXOYew+dwYaiRNWTd1mAxxxJuRVNcMWb0Y+AeGO1uCO0uClhSIMGswmIypHRSPGZFJ+s7EgzHFMNSxWMNW0WHCD1Yp6sXHEawSXw+e9EPoT1hviq4VGF8QEAALIsCOkTuGh5YIsFff62uYfVONNZC53k4rrjDPCY9YQZTKB93dGN2mO19p3An9/srx3f2we8CC2Dx6KrYMexI7BDyk/h/kwt4+2DHwQ2wcNVbSNeLYRP5+QHNOkBeJMZlVfyMVoKXFCLgaEVuiQokpwZtY0asbEBEdXuPDW3FNYc/woeAI3Or3QTUI9QwK92d1qJuCWatch3+vF7rNnsPnUSXxLvKx9HczLg4FMK7xNXTPaAiY2xfvIQiMmivaFmIxCqDL5rNfbnbpifb/BeP6m9qhFdaiEwgtZBF6KyUrPsmRlTLYGnaYvAiT+WBz1uowuzFN804FKNGSLIyqm762tm1XDTWruAAw0SkAyntckXx4+iBl7dyv6kHYO39y2CX/54TuMW7cK3ZcuUgcf7lr6Cf60bjXtjfyM0/n5qiz/SxotNKdS3j0kElmT47S6JL6eb9MOPGImd+mO7tfXInAFr3H6UccPF5BjoBuWWGirg/mZKJ5vJZMoOanCpBwjrWo+aVc82o2k6jIQPInHnHbBTGovk8nmBRsGeVMq+MHOuF1Yf/IY5vz6CybTZtZ7OzbjtyBQHm7QGEsPH0CbhXNRa04mhqz8Elwnl1U9OgZDyez06d19sfeBYci8vQfSu9yB8a3aAEKSIU17D4W/8wJSwEevUoGnQl7/vXUT3GRCN9DokAbAbdGQT/OHO9YAT4wRLprY3VYDvDSZS0PBK8jih79lGUnzyrskflb3GYQjQ0diBc0tL7S9FcGHyOPMZsy5oyfe7XQ7/kHb2480b4VeteqE9BeLvvvqN8LDDZuqD1nvuD6BR0wDa3b6E8xcBIjJStYzwMOR/iSpfbwf4B9XkfwOjwezacePR4XJocMZHwVXrImAMMBDqimvzHkeuDPhBoxt2lJ1KJ+OP/rQSPW113vUwaNogr65WvXzfnonhMAoAnA08XN5saQsBPcVz1O+OJOmYXTTFiooIAazpwiQE9tP2CnCRlTk2MM7ZKftTvZWSMraswunSLwY8r3QNQFJT8xvN38vwp+/ceezBrX4//XBWx27qA69nSZ5PkJ6qR74lU0bEZudoajazCmoPnMqlh05CDbX9Eiorb44llJ2xtRUUrp9taam6pBivy/ofz9EmoZ/uKL4dSkxgcQVt9eU5yGzuBc8R7D8//Tgfrz44/e458tPUW9udkFnzZiCG2ZnosG8bDScN0NN5q0WzAYTn2jstHg+jjscXFyZaQIpCP8oVLd9mZxeD0atXoG+Xy3BSz9uUBM9pZmiRMINGnmKnYYDxYFi3yl3xRwhs0hzOmS3ERC6IgYjunAiN9DkbiBNi/fBeaHIx39cbg/O0mg6SZ1+wmHDYbIE77edA5MkST+3Ry/UuIAlwHGnHe/uKLCbFfem8mXnulzIpbqmkJLAphwaDMvzR6bsCQQE8qhiD7ocpMYFRVWI4NRfdqp2mkiTgiQvkSATifGcB1G5LkSdzkf0SaLj+Yg57lQUfSwfTKZcN+ClPOQaxVVWNDjf0AAADxxJREFU39PXtcZSqOyuBq1bpnXtQQtEU1EmmpPzdGiLoYu3JJDhljpPE5ukM284MwUBIsLCuen0KXh0ys45Kgh9d+IYLe6OKTMJq7NlaTY/oU6alotsVS6yR0mjQPvq1+HrPgNQNSqqLEWE8HSjtcdHNLLMNIFzopCI1aDPJVPyk0KKGIN01bPlOjvaU8arI5IBgAiJ7zlTMDk0HQfOnAmOjugwy25uoJHmDvDLRPOJz5gY7u4ljSu/ehTyya7F/vqxldQfvVl1z0BUMZcdjHzdi/8cPYJcVz5Xr6hLjQR803cw5tzZE39s0Vr91QmVIORd5/STNjz+eBFzACBWRPEcopBSGQovulHDupyQ6MLUyLtt++00Pjt0AMpMQmZ1n7gKd+fOd9SMQX41M3Syb/Gf7OAvdbcMHKL+6M2FPB2v+JuQMtBn2WeoPScLdedmofOnC/ACrfr5UHrf2vVwf72GWH3siCqWRuSPGJXqVIHCSwAgxxITbRDix8K0gNuG0ycCwpEcmEImDNaweK5QIIRrLKnA+dWiwKNCkmhqUbmKGhGsAvOXukKIcLlKjNtPG1xJa77GaRoZPE8xI5tY+PjQv0nTYg3tme/WojeBdcLp5GbNtyM65PxCACBcCI3sBXwPJrb15NMiKzg+EsMrcgreQKPTA37yEKJGe8jU7o0xoCqJow8634Flve9Fm6rV4CCVlJIvyDH49634nNY7Thjz3GAVO7iAX8jGNXHXNji9Xq8u9Sfticn3gwdAEGMIIDBpSyVgC+KDXehYd+xocHREhptUqqzaxRtO9CwBeOgGAcf1MXBVNikeNgRO2PYTMnfvwvW0txFTlu/TVc7iy+PffoOdZ3Kh0W6j6Tc33GSWKU4t9tFCL1t6ZBfHiHFvF8cG+kIAsT805oiAWB/IVhCad2Bvgadc18uf2Xe60ms1QNCQ9yevxQAWUY0INP4rdbNoouU/vfFEq5tQmwC50NZN3LkV00i95vkq6pRTzUOS5txw5UiDN9UxOiVs3/r4QwDhBCG96XwPps/JTO2vPQSnR0r4ATLeWWmfwhtjBC2DQfMiyBBVQDR3gH5naWF2x/UJ4L0QU6FKStEX7OYWHieKOumkxaeEp3DkhRQk5UrnHx497xuthWSkiGjPmSW8gCFvgGMz9peHCw8dB6REVqA2LeD4nJWkzueJ25EQA3uCBfZaFrgrFYiqE04HRqxeiRl7fi5X420eWkBSCVq+hE67jzwvUTDUCfF6aGRoTFhATo758zkh8WooO/CvrT/BRabscGmRFPfaLZ3Bpm5vdIGIiqeF3U1VqmFogyZ4vk17fN6zH7679z71l+zK026apFV2Pt/lqmxW/uCLhNxri45fGRwfLhwWEGbUHDKD7qSm0NXPbc89jYX79/nFRKaXV9YTyHrrax2LWrPBgNZVqmJ8y5vQtWYCatDGkS/9Yu4uWgTmkebJ84fHYgTPT+HKERCpGDLEFS4tOK5EQM6lpJwkZFODM3D4ja0/4AzJYPZHMvHfYfxb2/bqb2a9eett+DttLKU0a4kYml8uRbsdHi9stJsIAfAKP1yZEnKPzSHnh0sLF1ciIMxs9prfp/txogC3MzcXH/68IyAuUgN/vrGd+qtyKbSDd0dCrUsGBj8vzx+84SRpEcmaG8cFkybEn5GSwntNwUlhw6UCkjtqVK6E/ny4nBO2b4IyG4dL/C+J45W4h9Tqkh5XQizOG5YUdqFdUp5SAeFM9sRxH9KQ/Jr9/sSbPGwK8I/7b/Mv2F+6FkuSzGSZnrHQmpW+zZqdscqSOfHm8/XReQHhAgwePRlShCzTFx7YB94EYp7/Njqd70Q2bQ+X/tyyN2mr/UlstYSU3YRmWGnJTO9XWp4yAXJ21LjdpEmMD1fQk9+twQ8nr77hMVzbLmfcR7/uAZ/p4jqMNIewis1qNSsSjzRrhb/f3EH9gec1fQdh68CheIqP/EhUJtbF1sy0NwggGkCcO5DKBAhn0Y2SV1CS/f5kc7uxLCfyF4v+bS6vn89puXWJud17YW2/wdg++CFs5SOk5M/qdhf+2eE2PN26jfoDz22qVkfd2Fj8b7sOyOhyJ6I0AyDEMyTCpsROnFgDQb8yARI/dWJ9AbGC8gqiADe8cVP8T+u2AXG/90Blk1ltNPWpUxc8KmqRDSzOWGABKO3ZH2rYGEt69UVdq/rrsiOl1bAyOjOtrn+e8wJiyU5LcBmNy0HDzT8j+0c3aY73OnWDgcYhh0sjOy2gvifR9gnNO7P37sYHZJR7ddNG/P8N6/Ds92sVvbt9M5YfOYSTtF9QWlkVOa1j9ZpqS7ht1ev4MVpq0L6Jm5lWnQNMpQMipaAMs8la2pCZ/ekBMuBN6Ng1LBj8udgiWs2//NMGDP/Pcty0cA5qzJqKO5cuxMOrvsJY2sh59vt1eHXzD3hvx1YCZ5ui5zaux4DlS9F0/gzc/cViStuCQzabf7W/Cz9bCJbc3QeDaPdQCFnH7Tb09T1YqYDEzpg8R5J24GP23fl4ZVqX7kVg8J7CqmM5eG7Dt2i3aB4azM3GH/7zFV7b8iM+JtVw77mzIKUAmsML4zk3jGdcMJ3Kh/mEE+bjxWQ87YKBtlzdtAJed/wojZ5v0frjWdhc+NG+r/7fw91qMoG3mvlZhKbv5jtTiYDEZma8KHX5ADP5E/9zlX936AIPGRiX0r51Er3tDedlo++Xn6ozSD+fzYX0z0B+7uToX22I3m+D+bAD5hwnTCfyYTzlAoPgIwYn6qAd5kN2BSBlxV/J3MFymv0Vgc6RkrPq6BFMot3B0tr79dHDUH0l5TrHJ8uK9kjCAhKbOelPhX+xOqBMHhmPt7wRE2iPuMtnC/DAyi/UOoSPagYwBgW8ViMcDaxwVzPT5hAnMmThiU3YLjKXs+n80eat8TRtHHGOSCaSIthBRlf+5v22z+ajL+2brz9xrNQmf1S4jyI1zMS8eV4fcwgglqyMPjRz/NPH4LvzfvMpWgzd9ukCvERzA3/Y4ksr050mfvd10XDWi4W7ahSkRgobY0KZpUEDg+aqEY38elZIk6bO2PIfNxaC+IgnEt1huw1pNBI6LP4IHalf3ialZN+5c6qpTSsVfJe5mkQ5v7gMGifwCPriyAGoVb6U+dLtXcLxPgoAJC7zvaYCcholhhxE4sNyiw/8ChtpS5RekjtL8upMSYkcz53tpo53NoxFfl0LHI0qwdGY/HWs8FQloAwC99apj9dpP8MQgWCwlZutE/2/WoKbF83F09+txY4zudClvksI8aoEFvFz1rHGggG6f8XnYNH+0+lTYE3zxR/X43/Wr1X9KDV85RwduItYBAivNXRh/oIKu46oVEeV5gFiK92n0fv7stDEUF16a9sSkytLp2wByM9xnh/vO3utpLubNdSLjcNDtHH0Ei2e1vW7D7O63w3+RABX8MeKB3/CxtrhjF9+xrTdOzFzz25sI1Hk9Hrw1ZGDeJkkQ+05merP/q3IOQy713OMFNGp0osOtsSU5nnDk/4CgRhu9jvbt4BFmO8F1qXEU2TVSN+1A75v4qVXZDGvPylAqk6fXsltMCyihPpERY7KsNMbvxNSTNchnpACA7xebwN7YnKcLTHpRrqPyktM/htZNOc4RjxymDPaU1JybHtz+hL6YwgwAo5jQ4mH9Gzq+CMPjsA2WulmdO2O8WReuJE2kEK5L1/MQVue+myNVfNepJj8gbTDlHWr8Ni3q5G89mt0XDwf/PnAwOWfK62RngnUL5+QWO9n23Okln1E0mj7qOTiE5/C8BG3djsBSXy0kydOcThpzUpM5+1iiSP0wr4Fr36PY2TyXE7zJw1z5xrypeN9CHGaErJ0aE/pUn/AILQm9hHJVtuI5Ba2EUnDHYlJ79iHJ3/iHPXIr8RXuktN1e3DkqdY3IZmAuIdCeEMzsAaxnh6Y94iBYHfzuD0KxGe/+te9Fj6CTacPB62Ogl1tHYlJZ4kWqZT33h02Yv6ZYB9+NjPkJqqU3yAsw8bk0EqYk8IDDPZPO0p8WUiz89nz9BNbvLku+6k0TTeNmrc5xQR4jQMGeK1DU8aTkSMySMciWMnOEaM++js8LG/hHBfYMTJMWOO5CUmPQG31ogaOJuyu4iKHBvnXqe1SpuFc9SCcBmJBZvHXZR+uTwkajCO1PURq5cjx2ELU438QUp9oD0xmURRcg9bYvJ1RD0d1Df5I1O+DJMhIMo2fNwy2/DkGWceffQ3W2LSW16IpiQxOti8OZ3ykx9jm2AAv39AiSz/iMvhtxMw1MCHvB5PCyr/DRrz/LqQt8BJui0nk8kgEgt15mQpdXryru24YE2OyinJsSyftWc3Hlv3H/ALMJ3MN8G8UojPvULQi5nS3j5iHIvwYJaLCjsTk/aRxPgeo1JDJEVwgVcEEF+lrFHQm/ZnmxO1pKaNofhlBEbAqHEVLjjZrM9aDB9Y5mOaz238FukE0oojh/HjqRPgv9N+iNTOYw47mFgF5fO1LLtXH83BDOr8F8gUM5JMN60+nq2+jEqiOWHaL7vAI5PqVo5E6l4p5UtuuFvahyfd4xyeFLIZpxiv0OWKAlL0TLTHbB82dgqB01N3aU0hxGhKI1ktz9I9wJ3Oz8cXhw/i3e1blJbSf/kS3L5kIdp/Mg8tF8wimq2oFfm54zvQJHzPsk+RQp3/b1oXfESmGwbKIwvEPb0A+VTBTqrzn1L33JKX62hpH5HygivxjxFxSODqAEI94nPOsWP30/w1lcDpYY5GXQFjd0j5HCRmEe2mDvT4eIPvOqkx/D0Gk4f8wemF4RMQ+JLKeltIndRz2ZTqa0n0rH3koxv9v80o5L+qt6sOiP/T/zYk5Uxe4uhVthEpr9lGJD9s23ekpfS4G+qa6CwFBugQ4yXEK4Dgz8EmkaiZLKWYKoFJlP4edfq/pBB/ATBK07SuHrNsHJXrbEzzVy8q78m8EePmOEekHIAQlIW4ItBFFCAh/ZOa6nGM/uNBx7Ckb1nldpDGYk9M+itpLuPticmPkKhJUusA9g9P/hN1+jM0D7xKo23auWFj1+QPTdlz+vHHQ8RgSD0RFBHZgERQR13KppRW1jVASuudq5B2DZCr0OmlVXkNkNJ65yqkXQPkKnR6aVVeA6S03rkKadcAuQqdXlqV1wAprXeuQto1QK5Cp5dW5f8BAAD//zuYcGQAAAAGSURBVAMAr1lwfcGMA3UAAAAASUVORK5CYII=" alt="" />';
    }
    for (const area of document.querySelectorAll(
      '#blockVideoInSeason .newanime-date-area:not([data-ani-cleaned])',
    )) {
      area.dataset.aniCleaned = 'true';
      area.style.setProperty('background', 'transparent', 'important');
      area.style.setProperty('background-image', 'none', 'important');
      area.style.setProperty('mask-image', 'none', 'important');
      area.style.setProperty('-webkit-mask-image', 'none', 'important');
      for (const svg of area.querySelectorAll('.anime-date-info > svg')) {
        if (svg.getAttribute('preserveAspectRatio') !== 'none') {
          svg.setAttribute('preserveAspectRatio', 'none');
        }
      }
      for (const el of area.querySelectorAll(
        '.anime-content-block, .anime-block, .anime-card-block, .anime-blocker, .anime-detail-block, .anime-name-block, .anime-name, .anime-name *',
      )) {
        if (el.classList.contains('anime-card-block')) {
          el.style.setProperty('background', 'transparent', 'important');
          el.style.setProperty('background-image', 'none', 'important');
          el.style.setProperty('mask-image', 'none', 'important');
          el.style.setProperty('-webkit-mask-image', 'none', 'important');
          continue;
        }
        el.style.setProperty('background', 'transparent', 'important');
        el.style.setProperty('background-color', 'transparent', 'important');
        el.style.setProperty('background-image', 'none', 'important');
        if (!el.classList.contains('anime-name') && !el.closest('.anime-name')) {
          el.style.setProperty('mask-image', 'none', 'important');
          el.style.setProperty('-webkit-mask-image', 'none', 'important');
        } else {
          el.style.setProperty('color', '#ffffff', 'important');
          el.style.setProperty('opacity', '1', 'important');
        }
      }
      const picBlock = area.querySelector('.anime-pic-block');
      const popularity = area.querySelector('.anime-watch-number');
      if (popularity && !popularity.querySelector('.ani-popularity-icon')) {
        const icon = document.createElement('span');
        icon.className = 'ani-popularity-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><path d="M5 19v-7m7 7V5m7 14v-10"/></svg>';
        popularity.prepend(icon);
      }
      const epBlock = area.querySelector('.anime-episode');
      let movieLabelEl = null;
      let isPaidMember = false;
      for (const badgeEl of area.querySelectorAll('.anime-detail-block *')) {
        if (badgeEl.children.length !== 0) continue;
        const txt = (badgeEl.textContent || '').trim();
        if (txt === '付費會員') {
          isPaidMember = true;
          badgeEl.style.setProperty('display', 'none', 'important');
        } else if (txt === '電影' && !badgeEl.closest('.anime-episode')) {
          movieLabelEl = badgeEl;
        }
      }
      area.classList.toggle('ani-member-anime', isPaidMember);
      if (isPaidMember) {
        const watchNum = area.querySelector('.anime-watch-number');
        if (watchNum && !watchNum.querySelector('.ani-paid-badge')) {
          const paidBadge = document.createElement('span');
          paidBadge.className = 'ani-paid-badge';
          paidBadge.textContent = '付費會員';
          watchNum.append(paidBadge);
        }
      }
      if (epBlock) {
        const rawEp = (epBlock.textContent || '').replace(/\s+/g, ' ').trim();
        const epMatch = rawEp.match(/第\s*(\d+(?:\.\d+)?)\s*[集話]/);
        let epLabel = '';
        if (rawEp === '電影' || (movieLabelEl && !epMatch && !/\d/.test(rawEp))) {
          epLabel = '電影';
          if (movieLabelEl) {
            movieLabelEl.style.setProperty('display', 'none', 'important');
          }
        } else if (epMatch) {
          epLabel = `EP.${epMatch[1]}`;
        } else if (rawEp.startsWith('EP.') && /\d/.test(rawEp)) {
          epLabel = rawEp;
        } else {
          const stripped = rawEp.replace(/^第|[集話]$/g, '').trim();
          epLabel = stripped ? `EP.${stripped}` : '';
        }
        if (!epLabel) {
          epBlock.style.setProperty('display', 'none', 'important');
        } else {
          epBlock.innerHTML = `<svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M0.781049 0.781049C0 1.5621 0 2.81918 0 5.33333V10.6667C0 13.1808 0 14.4379 0.781049 15.219C1.5621 16 2.81918 16 5.33333 16H10.6667C13.1808 16 14.4379 16 15.219 15.219C16 14.4379 16 13.1808 16 10.6667V5.33333C16 2.81918 16 1.5621 15.219 0.781049C14.4379 0 13.1808 0 10.6667 0H5.33333C2.81918 0 1.5621 0 0.781049 0.781049ZM12.8 8C12.8 7.22154 11.8154 6.70256 9.84615 5.66461L7.63077 4.49692C5.66154 3.45897 4.67692 2.94 3.93846 3.32923C3.2 3.71846 3.2 4.75641 3.2 6.83231V9.16769C3.2 11.2436 3.2 12.2815 3.93846 12.6708C4.67692 13.06 5.66154 12.541 7.63077 11.5031L9.84615 10.3354C11.8154 9.29744 12.8 8.77846 12.8 8Z" fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"/></svg><span class="ani-ep-text">${epLabel}</span>`;
          if (picBlock && epBlock.parentElement !== picBlock) {
            picBlock.append(epBlock);
          }
          epBlock.style.removeProperty('background');
          epBlock.style.setProperty('color', '#ffffff', 'important');
          epBlock.style.setProperty('padding', '0 8px', 'important');
          epBlock.style.setProperty('border-radius', '999px', 'important');
        }
      }
      const hoursBlock = area.querySelector('.anime-hours-block');
      if (picBlock && hoursBlock && hoursBlock.parentElement !== picBlock) {
        picBlock.append(hoursBlock);
      }
      if (hoursBlock) {
        hoursBlock.style.removeProperty('background');
        hoursBlock.style.setProperty('border-radius', '999px', 'important');
      }
      // Explicitly select the palette per card; hidden site badge templates
      // must not cause free titles to inherit the member palette.
      for (const pill of [hoursBlock, epBlock]) {
        if (!pill) continue;
        pill.style.setProperty('background', isPaidMember
          ? 'linear-gradient(135deg, rgba(112, 105, 170, .76), rgba(67, 65, 112, .72))'
          : 'linear-gradient(135deg, rgba(68, 126, 158, .68), rgba(46, 92, 118, .58))', 'important');
        pill.style.setProperty('border-color', isPaidMember ? 'rgba(202, 198, 245, .6)' : 'rgba(255, 255, 255, .28)', 'important');
      }
      if (isPaidMember && epBlock) {
        epBlock.title = '付費會員限定';
        if (!epBlock.querySelector('.ani-member-lock')) {
          const lock = document.createElement('span');
          lock.className = 'ani-member-lock';
          lock.setAttribute('aria-label', '付費會員限定');
          lock.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="10" height="7" rx="2"/><path d="M5 7V5a3 3 0 0 1 6 0v2m-3 3v1"/></svg>';
          epBlock.prepend(lock);
        }
      }
      const favBtn = area.querySelector('.btn-card-block');
      if (favBtn) {
        if (picBlock && favBtn.parentElement !== picBlock) {
          picBlock.append(favBtn);
        }
        if (favBtn.classList.contains('btn-favorite') && !favBtn.querySelector('svg')) {
          favBtn.innerHTML = '<svg width="16" height="14" viewBox="-1 -1 19.2 16.4" fill="none" aria-hidden="true"><path d="M 12.95 0.01 C 11.45 0.01 10.23 0.76 9.43 1.51 C 8.97 1.94 8.74 2.16 8.58 2.16 C 8.41 2.16 8.19 1.94 7.73 1.51 C 6.78 0.58 5.52 0.05 4.2 0.01 C 1.41 0.01 -0.69 3.19 0.21 6.55 C 0.82 8.82 3.44 10.8 5.74 12.59 C 7.24 13.77 8 14.36 8.58 14.36 C 9.15 14.36 9.91 13.78 11.42 12.59 C 13.72 10.8 16.34 8.82 16.94 6.55 C 17.84 3.18 15.74 0 12.95 0 Z"/></svg>';
        }
      }
      for (const paidEl of area.querySelectorAll('.anime-detail-block *')) {
        if (paidEl.children.length === 0 && (paidEl.textContent || '').trim() === '付費會員') {
          paidEl.style.setProperty('display', 'none', 'important');
        }
      }
    }
    const cache = readScoreCache();
    for (const area of document.querySelectorAll(
      '#blockVideoInSeason .newanime-date-area',
    )) {
      const picBlock = area.querySelector('.anime-pic-block');
      const cardLink = area.querySelector('.anime-card-block');
      if (!picBlock) continue;
      let capturedScore = '';
      for (const candidate of area.querySelectorAll('*')) {
        if (
          candidate.matches(
            '.anime-detail-info-block, .anime-label-block, .anime-detail-block, .anime-pic-block, .anime-blocker, .anime-card-block, .anime-block, .anime-content-block, .anime-hours-block, .anime-hours, .anime-episode, .anime-watch-number, .anime-name-block, .anime-name, .date-block, .anime-date-info, a',
          ) ||
          candidate.closest(
            '.ani-score-badge-top-left, .anime-episode, .anime-watch-number, .anime-name-block, .date-block, .anime-date-info',
          )
        ) {
          continue;
        }
        if (candidate.children.length > 0) continue;
        const rawTxt = (candidate.textContent || '').replace(/\s+/g, ' ').trim();
        const match = rawTxt.match(/^(?:★\s*)?([0-5]\.\d{1,2})$/);
        if (!match) continue;
        capturedScore = match[1];
        candidate.style.setProperty('display', 'none', 'important');
        break;
      }
      const snMatch = (cardLink?.getAttribute('href') || '').match(/[?&]sn=(\d+)/);
      const sn = snMatch ? snMatch[1] : '';
      if (capturedScore) {
        if (sn) writeScoreCache(sn, capturedScore);
        renderTopLeftScoreBadge(picBlock, capturedScore);
      } else if (!picBlock.querySelector(':scope > .ani-score-badge-top-left:not([hidden])') && sn) {
        if (cache[sn]?.s) {
          renderTopLeftScoreBadge(picBlock, cache[sn].s);
        } else {
          renderTopLeftScoreBadge(picBlock, '');
          queueScoreFetch(sn);
        }
      }
    }
    for (const title of document.querySelectorAll('#blockVideoInSeason .newanime-date-area .anime-name:not([data-ani-marquee-init])')) {
      if (releaseTitles) releaseTitles.observe(title);
      else measureReleaseTitle(title);
    }
    // Style 相關商品 header icon, capsule buy button, right-aligned price & hide carousel arrows unless many items scroll
    const ungroupedMerch = document.querySelector('#BH_background > .container-player:has(> section.player) .store_wrapper:not(.ani-watch-related-row .store_wrapper)');
    if (ungroupedMerch) syncCollapsibleRegions();
    for (const merchSec of document.querySelectorAll('#BH_background .ani-merch-section')) {
      const mHead = merchSec.querySelector(':scope > h2, .store_title > h2, h2, .title');
      if (mHead?.textContent.trim() === '相關商品') mHead.classList.add('ani-merch-native-heading');
      if (mHead && !mHead.querySelector('.ani-section-icon')) {
        const ic = document.createElement('span');
        ic.className = 'ani-section-icon';
        ic.setAttribute('aria-hidden', 'true');
        ic.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7.5" width="16" height="13.5" rx="3"/><path d="M8.5 7.5V6a3.5 3.5 0 0 1 7 0v1.5"/><path d="M9.5 12a2.5 2.5 0 0 0 5 0"/></svg>';
        mHead.prepend(ic);
      }
      const mList = merchSec.querySelector('.store_wrapper');
      let mItems = [...merchSec.querySelectorAll('.store_item, .store_wrapper li')];
      if (!mItems.length) {
        mItems = [...merchSec.querySelectorAll('.store_wrapper > *')].filter((el) => el.querySelector('img'));
      }
      for (const card of mItems) {
        card.classList.add('ani-merch-card');
        if (card.dataset.aniMerchEnhanced === 'true') continue;
        card.dataset.aniMerchEnhanced = 'true';
        const art = card.querySelector('img');
        const cover = art?.dataset.src || art?.currentSrc || art?.src;
        if (cover && /^https?:/.test(cover)) card.style.setProperty('--ani-merch-cover', 'url(' + JSON.stringify(cover) + ')');
        const ctaCandidates = [...card.querySelectorAll('a, button, [role="button"], [class*="buy" i], [class*="btn" i]')];
        const buyBtn = card.querySelector('.btn-buy-now') ||
          ctaCandidates.find((el) => /^(?:前往購買|購買|立即購買|前往商品|搶購|下單)$/.test(el.textContent.trim())) ||
          ctaCandidates.find((el) => /購買|前往/.test(el.textContent.trim()) && el.children.length <= 2) ||
          card.querySelector(':is(.store_buy, .store_btn, a.btn, button)');
        if (buyBtn) {
          buyBtn.classList.add('ani-merch-buy-btn');
          const buyText = buyBtn.textContent.includes('預購') ? '立即預購' : '立即購買';
          buyBtn.setAttribute('aria-label', buyText);
          buyBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h3l3 12h11l3-9H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>';
          buyBtn.append(document.createTextNode(buyText));
        }
        const leafNodes = [...card.querySelectorAll('*')].filter(
          (el) => el !== buyBtn && !buyBtn?.contains(el) && !el.querySelector('*') && el.textContent.trim()
        );
        const priceEl =
          card.querySelector('.store_price, .products-price') ||
          card.querySelector('[class*="price" i]') ||
          leafNodes.find((el) => /^(?:NT\$|＄|\$)\s*[\d,]+/.test(el.textContent.trim()));
        if (priceEl) priceEl.classList.add('ani-merch-price');
        const bonusEl =
          card.querySelector('[class*="bonus" i], [class*="point" i]') ||
          leafNodes.find((el) => el !== priceEl && /^(?:紅利|點數|預購|贈品)/.test(el.textContent.trim()));
        if (bonusEl && bonusEl !== priceEl) bonusEl.classList.add(/^紅利/.test(bonusEl.textContent.trim()) ? 'ani-merch-points' : 'ani-merch-bonus');
        if (priceEl && !card.querySelector('.ani-merch-meta-row')) {
          const metaRow = document.createElement('div');
          metaRow.className = 'ani-merch-meta-row';
          if (bonusEl && bonusEl !== priceEl) metaRow.append(bonusEl);
          const discount = card.querySelector('.products-discount') ||
            leafNodes.find(element => /^\d{1,2}(?:\.\d+)?\s*折$/.test(element.textContent.trim()));
          const priceLine = document.createElement('div');
          priceLine.className = 'ani-merch-price-line';
          priceLine.append(priceEl);
          if (discount) {
            discount.classList.add('ani-merch-discount');
            priceLine.append(discount);
          }
          metaRow.append(priceLine);
          if (buyBtn && card.contains(buyBtn)) { buyBtn.before(metaRow); metaRow.append(buyBtn); }
          else card.append(metaRow);
        }
        const productLink = card.querySelector(':scope > a:has(> .products-card-img)');
        if (productLink?.querySelector(':scope > .products-name') && productLink.querySelector(':scope > .ani-merch-meta-row')) {
          const copy = document.createElement('div');
          copy.className = 'ani-merch-copy';
          const content = productLink.querySelectorAll(':scope > :is(.products-name, .products-info, .products-price-area, .ani-merch-meta-row)');
          content[0].before(copy);
          copy.append(...content);
          const priceArea = copy.querySelector(':scope > .products-price-area');
          if (priceArea && !priceArea.firstElementChild && !priceArea.textContent.trim()) priceArea.hidden = true;
        }
      }
      if (mItems.length && mList && !mList.parentElement.classList.contains('ani-poster-rail')) {
        const rail = document.createElement('div');
        rail.className = 'ani-poster-rail ani-watch-poster-rail';
        mList.before(rail);
        rail.append(mList);
        bindPosterRail(rail, mList, '.ani-merch-card', '商品');
      }
      const canScroll = mItems.length > 1 && mList && mList.scrollWidth > mList.clientWidth + 4;
      merchSec.classList.toggle('ani-merch-no-scroll', !canScroll);
    }
    for (const showMoreBtn of document.querySelectorAll(
      '#blockVideoInSeason .anime-btn-show-more:not([data-ani-show-more])',
    )) {
      showMoreBtn.dataset.aniShowMore = 'true';
      showMoreBtn.addEventListener('click', (event) => {
        const wrap = showMoreBtn.closest('.newanime-wrap');
        if (!wrap) return;
        event.preventDefault();
        event.stopPropagation();
        wrap.classList.toggle('ani-expanded');
        // Visibility changes do not trigger the child-list observer. Measure
        // newly revealed titles after layout, rather than while still hidden.
        requestAnimationFrame(() => {
          for (const title of wrap.querySelectorAll('.anime-name:not(:has(.ani-marquee-track))')) {
            delete title.dataset.aniMarqueeInit;
          }
          enhanceSiteControls();
        });
      });
    }
    for (const heading of document.querySelectorAll(
      '#BH_background :is(.theme-title, .theme-title-block > h1, .theme-title-block > h2, .theme-title-block > h3)',
    )) {
      if (!/^繼續觀看\s*$/.test(heading.textContent.trim())) continue;
      heading.classList.add('ani-continue-heading');
      if (!heading.querySelector('.ani-continue-icon')) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'ani-continue-icon';
        iconSpan.setAttribute('aria-hidden', 'true');
        iconSpan.innerHTML =
          '<svg viewBox="0 0 512 512" fill="currentColor"><path d="M75 75L41 41C25.9 25.9 0 36.6 0 57.9V168c0 13.3 10.7 24 24 24H134.1c21.4 0 32.1-25.9 17-41l-30.8-30.8C155 85.5 203 64 256 64c106 0 192 86 192 192s-86 192-192 192c-40.8 0-78.6-12.7-109.7-34.4c-14.5-10.1-34.4-6.6-44.6 7.9s-6.6 34.4 7.9 44.6C151.2 495 201.7 512 256 512c141.4 0 256-114.6 256-256S397.4 0 256 0C185.3 0 121.3 28.7 75 75zm181 53c-13.3 0-24 10.7-24 24V256c0 6.4 2.5 12.5 7 17l72 72c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-65-65V152c0-13.3-10.7-24-24-24z"/></svg>';
        heading.prepend(iconSpan);
      }
    }
    for (const seg of document.querySelectorAll(
      '#blockVideoInSeason .nav-segment-control:not([data-ani-seg-icon])',
    )) {
      seg.dataset.aniSegIcon = 'true';

      const text = seg.textContent || '';
      const iconSpan = document.createElement('span');
      iconSpan.className = 'ani-segment-icon';
      iconSpan.setAttribute('aria-hidden', 'true');
      if (text.includes('週期表')) {
        iconSpan.innerHTML =
          '<svg viewBox="0 0 40 40" fill="none"><path d="M31.6667 36.6673H8.33333C7.44928 36.6673 6.60143 36.3161 5.97631 35.691C5.35119 35.0659 5 34.218 5 33.334V10.0007C5 9.1166 5.35119 8.26875 5.97631 7.64363C6.60143 7.01851 7.44928 6.66732 8.33333 6.66732H11.6667V3.33398H15V6.66732H25V3.33398H28.3333V6.66732H31.6667C32.5507 6.66732 33.3986 7.01851 34.0237 7.64363C34.6488 8.26875 35 9.1166 35 10.0007V33.334C35 34.218 34.6488 35.0659 34.0237 35.691C33.3986 36.3161 32.5507 36.6673 31.6667 36.6673ZM8.33333 16.6673V33.334H31.6667V16.6673H8.33333ZM8.33333 10.0007V13.334H31.6667V10.0007H8.33333ZM28.3333 23.334H11.6667V20.0007H28.3333V23.334Z" fill="currentColor"/></svg>';
      } else {
        iconSpan.innerHTML =
          '<svg viewBox="0 0 40 43" fill="none"><path d="M39.1721 15.3657C39.1721 15.1555 39.0016 14.9824 38.7946 14.9824L37.098 14.9865C37.4055 15.3018 37.5962 15.7324 37.5962 16.2053L37.7637 35.4855C37.7657 35.7379 37.5831 35.9532 37.3375 35.9892L13.2646 39.4682L13.3783 40.5891C13.3783 40.7992 13.5488 40.9723 13.7558 40.9723L38.9833 37.4665C39.1914 37.4665 39.3608 37.2945 39.3608 37.0833L39.1721 15.3657Z" fill="currentColor"/><path d="M8.26113 16.2192C8.28548 15.6649 8.11501 15.1581 7.7761 14.7831C7.42704 14.3978 6.93593 14.1855 6.39205 14.1855C5.79946 14.1855 5.29819 14.4359 5.05264 14.5853L5.01509 14.6079L4.97958 14.6327L0.886262 17.4606C0.251057 17.8809 -0.0878539 18.6391 0.0197047 19.4035L2.79796 38.9979C2.89335 39.6737 3.33373 40.2568 3.94965 40.5288L7.71116 42.2616C8.27534 42.5222 8.7076 42.6376 9.11044 42.6376C9.68273 42.6376 10.185 42.3996 10.5239 41.968C11.1084 41.2242 10.9014 40.3063 10.8243 39.9601C10.6305 38.8042 8.34028 17.6151 8.26113 16.2192ZM9.10942 41.1232C8.93388 41.1232 8.67919 41.0449 8.32709 40.8821L4.55137 39.1432C4.40323 39.0814 4.29871 38.9443 4.27537 38.7826L1.49711 19.1882C1.47073 19.0048 1.55394 18.8225 1.70919 18.7246L5.81874 15.8854C5.99022 15.7813 6.20838 15.6999 6.39205 15.6999C6.62137 15.6999 6.79793 15.8256 6.76749 16.1872C6.72385 16.7095 9.2322 39.6902 9.36817 40.298C9.48892 40.8358 9.44529 41.1232 9.10942 41.1232Z" fill="currentColor"/><path d="M14.9266 39.535L12.4436 16.3163C12.4152 16.0382 12.469 15.7539 12.606 15.4757C12.6719 15.3407 12.7622 15.2264 12.8576 15.1172L11.2168 15.1265C11.0088 15.1265 10.8394 15.2985 10.8394 15.5097L13.3781 40.5899C13.3781 40.8001 13.5486 40.9731 13.7556 40.9731L15.508 40.7207C15.1904 40.4457 15.0088 40.1613 14.9266 39.535Z" fill="currentColor"/><path d="M39.1233 27.0901C38.7113 27.0942 38.3764 27.4362 38.3805 27.8545L38.5094 37.0841C38.5094 37.2942 38.3389 37.4673 38.1319 37.4673L13.7557 40.9731C13.5476 40.9731 13.3782 40.801 13.3782 40.5898L10.8384 15.5096C10.8384 15.2995 11.0089 15.1264 11.2159 15.1264L37.9432 14.9832C38.1512 14.9832 38.3206 15.1552 38.3206 15.3664L38.4322 23.2196C38.4363 23.6358 38.7691 23.9707 39.1781 23.9707H39.1852C39.5971 23.9665 39.9289 23.6245 39.9249 23.2062L39.8133 15.3541C39.8133 14.3208 38.9741 13.4688 37.9432 13.4688L22.7835 13.5502C22.7459 13.1855 22.6749 12.8342 22.5684 12.4942C26.2213 12.1368 31.6926 9.35933 31.9909 9.20377L32.0782 9.15432C33.0421 8.62171 32.8808 7.89954 32.7306 7.59151C32.7022 7.51115 32.0295 5.60529 30.5176 3.6376C29.032 1.70495 27.5648 0.433683 27.5394 0.415139C27.0706 -0.0463902 26.3857 -0.131897 25.8377 0.202918C25.7931 0.229703 25.7515 0.261639 25.7129 0.297696C25.0706 0.903454 19.6937 6.0287 18.4964 8.79169C18.1696 8.72782 17.8348 8.68867 17.4908 8.68867C17.091 8.68867 16.7054 8.74533 16.331 8.83084C16.2884 8.84011 16.2488 8.82157 16.2315 8.78139C15.1641 6.28625 11.3478 2.85774 10.813 2.38797C10.5644 2.20872 10.261 2.13763 9.95965 2.19017C9.70191 2.23447 9.58725 2.33646 9.30009 2.55795C8.92363 2.87629 7.69686 3.95181 6.81508 5.20145C5.69687 6.78795 5.50611 8.65571 5.4919 8.73503C5.4503 8.95034 5.35492 9.68075 5.94649 10.1021C6.52995 10.4421 8.64053 11.6433 10.5583 12.4221V12.4293C10.6953 12.486 10.8313 12.5406 10.9652 12.5921C11.0525 12.6261 11.1418 12.6415 11.2301 12.6415C11.5304 12.6415 11.8145 12.4561 11.9282 12.1532C12.0743 11.7618 11.8805 11.325 11.4949 11.1766C11.2646 11.088 11.022 10.9819 10.7805 10.8758C9.67046 10.3978 8.40309 9.75596 7.34678 9.16772C7.11746 9.03997 7.00686 8.77727 7.0718 8.51972C7.22908 7.89542 7.55175 6.81886 8.06012 6.03797C8.53297 5.31168 9.25849 4.60084 9.75062 4.15682C9.97487 3.95491 10.3077 3.95181 10.5279 4.15786C12.0783 5.60735 14.0235 7.68835 14.7369 9.08736C14.8282 9.26661 14.7511 9.47987 14.5847 9.5901L14.4639 9.66942C13.3224 10.4318 12.5106 11.632 12.2539 13.0691L12.192 13.6068L11.5132 13.611C10.6994 13.6151 9.88862 14.0179 9.52637 14.7576C9.37924 15.0584 9.32038 15.3654 9.35082 15.6652L11.8856 40.697C11.9404 41.6942 12.7572 42.4885 13.7526 42.4885L13.9616 42.473L38.2729 38.9765C39.2369 38.9013 40 38.0813 40 37.0841L39.8711 27.8411C39.8691 27.4249 39.5332 27.0901 39.1233 27.0901ZM17.4918 10.202C19.3893 10.202 20.957 11.6062 21.2736 13.442C21.2837 13.5018 21.2361 13.5584 21.1772 13.5584L13.8023 13.5976C13.7425 13.5976 13.6948 13.5419 13.7049 13.4822C14.0053 11.6258 15.5801 10.202 17.4918 10.202ZM25.8225 2.28289C26.2467 1.86566 26.9194 1.8739 27.3395 2.29525C27.8732 2.82993 28.6089 3.61803 29.3395 4.5689C30.1462 5.61765 30.6931 6.66021 31.0117 7.35353C31.1487 7.65023 31.031 7.99844 30.7398 8.14061C29.2147 8.88132 24.7703 10.9294 22.0651 11.0107C21.9382 11.0149 21.8256 10.95 21.7485 10.8469C21.3365 10.2978 20.821 9.83838 20.2345 9.48296C20.0509 9.3717 19.9697 9.13887 20.0742 8.95034C21.0839 7.13719 23.9889 4.08883 25.8225 2.28289Z" fill="currentColor"/><path d="M28.7364 24.2903C30.0352 25.0516 30.6846 25.4323 30.6846 26.0033C30.6846 26.5743 30.0352 26.9549 28.7364 27.7163L24.3529 30.2857C23.0541 31.0471 22.4047 31.4277 21.9176 31.1422C21.4305 30.8567 21.4305 30.0954 21.4305 28.5727L21.4305 23.4338C21.4305 21.9111 21.4305 21.1498 21.9176 20.8643C22.4047 20.5788 23.0541 20.9595 24.3529 21.7208L28.7364 24.2903Z" fill="currentColor"/></svg>';
      }
      const bar = document.createElement('span');
      bar.className = 'ani-segment-bar';
      seg.addEventListener('click', () => {
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
          bar.animate?.([{opacity: 0.4}, {opacity: 1}], {duration: 160, easing: 'ease-out'});
      });
      bar.setAttribute('aria-hidden', 'true');
      seg.prepend(iconSpan);
      seg.append(bar);
    }
    for (const native of document.querySelectorAll('#blockVideoInSeason .btn-newanime-filter')) {
      if (native.nextElementSibling?.classList.contains('ani-sort-options')) continue;
      const group = document.createElement('div');
      group.className = 'ani-sort-options';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', '動畫排列方式');
      const choices = [
        ['更新日', '.item-newupdate'],
        ['平均人氣', '.item-famous'],
      ];
      const sync = () => {
        const text = native.querySelector('.newanime-filter-text')?.textContent || '';
        const section = native.closest('#blockVideoInSeason');
        const mode = text.includes('人氣') ? 'popularity' : 'updated';
        if (section && section.dataset.aniSortMode !== mode) section.dataset.aniSortMode = mode;
        for (const button of group.children) {
          const selected = text.includes(button.textContent);
          const value = String(selected);
          if (button.getAttribute('aria-pressed') !== value)
            button.setAttribute('aria-pressed', value);
        }
      };
      for (const [label, selector] of choices) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        const icon = document.createElement('span');
        icon.className = 'ani-sort-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = selector === '.item-newupdate'
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M7.5 3v4m9-4v4M4 11h16m-12 4h2m4 0h2"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3c1 4-3 5-2 8-2-1-3-2-3-4-2 3-4 5-4 8a8 8 0 0 0 16 0c0-5-4-10-7-12Z"/><path d="M10 16c-1 1-1 2-1 3a3 3 0 0 0 6 0c0-2-1-3-2-4 0 2-1 3-3 1Z"/></svg>';
        button.prepend(icon);
        button.addEventListener('click', () => {
          const grid=native.closest('#blockVideoInSeason')?.querySelector('.newanime-block');
          const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
          if(grid&&!reduced){grid.style.transition='opacity 120ms ease-out';grid.style.opacity='0.25';}
          native.querySelector(selector)?.click();
          sync();
          if(grid&&!reduced){
            requestAnimationFrame(()=>requestAnimationFrame(()=>{grid.style.transition='opacity 260ms ease-out';grid.style.opacity='1';}));
          }
        });
        group.append(button);
      }
      native.after(group);
      sync();
      new MutationObserver(sync).observe(native, { childList: true, subtree: true, characterData: true });
    }
    for (const row of document.querySelectorAll(
      '#sub_list .sub-list-li:not([data-ani-keyboard-row])',
    )) {
      row.dataset.aniKeyboardRow = 'true';
      row.tabIndex = 0;
      for (const btn of row.querySelectorAll('.edit:not([data-ani-iconified])')) {
        btn.dataset.aniIconified = 'true';
        const label = btn.textContent.trim();
        const icon = /複製/.test(label)
          ? '<svg viewBox="0 0 448 512" fill="currentColor" aria-hidden="true"><path d="M208 0L332.1 0c12.7 0 24.9 5.1 33.9 14.1l67.9 67.9c9 9 14.1 21.2 14.1 33.9L448 336c0 26.5-21.5 48-48 48l-192 0c-26.5 0-48-21.5-48-48l0-288c0-26.5 21.5-48 48-48zM48 128l80 0 0 64-64 0 0 256 192 0 0-32 64 0 0 48c0 26.5-21.5 48-48 48L48 512c-26.5 0-48-21.5-48-48L0 176c0-26.5 21.5-48 48-48z"/></svg>'
          : /消音|靜音/.test(label)
          ? '<svg viewBox="0 0 576 512" fill="currentColor" aria-hidden="true"><path d="M301.1 34.8C312.6 40 320 51.4 320 64l0 384c0 12.6-7.4 24-18.9 29.2s-25 3.1-34.4-5.3L131.8 352 64 352c-35.3 0-64-28.7-64-64l0-64c0-35.3 28.7-64 64-64l67.8 0L266.7 40.1c9.4-8.4 22.9-10.4 34.4-5.3zM425 167l55 55 55-55c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-55 55 55 55c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-55-55-55 55c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l55-55-55-55c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0z"/></svg>'
          : /檢舉/.test(label)
          ? '<svg viewBox="0 0 448 512" fill="currentColor" aria-hidden="true"><path d="M64 32C64 14.3 49.7 0 32 0S0 14.3 0 32L0 64 0 368 0 480c0 17.7 14.3 32 32 32s32-14.3 32-32l0-128 64.3-16.1c41.1-10.3 84.6-5.5 122.5 13.4c44.2 22.1 95.5 24.8 141.7 7.4l34.7-13c12.5-4.7 20.8-16.6 20.8-30l0-247.7c0-23-24.2-38-44.8-27.7l-9.6 4.8c-46.3 23.2-100.8 23.2-147.1 0c-35.1-17.6-75.4-22-113.5-12.5L64 48l0-16z"/></svg>'
          : null;
        if (!icon) continue;
        btn.classList.add('ani-danmu-action-icon');
        btn.setAttribute('aria-label', label);
        btn.title = label;
        btn.innerHTML = icon;
        for (const svgEl of btn.querySelectorAll('svg, svg *')) {
          svgEl.style.setProperty('pointer-events', 'none', 'important');
        }
        if (/複製/.test(label)) btn.addEventListener('click', () => showAniToast('已複製彈幕內容'));
      }
    }
    for (const reloadBtn of document.querySelectorAll('.subtitle :is(button, a, [role="button"], .reload, .danmu-reload, .sub-reload):not([data-ani-reload-icon], .ani-dm-refresh-btn)')) {
      const txt = reloadBtn.textContent.trim();
      const cls = reloadBtn.className || '';
      if (!/^(?:refresh|autorenew|sync|重整|重新整理)$/i.test(txt) && !/reload|refresh/i.test(cls) && !/reload|refresh/i.test(reloadBtn.getAttribute('onclick') || '')) continue;
      reloadBtn.dataset.aniReloadIcon = 'true';
      reloadBtn.classList.add('ani-danmu-reload-pill');
      reloadBtn.setAttribute('aria-label', '重新整理彈幕');
      reloadBtn.title = '重新整理彈幕';
      reloadBtn.innerHTML = '<svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><path d="M105.1 202.6c7.7-21.8 20.2-42.3 37.8-59.8c62.5-62.5 163.8-62.5 226.3 0L386.3 160 352 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l111.5 0c0 0 0 0 0 0l.4 0c17.7 0 32-14.3 32-32l0-112c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 35.2L414.4 97.6c-87.5-87.5-229.3-87.5-316.8 0C73.2 122 55.6 150.7 44.8 181.4c-5.9 16.7 2.9 34.9 19.5 40.8s34.9-2.9 40.8-19.5zM39 289.3c-5 1.5-9.8 4.2-13.7 8.2c-4 4-6.7 8.8-8.1 14c-.3 1.2-.6 2.5-.8 3.8c-.3 1.7-.4 3.4-.4 5.1L16 432c0 17.7 14.3 32 32 32s32-14.3 32-32l0-35.1 17.6 17.5c0 0 0 0 0 0c87.5 87.4 229.3 87.4 316.7 0c24.4-24.4 42.1-53.1 52.9-83.8c5.9-16.7-2.9-34.9-19.5-40.8s-34.9 2.9-40.8 19.5c-7.7 21.8-20.2 42.3-37.8 59.8c-62.5 62.5-163.8 62.5-226.3 0l-.1-.1L125.6 352l34.4 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L48.4 288c-1.6 0-3.2 .1-4.8 .3s-3.1 .5-4.6 1z"/></svg>';
    }
    // Redesign 3.0 Right Panel (彈幕列表 | 作品簡介 | 作品評分) + Settings & 動畫瘋·Plus drawers below title
    for (const tabContent of document.querySelectorAll('.subtitle .ani-tab-content')) {
      if (tabContent.dataset.aniTabsReady) continue;
      const tabs = tabContent.parentElement?.querySelector('.ani-tabs');
      if (!tabs) continue;

      const danmuTab = tabs.querySelector('.ani-tabs-link[href="#ani-tab-content-1"]');
      const settingsPanelNative = document.getElementById('ani-tab-content-2');

      // 1. Unified Settings Drawer (merges #ani-tab-content-2 + 動畫瘋·Plus into ONE coherent Bento drawer)
      let drawer = document.querySelector('.ani-player-settings-drawer');
      if (!drawer) {
        const animeTitle = document.querySelector('#BH_background .container-player > .anime-title');
        if (animeTitle) {
          drawer = document.createElement('section');
          drawer.className = 'ani-player-settings-drawer';
          const bar = document.createElement('div');
          bar.className = 'ani-drawer-toggles';
          const bodyWrap = document.createElement('div');
          bodyWrap.className = 'ani-player-settings-body';
          bodyWrap.setAttribute('aria-hidden', 'true');
          const animInner = document.createElement('div');
          animInner.className = 'ani-settings-anim-inner';
          const unifiedGrid = document.createElement('div');
          unifiedGrid.className = 'ani-unified-settings-grid';
          animInner.append(unifiedGrid);
          bodyWrap.append(animInner);
          drawer.append(bar, bodyWrap);
          animeTitle.after(drawer);
        }
      }
      const syncToolbarHost = () => {
        if (!drawer) return;
        const bar = drawer.querySelector('.ani-drawer-toggles');
        const plusBox = document.querySelector('#BH_background .plus_imagetool_box');
        if (bar && plusBox) {
          for (const toggleBtn of [...bar.querySelectorAll('.ani-player-settings-toggle')]) {
            toggleBtn.classList.add('ani-in-toolbar');
            plusBox.append(toggleBtn);
          }
          drawer.classList.add('has-toolbar-host');
        }
      };

      const unifiedGridEl = drawer?.querySelector('.ani-unified-settings-grid');
      let decoratingGrid = false;
      const decorateSettingsPanel = (panelEl) => {
        if (!panelEl) return;
        decoratingGrid = true;
        try {
        const formatLabel = [...panelEl.querySelectorAll('.ani-setting-label__mian')]
          .find(label => label.textContent.trim() === '彈幕格式修改');
        const formatHeader = formatLabel?.closest('.ani-setting-item');
        const formatComponent = formatHeader?.parentElement;
        const danmuSection = unifiedGridEl?.querySelector('#ani-tab-content-2 .ani-setting-section:has(#danmu-show)');
        if (formatComponent && danmuSection && !formatComponent.classList.contains('ani-plus-native-format')) {
          const gear = [...formatHeader.querySelectorAll('.plus_describe.material-icons-outlined')]
            .find(icon => icon.textContent.trim() === 'settings');
          if (gear) {
            formatComponent.classList.add('ani-plus-native-format', 'ani-plus-format-moved');
            danmuSection.append(formatComponent);
            gear.click();
            formatComponent.addEventListener('change', event => {
              const enable = formatHeader.querySelector('input[type="checkbox"]');
              if (enable && !enable.checked && event.target.matches('select, input[type="range"]')) enable.click();
            });
          }
        }
        const thinInfoSvg = '<svg class="ani-info-i-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><circle cx="12" cy="8.2" r="0.6" fill="currentColor" stroke="none"/></svg>';
        // Remove any section-level title icons so both column headers (彈幕設定 & 動畫瘋・Plus) are clean & uniform in size
        for (const oldSecIc of panelEl.querySelectorAll('.ani-sec-icon')) oldSecIc.remove();
        for (const hdr of panelEl.querySelectorAll('.ani-setting-section > h4, .ani-setting-section > .title, .plus_menu_title')) {
          for (const ic of hdr.querySelectorAll('svg:not(.ani-info-i-icon), img, i, .ani-row-icon')) {
            if (!ic.closest('.ani-plus-info-trigger, .ani-info-badge-host')) ic.remove();
          }
        }
        // Replace ? / ! help triggers ONLY (never overwrite tooltip popup text!) using non-destructive sibling insertion
        const isActualTooltipPopup = (node) => {
          const tipBox = node?.closest?.('[role="tooltip"], .tooltip, [class*="tooltip-content" i], [class*="tooltip-body" i], [class*="popper" i], [class*="popover" i]');
          if (!tipBox) return false;
          if (tipBox.matches('[role="tooltip"]')) return true;
          const txtLen = (tipBox.textContent || '').replace(/\s+/g, ' ').trim().length;
          return txtLen > 6;
        };
        const markHiddenQuestionGlyphs = (scope) => {
          const inTriggerScope = Boolean(scope?.matches?.('.ani-plus-info-trigger, .qa-icon'));
          for (const g of scope.querySelectorAll('svg:not(.ani-info-i-icon):not(.ani-row-icon svg):not(.ani-plus-gear-svg):not(.ani-plus-tune-svg):not(.ani-plus-refresh-svg):not(.ani-plus-add-svg):not(.ani-plus-action-svg), i, img')) {
            if (g.closest('.ani-row-icon') || isActualTooltipPopup(g)) continue;
            if (inTriggerScope || g.closest('.ani-plus-info-trigger, .qa-icon') || /question|help|alert|info|exclamation|<circle\b/i.test(`${g.innerHTML || ''} ${g.className?.baseVal || g.className || ''}`)) {
              g.classList.add('ani-hidden-glyph');
            }
          }
          for (const leaf of scope.querySelectorAll('span, div, b, small')) {
            if (leaf.closest('.ani-info-badge-host, .ani-row-icon') || isActualTooltipPopup(leaf)) continue;
            if (leaf.childElementCount === 0 && /^(?:[?!？！!]+|help(?:_outline)?|info(?:_outline)?|error(?:_outline)?|warning|question_mark|contact_support|live_help)$/i.test((leaf.textContent || '').trim())) {
              leaf.classList.add('ani-hidden-glyph');
            }
          }
          for (const tn of [...scope.childNodes]) {
            if (tn.nodeType === 3 && /^[?!？！\s]+$/.test(tn.nodeValue || '') && tn.nodeValue.trim()) {
              const s = document.createElement('span');
              s.className = 'ani-hidden-glyph';
              s.textContent = tn.nodeValue;
              tn.replaceWith(s);
            }
          }
        };
        const attachInfoIcon = (host) => {
          if (!host) return;
          if (host.matches('svg, img, input, select, textarea, .ani-hidden-glyph, .ani-plus-info-trigger, .ani-info-badge-host')) return;
          if (host.closest('.ani-hidden-glyph, .ani-plus-info-trigger, .ani-info-badge-host, .tooltip, [role="tooltip"], [class*="tooltip" i], [class*="popper" i], [class*="popover" i]')) return;
          markHiddenQuestionGlyphs(host);
          if (host.dataset.aniInfoDone === '1' || host.querySelector('.ani-info-i-icon')) return;
          host.dataset.aniInfoDone = '1';
          const badge = document.createElement('span');
          badge.className = 'ani-info-badge-host ani-plus-info-badge';
          badge.setAttribute('aria-hidden', 'true');
          badge.innerHTML = thinInfoSvg;
          host.prepend(badge);
          host.classList.add('ani-plus-info-trigger');
        };
        for (const existingTrigger of panelEl.querySelectorAll('.ani-plus-info-trigger, .qa-icon')) {
          markHiddenQuestionGlyphs(existingTrigger);
          if (existingTrigger.matches('.qa-icon') && !existingTrigger.querySelector('.ani-info-i-icon')) {
            existingTrigger.innerHTML = thinInfoSvg;
            existingTrigger.classList.add('ani-info-badge-host');
          }
        }
        for (const tipHost of panelEl.querySelectorAll('[tip-content], [data-tooltip], [title], [class*="question" i], [class*="help" i]')) {
          if (tipHost.matches('.ani-plus-info-trigger, .ani-hidden-glyph, .ani-info-badge-host, .ani-info-i-icon, svg, img, input, button, select, textarea')) continue;
          if (tipHost.closest('.ani-hidden-glyph, .ani-plus-info-trigger, .ani-info-badge-host, .tooltip, [role="tooltip"], [class*="tooltip" i], [class*="popper" i], [class*="popover" i]')) continue;
          const ownText = [...tipHost.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue || '').join('').trim();
          if (ownText.length > 6 && !/^[?!？！]+$/.test(ownText)) continue;
          if (!tipHost.querySelector('svg, i, span') && !/^[?!？！]+$/.test(ownText)) continue;
          attachInfoIcon(tipHost);
        }
        // Catch standalone leaf ?/！ triggers (even without [tip-content]/[title], e.g. Vue hover listeners on span/div/button)
        for (const leafTxtEl of panelEl.querySelectorAll('span, i, div, a, b, small')) {
          if (leafTxtEl.closest('.ani-hidden-glyph, .ani-plus-info-trigger, .ani-info-badge-host, .tooltip, [role="tooltip"], [class*="tooltip" i], [class*="popper" i], [class*="popover" i], button, input, select, textarea')) continue;
          if (leafTxtEl.childElementCount > 0) continue;
          const lt = (leafTxtEl.textContent || '').trim();
          if (/^(?:[?!？！]|help(?:_outline)?|info(?:_outline)?|error(?:_outline)?|warning|question_mark|contact_support|live_help)$/i.test(lt)) {
            attachInfoIcon(leafTxtEl);
          }
        }
        for (const iconSvg of panelEl.querySelectorAll('svg:not(.ani-sec-icon svg):not(.ani-info-i-icon):not(.ani-row-icon svg):not(.ani-plus-refresh-svg):not(.ani-plus-add-svg):not(.ani-plus-gear-svg):not(.ani-plus-action-svg), :is(i, span).material-icons, :is(i, span)[class*="material" i]')) {
          if (iconSvg.closest('.ani-sec-icon, .ani-row-icon, .ani-info-badge-host, .ani-hidden-glyph, .ani-danmu-position-btn, .ani-plus-pill-btn, .ani-plus-refresh-btn, .ani-plus-add-icon-btn, .ani-plus-gear-btn, .ani-plus-icon-action, .tooltip, [role="tooltip"], [class*="tooltip" i]')) continue;
          if (iconSvg.closest('.ani-plus-info-trigger, .qa-icon')) {
            iconSvg.classList.add('ani-hidden-glyph');
            continue;
          }
          if (iconSvg.tagName !== 'SVG') {
            const matTxt = (iconSvg.textContent || '').trim();
            if (/^(?:help|help_outline|info|info_outline|error|error_outline|warning|question_mark|contact_support|live_help)$/i.test(matTxt) && iconSvg.parentElement && !iconSvg.parentElement.querySelector('.ani-info-i-icon')) {
              attachInfoIcon(iconSvg);
              continue;
            }
          }
          const rect = iconSvg.getBoundingClientRect();
          if (rect.width > 24 || rect.height > 24) continue;
          const pathTxt = iconSvg.innerHTML || '';
          const metaTxt = `${pathTxt} ${iconSvg.className?.baseVal || ''} ${iconSvg.getAttribute('aria-label') || ''} ${iconSvg.parentElement?.className || ''}`;
          const isGearOrAction = /M19\.14|15\.18|19\.4|14\.7|12 15\.5|gear|cog|wrench|tool|refresh|reset|clear|trash|play|M12 5v14|M5 12h14/i.test(metaTxt) || Boolean(iconSvg.closest('button, a, .ani-plus-add-icon-btn, .ani-plus-icon-action'));
          const isWaveformOrChart = /polyline|points=|arrow|M2 12|M3 12h4l3-9|chart|wave|analytics|timeline|show_chart/i.test(metaTxt);
          const nearInfoTrigger = Boolean(
            iconSvg.parentElement?.querySelector('.ani-info-i-icon, .ani-plus-info-trigger') ||
            iconSvg.previousElementSibling?.matches?.('.ani-info-i-icon, .ani-plus-info-trigger') ||
            iconSvg.nextElementSibling?.matches?.('.ani-info-i-icon, .ani-plus-info-trigger')
          );
          const isHelpOrWarnSvg = !isGearOrAction && !isWaveformOrChart && (
            nearInfoTrigger ||
            /(?:M11,18h2v-2h-2|M11 18h2v-2h-2|M12 17|M12 16|M12 14|M9\.09|M9 9|a3 3|5\.83|M12 8v4|M12 9v4|M256 512|question|help|warning|exclamation|alert|info|<text[^>]*>\s*[?!])/i.test(metaTxt)
            || Boolean(panelEl.closest('.ani-drawer-slot-extra') && /<circle\b/i.test(pathTxt) && !/15\.5|r="3"/.test(pathTxt))
          );
          if (isHelpOrWarnSvg && iconSvg.parentElement && !/BETA|PLUS/i.test(iconSvg.parentElement.textContent || '')) {
            if (nearInfoTrigger) {
              iconSvg.classList.add('ani-hidden-glyph');
              continue;
            }
            if (iconSvg.parentElement.querySelector('.ani-info-i-icon')) {
              iconSvg.classList.add('ani-hidden-glyph');
              continue;
            }
            const host = (iconSvg.parentElement.children.length === 1 && !(iconSvg.parentElement.textContent || '').trim()) ? iconSvg.parentElement : iconSvg;
            if (host === iconSvg) {
              iconSvg.classList.add('ani-hidden-glyph');
              const trig = document.createElement('span');
              trig.className = 'ani-plus-info-trigger ani-info-badge-host ani-plus-info-badge';
              trig.innerHTML = thinInfoSvg;
              iconSvg.insertAdjacentElement('afterend', trig);
            } else {
              attachInfoIcon(host);
            }
            continue;
          }
          // On 跳過片頭曲 row, hide duplicate right-side waveform/chart icon since title now has front icon
          const rowTxt = (iconSvg.closest('div, li, .plus_row')?.textContent || '');
          if (isWaveformOrChart && /跳過片頭曲/.test(rowTxt) && !iconSvg.closest('button')) {
            iconSvg.classList.add('ani-hidden-glyph');
            continue;
          }
          iconSvg.classList.add('ani-mono-icon');
        }
        // Group 截圖錄影 加入彈幕 / Logo / 資訊 BEFORE adding row icons/reordering so titles stay clean
        if (panelEl.closest('.ani-drawer-slot-extra')) {
          const findCapRow = (re) => {
            for (const cb of panelEl.querySelectorAll('input[type="checkbox"]')) {
              let cur = cb.parentElement;
              while (cur && cur !== panelEl && cur.querySelectorAll('input[type="checkbox"]').length === 1) {
                const labelTxt = [...cur.querySelectorAll('span, label, p, div')]
                  .filter((n) => n.childElementCount === 0 || n.querySelector(':scope > .ani-row-icon, :scope > .ani-plus-info-trigger'))
                  .map((n) => (n.textContent || '').trim())
                  .join(' ');
                const rowOwnTxt = (labelTxt || cur.textContent || '').trim();
                if (!/彈幕格式|軌跡|跳過|無縫|分級/.test(rowOwnTxt) && re.test(rowOwnTxt) && !cur.closest('.ani-plus-cap-row')) return cur;
                cur = cur.parentElement;
              }
            }
            return null;
          };
          const capDanmu = findCapRow(/截圖錄影.*加入彈幕|^加入彈幕/);
          const capLogo = findCapRow(/截圖錄影.*加入Logo|^加入Logo/i);
          const capInfo = findCapRow(/截圖錄影.*加入資訊|^加入資訊/);
          if (capDanmu && capLogo && capInfo && !panelEl.querySelector('.ani-plus-cap-row')) {
            const heading = document.createElement('div');
            heading.className = 'ani-plus-cap-heading';
            heading.innerHTML = '<span>截圖錄影附加項目</span>';
            const rowWrap = document.createElement('div');
            rowWrap.className = 'ani-plus-cap-row';
            capDanmu.before(heading, rowWrap);
            for (const [r, shortTxt] of [[capDanmu, '加入彈幕'], [capLogo, '加入Logo'], [capInfo, '加入資訊']]) {
              r.classList.add('ani-plus-cap-opt');
              const tw = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
              let tn;
              while ((tn = tw.nextNode())) {
                if (/截圖錄影|加入/.test(tn.nodeValue || '')) {
                  tn.nodeValue = tn.nodeValue.replace(/(?:截圖錄影|加入)\s*/g, '');
                }
              }
              if (!r.dataset.aniCapShort) {
                r.dataset.aniCapShort = shortTxt.replace(/^加入/, '');
              }
              rowWrap.append(r);
            }
            const movedTip = capDanmu.querySelector('.ani-plus-info-trigger, [tip-content], .qa-icon');
            if (movedTip) heading.append(movedTip);
          }
        }
        // Normalize real 動畫瘋·Plus row DOM BEFORE icon & status placement so titles always align flush-left (matching 圖2)
        if (panelEl.closest('.ani-drawer-slot-extra')) {
          const plusRowTitleRe = /^(?:自動同意分級警告|無縫連播下一集|跳過片頭曲|彈幕格式修改|彈幕軌跡|彈魂軌跡|彈幕熱度|截圖\s*按鍵設定|時間跳躍|過濾關鍵字)/;
          for (const cand of panelEl.querySelectorAll('span, label, div, p')) {
            if (cand.closest('.ani-plus-cap-row, .ani-plus-info-trigger, .ani-plus-pill-btn, .ani-plus-kw-chip, .ani-plus-status-pill, .ani-plus-format-subinline, .ani-plus-jump-editor-row, button')) continue;
            if (cand.matches('div') && cand.querySelector('span, label, p, input, button')) continue;
            if (cand.children.length > 3) continue;
            const rawT = (cand.textContent || '').replace(/\s+/g, ' ').trim();
            if (!plusRowTitleRe.test(rawT) || rawT.length > 26) continue;
            // Walk up to the actual full row container holding both title and right control (without crossing into another row)
            let pr = cand.parentElement;
            if (!pr || pr.closest('.ani-plus-cap-row, .plus_menu_title, .ani-plus-format-subinline')) continue;
            while (
              pr.parentElement &&
              !pr.parentElement.matches('.plus_menu_root, .ani-drawer-slot-extra, .ani-plus-format-moved, .ani-drawer-slot') &&
              pr.parentElement.children.length <= 5 &&
              (!pr.querySelector('input, button, select, [role="button"], .ani-plus-gear-btn') || pr.children.length === 1)
            ) {
              const upTitleHits = [...pr.parentElement.querySelectorAll('span, label, div, p')].filter((n) => {
                if (n === cand || n.contains(cand) || cand.contains(n) || n.children.length > 3) return false;
                const nt = (n.textContent || '').replace(/\s+/g, ' ').trim();
                return nt.length <= 26 && plusRowTitleRe.test(nt);
              });
              if (upTitleHits.length > 0) break;
              pr = pr.parentElement;
            }
            if (pr.matches('.plus_menu_root, .ani-drawer-slot-extra, .ani-plus-format-moved, .ani-drawer-slot')) continue;
            pr.classList.add('ani-plus-form-row');
            let titleEl = (cand.parentElement === pr) ? cand : [...pr.children].find((c) => c.contains(cand));
            if (titleEl && !titleEl.matches('input, button')) {
              // If titleEl wraps [cand, trig] together cleanly inside pr, prefer cand itself as titleEl when cand is element
              if (titleEl !== cand && cand.matches('span, label, p, div') && titleEl.querySelector('.ani-plus-info-trigger, .qa-icon, [tip-content]')) {
                const movedTrig = titleEl.querySelector('.ani-plus-info-trigger, .qa-icon');
                titleEl.classList.remove('ani-plus-row-title');
                cand.classList.add('ani-plus-row-title');
                pr.prepend(cand);
                if (movedTrig) cand.after(movedTrig);
                if (titleEl.childElementCount === 0 && !(titleEl.textContent || '').trim()) titleEl.remove();
                titleEl = cand;
              } else {
                titleEl.classList.add('ani-plus-row-title');
                if (pr.firstElementChild !== titleEl) pr.prepend(titleEl);
              }
              const trig = pr.querySelector(':scope > .ani-plus-info-trigger, :scope > .qa-icon, .ani-plus-info-trigger, .qa-icon');
              if (trig && !titleEl.contains(trig) && trig.previousElementSibling !== titleEl) {
                titleEl.after(trig);
              }
              if (/時間跳躍|過濾關鍵字/.test(rawT)) pr.classList.add('ani-plus-group-top');
            }
          }
          // Fallback for any compact row not matched by known Plus labels (skip [label + x-delete] keyword chips)
          for (const pr of panelEl.querySelectorAll('div')) {
            if (pr.closest('#plus_dan_keywords, .plus-toast-wrapper')) continue;
            if (pr.closest('.ani-plus-cap-row, .ani-plus-info-trigger, .ani-plus-form-row, .ani-plus-kw-list, .ani-plus-kw-chip, .ani-plus-format-subinline, .ani-plus-jump-editor-row') || pr.classList.contains('ani-plus-form-row')) continue;
            if (pr.children.length >= 2 && pr.children.length <= 5) {
              const first = pr.firstElementChild;
              if (first && first.tagName === 'SPAN' && !first.querySelector('input, button')) {
                const ctrl = [...pr.children].slice(1).find((c) => c.matches('input[type="checkbox"], button, div'));
                const isKwChipLike = ctrl && (ctrl.tagName === 'BUTTON' || ctrl.tagName === 'SVG' || ctrl.tagName === 'svg') && !pr.querySelector('input') && (/^(?:[×✕✖x])?$/i.test((ctrl.textContent || '').trim()) || /M18 6|M19 6\.41|close|del/i.test(ctrl.innerHTML || ''));
                if ((ctrl || pr.querySelector(':scope > input[type="checkbox"]')) && !isKwChipLike) {
                  pr.classList.add('ani-plus-form-row');
                  first.classList.add('ani-plus-row-title');
                  if (/時間跳躍|過濾關鍵字/.test((first.textContent || '').trim())) pr.classList.add('ani-plus-group-top');
                }
              }
            }
          }
          // Keep (i) info trigger immediately after each row/header title & hide any remaining ?/! glyphs beside (i)
          for (const row of panelEl.querySelectorAll('.ani-plus-form-row, .plus_menu_title, .ani-plus-cap-heading')) {
            const titleEl = row.matches('.plus_menu_title') ? row : (row.querySelector(':scope > .ani-plus-row-title') || row.firstElementChild);
            const trig = row.querySelector('.ani-plus-info-trigger, .qa-icon');
            if (titleEl && trig) {
              if (row.matches('.plus_menu_title')) {
                const textAnchor = [...row.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim());
                if (textAnchor && trig.previousSibling !== textAnchor) {
                  row.insertBefore(trig, textAnchor.nextSibling);
                }
              } else if (!titleEl.contains(trig) && trig.previousElementSibling !== titleEl) {
                titleEl.after(trig);
              }
            }
            if (row.querySelector('.ani-info-i-icon')) {
              markHiddenQuestionGlyphs(row);
              for (const remSvg of row.querySelectorAll('svg:not(.ani-info-i-icon):not(.ani-row-icon svg):not(.ani-plus-gear-svg):not(.ani-plus-tune-svg):not(.ani-plus-refresh-svg):not(.ani-plus-add-svg):not(.ani-plus-action-svg)')) {
                if (remSvg.closest('.ani-row-icon, .ani-plus-gear-btn, .ani-plus-icon-action, .ani-plus-add-icon-btn, button, a') || isActualTooltipPopup(remSvg)) continue;
                const sr = remSvg.getBoundingClientRect();
                if (sr.width > 24 || sr.height > 24) continue;
                if (remSvg.closest('.ani-plus-info-trigger, .qa-icon, [tip-content], [title]') || /question|help|alert|exclamation|info|<circle\b/i.test(`${remSvg.innerHTML || ''} ${remSvg.className?.baseVal || ''}`)) {
                  remSvg.classList.add('ani-hidden-glyph');
                }
              }
            }
          }
        }
        // Left & Right column row icons in FRONT of every setting title
        const uniqueRowIcons = [
          ['弹幕開關|彈幕開關', 'danmu-on', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 10h6M7 14h10"/></svg>'],
          ['自動過濾', 'auto-filter', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5L3 5Z"/></svg>'],
          ['彈幕來源顯示', 'source-region', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>'],
          ['彈幕不透明度', 'opacity', '<svg data-ani-fa="true" viewBox="0 0 512 512" fill="currentColor" stroke="none"><path d="M448 256c0-106-86-192-192-192l0 384c106 0 192-86 192-192zM0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256z"/></svg>'],
          ['彈幕字體大小', 'font-size', '<svg data-ani-fa="true" viewBox="0 0 576 512" fill="currentColor" stroke="none"><path d="M64 128l0-32 64 0 0 320-32 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l128 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-32 0 0-320 64 0 0 32c0 17.7 14.3 32 32 32s32-14.3 32-32l0-48c0-26.5-21.5-48-48-48L160 32 48 32C21.5 32 0 53.5 0 80l0 48c0 17.7 14.3 32 32 32s32-14.3 32-32zM502.6 41.4c-12.5-12.5-32.8-12.5-45.3 0l-64 64c-9.2 9.2-11.9 22.9-6.9 34.9s16.6 19.8 29.6 19.8l32 0 0 192-32 0c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l64 64c12.5 12.5 32.8 12.5 45.3 0l64-64c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8l-32 0 0-192 32 0c12.9 0 24.6-7.8 29.6-19.8s2.2-25.7-6.9-34.9l-64-64z"/></svg>'],
          ['彈幕類型開關', 'danmu-type', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M6 9h1m3 0h8M6 15h1m3 0h8"/></svg>'],
          ['自動同意分級警告', 'age-skip', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v6c0 4.5 3 8.2 7 9.5 4-1.3 7-5 7-9.5V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>'],
          ['無縫連播下一集', 'auto-next', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 5 15 12 5 19 5 5"/><line x1="19" y1="5" x2="19" y2="19"/></svg>'],
          ['跳過片頭曲', 'skip-op', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><polygon points="4 6 12 12 4 18 4 6"/><polygon points="13 6 21 12 13 18 13 6"/></svg>'],
          ['(?:彈幕格式修改|格式)$', 'dm-format', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="17" x2="12" y2="17"/></svg>'],
          ['彈幕軌跡|彈魂軌跡|彈幕熱度', 'dm-track', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 12 7 12 10 6 14 18 17 12 21 12"/></svg>'],
          ['截圖錄影附加項目', 'cap-extra', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/></svg>'],
          ['截圖\\s*按鍵設定|按鍵設定', 'cap-key', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h2M11 10h2M15 10h2M8 14h8"/></svg>'],
          ['時間跳躍', 'time-jump', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'],
          ['過濾關鍵字', 'kw-filter', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="6.5" y1="17.5" x2="17.5" y2="6.5"/></svg>'],
        ];
        for (const [pat, key, svgHtml] of uniqueRowIcons) {
          const re = new RegExp(`^${pat}`);
          const iconRoot = key === 'dm-format' && danmuSection ? unifiedGridEl : panelEl;
          for (const lbl of iconRoot.querySelectorAll('.ani-setting-label__mian, .ani-setting-label, .ani-plus-cap-heading > span:first-child, .ani-plus-row-title, .plus_row > span, div > span, div > label')) {
            if (lbl.closest('.ani-sec-icon, .ani-info-badge-host, .ani-plus-info-trigger, .ani-danmu-position-btn, .ani-plus-pill-btn, .ani-plus-cap-row, .ani-plus-format-subinline, .ani-plus-jump-editor-row, .ani-dup-hidden, .ani-setting-section > h4, .ani-setting-section > .title, .plus_menu_title, button, input, select')) continue;
            if (lbl.querySelector('.ani-row-icon')) continue;
            const ownerRow = lbl.closest('.ani-plus-form-row, .ani-setting-item, .ani-plus-cap-heading, .plus_row');
            if (ownerRow?.matches('.ani-plus-form-row') && ownerRow.querySelector(':scope > .ani-plus-row-title') && !lbl.classList.contains('ani-plus-row-title')) continue;
            if (ownerRow?.querySelector(`.ani-row-icon[data-ani-row-key="${key}"]`)) continue;
            if (!lbl.classList.contains('ani-plus-row-title') && lbl.children.length > 3) continue;
            const txt = (lbl.textContent || '').replace(/\s+/g, ' ').trim();
            if (re.test(txt)) {
              if (key === 'dm-track') {
                for (const node of lbl.childNodes) {
                  if (node.nodeType === Node.TEXT_NODE) {
                    node.textContent = node.textContent.replace(/彈魂軌跡|彈幕軌跡/, '彈幕熱度');
                  }
                }
              }
              const ic = document.createElement('span');
              ic.className = 'ani-row-icon';
              ic.dataset.aniRowKey = key;
              ic.setAttribute('aria-hidden', 'true');
              ic.innerHTML = svgHtml;
              lbl.prepend(ic);
            }
          }
        }
        // Strict invariant on 動畫瘋·Plus rows: ONE .ani-row-icon strictly inside :scope > .ani-plus-row-title (far left), hide stray decorative SVGs
        if (panelEl.closest('.ani-drawer-slot-extra')) {
          for (const fRow of panelEl.querySelectorAll('.ani-plus-form-row')) {
            const titleEl = fRow.querySelector(':scope > .ani-plus-row-title') || fRow.querySelector('.ani-plus-row-title');
            if (titleEl?.querySelector('[data-ani-row-key="dm-track"]')) {
              const toggle = fRow.querySelector('input[type="checkbox"]:not([data-ani-plus-danmu-heat])');
              if (toggle) {
                toggle.setAttribute('data-ani-plus-danmu-heat', '');
                syncDanmuHeat();
              }
            }
            if (titleEl) {
              const firstIc = fRow.querySelector('.ani-row-icon');
              if (firstIc) {
                for (const extraIc of fRow.querySelectorAll('.ani-row-icon')) {
                  if (extraIc !== firstIc) extraIc.remove();
                }
                if (firstIc.parentElement !== titleEl || titleEl.firstElementChild !== firstIc) {
                  titleEl.prepend(firstIc);
                }
              }
              if (titleEl.parentElement === fRow && fRow.firstElementChild !== titleEl) {
                fRow.prepend(titleEl);
              }
            }
            if (!fRow.querySelector('.ani-row-icon')) continue;
            for (const gSvg of fRow.querySelectorAll('svg:not(.ani-row-icon svg):not(.ani-info-i-icon):not(.ani-plus-gear-svg):not(.ani-plus-tune-svg):not(.ani-plus-refresh-svg):not(.ani-plus-add-svg):not(.ani-plus-action-svg)')) {
              if (gSvg.closest('button, a, .ani-plus-gear-btn, .ani-plus-icon-action, .ani-plus-add-icon-btn, .ani-info-badge-host, .tooltip, [role="tooltip"]')) continue;
              gSvg.classList.add('ani-hidden-glyph');
            }
          }
        }
        // Single-leaf status pill (centered strictly in the open space between 跳過片頭曲 (i) on left and [toggle] on right)
        for (const el of panelEl.querySelectorAll('div, p, span')) {
          if (el.closest('.ani-plus-cap-row, .tooltip, [role="tooltip"]')) continue;
          const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (/^(?:正在初始化\.\.\.|正在分析音訊中\.\.\.|相關段落分析完成|音訊分析完成.*)$/.test(t) && el.childElementCount === 0) {
            if (!el.classList.contains('ani-plus-status-pill')) el.classList.add('ani-plus-status-pill');
            if (/完成/.test(t)) el.classList.add('is-done');
            const skipRow = [...panelEl.querySelectorAll('.ani-plus-form-row')].find((r) => /跳過片頭曲/.test(r.textContent || ''));
            if (skipRow) {
              const anchor = skipRow.querySelector(':scope > .ani-plus-info-trigger, :scope > .qa-icon') || skipRow.querySelector(':scope > .ani-plus-row-title') || skipRow.firstElementChild;
              if (anchor && el.previousElementSibling !== anchor) anchor.after(el);
            }
          }
          if (/^空降足跡/.test(t) && !/時間跳躍|動畫瘋·Plus/.test(t) && el.querySelector('button') && !el.closest('.ani-dup-hidden')) {
            el.classList.add('ani-dup-hidden');
          }
        }
        // Clean horizontal sliders icon (replaces jagged cog teeth on 時間跳躍 — including non-<button> SVGs!) & auto-open/move 彈幕格式修改 directly into 彈幕設定
        const tuneInnerSvg = '<line x1="21" y1="6" x2="14" y2="6"/><line x1="10" y1="6" x2="3" y2="6"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="21" y1="18" x2="16" y2="18"/><line x1="12" y1="18" x2="3" y2="18"/><circle cx="12" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="14" cy="18" r="2"/>';
        const gearSvgMarkup = `<svg class="ani-plus-gear-svg ani-plus-tune-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${tuneInnerSvg}</svg>`;
        const normalizeFormatSub = (formatSub) => {
          if (!formatSub) return;
          formatSub.classList.add('ani-plus-format-subinline');
          formatSub.hidden = false;
          formatSub.style.removeProperty('display');
          for (const d of [formatSub, ...formatSub.querySelectorAll('div')]) {
            if (d.querySelectorAll('select, input[type="range"]').length >= 2) {
              d.classList.add('ani-plus-format-stack');
            }
          }
          for (const opt of formatSub.querySelectorAll('div, fieldset, label')) {
            if (opt.closest('.ani-plus-format-opt-row')) continue;
            if (opt.children.length === 1 && opt.firstElementChild.tagName === 'DIV') continue;
            const ctrls = opt.querySelectorAll('select, input[type="range"]');
            if (ctrls.length !== 1) continue;
            if (/字體修改|陰影深度|外框距離/.test(opt.textContent || '') && !opt.querySelector('.ani-plus-format-opt-row')) {
              opt.classList.add('ani-plus-format-opt-row');
              const ctrl = ctrls[0];
              if (ctrl.type === 'range' && opt.children.length >= 3 && !opt.querySelector('.ani-plus-format-ctrl')) {
                const ctrlKids = [...opt.children].filter((c) => c === ctrl || c.contains(ctrl) || (/^\d+(?:\.\d+)?%?$/.test((c.textContent || '').trim()) && c.childElementCount === 0));
                if (ctrlKids.length >= 2) {
                  const wrap = document.createElement('span');
                  wrap.className = 'ani-plus-format-ctrl';
                  ctrlKids[0].before(wrap);
                  for (const ck of ctrlKids) wrap.append(ck);
                }
              }
            }
          }
          for (const fmtRange of formatSub.querySelectorAll('input[type="range"]')) {
            const syncFmtRange = () => {
              const min = Number(fmtRange.min || 0);
              const max = Number(fmtRange.max || 100);
              const val = Number(fmtRange.value || 0);
              const pct = max > min ? Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100)) : 0;
              fmtRange.style.setProperty('--ani-range-pct', `${pct.toFixed(1)}%`);
            };
            if (!fmtRange.dataset.aniRangeBound) {
              fmtRange.dataset.aniRangeBound = 'true';
              fmtRange.addEventListener('input', syncFmtRange);
              fmtRange.addEventListener('change', syncFmtRange);
              new MutationObserver(syncFmtRange).observe(fmtRange, { attributes: true, attributeFilter: ['value', 'min', 'max'] });
            }
            syncFmtRange();
          }
        };
        if (panelEl.closest('.ani-drawer-slot-extra')) {
          for (const cand of panelEl.querySelectorAll('button, a, [role="button"], div, span, svg')) {
            if (cand.closest('.ani-plus-refresh-btn, .ani-plus-add-icon-btn, .ani-plus-icon-action, .ani-row-icon, .ani-info-badge-host, .ani-plus-info-trigger, .ani-hidden-glyph, .ani-plus-kw-chip, .ani-plus-kw-del, .ani-plus-format-subinline, .ani-plus-jump-editor-row')) continue;
            if ((cand.matches('div, span') && (cand.childElementCount > 2 || cand.querySelector('input, select')))) continue;
            const bt = (cand.textContent || '').trim();
            const isSvg = cand.tagName.toLowerCase() === 'svg';
            const meta = `${bt} ${cand.className?.baseVal || cand.className || ''} ${cand.getAttribute('aria-label') || ''} ${isSvg ? cand.innerHTML : (cand.querySelector('svg')?.innerHTML || '')}`;
            const rowCtx = (cand.closest('.ani-plus-form-row')?.textContent || '');
            const inGearRow = /時間跳躍|彈幕格式修改/.test(rowCtx) && (isSvg || Boolean(cand.querySelector('svg')));
            if (isSvg && cand.closest('.ani-plus-gear-btn')) continue;
            if (!isSvg && cand.closest('.ani-plus-gear-btn')) continue;
            const isGearBtn = cand.classList.contains('ani-plus-gear-btn')
              || (/^[⚙⚙️🔧]$/.test(bt) && cand.childElementCount === 0)
              || (/settings|cog|gear|tune/i.test(bt) && cand.childElementCount <= 1)
              || (/M19\.14|15\.18|19\.4|10\.3|12 15|17\.657|8\.93|14\.7|M12 1a3|gear|cog/i.test(meta) && (isSvg || cand.querySelector('svg')))
              || (inGearRow && !cand.matches('.ani-plus-row-title') && !cand.querySelector('input'));
            if (!isGearBtn) continue;
            let host = cand.closest('button, a, [role="button"]') || cand;
            if (isSvg && cand.parentElement && cand.parentElement.children.length <= 2 && !(cand.parentElement.textContent || '').trim() && !cand.parentElement.matches('.ani-plus-form-row, .ani-plus-row-trailing')) {
              host = cand.parentElement;
            }
            host.classList.add('ani-plus-gear-btn');
            host.setAttribute('aria-label', host.getAttribute('aria-label') || '設定');
            if (!host.querySelector('.ani-plus-tune-svg') && !host.classList.contains('ani-plus-tune-svg')) {
              if (host.tagName.toLowerCase() === 'svg') {
                host.setAttribute('viewBox', '0 0 24 24');
                host.setAttribute('fill', 'none');
                host.setAttribute('stroke', 'currentColor');
                host.setAttribute('stroke-width', '1.8');
                host.setAttribute('stroke-linecap', 'round');
                host.setAttribute('stroke-linejoin', 'round');
                host.classList.add('ani-plus-gear-svg', 'ani-plus-tune-svg');
                host.innerHTML = tuneInnerSvg;
              } else {
                const innerSvg = host.querySelector('svg');
                if (innerSvg) {
                  innerSvg.setAttribute('viewBox', '0 0 24 24');
                  innerSvg.setAttribute('fill', 'none');
                  innerSvg.setAttribute('stroke', 'currentColor');
                  innerSvg.setAttribute('stroke-width', '1.8');
                  innerSvg.setAttribute('stroke-linecap', 'round');
                  innerSvg.setAttribute('stroke-linejoin', 'round');
                  innerSvg.classList.remove('ani-hidden-glyph');
                  innerSvg.classList.add('ani-plus-gear-svg', 'ani-plus-tune-svg');
                  innerSvg.innerHTML = tuneInnerSvg;
                } else {
                  host.innerHTML = gearSvgMarkup;
                }
              }
            }
          }
          for (const fRow of panelEl.querySelectorAll('.ani-plus-form-row')) {
            const gBtn = fRow.querySelector(':scope > .ani-plus-gear-btn');
            const cb = fRow.querySelector(':scope > input[type="checkbox"]');
            if (gBtn && cb && !fRow.querySelector('.ani-plus-row-trailing')) {
              const trail = document.createElement('span');
              trail.className = 'ani-plus-row-trailing';
              cb.before(trail);
              trail.append(gBtn, cb);
            }
            let markedFirstTail = false;
            for (const c of fRow.children) {
              if (!c.matches('.ani-plus-row-title, .ani-plus-info-trigger, .qa-icon, .ani-plus-status-pill, .ani-hidden-glyph')) {
                if (!markedFirstTail) {
                  c.classList.add('ani-plus-row-tail-item');
                  c.classList.remove('ani-plus-row-tail-extra');
                  markedFirstTail = true;
                } else {
                  c.classList.add('ani-plus-row-tail-extra');
                }
              }
            }
          }
          // Auto-open & move 彈幕格式修改 (+ stacked Font / Shadow / Border inline controls) directly into left 彈幕設定 card with gear removed
          const fmtRoot = unifiedGridEl || panelEl;
          const formatRow = [...fmtRoot.querySelectorAll('.ani-plus-form-row')].find((r) => !r.closest('.ani-plus-native-format') && /彈幕格式修改/.test(r.textContent || ''));
          if (formatRow) {
            const fmtGear = formatRow.querySelector('.ani-plus-gear-btn, button, a, [role="button"], svg:not(.ani-row-icon svg):not(.ani-info-i-icon):not(.ani-hidden-glyph)');
            const findFormatSub = () => {
              let probe = formatRow.nextElementSibling;
              while (probe) {
                const pt = probe.textContent || '';
                if (probe.matches('.ani-plus-form-row') || /彈魂軌跡|彈幕軌跡|彈幕熱度|截圖錄影|時間跳躍|過濾關鍵字/.test(pt)) break;
                if (/字體修改|陰影深度|外框距離/.test(pt) && probe.querySelector('select, input[type="range"]')) return probe;
                probe = probe.nextElementSibling;
              }
              return [...fmtRoot.querySelectorAll('div')].find(
                (d) =>
                  d !== formatRow &&
                  !d.closest('.ani-plus-format-subinline') &&
                  /字體修改|陰影深度|外框距離/.test(d.textContent || '') &&
                  !/彈幕格式修改|彈魂軌跡|彈幕軌跡|彈幕熱度|時間跳躍|過濾關鍵字/.test(d.textContent || '') &&
                  Boolean(d.querySelector('select, input[type="range"]')) &&
                  d.querySelectorAll('select, input[type="range"]').length >= 2
              ) || null;
            };
            let formatSub = findFormatSub();
            const isSubClosed = !formatSub || formatSub.hidden || getComputedStyle(formatSub).display === 'none';
            if (isSubClosed && fmtGear && Number(fmtGear.dataset.aniAutoExpanded || '0') < 2) {
              fmtGear.dataset.aniAutoExpanded = String(Number(fmtGear.dataset.aniAutoExpanded || '0') + 1);
              const triggerTargets = [fmtGear, fmtGear.parentElement?.matches('.ani-plus-gear-btn, button, a, [role="button"]') ? fmtGear.parentElement : null].filter(Boolean);
              for (const t of triggerTargets) {
                try {
                  t.click?.();
                  t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                } catch {}
              }
              formatSub = findFormatSub();
              if (!formatSub) {
                setTimeout(() => {
                  for (const p of (unifiedGridEl || document).querySelectorAll('.ani-drawer-slot > *')) {
                    try { decorateSettingsPanel(p); } catch {}
                  }
                }, 80);
              }
            }
            if (fmtGear) {
              fmtGear.classList.add('ani-dup-hidden');
              fmtGear.style.setProperty('display', 'none', 'important');
              if (fmtGear.parentElement && fmtGear.parentElement !== formatRow && fmtGear.parentElement.children.length <= 2 && !(fmtGear.parentElement.textContent || '').trim()) {
                fmtGear.parentElement.classList.add('ani-dup-hidden');
                fmtGear.parentElement.style.setProperty('display', 'none', 'important');
              }
            }
            const leftDanmuSec = [...(fmtRoot.querySelectorAll('#ani-tab-content-2 > .ani-setting-section:not(.ani-dup-hidden)') || [])].pop();
            if (leftDanmuSec) {
              let movedHost = leftDanmuSec.querySelector(':scope > .ani-plus-format-moved');
              if (!movedHost) {
                movedHost = document.createElement('div');
                movedHost.className = 'ani-plus-format-moved ani-plus-group-top';
                leftDanmuSec.append(movedHost);
              }
              if (formatRow.parentElement !== movedHost) movedHost.append(formatRow);
              // Ensure master checkbox toggle sits on line 1 inside formatRow if sibling wrapper separated it
              if (!formatRow.querySelector('input[type="checkbox"]') && formatRow.nextElementSibling && formatRow.nextElementSibling !== formatSub) {
                const nx = formatRow.nextElementSibling;
                if (nx.querySelectorAll('input[type="checkbox"]').length === 1 && !nx.querySelector('select, input[type="range"]') && !(nx.textContent || '').trim()) {
                  nx.classList.add('ani-plus-row-tail-item');
                  formatRow.append(nx);
                }
              }
              if (formatSub) {
                if (formatSub.parentElement !== movedHost) movedHost.append(formatSub);
                normalizeFormatSub(formatSub);
              }
            }
          }
        } else {
          for (const existSub of panelEl.querySelectorAll('.ani-plus-format-subinline')) {
            normalizeFormatSub(existSub);
          }
        }
        if (!panelEl.closest('.ani-drawer-slot-extra')) {
          for (const range of panelEl.querySelectorAll('input[type="range"]')) {
            const syncRange = () => {
              const min = Number(range.min || 0);
              const max = Number(range.max || 100);
              const val = Number(range.value || 0);
              const pct = max > min ? Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100)) : 0;
              range.style.setProperty('--ani-range-pct', `${pct.toFixed(1)}%`);
            };
            if (!range.dataset.aniRangeBound) {
              range.dataset.aniRangeBound = 'true';
              range.addEventListener('input', syncRange);
              range.addEventListener('change', syncRange);
              new MutationObserver(syncRange).observe(range, { attributes: true, attributeFilter: ['value', 'min', 'max'] });
            }
            syncRange();
            if (range.closest('.ani-plus-format-moved:not(.ani-plus-native-format)')) continue;
            const itemRow = range.closest('.ani-setting-item') || range.closest('li') || range.parentElement;
            if (itemRow && itemRow !== panelEl) {
              itemRow.classList.add('ani-drawer-slider-row');
              if (/彈幕不透明度|彈幕字體大小/.test(itemRow.textContent)) itemRow.classList.add('ani-player-duplicate');
              const sliderBox = (range.parentElement && range.parentElement !== itemRow) ? range.parentElement : range;
              if (sliderBox !== itemRow) sliderBox.classList.add('ani-drawer-slider-ctrl');
              if (/字體大小|文字大小/.test(itemRow.textContent || '') && !itemRow.querySelector('.ani-drawer-size-scale') && sliderBox.parentElement) {
                const scale = document.createElement('div');
                scale.className = 'ani-drawer-size-scale';
                scale.innerHTML = '<span>小</span><span>標準</span><span>大</span>';
                sliderBox.parentElement.insertBefore(scale, sliderBox);
              }
            }
          }
        }
        // Strip verbose parenthetical notes / placeholder clutter (preserve 相關段落分析完成!)
        const walker = document.createTreeWalker(panelEl, NodeFilter.SHOW_TEXT);
        let tn;
        while ((tn = walker.nextNode())) {
          const raw = tn.nodeValue || '';
          const cleaned = raw.replace(/\s*[（(](?:由動畫瘋[·.]?Plus控制中|建議勾選|點擊降落)[）)]/g, '');
          if (cleaned !== raw) tn.nodeValue = cleaned;
        }
        for (const inp of panelEl.querySelectorAll('input[placeholder]')) {
          if (/請輸入想要過濾的字詞/.test(inp.placeholder)) inp.placeholder = '輸入過濾關鍵字';
        }
        // Mark 截圖 按鍵設定 input + button as side-by-side pills
        for (const input of panelEl.querySelectorAll('.plus-keyword-header input[type="text"][readonly]')) {
          input.classList.add('ani-plus-pill-input');
          input.parentElement.classList.add('ani-plus-inline-controls');
        }
        // Convert 過濾關鍵字 input + 新增 button reliably + style added keyword tags (e.g. 第一 ×, 頭 ×) as pill capsules
        for (const inp of panelEl.querySelectorAll('input[type="text"], input:not([type="checkbox"]):not([type="range"]):not([type="button"]):not([type="submit"])')) {
          const ph = inp.placeholder || '';
          if (!inp.readOnly && (/過濾|關鍵字|字詞/.test(ph) || inp.closest('[class*="keyword" i], [class*="filter" i]'))) {
            inp.classList.add('ani-plus-filter-input');
            const kwWrap = inp.parentElement;
            kwWrap?.classList.add('ani-plus-kw-input-row');
            const kwSection = kwWrap?.closest('div:has(.ani-plus-form-row)') || kwWrap?.parentElement?.parentElement || kwWrap?.parentElement || kwWrap;
            if (kwSection) {
              for (const b of kwSection.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"], span, div')) {
                if (b.closest('[id*="tj"], [class*="jump" i], .ani-plus-add-icon-btn, .ani-plus-form-row')) continue;
                const bt = ((b.tagName === 'INPUT' ? b.value : b.textContent) || '').replace(/\s+/g, '').trim();
                if (bt === '新增' && b.childElementCount <= 2 && !b.querySelector('input')) {
                  if ((b.tagName === 'SPAN' || b.tagName === 'DIV') && b.parentElement?.matches('button, a, [role="button"]')) continue;
                  if (b.tagName === 'INPUT') {
                    b.style.setProperty('display', 'none', 'important');
                    if (!b.nextElementSibling?.classList.contains('ani-plus-add-icon-btn')) {
                      const proxy = document.createElement('button');
                      proxy.type = 'button';
                      proxy.className = 'ani-plus-add-icon-btn';
                      proxy.setAttribute('aria-label', '新增');
                      proxy.title = '新增';
                      proxy.innerHTML = '<svg class="ani-plus-add-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
                      proxy.addEventListener('click', () => b.click());
                      b.after(proxy);
                    }
                  } else {
                    b.classList.add('ani-plus-add-icon-btn');
                    b.setAttribute('aria-label', '新增');
                    b.title = '新增';
                    if (!b.querySelector('.ani-plus-add-svg')) {
                      b.innerHTML = '<svg class="ani-plus-add-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
                    }
                  }
                }
              }
              // Wrap added keyword items as sleek individual pill capsules (e.g. [第一 ×] [頭 ×]), scanning across sibling keyword containers too
              const kwScopeRoot = panelEl.closest('.ani-drawer-slot-extra') ? (kwSection.closest('.plus_menu_root') || panelEl) : kwSection;
              const chipCandidates = [...kwScopeRoot.querySelectorAll('div, span, li, a')];
              for (const close of kwScopeRoot.querySelectorAll('.plus_k-label > .plus_ani-keyword-close')) {
                close.parentElement.classList.add('ani-plus-kw-chip');
                close.classList.add('ani-plus-kw-del');
                close.closest('#plus_dan_keywords')?.classList.add('ani-plus-kw-list');
              }
              const isChipNode = (node) => {
                if (node.closest('.ani-plus-kw-input-row, .ani-plus-form-row, .ani-plus-add-icon-btn, .ani-plus-info-trigger, .ani-plus-kw-chip, .ani-plus-format-subinline, .ani-plus-jump-controls, .ani-plus-jump-editor-row') || node.classList.contains('ani-plus-kw-chip')) return null;
                if (node.querySelector('input, select, .ani-plus-kw-input-row, .ani-plus-form-row, .ani-plus-jump-editor-row')) return null;
                if (kwWrap && (kwWrap.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) === 0) return null;
                const nt = (node.textContent || '').replace(/\s+/g, ' ').trim();
                if (!nt || nt.length > 32 || /^(?:新增|取消|儲存)$/.test(nt)) return null;
                const rawDel = [...node.querySelectorAll('button, a, [role="button"], svg, span, i')].filter((c) => {
                  if (c.closest('.ani-info-badge-host, .ani-row-icon, .ani-plus-info-trigger')) return false;
                  const ct = (c.textContent || '').trim();
                  if (c.matches('button, a, [role="button"]')) return /^(?:[×✕✖x✗✘]?)$/i.test(ct);
                  if (c.tagName.toLowerCase() === 'svg') {
                    const r = c.getBoundingClientRect();
                    return r.width <= 22 && r.height <= 22;
                  }
                  return c.childElementCount === 0 && /^[×✕✖x✗✘]$/i.test(ct);
                });
                const delCandidates = rawDel.filter((c) => !rawDel.some((other) => other !== c && other.contains(c)));
                if (delCandidates.length !== 1) return null;
                const delEl = delCandidates[0];
                const kwOnly = nt.replace(delEl.textContent || '', '').replace(/\s+/g, ' ').trim();
                if (!kwOnly || kwOnly.length > 24) return null;
                return delEl;
              };
              for (const node of chipCandidates) {
                const delEl = isChipNode(node);
                if (!delEl) continue;
                // Skip container nodes that wrap another candidate chip child
                if ([...node.querySelectorAll('div, span, li, a')].some((child) => isChipNode(child))) continue;
                node.classList.add('ani-plus-kw-chip');
                delEl.classList.add('ani-plus-kw-del');
                node.parentElement?.classList.add('ani-plus-kw-list');
              }
            }
          }
        }
        // When 動畫瘋·Plus exists, remove duplicate 自動播放下一集 & duplicate Bahamut 關鍵字過濾 (keep Plus's keyword filter)
        const hasPlusInDrawer = !!drawer?.querySelector('.ani-drawer-slot-extra');
        if (hasPlusInDrawer) {
          for (const sec of panelEl.querySelectorAll('.ani-setting-section')) {
            const items = sec.querySelectorAll('.ani-setting-item');
            if (items.length === 1 && sec.querySelector('#autoPlay')) {
              sec.classList.add('ani-dup-hidden');
            }
          }
          for (const kwItem of panelEl.querySelectorAll('#ani-tab-content-2 .ani-keyword-info, #ani-tab-content-2 .ani-setting-item')) {
            if (kwItem.closest('.ani-danmu-keywords')) continue;
            if (kwItem.matches('.ani-keyword-info') || kwItem.querySelector('#newkeyword, .ani-keyword-body, .ani-keyword-header, #ani-setting-keyword-title')) {
              kwItem.classList.add('ani-dup-hidden');
            }
          }
        }
        // Format 時間跳躍設定 2-input editor (+ - [00] : [00] ✓) & convert 取消 header button on single clean rows
        if (panelEl.closest('.ani-drawer-slot-extra')) {
          const toActionSvg = (btn, kind, label, svgInner) => {
            btn.classList.add('ani-plus-icon-action', kind);
            btn.setAttribute('aria-label', label);
            btn.title = label;
            if (!btn.querySelector('.ani-plus-action-svg')) {
              btn.innerHTML = `<svg class="ani-plus-action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svgInner}</svg>`;
            }
          };
          for (const tjRow of panelEl.querySelectorAll('.ani-plus-form-row')) {
            if (!/時間跳躍/.test(tjRow.textContent || '')) continue;
            for (const cBtn of tjRow.querySelectorAll('button, a, [role="button"]')) {
              const ct = (cBtn.textContent || '').replace(/\s+/g, '').trim();
              if (ct === '取消') {
                toActionSvg(cBtn, 'is-cancel', '取消', '<path d="M18 6 6 18M6 6l12 12"/>');
              }
            }
          }
          for (const edCont of panelEl.querySelectorAll('div')) {
            if (edCont.closest('.ani-plus-kw-input-row, .ani-plus-format-subinline, .ani-plus-jump-editor-row') || edCont.querySelector('.ani-plus-form-row')) continue;
            const numInputs = [...edCont.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]):not(.ani-plus-filter-input):not(.ani-plus-pill-input)')];
            if (numInputs.length !== 2) continue;
            if (edCont.querySelectorAll('div').length > 4) continue;
            const btns = [...edCont.querySelectorAll('button, a, [role="button"]')];
            if (btns.length < 1 || edCont.textContent.includes('過濾關鍵字')) continue;
            edCont.classList.add('ani-plus-jump-editor-row');
            for (const ni of numInputs) ni.classList.add('ani-plus-jump-num-input');
            const secondInput = numInputs[1];
            for (const eb of btns) {
              const ebt = (eb.textContent || '').replace(/\s+/g, '').trim();
              const isAfterSecond = (secondInput.compareDocumentPosition(eb) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
              if (ebt === '取消') {
                toActionSvg(eb, 'is-cancel', '取消', '<path d="M18 6 6 18M6 6l12 12"/>');
              } else if (ebt === '新增' || (isAfterSecond && (/^(?:\+|✓|✔)$/.test(ebt) || !ebt))) {
                toActionSvg(eb, 'is-confirm', '新增', '<polyline points="20 6 9 17 4 12"/>');
              } else if (/^[+-]$/.test(ebt)) {
                toActionSvg(eb, 'is-step', ebt, ebt === '+' ? '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>' : '<line x1="5" y1="12" x2="19" y2="12"/>');
              }
            }
          }
        }
        // Convert Save (儲存) and remaining Time Jump (+ / - / 新增 / 取消) buttons to crisp vector icons, leaving remaining pills (-01:00..+01:30 / 00:30) as left-aligned capsules
        for (const el of panelEl.querySelectorAll('button, a, span, div, input[type="button"], input[type="submit"]')) {
          if (el.closest('input:not([type="button"]):not([type="submit"]), label.ani-checkbox__label, .ani-setting-section > h4, .ani-info-badge-host, .ani-plus-info-trigger, .ani-plus-refresh-btn, .ani-plus-add-icon-btn, .ani-plus-gear-btn, .ani-plus-icon-action')) continue;
          const txt = ((el.tagName === 'INPUT' ? el.value : el.textContent) || '').replace(/\s+/g, '').trim();
          const isBtnLike = el.matches('button, a, [role="button"], input[type="button"], input[type="submit"]');
          const isTimeJumpEditorBtn = isBtnLike && /^(?:[+-]|新增|取消)$/.test(txt) && !!el.closest('[class*="jump" i], .ani-plus-jump-editor-row, div')?.querySelector('input:not([type="button"]):not([type="submit"])');
          if (isBtnLike && txt === '儲存' && el.childElementCount <= 1) {
            if (el.tagName === 'INPUT') {
              el.style.setProperty('display', 'none', 'important');
              if (!el.nextElementSibling?.classList.contains('is-save')) {
                const proxy = document.createElement('button');
                proxy.type = 'button';
                proxy.className = 'ani-plus-icon-action is-save';
                proxy.setAttribute('aria-label', '儲存');
                proxy.title = '儲存';
                proxy.innerHTML = '<svg class="ani-plus-action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
                proxy.addEventListener('click', () => el.click());
                el.after(proxy);
              }
            } else {
              el.classList.add('ani-plus-icon-action', 'is-save');
              el.setAttribute('aria-label', '儲存');
              el.title = '儲存';
              if (!el.querySelector('.ani-plus-action-svg')) {
                el.innerHTML = '<svg class="ani-plus-action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
              }
            }
            continue;
          }
          if (isTimeJumpEditorBtn && el.tagName === 'BUTTON') {
            el.parentElement?.classList.add('ani-plus-jump-controls');
            const kind = txt === '新增' ? 'is-confirm' : txt === '取消' ? 'is-cancel' : 'is-step';
            const path = txt === '新增'
              ? '<polyline points="20 6 9 17 4 12"/>'
              : txt === '取消'
                ? '<path d="M18 6 6 18M6 6l12 12"/>'
                : txt === '+'
                  ? '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'
                  : '<line x1="5" y1="12" x2="19" y2="12"/>';
            el.classList.add('ani-plus-icon-action', kind);
            el.setAttribute('aria-label', txt);
            el.title = txt;
            if (!el.querySelector('.ani-plus-action-svg')) {
              el.innerHTML = `<svg class="ani-plus-action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
            }
            continue;
          }
          const isTargetLabel =
            /^[+-]?\d{1,2}:\d{2}$/.test(txt) ||
            /^(?:確認|其它)(?:座標|空降)$/.test(txt);
          if (isTargetLabel && el.childElementCount <= 1 && (!/^[+-]?\d{1,2}:\d{2}$/.test(txt) || !el.closest('input, #sub_list, .sub-list-li'))) {
            let target = el;
            while (
              target.parentElement &&
              target.parentElement !== panelEl &&
              target.parentElement.childElementCount === 1 &&
              !target.parentElement.querySelector('input, select, textarea') &&
              target.parentElement.textContent.replace(/\s+/g, '').trim() === txt &&
              !target.parentElement.matches('.ani-setting-item, .ani-keyword-header, .plus_jump_time, .plus_row, .ani-plus-subcard, .ani-setting-section')
            ) {
              target = target.parentElement;
            }
            target.parentElement?.classList.add('ani-plus-jump-controls');
            const isNeutral = /^其它(?:座標|空降)$/.test(txt);
            target.classList.add('ani-plus-pill-btn');
            if (isNeutral) target.classList.add('is-neutral');
          }
        }
        for (const iconEl of panelEl.querySelectorAll('i, img, [class*="icon" i]:not(.ani-sec-icon):not(.ani-row-icon):not(.ani-info-badge-host):not(.ani-plus-refresh-btn):not(.ani-plus-add-icon-btn):not(.ani-plus-gear-btn):not(.ani-plus-icon-action)')) {
          if (iconEl.closest('.ani-sec-icon, .ani-row-icon, .ani-info-badge-host, .ani-plus-info-trigger, .ani-danmu-position-btn, .ani-plus-refresh-btn, .ani-plus-add-icon-btn, .ani-plus-gear-btn, .ani-plus-icon-action')) continue;
          iconEl.classList.add('ani-mono-icon');
        }
        const keywords = unifiedGridEl?.querySelector('#plusbox #plus_dan_keywords')?.closest('.ani-setting-item');
        if (keywords && danmuSection) {
          keywords.classList.add('ani-danmu-keywords');
          danmuSection.append(keywords);
        }
        for (const label of danmuSection?.querySelectorAll('.ani-setting-label__mian') || []) {
          for (const node of label.childNodes) {
            if (node.nodeType !== Node.TEXT_NODE) continue;
            const text = node.textContent.replace(/^彈幕來源顯示$/, '來源顯示').replace(/^彈幕格式修改$/, '格式').replace(/^(字體|陰影深度|外框距離)修改$/, '$1');
            if (node.textContent !== text) node.textContent = text;
          }
        }
        const filterRow = danmuSection?.querySelector('[data-ani-row-key="auto-filter"]')?.closest('.ani-setting-item');
        const sourceRow = danmuSection?.querySelector('[data-ani-row-key="source-region"]')?.closest('.ani-setting-item');
        if (filterRow && sourceRow && filterRow.parentElement === sourceRow.parentElement && !filterRow.parentElement.classList.contains('ani-danmu-filter-row')) {
          const filterGroup = document.createElement('div');
          filterGroup.className = 'ani-danmu-filter-row';
          filterRow.before(filterGroup);
          filterGroup.append(filterRow, sourceRow);
        }
        } finally {
          decoratingGrid = false;
        }
      };
      if (unifiedGridEl && !unifiedGridEl.dataset.aniPanelObserved) {
        unifiedGridEl.dataset.aniPanelObserved = 'true';
        let gridTimer = 0;
        new MutationObserver(() => {
          if (decoratingGrid) return;
          clearTimeout(gridTimer);
          gridTimer = setTimeout(() => {
            for (const p of unifiedGridEl.querySelectorAll('.ani-drawer-slot > *')) {
              try { decorateSettingsPanel(p); } catch {}
            }
          }, 40);
        }).observe(unifiedGridEl, { childList: true, subtree: true });
      }

      const ensureUnifiedToggle = () => {
        if (!drawer) return null;
        const bar = drawer.querySelector('.ani-drawer-toggles');
        const bodyWrap = drawer.querySelector('.ani-player-settings-body');
        if (!bar || !bodyWrap) return null;
        let btn = document.querySelector('.ani-player-settings-toggle[data-ani-drawer-key="unified-settings"]');
        if (!btn) {
          btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ani-player-settings-toggle';
          btn.dataset.aniDrawerKey = 'unified-settings';
          btn.setAttribute('aria-expanded', 'false');
          btn.setAttribute('aria-label', '播放與強化設定');
          btn.title = '播放與強化設定';
          btn.innerHTML = '<span class="ani-ps-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg></span><span class="ani-ps-text">播放器設定</span><svg class="ani-ps-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          btn.addEventListener('click', () => {
            const opening = !bodyWrap.classList.contains('is-open');
            for (const s of bodyWrap.querySelectorAll('.ani-drawer-slot[data-ani-source-triggered="false"]')) {
              const link = s._aniSourceLink;
              if (link && s.textContent.trim() === '') {
                s.dataset.aniSourceTriggered = 'true';
                try { link.click(); } catch {}
              }
            }
            btn.setAttribute('aria-expanded', String(opening));
            btn.classList.toggle('is-open', opening);
            bodyWrap.classList.toggle('is-open', opening);
            bodyWrap.setAttribute('aria-hidden', String(!opening));
            drawer.classList.toggle('is-open', opening);
            for (const p of bodyWrap.querySelectorAll('.ani-drawer-slot > *')) decorateSettingsPanel(p);
          });
          const plusBox = document.querySelector('#BH_background .plus_imagetool_box');
          if (plusBox) {
            btn.classList.add('ani-in-toolbar');
            plusBox.append(btn);
            drawer.classList.add('has-toolbar-host');
          } else {
            bar.append(btn);
          }
        }
        return btn;
      };

      const mountIntoDrawer = (key, label, _iconMarkup, panelEl, sourceLink = null) => {
        if (!drawer || !panelEl) return;
        const unifiedGrid = drawer.querySelector('.ani-unified-settings-grid');
        if (!unifiedGrid) return;
        if (unifiedGrid.querySelector(`.ani-drawer-slot[data-ani-drawer-key="${key}"]`)) return;

        const btn = ensureUnifiedToggle();
        if (btn && key !== 'native-settings') {
          const txtEl = btn.querySelector('.ani-ps-text');
          if (txtEl) txtEl.textContent = '播放與 Plus 設定';
        }
        const slot = document.createElement('div');
        slot.className = `ani-drawer-slot ani-drawer-slot-${key === 'native-settings' ? 'native' : 'extra'}`;
        slot.dataset.aniDrawerKey = key;
        if (sourceLink) {
          slot._aniSourceLink = sourceLink;
          slot.dataset.aniSourceTriggered = 'false';
        }
        panelEl.style.removeProperty('display');
        delete panelEl.dataset.aniTabActive;
        slot.append(panelEl);
        unifiedGrid.append(slot);
        decorateSettingsPanel(panelEl);
      };

      if (settingsPanelNative) {
        mountIntoDrawer(
          'native-settings',
          '播放器進階設定',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',
          settingsPanelNative
        );
      }

      const relocateExtraTabs = () => {
        const keepIds = new Set(['ani-tab-content-1', 'ani-tab-content-intro', 'ani-tab-content-rating']);
        for (const item of [...tabs.children]) {
          const link = item.matches('.ani-tabs-link, a, button, #setting-aniplus') ? item : item.querySelector('.ani-tabs-link, a, button, #setting-aniplus');
          if (!link) continue;
          const href = (link.getAttribute('href') || '').trim();
          const id = link.id === 'setting-aniplus' ? 'ani-tab-content' : href.startsWith('#') ? href.slice(1) : '';
          if (keepIds.has(id)) continue;
          const isPlus = /動畫瘋\s*[·・．.]?\s*Plus/i.test(link.textContent || '');
          if (!item.matches('.ani-tabs__item') && !isPlus) continue;
          if (!id && !isPlus) continue;
          if (link.id === 'setting-aniplus' && !document.getElementById(id)) continue;
          item.hidden = true;
          item.classList.add('ani-relocated-player-tab');
          if (id && id !== 'ani-tab-content-2') {
            const targetPane = document.getElementById(id) || tabContent.querySelector(`#${CSS.escape(id)}`);
            if (targetPane) {
              const titleText = (link.textContent || '動畫瘋·Plus').trim() || '動畫瘋·Plus';
              mountIntoDrawer(
                'ext-' + id,
                titleText,
                '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 7.4h7.6l-6.1 4.4 2.3 7.4L12 16.8l-6.2 4.4 2.3-7.4L2 9.4h7.6L12 2z"/></svg>',
                targetPane,
                link
              );
            }
          }
        }
        // Also catch any non-core .ani-tab-content__item added without #href matching keepIds (e.g. AniGamer Plus click-based pane)
        for (const extraPane of [...tabContent.querySelectorAll(':scope > .ani-tab-content__item')]) {
          if (keepIds.has(extraPane.id)) continue;
          if (/plus/i.test(extraPane.id + ' ' + extraPane.className) || extraPane.querySelector('[class*="plus" i]')) {
            mountIntoDrawer(
              'ext-plus-pane-' + (extraPane.id || 'main'),
              '動畫瘋·Plus',
              '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 7.4h7.6l-6.1 4.4 2.3 7.4L12 16.8l-6.2 4.4 2.3-7.4L2 9.4h7.6L12 2z"/></svg>',
              extraPane
            );
          }
        }
      };

      // 2. Style top tabs as segmented 3-pill switcher (彈幕列表 | 作品簡介 | 作品評分)
      tabs.classList.add('ani-segmented-tabs');
      if (danmuTab && !danmuTab.querySelector('.ani-seg-tab-icon')) {
        danmuTab.innerHTML =
          '<svg class="ani-seg-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h12"/></svg><span>彈幕列表</span>';
      }

      const dataSection = document.querySelector('#BH_background section.data');
      const acgReviewEl = document.querySelector('#acg_review');

      let introPane = document.getElementById('ani-tab-content-intro');
      if (!introPane && dataSection) {
        introPane = document.createElement('div');
        introPane.id = 'ani-tab-content-intro';
        document.getElementById('BH_background')?.classList.add('ani-has-intro-pane');
        introPane.className = 'ani-tab-content__item ani-sidebar-pane ani-sidebar-intro';
        tabContent.append(introPane);
      }

      let lastIntroSig = '';
      const publisherChannels = new Map([
        'Ani-One', '回歸線娛樂', '木棉花', '曼迪', '華藝娛樂', 'Aniplus',
        '野獸國', 'REMOW', 'Aniplex', '普威爾', '提恩傳媒', 'JOYUPMEDIA',
        '六六喜喜', '天馬行空', '采昌', '水元素', '智寶', '車庫娛樂',
      ].map(name => [name.toLowerCase(), name]));
      let creditsUrl = '';
      let credits = [];
      let introScrollObserver;
      const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const populateIntroPane = () => {
        if (!introPane) return;
        const acgUrl = document.querySelector('section.data a[href*="acgDetail.php"]')?.href;
        if (acgUrl && creditsUrl !== acgUrl) {
          creditsUrl = acgUrl;
          const renderCredits = (html) => {
            if (!html || creditsUrl !== acgUrl) return;
            const doc = new DOMParser().parseFromString(html, 'text/html');
            credits = [];
            let group;
            let foundStaff = false;
            for (const node of doc.querySelectorAll('b, li')) {
              const text = [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE)
                .map(child => child.textContent).join('').trim();
              if (node.matches('b')) {
                group = /[＜<](製作團隊|製作人員|STAFF)[＞>]/i.test(text) ? '製作團隊'
                  : /[＜<]聲優(?:演員)?[＞>]/.test(text) ? '聲優'
                  : /[＜<](?:音樂|主題曲)[＞>]/.test(text) ? '主題曲' : undefined;
                if (group === '製作團隊') foundStaff = true;
                continue;
              }
              const field = text.match(/^[｜|]\s*([^：:]+)[：:]\s*(.+)$/);
              if (foundStaff && group && field && !field[1].startsWith('┕')) credits.push({ group, title:field[1].trim(), val:field[2].trim() });
            }
            populateIntroPane();
          };
          if (typeof GM_xmlhttpRequest === 'function' && /^https:\/\/acg\.gamer\.com\.tw\/acgDetail\.php\?s=\d+$/.test(acgUrl)) {
            GM_xmlhttpRequest({ method:'GET', url:acgUrl, anonymous:true, timeout:8000, onload:response => {
              if (response.status === 200) renderCredits(response.responseText);
            } });
          } else if (globalThis.chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ type:'ani-fetch-acg-credits', url:acgUrl }, response => {
              if (!chrome.runtime.lastError) renderCredits(response?.credits);
            });
          }
        }
        const infoSrc = document.querySelector('#BH_background #ani-info');
        const activeInfoPane = infoSrc?.querySelector('.ani-tab-pane.active') || infoSrc;
        const castGrid = activeInfoPane?.querySelector('.grid.cast');
        const songGrid = activeInfoPane?.querySelector('.grid.song');
        const rawDescText = [...document.querySelectorAll('#BH_background section.data .data-intro > p')]
          .map((p) => {
            const copy = p.cloneNode(true);
            for (const br of copy.querySelectorAll('br')) br.replaceWith('\n');
            return copy.textContent;
          })
          .join('\n')
          .trim();
        const typeItems = document.querySelectorAll('#BH_background section.data .type-list > li.type');
        const rawWorkTitle = document.querySelector('.anime_name h1')?.textContent.trim() || '';

        const sig = `${rawWorkTitle}|${typeItems.length}|${rawDescText}|${castGrid?.children.length || 0}|${songGrid?.children.length || 0}|${credits.length}`;
        if (sig === lastIntroSig) {
          window.__aniIconifyInfoLinks?.(introPane);
          return;
        }
        lastIntroSig = sig;

        const types = [];
        const seenMeta = new Set();
        const pushMeta = (title, val) => {
          const cleanT = String(title || '').trim();
          const cleanV = String(val || '').trim();
          if (!cleanT || !cleanV) return;
          const normKey = `${cleanT}::${cleanV}`;
          if (seenMeta.has(normKey)) return;
          seenMeta.add(normKey);
          types.push({ title: cleanT, val: cleanV });
        };

        for (const li of typeItems) {
          const title = (li.querySelector('.title')?.textContent || '').trim();
          const tagTexts = [...li.querySelectorAll('.tag-list .tag')].map((t) => t.textContent.trim()).filter(Boolean);
          const val = tagTexts.length ? tagTexts.join(' / ') : (li.querySelector('.content')?.textContent || '').trim();
          pushMeta(title, val);
        }

        // Lift STAFF / 製作團隊 lines out of synopsis into top pill-grid items (handles single-line ｜-separated and truncated tails like "｜導")
        const synopsisLines = [];
        let inStaffBlock = false;
        const staffKeyRe = /^(?:原作性質|原作|原案|原作插畫|監督|導演|導演監督|總監督|系列構成|劇本|劇本統籌|角色原案|角色設定|人物設定|機械設定|音樂|動畫製作|製作|美術監督|色彩設計|攝影監督|音響監督|背景)$/;
        const rawSegments = [];
        for (const rawLine of rawDescText.split(/\r?\n/)) {
          if (/[｜|][^｜|\n]{1,14}[：:]/.test(rawLine)) {
            const parts = rawLine.split(/(?=[｜|])/).map((s) => s.trim()).filter(Boolean);
            rawSegments.push(...parts);
          } else {
            rawSegments.push(rawLine);
          }
        }
        for (let idx = 0; idx < rawSegments.length; idx++) {
          const line = rawSegments[idx].trim();
          if (!line) {
            if (!inStaffBlock && synopsisLines.length && synopsisLines[synopsisLines.length - 1] !== '') {
              synopsisLines.push('');
            }
            continue;
          }
          if (/^(?:[<＜【\[]\s*)?(?:STAFF|製作團隊|製作人員)(?:\s*[>＞】\]])?[:：]?$/i.test(line)) {
            inStaffBlock = true;
            continue;
          }
          const cleanedStaffLine = line.replace(/^[｜|‧•・─\-]+\s*/, '').trim();
          const kv = cleanedStaffLine.match(/^([^：:]{1,14})\s*[：:]\s*(.+)$/);
          if (kv && (inStaffBlock || staffKeyRe.test(kv[1].trim()))) {
            inStaffBlock = true;
            const keyName = kv[1].trim();
            pushMeta(keyName, kv[2]);
            continue;
          }
          // Strip truncated trailing pipe fragment or STAFF header caused by site intro length cutoff (e.g. "｜導", "｜原", "＜STA")
          const isTrailingFragment = idx >= rawSegments.length - 1 && (
            /^[｜|]\s*[^\n：:]{0,14}$/.test(line) ||
            /^[<＜【\[]\s*(?:STAF|製作團)/i.test(line)
          );
          if (isTrailingFragment) {
            inStaffBlock = true;
            continue;
          }
          inStaffBlock = false;
          synopsisLines.push(line);
        }
        while (synopsisLines.length && synopsisLines[synopsisLines.length - 1] === '') synopsisLines.pop();
        const cleanSynopsis = synopsisLines.join('\n').trim().replace(/\s*※(?:[上下](?:半)?)?$/, '');
        const workTitle = rawWorkTitle
          .replace(/(?:\s*(?:\[\s*(?:\d+(?:\.\d+)?|中文配音|中配|國語(?:配音)?|日文配音|雙語|電影|特別篇|OAD|OVA)\s*\]|EP\.?\s*\d+(?:\.\d+)?))+\s*$/i, '');
        const movieLabel = workTitle.match(/^(?:劇場版\s*)?關於我轉生變成史萊姆這檔事\s*(?:劇場版\s*)?(紅蓮之絆篇|蒼海之淚篇)$/)?.[1];
        const slimeMovie = slimeMovies[movieLabel];
        const slimeSeasonLabel = workTitle.match(/^關於我轉生變成史萊姆這檔事(?:\s*第([一二三四1-4])[季期])?$/);
        const slimeSeason = slimeSeasonLabel &&
          (Number(slimeSeasonLabel[1]) || '一二三四'.indexOf(slimeSeasonLabel[1] || '一') + 1);
        const slimeSpinoff = /^(?:轉生史萊姆日記(?:\s*關於我轉生變成史萊姆這檔事)?|關於我轉生變成史萊姆這檔事\s*轉生史萊姆日記)$/.test(workTitle)
          ? 'diary'
          : /^關於我轉生變成史萊姆這檔事\s*柯里烏斯之夢$/.test(workTitle) ? 'coleus'
          : slimeSeason === 1 && /\[\s*[1-5]\s*\]\s*\[\s*(?:特別篇|OAD|OVA)\s*\]/i.test(rawWorkTitle) ? 'oad' : null;
        const verifiedStaff = slimeMovie?.staff || (slimeSeason || slimeSpinoff ? {
          ...Object.fromEntries(slimeSeasonOneStaff),
          ...(slimeSpinoff ? slimeSpinoffStaffOverrides[slimeSpinoff] : slimeSeasonStaffOverrides[slimeSeason]),
        } : null);

        let html = '<div class="ani-sidebar-scroll">';
        const summary = types.filter(item => /^(首播(?:日期)?|作品分類|分類|代理(?:廠商)?|製作廠商|導演|導演監督|監督)$/.test(item.title))
          .filter((item, index, items) => items.findIndex(other => normalizeStaffRole(other.title) === normalizeStaffRole(item.title)) === index);
        for (const title of ['原作性質', '原作']) {
          const field = types.find(item => item.title === title)
            || credits.find(item => item.group === '製作團隊' && item.title === title);
          const verified = title === '原作' ? verifiedStaff?.['原作']
            : slimeMovie ? '劇場版原創故事'
            : slimeSpinoff === 'diary' ? '四格漫畫改編'
            : slimeSpinoff === 'coleus' ? '第二季 Blu-ray 特典小說改編'
            : slimeSeason && !slimeSpinoff ? '輕小說衍生（動畫改編自漫畫版）' : '';
          if (verified || field) summary.push(verified ? { title, val: verified } : field);
        }
        if (slimeSeason && !slimeSpinoff) {
          summary.push({ title: '季別', val: `第${'一二三四'[slimeSeason - 1]}季` });
          summary.push({ title: '漫畫連載期號', val: '《月刊少年 Sirius》2015 年 5 月號起' });
        }
        const studios = new Set(summary.filter(item => item.title === '製作廠商').map(item => normalizeStaffValue(item.val)));
        const repeatsStudio = item => item.title === '動畫製作' && studios.has(normalizeStaffValue(item.val));
        if (summary.length) {
          html += '<div class="ani-side-meta-grid">';
          for (const item of summary) {
            const isWide = types.length === 1 || /分類/.test(item.title) || item.val.length > 14;
            const season = /^首播(?:日期)?$/.test(item.title) ? recommendationSeason(item.val).split(' ').at(-1) : '';
            let value = season && !item.val.includes(season) ? `${item.val} (${season})` : item.val;
            if (item.title === '原作性質') {
              value = value.replace(/(\d{4})年\s*(\d{1,2})月(?:\s*(\d{1,2})日)?(?!\s*(?:號|期))/g,
                (_, year, month, day) => [year, month.padStart(2, '0'), day?.padStart(2, '0')].filter(Boolean).join('/'));
            }
            let links;
            let linkClass = 'ani-side-studio-link';
            if (item.title === '製作廠商' && typeof studioCreditLinks === 'function') {
              links = studioCreditLinks(value);
            } else if (/^代理(?:廠商)?$/.test(item.title)) {
              linkClass = 'ani-side-publisher-link';
              links = value.split(/(\s*[×✕、,，/／]\s*)/u).map((label, index) => {
                const channel = index % 2 ? undefined : publisherChannels.get(label.trim().normalize('NFKC').toLowerCase());
                return { label, href: channel && '/publisherList.php?p=' + encodeURIComponent(channel) };
              });
            }
            const valueHtml = links ? links.map(({label, href}) => href
              ? `<a class="${linkClass}" href="${escHtml(href)}" target="_blank" rel="noopener">${escHtml(label)}</a>`
              : escHtml(label)).join('') : escHtml(value);
            html += `<div class="ani-side-meta-item${isWide ? ' is-wide' : ''}"><span class="ani-side-pill">${escHtml(item.title)}</span><span class="ani-side-meta-val">${valueHtml}</span></div>`;
          }
          html += '</div>';
        }
        const synopsis = slimeMovie?.synopsis || cleanSynopsis;
        if (synopsis) {
          html += `<div class="ani-side-divider"></div><div class="ani-side-synopsis">${escHtml(synopsis)}</div>`;
        }
        const groups = [
          { name:'製作團隊', icon:'M3 6h18v14H3z M8 6V3h8v3' },
          { name:'聲優', icon:'M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0z M5 11a7 7 0 0 0 14 0 M12 18v4', grid:castGrid },
          { name:'主題曲', icon:'M10 17V5l10-2v12 M10 17a3 3 0 1 1-3-3h3 M20 15a3 3 0 1 1-3-3h3', grid:songGrid },
        ];
        const selected = introPane.querySelector('[data-credit-choice][aria-pressed="true"]')?.dataset.creditChoice || groups[0].name;
        html += '<div class="ani-credit-switch" role="group" aria-label="製作資訊分類">';
        for (const {name, icon} of groups) {
          html += `<button type="button" data-credit-choice="${name}" aria-pressed="${name === selected}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="${icon}"/></svg>${name}</button>`;
        }
        html += '</div>';
        for (const {name, grid} of groups) {
          const fields = [];
          const isStaff = name === '製作團隊';
          const candidates = credits.filter(item => item.group === name);
          if (isStaff) {
            candidates.unshift(...types.filter(item => !summary.includes(item)));
            candidates.push(...Object.entries(verifiedStaff || {}).map(([title, val]) => ({ title, val })));
          }
          const displayed = new Set();
          for (const item of candidates) {
            const title = isStaff ? normalizeStaffRole(item.title) : item.title;
            if (isStaff && (/^(原作性質|原作)$/.test(title) ||
                summary.some(field => normalizeStaffRole(field.title) === title))) continue;
            const val = isStaff ? verifiedStaff?.[title] || item.val : item.val;
            const key = `${title}|${isStaff && verifiedStaff?.[title] ? '' : normalizeStaffValue(val || '')}`;
            if (!val || (isStaff && repeatsStudio({ title, val })) || displayed.has(key)) continue;
            displayed.add(key);
            fields.push({ title, val });
          }
          if (name === '製作團隊' && !fields.length) {
            const production = summary.find(item => item.title === '製作廠商');
            const studio = !production && typeof catalogStudiosForEpisode === 'function'
              ? catalogStudiosForEpisode(new URLSearchParams(location.search).get('sn'), workTitle)
              : '';
            if (studio) fields.push({ title: '動畫製作', val: studio });
          }
          html += `<section class="ani-side-extra-block" data-credit-panel="${name}" ${name === selected ? '' : 'hidden'}>`;
          if (!grid?.children.length) {
            html += '<div class="ani-side-meta-grid">';
            for (const {title,val} of fields) html += `<div class="ani-side-meta-item"><span class="ani-side-pill">${escHtml(title)}</span><span class="ani-side-meta-val">${escHtml(val)}</span></div>`;
            html += fields.length ? '</div>' : '</div><p>暫無資料</p>';
          }
          html += '</section>';
        }
        const prevScroll = introPane.querySelector('.ani-sidebar-scroll')?.scrollTop || 0;
        introPane.innerHTML = html + '</div>';
        for (const {name,grid} of groups) {
          if (grid?.children.length) introPane.querySelector(`[data-credit-panel="${name}"]`).append(grid.cloneNode(true));
        }
        const switcher = introPane.querySelector('.ani-credit-switch');
        switcher.onclick = event => {
          const choice = event.target.closest('[data-credit-choice]');
          if (!choice) return;
          for (const button of switcher.children) button.setAttribute('aria-pressed', String(button === choice));
          for (const panel of introPane.querySelectorAll('[data-credit-panel]')) panel.hidden = panel.dataset.creditPanel !== choice.dataset.creditChoice;
        };
        window.__aniIconifyInfoLinks?.(introPane);
        const newScrollEl = introPane.querySelector('.ani-sidebar-scroll');
        newScrollEl.scrollTop = prevScroll;
        const syncIntroEdges = () => {
          const { scrollTop, scrollHeight, clientHeight } = newScrollEl;
          introPane.classList.toggle('can-scroll-up', scrollTop > 1);
          introPane.classList.toggle('can-scroll-down', clientHeight > 0 && scrollHeight - clientHeight - scrollTop > 1);
        };
        newScrollEl.addEventListener('scroll', syncIntroEdges, { passive: true });
        introScrollObserver?.disconnect();
        if (typeof ResizeObserver === 'function') {
          introScrollObserver = new ResizeObserver(syncIntroEdges);
          introScrollObserver.observe(newScrollEl);
          for (const child of newScrollEl.children) introScrollObserver.observe(child);
        }
        syncIntroEdges();
      };

      let ratingPane = document.getElementById('ani-tab-content-rating');
      if (!ratingPane && acgReviewEl) {
        ratingPane = document.createElement('div');
        ratingPane.id = 'ani-tab-content-rating';
        ratingPane.className = 'ani-tab-content__item ani-sidebar-pane ani-sidebar-rating';
        tabContent.append(ratingPane);
      }

      let lastRatingSig = '';
      let cachedUserStars = 0;
      const reviewCache = new Map();
      const readAcgReviewMeta = () => {
        let fanpageId = '';
        let mediaType = '4';
        let userScore = 0;
        const moreOnclick = acgReviewEl?.querySelector('.user-score-more')?.getAttribute('onclick') || '';
        const mNav = moreOnclick.match(/navAllReviews\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
        if (mNav) {
          fanpageId = mNav[1];
          mediaType = mNav[2];
        }
        const scripts = [...(dataSection?.querySelectorAll('script') || []), ...document.querySelectorAll('script')];
        for (const sc of scripts) {
          const txt = sc.textContent || '';
          if (!txt) continue;
          if (!fanpageId) {
            const mInit = txt.match(/Bahamut\.AcgReview\s*\([\s\S]*?,\s*(\d+)\s*,\s*(\d+)\s*\)/);
            if (mInit) {
              fanpageId = mInit[1];
              mediaType = mInit[2];
            }
          }
          const mUser = txt.match(/acgReview\.userReview\s*\(\s*(\d+)\s*(?:,|\))/);
          if (mUser) {
            userScore = Number(mUser[1]) || 0;
          }
          if (fanpageId && userScore) break;
        }
        return { fanpageId, mediaType, userScore };
      };
      const fetchPopularReviews = (fanpageId, mediaType = '4') => {
        if (!fanpageId) return Promise.resolve({ myReview: null, reviews: [] });
        if (reviewCache.has(fanpageId)) return reviewCache.get(fanpageId);
        const p = (async () => {
          try {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
              const res = await new Promise((resolve) => {
                try {
                  chrome.runtime.sendMessage({ type: 'ani-fetch-reviews', fanpageId, mediaType }, (resp) => resolve(resp || {}));
                } catch (_) {
                  resolve({});
                }
              });
              if (res?.myReview || res?.myRating || (Array.isArray(res?.reviews) && res.reviews.length)) {
                return { myReview: res.myReview || null, myRating: Number(res.myRating || res.myReview?.rating || 0) || 0, reviews: res.reviews || [] };
              }
            }
          } catch (_) {}
          try {
            if (typeof GM_xmlhttpRequest === 'function') {
              const json = await new Promise((resolve) => {
                GM_xmlhttpRequest({
                  method: 'GET',
                  url: `https://api.gamer.com.tw/acg/v1/reviews_list.php?sn=${encodeURIComponent(fanpageId)}&t=${encodeURIComponent(mediaType)}&sort=1&page=1`,
                  onload: (r) => {
                    try { resolve(JSON.parse(r.responseText)); } catch (_) { resolve(null); }
                  },
                  onerror: () => resolve(null),
                });
              });
              const mapRev = (it) => ({
                id: String(it.id || it.sn || ''),
                author: it.publisher?.name || it.nickname || it.userid || '匿名',
                avatar: it.publisher?.propic || it.propic || '',
                rating: Number(it.reviews?.rating ?? it.rating ?? it.score ?? 0) || 0,
                likeCount: Number(it.likeCount || it.gp || 0) || 0,
                commentCount: Number(it.commentCount || 0) || 0,
                time: it.time || '',
                content: String(it.content || '').trim(),
              });
              const rawRev = Array.isArray(json?.data?.reviewed) ? json.data.reviewed.flat(2) : json?.data?.reviewed ? [json.data.reviewed] : [];
              const myAnyRaw = rawRev.find(Boolean);
              const myRating = Number(myAnyRaw?.reviews?.rating ?? myAnyRaw?.rating ?? myAnyRaw?.star ?? myAnyRaw?.score ?? 0) || 0;
              const myRaw = rawRev.find((it) => it && (it.content || '').trim());
              const myReview = myRaw ? mapRev(myRaw) : null;
              const rawList = Array.isArray(json?.data?.list) ? json.data.list.flat(2) : Array.isArray(json?.list) ? json.list.flat(2) : [];
              const reviews = rawList
                .filter((it) => it && (it.content || '').trim() && (!myReview || String(it.id || it.sn || '') !== myReview.id))
                .sort((a, b) => Number(b?.likeCount || 0) - Number(a?.likeCount || 0))
                .slice(0, 10)
                .map(mapRev);
              if (myReview || myRating || reviews.length) return { myReview, myRating, reviews };
            }
          } catch (_) {}
          return { myReview: null, myRating: 0, reviews: [] };
        })();
        reviewCache.set(fanpageId, p);
        return p;
      };
      const getNativeStarNodes = () => {
        if (!acgReviewEl) return [];
        const direct = [...acgReviewEl.querySelectorAll('.user-star-block > *')].filter(
          (el) => !/del|remove|trash|clear/i.test(`${el.getAttribute('class') || ''} ${el.title || ''} ${el.getAttribute('aria-label') || ''}`)
        );
        const list =
          direct.length >= 5
            ? direct.slice(0, 5)
            : [...acgReviewEl.querySelectorAll('.user-star-block :is(button, a, i, span, img, svg.user-star)')]
                .filter((el) => !/del|remove|trash|clear/i.test(`${el.getAttribute('class') || ''} ${el.title || ''}`))
                .slice(0, 5);
        return list;
      };
      const isWarmFilledColor = (str) => {
        if (!str || str === 'none' || str === 'transparent') return false;
        const m = String(str).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/i);
        if (m) {
          if (m[4] !== undefined && Number(m[4]) === 0) return false;
          const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
          // Gold / amber OR saturated accent-colored filled stars (distinct from monochrome greys)
          if (r > 180 && g > 110 && b < 130) return true;
          if (Math.max(r, g, b) - Math.min(r, g, b) > 35 && Math.max(r, g, b) > 90) return true;
          return false;
        }
        return /gold|orange|amber|#f5a|#fb|#f9|#ff[bcde0-9]|#117e|#3daf|#00b4/i.test(str);
      };
      const readUserRatedStars = () => {
        if (!acgReviewEl) return cachedUserStars;
        const nodes = getNativeStarNodes();
        let count = 0;
        for (let idx = 0; idx < nodes.length; idx++) {
          const el = nodes[idx];
          const cls = `${el.getAttribute('class') || ''} ${[...el.querySelectorAll('*')].map((c) => c.getAttribute('class') || '').join(' ')}`;
          const img = el.matches('img') ? el : el.querySelector('img');
          const src = img?.getAttribute('src') || '';
          const svgEl = el.matches('svg') ? el : el.querySelector('svg');
          const svgShape = svgEl?.querySelector('path, polygon, use');
          const useHref = svgEl?.querySelector('use')?.getAttribute('href') || svgEl?.querySelector('use')?.getAttribute('xlink:href') || '';
          const iconText = el.textContent?.trim().toLowerCase() || '';
          let filled = false;
          if (/\b(off|empty|outline|unselect|star-off|star_off|star-empty|far|star_border|star_outline)\b/i.test(cls) || /star_border|star_outline/.test(iconText)) {
            filled = false;
          } else if (/\b(is-scored|scored|on|active|full|filled|is-active|is-filled|selected|checked|star-on|star_on|star-full|fas)\b/i.test(cls) || /^(star|star_rate|grade)$/.test(iconText)) {
            filled = true;
          } else if (src || useHref) {
            const ref = `${src} ${useHref}`;
            if (/(off|empty|gray|grey|none|outline|border|0\.)/i.test(ref)) filled = false;
            else if (/star/i.test(ref)) filled = true;
          } else if (
            el.getAttribute('aria-checked') === 'true' ||
            el.getAttribute('aria-pressed') === 'true' ||
            el.dataset.active === 'true'
          ) {
            filled = true;
          } else {
            const st = getComputedStyle(el);
            const svgFill = svgEl ? getComputedStyle(svgEl).fill : '';
            const shapeFill = svgShape ? (svgShape.getAttribute('fill') || getComputedStyle(svgShape).fill) : '';
            if (
              isWarmFilledColor(st.color) ||
              isWarmFilledColor(svgFill) ||
              isWarmFilledColor(shapeFill) ||
              /(star_on|star-on|full)/i.test(st.backgroundImage || '')
            ) {
              filled = true;
            }
          }
          if (filled) count = idx + 1;
        }
        if (count > 0) {
          cachedUserStars = count;
          return count;
        }
        const tipText = (acgReviewEl.querySelector('.user-scored-tip')?.textContent || '').trim();
        const attrScore = Number(
          acgReviewEl.dataset?.userScore ||
            acgReviewEl.querySelector('.user-star-block')?.dataset?.score ||
            acgReviewEl.querySelector('[data-score]')?.dataset?.score ||
            0
        );
        if (attrScore >= 1 && attrScore <= 5) {
          cachedUserStars = attrScore;
          return attrScore;
        }
        const tipNum = tipText.match(/([1-5])\s*星/);
        if (tipNum) {
          cachedUserStars = Number(tipNum[1]);
          return cachedUserStars;
        }
        const meta = readAcgReviewMeta();
        if (meta.userScore >= 1 && meta.userScore <= 5 && (/已評價/.test(tipText) || nodes.length < 5 || !nodes.some((n) => /star/i.test(n.getAttribute('class') || '')))) {
          cachedUserStars = meta.userScore;
          return cachedUserStars;
        }
        if (!/已評價/.test(tipText) && nodes.length >= 5) cachedUserStars = 0;
        return cachedUserStars;
      };
      const goldStarSvg = '<svg class="ani-dist-star" width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.4l2.92 5.92 6.53.95-4.72 4.6 1.11 6.5L12 17.3l-5.84 3.07 1.11-6.5-4.72-4.6 6.53-.95L12 2.4z"/></svg>';
      const renderStarsHtml = (count) => {
        const n = Math.max(1, Math.min(5, Number(count) || 0));
        return `<span class="ani-rating-star-row" aria-label="${n} 星">${goldStarSvg.repeat(n)}</span>`;
      };
      const populateRatingPane = () => {
        if (!ratingPane || !acgReviewEl) return;
        const scoreNumStr = (acgReviewEl.querySelector('.score-overall-number')?.textContent || '0').trim();
        const peopleText = (acgReviewEl.querySelector('.score-overall-people')?.textContent || '').replace(/評價$/, '').trim();
        const scoredTip = (acgReviewEl.querySelector('.user-scored-tip')?.textContent || '').trim();
        const userStars = readUserRatedStars();
        const rSig = `${scoreNumStr}|${peopleText}|${scoredTip}|${userStars}`;
        if (rSig === lastRatingSig) return;
        lastRatingSig = rSig;

        const scoreNum = parseFloat(scoreNumStr) || 0;
        const r = 46;
        const circ = 2 * Math.PI * r;
        const dashOffset = circ * (1 - Math.max(0, Math.min(1, scoreNum / 5)));
        const dist = [];
        for (const row of acgReviewEl.querySelectorAll('.ACG-data .acg-score-date')) {
          const stars = row.dataset.acgstar || row.querySelectorAll('.score-star img, .score-star svg').length;
          const pctStr = row.querySelector('.scored-line')?.style?.width || '0%';
          dist.push({ stars, pctNum: Math.round(parseFloat(pctStr) || 0) });
        }

        const nativeDelBtn = acgReviewEl.querySelector('.user-star-block :is([class*="del"], [class*="remove"], [class*="trash"]), .btn-delete-score, [onclick*="del" i]');
        const statusLabel = scoredTip
          ? userStars > 0 && !/[1-5]/.test(scoredTip)
            ? `${scoredTip}（${userStars} 星）`
            : scoredTip
          : userStars > 0
          ? `已評價 ${userStars} 星`
          : '';
        const meta = readAcgReviewMeta();
        const wallUrl = meta.fanpageId
          ? `https://wall.gamer.com.tw/fanpage.php?sn=${encodeURIComponent(meta.fanpageId)}&tab=7&t=${encodeURIComponent(meta.mediaType || '4')}&filter=0`
          : '';

        let html = '<div class="ani-sidebar-scroll ani-rating-scroll">';
        html += '<div class="ani-rating-hero">';
        html += `<div class="ani-rating-ring-wrap"><svg viewBox="-8 -8 132 132" class="ani-rating-ring-svg"><circle class="ani-ring-bg" cx="58" cy="58" r="${r}"/><circle class="ani-ring-fg" cx="58" cy="58" r="${r}" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${dashOffset.toFixed(1)}"/></svg><div class="ani-ring-center"><strong>${scoreNum ? scoreNum.toFixed(1) : '-'}</strong><span>${escHtml(peopleText)}</span></div></div>`;
        html += '<div class="ani-rating-bars">';
        for (const item of dist) {
          html += `<div class="ani-rating-bar-row"><span class="ani-rating-bar-label">${renderStarsHtml(item.stars)}</span><div class="ani-rating-bar-track"><div class="ani-rating-bar-fill" style="width:${item.pctNum}%"></div></div><span class="ani-rating-bar-pct"><span>${item.pctNum}</span> <span class="ani-rating-bar-unit">%</span></span></div>`;
        }
        html += '</div></div>';
        html += '<div class="ani-side-divider"></div>';
        html += '<div class="ani-my-rating"><div class="ani-my-rating-label">我的評價</div><div class="ani-my-rating-arrow">▼</div><div class="ani-my-stars" role="group" aria-label="我的評價">';
        for (let i = 1; i <= 5; i++) {
          const isFilled = i <= userStars;
          html += `<button type="button" class="ani-my-star-btn${isFilled ? ' is-filled' : ''}" data-star="${i}" aria-pressed="${isFilled}" aria-label="給予 ${i} 星評價"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.4l2.92 5.92 6.53.95-4.72 4.6 1.11 6.5L12 17.3l-5.84 3.07 1.11-6.5-4.72-4.6 6.53-.95L12 2.4z"/></svg></button>`;
        }
        html += '</div>';
        if (statusLabel || wallUrl || acgReviewEl.querySelector('.user-score-more')) {
          html += `<div class="ani-my-rating-status-row">${statusLabel ? `<span class="ani-my-rating-status">${escHtml(statusLabel)}</span>` : ''}${
            nativeDelBtn
              ? '<button type="button" class="ani-my-rating-clear" title="清除評價" aria-label="清除評價"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/></svg></button>'
              : ''
          }${(wallUrl || acgReviewEl.querySelector('.user-score-more')) ? '<button type="button" class="ani-my-write-review-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg><span>寫評論</span></button>' : ''}</div>`;
        }
        html += '</div>';
        html += '<div class="ani-rating-reviews" hidden></div>';
        if (acgReviewEl.querySelector('.user-score-more') || wallUrl) {
          html += '<button type="button" class="ani-rating-more-btn">查看所有評價</button>';
        }
        html += '</div>';

        ratingPane.innerHTML = html;
        const openWallOrReviews = () => {
          const nativeMore = acgReviewEl.querySelector('.user-score-more');
          if (wallUrl) window.open(wallUrl, '_blank', 'noopener,noreferrer');
          else if (nativeMore) nativeMore.click();
        };
        ratingPane.querySelector('.ani-rating-more-btn')?.addEventListener('click', () => {
          const nativeMore = acgReviewEl.querySelector('.user-score-more');
          if (nativeMore) nativeMore.click();
          else if (wallUrl) window.open(wallUrl, '_blank', 'noopener,noreferrer');
        });
        ratingPane.querySelector('.ani-my-write-review-btn')?.addEventListener('click', openWallOrReviews);
        ratingPane.querySelector('.ani-my-rating-clear')?.addEventListener('click', () => {
          cachedUserStars = 0;
          nativeDelBtn?.click();
          setTimeout(populateRatingPane, 120);
        });
        const starBtns = [...ratingPane.querySelectorAll('.ani-my-star-btn')];
        starBtns.forEach((btn, idx) => {
          btn.addEventListener('click', () => {
            cachedUserStars = idx + 1;
            const targetStar = getNativeStarNodes()[idx];
            if (targetStar) targetStar.click();
            starBtns.forEach((b, j) => {
              const fill = j <= idx;
              b.classList.toggle('is-filled', fill);
              b.setAttribute('aria-pressed', String(fill));
            });
            setTimeout(populateRatingPane, 150);
          });
        });

        if (meta.fanpageId) {
          const reviewsWrap = ratingPane.querySelector('.ani-rating-reviews');
          const renderCard = (rev, isMine = false) => {
            const postUrl = rev.id
              ? `https://wall.gamer.com.tw/post.php?sn=${encodeURIComponent(rev.id)}`
              : wallUrl;
            const safeAvatar = rev.avatar && /^https:\/\//i.test(rev.avatar) ? rev.avatar : '';
            const starBlock = rev.rating > 0 ? `<span class="ani-rev-stars">${goldStarSvg.repeat(Math.min(5, rev.rating))}</span>` : '';
            return `<a class="ani-review-card${isMine ? ' is-mine' : ''}" href="${escHtml(postUrl)}" target="_blank" rel="noopener noreferrer">`
              + `<div class="ani-rev-head">`
              + (safeAvatar ? `<img class="ani-rev-avatar" src="${escHtml(safeAvatar)}" alt="" loading="lazy"/>` : '<span class="ani-rev-avatar is-empty"></span>')
              + `<div class="ani-rev-meta"><strong class="ani-rev-author">${escHtml(rev.author)}${isMine ? '<span class="ani-rev-mine-badge">我的評論</span>' : ''}</strong>${starBlock}</div>`
              + `<span class="ani-rev-likes" title="推薦數"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2 21h4V9H2v12Zm20-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13.17 1 6.59 7.59C6.22 7.95 6 8.45 6 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2Z"/></svg>${rev.likeCount || 0}</span>`
              + `</div>`
              + `<p class="ani-rev-body">${escHtml(rev.content)}</p>`
              + `</a>`;
          };
          fetchPopularReviews(meta.fanpageId, meta.mediaType).then((data) => {
            const myReview = data?.myReview || null;
            const resolvedRating = Number(data?.myRating || myReview?.rating || 0) || 0;
            if (resolvedRating > 0 && cachedUserStars === 0) {
              cachedUserStars = resolvedRating;
              starBtns.forEach((b, j) => {
                const fill = j < resolvedRating;
                b.classList.toggle('is-filled', fill);
                b.setAttribute('aria-pressed', String(fill));
              });
              const statusEl = ratingPane.querySelector('.ani-my-rating-status');
              if (statusEl && !/[1-5]/.test(statusEl.textContent || '')) {
                const base = (statusEl.textContent || '').trim();
                statusEl.textContent = base ? `${base}（${resolvedRating} 星）` : `已評價 ${resolvedRating} 星`;
              }
            }
            const reviews = Array.isArray(data) ? data : (data?.reviews || []);
            if (!reviewsWrap || (!myReview?.content && !reviews.length)) return;
            let blocks = '';
            if (myReview?.content) {
              blocks += `<div class="ani-side-divider"></div><div class="ani-reviews-title-row"><span>我的評論</span></div><div class="ani-reviews-list">${renderCard(myReview, true)}</div>`;
            }
            if (reviews.length) {
              const itemsHtml = reviews.slice(0, 5).map((rev) => renderCard(rev, false)).join('');
              blocks += `<div class="ani-side-divider"></div><div class="ani-reviews-title-row"><span>熱門評價</span></div><div class="ani-reviews-list">${itemsHtml}</div>`;
            }
            reviewsWrap.innerHTML = blocks;
            reviewsWrap.hidden = false;
          });
        }
      };
      if (acgReviewEl && !acgReviewEl.dataset.aniRatingObserved) {
        acgReviewEl.dataset.aniRatingObserved = 'true';
        new MutationObserver(() => populateRatingPane()).observe(acgReviewEl, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      }

      const addCustomTab = (id, label, svgMarkup) => {
        if (tabs.querySelector(`.ani-tabs-link[href="#${id}"]`)) return;
        const wrap = document.createElement('div');
        wrap.className = 'ani-tabs__item';
        const link = document.createElement('a');
        link.href = `#${id}`;
        link.className = 'ani-tabs-link ani-redesign-tab';
        link.innerHTML = `${svgMarkup}<span>${label}</span>`;
        wrap.append(link);
        tabs.append(wrap);
      };

      if (introPane) {
        addCustomTab(
          'ani-tab-content-intro',
          '作品簡介',
          '<svg class="ani-tab-svg ani-seg-tab-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Zm3 2v2h4V7H7Zm0 4v2h10v-2H7Zm0 4v2h10v-2H7Z"/></svg>'
        );
        populateIntroPane();
      }
      if (ratingPane) {
        addCustomTab(
          'ani-tab-content-rating',
          '作品評分',
          '<svg class="ani-tab-svg ani-seg-tab-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.4l2.92 5.92 6.53.95-4.72 4.6 1.11 6.5L12 17.3l-5.84 3.07 1.11-6.5-4.72-4.6 6.53-.95L12 2.4z"/></svg>'
        );
        populateRatingPane();
      }

      relocateExtraTabs();

      let syncLocked = false;
      const syncTabs = () => {
        if (syncLocked) return;
        syncLocked = true;
        try {
          const activeLink = tabs.querySelector('.ani-tabs-link.is-active') || danmuTab;
          const id = activeLink?.getAttribute('href')?.slice(1);
          const panels = [...tabContent.querySelectorAll(':scope > .ani-tab-content__item')];
          const selected = panels.find((panel) => panel.id === id);
          for (const panel of panels) {
            const isSel = selected ? panel === selected : false;
            panel.classList.remove('is-tab-entering');
            if (selected) panel.dataset.aniTabActive = String(isSel);
            else delete panel.dataset.aniTabActive;
            panel.style.display = isSel ? 'block' : 'none';
            if (isSel) {
              void panel.offsetWidth;
              panel.classList.add('is-tab-entering');
            }
          }
          if (id === 'ani-tab-content-intro') populateIntroPane();
          if (id === 'ani-tab-content-rating') populateRatingPane();
        } finally {
          syncLocked = false;
        }
      };

      // Capture-phase handler prevents jQuery / 動畫瘋·Plus from fighting tab switches
      if (!tabs.dataset.aniCaptureBound) {
        tabs.dataset.aniCaptureBound = 'true';
        tabs.addEventListener(
          'click',
          (ev) => {
            const link = ev.target?.closest?.('.ani-tabs-link');
            if (!link) return;
            ev.preventDefault();
            ev.stopPropagation();
            ev.stopImmediatePropagation();
            for (const other of tabs.querySelectorAll('.ani-tabs-link')) {
              other.classList.toggle('is-active', other === link);
            }
            syncTabs();
          },
          true
        );
      }

      syncTabs();
      syncToolbarHost();
      // Poll gently via global reference instead of recursive DOM MutationObserver
      window.__aniSyncSidebarIntro = () => {
        syncToolbarHost();
        relocateExtraTabs();
        populateIntroPane();
      };
      const tabObserver = new MutationObserver((muts) => {
        // Ignore class mutations we caused if already synced; catch external injections like 動畫瘋·Plus
        if (muts.some((m) => m.type === 'childList')) relocateExtraTabs();
      });
      tabObserver.observe(tabs, { childList: true, subtree: true });
      tabContent.dataset.aniTabsReady = 'true';
    }
    if (document.querySelector('.subtitle .ani-tab-content[data-ani-tabs-ready="true"]')) {
      window.__aniSyncSidebarIntro?.();
    }
    if (settings.themeEnabled && imageObserver) {
      for (const image of document.querySelectorAll(
        '#blockVideoInSeason .anime-blocker img[data-src]',
      )) {
        if (image.dataset.aniImageObserved) continue;
        image.dataset.aniImageObserved = 'true';
        imageObserver.observe(image);
      }
    }
    const menu = document.querySelector('.mainmenu .menu_btn.toggle');
    if (menu && !menu.dataset.aniKeyboardReady) {
      menu.dataset.aniKeyboardReady = 'true';
      menu.setAttribute('role', 'button');
      menu.setAttribute('tabindex', '0');
      menu.setAttribute('aria-label', '開啟導覽選單');
      const syncMenu = () => {
        const expanded = menu.classList.contains('active');
        menu.setAttribute('aria-expanded', String(expanded));
        menu.setAttribute(
          'aria-label',
          expanded ? '關閉導覽選單' : '開啟導覽選單',
        );
      };
      menu.addEventListener('click', () => setTimeout(syncMenu, 0));
      menu.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        menu.click();
      });
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !menu.classList.contains('active'))
          return;
        menu.click();
        menu.focus();
      });
      syncMenu();
    }
    const headerSearch = document.querySelector('.top_sky #anime-search-sky');
    const pageSearch = document.querySelector('#BH_background .search_result input[name="keyword"]');
    if (headerSearch?.form && pageSearch?.form && !pageSearch.form.classList.contains('ani-duplicate-search')) {
      if (!headerSearch.value) headerSearch.value = pageSearch.value;
      pageSearch.form.classList.add('ani-duplicate-search');
    }
    const search = document.querySelector('.anime_search-icon');
    if (search && !search.dataset.aniKeyboardReady) {
      search.dataset.aniKeyboardReady = 'true';
      search.innerHTML = '<svg class="ani-search-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></svg>';
      search.setAttribute('role', 'button');
      search.setAttribute('tabindex', '0');
      search.setAttribute('aria-label', '搜尋動畫');
      search.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        search.click();
      });
    }
    for (const dateNode of document.querySelectorAll('.anime-date-info, .newanime-date-area .date-block span, .ani-history-card .date')) {
      const formatted = dateNode.textContent.replace(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/g, '$1/$2/$3');
      if (dateNode.textContent !== formatted) dateNode.textContent = formatted;
    }
    const aniInfo = document.querySelector('.subtitle #ani-info');
    const seasonList = document.querySelector('.season ul');
    if (aniInfo && seasonList && !aniInfo.querySelector('.ani-sidebar-episodes')) {
      const epWrap = document.createElement('section');
      epWrap.className = 'ani-sidebar-episodes';
      const title = document.createElement('div');
      title.className = 'ani-sidebar-episodes-title';
      title.textContent = '集數選擇';
      const grid = document.createElement('div');
      grid.className = 'ani-sidebar-episodes-grid';
      const populate = () => {
        const originals = new WeakMap();
        const fragment = document.createDocumentFragment();
        for (const a of seasonList.querySelectorAll('li a')) {
          const clone = document.createElement('a');
          clone.href = a.getAttribute('href') || '#';
          clone.textContent = a.textContent.trim();
          if (a.closest('li')?.classList.contains('playing')) clone.classList.add('is-playing');
          originals.set(clone, a);
          fragment.append(clone);
        }
        grid.append(fragment);
        grid.addEventListener('click', (event) => {
          const source = originals.get(event.target.closest('a'));
          if (!source) return;
          event.preventDefault();
          source.click();
        });
      };
      epWrap.append(title, grid);
      aniInfo.append(epWrap);
      if (typeof IntersectionObserver === 'function') {
        const observer = new IntersectionObserver(entries => {
          if (!entries.some(entry => entry.isIntersecting)) return;
          observer.disconnect();
          populate();
        });
        observer.observe(epWrap);
      } else {
        populate();
      }
    }
    for (const link of document.querySelectorAll('.mainmenu li.is-active a')) {
      link.setAttribute('aria-current', 'page');
    }
  }

  function saveEnabled(enabled) {
    updateSetting('enabled', enabled);
  }

  function updateSetting(key, value) {
    updateSettings(options.normalize({ [key]: value }, settings));
  }

  // ── 三、設定儲存與觀影選單 ──
  let layoutChangeId = 0;
  function updateSettings(values) {
    const changingLayout =
      values.showDanmu !== settings.showDanmu ||
      values.focusMode !== settings.focusMode;
    const tools = changingLayout
      ? document.querySelector('.ani-watch-tools')
      : null;
    const toolsTop = tools?.getBoundingClientRect().top;
    const changeId = ++layoutChangeId;
    Object.assign(settings, values);
    applyPageTheme();
    active?.applySettings();
    active?.refresh();
    syncSettingsPanel();
    // 保住剛按下的觀看工具位置，避免原站重新計算播放器後整頁突然滑動。
    if (
      tools &&
      toolsTop >= 0 &&
      toolsTop < window.innerHeight &&
      window.scrollY > 0
    ) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (changeId !== layoutChangeId || !tools.isConnected) return;
          const delta = tools.getBoundingClientRect().top - toolsTop;
          if (Math.abs(delta) > 1)
            window.scrollBy({ top: delta, behavior: 'instant' });
        }),
      );
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => storage?.set({ ...settings }), 350);
  }

  function syncSettingsPanel() {
    syncPlaybackSeekLabels();
    if (!settingsPanel) return;
    options.sync(settingsPanel, settings);
    const fontLabel = settingsPanel.querySelector('[data-font-status]');
    if (fontLabel) fontLabel.textContent = fontStatus;
  }

  function mountSettings() {
    const header = document.querySelector('.top_sky .sky .container-player');
    if (!header || document.querySelector('.ani-view-settings')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ani-view-settings';
    button.setAttribute('aria-label', '設定');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h5m4 0h7M4 17h9m4 0h3M9 4v6m4 4v6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><span>設定</span>';
    const danmuButton = document.createElement('button');
    danmuButton.type = 'button';
    danmuButton.className = 'ani-danmu-toggle';
    danmuButton.textContent = settings.showDanmu ? '收合彈幕' : '展開彈幕';
    danmuButton.setAttribute('aria-expanded', String(settings.showDanmu));
    danmuButton.addEventListener('click', () =>
      updateSetting('showDanmu', !settings.showDanmu),
    );
    const watchTools = document.createElement('div');
    watchTools.className = 'ani-watch-tools';
    watchTools.setAttribute('aria-label', '觀看工具');
    watchTools.append(danmuButton);
    const focusButton = document.createElement('button');
    focusButton.type = 'button';
    focusButton.className = 'ani-focus-toggle';
    focusButton.textContent = settings.focusMode ? '結束專注' : '專注觀看';
    focusButton.setAttribute('aria-pressed', String(settings.focusMode));
    focusButton.addEventListener('click', () =>
      updateSetting('focusMode', !settings.focusMode),
    );
    watchTools.append(focusButton);
    const player = document.querySelector('#BH_background section.player');
    if (player) player.after(watchTools);
    const panel = document.createElement('section');
    panel.id = 'ani-view-settings-panel';
    panel.className = 'ani-view-settings-panel';
    panel.setAttribute('aria-label', '設定');
    panel.hidden = true;
    button.setAttribute('aria-controls', panel.id);
    panel.innerHTML =
      '<div class="ani-settings-heading"><h2>設定</h2><div class="ani-settings-header-actions"><button type="button" class="ani-settings-close" aria-label="關閉設定"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.7" fill="none"/></svg></button></div></div>' +
      '<div class="ani-settings-scroll-frame"><div class="ani-settings-scroll"><div data-settings-overview><label class="ani-settings-switch"><span>動態環境光</span><input data-setting="enabled" type="checkbox" role="switch"></label>' +
      '<label class="ani-settings-switch"><span>主題配色</span><input data-setting="uiEffectsEnabled" type="checkbox" role="switch"></label>' +
      '<label class="ani-settings-switch"><span>版型重排</span><input data-setting="themeEnabled" type="checkbox" role="switch"></label></div>' +
      options.controlsHTML() +
      '<p class="ani-settings-tip" data-settings-overview>變更會自動儲存。</p></div></div>';
    const settingsScroller = panel.querySelector('.ani-settings-scroll');
    const syncSettingsEdges = () => {
      panel.classList.toggle('ani-settings-scrolled', settingsScroller.scrollTop > 2);
    };
    settingsScroller.addEventListener('scroll', syncSettingsEdges, { passive:true });
    if (typeof ResizeObserver === 'function') {
      const edgeObserver = new ResizeObserver(syncSettingsEdges);
      edgeObserver.observe(settingsScroller);
      for (const child of settingsScroller.children) edgeObserver.observe(child);
    }
    const close = () => {
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      panel.dispatchEvent(new Event('ani-settings-close'));
    };
    button.addEventListener('click', () => {
      if (!panel.hidden) {
        close();
        return;
      }
      panel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      panel.dispatchEvent(new Event('ani-settings-open'));
      const detail = panel.querySelector('[data-settings-detail]');
      (detail && !detail.hidden
        ? panel.querySelector('[data-settings-back]')
        : panel.querySelector('input')
      )?.focus();
    });
    panel.querySelector('.ani-settings-close').addEventListener('click', () => {
      close();
      button.focus();
    });
    options.wire(panel, () => settings, updateSettings);
    document.addEventListener('pointerdown', (event) => {
      if (
        !panel.hidden &&
        !panel.contains(event.target) &&
        !button.contains(event.target)
      )
        close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !panel.hidden) {
        close();
        button.focus();
      }
    });
    header.append(button);
    document.body.append(panel);
    settingsPanel = panel;
    mountStarMapCategory();
    syncSettingsPanel();
  }

  // ── 四、播放器生命週期：一個影片只建立一組渲染資源 ──
  function attach(video) {
    const player =
      video.closest('#ani_video, .video-js') || video.parentElement;
    const host = video.closest('.videoframe') || player?.parentElement;
    const stage = host?.closest('section.player');
    const originalClip = video.style.clipPath;
    const controlBar = player?.querySelector('.vjs-control-bar');
    if (!player || !host || !document.body) return null;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'vjs-control ani-ambientlight-toggle';
    toggle.setAttribute('aria-label', '切換環境光');
    toggle.innerHTML =
      '<svg class="ani-ambientlight-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
    const controlsEnd = controlBar?.querySelector('.vjs-fullscreen-control');
    const rightControls = controlBar?.querySelector('.control-bar-rightbtn');
    if (rightControls) rightControls.append(toggle);
    else if (controlBar)
      controlBar.insertBefore(
        toggle,
        controlsEnd?.parentElement === controlBar ? controlsEnd : null,
      );
    else {
      toggle.classList.add('ani-ambientlight-floating-toggle');
      host.append(toggle);
    }
    toggle.addEventListener('click', () => saveEnabled(!settings.enabled));

    host.classList.add('ani-ambientlight-host');

    let pageGlow = document.createElement('canvas');
    pageGlow.className = 'ani-ambientlight-page-glow';
    pageGlow.width = 960;
    pageGlow.height = 540;
    pageGlow.setAttribute('aria-hidden', 'true');
    document.body.prepend(pageGlow);

    const sample = document.createElement('canvas');
    sample.width = SAMPLE_WIDTH;
    sample.height = SAMPLE_HEIGHT;
    const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
    let renderer = globalThis.AniAmbientRenderer?.create(
      pageGlow,
      settings.renderer === 'canvas',
    );
    let rendererPreference = settings.renderer;
    function useCanvasFallback() {
      renderer?.destroy();
      const replacement = pageGlow.cloneNode(false);
      pageGlow.replaceWith(replacement);
      pageGlow = replacement;
      renderer = globalThis.AniAmbientRenderer?.create(pageGlow, true);
    }
    if (!renderer) useCanvasFallback();
    let stopped = false;
    let failed = false;
    let frameHandle = null;
    let lastDraw = 0;
    let effectiveFps = 60;
    let renderScale = 1;
    let lastMetrics = 0;
    let meanCost = 0;
    let lastPresentedCount = -1;
    let fallbackWithoutFrameCount = false;
    let slowFrames = 0;
    let lastRecovery = 0;
    let lastCropCheck = 0;
    let lastColorSample = 0;
    let sampleHandle = null;
    let samplingFailed = false;
    let lastVideoFrame = 0;
    let geometryHandle = null;
    let glowVideoWasVisible = false;
    let crop = { left: 0, top: 0, right: 0, bottom: 0 };
    let pendingCrop = null;
    let cropVotes = 0;
    let hasFrame = false;
    let previousColor = null;
    let notice = null;

    function isAd() {
      return player.matches(AD_PLAYER_SELECTOR);
    }

    function showNotice(message) {
      notice?.remove();
      notice = document.createElement('div');
      notice.className = 'ani-ambientlight-notice';
      notice.textContent = message;
      player.append(notice);
      setTimeout(() => notice?.remove(), 6500);
    }

    function needsSceneColor() {
      return settings.uiEffectsEnabled && (settings.headerTint > 0 || settings.panelTint > 0);
    }

    function shouldShow() {
      return (
        settings.enabled &&
        (Number(settings.intensity) > 0 || settings.coverBars || needsSceneColor()) &&
        !failed &&
        !document.hidden &&
        video.duration > 60 &&
        !isAd() &&
        !player.classList.contains('ani-mini-pip') &&
        !document.fullscreenElement?.contains(player)
      );
    }

    function applySettings() {
      if (rendererPreference !== settings.renderer) {
        rendererPreference = settings.renderer;
        renderer?.destroy();
        const replacement = pageGlow.cloneNode(false);
        pageGlow.replaceWith(replacement);
        pageGlow = replacement;
        renderer = globalThis.AniAmbientRenderer?.create(
          pageGlow,
          settings.renderer === 'canvas',
        );
        if (!renderer) useCanvasFallback();
        hasFrame = false;
      }
      // The page redesign is opt-in and its precise grid is used only when
      // the two native columns exist. Ambilight itself survives either change.
      const nativeMode =
        host.classList.contains('vjs-fullwindow') ||
        host.querySelector('.video.fullwindow') ||
        document.body.classList.contains('fullscreen') ||
        document.fullscreenElement;
      document.body.classList.toggle(
        'ani-native-player-mode',
        Boolean(nativeMode),
      );
      document.body.classList.toggle(
        'ani-theater-layout',
        Boolean(
          settings.themeEnabled &&
            settings.playerLayout === 'columns' &&
            !nativeMode &&
            stage &&
            host.matches('.videoframe') &&
            host.parentElement === stage &&
            stage.querySelector(':scope > .subtitle'),
        ),
      );
      document.body.classList.toggle(
        'ani-ambientlight-active',
        Boolean(settings.enabled),
      );
      document.body.classList.toggle(
        'ani-hide-sidebar-ads',
        Boolean(settings.hideSidebarAds),
      );
      pageGlow.style.opacity =
        shouldShow() && Number(settings.intensity) > 0 ? '1' : '0';
      if (!shouldShow() || !settings.coverBars) {
        video.style.clipPath = originalClip;
        host.classList.remove('ani-bar-coverage');
      }
      pageGlow.style.filter = 'none';
      pageGlow.style.transitionDuration = matchMedia(
        '(prefers-reduced-motion:reduce)',
      ).matches
        ? '0s'
        : `${settings.fadeIn / 1000}s`;
      host.style.setProperty(
        '--ani-glow-opacity',
        String(clamp(Number(settings.intensity) || 0, 0, 100) / 100),
      );
      host.style.setProperty(
        '--ani-glow-radius',
        `${clamp(Number(settings.radius) || 0, 10, 100)}px`,
      );
      host.style.setProperty(
        '--ani-glow-saturation',
        String(clamp(Number(settings.saturation) || 100, 100, 220) / 100),
      );
      host.classList.toggle('ani-ambientlight-hidden', !shouldShow());
      pageGlow.classList.toggle('ani-ambientlight-hidden', !shouldShow());
      document.body.classList.toggle(
        'ani-ambientlight-page',
        Boolean(settings.themeEnabled),
      );
      stage?.classList.toggle(
        'ani-ambientlight-stage',
        Boolean(settings.themeEnabled),
      );
      toggle.setAttribute('aria-pressed', String(Boolean(settings.enabled)));
      toggle.title = failed
        ? '無法讀取此影片畫面'
        : settings.enabled
          ? '關閉環境光'
          : '開啟環境光';
      if (settings.enabled && !video.paused) schedule();
    }

    // ── 五、黑條與場景色取樣：不改動原站的控制項 ──
    function updateCrop(now, data) {
      if (!settings.cropBars && !settings.coverBars) {
        crop = { left: 0, top: 0, right: 0, bottom: 0 };
        return;
      }
      if (now - lastCropCheck < 300) return;
      lastCropCheck = now;
      const candidate = globalThis.AniAmbientBlackBars?.detect(
        data,
        SAMPLE_WIDTH,
        SAMPLE_HEIGHT,
        settings.barThreshold,
      ) || { left: 0, top: 0, right: 0, bottom: 0 };
      const same =
        pendingCrop &&
        Object.keys(candidate).every(
          (key) => candidate[key] === pendingCrop[key],
        );
      cropVotes = same ? cropVotes + 1 : 1;
      pendingCrop = candidate;
      if (!Object.values(candidate).some(Boolean)) crop = candidate;
      else if (cropVotes >= 2) crop = candidate;
    }

    function averageEdges(data) {
      const sides = [[], [], [], []];
      const left = crop.left + 1,
        right = SAMPLE_WIDTH - crop.right - 2;
      const top = crop.top + 1,
        bottom = SAMPLE_HEIGHT - crop.bottom - 2;
      for (let x = left; x <= right; x += 2) {
        sides[0].push((top * SAMPLE_WIDTH + x) * 4);
        sides[2].push((bottom * SAMPLE_WIDTH + x) * 4);
      }
      for (let y = top; y <= bottom; y += 2) {
        sides[1].push((y * SAMPLE_WIDTH + right) * 4);
        sides[3].push((y * SAMPLE_WIDTH + left) * 4);
      }
      const colors = sides.map((positions) => {
        const channels = [0, 0, 0];
        let total = 0;
        for (const i of positions) {
          const weight =
            0.35 +
            Math.sqrt(
              (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) /
                255,
            );
          total += weight;
          for (let c = 0; c < 3; c++) channels[c] += data[i + c] * weight;
        }
        return channels.map((value) => Math.round(value / Math.max(total, 1)));
      });
      ['top', 'right', 'bottom', 'left'].forEach((side, index) =>
        document.body.style.setProperty(
          `--ani-scene-${side}-rgb`,
          colors[index].join(','),
        ),
      );
      return [0, 1, 2].map(
        (channel) => colors.reduce((sum, color) => sum + color[channel], 0) / 4,
      );
    }

    function videoIsVisible() {
      const rect = video.getBoundingClientRect();
      return (
        rect.bottom > 0 &&
        rect.top < innerHeight &&
        rect.right > 0 &&
        rect.left < innerWidth
      );
    }

    // ── 六、畫面同步：依實際影片矩形對齊光暈 ──
    function paintPageFrame() {
      const r = video.getBoundingClientRect();
      if (r.width < 160 || r.height < 90) return;
      if (!settings.adaptiveQuality) {
        renderScale = 1;
        effectiveFps = 60;
      }
      const width = Math.round(
        Math.min(innerWidth, settings.renderWidth) * renderScale,
      );
      const height = Math.round((width * innerHeight) / innerWidth);
      if (pageGlow.width !== width || pageGlow.height !== height) {
        pageGlow.width = width;
        pageGlow.height = height;
      }
      // 值沒變就不寫：每影格寫 DOM 屬性會使樣式失效，下一次量測又得重排。
      const kind = renderer?.kind || 'unavailable',
        acceleration = renderer?.acceleration || 'unknown';
      if (pageGlow.dataset.renderer !== kind) pageGlow.dataset.renderer = kind;
      if (pageGlow.dataset.acceleration !== acceleration)
        pageGlow.dataset.acceleration = acceleration;
      const scale = Math.min(
        r.width / video.videoWidth,
        r.height / video.videoHeight,
      );
      const vw = video.videoWidth * scale,
        vh = video.videoHeight * scale;
      const trim = {
        left: Math.min(0.4, crop.left / SAMPLE_WIDTH + settings.cropX / 100),
        right: Math.min(0.4, crop.right / SAMPLE_WIDTH + settings.cropX / 100),
        top: Math.min(0.35, crop.top / SAMPLE_HEIGHT + settings.cropY / 100),
        bottom: Math.min(
          0.35,
          crop.bottom / SAMPLE_HEIGHT + settings.cropY / 100,
        ),
      };
      const left = r.left + (r.width - vw) / 2 + vw * trim.left;
      const top = r.top + (r.height - vh) / 2 + vh * trim.top;
      if (settings.coverBars && shouldShow()) {
        const actual = {
          left: (r.width - vw) / 2 + (vw * crop.left) / SAMPLE_WIDTH,
          right: (r.width - vw) / 2 + (vw * crop.right) / SAMPLE_WIDTH,
          top: (r.height - vh) / 2 + (vh * crop.top) / SAMPLE_HEIGHT,
          bottom: (r.height - vh) / 2 + (vh * crop.bottom) / SAMPLE_HEIGHT,
        };
        const covered = Object.values(actual).some((v) => v > 1);
        host.classList.toggle('ani-bar-coverage', covered);
        const clip = covered
          ? `inset(${actual.top}px ${actual.right}px ${actual.bottom}px ${actual.left}px)`
          : originalClip;
        if (video.style.clipPath !== clip) video.style.clipPath = clip;
      }
      const ratio = width / innerWidth;
      const bounds = [
        left * ratio,
        top * ratio,
        vw * (1 - trim.left - trim.right) * ratio,
        vh * (1 - trim.top - trim.bottom) * ratio,
      ];
      const sourceCrop = [
        trim.left,
        trim.top,
        1 - trim.left - trim.right,
        1 - trim.top - trim.bottom,
      ];
      if (Number(settings.intensity) > 0 && renderer && !renderer.draw(video, bounds, sourceCrop, settings)) {
        useCanvasFallback();
        applySettings();
        renderer?.draw(video, bounds, sourceCrop, settings);
      }
    }

    function draw(now, geometryChanged = false) {
      if (
        !shouldShow() ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        !video.videoWidth
      )
        return;
      const autoFpsLimit = settings.adaptiveQuality || fallbackWithoutFrameCount ? 30 : 60;
      const fps = Math.min(settings.fps === 0 ? autoFpsLimit : clamp(Number(settings.fps), 5, 60), effectiveFps);
      // Allow timestamp jitter so 24/30fps videos are not accidentally halved.
      if (
        !geometryChanged &&
        (settings.fps !== 0 || fps < 60) &&
        now - lastDraw < 1000 / fps - 2
      )
        return;
      lastDraw = now;

      try {
        const started = performance.now();
        // Submit the current video texture before the occasional CPU readback.
        if (Number(settings.intensity) > 0 || settings.coverBars) paintPageFrame();
        glowVideoWasVisible = videoIsVisible();
        if (geometryChanged) return;
        const renderCost = performance.now() - started;
        // Native theme colors need no video readback when scene tints are off.
        // Black-bar detection runs less often than the frame renderer.
        const sampleSceneColor = needsSceneColor();
        if (
          !samplingFailed &&
          (sampleSceneColor || settings.coverBars || (settings.cropBars && Number(settings.intensity) > 0)) &&
          sampleHandle === null &&
          (now - lastColorSample >= (sampleSceneColor ? 250 : 500) || !hasFrame)
        ) {
          lastColorSample = now;
          // A separate task keeps synchronous pixel readback out of the frame submission.
          sampleHandle = setTimeout(() => {
            sampleHandle = null;
            if (stopped || !shouldShow() || video.readyState < 2) return;
            try {
              sampleCtx.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
              const sampled = sampleCtx.getImageData(
                0,
                0,
                SAMPLE_WIDTH,
                SAMPLE_HEIGHT,
              );
              updateCrop(performance.now(), sampled.data);
              if (sampleSceneColor) {
                previousColor = averageEdges(sampled.data);
                document.body.style.setProperty(
                  '--ani-scene-rgb',
                  previousColor.join(','),
                );
              }
            } catch (error) {
              samplingFailed = true;
              console.warn(
                '[動畫瘋環境光] 此影片無法讀取黑條取樣，已停用此影片的取樣',
                error,
              );
            }
          }, 0);
        }
        hasFrame = true;

        const cost = performance.now() - started;
        meanCost = meanCost ? meanCost * 0.9 + cost * 0.1 : cost;
        const frameCost = Math.max(renderCost, renderer?.gpuCost || 0);
        slowFrames =
          frameCost > 8 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
        if (settings.adaptiveQuality && slowFrames >= 4) {
          // Preserve frame cadence on GPU: reduce pixels before frame rate.
          const minScale = Math.min(
            1,
            settings.renderFloor / Math.min(innerWidth, settings.renderWidth),
          );
          if (renderScale > minScale)
            renderScale = Math.max(minScale, renderScale * 0.8);
          else effectiveFps = Math.max(15, Math.floor(effectiveFps * 0.8));
          slowFrames = 0;
          lastRecovery = now;
        } else if (
          settings.adaptiveQuality &&
          now - lastRecovery > 10000 &&
          frameCost < 4 &&
          (effectiveFps < 60 || renderScale < 1)
        ) {
          if (effectiveFps < 60) effectiveFps = Math.min(60, effectiveFps + 5);
          else renderScale = Math.min(1, renderScale + 0.1);
          lastRecovery = now;
        }
        if (now - lastMetrics > 1000) {
          lastMetrics = now;
          pageGlow.dataset.drawCost = meanCost.toFixed(1);
          pageGlow.dataset.fpsLimit = String(fps);
          const label = settingsPanel?.querySelector('[data-render-status]');
          if (label) {
            const acceleration =
              renderer?.acceleration === 'software'
                ? '軟體渲染'
                : renderer?.acceleration === 'hardware'
                  ? '硬體加速'
                  : '加速狀態未公開';
            label.textContent = `${renderer?.kind === 'gpu' ? 'WebGL 2' : 'Canvas 相容模式'} · ${acceleration} · ${pageGlow.width} px · ${settings.fps === 0 && fps === 60 ? '跟隨影片影格' : `上限 ${fps} fps`} · 提交 ${meanCost.toFixed(1)} ms${renderer?.kind === 'canvas' ? '。延展效果為相容近似。' : ''}`;
          }
        }
      } catch (error) {
        failed = true;
        applySettings();
        showNotice('此影片不允許讀取畫面，環境光已暫停。');
        console.warn('[動畫瘋環境光] 無法讀取影片畫面', error);
      }
    }

    // ── 七、影格排程：先預約下一影格，避免工作完成後才排程漏幀 ──
    function onFrame(now, metadata) {
      frameHandle = null;
      if (stopped) return;
      if (!metadata) {
        const count =
          video.getVideoPlaybackQuality?.().totalVideoFrames ??
          video.webkitDecodedFrameCount;
        fallbackWithoutFrameCount = !(Number.isFinite(count) && count > 0);
        if (Number.isFinite(count) && count > 0) {
          if (count === lastPresentedCount) {
            schedule();
            return;
          }
          lastPresentedCount = count;
        }
      } else fallbackWithoutFrameCount = false;
      schedule();
      if (metadata?.presentedFrames) {
        if (lastVideoFrame && metadata.presentedFrames - lastVideoFrame > 1)
          slowFrames += 2;
        lastVideoFrame = metadata.presentedFrames;
      }
      draw(now);
    }

    function schedule() {
      if (
        stopped ||
        !shouldShow() ||
        !videoIsVisible() ||
        video.paused ||
        frameHandle !== null
      )
        return;
      if (video.requestVideoFrameCallback) {
        frameHandle = video.requestVideoFrameCallback(onFrame);
      } else {
        frameHandle = requestAnimationFrame(onFrame);
      }
    }

    function sampleOnce() {
      if (shouldShow() && videoIsVisible()) {
        hasFrame = false;
        lastDraw = 0;
        draw(performance.now());
      } else if (hasFrame && !shouldShow() && !player.classList.contains('ani-mini-pip')) {
        renderer?.clear();
        hasFrame = false;
      }
      applySettings();
    }

    function onGeometryChange() {
      if (geometryHandle !== null) return;
      geometryHandle = requestAnimationFrame(() => {
        geometryHandle = null;
        sampleOnce();
      });
    }

    function onScroll() {
      if (geometryHandle !== null || !shouldShow()) return;
      geometryHandle = requestAnimationFrame(() => {
        geometryHandle = null;
        // Render once after leaving the viewport too, so the transparent video
        // rectangle cannot stay at its previous on-screen position.
        if (glowVideoWasVisible || videoIsVisible()) draw(performance.now(), true);
        schedule();
      });
    }

    const onStateChange = () => {
      applySettings();
      if (video.paused) sampleOnce();
    };
    const onLoadStart = () => {
      failed = false;
      hasFrame = false;
      previousColor = null;
      lastPresentedCount = -1;
      pendingCrop = null;
      cropVotes = 0;
      crop = { left: 0, top: 0, right: 0, bottom: 0 };
      renderer?.clear();
      applySettings();
    };
    const episodeSn = new URL(location.href).searchParams.get('sn');
    let checkedEpisodeFrame = false;
    const captureEpisodeFrame = async () => {
      if (checkedEpisodeFrame || !/^\d+$/.test(episodeSn || '') || video.currentTime < 30 ||
          video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || isAd()) return;
      checkedEpisodeFrame = true;
      const frames = readEpisodeFrames();
      if (frames.has(episodeSn) || (await getEpisodeDetails(episodeSn))?.cover?.trim()) return;
      if (!video.isConnected || new URL(location.href).searchParams.get('sn') !== episodeSn ||
          video.currentTime < 30 || isAd()) {
        checkedEpisodeFrame = false;
        return;
      }
      try {
        const frame = document.createElement('canvas');
        frame.width = 192;
        frame.height = Math.max(1, Math.round(frame.width * video.videoHeight / video.videoWidth));
        frame.getContext('2d').drawImage(video, 0, 0, frame.width, frame.height);
        const image = frame.toDataURL('image/jpeg', 0.62);
        if (!image.startsWith('data:image/jpeg;base64,') || image.length > 12000) return;
        // Re-read after the request so another playback tab's frame is retained.
        const saved = readEpisodeFrames();
        saved.set(episodeSn, image);
        localStorage.setItem(episodeFrameStorageKey, JSON.stringify([...saved].slice(-160)));
        player.dispatchEvent(new CustomEvent(episodeFrameReady, { detail: episodeSn }));
      } catch {
        // Protected playback may prevent reading a frame.
      }
    };
    video.addEventListener('timeupdate', captureEpisodeFrame);
    video.addEventListener('play', onStateChange);
    video.addEventListener('pause', onStateChange);
    video.addEventListener('ended', onStateChange);
    video.addEventListener('loadstart', onLoadStart);
    video.addEventListener('seeked', sampleOnce);
    video.addEventListener('loadeddata', sampleOnce);
    window.addEventListener('resize', onGeometryChange);
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', applySettings);
    document.addEventListener('fullscreenchange', applySettings);
    // Our own host classes must not retrigger a native-state observer. Compare
    // only site-owned flags, otherwise paused/verification pages can loop.
    const nativeClassSignature = () =>
      [
        [...player.classList]
          .filter(
            (name) =>
              !name.startsWith('ani-ambientlight-') &&
              name !== 'ani-bar-coverage',
          )
          .join(' '),
        host.classList.contains('vjs-fullwindow'),
        host.querySelector(':scope > .video')?.classList.contains('fullwindow'),
      ].join('|');
    let lastNativeClassSignature = nativeClassSignature();
    let wasMiniPlayer = player.classList.contains('ani-mini-pip');
    const classObserver = new MutationObserver(() => {
      const signature = nativeClassSignature();
      if (signature === lastNativeClassSignature) return;
      lastNativeClassSignature = signature;
      const isMiniPlayer = player.classList.contains('ani-mini-pip');
      if (isMiniPlayer !== wasMiniPlayer) {
        wasMiniPlayer = isMiniPlayer;
        sampleOnce();
      } else {
        applySettings();
      }
    });
    classObserver.observe(player, {
      attributes: true,
      attributeFilter: ['class'],
    });
    if (host !== player)
      classObserver.observe(host, {
        attributes: true,
        attributeFilter: ['class'],
      });
    const nativeVideoBox = host.querySelector(':scope > .video');
    if (nativeVideoBox)
      classObserver.observe(nativeVideoBox, {
        attributes: true,
        attributeFilter: ['class'],
      });
    // Let the site's resize handlers update native player geometry after a
    // sidebar/layout change. Width-only comparison prevents resize feedback.
    let lastHostWidth = 0,
      nativeResizeHandle = null;
    const sizeObserver =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver((entries) => {
            if (
              stage &&
              document.body.classList.contains('ani-theater-layout')
            ) {
              const height = host
                .querySelector(':scope > .video')
                ?.getBoundingClientRect().height;
              if (height > 0)
                stage.style.setProperty('--ani-player-height', `${height}px`);
            }
            const width = Math.round(entries[0].contentRect.width);
            if (width === lastHostWidth) return;
            lastHostWidth = width;
            if (nativeResizeHandle !== null)
              cancelAnimationFrame(nativeResizeHandle);
            nativeResizeHandle = requestAnimationFrame(() => {
              nativeResizeHandle = null;
              if (!stopped) window.dispatchEvent(new Event('resize'));
            });
          })
        : null;
    sizeObserver?.observe(host);
    applySettings();

    return {
      video,
      player,
      host,
      toggle,
      applySettings,
      refresh: sampleOnce,
      stop() {
        stopped = true;
        if (sampleHandle !== null) clearTimeout(sampleHandle);
        if (frameHandle !== null) {
          if (video.cancelVideoFrameCallback)
            video.cancelVideoFrameCallback(frameHandle);
          else cancelAnimationFrame(frameHandle);
        }
        classObserver.disconnect();
        sizeObserver?.disconnect();
        if (nativeResizeHandle !== null)
          cancelAnimationFrame(nativeResizeHandle);
        video.removeEventListener('timeupdate', captureEpisodeFrame);
        video.removeEventListener('play', onStateChange);
        video.removeEventListener('pause', onStateChange);
        video.removeEventListener('ended', onStateChange);
        video.removeEventListener('loadstart', onLoadStart);
        video.removeEventListener('seeked', sampleOnce);
        video.removeEventListener('loadeddata', sampleOnce);
        if (geometryHandle !== null) cancelAnimationFrame(geometryHandle);
        window.removeEventListener('resize', onGeometryChange);
        window.removeEventListener('scroll', onScroll);
        document.removeEventListener('visibilitychange', applySettings);
        document.removeEventListener('fullscreenchange', applySettings);
        notice?.remove();
        video.style.clipPath = originalClip;
        host.classList.remove('ani-bar-coverage');
        toggle.remove();
        document.body.classList.remove('ani-theater-layout');
        document.body.classList.remove('ani-ambientlight-active');
        pageGlow.remove();
        renderer?.destroy();
        applyPageTheme();
        host.classList.remove(
          'ani-ambientlight-host',
          'ani-ambientlight-hidden',
        );
        stage?.classList.remove('ani-ambientlight-stage');
      },
    };
  }

  // ── 八、換集與頁面變動：解除舊監聽及資源後再綁定 ──
  let isBindingPlayer = false;
  function markInitialUiReady() {
    const root = document.documentElement;
    if (!initialUiBound || !fontSettingsKnown || root.dataset.aniUiReady) return;
    root.dataset.aniUiReady = 'true';
    window.dispatchEvent(new Event('ani-ui-ready'));
  }

  function bindPlayer() {
    if (isBindingPlayer) return;
    isBindingPlayer = true;
    try {
      mountSettings();
      arrangeWatchPage();
      arrangeNavigation();
      syncCollapsibleRegions();
      enhanceSiteControls();
    } finally {
      isBindingPlayer = false;
      observer?.takeRecords();
    }
    const video =
      [...document.querySelectorAll(VIDEO_SELECTOR)].find(
        (candidate) =>
          candidate.isConnected &&
          candidate.closest('#ani_video, .video-js, section.player'),
      ) || null;
    if (
      active &&
      active.video === video &&
      active.video.isConnected &&
      active.toggle.isConnected
    )
      return;
    active?.stop();
    active = video ? attach(video) : null;
    initialUiBound = true;
    markInitialUiReady();
  }

  function mountStarMapCategory() {
    if (!settingsPanel || settingsPanel.querySelector('[data-settings-page="rating"]') ||
        !document.querySelector('.top_btn_rating_setting')) return;
    const panel = settingsPanel;
    const label = '評分顯示設定';
    const page = document.createElement('section');
    page.dataset.settingsPage = 'rating';
    page.setAttribute('aria-label', label);
    page.hidden = true;
    panel.querySelector('[data-settings-detail]').append(page);
    panel.querySelector('[data-category-shortcut="content"]').insertAdjacentHTML('afterend',
      `<button type="button" data-category-shortcut="rating"><svg class="ani-settings-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/></svg><span>${label}</span></button>`);
    const contentCategory = panel.querySelector('[data-settings-home] [data-category="content"]');
    const ratingCategory = contentCategory.cloneNode(true);
    ratingCategory.dataset.category = 'rating';
    ratingCategory.setAttribute('aria-label', label);
    ratingCategory.querySelector('strong').textContent = label;
    ratingCategory.querySelector('small').textContent = '評分徽章、篩選與快取';
    contentCategory.after(ratingCategory);

    const closeRating = () => page.replaceChildren();
    panel.addEventListener('ani-settings-close', closeRating);
    panel.addEventListener('ani-settings-navigate', ({ detail }) => {
      if (detail !== 'rating') {
        closeRating();
        return;
      }
      if (page.querySelector('#ani-rating-overlay')) return;
      const launcher = document.querySelector('.top_btn_rating_setting');
      (launcher?.querySelector('a') || launcher)?.click();
      const overlay = document.getElementById('ani-rating-overlay');
      const modal = overlay?.querySelector('#ani-rating-modal');
      if (!modal?.querySelector('#arm-save')) {
        page.textContent = '評分顯示設定目前無法開啟。';
        return;
      }
      styleStarMapSettings(overlay);
      overlay.dataset.aniStarmapEmbedded = 'true';
      // The upstream modal and backdrop set their geometry with inline !important.
      overlay.removeAttribute('style');
      for (const attribute of ['style', 'aria-modal', 'role', 'aria-labelledby']) modal.removeAttribute(attribute);
      organizeStarMapSettings(modal);
      wireStarMapAutosave(modal);
      page.replaceChildren(overlay);
    });
    document.documentElement.dataset.aniRatingIntegrated = 'true';
  }

  const starMapFields = {
    'arm-toggle': ['enabled'],
    'arm-sort-toggle': ['sortEnabled'],
    'arm-mask-toggle': ['maskEnabled'],
    'arm-block-toggle': ['blockEnabled'],
    'arm-fade-watched-toggle': ['fadeWatched'],
    'arm-threshold': ['threshold'],
    'arm-block-threshold': ['blockThreshold'],
    'arm-fs': ['fontSize', 'fs'],
    'arm-rad': ['radius', 'rad'],
    'arm-sample-threshold': ['sampleThreshold'],
    'arm-fetch-interval': ['fetchInterval'],
    'arm-cache-limit': ['cacheLimit', 'cache_limit'],
    'arm-ttl': ['ttlHours', 'ttl_hours'],
  };

  function wireStarMapAutosave(modal) {
    const status = document.createElement('p');
    status.className = 'ani-rating-save-status';
    status.setAttribute('role', 'status');
    modal.querySelector('.ani-rating-toolbar')?.after(status);
    const runtimeOnly = new Set(['fetchInterval', 'cacheLimit', 'ttlHours']);
    try { starMapRatingCache = JSON.parse(localStorage.getItem('aniRating_cache') || '{}') || {}; } catch {}
    for (const [id, [key, storageName = key]] of Object.entries(starMapFields)) {
      const control = modal.querySelector(`#${id}`);
      if (!control) continue;
      const storageKey = `aniRating_${storageName}`;
      const save = value => {
        const handled = !document.dispatchEvent(new CustomEvent('ani-starmap-setting-change', {
          cancelable: true, detail: JSON.stringify({ key, value }),
        }));
        try {
          const persisted = localStorage.getItem(storageKey);
          if (!handled || (persisted !== null && persisted !== String(value))) {
            localStorage.setItem(storageKey, String(value));
          }
          starMapLive[key] = value;
          if (key === 'enabled') starMapFetchMissing = value;
          if (key === 'sortEnabled') {
            for (const toggle of document.querySelectorAll('.ani-owned-rating-toggle')) {
              if (toggle.checked === value) continue;
              toggle.checked = value;
              toggle.dispatchEvent(new Event('change'));
            }
          }
          if (runtimeOnly.has(key)) {
            pruneStarMapRatingCache();
            if (!handled) starMapFetchMissing = true;
            scheduleStarMapCardRefresh();
          } else {
            syncStarMapDisplay();
          }
          const message = !handled && runtimeOnly.has(key)
            ? '已套用至本頁整合的評分請求與快取。'
            : '已套用。';
          if (status.textContent !== message) status.textContent = message;
          return true;
        } catch {
          status.textContent = '無法儲存這項設定，請重試。';
          return false;
        }
      };
      let stored = null;
      try { stored = localStorage.getItem(storageKey); } catch {}
      if (control.classList.contains('arm-toggle-pill')) {
        const sync = enabled => {
          control.classList.toggle('on', enabled);
          control.setAttribute('aria-checked', String(enabled));
        };
        if (stored !== null) sync(stored === 'true');
        starMapLive[key] = control.classList.contains('on');
        control.addEventListener('click', event => {
          event.stopImmediatePropagation();
          const enabled = !control.classList.contains('on');
          if (save(enabled)) sync(enabled);
        }, true);
      } else {
        if (stored !== null && Number.isFinite(Number(stored))) control.value = stored;
        if (Number.isFinite(control.valueAsNumber)) starMapLive[key] = control.valueAsNumber;
        let committed = control.value;
        control.addEventListener('input', () => {
          if (control.value && control.validity.valid && save(control.valueAsNumber)) committed = control.value;
        });
        control.addEventListener('change', () => {
          if (!control.value || !control.validity.valid) control.value = committed;
          else if (committed !== control.value && save(control.valueAsNumber)) committed = control.value;
        });
      }
    }
    pruneStarMapRatingCache();
    syncStarMapDisplay();
  }

  function organizeStarMapSettings(modal) {
    const body = modal.querySelector('.arm-body');
    if (!body) return;
    const sections = [...body.querySelectorAll(':scope > .arm-section')];
    const labels = ['顯示與篩選', '徽章外觀', '效能與快取'];
    const icons = [
      '<path d="M4 6h16l-6 7v4l-4 2v-6Z"/>',
      '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
      '<path d="M4 18a8 8 0 1 1 16 0M12 14l4-4"/><circle cx="12" cy="14" r="1.5"/>',
      '<path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6"/>',
    ];
    const maintenance = document.createElement('section');
    maintenance.className = 'arm-section ani-rating-maintenance';
    for (const [selector, title, description, action] of [
      ['#arm-export-history', '觀看紀錄', '下載觀看紀錄備份。', '匯出 JSON'],
      ['#arm-restart-tour', '操作引導', '重新播放首次使用的功能導覽。', '重新導覽'],
      ['#arm-reset', '恢復預設設定', '清除自訂的評分設定。', '恢復預設'],
    ]) {
      const button = body.querySelector(selector);
      const container = button?.closest('.arm-section > div');
      if (!button || !container) continue;
      const row = document.createElement('div');
      row.className = 'arm-list-item';
      row.innerHTML = `<div class="arm-list-left"><div class="arm-list-title">${title}</div><div class="arm-list-desc">${description}</div></div>`;
      button.textContent = action;
      row.append(button);
      maintenance.append(row);
      container.remove();
    }
    if (maintenance.childElementCount) {
      body.append(maintenance);
      sections.push(maintenance);
      labels[sections.length - 1] = '資料與維護';
    }
    body.querySelector('.ani-starmap-tip')?.remove();

    const toolbar = document.createElement('div');
    toolbar.className = 'ani-rating-toolbar';
    body.before(toolbar);
    const tabs = document.createElement('div');
    tabs.className = 'ani-rating-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '評分設定分類');
    toolbar.append(tabs);
    modal.querySelector('.arm-footer')?.remove();

    const buttons = sections.map((section, index) => {
      const button = document.createElement('button');
      const label = labels[index] || section.querySelector('.arm-section-header')?.textContent.trim();
      button.type = 'button';
      button.id = `ani-star-map-tab-${index}`;
      if (icons[index]) {
        button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[index]}</svg>`;
      }
      button.append(label);
      button.setAttribute('role', 'tab');
      section.id = `ani-star-map-section-${index}`;
      section.setAttribute('role', 'tabpanel');
      section.setAttribute('aria-labelledby', button.id);
      button.setAttribute('aria-controls', section.id);
      tabs.append(button);
      return button;
    });
    const select = index => {
      buttons.forEach((button, i) => {
        const active = i === index;
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
        sections[i].hidden = !active;
      });
    };
    if (!buttons.length) {
      tabs.remove();
      return;
    }
    select(0);
    buttons.forEach((button, index) => button.addEventListener('click', () => select(index)));
    tabs.addEventListener('keydown', event => {
      const index = buttons.indexOf(event.target);
      if (index < 0) return;
      const last = buttons.length - 1;
      const move = { ArrowLeft: index ? index - 1 : last, ArrowRight: index === last ? 0 : index + 1, Home: 0, End: last };
      if (!Object.hasOwn(move, event.key)) return;
      event.preventDefault();
      const next = move[event.key];
      select(next);
      buttons[next].focus();
    });
  }

  function styleStarMapSettings(overlay) {
    if (overlay?.dataset.aniStarmap) return;
    const modal = overlay?.querySelector('#ani-rating-modal');
    if (!modal?.querySelector('#arm-save')) return;
    overlay.dataset.aniStarmap = 'true';
    const title = modal.querySelector('.arm-title');
    if (title) {
      title.id = 'ani-starmap-title';
      modal.setAttribute('aria-labelledby', title.id);
    }
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    // The upstream template hardcodes its palette in inline styles.
    for (const element of [modal, ...modal.querySelectorAll('[style]')]) {
      for (const prop of ['background', 'color', 'border', 'border-top', 'border-bottom', 'box-shadow', 'text-shadow']) {
        element.style.removeProperty(prop);
      }
    }
    const symbols = {
      '核心功能': '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 9h16M9 9v11"/>',
      '⭐': '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
      '🎨': '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.5-3.3 1.4 1.4 0 0 1 1-2.3H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z"/><path d="M7 11h.01M10 7h.01M15 7h.01M18 11h.01"/>',
      '⚙️': '<path d="M4 7h16M4 12h16M4 17h16M8 5v4m8 1v4m-6 1v4"/>',
      '💡': '<path d="M9 18h6m-5 3h4M8 13a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z"/>',
      '⇅ / ★↓': '<path d="M8 19V5m-4 4 4-4 4 4m4-4v14m-4-4 4 4 4-4"/>',
      '🛡️': '<path d="M12 22s7-4 7-10V5l-7-3-7 3v7c0 6 7 10 7 10Z"/>',
      '🚫': '<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
      '🗄️': '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16m-10-4h4m-4 8h4"/>',
      '📥': '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
      '⚠️': '<path d="M12 3 2 21h20ZM12 9v5m0 3h.01"/>',
      '↺': '<path d="m5 12 4 4L19 6"/>',
      '✕': '<path d="m6 6 12 12M18 6 6 18"/>',
    };
    const icons = Object.keys(symbols);
    const walker = document.createTreeWalker(modal, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const symbol = icons.find(icon => node.data.trimStart().startsWith(icon));
      if (!symbol) continue;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'ani-starmap-icon');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = symbols[symbol];
      if (symbol !== '核心功能') node.data = node.data.trimStart().slice(symbol.length);
      node.before(svg);
      if (symbol === '💡') node.parentElement.classList.add('ani-starmap-tip');
    }
    for (const toggle of modal.querySelectorAll('.arm-toggle-pill')) {
      toggle.tabIndex = 0;
      toggle.setAttribute('role', 'switch');
      const label = toggle.closest('.arm-list-item')?.querySelector('.arm-list-title');
      if (label) toggle.setAttribute('aria-label', label.textContent.trim());
      const sync = () => toggle.setAttribute('aria-checked', String(toggle.classList.contains('on')));
      toggle.addEventListener('click', sync);
      toggle.addEventListener('keydown', event => {
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        if (!event.repeat) toggle.click();
      });
      sync();
    }
  }

  const ratingPreloadNotice = /已強制預先載入所有評等[，,、\s]*排序完成[！!]?/;
  function hideRatingPreloadNotice(node) {
    const element = node.nodeType === 1 ? node : node.parentElement;
    const text = element?.textContent || '';
    if (!text.includes('已強制預先載入所有評等')) return;
    for (const candidate of [element, ...element.querySelectorAll('div, span, p, [role="status"], [role="alert"]')]) {
      const label = candidate.textContent.trim();
      if (label.length <= 48 && ratingPreloadNotice.test(label) &&
          !candidate.matches('body, html') && !candidate.querySelector('button, input, a')) {
        candidate.classList.add('ani-legacy-rating-progress');
        break;
      }
    }
  }
  const settingsToastSelector = '.plus-toast-item, #toast-container > .toast, .toast_box .toast_content';
  function hideSettingsSavedNotice(node) {
    const element = node.nodeType === 1 ? node : node.parentElement;
    const enclosing = element?.closest(settingsToastSelector);
    if (!enclosing && !/設定/.test(element?.textContent || '')) return;
    const notices = enclosing ? [enclosing] : element.querySelectorAll(settingsToastSelector);
    for (const notice of notices) {
      const text = notice.textContent.replace(/\s+/g, '').replace(/^[✓✔✅]|[。！!]$/g, '');
      notice.classList.toggle('ani-settings-save-notice', /^設定(?:已(?:儲存|保存)|(?:儲存|保存)成功)$/.test(text));
    }
  }
  const preloadNoticeObserver = new MutationObserver((records) => {
    for (const record of records) {
      const nodes = record.type === 'characterData' ? [record.target] : record.addedNodes;
      for (const node of nodes) {
        hideRatingPreloadNotice(node);
        hideSettingsSavedNotice(node);
      }
    }
  });
  preloadNoticeObserver.observe(document.documentElement, {
    subtree: true, childList: true, characterData: true,
  });
  const observer = new MutationObserver((records) => {
    if (!document.documentElement.dataset.aniRatingIntegrated && settingsPanel &&
        records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 &&
          (node.matches('.top_btn_rating_setting') || node.querySelector('.top_btn_rating_setting'))))) {
      mountStarMapCategory();
    }
    if (records.some(record => record.target === document.body)) {
      styleStarMapSettings(document.getElementById('ani-rating-overlay'));
    }
    if (isBindingPlayer) return;
    // Apply the rating screen in the mutation microtask, before the browser paints.
    const consentChanged = records.some(record => [...record.addedNodes].some(node => {
      const element = node.nodeType === 1 ? node : node.parentElement;
      if (!element) return false;
      const player = element.closest('#ani_video') || element.querySelector('#ani_video');
      return player && (element.matches('.choose-btn-agree') ||
        element.querySelector('.choose-btn-agree') || /不同意|未滿\s*\d+\s*歲/.test(node.textContent || ''));
    }));
    if (consentChanged) stylePlayerConsent();
    // Native progress labels and in-video comments change constantly. They do
    // not require scanning the entire page or rebuilding site controls.
    const structural = records.some((record) => {
      const target =
        record.target.nodeType === 1
          ? record.target
          : record.target.parentElement;
      if (target?.closest('.ani-view-settings-panel, .ani-nav-more-menu, .ani-week-expand, .ani-date-cursor, .ani-home-dash, .ani-home-intro, .ani-studio-panel')) return false;
      if (!target?.closest('.video-js,.videoframe')) return true;
      return [...record.addedNodes, ...record.removedNodes].some(
        (node) =>
          /儲存觀看[記紀]錄/.test(node.textContent || '') ||
          (node.nodeType === 1 &&
          (node.matches('video') || node.querySelector('video') || /按此跳過|跳過片頭|跳過片尾|略過片頭|觀看[記紀]錄|\[X\]/i.test(node.textContent || '') || /skip|toast/i.test(String(node.className || '') + ' ' + String(node.id || '')))),
      );
    });
    if (!structural) return;
    const immediate = records.some((record) =>
      [...record.addedNodes].some(
        (node) =>
          node.nodeType === 1 &&
          (node.id === 'share-url-text' ||
            node.matches?.('.dialogify, .plus_imagetool_box, .image_tool') ||
            node.querySelector?.('#share-url-text, .plus_imagetool_box, .image_tool') ||
            node.closest?.('.image_tool') ||
            /第\s*\d+(?:\.\d+)?\s*集/.test(node.textContent || '') ||
            /按此跳過|跳過片頭|跳過片尾|略過片頭|儲存觀看記錄|觀看紀錄|\[X\]/i.test(node.textContent || '')),
      ),
    );
    clearTimeout(rebindTimer);
    if (immediate) {
      bindPlayer();
    } else {
      rebindTimer = setTimeout(bindPlayer, 180);
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  if (document.body) hideRatingPreloadNotice(document.body);
  styleStarMapSettings(document.getElementById('ani-rating-overlay'));
  bindPlayer();
})();
