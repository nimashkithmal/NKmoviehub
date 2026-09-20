/**
 * Detect active ad filtering — tuned for uBlock Origin Lite (MV3).
 *
 * uBOL default mode blocks network requests (EasyList) but often does NOT
 * apply cosmetic (DOM hide) filters. We primarily use script-tag probes to
 * known ad hosts (onerror = blocked).
 */

const BAIT_CLASS =
  'adsbox adads adsbygoogle ad-placement banner_ad textAd text_ad';

const AD_SCRIPT_URLS = [
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
  'https://www.googletagservices.com/tag/js/gpt.js',
  'https://securepubads.g.doubleclick.net/tag/js/gpt.js'
];

const CACHE_KEY = 'nk_adblock_active_v2';
const CACHE_MS = 10 * 60 * 1000;

const readCache = () => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.active !== 'boolean') return null;
    if (Date.now() - Number(parsed.at || 0) > CACHE_MS) return null;
    return parsed.active;
  } catch {
    return null;
  }
};

const writeCache = (active) => {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ active: Boolean(active), at: Date.now() })
    );
  } catch {
    /* ignore */
  }
};

/** Script tag probe — onerror when uBOL / EasyList blocks the host. */
const probeScriptBlocked = (url) =>
  new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(false);
      return;
    }

    const script = document.createElement('script');
    let settled = false;
    const finish = (blocked) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      try {
        script.remove();
      } catch {
        /* ignore */
      }
      resolve(blocked);
    };

    // Slow CDN without a blocker should still load well under 2.5s
    const timer = window.setTimeout(() => finish(false), 2500);
    script.src = `${url}${url.includes('?') ? '&' : '?'}nk=${Date.now()}`;
    script.async = true;
    script.onload = () => finish(false);
    script.onerror = () => finish(true);

    try {
      (document.head || document.documentElement).appendChild(script);
    } catch {
      finish(false);
    }
  });

/** fetch no-cors — extension block usually rejects with Failed to fetch. */
const probeFetchBlocked = (url) =>
  new Promise((resolve) => {
    let settled = false;
    const finish = (blocked) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(blocked);
    };
    const timer = window.setTimeout(() => finish(false), 2500);

    fetch(`${url}${url.includes('?') ? '&' : '?'}nk=${Date.now()}`, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit'
    })
      .then(() => finish(false))
      .catch(() => finish(true));
  });

const measureBlocked = (el) => {
  if (!el || !document.body.contains(el)) return true;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return true;
  if (el.offsetHeight < 1 || el.clientHeight < 1) return true;
  return false;
};

const detectCosmeticBlocking = () =>
  new Promise((resolve) => {
    if (typeof document === 'undefined' || !document.body) {
      resolve(false);
      return;
    }

    const bait = document.createElement('div');
    bait.className = BAIT_CLASS;
    bait.id = 'nk-ad-bait';
    bait.setAttribute('aria-hidden', 'true');
    bait.style.cssText =
      'width:50px!important;height:50px!important;position:absolute!important;left:-9999px!important;top:-9999px!important;';
    bait.textContent = 'ad';

    const control = document.createElement('div');
    control.id = 'nk-ad-control';
    control.setAttribute('aria-hidden', 'true');
    control.style.cssText =
      'width:50px!important;height:50px!important;position:absolute!important;left:-9999px!important;top:-9999px!important;';
    control.textContent = 'ok';

    try {
      document.body.appendChild(bait);
      document.body.appendChild(control);
    } catch {
      resolve(false);
      return;
    }

    window.setTimeout(() => {
      try {
        const blocking = measureBlocked(bait) && !measureBlocked(control);
        bait.remove();
        control.remove();
        resolve(blocking);
      } catch {
        try {
          bait.remove();
          control.remove();
        } catch {
          /* ignore */
        }
        resolve(false);
      }
    }, 200);
  });

/**
 * @returns {Promise<boolean>} true when uBlock Origin Lite (or similar) is filtering
 */
export const detectAdBlockingActive = async () => {
  if (typeof window === 'undefined') return false;

  const cached = readCache();
  if (cached === true) return true;

  // Primary: script onerror on Google ad hosts (works with uBOL enabled)
  try {
    const scriptResults = await Promise.all(
      AD_SCRIPT_URLS.map((url) => probeScriptBlocked(url))
    );
    const blockedScripts = scriptResults.filter(Boolean).length;
    // At least one ad script blocked ⇒ filtering is active
    if (blockedScripts >= 1) {
      writeCache(true);
      return true;
    }
  } catch {
    /* continue */
  }

  // Secondary: fetch probe on first host
  try {
    const fetchBlocked = await probeFetchBlocked(AD_SCRIPT_URLS[0]);
    if (fetchBlocked) {
      writeCache(true);
      return true;
    }
  } catch {
    /* continue */
  }

  // Tertiary: cosmetic bait (classic uBO / complete mode)
  try {
    const cosmetic = await detectCosmeticBlocking();
    if (cosmetic) {
      writeCache(true);
      return true;
    }
  } catch {
    /* ignore */
  }

  writeCache(false);
  return false;
};
