// ポータル全体の画面：テーマ / 時計 / 起動演出 / 見出し / ホーム / 基数変換 / 問題メモ / チートシート
import * as C from '../lib/codecs.js';
import { GENRES } from '../data/genres.js';
import { $, h, store, toast, copy, kvRow, debounce, registerReceiver, fill } from './common.js';

// ---------- テーマ（カラー切替） ----------
const THEMES = ['cyan', 'crimson', 'emerald'];
export function initTheme() {
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
export function initClock() {
  const tick = () => {
    $('clock').textContent = new Date().toLocaleTimeString('ja-JP', { hour12: false });
  };
  tick();
  setInterval(tick, 1000);
}

// ---------- 起動演出（セッション中に1回だけ） ----------
export function initBoot() {
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
  home: 'COMMAND CENTER', guide: 'BRIEFING', identify: 'TARGET SCANNER', codec: 'DECODER MATRIX', base: 'NUMERIC CONVERTER', classic: 'CLASSIC CIPHER',
  xor: 'XOR ANALYZER', rsa: 'RSA BREAKER', file: 'FILE FORENSICS', hash: 'HASH ENGINE', jwt: 'TOKEN INSPECTOR',
  flag: 'FLAG SCANNER', net: 'NET / TIME', notes: 'MISSION LOG', cheatsheet: 'FIELD MANUAL',
};
export function initEyebrows() {
  Object.entries(PAGE_CODES).forEach(([id, code], i) => {
    const h1 = document.querySelector(`[data-page="${id}"] h1`);
    h1?.before(h('div', { class: 'eyebrow' }, `MODULE ${String(i).padStart(2, '0')} // ${code}`));
  });
}

const TOOL_NAMES = {
  codec: 'エンコード/デコード', base: '基数変換', classic: '古典暗号', xor: 'XOR', rsa: 'RSA',
  file: 'ファイル解析', hash: 'ハッシュ', jwt: 'JWT', flag: 'フラグ検索', net: 'ネットワーク・時刻',
};

// ---------- ホーム ----------
export function renderHome() {
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
          h('a', { href: `#guide/${g.id}`, class: 'first-step' }, '最初の一歩'),
        ),
        h('div', { class: 'progress' }, `CLEARED ${gs} / ${gn.length}`),
        h('div', { class: 'bar' }, h('i', { style: `width:${gn.length ? (gs / gn.length) * 100 : 0}%` })),
      );
    }),
  );
}

// ---------- 基数変換 ----------
export function initBase() {
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
  registerReceiver('base', (p) => fill('baseIn', p.text));
  $('baseText').addEventListener('input', () => {
    $('baseTextOut').textContent = $('baseText').value ? C.textToInteger($('baseText').value) : '';
  });
  $('baseTextOut').addEventListener('click', () => $('baseTextOut').textContent && copy($('baseTextOut').textContent));
}

// ---------- 問題メモ ----------
const NOTES_KEY = 'ctfportal.challenges';
const STATUS = { todo: '未着手', doing: '挑戦中', solved: '解決' };
const loadNotes = () => store.get(NOTES_KEY, []);
const saveNotes = (n) => {
  if (!store.set(NOTES_KEY, n)) toast('保存できませんでした（ブラウザの保存領域が使えません）');
};

export function initNotes() {
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
    if (item.status === 'solved') {
      const n = notes.filter((x) => x.status === 'solved').length;
      window.dispatchEvent(new CustomEvent('pallas', { detail: { kind: 'solved', mood: 'happy', title: item.title, n, anchor: '#noteList' } }));
    }
  });
  $('noteCancel').addEventListener('click', reset);
  registerReceiver('notes', (p) => {
    reset();
    $('noteFlag').value = p.flag;
    $('noteStatus').value = 'solved';
    $('noteTitle').focus();
    toast('フラグを入れました。問題名を入れて保存してください');
  });

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
export function initCheatsheet() {
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

