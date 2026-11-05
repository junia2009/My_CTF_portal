// JS 実行：問題の JavaScript の一部や、逆算用に自分で書いたコードを安全に動かして結果を見る。
// 隔離 iframe（sandbox・同一オリジンなし・CSP で通信禁止）の中で Web Worker を起こして実行し、
// 時間切れになったら iframe ごと捨てる（無限ループでもポータルは固まらない）。
import { $, h, copy, store } from './common.js';

export const JSRUN_KEY = 'ctfportal.jsrunInput';

// Worker の中で動く起動コード（toString して埋め込む。外側の変数は使えない）
function workerBoot() {
  const fmt = (v, d = 0) => {
    if (typeof v === 'string') return d ? JSON.stringify(v) : v;
    if (typeof v === 'function') return `ƒ ${v.name || '(anonymous)'}()`;
    if (typeof v === 'bigint') return v + 'n';
    if (typeof v === 'symbol') return v.toString();
    if (v === null || typeof v !== 'object') return String(v);
    if (d > 2) return Array.isArray(v) ? '[…]' : '{…}';
    if (v instanceof Error) return `${v.name}: ${v.message}`;
    if (ArrayBuffer.isView(v)) return `${v.constructor.name}(${v.length}) [${Array.from(v.slice(0, 64)).join(', ')}${v.length > 64 ? ', …' : ''}]`;
    if (Array.isArray(v)) return `[${v.slice(0, 200).map((x) => fmt(x, d + 1)).join(', ')}${v.length > 200 ? `, … 全 ${v.length} 件` : ''}]`;
    if (v instanceof Map) return `Map(${v.size}) {${[...v].slice(0, 50).map(([k, x]) => `${fmt(k, d + 1)} => ${fmt(x, d + 1)}`).join(', ')}}`;
    if (v instanceof Set) return `Set(${v.size}) {${[...v].slice(0, 50).map((x) => fmt(x, d + 1)).join(', ')}}`;
    try { return `{${Object.keys(v).slice(0, 50).map((k) => `${k}: ${fmt(v[k], d + 1)}`).join(', ')}}`; } catch { return String(v); }
  };
  const send = (level, args) => postMessage({ type: 'log', level, text: args.map((a) => fmt(a)).join(' ') });
  self.console = {};
  ['log', 'info', 'warn', 'error', 'debug', 'table', 'dir'].forEach((k) => (console[k] = (...a) => send(k === 'error' || k === 'warn' ? k : 'log', a)));
  self.alert = (m) => send('alert', [m === undefined ? '' : m]);
  self.confirm = (m) => { send('alert', ['[confirm] ' + (m ?? '')]); return true; };

  // よく使う画面まわりの最小限のまね（$ / document）。フォーム送信は「すぐ送信された」として扱う
  let INPUT = '';
  const fakeEvent = { preventDefault() {}, stopPropagation() {}, target: null };
  const el = (sel) => {
    const o = {
      __fake: true, selector: sel, length: 1,
      get value() { return INPUT; }, set value(v) { INPUT = String(v); },
      val(v) { if (v === undefined) return INPUT; INPUT = String(v); return o; },
      text(v) { if (v === undefined) return ''; send('dom', [`${sel} ← text: ${v}`]); return o; },
      html(v) { if (v === undefined) return ''; send('dom', [`${sel} ← html: ${v}`]); return o; },
      get innerText() { return ''; }, set innerText(v) { send('dom', [`${sel} ← ${v}`]); },
      get textContent() { return ''; }, set textContent(v) { send('dom', [`${sel} ← ${v}`]); },
      get innerHTML() { return ''; }, set innerHTML(v) { send('dom', [`${sel} ← ${v}`]); },
      on(type, a, b) { const fn = typeof a === 'function' ? a : b; send('dom', [`${sel} の ${type} を実行（入力値 = ${JSON.stringify(INPUT)}）`]); const r = fn.call(o, fakeEvent); return o; },
      addEventListener(type, fn) { o.on(type, fn); },
      submit(fn) { return fn ? o.on('submit', fn) : o; }, click(fn) { return fn ? o.on('click', fn) : o; },
      keyup(fn) { return fn ? o.on('keyup', fn) : o; }, change(fn) { return fn ? o.on('change', fn) : o; },
      attr() { return ''; }, css() { return o; }, show() { return o; }, hide() { return o; }, addClass() { return o; }, removeClass() { return o; },
      append() { return o; }, find(s) { return el(s); }, each() { return o; }, getAttribute() { return ''; }, setAttribute() {},
      style: {}, classList: { add() {}, remove() {}, toggle() {} },
    };
    return o;
  };
  self.$ = self.jQuery = (a) => (typeof a === 'function' ? (a(), el('document')) : el(String(a)));
  self.document = {
    querySelector: el, getElementById: (i) => el('#' + i), querySelectorAll: (s) => [el(s)],
    getElementsByTagName: (s) => [el(s)], getElementsByName: (s) => [el(`[name=${s}]`)], forms: [el('form')],
    write: (...a) => send('dom', ['[document.write] ' + a.join('')]), writeln: (...a) => send('dom', ['[document.write] ' + a.join('')]),
    addEventListener: (t, fn) => fn(fakeEvent), cookie: '', title: '', body: el('body'),
    location: { href: 'about:sandbox', hash: '', search: '' },
  };
  self.window = self;
  self.location = self.document.location;
  self.addEventListener = ((orig) => (t, fn, o) => (t === 'load' || t === 'DOMContentLoaded' ? fn(fakeEvent) : orig.call(self, t, fn, o)))(self.addEventListener);
  try { delete self.fetch; self.fetch = () => Promise.reject(new Error('サンドボックスでは通信できません')); } catch {}
  try { self.XMLHttpRequest = function () { throw new Error('サンドボックスでは通信できません'); }; } catch {}

  onmessage = (ev) => {
    INPUT = String(ev.data.input ?? '');
    let value, err = '';
    try { value = (0, eval)(ev.data.code); } catch (e) {
      err = e && e.stack ? String(e.stack).split('\n').filter((l) => !/onmessage|blob:/.test(l)).slice(0, 3).join('\n') : String(e);
    }
    if (value && value.__fake) value = undefined; // $(…) の戻り値（まね部品）は表示しない
    const finish = (v) => postMessage({ type: 'done', value: v === undefined ? undefined : fmt(v, 1), err });
    if (value && typeof value.then === 'function') value.then(finish, (e) => { err = String(e); finish(undefined); });
    else finish(value);
  };
}

