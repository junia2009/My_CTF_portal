// 数論計算機 / バイナリビューア / 文字化け修復 / 差分比較 / 正規表現テスター
import * as NT from '../lib/numtheory.js';
import { readValues, unpack } from '../lib/binview.js';
import { repairCandidates, decodeAll } from '../lib/mojibake.js';
import { diffLines, diffChars, diffBytes } from '../lib/diff.js';
import { hexdump } from '../lib/file.js';
import { bytesToHex, hexToBytes, latin1Decode } from '../lib/codecs.js';
import { DEFAULT_FLAG_PATTERN } from '../lib/flag.js';
import { $, h, copy, kvRow, debounce, readBytes, setTable, registerReceiver, fill, openTab } from './common.js';

// ================= 数論計算機 =================
export function initMath() {
  const P = (id) => NT.parseBig($(id).value);

  $('facRun').addEventListener('click', () => {
    const out = $('facOut');
    let n;
    try {
      n = P('facIn');
      if (n === null) return;
    } catch (e) {
      out.replaceChildren(kvRow('エラー', e.message, false));
      return;
    }
    out.replaceChildren(kvRow('状態', 'COMPUTING…', false));
    $('facRun').disabled = true;
    setTimeout(() => {
      const t0 = performance.now();
      const r = NT.factorize(n);
      const rows = [
        kvRow('入力', n.toString()),
        kvRow('ビット長', String(n.toString(2).length), false),
        kvRow('素因数分解', NT.formatFactors(r.factors) + (r.rest.length ? ` × ${r.rest.map((x) => `[未分解 ${x}]`).join(' × ')}` : '')),
        kvRow('素数？', NT.isProbablePrime(n) ? 'はい（素数）' : 'いいえ', false),
      ];
      if (r.complete) {
        rows.push(kvRow('φ(n)', NT.phiFromFactors(r.factors).toString()));
        rows.push(kvRow('約数の個数', [...r.factors.values()].reduce((a, e) => a * (e + 1n), 1n).toString(), false));
      } else rows.push(kvRow('注意', '時間内に分解しきれない因数が残りました。大きな素数2つの積（RSA の n など）は、この方法では分解できません。', false));
      rows.push(kvRow('計算時間', `${Math.round(performance.now() - t0)} ms`, false));
      out.replaceChildren(...rows);
      $('facRun').disabled = false;
    }, 30);
  });
  $('facIn').addEventListener('keydown', (e) => e.key === 'Enter' && $('facRun').click());

  const modular = () => {
    $('modErr').textContent = '';
    const out = $('modOut');
    try {
      const a = P('mA'), b = P('mB'), n = P('mN');
      const rows = [];
      if (a !== null && n !== null) {
        rows.push(kvRow('gcd(a, n)', NT.gcd(a, n).toString()), kvRow('lcm(a, n)', NT.lcm(a, n).toString()));
        const { g, x, y } = NT.egcd(a, n);
        rows.push(kvRow('拡張ユークリッド', `${a}·(${x}) + ${n}·(${y}) = ${g}`));
        try {
          rows.push(kvRow('a⁻¹ mod n', NT.modInv(a, n).toString()));
        } catch {
          rows.push(kvRow('a⁻¹ mod n', '存在しません（a と n が互いに素ではない）', false));
        }
        rows.push(kvRow('a mod n', (((a % n) + n) % n).toString()));
      }
      if (a !== null && b !== null && n !== null) {
        if (b < 0n) rows.push(kvRow('aᵇ mod n', NT.modPow(NT.modInv(a, n), -b, n).toString()));
        else rows.push(kvRow('aᵇ mod n', NT.modPow(a, b, n).toString()));
      }
      out.replaceChildren(...rows);
    } catch (e) {
      $('modErr').textContent = e.message;
    }
  };
  ['mA', 'mB', 'mN'].forEach((id) => $(id).addEventListener('input', debounce(modular, 200)));

  $('crtIn').addEventListener('input', debounce(() => {
    $('crtErr').textContent = '';
    $('crtOut').replaceChildren();
    const rows = $('crtIn').value.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!rows.length) return;
    try {
      const pairs = rows.map((l) => {
        const m = l.split(/[\s,;]+/).filter(Boolean);
        if (m.length < 2) throw new Error(`「${l}」：余りと法を、カンマ区切りで書いてください`);
        return [NT.parseBig(m[0]), NT.parseBig(m[1])];
      });
      const r = NT.crt(pairs.map((p) => p[0]), pairs.map((p) => p[1]));
      $('crtOut').append(kvRow('x', r.x.toString()), kvRow('法（全体）', r.m.toString()), kvRow('一般解', `x = ${r.x} + ${r.m}·k`));
    } catch (e) {
      $('crtErr').textContent = e.message;
    }
  }, 250));

  const root = () => {
    $('rtErr').textContent = '';
    $('rtOut').replaceChildren();
    try {
      const n = P('rtN'), k = Number($('rtK').value);
      if (n === null) return;
      if (!(k >= 2 && k <= 1000)) throw new Error('n は 2〜1000 で指定してください');
      const r = NT.iroot(n, k);
      const exact = r ** BigInt(k) === n;
      $('rtOut').append(
        kvRow(`${k} 乗根（切り捨て）`, r.toString()),
        kvRow('ちょうど割り切れる？', exact ? 'はい（完全な累乗）' : `いいえ（残り ${n - r ** BigInt(k)}）`, false),
        kvRow('素数？', NT.isProbablePrime(n) ? 'はい' : 'いいえ', false),
        kvRow('ビット長', String(n.toString(2).length), false),
      );
    } catch (e) {
      $('rtErr').textContent = e.message;
    }
  };
  ['rtN', 'rtK'].forEach((id) => $(id).addEventListener('input', debounce(root, 200)));

  registerReceiver('math', (p) => {
    if (p.factor) {
      openTab('factor');
      $('facIn').value = p.factor;
      $('facRun').click();
    }
    if (p.crt) {
      openTab('crt');
      fill('crtIn', p.crt);
    }
  });
}

