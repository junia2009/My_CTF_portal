// 実行ファイルの解析：逆アセンブル・関数の発見・参照元（xref）・制御フローグラフ
// 機械語 → 命令 の変換は Capstone（vendor/capstone）に任せ、ここでは命令の並びから構造を組み立てる
import { regionOf, readAt, stringAt } from './binfmt.js';

// Capstone のモジュールから「バイト列 → 命令の配列」を作る
export function makeDisassembler(cs, arch, bits, { thumb = false } = {}) {
  let a, m;
  if (arch === 'x64') [a, m] = [cs.ARCH_X86, cs.MODE_64];
  else if (arch === 'x86') [a, m] = [cs.ARCH_X86, bits === 16 ? cs.MODE_16 : cs.MODE_32];
  else if (arch === 'arm64') [a, m] = [cs.ARCH_ARM64 ?? cs.ARCH_AARCH64, cs.MODE_ARM];
  else if (arch === 'arm') [a, m] = [cs.ARCH_ARM, thumb ? cs.MODE_THUMB : cs.MODE_ARM];
  else throw new Error(`この形式（${arch}）の機械語にはまだ対応していません`);
  const d = new cs.Capstone(a, m);
  return (bytes, addr, count = 0) => d.disasm(bytes, addr, count).map((i) => ({ a: Number(i.address), n: i.size, m: i.mnemonic, o: i.op_str }));
}

// 戻ってこない関数（呼び出しのあとに処理が続かない）
const NORETURN = new Set(['exit', '_exit', '_Exit', 'abort', '__stack_chk_fail', '__assert_fail', 'err', 'errx', 'ExitProcess', 'longjmp', '_longjmp', 'siglongjmp', 'pthread_exit', '__cxa_throw', 'quick_exit', '__fortify_fail', '__chk_fail', '__libc_start_main', 'ExitThread', 'FatalExit', '_invalid_parameter_noinfo_noreturn', '__report_gsfailure', 'runtime.gopanic', 'runtime.throw']);

const hex = (n) => '0x' + n.toString(16);
export const addrLabel = (n) => n.toString(16).padStart(n > 0xffffffff ? 12 : 8, '0');

// 命令の種類：call / jmp / jcc（条件分岐）/ ret / stop（hlt など）/ other
function classify(arch, m, o) {
  const mn = m.replace(/^(bnd|notrack|rep|repne|repe|lock)\s+/, '');
  if (arch === 'x86' || arch === 'x64') {
    if (mn === 'call') return 'call';
    if (mn === 'jmp' || mn === 'ljmp') return 'jmp';
    if (/^j/.test(mn) || /^loop/.test(mn)) return 'jcc';
    if (/^(ret|retf|retn|iret|iretd|iretq|sysret|sysexit)$/.test(mn)) return 'ret';
    if (mn === 'hlt' || mn === 'ud2' || mn === 'int3') return 'stop';
    return 'other';
  }
  if (arch === 'arm64') {
    if (mn === 'bl' || mn === 'blr') return 'call';
    if (mn === 'b' || mn === 'br') return 'jmp';
    if (/^b\./.test(mn) || /^(cbz|cbnz|tbz|tbnz)$/.test(mn)) return 'jcc';
    if (mn === 'ret' || mn === 'eret') return 'ret';
    if (mn === 'brk' || mn === 'hlt') return 'stop';
    return 'other';
  }
  // ARM 32ビット
  if (mn === 'bl' || mn === 'blx') return 'call';
  if (mn === 'bx' && /lr/.test(o)) return 'ret';
  if (/^pop/.test(mn) && /pc/.test(o)) return 'ret';
  if (mn === 'b' || mn === 'b.w' || mn === 'bx') return 'jmp';
  if (/^(cbz|cbnz)$/.test(mn) || /^b(eq|ne|cs|hs|cc|lo|mi|pl|vs|vc|hi|ls|ge|lt|gt|le)(\.w|\.n)?$/.test(mn)) return 'jcc';
  return 'other';
}

function directTarget(arch, kind, o) {
  if (kind === 'other' || kind === 'ret' || kind === 'stop') return null;
  const t = arch === 'x86' || arch === 'x64' ? /^0x([0-9a-f]+)$/.exec(o.trim()) : /#0x([0-9a-f]+)$/.exec(o.trim());
  return t ? parseInt(t[1], 16) : null;
}

