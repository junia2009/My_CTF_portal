// 解析系の画面：ファイル解析 / ハッシュ / JWT / フラグ検索 / ネットワーク・時刻
import * as C from '../lib/codecs.js';
import * as F from '../lib/file.js';
import { computeHashes, identifyHash } from '../lib/hash.js';
import { decodeJwt } from '../lib/jwt.js';
import { findFlags, DEFAULT_FLAG_PATTERN } from '../lib/flag.js';
import { flagRegex } from '../lib/magic.js';
import { cidrInfo, convertTimestamp } from '../lib/net.js';
import { $, h, store, copy, toast, kvRow, debounce, download, fmtSize, hex, getPrefixes, setTable, registerReceiver, fill, pallasSay, sendTo } from './common.js';

// ================= ファイル解析 =================
export function initFile() {
  let bytes = null, name = '', strings = [], dumpOff = 0;
  const PAGE = 1024;

  const drop = $('drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => e.dataTransfer.files[0] && load(e.dataTransfer.files[0]));
  $('fileIn').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) load(f);
  });

  async function load(file) {
    if (file.size > 256 * 1024 * 1024) {
      toast('256MB を超えるファイルは扱えません');
      return;
    }
    name = file.name;
    bytes = new Uint8Array(await file.arrayBuffer());
    $('fileResult').hidden = false;
    $('drop').classList.add('loaded');
    $('drop').querySelector('.dz-main').textContent = `${name}（${fmtSize(bytes.length)}）— 別のファイルを選ぶ`;
    summary();
    entropyChart();
    sigs();
    png();
    strings = F.extractStrings(bytes, Number($('strMin').value) || 5, 20000);
    renderStrings();
    const flags = flagsFromStrings();
    dumpOff = 0;
    renderDump();
    // 見つけたものを PALLAS に報告してもらう
    const embedded = F.scanSignatures(bytes).filter((s) => s.offset > 0).length;
    const trailing = F.findTrailingData(bytes);
    const crcBad = F.parsePng(bytes)?.chunks.some((c) => !c.crcOk);
    const findings = [trailing && '末尾の余分なデータ', embedded && `埋め込まれたファイルの署名 ${embedded} 件`, crcBad && 'PNG の CRC エラー'].filter(Boolean);
    if (flags.length) pallasSay({ kind: 'fileFlag', mood: 'happy', flag: flags[0].match, anchor: '#fileAlerts' });
    else if (findings.length) pallasSay({ kind: 'fileSuspicious', mood: 'alert', findings: findings.join('、'), anchor: '#fileAlerts' });
    else pallasSay({ kind: 'fileClean', mood: 'think', anchor: '#fileSummary' });
  }

  async function summary() {
    const type = F.identifyType(bytes);
    const ent = F.entropy(bytes);
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    const rows = [
      kvRow('ファイル名', name),
      kvRow('サイズ', `${fmtSize(bytes.length)}（${bytes.length.toLocaleString()} バイト）`, false),
      kvRow('形式（先頭バイト）', type ? `${type.name}` : '不明（テキスト、または未対応の形式）', false),
      kvRow('先頭 16 バイト', C.bytesToHex(bytes.subarray(0, 16), ' ')),
      kvRow('エントロピー', `${ent.toFixed(3)} / 8  ${ent > 7.5 ? '（圧縮・暗号化データの可能性）' : ent < 5 ? '（テキストや規則的なデータ）' : ''}`, false),
    ];
    $('fileSummary').replaceChildren(...rows, h('tr', {}, h('th', {}, 'ハッシュ'), h('td', { class: 'hint' }, 'CALCULATING…')));
    const alerts = [];
    if (type && ext && !type.ext.split('/').includes(ext) && !(type.ext === 'zip' && ['docx', 'xlsx', 'pptx', 'jar', 'apk', 'odt'].includes(ext)) && !(type.ext === 'jpg' && ext === 'jpeg')) {
      alerts.push(h('div', { class: 'alert' }, `拡張子 .${ext} と中身（${type.name}）が一致しません。拡張子が偽装されている可能性があります。`));
    }
    const tool = { png: 'image', jpg: 'image', gif: 'image', bmp: 'image', webp: 'image', wav: 'audio', mp3: 'audio', flac: 'audio', ogg: 'audio', pcap: 'pcap', pcapng: 'pcap' }[type?.ext];
    if (tool) {
      const label = { image: '画像解析', audio: '音声解析', pcap: 'pcap 解析' }[tool];
      alerts.push(h('div', { class: 'alert ok' }, `${type.name}です。${label}で、より詳しく調べられます。`,
        h('button', { type: 'button', class: 'small', onclick: () => sendTo(tool, new File([bytes], name)) }, `${label}で開く`)));
    }
    const tr = F.findTrailingData(bytes);
    if (tr) {
      alerts.push(h('div', { class: 'alert' },
        `${tr.type} の終端（${hex(tr.end)}）の後ろに ${fmtSize(tr.size)} の余分なデータがあります。`,
        h('button', { type: 'button', class: 'ghost small', onclick: () => download(bytes.subarray(tr.end), `${name}.trailing.bin`) }, '余分なデータを保存'),
        h('button', { type: 'button', class: 'ghost small', onclick: () => jump(tr.end) }, 'ダンプで見る'),
      ));
    }
    $('fileAlerts').replaceChildren(...alerts);
    const hs = await computeHashes(bytes);
    $('fileSummary').replaceChildren(...rows, ...Object.entries(hs).map(([k, v]) => kvRow(k, v)));
  }

  function entropyChart() {
    const blocks = F.entropyBlocks(bytes, 96);
    $('fileEntropy').replaceChildren(
      ...blocks.map((b) => h('i', {
        class: b.value > 7.5 ? 'hot' : '',
        style: `height:${Math.max(2, (b.value / 8) * 100)}%`,
        title: `${hex(b.offset)}〜: ${b.value.toFixed(2)}`,
        onclick: () => jump(b.offset),
      })),
    );
  }

  function sigs() {
    const hits = F.scanSignatures(bytes);
    if (!hits.length) {
      $('fileSigs').replaceChildren(h('tr', {}, h('td', { class: 'hint' }, '既知の署名は見つかりませんでした')));
      return;
    }
    setTable($('fileSigs'), ['オフセット', '形式', ''], hits.map((s) =>
      h('tr', { class: s.offset > 0 ? 'hl' : '' },
        h('td', { class: 'num' }, `${hex(s.offset)}`),
        h('td', {}, s.name, s.offset === 0 ? h('span', { class: 'tag' }, '先頭') : h('span', { class: 'tag warn' }, '埋め込み')),
        h('td', { class: 'num actions' },
          h('button', { type: 'button', class: 'ghost small', onclick: () => jump(s.offset) }, 'ダンプ'),
          s.offset > 0 ? h('button', { type: 'button', class: 'ghost small', onclick: () => download(bytes.subarray(s.offset), `${name}.${hex(s.offset)}.${s.ext}`) }, 'ここから保存') : '',
        ),
      ),
    ));
  }

  function png() {
    const p = F.parsePng(bytes);
    $('pngCard').hidden = !p;
    if (!p) return;
    const ihdr = p.chunks.find((c) => c.type === 'IHDR');
    const info = [];
    if (p.info) info.push(h('p', { class: 'meta-line' }, h('span', {}, `幅 ${p.info.width}`), h('span', {}, `高さ ${p.info.height}`), h('span', {}, `ビット深度 ${p.info.bitDepth}`), h('span', {}, `カラータイプ ${p.info.colorType}`)));
    if (ihdr && !ihdr.crcOk) {
      const btn = h('button', { type: 'button', class: 'small' }, 'CRC から正しい幅・高さを探す');
      btn.addEventListener('click', () => {
        btn.disabled = true;
        btn.textContent = 'SEARCHING…';
        setTimeout(() => {
          const r = F.pngFixDimensions(bytes);
          btn.remove();
          if (!r) {
            $('pngInfo').append(h('div', { class: 'alert' }, '一致する幅・高さが見つかりませんでした（IHDR の他の値が改ざんされている可能性があります）'));
          } else {
            pallasSay({ kind: 'pngFixed', mood: 'happy', w: r.width, h: r.height, anchor: '#pngInfo' });
            $('pngInfo').append(h('div', { class: 'alert ok' },
              `CRC が一致する値: 幅 ${r.width} × 高さ ${r.height}`,
              h('button', { type: 'button', class: 'ghost small', onclick: () => download(r.fixed, name.replace(/\.png$/i, '') + '_fixed.png') }, '修正した PNG を保存'),
            ));
          }
        }, 30);
      });
      info.push(h('div', { class: 'alert' }, 'IHDR の CRC が一致しません。幅や高さが書き換えられている可能性があります。', btn));
    }
    $('pngInfo').replaceChildren(...info);
    setTable($('pngChunks'), ['オフセット', '種類', '長さ', 'CRC'], p.chunks.map((c) =>
      h('tr', { class: c.crcOk ? '' : 'hl' },
        h('td', { class: 'num' }, hex(c.offset)),
        h('td', {}, c.type, /^[a-z]/.test(c.type) && !['tEXt', 'zTXt', 'iTXt', 'pHYs', 'sRGB', 'gAMA', 'cHRM', 'iCCP', 'bKGD', 'tIME', 'tRNS', 'sBIT', 'hIST', 'sPLT', 'eXIf'].includes(c.type) ? h('span', { class: 'tag warn' }, '独自') : ''),
        h('td', { class: 'num' }, c.length),
        h('td', { class: 'num' }, c.truncated ? '途中で切れています' : c.crcOk ? 'OK' : '不一致'),
      ),
    ));
  }

  function renderStrings() {
    const q = $('strFilter').value.toLowerCase();
    const re = flagRegex(getPrefixes());
    const only = $('strFlagOnly').checked;
    const list = strings.filter((s) => (!q || s.text.toLowerCase().includes(q)) && (!only || re.test(s.text) || /\{.*\}/.test(s.text)));
    const shown = list.slice(0, 2000);
    $('strInfo').textContent = `${strings.length.toLocaleString()} 件中 ${list.length.toLocaleString()} 件が該当${list.length > shown.length ? `（先頭 ${shown.length} 件を表示）` : ''}`;
    setTable($('fileStrings'), ['オフセット', '文字列'], shown.map((s) =>
      h('tr', { class: re.test(s.text) ? 'hl' : '' },
        h('td', { class: 'num' }, hex(s.offset), s.enc !== 'ASCII' ? h('span', { class: 'tag' }, 'UTF16') : ''),
        h('td', { class: 'copyable', onclick: () => copy(s.text) }, s.text.length > 300 ? s.text.slice(0, 300) + '…' : s.text),
      ),
    ));
  }

  function flagsFromStrings() {
    const joined = strings.map((s) => s.text).join('\n').slice(0, 1_000_000);
    let hits = [];
    try {
      hits = findFlags(joined, DEFAULT_FLAG_PATTERN, getPrefixes()).filter((x) => flagRegex(getPrefixes()).test(x.match));
    } catch { /* 無視 */ }
    if (hits.length) {
      $('fileAlerts').prepend(h('div', { class: 'alert ok' }, 'フラグらしき文字列: ',
        ...hits.slice(0, 10).map((x) => h('b', { class: 'flag-hit copyable', title: x.source, onclick: () => copy(x.match) }, x.match))));
    }
    return hits;
  }

  function renderDump() {
    dumpOff = Math.max(0, Math.min(dumpOff, Math.max(0, bytes.length - 1)));
    $('dumpOffset').value = hex(dumpOff);
    $('fileDump').textContent = F.hexdump(bytes, dumpOff, PAGE) || '(空のファイル)';
  }
  function jump(off) {
    dumpOff = off - (off % 16);
    renderDump();
    $('fileDump').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  $('dumpPrev').addEventListener('click', () => { dumpOff -= PAGE; renderDump(); });
  $('dumpNext').addEventListener('click', () => { if (dumpOff + PAGE < bytes.length) dumpOff += PAGE; renderDump(); });
  $('dumpOffset').addEventListener('change', () => {
    const v = $('dumpOffset').value.trim();
    const n = /^0x/i.test(v) ? parseInt(v, 16) : parseInt(v, 10);
    if (!Number.isNaN(n)) jump(n);
  });
  $('strMin').addEventListener('change', () => {
    if (!bytes) return;
    strings = F.extractStrings(bytes, Math.max(2, Number($('strMin').value) || 5), 20000);
    renderStrings();
  });
  $('strFilter').addEventListener('input', debounce(() => bytes && renderStrings(), 200));
  $('strFlagOnly').addEventListener('change', () => bytes && renderStrings());
  registerReceiver('file', (f) => load(f));
}

