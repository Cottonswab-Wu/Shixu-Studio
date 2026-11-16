'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
// web/index.html 由 web/src 組裝；桌面介面一律從最新的原始碼產生。
{ const web = require('../../web/build.cjs'); const html = web.build(); if (!fs.existsSync(web.OUT) || fs.readFileSync(web.OUT, 'utf8') !== html) { fs.writeFileSync(web.OUT, html); console.log('已由 web/src 重新產生 web/index.html。'); } }
const source = fs.readFileSync(path.join(root, '..', 'web', 'index.html'), 'utf8');
const css = source.match(/<style>([\s\S]*?)<\/style>/)?.[1];
const originalScript = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!css || !originalScript) throw new Error('找不到完整的網頁版樣式與程式');

let renderer = originalScript.replace("'use strict';", `'use strict';
// Desktop storage is mandatory; never silently fall back to browser storage.
const storage = window.studioDesktop.storage;`)
  .replace('function initialState(){return ', `function initialState(){if(window.studioDesktop.getInitialBoardMode()==='empty')return {version:2,notes:[],timeTools:defaultTimeTools(),revision:0,updatedAt:new Date().toISOString(),title:'我的看板',labels:colors.map(({id,name})=>({id,name})),lists:[]};return `)
  .replace(/\blocalStorage\./g, 'storage.')
  .replace('瀏覽器未允許本機儲存。目前變更只留在此視窗，請匯出備份，並改以一般模式開啟。', '無法存取桌面版本機資料。變更只留在此視窗，請匯出備份，並檢查資料資料夾的存取權限。')
  .replace('儲存失敗：儲存空間不足或瀏覽器限制。變更仍留在此視窗，請立即匯出備份，保留之前請勿關閉。', '儲存失敗：磁碟空間不足或資料檔無法寫入。變更仍留在此視窗，請立即匯出備份，保留之前請勿關閉。')
  .replace('備份已交給瀏覽器下載，請確認已存入資料夾', '請在儲存視窗選擇備份位置，並確認檔案已儲存')
  .replace("$('today').textContent=", `$('desktopDataPath').textContent=window.studioDesktop.getDataDirectory();
$('desktopDataFolder').onclick=()=>window.studioDesktop.openDataFolder().catch(error=>toast('無法開啟資料夾：'+error.message));
if(window.studioDesktop.getInitialBoardMode()==='empty'){
  $('desktopStorageNote').textContent='資料保存在執行檔旁的 ShixuStudioData 資料夾。搬移時請先關閉程式，將整個資料夾一起複製；重新解壓縮原始 ZIP 到新資料夾，可建立另一份空白看板。';
}
$('today').textContent=`);

let html = source.replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="styles.css">')
  .replace(/<script>[\s\S]*?<\/script>/, '<script src="renderer.js"></script>')
  .replace('<meta charset="utf-8">', `<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'">`)
  .replace('變更會即時記在目前瀏覽器。', '變更會即時寫入這台電腦的資料檔。')
  .replace('下載包含看板、便簽與時間工具設定的 JSON 檔案。', '另存包含看板、便簽與時間工具設定的 JSON 備份。')
  .replace('<p class="help-note">請固定使用同一個瀏覽器、同一個使用者設定檔及原本的 HTML 路徑。無痕模式、清除瀏覽器資料或移動檔案，可能使原資料無法讀取；搬移前請先匯出備份。</p>', '<p id="desktopStorageNote" class="help-note">桌面版資料獨立保存在目前 Windows 使用者的資料資料夾。移動或更新程式不影響資料；換電腦或使用者前，請先匯出備份。網頁版與桌面版不會自動同步，可使用相同 JSON 備份搬移。</p>')
  .replace('<p id="storageDetail" class="help-note"></p>', '<p id="storageDetail" class="help-note"></p><p class="help-note" style="word-break:break-all">資料位置：<br><span id="desktopDataPath"></span></p><button id="desktopDataFolder" class="btn btn-secondary" style="margin-top:12px">開啟資料資料夾</button>')
  .replace(' · 本機版', ' · 桌面版');

const output = path.join(root, 'app');
fs.mkdirSync(output, { recursive: true });
for (const [name, content] of [['index.html', html], ['styles.css', css], ['renderer.js', renderer]]) fs.writeFileSync(path.join(output, name), content);
fs.writeFileSync(path.join(output, 'source.json'), JSON.stringify({ source: '../../web/index.html', sha256: createHash('sha256').update(source).digest('hex') }, null, 2) + '\n');
require('./icon.cjs');
console.log('Desktop renderer prepared from web/index.html.');
