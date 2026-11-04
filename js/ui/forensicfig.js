// 学ぶ：フォレンジックとサーバーの守りのテキストの図（すべて SVG のオリジナル）と、練習用の部品
import { h } from './common.js';
import { s, T, R, A, L, frame, pc, server } from './netfig.js';

export const DFIR_FIGURES = {
  // 揮発性の順序
  volatile() {
    const rows = [
      ['CPU のレジスタ・キャッシュ', 'ナノ秒で消える', 'l-app'],
      ['メモリ（プロセス・通信・鍵）', '電源を切ると消える', 'l-app'],
      ['ネットワークの状態', '接続・ARP・ルーティング表', 'l-tr'],
      ['実行中のプロセス・ログイン中の人', '時間とともに変わる', 'l-tr'],
      ['ディスク（一時ファイル・ログ）', '上書きされていく', 'l-net'],
      ['リモートのログ・バックアップ', '比較的長く残る', 'l-link'],
      ['紙の記録・保管された媒体', 'ほぼ変わらない', 'l-data'],
    ];
    const kids = [T(360, 20, '消えやすいものから先に集める（揮発性の順序）', 'nf-t head')];
    rows.forEach(([a, b, cls], i) => {
      const w = 260 + i * 60, x = 360 - w / 2, y = 32 + i * 34;
      kids.push(R(x, y, w, 28, `nf-box ${cls}`, 4), T(360, y + 19, `${a}　—　${b}`, 'nf-t small strong'));
    });
    kids.push(A('M40 40 V264', 'warn'), T(40, 282, '先に', 'nf-t small warn'), A('M680 264 V40', 'dim'), T(680, 282, '後で', 'nf-t small'));
    return frame(720, 294, '揮発性の順序', ...kids);
  },

  // 証拠の保全の流れ
  preserve() {
    const steps = [
      ['記録', ['日時・状態を', '写真とメモに']],
      ['揮発性の情報', ['メモリ・接続を', '取る（必要なら）']],
      ['複製', ['書き込み防止で', '丸ごとコピー']],
      ['ハッシュ', ['元と複製の', 'SHA-256 を記録']],
      ['保管', ['元は封印', '受け渡しを記録']],
      ['解析', ['複製の複製で', '作業する']],
    ];
    const kids = [];
    const w = 110;
    steps.forEach(([a, b], i) => {
      const x = 12 + i * (w + 8);
      kids.push(R(x, 26, w, 100, i === 3 ? 'nf-box l-net' : 'nf-box l-app', 6), s('circle', { cx: x + w / 2, cy: 46, r: 12, class: 'nf-step' }), T(x + w / 2, 51, String(i + 1), 'nf-t step'),
        T(x + w / 2, 80, a, 'nf-t strong'), ...b.map((t, j) => T(x + w / 2, 100 + j * 14, t, 'nf-t small')));
      if (i < steps.length - 1) kids.push(A(`M${x + w} 76 h8`, 'dim'));
    });
    kids.push(R(60, 146, 600, 40, 'nf-box shield', 6), T(360, 171, '証拠の受け渡しの記録（Chain of Custody）：いつ・誰から誰へ・何を・なぜ', 'nf-t small strong acc'),
      T(360, 210, '「元の証拠には触らない」「やったことはすべて記録する」──後から第三者が同じ結果を確かめられるように', 'nf-t small'));
    return frame(720, 222, '証拠の保全の流れ', ...kids);
  },

  // タイムスタンプ（MACB）
  timeline() {
    const kids = [L(40, 120, 690, 120, 'nf-line'), T(365, 20, '1 つのファイルにも複数の時刻がある（NTFS の例）', 'nf-t head')];
    const ev = [
      [80, '作成（B: Birth）', '10:02', 'ダウンロード'],
      [230, '更新（M: Modified）', '10:02', '中身を書いた'],
      [400, 'アクセス（A: Accessed）', '10:05', '開いた ※'],
      [560, 'メタデータ変更（C）', '10:07', '名前・権限の変更'],
    ];
    ev.forEach(([x, a, t, b], i) => {
      kids.push(s('circle', { cx: x + 40, cy: 120, r: 8, class: 'nf-step' }), R(x - 20, i % 2 ? 140 : 40, 160, 56, 'nf-box l-app', 5),
        T(x + 60, (i % 2 ? 140 : 40) + 22, a, 'nf-t small strong'), T(x + 60, (i % 2 ? 140 : 40) + 42, `${t}　${b}`, 'nf-t small'),
        L(x + 40, i % 2 ? 128 : 96, x + 40, i % 2 ? 140 : 112, 'nf-line'));
    });
    kids.push(T(365, 222, '時刻は UTC で記録されることが多い（日本時間＝UTC＋9）。機器の時計のずれ・タイムゾーンを必ず確認', 'nf-t small warn'),
      T(365, 242, '※ アクセスの時刻は省略設定で更新されないことも。時刻は書き換えもできる（タイムストンプ）ので、ほかの記録と突き合わせる', 'nf-t small'));
    return frame(730, 254, 'ファイルのタイムスタンプ', ...kids);
  },

  // インシデント対応のサイクル
  ir() {
    const st = [['準備', '体制・連絡先・ログ・訓練'], ['検知・分析', '本当に起きた？範囲は？'], ['封じ込め', '隔離・遮断・広がりを止める'], ['根絶', '原因を取り除く'], ['復旧', '安全を確かめて戻す'], ['教訓', '振り返り・再発防止']];
    const cx = 360, cy = 150, r = 112;
    const kids = [s('circle', { cx, cy, r, class: 'nf-life', fill: 'none' }), T(cx, cy - 4, 'インシデント', 'nf-t head'), T(cx, cy + 16, '対応のサイクル', 'nf-t head')];
    st.forEach(([a, b], i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / st.length, x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
      const bx = x - 80, by = y - 22;
      kids.push(R(bx, by, 160, 44, 'nf-box', 6), R(bx, by, 160, 44, i === 2 ? 'nf-box fw' : 'nf-box l-app', 6), T(x, by + 19, `${i + 1}. ${a}`, 'nf-t strong'), T(x, by + 36, b, 'nf-t small'));
    });
    kids.push(T(360, 296, '参考：NIST SP 800-61。慌てて電源を切る・再インストールする前に、記録と保全を', 'nf-t small'));
    return frame(720, 306, 'インシデント対応のサイクル', ...kids);
  },

  // Windows のログオンと関連するイベント
  logon() {
    const kids = [...pc(70, 80, '利用者・攻撃者'), ...server(360, 80, 'Windows'),
      A('M95 80 H336', 'acc'), T(215, 68, 'ログオン', 'nf-t small strong acc'),
      R(440, 24, 266, 112, 'nf-box l-app', 6), T(573, 44, 'セキュリティ ログ', 'nf-t strong'),
      T(452, 66, '4624 成功（種類 2 画面・3 ネットワーク・10 RDP）', 'nf-t small', 'start'),
      T(452, 86, '4625 失敗（大量なら総当たり）', 'nf-t small', 'start'),
      T(452, 106, '4672 管理者の権限でログオン', 'nf-t small', 'start'),
      T(452, 126, '4634 / 4647 ログオフ', 'nf-t small', 'start'),
      R(20, 160, 330, 104, 'nf-box l-tr', 6), T(185, 180, 'ログオンの後に起きたこと', 'nf-t strong'),
      T(32, 202, '4688 プロセスの作成（コマンドライン）', 'nf-t small', 'start'), T(32, 222, '4698 タスクの作成 / 7045 サービスの追加', 'nf-t small', 'start'), T(32, 242, '4720 ユーザー作成 / 4732 グループに追加', 'nf-t small', 'start'),
      R(370, 160, 336, 104, 'nf-box fw', 6), T(538, 180, '痕跡を消す動き', 'nf-t strong'),
      T(382, 202, '1102 セキュリティ ログの消去', 'nf-t small', 'start'), T(382, 222, '104 システム ログの消去', 'nf-t small', 'start'), T(382, 242, '→ 消去そのものが記録に残る', 'nf-t small warn', 'start'),
      T(360, 288, 'ログオン ID（Logon ID）で、同じログオンの中の出来事をつなげて追える', 'nf-t small acc')];
    return frame(720, 300, 'Windows のログオンと関連するイベント', ...kids);
  },

  // 持続化（再起動しても動き続ける仕組み）の点検場所
  persist() {
    const win = ['Run / RunOnce（レジストリ）', 'スタートアップのフォルダ', 'タスク スケジューラ', 'サービス', 'WMI のイベント購読'];
    const lin = ['cron / systemd のタイマー', 'systemd のサービス', '~/.bashrc・/etc/profile.d', '~/.ssh/authorized_keys', '新しいユーザー・sudoers'];
    const kids = [T(180, 22, 'Windows', 'nf-t head'), T(540, 22, 'Linux', 'nf-t head')];
    win.forEach((t, i) => kids.push(R(30, 34 + i * 36, 300, 30, 'nf-box l-app', 4), T(180, 54 + i * 36, t, 'nf-t small strong')));
    lin.forEach((t, i) => kids.push(R(390, 34 + i * 36, 300, 30, 'nf-box l-net', 4), T(540, 54 + i * 36, t, 'nf-t small strong')));
    kids.push(L(360, 30, 360, 214, 'nf-line dim'),
      T(360, 236, '侵入者は「再起動しても戻ってこられる仕掛け」を残す。調査ではここを必ず確認し、普段の状態と比べる', 'nf-t small'));
    return frame(720, 248, '持続化の点検場所', ...kids);
  },

  // サーバーの守りの層（攻撃面を減らす）
  harden() {
    const layers = [
      ['入口を減らす', '不要なサービス・ポートを止める／ファイアウォール'],
      ['入りにくくする', 'SSH の鍵認証・多要素認証・総当たりの遮断'],
      ['入っても広げない', '最小権限・sudo の制限・権限の点検'],
      ['穴をふさぐ', 'OS・ソフトの更新を自動で'],
      ['気づける', 'ログを外へ送る・変更と失敗を監視'],
    ];
    const kids = [];
    layers.forEach(([a, b], i) => {
      const y = 14 + i * 42, w = 690 - i * 40;
      kids.push(R(15 + i * 20, y, w, 36, i % 2 ? 'nf-box l-app' : 'nf-box l-net', 6), T(30 + i * 20, y + 23, a, 'nf-t strong', 'start'), T(170 + i * 20, y + 23, b, 'nf-t small', 'start'));
    });
    kids.push(T(360, 236, '強化（ハードニング）＝攻撃に使える面を減らし、入られても気づけて広がらないようにすること', 'nf-t small'));
    return frame(720, 248, 'サーバーの守りの層', ...kids);
  },
};