export class Program {
  constructor(bin, dis) {
    this.bin = bin;
    this.dis = dis;
    this.arch = bin.arch;
    this.x86 = bin.arch === 'x86' || bin.arch === 'x64';
    this.insns = []; // アドレス順
    this.byAddr = new Map();
    this.names = new Map(); // コードのアドレス → 名前
    this.dataNames = new Map(); // データのアドレス → 名前
    this.importStubs = new Set();
    this.refsTo = new Map(); // 参照先 → [参照元の命令アドレス]
    this.callers = new Map(); // 関数 → Set(呼び出し元の命令アドレス)
    this.funcStarts = [];
    this.cfgCache = new Map();
  }

  // 実行可能な領域を先頭から順に逆アセンブルする（リニアスイープ）
  async analyze(onProgress) {
    const bin = this.bin;
    const exec = bin.regions.filter((r) => r.exec && r.size > 0);
    const total = exec.reduce((s, r) => s + r.size, 0) || 1;
    let done = 0, lastYield = performance.now();
    const CHUNK = 0x4000;
    for (const r of exec) {
      let pos = 0;
      while (pos < r.size) {
        const end = Math.min(r.size, pos + CHUNK);
        // 区切りをまたぐ命令も読めるよう、少し先まで渡す
        const part = bin.bytes.subarray(r.off + pos, r.off + Math.min(r.size, end + 15));
        const list = this.dis(part, r.addr + pos).filter((i) => i.a < r.addr + end);
        if (!list.length) {
          pos += 1; // 命令として読めないバイト（データ）を1つ飛ばす
          continue;
        }
        for (const i of list) this.add(i);
        const last = list[list.length - 1];
        const next = last.a + last.n - r.addr;
        pos = next < end ? next + 1 : next; // 途中で止まった＝読めないバイトがあった
        if (performance.now() - lastYield > 40) {
          onProgress?.('逆アセンブル中', (done + pos) / total);
          await new Promise((res) => setTimeout(res));
          lastYield = performance.now();
        }
      }
      done += r.size;
    }
    this.insns.sort((x, y) => x.a - y.a);
    onProgress?.('関数と参照を調べています', 1);
    this.buildNames();
    this.collectRefs();
    this.findFunctions();
    return this;
  }

  add(i) {
    if (this.byAddr.has(i.a)) return this.byAddr.get(i.a);
    i.k = classify(this.arch, i.m, i.o);
    i.t = directTarget(this.arch, i.k, i.o);
    i.ref = this.memRef(i);
    this.byAddr.set(i.a, i);
    this.insns.push(i);
    return i;
  }

