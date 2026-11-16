# 拾序 Studio — Windows 桌面版

正式修改與發布規則見 [修改與發布流程](../RELEASING.md)：先完成 Web 驗證，再用 `npm run release` 自動更新版本並打包；最新版放在 `../releases/`，最近 3 個歷史版本放在 `../releases/history/`。

## 乾淨的獨立攜帶版 ZIP

交付檔為 `../releases/Shixu-Studio-<版本>-Portable-win-x64.zip`，僅含免安裝桌面程式、README.txt 和 SHA256SUMS.txt，沒有既有看板資料、網頁版或開發套件。

請先完整解壓縮到可寫入的本機資料夾，保留整個資料夾，再雙擊 `Shixu-Studio.exe`。資料夾式封裝避免每次啟動時解壓程式。第一次啟動從空白看板開始，自動建立執行檔旁的 `ShixuStudioData`；資料存在 `ShixuStudioData/data/board.json`。開發版使用 AppData 路徑。

- 全新一份：將原始 ZIP 解壓縮到另一個全新資料夾。
- 延續資料：先關閉程式，把整個攜帶版資料夾連同 `ShixuStudioData` 一起複製到新位置／電腦。
- 請保留原始 ZIP 作為乾淨母版；程式只寫入解壓縮後的資料夾，不修改 ZIP。
- 不要直接在 ZIP 裡啟動程式；資料夾需有寫入權限。

發布新版請執行 `npm run release`；僅需發布目前尚未發布的版本時使用 `npm run release:portable`（打包環境另需 Python 3，以標準函式庫建立 ZIP；使用現成 ZIP 不需要 Python）。此流程使用獨立的 `.release-build` 輸出與封裝時的 `studioDistribution` 設定。若同版或更高版本已存在，會停止以保留原始發行檔；成功後將上一版歸檔並保留最近 3 版歷史。

## 直接使用

正式版請使用 `../releases/` 的最新 ZIP，完整解壓後雙擊 `Shixu-Studio.exe`。適用 Windows 10／11 x64，不需另外安裝 Node.js、npm 或瀏覽器。

程式介面與網頁版一致，包含卡片與列表拖拽、讓位動畫、邊緣捲動、卡片縮放視窗、子任務、標籤、收藏、到期日及 JSON 備份。桌面版增加原生儲存、單一執行個體、視窗位置記憶、備份另存視窗，以及資料資料夾入口。

正式版需保留解壓後的整個資料夾。開發用 `npm run build:dir` 可另行產生 `dist/win-unpacked/`。

本次產物未做發行者憑證簽章。

## 開發建置的資料儲存

```text
%APPDATA%\ShixuStudio\
├─ data\
│  ├─ board.json             最新完整看板
│  ├─ board.previous.json    上一份有效資料（寫入成功時盡力保留）
│  └─ theme.txt              外觀主題偏好
└─ window.json               視窗位置與大小
```

Windows 通常對應 `C:\Users\你的帳號\AppData\Roaming\ShixuStudio\data`。在程式「資料與備份 → 開啟資料資料夾」可前往實際位置。

- 每次編輯立即經 IPC 交給主程序，先寫入同目錄暫存檔並 `fsync`，再替換正式檔。寫入或替換失敗會保留上次成功的資料，並由介面提示「尚未儲存」。
- 不依賴瀏覽器 localStorage、HTML 路徑或 `.exe` 所在位置。關閉程式、正常重新啟動電腦或移動執行檔後，會從相同使用者資料夾讀取上次已儲存的狀態。
- 只允許一個執行中的視窗，重複雙擊會切回原視窗。偵測到資料檔遭外部修改時，會沿用介面的衝突保護，暫停覆寫。
- 主要資料損壞時，沿用網頁版的結構驗證與上一份資料復原流程；介面會提示先匯出，再啟用儲存。
- 切換 Windows 使用者、換電腦或刪除資料資料夾不會自動帶走資料。請先匯出 JSON；備援檔也在同一磁碟，不能取代外部備份。
- 程式與網頁版資料各自獨立，可互相匯入同一格式的 JSON 備份；未提供背景同步。
- 權限不足、磁碟已滿、硬體故障或強制斷電仍可能影響儲存。只有畫面顯示成功儲存的資料才應視為已保存，請定期保留備份。

## 原始碼開發

以下僅供重新開發／打包，使用現成 `.exe` 不需要執行。

使用 Node.js 22.12 或更新版本。在此 `desktop` 目錄執行：

```text
npm ci
npm start
```

Electron 首次啟動可能需要從官方來源下載執行環境。`package-lock.json` 已固定此次相依版本。

驗證與打包：

```text
npm test
npm run build:dir
```

`npm run build:dir` 輸出開發用的解包執行檔至 `dist/win-unpacked/`。第一次打包需要網路下載 Electron／打包工具，之後使用快取。

### 共用網頁版介面

請修改 `../web/src/` 內的原始碼（`../web/index.html` 由它組裝產生，不要直接修改），再執行：

```text
npm run prepare:app
```

準備程式會先由 `web/src` 組裝 `web/index.html`，再把單檔 HTML 拆成 `app/index.html`、`styles.css`、`renderer.js`，替換為原生儲存橋接與桌面說明，並建立 SHA-256 來源記錄。`npm start`、`npm test` 和 `npm run build:dir` 都會先自動準備；不要直接修改生成的 `app` 檔案。

### 主程序與權限

主程序只載入本機介面，阻擋外部請求、新視窗、任意導覽與 webview；renderer 關閉 Node.js 整合，啟用 context isolation、sandbox 與 CSP。preload 只公開固定資料鍵的讀寫、資料目錄字串和開啟資料資料夾，沒有任意檔案存取或通用 IPC。參考：[Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)、[Electron Sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox)、[electron-builder Windows 打包](https://www.electron.build/v26/docs/win/)。

## 驗證範圍

桌面測試涵蓋版本發布、歷史歸檔、失敗回復、主程序初始化、IPC 來源驗證、外部導覽阻擋，以及真實檔案系統的重新讀回、Unicode 內容、寫入／重新命名失敗保留舊檔、flush 順序、大小限制及橋接錯誤。另檢查產生介面、CSP、圖示與 Windows 打包設定，並對網頁版與桌面版介面程式各自執行應用程式邏輯驗證。

正式打包會確認 ASAR 內必要檔案與目前原始碼逐位元組相符，執行內嵌 Node 模式確認 Electron 版本及 x64 架構，並將 EXE 的 SHA-256 校驗值放在發行 ZIP 內。

邏輯與打包檢查不等同實際螢幕操作驗證；未測試真實重新開機或斷電復原。