// ================= バイナリビューア =================
export function initBinview() {
  let bytes = new Uint8Array();
  const offset = () => {
    const v = $('bvOff').value.trim();
    const n = /^0x/i.test(v) ? parseInt(v, 16) : parseInt(v, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, n);
  };
  function parse() {
    $('bvErr').textContent = '';
    try {
      bytes = $('bvIn').value.trim() ? readBytes($('bvIn').value, $('bvFmt').value) : new Uint8Array();
    } catch (e) {
      $('bvErr').textContent = e.message;
      bytes = new Uint8Array();
    }
    $('bvDump').textContent = bytes.length ? hexdump(bytes, 0, 1024) : '';
    values();
    structRead();
  }
  function values() {
    const o = offset();
    if (!bytes.length || o >= bytes.length) return $('bvTable').replaceChildren();
    setTable($('bvTable'), ['型', 'バイト', 'リトルエンディアン', 'ビッグエンディアン'], readValues(bytes, o).map((v) =>
      h('tr', {}, h('td', { class: 'num' }, v.type), h('td', { class: 'num' }, v.size),
        h('td', { class: 'copyable', onclick: () => copy(v.le) }, v.le),
        h('td', v.be === null ? {} : { class: 'copyable', onclick: () => copy(v.be) }, v.be ?? '—'))));
  }
  function structRead() {
    $('bvStructErr').textContent = '';
    $('bvStructOut').replaceChildren();
    const f = $('bvStruct').value.trim();
    if (!f || !bytes.length) return;
    try {
      const r = unpack(f, bytes, offset());
      $('bvStructOut').append(...r.values.map((v, i) => kvRow(`[${i}] ${v.code}`, v.value instanceof Uint8Array ? `${latin1Decode(v.value).replace(/[^\x20-\x7e]/g, '·')}  (${bytesToHex(v.value)})` : String(v.value))), kvRow('読んだバイト数', String(r.size), false));
    } catch (e) {
      $('bvStructErr').textContent = e.message;
    }
  }
  $('bvIn').addEventListener('input', debounce(parse, 200));
  $('bvFmt').addEventListener('change', parse);
  $('bvOff').addEventListener('input', debounce(() => { values(); structRead(); }, 150));
  $('bvStruct').addEventListener('input', debounce(structRead, 200));
  registerReceiver('binview', (p) => {
    $('bvFmt').value = p.fmt ?? 'hex';
    fill('bvIn', p.text);
    if (p.struct) fill('bvStruct', p.struct);
  });
}

