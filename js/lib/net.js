// IPv4 / CIDR 計算と、タイムスタンプ変換

export function parseIPv4(s) {
  const t = s.trim();
  if (/^\d+$/.test(t) && Number(t) <= 0xffffffff) return Number(t) >>> 0;
  if (/^0x[0-9a-f]{1,8}$/i.test(t)) return parseInt(t, 16) >>> 0;
  const m = t.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) throw new Error('IPv4 アドレスの形式ではありません');
  const p = m.slice(1).map(Number);
  if (p.some((x) => x > 255)) throw new Error('各オクテットは 0〜255 です');
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}

export const formatIPv4 = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
const toBin = (n) => [24, 16, 8, 0].map((s) => ((n >>> s) & 255).toString(2).padStart(8, '0')).join('.');

function maskToPrefix(mask) {
  const inv = ~mask >>> 0;
  if ((inv & (inv + 1)) !== 0) throw new Error('サブネットマスクが連続していません');
  return 32 - Math.log2(inv + 1);
}

const RANGES = [
  ['10.0.0.0/8', 'プライベート'], ['172.16.0.0/12', 'プライベート'], ['192.168.0.0/16', 'プライベート'],
  ['127.0.0.0/8', 'ループバック'], ['169.254.0.0/16', 'リンクローカル'], ['100.64.0.0/10', 'CGNAT 共有'],
  ['224.0.0.0/4', 'マルチキャスト'], ['0.0.0.0/8', '予約（このネットワーク）'], ['240.0.0.0/4', '予約'],
];

export function cidrInfo(input) {
  const [ipStr, pre] = input.trim().split(/\s*\/\s*|\s+/);
  const ip = parseIPv4(ipStr);
  let prefix = 32;
  if (pre !== undefined && pre !== '') {
    if (/^\d+$/.test(pre)) {
      prefix = Number(pre);
      if (prefix > 32) throw new Error('プレフィックス長は 0〜32 です');
    } else prefix = maskToPrefix(parseIPv4(pre));
  }
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);
  const small = prefix >= 31;
  const kind = RANGES.find(([r]) => {
    const [base, len] = r.split('/');
    const m = Number(len) === 0 ? 0 : (0xffffffff << (32 - Number(len))) >>> 0;
    return ((ip & m) >>> 0) === parseIPv4(base);
  })?.[1] ?? 'グローバル';
  return {
    ip: formatIPv4(ip),
    prefix,
    mask: formatIPv4(mask),
    wildcard: formatIPv4(~mask >>> 0),
    network: formatIPv4(network),
    broadcast: formatIPv4(broadcast),
    first: formatIPv4(small ? network : network + 1),
    last: formatIPv4(small ? broadcast : broadcast - 1),
    hosts: small ? total : total - 2,
    kind,
    int: String(ip),
    hex: '0x' + ip.toString(16).padStart(8, '0'),
    bin: toBin(ip),
    ptr: formatIPv4(ip).split('.').reverse().join('.') + '.in-addr.arpa',
  };
}

// ---------- タイムスタンプ ----------
const FILETIME_EPOCH_MS = 11644473600000n; // 1601-01-01 から 1970-01-01 までのミリ秒

function describe(ms, label) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime()) || Math.abs(ms) > 8.64e15) return null;
  return {
    label,
    utc: d.toISOString(),
    jst: d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false }) + ' (JST)',
    unix: Math.floor(ms / 1000),
    unixMs: ms,
    filetime: (BigInt(Math.round(ms)) + FILETIME_EPOCH_MS) * 10000n,
  };
}

export function convertTimestamp(input) {
  const t = input.trim();
  if (!t) throw new Error('値を入力してください');
  if (/^-?\d+(\.\d+)?$/.test(t)) {
    const out = [];
    const n = Number(t);
    const digits = t.replace(/^-/, '').split('.')[0].length;
    if (digits >= 17) {
      const ms = Number(BigInt(t.split('.')[0]) / 10000n - FILETIME_EPOCH_MS);
      out.push(describe(ms, 'Windows FILETIME（100ナノ秒単位・1601年起点）'));
    }
    if (digits >= 15) out.push(describe(n / 1000, 'UNIX 時間（マイクロ秒）'));
    if (digits >= 12) out.push(describe(n, 'UNIX 時間（ミリ秒）'));
    out.push(describe(n * 1000, 'UNIX 時間（秒）'));
    return out.filter(Boolean);
  }
  if (/^0x[0-9a-f]+$/i.test(t)) return convertTimestamp(BigInt(t).toString());
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) throw new Error('日時として読めません（例: 2026-11-02T10:00:00Z / 1700000000）');
  return [describe(d.getTime(), '入力した日時')];
}
