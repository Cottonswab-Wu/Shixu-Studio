'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const asar = require('@electron/asar');
const { checkTarget, publishRelease, withReleaseLock } = require('./release-history.cjs');
const root = path.resolve(__dirname, '..');

async function releasePortable() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const work = path.join(root, '.release-build');
  const releases = path.resolve(root, '..', 'releases');
  const folderName = `Shixu-Studio-${pkg.version}-Portable`;
  checkTarget(releases, pkg.version);
  const sha256 = filename => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
  process.env.ELECTRON_CACHE ||= path.join(root, '.cache', 'electron');
  process.env.ELECTRON_BUILDER_CACHE ||= path.join(root, '.cache', 'builder');
  process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
  fs.mkdirSync(work, { recursive: true });
  const buildOutput = fs.mkdtempSync(path.join(work, 'folder-build-'));
  {
    const web = spawnSync(process.execPath, [path.join(root, '..', 'web', 'verify.cjs')], { cwd: root, stdio: 'inherit' });
    if (web.status !== 0) throw new Error('Web 驗證失敗，停止打包');
    require('./prepare.cjs');
    const testFiles = fs.readdirSync(path.join(root, 'test')).filter(name => name.endsWith('.test.cjs')).map(name => path.join('test', name));
    for (const args of [['--test', ...testFiles], [path.join(root, '..', 'web', 'verify.cjs'), '--desktop']]) {
      const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
      if (result.status !== 0) throw new Error('桌面驗證失敗，停止打包');
    }
  }

  {
    const builder = require('electron-builder');
    await builder.build({ projectDir: root, publish: 'never', targets: builder.Platform.WINDOWS.createTarget('dir', builder.Arch.x64),
    config: { ...pkg.build, appId: 'studio.shixu.board.portable',
      electronDownload: { cache: require('./electron-cache.cjs').prepareElectronCache(root) },
      directories: { ...pkg.build.directories, output: buildOutput },
      extraMetadata: { studioDistribution: { portable: true, initialBoard: 'empty' } },
      win: { ...pkg.build.win, artifactName: 'Shixu-Studio-Portable.exe' }
    } });
  }
  const unpacked = path.join(buildOutput, 'win-unpacked');
  const archive = path.join(unpacked, 'resources', 'app.asar');
  const metadata = JSON.parse(asar.extractFile(archive, 'package.json').toString('utf8'));
  if (metadata.version !== pkg.version || metadata.studioDistribution?.portable !== true || metadata.studioDistribution?.initialBoard !== 'empty') throw new Error('攜帶版版本號或設定未正確封裝');
  const entries = asar.listPackage(archive).map(name => name.split(path.sep).join('/'));
  if (entries.some(name => /\/(?:board(?:\.previous)?\.json|window\.json|theme\.txt|ShixuStudioData|node_modules)(?:\/|$)/i.test(name))) throw new Error('發行內容包含執行資料或開發套件');
  for (const name of ['main.cjs', 'preload.cjs', 'storage.cjs', 'distribution.cjs', 'app/index.html', 'app/styles.css', 'app/renderer.js', 'assets/icon.ico']) {
    if (!asar.extractFile(archive, name).equals(fs.readFileSync(path.join(root, name)))) throw new Error('封裝內容不是最新原始碼：' + name);
  }
  const runtime = spawnSync(path.join(unpacked, 'Shixu Studio.exe'), ['-e', 'console.log(JSON.stringify({electron:process.versions.electron,arch:process.arch}))'], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8', windowsHide: true });
  if (runtime.status !== 0) throw new Error('發行版執行環境啟動失敗');
  const runtimeVersion = JSON.parse(runtime.stdout.trim());
  if (runtimeVersion.electron !== pkg.devDependencies.electron || runtimeVersion.arch !== 'x64') throw new Error('發行版執行環境檢查失敗');
  const binary = fs.readFileSync(path.join(unpacked, 'Shixu Studio.exe'));
  if (binary.toString('ascii', 0, 2) !== 'MZ' || binary.length < 1024 * 1024) throw new Error('無效的 Windows 執行檔');

  const stage = fs.mkdtempSync(path.join(work, 'zip-stage-'));
  const zipPath = path.join(work, path.basename(stage) + '.zip');
  const folder = path.join(stage, folderName);
  fs.cpSync(unpacked, folder, { recursive: true, filter: source => {
    if (fs.lstatSync(source).isSymbolicLink()) throw new Error('發行內容不可包含連結');
    if (/^(?:ShixuStudioData|board(?:\.previous)?\.json|window\.json|theme\.txt)$/i.test(path.basename(source))) throw new Error('發行內容包含執行資料：' + source);
    return true;
  } });
  const executable = path.join(folder, 'Shixu-Studio.exe');
  fs.renameSync(path.join(folder, 'Shixu Studio.exe'), executable);
  const executableHash = sha256(executable);
  const instructions = `拾序 Studio ${pkg.version} — Windows x64 獨立攜帶版\r\n\r\n` +
    `開始使用\r\n1. 請先將 ZIP 全部解壓縮到自己的可寫入資料夾。\r\n2. 保留整個資料夾並雙擊 Shixu-Studio.exe；啟動時不必解壓程式。免安裝，不需要 Node.js、瀏覽器或網路。\r\n3. 首次開啟是全新的空白看板，先新增列表，再新增卡片。\r\n\r\n` +
    `資料保存\r\n程式首次執行時，會在執行檔旁建立 ShixuStudioData 資料夾。\r\n看板資料在 ShixuStudioData\\data\\board.json；上一份資料在 board.previous.json。\r\n資料與開發版分開，也不會讀取其他資料夾內的看板。\r\n每次變更自動儲存，請確認介面顯示「已儲存在本機」。\r\n\r\n` +
    `搬移與重開一份\r\n- 延續原資料：先關閉程式，將整個資料夾連同 ShixuStudioData 一起複製到其他電腦或位置。\r\n- 建立全新看板：將這份原始 ZIP 解壓縮到另一個全新資料夾；不要帶入 ShixuStudioData。\r\n- 請保留原始 ZIP 作為乾淨的初始發行包。ZIP 本身不會被程式寫入資料。\r\n- 也可由「資料與備份」匯出／匯入 JSON，定期留存外部備份。\r\n\r\n` +
    `注意\r\n請勿直接在壓縮檔內執行。請放在有寫入權限的本機資料夾，勿放在 Program Files 等受保護位置。\r\n本版本適用 Windows 10／11 x64，未使用發行者憑證簽章。\r\n發行包僅含程式、此說明與校驗值，未包含任何現有看板、網頁版、原始碼或開發套件。\r\n`;
  fs.writeFileSync(path.join(folder, 'README.txt'), '\uFEFF' + instructions, 'utf8');
  fs.writeFileSync(path.join(folder, 'SHA256SUMS.txt'), executableHash + '  Shixu-Studio.exe\n');
  const zipped = spawnSync('python', [path.join(__dirname, 'archive_release.py'), stage, zipPath, folderName, executableHash], { encoding: 'utf8', windowsHide: true });
  if (zipped.status !== 0) throw new Error('ZIP 建立或檢查失敗：' + zipped.stderr + zipped.stdout);
  console.log(zipped.stdout.trim());
  // The staging filename is temporary; the checksum names the public artifact.
  fs.writeFileSync(zipPath + '.sha256', sha256(zipPath) + '  ' + folderName + '-win-x64.zip\n');
  const bytes = fs.statSync(zipPath).size;
  // Only this invocation's temporary staging directory can be removed.
  const absolute = path.resolve(stage);
  if (path.dirname(absolute) !== path.resolve(work) || !path.basename(absolute).startsWith('zip-stage-')) throw new Error('Unexpected cleanup path');
  const published = publishRelease(releases, pkg.version, zipPath);
  // Publication is committed. Cleanup errors must not roll back the version number.
  try {
    fs.rmSync(absolute, { recursive: true, force: true });
    if (path.dirname(path.resolve(buildOutput)) !== path.resolve(work) || !path.basename(buildOutput).startsWith('folder-build-')) throw new Error('Unexpected build cleanup path');
    fs.rmSync(buildOutput, { recursive: true, force: true });
  }
  catch (error) { console.warn('暫存資料夾清理失敗：' + error.message); }
  console.log(JSON.stringify({ zip: published, bytes, initialBoard: 'empty', data: 'ShixuStudioData beside executable' }, null, 2));
}
if (require.main === module) {
  if (process.argv.length > 2) throw new Error('正式發布不可跳過測試或沿用舊建置；請使用 npm run release:portable');
  withReleaseLock(root, releasePortable).catch(error => {
    console.error(error);
    process.exitCode = 1;
    process.on('exit', () => { process.exitCode = 1; });
  });
}
module.exports = { releasePortable };
