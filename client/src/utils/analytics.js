/**
 * GA4 + site analytics bridge.
 * Set REACT_APP_GA_MEASUREMENT_ID in client/.env (e.g. G-XXXXXXXXXX).
 */

const MEASUREMENT_ID = process.env.REACT_APP_GA_MEASUREMENT_ID || '';
const TRACK_URL = '/api/analytics/track';

const ADMIN_PREFIXES = ['/admin', '/add-movie', '/add-tvshow'];

const isAdminPath = (path = '') =>
  ADMIN_PREFIXES.some((prefix) => path.startsWith(prefix));

const getVisitorId = () => {
  try {
    let id = sessionStorage.getItem('nk_visitor_id');
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `v_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem('nk_visitor_id', id);
    }
    return id;
  } catch {
    return `v_${Date.now()}`;
  }
};

const getTrafficSource = () => {
  try {
    const stored = sessionStorage.getItem('nk_traffic_source');
    if (stored) return stored;
    const ref = document.referrer || '';
    if (!ref) {
      sessionStorage.setItem('nk_traffic_source', 'direct');
      return 'direct';
    }
    const host = new URL(ref).hostname.replace(/^www\./, '');
    sessionStorage.setItem('nk_traffic_source', host);
    return host;
  } catch {
    return 'direct';
  }
};

const getCountryHint = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const lang = navigator.language || '';
    return { timezone: tz, locale: lang };
  } catch {
    return { timezone: '', locale: '' };
  }
};

export const isAnalyticsEnabled = () => Boolean(MEASUREMENT_ID);

export const initAnalytics = () => {
  if (!MEASUREMENT_ID || typeof window === 'undefined') return;

  if (!window.gtag) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', MEASUREMENT_ID, { send_page_view: false });
  }
};

const gtagEvent = (name, params = {}) => {
  if (!MEASUREMENT_ID || !window.gtag) return;
  window.gtag('event', name, params);
};

const mirrorEvent = (payload) => {
  try {
    const body = JSON.stringify({
      visitorId: getVisitorId(),
      trafficSource: getTrafficSource(),
      countryHint: getCountryHint(),
      path: window.location.pathname,
      ...payload
    });
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(TRACK_URL, blob);
      return;
    }
    fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => {});
  } catch {
    // non-blocking
  }
};

export const trackPageView = (path, title = document.title) => {
  if (isAdminPath(path)) return;

  gtagEvent('page_view', {
    page_path: path,
    page_title: title
  });

  mirrorEvent({
    type: 'page_view',
    path,
    title
  });
};

export const trackContentView = ({ contentType, itemId, itemName }) => {
  if (isAdminPath(window.location.pathname)) return;

  gtagEvent('view_content', {
    content_type: contentType,
    item_id: String(itemId || ''),
    item_name: itemName || ''
  });

  mirrorEvent({
    type: 'view_content',
    contentType,
    itemId: String(itemId || ''),
    itemName: itemName || ''
  });
};

export const trackWatchClick = ({ contentType, itemId, itemName }) => {
  if (isAdminPath(window.location.pathname)) return;

  gtagEvent('watch_click', {
    content_type: contentType,
    item_id: String(itemId || ''),
    item_name: itemName || ''
  });

  mirrorEvent({
    type: 'watch_click',
    contentType,
    itemId: String(itemId || ''),
    itemName: itemName || ''
  });
};