// ---------- 練習用の部品 ----------
const EVENTS = {
  4624: ['ログオンの成功', 'ログオンの種類（2：画面、3：ネットワーク、5：サービス、7：画面ロックの解除、10：リモートデスクトップ、11：キャッシュ）と、接続元の IP を確認。夜間の 10 や見慣れない接続元に注意'],
  4625: ['ログオンの失敗', '短時間に大量なら総当たり・パスワードの使い回し攻撃の疑い。失敗の理由（Status / Sub Status）と接続元を見る'],
  4634: ['ログオフ', '4624 と同じログオン ID で、いつまで使われていたかが分かる'],
  4647: ['利用者によるログオフ', '画面からのサインアウト'],
  4648: ['明示的な資格情報でのログオン', 'runas や別の資格情報での接続。横展開の調査で重要'],
  4672: ['特別な権限でのログオン', '管理者の権限を持つアカウントのログオン。誰が・いつかを確認'],
  4688: ['プロセスの作成', '実行されたプログラム（と、設定していればコマンドライン）。監査ポリシーの有効化が必要'],
  4697: ['サービスのインストール（セキュリティ ログ）', '7045 と合わせて、不審なサービスの追加を確認'],
  4698: ['タスクの作成', '持続化に使われやすい。タスクの中身（XML）を確認'],
  4719: ['監査ポリシーの変更', '記録を止めようとした可能性'],
  4720: ['ユーザー アカウントの作成', '見覚えのないアカウントがないか'],
  4722: ['アカウントの有効化', '無効だったアカウントが使われ始めていないか'],
  4724: ['パスワードのリセットの試み', '誰が誰のパスワードをリセットしたか'],
  4728: ['グローバル グループへの追加', 'Domain Admins などへの追加に注意'],
  4732: ['ローカル グループへの追加', 'Administrators への追加に注意'],
  4740: ['アカウントのロックアウト', '総当たりの結果のことが多い'],
  4768: ['Kerberos 認証チケット（TGT）の要求', 'ドメイン コントローラーの記録。認証の失敗の多発に注意'],
  4769: ['Kerberos サービス チケットの要求', '短時間に大量・暗号の種類が古い（RC4）ときは要注意'],
  4776: ['NTLM 認証の確認', 'NTLM の利用状況。失敗の多発に注意'],
  1102: ['セキュリティ ログの消去', '痕跡を消した可能性が高い。誰が消したかが記録される'],
  104: ['システム ログの消去（System）', '1102 と同様に重要'],
  7045: ['サービスのインストール（System）', '見慣れない名前・一時フォルダのパスのサービスに注意'],
  7036: ['サービスの開始・停止（System）', '守りの仕組み（ウイルス対策）が止められていないか'],
  4104: ['PowerShell のスクリプト ブロック（PowerShell/Operational）', '実行された PowerShell の中身。難読化（Base64・-enc）に注意'],
  1: ['Sysmon：プロセスの作成', '親プロセス・コマンドライン・ハッシュが分かる'],
  3: ['Sysmon：ネットワーク接続', 'どのプログラムがどこへつないだか'],
  11: ['Sysmon：ファイルの作成', '不審な場所（一時フォルダなど）への書き込み'],
  13: ['Sysmon：レジストリの値の設定', 'Run キーなどの持続化'],
  22: ['Sysmon：DNS の問い合わせ', 'どのプログラムがどの名前を引いたか'],
};

