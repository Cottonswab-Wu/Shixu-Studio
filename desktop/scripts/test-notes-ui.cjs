'use strict';
// Run Chromium integration checks without building or touching user board data.
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const version=require('electron/package.json').version;
const runtime=path.join(root,'.test-data',`ui-electron-${version}`);
const executable=path.join(runtime,'electron.exe');
if(!fs.existsSync(executable)){
  const cache=path.join(root,'.cache','electron'),name=`electron-v${version}-win32-x64.zip`;
  const archive=fs.existsSync(cache)?fs.readdirSync(cache).map(folder=>path.join(cache,folder,name)).find(file=>fs.existsSync(file)):undefined;
  if(!archive)throw new Error('UI 測試需要已快取的 Electron Windows x64 ZIP；不會自動下載或打包。');
  if(createHash('sha256').update(fs.readFileSync(archive)).digest('hex')!==require('electron/checksums.json')[name])throw new Error('Electron 快取校驗失敗');
  fs.mkdirSync(runtime,{recursive:true});
  const unpack=spawnSync('python',['-c','import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',archive,runtime],{stdio:'inherit',windowsHide:true});
  if(unpack.status!==0)throw new Error('無法準備 UI 測試執行環境');
}
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const testFile=process.argv.includes('--accessibility')?'accessibility-ui.cjs':process.argv.includes('--time')?'time-ui.cjs':'notes-ui.cjs';
const result=spawnSync(executable,[path.join(root,'test',testFile)],{cwd:root,env,stdio:'inherit',windowsHide:true});
if(result.status!==0)throw new Error('工具畫面測試失敗：'+(result.error?.message||result.status));