// ================= ハッシュ =================
export function initHash() {
  let seq = 0;
  async function upd() {
    const my = ++seq;
    const res = await computeHashes(C.toBytes($('hashIn').value));
    if (my !== seq) return;
    $('hashOut').replaceChildren(...Object.entries(res).map(([k, v]) => kvRow(k, v)));
  }
  $('hashIn').addEventListener('input', debounce(upd));
  registerReceiver('hash', (p) => {
    if (p.text !== undefined) fill('hashIn', p.text);
    if (p.id !== undefined) fill('hashId', p.id);
  });
  $('hashId').addEventListener('input', () => {
    const v = $('hashId').value.trim();
    const hits = identifyHash(v);
    $('hashIdOut').replaceChildren(
      !v ? '' : hits.length
        ? h('p', {}, '候補: ', ...hits.map((n) => h('span', { class: 'tag' }, n)))
        : h('p', { class: 'hint' }, `一致する形式がありません（${v.length}文字）`),
    );
  });
  upd();
}

// ================= JWT =================
export function initJwt() {
  registerReceiver('jwt', (p) => fill('jwtIn', p.text));
  $('jwtIn').addEventListener('input', () => {
    $('jwtErr').textContent = '';
    $('jwtOut').replaceChildren();
    if (!$('jwtIn').value.trim()) return;
    try {
      const r = decodeJwt($('jwtIn').value);
      const block = (title, obj) => [h('h4', {}, title), h('div', { class: 'mono-out', onclick: (e) => copy(e.currentTarget.textContent) }, JSON.stringify(obj, null, 2))];
      $('jwtOut').append(
        ...block('ヘッダ', r.header),
        ...block('ペイロード', r.payload),
        h('h4', {}, '署名（Base64URL）'),
        h('div', { class: 'mono-out' }, r.signature || '(なし)'),
        r.notes.length ? h('h4', {}, '気付いた点') : '',
        r.notes.length ? h('ul', { class: 'log' }, ...r.notes.map((n) => h('li', {}, n))) : '',
      );
    } catch (e) {
      $('jwtErr').textContent = e.message;
    }
  });
}

