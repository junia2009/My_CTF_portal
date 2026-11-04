// 学ぶ：分野ごとのテキストの一覧と、各テキストの表示（表示の仕組みはツールの使い方ガイドと共通）
import { LEARN as NET } from '../data/learn.js';
import { CRYPTO_TEXTS } from '../data/learn-crypto.js';
import { WEB_TEXTS } from '../data/learn-web.js';
import { WEBVULN_TEXTS } from '../data/learn-webvuln.js';
import { PROXY_TEXTS } from '../data/learn-proxy.js';
import { DFIR_TEXTS } from '../data/learn-dfir.js';
import { INFRA_TEXTS } from '../data/learn-infra.js';
import { CLOUD_TEXTS } from '../data/learn-cloud.js';
import { OBS_TEXTS } from '../data/learn-obs.js';
import { icon } from '../data/tools.js';
import { renderGuide, registerFigures, registerWidgets } from './manuals.js';
import { NET_FIGURES, NET_WIDGETS } from './netfig.js';
import { CRYPTO_FIGURES, CRYPTO_WIDGETS } from './cryptofig.js';
import { WEB_FIGURES, WEB_WIDGETS } from './webfig.js';
import { PROXY_FIGURES, PROXY_WIDGETS } from './proxyfig.js';
import { DFIR_FIGURES, DFIR_WIDGETS } from './forensicfig.js';
import { INFRA_FIGURES, INFRA_WIDGETS } from './infrafig.js';
import { CLOUD_FIGURES, CLOUD_WIDGETS } from './cloudfig.js';
import { OBS_FIGURES, OBS_WIDGETS } from './obsfig.js';
import { $, h, store } from './common.js';

const LEARN = [...NET, ...CRYPTO_TEXTS, ...WEB_TEXTS, ...WEBVULN_TEXTS, ...DFIR_TEXTS, ...INFRA_TEXTS, ...CLOUD_TEXTS, ...OBS_TEXTS, ...PROXY_TEXTS];

const READ_KEY = 'ctfportal.learnRead';
registerFigures({ ...NET_FIGURES, ...CRYPTO_FIGURES, ...WEB_FIGURES, ...PROXY_FIGURES, ...DFIR_FIGURES, ...INFRA_FIGURES, ...CLOUD_FIGURES, ...OBS_FIGURES });
registerWidgets({ ...NET_WIDGETS, ...CRYPTO_WIDGETS, ...WEB_WIDGETS, ...PROXY_WIDGETS, ...DFIR_WIDGETS, ...INFRA_WIDGETS, ...CLOUD_WIDGETS, ...OBS_WIDGETS });

export function initLearn() {
  const root = $('learnBody');

  function renderIndex() {
    const read = new Set(store.get(READ_KEY, []));
    const subjects = [...new Set(LEARN.map((t) => t.subject))];
    root.replaceChildren(
      h('p', { class: 'lead' }, 'CTF と業務の両方で役に立つ知識を、分野ごとのテキストにまとめました。図と確認問題つきで、章ごとに少しずつ読めます。'),
      ...subjects.flatMap((sub) => {
        const list = LEARN.filter((t) => t.subject === sub);
        return [
          h('h2', { class: 'lr-subject' }, sub, h('small', {}, `${list.length} 冊`)),
          h('div', { class: 'mn-index' }, ...list.map((t, i) => {
            const done = t.chapters.filter((c) => read.has(`${t.id}/${c.id}`)).length;
            const pct = Math.round((done / t.chapters.length) * 100);
            return h('a', { class: 'mn-card', href: `#learn/${t.id}` },
              h('span', { class: 'mn-card-icon' }, icon(t.icon)),
              h('span', { class: 'mn-card-body' },
                h('b', {}, h('span', { class: 'lr-vol' }, `第 ${i + 1} 冊`), t.name),
                h('span', {}, t.tagline),
                h('span', { class: 'mn-card-meta' }, ...t.genres.map((g) => h('span', { class: 'tag' }, g)), h('span', { class: 'hint' }, `${t.chapters.length} 章・${t.level}`)),
                h('span', { class: 'lr-progress', title: `${done} / ${t.chapters.length} 章を読んだ` },
                  h('span', { class: 'lr-bar' }, h('span', { style: `width:${pct}%` })), h('small', {}, done ? `${done} / ${t.chapters.length} 章` : '未読')),
              ),
              h('span', { class: 'mn-card-go' }, '›'),
            );
          })),
        ];
      }),
      h('p', { class: 'hint mn-more' }, 'テキストは分野ごとに順次追加していきます。'),
    );
  }

  return (arg) => {
    const t = LEARN.find((x) => x.id === arg);
    if (t) {
      renderGuide(root, t, { back: '#learn', backLabel: 'テキストの一覧', illust: {}, readKey: READ_KEY });
      // 前後のテキストへの案内
      const i = LEARN.indexOf(t);
      const next = LEARN[i + 1]?.subject === t.subject ? LEARN[i + 1] : null;
      root.append(h('nav', { class: 'lr-next' },
        h('a', { class: 'btn ghost', href: '#learn' }, '‹ 一覧へ'),
        next ? h('a', { class: 'btn', href: `#learn/${next.id}` }, `次のテキスト：${next.name} ›`) : ''));
      window.scrollTo(0, 0);
    } else renderIndex();
  };
}
