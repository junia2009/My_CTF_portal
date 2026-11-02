// 表計算ファイル（CSV / xlsx / xls）を読み、セル単位で比べる
// 外部ライブラリは使わず、ZIP（xlsx）・複合ドキュメント（xls の OLE2）・BIFF8 レコードを直接読む

// ---------- 共通 ----------
export function colName(c) {
  let s = '';
  for (c += 1; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s;
  return s;
}
export function parseRef(ref) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) return null;
  let c = 0;
  for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
  return { r: +m[2] - 1, c: c - 1 };
}
const refOf = (r, c) => colName(c) + (r + 1);

const fmtNum = (n) => (Number.isInteger(n) ? String(n) : String(+n.toPrecision(15)));

// 日付の書式か（"yyyy/mm/dd" など。色指定 [Red] や "文字" は除いて判定）
const DATE_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);
function isDateFormat(id, code) {
  if (DATE_IDS.has(id)) return true;
  if (!code) return false;
  const c = code.replace(/"[^"]*"|\\.|\[(?!h\]|m\]|s\])[^\]]*\]/gi, '');
  return /[yd]|h.*m|m.*s|\[h\]|ge|e{1,4}/i.test(c) && !/^general$/i.test(c);
}
// Excel のシリアル値 → 日時の文字列
function serialToDate(v, date1904) {
  const ms = Math.round((v + (date1904 ? 1462 : 0) - 25569) * 86400000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return fmtNum(v);
  const p = (n) => String(n).padStart(2, '0');
  const date = `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}`;
  const time = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
  if (v < 1 && v >= 0) return time;
  return Number.isInteger(v) ? date : `${date} ${time}`;
}

function newSheet(name, state = 'visible') {
  return { name, state, cells: new Map(), hiddenRows: new Set(), hiddenCols: new Set(), comments: new Map(), maxRow: -1, maxCol: -1 };
}
function setCell(sheet, r, c, cell) {
  if (cell.v === '' && !cell.f) return;
  sheet.cells.set(refOf(r, c), cell);
  if (r > sheet.maxRow) sheet.maxRow = r;
  if (c > sheet.maxCol) sheet.maxCol = c;
}

// ---------- 形式の判定 ----------
const isZip = (b) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4;
const isCfb = (b) => b.length > 512 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 && b[4] === 0xa1 && b[5] === 0xb1 && b[6] === 0x1a && b[7] === 0xe1;

export function sheetKind(name, bytes) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (isCfb(bytes)) return 'xls';
  if (isZip(bytes)) return ['xlsx', 'xlsm', 'xltx', 'xltm'].includes(ext) || findZipName(bytes, 'xl/workbook.xml') ? 'xlsx' : null;
  if (['csv', 'tsv', 'txt'].includes(ext)) return 'csv';
  return null;
}

export async function readBook(name, bytes) {
  const kind = sheetKind(name, bytes);
  if (kind === 'xlsx') return readXlsx(bytes);
  if (kind === 'xls') return readXls(bytes);
  if (kind === 'csv') return readCsv(bytes, name);
  throw new Error('CSV / xlsx / xls として読めませんでした');
}

// ---------- CSV ----------
export function decodeText(bytes) {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return { text: new TextDecoder().decode(bytes.subarray(3)), enc: 'UTF-8（BOM 付き）' };
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), enc: 'UTF-16' };
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), enc: 'UTF-8' };
  } catch {
    // 日本語版 Excel が保存する CSV は Shift_JIS のことが多い
    return { text: new TextDecoder('shift_jis').decode(bytes), enc: 'Shift_JIS' };
  }
}

