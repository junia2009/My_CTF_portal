// ログ解析：IP・時刻・リクエスト・ステータスを読み取り、集計と急増の検出をする

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const RE = {
  ip: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/,
  apache: /\[(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})(?: ([+-]\d{4}))?\]/,
  iso: /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/,
  syslog: /^(\w{3})\s+(\d{1,2}) (\d{2}):(\d{2}):(\d{2})/,
  request: /"([A-Z]{3,7}) (\S+) HTTP\/[\d.]+" (\d{3})/,
  ua: /"([^"]*)"\s*$/,
  fail: /fail|invalid|denied|unauthori[sz]ed|forbidden|error|refused|\s40[13]\s/i,
};

export function parseTime(line) {
  let m = line.match(RE.apache);
  if (m) {
    let t = Date.UTC(+m[3], MONTHS[m[2]] ?? 0, +m[1], +m[4], +m[5], +m[6]);
    if (m[7]) t -= (m[7][0] === '-' ? -1 : 1) * (parseInt(m[7].slice(1, 3), 10) * 60 + parseInt(m[7].slice(3), 10)) * 60000;
    return t;
  }
  m = line.match(RE.iso);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  m = line.match(RE.syslog);
  if (m && MONTHS[m[1]] !== undefined) return Date.UTC(new Date().getUTCFullYear(), MONTHS[m[1]], +m[2], +m[3], +m[4], +m[5]);
  return null;
}

const top = (map, n = 15) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n);
const inc = (map, k) => map.set(k, (map.get(k) ?? 0) + 1);

export function analyzeLog(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const ips = new Map(), fails = new Map(), statuses = new Map(), paths = new Map(), methods = new Map(), uas = new Map();
  const times = [];
  for (const line of lines) {
    const ip = line.match(RE.ip)?.[0];
    if (ip) inc(ips, ip);
    const t = parseTime(line);
    if (t !== null) times.push(t);
    const r = line.match(RE.request);
    if (r) {
      inc(methods, r[1]);
      inc(paths, r[2].split('?')[0]);
      inc(statuses, r[3]);
      const ua = line.match(RE.ua)?.[1];
      if (ua && ua !== '-') inc(uas, ua);
    }
    if (ip && (RE.fail.test(line) || (r && /^[45]/.test(r[3])))) inc(fails, ip);
  }

  // 時間ごとの件数（期間が3時間以内なら1分単位、それ以上なら1時間単位）
  let timeline = [], spikes = [], unit = null, first = null, last = null;
  if (times.length) {
    first = Math.min(...times);
    last = Math.max(...times);
    unit = last - first <= 3 * 3600e3 ? 60e3 : 3600e3;
    const start = Math.floor(first / unit) * unit;
    const n = Math.min(2000, Math.floor((last - start) / unit) + 1);
    const counts = new Array(n).fill(0);
    for (const t of times) {
      const i = Math.floor((t - start) / unit);
      if (i < n) counts[i]++;
    }
    const mean = counts.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(counts.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    timeline = counts.map((c, i) => ({ t: start + i * unit, count: c, spike: n > 3 && c >= 5 && c > mean + 2.5 * sd }));
    spikes = timeline.filter((x) => x.spike);
  }

  return {
    total: lines.length,
    uniqueIps: ips.size,
    first, last, unit,
    ips: top(ips).map(([ip, count]) => ({ ip, count, fails: fails.get(ip) ?? 0 })),
    suspicious: top(fails, 10).map(([ip, count]) => ({ ip, count, total: ips.get(ip) ?? 0 })),
    statuses: top(statuses, 20),
    methods: top(methods),
    paths: top(paths),
    uas: top(uas, 10),
    timeline, spikes,
  };
}
