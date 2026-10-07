export type Lang = 'zh' | 'en';

/** Bilingual string. Every user-facing string in the site goes through this shape. */
export type T = { zh: string; en: string };

export const t = (v: T, lang: Lang) => v[lang];

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Build a site-internal href for a page slug in the given language. */
export function href(lang: Lang, slug = '') {
  const prefix = lang === 'en' ? '/en' : '';
  const path = slug ? `/${slug}/` : '/';
  return `${BASE}${prefix}${path}`;
}

/** Same page in the other language. */
export function altHref(lang: Lang, slug = '') {
  return href(lang === 'zh' ? 'en' : 'zh', slug);
}

export const ui = {
  siteTitle: { zh: '崔楮焓 · 机械作品集', en: 'Chuhan Cui · Mechanical Portfolio' },
  skip: { zh: '跳到正文', en: 'Skip to content' },
  switchLang: { zh: 'EN', en: '中文' },
  switchLangLabel: { zh: 'Switch to English', en: '切换到中文' },
  nav: {
    home: { zh: '首页', en: 'Home' },
    engineer: { zh: '工程 2025', en: 'Engineer 2025' },
    hero: { zh: '英雄 2024', en: 'Hero 2024' },
    research: { zh: '预研', en: 'R&D' },
  },
  backHome: { zh: '回到首页', en: 'Back to home' },
  openProject: { zh: '看完整项目', en: 'Read the full project' },
  watchSource: { zh: '看原视频', en: 'Watch the source video' },
  openSource: { zh: '机械开源', en: 'Open-source CAD' },
  enlarge: { zh: '放大查看', en: 'View larger' },
  close: { zh: '关闭', en: 'Close' },
  loading3d: { zh: '模型加载中', en: 'Loading model' },
  footerNote: {
    zh: '比赛画面来自 RoboMaster 机甲大师官方转播。网站代码与机械设计归作者所有。',
    en: 'Match footage from the official RoboMaster broadcast. Site code and mechanical design by the author.',
  },
} satisfies Record<string, T | Record<string, T>>;
