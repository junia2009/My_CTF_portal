// AI 入力チェック：見えない文字・隠しコンテンツ・注入パターンの検出と、無害化
import * as PI from '../lib/pinject.js';
import { diffChars } from '../lib/diff.js';
import { $, h, copy, debounce, setTable, registerReceiver, fill, pallasSay, sendTo } from './common.js';

const LEVEL_CLASS = { 高: 'lv3', 中: 'lv2', 低: 'lv1', なし: 'lv0' };

// 文字列の一部（index, len）を mark で強調した要素を作る
function highlight(text, spans) {
  const parts = [];
  let last = 0;
  for (const sp of [...spans].sort((a, b) => a.index - b.index)) {
    if (sp.index < last) continue;
    if (sp.index > last) parts.push(text.slice(last, sp.index));
    parts.push(h('mark', { title: sp.title ?? '' }, text.slice(sp.index, sp.index + sp.len)));
    last = sp.index + sp.len;
  }
  parts.push(text.slice(last));
  return parts;
}

export function initPinject() {
  let lastLevel = null;

  function run() {
    const text = $('piIn').value;
    if (!text.trim()) {
      $('piResult').hidden = true;
      return;
    }
    $('piResult').hidden = false;
    const r = PI.analyze(text.slice(0, 300000));
    renderSummary(r);
    renderInvisible(text, r);
    renderHidden(r);
    renderPatterns(text, r);
    renderSanitize();
    if (r.level !== lastLevel && (r.level === '高' || r.level === '中')) {
      pallasSay({ kind: 'pinjectRisk', mood: r.level === '高' ? 'alert' : 'think', level: r.level, anchor: '#piSummary' });
    }
    lastLevel = r.level;
  }

  // ---- 総合判定 ----
  function renderSummary(r) {
    const hiddenSentences = [r.tags && ['Unicode タグ文字に隠れた文', r.tags], r.vsText && ['異体字セレクタに隠れたデータ', r.vsText]].filter(Boolean);
    $('piSummary').replaceChildren(
      h('div', { class: `pi-gauge ${LEVEL_CLASS[r.level]}` },
        h('div', { class: 'pi-meter' }, h('i', { style: `width:${r.score}%` })),
        h('div', { class: 'pi-level' }, h('span', {}, '危険度'), h('b', {}, r.level), h('span', { class: 'pi-score' }, `${r.score} / 100`)),
      ),
      r.reasons.length
        ? h('ul', { class: 'log' }, ...r.reasons.map((x) => h('li', {}, x)))
        : h('p', { class: 'hint' }, '目立った問題は見つかりませんでした。ただし、検査は既知の手口に基づくもので、安全を保証するものではありません。'),
      ...hiddenSentences.map(([label, t]) => h('div', { class: 'alert' }, `${label}：`, h('b', { class: 'pi-secret copyable', onclick: () => copy(t) }, t))),
      r.innerHits.length ? h('div', { class: 'alert' }, `隠れた部分の中に、乗っ取りらしい表現が ${r.innerHits.length} 件あります（「隠しコンテンツ」「見えない文字」タブを確認）`) : '',
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'ghost small', onclick: () => document.querySelector('[data-tab="pisan"]').click() }, '無害化した文章を見る'),
        h('a', { class: 'btn ghost small', href: '#cheatsheet/AI' }, '対策のチェックリスト'),
      ),
    );
  }

  // ---- 見えない文字 ----
  function renderInvisible(text, r) {
    const { items, counts } = r.invisible;
    $('piInvCounts').replaceChildren(...(items.length
      ? Object.entries(counts).map(([k, v]) => h('span', { class: 'accent' }, `${PI.CAT_LABEL[k]} ${v}`))
      : [h('span', {}, '見えない文字・紛らわしい文字は見つかりませんでした')]));
    const reveal = [];
    if (r.tags) reveal.push(h('div', { class: 'alert' }, 'タグ文字を英字に戻すと：', h('b', { class: 'pi-secret copyable', onclick: () => copy(r.tags) }, r.tags)));
    if (r.vsText) reveal.push(h('div', { class: 'alert' }, '異体字セレクタをバイトとして読むと：', h('b', { class: 'pi-secret copyable', onclick: () => copy(r.vsText) }, r.vsText)));
    $('piReveal').replaceChildren(...reveal);
    const vis = PI.visualize(text.slice(0, 20000));
    $('piVisual').replaceChildren(...vis.map((p) => (p.text !== undefined ? p.text : h('span', { class: `pi-ch c-${p.cat}`, title: p.title }, p.mark))));
    if (items.length) {
      setTable($('piInvTable'), ['位置', '文字', '種類', '説明'], items.slice(0, 500).map((x) =>
        h('tr', {}, h('td', { class: 'num' }, x.index), h('td', { class: 'num' }, x.code), h('td', { class: 'num' }, PI.CAT_LABEL[x.cat]), h('td', {}, x.name))));
    } else $('piInvTable').replaceChildren();
  }

  // ---- 隠しコンテンツ ----
  function renderHidden(r) {
    if (!r.hidden.length) {
      $('piHidden').replaceChildren(h('p', { class: 'hint' }, 'HTML コメント・非表示の要素・外部画像などは見つかりませんでした。'));
      return;
    }
    $('piHidden').replaceChildren(...r.hidden.map((x) => {
      const inner = PI.detectInjection(x.content).findings;
      return h('div', { class: `pi-item risk${x.risk}` },
        h('div', { class: 'pi-item-head' }, h('span', { class: 'tag' }, x.type), x.detail ? h('span', { class: 'hint' }, x.detail) : '', inner.length ? h('span', { class: 'tag warn' }, '乗っ取りらしい表現あり') : ''),
        h('div', { class: 'mono-out', onclick: () => copy(x.content) }, ...highlight(x.content, inner.map((f) => ({ ...f, title: f.cat })))),
      );
    }));
  }

  // ---- 注入パターン ----
  function renderPatterns(text, r) {
    const f = r.injection.findings;
    $('piPatText').replaceChildren(...highlight(text.slice(0, 20000), f.filter((x) => x.index < 20000).map((x) => ({ ...x, title: x.cat }))));
    if (!f.length) {
      $('piPatTable').replaceChildren(h('tr', {}, h('td', { class: 'hint' }, '当てはまる表現はありませんでした')));
      return;
    }
    setTable($('piPatTable'), ['分類', '該当箇所', ''], f.map((x) =>
      h('tr', {},
        h('td', { class: 'num' }, x.cat),
        h('td', {}, x.match.length > 120 ? x.match.slice(0, 120) + '…' : x.match, x.decoded ? h('div', { class: 'hint' }, `デコードすると：${x.decoded.slice(0, 160)}`) : ''),
        h('td', { class: 'num' }, x.decoded ? h('button', { type: 'button', class: 'ghost small', onclick: () => sendTo('codec', { text: x.match, magic: true }) }, 'デコード') : ''),
      )));
  }

  // ---- 無害化 ----
  function renderSanitize() {
    const opts = Object.fromEntries([...document.querySelectorAll('.piOpt')].map((c) => [c.value, c.checked]));
    const src = $('piIn').value.slice(0, 300000);
    const out = PI.sanitize(src, opts);
    $('piSanOut').textContent = out;
    // 差分は長すぎると重いので、先頭だけ
    const ops = diffChars(src.slice(0, 4000), out.slice(0, 4400));
    const shown = ops.filter((o) => o.type !== 'eq').length
      ? ops.map((o) => (o.type === 'eq' ? o.text : h(o.type === 'add' ? 'ins' : 'del', {}, o.type === 'del' && PI.classify(o.text.codePointAt(0)) ? `⟦${o.text.codePointAt(0).toString(16).toUpperCase()}⟧` : o.text)))
      : ['（変更はありません）'];
    $('piSanDiff').replaceChildren(h('div', { class: 'diff-inline' }, ...shown));
  }

  $('piIn').addEventListener('input', debounce(run, 300));
  document.querySelectorAll('.piOpt').forEach((c) => c.addEventListener('change', renderSanitize));
  $('piCopy').addEventListener('click', () => copy($('piSanOut').textContent));
  $('piFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    $('piIn').value = await f.text();
    run();
  });
  registerReceiver('pinject', (p) => fill('piIn', p.text));
}
