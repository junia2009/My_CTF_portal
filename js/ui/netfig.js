// 学ぶ：ネットワークのテキストの図（すべて SVG のオリジナル）と、練習用の部品（サブネット計算）
import { h } from './common.js';

const NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
}
const T = (x, y, str, cls = 'nf-t', anchor = 'middle') => s('text', { x, y, class: cls, 'text-anchor': anchor }, str);
const R = (x, y, w, hh, cls = 'nf-box', rx = 5) => s('rect', { x, y, width: w, height: hh, rx, class: cls });
const L = (x1, y1, x2, y2, cls = 'nf-line') => s('line', { x1, y1, x2, y2, class: cls });
const A = (d, cls = '') => s('path', { d, class: `nf-arrow ${cls}`, 'marker-end': `url(#nfHead${cls.includes('warn') ? 'W' : cls.includes('dim') ? 'D' : ''})` });
// 箱＋文字（2 行まで）
const boxT = (x, y, w, hh, l1, l2, cls = 'nf-box') => [R(x, y, w, hh, cls), T(x + w / 2, y + (l2 ? hh / 2 - 3 : hh / 2 + 5), l1, `nf-t strong${cls.includes('acc') ? ' acc' : ''}`), l2 ? T(x + w / 2, y + hh / 2 + 13, l2, 'nf-t small') : null];
const frame = (W, H, label, ...kids) => s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'netfig', role: 'img', 'aria-label': label },
  s('defs', {},
    ...[['nfHead', 'nf-head'], ['nfHeadW', 'nf-head warn'], ['nfHeadD', 'nf-head dim']].map(([id, cls]) =>
      s('marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, s('path', { d: 'M0 0 L10 5 L0 10 z', class: cls })))),
  ...kids);
// 小さな機器の絵
const pc = (cx, cy, label) => [R(cx - 20, cy - 18, 40, 28, 'nf-dev', 3), L(cx, cy + 10, cx, cy + 16, 'nf-dev-l'), L(cx - 12, cy + 17, cx + 12, cy + 17, 'nf-dev-l'), label ? T(cx, cy + 34, label, 'nf-t small') : null];
const server = (cx, cy, label) => [R(cx - 18, cy - 22, 36, 14, 'nf-dev', 2), R(cx - 18, cy - 6, 36, 14, 'nf-dev', 2), R(cx - 18, cy + 10, 36, 14, 'nf-dev', 2),
  ...[-15, 1, 17].map((dy) => s('circle', { cx: cx + 11, cy: cy + dy, r: 2, class: 'nf-led' })), label ? T(cx, cy + 40, label, 'nf-t small') : null];
const router = (cx, cy, label) => [s('ellipse', { cx, cy, rx: 26, ry: 13, class: 'nf-dev' }), A(`M${cx - 12} ${cy - 3} h22`), A(`M${cx + 12} ${cy + 4} h-22`), label ? T(cx, cy + 30, label, 'nf-t small') : null];
const cloud = (cx, cy, label) => [s('path', { d: `M${cx - 50} ${cy + 18} a18 18 0 0 1 4-35 a26 26 0 0 1 48-8 a20 20 0 0 1 36 12 a16 16 0 0 1 12 31 z`, class: 'nf-cloud' }), T(cx, cy + 6, label, 'nf-t strong')];

export const NET_FIGURES = {
  // OSI 参照モデルと TCP/IP モデル
  layers() {
    const rows = [
      ['7', 'アプリケーション層', 'HTTP・DNS・SMTP・SSH', 'アプリケーション層'],
      ['6', 'プレゼンテーション層', '文字コード・圧縮・暗号化', ''],
      ['5', 'セッション層', '通信の開始〜終了の管理', ''],
      ['4', 'トランスポート層', 'TCP・UDP（ポート番号）', 'トランスポート層'],
      ['3', 'ネットワーク層', 'IP・ICMP（IP アドレス）', 'インターネット層'],
      ['2', 'データリンク層', 'Ethernet・Wi-Fi（MAC アドレス）', 'ネットワーク'],
      ['1', '物理層', 'ケーブル・電波・光', 'インターフェース層'],
    ];
    const devs = ['', '', '', 'FW（ポートで判断）', 'ルーター（IP で中継）', 'スイッチ（MAC で中継）', 'ケーブル・ハブ'];
    const y0 = 40, rh = 40;
    const kids = [T(140, 24, 'OSI 参照モデル（7 層）', 'nf-t head'), T(440, 24, 'TCP/IP モデル（4 層）', 'nf-t head'), T(635, 24, '動く機器の例', 'nf-t head')];
    rows.forEach(([n, name, ex], i) => {
      const y = y0 + i * rh;
      kids.push(R(20, y, 260, rh - 6, i < 3 ? 'nf-box l-app' : i === 3 ? 'nf-box l-tr' : i === 4 ? 'nf-box l-net' : 'nf-box l-link'),
        T(40, y + 22, n, 'nf-t num'), T(60, y + 15, name, 'nf-t strong', 'start'), T(60, y + 29, ex, 'nf-t small', 'start'));
      if (devs[i]) kids.push(T(635, y + 22, devs[i], 'nf-t small'));
    });
    // TCP/IP 側：まとめた箱
    const groups = [[0, 3, 'アプリケーション層', 'l-app'], [3, 1, 'トランスポート層', 'l-tr'], [4, 1, 'インターネット層', 'l-net'], [5, 2, 'ネットワーク インターフェース層', 'l-link']];
    for (const [i, n, name, cls] of groups) {
      const y = y0 + i * rh;
      kids.push(R(340, y, 200, n * rh - 6, `nf-box ${cls}`), T(440, y + (n * rh - 6) / 2 + 5, name, 'nf-t strong'));
      kids.push(A(`M286 ${y + (n * rh - 6) / 2} H332`, 'dim'));
    }
    kids.push(T(360, 335, '上の層ほど「人やアプリに近い」、下の層ほど「電気や電波に近い」', 'nf-t small', 'middle'));
    return frame(720, 345, 'OSI 参照モデルと TCP/IP モデルの対応', ...kids);
  },

  // カプセル化：データにヘッダーが重なっていく
  encap() {
    const rows = [
      ['アプリ', [['データ（例：GET /index.html）', 250, 'd']]],
      ['TCP', [['TCP ヘッダー', 110, 'tr'], ['データ', 250, 'd']]],
      ['IP', [['IP ヘッダー', 100, 'net'], ['TCP', 110, 'tr'], ['データ', 250, 'd']]],
      ['Ethernet', [['Ethernet ヘッダー', 130, 'link'], ['IP', 100, 'net'], ['TCP', 110, 'tr'], ['データ', 250, 'd'], ['FCS', 50, 'link']]],
    ];
    const kids = [];
    rows.forEach(([name, parts], i) => {
      const y = 20 + i * 62;
      const total = parts.reduce((a, [, w]) => a + w, 0);
      let x = 712 - total;
      kids.push(T(14, y + 25, name, 'nf-t strong', 'start'));
      for (const [label, w, cls] of parts) {
        kids.push(R(x, y, w - 4, 38, `nf-box l-${cls === 'd' ? 'data' : cls}`, 3), T(x + (w - 4) / 2, y + 24, label, 'nf-t small strong'));
        x += w;
      }
      if (i) kids.push(A(`M${712 - 254 / 2 - 2} ${y - 22} V${y - 4}`, 'dim'));
    });
    kids.push(T(360, 272, '送る側は上から順にヘッダーを付け（カプセル化）、受け取る側は下から順に外していく', 'nf-t small'));
    kids.push(T(360, 290, '名前：アプリ＝データ／TCP＝セグメント／IP＝パケット／Ethernet＝フレーム', 'nf-t small'));
    return frame(720, 300, 'カプセル化の図', ...kids);
  },

  // TCP の 3 ウェイハンドシェイクと終了
  handshake() {
    const xc = 170, xs = 550;
    const kids = [...pc(xc, 34, ''), T(xc, 72, 'クライアント', 'nf-t strong'), ...server(xs, 36, ''), T(xs, 86, 'サーバー（:443 で待ち受け）', 'nf-t strong'),
      L(xc, 92, xc, 470, 'nf-life'), L(xs, 100, xs, 470, 'nf-life')];
    const msgs = [
      [120, 'SYN（seq=100）', '「つないでいい？」', 1, 'acc'],
      [160, 'SYN / ACK（seq=300, ack=101）', '「いいよ。そっちもいい？」', -1, 'acc'],
      [200, 'ACK（ack=301）', '「了解」→ 接続の確立', 1, 'acc'],
      [270, 'データ（HTTP リクエストなど）', '', 1, ''],
      [310, 'データ（応答）', '', -1, ''],
      [380, 'FIN', '「終わります」', 1, 'dim'],
      [415, 'ACK ＋ FIN', '', -1, 'dim'],
      [450, 'ACK', '── 接続を閉じる', 1, 'dim'],
    ];
    for (const [y, label, sub, dir, cls] of msgs) {
      kids.push(A(dir > 0 ? `M${xc + 4} ${y} L${xs - 6} ${y + 18}` : `M${xs - 4} ${y} L${xc + 6} ${y + 18}`, cls));
      kids.push(T((xc + xs) / 2, y + 2, label, `nf-t mono${cls === 'acc' ? ' acc' : ''}`));
      if (sub) kids.push(T(xs + 14, y + 16, sub, 'nf-t small', 'start'));
    }
    kids.push(T(60, 165, '① 〜 ③', 'nf-t num', 'middle'), T(60, 182, '3 ウェイ', 'nf-t small'), T(60, 196, 'ハンドシェイク', 'nf-t small'));
    return frame(720, 485, 'TCP の 3 ウェイハンドシェイクの図', ...kids);
  },

  // DNS の名前解決
  dns() {
    const kids = [...pc(70, 150, 'あなたの PC'), ...server(270, 150, 'キャッシュ DNS サーバー'), T(270, 205, '（社内・プロバイダー）', 'nf-t small'),
      ...server(560, 50, 'ルート（.）'), ...server(560, 165, '.jp の担当'), ...server(560, 280, 'example.jp の担当'), T(560, 335, '（権威 DNS サーバー）', 'nf-t small')];
    kids.push(A('M95 140 H244'), T(170, 132, '① www.example.jp は？', 'nf-t small acc'));
    kids.push(A('M296 135 L535 55', 'dim'), T(420, 80, '② .jp はどこ？', 'nf-t small'));
    kids.push(A('M296 150 L535 160', 'dim'), T(420, 148, '③ example.jp はどこ？', 'nf-t small'));
    kids.push(A('M296 165 L535 275', 'dim'), T(420, 240, '④ www の IP は？ → 93.184.x.x', 'nf-t small'));
    kids.push(A('M244 165 H95', 'acc'), T(170, 182, '⑤ 93.184.x.x だよ', 'nf-t small acc'));
    kids.push(T(360, 368, '答えはしばらく覚えておく（キャッシュ・TTL の間）。2 回目からは ② 〜 ④ を省略できる', 'nf-t small'));
    return frame(720, 380, 'DNS の名前解決の流れ', ...kids);
  },

  // IP アドレスとサブネットマスク
  subnet() {
    const ip = [192, 168, 10, 37], prefix = 24;
    const kids = [T(20, 26, 'IP アドレス 192.168.10.37 / 24（サブネットマスク 255.255.255.0）', 'nf-t strong', 'start')];
    const bw = 20, x0 = 20, y0 = 50;
    ip.forEach((oct, i) => {
      const bits = oct.toString(2).padStart(8, '0');
      [...bits].forEach((b, j) => {
        const k = i * 8 + j, x = x0 + k * bw + i * 8;
        kids.push(R(x, y0, bw - 2, 30, k < prefix ? 'nf-box l-net' : 'nf-box l-data', 2), T(x + (bw - 2) / 2, y0 + 20, b, 'nf-t mono'));
      });
      kids.push(T(x0 + i * (8 * bw + 8) + 4 * bw, y0 + 50, String(oct), 'nf-t strong'));
    });
    const split = x0 + prefix * bw + 3 * 8 - 3;
    kids.push(L(split, y0 - 10, split, y0 + 64, 'nf-line warn'),
      T(x0 + 4, y0 + 82, 'ネットワーク部（24 ビット）：どのネットワークか', 'nf-t small acc', 'start'),
      T(708, y0 + 82, 'ホスト部（8 ビット）：その中のどの機器か', 'nf-t small', 'end'));
    const rows = [['ネットワークアドレス', '192.168.10.0', 'ホスト部が全部 0（ネットワークそのものを表す）'], ['使える範囲', '192.168.10.1 〜 192.168.10.254', '機器に割り当てられる（254 台）'], ['ブロードキャスト', '192.168.10.255', 'ホスト部が全部 1（全員あて）']];
    rows.forEach(([a, b, c], i) => {
      const y = y0 + 110 + i * 30;
      kids.push(T(30, y, a, 'nf-t strong', 'start'), T(200, y, b, 'nf-t mono acc', 'start'), T(440, y, c, 'nf-t small', 'start'));
    });
    return frame(720, 260, 'IP アドレスのネットワーク部とホスト部', ...kids);
  },

  // NAT（ルーターがアドレスを付け替える）
  nat() {
    const kids = [R(10, 30, 270, 220, 'nf-zone', 8), T(145, 52, '社内・家庭の LAN（プライベート）', 'nf-t strong'),
      ...pc(70, 110, '192.168.1.10'), ...pc(70, 200, '192.168.1.11'), ...router(330, 150, 'ルーター（NAT）'), T(330, 196, '外側：203.0.113.5', 'nf-t mono small'),
      ...cloud(600, 150, 'インターネット')];
    kids.push(A('M95 110 L300 145'), A('M95 200 L300 155'), A('M360 150 H520'));
    kids.push(R(150, 270, 420, 74, 'nf-box', 4), T(360, 290, 'NAT の対応表（ルーターが覚えておく）', 'nf-t strong'),
      T(360, 312, '192.168.1.10:51000 ⇄ 203.0.113.5:40001', 'nf-t mono'), T(360, 332, '192.168.1.11:51000 ⇄ 203.0.113.5:40002', 'nf-t mono'));
    kids.push(T(600, 210, '相手からは 203.0.113.5 しか見えない', 'nf-t small'));
    return frame(720, 355, 'NAT の図', ...kids);
  },

  // 会社のネットワーク：DMZ とファイアウォール
  dmz() {
    const kids = [...cloud(80, 150, 'インターネット'),
      R(180, 110, 40, 80, 'nf-box fw', 3), T(200, 210, 'FW', 'nf-t strong'),
      R(250, 30, 190, 240, 'nf-zone dmz', 8), T(345, 52, 'DMZ（公開する場所）', 'nf-t strong'), ...server(300, 110, 'Web'), ...server(390, 110, 'メール'), ...server(345, 200, 'DNS・プロキシ'),
      R(470, 110, 40, 80, 'nf-box fw', 3), T(490, 210, 'FW', 'nf-t strong'),
      R(540, 30, 170, 240, 'nf-zone', 8), T(625, 52, '社内 LAN', 'nf-t strong'), ...pc(590, 110, '社員の PC'), ...server(660, 110, 'ファイル'), ...server(625, 200, 'DB・AD')];
    kids.push(A('M140 150 H176'), A('M224 150 H246'), A('M444 150 H466', 'dim'), A('M514 150 H536', 'dim'));
    kids.push(T(360, 296, '外 → DMZ：Web(443)・メール(25) など必要なものだけ許可', 'nf-t small acc'),
      T(360, 316, '外 → 社内：原則すべて拒否／DMZ → 社内：必要な通信だけ／社内 → 外：プロキシ経由', 'nf-t small'));
    return frame(720, 330, 'DMZ とファイアウォールの配置', ...kids);
  },

  // TLS（HTTPS）の流れ
  tls() {
    const xc = 150, xs = 570;
    const kids = [...pc(xc, 34, ''), T(xc, 72, 'ブラウザ', 'nf-t strong'), ...server(xs, 36, ''), T(xs, 86, 'Web サーバー', 'nf-t strong'),
      L(xc, 92, xc, 400, 'nf-life'), L(xs, 100, xs, 400, 'nf-life')];
    const msgs = [
      [115, 'TCP の 3 ウェイハンドシェイク', 1, 'dim'],
      [160, 'ClientHello（使える暗号の一覧・接続先の名前 SNI）', 1, 'acc'],
      [205, 'ServerHello ＋ 証明書 ＋ 鍵交換の材料', -1, 'acc'],
      [250, '鍵交換の材料 ＋ Finished', 1, 'acc'],
      [310, '暗号化された HTTP（中身は見えない）', 1, 'warn'],
      [350, '暗号化された応答', -1, 'warn'],
    ];
    for (const [y, label, dir, cls] of msgs) {
      kids.push(A(dir > 0 ? `M${xc + 4} ${y} L${xs - 6} ${y + 16}` : `M${xs - 4} ${y} L${xc + 6} ${y + 16}`, cls), T((xc + xs) / 2, y + 2, label, `nf-t small strong${cls === 'acc' ? ' acc' : ''}`));
    }
    kids.push(R(xs + 20, 190, 116, 54, 'nf-box', 4), T(xs + 78, 210, '証明書の確認', 'nf-t small strong'), T(xs + 78, 228, '名前・期限・発行元', 'nf-t small'));
    kids.push(T(360, 290, '↑ ここまでで「本物のサーバーか」の確認と、共通鍵の共有が終わる', 'nf-t small'));
    kids.push(T(360, 392, 'pcap で見えるのは、宛先の IP・SNI（名前）・証明書など。中身は鍵が無いと読めない', 'nf-t small'));
    return frame(720, 405, 'TLS の流れ', ...kids);
  },

  // ARP と、その偽装（中間者）
  arp() {
    const kids = [T(180, 24, '普段の ARP', 'nf-t head'), T(540, 24, 'ARP の偽装（中間者）', 'nf-t head'),
      ...pc(70, 90, 'PC-A 10.0.0.5'), ...router(290, 90, 'ゲートウェイ 10.0.0.1'),
      A('M95 80 L262 80'), T(180, 70, '① 10.0.0.1 の MAC は？（全員に）', 'nf-t small'),
      A('M262 102 L95 102', 'acc'), T(180, 124, '② 私です：aa:aa…', 'nf-t small acc'),
      L(360, 30, 360, 300, 'nf-line dim'),
      ...pc(430, 90, 'PC-A'), ...router(650, 90, 'ゲートウェイ'), ...pc(540, 220, '攻撃者'),
      A('M520 200 L450 112', 'warn'), T(470, 150, '「ゲートウェイは私」', 'nf-t small warn', 'end'),
      A('M560 200 L626 112', 'warn'), T(612, 150, '「PC-A は私」', 'nf-t small warn', 'start'),
      T(540, 270, '通信が攻撃者を経由してしまう', 'nf-t small'),
      T(180, 200, 'ARP：IP アドレスから MAC アドレスを調べる', 'nf-t small'), T(180, 220, '（同じ LAN の中だけで使う）', 'nf-t small'),
      T(360, 318, '対策：スイッチの DAI（ARP の検査）・静的な ARP・暗号化（TLS）で中身を守る', 'nf-t small acc')];
    return frame(720, 330, 'ARP と ARP の偽装', ...kids);
  },

  // VPN（トンネル）
  vpn() {
    const kids = [R(10, 40, 180, 170, 'nf-zone', 8), T(100, 62, '自宅・外出先', 'nf-t strong'), ...pc(100, 130, 'ノート PC'),
      ...cloud(360, 125, 'インターネット'),
      R(530, 40, 180, 170, 'nf-zone', 8), T(620, 62, '会社', 'nf-t strong'), ...router(580, 125, 'VPN 装置'), ...server(670, 125, '社内サーバー'),
      s('path', { d: 'M125 115 C250 70, 470 70, 554 115 L554 135 C470 180, 250 180, 125 135 z', class: 'nf-tunnel' }),
      T(340, 98, '暗号化したトンネル', 'nf-t small strong acc'),
      A('M130 110 H552', 'acc'), A('M606 125 H646')];
    kids.push(T(360, 236, '外からでも、社内にいるのと同じように社内のサーバーにつながる（中身は暗号化）', 'nf-t small'));
    return frame(720, 250, 'VPN の図', ...kids);
  },

  // プロキシとロードバランサー
  proxy() {
    const kids = [T(180, 24, 'フォワードプロキシ（社内 → 外）', 'nf-t head'), T(540, 24, 'リバースプロキシ・負荷分散（外 → サーバー）', 'nf-t head'),
      ...pc(50, 90, '社員'), ...pc(50, 180, '社員'), ...server(180, 135, 'プロキシ'), ...cloud(300, 135, 'Web'),
      A('M75 95 L156 128'), A('M75 175 L156 142'), A('M200 135 H250'),
      T(180, 205, 'ログ・URL の制限・ウイルス検査', 'nf-t small'),
      L(360, 40, 360, 240, 'nf-line dim'),
      ...pc(420, 135, '利用者'), ...router(530, 135, ''), T(520, 170, 'LB・リバースプロキシ', 'nf-t small strong'), ...server(660, 60, 'Web 1'), ...server(660, 135, 'Web 2'), ...server(660, 210, 'Web 3'),
      A('M445 135 H502'), A('M556 128 L638 66'), A('M558 135 H638'), A('M556 142 L638 204'),
      T(520, 190, 'TLS の終端・振り分け', 'nf-t small'), T(520, 206, '障害時の切り離し', 'nf-t small')];
    return frame(720, 262, 'プロキシとロードバランサー', ...kids);
  },

  // VLAN（1 台のスイッチを論理的に分ける）
  vlan() {
    const kids = [R(250, 120, 220, 50, 'nf-box', 6), T(360, 150, 'スイッチ（1 台）', 'nf-t strong'),
      ...pc(90, 60, '営業 VLAN 10'), ...pc(90, 230, '営業 VLAN 10'), ...pc(630, 60, '開発 VLAN 20'), ...pc(630, 230, '開発 VLAN 20'),
      L(112, 66, 250, 135, 'nf-line v10'), L(112, 226, 250, 155, 'nf-line v10'), L(608, 66, 470, 135, 'nf-line v20'), L(608, 226, 470, 155, 'nf-line v20'),
      T(360, 210, '同じスイッチでも、VLAN が違うと直接は届かない', 'nf-t small'),
      T(360, 228, '（VLAN をまたぐ通信はルーター・L3 スイッチを通す → そこで制限できる）', 'nf-t small'),
      T(150, 120, 'VLAN 10', 'nf-t small strong v10'), T(570, 120, 'VLAN 20', 'nf-t small strong v20')];
    return frame(720, 280, 'VLAN の図', ...kids);
  },

  // トラブルシューティングの順番
  trouble() {
    const steps = [
      ['1', 'リンク', 'ケーブル・Wi-Fi', 'ip link / ランプ'],
      ['2', 'IP', 'アドレスはある？', 'ip addr / ipconfig'],
      ['3', 'ゲートウェイ', 'ルーターに届く？', 'ping 192.168.1.1'],
      ['4', '外の IP', 'インターネットへ', 'ping 8.8.8.8'],
      ['5', 'DNS', '名前を引ける？', 'dig example.com'],
      ['6', 'ポート', 'サービスに届く？', 'nc -vz host 443'],
      ['7', 'アプリ', '応答は正しい？', 'curl -v https://…'],
    ];
    const kids = [];
    const w = 96;
    steps.forEach(([n, a, b, c], i) => {
      const x = 12 + i * (w + 4);
      kids.push(R(x, 30, w, 120, i < 3 ? 'nf-box l-link' : i < 5 ? 'nf-box l-net' : 'nf-box l-app'),
        s('circle', { cx: x + w / 2, cy: 52, r: 13, class: 'nf-step' }), T(x + w / 2, 57, n, 'nf-t step'),
        T(x + w / 2, 88, a, 'nf-t strong'), T(x + w / 2, 106, b, 'nf-t small'), T(x + w / 2, 136, c, 'nf-t mono tiny'));
      if (i < steps.length - 1) kids.push(A(`M${x + w - 2} 160 h8`, 'dim'));
    });
    kids.push(T(360, 180, '下の層から順に確かめる。どこで止まったかで、原因の範囲が一気にしぼれる', 'nf-t small'));
    return frame(720, 192, 'ネットワークのトラブルシューティングの順番', ...kids);
  },

  // 攻撃の流れと、それぞれの段階の守り（多層防御）
  defense() {
    const st = [
      ['偵察', 'スキャン・情報収集', 'ポートを閉じる・情報を出しすぎない'],
      ['侵入', '脆弱性・パスワード', '更新・多要素認証・メールの検査'],
      ['足場', '不審な通信（C2）', 'プロキシ・DNS の監視・EDR'],
      ['横展開', '社内の別の機器へ', 'セグメント分割・最小権限'],
      ['持ち出し', 'データを外へ', '出口の制限・DLP・ログの監視'],
    ];
    const kids = [];
    const w = 134;
    st.forEach(([a, b, c], i) => {
      const x = 12 + i * (w + 8);
      kids.push(s('path', { d: `M${x} 30 h${w - 14} l14 26 l-14 26 h-${w - 14} l12 -26 z`, class: 'nf-chev' }), T(x + w / 2 + 4, 52, a, 'nf-t strong'), T(x + w / 2 + 4, 70, b, 'nf-t small'),
        R(x + 4, 100, w - 8, 60, 'nf-box shield', 4), T(x + w / 2, 122, '守り', 'nf-t small strong acc'), ...wrapT(x + w / 2, 140, c, 11));
    });
    kids.push(T(360, 188, '1 つの対策ですべては防げない。段階ごとに守りを重ねて、どこかで気づける・止められるようにする', 'nf-t small'));
    return frame(720, 200, '攻撃の段階と守り', ...kids);
  },
};
// 全角で n 文字ごとに折り返した text
function wrapT(cx, y, str, n) {
  const out = [];
  for (let i = 0; i < str.length; i += n) out.push(T(cx, y + (i / n) * 15, str.slice(i, i + n), 'nf-t small'));
  return out;
}

// ---------- 練習用の部品 ----------
const ip2n = (s) => s.split('.').reduce((a, b) => a * 256 + +b, 0);
const n2ip = (n) => [24, 16, 8, 0].map((b) => Math.floor(n / 2 ** b) % 256).join('.');
const bin = (n) => [24, 16, 8, 0].map((b) => (Math.floor(n / 2 ** b) % 256).toString(2).padStart(8, '0')).join('.');
export function subnetInfo(cidr) {
  const m = /^\s*(\d{1,3}(?:\.\d{1,3}){3})\s*\/\s*(\d{1,2})\s*$/.exec(cidr);
  if (!m || m[1].split('.').some((x) => +x > 255) || +m[2] > 32) return null;
  const p = +m[2], ip = ip2n(m[1]);
  const size = 2 ** (32 - p);
  const net = Math.floor(ip / size) * size, bc = net + size - 1;
  const mask = 2 ** 32 - size;
  const hosts = p >= 31 ? (p === 32 ? 1 : 2) : size - 2;
  return { ip: m[1], prefix: p, mask: n2ip(mask), net: n2ip(net), bc: n2ip(bc), first: n2ip(p >= 31 ? net : net + 1), last: n2ip(p >= 31 ? bc : bc - 1), hosts, ipBin: bin(ip), maskBin: bin(mask),
    priv: (ip >= ip2n('10.0.0.0') && ip <= ip2n('10.255.255.255')) || (ip >= ip2n('172.16.0.0') && ip <= ip2n('172.31.255.255')) || (ip >= ip2n('192.168.0.0') && ip <= ip2n('192.168.255.255')) };
}

export const NET_WIDGETS = {
  subnet(b) {
    const input = h('input', { value: b.value ?? '192.168.10.37/24', 'aria-label': 'IP アドレス / プレフィックス長', spellcheck: 'false' });
    const out = h('div', { class: 'nf-calc-out' });
    const run = () => {
      const r = subnetInfo(input.value);
      if (!r) return out.replaceChildren(h('p', { class: 'hint' }, '「192.168.10.37/24」の形で入力してください'));
      const rows = [['ネットワークアドレス', r.net], ['ブロードキャスト', r.bc], ['使える範囲', `${r.first} 〜 ${r.last}`], ['使える台数', `${r.hosts.toLocaleString()} 台`], ['サブネットマスク', r.mask],
        ['IP（2 進数）', r.ipBin], ['マスク（2 進数）', r.maskBin], ['種類', r.priv ? 'プライベート（社内・家庭の LAN 用）' : 'グローバル（またはその他の用途）']];
      out.replaceChildren(h('table', { class: 'mn-table' }, h('tbody', {}, ...rows.map(([a, v]) => h('tr', {}, h('th', {}, a), h('td', {}, h('code', {}, v)))))));
    };
    input.addEventListener('input', run);
    run();
    return h('div', { class: 'nf-calc' }, h('div', { class: 'nf-calc-title' }, 'TRY：サブネット計算'), h('p', { class: 'hint' }, '値を変えて、答えを予想してから確かめてみましょう（例：10.1.2.3/16、172.16.5.200/27）'), input, out);
  },
};
export { s, T, R, L, A, boxT, frame, pc, server, cloud, router };
