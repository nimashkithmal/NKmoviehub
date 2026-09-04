import { useEffect, useState, useCallback } from 'react';

/**
 * Blocks external window.open from our page (ad popunders).
 * Do NOT steal window focus on blur — that breaks Space play/pause inside embeds.
 */
export function useBlockEmbedRedirects(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    const previousOpen = window.open;
    window.open = (url, target, features) => {
      try {
        if (url == null || url === '') return null;
        const next = new URL(String(url), window.location.href);
        if (next.origin === window.location.origin) {
          return previousOpen.call(window, url, target, features);
        }
      } catch {
        // block invalid / external
      }
      return null;
    };

    const blockAux = (event) => {
      if (event.button === 1) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('auxclick', blockAux, true);

    return () => {
      window.open = previousOpen;
      document.removeEventListener('auxclick', blockAux, true);
    };
  }, [enabled]);
}

/** Same-origin wrapper so parent.location ads only hijack the iframe, not the app. */
export function wrapEmbedInShield(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.includes('/embed-shield.html')) return raw;
  return `/embed-shield.html?src=${encodeURIComponent(raw)}`;
}

export const SAFE_EMBED_IFRAME_PROPS = {
  referrerPolicy: 'no-referrer',
  allow:
    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen',
  allowFullScreen: true
};

/**
 * Invisible first-click gate.
 * Starts unlocked so the embed play button works on the first click.
 * Re-arms after leaving the tab (visibility) to blunt popunder follow-ups.
 * When armed, pointerdown hides the gate before click so one gesture still hits play.
 */
export function usePlayerClickGate() {
  const [unlocked, setUnlocked] = useState(true);

  const unlock = useCallback(() => {
    setUnlocked(true);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setUnlocked(false);
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return { unlocked, unlock };
}

/**
 * Hide the gate on pointerdown (before click) so the SAME click reaches the
 * embed play button — one click unlocks + plays.
 */
export function passThroughClickGate(event, { unlock, iframeRef } = {}) {
  const gate = event.currentTarget;
  if (gate && gate.style) {
    gate.style.pointerEvents = 'none';
    gate.style.display = 'none';
  }
  unlock?.();
  // Let the browser deliver this pointer/click to the iframe underneath
  window.requestAnimationFrame(() => focusPlayerIframe(iframeRef));
}

/**
 * If the shield iframe is navigated away to an ad page, reset it.
 */
export function useEmbedFrameGuard(iframeRef, shieldSrc, enabled = true) {
  useEffect(() => {
    if (!enabled || !shieldSrc) return undefined;

    const timer = window.setInterval(() => {
      const frame = iframeRef?.current;
      if (!frame) return;

      try {
        const href = frame.contentWindow?.location?.href || '';
        if (href && !href.includes('/embed-shield.html')) {
          frame.src = shieldSrc;
        }
      } catch {
        frame.src = shieldSrc;
      }
    }, 700);

    return () => window.clearInterval(timer);
  }, [iframeRef, shieldSrc, enabled]);
}

/** Focus the player iframe so keyboard events reach the embed. */
export function focusPlayerIframe(iframeRef) {
  const frame = iframeRef?.current;
  if (!frame) return;
  try {
    frame.focus();
    frame.contentWindow?.focus?.();
  } catch {
    frame.focus();
  }
}
