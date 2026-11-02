// 実行ファイル（ELF / PE）の構造を読む：セクション・シンボル・インポート・文字列
// 機械語の解析（逆アセンブル）は js/lib/rev.js が行う。ここはファイルの「地図」を作るだけ

const ELF_MACHINE = { 3: ['x86', 'x86（32ビット）'], 0x3e: ['x64', 'x86-64（64ビット）'], 0x28: ['arm', 'ARM（32ビット）'], 0xb7: ['arm64', 'AArch64（ARM 64ビット）'], 8: ['mips', 'MIPS'], 0xf3: ['riscv', 'RISC-V'] };
const PE_MACHINE = { 0x14c: ['x86', 'x86（32ビット）'], 0x8664: ['x64', 'x86-64（64ビット）'], 0x1c0: ['arm', 'ARM'], 0x1c4: ['arm', 'ARM Thumb-2'], 0xaa64: ['arm64', 'ARM64'] };

export function detectFormat(b) {
  if (b.length >= 52 && b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46) return 'ELF';
  if (b.length >= 64 && b[0] === 0x4d && b[1] === 0x5a) {
    const off = b[0x3c] | (b[0x3d] << 8) | (b[0x3e] << 16) | (b[0x3f] << 24);
    if (off > 0 && off + 24 <= b.length && b[off] === 0x50 && b[off + 1] === 0x45 && b[off + 2] === 0 && b[off + 3] === 0) return 'PE';
  }
  return null;
}

function reader(b, le = true) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return {
    u8: (o) => dv.getUint8(o),
    u16: (o) => dv.getUint16(o, le),
    u32: (o) => dv.getUint32(o, le),
    u64: (o) => Number(dv.getBigUint64(o, le)),
    cstr: (o, max = 4096) => {
      let e = o;
      while (e < b.length && b[e] !== 0 && e - o < max) e++;
      return new TextDecoder('latin1').decode(b.subarray(o, e));
    },
  };
}