export const DFIR_WIDGETS = {
  eventid() {
    const input = h('input', { value: '4625', inputmode: 'numeric', 'aria-label': 'イベント ID' });
    const out = h('div', { class: 'nf-calc-out' });
    const chips = h('div', { class: 'nf-calc-row' }, ...[4624, 4625, 4672, 4688, 4720, 4732, 1102, 7045, 4104].map((n) => h('button', { type: 'button', class: 'ghost small', onclick: () => { input.value = n; run(); } }, String(n))));
    function run() {
      const e = EVENTS[input.value.trim()];
      out.replaceChildren(e ? h('table', { class: 'mn-table' }, h('tbody', {}, h('tr', {}, h('th', {}, '意味'), h('td', {}, h('b', {}, e[0]))), h('tr', {}, h('th', {}, '調べ方'), h('td', {}, e[1]))))
        : h('p', { class: 'hint' }, '一覧にない ID です（このテキストで扱う主なものだけを収録しています）。Sysmon は 1・3・11・13・22 を収録。'));
    }
    input.addEventListener('input', run);
    run();
    return h('div', { class: 'nf-calc' }, h('div', { class: 'nf-calc-title' }, 'TRY：イベント ID 早見'), h('p', { class: 'hint' }, 'Windows のイベント ID を入れると、意味と調べ方を表示します。'), input, chips, out);
  },

  sshdcheck() {
    const conf = h('textarea', { rows: 12, class: 'nf-calc-conf', spellcheck: 'false', 'aria-label': 'sshd_config' }, `# /etc/ssh/sshd_config の抜粋（自分のサーバーの設定を貼り付けて点検できます）
Port 22
PermitRootLogin yes
PasswordAuthentication yes
PubkeyAuthentication yes
PermitEmptyPasswords no
X11Forwarding yes
MaxAuthTries 6
#AllowUsers deploy`);
    const out = h('div', { class: 'nf-calc-out' });
    const RULES = [
      ['permitrootlogin', 'prohibit-password', (v) => v === 'no' || v === 'prohibit-password', 'root での直接ログインは no（鍵だけなら prohibit-password）。管理者は個人のアカウントから sudo で'],
      ['passwordauthentication', 'yes', (v) => v === 'no', 'パスワード認証は総当たりの的になる。鍵認証に切り替えて no に'],
      ['kbdinteractiveauthentication', 'yes', (v) => v === 'no', 'キーボード対話型の認証もパスワード入力に使われる。多要素認証で使わないなら no に'],
      ['permitemptypasswords', 'no', (v) => v === 'no', '空のパスワードでのログインは必ず no'],
      ['pubkeyauthentication', 'yes', (v) => v === 'yes', '鍵認証を使う'],
      ['maxauthtries', '6', (v) => +v <= 3, '1 回の接続で試せる回数。3 以下に'],
      ['x11forwarding', 'no', (v) => v === 'no', '画面の転送は使わないなら no'],
      ['allowusers', '', (v) => !!v, 'ログインできる利用者（または AllowGroups でグループ）を限定すると、作られた不審なアカウントでは入れない'],
    ];
    const run = () => {
      // sshd_config は多くの項目で「最初に書かれた値」が使われる
      const vals = {};
      for (const raw of conf.value.split('\n')) {
        const line = raw.replace(/#.*/, '').trim();
        if (!line || /^match\s/i.test(line)) continue;
        const [k, ...rest] = line.split(/\s+/);
        const key = k.toLowerCase();
        if (!(key in vals)) vals[key] = rest.join(' ').toLowerCase();
      }
      let bad = 0;
      const rows = RULES.map(([key, def, ok, why]) => {
        const v = vals[key] ?? def;
        const good = ok(v);
        if (!good) bad++;
        return h('tr', { class: good ? '' : 'nf-bad' }, h('th', {}, key), h('td', {}, h('code', {}, v || '（未設定）'), key in vals ? '' : h('span', { class: 'hint' }, '（初期値）')), h('td', {}, good ? h('b', { class: 'nf-ok' }, 'OK') : h('b', { class: 'nf-danger' }, '要見直し')), h('td', {}, why));
      });
      out.replaceChildren(h('p', {}, bad ? h('b', { class: 'nf-danger' }, `見直したい項目：${bad} 件`) : h('b', { class: 'nf-ok' }, '主な項目はすべて OK です')),
        h('div', { class: 'mn-table-wrap' }, h('table', { class: 'mn-table' }, h('tbody', {}, ...rows))),
        h('p', { class: 'hint' }, '注意：/etc/ssh/sshd_config.d/ の別ファイルや Match ブロックの設定は反映していません。実際に効いている値は sudo sshd -T で確認しましょう。'));
    };
    conf.addEventListener('input', run);
    run();
    return h('div', { class: 'nf-calc' }, h('div', { class: 'nf-calc-title' }, 'TRY：sshd_config の点検'), h('p', { class: 'hint' }, '設定を書き換えて、点検の結果がどう変わるか確かめましょう（ブラウザの中だけで処理し、どこにも送りません）。'), conf, out);
  },
};
