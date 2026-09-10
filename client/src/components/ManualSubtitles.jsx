import React, { useRef } from 'react';

/**
 * Overlay + controls for user-loaded .srt/.vtt on embed players.
 * Pass the return value of useManualSubtitles as `subtitles`.
 */
const ManualSubtitlesOverlay = ({ subtitles }) => {
  if (!subtitles?.currentText) return null;

  return (
    <div className="manual-sub-overlay" aria-live="polite">
      {subtitles.currentText.split('\n').map((line, index) => (
        <span key={`${index}-${line}`} className="manual-sub-line">
          {line}
        </span>
      ))}
    </div>
  );
};

const ManualSubtitlesControls = ({ subtitles }) => {
  const inputRef = useRef(null);

  if (!subtitles) return null;

  const {
    fileName,
    error,
    running,
    offsetMs,
    hasCues,
    loadFile,
    start,
    pause,
    resetClock,
    nudgeOffset,
    clear
  } = subtitles;

  const onPick = (event) => {
    const file = event.target.files?.[0];
    if (file) loadFile(file);
    event.target.value = '';
  };

  const offsetLabel =
    offsetMs === 0
      ? '0.0s'
      : `${offsetMs > 0 ? '+' : ''}${(offsetMs / 1000).toFixed(1)}s`;

  return (
    <div className="manual-sub-panel">
      <div className="manual-sub-panel-head">
        <p className="manual-sub-title">Subtitles (manual)</p>
        <p className="manual-sub-hint">
          Load your .srt / .vtt, press Start when the video is playing. Use +/− if
          lines are early or late.
        </p>
      </div>

      <div className="manual-sub-actions">
        <input
          ref={inputRef}
          type="file"
          accept=".srt,.vtt,text/vtt,application/x-subrip"
          className="manual-sub-file-input"
          onChange={onPick}
        />
        <button
          type="button"
          className="manual-sub-btn"
          onClick={() => inputRef.current?.click()}
        >
          Load SRT
        </button>

        {hasCues && (
          <>
            {!running ? (
              <button type="button" className="manual-sub-btn is-primary" onClick={start}>
                Start
              </button>
            ) : (
              <button type="button" className="manual-sub-btn is-primary" onClick={pause}>
                Pause
              </button>
            )}
            <button type="button" className="manual-sub-btn" onClick={resetClock}>
              Reset clock
            </button>
            <button type="button" className="manual-sub-btn" onClick={clear}>
              Clear
            </button>
          </>
        )}
      </div>

      {hasCues && (
        <div className="manual-sub-sync" role="group" aria-label="Subtitle sync offset">
          <button type="button" className="manual-sub-btn is-compact" onClick={() => nudgeOffset(-2000)}>
            −2s
          </button>
          <button type="button" className="manual-sub-btn is-compact" onClick={() => nudgeOffset(-500)}>
            −0.5s
          </button>
          <span className="manual-sub-offset">{offsetLabel}</span>
          <button type="button" className="manual-sub-btn is-compact" onClick={() => nudgeOffset(500)}>
            +0.5s
          </button>
          <button type="button" className="manual-sub-btn is-compact" onClick={() => nudgeOffset(2000)}>
            +2s
          </button>
        </div>
      )}

      {fileName ? (
        <p className="manual-sub-file-name">
          {fileName}
          {hasCues ? '' : ' (empty)'}
        </p>
      ) : null}
      {error ? <p className="manual-sub-error">{error}</p> : null}
    </div>
  );
};

export { ManualSubtitlesOverlay, ManualSubtitlesControls };
export default ManualSubtitlesControls;
