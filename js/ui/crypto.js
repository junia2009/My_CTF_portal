// 暗号系の画面：古典暗号 / XOR / RSA
import * as C from '../lib/codecs.js';
import * as X from '../lib/ciphers.js';
import * as R from '../lib/rsa.js';
import { flagRegex } from '../lib/magic.js';
import { $, h, copy, kvRow, debounce, preview, readBytes, keyText, getPrefixes, setTable, fmtSize } from './common.js';

const copyCell = (text, shown = text) => h('td', { class: 'copyable', title: 'クリックでコピー', onclick: () => copy(text) }, shown);
const isFlag = (s) => flagRegex(getPrefixes()).test(s);

// ================= 古典暗号 =================
export function initClassic() {
  const input = $('clIn');
  let subMap = {};

  function caesar(s) {
    const rows = X.caesarAll(s);
    const top = [...rows].sort((a, b) => b.score - a.score).slice(0, 3).map((r) => r.shift);
    setTable($('caesarTable'), ['シフト', '結果（クリックでコピー）'], rows.map((r) =>
      h('tr', { class: s && (top.includes(r.shift) || isFlag(r.text)) ? 'hl' : '' },
        h('td', { class: 'num' }, `+${r.shift}${r.shift === 13 ? ' ROT13' : ''}`),
        copyCell(r.text),
      ),
    ));
    $('clMisc').replaceChildren(kvRow('ROT47', C.rot47(s)), kvRow('Atbash', C.atbash(s)), kvRow('反転', C.reverse(s)));
  }

  function affine(s) {
    if (!s.trim()) return $('affineOut').replaceChildren();
    setTable($('affineOut'), ['a', 'b', '結果'], X.affineBrute(s).slice(0, 10).map((r, i) =>
      h('tr', { class: i === 0 || isFlag(r.text) ? 'hl' : '' }, h('td', { class: 'num' }, r.a), h('td', { class: 'num' }, r.b), copyCell(r.text)),
    ));
  }

  function rail(s) {
    if (!s.trim()) return $('railOut').replaceChildren();
    const rows = X.railFenceBrute(s);
    const best = rows.reduce((a, b) => (b.score > a.score ? b : a), rows[0]);
    setTable($('railOut'), ['段数', '結果'], rows.map((r) =>
      h('tr', { class: r === best || isFlag(r.text) ? 'hl' : '' }, h('td', { class: 'num' }, r.rails), copyCell(r.text)),
    ));
  }

  function freq(s) {
    const f = X.letterFrequency(s);
    const max = Math.max(13, ...f.map((x) => x.pct));
    $('freqChart').replaceChildren(
      ...f.map((x) =>
        h('div', { class: 'col', title: `${x.letter}: ${x.count}回 (${x.pct.toFixed(1)}%) / 英語 ${x.en}%` },
          h('div', { class: 'bars' },
            h('div', { class: 'b', style: `height:${(x.pct / max) * 100}%` }),
            h('div', { class: 'b ref', style: `height:${(x.en / max) * 100}%` }),
          ),
          h('div', { class: 'l' }, x.letter),
        ),
      ),
    );
    const n = f.reduce((a, x) => a + x.count, 0);
    const ioc = n > 1 ? f.reduce((a, x) => a + x.count * (x.count - 1), 0) / (n * (n - 1)) : 0;
    $('freqStats').replaceChildren(
      kvRow('文字数', `${n}（アルファベットのみ）`, false),
      kvRow('一致指数 IoC', `${ioc.toFixed(4)}  （英文 ≈ 0.066 / ランダム ≈ 0.038）`, false),
      kvRow('推定', n < 20 ? '文字数が少なく判断できません' : ioc > 0.058 ? '単一換字式・転置式・シーザーの可能性' : ioc > 0.045 ? '鍵の短い多表式（Vigenère など）の可能性' : '多表式・ランダムに近い', false),
    );
    return f;
  }

  // ---- 換字表 ----
  const grid = $('subGrid');
  function buildSubGrid(f) {
    const counts = Object.fromEntries((f ?? X.letterFrequency(input.value)).map((x) => [x.letter, x.count]));
    grid.replaceChildren(
      ...Array.from({ length: 26 }, (_, i) => {
        const L = String.fromCharCode(65 + i);
        const inp = h('input', {
          maxlength: '1', value: subMap[L] ?? '', 'aria-label': `${L} に対応する平文字`,
          oninput: (e) => {
            const v = e.target.value.replace(/[^a-z]/gi, '').toLowerCase();
            e.target.value = v;
            if (v) subMap[L] = v;
            else delete subMap[L];
            renderSub();
          },
        });
        return h('div', { class: `sub-cell${counts[L] ? '' : ' unused'}` }, h('span', { class: 'c' }, L), inp, h('span', { class: 'n' }, counts[L] || ''));
      }),
    );
  }
  function renderSub() {
    $('subOut').textContent = X.applySubstitution(input.value, subMap);
    const used = Object.values(subMap);
    grid.querySelectorAll('input').forEach((inp) => inp.classList.toggle('dup', !!inp.value && used.filter((x) => x === inp.value).length > 1));
  }
  $('subGuess').addEventListener('click', () => {
    subMap = Object.fromEntries(Object.entries(X.frequencyGuess(input.value)).map(([k, v]) => [k, v.toLowerCase()]));
    buildSubGrid();
    renderSub();
  });
  $('subClear').addEventListener('click', () => {
    subMap = {};
    buildSubGrid();
    renderSub();
  });

  // ---- Vigenère ----
  $('vigCrack').addEventListener('click', () => {
    $('vigErr').textContent = '';
    try {
      const r = X.vigenereCrack(input.value);
      const maxIoc = Math.max(...r.lengths.map((x) => x.ioc));
      $('vigCrackOut').replaceChildren(
        h('h4', {}, '鍵の長さごとの一致指数（高いほど有力）'),
        h('div', { class: 'ioc-chart' },
          ...r.lengths.map((x) => h('div', { class: 'ioc-bar', title: `長さ ${x.length}: ${x.ioc.toFixed(4)}` },
            h('i', { style: `height:${(x.ioc / maxIoc) * 100}%` }), h('span', {}, x.length))),
        ),
        h('h4', {}, '候補'),
        h('table', { class: 'list' },
          h('tr', {}, h('th', {}, '鍵'), h('th', {}, '復号結果')),
          ...r.candidates.map((c, i) => h('tr', { class: i === 0 ? 'hl' : '' }, copyCell(c.key), copyCell(c.plain, preview(c.plain, 200)))),
        ),
      );
    } catch (e) {
      $('vigErr').textContent = e.message;
    }
  });
  const vig = (dec) => {
    try {
      $('vigOut').textContent = X.vigenere(input.value, $('vigKey').value, dec);
    } catch (e) {
      $('vigOut').textContent = e.message;
    }
  };
  $('vigEnc').addEventListener('click', () => vig(false));
  $('vigDec').addEventListener('click', () => vig(true));
  $('vigOut').addEventListener('click', () => $('vigOut').textContent && copy($('vigOut').textContent));

  function upd() {
    const s = input.value;
    caesar(s);
    affine(s);
    rail(s);
    const f = freq(s);
    buildSubGrid(f);
    renderSub();
  }
  input.addEventListener('input', debounce(upd, 200));
  upd();
}

