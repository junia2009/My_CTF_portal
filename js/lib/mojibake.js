// 文字化け修復：「本当は A で書かれたバイト列を、B として読んでしまった」状態を逆にたどって候補を出す

// 化けた文字列を、各文字コードのバイト列に戻すための対応表（初回だけ作る）
const SINGLE = ['windows-1252', 'iso-8859-2', 'koi8-r'];
const MULTI = ['shift_jis', 'euc-jp', 'gbk', 'big5', 'euc-kr'];
export const FROM = [...SINGLE, ...MULTI];
export const TO = ['utf-8', 'shift_jis', 'euc-jp', 'gbk', 'big5', 'euc-kr'];
const tables = new Map();

function table(enc) {
  if (tables.has(enc)) return tables.get(enc);
  const map = new Map();
  const td = new TextDecoder(enc, { fatal: true });
  const tryAdd = (bytes) => {
    try {
      const s = td.decode(Uint8Array.from(bytes));
      if (Array.from(s).length === 1 && !map.has(s)) map.set(s, bytes);
    } catch { /* その並びは文字にならない */ }
  };
  for (let b = 0; b < 256; b++) tryAdd([b]);
  if (MULTI.includes(enc)) {
    for (let a = 0x81; a <= 0xfe; a++) for (let b = 0x40; b <= 0xfe; b++) tryAdd([a, b]);
    if (enc === 'euc-jp') for (let b = 0xa1; b <= 0xdf; b++) tryAdd([0x8e, b]); // 半角カナ
  }
  tables.set(enc, map);
  return map;
}

// lossy: 戻せない文字（化けた時点で失われた「�」など）を ? で埋めて続ける
export function encodeAs(text, enc, { lossy = false } = {}) {
  const t = table(enc);
  const out = [];
  let lost = 0;
  for (const ch of text) {
    const b = t.get(ch);
    if (!b) {
      if (!lossy) return null;
      out.push(0x3f);
      lost++;
      continue;
    }
    out.push(...b);
  }
  const bytes = Uint8Array.from(out);
  return lossy ? { bytes, lost } : bytes;
}

// 日本語・英語として読みやすいほど高い点
export function readability(s) {
  if (!s) return 0;
  let good = 0, bad = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if ((c >= 0x20 && c < 0x7f) || c === 10 || c === 13 || c === 9) good += 1;
    // 日本語の文章には、かながふつう混ざる。漢字だけが並ぶのは中国語の文字コードで読んだ結果のことが多い
    else if (c >= 0x3040 && c <= 0x30ff) good += 1.6;
    else if ((c >= 0x3000 && c <= 0x303f) || (c >= 0xff01 && c <= 0xff5e)) good += 1;
    else if (c >= 0x4e00 && c <= 0x9fff) good += 0.75;
    else if (c === 0xfffd || c < 0x20 || (c >= 0x80 && c < 0xa0)) bad += 3;
    else if (c >= 0x0370 && c <= 0x04ff) bad += 0.8; // ギリシャ・キリル文字（化けた結果によく混ざる）
    else if (c >= 0xff61 && c <= 0xff9f) bad += 0.6; // 半角カナは化けた結果によく出る
    else bad += 0.3;
  }
  const n = Array.from(s).length;
  return (good - bad) / n;
}

export function repairCandidates(text, limit = 12) {
  const seen = new Set([text]);
  const out = [];
  for (const from of FROM) {
    let bytes = encodeAs(text, from), lost = 0;
    if (!bytes) {
      // 一部の文字が戻せないときも、残りの部分は復元できることが多い
      const r = encodeAs(text, from, { lossy: true });
      if (r.lost > Math.max(2, Array.from(text).length * 0.15)) continue;
      ({ bytes, lost } = r);
    }
    for (const to of TO) {
      if (to === from) continue;
      let s;
      try {
        s = new TextDecoder(to, { fatal: !lost }).decode(bytes);
      } catch {
        continue;
      }
      if (seen.has(s)) continue;
      seen.add(s);
      // 欠損がある候補は、欠損に由来する「�」「?」を除いて読みやすさを測り、欠損の数だけ少し減点する
      const scored = lost ? s.replace(/[\ufffd?]/g, '') : s;
      out.push({ from, to, text: s, lost, score: readability(scored) - lost * 0.08 + (to === 'utf-8' ? 0.05 : 0) });
    }
  }
  const base = readability(text);
  return { base, candidates: out.filter((c) => c.score > base).sort((a, b) => b.score - a.score).slice(0, limit) };
}

// バイト列を、いろいろな文字コードで読んでみる
export function decodeAll(bytes) {
  const encs = ['utf-8', 'shift_jis', 'euc-jp', 'iso-2022-jp', 'utf-16le', 'utf-16be', 'windows-1252', 'gbk', 'big5', 'euc-kr'];
  const out = [];
  for (const e of encs) {
    try {
      const s = new TextDecoder(e, { fatal: true }).decode(bytes);
      out.push({ enc: e, text: s, score: readability(s) });
    } catch { /* この文字コードでは読めない */ }
  }
  return out.sort((a, b) => b.score - a.score);
}
