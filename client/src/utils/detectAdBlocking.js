/**
 * Ad-filter detection for the uBlock Origin Lite recommendation modal.
 *
 * GOAL
 * - uBOL (or similar) ENABLED  → return true  → hide modal
 * - No extension / disabled    → return false → show modal
 *
 * WHY PREVIOUS LOGIC FAILED
 * - Treating ANY script onerror / fetch failure as "adblock" caused false
 *   positives (DNS, ISP, firewall, tracking prevention, flaky network).
 * - Caching active=true + marking the session dismissed locked the modal off
 *   even when the user had no extension.
 *
 * FIX
 * - Differential probe: ad host fails AND a normal CDN control succeeds.
 * - Require a clear majority of ad probes to fail (not a single flaky URL).
 * - If the control also fails → uncertain → return false (SHOW the modal).
 * - Never treat ambiguity as "blocker is on".
 */

const AD_SCRIPT_URLS = [
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
  'https://www.googletagservices.com/tag/js/gpt.js',
  'https://securepubads.g.doubleclick.net/tag/js/gpt.js'
];

/** Non-ad CDN script — must stay off EasyList so uBOL does not block it. */
const CONTROL_SCRIPT_URL =
  'https://cdn.jsdelivr.net/npm/js-cookie@3.0.5/dist/js.cookie.min.js';

const BAIT_CLASS =
  'adsbox adads adsbygoogle ad-placement banner_ad textAd text_ad';

const probeScript = (url, timeoutMs = 3000) =>
  new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve({ ok: false, reason: 'no-document' });
      return;
    }

    const script = document.createElement('script');
    let settled = false;

    const finish = (ok) => {
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
      resolve({ ok });
    };

    // Timeout ⇒ treat as failure for this URL (not automatically "adblock")
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    script.src = `${url}${url.includes('?') ? '&' : '?'}nk=${Date.now()}`;
    script.async = true;
    script.onload = () => finish(true);
    script.onerror = () => finish(false);

    try {
      (document.head || document.documentElement).appendChild(script);
    } catch {
      finish(false);
    }
  });

const measureHidden = (el) => {
  if (!el || !document.body.contains(el)) return true;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return true;
  if (el.offsetHeight < 1 || el.clientHeight < 1) return true;
  return false;
};

/** Cosmetic filter check — only positive when bait dies and control lives. */
const detectCosmeticBlocking = () =>
  new Promise((resolve) => {
    if (typeof document === 'undefined' || !document.body) {
      resolve(false);
      return;
    }

    const bait = document.createElement('div');
    bait.className = BAIT_CLASS;
    bait.setAttribute('aria-hidden', 'true');
    bait.style.cssText =
      'width:50px!important;height:50px!important;position:absolute!important;left:-10000px!important;top:-10000px!important;';
    bait.textContent = 'ad';

    const control = document.createElement('div');
    control.className = 'nk-ubm-control-probe';
    control.setAttribute('aria-hidden', 'true');
    control.style.cssText =
      'width:50px!important;height:50px!important;position:absolute!important;left:-10000px!important;top:-10000px!important;';
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
        const positive = measureHidden(bait) && !measureHidden(control);
        bait.remove();
        control.remove();
        resolve(positive);
      } catch {
        try {
          bait.remove();
          control.remove();
        } catch {
          /* ignore */
        }
        resolve(false);
      }
    }, 180);
  });

/**
 * @returns {Promise<boolean>}
 *   true  = filtering clearly active (hide recommendation)
 *   false = no reliable blocker signal (show recommendation)
 */
export const detectAdBlockingActive = async () => {
  if (typeof window === 'undefined') return false;

  // 1) Control must load. If it fails, network/CDN is broken — NOT adblock.
  const control = await probeScript(CONTROL_SCRIPT_URL);
  if (!control.ok) {
    return false;
  }

  // 2) Probe known ad hosts. uBOL blocks these; a healthy network does not.
  const adResults = await Promise.all(
    AD_SCRIPT_URLS.map((url) => probeScript(url))
  );
  const adBlockedCount = adResults.filter((r) => !r.ok).length;

  // Need a clear majority so one flaky URL cannot hide the modal.
  // 3 probes → require at least 2 failures while control CDN succeeded.
  if (adBlockedCount >= 2) {
    return true;
  }

  // 3) Cosmetic-only blockers (rare for default uBOL, useful for classic uBO)
  try {
    if (await detectCosmeticBlocking()) {
      return true;
    }
  } catch {
    /* ignore */
  }

  // Uncertain or no blocker → show the recommendation
  return false;
};

/** Clear stale detection / dismiss flags from older buggy builds. */
export const clearAdblockDetectionState = () => {
  try {
    [
      'nk_adblock_active_v1',
      'nk_adblock_active_v2',
      'ublockRecommendationSessionDismissed',
      'ublockRecommendationSessionDismissed_v2',
      'ublockRecommendationSessionDismissed_v3',
      'ublockRecommendationSessionDismissed_v4',
      'ublockAlreadyUsing',
      'ublockRecommendationDismissed',
      'ublockRecommendationDismissedAt'
    ].forEach((key) => {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    });
  } catch {
    /* ignore */
  }
};