// ================= 文字化け修復 =================
export function initMojibake() {
  const label = { 'windows-1252': 'Windows-1252（欧米）', 'iso-8859-2': 'ISO-8859-2', 'koi8-r': 'KOI8-R（ロシア語）', shift_jis: 'Shift_JIS', 'euc-jp': 'EUC-JP', gbk: 'GBK（中国語）', big5: 'Big5（繁体字）', 'euc-kr': 'EUC-KR（韓国語）', 'utf-8': 'UTF-8', 'iso-2022-jp': 'ISO-2022-JP（JIS）', 'utf-16le': 'UTF-16LE', 'utf-16be': 'UTF-16BE' };
  const L = (e) => label[e] ?? e;
  function run() {
    const out = $('mjOut');
    const v = $('mjIn').value;
    if (!v.trim()) return out.replaceChildren();
    if ($('mjFmt').value === 'hex') {
      let bytes;
      try {
        bytes = hexToBytes(v);
      } catch (e) {
        out.replaceChildren(h('p', { class: 'error' }, e.message));
        return;
      }
      const list = decodeAll(bytes);
      out.replaceChildren(...(list.length ? list.map((c, i) => card(L(c.enc), 'として読むと', c.text, i === 0)) : [h('p', { class: 'hint' }, 'どの文字コードでも読めませんでした')]));
      return;
    }
    const r = repairCandidates(v);
    out.replaceChildren(...(r.candidates.length
      ? r.candidates.map((c, i) => card(`本来は ${L(c.to)}`, `を ${L(c.from)} として誤って表示していた${c.lost ? `（化けた時点で ${c.lost} 文字が失われています）` : ''}`, c.text, i === 0))
      : [h('p', { class: 'hint' }, 'これより読みやすくなる組み合わせは見つかりませんでした。化けていない文字列か、もう一段化けているのかもしれません（候補をもう一度貼ってみてください）。')]));
  }
  const card = (title, sub, text, best) => h('div', { class: `card mj-card${best ? ' best' : ''}` },
    h('div', { class: 'mj-head' }, best ? h('span', { class: 'tag' }, '最有力') : '', h('b', {}, title), h('span', { class: 'hint' }, sub)),
    h('div', { class: 'mono-out', onclick: () => copy(text) }, text));
  $('mjIn').addEventListener('input', debounce(run, 300));
  $('mjFmt').addEventListener('change', run);
  registerReceiver('mojibake', (p) => {
    $('mjFmt').value = p.fmt ?? 'text';
    fill('mjIn', p.text);
  });
}

// ================= 差分比較 =================
export function initDiff() {
  function run() {
    const a = $('dfA').value, b = $('dfB').value, mode = $('dfMode').value;
    const out = $('dfOut');
    if (!a && !b) {
      out.replaceChildren();
      $('dfInfo').textContent = '';
      return;
    }
    if (mode === 'hex') {
      let A, B;
      try {
        A = hexToBytes(a);
        B = hexToBytes(b);
      } catch (e) {
        out.replaceChildren(h('p', { class: 'error' }, e.message));
        return;
      }
      const d = diffBytes(A, B);
      $('dfInfo').textContent = `違うバイト ${d.positions.length} か所（A ${A.length} B / B ${B.length} B）`;
      out.replaceChildren(
        h('table', { class: 'kv' },
          kvRow('違う位置', d.positions.slice(0, 200).map((p) => `0x${p.toString(16)}`).join(', ') + (d.positions.length > 200 ? ' …' : '') || 'なし'),
          kvRow('A XOR B（Hex）', bytesToHex(d.xor)),
          kvRow('A XOR B（文字）', latin1Decode(d.xor).replace(/[^\x20-\x7e]/g, '·')),
        ),
      );
      return;
    }
    const ops = mode === 'char' ? diffChars(a, b) : diffLines(a, b);
    const add = ops.filter((o) => o.type === 'add').length, del = ops.filter((o) => o.type === 'del').length;
    $('dfInfo').textContent = add + del ? `追加 ${add}・削除 ${del}（${mode === 'char' ? '文字' : '行'}）` : '違いはありません';
    if (mode === 'char') {
      out.replaceChildren(h('div', { class: 'diff-inline' }, ...ops.map((o) => (o.type === 'eq' ? o.text : h(o.type === 'add' ? 'ins' : 'del', {}, o.text)))));
    } else {
      out.replaceChildren(...ops.slice(0, 5000).map((o) => h('div', { class: `dl ${o.type}` }, h('span', { class: 'dm' }, o.type === 'add' ? '+' : o.type === 'del' ? '−' : ' '), o.text || ' ')));
    }
  }
  ['dfA', 'dfB'].forEach((id) => $(id).addEventListener('input', debounce(run, 250)));
  $('dfMode').addEventListener('change', run);
  registerReceiver('diff', (p) => {
    $('dfMode').value = p.mode ?? 'line';
    $('dfA').value = p.a;
    fill('dfB', p.b);
  });
}

