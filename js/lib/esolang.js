// 難解プログラミング言語の実行器：Whitespace・Brainfuck・Ook!
// どれも上限ステップ数つきで、無限ループでも止まる。

// ---------- Whitespace（スペース・タブ・改行だけが命令。ほかの文字はコメント） ----------
export function wsParse(src) {
  const s = [...src].filter((c) => c === ' ' || c === '\t' || c === '\n');
  let p = 0;
  const tok = () => {
    if (p >= s.length) throw new Error('命令の途中でプログラムが終わりました（空白やタブがコピーで消えた可能性）');
    return s[p++];
  };
  const num = () => {
    const sign = tok() === '\t' ? -1n : 1n;
    let v = 0n;
    for (let c = tok(); c !== '\n'; c = tok()) v = v * 2n + (c === '\t' ? 1n : 0n);
    return sign * v;
  };
  const label = () => { let l = ''; for (let c = tok(); c !== '\n'; c = tok()) l += c === ' ' ? 'S' : 'T'; return l; };
  const prog = [];
  const bad = (code) => { throw new Error(`知らない命令 ${code.replace(/ /g, 'S').replace(/\t/g, 'T').replace(/\n/g, 'L')}（${prog.length + 1} 個目）`); };
  while (p < s.length) {
    const a = tok();
    if (a === ' ') {
      const b = tok();
      if (b === ' ') prog.push(['push', num()]);
      else if (b === '\n') { const c = tok(); prog.push([{ ' ': 'dup', '\t': 'swap', '\n': 'drop' }[c]]); }
      else { const c = tok(); if (c === ' ') prog.push(['copy', num()]); else if (c === '\n') prog.push(['slide', num()]); else bad(a + b + c); }
    } else if (a === '\t') {
      const b = tok();
      if (b === ' ') { const c = tok() + tok(); const op = { '  ': 'add', ' \t': 'sub', ' \n': 'mul', '\t ': 'div', '\t\t': 'mod' }[c]; if (!op) bad(a + b + c); prog.push([op]); }
      else if (b === '\t') { const c = tok(); if (c === '\n') bad(a + b + c); prog.push([c === ' ' ? 'store' : 'retrieve']); }
      else { const c = tok() + tok(); const op = { '  ': 'outc', ' \t': 'outn', '\t ': 'inc', '\t\t': 'inn' }[c]; if (!op) bad(a + b + c); prog.push([op]); }
    } else {
      const b = tok() + tok();
      if (b === '\n\n') prog.push(['end']);
      else { const op = { '  ': 'mark', ' \t': 'call', ' \n': 'jmp', '\t ': 'jz', '\t\t': 'jn', '\t\n': 'ret' }[b]; if (!op) bad(a + b); prog.push(op === 'ret' ? [op] : [op, label()]); }
    }
  }
  return prog;
}

export function wsRun(src, input = '', maxSteps = 2_000_000) {
  const prog = wsParse(src);
  const labels = new Map();
  prog.forEach((ins, i) => { if (ins[0] === 'mark') labels.set(ins[1], i); });
  const st = [], heap = new Map(), cs = [];
  const inp = [...input];
  let pc = 0, steps = 0, out = '';
  const pop = () => { if (!st.length) throw new Error(`スタックが空です（${pc} 個目の命令）`); return st.pop(); };
  const jump = (l) => { if (!labels.has(l)) throw new Error(`ラベル ${l} が見つかりません`); pc = labels.get(l); };
  while (pc < prog.length) {
    if (++steps > maxSteps) return { out, steps, prog, error: `${maxSteps.toLocaleString()} ステップで打ち切りました（無限ループの可能性）` };
    const [op, arg] = prog[pc++];
    switch (op) {
      case 'push': st.push(arg); break;
      case 'dup': { const v = pop(); st.push(v, v); break; }
      case 'swap': { const b = pop(), a = pop(); st.push(b, a); break; }
      case 'drop': pop(); break;
      case 'copy': st.push(st[st.length - 1 - Number(arg)] ?? 0n); break;
      case 'slide': { const t = pop(); st.splice(Math.max(0, st.length - Number(arg))); st.push(t); break; }
      case 'add': case 'sub': case 'mul': case 'div': case 'mod': {
        const b = pop(), a = pop();
        if ((op === 'div' || op === 'mod') && b === 0n) throw new Error('0 で割りました');
        st.push(op === 'add' ? a + b : op === 'sub' ? a - b : op === 'mul' ? a * b : op === 'div' ? a / b : a % b);
        break;
      }
      case 'store': { const v = pop(), a = pop(); heap.set(a, v); break; }
      case 'retrieve': st.push(heap.get(pop()) ?? 0n); break;
      case 'outc': out += String.fromCodePoint(Number(pop())); break;
      case 'outn': out += pop().toString(); break;
      case 'inc': heap.set(pop(), BigInt(inp.length ? inp.shift().codePointAt(0) : -1)); break;
      case 'inn': {
        let line = '';
        while (inp.length && inp[0] !== '\n') line += inp.shift();
        if (inp.length) inp.shift();
        heap.set(pop(), BigInt(/^-?\d+$/.test(line.trim()) ? line.trim() : 0));
        break;
      }
      case 'mark': break;
      case 'call': cs.push(pc); jump(arg); break;
      case 'jmp': jump(arg); break;
      case 'jz': if (pop() === 0n) jump(arg); break;
      case 'jn': if (pop() < 0n) jump(arg); break;
      case 'ret': if (!cs.length) throw new Error('戻り先がありません'); pc = cs.pop(); break;
      case 'end': return { out, steps, prog };
    }
  }
  return { out, steps, prog };
}