// ---------- ELF ----------
function parseELF(b) {
  const bits = b[4] === 2 ? 64 : 32;
  const le = b[5] !== 2;
  const r = reader(b, le);
  const is64 = bits === 64;
  const ptr = (o) => (is64 ? r.u64(o) : r.u32(o));
  const type = r.u16(16), machine = r.u16(18);
  const [arch, archName] = ELF_MACHINE[machine] ?? ['unknown', `不明（e_machine = ${machine}）`];
  const entry = ptr(24);
  const phoff = ptr(is64 ? 32 : 28), shoff = ptr(is64 ? 40 : 32);
  const phentsize = r.u16(is64 ? 54 : 42), phnum = r.u16(is64 ? 56 : 44);
  const shentsize = r.u16(is64 ? 58 : 46), shnum = r.u16(is64 ? 60 : 48), shstrndx = r.u16(is64 ? 62 : 50);
  const warnings = [];
  if (!le) warnings.push('ビッグエンディアンの ELF です。一部の解析は正しく動かない可能性があります。');

  const segments = [];
  for (let i = 0; i < phnum && phoff + (i + 1) * phentsize <= b.length; i++) {
    const o = phoff + i * phentsize;
    const t = r.u32(o);
    const flags = is64 ? r.u32(o + 4) : r.u32(o + 24);
    const off = is64 ? r.u64(o + 8) : r.u32(o + 4), va = is64 ? r.u64(o + 16) : r.u32(o + 8);
    const fsz = is64 ? r.u64(o + 32) : r.u32(o + 16), msz = is64 ? r.u64(o + 40) : r.u32(o + 20);
    segments.push({ type: t, off, addr: va, size: fsz, vsize: msz, exec: !!(flags & 1), write: !!(flags & 2), read: !!(flags & 4) });
  }
  const interp = segments.find((s) => s.type === 3);

  const raw = [];
  if (shoff && shnum && shoff + shnum * shentsize <= b.length) {
    for (let i = 0; i < shnum; i++) {
      const o = shoff + i * shentsize;
      raw.push({
        nameOff: r.u32(o), type: r.u32(o + 4), flags: is64 ? r.u64(o + 8) : r.u32(o + 8),
        addr: ptr(is64 ? o + 16 : o + 12), off: ptr(is64 ? o + 24 : o + 16), size: ptr(is64 ? o + 32 : o + 20),
        link: r.u32(is64 ? o + 40 : o + 24), entsize: ptr(is64 ? o + 56 : o + 36),
      });
    }
  } else warnings.push('セクションヘッダがありません（意図的に壊されている可能性）。プログラムヘッダの情報だけで解析します。');
  const strtab = raw[shstrndx];
  const sections = raw.map((s, i) => ({
    index: i,
    name: strtab && strtab.off + s.nameOff < b.length ? r.cstr(strtab.off + s.nameOff, 64) : '',
    type: s.type, addr: s.addr, off: s.off, size: s.type === 8 ? 0 : s.size, vsize: s.size, link: s.link, entsize: s.entsize,
    exec: !!(s.flags & 4), write: !!(s.flags & 1), alloc: !!(s.flags & 2),
  }));

  // シンボル（.symtab と .dynsym）
  const symbols = [];
  const symTables = {};
  for (const s of sections) {
    if (s.type !== 2 && s.type !== 11) continue;
    const str = sections[s.link];
    const esz = is64 ? 24 : 16;
    const list = [];
    for (let o = s.off; o + esz <= s.off + s.size && o + esz <= b.length; o += esz) {
      const nameOff = r.u32(o);
      const info = is64 ? r.u8(o + 4) : r.u8(o + 12);
      const shndx = is64 ? r.u16(o + 6) : r.u16(o + 14);
      const value = is64 ? r.u64(o + 8) : r.u32(o + 4);
      const size = is64 ? r.u64(o + 16) : r.u32(o + 8);
      const name = str && nameOff ? r.cstr(str.off + nameOff, 256) : '';
      const t = info & 0xf;
      list.push({ name, value, size, type: t, shndx });
      if (name && value && shndx !== 0 && (t === 1 || t === 2)) symbols.push({ name, addr: value, size, kind: t === 2 ? 'func' : 'object', dynamic: s.type === 11 });
    }
    symTables[s.index] = list;
  }

  // インポート：再配置で GOT の各スロットに入る関数名
  const slots = new Map();
  const imports = [];
  for (const s of sections) {
    if (s.type !== 4 && s.type !== 9) continue;
    const syms = symTables[s.link];
    if (!syms) continue;
    const esz = s.type === 4 ? (is64 ? 24 : 12) : (is64 ? 16 : 8);
    for (let o = s.off; o + esz <= s.off + s.size && o + esz <= b.length; o += esz) {
      const off = ptr(o);
      const info = is64 ? r.u64(o + 8) : r.u32(o + 4);
      const symIdx = is64 ? Math.floor(info / 2 ** 32) : info >>> 8;
      const sym = syms[symIdx];
      if (!sym?.name) continue;
      const name = sym.name.replace(/@.*$/, '');
      if (!slots.has(off)) slots.set(off, name);
      if (sym.type === 2 || sym.type === 0) imports.push({ name, slot: off, lib: '' });
    }
  }
  const needed = [];
  const dyn = sections.find((s) => s.type === 6);
  const dynstr = dyn && sections[dyn.link];
  if (dyn && dynstr) {
    const esz = is64 ? 16 : 8;
    for (let o = dyn.off; o + esz <= dyn.off + dyn.size; o += esz) {
      const tag = is64 ? r.u64(o) : r.u32(o);
      if (tag === 0) break;
      if (tag === 1) needed.push(r.cstr(dynstr.off + (is64 ? r.u64(o + 8) : r.u32(o + 4)), 256));
    }
  }

  const hasSymtab = sections.some((s) => s.type === 2);
  const mapped = sections.filter((s) => s.alloc && s.addr && s.type !== 8).map((s) => ({ name: s.name, addr: s.addr, off: s.off, size: s.size, vsize: s.vsize, exec: s.exec, write: s.write }));
  const regions = mapped.length ? mapped : segments.filter((s) => s.type === 1).map((s, i) => ({ name: `LOAD${i}`, addr: s.addr, off: s.off, size: s.size, vsize: s.vsize, exec: s.exec, write: s.write }));
  const props = [
    ['形式', `ELF ${bits}ビット（${type === 3 ? (interp ? 'PIE 実行ファイル' : '共有ライブラリ') : type === 2 ? '実行ファイル' : type === 1 ? 'オブジェクトファイル' : `type ${type}`}）`],
    ['リンク', interp ? `動的（${r.cstr(interp.off, 128)}）` : '静的リンク（ライブラリ関数も中に含まれる）'],
    ['シンボル', hasSymtab ? 'あり（関数名が残っている）' : 'なし（strip 済み。関数名は推測になる）'],
  ];
  if (needed.length) props.push(['使うライブラリ', needed.join(', ')]);
  return { format: 'ELF', bits, le, arch, archName, entry, imageBase: 0, sections: sections.filter((s) => s.name || s.size), regions, symbols, imports, slots, props, warnings, stripped: !hasSymtab, pie: type === 3 };
}

