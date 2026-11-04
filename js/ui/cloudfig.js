// 学ぶ：クラウドの基礎のテキストの図と、練習用の部品（IAM の許可/拒否の判定）
import { h } from './common.js';
import { s, T, R, A, L, frame, pc, server, cloud } from './netfig.js';

const doc = (x, y, w, hh, label, cls = 'nf-box', tcls = 'nf-t mono') => [R(x, y, w, hh, cls, 4), T(x + w / 2, y + hh / 2 + 4, label, tcls)];

export const CLOUD_FIGURES = {
  // サービスモデル：どこまで自分で管理するか
  models() {
    const layers = ['アプリ', 'データ', 'ランタイム', 'ミドルウェア', 'OS', '仮想化', 'サーバー', 'ストレージ', 'ネットワーク'];
    // 各列で「自分が管理(true)/事業者が管理(false)」
    const cols = [
      ['自社運用（オンプレ）', layers.map(() => true)],
      ['IaaS（仮想マシン）', layers.map((_, i) => i <= 4)],
      ['PaaS（実行環境）', layers.map((_, i) => i <= 1)],
      ['SaaS（完成品）', layers.map(() => false)],
    ];
    const kids = [T(360, 18, '上のサービスほど、自分で管理する範囲が小さくなる', 'nf-t head')];
    const x0 = 180, cw = 125, y0 = 36, rh = 26;
    cols.forEach(([name, mine], c) => {
      const x = x0 + c * cw;
      kids.push(T(x + cw / 2 - 4, y0 - 2, name.split('（')[0], 'nf-t small strong'), T(x + cw / 2 - 4, y0 + 10, '（' + (name.split('（')[1] || ''), 'nf-t small'));
      layers.forEach((_, i) => {
        const y = y0 + 20 + i * rh;
        kids.push(R(x, y, cw - 6, rh - 3, mine[i] ? 'nf-box l-app' : 'nf-box', 3), T(x + (cw - 6) / 2, y + 16, mine[i] ? '自分' : '事業者', mine[i] ? 'nf-t small strong acc' : 'nf-t small'));
      });
    });
    layers.forEach((l, i) => kids.push(T(170, y0 + 20 + i * rh + 16, l, 'nf-t small', 'end')));
    kids.push(T(360, y0 + 20 + layers.length * rh + 18, '水色＝自分で管理・運用する部分。少ないほど楽だが、融通は利きにくくなる', 'nf-t small'));
    return frame(720, y0 + 20 + layers.length * rh + 30, 'サービスモデル（IaaS / PaaS / SaaS）', ...kids);
  },

  // 責任共有モデル
  shared() {
    const kids = [
      R(30, 40, 310, 200, 'nf-box l-app', 8), T(185, 64, '利用者の責任', 'nf-t head'), T(185, 84, '「クラウドの中（in the cloud）」', 'nf-t small'),
      ...['データ・分類', 'アクセス管理（IAM）', 'OS・アプリの設定と更新（IaaS）', 'ネットワークの設定（SG など）', '暗号化の設定・鍵の管理', '公開範囲の設定'].map((t, i) => [R(46, 100 + i * 23, 278, 20, 'nf-box', 3), T(185, 114 + i * 23, t, 'nf-t small')]).flat(),
      R(380, 40, 310, 200, 'nf-box l-net', 8), T(535, 64, '事業者の責任', 'nf-t head'), T(535, 84, '「クラウドそのもの（of the cloud）」', 'nf-t small'),
      ...['物理のデータセンター', 'サーバー・ストレージ・回線', '仮想化の基盤', 'マネージドサービスの中身'].map((t, i) => [R(396, 108 + i * 28, 278, 24, 'nf-box', 3), T(535, 124 + i * 28, t, 'nf-t small')]).flat(),
      T(360, 262, '事故の多くは「利用者の責任」側の設定ミス。クラウドを使う＝丸投げ、ではない', 'nf-t small acc')];
    return frame(720, 274, '責任共有モデル', ...kids);
  },

  // リージョンとアベイラビリティゾーン
  regions() {
    const kids = [T(360, 20, '離れた場所に分けて置くことで、1 か所の障害でも止まらないようにする', 'nf-t head')];
    const region = (x, name) => {
      const k = [R(x, 44, 280, 150, 'nf-zone', 8), T(x + 140, 66, name, 'nf-t strong')];
      ['AZ-a', 'AZ-b', 'AZ-c'].forEach((az, i) => {
        k.push(R(x + 18 + i * 86, 82, 78, 96, 'nf-box l-net', 6), T(x + 18 + 39 + i * 86, 100, az, 'nf-t small strong'),
          ...doc(x + 28 + i * 86, 112, 58, 24, 'サーバー', 'nf-box l-app', 'nf-t small'), ...doc(x + 28 + i * 86, 144, 58, 24, 'DB 複製', 'nf-box', 'nf-t small'));
      });
      return k;
    };
    kids.push(...region(30, 'リージョン（東京）'), ...region(410, 'リージョン（大阪）'));
    kids.push(A('M310 120 H406', 'back'), T(358, 110, '複製', 'nf-t small acc'),
      T(360, 216, 'AZ＝同じリージョン内の、離れたデータセンター。複数 AZ に置くと片方の障害に耐える', 'nf-t small'),
      T(360, 236, 'リージョン＝地理的に離れた拠点。法令（データの置き場所）・遅延・災害対策で選ぶ', 'nf-t small'));
    return frame(720, 248, 'リージョンとアベイラビリティゾーン（AZ）', ...kids);
  },

  // IAM：誰が・何に・何をしてよいか
  iam() {
    const kids = [
      ...pc(80, 90, ''), T(80, 128, '利用者 / ロール', 'nf-t small strong'), T(80, 144, '（プリンシパル）', 'nf-t small'),
      R(240, 60, 200, 90, 'nf-box l-net', 8), T(340, 84, 'ポリシー', 'nf-t strong'), T(340, 106, '許可・拒否のルール', 'nf-t small'), T(340, 124, '（誰が・何に・何を）', 'nf-t small'),
      ...server(600, 90, ''), T(600, 136, '対象（リソース）', 'nf-t small strong'),
      A('M106 90 H236', ''), A('M444 90 H570', ''), T(170, 80, 'この人の', 'nf-t small'), T(508, 80, '許可された操作だけ', 'nf-t small acc'),
      R(60, 180, 600, 76, 'nf-box shield', 8), T(360, 202, '判定の原則', 'nf-t strong'),
      T(360, 224, '① 既定はすべて拒否　② 明示的な許可があれば許可　③ 明示的な拒否は、許可より優先', 'nf-t small'),
      T(360, 244, '最小権限：必要な操作・対象だけに絞る（* の付けすぎに注意）', 'nf-t small acc')];
    return frame(720, 268, 'IAM：誰が・何に・何をしてよいか', ...kids);
  },
};

