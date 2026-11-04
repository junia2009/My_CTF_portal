// 逆引き辞典：「やりたいこと」から SQL / Python / Linux コマンドの書き方を引く
import { DICTS } from '../data/dict.js';
import { $, h, store, copy, debounce } from './common.js';

const FAV_KEY = 'ctfportal.dictFav';
const keyOf = (d, x) => `${d.id}:${x.t}`;

// コードの表示：コメント（# / --）を薄く、<…> の置き換える部分を強調
function codeView(code, lang) {
  const pre = h('pre', { class: 'dc-code' });
  for (const [i, line] of code.split('\n').entries()) {
    if (i) pre.append('\n');
    const m = lang === 'sql' ? /^(.*?)(--.*)$/.exec(line) : /^((?:[^'"#]|'[^']*'|"[^"]*")*?)(#.*)$/.exec(line);
    if (m && !(lang === 'linux' && /^#!/.test(m[2]))) {
      pre.append(m[1], h('span', { class: 'dc-cmt' }, m[2]));
    } else pre.append(line);
  }
  return pre;
}

export function initDict() {
  let cur = DICTS[0].id;
  let cat = null; // 絞り込み中の分類
  let favOnly = false;
  const fav = new Set(store.get(FAV_KEY, []));
  const saveFav = () => store.set(FAV_KEY, [...fav]);

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
      h('div', { class: 'dc-head' },
        h('h3', { class: 'dc-title' }, x.t),
        showDict ? h('span', { class: 'tag' }, d.name) : '',
        h('span', { class: 'dc-cat' }, x.cat),
        star,
      ),
      h('div', { class: 'dc-code-wrap' },
        codeView(x.code, d.id),
        h('button', { type: 'button', class: 'ghost small dc-copy', onclick: () => copy(x.code) }, 'コピー'),
      ),
      h('p', { class: 'dc-desc' }, x.d),
      x.notes ? h('table', { class: 'dc-notes' }, h('tr', {}, h('th', { colspan: 2 }, 'データベース・環境による違い')), ...x.notes.map(([a, b]) => h('tr', {}, h('td', {}, a), h('td', { class: 'mono', onclick: () => copy(b), title: 'クリックでコピー' }, b)))) : '',
    );
  };

  function render() {
    const q = $('dcSearch').value.trim().toLowerCase();
    // タブ
    $('dcTabs').replaceChildren(
      ...DICTS.map((d) => h('button', { type: 'button', class: !favOnly && d.id === cur ? 'active' : '', onclick: () => { cur = d.id; cat = null; favOnly = false; location.hash = `#dict/${d.id}`; render(); } }, d.name, h('small', {}, d.entries.length))),
      h('button', { type: 'button', class: `dc-fav-tab${favOnly ? ' active' : ''}`, onclick: () => { favOnly = !favOnly; render(); } }, '★ よく使う', h('small', {}, fav.size)),
    );
    const list = $('dcList');
    // 検索：全部の辞典から探す（日本語の「やりたいこと」・コード・説明・別名）
    if (q) {
      const words = q.split(/\s+/);
      const hits = DICTS.flatMap((d) => d.entries.filter((x) => {
        const hay = `${x.t} ${x.code} ${x.d} ${x.kw} ${x.cat} ${d.name}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      }).map((x) => [d, x]));
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
    const d = DICTS.find((x) => x.id === cur);
    $('dcCats').replaceChildren(
      h('button', { type: 'button', class: `chip${cat ? '' : ' on'}`, onclick: () => { cat = null; render(); } }, 'すべて'),
      ...d.cats.map((c) => h('button', { type: 'button', class: `chip${cat === c ? ' on' : ''}`, onclick: () => { cat = c; render(); } }, c, h('small', {}, d.entries.filter((x) => x.cat === c).length))),
    );
    const items = d.entries.filter((x) => !cat || x.cat === cat);
    $('dcInfo').textContent = `${d.desc}（${items.length} 件）`;
    // 分類ごとに見出しを付けて並べる
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
  render();
  // #dict/sql のように開いたら、その辞典を表示する
  return (arg) => {
    if (arg && DICTS.some((d) => d.id === arg)) {
      cur = arg;
      cat = null;
      favOnly = false;
      render();
    }
  };
}
