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
