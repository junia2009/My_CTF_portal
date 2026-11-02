// RSA の計算と、CTF で定番の弱い設定のチェック（すべて BigInt で計算）

export function parseBig(s) {
  const t = String(s ?? '').trim().replace(/[\s_,]/g, '');
  if (!t) return null;
  if (/^0x[0-9a-f]+$/i.test(t) || /^\d+$/.test(t)) return BigInt(t);
  if (/^[0-9a-f]+$/i.test(t)) return BigInt('0x' + t);
  throw new Error(`数値として読めません: ${t.slice(0, 20)}…`);
}

export const bitLength = (n) => (n <= 0n ? 0 : n.toString(2).length);

export function modPow(b, e, m) {
  let r = 1n;
  b %= m;
  if (b < 0n) b += m;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return r;
}

export function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a < 0n ? -a : a;
}

export function modInv(a, m) {
  let [r0, r1, s0, s1] = [((a % m) + m) % m, m, 1n, 0n];
  while (r1) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  if (r0 !== 1n) throw new Error('逆元が存在しません（e と φ(n) が互いに素ではありません）');
  return ((s0 % m) + m) % m;
}

// floor(n^(1/k))
export function iroot(n, k) {
  if (n < 0n) throw new Error('負の数の根は求められません');
  if (n < 2n) return n;
  const K = BigInt(k);
  let x = 1n << BigInt(Math.ceil(bitLength(n) / k));
  for (;;) {
    const y = ((K - 1n) * x + n / x ** (K - 1n)) / K;
    if (y >= x) return x;
    x = y;
  }
}

export function isProbablePrime(n) {
  if (n < 2n) return false;
  const small = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];
  for (const p of small) if (n % p === 0n) return n === p;
  let d = n - 1n, s = 0;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    s++;
  }
  outer: for (const a of small) {
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let i = 1; i < s; i++) {
      x = (x * x) % n;
      if (x === n - 1n) continue outer;
    }
    return false;
  }
  return true;
}

export function intToBytes(m) {
  let h = m.toString(16);
  if (h.length % 2) h = '0' + h;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}

// ---------- 素因数分解の試み ----------
export function trialDivision(n, limit = 200000) {
  const sieve = new Uint8Array(limit + 1);
  for (let i = 2; i <= limit; i++) {
    if (sieve[i]) continue;
    const p = BigInt(i);
    if (p * p > n) return null;
    if (n % p === 0n) return p;
    for (let j = i * i; j <= limit; j += i) sieve[j] = 1;
  }
  return null;
}

// p と q が近いときに有効
// 平方数になりえない値を剰余で素早くふるい落とす
const SQ_MODS = [64, 63, 65, 11].map((m) => {
  const ok = new Uint8Array(m);
  for (let i = 0; i < m; i++) ok[(i * i) % m] = 1;
  return [BigInt(m), ok];
});
function isSquare(v) {
  for (const [m, ok] of SQ_MODS) if (!ok[Number(v % m)]) return null;
  const r = iroot(v, 2);
  return r * r === v ? r : null;
}

export function fermat(n, iterations = 300000) {
  if (n % 2n === 0n) return [2n, n / 2n];
  let x = iroot(n, 2);
  if (x * x === n) return [x, x];
  x += 1n;
  let y2 = x * x - n;
  for (let i = 0; i < iterations; i++) {
    const y = isSquare(y2);
    if (y !== null) return [x - y, x + y];
    y2 += 2n * x + 1n;
    x += 1n;
  }
  return null;
}

