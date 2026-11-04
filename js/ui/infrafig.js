// 学ぶ：インフラ運用（Linux 運用・コンテナ基盤・nginx）のテキストの図と、練習用の部品
import { h } from './common.js';
import { s, T, R, A, L, frame, pc, server, cloud } from './netfig.js';

const doc = (x, y, w, hh, label, cls = 'nf-box', tcls = 'nf-t mono') => [R(x, y, w, hh, cls, 4), T(x + w / 2, y + hh / 2 + 4, label, tcls)];

export const INFRA_FIGURES = {
  // Linux の起動の流れ
  boot() {
    const steps = [
      ['電源', 'UEFI / BIOS', 'ハードの初期化'],
      ['ブートローダ', 'GRUB', 'カーネルを選ぶ'],
      ['カーネル', 'Linux', 'ハードを使えるように'],
      ['init', 'systemd (PID 1)', '最初のプロセス'],
      ['ターゲット', 'multi-user.target', 'サービス群を起動'],
    ];
    const kids = [];
    const w = 128;
    steps.forEach(([a, b, c], i) => {
      const x = 12 + i * (w + 8);
      kids.push(R(x, 36, w, 92, i === 3 ? 'nf-box l-app' : 'nf-box l-net', 6), T(x + w / 2, 60, a, 'nf-t strong'), T(x + w / 2, 82, b, 'nf-t mono small'), T(x + w / 2, 104, c, 'nf-t small'));
      if (i < steps.length - 1) kids.push(A(`M${x + w - 2} 82 h10`, ''));
    });
    kids.push(T(360, 152, 'systemd が「どのサービスを・どの順で」起動するかを管理する。起動が遅いときは systemd-analyze blame', 'nf-t small'));
    return frame(720, 164, 'Linux の起動の流れ', ...kids);
  },

  // systemd：ユニットと状態・操作
  systemd() {
    const kids = [T(200, 22, 'ユニットの状態', 'nf-t head'), T(540, 22, 'よく使う操作', 'nf-t head'),
      ...doc(60, 50, 110, 40, 'inactive', 'nf-box'), ...doc(250, 50, 110, 40, 'active', 'nf-box l-net'),
      A('M172 70 H246', ''), T(209, 60, 'start', 'nf-t small strong acc'),
      A('M248 84 Q 209 110 172 84', 'back'), T(209, 110, 'stop', 'nf-t small'),
      ...doc(150, 140, 120, 40, 'failed', 'nf-box fw'), A('M305 92 L250 138', 'back'), T(300, 128, '異常終了', 'nf-t small warn'),
      T(170, 206, 'enabled なら、再起動後も自動で起動する（起動時の有効化は start とは別）', 'nf-t small'),
      R(390, 44, 316, 168, 'nf-box', 6),
      ...[['systemctl status svc', '状態と直近のログ'], ['start / stop / restart svc', '起動 / 停止 / 再起動'], ['enable --now svc', '自動起動＋今も起動'], ['disable svc', '自動起動を無効に'], ['list-units --failed', '失敗したサービス'], ['journalctl -u svc -f', 'そのログを追う'], ['daemon-reload', 'ユニット編集の後'], ['（systemctl を頭に付けて使う）', '']].map(([a, b], i) => [T(404, 68 + i * 19, a, 'nf-t mono tiny', 'start'), T(690, 68 + i * 19, b, 'nf-t small', 'end')]),
    ];
    return frame(720, 224, 'systemd：サービスの状態と操作', ...kids);
  },

  // ディスクとファイルシステムの階層
  storage() {
    const rows = [
      ['物理ディスク', '/dev/sda（lsblk で確認）', 'l-link'],
      ['パーティション', '/dev/sda1, sda2（fdisk / parted）', 'l-tr'],
      ['（LVM）', '物理 → ボリュームグループ → 論理ボリューム（柔軟に広げられる）', 'l-net'],
      ['ファイルシステム', 'ext4 / xfs（mkfs で作成）', 'l-app'],
      ['マウントポイント', '/ や /data（mount・/etc/fstab）', 'l-data'],
    ];
    const kids = [T(360, 20, '下（物理）から上（使う場所）へ、層になっている', 'nf-t head')];
    rows.forEach(([a, b, cls], i) => {
      const y = 34 + i * 38, w = 560 - i * 40, x = 360 - w / 2;
      kids.push(R(x, y, w, 30, `nf-box ${cls}`, 4), T(x + 14, y + 20, a, 'nf-t small strong', 'start'), T(x + w - 14, y + 20, b, 'nf-t small', 'end'));
    });
    kids.push(T(360, 242, '容量不足は df -h（空き）と du -sh *（何が大きいか）。消しても空かないなら lsof +L1（削除済みで開いたまま）', 'nf-t small'));
    return frame(720, 254, 'ディスクとファイルシステムの階層', ...kids);
  },

  // 宣言的な運用（あるべき状態に寄せ続ける）
  declarative() {
    const kids = [
      ...doc(40, 60, 190, 60, '', 'nf-box l-net'), T(135, 84, 'あるべき状態', 'nf-t strong'), T(135, 104, '（宣言：設定ファイル）', 'nf-t small'),
      ...doc(490, 60, 190, 60, '', 'nf-box l-app'), T(585, 84, '今の状態', 'nf-t strong'), T(585, 104, '（実際のサーバー）', 'nf-t small'),
      R(280, 48, 160, 84, 'nf-box shield', 8), T(360, 78, '比べて', 'nf-t strong'), T(360, 98, '差を埋める', 'nf-t strong'), T(360, 118, '（自動で収束）', 'nf-t small'),
      A('M230 84 H276', ''), A('M444 104 Q 360 160 276 104', 'back'), T(360, 170, '違っていたら直す（くり返す）', 'nf-t small'),
      T(360, 210, '「手で 1 つずつ変える」より「あるべき姿を書いて、それに寄せる」。Kubernetes・Terraform・Ansible の考え方', 'nf-t small acc'),
      T(360, 230, '同じ設定を何度適用しても同じ結果になる（べき等）ので、再現・やり直しがしやすい', 'nf-t small')];
    return frame(720, 244, '宣言的な運用（あるべき状態に寄せる）', ...kids);
  },

  // Kubernetes の主な部品
  k8s() {
    const kids = [T(360, 20, 'Deployment が「Pod を 3 つ」を保ち、Service が入口になる', 'nf-t head'),
      ...doc(40, 44, 150, 40, 'Deployment', 'nf-box l-net'), T(115, 100, '台数・版を宣言', 'nf-t small'),
      A('M190 64 H236', ''), ...doc(240, 44, 140, 40, 'ReplicaSet', 'nf-box l-tr'), T(310, 100, '台数を保つ', 'nf-t small'),
      ...[0, 1, 2].map((i) => doc(430 + i * 92, 44, 80, 40, 'Pod', 'nf-box l-app')).flat(),
      A('M380 64 H426', ''),
      R(20, 150, 680, 92, 'nf-box', 8), T(360, 172, 'ノード（実際のサーバー）2 台以上', 'nf-t strong'),
      ...[0, 1, 2].map((i) => doc(70 + i * 110, 190, 90, 36, 'Pod', 'nf-box l-app')).flat(),
      ...doc(470, 190, 180, 36, 'Service（入口・名前）', 'nf-box l-net'),
      A('M560 150 V186', 'back'), T(360, 258, 'Pod は使い捨て（壊れたら作り直される）。だから入口は IP でなく Service の名前で指す', 'nf-t small')];
    return frame(720, 270, 'Kubernetes の主な部品', ...kids);
  },

  // nginx の設定のコンテキスト（入れ子）
  nginxctx() {
    // leaf=true の箱は中に別の箱を持たないので、ヒントを名前の下に。親の箱はヒントを右上に置く
    const boxes = [
      [20, 20, 680, 256, 'main', 'worker_processes auto;  user www-data;', 'nf-box', false],
      [40, 58, 300, 54, 'events', 'worker_connections 1024;', 'nf-box l-link', true],
      [40, 122, 640, 146, 'http', 'gzip on;  log_format …  include mime.types;', 'nf-box l-net', false],
      [60, 160, 600, 100, 'server', 'listen 443 ssl;  server_name example.jp;', 'nf-box l-app', false],
      [80, 206, 560, 46, 'location /', 'root /var/www;  または proxy_pass …', 'nf-box l-tr', true],
    ];
    const kids = [];
    boxes.forEach(([x, y, w, hh, name, hint, cls, leaf]) => {
      kids.push(R(x, y, w, hh, cls, 5), T(x + 12, y + 18, name, 'nf-t strong', 'start'),
        leaf ? T(x + 12, y + 38, hint, 'nf-t mono tiny', 'start') : T(x + w - 12, y + 18, hint, 'nf-t mono tiny', 'end'));
    });
    return frame(720, 288, 'nginx の設定は入れ子（コンテキスト）', ...kids);
  },

  // nginx のリクエストの流れ（リバースプロキシ・負荷分散）
  nginxflow() {
    const kids = [...pc(60, 90, '利用者'),
      R(180, 50, 220, 120, 'nf-box l-net', 8), T(290, 72, 'nginx', 'nf-t strong'),
      T(196, 96, '① listen / server_name', 'nf-t small', 'start'), T(210, 114, 'でサイトを選ぶ', 'nf-t small', 'start'),
      T(196, 138, '② location でパスを選ぶ', 'nf-t small', 'start'), T(210, 156, '→ 静的配信 or proxy_pass', 'nf-t small', 'start'),
      A('M86 90 H176', ''),
      R(480, 30, 220, 160, 'nf-zone', 8), T(590, 52, 'upstream（振り分け先）', 'nf-t strong'),
      ...server(530, 100, 'app 1'), ...server(650, 100, 'app 2'), ...server(590, 155, 'app 3'),
      A('M400 100 L476 100', ''), T(440, 90, 'proxy_pass', 'nf-t small acc'),
      T(360, 236, '静的ファイルは nginx が直接返し、アプリへの処理は後ろのサーバーへ渡す（リバースプロキシ）', 'nf-t small'),
      T(360, 256, '複数のサーバーに振り分けて負荷分散。応答しないサーバーは自動で外す', 'nf-t small')];
    return frame(720, 268, 'nginx のリクエストの流れ', ...kids);
  },
};

