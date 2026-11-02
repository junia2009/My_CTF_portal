// 起動とページ切り替え
import { $, copy, initTabs } from './ui/common.js';
import { initTheme, initClock, initBoot, initEyebrows, renderHome, initBase, initNotes, initCheatsheet } from './ui/portal.js';
import { initCodec } from './ui/codec.js';
import { initClassic, initXor, initRsa } from './ui/crypto.js';
import { initFile, initHash, initJwt, initFlag, initNet } from './ui/analysis.js';
import { initPwa } from './ui/pwa.js';
import { initGuide, initIdentify, initHelp } from './ui/beginner.js';
import { initPallas } from './ui/pallas.js';

const onShow = {};
let pallas = null;

function route() {
  const [page, arg] = (location.hash.slice(1) || 'home').split('/');
  const target = document.querySelector(`[data-page="${page}"]`) ? page : 'home';
  document.querySelectorAll('[data-page]').forEach((s) => (s.hidden = s.dataset.page !== target));
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === target));
  onShow[target]?.(arg ? decodeURIComponent(arg) : undefined);
  pallas?.onRoute(target);
  window.scrollTo(0, 0);
}

document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => copy($(b.dataset.copy).value)));
initBoot();
initPwa();
initTheme();
initClock();
initEyebrows();
initHelp();
initTabs();
initCodec();
initBase();
initClassic();
initXor();
initRsa();
initFile();
initHash();
initJwt();
initFlag();
initNet();
initIdentify();
onShow.guide = initGuide();
onShow.home = renderHome;
onShow.notes = initNotes();
onShow.cheatsheet = initCheatsheet();
pallas = initPallas();
window.addEventListener('hashchange', route);
route();
