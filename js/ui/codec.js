// エンコード / デコード画面（CyberChef 相当）：目的別の変換一覧・段階ごとの結果・次の一手の提案
import { bytesToHex, bytesToText, isUtf8, printableRatio, b64Encode } from '../lib/codecs.js';
import { OPS, CATS, getOp, runRecipe, defaultArgs, searchOps, suggestNext, describeValue } from '../lib/recipe.js';
import { magic } from '../lib/magic.js';
import { identifyType, hexdump } from '../lib/file.js';
import { $, h, store, copy, toast, download, debounce, preview, fmtSize, readBytes, getPrefixes, setTable, registerReceiver, pallasSay, openFileSmart } from './common.js';

// Magic の手順名 → レシピの操作
const MAGIC_OPS = {
  Base64: 'b64d', Base32: 'b32d', Base58: 'b58d', Base85: 'b85d', Hex: 'hexd', '2進数': 'bind', '10進数': 'decd',
  URL: 'urld', 'HTML エンティティ': 'htmld', 'Unicode エスケープ': 'unid', 'モールス信号': 'morsed',
  uudecode: 'uud', 'gzip 展開': 'gunzip', 'zlib 展開': 'inflate', ROT47: 'rot47', Atbash: 'atbash', 反転: 'rev', ROT13: 'rot13',
};
const chainToRecipe = (chain) =>
  chain.map((n) => (MAGIC_OPS[n] ? { id: MAGIC_OPS[n] } : { id: 'caesar', args: { arg: (n.match(/\+(\d+)/) ?? [0, '0'])[1] } }));

// よくある型（ワンクリックでレシピを作る）
const PRESETS = [
  ['Base64 → 文字', ['b64d']],
  ['Base64 → gzip 展開', ['b64d', 'gunzip']],
  ['Hex → 文字', ['hexd']],
  ['Hex → XOR 総当たり', ['hexd', 'xorbrute']],
  ['Base64 → AES-CBC 復号', ['b64d', { id: 'aes', args: { mode: 'cbc' } }]],
  ['シーザー総当たり', ['caesarbrute']],
  ['文字コード（10進）→ 文字', ['decd']],
  ['JWT の中身', ['jwt']],
  ['大きな整数 → 文字', ['bigd']],
  ['フラグを抜き出す', ['flags']],
];

const FMT = [['auto', '自動'], ['text', '文字'], ['hex', '16進'], ['b64', 'Base64']];

const looksText = (b) => isUtf8(b) && printableRatio(b) > 0.9;
// 中身から拡張子を決める（分からなければ、文字なら .txt、それ以外は .bin）
const extOf = (b) => identifyType(b)?.ext.split('/')[0] ?? (looksText(b) ? 'txt' : 'bin');
const fileOf = (b, base = 'output') => new File([b], `${base}.${extOf(b)}`);
function saveAs(b, base) {
  const name = `${base}.${extOf(b)}`;
  download(b, name);
  toast(`${name} を保存しました`);
}
// ファイルの形式なら「保存」と「専用のツールで開く」を出す
function fileActions(b, base) {
  const type = identifyType(b);
  if (!type) return '';
  return h('div', { class: 'cc-file' },
    h('span', {}, `${type.name}のファイルです`),
    h('button', { type: 'button', class: 'small', onclick: () => saveAs(b, base) }, `保存（.${extOf(b)}）`),
    h('button', { type: 'button', class: 'ghost small', onclick: async () => toast(`${{ image: '画像解析', audio: '音声解析', pcap: 'pcap 解析', rev: 'バイナリ解析', file: 'ファイル解析' }[await openFileSmart(fileOf(b, base))]}で開きました`) }, '詳しく調べる'),
  );
}
function previewBlock(b) {
  if (!b.length) return h('div', { class: 'cc-empty' }, '（空）');
  if (looksText(b)) {
    const t = bytesToText(b);
    return h('pre', { class: 'cc-pre' }, t.length > 600 ? t.slice(0, 600) + '…' : t);
  }
  return h('pre', { class: 'cc-pre dump' }, hexdump(b, 0, 64) + (b.length > 64 ? '\n…' : ''));
}
function badges(b) {
  const type = identifyType(b);
  return h('div', { class: 'cc-badges' },
    h('span', {}, fmtSize(b.length)),
    h('span', {}, looksText(b) ? 'テキスト' : isUtf8(b) ? 'テキスト（記号多め）' : 'バイナリ'),
    type ? h('span', { class: 'accent' }, type.name) : '',
  );
}

