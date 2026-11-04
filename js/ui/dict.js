// コマンド辞典：コマンドごとの説明（書式・オプション・例・注意）と、「やりたいこと」からの逆引き
import { DICTS } from '../data/dict.js';
import { COMMANDS } from '../data/commands.js';
import { $, h, store, copy, debounce } from './common.js';

const FAV_KEY = 'ctfportal.dictFav';
const LANGS = [['sql', 'SQL'], ['python', 'Python'], ['linux', 'Linux コマンド']];
const keyOf = (d, x) => `${d.id}:${x.t}`;

// コードの表示：コメント（# / --）を薄く表示する
function codeView(code, lang, cls = 'dc-code') {
  const pre = h('pre', { class: cls });
  for (const [i, line] of code.split('\n').entries()) {
    if (i) pre.append('\n');
    const m = lang === 'sql' ? /^(.*?)(--.*)$/.exec(line) : /^((?:[^'"#]|'[^']*'|"[^"]*")*?)(#.*)$/.exec(line);
    if (m && !(lang === 'linux' && /^#!/.test(m[2]))) pre.append(m[1], h('span', { class: 'dc-cmt' }, m[2]));
    else pre.append(line);
  }
  return pre;
}
const codeBox = (code, lang) => h('div', { class: 'dc-code-wrap' }, codeView(code, lang), h('button', { type: 'button', class: 'ghost small dc-copy', onclick: () => copy(code) }, 'コピー'));

export function initDict() {
  let lang = 'sql';
  let mode = store.get('ctfportal.dictMode', 'cmd');
  const selected = { sql: 'SELECT', python: 'print', linux: 'ls' };
  let cat = null, favOnly = false;
  const fav = new Set(store.get(FAV_KEY, []));
  const saveFav = () => store.set(FAV_KEY, [...fav]);

  // ---------- 上のタブと引き方の切り替え ----------
  function renderTabs() {
    $('dcTabs').replaceChildren(...LANGS.map(([id, name]) => h('button', {
      type: 'button', class: id === lang && !favOnly ? 'active' : '',
      onclick: () => { lang = id; cat = null; favOnly = false; render(); },
    }, name, h('small', {}, mode === 'cmd' ? COMMANDS[id].length : DICTS.find((d) => d.id === id).entries.length))),
    mode === 'task' ? h('button', { type: 'button', class: `dc-fav-tab${favOnly ? ' active' : ''}`, onclick: () => { favOnly = !favOnly; render(); } }, '★ よく使う', h('small', {}, fav.size)) : '');
    $('dcModeCmd').classList.toggle('active', mode === 'cmd');
    $('dcModeTask').classList.toggle('active', mode === 'task');
    $('dcCmdView').hidden = mode !== 'cmd';
    $('dcTaskView').hidden = mode !== 'task';
  }
  $('dcModeCmd').addEventListener('click', () => { mode = 'cmd'; store.set('ctfportal.dictMode', mode); render(); });
  $('dcModeTask').addEventListener('click', () => { mode = 'task'; favOnly = false; store.set('ctfportal.dictMode', mode); render(); });

  // ---------- コマンドで引く ----------
  const findCmd = (l, name) => COMMANDS[l].find((x) => x.name === name);
  function renderIndex() {
    const q = $('dcCmdSearch').value.trim().toLowerCase();
    const match = (x) => !q || `${x.name} ${x.sum} ${x.desc} ${x.opts.map((o) => o.join(' ')).join(' ')}`.toLowerCase().includes(q);
    const list = COMMANDS[lang].filter(match);
    const cats = [...new Set(COMMANDS[lang].map((x) => x.cat))];
    const groups = cats.map((c) => [c, list.filter((x) => x.cat === c)]).filter(([, l]) => l.length);
    // スマホ用：同じ一覧を標準の選択メニューにも入れる（ページの中に別のスクロール箱を作らない）
    const pick = $('dcPick');
    pick.replaceChildren(...(groups.length
      ? groups.map(([c, l]) => h('optgroup', { label: c }, ...l.map((x) => h('option', { value: x.name }, `${x.name} — ${x.sum}`))))
      : [h('option', { value: '' }, '見つかりませんでした')]));
    if (list.some((x) => x.name === selected[lang])) pick.value = selected[lang];
    else pick.selectedIndex = -1;
    $('dcIndex').replaceChildren(...(groups.length ? groups.flatMap(([c, l]) => [
      h('div', { class: 'dc-index-cat' }, c),
      ...l.map((x) => h('button', { type: 'button', class: `dc-index-item${x.name === selected[lang] ? ' active' : ''}`, onclick: () => { selected[lang] = x.name; renderIndex(); renderDetail(true); } },
        h('code', {}, x.name), h('span', {}, x.sum))),
    ]) : [h('p', { class: 'hint' }, '見つかりませんでした'),
      // ほかの言語にあれば案内する
      ...LANGS.filter(([id]) => id !== lang && COMMANDS[id].some(match)).map(([id, name]) => h('button', { type: 'button', class: 'chip dc-other', onclick: () => {
        lang = id;
        const hit = COMMANDS[id].find(match);
        selected[id] = hit.name;
        render();
      } }, `${name} に ${COMMANDS[id].filter(match).length} 件 →`))]));
  }

  // そのコマンドを使っている「やりたいこと」の項目（逆引きとのつながり）
  function relatedTasks(x) {
    const d = DICTS.find((t) => t.id === lang);
    const word = x.name.split(/[\s/]/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = lang === 'python' ? new RegExp(`\\b${word}\\b`) : lang === 'sql' ? new RegExp(`\\b${word}\\b`, 'i') : new RegExp(`(^|[|;&\\s])${word}(\\s|$)`, 'm');
    return d.entries.filter((t) => re.test(t.code)).slice(0, 6);
  }

  function renderDetail(scroll = false) {
    const x = findCmd(lang, selected[lang]) ?? COMMANDS[lang][0];
    const box = $('dcDetail');
    const rel = x.rel.map((r) => (findCmd(lang, r)
      ? h('button', { type: 'button', class: 'chip', onclick: () => { selected[lang] = r; renderIndex(); renderDetail(true); } }, r)
      : h('span', { class: 'chip dim' }, r)));
    const tasks = relatedTasks(x);
    box.replaceChildren(...[
      h('header', { class: 'dc-d-head' },
        h('h2', { class: 'dc-d-name' }, x.name),
        h('span', { class: 'tag' }, x.cat),
      ),
      h('p', { class: 'dc-d-sum' }, x.sum),
      h('div', { class: 'dc-d-sec' }, '書式'),
      codeBox(x.syn, lang),
      h('p', { class: 'dc-d-desc' }, x.desc),
      x.opts.length ? [h('div', { class: 'dc-d-sec' }, lang === 'linux' ? 'よく使うオプション' : lang === 'sql' ? '書き方・種類' : '主な使い方'),
        h('table', { class: 'dc-opts' }, ...x.opts.map(([o, m]) => h('tr', {}, h('th', { title: 'クリックでコピー', onclick: () => copy(o) }, h('code', {}, o)), h('td', {}, m))))] : '',
      x.ex.length ? [h('div', { class: 'dc-d-sec' }, '例'), ...x.ex.map(([code, d]) => h('div', { class: 'dc-ex' }, codeBox(code, lang), d ? h('p', {}, d) : ''))] : '',
      x.warn ? h('div', { class: 'mn-callout warn' }, h('span', { class: 'mn-callout-label' }, '注意'), h('p', {}, x.warn)) : '',
      rel.length ? [h('div', { class: 'dc-d-sec' }, '関連'), h('div', { class: 'dc-rel' }, ...rel)] : '',
      tasks.length ? [h('div', { class: 'dc-d-sec' }, 'これを使う「やりたいこと」'), h('div', { class: 'dc-rel' }, ...tasks.map((t) => h('button', { type: 'button', class: 'chip', onclick: () => { mode = 'task'; store.set('ctfportal.dictMode', mode); $('dcSearch').value = t.t; render(); } }, t.t)))] : '',
    ].flat().filter(Boolean));
  }
  $('dcPick').addEventListener('change', (e) => {
    if (!e.target.value) return;
    selected[lang] = e.target.value;
    renderIndex();
    renderDetail();
  });
  $('dcCmdSearch').addEventListener('input', debounce(() => {
    renderIndex();
    // 絞り込みで 1 件になったら、それを表示する
    const items = $('dcIndex').querySelectorAll('.dc-index-item');
    if (items.length === 1) items[0].click();
  }, 150));

  // ---------- やりたいことで探す ----------
  const card = (d, x, showDict = false) => {
    const k = keyOf(d, x);
    const star = h('button', { type: 'button', class: `dc-star${fav.has(k) ? ' on' : ''}`, title: fav.has(k) ? 'よく使うから外す' : 'よく使うに入れる', 'aria-label': 'よく使う' }, fav.has(k) ? '★' : '☆');
    star.addEventListener('click', () => {
      if (fav.has(k)) fav.delete(k);
      else fav.add(k);
      saveFav();
      render();
    });
    return h('article', { class: 'dc-item' },
      h('div', { class: 'dc-head' }, h('h3', { class: 'dc-title' }, x.t), showDict ? h('span', { class: 'tag' }, d.name) : '', h('span', { class: 'dc-cat' }, x.cat), star),
      codeBox(x.code, d.id),
      h('p', { class: 'dc-desc' }, x.d),
      x.notes ? h('table', { class: 'dc-notes' }, h('tr', {}, h('th', { colspan: 2 }, 'データベース・環境による違い')), ...x.notes.map(([a, b]) => h('tr', {}, h('td', {}, a), h('td', { class: 'mono', onclick: () => copy(b), title: 'クリックでコピー' }, b)))) : '',
    );
  };
  function renderTasks() {
    const q = $('dcSearch').value.trim().toLowerCase();
    const list = $('dcList');
    if (q) {
      const words = q.split(/\s+/);
      const hits = DICTS.flatMap((d) => d.entries.filter((x) => words.every((w) => `${x.t} ${x.code} ${x.d} ${x.kw} ${x.cat} ${d.name}`.toLowerCase().includes(w))).map((x) => [d, x]));
      $('dcCats').replaceChildren();
      $('dcInfo').textContent = `「${$('dcSearch').value.trim()}」：${hits.length} 件（SQL・Python・Linux のすべてから）`;
      list.replaceChildren(...(hits.length ? hits.map(([d, x]) => card(d, x, true)) : [h('p', { class: 'hint' }, '見つかりませんでした。別の言い方（例：「重複」「件数」「置換」）や英語（distinct・grep など）でも探せます。')]));
      return;
    }
    if (favOnly) {
      const items = DICTS.flatMap((d) => d.entries.filter((x) => fav.has(keyOf(d, x))).map((x) => [d, x]));
      $('dcCats').replaceChildren();
      $('dcInfo').textContent = `よく使うに入れた項目：${items.length} 件（☆ を押すと入ります）`;
      list.replaceChildren(...(items.length ? items.map(([d, x]) => card(d, x, true)) : [h('p', { class: 'hint' }, 'まだありません。各項目の ☆ を押すと、ここにまとまります。')]));
      return;
    }
    const d = DICTS.find((x) => x.id === lang);
    $('dcCats').replaceChildren(
      h('button', { type: 'button', class: `chip${cat ? '' : ' on'}`, onclick: () => { cat = null; render(); } }, 'すべて'),
      ...d.cats.map((c) => h('button', { type: 'button', class: `chip${cat === c ? ' on' : ''}`, onclick: () => { cat = c; render(); } }, c, h('small', {}, d.entries.filter((x) => x.cat === c).length))),
    );
    const items = d.entries.filter((x) => !cat || x.cat === cat);
    $('dcInfo').textContent = `${d.desc}（${items.length} 件）`;
    const groups = (cat ? [cat] : d.cats).map((c) => [c, items.filter((x) => x.cat === c)]).filter(([, l]) => l.length);
    list.replaceChildren(...groups.flatMap(([c, l]) => [h('h2', { class: 'dc-group' }, c), ...l.map((x) => card(d, x))]));
  }
  $('dcSearch').addEventListener('input', debounce(render, 150));
  $('dcSearch').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.target.value = '';
      render();
    }
  });

  function render() {
    renderTabs();
    if (mode === 'cmd') {
      renderIndex();
      renderDetail();
    } else renderTasks();
  }
  render();
  // #dict/sql のように開いたら、その言語を表示する
  return (arg) => {
    if (arg && COMMANDS[arg]) {
      lang = arg;
      render();
    }
  };
}
