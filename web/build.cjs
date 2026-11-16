#!/usr/bin/env node
/* 拾序 Studio — 由 web/src 組裝單檔 web/index.html。
 *
 *   node web/build.cjs           產生 web/index.html
 *   node web/build.cjs --check   只檢查 web/index.html 是否與 src 一致（不寫檔）
 *
 * src/index.html 是外殼範本。範本或片段中「整行」的
 *   <!-- @include 路徑 -->   （HTML）
 *   /* @include 路徑 *\/      （CSS／JS）
 * 會被替換為 src 下該檔案的完整內容，可巢狀。順序即輸出順序。
 * CSS 引用 WebP 時，會在原處輸出單檔頁面可使用的 data URL。
 * 所有 JS 片段共用同一個 IIFE 作用域，因此片段之間直接共用變數與函式，
 * 不需要模組系統，也維持 file:// 雙擊即可使用的單檔交付。
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, 'index.html');
const INCLUDE = /^[ \t]*(?:<!--|\/\*)[ \t]*@include[ \t]+(\S+)[ \t]*(?:-->|\*\/)[ \t]*$/;

function expand(file, stack = []) {
  const full = path.resolve(SRC, file);
  if (!full.startsWith(SRC + path.sep)) throw new Error('include 路徑超出 web/src：' + file);
  if (stack.includes(full)) throw new Error('include 形成循環：' + [...stack, full].map(f => path.relative(SRC, f)).join(' → '));
  if (!fs.existsSync(full)) throw new Error(`找不到 include 檔案：${file}（由 ${stack.length ? path.relative(SRC, stack.at(-1)) : '範本'} 引用）`);
  if (path.extname(full) === '.webp') return `url("data:image/webp;base64,${fs.readFileSync(full).toString('base64')}")`;
  const text = fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  // 片段檔以換行結尾時，最後的空字串不輸出成額外空行。
  const trailing = lines.at(-1) === '';
  if (trailing) lines.pop();
  const out = lines.map(line => {
    const m = line.match(INCLUDE);
    return m ? expand(m[1], [...stack, full]) : line;
  }).join('\n');
  return out;
}

// 輸出沿用 Windows 的 CRLF；src 檔案無論 LF 或 CRLF 都可。
function build() {
  return (expand('index.html') + '\n').replace(/\n/g, '\r\n');
}

if (require.main === module) {
  const html = build();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (current !== html) {
      console.error('web/index.html 與 web/src 不一致。請執行 node web/build.cjs 重新產生，不要直接修改 web/index.html。');
      process.exit(1);
    }
    console.log('web/index.html 與 web/src 一致。');
  } else {
    fs.writeFileSync(OUT, html);
    console.log(`已由 web/src 產生 web/index.html（${(Buffer.byteLength(html) / 1024).toFixed(1)} KB）。`);
  }
}
module.exports = { build, OUT };
