# 專案修改與發布約定

- 本輪全面改版第 1～5 項均已由使用者驗收通過（第 4、5 項合併驗收），第 6 項工具捷徑依使用者指示取消。進度與方案見 `REFACTORING.md`。

- 功能與介面修改 `web/src/`（HTML 片段、CSS、依序串接的 JS 片段），執行 `node web/build.cjs` 組裝單檔 `web/index.html`；`web/index.html` 是產生檔，不直接修改。結構見 `web/README.md`。
- 修改後先執行 `node web/verify.cjs`，並在瀏覽器確認本次修改的操作、儲存與重新開啟。確認 Web 功能正常後才打包 EXE。
- `desktop/app/` 是由 Web 產生的檔案，不直接修改；桌面專屬行為才修改 Electron 主程序、preload 或原生儲存。
- 正式發布統一在 `desktop` 執行 `npm run release`，預設更新 patch。新功能用 `npm run release -- minor`；不相容變更用 `npm run release -- major`。遵循 major.minor.patch，不覆寫既有版本。
- 發布指令自動同步 `package.json` 與 `package-lock.json` 的版本、驗證 Web、產生桌面介面、執行桌面測試、打包並驗證 EXE／ZIP，再發布至 `releases/`。失敗時還原版本檔，保留原有正式發行檔。
- `releases/` 根目錄放最新版 ZIP 與 SHA-256；上一版自動移到 `releases/history/<版本>/`。歷史保留最近 **3 版**，連同最新版最多 **4 版**；只清理本專案可辨識的完整歷史發行包，不刪除看板資料或其他檔案。
- `npm run release:portable` 僅用於發布目前版本（如失敗重試）；同樣驗證、歸檔與保留歷史，不更新版本。不要用 `--package-only` 跳過驗證發布舊建置。
- 此處「發布」指產生本機 `releases/` 發行包，不包含上傳、遠端發布或應用程式自動更新。每次完成應說明驗證結果與尚未完成的實際操作驗證。