// ================= XOR =================
export function initXor() {
  const show = (b) => C.latin1Decode(b).replace(/[^\x20-\x7e]/g, '·');
  let data = null;

  function parse() {
    $('xorErr').textContent = '';
    data = null;
    if (!$('xorIn').value.trim()) {
      $('xorInfo').textContent = '';
      return;
    }
    try {
      data = readBytes($('xorIn').value, $('xorInFmt').value);
      $('xorInfo').textContent = fmtSize(data.length);
    } catch (e) {
      $('xorErr').textContent = 'データ: ' + e.message;
    }
  }

  function withKey() {
    $('xorOut').replaceChildren();
    if (!data || !$('xorKey').value) return;
    try {
      const key = readBytes($('xorKey').value, $('xorKeyFmt').value);
      if (!key.length) return;
      const out = X.xorBytes(data, key);
      $('xorOut').append(kvRow('テキスト', show(out)), kvRow('Hex', C.bytesToHex(out)), kvRow('Base64', C.b64Encode(out)));
    } catch (e) {
      $('xorErr').textContent = '鍵: ' + e.message;
    }
  }

  function single() {
    if (!data) return $('xorBrute').replaceChildren();
    setTable($('xorBrute'), ['鍵', '表示可能', '結果'], X.xorBruteSingle(data.subarray(0, 65536)).map((r, i) =>
      h('tr', { class: i === 0 || isFlag(r.text) ? 'hl' : '' },
        h('td', { class: 'num' }, `0x${r.key.toString(16).padStart(2, '0')}${r.key >= 0x20 && r.key <= 0x7e ? ` '${String.fromCharCode(r.key)}'` : ''}`),
        h('td', { class: 'num' }, `${Math.round(r.ratio * 100)}%`),
        copyCell(r.text, preview(r.text.replace(/[^\x20-\x7e\n]/g, '·'), 200)),
      ),
    ));
  }

  function crib() {
    if (!data || !$('xorCrib').value) return $('xorCribOut').replaceChildren();
    const c = C.toBytes($('xorCrib').value);
    const rows = X.xorCrib(data, c);
    setTable($('xorCribOut'), ['位置', 'その位置の鍵', ''], rows.map((r) =>
      h('tr', { class: r.printable ? 'hl' : '' },
        h('td', { class: 'num' }, r.offset),
        copyCell(C.bytesToHex(r.key), keyText(r.key)),
        h('td', { class: 'num' },
          h('button', {
            type: 'button', class: 'ghost small',
            onclick: () => {
              $('xorKeyFmt').value = 'hex';
              $('xorKey').value = C.bytesToHex(r.key);
              document.querySelector('[data-tab="key"]').click();
              withKey();
            },
          }, '鍵に使う'),
        ),
      ),
    ));
  }

  $('xorRepeat').addEventListener('click', () => {
    const out = $('xorRepeatOut');
    if (!data) return;
    try {
      const results = X.xorRepeatingCrack(data);
      out.replaceChildren(h('table', { class: 'list' },
        h('tr', {}, h('th', {}, '鍵'), h('th', {}, '復号結果')),
        ...results.map((r, i) => h('tr', { class: i === 0 ? 'hl' : '' }, copyCell(C.bytesToHex(r.key), keyText(r.key)), copyCell(r.text, preview(r.text.replace(/[^\x20-\x7e\n]/g, '·'), 200)))),
      ));
    } catch (e) {
      out.replaceChildren(h('p', { class: 'error' }, e.message));
    }
  });

  const all = () => {
    parse();
    withKey();
    single();
    crib();
  };
  $('xorIn').addEventListener('input', debounce(all, 200));
  $('xorInFmt').addEventListener('change', all);
  $('xorKey').addEventListener('input', debounce(withKey, 150));
  $('xorKeyFmt').addEventListener('change', withKey);
  $('xorCrib').addEventListener('input', debounce(crib, 150));
}

