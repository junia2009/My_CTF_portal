// 差分：Myers のアルゴリズムで、行（または文字）単位の違いを求める

export function diffSeq(a, b, { maxD = 4000 } = {}) {
  const n = a.length, m = b.length, max = n + m;
  const off = max + 1;
  let v = new Int32Array(2 * max + 3);
  const trace = [];
  let found = -1;
  for (let d = 0; d <= Math.min(max, maxD); d++) {
    trace.push(v.slice(off - d - 1, off + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[off + k] = x;
      if (x >= n && y >= m) {
        found = d;
        break;
      }
    }
    if (found >= 0) break;
  }
  if (found < 0) {
    // 違いが多すぎるときは、全部削除して全部追加したことにする
    return [...a.map((t) => ({ type: 'del', text: t })), ...b.map((t) => ({ type: 'add', text: t }))];
  }
  // 経路をさかのぼる
  const ops = [];
  let x = n, y = m;
  for (let d = found; d > 0; d--) {
    const tv = trace[d]; // v の [off-d-1, off+d+1] を保存したもの
    const get = (k) => tv[k + d + 1];
    const k = x - y;
    const prevK = k === -d || (k !== d && get(k - 1) < get(k + 1)) ? k + 1 : k - 1;
    const prevX = get(prevK), prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      x--;
      y--;
      ops.push({ type: 'eq', text: a[x] });
    }
    if (x === prevX) ops.push({ type: 'add', text: b[--y] });
    else ops.push({ type: 'del', text: a[--x] });
  }
  while (x > 0 && y > 0) {
    x--;
    y--;
    ops.push({ type: 'eq', text: a[x] });
  }
  return ops.reverse();
}

export const diffLines = (a, b) => diffSeq(a.split(/\r?\n/), b.split(/\r?\n/));
export const diffChars = (a, b) => diffSeq(Array.from(a), Array.from(b));

// 同じ長さのバイト列の、違う位置と XOR
export function diffBytes(a, b) {
  const n = Math.max(a.length, b.length);
  const positions = [];
  const xor = new Uint8Array(Math.min(a.length, b.length));
  for (let i = 0; i < n; i++) {
    if (i < xor.length) xor[i] = a[i] ^ b[i];
    if (a[i] !== b[i]) positions.push(i);
  }
  return { positions, xor };
}

// バイナリの比較：同じ位置どうしで比べ、違いのある 16 バイトの行（前後 context 行つき）を返す
export function hexDiffRows(a, b, { width = 16, context = 1, maxRows = 600 } = {}) {
  const n = Math.max(a.length, b.length);
  const rows = Math.ceil(n / width);
  const diffRow = new Uint8Array(rows);
  let diffCount = 0, first = -1;
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      diffRow[(i / width) | 0] = 1;
      diffCount++;
      if (first < 0) first = i;
    }
  }
  const show = new Uint8Array(rows);
  for (let r = 0; r < rows; r++) if (diffRow[r]) for (let k = Math.max(0, r - context); k <= Math.min(rows - 1, r + context); k++) show[k] = 1;
  const out = [];
  let prev = -2, truncated = false;
  for (let r = 0; r < rows; r++) {
    if (!show[r]) continue;
    if (out.length >= maxRows) {
      truncated = true;
      break;
    }
    if (r !== prev + 1 && out.length) out.push({ gap: true });
    out.push({ off: r * width, a: a.subarray(r * width, r * width + width), b: b.subarray(r * width, r * width + width), diff: !!diffRow[r] });
    prev = r;
  }
  return { rows: out, diffCount, first, truncated };
}

// 挿入・削除のあるバイナリ：バイト列として差分を取り、まとまった範囲で返す
export function byteRanges(a, b, { maxD = 2000 } = {}) {
  const ops = diffSeq(Array.from(a), Array.from(b), { maxD });
  const out = [];
  let ia = 0, ib = 0;
  for (const o of ops) {
    const last = out[out.length - 1];
    if (o.type === 'eq') {
      ia++;
      ib++;
      continue;
    }
    const at = o.type === 'del' ? ia : ib;
    if (last && last.type === o.type && last.end === at && (o.type === 'del' ? last.offB === ib : last.offA === ia)) {
      last.bytes.push(o.text);
      last.end++;
    } else out.push({ type: o.type, offA: ia, offB: ib, end: at + 1, bytes: [o.text] });
    if (o.type === 'del') ia++;
    else ib++;
  }
  // 同じ場所での「削除＋追加」は「置き換え」としてまとめる
  const merged = [];
  for (const { end, ...r } of out) {
    const last = merged[merged.length - 1];
    const bytes = Uint8Array.from(r.bytes);
    if (last && last.type === 'del' && r.type === 'add' && r.offA === last.offA + last.bytes.length && r.offB === last.offB) {
      merged[merged.length - 1] = { type: 'rep', offA: last.offA, offB: last.offB, bytes, old: last.bytes };
    } else merged.push({ ...r, bytes });
  }
  return merged;
}

// テキストとして扱えるか（NUL を含まず、UTF-8 として正しい）
export function asText(bytes, limit = 2 << 20) {
  if (bytes.length > limit || bytes.includes(0)) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}
