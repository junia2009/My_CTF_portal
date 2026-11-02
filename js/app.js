import * as C from './lib/codecs.js';
import * as X from './lib/ciphers.js';
import { computeHashes, identifyHash } from './lib/hash.js';
import { decodeJwt } from './lib/jwt.js';
import { findFlags, DEFAULT_FLAG_PATTERN } from './lib/flag.js';
import { GENRES } from './data/genres.js';

// ---------- 共通ヘルパー ----------
const $ = (id) => document.getElementById(id);

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1500);
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('コピーしました');
  } catch {
    toast('コピーできませんでした');
  }
}

const kvRow = (k, v, copyable = true) =>
  h('tr', {}, h('th', {}, k), h('td', copyable ? { class: 'copyable', title: 'クリックでコピー', onclick: () => copy(v) } : {}, v));

const debounce = (fn, ms = 120) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

const TOOL_NAMES = {
  codec: 'エンコード/デコード', base: '基数変換', classic: '古典暗号', xor: 'XOR',
  hash: 'ハッシュ', jwt: 'JWT', flag: 'フラグ検索',
};

// ---------- テーマ（カラー切替） ----------
const THEMES = ['cyan', 'crimson', 'emerald'];
function initTheme() {
  const apply = (t) => {
    document.documentElement.dataset.theme = t;
    $('themeName').textContent = t.toUpperCase();
  };
  let cur = store.get('ctfportal.theme', 'cyan');
  if (!THEMES.includes(cur)) cur = 'cyan';
  apply(cur);
  $('themeBtn').addEventListener('click', () => {
    cur = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
    apply(cur);
    store.set('ctfportal.theme', cur);
  });
}

// ---------- 時計 ----------
function initClock() {
  const tick = () => {
    $('clock').textContent = new Date().toLocaleTimeString('ja-JP', { hour12: false });
  };
  tick();
  setInterval(tick, 1000);
}

// ---------- 起動演出（セッション中に1回だけ） ----------
function initBoot() {
  const boot = $('boot');
  let seen = false;
  try {
    seen = sessionStorage.getItem('ctfportal.booted') === '1';
    sessionStorage.setItem('ctfportal.booted', '1');
  } catch { /* 保存できない環境では毎回表示 */ }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (seen || reduce) {
    boot.hidden = true;
    return;
  }
  const lines = [
    '> INITIALIZING CORE MODULES ........ OK',
    '> LOADING DECODER MATRIX ........... OK',
    '> CALIBRATING CIPHER ARRAY ......... OK',
    '> HASH ENGINE ...................... ONLINE',
    '> FLAG SCANNER ..................... ARMED',
    '> ALL SYSTEMS NOMINAL. WELCOME, OPERATOR.',
  ];
  const log = $('bootLog');
  const timers = [];
  lines.forEach((l, i) => timers.push(setTimeout(() => (log.textContent += l + '\n'), 180 + i * 220)));
  const finish = () => {
    timers.forEach(clearTimeout);
    boot.classList.add('done');
    setTimeout(() => (boot.hidden = true), 700);
  };
  timers.push(setTimeout(finish, 180 + lines.length * 220 + 500));
  boot.addEventListener('click', finish, { once: true });
}

// ---------- 各ページ見出しの英字ラベル ----------
const PAGE_CODES = {
  home: 'COMMAND CENTER', codec: 'DECODER MATRIX', base: 'NUMERIC CONVERTER', classic: 'CLASSIC CIPHER',
  xor: 'XOR ANALYZER', hash: 'HASH ENGINE', jwt: 'TOKEN INSPECTOR', flag: 'FLAG SCANNER',
  notes: 'MISSION LOG', cheatsheet: 'FIELD MANUAL',
};
function initEyebrows() {
  Object.entries(PAGE_CODES).forEach(([id, code], i) => {
    const h1 = document.querySelector(`[data-page="${id}"] h1`);
    h1?.before(h('div', { class: 'eyebrow' }, `MODULE ${String(i).padStart(2, '0')} // ${code}`));
  });
}

// ---------- ルーティング ----------
const onShow = {};
function route() {
  const [page, arg] = (location.hash.slice(1) || 'home').split('/');
  const target = document.querySelector(`[data-page="${page}"]`) ? page : 'home';
  document.querySelectorAll('[data-page]').forEach((s) => (s.hidden = s.dataset.page !== target));
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === target));
  onShow[target]?.(arg ? decodeURIComponent(arg) : undefined);
  window.scrollTo(0, 0);
}

