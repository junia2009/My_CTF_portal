// デプロイ用：公開ディレクトリの全ファイルを Service Worker の事前キャッシュに登録し、ビルドIDを埋め込む
// 使い方: node scripts/build-sw.mjs <公開ディレクトリ> <ビルドID>
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const [dir, buildId] = process.argv.slice(2);
if (!dir || !buildId) {
  console.error('usage: node scripts/build-sw.mjs <dir> <build-id>');
  process.exit(1);
}

const walk = (d) =>
  readdirSync(d).flatMap((name) => {
    const p = join(d, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const files = walk(dir)
  .map((p) => relative(dir, p).split(sep).join('/'))
  .filter((p) => p !== 'sw.js' && !p.startsWith('.'))
  .sort()
  .map((p) => './' + p);

const swPath = join(dir, 'sw.js');
let sw = readFileSync(swPath, 'utf8');
const before = sw;
sw = sw.replace("const BUILD_ID = 'dev';", `const BUILD_ID = ${JSON.stringify(buildId)};`);
sw = sw.replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(files, null, 2)};`);
if (sw === before || !sw.includes(buildId)) {
  console.error('sw.js のプレースホルダが見つかりませんでした');
  process.exit(1);
}
writeFileSync(swPath, sw);
console.log(`sw.js: build ${buildId}, ${files.length} files precached`);