// ================= RSA =================
export function initRsa() {
  const ids = { n: 'rsaN', e: 'rsaE', c: 'rsaC', p: 'rsaP', q: 'rsaQ', d: 'rsaD' };
  $('rsaClear').addEventListener('click', () => {
    Object.values(ids).forEach((id) => ($(id).value = id === 'rsaE' ? '65537' : ''));
    $('rsaLog').replaceChildren();
    $('rsaOut').replaceChildren();
    $('rsaErr').textContent = '';
  });
  $('rsaRun').addEventListener('click', () => {
    $('rsaErr').textContent = '';
    $('rsaOut').replaceChildren();
    $('rsaLog').replaceChildren(h('li', {}, 'COMPUTING…'));
    $('rsaRun').disabled = true;
    setTimeout(() => {
      try {
        const v = Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, R.parseBig($(id).value)]));
        const r = R.solveRsa(v);
        $('rsaLog').replaceChildren(...r.log.map((l) => h('li', {}, l)));
        const rows = [];
        if (r.n) rows.push(kvRow('n のビット長', R.bitLength(r.n), false));
        for (const k of ['p', 'q', 'phi', 'd']) if (r[k] && !v[k]) rows.push(kvRow(k === 'phi' ? 'φ(n)' : k, r[k].toString()));
        if (r.m != null) {
          const bytes = R.intToBytes(r.m);
          const text = C.bytesToText(bytes);
          rows.push(kvRow('m（10進）', r.m.toString()), kvRow('m（16進）', '0x' + r.m.toString(16)), kvRow('m（文字列）', text));
          const f = text.match(flagRegex(getPrefixes()));
          if (f) rows.unshift(h('tr', { class: 'hl' }, h('th', {}, 'FLAG'), h('td', { class: 'copyable', onclick: () => copy(f[0]) }, h('b', { class: 'flag-hit' }, f[0]))));
        }
        $('rsaOut').replaceChildren(...rows);
      } catch (e) {
        $('rsaLog').replaceChildren();
        $('rsaErr').textContent = e.message;
      } finally {
        $('rsaRun').disabled = false;
      }
    }, 30);
  });
}