// ---------- ホーム ----------
function renderHome() {
  const notes = loadNotes();
  const solved = notes.filter((n) => n.status === 'solved');
  const points = solved.reduce((s, n) => s + (Number(n.points) || 0), 0);
  $('homeStats').replaceChildren(
    h('div', { class: 'stat' }, h('b', {}, notes.length), h('span', {}, 'MISSIONS')),
    h('div', { class: 'stat' }, h('b', {}, solved.length), h('span', {}, 'CLEARED')),
    h('div', { class: 'stat' }, h('b', {}, points), h('span', {}, 'POINTS')),
  );
  const rate = notes.length ? Math.round((solved.length / notes.length) * 100) : 0;
  const circ = 2 * Math.PI * 74;
  const prog = $('heroProg');
  prog.style.strokeDasharray = `${circ}`;
  prog.style.strokeDashoffset = `${circ}`;
  requestAnimationFrame(() => requestAnimationFrame(() => (prog.style.strokeDashoffset = `${circ * (1 - rate / 100)}`)));
  $('heroRate').textContent = `${rate}%`;
  $('genreGrid').replaceChildren(
    ...GENRES.map((g, i) => {
      const gn = notes.filter((n) => n.genre === g.id);
      const gs = gn.filter((n) => n.status === 'solved').length;
      return h('div', { class: 'genre' },
        h('div', { class: 'gnum', 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')),
        h('h3', {}, g.label),
        h('p', {}, g.desc),
        h('div', { class: 'links' },
          ...g.tools.map((t) => h('a', { href: `#${t}` }, TOOL_NAMES[t])),
          h('a', { href: `#cheatsheet/${g.id}` }, 'チートシート'),
        ),
        h('div', { class: 'progress' }, `CLEARED ${gs} / ${gn.length}`),
        h('div', { class: 'bar' }, h('i', { style: `width:${gn.length ? (gs / gn.length) * 100 : 0}%` })),
      );
    }),
  );
}

// ---------- エンコード / デコード ----------
function initCodec() {
  const input = $('codecIn'), output = $('codecOut'), err = $('codecErr');
  let recipe = store.get('ctfportal.recipe', []);
  let lastQuick = null;

  $('codecQuick').append(
    ...C.OPS.map((op) =>
      h('button', {
        type: 'button',
        onclick: () => {
          lastQuick = op.id;
          if (recipe.length) {
            recipe.push(op.id);
            saveRecipe();
          }
          update();
        },
      }, op.name),
    ),
  );
  $('recipeOp').append(...C.OPS.map((op) => h('option', { value: op.id }, op.name)));

  const saveRecipe = () => store.set('ctfportal.recipe', recipe);

  function update() {
    err.textContent = '';
    const ops = recipe.length ? recipe : lastQuick ? [lastQuick] : [];
    if (!ops.length) {
      output.value = input.value;
      renderRecipe([]);
      return;
    }
    const r = C.runRecipe(input.value, ops);
    output.value = r.output ?? '';
    err.textContent = r.error ?? '';
    renderRecipe(recipe.length ? r.steps : []);
  }

  function renderRecipe(steps) {
    $('recipeList').replaceChildren(
      ...recipe.map((id, i) => {
        const op = C.OPS.find((o) => o.id === id);
        const st = steps[i];
        return h('li', { class: st && !st.ok ? 'fail' : '' },
          op.name,
          h('button', {
            type: 'button', class: 'ghost x', title: '削除',
            onclick: () => { recipe.splice(i, 1); saveRecipe(); update(); },
          }, '×'),
        );
      }),
    );
  }

  $('recipeAdd').addEventListener('click', () => {
    recipe.push($('recipeOp').value);
    saveRecipe();
    update();
  });
  $('recipeClear').addEventListener('click', () => {
    recipe = [];
    lastQuick = null;
    saveRecipe();
    update();
  });
  $('codecSwap').addEventListener('click', () => {
    input.value = output.value;
    update();
  });
  input.addEventListener('input', debounce(update));
  update();
}

// ---------- 基数変換 ----------
function initBase() {
  const upd = () => {
    $('baseErr').textContent = '';
    $('baseOut').replaceChildren();
    if (!$('baseIn').value.trim()) return;
    try {
      const r = C.convertInteger($('baseIn').value);
      $('baseOut').append(kvRow('10進', r.dec), kvRow('16進', r.hex), kvRow('8進', r.oct), kvRow('2進', r.bin), kvRow('ASCII', r.ascii));
    } catch (e) {
      $('baseErr').textContent = e.message;
    }
  };
  $('baseIn').addEventListener('input', debounce(upd));
  $('baseText').addEventListener('input', () => {
    $('baseTextOut').textContent = $('baseText').value ? C.textToInteger($('baseText').value) : '';
  });
  $('baseTextOut').addEventListener('click', () => $('baseTextOut').textContent && copy($('baseTextOut').textContent));
}

// ---------- 古典暗号 ----------
function initClassic() {
  const input = $('clIn');
  function upd() {
    const s = input.value;
    const rows = X.caesarAll(s);
    const top = [...rows].sort((a, b) => b.score - a.score).slice(0, 3).map((r) => r.shift);
    $('caesarTable').replaceChildren(
      h('tr', {}, h('th', {}, 'シフト'), h('th', {}, '結果（クリックでコピー）')),
      ...rows.map((r) =>
        h('tr', { class: s && top.includes(r.shift) ? 'hl' : '' },
          h('td', { class: 'num' }, `+${r.shift}${r.shift === 13 ? ' ROT13' : ''}`),
          h('td', { class: 'copyable', onclick: () => copy(r.text) }, r.text),
        ),
      ),
    );
    $('clMisc').replaceChildren(kvRow('ROT47', C.rot47(s)), kvRow('Atbash', C.atbash(s)), kvRow('反転', C.reverse(s)));
    const freq = X.letterFrequency(s);
    const max = Math.max(13, ...freq.map((f) => f.pct));
    $('freqChart').replaceChildren(
      ...freq.map((f) =>
        h('div', { class: 'col', title: `${f.letter}: ${f.count}回 (${f.pct.toFixed(1)}%) / 英語 ${f.en}%` },
          h('div', { class: 'bars' },
            h('div', { class: 'b', style: `height:${(f.pct / max) * 100}%` }),
            h('div', { class: 'b ref', style: `height:${(f.en / max) * 100}%` }),
          ),
          h('div', { class: 'l' }, f.letter),
        ),
      ),
    );
  }
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
  input.addEventListener('input', debounce(upd));
  upd();
}

// ---------- XOR ----------
function parseBytes(s, fmt) {
  if (fmt === 'hex') return C.hexToBytes(s);
  if (fmt === 'b64') return C.b64Decode(s);
  return C.toBytes(s);
}

function initXor() {
  const latin1 = (b) => Array.from(b, (x) => (x >= 0x20 && x <= 0x7e ? String.fromCharCode(x) : '.')).join('');
  function upd() {
    $('xorErr').textContent = '';
    $('xorOut').replaceChildren();
    $('xorBrute').replaceChildren();
    if (!$('xorIn').value.trim()) return;
    let data;
    try {
      data = parseBytes($('xorIn').value, $('xorInFmt').value);
    } catch (e) {
      $('xorErr').textContent = 'データ: ' + e.message;
      return;
    }
    if ($('xorKey').value) {
      try {
        const key = parseBytes($('xorKey').value, $('xorKeyFmt').value);
        const out = X.xorBytes(data, key);
        $('xorOut').append(kvRow('テキスト', latin1(out)), kvRow('Hex', C.bytesToHex(out)), kvRow('Base64', C.b64Encode(out)));
      } catch (e) {
        $('xorErr').textContent = '鍵: ' + e.message;
      }
    }
    const rows = X.xorBruteSingle(data);
    $('xorBrute').append(
      h('tr', {}, h('th', {}, '鍵'), h('th', {}, '表示可能率'), h('th', {}, '結果')),
      ...rows.map((r) =>
        h('tr', { class: /flag|ctf/i.test(r.text) ? 'hl' : '' },
          h('td', { class: 'num' }, `0x${r.key.toString(16).padStart(2, '0')}`),
          h('td', { class: 'num' }, `${Math.round(r.ratio * 100)}%`),
          h('td', { class: 'copyable', onclick: () => copy(r.text) }, r.text.replace(/[^\x20-\x7e]/g, '.')),
        ),
      ),
    );
  }
  for (const id of ['xorIn', 'xorKey']) $(id).addEventListener('input', debounce(upd, 200));
  for (const id of ['xorInFmt', 'xorKeyFmt']) $(id).addEventListener('change', upd);
}

// ---------- ハッシュ ----------
function initHash() {
  let seq = 0;
  async function upd() {
    const my = ++seq;
    const res = await computeHashes(C.toBytes($('hashIn').value));
    if (my !== seq) return;
    $('hashOut').replaceChildren(...Object.entries(res).map(([k, v]) => kvRow(k, v)));
  }
  $('hashIn').addEventListener('input', debounce(upd));
  $('hashId').addEventListener('input', () => {
    const v = $('hashId').value.trim();
    const hits = identifyHash(v);
    $('hashIdOut').replaceChildren(
      !v ? '' : hits.length
        ? h('p', {}, '候補: ', ...hits.map((n) => h('span', { class: 'tag' }, n)))
        : h('p', { class: 'hint' }, `一致する形式がありません（${v.length}文字）`),
    );
  });
  upd();
}

// ---------- JWT ----------
function initJwt() {
  $('jwtIn').addEventListener('input', () => {
    $('jwtErr').textContent = '';
    $('jwtOut').replaceChildren();
    if (!$('jwtIn').value.trim()) return;
    try {
      const r = decodeJwt($('jwtIn').value);
      const block = (title, obj) => [h('h3', {}, title), h('div', { class: 'mono-out', onclick: (e) => copy(e.currentTarget.textContent) }, JSON.stringify(obj, null, 2))];
      $('jwtOut').append(
        ...block('ヘッダ', r.header),
        ...block('ペイロード', r.payload),
        h('h3', {}, '署名（Base64URL）'),
        h('div', { class: 'mono-out' }, r.signature || '(なし)'),
        r.notes.length ? h('h3', {}, '気付いた点') : '',
        r.notes.length ? h('ul', {}, ...r.notes.map((n) => h('li', {}, n))) : '',
      );
    } catch (e) {
      $('jwtErr').textContent = e.message;
    }
  });
}

// ---------- フラグ検索 ----------
function initFlag() {
  $('flagPattern').value = DEFAULT_FLAG_PATTERN;
  $('flagPrefix').value = store.get('ctfportal.flagPrefix', 'flag,ctf');
  function upd() {
    $('flagErr').textContent = '';
    $('flagOut').replaceChildren();
    store.set('ctfportal.flagPrefix', $('flagPrefix').value);
    if (!$('flagIn').value.trim()) return;
    try {
      const hits = findFlags($('flagIn').value, $('flagPattern').value || DEFAULT_FLAG_PATTERN, $('flagPrefix').value.split(','));
      if (!hits.length) {
        $('flagOut').append(h('tr', {}, h('td', { class: 'hint' }, '見つかりませんでした')));
        return;
      }
      $('flagOut').append(
        h('tr', {}, h('th', {}, '見つかったもの（クリックでコピー）'), h('th', {}, '変換')),
        ...hits.map((r) => h('tr', {}, h('td', { class: 'copyable', onclick: () => copy(r.match) }, r.match), h('td', { class: 'num' }, r.source))),
      );
    } catch (e) {
      $('flagErr').textContent = e.message;
    }
  }
  for (const id of ['flagIn', 'flagPrefix', 'flagPattern']) $(id).addEventListener('input', debounce(upd, 200));
}

// ---------- 問題メモ ----------
const NOTES_KEY = 'ctfportal.challenges';
const STATUS = { todo: '未着手', doing: '挑戦中', solved: '解決' };
const loadNotes = () => store.get(NOTES_KEY, []);
const saveNotes = (n) => {
  if (!store.set(NOTES_KEY, n)) toast('保存できませんでした（ブラウザの保存領域が使えません）');
};

function initNotes() {
  const genreOpts = () => GENRES.map((g) => h('option', { value: g.id }, g.label));
  $('noteGenre').append(...genreOpts());
  $('noteFilter').append(h('option', { value: '' }, 'すべてのジャンル'), ...genreOpts());

  const form = $('noteForm');
  const reset = () => {
    form.reset();
    $('noteId').value = '';
    $('noteFormTitle').textContent = '問題を追加';
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const notes = loadNotes();
    const item = {
      id: $('noteId').value || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
      title: $('noteTitle').value.trim(),
      genre: $('noteGenre').value,
      points: $('notePoints').value,
      status: $('noteStatus').value,
      flag: $('noteFlag').value.trim(),
      memo: $('noteMemo').value,
      updated: new Date().toISOString(),
    };
    if (item.flag && item.status !== 'solved') item.status = 'solved';
    const i = notes.findIndex((n) => n.id === item.id);
    if (i >= 0) notes[i] = item;
    else notes.unshift(item);
    saveNotes(notes);
    reset();
    render();
    toast('保存しました');
  });
  $('noteCancel').addEventListener('click', reset);

  function edit(n) {
    $('noteId').value = n.id;
    $('noteTitle').value = n.title;
    $('noteGenre').value = n.genre;
    $('notePoints').value = n.points ?? '';
    $('noteStatus').value = n.status;
    $('noteFlag').value = n.flag ?? '';
    $('noteMemo').value = n.memo ?? '';
    $('noteFormTitle').textContent = '問題を編集';
    form.scrollIntoView({ behavior: 'smooth' });
  }

  function render() {
    const g = $('noteFilter').value, st = $('noteStatusFilter').value;
    const notes = loadNotes().filter((n) => (!g || n.genre === g) && (!st || n.status === st));
    $('noteList').replaceChildren(
      ...(notes.length ? notes.map((n) =>
        h('div', { class: `note ${n.status}` },
          h('div', { class: 'head' },
            h('div', {}, h('span', { class: 'tag' }, n.genre), h('strong', {}, n.title)),
            h('div', { class: 'row' },
              h('span', { class: 'meta' }, `${STATUS[n.status]}${n.points ? ` / ${n.points}pt` : ''}`),
              h('button', { type: 'button', class: 'ghost', onclick: () => edit(n) }, '編集'),
              h('button', {
                type: 'button', class: 'ghost',
                onclick: () => {
                  if (!confirm(`「${n.title}」を削除しますか？`)) return;
                  saveNotes(loadNotes().filter((x) => x.id !== n.id));
                  render();
                },
              }, '削除'),
            ),
          ),
          n.flag ? h('div', {}, 'フラグ: ', h('span', { class: 'flagv', title: 'クリックでコピー', onclick: () => copy(n.flag) }, n.flag)) : '',
          n.memo ? h('pre', {}, n.memo) : '',
        ),
      ) : [h('p', { class: 'hint' }, 'まだ問題が登録されていません。')]),
    );
  }

  $('noteFilter').addEventListener('change', render);
  $('noteStatusFilter').addEventListener('change', render);

  $('noteExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(loadNotes(), null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `ctf-notes-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('noteImport').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data)) throw new Error('形式が違います');
      const clean = data
        .filter((n) => n && typeof n.title === 'string')
        .map((n) => ({
          id: String(n.id ?? Math.random()),
          title: n.title,
          genre: GENRES.some((g) => g.id === n.genre) ? n.genre : 'MISC',
          points: n.points ?? '',
          status: STATUS[n.status] ? n.status : 'todo',
          flag: String(n.flag ?? ''),
          memo: String(n.memo ?? ''),
          updated: String(n.updated ?? ''),
        }));
      const cur = loadNotes();
      const ids = new Set(cur.map((n) => n.id));
      saveNotes([...cur, ...clean.filter((n) => !ids.has(n.id))]);
      render();
      toast(`${clean.length} 件を読み込みました`);
    } catch (err) {
      toast('読み込めませんでした: ' + err.message);
    }
  });

  return render;
}

