// 画面処理の共通ヘルパー
import { bytesToText, bytesToHex, b64Decode, hexToBytes, toBytes } from '../lib/codecs.js';
import { DEFAULT_PREFIXES } from '../lib/flag.js';

export const $ = (id) => document.getElementById(id);

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false || c === '') continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};

let toastTimer;
export function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('COPIED');
  } catch {
    toast('コピーできませんでした');
  }
}

export function download(bytes, name) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const kvRow = (k, v, copyable = true) =>
  h('tr', {}, h('th', {}, k), h('td', copyable ? { class: 'copyable', title: 'クリックでコピー', onclick: () => copy(String(v)) } : {}, String(v)));

export const debounce = (fn, ms = 150) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

// 制御文字を「·」に置き換えて、一覧表示用に短くする
export function preview(bytesOrText, n = 160) {
  const s = typeof bytesOrText === 'string' ? bytesOrText : bytesToText(bytesOrText.subarray(0, n * 4));
  const t = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '·').replace(/[\r\n\t]/g, '⏎');
  return t.length > n ? t.slice(0, n) + '…' : t;
}

export const fmtSize = (n) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`;

export const hex = (n, pad = 0) => '0x' + n.toString(16).padStart(pad, '0');

// 入力欄の値を、指定された形式でバイト列として読む
export function readBytes(value, fmt) {
  if (fmt === 'hex') return hexToBytes(value);
  if (fmt === 'b64') return b64Decode(value);
  return toBytes(value);
}

export const keyText = (k) => {
  const printable = k.every((x) => x >= 0x20 && x <= 0x7e);
  return printable ? `"${String.fromCharCode(...k)}"  (${bytesToHex(k)})` : bytesToHex(k, ' ');
};

// フラグの接頭辞（フラグ検索ページで設定したもの）
export const getPrefixes = () => String(store.get('ctfportal.flagPrefix', DEFAULT_PREFIXES.join(','))).split(',');

// タブ切り替え（.tabs のボタンと、直後の .tab-panels 内の data-panel を対応させる）
export function initTabs(root = document) {
  root.querySelectorAll('.tabs').forEach((tabs) => {
    const panels = tabs.nextElementSibling;
    const btns = [...tabs.querySelectorAll('[data-tab]')];
    const show = (id) => {
      btns.forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
      panels.querySelectorAll(':scope > [data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== id));
    };
    btns.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
    show(btns[0].dataset.tab);
  });
}

export function setTable(table, head, rows) {
  table.replaceChildren(h('tr', {}, ...head.map((x) => h('th', {}, x))), ...rows);
}
