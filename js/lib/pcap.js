// pcap / pcapng の解析：パケット一覧・TCP の会話の再構成・HTTP・DNS

const ip4 = (b, o) => `${b[o]}.${b[o + 1]}.${b[o + 2]}.${b[o + 3]}`;
function ip6(b, o) {
  const parts = [];
  for (let i = 0; i < 16; i += 2) parts.push(((b[o + i] << 8) | b[o + i + 1]).toString(16));
  return parts.join(':').replace(/(^|:)0(:0)+(:|$)/, '::');
}

// ---------- ファイル形式 ----------
function* readRecords(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const m = v.getUint32(0, false);
  if ([0xa1b2c3d4, 0xd4c3b2a1, 0xa1b23c4d, 0x4d3cb2a1].includes(m)) {
    const le = m === 0xd4c3b2a1 || m === 0x4d3cb2a1;
    const nano = m === 0xa1b23c4d || m === 0x4d3cb2a1;
    const link = v.getUint32(20, le);
    yield { format: nano ? 'pcap（ナノ秒）' : 'pcap', link };
    let o = 24;
    while (o + 16 <= bytes.length) {
      const sec = v.getUint32(o, le), frac = v.getUint32(o + 4, le), incl = v.getUint32(o + 8, le), orig = v.getUint32(o + 12, le);
      if (o + 16 + incl > bytes.length) break;
      yield { ts: sec + frac / (nano ? 1e9 : 1e6), data: bytes.subarray(o + 16, o + 16 + incl), orig, link };
      o += 16 + incl;
    }
    return;
  }
  if (m === 0x0a0d0d0a) {
    let le = v.getUint32(8, true) === 0x1a2b3c4d;
    const links = [];
    yield { format: 'pcapng', link: null };
    let o = 0;
    while (o + 12 <= bytes.length) {
      const type = v.getUint32(o, le), len = v.getUint32(o + 4, le);
      if (len < 12 || o + len > bytes.length) break;
      if (type === 0x0a0d0d0a) le = v.getUint32(o + 8, true) === 0x1a2b3c4d;
      else if (type === 1) links.push(v.getUint16(o + 8, le));
      else if (type === 6) {
        const iface = v.getUint32(o + 8, le), hi = v.getUint32(o + 12, le), lo = v.getUint32(o + 16, le), cap = v.getUint32(o + 20, le), orig = v.getUint32(o + 24, le);
        yield { ts: (hi * 4294967296 + lo) / 1e6, data: bytes.subarray(o + 28, o + 28 + cap), orig, link: links[iface] ?? 1 };
      } else if (type === 3) {
        const orig = v.getUint32(o + 8, le);
        yield { ts: 0, data: bytes.subarray(o + 12, o + 12 + Math.min(orig, len - 16)), orig, link: links[0] ?? 1 };
      }
      o += len;
    }
    return;
  }
  throw new Error('pcap / pcapng 形式ではありません');
}

// ---------- 各層の分解 ----------
function parseIp(b, o, pkt) {
  const ver = b[o] >> 4;
  let proto, end = b.length;
  if (ver === 4) {
    const ihl = (b[o] & 15) * 4;
    const total = (b[o + 2] << 8) | b[o + 3];
    proto = b[o + 9];
    pkt.src = ip4(b, o + 12);
    pkt.dst = ip4(b, o + 16);
    end = Math.min(b.length, o + (total || b.length - o));
    o += ihl;
  } else if (ver === 6) {
    proto = b[o + 6];
    const plen = (b[o + 4] << 8) | b[o + 5];
    pkt.src = ip6(b, o + 8);
    pkt.dst = ip6(b, o + 24);
    end = Math.min(b.length, o + 40 + plen);
    o += 40;
    // 主な拡張ヘッダを飛ばす
    while ([0, 43, 60].includes(proto) && o + 2 <= end) {
      proto = b[o];
      o += (b[o + 1] + 1) * 8;
    }
  } else {
    pkt.proto = `不明(IPv${ver})`;
    return;
  }
  if (proto === 6 && o + 20 <= end) {
    const off = (b[o + 12] >> 4) * 4, flags = b[o + 13];
    pkt.proto = 'TCP';
    pkt.sport = (b[o] << 8) | b[o + 1];
    pkt.dport = (b[o + 2] << 8) | b[o + 3];
    pkt.seq = ((b[o + 4] << 24) | (b[o + 5] << 16) | (b[o + 6] << 8) | b[o + 7]) >>> 0;
    pkt.flags = ['FIN', 'SYN', 'RST', 'PSH', 'ACK', 'URG'].filter((_, i) => flags & (1 << i));
    pkt.payload = b.subarray(Math.min(o + off, end), end);
  } else if (proto === 17 && o + 8 <= end) {
    pkt.proto = 'UDP';
    pkt.sport = (b[o] << 8) | b[o + 1];
    pkt.dport = (b[o + 2] << 8) | b[o + 3];
    pkt.payload = b.subarray(o + 8, end);
  } else if (proto === 1 || proto === 58) {
    pkt.proto = proto === 1 ? 'ICMP' : 'ICMPv6';
    pkt.payload = b.subarray(Math.min(o + 8, end), end);
    pkt.info = `type ${b[o]} code ${b[o + 1]}`;
  } else pkt.proto = `IP(${proto})`;
}