// ---------- PE ----------
function parsePE(b) {
  const r = reader(b, true);
  const pe = r.u32(0x3c);
  const machine = r.u16(pe + 4), nsec = r.u16(pe + 6), optSize = r.u16(pe + 20), chars = r.u16(pe + 22);
  const opt = pe + 24;
  const magic = r.u16(opt);
  const is64 = magic === 0x20b;
  const [arch, archName] = PE_MACHINE[machine] ?? ['unknown', `不明（Machine = 0x${machine.toString(16)}）`];
  const imageBase = is64 ? r.u64(opt + 24) : r.u32(opt + 28);
  const entryRva = r.u32(opt + 16);
  const subsystem = r.u16(opt + 68);
  const ddOff = opt + (is64 ? 112 : 96);
  const nDD = r.u32(opt + (is64 ? 108 : 92));
  const dd = (i) => (i < nDD ? { rva: r.u32(ddOff + i * 8), size: r.u32(ddOff + i * 8 + 4) } : { rva: 0, size: 0 });
  const warnings = [];

  const sections = [];
  const sh = opt + optSize;
  for (let i = 0; i < nsec && sh + (i + 1) * 40 <= b.length; i++) {
    const o = sh + i * 40;
    const name = new TextDecoder('latin1').decode(b.subarray(o, o + 8)).replace(/\0.*$/, '');
    const vsize = r.u32(o + 8), rva = r.u32(o + 12), rawSize = r.u32(o + 16), rawPtr = r.u32(o + 20), c = r.u32(o + 36);
    sections.push({ index: i, name, addr: imageBase + rva, rva, off: rawPtr, size: Math.min(rawSize, vsize || rawSize), vsize: vsize || rawSize, exec: !!(c & 0x20000000) || !!(c & 0x20), write: !!(c & 0x80000000), alloc: true });
  }
  const rvaToOff = (rva) => {
    const s = sections.find((x) => rva >= x.rva && rva < x.rva + Math.max(x.vsize, x.size));
    return s && rva - s.rva < s.size ? s.off + (rva - s.rva) : -1;
  };

  // インポート（IAT の各スロットに入る関数名）
  const slots = new Map();
  const imports = [];
  const imp = dd(1);
  if (imp.rva) {
    for (let d = rvaToOff(imp.rva); d >= 0 && d + 20 <= b.length; d += 20) {
      const oft = r.u32(d), nameRva = r.u32(d + 12), ft = r.u32(d + 16);
      if (!oft && !nameRva && !ft) break;
      const lib = nameRva ? r.cstr(rvaToOff(nameRva), 256) : '?';
      let t = rvaToOff(oft || ft);
      const step = is64 ? 8 : 4;
      for (let i = 0; t >= 0 && t + step <= b.length && i < 10000; i++, t += step) {
        const v = is64 ? r.u64(t) : r.u32(t);
        if (!v) break;
        const ordinal = is64 ? v >= 2 ** 63 : v >= 2 ** 31;
        const name = ordinal ? `${lib}#${v % 65536}` : r.cstr(rvaToOff(v % 2 ** 31) + 2, 256).replace(/@\d+$/, '');
        const slot = imageBase + ft + i * step;
        slots.set(slot, name);
        imports.push({ name, slot, lib });
      }
    }
  }
  // エクスポート
  const symbols = [];
  const exp = dd(0);
  if (exp.rva) {
    const e = rvaToOff(exp.rva);
    if (e >= 0) {
      const nFuncs = r.u32(e + 20), nNames = r.u32(e + 24);
      const aFuncs = rvaToOff(r.u32(e + 28)), aNames = rvaToOff(r.u32(e + 32)), aOrd = rvaToOff(r.u32(e + 36));
      for (let i = 0; i < Math.min(nNames, 20000); i++) {
        const name = r.cstr(rvaToOff(r.u32(aNames + i * 4)), 256);
        const ord = r.u16(aOrd + i * 2);
        if (ord < nFuncs) symbols.push({ name, addr: imageBase + r.u32(aFuncs + ord * 4), size: 0, kind: 'func' });
      }
    }
  }
  // COFF シンボル表（MinGW でビルドした exe には残っていることがある）
  const symPtr = r.u32(pe + 12), nSyms = r.u32(pe + 16);
  if (symPtr && nSyms && symPtr + nSyms * 18 <= b.length) {
    const strBase = symPtr + nSyms * 18;
    for (let i = 0; i < nSyms; i++) {
      const o = symPtr + i * 18;
      const name = r.u32(o) === 0 ? r.cstr(strBase + r.u32(o + 4), 256) : r.cstr(o, 8);
      const value = r.u32(o + 8), secNum = r.u16(o + 12), type = r.u16(o + 14), cls = r.u8(o + 16), aux = r.u8(o + 17);
      const sec = sections[secNum - 1];
      if (sec && (cls === 2 || cls === 3) && name && !name.startsWith('.')) {
        symbols.push({ name, addr: sec.addr + value, size: 0, kind: (type >> 4) === 2 || sec.exec ? 'func' : 'object' });
      }
      i += aux;
    }
  }

  const dotnet = dd(14).rva !== 0;
  if (dotnet) warnings.push('.NET のプログラムです。機械語ではなく中間言語（IL）なので、dnSpy / ILSpy で開くと元のコードに近い形で読めます。');
  const props = [
    ['形式', `PE ${is64 ? 'PE32+（64ビット）' : 'PE32（32ビット）'}${chars & 0x2000 ? ' DLL' : ' 実行ファイル'}`],
    ['種類', subsystem === 2 ? 'Windows GUI アプリ' : subsystem === 3 ? 'コンソールアプリ' : `subsystem ${subsystem}`],
    ['イメージベース', '0x' + imageBase.toString(16)],
    ['使うライブラリ', [...new Set(imports.map((i) => i.lib))].join(', ') || 'なし'],
  ];
  return {
    format: 'PE', bits: is64 ? 64 : 32, le: true, arch, archName, entry: imageBase + entryRva, imageBase,
    sections, regions: sections.filter((s) => s.size || s.vsize), symbols, imports, slots, props, warnings, stripped: !symbols.length, dotnet,
  };
}

