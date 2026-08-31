const SITE_ORIGIN = (
  process.env.REACT_APP_SITE_URL || 'https://nkmoviehub.vercel.app'
).replace(/\/$/, '');

const NO_INDEX_PREFIXES = [
  '/admin',
  '/login',
  '/add-movie',
  '/add-tvshow',
  '/forgot-password'
];

const DEFAULT_TITLE = 'NK Movie Hub — Movies & TV Series';

const ROUTE_TITLES = {
  '/': DEFAULT_TITLE,
  '/collections': 'Collections | NK Movie Hub',
  '/cast-collection': 'Cast Collection | NK Movie Hub',
  '/about': 'About Us | NK Movie Hub',
  '/contact': 'Contact Us | NK Movie Hub',
  '/privacy': 'Privacy Policy | NK Movie Hub',
  '/terms': 'Terms & Conditions | NK Movie Hub',
  '/dmca': 'DMCA / Copyright | NK Movie Hub',
  '/login': 'Login | NK Movie Hub',
  '/forgot-password': 'Forgot Password | NK Movie Hub'
};

export const getSiteOrigin = () => SITE_ORIGIN;

export const getCanonicalUrl = (pathname = '/') => {
  const path =
    pathname !== '/' && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname || '/';
  return `${SITE_ORIGIN}${path}`;
};

export const shouldNoIndex = (pathname = '/') =>
  NO_INDEX_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

const upsertLink = (rel, href) => {
  let link = document.querySelector(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
};

const upsertMeta = (selector, attributes, content) => {
  if (!content) return;
  let meta = document.querySelector(selector);
  if (!meta) {
    meta = document.createElement('meta');
    Object.entries(attributes).forEach(([key, value]) => {
      meta.setAttribute(key, value);
    });
    document.head.appendChild(meta);
  }
  meta.content = content;
};

const truncate = (text = '', max = 160) => {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
};

export const updatePageSeo = (pathname = '/') => {
  const canonical = getCanonicalUrl(pathname);

  upsertLink('canonical', canonical);
  upsertMeta('meta[name="robots"]', { name: 'robots' }, shouldNoIndex(pathname)
    ? 'noindex, nofollow'
    : 'index, follow');
  upsertMeta('meta[property="og:url"]', { property: 'og:url' }, canonical);

  const staticTitle = ROUTE_TITLES[pathname];
  if (staticTitle) {
    document.title = staticTitle;
  }
};

export const setDetailPageMeta = ({
  title,
  description,
  image,
  pathname,
  type = 'video.movie'
}) => {
  if (!title || !pathname) return;

  const pageTitle = `${title} | NK Movie Hub`;
  const canonical = getCanonicalUrl(pathname);
  const metaDescription = truncate(description || `Watch ${title} on NK Movie Hub.`);

  document.title = pageTitle;
  upsertLink('canonical', canonical);
  upsertMeta('meta[name="description"]', { name: 'description' }, metaDescription);
  upsertMeta('meta[property="og:title"]', { property: 'og:title' }, pageTitle);
  upsertMeta('meta[property="og:description"]', { property: 'og:description' }, metaDescription);
  upsertMeta('meta[property="og:url"]', { property: 'og:url' }, canonical);
  upsertMeta('meta[property="og:type"]', { property: 'og:type' }, type);
  upsertMeta('meta[property="og:image"]', { property: 'og:image' }, image || '');
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, pageTitle);
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, metaDescription);
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, image || '');
};

export const setDetailPageTitle = (title, suffix = 'NK Movie Hub') => {
  if (!title) return;
  document.title = `${title} | ${suffix}`;
};

export const resetDefaultTitle = () => {
  document.title = DEFAULT_TITLE;
};
