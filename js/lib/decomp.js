// 簡易の疑似コード生成（x86 / x64）
// Ghidra のような本格的な型推定はしない。レジスタの中身を式として追いかけ、
// 比較と分岐から if / while を組み立てて「アセンブリより読みやすい」形にするのが目標
import { stringAt } from './binfmt.js';

// ---------- レジスタ ----------
const FAMILIES = [
  ['rax', 'eax', 'ax', 'al', 'ah'], ['rbx', 'ebx', 'bx', 'bl', 'bh'], ['rcx', 'ecx', 'cx', 'cl', 'ch'], ['rdx', 'edx', 'dx', 'dl', 'dh'],
  ['rsi', 'esi', 'si', 'sil'], ['rdi', 'edi', 'di', 'dil'], ['rbp', 'ebp', 'bp', 'bpl'], ['rsp', 'esp', 'sp', 'spl'],
  ...[8, 9, 10, 11, 12, 13, 14, 15].map((n) => [`r${n}`, `r${n}d`, `r${n}w`, `r${n}b`]),
];
const FAM = new Map();
for (const f of FAMILIES) for (const r of f) FAM.set(r, f[0]);
const REG_RE = new RegExp(`\\b(${[...FAM.keys()].join('|')})\\b`, 'g');
const fam = (r) => FAM.get(r) ?? null;
const SYSV_ARGS = ['rdi', 'rsi', 'rdx', 'rcx', 'r8', 'r9'];
const WIN_ARGS = ['rcx', 'rdx', 'r8', 'r9'];
const VOLATILE_SYSV = ['rax', 'rcx', 'rdx', 'rsi', 'rdi', 'r8', 'r9', 'r10', 'r11'];
const VOLATILE_WIN = ['rax', 'rcx', 'rdx', 'r8', 'r9', 'r10', 'r11'];
const SIZE = { byte: 1, word: 2, dword: 4, qword: 8, xmmword: 16, tbyte: 10 };
const TYPE = { 1: 'uint8_t', 2: 'uint16_t', 4: 'int32_t', 8: 'int64_t' };

// よく使うライブラリ関数の引数の数（'fmtN' は N 番目が書式文字列）
const ARGC = {
  puts: 1, printf: 'fmt0', fprintf: 'fmt1', sprintf: 'fmt1', snprintf: 'fmt2', dprintf: 'fmt1', scanf: 'fmt0', __isoc99_scanf: 'fmt0', __isoc23_scanf: 'fmt0', sscanf: 'fmt1', __isoc99_sscanf: 'fmt1', __isoc23_sscanf: 'fmt1', fscanf: 'fmt1', __isoc99_fscanf: 'fmt1', __printf_chk: 'fmt1', __fprintf_chk: 'fmt2', __sprintf_chk: 'fmt3',
  fgets: 3, gets: 1, strlen: 1, strcmp: 2, strncmp: 3, memcmp: 3, bcmp: 3, strcasecmp: 2, strcpy: 2, strncpy: 3, strcat: 2, strncat: 3, memcpy: 3, memmove: 3, memset: 3, strcspn: 2, strspn: 2, strchr: 2, strrchr: 2, strstr: 2, strdup: 1, strtok: 2,
  malloc: 1, calloc: 2, realloc: 2, free: 1, exit: 1, _exit: 1, abort: 0, atoi: 1, atol: 1, atoll: 1, strtol: 3, strtoul: 3, strtoll: 3, strtoull: 3, putchar: 1, getchar: 0, fputs: 2, fputc: 2, fgetc: 1, getc: 1, putc: 2, fflush: 1, setvbuf: 4, setbuf: 2,
  read: 3, write: 3, open: 2, close: 1, fopen: 2, fclose: 1, fread: 4, fwrite: 4, lseek: 3, mmap: 6, mprotect: 3, ptrace: 4, sleep: 1, usleep: 1, alarm: 1, signal: 2, srand: 1, rand: 0, random: 0, srandom: 1, time: 1, system: 1, getenv: 1,
  toupper: 1, tolower: 1, isalpha: 1, isdigit: 1, isalnum: 1, isupper: 1, islower: 1, isspace: 1, abs: 1, __stack_chk_fail: 0, getpid: 0, getuid: 0, fork: 0, execve: 3,
  MessageBoxA: 4, MessageBoxW: 4, IsDebuggerPresent: 0, CheckRemoteDebuggerPresent: 2, ExitProcess: 1, GetStdHandle: 1, WriteConsoleA: 5, WriteConsoleW: 5, ReadConsoleA: 5, ReadConsoleW: 5, WriteFile: 5, ReadFile: 5, CreateFileA: 7, CreateFileW: 7, CloseHandle: 1,
  lstrcmpA: 2, lstrcmpW: 2, lstrlenA: 1, lstrlenW: 1, Sleep: 1, VirtualAlloc: 4, VirtualProtect: 4, GetProcAddress: 2, LoadLibraryA: 1, LoadLibraryW: 1, GetModuleHandleA: 1, GetTickCount: 0, OutputDebugStringA: 1, GetDlgItemTextA: 4,
};

