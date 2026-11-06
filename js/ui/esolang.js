// 難解言語実行：Whitespace・Brainfuck・Ook! を貼り付け／ファイルから実行する
import { $, h, copy, registerReceiver } from './common.js';
import { wsRun, wsListing, wsVisible, bfRun, ookToBf, guessEsolang, wsAutoSolve } from '../lib/esolang.js';

const LANGS = { ws: 'Whitespace', bf: 'Brainfuck', ook: 'Ook!' };

// サンプル：C のコードの空白に Whitespace で "Hi!" を出すプログラムを隠したもの
const wsPush = (n) => '  ' + ' ' + n.toString(2).replace(/0/g, ' ').replace(/1/g, '\t') + '\n';
const WS_HIDDEN = [...'flag{ws}'].map((c) => wsPush(c.codePointAt(0)) + '\t\n  ').join('') + '\n\n\n';
const SAMPLES = {
  ws: (() => {
    // 見える C のコードの行末に、命令を少しずつ散らす
    const visible = ['#include<stdio.h>', 'int/**/main(){', 'puts("nothing_here");', 'return/**/0;', '}']; // 見える部分には空白を使わない
    const parts = WS_HIDDEN.split('\n');
    return parts.map((p, i) => (visible[i] ?? '') + p).join('\n');
  })(),
  bf: '>++++++++++[<++++++++++>-]<++.>++[<++>-]<++.>+++[<--->-]<--.>++[<++>-]<++.>++++[<++++>-]<++++.>+++++[<----->-]<.>++[<++>-]<.>++++[<++++>-]<+++++++.',
  ook: 'Ook. Ook? Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook! Ook? Ook? Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook? Ook! Ook! Ook? Ook! Ook? Ook. Ook. Ook. Ook. Ook. Ook! Ook. Ook. Ook? Ook. Ook. Ook. Ook. Ook! Ook? Ook? Ook. Ook. Ook. Ook. Ook. Ook. Ook? Ook! Ook! Ook? Ook! Ook? Ook. Ook. Ook. Ook. Ook. Ook! Ook. Ook. Ook? Ook. Ook. Ook. Ook. Ook. Ook. Ook! Ook? Ook? Ook. Ook! Ook! Ook! Ook! Ook! Ook! Ook. Ook? Ook! Ook! Ook? Ook! Ook? Ook. Ook! Ook! Ook! Ook! Ook! Ook. Ook. Ook? Ook. Ook. Ook. Ook. Ook! Ook? Ook? Ook. Ook. Ook. Ook. Ook. Ook. Ook? Ook! Ook! Ook? Ook! Ook? Ook. Ook. Ook. Ook. Ook. Ook! Ook. Ook. Ook? Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook! Ook? Ook? Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook? Ook! Ook! Ook? Ook! Ook? Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook! Ook. Ook. Ook? Ook. Ook. Ook. Ook. Ook. Ook. Ook! Ook? Ook? Ook. Ook! Ook! Ook! Ook! Ook! Ook! Ook. Ook? Ook! Ook! Ook? Ook! Ook? Ook. Ook! Ook! Ook! Ook! Ook! Ook! Ook! Ook. Ook! Ook. Ook. Ook? Ook. Ook. Ook. Ook. Ook! Ook? Ook? Ook. Ook! Ook! Ook! Ook! Ook. Ook? Ook! Ook! Ook? Ook! Ook? Ook. Ook! Ook. Ook. Ook? Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook! Ook? Ook? Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook? Ook! Ook! Ook? Ook! Ook? Ook. Ook. Ook. Ook. Ook. Ook! Ook.',
};

