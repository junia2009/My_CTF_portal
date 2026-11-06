// フォーム解析：問題の HTML を貼り付けると、送信先・入力欄・隠れた手がかりを一覧にし、
// 送信リクエストの組み立て・curl / fetch の生成・弱点の当たりを示す。
// すべてブラウザの中だけで静的に解析し、どこにも送信しない。
import { $, h, store, copy, debounce, registerReceiver } from './common.js';
import { DEOBF_KEY, detectObf } from './jsdeobf.js';

const SAMPLE = `<!-- TODO: remove debug account before release -->
<form action="/login" method="post">
  <input type="text" name="username" placeholder="ユーザー名" required maxlength="32">
  <input type="password" name="password" placeholder="パスワード" required>
  <input type="hidden" name="csrf_token" value="a1b2c3d4e5">
  <input type="hidden" name="redirect" value="/mypage">
  <button type="submit" name="action" value="login">ログイン</button>
</form>
<script>
  // クライアント側のチェック（サーバー側にもあるとは限らない）
  function check(f){ return f.username.value.length > 0 && f.password.value.length >= 8; }
</script>`;

// name / type から推測する弱点の当たり（確認は「Web 脆弱性の見つけ方」へ）
const HINTS = [
  [/pass|pwd|passwd/i, '認証・SQL インジェクション（ログイン回避）', 'authn'],
  [/user(name)?|login|email|e-?mail|account|mail|uid/i, '認証・SQL インジェクション', 'authn'],
  [/search|query|keyword|\bq\b|term|comment|message|title|body|content|note|text/i, 'XSS・SQL インジェクション', 'xss'],
  [/url|uri|link|site|host|callback|redirect|return|\bnext\b|dest|image|img|avatar|webhook|feed|proxy|fetch/i, 'SSRF・オープンリダイレクト', 'ssrf'],
  [/file|upload|download|filename|\bpath\b|\bdoc\b|\bpage\b|include|template|\bview\b|\bdir\b|folder/i, 'アップロード・パストラバーサル', 'upload'],
  [/cmd|command|exec|run|ping|traceroute|lookup|\bdns\b|\bip\b|domain|addr|host/i, 'コマンドインジェクション', 'other-inject'],
  [/\bid\b|uid|user_id|order|account_id|\bnum\b|\bno\b|\bpid\b|docid|ref|seq/i, '認可の不備（IDOR）', 'authz'],
];
const CHAPTER = { authn: '認証・セッションの弱さ', sqli: 'SQL インジェクション', xss: 'XSS', ssrf: 'SSRF', upload: 'ファイルのアップロード・パスの扱い', 'other-inject': 'そのほかのインジェクション', authz: '認可の不備（IDOR）', csrf: 'CSRF' };

const sh = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;
const esc = (s) => String(s);

