// ツールの定義と線画アイコン（ホームのタイル・サイドメニュー・診断で共通に使う）

// 24×24 の線画（stroke で描く）。すべてこのポータル用のオリジナル
export const ICONS = {
  home: 'M3 11l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5',
  guide: 'M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5C4.7 20 4 19.3 4 18.5zM20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5zM6.5 8h2M6.5 11h2M15.5 8h2M15.5 11h2',
  identify: 'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 12l7-7M17 3h4v4',
  codec: 'M4 8h13l-3-3M20 16H7l3 3M8 3v3M16 18v3',
  base: 'M4 7h4v10H4zM11 7l2 5-2 5M16 7h4M16 12h4M16 17h4',
  classic: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M12 7a5 5 0 1 0 0 10 5 5 0 1 0 0-10M12 3v4M12 17v4M3 12h4M17 12h4',
  xor: 'M12 4a8 8 0 1 0 0 16 8 8 0 1 0 0-16M12 4v16M4 12h16',
  rsa: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5zM12 15v2',
  file: 'M6 3h8l5 5v13H6zM14 3v5h5M9 13h7M9 17h5',
  hash: 'M9 4L7 20M17 4l-2 16M4 9h17M3 15h17',
  jwt: 'M4 7h16v10H4zM8 11h.01M12 11h.01M16 11h.01M8 14h8',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  net: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  notes: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',
  cheatsheet: 'M4 5h16v14H4zM7 10l3 2-3 2M12 15h5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
};

export function icon(name, cls = 'ico') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', ICONS[name] ?? ICONS.arrow);
  svg.append(p);
  return svg;
}

export const TOOL_GROUPS = ['変換', '暗号', '解析', '補助'];

export const TOOLS = [
  { id: 'codec', group: '変換', name: 'エンコード / デコード', desc: 'Magic で多重エンコードを自動で剥がす' },
  { id: 'base', group: '変換', name: '基数変換', desc: '2・8・10・16進と ASCII を相互変換' },
  { id: 'classic', group: '暗号', name: '古典暗号', desc: 'シーザー・Vigenère 自動解読・換字表' },
  { id: 'xor', group: '暗号', name: 'XOR', desc: '総当たり・繰り返し鍵・既知平文から鍵推定' },
  { id: 'rsa', group: '暗号', name: 'RSA', desc: 'よくある弱点を自動で試して復号' },
  { id: 'file', group: '解析', name: 'ファイル解析', desc: '隠しファイル・末尾データ・PNG 復元' },
  { id: 'hash', group: '解析', name: 'ハッシュ', desc: '計算と形式の推定' },
  { id: 'jwt', group: '解析', name: 'JWT デコード', desc: 'トークンの中身と注意点' },
  { id: 'flag', group: '解析', name: 'フラグ検索', desc: '長いログから flag{…} を探す' },
  { id: 'net', group: '解析', name: 'ネットワーク・時刻', desc: 'CIDR 計算と UNIX 時間の変換' },
  { id: 'notes', group: '補助', name: '問題メモ', desc: '試したこととフラグを記録' },
  { id: 'cheatsheet', group: '補助', name: 'チートシート', desc: 'ジャンル別の定番コマンド集' },
];

export const TOOL_LABEL = Object.fromEntries(TOOLS.map((t) => [t.id, t.name]));
