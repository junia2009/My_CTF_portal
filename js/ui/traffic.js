// pcap 解析とログ解析
import { parseCapture, tcpStreams, httpExchanges } from '../lib/pcap.js';
import { analyzeLog, parseTime } from '../lib/logs.js';
import { hexdump, identifyType } from '../lib/file.js';
import { latin1Decode, bytesToText, isUtf8 } from '../lib/codecs.js';
import { findFlags, DEFAULT_FLAG_PATTERN } from '../lib/flag.js';
import { flagRegex } from '../lib/magic.js';
import { streamTransform } from '../lib/recipe.js';
import { $, h, copy, toast, download, debounce, fmtSize, getPrefixes, setTable, registerReceiver, sendTo, pallasSay } from './common.js';

const readable = (b, max = 200000) => {
  const s = isUtf8(b.subarray(0, max)) ? bytesToText(b.subarray(0, max)) : latin1Decode(b.subarray(0, max));
  return s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '·') + (b.length > max ? '\n…（以降省略）' : '');
};

function dropzone(zoneId, inputId, onFile) {
  const zone = $(zoneId);
  ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('over'); }));
  zone.addEventListener('drop', (e) => e.dataTransfer.files[0] && onFile(e.dataTransfer.files[0]));
  $(inputId).addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) onFile(f);
  });
}

