# 拾序 Studio（Shixu Studio）

拾序 Studio 是可離線使用的個人工作看板，提供單檔網頁版與 Windows 桌面版。看板、便簽與時間工具的資料都儲存在本機。

## 功能

- **我的看板**提供拖曳排序、卡片子任務、標籤、收藏、到期日與搜尋。
- **隨手便簽**支援自訂顏色、拖曳、縮放與置頂。
- **時間工具箱**包含鬧鐘、番茄鐘、倒數計時與碼表。
- **資料與備份**可匯出或匯入 JSON，方便在裝置或版本之間搬移資料。

## 開始使用

### 網頁版

從 GitHub 的 **Code → Download ZIP** 下載並解壓原始碼，或複製此倉庫。用 Chrome 或 Edge 的一般視窗開啟本機的 `web/index.html`，即可開始使用。此單檔已包含介面、程式及素材，可直接離線開啟。

瀏覽器透過 `localStorage` 保存資料。日後請使用相同的瀏覽器、使用者設定檔和 HTML 路徑開啟。詳細操作見[網頁版使用說明](web/README.md)。

### Windows 桌面版

若手上已有 Windows x64 攜帶版 ZIP，請完整解壓到可寫入的資料夾，再雙擊 `Shixu-Studio.exe`。第一次開啟會建立空白看板，資料會寫到執行檔旁的 `ShixuStudioData/data/board.json`。原始碼下載提供下方的開發啟動方式，攜帶版可依[修改與發布流程](RELEASING.md)在本機打包。

網頁版與桌面版各自保存資料。要搬移資料時，從原版本的「資料與備份」匯出 JSON，再到另一版本匯入。桌面開發版的資料位置與操作詳見[桌面版使用說明](desktop/README.md)。

## 開發與驗證

使用 Node.js 22.12 或更新版本。從專案根目錄組裝並驗證網頁版：

```powershell
node web/build.cjs
node web/verify.cjs
```

在 Windows 從原始碼啟動桌面版：

```powershell
cd desktop
npm ci
npm start
```

在 `desktop/` 執行 `npm test` 可驗證桌面與共用介面。確認瀏覽器操作及儲存後，可依[修改與發布流程](RELEASING.md)產生本機攜帶版。版本變更見[版本紀錄](CHANGELOG.md)。

## 專案結構

| 路徑 | 用途 |
| --- | --- |
| `web/src/` | 共用介面的 HTML、CSS、JavaScript 與素材 |
| `web/index.html` | 由 `web/build.cjs` 組裝的單檔網頁版，隨原始碼提供以便直接開啟 |
| `desktop/` | Electron 主程序、原生儲存、相依套件鎖定檔、測試與 Windows 打包腳本 |

介面修改請從 `web/src/` 著手。`desktop/app/`、本機 `releases/`、相依套件、建置快取與看板資料皆由 `.gitignore` 排除。
