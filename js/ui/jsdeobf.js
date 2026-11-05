// 難読化 JS デコード：aaencode（顔文字）・jsfuck・packed eval などの難読化 JavaScript を、
// 「実行せずに」中身を取り出す。サンドボックス iframe（allow-scripts のみ・通信禁止）の中で
// 評価器（Function / eval）を乗っ取り、組み立てられたコード文字列を捕獲して返す。
import { $, h, copy, debounce } from './common.js';

export const DEOBF_KEY = 'ctfportal.deobfInput';

// 見た目から難読化の種類を推測する
export function detectObf(code) {
  const s = String(code);
  const nonSpace = s.replace(/\s/g, '');
  if (!nonSpace) return null;
  if (/^[\[\]()!+]+$/.test(nonSpace.slice(0, 2000)) && nonSpace.length > 50) return { id: 'jsfuck', label: 'JSFuck（[]()!+ だけで書かれたコード）' };
  if (/ﾟωﾟ|ﾟДﾟ|ﾟΘﾟ|ﾟｰﾟ|ﾟoﾟ/.test(s)) return { id: 'aaencode', label: 'aaencode（顔文字の難読化）' };
  if (/[ᆞωᒧ〳ｰ]{2,}/.test(s) && /constructor|\[[^\]]+\]\s*\[/.test(s + '[a][') ) return { id: 'kaomoji', label: '顔文字系の難読化（aaencode の変種）' };
  if (/eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e/.test(s)) return { id: 'packer', label: 'Dean Edwards Packer（eval(function(p,a,c,k,e,…）' };
  if (/\bJJEncode\b|\$=~\[\]/.test(s)) return { id: 'jjencode', label: 'jjencode（記号の難読化）' };
  if (/constructor\s*\)?\s*\[?|\bFunction\s*\(|\beval\s*\(|\.constructor\.constructor/.test(s)) return { id: 'eval', label: 'eval / Function で文字列を実行する形' };
  return { id: 'unknown', label: '種類は判別できず（eval / Function 経由なら復元できる可能性あり）' };
}

// サンドボックスの中で走らせ、Function / eval に渡された文字列を捕獲する（実行はしない）
export function deobfuscate(code, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const ifr = document.createElement('iframe');
    ifr.setAttribute('sandbox', 'allow-scripts'); // 同一オリジンにしない：ポータルの DOM・保存領域・Cookie に触れない
    ifr.style.display = 'none';
    ifr.setAttribute('aria-hidden', 'true');
    const token = 'dj' + Math.random().toString(36).slice(2);
    // コードは HTML に埋め込まず postMessage で渡す（</script> を含んでも安全）。CSP で外部通信を禁止
    const boot = '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'">'
      + '<script>(function(){var TK=' + JSON.stringify(token) + ',caps=[];'
      // 「return unescape」のように組み込み関数を返すだけの補助（JSFuck が使う）は本物を返す。それ以外は記録だけ
      + 'var HELP=/^\\s*return\\s*([A-Za-z_$][\\w$.]*)\\s*;?\\s*$/;'
      + 'function cap(){var a=arguments,c=String(a.length?a[a.length-1]:""),m=c.match(HELP);'
      + 'if(m)return function(){return m[1].split(".").reduce(function(o,k){return o==null?o:o[k];},window);};'
      + 'caps.push(c);return function(){return "";};}'
      + 'try{Object.defineProperty(Function.prototype,"constructor",{value:cap,writable:true,configurable:true});}catch(e){}'
      + 'try{window.Function=cap;}catch(e){}'
      + 'try{window.eval=function(s){caps.push(String(s));return undefined;};}catch(e){}'
      + 'try{window.setTimeout=function(f){if(typeof f==="string")caps.push(f);return 0;};window.setInterval=window.setTimeout;}catch(e){}'
      + 'try{document.write=function(s){caps.push("[document.write] "+s);};document.writeln=document.write;window.alert=function(s){caps.push("[alert] "+s);};}catch(e){}'
      + 'addEventListener("message",function(ev){if(!ev.data||ev.data.tk!==TK||!("code"in ev.data))return;'
      + 'var err="";window.onerror=function(m){err=String(m);return true;};'
      + 'try{var el=document.createElement("script");el.textContent=ev.data.code;document.documentElement.appendChild(el);}catch(e){err=e.message;}'
      + 'parent.postMessage({tk:TK,done:true,caps:caps,err:err},"*");});'
      + 'parent.postMessage({tk:TK,ready:true},"*");})();<\/script>';
    let done = false;
    const cleanup = () => { removeEventListener('message', onMsg); ifr.remove(); };
    const onMsg = (e) => {
      if (!e.data || e.data.tk !== token) return;
      if (e.data.ready) { ifr.contentWindow.postMessage({ tk: token, code: String(code) }, '*'); return; }
      if (e.data.done) { done = true; cleanup(); resolve({ caps: e.data.caps || [], err: e.data.err || '' }); }
    };
    addEventListener('message', onMsg);
    document.body.appendChild(ifr);
    ifr.srcdoc = boot;
    setTimeout(() => { if (!done) { cleanup(); resolve({ caps: [], err: '時間切れ（無限ループなどの可能性）' }); } }, timeoutMs);
  });
}