// ================= pcap =================
export function initPcap() {
  let cap = null, streams = [], current = null, name = '';

  async function load(file) {
    name = file.name;
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      cap = parseCapture(bytes);
    } catch (e) {
      toast(e.message);
      return;
    }
    streams = tcpStreams(cap.packets);
    $('pcapResult').hidden = false;
    $('pcapDrop').querySelector('.dz-main').textContent = `${file.name}（${fmtSize(bytes.length)}）— 別のファイルを選ぶ`;
    const protos = {};
    cap.packets.forEach((p) => (protos[p.proto] = (protos[p.proto] ?? 0) + 1));
    $('pcapInfo').replaceChildren(
      h('span', {}, cap.format),
      h('span', {}, `${cap.packets.length.toLocaleString()} パケット`),
      h('span', {}, `${cap.duration.toFixed(2)} 秒`),
      h('span', {}, `TCP の会話 ${streams.length}`),
      ...Object.entries(protos).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => h('span', { class: 'accent' }, `${k} ${v}`)),
    );
    renderPackets();
    renderStreams();
    renderHttp();
    renderDns();
    // 通信全体からフラグを探す
    const all = cap.packets.filter((p) => p.payload.length).map((p) => latin1Decode(p.payload)).join('\n').slice(0, 2_000_000);
    let hits = [];
    try {
      hits = findFlags(all, DEFAULT_FLAG_PATTERN, getPrefixes()).filter((x) => flagRegex(getPrefixes()).test(x.match));
    } catch { /* 無視 */ }
    $('pcapAlerts').replaceChildren(hits.length
      ? h('div', { class: 'alert ok' }, '通信の中にフラグらしき文字列：', ...hits.slice(0, 8).map((x) => h('b', { class: 'flag-hit copyable', title: x.source, onclick: () => copy(x.match) }, x.match)))
      : '');
    pallasSay(hits.length
      ? { kind: 'pcapFlag', mood: 'happy', flag: hits[0].match, anchor: '#pcapAlerts' }
      : { kind: 'pcapLoaded', mood: 'talk', n: cap.packets.length, streams: streams.length, anchor: '#pcapInfo' });
  }

  // ---- パケット一覧 ----
  function renderPackets() {
    const q = $('pktFilter').value.trim().toLowerCase();
    const list = cap.packets.filter((p) => !q || `${p.src} ${p.dst} ${p.proto} ${p.sport ?? ''} ${p.dport ?? ''} ${p.info}`.toLowerCase().includes(q));
    const shown = list.slice(0, 1500);
    $('pktCount').textContent = `${list.length.toLocaleString()} 件${list.length > shown.length ? `（先頭 ${shown.length} 件を表示）` : ''}`;
    setTable($('pktTable'), ['No.', '時刻', '送信元', '宛先', '種類', '長さ', '内容'], shown.map((p) =>
      h('tr', { class: `pkt p-${p.proto.toLowerCase()}`, onclick: (e) => showPacket(p, e.currentTarget) },
        h('td', { class: 'num' }, p.no), h('td', { class: 'num' }, p.rel.toFixed(3)),
        h('td', {}, p.src), h('td', {}, p.dst), h('td', { class: 'num' }, p.proto), h('td', { class: 'num' }, p.len),
        h('td', {}, p.info),
      )));
  }
  function showPacket(p, row) {
    document.querySelectorAll('#pktTable tr.detail').forEach((r) => r.remove());
    if (row.classList.contains('open')) {
      row.classList.remove('open');
      return;
    }
    document.querySelectorAll('#pktTable tr.open').forEach((r) => r.classList.remove('open'));
    row.classList.add('open');
    row.after(h('tr', { class: 'detail' }, h('td', { colspan: '7' },
      p.payload.length ? h('pre', { class: 'hexdump' }, hexdump(p.payload, 0, 4096)) : h('span', { class: 'hint' }, '（データなし）'))));
  }
  $('pktFilter').addEventListener('input', debounce(() => cap && renderPackets(), 200));

  // ---- TCP の会話 ----
  function renderStreams() {
    $('streamView').hidden = true;
    if (!streams.length) {
      $('streamTable').replaceChildren(h('tr', {}, h('td', { class: 'hint' }, 'TCP の会話はありません')));
      return;
    }
    setTable($('streamTable'), ['#', 'クライアント', 'サーバー', 'パケット', 'データ', ''], streams.map((s) =>
      h('tr', {},
        h('td', { class: 'num' }, s.id), h('td', {}, s.client), h('td', {}, s.server), h('td', { class: 'num' }, s.packets), h('td', { class: 'num' }, fmtSize(s.bytes)),
        h('td', { class: 'num' }, h('button', { type: 'button', class: 'ghost small', onclick: () => openStream(s) }, '表示')),
      )));
  }
  function openStream(s) {
    current = s;
    $('streamView').hidden = false;
    $('streamTitle').textContent = `#${s.id}　${s.client} ⇄ ${s.server}`;
    const hex = $('streamFmt').value === 'hex';
    const block = (cls, label, data) => h('div', { class: `stream-dir ${cls}` },
      h('div', { class: 'stream-label' }, `${label}（${fmtSize(data.length)}）`),
      h('pre', {}, data.length ? (hex ? hexdump(data, 0, 65536) : readable(data)) : '（データなし）'));
    $('streamBody').replaceChildren(block('c', 'クライアント → サーバー', s.toServer), block('s', 'サーバー → クライアント', s.toClient));
    $('streamView').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('streamFmt').addEventListener('change', () => current && openStream(current));
  $('streamSaveC').addEventListener('click', () => current && download(current.toServer, `${name}.stream${current.id}.c2s.bin`));
  $('streamSaveS').addEventListener('click', () => current && download(current.toClient, `${name}.stream${current.id}.s2c.bin`));

  // ---- HTTP ----
  async function bodyOf(msg) {
    const enc = (msg.headers['content-encoding'] ?? '').toLowerCase();
    if (enc === 'gzip' || enc === 'deflate') {
      try {
        return await streamTransform(msg.body, new DecompressionStream(enc));
      } catch { /* 展開できなければそのまま */ }
    }
    return msg.body;
  }
  async function renderHttp() {
    const ex = httpExchanges(streams);
    if (!ex.length) {
      $('httpOut').replaceChildren(h('p', { class: 'hint' }, 'HTTP のやり取りは見つかりませんでした（HTTPS は暗号化されているため中身は見えません）。'));
      return;
    }
    const cards = [];
    for (const [i, x] of ex.entries()) {
      const msgBlock = async (label, msg) => {
        if (!msg) return h('div', { class: 'http-msg' }, h('div', { class: 'stream-label' }, `${label}：なし`));
        const body = await bodyOf(msg);
        const type = identifyType(body);
        const fname = `${name}.http${i}.${type?.ext ?? 'bin'}`;
        return h('div', { class: 'http-msg' },
          h('div', { class: 'stream-label' }, label),
          h('div', { class: 'http-line' }, msg.firstLine),
          h('details', {}, h('summary', {}, `ヘッダ（${Object.keys(msg.headers).length}）`),
            h('pre', { class: 'hexdump' }, Object.entries(msg.headers).map(([k, v]) => `${k}: ${v}`).join('\n'))),
          body.length ? h('div', {},
            h('div', { class: 'meta-line' }, h('span', {}, `本文 ${fmtSize(body.length)}`), type ? h('span', { class: 'accent' }, type.name) : '', msg.headers['content-type'] ? h('span', {}, msg.headers['content-type']) : ''),
            !type || type.ext === 'pem' ? h('pre', { class: 'hexdump http-body' }, readable(body, 8000)) : '',
            h('div', { class: 'row' },
              h('button', { type: 'button', class: 'ghost small', onclick: () => download(body, fname) }, '本文を保存'),
              h('button', { type: 'button', class: 'ghost small', onclick: () => sendTo('file', new File([body], fname)) }, 'ファイル解析へ'),
            ),
          ) : '',
        );
      };
      cards.push(h('div', { class: 'http-card' },
        h('div', { class: 'http-head' }, h('span', { class: 'tag' }, `#${x.stream}`), h('b', {}, x.host)),
        await msgBlock('リクエスト', x.request),
        await msgBlock('レスポンス', x.response),
      ));
    }
    $('httpOut').replaceChildren(...cards);
  }

  // ---- DNS ----
  function renderDns() {
    const rows = cap.packets.filter((p) => p.dns);
    if (!rows.length) {
      $('dnsTable').replaceChildren(h('tr', {}, h('td', { class: 'hint' }, 'DNS の通信はありません')));
      return;
    }
    setTable($('dnsTable'), ['No.', '種類', '名前', 'タイプ', '応答'], rows.flatMap((p) => p.dns.questions.map((q) =>
      h('tr', {},
        h('td', { class: 'num' }, p.no), h('td', { class: 'num' }, p.dns.isResp ? '応答' : '問い合わせ'),
        h('td', { class: 'copyable', onclick: () => copy(q.name) }, q.name), h('td', { class: 'num' }, q.type),
        h('td', {}, p.dns.answers.map((a) => a.data).join(', ')),
      ))));
  }

  dropzone('pcapDrop', 'pcapIn', load);
  registerReceiver('pcap', (f) => load(f));
}