// ================= フラグ検索 =================
export function initFlag() {
  $('flagPattern').value = DEFAULT_FLAG_PATTERN;
  $('flagPrefix').value = getPrefixes().join(',');
  function upd() {
    $('flagErr').textContent = '';
    $('flagOut').replaceChildren();
    store.set('ctfportal.flagPrefix', $('flagPrefix').value);
    if (!$('flagIn').value.trim()) return;
    try {
      const hits = findFlags($('flagIn').value, $('flagPattern').value || DEFAULT_FLAG_PATTERN, $('flagPrefix').value.split(','));
      if (!hits.length) {
        $('flagOut').append(h('tr', {}, h('td', { class: 'hint' }, '見つかりませんでした')));
        return;
      }
      setTable($('flagOut'), ['見つかったもの（クリックでコピー）', '変換'], hits.map((r) =>
        h('tr', {}, h('td', { class: 'copyable', onclick: () => copy(r.match) }, h('b', { class: 'flag-hit' }, r.match)), h('td', { class: 'num' }, r.source)),
      ));
    } catch (e) {
      $('flagErr').textContent = e.message;
    }
  }
  for (const id of ['flagIn', 'flagPrefix', 'flagPattern']) $(id).addEventListener('input', debounce(upd, 200));
  registerReceiver('flag', (p) => fill('flagIn', p.text));
}