const SAMPLE = `/* 練習用：Function(コード)() の形の難読化（中身は実行されません） */
var _0x=["\\x64\\x6f\\x63\\x75\\x6d\\x65\\x6e\\x74\\x2e\\x74\\x69\\x74\\x6c\\x65\\x3d\\x27\\x66\\x6c\\x61\\x67\\x7b\\x64\\x33\\x30\\x62\\x66\\x75\\x73\\x63\\x34\\x74\\x33\\x64\\x7d\\x27"];
(0)["constructor"]["constructor"](_0x[0])();`;

export function initJsdeobf() {
  const input = $('jdIn'), out = $('jdOut'), info = $('jdInfo');
  $('jdSample').addEventListener('click', () => { input.value = SAMPLE; showType(); });
  $('jdClear').addEventListener('click', () => { input.value = ''; out.replaceChildren(); showType(); });
  $('jdRun').addEventListener('click', () => run(input.value, 1));
  input.addEventListener('input', debounce(showType, 200));

  function showType() {
    const t = detectObf(input.value);
    info.replaceChildren(t ? h('span', {}, '見た目からの推測：', h('b', {}, t.label)) : h('span', { class: 'hint' }, '難読化された JavaScript を貼り付けてください'));
  }

  async function run(code, depth) {
    if (!code.trim()) return;
    if (depth === 1) out.replaceChildren(h('p', { class: 'hint' }, 'デコード中…'));
    const { caps, err } = await deobfuscate(code);
    const layer = h('article', { class: 'card jd-layer' }, h('h2', { class: 'wf-h' }, `第 ${depth} 段の結果`));
    if (!caps.length) {
      layer.append(h('p', {}, err ? `取り出せませんでした：${err}` : '評価器（eval / Function）に渡された文字列はありませんでした。'),
        h('p', { class: 'hint' }, 'eval / Function を使わない難読化（文字列を直接 document.write しない形など）は、この方法では取り出せません。整形して読む・エンコード / デコードで部分を戻す、を試してください。'));
    }
    caps.forEach((c, i) => {
      const flags = [...c.matchAll(/[A-Za-z0-9_]{2,}\{[^}\n]{1,120}\}/g)].map((m) => m[0]);
      layer.append(h('div', { class: 'wf-code' },
        h('div', { class: 'wf-code-head' }, h('span', {}, caps.length > 1 ? `捕獲 ${i + 1}` : '復元されたコード'), h('span', { class: 'hint' }, ((t) => !t || t.id === 'unknown' ? '素の JS（これ以上の難読化は見当たらない）' : `まだ難読化あり：${t.label}`)(detectObf(c))),
          h('button', { type: 'button', class: 'ghost small', onclick: () => copy(c) }, 'コピー'),
          h('button', { type: 'button', class: 'ghost small', onclick: () => { input.value = c; showType(); run(c, depth + 1); } }, 'さらにデコード')),
        h('pre', {}, c.length > 20000 ? c.slice(0, 20000) + '\n… (長いので省略。コピーで全文を取得)' : c)),
      flags.length ? h('div', { class: 'wf-flag' }, 'フラグらしき文字列：', ...flags.map((f) => h('code', {}, f))) : '');
    });
    if (depth === 1) out.replaceChildren(layer); else out.append(layer);
    layer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // フォーム解析から送られてきたコード
  try {
    const sent = sessionStorage.getItem(DEOBF_KEY);
    if (sent) { sessionStorage.removeItem(DEOBF_KEY); input.value = sent; }
  } catch {}
  showType();
  return () => {
    try {
      const sent = sessionStorage.getItem(DEOBF_KEY);
      if (sent) { sessionStorage.removeItem(DEOBF_KEY); input.value = sent; showType(); out.replaceChildren(); }
    } catch {}
  };
}
