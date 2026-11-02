// PWA：Service Worker の登録、更新の通知、インストールボタン、オンライン状態の表示
import { $, toast, pallasSay } from './common.js';

export function initPwa() {
  initStatus();
  initInstall();
  initServiceWorker();
}

function initStatus() {
  const upd = () => {
    const online = navigator.onLine;
    $('sysStatus').classList.toggle('offline', !online);
    $('sysText').textContent = online ? 'SYSTEM ONLINE' : 'OFFLINE MODE';
  };
  window.addEventListener('online', upd);
  window.addEventListener('offline', () => {
    upd();
    toast('OFFLINE — キャッシュから動作中');
    pallasSay({ kind: 'offline', mood: 'alert' });
  });
  upd();
}

function initInstall() {
  let deferred = null;
  const btn = $('installBtn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });
  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    btn.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    btn.hidden = true;
    toast('INSTALLED');
  });
}

function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!secure) return;

  // 「更新する」を押したときだけ再読み込みする（初回の有効化で勝手に再読み込みしない）
  let userRequested = false, reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!userRequested || reloading) return;
    reloading = true;
    location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });
      const offerUpdate = (worker) => {
        $('updateBar').hidden = false;
        $('updateBtn').onclick = () => {
          userRequested = true;
          worker.postMessage('skipWaiting');
        };
      };
      // すでに待機中の新しい版がある
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          // 初回インストールでなければ（＝既存の版が動いていれば）更新を案内する
          if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w);
          if (w.state === 'installed' && !navigator.serviceWorker.controller) toast('OFFLINE READY — オフラインでも使えます');
        });
      });
      // 開きっぱなしでも新しい版に気付けるよう、1時間ごとに確認する
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    } catch {
      /* 登録できない環境では通常のWebページとして動く */
    }
  });
}