// ---------- 練習用の部品：IAM の許可/拒否の判定 ----------
// ワイルドカード（*）対応の簡易マッチ
const wild = (pat, v) => new RegExp('^' + pat.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(v);
const matchList = (field, v) => (Array.isArray(field) ? field : [field]).some((p) => wild(p, v));

export const CLOUD_WIDGETS = {
  iampolicy() {
    const DEFAULT = `[
  { "Effect": "Allow", "Action": "s3:*",        "Resource": "arn:aws:s3:::reports/*" },
  { "Effect": "Allow", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::public/*" },
  { "Effect": "Deny",  "Action": "s3:DeleteObject", "Resource": "*" }
]`;
    const conf = h('textarea', { rows: 8, class: 'nf-calc-conf', spellcheck: 'false', 'aria-label': 'ポリシー（JSON）' }, DEFAULT);
    const action = h('input', { value: 's3:DeleteObject', 'aria-label': 'リクエストの操作' });
    const resource = h('input', { value: 'arn:aws:s3:::reports/old.csv', 'aria-label': 'リクエストの対象' });
    const out = h('div', { class: 'nf-calc-out' });
    const PRESET = [['s3:GetObject', 'arn:aws:s3:::reports/a.csv'], ['s3:PutObject', 'arn:aws:s3:::reports/b.csv'], ['s3:DeleteObject', 'arn:aws:s3:::reports/old.csv'], ['s3:GetObject', 'arn:aws:s3:::secret/x']];
    const chips = h('div', { class: 'nf-calc-row' }, ...PRESET.map(([a, r]) => h('button', { type: 'button', class: 'ghost small', onclick: () => { action.value = a; resource.value = r; run(); } }, a.replace('s3:', ''))));
    function run() {
      let stmts;
      try { stmts = JSON.parse(conf.value); if (!Array.isArray(stmts)) throw 0; } catch { return out.replaceChildren(h('p', { class: 'hint' }, 'ポリシーは [ … ] の JSON で入れてください')); }
      const a = action.value.trim(), r = resource.value.trim();
      const rows = [];
      let anyAllow = false, anyDeny = false;
      for (const st of stmts) {
        const hit = matchList(st.Action ?? [], a) && matchList(st.Resource ?? [], r);
        if (hit && st.Effect === 'Allow') anyAllow = true;
        if (hit && st.Effect === 'Deny') anyDeny = true;
        rows.push(h('tr', { class: hit ? (st.Effect === 'Deny' ? 'nf-bad' : 'nf-hit') : '' },
          h('th', {}, st.Effect), h('td', {}, h('code', {}, [].concat(st.Action).join(', '))), h('td', {}, h('code', {}, [].concat(st.Resource).join(', '))), h('td', {}, hit ? '一致' : '—')));
      }
      const result = anyDeny ? ['拒否', '明示的な拒否は許可より優先される'] : anyAllow ? ['許可', '一致する許可があり、拒否は無い'] : ['拒否', '一致する許可が無い（既定はすべて拒否）'];
      out.replaceChildren(
        h('div', { class: 'mn-table-wrap' }, h('table', { class: 'mn-table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Effect'), h('th', {}, 'Action'), h('th', {}, 'Resource'), h('th', {}, '今回'))), h('tbody', {}, ...rows))),
        h('p', {}, h('b', { class: result[0] === '許可' ? 'nf-ok' : 'nf-danger' }, `結果：${result[0]}`), '　', h('span', { class: 'hint' }, result[1])));
    }
    [conf, action, resource].forEach((x) => x.addEventListener('input', run));
    run();
    return h('div', { class: 'nf-calc' }, h('div', { class: 'nf-calc-title' }, 'TRY：IAM の許可/拒否'),
      h('p', { class: 'hint' }, '操作と対象を変えて、ポリシーがどう判定するか確かめましょう（簡易版：Allow / Deny と * のワイルドカードに対応。既定は拒否、拒否が最優先）。'),
      conf, h('div', { class: 'nf-calc-row' }, h('span', {}, '操作'), action, h('span', {}, '対象'), resource), chips, out);
  },
};