export function initWebform() {
  const htmlIn = $('wfHtml'), baseIn = $('wfBase'), out = $('wfOut');
  registerReceiver('webform', (pl) => { htmlIn.value = pl.text || ''; render(); });
  $('wfSample').addEventListener('click', () => { htmlIn.value = SAMPLE; render(); });
  $('wfClear').addEventListener('click', () => { htmlIn.value = ''; render(); });
  htmlIn.addEventListener('input', debounce(render, 200));
  baseIn.addEventListener('input', debounce(render, 200));

  function parseForms(docp) {
    let forms = [...docp.querySelectorAll('form')];
    if (!forms.length) {
      // form タグが無くても、入力欄があれば擬似フォームとして扱う
      const loose = [...docp.querySelectorAll('input,select,textarea,button')];
      if (loose.length) return [{ el: null, loose }];
      return [];
    }
    return forms.map((el) => ({ el, loose: [...el.querySelectorAll('input,select,textarea,button')] }));
  }

  function fieldOf(c) {
    const tag = c.tagName.toLowerCase();
    const type = (c.getAttribute('type') || (tag === 'input' ? 'text' : tag)).toLowerCase();
    let value = '';
    if (tag === 'textarea') value = c.textContent;
    else if (tag === 'select') { const o = c.querySelector('option[selected]') || c.querySelector('option'); value = o ? (o.getAttribute('value') ?? o.textContent) : ''; }
    else value = c.getAttribute('value') ?? '';
    const name = c.getAttribute('name') || '';
    const attrs = {};
    for (const a of ['required', 'maxlength', 'minlength', 'pattern', 'disabled', 'readonly', 'placeholder', 'autocomplete', 'accept']) if (c.hasAttribute(a)) attrs[a] = c.getAttribute(a) || true;
    const checked = (type === 'checkbox' || type === 'radio') && c.hasAttribute('checked');
    const isBtn = type === 'submit' || type === 'button' || type === 'reset' || type === 'image';
    const include = !!name && !c.hasAttribute('disabled') && !isBtn && !(/(checkbox|radio)/.test(type) && !checked);
    const options = tag === 'select' ? [...c.querySelectorAll('option')].map((o) => o.getAttribute('value') ?? o.textContent) : null;
    return { tag, type, name, value, attrs, checked, isBtn, include, options };
  }

  function collectComments(docp) {
    const out = [];
    const w = docp.createTreeWalker(docp, NodeFilter.SHOW_COMMENT);
    let n; while ((n = w.nextNode())) { const t = (n.nodeValue || '').trim(); if (t) out.push(t); }
    return out;
  }

  function render() {
    const raw = htmlIn.value;
    if (!raw.trim()) { out.replaceChildren(h('p', { class: 'hint' }, 'HTML を貼り付けると解析します。右上の「サンプルを読み込む」でも試せます。')); return; }
    const docp = new DOMParser().parseFromString(raw, 'text/html');
    const forms = parseForms(docp);
    const base = baseIn.value.trim();
    const comments = collectComments(docp);
    const scripts = [...docp.querySelectorAll('script')];
    const flags = [...raw.matchAll(/[A-Za-z0-9_]{2,}\{[^}\n]{1,120}\}/g)].map((m) => m[0]).filter((f) => /flag|ctf|pctf|key/i.test(f));

    const nodes = [];
    nodes.push(h('div', { class: 'mn-callout warn' }, h('span', { class: 'mn-callout-label' }, '注意'), h('div', {}, h('p', {}, '生成した curl / fetch を実際に送るのは、CTF・自分が管理するサイト・許可された環境だけにしてください。'))));

    if (flags.length) nodes.push(h('div', { class: 'wf-flag' }, 'HTML の中にフラグらしき文字列：', ...flags.map((f) => h('code', {}, f))));

    if (!forms.length) {
      nodes.push(h('p', { class: 'hint' }, 'フォームや入力欄が見つかりませんでした。'));
    }
    forms.forEach((f, fi) => nodes.push(formCard(f, fi, forms.length, base)));

    // 隠れた手がかり
    const clue = [];
    if (comments.length) clue.push(h('div', { class: 'wf-clue' }, h('b', {}, 'HTML コメント'), h('div', { class: 'hint' }, '消し忘れたヒントやアカウント、フラグが入っていることがある'),
      ...comments.map((c) => h('pre', { class: 'wf-pre' }, c))));
    if (scripts.length) clue.push(h('div', { class: 'wf-clue' }, h('b', {}, `<script>（${scripts.length}）`), h('div', { class: 'hint' }, 'クライアント側の検証・隠しエンドポイント。ブラウザ側の検証はバイパスできる（サーバー側の確認を試す）'),
      ...scripts.map((s) => s.getAttribute('src')
        ? h('div', {}, '外部：', h('code', {}, s.getAttribute('src')))
        : h('div', {}, h('pre', { class: 'wf-pre' }, (s.textContent || '').trim().slice(0, 400) + ((s.textContent || '').length > 400 ? ' …' : '')),
          deobfLink(s.textContent || '')))));
    // ページ内の URL（別の入口）
    const urls = new Set();
    docp.querySelectorAll('[action],[href],[src]').forEach((e) => { const u = e.getAttribute('action') || e.getAttribute('href') || e.getAttribute('src'); if (u && !u.startsWith('data:') && !u.startsWith('#')) urls.add(u); });
    comments.concat(scripts.map((s) => s.textContent || '')).forEach((t) => [...String(t).matchAll(/https?:\/\/[^\s"'<>]+|\/[A-Za-z0-9_./?=-]{2,}/g)].forEach((m) => urls.add(m[0])));
    if (urls.size) clue.push(h('div', { class: 'wf-clue' }, h('b', {}, 'URL・パス'), h('div', { class: 'hint' }, 'action の送信先や、別のエンドポイント・隠しディレクトリの手がかり'),
      h('div', { class: 'wf-urls' }, ...[...urls].slice(0, 40).map((u) => h('code', {}, u)))));
    if (clue.length) nodes.push(h('article', { class: 'card' }, h('h2', { class: 'wf-h' }, '隠れた手がかり'), ...clue));

    // チェックリスト
    nodes.push(h('article', { class: 'card' }, h('h2', { class: 'wf-h' }, 'アプローチのチェックリスト'),
      h('ul', { class: 'wf-check' }, ...[
        'ソースを全部読む（hidden・コメント・読み込む script・コメントアウトされた入力）',
        'action（送信先）と method を確認。別のエンドポイントなら、そこを直接調べる',
        'name から用途を推測（user/pass→認証、q→検索、url→取得系、file→アップロード、cmd→実行系、id→参照）',
        'まず普通に送って、応答（ステータス・文言・リダイレクト・Set-Cookie・時間）を観察する',
        'maxlength / pattern / disabled / JS 検証を外して直接送り、サーバー側の検証を確かめる',
        '典型的な弱点を「診断」の目線で（下の当たりと「Web 脆弱性の見つけ方」へ）',
        'robots.txt・推測できる別パラメータ/エンドポイントも見る',
      ].map((t) => h('li', {}, t))),
      h('div', { class: 'wf-links' },
        h('a', { class: 'btn ghost small', href: '#learn/web-vuln' }, 'Web 脆弱性の見つけ方'),
        h('a', { class: 'btn ghost small', href: '#identify' }, '迷ったら診断'),
        h('a', { class: 'btn ghost small', href: '#learn/web-basic' }, 'Web の仕組み'),
        h('a', { class: 'btn ghost small', href: '#dict/linux' }, 'curl を辞典で引く'))));

    out.replaceChildren(...nodes);
  }

  // 1 つのフォームのカード
  function formCard(f, fi, total, base) {
    const el = f.el;
    const rawAction = el ? (el.getAttribute('action') || '') : '';
    const method = el ? (el.getAttribute('method') || 'GET').toUpperCase() : 'GET';
    let enctype = el ? (el.getAttribute('enctype') || '') : '';
    const fields = f.loose.map(fieldOf);

    // action を base で絶対 URL に解決
    let actionUrl = rawAction, actionNote = '';
    if (base) { try { actionUrl = new URL(rawAction || base, base).href; } catch { actionUrl = rawAction; } }
    else if (!rawAction) { actionUrl = '(同じ URL に送られる)'; actionNote = '問題の URL を上に入れると、送信先が決まります'; }

    const reqBox = h('div', { class: 'wf-req' });
    const rebuild = () => fillRequest(reqBox, { actionUrl: base ? actionUrl : (rawAction || '(同じ URL)'), method, enctype, fields });

    // フィールドの表
    const rows = fields.map((fl) => {
      const inc = h('input', { type: 'checkbox', ...(fl.include ? { checked: '' } : {}), 'aria-label': '送信に含める', disabled: fl.name ? undefined : '' });
      const val = h('input', { class: 'mono wf-val', value: fl.value, placeholder: fl.attrs.placeholder || '', 'aria-label': `${fl.name} の値` });
      inc.addEventListener('change', () => { fl.include = inc.checked; rebuild(); });
      val.addEventListener('input', () => { fl.value = val.value; rebuild(); });
      fl.include = inc.checked;
      const badges = [h('span', { class: 'wf-type' }, fl.type)];
      if (fl.type === 'hidden') badges.push(h('span', { class: 'wf-badge hid' }, 'hidden'));
      for (const [k, v] of Object.entries(fl.attrs)) if (k !== 'placeholder') badges.push(h('span', { class: 'wf-badge' }, v === true ? k : `${k}=${v}`));
      return h('tr', { class: fl.type === 'hidden' ? 'wf-row-hidden' : '' },
        h('td', { class: 'wf-inc' }, inc),
        h('td', {}, fl.name ? h('code', {}, fl.name) : h('span', { class: 'hint' }, '(name なし)')),
        h('td', {}, fl.isBtn ? h('span', { class: 'hint' }, 'ボタン') : val),
        h('td', { class: 'wf-attrs' }, ...badges));
    });

    const card = h('article', { class: 'card wf-form' },
      h('h2', { class: 'wf-h' }, total > 1 ? `フォーム ${fi + 1}` : 'フォーム'),
      h('table', { class: 'wf-meta' },
        h('tr', {}, h('th', {}, '送信先 action'), h('td', {}, h('code', {}, actionUrl), actionNote ? h('span', { class: 'hint' }, ` ${actionNote}`) : '')),
        h('tr', {}, h('th', {}, 'method'), h('td', {}, h('code', {}, method), method === 'GET' ? h('span', { class: 'hint' }, ' 値は URL のクエリに載る') : '')),
        enctype ? h('tr', {}, h('th', {}, 'enctype'), h('td', {}, h('code', {}, enctype))) : ''),
      fields.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'wf-fields' },
        h('thead', {}, h('tr', {}, h('th', { class: 'wf-inc' }, '送信'), h('th', {}, 'name'), h('th', {}, '値'), h('th', {}, '属性'))),
        h('tbody', {}, ...rows))) : h('p', { class: 'hint' }, '入力欄がありません'),
      vulnHints(fields),
      reqBox);
    rebuild();
    return card;
  }

  // 送信リクエストのプレビューと curl / fetch
  function fillRequest(box, { actionUrl, method, enctype, fields }) {
    const items = fields.filter((f) => f.include && f.name).map((f) => [f.name, f.value]);
    const hasFile = fields.some((f) => f.include && f.type === 'file');
    const multipart = hasFile || /multipart/i.test(enctype);
    const qs = new URLSearchParams(items).toString();
    const known = actionUrl && !actionUrl.startsWith('(');

    let reqText, curl, fetchCode;
    if (method === 'GET') {
      const url = known ? actionUrl + (actionUrl.includes('?') ? '&' : (qs ? '?' : '')) + qs : `${actionUrl}  ?${qs}`;
      reqText = `GET ${url}`;
      curl = `curl -i ${sh(known ? actionUrl + (actionUrl.includes('?') ? '&' : (qs ? '?' : '')) + qs : actionUrl + '?' + qs)}`;
      fetchCode = `fetch(${sh2(known ? actionUrl + (qs ? (actionUrl.includes('?') ? '&' : '?') + qs : '') : '<URL>?' + qs)})\n  .then(r => r.text()).then(console.log)`;
    } else if (multipart) {
      reqText = `${method} ${actionUrl}\nContent-Type: multipart/form-data\n\n` + items.map(([k, v]) => `  ${k} = ${v}`).join('\n');
      curl = `curl -i -X ${method} ${sh(actionUrl)}` + items.map(([k, v]) => ` \\\n  -F ${sh(fields.find((f) => f.name === k && f.type === 'file') ? `${k}=@path/to/file` : `${k}=${v}`)}`).join('');
      fetchCode = `const fd = new FormData();\n` + items.map(([k, v]) => `fd.append(${sh2(k)}, ${fields.find((f) => f.name === k && f.type === 'file') ? '/* File */' : sh2(v)});`).join('\n') + `\nfetch(${sh2(actionUrl)}, { method: ${sh2(method)}, body: fd }).then(r => r.text()).then(console.log)`;
    } else {
      const body = qs;
      reqText = `${method} ${actionUrl}\nContent-Type: application/x-www-form-urlencoded\n\n${body}`;
      curl = `curl -i -X ${method} ${sh(actionUrl)}` + items.map(([k, v]) => ` \\\n  --data-urlencode ${sh(`${k}=${v}`)}`).join('');
      fetchCode = `fetch(${sh2(actionUrl)}, {\n  method: ${sh2(method)},\n  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },\n  body: new URLSearchParams(${JSON.stringify(Object.fromEntries(items))})\n}).then(r => r.text()).then(console.log)`;
    }
    const block = (title, code, note) => h('div', { class: 'wf-code' },
      h('div', { class: 'wf-code-head' }, h('span', {}, title), note ? h('span', { class: 'hint' }, note) : '', h('button', { type: 'button', class: 'ghost small', onclick: () => copy(code) }, 'コピー')),
      h('pre', {}, code));
    box.replaceChildren(
      h('div', { class: 'wf-sec' }, '送信されるリクエスト'),
      block('プレビュー', reqText),
      block('curl', curl, 'ログインが要るなら -b \'session=…\' で Cookie を付ける'),
      block('fetch（ブラウザの Console 用）', fetchCode, '問題のページを開いた状態で実行すると Cookie が付く'));
  }

  function vulnHints(fields) {
    const found = new Map(); // chapterId -> label
    for (const f of fields) {
      if (!f.name && f.type !== 'file' && f.type !== 'password') continue;
      if (f.type === 'password') found.set('authn', CHAPTER.authn);
      if (f.type === 'file') found.set('upload', CHAPTER.upload);
      if (/csrf|token|authenticity|nonce/i.test(f.name)) found.set('csrf', CHAPTER.csrf);
      for (const [re, , ch] of HINTS) if (re.test(f.name)) found.set(ch, CHAPTER[ch]);
      // どんなテキスト入力も XSS / SQLi は確認対象
      if (/^(text|search|textarea|email|url|tel|)$/.test(f.type) && f.name && !f.isBtn) { found.set('xss', CHAPTER.xss); found.set('sqli', CHAPTER.sqli); }
    }
    if (!found.size) return '';
    return h('div', { class: 'wf-hints' }, h('div', { class: 'wf-sec' }, '試す価値のある弱点（当たり）'),
      h('div', { class: 'wf-hint-list' }, ...[...found].map(([ch, label]) =>
        h('a', { class: 'wf-hint', href: '#learn/web-vuln' }, h('b', {}, label), h('span', {}, '見つけ方へ ›')))),
      h('p', { class: 'hint' }, '確認は「弱点があるか」まで。悪用はしない。各章の「テスト入力 → サイン → 対策」で進める。'));
  }

  render();
}
// fetch コード用：JS 文字列リテラル
function sh2(s) { return JSON.stringify(String(s)); }

// 難読化されていそうな script には「JS 難読化解除」への導線を出す
function deobfLink(code) {
  const t = detectObf(code);
  if (!t || t.id === 'unknown' || code.trim().length < 40) return '';
  return h('div', { class: 'wf-deobf' }, h('span', { class: 'hint' }, `難読化の可能性：${t.label}`),
    h('button', { type: 'button', class: 'small', onclick: () => {
      try { sessionStorage.setItem(DEOBF_KEY, code); } catch {}
      location.hash = '#jsdeobf';
    } }, 'JS 難読化解除で開く →'));
}
