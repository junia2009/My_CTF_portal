// バイナリ解析：実行ファイルを読み込み、関数一覧・疑似コード・逆アセンブル・グラフ・データを表示する
import { parseBinary, extractStrings, readAt, notableKind, stringAt, regionOf } from '../lib/binfmt.js';
import { Program, makeDisassembler, addrLabel } from '../lib/rev.js';
import { decompile } from '../lib/decomp.js';
import { hexToBytes } from '../lib/codecs.js';
import { $, h, store, toast, copy, debounce, fmtSize, registerReceiver, sendTo, openTab, pallasSay } from './common.js';

const hex = (n) => '0x' + n.toString(16);
const abs = (p) => new URL(p, location.href).href;
const MAX_LIST = 1500;

// Capstone は通常のスクリプト（グローバル変数 MCapstone）として読み込む
let csPromise = null;
function loadCapstone() {
  csPromise ??= new Promise((resolve, reject) => {
    if (window.MCapstone) return resolve(window.MCapstone);
    const s = document.createElement('script');
    s.src = abs('vendor/capstone/capstone.js');
    s.onload = () => resolve(window.MCapstone);
    s.onerror = () => reject(new Error('逆アセンブラを読み込めませんでした'));
    document.head.append(s);
  }).then((M) => M({ locateFile: (f) => abs('vendor/capstone/' + f) }));
  csPromise.catch(() => (csPromise = null));
  return csPromise;
}

// 名前の変更とコメントは、ファイルごとにブラウザへ保存する
const fileKey = (bytes) => {
  let x = 0x811c9dc5;
  const step = Math.max(1, Math.floor(bytes.length / 65536));
  for (let i = 0; i < bytes.length; i += step) x = Math.imul(x ^ bytes[i], 16777619) >>> 0;
  return `ctfportal.rev.${bytes.length.toString(16)}.${x.toString(16)}`;
};