export function parseBinary(bytes) {
  const fmt = detectFormat(bytes);
  if (!fmt) return null;
  const bin = fmt === 'ELF' ? parseELF(bytes) : parsePE(bytes);
  bin.bytes = bytes;
  bin.regions.sort((a, b) => a.addr - b.addr);
  // 圧縮（パッカー）や言語の手がかり
  const names = bin.sections.map((s) => s.name);
  const text = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 4 << 20)));
  if (names.some((n) => /^UPX\d/.test(n)) || /UPX!/.test(text)) {
    bin.packer = 'UPX';
    bin.warnings.unshift('UPX で圧縮されています。このままでは中身の機械語が読めません。手元で「upx -d <ファイル>」を実行して展開してから、もう一度読み込んでください。');
  }
  if (names.includes('.gopclntab') || /Go build ID:/.test(text)) bin.lang = 'Go';
  else if (/rustc\/|RUST_BACKTRACE/.test(text)) bin.lang = 'Rust';
  else if (/PyInstaller|_MEIPASS|pyi-runtime/.test(text)) {
    bin.lang = 'Python（PyInstaller）';
    bin.warnings.push('PyInstaller で固めた Python のプログラムのようです。pyinstxtractor で .pyc を取り出してから読むのが近道です。');
  } else if (/GCC: \(/.test(text)) bin.lang = 'C / C++（GCC）';
  else if (/Microsoft \(R\)|RichMSVC|\.CRT\$/.test(text) || (bin.format === 'PE' && names.includes('.CRT'))) bin.lang = 'C / C++（MSVC）';
  if (bin.lang) bin.props.push(['言語の推定', bin.lang]);
  if (bin.lang === 'Go') bin.warnings.push('Go のプログラムです。関数名は残っていることが多いので、main.main から読み始めましょう。文字列は NUL 終端ではないため、文字列一覧が細切れになることがあります。');
  return bin;
}

