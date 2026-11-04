// 学ぶ：監視・オブザーバビリティのテキストの図と、練習用の部品（SLO とエラーバジェット）
import { h } from './common.js';
import { s, T, R, A, L, frame, pc, server, cloud } from './netfig.js';

const doc = (x, y, w, hh, label, cls = 'nf-box', tcls = 'nf-t mono') => [R(x, y, w, hh, cls, 4), T(x + w / 2, y + hh / 2 + 4, label, tcls)];

export const OBS_FIGURES = {
  // 監視とオブザーバビリティの違い
  vs() {
    const kids = [
      R(30, 44, 310, 180, 'nf-box l-net', 8), T(185, 68, '監視（モニタリング）', 'nf-t head'), T(185, 88, '「決めたことを見張る」', 'nf-t small'),
      ...['CPU が 90% を超えた', 'ディスクが満杯に近い', 'サービスが応答しない', 'あらかじめ決めた指標を見る'].map((t, i) => [R(46, 104 + i * 26, 278, 22, 'nf-box', 3), T(185, 119 + i * 26, t, 'nf-t small')]).flat(),
      R(380, 44, 310, 180, 'nf-box l-app', 8), T(535, 68, 'オブザーバビリティ', 'nf-t head'), T(535, 88, '「後から問いかけられる」', 'nf-t small'),
      ...['なぜ遅い？どのリクエスト？', '想定しなかった事象も追える', '3 本柱：メトリクス・ログ・トレース', '原因までたどり着ける状態'].map((t, i) => [R(396, 104 + i * 26, 278, 22, 'nf-box', 3), T(535, 119 + i * 26, t, 'nf-t small')]).flat(),
      T(360, 246, '監視は「おかしいと気づく」、オブザーバビリティは「なぜかを後から調べられる」。両方いる', 'nf-t small acc')];
    return frame(720, 258, '監視とオブザーバビリティ', ...kids);
  },

  // 3 本柱
  pillars() {
    const cols = [
      ['メトリクス', '数値の時系列', 'CPU・リクエスト数・遅延', '軽い・傾向とアラート向き', 'l-net'],
      ['ログ', '出来事の記録', 'エラー・アクセス・操作', '詳しい・検索向き', 'l-app'],
      ['トレース', '1 リクエストの旅', 'どのサービスで何ミリ秒', '分散システムの遅さの特定', 'l-tr'],
    ];
    const kids = [T(360, 20, 'メトリクスで気づき、トレースで場所を絞り、ログで原因を読む', 'nf-t head')];
    cols.forEach(([name, what, ex, use, cls], i) => {
      const x = 20 + i * 234;
      kids.push(R(x, 38, 220, 180, `nf-box ${cls}`, 8), T(x + 110, 64, name, 'nf-t strong'), T(x + 110, 86, what, 'nf-t small'),
        R(x + 20, 104, 180, 42, 'nf-box', 4), T(x + 110, 122, '例', 'nf-t small'), T(x + 110, 138, ex, 'nf-t small strong'),
        T(x + 110, 176, '向き', 'nf-t small'), ...use.split('・').map((u, j) => T(x + 110, 192 + j * 15, u, 'nf-t small strong')));
      if (i < 2) kids.push(A(`M${x + 220} 128 h14`, 'dim'));
    });
    kids.push(T(360, 238, 'さらに「アラート」で人に知らせ、「ダッシュボード」で一覧する', 'nf-t small'));
    return frame(720, 250, 'オブザーバビリティの 3 本柱', ...kids);
  },

  // メトリクスの集め方（pull / push）
  collect() {
    const kids = [
      ...server(90, 70, ''), T(90, 112, 'サーバー / アプリ', 'nf-t small strong'), T(90, 128, '（/metrics を公開）', 'nf-t small'),
      R(280, 44, 160, 60, 'nf-box l-net', 6), T(360, 68, '収集', 'nf-t strong'), T(360, 86, 'Prometheus など', 'nf-t small'),
      ...doc(560, 44, 130, 60, '時系列 DB', 'nf-box'),
      A('M280 74 L140 74', 'back'), T(210, 64, 'pull（取りに行く）', 'nf-t small acc'),
      A('M440 74 H556', ''),
      R(280, 150, 160, 50, 'nf-box l-app', 6), T(360, 180, 'ダッシュボード', 'nf-t strong'),
      R(500, 150, 190, 50, 'nf-box fw', 6), T(595, 174, 'アラート', 'nf-t strong'), T(595, 190, '通知（メール・chat・電話）', 'nf-t small'),
      A('M620 104 V146', 'back'), A('M360 104 V146', ''),
      T(360, 226, 'pull 型：監視側がエンドポイントを取りに行く（Prometheus）。push 型：アプリから送る（StatsD・OpenTelemetry）', 'nf-t small'),
      T(360, 244, '集めた数値をダッシュボードで見て、しきい値を超えたらアラートで人に知らせる', 'nf-t small')];
    return frame(720, 256, 'メトリクスの集め方', ...kids);
  },

  // SLI / SLO / エラーバジェット
  slo() {
    const kids = [
      R(20, 40, 210, 80, 'nf-box l-net', 8), T(125, 64, 'SLI', 'nf-t strong'), T(125, 84, '指標（実測値）', 'nf-t small'), T(125, 102, '例：成功したリクエストの割合', 'nf-t small'),
      R(255, 40, 210, 80, 'nf-box l-app', 8), T(360, 64, 'SLO', 'nf-t strong'), T(360, 84, '目標', 'nf-t small'), T(360, 102, '例：99.9% を満たす', 'nf-t small'),
      R(490, 40, 210, 80, 'nf-box', 8), T(595, 64, 'SLA', 'nf-t strong'), T(595, 84, '契約（破ると補償）', 'nf-t small'), T(595, 102, 'SLO より緩めに結ぶ', 'nf-t small'),
      A('M230 80 H251', ''), A('M465 80 H486', ''),
      R(60, 150, 600, 56, 'nf-box shield', 8), T(360, 172, 'エラーバジェット＝許される失敗の量（100% − SLO）', 'nf-t strong'),
      T(360, 194, '99.9% が目標なら、0.1%（30 日で約 43 分）までは「止まってよい予算」', 'nf-t small acc'),
      T(360, 232, '予算が残っていれば新機能に挑戦、使い切ったら安定を優先。完璧（100%）を目指さず、現実的に', 'nf-t small')];
    return frame(720, 246, 'SLI / SLO / SLA とエラーバジェット', ...kids);
  },

  // アラートの設計（症状で鳴らす）
  alert() {
    const kids = [
      R(30, 40, 310, 170, 'nf-box fw', 8), T(185, 64, '✗ 鳴りすぎるアラート', 'nf-t head warn'),
      ...['原因（CPU 80%）で逐一鳴らす', '対処しようのない通知', '夜中に何度も起こされる', '→ 慣れて無視するようになる'].map((t, i) => [T(46, 94 + i * 26, t, 'nf-t small', 'start')]).flat(),
      R(380, 40, 310, 170, 'nf-box l-net', 8), T(535, 64, '✓ よいアラート', 'nf-t head'),
      ...['症状（利用者が困る事）で鳴らす', '例：成功率が SLO を割った', '対処が必要・手順が決まっている', '重要度で鳴らし分ける'].map((t, i) => [T(396, 94 + i * 26, t, 'nf-t small', 'start')]).flat(),
      T(360, 236, '「CPU が高い」ではなく「利用者の注文が失敗している」で鳴らす。アラート疲れを防ぐ', 'nf-t small acc')];
    return frame(720, 248, 'アラートの設計', ...kids);
  },
};

