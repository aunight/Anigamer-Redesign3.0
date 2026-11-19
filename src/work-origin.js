function parseBahamutWorkOrigin(html) {
  const origin = html.match(/原作性質[：:]\s*([^<（(]+)/)?.[1]?.trim() || '';
  if (!origin) return null;
  const source = /輕小說|ライトノベル/.test(origin) ? 'light_novel'
    : /漫畫|漫画/.test(origin) ? 'manga'
    : /遊戲|游戏/.test(origin) ? 'game'
    : /原創|原创/.test(origin) ? 'original' : 'other';
  return { source, isShort: /泡麵番|輕動畫|短篇動畫/.test(html.match(/作品類型[：:]\s*([^<]+)/)?.[1] || '') };
}
