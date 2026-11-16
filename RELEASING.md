# 修改與發布流程

## 先 Web，後 EXE

1. 功能與介面修改 `web/src/` 的原始碼，再執行 `node web/build.cjs` 組裝 `web/index.html`。不要直接改產生的 `web/index.html` 或 `desktop/app/`。
2. 執行 `node web/verify.cjs`（`web/index.html` 與 `web/src` 不一致時會失敗）；以 Chrome／Edge 開啟 `web/index.html`，確認本次修改相關操作、儲存與重新開啟均正常。自動測試不能取代實際瀏覽器操作驗證。
3. Web 確認通過後，在 `desktop` 執行正式發布指令。桌面專屬變更另外確認 Electron 行為。

## 更新版本並自動打包

```powershell
cd desktop                    # 從專案根目錄進入
npm run release              # 預設 patch，例如 1.0.0 → 1.0.1
npm run release -- minor     # 新增相容功能，例如 1.0.1 → 1.1.0
npm run release -- major     # 不相容變更，例如 1.1.0 → 2.0.0
```

上面三行是不同變更類型的選項，每次發布只執行一行。也可指定更高的正式版本，例如 `npm run release -- 2.1.0`。

版本採 `major.minor.patch`：修正、樣式調整及相容的建置流程改進使用 patch；新增相容功能使用 minor；資料格式或使用方式有不相容變更使用 major。正式版本不覆寫、不降版。

以 `desktop/package.json` 為版本來源，發布指令同步更新 `package-lock.json`，接著自動：

1. 由 `web/src` 組裝 `web/index.html`、驗證 Web，再產生桌面介面與來源 SHA-256。
2. 執行桌面測試及桌面介面邏輯驗證；失敗停止。
3. 建立 Windows x64 資料夾式攜帶版，檢查封裝版本、原始碼、Electron 執行環境、架構與 EXE，並排除看板資料。
4. 在暫存位置建立 ZIP，檢查內容清單、CRC、所有檔案內容與 EXE 的 SHA-256，再檢查 ZIP 的 SHA-256。
5. 將上一版 ZIP 與校驗檔移至歷史，放入新版 ZIP 與校驗檔，最後清理過期歷史。

建置或發布失敗會還原兩份版本檔；發布移動檔案失敗會復原已移動的發行檔。正式發布完成後，暫存或歷史清理失敗只會提示，不會撤回成功版本。發布鎖會阻擋同時執行多個發布。

統一使用 `npm run release`，讓版本更新與打包在同一流程完成。`npm run release:portable` 可用於發布目前尚未發布的版本或失敗重試，不會調整版本號；不能跳過測試、使用舊建置或覆寫同版。開發用 `npm run build:dir` 輸出至 `desktop/dist/win-unpacked/`。

## 最新版與歷史

```text
releases/
├─ Shixu-Studio-<最新版>-Portable-win-x64.zip
├─ Shixu-Studio-<最新版>-Portable-win-x64.zip.sha256
└─ history/
   ├─ <前一版>/             同版 ZIP 與 .sha256
   ├─ <前二版>/
   └─ <前三版>/
```

歷史依版本號數值排序，保留最近 **3 個歷史版本**；加上最新版共最多 **4 版**。只有新版本完整發布成功後才清理。無法辨識的檔案、帶額外內容的資料夾及符號連結會保留，因此遇到人工放入其他檔案時可能超過上限。

使用者資料 `ShixuStudioData` 與 AppData 不參與打包、歸檔或清理。更新攜帶版時，先關閉程式並備份資料，將新版完整解壓到新資料夾，再把原本的 `ShixuStudioData` 複製至新版 EXE 旁；未複製資料則是另一份空白看板。

「發布」指產生本機 `releases/`，沒有自動上傳遠端，也不會在使用者電腦自動安裝更新。打包環境需要既有 Node.js／npm 相依套件與 Python 3；第一次使用工具可能需要下載快取。

若程序被強制終止導致 `desktop/.release.lock` 殘留，先確認沒有發布程序執行，再刪除該鎖檔。若中斷發生在版本更新或發行檔移動期間，先檢查兩份版本檔、`releases/` 與 `history/` 是否一致再重試；一般錯誤的回復機制不等同斷電交易保證。
