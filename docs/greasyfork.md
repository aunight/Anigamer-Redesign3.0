# 動畫瘋重製版 3.0

由 [**秋夜**](https://www.aunight.pw) 主導維護，為 [巴哈姆特動畫瘋](https://ani.gamer.com.tw/) 打造的沉浸式暗色玻璃擬態（Glassmorphism）與即時環境光（Ambilight）介面重製腳本。

> ⚠️ **測試版本說明**：本版本仍在測試與調整中，有任何問題歡迎[提 Issue](https://github.com/aunight/Anigamer-Redesign3.0/issues)。

![動畫瘋重製版 3.0 首頁預覽](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/preview-home-20261120.jpg)

---

## ✨ 主要特色

### 1. 即時環境光與現代化播放器（v3.0.3）
- **即時動態環境光**：於播放器背後即時採樣影片畫面色彩並渲染柔和環境光暈，支援 16:9／4:3 黑邊偵測、低動作減弱設定，以及更流暢的播放器轉場過渡。
- **膠囊控制列與互動優化**：彈幕輸入欄始終保持中央固定對齊，音量調整與 hover 不位移；彈幕設定選單移開滑鼠、點擊空白處或關閉彈幕時自動收合；支援同步「動畫瘋·Plus」彈幕熱度圖開關。
- **全螢幕／劇院模式快速選集、串流平台風單集縮圖卡片與快轉秒數**：控制列環境光鈕旁新增「選集」按鈕，於一般、劇院及全螢幕模式下皆可隨時滑出抽屜切換章節與集數；選集抽屜與下方集數區皆採用類似 Netflix 等串流平台的單集大卡片設計，顯示**單集縮圖預覽、副標題簡介、觀看進度條／已看／播放中標記、片長、觀看數與上架日期，甚至連尚未上架的下一集也會先預告顯示「即將更新」與預計上架時間**，並提供正序／倒序切換；進度條右上方新增**快速倒退／快轉秒數按鈕**；全螢幕頂部左側顯示作品大標題（超長自動陰影跑馬燈）、頂部中央膠囊顯示 `EP.x` 與目前單集副標題。
- **頁面內懸浮子母畫面（Mini Player）**：向下捲動查看集數、留言或相關動畫時，右下角自動浮現懸浮子母畫面小窗，可隨時返回主播放器或關閉，邊看邊逛不中斷。
- **長篇集數折疊、單集標題提示與下架提醒**：集數預設顯示一排，可點箭頭展開；啟用自動分組後，50 集以上的作品可按每 25 集切換區間或選擇「全部」。滑鼠移至集數按鈕可查看單集副標題與放送日期；自動偵測即將下架公告並顯示剩餘天數提醒。
- **獨立音軌展開與劇院模式統一**：多音軌／雙語版本各自獨立展開集數不互干擾；修正劇院模式底色滲漏，並將「消音／檢舉／分享」對話框與複製提示統一為半透明暗色毛玻璃與膠囊按鈕。

### 2. 觀看頁資訊側欄整合與彈幕強化工具列
- **三合一側欄分段分頁**：將「彈幕列表｜作品簡介｜作品評分」整併於播放器右側邊欄，保留個人已評分星數與評分分佈統計，並自動隱藏下方重複佔位的區塊，減少捲動干擾。
- **彈幕列表強化工具列**：頂部內嵌毛玻璃工具列，提供「搜尋彈幕或發送者」、多維排序（動畫時間／彈幕長度／發送時間）、本地單一發送者消音與人數管理清單（hover 人名顯示單筆解除），以及一鍵重新載入彈幕按鈕。
- **統一展開式工具列與推薦動畫／留言區**：將「播放器進階設定」與「動畫瘋·Plus」收整至上方／左側同一排玻璃工具列中，平日僅顯示純白圖示，滑鼠懸停才展開文字標籤，點開後以雙欄 Bento 排版呈現；留言區旁顯示「推薦動畫」側欄，輸入框與送出按鈕置右對齊不裁切。
- **標題動作列整合**：自動偵測並整併訂閱、追蹤狀態標記（待看／追番中／已看完／暫停）、作品資料、哈啦板、分享與「BGM.TV 點格子」按鈕。

### 3. 全站頁面全面現代化（包含付費／會員／搜尋／片庫／紀錄）
- **全站頁面統一重製**：全面現代化動畫瘋所有頁面，涵蓋**首頁、播放頁、所有動畫片庫、我的動畫、觀看紀錄、搜尋結果頁，以及付費方案與序號兌換／會員狀態頁面**（專屬漸層會員背景卡片、非同步方案載入、保留原生操作與自訂序號兌換彈窗），全站一致採用暗色玻璃擬態、膠囊按鈕與滑順進場／切換動效。
- **首頁 Banner、觀影足跡與點陣天氣**：補全並置中英雄輪播主視覺與預覽封面、52 週動畫瘋觀影足跡熱力圖＆點陣天氣實況卡片（可於設定中獨立開關）、新番時間軸配色區分與週期表平滑展開。
- **所有動畫片庫增強（`/animeList.php`）**：
  - **反向排除標籤與關鍵字排除**：完整支援「屬性」全部標籤（含 BL、GL、獵奇等）一鍵負向排除，搭配逗號分隔關鍵字排除與即時已排除部數統計。
  - **原作／型態分類篩選**：支援「全部／漫畫改編／輕小說改編／遊戲改編／原創動畫／輕動畫／泡麵番」一鍵切換（背景預載快取、切換流暢），卡片左上角顯示原作分類標籤。
  - **下滑載入與季度篩選**：片庫支援下滑載入、年份與季度組合篩選及評分排序；「當前季番」顯示當前年份和季度，換季時自動更新。
- **製作公司／動畫工作室專區**：整合熱門製作組、工作室搜尋、圖示與作品列表，也可收藏製作組，從「我的動畫」查看收藏的製作組及其作品。
- **我的動畫（`/mygather.php`）**：支援年份、季度、搜尋、屬性及原作分類等組合篩選；收藏狀態可依觀看進度自動分類，也可手動標記待看、追番中、已看完或暫停。
- **願望清單**：使用直式動畫卡片呈現作品，可透過卡片上的投票按鈕選出想看的動畫。
- **觀看紀錄（`/viewList.php`）**：
  - 右上分段膠囊可切換「官方觀看紀錄／永久本地紀錄」（自動於本機永久備份觀看進度、不受官方 180 天限制，支援觀看狀態篩選、搜尋、JSON 匯出／匯入與雙擊確認清空）；
  - 依觀看月份（`YYYY年M月`）分組顯示，卡片統一對齊 2:3 直式封面、評分、觀看時間、集數進度條與單集紀錄流暢展開／收縮動畫。
- **避雷遮罩（防劇透封面模糊）**：右上 Switch 快速開關，支援指定標籤、關鍵字或全站封面模糊遮蔽，點擊「顯示封面」單獨查看或再次隱藏。
- **評分設定整合**：安裝相容的評分顯示腳本後，可在重製版設定中調整評分顯示、排序與相關選項。

---

## 🧩 第三方油猴腳本深度相容 & 批次安裝

本腳本已針對下列常用油猴腳本進行介面融合與排版最佳化：

- **功能增強／截圖工具**：
  - **動畫瘋·Plus Chrome 擴充版**提供截圖、錄影與影像融合，重製版會整合工具列、截圖預覽與設定抽屜。[擴充版官方安裝頁](https://xu3u04u48.github.io/Anime_Crazy_Dot_Plus/)
  - **動畫瘋·Plus Greasy Fork 腳本版**提供自動接續下一集、空降座標等播放輔助，重製版會整合設定抽屜。Plus 作者建議兩個版本擇一啟用。[Greasy Fork 腳本版](https://greasyfork.org/zh-TW/scripts/369990)
  - [動畫瘋 - 截圖工具](https://greasyfork.org/zh-TW/scripts/388826-%E5%8B%95%E7%95%AB%E7%98%8B-%E6%88%AA%E5%9C%96%E5%B7%A5%E5%85%B7)
  - [巴哈姆特動畫瘋影片擷圖小工具](https://greasyfork.org/zh-TW/scripts/420561-%E5%B7%B4%E5%93%88%E5%A7%86%E7%89%B9%E5%8B%95%E7%95%AB%E7%98%8B%E5%BD%B1%E7%89%87%E6%93%B7%E5%9C%96%E5%B0%8F%E5%B7%A5%E5%85%B7)
- **聲優／主題曲資料整合**：
  - [動畫瘋資訊+](https://greasyfork.org/zh-TW/scripts/448708-%E5%8B%95%E7%95%AB%E7%98%8B%E8%B3%87%E8%A8%8A)（整合進右側「作品簡介」分頁並將 Wiki／YouTube 轉換為向量圖示按鈕）
- **評分顯示與星圖分析**：
  - [動畫瘋評分顯示](https://greasyfork.org/zh-TW/scripts/470517-%E5%8B%95%E7%95%AB%E7%98%8B%E8%A9%95%E5%88%86%E9%A1%AF%E7%A4%BA)
  - [[動漫瘋] StarMap - 評分星圖](https://greasyfork.org/zh-TW/scripts/584454-%E5%8B%95%E6%BC%AB%E7%98%8B-starmap-%E8%A9%95%E5%88%86%E6%98%9F%E5%9C%96)
- **Bangumi (BGM.TV) 追番進度連動**：
  - [動畫瘋連結 BGM.TV 點格子](https://greasyfork.org/zh-TW/scripts/567535-%E5%8B%95%E7%95%AB%E7%98%8B%E9%80%A3%E7%B5%90-bgm-tv-%E9%BB%9E%E6%A0%BC%E5%AD%90)
  - [Bangumi 自動更新觀看進度](https://greasyfork.org/zh-TW/scripts/567536-bangumi-%E8%87%AA%E5%8B%95%E6%9B%B4%E6%96%B0%E8%A7%80%E7%9C%8B%E9%80%B2%E5%BA%A6)

> 💡 **一鍵批次安裝附加腳本**：不想一個一個手動點開嗎？可使用我們準備的 [**附加腳本批次安裝頁面**](https://htmlpreview.github.io/?https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/plugins.html)（勾選需要的腳本後按「一鍵依序開啟安裝頁」，Tampermonkey／Violentmonkey 將自動逐一彈出安裝確認；需允許瀏覽器開啟多個分頁彈窗）。

---

## 🖼️ 實機畫面預覽

### 首頁足跡、天氣與新番時間軸
![首頁主視覺與新版版面](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/01-home-hero.jpg)
![首頁足跡熱力圖與點陣天氣](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/19-home-heatmap-weather.jpg)

### 播放器與追番體驗
- **即時環境光 & 單集大卡片（含即將更新）**  
  ![即時環境光](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/02-ambilight-player.jpg)  
  ![單集大卡片](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/03-episode-cards.jpg)
- **全螢幕抬頭、快速選集抽屜與控制列快轉按鈕**  
  ![全螢幕抬頭與選集](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/04-fullscreen-hud-1.jpg)  
  ![全螢幕控制列與快轉按鈕](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/05-fullscreen-hud-2.jpg)
- **懸浮子母畫面（Mini Player）**  
  ![懸浮子母畫面](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/06-floating-pip.jpg)
- **長篇集數折疊與下架提醒**  
  ![長篇集數折疊](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/07-episode-grouping-1.jpg)  
  ![下架提醒](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/08-episode-grouping-2.jpg)
- **彈幕列表、右側欄三合一、留言區與新版分享模塊**  
  ![側邊欄預覽 1](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/09-sidebar-1.jpg)  
  ![側邊欄預覽 2](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/10-sidebar-2.jpg)  
  ![側邊欄預覽 3](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/11-sidebar-3.jpg)  
  ![側邊欄預覽 4](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/12-sidebar-4.jpg)  
  ![側邊欄預覽 5](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/13-sidebar-5.jpg)

### 片庫目錄、製作組、追番狀態、觀看紀錄與全站頁面
- **所有動畫片庫（排除標籤與原作分類） & 製作組動畫頁面**  
  ![片庫排除標籤與原作分類](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/20-catalog-filters.jpg)  
  ![製作組動畫頁面](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/21-studio-catalog.jpg)
- **我的動畫追番狀態 & 永久本地觀看紀錄**  
  ![我的動畫追番狀態 1](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/22-collection-status-1.jpg)  
  ![我的動畫追番狀態 2](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/23-collection-status-2.jpg)  
  ![永久本地觀看紀錄](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/24-watch-history.png)
- **全站頁面、付費方案與序號兌換**  
  ![全站頁面 1](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/14-site-pages-1.jpg)  
  ![全站頁面 2](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/15-site-pages-2.jpg)  
  ![全站頁面 3](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/16-site-pages-3.png)  
  ![全站頁面 4](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/17-site-pages-4.jpg)  
  ![付費方案與序號兌換](https://raw.githubusercontent.com/aunight/Anigamer-Redesign3.0/main/docs/screenshots/18-membership-redeem.jpg)

---

## 🔗 相關連結 & 問題回報

- **主導開發與維護**：[秋夜](https://www.aunight.pw)
- **原始碼倉庫 & 瀏覽器擴充套件版下載**：[GitHub - aunight/Anigamer-Redesign3.0](https://github.com/aunight/Anigamer-Redesign3.0)
- **問題回報 / 功能建議**：[GitHub Issues](https://github.com/aunight/Anigamer-Redesign3.0/issues)（若需要完整的 Worker 跨域備援與極速環境光效能，建議使用 GitHub Releases 中的 Chromium／Firefox 擴充套件版）