// d が小さいときに有効（連分数展開）
export function wiener(e, n) {
  let [num, den] = [e, n];
  const cf = [];
  while (den) {
    const q = num / den;
    cf.push(q);
    [num, den] = [den, num - q * den];
  }
  let [h1, h2, k1, k2] = [1n, 0n, 0n, 1n];
  for (const q of cf) {
    [h1, h2] = [q * h1 + h2, h1];
    [k1, k2] = [q * k1 + k2, k1];
    const k = h1, d = k1;
    if (k === 0n || (e * d - 1n) % k !== 0n) continue;
    const phi = (e * d - 1n) / k;
    const s = n - phi + 1n;
    const disc = s * s - 4n * n;
    if (disc < 0n) continue;
    const r = iroot(disc, 2);
    if (r * r === disc && (s + r) % 2n === 0n) {
      const p = (s + r) / 2n, q2 = (s - r) / 2n;
      if (p * q2 === n) return { d, p, q: q2 };
    }
  }
  return null;
}

// e が小さく m^e が n をほとんど超えないとき、c(+kn) の e 乗根で m が求まる
export function smallE(c, e, n, maxK = 2000) {
  if (e > 65537n) return null;
  const E = Number(e);
  let v = c;
  for (let k = 0; k <= maxK; k++) {
    const m = iroot(v, E);
    if (m ** e === v) return { m, k };
    if (!n) break;
    v += n;
  }
  return null;
}

// ---------- まとめて解く ----------
export function solveRsa(input) {
  const v = Object.fromEntries(Object.entries(input).map(([k, x]) => [k, typeof x === 'bigint' ? x : parseBig(x)]));
  let { n, e, c, p, q, d } = v;
  const log = [];
  let phi = null;
  if (!e) e = 65537n;

  if (p && q && !n) {
    n = p * q;
    log.push('n = p × q を計算しました');
  }
  if (n && p && !q) {
    if (n % p !== 0n) throw new Error('p が n を割り切りません');
    q = n / p;
    log.push('q = n / p を計算しました');
  }
  if (n && q && !p) {
    if (n % q !== 0n) throw new Error('q が n を割り切りません');
    p = n / q;
    log.push('p = n / q を計算しました');
  }

  // e が小さいときは、まず安く試せる「e 乗根」を確認する
  if (c != null && !d && !p && e <= 17n) {
    const r = smallE(c, e, n);
    if (r) {
      log.push(r.k ? `小さい e の攻撃: (c + ${r.k}n) の ${e} 乗根で復号しました` : `小さい e の攻撃: c の ${e} 乗根で復号しました（m^e < n）`);
      return { n, e, c, p, q, d, phi, m: r.m, log };
    }
  }

  if (!d && !p && n) {
    if (isProbablePrime(n)) {
      phi = n - 1n;
      log.push('n 自体が素数でした → φ(n) = n − 1');
    } else {
      const f = trialDivision(n);
      if (f) {
        [p, q] = [f, n / f];
        log.push(`小さい素因数が見つかりました: ${f}`);
      }
    }
    if (!phi && !p) {
      const w = wiener(e, n);
      if (w) {
        ({ d, p, q } = w);
        log.push('Wiener 攻撃で d が見つかりました（d が小さすぎます）');
      }
    }
    if (!phi && !p && !d) {
      const f = fermat(n);
      if (f) {
        [p, q] = f;
        log.push('Fermat 法で分解できました（p と q が近すぎます）');
      }
    }
  }

  if (!d && p && q) {
    phi = p === q ? p * (p - 1n) : (p - 1n) * (q - 1n);
    log.push('φ(n) を計算しました');
  }
  if (!d && phi) {
    d = modInv(e, phi);
    log.push('d = e⁻¹ mod φ(n) を計算しました');
  }

  let m = null;
  if (c != null && d && n) {
    m = modPow(c, d, n);
    log.push('m = c^d mod n で復号しました');
  } else if (c != null) {
    const r = smallE(c, e, n);
    if (r) {
      m = r.m;
      log.push(r.k ? `小さい e の攻撃: (c + ${r.k}n) の ${e} 乗根で復号しました` : `小さい e の攻撃: c の ${e} 乗根で復号しました（m^e < n）`);
    }
  }
  if (!m && !d) log.push('解けませんでした。p / q / d のどれかが分かれば復号できます');
  return { n, e, c, p, q, d, phi, m, log };
}
