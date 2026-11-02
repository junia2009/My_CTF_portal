// ホーム：コマンドバー（その場で診断）/ ツールのタイル / ジャンル別ブリーフィング / ファイルのドロップ
import { identify, LEVEL } from '../lib/identify.js';
import { GENRES } from '../data/genres.js';
import { GENRE_STEPS } from '../data/help.js';
import { TOOLS, TOOL_GROUPS, TOOL_LABEL, icon } from '../data/tools.js';
import { toPayload } from './beginner.js';
import { $, h, store, debounce, getPrefixes, sendTo, fill, openFileSmart } from './common.js';

export function initHome() {
  initCommand();
  initTools();
  initGenres();
  initDrop();
}

// ---------- コマンドバー ----------
function initCommand() {
  const input = $('cmdIn'), out = $('cmdOut');
  const open = (r) => (r.tool === 'cheatsheet' ? (location.hash = `#cheatsheet/${r.payload}`) : sendTo(r.tool, toPayload(r)));

  function run() {
    const v = input.value;
    if (!v.trim()) {
      out.replaceChildren();
      return [];
    }
    const results = identify(v, getPrefixes()).slice(0, 3);
    out.replaceChildren(
      ...results.map((r, i) =>
        h('button', { type: 'button', class: `cmd-hit lv${r.level}${i === 0 ? ' top' : ''}`, onclick: () => open(r) },
          h('span', { class: 'cmd-lv' }, LEVEL[r.level]),
          h('span', { class: 'cmd-body' }, h('b', {}, r.title), h('span', {}, r.reason)),
          h('span', { class: 'cmd-tool' }, icon(r.tool === 'notes' ? 'notes' : r.tool, 'ico'), TOOL_LABEL[r.tool] ?? 'チートシート', icon('arrow', 'ico arrow')),
        ),
      ),
      h('a', { class: 'cmd-more', href: '#identify', onclick: () => setTimeout(() => fill('idIn', v), 0) }, '診断の詳細を見る ›'),
    );
    return results;
  }

  input.addEventListener('input', debounce(run, 180));
  // Enter：いちばん可能性の高いツールで開く
  $('cmdForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const top = run()[0];
    if (top) open(top);
  });
  document.querySelectorAll('[data-cmd-try]').forEach((b) => b.addEventListener('click', () => {
    input.value = b.dataset.cmdTry;
    run();
    input.focus();
  }));
  $('cmdFile').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) openFileSmart(f);
  });
  $('cmdForm').querySelector('.cmd-file').append(icon('upload', 'ico'));
}

// ---------- ツールのタイル ----------
function initTools() {
  $('toolGrid').replaceChildren(
    ...TOOL_GROUPS.map((g) =>
      h('div', { class: 'tool-group' },
        h('div', { class: 'tool-group-name' }, g),
        h('div', { class: 'tool-tiles' },
          ...TOOLS.filter((t) => t.group === g).map((t) =>
            h('a', { class: 'tool-tile', href: `#${t.id}` },
              h('span', { class: 'tt-icon' }, icon(t.id)),
              h('span', { class: 'tt-body' }, h('b', {}, t.name), h('span', {}, t.desc)),
              icon('arrow', 'ico tt-go'),
            ),
          ),
        ),
      ),
    ),
  );
}

// ---------- ジャンル別ブリーフィング ----------
function initGenres() {
  let current = store.get('ctfportal.homeGenre', GENRES[0].id);
  if (!GENRES.some((g) => g.id === current)) current = GENRES[0].id;
  const tabs = $('genreTabs'), panel = $('genrePanel');

  function render() {
    tabs.querySelectorAll('button').forEach((b) => {
      const on = b.dataset.g === current;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    const g = GENRES.find((x) => x.id === current);
    const idx = GENRES.indexOf(g) + 1;
    panel.replaceChildren(
      h('div', { class: 'gp-index', 'aria-hidden': 'true' }, String(idx).padStart(2, '0')),
      h('div', { class: 'gp-main' },
        h('div', { class: 'gp-title' }, g.label),
        h('p', { class: 'gp-desc' }, g.desc),
        h('ol', { class: 'gp-steps' }, ...GENRE_STEPS[g.id].map((s) => h('li', {}, s))),
      ),
      h('div', { class: 'gp-side' },
        h('div', { class: 'gp-side-label' }, '使うツール'),
        ...g.tools.map((t) => h('a', { class: 'gp-tool', href: `#${t}` }, icon(t), TOOL_LABEL[t])),
        h('a', { class: 'gp-tool alt', href: `#cheatsheet/${g.id}` }, icon('cheatsheet'), `${g.label} のチートシート`),
      ),
    );
  }

  tabs.append(...GENRES.map((g) =>
    h('button', {
      type: 'button', role: 'tab', 'data-g': g.id,
      onclick: () => {
        current = g.id;
        store.set('ctfportal.homeGenre', current);
        render();
      },
    }, g.label)));
  render();
}

// ---------- ファイルのドロップ（ホーム全体） ----------
function initDrop() {
  const home = document.querySelector('[data-page="home"]'), veil = $('homeVeil');
  let depth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');
  home.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    veil.hidden = false;
  });
  home.addEventListener('dragover', (e) => hasFiles(e) && e.preventDefault());
  home.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) veil.hidden = true;
  });
  home.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    veil.hidden = true;
    const f = e.dataTransfer.files[0];
    if (f) openFileSmart(f);
  });
}

// サイドメニューにアイコンを付ける
export function decorateNav() {
  document.querySelectorAll('#nav a[data-route]').forEach((a) => {
    const name = a.dataset.route;
    a.prepend(icon(name, 'ico nav-ico'));
  });
}
