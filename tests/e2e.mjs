// 画面の動きのテスト（ブラウザで実際に操作する）
// 実行: node tests/e2e.mjs
// 必要なもの: playwright と Chromium（npm i --no-save playwright && npx playwright install chromium）
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.txt': 'text/plain; charset=utf-8',
};

// ---------- 静的ファイルを配るだけの小さなサーバー ----------
function serve() {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = normalize(join(ROOT, path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

// ---------- テストの枠組み ----------
let passed = 0;
const failures = [];
const t = async (name, fn) => {
  try {
    await fn();
    passed++;
    console.log('  ok', name);
  } catch (e) {
    failures.push(name);
    console.error('FAIL:', name, '\n ', e.message.split('\n').slice(0, 6).join('\n  '));
  }
};

const server = await serve();
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();

// 起動演出と案内役（PALLAS）の吹き出しを止めた状態で開く。ページ内のエラーは集めて最後に確かめる
async function open(hash = '', { device, keepStorage } = {}) {
  const ctx = await browser.newContext(device ? { ...devices[device], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript((keep) => {
    try {
      sessionStorage.setItem('ctfportal.booted', '1');
      // 保存データはテストごとに最初の1回だけ消す（再読み込み後も残るかを確かめられるように）
      if (!keep && !sessionStorage.getItem('e2e.cleared')) { localStorage.clear(); sessionStorage.setItem('e2e.cleared', '1'); }
      localStorage.setItem('ctfportal.pallas', JSON.stringify({ intro: true, auto: false, roam: false, hidden: true }));
    } catch { /* 保存できない環境でも続ける */ }
  }, !!keepStorage);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.goto(BASE + (hash ? '#' + hash : ''));
  await page.waitForSelector('[data-page]:not([hidden])');
  return { page, ctx };
}

// ページの切り替え（hashchange）が終わるまで待つ
const waitPage = (page, id, timeout) => page.waitForFunction((id) => document.querySelector('[data-page]:not([hidden])')?.dataset.page === id, id, { timeout });
const visiblePage = (page) => page.evaluate(() => document.querySelector('[data-page]:not([hidden])')?.dataset.page);
const pageText = (page, id) => page.evaluate((id) => document.querySelector(`[data-page="${id}"]`).innerText, id);
const activeInfo = (page) => page.evaluate(() => {
  const e = document.activeElement;
  return { tag: e.tagName, page: e.closest('[data-page]')?.dataset.page ?? null, inNav: !!e.closest('#nav'), cls: e.className };
});

// ---------- 起動とページ移動 ----------
await t('ホームがエラーなしで表示される', async () => {
  const { page, ctx } = await open();
  assert.equal(await visiblePage(page), 'home');
  assert.ok(await page.isVisible('#cmdIn'));
  assert.deepEqual(page.errors, []);
  await ctx.close();
});

await t('メニューの全項目からページを開ける（エラーなし）', async () => {
  const { page, ctx } = await open();
  const routes = await page.$$eval('#nav a[data-route]:not(.nav-pinned):not(.nav-fav)', (as) => as.map((a) => a.dataset.route));
  assert.ok(routes.length >= 25, `メニューの項目が少なすぎます: ${routes.length}`);
  for (const r of routes) {
    await page.click(`#nav a[data-route="${r}"]:not(.nav-pinned)`);
    await waitPage(page, r, 5000).catch(() => { throw new Error(`${r} が表示されない`); });
    assert.equal(await page.$eval(`#nav a[data-route="${r}"]:not(.nav-pinned)`, (a) => a.classList.contains('active')), true, `${r} が選択状態にならない`);
  }
  assert.deepEqual(page.errors, []);
  await ctx.close();
});

await t('存在しないページはホームになる', async () => {
  const { page, ctx } = await open('no-such-page');
  assert.equal(await visiblePage(page), 'home');
  await ctx.close();
});

// ---------- ホームのコマンドバー ----------
await t('コマンドバー：Base64 → Enter でエンコード/デコードが開き、中身が復元される', async () => {
  const { page, ctx } = await open();
  await page.fill('#cmdIn', 'ZmxhZ3toZWxsb193b3JsZH0=');
  await page.press('#cmdIn', 'Enter');
  await page.waitForFunction(() => location.hash.startsWith('#codec'));
  await waitPage(page, 'codec');
  // キーボードで移った直後でも、見出しに枠は出さない
  assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'none');
  await page.waitForFunction(() => document.querySelector('[data-page="codec"]').innerText.includes('flag{hello_world}'));
  assert.deepEqual(page.errors, []);
  await ctx.close();
});

await t('コマンドバー：RSA の値 → Enter で RSA が開き、自動で解ける', async () => {
  const P = 1000000007n, Q = 998244353n, N = P * Q, E = 65537n;
  const pw = (b, e, m) => { let r = 1n; b %= m; while (e) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; };
  const C = pw(0x666c6167n /* "flag" */, E, N);
  const { page, ctx } = await open();
  await page.fill('#cmdIn', `n=${N} e=${E} c=${C}`);
  await page.waitForSelector('#cmdOut .cmd-hit');
  assert.match(await page.textContent('#cmdOut .cmd-hit.top'), /RSA/);
  await page.press('#cmdIn', 'Enter');
  await page.waitForFunction(() => location.hash.startsWith('#rsa'));
  await page.waitForFunction(() => /m（文字列）\s*flag/.test(document.querySelector('[data-page="rsa"]').innerText));
  await ctx.close();
});

await t('コマンドバー：1語の ROT13 フラグをシーザー暗号と判定し、古典暗号で解ける', async () => {
  const { page, ctx } = await open();
  await page.fill('#cmdIn', 'synt{pnrfne_vf_rnfl}');
  await page.waitForSelector('#cmdOut .cmd-hit');
  assert.match(await page.textContent('#cmdOut .cmd-hit.top'), /ROT13/);
  await page.press('#cmdIn', 'Enter');
  await waitPage(page, 'classic');
  await page.waitForFunction(() => document.querySelector('[data-page="classic"]').innerText.includes('flag{caesar_is_easy}'));
  await ctx.close();
});

await t('コマンドバー：例のボタンで候補が出る', async () => {
  const { page, ctx } = await open();
  const n = await page.$$eval('[data-cmd-try]', (b) => b.length);
  assert.ok(n > 0);
  for (let i = 0; i < n; i++) {
    await page.click(`[data-cmd-try] >> nth=${i}`);
    await page.waitForSelector('#cmdOut .cmd-hit');
  }
  assert.deepEqual(page.errors, []);
  await ctx.close();
});

// ---------- 各ツールの「例を試す」 ----------
await t('エンコード/デコード：例を試すでフラグまで戻せる', async () => {
  const { page, ctx } = await open('codec');
  await page.click('[data-page="codec"] button:has-text("例を試す")');
  await page.waitForFunction(() => /flag\{[^}]+\}/.test(document.querySelector('[data-page="codec"]').innerText));
  assert.deepEqual(page.errors, []);
  await ctx.close();
});

await t('すべての「例を試す」がエラーなしで動く', async () => {
  const { page, ctx } = await open();
  const pages = await page.$$eval('[data-page]', (ss) => ss.filter((s) => [...s.querySelectorAll('button')].some((b) => b.textContent.includes('例を試す'))).map((s) => s.dataset.page));
  assert.ok(pages.length >= 10, `例を試すのあるページが少なすぎます: ${pages.length}`);
  for (const id of pages) {
    await page.goto(BASE + '#' + id);
    await page.waitForFunction((id) => !document.querySelector(`[data-page="${id}"]`).hidden, id);
    const before = await pageText(page, id);
    await page.click(`[data-page="${id}"] button:has-text("例を試す") >> nth=0`);
    await page.waitForFunction(([id, before]) => document.querySelector(`[data-page="${id}"]`).innerText !== before, [id, before], { timeout: 15000 })
      .catch(() => { throw new Error(`${id}：例を試しても画面が変わらない`); });
  }
  assert.deepEqual(page.errors, []);
  await ctx.close();
});

await t('バイナリ解析：例のクラックミーを読み込み、main と疑似コードを表示する', async () => {
  const { page, ctx } = await open('rev');
  await page.click('[data-page="rev"] button:has-text("例を試す")');
  await page.waitForFunction(() => /x86-64/.test(document.querySelector('[data-page="rev"]').innerText), null, { timeout: 20000 });
  const text = await pageText(page, 'rev');
  assert.match(text, /main/);
  assert.match(text, /疑似コード/);
  assert.deepEqual(page.errors, []);
  await ctx.close();
});

// ---------- 見た目の切り替え ----------
await t('ライト/ダークとアクセントカラーを切り替えられ、再読み込み後も残る', async () => {
  const { page, ctx } = await open();
  const mode = () => page.evaluate(() => document.documentElement.dataset.mode ?? 'dark');
  const before = await mode();
  await page.click('#modeBtn');
  // 切り替えは画面のフェード（View Transition）の後に反映されることがあるので、変わるまで待つ
  await page.waitForFunction((b) => (document.documentElement.dataset.mode ?? 'dark') !== b, before);
  const after = await mode();
  const theme1 = await page.textContent('#themeName');
  await page.click('#themeBtn');
  const theme2 = await page.textContent('#themeName');
  assert.notEqual(theme2, theme1);
  await page.reload();
  await page.waitForSelector('[data-page]:not([hidden])');
  assert.equal(await mode(), after);
  assert.equal(await page.textContent('#themeName'), theme2);
  await ctx.close();
});

// ---------- よく使うツール（ピン留め） ----------
await t('ピン留め：モジュール順で「お気に入り」に並び、本来のメニューと番号は変わらない', async () => {
  const { page, ctx } = await open('home');
  const navBefore = await page.$$eval('#nav a[data-route]', (as) => as.map((a) => a.dataset.route));
  const eyebrowsBefore = await page.$$eval('.eyebrow', (es) => es.map((e) => e.firstChild.textContent));
  // わざとモジュール順とは逆の順でピン留めする
  for (const id of ['pcap', 'rsa', 'codec']) {
    await page.goto(BASE + '#' + id);
    await waitPage(page, id);
    await page.click(`[data-page="${id}"] .pin-btn`);
    assert.equal(await page.getAttribute(`[data-page="${id}"] .pin-btn`, 'aria-pressed'), 'true');
  }
  assert.deepEqual(await page.$$eval('#nav .nav-pinned', (as) => as.map((a) => a.dataset.route)), ['codec', 'rsa', 'pcap']);
  // 本来のメニュー（複製を除く）と MODULE 番号はそのまま
  assert.deepEqual(await page.$$eval('#nav a[data-route]:not(.nav-pinned)', (as) => as.map((a) => a.dataset.route)), navBefore);
  assert.deepEqual(await page.$$eval('.eyebrow', (es) => es.map((e) => e.firstChild.textContent)), eyebrowsBefore);
  // 「よく使う」の複製からも開ける
  await page.click('#nav .nav-pinned[data-route="rsa"]');
  await waitPage(page, 'rsa');
  // 再読み込みしても残る
  await page.reload();
  await page.waitForSelector('[data-page]:not([hidden])');
  assert.deepEqual(await page.$$eval('#nav .nav-pinned', (as) => as.map((a) => a.dataset.route)), ['codec', 'rsa', 'pcap']);
  // 外すと消え、全部外すと見出しごと消える
  for (const id of ['codec', 'rsa', 'pcap']) {
    await page.goto(BASE + '#' + id);
    await waitPage(page, id);
    await page.click(`[data-page="${id}"] .pin-btn`);
  }
  assert.equal(await page.$$eval('#nav .nav-pinned, #nav .nav-pins-title', (e) => e.length), 0);
  assert.deepEqual(page.errors, []);
  await ctx.close();
});

await t('お気に入りのページ：モジュール順のタイルで開け、ページ内で追加・削除できる', async () => {
  const { page, ctx } = await open('favorites');
  // 何も無いときは案内と、追加用の一覧が出る
  assert.ok(await page.isVisible('.fav-empty'));
  assert.ok(await page.isVisible('.fav-picker'));
  // 一覧から追加（わざとモジュール順と逆に押す）
  for (const id of ['pcap', 'rsa', 'identify']) await page.click(`.fav-chip[data-fav="${id}"]`);
  assert.equal(await page.getAttribute('.fav-chip[data-fav="rsa"]', 'aria-pressed'), 'true');
  assert.deepEqual(await page.$$eval('.fav-tile .fav-link', (as) => as.map((a) => a.getAttribute('href'))), ['#identify', '#rsa', '#pcap']);
  // タイルの番号は各ページの MODULE 番号と同じ
  const no = await page.textContent('.fav-tile:nth-child(2) .fav-no');
  const eyebrow = await page.$eval('[data-page="rsa"] .eyebrow', (e) => e.firstChild.textContent);
  assert.ok(eyebrow.includes(`MODULE ${no.slice(1)}`), `${no} と ${eyebrow}`);
  // 各ツールのページの ☆ にも反映される
  assert.equal(await page.getAttribute('[data-page="rsa"] .pin-btn', 'aria-pressed'), 'true');
  // 編集で外す
  await page.goto(BASE + '#home');
  await page.goto(BASE + '#favorites');
  await waitPage(page, 'favorites');
  assert.equal(await page.isVisible('.fav-picker'), false, '登録があるときは最初は一覧を出さない');
  await page.click('.fav-edit');
  // 「完了」は塗りつぶしで、文字が読める（押した直後でカーソルが乗ったままでも）
  const done = await page.$eval('.fav-edit', (e) => { const c = getComputedStyle(e); return { img: c.backgroundImage, bg: c.backgroundColor, fg: c.color }; });
  assert.equal(done.img, 'none', `完了ボタンの背景が塗りつぶしになっていません: ${done.img}`);
  assert.notEqual(done.bg, done.fg);
  await page.click('.fav-tile:nth-child(1) .fav-remove');
  assert.deepEqual(await page.$$eval('.fav-tile .fav-link', (as) => as.map((a) => a.getAttribute('href'))), ['#rsa', '#pcap']);
  await page.click('.fav-edit');
  // タイルからツールを開ける
  await page.click('.fav-link[href="#pcap"]');
  await waitPage(page, 'pcap');
  assert.deepEqual(page.errors, []);
  await ctx.close();
});

await t('スマホ：メニューにはお気に入りの複製を並べず、先頭の ★ から開く', async () => {
  const { page, ctx } = await open('home', { device: 'iPhone 13' });
  const ids = ['identify', 'codec', 'classic', 'rsa', 'xor', 'rev', 'file', 'image', 'pcap', 'dict'];
  await page.evaluate((ids) => localStorage.setItem('ctf.pins', JSON.stringify(ids)), ids);
  await page.reload();
  await page.waitForSelector('[data-page]:not([hidden])');
  // 複製はスマホでは見えない（メニューの長さは増えない）
  assert.equal(await page.$$eval('#nav .nav-pinned', (as) => as.filter((a) => a.offsetParent).length), 0);
  // ★ は先頭にあり、件数を出す
  const first = await page.$eval('#nav a:not([hidden])', (a) => a.dataset.route);
  assert.equal(first, 'favorites');
  assert.equal(await page.textContent('#favCount'), '10');
  await page.click('#nav a.nav-fav');
  await waitPage(page, 'favorites');
  // 10 件でも 1 画面に収まる（タイルの一覧の下端が画面内）
  await page.waitForTimeout(700);
  const bottom = await page.$eval('.fav-grid', (g) => g.getBoundingClientRect().bottom);
  const vh = await page.evaluate(() => innerHeight);
  assert.ok(bottom <= vh, `一覧の下端 ${bottom}px が画面の高さ ${vh}px を超えています`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, true);
  assert.deepEqual(page.errors, []);
  await ctx.close();
});

await t('PC：メニューの ★ は出さず、サイドメニューに「お気に入り」が並ぶ', async () => {
  const { page, ctx } = await open('home');
  await page.evaluate(() => localStorage.setItem('ctf.pins', JSON.stringify(['rsa', 'codec'])));
  await page.reload();
  await page.waitForSelector('[data-page]:not([hidden])');
  assert.equal(await page.isVisible('#nav a.nav-fav'), false);
  assert.deepEqual(await page.$$eval('#nav .nav-pinned', (as) => as.filter((a) => a.offsetParent).map((a) => a.dataset.route)), ['codec', 'rsa']);
  await ctx.close();
});

// ---------- キーボード操作 ----------
await t('キーボード：最初の Tab で「本文へ移動」が出て、押すと本文に移る', async () => {
  const { page, ctx } = await open('codec');
  await page.keyboard.press('Tab');
  assert.match((await activeInfo(page)).cls, /skip-link/);
  assert.ok(await page.isVisible('.skip-link'));
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => location.hash), '#codec', 'スキップでページが変わってはいけない');
  await page.keyboard.press('Tab');
  const a = await activeInfo(page);
  assert.equal(a.page, 'codec');
  assert.equal(a.inNav, false);
  await ctx.close();
});

await t('キーボード：メニューでページを選ぶと、次の Tab は本文から始まる', async () => {
  const { page, ctx } = await open('home');
  await page.focus('#nav a[data-route="xor"]');
  await page.keyboard.press('Enter');
  await waitPage(page, 'xor');
  const a = await activeInfo(page);
  assert.equal(a.tag, 'H1');
  assert.equal(a.page, 'xor');
  // 見出しに枠は出さない
  assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'none');
  await page.keyboard.press('Tab');
  assert.equal((await activeInfo(page)).page, 'xor');
  await ctx.close();
});

