// 学ぶ：プロキシ構築のテキストの図（すべて SVG のオリジナル）と、練習用の部品（Squid のアクセス制御の確認）
import { h } from './common.js';
import { s, T, R, A, L, frame, pc, server, cloud } from './netfig.js';

export const PROXY_FIGURES = {
  // mitmproxy の仕組み：TLS を 2 本に分けて中身を見る
  mitm() {
    const kids = [...pc(60, 80, 'ブラウザ・アプリ'), T(60, 132, '（mitmproxy の CA を', 'nf-t small'), T(60, 148, '信頼させておく）', 'nf-t small'),
      R(250, 40, 220, 120, 'nf-box l-app', 8), T(360, 66, 'mitmproxy（:8080）', 'nf-t strong'), T(360, 88, '① 中身を見る・止める', 'nf-t small'), T(360, 106, '② 書き換える・送り直す', 'nf-t small'), T(360, 124, '③ 保存する（.mitm / HAR）', 'nf-t small'), T(360, 146, 'その場でサーバー証明書を作る', 'nf-t small acc'),
      ...server(650, 80, '本物のサーバー'),
      A('M86 80 H246', 'acc'), T(166, 70, 'TLS ①', 'nf-t small strong acc'), T(166, 98, '偽の証明書', 'nf-t small'),
      A('M474 80 H626', 'acc'), T(550, 70, 'TLS ②', 'nf-t small strong acc'), T(550, 98, '本物の証明書', 'nf-t small'),
      R(250, 182, 220, 40, 'nf-box shield', 6), T(360, 206, 'mitmweb なら http://127.0.0.1:8081 で見る', 'nf-t small strong'),
      T(360, 250, 'TLS を途中で 2 本に分けるので、端末が mitmproxy の CA を信頼していないと警告になる（正常な守りの働き）', 'nf-t small'),
      T(360, 270, '証明書を固定（ピンニング）しているアプリは、この方法では中身を見られない', 'nf-t small warn')];
    return frame(720, 282, 'mitmproxy の仕組み', ...kids);
  },

  // mitmproxy の動作モード
  modes() {
    const rows = [
      ['regular（標準）', '端末のプロキシ設定で mitmproxy を指定する', 'ブラウザ・curl・スマホの検証'],
      ['upstream', 'mitmproxy の先に、さらに会社のプロキシを通す', '社内ネットワークでの検証'],
      ['reverse', '特定のサーバーの前に置き、代わりに受ける', 'API サーバーの通信の観察'],
      ['transparent', '設定なしで経路上で受ける（ルーター・iptables が必要）', 'プロキシ設定ができない機器'],
      ['local', '手元の特定のアプリの通信だけを取り込む', 'プロキシ設定に従わないアプリ'],
      ['socks5 / wireguard', 'SOCKS5・WireGuard の VPN として受ける', 'スマホ全体の通信の検証'],
    ];
    const kids = [T(100, 22, 'モード', 'nf-t head'), T(350, 22, '仕組み', 'nf-t head'), T(610, 22, 'よく使う場面', 'nf-t head')];
    rows.forEach(([a, b, c], i) => {
      const y = 34 + i * 36;
      kids.push(R(14, y, 692, 30, i % 2 ? 'nf-box' : 'nf-box l-data', 4), T(24, y + 20, a, 'nf-t mono small strong', 'start'), T(170, y + 20, b, 'nf-t small', 'start'), T(530, y + 20, c, 'nf-t small acc', 'start'));
    });
    kids.push(T(360, 266, '指定の例：mitmweb --mode upstream:http://proxy.example.co.jp:3128', 'nf-t mono tiny'));
    return frame(720, 278, 'mitmproxy の動作モード', ...kids);
  },

  // Squid の構成（社内のフォワードプロキシ）
  squid() {
    const kids = [R(10, 30, 170, 210, 'nf-zone', 8), T(95, 52, '社内 LAN', 'nf-t strong'), ...pc(60, 110, '社員'), ...pc(130, 110, '社員'), ...pc(95, 190, '社員'),
      R(230, 40, 250, 190, 'nf-box l-app', 8), T(355, 64, 'Squid（:3128）', 'nf-t strong'),
      ...[['① ACL で許可・拒否', 'l-net'], ['② 認証（任意）', 'l-data'], ['③ キャッシュ', 'l-data'], ['④ ログ（access.log）', 'l-tr']].flatMap(([t, cls], i) => [R(250, 78 + i * 36, 210, 28, `nf-box ${cls}`, 4), T(355, 97 + i * 36, t, 'nf-t small strong')]),
      ...cloud(610, 130, 'インターネット'),
      A('M156 130 H226', 'acc'), A('M484 130 H546', 'acc'),
      T(360, 262, 'ブラウザには「プロキシ：squid.example.local:3128」を設定（手で・PAC ファイル・グループポリシー）', 'nf-t small'),
      T(360, 282, 'ファイアウォールで「Squid 以外からの外向き通信」を止めると、すり抜けを防げる', 'nf-t small acc')];
    return frame(720, 294, 'Squid の構成', ...kids);
  },

  // http_access の評価の順番
  acl() {
    const rules = [
      ['http_access deny !Safe_ports', '決まったポート以外は拒否'],
      ['http_access deny CONNECT !SSL_ports', 'HTTPS の 443 番以外への CONNECT は拒否'],
      ['http_access deny blocked_sites', '禁止したサイト'],
      ['http_access allow localnet worktime', '社内から・業務時間なら許可'],
      ['http_access deny all', 'それ以外はすべて拒否'],
    ];
    const kids = [T(360, 20, '上から順に調べ、最初に条件がすべて合った行で決まる（それ以降は見ない）', 'nf-t small strong')];
    rules.forEach(([a, b], i) => {
      const y = 34 + i * 40;
      kids.push(R(40, y, 360, 32, i === 3 ? 'nf-box l-net' : i === 4 ? 'nf-box fw' : 'nf-box', 4), T(52, y + 21, a, 'nf-t mono tiny', 'start'), T(420, y + 21, b, 'nf-t small', 'start'));
      if (i < 4) kids.push(A(`M220 ${y + 32} V${y + 40}`, 'dim'));
    });
    kids.push(T(360, 248, '1 行の中の条件は「かつ」（AND）。「または」にしたいときは行を分ける', 'nf-t small'),
      T(360, 266, '最後は必ず deny all で終える（書き忘れた通信を通さない）', 'nf-t small acc'));
    return frame(720, 278, 'http_access の評価の順番', ...kids);
  },

  // SSL Bump の判断
  sslbump() {
    const kids = [...pc(50, 90, '社員の PC'), T(50, 140, '（社内 CA を配布済み）', 'nf-t small'),
      R(170, 40, 200, 100, 'nf-box l-app', 8), T(270, 64, 'Squid（ssl-bump）', 'nf-t strong'), T(270, 88, 'peek：最初の挨拶（SNI）', 'nf-t small'), T(270, 104, 'を見て、行き先の名前で', 'nf-t small'), T(270, 120, '扱いを決める', 'nf-t small'),
      A('M76 90 H166', 'acc'),
      R(440, 20, 260, 52, 'nf-box l-net', 6), T(570, 42, 'splice（中を見ない）', 'nf-t strong'), T(570, 60, '銀行・医療・人事など', 'nf-t small'),
      R(440, 92, 260, 52, 'nf-box fw', 6), T(570, 114, 'bump（復号して検査）', 'nf-t strong'), T(570, 132, 'それ以外の業務サイト', 'nf-t small'),
      R(440, 164, 260, 52, 'nf-box', 6), T(570, 186, 'terminate（遮断）', 'nf-t strong'), T(570, 204, '禁止したサイト', 'nf-t small'),
      A('M374 80 L436 46'), A('M374 92 L436 118'), A('M374 104 L436 188'),
      T(360, 246, '復号する範囲・目的・保存する内容は、規程で決めて社員に周知する（プライバシーと労務の配慮）', 'nf-t small warn'),
      T(360, 266, '証明書を固定しているアプリ・一部の更新サービスは bump すると壊れる → splice の一覧に入れる', 'nf-t small')];
    return frame(720, 278, 'SSL Bump の判断', ...kids);
  },
};