// ---------- チートシート ----------
function initCheatsheet() {
  $('csGenre').append(h('option', { value: '' }, 'すべてのジャンル'), ...GENRES.map((g) => h('option', { value: g.id }, g.label)));
  function render() {
    const g = $('csGenre').value;
    const q = $('csSearch').value.trim().toLowerCase();
    const blocks = GENRES.filter((x) => !g || x.id === g)
      .map((x) => ({ ...x, items: x.sheet.filter(([c, d]) => !q || c.toLowerCase().includes(q) || d.toLowerCase().includes(q)) }))
      .filter((x) => x.items.length);
    $('csList').replaceChildren(
      ...(blocks.length ? blocks.map((x) =>
        h('div', { class: 'card cs-genre' },
          h('h3', {}, x.label),
          ...x.items.map(([c, d]) =>
            h('div', { class: 'cs-item' },
              h('div', {}, h('code', { class: 'copyable', title: 'クリックでコピー', onclick: () => copy(c) }, c)),
              h('span', {}, d),
            ),
          ),
        ),
      ) : [h('p', { class: 'hint' }, '該当する項目がありません。')]),
    );
  }
  $('csGenre').addEventListener('change', render);
  $('csSearch').addEventListener('input', debounce(render));
  return (arg) => {
    if (arg !== undefined && GENRES.some((x) => x.id === arg)) $('csGenre').value = arg;
    render();
  };
}

// ---------- 起動 ----------
document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => copy($(b.dataset.copy).value)));
initBoot();
initTheme();
initClock();
initEyebrows();
initCodec();
initBase();
initClassic();
initXor();
initHash();
initJwt();
initFlag();
onShow.home = renderHome;
onShow.notes = initNotes();
onShow.cheatsheet = initCheatsheet();
window.addEventListener('hashchange', route);
route();