// ---------- スマホ ----------
await t('スマホ：主なページで横にはみ出さない', async () => {
  const { page, ctx } = await open('home', { device: 'iPhone 13' });
  for (const id of ['home', 'identify', 'codec', 'classic', 'rsa', 'rev', 'file', 'image', 'pcap', 'learn', 'dict', 'manuals', 'diff', 'notes']) {
    await page.goto(BASE + '#' + id);
    await page.waitForFunction((id) => !document.querySelector(`[data-page="${id}"]`).hidden, id);
    await page.waitForTimeout(150);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 0, `${id} が横に ${over}px はみ出しています`);
  }
  assert.deepEqual(page.errors, []);
  await ctx.close();
});

await t('スマホ：メニューの端のぼかしが、続きのある側にだけ出る', async () => {
  const { page, ctx } = await open('home', { device: 'iPhone 13' });
  const cls = () => page.$eval('#nav', (n) => [n.classList.contains('more-left'), n.classList.contains('more-right')]);
  assert.deepEqual(await cls(), [false, true]);
  await page.$eval('#nav', (n) => { n.scrollLeft = 200; n.dispatchEvent(new Event('scroll')); });
  await page.waitForTimeout(50);
  assert.deepEqual(await cls(), [true, true]);
  await page.$eval('#nav', (n) => { n.scrollLeft = n.scrollWidth; n.dispatchEvent(new Event('scroll')); });
  await page.waitForTimeout(50);
  assert.deepEqual(await cls(), [true, false]);
  // ぼかしは見える（フェードの途中で測らないよう、アニメーションを止めてから確かめる）
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
  assert.notEqual(await page.$eval('#nav', (n) => getComputedStyle(n, '::before').opacity), '0');
  await ctx.close();
});

await t('スマホ：通知はメニュー帯より下に出て、背景は不透明', async () => {
  const { page, ctx } = await open('home', { device: 'iPhone 13' });
  const r = await page.evaluate(async () => {
    const t = document.getElementById('toast');
    t.textContent = 'テスト';
    t.classList.add('show');
    await new Promise((ok) => setTimeout(ok, 300));
    return { top: t.getBoundingClientRect().top, navBottom: document.getElementById('nav').getBoundingClientRect().bottom, bg: getComputedStyle(t).backgroundColor };
  });
  assert.ok(r.top >= r.navBottom, `通知(${r.top})がメニュー帯(${r.navBottom})に重なっています`);
  assert.doesNotMatch(r.bg, /rgba\(.*,\s*0?\.\d+\)$/, `背景が半透明です: ${r.bg}`);
  await ctx.close();
});

await browser.close();
server.close();
console.log(`${passed} 件成功${failures.length ? `、${failures.length} 件失敗` : ''}`);
if (failures.length) process.exitCode = 1;