// 命令の一覧（読める形）
export const wsListing = (prog) => prog.map(([op, arg], i) => `${String(i).padStart(4)}  ${op}${arg === undefined ? '' : ' ' + arg}`).join('\n');

// 空白を見える記号にする（S=スペース T=タブ L=改行）。ほかの文字は薄く残す用に分けて返す
export const wsVisible = (src) => src.replace(/ /g, '·').replace(/\t/g, '→').replace(/\n/g, '↵\n');

// ---------- Brainfuck ----------
export function bfRun(src, input = '', maxSteps = 20_000_000) {
  const code = [...src].filter((c) => '+-<>[].,'.includes(c));
  const jumps = new Map(), stack = [];
  code.forEach((c, i) => {
    if (c === '[') stack.push(i);
    else if (c === ']') { if (!stack.length) throw new Error(`対応する [ がない ]（${i} 文字目）`); const j = stack.pop(); jumps.set(i, j); jumps.set(j, i); }
  });
  if (stack.length) throw new Error('閉じられていない [ があります');
  const mem = new Uint8Array(65536), inp = new TextEncoder().encode(input);
  let ptr = 0, pc = 0, ip = 0, steps = 0;
  const out = [];
  while (pc < code.length) {
    if (++steps > maxSteps) return { out: new TextDecoder().decode(Uint8Array.from(out)), steps, error: `${maxSteps.toLocaleString()} ステップで打ち切りました（無限ループの可能性）` };
    switch (code[pc]) {
      case '+': mem[ptr]++; break;
      case '-': mem[ptr]--; break;
      case '>': ptr = (ptr + 1) & 0xffff; break;
      case '<': ptr = (ptr - 1) & 0xffff; break;
      case '.': out.push(mem[ptr]); break;
      case ',': mem[ptr] = ip < inp.length ? inp[ip++] : 0; break;
      case '[': if (!mem[ptr]) pc = jumps.get(pc); break;
      case ']': if (mem[ptr]) pc = jumps.get(pc); break;
    }
    pc++;
  }
  return { out: new TextDecoder().decode(Uint8Array.from(out)), steps };
}

// ---------- Ook!（Brainfuck の言い換え） ----------
const OOK = { 'Ook. Ook?': '>', 'Ook? Ook.': '<', 'Ook. Ook.': '+', 'Ook! Ook!': '-', 'Ook! Ook.': '.', 'Ook. Ook!': ',', 'Ook! Ook?': '[', 'Ook? Ook!': ']' };
export function ookToBf(src) {
  const t = src.match(/Ook[.?!]/g) || [];
  if (t.length % 2) throw new Error('Ook の数が奇数です');
  let bf = '';
  for (let i = 0; i < t.length; i += 2) bf += OOK[`${t[i]} ${t[i + 1]}`] ?? '';
  return bf;
}

// 見た目から言語を推測
export function guessEsolang(src) {
  if (/Ook[.?!]\s*Ook[.?!]/.test(src)) return 'ook';
  const bf = (src.match(/[+\-<>[\].,]/g) || []).length, vis = src.replace(/\s/g, '').length;
  if (vis && bf / vis > 0.8 && /[[\]]/.test(src)) return 'bf';
  const ws = (src.match(/[ \t]/g) || []).length, tabs = (src.match(/\t/g) || []).length;
  if (tabs >= 3 && (ws / Math.max(src.length, 1) > 0.25 || /[ \t]+$/m.test(src))) return 'ws';
  return null;
}