  // 命令が参照しているメモリ（文字列・グローバル変数・インポートのスロットなど）のアドレス
  memRef(i) {
    if (this.x86) {
      const rip = /\[(?:rip|eip) ([+-]) 0x([0-9a-f]+)\]/.exec(i.o);
      if (rip) return i.a + i.n + (rip[1] === '+' ? 1 : -1) * parseInt(rip[2], 16);
      const abs = /(?:^|\s|ds:)\[0x([0-9a-f]+)\]/.exec(i.o);
      if (abs) return parseInt(abs[1], 16);
      if (i.k === 'other') {
        for (const m of i.o.matchAll(/(?:^|, )(0x[0-9a-f]{3,})$/g)) {
          const v = parseInt(m[1], 16);
          if (regionOf(this.bin, v)) return v;
        }
      }
      // 32ビット PIC の PLT：jmp dword ptr [ebx + 0xc]
      const ebx = /\[ebx \+ 0x([0-9a-f]+)\]/.exec(i.o);
      if (ebx && this.bin.bits === 32 && i.k === 'jmp') {
        const got = this.bin.regions.find((r) => r.name === '.got.plt') ?? this.bin.regions.find((r) => r.name === '.got');
        if (got) return got.addr + parseInt(ebx[1], 16);
      }
      return null;
    }
    if (this.arch === 'arm64') {
      // adrp x0, #0x2000 → add x0, x0, #0x10 の組み合わせ（直前の adrp を覚えておく）
      if (i.m === 'adrp') {
        const m = /^(\w+), #0x([0-9a-f]+)/.exec(i.o);
        if (m) (this.adrp ??= {})[m[1]] = parseInt(m[2], 16);
        return null;
      }
      if (i.m === 'adr') {
        const m = /#0x([0-9a-f]+)$/.exec(i.o);
        return m ? parseInt(m[1], 16) : null;
      }
      const add = /^(\w+), (\w+), #0x([0-9a-f]+)$/.exec(i.o);
      if (i.m === 'add' && add && this.adrp?.[add[2]] != null) return this.adrp[add[2]] + parseInt(add[3], 16);
      const ld = /^\w+, \[(\w+), #0x([0-9a-f]+)\]$/.exec(i.o);
      if (/^ld/.test(i.m) && ld && this.adrp?.[ld[1]] != null) return this.adrp[ld[1]] + parseInt(ld[2], 16);
      return null;
    }
    const lit = /\[pc, #(?:0x)?([0-9a-f]+)\]/.exec(i.o);
    if (lit && i.m.startsWith('ldr')) {
      const pc = (i.a - (i.a % 4)) + (this.bin.thumb ? 4 : 8);
      const slot = pc + parseInt(lit[1], lit[0].includes('0x') ? 16 : 10);
      const v = readAt(this.bin, slot, 4);
      return v && v.length === 4 ? new DataView(v.buffer, v.byteOffset).getUint32(0, true) : null;
    }
    return null;
  }

  // ARM の Thumb 関数はアドレスの最下位ビットが 1 になっているので外す（64ビットのアドレスでも壊れないよう算術で）
  code(a) {
    return this.arch === 'arm' ? a - (a % 2) : a;
  }

  insnAt(a) {
    let i = this.byAddr.get(a);
    if (i) return i;
    // リニアスイープで別の位置から読んでいた場合（命令の途中に飛び込む難読化など）は、ここから読み直す
    const r = regionOf(this.bin, a);
    if (!r || !r.exec || a - r.addr >= r.size) return null;
    const off = r.off + (a - r.addr);
    const got = this.dis(this.bin.bytes.subarray(off, Math.min(r.off + r.size, off + 16)), a, 1)[0];
    if (!got) return null;
    i = got;
    i.k = classify(this.arch, i.m, i.o);
    i.t = directTarget(this.arch, i.k, i.o);
    i.ref = this.memRef(i);
    i.overlap = true;
    this.byAddr.set(a, i);
    return i;
  }

  buildNames() {
    const { bin } = this;
    for (const s of bin.symbols) {
      if (s.kind === 'func') {
        const r = regionOf(bin, this.code(s.addr));
        if (r?.exec && !this.names.has(this.code(s.addr))) this.names.set(this.code(s.addr), s.name);
      } else if (!this.dataNames.has(s.addr)) this.dataNames.set(s.addr, s.name);
    }
    for (const [slot, name] of bin.slots) if (!this.dataNames.has(slot)) this.dataNames.set(slot, name);
    // PLT のスタブ（jmp [スロット]）に、インポートした関数の名前を付ける
    for (const i of this.insns) {
      if (i.k !== 'jmp' || i.ref == null || !bin.slots.has(i.ref)) continue;
      const prev = this.byAddr.get(i.a - 4);
      const stub = prev && /^endbr/.test(prev.m) ? prev.a : i.a;
      if (!this.names.has(stub)) this.names.set(stub, bin.slots.get(i.ref));
      this.importStubs.add(stub);
    }
    // ARM の PLT は命令の組み合わせが複雑なので、ここでは x86 系だけ
    if (!this.names.has(this.code(bin.entry))) this.names.set(this.code(bin.entry), bin.format === 'ELF' ? '_start' : 'entry');
    this.entry = this.code(bin.entry);
    this.findMain();
  }

  // strip されていても、_start から __libc_start_main に渡される main を見つける
  findMain() {
    if ([...this.names.values()].includes('main')) return;
    const isLibcStart = (i) => (i.t != null && this.names.get(i.t) === '__libc_start_main') || (i.ref != null && this.bin.slots.get(i.ref) === '__libc_start_main');
    const start = this.insns.findIndex((i) => i.k === 'call' && isLibcStart(i));
    if (start < 0) return;
    for (let j = start - 1; j >= Math.max(0, start - 12); j--) {
      const i = this.insns[j];
      let target = null;
      if (this.x86) {
        if (/^(lea|mov)$/.test(i.m) && /^(rdi|edi)\b/.test(i.o)) target = i.ref ?? (/, 0x([0-9a-f]+)$/.exec(i.o) ? parseInt(/, 0x([0-9a-f]+)$/.exec(i.o)[1], 16) : null);
        else if (i.m === 'push' && /^0x/.test(i.o)) target = parseInt(i.o, 16);
      } else if (/^(x0|r0)\b/.test(i.o) && i.ref != null) target = i.ref;
      if (target != null && regionOf(this.bin, target)?.exec) {
        this.names.set(this.code(target), 'main');
        this.mainGuessed = true;
        return;
      }
    }
  }

  collectRefs() {
    const push = (map, k, v) => {
      let l = map.get(k);
      if (!l) map.set(k, (l = []));
      l.push(v);
    };
    for (const i of this.insns) {
      if (i.ref != null) push(this.refsTo, i.ref, i.a);
      if (i.t != null) push(this.refsTo, i.t, i.a);
      if (i.k === 'call') {
        const tgt = i.t ?? (i.ref != null && this.bin.slots.has(i.ref) ? i.ref : null);
        if (tgt != null) {
          let s = this.callers.get(tgt);
          if (!s) this.callers.set(tgt, (s = new Set()));
          s.add(i.a);
        }
      }
    }
  }

  isPlt(a) {
    const r = regionOf(this.bin, a);
    return !!r && /^\.plt|^\.iplt|^__stubs|^__auth_stubs/.test(r.name);
  }

  findFunctions() {
    const starts = new Set();
    const ok = (a) => {
      const r = regionOf(this.bin, a);
      return r?.exec && !this.isPlt(a) && this.byAddr.has(a);
    };
    for (const a of this.names.keys()) if (ok(a)) starts.add(a);
    for (const i of this.insns) {
      if (i.k === 'call' && i.t != null && ok(i.t)) starts.add(i.t);
      // 関数ポインタ（lea rdi, [rip + X] で main を渡すなど）。直前が ret / nop / int3 なら関数の先頭とみなす
      if (i.ref != null && ok(i.ref) && i.k === 'other') {
        const idx = this.indexOf(i.ref);
        const prev = this.insns[idx - 1];
        if (!prev || /^(ret|nop|int3|hlt|jmp)/.test(prev.m) || prev.k === 'ret' || prev.k === 'stop' || prev.k === 'jmp') starts.add(i.ref);
      }
    }
    this.funcStarts = [...starts].sort((x, y) => x - y);
    for (const a of this.funcStarts) if (!this.names.has(a)) this.names.set(a, `sub_${a.toString(16)}`);
  }

  indexOf(a) {
    let lo = 0, hi = this.insns.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.insns[mid].a === a) return mid;
      if (this.insns[mid].a < a) lo = mid + 1;
      else hi = mid - 1;
    }
    return -1;
  }