// iframe（不透明オリジン・CSP）の中で Worker を起こし、メッセージを中継する
function frameBoot(TK, WORKER_SRC) {
  const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
  const w = new Worker(url);
  w.onmessage = (e) => parent.postMessage({ tk: TK, ...e.data }, '*');
  w.onerror = (e) => { e.preventDefault(); parent.postMessage({ tk: TK, type: 'done', err: e.message || 'エラー' }, '*'); };
  addEventListener('message', (ev) => { if (ev.data && ev.data.tk === TK) w.postMessage({ code: ev.data.code, input: ev.data.input }); });
  parent.postMessage({ tk: TK, type: 'ready' }, '*');
}

export function runJs(code, { input = '', timeoutMs = 3000, onLog = () => {} } = {}) {
  return new Promise((resolve) => {
    const ifr = document.createElement('iframe');
    ifr.setAttribute('sandbox', 'allow-scripts');
    ifr.style.display = 'none';
    ifr.setAttribute('aria-hidden', 'true');
    const token = 'jr' + Math.random().toString(36).slice(2);
    const workerSrc = '(' + workerBoot.toString() + ')();';
    ifr.srcdoc = '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\' blob:; worker-src blob:">'
      + '<script>(' + frameBoot.toString() + ')(' + JSON.stringify(token) + ',' + JSON.stringify(workerSrc).replace(/<\//g, '<\\/') + ');<\/script>';
    let finished = false;
    const t0 = performance.now();
    const end = (r) => { if (finished) return; finished = true; removeEventListener('message', onMsg); ifr.remove(); resolve({ ...r, ms: Math.round(performance.now() - t0) }); };
    const onMsg = (e) => {
      if (!e.data || e.data.tk !== token) return;
      if (e.data.type === 'ready') ifr.contentWindow.postMessage({ tk: token, code: String(code), input }, '*');
      else if (e.data.type === 'log') onLog(e.data.level, e.data.text);
      else if (e.data.type === 'done') end({ value: e.data.value, err: e.data.err || '' });
    };
    addEventListener('message', onMsg);
    document.body.appendChild(ifr);
    setTimeout(() => end({ err: `時間切れ（${timeoutMs / 1000} 秒）で停止しました。無限ループや重い総当たりの可能性があります`, timeout: true }), timeoutMs);
  });
}

const TEMPLATES = [
  { name: '数値配列 → 文字列（よくある変換を総当たり）', code: `// 問題の中の数値配列を p に貼ると、よくある変換を全部試して読める候補を上から並べます
var p = [70,152,195,284,475,612,791,896,810,850,737,1332,1469,1120,1470,832,1785,2196,1520,1480,1449];

var tries = {
  'そのまま':        (v, i) => v,
  '÷ (i+1)':         (v, i) => v / (i + 1),
  '÷ i（0 番目除く）': (v, i) => i ? v / i : v,
  '- i':             (v, i) => v - i,
  '+ i':             (v, i) => v + i,
  'XOR i':           (v, i) => v ^ i,
  'XOR (i+1)':       (v, i) => v ^ (i + 1),
  '- 前の値':         (v, i, a) => i ? v - a[i - 1] : v,
  'XOR 前の値':       (v, i, a) => i ? v ^ a[i - 1] : v,
};
for (var k = 1; k < 256; k++) ((k) => {
  tries['XOR ' + k] = (v) => v ^ k;
  tries['- ' + k] = (v) => v - k;
})(k);

var score = (s) => (s.match(/[A-Za-z0-9_{}]/g) || []).length / s.length + (/flag|ctf|FLAG|\\{/.test(s) ? 1 : 0);
var res = [];
for (var name in tries) {
  var codes = p.map((v, i) => tries[name](v, i, p));
  if (codes.every((c) => Number.isInteger(c) && c >= 32 && c < 127)) {
    var s = String.fromCharCode(...codes);
    res.push([score(s), name, s]);
  }
}
res.sort((a, b) => b[0] - a[0]).slice(0, 10).forEach((r) => console.log(r[1].padEnd(10), '→', r[2]));
res.length ? '候補 ' + res.length + ' 件' : '読める文字列になる変換は見つかりませんでした';` },
  { name: '1文字ずつ総当たり（判定関数がある場合）', code: `// 判定が「1文字ずつ独立」なら、各位置に全文字を当てはめて合う文字を探せます。
// check(文字, 位置) を問題の式に合わせて書き換えてください
var p = [70,152,195,284,475];
var check = (c, i) => c.charCodeAt(0) * (i + 1) === p[i];

var ans = '';
for (var i = 0; i < p.length; i++) {
  var hit = '';
  for (var c = 32; c < 127; c++) if (check(String.fromCharCode(c), i)) { hit = String.fromCharCode(c); break; }
  ans += hit || '?';
}
ans` },
  { name: '問題のフォームを動かす（入力値を試す）', code: `// 問題のコードをそのまま貼り、下の「フォームの入力値」に候補を入れて実行。
// $(…).submit / addEventListener('submit') はすぐ実行され、alert の内容が結果に出ます
$(function(){$("form").submit(function(){var t=$('input[type="text"]').val();
  if (t === 'secret') alert('OK!'); else alert('No'); return false;});});` },
  { name: '文字コード・エンコードの変換', code: `var s = 'flag{example}';
console.log('文字コード', [...s].map((c) => c.charCodeAt(0)));
console.log('16進', [...s].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
console.log('Base64', btoa(s));
console.log('Base64 戻す', atob(btoa(s)));
console.log('\\\\u 形式', [...s].map((c) => '\\\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join(''));
String.fromCharCode(102, 108, 97, 103)` },
];

export function initJsrun() {
  const code = $('jrCode'), input = $('jrInput'), out = $('jrOut'), tpl = $('jrTpl'), runBtn = $('jrRun');
  tpl.append(...TEMPLATES.map((t, i) => h('option', { value: i }, t.name)));
  tpl.addEventListener('change', () => {
    if (tpl.value === '') return;
    code.value = TEMPLATES[+tpl.value].code;
    tpl.value = '';
  });
  code.value = store.get('ctfportal.jsrunCode', '') || TEMPLATES[0].code;
  code.addEventListener('input', () => store.set('ctfportal.jsrunCode', code.value));
  $('jrClear').addEventListener('click', () => { code.value = ''; out.replaceChildren(); store.set('ctfportal.jsrunCode', ''); code.focus(); });
  runBtn.addEventListener('click', run);
  code.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); code.setRangeText('  ', code.selectionStart, code.selectionEnd, 'end'); }
  });

  async function run() {
    if (!code.value.trim()) return;
    runBtn.disabled = true;
    const lines = h('div', { class: 'jr-lines' });
    const head = h('div', { class: 'jr-head' }, h('span', {}, '実行中…'));
    out.replaceChildren(h('div', { class: 'wf-code jr-result' }, head, lines));
    const add = (level, text) => lines.append(h('div', { class: `jr-line jr-${level}` }, h('span', { class: 'jr-tag' }, { log: '', alert: 'alert', dom: '画面', warn: '警告', error: 'エラー', value: '値' }[level] ?? ''), h('span', { class: 'jr-text' }, text)));
    let n = 0;
    const r = await runJs(code.value, { input: input.value, timeoutMs: +$('jrTime').value || 3000, onLog: (l, t) => { if (n++ < 2000) add(l, t); } });
    if (r.err) add('error', r.err);
    if (r.value !== undefined) add('value', r.value);
    if (!lines.childElementCount) add('log', '（出力なし）');
    const all = [...lines.querySelectorAll('.jr-text')].map((x) => x.textContent).join('\n');
    const flags = [...new Set([...all.matchAll(/[A-Za-z0-9_]{2,}\{[^}\n]{1,120}\}|FLAG_[A-Za-z0-9_]+/g)].map((m) => m[0]))];
    head.replaceChildren(h('span', {}, r.timeout ? '停止' : r.err ? 'エラー' : '完了'), h('span', { class: 'hint' }, `${r.ms} ms`),
      h('button', { type: 'button', class: 'ghost small', onclick: () => copy(all) }, 'コピー'));
    if (flags.length) out.append(h('div', { class: 'wf-flag' }, 'フラグらしき文字列：', ...flags.map((f) => h('code', {}, f))));
    runBtn.disabled = false;
  }

  const takeSent = () => {
    try {
      const sent = sessionStorage.getItem(JSRUN_KEY);
      if (sent) { sessionStorage.removeItem(JSRUN_KEY); code.value = sent; store.set('ctfportal.jsrunCode', sent); out.replaceChildren(); }
    } catch {}
  };
  takeSent();
  return takeSent;
}
