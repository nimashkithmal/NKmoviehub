/**
 * Detect whether an ad blocker is actively filtering this page.
 * Conservative: return true ONLY when an ad-bait is clearly filtered
 * while a normal control element is not (avoids false positives).
 */

const BAIT_CLASS =
  'adsbox adads adsbygoogle ad-placement banner_ad textAd text_ad';

const measureBlocked = (el) => {
  if (!el || !document.body.contains(el)) return true;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return true;
  // Explicit pixel size is set inline — collapse to 0 means a filter hid it
  if (el.offsetHeight < 1 || el.clientHeight < 1) return true;
  return false;
};

const makeProbe = (className, id) => {
  const el = document.createElement('div');
  el.id = id;
  el.className = className;
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText =
    'width:50px!important;height:50px!important;position:absolute!important;left:-9999px!important;top:-9999px!important;pointer-events:auto!important;opacity:1!important;transform:none!important;';
  el.textContent = 'ad';
  return el;
};

/**
 * @returns {Promise<boolean>} true only when filtering clearly appears active
 */
export const detectAdBlockingActive = () =>
  new Promise((resolve) => {
    if (typeof document === 'undefined' || !document.body) {
      resolve(false);
      return;
    }

    const bait = makeProbe(BAIT_CLASS, 'nk-ad-bait');
    const control = makeProbe('nk-normal-probe', 'nk-ad-control');

    const cleanup = () => {
      try {
        bait.remove();
      } catch {
        /* ignore */
      }
      try {
        control.remove();
      } catch {
        /* ignore */
      }
    };

    try {
      document.body.appendChild(bait);
      document.body.appendChild(control);
    } catch {
      cleanup();
      resolve(false);
      return;
    }

    window.setTimeout(() => {
      try {
        const baitBlocked = measureBlocked(bait);
        const controlBlocked = measureBlocked(control);
        // Only trust "blocking" when bait dies but the control still looks fine
        const blocking = baitBlocked && !controlBlocked;
        cleanup();
        resolve(blocking);
      } catch {
        cleanup();
        resolve(false);
      }
    }, 200);
  });