// ---------- 式の組み立て ----------
// 括弧が要らない「ひとかたまり」の式か
function atomic(e) {
  const deref = /^\*\(\w+\*\)/.exec(e);
  if (deref) return atomic(e.slice(deref[0].length));
  if (/^[A-Za-z_][\w.]*(\[[^\[\]]*\])?$/.test(e) || /^-?(0x[0-9a-f]+|\d+)$/.test(e) || /^"(?:[^"\\]|\\.)*"$/.test(e)) return true;
  const open = e.indexOf('(');
  if (open < 0 || e[e.length - 1] !== ')') return false;
  if (open > 0 && !/^[*&!~-]?[A-Za-z_][\w.]*$/.test(e.slice(0, open)) && !/^\(\w+\*?\)$/.test(e.slice(0, open))) return false;
  let depth = 0;
  for (let i = open; i < e.length; i++) {
    if (e[i] === '"') {
      i++;
      while (i < e.length && e[i] !== '"') i += e[i] === '\\' ? 2 : 1;
      continue;
    }
    if (e[i] === '(') depth++;
    else if (e[i] === ')' && --depth === 0 && i !== e.length - 1) return false;
  }
  return true;
}
const P = (e) => (atomic(e) ? e : `(${e})`);
const num = (v) => {
  const n = BigInt.asIntN(64, BigInt(v));
  if (n < 0n && n > -0x10000n) return String(n);
  if (n >= 0n && n < 10n) return String(n);
  return (n < 0n ? '-0x' + (-n).toString(16) : '0x' + n.toString(16));
};

const NEG = { '==': '!=', '!=': '==', '<': '>=', '>=': '<', '>': '<=', '<=': '>' };
function condText(c) {
  if (c.text) return c.text;
  return `${cmpOperand(c.a)} ${c.op} ${cmpOperand(c.b)}`;
}
// 比較より優先順位の低い演算子（& | ^ ?: など）を含むときだけ括弧で囲む
const cmpOperand = (e) => (atomic(e) || /^[^&|^?<>=!]*$/.test(e) ? e : `(${e})`);
function negate(c) {
  if (c.text) return { text: c.text.startsWith('!') && atomic(c.text.slice(1)) ? c.text.slice(1) : `!${P(c.text)}` };
  return { ...c, op: NEG[c.op] };
}