// ---------- 練習用の部品：SLO とエラーバジェット ----------
const fmtDur = (min) => {
  if (min < 1) return `${Math.round(min * 60)} 秒`;
  if (min < 60) return `${min.toFixed(1)} 分`;
  if (min < 1440) return `${(min / 60).toFixed(1)} 時間`;
  return `${(min / 1440).toFixed(1)} 日`;
};

export const OBS_WIDGETS = {
  slo() {
    const PRESETS = [['99', '2 本の 9'], ['99.9', '3 本の 9'], ['99.95', ''], ['99.99', '4 本の 9'], ['99.999', '5 本の 9']];
    const target = h('input', { value: '99.9', inputmode: 'decimal', 'aria-label': 'SLO（%）' });
    const actual = h('input', { value: '99.95', inputmode: 'decimal', 'aria-label': '実測（%）' });
    const out = h('div', { class: 'nf-calc-out' });
    const chips = h('div', { class: 'nf-calc-row' }, ...PRESETS.map(([v, t]) => h('button', { type: 'button', class: 'ghost small', onclick: () => { target.value = v; run(); } }, `${v}%${t ? '（' + t + '）' : ''}`)));
    function run() {
      const slo = parseFloat(target.value), act = parseFloat(actual.value);
      if (!(slo >= 0 && slo <= 100)) return out.replaceChildren(h('p', { class: 'hint' }, 'SLO は 0〜100 の % で入れてください'));
      const budgetPct = 100 - slo;
      const rows = [['1 日', 1440], ['1 週間', 1440 * 7], ['30 日（月）', 1440 * 30], ['1 年', 1440 * 365]];
      const budgetRows = rows.map(([label, min]) => h('tr', {}, h('th', {}, label), h('td', {}, fmtDur(min * budgetPct / 100))));
      let verdict = '';
      if (!isNaN(act)) {
        const used = slo >= 100 ? (act >= 100 ? 0 : 999) : Math.max(0, (100 - act) / budgetPct * 100);
        verdict = act >= slo
          ? h('p', {}, h('b', { class: 'nf-ok' }, 'SLO 達成'), `　エラーバジェットを ${Math.min(100, used).toFixed(0)}% 使用（${(100 - Math.min(100, used)).toFixed(0)}% 残り）`)
          : h('p', {}, h('b', { class: 'nf-danger' }, 'SLO 未達'), `　エラーバジェットを使い切っています（安定を優先する段階）`);
      }
      out.replaceChildren(
        h('p', {}, `許される失敗（エラーバジェット）＝ 100% − ${slo}% ＝ `, h('b', {}, `${budgetPct.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}%`)),
        h('p', { class: 'hint' }, 'その割合を「止まってよい時間」に直すと：'),
        h('table', { class: 'mn-table' }, h('tbody', {}, ...budgetRows)),
        verdict || h('p', { class: 'hint' }, '実測を入れると、達成/未達とバジェットの残りも出ます'));
    }
    [target, actual].forEach((x) => x.addEventListener('input', run));
    run();
    return h('div', { class: 'nf-calc' }, h('div', { class: 'nf-calc-title' }, 'TRY：SLO とエラーバジェット'),
      h('p', { class: 'hint' }, 'SLO（目標）を変えると、「止まってよい時間」がどれだけかを確かめられます。実測も入れると達成/未達を判定します。'),
      h('div', { class: 'nf-calc-row' }, h('span', {}, 'SLO'), target, h('span', {}, '%　実測'), actual, h('span', {}, '%')), chips, out);
  },
};