// ---------- 練習用の部品：Squid の http_access の評価を確かめる ----------
const ip2n = (s) => s.split('.').reduce((a, b) => a * 256 + +b, 0);
function inCidr(ip, cidr) {
  const [base, bits = '32'] = cidr.split('/');
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(base) || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  const size = 2 ** (32 - +bits);
  return Math.floor(ip2n(ip) / size) === Math.floor(ip2n(base) / size);
}
function matchDomain(host, pat) {
  host = host.toLowerCase();
  pat = pat.toLowerCase();
  return pat.startsWith('.') ? host === pat.slice(1) || host.endsWith(pat) : host === pat;
}
const DEFAULT_CONF = `acl localnet src 10.0.0.0/8 192.168.0.0/16
acl blocked_sites dstdomain .example-game.com .example-video.net
acl admins src 10.0.10.0/24
acl social dstdomain .example-sns.com

http_access deny blocked_sites
http_access allow social admins
http_access deny social
http_access allow localnet
http_access deny all`;

export const PROXY_WIDGETS = {
  squidacl() {
    const conf = h('textarea', { rows: 10, class: 'nf-calc-conf', spellcheck: 'false', 'aria-label': 'squid.conf の抜粋' }, DEFAULT_CONF);
    const ip = h('input', { value: '10.0.20.15', 'aria-label': '利用者の IP' });
    const host = h('input', { value: 'www.example-sns.com', 'aria-label': '行き先のドメイン' });
    const out = h('div', { class: 'nf-calc-out' });
    const run = () => {
      const acls = {};
      const rules = [];
      const errs = [];
      conf.value.split('\n').forEach((raw, i) => {
        const line = raw.replace(/#.*/, '').trim();
        if (!line) return;
        const w = line.split(/\s+/);
        if (w[0] === 'acl' && w.length >= 4) {
          if (!['src', 'dstdomain'].includes(w[2])) return errs.push(`${i + 1} 行目：この練習では src と dstdomain だけ対応しています`);
          (acls[w[1]] ??= { type: w[2], vals: [] }).vals.push(...w.slice(3));
        } else if (w[0] === 'http_access' && ['allow', 'deny'].includes(w[1])) rules.push({ line: i + 1, act: w[1], conds: w.slice(2), text: line });
        else errs.push(`${i + 1} 行目：読めない行です`);
      });
      const test = (name) => {
        const neg = name.startsWith('!');
        const n = neg ? name.slice(1) : name;
        let r;
        if (n === 'all') r = true;
        else if (!acls[n]) return { ok: false, err: `acl「${n}」が定義されていません` };
        else r = acls[n].type === 'src' ? acls[n].vals.some((c) => inCidr(ip.value.trim(), c)) : acls[n].vals.some((d) => matchDomain(host.value.trim(), d));
        return { ok: neg ? !r : r };
      };
      const trace = [];
      let decided = null;
      for (const rule of rules) {
        const res = rule.conds.map(test);
        const e = res.find((x) => x.err);
        if (e) { errs.push(`${rule.line} 行目：${e.err}`); break; }
        const hit = res.every((x) => x.ok);
        trace.push(h('tr', { class: hit ? 'nf-hit' : '' }, h('td', {}, String(rule.line)), h('td', {}, h('code', {}, rule.text)), h('td', {}, hit ? '← ここで決定' : '条件が合わない')));
        if (hit) { decided = rule; break; }
      }
      out.replaceChildren(
        ...errs.map((e) => h('p', { class: 'nf-danger' }, e)),
        h('table', { class: 'mn-table' }, h('tbody', {}, ...trace)),
        h('p', {}, '結果：', decided ? h('b', { class: decided.act === 'allow' ? 'nf-ok' : 'nf-danger' }, decided.act === 'allow' ? '許可（allow）' : '拒否（deny）') : h('b', { class: 'nf-danger' }, 'どの行にも合わない（最後の行の逆の扱いになる。必ず deny all で終えましょう）')),
      );
    };
    [conf, ip, host].forEach((x) => x.addEventListener('input', run));
    run();
    return h('div', { class: 'nf-calc' }, h('div', { class: 'nf-calc-title' }, 'TRY：Squid のアクセス制御'),
      h('p', { class: 'hint' }, '設定と、利用者の IP・行き先を変えて、どの行で許可・拒否が決まるかを確かめましょう（練習用の簡易版：acl は src と dstdomain に対応）。'),
      conf, h('div', { class: 'nf-calc-row' }, h('span', {}, '利用者の IP'), ip, h('span', {}, '行き先'), host), out);
  },
};