// ---------- 本体 ----------
export function decompile(prog, start) {
  if (!prog.x86) return { lines: ['// 疑似コードは x86 / x64 のみ対応です。逆アセンブルとグラフで読んでください。'], vars: [] };
  const bin = prog.bin;
  const is64 = bin.bits === 64;
  const win = bin.format === 'PE';
  const ARGS = is64 ? (win ? WIN_ARGS : SYSV_ARGS) : [];
  const VOL = is64 ? (win ? VOLATILE_WIN : VOLATILE_SYSV) : ['rax', 'rcx', 'rdx'];
  const g = prog.cfg(start);
  const blocks = g.blocks;
  const idx = new Map(blocks.map((b, i) => [b.start, i]));
  const vars = new Map(); // 変数名 → サイズ
  const canaryVars = new Set();
  const nm = (n) => prog.names.get(n) ?? null;

  // 呼び出し先の引数の数（自作の関数は、入口で読んでいる引数レジスタから推測）
  const paramCache = prog.paramCache ?? (prog.paramCache = new Map());
  function paramsOf(addr) {
    if (paramCache.has(addr)) return paramCache.get(addr);
    paramCache.set(addr, 0);
    if (!is64) return 0;
    const cg = prog.cfg(addr);
    const live = liveness(cg);
    const entry = live.get(cg.start)?.in ?? new Set();
    let n = 0;
    ARGS.forEach((r, i) => {
      if (entry.has(r)) n = i + 1;
    });
    paramCache.set(addr, n);
    return n;
  }

  // ---------- オペランド ----------
  const split = (o) => {
    const out = [];
    let depth = 0, cur = '';
    for (const ch of o) {
      if (ch === '[') depth++;
      if (ch === ']') depth--;
      if (ch === ',' && depth === 0) {
        out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };
  const parseMem = (op) => {
    const m = /^(?:(\w+) ptr )?(?:(\w+):)?\[([^\]]+)\]$/.exec(op);
    if (!m) return null;
    const size = SIZE[m[1]] ?? 0;
    const seg = m[2] ?? null;
    let base = null, index = null, scale = 1, disp = 0;
    for (const term of m[3].replace(/ - /g, ' + -').split(' + ')) {
      const t = term.trim();
      const sc = /^(\w+)\*(\d)$/.exec(t);
      if (sc) {
        index = sc[1];
        scale = +sc[2];
      } else if (/^-?0x[0-9a-f]+$|^-?\d+$/.test(t)) disp += t.startsWith('-') ? -Number(BigInt(t.slice(1))) : Number(BigInt(t));
      else if (fam(t) || t === 'rip' || t === 'eip') {
        if (base == null) base = t;
        else index = t;
      }
    }
    return { size, seg, base, index, scale, disp };
  };
  const varName = (base, disp) => {
    const f = fam(base);
    if (f === 'rbp') {
      if (disp < 0) return `var_${(-disp).toString(16)}`;
      return `arg_${disp.toString(16)}`;
    }
    if (f === 'rsp') return `stack_${disp.toString(16)}`;
    return null;
  };
  const dataName = (addr, insn) => {
    const s = stringAt(bin, addr, 1);
    if (s != null) return { lit: JSON.stringify(s) };
    const n = prog.nameOf(addr);
    if (n) return { name: n };
    return { name: `data_${addr.toString(16)}` };
  };

  // ---------- 状態 ----------
  let regs, stmts, flags, pushes, outArgs, order;
  const reset = (entryRegs) => {
    regs = new Map(entryRegs ?? []);
    stmts = [];
    flags = null;
    pushes = [];
    outArgs = new Map();
    order = [];
  };
  // 値が分からないレジスタは、64ビットの名前（rax など）で表す
  const regVal = (r, insn) => {
    const f = fam(r);
    if (!f) return r;
    if (regs.has(f)) return regs.get(f);
    return f;
  };
  const setReg = (r, e) => {
    const f = fam(r);
    if (!f || f === 'rsp' || f === 'rbp') return;
    regs.set(f, e);
    order = order.filter((x) => x !== f);
    order.push(f);
  };
  const emit = (s, a) => {
    if (/__canary/.test(s)) return;
    stmts.push({ s, a });
  };
  // メモリの読み書きで、変数の古い値を持っているレジスタを確定させる
  const materialize = (lv) => {
    for (const [f, e] of regs) {
      if (e !== f && new RegExp(`(^|[^\\w])${lv.replace(/[[\]().*+?^$|\\]/g, '\\$&')}([^\\w]|$)`).test(e)) {
        emit(`${f} = ${e};`);
        regs.set(f, f);
      }
    }
  };

  // メモリのオペランド → 式。lea なら「アドレス」、それ以外は「中身」
  function memExpr(op, insn, { addr = false } = {}) {
    const m = parseMem(op);
    if (!m) return null;
    if (m.seg === 'fs' || m.seg === 'gs') {
      if ((m.disp === 0x28 || m.disp === 0x14) && !m.base) return '__canary';
      return `${m.seg}:[${num(m.disp)}]`;
    }
    if (m.base === 'rip' || m.base === 'eip' || (!m.base && !m.index)) {
      const a = m.base ? insn.a + insn.n + m.disp : m.disp >>> 0;
      const d = dataName(a, insn);
      if (addr) return d.lit ?? `&${d.name}`;
      return d.name ?? `*(${TYPE[m.size] ?? 'int64_t'}*)${d.lit}`;
    }
    const v = !m.index ? varName(m.base, m.disp) : null;
    if (v) {
      if (!addr) {
        if (!vars.has(v) || vars.get(v) < m.size) vars.set(v, m.size);
        return canaryVars.has(v) ? '__canary' : v;
      }
      if (!vars.has(v)) vars.set(v, 0);
      return `&${v}`;
    }
    // 一般の形：base + index*scale + disp
    const terms = [];
    if (m.base) {
      const fv = fam(m.base) === 'rbp' || fam(m.base) === 'rsp' ? null : regVal(m.base, insn);
      if (fv != null) terms.push(fv);
      else {
        const vn = varName(m.base, m.disp);
        if (!vars.has(vn)) vars.set(vn, 0);
        terms.push(`&${vn}`);
        m.disp = 0;
      }
    }
    if (m.index) terms.push(m.scale > 1 ? `${P(regVal(m.index, insn))} * ${m.scale}` : regVal(m.index, insn));
    if (m.disp) terms.push(num(m.disp));
    // 配列らしい形にする：&x + i → x[i]
    const arrBase = terms.findIndex((t) => /^&\w+$/.test(t) || /^"/.test(t));
    if (!addr && arrBase >= 0 && terms.length === 2) {
      const other = terms[1 - arrBase];
      const elem = m.scale > 1 && m.index ? P(regVal(m.index, insn)) : other;
      if ((m.scale === m.size || (m.size === 1 && m.scale === 1)) && !/^"/.test(terms[arrBase])) return `${terms[arrBase].slice(1)}[${elem}]`;
    }
    const ptr = terms.join(' + ') || '0';
    if (addr) return ptr;
    const sum = terms.length === 1 && /^([A-Za-z_]\w*) \+ ([^+]+)$/.exec(terms[0]);
    if (m.size === 1 && sum) return `${sum[1]}[${sum[2]}]`;
    if (m.size === 1 && terms.length === 2 && !terms.some((t) => /^-?0x|^\d/.test(t))) return `${P(terms[0])}[${terms[1]}]`;
    return `*(${TYPE[m.size] ?? 'int64_t'}*)${P(ptr)}`;
  }
  const isMem = (op) => /\[/.test(op);
  function val(op, insn) {
    if (isMem(op)) return memExpr(op, insn);
    if (fam(op)) return regVal(op, insn);
    if (/^-?(0x[0-9a-f]+|\d+)$/.test(op)) {
      const v = op.startsWith('-') ? -Number(BigInt(op.slice(1))) : Number(BigInt(op));
      // 即値がデータのアドレスなら名前にする（PIE でない実行ファイル）
      if (v > 0x1000) {
        const r = bin.regions.find((x) => v >= x.addr && v < x.addr + Math.max(x.size, x.vsize));
        if (r) {
          const d = dataName(v, insn);
          return r.exec ? (prog.names.get(v) ?? d.name) : d.lit ?? `&${d.name}`;
        }
      }
      return num(v);
    }
    return op;
  }
  function lval(op, insn) {
    if (isMem(op)) {
      const e = memExpr(op, insn);
      if (e === '__canary') return e;
      return e;
    }
    return op;
  }

  // 代入（メモリなら文、レジスタなら式として持ち越す）
  function assign(dst, e, insn, opText) {
    if (isMem(dst)) {
      const l = lval(dst, insn);
      if (/__canary/.test(e)) {
        const v = /^\w+$/.test(l) ? l : null;
        if (v) canaryVars.add(v);
        return;
      }
      materialize(l);
      if (opText) emit(`${l} ${opText}= ${e};`, insn.a);
      else emit(`${l} = ${e};`, insn.a);
    } else if (fam(dst)) {
      setReg(dst, opText ? `${P(regVal(dst, insn))} ${opText} ${P(e)}` : e);
    }
  }

  const OPS = { add: '+', sub: '-', and: '&', or: '|', xor: '^', shl: '<<', sal: '<<', shr: '>>', sar: '>>', imul: '*' };

  function callArgs(name, target) {
    let n = name && ARGC[name] != null ? ARGC[name] : null;
    const take = (k) => {
      if (is64) return ARGS.slice(0, k).map((r) => regVal(r));
      const list = [];
      if (outArgs.size) {
        const keys = [...outArgs.keys()].sort((x, y) => x - y);
        for (const k2 of keys) list.push(outArgs.get(k2));
      } else list.push(...pushes.slice().reverse());
      return k == null ? list : list.slice(0, k);
    };
    if (typeof n === 'string') {
      const fi = +n.slice(3);
      const all = take(6);
      const fmt = all[fi];
      const cnt = fmt && /^"/.test(fmt) ? (JSON.parse(fmt).replace(/%%/g, '').match(/%[-+ #0]*(\*|\d+)?(\.(\*|\d+))?[hlLqjzt]*[diouxXeEfgGaAcspn]/g) ?? []).length : 0;
      n = fi + 1 + cnt;
    }
    if (n == null && target != null) n = paramsOf(target);
    const args = take(n ?? undefined);
    if (!is64) {
      pushes = [];
      outArgs = new Map();
    }
    return args;
  }

  function step(insn) {
    const m = insn.m.replace(/^(bnd|notrack|lock|rep|repe|repne)\s+/, '');
    const ops = split(insn.o);
    const [d, s, s2] = ops;
    if (/^(endbr|nop|leave|int3|hlt|ud2|pause|fnop|wait)/.test(m)) return;
    if (m === 'push') {
      if (fam(d) && ['rbp', 'rbx', 'rsi', 'rdi', 'r12', 'r13', 'r14', 'r15'].includes(fam(d)) && !regs.has(fam(d))) return;
      if (!is64) pushes.push(val(d, insn));
      return;
    }
    if (m === 'pop') {
      if (fam(d)) regs.delete(fam(d));
      return;
    }
    if (fam(d) === 'rsp' || (fam(d) === 'rbp' && fam(s) === 'rsp')) return;
    if (m === 'mov' || m === 'movzx' || m === 'movsx' || m === 'movsxd' || m === 'movabs' || /^movs[sd]$/.test(m) || m === 'movaps' || m === 'movups' || m === 'movdqa' || m === 'movdqu' || m === 'movq' || m === 'movd') {
      // x86-32 の引数：mov dword ptr [esp + 4], x
      const mm = isMem(d) && parseMem(d);
      if (!is64 && mm && fam(mm.base) === 'rsp' && !mm.index) {
        outArgs.set(mm.disp, val(s, insn));
        return;
      }
      assign(d, val(s, insn), insn);
      return;
    }
    if (m === 'lea') {
      const e = memExpr(s, insn, { addr: true });
      setReg(d, e);
      return;
    }
    if (m === 'cdqe' || m === 'cwde' || m === 'cbw') return;
    if (m === 'cdq' || m === 'cqo' || m === 'cwd') {
      setReg('rdx', `${P(regVal('rax'))} < 0 ? -1 : 0`);
      return;
    }
    if (m === 'xor' && d === s && !isMem(d)) {
      setReg(d, '0');
      flags = { r: '0' };
      return;
    }
    if (m === 'sub' && d === s && !isMem(d)) {
      setReg(d, '0');
      return;
    }
    if (OPS[m] && ops.length === 2) {
      const v = val(s, insn);
      if (m === 'sub' || m === 'add') {
        if (v === '__canary' || /__canary/.test(regVal(d))) {
          flags = { r: '__canary' };
          return;
        }
      }
      assign(d, v, insn, OPS[m]);
      flags = { r: isMem(d) ? lval(d, insn) : regVal(d) };
      return;
    }
    if (m === 'imul' && ops.length === 3) {
      setReg(d, `${P(val(s, insn))} * ${P(val(s2, insn))}`);
      return;
    }
    if (m === 'imul' || m === 'mul') {
      if (ops.length === 1) setReg('rax', `${P(regVal('rax'))} * ${P(val(d, insn))}`);
      return;
    }
    if (m === 'idiv' || m === 'div') {
      const a = regVal('rax'), b = val(d, insn);
      setReg('rax', `${P(a)} / ${P(b)}`);
      setReg('rdx', `${P(a)} % ${P(b)}`);
      return;
    }
    if (m === 'inc' || m === 'dec') {
      assign(d, '1', insn, m === 'inc' ? '+' : '-');
      flags = { r: isMem(d) ? lval(d, insn) : regVal(d) };
      return;
    }
    if (m === 'neg' || m === 'not') {
      if (isMem(d)) emit(`${lval(d, insn)} = ${m === 'neg' ? '-' : '~'}${P(val(d, insn))};`, insn.a);
      else setReg(d, `${m === 'neg' ? '-' : '~'}${P(regVal(d))}`);
      return;
    }
    if (m === 'rol' || m === 'ror') {
      const bits = (parseMem(d)?.size || ({ 3: 1, 2: 2 }[0]) || 0) * 8 || (/^(e|r\d+d)/.test(d) ? 32 : /^r/.test(d) ? 64 : /l$|^[a-d]h$|b$/.test(d) ? 8 : 16);
      const e = `${m.toUpperCase()}${bits}(${val(d, insn)}, ${val(s, insn)})`;
      if (isMem(d)) emit(`${lval(d, insn)} = ${e};`, insn.a);
      else setReg(d, e);
      return;
    }
    if (m === 'cmp') {
      flags = { a: val(d, insn), b: val(s, insn) };
      return;
    }
    if (m === 'test') {
      const a = val(d, insn), b = val(s, insn);
      flags = a === b ? { r: a } : { r: `${P(a)} & ${P(b)}` };
      return;
    }
    if (/^set/.test(m)) {
      setReg(d, condText(jccCond('j' + m.slice(3))));
      return;
    }
    if (/^cmov/.test(m)) {
      setReg(d, `${condText(jccCond('j' + m.slice(4)))} ? ${val(s, insn)} : ${regVal(d)}`);
      return;
    }
    if (m === 'call') {
      const name = prog.callName(insn);
      const target = insn.t;
      const args = callArgs(name, target);
      const fn = name ?? (insn.t != null ? `sub_${insn.t.toString(16)}` : `(*${P(val(d, insn))})`);
      const call = `${fn}(${args.join(', ')})`;
      for (const r of VOL) regs.delete(r);
      order = order.filter((f) => !VOL.includes(f));
      if (name === '__stack_chk_fail') return;
      // 戻り値を使うなら eax に入れる
      setReg('rax', call);
      insn.callExpr = call;
      return;
    }
    if (insn.k === 'jcc' || insn.k === 'jmp' || insn.k === 'ret') return;
    if (/^(movs[bwdq]|stos[bwdq]|scas[bwdq]|cmps[bwdq]|lods[bwdq])$/.test(m)) {
      emit(`__asm("${insn.m} ${insn.o}");  // 文字列命令（${insn.m.startsWith('rep') ? 'memcpy / memset など' : '1要素ずつの処理'}）`, insn.a);
      return;
    }
    // 対応していない命令はそのまま残す
    emit(`__asm("${m}${insn.o ? ' ' + insn.o : ''}");`, insn.a);
    if (d && fam(d)) setReg(d, fam(d));
  }

  // 条件分岐 → 条件式
  function jccCond(m) {
    const f = flags ?? { r: '?' };
    const c = m.replace(/^j/, '');
    const key = { e: 'e', z: 'e', ne: 'ne', nz: 'ne', g: 'g', nle: 'g', ge: 'ge', nl: 'ge', l: 'l', nge: 'l', le: 'le', ng: 'le', a: 'a', nbe: 'a', ae: 'ae', nb: 'ae', nc: 'ae', b: 'b', nae: 'b', c: 'b', be: 'be', na: 'be', s: 's', ns: 'ns' }[c];
    const op = { e: '==', ne: '!=', g: '>', ge: '>=', l: '<', le: '<=', a: '>', ae: '>=', b: '<', be: '<=' }[key];
    if (f.a != null && op) {
      const uns = /^(a|ae|b|be)$/.test(key);
      return { a: uns && !/^-?\d|^0x/.test(f.a) ? `(unsigned)${P(f.a)}` : f.a, op, b: f.b };
    }
    if (f.r != null) {
      if (key === 's') return { a: f.r, op: '<', b: '0' };
      if (key === 'ns') return { a: f.r, op: '>=', b: '0' };
      if (op) return { a: f.r, op: /^(a)$/.test(key) ? '!=' : /^(b)$/.test(key) ? '!=' : op, b: '0' };
    }
    return { text: `/* ${m} */ ?` };
  }

  // ---------- 生存解析（どのレジスタの値がブロックの外で使われるか） ----------
  function rw(insn) {
    const m = insn.m.replace(/^(bnd|notrack|lock|rep|repe|repne)\s+/, '');
    const ops = split(insn.o);
    const reads = new Set(), writes = new Set();
    const regsIn = (t) => (t.match(REG_RE) ?? []).map(fam).filter((f) => f && f !== 'rsp' && f !== 'rbp');
    ops.forEach((op, i) => {
      if (isMem(op)) regsIn(op).forEach((r) => reads.add(r));
      else if (i > 0) regsIn(op).forEach((r) => reads.add(r));
    });
    const d = ops[0];
    if (d && !isMem(d) && fam(d)) {
      const f = fam(d);
      if (/^(mov|movzx|movsx|movsxd|movabs|lea|pop|set|cmov)/.test(m) && !/^cmov/.test(m)) writes.add(f);
      else if (/^(cmp|test|push)$/.test(m)) reads.add(f);
      else if (!(m === 'xor' && ops[1] === d)) {
        reads.add(f);
        writes.add(f);
      } else writes.add(f);
    }
    if (m === 'call') {
      const name = prog.callName(insn);
      let n = name && ARGC[name] != null ? ARGC[name] : null;
      if (typeof n === 'string') n = +n.slice(3) + 1;
      if (n == null) n = insn.t != null && is64 ? paramsOf(insn.t) : 0;
      ARGS.slice(0, n).forEach((r) => reads.add(r));
      VOL.forEach((r) => writes.add(r));
    }
    if (insn.k === 'ret') reads.add('rax');
    if (/^(cdq|cqo|cwd)$/.test(m)) {
      reads.add('rax');
      writes.add('rdx');
    }
    if (/^i?div$/.test(m) || (/^i?mul$/.test(m) && ops.length === 1)) {
      reads.add('rax');
      reads.add('rdx');
      writes.add('rax');
      writes.add('rdx');
    }
    return { reads, writes };
  }
  function liveness(cg) {
    const info = new Map();
    for (const b of cg.blocks) {
      const use = new Set(), def = new Set();
      for (const i of b.insns) {
        const { reads, writes } = rw(i);
        for (const r of reads) if (!def.has(r)) use.add(r);
        for (const w of writes) def.add(w);
      }
      info.set(b.start, { use, def, in: new Set(use), out: new Set() });
    }
    for (let changed = true, guard = 0; changed && guard < 200; guard++) {
      changed = false;
      for (const b of [...cg.blocks].reverse()) {
        const x = info.get(b.start);
        const out = new Set();
        for (const s of b.succ) for (const r of info.get(s.to).in) out.add(r);
        const inn = new Set(x.use);
        for (const r of out) if (!x.def.has(r)) inn.add(r);
        if (inn.size !== x.in.size || out.size !== x.out.size) changed = true;
        x.in = inn;
        x.out = out;
      }
    }
    return info;
  }

  // ---------- ブロックごとに文を作る ----------
  const live = liveness(g);
  const params = is64 ? paramsOf(start) : 0;
  const entryRegs = ARGS.slice(0, params).map((r, i) => [r, `a${i + 1}`]);
  const lifted = new Map();
  for (const b of blocks) {
    reset(b.start === start ? entryRegs : null);
    for (const i of b.insns) step(i);
    const last = b.insns[b.insns.length - 1];
    const res = { stmts, cond: null, rax: regs.get('rax') ?? null, kind: last.k };
    if (last.k === 'jcc') res.cond = jccCond(last.m.replace(/^(bnd|notrack)\s+/, ''));
    // 外で使われるレジスタの値を確定させる（ret と return への合流で使う rax は別扱い）
    const out = live.get(b.start).out;
    for (const f of order) {
      const e = regs.get(f);
      if (e == null || e === f || !out.has(f) || /__canary/.test(e)) continue;
      res.stmts.push({ s: `${f} = ${e};`, a: last.a, regDef: f });
      // 条件式が同じ式を使っていれば、確定させたレジスタ名で置き換える（二重に計算したように見えないように）
      if (res.cond && !res.cond.text) {
        if (res.cond.a === e) res.cond.a = f;
        if (res.cond.b === e) res.cond.b = f;
      }
    }
    // 呼び出しの結果を使わない場合は、呼び出しを文として残す
    for (const i of b.insns) {
      if (!i.callExpr) continue;
      const used = res.stmts.some((x) => x.s.includes(i.callExpr)) || (res.cond && condText(res.cond).includes(i.callExpr)) || (res.rax && res.rax.includes(i.callExpr) && (last.k === 'ret' || out.has('rax')));
      if (!used) res.stmts.splice(insertPos(res.stmts, i.a), 0, { s: `${i.callExpr};`, a: i.a });
      delete i.callExpr;
    }
    lifted.set(b.start, res);
  }
  function insertPos(list, a) {
    let p = 0;
    while (p < list.length && (list[p].a ?? 0) <= a && !list[p].regDef) p++;
    return p;
  }

  // ---------- return への合流・スタック保護の判定 ----------
  const isReturnBlock = (b) => {
    const l = lifted.get(b.start);
    return l.kind === 'ret' && l.stmts.length === 0;
  };
  const isCanary = (b) => {
    const l = lifted.get(b.start);
    return l.cond && /__canary/.test(condText(l.cond)) && l.stmts.length === 0;
  };
  const canaryPass = (b) => {
    // __stack_chk_fail を呼ばない側へ進む
    for (const s of b.succ) {
      const t = blocks[idx.get(s.to)];
      const callsFail = t.insns.some((i) => i.k === 'call' && prog.callName(i) === '__stack_chk_fail');
      if (!callsFail) return t;
    }
    return null;
  };
  const returnPath = (b, depth = 0) => {
    if (!b || depth > 4) return false;
    if (isReturnBlock(b)) return true;
    if (isCanary(b)) return returnPath(canaryPass(b), depth + 1);
    const l = lifted.get(b.start);
    if (l.stmts.every((x) => x.regDef === 'rax') && b.succ.length === 1 && l.kind !== 'call') return returnPath(blocks[idx.get(b.succ[0].to)], depth + 1);
    return false;
  };
  // 戻り値：合流先のブロックで eax を設定していればそれを、なければ分岐元の値を使う
  const retVia = (from, target) => {
    for (let b = target, k = 0; b && k < 5; k++) {
      const l = lifted.get(b.start);
      if (l.rax != null) return fmtRet(l.rax);
      if (isReturnBlock(b) || b.succ.length !== 1) break;
      b = isCanary(b) ? canaryPass(b) : blocks[idx.get(b.succ[0].to)];
    }
    return fmtRet(lifted.get(from.start).rax);
  };
  const fmtRet = (r) => (r && r !== 'rax' && r !== 'eax' && !/__canary/.test(r) ? `return ${r};` : 'return;');
  const leadsToReturn = (b) => lifted.get(b.start).kind === 'ret' || (b.succ.length > 0 && b.succ.every((x) => returnPath(blocks[idx.get(x.to)])));
  const failBlock = (b) => b.insns.some((i) => i.k === 'call' && prog.callName(i) === '__stack_chk_fail');
  const retText = (b) => {
    const l = lifted.get(b.start);
    const r = l.rax;
    return r && r !== 'rax' && r !== 'eax' && !/__canary/.test(r) ? `return ${r};` : 'return;';
  };

  // ---------- 構造化（if / else / while） ----------
  const out = [];
  const gotoTargets = new Set();
  const label = (a) => `L_${a.toString(16)}`;
  const ind = (n) => '    '.repeat(n);
  const line = (n, s, a) => out.push({ text: ind(n) + s, a });
  const preds = (b) => b.preds;
  const singleEntry = (lo, hi, from, also = null) => {
    for (let k = lo; k < hi; k++) for (const p of preds(blocks[k])) {
      const pi = idx.get(p);
      if (!(pi >= lo && pi < hi) && p !== from && p !== also) return false;
    }
    return true;
  };
  const backEdgeFrom = (h, lo, hi) => {
    // ブロック h へ戻る分岐を持つ、最も後ろのブロック
    let best = -1;
    for (let k = idx.get(h.start); k < hi; k++) if (blocks[k].succ.some((s) => s.to === h.start) && k >= idx.get(h.start)) best = k;
    return best;
  };
  const emitStmts = (b, n) => {
    const skipRax = leadsToReturn(b);
    for (const s of lifted.get(b.start).stmts) if (!(skipRax && s.regDef === 'rax')) line(n, s.s, s.a);
  };
  const succOf = (b, type) => b.succ.find((s) => s.type === type)?.to;

  const skip = new Map();
  skip.add = (a) => skip.set(a, (skip.get(a) ?? 0) + 1);
  function emitRange(lo, hi, n, loop = null, join = null) {
    let i = lo;
    while (i < hi) {
      const b = blocks[i];
      if ((skip.get(b.start) ?? 0) >= b.preds.length && b.preds.length) {
        i++;
        continue;
      }
      const l = lifted.get(b.start);
      out.push({ labelOf: b.start });
      if (isReturnBlock(b) && b.preds.every((p) => returnPath(blocks[idx.get(p)]) || isCanary(blocks[idx.get(p)]) || blocks[idx.get(p)].succ.length)) {
        if (!b.preds.length) line(n, retText(b), b.start);
        i++;
        continue;
      }
      if (isCanary(b) || failBlock(b)) {
        i++;
        continue;
      }
      // ループ：後ろのブロックからここへ戻る分岐がある
      const be = loop?.head === b.start ? -1 : backEdgeFrom(b, lo, hi);
      if (be >= i) {
        const latch = blocks[be];
        const ll = lifted.get(latch.start);
        if (ll.cond && succOf(latch, 'true') === b.start && singleEntry(i + 1, be + 1, null)) {
          // do { ... } while (cond);
          line(n, 'do {', b.start);
          emitRange(i, be, n + 1, { head: b.start, exit: latch.end });
          emitStmts(latch, n + 1);
          line(n, `} while (${condText(ll.cond)});`, latch.insns[latch.insns.length - 1].a);
          i = be + 1;
          continue;
        }
        line(n, 'while (1) {', b.start);
        emitRange(i, be + 1, n + 1, { head: b.start, exit: latch.end });
        line(n, '}');
        i = be + 1;
        continue;
      }
      emitStmts(b, n);
      const last = b.insns[b.insns.length - 1];
      if (l.kind === 'ret') {
        line(n, retText(b), last.a);
        i++;
        continue;
      }
      if (l.kind === 'jcc') {
        const T = succOf(b, 'true'), F = succOf(b, 'false');
        const t = idx.get(T), f = idx.get(F);
        const tb = blocks[t], fb = blocks[f];
        if (isCanary(b)) {
          i++;
          continue;
        }
        // gcc の for / while：条件のブロックが後ろにあり、そこから本体へ戻る
        if (tb && returnPath(tb)) {
          line(n, `if (${condText(l.cond)}) ${retVia(b, tb)}`, last.a);
          skip.add(T);
          i++;
          continue;
        }
        if (fb && returnPath(fb) && f === i + 1) {
          line(n, `if (${condText(negate(l.cond))}) ${retVia(b, fb)}`, last.a);
          skip.add(fb.start); // fb の中身は return に含めた
          i++;
          continue;
        }
        if (loop && T === loop.exit) {
          line(n, `if (${condText(l.cond)}) break;`, last.a);
          i++;
          continue;
        }
        if (loop && T === loop.head) {
          line(n, `if (${condText(l.cond)}) continue;`, last.a);
          i++;
          continue;
        }
        if (t > i + 1 && t <= hi && f === i + 1 && singleEntry(i + 1, t, b.start)) {
          const endB = blocks[t - 1];
          const endL = lifted.get(endB.start);
          const J = endL.kind === 'jmp' ? succOf(endB, 'jmp') : null;
          const j = J != null ? idx.get(J) : -1;
          const thenReturns = J != null && returnPath(blocks[j]);
          if (!thenReturns && j > t && j <= hi && singleEntry(t, j, b.start)) {
            line(n, `if (${condText(negate(l.cond))}) {`, last.a);
            emitRange(i + 1, t, n + 1, loop, J);
            line(n, '} else {');
            emitRange(t, j, n + 1, loop);
            line(n, '}');
            i = j;
            continue;
          }
          line(n, `if (${condText(negate(l.cond))}) {`, last.a);
          emitRange(i + 1, t, n + 1, loop);
          line(n, '}');
          i = t;
          continue;
        }
        gotoTargets.add(T);
        line(n, `if (${condText(l.cond)}) goto ${label(T)};`, last.a);
        i++;
        continue;
      }
      if (l.kind === 'jmp') {
        const T = succOf(b, 'jmp');
        if (T == null) {
          const tgt = last.t != null ? (prog.names.get(last.t) ?? `sub_${last.t.toString(16)}`) : P(val(split(last.o)[0], last));
          line(n, last.t != null && prog.isFuncStart(last.t) ? `return ${tgt}(…);  // 末尾呼び出し` : `goto *${tgt};  // 間接ジャンプ（switch 文など）`, last.a);
          i++;
          continue;
        }
        const t = idx.get(T);
        const tb = blocks[t];
        if (returnPath(tb)) {
          line(n, retVia(b, tb), last.a);
          skip.add(T);
          i++;
          continue;
        }
        // jmp 条件 → 本体 → 条件（gcc の while / for）
        const cl = lifted.get(T);
        if (t > i + 1 && t < hi && cl.cond && succOf(tb, 'true') === blocks[i + 1].start && singleEntry(i + 1, t, b.start, T)) {
          emitStmtsInline(tb, n);
          line(n, `while (${condText(cl.cond)}) {`, tb.insns[tb.insns.length - 1].a);
          emitRange(i + 1, t, n + 1, { head: T, exit: tb.end });
          emitStmtsInline(tb, n + 1);
          line(n, '}');
          i = t + 1;
          continue;
        }
        if (T === join) {
          i++;
          continue;
        }
        if (loop && T === loop.head) {
          if (i + 1 < hi) line(n, 'continue;', last.a);
          i++;
          continue;
        }
        if (loop && T === loop.exit) {
          line(n, 'break;', last.a);
          i++;
          continue;
        }
        if (t !== i + 1) {
          gotoTargets.add(T);
          line(n, `goto ${label(T)};`, last.a);
        }
        i++;
        continue;
      }
      // そのまま次へ
      const F = succOf(b, 'fall');
      if (F != null && returnPath(blocks[idx.get(F)])) {
        line(n, retVia(b, blocks[idx.get(F)]), last.a);
        skip.add(F);
      }
      else if (F == null && l.kind === 'call') line(n, '// ここで終了（戻らない関数の呼び出し）');
      i++;
    }
  }
  function retTextFrom(b) {
    const r = lifted.get(b.start).rax;
    return r && r !== 'rax' && r !== 'eax' && !/__canary/.test(r) ? `return ${r};` : 'return;';
  }
  function emitStmtsInline(b, n) {
    emitStmts(b, n);
  }

  emitRange(0, blocks.length, 1);

  // ラベルは goto の行き先だけ残す
  const body = [];
  for (const o of out) {
    if (o.labelOf != null) {
      if (gotoTargets.has(o.labelOf)) body.push({ text: `${label(o.labelOf)}:`, a: o.labelOf });
    } else body.push(o);
  }
  // 宣言
  const name = prog.names.get(start) ?? `sub_${start.toString(16)}`;
  const retUsed = body.some((x) => /return [^;]/.test(x.text));
  const sig = `${retUsed ? 'int64_t' : 'void'} ${name}(${Array.from({ length: params }, (_, i) => `int64_t a${i + 1}`).join(', ')})`;
  const decl = [...vars].filter(([v]) => !canaryVars.has(v)).sort((x, y) => parseInt(y[0].split('_')[1], 16) - parseInt(x[0].split('_')[1], 16) || 0).map(([v, sz]) => `    ${TYPE[sz] ?? 'uint8_t'} ${v}${sz ? '' : '[]'};  // ${v.startsWith('var_') ? `rbp-0x${v.slice(4)}` : v}`);
  const lines = [{ text: `${sig} {` }, ...decl.map((t) => ({ text: t })), ...(decl.length ? [{ text: '' }] : []), ...body, { text: '}' }];
  return { lines, vars: [...vars.keys()], name };
}
