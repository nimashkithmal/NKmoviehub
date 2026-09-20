import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { detectAdBlockingActive } from '../utils/detectAdBlocking';
import './UBlockRecommendationModal.css';

const SESSION_DISMISSED = 'ublockRecommendationSessionDismissed_v4';
const OPEN_DELAY_MS = 400;
const CLOSE_MS = 220;

const UBLOCK_LITE_CHROME =
  'https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh';
const UBLOCK_LITE_EDGE =
  'https://microsoftedge.microsoft.com/addons/detail/ublock-origin-lite/cimighlppcgcoapaliogpjjdehbnofhn';

export const getUBlockLiteStoreUrl = () => {
  if (typeof navigator === 'undefined') return UBLOCK_LITE_CHROME;
  const ua = navigator.userAgent || '';
  if (/Edg\//i.test(ua)) return UBLOCK_LITE_EDGE;
  return UBLOCK_LITE_CHROME;
};

const isSessionDismissed = () => {
  try {
    return sessionStorage.getItem(SESSION_DISMISSED) === '1';
  } catch {
    return false;
  }
};

const markSessionDismissed = () => {
  try {
    sessionStorage.setItem(SESSION_DISMISSED, '1');
  } catch {
    /* ignore */
  }
};

const ShieldIcon = ({ size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M12 3l7 3v5.2c0 4.4-2.9 7.7-7 9.3-4.1-1.6-7-4.9-7-9.3V6l7-3z"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
    />
    <path
      d="M9.2 12.1l1.9 1.9 3.7-3.8"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const UBlockRecommendationModal = () => {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [storeUrl] = useState(() => getUBlockLiteStoreUrl());
  const closeTimerRef = useRef(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    const runId = ++runIdRef.current;
    let openTimer = null;

    const run = async () => {
      if (isSessionDismissed()) return;

      let blocking = false;
      try {
        blocking = await detectAdBlockingActive();
      } catch {
        blocking = false;
      }

      if (runId !== runIdRef.current) return;
      if (blocking) return;

      openTimer = window.setTimeout(() => {
        if (runId !== runIdRef.current) return;
        setVisible(true);
      }, OPEN_DELAY_MS);
    };

    run();

    return () => {
      if (runIdRef.current === runId) {
        runIdRef.current += 1;
      }
      if (openTimer) window.clearTimeout(openTimer);
    };
  }, []);

  const closeModal = useCallback(
    (persistFn) => {
      if (closing) return;
      persistFn();
      setClosing(true);
      closeTimerRef.current = window.setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, CLOSE_MS);
    },
    [closing]
  );

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!visible) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeModal(markSessionDismissed);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [visible, closeModal]);

  const handleContinue = useCallback(() => {
    closeModal(markSessionDismissed);
  }, [closeModal]);

  const handleInstall = useCallback(() => {
    closeModal(markSessionDismissed);
  }, [closeModal]);

  if (!visible || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`ubm-overlay${closing ? ' is-closing' : ''}`}
      role="presentation"
      onClick={handleContinue}
    >
      <div
        className={`ubm-card${closing ? ' is-closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ubm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="ubm-close"
          onClick={handleContinue}
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M3 3l8 8M11 3L3 11"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <header className="ubm-header">
          <div className="ubm-badge" aria-hidden="true">
            <ShieldIcon size={26} />
          </div>
          <h2 id="ubm-title" className="ubm-title">
            🎬 Enjoy Movies Without Ads!
          </h2>
          <p className="ubm-subtitle">
            Better viewing experience ekak sandaha <strong>uBlock Origin Lite</strong>{' '}
            extension eka use karanna.
          </p>
        </header>

        <div className="ubm-sections">
          <section className="ubm-lang" aria-label="Message">
            <p>
              Unwanted ads adu karala, movies &amp; TV shows comfortable widiyata enjoy
              karanna පුළුවන්.
            </p>
            <p>
              <strong>
                Install uBlock Origin Lite &amp; enjoy your movies with fewer
                interruptions.
              </strong>{' '}
              🍿
            </p>
          </section>
        </div>

        <div className="ubm-actions">
          <a
            className="ubm-cta"
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleInstall}
          >
            <span className="ubm-cta-icon" aria-hidden="true">
              <ShieldIcon size={22} />
            </span>
            <span className="ubm-cta-copy">
              <span className="ubm-cta-label">Install uBlock Origin Lite</span>
              <span className="ubm-cta-sub">Extension eka ethanin install karanna</span>
            </span>
          </a>

          <button type="button" className="ubm-skip" onClick={handleContinue}>
            <span className="ubm-skip-label">Continue without it</span>
            <span className="ubm-skip-sub">Passe install karanna puluwan</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default UBlockRecommendationModal;
