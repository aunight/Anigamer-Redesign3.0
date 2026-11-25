// ==UserScript==
// @name         動畫瘋沉浸重製版 3.0｜Anigamer-Redesign 3.0
// @namespace    https://ani.gamer.com.tw/ani-ambientlight
// @author       秋夜
// @version      3.5.0
// @description  動畫瘋環境光與沉浸重製介面：毛玻璃播放器、開場液態波紋、首頁足跡熱力圖＆天氣實況（靈感改作自 Hinataragi/anigamer-ambilight、jiuyang5354/bilibili-margin 與 GreatUI）。非官方。
// @homepageURL  https://github.com/aunight/Anigamer-Redesign3.0
// @supportURL   https://github.com/aunight/Anigamer-Redesign3.0/issues
// @downloadURL  https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/userscript/ani-ambilight.user.js
// @updateURL    https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/userscript/ani-ambilight.meta.js
// @license      MIT
// @match        https://ani.gamer.com.tw/*
// @run-at       document-start
// @inject-into  content
// @require      https://cdn.jsdelivr.net/npm/opencc-js@1.4.2/dist/umd/cn2t.js
// @resource     ani_catalog https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/484787e7a03b376962b08cbb64566c915a075059/src/studio-catalog.json
// @resource     ani_profiles https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/484787e7a03b376962b08cbb64566c915a075059/src/studio-profiles.json
// @resource     ani_directory_icons https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/484787e7a03b376962b08cbb64566c915a075059/src/studio-directory-icons.json
// @resource     ani_logos https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/484787e7a03b376962b08cbb64566c915a075059/src/studio-logos.json
// @resource     ani_content_css https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/484787e7a03b376962b08cbb64566c915a075059/src/content.css
// @resource     ani_effects_css https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/484787e7a03b376962b08cbb64566c915a075059/src/effects.css
// @resource     ani_settings_css https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/484787e7a03b376962b08cbb64566c915a075059/src/settings-ui.css
// @resource     ani_hero_css https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/484787e7a03b376962b08cbb64566c915a075059/src/hero-banner.css
// @resource     ani_dashboard_css https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/484787e7a03b376962b08cbb64566c915a075059/src/home-dashboard.css
// @resource     ani_repairs_css https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/484787e7a03b376962b08cbb64566c915a075059/src/ui-repairs.css
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
// @connect      api.aniskip.com
// @connect      api.mymemory.translated.net
// @connect      www.aniplex.co.jp
// @connect      www.youtube.com
// @connect      myanimelist.net
// @connect      api.gamer.com.tw
// @connect      bahamut.akamaized.net
// @connect      wall.gamer.com.tw
// @connect      api.open-meteo.com
// @connect      geocoding-api.open-meteo.com
// @connect      ipwho.is
// @grant        GM_addStyle
// @grant        GM_getResourceText
// ==/UserScript==