function parseLink(b, link, pkt) {
  let o = 0, et;
  if (link === 1) {
    et = (b[12] << 8) | b[13];
    o = 14;
    while (et === 0x8100 || et === 0x88a8) {
      et = (b[o + 2] << 8) | b[o + 3];
      o += 4;
    }
    if (et === 0x0806) {
      pkt.proto = 'ARP';
      pkt.info = `${ip4(b, o + 14)} → ${ip4(b, o + 24)}`;
      return;
    }
    if (et !== 0x0800 && et !== 0x86dd) {
      pkt.proto = `Ether(0x${et.toString(16)})`;
      return;
    }
  } else if (link === 113) o = 16;
  else if (link === 276) o = 20;
  else if (link === 0) o = 4;
  // 101 / 228 / 229 は IP から始まる
  parseIp(b, o, pkt);
}

// ---------- DNS ----------
function dnsName(b, o, depth = 0) {
  const labels = [];
  while (o < b.length && depth < 20) {
    const len = b[o];
    if (len === 0) return { name: labels.join('.'), next: o + 1 };
    if ((len & 0xc0) === 0xc0) {
      const ptr = ((len & 0x3f) << 8) | b[o + 1];
      labels.push(dnsName(b, ptr, depth + 1).name);
      return { name: labels.join('.'), next: o + 2 };
    }
    labels.push(new TextDecoder('latin1').decode(b.subarray(o + 1, o + 1 + len)));
    o += len + 1;
  }
  return { name: labels.join('.'), next: o };
}
const DNS_TYPES = { 1: 'A', 2: 'NS', 5: 'CNAME', 12: 'PTR', 15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 255: 'ANY' };

export function parseDns(p) {
  if (p.length < 12) return null;
  const qd = (p[4] << 8) | p[5], an = (p[6] << 8) | p[7];
  const isResp = !!(p[2] & 0x80);
  let o = 12;
  const questions = [], answers = [];
  for (let i = 0; i < qd && o < p.length; i++) {
    const n = dnsName(p, o);
    questions.push({ name: n.name, type: DNS_TYPES[(p[n.next] << 8) | p[n.next + 1]] ?? (p[n.next] << 8) | p[n.next + 1] });
    o = n.next + 4;
  }
  for (let i = 0; i < an && o + 10 < p.length; i++) {
    const n = dnsName(p, o);
    const type = (p[n.next] << 8) | p[n.next + 1], rdlen = (p[n.next + 8] << 8) | p[n.next + 9];
    const rd = n.next + 10;
    let data = '';
    if (type === 1 && rdlen === 4) data = ip4(p, rd);
    else if (type === 28 && rdlen === 16) data = ip6(p, rd);
    else if (type === 5 || type === 12 || type === 2) data = dnsName(p, rd).name;
    else if (type === 16) data = new TextDecoder().decode(p.subarray(rd + 1, rd + 1 + p[rd]));
    answers.push({ name: n.name, type: DNS_TYPES[type] ?? type, data });
    o = rd + rdlen;
  }
  return { isResp, questions, answers };
}