// ---------- アドレスとファイル位置の変換 ----------
export function regionOf(bin, addr) {
  for (const s of bin.regions) if (addr >= s.addr && addr < s.addr + Math.max(s.vsize, s.size)) return s;
  return null;
}

export function vaToOff(bin, addr) {
  const s = regionOf(bin, addr);
  if (!s || addr - s.addr >= s.size) return -1;
  return s.off + (addr - s.addr);
}

export function offToVa(bin, off) {
  for (const s of bin.regions) if (off >= s.off && off < s.off + s.size) return s.addr + (off - s.off);
  return null;
}

export function readAt(bin, addr, n) {
  const o = vaToOff(bin, addr);
  if (o < 0) return null;
  return bin.bytes.subarray(o, Math.min(bin.bytes.length, o + n));
}

// アドレスにある C 文字列（読める文字が minLen 以上続き、NUL で終わるもの）
export function stringAt(bin, addr, minLen = 2) {
  const o = vaToOff(bin, addr);
  if (o < 0) return null;
  const b = bin.bytes;
  let e = o;
  while (e < b.length && e - o < 1024 && b[e] !== 0) e++;
  if (e - o < minLen || b[e] !== 0) return null;
  const part = b.subarray(o, e);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(part);
  } catch {
    return null;
  }
  if (!/^[\x20-\x7e\t\r\n -￿]+$/.test(text) || /[\u0080-\u009f]/.test(text)) return null;
  return text;
}

