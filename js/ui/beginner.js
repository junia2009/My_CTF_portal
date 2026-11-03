// 初心者向けの画面：はじめての CTF / 迷ったら診断 / 各ツールの「使い方」パネル
import { identify, LEVEL } from '../lib/identify.js';
import { GENRES } from '../data/genres.js';
import { WORKFLOW, GENRE_STEPS, GLOSSARY, MANNERS, PAGE_HELP } from '../data/help.js';
import { SAMPLES } from '../data/samples.js';
import { TOOL_LABEL } from '../data/tools.js';
import { $, h, store, toast, debounce, getPrefixes, sendTo, registerReceiver, fill, openFileSmart, sendSample } from './common.js';


// ================= はじめての CTF =================
export function initGuide() {
  $('guideFlow').append(...WORKFLOW.map((w, i) =>
    h('li', {}, h('span', { class: 'wf-num' }, String(i + 1).padStart(2, '0')), h('div', {}, h('b', {}, w.title), h('p', {}, w.body))),
  ));
  $('guideManners').append(...MANNERS.map((m) => h('li', {}, m)));

  const sel = $('guideGenre');
  sel.append(...GENRES.map((g) => h('option', { value: g.id }, `${g.label} — ${g.desc}`)));
  const renderSteps = () => {
    const g = GENRES.find((x) => x.id === sel.value);
    $('guideSteps').replaceChildren(
      h('div', { class: 'card' },
        h('h3', {}, g.label),
        h('ol', { class: 'steps' }, ...GENRE_STEPS[g.id].map((s) => h('li', {}, s))),
        h('div', { class: 'links' },
          h('span', { class: 'hint' }, '使うツール: '),
          ...g.tools.map((t) => h('a', { href: `#${t}`, class: 'chip' }, TOOL_LABEL[t])),
          h('a', { href: `#cheatsheet/${g.id}`, class: 'chip' }, 'チートシート'),
        ),
      ),
    );
  };
  sel.addEventListener('change', renderSteps);
  renderSteps();

  const renderGloss = () => {
    const q = $('glossSearch').value.trim().toLowerCase();
    const list = GLOSSARY.filter(([t, d]) => !q || t.toLowerCase().includes(q) || d.toLowerCase().includes(q));
    $('glossList').replaceChildren(...(list.length
      ? list.flatMap(([t, d]) => [h('dt', {}, t), h('dd', {}, d)])
      : [h('dd', { class: 'hint' }, '該当する用語がありません')]));
  };
  $('glossSearch').addEventListener('input', debounce(renderGloss, 100));
  renderGloss();

  return (arg) => {
    if (arg && GENRES.some((g) => g.id === arg)) {
      sel.value = arg;
      renderSteps();
      setTimeout(() => $('guideSteps').scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    }
  };
}

// ================= 迷ったら診断 =================
export function toPayload(r) {
  switch (r.tool) {
    case 'codec': return { text: r.payload, magic: true };
    case 'classic': return { text: r.payload, tab: r.id === 'caesar' ? 'caesar' : 'freq' };
    case 'rsa': return { ...r.payload, run: true };
    case 'hash': return { id: r.payload };
    case 'net': return r.id === 'ip' ? { cidr: r.payload } : { ts: r.payload };
    case 'notes': return { flag: r.payload };
    default: return { text: r.payload };
  }
}

export function initIdentify() {
  const out = $('idOut');
  registerReceiver('identify', (p) => fill('idIn', p.text));
  function run() {
    const v = $('idIn').value;
    if (!v.trim()) return out.replaceChildren();
    const results = identify(v, getPrefixes());
    out.replaceChildren(...results.map((r, i) =>
      h('div', { class: `id-card lv${r.level}${i === 0 ? ' top' : ''}` },
        h('div', { class: 'id-head' },
          h('span', { class: 'id-level' }, `可能性 ${LEVEL[r.level]}`),
          h('b', {}, r.title),
        ),
        h('p', { class: 'id-reason' }, h('span', { class: 'lbl' }, '理由'), r.reason),
        h('p', { class: 'id-next' }, h('span', { class: 'lbl' }, '次にやること'), r.next),
        h('button', {
          type: 'button', class: i === 0 ? '' : 'ghost',
          onclick: () => (r.tool === 'cheatsheet' ? (location.hash = `#cheatsheet/${r.payload}`) : sendTo(r.tool, toPayload(r))),
        }, `${TOOL_LABEL[r.tool]} で開く ›`),
      ),
    ));
  }
  $('idIn').addEventListener('input', debounce(run, 200));
  document.querySelectorAll('[data-try]').forEach((b) => b.addEventListener('click', () => {
    $('idIn').value = b.dataset.try;
    run();
  }));

  const drop = $('idDrop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  const sendFile = (f) => f && openFileSmart(f);
  drop.addEventListener('drop', (e) => sendFile(e.dataTransfer.files[0]));
  $('idFile').addEventListener('change', (e) => {
    sendFile(e.target.files[0]);
    e.target.value = '';
  });
}

// ================= 各ツールの「使い方」パネル =================
export function initHelp() {
  const open = store.get('ctfportal.helpOpen', true);
  for (const [page, help] of Object.entries(PAGE_HELP)) {
    const h1 = document.querySelector(`[data-page="${page}"] h1`);
    if (!h1) continue;
    const sample = SAMPLES[page];
    const panel = h('details', { class: 'help', open: open ? '' : null },
      h('summary', {}, '使い方・こんなときに使う'),
      h('div', { class: 'help-body' },
        h('p', { class: 'help-when' }, h('span', { class: 'lbl' }, 'こんなとき'), help.when),
        h('ol', { class: 'steps' }, ...help.steps.map((s) => h('li', {}, s))),
        sample
          ? h('div', { class: 'row' },
              h('button', {
                type: 'button', class: 'small',
                onclick: async () => {
                  if (await sendSample(page, sample)) toast('例を読み込みました');
                },
              }, '▶ 例を試す'),
              h('span', { class: 'hint' }, `サンプル: ${help.sample}`),
            )
          : '',
      ),
    );
    panel.addEventListener('toggle', () => {
      if (panel.dataset.tourOpen) return; // ツアーが一時的に開け閉めしたときは、設定を変えない
      store.set('ctfportal.helpOpen', panel.open);
      // 1つ開閉したら、他のページのパネルもそろえる
      document.querySelectorAll('details.help').forEach((d) => d !== panel && (d.open = panel.open));
    });
    // 説明文（lead）がある場合はその後ろに置く
    const after = h1.nextElementSibling?.classList.contains('lead') ? h1.nextElementSibling : h1;
    after.after(panel);
  }
}