// ---------- 全体 ----------
export function parseCapture(bytes, { maxPackets = 200000 } = {}) {
  const it = readRecords(bytes);
  const head = it.next().value;
  const packets = [];
  let t0 = null;
  for (const r of it) {
    if (packets.length >= maxPackets) break;
    const pkt = { no: packets.length + 1, ts: r.ts, len: r.orig, src: '', dst: '', proto: '', info: '', payload: new Uint8Array() };
    try {
      parseLink(r.data, r.link, pkt);
    } catch {
      pkt.proto = pkt.proto || '解析失敗';
    }
    if (t0 === null) t0 = r.ts;
    pkt.rel = r.ts - t0;
    if (pkt.proto === 'TCP') {
      pkt.info = `${pkt.sport} → ${pkt.dport} [${pkt.flags.join(',')}]${pkt.payload.length ? ` len=${pkt.payload.length}` : ''}`;
      const first = new TextDecoder('latin1').decode(pkt.payload.subarray(0, 120)).split('\r\n')[0];
      if (/^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH) \S+ HTTP\/|^HTTP\/\d/.test(first)) pkt.info = first;
    } else if (pkt.proto === 'UDP') {
      pkt.info = `${pkt.sport} → ${pkt.dport} len=${pkt.payload.length}`;
      if (pkt.sport === 53 || pkt.dport === 53 || pkt.sport === 5353 || pkt.dport === 5353) {
        const d = parseDns(pkt.payload);
        if (d) {
          pkt.dns = d;
          pkt.proto = 'DNS';
          pkt.info = `${d.isResp ? '応答' : '問い合わせ'} ${d.questions.map((q) => `${q.type} ${q.name}`).join(', ')}${d.answers.length ? ' → ' + d.answers.map((a) => a.data).join(', ') : ''}`;
        }
      }
    }
    packets.push(pkt);
  }
  const duration = packets.length ? packets[packets.length - 1].ts - packets[0].ts : 0;
  return { format: head.format, link: head.link, packets, duration };
}

const concat = (chunks) => {
  const out = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
};

// TCP の会話ごとに、各方向のデータを順番どおりに組み立て直す
export function tcpStreams(packets) {
  const map = new Map();
  for (const p of packets) {
    if (p.proto !== 'TCP') continue;
    const a = `${p.src}:${p.sport}`, b = `${p.dst}:${p.dport}`;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    let s = map.get(key);
    if (!s) {
      // 最初に SYN（ACK なし）を送った側をクライアントとする。無ければ最初のパケットの送信元
      s = { id: map.size, client: a, server: b, packets: 0, bytes: 0, segs: { c: [], s: [] }, first: p.no };
      map.set(key, s);
    }
    if (p.flags.includes('SYN') && !p.flags.includes('ACK')) {
      s.client = a;
      s.server = b;
    }
    s.packets++;
    if (p.payload.length) {
      s.bytes += p.payload.length;
      s.segs[a === s.client ? 'c' : 's'].push(p);
    }
  }
  const assemble = (segs) => {
    const sorted = [...segs].sort((x, y) => x.seq - y.seq || x.no - y.no);
    const chunks = [];
    let next = null;
    for (const p of sorted) {
      if (next === null) next = p.seq;
      const end = p.seq + p.payload.length;
      if (end <= next) continue; // 再送
      chunks.push(p.payload.subarray(Math.max(0, next - p.seq)));
      next = end;
    }
    return concat(chunks);
  };
  return [...map.values()].map((s) => {
    // 一方向の送信者が最初に分からなかった場合に備えて、各セグメントの向きを決め直す
    const c = [], sv = [];
    for (const p of [...s.segs.c, ...s.segs.s]) (`${p.src}:${p.sport}` === s.client ? c : sv).push(p);
    return { id: s.id, client: s.client, server: s.server, packets: s.packets, bytes: s.bytes, first: s.first, toServer: assemble(c), toClient: assemble(sv) };
  });
}