// ================= ログ解析 =================
export function initLogs() {
  let lines = [], range = null;
  const fmtTime = (t, unit) => {
    const d = new Date(t + 9 * 3600e3); // 日本時間で表示
    const s = d.toISOString().replace('T', ' ');
    return unit === 60e3 ? s.slice(5, 16) : s.slice(5, 13) + '時';
  };

  function run() {
    const text = $('logIn').value;
    if (!text.trim()) {
      $('logResult').hidden = true;
      return;
    }
    const r = analyzeLog(text);
    lines = text.split(/\r?\n/).filter((l) => l.trim()).map((l) => ({ l, t: parseTime(l) }));
    range = null;
    $('logResult').hidden = false;
    const stat = (v, label) => h('div', { class: 'mini-stat' }, h('b', {}, v), h('span', {}, label));
    $('logSummary').replaceChildren(
      stat(r.total.toLocaleString(), '行'),
      stat(r.uniqueIps.toLocaleString(), 'IP アドレス'),
      stat(r.spikes.length, '急増した時間帯'),
      stat(r.suspicious.length ? r.suspicious[0].ip : '—', '最も失敗の多い IP'),
    );
    // 時間ごとのグラフ
    const max = Math.max(1, ...r.timeline.map((x) => x.count));
    $('logTimeline').replaceChildren(...(r.timeline.length
      ? r.timeline.map((x) => h('button', {
          type: 'button', class: `tl-bar${x.spike ? ' spike' : ''}`, title: `${fmtTime(x.t, r.unit)}：${x.count} 件`,
          style: `height:${Math.max(2, (x.count / max) * 100)}%`,
          onclick: () => { range = [x.t, x.t + r.unit]; $('logFilter').value = ''; renderLines(); },
        }))
      : [h('p', { class: 'hint' }, '時刻を読み取れませんでした')]));
    $('logRange').textContent = r.first ? `${fmtTime(r.first, 60e3)} 〜 ${fmtTime(r.last, 60e3)}（日本時間・${r.unit === 60e3 ? '1分' : '1時間'}ごと）` : '';
    const ipRow = (ip, ...cells) => h('tr', { onclick: () => { $('logFilter').value = ip; range = null; renderLines(); } }, h('td', { class: 'copyable' }, ip), ...cells);
    setTable($('logIps'), ['IP', '件数', '失敗'], r.ips.map((x) => ipRow(x.ip, h('td', { class: 'num' }, x.count), h('td', { class: 'num' }, x.fails || ''))));
    if (r.suspicious.length) setTable($('logSusp'), ['IP', '失敗', '全体'], r.suspicious.map((x) => ipRow(x.ip, h('td', { class: 'num' }, x.count), h('td', { class: 'num' }, x.total))));
    else $('logSusp').replaceChildren(h('tr', {}, h('td', { class: 'hint' }, '失敗を示す行は見つかりませんでした')));
    setTable($('logStatus'), ['ステータス', '件数'], r.statuses.map(([k, v]) => h('tr', { class: /^[45]/.test(k) ? 'hl' : '' }, h('td', { class: 'num' }, k), h('td', { class: 'num' }, v))));
    setTable($('logPaths'), ['パス', '件数'], r.paths.map(([k, v]) => h('tr', { onclick: () => { $('logFilter').value = k; range = null; renderLines(); } }, h('td', { class: 'copyable' }, k), h('td', { class: 'num' }, v))));
    renderLines();
    if (r.suspicious.length && r.suspicious[0].count >= 10) pallasSay({ kind: 'logSuspicious', mood: 'alert', ip: r.suspicious[0].ip, n: r.suspicious[0].count, anchor: '#logSusp' });
    else if (r.spikes.length) pallasSay({ kind: 'logSpike', mood: 'alert', anchor: '#logTimeline' });
  }

  function renderLines() {
    const q = $('logFilter').value.trim().toLowerCase();
    const list = lines.filter((x) => (!q || x.l.toLowerCase().includes(q)) && (!range || (x.t !== null && x.t >= range[0] && x.t < range[1])));
    $('logLineInfo').textContent = `${list.length.toLocaleString()} 行${range ? '（選んだ時間帯）' : ''}${q ? `（「${q}」を含む）` : ''}${list.length > 800 ? '・先頭 800 行を表示' : ''}`;
    $('logLines').textContent = list.slice(0, 800).map((x) => x.l).join('\n');
  }

  $('logIn').addEventListener('input', debounce(run, 400));
  $('logFilter').addEventListener('input', debounce(() => { range = null; renderLines(); }, 200));
  $('logFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    $('logIn').value = await f.text();
    run();
  });
  registerReceiver('logs', (p) => {
    $('logIn').value = p.text;
    run();
  });
}
