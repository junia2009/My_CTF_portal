// 数論計算（すべて BigInt）：GCD・拡張ユークリッド・逆元・中国剰余定理・素因数分解・オイラーのφ
import { gcd, modInv, modPow, isProbablePrime, iroot, parseBig, trialDivision } from './rsa.js';

export { gcd, modInv, modPow, isProbablePrime, iroot, parseBig };

const mod = (a, n) => ((a % n) + n) % n;
const abs = (a) => (a < 0n ? -a : a);

export function egcd(a, b) {
  let [r0, r1, s0, s1, t0, t1] = [a, b, 1n, 0n, 0n, 1n];
  while (r1) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
    [t0, t1] = [t1, t0 - q * t1];
  }
  return { g: r0, x: s0, y: t0 };
}

export const lcm = (a, b) => (a === 0n || b === 0n ? 0n : abs(a / gcd(a, b) * b));

// 中国剰余定理：x ≡ r[i] (mod m[i])。法が互いに素でなくても、矛盾が無ければ解く
export function crt(residues, moduli) {
  if (residues.length !== moduli.length || !residues.length) throw new Error('余りと法の数をそろえてください');
  let x = 0n, m = 1n;
  for (let i = 0; i < residues.length; i++) {
    const n = moduli[i];
    if (n <= 0n) throw new Error('法は正の整数にしてください');
    const a = mod(residues[i], n);
    const { g, x: p } = egcd(m, n);
    if ((a - x) % g !== 0n) throw new Error(`解なし：${i + 1} 番目の式が、それまでの式と矛盾します`);
    const l = m / g * n;
    const t = mod((a - x) / g * p, n / g);
    x = mod(x + m * t, l);
    m = l;
  }
  return { x, m };
}

// Pollard の ρ 法（Brent 版）。見つからなければ null
function pollardRho(n, deadline) {
  if (n % 2n === 0n) return 2n;
  for (let c = 1n; c < 30n; c++) {
    let y = 2n, r = 1n, q = 1n, g = 1n, x = 0n, ys = 0n;
    const f = (v) => (v * v + c) % n;
    const m = 128n;
    while (g === 1n) {
      x = y;
      for (let i = 0n; i < r; i++) y = f(y);
      let k = 0n;
      while (k < r && g === 1n) {
        ys = y;
        const lim = m < r - k ? m : r - k;
        for (let i = 0n; i < lim; i++) {
          y = f(y);
          q = (q * abs(x - y)) % n;
        }
        g = gcd(q, n);
        k += m;
        if (Date.now() > deadline) return null;
      }
      r *= 2n;
    }
    if (g === n) {
      do {
        ys = f(ys);
        g = gcd(abs(x - ys), n);
      } while (g === 1n);
    }
    if (g !== n) return g;
  }
  return null;
}

// 素因数分解。時間内に分解しきれなかった合成数は rest に入れて返す
export function factorize(input, { timeLimitMs = 4000 } = {}) {
  let n = abs(input);
  const factors = new Map();
  const rest = [];
  const add = (p) => factors.set(p, (factors.get(p) ?? 0n) + 1n);
  if (n < 2n) return { factors, rest, complete: true };
  // 小さい素数で割れるだけ割る
  for (;;) {
    const p = trialDivision(n, 100000);
    if (!p) break;
    while (n % p === 0n) {
      add(p);
      n /= p;
    }
  }
  const deadline = Date.now() + timeLimitMs;
  const stack = n > 1n ? [n] : [];
  while (stack.length) {
    const v = stack.pop();
    if (v === 1n) continue;
    if (isProbablePrime(v)) {
      add(v);
      continue;
    }
    const r = iroot(v, 2);
    if (r * r === v) {
      stack.push(r, r);
      continue;
    }
    const d = pollardRho(v, deadline);
    if (!d || d === v) {
      rest.push(v);
      continue;
    }
    stack.push(d, v / d);
  }
  return { factors: new Map([...factors].sort((a, b) => (a[0] < b[0] ? -1 : 1))), rest, complete: rest.length === 0 };
}

export function phiFromFactors(factors) {
  let phi = 1n;
  for (const [p, e] of factors) phi *= (p - 1n) * p ** (e - 1n);
  return phi;
}

export const formatFactors = (factors) =>
  [...factors].map(([p, e]) => (e > 1n ? `${p}^${e}` : `${p}`)).join(' × ');