// ================= 正規表現テスター =================
export function initRegex() {
  const PRESETS = [
    ['フラグ形式', DEFAULT_FLAG_PATTERN],
    ['IPv4', String.raw`\b(?:\d{1,3}\.){3}\d{1,3}\b`],
    ['Base64', String.raw`[A-Za-z0-9+/]{16,}={0,2}`],
    ['Hex 列', String.raw`(?:[0-9a-fA-F]{2}){8,}`],
    ['メールアドレス', String.raw`[\w.+-]+@[\w-]+\.[\w.-]+`],
    ['URL', String.raw`https?://[^\s"'<>]+`],
    ['日時（ISO）', String.raw`\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}`],
  ];
  $('rxPresets').append(h('span', { class: 'hint' }, 'よく使う：'), ...PRESETS.map(([name, pat]) =>
    h('button', { type: 'button', class: 'ghost small', onclick: () => fill('rxPat', pat) }, name)));

  function run() {
    $('rxErr').textContent = '';
    const pat = $('rxPat').value, text = $('rxText').value.slice(0, 200000);
    const flags = [...document.querySelectorAll('.rxFlag:checked')].map((x) => x.value).join('');
    ['rxHl', 'rxTable', 'rxRepOut'].forEach((id) => $(id).replaceChildren());
    $('rxInfo').textContent = '';
    if (!pat) return;
    let re;
    try {
      re = new RegExp(pat, flags.includes('g') ? flags : flags + 'g');
    } catch (e) {
      $('rxErr').textContent = '正規表現が不正です：' + e.message;
      return;
    }
    const matches = [];
    for (const m of text.matchAll(re)) {
      matches.push(m);
      if (!flags.includes('g') || matches.length >= 1000) break;
    }
    $('rxInfo').textContent = `${matches.length} 件マッチ${matches.length >= 1000 ? '（1000 件まで表示）' : ''}`;
    // ハイライト表示
    const parts = [];
    let last = 0;
    for (const m of matches) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      parts.push(h('mark', {}, m[0] || '∅'));
      last = m.index + m[0].length;
    }
    parts.push(text.slice(last));
    $('rxHl').append(...parts);
    if (matches.length) {
      const groups = Math.max(0, ...matches.map((m) => m.length - 1));
      setTable($('rxTable'), ['#', '位置', 'マッチ', ...Array.from({ length: groups }, (_, i) => `$${i + 1}`)], matches.slice(0, 300).map((m, i) =>
        h('tr', {}, h('td', { class: 'num' }, i + 1), h('td', { class: 'num' }, m.index), h('td', { class: 'copyable', onclick: () => copy(m[0]) }, m[0]),
          ...Array.from({ length: groups }, (_, g) => h('td', {}, m[g + 1] ?? '')))));
    }
    if ($('rxRep').value) {
      const replaced = text.replace(new RegExp(pat, flags), $('rxRep').value);
      $('rxRepOut').append(h('h4', {}, '置換結果'), h('div', { class: 'mono-out', onclick: () => copy(replaced) }, replaced));
    }
  }
  ['rxPat', 'rxText', 'rxRep'].forEach((id) => $(id).addEventListener('input', debounce(run, 200)));
  document.querySelectorAll('.rxFlag').forEach((c) => c.addEventListener('change', run));
  registerReceiver('regex', (p) => {
    $('rxPat').value = p.pattern;
    fill('rxText', p.text);
  });
}