export function initCodec() {
  const input = $('codecIn'), inFmt = $('codecInFmt'), output = $('codecOut'), outFmt = $('codecOutFmt'), err = $('codecErr');
  const migrate = () => (store.get('ctfportal.recipe2', []) ?? []).map((it) => ({ id: it.id, args: it.arg !== undefined && getOp(it.id)?.params?.[0] ? { [getOp(it.id).params[0].key]: it.arg } : {} }));
  let recipe = store.get('ctfportal.recipe3', null) ?? migrate();
  recipe = recipe.filter((it) => getOp(it.id)).map((it) => ({ ...it, args: { ...defaultArgs(getOp(it.id)), ...(it.args ?? {}) } }));
  let outBytes = new Uint8Array();
  let srcBytes = new Uint8Array();
  let seq = 0;
  let outUrl = null;
  const save = () => store.set('ctfportal.recipe3', recipe);

  // ---------- 変換の一覧 ----------
  const opButton = (op) => h('button', { type: 'button', class: 'cc-op', title: op.desc ?? '', onclick: () => addStep(op.id) },
    h('span', {}, op.name), op.desc ? h('small', {}, op.desc) : '');
  const openCats = new Set(store.get('ctfportal.ccOpen', ['decode', 'cipher']));
  function renderPalette() {
    const q = $('ccSearch').value;
    if (q.trim()) {
      const hits = searchOps(q);
      $('ccCats').replaceChildren(hits.length ? h('div', { class: 'cc-list' }, ...hits.map(opButton)) : h('p', { class: 'hint' }, '見つかりませんでした。英語の名前（base64・decrypt など）でも探せます。'));
      return;
    }
    $('ccCats').replaceChildren(...CATS.map(([id, name, desc]) => {
      const d = h('details', { class: 'cc-cat', open: openCats.has(id) ? '' : null },
        h('summary', {}, name, h('span', { class: 'cc-count' }, OPS.filter((o) => o.cat === id).length)),
        h('p', { class: 'cc-cat-desc' }, desc),
        h('div', { class: 'cc-list' }, ...OPS.filter((o) => o.cat === id).map(opButton)));
      d.addEventListener('toggle', () => {
        if (d.open) openCats.add(id);
        else openCats.delete(id);
        store.set('ctfportal.ccOpen', [...openCats]);
      });
      return d;
    }));
  }
  $('ccSearch').addEventListener('input', debounce(renderPalette, 120));
  renderPalette();

  // ---------- よくある型・保存したレシピ ----------
  const toItems = (list) => list.map((x) => (typeof x === 'string' ? { id: x, args: defaultArgs(getOp(x)) } : { id: x.id, args: { ...defaultArgs(getOp(x.id)), ...(x.args ?? {}) } }));
  function renderPresets() {
    const saved = store.get('ctfportal.ccSaved', []);
    $('ccPresets').replaceChildren(
      h('span', { class: 'cc-presets-label' }, 'よくある型'),
      ...PRESETS.map(([name, list]) => h('button', { type: 'button', class: 'chip', onclick: () => { recipe = toItems(list); save(); buildSteps(); toast(`「${name}」を読み込みました`); } }, name)),
      ...(saved.length ? [h('span', { class: 'cc-presets-label' }, '保存したレシピ'), ...saved.map((r, i) => h('span', { class: 'chip cc-saved' },
        h('button', { type: 'button', class: 'link', onclick: () => { recipe = toItems(r.items); save(); buildSteps(); } }, r.name),
        h('button', { type: 'button', class: 'link cc-del', title: '削除', onclick: () => { saved.splice(i, 1); store.set('ctfportal.ccSaved', saved); renderPresets(); } }, '×')))] : []),
    );
  }
  renderPresets();
  $('ccSaveRecipe').addEventListener('click', () => {
    if (!recipe.length) return toast('レシピが空です');
    const name = prompt('レシピの名前', recipe.map((r) => getOp(r.id).name.split(' ')[0]).join(' → ').slice(0, 40));
    if (!name) return;
    const saved = store.get('ctfportal.ccSaved', []);
    saved.push({ name, items: recipe.map(({ id, args }) => ({ id, args })) });
    store.set('ctfportal.ccSaved', saved);
    renderPresets();
    toast('保存しました');
  });
  $('ccCopyRecipe').addEventListener('click', () => copy(JSON.stringify(recipe.map(({ id, args, off }) => ({ id, args, ...(off ? { off } : {}) })))));
  $('ccLoadRecipe').addEventListener('click', () => {
    const t = prompt('共有されたレシピ（「共有用にコピー」した文字）を貼り付けてください');
    if (!t) return;
    try {
      const list = JSON.parse(t);
      if (!Array.isArray(list) || !list.every((x) => getOp(x.id))) throw new Error();
      recipe = toItems(list).map((x, i) => ({ ...x, off: !!list[i].off }));
      save();
      buildSteps();
    } catch {
      toast('レシピとして読めませんでした');
    }
  });
  $('recipeClear').addEventListener('click', () => {
    recipe = [];
    save();
    buildSteps();
  });

  // ---------- レシピの各段階 ----------
  function addStep(id, args) {
    const op = getOp(id);
    recipe.push({ id, args: { ...defaultArgs(op), ...(args ?? {}) } });
    save();
    buildSteps();
    // 設定が必要な変換は、最初の入力欄へ
    if (op.params?.some((p) => p.type === 'value' && !p.default)) {
      requestAnimationFrame(() => $('ccFlow').querySelector('.cc-step:last-of-type input')?.focus());
    }
  }

  function paramControl(it, p, rebuild) {
    const a = it.args;
    const onChange = (v) => {
      a[p.key] = v;
      save();
      if (rebuild) buildSteps();
      else update();
    };
    if (p.type === 'select') {
      const sel = h('select', { 'aria-label': p.label, onchange: (e) => onChange(e.target.value) }, ...p.options.map(([v, l]) => h('option', { value: v }, l)));
      sel.value = a[p.key];
      return h('label', { class: 'cc-param' }, h('span', {}, p.label), sel);
    }
    const inp = h('input', { class: 'mono', value: a[p.key] ?? '', type: p.type === 'number' ? 'number' : 'text', placeholder: p.type === 'value' ? '16進でも文字でも' : '', 'aria-label': p.label });
    inp.addEventListener('input', debounce(() => onChange(inp.value), 250));
    if (p.type !== 'value') return h('label', { class: `cc-param${p.type === 'number' ? ' num' : ''}` }, h('span', {}, p.label), inp);
    // 鍵・IV：読み方を選べて、どう読んだかを横に表示する
    const fmt = h('select', { 'aria-label': `${p.label}の形式`, onchange: (e) => { a[`${p.key}Fmt`] = e.target.value; save(); update(); } }, ...FMT.map(([v, l]) => h('option', { value: v }, l)));
    fmt.value = a[`${p.key}Fmt`] ?? 'auto';
    return h('label', { class: 'cc-param wide' }, h('span', {}, p.label), h('span', { class: 'cc-value' }, inp, fmt), h('small', { class: 'cc-how', 'data-how': p.key }));
  }

  function buildSteps() {
    const flow = $('ccFlow');
    const cards = [h('div', { class: 'cc-step cc-input' }, h('div', { class: 'cc-step-head' }, h('b', { class: 'cc-no' }, 'IN'), h('span', { class: 'cc-name' }, '入力')), h('div', { class: 'cc-body' }))];
    recipe.forEach((it, i) => {
      const op = getOp(it.id);
      const params = (op.params ?? []).filter((p) => !p.when || p.when(it.args));
      // 表示が切り替わる設定（モードなど）を変えたときは作り直す
      const affects = new Set((op.params ?? []).filter((p) => p.type === 'select').map((p) => p.key));
      cards.push(h('div', { class: `cc-step${it.off ? ' off' : ''}`, 'data-i': i },
        h('div', { class: 'cc-step-head' },
          h('b', { class: 'cc-no' }, i + 1),
          h('span', { class: 'cc-name', title: op.desc ?? '' }, op.name),
          h('span', { class: 'cc-ctrl' },
            h('button', { type: 'button', class: 'ghost small', title: '上へ', disabled: i === 0 ? '' : null, onclick: () => { [recipe[i - 1], recipe[i]] = [recipe[i], recipe[i - 1]]; save(); buildSteps(); } }, '↑'),
            h('button', { type: 'button', class: 'ghost small', title: '下へ', disabled: i === recipe.length - 1 ? '' : null, onclick: () => { [recipe[i + 1], recipe[i]] = [recipe[i], recipe[i + 1]]; save(); buildSteps(); } }, '↓'),
            h('button', { type: 'button', class: 'ghost small', title: it.off ? '有効にする' : '一時的に止める（飛ばして実行）', onclick: () => { it.off = !it.off; save(); buildSteps(); } }, it.off ? '▶' : '⏸'),
            h('button', { type: 'button', class: 'ghost small', title: '削除', onclick: () => { recipe.splice(i, 1); save(); buildSteps(); } }, '×'),
          ),
        ),
        params.length ? h('div', { class: 'cc-params' }, ...params.map((p) => paramControl(it, p, affects.has(p.key) && (op.params ?? []).some((q) => q.when)))) : '',
        h('div', { class: 'cc-body' }),
      ));
    });
    if (!recipe.length) cards.push(h('p', { class: 'cc-hint' }, 'まだ変換がありません。左の一覧から選ぶか、下の「次はこれかも」や「よくある型」を押してください。'));
    flow.replaceChildren(...cards);
    update();
  }

  // ---------- 実行と結果の表示 ----------
  async function update() {
    const my = ++seq;
    err.textContent = '';
    try {
      srcBytes = readBytes(input.value, inFmt.value);
    } catch (e) {
      err.textContent = '入力: ' + e.message;
      return;
    }
    $('codecInInfo').textContent = fmtSize(srcBytes.length);
    const r = await runRecipe(srcBytes, recipe);
    if (my !== seq) return;
    const bodies = [...$('ccFlow').querySelectorAll('.cc-step .cc-body')];
    bodies[0]?.replaceChildren(previewBlock(srcBytes), badges(srcBytes));
    recipe.forEach((it, i) => {
      const body = bodies[i + 1];
      if (!body) return;
      const st = r.steps[i];
      const card = body.parentElement;
      card.classList.toggle('fail', !!st && !st.ok);
      card.classList.toggle('skip', !st);
      if (!st) body.replaceChildren(h('p', { class: 'hint' }, '（前の段階で失敗したため、実行していません）'));
      else if (!st.ok) body.replaceChildren(h('div', { class: 'cc-error' }, h('b', {}, 'うまくいきませんでした'), h('p', {}, st.error)));
      else if (st.off) body.replaceChildren(h('p', { class: 'hint' }, '一時停止中（この段階は飛ばしています）'));
      else body.replaceChildren(previewBlock(st.out), badges(st.out), fileActions(st.out, `step${i + 1}`));
      // 鍵・IV の読み方の説明
      card.querySelectorAll('.cc-how').forEach((el) => {
        const k = el.dataset.how;
        el.textContent = describeValue(it.args[k], it.args[`${k}Fmt`]);
      });
    });
    if (r.error) {
      err.textContent = r.error;
      outBytes = new Uint8Array();
      renderOutput();
      $('ccNext').replaceChildren(h('p', { class: 'cc-hint' }, '赤い段階の設定を見直すか、× で取り除いてください。'));
      return;
    }
    outBytes = r.output;
    renderOutput();
    renderNext(outBytes, my);
  }

  // 次の一手：形から候補を出し、実際に試して結果が出たものだけを見せる
  async function renderNext(b, my) {
    const box = $('ccNext');
    const cands = suggestNext(b).slice(0, 8);
    if (!b.length) {
      box.replaceChildren();
      return;
    }
    const prefixes = getPrefixes().map((p) => p.trim().toLowerCase()).filter(Boolean);
    // もうフラグが出ているなら、それを知らせる
    const whole = looksText(b) ? bytesToText(b.subarray(0, 2000)) : '';
    const found = prefixes.length ? whole.match(new RegExp(`(?:${prefixes.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\{[^}\\s]{1,200}\\}`, 'i')) : null;
    const head = found ? [h('div', { class: 'cc-done' }, `フラグらしい文字列が出ました：${found[0]}`)] : [];
    const tried = [];
    for (const c of cands) {
      if (found && c.id === 'flags' && found[0].length > whole.trim().length - 3) continue;
      const op = getOp(c.id);
      const needs = op.params?.some((p) => p.type === 'value' && !p.default);
      if (needs) {
        tried.push({ ...c, op, needs: true, score: 1 });
        continue;
      }
      try {
        const out = await op.fn(b, { ...defaultArgs(op), ...(c.args ?? {}) });
        const text = bytesToText(out.subarray(0, 400));
        const flag = prefixes.some((p) => text.toLowerCase().includes(p + '{'));
        tried.push({ ...c, op, out, text, score: (flag ? 10 : 0) + printableRatio(out) * 2 + (identifyType(out) ? 1 : 0) });
      } catch {
        // 失敗する候補は出さない
      }
      if (my !== seq) return;
    }
    tried.sort((x, y) => y.score - x.score);
    if (!tried.length) {
      box.replaceChildren(...head, h('div', { class: 'cc-next-head' }, '次はこれかも'), h('p', { class: 'hint' }, looksText(b) ? '形から分かる候補はありません。読める結果なら完成です。暗号なら左の「暗号を解く」から試してください。' : '形から分かる候補はありません。左の一覧から試してください。'));
      return;
    }
    box.replaceChildren(
      ...head,
      h('div', { class: 'cc-next-head' }, '次はこれかも', h('small', {}, '押すとレシピの最後に追加します')),
      h('div', { class: 'cc-next-list' }, ...tried.map((c) => h('button', { type: 'button', class: `cc-cand${c.score >= 10 ? ' hot' : ''}`, onclick: () => addStep(c.id, c.args) },
        h('b', {}, c.op.name),
        h('span', { class: 'cc-reason' }, c.reason),
        c.needs ? h('span', { class: 'cc-peek need' }, '鍵などの入力が必要') : h('span', { class: 'cc-peek' }, looksText(c.out) ? c.text.replace(/\s+/g, ' ').slice(0, 60) : `→ ${identifyType(c.out)?.name ?? 'バイナリ'}（${fmtSize(c.out.length)}）`),
      ))),
    );
  }

  function renderOutput() {
    const b = outBytes;
    let fmt = outFmt.value;
    if (fmt === 'auto') fmt = looksText(b) ? 'text' : 'dump';
    output.value =
      fmt === 'text' ? bytesToText(b)
      : fmt === 'hex' ? bytesToHex(b)
      : fmt === 'b64' ? b64Encode(b)
      : hexdump(b, 0, 64 * 1024) + (b.length > 64 * 1024 ? '\n…（先頭 64KB のみ表示。全体は「保存」で取得できます）' : '');
    const type = identifyType(b);
    $('codecSave').textContent = b.length ? `ファイルとして保存（.${extOf(b)}）` : 'ファイルとして保存';
    $('codecFileBox').replaceChildren(fileActions(b, 'output'));
    $('codecOutInfo').replaceChildren(
      h('span', {}, fmtSize(b.length)),
      h('span', {}, isUtf8(b) ? 'UTF-8 テキスト' : 'バイナリ'),
      h('span', {}, `表示可能 ${Math.round(printableRatio(b) * 100)}%`),
      type ? h('span', { class: 'accent' }, `形式: ${type.name}`) : '',
    );
    // 画像なら、その場で表示する
    const img = $('codecImg');
    if (outUrl) URL.revokeObjectURL(outUrl);
    outUrl = null;
    const mime = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' }[type?.ext];
    img.hidden = !mime;
    if (mime) {
      outUrl = URL.createObjectURL(new Blob([b], { type: mime }));
      img.replaceChildren(h('img', { src: outUrl, alt: '出力の画像' }));
    }
  }

  outFmt.addEventListener('change', renderOutput);
  $('codecSwap').addEventListener('click', () => {
    if (looksText(outBytes)) {
      inFmt.value = 'text';
      input.value = bytesToText(outBytes);
    } else {
      inFmt.value = 'hex';
      input.value = bytesToHex(outBytes);
    }
    recipe = [];
    save();
    buildSteps();
  });
  $('codecSave').addEventListener('click', () => (outBytes.length ? saveAs(outBytes, 'output') : toast('出力が空です')));
  $('codecFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      toast('8MB を超えるファイルは「ファイル解析」を使ってください');
      return;
    }
    inFmt.value = 'hex';
    input.value = bytesToHex(new Uint8Array(await f.arrayBuffer()));
    update();
  });
  input.addEventListener('input', debounce(update));
  inFmt.addEventListener('change', update);

  // ---------- 全自動（Magic） ----------
  $('magicRun').addEventListener('click', async () => {
    const out = $('magicOut');
    let src;
    try {
      src = readBytes(input.value, inFmt.value);
    } catch (e) {
      err.textContent = '入力: ' + e.message;
      return;
    }
    if (!src.length) return;
    $('magicRun').disabled = true;
    out.replaceChildren(h('tr', {}, h('td', { class: 'hint' }, 'ANALYZING…')));
    const results = await magic(src, { prefixes: getPrefixes() });
    $('magicRun').disabled = false;
    if (!results.length) {
      out.replaceChildren(h('tr', {}, h('td', { class: 'hint' }, '当てはまる変換が見つかりませんでした。下のレシピの「次はこれかも」や、左の「暗号を解く」を試してください。')));
      pallasSay({ kind: 'magicFail', mood: 'think', anchor: '#magicOut' });
      return;
    }
    setTable(out, ['手順', '結果', ''], results.map((r) =>
      h('tr', { class: r.flag ? 'hl' : '' },
        h('td', { class: 'chain' }, ...r.chain.flatMap((c, i) => [i ? h('span', { class: 'arrow' }, '→') : '', h('span', { class: 'step' }, c)])),
        h('td', { class: 'copyable', title: 'クリックでコピー', onclick: () => copy(r.flag ?? bytesToText(r.bytes)) },
          r.flag ? h('b', { class: 'flag-hit' }, r.flag) : preview(r.bytes, 120),
          r.type ? h('span', { class: 'tag' }, r.type) : '',
        ),
        h('td', { class: 'num' },
          h('button', { type: 'button', class: 'ghost small', onclick: () => { recipe = toItems(chainToRecipe(r.chain)); save(); buildSteps(); toast('レシピに適用しました'); $('ccFlow').scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, '適用'),
        ),
      ),
    ));
    if (results[0].flag) pallasSay({ kind: 'magicFlag', mood: 'happy', flag: results[0].flag, chain: results[0].chain.join(' → '), anchor: '#magicOut' });
  });

  registerReceiver('codec', (p) => {
    inFmt.value = p.hex !== undefined ? 'hex' : 'text';
    input.value = p.hex ?? p.text ?? '';
    recipe = Array.isArray(p.recipe) ? p.recipe.map((r) => ({ id: r.id, args: r.args ?? {} })) : [];
    save();
    buildSteps();
    if (p.magic) $('magicRun').click();
    if (p.focusKey) setTimeout(() => { const el = document.querySelector('#codec input[aria-label="鍵"]'); el?.focus(); input.focus(); }, 50);
  });

  buildSteps();
}