export function parseCsv(text, delim = null) {
  if (!delim) {
    const head = text.split(/\r?\n/, 1)[0].replace(/"[^"]*"/g, '');
    const counts = [',', '\t', ';'].map((d) => [d, head.split(d).length - 1]);
    delim = counts.sort((a, b) => b[1] - a[1])[0][1] ? counts[0][0] : ',';
  }
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"' && cur === '') q = true;
    else if (ch === delim) {
      row.push(cur);
      cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else cur += ch;
  }
  if (cur !== '' || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return { rows, delim };
}

export function readCsv(bytes, name = 'CSV') {
  const { text, enc } = typeof bytes === 'string' ? { text: bytes, enc: 'テキスト' } : decodeText(bytes);
  const { rows, delim } = parseCsv(text);
  const sheet = newSheet(name.replace(/\.[^.]+$/, '') || 'CSV');
  rows.forEach((r, i) => r.forEach((v, j) => setCell(sheet, i, j, { v, t: 's' })));
  return { format: 'CSV', info: `${enc}・区切り ${delim === '\t' ? 'タブ' : delim}`, sheets: [sheet] };
}

// ---------- ZIP（xlsx） ----------
function zipEntries(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('ZIP の終端が見つかりません（壊れたファイル）');
  const n = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = new Map();
  for (let i = 0; i < n && p + 46 <= b.length; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl));
    out.set(name, { method, csize, local });
    p += 46 + nl + el + cl;
  }
  return out;
}
function findZipName(b, name) {
  try {
    return zipEntries(b).has(name);
  } catch {
    return false;
  }
}
async function zipRead(b, entries, name) {
  const e = entries.get(name);
  if (!e) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const start = e.local + 30 + dv.getUint16(e.local + 26, true) + dv.getUint16(e.local + 28, true);
  const data = b.subarray(start, start + e.csize);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new Error(`未対応の圧縮方式（${e.method}）`);
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

// ---------- 小さな XML の読み取り（正規表現。xlsx の決まった形だけを読む） ----------
const unxml = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&amp;/g, '&')
  .replace(/_x([0-9A-F]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const attrs = (s) => {
  const o = {};
  for (const m of s.matchAll(/([\w:]+)\s*=\s*"([^"]*)"/g)) o[m[1].replace(/^.*:/, '')] = unxml(m[2]);
  return o;
};
// <t> の文字を集める（ふりがな <rPh> は除く）
const texts = (s) => [...s.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g)].map((m) => unxml(m[1] ?? '')).join('');
const resolvePath = (base, target) => {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
};
async function rels(b, entries, path) {
  const dir = path.split('/').slice(0, -1).join('/');
  const xml = await zipRead(b, entries, `${dir ? dir + '/' : ''}_rels/${path.split('/').pop()}.rels`);
  const out = new Map();
  if (!xml) return out;
  for (const m of xml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const a = attrs(m[1]);
    out.set(a.Id, { type: a.Type ?? '', target: resolvePath(path, a.Target ?? '') });
  }
  return out;
}

export async function readXlsx(b) {
  const entries = zipEntries(b);
  const wbPath = [...entries.keys()].find((n) => /^xl\/workbook\d*\.xml$/.test(n)) ?? 'xl/workbook.xml';
  const wbXml = await zipRead(b, entries, wbPath);
  if (!wbXml) throw new Error('xl/workbook.xml がありません（xlsx ではない ZIP）');
  const wbRels = await rels(b, entries, wbPath);
  const date1904 = /date1904="(1|true)"/.test(wbXml);
  // 共有文字列
  const sstPath = [...wbRels.values()].find((r) => /sharedStrings$/.test(r.type))?.target ?? 'xl/sharedStrings.xml';
  const sstXml = (await zipRead(b, entries, sstPath)) ?? '';
  const sst = [...sstXml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((m) => (m[1] ? texts(m[1]) : ''));
  // 書式（日付の判定に使う）
  const stPath = [...wbRels.values()].find((r) => /styles$/.test(r.type))?.target ?? 'xl/styles.xml';
  const stXml = (await zipRead(b, entries, stPath)) ?? '';
  const fmts = new Map([...stXml.matchAll(/<numFmt\b([^>]*)\/?>/g)].map((m) => attrs(m[1])).map((a) => [+a.numFmtId, a.formatCode]));
  const xfBlock = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stXml)?.[1] ?? '';
  const xfDate = [...xfBlock.matchAll(/<xf\b([^>]*?)\/?>/g)].map((m) => {
    const id = +(attrs(m[1]).numFmtId ?? 0);
    return isDateFormat(id, fmts.get(id));
  });

  const sheets = [];
  for (const m of wbXml.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    const a = attrs(m[1]);
    const rel = wbRels.get(a.id);
    const sheet = newSheet(a.name ?? `Sheet${sheets.length + 1}`, a.state === 'hidden' ? 'hidden' : a.state === 'veryHidden' ? 'veryHidden' : 'visible');
    sheets.push(sheet);
    if (!rel) continue;
    const xml = await zipRead(b, entries, rel.target);
    if (!xml) continue;
    for (const rm of xml.matchAll(/<row\b([^>]*?)\/?>/g)) {
      const ra = attrs(rm[1]);
      if ((ra.hidden === '1' || ra.hidden === 'true') && ra.r) sheet.hiddenRows.add(+ra.r - 1);
    }
    for (const cm of xml.matchAll(/<col\b([^>]*?)\/?>/g)) {
      const ca = attrs(cm[1]);
      if (ca.hidden === '1' || ca.hidden === 'true') for (let c = +ca.min; c <= Math.min(+ca.max, +ca.min + 300); c++) sheet.hiddenCols.add(c - 1);
    }
    let autoR = 0, autoC = 0;
    for (const cm of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ca = attrs(cm[1]);
      const inner = cm[2] ?? '';
      const pos = ca.r ? parseRef(ca.r) : { r: autoR, c: autoC };
      if (!pos) continue;
      autoR = pos.r;
      autoC = pos.c + 1;
      const fm = /<f\b([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/.exec(inner);
      const vRaw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let v = '', t = ca.t ?? 'n';
      if (t === 's') v = sst[+vRaw] ?? '';
      else if (t === 'inlineStr') v = texts(/<is>([\s\S]*?)<\/is>/.exec(inner)?.[1] ?? '');
      else if (t === 'str' || t === 'e') v = unxml(vRaw ?? '');
      else if (t === 'b') v = vRaw === '1' ? 'TRUE' : 'FALSE';
      else if (vRaw != null && vRaw !== '') {
        const n = Number(vRaw);
        v = xfDate[+(ca.s ?? 0)] ? serialToDate(n, date1904) : fmtNum(n);
      }
      let f = null;
      if (fm) {
        const fa = attrs(fm[1]);
        f = fm[2] ? '=' + unxml(fm[2]) : fa.t === 'shared' ? `=（共有の数式 #${fa.si}）` : '=（数式）';
      }
      setCell(sheet, pos.r, pos.c, { v, f, t, fkey: f && !fm[2] ? 'shared' : undefined });
    }
    // コメント（メモ）
    const sRels = await rels(b, entries, rel.target);
    for (const r of sRels.values()) {
      if (!/comments$/.test(r.type)) continue;
      const cx = (await zipRead(b, entries, r.target)) ?? '';
      for (const c of cx.matchAll(/<comment\b([^>]*)>([\s\S]*?)<\/comment>/g)) sheet.comments.set(attrs(c[1]).ref, texts(c[2]));
    }
  }
  return { format: 'xlsx', info: `${sheets.length} シート`, sheets };
}

// ---------- 複合ドキュメント（OLE2 / CFB） ----------
export function readCfb(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const shift = dv.getUint16(0x1e, true), miniShift = dv.getUint16(0x20, true);
  const secSize = 1 << shift, miniSize = 1 << miniShift;
  const cutoff = dv.getUint32(0x38, true);
  const secOff = (sid) => (sid + 1) * secSize;
  const ENDS = 0xfffffffe;
  // FAT の場所（DIFAT）
  const difat = [];
  for (let i = 0; i < 109; i++) difat.push(dv.getUint32(0x4c + i * 4, true));
  let dsec = dv.getUint32(0x44, true);
  for (let guard = 0; dsec < ENDS && guard < 10000; guard++) {
    const o = secOff(dsec);
    if (o + secSize > b.length) break;
    for (let i = 0; i < secSize / 4 - 1; i++) difat.push(dv.getUint32(o + i * 4, true));
    dsec = dv.getUint32(o + secSize - 4, true);
  }
  const fat = [];
  for (const s of difat) {
    if (s >= ENDS) continue;
    const o = secOff(s);
    if (o + secSize > b.length) continue;
    for (let i = 0; i < secSize / 4; i++) fat.push(dv.getUint32(o + i * 4, true));
  }
  const chain = (start, table) => {
    const out = [];
    const seen = new Set();
    for (let s = start; s < ENDS && !seen.has(s) && s < table.length; s = table[s]) {
      seen.add(s);
      out.push(s);
    }
    return out;
  };
  const readChain = (start, size) => {
    const out = new Uint8Array(size);
    let p = 0;
    for (const s of chain(start, fat)) {
      const o = secOff(s);
      const n = Math.min(secSize, size - p, b.length - o);
      if (n <= 0) break;
      out.set(b.subarray(o, o + n), p);
      p += n;
    }
    return out;
  };
  // ディレクトリ
  const dirStart = dv.getUint32(0x30, true);
  const dirBytes = readChain(dirStart, chain(dirStart, fat).length * secSize);
  const ddv = new DataView(dirBytes.buffer);
  const entries = [];
  for (let o = 0; o + 128 <= dirBytes.length; o += 128) {
    const nl = ddv.getUint16(o + 64, true);
    const type = dirBytes[o + 66];
    if (!type) continue;
    entries.push({ name: new TextDecoder('utf-16le').decode(dirBytes.subarray(o, o + Math.max(0, nl - 2))), type, start: ddv.getUint32(o + 116, true), size: ddv.getUint32(o + 120, true) });
  }
  const root = entries.find((e) => e.type === 5);
  let mini = null, miniFat = null;
  const stream = (name) => {
    const e = entries.find((x) => x.type === 2 && x.name.toLowerCase() === name.toLowerCase());
    if (!e) return null;
    if (e.size >= cutoff || !root) return readChain(e.start, e.size);
    // 小さいストリームはミニストリームの中にある
    mini ??= readChain(root.start, root.size);
    if (!miniFat) {
      const mfStart = dv.getUint32(0x3c, true);
      const mf = readChain(mfStart, chain(mfStart, fat).length * secSize);
      const mdv = new DataView(mf.buffer);
      miniFat = Array.from({ length: mf.length / 4 }, (_, i) => mdv.getUint32(i * 4, true));
    }
    const out = new Uint8Array(e.size);
    let p = 0;
    for (const s of chain(e.start, miniFat)) {
      const o = s * miniSize;
      const n = Math.min(miniSize, e.size - p);
      out.set(mini.subarray(o, o + n), p);
      p += n;
    }
    return out;
  };
  return { entries, stream };
}

// ---------- xls（BIFF8） ----------
const XLS_ERR = { 0: '#NULL!', 7: '#DIV/0!', 15: '#VALUE!', 23: '#REF!', 29: '#NAME?', 36: '#NUM!', 42: '#N/A' };

// CONTINUE レコードにまたがる文字列を読むための読み取り器
function segReader(segs) {
  let si = 0, p = 0;
  const next = () => {
    si++;
    p = 0;
  };
  const byte = () => {
    while (si < segs.length && p >= segs[si].length) next();
    if (si >= segs.length) throw new Error('end');
    return segs[si][p++];
  };
  return {
    u8: byte,
    u16: () => byte() | (byte() << 8),
    u32: () => (byte() | (byte() << 8) | (byte() << 16) | (byte() << 24)) >>> 0,
    skip: (n) => {
      for (let i = 0; i < n; i++) byte();
    },
    // 文字の途中でレコードが切り替わると、次のレコードの先頭に「1バイト文字か2バイト文字か」のフラグが入る
    chars: (n, high) => {
      let s = '';
      for (let i = 0; i < n; i++) {
        if (si < segs.length && p >= segs[si].length) {
          next();
          high = (byte() & 1) === 1;
        }
        s += String.fromCharCode(high ? byte() | (byte() << 8) : byte());
      }
      return s;
    },
    done: () => si >= segs.length || (si === segs.length - 1 && p >= segs[si].length),
  };
}
function xlString(d, o, lenBytes = 2) {
  const n = lenBytes === 2 ? d[o] | (d[o + 1] << 8) : d[o];
  const flags = d[o + lenBytes];
  let p = o + lenBytes + 1;
  const rich = flags & 8, ext = flags & 4;
  if (rich) p += 2;
  if (ext) p += 4;
  const s = flags & 1 ? new TextDecoder('utf-16le').decode(d.subarray(p, p + n * 2)) : new TextDecoder('latin1').decode(d.subarray(p, p + n));
  return s;
}
function rkValue(rk) {
  let v;
  if (rk & 2) v = rk >> 2;
  else {
    const buf = new DataView(new ArrayBuffer(8));
    buf.setUint32(4, rk & 0xfffffffc, true);
    v = buf.getFloat64(0, true);
  }
  return rk & 1 ? v / 100 : v;
}

export function readXls(b) {
  const cfb = readCfb(b);
  if (cfb.entries.some((e) => e.name === 'EncryptedPackage')) throw new Error('パスワードで保護（暗号化）された Excel ファイルです。Excel でパスワードを外してから比べてください');
  const wb = cfb.stream('Workbook') ?? cfb.stream('Book');
  if (!wb) throw new Error('Workbook ストリームがありません（Excel 以外の Office ファイル）');
  const dv = new DataView(wb.buffer, wb.byteOffset, wb.byteLength);
  const recs = [];
  for (let p = 0; p + 4 <= wb.length;) {
    const type = dv.getUint16(p, true), len = dv.getUint16(p + 2, true);
    recs.push({ type, pos: p, d: wb.subarray(p + 4, p + 4 + len) });
    p += 4 + len;
  }
  const bounds = [], sst = [], formats = new Map(), xfFmt = [];
  let date1904 = false;
  const sheets = [];
  let sheet = null, inGlobals = true, pendingString = null;
  const isDate = (xf) => {
    const id = xfFmt[xf];
    return id != null && isDateFormat(id, formats.get(id));
  };
  const num = (v, xf) => (isDate(xf) ? serialToDate(v, date1904) : fmtNum(v));
  for (let i = 0; i < recs.length; i++) {
    const { type, d, pos } = recs[i];
    const r16 = (o) => d[o] | (d[o + 1] << 8);
    const r32 = (o) => (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;
    if (type === 0x002f) throw new Error('パスワードで保護（暗号化）された xls ファイルです。Excel でパスワードを外してから比べてください');
    if (type === 0x0809) {
      // BOF：ワークブック全体の後、シートごとに出てくる
      if (!inGlobals || sheets.length || bounds.length) {
        const bs = bounds.find((x) => x.pos === pos) ?? bounds[sheets.length];
        sheet = newSheet(bs?.name ?? `Sheet${sheets.length + 1}`, bs?.state ?? 'visible');
        sheets.push(sheet);
      }
      continue;
    }
    if (type === 0x000a) {
      inGlobals = false;
      sheet = null;
      continue;
    }
    if (inGlobals) {
      if (type === 0x0085) bounds.push({ pos: r32(0), state: ['visible', 'hidden', 'veryHidden'][d[4] & 3] ?? 'visible', name: xlString(d, 6, 1), kind: d[5] });
      else if (type === 0x0022) date1904 = r16(0) === 1;
      else if (type === 0x041e) formats.set(r16(0), xlString(d, 2));
      else if (type === 0x00e0) xfFmt.push(r16(2));
      else if (type === 0x00fc) {
        const segs = [d.subarray(8)];
        while (recs[i + 1]?.type === 0x003c) segs.push(recs[++i].d);
        const rd = segReader(segs);
        const total = r32(4);
        try {
          for (let k = 0; k < total && !rd.done(); k++) {
            const n = rd.u16(), flags = rd.u8();
            const runs = flags & 8 ? rd.u16() : 0;
            const ext = flags & 4 ? rd.u32() : 0;
            sst.push(rd.chars(n, (flags & 1) === 1));
            rd.skip(runs * 4 + ext);
          }
        } catch {
          // 途中で壊れていても、読めたところまで使う
        }
      }
      continue;
    }
    if (!sheet) continue;
    const row = r16(0), col = r16(2), xf = r16(4);
    switch (type) {
      case 0x00fd: setCell(sheet, row, col, { v: sst[r32(6)] ?? '', t: 's' }); break;
      case 0x0204: setCell(sheet, row, col, { v: xlString(d, 6), t: 's' }); break;
      case 0x0203: setCell(sheet, row, col, { v: num(new DataView(d.buffer, d.byteOffset + 6, 8).getFloat64(0, true), xf), t: 'n' }); break;
      case 0x027e: setCell(sheet, row, col, { v: num(rkValue(r32(6)), xf), t: 'n' }); break;
      case 0x00bd: {
        const last = r16(d.length - 2);
        for (let c = col, o = 4; c <= last && o + 6 <= d.length - 2; c++, o += 6) setCell(sheet, row, c, { v: num(rkValue(r32(o + 2)), r16(o)), t: 'n' });
        break;
      }
      case 0x0205: setCell(sheet, row, col, { v: d[7] ? XLS_ERR[d[6]] ?? '#ERR' : d[6] ? 'TRUE' : 'FALSE', t: d[7] ? 'e' : 'b' }); break;
      case 0x0006: {
        // 数式：計算結果と、数式そのもの（トークン列）。数式の文字は復元せず、変化の検出に使う
        const cce = r16(20);
        // 先頭が ptgExp（0x01）なら共有の数式：ファイルごとに共有のされ方が違うので、数式の比較はしない
        const fkey = d[22] === 0x01 ? 'shared' : [...d.subarray(22, 22 + cce)].map((x) => x.toString(16).padStart(2, '0')).join('');
        const cell = { v: '', f: '=（数式）', fkey, t: 'n' };
        if (d[12] === 0xff && d[13] === 0xff) {
          if (d[6] === 0) {
            pendingString = cell;
            cell.t = 'str';
          } else if (d[6] === 1) cell.v = d[8] ? 'TRUE' : 'FALSE';
          else if (d[6] === 2) cell.v = XLS_ERR[d[8]] ?? '#ERR';
        } else cell.v = num(new DataView(d.buffer, d.byteOffset + 6, 8).getFloat64(0, true), xf);
        setCell(sheet, row, col, { ...cell, v: cell.v || ' ' });
        if (pendingString) pendingString.ref = refOf(row, col);
        break;
      }
      case 0x0207:
        if (pendingString?.ref) {
          const c = sheet.cells.get(pendingString.ref);
          if (c) c.v = xlString(d, 0);
          if (c && !c.v) sheet.cells.delete(pendingString.ref);
        }
        pendingString = null;
        break;
      case 0x0208: if (r32(12) & 0x20) sheet.hiddenRows.add(row); break;
      case 0x007d: if (r16(8) & 1) for (let c = r16(0); c <= Math.min(r16(2), r16(0) + 300); c++) sheet.hiddenCols.add(c); break;
      default: break;
    }
  }
  // 計算結果が空の数式（" " で仮置きしたもの）を戻す
  for (const s of sheets) for (const [k, c] of s.cells) if (c.v === ' ' && c.f) c.v = '';
  // グラフだけのシートなどは除く
  const list = sheets.filter((s, i) => (bounds[i]?.kind ?? 0) === 0);
  return { format: 'xls', info: `${list.length} シート（Excel 97-2003 形式）`, sheets: list };
}

// ---------- 比較 ----------
// 比べるときだけ表記をそろえる（CSV の 2026-11-02 9:30 と Excel の 2026/11/02 09:30:00 など）
function norm(v) {
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(v);
  if (!m) return v;
  const p = (x) => String(+x).padStart(2, '0');
  return `${m[1]}/${p(m[2])}/${p(m[3])}${m[4] != null ? ` ${p(m[4])}:${m[5]}:${p(m[6] ?? 0)}` : ''}`;
}
const formulaKey = (c) => (c ? c.fkey ?? c.f ?? '' : '');

export function compareSheets(a, b) {
  const refs = new Set([...a.cells.keys(), ...b.cells.keys()]);
  const changes = [];
  for (const ref of refs) {
    const ca = a.cells.get(ref), cb = b.cells.get(ref);
    const va = ca?.v ?? '', vb = cb?.v ?? '';
    const fa = ca?.f ?? null, fb = cb?.f ?? null;
    const ka = formulaKey(ca), kb = formulaKey(cb);
    const formulaChanged = ka !== kb && ka !== 'shared' && kb !== 'shared';
    const same = norm(va) === norm(vb);
    if (same && !formulaChanged) continue;
    const kind = !ca || (va === '' && !fa) ? 'add' : !cb || (vb === '' && !fb) ? 'del' : same ? 'formula' : 'mod';
    changes.push({ ref, ...parseRef(ref), kind, a: va, b: vb, fa, fb });
  }
  changes.sort((x, y) => x.r - y.r || x.c - y.c);
  const comments = [];
  for (const ref of new Set([...a.comments.keys(), ...b.comments.keys()])) {
    const x = a.comments.get(ref) ?? '', y = b.comments.get(ref) ?? '';
    if (x !== y) comments.push({ ref, a: x, b: y });
  }
  const setDiff = (x, y) => [...x].filter((v) => !y.has(v)).sort((p, q) => p - q);
  return {
    changes, comments,
    hiddenRows: { added: setDiff(b.hiddenRows, a.hiddenRows), removed: setDiff(a.hiddenRows, b.hiddenRows) },
    hiddenCols: { added: setDiff(b.hiddenCols, a.hiddenCols), removed: setDiff(a.hiddenCols, b.hiddenCols) },
    state: a.state !== b.state ? { a: a.state, b: b.state } : null,
  };
}

// シートの対応づけ：名前が同じもの同士。どちらかが1シート（CSV など）なら先頭同士
export function compareBooks(A, B) {
  const pairs = [], onlyA = [], onlyB = [];
  if (A.sheets.length === 1 || B.sheets.length === 1 || A.format === 'CSV' || B.format === 'CSV') {
    const sa = A.sheets[0], sb = B.sheets[0];
    if (sa && sb) pairs.push({ a: sa, b: sb, ...compareSheets(sa, sb) });
    onlyA.push(...A.sheets.slice(1));
    onlyB.push(...B.sheets.slice(1));
  } else {
    const used = new Set();
    for (const sa of A.sheets) {
      const sb = B.sheets.find((x) => x.name === sa.name);
      if (sb) {
        used.add(sb);
        pairs.push({ a: sa, b: sb, ...compareSheets(sa, sb) });
      } else onlyA.push(sa);
    }
    onlyB.push(...B.sheets.filter((s) => !used.has(s)));
  }
  return { pairs, onlyA, onlyB };
}

// 行をタブ区切りの文字列にする（行単位の差分用）
export function sheetLines(s) {
  const out = [];
  for (let r = 0; r <= s.maxRow; r++) {
    const row = [];
    for (let c = 0; c <= s.maxCol; c++) row.push(s.cells.get(refOf(r, c))?.v ?? '');
    while (row.length && row[row.length - 1] === '') row.pop();
    out.push(row.join('\t'));
  }
  return out;
}

// CTF で見落としやすい「隠れた場所」
export function hiddenStuff(book) {
  const out = [];
  for (const s of book.sheets) {
    if (s.state !== 'visible') out.push(`シート「${s.name}」が${s.state === 'veryHidden' ? '「非常に非表示」（Excel の画面からは再表示できない）' : '非表示'}になっています`);
    if (s.hiddenRows.size) out.push(`「${s.name}」に非表示の行があります（${[...s.hiddenRows].slice(0, 10).map((r) => r + 1).join(', ')}${s.hiddenRows.size > 10 ? ' …' : ''} 行目）`);
    if (s.hiddenCols.size) out.push(`「${s.name}」に非表示の列があります（${[...s.hiddenCols].slice(0, 10).map(colName).join(', ')}${s.hiddenCols.size > 10 ? ' …' : ''}）`);
    if (s.comments.size) out.push(`「${s.name}」にコメント（メモ）が ${s.comments.size} 件あります`);
  }
  return out;
}
