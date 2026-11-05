// 難解言語ランナー：Whitespace・Brainfuck・Ook! を貼り付け／ファイルから実行する
import { $, h, copy } from './common.js';
import { wsRun, wsListing, wsVisible, bfRun, ookToBf, guessEsolang } from '../lib/esolang.js';

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
