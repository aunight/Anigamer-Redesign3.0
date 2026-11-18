# 動畫瘋重製版 3.0

![動畫瘋重製版 3.0 首頁預覽](docs/preview-home.jpg)

由 [秋夜](https://www.aunight.pw) 主導的 **動畫瘋重製版 3.0** —— 以現代化磨砂玻璃（Frosted Glass）、高對比電影級排版與全頁視覺一致性為核心，重製動畫瘋首頁、播放頁、播放器控制列、片庫目錄與第三方輔助腳本整合體驗。

> [!NOTE]
> 本版本還在測試修改當中，有任何問題歡迎至 [Issues](https://github.com/aunight/Anigamer-Redesign3.0/issues) 提 Issue 回報。

> **上游專案致謝 / Upstream Attribution**  
> 本專案的「動態環境光引擎（WebGL 2 / Canvas）」與基礎設定框架改作自原專案 **[Hinataragi/anigamer-ambilight](https://github.com/Hinataragi/anigamer-ambilight)**（MIT 授權），並承襲其參考自 [youtube-ambilight](https://github.com/WesselKroos/youtube-ambilight) 與 [bilibili-ambilight](https://github.com/iceorange-dev/bilibili-ambilight) 的取樣技術。  
> 在此感謝原作者建立的穩定光暈底層；**動畫瘋重製版 3.0** 在此基礎之上，將視覺設計系統、頁面重構層與擴充套件相容性獨立翻新。

---

## Redesign 3.0 核心亮點

### 1. 全站視覺設計系統 3.0
- **全域磨砂玻璃層次與排版**：統一調整頁首導覽列、搜尋框、會員頭像與下拉通知氣泡（`topbar-bridge.js`），消除生硬邊框與高飽和雜訊，保留高可讀性與清晰層次。
- **頁面進場與轉場動畫**：透過 `page-entry.js` 與 `motion.css` 統一頁面載入過渡，支援 `prefers-reduced-motion` 無障礙降級。
- **主題配色與字體系統**：支援 6 種預設配色、深淺模式切換與自訂色票，字體切換精確排除 icon 字型（`Material Icons` / `Font Awesome` / `Video.js`），圖示不跑字。

### 2. 首頁、新番時間軸與海報卡片重製
- **Hero Banner 主視覺橫幅（`hero-banner.js`、`hero-cache-worker.js`）**：自動快取並呈現主打動畫大圖與重點資訊，支援鍵盤操作與流暢切換。
- **新番時間軸配色區分**：**當天更新標籤**維持醒目橘色，**過去日期標籤**統一採用藍綠主色，時間軸雙圓節點全面改為高對比純白填充，去除黑點干擾。
- **海報卡片與封面光暈**：統一 `EP.x` 集數徽章、評分膠囊與觀看數圖示；星期列表支援 hover 日期提示與單面板順暢展開／收合。

### 3. 播放頁與播放器 UI 重構
- **Vidstack 風格播放器控制列**：
  - 左側時間膠囊化與 YouTube 比例音量滑桿；
  - 右側畫質選單（Auto → 自動，128px 精簡寬度）、置中純白單格彈幕開關（`#danmuToggle`）、環境光按鈕；
  - **跳過片頭／片尾提示**：自動偵測浮層轉化為位於控制列上方的水平毛玻璃膠囊，保留 `×` 關閉圖示不壓迫進度條。
- **無邊框純淨全螢幕**：修正全螢幕下頂部殘留邊線、側欄殘影與標題遮罩，確保全螢幕完整貼齊視窗。
- **播放頁資訊區重編排**：將集數列表（`ani-episode-shelf`）、標題列功能膠囊（作品資料、哈啦板、Bangumi 點格子、分享）、上架日曆圖示、右側邊欄分集清單與雙欄留言區整合為一致的暗色玻璃介面。

### 4. 片庫、觀看紀錄、我的動畫與付費頁整合
- **所有動畫目錄**：可收合篩選條件與動態載入評分排序。
- **我的動畫**：狀態、年份、搜尋與公開類型標籤（Genre）即時組合篩選，載入下一頁自動重套篩選結果。
- **觀看紀錄**：獨立卡片分集清單搭配滾動哨兵自動載入更多紀錄，並顯示快取評分與追番收藏狀態。
- **付費方案與序號兌換**：專屬漸層會員背景卡片、非同步載入方案保留原生操作與自訂兌換彈窗。

### 5. 第三方腳本／擴充功能深度相容
- **動畫瘋+（AniGamer Plus）**：將左側工具列、截圖按鈕抽屜整合為統一暗色玻璃風格；截圖預覽卡片 4 顆操作鈕重製為 **30px 深藍圓底搭配純白向量圖示**。
- **動畫瘋資訊+（aniInfo+）自動備援**：當 Syoboi 日曆因連線限流回傳非 JSON 或查無資料時，透過 Background Service Worker（`hero-cache-worker.js`）自動改以 **AniList GraphQL** 與 **Wikipedia API** 補齊日文聲優 CAST 與維基百科連結，並保留原站作品連結與標籤供腳本讀取。

---

## 安裝與建置

需具備 Node.js（建議 v20 以上）與 npm：

```powershell
git clone https://github.com/aunight/Anigamer-Redesign3.0.git
cd Anigamer-Redesign3.0
npm ci
npm test
npm run build
```

建置完成後會在 `dist/` 產生三種版本：

| 產物路徑 | 適用環境 | 載入方式 |
| --- | --- | --- |
| `dist/extension/` | Chrome / Edge / Dia（Chromium） | 開啟擴充功能頁的「開發人員模式」→「載入未封裝項目」選擇此資料夾 |
| `dist/ani-ambilight.user.js` | Violentmonkey / Tampermonkey | 直接匯入單檔 Userscript |
| `dist/extension-firefox/` | Firefox | `about:debugging#/runtime/this-firefox` 暫時載入 `manifest.json` |

---

## 專案架構（Redesign 3.0 新增與核心檔案）

```text
src/
  manifest.json        擴充功能權限與載入順序設定
  page-entry.js/.css   頁面進場過渡動畫
  hero-banner.js/.css  首頁主視覺橫幅元件
  hero-cache-worker.js 背景圖片快取與 aniInfo+（Syoboi / AniList / Wiki）救援 Worker
  topbar-bridge.js     MAIN world 頂部選單與彈窗橋接
  settings.js/.css     設定結構、預設主題與設定面板
  ambient-renderer.js  WebGL 2 / Canvas 環境光渲染器（承襲上游）
  black-bars.js        上下左右黑邊偵測
  content.js/.css      各頁面重構、卡片強化與播放頁布局
  effects.css          全站主題變數與配色套用
  motion.css           動畫曲線與降級規則
  ui-repairs.css       播放器、第三方腳本相容與全螢幕精修樣式
tests/                 20 項自動化單元與 DOM 合約測試
scripts/build.mjs      統一打包 Chromium / Firefox / Userscript
```

---

## 授權聲明（License）

本專案延續上游專案採用 **[MIT License](LICENSE)** 釋出：
- 保留原著作權人 **Wessel Kroos**、**iceorange-dev** 與 **Hinataragi** 之版權與授權聲明；
- 本專案為非官方開源重構工具，與巴哈姆特動畫瘋無關，亦不讀取或儲存使用者帳號密碼。
