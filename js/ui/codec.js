// エンコード / デコード画面
import { bytesToHex, bytesToText, isUtf8, printableRatio, b64Encode } from '../lib/codecs.js';
import { OPS, getOp, runRecipe } from '../lib/recipe.js';
import { magic } from '../lib/magic.js';
import { identifyType, hexdump } from '../lib/file.js';
import { $, h, store, copy, toast, download, debounce, preview, fmtSize, readBytes, getPrefixes, setTable, registerReceiver, pallasSay } from './common.js';

// Magic の手順名 → レシピの操作
const MAGIC_OPS = {
  Base64: 'b64d', Base32: 'b32d', Base58: 'b58d', Base85: 'b85d', Hex: 'hexd', '2進数': 'bind', '10進数': 'decd',
  URL: 'urld', 'HTML エンティティ': 'htmld', 'Unicode エスケープ': 'unid', 'モールス信号': 'morsed',
  'gzip 展開': 'gunzip', 'zlib 展開': 'inflate', ROT47: 'rot47', Atbash: 'atbash', 反転: 'rev', ROT13: 'rot13',
};
const chainToRecipe = (chain) =>
  chain.map((n) => (MAGIC_OPS[n] ? { id: MAGIC_OPS[n] } : { id: 'caesar', arg: (n.match(/\+(\d+)/) ?? [0, '0'])[1] }));

export function initCodec() {
  const input = $('codecIn'), inFmt = $('codecInFmt'), output = $('codecOut'), outFmt = $('codecOutFmt'), err = $('codecErr');
  let recipe = store.get('ctfportal.recipe2', []);
  let outBytes = new Uint8Array();
  let seq = 0;
  const save = () => store.set('ctfportal.recipe2', recipe);

  function inputBytes() {
    return readBytes(input.value, inFmt.value);
  }

  // ---- ワンクリック変換（グループごと） ----
  const groups = [...new Set(OPS.map((o) => o.group))];
  $('codecQuick').append(
    ...groups.map((g) =>
      h('div', { class: 'op-group' },
        h('div', { class: 'op-group-title' }, g),
        h('div', { class: 'btn-grid' },
          ...OPS.filter((o) => o.group === g).map((op) =>
            h('button', {
              type: 'button',
              title: op.param ? `${op.param.label}: ${op.param.default}（レシピ欄で変更できます）` : '',
              onclick: () => {
                recipe.push({ id: op.id, arg: op.param?.default });
                save();
                update();
              },
            }, op.name),
          ),
        ),
      ),
    ),
  );

  // ---- レシピ ----
  const sel = $('recipeOp'), argIn = $('recipeArg');
  sel.append(...groups.map((g) => h('optgroup', { label: g }, ...OPS.filter((o) => o.group === g).map((o) => h('option', { value: o.id }, o.name)))));
  const syncArg = () => {
    const op = getOp(sel.value);
    argIn.hidden = !op.param;
    if (op.param) {
      argIn.placeholder = op.param.label;
      argIn.value = op.param.default;
    }
  };
  sel.addEventListener('change', syncArg);
  syncArg();

  $('recipeAdd').addEventListener('click', () => {
    const op = getOp(sel.value);
    recipe.push({ id: op.id, arg: op.param ? argIn.value : undefined });
    save();
    update();
  });
  $('recipeClear').addEventListener('click', () => {
    recipe = [];
    save();
    update();
  });

  function renderRecipe(steps) {
    $('recipeList').replaceChildren(
      ...(recipe.length
        ? recipe.map((it, i) => {
            const op = getOp(it.id);
            const st = steps[i];
            return h('li', { class: st && !st.ok ? 'fail' : st ? 'ok' : '' },
              op.name,
              op.param ? h('code', {}, it.arg ?? '') : '',
              h('button', { type: 'button', class: 'ghost x', title: '削除', onclick: () => { recipe.splice(i, 1); save(); update(); } }, '×'),
            );
          })
        : [h('li', { class: 'empty' }, 'まだ変換がありません。上のボタンか、ここで追加してください。')]),
    );
  }

  // ---- 出力表示 ----
  function renderOutput() {
    const b = outBytes;
    let fmt = outFmt.value;
    if (fmt === 'auto') fmt = isUtf8(b) && printableRatio(b) > 0.95 ? 'text' : 'dump';
    output.value =
      fmt === 'text' ? bytesToText(b)
      : fmt === 'hex' ? bytesToHex(b)
      : fmt === 'b64' ? b64Encode(b)
      : hexdump(b, 0, 64 * 1024) + (b.length > 64 * 1024 ? '\n…（先頭 64KB のみ表示。全体は「保存」で取得できます）' : '');
    const type = identifyType(b);
    $('codecOutInfo').replaceChildren(
      h('span', {}, fmtSize(b.length)),
      h('span', {}, isUtf8(b) ? 'UTF-8 テキスト' : 'バイナリ'),
      h('span', {}, `表示可能 ${Math.round(printableRatio(b) * 100)}%`),
      type ? h('span', { class: 'accent' }, `形式: ${type.name}`) : '',
    );
  }

  async function update() {
    const my = ++seq;
    err.textContent = '';
    let src;
    try {
      src = inputBytes();
    } catch (e) {
      err.textContent = '入力: ' + e.message;
      return;
    }
    $('codecInInfo').textContent = `${fmtSize(src.length)}`;
    const r = await runRecipe(src, recipe);
    if (my !== seq) return;
    renderRecipe(r.steps);
    if (r.error) {
      err.textContent = r.error;
      return;
    }
    outBytes = r.output;
    renderOutput();
  }

  outFmt.addEventListener('change', renderOutput);
  $('codecSwap').addEventListener('click', () => {
    if (isUtf8(outBytes) && printableRatio(outBytes) > 0.95) {
      inFmt.value = 'text';
      input.value = bytesToText(outBytes);
    } else {
      inFmt.value = 'hex';
      input.value = bytesToHex(outBytes);
    }
    recipe = [];
    save();
    update();
  });
  $('codecSave').addEventListener('click', () => download(outBytes, 'output.bin'));
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

  // ---- Magic ----
  $('magicRun').addEventListener('click', async () => {
    const out = $('magicOut');
    let src;
    try {
      src = inputBytes();
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
      out.replaceChildren(h('tr', {}, h('td', { class: 'hint' }, '当てはまる変換が見つかりませんでした')));
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
          h('button', { type: 'button', class: 'ghost small', onclick: () => { recipe = chainToRecipe(r.chain); save(); update(); toast('レシピに適用しました'); } }, '適用'),
        ),
      ),
    ));
    // 結果表を描いたあとに通知する（PALLAS が表の横へ飛べるように）
    if (results[0].flag) pallasSay({ kind: 'magicFlag', mood: 'happy', flag: results[0].flag, chain: results[0].chain.join(' → '), anchor: '#magicOut' });
  });

  registerReceiver('codec', (p) => {
    inFmt.value = 'text';
    input.value = p.text;
    recipe = [];
    save();
    update();
    if (p.magic) $('magicRun').click();
  });

  update();
}