// ---------- HTTP ----------
function parseHttpMessages(data) {
  const msgs = [];
  const latin = new TextDecoder('latin1');
  let o = 0;
  while (o < data.length && msgs.length < 500) {
    const headEnd = indexOfSeq(data, [13, 10, 13, 10], o);
    if (headEnd < 0) break;
    const head = latin.decode(data.subarray(o, headEnd));
    const lines = head.split('\r\n');
    if (!/^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH) \S+ HTTP\/|^HTTP\/\d/.test(lines[0])) break;
    const headers = {};
    for (const l of lines.slice(1)) {
      const i = l.indexOf(':');
      if (i > 0) headers[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim();
    }
    let p = headEnd + 4;
    let body;
    if (/chunked/i.test(headers['transfer-encoding'] ?? '')) {
      const chunks = [];
      for (;;) {
        const le = indexOfSeq(data, [13, 10], p);
        if (le < 0) break;
        const size = parseInt(latin.decode(data.subarray(p, le)), 16);
        if (!size) {
          p = le + 4;
          break;
        }
        chunks.push(data.subarray(le + 2, le + 2 + size));
        p = le + 2 + size + 2;
      }
      body = concat(chunks);
    } else if (headers['content-length']) {
      const n = parseInt(headers['content-length'], 10);
      body = data.subarray(p, p + n);
      p += n;
    } else if (/^HTTP/.test(lines[0]) && !/^HTTP\/\S+ (1\d\d|204|304)/.test(lines[0])) {
      body = data.subarray(p);
      p = data.length;
    } else body = new Uint8Array();
    msgs.push({ firstLine: lines[0], headers, body });
    o = p;
  }
  return msgs;
}

function indexOfSeq(b, seq, from) {
  for (let i = from; i <= b.length - seq.length; i++) {
    let ok = true;
    for (let j = 0; j < seq.length; j++) {
      if (b[i + j] !== seq[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

export function httpExchanges(streams) {
  const out = [];
  for (const s of streams) {
    const reqs = parseHttpMessages(s.toServer), resps = parseHttpMessages(s.toClient);
    reqs.forEach((req, i) => out.push({ stream: s.id, host: req.headers.host ?? s.server, request: req, response: resps[i] ?? null }));
  }
  return out;
}

// ---------- pcap を組み立てる（サンプル作成・テスト用） ----------
// packets: [{ src, dst, proto: 'tcp'|'udp', sport, dport, seq, flags: ['SYN',...], payload: Uint8Array, ts }]
export function buildPcap(packets) {
  const ipb = (s) => s.split('.').map(Number);
  const recs = [];
  const FL = { FIN: 1, SYN: 2, RST: 4, PSH: 8, ACK: 16, URG: 32 };
  packets.forEach((p, i) => {
    const pl = p.payload ?? new Uint8Array();
    const l4 = p.proto === 'udp'
      ? [p.sport >> 8, p.sport & 255, p.dport >> 8, p.dport & 255, (pl.length + 8) >> 8, (pl.length + 8) & 255, 0, 0]
      : [p.sport >> 8, p.sport & 255, p.dport >> 8, p.dport & 255,
        (p.seq >>> 24) & 255, (p.seq >>> 16) & 255, (p.seq >>> 8) & 255, p.seq & 255, 0, 0, 0, 0,
        0x50, (p.flags ?? ['ACK']).reduce((a, f) => a | FL[f], 0), 0xff, 0xff, 0, 0, 0, 0];
    const total = 20 + l4.length + pl.length;
    const ip = [0x45, 0, total >> 8, total & 255, 0, 0, 0x40, 0, 64, p.proto === 'udp' ? 17 : 6, 0, 0, ...ipb(p.src), ...ipb(p.dst)];
    const frame = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0x08, 0x00, ...ip, ...l4, ...pl]);
    const ts = p.ts ?? 1700000000 + i * 0.1;
    const sec = Math.floor(ts), us = Math.round((ts - sec) * 1e6);
    const hdr = new Uint8Array(16);
    const dv = new DataView(hdr.buffer);
    dv.setUint32(0, sec, true); dv.setUint32(4, us, true); dv.setUint32(8, frame.length, true); dv.setUint32(12, frame.length, true);
    recs.push(hdr, frame);
  });
  const gh = new Uint8Array(24);
  const g = new DataView(gh.buffer);
  g.setUint32(0, 0xa1b2c3d4, true); g.setUint16(4, 2, true); g.setUint16(6, 4, true); g.setUint32(16, 65535, true); g.setUint32(20, 1, true);
  return concat([gh, ...recs]);
}

// DNS の問い合わせパケットの中身（サンプル用）
export function buildDnsQuery(name, id = 0x1234) {
  const q = [];
  for (const label of name.split('.')) q.push(label.length, ...Array.from(label, (c) => c.charCodeAt(0)));
  return Uint8Array.from([id >> 8, id & 255, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, ...q, 0, 0, 1, 0, 1]);
}
