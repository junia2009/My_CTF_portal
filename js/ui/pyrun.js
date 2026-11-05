// Python 実行（Pyodide）：問題のスクリプトや逆算コードを本物の Python で動かす。
// 初回だけ CDN から Pyodide を読み込む。実行は Web Worker の中（無限ループは「停止」で止める）。
import { $, h, copy, getPrefixes } from './common.js';
import { flagRegex } from '../lib/magic.js';

export const PYRUN_KEY = 'ctfportal.pyrunInput';

const TEMPLATES = [
  { name: '数値 → バイト列（long_to_bytes 相当）', code: `# RSA の結果など、大きな整数を文字に戻す
n = 408580457893337632211434854714810
b = n.to_bytes((n.bit_length() + 7) // 8, 'big')
print(b)            # バイト列
print(b.decode(errors='replace'))`},
  { name: 'ハッシュを総当たりで逆引き（許可された検証のみ）', code: `import hashlib, itertools, string
target = "5f4dcc3b5aa765d61d8327deb882cf99"   # 調べたい MD5
chars = string.ascii_lowercase
for n in range(1, 6):
    for t in itertools.product(chars, repeat=n):
        w = ''.join(t)
        if hashlib.md5(w.encode()).hexdigest() == target:
            print("見つかった:", w); raise SystemExit
print("この範囲では見つからず")`},
  { name: '判定式を逆算（文字コードの演算）', code: `# 問題のコードにあった配列と条件を写して逆算する
p = [70,152,195,284,475,612,791,896,810,850,737,1332,1469,1120,1470,832,1785,2196,1520,1480,1449]
flag = ''.join(chr(v // (i + 1)) for i, v in enumerate(p))
print(flag)`},
  { name: 'RC4 / XOR で復号', code: `def rc4(key, data):
    S = list(range(256)); j = 0
    for i in range(256):
        j = (j + S[i] + key[i % len(key)]) & 0xff
        S[i], S[j] = S[j], S[i]
    out = bytearray(); i = j = 0
    for b in data:
        i = (i + 1) & 0xff; j = (j + S[i]) & 0xff
        S[i], S[j] = S[j], S[i]
        out.append(b ^ S[(S[i] + S[j]) & 0xff])
    return bytes(out)

key = b"M6eMYngDGFbYE9HQ"
ct = bytes.fromhex("bfff1b0d47a7184fcbd65c5995617357b3d1949fac")
print(rc4(key, ct).decode(errors='replace'))

# XOR（繰り返し鍵）
# print(bytes(b ^ key[i % len(key)] for i, b in enumerate(ct)))`},
  { name: 'base64 / hex / bytes の変換', code: `import base64
s = b"flag{example}"
print("hex   :", s.hex())
print("b64   :", base64.b64encode(s).decode())
print("戻す  :", base64.b64decode(base64.b64encode(s)))
print("int   :", int.from_bytes(s, 'big'))`},
];

