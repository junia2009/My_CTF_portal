// バイト列変換：バイト列を整数・浮動小数として読む / Python の struct 形式で読む

const TYPES = [
  ['u8', 1, (v, o) => v.getUint8(o)],
  ['i8', 1, (v, o) => v.getInt8(o)],
  ['u16', 2, (v, o, le) => v.getUint16(o, le)],
  ['i16', 2, (v, o, le) => v.getInt16(o, le)],
  ['u32', 4, (v, o, le) => v.getUint32(o, le)],
  ['i32', 4, (v, o, le) => v.getInt32(o, le)],
  ['u64', 8, (v, o, le) => v.getBigUint64(o, le)],
  ['i64', 8, (v, o, le) => v.getBigInt64(o, le)],
  ['f32', 4, (v, o, le) => v.getFloat32(o, le)],
  ['f64', 8, (v, o, le) => v.getFloat64(o, le)],
];

const view = (bytes) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const fmtNum = (x) => (typeof x === 'number' && !Number.isInteger(x) ? Number(x.toPrecision(10)).toString() : String(x));

// offset の位置を、各型でリトル / ビッグエンディアンとして読む
export function readValues(bytes, offset = 0) {
  const v = view(bytes);
  return TYPES.filter(([, size]) => offset + size <= bytes.length).map(([name, size, get]) => ({
    type: name,
    size,
    le: fmtNum(get(v, offset, true)),
    be: size === 1 ? null : fmtNum(get(v, offset, false)),
  }));
}

// Python の struct.unpack 互換（アラインメントなし）。例: "<IHB", ">2I4s"
const CODES = {
  x: [1, null], c: [1, 'char'], b: [1, 'i8'], B: [1, 'u8'], '?': [1, 'bool'],
  h: [2, 'i16'], H: [2, 'u16'], i: [4, 'i32'], I: [4, 'u32'], l: [4, 'i32'], L: [4, 'u32'],
  q: [8, 'i64'], Q: [8, 'u64'], e: [2, 'f16'], f: [4, 'f32'], d: [8, 'f64'], s: [1, 'bytes'],
};

function f16(u) {
  const s = u >> 15 ? -1 : 1, e = (u >> 10) & 31, m = u & 1023;
  if (e === 0) return s * 2 ** -14 * (m / 1024);
  if (e === 31) return m ? NaN : s * Infinity;
  return s * 2 ** (e - 15) * (1 + m / 1024);
}

export function unpack(fmt, bytes, offset = 0) {
  let f = fmt.replace(/\s+/g, '');
  let le = true;
  if (/^[<>!=@]/.test(f)) {
    le = !(f[0] === '>' || f[0] === '!');
    f = f.slice(1);
  }
  const v = view(bytes);
  const values = [];
  let o = offset;
  for (const m of f.matchAll(/(\d*)([a-zA-Z?])/g)) {
    const count = m[1] ? parseInt(m[1], 10) : 1;
    const def = CODES[m[2]];
    if (!def) throw new Error(`未対応の形式文字: ${m[2]}`);
    const [size, kind] = def;
    if (kind === 'bytes') {
      if (o + count > bytes.length) throw new Error('データが足りません');
      values.push({ code: `${count}s`, value: bytes.slice(o, o + count) });
      o += count;
      continue;
    }
    for (let i = 0; i < count; i++) {
      if (o + size > bytes.length) throw new Error('データが足りません');
      let val = null;
      if (kind === 'char') val = String.fromCharCode(v.getUint8(o));
      else if (kind === 'bool') val = v.getUint8(o) !== 0;
      else if (kind === 'f16') val = f16(v.getUint16(o, le));
      else if (kind) val = TYPES.find((t) => t[0] === kind)[2](v, o, le);
      if (kind) values.push({ code: m[2], value: val });
      o += size;
    }
  }
  return { values, size: o - offset };
}