// ================= ネットワーク・時刻 =================
export function initNet() {
  $('cidrIn').addEventListener('input', debounce(() => {
    $('cidrErr').textContent = '';
    $('cidrOut').replaceChildren();
    const v = $('cidrIn').value.trim();
    if (!v) return;
    try {
      const r = cidrInfo(v);
      $('cidrOut').append(
        kvRow('アドレス', `${r.ip}/${r.prefix}`),
        kvRow('種別', r.kind, false),
        kvRow('ネットワーク', r.network),
        kvRow('ブロードキャスト', r.broadcast),
        kvRow('ホスト範囲', `${r.first} 〜 ${r.last}`),
        kvRow('ホスト数', r.hosts.toLocaleString(), false),
        kvRow('サブネットマスク', r.mask),
        kvRow('ワイルドカード', r.wildcard),
        kvRow('整数 / 16進', `${r.int} / ${r.hex}`),
        kvRow('2進', r.bin),
        kvRow('逆引き名', r.ptr),
      );
    } catch (e) {
      $('cidrErr').textContent = e.message;
    }
  }, 150));

  const ts = () => {
    $('tsErr').textContent = '';
    $('tsOut').replaceChildren();
    const v = $('tsIn').value.trim();
    if (!v) return;
    try {
      $('tsOut').append(...convertTimestamp(v).map((r) =>
        h('div', { class: 'ts-block' },
          h('h4', {}, r.label),
          h('table', { class: 'kv' },
            kvRow('UTC', r.utc), kvRow('日本時間', r.jst), kvRow('UNIX 秒', r.unix), kvRow('UNIX ミリ秒', r.unixMs), kvRow('FILETIME', r.filetime.toString()),
          ),
        ),
      ));
    } catch (e) {
      $('tsErr').textContent = e.message;
    }
  };
  $('tsIn').addEventListener('input', debounce(ts, 150));
  registerReceiver('net', (p) => {
    if (p.cidr) fill('cidrIn', p.cidr);
    if (p.ts) fill('tsIn', p.ts);
  });
  $('tsNow').addEventListener('click', () => {
    $('tsIn').value = String(Math.floor(Date.now() / 1000));
    ts();
  });
}
