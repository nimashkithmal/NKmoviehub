import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AgeGate.css';

/** Self-declared answers are remembered for this browser tab session only. */
const CONFIRMED_KEY = 'nk-age-confirmed';
const DECLINED_KEY = 'nk-age-declined';
const LANG_KEY = 'nk-age-gate-lang';

const readFlag = (key) => {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

const writeFlag = (key) => {
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    // Ignore private mode errors — gate simply asks again
  }
};

const readLang = () => {
  try {
    return localStorage.getItem(LANG_KEY) === 'si' ? 'si' : 'en';
  } catch {
    return 'en';
  }
};

const COPY = {
  en: {
    title: 'Age Verification Required (18+)',
    message:
      'This movie or TV show is intended for viewers aged 18 and above. Please confirm that you are at least 18 years old to continue.',
    yes: 'Yes, I am 18 or older',
    no: 'No, I am under 18',
    note: 'This is a self-declared age confirmation, not verified proof of age.',
    blockedTitle: 'Content not available',
    blockedMessage: 'You indicated that you are under 18, so this title is not available.',
    home: 'Back to home'
  },
  si: {
    title: 'වයස තහවුරු කිරීම අවශ්‍යයි (18+)',
    message:
      'මෙම චිත්‍රපටය හෝ රූපවාහිනී කතා මාලාව වයස අවුරුදු 18 හෝ ඊට වැඩි ප්‍රේක්ෂකයින් සඳහා පමණක් සුදුසු වේ. ඉදිරියට යාමට ඔබගේ වයස අවුරුදු 18 හෝ ඊට වැඩි බව තහවුරු කරන්න.',
    yes: 'ඔව්, මට වයස අවුරුදු 18 හෝ ඊට වැඩියි',
    no: 'නැහැ, මට තවම අවුරුදු 18 සම්පූර්ණ වී නැහැ',
    note: 'මෙය ඔබ විසින්ම ලබා දෙන වයස තහවුරු කිරීමක් මිස, වයස සනාථ කරන සාක්ෂියක් නොවේ.',
    blockedTitle: 'මෙම අන්තර්ගතය ලබා ගත නොහැක',
    blockedMessage: 'ඔබ වයස අවුරුදු 18 ට අඩු බව සඳහන් කළ නිසා මෙම මාතෘකාව ලබා ගත නොහැක.',
    home: 'මුල් පිටුවට'
  }
};

/**
 * Wraps an 18+ movie / TV page. Children (incl. the player) only mount after the
 * viewer confirms they are 18+, so opening the URL directly cannot skip it.
 */
const AgeGate = ({ active, children }) => {
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = useState(() => readFlag(CONFIRMED_KEY));
  const [declined, setDeclined] = useState(() => readFlag(DECLINED_KEY));
  const [lang, setLang] = useState(readLang);
  const blocking = active && !confirmed;

  useEffect(() => {
    if (!blocking) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [blocking]);

  if (!blocking) return children;

  const t = COPY[lang];
  const switchLang = (next) => {
    setLang(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      // Ignore
    }
  };

  const confirm = () => {
    writeFlag(CONFIRMED_KEY);
    setConfirmed(true);
  };

  const decline = () => {
    writeFlag(DECLINED_KEY);
    setDeclined(true);
    navigate('/', { replace: true });
  };

  return (
    <div className="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
      <div className="age-gate-card">
        <div className="age-gate-lang" role="group" aria-label="Language">
          <button
            type="button"
            className={lang === 'en' ? 'is-active' : ''}
            onClick={() => switchLang('en')}
          >
            English
          </button>
          <button
            type="button"
            className={lang === 'si' ? 'is-active' : ''}
            onClick={() => switchLang('si')}
          >
            සිංහල
          </button>
        </div>

        <div className="age-gate-icon" aria-hidden="true">18+</div>

        {declined ? (
          <>
            <h2 id="age-gate-title" className="age-gate-title">{t.blockedTitle}</h2>
            <p className="age-gate-message">{t.blockedMessage}</p>
            <div className="age-gate-actions">
              <button
                type="button"
                className="age-gate-btn age-gate-btn-primary"
                onClick={() => navigate('/', { replace: true })}
              >
                {t.home}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="age-gate-title" className="age-gate-title">{t.title}</h2>
            <p className="age-gate-message">{t.message}</p>
            <div className="age-gate-actions">
              <button type="button" className="age-gate-btn age-gate-btn-primary" onClick={confirm}>
                {t.yes}
              </button>
              <button type="button" className="age-gate-btn age-gate-btn-secondary" onClick={decline}>
                {t.no}
              </button>
            </div>
            <p className="age-gate-note">{t.note}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AgeGate;
