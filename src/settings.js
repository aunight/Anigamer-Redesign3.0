(() => {
  'use strict';

  // ── 一、設定預設值與欄位規格 ──
  const defaults = Object.freeze({
    enabled: true,
    uiEffectsEnabled: true,
    themeEnabled: true,
    appearance: 'dark',
    pageBackgroundMode: 'random',
    pageBackgroundStyle: 'mesh',
    pageBackgroundImage: '',
    fontFamily: 'sans',
    method: 'diffuse',
    intensity: 95,
    radius: 80,
    blur: 20,
    detail: 90,
    saturation: 100,
    contrast: 100,
    backgroundBrightness: 100,
    smoothing: 0,
    fadeIn: 100,
    headerOpacity: 0,
    headerTint: 0,
    panelOpacity: 0,
    panelTint: 0,
    infoOpacity: 80,
    relatedOpacity: 85,
    newsOpacity: 85,
    commentOpacity: 85,
    renderWidth: 960,
    renderFloor: 640,
    adaptiveQuality: true,
    fps: 0,
    renderer: 'auto',
    watchWidth: 1720,
    projectionDepth: 50,
    radialRoundness: 50,
    contourStrength: 50,
    swirlAmount: 35,
    reflectCompression: 50,
    diffusionDepth: 100,
    bandWidth: 50,
    stretchDepth: 50,
    customWatchWidth: false,
    watchLayout: true,
    navLayout: true,
    playerLayout: 'native',
    episodesLayout: true,
    infoLayout: true,
    relatedLayout: true,
    newsLayout: true,
    commentsLayout: true,
    colorTheme: 'slate',
    customPalette: false,
    customBase: '#0f1621',
    customSurface: '#172332',
    customSoft: '#1d2a3d',
    customText: '#d5d7dd',
    customMuted: '#9aa0ac',
    customAccent: '#3dafb6',
    footerGlow: true,
    cardGlowEnabled: true,
    cardGlowIntensity: 15,
    textSize: 16,
    textLeading: 175,
    cornerRadius: 12,
    sectionSpacing: 28,
    accentHue: 185,
    accentStrength: 50,
    showInfo: true,
    showRelated: true,
    showMerch: true,
    showHomeNews: true,
    blurEpisodeThumbnails: false,
    episodeThumbnailGrid: true,
    showEpisodeDescription: true,
    scrollMiniPlayer: true,
    playbackSeekSeconds: 5,
    showNews: true,
    showComments: true,
    quickCollapse: true,
    focusMode: false,
    hideDanmuScrollbar: true,
    buttonOpacity: 80,
    controlStyle: 'theme',
    customFontName: '',
    customFontGoogle: true,
    danmuFontEnabled: false,
    commentWidth: 880,
    settingsOpacity: 70,
    collapsedPlayerSpacing: 24,
    foldInfo: false,
    foldRelated: false,
    foldNews: false,
    episodeStyle: 'wrap',
    commentDensity: 'comfortable',
    commentImageWidth: 440,
    danmuTextSize: 13,
    danmuRowSpacing: 10,
    danmuWidth: 340,
    showDanmu: true,
    showDanmuHeat: true,
    danmuAntiOverlap: true,
    cropBars: true,
    coverBars: false,
    barThreshold: 20,
    cropX: 0,
    cropY: 0,
    hideSidebarAds: true,
    showFootprint: true,
    showWeather: true,
    spoilerBlurEnabled: false,
    spoilerBlurTags: '',
    spoilerBlurKeywords: '',
    episodeAutoGroup: true,
    showOffshelfAlert: true,
  });
  const themeFields = [
    [
      'controlStyle',
      '按鈕與搜尋欄底色',
      'select',
      [
        ['theme', '跟隨主題'],
        ['transparent', '讓光暈透出'],
        ['native', '使用原站'],
      ],
    ],
    ['customFontName', '自訂字體名稱', 'text'],
    ['pageBackgroundMode', '背景模式', 'select', [['random','隨機'],['fixed','固定'],['image','圖片'],['off','關閉']]],
    ['pageBackgroundStyle', '背景樣式', 'select', [['silk','絲緞'],['mist','煙霞'],['firefly','流螢'],['sand','流沙'],['rays','天光'],['diffuse','彌散'],['aurora','極光'],['cloud','絲絹'],['mesh','網格漸層'],['grain','顆粒'],['ice','冰藍'],['flow','流光'],['dots','星幕']]],
    ['pageBackgroundImage', '背景圖片網址（HTTPS）', 'text'],
    ['customFontGoogle', '從 Google Fonts 載入自訂字體', 'boolean'],
    ['danmuFontEnabled', '也套用到播放器文字彈幕', 'boolean'],
    ['settingsOpacity', '選單不透明度', 0, 100, 5, '%'],
    [
      'colorTheme',
      '配色',
      'select',
      [
        ['slate', '墨藍'],
        ['neutral', '石墨'],
        ['paper', '暖紙'],
        ['forest', '森林'],
        ['violet', '暮紫'],
      ],
    ],
    ['textSize', '資訊與留言文字大小', 13, 20, 1, ' px'],
    ['textLeading', '閱讀行距', 140, 210, 5, '%'],
    ['cornerRadius', '資訊區圓角', 0, 24, 2, ' px'],
    ['sectionSpacing', '區塊間距', 12, 64, 4, ' px'],
    ['accentHue', '重點色相', 0, 360, 5, '°'],
    ['accentStrength', '重點色鮮豔度', 0, 100, 5, '%'],
    ['customPalette', '使用自訂色票', 'boolean'],
    ['customBase', '頁面背景色', 'color'],
    ['customSurface', '資訊面板底色', 'color'],
    ['customSoft', '按鈕與輸入欄底色', 'color'],
    ['customText', '主要文字色', 'color'],
    ['customMuted', '次要文字色', 'color'],
    ['customAccent', '重點色', 'color'],
    ['footerGlow', '頁尾透出光暈', 'boolean'],
    ['cardGlowEnabled', '卡片光暈', 'boolean'],
    ['cardGlowIntensity', '卡片光暈強度', 0, 100, 5, '%'],
  ];
  const layoutFields = [
    ['watchLayout', '重排播放頁區塊', 'boolean'],
    ['navLayout', '重排頁首導覽', 'boolean'],
    [
      'playerLayout',
      '播放器布局',
      'select',
      [
        ['native', '原站自適應'],
        ['columns', '自訂影片與彈幕並列'],
      ],
    ],
    ['episodesLayout', '重排集數選單', 'boolean'],
    ['infoLayout', '重排作品資訊', 'boolean'],
    ['relatedLayout', '重排相關動畫', 'boolean'],
    ['newsLayout', '重排相關新聞', 'boolean'],
    ['commentsLayout', '重排留言區', 'boolean'],
    ['customWatchWidth', '啟用劇院最大寬度', 'boolean'],
  ];
  const contentFields = [
    ['collapsedPlayerSpacing', '收合彈幕後的播放器留白', 0, 64, 4, ' px'],
    ['focusMode', '專注觀看：暫時隱藏影片以外的資訊', 'boolean'],
    ['quickCollapse', '在各區塊顯示收合按鈕', 'boolean'],
    ['hideDanmuScrollbar', '隱藏彈幕列表捲軸（仍可捲動）', 'boolean'],
    ['commentWidth', '留言區寬度上限', 640, 1600, 40, ' px'],
    ['foldInfo', '作品資訊的收合按鈕', 'boolean'],
    ['foldRelated', '相關動畫的收合按鈕', 'boolean'],
    ['foldNews', '相關新聞的收合按鈕', 'boolean'],
    ['showComments', '顯示留言區', 'boolean'],
    [
      'episodeStyle',
      '集數排列',
      'select',
      [
        ['wrap', '自動換行'],
        ['scroll', '單列捲動'],
        ['collapse', '可收合集數列表'],
      ],
    ],
    [
      'commentDensity',
      '留言密度',
      'select',
      [
        ['comfortable', '舒適'],
        ['compact', '緊湊'],
      ],
    ],
    ['commentImageWidth', '留言圖片最大寬度', 240, 640, 40, ' px'],
    ['danmuTextSize', '彈幕列表字級', 12, 18, 1, ' px'],
    ['danmuRowSpacing', '彈幕列表行距', 4, 16, 2, ' px'],
    ['danmuWidth', '自訂布局的彈幕欄寬度', 240, 420, 20, ' px'],
  ];
  const groups = [
    {
      name: '光暈',
      open: true,
      fields: [
        [
          'method',
          '延伸方式',
          'select',
          [
            ['project', '放射投影 · 向四周展開'],
            ['radial', '圓弧擴散 · 柔化四角'],
            ['contour', '輪廓延展 · 延續邊緣色彩'],
            ['diffuse', '柔光擴散 · 減少畫面細節'],
            ['reflect', '邊緣反射 · 保留原有細節'],
            ['band', '邊緣光帶 · 不複製畫面'],
            ['stretch', '邊緣拉伸 · 偽畫面延伸'],
            ['swirl', '旋流延伸 · 向外旋轉畫面'],
          ],
        ],
        ['intensity', '亮度', 0, 100, 5, '%'],
        ['radius', '延伸範圍', 10, 100, 2, '%'],
        ['blur', '模糊程度', 0, 100, 5, '%'],
        ['detail', '邊緣細節', 0, 100, 5, '%'],
        ['saturation', '色彩濃度', 0, 220, 5, '%'],
        ['contrast', '對比', 50, 150, 5, '%'],
        ['backgroundBrightness', '遠處背景亮度', 0, 100, 5, '%'],
        ['smoothing', '畫面平滑（越高越容易拖影）', 0, 90, 5, '%'],
        ['fadeIn', '光暈淡入時間', 0, 1500, 50, ' ms'],
        ['projectionDepth', '投影縱深', 0, 100, 5, '%'],
        ['radialRoundness', '圓弧柔化', 0, 100, 5, '%'],
        ['contourStrength', '輪廓延續強度', 0, 100, 5, '%'],
        ['reflectCompression', '反射壓縮', 0, 100, 5, '%'],
        ['diffusionDepth', '柔光擴散程度', 0, 100, 5, '%'],
        ['bandWidth', '光帶寬度', 0, 100, 5, '%'],
        ['stretchDepth', '取用邊緣厚度', 0, 100, 5, '%'],
        ['swirlAmount', '旋轉幅度', 0, 100, 5, '%'],
      ],
    },
    {
      name: '頁面',
      fields: [
        [
          'fontFamily',
          '字體 · Google Fonts',
          'select',
          [
            ['system', '系統字體'],
            ['sans', 'Noto Sans TC · 俐落黑體'],
            ['serif', 'Noto Serif TC · 閱讀宋體'],
            ['iansui', '芫荽 Iansui · 手寫感'],
            ['wenkai', '霞鶩文楷 TC · 清楚楷體'],
            ['chironHei', '昭源黑體 · 現代繁中字形'],
            ['chironSung', '昭源宋體 · 印刷閱讀感'],
            ['custom', '自訂字體'],
          ],
        ],
        [
          'appearance',
          '外觀',
          'select',
          [
            ['dark', '深色'],
            ['light', '淺色'],
            ['system', '跟隨系統'],
          ],
        ],
        ['buttonOpacity', '集數與訂閱按鈕底色', 0, 100, 5, '%'],
        ['headerOpacity', '頁首背景不透明度', 0, 100, 5, '%'],
        ['headerTint', '頁首跟隨影片配色', 0, 100, 5, '%'],
        ['panelOpacity', '彈幕列表背景不透明度', 0, 100, 5, '%'],
        ['panelTint', '彈幕列表跟隨影片配色', 0, 60, 2, '%'],
        ['infoOpacity', '作品資訊背景不透明度', 0, 100, 5, '%'],
        ['relatedOpacity', '相關動畫背景不透明度', 0, 100, 5, '%'],
        ['newsOpacity', '相關新聞背景不透明度', 0, 100, 5, '%'],
        ['commentOpacity', '留言區背景不透明度', 0, 100, 5, '%'],
        ['watchWidth', '劇院最大寬度', 1000, 2200, 40, ' px'],
        ['showDanmu', '顯示旁邊的彈幕列表', 'boolean'],
        ['showDanmuHeat', '顯示彈幕熱度', 'boolean'],
        ['danmuAntiOverlap', '彈幕防重疊排版（等速防追撞）', 'boolean'],
      ],
    },
    {
      name: '品質',
      fields: [
        ['adaptiveQuality', '自動調整光暈畫質', 'boolean'],
        ['renderFloor', '光暈解析度下限', 320, 1280, 160, ' px'],
        [
          'renderWidth',
          '光暈解析度上限',
          'select',
          [
            [640, '640 px · 省電'],
            [960, '960 px'],
            [1280, '1280 px · 均衡'],
            [1600, '1600 px · 清晰'],
            [1920, '1920 px · 高品質'],
          ],
        ],
        [
          'fps',
          '光暈更新率',
          'select',
          [
            [0, '跟隨影片影格（建議）'],
            ...Array.from({ length: 12 }, (_, i) => [
              (i + 1) * 5,
              `上限 ${(i + 1) * 5} fps`,
            ]),
          ],
        ],
        [
          'renderer',
          '繪製方式',
          'select',
          [
            ['auto', '自動 · 優先 WebGL'],
            ['gpu', 'WebGL · 不可用時退回 Canvas'],
            ['canvas', 'Canvas · 相容模式'],
          ],
        ],
      ],
    },
    {
      name: '黑邊',
      fields: [
        ['cropBars', '偵測黑條並避開取樣', 'boolean'],
        ['coverBars', '用光暈覆蓋影片黑條', 'boolean'],
        ['barThreshold', '黑邊亮度門檻', 0, 60, 2, ' / 255'],
        ['cropX', '左右額外取樣裁切', 0, 20, 1, '%'],
        ['cropY', '上下額外取樣裁切', 0, 20, 1, '%'],
      ],
    },
    {
      name: '一般',
      fields: [
        ['hideSidebarAds', '隱藏右側頁面廣告', 'boolean'],
        ['showFootprint', '顯示動畫瘋足跡', 'boolean'],
        ['showWeather', '顯示天氣實況', 'boolean'],
        ['showHomeNews', '顯示首頁新聞', 'boolean'],
        ['showInfo', '顯示作品簡介', 'boolean'],
        ['showRelated', '顯示相關動畫', 'boolean'],
        ['showNews', '顯示相關新聞', 'boolean'],
        ['showMerch', '顯示相關商品', 'boolean'],
        ['showEpisodeDescription', '顯示分集簡介', 'boolean'],
        ['blurEpisodeThumbnails', '模糊分集截圖', 'boolean'],
        ['episodeThumbnailGrid', '六欄縮圖選集（100 集以內）', 'boolean'],
        ['scrollMiniPlayer', '下滑時顯示子母畫面', 'boolean'],
        ['playbackSeekSeconds', '快轉／倒轉秒數', 1, 60, 1, ' 秒'],
        ['spoilerBlurEnabled', '啟用避雷薄碼遮罩（依標籤／關鍵字模糊封面）', 'boolean'],
        ['spoilerBlurTags', '避雷遮罩標籤（以逗號分隔，如 BL,GL,血腥暴力,年齡限制）', 'text'],
        ['spoilerBlurKeywords', '避雷遮罩作品關鍵字（以逗號分隔）', 'text'],
        ['episodeAutoGroup', '長篇集數自動依每 25 集分組折疊（50 集以上）', 'boolean'],
        ['showOffshelfAlert', '收藏與首頁標註即將下架作品提醒', 'boolean'],
      ],
    },
  ];
  const fields = new Map(
    [
      ...groups.flatMap((group) => group.fields),
      ...themeFields,
      ...layoutFields,
      ...contentFields,
    ].map((field) => [field[0], field]),
  );

  // ── 二、選單分類與預設主題 ──
  const categories = [
    {
      id: 'general',
      name: '一般設定',
      description: '首頁與播放頁顯示、避雷與設定備份',
      keys: groups[4].fields.map((f) => f[0]),
    },
    {
      id: 'themes',
      name: '預設主題',
      description: '六種配色，也可自訂重點色',
      keys: [
        'colorTheme',
        'accentHue',
        'accentStrength',
        'customPalette',
        'customBase',
        'customSurface',
        'customSoft',
        'customText',
        'customMuted',
        'customAccent',
      ],
    },
    {
      id: 'light',
      name: '光暈效果',
      description: '延伸方式、亮度與清晰度',
      keys: [
        'method',
        'projectionDepth',
        'radialRoundness',
        'contourStrength',
        'reflectCompression',
        'diffusionDepth',
        'bandWidth',
        'stretchDepth',
        'swirlAmount',
        ...groups[0].fields
          .filter(
            (f) =>
              ![
                'method',
                'smoothing',
                'fadeIn',
                'projectionDepth',
                'radialRoundness',
                'contourStrength',
                'reflectCompression',
                'diffusionDepth',
                'bandWidth',
                'stretchDepth',
                'swirlAmount',
              ].includes(f[0]),
          )
          .map((f) => f[0]),
      ],
    },
    {
      id: 'appearance',
      name: '外觀與字體',
      description: '深淺色、中文字體與閱讀大小',
      keys: [
        'appearance',
        'pageBackgroundMode',
        'pageBackgroundStyle',
        'pageBackgroundImage',
        'fontFamily',
        'customFontName',
        'customFontGoogle',
        'danmuFontEnabled',
        'textSize',
        'textLeading',
      ],
    },
    {
      id: 'surfaces',
      name: '透明度與光暈',
      description: '調整面板不透明度與卡片光暈',
      keys: [
        'settingsOpacity',
        'commentOpacity',
        'footerGlow',
        'cardGlowEnabled',
        'cardGlowIntensity',
      ],
    },
    {
      id: 'layout',
      name: '版面與間距',
      description: '區塊順序、間距與播放器布局',
      keys: [
        ...layoutFields.map((f) => f[0]),
        'watchWidth',
        'sectionSpacing',
        'cornerRadius',
      ],
    },
    {
      id: 'content',
      name: '顯示與收合',
      description: '隱藏資訊、收合集數與留言',
      keys: [
        'showDanmu',
        'showDanmuHeat',
        'danmuAntiOverlap',
        'showComments',
        ...contentFields
          .filter((f) => !f[0].startsWith('show') && f[0] !== 'foldInfo')
          .map((f) => f[0]),
      ],
    },
    {
      id: 'performance',
      name: '流暢度與畫質',
      description: '調整光暈清晰度與更新速度',
      keys: [...groups[2].fields.map((f) => f[0]), 'smoothing', 'fadeIn'],
    },
    {
      id: 'bars',
      name: '影片黑條',
      description: '取樣範圍與可選黑條覆蓋',
      keys: groups[3].fields.map((f) => f[0]),
    },
    {
      id: 'credit',
      name: '關於',
      description: '版本資訊、致謝與檢查更新',
      keys: [],
    },
  ];
  const presets = {
    balanced: {
      label: '自然延伸',
      values: {
        method: 'project',
        intensity: 95,
        radius: 80,
        blur: 20,
        detail: 90,
        saturation: 100,
        contrast: 100,
        backgroundBrightness: 100,
        smoothing: 0,
        renderWidth: 960,
        fps: 60,
        renderer: 'auto',
      },
    },
    clear: {
      label: '清晰畫面',
      values: {
        method: 'contour',
        intensity: 100,
        radius: 100,
        blur: 0,
        detail: 100,
        saturation: 105,
        contrast: 100,
        backgroundBrightness: 100,
        smoothing: 0,
        renderWidth: 1920,
        fps: 60,
        renderer: 'auto',
      },
    },
    soft: {
      label: '柔和色彩',
      values: {
        method: 'diffuse',
        intensity: 65,
        radius: 80,
        blur: 90,
        detail: 15,
        saturation: 115,
        contrast: 100,
        backgroundBrightness: 85,
        smoothing: 0,
        renderWidth: 1280,
        fps: 60,
        renderer: 'auto',
      },
    },
    eco: {
      label: '淡色光暈',
      values: {
        method: 'diffuse',
        intensity: 80,
        radius: 50,
        blur: 35,
        detail: 70,
        saturation: 100,
        contrast: 100,
        backgroundBrightness: 90,
        smoothing: 0,
        renderWidth: 640,
        fps: 30,
        renderer: 'auto',
      },
    },
  };
  // Effect presets change appearance only; performance has its own schemes.
  for (const preset of Object.values(presets))
    for (const key of ['renderWidth', 'fps', 'renderer'])
      delete preset.values[key];
  // Theme presets deliberately leave playback, layout and performance alone.
  const themePresets = {
    cinema: {
      label: '沉浸墨藍',
      description: '墨藍底色，青藍按鈕與連結',
      swatches: ['#0f1621', '#1d2a3d', '#3dafb6'],
      values: {
        appearance: 'dark',
        colorTheme: 'slate',
        accentHue: 185,
        accentStrength: 50,
        commentOpacity: 90,
        textSize: 16,
        textLeading: 175,
        cornerRadius: 12,
      },
    },
    charcoal: {
      label: '低彩石墨',
      description: '低彩灰黑，暖米色重點，適合夜間',
      swatches: ['#161618', '#2a2a2d', '#c6bca9'],
      values: {
        appearance: 'dark',
        colorTheme: 'neutral',
        accentHue: 40,
        accentStrength: 20,
        commentOpacity: 95,
        textSize: 16,
        textLeading: 175,
        cornerRadius: 8,
      },
    },
    paper: {
      label: '暖紙淺色',
      description: '暖紙底色，赤陶重點，適合白天',
      swatches: ['#f6f5f3', '#ece9e4', '#734026'],
      values: {
        appearance: 'light',
        colorTheme: 'paper',
        accentHue: 20,
        accentStrength: 55,
        commentOpacity: 100,
        textSize: 16,
        textLeading: 175,
        cornerRadius: 10,
      },
    },
    forest: {
      label: '森林夜色',
      description: '墨綠底色，灰綠重點色',
      swatches: ['#141a17', '#25312b', '#9fd1b3'],
      values: {
        appearance: 'dark',
        colorTheme: 'forest',
        accentHue: 145,
        accentStrength: 35,
        commentOpacity: 95,
        textSize: 16,
        textLeading: 175,
        cornerRadius: 12,
      },
    },
    violet: {
      label: '暮紫',
      description: '灰紫底色，柔紫按鈕與連結',
      swatches: ['#16141a', '#2a2531', '#b897d8'],
      values: {
        appearance: 'dark',
        colorTheme: 'violet',
        accentHue: 270,
        accentStrength: 45,
        commentOpacity: 95,
        textSize: 16,
        textLeading: 175,
        cornerRadius: 12,
      },
    },
    reading: {
      label: '清楚閱讀',
      description: '較大文字，資訊區不透明',
      swatches: ['#f4f4f6', '#e5e7eb', '#1b4d7e'],
      values: {
        appearance: 'light',
        colorTheme: 'slate',
        accentHue: 210,
        accentStrength: 70,
        commentOpacity: 100,
        textSize: 18,
        textLeading: 190,
        cornerRadius: 8,
      },
    },
  };

  for (const preset of Object.values(themePresets))
    preset.values.customPalette = false;
  // ── 三、輸入驗證：舊設定與匯入檔都只能使用已知欄位 ──
  function normalize(values, base = defaults) {
    const result = { ...base };
    if (!values || typeof values !== 'object' || Array.isArray(values))
      return result;
    if (base === defaults && typeof values.showRelated === 'boolean' && !Object.hasOwn(values, 'showMerch'))
      result.showMerch = values.showRelated;
    for (const key of Object.keys(defaults)) {
      if (!Object.hasOwn(values, key)) continue;
      const field = fields.get(key),
        value = values[key];
      if (typeof defaults[key] === 'boolean') {
        if (typeof value === 'boolean') result[key] = value;
      } else if (field?.[2] === 'select') {
        const choice = field[3].find(([v]) => String(v) === String(value));
        if (choice) result[key] = choice[0];
      } else if (field?.[2] === 'color' && typeof value === 'string') {
        const hex = value.trim().replace(/^#/, '');
        if (/^[0-9a-f]{6}$/i.test(hex)) result[key] = '#' + hex.toLowerCase();
        else if (/^[0-9a-f]{3}$/i.test(hex))
          result[key] =
            '#' +
            [...hex]
              .map((c) => c + c)
              .join('')
              .toLowerCase();
      } else if (key === 'pageBackgroundImage' && typeof value === 'string') {
        try { const url = new URL(value); result[key] = url.protocol === 'https:' ? url.href.slice(0,2048) : ''; } catch { result[key] = ''; }
      } else if (key === 'spoilerBlurTags' || key === 'spoilerBlurKeywords') {
        if (typeof value === 'string') {
          result[key] = value
            .replace(/[，、]/g, ',')
            .slice(0, 300)
            .replace(/[^\p{L}\p{N} ,+\-_.]/gu, '')
            .trim();
        }
      } else if (field?.[2] === 'text' && typeof value === 'string') {
        result[key] = value
          .slice(0, 80)
          .replace(/[^\p{L}\p{N} ._-]/gu, '')
          .trim();
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        const min = field[2],
          max = field[3],
          step = field[4];
        result[key] = Math.min(
          max,
          Math.max(min, min + Math.round((value - min) / step) * step),
        );
      }
    }
    return result;
  }

  // ── 四、共用選單：userscript 和擴充功能使用同一份控制項 ──
  const resetIcon =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 2 9M4 4v6h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const categoryIcons = {
    themes: '<path d="M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 1-4c-1-1 0-2 1-2h2a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z"/><circle cx="7" cy="10" r="1"/><circle cx="10" cy="6" r="1"/><circle cx="15" cy="7" r="1"/>',
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
    appearance: '<path d="M3 19 9 5l6 14M5 15h8m3-5h6m-3 0v9"/>',
    surfaces: '<path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>',
    content: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    performance: '<path d="M4 19a9 9 0 1 1 16 0M12 13l5-5"/><circle cx="12" cy="13" r="2"/>',
    bars: '<path d="M7 3v14h14M3 7h14v14"/>',
    general: '<path d="m9 3-.7 2.4-2.4 1.4-2.4-.6L2 9l1.7 1.8v2.4L2 15l1.5 2.8 2.4-.6 2.4 1.4L9 21h3l.7-2.4 2.4-1.4 2.4.6L19 15l-1.7-1.8v-2.4L19 9l-1.5-2.8-2.4.6-2.4-1.4L12 3Z" transform="translate(1.5 0)"/><circle cx="12" cy="12" r="3"/>',
    credit: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><circle cx="12" cy="8.2" r="0.6" fill="currentColor" stroke="none"/>',
  };
  const categoryIcon = id => `<svg class="ani-settings-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${categoryIcons[id] || categoryIcons.general}</svg>`;
  // 依延伸邏輯分組，避免方法增加後變成難掃讀的單一清單。
  const methodGroups = [
    {
      name: '延伸畫面',
      methods: [
        ['project', '放射投影', '向四周展開畫面。'],
        ['reflect', '邊緣反射', '鏡像延伸，保留細節。'],
        ['stretch', '邊緣拉伸', '拉長外框，細節會變形。'],
        ['swirl', '旋流延伸', '向外漸漸旋轉，形成旋流。'],
      ],
    },
    {
      name: '柔化畫面',
      methods: [
        ['radial', '圓弧擴散', '圓弧散開，柔化四角。'],
        ['diffuse', '柔光擴散', '淡化細節，保留色彩。'],
      ],
    },
    {
      name: '延伸色彩',
      methods: [
        ['contour', '輪廓延展', '延續外框的色彩變化。'],
        ['band', '邊緣光帶', '只留光帶，不複製畫面。'],
      ],
    },
  ];
  function controlsHTML() {
    const fieldControlHTML = (field) => {
      const [key, label, type] = field;
      if (key === 'pageBackgroundStyle') return `<fieldset class="ani-background-picker"><legend>${label}</legend>${field[3].map(([value,name]) => `<button type="button" data-background-choice="${value}" aria-pressed="false"><span class="ani-background-swatch" data-bg-style="${value}"></span><span>${name}</span></button>`).join('')}</fieldset>`;
      if (key === 'pageBackgroundImage') return `<label class="ani-settings-select">${label}<input type="text" maxlength="2048" data-setting="${key}" placeholder="https://…"></label>`;
      if (type === 'color')
        return `<label class="ani-settings-color">${label}<span><input type="color" data-color-picker="${key}" aria-label="挑選${label}"><input type="text" maxlength="7" data-setting="${key}" aria-label="${label}色碼" placeholder="#112233" spellcheck="false"></span></label>`;
      if (type === 'text') {
        const placeholder =
          key === 'spoilerBlurTags'
            ? '例如 BL,GL,血腥暴力,年齡限制'
            : key === 'spoilerBlurKeywords'
              ? '例如 關鍵字1,關鍵字2'
              : '例如 Noto Sans TC';
        const maxLen =
          key === 'spoilerBlurTags' || key === 'spoilerBlurKeywords' ? 300 : 80;
        return `<label class="ani-settings-select">${label}<input type="text" maxlength="${maxLen}" data-setting="${key}" placeholder="${placeholder}"></label>`;
      }
      if (key === 'method') {
        const methods = methodGroups.flatMap((group) => group.methods);
        return (
          '<fieldset class="ani-method-options"><legend>延伸方式</legend><select hidden aria-hidden="true" tabindex="-1" data-setting="method">' +
          methods
            .map(([value, name]) => `<option value="${value}">${name}</option>`)
            .join('') +
          '</select><div class="ani-method-groups">' +
          methodGroups
            .map(
              (group) =>
                `<section class="ani-method-group" aria-label="${group.name}"><h4>${group.name}</h4><div class="ani-method-list">` +
                group.methods
                  .map(
                    ([value, name, description]) =>
                      `<button type="button" data-method-choice="${value}" aria-pressed="false"><span class="ani-method-marker" aria-hidden="true"></span><span><strong>${name}</strong><small>${description}</small></span></button>`,
                  )
                  .join('') +
                '</div></section>',
            )
            .join('') +
          '</div></fieldset>'
        );
      }
      if (type === 'boolean')
        return `<label class="ani-settings-option"><input type="checkbox" role="switch" data-setting="${key}">${label}</label>`;
      if (type === 'select')
        return `<label class="ani-settings-select">${label}<select data-setting="${key}">${field[3].map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>`;
      return `<label class="ani-settings-range">${label}<output data-value="${key}"></output><input type="range" aria-label="${label}" data-setting="${key}" min="${field[2]}" max="${field[3]}" step="${field[4]}"></label>`;
    };
    const fieldHTML = (field) => {
      const resetHtml = field[2] === 'boolean'
        ? ''
        : `<button type="button" class="ani-setting-reset" data-reset-setting="${field[0]}" aria-label="還原${field[1]}的預設值" title="恢復預設">${resetIcon}</button>`;
      return `<div class="ani-setting-row">${fieldControlHTML(field)}${resetHtml}${field[0] === 'customFontGoogle' ? '<div class="ani-settings-help ani-field-help"><p>只在選「自訂字體」時使用。</p><p>填 Google Fonts 的英文名稱，例如 Noto Sans TC。不用貼網址。</p><p>開啟會向 Google 下載字型。</p><p>關閉則使用裝置已安裝的同名字體。找不到時使用系統字體。</p></div>' : ''}</div>`;
    };
    const chevron =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const preset =
      '<label class="ani-settings-select">快速套用<select hidden aria-hidden="true" tabindex="-1" data-preset><option value="custom">自訂</option>' +
      Object.entries(presets)
        .map(
          ([key, preset]) => `<option value="${key}">${preset.label}</option>`,
        )
        .join('') +
      '</select></label><div class="ani-effect-choices" role="group" aria-label="快速套用效果">' +
      Object.entries(presets)
        .map(
          ([key, p]) =>
            `<button type="button" data-effect-choice="${key}" aria-pressed="false">${p.label}</button>`,
        )
        .join('') +
      '</div>';
    const performancePreset =
      '<label class="ani-settings-select">效能方案<select data-performance-preset><option value="custom">自訂</option><option value="smooth">流暢優先（建議）</option><option value="sharp">清晰優先</option><option value="eco">省電</option></select></label><p class="ani-settings-help">只調整光暈，不改影片畫質。負載高時先降低解析度；畫面混合設為 0，可減少拖影。</p>';
    const themes =
      '<div class="ani-theme-presets" role="group" aria-label="預設主題">' +
      Object.entries(themePresets)
        .map(
          ([key, p]) =>
            `<button type="button" data-theme-preset="${key}" aria-pressed="false"><span class="ani-theme-swatches" aria-hidden="true">${p.swatches.map((color) => `<i style="background:${color}"></i>`).join('')}</span><strong>${p.label}</strong><small>${p.description}</small></button>`,
        )
        .join('') +
      '</div><p class="ani-settings-help">套用主題會改變配色、文字大小與透明度。影片排列和光暈速度不會跟著改。</p>';
    const sectionHeadings = {
      general: { showFootprint: '首頁', showInfo: '播放頁', spoilerBlurEnabled: '避雷與提醒' },
      themes: { colorTheme: '自訂配色' },
      light: { intensity: '亮度與色彩', blur: '畫面細節' },
      surfaces: {
        settingsOpacity: '透明度',
        footerGlow: '光暈效果',
      },
      layout: { watchLayout: '分區重排', customWatchWidth: '寬度與間距' },
      content: {
        showDanmu: '顯示哪些資訊',
        focusMode: '快速整理頁面',
        foldRelated: '個別收合按鈕',
        episodeStyle: '集數與留言',
      },
      performance: { adaptiveQuality: '自動畫質', fps: '更新與同步' },
    };
    const backup =
      '<div class="ani-settings-actions">'
      + '<button type="button" class="ani-pill-btn" data-action="reset"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10a8 8 0 1 1 2 9M4 4v6h6"/></svg><span>還原預設</span></button>'
      + '<button type="button" class="ani-pill-btn" data-action="export"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>匯出設定</span></button>'
      + '<button type="button" class="ani-pill-btn" data-action="import"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span>匯入設定</span></button>'
      + '<input type="file" data-import-file accept="application/json,.json" hidden></div>';
    const githubIcon = '<svg aria-hidden="true" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656" /></svg>';
    const greasyForkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 6-6 6 6 6m8-12 6 6-6 6m-2-15-4 18"/></svg>';
    const additionalCredits = [
      ['動畫瘋資訊+', '作品資料與主題曲', 'https://greasyfork.org/zh-TW/scripts/448708-%E5%8B%95%E7%95%AB%E7%98%8B%E8%B3%87%E8%A8%8A', 'Greasy Fork'],
      ['動畫瘋連結 BGM.TV 點格子', '播放頁追番入口', 'https://greasyfork.org/zh-TW/scripts/567535-%E5%8B%95%E7%95%AB%E7%98%8B%E9%80%A3%E7%B5%90-bgm-tv-%E9%BB%9E%E6%A0%BC%E5%AD%90', 'Greasy Fork'],
      ['Bangumi 自動更新觀看進度', '追番進度同步', 'https://greasyfork.org/zh-TW/scripts/567536-bangumi-%E8%87%AA%E5%8B%95%E6%9B%B4%E6%96%B0%E8%A7%80%E7%9C%8B%E9%80%B2%E5%BA%A6', 'Greasy Fork'],
      ['動畫瘋評分顯示', '作品卡片與評分', 'https://greasyfork.org/zh-TW/scripts/470517-%E5%8B%95%E7%95%AB%E7%98%8B%E8%A9%95%E5%88%86%E9%A1%AF%E7%A4%BA', 'Greasy Fork'],
      ['StarMap 評分星圖', '評分顯示與設定', 'https://greasyfork.org/zh-TW/scripts/584454-%E5%8B%95%E6%BC%AB%E7%98%8B-starmap-%E8%A9%95%E5%88%86%E6%98%9F%E5%9C%96', 'Greasy Fork'],
      ['動畫瘋截圖工具', '播放畫面截圖', 'https://greasyfork.org/zh-TW/scripts/388826-%E5%8B%95%E7%95%AB%E7%98%8B-%E6%88%AA%E5%9C%96%E5%B7%A5%E5%85%B7', 'Greasy Fork'],
      ['動畫瘋影片擷圖小工具', '播放器擷圖操作', 'https://greasyfork.org/zh-TW/scripts/420561-%E5%B7%B4%E5%93%88%E5%A7%86%E7%89%B9%E5%8B%95%E7%95%AB%E7%98%8B%E5%BD%B1%E7%89%87%E6%93%B7%E5%9C%96%E5%B0%8F%E5%B7%A5%E5%85%B7', 'Greasy Fork'],
      ['youtube-ambilight', '環境光取樣技術', 'https://github.com/WesselKroos/youtube-ambilight', 'GitHub'],
      ['bilibili-ambilight', '環境光取樣技術', 'https://github.com/iceorange-dev/bilibili-ambilight', 'GitHub'],
      ['OpenCC-JS', '繁體中文轉換', 'https://github.com/nk2028/opencc-js', 'GitHub'],
      ['Animate.css', '介面動態效果', 'https://github.com/animate-css/animate.css', 'GitHub'],
    ].map(([name, description, url, platform]) =>
      `<li><strong>${name}</strong><span>${description}</span><a class="ani-pill-btn ani-pill-sm" href="${url}" target="_blank" rel="noopener noreferrer">${platform === 'GitHub' ? githubIcon : greasyForkIcon}<span>${platform}</span></a></li>`
    ).join('');
    const appVersion = globalThis.chrome?.runtime?.getManifest?.()?.version || globalThis.GM_info?.script?.version || '3.6.0';
    const creditCard =
      '<div class="ani-credit-card">'
      + '<div class="ani-credit-head">'
      + `<div><h4 class="ani-credit-title">動畫瘋沉浸重製版 3.0</h4><p class="ani-credit-sub">Anigamer-Redesign 3.0 · v${appVersion} · MIT</p></div>`
      + '<div class="ani-credit-actions">'
      + '<button type="button" class="ani-pill-btn is-accent" data-action="check-update"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg><span>檢測更新</span></button>'
      + `<a class="ani-pill-btn" href="https://github.com/aunight/Anigamer-Redesign3.0" target="_blank" rel="noopener noreferrer">${githubIcon}<span>GitHub</span></a>`
      + `<a class="ani-pill-btn" href="https://greasyfork.org/zh-TW/scripts/606071" target="_blank" rel="noopener noreferrer">${greasyForkIcon}<span>Greasy Fork</span></a>`
      + '<a class="ani-pill-btn" href="https://github.com/aunight/Anigamer-Redesign3.0/issues" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg><span>前往 Issues</span></a>'
      + '</div></div>'
      + '<p class="ani-credit-update-msg" data-update-status role="status"></p>'
      + '<h4 class="ani-settings-subheading">Credits</h4>'
      + '<ul class="ani-credit-list">'
      + '<li><strong>秋夜 AuNight</strong><span>重製與維護</span><a class="ani-pill-btn ani-pill-sm" href="https://www.aunight.pw/" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><span>官方網站</span></a></li>'
      + `<li><strong>anigamer-ambilight</strong><span>環境光基底</span><a class="ani-pill-btn ani-pill-sm" href="https://github.com/Hinataragi/anigamer-ambilight" target="_blank" rel="noopener noreferrer">${githubIcon}<span>GitHub</span></a></li>`
      + `<li><strong>bilibili-margin</strong><span>首頁足跡＆天氣卡片</span><a class="ani-pill-btn ani-pill-sm" href="https://github.com/jiuyang5354/bilibili-margin" target="_blank" rel="noopener noreferrer">${githubIcon}<span>GitHub</span></a></li>`
      + '<li><strong>Liquid Ripple Shader</strong><span>開場動態波紋特效</span><a class="ani-pill-btn ani-pill-sm" href="https://21st.dev/@saurabh-2607/components/great-ui-liquid-ripple-shader" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><span>21ST</span></a></li>'
      + '<li><strong>Lens Switch</strong><span>深淺模式鏡片開關</span><a class="ani-pill-btn ani-pill-sm" href="https://uberdesigner.ai/t/lens-switch" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><span>uberdesigner</span></a></li>'
      + '<li><strong>動畫瘋·Plus</strong><span>Chrome 擴充版工具列整合</span><a class="ani-pill-btn ani-pill-sm" href="https://xu3u04u48.github.io/Anime_Crazy_Dot_Plus/" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><span>官方網站</span></a></li>'
      + additionalCredits + '</ul></div>';
    return (
      '<div class="ani-settings-home" data-settings-home>' +
      categories
        .map(
          (c) =>
            `<button type="button" class="ani-settings-category" data-category="${c.id}" aria-label="${c.name}"><span><strong>${c.name}</strong><small>${c.description}</small></span>${chevron}</button>`,
        )
        .join('') +
      '</div><div class="ani-settings-detail" data-settings-detail hidden><nav class="ani-settings-rail" aria-label="設定分類">' +
      categories
        .map(
          (c) =>
            `<button type="button" data-category-shortcut="${c.id}">${categoryIcon(c.id)}<span>${c.name}</span></button>`,
        )
        .join('') +
      '</nav><div class="ani-settings-breadcrumb"><button type="button" data-settings-back aria-label="返回設定分類">' +
      chevron +
      '<span>所有設定</span></button><h3 data-category-title></h3><button type="button" class="ani-setting-reset ani-category-reset" data-reset-category aria-label="還原此分類的設定" title="恢復此分類的預設值"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 2 9M4 4v6h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>' +
      categories
        .map(
          (c) =>
            `<section data-settings-page="${c.id}" hidden><div class="ani-settings-fields">${c.id === 'themes' ? themes : ''}${c.id === 'performance' ? performancePreset : ''}${c.id === 'light' ? preset : ''}${c.keys.map((k) => (sectionHeadings[c.id]?.[k] ? `<h4 class="ani-settings-subheading">${sectionHeadings[c.id][k]}</h4>` : '') + fieldHTML(fields.get(k))).join('')}</div>${c.id === 'appearance' ? '<p class="ani-font-preview" data-font-preview>動畫瘋・作品資訊與留言 Aa 123</p><p class="ani-settings-help">頁面文字會使用此字體。影片內建字幕不受影響。</p><p data-font-status class="ani-settings-help" role="status"></p>' : ''}${c.id === 'light' ? '<p class="ani-settings-help">選好效果後，可再調整亮度、範圍和模糊程度。</p>' : ''}${c.id === 'performance' ? '<p class="ani-settings-help" data-render-status role="status">播放影片後顯示渲染狀態。</p>' : ''}${c.id === 'bars' ? '<p class="ani-settings-help">「避開取樣」讓光暈不取用黑條。「覆蓋黑條」則會把光暈畫在黑條上；偵測到字幕或圖案時保留。</p>' : ''}${c.id === 'general' ? backup : ''}${c.id === 'credit' ? creditCard : ''}</section>`,
        )
        .join('') +
      '</div><p class="ani-settings-status" role="status" aria-live="polite"></p>'
    );
  }
  function sync(root, values) {
    for (const picker of root.querySelectorAll('[data-color-picker]'))
      picker.value = values[picker.dataset.colorPicker];
    for (const input of root.querySelectorAll('[data-setting]')) {
      const key = input.dataset.setting;
      if (input.type === 'checkbox') input.checked = Boolean(values[key]);
      else input.value = values[key];
      const output = root.querySelector(`[data-value="${key}"]`);
      if (output) output.value = `${values[key]}${fields.get(key)?.[5] || ''}`;
    }
    for (const button of root.querySelectorAll('[data-method-choice]'))
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.methodChoice === values.method),
      );
    for (const button of root.querySelectorAll('[data-background-choice]')) button.setAttribute('aria-pressed', String(button.dataset.backgroundChoice === values.pageBackgroundStyle));
    const methodKeys = {
      project: 'projectionDepth',
      radial: 'radialRoundness',
      contour: 'contourStrength',
      reflect: 'reflectCompression',
      diffuse: 'diffusionDepth',
      band: 'bandWidth',
      stretch: 'stretchDepth',
      swirl: 'swirlAmount',
    };
    for (const key of Object.values(methodKeys)) {
      const input = root.querySelector(`[data-setting="${key}"]`);
      if (input)
        input.closest('.ani-setting-row').hidden =
          methodKeys[values.method] !== key;
    }
    for (const key of ['foldRelated', 'foldNews']) {
      const input = root.querySelector(`[data-setting="${key}"]`);
      if (input)
        input.closest('.ani-setting-row').hidden = Boolean(
          values.quickCollapse,
        );
    }
    const perf = root.querySelector('[data-performance-preset]');
    if (perf)
      perf.value =
        values.smoothing === 0 &&
        values.fps === 0 &&
        values.renderWidth === 960 &&
        values.renderFloor === 640 &&
        values.adaptiveQuality
          ? 'smooth'
          : values.smoothing === 0 &&
              values.fps === 0 &&
              values.renderWidth === 1600 &&
              values.renderFloor === 960 &&
              values.adaptiveQuality
            ? 'sharp'
            : values.smoothing === 0 &&
                values.fps === 30 &&
                values.renderWidth === 640 &&
                values.renderFloor === 480 &&
                values.adaptiveQuality
              ? 'eco'
              : 'custom';
    const select = root.querySelector('[data-preset]');
    if (select)
      select.value =
        Object.entries(presets).find(([, p]) =>
          Object.entries(p.values).every(
            ([key, value]) => values[key] === value,
          ),
        )?.[0] || 'custom';
    for (const button of root.querySelectorAll('[data-effect-choice]'))
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.effectChoice === select?.value),
      );
    for (const button of root.querySelectorAll('[data-theme-preset]'))
      button.setAttribute(
        'aria-pressed',
        String(
          Object.entries(themePresets[button.dataset.themePreset].values).every(
            ([key, value]) => values[key] === value,
          ),
        ),
      );
    for (const [key, disabled] of [
      ['renderFloor', !values.adaptiveQuality],
      ['watchWidth', !values.customWatchWidth],
      ['danmuWidth', !values.themeEnabled || values.playerLayout === 'native'],
    ]) {
      const control = root.querySelector(`[data-setting="${key}"]`);
      if (control) {
        control.disabled = disabled;
        control
          .closest('.ani-setting-row')
          .classList.toggle('is-disabled', disabled);
      }
    }
  }

  // ── 五、即時套用、鍵盤返回與設定備份 ──
  function wire(root, getValues, update) {
    const status = root.querySelector('.ani-settings-status');
    const report = (text) => {
      status.textContent = text;
    };
    for (const input of root.querySelectorAll(
      '[data-settings-overview] [data-setting]',
    )) {
      const label = input.closest('label');
      const name = label?.querySelector('span')?.textContent;
      // 還原按鈕位於同一列，但不應加入開關的朗讀名稱。
      if (name) input.setAttribute('aria-label', name);
      if (input.type === 'checkbox') continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ani-setting-reset';
      button.dataset.resetSetting = input.dataset.setting;
      button.innerHTML = resetIcon;
      button.title = '恢復預設';
      button.setAttribute('aria-label', `還原${name}的預設值`);
      label.append(button);
    }
    const home = root.querySelector('[data-settings-home]'),
      detail = root.querySelector('[data-settings-detail]');
    let current = '';
    const navigate = (id) => {
      current = id;
      home.hidden = Boolean(id);
      detail.hidden = !id;
      for (const node of root.querySelectorAll('[data-settings-overview]'))
        node.hidden = Boolean(id);
      for (const page of root.querySelectorAll('[data-settings-page]'))
        page.hidden = page.dataset.settingsPage !== id;
      const category = categories.find((item) => item.id === id);
      const page = [...root.querySelectorAll('[data-settings-page]')].find((item) => item.dataset.settingsPage === id);
      const parent = categories.find((item) => item.id === page?.dataset.settingsParent);
      const back = root.querySelector('[data-settings-back]');
      back.querySelector('span').textContent = parent?.name || '所有設定';
      back.setAttribute('aria-label', parent ? `返回${parent.name}` : '返回設定分類');
      for (const item of root.querySelectorAll('[data-category-shortcut]')) {
        if (item.dataset.categoryShortcut === (parent?.id || id))
          item.setAttribute('aria-current', 'page');
        else item.removeAttribute('aria-current');
      }
      root.querySelector('[data-category-title]').textContent = category?.name || page?.getAttribute('aria-label') || '';
      root.querySelector('[data-reset-category]').hidden = !category?.keys.length;
      (root.nodeType === 9
        ? root.scrollingElement || root.documentElement
        : root.querySelector('.ani-settings-scroll') || root
      ).scrollTop = 0;
      status.textContent = '';
      root.dispatchEvent(new CustomEvent('ani-settings-navigate', { detail: id }));
    };
    const navigateBack = () => {
      const previous = current;
      const page = root.querySelector(`[data-settings-page="${previous}"]`);
      navigate(page?.dataset.settingsParent || '');
      root.querySelector(`[data-category="${previous}"]`)?.focus({ preventScroll: true });
    };
    const firstCat = categories[0]?.id || 'general';
    navigate(firstCat);
    root.addEventListener('ani-settings-open', () => navigate(firstCat));
    root.addEventListener('click', (event) => {
      if (event.target.closest('[data-reset-category]')) {
        const category = categories.find((c) => c.id === current);
        if (category) {
          update(
            normalize(
              Object.fromEntries(
                category.keys.map((key) => [key, defaults[key]]),
              ),
              getValues(),
            ),
          );
          report('已恢復此分類的預設值。');
        }
      }
      const effect = event.target.closest('[data-effect-choice]');
      const background = event.target.closest('[data-background-choice]');
      if (background) { update(normalize({pageBackgroundStyle:background.dataset.backgroundChoice,pageBackgroundMode:'fixed'},getValues())); return; }
      if (effect) {
        const select = root.querySelector('[data-preset]');
        select.value = effect.dataset.effectChoice;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const method = event.target.closest('[data-method-choice]');
      if (method) {
        update(normalize({ method: method.dataset.methodChoice }, getValues()));
      }
      const reset = event.target.closest('[data-reset-setting]');
      if (reset) {
        event.preventDefault();
        const key = reset.dataset.resetSetting;
        update(normalize({ [key]: defaults[key] }, getValues()));
        report('已還原此項設定。');
      }
      const theme = event.target.closest('[data-theme-preset]');
      if (theme) {
        const preset = themePresets[theme.dataset.themePreset];
        update(
          normalize({ ...preset.values, uiEffectsEnabled: true }, getValues()),
        );
        report(`已套用「${preset.label}」。`);
      }
      const category = event.target.closest(
        '[data-category], [data-category-shortcut]',
      );
      if (category) {
        navigate(
          category.dataset.category || category.dataset.categoryShortcut,
        );
        if (!category.hasAttribute('data-category-shortcut'))
          root
            .querySelector('[data-settings-back]')
            .focus({ preventScroll: true });
      }
      if (event.target.closest('[data-settings-back]')) {
        navigateBack();
      }
    });
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && current) {
        event.preventDefault();
        event.stopPropagation();
        navigateBack();
      }
    });
    root.addEventListener('input', (event) => {
      const input = event.target,
        key = input.dataset.setting;
      if (input.dataset.colorPicker) {
        update(
          normalize({ [input.dataset.colorPicker]: input.value }, getValues()),
        );
        return;
      }
      if (input.type === 'text') return;
      if (input.matches('[data-performance-preset]')) {
        const schemes = {
          smooth: {
            renderWidth: 960,
            renderFloor: 640,
            adaptiveQuality: true,
            fps: 0,
            smoothing: 0,
          },
          sharp: {
            renderWidth: 1600,
            renderFloor: 960,
            adaptiveQuality: true,
            fps: 0,
            smoothing: 0,
          },
          eco: {
            renderWidth: 640,
            renderFloor: 480,
            adaptiveQuality: true,
            fps: 30,
            smoothing: 0,
          },
        };
        if (schemes[input.value]) {
          update(normalize(schemes[input.value], getValues()));
          report('已套用效能方案。');
        }
        return;
      }
      if (!key) return;
      const value =
        input.type === 'checkbox'
          ? input.checked
          : input.tagName === 'SELECT' || input.type === 'text'
            ? input.value
            : Number(input.value);
      update(normalize({ [key]: value }, getValues()));
    });
    root.addEventListener('change', (event) => {
      const input = event.target;
      if (input.type === 'text' && input.dataset.setting)
        update(
          normalize({ [input.dataset.setting]: input.value }, getValues()),
        );
    });
    root.querySelector('[data-preset]').addEventListener('change', (event) => {
      const preset = presets[event.target.value];
      if (!preset) return;
      update(normalize(preset.values, getValues()));
      report(`已套用「${preset.label}」。`);
    });
    root.querySelector('[data-action="check-update"]')?.addEventListener('click', async () => {
      const msgEl = root.querySelector('[data-update-status]');
      if (!msgEl) return;
      msgEl.textContent = '正在檢測最新版本…';
      const curVer = appVersion;
      const parseVer = (v) => String(v || '').replace(/^v/i, '').split('.').map((n) => Number.parseInt(n, 10) || 0);
      const cmp = (a, b) => {
        const pa = parseVer(a), pb = parseVer(b);
        for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
        return 0;
      };
      try {
        let remoteVer = '';
        let releaseUrl = 'https://github.com/aunight/Anigamer-Redesign3.0/releases';
        const res = await fetch('https://api.github.com/repos/aunight/Anigamer-Redesign3.0/releases/latest', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          remoteVer = data.tag_name || data.name || '';
          if (data.html_url) releaseUrl = data.html_url;
        } else {
          const raw = await fetch('https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/package.json', { cache: 'no-store' });
          if (raw.ok) remoteVer = (await raw.json())?.version || '';
        }
        if (!remoteVer) throw new Error('empty');
        if (cmp(remoteVer, curVer) > 0) {
          msgEl.innerHTML = `發現新版本 ${remoteVer}（目前 v${curVer}）· <a href="${releaseUrl}" target="_blank" rel="noopener noreferrer">前往下載更新</a>`;
        } else {
          msgEl.textContent = `目前已是最新版本（v${curVer}）。`;
        }
      } catch {
        msgEl.innerHTML = `無法連線取得版本資訊 · <a href="https://github.com/aunight/Anigamer-Redesign3.0/releases" target="_blank" rel="noopener noreferrer">手動檢查 GitHub</a>`;
      }
    });
    root
      .querySelector('[data-action="reset"]')
      .addEventListener('click', () => {
        update({ ...defaults });
        report('已還原預設。');
      });
    root
      .querySelector('[data-action="export"]')
      .addEventListener('click', () => {
        const blob = new Blob(
          [
            JSON.stringify(
              {
                format: 'anigamer-ambilight',
                version: 1,
                scriptVersion: '1.0.0',
                settings: normalize(getValues()),
              },
              null,
              2,
            ),
          ],
          { type: 'application/json' },
        );
        const url = URL.createObjectURL(blob),
          link = document.createElement('a');
        link.href = url;
        link.download = 'anigamer-ambilight-settings.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        report('已匯出設定。');
      });
    const fileInput = root.querySelector('[data-import-file]');
    root
      .querySelector('[data-action="import"]')
      .addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        if (file.size > 100000) throw new Error('檔案太大');
        const data = JSON.parse(await file.text());
        if (
          !Number.isInteger(data.version) ||
          data.version < 1 ||
          (data.format && data.format !== 'anigamer-ambilight') ||
          !data.settings ||
          !Object.keys(data.settings).some((key) =>
            Object.hasOwn(defaults, key),
          )
        )
          throw new Error('格式不符');
        // 缺少的新欄位補預設，未知欄位不執行；舊檔的 version: 1 仍可匯入。
        update(normalize(data.settings));
        report('已匯入設定。');
      } catch {
        report('無法匯入，請選擇本工具匯出的 JSON 設定檔。');
      }
      fileInput.value = '';
    });
  }
  globalThis.AniAmbientSettings = {
    defaults,
    normalize,
    controlsHTML,
    sync,
    wire,
    themePresets,
  };
})();
