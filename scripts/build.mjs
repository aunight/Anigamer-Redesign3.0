import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const { format } = await import('prettier');
const source = path.join(root, 'src');
const out = path.join(root, 'dist');
// Pin non-executable userscript resources to the exact committed source.
// Push this commit before distributing the resulting userscript.
const resourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const externalResources = {
  ani_catalog: 'studio-catalog.json',
  ani_profiles: 'studio-profiles.json',
  ani_directory_icons: 'studio-directory-icons.json',
  ani_logos: 'studio-logos.json',
  ani_content_css: 'content.css',
  ani_effects_css: 'effects.css',
  ani_settings_css: 'settings-ui.css',
  ani_hero_css: 'hero-banner.css',
  ani_dashboard_css: 'home-dashboard.css',
  ani_repairs_css: 'ui-repairs.css',
};
for (const file of Object.values(externalResources)) {
  if (file === 'ui-repairs.css') continue;
  const committed = execFileSync('git', ['show', `${resourceRevision}:src/${file}`], { cwd: root, maxBuffer: 10 * 1024 * 1024 });
  const normalize = bytes => bytes.toString('utf8').replaceAll('\r\n', '\n');
  if (normalize(committed) !== normalize(fs.readFileSync(path.join(source, file)))) {
    throw new Error(`Userscript resource src/${file} differs from HEAD; commit it before building.`);
  }
}
// Preserve local edits without publishing them: apply the readable line changes
// to the pinned stylesheet obtained from the installed resource.
const repairsBase = execFileSync('git', ['show', `${resourceRevision}:src/ui-repairs.css`], { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).replaceAll('\r\n', '\n');
const repairsLocal = fs.readFileSync(path.join(source, 'ui-repairs.css'), 'utf8').replaceAll('\r\n', '\n');
const repairsDiff = execFileSync('git', ['diff', '--no-color', '--no-ext-diff', '--unified=0', 'HEAD', '--', 'src/ui-repairs.css'], { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
const repairsChanges = [];
for (const line of repairsDiff.split('\n')) {
  const hunk = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/.exec(line);
  if (hunk) {
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    repairsChanges.push([Number(hunk[1]) - (count ? 1 : 0), count, []]);
  } else if (repairsChanges.length && line.startsWith('+') && !line.startsWith('+++')) {
    repairsChanges.at(-1)[2].push(line.slice(1).replace(/\r$/, ''));
  }
}
const verifyRepairs = repairsBase.split('\n');
for (const [start, count, added] of [...repairsChanges].reverse()) verifyRepairs.splice(start, count, ...added);
if (verifyRepairs.join('\n') !== repairsLocal) throw new Error('Unable to preserve local ui-repairs.css changes in userscript.');
const version = JSON.parse(
  fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'),
).version;
const animateRoot = path.join(root,'node_modules','animate.css');
const animateLicense = fs.readFileSync(path.join(animateRoot,'LICENSE'),'utf8');
const motionCss = `/*! Animate.css 4.1.1 | https://animate.style/\n${animateLicense.replaceAll('*/','* /')}*/\n` +
  ['_vars.css','_base.css','fading_entrances/fadeIn.css','fading_exits/fadeOut.css']
    .map(file=>fs.readFileSync(path.join(animateRoot,'source',file),'utf8').replace(/\.([a-z][\w-]*)/g,'.animate__$1')).join('\n');
fs.writeFileSync(path.join(source,'motion.css'),motionCss);
const blackBars = fs.readFileSync(path.join(source, 'black-bars.js'), 'utf8');
const entryCss = motionCss + '\n' + fs.readFileSync(path.join(source, 'page-entry.css'), 'utf8');
const favicon = 'data:image/png;base64,' + fs.readFileSync(path.join(source, 'icon-32.png')).toString('base64');
const entryScript = fs.readFileSync(path.join(source, 'page-entry.js'), 'utf8')
  .replace('__ANI_FAVICON_URL__', favicon);
const renderer = fs.readFileSync(
  path.join(source, 'ambient-renderer.js'),
  'utf8',
);
const workOrigin = fs.readFileSync(path.join(source, 'work-origin.js'), 'utf8');
const episodeData = fs.readFileSync(path.join(source, 'episode-data.js'), 'utf8');
const opencc = fs.readFileSync(path.join(root, 'node_modules/opencc-js/dist/umd/cn2t.js'), 'utf8');
const studioCatalog = fs.readFileSync(path.join(source, 'studio-catalog.js'), 'utf8')
  .replace('STUDIO_CATALOG_DATA', () => fs.readFileSync(path.join(source, 'studio-catalog.json'), 'utf8'))
  .replace('STUDIO_PROFILE_DATA', () => fs.readFileSync(path.join(source, 'studio-profiles.json'), 'utf8'))
  .replace('STUDIO_DIRECTORY_ICON_DATA', () => fs.readFileSync(path.join(source, 'studio-directory-icons.json'), 'utf8'))
  .replace('STUDIO_LOGO_DATA', () => fs.readFileSync(path.join(source, 'studio-logos.json'), 'utf8'));
const userscriptStudioCatalog = fs.readFileSync(path.join(source, 'studio-catalog.js'), 'utf8')
  .replace('STUDIO_CATALOG_DATA', "JSON.parse(GM_getResourceText('ani_catalog'))")
  .replace('STUDIO_PROFILE_DATA', "JSON.parse(GM_getResourceText('ani_profiles'))")
  .replace('STUDIO_DIRECTORY_ICON_DATA', "JSON.parse(GM_getResourceText('ani_directory_icons'))")
  .replace('STUDIO_LOGO_DATA', "JSON.parse(GM_getResourceText('ani_logos'))");
const core = studioCatalog + "\n" + workOrigin + "\n" + opencc + "\n;" + episodeData + "\n" +
  fs.readFileSync(path.join(source, 'hero-banner.js'), 'utf8') +
  '\n' +
  fs.readFileSync(path.join(source, 'home-dashboard.js'), 'utf8') +
  '\n' +
  fs.readFileSync(path.join(source, 'lens-switch.js'), 'utf8') +
  '\n' +
  fs.readFileSync(path.join(source, 'topbar-bridge.js'), 'utf8') +
  '\n' +
  fs.readFileSync(path.join(source, 'content.js'), 'utf8') +
  '\n' +
  fs.readFileSync(path.join(source, 'enhancements.js'), 'utf8');
const membershipBackground='data:image/png;base64,'+fs.readFileSync(path.join(source,'membership-background.png')).toString('base64');
const settingsModule = fs.readFileSync(
  path.join(source, 'settings.js'),
  'utf8',
);
const key = 'aniAmbientSettingsV1';
fs.mkdirSync(out, { recursive: true });
const bridge = `
const listeners=new Set();
let cached={};
const emit=(oldValue,newValue)=>{
  const changes={};
  for(const key of Object.keys(newValue))if(oldValue[key]!==newValue[key])changes[key]={oldValue:oldValue[key],newValue:newValue[key]};
  for(const listener of listeners)listener(changes,'sync');
};
globalThis.AniAmbientStorage={
  get(defaults,callback){Promise.resolve(GM_getValue('${key}',{})).then(saved=>{cached={...defaults,...saved};callback(cached);});},
  set(values){const before=cached;cached={...cached,...values};Promise.resolve(GM_setValue('${key}',cached)).then(()=>emit(before,cached));},
  onChanged:{addListener(listener){listeners.add(listener);}}
};
if(typeof GM_addValueChangeListener==='function')GM_addValueChangeListener('${key}',(_key,oldValue,newValue,remote)=>{if(remote){cached=newValue||{};emit(oldValue||{},cached);}});
`;
const metadata = `// ==UserScript==
// @name         動畫瘋沉浸重製版 3.0｜Anigamer-Redesign 3.0
// @namespace    https://ani.gamer.com.tw/ani-ambientlight
// @author       秋夜
// @version      ${version}
// @description  動畫瘋環境光與沉浸重製介面：毛玻璃播放器、開場液態波紋、首頁足跡熱力圖＆天氣實況（靈感改作自 Hinataragi/anigamer-ambilight、jiuyang5354/bilibili-margin 與 GreatUI）。非官方。
// @homepageURL  https://github.com/aunight/Anigamer-Redesign3.0
// @supportURL   https://github.com/aunight/Anigamer-Redesign3.0/issues
// @downloadURL  https://github.com/aunight/Anigamer-Redesign3.0/releases/latest/download/anigamer-redesign3.0.user.js
// @updateURL    https://github.com/aunight/Anigamer-Redesign3.0/releases/latest/download/anigamer-redesign3.0.user.js
// @license      MIT
// @match        https://ani.gamer.com.tw/*
// @run-at       document-start
// @inject-into  content
// @require      https://cdn.jsdelivr.net/npm/opencc-js@1.4.2/dist/umd/cn2t.js
${Object.entries(externalResources).map(([name, file]) => `// @resource     ${name} https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/${resourceRevision}/src/${file}`).join('\n')}
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      truth.bahamut.com.tw
// @connect      gnn.gamer.com.tw
// @connect      p2.bahamut.com.tw
// @connect      i2.bahamut.com.tw
// @connect      acg.gamer.com.tw
// @connect      cal.syoboi.jp
// @connect      ja.wikipedia.org
// @connect      api.bgm.tv
// @connect      graphql.anilist.co
// @connect      myanimelist.net
// @connect      api.gamer.com.tw
// @connect      wall.gamer.com.tw
// @connect      api.open-meteo.com
// @connect      geocoding-api.open-meteo.com
// @connect      ipwho.is
// @grant        GM_addStyle
// @grant        GM_getResourceText
// ==/UserScript==
`;
const license = fs.readFileSync(path.join(source, 'LICENSE'), 'utf8') + '\n' + fs.readFileSync(path.join(source, 'LICENSE.bilibili-margin'), 'utf8') + '\n' + fs.readFileSync(path.join(source, 'FONT-AWESOME-NOTICE.txt'), 'utf8');
// 保留多行 CSS，讓安裝後的完整腳本也能閱讀與修改。
const styleLiteral =
  '`' +
  fs.readFileSync(path.join(source, 'enhancements.css'), 'utf8').replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${') +
  '`';
const userscriptCore = core.replace(studioCatalog, userscriptStudioCatalog).replace(opencc, '');
// Keep a stable DOM marker so installed scripts replace the older local
// preview on this development browser, instead of running two renderers.
const legacyGuard = `const reserve=()=>{if(!document.documentElement)return false;const marker=document.createElement('meta');marker.name='anigamer-ambilight-userscript';marker.dataset.aniPreview='installed';marker.dataset.aniV1='installed';document.documentElement.append(marker);return true;};if(!reserve()){const observer=new MutationObserver(()=>{if(reserve())observer.disconnect();});observer.observe(document,{childList:true,subtree:true});}`;
const bundled =
  metadata +
  `\n/* Inspired by WesselKroos/youtube-ambilight and iceorange-dev/bilibili-ambilight.\nhttps://github.com/WesselKroos/youtube-ambilight\nhttps://github.com/iceorange-dev/bilibili-ambilight\n${license}\n*/\n(()=>{\n'use strict';\n// 一、避免與舊版開發預覽重複執行\n${legacyGuard}\nGM_addStyle(${JSON.stringify(entryCss)});\n${entryScript}\nconst start=()=>{\n// 二、使用者設定儲存\n${bridge}\n// 三、主題與設定介面樣式\nconst repairsLines=GM_getResourceText('ani_repairs_css').replaceAll('\\r\\n','\\n').split('\\n');\nfor(const [start,count,added] of ${JSON.stringify(repairsChanges)}.reverse()) repairsLines.splice(start,count,...added);\nGM_addStyle(['ani_content_css','ani_effects_css','ani_settings_css','ani_hero_css','ani_dashboard_css'].map(name => GM_getResourceText(name)).join('\\n') + '\\n' + repairsLines.join('\\n') + '\\n' + ${styleLiteral});\n// 四、設定定義與表單\n${settingsModule}\n// 五、黑條辨識\n${blackBars}\n// 六、光暈渲染\n${renderer}\n// 七、頁面整合與生命週期\n${userscriptCore.replaceAll('__ANI_MEMBERSHIP_BACKGROUND__',membershipBackground)}\nGM_registerMenuCommand('設定',()=>document.querySelector('.ani-view-settings')?.click());\n};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();\n})();\n`;
const formattedUserscript = await format(bundled, {
    parser: 'babel',
    singleQuote: true,
    printWidth: 100,
  });
if (Buffer.byteLength(formattedUserscript, 'utf8') > 2_000_000) {
  throw new Error('Userscript exceeds Greasy Fork’s 2 MB limit.');
}
fs.writeFileSync(path.join(out, 'ani-ambilight.user.js'), formattedUserscript);

const extension = path.join(out, 'extension');
fs.mkdirSync(extension, { recursive: true });
for (const file of [
  'motion.css',
  'page-entry.js',
  'page-entry.css',
  'manifest.json',
  'settings.js',
  'black-bars.js',
  'ambient-renderer.js',
  'content.js',
  'topbar-bridge.js',
  'hero-banner.js',
  'hero-banner.css',
  'home-dashboard.js',
  'home-dashboard.css',
  'lens-switch.js',
  'ui-repairs.css',
  'enhancements.js',
  'enhancements.css',
  'hero-cache-worker.js',
  'content.css',
  'effects.css',
  'settings-ui.css',
  'popup.html',
  'popup.js',
  'popup.css',
  'icon-16.png',
  'icon-32.png',
  'icon-48.png',
  'icon-128.png',
  'membership-background.png',
  'FONT-AWESOME-NOTICE.txt',
  'LICENSE.youtube-ambilight',
  'LICENSE.bilibili-ambilight',
  'LICENSE.bilibili-margin',
  'LICENSE',
])
  fs.copyFileSync(path.join(source, file), path.join(extension, file));
fs.writeFileSync(path.join(extension, 'studio-catalog.js'), studioCatalog);
fs.writeFileSync(path.join(extension, 'opencc.js'), opencc);
fs.writeFileSync(path.join(extension, 'hero-cache-worker.js'), workOrigin + '\n' + episodeData + '\n' + fs.readFileSync(path.join(source, 'hero-cache-worker.js'), 'utf8'));
fs.cpSync(path.join(root, 'node_modules/opencc-js/LICENSES'), path.join(extension, 'opencc-licenses'), { recursive: true });
// Firefox 暫時載入版共用原始碼，僅調整瀏覽器專用的 manifest 欄位。
const firefox = path.join(out, 'extension-firefox');
fs.cpSync(extension, firefox, { recursive: true });
const firefoxManifest = JSON.parse(
  fs.readFileSync(path.join(firefox, 'manifest.json'), 'utf8'),
);
delete firefoxManifest.minimum_chrome_version;
delete firefoxManifest.version_name;
firefoxManifest.background = { scripts: ['hero-cache-worker.js'] };
firefoxManifest.browser_specific_settings = {
  gecko: {
    id: 'anigamer-ambilight@hinataragi',
    strict_min_version: '128.0',
    data_collection_permissions: { required: ['none'] },
  },
};
fs.writeFileSync(
  path.join(firefox, 'manifest.json'),
  JSON.stringify(firefoxManifest, null, 2),
);
console.log(
  'Built userscript, Chromium extension and Firefox temporary extension.',
);