  // アドレスを含む関数の先頭
  funcOf(a) {
    const s = this.funcStarts;
    let lo = 0, hi = s.length - 1, best = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (s[mid] <= a) {
        best = s[mid];
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return best;
  }

  nameOf(a) {
    return this.names.get(a) ?? this.dataNames.get(a) ?? null;
  }

  // 呼び出し先の名前（直接呼び出し・PLT スタブ・インポートのスロット経由）
  callName(i) {
    if (i.t != null) return this.names.get(i.t) ?? null;
    if (i.ref != null && this.bin.slots.has(i.ref)) return this.bin.slots.get(i.ref);
    return null;
  }

  isNoReturn(i) {
    const n = this.callName(i);
    return n != null && NORETURN.has(n.replace(/^_+(?=exit)/, (m) => m));
  }

  // 命令に付ける注釈（文字列・名前）
  annotate(i) {
    const out = [];
    const cn = i.k === 'call' || i.k === 'jmp' ? this.callName(i) : null;
    if (cn && i.t == null) out.push(cn);
    if (i.ref != null && !(cn && i.t == null)) {
      const s = stringAt(this.bin, i.ref, 1);
      if (s != null) out.push(JSON.stringify(s.length > 80 ? s.slice(0, 80) + '…' : s));
      const n = this.nameOf(i.ref);
      if (n) out.push(n);
      else if (s == null) out.push(hex(i.ref));
    }
    return out.join('  ');
  }

  // ---------- 制御フローグラフ ----------
  cfg(start) {
    if (this.cfgCache.has(start)) return this.cfgCache.get(start);
    const owned = new Map();
    const leaders = new Set([start]);
    const work = [start];
    const seen = new Set();
    const LIMIT = 30000;
    while (work.length && owned.size < LIMIT) {
      let a = work.pop();
      if (seen.has(a)) continue;
      seen.add(a);
      for (let guard = 0; guard < LIMIT; guard++) {
        const i = this.insnAt(a);
        if (!i) break;
        owned.set(i.a, i);
        if (i.k === 'jcc') {
          if (i.t != null && regionOf(this.bin, i.t)?.exec) {
            leaders.add(i.t);
            work.push(i.t);
          }
          leaders.add(i.a + i.n);
          work.push(i.a + i.n);
          break;
        }
        if (i.k === 'jmp') {
          // 他の関数の先頭へのジャンプは末尾呼び出し（tail call）として扱う
          if (i.t != null && i.t !== start && !this.isFuncStart(i.t) && regionOf(this.bin, i.t)?.exec) {
            leaders.add(i.t);
            work.push(i.t);
          }
          break;
        }
        if (i.k === 'ret' || i.k === 'stop') break;
        if (i.k === 'call' && this.isNoReturn(i)) break;
        a = i.a + i.n;
        if (seen.has(a) || (a !== start && this.isFuncStart(a) && !owned.has(a))) {
          leaders.add(a);
          break;
        }
        if (leaders.has(a)) {
          work.push(a);
          break;
        }
      }
    }
    const list = [...owned.values()].sort((x, y) => x.a - y.a);
    const blocks = [];
    let cur = null;
    for (const i of list) {
      if (!cur || leaders.has(i.a) || cur.end !== i.a) {
        cur = { start: i.a, end: i.a, insns: [], succ: [], preds: [] };
        blocks.push(cur);
      }
      cur.insns.push(i);
      cur.end = i.a + i.n;
      if (i.k === 'jcc' || i.k === 'jmp' || i.k === 'ret' || i.k === 'stop' || (i.k === 'call' && this.isNoReturn(i))) cur = null;
    }
    const at = new Map(blocks.map((b) => [b.start, b]));
    for (const b of blocks) {
      const last = b.insns[b.insns.length - 1];
      if (last.k === 'jcc') {
        if (last.t != null && at.has(last.t)) b.succ.push({ to: last.t, type: 'true' });
        if (at.has(b.end)) b.succ.push({ to: b.end, type: 'false' });
      } else if (last.k === 'jmp') {
        if (last.t != null && at.has(last.t)) b.succ.push({ to: last.t, type: 'jmp' });
      } else if (last.k !== 'ret' && last.k !== 'stop' && !(last.k === 'call' && this.isNoReturn(last)) && at.has(b.end)) {
        b.succ.push({ to: b.end, type: 'fall' });
      }
    }
    for (const b of blocks) for (const s of b.succ) at.get(s.to).preds.push(b.start);
    const g = { start, blocks, at, end: list.length ? list[list.length - 1].a + list[list.length - 1].n : start };
    this.cfgCache.set(start, g);
    return g;
  }

  isFuncStart(a) {
    return this.indexOfStart(a) >= 0;
  }

  indexOfStart(a) {
    const s = this.funcStarts;
    let lo = 0, hi = s.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (s[mid] === a) return mid;
      if (s[mid] < a) lo = mid + 1;
      else hi = mid - 1;
    }
    return -1;
  }

  // 関数の一覧（PLT とインポートのスタブを除く）
  functions() {
    return this.funcStarts.map((a) => ({ addr: a, name: this.names.get(a), callers: this.callers.get(a)?.size ?? 0 }));
  }

  // 文字列とその参照元
  stringRefs(strings) {
    return strings.map((s) => {
      const refs = s.addr != null ? this.refsTo.get(s.addr) ?? [] : [];
      return { ...s, refs: refs.map((a) => ({ at: a, func: this.funcOf(a) })) };
    });
  }
}

export { hex };
