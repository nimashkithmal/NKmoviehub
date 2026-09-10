import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseSubtitles } from '../utils/parseSubtitles';

const findCueText = (cues, timeMs) => {
  if (!cues.length) return '';
  let low = 0;
  let high = cues.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const cue = cues[mid];
    if (timeMs < cue.startMs) {
      high = mid - 1;
    } else if (timeMs >= cue.endMs) {
      low = mid + 1;
    } else {
      return cue.text;
    }
  }
  return '';
};

/**
 * Manual subtitle clock for cross-origin iframe players.
 * User starts the clock when video is playing; offset nudges fix drift.
 */
export const useManualSubtitles = () => {
  const [fileName, setFileName] = useState('');
  const [cues, setCues] = useState([]);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [baseElapsedMs, setBaseElapsedMs] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [offsetMs, setOffsetMs] = useState(0);
  const [tick, setTick] = useState(0);
  const rafRef = useRef(0);

  const clear = useCallback(() => {
    setFileName('');
    setCues([]);
    setError('');
    setRunning(false);
    setBaseElapsedMs(0);
    setStartedAt(0);
    setOffsetMs(0);
    setTick(0);
  }, []);

  const resetClock = useCallback(() => {
    setRunning(false);
    setBaseElapsedMs(0);
    setStartedAt(0);
    setOffsetMs(0);
    setTick(0);
  }, []);

  const loadFile = useCallback(async (file) => {
    if (!file) return;
    const name = String(file.name || 'subtitles.srt');
    const lower = name.toLowerCase();
    if (!lower.endsWith('.srt') && !lower.endsWith('.vtt')) {
      setError('Please choose an .srt or .vtt file.');
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseSubtitles(text, name);
      if (!parsed.length) {
        setError('No subtitle lines found in that file.');
        setFileName(name);
        setCues([]);
        resetClock();
        return;
      }
      setFileName(name);
      setCues(parsed);
      setError('');
      resetClock();
    } catch (err) {
      setError(err.message || 'Could not read subtitle file.');
      setCues([]);
      setFileName('');
      resetClock();
    }
  }, [resetClock]);

  const start = useCallback(() => {
    if (!cues.length || running) return;
    setStartedAt(Date.now());
    setRunning(true);
  }, [cues.length, running]);

  const pause = useCallback(() => {
    if (!running) return;
    setBaseElapsedMs((prev) => prev + (Date.now() - startedAt));
    setRunning(false);
    setStartedAt(0);
  }, [running, startedAt]);

  const nudgeOffset = useCallback((deltaMs) => {
    setOffsetMs((prev) => prev + deltaMs);
  }, []);

  useEffect(() => {
    if (!running) return undefined;

    const loop = () => {
      setTick((n) => n + 1);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running]);

  const elapsedMs = useMemo(() => {
    void tick;
    const live = running && startedAt ? Date.now() - startedAt : 0;
    return Math.max(0, baseElapsedMs + live + offsetMs);
  }, [baseElapsedMs, startedAt, offsetMs, running, tick]);

  const currentText = useMemo(
    () => findCueText(cues, elapsedMs),
    [cues, elapsedMs]
  );

  return {
    fileName,
    cues,
    error,
    running,
    offsetMs,
    elapsedMs,
    currentText,
    hasCues: cues.length > 0,
    loadFile,
    start,
    pause,
    resetClock,
    nudgeOffset,
    clear
  };
};

export default useManualSubtitles;
