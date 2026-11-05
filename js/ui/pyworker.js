// Python 実行用の Web Worker。Pyodide（CPython を WebAssembly にしたもの）を
// 初回だけ CDN から読み込み、以後はこの Worker の中で Python を実行する。
// Worker なので無限ループは親から terminate で止められ、画面も固まらない。
/* eslint-disable no-restricted-globals */

const PYODIDE_VER = 'v0.26.4';
const DEFAULT_BASE = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VER}/full/`;
let BASE = DEFAULT_BASE; // 自己ホストする場合は run / preload で base を渡すと差し替わる

let pyodide = null;
let loading = null;

async function ensurePyodide() {
  if (pyodide) return pyodide;
  if (loading) return loading;
  loading = (async () => {
    postMessage({ type: 'status', phase: 'loading' });
    try {
      importScripts(BASE + 'pyodide.js');
    } catch (e) {
      throw new Error('OFFLINE');
    }
    // eslint-disable-next-line no-undef
    pyodide = await loadPyodide({ indexURL: BASE });
    pyodide.setStdout({ batched: (s) => postMessage({ type: 'out', stream: 'out', text: s + '\n' }) });
    pyodide.setStderr({ batched: (s) => postMessage({ type: 'out', stream: 'err', text: s + '\n' }) });
    postMessage({ type: 'status', phase: 'ready' });
    return pyodide;
  })();
  return loading;
}

let stdinLines = [];
function setupStdin(py) {
  py.setStdin({
    stdin: () => (stdinLines.length ? stdinLines.shift() : null), // null = EOF
  });
}

onmessage = async (ev) => {
  const msg = ev.data || {};
  if (msg.base) BASE = msg.base;
  if (msg.type === 'preload') { ensurePyodide().catch((e) => postMessage({ type: 'loaderror', message: e.message })); return; }
  if (msg.type !== 'run') return;
  const t0 = performance.now();
  let py;
  try {
    py = await ensurePyodide();
  } catch (e) {
    postMessage({ type: 'loaderror', message: e.message === 'OFFLINE'
      ? 'Python（Pyodide）の読み込みに失敗しました。初回だけインターネット接続が必要です（約 10MB）。接続を確認して、もう一度お試しください。'
      : `Python の初期化に失敗しました：${e.message}` });
    return;
  }
  stdinLines = (msg.stdin ? String(msg.stdin).split('\n') : []);
  setupStdin(py);
  let result, error = '';
  try {
    result = await py.runPythonAsync(msg.code);
    if (result !== undefined && result !== null) {
      try { result = String(result.toString ? result.toString() : result); } catch { result = String(result); }
      if (result && result.destroy) try { result.destroy(); } catch {}
    } else {
      result = undefined;
    }
  } catch (e) {
    // Python の例外は読みやすいよう最後の数行だけにする
    const full = String(e.message || e);
    const idx = full.indexOf('Traceback (most recent call last)');
    error = idx >= 0 ? full.slice(idx) : full;
  }
  postMessage({ type: 'done', result: result === undefined ? null : result, error, ms: Math.round(performance.now() - t0) });
};
