// 「迷ったら診断」：貼り付けられた文字列の正体を推測し、次にやることとツールを提案する
import { identifyHash } from './hash.js';
import { caesarAll, englishChi as chi } from './ciphers.js';
import { flagRegex } from './magic.js';
import { parseIPv4 } from './net.js';
import { analyze as analyzeInjection } from './pinject.js';

// 問題文に書かれた n = ... / e = ... / c = ... を読み取る
export function parseRsaParams(text) {
  const out = {};
  const re = /(?:^|[^A-Za-z0-9_])(n|e|c|p|q|d|N|E|C|P|Q|D|phi|ct|pt|modulus|exponent)\s*[=:]\s*(0x[0-9a-fA-F]+|\d+)/g;
  const alias = { ct: 'c', modulus: 'n', exponent: 'e' };
  for (const m of text.matchAll(re)) {
    const k = alias[m[1].toLowerCase()] ?? m[1].toLowerCase();
    if (['n', 'e', 'c', 'p', 'q', 'd'].includes(k) && !(k in out)) out[k] = m[2];
  }
  return out;
}

const HIGH = 3, MID = 2, LOW = 1;

export const LEVEL = { [HIGH]: '高', [MID]: '中', [LOW]: '低' };

export function identify(input, prefixes) {
  const text = input.trim();
  const res = [];
  const add = (r) => res.push(r);
  if (!text) return res;
  const compact = text.replace(/\s+/g, '');
  const len = compact.length;

  // ---- すでにフラグ ----
  const flag = text.match(flagRegex(prefixes));
  if (flag) {
    add({
      id: 'flag', level: HIGH, title: 'フラグそのものが含まれています', tool: 'notes', payload: flag[0],
      reason: `「${flag[0]}」はフラグの形式です。`,
      next: '提出してみましょう。正解したら「問題メモ」に記録しておくとチームで共有しやすくなります。',
    });
  }

  // ---- JWT ----
  if (/^eyJ[\w-]+\.eyJ[\w-]+\.[\w-]*$/.test(compact)) {
    add({
      id: 'jwt', level: HIGH, title: 'JWT（Web のログイン情報などに使うトークン）', tool: 'jwt', payload: compact,
      reason: '「eyJ」で始まる3つの部分が「.」でつながっています。eyJ は Base64 にした「{\"」です。',
      next: 'JWT デコードで中身（ユーザー名や権限など）を確認しましょう。',
    });
  }

  // ---- 鍵・証明書 ----
  if (/-----BEGIN [A-Z ]+-----/.test(text)) {
    add({
      id: 'pem', level: HIGH, title: '鍵または証明書（PEM 形式）', tool: 'cheatsheet', payload: 'CRYPT',
      reason: '「-----BEGIN ...-----」で始まるのは PEM 形式の鍵や証明書です。',
      next: '公開鍵なら openssl で n と e を取り出し、RSA ツールに入れます（チートシートの CRYPT を参照）。',
    });
  }

  // ---- RSA のパラメータ ----
  const rsa = parseRsaParams(text);
  if (rsa.n && (rsa.c || rsa.e)) {
    add({
      id: 'rsa', level: HIGH, title: 'RSA 暗号の値', tool: 'rsa', payload: rsa,
      reason: `${Object.keys(rsa).join(', ')} の値が書かれています。n（公開鍵の積）、e（公開指数）、c（暗号文）は RSA の定番の記号です。`,
      next: 'RSA ツールに値を入れて「解く」を押すと、よくある弱点を自動で試します。',
    });
  } else if (/^\d{40,}$/.test(compact)) {
    add({
      id: 'bigint', level: LOW, title: 'とても大きな整数', tool: 'base', payload: compact,
      reason: `${len} 桁の整数です。RSA の n や c、または文字列を数値にしたものの可能性があります。`,
      next: '基数変換で ASCII に戻せるか確認しましょう。RSA の問題なら n・e・c をそろえて RSA ツールへ。',
    });
  }

  // ---- ハッシュ ----
  const hashes = identifyHash(compact);
  const isHashLike = hashes.length && /^[0-9a-f]+$/i.test(compact) && len >= 32 && !/^[01]+$/.test(compact) && !/[\s:,]/.test(text);
  if (isHashLike) {
    add({
      id: 'hash', level: len >= 32 ? MID : LOW, title: `ハッシュ値（${hashes.slice(0, 3).join(' / ')} など）`, tool: 'hash', payload: compact,
      reason: `16進数の ${len} 文字は ${hashes[0]} の長さと同じです。`,
      next: 'ハッシュは元に戻せない一方向の変換です。候補の文字列（パスワードなど）を「ハッシュ」で計算して一致するか比べます。ただの Hex データの可能性もあるので、Magic も試しましょう。',
    });
  } else if (hashes.length && /^[$*{]/.test(compact)) {
    add({
      id: 'hash', level: HIGH, title: `パスワードハッシュ（${hashes.join(' / ')}）`, tool: 'hash', payload: compact,
      reason: '「$」で始まる形式はパスワード保存用のハッシュです。',
      next: '元には戻せません。弱いパスワードなら辞書攻撃で見つかることがあります（大会ルールの範囲で）。',
    });
  }

  // ---- ネットワーク・時刻 ----
  if (/^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(text)) {
    let ok = true;
    try {
      parseIPv4(text.split('/')[0]);
    } catch {
      ok = false;
    }
    if (ok) add({
      id: 'ip', level: HIGH, title: 'IPv4 アドレス', tool: 'net', payload: text,
      reason: '数字4つを「.」でつないだ形は IP アドレスです。',
      next: 'ネットワーク・時刻ツールで、ネットワーク範囲やプライベートかどうかを確認できます。',
    });
  }
  if (/^\d{10}(\d{3})?$/.test(compact)) {
    const n = Number(compact.slice(0, 10));
    if (n >= 946684800 && n <= 2524608000) add({
      id: 'time', level: MID, title: 'UNIX 時間（日時）', tool: 'net', payload: compact,
      reason: `${compact.length} 桁の数値で、2000〜2050年の UNIX 時間の範囲に入っています。`,
      next: 'ネットワーク・時刻ツールで日時に変換しましょう。ログの時刻合わせに役立ちます。',
    });
  }

  // ---- エンコード ----
  const enc = (title, reason, level = MID) =>
    add({ id: 'enc', level, title, tool: 'codec', payload: text, reason, next: 'エンコード / デコードの「Magic」で自動的に戻せます。何重にもかかっていても順番に剥がします。' });

  if (/^[.\-\s/|]+$/.test(text) && /\./.test(text) && /-/.test(text)) enc('モールス信号', '「.」「-」と区切りだけでできています。', HIGH);
  else if (/^[01\s]+$/.test(text) && len >= 8) enc('2進数', '0 と 1 だけでできています。8桁で1文字を表すことが多いです。', len % 8 === 0 ? HIGH : MID);
  else if (/^(?:0x|\\x)?(?:[0-9a-f]{2}[\s:,]*(?:0x|\\x)?)+$/i.test(text) && len >= 6 && !(/^\d+$/.test(text))) {
    enc('16進数（Hex）', '0〜9 と a〜f だけでできています。2文字で1バイトです。', isHashLike ? MID : HIGH);
  }
  else if (/^\d{1,3}(?:[\s,]+\d{1,3}){3,}$/.test(text) && text.split(/[\s,]+/).every((x) => +x <= 255)) enc('10進数の文字コード', '255 以下の数がたくさん並んでいます。ASCII コード（例: 102=f, 108=l）かもしれません。', HIGH);
  else if (!/[ \t]/.test(text) && /^[A-Z2-7]+=*$/.test(compact) && len >= 8 && len % 8 === 0) enc('Base32', '大文字 A〜Z と数字 2〜7 だけで、長さが8の倍数です（末尾が = のことも）。', HIGH);
  else if (!/[ \t]/.test(text) && /^[A-Za-z0-9+/]+={0,2}$/.test(compact) && len >= 8 && len % 4 === 0 && /[a-z]/.test(compact) && /[A-Z0-9]/.test(compact)) enc('Base64', '英大文字・小文字・数字・+ / だけで、長さが4の倍数です（末尾が = のことも）。', /=$/.test(compact) ? HIGH : MID);
  else if (!/[ \t]/.test(text) && /^[A-Za-z0-9_-]+$/.test(compact) && len >= 12 && /[a-z]/.test(compact) && /[A-Z]/.test(compact) && /\d/.test(compact)) enc('Base64（URL 用）や Base58 など', '英数字が不規則に混ざっています。何かのエンコードの可能性があります。', LOW);
  if (/%[0-9a-f]{2}/i.test(text)) enc('URL エンコード', '「%」の後に16進数2桁が続く部分があります（例: %20 = 空白）。', HIGH);
  if (/&(#x?[0-9a-f]+|[a-z]+);/i.test(text)) enc('HTML エンティティ', '「&#...;」や「&amp;」のような部分があります。', HIGH);
  if (/\\u[0-9a-f]{4}|\\x[0-9a-f]{2}/i.test(text)) enc('Unicode / エスケープ表記', '「\\u0041」や「\\x41」のような書き方が含まれています。', HIGH);
  if (/^<~[\s\S]*~>$/.test(text)) enc('Base85（ASCII85）', '「<~」で始まり「~>」で終わっています。', HIGH);

  // ---- AI への隠れた指示（プロンプトインジェクション） ----
  const pi = analyzeInjection(text);
  if (pi.level === '高' || pi.level === '中') {
    add({
      id: 'pinject', level: pi.level === '高' ? HIGH : MID, title: pi.tags ? '見えない文字で隠された文（Unicode タグ文字）' : 'AI への隠れた指示（プロンプトインジェクション）の疑い',
      tool: 'pinject', payload: text,
      reason: pi.reasons.slice(0, 2).join('。') + '。',
      next: 'AI 入力チェックで、見えない文字・隠しコンテンツ・乗っ取りらしい表現を確認し、必要なら無害化しましょう。',
    });
  }

  // ---- 文字化け ----
  const moji = (text.match(/[縺繧繝譁蜈荳螟險邨陦鬮][\uff61-\uff9f]?|ã[\u0080-\u00bf\u201a-\u203a]|Ã.|â€|ï¼|ç[\u0080-\u00bf]/g) ?? []).length;
  if (moji >= 2) {
    add({
      id: 'mojibake', level: moji >= 4 ? HIGH : MID, title: '文字化けした日本語', tool: 'mojibake', payload: text,
      reason: '「縺」「繧」や「ã」「â€」のような、文字コードを取り違えたときに特有の文字が並んでいます。',
      next: '文字化け修復で、正しい文字コードに読み直しましょう。',
    });
  }

  // ---- 古典暗号 ----
  const letters = text.replace(/[^a-z]/gi, '').length;
  const words = text.split(/\s+/).filter(Boolean).length;
  if (!flag && letters >= 12 && words >= 2 && letters / compact.length > 0.75 && !res.some((r) => r.level === HIGH || r.id === 'enc')) {
    const rows = caesarAll(text).map((r) => ({ ...r, chi: chi(r.text) }));
    const best = rows.reduce((a, b) => (b.chi < a.chi ? b : a));
    if (best.shift === 0 && best.chi < 2) {
      add({
        id: 'plain', level: LOW, title: '普通の英文のようです', tool: 'flag', payload: text,
        reason: '英語の文字の出方とよく似ています。暗号化されていない可能性があります。',
        next: '文中にヒントやフラグが隠れていないか、フラグ検索や頭文字・大文字の並びを確認しましょう。',
      });
    } else if (best.shift !== 0 && best.chi < 2.5 && rows[0].chi > best.chi * 2) {
      add({
        id: 'caesar', level: HIGH, title: `シーザー暗号（${best.shift} 文字ずらし${best.shift === 13 ? '＝ROT13' : ''}）`, tool: 'classic', payload: text,
        reason: `アルファベットを ${best.shift} 文字ずらすと英文らしくなります: 「${best.text.slice(0, 40)}${best.text.length > 40 ? '…' : ''}」`,
        next: '古典暗号ツールの「シーザー / ROT」タブで全パターンを確認しましょう。',
      });
    } else {
      add({
        id: 'classic', level: MID, title: '古典暗号（換字式・Vigenère など）', tool: 'classic', payload: text,
        reason: 'ほとんどアルファベットですが、そのままでもずらしても英文になりません。',
        next: '古典暗号ツールの「頻度分析」で暗号の種類を推定し、Vigenère の自動解読や換字表を試しましょう。',
      });
    }
  }

  // ---- 何もわからない ----
  if (!res.length) {
    add({
      id: 'unknown', level: LOW, title: '形式を特定できませんでした', tool: 'codec', payload: text,
      reason: 'よく知られた形式には当てはまりませんでした。',
      next: 'まずはエンコード / デコードの「Magic」を試しましょう。XOR されたデータなら XOR ツール、文章ならフラグ検索も有効です。',
    });
  }
  return res.sort((a, b) => b.level - a.level);
}
