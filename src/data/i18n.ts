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

export { ui } from './content';