export function initEsolang() {
  const code = $('esCode'), lang = $('esLang'), info = $('esInfo'), out = $('esOut');
  registerReceiver('esolang', (pl) => { code.value = pl.text || ''; showGuess(); });

  const showGuess = () => {
    const g = guessEsolang(code.value);
    const ws = (code.value.match(/[ \t]/g) || []).length, tabs = (code.value.match(/\t/g) || []).length;
    info.replaceChildren(
      g ? h('span', {}, '見た目からの推測：', h('b', {}, LANGS[g])) : h('span', { class: 'hint' }, '言語は判別できませんでした（左で選んで実行）'),
      code.value ? h('span', { class: 'hint' }, `　空白 ${ws}・タブ ${tabs}・${code.value.length} 文字`) : '',
    );
    if (g && lang.value === 'auto') lang.dataset.guess = g;
  };

  $('esFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    code.value = await f.text(); // ファイルから読むと空白・タブがそのまま残る
    showGuess();
    e.target.value = '';
  });
  $('esSample').addEventListener('click', () => {
    const k = lang.value === 'auto' ? 'ws' : lang.value;
    code.value = SAMPLES[k];
    showGuess();
  });
  $('esClear').addEventListener('click', () => { code.value = ''; out.replaceChildren(); showGuess(); });
  code.addEventListener('input', showGuess);
  code.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); code.setRangeText('\t', code.selectionStart, code.selectionEnd, 'end'); showGuess(); } });
  $('esRun').addEventListener('click', run);

  function run() {
    const src = code.value;
    if (!src) return;
    const k = lang.value === 'auto' ? guessEsolang(src) ?? 'ws' : lang.value;
    const input = $('esInput').value;
    const card = h('article', { class: 'card' }, h('h2', { class: 'wf-h' }, `${LANGS[k]} として実行`));
    let r;
    try {
      r = k === 'ws' ? wsRun(src, input) : bfRun(k === 'ook' ? ookToBf(src) : src, input);
    } catch (e) {
      card.append(h('p', { class: 'error' }, `実行できませんでした：${e.message}`));
      if (k === 'ws') card.append(h('p', { class: 'hint' }, 'Whitespace は空白・タブ・改行がひとつでも欠けると壊れます。ブラウザの表示やチャットからコピーすると行末の空白やタブが消えやすいので、問題のファイルをダウンロードして「ファイルを開く」で読み込んでください。'));
      out.replaceChildren(card);
      return;
    }
    const flags = [...r.out.matchAll(/[A-Za-z0-9_]{2,}\{[^}\n]{1,120}\}|FLAG_[A-Za-z0-9_]+/g)].map((m) => m[0]);
    card.append(
      h('div', { class: 'wf-code' },
        h('div', { class: 'wf-code-head' }, h('span', {}, '出力'), h('span', { class: 'hint' }, `${r.steps.toLocaleString()} ステップ`),
          h('button', { type: 'button', class: 'ghost small', onclick: () => copy(r.out) }, 'コピー')),
        h('pre', {}, r.out || '（出力なし）')),
      r.error ? h('p', { class: 'error' }, r.error) : '',
      flags.length ? h('div', { class: 'wf-flag' }, 'フラグらしき文字列：', ...flags.map((f) => h('code', {}, f))) : '',
    );
    // 入力を求めるプログラムで、まだフラグが出ていなければ、答えの入力を自動で探して試す
    if (k === 'ws' && !flags.length) {
      const auto = wsAutoSolve(src);
      if (auto) {
        const hit = auto.tries.find((t) => t.flag);
        const box = h('div', { class: 'es-auto' }, h('b', {}, 'このプログラムは入力（' + [auto.readsNum && '数字', auto.readsChar && '文字'].filter(Boolean).join('・') + '）を読み込んで、正解かどうかを比べています。'));
        if (hit) {
          box.append(h('p', {}, '比べている値を命令から拾って試したところ、正解の入力が見つかりました：'),
            h('div', { class: 'wf-code' }, h('div', { class: 'wf-code-head' }, h('span', {}, `入力 = ${hit.input}`),
              h('button', { type: 'button', class: 'ghost small', onclick: () => { $('esInput').value = hit.input; run(); } }, 'この入力で実行')), h('pre', {}, hit.out)),
            h('div', { class: 'wf-flag' }, 'フラグらしき文字列：', h('code', {}, hit.flag)));
        } else if (auto.tries.length) {
          box.append(h('p', {}, '比べている値の候補を試しました（フラグらしき出力はなし）：'),
            ...auto.tries.slice(0, 5).map((t) => h('div', { class: 'wf-code' }, h('div', { class: 'wf-code-head' }, h('span', {}, `入力 = ${t.input}`)), h('pre', {}, t.out))));
        } else {
          box.append(h('p', { class: 'hint' }, '比べている値を自動では見つけられませんでした。下の「命令の一覧」で、入力（inn / inc）の後に push している数を探してください。'));
        }
        card.append(box);
      }
    }
    if (k === 'ws') {
      card.append(
        h('details', { class: 'es-more' }, h('summary', {}, `命令の一覧（${r.prog.length} 個）`), h('pre', { class: 'es-pre' }, wsListing(r.prog))),
        h('details', { class: 'es-more' }, h('summary', {}, '空白を見える記号で表示（· スペース　→ タブ　↵ 改行）'), h('pre', { class: 'es-pre' }, wsVisible(src))),
      );
    }
    out.replaceChildren(card);
  }
  showGuess();
}
