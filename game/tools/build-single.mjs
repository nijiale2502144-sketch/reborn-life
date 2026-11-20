// 打包成单个 HTML（脚本、样式、内容 JSON、像素图全部内嵌），可直接发布成 Artifact 或双击打开
// 用法： node tools/build-single.mjs      输出： dist/reborn-life.html
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsRoot = path.resolve(root, '..');

const walk = (dir, out = []) => { for (const f of readdirSync(dir)) { const p = path.join(dir, f); statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; };

// 1. 内容 JSON
const files = {};
for (const f of walk(path.join(root, 'content')).filter(f => f.endsWith('.json'))) {
  files[path.relative(root, f).split(path.sep).join('/')] = JSON.parse(readFileSync(f, 'utf8'));
}
// 2. 图片（键与界面里写的相对路径一致）
const assets = {};
for (const dir of ['portraits', 'scenes']) {
  for (const f of walk(path.join(assetsRoot, dir)).filter(f => f.endsWith('.png'))) {
    assets['../' + dir + '/' + path.basename(f)] = 'data:image/png;base64,' + readFileSync(f).toString('base64');
  }
}
// 3. 脚本
const js = execFileSync('npx', ['--yes', 'esbuild', 'src/ui.js', '--bundle', '--format=iife', '--minify', '--target=es2020'], { cwd: root, maxBuffer: 64 * 1024 * 1024 }).toString();
// 4. 样式：原样式 + 单文件版的补充（安全区、深色声明）
const css = readFileSync(path.join(root, 'style.css'), 'utf8') + `
:root { color-scheme: dark; }
.wrap, .center { padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.topbar { top: env(safe-area-inset-top, 0px); }
.topbar .in { padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: #1e1c25; }
`;
const safe = o => JSON.stringify(o).replace(/</g, '\\u003c');
const html = `<title>轮回人生录</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${css}
</style>
<div id="app"><p class="loading">加载中……</p></div>
<dialog id="logdlg"><div id="logbody"></div><form method="dialog"><button class="btn">关闭</button></form></dialog>
<dialog id="savedlg"><div id="savebody"></div><form method="dialog"><button class="btn">关闭</button></form></dialog>
<script>window.__FILES = ${safe(files)}; window.__ASSETS = ${safe(assets)};</script>
<script>${js.replace(/<\/script>/g, '<\\/script>')}</script>
`;
mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'reborn-life.html');
writeFileSync(out, html);
console.log(`已生成 ${out}（${(html.length / 1024).toFixed(0)} KB）`);