// ---------- 練習用の部品 ----------
const DOW = ['日', '月', '火', '水', '木', '金', '土'];
function cronField(v, min, max, names) {
  if (v === '*') return '毎';
  const out = [];
  for (const part of v.split(',')) {
    let m;
    if ((m = /^(\*|\d+(?:-\d+)?)\/(\d+)$/.exec(part))) {
      const step = +m[2];
      const [lo, hi] = m[1] === '*' ? [min, max] : m[1].includes('-') ? m[1].split('-').map(Number) : [+m[1], max];
      if (lo < min || hi > max || +m[2] < 1) return null;
      out.push(`${lo}〜${hi} を ${step} ごと`);
    } else if ((m = /^(\d+)-(\d+)$/.exec(part))) {
      if (+m[1] < min || +m[2] > max || +m[1] > +m[2]) return null;
      out.push(names ? `${names[+m[1]]}〜${names[+m[2]]}` : `${m[1]}〜${m[2]}`);
    } else if (/^\d+$/.test(part)) {
      if (+part < min || +part > max) return null;
      out.push(names ? names[+part] : part);
    } else return null;
  }
  return out.join('・');
}

export const INFRA_WIDGETS = {
  cron() {
    const PRESETS = [['0 3 * * *', '毎日 3:00'], ['*/5 * * * *', '5 分ごと'], ['30 8 * * 1-5', '平日 8:30'], ['0 0 1 * *', '毎月 1 日'], ['0 */6 * * *', '6 時間ごと']];
    const input = h('input', { value: '30 8 * * 1-5', 'aria-label': 'cron 式', spellcheck: 'false' });
    const cmd = h('input', { value: '/usr/local/bin/backup.sh', 'aria-label': '実行するコマンド', spellcheck: 'false' });
    const out = h('div', { class: 'nf-calc-out' });
    const chips = h('div', { class: 'nf-calc-row' }, ...PRESETS.map(([v, t]) => h('button', { type: 'button', class: 'ghost small', onclick: () => { input.value = v; run(); } }, t)));
    function run() {
      const f = input.value.trim().split(/\s+/);
      if (f.length !== 5) return out.replaceChildren(h('p', { class: 'hint' }, '「分 時 日 月 曜日」の 5 つで入れてください（例：30 8 * * 1-5）'));
      const specs = [['分', 0, 59, null], ['時', 0, 23, null], ['日', 1, 31, null], ['月', 1, 12, null], ['曜日', 0, 7, DOW]];
      const parsed = f.map((v, i) => cronField(v, specs[i][1], specs[i][2], specs[i][3]));
      if (parsed.some((x) => x === null)) return out.replaceChildren(h('p', { class: 'nf-danger' }, '読めない値、または範囲外があります'));
      const [mi, hr, dom, mon, dow] = parsed;
      const lab = (u, v, always) => (v === '毎' ? (always ? `毎${u}` : null) : `${u} ${v}`);
      const when = [lab('月', mon), lab('日', dom), lab('曜', dow), lab('時', hr, true), lab('分', mi, true)].filter(Boolean).join('・');
      out.replaceChildren(
        h('table', { class: 'mn-table' }, h('tbody', {}, ...[['分', mi], ['時', hr], ['日', dom], ['月', mon], ['曜日', dow]].map(([a, v]) => h('tr', {}, h('th', {}, a), h('td', {}, v))))),
        h('p', {}, h('b', { class: 'nf-ok' }, 'いつ：'), when),
        h('p', { class: 'hint' }, 'crontab の行：'), h('div', {}, h('code', { class: 'nf-calc-big' }, `${input.value.trim()}  ${cmd.value.trim()}`)),
        h('p', { class: 'hint' }, 'crontab -e で編集、crontab -l で確認。環境変数や PATH は cron では最小限なので、フルパスで書く。'));
    }
    input.addEventListener('input', run);
    cmd.addEventListener('input', run);
    run();
    return h('div', { class: 'nf-calc' }, h('div', { class: 'nf-calc-title' }, 'TRY：cron 式'), h('p', { class: 'hint' }, '「分 時 日 月 曜日」を変えて、いつ実行されるかを確かめましょう。'), input, h('div', { class: 'nf-calc-row' }, h('span', {}, 'コマンド'), cmd), chips, out);
  },

  nginxloc() {
    // 簡易版：= 完全一致 → ^~ 前方一致（最長）→ ~ 正規表現（先着）→ 前方一致（最長）
    const LOCS = [['=', '/'], ['^~', '/static/'], ['~', '\\.php$'], ['', '/api/'], ['', '/']];
    const input = h('input', { value: '/static/app.js', 'aria-label': 'リクエストのパス', spellcheck: 'false' });
    const out = h('div', { class: 'nf-calc-out' });
    const PATHS = ['/', '/static/app.js', '/api/users', '/index.php', '/about'];
    const chips = h('div', { class: 'nf-calc-row' }, ...PATHS.map((p) => h('button', { type: 'button', class: 'ghost small', onclick: () => { input.value = p; run(); } }, p)));
    function run() {
      const path = input.value.trim();
      // 1. 完全一致
      let hit = null, reason = '';
      const exact = LOCS.find(([m, p]) => m === '=' && p === path);
      if (exact) { hit = exact; reason = '完全一致（= が最優先）'; }
      if (!hit) {
        // 2. ^~ 前方一致のうち最長
        const pref2 = LOCS.filter(([m, p]) => m === '^~' && path.startsWith(p)).sort((a, b) => b[1].length - a[1].length)[0];
        if (pref2) { hit = pref2; reason = '^~ 前方一致（正規表現より優先）'; }
      }
      if (!hit) {
        // 3. 正規表現 ~（定義順の先着）
        const re = LOCS.find(([m, p]) => m === '~' && new RegExp(p).test(path));
        if (re) { hit = re; reason = '~ 正規表現（定義順で先着）'; }
      }
      if (!hit) {
        const pref = LOCS.filter(([m, p]) => m === '' && path.startsWith(p)).sort((a, b) => b[1].length - a[1].length)[0];
        if (pref) { hit = pref; reason = '前方一致（最長のもの）'; }
      }
      out.replaceChildren(
        h('table', { class: 'mn-table' }, h('tbody', {}, ...LOCS.map(([m, p]) => h('tr', { class: hit && hit[0] === m && hit[1] === p ? 'nf-hit' : '' }, h('th', {}, h('code', {}, `location ${m ? m + ' ' : ''}${p}`)), h('td', {}, hit && hit[0] === m && hit[1] === p ? h('b', { class: 'nf-ok' }, '← これが使われる') : ''))))),
        h('p', {}, hit ? [h('b', {}, '一致：'), reason] : h('b', { class: 'nf-danger' }, 'どれにも一致しません')));
    }
    input.addEventListener('input', run);
    run();
    return h('div', { class: 'nf-calc' }, h('div', { class: 'nf-calc-title' }, 'TRY：nginx の location の優先順位'), h('p', { class: 'hint' }, 'リクエストのパスを変えて、どの location が使われるか確かめましょう（簡易版：= → ^~ → 正規表現 → 前方一致の順）。'), input, chips, out);
  },
};