export function initPyrun() {
  const code = $('pyCode'), out = $('pyOut'), tpl = $('pyTpl'), runBtn = $('pyRun'), stopBtn = $('pyStop'), statusEl = $('pyStatus');
  let worker = null, running = false, loaded = false;

  tpl.append(...TEMPLATES.map((t, i) => h('option', { value: i }, t.name)));
  tpl.addEventListener('change', () => { if (tpl.value !== '') { code.value = TEMPLATES[+tpl.value].code; tpl.value = ''; } });
  code.value = '';
  code.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); code.setRangeText('    ', code.selectionStart, code.selectionEnd, 'end'); }
  });
  $('pyClear').addEventListener('click', () => { code.value = ''; out.replaceChildren(); code.focus(); });
  runBtn.addEventListener('click', run);
  stopBtn.addEventListener('click', stop);

  function setStatus(text, cls = '') { statusEl.className = `py-status ${cls}`; statusEl.textContent = text; }

  function makeWorker() {
    const w = new Worker(new URL('./pyworker.js', import.meta.url));
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'status') {
        if (m.phase === 'loading') setStatus('Python（Pyodide）を読み込み中… 初回は少し時間がかかります', 'load');
        else if (m.phase === 'ready') { loaded = true; setStatus('Python 準備完了', 'ok'); }
      } else if (m.type === 'out') {
        appendOut(m.text, m.stream);
      } else if (m.type === 'done') {
        finish(m);
      } else if (m.type === 'loaderror') {
        running = false; runBtn.disabled = false; stopBtn.disabled = true;
        setStatus('読み込み失敗', 'err');
        appendOut(m.message, 'err');
      }
    };
    w.onerror = (e) => { appendOut(`Worker エラー：${e.message}`, 'err'); running = false; runBtn.disabled = false; stopBtn.disabled = true; };
    return w;
  }

  let lines, head;
  function freshOutput() {
    lines = h('div', { class: 'jr-lines' });
    head = h('div', { class: 'jr-head' }, h('span', {}, '実行中…'));
    out.replaceChildren(h('div', { class: 'wf-code jr-result' }, head, lines));
  }
  function appendOut(text, stream = 'out') {
    if (!lines) freshOutput();
    for (const line of String(text).replace(/\n$/, '').split('\n')) {
      lines.append(h('div', { class: `jr-line jr-${stream === 'err' ? 'error' : 'log'}` }, h('span', { class: 'jr-text' }, line)));
    }
  }

  function finish(m) {
    running = false; runBtn.disabled = false; stopBtn.disabled = true;
    setStatus(loaded ? 'Python 準備完了' : '完了', loaded ? 'ok' : '');
    if (m.error) appendOut(m.error, 'err');
    if (m.result !== null && m.result !== undefined && m.result !== 'None') appendOut('→ ' + m.result, 'out');
    if (!lines.childElementCount) appendOut('（出力なし）');
    const all = [...lines.querySelectorAll('.jr-text')].map((x) => x.textContent).join('\n');
    const re = flagRegex(getPrefixes());
    const flags = [...new Set([...all.matchAll(new RegExp(re.source + '|FLAG_[A-Za-z0-9_]{3,}', 'gi'))].map((x) => x[0]))];
    head.replaceChildren(h('span', {}, m.error ? 'エラー' : '完了'), h('span', { class: 'hint' }, `${m.ms} ms`),
      h('button', { type: 'button', class: 'ghost small', onclick: () => copy(all) }, 'コピー'));
    if (flags.length) out.append(h('div', { class: 'wf-flag' }, 'フラグらしき文字列：', ...flags.map((f) => h('code', {}, f))));
  }

  function run() {
    if (running || !code.value.trim()) return;
    running = true; runBtn.disabled = true; stopBtn.disabled = false;
    if (!worker) worker = makeWorker();
    freshOutput();
    if (!loaded) setStatus('Python（Pyodide）を読み込み中…', 'load');
    worker.postMessage({ type: 'run', code: code.value, stdin: $('pyInput').value, base: (typeof window !== 'undefined' && window.__PYODIDE_BASE__) || undefined });
  }

  function stop() {
    if (worker) { worker.terminate(); worker = null; loaded = false; }
    running = false; runBtn.disabled = false; stopBtn.disabled = true;
    setStatus('停止しました（次の実行で読み込み直します）', 'err');
    if (head) head.replaceChildren(h('span', {}, '停止'));
  }

  stopBtn.disabled = true;
  setStatus('未読み込み（実行すると Pyodide を取得します）');

  const takeSent = () => {
    try {
      const sent = sessionStorage.getItem(PYRUN_KEY);
      if (sent) { sessionStorage.removeItem(PYRUN_KEY); code.value = sent; out.replaceChildren(); }
    } catch {}
  };
  takeSent();
  return takeSent;
}