// ファイル全体から文字列を集め、仮想アドレスとセクションを付ける
export function extractStrings(bin, minLen = 4) {
  const b = bin.bytes;
  const out = [];
  const push = (off, text, enc) => {
    const addr = offToVa(bin, off);
    const sec = addr != null ? regionOf(bin, addr) : null;
    out.push({ off, addr, text, enc, section: sec?.name ?? '' });
  };
  // ASCII と UTF-8
  let start = -1;
  for (let i = 0; i <= b.length; i++) {
    const c = i < b.length ? b[i] : 0;
    const ok = (c >= 0x20 && c < 0x7f) || c === 9 || c >= 0x80;
    if (ok) {
      if (start < 0) start = i;
    } else {
      if (start >= 0 && i - start >= minLen) {
        let t;
        try {
          t = new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(start, i));
        } catch {
          t = null;
        }
        if (t) {
          if ([...t].length >= minLen && /[\x20-\x7e]/.test(t)) push(start, t, t.length === i - start ? 'ascii' : 'utf-8');
        } else {
          // UTF-8 として正しくない場合は、ASCII の部分だけを拾う
          let s0 = -1;
          for (let j = start; j <= i; j++) {
            const ascii = j < i && b[j] < 0x80;
            if (ascii) {
              if (s0 < 0) s0 = j;
            } else {
              if (s0 >= 0 && j - s0 >= minLen) push(s0, new TextDecoder('latin1').decode(b.subarray(s0, j)), 'ascii');
              s0 = -1;
            }
          }
        }
      }
      start = -1;
    }
  }
  // UTF-16LE（Windows でよく使われる）
  start = -1;
  for (let i = 0; i + 1 <= b.length; i += 2) {
    const c = i + 1 < b.length ? b[i] | (b[i + 1] << 8) : 0;
    const ok = (c >= 0x20 && c < 0x7f) || (c >= 0x3000 && c < 0xa000);
    if (ok) {
      if (start < 0) start = i;
    } else {
      if (start >= 0 && (i - start) / 2 >= minLen) {
        // ASCII の文字列を 2 バイトずつ読み違えた「偽の漢字」は除く
        // （全バイトが ASCII の範囲なのに、半分以上が漢字などになっているもの）
        let wide = 0, allAscii = true;
        for (let j = start; j < i; j += 2) {
          if (b[j + 1] !== 0) wide++;
          if (b[j] >= 0x80 || b[j + 1] >= 0x80) allAscii = false;
        }
        if (!(allAscii && wide * 2 >= (i - start) / 2)) push(start, new TextDecoder('utf-16le').decode(b.subarray(start, i)), 'utf-16');
      }
      start = -1;
    }
  }
  return out.sort((a, c) => a.off - c.off);
}

// よく問題になる関数（逆アセンブルで注目すべき場所の目印）
export const NOTABLE_IMPORTS = {
  比較: ['strcmp', 'strncmp', 'memcmp', 'strcasecmp', 'strstr', 'lstrcmpA', 'lstrcmpW', 'wcscmp', 'CompareStringA', 'CompareStringW', 'bcmp'],
  入力: ['scanf', '__isoc99_scanf', '__isoc23_scanf', 'fgets', 'gets', 'read', 'getchar', 'getline', 'fread', 'ReadFile', 'ReadConsoleA', 'ReadConsoleW', 'GetDlgItemTextA', 'GetWindowTextA'],
  デバッガ検出: ['ptrace', 'IsDebuggerPresent', 'CheckRemoteDebuggerPresent', 'NtQueryInformationProcess', 'OutputDebugStringA', 'GetTickCount', 'QueryPerformanceCounter', 'ZwQueryInformationProcess'],
  乱数・時刻: ['srand', 'rand', 'time', 'random', 'srandom', 'GetSystemTime', 'GetLocalTime'],
  暗号: ['EVP_DecryptInit_ex', 'EVP_EncryptInit_ex', 'AES_decrypt', 'AES_set_decrypt_key', 'MD5', 'SHA256', 'CryptDecrypt', 'CryptEncrypt', 'BCryptDecrypt', 'RC4'],
  危険: ['system', 'execve', 'execl', 'popen', 'WinExec', 'CreateProcessA', 'CreateProcessW', 'ShellExecuteA', 'VirtualAlloc', 'VirtualProtect', 'mprotect', 'LoadLibraryA', 'GetProcAddress'],
};

export function notableKind(name) {
  for (const [k, list] of Object.entries(NOTABLE_IMPORTS)) if (list.includes(name)) return k;
  return null;
}