export function initRev() {
  let prog = null, bin = null, strings = [], key = null, notes = { names: {}, comments: {} };
  let cur = null; // 表示中の関数の先頭
  let selected = null; // 逆アセンブルで選んだ命令
  const history = [];
  let zoom = 1;
  let dataBytes = null;

  const prog_ = (label, p) => {
    const el = $('revProg');
    el.hidden = false;
    el.querySelector('i').style.width = `${Math.round((p ?? 0) * 100)}%`;
    el.querySelector('span').textContent = label;
  };

  // ---------- 読み込み ----------
  function dropzone() {
    const zone = $('revDrop');
    ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('over'); }));
    zone.addEventListener('drop', (e) => e.dataTransfer.files[0] && load(e.dataTransfer.files[0]));
    $('revIn').addEventListener('change', (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (f) load(f);
    });
  }

  async function load(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const b = parseBinary(bytes);
    if (!b) {
      toast('ELF / PE の実行ファイルではありません。ファイル解析で形式を確かめてください');
      return;
    }
    $('revDrop').querySelector('.dz-main').textContent = `${file.name}（${fmtSize(file.size)}）— 別のファイルを選ぶ`;
    await open(b, file.name);
  }

  async function open(b, name) {
    bin = b;
    let cs;
    try {
      prog_('逆アセンブラを準備中', 0);
      cs = await loadCapstone();
    } catch (e) {
      $('revProg').hidden = true;
      toast(e.message);
      return;
    }
    let dis;
    try {
      dis = makeDisassembler(cs, b.arch, b.bits, { thumb: b.thumb });
    } catch (e) {
      $('revProg').hidden = true;
      renderOverview(name);
      $('revAlerts').append(h('div', { class: 'alert' }, e.message));
      $('revResult').hidden = false;
      return;
    }
    prog = new Program(b, dis);
    await prog.analyze(prog_);
    $('revProg').hidden = true;
    key = fileKey(b.bytes);
    notes = store.get(key, { names: {}, comments: {} });
    for (const [a, n] of Object.entries(notes.names)) prog.names.set(parseInt(a, 16), n);
    strings = prog.stringRefs(extractStrings(b, 4));
    history.length = 0;
    renderOverview(name);
    renderFuncs();
    renderStrings();
    $('revResult').hidden = false;
    const main = prog.functions().find((f) => f.name === 'main' || f.name === 'WinMain' || f.name === 'wmain' || f.name === 'main.main');
    show(main?.addr ?? prog.entry, { tab: prog.x86 ? 'revcode' : 'revasm', push: false });
    const flagStr = strings.find((s) => /flag\{|ctf\{|correct|congrat|wrong|incorrect|password|正解|不正解/i.test(s.text) && s.refs.length);
    pallasSay({ kind: 'revLoaded', mood: main ? 'happy' : 'think', main: !!main, guessed: prog.mainGuessed, str: flagStr?.text, anchor: '#revFuncs' });
  }

  // 機械語を直接貼る（シェルコードなど）
  $('revRawGo').addEventListener('click', async () => {
    const text = $('revRawIn').value.replace(/\\x|0x|[\s,;]|\\u00/gi, '');
    if (!/^[0-9a-f]*$/i.test(text) || text.length < 2 || text.length % 2) {
      toast('16進のバイト列として読めませんでした');
      return;
    }
    const code = hexToBytes(text);
    const arch = $('revRawArch').value;
    const base = parseInt($('revRawBase').value, 16) || 0;
    // 仮の実行ファイルとして扱う（領域は1つだけ）
    const region = { name: 'shellcode', addr: base, off: 0, size: code.length, vsize: code.length, exec: true, write: false };
    const b = {
      format: 'RAW', bits: arch === 'x86' || arch === 'arm' || arch === 'thumb' ? 32 : 64, arch: arch === 'thumb' ? 'arm' : arch, thumb: arch === 'thumb',
      archName: $('revRawArch').selectedOptions[0].textContent, entry: base, imageBase: base, sections: [region], regions: [region],
      symbols: [], imports: [], slots: new Map(), props: [['形式', '機械語のみ（貼り付け）'], ['サイズ', `${code.length} バイト`]], warnings: [], bytes: code,
    };
    $('revDrop').querySelector('.dz-main').textContent = '実行ファイル（ELF / PE）をドロップ、またはクリックして選択';
    await open(b, 'shellcode');
  });

  // ---------- 概要 ----------
  function renderOverview(name) {
    $('revTitle').textContent = `${name} — ${bin.archName}`;
    const rows = [...bin.props, ['エントリポイント', hex(bin.entry)]];
    if (prog) rows.push(['解析結果', `命令 ${prog.insns.length.toLocaleString()} 個、関数 ${prog.funcStarts.length.toLocaleString()} 個${prog.mainGuessed ? '（main は _start から推測）' : ''}`]);
    $('revProps').replaceChildren(...rows.map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, v))));
    $('revAlerts').replaceChildren(...bin.warnings.map((w) => h('div', { class: 'alert' }, w)));
    // インポート：注目すべき関数を色分け
    const imps = [...new Map(bin.imports.map((i) => [i.name, i])).values()];
    if (!imps.length) {
      $('revImports').replaceChildren();
      return;
    }
    const chips = imps.map((i) => {
      const kind = notableKind(i.name);
      const stub = prog && [...prog.names].find(([, n]) => n === i.name)?.[0];
      const target = stub ?? i.slot;
      const callers = prog?.callers.get(target)?.size ?? 0;
      return h('button', {
        type: 'button', class: `chip${kind ? ' notable' : ''}`, title: kind ? `${kind}に関わる関数。呼び出し元を見ると判定の場所が分かりやすい` : '呼び出し元を表示',
        onclick: () => showCallersOf(target, i.name),
      }, kind ? h('span', { class: 'chip-kind' }, kind) : '', i.name, callers ? h('span', { class: 'chip-n' }, `×${callers}`) : '');
    });
    $('revImports').replaceChildren(h('div', { class: 'rev-sub' }, `使っているライブラリ関数（${imps.length}）— 色付きは CTF でよく注目する関数`), h('div', { class: 'chips' }, ...chips));
  }

  function showCallersOf(target, name) {
    const list = [...(prog?.callers.get(target) ?? [])];
    if (!list.length) return toast(`${name} を直接呼んでいる場所は見つかりませんでした`);
    if (list.length === 1) return show(prog.funcOf(list[0]), { tab: 'revasm', at: list[0] });
    $('revXrefs').replaceChildren(h('span', {}, `${name} の呼び出し元：`), ...list.slice(0, 30).map((a) => xrefLink(a)));
  }

  // ---------- 関数一覧 ----------
  function badges() {
    // 注目すべき関数（比較・入力・デバッガ検出）を呼んでいる関数に印を付ける
    const out = new Map();
    for (const [target, set] of prog.callers) {
      const name = prog.names.get(target) ?? prog.bin.slots.get(target);
      const kind = name && notableKind(name);
      if (!kind) continue;
      for (const a of set) {
        const f = prog.funcOf(a);
        if (f == null) continue;
        if (!out.has(f)) out.set(f, new Set());
        out.get(f).add(kind);
      }
    }
    return out;
  }
  let badgeMap = new Map();
  function renderFuncs() {
    badgeMap = badges();
    const q = $('revFuncQ').value.trim().toLowerCase();
    let list = prog.functions().filter((f) => !q || f.name.toLowerCase().includes(q) || f.addr.toString(16).includes(q.replace(/^0x/, '')));
    // main とエントリを先頭に
    const rank = (f) => (f.name === 'main' || f.name === 'main.main' ? 0 : f.addr === prog.entry ? 1 : badgeMap.has(f.addr) ? 2 : 3);
    list.sort((a, b) => rank(a) - rank(b) || a.addr - b.addr);
    const total = list.length;
    list = list.slice(0, MAX_LIST);
    $('revFuncs').replaceChildren(
      ...list.map((f) => h('button', { type: 'button', class: `rev-item${f.addr === cur ? ' active' : ''}`, 'data-a': f.addr, onclick: () => show(f.addr) },
        h('span', { class: 'rev-item-name' }, f.name),
        ...[...(badgeMap.get(f.addr) ?? [])].map((k) => h('span', { class: 'tag' }, k)),
        h('span', { class: 'rev-item-addr' }, addrLabel(f.addr)),
      )),
      total > MAX_LIST ? h('p', { class: 'hint' }, `ほか ${total - MAX_LIST} 個（名前で絞り込んでください）`) : '',
    );
  }
  $('revFuncQ').addEventListener('input', debounce(() => prog && renderFuncs(), 150));

  // ---------- 文字列 ----------
  function renderStrings() {
    const q = $('revStrQ').value.trim().toLowerCase();
    const onlyRef = $('revStrRef').checked;
    let list = strings.filter((s) => (!onlyRef || s.refs.length) && (!q || s.text.toLowerCase().includes(q)));
    const total = list.length;
    list = list.slice(0, MAX_LIST);
    $('revStrs').replaceChildren(
      ...list.map((s) => h('div', { class: 'rev-str' },
        h('div', { class: 'rev-str-text', title: s.text }, s.text),
        h('div', { class: 'rev-str-meta' },
          h('span', { class: 'rev-item-addr' }, s.addr != null ? addrLabel(s.addr) : `file+${hex(s.off)}`),
          s.enc !== 'ascii' ? h('span', { class: 'tag' }, s.enc) : '',
          ...s.refs.slice(0, 6).map((r) => xrefLink(r.at)),
          s.refs.length > 6 ? h('span', { class: 'hint' }, `ほか ${s.refs.length - 6}`) : '',
        ),
      )),
      !list.length ? h('p', { class: 'hint' }, onlyRef ? 'コードから使われている文字列はありません。チェックを外すと全部表示します。' : '見つかりませんでした') : '',
      total > MAX_LIST ? h('p', { class: 'hint' }, `ほか ${total - MAX_LIST} 件（絞り込んでください）`) : '',
    );
  }
  $('revStrQ').addEventListener('input', debounce(() => prog && renderStrings(), 150));
  $('revStrRef').addEventListener('change', () => prog && renderStrings());

  function xrefLink(a) {
    const f = prog.funcOf(a);
    const label = f != null ? `${prog.names.get(f)}+${hex(a - f)}` : hex(a);
    return h('button', { type: 'button', class: 'link', title: `${hex(a)} を逆アセンブルで見る`, onclick: () => show(f ?? a, { tab: 'revasm', at: a }) }, label);
  }

  // ---------- 関数の表示 ----------
  function show(addr, { tab, at = null, push = true } = {}) {
    if (addr == null || !prog) return;
    if (push && cur != null) history.push({ addr: cur, tab: activeTab() });
    cur = addr;
    selected = at;
    const name = prog.names.get(addr) ?? hex(addr);
    $('revFn').textContent = name;
    const g = prog.cfg(addr);
    $('revFnInfo').textContent = `${hex(addr)}・${g.blocks.length} ブロック・${g.blocks.reduce((s, b) => s + b.insns.length, 0)} 命令`;
    const callers = [...(prog.callers.get(addr) ?? [])];
    const refs = (prog.refsTo.get(addr) ?? []).filter((a) => !callers.includes(a));
    $('revXrefs').replaceChildren(
      ...(callers.length ? [h('span', {}, '呼び出し元：'), ...callers.slice(0, 12).map(xrefLink)] : [h('span', { class: 'hint' }, addr === prog.entry ? 'プログラムの入口（エントリポイント）です' : '直接の呼び出し元は見つかりませんでした（関数ポインタ経由の可能性）')]),
      ...(refs.length ? [h('span', {}, '　参照元：'), ...refs.slice(0, 6).map(xrefLink)] : []),
    );
    $('revBack').disabled = !history.length;
    document.querySelectorAll('#revFuncs .rev-item').forEach((el) => el.classList.toggle('active', +el.dataset.a === addr));
    renderCode();
    renderAsm();
    renderGraph();
    if (tab) openTab(tab);
    if (at != null) requestAnimationFrame(() => scrollToInsn(at));
  }
  const activeTab = () => document.querySelector('[data-page="rev"] .rev-main .tabs .active')?.dataset.tab;

  $('revBack').addEventListener('click', () => {
    const last = history.pop();
    if (last) show(last.addr, { tab: last.tab, push: false });
  });

  // 名前（関数名・データ名）をクリックで移動できる部品
  const nameIndex = () => {
    const m = new Map();
    for (const a of prog.funcStarts) m.set(prog.names.get(a), a);
    return m;
  };

  function renderCode() {
    const out = $('revCode');
    if (!prog.x86) {
      out.replaceChildren(h('p', { class: 'hint' }, '疑似コードは x86 / x64 のみ対応です。逆アセンブルとグラフで読んでください。'));
      return;
    }
    let res;
    try {
      res = decompile(prog, cur);
    } catch (e) {
      out.replaceChildren(h('p', { class: 'alert' }, `この関数の疑似コードは作れませんでした（${e.message}）。逆アセンブルで読んでください。`));
      return;
    }
    const names = nameIndex();
    const dataAddr = new Map();
    for (const [a, n] of prog.dataNames) dataAddr.set(n, a);
    out.replaceChildren(...res.lines.map((l) => {
      const row = h('div', { class: `rev-line${l.a != null ? ' has-addr' : ''}`, title: l.a != null ? `${hex(l.a)} の命令へ` : null });
      if (l.a != null) row.addEventListener('click', (e) => {
        if (e.target.closest('.tok-fn,.tok-data')) return;
        show(cur, { tab: 'revasm', at: l.a, push: true });
      });
      row.append(...highlight(l.text, names, dataAddr));
      return row;
    }));
  }

  // C 風のテキストに色を付け、関数名・データ名をリンクにする
  function highlight(text, names, dataAddr) {
    const parts = [];
    const re = /("(?:[^"\\]|\\.)*")|(\/\/.*$)|\b(if|else|while|do|return|goto|break|continue|void|int64_t|int32_t|uint8_t|uint16_t|unsigned)\b|\b(0x[0-9a-f]+|\d+)\b|([A-Za-z_][\w.@]*)(?=\()|\b((?:data|sub)_[0-9a-f]+|[A-Za-z_]\w*)\b/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      const [t] = m;
      if (m[1]) parts.push(h('span', { class: 'tok-str' }, t));
      else if (m[2]) parts.push(h('span', { class: 'tok-cmt' }, t));
      else if (m[3]) parts.push(h('span', { class: 'tok-kw' }, t));
      else if (m[4]) parts.push(h('span', { class: 'tok-num' }, t));
      else if (m[5]) {
        const a = names.get(t);
        parts.push(a != null ? h('button', { type: 'button', class: 'tok-fn link', onclick: () => show(a) }, t) : h('span', { class: 'tok-call' }, t));
      } else if (m[6]) {
        const a = dataAddr.get(t) ?? (/^data_([0-9a-f]+)$/.exec(t) ? parseInt(t.slice(5), 16) : null);
        if (a != null && !names.has(t)) parts.push(h('button', { type: 'button', class: 'tok-data link', title: 'データの中身を見る', onclick: () => showData(a) }, t));
        else if (/^(var|arg|stack)_/.test(t)) parts.push(h('span', { class: 'tok-var' }, t));
        else if (/^a\d$/.test(t)) parts.push(h('span', { class: 'tok-arg' }, t));
        else parts.push(t);
      }
      last = m.index + t.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  }

  // ---------- 逆アセンブル ----------
  function renderAsm() {
    const g = prog.cfg(cur);
    const rows = [];
    const bytesHex = (i) => {
      const b = readAt(bin, i.a, i.n);
      return b ? [...b].map((x) => x.toString(16).padStart(2, '0')).join(' ') : '';
    };
    for (const b of g.blocks) {
      const name = prog.names.get(b.start);
      if (b.start === cur || b.preds.length !== 1 || prog.cfg(cur).at.get(b.preds[0])?.end !== b.start) {
        rows.push(h('div', { class: 'asm-label' }, b.start === cur ? `${name ?? hex(b.start)}:` : `loc_${b.start.toString(16)}:`, b.preds.length > 1 ? h('span', { class: 'hint' }, `  ← ${b.preds.length} か所から`) : ''));
      }
      for (const i of b.insns) {
        const ann = prog.annotate(i);
        const user = notes.comments[i.a.toString(16)];
        let ops = i.o;
        const tgtName = i.t != null ? prog.names.get(i.t) : null;
        const opEl = h('span', { class: 'asm-op' });
        if (i.t != null) {
          const isFunc = prog.isFuncStart(i.t) || prog.importStubs.has(i.t);
          const label = tgtName ?? (g.at.has(i.t) ? `loc_${i.t.toString(16)}` : hex(i.t));
          opEl.append(h('button', { type: 'button', class: 'link', onclick: (e) => { e.stopPropagation(); if (isFunc && !prog.importStubs.has(i.t)) show(i.t); else scrollToInsn(i.t); } }, label));
        } else opEl.textContent = ops;
        const cmt = h('span', { class: 'asm-cmt' });
        if (ann) {
          if (i.ref != null && !prog.bin.slots?.has(i.ref)) cmt.append(h('button', { type: 'button', class: 'link', title: 'データの中身を見る', onclick: (e) => { e.stopPropagation(); showData(i.ref); } }, ann));
          else cmt.append(ann);
        }
        if (user) cmt.append(h('span', { class: 'asm-user' }, `// ${user}`));
        const kindCls = i.k === 'call' ? ' k-call' : i.k === 'jcc' || i.k === 'jmp' ? ' k-jump' : i.k === 'ret' ? ' k-ret' : /^(cmp|test)$/.test(i.m) ? ' k-cmp' : '';
        const row = h('div', { class: `asm-row${kindCls}${i.a === selected ? ' sel' : ''}`, 'data-a': i.a, onclick: () => select(i.a) },
          h('span', { class: 'asm-addr' }, addrLabel(i.a)),
          h('span', { class: 'asm-bytes' }, bytesHex(i)),
          h('span', { class: 'asm-mn' }, i.m),
          opEl,
          cmt,
        );
        rows.push(row);
      }
    }
    $('revAsm').replaceChildren(...rows);
  }
  function select(a) {
    selected = a;
    document.querySelectorAll('#revAsm .asm-row').forEach((r) => r.classList.toggle('sel', +r.dataset.a === a));
  }
  function scrollToInsn(a) {
    const f = prog.funcOf(a);
    if (f != null && f !== cur && !prog.cfg(cur).blocks.some((b) => a >= b.start && a < b.end)) {
      show(f, { tab: 'revasm', at: a });
      return;
    }
    openTab('revasm');
    select(a);
    const row = document.querySelector(`#revAsm .asm-row[data-a="${a}"]`);
    row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  $('revRename').addEventListener('click', () => {
    if (cur == null) return;
    const old = prog.names.get(cur);
    const n = prompt('新しい名前（英数字と _）', old);
    if (!n || !/^[A-Za-z_][\w.]*$/.test(n)) return n && toast('英数字と _ だけの名前にしてください');
    prog.names.set(cur, n);
    notes.names[cur.toString(16)] = n;
    store.set(key, notes);
    show(cur, { tab: activeTab(), push: false });
    renderFuncs();
  });
  $('revComment').addEventListener('click', () => {
    if (selected == null) {
      openTab('revasm');
      toast('逆アセンブルで行を選んでから押してください');
      return;
    }
    const k = selected.toString(16);
    const t = prompt(`${hex(selected)} のコメント（空にすると削除）`, notes.comments[k] ?? '');
    if (t == null) return;
    if (t.trim()) notes.comments[k] = t.trim();
    else delete notes.comments[k];
    store.set(key, notes);
    renderAsm();
    select(selected);
  });

  // ---------- グラフ ----------
  function renderGraph() {
    const g = prog.cfg(cur);
    const box = $('revGraph');
    if (g.blocks.length > 400) {
      box.replaceChildren(h('p', { class: 'hint' }, `ブロックが多すぎるため（${g.blocks.length} 個）グラフは省略します。逆アセンブルで読んでください。`));
      return;
    }
    const CH = 7.2, LH = 15, PAD = 8, MAXL = 22, MAXC = 46;
    const nodes = g.blocks.map((b) => {
      const lines = b.insns.map((i) => {
        const t = i.t != null ? (prog.names.get(i.t) ?? (g.at.has(i.t) ? `loc_${i.t.toString(16)}` : hex(i.t))) : i.o;
        const ann = prog.annotate(i);
        let s = `${i.m} ${t}`.trim() + (ann ? `  ; ${ann}` : '');
        return s.length > MAXC ? s.slice(0, MAXC - 1) + '…' : s;
      });
      const shown = lines.length > MAXL ? [...lines.slice(0, MAXL - 1), `… ほか ${lines.length - MAXL + 1} 命令`] : lines;
      const head = b.start === cur ? prog.names.get(cur) : `loc_${b.start.toString(16)}`;
      const all = [head, ...shown];
      return { b, lines: all, w: Math.max(...all.map((l) => l.length)) * CH + PAD * 2, h: all.length * LH + PAD * 2 };
    });
    const at = new Map(nodes.map((n) => [n.b.start, n]));
    // 段（rank）を決める：戻る辺（ループ）を除いた最長経路
    const order = new Map();
    const back = new Set();
    const state = new Map();
    const dfs = (a) => {
      state.set(a, 1);
      for (const s of at.get(a).b.succ) {
        if (state.get(s.to) === 1) back.add(`${a}>${s.to}`);
        else if (!state.has(s.to)) dfs(s.to);
      }
      state.set(a, 2);
      order.set(a, order.size);
    };
    dfs(g.start);
    for (const n of nodes) if (!state.has(n.b.start)) dfs(n.b.start);
    const topo = [...order.keys()].reverse();
    const rank = new Map(topo.map((a) => [a, 0]));
    for (const a of topo) for (const s of at.get(a).b.succ) if (!back.has(`${a}>${s.to}`)) rank.set(s.to, Math.max(rank.get(s.to), rank.get(a) + 1));
    const ranks = [];
    for (const n of nodes) (ranks[rank.get(n.b.start)] ??= []).push(n);
    const GX = 36, GY = 54;
    let y = 20, width = 0;
    for (const row of ranks) {
      if (!row) continue;
      row.sort((a, b) => a.b.start - b.b.start);
      const rh = Math.max(...row.map((n) => n.h));
      const rw = row.reduce((s, n) => s + n.w, 0) + GX * (row.length - 1);
      row.rw = rw;
      row.y = y;
      y += rh + GY;
      width = Math.max(width, rw);
    }
    width += 80;
    for (const row of ranks) {
      if (!row) continue;
      let x = (width - row.rw) / 2;
      for (const n of row) {
        n.x = x;
        n.y = row.y;
        x += n.w + GX;
      }
    }
    const height = y;
    const ns = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs) => {
      const e = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      return e;
    };
    const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width: width * zoom, height: height * zoom, class: 'cfg' });
    const defs = el('defs', {});
    for (const t of ['true', 'false', 'jmp']) {
      const mk = el('marker', { id: `arr-${t}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
      mk.append(el('path', { d: 'M0 0L10 5L0 10z', class: `e-${t}` }));
      defs.append(mk);
    }
    svg.append(defs);
    for (const n of nodes) {
      n.b.succ.forEach((s, k) => {
        const t = at.get(s.to);
        const type = s.type === 'true' ? 'true' : s.type === 'false' ? 'false' : 'jmp';
        const sx = n.x + n.w / 2 + (n.b.succ.length > 1 ? (k === 0 ? -12 : 12) : 0), sy = n.y + n.h;
        const tx = t.x + t.w / 2, ty = t.y;
        let d;
        if (back.has(`${n.b.start}>${s.to}`) || ty <= sy) {
          // ループ（上へ戻る）は左側を回る
          const lx = Math.min(n.x, t.x) - 24 - k * 8;
          d = `M${sx} ${sy} C${sx} ${sy + 30} ${lx} ${sy + 30} ${lx} ${sy} L${lx} ${ty} C${lx} ${ty - 30} ${tx} ${ty - 30} ${tx} ${ty}`;
        } else d = `M${sx} ${sy} C${sx} ${sy + GY / 2} ${tx} ${ty - GY / 2} ${tx} ${ty}`;
        svg.append(el('path', { d, class: `edge e-${type}`, 'marker-end': `url(#arr-${type})` }));
      });
    }
    for (const n of nodes) {
      const gEl = el('g', { class: `node${n.b.start === cur ? ' entry' : ''}`, transform: `translate(${n.x} ${n.y})` });
      gEl.append(el('rect', { width: n.w, height: n.h, rx: 3 }));
      n.lines.forEach((l, k) => {
        const t = el('text', { x: PAD, y: PAD + LH * (k + 1) - 4, class: k === 0 ? 'head' : /^(call|bl)\b/.test(l) ? 'call' : /^(cmp|test)\b/.test(l) ? 'cmp' : '' });
        t.textContent = l;
        gEl.append(t);
      });
      gEl.addEventListener('click', () => scrollToInsn(n.b.start));
      svg.append(gEl);
    }
    box.replaceChildren(svg);
  }
  const setZoom = (z) => {
    zoom = Math.max(0.3, Math.min(2, z));
    const svg = $('revGraph').querySelector('svg');
    if (!svg) return;
    const [, , w, hh] = svg.getAttribute('viewBox').split(' ').map(Number);
    svg.setAttribute('width', w * zoom);
    svg.setAttribute('height', hh * zoom);
  };
  $('revZoomIn').addEventListener('click', () => setZoom(zoom * 1.25));
  $('revZoomOut').addEventListener('click', () => setZoom(zoom / 1.25));

  // ---------- データ ----------
  function showData(addr) {
    $('revDataAddr').value = hex(addr);
    // 文字列ならその長さ、そうでなければ次の名前付きデータまで（最大 256）
    const s = stringAt(bin, addr, 1);
    let len = s != null ? new TextEncoder().encode(s).length + 1 : 64;
    if (s == null) {
      const next = [...prog.dataNames.keys()].filter((a) => a > addr).sort((x, y) => x - y)[0];
      const sym = bin.symbols.find((x) => x.addr === addr && x.size);
      if (sym) len = sym.size;
      else if (next && next - addr <= 256) len = next - addr;
      const r = regionOf(bin, addr);
      if (r) len = Math.min(len, r.addr + r.size - addr);
    }
    $('revDataLen').value = Math.max(1, len);
    openTab('revdata');
    renderData();
  }
  function renderData() {
    if (!bin) return;
    const addr = parseInt($('revDataAddr').value.replace(/^0x/i, ''), 16);
    const len = Math.max(1, Math.min(4096, Number($('revDataLen').value) || 64));
    const b = Number.isFinite(addr) ? readAt(bin, addr, len) : null;
    if (!b || !b.length) {
      $('revDump').textContent = 'このアドレスはファイルの中にありません（実行時に確保される領域か、アドレスの誤り）。';
      $('revDataActions').hidden = true;
      dataBytes = null;
      return;
    }
    dataBytes = b.slice();
    const lines = [];
    for (let o = 0; o < b.length; o += 16) {
      const row = b.subarray(o, o + 16);
      lines.push(`${addrLabel(addr + o)}  ${[...row].map((x) => x.toString(16).padStart(2, '0')).join(' ').padEnd(47)}  ${[...row].map((x) => (x >= 0x20 && x < 0x7f ? String.fromCharCode(x) : '.')).join('')}`);
    }
    const name = prog?.nameOf(addr);
    const refs = prog?.refsTo.get(addr) ?? [];
    $('revDataInfo').replaceChildren(`${name ? name + '（' + hex(addr) + '）' : hex(addr)}・${b.length} バイト`, refs.length ? h('span', {}, '　参照元：', ...refs.slice(0, 8).map(xrefLink)) : '');
    $('revDump').textContent = lines.join('\n');
    $('revDataActions').hidden = false;
  }
  $('revDataGo').addEventListener('click', renderData);
  $('revDataAddr').addEventListener('keydown', (e) => e.key === 'Enter' && renderData());
  const dataHex = () => [...dataBytes].map((x) => x.toString(16).padStart(2, '0')).join('');
  $('revToXor').addEventListener('click', () => dataBytes && sendTo('xor', { text: dataHex(), fmt: 'hex', tab: 'single' }));
  $('revToCodec').addEventListener('click', () => dataBytes && sendTo('codec', { text: dataHex(), magic: true }));
  $('revToBinview').addEventListener('click', () => dataBytes && sendTo('binview', { fmt: 'hex', text: dataHex() }));
  $('revCopyArr').addEventListener('click', () => dataBytes && copy(`unsigned char data[${dataBytes.length}] = { ${[...dataBytes].map((x) => '0x' + x.toString(16).padStart(2, '0')).join(', ')} };`));
  $('revCopyPy').addEventListener('click', () => dataBytes && copy(`data = bytes.fromhex('${dataHex()}')`));

  dropzone();
  registerReceiver('rev', (f) => (f instanceof File ? load(f) : null));
}
